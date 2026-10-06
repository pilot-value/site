/* ══════════════════════════════════════════════════════════════════
   assert-airline-glance.mjs — 主要5社の会社ページ（給与・勤務・待遇・暮らしの1画面と、その下）

   この5枚は「普通に見えたまま静かに嘘になる」形をいくつも持っている。1つずつ見張る。

     ① 4種類の額が混ざる ── 推定年収／求人の上限／会社の公表額／乗員全体の公表平均。
        推定は、根拠・算出方法・時点の3つが台帳にそろった職位にだけ出る。
        そろわなければ「確認中」で、棒も描かない。
        求人の上限は「〜」・斜線の棒・「上限」の字の3つが必ず一緒
        （斜線は札（class）ではなく**描かれた模様**で見る）。
        乗員全体の平均は機長・副操縦士の欄の外に在る。
     ② 画面の額が正本とずれる ── 額は gen-airline-glance.mjs が pv-airline-view.mjs 経由で書く。
        ここでは**あちらの viewOf()・mark()・figures() を呼ばずに**、SALARY・BASIS・JPY_PER から
        同じ答えを作り直して突き合わせる（呼んでしまうと、あちらが間違えた日に検査も一緒に間違える）。
        止めてある額（SALARY の avg / lo / hi）が、推定を出していない職位について
        1つも出ていないことも見る。
     ③ 棒が歪む・違う物差しの額を並べる ── 棒は 0 から・描かれた長さが額に比例・目盛は5枚で同じ。
        ⚠️ ほかの会社の額と棒を、この1枚に並べない（2026-10-06 オーナー指示で「5社を同じ目盛で」の箱を外した。
           推定・求人の上限・会社公表の目標・会社公表の下限は物差しが違い、棒の長さを比べても何も分からない）。
     ④ 無い数字を作る ── 出荷する HTML に件数・星・評価が1つも無い（実データの欄は「—」で出荷）。
        読めない時に、数字や 0 を出さない。
     ⑤ 入口が違う所へ行く ── 質問は自分の会社＋在る質問・比較は自分＋相手・カードは自分。
     ⑥ 切れる・はみ出す・重なる ── 9つの幅 × 全通貨で測る（円だけ・スマホの幅だけで確かめない）。
        最初の1画面に 給与 → 勤務 → 待遇 → 暮らし が入る。
     ⑦ 通貨 ── 切り替えると額が変わり、「〜」「超」の印と原貨の額は残り、円に戻すと1文字も違わない。
     ⑧ さわり心地 ── 押せるものに hover／focus-visible／active・動かすのは位置と濃さだけ・
        色はトークンだけ・字 12px 以上・押す場所 44px 以上
        （見える箱ではなく、**押して反応する範囲**を実際に当てて測る）。
     ⑨ 生成物が古い ── 5枚は生成スクリプトの出力と1文字も違わない・
        読む部品の指紋（?v=）が今の中身と合っている。

   実データの欄（⭐・口コミ・REAL PAY・回答の集計）は、**決まった返事を返す偽のサーバー**で描かせる
   （0件／鍵が掛かったまま）。本番の DB は読まない ＝ 毎回同じ答えになる。
   ⚠️ なので、ここが保証するのは「0件の時」と「読めない時」だけ。
      実際の投稿が入った時の形（⭐が出る・口コミが並ぶ）は、この検査は見ていない。

   使い方（node serve.mjs を起動した状態で）
     node assert-airline-glance.mjs            全部
     node assert-airline-glance.mjs --static   ブラウザを使わない所だけ
     node assert-airline-glance.mjs --only etihad --sizes 390,1440   調べる時だけ（会社と幅を絞る。緑でも全部を見たことにはならない）
   同時に開く枚数は PV_GLANCE_JOBS（既定 3。check.mjs からは 2）。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS } from './salary-basis.mjs';
import { JPY_PER } from './fx-rates.mjs';
import { GLANCE } from './pv-airline-view.mjs';
import { build, pageOf, ASSETS } from './gen-airline-glance.mjs';
import { primary, needsCredit } from './airline-photos.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const BASE = 'http://localhost:3000';
const STATIC_ONLY = process.argv.includes('--static');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length * 2))}`);
/* 通ったとも落ちたとも数えない知らせ（まだ出来ていないことを、緑の中に埋めない）。 */
const notice = t => console.log(`  △ ${t}`);

const noCssCmt = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
const noJsCmt = t => noCssCmt(t).replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, h) => h);

/* ══════════════════════════════════════════════════════════════════
   正本から作り直す答え（生成側の関数を1つも呼ばない）
   ══════════════════════════════════════════════════════════════════ */
const FIVE = ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air'];
const RANKS = [['cap', '機長'], ['fo', '副操縦士']];
const nameOf = s => SALARY[s].ja;

const yen = m => `¥${m.toLocaleString('en-US')}万`;
const rateOf = cur => (cur === 'JPY' ? 1 : JPY_PER[cur]);
const toMan = (cur, amount) => Math.round((amount * rateOf(cur)) / 10000);
const origOf = (cur, amount) => `${cur} ${amount.toLocaleString('en-US')}`;

/* この検査が出し方を知っている額の鍵。台帳に知らない鍵が増えたら、黙って通さずに落とす
   （新しい種類の額が、どの欄にどの印で出るべきかは人が決める）。 */
const RANK_KEYS = ['max_y', 'target_y', 'cash_y_over', 'allow_m_from'];
const LABEL = { max_y: '求人の上限', target_y: '会社公表の目標年収', cash_y_over: '会社公表の下限' };
const figText = (key, y) => (key === 'max_y' ? `〜${y}` : key === 'cash_y_over' ? `${y}超` : key === 'allow_m_from' ? `${y}〜` : y);
const numKeys = g => Object.keys(g).filter(k => typeof g[k] === 'number');

function rankModel(slug, rk) {
  const b = BASIS[slug], r = b[rk] || {}, s = SALARY[slug][rk];
  const e = r.est;
  /* 推定は、根拠・算出方法・時点の3つがそろったときだけ。 */
  const est = e && e.basis && e.method && e.as_of
    ? { man: s.avg, text: yen(s.avg), basis: e.basis, method: e.method, asOf: e.as_of } : null;
  const figs = [];
  for (const g of r.groups || []) for (const key of RANK_KEYS) {
    if (typeof g[key] !== 'number') continue;
    const man = toMan(b.cur, g[key]);
    figs.push({ key, man, group: g.name, orig: origOf(b.cur, g[key]), text: figText(key, yen(man)) });
  }
  return { est, figs, cap: figs.find(f => f.key === 'max_y') || null,
           co: figs.find(f => f.key === 'target_y' || f.key === 'cash_y_over') || null };
}
/* その職位に、いま出せるいちばん確かな1つ：推定 → 求人の上限 → 会社の公表額 → 確認中（目盛の右端を決めるのに使う）。 */
function markOf(slug, rk) {
  const m = rankModel(slug, rk);
  if (m.est) return { kind: 'est', man: m.est.man, text: m.est.text, label: '推定年収' };
  if (m.cap) return { kind: 'cap', man: m.cap.man, text: m.cap.text, label: LABEL.max_y };
  if (m.co) return { kind: m.co.key === 'cash_y_over' ? 'over' : 'co', man: m.co.man, text: m.co.text, label: LABEL[m.co.key] };
  return { kind: 'none', man: null, text: '確認中', label: '' };
}
function crewModel(slug) {
  const b = BASIS[slug];
  return ((b.crew && b.crew.groups) || []).filter(g => typeof g.avg_y === 'number').map(g => {
    const m = /^(.*?)（(.*)）$/.exec(g.name);
    const parts = m ? m[2].split('・') : [];
    return { man: toMan(b.cur, g.avg_y), who: m ? m[1] : g.name, when: parts[parts.length - 1] || '' };
  });
}
const traineeModel = slug => {
  const b = BASIS[slug];
  return ((b.trainee && b.trainee.groups) || []).filter(g => typeof g.start_m === 'number')
    .map(g => ({ group: g.name, text: `約${toMan(b.cur, g.start_m)}万円` }));
};
/* 目盛の右端：画面に出るいちばん大きい額を 1,000万の刻みへ切り上げる。 */
const AXIS = (() => {
  const all = FIVE.flatMap(s => [...RANKS.map(([rk]) => markOf(s, rk).man), ...crewModel(s).map(c => c.man)]).filter(n => n != null);
  return Math.ceil(Math.max(...all) / 1000) * 1000;
})();
const widthOf = m => `${Math.min(100, (m / AXIS) * 100).toFixed(2)}%`;

/* ══════════════════════════════════════════════════════════════════
   HTML を読む道具（生成物なので形は機械が決めている。読めなければ、それ自体を赤にする）
   ══════════════════════════════════════════════════════════════════ */
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const text = h => unesc(h.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
/* 読み上げ専用の字・職位の札・「上限」の札を外して、目に見える本文だけにする。 */
const without = (h, ...cls) => cls.reduce((x, c) =>
  x.replace(new RegExp(`<(span|b|small) class="${c}(?: [^"]*)?"[^>]*>[^<]*</\\1>`, 'g'), ''), h);
const blocksOf = (html, name) => [...html.matchAll(new RegExp(`<!--${name}-->([\\s\\S]*?)<!--/${name}-->`, 'g'))].map(m => m[1]);
const one = (h, re) => (re.exec(h) || [])[1] ?? null;
/* i 文字めが、div の何段めに在るか。 */
const depthAt = (h, i) => (h.slice(0, i).match(/<div\b/g) || []).length - (h.slice(0, i).match(/<\/div>/g) || []).length;

const PAGES = Object.fromEntries(FIVE.map(s => [s, read(pageOf(s))]));
const PART = {};
for (const s of FIVE) {
  const html = PAGES[s];
  const g = blocksOf(html, 'PV-GLANCE')[0] || '';
  const pay = one(g, /<article class="pvg-card pvg-pay">([\s\S]*?)\n<\/article>/) || '';
  const cut = pay.indexOf('<details class="pvg-dt pvg-paydt">');
  PART[s] = {
    hero: blocksOf(html, 'PV-HERO')[0] || '',
    glance: g,
    pay,
    payTop: cut < 0 ? pay : pay.slice(0, cut),
    payDt: cut < 0 ? '' : pay.slice(cut),
  };
}

/* ══════════════════════════════════════════════════════════════════
   A) 生成物
   ══════════════════════════════════════════════════════════════════ */
head('生成物');
ok(same(GLANCE, FIVE), '対象は主要5社（JAL・ANA・キャセイ・エティハド・エバー）', GLANCE.join(', '));
for (const s of FIVE) {
  const html = PAGES[s];
  ok(build(s, html) === html, `${pageOf(s)} は gen-airline-glance.mjs の出力と1文字も違わない`,
     `node gen-airline-glance.mjs ${s} を流す（pv-glance.css / pv-glance.js / career-live.* を直したあとも）`);
  for (const n of ['PV-HERO', 'PV-GLANCE-HEAD', 'PV-GLANCE', 'PV-GLANCE-JS']) {
    ok(blocksOf(html, n).length === 1, `${s}: 管理ブロック ${n} がちょうど1つ`, `${blocksOf(html, n).length}個`);
  }
  ok((html.match(/<h1\b/g) || []).length === 1, `${s}: h1 は1つだけ`);
  ok(/<body\b[^>]*\bdata-pv-glance="1"/.test(html), `${s}: <body data-pv-glance="1"> が在る`);
  for (const f of ASSETS) {
    const v = createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
    const hit = html.split(`"../${f}?v=${v}"`).length - 1;
    ok(hit === 1, `${s}: ${f} を今の中身の指紋で1回だけ読んでいる`, `?v=${v} が ${hit}回`);
  }
  ok(PART[s].pay && PART[s].payDt && PART[s].hero, `${s}: 給与の箱・説明・社名の行を読み取れた`);
}
{
  /* この形にしてあるのは5枚だけ（英語版はまだ・ほかの会社は今のまま）。 */
  const marked = [];
  for (const dir of ['airlines', 'en/airlines']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.html') && /data-pv-glance=/.test(read(`${dir}/${f}`))) marked.push(`${dir}/${f}`);
    }
  }
  ok(same(marked.sort(), FIVE.map(pageOf).sort()), 'data-pv-glance を持つのは5枚だけ', marked.join(', '));
}

/* ══════════════════════════════════════════════════════════════════
   B) 給与の箱 ── 4種類の額を混ぜない・正本と一致
   ══════════════════════════════════════════════════════════════════ */
head('台帳の形（この検査が知っている形か）');
for (const s of FIVE) {
  const b = BASIS[s];
  ok(b.cur === 'JPY' || typeof JPY_PER[b.cur] === 'number', `${s}: 通貨 ${b.cur} の換算レートが在る`);
  for (const [rk] of RANKS) {
    const r = b[rk] || {};
    const odd = (r.groups || []).flatMap(g => numKeys(g).filter(k => !RANK_KEYS.includes(k)));
    ok(!odd.length, `${s} ${rk}: 台帳の額の鍵は検査が知っているものだけ`, `知らない鍵: ${odd.join(', ')}（どの欄にどの印で出すかを決めてから、検査に足す）`);
    ok(!(r.est && r.est_status === 'unconfirmed'), `${s} ${rk}: 「未確認」の印と推定の根拠が同時に付いていない`);
    const e = r.est;
    ok(!e || (e.basis && e.method && e.as_of), `${s} ${rk}: 推定の根拠は 根拠・算出方法・時点 の3つがそろっている`);
  }
  ok(((b.crew && b.crew.groups) || []).every(g => same(numKeys(g), ['avg_y'])), `${s}: 乗員全体の欄に在る額は公表平均だけ`);
  ok(((b.trainee && b.trainee.groups) || []).every(g => same(numKeys(g), ['start_m'])), `${s}: 訓練生の欄に在る額は入社時の月額だけ`);
}

head('給与の箱（画面の額 ⇄ 正本）');
/* 画面の額の欄を1つずつ読む。 */
function figsOf(s) {
  const top = PART[s].payTop, out = [];
  const iCap = top.indexOf('<div class="pvg-rank" data-rank="cap">'), iFo = top.indexOf('<div class="pvg-rank" data-rank="fo">');
  if (!(iCap >= 0 && iFo > iCap)) return { out, shape: false };
  for (const m of top.matchAll(/<div class="pvg-fig ([^"]*)">\n([\s\S]*?)\n<\/div>/g)) {
    const cls = m[1].split(/\s+/), body = m[2], d = depthAt(top, m.index);
    const kind = (cls.find(c => /^pvg-fig-(est|cap|co|crew)$/.test(c)) || '').replace('pvg-fig-', '');
    const who = one(body, /<b class="pvg-who">([^<]*)<\/b>/);
    const wide = cls.includes('pvg-fig-wide');
    const rank = kind === 'crew' ? null
      : wide ? (RANKS.find(([, ja]) => ja === who) || [null])[0]
      : m.index > iFo ? 'fo' : 'cap';
    const k = one(body, /<p class="pvg-k">([\s\S]*?)<\/p>/) || '';
    const amt = one(body, /<p class="pvg-amt">([\s\S]*?)<\/p>/);
    const big = /<p class="pvg-big( pvg-none)?">([^<]*)<\/p>/.exec(body);
    const barM = /<div class="pvg-track"><i class="pvg-bar pvg-bar-([a-z]+)" style="width:([\d.]+%)"><\/i><\/div>/.exec(body);
    out.push({
      key: kind === 'crew' ? 'crew' : `${kind}:${rank}`, kind, rank, wide, depth: d, none: cls.includes('is-none'),
      label: text(without(k, 'pvg-vh', 'pvg-who')), spoken: one(k, /<span class="pvg-vh">([^<]*)<\/span>/) || '',
      amount: amt != null ? text(without(amt, 'pvg-tag')) : big ? big[2] : null,
      bigNone: !!(big && big[1]), tag: amt != null ? one(amt, /<b class="pvg-tag">([^<]*)<\/b>/) : null,
      bar: barM ? [barM[1], barM[2]] : null, tracks: (body.match(/class="pvg-track/g) || []).length,
      orig: one(body, /<span class="pv-no-cur pvg-orig">([^<]*)<\/span>/),
      note: text(without(one(body, /<p class="pvg-note">([\s\S]*?)<\/p>/) || '', 'pvg-prev', 'pv-no-cur pvg-orig')),
      prev: one(body, /<span class="pvg-prev">([^<]*)<\/span>/),
    });
  }
  return { out, shape: true };
}
for (const s of FIVE) {
  const { out, shape } = figsOf(s);
  ok(shape, `${s}: 機長 → 副操縦士 の順に欄が在る`);
  const by = Object.fromEntries(out.map(f => [f.key, f]));
  ok(Object.keys(by).length === out.length, `${s}: 同じ種類の額の欄が2つ無い`, out.map(f => f.key).join(', '));
  const want = [];
  const crew = crewModel(s);
  for (const [rk, rkJa] of RANKS) {
    const m = rankModel(s, rk);
    want.push(`est:${rk}`);
    const e = by[`est:${rk}`];
    if (!e) { ok(false, `${s} ${rkJa}: 推定年収の欄が在る`); continue; }
    ok(e.label === '推定年収' && e.depth === 2, `${s} ${rkJa}: 推定年収の欄は職位の列の中に在る`, `${e.label}・深さ ${e.depth}`);
    if (m.est) {
      ok(!e.none && !e.bigNone && e.amount === m.est.text, `${s} ${rkJa}: 推定年収は正本の額`, `${e.amount}（正本 ${m.est.text}）`);
      ok(same(e.bar, ['est', widthOf(m.est.man)]), `${s} ${rkJa}: 推定の棒は平らな棒で、長さは額どおり`, `${e.bar}（あるべき est,${widthOf(m.est.man)}）`);
      ok(e.note.includes(m.est.basis), `${s} ${rkJa}: 推定の額のすぐ下に根拠が書いてある`, e.note);
    } else {
      ok(e.none && e.bigNone && e.amount === '確認中', `${s} ${rkJa}: 根拠がそろわない推定は「確認中」`, String(e.amount));
      ok(e.tracks === 0 && !e.orig, `${s} ${rkJa}: 「確認中」に棒も額も添えない`);
    }
    for (const [kind, f] of [['cap', m.cap], ['co', m.co]]) {
      const key = `${kind}:${rk}`;
      if (!f) { ok(!by[key], `${s} ${rkJa}: 台帳に無い${kind === 'cap' ? '求人の上限' : '会社の公表額'}の欄が無い`); continue; }
      want.push(key);
      const a = by[key];
      if (!a) { ok(false, `${s} ${rkJa}: ${LABEL[f.key]}の欄が在る`); continue; }
      ok(a.label === LABEL[f.key], `${s} ${rkJa}: 欄の名前は「${LABEL[f.key]}」`, a.label);
      ok(a.amount === f.text, `${s} ${rkJa}: ${LABEL[f.key]}は正本の額`, `${a.amount}（正本 ${f.text}）`);
      ok(a.orig === f.orig, `${s} ${rkJa}: 原貨の額は台帳のまま`, `${a.orig}（台帳 ${f.orig}）`);
      const bk = kind === 'cap' ? 'cap' : f.key === 'cash_y_over' ? 'over' : 'co';
      ok(same(a.bar, [bk, widthOf(f.man)]), `${s} ${rkJa}: 棒の種類と長さが額どおり`, `${a.bar}（あるべき ${bk},${widthOf(f.man)}）`);
      ok(a.spoken.includes(nameOf(s)) && (a.wide ? a.rank === rk : a.spoken.includes(rkJa)), `${s} ${rkJa}: 読み上げに社名と職位が入っている`, a.spoken);
      ok(a.wide ? a.depth === 0 : a.depth === 2, `${s} ${rkJa}: 欄の置き場所が職位と合っている`, `深さ ${a.depth}`);
      if (kind === 'cap') {
        /* 上限の3つの印：「〜」・「上限」の札・斜線の棒（斜線が本当に描かれているかはブラウザで見る）。 */
        ok(a.amount.startsWith('〜') && a.tag === '上限' && a.bar && a.bar[0] === 'cap', `${s} ${rkJa}: 上限の額に「〜」と「上限」の札と上限の棒がそろう`, `${a.amount}・札 ${a.tag}・棒 ${a.bar}`);
      } else {
        ok(!a.amount.startsWith('〜') && a.tag == null, `${s} ${rkJa}: 会社の公表額に上限の印を付けない`);
        ok(f.key !== 'cash_y_over' || a.amount.endsWith('超'), `${s} ${rkJa}: 下限の額には「超」が付く`, a.amount);
      }
    }
  }
  /* 乗員全体の公表平均：機長・副操縦士の列の外。 */
  if (crew.length) {
    want.push('crew');
    const c = by.crew;
    if (!c) ok(false, `${s}: 乗員全体の公表平均の欄が在る`);
    else {
      ok(c.depth === 0 && c.wide, `${s}: 乗員全体の平均は、機長・副操縦士の列の外に在る`, `深さ ${c.depth}`);
      ok(c.label === `${crew[0].who}全体（機長と副操縦士をあわせた平均）`, `${s}: 欄の名前が「全体（機長と副操縦士をあわせた平均）」`, c.label);
      ok(c.amount === yen(crew[0].man) && c.tag == null, `${s}: 乗員全体の平均は正本の額`, `${c.amount}（正本 ${yen(crew[0].man)}）`);
      ok(same(c.bar, ['crew', widthOf(crew[0].man)]), `${s}: 乗員全体の棒は別の色で、長さは額どおり`, String(c.bar));
      ok(c.note.includes('会社の公表') && c.note.includes(crew[0].when), `${s}: 乗員全体の平均に「会社の公表」と時点が添えてある`, c.note);
      ok(crew[1] ? c.prev === `${crew[1].when} ${yen(crew[1].man)}` : c.prev == null, `${s}: 前の期の額は台帳のとおり`, String(c.prev));
    }
  } else ok(!by.crew, `${s}: 台帳に無い乗員全体の平均の欄が無い`);
  ok(same(Object.keys(by).sort(), want.sort()), `${s}: 額の欄は台帳に在るものだけ`, `${Object.keys(by).sort()} ／ あるべき ${want.sort()}`);

  /* 「平均」と書いてよいのは、乗員全体の公表平均の欄だけ（推定も公表額も平均と呼ばない）。 */
  const top = PART[s].payTop;
  const noCrew = top.replace(/<div class="pvg-fig pvg-fig-crew[^"]*">\n[\s\S]*?\n<\/div>/g, '');
  ok(!/平均/.test(text(noCrew)), `${s}: 給与の箱で「平均」と書くのは、乗員全体の公表平均の欄だけ`, (text(noCrew).match(/.{0,16}平均.{0,16}/) || [''])[0]);
  ok(!/平均年収/.test(text(PART[s].glance.replace(/<script\b[\s\S]*?<\/script>/g, ''))), `${s}: 「平均年収」と書かない`);
  ok(one(top, /<span class="pvg-chip">([^<]*)<\/span>/) === BASIS[s].tax, `${s}: 税の扱いの札は台帳のまま`, String(one(top, /<span class="pvg-chip">([^<]*)<\/span>/)));
}

head('給与の説明（誰の・何を含んだ・いつの金額か）');
for (const s of FIVE) {
  const dt = PART[s].payDt;
  const dl = one(dt, /<dl class="pvg-dl">([\s\S]*?)<\/dl>/) || '';
  const rows = [...dl.matchAll(/<div><dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map(m => ({
    dt: text(m[1]), b: text(one(m[2], /<b>([\s\S]*?)<\/b>/) || ''), orig: one(m[2], /<span class="pv-no-cur pvg-orig">([^<]*)<\/span>/) || '',
    small: [...m[2].matchAll(/<small>([\s\S]*?)<\/small>/g)].map(x => text(x[1])),
  }));
  const want = [];
  for (const [rk, rkJa] of RANKS) {
    const m = rankModel(s, rk);
    want.push([`${rkJa}の推定年収`, m.est ? m.est.text : '確認中', '']);
    for (const f of m.figs) want.push([f.group, f.text, f.orig]);
    const r = rows.find(x => x.dt === `${rkJa}の推定年収`);
    if (m.est) {
      ok(!!r && same(r.small, [`根拠：${m.est.basis}`, `算出方法：${m.est.method}`, `時点：${m.est.asOf}`]),
         `${s} ${rkJa}: 推定の説明に 根拠・算出方法・時点 が台帳のまま出ている`, r ? r.small.join(' ／ ') : '行が無い');
    }
    for (const f of m.figs.filter(x => x.key === 'max_y')) {
      const row = rows.find(x => x.dt === f.group && x.b === f.text);
      ok(!!row && row.b.startsWith('〜') && /上限/.test(row.dt + row.small.join('')), `${s} ${rkJa}: 説明の一覧でも、上限の額に「〜」と「上限」の字が対`, row ? `${row.dt} ${row.b}` : '行が無い');
    }
  }
  for (const c of crewModel(s)) want.push([`${c.who}全体の平均`, yen(c.man), '']);
  for (const t of traineeModel(s)) want.push([t.group, t.text, '']);
  const got = rows.map(r => [r.dt, r.b, r.orig]);
  const srt = a => a.map(x => JSON.stringify(x)).sort();
  ok(same(srt(got), srt(want)), `${s}: 説明の一覧の額は、台帳に在る額と1つずつ合う`,
     `画面だけ: ${srt(got).filter(x => !srt(want).includes(x)).join(' ')} ／ 台帳だけ: ${srt(want).filter(x => !srt(got).includes(x)).join(' ')}`);
  ok(rows.filter(r => /全体の平均$/.test(r.dt)).every(r => r.small.join('').includes('職位ごとの額ではありません')),
     `${s}: 乗員全体の平均に「職位ごとの額ではありません」と添えてある`);
  ok(rows.filter(r => r.b.startsWith('〜')).length === RANKS.flatMap(([rk]) => rankModel(s, rk).figs).filter(f => f.key === 'max_y').length,
     `${s}: 「〜」が付くのは求人の上限だけ`);
  /* 注は台帳の言葉のまま（手で書き足した注は、台帳を直しても動かない）。 */
  const notes = [...dt.matchAll(/<li><span class="pv-no-cur">([\s\S]*?)<\/span><\/li>/g)].map(m => unesc(m[1]));
  ok(notes.every(n => (BASIS[s].notes || []).includes(n)), `${s}: 注は台帳の言葉のまま`, notes.filter(n => !(BASIS[s].notes || []).includes(n)).join(' ／ ').slice(0, 160));
  /* 出どころ：会社の公表ではない資料（報道など）には、そう書く。 */
  const srcs = [...dt.matchAll(/<a class="pvg-src" href="([^"]*)" target="_blank" rel="noopener">([^<]*)<\/a><small>([^<]*)<\/small>/g)].map(m => ({ url: unesc(m[1]), mark: m[3] }));
  const led = BASIS[s].src || [];
  ok(same(srcs.map(x => x.url), led.map(x => x.url)), `${s}: 出どころは台帳の資料と同じ並び`, `${srcs.length}件／台帳 ${led.length}件`);
  ok(led.every((x, i) => !srcs[i] || !!x.secondary === /会社の公表ではない資料/.test(srcs[i].mark)), `${s}: 会社の公表ではない資料に、そう書いてある（会社の資料には書かない）`);
}

/* ══════════════════════════════════════════════════════════════════
   C) ほかの会社の額と棒を並べない
   ══════════════════════════════════════════════════════════════════ */
head('ほかの会社の額と棒を並べない');
/* 社名の行に出している略号と色。 */
const CODE = Object.fromEntries(FIVE.map(s => [s, one(PART[s].hero, /<span class="pvg-code">([^<]*)<\/span>/)]));
const COLOR = Object.fromEntries(FIVE.map(s => [s, one(PART[s].hero, /style="--pvg-c:(#[0-9A-Fa-f]{6})"/)]));
ok(FIVE.every(s => CODE[s] && COLOR[s]) && new Set(Object.values(CODE)).size === 5, '5社の略号と色を社名の行から読めた（略号は重ならない）', JSON.stringify(CODE));
for (const s of FIVE) {
  const g = PART[s].glance.replace(/<script\b[\s\S]*?<\/script>/g, '');
  ok(!/pvg-ruler|pvg-rows|pvg-rowa|data-pvg-rank/.test(g), `${s}: 「5社を同じ目盛で」の箱が無い`);
  const bars = (g.match(/class="pvg-bar /g) || []).length, mine = (PART[s].pay.match(/class="pvg-bar /g) || []).length;
  ok(bars === mine, `${s}: 棒が在るのは給与の箱の中だけ`, `ページ ${bars}本・給与の箱 ${mine}本`);
  const others = FIVE.filter(o => o !== s);
  const t = text(g);
  const named = others.filter(o => t.includes(nameOf(o)));
  ok(!named.length, `${s}: ほかの4社の社名を、この節に出していない`, named.join(', '));
  ok(!/&amp;b=|[?&]b=/.test(PART[s].hero + g), `${s}: 相手を決め打ちした比較の入口が無い（相手は比較の画面で選ぶ）`);
  const axes = [...PART[s].glance.matchAll(/<p class="pvg-axis">([^<]*)<\/p>/g)].map(m => m[1]);
  ok(axes.length === 1 && axes[0].includes(`0 〜 ${yen(AXIS)}`) && !/5社/.test(axes[0]), `${s}: 目盛は 0 〜 ${yen(AXIS)}（5社を比べる言い方をしない）`, axes.join(' ／ '));
}

head('画面に出る額（正本に無い額・止めてある額）');
for (const s of FIVE) {
  /* 給与の箱に出る「¥◯万」は、自分の会社の、正本から作れる額だけ。注（台帳の言葉のまま）は上で照合済みなので外す。 */
  const allowed = new Set([yen(AXIS)]);
  for (const [rk] of RANKS) {
    const m = rankModel(s, rk);
    if (m.est) allowed.add(m.est.text);
    for (const f of m.figs) allowed.add(yen(f.man));
  }
  for (const c of crewModel(s)) allowed.add(yen(c.man));
  const scope = text(PART[s].pay.replace(/<ul class="pvg-notes">[\s\S]*?<\/ul>/g, ''));
  const odd = [...new Set(scope.match(/¥[\d,]+万/g) || [])].filter(t => !allowed.has(t));
  ok(!odd.length, `${s}: 給与の箱の額は、自分の会社の、正本から作れる額だけ`, odd.join(' '));
  const mons = [...new Set(scope.match(/約[\d,.]+万円/g) || [])];
  ok(mons.every(t => traineeModel(s).some(x => x.text === t)), `${s}: 給与の箱の「約◯万円」は訓練生の入社時の額だけ`, mons.join(' '));

  /* 止めてある額（推定を出していない職位の avg / lo / hi）が、社名の行と新しい節のどこにも無い。
     目盛の文（「0 〜 ¥3,000万」）は額ではないので外す。 */
  const all = text((PART[s].hero + PART[s].glance).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<p class="pvg-axis">[^<]*<\/p>/g, ''));
  const held = [];
  for (const o of FIVE) for (const [rk] of RANKS) {
    if (rankModel(o, rk).est) continue;
    for (const n of new Set([SALARY[o][rk].avg, SALARY[o][rk].lo, SALARY[o][rk].hi])) {
      if (new RegExp(`(?<![\\d,.])${n.toLocaleString('en-US')}万`).test(all)) held.push(`${o} ${rk} ${n.toLocaleString('en-US')}万`);
    }
  }
  ok(!held.length, `${s}: 推定を出していない職位の、止めてある額がどこにも出ていない`, held.join(' ／ '));
}

/* ══════════════════════════════════════════════════════════════════
   D) 無い数字を作らない・入口の行き先・写真
   ══════════════════════════════════════════════════════════════════ */
head('出荷する HTML（実データの欄は空で出す）');
const QUESTIONS = JSON.parse(read('pv-conditions.json')).questions;
const QID = new Set(QUESTIONS.map(q => q.id));
/* その話題の入口からだけ出す質問（待遇アンケートのページは、まだこれを開けない）。 */
const TOPIC_ONLY = QUESTIONS.filter(q => q.topicOnly).map(q => q.id).sort();
const linkedTopicOnly = new Set();
for (const s of FIVE) {
  const P = PART[s], both = P.hero + P.glance;
  const boxes = [...both.matchAll(/<div class="crl"([^>]*)>([\s\S]*?)<\/div>/g)];
  ok(boxes.length === 8, `${s}: 実データの欄は8つ`, `${boxes.length}`);
  ok(boxes.every(m => m[2] === '<span class="crl-ph">—</span>' && / data-state="idle"/.test(m[1]) && m[1].includes(` data-airline="${s}"`)),
     `${s}: 実データの欄は「—」で出荷し、自分の会社を指している`);
  ok(!/[★☆⭐✩✪✭✮✯]/u.test(both), `${s}: 星の字を HTML に書いていない`);
  ok(!/aggregateRating|ratingValue|reviewCount/.test(PAGES[s]), `${s}: 評価の点数・件数を検索向けの情報に書いていない`);
  ok(!/準備中/.test(text(both.replace(/<script\b[\s\S]*?<\/script>/g, ''))), `${s}: 「準備中」の入口を置いていない`);
  for (const m of both.matchAll(/data-keys="([^"]*)"/g)) {
    const bad = m[1].split(',').filter(k => !QID.has(k));
    ok(!bad.length, `${s}: 回答の集計を出す欄が指すのは、在る質問だけ`, bad.join(', '));
  }

  /* 入口の行き先 */
  const hrefs = [...both.matchAll(/href="([^"]*)"/g)].map(m => unesc(m[1]));
  const asks = hrefs.filter(h => h.startsWith('../airline-conditions.html'));
  const badAsk = asks.filter(h => { const u = new URL(h, 'http://x/airlines/'); return u.searchParams.get('airline') !== s || !QID.has(u.searchParams.get('q')); });
  ok(asks.length > 0 && !badAsk.length, `${s}: 質問への入口は、自分の会社＋在る質問`, badAsk.slice(0, 3).join(' '));
  for (const h of asks) { const q = new URL(h, 'http://x/airlines/').searchParams.get('q'); if (TOPIC_ONLY.includes(q)) linkedTopicOnly.add(q); }
  ok(hrefs.filter(h => h === `../career.html?view=compare&a=${s}`).length === 1, `${s}: 「比較する」は自分を選んだ比較へ`);
  ok(hrefs.filter(h => h === `../career.html?view=card&a=${s}`).length === 1, `${s}: 「カードにする」は自分のカードへ`);
  ok(hrefs.filter(h => h.startsWith('../pay-report.html')).every(h => h === `../pay-report.html?airline=${s}`), `${s}: 給与の提出は自分の会社を選んだ状態で開く`);
  ok(hrefs.filter(h => /[?&]stay=/.test(h)).every(h => new RegExp(`^\\.\\./career\\.html\\?airline=${s}&stay=[A-Z]{3}$`).test(h)), `${s}: 就航地の入口は自分の会社＋空港の3レター`);
  const known = h => /^https:\/\//.test(h) || h === '#pvg-stay' || /^\.\.\/(airline-conditions|career|pay-report)\.html\?/.test(h) || /^\.\.\/(career-live|pv-glance)\.css\?v=/.test(h);
  ok(hrefs.every(known), `${s}: 知らない形の行き先が無い`, hrefs.filter(h => !known(h)).slice(0, 3).join(' '));
  ok(!hrefs.includes('#pvg-stay') || /id="pvg-stay"/.test(P.glance), `${s}: ページの中の行き先（#pvg-stay）が在る`);
  /* 「募集要項を開く」の行き先は、この節の外に在る昔からの節。見出しで探す（pv-glance.js の SEC と同じ言葉）。 */
  const rest = PAGES[s].split(P.glance).join('');
  ok(!/data-pvg-tab="jobs"/.test(both) || /<h2\b[^>]*>\s*(?:募集要項|採用情報)/.test(rest), `${s}: 「募集要項を開く」の行き先（募集要項の節）がページに在る`);
  ok([...both.matchAll(/data-pvg-tab="([^"]*)"/g)].every(m => m[1] === 'jobs'), `${s}: タブへの入口は「募集要項」だけ（ほかを足したら、行き先の確かめ方も足す）`);
  ok([...both.matchAll(/<a\b[^>]*href="https:[^>]*>/g)].every(m => /target="_blank" rel="noopener"/.test(m[0])), `${s}: 外へのリンクは別の窓で開き、rel="noopener" を持つ`);

  /* 写真：台帳に在る1枚・示すことが条件ならクレジットを付ける。 */
  const ph = primary(s), fig = one(P.glance, /<figure class="pvg-photo">([\s\S]*?)<\/figure>/);
  if (!ph) ok(fig == null, `${s}: 台帳に写真が無ければ、写真を置かない`);
  else {
    const img = one(fig || '', /<img src="\.\.\/([^"]*)"/);
    ok(!!fig && !!img && fs.existsSync(path.join(ROOT, img)) && img.includes(ph.file), `${s}: 写真は台帳の1枚で、ファイルが在る`, String(img));
    const cap = one(fig || '', /<figcaption>([\s\S]*?)<\/figcaption>/) || '';
    if (needsCredit(ph)) {
      ok(text(cap).includes(ph.author) && text(cap).includes(ph.licence) && cap.includes(`href="${ph.source.replace(/&/g, '&amp;')}"`) && cap.includes(`href="${ph.licence_url}"`),
         `${s}: 示すことが条件の写真に、作者とライセンスが付いている`, text(cap));
    }
  }
}
for (const f of ['airline-conditions.html', 'career.html', 'pay-report.html']) ok(fs.existsSync(path.join(ROOT, f)), `行き先のファイルが在る: ${f}`);
ok(same([...linkedTopicOnly].sort(), TOPIC_ONLY), '「その話題の入口からだけ出す」質問（4問）は、全部このページに入口が在る', `${[...linkedTopicOnly].sort()} ／ 台帳 ${TOPIC_ONLY}`);
if (linkedTopicOnly.size) {
  notice(`この ${linkedTopicOnly.size}問（${[...linkedTopicOnly].sort().join('・')}）は、行き先の待遇アンケートのページではまだ開かない。`);
  notice('  会社ページの上で開く回答の板が出来るまで、この入口は押しても答えられない（未完了）。');
}

/* ══════════════════════════════════════════════════════════════════
   E) 見た目の決まり（pv-glance.css・pv-glance.js・airline-base.js）
   ══════════════════════════════════════════════════════════════════ */
head('pv-glance.css');
const CSSC = noCssCmt(read('pv-glance.css'));
const JSC = noJsCmt(read('pv-glance.js'));
ok(!/#[0-9a-fA-F]{3,8}\b/.test(CSSC), '色の直書き（hex）が無い', (CSSC.match(/.{0,20}#[0-9a-fA-F]{3,8}\b/) || [''])[0]);
ok(!/\b(?:rgba?|hsla?)\(/.test(CSSC), '色の直書き（rgb / hsl）が無い');
ok(!/prefers-color-scheme/.test(CSSC), 'prefers-color-scheme を書いていない（ダークはトークンが差し替える）');
{
  const moved = [...CSSC.matchAll(/transition\s*:\s*([^;}]+)/g)]
    .flatMap(m => m[1].replace(/\([^()]*\)/g, '').split(','))
    .map(x => x.trim().split(/\s+/)[0].replace(/!important$/, ''));
  ok(moved.length > 0 && moved.every(p => ['transform', 'opacity', 'none'].includes(p)), 'transition は transform と opacity だけ', [...new Set(moved)].join(', '));
  ok(!/transition\s*:\s*all\b|transition-property\s*:\s*all\b/.test(CSSC), 'transition: all を使っていない');
  const frames = [...CSSC.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .flatMap(m => [...m[1].matchAll(/([\w-]+)\s*:/g)].map(x => x[1]));
  ok(frames.every(p => ['transform', 'opacity'].includes(p)), 'アニメーションは transform と opacity だけ', [...new Set(frames)].join(', '));
  ok(/prefers-reduced-motion\s*:\s*reduce/.test(CSSC), '動きを減らす設定の人には動かさない');
  /* 字の大きさ：12px より小さい指定を書かない（clamp の下限も）。 */
  const sizes = [...CSSC.matchAll(/font(?:-size)?\s*:\s*([^;}]+)/g)].flatMap(m => [...m[1].matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)].map(x => [+x[1], m[0].trim().slice(0, 60)]));
  const tiny = sizes.filter(([n]) => n < 12);
  ok(sizes.length > 0 && !tiny.length, '12px より小さい字を指定していない', tiny.map(x => x[1]).join(' ／ '));
  /* この1枚の決まりは .pvg と .pvg-hero の中だけ（ほかの会社のページへ漏らさない）。 */
  const sels = [...CSSC.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[1].trim())
    .filter(x => x && !/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(x))
    .flatMap(x => x.split(/,(?![^()]*\))/).map(y => y.trim()));
  const loose = sels.filter(x => !/\.pvg(?:-[\w-]+)?\b/.test(x));
  ok(sels.length > 50 && !loose.length, '.pvg / .pvg-hero の外に決まりを書いていない', loose.slice(0, 5).join(' ／ '));
}
head('pv-glance.js・airline-base.js');
ok(!/[¥万円]/.test(JSC), 'pv-glance.js に金額の字（¥・万・円）が無い');
ok(!/\d{4,}/.test(JSC), 'pv-glance.js に4けた以上の数が無い', (JSC.match(/.{0,20}\d{4,}.{0,20}/) || [''])[0]);
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(JSC), 'pv-glance.js は HTML を組み立てない（見せる・隠す・動かすだけ）');
ok(/getAttribute\('data-pv-glance'\)\s*===\s*'1'\)\s*return/.test(noJsCmt(read('airlines/airline-base.js'))),
   'airline-base.js は5枚に、見本の点数を混ぜた評価を足さない');

if (STATIC_ONLY) {
  console.log(`\n══ ${pass} pass / ${fail} fail ══（ブラウザを使う検査は流していない）`);
  process.exit(fail ? 1 : 0);
}

/* ══════════════════════════════════════════════════════════════════
   F) ブラウザ
   ══════════════════════════════════════════════════════════════════ */
const argOf = n => { const i = process.argv.indexOf(n); return i >= 0 ? String(process.argv[i + 1] || '') : ''; };
const ONLY = argOf('--only') ? FIVE.filter(s => argOf('--only').split(',').includes(s)) : FIVE;
const WANT_W = argOf('--sizes') ? argOf('--sizes').split(',').map(Number) : null;
/* 幅・高さ・最上段の組み方。
   高さは「ブラウザのバーを引いたあとの、本当に見える高さ」（assert-hero-fold.mjs と同じ決め方。
   端末の仕様表の数字に戻すと、全部 ✅ のまま実機では入っていない、になる）。
   col ＝ 縦に1列／side ＝ 左に給与・右に3つ縦／row ＝ 横に4つ。
   1001 は左メニューが出る境目＝中身の箱がいちばん狭い。1250 は横4つがいちばん狭い。 */
const VIEWS = [
  [320, 568, 'col'], [351, 640, 'col'], [375, 640, 'col'], [390, 680, 'col'],
  [768, 950, 'side'], [1001, 700, 'side'], [1024, 700, 'side'],
  [1250, 800, 'row'], [1440, 820, 'row'],
].filter(v => !WANT_W || WANT_W.includes(v[0]));
/* 「暮らし」まで最初の1画面に入ると約束している、いちばん狭い幅（これより狭い画面は入らない。下で知らせる）。 */
const FOLD_FROM = 390;
const PARTIAL = ONLY.length !== FIVE.length || !!WANT_W;
const JOBS = Math.max(1, Number(process.env.PV_GLANCE_JOBS) || 3);

if (!(await fetch(`${BASE}/airlines/${FIVE[0]}.html`).then(r => r.ok, () => false))) {
  console.log(`\n  ✗ ${BASE} が動いていない（node serve.mjs を起動してから流す）`);
  console.log(`\n══ ${pass} pass / ${fail + 1} fail ══`);
  process.exit(1);
}
const { default: puppeteer } = await import('puppeteer');

/* 外へは1本も出さない。実データの欄が呼ぶ3つにだけ、決まった返事を返す
   （0件／鍵が掛かったまま）。mode を 'off' にすると全部 500 ＝「読めない時」。 */
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const STUB = [
  [/\/rest\/v1\/rpc\/pv_reviews$/, '{"unlocked":false,"rows":[]}'],
  [/\/rest\/v1\/rpc\/pv_pay_rows$/, '{"ok":true,"state":"locked","rows":[]}'],
  [/\/rest\/v1\/airline_condition_facts$/, '[]'],
];
const trouble = [];
/* 実データの欄が落ち着く（見えている欄が「まだ」「読み込み中」でなくなる）まで待つ。時間では待たない。 */
const SETTLED = () => !!window.PVCurrency && !!document.querySelector('.pvg') &&
  ![...document.querySelectorAll('.pvg .crl, .pvg-hero .crl')].some(n => n.getClientRects().length && /^(idle|loading)$/.test(n.dataset.state));

async function open(browser, slug, w, h, mode) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const seen = { mode, asked: 0, unknown: new Set() };
  p.setDefaultTimeout(30000);
  p.on('pageerror', e => trouble.push(`${slug} ${w}: ${String(e.message).slice(0, 140)}`));
  p.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) trouble.push(`${r.status()} ${r.url()}`); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
  /* 動きの途中を測らない（動きを減らす設定の人の画面で測る）。 */
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setRequestInterception(true);
  p.on('request', r => {
    let u; try { u = new URL(r.url()); } catch { return r.continue(); }
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return r.continue();
    if (u.origin === BASE || LIBS.test(u.hostname)) return r.continue();
    if (/\.supabase\.co$/.test(u.hostname)) {
      const cors = { 'access-control-allow-origin': '*' };
      if (r.method() === 'OPTIONS') {
        return r.respond({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': r.headers()['access-control-request-headers'] || '*' } });
      }
      seen.asked++;
      const hit = seen.mode === 'empty' && STUB.find(([re]) => re.test(u.pathname));
      if (hit) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: hit[1] });
      if (seen.mode === 'empty') seen.unknown.add(`${r.method()} ${u.pathname}`);
      return r.respond({ status: 500, contentType: 'application/json', headers: cors, body: '{"message":"stub"}' });
    }
    return r.abort();
  });
  await p.goto(`${BASE}/airlines/${slug}.html`, { waitUntil: 'load', timeout: 60000 });
  const ready = await p.waitForFunction(SETTLED).then(() => true, () => false);
  await p.evaluate(() => document.fonts.ready.then(() => true));
  await p.evaluate(LIB);
  return { ctx, p, seen, ready };
}

/* ── ページの中で動かす道具（外の変数を1つも使わない） ── */
function LIB() {
  const G = (window.__pvg = {});
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  /* 本当に見えているか：hidden の中・畳んだ <details> の中・display:none を外す。 */
  const on = el => {
    for (let n = el; n && n !== document; n = n.parentElement) if (n.hidden) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) return false;
    return el.getClientRects().length > 0;
  };
  const txt = e => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 38);
  const name = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const hasText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
  const snap = (sel, drop) => $$(sel).map(e => { const c = e.cloneNode(true); for (const x of $$(drop, c)) x.remove(); return c.textContent; }).join('\n');
  G.top = () => scrollTo({ top: 0, left: 0, behavior: 'instant' });

  /* 開いた直後に1回だけ読むもの。 */
  G.base = () => ({
    cur: window.PVCurrency.get(),
    curs: Object.keys(window.PVCurrency.rates),
    h1: $$('h1').length,
    rating: $$('script[type="application/ld+json"]').some(s => /aggregateRating|ratingValue|reviewCount/.test(s.textContent)),
    pay: snap('.pvg-pay', '.crl'),
  });
  G.all = () => snap('.pvg, .pvg-hero', '.crl, script, style');
  G.live = () => $$('.pvg .crl, .pvg-hero .crl').map(e => ({
    kind: e.dataset.live, state: e.dataset.state, air: e.dataset.airline, on: on(e), hero: !!e.closest('.pvg-hero'),
    panel: (e.closest('.pvg-panel') || {}).id || '', text: e.textContent.replace(/\s+/g, ' ').trim(), retry: !!e.querySelector('.crl-retry'),
  }));

  /* ── 切れ・回転・はみ出し・重なり・空き ── */
  G.geom = folded => {
    const R = [], root = document.querySelector('.pvg');
    if (!root || !on(root)) return ['新しい節（.pvg）が見えていない'];
    if (document.documentElement.scrollWidth > innerWidth + 1) R.push(`横あふれ ページ ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const e of $$('.pvg *, .pvg-hero *')) {
      if (!on(e)) continue;
      const cs = getComputedStyle(e);
      /* 1) 切れている字 */
      if (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 2 && !e.classList.contains('pvg-scroll')) R.push(`切れ ${name(e)}「${txt(e)}」${e.scrollWidth} > ${e.clientWidth}`);
      /* 2) 回っている・伸び縮みしている箱（FAQ の決まりの巻き添え） */
      if (cs.transform !== 'none' && /matrix\((?!1, 0, 0, 1,)/.test(cs.transform) && !e.closest('svg') && e.tagName !== 'svg' && !e.classList.contains('pvg-chev')) R.push(`回転 ${name(e)} ${cs.transform}`);
    }
    /* 3) カードの外へ出ている字 */
    for (const card of $$('.pvg-card', root)) {
      if (!on(card)) continue;
      const c = card.getBoundingClientRect();
      for (const e of $$('*', card)) {
        if (!on(e) || e.closest('svg') || e.closest('.pvg-scroll') || e.closest('.pvg-photo') || !hasText(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > c.right + 1 || r.left < c.left - 1)) R.push(`はみ出し ${name(card).slice(0, 40)} › ${name(e)}「${txt(e)}」`);
      }
    }
    /* 3b) 職位の列から出ている額・見出し（カードの内側の余白に隠れて、3) では見つからない）。
           読み上げ専用の字（.pvg-vh）は数えない。字の節と札の箱だけを測る。 */
    for (const rk of $$('.pvg-rank, .pvg-fig-wide', root)) {
      if (!on(rk)) continue;
      const c = rk.getBoundingClientRect();
      for (const e of $$('.pvg-amt, .pvg-big, .pvg-k, .pvg-rk, .pvg-orig', rk)) {
        if (!on(e)) continue;
        let right = -1e9;
        const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          if (!n.nodeValue.trim() || n.parentElement.closest('.pvg-vh')) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) right = Math.max(right, q.right);
        }
        for (const t of $$('.pvg-tag', e)) right = Math.max(right, t.getBoundingClientRect().right);
        if (right > c.right + 0.5) R.push(`列の外 ${name(e)}「${txt(e)}」+${(right - c.right).toFixed(1)}px（列 ${Math.round(c.width)}）`);
      }
    }
    /* 4) 並べる箱の子どうしの重なり */
    for (const box of $$('*', root)) {
      if (!on(box) || !/grid|flex/.test(getComputedStyle(box).display)) continue;
      const kids = [...box.children].filter(k => on(k) && getComputedStyle(k).position !== 'absolute');
      for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
        const x = kids[i].getBoundingClientRect(), y = kids[j].getBoundingClientRect();
        const ox = Math.min(x.right, y.right) - Math.max(x.left, y.left), oy = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
        if (ox > 2 && oy > 2 && x.width && y.width) R.push(`重なり ${name(box).slice(0, 36)} › ${name(kids[i]).slice(0, 30)} × ${name(kids[j]).slice(0, 30)} ${Math.round(ox)}×${Math.round(oy)}`);
      }
    }
    /* 5) 伸びて下が空いたカード（畳んだ形だけ。開いた束は高さがそろわなくて当たり前） */
    if (folded) for (const card of $$('.pvg-more-grid > .pvg-card', root)) {
      if (!on(card) || card.querySelector(':scope > .crl[data-live="stars"][data-state="empty"]')) continue;   // まんなかに置く空の状態
      const c = card.getBoundingClientRect(); let bottom = c.top;
      for (const e of $$('*', card)) { if (on(e) && (hasText(e) || e.tagName === 'IMG')) bottom = Math.max(bottom, e.getBoundingClientRect().bottom); }
      const gap = c.bottom - parseFloat(getComputedStyle(card).paddingBottom) - bottom;
      if (gap > 48) R.push(`空き ${name(card).slice(0, 40)} 下に ${Math.round(gap)}px`);
    }
    return [...new Set(R)];
  };

  /* ── 最上段の4つの箱 ── */
  G.shape = () => {
    const q = s => { const e = document.querySelector(s); if (!e || !on(e)) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY }; };
    return { pay: q('.pvg-pay'), work: q('.pvg [data-cell="work"]'), benefits: q('.pvg [data-cell="benefits"]'), living: q('.pvg [data-cell="living"]'), vh: innerHeight };
  };

  /* ── 棒：描かれた模様と長さ ── */
  const sig = bar => {
    const cs = getComputedStyle(bar), af = getComputedStyle(bar, '::after'), tr = bar.parentElement.getBoundingClientRect(), r = bar.getBoundingClientRect();
    return { kind: ([...bar.classList].find(c => /^pvg-bar-./.test(c)) || '').slice(8), img: cs.backgroundImage, bg: cs.backgroundColor, sh: cs.boxShadow, op: +cs.opacity,
             afi: af.backgroundImage, x: r.left - tr.left, w: r.width, tw: tr.width, sw: bar.style.width };
  };
  /* 額のまわりの印だけを抜く（額そのものは ¤ に置き換える）：「〜¤」「¤超」「確認中」。 */
  const frame = a => { if (!a) return ''; const sp = a.querySelector('.pv-cur'); const t = a.textContent.trim(); return sp ? t.replace(sp.textContent, '¤') : t; };
  G.pay = () => $$('.pvg-pay .pvg-fig').filter(on).map(f => {
    const b = f.querySelector('.pvg-bar'), a = f.querySelector('.pvg-amv') || f.querySelector('.pvg-big') || f.querySelector('.pvg-amt'), t = f.querySelector('.pvg-tag');
    return { fig: ([...f.classList].find(c => /^pvg-fig-(est|cap|co|crew)$/.test(c)) || '').slice(8), frame: frame(a), tag: t && on(t) ? t.textContent.trim() : null, bar: b && on(b) ? sig(b) : null };
  });

  /* ── 通貨 ── */
  G.money = () => {
    const P = window.PVCurrency, spans = $$('.pvg .pv-cur, .pvg-hero .pv-cur');
    const body = snap('.pvg, .pvg-hero', '.pv-no-cur, .crl, script, style');
    return {
      cur: P.get(), n: spans.length,
      same: spans.filter(sp => sp.textContent === sp.dataset.orig).map(sp => sp.dataset.orig),
      off: spans.filter(sp => sp.textContent !== P.fmt(+sp.dataset.jpy)).map(sp => `${sp.dataset.orig} → ${sp.textContent}`),
      left: [...new Set(body.match(/¥\s?\d[\d,.]*万?|\d[\d,.]*\s?億円?|\d[\d,.]*\s?万円|\d[\d,.]*\s?万(?![人件社機回時ド㌦マ])/g) || [])],
      raw: $$('.pvg .pv-no-cur, .pvg-hero .pv-no-cur').map(e => e.textContent),
      pay: $$('.pvg-pay .pvg-fig .pvg-amt .pv-cur, .pvg-pay .pvg-fig .pvg-big .pv-cur').map(e => +e.dataset.jpy).sort((a, b) => a - b),
      payFrames: $$('.pvg-pay .pvg-fig').map(f => frame(f.querySelector('.pvg-amv') || f.querySelector('.pvg-big') || f.querySelector('.pvg-amt'))),
      axis: $$('.pvg .pvg-axis .pv-cur').map(e => +e.dataset.jpy),
    };
  };

  /* ── 小さい字・小さい押し場所・状態の無い押し物 ── */
  let RULES = null;
  const stateRules = () => {
    if (RULES) return RULES;
    const out = { hover: [], 'focus-visible': [], active: [] };
    const split = sel => { const a = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && d === 0) { a.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) a.push(cur.trim()); return a; };
    /* 決まりの形は3つ。
         .x:hover                 … その要素じしん（self）
         .box:has(.x:active)      … .x がその状態の時に、親が変わる（self）
         .box:hover .x .ic        … 自分か親がその状態の時に、自分か自分の中身が変わる（strip）
       隣の要素に付いた状態（+ ~）は数えない。 */
    const walk = rules => {
      for (const r of rules) {
        if (r.selectorText) for (const part of split(r.selectorText)) for (const ps of Object.keys(out)) {
          const i = part.indexOf(':' + ps); if (i < 0) continue;
          const st = []; for (let k = 0; k < i; k++) { if (part[k] === '(') st.push(k); else if (part[k] === ')') st.pop(); }
          const ent = {}, rest = part.slice(i + ps.length + 1);
          if (!st.length) { if (i > 0) ent.self = part.slice(0, i); if (i > 0 && !/[+~]/.test(rest)) ent.strip = part.slice(0, i) + rest; }
          else if (/:has$/.test(part.slice(0, st[st.length - 1]))) ent.self = part.slice(st[st.length - 1] + 1, i);
          if (ent.self || ent.strip) out[ps].push(ent);
        }
        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
      }
    };
    for (const sh of document.styleSheets) { if (/\/(pv-glance|career-live)\.css/.test(sh.href || '')) walk(sh.cssRules); }
    return (RULES = out);
  };
  G.rules = () => { const r = stateRules(); return Object.fromEntries(Object.keys(r).map(k => [k, r[k].length])); };
  const INLINE = 'a.pvg-src, .pvg-photo figcaption a';      // 文の中のリンク（行の高さより大きくできない）
  G.probe = scope => {
    const roots = scope ? $$(scope) : $$('.pvg, .pvg-hero');
    const small = {}, tap = {}, bare = {}, rules = stateRules();
    const nm = el => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}`;
    const m = (el, sel) => { try { return el.matches(sel); } catch (e) { return false; } };
    const q = (el, sel) => { try { return !!el.querySelector(sel); } catch (e) { return false; } };
    const hit = (el, list) => list.some(e => (e.self && m(el, e.self)) || (e.strip && (m(el, e.strip) || q(el, e.strip))));
    for (const r of roots) {
      if (!on(r)) continue;
      const tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement;
        if (!on(el) || el.closest('.pvg-vh')) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) small[`${nm(el)} ${fs}px「${txt(el).slice(0, 14)}」`] = 1;
      }
      for (const el of $$('a[href], button, summary, select', r)) {
        if (!on(el) || getComputedStyle(el).pointerEvents === 'none') continue;
        const miss = Object.keys(rules).filter(ps => !hit(el, rules[ps]));
        if (miss.length) bare[`${nm(el)}「${txt(el).slice(0, 12)}」${miss.join('／')} が無い`] = 1;
        if (el.matches(INLINE)) continue;
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const q = el.getBoundingClientRect();
        if (q.width >= 44 && q.height >= 44) continue;
        /* 見える箱が小さいものは、押して反応する範囲を1px ずつ当てて測る。 */
        const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
        const mine = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
        let W = 0, H = 0;
        if (mine(cx, cy)) {
          let up = 0, dn = 0, lf = 0, rt = 0;
          while (up < 80 && mine(cx, cy - up - 1)) up++;
          while (dn < 80 && mine(cx, cy + dn + 1)) dn++;
          while (lf < 300 && mine(cx - lf - 1, cy)) lf++;
          while (rt < 300 && mine(cx + rt + 1, cy)) rt++;
          W = lf + rt + 1; H = up + dn + 1;
        }
        if (W >= 44 && H >= 44) continue;
        tap[`${nm(el)}「${txt(el).slice(0, 12)}」箱 ${Math.round(q.width)}×${Math.round(q.height)}・押せる ${W}×${H}${W ? '' : '（まんなかが覆われている）'}`] = 1;
      }
    }
    G.top();
    return { small: Object.keys(small), tap: Object.keys(tap), bare: Object.keys(bare) };
  };

  /* ── 動き：板・質問の束 ── */
  G.cells = () => $$('.pvg .pvg-more[aria-controls]').map(b => {
    const pn = document.getElementById(b.getAttribute('aria-controls')), cell = b.closest('.pvg-cell');
    return { id: pn ? pn.id : '', exp: b.getAttribute('aria-expanded'), hidden: pn ? pn.hidden : null, open: !!cell && cell.classList.contains('is-open'), focus: document.activeElement === b };
  });
  G.ask = () => {
    const c = document.querySelector('.pvg-askc');
    return { flat: c.hasAttribute('data-flat'), topics: $$('details.pvg-topic', c).map(t => {
      const li = $$('.pvg-ask li', t), more = t.querySelector('[data-pvg-askmore]');
      return { open: t.open, n: li.length, shown: li.filter(on).length, more: more ? more.textContent.trim() : null, moreOn: !!more && on(more),
               all: t.hasAttribute('data-all'), focus5: !!li[4] && document.activeElement === li[4].querySelector('a') };
    }) };
  };
}

/* ── 測ったものを、正本と突き合わせる ── */
const alpha = c => { let m = /\/\s*([\d.]+)\s*\)$/.exec(c); if (m) return +m[1]; m = /^rgba\(.*,\s*([\d.]+)\)$/.exec(c); if (m) return +m[1]; return c === 'transparent' ? 0 : 1; };
const rgbOf = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
/* 棒は札（class）ではなく、描かれた模様で見る。 */
function barBad(b, kind, hex) {
  const bad = [], plain = b.img === 'none', a = alpha(b.bg), ring = b.sh !== 'none';
  if (b.kind !== kind) bad.push(`棒の種類が ${b.kind}（あるべき ${kind}）`);
  if (kind === 'est' && !(plain && a === 1 && !ring && b.op === 1)) bad.push('推定の棒が、平らな濃い塗りでない');
  if (kind === 'cap' && !(/repeating-linear-gradient/.test(b.img) && ring)) bad.push('上限の棒に斜線が描かれていない');
  if ((kind === 'co' || kind === 'over') && !(plain && a > 0 && a < 1 && ring)) bad.push('会社の公表額の棒が「薄い塗り＋輪郭」でない');
  if (kind === 'co' && /gradient/.test(b.afi)) bad.push('目標年収の棒に「その先」の印が付いている');
  if (kind === 'over' && !/linear-gradient/.test(b.afi)) bad.push('下限の棒に「その先へ続く」印が無い');
  if (kind === 'crew' && !(plain && !ring && b.op < 1)) bad.push('乗員全体の棒が、別の薄い色でない');
  if (hex && kind !== 'crew' && !`${b.img} ${b.bg} ${b.sh}`.includes(rgbOf(hex))) bad.push(`会社の色（${hex}）で描かれていない`);
  if (Math.abs(b.x) > 0.5) bad.push(`0 から始まっていない（${b.x.toFixed(1)}px）`);
  const want = b.tw * parseFloat(b.sw) / 100;
  if (Math.abs(b.w - want) > 1) bad.push(`描かれた長さ ${b.w.toFixed(1)}px（台 ${b.tw.toFixed(1)}px × ${b.sw} ＝ ${want.toFixed(1)}px）`);
  return bad;
}
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
function shapeBad(sh, kind) {
  const { pay, work, benefits, living } = sh;
  if (!(pay && work && benefits && living)) return ['4つの箱のどれかが見えていない'];
  const bad = [];
  if (kind === 'col') {
    if (![work, benefits, living].every(c => near(c.x, pay.x) && near(c.w, pay.w))) bad.push('4つが同じ幅で縦に1列になっていない');
    if (!(pay.b <= work.y + 1 && work.b <= benefits.y + 1 && benefits.b <= living.y + 1)) bad.push('給与 → 勤務 → 待遇 → 暮らし の順でない');
  } else if (kind === 'side') {
    if (!(pay.x + pay.w <= work.x + 1 && near(pay.y, work.y))) bad.push('左に給与・右に勤務が、同じ高さから始まっていない');
    if (![benefits, living].every(c => near(c.x, work.x) && near(c.w, work.w))) bad.push('右の3つが同じ幅で縦に並んでいない');
    if (!(work.b <= benefits.y + 1 && benefits.b <= living.y + 1)) bad.push('右の列が 勤務 → 待遇 → 暮らし の順でない');
    if (!near(pay.b, living.b, 2)) bad.push(`給与の箱の下端（${Math.round(pay.b)}）と、暮らしの下端（${Math.round(living.b)}）がそろっていない`);
  } else {
    const row = [pay, work, benefits, living];
    if (!row.every(c => near(c.y, pay.y) && near(c.h, pay.h))) bad.push(`横に並ぶ4つの高さがそろっていない（${row.map(c => Math.round(c.h)).join('・')}）`);
    if (!row.every((c, i) => !i || row[i - 1].x + row[i - 1].w <= c.x + 1)) bad.push('左から 給与 → 勤務 → 待遇 → 暮らし の順でない');
  }
  return bad;
}
const foldOf = sh => Math.round(Math.max(sh.pay.b, sh.work.b, sh.benefits.b, sh.living.b));
const squash = t => t.replace(/\s+/g, '');
const NO_NUM = /[0-9０-９★☆⭐¥]/u;
const press = async h => { await h.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await h.click(); };
const hard = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: ${ms / 1000}秒で終わらなかった`)), ms))]);

const belowFold = [];           // 約束していない幅で、暮らしが最初の1画面に入らなかったもの（知らせるだけ）

async function runView(browser, s, [w, h, kind]) {
  const tag = `${s} ${w}`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'empty');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const geo = [], small = new Set(), tap = new Set(), bare = new Set();
  const geom = async (label, folded) => { for (const r of await ev(f => window.__pvg.geom(f), folded)) geo.push(`［${label}］${r}`); };
  const probe = async scope => { const r = await ev(sc => window.__pvg.probe(sc), scope); r.small.forEach(x => small.add(x)); r.tap.forEach(x => tap.add(x)); r.bare.forEach(x => bare.add(x)); };
  try {
    ok(ready, `${tag}: 見えている実データの欄が落ち着く（「読み込み中」のまま残らない）`);

    /* ── A) 開いた直後（円・畳んだ形） ── */
    const b0 = await ev(() => window.__pvg.base());
    const curs = b0.curs.filter(c => c !== 'JPY');
    ok(b0.cur === 'JPY' && curs.length >= 3, `${tag}: 日本語ページは円で開く・切り替えられる通貨が在る`, `${b0.cur}／${b0.curs}`);
    const strip = t => t.replace(/<div class="crl"[^>]*><span class="crl-ph">—<\/span><\/div>/g, '');
    ok(squash(b0.pay) === squash(text(strip(PART[s].pay))), `${tag}: 給与の箱の字は、出荷した HTML のまま（画面の上で書き換わらない）`);
    ok(b0.h1 === 1 && !b0.rating, `${tag}: h1 は1つ・評価の点数や件数を検索向けの情報に足していない`, `h1 ${b0.h1}・評価 ${b0.rating}`);
    const live = await ev(() => window.__pvg.live());
    const WANT_STATE = { stars: 'empty', reviews: 'empty', fact: 'empty', realpay: 'locked' };
    const shown = live.filter(x => x.on);
    ok(live.length === 8 && live.every(x => x.air === s), `${tag}: 実データの欄は8つで、自分の会社を指している`, `${live.length}`);
    ok(shown.length >= 5 && shown.every(x => x.state === WANT_STATE[x.kind]), `${tag}: 0件の時は「まだありません」・鍵の無い人の REAL PAY は閉じたまま`, shown.map(x => `${x.kind}:${x.state}`).join(' '));
    ok(live.every(x => !NO_NUM.test(x.text)), `${tag}: 0件の時に、数字・0・星を1つも出さない`, live.filter(x => NO_NUM.test(x.text)).map(x => x.text.slice(0, 30)).join(' ／ '));
    ok(live.filter(x => !x.on).every(x => x.state === 'idle'), `${tag}: 閉じている板の中の欄は、開くまで読みに行かない`);
    const rules = await ev(() => window.__pvg.rules());
    ok(Object.values(rules).every(n => n > 10), `${tag}: hover／focus-visible／active の決まりを読めた`, JSON.stringify(rules));

    await ev(() => window.__pvg.top());
    await geom('円・畳んだ形', true);
    await probe(null);

    const sh0 = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh0, kind).length, `${tag}: 最上段の組み方（${kind === 'col' ? '縦に1列' : kind === 'side' ? '左に給与・右に3つ' : '横に4つ'}）`, shapeBad(sh0, kind).join(' ／ '));

    const pay0 = await ev(() => window.__pvg.pay());
    {
      const bad = [];
      for (const f of pay0) {
        if (f.fig === 'cap' && !(f.frame === '〜¤' && f.tag === '上限' && f.bar && /repeating-linear-gradient/.test(f.bar.img))) bad.push(`上限の3つの印がそろっていない（${f.frame}・札 ${f.tag}）`);
        if (f.fig !== 'cap' && (f.frame.startsWith('〜') || f.tag)) bad.push(`${f.fig} に上限の印が付いている`);
        if (!f.bar) continue;
        const kindOf = f.fig === 'co' ? f.bar.kind : f.fig;      // 公表額は 目標（co）か 下限（over）。どちらかは上で正本と照合済み
        for (const x of barBad(f.bar, kindOf, COLOR[s])) bad.push(`${f.fig}: ${x}`);
      }
      const nBar = RANKS.reduce((n, [rk]) => { const m = rankModel(s, rk); return n + (m.est ? 1 : 0) + (m.cap ? 1 : 0) + (m.co ? 1 : 0); }, 0) + (crewModel(s).length ? 1 : 0);
      if (pay0.filter(f => f.bar).length !== nBar) bad.push(`棒が ${pay0.filter(f => f.bar).length}本（台帳の額は ${nBar}）`);
      ok(!bad.length, `${tag}: 給与の箱の棒 ── 模様が種類どおり・0 から・描かれた長さが指定どおり・上限は3つの印`, bad.slice(0, 6).join(' ／ '));
    }

    /* 額の元の円（通貨を換える時の出発点）が正本の額か。 */
    const m0 = await ev(() => window.__pvg.money());
    {
      const want = [];
      for (const [rk] of RANKS) { const m = rankModel(s, rk); for (const x of [m.est, m.cap, m.co]) if (x) want.push(x.man * 10000); }
      if (crewModel(s).length) want.push(crewModel(s)[0].man * 10000);
      const bad = [];
      if (!same(m0.pay, want.sort((a, b) => a - b))) bad.push(`給与の箱 ${m0.pay}（正本 ${want}）`);
      if (!(m0.axis.length === 1 && m0.axis.every(n => n === AXIS * 10000))) bad.push(`目盛 ${m0.axis}`);
      ok(!bad.length, `${tag}: 通貨を換える元の円（data-jpy）は、正本の額そのもの`, bad.join(' ／ '));
    }

    /* ── A2) 通貨を1つずつ（畳んだ形） ── */
    const all0 = await ev(() => window.__pvg.all());
    const curBad = [], markBad = [], rawBad = [], foldBad = [], shapeCur = [];
    const checkFold = (sh, cur) => {
      const f = foldOf(sh);
      if (f <= h) return;
      if (w >= FOLD_FROM) foldBad.push(`${cur}: 下端 ${f} > ${h}`);
      else belowFold.push([w, h, s, cur, f]);
    };
    checkFold(sh0, 'JPY');
    for (const cur of curs) {
      const now = await ev(c => { window.PVCurrency.set(c); return window.PVCurrency.get(); }, cur);
      if (now !== cur) { curBad.push(`${cur}: 切り替わらない`); continue; }
      const m = await ev(() => window.__pvg.money());
      if (m.n !== m0.n) curBad.push(`${cur}: 額の数が ${m0.n} → ${m.n}`);
      if (m.same.length) curBad.push(`${cur}: 換わらない額 ${m.same.slice(0, 3).join(' ')}`);
      if (m.off.length) curBad.push(`${cur}: 切替メニューと違う作り方の額 ${m.off.slice(0, 3).join(' ')}`);
      if (m.left.length) curBad.push(`${cur}: 円のまま残った字 ${m.left.slice(0, 4).join(' ')}`);
      if (!same(m.payFrames, m0.payFrames)) markBad.push(`${cur}: ${m.payFrames.join(' ')}`);
      if (!same(m.raw, m0.raw)) rawBad.push(cur);
      await ev(() => window.__pvg.top());
      await geom(`${cur}・畳んだ形`, true);
      const sh = await ev(() => window.__pvg.shape());
      for (const x of shapeBad(sh, kind)) shapeCur.push(`${cur}: ${x}`);
      checkFold(sh, cur);
    }
    await ev(() => window.PVCurrency.set('JPY'));
    ok(!curBad.length, `${tag}: どの通貨でも額が全部換わる（円の字が残らない・切替メニューと同じ作り方）`, curBad.slice(0, 5).join(' ／ '));
    ok(!markBad.length, `${tag}: どの通貨でも「〜」「超」「確認中」の印が残る`, markBad.slice(0, 3).join(' ／ '));
    ok(!rawBad.length, `${tag}: 原貨の額と台帳の注は、通貨を換えても1文字も動かない`, rawBad.join(' '));
    ok(!shapeCur.length, `${tag}: どの通貨でも最上段の組み方が崩れない`, shapeCur.slice(0, 4).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBad.length, `${tag}: 最初の1画面（高さ ${h}）に 給与 → 勤務 → 待遇 → 暮らし が入る（どの通貨でも）`, foldBad.join(' ／ '));
    ok((await ev(() => window.__pvg.all())) === all0, `${tag}: 円に戻すと1文字も違わない`);

    /* ── B) 動き ── */
    /* 質問の束（板を開く前に見る。広い画面は最初から開いた形・狭い画面は畳んだ形） */
    {
      const bad = [], a0 = await ev(() => window.__pvg.ask());
      if (kind === 'col') {
        if (a0.flat || a0.topics.some(t => t.open)) bad.push('狭い画面なのに、束が最初から開いている');
        const sum = await p.$('.pvg-askc details.pvg-topic > summary');
        await press(sum);
        const a1 = await ev(() => window.__pvg.ask());
        if (!a1.topics[0].open) bad.push('束の見出しを押しても開かない');
        else if (a1.topics[0].shown !== a1.topics[0].n) bad.push(`開いた束に ${a1.topics[0].shown}／${a1.topics[0].n}問しか出ない`);
        await press(sum);
        if ((await ev(() => window.__pvg.ask())).topics[0].open) bad.push('束の見出しをもう一度押しても閉じない');
      } else {
        if (!a0.flat || !a0.topics.every(t => t.open)) bad.push('広い画面なのに、束が開いた形になっていない');
        await ev(() => document.querySelector('.pvg-askc details.pvg-topic > summary').click());
        if (!(await ev(() => window.__pvg.ask())).topics[0].open) bad.push('開いた形の束が、見出しで閉じてしまう');
        for (const [i, t] of a0.topics.entries()) {
          if (t.more == null) { if (t.shown !== t.n || t.n > 4) bad.push(`束${i + 1}: ${t.n}問のうち ${t.shown}問しか出ない`); continue; }
          if (!(t.shown === 4 && t.moreOn && t.more === `ほか${t.n - 4}問`)) bad.push(`束${i + 1}: 最初の4問と「ほか${t.n - 4}問」になっていない（${t.shown}問・「${t.more}」）`);
          const btn = (await p.$$('.pvg-askc details.pvg-topic'))[i];
          await press(await btn.$('[data-pvg-askmore]'));
          const t1 = (await ev(() => window.__pvg.ask())).topics[i];
          if (!(t1.all && t1.shown === t1.n && !t1.moreOn)) bad.push(`束${i + 1}: 「ほか◯問」を押しても全部は出ない（${t1.shown}／${t1.n}）`);
          if (!t1.focus5) bad.push(`束${i + 1}: 押したあと、5問めへ移らない`);
        }
      }
      ok(!bad.length, `${tag}: 質問の束 ── ${kind === 'col' ? '押すと開く・全部の質問が出る・もう一度で閉じる' : '最初から開いている・4問＋「ほか◯問」・押すと全部出て5問めへ移る'}`, bad.join(' ／ '));
    }

    /* 勤務・待遇・暮らしの板 */
    {
      const bad = [], c0 = await ev(() => window.__pvg.cells());
      if (!(c0.length === 3 && c0.every(c => c.exp === 'false' && c.hidden === true && !c.open))) bad.push('最初は3つとも閉じている、になっていない');
      const HOW = ['Esc', '閉じるボタン', 'もう一度押す'];
      for (const [i, c] of c0.entries()) {
        const btn = await p.$(`.pvg .pvg-more[aria-controls="${c.id}"]`);
        await press(btn);
        const opened = await p.waitForFunction(id => !document.getElementById(id).hidden, { timeout: 8000 }, c.id).then(() => true, () => false);
        if (!opened) { bad.push(`${c.id}: 押しても開かない`); continue; }
        const c1 = await ev(() => window.__pvg.cells());
        if (!c1.every(x => (x.id === c.id) === (x.exp === 'true') && (x.id === c.id) === !x.hidden && (x.id === c.id) === x.open)) bad.push(`${c.id}: 開いているのが、その1枚だけになっていない`);
        const calm = await p.waitForFunction(id => ![...document.getElementById(id).querySelectorAll('.crl')].some(n => n.getClientRects().length && /^(idle|loading)$/.test(n.dataset.state)), {}, c.id).then(() => true, () => false);
        const lv = (await ev(() => window.__pvg.live())).filter(x => x.panel === c.id);
        if (!calm || !lv.length || !lv.every(x => x.on && x.state === 'empty' && !NO_NUM.test(x.text))) bad.push(`${c.id}: 開いた板の集計の欄が「まだありません」にならない（${lv.map(x => x.state)}）`);
        await ev(id => { for (const d of document.getElementById(id).querySelectorAll('details')) d.open = true; }, c.id);
        await geom(`${c.id} を開いた形`, false);
        for (const cur of curs) { await ev(cc => window.PVCurrency.set(cc), cur); await geom(`${c.id} を開いた形・${cur}`, false); }
        await ev(() => window.PVCurrency.set('JPY'));
        await probe('#' + c.id);
        /* 閉じ方は3通り。1枚ずつ違う閉じ方で確かめる。 */
        if (i === 0) { await btn.focus(); await p.keyboard.press('Escape'); }
        else if (i === 1) await press(await p.$(`#${c.id} .pvg-x`));
        else await press(btn);
        const closed = await p.waitForFunction(id => document.getElementById(id).hidden, { timeout: 8000 }, c.id).then(() => true, () => false);
        const c2 = (await ev(() => window.__pvg.cells())).find(x => x.id === c.id);
        if (!closed || c2.exp !== 'false' || c2.open) bad.push(`${c.id}: ${HOW[i]}で閉じない`);
        else if (i < 2 && !c2.focus) bad.push(`${c.id}: ${HOW[i]}で閉じたあと、押したボタンへ戻らない`);
      }
      ok(!bad.length, `${tag}: 勤務・待遇・暮らしの板 ── 押すとその1枚だけ開く・Esc／閉じるボタン／もう一度押す で閉じる・元のボタンへ戻る`, bad.join(' ／ '));
    }

    /* ── C) 折りたたみを全部開いた形 ── */
    await ev(() => { for (const d of document.querySelectorAll('.pvg details')) d.open = true; });
    await geom('全部開いた形', false);
    for (const cur of curs) { await ev(c => window.PVCurrency.set(c), cur); await geom(`全部開いた形・${cur}`, false); }
    await ev(() => window.PVCurrency.set('JPY'));
    await probe(null);

    ok(!geo.length, `${tag}: 切れ・はみ出し・重なり・回転・空きが無い（畳んだ形／板／全部開いた形 × 全通貨）`, `${geo.length}件\n      ${geo.slice(0, 10).join('\n      ')}`);
    ok(!small.size, `${tag}: 字はどれも 12px 以上`, [...small].slice(0, 8).join('\n      '));
    ok(!tap.size, `${tag}: 押す場所はどれも 44×44px 以上（押して反応する範囲を当てて測る）`, [...tap].slice(0, 8).join('\n      '));
    ok(!bare.size, `${tag}: 押せるものは全部 hover／focus-visible／active を持つ`, [...bare].slice(0, 8).join('\n      '));

    /* ── 最後に、「募集要項を開く」 ──
       採用情報のタブが在る会社は、そのタブへ移る。無い会社（JAL・ANA は「企業トップ」の面の下に在る）は、その節へ寄る。
       どちらでも、押したあとに募集要項が画面に出ている。
       （無いタブへ切り替えると、どの面も選ばれず、ページの中身がぜんぶ消える。実際にそうなっていた。） */
    const hasTab = await ev(() => !!document.querySelector('#airline-tab-nav .airline-tab-btn[data-tab="jobs"]'));
    await press(await p.$('.pvg [data-pvg-tab="jobs"]'));
    const jobsAt = () => {
      const on = e => !!e && e.checkVisibility({ visibilityProperty: true });
      const h2 = [...document.querySelectorAll('.glass h2')].find(x => /募集要項|採用情報/.test(x.textContent) && !x.closest('.pvg'));
      const box = h2 && h2.closest('.glass'), act = document.querySelector('#airline-tab-nav .airline-tab-btn.active');
      return {
        top: box && on(box) ? Math.round(box.getBoundingClientRect().top) : null, vh: innerHeight,
        tab: act ? act.dataset.tab : '', pvg: on(document.querySelector('.pvg')),
        faces: [...document.querySelectorAll('[data-tab-section]')].filter(on).length,
      };
    };
    /* 見出しが固定ヘッダーの下に隠れず、節の頭から読める高さに在る */
    await p.waitForFunction(`(() => { const a = (${jobsAt})(); return a.top !== null && a.top >= 60 && a.top <= a.vh - 120; })()`, { timeout: 8000 }).catch(() => {});
    const at = await ev(jobsAt);
    ok(at.faces > 0, `${tag}: 「募集要項を開く」を押しても、ページの中身が消えない`, JSON.stringify(at));
    ok(at.top !== null && at.top >= 60 && at.top <= at.vh - 120, `${tag}: 「募集要項を開く」で、募集要項が画面に出る`, JSON.stringify(at));
    ok(hasTab ? at.tab === 'jobs' && !at.pvg : at.tab === 'overview' && at.pvg,
       `${tag}: 採用情報のタブが${hasTab ? '在るので、そこへ移る' : '無いので、面を替えずにその節へ寄る'}`, JSON.stringify(at));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている3つだけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* 「読めない時」：サーバーが全部 500 を返す。数字や 0 を出さない・やり直せる・最初の1画面を押し出さない。 */
async function runOff(browser, s, [w, h, kind]) {
  const tag = `${s} ${w}（読めない時）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'off');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    /* 口コミの欄は、すぐ上の星の欄が同じ知らせを出しているあいだは出さない（同じ文を2回出さない）。 */
    ok(live.length >= 4 && live.every(x => x.state === 'error' && x.retry), `${tag}: 見えている欄は全部「いま読み出せません」＋やり直すボタン`, live.map(x => `${x.kind}:${x.state}`).join(' '));
    ok(live.every(x => !NO_NUM.test(x.text)), `${tag}: 読めない時に、数字・0・星を1つも出さない`, live.filter(x => NO_NUM.test(x.text)).map(x => x.text.slice(0, 30)).join(' ／ '));
    await ev(() => window.__pvg.top());
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 最上段の組み方が崩れない`, shapeBad(sh, kind).join(' ／ '));
    ok(foldOf(sh) <= h, `${tag}: それでも最初の1画面（高さ ${h}）に 暮らし まで入る`, `下端 ${foldOf(sh)}`);
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    const pr = await ev(() => window.__pvg.probe(null));
    ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    /* サーバーが戻ったあと、やり直すボタンで読み直せる。 */
    seen.mode = 'empty';
    const before = seen.asked;
    await press(await p.$('.pvg-hero .crl .crl-retry'));
    const back = await p.waitForFunction(() => document.querySelector('.pvg-hero .crl').dataset.state === 'empty', { timeout: 15000 }).then(() => true, () => false);
    ok(back && seen.asked > before, `${tag}: 「やり直す」でもう一度読みに行き、読めたら直る`, `問い合わせ ${before} → ${seen.asked}`);
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

head(`ブラウザ（${ONLY.length}社 × ${VIEWS.length}つの幅 × 全通貨）`);
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
try {
  const work = [];
  for (const s of ONLY) for (const v of VIEWS) work.push(() => runView(browser, s, v));
  for (const s of ONLY) for (const v of VIEWS.filter(x => x[0] === 390 || x[0] === 1440)) work.push(() => runOff(browser, s, v));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, work.length) }, async () => {
    while (next < work.length) {
      const job = work[next++];
      await hard(job(), 240000, 'ページ1枚').catch(e => ok(false, '時間内に測り終える', String(e && e.message)));
    }
  }));

  if (belowFold.length) {
    const by = {};
    for (const [w, h, s, , f] of belowFold) { const k = `幅 ${w}（高さ ${h}）`; by[k] = by[k] || {}; by[k][s] = Math.max(by[k][s] || 0, f); }
    for (const k of Object.keys(by)) notice(`${k} では「暮らし」が最初の1画面に入らない（下端 ${Object.entries(by[k]).map(([s, f]) => `${s} ${f}`).join('・')}）。約束しているのは幅 ${FOLD_FROM} から。`);
  }
  head('ページの中のエラー');
  ok(!trouble.length, '例外が出ていない・自サイトのファイルが全部読める', [...new Set(trouble)].join('\n      '));
} finally {
  await browser.close();
}
if (PARTIAL) notice('会社か幅を絞って流した。緑でも、全部を見たことにはならない。');
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
