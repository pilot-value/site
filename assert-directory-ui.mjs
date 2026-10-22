/* ════════════════════════════════════════════════════════════════
   assert-directory-ui.mjs ── 航空会社一覧（world-airlines.html・en/world-airlines.html）を、
   手元の使い捨ての保存先（serve-local.mjs）に立ててブラウザで歩く検査（REAL LOCAL CONNECTION）。

   ★ 3000 番にも本番にも1回も通信しない。
     サーバーは local-chain.mjs の bring()（空いているポート・一時の保存先・解析タグは配る時に外す）、
     ページは local-chain.mjs の open()（門：手元と書体・部品の配信元 LIBS だけを通す。*.supabase.* は st.supa、
     ほかの行き先は st.blocked に書き留めて止める）で開く。
   ★ 期待する値は、ここ（Node）で台帳から作る ── SALARY（salary-data.mjs）と一覧の行（airlines-meta.js）。
     gen-directory.mjs・directory-model.mjs・ページの台本からは作らない（検査される側の答えを写さない）。
   ★ 待つのは条件だけ（時間では待たない）。
   ★ どの場面も最後に quiet(st, 場面) が空であること ── 一覧のページが開いているあいだ、
     サーバーの口（/rest/v1/rpc/…）を1本も呼ばない（QUIET_ALLOW に在る名前だけは呼んでよい。この一覧では空）。
     スクリプトの止まり（st.errs）と、手元の配信元からの 4xx も落ちる。

   場面 base（日英・1440×900）
     b1 見えているカード ＝ 台帳の112社を一覧の並び（地域の順 → 一覧の行の順）で・社数「112社」／«112 airlines»
     b2 地域のボタンを1つずつ押す → 見えているカード ＝ その地域の会社（集合）・社数・押したボタンだけ aria-pressed="true"
     b3 FSC → 一覧の行の type が fsc の会社・LCC/ULCC → lcc・免税 → SALARY の taxFree
     b4 レベリング比較 → 絞り込みの帯（#filter-bar）が消え、#lvl-wa-grid に4本の .lvl-col・カード一覧 → 戻る
     b5 テーマのボタンで data-theme が入れ替わる（もう1回で戻る）
     b6 古い地図：アジアに指を載せる → #map-tooltip に「アジア」／«Asia» と社数・押すと選ばれ、もう1回で外れる・
        ピンの8つの社数（#pc-…）＝ 地域の社数
     b7 検索欄に «emirates» → エミレーツが見えている・«zzzz» → 見つからない（#no-results）
     b8 ヘッダーの検索（#pv-search-btn）で «Solairus» → airlines/solairus.html へのリンクが出る
     b9 quiet(st, 'base') が空

   場面 first（日英・390×680 のスマホ）
     検索欄（#search）が最初の1画面の中・高さ 48px 以上・字 16px 以上・見出しと検索欄のあいだに押せるもの無し・
     見出し「次のキャリアを、選択する」／«Choose your next career»・結果の見出し「すべて」／«All»・
     開いたときは地域の札・解除・見つからないときのボタンを見せない・quiet が空
   場面 nojs（日英・台本を止める）
     112社のリンクが見えている・h2#wd-rh-name「すべて」／«All»・検索欄／絞り込みの帯／表示の切り替え／古い地図を見せない・quiet が空

   場面 search（日英・1440×900）── 検索が約束どおり（期待する集合はここで台帳から作る。台本の答えを写さない）
     s1 112社の「自分の値」を6種類（日本語名・英語名・略称・コード・国名（日）・国名（英））そのまま打つ → その会社が見えている
     s2 決めた例：NH・JL・EK・EY・AXC ＝ 一覧の行の略号を持つ1社だけ・UA → 先頭がユナイテッド・BA → 先頭が英国航空・
        ANA ＝ ＡＮＡ ＝ "ana " → 先頭が ANA・日本の会社だけ・JAL と Ryanair は出ない・
        US ＝ USA ＝ 米国 ＝ America ＝ アメリカ ＝ アメリカ合衆国 → 国が US の会社ちょうど・UK ＝ GB ＝ 英国 ＝ Britain ＝ Great Britain ＝
        England → GB ちょうど・JP ＝ 日本 → JP ちょうど・ドイツ ＝ Germany → DE ちょうど・フランスの6つ → エールフランスだけ・
        台湾 ＝ Taiwan → TW ちょうど・インド → 先頭の2社が IN、あとは ID だけ・India → IN ちょうど・マルタ ＝ Malta → エアX だけ・
        トルコ ＝ Türkiye ＝ Turkiye → ターキッシュだけ・全日空 → ANA だけ・ぴーち ＝ ピーチ → ピーチだけ・ｴﾐﾚｰﾂ → 先頭がエミレーツ・
        ワンワールド ＝ oneworld → 一覧の行の提携がワンワールドの会社ちょうど・zzzz → 0
     s3 打っているあいだは国の帯と古い地図（#wd-explore）を見せない・空にすると戻る
     s4 レベリング比較を開いたまま打つ → カード一覧に戻る
   場面 scope（日英・390×680 のスマホ）── 地域を選んだまま別の地域の会社を打つ
     欧州を選ぶ → 欄の中に「欧州」の札・「全日空」＋ Enter → カード0枚・見つからないの文は出さない・#wd-else のボタンは
     「日本 1」の1つだけ（画面の中・横にずれない）・欧州の帯の数 ＝ 台帳で数えた当たり（0）→ 押す → 日本・ANA・欄はそのまま・
     history.length は増えない → 欧州 → 札を押す → すべて・先頭が ANA・見えている数 ＝ すべての数 → 欧州 ＋ «air» → 見えているのは
     欧州の会社だけ・社数 ＝ その数 → 欧州をもう1回 → 外れる
   場面 empty（日英・1440×900）── zzzz → 見つからないの文と「絞り込みを解除」・地域のボタンは出さない・社数は空 →
     「絞り込みを解除」→ 112社・欄は空・すべてが押されている・ボタンは隠れる

   使い方: node assert-directory-ui.mjs [--scenes base,first,nojs,search,scope,empty] [--lang ja,en] [--shots <リポジトリの外のフォルダ>]
     --shots  名前の付いた段ごとに PNG を1枚（<scene>-<lang>-<段>.png）

   ほかの検査が読む名前（export）: dirOpen / ready / visible / QUIET_ALLOW / quiet
   ════════════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bring, open } from './local-chain.mjs';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── 共有の言葉（契約。台帳から作れないものだけここに書く）──────────────── */
/** 地域の8つの符号（この順が一覧の並び） */
const REG8 = ['japan', 'asia', 'mideast', 'africa', 'europe', 'us', 'oceania', 'latam'];
/** 地域の名前（日・英） */
const REGION_LABEL = {
  all: ['すべて', 'All'], japan: ['日本', 'Japan'], asia: ['アジア', 'Asia'], mideast: ['中東', 'Middle East'], africa: ['アフリカ', 'Africa'],
  europe: ['欧州', 'Europe'], us: ['北米', 'North America'], oceania: ['オセアニア', 'Oceania'], latam: ['中南米', 'Latin America'],
};
/** 社数の書き方（英語の1社だけ «1 airline» ＝ 進行役の決め C3） */
const COUNT = { ja: (n) => `${n}社`, en: (n) => (n === 1 ? '1 airline' : `${n} airlines`) };
/** 見つからないときの文（いまのページの字）と、絞り込みを解除の字（actual-pay.html の字） */
const NONE_SENT = { ja: '該当する航空会社が見つかりませんでした', en: 'No airlines matched your search' };
const CLEAR = { ja: '絞り込みを解除', en: 'Clear filters' };
/** 見出しの字（オーナーの字・進行役の決め C4） */
const H1 = { ja: '次のキャリアを、選択する', en: 'Choose your next career' };
/** 一覧の2枚のページ */
const PAGE_REL = { ja: 'world-airlines.html', en: 'en/world-airlines.html' };

/* ── 読む（台帳）──────────────────────────────────────────── */
/** 一覧の行（airlines-meta.js の window.PV_AIRLINES）。slug は PV_slugOf で */
function listRows() {
  const win = {};
  new Function('window', read('airlines-meta.js'))(win);
  return win.PV_AIRLINES.map((r) => ({ ...r, slug: win.PV_slugOf(r) }));
}
const LIST = listRows();
const POS = new Map(LIST.map((r, i) => [r.slug, i]));
const ROW = new Map(LIST.map((r) => [r.slug, r]));
const SLUGS = Object.keys(SALARY);
/** 一覧の並び（地域の順 → 一覧の行の順） */
const ORDER = SLUGS.slice().sort((a, b) => (REG8.indexOf(SALARY[a].region) - REG8.indexOf(SALARY[b].region))
  || ((POS.get(a) ?? 1e9) - (POS.get(b) ?? 1e9)));
const inRegion = (code) => SLUGS.filter((s) => code === 'all' || SALARY[s].region === code);
const listType = (s) => (ROW.get(s) || {}).type || '';
/** ヘッダー検索の行（search.js の var DB = [ … ]; の中身）。slug を足して返す */
function headerRows() {
  const src = read('search.js'), a = src.indexOf('var DB = ['), z = src.indexOf('window.PV_DB = DB;');
  if (a < 0 || z < 0) throw new Error('search.js の形が変わった（var DB = [ / window.PV_DB = DB; が無い）');
  const rows = new Function('return ' + src.slice(a + 'var DB = '.length, src.lastIndexOf('];', z) + 1))();
  return rows.map((r) => ({ ...r, slug: String(r.f || '').replace(/^airlines\//, () => '').replace(/\.html$/, () => '') }));
}
const HEAD = new Map(headerRows().map((h) => [h.slug, h]));
const codeLike = (t) => /^[A-Z0-9]{2,3}$/.test(t);
const uniqStr = (xs) => [...new Set(xs.filter((x) => x != null && String(x) !== '').map(String))];
/** その会社の「自分の値」を6種類（日本語名・英語名・略称・コード・国名（日）・国名（英））。どれも打ったまま見つかること */
function ownValues(s) {
  const d = SALARY[s], r = ROW.get(s) || {}, t = (HEAD.get(s) || {}).t || [], c = BY_CODE[AIRLINE_COUNTRY[s]] || null, alt = (c && c.alt) || [];
  return {
    日本語名: uniqStr([d.ja, r.name]),
    英語名: uniqStr([d.en, r.en]),
    略称: uniqStr(t.filter((x) => !codeLike(x))),
    コード: uniqStr([r.code, ...t.filter(codeLike)]),
    '国名（日）': uniqStr(c ? [c.ja, ...alt] : []),
    '国名（英）': uniqStr(c ? [c.en, ...alt] : []),
  };
}
const ofCountry = (code) => SLUGS.filter((s) => AIRLINE_COUNTRY[s] === code);
/** その略号を持つ会社（一覧の行の略号と、ヘッダー検索の略号らしい語 ＝ コードの種類） */
const ofCode = (code) => SLUGS.filter((s) => ownValues(s).コード.includes(code));
const ofAlliance = (a) => SLUGS.filter((s) => (ROW.get(s) || {}).alliance === a);

/* ── 道具（export）──────────────────────────────────────────── */
/** 一覧のページが今の文書のあいだに呼んでよいサーバーの口（この一覧では空） */
export const QUIET_ALLOW = [];

/** カードのリンクが描かれ、通貨の切り替え（currency.js）が立ち上がるまで */
export function ready(page) {
  return page.waitForFunction(() => window.PVCurrency && document.querySelectorAll('#airline-grid a[href^="airlines/"]').length > 0);
}

/** 見えているカードの slug（DOM の順） */
export function visible(page) {
  return page.evaluate(() => [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')]
    .filter((a) => a.getClientRects().length > 0)
    .map((a) => a.getAttribute('href').replace(/^airlines\//, () => '').replace(/\.html$/, () => '')));
}

/** 一覧のページを、新しい窓（context）で開く。
    st.segs ＝ 主の枠が移るたびに { at: その時の st.calls の本数, dir: 一覧のページか }（quiet が「一覧が開いていたあいだの呼び出し」を切り分ける）
    st.http4 ＝ 手元の配信元が 4xx / 5xx で答えた要求 */
export async function dirOpen(browser, L, { rel = 'world-airlines.html', query = '', w = 1440, h = 900, touch = false, theme = null, js = true } = {}) {
  const o = await open(browser, L.base, { w, h, touch, theme });
  const { page, st } = o, origin = new URL(L.base).origin;
  st.segs = [];
  st.http4 = [];
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) return;
    let p = '';
    try { p = new URL(f.url()).pathname; } catch { p = ''; }
    st.segs.push({ at: st.calls.length, dir: /\/(en\/)?world-airlines\.html$/.test(p) });
  });
  page.on('response', (res) => {
    let u;
    try { u = new URL(res.url()); } catch { return; }
    if (u.origin === origin && res.status() >= 400) st.http4.push(`${res.status()} ${u.pathname}`);
  });
  if (js === false) await page.setJavaScriptEnabled(false);
  await page.goto(`${L.base}/${rel}${query}`, { waitUntil: js === false ? 'domcontentloaded' : 'load', timeout: 60000 });
  if (js !== false) await ready(page);
  return o;
}

/** 静かか（[] ＝ 静か）。外への通信（st.supa・st.blocked）と、一覧の文書が今だったあいだのサーバーの口の呼び出しで allow に無いもの */
export function quiet(st, label, { allow = QUIET_ALLOW } = {}) {
  const out = [...st.supa, ...st.blocked].map((x) => `${label}：外への通信 ${x}`);
  const segs = st.segs || [];
  st.calls.forEach((name, i) => {
    let seg = null;
    for (const s of segs) if (s.at <= i) seg = s;
    if (seg && seg.dir && !allow.includes(name)) out.push(`${label}：一覧のページがサーバーの口 ${name} を呼んだ（${i + 1}本目）`);
  });
  return out;
}

/* ── 実行（このファイルを直接流したときだけ）────────────────────── */
/* ⚠️ 実体のパスどうしで比べる。リンク越し（/tmp → /private/tmp、写しの中のリンク）で流すと、Node は argv[1] をリンクのまま・
   import.meta.url を実体で持つので、素の path.resolve では一致せず「何も流さず exit 0」＝検査の門が黙って緑になる */
const realOf = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url))) await main();

async function main() {
  const argv = process.argv.slice(2);
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const SCENES = { base, first, nojs, search, scope, empty };
  const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = want.filter((s) => !SCENES[s]);
  if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
  const LANGS = (val('--lang') || 'ja,en').split(',').map((s) => s.trim()).filter(Boolean);
  if (!LANGS.length || LANGS.some((l) => !PAGE_REL[l])) { console.error('✗ --lang は ja / en'); process.exit(2); }
  const SHOTS = val('--shots') ? path.resolve(val('--shots')) : '';
  if (SHOTS && (SHOTS + path.sep).startsWith(ROOT)) { console.error('✗ --shots はリポジトリの外に置く'); process.exit(2); }
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  let pass = 0, fail = 0;
  const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
  const J = (v) => { try { return JSON.stringify(v).slice(0, 400); } catch { return String(v); } };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sameSet = (a, b) => same([...new Set(a)].sort(), [...new Set(b)].sort());

  const L = await bring();
  const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const PAGES = [];
  console.log(`手元の使い捨ての保存先 ${L.base}（REAL LOCAL CONNECTION・3000 番でも本番でもない）`);

  /* 条件がそろうまで待つ（上限つき。時間では待たない）。そろわなければ false */
  const until = (page, fn, ...args) => page.waitForFunction(fn, { timeout: 20000 }, ...args).then(() => true, () => false);
  const shot = async (page, scene, lang, name) => {
    if (!SHOTS) return;
    await page.screenshot({ path: path.join(SHOTS, `${scene}-${lang}-${name}.png`) });
  };
  const press = (page, sel) => page.click(sel);
  /* 検索欄に打つ（値を入れて input を1回） */
  const type = (page, s) => page.evaluate((s) => {
    const el = document.getElementById('search');
    el.value = s;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, s);
  const countText = (page) => page.evaluate(() => (document.getElementById('result-count') || {}).textContent || '');
  const pressed = (page) => page.evaluate(() => [...document.querySelectorAll('#region-strip .rstrip-btn')]
    .filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.region));
  const shown = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; }, sel);
  /* 要素の上で、その要素そのものに当たる点（地図の形は四角でないので、当たる所を探す） */
  const pointIn = (page, sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    for (let iy = 1; iy < 24; iy++) for (let ix = 1; ix < 24; ix++) {
      const x = r.left + (r.width * ix) / 24, y = r.top + (r.height * iy) / 24;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest(sel)) return { x, y };
    }
    return null;
  }, sel);
  /* 滑らかなスクロールが止まるまで（2コマ続けて同じ位置） */
  const still = (page) => until(page, () => new Promise((res) => {
    const y = window.scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => res(window.scrollY === y)));
  }));

  async function base(lang) {
    const T = (s) => `[${lang}] ${s}`, C = COUNT[lang];
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* b1 */
      const v1 = await visible(page);
      ok(same(v1, ORDER), T(`b1 見えているカード ＝ 台帳の${ORDER.length}社を一覧の並びで`), J({ n: v1.length, first: v1.slice(0, 3) }));
      const c1 = await countText(page);
      ok(c1 === C(ORDER.length), T(`b1 社数「${C(ORDER.length)}」`), J(c1));
      await shot(page, 'base', lang, 'b1');

      /* b2 地域のボタン（すべて ＋ 8地域） */
      for (const code of ['all', ...REG8]) {
        await press(page, `#region-strip .rstrip-btn[data-region="${code}"]`);
        const exp = inRegion(code);
        const on = await until(page, (code) => {
          const b = document.querySelector(`#region-strip .rstrip-btn[data-region="${code}"]`);
          return !!b && b.getAttribute('aria-pressed') === 'true';
        }, code);
        const v = await visible(page), c = await countText(page), pr = await pressed(page);
        ok(on && sameSet(v, exp) && v.length === exp.length && c === C(exp.length) && same(pr, [code]),
          T(`b2 ${REGION_LABEL[code][lang === 'en' ? 1 : 0]} → その地域の${exp.length}社・社数「${C(exp.length)}」・押したボタンだけ aria-pressed="true"`),
          J({ n: v.length, c, pr }));
        if (code === 'europe') await shot(page, 'base', lang, 'b2-europe');
      }
      await press(page, '#region-strip .rstrip-btn[data-region="all"]');

      /* b3 種類（FSC・LCC/ULCC・免税 → すべて） */
      const TYPES = [
        ['fsc', 'FSC', SLUGS.filter((s) => listType(s) === 'fsc')],
        ['lcc', 'LCC/ULCC', SLUGS.filter((s) => listType(s) === 'lcc')],
        ['taxfree', '免税', SLUGS.filter((s) => SALARY[s].taxFree === true)],
        ['all', 'すべて', SLUGS],
      ];
      for (const [t, name, exp] of TYPES) {
        await press(page, `.ftype-btn[data-type="${t}"]`);
        const on = await until(page, (t) => { const b = document.querySelector(`.ftype-btn[data-type="${t}"]`); return !!b && b.classList.contains('active'); }, t);
        const v = await visible(page);
        ok(on && exp.length > 0 && sameSet(v, exp) && v.length === exp.length,
          T(`b3 ${name} → ${t === 'taxfree' ? 'SALARY の taxFree の' : t === 'all' ? '台帳の' : `一覧の行の type が ${t} の`}${exp.length}社`), J({ n: v.length }));
      }

      /* b4 レベリング比較 ⇄ カード一覧 */
      await press(page, '.view-btn[data-view="range"]');
      const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
      const fb = await shown(page, '#filter-bar');
      ok(cols && !fb, T('b4 レベリング比較 → 絞り込みの帯が消え、#lvl-wa-grid に4本の .lvl-col'),
        J({ cols: await page.evaluate(() => document.querySelectorAll('#lvl-wa-grid .lvl-col').length), filterBar: fb }));
      await shot(page, 'base', lang, 'b4-range');
      await press(page, '.view-btn[data-view="card"]');
      const back = await until(page, () => getComputedStyle(document.getElementById('range-view')).display === 'none');
      const v4 = await visible(page), fb2 = await shown(page, '#filter-bar');
      ok(back && fb2 && same(v4, ORDER), T('b4 カード一覧 → 絞り込みの帯と112枚のカードに戻る'), J({ back, filterBar: fb2, n: v4.length }));

      /* b5 テーマ */
      const th0 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await press(page, '#theme-toggle');
      const th2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      ok(['light', 'dark'].includes(th0) && th1 === (th0 === 'dark' ? 'light' : 'dark') && th2 === th0,
        T('b5 テーマのボタンで data-theme が入れ替わり、もう1回で戻る'), J([th0, th1, th2]));

      /* b6 古い地図 */
      const AS = '.map-region-group[data-region="asia"]', nAsia = inRegion('asia').length, lab = REGION_LABEL.asia[lang === 'en' ? 1 : 0];
      const pt = await pointIn(page, AS);
      if (pt) await page.mouse.move(pt.x, pt.y);
      const tip = !!pt && await until(page, (lab, c) => {
        const t = document.getElementById('map-tooltip');
        return !!t && t.style.opacity === '1' && t.textContent.includes(lab) && t.textContent.includes(c);
      }, lab, C(nAsia));
      ok(tip, T(`b6 地図のアジアに指を載せる → 吹き出しに「${lab}」と「${C(nAsia)}」`),
        J({ pt, tip: await page.evaluate(() => { const t = document.getElementById('map-tooltip'); return t ? [t.style.opacity, t.textContent] : null; }) }));
      await shot(page, 'base', lang, 'b6-tooltip');
      if (pt) await page.mouse.click(pt.x, pt.y);
      const sel1 = !!pt && await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="asia"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6 = await visible(page);
      ok(sel1 && sameSet(v6, inRegion('asia')) && v6.length === nAsia, T(`b6 地図のアジアを押す → アジアが選ばれ、${nAsia}社`), J({ n: v6.length }));
      await still(page);
      const pt2 = await pointIn(page, AS);
      if (pt2) await page.mouse.click(pt2.x, pt2.y);
      const sel2 = !!pt2 && await until(page, () => { const b = document.querySelector('#region-strip .rstrip-btn[data-region="all"]'); return !!b && b.getAttribute('aria-pressed') === 'true'; });
      const v6b = await visible(page);
      ok(sel2 && same(v6b, ORDER), T('b6 もう1回押す → 選ぶのをやめ、112社に戻る'), J({ pt2, n: v6b.length, pr: await pressed(page) }));
      await still(page);
      const pins = await page.evaluate((codes) => codes.map((c) => ((document.getElementById('pc-' + c) || {}).textContent || '')), REG8);
      const pinWant = REG8.map((c) => C(inRegion(c).length));
      ok(same(pins, pinWant), T('b6 地図のピンの8つの社数 ＝ 地域の社数'), J({ pins, pinWant }));

      /* b7 一覧の検索欄 */
      await type(page, 'emirates');
      const em = await until(page, () => { const a = document.querySelector('#airline-grid a[href="airlines/emirates.html"]'); return !!a && a.getClientRects().length > 0 && [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')].some((x) => x.getClientRects().length === 0); });
      const v7 = await visible(page);
      ok(em && v7.includes('emirates') && v7.length < ORDER.length, T('b7 «emirates» → エミレーツが見えている（絞り込まれている）'), J({ n: v7.length }));
      await type(page, 'zzzz');
      const none = await until(page, () => { const n = document.getElementById('no-results'); return !!n && getComputedStyle(n).display !== 'none'; });
      const v7b = await visible(page);
      ok(none && v7b.length === 0, T('b7 «zzzz» → 見つからない（#no-results）・カードは0枚'), J({ n: v7b.length }));
      await shot(page, 'base', lang, 'b7-none');
      await type(page, '');
      const v7c = await visible(page);
      ok(same(v7c, ORDER), T('b7 検索欄を空に → 112社に戻る'), J({ n: v7c.length }));

      /* b8 ヘッダーの検索 */
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await press(page, '#pv-search-btn');
      await until(page, () => { const i = document.getElementById('pv-search-input'); return !!i && i.getClientRects().length > 0; });
      await page.evaluate(() => {
        const el = document.getElementById('pv-search-input');
        el.value = 'Solairus';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const hs = await until(page, () => [...document.querySelectorAll('#pv-search-dd a.pv-si')]
        .some((a) => a.getClientRects().length > 0 && (a.getAttribute('href') || '').endsWith('airlines/solairus.html')));
      ok(hs, T('b8 ヘッダーの検索で «Solairus» → airlines/solairus.html へのリンク'),
        J(await page.evaluate(() => [...document.querySelectorAll('#pv-search-dd a.pv-si')].map((a) => a.getAttribute('href')))));
      await shot(page, 'base', lang, 'b8-header');

      /* b9 静か */
      const q = quiet(st, 'base');
      ok(q.length === 0, T('b9 quiet(st, \'base\') が空 ── 外への通信も、一覧のページからのサーバーの口の呼び出しも無い'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 first（日英・390×680 のスマホ）── 開いた最初の1画面に、見出しのすぐ下の大きな検索欄 */
  async function first(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const m = await page.evaluate(() => {
        const s = document.getElementById('search'), h1 = document.querySelector('#wa-hero h1'), hero = document.getElementById('wa-hero');
        const r = s ? s.getBoundingClientRect() : null;
        /* 見出しと検索欄のあいだ（#wa-hero の中・文書の順）に押せるものが無い */
        const between = !h1 || !s ? ['?'] : [...hero.querySelectorAll('a[href],button,input,select,textarea,[tabindex],[role="button"]')]
          .filter((e) => e !== s && e.getClientRects().length > 0
            && (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) && (e.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING))
          .map((e) => e.outerHTML.slice(0, 80));
        const shownEl = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
        return {
          rect: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, vh: window.innerHeight,
          font: s ? parseFloat(getComputedStyle(s).fontSize) : 0, h1: h1 ? h1.textContent : null, between,
          h2: (document.getElementById('wd-rh-name') || {}).textContent ?? null,
          shown: ['#wd-scope', '#wd-clear', '#wd-scope-e', '#wd-clear-e', '.wd-else-b'].filter((sel) => [...document.querySelectorAll(sel)].some(shownEl)),
        };
      });
      ok(!!m.rect && m.rect.top >= 0 && m.rect.bottom <= m.vh, T(`first #search が最初の1画面（390×680）の中`), J(m.rect));
      ok(!!m.rect && m.rect.h >= 48, T('first #search の高さ 48px 以上'), J(m.rect));
      ok(m.font >= 16, T('first #search の字 16px 以上（iOS の拡大を起こさない）'), J(m.font));
      ok(m.between.length === 0, T('first 見出しと検索欄のあいだに押せるものが無い'), J(m.between));
      ok(m.h1 === H1[lang], T(`first 見出し「${H1[lang]}」`), J(m.h1));
      ok(m.h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`first 結果の見出し「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(m.h2));
      ok(m.shown.length === 0, T('first 開いたときは、地域の札・解除・見つからないときのボタンを見せない'), J(m.shown));
      await shot(page, 'first', lang, '390');
      const q = quiet(st, 'first');
      ok(q.length === 0, T('first quiet(st, \'first\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 nojs（日英・台本を止めたブラウザ）── 112社のリンクと見出しは HTML だけで読め、台本が要る部品は見せない */
  async function nojs(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], js: false });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const v = await visible(page);
      ok(same(v, ORDER), T(`nojs 台帳の${ORDER.length}社のリンクが見えている（一覧の並び）`), J({ n: v.length }));
      const h2 = await page.evaluate(() => (document.getElementById('wd-rh-name') || {}).textContent ?? null);
      ok(h2 === REGION_LABEL.all[lang === 'en' ? 1 : 0], T(`nojs h2#wd-rh-name「${REGION_LABEL.all[lang === 'en' ? 1 : 0]}」`), J(h2));
      const vis = await page.evaluate(() => ['.wd-search', '#filter-bar', '.view-toggle', '.map-wrapper']
        .filter((sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)));
      ok(vis.length === 0, T('nojs 検索欄・絞り込みの帯・表示の切り替え・古い地図を見せない'), J(vis));
      await shot(page, 'nojs', lang, '1440');
      const q = quiet(st, 'nojs');
      ok(q.length === 0, T('nojs quiet(st, \'nojs\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 検索欄に打って、見えているカード（DOM の順）を返す（打つと台本はその場で並べ直す。待つものは無い） */
  const typed = async (page, s) => { await type(page, s); return visible(page); };
  const regionOfSlug = (s) => SALARY[s].region;

  /* 場面 search（日英・1440×900）── 6種類の自分の値・決めた例・国の帯と地図・レベリング比較からの戻り */
  async function search(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* s1 112社 × 6種類の自分の値（ブラウザの中で1つずつ打つ。打つたびに input を1回） */
      const vals = [], perKind = {};
      for (const s of SLUGS) for (const [kind, vs] of Object.entries(ownValues(s))) for (const v of vs) { vals.push([s, v, kind]); perKind[kind] = (perKind[kind] || 0) + 1; }
      const misses = [];
      for (let i = 0; i < vals.length; i += 200) {
        misses.push(...await page.evaluate((chunk) => {
          const el = document.getElementById('search'), out = [];
          for (const [s, v, kind] of chunk) {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            const a = document.querySelector(`#airline-grid a[href="airlines/${s}.html"]`);
            if (!a || a.getClientRects().length === 0) out.push(`${s}「${v}」（${kind}）`);
          }
          return out;
        }, vals.slice(i, i + 200)));
      }
      console.log(`  ${T(`s1 自分の値 ${vals.length} 個（${Object.entries(perKind).map(([k, n]) => `${k} ${n}`).join('・')}）・会社 ${SLUGS.length}社`)}`);
      ok(vals.length > 0 && misses.length === 0, T(`s1 ${SLUGS.length}社の自分の値 ${vals.length} 個をそのまま打つ → どれもその会社が見えている（外れ ${misses.length}）`), J(misses.slice(0, 12)));

      /* s2 決めた例（期待する集合は台帳から） */
      const PINS = [];
      for (const c of ['NH', 'JL', 'EK', 'EY', 'AXC']) PINS.push({ qs: [c], exact: ofCode(c), name: `略号 ${c} を持つ会社だけ` });
      PINS.push({ qs: ['UA'], first: 'united', name: '先頭がユナイテッド' });
      PINS.push({ qs: ['BA'], first: 'british-airways', name: '先頭が英国航空' });
      PINS.push({ qs: ['ANA', 'ＡＮＡ', 'ana '], first: 'ana', all: (s) => AIRLINE_COUNTRY[s] === 'JP', not: ['jal', 'ryanair'], name: '先頭が ANA・日本の会社だけ・jal と ryanair は出ない' });
      PINS.push({ qs: ['US', 'USA', '米国', 'America', 'アメリカ', 'アメリカ合衆国'], exact: ofCountry('US'), name: '国が US の会社ちょうど' });
      PINS.push({ qs: ['UK', 'GB', '英国', 'Britain', 'Great Britain', 'England'], exact: ofCountry('GB'), name: '国が GB の会社ちょうど' });
      PINS.push({ qs: ['JP', '日本'], exact: ofCountry('JP'), name: '国が JP の会社ちょうど' });
      PINS.push({ qs: ['ドイツ', 'Germany'], exact: ofCountry('DE'), name: '国が DE の会社ちょうど' });
      PINS.push({ qs: ['フランス', 'France', 'エール フランス', 'エールフランス', 'air france', 'airfrance'], exact: ['air-france'], name: 'エールフランスだけ' });
      PINS.push({ qs: ['台湾', 'Taiwan'], exact: ofCountry('TW'), name: '国が TW の会社ちょうど' });
      PINS.push({ qs: ['インド'], india: true, name: '先頭の2社が IN・あとは ID だけ' });
      PINS.push({ qs: ['India'], exact: ofCountry('IN'), name: '国が IN の会社ちょうど' });
      PINS.push({ qs: ['マルタ', 'Malta'], exact: ['airx-charter'], name: 'エアX・チャーターだけ' });
      PINS.push({ qs: ['トルコ', 'Türkiye', 'Turkiye'], exact: ['turkish-airlines'], name: 'ターキッシュ エアラインズだけ' });
      PINS.push({ qs: ['全日空'], exact: ['ana'], name: 'ANA だけ' });
      PINS.push({ qs: ['ぴーち', 'ピーチ'], exact: ['peach'], name: 'ピーチだけ' });
      PINS.push({ qs: ['ｴﾐﾚｰﾂ'], first: 'emirates', name: '先頭がエミレーツ' });
      PINS.push({ qs: ['ワンワールド', 'oneworld'], exact: ofAlliance('ワンワールド'), name: '一覧の行の提携がワンワールドの会社ちょうど' });
      PINS.push({ qs: ['zzzz'], exact: [], name: '0社' });
      const IN = ofCountry('IN'), ID = ofCountry('ID');
      let nPin = 0, nPinOk = 0;
      for (const p of PINS) for (const q of p.qs) {
        const v = await typed(page, q);
        let good = true;
        if (p.exact) good = good && sameSet(v, p.exact) && v.length === p.exact.length;
        if (p.first) good = good && v[0] === p.first;
        if (p.all) good = good && v.length > 0 && v.every(p.all);
        if (p.not) good = good && p.not.every((s) => !v.includes(s));
        if (p.india) good = good && v.length > 2 && sameSet(v.slice(0, 2), IN) && v.slice(2).every((s) => ID.includes(s));
        nPin++; if (good) nPinOk++;
        ok(good, T(`s2 «${q}» → ${p.name}${p.exact ? `（${p.exact.length}社）` : ''}`), J({ n: v.length, v: v.slice(0, 14) }));
      }
      console.log(`  ${T(`s2 決めた例 ${nPin} 個のうち ${nPinOk} 個が通った`)}`);
      if (SHOTS) {
        for (const [name, q] of [['ja-name', 'エミレーツ航空'], ['en-name', 'Lufthansa'], ['abbr', '全日空'], ['code', 'NH'], ['country-ja', 'ドイツ'], ['country-en', 'Britain'], ['miss', 'zzzz']]) {
          await typed(page, q);
          await page.evaluate(() => { const r = document.getElementById('search'); r.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -90, behavior: 'instant' }); });
          await shot(page, 'search', lang, name);
        }
      }

      /* s3 国の帯と古い地図（#wd-explore）は、打っているあいだ見せない */
      await type(page, 'emirates');
      const ex1 = await shown(page, '#wd-explore');
      await type(page, '');
      const ex2 = await shown(page, '#wd-explore'), v3 = await visible(page);
      ok(!ex1 && ex2 && same(v3, ORDER), T('s3 打っているあいだは #wd-explore を見せない・空にすると見せて112社に戻る'), J({ typing: ex1, empty: ex2, n: v3.length }));

      /* s4 レベリング比較を開いたまま打つ → カード一覧に戻る */
      await press(page, '.view-btn[data-view="range"]');
      const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
      await type(page, 'jal');
      const back = await until(page, () => getComputedStyle(document.getElementById('range-view')).display === 'none'
        && getComputedStyle(document.getElementById('airline-grid')).display !== 'none'
        && document.querySelector('.view-btn[data-view="card"]').classList.contains('active'));
      const v4 = await visible(page);
      ok(cols && back && v4.includes('jal'), T('s4 レベリング比較を開いたまま «jal» → カード一覧に戻り、JAL が見えている'), J({ cols, back, v: v4.slice(0, 5) }));
      await type(page, '');

      const q = quiet(st, 'search');
      ok(q.length === 0, T('search quiet(st, \'search\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 scope（日英・390×680 のスマホ）── 地域を選んだまま、別の地域にだけ在る会社を打つ */
  async function scope(lang) {
    const T = (s) => `[${lang}] ${s}`, C = COUNT[lang], li = lang === 'en' ? 1 : 0;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const EU = REGION_LABEL.europe[li], JPN = REGION_LABEL.japan[li], Q = '全日空';
      /* 台帳で数える「全日空」を持つ会社（一覧の行・ヘッダー検索の略称・社名）と、地域ごとの数 */
      const holders = SLUGS.filter((s) => Object.values(ownValues(s)).flat().some((v) => v.includes(Q)));
      const hitIn = (code) => holders.filter((s) => regionOfSlug(s) === code).length;
      const chip = () => page.evaluate(() => { const c = document.getElementById('wd-scope'); return c && getComputedStyle(c).display !== 'none' && c.getClientRects().length > 0 ? c.textContent : null; });
      const elseShown = () => page.evaluate(() => [...document.querySelectorAll('#wd-else .wd-else-b')]
        .filter((b) => getComputedStyle(b).display !== 'none' && b.getClientRects().length > 0)
        .map((b) => ({ region: b.dataset.region, l: (b.querySelector('.wd-else-l') || {}).textContent, n: (b.querySelector('.wd-else-n') || {}).textContent })));
      const stripN = (code) => page.evaluate((code) => ((document.querySelector(`#region-strip .rstrip-btn[data-region="${code}"] .rstrip-n`) || {}).textContent || ''), code);

      /* 欧州を選ぶ → 欄の中の札 */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const on1 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const c1 = await chip();
      ok(on1 && c1 === EU && same(await pressed(page), ['europe']), T(`scope 欧州を選ぶ → 欄の中の札「${EU}」・欧州だけ aria-pressed="true"`), J({ chip: c1, pr: await pressed(page) }));
      await shot(page, 'scope', lang, '1-europe');

      /* 「全日空」＋ Enter（本当に欄に触って Enter を押す） */
      await page.focus('#search');
      await type(page, Q);
      const hl0 = await page.evaluate(() => history.length);
      await page.keyboard.press('Enter');
      /* Enter は結果の見出しを上の帯のすぐ下（86px）へ送る ── そこへ着くか、ページの底に着くまで待ってから、止まるのを待つ */
      const arrived = await until(page, () => {
        const r = document.getElementById('wd-rh').getBoundingClientRect(), maxY = document.documentElement.scrollHeight - window.innerHeight;
        return Math.abs(r.top - 86) <= 2 || Math.abs(window.scrollY - maxY) <= 1;
      });
      await still(page);
      ok(arrived, T('scope Enter → 結果の見出しが上の帯のすぐ下へ来る'), J(await page.evaluate(() => Math.round(document.getElementById('wd-rh').getBoundingClientRect().top))));
      const v2 = await visible(page), e2 = await elseShown(), none2 = await shown(page, '#wd-none'), n2 = await stripN('europe');
      ok(v2.length === 0, T(`scope 欧州 ＋「${Q}」＋ Enter → カード0枚`), J(v2));
      ok(!none2, T('scope 見つからないの文（#wd-none）を出さない（会社は在る）'), J(none2));
      ok(holders.length === 1 && e2.length === 1 && e2[0].region === 'japan' && e2[0].l === JPN && e2[0].n === String(hitIn('japan')),
        T(`scope #wd-else のボタンは「${JPN} ${hitIn('japan')}」の1つだけ`), J({ e2, holders }));
      ok(n2 === String(hitIn('europe')), T(`scope 欧州の帯の数 ＝ 台帳で数えた欧州の当たり（${hitIn('europe')}）`), J(n2));
      const geo = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#wd-else .wd-else-b')].find((x) => x.getClientRects().length > 0);
        const r = b ? b.getBoundingClientRect() : null;
        return { r: r && { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }, vw: window.innerWidth, vh: window.innerHeight,
          sx: window.scrollX, sw: document.documentElement.scrollWidth };
      });
      ok(!!geo.r && geo.r.l >= 0 && geo.r.r <= geo.vw && geo.r.t >= 0 && geo.r.b <= geo.vh && geo.sx === 0 && geo.sw <= geo.vw,
        T('scope Enter のあと、そのボタンは画面の中（横にずらさずに見える）'), J(geo));
      await shot(page, 'scope', lang, '2-else');

      /* そのボタンを押す → 日本・ANA・欄はそのまま・履歴は増えない */
      await press(page, '#wd-else .wd-else-b[data-region="japan"]');
      const on3 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="japan"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v3 = await visible(page), f3 = await page.evaluate(() => document.getElementById('search').value), hl3 = await page.evaluate(() => history.length);
      const c3 = await countText(page), h3 = await page.evaluate(() => (document.getElementById('wd-rh-name') || {}).textContent);
      ok(on3 && same(v3, ['ana']) && f3 === Q && hl3 === hl0 && (await chip()) === JPN,
        T(`scope 「${JPN} 1」を押す → ${JPN}が選ばれ、ANA が見える・欄は「${Q}」のまま・history.length は増えない`), J({ on3, v3, f3, hl0, hl3 }));
      ok(h3 === JPN && c3 === C(1), T(`scope 結果の見出し「${JPN}」「${C(1)}」（英語の1社は «1 airline»）`), J({ h3, c3 }));
      await shot(page, 'scope', lang, '3-japan');

      /* 欧州に戻して、札を押す → すべて・先頭が ANA・見えている数 ＝ すべての数 */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const e4 = await elseShown();
      await press(page, '#wd-scope');
      const on4 = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="all"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v4 = await visible(page), nAll = await stripN('all'), c4 = await chip();
      ok(e4.length === 1 && on4 && v4[0] === 'ana' && String(v4.length) === nAll && c4 === null,
        T('scope 欧州に戻して欄の札を押す → すべて・先頭が ANA・見えている数 ＝「すべて」の数・札は消える'), J({ e4, on4, v4, nAll, c4 }));
      await shot(page, 'scope', lang, '4-all');

      /* 欧州 ＋ «air» → 見えているのは欧州の会社だけ・社数 ＝ その数 → 欧州をもう1回 → 外れる */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="europe"]') || {}).getAttribute?.('aria-pressed') === 'true');
      const v5 = await typed(page, 'air'), c5 = await countText(page);
      ok(v5.length > 0 && v5.every((s) => regionOfSlug(s) === 'europe') && c5 === C(v5.length),
        T(`scope 欧州 ＋ «air» → 見えている${v5.length}社はどれも欧州・社数「${C(v5.length)}」`), J({ n: v5.length, c5, notEU: v5.filter((s) => regionOfSlug(s) !== 'europe') }));
      await shot(page, 'scope', lang, '5-europe-air');
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const off = await until(page, () => (document.querySelector('#region-strip .rstrip-btn[data-region="all"]') || {}).getAttribute?.('aria-pressed') === 'true');
      ok(off && same(await pressed(page), ['all']) && (await chip()) === null, T('scope 欧州をもう1回押す → 外れて「すべて」・札は消える'), J(await pressed(page)));

      const q = quiet(st, 'scope');
      ok(q.length === 0, T('scope quiet(st, \'scope\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 empty（日英・1440×900）── どの地域にも無い字 → 文と「絞り込みを解除」→ 元に戻る */
  async function empty(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang] });
    PAGES.push(P);
    const { page, st } = P;
    try {
      const shownList = (sels) => page.evaluate((sels) => sels.filter((sel) => [...document.querySelectorAll(sel)]
        .some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)), sels);
      const v1 = await typed(page, 'zzzz');
      const txt = await page.evaluate(() => ({ none: (document.getElementById('wd-none') || {}).textContent, clr: (document.getElementById('wd-clear-e') || {}).textContent }));
      const s1 = await shownList(['#no-results', '#wd-none', '#wd-clear-e', '#wd-else .wd-else-b', '#wd-scope-e']);
      const c1 = await countText(page);
      ok(v1.length === 0 && s1.includes('#no-results') && s1.includes('#wd-none') && txt.none === NONE_SENT[lang],
        T(`empty «zzzz» → カード0枚・文「${NONE_SENT[lang]}」`), J({ n: v1.length, s1, txt }));
      ok(s1.includes('#wd-clear-e') && txt.clr === CLEAR[lang], T(`empty 「${CLEAR[lang]}」が見えている`), J({ s1, txt }));
      ok(!s1.includes('#wd-else .wd-else-b') && !s1.includes('#wd-scope-e'), T('empty 地域のボタンも地域の札も出さない（どの地域にも無い）'), J(s1));
      ok(c1 === '', T('empty 社数は空（「0社」と書かない）'), J(c1));
      await page.evaluate(() => document.getElementById('no-results').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await shot(page, 'empty', lang, '1-none');
      await press(page, '#wd-clear-e');
      const back = await until(page, () => [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')].every((a) => a.getClientRects().length > 0));
      const v2 = await visible(page), f2 = await page.evaluate(() => document.getElementById('search').value), s2 = await shownList(['#wd-clear-e', '#wd-clear', '#no-results']);
      ok(back && same(v2, ORDER) && f2 === '' && same(await pressed(page), ['all']) && s2.length === 0,
        T(`empty 「${CLEAR[lang]}」を押す → 112社・欄は空・すべてが押されている・解除のボタンは隠れる`), J({ n: v2.length, f2, pr: await pressed(page), s2 }));
      const q = quiet(st, 'empty');
      ok(q.length === 0, T('empty quiet(st, \'empty\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  try {
    for (const s of want) for (const lang of LANGS) {
      console.log(`\n════ ${s}（${lang}） ════`);
      try { await SCENES[s](lang); }
      catch (e) { ok(false, `[${lang}] 場面が途中で止まった（${s}）`, String(e && e.stack || e).split(ROOT).join('').slice(0, 600)); }
    }
  } finally {
    await browser.close().catch(() => {});
    await L.stop().catch(() => {});
  }

  /* 閉じの行（どの実行でも出す） */
  const supa = PAGES.flatMap((p) => [...p.st.supa]), blocked = PAGES.flatMap((p) => [...p.st.blocked]);
  const dirCalls = PAGES.flatMap((p) => p.st.calls.filter((_, i) => { let seg = null; for (const g of p.st.segs || []) if (g.at <= i) seg = g; return seg && seg.dir; }));
  const errs = PAGES.flatMap((p) => p.st.errs), http4 = PAGES.flatMap((p) => p.st.http4 || []);
  console.log('');
  console.log(`  st.supa ${supa.length} · st.blocked ${blocked.length} · 一覧のページの st.calls ${dirCalls.length}（${PAGES.length}枚）${dirCalls.length ? '：' + dirCalls.join(', ') : ''}`);
  ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
  ok(http4.length === 0, '★手元の配信元が 4xx / 5xx で答えた要求が無い', J(http4));
  console.log(`\n══ assert-directory-ui：${pass} pass / ${fail} fail ══`);
  process.exitCode = fail ? 1 : 0;
}
