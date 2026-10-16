// 主要5社の会社ページの最上部を書く ──
//   社名の行／給与・勤務・待遇・暮らし／提出された年収（REAL PAY）／会社・口コミ・募集・ステイ・「ひとつ教えて」。
//
//   node gen-airline-glance.mjs            5社とも書く
//   node gen-airline-glance.mjs etihad     1社だけ
//   node gen-airline-glance.mjs --check    差分だけ見る（書かない・古ければ exit 1）
//
// ・冪等。管理ブロック（<!--PV-GLANCE-…-->／<!--PV-HERO-->）の中だけを書き直す。
// ・数字は pv-airline-view.mjs の viewOf() からしか取らない。ここに額を書かない。
// ・年収は4種類を混ぜない（推定年収／求人の上限／会社の公表額／乗員全体の公表平均）。
//   ★ どの職位にも推定年収を額で出す。「確認中」と出さない（オーナーのご指示 2026-09-30／10-01／10-06）。
//   ★ 棒にするのは推定年収だけ。会社が公表している金額は、棒を付けずに別の一覧へ置く。
// ・ほかの107社のページには1文字も触らない。印は <body data-pv-glance="1">。
// ・英語版は、日本語の形が固まってから同じ部品で書く（いまは日本語だけ）。
//
// ⚠️ pv-glance.css／pv-glance.js／career-live.css／career-live.js を直したら流し直す
//    （HTML が読む ?v= はファイルの指紋。流さないと古い部品が最大4時間残る）。
// ⚠️ 社名 → 職位 → 額 の並びを崩さない。check-salary.mjs は「社名のすぐ後ろの職位と額」を
//    正本と突き合わせる。あいだに数字や </li> を挟むと、その額だけ黙って照合から外れる。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GLANCE, RANKS, AXIS, viewOf, width, yen, rentCell } from './pv-airline-view.mjs';
import { barGroup } from './pv-bars.mjs';
import { fxNote } from './salary-basis.mjs';
import { TOPICS, askGroup } from './gen-career.mjs';
import { QUESTIONS } from './pv-conditions.mjs';
import { needsCredit, src as photoSrc, smallH, SMALL_W } from './airline-photos.mjs';
import * as PLACE from './place-photos.mjs';
import { networkOf } from './airline-destinations.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UP = '../';                                   // 会社ページ（airlines/）から見たルート
const CSS = ['career-live.css', 'pv-glance.css', 'pv-gg.css'];   // pv-gg.css ＝「Give & Get」のボタンの形（サイトに1つ）
const JS = ['career-live.js', 'pv-glance.js'];
export const ASSETS = [...CSS, ...JS];
/* 「情報を追加」の面（pv-contrib.*）。タブを持つページだけが読む。 */
export const CONTRIB = { css: 'pv-contrib.css', js: 'pv-contrib.js' };
/* 就航地の詳細に出す、ホテル・レストラン・場所の欄（career-stay.*）。これもタブを持つページだけが読む。 */
export const STAY = { css: 'career-stay.css', js: 'career-stay.js' };
export const pageOf = slug => path.join('airlines', `${slug}.html`);

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fingerprint = f => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
const asset = f => `${UP}${f}?v=${fingerprint(f)}`;

/* ── 行き先 ─────────────────────────────────────────── */
const href = {
  compare: (a, b) => `${UP}career.html?view=compare&amp;a=${a}` + (b ? `&amp;b=${b}` : ''),
  card: a => `${UP}career.html?view=card&amp;a=${a}`,
  ask: (slug, q) => `${UP}airline-conditions.html?airline=${slug}&amp;q=${q}`,
  stay: (slug, iata) => `${UP}career.html?airline=${slug}&amp;stay=${iata}`,
  maps: q => `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(q)}`,
};

/* ── 小さな絵 ───────────────────────────────────────── */
const svg = (d, cls = 'pvg-ic') => `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = {
  pay: svg('M7 4l5 7 5-7M12 11v9M7 12h10M7 16h10'),
  work: svg('M7 3v4M17 3v4M4 10h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'),
  benefits: svg('M20 12v8H4v-8M2 7h20v5H2zM12 21V7M12 7H8.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h3.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z'),
  living: svg('M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6'),
  company: svg('M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3'),
  realpay: svg('M4 20h16M7 16v-6M12 16V5M17 16v-4'),
  reviews: svg('M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.5A8 8 0 1 1 21 12z'),
  jobs: svg('M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18'),
  stay: svg('M3 18V7M3 16h18M21 18v-3a3 3 0 0 0-3-3H3M7 12V9h5a2 2 0 0 1 2 2v1'),
  ask: svg('M12 8v8M8 12h8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'),
  pin: svg('M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10zM12 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', 'pvg-ic pvg-ic-s'),
  down: svg('M6 9l6 6 6-6', 'pvg-ic pvg-chev'),
  next: svg('M9 6l6 6-6 6', 'pvg-ic pvg-ic-s'),
  go: svg('M5 12h14M13 6l6 6-6 6', 'pvg-ic pvg-ic-s'),
  out: svg('M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5', 'pvg-ic pvg-ic-s'),
  x: svg('M6 6l12 12M18 6L6 18'),
  save: svg('M12 4v11M7 11l5 5 5-5M5 20h14', 'pvg-ic pvg-ic-s'),
  swap: svg('M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4', 'pvg-ic pvg-ic-s'),
  prev: svg('M15 6l-6 6 6 6', 'pvg-ic pvg-ic-s'),
  find: svg('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4'),
  clock: svg('M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'),
  /* 下の4つは「情報を追加」の面（pv-contrib.js の ICONS）の絵の写し ── 札を押して開く面と同じ絵。同じままかは assert-airline-glance.mjs が面のファイルを読んで突き合わせる。 */
  sheetRoster: svg('M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M4 10h16 M8 3v4 M16 3v4'),
  sheetTaxi: svg('M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z M12 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
  sheetStaffTravel: svg('M21 3 3 10.5l6.5 2.5L12 20l9-17z M9.5 13 21 3'),
  sheetUpgrade: svg('M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5z M6.5 11.5V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.5'),
};

/* ── タブ（見本の6つ・左から）───────────────────────────────
   ★ 先行5社。ほかの会社へ広げるときは TABBED に社を足して流し直す（足していない社は1文字も変わらない）。
   ・帯そのものは社名の行のすぐ下（PV-HERO の中）。切り替えるのは pv-glance.js、隠すのは pv-glance.css。
   ・どの塊がどのタブに出るかは data-pvg-pane（空白区切り）に書く。書いていない塊は、どのタブでも出る
     ＝ pv-glance.js が動かなくても、中身は1つも消えない（全部が縦に並ぶ）。
   ・タブに件数を書かない（数えていない数を出さない）。 */
export const TABBED = new Set(['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']);
export const TABS = [['overview', '概要', IC.company], ['pay', '給与・待遇', IC.pay], ['reviews', '口コミ', IC.reviews],
  ['work', '勤務・訓練', IC.work], ['life', '暮らし・家族', IC.living], ['stay', 'ステイ先', IC.stay]];
const tabbed = slug => TABBED.has(slug);
const pane = (slug, names) => (tabbed(slug) ? ` data-pvg-pane="${names}"` : '');
/* 勤務・待遇・暮らしの板が、自分のタブでは開いたまま本文になる（pv-glance.js の OPEN と同じ対） */
const CELL_TAB = { work: 'work', benefits: 'pay', living: 'life' };
/* 今のページの下に残っている古い節の行き先（見出しの言葉で決める。当たらない節は概要）。
   ★2026-10-09 残す節はもう無い（「よくある質問」もオーナーの判断で節ごと外した）。下の LEGACY が全部外す。
   この表は、あとで節を残すと決めたときの行き先の置き場として残してある（空なら全部「概要」）。 */
const OLD_PANE = [];
const oldPane = h2 => (OLD_PANE.find(([re]) => re.test(h2)) || [, 'overview'])[1];
const h2Text = s => s.replace(/<[^>]*>/g, () => '');
/* 「情報を追加」の面を開く印。href は残す ＝ 面が読めなかったときは、今までどおり質問の画面へ行く */
const opens = (slug, topic) => (tabbed(slug) && topic ? ` data-pvc-open="${topic}"` : '');
/* 質問の入口。面の中のどの話題か（askGroup ＝ pv-contrib.js の groupOfQ と同じ決め方）と、どの質問かを渡す
   ＝ 会社を選び直さず、その質問の前で開く。面で答えられない質問は、今までどおり質問の画面へ行く。 */
const opensQ = (slug, q) => (tabbed(slug) && askGroup(q) ? ` data-pvc-open="${askGroup(q)}" data-pvc-q="${q}"` : '');
/* 話題ごとの質問（askGroup が決める）。欄が受け持つ鍵は、ここから機械で出す */
const TOPIC_IDS = ['roster', 'career', 'upgrade', 'taxi', 'staff_travel', 'benefits'];
const TOPIC_Q = Object.fromEntries(TOPIC_IDS.map(t => [t, QUESTIONS.filter(q => askGroup(q.id) === t)]));
if (Object.values(TOPIC_Q).flat().length !== QUESTIONS.filter(q => askGroup(q.id)).length) throw new Error('話題の欄：どの話題にも入らない質問か、2つの話題に入る質問が在る');
const Q_BY = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
const noteKeys = topics => topics.flatMap(t => TOPIC_Q[t].map(q => q.id));
/* 集計の欄に通貨の質問は入れない（額は通貨切替の外で書けない） */
const factKeys = topics => topics.flatMap(t => TOPIC_Q[t].filter(q => !q.currency).map(q => q.id));
/* 子の質問を親のすぐ下へ並べる（字だけでは何の話か分からない子がある：「月に平均何日くらいですか？」） */
function tree(ids) {
  const set = new Set(ids), out = [];
  const put = id => { out.push(id); ids.filter(c => Q_BY[c].parent === id).forEach(put); };
  for (const id of ids) {
    const p = Q_BY[id].parent;
    if (p && !set.has(p)) throw new Error(`面の欄：${id} の親（${p}）が同じ欄に無い`);
    if (!p) put(id);
  }
  return out;
}
const subOf = ids => ids.filter(id => Q_BY[id].parent).map(id => `${id}:${Q_BY[id].parent}`).join(',');

/* ── 「勤務・訓練」の面（話題ごとに1枚）。並び・名前・入口・出す公表・受け持つ話題は、この表だけが決める ──
   quiet ＝ その面の集計が開いていないとき、鍵の文を繰り返さない（月の勤務の欄が1回だけ言う）。
   entry ＝ その面の欄が自分で出してよい入口。'login' ＝ 未ログインの「ログイン」だけ
           （給与を出す入口と、答えるカードは、同じ板の月の勤務の欄に1つ）。
   ★誰に見せるかを決めているのはサーバー（db/contrib.sql の pv_contrib_sees の1か所）。quiet も entry も
     その決まりの写しではなく、「同じ文・同じ入口を何度も出さない」ための印。
     どの面に付いているかは assert-airline-glance.mjs が見ている。 */
const MOVED = new Set(['commuting', 'staff_travel']);   // 台帳では待遇に在る公表のうち、勤務・訓練の面に出すもの
const SURFACES = [
  { id: 'month', name: '月の勤務', icon: IC.clock, gloss: '直近12か月', facts: null, topics: null, adds: [{ topic: 'work', add: '勤務時間を追加' }] },
  { id: 'roster', name: '勤務予定・休日', icon: IC.work, quiet: true, facts: ['days_off', 'working_time', 'trip_pattern', 'annual_leave', 'annual_leave_fo', 'annual_leave_so', 'sick_leave'], topics: ['roster'], adds: [{ topic: 'roster', add: '希望休の条件を追加', q: 'days_off_request' }] },
  { id: 'commute', name: '通勤', icon: IC.sheetTaxi, entry: 'login', facts: ['commuting'], topics: ['taxi'], adds: [{ topic: 'taxi', add: '通勤の条件を追加' }] },
  { id: 'travel', name: 'Staff Travel', icon: IC.sheetStaffTravel, entry: 'login', facts: ['staff_travel'], topics: ['staff_travel'], adds: [{ topic: 'staff_travel', add: 'Staff Travel の条件を追加' }] },
  { id: 'career', name: '昇格・訓練', icon: IC.sheetUpgrade, quiet: true, facts: ['upgrade_years', 'upgrade', 'training_location'], topics: ['upgrade', 'career'], adds: [{ topic: 'upgrade', add: '昇格の条件を追加' }, { topic: 'career', add: '訓練・キャリアの条件を追加' }] },
];
{
  const adds = SURFACES.flatMap(S => S.adds), tp = SURFACES.flatMap(S => S.topics || []), fk = SURFACES.flatMap(S => S.facts || []);
  if (new Set(adds.map(b => b.add)).size !== adds.length || new Set(adds.map(b => b.topic)).size !== adds.length) throw new Error('勤務・訓練の面：同じ名前の入口か、同じ話題を開く入口が2つ在る');
  for (const b of adds) if (b.q && askGroup(b.q) !== b.topic) throw new Error(`勤務・訓練の面：入口の質問 ${b.q} は話題 ${b.topic} のものではない`);
  if (new Set(tp).size !== tp.length) throw new Error('勤務・訓練の面：同じ話題を2つの面が受け持っている');
  if (new Set(fk).size !== fk.length) throw new Error('勤務・訓練の面：同じ公表を2つの面に出している');
}
const QUIET_NAMES = SURFACES.filter(S => S.quiet).map(S => S.name).join('、');
const tabBar = v => `<div class="pvg-tabbar" style="--pvg-c:${esc(v.color)}">
<div class="max-w-7xl mx-auto px-6">
<div class="pvg-tabrow">
<div class="pvg-tabwrap">
<div class="pvg-tabs" id="pvg-tabs" role="navigation" aria-label="${esc(v.name)}のページの中">
${TABS.map(([id, label, icon], i) => `<a href="#${id}" data-pvg-tab="${id}"${i ? '' : ' aria-current="page"'}>${icon}<span>${label}</span></a>`).join('\n')}
</div>
</div>
<button type="button" class="pvg-add" data-pvc-open="list"><b aria-hidden="true">＋</b><span><span class="pvg-add-w">情報を</span>追加</span></button>
</div>
</div>
</div>`;

/* ── 部品 ───────────────────────────────────────────── */
const join = (...xs) => {
  const a = [...new Set(xs.filter(Boolean))];
  return a.filter(x => !a.some(y => y !== x && y.includes(x))).join('・');
};
/* 事実に添える前提。時点が日付でなく資料の呼び名（「経験者の副操縦士の募集」）のときは、
   前提と同じことを2度言うことになるので、前提だけにする（資料の名前は出どころの一覧に出る）。 */
/* 値がもう時点を言っているとき（設立 1951年8月1日）は、同じ日付をもう一度書かない。 */
const premise = f => {
  const when = f.when && String(f.value).includes(f.when) ? '' : f.when;
  return join(f.cond, f.cond && !/\d/.test(when || '') ? '' : when);
};
const ext = (url, text, cls = 'pvg-src') => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const dateJa = iso => iso.replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`);
/* 実データの欄（描くのは career-live.js。ここは器だけ） */
const live = (kind, attrs = {}) =>
  `<div class="crl" data-live="${kind}"${Object.entries(attrs).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')} data-state="idle"><span class="crl-ph">—</span></div>`;
/* 台帳の値。外貨の原文は通貨切替に書き換えさせない（pv-no-cur）。円の目安は切替に任せる。
   目安には原文の通貨を添える ── 選んだ通貨が原文と同じとき、同じ額の言い直しになるので隠す（pv-glance.css）。 */
const approx = (cur, yenText) => `<small class="pvg-yen"${cur ? ` data-cur="${esc(cur)}"` : ''}>（${esc(yenText)}）</small>`;
const curOf = s => (/\b([A-Z]{3})\b/.exec(String(s)) || [])[1] || '';
const val = f => f.orig === true
  ? `<span class="pv-no-cur">${esc(f.value)}</span>${f.yen ? approx(curOf(f.value), f.yen) : ''}`
  : safe(f.value);
/* 台帳の散文（外貨の「500万元」などを通貨切替が円と読み違えないよう、丸ごと素通しにする） */
const prose = s => `<span class="pv-no-cur">${esc(s)}</span>`;
/* 円の額ではない「10万米ドル」「2,240万人」の「◯万」を、通貨切替が円の額と読み違えないようにする */
const safe = s => (!/[¥円]/.test(String(s)) && /\d\s*[万億]/.test(String(s)) ? prose(s) : esc(s));
const whole = f => (f.pilot === false ? '<span class="pvg-tag pvg-tag-q">会社全体の制度</span>' : '');

/* 出どころの一覧（同じ資料は1回だけ）。
   fold ＝ 下のカードでは畳んで置く（押せば資料の名前とリンクが全部出る。数字のそばから1回で届く）。
   dated ＝ 資料ごとに、当サイトがその資料を読んで確かめた日を添える（募集は腐る。確認日 ≠ 掲載日）。
           同じ資料から取った行の確認日が違うときは、古いほうを出す（どの行も、その日には確かめてある）。
           ⚠️ 確認日は台帳の値。読み直していない資料の日付を、ここで新しくしない。 */
function sources(items, fold = false, dated = false, label = '出どころ') {
  const seen = new Map();
  for (const f of items) {
    if (!f || !f.src || !f.src.url) continue;
    const o = seen.get(f.src.url) || { src: f.src, checked: f.checked || '' };
    if ((f.checked || '') < o.checked) o.checked = f.checked || '';
    seen.set(f.src.url, o);
  }
  if (!seen.size) return '';
  const links = [...seen.values()].map(o => ext(o.src.url, o.src.name) + (dated && o.checked ? `<small>確認日 ${esc(dateJa(o.checked))}</small>` : '')).join('');
  return fold
    ? `<details class="pvg-dt pvg-srcd"><summary>${esc(label)}<small>${seen.size}件</small>${IC.down}</summary><p class="pvg-srcs">${links}</p></details>`
    : `<p class="pvg-srcs"><span>${esc(label)}</span>${links}</p>`;
}
/* 会社が公表している条件の一覧 */
const factList = items => `<dl class="pvg-dl">${items.map(f =>
  `<div><dt>${esc(f.label)}${whole(f)}</dt><dd><b>${val(f)}</b>${premise(f) ? `<small>${esc(premise(f))}</small>` : ''}</dd></div>`).join('')}</dl>`;
/* 匿名で答える入口（質問の名前を出す） */
const asks = (slug, list, head = '匿名で答える') =>
  `<div class="pvg-ask">${head ? `<p class="pvg-askh">${esc(head)}</p>` : ''}<ul>${list.map(([q, label]) =>
    `<li><a href="${href.ask(slug, q)}"${opensQ(slug, q)}>${esc(label)}${IC.next}</a></li>`).join('')}</ul></div>`;

/* ── 社名の行（写真を置かない）────────────────────────── */
function hero(v, keep) {
  const iata = v.base.iata.length ? ` <b>${v.base.iata.map(esc).join('・')}</b>` : '';
  const t = tabbed(v.slug);
  /* タブを持つページは見本の並び：左に「カードを保存」・右に「他社と比較」（狭い画面では上下）。その下にタブの帯。 */
  const acts = t
    ? `<a class="pvg-btn pvg-btn-save" href="${href.card(v.slug)}">${IC.save}<span>カードを保存</span></a>
<a class="pvg-btn pvg-btn-cmp" href="${href.compare(v.slug)}"><span>他社と比較</span>${IC.swap}</a>`
    : `<a class="pvg-btn" href="${href.compare(v.slug)}">比較する</a>
<a class="pvg-btn pvg-btn-ghost" href="${href.card(v.slug)}">カードにする</a>`;
  return `<div class="hero-airline pvg-hero${t ? ' pvg-hero-t' : ''}" style="--pvg-c:${esc(v.color)}">
<div class="max-w-7xl mx-auto px-6">
<div class="pvg-id">
<div class="pvg-name">
<h1>${keep.h1}</h1><span class="pvg-code">${esc(v.code)}</span>
<p class="text-muted pvg-sub">${keep.sub}</p>
</div>
<div class="pvg-meta">
<span class="pvg-base">${IC.pin}${esc(v.base.city)}${iata}</span>
${live('stars', { airline: v.slug })}
</div>
<div class="pvg-acts">
${acts}
</div>
</div>
</div>
</div>${t ? '\n' + tabBar(v) : ''}`;
}

/* ── 給与 ─────────────────────────────────────────────
   ★ どの職位にも推定年収を額で出す。「確認中」と出さない
     （オーナーのご指示 2026-09-30／10-01／10-06。⚠️ 額を出さない枝を戻さない）。
   ★ 棒は推定年収だけ ＝ 1枚に2本・同じ物差し。
     会社が公表している金額（求人の上限・目標年収・下限・乗員全体の平均）は、棒を付けずに別の一覧へ置く
     （物差しの違う額を同じ目盛に並べない ── 2026-10-06）。 */
const bar = man => `<div class="pvg-track"><i class="pvg-bar pvg-bar-est" style="width:${width(man)}"></i></div>`;
const EST_BY = '当サイトの推定（公開情報からの推計）';
const FIG_LABEL = { max_y: '求人の上限', target_y: '目標年収', cash_y_over: '下限' };
const figText = f => (f.key === 'max_y' ? `〜${f.yen}` : f.key === 'cash_y_over' ? `${f.yen}超` : f.key.endsWith('_from') ? `${f.yen}〜` : f.yen);
/* 掲載日・時点。会社の資料が1つの時点にそろっているときだけ、欄に添える */
function whenOf(pay) {
  const w = [...new Set(pay.src.filter(s => !s.secondary).map(s => s.when).filter(Boolean))];
  /* 「発行日の記載なし」のような断りは、欄の前提の横には並べない（出どころの一覧に出る） */
  return w.length === 1 && /\d/.test(w[0]) ? w[0] : '';
}
/* 職位ごとの推定年収。「推定年収」の字は欄の頭に1回だけ出す（左右で2回言わない）。読み上げには職位ごとに添える。 */
const rankBlock = (v, [rk, rkJa]) => `<div class="pvg-rank" data-rank="${rk}">
<h3 class="pvg-rk"><span class="pvg-vh">${esc(v.name)}</span>${rkJa}<span class="pvg-rk-s">の推定年収</span></h3>
<p class="pvg-big">${v.pay[rk].est.yen}</p>
${bar(v.pay[rk].est.man)}
</div>`;
/* 会社が公表している金額（棒にしない）。職位ごとに、求人の上限を1つ・会社の公表額を1つまで。残りは下の説明に全部出る。
   ⚠️ 社名 → 職位 → 額 のあいだに数字を挟まない（外貨の原文は額の後ろ）。
   ⚠️ 乗員全体の平均の行は、隠した字で「機長と副操縦士をあわせた」と言ってから名前を出す
      ＝ 読み上げが職位の額と取り違えない／check-salary.mjs が「運航乗務員」の額として正本と突き合わせられる。 */
function pubRows(v) {
  const rows = [];
  for (const [rk, rkJa] of RANKS) {
    const p = v.pay[rk];
    for (const f of [p.cap[0], p.company.find(x => FIG_LABEL[x.key])].filter(Boolean)) {
      rows.push({
        kind: f.key === 'max_y' ? 'cap' : f.key === 'cash_y_over' ? 'over' : 'co', rank: rk,
        who: `<span class="pvg-vh">${esc(v.name)}・</span><b>${rkJa}</b>`, label: FIG_LABEL[f.key],
        value: figText(f), orig: f.orig, note: join(f.cond, whenOf(v.pay)),
      });
    }
  }
  const c = v.pay.crew[0];
  if (c) {
    rows.push({
      kind: 'crew', rank: '',
      who: `<span class="pvg-vh">${esc(v.name)}・機長と副操縦士をあわせた</span>`, label: `${c.who}全体の平均`,
      value: c.yen, orig: '', note: join('機長と副操縦士をあわせた額', c.scope, c.when),
    });
  }
  return rows;
}
function pubBlock(v) {
  const rows = pubRows(v);
  if (!rows.length) return '';
  /* 前提が全部の行で同じなら、一覧の下に1回だけ書く */
  const notes = [...new Set(rows.map(r => r.note))];
  const shared = notes.length === 1 ? notes[0] : '';
  return `<div class="pvg-pub">
<h3 class="pvg-k">会社が公表している金額</h3>
<ul>
${rows.map(r => `<li data-kind="${r.kind}"${r.rank ? ` data-rank="${r.rank}"` : ''}><p class="pvg-pk">${r.who}${esc(r.label)}</p><p class="pvg-pv">${r.value}${r.orig ? `<small class="pv-no-cur pvg-orig">${esc(r.orig)}</small>` : ''}</p>${!shared && r.note ? `<p class="pvg-pn">${prose(r.note)}</p>` : ''}</li>`).join('\n')}
</ul>
${shared ? `<p class="pvg-note">${prose(shared)}</p>` : ''}
</div>`;
}
function payDetails(v) {
  const p = v.pay, rows = [];
  for (const [rk, rkJa] of RANKS) {
    const r = p[rk], e = r.est;
    /* 根拠・算出方法・時点の3つが台帳にそろっている職位だけ、3つとも書く。そろっていない職位は、誰の推定かだけを書く */
    rows.push(`<div><dt>${rkJa}の推定年収</dt><dd><b>${e.yen}</b>${e.backed
      ? `<small>根拠：${prose(e.basis)}</small><small>算出方法：${prose(e.method)}</small><small>時点：${prose(e.asOf)}</small>`
      : `<small>${EST_BY}</small>`}</dd></div>`);
    for (const f of [...r.cap, ...r.company]) {
      rows.push(`<div><dt>${prose(f.group)}</dt><dd><b>${figText(f)}</b><span class="pv-no-cur pvg-orig">${esc(f.orig)}</span>
<small>${prose(join(f.kind, f.cond))}</small></dd></div>`);
    }
  }
  for (const c of p.crew) {
    rows.push(`<div><dt>${esc(c.who)}全体の平均</dt><dd><b>${c.yen}</b><small>${esc(join('会社の公表', c.scope, c.when))}。機長と副操縦士をあわせた額で、職位ごとの額ではありません。</small></dd></div>`);
  }
  for (const t of p.trainee) {
    rows.push(`<div><dt>${prose(t.group)}</dt><dd><b>${t.text}</b><small>${prose(t.kind)}</small></dd></div>`);
  }
  const notes = p.notes.length ? `<ul class="pvg-notes">${p.notes.map(n => `<li>${prose(n)}</li>`).join('')}</ul>` : '';
  /* 資料ごとに 時点（掲載日・対象の期間）と 確認日（当サイトが資料を読んで確かめた日）を別々に書く。
     join() に一緒に渡さない ── 同じ日付だと、短いほう（時点）が消える。 */
  const src = p.src.length ? `<p class="pvg-srcs"><span>出どころ</span>${p.src.map(s =>
    `${ext(s.url, `${s.pub}「${s.name}」`)}<small>${esc([join(s.when, s.secondary ? '会社の公表ではない資料' : ''), s.checked ? `確認日 ${dateJa(s.checked)}` : ''].filter(Boolean).join('・'))}</small>`).join('')}</p>` : '';
  const fx = p.cur && p.cur !== 'JPY' ? `<p class="pvg-fx">${esc(fxNote(p.cur))}</p>` : '';
  /* ★2026-10-08 この板が「金額の出どころ」の置き場（id="kyuyo-konkyo"。ほかのページからのリンクの先）。
       下に在った古い節（会社ごとに手で書いた出どころの表）は外した ＝ 同じ話を、確かめた日の違う字で2か所に出さない。
       # でここへ来たときは pv-glance.js が板を開く。 */
  return `<details class="pvg-dt pvg-paydt" id="kyuyo-konkyo">
<summary>この金額は誰の・何を含んだ・いつの金額か${IC.down}</summary>
<div class="pvg-body">
<dl class="pvg-dl">${rows.join('\n')}</dl>
<p class="pvg-axis">棒の目盛は 0 〜 ${yen(AXIS)}。機長と副操縦士で同じです。</p>
${notes}${src}${fx}
</div>
</details>`;
}
/* 給与の1枚（2026-10-07 オーナーのご指示「給与」と「提出された年収」を1枚に）。
   上から 推定年収（機長／副操縦士）→ 提出された年収の一部 → 資格に応じた入口。
   会社が公表している金額は意味が違う数字なので、その下に別の見出しで置く（推定の棒とは混ぜない）。
   提出された年収を描くのは career-live.js。資格を決めるのは今までどおりサーバーで、鍵の無い人へは
   額・職位・機材を送らない（板の中は空 ＝ HTML にも JSON にも入っていない）。 */
function payCard(v) {
  return `<article class="pvg-card pvg-pay"${pane(v.slug, 'overview pay')}>
<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${IC.pay}</span><h2 class="pvg-eyebrow">給与</h2><span class="pvg-chip">${esc(v.pay.tax)}</span></header>
<div class="pvg-ranks">
${RANKS.map(r => rankBlock(v, r)).join('\n')}
</div>
<p class="pvg-estk">${EST_BY}</p>
<section class="pvg-rp" id="pvg-realpay" aria-label="提出された年収">
<h3 class="pvg-rp-h">提出された年収<small lang="en">REAL PAY</small></h3>
${live('realpay', { airline: v.slug, top: '3' })}
</section>
${pubBlock(v)}
${payDetails(v)}
</article>`;
}

/* ── 勤務・待遇・暮らし ─────────────────────────────── */
const WORK_ASK = [['days_off_request', '希望休を指定できるか'], ['roster_lead_days', '勤務予定は何日前に決まるか'],
  ['reserve_duty', 'スタンバイ勤務があるか'], ['roster_changes', '確定後の変更は多いか']];
const BEN_ASK = [['annual_leave_days', '年間の有給休暇の日数'], ['sick_leave', '病気休暇を使えるか']];
const LIVE_ASK = [['commuting_transport', '通勤の足を会社が用意するか'], ['commuting_taxi_when', 'タクシーを使えるとき'], ['commuting_bus_when', 'クルーバスを使えるとき']];
/* 待遇の板の「パイロットの回答」の欄が、BEN_ASK の2問のほかに出す質問（聞く行は足さない ＝ 出すだけ）。
   着陸手当の、選ぶ形の3問。答える入口は「情報を追加」に在り、3人そろえば会社ページに出る、と書いてある
   ── どの欄も指していないと、何人答えても出ない。額の3問は入れない（すぐ下の決まり）。 */
const BEN_SHOW = ['landing_pay', 'landing_pay_unit', 'landing_pay_varies_by'];
/* ★額の質問（通貨つき）を、上の3つの箱へ入れない。箱は career-live.js が「数字＋単位」で出す
   ＝ 通貨が付かない。円の人とドルの人の額が、通貨なしの1つの数字として会社ページに出てしまう
   （公開集計も、通貨つきの質問では中央値を返さない ＝ 入れても空のまま）。 */
{
  const money = new Set(QUESTIONS.filter(q => q.currency).map(q => q.id));
  const hit = [...WORK_ASK, ...BEN_ASK, ...LIVE_ASK].map(a => a[0]).concat(BEN_SHOW).filter(id => money.has(id));
  if (hit.length) throw new Error('会社ページの箱に、額の質問（通貨つき）は入れられない ── 箱は通貨なしで数字だけを出す（' + hit.join('・') + '）');
}

/* 欄（閉じているときに見えるのが「公表されている条件を1つ」）と、その中身の板。
   板は欄のすぐ後ろに置く ＝ 狭い画面ではその場で開き、広い画面では3つの欄の下へ横いっぱいに出る（pv-glance.css）。 */
/* 広い箱では、欄の中に質問を名前で並べる（どの欄も、公表の条件と質問をあわせて3行まで） */
const quick = (slug, list) => (list.length ? `<div class="pvg-qs"><p class="pvg-qh">匿名で答える</p><ul>${list.map(([q, label]) =>
  `<li><a href="${href.ask(slug, q)}"${opensQ(slug, q)}>${esc(label)}${IC.next}</a></li>`).join('')}</ul></div>` : '');
const SLOTS = 3;
/* 値が長いとき（「本人と対象の家族に割引の航空券」）は字を1段小さくして、狭い画面でも1行に収める。円の目安（small）は数えない */
const isLong = html => html.replace(/<small[\s\S]*?<\/small>/g, '').replace(/<[^>]*>/g, '').length > 13;
function cell(id, title, icon, { slug, k, v: value, note, also = [], ask = [], count, body, empty, more: say }) {
  const more = say || (empty ? '答える' : count > 1 ? `ほか${count - 1}件と出どころ` : '出どころを見る');
  return `<article class="pvg-card pvg-cell" data-cell="${id}"${pane(slug, 'overview')}>
<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${icon}</span><h2 class="pvg-eyebrow">${title}</h2></header>
<div class="pvg-lead">
<p class="pvg-k">${k}</p>
<p class="pvg-v${isLong(value) ? ' is-long' : ''}">${value}</p>
${note ? `<p class="pvg-note">${note}</p>` : ''}
</div>
${also.length ? `<ul class="pvg-also">${also.map(f => `<li><span>${esc(f.label)}</span><b>${val(f)}</b></li>`).join('')}</ul>` : ''}
${quick(slug, ask.slice(0, SLOTS - also.length))}
<button type="button" class="pvg-more" aria-expanded="false" aria-controls="pvg-p-${id}"><span>${more}</span>${IC.down}</button>
</article>
<div class="pvg-card pvg-panel" id="pvg-p-${id}" data-panel="${id}"${pane(slug, `overview ${CELL_TAB[id]}`)} hidden>
<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${icon}</span><h3 class="pvg-ptitle">${title}</h3><button type="button" class="pvg-x" aria-label="閉じる">${IC.x}</button></header>
${body}
</div>`;
}
/* 面の入口。名前は面の表（SURFACES）に在る。質問を指す入口は、JS が無くてもその質問のページへ行く */
function sfEntry(slug, b) {
  const at = b.q ? `href="${href.ask(slug, b.q)}"${opensQ(slug, b.q)}` : `href="?add=${b.topic}" data-pvc-open="${b.topic}"`;
  return `<a class="pvg-link" ${at}>${esc(b.add)}${IC.go}</a>`;
}
function surface(v, S, all) {
  const head = `<header class="pvg-sf-h"><span class="pvg-sf-i" aria-hidden="true">${S.icon}</span><h4 class="pvg-sf-t" id="pvg-sf-${S.id}">${esc(S.name)}</h4>${S.gloss ? `<small>${esc(S.gloss)}</small>` : ''}</header>`;
  const add = tabbed(v.slug) ? `<p class="pvg-sf-add">${S.adds.map(b => sfEntry(v.slug, b)).join('')}</p>` : '';
  const open = `<section class="pvg-sf" data-sf="${S.id}" aria-labelledby="pvg-sf-${S.id}">${head}`;
  /* 月の勤務：数字はサーバーの集計だけ。鍵の文はこの欄が1回だけ言い、すぐ下の1行が「同じ条件で開く面」を名指しする */
  if (!S.topics) return `${open}${live('work', { airline: v.slug, notes: '1', work: '1', bars: '1', sf: S.id })}<p class="pvg-quiet pvg-sf-scope">${esc(QUIET_NAMES)}の回答も、同じ条件で開きます。</p>${add}</section>`;
  const items = all.filter(f => S.facts.includes(f.key));
  const pub = items.length ? `<div class="pvg-sf-pub"><p class="pvg-askh">会社が公表している条件</p>${factList(items)}</div>` : `<p class="pvg-quiet pvg-sf-none">会社の公表は確認できていません</p>`;
  const keys = tree(factKeys(S.topics)), sub = subOf(keys);
  const got = `<div class="pvg-sf-got"><p class="pvg-askh">パイロットの回答</p>${live('fact', { airline: v.slug, keys: keys.join(','), sf: S.id, ...(sub ? { sub } : {}), ...(S.quiet ? { quiet: '1' } : {}), ...(S.entry ? { entry: S.entry } : {}) })}${live('notes', { airline: v.slug, keys: noteKeys(S.topics).join(','), sf: S.id })}</div>`;
  return `${open}${pub}${got}${add}${items.length ? sources(items, true, false, '出典') : ''}</section>`;
}
function workPanel(v, all) {
  for (const f of all) {
    if (!SURFACES.some(S => S.facts && S.facts.includes(f.key))) throw new Error(`勤務・訓練の面：台帳の ${f.key} を、どの面に出すか決めていない（${v.slug}）`);
    if (f.src && f.src.kind !== 'company') throw new Error(`勤務・訓練の面：${f.key} の出典が会社の公表ではない（${v.slug}）。「会社が公表している条件」の下には置けない`);
  }
  return `<p class="pvg-quiet pvg-sfs-note">パイロットの回答は、3人そろった項目だけを出しています。</p><div class="pvg-sfs">${SURFACES.map(S => surface(v, S, all)).join('')}</div>`;
}
/* 概要の「勤務」のカード。カードに出す行は今までどおり台帳の勤務（v.work）から。開く板は5つの面 */
function workCell(v) {
  const all = [...v.work, ...v.benefits.filter(f => MOVED.has(f.key))], body = workPanel(v, all);
  const lead = v.work.find(f => f.lead) || v.work[0];
  if (!lead) return cell('work', '勤務', IC.work, { slug: v.slug, k: '会社の公表', v: '確認できていません', empty: true, ask: WORK_ASK, note: esc('会社が公表している勤務の条件を確認できていません'), body });
  return cell('work', '勤務', IC.work, { slug: v.slug, k: esc(lead.label) + whole(lead), v: val(lead), note: esc(premise(lead)), also: v.work.filter(f => f !== lead).slice(0, 2), ask: WORK_ASK,
    more: all.length > 1 ? `ほか${all.length - 1}件と出典` : '出典を見る', body });
}
/* 概要の「待遇」のカード。カードの行は台帳の待遇ぜんぶから（面へ移した公表も、カードからは減らさない）。
   開く板には、移した公表を載せない（同じ条件を2つのタブに出さない）。行き先は板の頭の1行が言う。
   集計の欄は、聞く2問（BEN_ASK）と、出すだけの着陸手当の3問（BEN_SHOW）を指す。 */
function benCell(v) {
  const card = v.benefits, items = card.filter(f => !MOVED.has(f.key)), gone = card.filter(f => MOVED.has(f.key));
  const moved = gone.length ? `<p class="pvg-quiet pvg-moved">${esc(gone.map(f => f.label).join('・'))}は「勤務・訓練」に載せています。<a class="pvg-link" href="#work">勤務・訓練で見る${IC.go}</a></p>` : '';
  const answers = `<div class="pvg-ans"><p class="pvg-askh">パイロットの回答（3人そろった項目だけ）</p>${live('fact', { airline: v.slug, keys: [...BEN_ASK.map(a => a[0]), ...BEN_SHOW].join(',') })}</div>${live('notes', { airline: v.slug, keys: noteKeys(['benefits']).join(',') })}`;
  const lead = card.find(f => f.lead) || card[0];
  if (!lead) return cell('benefits', '待遇', IC.benefits, { slug: v.slug, k: '会社の公表', v: '確認できていません', empty: true, ask: BEN_ASK, note: esc('会社が公表している待遇を確認できていません'), body: answers + asks(v.slug, BEN_ASK) });
  const others = items.filter(f => f !== lead).length;
  return cell('benefits', '待遇', IC.benefits, { slug: v.slug, k: esc(lead.label) + whole(lead), v: val(lead), note: esc(premise(lead)), also: card.filter(f => f !== lead).slice(0, 2), ask: BEN_ASK,
    more: others ? `ほか${others}件と出どころ` : '出どころを見る',
    body: `${moved}${items.length ? `<p class="pvg-askh">会社が公表している条件</p>${factList(items)}${sources(items)}` : ''}${answers}${asks(v.slug, BEN_ASK)}` });
}
function rentText(L, r, col) {
  const c = rentCell(L.cur, r.value[col]);
  const per = L.per === 'year' ? '年 ' : L.per === 'month' ? '月 ' : '';
  return c.orig ? `<span class="pv-no-cur">${per}${esc(c.orig)}</span>${approx(L.cur, c.yen)}` : `${per}${esc(c.yen)}`;
}
/* ── 暮らし：街の写真カード → 街ごとの詳細 → 「出典」（根拠・条件・時点）──
   ★ 写真 → 街の名前 → 家賃 → 空港までの移動 → 詳細 の順（オーナーのご指定 2026-10-07）。
   ★ 街は台帳の順。人気・順位とは言っていない。
   ★ 移動は、その街の鍵を持つ行だけ・着く場所ごと。足さない・平均しない。
   ★ タクシーは資料が無い＝額も時間も書かない（車の時間から作らない）。
   ★ 「出典」は都市に1つ。 */
const MODE_JA = { train: '電車', taxi: 'タクシー', bus: 'バス', car: '車' };
const placeImg = (p, sizes) => `<img src="${UP}${PLACE.src(p, true)}" srcset="${UP}${PLACE.src(p, true)} ${PLACE.SMALL_W}w, ${UP}${PLACE.src(p)} ${p.w}w" sizes="${sizes}" width="${PLACE.SMALL_W}" height="${PLACE.smallH(p)}" alt="${esc(p.subject)}" loading="lazy" decoding="async">`;
/* 写真のクレジット。CC BY / BY-SA は、作者名とライセンス名を示すことが使う条件（外さない）。CC0 には出さない。 */
function placeCredits(items) {
  const list = items.filter(([, p]) => p && PLACE.needsCredit(p));
  if (!list.length) return '';
  return `<details class="pvg-dt pvg-srcd pvg-phc"><summary>写真の出典<small>${list.length}枚</small>${IC.down}</summary><ul class="pvg-phl">${list.map(([label, p, key]) =>
    `<li${key ? ` data-cr="${esc(key)}"` : ''}><b>${esc(label)}</b><span>${ext(p.source, p.author)}／${ext(p.licence_url, p.licence)}${p.changes ? `（${esc(p.changes)}）` : ''}</span></li>`).join('')}</ul></details>`;
}
/* 街の名前。「東涌（Caribbean Coast）」は 東涌 と Caribbean Coast に分ける（台帳の英語名があればそちら） */
function townName(r) {
  const m = /^(.+?)（([^（）]+)）$/.exec(r.name);
  const sub = r.en || (m ? m[2] : '');
  return { main: m ? m[1] : r.name, sub, en: /^[\x20-\x7e]+$/.test(sub) };
}
/* 街のカードの名前（追加の面の候補・サーバの候補の種が、カードと同じ関数・同じ並びで読む）。
   sub   … カードが名前の下に出す1行（無ければ ''）。面の「街の検索」が、名前と一緒に探す
   alias … その1行がラテン文字の表記（カードが lang="en" を付ける行）のときだけ、同じ街の別の書き方として種に入れる。
           区や駅の案内（東京都港区・高鐵桃園站 A18）は、別のものの名前なので入れない */
export const ledgerTowns = v => {
  const seen = new Set();
  return (v.living ? v.living.rents : []).map(r => townName(r)).filter(n => n.main && !seen.has(n.main) && seen.add(n.main))
    .map(n => ({ name: n.main, sub: n.sub || '', alias: n.en && n.sub ? n.sub : '' }));
};
/* 街の投稿が属する基地の3字。住むエリアの節の data-base・入口・一覧の器・候補の種が、この1つを読む */
export const baseCode = v => (v.living && v.living.airports && v.living.airports[0] && v.living.airports[0].iata) || '';
const bare = s => String(s).replace(/（[^）]*）/g, '');
const code3 = iata => `<i class="pvg-code3">${esc(iata)}</i>`;
/* 段の数。幅が許す数（2／3／4／5）にカードが収まればカードの数、収まらなければ行ごとの枚数がそろう数。 */
const townTracks = n => { const t = a => (n <= a ? n : Math.ceil(n / Math.ceil(n / a))); return { a: t(2), b: t(3), c: t(4), d: t(5) }; };
const townSizes = t => `(min-width: 1100px) ${Math.ceil(1200 / t.d / 10) * 10}px, (min-width: 700px) ${Math.ceil(96 / t.b)}vw, 46vw`;
/* 間取りの呼び名。棒の組が出ている都市では、出どころの呼び名（ボタンと同じ字）。出ていない都市では、今までの名前。 */
const sizeWord = (L, col) => (L.hasBars && L.bars.includes(col) && L.words[col]) || bare(Object.fromEntries(L.cols)[col]);
const modeChips = modes => modes.map(m => `<i class="pvg-mode">${MODE_JA[m]}</i>`).join('');
/* 時間の種類の字（Google マップの行）。3つは別のもの ＝ 同じ字にしない。車（運転の時間）には字を足さない。 */
const KIND_JA = { walk_total: '徒歩込み', shown_total: '経路の合計', drive: '' };
/* その街の詳細に出す行。Google の行は着く場所ごとに1行（公共交通 → 車）。注意（warn）の付いた行は出さない（「出典」にだけ）。
   その下に、運営会社の運賃。運営会社の時間は、Google の行が無い街にだけ。
   by_town でない都市は今までどおり：空港がある街には、その空港の行だけ。ほかの街には、この都市の行をぜんぶ（どの空港の行かは札が言う）。 */
function townWays(L, r) {
  if (!L.byTown) return { ends: [], rows: r.iata ? L.commute.filter(c => c.iata === r.iata) : L.commute };
  const mine = L.commute.filter(c => c.town === r.key), g = mine.filter(c => c.via === 'gmaps' && !c.warn);
  const order = c => (c.mode === 'car' ? 1 : 0);
  const ends = [...new Set(g.map(c => c.end))].map(end => ({ end, figs: g.filter(c => c.end === end).sort((a, b) => order(a) - order(b)) }));
  return { ends, rows: mine.filter(c => c.via !== 'gmaps' && (c.fare || !mine.some(x => x.via === 'gmaps'))) };
}
const wayFig = c => `<span class="pvg-way-f" data-way="${esc(c.key)}">${modeChips(c.modes)}<b>${esc(c.value)}</b>${
  KIND_JA[c.kind] ? `<small>${KIND_JA[c.kind]}</small>` : ''}${c.ride != null ? `<small>乗車${c.ride}分</small>` : ''}</span>`;
const endRow = e => `<li data-end="${esc(e.end)}"><span class="pvg-way-l">${esc(`${e.figs[0].from} → ${e.figs[0].to}`)}</span><span class="pvg-way-fs">${e.figs.map(wayFig).join('')}</span></li>`;
const wayLine = c => `<li data-way="${esc(c.key)}"><span class="pvg-way-t"><i class="pvg-mode">${MODE_JA[c.mode]}</i>${code3(c.iata)}</span><span class="pvg-way-l">${esc(c.label)}</span><b>${val(c)}</b></li>`;
/* 見出しの行。カードの移動の数字が Google マップの表示だということは、ここで1回だけ言う（カードごとに繰り返さない）。
   「＋住みやすい街を追加」の入口は、この中の最後（見出しが左・入口が右。狭い箱では下へ回る ＝ .pvg-liv-h の組み方）。 */
const livingHead = (v, L) => `<header class="pvg-liv-h"><p class="pvg-askh">住むエリア${L.rents.some(r => r.way) ? '<small>空港までの時間は Google マップの表示</small>' : ''}</p>${townAdd(v)}</header>`;
/* 「＋住みやすい街を追加」。暮らしの板に1つだけ（常設）。会社は body から、基地・空港・街の名前はここから面へ渡す。
   ★額は1つも渡さない。家賃の欄の鍵も渡さない。★質問も街も指さない（data-pvc-q・data-pvc-ctx を付けない）。 */
const J = a => esc(JSON.stringify(a));
function townAdd(v) {
  if (!tabbed(v.slug) || !v.living || !baseCode(v)) return '';
  const base = `${v.base.city} ${v.base.iata.join('・')}`;
  const ports = v.living.airports.map(a => a.iata);
  return `<a class="pvg-link pvg-liv-add" href="?add=town" data-pvc-open="town" data-pvc-base="${esc(baseCode(v))}" data-pvc-basetext="${esc(base)}" data-pvc-ports="${J(ports)}" data-pvc-towns="${J(ledgerTowns(v).map(t => [t.name, t.sub]))}">＋住みやすい街を追加</a>`;
}
function townCard(L, r, sizes) {
  const p = PLACE.primary(r.key), n = townName(r), w = r.way;
  const col = L.leadCol && r.value[L.leadCol] != null ? L.leadCol : (L.cols.find(([key]) => r.value[key] != null) || [])[0];
  return `<li><button type="button" class="pvg-town" data-town="${esc(r.key)}" aria-controls="pvg-town-${esc(r.key)}" aria-pressed="false">
<span class="pvg-town-ph${p ? '' : ' is-none'}">${p ? placeImg(p, sizes) : `<b aria-hidden="true">${esc(n.main)}</b>`}</span>
<span class="pvg-town-b">
<b class="pvg-town-n">${esc(n.main)}</b>${n.sub ? `<span class="pvg-town-s"${n.en ? ' lang="en"' : ''}>${esc(n.sub)}</span>` : ''}
${col ? `<span class="pvg-town-r"><small>${esc((r.area ? r.area + '・' : '') + sizeWord(L, col))}</small><span>${rentText(L, r, col)}</span></span>` : ''}
${w ? `<span class="pvg-town-a">${modeChips(w.modes)}${code3(L.airports[0].iata)}<span>${esc(w.text)}</span></span>` : ''}
<span class="pvg-town-go">詳細${IC.next}</span>
</span>
</button></li>`;
}
function townDetail(v, L, r) {
  const n = townName(r), W = townWays(L, r), taxiQ = 'commuting_taxi_when';
  const wayRows = [
    ...W.ends.map(endRow), ...W.rows.map(wayLine),
    ...(W.ends.length || W.rows.length ? [] : [`<li class="is-none"><span class="pvg-way-t">${v.base.iata.map(code3).join('')}</span><span class="pvg-way-l">空港までの時間と手段は、資料を確認できていません</span></li>`]),
    `<li class="is-none"><span class="pvg-way-t"><i class="pvg-mode">${MODE_JA.taxi}</i></span><span class="pvg-way-l">運賃や時間の資料を確認できていません</span><a class="pvg-link" href="${href.ask(v.slug, taxiQ)}"${opensQ(v.slug, taxiQ)} data-pvc-ctx="${esc(n.main)}">会社のタクシーの条件を追加${IC.go}</a></li>`,
  ];
  const cols = L.cols.filter(([key]) => L.rents.some(x => x.value[key] != null));
  /* 間取りごとの一覧は、棒の組が無い都市と、額の無い街（棒の組が在る都市でも）にだけ。額の無い街は、家賃の資料が無いことを字で言う（黙らない） */
  const rentBlock = L.hasBars && Object.keys(r.value).length ? '' : `<div class="pvg-td-c"><p class="pvg-askh">家賃${L.measure ? `<small>${esc(L.measure)}・1か月あたり</small>` : ''}</p>
${Object.keys(r.value).length
    ? `<dl class="pvg-kv">${cols.map(([key, label]) => `<div><dt>${esc(label)}</dt><dd>${r.value[key] == null ? '<span class="pvg-none">—</span>' : rentText(L, r, key)}</dd></div>`).join('')}</dl>`
    : '<p class="pvg-quiet">家賃の資料を確認できていません</p>'}</div>`;
  return `<section class="pvg-td" id="pvg-town-${esc(r.key)}" data-town-detail="${esc(r.key)}" aria-label="${esc(n.main)}">
<header class="pvg-td-h"><h4>${esc(n.main)}${n.sub ? `<small${n.en ? ' lang="en"' : ''}>${esc(n.sub)}</small>` : ''}</h4>${r.pick ? `<p>${prose(r.pick)}</p>` : ''}</header>
<div class="pvg-td-g${rentBlock ? '' : ' is-one'}">
${rentBlock}
<div class="pvg-td-c"><p class="pvg-askh">空港までの移動<small>${W.ends.length ? 'Google マップの表示' : '駅と空港のあいだ'}</small></p>
<ul class="pvg-way">${wayRows.join('')}</ul></div>
</div>
</section>`;
}
/* 「出典」は都市に1つ。根拠・条件・時点・移動・参考。資料が自分の数字について言っている断りは、落とさずここへ集める。 */
function cityEvidence(v, L) {
  const priced = L.rents.filter(r => Object.keys(r.value).length), lead = priced.find(r => r.lead) || priced[0];
  const links = new Map();
  for (const s of [...priced.map(r => r.src), ...L.estates.map(e => e.src), ...L.rents.map(r => r.pickSrc), ...L.refs.flatMap(g => g.src)])
    if (s && s.url && !links.has(s.url)) links.set(s.url, s);
  const said = { currency: true, per: true, cols: true, what: !!(lead && lead.cond), period: !!(lead && lead.when) };
  const conds = [
    ...(lead ? [lead.cond, ...L.basis.filter(b => !said[b.key]).map(b => b.value)] : []).filter(Boolean).map(t => `<li>${prose(t)}</li>`),
    /* 円に直した額の断りも、ここ（「出典」の条件）に入れる。カードの下に断り文を並べない（オーナーのご指定 2026-10-07） */
    ...(L.cur && L.cur !== 'JPY' ? [`<li>${esc(fxNote(L.cur))}</li>`] : []),
    ...[...new Set(L.commute.filter(c => c.via === 'gmaps').map(c => c.cond))].filter(Boolean).map(t => `<li>${prose(t)}</li>`),
  ];
  const town = k => { const r = L.rents.find(x => x.key === k); return r ? townName(r).main : ''; };
  const moves = L.commute.map(c => `<li data-way-src="${esc(c.key)}">${c.town ? `<b>${esc(town(c.town))}</b>` : ''}${esc(c.label)}<span>${
    c.via === 'gmaps' ? `${modeChips(c.modes)}${esc(c.value)}${KIND_JA[c.kind] ? `・${KIND_JA[c.kind]}` : ''}${c.ride != null ? `・乗車${c.ride}分` : ''}` : val(c)}</span>${
    c.warn ? `<span class="pv-no-cur" data-way-warn>${esc(c.warn)}</span>` : ''}${
    c.via !== 'gmaps' && c.cond ? prose(c.cond) : ''}<span>${esc(c.when || '')}</span>${
    ext(c.src.url, c.via === 'gmaps' ? 'Google マップで見る' : c.src.name)}</li>`);
  /* 棒にしない区分（スタジオ・獨立套房 など）は、棒の組が在る都市ではここへ出す（詳細の一覧が無くなるので、額を画面から落とさない）。 */
  const extra = !L.hasBars ? [] : L.cols.filter(([k]) => !L.bars.includes(k) && priced.some(r => r.value[k] != null)).map(([k, label]) =>
    `<li><b>${esc(label)}</b>${priced.filter(r => r.value[k] != null).map(r => `<span>${esc(r.label)} ${rentText(L, r, k)}</span>`).join('')}</li>`);
  const refs = L.refs.map(g => {
    if (g.cur !== 'JPY') throw new Error(`${v.slug}: 外貨の参考の表（${g.key}）の書き方をまだ決めていない`);
    return `<li data-ref="${esc(g.key)}"><b>${esc(g.name)}</b><span>${esc(join(g.measure, g.when))}</span>${g.cond ? prose(g.cond) : ''}${
      g.basis.map(b => `<span class="pv-no-cur" data-ref-basis="${esc(b.key)}">${esc(b.value)}</span>`).join('')}${
      g.src.map(s => ext(s.url, s.name)).join('')}<ul class="pvg-refl">${g.rows.map(r => `<li><b>${esc(r.name)}</b>${
      g.cols.filter(([k]) => r.value[k] != null).map(([k, label]) => `<span>${esc(label)} <b>${esc(rentCell(g.cur, r.value[k]).yen)}</b></span>`).join('')}</li>`).join('')}</ul></li>`;
  });
  const row = (dt, dd) => (dd ? `<div><dt>${dt}</dt><dd>${dd}</dd></div>` : '');
  const list = a => (a.length ? `<ul class="pvg-notes">${a.join('')}</ul>` : '');
  return `<details class="pvg-dt pvg-srcd pvg-ev" data-pvg-ev><summary>出典<small>根拠・条件・時点</small>${IC.down}</summary>
<dl class="pvg-evl">
${links.size ? `<div><dt>根拠</dt><dd class="pvg-srcs">${[...links.values()].map(s => ext(s.url, s.name)).join('')}</dd></div>` : ''}
${row('条件', list(conds))}
${lead && lead.when ? `<div><dt>時点</dt><dd><span><b>家賃</b>${esc(lead.when)}</span></dd></div>` : ''}
${row('移動', list(moves))}
${row('参考', list([...refs, ...extra]))}
</dl></details>`;
}
/* 棒の行の、名前の列の幅（em）。字の長さで決める ＝ どの間取りの組でも・どの通貨でも、棒の土台の長さが同じになる。 */
const emLen = s => [...String(s)].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.58 : 1), 0);
const RB_V = 9;                       // 額の列の幅（em・12.5px の字で）。どの通貨の額も入る長さ
/* 家賃の棒（都市に1組）。0 から・全部の間取りで同じ目盛・同じ長さの土台・額の無い行に棒を出さない。並びは台帳の順（並べ替えない）。
   行は、団地ごとの家賃（estates）が在れば団地（名前の下に街の名前・額の横に件数）、無ければ額を持つ街（額の無い街は棒の組に行を持たない）。
   どの行にも data-town（その行の街の鍵）を付ける ── 選んだ街の行に印を付けるのは pv-glance.js。 */
function rentBars(L) {
  if (!L.hasBars) return '';
  const endText = L.cur === 'JPY'
    ? `${Number.isInteger(L.axis / 10000) ? L.axis / 10000 : (L.axis / 10000).toFixed(1)}万円`
    : `<span class="pv-no-cur">${esc(rentCell(L.cur, L.axis).orig)}</span>${approx(L.cur, rentCell(L.cur, L.axis).yen)}`;
  const townOf = k => L.rents.find(r => r.key === k);
  const rows = (L.estates.length ? L.estates : L.rents.filter(r => Object.keys(r.value).length)).map(x => (x.town
    ? { x, town: x.town, label: x.name, sub: townName(townOf(x.town)).main }
    : { x, town: x.key, label: townName(x).main, sub: x.area }));
  const nameEm = Math.min(9, Math.ceil((Math.max(...rows.map(o => Math.max(emLen(o.label), emLen(o.sub) * 0.96))) + 0.4) * 2) / 2);
  const groups = L.bars.map(k => barGroup({
    prefix: 'pvg-rb', attrs: ` data-size-panel="${esc(k)}"`, caption: esc(L.words[k]), end: L.axis, endText,
    rows: rows.map(({ x, town, label, sub }) => ({ id: esc(x.key), attrs: ` data-town="${esc(town)}"`, label: esc(label), sub: sub ? esc(sub) : '',
      value: typeof x.value[k] === 'number' ? x.value[k] : null,
      text: x.value[k] == null ? '' : rentText(L, x, k) + (x.n && x.n[k] != null ? `<small class="pvg-rb-c">${x.n[k]}件</small>` : ''),
      none: '<span class="pvg-none">—</span>' })),
  })).join('\n');
  const lead = L.rents.find(r => r.lead);
  return `<div class="pvg-rb" data-pvg-rent style="--rb-n:${nameEm}em;--rb-v:${RB_V}em">
<div class="pvg-rb-hd"><p class="pvg-askh" id="pvg-rb-h">家賃<small>${esc(L.measure)}・1か月あたり</small></p>
<div class="pvg-rb-sw" role="group" aria-labelledby="pvg-rb-h">
${L.bars.map(k => `<button type="button" class="pvg-rb-b" data-pvg-size="${esc(k)}" aria-pressed="${k === L.leadCol ? 'true' : 'false'}">${esc(L.words[k])}</button>`).join('\n')}
</div></div>
${groups}
<p class="pvg-rb-s pv-no-cur">${esc(L.siteName)}${L.beside ? `<span>${esc(L.beside)}</span>` : ''}<span>${esc(lead.when)}</span></p>
</div>`;
}
function livingCell(v) {
  const L = v.living;
  const lead = L && (L.rents.find(r => r.lead) || L.rents[0]);
  if (!lead) {
    return cell('living', '暮らし', IC.living, {
      slug: v.slug, k: '拠点の街', v: esc(v.base.city), empty: true, ask: LIVE_ASK,
      note: '家賃の資料を確認できていません', body: '',
    });
  }
  const t = townTracks(L.rents.length), sizes = townSizes(t);
  const towns = `<section class="pvg-liv" data-pvg-towns data-city="${esc(L.cityKey)}" data-base="${esc(baseCode(v))}">
${livingHead(v, L)}
<ul class="pvg-tgrid" data-n="${L.rents.length}" style="--tg-a:${t.a};--tg-b:${t.b};--tg-c:${t.c};--tg-d:${t.d}">
${L.rents.map(r => townCard(L, r, sizes)).join('\n')}
</ul>
<div class="pvg-liv-2${L.hasBars ? ' has-rb' : ''}">
<div class="pvg-tds">
${L.rents.map(r => townDetail(v, L, r)).join('\n')}
</div>${L.hasBars ? `\n${rentBars(L)}` : ''}
</div>
${cityEvidence(v, L)}
</section>`;
  const credits = placeCredits(L.rents.map(r => [townName(r).main, PLACE.primary(r.key), r.key]));
  const has = !!L.leadCol && lead.value[L.leadCol] != null, way = lead.way;
  /* 概要に出す移動の1行：by_town の都市は、先頭の街のカードの行。まだの都市は、今までの lead の行。 */
  const also = way ? [{ label: `${way.from} → ${way.to}・Google マップ`, value: `${way.modes.map(m => MODE_JA[m]).join('・')} ${way.text}`, orig: false }]
    : L.commute.filter(f => f.lead).slice(0, 1);
  /* 家賃の無い街が先頭のとき：空港までの移動（Google マップの表示）が在ればそれを、無ければ今までの「拠点の街」を出す */
  if (!has) return cell('living', '暮らし', IC.living, {
    slug: v.slug, ask: LIVE_ASK, count: 1,
    k: way ? `${esc(lead.name)}・空港までの移動` : '拠点の街',
    v: way ? `${way.modes.map(m => MODE_JA[m]).join('・')} ${esc(way.text)}` : esc(v.base.city),
    note: way ? esc(`Google マップ・${way.day}`) : '家賃の資料を確認できていません',
    body: `${towns}${credits}`,
  });
  const colName = Object.fromEntries(L.cols)[L.leadCol].replace(/（[^）]*）/g, '');   // 「2部屋（2房）」→ 欄の見出しでは「2部屋」。表には元のまま出る
  return cell('living', '暮らし', IC.living, {
    slug: v.slug, ask: LIVE_ASK,
    k: `${esc(lead.name).replace(/（[^）]*）/g, m => `<span class="pvg-opt">${m}</span>`)}${lead.area ? `（${esc(lead.area)}）` : ''}・${esc(colName)}の${esc(L.measure)}`, v: rentText(L, lead, L.leadCol),
    note: esc(join(L.siteName, lead.when)),
    also, count: L.rents.length + L.commute.length, more: '街ごとの家賃と出典',
    body: `${towns}${credits}`,
  });
}

/* ── その下：会社・REAL PAY・口コミ・募集・ステイ・ひとつ教えて ── */
const head = (icon, title, sub = '') =>
  `<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${icon}</span><h2 class="pvg-eyebrow">${title}</h2>${sub ? `<span class="pvg-hsub">${sub}</span>` : ''}</header>`;
/* 会社の数字。何の数か → 値（大きく）→ 数え方と時点、の順。
     値の末尾の（…）は補足なので、値からは外して下の行へ回す（「1952年」＋「日本ヘリコプター輸送として設立」）。 */
const tail = f => (f.orig === true ? null : /^(.+?)（([^（）]+)）$/.exec(String(f.value)));
const stats = items => `<dl class="pvg-stats">${items.map(f => {
  const m = tail(f);
  const value = m ? esc(m[1]) : val(f);
  const note = join(m ? m[2] : '', premise(f));
  /* 字の幅（全角 1・半角 0.6）で字の大きさを決める。長い値は小さく、狭い画面でだけ収まらない値は data-mid */
  const wide = [...(m ? m[1] : String(f.value))].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x2000 ? 0.6 : 1), 0);
  const size = wide > 8.5 ? ' data-long' : wide > 7 ? ' data-mid' : '';
  return `<div${size}><dt>${esc(f.label)}${whole(f)}</dt><dd><b>${value}</b>${note ? `<small>${esc(note)}</small>` : ''}</dd></div>`;
}).join('')}</dl>`;
/* 機材の札は、乗員が呼ぶ短い形で出す（台帳の書き方は title に残す）。 */
const shortType = s => String(s).replace(/^ボーイング\s*/, () => 'B').replace(/^エアバス\s*/, () => '').replace(/^エンブラエル\s*/, () => 'E');
function companyCard(v) {
  const c = v.company, p = c.photo;
  /* 作者名とライセンス名を示すことが、この写真を使う条件（CC BY／BY-SA）。外さない。 */
  const credit = p && needsCredit(p)
    ? `<figcaption>写真（${esc(p.changes)}）：${ext(p.source, p.author, '')}／${ext(p.licence_url, p.licence, '')}</figcaption>` : '';
  const photo = p ? `<figure class="pvg-photo"><img src="${UP}${photoSrc(p, true)}" srcset="${UP}${photoSrc(p, true)} ${SMALL_W}w, ${UP}${photoSrc(p, false)} ${p.w}w" sizes="(min-width:1100px) 400px, (min-width:700px) 34vw, 92vw" width="${SMALL_W}" height="${smallH(p)}" loading="lazy" decoding="async" alt="${esc(v.name)}の${esc(p.aircraft)}">${credit}</figure>` : '';
  const facts = [...c.profile, ...c.scale];
  const fleet = c.fleet.length ? `<div class="pvg-fleet"><p class="pvg-askh">機材<small>${join(`${c.fleet.length}機種`, c.fleet[0].when)}</small></p>
<ul class="pvg-chips">${c.fleet.map(f => `<li title="${esc(f.label)}">${esc(shortType(f.label))}<b>${esc(f.value)}</b></li>`).join('')}</ul></div>` : '';
  /* 紹介の本文（2026-10-08 オーナーのご指示「会社紹介の規模・空港名・古い機材／訓練地も台帳と公式資料にそろえる」）。
     字は台帳の項目から組み立てたものだけ（pv-airline-view.mjs の introOf。型と決まりは career-facts.mjs の checkIntro）。
     ⚠️ 手で書いた紹介文をここへ戻さない。作り直す前のページの字には「日本第2位」「日本最大」のような順位、
        古い機数・路線数、資料で確かめていない訓練地や退職年齢が入っていた（2026-10-07 までは、その字を1文字も変えずに運んでいた）。
     歴史・規模・拠点が分かる字は、開かなくても読める場所に置く（4つの数字だけで会社紹介を済ませない）。 */
  const lead = `<p class="pvg-about" data-pvg-about="lead">${c.intro.map(s => esc(s.text)).join('')}</p>`;
  /* 見本の「会社概要」── ページのいちばん上に置く小さな1枚。写真は小さく（主役にしない）、
     見えている値は4つまで。紹介文がもう言った項目は並べない（同じ話を上下に2度出さない）。
     数え方と時点・全部の数字・機材・出どころは「会社情報」を開いた中に在る
     （上に出した値も、そこでは数え方つきで出る ＝ 注記を落としたままにしない）。 */
  const said = new Set(c.intro.flatMap(s => s.uses));
  const keys = `<dl class="pvg-keys">${facts.filter(f => !said.has(f.key)).slice(0, 4).map(f => { const m = tail(f);
    return `<div><dt>${esc(f.label)}</dt><dd>${m ? esc(m[1]) : val(f)}</dd></div>`; }).join('')}</dl>`;
  return `<article class="pvg-card pvg-co"${pane(v.slug, 'overview')}>
${photo}
${head(IC.company, '会社')}
${lead}
${keys}
<details class="pvg-dt pvg-co-more"><summary>会社情報<small>${join(`数字${facts.length}つ`, c.fleet.length ? '機材' : '', '出どころ')}</small>${IC.down}</summary>
${stats(facts)}
${fleet}
${sources([...facts, ...c.fleet])}
</details>
</article>`;
}
/* 評価スコア＋口コミ（2026-10-06 オーナーのご指示「パイロットによる評価スコアの部分、企業トップのどこかのカードに残して」）。
   点数・6角形の図・6分類の棒は career-live.js が描く。数字の出し方は airline-reviews-ui.js の1か所
   （ほかの会社のページの帯と同じ答え）。HTML には数字を1つも書かない（出荷時は「—」）。
   書く入口は箱の底に1つだけ。
   ★2026-10-07 オーナーのご指示：給与の1枚の横（狭い画面ではすぐ下）に置く。入口の字は2行で、
     概要では「Give & Get／口コミを解放する」・口コミのタブでは「Give & Get／全ての口コミデータを解放する」。
     行き先（投稿フォーム）も、開く条件も、今までと同じ。どちらを出すかは pv-glance.css（JS が無ければ概要の字）。
   口コミの要約（良い点／気になる点）の置き場も、ここ。描くのは career-live.js で、資格は口コミの本文と同じ。
   答えが来たら、どの状態でも1行は出る（少ない／まだ無い／未接続／ログイン／鍵）。作り物の要約では埋めない。 */
export const GG = 'Give &amp; Get';
/* ★2026-10-08 形はサイト共通の pv-gg.css（トップのいちばん上の黒いボタンと同じ：2行ともまんなか・同じ大きさ・丸い形）。
     給与の1枚（career-live.js の give2）・口コミの錠前（airline-reviews-ui.js の unlockBtn）と1つも違わない。
     ここで大きさ・色・寄せ方を足さない。言葉と行き先は今までどおり。 */
export const GG_ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* 言葉は語の切れ目ごとに持つ。狭い箱ではここでだけ折れる（「デ／ータ」と語の途中で折らない。折り方は pv-gg.css）。 */
const gg = cut => `<span class="pv-gg-t"><span class="pvg-gg-k" lang="en">${GG}</span><span class="pvg-gg-m">${cut.join('<wbr>')}</span></span>`;
export const RV_CTA = { overview: ['口コミを', '解放する'], reviews: ['全ての', '口コミデータを', '解放する'] };
const rvCta = (v, at) => `<p class="pvg-rv-cta pvg-rv-cta-${at}"><a class="pv-gg" href="${UP}submit-review.html?airline=${esc(v.slug)}">${gg(RV_CTA[at])}${GG_ARROW}</a><span>匿名・無料</span></p>`;
const reviewsCard = v => `<article class="pvg-card pvg-rv-card" id="pvg-score"${pane(v.slug, 'overview reviews')}>
${head(IC.reviews, 'パイロットによる評価スコア')}
<div class="pvg-rv-in">
${live('score', { airline: v.slug })}
${live('summary', { airline: v.slug })}
${live('reviews', { airline: v.slug, give: '0' })}
${rvCta(v, 'overview')}
${rvCta(v, 'reviews')}
</div>
</article>`;
/* 募集（2026-10-08 オーナーのご指示）── 会社が公表している募集は、この1枚だけに置く。
   下に在った古い「募集要項」「採用情報」の節は外した（LEGACY）。新旧の2か所に在ると、確かめた日の違う字が
   食い違う（JAL は、上が「免許を持つ人は自社養成へ応募できない」・下が「経験者を随時採用」だった）。
   右上の入口は会社の募集ページへ直接（台帳のいちばん上の行の資料）。資料ごとの確認日は「出どころ」の中。 */
function jobsCard(v) {
  const first = v.jobs.find(f => f.src && f.src.url);
  const link = first ? `<a class="pvg-link" href="${esc(first.src.url)}" target="_blank" rel="noopener">会社の募集ページ${IC.out}</a>` : '';
  return `<article class="pvg-card pvg-jobs"${pane(v.slug, 'overview')}>
${head(IC.jobs, '募集', link)}
${v.jobs.length ? factList(v.jobs) + sources(v.jobs, true, true) : '<p class="pvg-quiet">会社が公表している募集を確認できていません。</p>'}
</article>`;
}
/* ── 就航地・ステイ ─────────────────────────────────────
   ・載せるのは、会社の公式の資料で確かめた就航地だけ（airline-destinations.mjs）。足りない会社には一覧を出さない。
   ・就航地 ≠ ステイの実績。「この会社が飛んでいる空港」であって、機種・ベースごとの運航や宿泊を言わない。
   ・並びは地域の順（そのなかで写真のある都市を先に）。人気・便数の順ではない ＝ 順位を作らない。
   ・都市を選ぶと、同じページの中で詳細へ（住所は #stay-NRT。戻る・進むで行き来できる）。
     ホテル名・住所・写真は、サーバーが確認済みのパイロットにだけ返す（career-stay.js。HTML には1文字も無い）。
   ・概要には一部だけ（地域ごとに1つずつ）。同じカードを2度出さないよう、全部の一覧は概要では隠す（pv-glance.css）。 */
const CITY_SIZES = '(min-width: 1100px) 250px, (min-width: 700px) 30vw, 46vw';
const TEASER = 6;                                  // 概要に出す枚数の上限（幅ごとの枚数は pv-glance.css の .pvg-cteaser）
/* 街の名前に、折れてよい所を <wbr> で渡す。
   pv-glance.css が街の名前を word-break:keep-all にしている ＝ ブラウザが自分で折るのは「・」のあとと括弧の前だけ。
   それだけだと、狭いカード（6〜9字ぶん）に入らない名前は入る所で切れて、最後の1字だけが次の行へ落ちる
   （390px の画面で「クライストチャー｜チ」、375px で「サンフランシス｜コ」）。
   ・かな・漢字 → 英数字 の境目（「ワシントン｜D.C.」。keep-all はここも折らせない）
   ・切れ目の無い7字以上の塊は、まんなかに1つ（いちばん狭いカードに入るのは6字）。
     行の頭に来ると読みにくい字（ー・小さいかな・ン・閉じ括弧）の前には置かない。
   入る幅では1行のまま（<wbr> は字を足さない ＝ textContent は台帳の名前と同じ）。 */
const NAME_CUT = { 'クアラルンプール': 3, 'コペンハーゲン': 3, 'アムステルダム': 5, 'デュッセルドルフ': 5, 'サンクトペテルブルク': 4, 'ティルヴァナンタプラム': 5 };   // 語の切れ目が分かっている名前（前半の字数）
const NO_HEAD = /[ーァィゥェォッャュョヮぁぃぅぇぉっゃゅょゎンん）)]/;
function cityName(name) {
  const cut = chunk => {
    const c = [...chunk];
    if (c.length < 7 || /[\x00-\x7F]/.test(chunk)) return [chunk];
    let m = NAME_CUT[chunk] || Math.ceil(c.length / 2);
    while (m < c.length - 2 && NO_HEAD.test(c[m])) m++;
    return NO_HEAD.test(c[m]) ? [chunk] : [c.slice(0, m).join(''), c.slice(m).join('')];
  };
  return String(name)
    .split(/(?<=[^\x00-\x7F])(?=[A-Za-z0-9])/)                       // かな・漢字 → 英数字
    .map(part => part
      .split(/(?<=[・／\/\-–)）、，,\s])|(?=[（(])/)                   // ブラウザが自分で折る所（ここには <wbr> を足さない）
      .map(chunk => cut(chunk).map(esc).join('<wbr>')).join(''))
    .join('<wbr>');
}
/* 探す欄の鍵：全角・半角、大文字・小文字、欧文の飾り（ü → u）を区別しない。
   ⚠️ pv-glance.js の norm と同じ式。あちらは打った字を同じ形にしてから、この鍵の中を探す。
      小文字にするだけだった頃は、「東京（羽田）」と打っても・"dusseldorf" と打っても、1枚も当たらなかった
      （打った字だけが半角のかっこになり、鍵は全角のまま）。飾りを外すのは欧文だけ（かなの濁点は外さない）。
      名前の中の区切りの記号（. , ' ・ - かっこ）は両方で落とす ── 残すと "washington dc"・"xian"・
      「パルマデマヨルカ」のように記号を打たない書き方が1枚も当たらない（語の区切りの空白は残る）。 */
const searchKey = s => String(s).normalize('NFKC')
  .replace(/[A-Za-z\u00C0-\u024F]+/g, x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  .toLowerCase()
  .replace(/[.,'’‘・\-()]/g, '');
function cityCard(d) {
  const p = PLACE.primary(d.iata);
  const q = searchKey([d.city, d.en, d.iata, d.country].join(' '));
  return `<li data-rg="${d.region}" data-q="${esc(q)}"><a class="pvg-town pvg-city" href="#stay-${d.iata}" data-city="${d.iata}"${d.seasonal ? ' data-seasonal="1"' : ''}>
<span class="pvg-town-ph${p ? '' : ' is-none'}">${p ? placeImg(p, CITY_SIZES) : `<b aria-hidden="true">${d.iata}</b>`}</span>
<span class="pvg-town-b">
<span class="pvg-city-k"><small>${esc(d.country)}</small>${code3(d.iata)}</span>
<b class="pvg-town-n">${cityName(d.city)}</b>
<span class="pvg-town-s" lang="en">${esc(d.en)}</span>${d.seasonal ? '\n<span class="pvg-city-t">季節運航</span>' : ''}
<span class="pvg-town-go">ホテル・おすすめ${IC.next}</span>
</span>
</a></li>`;
}
/* 地域の順 → 写真のある都市を先に → 台帳の順 */
function cityOrder(net) {
  const rank = new Map(net.regions.map((r, i) => [r.key, i]));
  return net.list.map((d, i) => [d, i]).sort(([a, i], [b, j]) =>
    rank.get(a.region) - rank.get(b.region) || !!PLACE.primary(b.iata) - !!PLACE.primary(a.iata) || i - j).map(([d]) => d);
}
/* 概要に出す一部：地域を順にひと回りずつ、写真のある都市から取る（写真が足りなければ無い都市で埋める） */
function cityTeaser(list, regions) {
  const out = [];
  for (const withPhoto of [true, false]) {
    const rows = regions.map(r => list.filter(d => d.region === r.key && !!PLACE.primary(d.iata) === withPhoto));
    for (let i = 0; out.length < TEASER && rows.some(row => row[i]); i++)
      for (const row of rows) if (row[i] && out.length < TEASER) out.push(row[i]);
  }
  return out;
}
function stayCard(v) {
  const net = networkOf(v.slug);
  const base = `<p class="pvg-stay-base">${IC.pin}<span>拠点</span><b>${esc(v.base.city)}${v.base.iata.length ? ` ${v.base.iata.map(esc).join('・')}` : ''}</b>
${ext(href.maps(`${v.base.text} ${v.base.iata[0] || ''}`.trim()).replace(/&amp;/g, '&'), 'Google マップで見る', 'pvg-link')}</p>`;
  if (!net) return `<article class="pvg-card pvg-stay" id="pvg-stay"${pane(v.slug, 'overview stay')}>
${head(IC.stay, 'ステイ')}
${base}
<p class="pvg-quiet">就航地ごとのホテル・レストランは、会社が公表する就航地の一覧を確認してから開きます。</p>
</article>`;
  const list = cityOrder(net), n = list.length;
  const official = ext(net.src[0].url, '公式の就航地', 'pvg-link pvg-st-off');
  const held = new Map();
  for (const h of net.held) held.set(h.why, [...(held.get(h.why) || []), h.name]);
  const evidence = `<details class="pvg-dt pvg-srcd pvg-ev"><summary>出典<small>根拠・条件・時点</small>${IC.down}</summary>
<dl class="pvg-evl">
<div><dt>根拠</dt><dd class="pvg-srcs">${net.src.map(x => ext(x.url, x.name)).join('')}</dd></div>
<div><dt>条件</dt><dd><ul class="pvg-notes"><li>${prose(net.basis)}</li><li>会社全体の就航地です。機種・ベースごとの運航や、宿泊があるかどうかは示していません。</li><li>並びは地域ごと（写真のある都市を先に）。人気や便数の順ではありません。</li></ul></dd></div>
${held.size ? `<div><dt>載せていない空港</dt><dd><ul class="pvg-notes">${[...held].map(([why, names]) => `<li><b>${prose(why)}</b>${prose(names.join('・'))}</li>`).join('')}</ul></dd></div>` : ''}
<div><dt>時点</dt><dd><span>${esc(dateJa(net.at))}に公式の資料で確認</span></dd></div>
</dl></details>`;
  const pills = [['', 'すべて', n], ...net.regions.map(r => [r.key, r.label, r.n])].map(([key, label, k], i) =>
    `<button type="button" class="pvg-pill" data-pvg-rg="${key}" aria-pressed="${i ? 'false' : 'true'}">${esc(label)}<small>${k}</small></button>`).join('');
  const credits = placeCredits(list.map(d => [d.city, PLACE.primary(d.iata), d.iata]));
  return `<article class="pvg-card pvg-stay" id="pvg-stay"${pane(v.slug, 'overview stay')}>
${head(IC.stay, '就航地・ステイ')}
${base}
<div class="pvg-st-teaser">
<p class="pvg-askh">就航地の一部<small>地域ごとに順に。人気の順ではありません</small></p>
<ul class="pvg-cgrid pvg-cteaser">
${cityTeaser(list, net.regions).map(cityCard).join('\n')}
</ul>
<p class="pvg-st-more"><button type="button" class="pvg-btn pvg-btn-ghost" data-pvg-tab="stay">就航地をすべて見る（${n}空港）${IC.go}</button></p>
</div>
<div class="pvg-st-full">
<div class="pvg-st-bar">
<label class="pvg-st-find">${IC.find}<span class="pvg-vh">都市・空港コードで探す</span><input type="search" id="pvg-st-q" placeholder="都市・空港コード" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></label>
<div class="pvg-st-rg" role="group" aria-label="地域で絞る">${pills}</div>
</div>
<p class="pvg-st-n"><span><b data-pvg-stn>${n}</b>空港</span>${official}</p>
<ul class="pvg-cgrid" id="pvg-st-list">
${list.map(cityCard).join('\n')}
</ul>
<p class="pvg-quiet pvg-st-none" hidden>当てはまる就航地がありません。都市名か空港の3字で探せます。</p>
${evidence}
</div>
${credits}
</article>
<section class="pvg-card pvg-cd" id="pvg-city" data-pvg-pane="stay" aria-labelledby="pvg-cd-n" hidden>
<p class="pvg-cd-back"><button type="button" class="pvg-link" data-pvg-cityback>${IC.prev}就航地</button></p>
<div class="pvg-cd-top">
<div class="pvg-town-ph pvg-cd-ph" data-cd="ph" data-sizes="(min-width: 1100px) 480px, (min-width: 760px) 44vw, 92vw"></div>
<div class="pvg-cd-b">
<p class="pvg-city-k"><small data-cd="country"></small><i class="pvg-code3" data-cd="iata"></i><span class="pvg-city-t" data-cd="seasonal" hidden>季節運航</span></p>
<h3 class="pvg-cd-n" id="pvg-cd-n" tabindex="-1" data-cd="name"></h3>
<p class="pvg-town-s" lang="en" data-cd="en"></p>
<p class="pvg-quiet pvg-cd-note">${esc(v.name)}の公式の就航地です。あなたの機種・ベースからの運航や宿泊があるとは限りません。</p>
<p class="pvg-cd-links"><a class="pvg-link" data-cd="maps" href="https://www.google.com/maps" target="_blank" rel="noopener">Google マップで見る${IC.out}</a>${official}</p>
<p class="pvg-cd-cr" data-cd="credit" hidden></p>
</div>
</div>
<div class="pvg-cd-sec">
<h4 class="pvg-askh">ホテル・レストラン・場所</h4>
${live('hotels', { airline: v.slug, stay: '', city: '' })}
</div>
</section>`;
}
/* 「◯◯のこと、ひとつ教えて。」── 質問の名前まで見せる。
   集まった回答は、話題の上に1つの欄でまとめて出す（3人そろった項目だけ。件数はサーバーの答え）。
   話題ごとに欄を分けると、回答のある話題だけ質問の並びが下がり、列がそろわなくなる。
   札の数は質問の数。回答の数ではない。 */
const ROSTER = ['work', '勤務', WORK_ASK];
const ASK_FIRST = 4;                               // 広い箱で、話題ごとに最初から見せる質問の数（pv-glance.css の nth-child と同じ）
/* 話題の札 ── 絵（色に頼らない目印）→ 話題の名前 → 小さい字（補足・質問の数）。
   「質問 N問」は、この話題で答えられる質問の数（＝ 下に並ぶ行の数）。集まった回答の数ではない。
   回答の数は札に書かない（話題ごとの数はサーバーに無い。在るのは「集まった回答」の欄の、3人そろった項目だけ）。 */
const TOPIC_IC = { work: IC.sheetRoster, taxi: IC.sheetTaxi, 'staff-travel': IC.sheetStaffTravel, upgrade: IC.sheetUpgrade };
const TOPIC_NAME = { taxi: ['通勤・タクシー'], 'staff-travel': ['Staff Travel', '社員向け航空券'] };
const topicHead = (icon, name, meta) => `<span class="pvg-ico" aria-hidden="true">${icon}</span><span class="pvg-tp"><span class="pvg-tp-n">${esc(name)}</span><span class="pvg-tp-m">${meta}</span></span>`;
function askCard(v) {
  const groups = [ROSTER, ...TOPICS].map(([id, title, list]) => {
    if (!TOPIC_IC[id]) throw new Error(`askCard: 話題「${id}」の絵が無い（TOPIC_IC に足す）`);
    const [name = title, gloss = ''] = TOPIC_NAME[id] || [];
    return [id, name, gloss, list];
  });
  const stay = networkOf(v.slug) ? `<a class="pvg-topic pvg-topic-a" href="#pvg-stay">${topicHead(IC.stay, 'ホテル・レストラン', '就航地ごと・パイロット限定')}${IC.next}</a>` : '';
  const keys = [...new Set(groups.flatMap(([, , , list]) => list.map(a => a[0])))];
  /* タブを持つページ：見出しの横から項目の一覧（「情報を追加」の面）を開ける。通勤・タクシーの質問はその面の中で答える。 */
  const add = tabbed(v.slug) ? `<button type="button" class="pvg-link" data-pvc-open="list">項目の一覧から足す${IC.go}</button>` : '';
  /* 見出しは2つのかたまり（「…のこと、」｜「ひとつ教えて。」）。狭い画面で折れるのは、そのあいだだけ（pv-glance.css）。
     あいだに字も空白も改行も置かない ── 置くと、見出しの字が変わる。 */
  return `<article class="pvg-card pvg-askc"${pane(v.slug, 'overview')}>
${head(IC.ask, `<span>${esc(v.name)}のこと、</span><span>ひとつ教えて。</span>`, add)}
<p class="pvg-quiet">1問だけでも保存できます。匿名で、3人そろった項目から会社ページに出ます。</p>
<div class="pvg-got"><p class="pvg-askh">集まった回答</p>${live('fact', { airline: v.slug, keys: keys.join(','), entry: 'give' })}</div>
<div class="pvg-topics">
${groups.map(([id, name, gloss, list]) => `<details class="pvg-topic" data-topic="${id}">
<summary>${topicHead(TOPIC_IC[id], name, `${gloss ? `<span class="pvg-tp-g">${esc(gloss)}</span>` : ''}<span class="pvg-tp-q">質問 ${list.length}問</span>`)}${IC.down}</summary>
<div class="pvg-body">
${asks(v.slug, list, '')}${list.length > ASK_FIRST ? `
<button type="button" class="pvg-link pvg-askmore" data-pvg-askmore>ほか${list.length - ASK_FIRST}問${IC.down}</button>` : ''}
</div>
</details>`).join('\n')}
${stay}
</div>
</article>`;
}

/* 口コミのタブの本文。見出しと件数の置き場はここ、分類6枚と一覧を描くのは airline-reviews-ui.js（mountGlance）。
   会員の投稿と、公開情報からの引用を、別々に数える。数字は出荷時「—」（引用が0件なら、その言葉ごと出さない）。 */
const reviewsList = v => `<article class="pvg-card pvg-rvl" data-pvg-pane="reviews">
${head(IC.reviews, '口コミ', '会員の投稿 <b data-pvg-n="posts">—</b> 件<span data-pvg-quotes hidden>・公開情報からの引用 <b data-pvg-n="quotes">—</b> 件</span>')}
<div id="pvg-reviews-host"></div>
</article>`;

/* ── 1社ぶん ────────────────────────────────────────── */
function glance(v) {
  const island = JSON.stringify({ airlines: Object.fromEntries(GLANCE.map(s => { const o = viewOf(s); return [s, { ja: o.name, color: o.color }]; })) })
    .replace(/</g, () => '\\u003c');
  return `<section class="pvg" data-tab-section="overview" data-slug="${v.slug}" style="--pvg-c:${esc(v.color)};--pvg-n:${AXIS / 1000}" aria-label="${esc(v.name)}の給与・勤務・待遇・暮らし">
<div class="pvg-more-grid"${pane(v.slug, 'overview')}>
${companyCard(v)}
</div>
<div class="pvg-payrow"${pane(v.slug, 'overview pay reviews')}>
${payCard(v)}
${reviewsCard(v)}
</div>
<div class="pvg-more-grid pvg-g-jobs"${pane(v.slug, 'overview')}>
${jobsCard(v)}
</div>
<div class="pvg-top"${pane(v.slug, 'overview pay work life')}>
<div class="pvg-trio">
${workCell(v)}
${benCell(v)}
${livingCell(v)}
</div>
</div>
<div class="pvg-more-grid pvg-g-st"${pane(v.slug, 'overview stay')}>
${stayCard(v)}
${askCard(v)}
</div>
<div id="pvg-revcats"${pane(v.slug, 'reviews')}></div>${tabbed(v.slug) ? '\n' + reviewsList(v) : ''}
<script type="application/json" id="crc-data">${island}</script>
</section>`;
}

/* ── 差し込み ───────────────────────────────────────── */
const once = (html, needle, what) => {
  const i = html.indexOf(needle);
  if (i < 0 || html.indexOf(needle, i + 1) >= 0) throw new Error(`${what} が1回だけ見つからない（${needle.slice(0, 50)}）`);
  return i;
};
/* 管理ブロックを置く。在れば中身だけ差し替え、無ければ at(html) の位置へ入れる */
function block(html, name, inner, at) {
  const open = `<!--${name}-->`, close = `<!--/${name}-->`, text = `${open}\n${inner}\n${close}`;
  const a = html.indexOf(open);
  if (a >= 0) {
    const b = html.indexOf(close, a);
    if (b < 0) throw new Error(`${close} が無い`);
    return html.slice(0, a) + text + html.slice(b + close.length);
  }
  const i = at(html);
  return html.slice(0, i) + text + '\n' + html.slice(i);
}
/* 管理ブロックを「決まった相手の直前」へ置く。すでに別の所に在れば、そこから外して置き直す（何度流しても同じ）。
   ⚠️ 左メニューの道具（patch-side-nav.mjs）は、自分の <link> を </head> の直前・app-nav.js を </body> の直前へ
      必ず置き直す。こちらがその後ろへ部品を置くと、互いに相手の置き場所を「食い違い」と数え続ける
      （2026-10-08、主要5社が `patch-side-nav.mjs --check` で赤くなっていた。画面は何も変わらない）。
      だから部品は、あちらの塊の**直前**に置く。 */
function blockBefore(html, name, inner, at) {
  const open = `<!--${name}-->`, close = `<!--/${name}-->`, text = `${open}\n${inner}\n${close}\n`;
  const a = html.indexOf(open);
  if (a >= 0) {
    const b = html.indexOf(close, a);
    if (b < 0) throw new Error(`${close} が無い`);
    let e = b + close.length;
    if (html[e] === '\n') e++;
    html = html.slice(0, a) + html.slice(e);
  }
  const i = at(html);
  return html.slice(0, i) + text + html.slice(i);
}
const BOX = '<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">';
/* 開きタグの位置から、対になる </div> の直後まで */
function divEnd(html, i) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) return m.index + 6; }
  throw new Error('閉じていない <div>');
}
/* ── 古い節の台帳（2026-10-08 オーナーのご指示）────────────────
   管理ブロックより下に残っていた、作り直す前のページの節。1行 ＝ 1種類。見出しの言葉（か id）で掴む。
     state  merged … 同じ話が新しい部品に在る（to ＝ その置き場）。古い節は外す
            drop   … 要らない（to ＝ 代わりの入口）。古い節は外す
            keep   … 残す（要確認。理由は why）
   ★ merged と drop の節は、作り直すたびに HTML から外す。CSS で隠すのではない ＝ 新旧の2か所に同じ話が出ない。
     運ぶのは「話」であって「字」ではない：古い節の字は資料で確かめていないものが多かった（古い機数・訓練地・
     退職年齢・「数百倍」の倍率）。新しい部品に出るのは台帳の値だけ。
   ★ この表に無い節がページの下に在ったら、止める（黙って残さない・黙って消さない）。節を足したら、ここに1行足す。
   ⚠️ 何度流しても同じ。写しを作らない（assert-airline-glance.mjs はこの表を import して使う）。 */
export const LEGACY = [
  { name: '会社が公表している金額（出どころの表）', id: 'kyuyo-konkyo', state: 'merged', to: '給与の1枚の「この金額は誰の・何を含んだ・いつの金額か」（住所の #kyuyo-konkyo もそこ）' },
  { name: '◯◯について', h2: /について$/, state: 'merged', to: '会社の1枚の紹介文（台帳の項目から組み立てる）' },
  { name: 'フライト環境・路線・機材', h2: /フライト環境|路線・機材/, state: 'merged', to: '会社の1枚（機材・路線や就航地の数）／ステイ先（公式の就航地の一覧）' },
  { name: '訓練・昇格・審査', h2: /訓練・昇格|訓練・審査/, state: 'merged', to: '勤務（会社が公表している条件）／募集' },
  { name: '福利厚生・待遇', h2: /福利厚生/, state: 'merged', to: '待遇（会社が公表している条件）' },
  { name: '募集要項・採用情報', h2: /募集要項|採用情報/, state: 'merged', to: '募集の1枚（会社の募集ページへの入口つき）' },
  { name: '他社の年収のカード', h2: /と他社の比較|他社との比較/, state: 'drop', to: '社名の横の「他社と比較」' },
  { name: '2社の比較表', h2: /比べられるところだけ|ANA vs JAL パイロット年収 詳細比較表/, state: 'drop', to: '社名の横の「他社と比較」' },
  /* ★2026-10-09 ANA だけに在った錠前つきの節。金額は1つも入っておらず（「機種ごとの金額は出していません」）、
     中身は資料で確かめていない機材の配置の話だった。残すと、給与のタブに昔の形の錠前（橙の四角いボタン）が
     新しい Give & Get と並んで出る ＝ 先行5社で形が1つにならない。錠前の箱ごと外す（dropLegacy）。 */
  { name: '機種別・路線別の年収差（錠前つき）', h2: /年収差/, state: 'drop', to: '会社の1枚の機材（台帳の機数）。機種ごとの金額は会社が公表しておらず、当サイトも出していない' },
  /* ★2026-10-09 オーナーの判断「節ごと外そう」。それまでは残して、台帳と食い違う答えだけ直していた。
     画面から外すので、検索向けの印（JSON-LD の FAQPage）も一緒に外す（dropFaq）── 画面に無い質問と答えを
     検索エンジンにだけ渡さない。gen-faq.mjs はタブを持つ会社ページ（TABBED）を飛ばす ＝ 流しても戻らない。 */
  { name: 'よくある質問', h2: /よくある質問/, state: 'drop', to: '置かない（オーナーの判断）。同じ話は、給与の1枚・募集の1枚・勤務と待遇の板に、資料で確かめた値で出ている' },
];
/* 残す節（keep）を先に当てる ── 「◯◯についてよくある質問」のような見出しを、外す側の行が先に掴まないように */
const legacyHit = (r, h2, tag) => (r.id ? new RegExp('\\bid="' + r.id + '"').test(tag) : r.h2.test(h2));
const legacyOf = (h2, tag) => LEGACY.find(r => r.state === 'keep' && legacyHit(r, h2, tag)) || LEGACY.find(r => legacyHit(r, h2, tag));
/* 外す節の見出し（検査が「ページに残っていない」ことを見るのに使う） */
export const DROP_H2 = new RegExp(LEGACY.filter(r => r.state !== 'keep' && r.h2).map(r => r.h2.source).join('|'));
/* 節のすぐ前に在る、人が書いた目印（<!-- 年収 --> <!-- ▼ PV-BASIS … -->）。管理ブロックの印（<!--NAME--> ＝ 空白なし）は掴まない */
const NOTE_BEFORE = /(?:\s*<!-- (?:(?!-->)[\s\S])*?-->)+\s*$/;
const NOTE_AFTER = /^\s*<!-- [^>]*\/PV-BASIS[^>]*-->/;
/* 中身の無い錠前の箱は、前に付いた覚え書きごと外す（新しい部品より下だけ）。
   節を外したあとに空の箱が残ると、古い橙の札だけが画面に出る ＝ 同じページに形の違う Give & Get が2つ。
   何度流しても同じ（空の箱が無ければ何もしない）。切り口の整え方は dropLegacy と同じ。 */
function dropEmptyGate(html) {
  const MARK = '<!--/PV-GLANCE-->';
  for (;;) {
    const end = html.indexOf(MARK);
    if (end < 0) return html;
    const from = end + MARK.length;
    const m = /<div class="premium-gate[^>]*>(?:\s*<!--(?:(?!-->)[\s\S])*?-->)*\s*<\/div>(?:<!--[^>]*\/premium-gate[^>]*-->)?/.exec(html.slice(from));
    if (!m) return html;
    let a = from + m.index;
    const b = a + m[0].length, before = NOTE_BEFORE.exec(html.slice(from, a));
    if (before) a = from + before.index;
    html = html.slice(0, a).replace(/\s*$/, () => '') + '\n\n' + html.slice(b).replace(/^\s*\n/, () => '');
  }
}
/* 「よくある質問」を外すときの後始末（タブを持つ会社ページだけ。何度流しても同じ）。
   1) gen-faq.mjs の管理ブロック（<!--PV-FAQ-->…<!--/PV-FAQ-->）は、目印ごと外す。
      中の節だけ dropLegacy に外させると、空の目印が2つ残る。
   2) JSON-LD の FAQPage を外す。ほかの型（BreadcrumbList・Article）と同じ配列に入っているので、
      FAQPage の1つだけを抜いて書き直す。FAQPage だけのタグなら、タグごと外す。
      もう無ければ何もしない ＝ ほかの型の書き方を1文字も変えない。 */
const FAQ_BLOCK = /<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t\n]*/g;
function dropFaq(html) {
  html = html.replace(FAQ_BLOCK, () => '');
  return html.replace(/[ \t]*<script type="application\/ld\+json">([\s\S]*?)<\/script>[ \t]*\n?/g, (m, body) => {
    let json;
    try { json = JSON.parse(body); } catch { return m; }
    const arr = Array.isArray(json) ? json : [json];
    if (!arr.some(x => x && x['@type'] === 'FAQPage')) return m;
    const rest = arr.filter(x => !(x && x['@type'] === 'FAQPage'));
    if (!rest.length) return '';
    return m.replace(body, () => JSON.stringify(Array.isArray(json) ? rest : rest[0]));
  });
}
function dropLegacy(slug, html) {
  html = dropFaq(html);
  for (;;) {
    const end = html.indexOf('<!--/PV-GLANCE-->');
    let hit = null;
    for (const m of html.slice(end).matchAll(/<div class="glass p-8 fade-up"[^>]*>/g)) {
      const a = end + m.index, sec = html.slice(a, divEnd(html, a));
      const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(sec), title = h2 ? h2Text(h2[1]).trim() : '';
      const row = legacyOf(title, m[0]);
      if (!row) throw new Error(slug + ': 古い節の台帳（LEGACY）に無い節が、ページの下に在る（' + (title || '見出しなし') + '）');
      if (row.state !== 'keep') { hit = a; break; }
    }
    if (hit === null) return dropEmptyGate(html);
    let a = hit, b = divEnd(html, a);
    /* 錠前の箱がその節だけを包んでいるときは箱ごと外す（中を抜くと、空の箱と錠前の札だけが残る）。
       ★2026-10-09 箱と節のあいだに覚え書き（<!-- 機種別年収差 -->）が挟まっていても箱ごと。
         挟まっていた ANA では節だけが抜け、空の箱と古い錠前の札が残った。 */
    const gate = /<div class="premium-gate[^>]*>(?:\s*<!--(?:(?!-->)[\s\S])*?-->)*\s*$/.exec(html.slice(0, a)), shut = /^\s*<\/div>(?:<!--[^>]*\/premium-gate[^>]*-->)?/.exec(html.slice(b));
    if (gate && shut) { a = gate.index; b += shut[0].length; }
    const before = NOTE_BEFORE.exec(html.slice(0, a)), after = NOTE_AFTER.exec(html.slice(b));
    if (before) a = before.index;
    if (after) b += after[0].length;
    html = html.slice(0, a).replace(/\s*$/, () => '') + '\n\n' + html.slice(b).replace(/^\s*\n/, () => '');
  }
}
/* 副題：「—」の左（社名のもう1つの書き方。airline-base.js が読む）は今のページの字のまま運ぶ。
   右は台帳の言葉だけ（2026-10-08）── 「日本第2位」「日本最大」「国営」「同水準」のような、資料で確かめていない言い方を書かない。 */
function tagline(v) {
  const f = [...v.company.profile, ...v.company.scale];
  const al = f.find(x => x.key === 'alliance'), nat = f.find(x => x.key === 'national_airline');
  if (al) { const m = tail(al); return m ? m[1] + '加盟（' + m[2] + '）' : al.value + '加盟'; }
  if (nat) return nat.value;
  throw new Error(v.slug + ': 副題に出す台帳の項目（航空連合か位置づけ）が無い');
}
/* 左メニューの道具が書く2つの塊（patch-side-nav.mjs の HEAD_RE / JS_RE と同じ掴み方。行頭に錨を打つ）。
   <head> の側は、説明のコメント＋ pv-tokens.css / app-nav.css の <link>。本文の側は、説明のコメント＋ app-nav.js。 */
const NAV_HEAD = /^[ \t]*<!-- PV-NAV:(?:(?!-->)[\s\S])*?-->\n(?:[ \t]*<link rel="stylesheet" href="(?:\.\.\/)*(?:pv-tokens|app-nav)\.css">[ \t]*\n)+/m;
const NAV_JS = /^(?:<!-- PV-NAV:(?:(?!-->)[\s\S])*?-->\n)?[ \t]*<script src="(?:\.\.\/)*app-nav\.js"><\/script>[ \t]*\n/m;

export function build(slug, html) {
  const v = viewOf(slug);
  /* 1) 社名の行。h1 と、副題の「—」より左の字は、今のページのものを1文字も変えずに運ぶ（airline-base.js が読む）。
        副題の右は台帳の言葉（tagline）。 */
  const H0 = '<!--PV-HERO-->', H1 = '<!--/PV-HERO-->';
  let a = html.indexOf(H0), b;
  if (a >= 0) b = html.indexOf(H1, a) + H1.length;
  else { a = once(html, '<div class="hero-airline"', '社名の行'); b = once(html, BOX, '本文の箱'); }
  const old = html.slice(a, b);
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(old), sub = /<p class="text-muted[^"]*">([^<]*—[^<]*)<\/p>/.exec(old);
  if (!h1 || !sub) throw new Error(`${slug}: h1 か副題が読めない`);
  const heroText = `${H0}\n${hero(v, { h1: h1[1].trim(), sub: `${sub[1].split('—')[0].trim()} — ${esc(tagline(v))}` })}\n${H1}`;
  html = html.slice(0, a) + heroText + (old.startsWith(H0) ? '' : '\n\n') + html.slice(b);

  /* 2) 見た目（左メニューの <link> の塊の直前。あちらは </head> の直前に居続ける） */
  html = blockBefore(html, 'PV-GLANCE-HEAD', [...CSS, ...(tabbed(slug) ? [CONTRIB.css, STAY.css] : [])].map(f => `<link rel="stylesheet" href="${asset(f)}">`).join('\n'), h => {
    const m = NAV_HEAD.exec(h);
    if (!m) throw new Error(`${slug}: 左メニューの <link> の塊（PV-NAV）が無い`);
    return m.index;
  });
  /* 3) 本文の箱の先頭。そのあと、下に残っている古い節を台帳（LEGACY）のとおりに外す */
  html = block(html, 'PV-GLANCE', glance(v), h => once(h, BOX, '本文の箱') + BOX.length + 1);
  if (tabbed(slug)) html = dropLegacy(slug, html);
  /* 4) 部品の JS（口コミの部品より後 ＝ app-nav.js の塊の直前。あちらは </body> の直前に居続ける） */
  html = blockBefore(html, 'PV-GLANCE-JS', [...JS, ...(tabbed(slug) ? [CONTRIB.js, STAY.js] : [])].map(f => `<script src="${asset(f)}"></script>`).join('\n'), h => {
    const m = NAV_JS.exec(h);
    if (!m) throw new Error(`${slug}: app-nav.js の <script> が無い`);
    return m.index;
  });
  /* 5) 印。これが在るページだけ、星を実投稿だけで出す */
  html = html.replace(/<body\b[^>]*>/, m => (m.includes('data-pv-glance=') ? m : m.replace(/>$/, () => ' data-pv-glance="1">')));
  /* 6) 下に残っている古い節を、タブへ振り分ける（タブを持つページだけ。持たないページからは印を外す）。
        見るのは管理ブロックより後ろの、いちばん外側の節だけ。印は開きタグに1つ ＝ 何度流しても同じ。 */
  const end = html.indexOf('<!--/PV-GLANCE-->');
  html = html.slice(0, end) + html.slice(end).replace(/<div class="glass p-8 fade-up"([^>]*)>/g, (m, attrs, at, rest) => {
    const bare = attrs.replace(/ data-pvg-pane="[^"]*"/, () => '');
    if (!tabbed(slug)) return `<div class="glass p-8 fade-up"${bare}>`;
    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(rest.slice(at, at + 4000));
    return `<div class="glass p-8 fade-up"${bare} data-pvg-pane="${oldPane(h2 ? h2Text(h2[1]) : '')}">`;
  });
  /* 錠前の箱（中の節を包んでいる）にも同じ印を付ける。付けないと、中の節を隠したタブに
     空の箱と錠前の札だけが残る（箱には高さの下限がある）。行き先は中の節と同じ。 */
  const end2 = html.indexOf('<!--/PV-GLANCE-->');
  html = html.slice(0, end2) + html.slice(end2).replace(/<div class="premium-gate([^"]*)"([^>]*)>/g, (m, cls, attrs, at, rest) => {
    const bare = attrs.replace(/ data-pvg-pane="[^"]*"/, () => '');
    if (!tabbed(slug)) return `<div class="premium-gate${cls}"${bare}>`;
    const stop = rest.indexOf('/premium-gate', at);
    const inside = rest.slice(at, stop < 0 ? at + 4000 : stop);
    const names = [...new Set([...inside.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(x => oldPane(h2Text(x[1]))))];
    return `<div class="premium-gate${cls}"${bare} data-pvg-pane="${names.join(' ') || 'overview'}">`;
  });
  return html;
}

/* ── 実行 ───────────────────────────────────────────── */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), check = args.includes('--check');
  const only = args.filter(a => !a.startsWith('--'));
  const bad = only.filter(s => !GLANCE.includes(s));
  if (bad.length) { console.error(`❌ 対象外の会社: ${bad.join(', ')}（対象は ${GLANCE.join(' / ')}）`); process.exit(1); }
  let stale = 0, wrote = 0;
  for (const slug of only.length ? only : GLANCE) {
    const file = path.join(ROOT, pageOf(slug));
    const before = fs.readFileSync(file, 'utf8'), after = build(slug, before);
    if (after === before) continue;
    if (check) { console.error(`❌ ${pageOf(slug)} が古い（node gen-airline-glance.mjs を流す）`); stale++; continue; }
    fs.writeFileSync(file, after);
    console.log(`✎ ${pageOf(slug)}`);
    wrote++;
  }
  if (stale) process.exit(1);
  if (!wrote) console.log('✓ 変更なし');
}
