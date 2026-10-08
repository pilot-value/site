/* ══════════════════════════════════════════════════════════════════
   assert-airline-glance.mjs — 主要5社の会社ページ（給与・勤務・待遇・暮らしの1画面と、その下）

   この5枚は「普通に見えたまま静かに嘘になる」形をいくつも持っている。1つずつ見張る。

     ① 年収の欄を「確認中」にしない ── 機長も副操縦士も、必ず推定年収（SALARY の avg）を額で出す
        （2026-09-30・10-01・10-06 オーナー指示。「平均」をやめたのであって「数字」をやめたのではない）。
        ⚠️ 根拠がそろわないからと額を下げない。そろっていない事は、説明の中の「当サイトの推定」で言う。
     ①' 種類の違う額を混ぜない ── 棒は推定年収の2本だけ。会社が公表している額
        （求人の上限・目標年収・下限・乗員全体の平均）は、棒の無い別の一覧に置く
        （物差しの違う額を同じ目盛の棒で並べない）。上限には「〜」・下限には「超」が必ず付く。
        乗員全体の平均は、機長・副操縦士の額と取り違えられない言葉で出る。
     ② 画面の額が正本とずれる ── 額は gen-airline-glance.mjs が pv-airline-view.mjs 経由で書く。
        ここでは**あちらの viewOf()・payOf() を呼ばずに**、SALARY・BASIS・JPY_PER から
        同じ答えを作り直して突き合わせる（呼んでしまうと、あちらが間違えた日に検査も一緒に間違える）。
        幅（lo / hi）のように、この箱に出すと決めていない額が出ていないことも見る。
     ③ 棒が歪む・違う物差しの額を並べる ── 棒は 0 から・描かれた長さが額に比例・目盛は5枚で同じ。
        ⚠️ ほかの会社の額と棒を、この1枚に並べない（2026-10-06 オーナー指示で「5社を同じ目盛で」の箱を外した。
           推定・求人の上限・会社公表の目標・会社公表の下限は物差しが違い、棒の長さを比べても何も分からない）。
     ④ 無い数字を作る ── 出荷する HTML に件数・星・評価が1つも無い（実データの欄は「—」で出荷）。
        読めない時に、数字や 0 を出さない。
     ⑤ 入口が違う所へ行く ── 質問は自分の会社＋在る質問・比較は自分＋相手・カードは自分。
     ⑥ 切れる・はみ出す・重なる ── 9つの幅 × 全通貨で測る（円だけ・スマホの幅だけで確かめない）。
        最初の1画面に入るもの ── 広い画面（幅 768 から）は 会社概要 と 年収の額。
        スマホは 会社概要（紹介の文まで）で、年収の額はそのすぐ下
        （2026-10-07 オーナーのご指示で、会社の紹介の文を最上段の会社のカードへ入れた。
          そのぶんスマホでは額が1画面めのすぐ下へ下がる。間に別の箱を挟まないことを見張る）。
     ⑦ 通貨 ── 切り替えると額が変わり、「〜」「超」の印と原貨の額は残り、円に戻すと1文字も違わない。
     ⑧ さわり心地 ── 押せるものに hover／focus-visible／active・動かすのは位置と濃さだけ・
        色はトークンだけ・字 12px 以上・押す場所 44px 以上
        （見える箱ではなく、**押して反応する範囲**を実際に当てて測る）。
     ⑨ 生成物が古い ── 5枚は生成スクリプトの出力と1文字も違わない・
        読む部品の指紋（?v=）が今の中身と合っている。

     ⑩ 提出された年収の一覧 ── 給与の1枚の中、推定年収のすぐ下に在る（どの幅でも。2026-10-07 オーナーのご指示で1枚にした）。
        その右（広い画面）か下（狭い画面）が、評価スコアのカード。
        鍵の無い人（未ログイン・未提出）には
        **数字の入っていない板**で出す（サーバーが額・職位・機種を送っていない。ぼかしは飾り）。
        2行のボタン「Give & Get／全ての給与情報を解放する」が、自分の会社を選んだ給与の提出へ行く（「閲覧条件」は REAL PAY へ）。
        ⚠️ 鍵を開けるかどうかを決めるのはサーバー（db/pay-rows.sql）。ここに条件を足さない。

     ⑫ 重ねて言わない（2026-10-07）── 会社の紹介の文は最上段の会社のカードに1回だけ（下の「◯◯について」の節は置かない）。
        会社どうしの比較表をこのページに置かない（比較は「他社と比較」の先に在る）。

     ⑪ 評価スコア（2026-10-06 オーナーのご指示「企業トップのどこかのカードに残して」）──
        社名の行の星と、カードの総合点・6角形の図は、**点数の付いた本物の投稿だけ**から出る（career-live.js）。
        ★投稿が0件の時に、見本の点数を出さない（0件に仮スコアを出さない）。
          社名の行は「評価未取得」・カードは「会員からの投稿はまだありません」と、書く入口が1つだけ
          （2行のボタン。概要では「Give & Get／口コミを解放する」・口コミのタブでは「Give & Get／全ての口コミデータを解放する」）。
          投稿が在る時の答え（総合点・件数・星・図）は、偽のサーバーが返した行からここで計算し直して突き合わせる。
        読めない時は点数を出さない。出荷する HTML には数字を書かない（「—」）。
        ★同日のご指示「現行みたいにデカデカと…入れる必要ないけど、パッと見てわかるようにして」「レーダー図はいれて」
          ── 欄の高さに上限を置く。図の形は、描かれた頂点の位置を測って点数と突き合わせる。

   実データの欄（⭐・口コミ・REAL PAY・回答の集計）は、**決まった返事を返す偽のサーバー**で描かせる
   （0件／鍵の無い人に返る伏せた行／読めない）。本番の DB は読まない ＝ 毎回同じ答えになる。
   ⚠️ なので、ここが保証するのは「0件の時」「鍵の無い時」「読めない時」だけ。
      実際の投稿が入った時の形（点数に投稿が混ざる・口コミが並ぶ・鍵が開いて額が並ぶ）は、この検査は見ていない。

   使い方（node serve.mjs を起動した状態で）
     node assert-airline-glance.mjs            全部
     node assert-airline-glance.mjs --static   ブラウザを使わない所だけ
     node assert-airline-glance.mjs --only etihad --sizes 390,1440   調べる時だけ（会社と幅を絞る。緑でも全部を見たことにはならない）
     node assert-airline-glance.mjs --scenes off,cards               調べる時だけ（場面を絞る：view・off・rows・rated・tabs・cards）
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
import { build, pageOf, ASSETS, CONTRIB, STAY, TABBED } from './gen-airline-glance.mjs';
import { networkOf } from './airline-destinations.mjs';
import { primary as placePhoto, needsCredit as placeCredit, src as placeSrc, HELD as PLACE_HELD } from './place-photos.mjs';
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
const LABEL = { max_y: '求人の上限', target_y: '目標年収', cash_y_over: '下限' };
const KIND = { max_y: 'cap', target_y: 'co', cash_y_over: 'over' };
const EST_BY = '当サイトの推定（公開情報からの推計）';
const UNLOCK = '全ての待遇データを解放する';
/* ★2026-10-07 会社ページの入口は2行のボタン（オーナーのご指示。前日の「匿名で給与を提出する」より新しい）。
     給与          Give & Get ／ 全ての給与情報を解放する
     口コミ（概要）  Give & Get ／ 口コミを解放する
     口コミ（タブ）  Give & Get ／ 全ての口コミデータを解放する
   給与を出して開くのは REAL PAY だけなので、「全ての待遇データ」とは会社ページに書かない（出せば全部見られると読める）。
   言葉を替えただけで、行き先も、開く条件も変えていない（条件を決めるのはサーバー）。 */
const GG = 'Give & Get';
const GIVE = '全ての給与情報を解放する', TERMS = '閲覧条件';
const RV_GIVE = { overview: '口コミを解放する', reviews: '全ての口コミデータを解放する' };
/* このページに置かない見出し（会社どうしの比較表。比較は「他社と比較」の先に在る）。 */
const NO_H2 = /比べられるところだけ|ANA vs JAL パイロット年収 詳細比較表/;
/* タブ：左からこの順・この名前（オーナーの指定）。 */
const TABS = [['overview', '概要'], ['pay', '給与・待遇'], ['reviews', '口コミ'], ['work', '勤務・訓練'], ['life', '暮らし・家族'], ['stay', 'ステイ先']];
const TAB_ID = new Set(TABS.map(t => t[0]));
/* 「情報を追加」の面が持っている話題。一覧・月の勤務と、質問のまとまり6つ（pv-contrib.js の GROUPS を下で読んで照合する）。 */
const ASK_GROUPS = ['taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
const TOPICS = new Set(['list', 'work', ...ASK_GROUPS]);
/* 実データの欄：種類ごとの数（会社の事実4・補足2・月の勤務1・提出された年収1・口コミ1・点数1・星1・要約1）。 */
const LIVE_BOXES = { fact: 4, notes: 2, work: 1, realpay: 1, reviews: 1, score: 1, stars: 1, summary: 1, hotels: 1 };
const LIVE_N = Object.values(LIVE_BOXES).reduce((a, b) => a + b, 0);
const figText = (key, y) => (key === 'max_y' ? `〜${y}` : key === 'cash_y_over' ? `${y}超` : key === 'allow_m_from' ? `${y}〜` : y);
const numKeys = g => Object.keys(g).filter(k => typeof g[k] === 'number');

function rankModel(slug, rk) {
  const b = BASIS[slug], r = b[rk] || {}, s = SALARY[slug][rk];
  const e = r.est;
  /* 推定年収は必ず出す（額は SALARY の avg）。根拠・算出方法・時点の3つが台帳にそろっているかは、
     説明に何を書くかだけを変える（額を出す・出さないは変えない）。 */
  const backed = !!(e && e.basis && e.method && e.as_of);
  const est = { man: s.avg, text: yen(s.avg), backed, basis: backed ? e.basis : '', method: backed ? e.method : '', asOf: backed ? e.as_of : '' };
  const figs = [];
  for (const g of r.groups || []) for (const key of RANK_KEYS) {
    if (typeof g[key] !== 'number') continue;
    const man = toMan(b.cur, g[key]);
    figs.push({ key, man, group: g.name, orig: origOf(b.cur, g[key]), text: figText(key, yen(man)) });
  }
  return { est, figs, cap: figs.find(f => f.key === 'max_y') || null,
           co: figs.find(f => f.key === 'target_y' || f.key === 'cash_y_over') || null };
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
/* 目盛の右端：棒で出すいちばん大きい額（＝5社の推定年収）を 1,000万の刻みへ切り上げる。 */
const AXIS = Math.ceil(Math.max(...FIVE.flatMap(s => RANKS.map(([rk]) => SALARY[s][rk].avg))) / 1000) * 1000;
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
  const pay = one(g, /<article class="pvg-card pvg-pay"[^>]*>([\s\S]*?)\n<\/article>/) || '';
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
  /* 左メニューの道具（patch-side-nav.mjs）は、自分の <link> を </head> の直前・app-nav.js を </body> の直前へ必ず置き直す。
     部品がその後ろに居ると、互いに相手の置き場所を「食い違い」と数え続ける（2026-10-08 に5社が赤くなっていた。画面は何も変わらない） */
  {
    const hEnd = html.indexOf('<!--/PV-GLANCE-HEAD-->'), navCss = html.indexOf('app-nav.css"'), head = html.indexOf('</head>');
    const jEnd = html.indexOf('<!--/PV-GLANCE-JS-->'), navJs = html.indexOf('app-nav.js"'), body = html.lastIndexOf('</body>');
    ok(hEnd >= 0 && hEnd < navCss && navCss < head && jEnd >= 0 && jEnd < navJs && navJs < body,
       `${s}: 部品の <link> と <script> が、左メニューの塊より前に在る（patch-side-nav.mjs と置き場所を取り合わない）`,
       `head: 部品 ${hEnd} / app-nav.css ${navCss} / </head> ${head} ── body: 部品 ${jEnd} / app-nav.js ${navJs} / </body> ${body}`);
  }
  ok((html.match(/<h1\b/g) || []).length === 1, `${s}: h1 は1つだけ`);
  ok(/<body\b[^>]*\bdata-pv-glance="1"/.test(html), `${s}: <body data-pv-glance="1"> が在る`);
  for (const f of [...ASSETS, ...(TABBED.has(s) ? [CONTRIB.css, CONTRIB.js, STAY.css, STAY.js] : [])]) {
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
/* 説明を開く前の給与の箱を読む：職位ごとの推定年収（額と棒）／「当サイトの推定」の1行／会社が公表している金額の一覧。 */
const RANK_RE = /<div class="pvg-rank" data-rank="(cap|fo)">\n<h3 class="pvg-rk"><span class="pvg-vh">([^<]*)<\/span>([^<]*)<span class="pvg-rk-s">([^<]*)<\/span><\/h3>\n<p class="pvg-big">([^<]*)<\/p>\n<div class="pvg-track"><i class="pvg-bar pvg-bar-([a-z]+)" style="width:([\d.]+%)"><\/i><\/div>\n<\/div>/g;
const PUB_RE = /<div class="pvg-pub">\n<h3 class="pvg-k">([^<]*)<\/h3>\n<ul>\n([\s\S]*?)\n<\/ul>\n(?:<p class="pvg-note">([\s\S]*?)<\/p>\n)?<\/div>/;
const PUB_ROW_RE = /<li data-kind="([a-z]+)"(?: data-rank="(cap|fo)")?><p class="pvg-pk"><span class="pvg-vh">([^<]*)<\/span>(?:<b>([^<]*)<\/b>)?([^<]*)<\/p><p class="pvg-pv">([^<]*)(?:<small class="pv-no-cur pvg-orig">([^<]*)<\/small>)?<\/p>(?:<p class="pvg-pn">([\s\S]*?)<\/p>)?<\/li>/g;
function payTopOf(s) {
  const top = PART[s].payTop;
  const ranks = [...top.matchAll(RANK_RE)].map(m => ({ rank: m[1], spoken: unesc(m[2]), role: m[3], tail: m[4], big: m[5], bar: [m[6], m[7]], end: m.index + m[0].length }));
  const pub = PUB_RE.exec(top);
  const rows = pub ? [...pub[2].matchAll(PUB_ROW_RE)].map(m => ({
    kind: m[1], rank: m[2] || '', spoken: unesc(m[3]), role: m[4] || '', label: unesc(m[5]), value: m[6], orig: m[7] || '', own: m[8] != null ? text(m[8]) : '',
  })) : [];
  return {
    ranks, rows,
    pub: pub ? { at: pub.index, title: pub[1], lis: (pub[2].match(/<li\b/g) || []).length, shared: pub[3] != null ? text(pub[3]) : '', html: pub[0] } : null,
    estk: [...top.matchAll(/<p class="pvg-estk">([^<]*)<\/p>/g)].map(m => ({ text: m[1], at: m.index })),
    wrapAt: top.indexOf('<div class="pvg-ranks">'),
  };
}
for (const s of FIVE) {
  const top = PART[s].payTop, T = payTopOf(s), crew = crewModel(s);

  /* ── 推定年収：機長も副操縦士も、必ず額と棒で出る ── */
  ok(T.wrapAt >= 0 && same(T.ranks.map(r => r.rank), RANKS.map(([rk]) => rk)), `${s}: 機長 → 副操縦士 の順に、推定年収の欄が1つずつ在る`, T.ranks.map(r => r.rank).join(', '));
  for (const [rk, rkJa] of RANKS) {
    const r = T.ranks.find(x => x.rank === rk), avg = SALARY[s][rk].avg;
    if (!r) { ok(false, `${s} ${rkJa}: 推定年収の欄が在る（「確認中」にしない）`); continue; }
    ok(r.role === rkJa && r.tail === 'の推定年収', `${s} ${rkJa}: 見出しは「${rkJa}の推定年収」`, `${r.role}${r.tail}`);
    ok(r.big === yen(avg), `${s} ${rkJa}: 推定年収は正本（SALARY）の額そのまま`, `${r.big}（正本 ${yen(avg)}）`);
    ok(same(r.bar, ['est', widthOf(avg)]), `${s} ${rkJa}: 棒は推定の棒で、長さは額どおり`, `${r.bar}（あるべき est,${widthOf(avg)}）`);
    ok(r.spoken.includes(nameOf(s)), `${s} ${rkJa}: 読み上げに社名が入っている`, r.spoken);
  }
  ok(!/確認中/.test(text(PART[s].pay)), `${s}: 給与の箱に「確認中」と書かない（説明の中も）`, (text(PART[s].pay).match(/.{0,20}確認中.{0,10}/) || [''])[0]);
  ok(!/確認中/.test(text((PART[s].hero + PART[s].glance).replace(/<script\b[\s\S]*?<\/script>/g, ''))), `${s}: 社名の行と新しい節のどこにも「確認中」と書かない`);
  /* 推定だと分かる1行（広い画面で棒のすぐ下に出る。狭い画面では説明の中に同じ言葉が在る）。 */
  ok(T.estk.length === 1 && T.estk[0].text === EST_BY && T.ranks.length === 2 && T.estk[0].at >= T.ranks[1].end && (!T.pub || T.estk[0].at < T.pub.at),
     `${s}: 「${EST_BY}」が、2本の棒のすぐ下に1回だけ在る`, T.estk.map(e => e.text).join(' ／ '));

  /* ── 棒は推定年収の2本だけ（種類の違う額を、同じ目盛の棒で並べない） ── */
  const bars = [...PART[s].pay.matchAll(/class="pvg-bar pvg-bar-([a-z]+)"/g)].map(m => m[1]);
  ok(same(bars, ['est', 'est']) && (PART[s].pay.match(/class="pvg-track/g) || []).length === 2, `${s}: 給与の箱の棒は、推定年収の2本だけ`, bars.join(', '));

  /* ── 会社が公表している金額：棒の無い別の一覧 ── */
  const want = [];
  for (const [rk, rkJa] of RANKS) {
    const m = rankModel(s, rk);
    for (const f of [m.cap, m.co].filter(Boolean)) want.push({ kind: KIND[f.key], rank: rk, role: rkJa, label: LABEL[f.key], value: f.text, orig: f.orig });
  }
  if (crew.length) want.push({ kind: 'crew', rank: '', role: '', label: `${crew[0].who}全体の平均`, value: yen(crew[0].man), orig: '' });
  if (!want.length) { ok(!T.pub && !/pvg-pub/.test(top), `${s}: 台帳に公表額が無ければ、一覧を置かない`); }
  else if (!T.pub) ok(false, `${s}: 「会社が公表している金額」の一覧が在る`);
  else {
    const got = T.rows.map(r => ({ kind: r.kind, rank: r.rank, role: r.role, label: r.label, value: r.value, orig: r.orig }));
    ok(T.pub.title === '会社が公表している金額' && T.pub.lis === T.rows.length, `${s}: 一覧の見出しは「会社が公表している金額」・行は全部読み取れる形`, `${T.pub.title}・${T.rows.length}／${T.pub.lis}行`);
    ok(same(got, want), `${s}: 一覧の行は台帳に在る額だけ（名前・額・原貨の額が正本どおり）`,
       `画面 ${got.map(r => `${r.role}${r.label} ${r.value} ${r.orig}`).join(' ／ ')}\n      正本 ${want.map(r => `${r.role}${r.label} ${r.value} ${r.orig}`).join(' ／ ')}`);
    ok(!/pvg-track|pvg-bar/.test(T.pub.html), `${s}: 公表額の一覧に棒を描かない`);
    ok(T.pub.at > T.ranks[T.ranks.length - 1].end, `${s}: 公表額の一覧は、推定年収の欄の外に在る`);
    /* 印：上限は「〜」・下限は「超」。ほかの額には付けない。 */
    ok(T.rows.every(r => r.value.startsWith('〜') === (r.kind === 'cap') && r.value.endsWith('超') === (r.kind === 'over')),
       `${s}: 上限の額には「〜」・下限の額には「超」（ほかの額には付けない）`, T.rows.map(r => `${r.kind}:${r.value}`).join(' '));
    ok(T.rows.every(r => r.spoken.includes(nameOf(s)) && (r.kind === 'crew' ? !r.role && r.spoken.includes('機長と副操縦士をあわせた') : RANKS.some(([rk, ja]) => rk === r.rank && ja === r.role))),
       `${s}: 行ごとに社名と職位が読める（乗員全体の平均は「機長と副操縦士をあわせた」と読む）`, T.rows.map(r => `${r.spoken}${r.role}`).join(' ／ '));
    /* 前提：全部の行で同じなら一覧の下に1回・違えば行ごと。どの行にも付く。 */
    const noteOf = r => r.own || T.pub.shared;
    ok(T.rows.every(r => noteOf(r)) && !(T.pub.shared && T.rows.some(r => r.own)), `${s}: どの行にも前提が付く（同じ前提は一覧の下に1回だけ）`, T.rows.map(noteOf).join(' ／ '));
    for (const r of T.rows.filter(x => x.kind === 'crew')) {
      ok(noteOf(r).includes('機長と副操縦士をあわせた額') && noteOf(r).includes(crew[0].when), `${s}: 乗員全体の平均に「機長と副操縦士をあわせた額」と時点が添えてある`, noteOf(r));
    }
    /* 前提の中の数字は、台帳に在る数字だけ（短く言い直した時に、数字を作らない）。 */
    const led = JSON.stringify(BASIS[s]);
    const made = [...new Set(T.rows.flatMap(r => noteOf(r).match(/\d+(?:\.\d+)?/g) || []))].filter(n => !led.includes(n));
    ok(!made.length, `${s}: 前提に書いた数字は、台帳に在る数字だけ`, made.join(', '));
  }

  /* 「平均」と書いてよいのは、乗員全体の公表平均の行だけ（推定も公表額も平均と呼ばない）。 */
  const noCrew = top.replace(/<li data-kind="crew"[\s\S]*?<\/li>/g, '');
  ok(!/平均/.test(text(noCrew)), `${s}: 給与の箱で「平均」と書くのは、乗員全体の公表平均の行だけ`, (text(noCrew).match(/.{0,16}平均.{0,16}/) || [''])[0]);
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
    want.push([`${rkJa}の推定年収`, m.est.text, '']);
    for (const f of m.figs) want.push([f.group, f.text, f.orig]);
    const r = rows.find(x => x.dt === `${rkJa}の推定年収`);
    /* 根拠・算出方法・時点が台帳にそろっていればその3つ。そろっていなければ「当サイトの推定」とだけ書く
       （在りもしない根拠を書かない・だからといって額を引っ込めない）。 */
    if (m.est.backed) {
      ok(!!r && same(r.small, [`根拠：${m.est.basis}`, `算出方法：${m.est.method}`, `時点：${m.est.asOf}`]),
         `${s} ${rkJa}: 推定の説明に 根拠・算出方法・時点 が台帳のまま出ている`, r ? r.small.join(' ／ ') : '行が無い');
    } else {
      ok(!!r && same(r.small, [EST_BY]), `${s} ${rkJa}: 根拠の台帳がそろっていない推定には「${EST_BY}」とだけ書く`, r ? r.small.join(' ／ ') : '行が無い');
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
  ok(bars === mine && mine === 2, `${s}: 棒が在るのは給与の箱の中だけ（自分の会社の推定年収の2本）`, `ページ ${bars}本・給与の箱 ${mine}本`);
  /* 棒の長さの物差し（目盛の刻みの数）は、目盛の右端と同じ数から出ている。 */
  ok(new RegExp(`<section class="pvg"[^>]*style="[^"]*--pvg-n:${AXIS / 1000}"`).test(PART[s].glance), `${s}: 目盛の刻みは ${AXIS / 1000} 本（右端 ${yen(AXIS)}）`);
  const others = FIVE.filter(o => o !== s);
  const t = text(g);
  const named = others.filter(o => t.includes(nameOf(o)));
  ok(!named.length, `${s}: ほかの4社の社名を、この節に出していない`, named.join(', '));
  ok(!/&amp;b=|[?&]b=/.test(PART[s].hero + g), `${s}: 相手を決め打ちした比較の入口が無い（相手は比較の画面で選ぶ）`);
  const axes = [...PART[s].glance.matchAll(/<p class="pvg-axis">([^<]*)<\/p>/g)].map(m => m[1]);
  ok(axes.length === 1 && axes[0].includes(`0 〜 ${yen(AXIS)}`) && !/5社/.test(axes[0]), `${s}: 目盛は 0 〜 ${yen(AXIS)}（5社を比べる言い方をしない）`, axes.join(' ／ '));
}

head('画面に出る額（正本に無い額・出すと決めていない額）');
for (const s of FIVE) {
  /* 給与の箱に出る「¥◯万」は、自分の会社の、正本から作れる額だけ。注（台帳の言葉のまま）は上で照合済みなので外す。 */
  const allowed = new Set([yen(AXIS)]);
  for (const [rk] of RANKS) {
    const m = rankModel(s, rk);
    allowed.add(m.est.text);
    for (const f of m.figs) allowed.add(yen(f.man));
  }
  for (const c of crewModel(s)) allowed.add(yen(c.man));
  const scope = text(PART[s].pay.replace(/<ul class="pvg-notes">[\s\S]*?<\/ul>/g, ''));
  const odd = [...new Set(scope.match(/¥[\d,]+万/g) || [])].filter(t => !allowed.has(t));
  ok(!odd.length, `${s}: 給与の箱の額は、自分の会社の、正本から作れる額だけ`, odd.join(' '));
  const mons = [...new Set(scope.match(/約[\d,.]+万円/g) || [])];
  ok(mons.every(t => traineeModel(s).some(x => x.text === t)), `${s}: 給与の箱の「約◯万円」は訓練生の入社時の額だけ`, mons.join(' '));

  /* 幅（lo / hi）は、社名の行と新しい節には出さないと決めてある（出すのは推定年収の1つの額だけ）。
     たまたま出してよい額と同じ数になる時は見分けられないので外す。目盛の文（「0 〜 ¥4,000万」）は額ではない。 */
  const all = text((PART[s].hero + PART[s].glance).replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<p class="pvg-axis">[^<]*<\/p>/g, ''));
  const stray = [];
  for (const [rk] of RANKS) for (const n of new Set([SALARY[s][rk].lo, SALARY[s][rk].hi])) {
    if (allowed.has(yen(n))) continue;
    if (new RegExp(`(?<![\\d,.])${n.toLocaleString('en-US')}万`).test(all)) stray.push(`${rk} ${n.toLocaleString('en-US')}万`);
  }
  ok(!stray.length, `${s}: 年収の幅（下の額・上の額）を、社名の行と新しい節に出していない`, stray.join(' ／ '));
}

/* ══════════════════════════════════════════════════════════════════
   D) 無い数字を作らない・入口の行き先・写真
   ══════════════════════════════════════════════════════════════════ */
head('出荷する HTML（実データの欄は空で出す）');
const QUESTIONS = JSON.parse(read('pv-conditions.json')).questions;
const QID = new Set(QUESTIONS.map(q => q.id));
/* その話題の入口からだけ出す質問（待遇アンケートのページは、まだこれを開けない）。 */
const TOPIC_ONLY = QUESTIONS.filter(q => q.topicOnly).map(q => q.id).sort();
/* 質問がどの話題の画面に入るか。pv-contrib.js の groupOfQ／usable と同じ決め方を、ここで書き直してある
   （生成側の askGroup を呼ばない ── 同じ間違いを2回するだけになる）。 */
const QBY = new Map(QUESTIONS.map(q => [q.id, q]));
const askable = q => !!q && !q.retired && !!q.ja && !!q.ja.label
  && ((q.kind === 'choice' || q.kind === 'multi') ? Array.isArray(q.choices) && q.choices.length > 0 : (q.kind === 'num' && !!q.num && typeof q.num === 'object'));
const groupOf = id => { const q = QBY.get(id); return !askable(q) ? '' : ASK_GROUPS.includes(q.topic) ? q.topic : q.section === 'roster' ? 'roster' : q.section === 'career' ? 'career' : 'benefits'; };
const ASKABLE = QUESTIONS.filter(askable).map(q => q.id);
{
  /* 面が持っている話題の名前（pv-contrib.js の GROUPS）と、この検査の写しが同じ。 */
  const src = read('pv-contrib.js');
  const blk = one(src, /var GROUPS = \[([\s\S]*?)\];/) || '';
  const ks = [...blk.matchAll(/\{ k: '([a-z_]+)'/g)].map(m => m[1]);
  ok(same([...ks].sort(), [...ASK_GROUPS].sort()), '「情報を追加」の面が持っている話題は、通勤・Staff Travel・昇格・勤務スケジュール・訓練・休暇と手当の6つ', ks.join(' '));
  ok(/var PAY_SECTIONS = \{ roster: 1, career: 1 \};/.test(src), '補足を給与提出者だけに見せる区分（勤務スケジュール・キャリア）の写しが、面に在る');
}
const linkedTopicOnly = new Set();
for (const s of FIVE) {
  const P = PART[s], both = P.hero + P.glance;
  const boxes = [...both.matchAll(/<div class="crl"([^>]*)>([\s\S]*?)<\/div>/g)];
  const kinds = {};
  for (const m of boxes) { const k = one(m[1], / data-live="([^"]*)"/) || '?'; kinds[k] = (kinds[k] || 0) + 1; }
  ok(boxes.length === LIVE_N && same(Object.entries(kinds).sort(), Object.entries(LIVE_BOXES).sort()), `${s}: 実データの欄は${LIVE_N}（事実4・補足2・月の勤務1・年収1・口コミ1・点数1・星1・要約1・ホテル1）`, JSON.stringify(kinds));
  ok(boxes.every(m => m[2] === '<span class="crl-ph">—</span>' && / data-state="idle"/.test(m[1]) && m[1].includes(` data-airline="${s}"`)),
     `${s}: 実データの欄は「—」で出荷し、自分の会社を指している`);
  /* 提出された年収の一覧：給与の1枚の中、推定年収のすぐ下に1つ。HTML には数字を1つも書かない。 */
  {
    const g0 = P.glance, OPEN = '<section class="pvg-rp" id="pvg-realpay"', CLOSE = '</section>';
    const at = m => g0.indexOf(m);
    const iCo = at('<article class="pvg-card pvg-co"'), iRow = at('<div class="pvg-payrow"'), iPay = at('<article class="pvg-card pvg-pay"'), iRp = at(OPEN);
    const iRv = at('<article class="pvg-card pvg-rv-card" id="pvg-score"'), iTop = at('<div class="pvg-top"'), iSt = at('<div class="pvg-more-grid pvg-g-st"');
    const rpEnd = iRp < 0 ? -1 : g0.indexOf(CLOSE, iRp);
    const rp = iRp < 0 ? '' : g0.slice(iRp, rpEnd);
    ok(g0.split(OPEN).length === 2 && both.split('data-live="realpay"').length === 2
       && rp.includes(`<div class="crl" data-live="realpay" data-airline="${s}" data-top="3" data-state="idle"><span class="crl-ph">—</span></div>`),
       `${s}: 提出された年収の一覧の箱が1つだけ在り、自分の会社を指している`);
    ok(/<h3 class="pvg-rp-h">提出された年収<small lang="en">REAL PAY<\/small><\/h3>/.test(rp), `${s}: 一覧の見出しは「提出された年収」`, text(one(rp, /<h3\b[^>]*>([\s\S]*?)<\/h3>/) || ''));
    /* 上から 会社概要 → 給与の1枚（推定年収 → 提出された年収）｜評価スコア → 勤務・待遇・暮らしの入口 → ステイ（オーナーの指定した並び）。 */
    const order = [iCo, iRow, iPay, iRp, iRv, iTop, iSt];
    ok(order.every((v, i) => v >= 0 && (!i || v > order[i - 1])), `${s}: 上から 会社概要 → 給与（推定年収 → 提出された年収）｜評価スコア → 勤務・待遇・暮らし → ステイ の順`, order.join(' '));
    {
      /* 段の中身：給与の1枚と、評価スコアのカードの2枚だけ。提出された年収は給与の1枚の中（別のカードにしない）。 */
      const payEnd = iPay < 0 ? -1 : g0.indexOf('\n</article>', iPay), rvEnd = iRv < 0 ? -1 : g0.indexOf('\n</article>', iRv);
      ok(iRow >= 0 && iRv > iRow && (g0.slice(iRow, iRv).match(/<article\b/g) || []).length === 1 && depthAt(g0, iPay) === depthAt(g0, iRow) + 1 && depthAt(g0, iRv) === depthAt(g0, iPay)
         && rvEnd > 0 && g0.slice(rvEnd).startsWith('\n</article>\n</div>') && iRp > iPay && rpEnd < payEnd && !/<article class="pvg-card pvg-rp"/.test(g0),
         `${s}: 年収の段に在るのは、給与の1枚と評価スコアの2枚だけ ── 提出された年収は給与の1枚の中に在る`);
      const pubAt = g0.indexOf('<div class="pvg-pub">', iPay), estAt = g0.indexOf('<p class="pvg-estk">', iPay);
      ok(estAt > iPay && iRp > estAt && (pubAt < 0 || pubAt > payEnd || rpEnd < pubAt), `${s}: 給与の1枚の中は 推定年収 → 提出された年収 → 会社が公表している金額 の順`);
    }
    ok(iTop >= 0 && iSt > iTop && same([...g0.slice(iTop, iSt).matchAll(/<article class="pvg-card pvg-cell" data-cell="([a-z]+)"/g)].map(m => m[1]), ['work', 'benefits', 'living']) && (g0.slice(iTop, iSt).match(/<article\b/g) || []).length === 3,
       `${s}: 入口は 勤務 → 待遇 → 暮らし の3つ`);
    ok(!/[\d¥]/.test(text(rp)), `${s}: 一覧の箱の HTML に、数字を1つも書いていない（件数も額も、読めた時に入る）`, text(rp));
    ok(!both.includes(GIVE) && !PAGES[s].includes(UNLOCK), `${s}: 一覧の入口（「${GG}／${GIVE}」）は HTML に書かず、鍵が無いと分かった時に入れる／「${UNLOCK}」はページのどこにも書かない`);
  }
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
  ok(hrefs.filter(h => h === `../career.html?view=compare&a=${s}`).length === 1, `${s}: 「他社と比較」は自分を選んだ比較へ`);
  ok(hrefs.filter(h => h === `../career.html?view=card&a=${s}`).length === 1, `${s}: 「カードを保存」は自分のカードへ`);
  ok(hrefs.filter(h => h.startsWith('../pay-report.html')).every(h => h === `../pay-report.html?airline=${s}`), `${s}: 給与の提出は自分の会社を選んだ状態で開く`);
  ok(!hrefs.some(h => /[?&]stay=/.test(h)), `${s}: 就航地の入口は、このページの中（#stay-XXX）── 別のページへ出さない`, hrefs.filter(h => /[?&]stay=/.test(h)).slice(0, 3).join(' '));
  {
    /* 口コミを書く入口：評価スコアのカードに、概要用と口コミのタブ用の2つ（見えるのは、いま居るタブの1つだけ）。どちらも2行。 */
    const card = one(P.glance, /<article class="pvg-card pvg-rv-card" id="pvg-score"[^>]*>([\s\S]*?)\n<\/article>/) || '';
    const cta = [...card.matchAll(/<p class="pvg-rv-cta pvg-rv-cta-([a-z]+)"><a class="pvg-btn pvg-btn-gg" href="([^"]*)"><span class="pvg-gg"><span class="pvg-gg-k" lang="en">([^<]*)<\/span><span class="pvg-gg-m">([^<]*)<\/span><\/span><\/a>/g)].map(m => [m[1], unesc(m[2]), unesc(m[3]), m[4]]);
    const to = `../submit-review.html?airline=${s}`;
    ok(same(cta, [['overview', to, GG, RV_GIVE.overview], ['reviews', to, GG, RV_GIVE.reviews]]) && hrefs.filter(h => h.startsWith('../submit-review.html')).length === 2,
       `${s}: 口コミを書く入口は2行のボタン ── 概要は「${GG}／${RV_GIVE.overview}」・口コミのタブは「${GG}／${RV_GIVE.reviews}」・どちらも自分の会社を選んだ投稿の画面へ`, cta.map(c => c.join(' ')).join(' ／ '));
    ok(!/匿名で口コミを(投稿する|書く)/.test(both), `${s}: 前の言葉（「匿名で口コミを投稿する」）が、社名の行と新しい節に残っていない`);
  }
  {
    /* 会社の紹介は、会社概要のカードの中に1回だけ。下に同じ節（「◯◯について」）を残さない。会社どうしの比較表も置かない
       （比較は「他社と比較」の先に在る）。紹介の文は、字として入っている（4つの数字だけで済ませない）。 */
    const txt = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const h2 = [...PAGES[s].matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => txt(m[1]));
    const dup = h2.filter(x => NO_H2.test(x) || /について$/.test(x));
    ok(!dup.length, `${s}: 「◯◯について」の節と、会社どうしの比較表が残っていない`, dup.join(' ／ '));
    const co = one(P.glance, /<article class="pvg-card pvg-co"[^>]*>([\s\S]*?)\n<\/article>/) || '';
    const lead = [...PAGES[s].matchAll(/<p class="pvg-about" data-pvg-about="lead">([\s\S]*?)<\/p>/g)].map(m => txt(m[1]));
    const more = [...PAGES[s].matchAll(/<p data-pvg-about="more">([\s\S]*?)<\/p>/g)].map(m => txt(m[1]));
    ok(lead.length === 1 && lead[0].length >= 60 && co.includes('data-pvg-about="lead"') && co.indexOf('data-pvg-about="lead"') < co.indexOf('<dl class="pvg-keys">'),
       `${s}: 会社の紹介（歴史・規模・拠点の文）が、会社概要のカードの中・4つの数字より上に1つだけ在る`, `${lead.length}つ・${(lead[0] || '').length}字`);
    const fold = one(co, /<details class="pvg-dt pvg-co-more">([\s\S]*?)<\/details>/) || '';
    ok(more.every(x => x.length >= 20) && more.length === (fold.match(/data-pvg-about="more"/g) || []).length,
       `${s}: 紹介の続きは「会社情報」の中に畳んである（ほかの所に置いていない）`, `${more.length}つ`);
    /* 同じ文が、ページのほかの所にもう1回出ていないか（頭の40字で探す）。 */
    const again = [...lead, ...more].filter(x => x.length >= 40 && PAGES[s].split(x.slice(0, 40)).length - 1 !== 1);
    ok(!again.length, `${s}: 紹介の文が、ページの中で重なっていない`, again.map(x => x.slice(0, 24)).join(' ／ '));
  }
  const known = h => /^https:\/\//.test(h) || h === '#pvg-stay' || /^#(overview|pay|reviews|work|life|stay)$/.test(h) || /^#stay-[A-Z]{3}$/.test(h) || (/^\?add=([a-z_]+)$/.test(h) && TOPICS.has(h.slice(5))) || /^\.\.\/(airline-conditions|career|pay-report|submit-review)\.html\?/.test(h) || /^\.\.\/(career-live|pv-glance|career-stay)\.css\?v=/.test(h);
  ok(hrefs.every(known), `${s}: 知らない形の行き先が無い`, hrefs.filter(h => !known(h)).slice(0, 3).join(' '));
  ok(!hrefs.includes('#pvg-stay') || /id="pvg-stay"/.test(P.glance), `${s}: ページの中の行き先（#pvg-stay）が在る`);
  /* 「募集要項を開く」の行き先は、この節の外に在る昔からの節。見出しで探す（pv-glance.js の SEC と同じ言葉）。 */
  const rest = PAGES[s].split(P.glance).join('');
  ok(!/data-pvg-tab="jobs"/.test(both) || /<h2\b[^>]*>\s*(?:募集要項|採用情報)/.test(rest), `${s}: 「募集要項を開く」の行き先（募集要項の節）がページに在る`);
  /* タブ：6つ・この順・この名前。出荷する HTML では「概要」だけが今の場所（JS が無くても全部読める）。 */
  const iH1 = P.hero.indexOf('<h1>'), iActs = P.hero.indexOf('<div class="pvg-acts">'), iBar = P.hero.indexOf('<div class="pvg-tabbar"');
  ok(iH1 >= 0 && iActs > iH1 && iBar > iActs, `${s}: 「カードを保存」「他社と比較」は、社名のそば・タブより上に在る`);
  const acts = iActs < 0 ? '' : P.hero.slice(iActs, iBar);
  ok(same([...acts.matchAll(/<a class="pvg-btn [^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map(m => text(m[1])), ['カードを保存', '他社と比較']), `${s}: 社名のそばの入口は「カードを保存」「他社と比較」の2つ`, text(acts));
  const bar = one(P.hero, /<div class="pvg-tabs" id="pvg-tabs"[^>]*>([\s\S]*?)\n<\/div>/) || '';
  const tabs = [...bar.matchAll(/<a href="#([a-z]+)" data-pvg-tab="([a-z]+)"( aria-current="page")?>[\s\S]*?<span>([^<]*)<\/span><\/a>/g)].map(m => [m[1], m[2], !!m[3], m[4]]);
  ok(same(tabs, TABS.map(([id, label], i) => [id, id, i === 0, label])) && (bar.match(/<a\b/g) || []).length === TABS.length,
     `${s}: タブは6つ・左から ${TABS.map(t => t[1]).join('／')}`, tabs.map(t => t[3]).join('／'));
  const tabRefs = [...PAGES[s].matchAll(/data-pvg-tab="([^"]*)"/g)].map(m => m[1]);
  ok(tabRefs.every(t => TAB_ID.has(t) || t === 'jobs') && tabRefs.filter(t => t === 'jobs').length <= 1 && TABS.every(([id]) => { const n = tabRefs.filter(t => t === id).length; return n === 1 || (id === 'stay' && n === 2); }),
     `${s}: タブへの入口が指すのは在るタブだけ（タブの帯の6つ＋「募集要項」＋概要の「就航地をすべて見る」）`, tabRefs.join(' '));
  const panes = [...PAGES[s].matchAll(/data-pvg-pane="([^"]*)"/g)].map(m => m[1].split(' '));
  ok(panes.length > 0 && panes.every(p => p.length > 0 && p.every(t => TAB_ID.has(t))) && TABS.every(([id]) => panes.some(p => p.includes(id))),
     `${s}: どの塊も在るタブにだけ属し、6つのタブのどれにも中身が在る`, [...new Set(panes.flat())].join(' '));
  ok(!/\bpvg-at-/.test(PAGES[s].replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '')), `${s}: 出荷する HTML はどのタブにも絞っていない（JS が無ければ全部見える）`);
  /* 情報を追加：タブの帯の右端に1つ。入口が指す話題は、面が持っているものだけ（一覧・月の勤務・質問のまとまり6つ）。 */
  ok(P.hero.split('<button type="button" class="pvg-add" data-pvc-open="list">').length === 2 && P.hero.indexOf('class="pvg-add"') > P.hero.indexOf('id="pvg-tabs"'), `${s}: 「情報を追加」はタブの帯に1つだけ・話題の一覧を開く`);
  const opens = [...PAGES[s].matchAll(/<(a|button)\b([^>]*)\bdata-pvc-open="([^"]*)"([^>]*)>/g)].map(m => ({ tag: m[1], href: unesc(one(m[2] + m[4], /href="([^"]*)"/) || ''), topic: m[3], q: one(m[2] + m[4], /data-pvc-q="([^"]*)"/) || '' }));
  ok(opens.every(o => TOPICS.has(o.topic)), `${s}: 情報を追加の入口が指す話題は、面が持っているものだけ`, [...new Set(opens.map(o => o.topic))].join(' '));
  {
    /* 質問を名指しする入口：その質問が入っている話題を開く（違う話題を開くと、面はその質問を見つけられず頭から出る）。 */
    const named = opens.filter(o => o.q);
    const wrong = named.filter(o => !QID.has(o.q) || groupOf(o.q) !== o.topic);
    ok(named.length > 0 && !wrong.length, `${s}: 質問を名指しする入口は、その質問が入っている話題を開く`, wrong.slice(0, 3).map(o => `${o.q}→${o.topic}`).join(' '));
    ok(named.every(o => o.tag === 'a' && o.href === `../airline-conditions.html?airline=${s}&q=${o.q}`), `${s}: 質問を名指しする入口は、JS が無ければその質問のページへ行く`, named.filter(o => o.tag !== 'a' || o.href !== `../airline-conditions.html?airline=${s}&q=${o.q}`).slice(0, 2).map(o => o.href).join(' '));
    /* 面で答えられる質問は、どれもページから1回で届く話題に入っている（その話題を開く入口が、ページのどこかに在る）。
       昇格の3問・タクシーの上限も、答えられない質問として残さない。 */
    const reach = new Set(named.map(o => o.q));
    const direct = new Set(opens.map(o => o.topic));
    const lost = ASKABLE.filter(id => !direct.has(groupOf(id)));
    ok(ASKABLE.length >= 40 && !lost.length, `${s}: 面で答えられる質問は、どれもページから直接開ける話題に入っている`, lost.join(' '));
    for (const id of TOPIC_ONLY) ok(reach.has(id), `${s}: 話題の入口からだけ出す質問（${id}）に、名指しの入口が在る`);
  }
  {
    /* 「勤務・訓練」のタブ：月の勤務の数字・訓練とキャリア・機長昇格の3つを、ここから足せる。 */
    const row = [...P.glance.matchAll(/<p class="pvg-addrow">([\s\S]*?)<\/p>/g)].map(m => [...m[1].matchAll(/<a class="pvg-link" href="\?add=([a-z_]+)" data-pvc-open="([a-z_]+)">([^<]*)</g)].map(a => [a[1], a[2], a[3]]));
    const want = [['work', 'work', '月の勤務を追加'], ['career', 'career', '訓練・キャリアを追加'], ['upgrade', 'upgrade', '機長昇格を追加']];
    ok(row.length > 0 && row.some(r => same(r, want)), `${s}: 「勤務・訓練」から足せるのは、月の勤務／訓練・キャリア／機長昇格 の3つ`, JSON.stringify(row).slice(0, 200));
  }
  {
    /* 月の勤務の集計と、会員の補足の欄。どちらも HTML には何も書かない（読める人にだけ、読めた時に入る）。 */
    const boxOf = k => boxes.filter(m => m[1].includes(` data-live="${k}"`)).map(m => (one(m[1], / data-keys="([^"]*)"/) || '').split(',').filter(Boolean));
    const wk = boxOf('work'), nt = boxOf('notes');
    const grp = ks => [...new Set(ks.map(groupOf))].sort();
    ok(wk.length === 1 && same(grp(wk[0]), ['career', 'roster', 'upgrade']) && same([...wk[0]].sort(), ASKABLE.filter(id => ['roster', 'career', 'upgrade'].includes(groupOf(id))).sort()),
       `${s}: 月の勤務の欄が1つ ── 一緒に出す補足は、勤務・訓練・昇格の質問ぜんぶ`, wk.map(grp).join(' ／ '));
    ok(nt.length === 2 && same(nt.map(grp).map(g => g.join('+')).sort(), ['benefits+staff_travel', 'taxi']) && same(nt.flat().sort(), ASKABLE.filter(id => ['benefits', 'staff_travel', 'taxi'].includes(groupOf(id))).sort()),
       `${s}: 補足の欄は2つ ── 休暇・手当と Staff Travel／通勤・タクシー（どの質問も、どちらか1つに入る）`, nt.map(grp).map(g => g.join('+')).join(' ／ '));
  }
  ok(opens.filter(o => o.tag === 'a').every(o => o.href === `?add=${o.topic}` || o.href.startsWith(`../airline-conditions.html?airline=${s}&q=`)),
     `${s}: リンクの形の入口は、JS が無くても行き先が在る（?add= か、その質問のページ）`, opens.filter(o => o.tag === 'a').map(o => o.href).slice(0, 3).join(' '));
  ok(opens.some(o => o.topic === 'work') && opens.some(o => o.topic === 'taxi'), `${s}: 月の勤務・通勤とタクシーへ、会社を選び直さずに進む入口が在る`);
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
for (const f of ['airline-conditions.html', 'career.html', 'pay-report.html', 'actual-pay.html', 'login.html']) ok(fs.existsSync(path.join(ROOT, f)), `行き先のファイルが在る: ${f}`);

ok(same([...linkedTopicOnly].sort(), TOPIC_ONLY), '「その話題の入口からだけ出す」質問（4問）は、全部このページに入口が在る', `${[...linkedTopicOnly].sort()} ／ 台帳 ${TOPIC_ONLY}`);
if (linkedTopicOnly.size) {
  notice(`この ${linkedTopicOnly.size}問（${[...linkedTopicOnly].sort().join('・')}）は、行き先の待遇アンケートのページではまだ開かない。`);
  notice('  会社ページの上で開く回答の板が出来るまで、この入口は押しても答えられない（未完了）。');
}

head('ステイ先（就航地の一覧 ⇄ 公式の就航地の台帳・写真のクレジット・ホテルを HTML に書かない）');
for (const s of FIVE) {
  const G = PART[s].glance, net = networkOf(s);
  ok(!!net && net.list.length > 0, `${s}: 就航地の台帳（airline-destinations.mjs）に在る`);
  if (!net) continue;
  /* 生成側の関数を呼ばずに、出荷する HTML のカードを読み直して台帳と突き合わせる。 */
  const cardsIn = h => [...h.matchAll(/<li data-rg="([a-z-]+)" data-q="([^"]*)"><a class="pvg-town pvg-city" href="#stay-([A-Z]{3})" data-city="([A-Z]{3})"( data-seasonal="1")?>([\s\S]*?)<\/a><\/li>/g)].map(m => ({
    rg: m[1], q: unesc(m[2]), href: m[3], iata: m[4], seasonal: !!m[5],
    code: one(m[6], /<i class="pvg-code3">([A-Z]{3})<\/i>/),
    country: unesc(one(m[6], /<span class="pvg-city-k"><small>([^<]*)<\/small>/) || ''),
    /* 街の名前には、折れてよい所の <wbr> が入る（字は足さない）。外してから台帳の名前と比べる */
    city: unesc((one(m[6], /<b class="pvg-town-n">((?:[^<]|<wbr>)*)<\/b>/) || '').split('<wbr>').join('')),
    wbr: (one(m[6], /<b class="pvg-town-n">((?:[^<]|<wbr>)*)<\/b>/) || '').split('<wbr>').map(unesc),
    en: unesc(one(m[6], /<span class="pvg-town-s" lang="en">([^<]*)<\/span>/) || ''),
    img: one(m[6], /<img src="([^"]*)"/), alt: unesc(one(m[6], /<img [^>]*\balt="([^"]*)"/) || ''),
    wh: [one(m[6], /<img [^>]*\bwidth="(\d+)"/), one(m[6], /<img [^>]*\bheight="(\d+)"/)].map(Number),
    none: /<span class="pvg-town-ph is-none">/.test(m[6]),
  }));
  const list = cardsIn(one(G, /<ul class="pvg-cgrid" id="pvg-st-list">([\s\S]*?)\n<\/ul>/) || '');
  const tease = cardsIn(one(G, /<ul class="pvg-cgrid pvg-cteaser">([\s\S]*?)\n<\/ul>/) || '');
  const want = new Map(net.list.map(d => [d.iata, d]));
  const got = list.map(c => c.iata);
  ok(got.length === want.size && new Set(got).size === got.length && got.every(k => want.has(k)),
     `${s}: 一覧の空港は、台帳の ${want.size} 空港とちょうど同じ（足しても引いてもいない・同じ空港が2回出ない）`,
     `画面 ${got.length}／台帳に無い ${got.filter(k => !want.has(k)).join(' ') || 'なし'}／画面に無い ${[...want.keys()].filter(k => !got.includes(k)).join(' ') || 'なし'}`);
  {
    const bad = list.filter(c => { const d = want.get(c.iata); return !d || c.href !== c.iata || c.code !== c.iata || c.city !== d.city || c.en !== d.en || c.country !== d.country || c.rg !== d.region || c.seasonal !== d.seasonal; });
    ok(!bad.length, `${s}: どのカードも、都市名・英語名・国・地域・空港の3字・季節運航の印が台帳のまま`, bad.slice(0, 5).map(c => c.iata).join(' '));
  }
  {
    /* 探す欄：カードの鍵（data-q）は、画面が打った字に掛けるのと同じ式（pv-glance.js の norm）を通した形。
       式は写さず、出荷する pv-glance.js から関数の本体を切り出して使う。
       鍵が小文字にしただけだった頃は、「東京（羽田）」と打っても "dusseldorf" と打っても1枚も当たらなかった
       （打った字だけ半角のかっこになる・鍵に ü が残る）。 */
    const src = one(read('pv-glance.js'), /\n  (function norm\(s\) \{[\s\S]*?\n  \})\n/);
    let norm = null;
    try { norm = src ? new Function(`${src}; return norm;`)() : null; } catch { norm = null; }
    ok(typeof norm === 'function' && norm('Ａ（ｂ）Ü') === 'abu' && norm('Washington, D.C.') === 'washington dc' && norm('Xi’an') === 'xian' && norm('パルマ・デ・マヨルカ') === 'パルマデマヨルカ',
       'pv-glance.js の norm を切り出せる（全角・大文字・欧文の飾り・名前の中の区切りの記号を区別しない）', norm ? [norm('Ａ（ｂ）Ü'), norm('Washington, D.C.'), norm('Xi’an')].join(' / ') : '切り出せない');
    const bad = norm ? list.filter(c => { const d = want.get(c.iata); return !d || c.q !== norm([d.city, d.en, d.iata, d.country].join(' ')); }) : list;
    ok(!bad.length, `${s}: 探す欄の鍵は、打った字と同じ形にそろえてある（都市名・英語名・3字・国）`, bad.slice(0, 5).map(c => `${c.iata}「${c.q}」`).join(' '));
  }
  {
    /* 概要に出すのは一部だけ。一覧に在る空港を、同じ呼び名で。 */
    const bad = tease.filter(c => { const l = list.find(x => x.iata === c.iata); return !l || !same(c, l); });
    ok(tease.length >= 3 && tease.length <= 6 && new Set(tease.map(c => c.iata)).size === tease.length && !bad.length,
       `${s}: 概要の「就航地の一部」は3〜6枚・一覧に在る空港を同じ中身で`, `${tease.length}枚 ${bad.map(c => c.iata).join(' ')}`);
    ok(/<p class="pvg-askh">就航地の一部<small>[^<]*人気の順ではありません<\/small><\/p>/.test(G), `${s}: 概要の一部は「人気の順ではない」と断っている`);
    const more = one(G, /<p class="pvg-st-more"><button type="button" class="pvg-btn pvg-btn-ghost" data-pvg-tab="stay">([^<]*)</) || '';
    ok(more === `就航地をすべて見る（${want.size}空港）`, `${s}: 「就航地をすべて見る」の数は台帳の数`, more);
    ok(one(G, /<b data-pvg-stn>(\d+)<\/b>/) === String(want.size), `${s}: 一覧の頭の数は台帳の数`);
    const pills = [...G.matchAll(/<button type="button" class="pvg-pill" data-pvg-rg="([a-z-]*)" aria-pressed="(true|false)">([^<]*)<small>(\d+)<\/small><\/button>/g)].map(m => [m[1], m[3], +m[4], m[2] === 'true']);
    ok(same(pills, [['', 'すべて', want.size, true], ...net.regions.map(r => [r.key, r.label, r.n, false])]), `${s}: 地域の絞り込みは、その会社に在る地域だけ・数は台帳から`, pills.map(x => `${x[1]}${x[2]}`).join(' '));
  }
  {
    /* 写真：台帳に在る空港だけ。置き場・大きさ・説明は台帳のまま。無い空港は3字の札。 */
    const bad = list.filter(c => {
      const ph = placePhoto(c.iata);
      if (!ph) return !(c.none && !c.img);
      return !(c.img === `../${placeSrc(ph, true)}` && c.alt === ph.subject && c.wh[0] === 480 && c.wh[1] === Math.round(ph.h * 480 / ph.w) && !c.none
        && fs.existsSync(path.join(ROOT, placeSrc(ph, true))) && fs.existsSync(path.join(ROOT, placeSrc(ph, false))));
    });
    ok(!bad.length, `${s}: 写真は台帳（place-photos.mjs）に在る空港だけ・ファイルが在る・説明と大きさが台帳のまま`, bad.slice(0, 5).map(c => c.iata).join(' '));
    /* 作者名とライセンス名を示すことが使う条件の写真は、出典の一覧に必ず1行。条件の無い写真（CC0）は並べない。 */
    const rows = new Map([...G.matchAll(/<li data-cr="([A-Z]{3})"><b>([^<]*)<\/b><span>([\s\S]*?)<\/span><\/li>/g)].map(m => [m[1], [unesc(m[2]), m[3]]]));
    const need = list.filter(c => { const ph = placePhoto(c.iata); return ph && placeCredit(ph); });
    const lost = need.filter(c => {
      const ph = placePhoto(c.iata), r = rows.get(c.iata);
      return !r || r[0] !== c.city || !r[1].includes(`<a class="pvg-src" href="${ph.source.replace(/&/g, '&amp;')}" target="_blank" rel="noopener">`) || !text(r[1]).includes(ph.author)
        || !r[1].includes(`href="${ph.licence_url}"`) || !text(r[1]).includes(ph.licence);
    });
    ok(rows.size === need.length && !lost.length, `${s}: 示すことが条件の写真 ${need.length}枚に、作者名・出所・ライセンス名が付いている（それ以外は並べない）`, `行 ${rows.size}／欠け ${lost.slice(0, 5).map(c => c.iata).join(' ')}`);
    ok(one(G.slice(G.indexOf('id="pvg-stay"')), /<summary>写真の出典<small>(\d+)枚<\/small>/) === String(need.length), `${s}: 就航地の「写真の出典」の枚数が合っている（暮らしの街の写真とは別に数える）`);
    const held = Object.values(PLACE_HELD).map(x => x.photo.file).filter(f => PAGES[s].includes(`/${f}.jpg`) || PAGES[s].includes(`/${f}-480.jpg`));
    ok(!held.length, `${s}: 入れないと決めた写真を出していない`, held.join(' '));
  }
  {
    /* 都市を選んだ先：枠だけを出荷する。名前も写真もホテルも、HTML には1つも書かない。 */
    const city = one(PAGES[s], /<section class="pvg-card pvg-cd" id="pvg-city" data-pvg-pane="stay" aria-labelledby="pvg-cd-n" hidden>([\s\S]*?)\n<\/section>/) || '';
    ok(!!city && /<h3 class="pvg-cd-n" id="pvg-cd-n" tabindex="-1" data-cd="name"><\/h3>/.test(city) && /<div class="pvg-town-ph pvg-cd-ph" data-cd="ph" data-sizes="[^"]+"><\/div>/.test(city),
       `${s}: 都市の詳細は、隠した枠だけで出荷する（名前と写真は選んだ時に入る）`);
    ok(/公式の就航地です。あなたの機種・ベースからの運航や宿泊があるとは限りません。/.test(text(city)), `${s}: 就航地と「泊まる」を混ぜない断りが、都市の詳細に在る`);
    const slot = [...city.matchAll(/<div class="crl" data-live="hotels"([^>]*)>/g)].map(m => m[1]);
    ok(slot.length === 1 && slot[0].includes(` data-airline="${s}"`) && slot[0].includes(' data-stay=""') && slot[0].includes(' data-city=""'),
       `${s}: ホテルの欄は1つ・空港は空のまま出荷する（どの空港のホテルも HTML に書いていない）`, slot.join(' ‖ '));
    ok(!/class="crs-/.test(PAGES[s]), `${s}: ホテルの画面の部品（crs-）を HTML に書いていない（サーバーの返事から組む）`);
    ok(/<h4 class="pvg-askh">ホテル・レストラン・場所<small>確認済みのパイロットが足したもの<\/small><\/h4>/.test(city), `${s}: ホテルの見出しは「確認済みのパイロットが足したもの」`);
    /* 根拠・条件・時点：公式の資料と確かめた日。 */
    const off = one(G, /<a class="pvg-link pvg-st-off" href="([^"]*)" target="_blank" rel="noopener">公式の就航地<\/a>/);
    ok(off === net.src[0].url.replace(/&/g, '&amp;') && net.src.every(x => G.includes(`href="${x.url.replace(/&/g, '&amp;')}"`)), `${s}: 「公式の就航地」と根拠は、台帳の資料へ`, off || '');
    const [y, mo, da] = net.at.split('-').map(Number);
    ok(G.includes(`<span>${y}年${mo}月${da}日に公式の資料で確認</span>`), `${s}: 確かめた日（${net.at}）が出ている`);
  }
}
head('career-live.js（提出された年収の一覧の、鍵の無い人の行）');
{
  const LJ = noJsCmt(read('career-live.js'));
  const fn = name => one(LJ, new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n([\\s\\S]*?)\\n  \\}\\n`)) || '';
  ok(LJ.includes(`gg: '${GG}'`) && LJ.includes(`payUnlock: '${GIVE}'`) && LJ.includes(`payTerms: '${TERMS}'`) && !LJ.includes(UNLOCK), `会社ページの入口の言葉は「${GG}／${GIVE}」と「${TERMS}」（「${UNLOCK}」とは書かない）`);
  /* 会社ページ（GL）の入口だけが2行。行き先は前と同じ（自分の会社を選んだ給与の提出）。 */
  ok(/foot\(GL \? \[\s*give2\(T\.payUnlock, UP \+ 'pay-report\.html\?airline=' \+ enc\(slug\)\),\s*pay\.anon \? link\(T\.login, loginHref\(\)\) : null,\s*link\(T\.payTerms, UP \+ 'actual-pay\.html\?air=' \+ enc\(slug\)\)\s*\] : \[/.test(LJ),
     '会社ページの入口は 2行のボタン（給与の提出へ）→ ログイン（未ログインの時だけ）→ 閲覧条件（REAL PAY へ）の順');
  ok(/k\.lang = 'en';/.test(fn('give2')) && fn('give2').includes("el('span', 'crl-cta-k', T.gg)") && fn('give2').includes("el('span', 'crl-cta-m', main)"), '2行のボタンは、上が「Give & Get」・下が開くもの（字は textContent で入れる）');
  /* 鍵の無い答えからは、会社・出典・投稿時期の3つしか受け取らない（サーバーが余分に送ってきても、行に持たせない）。 */
  ok(/if \(!open\) \{\s*rows = rows\.map\(function \(r\) \{\s*return \{ airline: r && r\.airline, verified: !!\(r && r\.verified\), age: r && r\.age \};\s*\}\);\s*\}/.test(fn('payRows')),
     '鍵の無い答えからは、会社・出典・投稿時期の3つだけを受け取る');
  /* 伏せた行は、行の中身を読まずに組む（読むのは出典と投稿時期を書く1か所だけ）。板には字を入れない。 */
  const ml = fn('maskLine');
  ok(ml.includes('srcLine(r)') && !/\br\b/.test(ml.split('srcLine(r)').join('')), '伏せた行は、行の中身を読まずに組む（出典と投稿時期の1か所だけ）', (ml.split('srcLine(r)').join('').match(/.{0,30}\br\b.{0,30}/) || [''])[0]);
  ok(/^\s*return el\('span', 'crl-plate' \+ \(kind \? ' crl-plate-' \+ kind : ''\)\);\s*$/.test(fn('plate')), '伏せた板には字を入れない（中身の無い箱だけ）', fn('plate').trim());
  ok(!/money\(|annual_usd|crl-amt/.test(ml), '伏せた行に、額の箱を作らない');
  const sl = fn('srcLine');
  ok(same([...new Set([...sl.matchAll(/\br\.(\w+)/g)].map(m => m[1]))].sort(), ['age', 'verified']), '出典と投稿時期の行が読むのは、その2つだけ', [...new Set([...sl.matchAll(/\br\.(\w+)/g)].map(m => m[1]))].join(', '));
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
  /* 昔からの節（.glass[data-pvg-pane]）ぜんぶに「入らない語は途中で折る」を掛けない。
     掛けていたあいだ、狭い画面の2列の機材カードで、機種名（A321neo・B737/767）が字の途中で折れた。
     掛けてよいのは小さい字の注記だけ（採用窓口のメールアドレスの行が、320px でページを横へ広げないため）。 */
  const wide = [...CSSC.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /overflow-wrap\s*:\s*(?:break-word|anywhere)|word-break\s*:\s*break-(?:all|word)/.test(m[2]))
    .flatMap(m => m[1].split(',').map(x => x.trim())).filter(x => /\[data-pvg-pane[^\]]*\]$/.test(x));
  ok(!wide.length, '昔からの節ぜんぶに「語の途中で折る」を掛けていない（機種名が折れる）', wide.join(' ／ '));
  ok(/\.glass\[data-pvg-pane\] \.text-xs\{overflow-wrap:break-word\}/.test(CSSC), '小さい字の注記だけは、入らない語を折る（長いメールアドレスでページが横に広がらない）');
  /* 字の大きさ：12px より小さい指定を書かない（clamp の下限も）。 */
  const sizes = [...CSSC.matchAll(/font(?:-size)?\s*:\s*([^;}]+)/g)].flatMap(m => [...m[1].matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)].map(x => [+x[1], m[0].trim().slice(0, 60)]));
  const tiny = sizes.filter(([n]) => n < 12);
  ok(sizes.length > 0 && !tiny.length, '12px より小さい字を指定していない', tiny.map(x => x[1]).join(' ／ '));
  /* この1枚の決まりは .pvg と .pvg-hero の中だけ（ほかの会社のページへ漏らさない）。
     data-pvg-… の印が付いた箱も中に数える（この印を書くのは gen-airline-glance.mjs だけ ＝ 対象のページにしか無い）。 */
  const sels = [...CSSC.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map(m => m[1].trim())
    .filter(x => x && !/^(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*$/.test(x))
    .flatMap(x => x.split(/,(?![^()]*\))/).map(y => y.trim()));
  const loose = sels.filter(x => !/\.pvg(?:-[\w-]+)?\b|\[data-pvg-[\w-]+/.test(x));
  ok(sels.length > 50 && !loose.length, '.pvg / .pvg-hero の外に決まりを書いていない', loose.slice(0, 5).join(' ／ '));
}
head('pv-glance.js・airline-base.js');
ok(!/[¥万円]/.test(JSC), 'pv-glance.js に金額の字（¥・万・円）が無い');
ok(!/\d{4,}/.test(JSC), 'pv-glance.js に4けた以上の数が無い', (JSC.match(/.{0,20}\d{4,}.{0,20}/) || [''])[0]);
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(JSC), 'pv-glance.js は HTML を組み立てない（見せる・隠す・動かすだけ）');
ok(/getAttribute\('data-pv-glance'\)\s*===\s*'1'\)\s*return/.test(noJsCmt(read('airlines/airline-base.js'))),
   'airline-base.js は5枚に、見本の点数を混ぜた評価を足さない');
{
  /* 口コミのタブの錠前のボタン。字を2行にしただけで、行き先も開く条件も今までと同じ（言葉はここに書く・写さない）。 */
  const ui = noJsCmt(read('airlines/airline-reviews-ui.js'));
  const fn = one(ui, /function unlockLabel\(plain\) \{([\s\S]*?)\n  \}/) || '';
  ok(fn.includes('<span class="pvg-gg-k" lang="en">Give &amp; Get</span>') && fn.includes(`<span class="pvg-gg-m">${RV_GIVE.reviews}</span>`),
     `口コミのタブの錠前のボタンは2行 ──「${GG}／${RV_GIVE.reviews}」`);
  ok(/if \(LANG !== 'ja' \|\| !isTabbed\(\)\) return plain;/.test(fn), '2行にするのは、タブのある日本語の会社ページだけ（ほかの会社と英語版は今までの1行）');
}

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
const WANT_S = argOf('--scenes') ? argOf('--scenes').split(',') : null, wantS = k => !WANT_S || WANT_S.includes(k);
/* 幅・高さ・最上段の組み方。
   高さは「ブラウザのバーを引いたあとの、本当に見える高さ」（assert-hero-fold.mjs と同じ決め方。
   端末の仕様表の数字に戻すと、全部 ✅ のまま実機では入っていない、になる）。
   col・side ＝ 縦に1列（会社概要 → 給与の1枚〔推定年収 → 提出された年収〕→ 評価スコア → 勤務 → 待遇 → 暮らし）。
   row ＝ 給与の1枚｜評価スコア が横に2つ・勤務｜待遇｜暮らし が横に3つ（中身の箱が 1040px 以上）。
   col と side で違うのは、質問の束（col は畳んだ形・side から開いた形）と「当サイトの推定」の1行だけ。
   1001 は左メニューが出る境目＝中身の箱がいちばん狭い。1250 は横並びがいちばん狭い。 */
const VIEWS = [
  [320, 568, 'col'], [351, 640, 'col'], [375, 640, 'col'], [390, 680, 'col'],
  [768, 950, 'side'], [1001, 700, 'side'], [1024, 700, 'side'],
  [1250, 800, 'row'], [1440, 820, 'row'],
].filter(v => !WANT_W || WANT_W.includes(v[0]));
/* 最初の1画面の約束をしている、いちばん狭い幅（これより狭い画面で入らなければ、下で知らせる）。
   幅 FOLD_PAY_FROM から ＝ 会社概要のカードと、推定年収の額（機長・副操縦士）が入る。
   それより狭い画面（スマホ）＝ 会社概要のカード（紹介の文まで）が入り、年収の額はそのすぐ下
   （AMT_GAP px 以内 ＝ 間に別の箱を挟んでいない）。 */
const FOLD_FROM = 390, FOLD_PAY_FROM = 768, AMT_GAP = 120;
const PARTIAL = ONLY.length !== FIVE.length || !!WANT_W || !!WANT_S;
const JOBS = Math.max(1, Number(process.env.PV_GLANCE_JOBS) || 3);

if (!(await fetch(`${BASE}/airlines/${FIVE[0]}.html`).then(r => r.ok, () => false))) {
  console.log(`\n  ✗ ${BASE} が動いていない（node serve.mjs を起動してから流す）`);
  console.log(`\n══ ${pass} pass / ${fail + 1} fail ══`);
  process.exit(1);
}
const { default: puppeteer } = await import('puppeteer');

/* 外へは1本も出さない。実データの欄が呼ぶ6つにだけ、決まった返事を返す。
     mode 'empty' … 0件（鍵は掛かったまま）
     mode 'rows'  … 鍵の無い人に返る、伏せた行（この会社に7件・ほかの会社に2件）
     mode 'rated' … 鍵の無い人に返る、点数の付いた口コミ3件（本文は無い。在るのは書かれた欄の名前と先頭の抜粋だけ）
     mode 'off'   … 全部 500 ＝「読めない時」
   口コミの要約の口（pv_review_summary）は、本番にまだ無い（2026-10-07）。無い時に本物のサーバーが返すのは 404 なので、
   'empty' と 'rows' では 404 を返す ＝ 画面は要約の欄に何も出さない（作った文で埋めない）。
   'rated' の時だけ「鍵の無い人への返事」を返す。わざと要約の文を混ぜる（画面が1文字も出さないことを見る）。 */
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const PAY_RE = /\/rest\/v1\/rpc\/pv_pay_rows$/;
/* ホテルの欄だけ、場面ごとに返事を差し替えられる（seen.stay）。運営の公開・却下は、送られた中身を控える（seen.mod）。
   ふだんは下の STUB のまま ＝ 鍵の1行。差し替えるのは「開いた時の画面」を見る1場面だけ。 */
const STAY_RE = /\/rest\/v1\/rpc\/pv_stays$/, STAY_MOD_RE = /\/rest\/v1\/rpc\/pv_stay_moderate$/;
const STUB = [
  [/\/rest\/v1\/rpc\/pv_reviews$/, '{"unlocked":false,"rows":[]}'],
  [PAY_RE, '{"ok":true,"state":"locked","rows":[]}'],
  [/\/rest\/v1\/airline_condition_facts$/, '[]'],
  /* 月の勤務の集計と会員の補足：未ログインに本物のサーバーが返すのは、状態の1語だけ（db/work-months.sql・db/contrib.sql）。 */
  [/\/rest\/v1\/rpc\/pv_work_view$/, '{"ok":true,"state":"login"}'],
  [/\/rest\/v1\/rpc\/pv_contrib_notes$/, '{"ok":true,"state":"login"}'],
  /* ホテル：確認済みのパイロットでない人に本物のサーバーが返すのは、状態の1語だけ（db/stays.sql）。都市を選んだ時にだけ呼ぶ。 */
  [/\/rest\/v1\/rpc\/pv_stays$/, '{"ok":true,"state":"locked"}'],
];
/* 未ログインの画面で、欄が落ち着く先。月の勤務は鍵（給与の提出で開く）・補足は欄ごと出さない・ほかは「まだありません」。 */
const CALM = x => (x.kind === 'work' ? x.on && x.state === 'locked' : x.kind === 'notes' ? !x.on && x.state === 'empty' : x.on && x.state === 'empty');
/* 鍵の無い人に本物のサーバーが返すのは、会社・出典・投稿時期の3つだけ（db/pay-rows.sql の mask）。
   ここではわざと、開いた行が持つ欄（職位・機材・年数・額・印）を混ぜて返す。
   画面がそれを1文字も出さないことを見るため ── サーバーが間違えても、画面からは漏れない。 */
const MASK_AGE = [0, 1, 2, 3, 4, 0, 1];
const MASK_VF = MASK_AGE.map((_, i) => i % 2 === 0);
const LEAK = { pos: 'captain', fleet: 'b787', ten: 3, tenk: 'r', annual_usd: 271828, far: true };
const maskedBody = slug => {
  const mine = MASK_AGE.map((age, i) => ({ airline: slug, verified: MASK_VF[i], age, ...LEAK }));
  const other = FIVE.filter(o => o !== slug).slice(0, 2).map(o => ({ airline: o, verified: true, age: 0, ...LEAK }));
  return JSON.stringify({ ok: true, state: 'locked', rows: [...mine.slice(0, 3), ...other, ...mine.slice(3)] });
};
/* 点数の付いた口コミ（鍵の無い人に返る形 ＝ 本文の列が無い）。3件めは「訓練」に点数を付けていない。 */
const REV_RE = /\/rest\/v1\/rpc\/pv_reviews$/;
const SCORE_KEYS = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
const RATED = [[4, 3, 4, 5, 3, 4], [5, 4, 4, 4, 4, 5], [3, 4, 3, 4, 4, null]];
const CLIP = '検査用の抜粋です。本文はサーバーから届いていません';
const ratedRows = slug => RATED.map((sc, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`, airline: slug, orig_lang: 'ja', position: i ? 'first_officer' : 'captain',
  tenure_bucket: '', fleet: '', job_role: '', created_at: `2026-0${7 + i}-15T00:00:00Z`,
  cats: ['culture', 'wlb'], clip: { k: 'culture', o: CLIP, t: {} },
  ...Object.fromEntries(SCORE_KEYS.map((k, j) => [k, sc[j]])),
}));
const ratedBody = slug => JSON.stringify({ unlocked: false, rows: ratedRows(slug) });
const VF_TEXT = v => (v ? '明細で確認済み' : '本人申告');
const AGE_TEXT = ['1ヶ月以内', '3ヶ月以内', '6ヶ月以内', '1年以内', 'それより前'];
const SUM_RE = /\/rest\/v1\/rpc\/pv_review_summary$/;
const SUM_LEAK = '検査用の要約です。鍵の無い人の画面に出てはいけません';
const SUM_LOCKED = JSON.stringify({ ok: true, state: 'locked', n: 3, as_of: '2026-09-30', good: [{ text: SUM_LEAK, cat: 'culture' }], concern: [{ text: SUM_LEAK, cat: 'wlb' }] });
const SUM_404 = '{"code":"PGRST202","details":null,"hint":null,"message":"Could not find the function public.pv_review_summary(p) in the schema cache"}';
const SUM_LOCK_TEXT = '要約は口コミの投稿で開きます';
const trouble = [];
/* 実データの欄が落ち着く（見えている欄が「まだ」「読み込み中」でなくなる）まで待つ。時間では待たない。 */
const SETTLED = () => !!window.PVCurrency && !!document.querySelector('.pvg') &&
  ![...document.querySelectorAll('.pvg .crl, .pvg-hero .crl')].some(n => n.getClientRects().length && /^(idle|loading)$/.test(n.dataset.state));

async function open(browser, slug, w, h, mode) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const seen = { mode, asked: 0, unknown: new Set(), stay: null, stays: 0, stayAsked: 0, mod: [], modReply: '{"ok":true}' };
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
      if (seen.mode !== 'off' && SUM_RE.test(u.pathname)) {
        return seen.mode === 'rated' ? r.respond({ status: 200, contentType: 'application/json', headers: cors, body: SUM_LOCKED })
                                     : r.respond({ status: 404, contentType: 'application/json', headers: cors, body: SUM_404 });
      }
      if (STAY_RE.test(u.pathname)) seen.stays++;
      if (seen.stay && STAY_RE.test(u.pathname)) { seen.stayAsked++; return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.stay }); }
      if (seen.stay && STAY_MOD_RE.test(u.pathname)) {
        let sent = null; try { sent = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null のまま控える */ }
        seen.mod.push(sent);
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.modReply });
      }
      const hit = seen.mode !== 'off' && STUB.find(([re]) => re.test(u.pathname));
      if (hit) {
        const body = seen.mode === 'rows' && hit[0] === PAY_RE ? maskedBody(slug) : seen.mode === 'rated' && REV_RE.test(u.pathname) ? ratedBody(slug) : hit[1];
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body });
      }
      if (seen.mode !== 'off') seen.unknown.add(`${r.method()} ${u.pathname}`);
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
  /* 評価スコア：社名の行と、カードに出ている字。short は、6角形の図のまわりに出る分類の名前（会社ページの口コミ欄と同じもの）。 */
  G.score = () => {
    const u = window.PVReviewUI || {}, c = document.querySelector('#pvg-score');
    const t = (s, root) => { const e = (root || document).querySelector(s); return e && on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const fill = s => { const e = document.querySelector(s); return e && on(e) ? e.style.getPropertyValue('--crl-fill') : null; };
    return {
      want: { short: (u.cats || {}).short || [] },
      hero: { avg: t('.pvg-hero .crl-avg'), cnt: t('.pvg-hero .crl-cnt'), fill: fill('.pvg-hero .crl-stars'), none: $$('.pvg-hero .crl-stars[data-none]').some(on) },
      card: !c || !on(c) ? null : {
        title: t('.pvg-head', c) || t('h2', c) || t('h3', c), avg: t('.crl-sc-avg b', c), cnt: t('.crl-sc-cnt', c), fill: fill('#pvg-score .crl-sc-sum .crl-stars'),
        stars: $$('.crl-stars', c).filter(on).length, msg: t('.crl[data-live="score"] .crl-msg', c),
        /* 口コミを書く入口（見えているもの全部）。カードの中に1つだけのはず。k ＝ 上の行・m ＝ 下の行・stacked ＝ 2行に積んである */
        write: $$('a[href*="submit-review"]', c).filter(on).map(a => {
          const k = a.querySelector('.pvg-gg-k'), m = a.querySelector('.pvg-gg-m');
          return { k: k ? k.textContent.trim() : null, m: m ? m.textContent.trim() : a.textContent.trim(), stacked: !!k && !!m && k.getBoundingClientRect().bottom <= m.getBoundingClientRect().top + 1, href: a.getAttribute('href') };
        }),
        /* 口コミの要約の欄：どの形か・場所を取っている高さ・出ている字・要約の項目の数 */
        sum: (() => { const e = c.querySelector('.crl[data-live="summary"]'); return !e ? null : {
          state: e.dataset.state, h: e.getBoundingClientRect().height, text: e.textContent.replace(/\s+/g, ' ').trim(), items: $$('.crl-sum-li, .crl-sum-h, .crl-sum-title', e).length }; })(),
        /* 口コミの欄：見えている件数・本文の字・錠前の1行 */
        revs: (() => { const e = c.querySelector('.crl[data-live="reviews"]'); return !e ? null : {
          state: e.dataset.state, h: e.getBoundingClientRect().height, items: $$('.crl-rev', e).filter(on).length,
          texts: $$('.crl-rev-text', e).filter(on).map(x => x.textContent.trim()), full: $$('.crl-rev-text:not(.crl-rev-clip)', e).filter(on).length,
          lock: t('.crl-lock', e) }; })(),
        radar: $$('.crl-radar-l', c).filter(on).map(e => ({ k: e.querySelector('span').textContent.trim(), v: e.querySelector('b').textContent.trim() })),
        /* 図の頂点が、まんなかからどれだけ離れているか（いちばん外の輪 ＝ 5点 を 1 とする）。描かれた形そのものを測る */
        reach: (() => {
          const ring = $$('.crl-radar-ring', c).pop(); if (!ring) return [];
          const b = ring.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = b.height / 2 || 1;
          return $$('.crl-radar-dot', c).map(e => { const q = e.getBoundingClientRect(); return Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) / R; });
        })(),
        h: (() => { const e = c.querySelector('.crl[data-live="score"]'); return e ? e.getBoundingClientRect().height : 0; })(),
        give: $$('.crl[data-live="reviews"] a', c).filter(on).length,
        y: c.getBoundingClientRect().top + scrollY, next: (() => { const n = c.nextElementSibling; return n ? n.getBoundingClientRect().top + scrollY : null; })(),
        /* 給与の1枚と同じ段の、すぐ次に在る */
        row: c.parentElement.classList.contains('pvg-payrow') && !!c.previousElementSibling && c.previousElementSibling.classList.contains('pvg-pay'),
      },
    };
  };
  G.live = () => $$('.pvg .crl, .pvg-hero .crl').map(e => ({
    kind: e.dataset.live, state: e.dataset.state, air: e.dataset.airline, on: on(e), hero: !!e.closest('.pvg-hero'),
    panel: (e.closest('.pvg-panel') || {}).id || '', text: e.textContent.replace(/\s+/g, ' ').trim(), retry: !!e.querySelector('.crl-retry'),
  }));

  /* ── 切れ・回転・はみ出し・重なり・空き ── */
  G.geom = folded => {
    const R = [], root = document.querySelector('.pvg');
    if (!root || !on(root)) return ['新しい節（.pvg）が見えていない'];
    /* ⚠️ innerWidth と比べない。スマホの見え方（isMobile）では、中身が画面より広いと innerWidth のほうが中身の幅まで伸びる
       ＝ 何px はみ出していても「同じ幅」と出る（2026-10-08・320px のキャセイが 5px はみ出していたのに緑だった）。
       画面の幅は clientWidth（こちらは伸びない）。 */
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) R.push(`横あふれ ページ ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
    for (const e of $$('.pvg *, .pvg-hero *, .pvg-tabbar *')) {
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
    /* 3b) 職位の列・公表額の行から出ている額と見出し（カードの内側の余白に隠れて、3) では見つからない）。
           読み上げ専用の字（.pvg-vh）は数えない。字の節だけを測る。 */
    for (const rk of $$('.pvg-rank, .pvg-pub li', root)) {
      if (!on(rk)) continue;
      const c = rk.getBoundingClientRect();
      for (const e of $$('.pvg-big, .pvg-rk, .pvg-pk, .pvg-pv, .pvg-pn', rk)) {
        if (!on(e)) continue;
        let right = -1e9;
        const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          if (!n.nodeValue.trim() || n.parentElement.closest('.pvg-vh')) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const q of rg.getClientRects()) right = Math.max(right, q.right);
        }
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
      if (!on(card)) continue;
      const c = card.getBoundingClientRect(); let bottom = c.top;
      for (const e of $$('*', card)) { if (on(e) && (hasText(e) || e.tagName === 'IMG')) bottom = Math.max(bottom, e.getBoundingClientRect().bottom); }
      const gap = c.bottom - parseFloat(getComputedStyle(card).paddingBottom) - bottom;
      if (gap > 48) R.push(`空き ${name(card).slice(0, 40)} 下に ${Math.round(gap)}px`);
    }
    return [...new Set(R)];
  };

  /* ── 概要の箱の並び：会社概要／給与の1枚（pay）とその中の提出された年収（rp）／評価スコア（rv）／勤務・待遇・暮らし ── */
  G.shape = () => {
    const q = s => { const e = document.querySelector(s); if (!e || !on(e)) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY }; };
    /* amt ＝ 推定年収の額（機長・副操縦士）の下端。最初の1画面に入っていると約束しているもの */
    const amt = $$('.pvg-pay .pvg-rank .pvg-big').filter(on).map(e => e.getBoundingClientRect().bottom + scrollY);
    return { co: q('.pvg-co'), pay: q('.pvg-pay'), rp: q('#pvg-realpay'), rv: q('#pvg-score'),
             work: q('.pvg [data-cell="work"]'), benefits: q('.pvg [data-cell="benefits"]'), living: q('.pvg [data-cell="living"]'),
             amt: amt.length ? Math.max(...amt) : null, vh: innerHeight };
  };

  /* ── 棒：描かれた模様と長さ ── */
  const sig = bar => {
    const cs = getComputedStyle(bar), af = getComputedStyle(bar, '::after'), tr = bar.parentElement.getBoundingClientRect(), r = bar.getBoundingClientRect();
    return { kind: ([...bar.classList].find(c => /^pvg-bar-./.test(c)) || '').slice(8), img: cs.backgroundImage, bg: cs.backgroundColor, sh: cs.boxShadow, op: +cs.opacity,
             afi: af.backgroundImage, x: r.left - tr.left, w: r.width, tw: tr.width, sw: bar.style.width };
  };
  /* 額のまわりの印だけを抜く（額そのものは ¤ に置き換える・原貨の額は外す）：「¤」「〜¤」「¤超」。 */
  const frame = a => {
    if (!a) return '';
    const c = a.cloneNode(true);
    for (const x of $$('.pv-no-cur', c)) x.remove();
    const sp = c.querySelector('.pv-cur'), t = c.textContent.trim();
    return sp ? t.replace(sp.textContent, '¤') : t;
  };
  /* 給与の箱（説明を開く前）：推定年収の2つの欄と棒／公表額の行／「当サイトの推定」の1行。 */
  G.pay = () => ({
    width: document.querySelector('.pvg').getBoundingClientRect().width,
    bars: $$('.pvg-pay .pvg-bar').filter(on).length,
    ranks: $$('.pvg-pay .pvg-rank').filter(on).map(r => { const b = r.querySelector('.pvg-bar'); return { rank: r.dataset.rank, frame: frame(r.querySelector('.pvg-big')), bar: b && on(b) ? sig(b) : null }; }),
    rows: $$('.pvg-pay .pvg-pub li').filter(on).map(li => ({ kind: li.dataset.kind, frame: frame(li.querySelector('.pvg-pv')), value: on(li.querySelector('.pvg-pv')) })),
    estk: $$('.pvg-pay > .pvg-estk').some(on),
  });

  /* ── 提出された年収の一覧 ── */
  G.realpay = () => {
    const card = document.querySelector('#pvg-realpay'), box = card && card.querySelector('.crl[data-live="realpay"]');
    if (!box || !on(card)) return null;
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    const rows = $$('.crl-row', box);
    /* 件数の行と、出典・投稿時期の行（どちらも数字を含んでよい）を外した残り。ここに数字が在ってはいけない。 */
    const rest = box.cloneNode(true);
    for (const x of $$('.crl-count, .crl-row-c', rest)) x.remove();
    return {
      state: box.dataset.state, width: document.querySelector('.pvg').getBoundingClientRect().width,
      count: t(box.querySelector('.crl-count')), msg: t(box.querySelector('.crl-msg')), lock: t(box.querySelector('.crl-lock')),
      total: rows.length, rest: t(rest), html: box.innerHTML, cur: $$('.pv-cur', card).length,
      rows: rows.filter(on).map(li => ({
        mask: li.getAttribute('data-mask'),
        a: t(li.querySelector('.crl-row-a')), b: t(li.querySelector('.crl-row-b')), c: t(li.querySelector('.crl-row-c')),
        hid: [li.querySelector('.crl-row-a'), li.querySelector('.crl-row-b')].every(x => !!x && x.getAttribute('aria-hidden') === 'true'),
        plates: $$('.crl-plate', li).map(pl => { const r = pl.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), kids: pl.childNodes.length, attrs: pl.attributes.length, blur: getComputedStyle(pl).filter }; }),
        extra: $$('.crl-amt, .crl-pos, .crl-sub, .crl-chip, .crl-far', li).length,
      })),
      /* 2行のボタンは「上の行／下の行」で読む。stacked ＝ 2行に積んである（1行のリンクは null） */
      links: $$('a', box).filter(on).map(a => {
        const k = a.querySelector('.crl-cta-k'), m = a.querySelector('.crl-cta-m');
        return { cta: a.classList.contains('crl-cta'), text: k && m ? t(k) + '／' + t(m) : t(a), stacked: k && m ? k.getBoundingClientRect().bottom <= m.getBoundingClientRect().top + 1 : null, href: a.getAttribute('href') };
      }),
    };
  };

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
      pay: $$('.pvg-pay .pvg-rank .pvg-big .pv-cur, .pvg-pay .pvg-pub .pvg-pv .pv-cur').map(e => +e.dataset.jpy).sort((a, b) => a - b),
      payFrames: $$('.pvg-pay .pvg-rank .pvg-big, .pvg-pay .pvg-pub .pvg-pv').map(frame),
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
    const roots = scope ? $$(scope) : $$('.pvg, .pvg-hero, .pvg-tabbar');
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
/* 推定年収の棒の色は深い金（2026-10-07 オーナーのご指示「黒の給与額＋深みのある金色のバー」）。会社の色では描かない
   ＝ 5社とも同じ色。色の値は pv-tokens.css の星の色（明るい画面の側）。 */
const BAR_GOLD = one(read('pv-tokens.css'), /--pv-star:\s*(#[0-9a-fA-F]{6})/);
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
  if (hex && kind !== 'crew' && !`${b.img} ${b.bg} ${b.sh}`.includes(rgbOf(hex))) bad.push(`決めた色（${hex}）で描かれていない`);
  if (Math.abs(b.x) > 0.5) bad.push(`0 から始まっていない（${b.x.toFixed(1)}px）`);
  const want = b.tw * parseFloat(b.sw) / 100;
  if (Math.abs(b.w - want) > 1) bad.push(`描かれた長さ ${b.w.toFixed(1)}px（台 ${b.tw.toFixed(1)}px × ${b.sw} ＝ ${want.toFixed(1)}px）`);
  return bad;
}
const near = (a, b, t = 1) => Math.abs(a - b) <= t;
/* 概要の並び。上から 会社概要 → 給与の1枚（推定年収 → 提出された年収）と評価スコア → 勤務・待遇・暮らし。
   row（中身の箱が 1040px 以上）は 給与の1枚｜評価スコア が横に2つ。それより狭い画面は縦に1列。 */
function shapeBad(sh, kind) {
  const { co, pay, rp, rv, work, benefits, living, amt } = sh;
  if (!(co && pay && rp && rv && work && benefits && living)) {
    return [`見えていない箱が在る（${Object.entries({ 会社概要: co, 給与: pay, 提出された年収: rp, 評価スコア: rv, 勤務: work, 待遇: benefits, 暮らし: living }).filter(([, v]) => !v).map(([k]) => k).join('・')}）`];
  }
  const bad = [], cells = [work, benefits, living], rowB = Math.max(pay.b, rv.b);
  if (!(co.b <= pay.y + 1 && co.b <= rv.y + 1 && cells.every(c => rowB <= c.y + 1))) bad.push('上から 会社概要 → 給与・評価スコア → 勤務・待遇・暮らし の順でない');
  if (!(rp.y >= pay.y && rp.b <= pay.b + 1 && rp.x >= pay.x - 1 && rp.x + rp.w <= pay.x + pay.w + 1 && amt !== null && rp.y >= amt - 1)) {
    bad.push(`提出された年収が、給与の1枚の中・推定年収の額の下に無い（額の下端 ${Math.round(amt || 0)}・一覧の頭 ${Math.round(rp.y)}）`);
  }
  if (kind === 'row') {
    /* 評価スコアのカードは、0件の時だけ中身の高さ（給与の1枚より低い）。点数が在る時は給与の1枚と同じ高さ。 */
    if (!(near(pay.y, rv.y, 2) && pay.x + pay.w <= rv.x + 1 && rv.h <= pay.h + 2)) bad.push(`給与｜評価スコア が、頭をそろえて横に並んでいない（高さ ${Math.round(pay.h)}・${Math.round(rv.h)}）`);
    if (!cells.every(c => near(c.y, work.y) && near(c.h, work.h))) bad.push(`横に並ぶ 勤務・待遇・暮らし の高さがそろっていない（${cells.map(c => Math.round(c.h)).join('・')}）`);
    if (!cells.every((c, i) => !i || cells[i - 1].x + cells[i - 1].w <= c.x + 1)) bad.push('左から 勤務 → 待遇 → 暮らし の順でない');
  } else {
    if (![rv, ...cells].every(c => near(c.x, pay.x) && near(c.w, pay.w))) bad.push('箱が同じ幅で縦に1列になっていない');
    if (!(pay.b <= rv.y + 1)) bad.push('評価スコアが、給与の1枚の下に無い');
    if (!(work.b <= benefits.y + 1 && benefits.b <= living.y + 1)) bad.push('勤務 → 待遇 → 暮らし の順でない');
  }
  return bad;
}
/* 最初の1画面に入っていると約束しているもの。
   広い画面（幅 FOLD_PAY_FROM から）＝ 会社概要のカードと、推定年収の額（機長・副操縦士）。
   スマホ ＝ 会社概要のカード。年収の額はそのすぐ下に在ればよい（foldBadOf が AMT_GAP で見る）。 */
const foldOf = (sh, w) => Math.round(w >= FOLD_PAY_FROM ? Math.max(sh.co ? sh.co.b : 0, sh.amt || 0) : (sh.co ? sh.co.b : 0));
const FOLD_WHAT = w => (w >= FOLD_PAY_FROM ? '会社概要 と 年収の額 が入る' : `会社概要 が入り、年収の額はそのすぐ下（${AMT_GAP}px 以内）`);
function foldBadOf(sh, w, h) {
  const bad = [], f = foldOf(sh, w);
  if (f > h) bad.push(`下端 ${f} > ${h}`);
  if (w < FOLD_PAY_FROM && !(sh.co && sh.amt !== null && sh.amt - sh.co.b <= AMT_GAP)) bad.push(`年収の額が会社概要のすぐ下に無い（会社概要の下端 ${sh.co ? Math.round(sh.co.b) : '—'}・額の下端 ${sh.amt === null ? '—' : Math.round(sh.amt)}）`);
  return bad;
}
/* 提出された年収の一覧：置き場所と、下に並ぶ入口（0件の時も、伏せた行の時も同じ）。 */
function bandBad(s, sh, rp) {
  const bad = [], { pay, rp: box, rv, amt } = sh;
  if (!(pay && box && rv)) return ['給与の1枚・提出された年収・評価スコアのどれかが見えていない'];
  if (!(box.y >= pay.y && box.b <= pay.b + 1 && box.x >= pay.x - 1 && box.x + box.w <= pay.x + pay.w + 1 && amt !== null && box.y >= amt - 1)) {
    bad.push(`給与の1枚の中・推定年収の額の下に無い（額の下端 ${Math.round(amt || 0)}・一覧の頭 ${Math.round(box.y)}）`);
  }
  const want = [
    { cta: true, text: `${GG}／${GIVE}`, stacked: true, href: `../pay-report.html?airline=${s}` },
    { cta: false, text: 'ログイン', stacked: null, href: `../login.html?redirect=${encodeURIComponent(`airlines/${s}.html`)}` },
    { cta: false, text: TERMS, stacked: null, href: `../actual-pay.html?air=${s}` },
  ];
  if (!same(rp.links, want)) bad.push(`入口が違う：${rp.links.map(l => `${l.cta ? '［ボタン］' : ''}${l.text}${l.stacked === false ? '（1行に並んでいる）' : ''} → ${l.href}`).join(' ／ ')}`);
  if (rp.cur) bad.push(`箱の中に、通貨で換わる額が ${rp.cur}つ在る`);
  return bad;
}
const squash = t => t.replace(/\s+/g, '');
const NO_NUM = /[0-9０-９★☆⭐¥]/u;
const IS_SCORE = x => x.kind === 'stars' || x.kind === 'score';
/* 評価スコアのあるべき答え。偽のサーバーが返した行から、ここで計算し直す（画面の側の関数を呼ばない）。
     1件の点 ＝ その人が付けた分類だけの平均（付けていない分類を 0 と数えない）
     総合点   ＝ 点数を付けた人の「1件の点」の平均／件数 ＝ 点数を付けた人の数
     6分類    ＝ 分類ごとの平均。どれか1つでも誰も付けていなければ、図は描かない
   点数の付いた投稿が1件も無ければ null ＝「評価未取得」（0点ではない）。 */
function ratedWant(rows) {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const per = [], cat = SCORE_KEYS.map(() => []);
  for (const r of rows) {
    const got = [];
    SCORE_KEYS.forEach((k, i) => { const v = Number(r[k]); if (Number.isFinite(v) && v > 0) { got.push(Math.min(5, v)); cat[i].push(Math.min(5, v)); } });
    if (got.length) per.push(mean(got));
  }
  return per.length ? { n: per.length, avg: mean(per), ratings: cat.every(c => c.length) ? cat.map(mean) : null } : null;
}
/* 評価スコア：社名の行とカードが同じ答えを出しているか。rows ＝ 偽のサーバーが返した口コミ（0件なら []）。
   sum ＝ 口コミの要約の欄のあるべき形（'empty' ＝ 口が無い・要約が無い → 何も出さない／'locked' ＝ 鍵の無い人 → 錠前の1行だけ）。 */
function scoreBad(s, sc, slots, rows, sum) {
  const bad = [], c = sc.card, W = ratedWant(rows), one = v => Number(v).toFixed(1), state = W ? 'open' : 'empty';
  if (!(slots.length === 2 && slots.every(x => x.on && x.state === state))) bad.push(`欄が ${slots.map(x => `${x.kind}:${x.state}`).join(' ')}（あるべき ${state}）`);
  if (!c) return [...bad, '評価・口コミのカードが見えていない'];
  if (!W) {
    if (sc.hero.avg !== null || sc.hero.fill || !sc.hero.none || sc.hero.cnt !== '評価未取得') bad.push(`社名の行が「色の無い星＋評価未取得」でない（${sc.hero.avg}・「${sc.hero.cnt}」）`);
    if (c.avg !== null || c.cnt !== null || c.stars || c.radar.length) bad.push(`0件なのに、カードに点数・星・図が出ている（${c.avg}・${c.cnt}・星 ${c.stars}・図 ${c.radar.length}）`);
    if (c.msg !== '会員からの投稿はまだありません') bad.push(`カードの知らせが「${c.msg}」`);
    if (c.give) bad.push(`口コミの欄の中に、入口がもう ${c.give}つ在る`);
  } else {
    const fill = `${Math.round(W.avg / 5 * 1000) / 10}%`, cnt = `${W.n}件の評価`;
    if (sc.hero.avg !== one(W.avg) || c.avg !== one(W.avg)) bad.push(`総合点が違う（社名の行 ${sc.hero.avg}・カード ${c.avg}・あるべき ${one(W.avg)}）`);
    if (sc.hero.fill !== fill || c.fill !== fill) bad.push(`星の塗りが違う（社名の行 ${sc.hero.fill}・カード ${c.fill}・あるべき ${fill}）`);
    if (sc.hero.cnt !== cnt || c.cnt !== cnt) bad.push(`件数が違う（社名の行「${sc.hero.cnt}」・カード「${c.cnt}」・あるべき「${cnt}」）`);
    if (!W.ratings) { if (c.radar.length) bad.push('誰も点数を付けていない分類が在るのに、6角形の図を描いている'); }
    else if (sc.want.short.length !== 6) bad.push('分類の名前（PVReviewUI）を読めない');
    else {
      if (!same(c.radar.map(r => [r.k, r.v]), sc.want.short.map((k, i) => [k, one(W.ratings[i])]))) bad.push(`6角形の図のまわりの字が違う：${c.radar.map(r => `${r.k} ${r.v}`).join('・')}`);
      if (c.reach.length !== 6 || !c.reach.every((r, i) => Math.abs(r - W.ratings[i] / 5) < 0.03)) bad.push(`6角形の図の形が点数に比例していない：${c.reach.map(r => r.toFixed(2)).join('・')}`);
    }
  }
  if (!(c.h <= 320)) bad.push(`評価スコアの欄が大きい（高さ ${Math.round(c.h)}px・上限 320px）`);
  if (!same(c.write, [{ k: GG, m: RV_GIVE.overview, stacked: true, href: `../submit-review.html?airline=${s}` }])) {
    bad.push(`口コミを書く入口が、2行のボタン「${GG}／${RV_GIVE.overview}」1つでない：${c.write.map(a => `${a.k || ''}／${a.m}${a.stacked ? '' : '（2行でない）'} → ${a.href}`).join(' ‖ ') || '無い'}`);
  }
  if (!c.row) bad.push('給与の1枚と同じ段に無い');
  if (!c.sum) bad.push('口コミの要約の欄が無い');
  else if (sum === 'locked') {
    if (!(c.sum.state === 'locked' && c.sum.text === SUM_LOCK_TEXT && !c.sum.items)) bad.push(`鍵の無い人なのに、要約の欄が錠前の1行だけでない（${c.sum.state}・「${c.sum.text.slice(0, 40)}」・項目 ${c.sum.items}）`);
  } else if (!(c.sum.state === 'empty' && c.sum.h === 0 && c.sum.text === '' && !c.sum.items)) {
    bad.push(`要約が無いのに、要約の欄が場所を取っている・字を出している（${c.sum.state}・高さ ${c.sum.h}・「${c.sum.text.slice(0, 40)}」）`);
  }
  return bad;
}
const press = async h => { await h.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await h.click(); };
const hard = (pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: ${ms / 1000}秒で終わらなかった`)), ms))]);

const belowFold = [];           // 約束していない幅で、年収の額が最初の1画面に入らなかったもの（知らせるだけ）

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
    const shown = live.filter(x => x.on);
    ok(live.length === LIVE_N && live.every(x => x.air === s), `${tag}: 実データの欄は${LIVE_N}で、自分の会社を指している`, `${live.length}`);
    /* 0件の時は、評価スコアの2つ（社名の行・カード）も含めて、どの欄も数字を出さない（0件に仮の点数を出さない）。 */
    ok(shown.length >= 5 && shown.every(CALM), `${tag}: 0件の時は、どの欄も「まだありません」（月の勤務だけは鍵）`, shown.map(x => `${x.kind}:${x.state}`).join(' '));
    ok(live.every(x => !NO_NUM.test(x.text)), `${tag}: 0件の時に、どの欄も数字・0・星を1つも出さない`, live.filter(x => NO_NUM.test(x.text)).map(x => x.text.slice(0, 30)).join(' ／ '));
    {
      const sc = await ev(() => window.__pvg.score());
      const bad = scoreBad(s, sc, live.filter(IS_SCORE), [], 'empty');
      ok(!bad.length, `${tag}: 評価スコア（0件の時）── 社名の行は「評価未取得」・カードは「会員からの投稿はまだありません」・見本の点数も作った要約も出さない・書く入口は2行のボタン「${GG}／${RV_GIVE.overview}」1つ`, bad.join(' ／ '));
    }
    ok(live.filter(x => !x.on).every(x => x.state === 'idle'), `${tag}: 閉じている板の中の欄は、開くまで読みに行かない`);
    const rules = await ev(() => window.__pvg.rules());
    ok(Object.values(rules).every(n => n > 10), `${tag}: hover／focus-visible／active の決まりを読めた`, JSON.stringify(rules));

    await ev(() => window.__pvg.top());
    await geom('円・畳んだ形', true);
    await probe(null);

    const sh0 = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh0, kind).length, `${tag}: 概要の並び（会社概要 → 給与の1枚〔推定年収 → 提出された年収〕と評価スコア → 勤務・待遇・暮らし／${kind === 'row' ? '給与｜評価スコア は横に2つ・入口は横に3つ' : '縦に1列'}）`, shapeBad(sh0, kind).join(' ／ '));

    const pay0 = await ev(() => window.__pvg.pay());
    {
      const bad = [];
      if (!same(pay0.ranks.map(r => r.rank), RANKS.map(([rk]) => rk))) bad.push(`見えている推定年収の欄が ${pay0.ranks.map(r => r.rank).join(', ') || '無い'}`);
      for (const r of pay0.ranks) {
        if (r.frame !== '¤') bad.push(`${r.rank}: 推定年収が額だけで出ていない（${r.frame}）`);
        if (!r.bar) { bad.push(`${r.rank}: 棒が見えていない`); continue; }
        for (const x of barBad(r.bar, 'est', BAR_GOLD)) bad.push(`${r.rank}: ${x}`);
        if (COLOR[s] && COLOR[s].toLowerCase() !== BAR_GOLD.toLowerCase() && `${r.bar.img} ${r.bar.bg}`.includes(rgbOf(COLOR[s]))) bad.push(`${r.rank}: 棒が会社の色（${COLOR[s]}）で描かれている`);
      }
      if (pay0.bars !== 2) bad.push(`見えている棒が ${pay0.bars}本（推定年収の2本だけのはず）`);
      ok(!bad.length, `${tag}: 推定年収は機長も副操縦士も額と棒で見えている ── 棒は2本だけ・深い金の平らな塗り（会社の色にしない）・0 から・描かれた長さが指定どおり`, bad.slice(0, 6).join(' ／ '));
    }
    {
      /* 会社が公表している金額の行（棒は無い）。上限は「〜」・下限は「超」が額に付いて見えている。 */
      const FRAME = { cap: '〜¤', over: '¤超', co: '¤', crew: '¤' };
      const want = [];
      for (const [rk] of RANKS) { const m = rankModel(s, rk); for (const f of [m.cap, m.co].filter(Boolean)) want.push(KIND[f.key]); }
      if (crewModel(s).length) want.push('crew');
      ok(same(pay0.rows.map(r => r.kind), want) && pay0.rows.every(r => r.value && r.frame === FRAME[r.kind]),
         `${tag}: 公表額の行は台帳の数だけ見えていて、上限には「〜」・下限には「超」が付く`, pay0.rows.map(r => `${r.kind}:${r.frame}`).join(' '));
      if (kind !== 'col') ok(pay0.estk, `${tag}: 広い画面では、棒のすぐ下に「${EST_BY}」が見えている`);
    }

    /* 提出された年収の一覧（この会社の提出が0件の時）：「まだ記録がありません」と、提出へ進むボタン。 */
    {
      const rp = await ev(() => window.__pvg.realpay());
      const bad = !rp ? ['一覧の箱が見えていない'] : [...bandBad(s, sh0, rp)];
      if (rp) {
        if (!(rp.state === 'empty' && rp.msg === 'まだ記録がありません')) bad.push(`「まだ記録がありません」になっていない（${rp.state}・${rp.msg}）`);
        if (rp.count !== null || rp.lock !== null || rp.total) bad.push(`0件なのに、件数・行・「提出で開きます」のどれかが出ている（${rp.count}・${rp.total}行・${rp.lock}）`);
      }
      ok(!bad.length, `${tag}: 提出された年収（0件の時）── 給与の1枚の中・推定年収のすぐ下に在る・「まだ記録がありません」・2行のボタン「${GG}／${GIVE}」で給与の提出へ・「${TERMS}」は REAL PAY へ`, bad.join(' ／ '));
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
      const bad = foldBadOf(sh, w, h);
      if (!bad.length) return;
      if (w >= FOLD_FROM) foldBad.push(`${cur}: ${bad.join('・')}`);
      else belowFold.push([w, h, s, cur, foldOf(sh, w)]);
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
    ok(!markBad.length, `${tag}: どの通貨でも「〜」「超」の印が残る`, markBad.slice(0, 3).join(' ／ '));
    ok(!rawBad.length, `${tag}: 原貨の額と台帳の注は、通貨を換えても1文字も動かない`, rawBad.join(' '));
    ok(!shapeCur.length, `${tag}: どの通貨でも概要の並びが崩れない`, shapeCur.slice(0, 4).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBad.length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（どの通貨でも）`, foldBad.join(' ／ '));
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
        if (!calm || !lv.length || !lv.every(x => CALM(x) && !NO_NUM.test(x.text))) bad.push(`${c.id}: 開いた板の欄が落ち着かない ── 集計は「まだありません」・月の勤務は鍵・補足は出さない（${lv.map(x => `${x.kind}:${x.state}:${x.on ? '見える' : '隠れる'}`)}）`);
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
       募集要項は「概要」のタブの下のほうに在る。押したら、概要のまま、その節へ寄る（6つのタブに「採用」は無い）。
       （無いタブへ切り替えると、どの面も選ばれず、ページの中身がぜんぶ消える。実際にそうなっていた。） */
    await press(await p.$('.pvg [data-pvg-tab="jobs"]'));
    const jobsAt = () => {
      const on = e => !!e && e.checkVisibility({ visibilityProperty: true });
      const h2 = [...document.querySelectorAll('.glass h2')].find(x => /募集要項|採用情報/.test(x.textContent) && !x.closest('.pvg'));
      const box = h2 && h2.closest('.glass');
      return {
        top: box && on(box) ? Math.round(box.getBoundingClientRect().top) : null, vh: innerHeight,
        tab: window.PVGlance ? window.PVGlance.at() : '', pvg: on(document.querySelector('.pvg')),
        faces: [...document.querySelectorAll('[data-tab-section]')].filter(on).length,
      };
    };
    /* 見出しが固定ヘッダーの下に隠れず、節の頭から読める高さに在る */
    await p.waitForFunction(`(() => { const a = (${jobsAt})(); return a.top !== null && a.top >= 60 && a.top <= a.vh - 120; })()`, { timeout: 8000 }).catch(() => {});
    const at = await ev(jobsAt);
    ok(at.faces > 0, `${tag}: 「募集要項を開く」を押しても、ページの中身が消えない`, JSON.stringify(at));
    ok(at.top !== null && at.top >= 60 && at.top <= at.vh - 120, `${tag}: 「募集要項を開く」で、募集要項が画面に出る`, JSON.stringify(at));
    ok(at.tab === 'overview' && at.pvg, `${tag}: 「募集要項を開く」は、概要のタブのまま、その節へ寄る`, JSON.stringify(at));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている7つだけ`, [...seen.unknown].join(' '));
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
    /* 口コミの欄は、すぐ上の評価スコアの欄が同じ知らせを出しているあいだは出さない（同じ文を2回出さない）。 */
    ok(live.length >= 4 && live.every(x => x.state === 'error' && x.retry), `${tag}: 見えている欄は全部「いま読み出せません」＋やり直すボタン`, live.map(x => `${x.kind}:${x.state}`).join(' '));
    ok(live.every(x => !NO_NUM.test(x.text)), `${tag}: 読めない時に、数字・0・星を1つも出さない`, live.filter(x => NO_NUM.test(x.text)).map(x => x.text.slice(0, 30)).join(' ／ '));
    ok(live.filter(IS_SCORE).length === 2 && !(await ev(() => document.querySelector('.pvg-hero .crl-stars, #pvg-score .crl-sc'))), `${tag}: 読めない時は、評価スコアの欄に星も点数も出さない`);
    await ev(() => window.__pvg.top());
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: それでも最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    const pr = await ev(() => window.__pvg.probe(null));
    ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    /* 社名の下の「いま読み出せません｜やり直す」は、右の2つのボタンに隠れない。
       いちばん狭い画面で1行のまま右へ伸び、「やり直す」が「他社と比較」の下へもぐって押せなかった
       （4) の重なりは、同じ箱の子どうししか見ないので見つけられない）。 */
    const hid = await ev(() => {
      const b = document.querySelector('.pvg-hero .crl .crl-retry');
      if (!b || !b.getClientRects().length) return ['「やり直す」が見えていない'];
      b.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = b.getBoundingClientRect(), R = [];
      for (const a of document.querySelectorAll('.pvg-hero .pvg-acts .pvg-btn')) {
        if (!a.getClientRects().length) continue;
        const q = a.getBoundingClientRect();
        const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (ox > 1 && oy > 1) R.push(`「${a.textContent.replace(/\s+/g, ' ').trim()}」と ${Math.round(ox)}×${Math.round(oy)}px 重なる`);
      }
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!(hit && (hit === b || b.contains(hit)))) R.push(`まんなかを押すと別のものに当たる（${hit ? String(hit.className || hit.tagName).slice(0, 40) : '何も無い'}）`);
      return R;
    });
    ok(!hid.length, `${tag}: 「やり直す」が、社名の横のボタンに隠れていない（押せる）`, hid.join('・'));
    /* サーバーが戻ったあと、やり直すボタンで読み直せる。 */
    seen.mode = 'empty';
    const before = seen.asked;
    await press(await p.$('.pvg-hero .crl .crl-retry'));
    /* 戻ったサーバーは0件を返す ＝ 直った形は「評価未取得」（empty）。 */
    const back = await p.waitForFunction(() => document.querySelector('.pvg-hero .crl').dataset.state === 'empty' && document.querySelector('#pvg-score .crl[data-live="score"]').dataset.state === 'empty', { timeout: 15000 }).then(() => true, () => false);
    ok(back && seen.asked > before, `${tag}: 「やり直す」でもう一度読みに行き、読めたら直る`, `問い合わせ ${before} → ${seen.asked}`);
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* 「鍵の無い人」：サーバーが伏せた行を返す（この会社に7件・ほかの会社に2件）。
   出てよいのは 件数・出典・投稿時期 だけ。額・職位・機材・年数は、サーバーが間違えて送ってきても1文字も出ない。 */
async function runRows(browser, s, [w, h, kind]) {
  const tag = `${s} ${w}（鍵の無い人）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'rows');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const sh = await ev(() => window.__pvg.shape());
    const rp = await ev(() => window.__pvg.realpay());
    if (!rp) { ok(false, `${tag}: 提出された年収の箱が見えている`); return; }
    /* 概要に出すのは「一部」＝ 新しい3行（data-top="3"）。全部は REAL PAY に在る。 */
    const N = MASK_AGE.length, top = Math.min(3, N), nShow = top;
    ok(rp.state === 'locked' && rp.count === `${N}件の提出`, `${tag}: 鍵は掛かったまま・件数はこの会社の分だけ（ほかの会社の行を数えない）`, `${rp.state}・${rp.count}`);
    ok(rp.total === top && rp.rows.length === nShow, `${tag}: 見える行は ${nShow}行（どの幅でも3行まで）`, `${rp.rows.length}／${rp.total}行・箱の幅 ${Math.round(rp.width)}`);
    {
      const bad = [];
      for (const [i, r] of rp.rows.entries()) {
        const at = `${i + 1}行め`;
        if (r.mask !== 'line' || !r.hid) bad.push(`${at}: 伏せた行の形でない`);
        if (r.a !== '' || r.b !== '年収') bad.push(`${at}: 伏せた欄に字が在る（「${r.a}」「${r.b}」）`);
        if (r.extra) bad.push(`${at}: 開いた行の部品（職位・機材・額・印）が ${r.extra}つ在る`);
        if (squash(r.c || '') !== VF_TEXT(MASK_VF[i]) + AGE_TEXT[MASK_AGE[i]]) bad.push(`${at}: 出典と投稿時期が、サーバーの返事と違う（${r.c}）`);
        if (!(same(r.plates.map(x => [x.w, x.h]), [[52, 12], [44, 12], [86, 14]]) && r.plates.every(x => !x.kids && x.attrs === 1 && /blur\(/.test(x.blur)))) {
          bad.push(`${at}: 板が「中身の無い、ぼかした板」でない（${r.plates.map(x => `${x.w}×${x.h}`).join(' ')}）`);
        }
      }
      ok(!bad.length, `${tag}: 行ごとに出るのは 出典と投稿時期 だけ ── 職位・機材・額の所は、中身の無いぼかした板（幅は全行で同じ）`, bad.slice(0, 5).join(' ／ '));
    }
    {
      /* わざと混ぜた 職位・機材・年数・額・印 が、字にも属性にも出ていない。件数と投稿時期のほかに数字が無い。 */
      const leak = [/271/, /captain/i, /b787/i, /機長|副操縦士/, /⚠/, /data-(pos|fleet|ten|far|usd)/].filter(re => re.test(rp.html)).map(String);
      ok(!leak.length && !NO_NUM.test(rp.rest), `${tag}: サーバーが額や職位を送ってきても、画面には1文字も出ない（数字は 件数と投稿時期 だけ）`, `${leak.join(' ')} ${NO_NUM.test(rp.rest) ? rp.rest.slice(0, 60) : ''}`);
    }
    {
      const bad = bandBad(s, sh, rp);
      if (rp.lock !== '給与の提出で開きます') bad.push(`錠前の1行が「${rp.lock}」`);
      if (rp.msg !== null) bad.push(`行が在るのに「${rp.msg}」と出ている`);
      ok(!bad.length, `${tag}: 給与の1枚の中・推定年収のすぐ下に在る・「給与の提出で開きます」・2行のボタン「${GG}／${GIVE}」で給与の提出へ・ログインと「${TERMS}」（REAL PAY）への入口`, bad.join(' ／ '));
    }
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（一覧が押し出さない）`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    const pr = await ev(() => window.__pvg.probe('#pvg-realpay'));
    ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 一覧の字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている7つだけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
const ROWS_W = [320, 390, 768, 1440];

/* 「点数の付いた口コミが在る時」：偽のサーバーが、鍵の無い人向けの3件を返す（点数は在る・本文は無い・抜粋が1つ）。
   社名の行の星とカードの総合点が同じ答えになる・6角形の図が点数どおりの形・本文は抜粋しか出ない。
   手元には本物の投稿が1件も無いので、星と図が描かれる形を見られるのはここだけ。
   PV_GLANCE_SHOT=<フォルダ> を渡すと、その形を1枚ずつ撮って置く（見本と見比べるため。検査の合否には使わない）。 */
async function runRated(browser, s, [w, h, kind]) {
  const tag = `${s} ${w}（評価が在る時）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'rated');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const rows = ratedRows(s), W = ratedWant(rows);
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    const sc = await ev(() => window.__pvg.score());
    {
      const bad = scoreBad(s, sc, live.filter(IS_SCORE), rows, 'locked');
      if (sc.card && sc.card.sum && sc.card.sum.text.includes(SUM_LEAK.slice(0, 8))) bad.push('サーバーが混ぜた要約の文が、鍵の無い人の画面に出ている');
      ok(!bad.length, `${tag}: 社名の行の星 ＝ カードの総合点（${W.avg.toFixed(1)}・${W.n}件）・6角形の図は点数どおり・書く入口は2行のボタン1つ・要約は「${SUM_LOCK_TEXT}」の1行だけ（サーバーが文を送ってきても出さない）`, bad.join(' ／ '));
    }
    {
      const r = sc.card && sc.card.revs, bad = [];
      if (!r) bad.push('口コミの欄が無い');
      else {
        if (r.state !== 'locked') bad.push(`鍵の無い人なのに、欄が ${r.state}`);
        if (r.items !== 2) bad.push(`見えている口コミが ${r.items}件（あるべき 2件）`);
        if (!(r.texts.length === r.items && r.texts.every(t => t.startsWith(CLIP.slice(0, 20))))) bad.push(`本文の所に、サーバーが渡した抜粋のほかの字が在る：${r.texts.map(t => t.slice(0, 24)).join(' ／ ')}`);
        if (r.full) bad.push(`伏せていない本文が ${r.full}つ出ている`);
        if (r.lock !== '口コミの投稿で開きます') bad.push(`錠前の1行が「${r.lock}」`);
      }
      ok(!bad.length, `${tag}: 口コミは新しい2件・本文は抜粋だけ・「口コミの投稿で開きます」`, bad.join(' ／ '));
    }
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（星の行が押し出さない）`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    const pr = await ev(() => window.__pvg.probe('#pvg-score'));
    ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 評価の字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている7つだけ`, [...seen.unknown].join(' '));
    if (process.env.PV_GLANCE_SHOT) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/rated-${s}-${w}.png`, clip: { x: 0, y: 0, width: w, height: w < 700 ? 2000 : 1500 } });
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
const RATED_W = [390, 768, 1440];

/* 「6つのタブと、情報を追加」：実際に押して歩く。
   タブごとに 出ているべき箱（on）と 隠れているべき箱（off）。そのページに無い箱（会社によって無いものが在る）は数えない。 */
const TAB_IDS = TABS.map(t => t[0]), TAB_NAME = Object.fromEntries(TABS);
const FACE = {
  overview: { on: ['.pvg-co', '.pvg-pay', '#pvg-realpay', '#pvg-score', '.pvg-rv-cta-overview', '.pvg-cell[data-cell="work"]', '.pvg-cell[data-cell="benefits"]', '.pvg-cell[data-cell="living"]', '.pvg-jobs', '#pvg-stay', '#pvg-stay > .pvg-phc', '.pvg-askc'], off: ['.pvg-rv-cta-reviews', '.pvg-rvl', '#pvg-p-work', '#pvg-p-benefits', '#pvg-p-living', '#pvg-city'] },
  pay: { on: ['.pvg-pay', '#pvg-p-benefits', '#pvg-realpay'], off: ['.pvg-cell[data-cell="work"]', '#pvg-score', '.pvg-co', '#pvg-stay', '.pvg-rvl', '#pvg-p-work', '#pvg-p-living', '.pvg-askc', '#pvg-city'] },
  reviews: { on: ['#pvg-score', '.pvg-rv-cta-reviews', '.pvg-rvl', '#airline-review-section'], off: ['.pvg-rv-cta-overview', '.pvg-pay', '#pvg-realpay', '.pvg-co', '#pvg-stay', '#pvg-p-work', '#pvg-city'] },
  work: { on: ['#pvg-p-work'], off: ['.pvg-pay', '#pvg-realpay', '#pvg-score', '#pvg-stay', '#pvg-p-benefits', '.pvg-rvl', '#pvg-city'] },
  life: { on: ['#pvg-p-living'], off: ['.pvg-pay', '#pvg-realpay', '#pvg-score', '#pvg-stay', '#pvg-p-work', '.pvg-rvl', '#pvg-city'] },
  stay: { on: ['#pvg-stay', '#pvg-stay > .pvg-phc'], off: ['.pvg-pay', '#pvg-realpay', '#pvg-score', '.pvg-co', '#pvg-p-living', '.pvg-rvl', '#pvg-city'] },
};
/* ページの中で動く（外の変数を1つも使わない）。 */
function tabSee(exp) {
  const q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)];
  const vis = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
  const box = e => { if (!vis(e)) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY }; };
  const root = q('.pvc-root'), bar = q('.pvg-tabbar');
  return {
    at: window.PVGlance ? window.PVGlance.at() : '',
    cls: (document.body.className.match(/pvg-at-[a-z]+/g) || []).join(' '),
    cur: all('[data-pvg-tab][aria-current="page"]').map(a => a.getAttribute('data-pvg-tab')),
    tabs: all('.pvg-tabs > a[data-pvg-tab]').map(a => [a.getAttribute('data-pvg-tab'), a.textContent.replace(/\s+/g, ' ').trim()]),
    hash: location.hash, search: location.search,
    /* 評価スコアのカードで、いま見えている「口コミを書く」入口（上の行／下の行 → 行き先）。比較表・古い節の見出しが残っていないか */
    write: all('#pvg-score a[href*="submit-review"]').filter(vis).map(a => { const k = a.querySelector('.pvg-gg-k'), m = a.querySelector('.pvg-gg-m'); return [k ? k.textContent.trim() : '', m ? m.textContent.trim() : a.textContent.trim(), a.getAttribute('href')]; }),
    h2: all('h2').filter(vis).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    hid: exp ? exp.on.filter(s => q(s) && !vis(q(s))) : [],
    out: exp ? exp.off.filter(s => vis(q(s))) : [],
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    /* いま画面に入っている古い節が、薄いまま（現れる動きの手前で）残っていないか。画面より下の節は、寄った時に現れる */
    faded: all('.glass.fade-up').filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.top < innerHeight - 40 && r.bottom > 40 && +getComputedStyle(e).opacity < 0.9; }).length,
    bar: box(bar), acts: all('.pvg-hero .pvg-acts .pvg-btn').map(e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), r: box(e) })),
    name: box(q('.pvg-hero h1')), add: box(q('.pvg-tabbar .pvg-add')),
    sheet: !root || root.hidden ? null : {
      title: (root.querySelector('.pvc-title') || {}).textContent || '',
      tiles: [...root.querySelectorAll('[data-pvc-tile]')].filter(vis).map(t => t.getAttribute('data-pvc-tile')),
      form: (root.querySelector('[data-pvc-form]') || { getAttribute: () => null }).getAttribute('data-pvc-form'),
      /* 会社を選ばせる欄（この面は、開いた会社のページの会社で始まる。選び直させない） */
      pick: !!root.querySelector('select[name="airline"], [data-pvc-airline], input[name="airline"]:not([type="hidden"])'),
    },
  };
}
async function runTabs(browser, s, [w, h]) {
  const tag = `${s} ${w}（タブと情報追加）`;
  const { ctx, p, ready, seen } = await open(browser, s, w, h, 'empty');
  const url = `${BASE}/airlines/${s}.html`;
  const see = exp => p.evaluate(tabSee, exp || null);
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  /* タブが替わり、古い節が現れ終わるまで待つ（時間では待たない）。 */
  const atTab = t => until(t => !!window.PVGlance && window.PVGlance.at() === t &&
    ![...document.querySelectorAll('.glass.fade-up')].some(e => { if (!e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.top < innerHeight - 40 && r.bottom > 40 && +getComputedStyle(e).opacity < 0.9; }), t);
  const sheetIs = what => until(what => {
    const r = document.querySelector('.pvc-root'), open = !!r && !r.hidden;
    if (what === 'closed') return !open;
    if (what === 'list') return open && r.querySelectorAll('[data-pvc-tile]').length >= 1;
    const f = open && r.querySelector('[data-pvc-form]');
    return !!f && f.getAttribute('data-pvc-form') === what;
  }, what);
  /* 押す相手が動き終わる（3コマ続けて同じ場所に居る）まで待ってから押す。 */
  const tap = async sel => {
    const still = await p.evaluate(sel => new Promise(res => {
      const t0 = performance.now(); let last = '', n = 0;
      const tick = () => {
        const e = document.querySelector(sel), r = e && e.getClientRects().length ? e.getBoundingClientRect() : null;
        const k = r ? [r.x, r.y, r.width, r.height].map(Math.round).join() : '';
        n = k && k === last ? n + 1 : 0; last = k;
        if (n >= 3) return res(true);
        if (performance.now() - t0 > 5000) return res(false);
        requestAnimationFrame(tick);
      };
      tick();
    }), sel);
    if (!still) return false;
    await press(await p.$(sel));
    return true;
  };
  const fresh = async addr => { await p.goto('about:blank'); await p.goto(addr, { waitUntil: 'load', timeout: 60000 }); await until(() => !!window.PVGlance); };
  try {
    ok(ready, `${tag}: 開ける`);
    /* ── 0) タブの帯と、その上の2つのボタン ── */
    {
      const r = await see(), bad = [];
      if (!same(r.tabs, TABS)) bad.push(`タブの並びが違う：${r.tabs.map(t => t[1]).join('・')}`);
      const [save, cmp] = r.acts;
      if (!(r.acts.length === 2 && save.r && cmp.r && save.t === 'カードを保存' && cmp.t === '他社と比較')) bad.push(`「カードを保存」「他社と比較」が見えていない（${r.acts.map(a => a.t).join('・')}）`);
      else if (!r.bar || !r.name) bad.push('タブの帯か社名が見えていない');
      else {
        if (!(Math.max(save.r.b, cmp.r.b) <= r.bar.y + 1)) bad.push('2つのボタンが、タブの帯より上に無い');
        if (!(Math.min(save.r.y, cmp.r.y) < r.name.b + 60 && Math.max(save.r.b, cmp.r.b) > r.name.y - 60)) bad.push('2つのボタンが、社名の近くに無い');
        if (w >= 700 ? !(near(save.r.y, cmp.r.y, 2) && save.r.x + save.r.w <= cmp.r.x + 1) : !(near(save.r.x, cmp.r.x, 2) && save.r.b <= cmp.r.y + 1)) bad.push(`2つのボタンが${w >= 700 ? '横' : '縦'}に並んでいない`);
        if (!(r.add && r.add.y >= r.bar.y - 1 && r.add.b <= r.bar.b + 1)) bad.push('「情報を追加」が、タブの帯の中に無い');
      }
      ok(!bad.length, `${tag}: タブは 概要・給与・待遇・口コミ・勤務・訓練・暮らし・家族・ステイ先 の順／社名のそば・タブより上に「カードを保存」「他社と比較」（${w >= 700 ? '横' : '縦'}並び）`, bad.join(' ／ '));
    }
    /* ── 1) 6つのタブを順に押す ── */
    for (const t of TAB_IDS) {
      const moved = t === 'overview' ? true : (await tap(`.pvg-tabs [data-pvg-tab="${t}"]`)) && (await atTab(t));
      const r = await see(FACE[t]);
      ok(moved && r.at === t && r.cls === `pvg-at-${t}` && r.cur.join() === t && r.hash === (t === 'overview' ? '' : `#${t}`) && !r.hid.length && !r.out.length && r.over <= 0 && !r.faded,
        `${tag}:「${TAB_NAME[t]}」を押す → その中身だけが出る・選んだ印は1つ・住所に残る・横にあふれない`,
        JSON.stringify({ at: r.at, 印: r.cur, 住所: r.hash, 出ていない: r.hid, 出ている: r.out, 横あふれ: r.over, 薄いまま: r.faded }));
      /* 口コミを書く入口は、概要と口コミのタブで下の行が違う（どちらも2行・同じ行き先）。ほかのタブには出ない。 */
      if (RV_GIVE[t]) ok(same(r.write, [[GG, RV_GIVE[t], `../submit-review.html?airline=${s}`]]), `${tag}:「${TAB_NAME[t]}」の口コミを書く入口は「${GG}／${RV_GIVE[t]}」1つ ── 自分の会社を選んだ投稿の画面へ`, r.write.map(x => x.join(' ')).join(' ‖ '));
      else ok(!r.write.length, `${tag}:「${TAB_NAME[t]}」には、評価スコアのカードの入口が出ていない`, r.write.map(x => x.join(' ')).join(' ‖ '));
      /* 会社どうしの比較表・「◯◯について」の節は、どのタブにも出ない（比較は「他社と比較」の先・紹介は会社のカードの中）。 */
      { const dup = r.h2.filter(x => NO_H2.test(x) || /について$/.test(x)); ok(!dup.length, `${tag}:「${TAB_NAME[t]}」に、比較表と「◯◯について」の節が出ていない`, dup.join(' ／ ')); }
    }
    /* ── 2) 戻る・進む・読み直し ── */
    {
      const walk = [];
      await p.goBack(); walk.push(['戻る', 'life', await atTab('life'), (await see()).hash]);
      await p.goBack(); walk.push(['戻る', 'work', await atTab('work'), (await see()).hash]);
      await p.goForward(); walk.push(['進む', 'life', await atTab('life'), (await see()).hash]);
      const bad = walk.filter(([, t, hit, hash]) => !(hit && hash === `#${t}`)).map(([how, t, , hash]) => `${how} →「${TAB_NAME[t]}」にならない（住所 ${hash}）`);
      await p.reload({ waitUntil: 'load', timeout: 60000 });
      const again = await atTab('life'), r = await see(FACE.life);
      if (!(again && !r.hid.length && !r.out.length && r.cur.join() === 'life')) bad.push(`読み直すと「暮らし・家族」でなくなる（${r.at}）`);
      await p.goBack();
      if (!(await atTab('work'))) bad.push(`読み直したあとの「戻る」が「勤務・訓練」にならない（${(await see()).at}）`);
      ok(!bad.length, `${tag}: 戻る・進む・読み直しで、選んだタブが分かる`, bad.join(' ／ '));
    }
    /* ── 3) 住所で直接開く ── */
    {
      await fresh(`${url}#reviews`);
      const hit = await atTab('reviews'), r = await see(FACE.reviews);
      ok(hit && !r.hid.length && !r.out.length, `${tag}: 住所（#reviews）で直接開く →「口コミ」`, JSON.stringify({ at: r.at, 出ていない: r.hid, 出ている: r.out }));
      await fresh(`${url}#pvg-stay`);
      const hit2 = await atTab('overview'), r2 = await see({ on: ['#pvg-stay', '.pvg-co'], off: [] });
      ok(hit2 && !r2.hid.length, `${tag}: 古い住所（#pvg-stay）は、概要のまま開く（中身が消えない）`, JSON.stringify({ at: r2.at, 出ていない: r2.hid }));
    }
    /* ── 3a) 板を開いたまま、ページの中のリンクで離れて「戻る」── 同じ板が開いたまま、押したリンクが同じ高さに在る。
       ページの中のリンク（出所・ホテル・レストラン）はタブの切り替えを通らずに履歴を1段積む。離れる前の段に
       位置と板を書き留めていなかった頃は、戻ると板が閉じて、板の高さの分（PC 約560px・スマホ 約950px）だけ別の所が出た。
       ⚠️ 「押した瞬間」の高さはページの中で控える（押す前に読むと、押す道具が寄せ直した分だけずれる）。
       ⚠️ 戻ったあとは「板が開いていて、リンクが元の高さに在る」まで待って読む（ブラウザが自分で位置を置き直すのは、戻った少しあと）。 */
    {
      const bad = [], PANEL = 'pvg-p-work', BTN = `.pvg-more[aria-controls="${PANEL}"]`;
      const vis = sel => p.evaluate(sel => { const a = document.querySelector(sel); return !!a && a.getClientRects().length > 0; }, sel);
      const read = sel => p.evaluate(sel => {
        const a = document.querySelector(sel), b = [...document.querySelectorAll('.pvg-more[aria-controls]')].find(x => x.getAttribute('aria-expanded') === 'true');
        return { open: b ? b.getAttribute('aria-controls') : '', top: a && a.getClientRects().length ? Math.round(a.getBoundingClientRect().top) : null, at: window.PVGlance.at() };
      }, sel);
      /* 押した瞬間の板と高さを控える（1回だけ） */
      const arm = sel => p.evaluate(sel => {
        const a = document.querySelector(sel);
        window.__pvWas = null;
        a.addEventListener('click', () => {
          const b = [...document.querySelectorAll('.pvg-more[aria-controls]')].find(x => x.getAttribute('aria-expanded') === 'true');
          window.__pvWas = { open: b ? b.getAttribute('aria-controls') : '', top: Math.round(a.getBoundingClientRect().top) };
        }, { capture: true, once: true });
      }, sel);
      const was = () => p.evaluate(() => window.__pvWas);
      const asBefore = (sel, want) => until((sel, want) => {
        const a = document.querySelector(sel), b = [...document.querySelectorAll('.pvg-more[aria-controls]')].find(x => x.getAttribute('aria-expanded') === 'true');
        return !!a && (b ? b.getAttribute('aria-controls') : '') === want.open && Math.abs(Math.round(a.getBoundingClientRect().top) - want.top) <= 2;
      }, sel, want);
      const openPanel = async () => {
        await fresh(url);
        return (await atTab('overview')) && (await tap(BTN)) && (await until(id => !document.getElementById(id).hidden, PANEL));
      };
      /* a) 別のタブに在る節へのリンク（出所 → 給与・待遇）。このリンクが概要に在る会社だけ */
      const SRC = '[data-pvg-pane~="overview"] a[href="#kyuyo-konkyo"]';
      if (!(await openPanel())) bad.push('勤務の板が開かない');
      else if (await vis(SRC)) {
        await arm(SRC);
        if (!((await tap(SRC)) && (await atTab('pay')))) bad.push('出所のリンクで「給与・待遇」にならない');
        const a = await was();
        if (!(a && a.open === PANEL)) bad.push(`出所を押した時に、勤務の板が開いていない（${JSON.stringify(a)}）`);
        else {
          await p.goBack();
          if (!((await atTab('overview')) && (await asBefore(SRC, a)))) { const b = await read(SRC); bad.push(`出所から戻ると、板か位置が変わる（板 ${a.open} → ${b.open || '閉じている'}・リンクの高さ ${a.top} → ${b.top}）`); }
          await p.goForward();
          if (!(await atTab('pay'))) bad.push('出所から戻って「進む」が「給与・待遇」にならない');
          await p.goBack();
          if (!((await atTab('overview')) && (await asBefore(SRC, a)))) { const b = await read(SRC); bad.push(`もう一度戻ると、板か位置が変わる（板 ${b.open || '閉じている'}・リンクの高さ ${a.top} → ${b.top}）`); }
        }
      }
      /* b) 同じタブの中の節へのリンク（ホテル・レストラン → 就航地の節）。離れた先で板を閉じてから戻る */
      const HOT = '.pvg a.pvg-topic-a[href="#pvg-stay"]';
      if (!(await openPanel())) bad.push('勤務の板が開かない（2回目）');
      else if (!(await vis(HOT))) bad.push('「ホテル・レストラン」のリンクが概要に見えない');
      else {
        await arm(HOT);
        if (!((await tap(HOT)) && (await until(() => location.hash === '#pvg-stay')))) bad.push('「ホテル・レストラン」で就航地の節へ行かない');
        const a = await was();
        if ((await read(HOT)).at !== 'overview') bad.push('「ホテル・レストラン」でタブが替わる');
        if (!(a && a.open === PANEL)) bad.push(`「ホテル・レストラン」を押した時に、勤務の板が開いていない（${JSON.stringify(a)}）`);
        /* × で閉じる（＝ ページが板の分だけ短くなる。押す道具が × を画面のまんなかへ寄せる） */
        else if (!((await tap(`#${PANEL} .pvg-x`)) && (await until(id => document.getElementById(id).hidden, PANEL)))) bad.push('板が × で閉じない');
        else {
          await p.goBack();
          if (!((await until(() => location.hash !== '#pvg-stay')) && (await asBefore(HOT, a)))) { const b = await read(HOT); bad.push(`「ホテル・レストラン」から戻ると、板か位置が変わる（板 ${a.open} → ${b.open || '閉じている'}・リンクの高さ ${a.top} → ${b.top}）`); }
        }
      }
      ok(!bad.length, `${tag}: 板を開いたままページの中のリンクで離れて「戻る」→ 同じ板・同じ位置`, bad.join(' ／ '));
    }
    /* ── 3b) ステイ先：都市を選ぶ → 詳細（ホテルの欄は鍵）→ 戻る。住所で直接開く。一覧に無い3字は一覧のまま ── */
    {
      const net = networkOf(s), bad = [];
      const pick = net.list.find(d => placePhoto(d.iata)) || net.list[0], bare = net.list.find(d => !placePhoto(d.iata));
      /* いまの面（一覧か詳細か）と、詳細に出ている字。ホテルの欄が落ち着くまで待つ（時間では待たない）。 */
      const cityIs = code => until(code => {
        const vis = e => !!e && e.getClientRects().length > 0;
        const list = document.getElementById('pvg-stay'), box = document.getElementById('pvg-city');
        if (!code) return vis(list) && !vis(box);
        const slot = box.querySelector('.crl[data-live="hotels"]');
        return !vis(list) && vis(box) && slot.getAttribute('data-stay') === code && !/^(idle|loading)$/.test(slot.dataset.state);
      }, code);
      const cityRead = () => p.evaluate(() => {
        const box = document.getElementById('pvg-city'), t = k => { const e = box.querySelector(`[data-cd="${k}"]`); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
        const slot = box.querySelector('.crl[data-live="hotels"]'), img = box.querySelector('[data-cd="ph"] > img'), maps = box.querySelector('[data-cd="maps"]');
        const r = box.getBoundingClientRect();
        return {
          name: t('name'), en: t('en'), country: t('country'), iata: t('iata'), tag: !box.querySelector('[data-cd="seasonal"]').hidden,
          img: img ? img.getAttribute('src') : null, alt: img ? img.alt : '', none: box.querySelector('[data-cd="ph"]').classList.contains('is-none'),
          credit: box.querySelector('[data-cd="credit"]').hidden ? '' : t('credit'), maps: maps ? maps.getAttribute('href') : '',
          state: slot.dataset.state, slot: slot.textContent.replace(/\s+/g, ' ').trim(), parts: slot.querySelectorAll('img, a[href], form, input, button').length,
          hash: location.hash, at: window.PVGlance.at(), top: Math.round(r.top), over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const LOCK = '確認済みのパイロットだけが見られます';
      await fresh(`${url}#stay`);
      if (!(await atTab('stay')) || !(await cityIs(''))) bad.push('ステイ先のタブが一覧で開かない');
      const asked0 = (await see()).hash;
      if (!((await tap(`#pvg-st-list .pvg-city[data-city="${pick.iata}"]`)) && (await cityIs(pick.iata)))) bad.push(`${pick.iata} を押しても詳細にならない`);
      let c = await cityRead();
      {
        const ph = placePhoto(pick.iata);
        if (!(c.hash === `#stay-${pick.iata}` && c.at === 'stay' && asked0 === '#stay')) bad.push(`住所が #stay-${pick.iata} にならない（${c.hash}）`);
        if (!(c.name === pick.city && c.en === pick.en && c.country === pick.country && c.iata === pick.iata && c.tag === pick.seasonal)) bad.push(`詳細の字が台帳と違う（${c.name}・${c.en}・${c.country}・${c.iata}）`);
        if (ph ? !(c.img === `../${placeSrc(ph, true)}` && c.alt === ph.subject && !c.none) : !(c.none && !c.img)) bad.push(`詳細の写真が台帳と違う（${c.img}）`);
        if (ph && placeCredit(ph) ? !(c.credit.startsWith('写真：') && c.credit.includes(ph.author) && c.credit.includes(ph.licence)) : c.credit !== '') bad.push(`詳細の写真のクレジットが違う（${c.credit}）`);
        if (c.maps !== `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pick.en} ${pick.iata} airport`)}`) bad.push(`Google Maps の行き先が違う（${c.maps}）`);
        /* 鍵の無い人：ホテルの欄は1行だけ。名前も写真も入力欄も出ない。 */
        if (!(c.state === 'locked' && c.slot.includes(LOCK) && c.parts === 0)) bad.push(`ホテルの欄が鍵の1行になっていない（${c.state}・${c.slot.slice(0, 40)}・部品 ${c.parts}）`);
        if (c.over > 0) bad.push(`詳細が横にあふれる（${c.over}px）`);
        if (!(c.top >= 0 && c.top < h)) bad.push(`詳細の頭が画面に入っていない（上から ${c.top}px）`);
      }
      /* 「‹ 就航地」→ 一覧へ。進む → 同じ都市。戻る → 一覧。 */
      if (!((await tap('#pvg-city [data-pvg-cityback]')) && (await cityIs('')))) bad.push('「就航地」へ戻るボタンで一覧に戻らない');
      { const r = await see(FACE.stay); if (!(r.hash === '#stay' && r.at === 'stay' && !r.hid.length && !r.out.length)) bad.push(`戻った先が一覧でない（${r.hash}・出ている ${r.out.join(' ')}）`); }
      await p.goForward();
      if (!(await cityIs(pick.iata))) bad.push('「進む」で同じ都市の詳細にならない');
      await p.goBack();
      if (!(await cityIs(''))) bad.push('「戻る」で一覧にならない');
      /* 探す欄：かっこ付きの名前をそのまま（全角）でも半角でも・3字は大文字でも小文字でも・欧文は飾り無しの綴りでも当たる。
         字を消せば全部に戻る（カードを隠すだけ ＝ 並びは変えない）。 */
      {
        const seek = q => p.evaluate(q => {
          const i = document.getElementById('pvg-st-q');
          i.value = q; i.dispatchEvent(new Event('input', { bubbles: true }));
          const on = [...document.querySelectorAll('#pvg-st-list > li')].filter(li => !li.hidden).map(li => li.querySelector('.pvg-city').getAttribute('data-city'));
          return { on, n: document.querySelector('#pvg-stay [data-pvg-stn]').textContent, none: !document.querySelector('#pvg-stay .pvg-st-none').hidden };
        }, q);
        /* ⚠️ 「全部」は画面の並びで持つ。台帳の並び（地域ごと）と画面の並び（地域ごと・写真の在る都市が先）は別物で、
              台帳の並びと比べていた版は、正しい画面で必ず赤くなった（別の目の読み直しで見つかった。流す前だった）。
              中身（どの空港が出ているか）だけを台帳と突き合わせる。 */
        const first = await seek('');
        const all = first.on;
        if (!same([...all].sort(), net.list.map(d => d.iata).sort())) bad.push('何も打っていないのに、台帳の空港が全部は出ていない');
        const br = net.list.find(d => /（.+）/.test(d.city)), ac = net.list.find(d => /[^\x00-\x7f]/.test(d.en));
        const pn = net.list.find(d => /[.,'\-]/.test(d.en));
        if (pn) {
          const bare = pn.en.replace(/[.,'\-]/g, '').toLowerCase();
          const a = await seek(bare), b = await seek(pn.en);
          if (!(a.on.includes(pn.iata) && same(a.on, b.on) && a.on.length < all.length)) bad.push(`記号を打たない "${bare}" で当たらない・"${pn.en}" と違う（${a.on.join(' ')}／${b.on.join(' ')}）`);
        }
        if (br) {
          const a = await seek(br.city), b = await seek(br.city.replace('（', '(').replace('）', ')'));
          if (!(a.on.includes(br.iata) && a.on.length < all.length && a.n === String(a.on.length) && !a.none)) bad.push(`「${br.city}」と打っても当たらない（${a.on.length}枚）`);
          if (!same(a.on, b.on)) bad.push(`半角のかっこで打つと、当たるカードが変わる（${a.on.join(' ')} → ${b.on.join(' ')}）`);
        }
        if (ac) {
          const plain = ac.en.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const a = await seek(plain), b = await seek(ac.en);
          if (!(a.on.includes(ac.iata) && same(a.on, b.on))) bad.push(`"${plain}" と "${ac.en}" で当たるカードが違う・当たらない（${a.on.join(' ')}／${b.on.join(' ')}）`);
        }
        const up = await seek(pick.iata), lo = await seek(pick.iata.toLowerCase());
        if (!(up.on.includes(pick.iata) && same(up.on, lo.on))) bad.push(`3字（${pick.iata}）で当たらない・大文字と小文字で違う`);
        const zz = await seek('zzzz');
        if (!(zz.on.length === 0 && zz.none && zz.n === '0')) bad.push('どれにも当たらない字で、「見つかりません」が出ない');
        const back = await seek('');
        if (!(same(back.on, all) && back.n === String(all.length) && !back.none)) bad.push('字を消しても、全部のカードに戻らない（並びが変わる）');
      }
      /* 鍵の無い人が都市を行き来しても、同じ都市を取りに行くのは1回だけ（「見られない」の答えは持っておく）。
         ほかの都市の答えで捨ててよいのは、開いていた答えだけ ── 全部捨てていた頃は、戻るたびに待ちの絵が出て問い合わせが増えた。 */
      {
        const other = net.list.find(d => d.iata !== pick.iata);
        const hop = async code => (await tap(`#pvg-st-list .pvg-city[data-city="${code}"]`)) && (await cityIs(code)) && (await tap('#pvg-city [data-pvg-cityback]')) && (await cityIs(''));
        const a0 = seen.stays;
        const walked = (await hop(other.iata)) && (await hop(pick.iata)) && (await hop(other.iata));
        if (!walked) bad.push(`都市の行き来（${pick.iata} ⇄ ${other.iata}）ができない`);
        else if (seen.stays - a0 !== 1) bad.push(`鍵の無い人が見た都市へ戻ると、同じ都市をまた取りに行く（${other.iata} の1回のはずが ${seen.stays - a0}回）`);
      }
      /* 写真の無い空港：3字の札で出る（写真を作らない）。 */
      if (bare) {
        await fresh(`${url}#stay-${bare.iata}`);
        const hit = (await atTab('stay')) && (await cityIs(bare.iata));
        c = hit ? await cityRead() : c;
        if (!(hit && c.name === bare.city && c.iata === bare.iata && c.none && !c.img && c.credit === '' && c.state === 'locked')) bad.push(`住所（#stay-${bare.iata}）で直接開けない・写真の無い空港の出し方が違う`);
        if (hit && !((await tap('#pvg-city [data-pvg-cityback]')) && (await cityIs('')) && (await see()).hash === '#stay')) bad.push('直接開いた詳細から、一覧へ戻れない');
      } else {
        await fresh(`${url}#stay-${pick.iata}`);
        if (!((await atTab('stay')) && (await cityIs(pick.iata)))) bad.push(`住所（#stay-${pick.iata}）で直接開けない`);
      }
      /* 一覧に無い3字（その会社が飛んでいない空港）は、詳細を作らない。 */
      const ghost = ['ZZZ', 'QQQ'].find(k => !net.list.some(d => d.iata === k));
      await fresh(`${url}#stay-${ghost}`);
      if (!((await atTab('stay')) && (await cityIs('')))) bad.push(`一覧に無い3字（#stay-${ghost}）で、空の詳細が開く`);
      ok(!bad.length, `${tag}: ステイ先 ── 都市を押す → 詳細（字・写真・クレジット・Google Maps が台帳のまま／ホテルの欄は鍵の1行）→ 戻る・進む／住所で直接開く／一覧に無い3字は一覧のまま`, bad.join(' ／ '));
    }
    /* ── 3c) ホテルの欄が開いた時（運営）。本物の運営では入れないので、サーバーの返事だけを差し替えて画面を見る。
          ・公開のボタンは「いま見えている中身」の印（rev）を持ち、押すとそれを送る。却下は印を送らない。
            （送らないと、本人が直したことのある場所は、何度押しても公開に戻せない ── db/stays.sql が印なしを通さない）
          ・見ているあいだに本人が直していたら、その旨を言って読み直す（古い中身のまま公開しない）。
          ・ログインの鍵がこの端末から消えたら、開いていた時のホテル名を画面に残さない
            （都市を選び直した時と、ほかの画面から戻ってきた時の両方）。
          ⚠️ 出すホテルは架空（検査の中だけ・どこにも保存しない）。 ── */
    {
      const net = networkOf(s), bad = [];
      const [c1, c2] = net.list;
      const KEY = 'sb-check-auth-token', REV = 'a1b2c3d4e5f60718', NAME = '検査用の架空のホテル', PID = '00000000-0000-4000-8000-0000000000a1';
      const OPEN = JSON.stringify({ ok: true, state: 'open', can_add: true, is_operator: true, others: [],
        places: [{ id: PID, kind: 'hotel', name: NAME, address: '架空の住所 1-2-3', state: 'pending', mine: false, rev: REV, photos: [] }] });
      const LOCKED = '{"ok":true,"state":"locked"}';
      const SLOT = '#pvg-city .crl[data-live="hotels"]';
      const slotIs = (code, state) => until((sel, code, state) => {
        const e = document.querySelector(sel);
        return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code && e.dataset.state === state;
      }, SLOT, code, state);
      const slotRead = () => p.evaluate(sel => {
        const e = document.querySelector(sel), pub = e.querySelector('[data-act="pub"]'), say = e.querySelector('.crs-say');
        return { state: e.dataset.state, text: e.textContent.replace(/\s+/g, ' ').trim(), pub: !!pub, rev: pub ? pub.getAttribute('data-rev') : null,
          rej: !!e.querySelector('[data-act="rej"]'), say: say ? say.textContent.trim() : '', parts: e.querySelectorAll('img, a[href], form, input, button').length };
      }, SLOT);
      const listIs = () => until(() => { const v = e => !!e && e.getClientRects().length > 0; return v(document.getElementById('pvg-stay')) && !v(document.getElementById('pvg-city')); });
      /* 鍵は、ページが開いたあとに置く（登録だけの会員に出す板を呼ばない）。中身は読まれない ── 在るかどうかだけが見られる。 */
      const key = on => p.evaluate((k, on) => { if (on) localStorage.setItem(k, '{}'); else localStorage.removeItem(k); }, KEY, on);
      await fresh(`${url}#stay`);
      if (!((await atTab('stay')) && (await listIs()))) bad.push('ステイ先のタブが一覧で開かない');
      seen.stay = OPEN; seen.mod = []; seen.modReply = '{"ok":false,"status":"changed"}';
      await key(true);
      try {
        /* 開いた欄：名前と、公開・却下のボタン。公開のボタンは印を持っている。 */
        if (!((await tap(`#pvg-st-list .pvg-city[data-city="${c1.iata}"]`)) && (await slotIs(c1.iata, 'open')))) bad.push(`${c1.iata} のホテルの欄が開かない`);
        let r = await slotRead();
        if (!(r.text.includes(NAME) && r.pub && r.rej && r.rev === REV)) bad.push(`開いた欄に、名前・公開・却下・印がそろわない（公開 ${r.pub}・却下 ${r.rej}・印 ${r.rev}）`);
        /* 公開を押す → 印を添えて送る。返事が「直されていた」なら、そう言って読み直す。 */
        const asked0 = seen.stayAsked;
        if (r.pub) await tap(`${SLOT} [data-act="pub"]`);
        const told = await until(sel => /出した人が内容を直していました/.test((document.querySelector(sel + ' .crs-say') || {}).textContent || ''), SLOT);
        const m0 = (seen.mod[0] || {}).p || {};
        if (!(seen.mod.length === 1 && m0.target === 'place' && m0.id === PID && m0.state === 'public' && m0.rev === REV)) bad.push(`公開が、見えている中身の印を送らない（${JSON.stringify(seen.mod[0])}）`);
        if (!(told && seen.stayAsked > asked0)) bad.push(`直されていた時に、そう言って読み直さない（読み直し ${seen.stayAsked - asked0}回）`);
        /* 却下は、中身に関係なく通る ＝ 印を送らない。 */
        seen.modReply = '{"ok":true}';
        if (await slotIs(c1.iata, 'open')) await tap(`${SLOT} [data-act="rej"]`);
        await until(sel => /\S/.test((document.querySelector(sel + ' .crs-say') || {}).textContent || '') && !/出した人が内容を直していました/.test(document.querySelector(sel + ' .crs-say').textContent), SLOT);
        const m1 = (seen.mod[1] || {}).p || {};
        if (!(seen.mod.length === 2 && m1.target === 'place' && m1.id === PID && m1.state === 'rejected' && !('rev' in m1))) bad.push(`却下の送り方が違う（${JSON.stringify(seen.mod[1])}）`);
        /* 鍵が消えた → 一覧へ戻って同じ都市を選び直す。持っていた答えを使い回さず、鍵の1行になる。 */
        await key(false); seen.stay = LOCKED;
        if (!((await tap('#pvg-city [data-pvg-cityback]')) && (await listIs()))) bad.push('一覧へ戻れない');
        if (!((await tap(`#pvg-st-list .pvg-city[data-city="${c1.iata}"]`)) && (await slotIs(c1.iata, 'locked')))) bad.push('鍵が消えたあと、同じ都市を選び直すと、開いていた時の中身がそのまま出る');
        r = await slotRead();
        if (r.text.includes(NAME) || r.parts) bad.push(`鍵が消えたあとの欄に、ホテル名か部品が残る（部品 ${r.parts}）`);
        /* 開いたまま、ほかの画面から戻ってきた時にも残さない（別の都市で開き直してから確かめる）。 */
        if (c2) {
          await key(true); seen.stay = OPEN;
          if (!((await tap('#pvg-city [data-pvg-cityback]')) && (await listIs()) && (await tap(`#pvg-st-list .pvg-city[data-city="${c2.iata}"]`)) && (await slotIs(c2.iata, 'open')))) bad.push(`${c2.iata} のホテルの欄が開かない`);
          await key(false); seen.stay = LOCKED;
          await p.evaluate(() => {
            /* 検査のブラウザは、並んで走るほかのページに前面を取られていることがある。「見えている」に固定してから知らせる。 */
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
            document.dispatchEvent(new Event('visibilitychange'));
          });
          if (!(await slotIs(c2.iata, 'locked'))) bad.push('開いたまま鍵が消えて画面へ戻ってきた時に、開いていた時の中身が残る');
          r = await slotRead();
          if (r.text.includes(NAME) || r.parts) bad.push(`戻ってきた時の欄に、ホテル名か部品が残る（部品 ${r.parts}）`);
        }
      } finally {
        await key(false); seen.stay = null;
      }
      ok(!bad.length, `${tag}: ホテルの欄が開いた時（運営）── 公開は見えている中身の印を送る・却下は送らない／直されていたら読み直す／鍵が消えたら、開いていた時の中身を残さない`, bad.join(' ／ '));
    }
    /* ── 4) 「情報を追加」→ 話題の一覧 → 月の勤務。会社を選び直させない。戻るで閉じる ── */
    {
      await fresh(url);
      await atTab('overview');
      const url0 = p.url(), bad = [];
      if (!((await tap('.pvg-tabbar .pvg-add')) && (await sheetIs('list')))) bad.push('話題の一覧が開かない');
      let r = await see();
      if (r.sheet && !(r.sheet.tiles.length >= 5 && !r.sheet.pick)) bad.push(`一覧の話題が ${r.sheet.tiles.length}つ・会社を選ぶ欄 ${r.sheet.pick ? '在り' : '無し'}`);
      if (!((await tap('.pvc-root [data-pvc-tile="work"]')) && (await sheetIs('work')))) bad.push('一覧から「月の勤務」へ進めない');
      r = await see();
      if (r.sheet && r.sheet.pick) bad.push('月の勤務の入力で、会社を選び直させている');
      await p.goBack();
      const shut = await sheetIs('closed');
      r = await see();
      if (!(shut && p.url() === url0 && r.at === 'overview')) bad.push(`戻るで閉じない・住所かタブが変わる（${p.url().slice(BASE.length)}・${r.at}）`);
      ok(!bad.length, `${tag}:「情報を追加」→ 話題の一覧 → 月の勤務（会社を選び直さない）→ 戻るで閉じて元の場所`, bad.join(' ／ '));
    }
    /* ── 5) タブの中の入口から、その話題へ直接 ── */
    {
      const bad = [];
      if (!((await tap('.pvg-tabs [data-pvg-tab="work"]')) && (await atTab('work')))) bad.push('「勤務・訓練」へ移れない');
      if (!((await tap('#pvg-p-work [data-pvc-open="work"]')) && (await sheetIs('work')))) bad.push('「勤務・訓練」の入口から、月の勤務の入力が開かない');
      if (!((await tap('.pvc-root .pvc-close')) && (await sheetIs('closed')))) bad.push('× で閉じない');
      let r = await see();
      if (r.at !== 'work') bad.push(`閉じたあと「勤務・訓練」に居ない（${r.at}）`);
      if (!((await tap('.pvg-tabs [data-pvg-tab="life"]')) && (await atTab('life')))) bad.push('「暮らし・家族」へ移れない');
      if (!((await tap('#pvg-p-living [data-pvc-open="taxi"]')) && (await sheetIs('taxi')))) bad.push('「暮らし・家族」の入口から、通勤・タクシーの入力が開かない');
      r = await see();
      if (r.sheet && r.sheet.pick) bad.push('通勤・タクシーの入力で、会社を選び直させている');
      await p.goBack();
      const shut = await sheetIs('closed');
      r = await see();
      if (!(shut && r.at === 'life')) bad.push(`戻るで閉じたあと「暮らし・家族」に居ない（${r.at}）`);
      ok(!bad.length, `${tag}: タブの中の入口 → 月の勤務／通勤・タクシーの入力へ直接・閉じても同じタブに居る`, bad.join(' ／ '));
    }
    /* ── 6) 住所の印（?add=）で直接開く ── */
    {
      await fresh(`${url}?add=work#work`);
      const hit = await sheetIs('work'), r = await see();
      ok(hit && r.at === 'work' && !/add=/.test(p.url()), `${tag}: 住所の印（?add=work）で、月の勤務の入力が開く・印は住所から消える`, JSON.stringify({ 面: r.sheet && r.sheet.form, at: r.at, 住所: p.url().slice(BASE.length) }));
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
const TABS_W = [390, 768, 1440];
/* 読めない時を測る幅。320 ＝ 社名の下の知らせが、右の2つのボタンといちばん近づく幅。 */
const OFF_W = [320, 390, 1440];

/* 「都市のカード」：狭いカードで、国名・行き先の字・街の名前が語の途中で折れない。3レターはカードの中に在る。
   カードの字の箱がいちばん狭いのは 320（2列・88px）と、3列に替わった直後（画面 608〜647・141〜155px）。
   「オーストラリア」「サウジアラビア」は5社のどこかに必ず在り、3レターと同じ行に置くと 〜414 の画面で折れていた。
   ページの中で動く（外の変数を1つも使わない）。 */
function cardSee() {
  const vis = e => !!e && e.getClientRects().length > 0;
  /* 1字ずつの場所（幅・行）。sp ＝ その字の前に空白が在った */
  const chars = el => {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange(), out = [];
    let top = null, line = 0, sp = false;
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const s = t.nodeValue;
      for (let i = 0; i < s.length; i++) {
        if (!s[i].trim()) { sp = true; continue; }
        rg.setStart(t, i); rg.setEnd(t, i + 1);
        const r = rg.getClientRects()[0];
        if (!r || !r.width) continue;
        if (top !== null && Math.abs(r.top - top) > r.height / 2) line++;
        top = r.top;
        /* wb ＝ この字の前に <wbr> が在る（生成側が「ここで折ってよい」と渡した所） */
        const pv = i === 0 ? t.previousSibling : null;
        out.push({ c: s[i], w: r.width, right: r.right, line, sp, wb: !!pv && pv.nodeName === 'WBR' }); sp = false;
      }
    }
    return out;
  };
  /* 折れてよい所：「・」「／」などのあと、開き括弧の前、空白、<wbr> */
  const may = (a, b) => b.sp || b.wb || /[・／/\-–)）、，,]/.test(a.c) || /[（(]/.test(b.c);
  /* 語の途中で折れている所（語 ＝ 折れてよい所で区切ったひとかたまり）。
     room が在れば、そのかたまりが1行に入るのに折れているものだけを数える（入らない長い名前は、入る所で折れてよい） */
  const midBreaks = (cs, room) => {
    const R = [];
    for (let i = 1; i < cs.length; i++) {
      if (cs[i].line === cs[i - 1].line || may(cs[i - 1], cs[i])) continue;
      let a = i - 1, b = i;
      while (a > 0 && !may(cs[a - 1], cs[a])) a--;
      while (b < cs.length - 1 && !may(cs[b], cs[b + 1])) b++;
      const word = cs.slice(a, b + 1), wide = word.reduce((n, x) => n + x.w, 0);
      /* 入るかどうかは、箱の幅より 0.5px 内側で決める（ちょうど同じ幅の語は、ブラウザの端数しだいで折れる ＝ それは「入らない」） */
      if (room === null || wide <= room - 0.5) R.push(`${cs[i - 1].c}｜${cs[i].c}`);
    }
    return R;
  };
  /* 最後の行に1字だけ（「クライストチャー｜チ」「…レッドシー｜）」）。2行に分かれた名前で、落ちた1字がいちばん読みにくい */
  const orphan = cs => {
    if (!cs.length) return '';
    const last = cs[cs.length - 1].line, tail = cs.filter(x => x.line === last);
    return last > 0 && tail.length === 1 ? `${cs[cs.length - 2].c}｜${tail[0].c}` : '';
  };
  const R = [], cards = [...document.querySelectorAll('.pvg-cgrid .pvg-city')].filter(vis);
  for (const a of cards) {
    const code = a.getAttribute('data-city'), card = a.getBoundingClientRect(), say = e => `${code}「${e.textContent.replace(/\s+/g, ' ').trim()}」`;
    const k = a.querySelector('.pvg-city-k'), small = k.querySelector('small'), chip = k.querySelector('.pvg-code3');
    const ph = a.querySelector('.pvg-town-ph'), none = ph.classList.contains('is-none'), pr = ph.getBoundingClientRect();
    const body = a.querySelector('.pvg-town-b'), bs = getComputedStyle(body);
    /* 字の入る幅（小数のまま。clientWidth は整数に丸めるので、ちょうど入る・入らないの境目で嘘を言う） */
    const room = body.getBoundingClientRect().width - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight) - parseFloat(bs.borderLeftWidth) - parseFloat(bs.borderRightWidth);
    /* 国名：1行・カードの中 */
    const L = chars(small), right = L.reduce((n, x) => Math.max(n, x.right), -Infinity);
    if (!L.length) R.push(`国名が見えない ${code}`);
    else if (L[L.length - 1].line !== 0) R.push(`国名が ${L[L.length - 1].line + 1}行 ${say(small)}`);
    if (right > card.right + 0.5) R.push(`国名がカードの外 ${say(small)}`);
    /* 3レター：カードの中。写真の上か、国名の行。見せなくてよいのは、写真の所に同じ3字が大きく出ているカードだけ */
    const c = chip.getBoundingClientRect(), shown = c.width > 2 && c.height > 2;
    if (chip.textContent.trim() !== code) R.push(`3レターの字が違う ${code}（${chip.textContent.trim()}）`);
    if (!shown) {
      const big = ph.querySelector('b');
      if (!(none && vis(big) && big.textContent.trim() === code)) R.push(`3レターがどこにも見えない ${code}`);
    } else {
      const inside = (x, o) => x.left >= o.left - 0.5 && x.right <= o.right + 0.5 && x.top >= o.top - 0.5 && x.bottom <= o.bottom + 0.5;
      const kr = k.getBoundingClientRect(), onPhoto = inside(c, pr), inRow = c.top >= kr.top - 1 && c.bottom <= kr.bottom + 1;
      if (!inside(c, card)) R.push(`3レターがカードの外 ${code}`);
      else if (!onPhoto && !inRow) R.push(`3レターが、写真の上にも国名の行にも無い ${code}`);
      if (inRow && !onPhoto && right > c.left + 0.5) R.push(`国名と3レターが重なる ${say(small)}`);
      if (onPhoto && none) R.push(`写真の無いカードで、同じ3字が2つ見えている ${code}`);
    }
    /* 行き先の字（「ホテル・おすすめ」は半分ずつなら必ず入る）と街の名前：語の途中で折れない・カードの外へ出ない */
    for (const [sel, what, fit] of [['.pvg-town-go', '行き先の字', null], ['.pvg-town-n', '街の名前', room]]) {
      const e = a.querySelector(sel);
      if (!vis(e)) continue;
      const cs = chars(e), mid = midBreaks(cs, fit);
      if (mid.length) R.push(`${what}が語の途中で折れる ${say(e)}（${mid.join(' ')}）`);
      const one = orphan(cs);
      if (one) R.push(`${what}の最後の行が1字だけ ${say(e)}（${one}）`);
      if (cs.reduce((n, x) => Math.max(n, x.right), -Infinity) > card.right + 0.5) R.push(`${what}がカードの外 ${say(e)}`);
    }
  }
  return { n: cards.length, onPhoto: cards.filter(a => { const c = a.querySelector('.pvg-code3').getBoundingClientRect(), p = a.querySelector('.pvg-town-ph').getBoundingClientRect(); return c.width > 2 && c.bottom <= p.bottom + 0.5; }).length,
           bad: [...new Set(R)], over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}
/* 1枚のページの幅だけを変えて測る（container query は、幅を変えた瞬間に効く）。
   414 ＝ 大きいスマホ／600・647 ＝ 3レターが写真の上に在る、いちばん広い画面／608 ＝ 3列に替わった直後／649 ＝ 国名の行へ戻った直後。 */
const CARD_W = [320, 351, 375, 390, 414, 600, 608, 647, 649, 768, 1001, 1440];
async function runCards(browser, s) {
  const tag = `${s}（都市のカード）`, widths = CARD_W.filter(w => !WANT_W || WANT_W.includes(w));
  if (!widths.length) return;
  const { ctx, p, ready } = await open(browser, s, 390, 680, 'empty');
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  try {
    ok(ready, `${tag}: 開ける`);
    for (const [tab, what] of [['stay', '就航地の一覧'], ['overview', '概要に出す一部']]) {
      await p.evaluate(t => window.PVGlance.go(t), tab);
      await until(t => window.PVGlance.at() === t, tab);
      const bad = []; let most = 0, photo = 0;
      for (const w of widths) {
        /* 端末の種類は開いた時のまま（変えるとページが読み直される）。変えるのは幅だけ */
        await p.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        if (!(await until(w => document.documentElement.clientWidth === w, w))) { bad.push(`幅 ${w}: 画面の幅が変わらない`); continue; }
        await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        const r = await p.evaluate(cardSee);
        most = Math.max(most, r.n);
        if (w <= 414) photo = Math.max(photo, r.onPhoto);
        if (!r.n) bad.push(`幅 ${w}: カードが1枚も見えていない`);
        if (r.over > 0) bad.push(`幅 ${w}: ページが横にあふれる（${r.over}px）`);
        for (const x of r.bad.slice(0, 5)) bad.push(`幅 ${w}: ${x}`);
        if (r.bad.length > 5) bad.push(`幅 ${w}: ほか ${r.bad.length - 5}件`);
      }
      ok(!bad.length, `${tag}: ${what}（${most}枚 × 幅 ${widths.join('・')}）── 国名は1行・3レターはカードの中・字が語の途中で折れない・最後の行が1字だけにならない`, bad.slice(0, 14).join('\n      '));
      /* スマホの幅を1つでも測った回は、3レターが写真の上へ移っていること自体も確かめる（移っていなければ、上は「国名の行に在る」で通ってしまう） */
      if (widths.some(w => w <= 414)) ok(photo > 0, `${tag}: ${what} ── スマホの幅では、3レターが写真の上に在る`, `写真の上 ${photo}枚`);
    }
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
  if (wantS('view')) for (const s of ONLY) for (const v of VIEWS) work.push(() => runView(browser, s, v));
  if (wantS('off')) for (const s of ONLY) for (const v of VIEWS.filter(x => OFF_W.includes(x[0]))) work.push(() => runOff(browser, s, v));
  if (wantS('rows')) for (const s of ONLY) for (const v of VIEWS.filter(x => ROWS_W.includes(x[0]))) work.push(() => runRows(browser, s, v));
  if (wantS('rated')) for (const s of ONLY) for (const v of VIEWS.filter(x => RATED_W.includes(x[0]))) work.push(() => runRated(browser, s, v));
  if (wantS('tabs')) for (const s of ONLY) for (const v of VIEWS.filter(x => TABS_W.includes(x[0]))) work.push(() => runTabs(browser, s, v));
  if (wantS('cards')) for (const s of ONLY) work.push(() => runCards(browser, s));
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
    for (const k of Object.keys(by)) notice(`${k} では、会社概要が最初の1画面に入りきらないか、年収の額がそのすぐ下に無い（会社概要の下端 ${Object.entries(by[k]).map(([s, f]) => `${s} ${f}`).join('・')}）。約束しているのは幅 ${FOLD_FROM} から。`);
  }
  head('ページの中のエラー');
  ok(!trouble.length, '例外が出ていない・自サイトのファイルが全部読める', [...new Set(trouble)].join('\n      '));
} finally {
  await browser.close();
}
if (PARTIAL) notice('会社か幅を絞って流した。緑でも、全部を見たことにはならない。');
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
