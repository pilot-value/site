/* career.html の本文を書く（2026-10-03・2026-10-04 に深い画面を足した）。
 * 入口・会社の概要・2社の比較を1枚に入れる。エティハド航空だけ、その先（タブ・その数字自身の詳細・
 * 就航地・カード保存の器）まで持つ ── どの会社が深い画面を持つかは下の DEEP の1か所。
 *
 *   node gen-career.mjs           career.html の <!--PV-CAREER-->…<!--/PV-CAREER--> と ?v= を書く
 *   node gen-career.mjs --check   書かずに比べるだけ（古ければ 1 で終わる）
 *
 * ★数字を手で書かない。出どころはここに並べたものだけ。
 *     年収の推定        … pv-airline-view.mjs の viewOf().pay.<職位>.est（正本は salary-data.mjs の SALARY の avg）
 *     会社が公表した額  … salary-basis.mjs の BASIS（figures()）
 *     家賃              … pv-airline-view.mjs の viewOf().living（1か月あたり）と rentCell()
 *     写真              … airline-photos.mjs
 *     就航地            … career-facts.mjs の FACTS（出どころつきの台帳）
 *     質問の鍵          … pv-conditions.mjs の QUESTIONS（入口の先。無い鍵なら止まる）
 *     QR                … career-qr.mjs（カード保存の器に、公開ページの住所を行列で置く）
 *   社名は SALARY の ja・色と略号は airlines-meta.js。
 *
 * ★大きい額と棒は、5社とも・機長も副操縦士も「推定年収」（2026-10-06 オーナー判断）。
 *     読み口は会社ページと同じ pv-airline-view.mjs の1か所 ── ここで決め直さない（2つの画面がずれない）。
 *     年収を「確認中」と出さない。概要・比較・詳細・カードの全部が cell() の答えだけを使う。
 *   ⚠️ 会社が公表した額（求人の上限・目標年収・下限・乗員全体の平均）を、棒にも大きい額にも入れない。
 *      置き場は「会社が公表している金額」の一覧だけ（pub()）。誰の額か（内訳の名前）・何の額か（種類）・
 *      額・出どころを一緒に出す。推定と公表額を同じ目盛に並べない。
 *   ⚠️ 上限（max_…）を平の額として出さない。「〜」・斜線の印（.cr-hatch）・「上限」の字の3つが必ず一緒に出る
 *      （種類の名前に「上限」の字が無ければ止まる）。
 *   ⚠️ 推定と公表額の差を埋めない（エバー航空の副操縦士は 推定 ¥1,590万・会社の公表は 約1,589万円超 のまま）。
 *   ⚠️ 推定の根拠を作らない。台帳に根拠が記録してある職位（est.backed）だけ 根拠・算出方法・時点 を出し、
 *      無い職位は1行だけ（EST_PLAIN）。幅・件数・時点を足さない。
 *
 * ★家賃は1か月あたり。街どうしを同じ目盛に並べない（比較では、会社ごとの箱に その街の物差し・出どころ・時点 を付ける）。
 *
 * ★主表示には目印を付ける（5社とも）。カード保存はこの DOM の字を読む。
 *     data-main="cap|fo"      額（textContent が画面の額そのまま）
 *     data-main-tag="cap|fo"  札（「推定」）
 *     data-main-bar="cap|fo"  棒（style の --w が共通目盛での長さ）
 *   ⚠️ 概要の中にだけ付ける。比較・詳細には付けない（1社の中で1つずつ）。
 *   ⚠️ 公表額の一覧には付けない（カードの大きい額は推定だけ）。
 *
 * ★生きた欄（.crl）は空で出荷する。数・星・件数をここで書かない（career-live.js がサーバーの答えで埋める）。
 *
 * ★check-salary.mjs が読める形で書く。額の行は「社名 → 職位 → 金額」をこの順に、
 *   間に数字を挟まずに置く（あちらの GAP は24個まで・数字で切れる。「A320」は額の後ろ）。
 *   概要では社名を・比較では職位を、画面上は隠している（読み上げには残る）。
 *   ⚠️ 行の中に「手取」「月額」「税引」「パッケージ」などの語を足さない。
 *      あちらはその語が近くにある金額を「年額ではない」とみなして**黙って照合から外す**。
 *
 * ★画像ファイルを読まない。assert-generated.mjs は画像の無いコピーの中で流す。
 *   大きさは airline-photos.mjs の w / h から書く。
 *
 * ★何度流しても同じ。String.replace は関数形（$ を素通しする）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, figures, fxNote } from './salary-basis.mjs';
import { viewOf, AXIS as VIEW_AXIS, width, rentCell } from './pv-airline-view.mjs';
import { PHOTOS, primary, needsCredit, src as photoSrc, SMALL_W } from './airline-photos.mjs';
import { FACTS, atText, introText, valueText } from './career-facts.mjs';
import { primary as placeShot, needsCredit as placeNeedsCredit, src as placeSrc, SMALL_W as PLACE_SMALL_W } from './place-photos.mjs';
import { QUESTIONS } from './pv-conditions.mjs';
import { qrMatrix } from './career-qr.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export const PAGE = 'career.html';
/* 先行5社。並びは入口のタイルの順。 */
export const FIVE = ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air'];
/* 深い画面（タブ・詳細・就航地）を持つ会社。ほかは段1の概要のまま。 */
export const DEEP = ['etihad'];
/* 比較を社名なしで開いたときの2社。 */
export const PAIR = ['jal', 'cathay-pacific'];
export const ROLES = [['cap', '機長'], ['fo', '副操縦士']];
/* 概要のタブ。住所は top だけ tab= を持たない。 */
export const TABS = [['top', '概要'], ['work', '勤務・待遇'], ['life', '暮らし・ステイ']];
/* その数字自身の詳細（d=cap-est・d=fo-est）。在るのは推定だけ ── 公表額は一覧（pub()）が持つ。 */
export const KINDS = [['est', '推定年収']];
/* 「会社が公表している金額」に並べる区分。訓練生は入れない（年収の比較ではない）。 */
const PUB_RANKS = ['cap', 'fo', 'crew'];
/* 鍵の名前の末尾で決まる言い添え（年収の下限・手当の下限）。 */
const openEnd = key => (/_over$/.test(key) ? '超' : /_from$/.test(key) ? 'から' : '');
/* 求人の上限（max_…）は、額の頭に「〜」を付ける（平の額に見せない）。斜線の印と「上限」の字も一緒に出す。 */
const upTo = key => (/^max_/.test(key) ? '〜' : '');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yen = m => `¥${m.toLocaleString('en-US')}万`;

/* 色と略号は airlines-meta.js（ブラウザ用の即時関数。window を渡して中身だけ借りる）。 */
const META = (() => {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'airlines-meta.js'), 'utf8'))(win);
  return win.PV_AIRLINES;
})();
const meta = slug => {
  const a = META.find(x => x.file === `airlines/${slug}.html`);
  if (!a) throw new Error(`${slug}: airlines-meta.js に無い`);
  return a;
};
const color = slug => {
  const c = meta(slug).color;
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`${slug}: airlines-meta.js に色が無い`);
  return c;
};
const code = slug => {
  const c = meta(slug).code;
  if (!/^[A-Z0-9]{2,4}$/.test(c || '')) throw new Error(`${slug}: airlines-meta.js に略号が無い`);
  return c;
};
const name = slug => SALARY[slug].ja;

/* ── 会社ページと同じ読み口（年収の推定・家賃）── 5社ぶんを1回だけ読む ──────────── */
const VIEW = Object.fromEntries(FIVE.map(s => [s, viewOf(s)]));

/* ── 棒に出す1マス ─────────────────────────────────────────────── */
/* 主表示の1マス ＝ 推定年収。5社とも・どの職位も同じ決め方（会社ページと同じ読み口）。
   ⚠️ 会社が公表した額をここへ入れない（置き場は pub() の一覧だけ）。「確認中」を返さない。 */
export function cell(slug, rank) {
  const e = VIEW[slug]?.pay?.[rank]?.est;
  if (!e || !(e.man > 0)) throw new Error(`${slug}/${rank}: 推定年収が無い（pv-airline-view.mjs）`);
  if (e.man !== SALARY[slug]?.[rank]?.avg) throw new Error(`${slug}/${rank}: 推定が SALARY の avg と違う`);
  if (e.yen !== yen(e.man)) throw new Error(`${slug}/${rank}: 推定の字が標準の円表記ではない ──「${e.yen}」`);
  return { man: e.man, text: e.yen, tag: TIERS.estimate.ja, sub: '', look: '' };
}

/* 目盛の右端。会社ページと同じ目盛（0 から始める）。棒が1本でもはみ出すなら止まる。 */
export const AXIS = VIEW_AXIS;
for (const s of FIVE) for (const [r] of ROLES) {
  if (cell(s, r).man > AXIS) throw new Error(`${s}/${r}: 推定が目盛（${AXIS}）からはみ出す`);
}

/* 棒の長さは width()（目盛に対する％。会社ページと同じ関数）。mark は目印（概要の中だけ）。 */
const fill = (c, extra, mark) => `<i class="cr-fill${extra ? ' ' + extra : ''}"${mark ? ` data-main-bar="${mark}"` : ''} style="--w:${width(c.man)}"></i>`;
/* 札（「推定」）。 */
const kline = (c, mark) => `<span class="cr-tag"${mark ? ` data-main-tag="${mark}"` : ''}>${esc(c.tag)}</span>`;

const axis = () => `<div class="cr-axis" aria-hidden="true"><span>0</span><span>${yen(AXIS / 2)}</span><span>${yen(AXIS)}</span></div>`;

/* 概要の1マス（大きい数字）。社名は画面では隠してある（読み上げと check-salary.mjs のため）。 */
function num(slug, rank, label) {
  const c = cell(slug, rank);
  return `<div class="cr-num" data-role="${rank}"><span class="cr-vh">${esc(name(slug))}</span><span class="cr-num-r">${label}</span><b class="cr-num-v" data-main="${rank}">${esc(c.text)}</b><span class="cr-num-k">${kline(c, rank)}</span></div>`;
}

/* 概要の小さい棒。数字は上の2マスが持っているので、ここは形だけ（読み上げない）。 */
function mini(slug) {
  return `<div class="cr-mini" aria-hidden="true">
${ROLES.map(([r, l]) => `<div class="cr-mini-row"><span class="cr-mini-l">${l}</span><span class="cr-track">${fill(cell(slug, r), 'is-' + r, r)}</span></div>`).join('\n')}
${axis()}
</div>`;
}

/* ── 写真 ───────────────────────────────────────────────────────── */
function img(p, alt, sizes, eager) {
  return `<img src="${photoSrc(p)}" srcset="${photoSrc(p, true)} ${SMALL_W}w, ${photoSrc(p)} ${p.w}w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'} decoding="async"/>`;
}
const shot = slug => {
  const p = primary(slug);
  if (!p) throw new Error(`${slug}: airline-photos.mjs に写真が無い`);
  return p;
};
const photo = (slug, sizes, eager) => img(shot(slug), `${name(slug)}の ${shot(slug).aircraft}`, sizes, eager);
const badge = slug => `<span class="cr-code">${esc(code(slug))}</span>`;

/* 入口のいちばん上の1枚。各社の1枚目とは別の写真を使う（同じ写真が2回出ない）。 */
const LEAD_SLUG = 'etihad';
const LEAD = (PHOTOS[LEAD_SLUG] || []).find(p => p.file === 'etihad-b787');
if (!LEAD) throw new Error('airline-photos.mjs に入口の写真（etihad-b787）が無い');

/* 作者名とライセンス名を示すことが使う条件の写真にだけ出す。
   items = [[slug, 写真], …]。withName のときは社名を頭に付ける
   （同じ社の写真が2枚あるときだけ、機種も添えて見分けられるようにする）。 */
function credits(items, withName, shown) {
  /* 加工の中身が全部同じなら、頭で1回だけ言う（1枚ごとに繰り返さない）。 */
  const need = items.filter(([, p]) => needsCredit(p));
  const same = need.length && need.every(([, p]) => p.changes === need[0][1].changes) ? need[0][1].changes : '';
  const list = need.map(([slug, p]) => {
    const twice = items.filter(([s]) => s === slug).length > 1;
    const label = withName ? `${esc(name(slug))}${twice ? ' ' + esc(p.aircraft) : ''} ` : '';
    const hide = shown && !shown.includes(slug) ? ' hidden' : '';
    return `<span class="cr-credit" data-airline="${slug}"${hide}>${label}<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>／<a href="${esc(p.licence_url)}" target="_blank" rel="noopener">${esc(p.licence)}</a>${same ? '' : `（${esc(p.changes)}）`}</span>`;
  });
  return list.length ? `<p class="cr-credits">写真${same ? `（${esc(same)}）` : ''} ${list.join(' ')}</p>` : '';
}

/* ── 住所と記号 ─────────────────────────────────────────────────── */
const href = {
  home: PAGE,
  airline: s => `${PAGE}?airline=${s}`,
  tab: (s, t) => `${PAGE}?airline=${s}` + (t === TABS[0][0] ? '' : `&amp;tab=${t}`),
  stay: (s, iata) => `${PAGE}?airline=${s}&amp;stay=${iata}`,
  detail: (s, d) => `${PAGE}?airline=${s}&amp;d=${d}`,
  compare: (a, b) => `${PAGE}?view=compare` + (a ? `&amp;a=${a}&amp;b=${b}` : ''),
  card: (a, b) => `${PAGE}?view=card&amp;a=${a}` + (b ? `&amp;b=${b}` : ''),
};
const ic = d => `<svg class="cr-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = { back: ic('M15 6l-6 6 6 6'), go: ic('M5 12h14M13 6l6 6-6 6'), down: ic('M6 9l6 6 6-6'), swap: ic('M7 8h11l-3-3M17 16H6l3 3'), next: ic('M9 6l6 6-6 6') };
const back = () => `<a class="cr-back" href="${href.home}" data-go>${IC.back}航空会社を選ぶ</a>`;

/* 生きた欄。空で出荷する（career-live.js / career-stay.js がサーバーの答えで埋める）。
   attrs は data- の名前と値。値はここで書く英数字だけ（鍵・コード）。 */
const live = (kind, attrs = {}) => `<div class="crl" data-live="${kind}"${Object.entries(attrs).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')} data-state="idle"><span class="crl-ph">—</span></div>`;
/* 中身を次に入れる箱（公表されている待遇・拠点の街）。 */
const box = id => `<div class="cr-box" data-box="${id}"><span class="cr-ph">—</span></div>`;

/* ── 会社が公表している金額（5社とも）─────────────────────────────
   ★推定とは別の情報。1つの額ごとに 誰の額か（内訳の名前）・何の額か（種類）・額・出どころ を出す。
   ★ここに棒を描かない・目盛に載せない（推定の棒と同じ物差しで比べる額ではない）。
   ★上限（max_…）は「〜」・斜線の印・「上限」の字の3つが必ず一緒に出る。 */
function pubGroups(slug) {
  const out = [];
  for (const rank of PUB_RANKS) {
    const R = BASIS[slug]?.[rank];
    for (const g of R?.groups || []) {
      const figs = figures(slug, rank).filter(f => !f.training && f.group === g.name);
      if (figs.length) out.push({ tier: R.tier, g, figs });
    }
  }
  return out;
}

const srcRow = s => `<li>${esc(s.pub)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><span>適用時点：${esc(s.as_of)} ／ 確認日：${esc(s.accessed)}</span></li>`;

/* tag は見出しの段（概要では h2・比較では社名の下なので h3）。 */
function pub(slug, tag) {
  const B = BASIS[slug] || {};
  const groups = pubGroups(slug);
  /* 公表が1つも無い会社は「公表なし」だけ。前提や出どころも出さない
     （台帳に残っているのは訓練生の募集の話で、ここに並べる額の説明ではない）。 */
  if (!groups.length) return `<div class="cr-pub">
<${tag} class="cr-h2">会社が公表している金額</${tag}>
<p class="cr-none">公表なし</p>
</div>`;

  const blocks = groups.map(({ tier, g, figs }) => {
    const rows = figs.map(f => {
      const up = upTo(f.key);
      if (up && !f.kind.includes('上限')) throw new Error(`${slug}: 上限なのに種類の名前に「上限」の字が無い ──「${f.kind}」`);
      if (!up && /上限/.test(f.kind)) throw new Error(`${slug}: 「上限」と名乗る額に「〜」が付かない ──「${f.kind}」`);
      const hatch = up ? '<i class="cr-hatch" aria-hidden="true"></i>' : '';
      const orig = f.cur === 'JPY' ? '' : ` <span class="cr-orig pv-no-cur">${upTo(f.key)}${f.cur} ${f.amount.toLocaleString('en-US')}${openEnd(f.key) ? ' ' + openEnd(f.key) : ''}</span>`;
      return `<div class="cr-fig${up ? ' is-max' : ''}"><dt>${hatch}${esc(f.kind)}</dt><dd><b>${esc(up + f.text + openEnd(f.key))}</b>${orig}</dd></div>`;
    }).join('\n');
    const leave = g.leave ? `\n<p class="cr-leave">${esc(g.leave)}</p>` : '';
    const req = g.req ? `\n<details class="cr-more"><summary>応募条件</summary><p>${esc(g.req)}</p></details>` : '';
    return `<div class="cr-grp">
<p class="cr-grp-k"><span class="cr-tag">${esc(TIERS[tier].ja)}</span> ${esc(g.name)}</p>
<dl class="cr-figs">
${rows}
</dl>${leave}${req}
</div>`;
  }).join('\n');

  const notes = (B.notes || []).filter(n => !/訓練生|採用予定/.test(n));
  /* secondary＝会社の公表ではない資料（報道など・推定の根拠）。「会社が公表している金額」の出どころではない。 */
  const srcs = (B.src || []).filter(s => !s.secondary && !/訓練生|自社養成/.test(s.name));
  const fx = B.cur && B.cur !== 'JPY' ? `\n<p class="cr-fx pv-no-cur">${esc(fxNote(B.cur))}</p>` : '';
  const noteHtml = notes.length ? `\n<ul class="cr-notes">\n${notes.map(n => `<li>${esc(n)}</li>`).join('\n')}\n</ul>` : '';
  const srcHtml = srcs.length ? `\n<ul class="cr-srcs pv-no-cur">\n${srcs.map(srcRow).join('\n')}\n</ul>` : '';
  const basis = noteHtml || fx || srcHtml
    ? `\n<details class="cr-more cr-basis"><summary>前提と出どころ</summary>${noteHtml}${fx}${srcHtml}\n</details>` : '';

  return `<div class="cr-pub">
<${tag} class="cr-h2">会社が公表している金額</${tag}>
${blocks}${basis}
</div>`;
}

/* ── 推定年収の説明 ─────────────────────────────────────────────
   ★台帳に根拠が記録してある職位（est.backed）だけ 根拠・算出方法・時点 を出す。
     無い職位は EST_PLAIN の1行だけ ── 根拠・幅・件数・時点をここで作らない。
   ★推定は機種ごとの額ではない（対象は「機種の指定なし」）。 */
export const EST_PLAIN = '当サイトの推定（公開情報からの推計）。根拠の資料はまだ記録していません。';
export const EST_TARGET = '機種の指定なし';
function estRows(slug, rank) {
  const e = VIEW[slug].pay[rank].est;
  if (!e.backed) return [['推定', esc(EST_PLAIN)]];
  for (const k of ['basis', 'method', 'asOf']) if (!e[k]) throw new Error(`${slug}/${rank}: 根拠つきの推定なのに ${k} が空（pv-airline-view.mjs）`);
  return [['根拠', esc(e.basis)], ['算出方法', esc(e.method)], ['時点', esc(e.asOf)]];
}
const facts = rows => `<dl class="cr-facts">
${rows.map(([k, v]) => `<div class="cr-fact"><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;
/* 概要の中の折り畳み（詳細の画面を持たない会社）。職位ごとに1かたまり。 */
function estNote(slug) {
  return `<details class="cr-more cr-est">
<summary>推定年収について</summary>
${ROLES.map(([r, l]) => `<p class="cr-est-r">${l}<span>${EST_TARGET}</span></p>
${facts(estRows(slug, r))}`).join('\n')}
</details>`;
}

/* ── 入口 ───────────────────────────────────────────────────────── */
function home() {
  const tiles = FIVE.map(s => `<a class="cr-tile" href="${href.airline(s)}" data-go style="--cr-co:${color(s)}">
<span class="cr-tile-p">${photo(s, '(min-width: 760px) 330px, 46vw', true)}${badge(s)}</span>
<span class="cr-tile-n">${esc(name(s))}</span>
</a>`).join('\n');
  return `<section class="cr-view cr-home" data-view="home">
<div class="cr-lead">
${img(LEAD, `${name(LEAD_SLUG)}の ${LEAD.aircraft}`, '(min-width: 1100px) 1040px, 100vw', true)}
<h1 class="cr-h1" tabindex="-1">次のキャリアを、<br/>選択する。</h1>
</div>
<div class="cr-tiles">
${tiles}
<a class="cr-tile cr-tile-cmp" href="${href.compare()}" data-go>
<span class="cr-tile-g" aria-hidden="true"><i></i><i></i></span>
<span class="cr-tile-n">航空会社を比較${IC.go}</span>
</a>
</div>
<p class="cr-else"><a class="cr-link" href="world-airlines.html">ほかの航空会社を見る${IC.go}</a></p>
${credits([[LEAD_SLUG, LEAD], ...FIVE.map(s => [s, shot(s)])], true)}
</section>`;
}

/* 「他社と比較」は、この会社を1社目に置いて開く。相手は既定の2社のうち、この会社でないほう。 */
const rival = slug => (slug === PAIR[0] ? PAIR[1] : PAIR[0]);

/* ── 概要（段1の4社） ───────────────────────────────────────────── */
function overview(slug) {
  if (DEEP.includes(slug)) return deep(slug);
  return `<section class="cr-view cr-co" data-view="airline" data-airline="${slug}" style="--cr-co:${color(slug)}" hidden>
<div class="cr-top">
${back()}
<a class="cr-btn" href="${href.compare(slug, rival(slug))}" data-go>他社と比較</a>
</div>
<div class="cr-cols">
<figure class="cr-hero">
${photo(slug, '(min-width: 900px) 500px, 100vw', false)}
${badge(slug)}
<h1 class="cr-h1 cr-hero-n" tabindex="-1">${esc(name(slug))}</h1>
</figure>
<div class="cr-pay">
<h2 class="cr-pay-h">年収</h2>
<div class="cr-nums">
${ROLES.map(([r, l]) => num(slug, r, l)).join('\n')}
</div>
${mini(slug)}
<p class="cr-tax">${esc(BASIS[slug].tax)}</p>
${estNote(slug)}
</div>
</div>
${pub(slug, 'h2')}
<p class="cr-else"><a class="cr-link" href="airlines/${slug}.html">口コミ・募集を見る${IC.go}</a></p>
${credits([[slug, shot(slug)]], false)}
</section>`;
}

/* ── 概要（DEEP の会社）── 写真 → タブ → パネル ───────────────── */
/* 額と棒の1行（推定年収）。行ぜんたいが、その数字自身の詳細への入口（数字も棒も同じ先へ行く）。 */
function bar(slug, rank, label) {
  const c = cell(slug, rank);
  return `<a class="cr-bar cr-bar-est" data-role="${rank}" href="${href.detail(slug, `${rank}-est`)}" data-go>
<span class="cr-bar-h"><span class="cr-vh">${esc(name(slug))}</span><span class="cr-bar-r">${label}</span><b class="cr-bar-v" data-main="${rank}">${esc(c.text)}</b><span class="cr-bar-k">${kline(c, rank)}</span>${IC.next}</span>
<span class="cr-track" aria-hidden="true">${fill(c, '', rank)}</span>
</a>`;
}

/* 話題ごとのカード（勤務・待遇）。答えの欄（生きた欄）と、その質問へ直接行く入口。
   ★質問の鍵をここに書き写さない。待遇アンケートの質問の一覧（pv-conditions.mjs）から、鍵の頭で拾う
     ── 質問が分かれたり名前が変わったりしても、入口の先が無くなることがない
     （2026-10-04、タクシーとクルーバスを別々の質問に分けた回に、書き写した鍵が3つ消えて生成が止まった）。
   入口の字は「何を答えるか」を名指しする短い名前（ASK）。無い鍵は、質問の文そのものを出す。 */
/* ★拾うのは質問が持つ話題の印（pv-conditions.mjs の topic）。鍵の頭では拾わない
     ── 2026-10-04 に足した4問（タクシー代の上限・機長昇格の条件3問）は鍵の頭が話題とそろっていないものがあり、
        頭で拾うと「機長昇格」に年数の1問しか出ない。印で拾えば、質問を足した側の1か所で決まる。 */
const TOPIC_DEFS = [
  ['taxi', '通勤タクシー・クルーバス', 'taxi'],
  ['staff-travel', '社員向け航空券', 'staff_travel'],
  ['upgrade', '機長昇格', 'upgrade'],
];
const ASK = {
  commuting_transport: '会社が用意・負担するか',
  commuting_transport_method: '提供の形',
  commuting_taxi_when: 'タクシーを使えるとき',
  commuting_taxi_where: 'タクシーを使える範囲',
  commuting_taxi_cost: 'タクシーの費用負担',
  commuting_bus_when: 'クルーバスを使えるとき',
  commuting_bus_cost: 'クルーバスの費用負担',
  staff_travel: '制度の有無',
  staff_travel_booking: '空席待ちか、確保できるか',
  staff_travel_cabin: '上位クラス',
  staff_travel_family: '家族が使えるか',
  staff_travel_standby_trips: '空席待ちの券の年間回数',
  staff_travel_standby_cost: '空席待ちの券の本人負担',
  staff_travel_standby_family: '空席待ちの券を使える人',
  staff_travel_confirmed_trips: '確保できる券の年間回数',
  staff_travel_confirmed_cost: '確保できる券の本人負担',
  staff_travel_confirmed_family: '確保できる券を使える人',
  commuting_taxi_cap: 'タクシー代の上限',
  upgrade_years: '機長昇格までの年数',
  upgrade_order: '昇格の順番の決まり方',
  upgrade_min_hours: '昇格に必要な総飛行時間',
  upgrade_min_tenure: '昇格に必要な在籍年数',
};
/* 質問が「情報を追加」の面のどの話題に入るか。pv-contrib.js の groupOfQ / usable と同じ決め方
   （2つで対。食い違うと、入口を押しても別の話題が開く ＝ assert-contrib.mjs が突き合わせる）。
   面で答えられない質問は '' ＝ 今までどおり質問の画面へ。 */
const ASK_TOPICS = ['taxi', 'staff_travel', 'upgrade'];
export function askGroup(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q || q.retired || !q.ja || !q.ja.label) return '';
  const ok = (q.kind === 'choice' || q.kind === 'multi') ? Array.isArray(q.choices) && q.choices.length > 0 : (q.kind === 'num' && !!q.num);
  if (!ok) return '';
  return ASK_TOPICS.includes(q.topic) ? q.topic : q.section === 'roster' ? 'roster' : q.section === 'career' ? 'career' : 'benefits';
}
export const TOPICS = TOPIC_DEFS.map(([id, title, tp]) => {
  const asks = QUESTIONS.filter(q => q.topic === tp && !q.retired).map(q => [q.id, ASK[q.id] || q.ja.label]);
  if (!asks.length) throw new Error(`話題 ${id}: 待遇アンケートに質問が1つも無い（pv-conditions.mjs。入口の先が無くなる）`);
  return [id, title, asks];
});

/* 質問の入口。会社ページの「情報を追加」の面を、その質問の前で開く（ログインなしで答えられる）。
   会社ページを持たない会社・面で答えられない質問は、今までどおり質問の画面へ。 */
const askHref = (slug, key) => (FIVE.includes(slug) && askGroup(key)
  ? `airlines/${slug}.html?add=${askGroup(key)}&amp;aq=${key}`
  : `airline-conditions.html?airline=${slug}&amp;q=${key}`);
function topic(slug, [id, title, asks]) {
  return `<article class="cr-topic" data-topic="${id}">
<h2 class="cr-h2">${title}</h2>
${live('fact', { airline: slug, keys: asks.map(a => a[0]).join(',') })}
<p class="cr-asks-h">匿名で答える</p>
<ul class="cr-asks">
${asks.map(([key, label]) => `<li><a class="cr-ask" href="${askHref(slug, key)}">${esc(label)}${IC.go}</a></li>`).join('\n')}
</ul>
</article>`;
}

/* 就航地（出どころつきの台帳）。「就航地」と呼ぶ ── 泊まるかどうかは台帳に無い。 */
function destinations(slug) {
  const list = FACTS[slug]?.destinations;
  if (!Array.isArray(list) || !list.length) throw new Error(`${slug}: career-facts.mjs に就航地が無い`);
  const seen = new Set();
  for (const d of list) {
    if (!/^[A-Z]{3}$/.test(d.iata || '') || !d.city_ja || !d.country_ja || !d.at || !d.src?.url || !d.src?.name) throw new Error(`${slug}: 就航地 ${d.iata} の形が違う（career-facts.mjs）`);
    if (seen.has(d.iata)) throw new Error(`${slug}: 就航地 ${d.iata} が2回ある（career-facts.mjs）`);
    seen.add(d.iata);
  }
  return list;
}
/* 出どころは、同じもの（同じ資料・同じ時点）を1回だけ言う。 */
function destSources(slug) {
  const out = [];
  for (const d of destinations(slug)) {
    if (!out.some(x => x.url === d.src.url && x.at === d.at)) out.push({ url: d.src.url, name: d.src.name, at: d.at });
  }
  return `<ul class="cr-srcs pv-no-cur">
${out.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><span>${esc(atText(s.at))} 時点</span></li>`).join('\n')}
</ul>`;
}

/* ── 会社・募集・公表されている待遇・拠点の街（DEEP の会社）────────────
   ★字も数字も career-facts.mjs（出どころつきの台帳）から機械で出す。ここで作文しない・数字を打たない。
   ★条件（cond_ja）のある数字は、条件の文と必ず一緒に出す。「◯◯時点」に出すのは at（as_of ではない）。
   見た目は career-sec.css（.cr-org*・.cr-job*・.cr-ben*・.cr-town*・.cr-rent*・.cr-sv*）。 */
const when = at => { const t = atText(at); return t ? (/日$|期$/.test(t) ? `${t} 時点` : t) : ''; };
/* 出どころの一覧。同じ資料は1回だけ。extra は [資料の中身を言う字, 項目] の組（発表の日つきで出すもの）。 */
function srcList(items) {
  const out = [];
  for (const x of items) {
    if (!x?.src?.url || !x.src.name) throw new Error(`出どころの無い項目がある（career-facts.mjs）: ${x?.key}`);
    if (!out.some(o => o.url === x.src.url)) out.push({ url: x.src.url, name: x.src.name, at: x.at });
  }
  return `<ul class="cr-srcs pv-no-cur">
${out.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>${o.at ? `<span>${esc(when(o.at))}</span>` : ''}</li>`).join('\n')}
</ul>`;
}
/* 台帳の値の字。金額（cur つき）は元の通貨の記号を頭に付ける（valueText は通貨を出さない）。 */
const factValue = x => (x.cur && typeof x.value === 'number' ? `${x.cur} ${x.value.toLocaleString('en-US')}` : valueText(x));

/* 会社（歴史と規模の短い紹介＋紹介文に出ていない数字の札）。 */
const ORG_NUMS = ['fleet_avg_age', 'network_destinations', 'pilots_joined_year', 'pilot_promotions_year'];
function org(slug) {
  const F = FACTS[slug];
  const intro = introText(slug);
  if (!Array.isArray(intro) || !intro.length) throw new Error(`${slug}: career-facts.mjs に紹介文が無い`);
  const used = new Set(intro.flatMap(i => i.uses));
  const all = [...F.profile, F.base, ...F.scale];
  const by = k => { const x = all.find(i => i.key === k); if (!x) throw new Error(`${slug}: 台帳に ${k} が無い`); return x; };
  /* 紹介文で言った数字を、札でもう一度言わない。 */
  for (const k of ORG_NUMS) if (used.has(k)) throw new Error(`${slug}: ${k} は紹介文に出ている（札に重ねない）`);
  const nums = ORG_NUMS.map(by);
  const owners = F.profile.filter(x => /^owner_/.test(x.key));
  return `<div class="cr-sec cr-org">
<h2 class="cr-h2">会社</h2>
<p class="cr-org-p pv-no-cur">${intro.map(i => esc(i.text)).join('')}</p>
<ul class="cr-org-nums pv-no-cur">
${nums.map(x => `<li class="cr-org-num"><b>${esc(valueText(x))}</b><span>${esc(x.ja)}</span><small>${[x.cond_ja, when(x.at)].filter(Boolean).map(esc).join('・')}</small></li>`).join('\n')}
</ul>
<details class="cr-more">
<summary>機材の内訳</summary>
<ul class="cr-org-fleet pv-no-cur">
${F.fleet.map(x => `<li><span>${esc(x.ja)}</span><b>${esc(valueText(x))}</b></li>`).join('\n')}
</ul>
<p>${esc(when(F.fleet[0].at))}</p>
</details>
<details class="cr-more">
<summary>出どころ</summary>
${owners.length ? `<ul class="cr-notes pv-no-cur">
${owners.map(x => `<li>${esc(x.ja)}：${esc(valueText(x))}</li>`).join('\n')}
</ul>
` : ''}${srcList([...[...used].map(by), ...nums, ...F.fleet, ...owners])}
</details>
</div>`;
}

/* 募集（公開中を確かめた求人だけ。国籍の限定がある枠 jobs_restricted は並べない）。 */
function jobs(slug) {
  const list = FACTS[slug].jobs || [];
  if (!list.length) return '';
  for (const j of list) if (!/^https:\/\//.test(j.url || '') || !j.ja || !j.posted || !j.as_of) throw new Error(`${slug}: 求人 ${j.key} の形が違う（career-facts.mjs）`);
  return `<div class="cr-sec cr-jobs">
<h2 class="cr-h2">募集</h2>
<ul class="cr-job-l">
${list.map(j => `<li><a class="cr-job" href="${esc(j.url)}" target="_blank" rel="noopener"><span class="cr-job-n">${esc(j.ja)}</span><span class="cr-job-m pv-no-cur">${esc(j.place_ja)}・${esc(atText(j.posted))} 掲載</span>${IC.go}</a></li>`).join('\n')}
</ul>
<p class="cr-job-at pv-no-cur">${esc(atText(list[0].as_of))}に公開中を確認</p>
</div>`;
}

/* 公表されている待遇。教官の求人1件だけに書かれている額は、折り畳みの中に分ける（会社どうしの比較には使わない）。 */
function benefits(slug) {
  const list = FACTS[slug].benefits || [];
  const item = x => `<div class="cr-ben-i"><dt>${esc(x.ja)}</dt><dd><b class="pv-no-cur">${esc(factValue(x))}</b>${x.cond_ja ? `<small>${esc(x.cond_ja)}</small>` : ''}</dd></div>`;
  const main = list.filter(x => x.scope === 'all');
  const inst = list.filter(x => x.scope === 'instructor');
  if (main.length + inst.length !== list.length) throw new Error(`${slug}: 待遇に、出し場所の決まっていない区分がある（career-facts.mjs の scope）`);
  if (!main.length) return '';
  return `<div class="cr-sec cr-bens">
<h2 class="cr-h2">公表されている待遇</h2>
<dl class="cr-ben">
${main.map(item).join('\n')}
</dl>
${inst.length ? `<details class="cr-more">
<summary>教官の求人（A320）に書かれている手当</summary>
<dl class="cr-ben">
${inst.map(item).join('\n')}
</dl>
</details>
` : ''}<details class="cr-more">
<summary>出どころ</summary>
${srcList(list)}
</details>
</div>`;
}

/* 就航地・街の写真（place-photos.mjs）。示すことが条件の写真には、作者名とライセンス名を付ける。 */
function placeImg(p, sizes) {
  return `<img src="${placeSrc(p)}" srcset="${placeSrc(p, true)} ${PLACE_SMALL_W}w, ${placeSrc(p)} ${p.w}w" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(p.subject)}" loading="lazy" decoding="async"/>`;
}
function placeCredits(items) {
  const need = items.filter(([, p]) => placeNeedsCredit(p));
  if (!need.length) return '';
  const same = need.every(([, p]) => p.changes === need[0][1].changes) ? need[0][1].changes : '';
  return `<p class="cr-credits">写真${same ? `（${esc(same)}）` : ''} ${need.map(([label, p]) => `<span class="cr-credit">${label ? esc(label) + ' ' : ''}<a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.author)}</a>／<a href="${esc(p.licence_url)}" target="_blank" rel="noopener">${esc(p.licence)}</a>${same ? '' : `（${esc(p.changes)}）`}</span>`).join(' ')}</p>`;
}

/* ── 家賃（1か月あたり）── 読み口は会社ページと同じ viewOf().living と rentCell() ──────────
   ★額は元の通貨が正本・円は比較用の換算。台帳が1年あたりの街は、読み口がもう12で割っている
     （その断りは台帳の per_month の1文。ここで割り算をしない）。
   ★街どうしを同じ目盛に並べない。棒も表も作らない ── 街ごとに 物差し（何の家賃か）・出どころ・時点 を付ける。 */
function living(slug) {
  const L = VIEW[slug].living;
  if (!L?.rents?.length) throw new Error(`${slug}: 家賃が台帳に無い（pv-airline-view.mjs）`);
  if (L.per !== 'month') throw new Error(`${slug}: 家賃が1か月あたりではない（${L.per}）`);
  if (!L.measure || !L.city) throw new Error(`${slug}: 家賃の物差し・街の名前が無い`);
  for (const r of L.rents) if (!r.name || (Object.keys(r.value).length && (!r.when || !r.src?.url || !r.src?.name))) throw new Error(`${slug}: 家賃 ${r.key} に名前・時点・出どころのどれかが無い`);
  return L;
}
/* 家賃の1マス。元の通貨（円の街は無い）と、円の額。 */
function rentRow(L, r, [k, l]) {
  const c = rentCell(L.cur, r.value[k]);
  if (!c) return '';
  return `<div><dt>${esc(l)}</dt><dd>${c.orig ? `<b class="pv-no-cur">${esc(c.orig)}</b><span>${esc(c.yen)}</span>` : `<b>${esc(c.yen)}</b>`}</dd></div>`;
}
/* 前提と出どころ。台帳の前提の鍵は、出し方の決まっているものだけ（知らない鍵が増えたら止まる）。 */
const RENT_BASIS = ['what', 'period', 'caveat', 'per_month', 'currency', 'cols'];
function rentBasis(slug, L, rents) {
  for (const b of L.basis || []) if (!RENT_BASIS.includes(b.key)) throw new Error(`${slug}: 家賃の前提 ${b.key} の出し方が決まっていない`);
  const by = k => (L.basis || []).find(b => b.key === k)?.value || '';
  const lines = [];
  if (by('what')) lines.push(by('what') + (by('period') ? `（${by('period')}）` : ''));
  else for (const r of rents) if (r.cond && !lines.includes(r.cond)) lines.push(r.cond);
  if (by('caveat')) lines.push(by('caveat'));
  if (by('per_month')) lines.push(by('per_month'));
  if (!lines.length) throw new Error(`${slug}: 家賃の前提が台帳に1つも無い`);
  const srcs = [];
  for (const r of rents) if (!srcs.some(o => o.url === r.src.url)) srcs.push({ url: r.src.url, name: r.src.name, when: r.when });
  return `${lines.map(t => `<p>${esc(t)}</p>`).join('\n')}${L.cur === 'JPY' ? '' : `
<p class="cr-fx pv-no-cur">${esc(fxNote(L.cur))}</p>`}
<ul class="cr-srcs pv-no-cur">
${srcs.map(o => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a><span>${esc(o.when)}</span></li>`).join('\n')}
</ul>`;
}

/* 拠点の街（暮らしのタブ）。地域を横に見られるのは、全部の地域にそろっている間取りだけ（台帳から機械で選ぶ）。 */
function town(slug) {
  const F = FACTS[slug], L = living(slug);
  const rooms = L.cols.filter(([k]) => L.rents.every(r => rentCell(L.cur, r.value[k])));
  if (!rooms.length) throw new Error(`${slug}: 全部の地域にそろっている間取りが無い`);
  const shots = L.rents.map(r => [r, placeShot(r.key)]);
  return `<div class="cr-sec cr-towns">
<h2 class="cr-h2">拠点の街</h2>
<p class="cr-town-base pv-no-cur">${esc(F.base.city_ja)}<span class="cr-stay-c">${esc(F.base.iata)}</span><span class="cr-town-ap">${esc(valueText(F.base))}</span></p>
<h3 class="cr-town-h">家賃（${rooms.map(r => esc(r[1])).join('・')}・1か月あたり）<span class="cr-tag">${esc(L.measure)}</span></h3>
<ul class="cr-town-l">
${shots.map(([r, p]) => `<li class="cr-town">
${p ? `<span class="cr-town-p">${placeImg(p, '(min-width: 700px) 240px, 46vw')}</span>` : ''}
<span class="cr-town-n">${esc(r.name)}</span>
<dl class="cr-rent">
${rooms.map(c => rentRow(L, r, c)).join('\n')}
</dl>
</li>`).join('\n')}
</ul>
<details class="cr-more">
<summary>家賃の前提と出どころ</summary>
${rentBasis(slug, L, L.rents)}
</details>
${placeCredits(shots.filter(([, p]) => p).map(([r, p]) => [r.name, p]))}
</div>`;
}

/* 比較の中の、1社ぶんの家賃の箱。その会社の拠点の街の、台帳がいちばん先に挙げる地域（lead）だけ。
   ⚠️ 2つの街を1つの表・1つの目盛に並べない（物差しが街ごとに違う）。箱の中に その街の物差し・出どころ・時点 を持つ。 */
function rentBox(slug, shown) {
  const L = living(slug);
  const lead = L.rents.filter(r => r.lead);
  if (lead.length !== 1) throw new Error(`${slug}: 家賃の先頭の地域が${lead.length}つ（1つに決まらない）`);
  const r = lead[0];
  const rows = L.cols.map(c => rentRow(L, r, c)).filter(Boolean);
  if (!rows.length) throw new Error(`${slug}: 先頭の地域に家賃が1つも無い`);
  return `<article class="cr-rentb" data-airline="${slug}" style="--cr-co:${color(slug)}"${shown ? '' : ' hidden'}>
<h3 class="cr-rentb-h"><i class="cr-dot" aria-hidden="true"></i>${esc(name(slug))}<span>${esc(L.city)}</span></h3>
<p class="cr-rentb-k"><span class="cr-tag">${esc(L.measure)}</span> ${esc(r.label)}${r.pick ? `<small>${esc(r.pick)}</small>` : ''}</p>
<dl class="cr-rent cr-rentb-l">
${rows.join('\n')}
</dl>
<p class="cr-rentb-s pv-no-cur">${esc(r.src.name)}<span>${esc(r.when)}</span></p>
<details class="cr-more">
<summary>前提と出どころ</summary>
${rentBasis(slug, L, [r])}
</details>
</article>`;
}

function deep(slug) {
  const top = `<div class="cr-tabp" data-tab="top">
<div class="cr-pay cr-pay-deep">
<h2 class="cr-pay-h">年収</h2>
<div class="cr-bars">
${ROLES.map(([r, l]) => bar(slug, r, l)).join('\n')}
${axis()}
</div>
<p class="cr-tax">${esc(BASIS[slug].tax)}</p>
</div>
${pub(slug, 'h2')}
${org(slug)}
<div class="cr-sec">
<h2 class="cr-h2">口コミ</h2>
${live('stars', { airline: slug })}
${live('reviews', { airline: slug })}
</div>
<div class="cr-sec">
<h2 class="cr-h2">REAL PAY</h2>
${live('realpay', { airline: slug })}
</div>
${jobs(slug)}
<p class="cr-else"><a class="cr-link" href="airlines/${slug}.html">口コミ・募集を見る${IC.go}</a></p>
<div class="cr-ents">
${TABS.slice(1).map(([t, l]) => `<a class="cr-ent" href="${href.tab(slug, t)}" data-go>${l}${IC.go}</a>`).join('\n')}
<a class="cr-ent" href="${href.card(slug)}" data-go>カードを保存${IC.go}</a>
</div>
</div>`;

  const work = `<div class="cr-tabp" data-tab="work" hidden>
<div class="cr-sec">
<h2 class="cr-h2">月の働き方</h2>
${live('work', { airline: slug })}
<p class="cr-else"><a class="cr-link" href="pay-report.html?airline=${slug}">匿名で給与を提出する${IC.go}</a></p>
</div>
${benefits(slug)}
<div class="cr-topics">
${TOPICS.map(t => topic(slug, t)).join('\n')}
</div>
</div>`;

  const life = `<div class="cr-tabp" data-tab="life" hidden>
${town(slug)}
<div class="cr-sec">
<h2 class="cr-h2">就航地</h2>
<ul class="cr-dests">
${destinations(slug).map(d => `<li><a class="cr-dest" href="${href.stay(slug, d.iata)}" data-go><span class="cr-dest-n">${esc(d.city_ja)}</span><span class="cr-dest-c">${d.iata}</span></a></li>`).join('\n')}
</ul>
${destSources(slug)}
</div>
</div>`;

  return `<section class="cr-view cr-co cr-deep" data-view="airline" data-airline="${slug}" style="--cr-co:${color(slug)}" hidden>
<div class="cr-top">
${back()}
<a class="cr-btn" href="${href.compare(slug, rival(slug))}" data-go>他社と比較</a>
</div>
<figure class="cr-hero">
${photo(slug, '(min-width: 1100px) 1040px, 100vw', false)}
${badge(slug)}
<h1 class="cr-h1 cr-hero-n" tabindex="-1">${esc(name(slug))}</h1>
</figure>
<nav class="cr-tabs" aria-label="${esc(name(slug))}">
${TABS.map(([t, l], i) => `<a class="cr-tab" href="${href.tab(slug, t)}" data-go data-tab="${t}"${i ? '' : ' aria-current="page"'}>${l}</a>`).join('\n')}
</nav>
${top}
${work}
${life}
${credits([[slug, shot(slug)]], false)}
</section>`;
}

/* ── その数字自身の詳細（d=cap-est・d=fo-est）── 推定年収の 対象・根拠（在れば）── */
function detail(slug, rank, label) {
  const c = cell(slug, rank);
  const hid = `<span class="cr-vh">${esc(name(slug))}</span><span class="cr-vh">${label}</span>`;
  const other = ROLES.find(([r]) => r !== rank);
  return `<section class="cr-view cr-det" data-view="detail" data-airline="${slug}" data-d="${rank}-est" style="--cr-co:${color(slug)}" hidden>
<a class="cr-back" href="${href.airline(slug)}" data-go>${IC.back}${esc(name(slug))}</a>
<h1 class="cr-h1 cr-det-h" tabindex="-1"><span class="cr-vh">${esc(name(slug))} </span>${label}の${KINDS[0][1]}</h1>
<div class="cr-det-top cr-det-est">
<p class="cr-det-n">${hid}<b class="cr-det-v">${esc(c.text)}</b> <span class="cr-det-k">${kline(c)}</span></p>
<div class="cr-track" aria-hidden="true">${fill(c)}</div>
${axis()}
</div>
${facts([['対象', `${label}<small>${EST_TARGET}</small>`], ...estRows(slug, rank)])}
<p class="cr-else"><a class="cr-link" href="${href.detail(slug, `${other[0]}-est`)}" data-go>${other[1]}の${KINDS[0][1]}${IC.go}</a></p>
</section>`;
}

/* ── 就航地の1画面（器）── 中に乗員ホテルの生きた欄 ───────────── */
function stay(slug, d) {
  /* 写真は台帳に在る先だけ（無い先・保留の先は写真なし）。地図は検索の住所（都市と空港の3レター）。 */
  const p = placeShot(d.iata);
  if (!d.city_en) throw new Error(`${slug}: 就航地 ${d.iata} に英語の都市名が無い（地図の検索に使う）`);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.city_en} ${d.iata}`)}`;
  return `<section class="cr-view cr-stay" data-view="stay" data-airline="${slug}" data-stay="${d.iata}" style="--cr-co:${color(slug)}" hidden>
<a class="cr-back" href="${href.tab(slug, 'life')}" data-go>${IC.back}${esc(name(slug))}の就航地</a>
${p ? `<figure class="cr-sv-p">${placeImg(p, '(min-width: 1100px) 1040px, 100vw')}</figure>
` : ''}<h1 class="cr-h1 cr-stay-h" tabindex="-1"><span class="cr-vh">${esc(name(slug))} </span>${esc(d.city_ja)}<span class="cr-stay-c">${d.iata}</span></h1>
<p class="cr-stay-n">${esc(d.country_ja)}${d.seasonal ? '<span class="cr-sv-tag">季節便</span>' : ''}</p>
<p class="cr-sv-map"><a class="cr-link" href="${esc(maps)}" target="_blank" rel="noopener">Google マップで開く${IC.go}</a></p>
<div class="cr-sec">
<h2 class="cr-h2">ホテル</h2>
${live('hotels', { airline: slug, stay: d.iata })}
</div>
${p ? placeCredits([['', p]]) : ''}
</section>`;
}

/* ── 比較 ───────────────────────────────────────────────────────── */
/* 比較の1行（推定年収どうし・同じ職位・同じ目盛）。職位は見出しが持っているので、行の中では隠してある。
   DEEP の会社は行ぜんたいがその数字自身の詳細への入口。
   ⚠️ 会社が公表した額の行をここへ足さない（下の「会社が公表している金額」の箱が持つ）。 */
function row(slug, rank, label, shown) {
  const c = cell(slug, rank);
  const isDeep = DEEP.includes(slug);
  const attrs = `data-airline="${slug}" style="--cr-co:${color(slug)}"${shown ? '' : ' hidden'}`;
  return `<${isDeep ? `a class="cr-row" href="${href.detail(slug, rank + '-est')}" data-go` : 'div class="cr-row"'} ${attrs}>
<div class="cr-row-h"><span class="cr-row-co"><i class="cr-dot" aria-hidden="true"></i>${esc(name(slug))}</span><span class="cr-vh">${label}</span><b class="cr-row-v">${esc(c.text)}</b></div>
<div class="cr-row-k">${kline(c)}</div>
<div class="cr-track" aria-hidden="true">${fill(c)}</div>
</${isDeep ? 'a' : 'div'}>`;
}

function compare() {
  /* 5社ぶんを全部置いておき、選ばれた2社だけ見せる（career.js は数字を持たない）。 */
  const on = s => PAIR.includes(s);
  const side = (id, label, chosen, taken) => `<div class="cr-side" data-side="${id}">
${FIVE.map(s => `<div class="cr-opt" data-airline="${s}" style="--cr-co:${color(s)}"${s === chosen ? '' : ' hidden'}>
<span class="cr-opt-p">${photo(s, '(min-width: 900px) 500px, 46vw', false)}${badge(s)}</span>
<span class="cr-opt-n">${esc(name(s))}${IC.down}</span>
</div>`).join('\n')}
<select id="cr-${id}" class="cr-sel" aria-label="${label}">
${FIVE.map(s => `<option value="${s}"${s === chosen ? ' selected' : ''}${s === taken ? ' disabled' : ''}>${esc(name(s))}</option>`).join('\n')}
</select>
<span class="cr-ring" aria-hidden="true"></span>
</div>`;
  return `<section class="cr-view cr-cmp" data-view="compare" hidden>
${back()}
<h1 class="cr-h1 cr-cmp-h" tabindex="-1">航空会社を比較</h1>
<div class="cr-pick">
${side('a', '1社目', PAIR[0], PAIR[1])}
<button type="button" class="cr-swap" id="cr-swap" aria-label="2社を入れ替える">${IC.swap}</button>
${side('b', '2社目', PAIR[1], PAIR[0])}
</div>
<div class="cr-panel">
<h2 class="cr-panel-h">年収</h2>
${ROLES.map(([r, l]) => `<h3 class="cr-role">${l}</h3>
<div class="cr-pair" data-role="${r}">
${FIVE.map(s => row(s, r, l, on(s))).join('\n')}
</div>`).join('\n')}
${axis()}
<div class="cr-taxes">
${FIVE.map(s => `<p class="cr-tax" data-airline="${s}" style="--cr-co:${color(s)}"${on(s) ? '' : ' hidden'}><i class="cr-dot" aria-hidden="true"></i>${esc(name(s))}<span>${esc(BASIS[s].tax)}</span></p>`).join('\n')}
</div>
</div>
<div class="cr-cards">
${FIVE.map(s => `<div class="cr-card" data-airline="${s}" style="--cr-co:${color(s)}"${on(s) ? '' : ' hidden'}>
<h2 class="cr-card-h"><a class="cr-card-n" href="${href.airline(s)}" data-go>${esc(name(s))}${IC.go}</a></h2>
${pub(s, 'h3')}
</div>`).join('\n')}
</div>
<div class="cr-sec cr-rents">
<h2 class="cr-h2">拠点の街の家賃<span class="cr-h2-s">1か月あたり</span></h2>
<div class="cr-rentbs">
${FIVE.map(s => rentBox(s, on(s))).join('\n')}
</div>
</div>
<div class="cr-lives">
<div class="cr-sec">
<h2 class="cr-h2">月の働き方</h2>
${live('cmp-work')}
</div>
<div class="cr-sec">
<h2 class="cr-h2">待遇</h2>
${live('cmp-facts')}
</div>
<div class="cr-sec">
<h2 class="cr-h2">口コミ</h2>
${live('cmp-stars')}
</div>
</div>
<p class="cr-else cr-cmp-card"><a class="cr-link" id="cr-to-card" href="${href.card(PAIR[0], PAIR[1])}" data-go>カードを保存${IC.go}</a></p>
${credits(FIVE.map(s => [s, shot(s)]), true, PAIR)}
</section>`;
}

/* ── カード保存（器）── 中身は career-card.js が DOM API で組む ─── */
/* ★金額を入れない。カードは、画面の DOM の字（data-main）を読む。ここに置くのは
   社名・色・写真の一覧とクレジット・公開ページの住所・QR の行列だけ。 */
const HOST = (() => {
  const h = fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) throw new Error('CNAME が読めない（公開ページの住所を作れない）');
  return h;
})();
export function cardData() {
  const airlines = {};
  for (const s of FIVE) {
    const url = `https://${HOST}/airlines/${s}.html`;
    airlines[s] = {
      ja: SALARY[s].ja, en: SALARY[s].en, code: code(s), color: color(s), url,
      qr: qrMatrix(url).map(r => r.join('')),
      /* クレジットは「示すことが使う条件」の写真にだけ入れる（要らない写真は空）。 */
      photos: (PHOTOS[s] || []).map(p => ({ src: photoSrc(p), w: p.w, h: p.h, credit: needsCredit(p) ? `${p.author} / ${p.licence}` : '' })),
    };
    if (!airlines[s].en) throw new Error(`${s}: SALARY に英語の社名が無い`);
  }
  return { host: HOST, airlines };
}
function card() {
  /* JSON の中の < は、HTML が </script> と読み違えないように逃がす。 */
  const json = JSON.stringify(cardData()).replace(/</g, () => '\\u003c');
  return `<section class="cr-view cr-cardv" data-view="card" hidden>
<a class="cr-back" id="crc-back" href="${href.home}" data-go>${IC.back}戻る</a>
<h1 class="cr-h1 cr-cardv-h" tabindex="-1">カードを保存</h1>
<div id="crc-root"></div>
<script type="application/json" id="crc-data">${json}</script>
</section>`;
}

export function build() {
  return `<div class="cr" id="cr" data-a="${PAIR[0]}" data-b="${PAIR[1]}" style="--cr-div:${AXIS / 1000}">
${home()}
${FIVE.map(overview).join('\n')}
${DEEP.flatMap(s => ROLES.map(([r, l]) => detail(s, r, l))).join('\n')}
${DEEP.flatMap(s => destinations(s).map(d => stay(s, d))).join('\n')}
${compare()}
${card()}
</div>`;
}

/* ── 書き込み ──────────────────────────────────────────────────── */
const OPEN = '<!--PV-CAREER-->', CLOSE = '<!--/PV-CAREER-->';
const fingerprint = f => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
/* career.html が読む、この1枚だけの部品。指紋（?v=）を付ける一覧。
   ⚠️ どれか1つを直したら node gen-career.mjs を流す（流さないと古い部品が最大4時間残る）。 */
export const ASSETS = [
  'career.css', 'career-sec.css', 'career-live.css', 'career-stay.css', 'career-card.css',
  'career.js', 'career-live.js', 'career-stay.js', 'career-card.js',
  /* パイロットであることの確認の共通のポップアップ。ホテルの欄の、会員の鍵の1行から開く（career-stay.js・2026-10-18 オーナー Q2） */
  'pv-proof-offer.js',
];

/** career.html のあるべき全文（いまのファイルを読んで、管理している所だけ差し替える）。 */
export function render(html) {
  const a = html.indexOf(OPEN), b = html.indexOf(CLOSE);
  if (a < 0 || b < a) throw new Error(`${PAGE}: ${OPEN} … ${CLOSE} が無い`);
  let out = html.slice(0, a + OPEN.length) + '\n' + build() + '\n' + html.slice(b);
  /* HTML は10分・CSS と JS は4時間キャッシュされる。中身の指紋を付けておけば、
     直した日に「新しい HTML ＋ 端末に残った古い JS」の組み合わせが成立しない。 */
  for (const f of ASSETS) {
    const re = new RegExp(`(["'])${f.replace('.', () => '\\.')}(?:\\?v=[0-9a-f]{8})?\\1`, 'g');
    let n = 0;
    out = out.replace(re, (m, q) => { n++; return `${q}${f}?v=${fingerprint(f)}${q}`; });
    if (!n) throw new Error(`${PAGE}: ${f} を読んでいない`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(ROOT, PAGE);
  const now = fs.readFileSync(file, 'utf8');
  const next = render(now);
  if (process.argv.includes('--check')) {
    if (now !== next) { console.error(`❌ ${PAGE} が古い。node gen-career.mjs を流す`); process.exit(1); }
    console.log(`✓ ${PAGE} は最新`);
  } else if (now === next) {
    console.log(`✓ ${PAGE} 変更なし`);
  } else {
    fs.writeFileSync(file, next);
    console.log(`✓ ${PAGE} を書いた（目盛 0〜${yen(AXIS)}）`);
  }
}
