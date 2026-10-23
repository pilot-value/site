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
     b1 見えているカード ＝ 台帳の112社を一覧の並び（地域の順 → 一覧の行の順）で・社数「112社」／«112 airlines»・
        どの社名も語の途中で折れず切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ ── WP-dd-9。390 は場面 first で）
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
     開いたときは地域の札・解除・見つからないときのボタンを見せない・どの社名も語の途中で折れず切れていない（WP-dd-9）・quiet が空
   場面 nojs（日英・台本を止める）
     112社のリンクが見えている・h2#wd-rh-name「すべて」／«All»・検索欄／絞り込みの帯／表示の切り替え／古い地図／比べる印／盆を見せない・quiet が空

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
     s3b 地図の上の一言「地図をクリックして地域を選択」／«Click the map to choose a region» は地図の枠の中に1つ（見出しの帯には無い）・
        打っているあいだは地図と一緒に見えない（WP-dd-9）
     s4 レベリング比較を開いたまま打つ → カード一覧に戻る
   場面 scope（日英・390×680 のスマホ）── 地域を選んだまま別の地域の会社を打つ
     欧州を選ぶ → 欄の中に「欧州」の札・「全日空」＋ Enter → カード0枚・見つからないの文は出さない・#wd-else のボタンは
     「日本 1」の1つだけ（画面の中・横にずれない）・欧州の帯の数 ＝ 台帳で数えた当たり（0）→ 押す → 日本・ANA・欄はそのまま・
     history.length は増えない → 欧州 → 札を押す → すべて・先頭が ANA・見えている数 ＝ すべての数 → 欧州 ＋ «air» → 見えているのは
     欧州の会社だけ・社数 ＝ その数 → 欧州をもう1回 → 外れる
   場面 empty（日英・1440×900）── zzzz → 見つからないの文と「絞り込みを解除」・地域のボタンは出さない・社数は空 →
     「絞り込みを解除」→ 112社・欄は空・すべてが押されている・ボタンは隠れる
   場面 url（日英・1440×900）── 住所（WP-dd-6）
     u1 7つの住所（?q=ana・?q=ana#list・?region=asia・?region=zz・?ref=ABCD1234・?q=ドイツ&region=europe&type=fsc・?view=range）で開く →
        住所は1文字も変わらない・history.state は null（開いた時は履歴に触らない）・状態・欄・押した地域・種類が住所どおり・
        見えているカード ＝ 台帳（地域・国・種類）／打った時と同じ（q）・zz は「すべて」・?view=range は絞り込みの帯が消え、
        DOMContentLoaded のあと #lvl-wa-grid に4本の .lvl-col
     u2 «emirates» を本当に打つ → その場で絞り込まれ、欄にいるあいだ住所は変わらない → Enter → ?q=emirates・history.length は同じ
     u3 打って欄を離れる（Tab）→ ?q=emirates（change）・欄の消すボタン（空にして search）→ q が消える
     u4 地域のボタン → ?region=… ・history.length は同じ → «air» ＋ Enter ＋ スクロール → 読み直す → 同じ地域・欄・スクロール
     u5 地域を選び、打ち終えないまま言語のボタン → 向こうのページで同じカードが見えている
   場面 back（日英・1440×900・新しい headless）── 会社のページへ移って「戻る」（WP-dd-6）
     JAL と ルフトハンザ × 2つの歩き方 × 2つの離れ方。結果：その社の地域 ＋ «air» ／ «luft»（Enter なし）→ 社名 → 戻る →
     同じカード・欄・札・住所に q。スクロール：何も選ばずにその社のカードを画面のまんなかへ → 社名 → 戻る → 112社・
     スクロールが ±2px。離れ方：そのまま（ブラウザの手元に置かれたか ＝ cache ／ reload を印字）と、unload の聞き手を足して
     （手元に置かれない ＝ 必ず reload）。ページはサイトのファイルの no-store を max-age=600（GitHub Pages と同じ）に替える前の口
     （frontOf）から開く ── serve-local の no-store のままだと、ブラウザはいつも読み直す
   場面 touch（日英・390×680・指）── 欄を指で押して打つ → 社名を指で押す → 移る → 戻る → 同じカードと欄 → 比べる印を指で押す →
     付く・移らない
   場面 card（日英・390×680）── 比べる印と盆（WP-dd-7）
     印の在るカード ＝ 日本語：data-two="1" かつ SWITCH（airline-rollout.mjs を Node で読む）・英語：一覧の行に fleet がある社（4社には無い）／
     印の在るカードごとに、機長の額のまんなか ＝ そのカードのリンク・印のまんなか ＝ 印・足もとの左端 ＝ どちらでもない・印の高さ 44px 以上／
     T0 盆なし → T1 jal「1 / 5 社」＋レベリング比較 → T2 jal ＋ ana（日本語：「航空会社を比較」＝ career.html?view=compare&a=jal&b=ana・
     英語：レベリング比較だけ・その要素そのものが無い）→ 盆のレベリング比較 → 印の2社だけの図 → 読み直す → 同じ図 → カード一覧 → 印はそのまま →
     社名 → 戻る → 印はそのまま →（日本語）「航空会社を比較」→ career.html が jal と ana を2社で開く → 戻る → 3社目で入口が隠れる → 5社「5 / 5 社」／
     （英語）5社でほかの印はどれも押せない → 盆の札を押すと外れる／
     WP-dd-9：盆のレベリング比較を押した直後（マウスは動かさない）に図の吹き出しが出ない・3社目で隠れた「航空会社を比較」の行き先は
     出荷のまま（前の2社を残さない）・5社で札の列があふれても1社目から（左の端で切れない）／T6（段の無い社に印 ＝ 2社まで）は、日本語のページに印の在る
     data-lvl="0" のカードが在る時だけ歩く（無ければ「T6：まだ歩けない（比較の切り替えの前）」と印字して通す）

   使い方: node assert-directory-ui.mjs [--scenes base,first,nojs,search,scope,empty,url,back,touch,card] [--lang ja,en] [--shots <リポジトリの外のフォルダ>]
     --shots  名前の付いた段ごとに PNG を1枚（<scene>-<lang>-<段>.png）
     back が入る回は、ブラウザを新しい headless で立てる（'shell' は戻るの手元置き場を使わない：BackForwardCacheDisabledForDelegate）。
     どの回も、名前を引けるのは localhost と LIBS の4つだけ（--host-resolver-rules ＝ 門の外のもう1枚の網）

   ほかの検査が読む名前（export）: dirOpen / ready / visible / QUIET_ALLOW / quiet
   ════════════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bring, open, LIBS } from './local-chain.mjs';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
import { SWITCH } from './airline-rollout.mjs';

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
/** 地図の上の一言（もとは見出しの帯の1行の前半。WP-dd-9 で地図の枠の中へ移した。字はそのまま） */
const HINT = { ja: '地図をクリックして地域を選択', en: 'Click the map to choose a region' };

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
export async function dirOpen(browser, L, { rel = 'world-airlines.html', query = '', w = 1440, h = 900, touch = false, theme = null, js = true, init = null } = {}) {
  const o = await open(browser, L.base, { w, h, touch, theme });
  const { page, st } = o, origin = new URL(L.base).origin;
  if (init) await init(page);   // 最初の文書より先に置くもの（evaluateOnNewDocument など）
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

/* 手元のサーバーの前の口：サイトのファイルの no-store だけを GitHub Pages と同じ max-age=600 に替えて渡す（ほかは1字も替えない）。
   serve-local.mjs の no-store のままだと、ブラウザは一覧を手元に置かない（戻るがいつも読み直しになる ＝ 本番と違う）。
   assert-keep.mjs の pagesFront と同じ形の写し。3000 番では開かない。 */
async function frontOf(base) {
  const to = new URL(base);
  const srv = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: to.port, path: req.url, method: req.method, headers: { ...req.headers, host: to.host } }, (r) => {
      const h = { ...r.headers };
      if (!/^\/(rest|auth|functions|storage|realtime)\/v1(\/|$)|^\/__local\//.test(req.url) && /no-store/.test(h['cache-control'] || '')) h['cache-control'] = 'max-age=600';
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    up.on('error', () => { try { res.writeHead(502); res.end(); } catch { /* もう書き始めていた */ } });
    req.pipe(up);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  if (port === 3000) { srv.close(); throw new Error('3000 番は使わない'); }
  return { base: `http://localhost:${port}`, close: () => new Promise((r) => { srv.close(r); srv.closeAllConnections?.(); }) };
}

/* ── 実行（このファイルを直接流したときだけ）────────────────────── */
/* ⚠️ 実体のパスどうしで比べる。リンク越し（/tmp → /private/tmp、写しの中のリンク）で流すと、Node は argv[1] をリンクのまま・
   import.meta.url を実体で持つので、素の path.resolve では一致せず「何も流さず exit 0」＝検査の門が黙って緑になる */
const realOf = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(process.argv[1]) === realOf(fileURLToPath(import.meta.url))) await main();

async function main() {
  const argv = process.argv.slice(2);
  const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const SCENES = { base, first, nojs, search, scope, empty, url, back, touch, card };
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
  /* back が入る回だけ新しい headless（'shell' は戻るの手元置き場を使わない）。名前を引けるのは localhost と LIBS の4つだけ */
  const NO_NAMES = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE cdn.jsdelivr.net, EXCLUDE fonts.googleapis.com, '
    + 'EXCLUDE fonts.gstatic.com, EXCLUDE cdn.tailwindcss.com';
  const browser = await puppeteer.launch({ headless: want.includes('back') ? true : 'shell', args: ['--no-sandbox', NO_NAMES] });
  let FRONT = null;
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
  /* カードの社名が語の途中で折れていないか・切れていないか（WP-dd-9）── 折れてよいのは空白・「・」の後ろ・「（」の前だけ
     （括弧の中の略号は別の語）。見えているカードの社名ごとに、1字ずつの行の位置から折れ目を読む。[] ＝ どの社名も大丈夫 */
  const nameCut = (page) => page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#airline-grid .wd-name')) {
      if (!el.getClientRects().length) continue;
      const n = el.firstChild;
      if (!n || n.nodeType !== 3 || el.childNodes.length !== 1) { bad.push(`${el.id}：社名が字だけでない`); continue; }
      let prevTop = null;
      for (let i = 0; i < n.data.length; i++) {
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + 1);
        const q = r.getClientRects()[0];
        if (!q) continue;
        const top = Math.round(q.top);
        if (prevTop != null && top > prevTop + 3) {
          const a = n.data[i - 1], b = n.data[i];
          if (!(/\s/.test(a) || /\s/.test(b) || a === '・' || b === '（')) bad.push(`${n.data.slice(0, i)}／${n.data.slice(i)}`);
        }
        prevTop = top;
      }
      if (el.scrollWidth > el.clientWidth) bad.push(`${n.data}（切れている ${el.scrollWidth}／${el.clientWidth}px）`);
    }
    return bad;
  });
  /* 何コマか描き終わるまで（押した直後にブラウザが送る「マウスが上に来た」の知らせを待つ。時間ではなくコマで数える） */
  const settle = (page, n = 10) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
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
      const nc1 = await nameCut(page);
      ok(nc1.length === 0, T('b1 1440：どのカードの社名も語の途中で折れず、切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ）'), J(nc1));
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
      const nc = await nameCut(page);
      ok(nc.length === 0, T('first 390：どのカードの社名も語の途中で折れず、切れていない（折れ目は空白・「・」の後ろ・「（」の前だけ）'), J(nc));
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
      const vis = await page.evaluate(() => ['.wd-search', '#filter-bar', '.view-toggle', '.map-wrapper', '.wd-cmp', '.wd-tray']
        .filter((sel) => [...document.querySelectorAll(sel)].some((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0)));
      ok(vis.length === 0, T('nojs 検索欄・絞り込みの帯・表示の切り替え・古い地図・比べる印・盆を見せない'), J(vis));
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
      /* s3b 地図の上の一言は、地図の枠（.map-wrapper）の中に1つだけ（見出しの帯には無い）・打っているあいだは地図と一緒に見えない（WP-dd-9） */
      const hintOf = () => page.evaluate((t) => {
        const ps = [...document.querySelectorAll('p')].filter((p) => p.textContent.includes(t)), hero = document.getElementById('wa-hero');
        return { n: ps.length, inMap: ps.filter((p) => p.closest('.map-wrapper')).length, hero: !!hero && hero.textContent.includes(t), seen: ps.filter((p) => p.getClientRects().length > 0).length };
      }, HINT[lang]);
      const hn0 = await hintOf();
      await type(page, 'emirates');
      const hn1 = await hintOf();
      await type(page, '');
      const hn2 = await hintOf();
      ok(hn0.n === 1 && hn0.inMap === 1 && !hn0.hero && hn0.seen === 1 && hn1.seen === 0 && hn2.seen === 1,
        T(`s3b 「${HINT[lang]}」は地図の枠の中に1つ（見出しの帯には無い）・打っているあいだは地図と一緒に見えない・空にすると戻る`), J({ hn0, hn1, hn2 }));

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

  /* ── 住所と「戻る」の場面で使う道具（WP-dd-6）── */
  const fieldOf = (page) => page.evaluate(() => document.getElementById('search').value);
  const stateOf = (page) => page.evaluate(() => (window.PVDirectory ? window.PVDirectory.state() : null));
  const typeOf = (page) => page.evaluate(() => [...document.querySelectorAll('.ftype-btn.active')].map((b) => b.dataset.type));
  const chipOf = (page) => page.evaluate(() => { const c = document.getElementById('wd-scope'); return c && getComputedStyle(c).display !== 'none' && c.getClientRects().length > 0 ? c.textContent : null; });
  const addr = (page) => page.evaluate(() => ({ href: location.href, search: location.search, hl: history.length, hs: history.state }));
  /* 見えているカードが v（DOM の順）と同じになるまで */
  const untilVisible = (page, v) => until(page, (v) => JSON.stringify([...document.querySelectorAll('#airline-grid a[href^="airlines/"]')]
    .filter((a) => a.getClientRects().length > 0)
    .map((a) => a.getAttribute('href').replace(/^airlines\//, () => '').replace(/\.html$/, () => ''))) === JSON.stringify(v), v);
  const pressedIs = (page, code) => until(page, (c) => (document.querySelector(`#region-strip .rstrip-btn[data-region="${c}"]`) || {}).getAttribute?.('aria-pressed') === 'true', code);
  const D0 = { q: '', region: 'all', type: 'all', view: 'card' };
  /* 別の文書（道の終わりが end）へ移って読み終わるまで。⚠️ waitForNavigation は使わない ── 押した時の住所の書き込み
     （replaceState ＝ 同じ文書の中の移り）でも返るので、まだ一覧のページにいるうちに先へ進んでしまう */
  const toDoc = async (page, end, act) => {
    await act();
    return page.waitForFunction((end) => location.pathname.endsWith(end) && document.readyState === 'complete', { timeout: 60000 }, end).then(() => true, () => false);
  };

  /* 場面 url（日英・1440×900）── 住所が状態を決め、決まった時だけ住所に書く（履歴は積まない） */
  async function url(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang], other = lang === 'ja' ? 'en' : 'ja', plain = `${L.base}/${rel}`;
    const P = await dirOpen(browser, L, { rel });
    PAGES.push(P);
    const { page, st } = P;
    const go = async (href) => { await page.goto(href, { waitUntil: 'load', timeout: 60000 }); await ready(page); };
    try {
      /* u1 7つの住所（期待する集合は台帳から） */
      const DE = ofCountry('DE').filter((s) => SALARY[s].region === 'europe' && listType(s) === 'fsc');
      const ADDR = [
        ['?q=ana', { ...D0, q: 'ana' }, { typed: 'ana' }],
        ['?q=ana#list', { ...D0, q: 'ana' }, { typed: 'ana' }],
        ['?region=asia', { ...D0, region: 'asia' }, { exp: inRegion('asia') }],
        ['?region=zz', D0, { exp: ORDER }],
        ['?ref=ABCD1234', D0, { exp: ORDER }],
        ['?q=%E3%83%89%E3%82%A4%E3%83%84&region=europe&type=fsc', { ...D0, q: 'ドイツ', region: 'europe', type: 'fsc' }, { exp: DE }],
        ['?view=range', { ...D0, view: 'range' }, { range: true }],
      ];
      for (const [qs, want, how] of ADDR) {
        const href = plain + qs;
        await go(href);
        const a = await addr(page), s = await stateOf(page), f = await fieldOf(page), pr = await pressed(page), ty = await typeOf(page);
        let good = a.href === href && a.hs === null && same(s, want) && f === want.q && same(pr, [want.region]) && same(ty, [want.type]), ex = {};
        if (how.exp) {
          const v = await visible(page);
          ex = { n: v.length };
          good = good && how.exp.length > 0 && sameSet(v, how.exp) && v.length === how.exp.length;
        }
        if (how.typed) {
          const v = await visible(page), v2 = (await type(page, ''), await typed(page, how.typed));
          ex = { n: v.length, first: v[0], typed: v2.length };
          good = good && v.length > 0 && v[0] === 'ana' && same(v, v2);
        }
        if (how.range) {
          const cols = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 4);
          const fb = await shown(page, '#filter-bar'), grid = await shown(page, '#airline-grid');
          ex = { cols, fb, grid };
          good = good && cols && !fb && !grid;
          await shot(page, 'url', lang, 'range');
        }
        const what = how.exp ? `${how.exp.length}社` : how.typed ? '打った時と同じカード（先頭が ANA）' : '絞り込みの帯が消え、#lvl-wa-grid に4本の .lvl-col';
        ok(good, T(`u1 「${decodeURIComponent(qs)}」で開く → 住所はそのまま・history.state は null・状態・欄・地域・種類が住所どおり・${what}`), J({ a, s, f, pr, ty, ...ex }));
      }

      /* u2 本当に打つ → 欄にいるあいだは住所を書かない → Enter */
      await go(plain);
      const h0 = (await addr(page)).hl;
      await page.focus('#search');
      await page.keyboard.type('emirates');
      const narrowed = await until(page, () => {
        const g = [...document.querySelectorAll('#airline-grid a[href^="airlines/"]')];
        return g.some((x) => x.getAttribute('href') === 'airlines/emirates.html' && x.getClientRects().length > 0) && g.some((x) => x.getClientRects().length === 0);
      });
      const a2 = await addr(page), foc = await page.evaluate(() => (document.activeElement || {}).id);
      ok(narrowed && foc === 'search' && a2.search === '', T('u2 «emirates» を打つ → その場で絞り込まれ、欄にいるあいだ住所は変わらない'), J({ narrowed, foc, search: a2.search }));
      await page.keyboard.press('Enter');
      const w2 = await until(page, () => location.search === '?q=emirates');
      const a2b = await addr(page);
      ok(w2 && a2b.hl === h0, T('u2 Enter → ?q=emirates・history.length は同じ'), J({ search: a2b.search, hl: a2b.hl, h0 }));

      /* u3 打って欄を離れる → change が書く・欄の消すボタン（空にして search）→ q が消える */
      await go(plain);
      const h3 = (await addr(page)).hl;
      await page.focus('#search');
      await page.keyboard.type('emirates');
      const s3 = (await addr(page)).search;
      await page.keyboard.press('Tab');
      const w3 = await until(page, () => location.search === '?q=emirates');
      ok(s3 === '' && w3 && (await addr(page)).hl === h3, T('u3 打って欄を離れる（Tab）→ ?q=emirates・history.length は同じ'), J({ s3, now: (await addr(page)).search }));
      await page.evaluate(() => {
        const el = document.getElementById('search');
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('search', { bubbles: true }));
      });
      const w3b = await until(page, () => location.search === '');
      const v3 = await visible(page);
      ok(w3b && same(v3, ORDER) && (await addr(page)).hl === h3, T('u3 欄の消すボタン（空にして search）→ 住所から q が消え、112社'), J({ now: (await addr(page)).search, n: v3.length }));

      /* u4 地域のボタン → ?region= → «air» ＋ Enter ＋ スクロール → 読み直す */
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      const w4 = await until(page, () => location.search === '?region=europe');
      ok(w4 && (await addr(page)).hl === h3, T('u4 地域のボタン（欧州）→ ?region=europe・history.length は同じ'), J(await addr(page)));
      await page.focus('#search');
      await page.keyboard.type('air');
      await page.keyboard.press('Enter');
      const w4b = await until(page, () => location.search === '?q=air&region=europe');
      await still(page);
      await page.evaluate(() => {
        const g = document.getElementById('airline-grid'), max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: Math.max(0, Math.min(max - 40, Math.round(g.getBoundingClientRect().top + window.scrollY + 200))), behavior: 'instant' });
      });
      await still(page);
      const y4 = await page.evaluate(() => Math.round(window.scrollY)), v4 = await visible(page);
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const back4 = await until(page, (y) => Math.abs(window.scrollY - y) <= 2, y4);
      const s4 = await stateOf(page), f4 = await fieldOf(page), v4b = await visible(page), y4b = await page.evaluate(() => Math.round(window.scrollY));
      ok(w4b && y4 > 100 && back4 && same(s4, { ...D0, q: 'air', region: 'europe' }) && f4 === 'air' && same(await pressed(page), ['europe']) && v4.length > 0 && same(v4b, v4),
        T(`u4 欧州 ＋ «air» ＋ Enter ＋ スクロール（${y4}px）→ 読み直す → 同じ地域・欄・${v4.length}社・スクロール（±2px）`), J({ w4b, y4, y4b, s4, f4, n: v4b.length }));

      /* u5 地域を選び、打ち終えないまま言語のボタン → 向こうのページで同じカード */
      await go(plain);
      await press(page, '#region-strip .rstrip-btn[data-region="europe"]');
      await until(page, () => location.search === '?region=europe');
      await page.focus('#search');
      await page.keyboard.type('air');
      const v5 = await visible(page), s5 = (await addr(page)).search;
      const went5 = await toDoc(page, '/' + PAGE_REL[other], () => page.click('#lang-toggle'));
      await ready(page);
      const v5b = await visible(page), a5 = await addr(page), f5 = await fieldOf(page);
      ok(went5 && s5 === '?region=europe' && new URL(a5.href).pathname === '/' + PAGE_REL[other] && f5 === 'air' && v5.length > 0 && same(v5b, v5),
        T(`u5 欧州 ＋ «air»（打ち終えないまま）→ 言語のボタン → ${other} のページで同じ${v5.length}社・欄は «air»`), J({ s5, to: a5.href.replace(L.base, () => ''), f5, n: v5.length, nb: v5b.length }));
      await shot(page, 'url', lang, 'lang');

      const q = quiet(st, 'url');
      ok(q.length === 0, T('url quiet(st, \'url\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 back（日英・1440×900）── 会社のページへ移って「戻る」。前の口（frontOf）から開く */
  async function back(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang];
    if (!FRONT) FRONT = await frontOf(L.base);
    const F = { base: FRONT.base };
    /* 戻った時に、ブラウザの手元から出したか（pageshow の persisted）を数える */
    const init = (page) => page.evaluateOnNewDocument(() => { window.__ps = []; window.addEventListener('pageshow', (e) => { window.__ps.push(!!e.persisted); }); });
    const howBack = (page) => page.evaluate(() => {
      const ps = window.__ps || [], n = performance.getEntriesByType('navigation')[0], r = n && n.notRestoredReasons, out = [];
      const walk = (x) => { if (!x) return; (x.reasons || []).forEach((y) => out.push(y.reason || String(y))); (x.children || []).forEach(walk); };
      walk(r);
      return { cache: ps[ps.length - 1] === true, ps, reasons: out.join(',') };
    });
    const TARGETS = [['jal', 'japan', 'air'], ['lufthansa', 'europe', 'luft']], qs = [];
    for (const [slug, region, word] of TARGETS) for (const walk of ['results', 'scroll']) for (const leave of ['as-is', 'unload']) {
      const P = await dirOpen(browser, F, { rel, init });
      PAGES.push(P);
      const { page, st } = P, link = `#airline-grid a[href="airlines/${slug}.html"]`;
      try {
        let rec;
        if (walk === 'results') {
          await press(page, `#region-strip .rstrip-btn[data-region="${region}"]`);
          await pressedIs(page, region);
          await type(page, word);
          rec = { v: await visible(page), f: await fieldOf(page), chip: await chipOf(page) };
        } else {
          await page.evaluate(() => document.fonts && document.fonts.ready);   // 書体が入って高さが決まってから
          await page.evaluate((sel) => document.querySelector(sel).closest('li').scrollIntoView({ block: 'center', behavior: 'instant' }), link);
          await still(page);
        }
        if (leave === 'unload') await page.evaluate(() => { window.addEventListener('unload', () => {}); });
        /* 離れる直前の位置を記録する（まんなかへ送ったあとに上の高さが少し動くことがある ＝ 読む人がいた場所は押した時の位置） */
        if (walk === 'scroll') rec = { y: await page.evaluate(() => Math.round(window.scrollY)) };
        const went = await toDoc(page, `/airlines/${slug}.html`, () => page.click(link));
        const there = went ? new URL(page.url()).pathname : '（移らなかった）';
        await page.goBack({ waitUntil: 'load', timeout: 60000 });
        await ready(page);
        let good, got;
        if (walk === 'results') {
          const eq = await untilVisible(page, rec.v);
          got = { f: await fieldOf(page), chip: await chipOf(page), search: await page.evaluate(() => location.search) };
          const sp = new URLSearchParams(got.search);
          good = eq && rec.v.includes(slug) && got.f === rec.f && got.chip === rec.chip && sp.get('q') === word && sp.get('region') === region;
        } else {
          const all = await untilVisible(page, ORDER);
          const yok = all && await until(page, (y) => Math.abs(window.scrollY - y) <= 2, rec.y);
          got = { y: await page.evaluate(() => Math.round(window.scrollY)) };
          good = all && yok && rec.y > 0;
        }
        const h = await howBack(page), word2 = h.cache ? 'cache' : 'reload';
        console.log(`  ${T(`back ${slug} ${walk} ${leave}: ${word2}${h.cache ? '' : `（${h.reasons || '理由の記録なし'}）`}`)}`);
        const what = walk === 'results' ? `${REGION_LABEL[region][lang === 'en' ? 1 : 0]} ＋ «${word}» → 戻る → 同じ${rec.v.length}社・欄・札・住所に q`
          : `カードをまんなかへ（${rec.y}px）→ 戻る → 112社・スクロール ±2px`;
        ok(good && there.endsWith(`/airlines/${slug}.html`) && (leave === 'as-is' || !h.cache),
          T(`back ${slug}・${walk === 'results' ? '結果' : 'スクロール'}・${leave === 'as-is' ? 'そのまま' : 'unload あり（必ず reload）'}：${what}（${word2}）`), J({ there, rec: walk === 'results' ? { n: rec.v.length, f: rec.f, chip: rec.chip } : rec, got, h }));
        qs.push(...quiet(st, `back ${slug} ${walk} ${leave}`));
      } finally {
        await P.ctx.close().catch(() => {});
      }
    }
    ok(qs.length === 0, T('back quiet が空（8つの歩き方とも）'), J(qs));
  }

  /* ── 比べる印と盆の場面で使う道具（WP-dd-7）── */
  const fleetOf = (row) => typeof row?.fleet === 'string' && row.fleet !== '';
  const SW = new Set(SWITCH);
  const TRAY_FMT = { ja: (n, m) => `${n} / ${m} 社`, en: (n, m) => `${n} / ${m} airlines` };
  const LVL_WORD = { ja: 'レベリング比較', en: 'Leveling Comparison' };
  const TWO_WORD = '航空会社を比較';
  /* 盆と印の今（盆の字・社名の札・2つのボタンが見えているか・印の付き方） */
  const trayOf = (page) => page.evaluate(() => {
    const $ = (id) => document.getElementById(id), seen = (el) => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
    const t = $('wd-tray'), two = $('wd-tray-two'), lv = $('wd-tray-lvl'), boxes = [...document.querySelectorAll('#airline-grid .wd-cmp-i')];
    return {
      shown: seen(t), n: ($('wd-tray-n') || {}).textContent ?? null, isTwo: !!t && t.classList.contains('is-two'),
      chips: [...document.querySelectorAll('#wd-tray-list button')].map((b) => ({ s: b.dataset.slug, t: b.textContent, p: b.getAttribute('aria-pressed') })),
      two: two ? { shown: seen(two), href: two.getAttribute('href'), text: two.textContent } : null,
      lvl: lv ? { shown: seen(lv), text: lv.textContent } : null,
      checked: boxes.filter((b) => b.checked).map((b) => b.value), disabled: boxes.filter((b) => b.disabled).map((b) => b.value), boxes: boxes.length,
      all: boxes.map((b) => b.value),
    };
  });
  /* 押せないはずの印（ここで台帳から）：付いていない印のうち、足すと決まり（どの社も fleet を持てば5社・持たない社が入れば2社）を超える社。
     compare-all の切り替え（日本語の印が全社に）の前でも後でも同じ式で当たる */
  const lvlN = (s) => fleetOf(ROW.get(s));
  const fitsN = (list, s) => list.length < (list.concat([s]).every(lvlN) ? 5 : 2);
  const wantOff = (t) => t.all.filter((s) => !t.checked.includes(s) && !fitsN(t.checked, s));
  const nameOf = (page, s) => page.evaluate((s) => (document.getElementById('wn-' + s) || {}).textContent ?? null, s);
  /* その社の印を押す（印を、下に貼りつく盆より上の、見えている所のまんなかへ送ってから ── 盆の下で押さない） */
  const tickIt = async (page, s) => {
    await page.evaluate((s) => {
      const lab = document.querySelector(`li[data-slug="${s}"] label.wd-cmp`), tray = document.getElementById('wd-tray');
      const bottom = tray && !tray.hidden ? tray.getBoundingClientRect().top : window.innerHeight, r = lab.getBoundingClientRect();
      window.scrollBy({ top: (r.top + r.height / 2) - bottom / 2, left: 0, behavior: 'instant' });
    }, s);
    await page.click(`li[data-slug="${s}"] label.wd-cmp`);
  };
  const lvlCols = (page) => page.evaluate(() => document.querySelectorAll('#lvl-wa-grid .lvl-col').length);
  const pickOn = (page) => page.evaluate(() => [...document.querySelectorAll('#lvl-wa-picker .lvl-qchip[aria-pressed="true"]')].map((b) => b.dataset.sl));
  const QUICK = ['ana', 'jal', 'emirates', 'delta', 'united', 'singapore-airlines'];   // pv-directory.js が図に渡す quick（図の会社選びに札が出る社）

  /* 場面 card（日英・390×680）── 比べる印と盆（WP-dd-7）。期待する印の集合はここ（Node）で：
     日本語 ＝ data-two="1" のカード ∩ SWITCH（airline-rollout.mjs）、英語 ＝ 一覧の行に fleet がある社（4社には付かない） */
  async function card(lang) {
    const T = (s) => `[${lang}] ${s}`, rel = PAGE_REL[lang], en = lang === 'en', fmt = TRAY_FMT[lang], qsT6 = [];
    const P = await dirOpen(browser, L, { rel, w: 390, h: 680 });
    PAGES.push(P);
    const { page, st } = P;
    try {
      /* c1 印の在るカード */
      const dom = await page.evaluate(() => [...document.querySelectorAll('#airline-grid li[data-slug]')]
        .map((li) => ({ s: li.dataset.slug, two: li.dataset.two, lvl: li.dataset.lvl, tick: !!li.querySelector('label.wd-cmp > input.wd-cmp-i') })));
      const exp = en ? SLUGS.filter((s) => fleetOf(ROW.get(s))) : dom.filter((x) => x.two === '1' && SW.has(x.s)).map((x) => x.s);
      const got = dom.filter((x) => x.tick).map((x) => x.s), four = SLUGS.filter((s) => !fleetOf(ROW.get(s)));
      ok(exp.length > 0 && sameSet(got, exp) && got.length === exp.length && (!en || !got.some((s) => four.includes(s))),
        T(`card 印の在るカード ＝ ${en ? `fleet を持つ${exp.length}社（${four.length}社には無い）` : `data-two="1" かつ SWITCH の${exp.length}社${exp.length <= 10 ? `（${exp.join('・')}）` : ''}`}`),
        J({ n: got.length, extra: got.filter((s) => !exp.includes(s)), missing: exp.filter((s) => !got.includes(s)) }));

      /* c2 押せる所（390）── 印の在るカードごとに：機長の額のまんなか ＝ そのカードのリンク・印のまんなか ＝ 印・足もとの左端 ＝ どちらでもない・
         印の高さ 44px 以上・印がリンクの中身にも額の行にも重ならない */
      const hit = await page.evaluate(() => {
        const bad = [], seen = [];
        const mid = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }), at = (p) => document.elementFromPoint(p.x, p.y);
        const cross = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        for (const li of document.querySelectorAll('#airline-grid li[data-slug]')) {
          const lab = li.querySelector('label.wd-cmp');
          if (!lab || !li.getClientRects().length) continue;
          li.scrollIntoView({ block: 'center', behavior: 'instant' });
          const go = li.querySelector('a.wd-go'), amt = li.querySelector('.wd-fig[data-rank="cap"] .wd-v'), foot = li.querySelector('.wd-foot'), figs = li.querySelector('.wd-figs');
          const rt = lab.getBoundingClientRect(), rf = foot.getBoundingClientRect(), q = [];
          const e1 = at(mid(amt.getBoundingClientRect())), e2 = at(mid(rt)), e3 = at({ x: rf.left + 2, y: rf.top + rf.height / 2 });
          if (!e1 || !e1.closest || e1.closest('a.wd-go') !== go) q.push('額のまんなかがそのカードのリンクでない');
          if (!e2 || !e2.closest || e2.closest('label.wd-cmp') !== lab) q.push('印のまんなかが印でない');
          if (!e3 || !e3.closest || e3.closest('a.wd-go') || e3.closest('label.wd-cmp')) q.push('足もとの左端がリンクか印');
          if (rt.height < 44) q.push(`印の高さ ${rt.height}px`);
          for (const el of [...go.children, figs]) if (cross(rt, el.getBoundingClientRect())) q.push(`印が ${el.className} に重なる`);
          seen.push(li.dataset.slug);
          if (q.length) bad.push(`${li.dataset.slug}：${q.join('・')}`);
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return { bad, n: seen.length };
      });
      ok(hit.n === exp.length && hit.bad.length === 0, T(`card 390：印の在る${hit.n}枚とも、額 → リンク・印 → 印・足もとの左端 → どちらでもない・印の高さ 44px 以上・重ならない`), J(hit));

      /* c3 T0 印が無い ＝ 盆は出ない（英語のページには「航空会社を比較」の要素そのものが無い） */
      const t0 = await trayOf(page);
      ok(!t0.shown && t0.checked.length === 0 && (en ? t0.two === null : !!t0.two && !t0.two.shown), T(`card T0 印が無い → 盆は出ない${en ? '・#wd-tray-two の要素が無い' : ''}`), J(t0));

      /* c4 T1 1社（jal）→「1 / 5」・社名の札・レベリング比較（2社比較はまだ）／印を押しても住所はそのまま */
      const href0 = await page.evaluate(() => location.href), wnJal = await nameOf(page, 'jal'), wnAna = await nameOf(page, 'ana');
      await tickIt(page, 'jal');
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t1 = await trayOf(page), href1 = await page.evaluate(() => location.href);
      ok(t1.shown && t1.n === fmt(1, 5) && same(t1.chips, [{ s: 'jal', t: wnJal, p: 'true' }]) && t1.lvl && t1.lvl.shown && t1.lvl.text === LVL_WORD[lang]
        && (en ? t1.two === null : !t1.two.shown) && same(t1.checked, ['jal']) && href1 === href0,
        T(`card T1 jal に印 →「${fmt(1, 5)}」・札「${wnJal}」・「${LVL_WORD[lang]}」${en ? '' : '・「航空会社を比較」は出ない'}・住所はそのまま`), J({ t1, href1 }));
      await shot(page, 'card', lang, 'T1');

      /* c5 T2 2社（jal → ana） */
      await tickIt(page, 'ana');
      await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(2, 5));
      const t2 = await trayOf(page), href2 = await page.evaluate(() => location.href);
      const chips2 = [{ s: 'jal', t: wnJal, p: 'true' }, { s: 'ana', t: wnAna, p: 'true' }];
      if (en) {
        ok(t2.n === fmt(2, 5) && same(t2.chips, chips2) && t2.two === null && t2.lvl.shown && !t2.isTwo && href2 === href0,
          T(`card T2-EN jal ＋ ana →「${fmt(2, 5)}」・札2つ・«${LVL_WORD.en}» だけ（2社比較の入口は無い）`), J(t2));
        await shot(page, 'card', lang, 'T2-EN');
      } else {
        ok(t2.n === fmt(2, 5) && same(t2.chips, chips2) && t2.two.shown && t2.two.text === TWO_WORD && t2.two.href === 'career.html?view=compare&a=jal&b=ana'
          && t2.lvl.shown && t2.isTwo && href2 === href0,
          T(`card T2 jal ＋ ana →「${fmt(2, 5)}」・札2つ・「${TWO_WORD}」（career.html?view=compare&a=jal&b=ana）・その横に「${LVL_WORD.ja}」`), J(t2));
        await shot(page, 'card', lang, 'T2');
      }

      /* c6 盆の「レベリング比較」→ 印の2社だけの図（列が2本・図の会社選びで2社が押されている）→ 読み直す → 同じ2本 → カード一覧 → 印はそのまま */
      await page.click('#wd-tray-lvl');
      const c6 = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 2);
      const k6 = await lvlCols(page), pk6 = await pickOn(page), s6 = await page.evaluate(() => location.search), tr6 = await trayOf(page);
      ok(c6 && k6 === 2 && sameSet(pk6, ['jal', 'ana'].filter((s) => QUICK.includes(s))) && new URLSearchParams(s6).get('view') === 'range' && !tr6.shown,
        T('card 盆の「レベリング比較」→ 印の2社だけの図（.lvl-col 2本・会社選びで jal と ana が押されている）・住所に view=range・盆は隠れる'), J({ k6, pk6, s6 }));
      /* 押した所の下に図が来ても、マウスが動くまで図の吹き出しは出ない（ブラウザが送る「上に来た」の知らせを数コマ待ってから見る ── WP-dd-9） */
      await settle(page);
      const tip6 = await page.evaluate(() => {
        const t = document.getElementById('lvl-wa-tip'); if (!t) return null;
        const cs = getComputedStyle(t);
        return { show: t.classList.contains('show'), seen: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && t.getClientRects().length > 0 };
      });
      ok(!!tip6 && !tip6.seen, T('card 盆の「レベリング比較」を押した直後（マウスは動かさない）→ 図の吹き出し（#lvl-wa-tip）は出ていない'), J(tip6));
      await shot(page, 'card', lang, 'lvl');
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const c7 = await until(page, () => document.querySelectorAll('#lvl-wa-grid .lvl-col').length === 2);
      ok(c7 && sameSet(await pickOn(page), ['jal', 'ana']), T('card 読み直す（住所は view=range のまま）→ また印の2社だけの図（.lvl-col 2本）'), J({ k: await lvlCols(page), pk: await pickOn(page) }));
      await page.click('.view-btn[data-view="card"]');
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t8 = await trayOf(page);
      ok(t8.shown && sameSet(t8.checked, ['jal', 'ana']) && same(t8.chips.map((c) => c.s), ['jal', 'ana']) && t8.n === fmt(2, 5),
        T(`card カード一覧に戻る → 印は jal と ana のまま・盆「${fmt(2, 5)}」（付けた順）`), J(t8));

      /* c7 社名を押す → 会社のページへ移る → 戻る → 印はそのまま */
      await page.evaluate(() => document.querySelector('li[data-slug="ana"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
      const went = await toDoc(page, '/airlines/ana.html', () => page.click('#wn-ana'));
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      await until(page, () => !document.getElementById('wd-tray').hidden);
      const t9 = await trayOf(page);
      ok(went && sameSet(t9.checked, ['jal', 'ana']) && same(t9.chips.map((c) => c.s), ['jal', 'ana']),
        T('card 社名（ana）を押す → 会社のページへ移る → 戻る → 印は jal と ana のまま'), J({ went, t9 }));

      if (!en) {
        /* c8 「航空会社を比較」→ career.html が jal と ana を2社として開く（住所の約束の端から端まで）→ 戻る */
        const went2 = await toDoc(page, '/career.html', () => page.click('#wd-tray-two'));
        const sides = went2 && await until(page, () => { const a = document.getElementById('cr-a'), b = document.getElementById('cr-b'); return !!a && !!b && a.value === 'jal' && b.value === 'ana'; });
        const at2 = await page.evaluate(() => ({ path: location.pathname, search: location.search, a: (document.getElementById('cr-a') || {}).value, b: (document.getElementById('cr-b') || {}).value }));
        ok(went2 && sides, T(`card 「${TWO_WORD}」を押す → career.html?view=compare&a=jal&b=ana が jal と ana を2社として開く`), J(at2));
        await page.goBack({ waitUntil: 'load', timeout: 60000 });
        await ready(page);
        await until(page, () => !document.getElementById('wd-tray').hidden);
        /* c9 T3 3社目（etihad）→ 2社比較の入口は隠れ、レベリング比較だけ → T5 5社 →「5 / 5 社」 */
        await tickIt(page, 'etihad');
        await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(3, 5));
        const t3 = await trayOf(page);
        ok(t3.n === fmt(3, 5) && !t3.two.shown && !t3.isTwo && t3.lvl.shown && same(t3.chips.map((c) => c.s), ['jal', 'ana', 'etihad']),
          T(`card T3 3社目（etihad）→「${fmt(3, 5)}」・「${TWO_WORD}」は隠れ、「${LVL_WORD.ja}」だけ`), J(t3));
        ok(!!t3.two && t3.two.href === 'career.html?view=compare', T(`card T3 隠れた「${TWO_WORD}」に前の2社が残らない（行き先は出荷のままの career.html?view=compare）`), J(t3.two));
        await shot(page, 'card', lang, 'T3');
        /* 4社目・5社目 ＝ 印の在る、fleet を持つ社のうち、ページの並びで先の2社（切り替えの前は cathay-pacific と eva-air） */
        const more = dom.filter((x) => x.tick && lvlN(x.s) && !['jal', 'ana', 'etihad'].includes(x.s)).map((x) => x.s).slice(0, 2);
        for (const s of more) await tickIt(page, s);
        await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(5, 5));
        const t5 = await trayOf(page), off5 = wantOff(t5);
        ok(more.length === 2 && t5.n === fmt(5, 5) && t5.checked.length === 5 && sameSet(t5.disabled, off5) && t5.disabled.length === t5.boxes - 5 && t5.lvl.shown,
          T(`card T5 5社に印（${more.join('・')} を足す）→「${fmt(5, 5)}」・ほかの${t5.boxes - 5}社の印はどれも押せない`), J({ n: t5.n, checked: t5.checked, disabled: t5.disabled.length, boxes: t5.boxes }));
        await shot(page, 'card', lang, 'T5');
      } else {
        /* c9 T5（英語）5社 → ほかの印はどれも押せない・«5 / 5 airlines»・6社目は付かない */
        for (const s of ['emirates', 'etihad', 'delta']) await tickIt(page, s);
        await until(page, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(5, 5));
        const t5 = await trayOf(page);
        const sixth = exp.find((s) => !t5.checked.includes(s));
        const dis = await page.evaluate((s) => { const b = document.querySelector(`li[data-slug="${s}"] .wd-cmp-i`); b.closest('li').scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); return { checked: b.checked, disabled: b.disabled }; }, sixth);
        const t5b = await trayOf(page);
        ok(t5.n === fmt(5, 5) && t5.checked.length === 5 && sameSet(t5.disabled, wantOff(t5)) && t5.disabled.length === t5.boxes - 5 && !dis.checked && t5b.checked.length === 5 && t5b.n === fmt(5, 5),
          T(`card T5 5社に印 → «${fmt(5, 5)}»・ほかの${t5.boxes - 5}社の印はどれも押せない・6社目（${sixth}）は付かない`), J({ n: t5.n, checked: t5.checked, disabled: t5.disabled.length, boxes: t5.boxes, dis }));
        await shot(page, 'card', lang, 'T5');
      }

      /* 5社のとき（390 では札の列が横にあふれる）、札の列は1社目から見せる ＝ 1社目の札が左の端で切れない（WP-dd-9） */
      const chip5 = await page.evaluate(() => {
        const l = document.getElementById('wd-tray-list'), f = l && l.firstElementChild;
        if (!f) return null;
        const lr = l.getBoundingClientRect(), fr = f.getBoundingClientRect();
        return { listLeft: Math.round(lr.left), firstLeft: Math.round(fr.left), scrollLeft: l.scrollLeft, over: l.scrollWidth > l.clientWidth };
      });
      ok(!!chip5 && chip5.over && chip5.scrollLeft === 0 && chip5.firstLeft >= chip5.listLeft, T('card T5 盆の札の列はあふれても1社目から（1社目の札が左の端で切れない）'), J(chip5));

      /* c10 盆の社名の札を押す ＝ その社の印が外れる */
      const before = await trayOf(page);
      await page.click('#wd-tray-list button[data-slug="ana"]');
      await until(page, () => !document.querySelector('#wd-tray-list button[data-slug="ana"]'));
      const after = await trayOf(page);
      const off10 = wantOff(after);
      ok(!after.checked.includes('ana') && after.checked.length === before.checked.length - 1 && after.n === fmt(before.checked.length - 1, 5) && sameSet(after.disabled, off10),
        T(`card 盆の札（ana）を押す → ana の印が外れる・「${fmt(before.checked.length - 1, 5)}」・印はまた押せる（fleet の無い社を除いて ＝ いま ${off10.length}社が押せない）`), J({ n: after.n, checked: after.checked, disabled: after.disabled.length, want: off10.length }));

      /* c11 T6（段の無い社に印 ＝ 2社まで）── 日本語のページに「印が在って data-lvl="0"」のカードが在る時だけ歩く */
      if (!en) {
        const walker = dom.find((x) => x.tick && x.lvl === '0')?.s || null;
        if (!walker) console.log(`  ${T('T6：まだ歩けない（比較の切り替えの前）')}`);
        else {
          const Q = await dirOpen(browser, L, { rel, w: 390, h: 680 });
          PAGES.push(Q);
          try {
            const pg = Q.page;
            await tickIt(pg, walker);
            await until(pg, () => !document.getElementById('wd-tray').hidden);
            const a1 = await trayOf(pg);
            ok(a1.n === fmt(1, 2) && !a1.lvl.shown && !a1.two.shown && sameSet(a1.disabled, wantOff(a1)), T(`card T6 段の無い ${walker} に印 →「${fmt(1, 2)}」・「${LVL_WORD.ja}」は出ない`), J(a1));
            await tickIt(pg, 'jal');
            await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(2, 2));
            const a2 = await trayOf(pg);
            ok(a2.two.shown && a2.two.href === `career.html?view=compare&a=${walker}&b=jal` && !a2.lvl.shown && sameSet(a2.disabled, wantOff(a2)) && a2.disabled.length === a2.boxes - 2,
              T(`card T6 2社目（jal）→「${fmt(2, 2)}」・「${TWO_WORD}」（a=${walker}&b=jal）・ほかの印はどれも押せない`), J({ n: a2.n, two: a2.two, lvl: a2.lvl, disabled: a2.disabled.length, boxes: a2.boxes }));
            await shot(pg, 'card', lang, 'T6');
            await tickIt(pg, walker);
            await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(1, 5));
            const a3 = await trayOf(pg);
            ok(a3.n === fmt(1, 5) && a3.lvl.shown && sameSet(a3.disabled, wantOff(a3)), T(`card T6 ${walker} の印を外す → 5社までに戻る（「${fmt(1, 5)}」・「${LVL_WORD.ja}」）`), J(a3));
            const third = exp.filter((s) => s !== walker && s !== 'jal' && lvlN(s)).slice(0, 2);
            for (const s of third) await tickIt(pg, s);
            await until(pg, (n) => document.getElementById('wd-tray-n').textContent === n, fmt(3, 5));
            const a4 = await trayOf(pg);
            ok(third.length === 2 && a4.n === fmt(3, 5) && a4.disabled.includes(walker) && sameSet(a4.disabled, wantOff(a4)), T(`card T6 段を持つ3社に印 → 段の無い ${walker} の印は押せない（3社目に段の無い社は入らない）`), J({ checked: a4.checked, disabled: a4.disabled.includes(walker) }));
            qsT6.push(...quiet(Q.st, 'card T6'));
          } finally {
            await Q.ctx.close().catch(() => {});
          }
        }
      }

      const q = quiet(st, 'card').concat(qsT6);
      ok(q.length === 0, T('card quiet(st, \'card\') が空'), J(q));
    } finally {
      await P.ctx.close().catch(() => {});
    }
  }

  /* 場面 touch（日英・390×680・指）── 欄を指で押して打つ → 社名を指で押す → 移る → 戻る */
  async function touch(lang) {
    const T = (s) => `[${lang}] ${s}`;
    const P = await dirOpen(browser, L, { rel: PAGE_REL[lang], w: 390, h: 680, touch: true });
    PAGES.push(P);
    const { page, st } = P;
    try {
      await page.tap('#search');
      const foc = await until(page, () => (document.activeElement || {}).id === 'search');
      await page.keyboard.type('jal');
      const v0 = await visible(page), f0 = await fieldOf(page);
      ok(foc && f0 === 'jal' && v0.includes('jal') && v0.length < ORDER.length, T(`touch 欄を指で押して «jal» → 絞り込まれ（${v0.length}社）、JAL が見えている`), J({ foc, f0, n: v0.length }));
      await shot(page, 'touch', lang, '1-typed');
      const went = await toDoc(page, '/airlines/jal.html', () => page.tap('#wn-jal'));
      const there = went ? new URL(page.url()).pathname : '（移らなかった）';
      ok(there.endsWith('/airlines/jal.html'), T('touch 社名を指で押す → 会社のページ（jal）へ移る'), J(there));
      await page.goBack({ waitUntil: 'load', timeout: 60000 });
      await ready(page);
      const eq = await untilVisible(page, v0), f1 = await fieldOf(page);
      ok(eq && f1 === f0, T('touch 戻る → 同じカードと欄（«jal»）'), J({ f1, n: (await visible(page)).length }));
      await shot(page, 'touch', lang, '2-back');
      /* 比べる印を指で押す → 付く・どこへも移らない（WP-dd-7） */
      const href0 = await page.evaluate(() => location.href);
      await page.tap('li[data-slug="jal"] label.wd-cmp');
      const on = await until(page, () => (document.querySelector('li[data-slug="jal"] .wd-cmp-i') || {}).checked === true);
      const t1 = await page.evaluate(() => ({ href: location.href, tray: !document.getElementById('wd-tray').hidden }));
      ok(on && t1.href === href0 && t1.tray, T('touch 比べる印（jal）を指で押す → 付く・住所はそのまま（移らない）・盆が出る'), J({ on, t1, href0 }));
      await shot(page, 'touch', lang, '3-tick');
      const q = quiet(st, 'touch');
      ok(q.length === 0, T('touch quiet(st, \'touch\') が空'), J(q));
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
    if (FRONT) await FRONT.close().catch(() => {});
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
