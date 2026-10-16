/* assert-stays.mjs — 就航地の「ホテル」の欄（career-stay.js ⇄ db/stays.sql）を、手元の本物の保存先につないで歩く（2026-10-16）。

   画面だけの検査（assert-airline-glance.mjs の stay ほか）は、サーバーの返事を作り物で返している。
   ここでは serve-local.mjs の使い捨ての保存先に本物の SQL を流し、画面とブラウザの外からの呼び出しの両方で確かめる。

   場面 chain（S1〜S7）
     S1  ログインしていない人は、ホテルが在っても locked の1行だけを受け取る
         （返事は {"ok":true,"state":"locked"} そのもの・名前は返事にも画面にも保存領域にも無い・鍵の1行と「ログイン」）。
     S2  ログインせずに「ホテルを追加」→ 名前 → 送る：保存される・端末の鍵が返る・「あなたの投稿」「確認待ち」が出る・
         運営（オーナー 'op'）の待ち行列が1つ増える。会員 'a' と給与を出した人 'pay' は locked のまま
         （'pay' は鍵の1行だけ）。承認された人 'pilot' にも、確認前の他人の行は返らない。
     S2b ほかのログインなしの人が、公開済みのホテルと同じ名前を送る：保存され、在ることは言わない。運営が通すと exists。
     S2c オーナーではない運営（この保存先の中だけで 'c' を運営の名簿に入れる）：待ち行列は1つ増えて見えるが、一覧は locked。
     S3  運営が通す：承認された人 'pilot' に届く。'a'・'pay'・ほかのログインなしの人は locked のまま。送った人の札から「確認待ち」が消える。
     S4  給与の鍵は、期限が切れていても生きていても何も開かない。承認された人の承認をオーナーが取り消すと
         （本物の口 pv_stay_viewer_decide）、読み直した時から locked。開いているあいだ、保存領域にホテルの名前は無い。
     S5  つながっていない（この保存先の中で pv_stays と pv_stay_add を消す）→「準備中」・入口の3つ・押しても「準備中」・面は開かない。
     S6  読めなかった →「読み込めませんでした」＋「もう一度」→ 押すとやり直せる。
     S7  30秒以内の2つめ →「続けて追加するときは、少し時間をあけてください。」・打った字は面に残る。
     終わりに：どのページも、手元と書体・部品の配信元のほかへ、1本も投げていない（st.blocked・st.supa が空）。

   ★本番にも 3000 番にも1回も通信しない（local-chain.mjs の bring・open。終われば保存先ごと消す）。
   ★見てよい人は手元の模擬（serve-local.mjs：'op' ＝ オーナー、'pilot' ＝ そのオーナーが承認した人）。本番の証拠にはならない。
   ★給与を出した人 'pay' は、その会員としての本物の呼び出し（submit_pay_report）で作る
     （手元の給与フォームから出せるかの下調べが無いため。その行には必ずそう書く）。

   実行: node assert-stays.mjs [--scenes chain] [--only <会社>]（既定：全部の場面・jal）
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS } from './serve-local.mjs';
import { bring, open, rpcAs } from './local-chain.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };

/* 画面の字（career-stay.js の T・SAY_ADD と同じ字。ここで字を固定する） */
const LOCK = '確認済みのパイロットだけが見られます', LOGIN = 'ログイン';
const MINE = 'あなたの投稿', PENDING = '確認待ち';
const ADDED = '追加しました。確認のあと公開されます。';
const OFF = '準備中', ERR = '読み込めませんでした', RETRY = 'もう一度';
const FAST = '続けて追加するときは、少し時間をあけてください。', EXISTS = '同じ名前が、もう登録されています。';
const ENTS = 'hotel ホテルを追加 ／ food レストランを追加 ／ spot 場所を追加';
const LOCKED = '{"ok":true,"state":"locked"}';
/* ★給与を出した人の作り方（下調べが無いあいだの手）。'pay' の結果の行には、どれにもこれを付ける */
const BYCALL = '（給与提出者は、その会員としての本物の呼び出し submit_pay_report で作った）';

/* 検査が作る架空のホテルの名前（どれも2〜80字） */
const PUB = '検査用の公開ホテル（手元）';
const GUEST = '検査用のゲストのホテル（手元）';
const NEXT1 = '検査用の続けて送る1つめ（手元）', NEXT2 = '検査用の続けて送る2つめ（手元）';

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SCENES = { chain };
const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = want.filter((s) => !SCENES[s]);
if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
const SLUG = val('--only') || 'jal';
if (!/^[a-z0-9-]+$/.test(SLUG) || !fs.existsSync(path.join(ROOT, 'airlines', SLUG + '.html'))) {
  console.error(`✗ 会社のページが無い: airlines/${SLUG}.html`); process.exit(2);
}
/* その会社のページの、就航地の一覧の最初の都市（#stay-XXX で直接開く） */
const IATA = (read(`airlines/${SLUG}.html`).match(/href="#stay-([A-Z]{3})" data-city="\1"/) || [])[1];
if (!IATA) { console.error(`✗ airlines/${SLUG}.html に就航地の都市が無い`); process.exit(2); }

const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
const SLOT = '#pvg-city .crl[data-live="hotels"]';
const ZONE = `${SLOT} + .crs-zone`;
const FORM = `${ZONE} .crs-formbox > .crs-form`;

const tick = () => new Promise((r) => setTimeout(r, 100));
/* 条件がそろうまで待つ（時間では待たない。ms は上限） */
const until = async (cond, ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    if (await cond()) return true;
    if (Date.now() - t0 > ms) return false;
    await tick();
  }
};
/* 返事の字を、読めれば JSON にしてから書き直す（\u の書き方で名前を見落とさない） */
const norm = (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return String(t); } };

let L = null, browser = null;
const PAGES = [];

async function main() {
  L = await bring();
  const base = L.base, URL_ = `${base}/airlines/${SLUG}.html#stay-${IATA}`;
  browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  console.log(`\n手元の保存先 ${base}（使い捨て）・${SLUG} の ${IATA}`);

  /* ── 道具 ─────────────────────────────────────────────── */
  const page = async (o) => { const p = await open(browser, base, { w: 1440, h: 820, ...o }); PAGES.push(p); return p; };
  const shut = async (p) => { try { await p.ctx.close(); } catch { /* 閉じられなくても先へ */ } };
  const n = (p, fn) => p.st.calls.filter((c) => c === fn).length;
  const replies = (p, fn, from = 0) => p.st.got.filter((g) => g.fn === fn).slice(from);
  /* 欄がその都市で、待ちの絵でない状態になり、欄の外の面（入口）が在る。読み出しの返事が全部届いている。 */
  const settled = async (p, ms = 20000) => {
    const a = await p.page.waitForFunction((sel, code) => {
      const e = document.querySelector(sel);
      return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code
        && !/^(idle|loading)$/.test(e.dataset.state || '')
        && !!(e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone'));
    }, { timeout: ms }, SLOT, IATA).then(() => true, () => false);
    const b = await until(() => n(p, 'pv_stays') === replies(p, 'pv_stays').length, ms);
    return a && b;
  };
  const visit = async (p) => { await p.page.goto(URL_, { waitUntil: 'load', timeout: 60000 }); return settled(p); };
  const look = (p) => p.page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const z = e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone') ? e.nextElementSibling : null;
    const vis = (x) => !!x && x.getClientRects().length > 0, tx = (x) => x ? x.textContent.replace(/\s+/g, ' ').trim() : '';
    const f = z && z.querySelector('.crs-formbox > .crs-form');
    return {
      state: e.dataset.state, who: e.getAttribute('data-who'), text: tx(e),
      entry: [...e.querySelectorAll('a[data-crs-entry]')].map(tx),
      retry: [...e.querySelectorAll('[data-act="retry"]')].map(tx),
      names: [...e.querySelectorAll('.crs-name')].map(tx),
      ents: z ? [...z.querySelectorAll('.crs-ent')].filter(vis).map((b) => `${b.getAttribute('data-kind')} ${tx(b)}`).join(' ／ ') : '',
      say: z ? tx(z.querySelector('.crs-zone-say')) : '',
      own: z ? [...z.querySelectorAll('.crs-own > .crs-card')].map((c) => ({ name: tx(c.querySelector('.crs-name')),
        badges: [...c.querySelectorAll('.crs-top .crs-badge')].map(tx) })) : [],
      form: !!f, fsay: f ? tx(f.querySelector('.crs-form-say')) : '',
      fname: f ? ((f.querySelector('[data-k="name"]') || {}).value || '') : '',
    };
  }, SLOT);
  /* その名前が、返事（手元の口の返事すべて）・画面（HTML 全体）・保存領域（local と session）のどこに在るか */
  const whereIs = async (p, names) => {
    const dom = await p.page.evaluate(() => document.documentElement.outerHTML);
    const store = await p.page.evaluate(() => {
      const o = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o['l:' + k] = localStorage.getItem(k); } } catch { /* 読めない */ }
      try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); o['s:' + k] = sessionStorage.getItem(k); } } catch { /* 読めない */ }
      return JSON.stringify(o);
    });
    const bodies = p.st.got.map((g) => norm(g.text)).join('\n');
    const out = [];
    for (const nm of names) {
      if (bodies.includes(nm)) out.push(`返事に「${nm}」`);
      if (dom.includes(nm)) out.push(`画面に「${nm}」`);
      if (store.includes(nm)) out.push(`保存領域に「${nm}」`);
    }
    return out;
  };
  const storeHas = async (p, names) => (await whereIs(p, names)).filter((s) => s.startsWith('保存領域'));
  /* 欄の外の入口を押して、名前だけ打って、送る（1回押す）。返事が届き、面が答えを出すまで待つ。 */
  const addVia = async (p, name) => {
    const before = replies(p, 'pv_stay_add').length;
    const saidBefore = (await look(p)).say;
    await p.page.click(`${ZONE} .crs-ent[data-kind="hotel"]`);
    await p.page.waitForSelector(`${FORM} [data-k="name"]`, { visible: true });
    await p.page.focus(`${FORM} [data-k="name"]`);
    await p.page.keyboard.type(name);
    await p.page.click(`${FORM} button[type="submit"]`);
    await until(() => replies(p, 'pv_stay_add').length > before);
    await p.page.waitForFunction((zone, form, was) => {
      const z = document.querySelector(zone), f = document.querySelector(form);
      const zs = z && z.querySelector('.crs-zone-say'), fs = f && f.querySelector('.crs-form-say');
      const zt = zs ? zs.textContent.trim() : '', ft = fs ? fs.textContent.trim() : '';
      return (!f && zt !== '' && zt !== was) || (!!f && ft !== '' && ft !== '送信中…');
    }, { timeout: 20000 }, ZONE, FORM, saidBefore).catch(() => {});
    await settled(p);
    const reply = replies(p, 'pv_stay_add').slice(before);
    let body = null;
    try { body = JSON.parse(reply[0].text); } catch { body = null; }
    return { reply: body, sent: p.st.sent.filter((s) => s.fn === 'pv_stay_add').slice(before), v: await look(p) };
  };
  const stays = (who) => rpcAs(base, who, 'pv_stays', { airline: SLUG, iata: IATA });
  const namesOf = (r) => (r.body && Array.isArray(r.body.places) ? r.body.places.map((x) => x.name) : []);
  const queue = async (who) => { const r = await rpcAs(base, who, 'pv_stay_queue', {}); return r.body && r.body.ok === true ? r.body.places : null; };
  const rowsOf = async (name) => (await L.q(
    `select id::text as id, state, author_hash from public.pv_stay_places where airline = $1 and iata = $2 and name = $3 order by created_at, id`,
    [SLUG, IATA, name])).rows;
  /* 返事が locked の1行そのものか。読んで書き直した字が LOCKED と同じで、返事の字そのものに現れる鍵の名前も ok と state だけ。 */
  const isLockedBytes = (r) => !!r && r.status === 200 && norm(r.text) === LOCKED
    && [...String(r.text).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]).join() === 'ok,state';

  /* ════ 場面 ════ */
  async function scene(title, fn) {
    console.log(`\n════ ${title} ════`);
    await fn();
  }

  /* ── S1 ─────────────────────────────────────────────── */
  let guest1 = null, guestKey = '';
  await scene('S1 ログインしていない人は、ホテルが在っても locked の1行だけ', async () => {
    const put = await rpcAs(base, 'op', 'pv_stay_add', { airline: SLUG, iata: IATA, kind: 'hotel', name: PUB, publish: true });
    const rows = await rowsOf(PUB);
    ok(put.body && put.body.ok === true && rows.length === 1 && rows[0].state === 'public',
      `準備：運営（オーナー 'op'）が ${SLUG} の ${IATA} に、公開のホテルを1つ置いた（pv_stay_add・publish:true）`, J({ reply: put.body, rows }));
    const g = await page({});
    const ready = await visit(g);
    const v = await look(g);
    const rs = replies(g, 'pv_stays');
    ok(ready && rs.length >= 1 && rs.every(isLockedBytes),
      `★S1 ログインしていない人への pv_stays の返事は、読んで書き直すと ${LOCKED} そのもの（ほかの鍵は1つも無い）`, J(rs.map((r) => r.text)));
    ok(v.state === 'locked' && v.who === 'login' && v.text === LOCK + LOGIN && J(v.entry) === J([LOGIN]) && v.names.length === 0,
      `★S1 欄は鍵の1行「${LOCK}」と「${LOGIN}」だけ`, J(v));
    const seen = await whereIs(g, [PUB]);
    ok(seen.length === 0, `★S1 公開のホテルの名前は、どの返事にも・画面にも・保存領域にも無い`, J(seen));
    guest1 = g;
  });

  /* ── S2・S2c ─────────────────────────────────────────── */
  let opQ0 = 0, cQ0 = 0;
  await scene('S2 ログインせずに「ホテルを追加」→ 名前 → 送る（S2c：オーナーではない運営も、ここで数える）', async () => {
    /* 給与を出した人 ── その会員としての本物の呼び出しで、給与の鍵を生きている状態にする */
    const YEAR = (await L.q(`select extract(year from current_date)::int as y`)).rows[0].y - 1;
    const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
    const filed = await rpcAs(base, 'pay', 'submit_pay_report', { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET,
      position: 'cap', airline: SLUG, period_year: YEAR, period_month: 3, gross_monthly: 9000 });
    const live = (await L.q(`select access_until > now() as live from public.profiles where id = $1`, [M.pay.id])).rows[0];
    ok(filed.body && filed.body.ok === true && live && live.live === true,
      `準備：給与提出者 'pay' の給与の鍵（access_until）は生きている${BYCALL}`, J({ reply: filed.body, live }));
    if (!(live && live.live === true)) throw new Error('前提が崩れた（給与の鍵が生きていない）');
    /* オーナーではない運営 ── この使い捨ての保存先の中だけで、会員 'c' を運営の名簿に入れる */
    await L.q(`insert into public.pv_admins (user_id, note) values ($1, '検査：オーナーではない運営（使い捨ての保存先だけ）') on conflict (user_id) do nothing`, [M.c.id]);
    const opBefore = await queue('op'), cBefore = await queue('c');
    ok(Array.isArray(opBefore) && Array.isArray(cBefore), `準備：運営の待ち行列（pv_stay_queue）を、オーナー 'op' と運営 'c' の両方で読めた`, J({ opBefore, cBefore }));
    opQ0 = (opBefore || []).length; cQ0 = (cBefore || []).length;

    const g = guest1;
    const { reply, sent, v } = await addVia(g, GUEST);
    const key = (await g.page.evaluate(() => { try { return localStorage.getItem('pv_stay_key'); } catch { return null; } })) || '';
    ok(sent.length === 1 && sent[0].p && sent[0].p.name === GUEST && sent[0].p.airline === SLUG && sent[0].p.iata === IATA && !('key' in sent[0].p),
      `★S2 「ホテルを追加」→ 名前 →「追加する」の1回で、pv_stay_add が1本だけ・名前と会社と空港を持って出た（ログインなし・申し込みなし）`, J(sent));
    ok(reply && reply.ok === true && /^[0-9a-f]{48}$/.test(reply.key || '') && reply.key === key && reply.item && reply.item.state === 'pending',
      `★S2 返事に端末の鍵が入っていて、この端末だけに置かれた（pv_stay_key）。足した1件は確認待ち`, J({ reply, key }));
    guestKey = key;
    const rows = (await L.q(
      `select s.state, s.author_hash = public.pv_stay_key_hash($4) as by_key,
              exists (select 1 from public.pv_stay_keys k where k.key_hash = s.author_hash) as key_row
         from public.pv_stay_places s where s.airline = $1 and s.iata = $2 and s.name = $3`, [SLUG, IATA, GUEST, key])).rows;
    ok(rows.length === 1 && rows[0].state === 'pending' && rows[0].by_key === true && rows[0].key_row === true,
      `★S2 ログインなしで保存された：保存先に1行・確認待ち・書いた人の印はその端末の鍵`, J(rows));
    ok(v.say === ADDED && J(v.own) === J([{ name: GUEST, badges: [MINE, PENDING] }]),
      `★S2 欄の外に「${ADDED}」と、送ったホテルが「${MINE}」「${PENDING}」の札で出る`, J({ say: v.say, own: v.own }));
    ok(v.state === 'locked' && v.text === LOCK + LOGIN && v.names.length === 0,
      `★S2 欄の中は鍵の1行と「${LOGIN}」のまま（鍵の1行の横に「${PENDING}」は無い）`, J({ state: v.state, text: v.text, names: v.names }));

    const opAfter = await queue('op'), cAfter = await queue('c');
    const hasG = (qq) => Array.isArray(qq) && qq.some((x) => x.name === GUEST && x.state === 'pending' && x.airline === SLUG && x.iata === IATA);
    ok(Array.isArray(opAfter) && opAfter.length === opQ0 + 1 && hasG(opAfter),
      `★S2 運営の数：オーナー 'op' の待ち行列（pv_stay_queue）は、ちょうど1つ増えた（${opQ0} → ${(opAfter || []).length}）。増えた1つは送ったホテル`, J((opAfter || []).map((x) => x.name)));
    ok(Array.isArray(cAfter) && cAfter.length === cQ0 + 1 && hasG(cAfter),
      `★S2c オーナーではない運営 'c' の待ち行列も、送ったホテルの1つだけ増えた（${cQ0} → ${(cAfter || []).length}）`, J((cAfter || []).map((x) => x.name)));
    const rc = await stays('c');
    ok(isLockedBytes(rc), `★S2c オーナーではない運営 'c' への pv_stays の返事は ${LOCKED} そのもの（運営であることだけでは開かない）`, rc.text);

    const ra = await stays('a');
    ok(isLockedBytes(ra), `★S2 会員 'a'（端末の鍵なし）への返事は ${LOCKED} そのもの`, ra.text);
    const rp = await stays('pay');
    ok(isLockedBytes(rp), `★S2 給与提出者 'pay' への返事も ${LOCKED} そのもの（給与の鍵は何も開かない）${BYCALL}`, rp.text);
    const pp = await page({ who: 'pay' });
    const pr = await visit(pp);
    const pv = await look(pp);
    const pseen = await whereIs(pp, [PUB, GUEST]);
    ok(pr && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK && pv.entry.length === 0 && pseen.length === 0
      && replies(pp, 'pv_stays').length >= 1 && replies(pp, 'pv_stays').every(isLockedBytes),
      `★S2 給与提出者 'pay' の画面は、鍵の1行「${LOCK}」だけ（入口なし・どの名前も返事・画面・保存領域に無い）${BYCALL}`, J({ pv, pseen }));
    await shut(pp);
    const rv = await stays('pilot');
    ok(rv.body && rv.body.state === 'open' && namesOf(rv).includes(PUB) && !norm(rv.text).includes(GUEST),
      `★S2 承認された人 'pilot' には一覧が開く（公開のホテルは在る）が、確認前の他人のホテルは返らない`, J(namesOf(rv)));
    const ro = await stays('op');
    const og = ro.body && Array.isArray(ro.body.places) ? ro.body.places.find((x) => x.name === GUEST) : null;
    ok(ro.body && ro.body.state === 'open' && namesOf(ro).includes(PUB) && !!og && og.state === 'pending',
      `S2 オーナー 'op' の一覧には、確認待ちの他人のホテルも在る`, J(namesOf(ro)));
  });

  /* ── S2b ─────────────────────────────────────────────── */
  await scene('S2b ほかのログインなしの人が、公開済みと同じ名前を送る', async () => {
    const g2 = await page({});
    const ready = await visit(g2);
    const { reply, v } = await addVia(g2, PUB);
    ok(ready && reply && reply.ok === true && reply.item && reply.item.state === 'pending' && !JSON.stringify(reply).includes('exists'),
      `★S2b 公開済みのホテルと同じ名前でも、ログインなしの人の1件は保存される（返事に exists は無い）`, J(reply));
    ok(v.say === ADDED && v.say !== EXISTS && J(v.own) === J([{ name: PUB, badges: [MINE, PENDING] }]) && v.fsay === '',
      `★S2b 面は「${ADDED}」と「${PENDING}」の札だけ ── 同じ名前が在ることは言わない`, J({ say: v.say, own: v.own, fsay: v.fsay }));
    const qq = await queue('op');
    const row = Array.isArray(qq) ? qq.find((x) => x.name === PUB && x.state === 'pending') : null;
    const m = row ? await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev }) : null;
    const rows = await rowsOf(PUB);
    ok(!!row && m && m.body && m.body.ok === false && m.body.status === 'exists'
      && rows.filter((r) => r.state === 'public').length === 1 && rows.filter((r) => r.state === 'pending').length === 1,
      `S2b 運営がその1件を通そうとすると exists（公開の行に同じ名前を2つ作らない）`, J({ m: m && m.body, rows: rows.map((r) => r.state) }));
    await shut(g2);
  });

  /* ── S3 ─────────────────────────────────────────────── */
  await scene('S3 運営が通す → 承認された人に届く・ほかの人は locked のまま', async () => {
    const qq = await queue('op');
    const row = Array.isArray(qq) ? qq.find((x) => x.name === GUEST && x.state === 'pending') : null;
    const m = row ? await rpcAs(base, 'op', 'pv_stay_moderate', { target: 'place', id: row.id, state: 'public', rev: row.rev }) : null;
    ok(!!row && m && m.body && m.body.ok === true && m.body.state === 'public',
      `準備：運営（オーナー 'op'）が、待ち行列の版の印（rev）を添えて、ゲストのホテルを公開した`, J(m && m.body));
    const rv = await stays('pilot');
    ok(rv.body && rv.body.state === 'open' && namesOf(rv).includes(GUEST),
      `★S3 承認された人 'pilot' の返事に、公開したゲストのホテルが入った`, J(namesOf(rv)));
    const vp = await page({ who: 'pilot' });
    const vr = await visit(vp);
    const vv = await look(vp);
    ok(vr && vv.state === 'open' && vv.names.includes(GUEST) && vv.names.includes(PUB),
      `★S3 承認された人 'pilot' の画面の一覧に、ゲストのホテルと公開のホテルが出る`, J({ state: vv.state, names: vv.names }));
    await shut(vp);
    const ra = await stays('a'), rp = await stays('pay'), rg = await stays(null);
    ok(isLockedBytes(ra), `★S3 会員 'a' への返事は、公開のあとも ${LOCKED} そのもの`, ra.text);
    ok(isLockedBytes(rp), `★S3 給与提出者 'pay' への返事も、公開のあとも ${LOCKED} そのもの${BYCALL}`, rp.text);
    ok(isLockedBytes(rg), `★S3 ほかのログインなしの人（端末の鍵なし）への返事も ${LOCKED} そのもの`, rg.text);
    await guest1.page.reload({ waitUntil: 'load', timeout: 60000 });
    const gr = await settled(guest1);
    const gv = await look(guest1);
    ok(gr && gv.state === 'locked' && gv.text === LOCK + LOGIN && J(gv.own) === J([{ name: GUEST, badges: [MINE] }]),
      `★S3 送った人の画面を読み直すと、自分のホテルの札から「${PENDING}」が消える（「${MINE}」は残る。欄の中は鍵の1行のまま）`, J({ state: gv.state, own: gv.own }));
    await shut(guest1);
  });

  /* ── S4 ─────────────────────────────────────────────── */
  await scene('S4 給与の鍵は期限に関係なく何も開かない／承認を取り消されたら、読み直した時から locked', async () => {
    const until0 = (await L.q(`select access_until from public.profiles where id = $1`, [M.pay.id])).rows[0].access_until;
    await L.q(`update public.profiles set access_until = now() - interval '1 day' where id = $1`, [M.pay.id]);
    const ra = await stays('a'), rx = await stays('pay');
    const pp = await page({ who: 'pay' });
    const pr = await visit(pp);
    const pv = await look(pp);
    ok(pr && isLockedBytes(rx) && norm(rx.text) === norm(ra.text) && pv.state === 'locked' && pv.who === 'member' && pv.text === LOCK
      && (await whereIs(pp, [PUB, GUEST])).length === 0,
      `★S4 給与の鍵の期限が切れた 'pay'：返事は会員 'a' と同じ ${LOCKED}・画面は鍵の1行だけ${BYCALL}`, J({ rx: rx.text, pv }));
    await shut(pp);
    await L.q(`update public.profiles set access_until = $2 where id = $1`, [M.pay.id, until0]);
    const ry = await stays('pay');
    const live = (await L.q(`select access_until > now() as live from public.profiles where id = $1`, [M.pay.id])).rows[0];
    ok(live.live === true && isLockedBytes(ry), `★S4 給与の鍵を生きている状態に戻しても、'pay' への返事は ${LOCKED} のまま${BYCALL}`, ry.text);

    const vp = await page({ who: 'pilot' });
    const vr = await visit(vp);
    const v1 = await look(vp);
    const held = await storeHas(vp, [PUB, GUEST]);
    ok(vr && v1.state === 'open' && v1.names.includes(PUB) && held.length === 0,
      `★S4 承認された人 'pilot' の一覧が開いているあいだ、保存領域にホテルの名前は1つも無い`, J({ state: v1.state, names: v1.names, held }));
    const dv = await rpcAs(base, 'op', 'pv_stay_viewer_decide', { id: M.pilot.id, state: 'revoked' });
    ok(dv.body && dv.body.ok === true && dv.body.state === 'revoked',
      `準備：オーナー 'op' が、本物の口（pv_stay_viewer_decide）で 'pilot' の承認を取り消した`, J(dv.body));
    const from = replies(vp, 'pv_stays').length;
    await vp.page.reload({ waitUntil: 'load', timeout: 60000 });
    const r2 = await settled(vp);
    const v2 = await look(vp);
    const after = replies(vp, 'pv_stays', from);
    const seen2 = await whereIs(vp, [PUB, GUEST]);
    ok(r2 && after.length >= 1 && after.every(isLockedBytes) && v2.state === 'locked' && v2.who === 'member' && v2.text === LOCK
      && seen2.filter((s) => !s.startsWith('返事')).length === 0,
      `★S4 承認を取り消された 'pilot' が読み直すと、返事は ${LOCKED} そのもの・画面は鍵の1行だけ（名前は画面にも保存領域にも無い）`,
      J({ after: after.map((r) => r.text), v2, seen2 }));
    await shut(vp);
    const ba = await rpcAs(base, 'op', 'pv_stay_viewer_decide', { id: M.pilot.id, state: 'approved' });
    const rb = await stays('pilot');
    ok(ba.body && ba.body.ok === true && rb.body && rb.body.state === 'open' && namesOf(rb).includes(PUB),
      `S4 オーナー 'op' が同じ口で承認し直すと、'pilot' の一覧はまた開く`, J({ decide: ba.body, names: namesOf(rb) }));
  });

  /* ── S6 ─────────────────────────────────────────────── */
  await scene('S6 読めなかった →「読み込めませんでした」＋「もう一度」→ やり直せる', async () => {
    const g = await page({});
    /* 押すまでの読み出しは全部失敗させる（読み出しが2本あっても、2本目で黙って直らない）。押す前に戻す。 */
    await L.failNext('pv_stays', null, 99);
    const ready = await visit(g);
    const v1 = await look(g);
    await L.failOff();
    const n0 = n(g, 'pv_stays');
    ok(ready && v1.state === 'error' && v1.text === ERR + RETRY && J(v1.retry) === J([RETRY]) && n0 >= 1,
      `S6 一覧の読み出しが失敗した回は「${ERR}」と「${RETRY}」`, J({ v1, calls: n0 }));
    await g.page.click(`${SLOT} [data-act="retry"]`);
    const again = await g.page.waitForFunction((sel) => { const e = document.querySelector(sel); return !!e && e.dataset.state === 'locked'; },
      { timeout: 20000 }, SLOT).then(() => true, () => false);
    const okd = again && (await settled(g));
    const v2 = await look(g);
    ok(okd && v2.text === LOCK + LOGIN && n(g, 'pv_stays') > n0 && isLockedBytes(replies(g, 'pv_stays').at(-1)),
      `S6 「${RETRY}」を押すと読み直し、サーバーの答えのとおり鍵の1行になる`, J({ v2, calls: n(g, 'pv_stays') }));
    await shut(g);
  });

  /* ── S7 ─────────────────────────────────────────────── */
  await scene('S7 30秒以内の2つめ', async () => {
    const g = await page({});
    const ready = await visit(g);
    const a1 = await addVia(g, NEXT1);
    ok(ready && a1.reply && a1.reply.ok === true && a1.v.say === ADDED, `準備：ログインなしで1つ足した（「${ADDED}」）`, J({ reply: a1.reply, say: a1.v.say }));
    const a2 = await addVia(g, NEXT2);
    ok(a2.reply && a2.reply.ok === false && a2.reply.status === 'too_fast' && a2.v.form === true && a2.v.fsay === FAST && a2.v.fname === NEXT2,
      `S7 30秒以内の2つめは「${FAST}」と言い、打った名前は面に残る`, J({ reply: a2.reply, form: a2.v.form, fsay: a2.v.fsay, fname: a2.v.fname }));
    ok((await rowsOf(NEXT2)).length === 0 && n(g, 'pv_stay_add') === 2, `S7 2つめは保存されていない（送ったのは2本）`, J({ rows: await rowsOf(NEXT2), sent: n(g, 'pv_stay_add') }));
    await shut(g);
  });

  /* ── S5（関数を消すので、最後に流す）────────────────────── */
  await scene('S5 つながっていない（pv_stays と pv_stay_add が無い）', async () => {
    await L.q(`drop function if exists public.pv_stays(jsonb)`);
    await L.q(`drop function if exists public.pv_stay_add(jsonb)`);
    const g = await page({});
    const ready = await visit(g);
    const v1 = await look(g);
    ok(ready && v1.state === 'off' && v1.text === OFF && v1.retry.length === 0 && v1.ents === ENTS,
      `S5 欄は「${OFF}」だけ（やり直しの言葉なし）・欄の外に入口が3つ`, J(v1));
    await g.page.click(`${ZONE} .crs-ent[data-kind="hotel"]`);
    const said = await g.page.waitForFunction((zone, t) => { const z = document.querySelector(zone), s = z && z.querySelector('.crs-zone-say'); return !!s && s.textContent.trim() === t; },
      { timeout: 10000 }, ZONE, OFF).then(() => true, () => false);
    const v2 = await look(g);
    ok(said && v2.say === OFF && v2.form === false && n(g, 'pv_stay_add') === 0,
      `S5 入口を押すと「${OFF}」と言うだけ ── 追加の面は開かない（送らない）`, J({ say: v2.say, form: v2.form }));
    await shut(g);
  });
}

try {
  for (const s of want) await SCENES[s]();
} catch (e) {
  ok(false, '場面が途中で止まった', String(e && e.stack || e).slice(0, 600));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (L) await L.stop().catch(() => {});
}
/* 閉じの行（どの実行でも出す） */
const blocked = PAGES.flatMap((p) => [...p.st.blocked]), supa = PAGES.flatMap((p) => [...p.st.supa]);
console.log('');
ok(PAGES.length > 0 && blocked.length === 0 && supa.length === 0,
  `★どのページ（${PAGES.length}枚）の st.blocked と st.supa も空 ── 手元と書体・部品の配信元のほかへ、1本も投げていない`, J({ blocked, supa }));
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;

async function chain() {
  await main();
}
