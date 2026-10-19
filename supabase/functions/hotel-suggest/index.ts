/* ════════════════════════════════════════════════════════════════
   hotel-suggest — ホテルの名前を打つと、Google マップの候補（名前と住所）を返す（2026-10-18 オーナー V7・P12.61）

   ブラウザ（pv-hotel-suggest.js）から呼ばれる。ブラウザは Google の鍵を持たない ── 鍵はここ（secret）にだけ在る。

   ── 設計上の約束（ここを崩したら止める）──────────────────
   1. Google へ送るのは、月 10,000 回まで（全員・全部の画面の合計。オーナーの天井）。
      **送る前に**数え札（db/hotel-suggest.sql の pv_hotel_suggest_take）で1回ぶんを取る。
      取れなかった・数え札が答えない・答えが読めない ── どれも Google へは1回も送らない（開いたまま落ちない）。
      取った1回は返さない（Google が失敗しても、時間切れでも、1回に数える）。
   2. 呼ぶのは Autocomplete (New) の1つの口だけ（places:autocomplete）。
      Place Details・写真・口コミ・地図は呼ばない。返すのも、候補の名前・住所・place ID だけ。
   3. 鍵が無い（secret が入っていない）ときは、数え札にも Google にも触らずに not_configured を返す。
      画面はそのとき、今までどおりの「ただの入力欄」のまま（候補を出さないだけ）。
   4. 鍵・打たれた字・候補の中身を、返事にもログにも出さない。ログに出すのは Google の HTTP の番号だけ。
   5. { "ping": 1 }（打った字を含まない）には「いま候補を出せるか」（on）だけを返す。on が真になるのは、鍵があり・数え札につながり・
      数え札の「空きがあるか」（pv_hotel_suggest_room）がちょうど true と答えたときだけ。札は1つも進めない・Google へも送らない。
      画面（pv-hotel-suggest.js）は on が真のときだけ、打った字を送る ── 止まっている・つながっていない・数え札が答えない
      どのときも、打った字はこの口にも届かない（2026-10-19 P12.74）。

   ── デプロイ（オーナー作業・今はしない）────────────────────
   前提: db/hotel-suggest.sql を先に SQL Editor で流す（数え札。逆の順だと「数えられない ＝ 送らない」で止まるだけ）。
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: hotel-suggest ／ このファイルの中身を貼り付け → Deploy
   必要な secret（Edge Functions → Secrets）:
     GOOGLE_PLACES_API_KEY … Google Cloud で作る API キー（Places API (New) だけに制限したもの）。
                             入れるまで、この関数は Google へ1回も送らない。
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。
   ★貼られている版を費用ゼロで確かめる: { "ping": 1 } を POST（Google は呼ばない・数え札は「空きがあるか」を見るだけで進めない。
     返すのは版と真偽だけ: has_key・has_db・on）。
   ════════════════════════════════════════════════════════════════ */

/* ⚠️ このファイルを直したら日付を上げる（ping が返す版の札） */
export const BUILD = '2026-10-19';

/* Google の口は1つだけ（Autocomplete (New)）。ここ以外の Google の住所をこのファイルに書かない。 */
export const ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete';
/* 返してもらう欄は、place ID と「名前・住所」の2行だけ（Autocomplete は欄で値段が変わらない。返事を小さくするため） */
export const FIELD_MASK = 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat';
/* 数え札の口（db/hotel-suggest.sql）。呼ぶ関数は「1回ぶんを取る」と「空きがあるかを見る」の2つだけ（減らす口は無い） */
export const TAKE_RPC = 'pv_hotel_suggest_take';
export const ROOM_RPC = 'pv_hotel_suggest_room';
/* 候補は最大5つ（Google が返す数の上限と同じ） */
export const MAX_ITEMS = 5;
const TIMEOUT_MS = 4000;

type Take = { ok?: unknown; cap?: unknown } | null;
type Item = { name: string; address: string; place_id: string };
type Deps = {
  key: string;                                   // Google の鍵（無ければ ''）
  take: (() => Promise<Take>) | null;            // 数え札で1回ぶんを取る（無ければ null ＝ つながっていない）
  room?: (() => Promise<unknown>) | null;        // 数え札に空きがあるかを見るだけ（ping が使う。true そのもののときだけ「ある」）
  endpoint?: string;                             // 検査だけが手元の模擬の Google を渡す
  fetch?: typeof fetch;
  timeoutMs?: number;
  log?: (...a: unknown[]) => void;
};

/* 打たれた字：前後の空白を落として、日本語・中国語・韓国語の字が在れば2字から、無ければ3字から（画面と同じ決まり）。80字まで。 */
const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯]/;
export function cleanQuery(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const n = [...s].length;
  if (n > 80) return '';
  return n >= (CJK.test(s) ? 2 : 3) ? s : '';
}
/* 都市の名前（画面の見出しの字）。候補をその街に寄せるために、打たれた字の後ろに足す（すでに入っていれば足さない）。 */
export function cleanNear(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s && [...s].length <= 40 ? s : '';
}
/* Google の返事 → 候補（名前・住所・place ID）。形の違うもの・place ID の字が変なものは落とす。 */
export function pick(j: unknown): Item[] {
  const out: Item[] = [];
  const list = j && typeof j === 'object' && Array.isArray((j as { suggestions?: unknown }).suggestions)
    ? (j as { suggestions: unknown[] }).suggestions : [];
  for (const s of list) {
    const p = s && typeof s === 'object' ? (s as { placePrediction?: Record<string, unknown> }).placePrediction : null;
    if (!p || typeof p !== 'object') continue;
    const id = typeof p.placeId === 'string' ? p.placeId : '';
    const sf = p.structuredFormat && typeof p.structuredFormat === 'object' ? p.structuredFormat as Record<string, unknown> : {};
    const txt = (o: unknown) => o && typeof o === 'object' && typeof (o as { text?: unknown }).text === 'string'
      ? String((o as { text: string }).text).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const name = [...txt(sf.mainText)].slice(0, 80).join('');
    const address = [...txt(sf.secondaryText)].slice(0, 200).join('');
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id) || !name) continue;
    out.push({ name, address, place_id: id });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/* ブラウザへ返す許し：このサイトと手元の確かめの画面だけ */
const ORIGIN_OK = /^(https:\/\/(www\.)?pilot-value\.com|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;
function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ORIGIN_OK.test(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
const reply = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

/* 本番の数え札：service_role で pv_hotel_suggest_room を呼ぶ。答えが true そのものでなければ「空きは無い」（分からないも無いと同じ）。 */
export function restRoom(url: string, serviceRole: string, f: typeof fetch = fetch): () => Promise<boolean> {
  return async () => {
    try {
      const res = await f(`${url}/rest/v1/rpc/${ROOM_RPC}`, {
        method: 'POST',
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return false;
      return (await res.json()) === true;
    } catch {
      return false;
    }
  };
}

/* 本番の数え札：service_role で pv_hotel_suggest_take を呼ぶ。答えが {"ok":true} そのものでなければ「取れなかった」。 */
export function restTake(url: string, serviceRole: string, f: typeof fetch = fetch): () => Promise<Take> {
  return async () => {
    try {
      const res = await f(`${url}/rest/v1/rpc/${TAKE_RPC}`, {
        method: 'POST',
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return null;
      const j = await res.json();
      return j && typeof j === 'object' && !Array.isArray(j) ? j as Take : null;
    } catch {
      return null;
    }
  };
}

export function makeHandler(deps: Deps): (req: Request) => Promise<Response> {
  const endpoint = deps.endpoint || ENDPOINT;
  const f = deps.fetch || fetch;
  const wait = deps.timeoutMs && deps.timeoutMs > 0 ? deps.timeoutMs : TIMEOUT_MS;
  const log = deps.log || ((...a: unknown[]) => console.error(...a));
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
    if (req.method !== 'POST') return reply(req, { ok: false, reason: 'method_not_allowed' }, 405);
    let body: Record<string, unknown> = {};
    try {
      const j = await req.json();
      body = j && typeof j === 'object' && !Array.isArray(j) ? j as Record<string, unknown> : {};
    } catch { return reply(req, { ok: false, reason: 'bad_request' }, 400); }
    /* 版と「いま候補を出せるか」だけ（Google は呼ばない・数え札は見るだけで進めない＝費用ゼロ）。回数も打った字も返さない。 */
    if (body.ping) {
      let on = false;
      if (deps.key && deps.take && deps.room) {
        try { on = (await deps.room()) === true; } catch { on = false; }
      }
      return reply(req, { ok: true, build: BUILD, has_key: !!deps.key, has_db: !!deps.take, on });
    }

    const q = cleanQuery(body.q);
    if (!q) return reply(req, { ok: false, reason: 'bad_request' }, 400);
    const lang = body.lang === 'en' ? 'en' : 'ja';
    const near = cleanNear(body.near);
    /* ① 鍵が無い・数え札が無い：どちらにも触らない */
    if (!deps.key || !deps.take) return reply(req, { ok: false, reason: 'not_configured' });

    /* ② 送る前に1回ぶんを取る。{"ok":true} そのもののときだけ先へ（ほかは全部、送らない） */
    let t: Take = null;
    try { t = await deps.take(); } catch { t = null; }
    if (!t || t.ok !== true) {
      return reply(req, { ok: false, reason: t && t.ok === false && t.cap === 'month' ? 'stopped' : 'quota_unavailable' });
    }

    /* ③ Google へ1回だけ（ここから先で失敗しても、取った1回は返さない） */
    const input = near && !q.toLowerCase().includes(near.toLowerCase()) ? `${q} ${near}` : q;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), wait);
    try {
      const res = await f(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': deps.key, 'X-Goog-FieldMask': FIELD_MASK },
        body: JSON.stringify({ input, languageCode: lang, includedPrimaryTypes: ['lodging'], includeQueryPredictions: false }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        log('hotel-suggest: google status', res.status);   // ★番号だけ（本文・鍵・打たれた字は出さない）
        return reply(req, { ok: false, reason: 'read_failed' });
      }
      const j = await res.json();
      return reply(req, { ok: true, items: pick(j) });
    } catch {
      log('hotel-suggest: google unreachable');               // ★例外の中身は出さない
      return reply(req, { ok: false, reason: 'read_failed' });
    } finally {
      clearTimeout(timer);
    }
  };
}

/* Supabase（Deno）の上でだけ立ち上がる。手元の検査（Node）は makeHandler を import して、模擬の Google と手元の数え札を渡す。 */
type DenoLike = { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): unknown };
const D = (globalThis as { Deno?: DenoLike }).Deno;
if (D && typeof D.serve === 'function') {
  const url = D.env.get('SUPABASE_URL') ?? '';
  const role = D.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  D.serve(makeHandler({
    key: D.env.get('GOOGLE_PLACES_API_KEY') ?? '',
    take: url && role ? restTake(url, role) : null,
    room: url && role ? restRoom(url, role) : null,
  }));
}
