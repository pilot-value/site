/* career.html の本文を書く（2026-10-03）。入口・会社の概要・2社の比較の3画面を1枚に入れる。
 *
 *   node gen-career.mjs           career.html の <!--PV-CAREER-->…<!--/PV-CAREER--> と ?v= を書く
 *   node gen-career.mjs --check   書かずに比べるだけ（古ければ 1 で終わる）
 *
 * ★数字を手で書かない。出どころは3つだけ。
 *     年収の推定        … salary-data.mjs の SALARY
 *     会社が公表した額  … salary-basis.mjs の BASIS（figures() / cardFigure()）
 *     写真              … airline-photos.mjs
 *   社名は SALARY の ja・色と略号は airlines-meta.js。
 *
 * ★棒に出す額は、会社ページのカードと同じ決め方（salary-basis.mjs の cardFigure）。
 *     その職位について会社が公表した年額があればそれ・無ければ推定。
 *   ここだけ「全部推定」にすると、同じ会社の同じ職位が会社ページと違う額になる
 *   （エティハド航空の機長が 3,400万 と 〜2,917万 の2つに割れる）。
 *   ⚠️ 上限（max_y）を平の額として出さない。cardFigure の up を見て斜線の棒にし、
 *      札か内訳の名前に「上限」の字が必ず残るようにしてある（無ければ止まる）。
 *
 * ★check-salary.mjs が読める形で書く。棒の行は「社名 → 職位 → 金額」をこの順に、
 *   間に数字を挟まずに置く（あちらの GAP は24個まで・数字で切れる）。
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
import { BASIS, TIERS, figures, fxNote, cardFigure } from './salary-basis.mjs';
import { PHOTOS, primary, needsCredit, src as photoSrc, SMALL_W } from './airline-photos.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export const PAGE = 'career.html';
/* 先行5社。並びは入口のタイルの順。 */
export const FIVE = ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air'];
/* 比較を社名なしで開いたときの2社。 */
export const PAIR = ['jal', 'cathay-pacific'];
export const ROLES = [['cap', '機長'], ['fo', '副操縦士']];
/* 「会社が公表している金額」に並べる区分。訓練生は入れない（年収の比較ではない）。 */
const PUB_RANKS = ['cap', 'fo', 'crew'];
/* 鍵の名前の末尾で決まる言い添え（年収の下限・手当の下限）。 */
const openEnd = key => (/_over$/.test(key) ? '超' : /_from$/.test(key) ? 'から' : '');

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

/* ── 棒に出す1マス ─────────────────────────────────────────────── */
/* 数字のすぐ上に職位が出ているので、札の横では頭の職位を落とす（同じ語を2回言わない）。
   「機長 A320（求人の上限）」→「A320（求人の上限）」／「副操縦士（4年契約）」→「4年契約」。 */
const brief = (group, label) => {
  if (!group.startsWith(label)) return group;
  const rest = group.slice(label.length).trim();
  const m = rest.match(/^（([^（）]*)）$/);
  return m ? m[1] : rest;
};

export function cell(slug, rank) {
  const c = cardFigure(slug, rank);
  const tier = BASIS[slug]?.[rank]?.tier;
  if (!c || c.held || !tier || !TIERS[tier]) throw new Error(`${slug}/${rank}: 出せる額が無い（確認中の表示はまだ作っていない）`);
  if (c.estimate) {
    const avg = SALARY[slug]?.[rank]?.avg;
    if (!avg) throw new Error(`${slug}/${rank}: SALARY に推定が無い`);
    return { man: avg, text: yen(avg), tag: TIERS[tier].ja, sub: '', look: '' };
  }
  const f = figures(slug, rank).find(x => !x.training && x.man === c.man);
  if (!f) throw new Error(`${slug}/${rank}: カードの額 ${c.man} が台帳の figures() に見つからない`);
  const tag = c.up && !f.group.includes('上限') ? c.kindJa : TIERS[tier].ja;
  if (c.up && !(tag + f.group).includes('上限')) throw new Error(`${slug}/${rank}: 上限なのに「上限」の字が出ない`);
  return {
    man: c.man,
    text: c.yen + openEnd(f.key),
    tag, sub: brief(f.group, ROLES.find(r => r[0] === rank)[1]),
    look: c.up ? 'max' : openEnd(f.key) === '超' ? 'over' : '',
  };
}

const CELLS = FIVE.flatMap(s => ROLES.map(([r]) => cell(s, r).man));
/* 目盛の右端。全部の棒が入る、いちばん近い 1,000万 の倍数。0 から始める。 */
export const AXIS = Math.ceil(Math.max(...CELLS) / 1000) * 1000;

/* 棒の長さ（目盛に対する％・小数1桁）。 */
const width = man => String(Math.round(man / AXIS * 1000) / 10);
const fill = (c, extra) => `<i class="cr-fill${extra ? ' ' + extra : ''}${c.look ? ' is-' + c.look : ''}" style="--w:${width(c.man)}%"></i>`;
/* 札と、その横の一言。別々の箱にしてあるので、狭い幅では一言が丸ごと次の行へ下りる（語の途中で折れない）。 */
const kline = c => `<span class="cr-tag">${esc(c.tag)}</span>${c.sub ? ` <span class="cr-sub">${esc(c.sub)}</span>` : ''}`;

const axis = () => `<div class="cr-axis" aria-hidden="true"><span>0</span><span>${yen(AXIS / 2)}</span><span>${yen(AXIS)}</span></div>`;

/* 概要の1マス（大きい数字）。社名は画面では隠してある（読み上げと check-salary.mjs のため）。 */
function num(slug, rank, label) {
  const c = cell(slug, rank);
  return `<div class="cr-num" data-role="${rank}"><span class="cr-vh">${esc(name(slug))}</span><span class="cr-num-r">${label}</span><b class="cr-num-v">${esc(c.text)}</b><span class="cr-num-k">${kline(c)}</span></div>`;
}

/* 概要の小さい棒。数字は上の2マスが持っているので、ここは形だけ（読み上げない）。 */
function mini(slug) {
  return `<div class="cr-mini" aria-hidden="true">
${ROLES.map(([r, l]) => `<div class="cr-mini-row"><span class="cr-mini-l">${l}</span><span class="cr-track">${fill(cell(slug, r), 'is-' + r)}</span></div>`).join('\n')}
${axis()}
</div>`;
}

/* 比較の1行。職位は見出しが持っているので、行の中では隠してある。 */
function row(slug, rank, label, shown) {
  const c = cell(slug, rank);
  return `<div class="cr-row" data-airline="${slug}" style="--cr-co:${color(slug)}"${shown ? '' : ' hidden'}>
<div class="cr-row-h"><span class="cr-row-co"><i class="cr-dot" aria-hidden="true"></i>${esc(name(slug))}</span><span class="cr-vh">${label}</span><b class="cr-row-v">${esc(c.text)}</b></div>
<div class="cr-row-k">${kline(c)}</div>
<div class="cr-track" aria-hidden="true">${fill(c)}</div>
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

/* ── 会社が公表している金額 ─────────────────────────────────────── */
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
      const orig = f.cur === 'JPY' ? '' : ` <span class="cr-orig pv-no-cur">${f.cur} ${f.amount.toLocaleString('en-US')}${openEnd(f.key) ? ' ' + openEnd(f.key) : ''}</span>`;
      return `<div class="cr-fig"><dt>${esc(f.kind)}</dt><dd><b>${esc(f.text + openEnd(f.key))}</b>${orig}</dd></div>`;
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
  const srcs = (B.src || []).filter(s => !/訓練生|自社養成/.test(s.name));
  const fx = B.cur && B.cur !== 'JPY' ? `\n<p class="cr-fx pv-no-cur">${esc(fxNote(B.cur))}</p>` : '';
  const noteHtml = notes.length ? `\n<ul class="cr-notes">\n${notes.map(n => `<li>${esc(n)}</li>`).join('\n')}\n</ul>` : '';
  const srcHtml = srcs.length ? `\n<ul class="cr-srcs pv-no-cur">\n${srcs.map(s =>
    `<li>${esc(s.pub)} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><span>適用時点：${esc(s.as_of)} ／ 確認日：${esc(s.accessed)}</span></li>`).join('\n')}\n</ul>` : '';
  const basis = noteHtml || fx || srcHtml
    ? `\n<details class="cr-more cr-basis"><summary>前提と出どころ</summary>${noteHtml}${fx}${srcHtml}\n</details>` : '';

  return `<div class="cr-pub">
<${tag} class="cr-h2">会社が公表している金額</${tag}>
${blocks}${basis}
</div>`;
}

/* ── 3つの画面 ─────────────────────────────────────────────────── */
const href = {
  home: PAGE,
  airline: s => `${PAGE}?airline=${s}`,
  compare: (a, b) => `${PAGE}?view=compare` + (a ? `&amp;a=${a}&amp;b=${b}` : ''),
};
const ic = d => `<svg class="cr-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = { back: ic('M15 6l-6 6 6 6'), go: ic('M5 12h14M13 6l6 6-6 6'), down: ic('M6 9l6 6 6-6'), swap: ic('M7 8h11l-3-3M17 16H6l3 3') };
const back = () => `<a class="cr-back" href="${href.home}" data-go>${IC.back}航空会社を選ぶ</a>`;

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

function overview(slug) {
  /* 「他社と比較」は、この会社を1社目に置いて開く。相手は既定の2社のうち、この会社でないほう。 */
  const other = slug === PAIR[0] ? PAIR[1] : PAIR[0];
  return `<section class="cr-view cr-co" data-view="airline" data-airline="${slug}" style="--cr-co:${color(slug)}" hidden>
<div class="cr-top">
${back()}
<a class="cr-btn" href="${href.compare(slug, other)}" data-go>他社と比較</a>
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
</div>
</div>
${pub(slug, 'h2')}
<p class="cr-else"><a class="cr-link" href="airlines/${slug}.html">口コミ・募集を見る${IC.go}</a></p>
${credits([[slug, shot(slug)]], false)}
</section>`;
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
${credits(FIVE.map(s => [s, shot(s)]), true, PAIR)}
</section>`;
}

export function build() {
  return `<div class="cr" id="cr" data-a="${PAIR[0]}" data-b="${PAIR[1]}" style="--cr-div:${AXIS / 1000}">
${home()}
${FIVE.map(overview).join('\n')}
${compare()}
</div>`;
}

/* ── 書き込み ──────────────────────────────────────────────────── */
const OPEN = '<!--PV-CAREER-->', CLOSE = '<!--/PV-CAREER-->';
const fingerprint = f => createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);

/** career.html のあるべき全文（いまのファイルを読んで、管理している所だけ差し替える）。 */
export function render(html) {
  const a = html.indexOf(OPEN), b = html.indexOf(CLOSE);
  if (a < 0 || b < a) throw new Error(`${PAGE}: ${OPEN} … ${CLOSE} が無い`);
  let out = html.slice(0, a + OPEN.length) + '\n' + build() + '\n' + html.slice(b);
  /* HTML は10分・CSS と JS は4時間キャッシュされる。中身の指紋を付けておけば、
     直した日に「新しい HTML ＋ 端末に残った古い JS」の組み合わせが成立しない。 */
  for (const f of ['career.css', 'career.js']) {
    const re = new RegExp(`(["'])${f.replace('.', '\\.')}(?:\\?v=[0-9a-f]{8})?\\1`, 'g');
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
