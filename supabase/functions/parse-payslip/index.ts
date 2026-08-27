/* ════════════════════════════════════════════════════════════════
   parse-payslip — 給与明細の画像を読んで「正規化した行明細」を返す

   ブラウザ（payslip.js）から直接呼ばれる。translate-review と違い
   webhook 起動ではないので、CORS とレート制限を自前で持つ。

   ── 設計上の約束（ここを崩したら止める）──────────────────
   1. 画像は **メモリ内だけ**。Storage にも DB にも書かない。
      レスポンスにも返さない（呼んだ側が既に持っている）。
   2. **画像本文・明細のラベル本文・金額を console に出さない。**
      ログに出た瞬間、Supabase のダッシュボードに残る＝「保存しない」が嘘になる。
      → db/test-payslip-parse.mjs がこのファイルを grep して検査している。
   3. 分からない項目を勝手に丸めない。`unmapped` に落として、
      あとで本人に「これはどれですか？」と聞く（＝学習ループの入口）。
   4. **判定結果を自動で投稿しない。** ここが返すのはフォームの下書きだけ。
      送信は必ず本人が確認してから（payslip.js 側の責務）。
   5. レート制限が使えないときは **fail closed**（拒否）。
      開いたまま落ちると API 費用が青天井になる。

   ── デプロイ（オーナー作業）────────────────────────────────
   前提1: db/parse-payslip.sql を先に SQL Editor で実行しておくこと
         （pv_parse_quota テーブルと pv_parse_quota_take RPC を作る）
   前提2: db/parse-payslip-global-cap.sql を実行しておくこと
         （全体の天井 pv_parse_quota_take_v2 を作る）
         ★★ 必ず SQL が先。先にこの関数を貼ると、まだ無い RPC を呼んで
            fail closed になり、全部 429 になる（危険側ではなく安全側だが機能は止まる）。
   Supabase → Edge Functions → Deploy a new function → Via Editor
     関数名: parse-payslip ／ このファイルの中身を貼り付け → Deploy

   必要な secret（Edge Functions → Secrets）:
     ANTHROPIC_API_KEY_PAYSLIP … この関数専用の sk-ant-...（推奨）
                                 無ければ ANTHROPIC_API_KEY に落ちる。
                                 分ける理由は下の宣言のところに書いた。
     ANTHROPIC_API_KEY … 共通。translate-review が使っている既存のもの。
     PV_IP_SALT        … 必須。IP を平文で持たないための HMAC 鍵（任意の長い文字列）
     PV_PARSE_DAILY_LIMIT  … 任意。1人（未ログインは1つの IP）あたり1日 何回まで（既定 30）
     PV_PARSE_GLOBAL_LIMIT … 任意。全体で1日 何回まで（既定 200 ≒ $4/日）
     PV_PARSE_MONTH_LIMIT  … 任意。全体で1ヶ月 何回まで（既定 2000 ≒ $40/月・0 で無効）
     RESEND_API_KEY    … 任意。天井に当たった瞬間に info@ へ1通だけ知らせる。
                         無ければ通知しないだけ（読み取りの動作には影響しない）。
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY は Supabase が自動で入れる。

   ★上限を変えたいときは secret の値を書き換えるだけでよい（貼り直し不要）。
   ★今どれだけ使ったかは SQL Editor で: select * from pv_parse_usage();
   ════════════════════════════════════════════════════════════════ */

/* ★この関数専用のキーがあればそれを使い、無ければ共通のものに落ちる。
   明細解析は「画像を外部APIに送る」いちばん重い経路なので、
   ここだけ独立して revoke できるようにしておく（口コミ翻訳を巻き込まない）。
   ついでに Anthropic のコンソールで費用が別々に見える＝1枚あたりの原価が分かる。
   ※専用キーを登録し忘れても動く（＝新しい落ち方を増やしていない）。 */
const ANTHROPIC_API_KEY =
  Deno.env.get('ANTHROPIC_API_KEY_PAYSLIP') || Deno.env.get('ANTHROPIC_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IP_SALT = Deno.env.get('PV_IP_SALT') ?? '';

/* ★全体の天井。1人あたりの上限だけでは、IP を変えれば人数はいくらでも増やせる。
     リポジトリが PUBLIC で anon キーも公開されているので、ここが無いと
     Anthropic の請求に上限が無い。数字は secret で変えられる（貼り直し不要）。
   ★読めない値・変な値が入っていたら既定に落ちる。「無制限」には落ちない。 */
const posInt = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
};
const GLOBAL_LIMIT = Math.max(1, posInt(Deno.env.get('PV_PARSE_GLOBAL_LIMIT'), 200));
/* ★1人あたりの1日の回数。ログインの有無で変えない（2026-08-14）。
   未ログインを1回にしていたとき、明細を上げた人がその場で行き止まりになった。
   しかも数える単位が IP なので、携帯回線のように多数が1つの IP を共有すると
   他人が使い切った直後の人が1回も試せない。読ませてから会員になってもらう。
   ゼロにはしない：anon キーが公開されている以上、1人あたりの上限が無いと
   スクリプト1本で全体の1日ぶんを使い切られ、そのあと来た全員が使えなくなる。
   守っているのは財布ではなく可用性。明細を1枚上げる人に30回は見えない。
   既定を 30 にしたのはオーナーの指示（2026-08-14）。1人が使い切っても
   $0.60 で、全体の天井（下の GLOBAL_LIMIT = 200回/日 ≒ $4）が先に効く。
   変えるときは secret PV_PARSE_DAILY_LIMIT の値だけ書き換えればよい（貼り直し不要）。 */
const DAILY_LIMIT = Math.max(1, posInt(Deno.env.get('PV_PARSE_DAILY_LIMIT'), 30));
const MONTH_LIMIT = posInt(Deno.env.get('PV_PARSE_MONTH_LIMIT'), 2000);   // 0 = 見ない
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'info@pilot-value.com';
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'PILOT VALUE <noreply@pilot-value.com>';

const MODEL = 'claude-sonnet-5';
const MAX_B64 = 8_500_000;           // ≒ 6MB の画像
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/* こちらの語彙。ここに無いものは unmapped に落ちる。
   pay-report.html の入力欄と対応している（payslip.js の KIND_FIELD が対応表）。 */
export const EARNING_KINDS = [
  'base',            // 基本給（本給A・本給B のように複数行に割れることがある）
  /* ★2026-08-27。フォームが 2026-08-26 に基本給と割ったので、こちらも割る。
     日本＝基本給が下限、米国＝保証給が下限で意味が違う。1つの列に混ぜると
     二度と割れず、レポートの緑の切れが「基本給」と嘘をつく（CLAUDE.md）。 */
  'guarantee',       // Flight time 保証手当 / 職務手当（Minimum Guarantee）。★職務手当≠これ。下の規則を読む
  'command',         // 職務・役職手当（機長手当など）
  'housing',         // 住宅手当（現金）
  'flight_variable', // 変動乗務手当（変動付加乗務時間・深夜変動付加割増・変動付加乗務回数など）
  'per_diem',        // 日当・パーディアム（非課税の実費補填）
  'transport',       // 通勤・交通費
  'absence',         // 不就労減額など、支給欄に立つマイナス行。★符号を保つ
  'notional',        // 現物給与の課税処理（航空券課税など）。控除欄に同額が立ち、手取りは動かない
  /* ★2026-08-27。役割ごとのモジュール（pay-report.html の #s3-instr / #s3-exam）へ入れる。
     語彙に無かったころは「その他手当」に落ちていた＝フォーム自身の
     「役割の手当をここに入れない」という約束を、明細経由のときだけ破っていた。
     ★組合・管理職・兼務は足さない（オーナー決定 2026-08-27）。組合は「組合名を返さない」規則と
       唯一ぶつかり、管理職・兼務は明細に決まった印字が無い＝誤分類がデータを黙って汚す。 */
  'instructor',      // 教官・訓練の手当（INSTRUCTOR PAY / TRI / 教官手当）
  'examiner',        // 審査・査察の手当（CHECK AIRMAN / TRE / 審査手当）
  'other',           // その他の手当
  'bonus',           // 賞与（年額）
  'profit',          // プロフィットシェア（年額）
] as const;

export const HOUR_KINDS = [
  'block',   // 乗務時間（ブロックタイム）
  'duty',    // 勤務時間・総勤務時間
  'night',   // 深夜時間
  'credit',  // クレジットアワー（米国。block とは別物。リグ・欠航補償を含む）
  /* ★2026-08-27。§2 の「保証フライトタイム」(f-guar) に入る。
     ⚠️ 時間の行は unmapped に落ちず、語彙に無いと下の for が continue で**黙って捨てる**。
        米国の見本は前から GUARANTEE 73.00 を印字しているのに、ここに無いせいで消えていた。 */
  'guarantee', // 契約上の最低保証時間（MIN GUARANTEE / 保証時間）
] as const;

/* 変動給の「何に連動する支給か」。pay-report.html の <select class="pd-basis"> の
   10択と**1つ違わず同じ並び**でなければならない（db/test-payslip-parse.mjs が突き合わせる）。
   ★語彙に無い答えは捨てずに 'unknown' へ倒す。画面の10択にも「わからない」があり、
     行を作る以上どれかは入っていないと必須で引っかかるため。 */
export const VARIABLE_BASIS = [
  'block',    // 飛行・クレジット時間
  'duty',     // 勤務・勤務時間
  'sector',   // 便数・着陸回数
  'overtime', // 時間外・追加勤務
  'reserve',  // 待機・スタンバイ
  'night',    // 深夜・夜間勤務
  'weekend',  // 週末・日曜勤務
  'holiday',  // 祝日勤務
  'other',    // その他
  'unknown',  // わからない
] as const;

/* 分類できなかった行（unmapped）の中に混ざる「金額でない行」。
   支給欄の隣に「乗務日数 14」「SECTORS 42」のように印字されるので、
   モデルは支給の行と一緒に拾ってしまう。実際に起きた（payslip.js が
   「乗務日数 14」に JPY を付けて出していた）。

   ★2026-08-14 から unmapped は「未分類の支給」として金額に数える。
     数える前にここで外さないと、乗務日数の 14 が年収に足される。
   ★間違え方が対称ではない。金額を「回数」と見なして外すと、その額が年収から
     黙って消える（＝今回直している事故そのもの）。逆に回数を金額として数えても、
     足されるのは 14 のような小さい数で、質問が1つ余計に出るだけ。
     だから**回数と判定するのは、語も金額も両方そろったときだけ**にする。
   ★「乗務回数手当」「変動付加乗務回数」のように、回数という語を持つ本物の手当が
     実際にある（プロンプトの flight_variable の語彙に入っている）。
     金額の桁で分ける：日数は31まで、セクター数・レグ数も3桁に届かない。
     どの通貨でも、本物の支給が 400 以下ということはない。
   ★payslip.js にも同じ判定がある。ブラウザ側は push で、この関数は
     ダッシュボードでの貼り替えで本番へ入る＝どちらか片方が古い時期が必ずある。
     db/test-payslip-parse.mjs が payslip.js から実体を切り出して突き合わせる。 */
export const COUNT_MAX = 400;
export function isCountRow(label: unknown, amount: unknown): boolean {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? Math.abs(amount) : 0;
  if (n > COUNT_MAX) return false;
  const s = String(label ?? '');
  if (/手当|allowance|\bpay\b|給|bonus/i.test(s)) return false;
  return /日数|回数|days|count|sectors|legs/i.test(s);
}

/* 「111H59」は 111.59 ではない。111時間59分 ＝ 111.98 時間。
   ここを取り違えると分母が小さくなり、時給が実際より高く出る（＝煽る方向に外す）。

   ★モデルに割り算をさせない。「印字されている文字列そのまま」を返させて、
     10進への変換はここでやる。書き写しは易しく、計算は間違える。
     しかも 111.59 という数字だけ渡されると、正しい10進なのか60進の読み違いなのか
     こちら側から区別する術が無い（どちらも合法な小数）。だから raw を必ずもらう。 */
export function parseHours(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  /* 全角は数字だけでなく「Ｈ」「：」も来る。数字しか直さないと
     「１２０Ｈ３０」が読めずに分母が消える。ASCII 相当を丸ごと半角に倒す。 */
  const s = String(v ?? '').trim().replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!s) return null;

  // 111H59 / 111:59 / 111時間59分 / 111h59m / 55H00 / 5H
  const hm = s.match(/^(\d{1,3})\s*(?:時間|[Hh:])\s*(\d{1,2})?\s*(?:分|[Mm])?$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = hm[2] === undefined || hm[2] === '' ? 0 : Number(hm[2]);
    if (m > 59) return null;              // 分が60以上＝読み違い。黙って通さない
    return h + m / 60;
  }
  // 78.2 のような素の10進（欧米様式）
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(IP_SALT),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* 1日あたりの回数を DB 側で数える。天井は3枚：
     ・本人 … 未ログイン=1回/日、ログイン=10回/日
     ・全体 … 1日 GLOBAL_LIMIT 回
     ・全体 … 1ヶ月 MONTH_LIMIT 回（0 なら見ない）
   順番は DB 側で「本人 → 全体」。逆にすると、自分の上限に達した人が
   叩き続けるだけで全体の枠を潰せて、1つのIPから全員を締め出せてしまう。
   ★RPC が落ちたら通さない。開いたまま落ちない。 */
type QuotaCap = 'subject' | 'global' | 'month' | 'bad' | 'error';
type QuotaRes = { ok: boolean; cap?: QuotaCap; trip?: boolean };

async function takeQuota(subject: string, limit: number): Promise<QuotaRes> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pv_parse_quota_take_v2`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_subject: subject,
        p_limit: limit,
        p_global_limit: GLOBAL_LIMIT,
        p_month_limit: MONTH_LIMIT,
      }),
    });
    if (!res.ok) return { ok: false, cap: 'error' };
    const out = await res.json();
    if (!out || typeof out !== 'object') return { ok: false, cap: 'error' };
    return { ok: out.ok === true, cap: out.cap, trip: out.trip === true };
  } catch {
    return { ok: false, cap: 'error' };
  }
}

/* 全体の天井に当たった瞬間に1通だけ知らせる。
   ★天井を越えた最初の1回（trip）だけ呼ぶので、多くても1日1通。
   ★失敗しても読み取りの結果は変えない（通知は落ちてよい）。
   ★本文に画像もラベルも金額も入れない。入れるのは回数だけ。 */
async function alertOwner(cap: string): Promise<void> {
  if (!RESEND_KEY) return;
  const limit = cap === 'month' ? MONTH_LIMIT : GLOBAL_LIMIT;
  const span = cap === 'month' ? '今月' : '今日';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `parse-cap:${cap}:${new Date().toISOString().slice(0, 10)}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `[PILOT VALUE] 明細読み取りが${span}の上限（${limit}回）に達しました`,
        text:
          `明細の読み取りが${span}の全体上限 ${limit} 回に達したので、` +
          `これ以降の読み取りを止めています。\n\n` +
          `・利用者には「${span}は混み合っています」と出ています（エラーには見せていません）\n` +
          `・上限を上げるには Supabase → Edge Functions → Secrets の\n` +
          `  ${cap === 'month' ? 'PV_PARSE_MONTH_LIMIT' : 'PV_PARSE_GLOBAL_LIMIT'} を書き換えてください（貼り直し不要）\n` +
          `・1枚あたり ≒ $0.02 です\n` +
          `・使用状況: SQL Editor で select * from pv_parse_usage();\n\n` +
          `いつもの利用でここに当たることは想定していないので、\n` +
          `身に覚えがない場合は誰かがまとめて叩いている可能性があります。`,
      }),
    });
  } catch { /* 通知が落ちても読み取りの動作は変えない */ }
}

/* ────────────────────────────────────────────────────────────────
   鍵が死んだことを黙って隠さない。

   2026-08-10、Anthropic のキーを1本消したら、この関数だけが専用 secret
   （ANTHROPIC_API_KEY_PAYSLIP）越しに死んだキーを掴んだまま残り、
   **利用者には「読み取れませんでした」としか出ないまま止まっていた**。
   `read_failed` は「画像が読めなかった」ときと同じ返り値なので、
   画面を見ている限り一生気づけない。気づいたのは実画像で試したときだった。

   ★res.ok の判定と通知だけを足す。利用者への返り値は変えない
     （鍵の状態を外に漏らさない）。
   ★通知が落ちても読み取りの動作は変えない。
   ──────────────────────────────────────────────────────────── */

/* エラー応答から error.type だけを取り出す。
   ★message は読まない。明細の断片が echo される経路を作らないため。
     error.type は 'authentication_error' のような固定語彙なので安全。 */
export async function anthropicErrorType(res: { text(): Promise<string> }): Promise<string> {
  try {
    const t = (JSON.parse(await res.text()) as { error?: { type?: unknown } })?.error?.type;
    return typeof t === 'string' ? t : '';
  } catch { return ''; }
}

/* 「こちらの設定が原因で、放っておくと全件失敗し続ける」ものだけ true。
   利用者の入力が原因のもの（大きすぎる画像など）は入口で弾いているので来ない。
     401/403 … 鍵が無効・revoke 済み・権限が無い
     400 invalid_request_error … 残高不足、モデルが受け付けない引数。
       （2026-08-10 に temperature で実際に食らった。これも全件失敗する）
   429（混雑）と 5xx（向こうの障害）は時間で直るので鳴らさない。 */
export function isFatalKeyError(status: number, errType: string): boolean {
  if (status === 401 || status === 403) return true;
  return status === 400 && errType === 'invalid_request_error';
}

/* 1日1通だけ。インスタンス内の再送はここで止め、インスタンスを跨ぐぶんは
   Resend の Idempotency-Key（24時間有効）が止める。 */
let keyAlertDay = '';
async function alertKeyDead(status: number, errType: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  if (keyAlertDay === day) return;
  keyAlertDay = day;
  if (!RESEND_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `parse-key-dead:${day}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: '[PILOT VALUE] 明細読み取りが止まっています（APIキーの問題）',
        text:
          `parse-payslip が Anthropic に ${status}（${errType || 'type不明'}）で断られました。\n` +
          `直すまで、明細を上げた人には全員「読み取れませんでした」と出ます。\n\n` +
          `見るところ:\n` +
          `1. Supabase → Edge Functions → Secrets\n` +
          `   ANTHROPIC_API_KEY_PAYSLIP があるなら、それを消せば共通の\n` +
          `   ANTHROPIC_API_KEY に落ちます（再デプロイ不要）。\n` +
          `2. platform.claude.com → APIキー\n` +
          `   使っているキーが revoke / 期限切れになっていないか。\n` +
          `3. 400 invalid_request_error のときは残高切れの可能性もあります。\n\n` +
          `直ったかの確認: node db/smoke-parse-payslip.mjs --live（実画像1枚 ≒ $0.02）\n` +
          `read_failed が1〜2秒で返れば鍵、9〜10秒かかっていれば読み取り側の問題です。`,
      }),
    });
  } catch { /* 通知が落ちても読み取りの動作は変えない */ }
}

/* Authorization ヘッダのトークンが本物のユーザなら user.id を返す。
   anon キーがそのまま入っていることもあるので、その場合は null。 */
async function userIdFrom(auth: string | null): Promise<string | null> {
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: auth },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return typeof u?.id === 'string' ? u.id : null;
  } catch {
    return null;
  }
}

export function systemPrompt(lang: string): string {
  return [
    'You read a photograph or scan of an airline pilot\'s monthly payslip and return structured data.',
    /* ★言語を3つに数え上げると、それ以外の様式を「読めない」と扱う口実になる。
       黒塗り側の手がかり語は既に20言語以上に当たるので、読み取り側だけ狭いのは不整合。 */
    'The payslip is most commonly in Japanese or in English (including the English used by Gulf',
    'and Asian carriers), but it may be in any language. Read it whatever language it is in.',
    /* ★実測（現実の明細）：ページ全体のスクリーンショットを落とすと、
       サイトの見出しや本文まで読もうとして earnings も hours も空になり
       not_a_payslip で弾かれる。明細だけを切り出すと全項目正しく入る。
       「大きなページの一部かもしれない」と先に言っておけば、この取りこぼしは消える。 */
    'The image may be a screenshot of a larger page (a payroll web portal, a PDF viewer, an email),',
    'so the payslip can occupy only part of it. Locate the region that is the payslip itself and read',
    'that region. Ignore site headings, navigation, buttons, adverts, testimonials and any other body',
    'text that is not part of the payslip. Black rectangles are redactions the pilot applied on purpose —',
    'do not try to guess what is under them, and do not treat their presence as a reason to refuse.',
    '',
    'Return ONE JSON object, no prose, no code fence, with exactly these keys:',
    '{"currency":string|null,"period":{"year":int,"month":int}|null,',
    ' "earnings":[{"label":string,"amount":number,"kind":string,"basis":string|null}],',
    ' "gross_total":number|null,',
    ' "deductions_total":number|null,"net_pay":number|null,"ytd_taxable":number|null,',
    ' "hours":[{"label":string,"raw":string,"value":number,"kind":string}],',
    ' "unmapped":[{"label":string,"amount":number}],"confidence":"high"|"medium"|"low"}',
    '',
    `"kind" for earnings MUST be one of: ${EARNING_KINDS.join(', ')}.`,
    `"kind" for hours MUST be one of: ${HOUR_KINDS.join(', ')}.`,
    `"basis" is ONLY for kind "flight_variable" — what the amount moves with. One of: ${VARIABLE_BASIS.join(', ')}.`,
    '  Use null for every other kind. Use "unknown" when the line is variable pay but the slip does not',
    '  say what drives it. Never force a guess — "unknown" is a real answer the pilot can correct.',
    '',
    'Classification rules:',
    '- base: 基本給 / 本給 / 本給A / 本給B / basic salary / base pay / fixed monthly salary.',
    '  A Japanese slip often splits base pay over several lines (本給A and 本給B). Return each as its own',
    '  entry with kind "base" — do not add them together yourself.',
    '- guarantee: MINIMUM GUARANTEE / MIN GUAR / GUARANTEE PAY / MONTHLY GUARANTEE / 保証給 —',
    '  the FLOOR amount paid when the hours actually flown fall below the contractual minimum.',
    '  It is usually printed with an hours figure next to it (e.g. 73:00) and is the bottom of the',
    '  monthly pay, not a fixed allowance for holding a rank.',
    '  ★ 職務手当 and 役職手当 are NOT guarantee. They are "command". A Japanese slip that prints',
    '  職務手当 must stay "command" — putting it here breaks the breakdown for every Japanese pilot.',
    '  When a slip has no floor line at all, simply do not return this kind.',
    '- command: 職務手当 / 役職手当 / 機長手当 / command pay / position allowance —',
    '  a FIXED monthly amount paid for holding the rank. It does not move with hours flown.',
    '  An "override" line is only command pay when it is a flat monthly figure for being captain.',
    '- housing: 住宅手当 / housing allowance / accommodation allowance, ONLY when paid in cash.',
    '- flight_variable: the variable flying pay bucket — 乗務手当 / 変動付加乗務時間 / 変動付加乗務回数 /',
    '  深夜変動付加割増 / 深夜勤務割増手当 / 特別勤務割増手当 / 土日祝出勤手当 / 時間外手当 /',
    '  flying pay / flight pay / hourly flight allowance / productivity pay /',
    /* ★実測で unmapped に落ちた語だけを足している（2026-08-14・豪州の様式）。
       オーナーが実務で見ている印字そのままで、推測で増やした語ではない。
       sector pay = 区間数で払う変動給、FDP allowance = 勤務時間(Flight Duty Period)で払う変動給。 */
    '  sector pay / FDP allowance.',
    '  Also here: any per-hour premium on top of the hourly rate — OVERRIDE - INTL /',
    '  international override / night override / holding pay / deadhead pay. These are printed with',
    '  an HOURS and a RATE next to them, which is exactly what makes them variable, not rank-based.',
    '  If several such lines exist, return them as separate entries all with kind "flight_variable".',
    /* ★basis は「実際に印字されている語」からしか決めない。ここに並べたのは上の flight_variable の
       規則が既に持っている語だけで、推測で足した語は1つも無い（語彙を増やすと誤分類が増える）。 */
    '  Give each of them a "basis" — what the amount moves with, taken from what is printed:',
    '    block  = flying / credit hours — a line printed with HOURS and a RATE, 変動付加乗務時間,',
    '             flying pay, flight pay, hourly flight allowance, OVERRIDE - INTL, holding pay, deadhead pay.',
    '    duty   = duty hours — FDP allowance, 勤務時間 based premiums.',
    '    sector = number of sectors or landings — sector pay, 変動付加乗務回数.',
    '    overtime = 時間外手当 / overtime.',
    '    reserve  = standby / reserve duty pay.',
    '    night    = 深夜変動付加割増 / 深夜勤務割増手当 / night premium.',
    '    weekend  = 土日出勤手当 / weekend duty.   holiday = 祝日出勤手当 / public holiday duty.',
    '    other    = clearly variable, and clearly none of the above.',
    '    unknown  = the slip does not say what it moves with. Prefer this over guessing.',
    '  ★ 土日祝出勤手当 mixes weekend and holiday in one label — use "weekend".',
    '- per_diem: 日当 / パーディアム / per diem / layover allowance / meal allowance.',
    '  Per diem is usually tax-free reimbursement — classify it here, never as base.',
    '- transport: 通勤手当 / 交通費 / commuting allowance / transport allowance.',
    '- absence: a line in the EARNINGS column that REDUCES pay — 不就労減額 / 欠勤控除 / 減額 /',
    '  absence deduction / unpaid leave. Return the amount as a NEGATIVE number, exactly as printed.',
    '  It sits in the earnings column, so it is not a deduction — never move it to "deductions_total".',
    '- notional: imputed income that is added here and taken straight back in the deductions column with',
    '  the SAME amount — 航空券課税 / 現物給与 / 通勤定期現物 / imputed income / taxable benefit.',
    '  Take-home does not move by a single yen, so it must never be counted as income.',
    '  If the identical label AND amount also appear under deductions, it is certainly notional.',
    '  Many people photograph only the earnings page, so classify by the label alone when the',
    '  deductions column is not visible — do not fall back to "other" just because you cannot check.',
    '- bonus: 賞与 / 一時金 / bonus — annual figures that happen to appear on a monthly slip.',
    '- profit: profit share / profit sharing / 利益配分.',
    '- instructor: pay for TRAINING other pilots — INSTRUCTOR PAY / INSTRUCTOR OVERRIDE / TRI / TRE-less',
    '  training roles / TRAINING CAPTAIN / LINE TRAINING / SIM INSTRUCTOR / 教官手当 / 訓練手当.',
    '- examiner: pay for CHECKING or examining other pilots — CHECK AIRMAN / CHECK PILOT /',
    '  CHECK AIRMAN OVERRIDE / TRE / EXAMINER / LINE CHECK / 審査手当 / 査察手当.',
    '  ★ Both of these are paid for HOLDING A ROLE and doing that work, which is neither "command"',
    '  (a flat amount for holding a rank) nor "other". They go to their own field on the form, so a',
    '  wrong answer here puts money in the wrong column. If the label does not clearly say training',
    '  or checking, use "unmapped" and let the pilot say what it was.',
    '- other: an allowance you are confident is pay but that fits none of the above',
    '  (e.g. 株式積立奨励金 / 共済 / 資格手当 / 語学手当).',
    '',
    'CRITICAL — do not guess:',
    '- If you cannot confidently classify a line, put it in "unmapped" instead of forcing it into "other".',
    '  An unmapped line is still counted as pay and the pilot is simply asked what it was, so it costs',
    '  nothing. A wrong "kind" silently corrupts the dataset. When in doubt, use "unmapped".',
    '- Never invent a number that is not printed on the slip. Omit rather than estimate.',
    '- Deductions (tax, social insurance, union dues, loans) must NOT appear in "earnings".',
    '  Return only their SUM in "deductions_total". Never itemise deductions.',
    '  NEVER return 組合費 or the name of a union — which union someone belongs to is highly sensitive.',
    '- "net_pay" is the take-home actually paid (差引支給額 / net pay / net salary).',
    '- "ytd_taxable" is the year-to-date cumulative taxable pay if printed',
    '  (累積課税支給額 / 課税支給額累計 / YTD gross / year to date taxable). null if absent.',
    /* ★印字された支給合計を返させる。これが無いと、こちら側で検算のしようがなく、
       「合っているか自分で確かめろ」というモデルの自己申告を信じるしかなくなる。
       1行落ちても桁を1つ間違えても confidence:"high" のまま画面に出ていた。 */
    '- "gross_total" is the TOTAL of the earnings column as PRINTED on the slip',
    '  (支給合計 / 総支給額 / Gross Pay / GROSS EARNINGS / Total Earnings).',
    '  Copy the printed total. Do NOT compute it yourself, and do NOT return a total you cannot see.',
    '  null if no such total is printed.',
    '- "earnings" plus "unmapped", added up WITH their signs, must equal that printed total.',
    '  If it does not, you dropped a line or lost a minus sign. Re-read before answering.',
    '',
    /* ★英語版で一番危ない読み違い。湾岸・米国の明細は「今月」と「年初来」を横に並べる。
       年初来の列を読むと月給が数倍になり、しかも合計も年初来なので検算だけでは
       気づけない場合がある。だから列そのものを固定する。 */
    'CRITICAL — which column is the money:',
    '- Many Gulf, Asian and US slips print TWO amount columns side by side: the CURRENT PERIOD',
    '  and the cumulative YEAR-TO-DATE ("YTD", "Year to Date", "Cumulative", "累計", "当年累計",',
    '  "本年累計"). ALWAYS read the CURRENT PERIOD column. NEVER take a cumulative figure as this',
    '  month\'s amount, and never as "gross_total". Put the cumulative taxable pay in "ytd_taxable"',
    '  and nowhere else. If ONLY cumulative figures are visible, return "earnings" empty rather',
    '  than guessing — do not fall back to the year-to-date column.',
    '- US-style tables print columns EARNINGS / HOURS / RATE / AMOUNT. The money is the AMOUNT',
    '  column. The RATE (a price per hour, e.g. 302.11) and the HOURS are never the amount.',
    '  A line like "CREDIT HOURS  84.55  302.11  25,543.40" has amount 25543.40, not 84.55.',
    '',
    'Hours:',
    '- block: 乗務時間 / block hours / block time / flight hours actually flown.',
    '- duty: 勤務時間 / 総勤務時間 / duty hours / total hours on duty (includes ground and standby).',
    '- night: 深夜時間 / night hours / 深夜割増対象時間.',
    '- credit: US-style credit hours / credited time. NOT the same as block — keep it separate.',
    '- guarantee: the contractual MINIMUM hours guaranteed for the month — GUARANTEE / MIN GUARANTEE /',
    '  MIN MONTHLY GUARANTEE / MONTHLY GUARANTEE / 保証時間. It is a floor written into the contract,',
    '  not time the pilot actually worked, so never return it as "block" or "credit".',
    '  A US slip often prints it twice: as an hours figure and next to the guarantee AMOUNT.',
    '  Return the hours here and the money as an earning with kind "guarantee".',
    '- 不就労時間 / absence hours / unpaid hours is NOT one of these. Leave it out entirely.',
    '  It is time NOT worked, and on Japanese slips it is already excluded from 勤務時間.',
    '- "raw" MUST be the value copied EXACTLY as printed, character for character: "111H59", "55H00",',
    '  "3H14", "5H", "78:12", "78.2". Do NOT reformat it, do NOT convert it, do NOT strip the letter.',
    '- Japanese slips print hours and MINUTES: "111H59" means 111 hours 59 minutes, NOT 111.59 hours.',
    '  Put your best decimal in "value", but "raw" is what is trusted — copy it faithfully and we do',
    '  the arithmetic. If you cannot read a digit, omit the whole line rather than guessing it.',
    '- Ignore hour boxes that are printed but left blank.',
    '',
    'Amounts: strip thousands separators and currency symbols; return plain numbers.',
    'currency: ISO 4217 (JPY, USD, AED, QAR, SAR, KWD, CNY, KRW, EUR, ...). null if not printed.',
    '- A currency SYMBOL never decides this on its own. "¥" is printed on BOTH Japanese and',
    '  Chinese slips, and Chinese slips also print "￥" or "元" for CNY. If the labels are in',
    '  Simplified Chinese (基本工资 / 飞行小时费 / 应发合计 / 实发工资), the currency is CNY, not JPY.',
    '  Decide from the language of the labels and the country of the employer, not from the glyph.',
    'period: the month the slip covers, not the payment date, if both are printed.',
    'If parts of the slip are blacked out, ignore those regions — they are redacted on purpose.',
    `The user reads ${lang === 'en' ? 'English' : 'Japanese'}; keep "label" exactly as printed on the slip.`,
  ].join('\n');
}

type Parsed = Record<string, unknown>;

/* モデルの出力は信用しない。語彙に無い kind は unmapped へ落とす。

   ★export しているのは Deno 側の都合ではなく、手元の検査のため。
     db/test-payslip-parse.mjs と db/eval-payslip.mjs が Node 24 の .ts 直読みで
     **この実体をそのまま** import して回す（assert-translate-review.mjs と同じ手）。
     写経した複製を測ると「テストは通るが本番は直っていない」が起きる。 */
export function sanitize(raw: Parsed): Parsed {
  const numOr = (v: unknown): number | null => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    /* 日本の明細のマイナスは「-」だけではない。△21,802 や ▲21,802、全角の −21,802 も同じ意味。
       ここを落とすと不就労減額が符号ごと消えて、支給合計と勘定が合わなくなる。 */
    const s0 = String(v ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    const neg = /^[\s(]*[-−–—△▲]/.test(s0) || /\)\s*$/.test(s0);
    const n = parseFloat(s0.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n)) return null;
    return neg ? -n : n;
  };
  const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');

  /* ★項目名の検品。項目名は画面に出るだけでなく、そのまま DB（payslip_detail）に
     溜まる＝一度入ると消せない。明細の項目名に5桁以上続く数字は本来出てこないので、
     出てきたらそれは社員番号か口座番号の紛れ込み（OCR が隣の枠を巻き込んだ形）。
     ★行ごと捨てない。捨てると金額まで消えて支給合計と合わなくなる。
       数字の並びだけを伏せて、項目名としての意味は残す。
     長さは40字で切る。明細の項目名がそれより長いことは無く、長いものは
     読み違いで隣の列を連結した形なので、切っても失うものが無い。 */
  const lbl = (v: unknown) => str(v).replace(/\d{5,}/g, '…').slice(0, 40).trim();

  const earnings: Array<{ label: string; amount: number; kind: string; basis?: string }> = [];
  /* count:true ＝ 金額ではない行（乗務日数など）。付けるのはここ1か所で、
     支給合計の検算も画面側の集計も、この印を見て外す。 */
  const unmapped: Array<{ label: string; amount: number; count?: true }> = [];
  const putUnmapped = (label: string, amount: number) => {
    unmapped.push(isCountRow(label, amount) ? { label, amount, count: true } : { label, amount });
  };

  for (const e of Array.isArray(raw.earnings) ? raw.earnings : []) {
    const row = e as Parsed;
    let amount = numOr(row.amount);
    const label = lbl(row.label);
    /* ★ここで amount <= 0 を弾いてはいけない。支給欄にはマイナスが立つ（不就労減額）。
         落とすと支給合計と合わなくなり、しかも黙って合計が水増しされる方向にずれる。 */
    if (amount === null || amount === 0 || !label) continue;
    const kind = str(row.kind);
    if (!(EARNING_KINDS as readonly string[]).includes(kind)) { putUnmapped(label, amount); continue; }
    if (kind === 'absence') amount = -Math.abs(amount);    // 減額は定義上マイナス
    else if (kind !== 'other') amount = Math.abs(amount);  // 手当が負なのは読み違い
    /* ★basis は変動給の行だけが持つ。ほかの kind に付いてきたら黙って落とす
       （画面の「変動給」の行にしか置き場が無いので、持たせても行き先が無い）。
       語彙に無い答えは捨てずに 'unknown' へ倒す ── 行を作る以上どれかは要る。 */
    if (kind === 'flight_variable') {
      const b = str(row.basis);
      earnings.push({
        label, amount, kind,
        basis: (VARIABLE_BASIS as readonly string[]).includes(b) ? b : 'unknown',
      });
    } else earnings.push({ label, amount, kind });
  }
  for (const u of Array.isArray(raw.unmapped) ? raw.unmapped : []) {
    const row = u as Parsed;
    const amount = numOr(row.amount);
    const label = lbl(row.label);
    if (amount !== null && label) putUnmapped(label, amount);
  }

  const hours: Array<{ label: string; value: number; kind: string }> = [];
  for (const h of Array.isArray(raw.hours) ? raw.hours : []) {
    const row = h as Parsed;
    const kind = str(row.kind);
    if (!(HOUR_KINDS as readonly string[]).includes(kind)) continue;
    /* 印字そのまま（raw）を優先して、60進→10進はこちらで直す。
         モデルの value は raw が読めなかったときの控えでしかない。

       実測（合成のANA様式）では、モデルは 120H30 を自前で 120.5 に直して返した。
       つまり今すぐ壊れているわけではない。それでも raw を見に行くのは2つの理由：
         ・文字のまま返ってきた場合、numOr("111H59") は 11159 になり
           上限(900)超えで黙って捨てられる＝分母が消える
         ・120.30 と返された場合、それが正しい10進なのか 120H30 の読み違いなのか
           数字だけからは判別できない。＝間違いが検出できないまま時給に乗る
       モデルの気分に任せている所を、決まった動きに変える。 */
    const value = parseHours(row.raw) ?? parseHours(row.value) ?? numOr(row.value);
    if (value === null || value <= 0 || value > 900) continue;
    hours.push({ label: lbl(row.label) || kind, value: Math.round(value * 10) / 10, kind });
  }

  const p = raw.period as Parsed | null | undefined;
  const y = p ? numOr(p.year) : null;
  const m = p ? numOr(p.month) : null;
  const now = new Date();
  const period =
    y && m && y >= 2015 && y <= now.getUTCFullYear() && m >= 1 && m <= 12
      ? { year: Math.round(y), month: Math.round(m) }
      : null;

  const cur = str(raw.currency).toUpperCase();

  return {
    currency: /^[A-Z]{3}$/.test(cur) ? cur : null,
    period,
    earnings,
    /* 印字された支給合計。reconcile() の突き合わせ相手にしか使わない。
       読めなければ null＝検算 unknown（失敗ではない）。 */
    gross_total: numOr(raw.gross_total),
    deductions_total: numOr(raw.deductions_total),
    net_pay: numOr(raw.net_pay),
    /* 累積課税支給額。これが読めると明細1枚から年収の実績ペースが出る（＝×12より遥かに正確）。
       今は返すだけで、使うのは 7-B。ここで拾っておかないと二度と手に入らない。 */
    ytd_taxable: numOr(raw.ytd_taxable),
    hours,
    unmapped,
    confidence: ['high', 'medium', 'low'].includes(str(raw.confidence)) ? str(raw.confidence) : 'medium',
  };
}

/* ────────────────────────────────────────────────────────────────
   検算。モデルの自己申告ではなく、こちらの足し算で確かめる。

   なぜ要るか。プロンプトは前から「支給の合計が印字された支給合計と一致するか
   自分で確かめろ」と言っていたが、**印字された支給合計を返させていなかった**。
   つまりサーバ側には突き合わせる相手が無く、モデルの「確かめました」を
   信じるしかなかった。1行落ちても、桁を1つ間違えても、confidence:"high" の
   まま普通に画面に出る。**間違いが黙って通る道がここにあった。**

   ★止めない。目立つように言うだけ。
     本人が直せば済むし、送信を止めると一次データが減る。
   ★読めなかったら 'unknown'。**unknown は失敗ではない。**
     支給合計が印字されていない明細（＝控除欄しか写っていない写真など）は普通にある。
     読めなかったことを「間違い」として扱うと、正しい明細まで警告だらけになる。
   ──────────────────────────────────────────────────────────── */
export type CheckState = 'ok' | 'mismatch' | 'unknown';
export type Checks = {
  gross: CheckState; net: CheckState;
  gross_printed: number | null; gross_summed: number | null; gross_diff: number | null;
  net_printed: number | null; net_expected: number | null; net_diff: number | null;
};

/* 許容差は「1通貨単位」か「0.5%」の大きいほう。
   JPY は端数が出ないので実質1円、AED/USD は小数第2位まで印字されるので比率側が効く。
   ★0.5% は「四捨五入のずれ」を飲むためのもので、1行の抜けを飲む幅ではない
     （どの項目も支給合計の0.5%より大きい）。 */
export function payTolerance(base: number): number {
  return Math.max(1, Math.abs(base) * 0.005);
}

export function reconcile(parsed: Parsed): Checks {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const rows = (Array.isArray(parsed.earnings) ? parsed.earnings : []) as Array<{ amount?: number }>;
  /* ★分類できなかった行（unmapped）も足す。ここは「明細の支給欄に印字されている
     行の合計」であって、こちらが分類できたかどうかとは関係がない。
     足さないと、名前を知らない手当が1つ載っているだけで支給合計が合わなくなり、
     「支給合計と合いません」という嘘の警告が出る。海外の変動給は会社ごとに
     名前が違う（Sector Pay / FDP Allowance …）ので、これは常に起きる。
     ★count:true（乗務日数など金額でない行）だけは外す。
     ★符号のまま足す。notional も含めて足す。
     収入から notional を外すのはフォーム側（payslip.js）の仕事。 */
  const unc = (Array.isArray(parsed.unmapped) ? parsed.unmapped : []) as
    Array<{ amount?: number; count?: boolean }>;
  const money = (rows as Array<{ amount?: number }>).concat(unc.filter((u) => !u.count));
  const summed = money.length
    ? Math.round(money.reduce((a, r) => a + (num(r.amount) ?? 0), 0) * 100) / 100
    : null;

  const printed = num(parsed.gross_total);
  const deduct = num(parsed.deductions_total);
  const net = num(parsed.net_pay);

  let gross: CheckState = 'unknown';
  let grossDiff: number | null = null;
  if (printed !== null && summed !== null) {
    grossDiff = Math.round((summed - printed) * 100) / 100;
    gross = Math.abs(grossDiff) <= payTolerance(printed) ? 'ok' : 'mismatch';
  }

  /* 検算B は A と独立に効く。支給側が全部読めていても、控除合計か手取りの
     どちらかを読み違えていればここで出る（手取りは必須の欄なので実害がある）。 */
  let netState: CheckState = 'unknown';
  let netExpected: number | null = null;
  let netDiff: number | null = null;
  if (printed !== null && deduct !== null && net !== null) {
    netExpected = Math.round((printed - deduct) * 100) / 100;
    netDiff = Math.round((net - netExpected) * 100) / 100;
    netState = Math.abs(netDiff) <= payTolerance(printed) ? 'ok' : 'mismatch';
  }

  return {
    gross, net: netState,
    gross_printed: printed, gross_summed: summed, gross_diff: grossDiff,
    net_printed: net, net_expected: netExpected, net_diff: netDiff,
  };
}

/* 検算が外れたら confidence を low に落とす。
   モデルが high と言っていても、こちらの足し算が合わないなら high ではない。
   ★payslip.js は confidence === 'low' のときだけ警告を出す。落とさないと、
     checks を返しても画面には何も出ない。 */
export function applyChecks(parsed: Parsed, checks: Checks): Parsed {
  const bad = checks.gross === 'mismatch' || checks.net === 'mismatch';
  return { ...parsed, checks, confidence: bad ? 'low' : parsed.confidence };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  if (!ANTHROPIC_API_KEY) return json({ ok: false, reason: 'server_misconfigured' }, 500);
  if (!SUPABASE_URL || !SERVICE_ROLE || !IP_SALT) return json({ ok: false, reason: 'server_misconfigured' }, 500);

  let body: Parsed = {};
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_request' }, 400); }
  /* ★ここから下、body の中身を console に出さない（画像も金額もラベルも）。 */

  const b64 = typeof body.image_b64 === 'string' ? body.image_b64 : '';
  const mime = typeof body.mime === 'string' ? body.mime : 'image/jpeg';
  const lang = body.lang === 'en' ? 'en' : 'ja';

  if (!b64) return json({ ok: false, reason: 'no_image' }, 400);
  if (b64.length > MAX_B64) return json({ ok: false, reason: 'image_too_large' }, 413);
  if (!ALLOWED_MIME.includes(mime)) return json({ ok: false, reason: 'bad_mime' }, 415);

  /* ── 回数制限：ログインの有無にかかわらず 1日 DAILY_LIMIT 回 ───────
     数える単位だけが違う（ログイン＝本人／未ログイン＝IP）。 */
  const uid = await userIdFrom(req.headers.get('authorization'));
  let subject: string;
  if (uid) {
    subject = 'u:' + (await hmac(uid));
  } else {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    if (!ip) return json({ ok: false, reason: 'quota_unavailable' }, 503);
    subject = 'i:' + (await hmac(ip));
  }
  const q = await takeQuota(subject, DAILY_LIMIT);
  if (!q.ok) {
    /* 全体の天井に当たったときは、本人のせいではないので言い方を変える。
       ★このとき本人の回数は DB 側で戻してあるので、1回ぶん損させていない。 */
    if (q.cap === 'global' || q.cap === 'month') {
      if (q.trip) await alertOwner(q.cap);
      return json({ ok: false, reason: 'rate_limited_global' }, 429);
    }
    if (q.cap === 'subject') {
      return json({ ok: false, reason: 'rate_limited', limit: DAILY_LIMIT }, 429);
    }
    /* 数える所そのものが動いていない（RPC が無い・落ちている）。
       ★ここで「今日の上限に達しました」と言うと嘘になる。通さないのは同じだが、
         正直に「いま使えない」と言う。SQL より先に関数を貼るとここに来る。 */
    return json({ ok: false, reason: 'quota_unavailable' }, 503);
  }

  // ── 読み取り ─────────────────────────────────────────────────
  let parsed: Parsed;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt(lang),
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: 'Return the JSON object described in the system prompt. Nothing else.' },
          ],
        }],
      }),
    });
    if (!res.ok) {
      // ★本文を出さない（明細の中身が入りうる）。ステータスと、固定語彙の error.type だけ。
      const errType = await anthropicErrorType(res);
      console.error('anthropic status', res.status, errType);
      if (isFatalKeyError(res.status, errType)) await alertKeyDead(res.status, errType);
      return json({ ok: false, reason: 'read_failed' }, 200);
    }
    const data = await res.json();
    const text = (data?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('').trim();
    const raw = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    parsed = sanitize(JSON.parse(raw) as Parsed);
  } catch {
    // ★例外オブジェクトも出さない（パース対象の文字列が混ざる）。
    console.error('parse failed');
    return json({ ok: false, reason: 'read_failed' }, 200);
  }

  const e = parsed.earnings as unknown[];
  if (!e.length && !(parsed.hours as unknown[]).length) {
    return json({ ok: false, reason: 'not_a_payslip' }, 200);
  }
  /* ★sanitize（形を整える）と reconcile（合っているか確かめる）は別の仕事。
     混ぜると「整えるついでに黙って直す」ようになり、間違いが見えなくなる。 */
  return json({ ok: true, result: applyChecks(parsed, reconcile(parsed)) });
});
