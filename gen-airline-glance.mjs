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
import { fxNote } from './salary-basis.mjs';
import { TOPICS } from './gen-career.mjs';
import { FACTS as CAREER } from './career-facts.mjs';
import { needsCredit, src as photoSrc, smallH, SMALL_W } from './airline-photos.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UP = '../';                                   // 会社ページ（airlines/）から見たルート
const CSS = ['career-live.css', 'pv-glance.css'];
const JS = ['career-live.js', 'pv-glance.js'];
export const ASSETS = [...CSS, ...JS];
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
};

/* ── 部品 ───────────────────────────────────────────── */
const join = (...xs) => xs.filter(Boolean).join('・');
/* 事実に添える前提。時点が日付でなく資料の呼び名（「経験者の副操縦士の募集」）のときは、
   前提と同じことを2度言うことになるので、前提だけにする（資料の名前は出どころの一覧に出る）。 */
/* 値がもう時点を言っているとき（設立 1951年8月1日）は、同じ日付をもう一度書かない。 */
const premise = f => {
  const when = f.when && String(f.value).includes(f.when) ? '' : f.when;
  return join(f.cond, f.cond && !/\d/.test(when || '') ? '' : when);
};
const ext = (url, text, cls = 'pvg-src') => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
/* 実データの欄（描くのは career-live.js。ここは器だけ） */
const live = (kind, attrs = {}) =>
  `<div class="crl" data-live="${kind}"${Object.entries(attrs).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')} data-state="idle"><span class="crl-ph">—</span></div>`;
/* 台帳の値。外貨の原文は通貨切替に書き換えさせない（pv-no-cur）。円の目安は切替に任せる。
   目安には原文の通貨を添える ── 選んだ通貨が原文と同じとき、同じ額の言い直しになるので隠す（pv-glance.css）。 */
const approx = (cur, yenText) => `<small class="pvg-yen"${cur ? ` data-cur="${esc(cur)}"` : ''}>（${esc(yenText)}）</small>`;
const curOf = s => (/\b([A-Z]{3})\b/.exec(String(s)) || [])[1] || '';
const val = f => f.orig === true
  ? `<span class="pv-no-cur">${esc(f.value)}</span>${f.yen ? approx(curOf(f.value), f.yen) : ''}`
  : esc(f.value);
/* 台帳の散文（外貨の「500万元」などを通貨切替が円と読み違えないよう、丸ごと素通しにする） */
const prose = s => `<span class="pv-no-cur">${esc(s)}</span>`;
const whole = f => (f.pilot === false ? '<span class="pvg-tag pvg-tag-q">会社全体の制度</span>' : '');

/* 出どころの一覧（同じ資料は1回だけ）。
   fold ＝ 下のカードでは畳んで置く（押せば資料の名前とリンクが全部出る。数字のそばから1回で届く）。 */
function sources(items, fold = false) {
  const seen = new Map();
  for (const f of items) if (f && f.src && f.src.url && !seen.has(f.src.url)) seen.set(f.src.url, f.src);
  if (!seen.size) return '';
  const links = [...seen.values()].map(s => ext(s.url, s.name)).join('');
  return fold
    ? `<details class="pvg-dt pvg-srcd"><summary>出どころ<small>${seen.size}件</small>${IC.down}</summary><p class="pvg-srcs">${links}</p></details>`
    : `<p class="pvg-srcs"><span>出どころ</span>${links}</p>`;
}
/* 会社が公表している条件の一覧 */
const factList = items => `<dl class="pvg-dl">${items.map(f =>
  `<div><dt>${esc(f.label)}${whole(f)}</dt><dd><b>${val(f)}</b>${premise(f) ? `<small>${esc(premise(f))}</small>` : ''}</dd></div>`).join('')}</dl>`;
/* 匿名で答える入口（質問の名前を出す） */
const asks = (slug, list, head = '匿名で答える') =>
  `<div class="pvg-ask">${head ? `<p class="pvg-askh">${esc(head)}</p>` : ''}<ul>${list.map(([q, label]) =>
    `<li><a href="${href.ask(slug, q)}">${esc(label)}${IC.next}</a></li>`).join('')}</ul></div>`;

/* ── 社名の行（写真を置かない）────────────────────────── */
function hero(v, keep) {
  const iata = v.base.iata.length ? ` <b>${v.base.iata.map(esc).join('・')}</b>` : '';
  return `<div class="hero-airline pvg-hero" style="--pvg-c:${esc(v.color)}">
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
<a class="pvg-btn" href="${href.compare(v.slug)}">比較する</a>
<a class="pvg-btn pvg-btn-ghost" href="${href.card(v.slug)}">カードにする</a>
</div>
</div>
</div>
</div>`;
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
  const src = p.src.length ? `<p class="pvg-srcs"><span>出どころ</span>${p.src.map(s =>
    `${ext(s.url, `${s.pub}「${s.name}」`)}<small>${esc(join(s.when, s.secondary ? '会社の公表ではない資料' : ''))}</small>`).join('')}</p>` : '';
  const fx = p.cur && p.cur !== 'JPY' ? `<p class="pvg-fx">${esc(fxNote(p.cur))}</p>` : '';
  return `<details class="pvg-dt pvg-paydt">
<summary>この金額は誰の・何を含んだ・いつの金額か${IC.down}</summary>
<div class="pvg-body">
<dl class="pvg-dl">${rows.join('\n')}</dl>
<p class="pvg-axis">棒の目盛は 0 〜 ${yen(AXIS)}。機長と副操縦士で同じです。</p>
${notes}${src}${fx}
</div>
</details>`;
}
function payCard(v) {
  return `<article class="pvg-card pvg-pay">
<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${IC.pay}</span><h2 class="pvg-eyebrow">給与</h2><span class="pvg-chip">${esc(v.pay.tax)}</span></header>
<div class="pvg-ranks">
${RANKS.map(r => rankBlock(v, r)).join('\n')}
</div>
<p class="pvg-estk">${EST_BY}</p>
${pubBlock(v)}
${payDetails(v)}
</article>`;
}

/* ── 勤務・待遇・暮らし ─────────────────────────────── */
const WORK_ASK = [['days_off_request', '希望休を指定できるか'], ['roster_lead_days', '勤務予定は何日前に決まるか'],
  ['reserve_duty', 'スタンバイ勤務があるか'], ['roster_changes', '確定後の変更は多いか']];
const BEN_ASK = [['annual_leave_days', '年間の有給休暇の日数'], ['sick_leave', '病気休暇を使えるか'], ['staff_travel', '社員向け航空券があるか']];
const LIVE_ASK = [['commuting_transport', '通勤の足を会社が用意するか'], ['commuting_taxi_when', 'タクシーを使えるとき'], ['commuting_bus_when', 'クルーバスを使えるとき']];

/* 欄（閉じているときに見えるのが「公表されている条件を1つ」）と、その中身の板。
   板は欄のすぐ後ろに置く ＝ 狭い画面ではその場で開き、広い画面では3つの欄の下へ横いっぱいに出る（pv-glance.css）。 */
/* 広い箱では、欄の中に質問を名前で並べる（どの欄も、公表の条件と質問をあわせて3行まで） */
const quick = (slug, list) => (list.length ? `<div class="pvg-qs"><p class="pvg-qh">匿名で答える</p><ul>${list.map(([q, label]) =>
  `<li><a href="${href.ask(slug, q)}">${esc(label)}${IC.next}</a></li>`).join('')}</ul></div>` : '');
const SLOTS = 3;
/* 値が長いとき（「本人と対象の家族に割引の航空券」）は字を1段小さくして、狭い画面でも1行に収める。円の目安（small）は数えない */
const isLong = html => html.replace(/<small[\s\S]*?<\/small>/g, '').replace(/<[^>]*>/g, '').length > 13;
function cell(id, title, icon, { slug, k, v: value, note, also = [], ask = [], count, body, empty }) {
  const more = empty ? '答える' : count > 1 ? `ほか${count - 1}件と出どころ` : '出どころを見る';
  return `<article class="pvg-card pvg-cell" data-cell="${id}">
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
<div class="pvg-card pvg-panel" id="pvg-p-${id}" data-panel="${id}" hidden>
<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${icon}</span><h3 class="pvg-ptitle">${title}</h3><button type="button" class="pvg-x" aria-label="閉じる">${IC.x}</button></header>
${body}
</div>`;
}
function factCell(v, id, title, icon, items, askList, emptyText) {
  const answers = `<div class="pvg-ans"><p class="pvg-askh">パイロットの回答（3人そろった項目だけ）</p>${live('fact', { airline: v.slug, keys: askList.map(a => a[0]).join(',') })}</div>`;
  const lead = items.find(f => f.lead) || items[0];
  if (!lead) {
    /* 載せる事実が無い欄は、数字を作らず、中身の分かる入口にする */
    return cell(id, title, icon, {
      slug: v.slug, k: '会社の公表', v: '確認できていません', empty: true, ask: askList,
      note: esc(emptyText), body: answers + asks(v.slug, askList),
    });
  }
  const rest = items.filter(f => f !== lead);
  return cell(id, title, icon, {
    slug: v.slug, k: esc(lead.label) + whole(lead), v: val(lead), note: esc(premise(lead)),
    also: rest.slice(0, 2), ask: askList, count: items.length,
    body: `<p class="pvg-askh">会社が公表している条件</p>${factList(items)}${sources(items)}${answers}${asks(v.slug, askList)}`,
  });
}
function rentText(L, r, col) {
  const c = rentCell(L.cur, r.value[col]);
  const per = L.per === 'year' ? '年 ' : L.per === 'month' ? '月 ' : '';
  return c.orig ? `<span class="pv-no-cur">${per}${esc(c.orig)}</span>${approx(L.cur, c.yen)}` : `${per}${esc(c.yen)}`;
}
function livingCell(v) {
  const L = v.living;
  const answers = `<div class="pvg-ans"><p class="pvg-askh">パイロットの回答（3人そろった項目だけ）</p>${live('fact', { airline: v.slug, keys: LIVE_ASK.map(a => a[0]).join(',') })}</div>`;
  const lead = L && (L.rents.find(r => r.lead && r.value[L.leadCol] != null) || L.rents.find(r => r.value[L.leadCol] != null));
  if (!lead) {
    return cell('living', '暮らし', IC.living, {
      slug: v.slug, k: '拠点の街', v: esc(v.base.city), empty: true, ask: LIVE_ASK,
      note: '家賃の資料を確認できていません', body: answers + asks(v.slug, LIVE_ASK),
    });
  }
  const colName = Object.fromEntries(L.cols)[L.leadCol].replace(/（[^）]*）/g, '');   // 「2部屋（2房）」→ 欄の見出しでは「2部屋」。表には元のまま出る
  const cols = L.cols.filter(([key]) => L.rents.some(r => r.value[key] != null));
  const table = `<div class="pvg-scroll"><table class="pvg-rent">
<thead><tr><th scope="col">${esc(L.city)}の${esc(L.measure)}</th>${cols.map(([, label]) => `<th scope="col">${esc(label)}</th>`).join('')}</tr></thead>
<tbody>${L.rents.map(r => `<tr><th scope="row">${esc(r.name)}${r.pick ? `<small>${esc(r.pick)}</small>` : ''}</th>${cols.map(([key, label]) => r.value[key] == null
    ? `<td class="is-none" data-label="${esc(label)}"><span class="pvg-none">—</span></td>`
    : `<td data-label="${esc(label)}">${rentText(L, r, key)}</td>`).join('')}</tr>`).join('\n')}</tbody>
</table></div>`;
  const conds = [...new Set(L.rents.flatMap(r => [r.cond, r.when]).filter(Boolean))];
  /* 表の下の断り。同じことを2度書かない：
     通貨・額の単位・列の分け方は表そのものが言っている。「何の額か」は街の行が自分の前提を持っていればそちらが詳しく、
     「いつの額か」は街の行の時点と同じことなので、行に無いときだけ出す。「出どころの断り」は必ず出す。 */
  const hasCond = L.rents.some(r => r.cond), hasWhen = L.rents.some(r => r.when);
  const said = { currency: true, per: true, cols: true, what: hasCond, period: hasWhen };
  const notes = [...L.basis.filter(b => !said[b.key]).map(b => b.value), ...conds];
  const basis = `<ul class="pvg-notes">${notes.map(b => `<li>${prose(b)}</li>`).join('')}</ul>`;
  const commute = L.commute.length ? `<p class="pvg-askh">空港と街のあいだ</p>${factList(L.commute)}` : '';
  const fx = L.cur !== 'JPY' ? `<p class="pvg-fx">${esc(fxNote(L.cur))}</p>` : '';
  return cell('living', '暮らし', IC.living, {
    slug: v.slug, ask: LIVE_ASK,
    k: `${esc(lead.name).replace(/（[^）]*）/g, m => `<span class="pvg-opt">${m}</span>`)}・${esc(colName)}の${esc(L.measure)}`, v: rentText(L, lead, L.leadCol),
    note: esc(join(lead.pick && lead.pick.length <= 16 ? lead.pick : '', lead.when)),
    also: L.commute.filter(f => f.lead).slice(0, 1), count: L.rents.length + L.commute.length,
    body: `${table}${basis}${sources([...L.rents, ...L.commute])}${fx}${commute}${answers}${asks(v.slug, LIVE_ASK)}`,
  });
}

/* ── その下：会社・REAL PAY・口コミ・募集・ステイ・ひとつ教えて ── */
const head = (icon, title, sub = '') =>
  `<header class="pvg-hd"><span class="pvg-ico" aria-hidden="true">${icon}</span><h2 class="pvg-eyebrow">${title}</h2>${sub ? `<span class="pvg-hsub">${sub}</span>` : ''}</header>`;
/* 会社の数字。何の数か → 値（大きく）→ 数え方と時点、の順。
     値の末尾の（…）は補足なので、値からは外して下の行へ回す（「1952年」＋「日本ヘリコプター輸送として設立」）。 */
const stats = items => `<dl class="pvg-stats">${items.map(f => {
  const m = f.orig === true ? null : /^(.+?)（([^（）]+)）$/.exec(String(f.value));
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
  /* 写真 → 見出し → 数字 → 機材 → 出どころ。広い箱では、写真と数字が横に並び、機材と出どころは横いっぱい（pv-glance.css）。 */
  return `<article class="pvg-card pvg-co">
${photo}
${head(IC.company, '会社')}
${stats(facts)}
${fleet}
${sources([...facts, ...c.fleet], true)}
</article>`;
}
/* 提出された年収の一覧（2026-10-06 オーナーのご指示）── 最上段のすぐ下に、横いっぱいで置く。
   描くのは career-live.js。鍵の無い人には、額・職位・機材の場所にぼかした板を置く
   （板の中は空。サーバーが送っていないので、ぼかしを外しても何も出ない）。資格を決めるのは今までどおりサーバー。 */
const realpayCard = v => `<article class="pvg-card pvg-rp" id="pvg-realpay">
${head(IC.realpay, '提出された年収', 'REAL PAY')}
${live('realpay', { airline: v.slug })}
</article>`;
const reviewsCard = v => `<article class="pvg-card pvg-rv-card">
${head(IC.reviews, '口コミ', '実際の投稿だけで集計')}
${live('stars', { airline: v.slug })}
${live('reviews', { airline: v.slug })}
</article>`;
function jobsCard(v) {
  return `<article class="pvg-card pvg-jobs">
${head(IC.jobs, '募集', `<button type="button" class="pvg-link" data-pvg-tab="jobs">募集要項を開く${IC.go}</button>`)}
${v.jobs.length ? factList(v.jobs) + sources(v.jobs, true) : '<p class="pvg-quiet">会社が公表している募集を確認できていません。</p>'}
</article>`;
}
const DEST_FIRST = 8;
function stayCard(v) {
  const dest = d => `<li><a href="${href.stay(v.slug, d.iata)}">${esc(d.city_ja)}<b>${esc(d.iata)}</b></a></li>`;
  const dests = (CAREER[v.slug] || {}).destinations || [];
  const base = `<p class="pvg-stay-base">${IC.pin}<span>拠点</span><b>${esc(v.base.city)}${v.base.iata.length ? ` ${v.base.iata.map(esc).join('・')}` : ''}</b>
${ext(href.maps(`${v.base.text} ${v.base.iata[0] || ''}`.trim()).replace(/&amp;/g, '&'), 'Google マップで見る', 'pvg-link')}</p>`;
  const list = dests.length
    ? `<p class="pvg-askh">就航地（押すと、その街のホテル・レストランへ）<small>${dests.length}都市</small></p>
<ul class="pvg-chips pvg-dest">${dests.slice(0, DEST_FIRST).map(dest).join('')}</ul>${dests.length > DEST_FIRST ? `
<details class="pvg-dt"><summary>ほか${dests.length - DEST_FIRST}都市${IC.down}</summary>
<ul class="pvg-chips pvg-dest">${dests.slice(DEST_FIRST).map(dest).join('')}</ul></details>` : ''}`
    : '<p class="pvg-quiet">就航地ごとのホテル・レストランは、会社が公表する就航地の一覧を確認してから開きます。</p>';
  return `<article class="pvg-card pvg-stay" id="pvg-stay">
${head(IC.stay, 'ステイ')}
${base}
${list}
</article>`;
}
/* 「◯◯のこと、ひとつ教えて。」── 質問の名前まで見せる。
   集まった回答は、話題の上に1つの欄でまとめて出す（3人そろった項目だけ。件数はサーバーの答え）。
   話題ごとに欄を分けると、回答のある話題だけ質問の並びが下がり、列がそろわなくなる。 */
const ROSTER = ['work', '勤務', WORK_ASK];
const ASK_FIRST = 4;                               // 広い箱で、話題ごとに最初から見せる質問の数（pv-glance.css の nth-child と同じ）
function askCard(v) {
  const groups = [ROSTER, ...TOPICS.map(([id, title, list]) => [id, id === 'staff-travel' ? 'Staff Travel（社員向け航空券）' : id === 'taxi' ? '通勤・タクシー' : title, list])];
  const stay = (CAREER[v.slug] || {}).destinations ? `<a class="pvg-topic pvg-topic-a" href="#pvg-stay"><span>ホテル・レストラン</span><small>就航地を選んで足す</small>${IC.next}</a>` : '';
  const keys = [...new Set(groups.flatMap(([, , list]) => list.map(a => a[0])))];
  return `<article class="pvg-card pvg-askc">
${head(IC.ask, `${esc(v.name)}のこと、ひとつ教えて。`)}
<p class="pvg-quiet">1問だけでも保存できます。匿名で、3人そろった項目から会社ページに出ます。</p>
<div class="pvg-got"><p class="pvg-askh">集まった回答</p>${live('fact', { airline: v.slug, keys: keys.join(',') })}</div>
<div class="pvg-topics">
${groups.map(([id, title, list]) => `<details class="pvg-topic" data-topic="${id}">
<summary><span>${esc(title)}</span><small>質問 ${list.length}</small>${IC.down}</summary>
<div class="pvg-body">
${asks(v.slug, list, '')}${list.length > ASK_FIRST ? `
<button type="button" class="pvg-link pvg-askmore" data-pvg-askmore>ほか${list.length - ASK_FIRST}問${IC.down}</button>` : ''}
</div>
</details>`).join('\n')}
${stay}
</div>
</article>`;
}

/* ── 1社ぶん ────────────────────────────────────────── */
function glance(v) {
  const island = JSON.stringify({ airlines: Object.fromEntries(GLANCE.map(s => { const o = viewOf(s); return [s, { ja: o.name, color: o.color }]; })) })
    .replace(/</g, () => '\\u003c');
  return `<section class="pvg" data-tab-section="overview" data-slug="${v.slug}" style="--pvg-c:${esc(v.color)};--pvg-n:${AXIS / 1000}" aria-label="${esc(v.name)}の給与・勤務・待遇・暮らし">
<div class="pvg-top">
${payCard(v)}
<div class="pvg-trio">
${factCell(v, 'work', '勤務', IC.work, v.work, WORK_ASK, '会社が公表している勤務の条件を確認できていません')}
${factCell(v, 'benefits', '待遇', IC.benefits, v.benefits, BEN_ASK, '会社が公表している待遇を確認できていません')}
${livingCell(v)}
</div>
</div>
${realpayCard(v)}
<div class="pvg-more-grid">
${companyCard(v)}
${reviewsCard(v)}
${jobsCard(v)}
${stayCard(v)}
${askCard(v)}
</div>
<div id="pvg-revcats"></div>
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
const BOX = '<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">';
const NAV_CSS = /<link rel="stylesheet" href="\.\.\/app-nav\.css(?:\?v=[0-9a-f]+)?"\s*\/?>\n?/;

export function build(slug, html) {
  const v = viewOf(slug);
  /* 1) 社名の行。h1 と副題の字は今のページのものを1文字も変えずに運ぶ（airline-base.js が読む） */
  const H0 = '<!--PV-HERO-->', H1 = '<!--/PV-HERO-->';
  let a = html.indexOf(H0), b;
  if (a >= 0) b = html.indexOf(H1, a) + H1.length;
  else { a = once(html, '<div class="hero-airline"', '社名の行'); b = once(html, BOX, '本文の箱'); }
  const old = html.slice(a, b);
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(old), sub = /<p class="text-muted[^"]*">([^<]*—[^<]*)<\/p>/.exec(old);
  if (!h1 || !sub) throw new Error(`${slug}: h1 か副題が読めない`);
  const heroText = `${H0}\n${hero(v, { h1: h1[1].trim(), sub: sub[1].trim() })}\n${H1}`;
  html = html.slice(0, a) + heroText + (old.startsWith(H0) ? '' : '\n\n') + html.slice(b);

  /* 2) 見た目（app-nav.css の直後） */
  html = block(html, 'PV-GLANCE-HEAD', CSS.map(f => `<link rel="stylesheet" href="${asset(f)}">`).join('\n'), h => {
    const m = NAV_CSS.exec(h);
    if (!m) throw new Error(`${slug}: app-nav.css の <link> が無い`);
    return m.index + m[0].length;
  });
  /* 3) 本文の箱の先頭 */
  html = block(html, 'PV-GLANCE', glance(v), h => once(h, BOX, '本文の箱') + BOX.length + 1);
  /* 4) 部品の JS（口コミの部品より後 ＝ </body> の直前） */
  html = block(html, 'PV-GLANCE-JS', JS.map(f => `<script src="${asset(f)}"></script>`).join('\n'), h => {
    const i = h.lastIndexOf('</body>');
    if (i < 0) throw new Error(`${slug}: </body> が無い`);
    return i;
  });
  /* 5) 印。これが在るページだけ、星を実投稿だけで出す */
  html = html.replace(/<body\b[^>]*>/, m => (m.includes('data-pv-glance=') ? m : m.replace(/>$/, () => ' data-pv-glance="1">')));
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
