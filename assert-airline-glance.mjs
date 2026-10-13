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
        ★概要は短い入口（2026-10-08）── 件数と「給与の提出で開きます」が1行・見本の行は1行だけ。
          給与・待遇のタブでは、欄が持つ3行がそのまま出る。評価スコアの側も、概要の抜粋は1件・錠前の行は1つ。
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
     node assert-airline-glance.mjs --scenes off,cards               調べる時だけ（場面を絞る：view・off・rows・rated・tabs・cards・gg・ggold・give）
   同時に開く枚数は PV_GLANCE_JOBS（既定 3）。
   ⚠️ この検査は check.mjs に入っていない ＝ 手で流す（check.mjs へ入れるかどうかは、オーナーの判断待ち）。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SALARY } from './salary-data.mjs';
import { BASIS } from './salary-basis.mjs';
import { JPY_PER } from './fx-rates.mjs';
import { GLANCE } from './pv-airline-view.mjs';
import { build, pageOf, ASSETS, CONTRIB, STAY, TABBED, LEGACY, DROP_H2 } from './gen-airline-glance.mjs';
import { FACTS as CO_FACTS } from './airline-facts.mjs';
import { FACTS as EY_FACTS } from './career-facts.mjs';
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
/* ボタンの下の行の、語の切れ目。狭い箱ではここでだけ折れる（「全ての口コミデ／ータを解放する」と語の途中で折れない）。
   書き手は3つ（career-live.js・gen-airline-glance.mjs・airline-reviews-ui.js）。この表は検査が自分で持つ ── 書き手から読み込まない。 */
const GG_CUT = { '全ての給与情報を解放する': ['全ての', '給与情報を', '解放する'], '口コミを解放する': ['口コミを', '解放する'], '全ての口コミデータを解放する': ['全ての', '口コミデータを', '解放する'] };
const RV_GIVE = { overview: '口コミを解放する', reviews: '全ての口コミデータを解放する' };
/* ★2026-10-09 タブの無い会社ページと英語版の鍵の面にも、同じ形のボタンを出す（オーナー判断「拡げる」）。
   下の行の言葉（英語）。日本語は上の3つと同じ。書き手は2つ（premium-auth-lock.js・airline-reviews-ui.js）── ここへ読み込まない。 */
const OLD_GG = { ja: { pay: GIVE, all: RV_GIVE.reviews, top: RV_GIVE.overview }, en: { pay: 'Unlock all pay data', all: 'Unlock all reviews', top: 'Unlock reviews' } };
/* 今までのボタン（pv-gg.css を読めなかった時・錠前の JS が無い時に、1文字も変えずに出るもの）の字と、押した先。
   lock ＝ 給与の錠前／lockPost ＝ 口コミの錠前（見本のページには無い ＝ 字だけ留める）／card ＝ 口コミ1枚ごと／list ＝ 一覧の下／voices ＝ 概要の「海外の評判」／dialog ＝ 続きを読むの小窓。 */
const OLD_WAS = {
  ja: { lock: '匿名で給与明細を出して解放する', lockPost: '匿名で口コミを投稿して解放する', card: '匿名で口コミを投稿して解放する', list: '匿名で口コミを投稿して解放する', voices: '匿名で口コミを投稿して全カテゴリを開放する →', dialog: '匿名で口コミを投稿して解放する' },
  en: { lock: 'Submit a Payslip Anonymously & Unlock', lockPost: 'Post a Review Anonymously & Unlock', card: 'Post a review anonymously to unlock', list: 'Post a review anonymously to unlock', voices: 'Post a review anonymously to unlock every category →', dialog: 'Post a review anonymously to unlock' },
};
const OLD_CLICK = { card: 'openReviewModal()', list: 'openReviewModal()', voices: 'if(window.openReviewModal)openReviewModal()', dialog: 'openReviewModal()' };
/* ★2026-10-08 昔からの節（新しい部品の下に手で書いてあった節）は、新しい部品へ移して外した。
   何をどこへ移したか・何を残したかの台帳は gen-airline-glance.mjs の LEGACY。
   ここには「残してよい節」を会社ごとに書き写してある ── 台帳の正規表現をそのまま当てると、
   台帳が緩んだ日に検査も一緒に緩む（残す節が1つ増えたら、ここも人が足す）。 */
/* ★2026-10-09 「よくある質問」も節ごと外した（オーナーの判断「節ごと外そう」）。残してよい節は、いま1つも無い。 */
const KEPT = {};
const KEPT_BY = { jal: [], ana: [], 'cathay-pacific': [], etihad: [], 'eva-air': [] };
/* 外した節の見出し（この検査の写し）。1つでもページに戻っていたら落とす。
   ★2026-10-09 ANA の「機種別・路線別 年収差」も外す側へ（古い錠前の付いた、出どころの無い表だった）。 */
const GONE_H2 = /について$|フライト環境|路線・機材|訓練・昇格|訓練・審査|福利厚生|募集要項|採用情報|と他社の比較|他社との比較|比べられるところだけ|詳細比較表|年収差|よくある質問/;
/* 会社の紹介文を、台帳の型（intro）から **この検査が自分で** 組み立てる。
   書く側の組み立て（introText）を呼ぶと、組み立てが壊れた日に「壊れた字 ＝ 壊れた字」で通ってしまう。
   texts … 画面に出るはずの文（組み立てられない文は null）／ats … 文の中の「いつの話か」の字。 */
const introWant = s => {
  const F = s === 'etihad' ? EY_FACTS.etihad : CO_FACTS[s];
  const find = k => (F.base && F.base.key === k ? F.base : [...(F.profile || []), ...(F.scale || [])].find(x => x.key === k) || null);
  const atJa = at => {
    const m = String(at ?? '').match(/^(\d{4})(?:-(?:(\d{2})(?:-(\d{2}))?|H([12])))?$/);
    return !m ? '' : m[4] ? `${m[1]}年${m[4] === '1' ? '上半期' : '下半期'}` : `${m[1]}年` + (m[2] ? `${+m[2]}月` : '') + (m[3] ? `${+m[3]}日` : '');
  };
  const when = x => (s === 'etihad' ? atJa(x.at) : x.at_ja || atJa(x.at));
  const val = x => (typeof x.value === 'number' ? x.value.toLocaleString('en-US') + (x.unit || '') : String(x.value ?? ''));
  const ats = [];
  const texts = (F.intro || []).map(t => {
    let good = true;
    const text = String(t.ja).replace(/\{([a-z0-9_]+)(?::(at|cond|city))?\}/g, (m, k, part) => {
      const x = find(k);
      const v = !x ? '' : part === 'at' ? when(x) : part === 'cond' ? (x.cond_ja || '') : part === 'city' ? (x.city_ja || '') : val(x);
      if (part === 'at') ats.push(v);
      if (!v) good = false;
      return v;
    });
    return good ? text : null;
  });
  return { texts, ats };
};
const dateJa = iso => String(iso).replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, d) => `${y}年${+mo}月${+d}日`);
/* 募集の台帳（会社の募集ページと、確かめた日）。生成側の viewOf() を呼ばずに、台帳から直接読む。 */
const jobsLedger = s => (s === 'etihad'
  ? EY_FACTS.etihad.jobs.filter(j => ['cap', 'fo'].includes(j.rank) && !/instructor/.test(j.key)).map(j => ({ url: j.url, checked: j.as_of || '', rank: j.rank }))
  : CO_FACTS[s].jobs.map(j => ({ url: j.src.url, checked: j.as_of || '' })));
/* 副題の右側：台帳の「航空連合」か「位置づけ」。 */
const taglineLedger = s => {
  const F = s === 'etihad' ? EY_FACTS.etihad : CO_FACTS[s];
  const all = [...F.profile, ...F.scale];
  const al = all.find(x => x.key === 'alliance'), nat = all.find(x => x.key === 'national_airline');
  if (al) { const m = /^(.+?)（([^（）]+)）$/.exec(String(al.value)); return m ? `${m[1]}加盟（${m[2]}）` : `${al.value}加盟`; }
  return nat ? String(nat.value) : '';
};
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
/* 「ひとつ教えて」のカードと、その中の話題（札＝<summary> の中身・質問の並び＝その下）。 */
const askCardOf = g => one(g, /<article class="pvg-card pvg-askc"[^>]*>([\s\S]*?)\n<\/article>/) || '';
const topicsOf = g => [...askCardOf(g).matchAll(/<details class="pvg-topic" data-topic="([a-z-]+)">\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map(m => ({ id: m[1], sum: m[2], body: m[3] }));
/* 話題の並びと名前（オーナーの指定：勤務／通勤・タクシー／Staff Travel／機長昇格）。 */
const ASK_TOPICS = [['work', '勤務'], ['taxi', '通勤・タクシー'], ['staff-travel', 'Staff Travel'], ['upgrade', '機長昇格']];
/* 「情報を追加」の面の絵（pv-contrib.js の ICONS）。面のファイルの字から切り出して読む ── ここに写しを持たない
   （写しを持つと、面の絵が変わっても、この検査は古い写しと比べて緑のまま）。読めなければ空 ＝ 下の突き合わせが落ちる。 */
const SHEET_ICONS = (() => {
  const t = read('pv-contrib.js'), a = t.indexOf('var ICONS = {'), b = a < 0 ? -1 : t.indexOf('};', a);
  try { return b > a ? new Function(`return ${t.slice(a + 'var ICONS = '.length, b + 1)};`)() : {}; } catch { return {}; }
})();

const PAGES = Object.fromEntries(FIVE.map(s => [s, read(pageOf(s))]));
const PART = {};
for (const s of FIVE) {
  const html = PAGES[s];
  const g = blocksOf(html, 'PV-GLANCE')[0] || '';
  const pay = one(g, /<article class="pvg-card pvg-pay"[^>]*>([\s\S]*?)\n<\/article>/) || '';
  const cut = pay.indexOf('<details class="pvg-dt pvg-paydt"');
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
  /* ★2026-10-08 根拠・条件・時点：資料ごとに、こちらが確かめた日を書く（台帳の accessed のまま。今日の日付で上書きしない）。 */
  ok(led.length > 0 && led.every((x, i) => /^\d{4}-\d\d-\d\d$/.test(x.accessed || '') && !!srcs[i] && srcs[i].mark.endsWith(`確認日 ${dateJa(x.accessed)}`)),
     `${s}: 出どころの資料ごとに、確かめた日が台帳のまま出ている`, srcs.map(x => x.mark.slice(-18)).join(' ／ '));
  /* 昔の「この数字の出どころ」の住所（#kyuyo-konkyo）は、この説明が引き継ぐ（外のページ・検索の結果からのリンクが切れない）。 */
  ok(PAGES[s].split('id="kyuyo-konkyo"').length === 2 && dt.startsWith('<details class="pvg-dt pvg-paydt" id="kyuyo-konkyo">'),
     `${s}: 住所 #kyuyo-konkyo は給与の説明の1つだけ（古い「出どころの表」の節を残していない）`, `${PAGES[s].split('id="kyuyo-konkyo"').length - 1}個`);
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
  ok(!/PAY_SECTIONS/.test(src), '補足を見せる区分の写しを、面に持っていない（誰に見せるかを決めるのはサーバの1か所）');
}
/* 集計の口（db/contrib.sql の pv_contrib_facts）が、開いている人に返す1件の鍵。SQL の jsonb_build_object から読む
   （ここへ書き写さない ＝ 口の返す鍵が変われば、この一覧も一緒に変わる）。使う所は2つ ──
   すぐ下の「answer() が行から読む鍵は、口が返す鍵だけ」と、ブラウザの検査の偽のサーバー（wire）。 */
const FACT_KEYS = (() => {
  const sql = read('db/contrib.sql');
  const a = sql.indexOf('create or replace function public.pv_contrib_facts('), o = a < 0 ? -1 : sql.indexOf('jsonb_agg(jsonb_build_object(', a);
  const b = o < 0 ? -1 : sql.indexOf('order by f.question_id', o);
  return b < 0 ? [] : [...sql.slice(o, b).matchAll(/^\s*'([a-z_]+)',/gm)].map(m => m[1]);
})();
{
  /* 集計の欄は、ビューを直接読まない（読めない）。読むのは pv_contrib_facts の返事だけ。
     answer() が行から読む鍵に、口が返さない鍵が1つでも在ると、その値は黙って undefined になる ＝ 行が出ない・年月が消える。 */
  const src = read('career-live.js'), code = noJsCmt(src);
  const a0 = code.indexOf('  function answer(row, voc) {'), a1 = a0 < 0 ? -1 : code.indexOf('  function answerNode(ans) {', a0);
  const asked = a1 < 0 ? [] : [...new Set([...code.slice(a0, a1).matchAll(/\brow\.([a-z_]+)/g)].map(m => m[1]))];
  const lost = asked.filter(k => !FACT_KEYS.includes(k));
  ok(FACT_KEYS.length > 0 && asked.length > 0 && !lost.length && !/airline_condition_facts|FACT_COLS/.test(code),
     '集計の欄は公開ビューを読まない ── answer() が行から読む鍵は、集計の口（db/contrib.sql の pv_contrib_facts）が返す鍵だけ', `口が返す鍵 ${FACT_KEYS.length}・読む鍵 ${asked.length}・口が返さない鍵「${lost.join(' ')}」`);
  /* s-multi 選べるだけ選ぶ質問で、いちばん多い答えが並んだ時（2026-10-12）。
       3人が別々の1つずつを選んだ行が「本人、配偶者・パートナー、子｜最多」と出ていた ＝ 全員一致と同じ形で、分かれているのに一致に見える。
       並んだ答えを「最多」と並べてよいかを決めるのは、サーバー（db/contrib.sql の pv_contrib_facts の lead）。
       その決め方の検査は db/test-contrib.mjs の TL1〜TL9（3人が別々・ちょうど半分・半分より多い・「わからない」を数えない）。
       ここは画面の側：answer() は lead を台帳の並びで出すだけで、人数からも top_code からも答えを作らない。
       関数の本体をそのまま切り出して評価する（写しを持たない）。 */
  {
    const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); return (a >= 0 && b > a) ? src.slice(a, b) : ''; };
    const one1 = (re) => { const m = src.match(re); return m ? m[0] : ''; };
    const helpers = one1(/^  function isArr\(v\) \{.*\}$/m) + '\n' + one1(/^  function isNum\(v\) \{.*\}$/m) + '\n';   // 写しを持たない：本体をそのまま
    const body = helpers + cut('  function optName(voc, code) {', '  function answerNode(ans) {');
    let ans = null;
    try {
      if (!/function isArr/.test(helpers) || !/function isNum/.test(helpers)) throw new Error('helpers');
      ans = new Function('T', 'numText', 'ym', body + '\n return answer;')(
        { top: 'TOP', split: 'SPLIT', median: 'MED' }, v => String(v), () => '');
    } catch { ans = null; }
    const V = { kind: 'multi', options: { self: '本人', partner: '配偶者', children: '子' } }, V1 = { ...V, kind: 'choice' };
    const run = (row, voc) => { try { const r = ans(row, voc); return r ? (r.split ? 'SPLIT' : r.text + '|' + r.how) : 'none'; } catch (e) { return 'throw'; } };
    const got = !ans ? ['関数を切り出せない'] : [
      run({ kind: 'multi', n: 3, lead: [] }, V),                                     // 並んで、半分以下（サーバーが空で返す）→ 分かれている
      run({ kind: 'choice', n: 4, lead: [] }, V1),                                   // 1つ選ぶ質問で並んだ → 分かれている
      run({ kind: 'multi', n: 3, lead: ['partner', 'self'] }, V),                    // 並んで、どれも半分より多い → 台帳の並びで全部（届いた並びではない）
      run({ kind: 'multi', n: 5, lead: ['self'] }, V),                               // いちばん多い答えが1つ → その名前に最多
      run({ kind: 'multi', n: 3, lead: ['partner', 'self'] }, V1),                   // 「選べるだけ選ぶ」の印が行にだけ在る → 同じ
      run({ kind: 'choice', n: 3, lead: ['partner', 'self'] }, V),                   // 印が台帳にだけ在る → 同じ
      run({ kind: 'choice', n: 3, lead: ['partner', 'self'] }, V1),                  // 1つ選ぶ質問に答えが2つ（本物の口は返さない形）→ 出さない
      run({ kind: 'multi', n: 3, top_code: 'self', answer_dist: { self: 3 } }, V),   // lead が無い（top_code と人数だけ在る）→ 出さない
      run({ kind: 'multi', n: 3, lead: 'self', top_code: 'self' }, V),               // lead が並びでない → 出さない
      run({ kind: 'multi', n: 3, lead: ['self', 'zz_gone'] }, V),                    // 名前の引けない答えが入っている → 出さない
    ];
    const want = ['SPLIT', 'SPLIT', '本人、配偶者|TOP', '本人|TOP', '本人、配偶者|TOP', '本人、配偶者|TOP', 'none', 'none', 'none', 'none'];
    ok(got.length === want.length && got.every((g, k) => g === want[k]),
       's-multi 選べるだけ選ぶ質問: 「最多」と並べる答えを決めるのはサーバー（lead）── 画面は lead を台帳の並びで出すだけ・空なら「回答が分かれています」・lead の無い行は出さない（人数や top_code から答えを作らない）',
       got.join(' ／ '));
  }
}
/* 額の質問（通貨つき）。集計の欄は通貨を付けずに「数字＋単位」で出すので、どの欄にも入れない。 */
const MONEY_Q = QUESTIONS.filter(q => q.currency).map(q => q.id);
/* 待遇の板の集計の欄が、聞いている質問のほかに持つ3問（着陸手当の、選ぶ形の質問）。
   どの入口からも答えられる質問で、3人そろえば会社ページに出る、と札に書いてある ── 出す欄が無ければ、その文が嘘になる。 */
const BEN_SHOWN = ['landing_pay', 'landing_pay_unit', 'landing_pay_varies_by'];
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
  {
    const keysOf = m => (one(m[1], / data-keys="([^"]*)"/) || '').split(',').filter(Boolean);
    const facts = boxes.filter(m => m[1].includes(' data-live="fact"'));
    const iB = both.indexOf('<div class="pvg-card pvg-panel" id="pvg-p-benefits"'), iE = iB < 0 ? -1 : both.indexOf('<article class="pvg-card pvg-cell" data-cell="living"', iB);
    const inBen = facts.filter(m => m.index > iB && m.index < iE);
    const lost = inBen.length === 1 ? BEN_SHOWN.filter(k => !keysOf(inBen[0]).includes(k)) : BEN_SHOWN;
    ok(iB >= 0 && iE > iB && inBen.length === 1 && !lost.length, `${s}: 待遇の板の集計の欄は、着陸手当の選ぶ質問3つ（有無・数え方・何で変わるか）も指している`, `欄 ${inBen.length}つ・指していない質問「${lost.join(' ')}」`);
    const money = facts.flatMap(keysOf).filter(k => MONEY_Q.includes(k));
    ok(facts.length > 0 && MONEY_Q.length > 0 && !money.length, `${s}: 集計の欄は、額の質問（通貨つき）を1つも指していない（欄は通貨を付けずに数字だけを出す）`, money.join(' '));
  }
  {
    /* 「ひとつ教えて」のカード：話題の札 ── 絵 → 話題の名前 → 小さい字（補足・「質問 N問」）。
       札に書く数は「質問の数」だけ（下に並ぶ行を数えて突き合わせる）。回答の数は、上の「集まった回答」の欄にだけ出る。
       札の単位は「問」・集まった回答の単位は「人」── 2つを同じ所に同じ書き方で置かない（質問の数が、回答の数に読めてしまう）。
       ここは出荷した HTML を読む（生成する側の関数を呼ばない）。 */
    const card = askCardOf(P.glance), tps = topicsOf(P.glance);
    const names = tps.map(t => text(one(t.sum, /<span class="pvg-tp-n">([\s\S]*?)<\/span>/) || ''));
    ok(same(tps.map(t => t.id), ASK_TOPICS.map(x => x[0])) && same(names, ASK_TOPICS.map(x => x[1])),
       `${s}: 話題の札は ${ASK_TOPICS.map(x => x[1]).join(' → ')} の4枚で、札の名前がその話題の名前`, tps.map((t, i) => `${t.id}「${names[i]}」`).join(' '));
    const qs = tps.map(t => [text(one(t.sum, /<span class="pvg-tp-q">([\s\S]*?)<\/span>/) || ''), (t.body.match(/<li\b/g) || []).length]);
    ok(tps.length === 4 && qs.every(([q, n]) => n > 0 && q === `質問 ${n}問`), `${s}: 札の「質問 N問」は、その話題に並ぶ質問の数そのもの（単位は「問」。回答の数ではない）`, qs.map(([q, n]) => `「${q}」行 ${n}`).join(' '));
    const icoOf = h => one(h, /^<span class="pvg-ico" aria-hidden="true"><svg\b[^>]*><path d="([^"]+)"\/><\/svg><\/span>/) || '';
    const pics = [...tps.map(t => icoOf(t.sum)), icoOf(one(card, /<a class="pvg-topic pvg-topic-a" href="#pvg-stay">([\s\S]*?)<\/a>/) || '')];
    ok(pics.length === 5 && pics.every(Boolean) && new Set(pics).size === 5, `${s}: 話題の札の絵は4つとも違い、ホテル・レストランの絵とも違う（色だけで見分けさせない）`, pics.map(d => d.slice(0, 14)).join(' ／ '));
    {
      /* 札の絵は、その札の質問が開く面（「情報を追加」）の、同じ話題の絵と同じ ── 札を押した先で、別の絵に変わらない。
         どの面を開くかは、札の下の質問の行（data-pvc-open）を読む。行が無い札・面が2つの札・面に絵が無い話題は、飛ばさずに落とす。 */
      const bad = [];
      for (const t of tps) {
        const views = [...new Set([...t.body.matchAll(/ data-pvc-open="([^"]*)"/g)].map(m => m[1]))];
        const draw = views.length === 1 && Object.hasOwn(SHEET_ICONS, views[0]) ? SHEET_ICONS[views[0]] : null;
        if (views.length !== 1) bad.push(`${t.id}: 質問の行が開く面が ${views.length}つ（${views.join(' ')}）`);
        else if (!(Array.isArray(draw) && draw.length && draw.every(d => typeof d === 'string' && d))) bad.push(`${t.id}: 面に「${views[0]}」の絵が無い（pv-contrib.js の ICONS）`);
        else if (icoOf(t.sum) !== draw.join(' ')) {
          const a = icoOf(t.sum), b = draw.join(' ');
          let i = 0; while (i < a.length && a[i] === b[i]) i++;
          bad.push(`${t.id}: 面の「${views[0]}」の絵と ${i + 1}字めから違う（札「${a.slice(Math.max(0, i - 10), i + 10)}」／面「${b.slice(Math.max(0, i - 10), i + 10)}」）`);
        }
      }
      ok(tps.length === 4 && !bad.length, `${s}: 話題の札の絵は、その札の質問が開く面（「情報を追加」）の、同じ話題の絵と同じ`, bad.join(' ／ '));
    }
    {
      /* 見出し「◯◯のこと、ひとつ教えて。」── 字はこのまま、2つのかたまり（狭い画面で折れるのは、そのあいだだけ）。
         かたまりの外にも、あいだにも、字や空白を置かない（置くと、見出しの字が変わる）。 */
      const h2 = one(card, /<h2 class="pvg-eyebrow">([\s\S]*?)<\/h2>/), m = /^<span>([^<]+)のこと、<\/span><span>ひとつ教えて。<\/span>$/.exec(h2 || '');
      ok(!!m && unesc(m[1]) === nameOf(s), `${s}: カードの見出しは「${nameOf(s)}のこと、」「ひとつ教えて。」の2つのかたまりだけ（外にも、あいだにも、字や空白が無い）`, h2 === null ? '見出しが無い' : h2);
    }
    {
      const bad = [];
      for (const t of tps) {
        const rest = text(t.sum.replace(/<span class="pvg-tp-q">[\s\S]*?<\/span>/, ''));
        if ((t.sum.match(/class="pvg-tp-q"/g) || []).length !== 1) bad.push(`${t.id}: 「質問 N問」が1つでない`);
        if (/[件人]|回答|公開/.test(text(t.sum))) bad.push(`${t.id}: 回答の数に読める字（件・人・回答・公開）`);
        if (/[0-9０-９]/.test(rest)) bad.push(`${t.id}: 「質問 N問」の外に数字（${rest}）`);
        if (/class="[^"]*\bcrl\b|data-live=|data-pvg-n|<a\b|<button\b|<small\b/.test(t.sum)) bad.push(`${t.id}: 実データの欄・数を入れる口・押せるもの・古い小さい字`);
      }
      ok(tps.length === 4 && !bad.length, `${s}: 話題の札に、回答の数も実データの欄も書いていない（札の数字は「質問 N問」の1つだけ）`, bad.join(' ／ '));
    }
    {
      const got = one(card, /<div class="pvg-got">([\s\S]*?)<\/div><\/div>/) || '';
      const slot = /^<p class="pvg-askh">集まった回答<\/p><div class="crl" data-live="fact"([^>]*)><span class="crl-ph">—<\/span>$/.exec(got);
      const keys = slot ? (one(slot[1], / data-keys="([^"]*)"/) || '').split(',').filter(Boolean) : [];
      const asked = [...new Set(tps.flatMap(t => [...t.body.matchAll(/ data-pvc-q="([a-z0-9_]+)"/g)].map(m => m[1])))];
      ok(card.split('data-live="fact"').length === 2 && !!slot && keys.length > 0 && same([...keys].sort(), [...asked].sort()),
         `${s}: 回答の数が出るのは「集まった回答」の欄1つだけ ── 「—」で出荷し、4つの話題の質問を全部指している`, `欄 ${card.split('data-live="fact"').length - 1}つ・指す質問 ${keys.length}・並ぶ質問 ${asked.length}`);
    }
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
    const cta = [...card.matchAll(/<p class="pvg-rv-cta pvg-rv-cta-([a-z]+)"><a class="pv-gg" href="([^"]*)"><span class="pv-gg-t"><span class="pvg-gg-k" lang="en">([^<]*)<\/span><span class="pvg-gg-m">((?:[^<]|<wbr>)*)<\/span><\/span><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" [^>]*\/><\/svg><\/a>/g)].map(m => [m[1], unesc(m[2]), unesc(m[3]), m[4].replace(/<wbr>/g, ''), m[4].split('<wbr>')]);
    const to = `../submit-review.html?airline=${s}`;
    ok(same(cta.map(c => c.slice(0, 4)), [['overview', to, GG, RV_GIVE.overview], ['reviews', to, GG, RV_GIVE.reviews]]) && hrefs.filter(h => h.startsWith('../submit-review.html')).length === 2,
       `${s}: 口コミを書く入口は2行のボタン ── 概要は「${GG}／${RV_GIVE.overview}」・口コミのタブは「${GG}／${RV_GIVE.reviews}」・どちらも自分の会社を選んだ投稿の画面へ`, cta.map(c => c.slice(0, 4).join(' ')).join(' ／ '));
    ok(same(cta.map(c => c[4]), [GG_CUT[RV_GIVE.overview], GG_CUT[RV_GIVE.reviews]]), `${s}: その下の行に、語の切れ目が置いてある（狭い箱で、語の途中では折れない）`, cta.map(c => (c[4] || []).join('｜')).join(' ／ '));
    ok(!/匿名で口コミを(投稿する|書く)/.test(both), `${s}: 前の言葉（「匿名で口コミを投稿する」）が、社名の行と新しい節に残っていない`);
  }
  {
    /* ★2026-10-08 昔からの節は新しい部品へ移して外した（オーナーのご指示「CSSで隠しただけ、旧文と新文の併存で終わらない」）。
       新しい部品の下に残ってよいのは、会社ごとに決めた節だけ（KEPT_BY）。隠したのではなく、HTML から無くなっている。 */
    const txt = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const below = PAGES[s].slice(PAGES[s].indexOf('<!--/PV-GLANCE-->'));
    const secs = [...below.matchAll(/<div class="glass\b[^"]*"[^>]*>/g)].map(m => txt(one(below.slice(m.index), /<h2\b[^>]*>([\s\S]*?)<\/h2>/) || ''));
    const want = KEPT_BY[s];
    ok(secs.length === want.length && secs.every((x, i) => KEPT[want[i]].test(x)),
       `${s}: 新しい部品の下に、昔の節が1つも残っていない（残すと決めた節は、いま無い）`, secs.join(' ／ '));
    /* ★2026-10-09 「よくある質問」は節ごと外した。画面の節だけ外して、検索に渡す質問と答え（FAQPage）を残さない
       ── 画面に無い質問を、構造化データだけが名乗ることになる。作り直しの目印（PV-FAQ）も残さない
       （残っていると、gen-faq.mjs が「ここへ書き直す」と読む）。 */
    {
      const lds = [...PAGES[s].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } });
      const types = lds.flatMap(j => (Array.isArray(j) ? j : [j]).map(x => x && x['@type']));
      ok(lds.length > 0 && lds.every(Boolean) && !types.includes('FAQPage') && types.includes('Article') && types.includes('BreadcrumbList'),
         `${s}: 構造化データに「よくある質問」が残っていない（記事とパンくずは残っている）`, types.join('・'));
      ok(!PAGES[s].includes('PV-FAQ') && !PAGES[s].includes('よくある質問'), `${s}: ページのどこにも「よくある質問」の字と、作り直しの目印が無い`);
    }
    const h2 = [...PAGES[s].matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => txt(m[1]));
    const dup = h2.filter(x => !Object.values(KEPT).some(re => re.test(x)) && (GONE_H2.test(x) || DROP_H2.test(x)));
    ok(!dup.length, `${s}: 外した節（◯◯について・フライト環境・訓練・福利厚生・募集要項・他社の比較・機種別の年収差）が、ページのどこにも残っていない`, dup.join(' ／ '));
    /* ★2026-10-09 古い錠前（橙の四角いボタンを重ねる premium-gate）の置き場が、ページに1つも無い。
       残っていると、同じページに形の違う Give & Get が2つ出る（ANA の年収差の節がそうだった）。 */
    const oldLock = ['class="premium-gate', 'pv-locked', 'pv-btn-main', 'pv-give-take'].filter(x => PAGES[s].includes(x));
    ok(!oldLock.length, `${s}: 古い錠前の置き場（premium-gate ほか）が、ページのどこにも無い（Give & Get の形は1つだけ）`, oldLock.join(' ／ '));
    ok(!/display\s*:\s*none|\bhidden\b[^>]*>\s*<h2/.test(below.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '').split('<footer')[0].replace(/<svg\b[\s\S]*?<\/svg>/g, '')),
       `${s}: 新しい部品の下に、隠しただけの節を置いていない`);
    /* 残した節は、どれかのタブに属している（タブに絞ったとき、全部のタブに出っぱなしにならない）。 */
    ok([...below.matchAll(/<div class="glass\b[^"]*"([^>]*)>/g)].every(m => /\bdata-pvg-pane="(?:overview|pay|reviews|work|life|stay)(?: (?:overview|pay|reviews|work|life|stay))*"/.test(m[1])),
       `${s}: 残した節は、どれかのタブに属している`);
    /* 会社の紹介は、会社概要のカードの中に1回だけ。字は台帳の項目から組み立てたものだけ
       （手で書いた紹介文には「日本第2位」のような順位・古い機数・確かめていない訓練地が入っていた）。 */
    const co = one(P.glance, /<article class="pvg-card pvg-co"[^>]*>([\s\S]*?)\n<\/article>/) || '';
    const lead = [...PAGES[s].matchAll(/<p class="pvg-about" data-pvg-about="lead">([\s\S]*?)<\/p>/g)].map(m => unesc(m[1]));
    const iw = introWant(s), led = iw.texts.join('');
    ok(lead.length === 1 && lead[0].length >= 60 && co.includes('data-pvg-about="lead"') && co.indexOf('data-pvg-about="lead"') < co.indexOf('<dl class="pvg-keys">'),
       `${s}: 会社の紹介（歴史・規模・拠点の文）が、会社概要のカードの中・数字の一覧より上に1つだけ在る`, `${lead.length}つ・${(lead[0] || '').length}字`);
    ok(lead[0] === led && !/<[a-z]/i.test(lead[0] || ''), `${s}: 会社の紹介の字は、台帳の項目から組み立てた字のまま（手で書いた字を足していない）`, `画面「${(lead[0] || '').slice(0, 60)}」／台帳「${led.slice(0, 60)}」`);
    ok(iw.texts.length > 0 && iw.texts.every(Boolean) && iw.ats.every(a => /^\d{4}年/.test(a)),
       `${s}: 紹介文はどの文も台帳の項目で埋まる・文の中の「いつの話か」は年から始まる日付の字`, `文 ${iw.texts.map(t => (t ? '○' : '×')).join('')}／いつ ${iw.ats.join('・') || '無し'}`);
    ok(!/data-pvg-about="more"|pvg-about-more/.test(PAGES[s]), `${s}: 手で書いた紹介の続き（古いページの字）を運んでいない`);
    ok(!/日本第[0-9０-９一二三]位|日本最大|世界最大|業界(?:最大|トップ|No)/.test(text(P.hero + P.glance)), `${s}: 順位や「最大」を、社名の行と新しい節に書いていない`);
    /* 見えている数字は2〜4つ。紹介文がもう言った項目を、下にもう一度並べない。 */
    const keys = [...(one(co, /<dl class="pvg-keys">([\s\S]*?)<\/dl>/) || '').matchAll(/<div><dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd><\/div>/g)].map(m => unesc(m[1]));
    const F = s === 'etihad' ? EY_FACTS.etihad : CO_FACTS[s];
    const said = new Set((F.intro || []).flatMap(x => x.uses || []));
    const saidLabels = [...F.profile, ...F.scale].filter(x => said.has(x.key)).map(x => x.ja);
    ok(keys.length >= 2 && keys.length <= 4 && !keys.some(k => saidLabels.includes(k)), `${s}: 会社のカードに見えている数字は2〜4つ・紹介文がもう言った項目を並べ直していない`, keys.join(' ／ '));
    /* 同じ文が、ページのほかの所にもう1回出ていないか（頭の40字で探す）。 */
    const again = lead.filter(x => x.length >= 40 && PAGES[s].split(x.slice(0, 40)).length - 1 !== 1);
    ok(!again.length, `${s}: 紹介の文が、ページの中で重なっていない`, again.map(x => x.slice(0, 24)).join(' ／ '));
    /* 副題（社名の下の1行）の右側も、台帳の項目から。左側（社名の読み）はページが前から持っていた字。 */
    const sub = unesc(one(P.hero, /<p class="text-muted pvg-sub">([^<]*)<\/p>/) || '');
    ok(!!taglineLedger(s) && sub.split(' — ').length === 2 && sub.split(' — ')[1] === taglineLedger(s) && sub.split(' — ')[0].length > 1,
       `${s}: 社名の下の1行は「社名 — 台帳の航空連合（か位置づけ）」`, `${sub} ／ 台帳「${taglineLedger(s)}」`);
  }
  const known = h => /^https:\/\//.test(h) || h === '#pvg-stay' || /^#(overview|pay|reviews|work|life|stay)$/.test(h) || /^#stay-[A-Z]{3}$/.test(h) || (/^\?add=([a-z_]+)$/.test(h) && TOPICS.has(h.slice(5))) || /^\.\.\/(airline-conditions|career|pay-report|submit-review)\.html\?/.test(h) || /^\.\.\/(career-live|pv-glance|career-stay)\.css\?v=/.test(h);
  ok(hrefs.every(known), `${s}: 知らない形の行き先が無い`, hrefs.filter(h => !known(h)).slice(0, 3).join(' '));
  ok(!hrefs.includes('#pvg-stay') || /id="pvg-stay"/.test(P.glance), `${s}: ページの中の行き先（#pvg-stay）が在る`);
  {
    /* ★2026-10-08 募集は、この1枚だけ（下の古い「募集要項」「採用情報」の節は外した）。
       新旧の2か所に在ったとき、JAL は上が「免許を持つ人は自社養成へ応募できない」・下が「経験者を随時採用」と食い違っていた。
       右上の入口は、会社の募集ページへ直接。資料ごとに、こちらが確かめた日を書く（台帳のまま。今日の日付にしない）。 */
    const jobs = one(P.glance, /<article class="pvg-card pvg-jobs"[^>]*>([\s\S]*?)\n<\/article>/) || '';
    const led = jobsLedger(s);
    const want = new Map();
    for (const x of led) { const o = want.get(x.url); if (o === undefined || x.checked < o) want.set(x.url, x.checked); }
    ok(PAGES[s].split('<article class="pvg-card pvg-jobs"').length === 2 && led.length > 0, `${s}: 募集の1枚がちょうど1つ在り、台帳に募集の行が在る`);
    const entry = one(jobs, /<span class="pvg-hsub"><a class="pvg-link" href="([^"]*)" target="_blank" rel="noopener">会社の募集ページ</);
    ok(entry !== null && unesc(entry) === led[0].url && /^https:\/\//.test(led[0].url), `${s}: 「会社の募集ページ」は、台帳のいちばん上の行の資料へ直接行く`, String(entry));
    const got = [...jobs.matchAll(/<a class="pvg-src" href="([^"]*)" target="_blank" rel="noopener">[^<]*<\/a><small>確認日 ([^<]*)<\/small>/g)].map(m => [unesc(m[1]), m[2]]);
    ok(same(got, [...want].map(([u, d]) => [u, dateJa(d)])) && [...want.values()].every(d => /^\d{4}-\d\d-\d\d$/.test(d)) && (jobs.match(/<a class="pvg-src"/g) || []).length === want.size,
       `${s}: 募集の出どころは台帳の資料と同じ並び・資料ごとに確かめた日（いちばん古い日）が付いている`, got.map(x => x[1]).join(' ／ '));
    ok(!/data-pvg-tab="jobs"|募集要項を開く/.test(PAGES[s]), `${s}: 古い節へ寄る入口（「募集要項を開く」）を残していない`);
    if (s === 'etihad') {
      /* エティハドは求人票の応募の条件を、行ごとに出す（年収の根拠の台帳に在る字のまま）。 */
      const rows = [...jobs.matchAll(/<div><dt>[^<]*<\/dt><dd><b>[^<]*<\/b><small>([^<]*)<\/small><\/dd><\/div>/g)].map(m => unesc(m[1]));
      const req = led.map(x => (BASIS.etihad[x.rank] && BASIS.etihad[x.rank].groups && BASIS.etihad[x.rank].groups[0] && BASIS.etihad[x.rank].groups[0].req) || '');
      ok(rows.length === led.length && req.every((r, i) => r.length > 10 && rows[i].startsWith(`応募条件：${r}`)), `${s}: 募集の行に、求人票の応募の条件が台帳の字のまま出ている`, rows.map(x => x.slice(0, 30)).join(' ／ '));
    }
  }
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
  ok(tabRefs.every(t => TAB_ID.has(t)) && TABS.every(([id]) => { const n = tabRefs.filter(t => t === id).length; return n === 1 || (id === 'stay' && n === 2); }),
     `${s}: タブへの入口が指すのは在るタブだけ（タブの帯の6つ＋概要の「就航地をすべて見る」）`, tabRefs.join(' '));
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
  ok(LJ.includes(`gg: '${GG}'`) && LJ.includes(`payUnlock: [${GG_CUT[GIVE].map(x => `'${x}'`).join(', ')}]`) && LJ.includes(`payTerms: '${TERMS}'`) && !LJ.includes(UNLOCK), `会社ページの入口の言葉は「${GG}／${GIVE}」と「${TERMS}」（「${UNLOCK}」とは書かない）`);
  /* 会社ページ（GL）の入口だけが2行。行き先は前と同じ（自分の会社を選んだ給与の提出）。 */
  ok(/foot\(GL \? \[\s*give2\(T\.payUnlock, UP \+ 'pay-report\.html\?airline=' \+ enc\(slug\)\),\s*pay\.anon \? link\(T\.login, loginHref\(\)\) : null,\s*link\(T\.payTerms, UP \+ 'actual-pay\.html\?air=' \+ enc\(slug\)\)\s*\] : \[/.test(LJ),
     '会社ページの入口は 2行のボタン（給与の提出へ）→ ログイン（未ログインの時だけ）→ 閲覧条件（REAL PAY へ）の順');
  ok(/k\.lang = 'en';/.test(fn('give2')) && fn('give2').includes("el('span', 'crl-cta-k', T.gg)") && fn('give2').includes("var m = el('span', 'crl-cta-m');") && fn('give2').includes("d.createElement('wbr')") && fn('give2').includes('d.createTextNode(w)') && !/innerHTML/.test(fn('give2')),
     '2行のボタンは、上が「Give & Get」・下が開くもの（字は文字として入れる・語の切れ目に <wbr>）');
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
  /* 質問の行：触れた時の決まりに transform:none を書かない。
     書くと、触れたまま押した時の「縮む」まで消える（押した時の決まりより強いので。「押せるものに状態が在る」の検査は緑のまま）。
     「ひとつ教えて」のカードで言い直した側（.pvg-askc …）には、動きを1つも書かない ── none でなくても同じことが起きる
     （translateY(-1px) と言い直しただけで、押した時の決まりに勝って縮まなくなる）。
     ここは決まりの字を読むだけ。本当に縮むかは、画面の検査が触れたまま押して測る（rowShrink）。 */
  const still = [...CSSC.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(m => (/\.pvg-ask a:hover/.test(m[1]) && /transform\s*:\s*none/.test(m[2])) || (/\.pvg-askc \.pvg-ask a:hover/.test(m[1]) && /(?<![\w-])transform\s*:/.test(m[2])))
    .map(m => m[1].trim());
  ok(/\.pvg-ask a:hover\{/.test(CSSC) && !still.length, '質問の行に触れた時の決まりで、動きを消していない・言い直していない（どちらも、押した時の縮みまで消える）', still.join(' ／ '));
}
head('pv-glance.js・airline-base.js');
ok(!/[¥万円]/.test(JSC), 'pv-glance.js に金額の字（¥・万・円）が無い');
ok(!/\d{4,}/.test(JSC), 'pv-glance.js に4けた以上の数が無い', (JSC.match(/.{0,20}\d{4,}.{0,20}/) || [''])[0]);
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(JSC), 'pv-glance.js は HTML を組み立てない（見せる・隠す・動かすだけ）');
ok(/getAttribute\('data-pv-glance'\)\s*===\s*'1'\)\s*return/.test(noJsCmt(read('airlines/airline-base.js'))),
   'airline-base.js は5枚に、見本の点数を混ぜた評価を足さない');
{
  /* 口コミの錠前のボタン。字を2行にしただけで、行き先も開く条件も今までと同じ（言葉はここに書く・写さない）。
     ★2026-10-09 オーナー判断「拡げる」：同じ形を、タブの無い会社ページと英語版の鍵の面にも出す。
       言葉は置き場で決まる（一覧の錠前・「続きを読む」の小窓 ＝ all／概要の「生の声」の下 ＝ top）。
       出すのは pv-gg.css を読めた時だけ。読めなかった時は、今までのボタンを1文字も変えずに出す。 */
  const ui = noJsCmt(read('airlines/airline-reviews-ui.js'));
  const body = name => one(ui, new RegExp('\\n  function ' + name + '\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}')) || '';
  const fn = body('unlockLabel'), words = one(ui, /\n  var GG_WORDS = \{([\s\S]*?)\n  \};/) || '';
  const cutOf = k => GG_CUT[RV_GIVE[k]].join('<wbr>');
  ok(fn.includes('<span class="pvg-gg-k" lang="en">Give &amp; Get</span>') && fn.includes(`'<span class="pvg-gg-m">' + (words[kind] || words.all) + '</span></span>'`)
     && words.includes(`ja: { all: '${cutOf('reviews')}', top: '${cutOf('overview')}' },`),
     `口コミの錠前のボタンは2行 ──「${GG}／${RV_GIVE.reviews}」・概要は「${GG}／${RV_GIVE.overview}」（語の切れ目つき）`);
  ok(words.includes(`en: { all: '${OLD_GG.en.all}', top: '${OLD_GG.en.top}' },`) && /var words = GG_WORDS\[LANG\] \|\| GG_WORDS\.ja;/.test(fn),
     `英語版の下の行は「${OLD_GG.en.all}」・概要は「${OLD_GG.en.top}」`);
  /* 1枚ごとの錠前のボタンは、黒い丸いボタンを出す時には置かない（同じ黒いボタンが口コミの数だけ並ぶ。ぼかしの帯の中では上下が切れる）。
     置くのは3か所だけ：一覧のいちばん下の「メンバー限定データ」・「続きを読む」の窓・公開情報のまとめの下。 */
  const card = body('cardCta'), btn = body('unlockBtn'), old = body('ggOld'), settle = body('ggSettle');
  ok(/^\s*if \(ggShape\(\)\) return '';\s*var st = ggOld\(\);\s*return st === 'yes' \? '' : st === 'wait' \? ggWait\('card', old\) : old;\s*$/.test(card)
     && (ui.match(/cardCta\(\n/g) || []).length === 2 && (ui.match(/unlockBtn\('/g) || []).length === 3
     && [/function lockedTailHTML\(tailText\) \{([\s\S]*?)\n  \}/, /function srvLockHTML\(catKeys\) \{([\s\S]*?)\n  \}/].every(re => { const b = one(ui, re) || ''; return b.includes('cardCta(') && !b.includes('unlockBtn('); }),
     '口コミ1枚ごとの錠前のボタンは、黒い丸いボタンを出す時には置かない（入口は評価スコアの1枚／一覧の見出しと、一覧のいちばん下）');
  /* タブのある日本語の会社ページ ＝ いつも黒い丸いボタン。ほかの会社と英語版 ＝ pv-gg.css を読めた時だけ。
     読めなかった時・読む口（window.PVGG）が無い時は、渡された今までのボタンをそのまま返す（形の無い素の字を出さない）。 */
  ok(/^\s*if \(ggShape\(\)\) return ggBtn\('all'\);\s*var st = ggOld\(\);\s*return st === 'yes' \? ggBtn\(kind \|\| 'all'\) : st === 'wait' \? ggWait\(kind \|\| 'all', old\) : old;\s*$/.test(btn)
     && /\n  function ggShape\(\) \{ return LANG === 'ja' && isTabbed\(\); \}/.test(ui),
     'タブのある日本語の会社ページはいつも黒い丸いボタン。ほかの会社と英語版は、pv-gg.css を読めた時だけ（読めなければ今までのボタンのまま）');
  ok(/^\s*if \(isTabbed\(\)\) return 'no';\s*var g = w\.PVGG;\s*if \(!g \|\| typeof g\.ready !== 'function' \|\| typeof g\.state !== 'function'\) return 'no';/.test(old) && /return 'wait';\s*$/.test(old)
     && /if \(!ok\) el\.outerHTML = el\.innerHTML;/.test(settle) && /else if \(kind === 'card'\) el\.parentNode\.removeChild\(el\);/.test(settle) && /else el\.outerHTML = ggBtn\(kind\);/.test(settle)
     && /\n  function ggWait\(kind, old\) \{ return '<div data-pvgg-wait="' \+ kind \+ '" style="display:none">' \+ old \+ '<\/div>'; \}/.test(ui),
     '形が決まるまで、今までのボタンは見えない箱で待つ（橙から黒への入れ替わりも、形の無い素の字も、一瞬も見せない）');
  /* 「続きを読む」の小窓（タブの無い会社ページ・英語版）：板はいつも暗い色 ＝ 板に data-theme="dark" を付けて、ボタンを暗い面の色で出す。
     明るいページでも、板の上の字の色を読み替えさせない（rmgKeepInk）。 */
  ok(/var rmNew = !ggShape\(\) && ggOld\(\) === 'yes';/.test(ui) && ui.includes(`'\\n    <div' + (rmNew ? ' data-theme="dark"' : '') + ' style="background:#111620;`)
     && ui.includes(`(rmNew ? '        ' + ggBtn('all') + '\\n' :`) && /if \(!ggShape\(\)\) rmgKeepInk\(modal\);/.test(ui)
     && /els\[i\]\.style\.setProperty\('color', c, 'important'\);/.test(body('rmgKeepInk')),
     '「続きを読む」の小窓（タブの無いページ）：暗い板に明るいボタン・板の上の字の色を読み替えさせない');
  /* ★2026-10-09 手元の鍵の控え（pv_unlock_expiry）は、下げる向きには直らない（別の会員でログインした・自分の口コミが消えた・ログインが切れた）。
     控えが生きていても、サーバが本文を伏せて返した口コミが在れば、一覧のいちばん下の入口を出す。
     1枚ごとのボタンを外したので、ここが無いと、伏せたカードが並ぶのに一覧の中の入口が1つも無い（実際に開いて確かめるのは、下の「手元の鍵の控えだけが残っている時」）。 */
  ok(/var srvLk = filtered\.some\(function \(r\) \{ return r\.serverLocked; \}\);\s*var postGate = \(\(locked \|\| srvLk\) && shown > 0\) \?/.test(body('paint'))
     && /serverLocked: !!body\.locked,/.test(ui),
     '手元の鍵の控えが生きていても、サーバが伏せて返した口コミが在れば、一覧のいちばん下の入口を出す（伏せたかどうかはサーバの返事だけで決める）');
  /* 3つは同じ字なので、字だけを探すと1つ変わっても残りの2つで通ってしまう ＝ どの欄の字かまで留める。 */
  ok([['lockedCta', 'card'], ['gateBtn', 'list'], ['rmBtn', 'dialog'], ['vcGateBtn', 'voices']].every(([key, at]) => ['ja', 'en'].every(l => ui.includes(` ${key}: '${OLD_WAS[l][at]}',`)))
     && (ui.match(/class="rv-locked-btn" onclick="openReviewModal\(\)"/g) || []).length === 2 && (ui.match(/' \+ L\.lockedCta \+ '/g) || []).length === 2 && (ui.match(/' \+ L\.rmBtn \+ '/g) || []).length === 1
     && ui.includes(`<button class="btn-review-post" style="width:100%;justify-content:center" onclick="${OLD_CLICK.dialog}">`)
     && ui.includes(`unlockBtn('<button class="btn-review-post" onclick="${OLD_CLICK.list}">' + L.gateBtn + '</button>')`)
     && ui.includes(`unlockBtn('<button class="btn-review-post" onclick="${OLD_CLICK.voices}">' + L.vcGateBtn + '</button>', 'top')`),
     '読めなかった時に出す今までのボタンは、字も押した先も今までのまま（口コミ1枚ごと・一覧の下・「海外の評判」・小窓）');
}
{
  /* 給与と口コミの鍵の面（premium-auth-lock.js）。変えたのは形と字だけ ── 行き先・計測の印・開く条件は今までと同じ。 */
  const lock = noJsCmt(read('airlines/premium-auth-lock.js'));
  const ov = one(lock, /\n  function overlayHTML\(loggedIn, gateKey, gg\) \{([\s\S]*?)\n  \}/) || '';
  ok(lock.includes(`ggSalary:      '${GG_CUT[GIVE].join('<wbr>')}',`) && lock.includes(`ggReview:      '${GG_CUT[RV_GIVE.reviews].join('<wbr>')}',`)
     && lock.includes(`ggSalary:      '${OLD_GG.en.pay}',`) && lock.includes(`ggReview:      '${OLD_GG.en.all}',`),
     `鍵の面のボタンの下の行 ── 給与「${GIVE}」・口コミ「${RV_GIVE.reviews}」／英語「${OLD_GG.en.pay}」「${OLD_GG.en.all}」`);
  const cta = `data-pv-cta="' + (isSalary ? 'salary' : 'review') + '">'`;
  ok(ov.includes(`'<a href="' + href + '" class="pv-gg" style="align-self:center" ${cta}`) && ov.includes(`'<a href="' + href + '" class="pv-btn-main" ${cta}`)
     && ov.includes("var href  = isSalary ? SALARY_URL : reviewURL();") && ov.includes(`'<span class="pv-gg-t"><span class="pvg-gg-k" lang="en">Give &amp; Get</span>'`)
     && ov.includes("'<span class=\"pvg-gg-m\">' + (isSalary ? T.ggSalary : T.ggReview) + '</span></span>'"),
     '鍵の面：新しいボタンも今までのボタンも、同じ行き先・同じ計測の印（data-pv-cta）');
  ok(/\n          gg \? '' : \[\n          '<div class="pv-give-take">',/.test(ov) && /\n            gg \? \[\n/.test(ov) && /\]\.join\(''\) : \[\n            '<a href="' \+ href \+ '" class="pv-btn-main"/.test(ov),
     '鍵の面：pv-gg.css を読めなかった時は、今までの札とボタンを1文字も変えずに出す');
  const rd = one(lock, /\n  function renderOverlays\(list, loggedIn\) \{([\s\S]*?)\n  \}/) || '';
  ok(/GG\.ready\(function \(gg\) \{/.test(rd) && /if \(g\.classList\.contains\('pv-locked'\) && !g\.querySelector\('\.pv-gate-overlay'\)\)/.test(rd) && /overlayHTML\(loggedIn, keyOf\(g\), gg\)/.test(rd),
     '鍵の面は、ボタンの形が決まってから出す（待っているあいだに開いた枠には出さない・二重に出さない）');
  /* 読む口は1つ（window.PVGG）。もう読んでいるページ（主要5社）では足さない・足す時は末尾に1回・読めなければ false。 */
  ok(/const GG = window\.PVGG = window\.PVGG \|\| \(function \(\) \{/.test(lock) && /if \(l && usable\(l\)\) \{ done\(true\); return; \}/.test(lock) && /if \(!l\) \{\s*l = document\.createElement\('link'\);/.test(lock)
     && /l\.addEventListener\('error', function \(\) \{ done\(false\); \}\);/.test(lock) && /setTimeout\(function \(\) \{ done\(usable\(l\)\); \}, 2500\);/.test(lock)
     && /new URL\('\.\.\/pv-gg\.css', SELF/.test(lock) && !/\.pv-gg\s*\{|border-radius:\s*999px/.test(lock),
     'pv-gg.css を読む口は1つ（window.PVGG）── もう読んでいれば足さない・読めなければ今までの形・ここに形を書かない');
  /* ★2026-10-09 「読めた」の中身は「決まりが1つ以上入っている」。空のファイルが 200 で届いた時（配信の途中・切れた写し）を「読めた」にしない。
     ここを甘くすると、形の無い素の字のボタンが出る（実際に開いて確かめるのは、下の「形のファイルが空で届いた時」）。 */
  ok(/function usable\(l\) \{\s*try \{ return !!l\.sheet && l\.sheet\.cssRules\.length > 0; \} catch \(e\) \{ return !!l\.sheet; \}\s*\}/.test(lock)
     && /l\.addEventListener\('load',\s+function \(\) \{ done\(usable\(l\)\); \}\);/.test(lock),
     'pv-gg.css が空で届いた時は「読めた」にしない（決まりが1つも無ければ、今までのボタンのまま）');
  ok(ov.includes('var cta   = isSalary ? T.salCta : T.ctaPost;') && /'<a href="' \+ href \+ '" class="pv-btn-main" [^\n]*\n(?:[^\n]*\n){0,3}?\s*cta,\n/.test(ov)
     && ['ja', 'en'].every(k => lock.includes(`salCta:        '${OLD_WAS[k].lock}',`) && lock.includes(`ctaPost:       '${OLD_WAS[k].lockPost}',`)),
     '読めなかった時に出す今までの錠前のボタンは、字が今までのまま（給与 ＝ salCta・口コミ ＝ ctaPost）');
}

head('古い節の台帳（新しい表示先／不要／残す）');
{
  /* ★2026-10-08 オーナーのご指示「各旧節を『新しい表示先／不要／要確認』の短い一覧で管理」。
     一覧は gen-airline-glance.mjs の LEGACY の1つだけ。ここは、その表が「一覧として読める形」のままかを見る
     （行き先の無い「移した」・理由の無い「残す」を置かせない）。 */
  const STATES = ['merged', 'drop', 'keep'];
  const bad = [];
  for (const r of LEGACY) {
    const who = r.name || JSON.stringify(r).slice(0, 40);
    if (!(typeof r.name === 'string' && r.name.trim())) bad.push(`名前が無い行（${who}）`);
    if (!STATES.includes(r.state)) bad.push(`${who}: 状態が「${r.state}」（在ってよいのは ${STATES.join('・')}）`);
    if (!!r.id === !!r.h2) bad.push(`${who}: 節の見つけ方は、住所（id）か見出し（h2）のどちらか1つ`);
    if (r.h2 && !(r.h2 instanceof RegExp)) bad.push(`${who}: 見出しの見つけ方が正規表現でない`);
    if (r.state === 'keep' ? !(typeof r.why === 'string' && r.why.trim()) : !(typeof r.to === 'string' && r.to.trim())) bad.push(`${who}: ${r.state === 'keep' ? '残す理由（why）' : '新しい表示先（to）'}が書いていない`);
    if (r.state === 'keep' && r.to) bad.push(`${who}: 残す節に、移し先が書いてある`);
  }
  if (new Set(LEGACY.map(r => r.name)).size !== LEGACY.length) bad.push('同じ名前の行が2つ在る');
  ok(LEGACY.length > 0 && !bad.length, `古い節の台帳は ${LEGACY.length}行 ── どの行も、移した先か・外した後の入口か・残す理由が書いてある`, bad.join(' ／ '));
  /* 「残す」の行と、この検査が「残ってよい」と知っている節が同じ（片方だけ足すと、もう片方が黙って通す） */
  const keep = LEGACY.filter(r => r.state === 'keep'), mine = Object.values(KEPT);
  /* 残すと決めた節の見出しの見本（いまは空。残す節を足すときは、ここと KEPT・KEPT_BY の3つに足す） */
  const SAMPLE = {};
  ok(keep.length === mine.length && Object.keys(SAMPLE).length === mine.length && Object.entries(SAMPLE).every(([k, t]) => KEPT[k].test(t) && keep.filter(r => r.h2.test(t)).length === 1),
     `台帳の「残す」は ${keep.length}行 ＝ この検査が残ってよいと知っている節（${mine.length}つ。いまは無い）`, keep.map(r => r.name).join(' ／ '));
  /* 外す側の見出しの見つけ方が、残す節を掴まない（掴むと、残すと決めた節が外れる） */
  ok(Object.values(SAMPLE).every(t => !DROP_H2.test(t) || keep.some(r => r.h2.test(t))), '外す節の見つけ方が、残すと決めた節の見出しを外さない');
  /* ★2026-10-09 古い錠前の付いていた節は、台帳とこの検査の両方が「外す」と知っている */
  ok(['ANA 機種別・路線別 年収差'].every(t => DROP_H2.test(t) && GONE_H2.test(t) && !keep.some(r => r.h2.test(t))), '錠前の付いていた「機種別・路線別 年収差」の節は、外す側に入っている（台帳とこの検査の両方）');
  /* ★2026-10-09 「よくある質問」も外す側（オーナーの判断）。台帳とこの検査の両方が知っている。 */
  ok(['JALのパイロットについてよくある質問', 'エティハド航空 パイロット よくある質問'].every(t => DROP_H2.test(t) && GONE_H2.test(t) && !keep.some(r => r.h2.test(t))), '「よくある質問」の節は、外す側に入っている（台帳とこの検査の両方）');
  /* 「よくある質問」を書く道具（gen-faq.mjs）が、この5社を飛ばす。飛ばさないと、流した日に節と構造化データが戻る
     （戻った節は次の作り直しで外れるが、そのあいだに出荷すれば本番に出る）。
     見るだけの切り替え（--dry）で流す ＝ 1文字も書かない。⚠️ --check は書き込む。使わない。 */
  {
    let out = '';
    try { out = execFileSync(process.execPath, ['gen-faq.mjs', '--dry'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { out = `${e.stdout || ''}\n(流せなかった) ${e.message}`; }
    const rows = [...out.matchAll(/^\s*(\S+) ja ([a-z0-9-]+)/gm)].map(m => [m[1], m[2]]);
    const marks = FIVE.map(s => rows.filter(r => r[1] === s).map(r => r[0]).join(''));
    ok(rows.length > 50 && marks.every(x => x === '-'), '「よくある質問」を書く道具が、この5社を飛ばす（流しても節が戻らない）', FIVE.map((s, i) => `${s}:${marks[i] || '行なし'}`).join(' ') + ` ／ 日本語の行 ${rows.length}`);
  }
}

head('pv-gg.css（Give & Get のボタンの形は、ここに1つだけ）');
{
  const GGC = noCssCmt(read('pv-gg.css'));
  const rule = sel => { const m = GGC.match(new RegExp('(?:^|\\})\\s*' + sel.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : null; };
  const base = rule('.pv-gg') || '', line = rule('.pv-gg-t > span') || '', box = rule('.pv-gg-t') || '';
  ok(!!rule('.pv-gg') && !!rule('.pv-gg-t') && !!rule('.pv-gg-t > span'), 'pv-gg.css に、ボタン・字の箱・1行ずつの3つの決まりが在る');
  ok(/justify-content:center/.test(base) && /align-items:center/.test(base) && /text-align:center/.test(base) && /text-align:center/.test(box) && !/text-align:\s*(left|start)/.test(GGC),
     'ボタンの字は2行ともまんなか（左へ寄せる決まりがどこにも無い）');
  ok(/font:inherit/.test(line) && /opacity:1\b/.test(line) && !/font-size|font-weight|color\s*:/.test(line.replace(/font:inherit/, '')),
     '上の行を小さく・薄くしない（2行とも、ボタンと同じ大きさ・太さ・濃さ）', line);
  ok(/word-break:keep-all/.test(line) && /overflow-wrap:anywhere/.test(line), '長い言葉は語の切れ目でだけ折る（語の途中で折らない・語1つより狭い箱でも、はみ出さない）', line);
  ok(/border-radius:999px/.test(base) && /font-size:16px/.test(base) && /font-weight:600/.test(base) && /min-height:54px/.test(base) && /padding:8px 26px/.test(base),
     'ボタンは丸い形・16px・太さ 600・高さ 54px 以上・上下 8px／左右 26px の余白', base.slice(0, 200));
  ok(['.pv-gg:hover', '.pv-gg:active', '.pv-gg:focus-visible'].every(x => rule(x) !== null), '押せるものの状態（hover・active・focus-visible）が在る');
  ok([...GGC.matchAll(/transition\s*:\s*([^;}]+)/g)].every(m => m[1].replace(/\([^)]*\)/g, '').split(',').every(x => /^(none|transform)\b/.test(x.trim()))), '動かすのは transform だけ（transition-all を使わない）');
  ok(!/@media[^{]*(max|min)-width/.test(GGC), '置き場や画面の幅ごとの大きさを足していない（狭い箱では字が折れて、まんなかに収まる）');
  /* 形の決まりは pv-gg.css だけ。ほかの2枚が、置き場ごとに大きさ・色・寄せ方を足していない */
  /* ★2026-10-09 @media／@container の囲みの中に書かれた決まりも見る。
     前は「{ の手前の字」を1つの名前として読んでいたので、囲みの最初の決まりは「@media … .pv-gg」と読まれて素通りしていた。
     囲みを内側から順にほどいて（中身だけを残して）から、決まりの名前を1つずつ読む。 */
  const flatCss = css => { let s = css, prev; do { prev = s; s = s.replace(/@[^{};]+\{((?:[^{}]|\{[^{}]*\})*)\}/g, (m, inner) => inner); } while (s !== prev); return s; };
  const ggTouch = css => [...flatCss(css).matchAll(/([^{}]+)\{[^}]*\}/g)].map(m => m[1].trim()).filter(sel => /\.pv-gg\b|\.pvg-gg-[km]\b|\.crl-cta-[km]\b/.test(sel));
  ok(same(ggTouch('.a{b:c}@media (max-width:400px){ .pv-gg{padding:0} .x{y:z} }@container pvg (max-width:300px){ @media (min-width:1px){ .pvg-rv .pvg-gg-m{font-size:12px} } }'), ['.pv-gg', '.pvg-rv .pvg-gg-m']),
     'この検査は、@media や @container の囲みの中（二重の囲みも）に書かれたボタンの決まりも見つけられる');
  const others = [['pv-glance.css', CSSC], ['career-live.css', noCssCmt(read('career-live.css'))]].flatMap(([f, css]) => ggTouch(css).map(sel => `${f}: ${sel}`));
  ok(!others.length, 'ボタンの中身に触る決まりが、pv-gg.css のほかに無い（置き場ごとに形を変えない・画面の幅ごとの囲みの中も見る）', others.join(' ／ '));
  /* 3つの書き手が、同じ形（class="pv-gg" と字の箱 pv-gg-t）を書く */
  const live = noJsCmt(read('career-live.js')), ui2 = noJsCmt(read('airlines/airline-reviews-ui.js'));
  ok(/var a = el\('a', 'pv-gg'\);/.test(live) && /el\('span', 'pv-gg-t'\)/.test(live), '給与の1枚の入口（career-live.js）は pv-gg の形');
  ok(ui2.includes('\'<button type="button" class="pv-gg" onclick="if(window.openReviewModal)openReviewModal()">\'') && ui2.includes('<span class="pv-gg-t">'), '口コミの一覧の錠前（airline-reviews-ui.js）は pv-gg の形');
  /* ★2026-10-09 「続きを読む」の小窓（鍵の無い人が押した時）も、同じボタンを1つ置く。色を直書きした古い板と橙のボタンを運ばない。 */
  const rmg = (ui2.match(/function readMoreGateTabbed\(\) \{[\s\S]*?\n  \}/) || [''])[0];
  ok(rmg.includes("unlockBtn('')") && !/#[0-9a-f]{3,6}\b|rgba?\(/i.test(rmg) && !/btn-review-post/.test(rmg),
     '「続きを読む」の小窓（タブのあるページ）も、同じ pv-gg のボタン1つ・色を直書きしない', rmg ? '' : '書いている所が見つからない');
  for (const s of FIVE) ok((PAGES[s].match(/<link rel="stylesheet" href="\.\.\/pv-gg\.css\?v=[0-9a-f]{8}">/g) || []).length === 1, `${s}: pv-gg.css を1回だけ読んでいる`);
}

head('見せる決まり（決めるのはサーバの1か所。写しを持たない）');
{
  /* 誰に何を見せるかを決めるのは db/contrib.sql の pv_contrib_sees の1か所。画面も、SQL の読む口も、区分や質問の一覧を自分で持たない
     （持つと、決まりを変えた時に片方だけ古いまま残る ＝ 見せないはずの人に出る）。
     補足の束の `q.section as topic` は、話題の名前を返しているだけで決まりではない ＝ 下の3つの形には当たらない。 */
  const LIVE = read('career-live.js'), SQLS = read('db/contrib.sql') + '\n' + read('db/work-months.sql');
  const found = [
    ...["'roster'", "'career'", "'benefits'", "'time_off'", 'section'].filter(w => LIVE.includes(w)).map(w => `career-live.js: ${w}`),
    ...(read('pv-contrib.js').includes('PAY_SECTIONS') ? ['pv-contrib.js: PAY_SECTIONS'] : []),
    ...['p_section', 'section in (', 'section not in ('].filter(w => SQLS.includes(w)).map(w => `SQL: ${w}`),
  ];
  ok(!found.length, '見せる決まりの写しを、画面にも SQL の読む口にも持っていない', found.join(' ／ '));
}
head('career-live.js（読む人が替わった時だけ聞き直す）');
{
  const LJ = noJsCmt(read('career-live.js'));
  const body = (LJ.match(/\n  function setUid\([^)]*\) \{\n([\s\S]*?)\n  \}\n/) || [])[1] || '';
  ok(/drop\('fact:'\)/.test(body) && /reset\(\[[^\]]*'fact'[^\]]*'cmp-facts'[^\]]*\]\)/.test(body),
    '読む人が替わったら、集計も聞き直す（setUid が fact: を捨て、fact / cmp-facts を描き直す）');
  ok(!/\bborn\b|\bstale\(|GATED_KEYS|GATED_KINDS|FRESH_MS|visibilitychange/.test(LJ),
    '時間で聞き直す仕掛けを career-live.js に入れていない（聞き直すのは読む人が替わった時だけ）');
  ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(LJ),
    '集計を端末に書き残す口を career-live.js に持たせていない');
}
head('集計の欄が聞く質問（出荷した HTML の data-keys）');
{
  /* M6 5社のページと career.html の、集計の欄（data-live="fact"）。
       ・どの欄も、聞く質問（data-keys）を1つ以上持つ（1つも無い欄は、画面で「いま読み出せません」になる）
       ・どの質問も、質問の台帳（pv-conditions.json）に在る
       ・1ページの質問は、合わせて 120 まで（集計の口は、開いている人が聞いても、それより多いと断る ＝ そのページの集計の欄がぜんぶ読めなくなる）
       ・2社を並べる欄（data-live="cmp-facts"・career.html に1つ）は、自分の質問を持たないか、持つなら、同じページの集計の欄が聞く質問だけ
         （ページが聞いていない質問を並べようとすると、その欄は「いま読み出せません」になる）
     judge ＝ 1ページ分の HTML の字から、破れている所の文を返す（空なら全部守れている）。渡された字のほかは、何も読まない。
       ledger ＝ 台帳に在る質問の名前・cap ＝ 1ページの上限・own ＝ そのページが、2社を並べる欄を持つはずか。 */
  const judge = (html, ledger, cap, own) => {
    const faults = [], all = new Set();
    const tags = live => [...html.matchAll(/<div class="crl"[^>]*>/g)].map(m => m[0]).filter(t => t.includes(` data-live="${live}"`));
    const keysOf = tag => ((/\bdata-keys="([^"]*)"/.exec(tag) || [])[1] || '').split(',').map(k => k.trim()).filter(Boolean);
    const facts = tags('fact'), cmp = tags('cmp-facts');
    if (!facts.length) faults.push('集計の欄が1つも無い');
    /* 欄の書き方が変わって、上の読み方から漏れた欄が無いこと（字としての数と合う） */
    if (html.split('data-live="fact"').length - 1 !== facts.length) faults.push(`集計の欄を ${facts.length}つ読んだが、ページには data-live="fact" が ${html.split('data-live="fact"').length - 1}か所在る`);
    for (const [i, tag] of facts.entries()) {
      const keys = keysOf(tag);
      if (!keys.length) faults.push(`${i + 1}つめの集計の欄が、聞く質問を1つも持たない`);
      for (const k of keys) { all.add(k); if (!ledger.has(k)) faults.push(`${i + 1}つめの集計の欄の質問 ${k} が、台帳に無い`); }
    }
    if (all.size > cap) faults.push(`1ページの質問が ${all.size}（多くて ${cap}）`);
    if (cmp.length !== (own ? 1 : 0)) faults.push(`2社を並べる欄が ${cmp.length}つ（あるべき ${own ? 1 : 0}）`);
    for (const tag of cmp) for (const k of keysOf(tag)) if (!all.has(k)) faults.push(`2社を並べる欄の質問 ${k} を、同じページの集計の欄が聞いていない`);
    return faults;
  };
  for (const [name, html, own] of [...FIVE.map(s => [`${s}`, PAGES[s], false]), ['career.html', read('career.html'), true]]) {
    const f = judge(html, QID, 120, own);
    ok(!f.length, `${name}: 集計の欄は、どれも聞く質問を持つ・質問はどれも台帳に在る・1ページで 120 まで${own ? '・2社を並べる欄は、同じページの欄が聞く質問のほかを並べない' : ''}`, f.slice(0, 6).join(' ／ '));
  }
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
     mode 'rows'  … 鍵の無い人に返る、伏せた行（この会社に7件・ほかの会社に2件）＋待遇の集計に、検査用の行（FACT_ROWS と BEN_ROWS）
     mode 'rated' … 鍵の無い人に返る、点数の付いた口コミ3件（本文は無い。在るのは書かれた欄の名前と先頭の抜粋だけ）
     mode 'rated404' … 口コミは 'rated' と同じ・要約の口だけ 404（＝ いまの本番の形。要約の欄は出ず、下の欄の錠前の1行が見える）
     mode 'off'   … 全部 500 ＝「読めない時」
     mode 'facts404' … 集計の口（pv_contrib_facts）だけ 404 ＝ 口がまだ無い時（ほかは 'empty' と同じ）
     mode 'give'  … ログインも給与の提出も済んでいて、自分の会社への回答が足りない人：集計・月の勤務・補足の口は状態の1語だけ・答えるカードの口が、カードの中身を返す
   口コミの要約の口（pv_review_summary）は、本番にまだ無い（2026-10-07）。無い時に本物のサーバーが返すのは 404 なので、
   'empty'・'rows'・'rated404' では 404 を返す ＝ 画面は要約の欄に何も出さない（作った文で埋めない）。
   'rated' の時だけ「鍵の無い人への返事」を返す。わざと要約の文を混ぜる（画面が1文字も出さないことを見る）。 */
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const PAY_RE = /\/rest\/v1\/rpc\/pv_pay_rows$/;
/* ホテルの欄だけ、場面ごとに返事を差し替えられる（seen.stay）。運営の公開・却下は、送られた中身を控える（seen.mod）。
   ふだんは下の STUB のまま ＝ 鍵の1行。差し替えるのは「開いた時の画面」を見る1場面だけ。 */
const STAY_RE = /\/rest\/v1\/rpc\/pv_stays$/, STAY_MOD_RE = /\/rest\/v1\/rpc\/pv_stay_moderate$/;
/* 待遇の集計（pv_contrib_facts）。ふだんは未ログインへの返事（状態の1語）。'rows' の時だけ、鍵の無い会員への返事
   ＝ 状態は 'locked'。わざと下の行を付けて返す（サーバーが間違えて送ってきても、画面が1行も出さないことを見る）。
   ★これは絵の検査。立場ごとに何が返るか・「最多」の決め方（lead）が正しいかは、本物の SQL を通す側
     （db/test-contrib.mjs・assert-contrib.mjs）が見る。
   ⚠️ 検査のために作った行で、本物の集計ではない（人数も答えも、この検査のファイルの中にしか無い）。
   FACT_ROWS の9行は「ひとつ教えて」のカードだけが持つ質問・BEN_ROWS の3行は待遇の板だけが持ちうる質問。
   行の形は、集計の口が開いている人に返す1件（db/contrib.sql の pv_contrib_facts）のとおり ──
     n ＝「わからない」のほかの答えを入れた人の数・ym ＝ 最後に確かめられた月・
     lead ＝「最多」と書く答えの符号の並び。決めるのはサーバー（決め方は pv_contrib_facts の中の説明の1か所。ここへ写さない）。
            符号の順で届く。空の並び ＝ 回答が分かれている／null ＝ 数の質問など。答えごとの人数は、返事に無い。
   want ＝ その行から画面に出るはずの形。検査の中だけの鍵で、返事には載らない（wire が、口の返す鍵だけを載せる）。
     lead   … その答えの名前＋「最多」（2つ在るのは、選べるだけ選ぶ質問で並んだ時。画面は台帳の並びで出す）
     split  … lead が空 ＝ 答えの名前を出さず「回答が分かれています」
     median … 数の中央値＋単位＋「中央値」
     none   … 行を出さない（9行め：lead が無いのに、top_code と答えごとの人数だけ在る ＝ 本物の口は返さない形（bogus）。
              届いても、そこから答えを決めない。
              着陸手当の額：通貨つきの質問で、どの欄も指していない。本物は通貨つきの中央値を返さないが、
              ここではわざと数字を入れてある ＝ 届いても画面に出ないことを見る）
   答えの名前は、質問の台帳（pv-conditions.json）から引く。台帳から消えると、その行は画面に出ない。 */
const FACT_RE = /\/rest\/v1\/rpc\/pv_contrib_facts$/;
const FACT_ROWS = [
  { question_id: 'commuting_taxi_cost', kind: 'choice', n: 3, lead: ['company_full'], median_num: null, ym: '2026-08', want: { lead: ['company_full'] } },
  { question_id: 'staff_travel_cabin', kind: 'choice', n: 6, lead: ['if_available'], median_num: null, ym: '2026-09', want: { lead: ['if_available'] } },
  { question_id: 'upgrade_years', kind: 'num', n: 11, lead: null, median_num: 9.5, ym: '2026-09', want: { median: 9.5 } },
  { question_id: 'commuting_taxi_where', kind: 'choice', n: 3, lead: [], median_num: null, ym: '2026-10', want: { split: true } },
  { question_id: 'staff_travel_booking', kind: 'choice', n: 4, lead: [], median_num: null, ym: '2026-09', want: { split: true } },
  { question_id: 'upgrade_order', kind: 'choice', n: 3, lead: ['seniority'], median_num: null, ym: '2026-07', want: { lead: ['seniority'] } },
  { question_id: 'staff_travel_standby_family', kind: 'multi', n: 3, lead: ['partner', 'self'], median_num: null, ym: '2026-09', want: { lead: ['self', 'partner'] } },
  { question_id: 'staff_travel_confirmed_family', kind: 'multi', n: 3, lead: ['self'], median_num: null, ym: '2026-09', want: { lead: ['self'] } },
  { question_id: 'commuting_taxi_cap', kind: 'choice', n: 3, top_code: 'no_cap', answer_dist: { no_cap: 3 }, median_num: null, ym: '2026-08', bogus: ['top_code', 'answer_dist'], want: { none: true } },
];
const BEN_ROWS = [
  { question_id: 'landing_pay', kind: 'choice', n: 3, lead: ['fixed'], median_num: null, ym: '2026-10', want: { lead: ['fixed'] } },
  { question_id: 'landing_pay_unit', kind: 'choice', n: 4, lead: [], median_num: null, ym: '2026-10', want: { split: true } },
  { question_id: 'landing_pay_amount', kind: 'num', n: 3, lead: null, median_num: 1500, ym: '2026-10', want: { none: true } },
];
/* サーバーが間違えて送ってきても画面が出さないことを見るための行（聞いてもいない質問）。この数字は画面に出てはいけない。 */
const LEAK_ROW = { question_id: 'zz_not_asked', kind: 'num', n: 99, lead: null, median_num: 77.7, ym: '2026-09' };
/* 返事に載せる形。本物の口が返す鍵（FACT_KEYS ＝ SQL から読んだもの）だけを載せる ＝ 検査の中だけの鍵（want・bogus）は落ちる。
   bogus に名指しした鍵だけは、本物が返さなくても、わざと載せる。 */
const wire = f => Object.fromEntries([...FACT_KEYS.filter(k => k in f), ...(f.bogus || [])].map(k => [k, f[k]]));
const SENT = [...FACT_ROWS, ...BEN_ROWS, LEAK_ROW];
/* 状態の1語だけの返事（開いていない人に、本物の口が返す形）。語は、書かずに組み立てる。 */
const stateBody = word => JSON.stringify({ ok: true, state: word });
const factBody = mode => (mode === 'rows'
  ? JSON.stringify({ ok: true, state: 'locked', facts: SENT.map(wire) })   // 鍵の無い会員。行が付いてきても、画面は1行も出さない
  : mode === 'give' ? stateBody('give')                                    // 自分の会社への回答が足りない人（状態の1語だけ）
  : JSON.stringify({ ok: true, state: 'login' }));                         // 未ログイン
/* 返事に付けた行から作る「出てはいけない字」（行を直せば一緒に変わる）。
   LEAK_PAGE … ページの字（innerText）にも欄にも無いこと／LEAK_SLOT … 欄（.crl）の字に無いこと（「3人」はページの地の文に在る）。 */
const LEAK_PAGE = ['9.5', '77.7', `${LEAK_ROW.n}人`];
const LEAK_SLOT = [...new Set([...SENT.filter(f => f.median_num != null).map(f => String(f.median_num)), ...SENT.map(f => `${f.n}人`)])];
/* 画面の1行が、検査用の1行（f）から出るはずの形か。答えの名前・質問の字・単位は台帳から引く（ここへ書き写さない）。
   印（r2〜r8）は、落ちた時にどの約束が破れたかを読むためのもの。
     r2 最多の行：答えの名前＋「最多」          r3 分かれた行：「回答が分かれています」・「最多」も「中央値」も、答えの名前も無い
     r4 最多が2つ並んだ行（選べるだけ選ぶ質問）：台帳の並びで「、」でつなぐ＋「最多」      r5 数の行：数字＋単位＋「中央値」
     r7 人数は「回答 N人」の1つだけ（N はその質問に答えた人の数。「その答えを選んだ人の数」と読める素の「N人」にしない）
     r8 小さい字は［最多か中央値］・回答 N人・年月 だけ。行のどこにも、字にも属性にも、答えごとの人数を置かない */
const SPLIT_TEXT = '回答が分かれています';
const factRowBad = (r, f, at) => {
  const q = QBY.get(f.question_id), W = f.want, bad = [], say = (id, t) => bad.push(`${id} ${at}: ${t}`);
  const people = `回答 ${f.n}人`, d = /^(\d{4})-(\d{2})/.exec(f.ym), month = `${d[1]}年${Number(d[2])}月`;
  const names = (q.choices || []).map(c => c.ja);
  const how = W.split ? null : W.median != null ? '中央値' : '最多';
  const v = W.split ? SPLIT_TEXT : W.median != null ? `${W.median}${q.num.ja}` : q.choices.filter(c => W.lead.includes(c.code)).map(c => c.ja).join('、');
  const id = W.split ? 'r3' : W.median != null ? 'r5' : W.lead.length > 1 ? 'r4' : 'r2';
  if (!r.on) say(id, '見えていない');
  if (r.v !== v) say(id, `答えの字「${r.v}」（あるべき「${v}」）`);
  if (how && !same(r.how, [how])) say(id, `「${how}」の字が無い（${r.how.join('・') || '無し'}）`);
  if (W.split) {
    if (r.how.length || /最多|中央値/.test(r.ans)) say(id, `分かれた行に「最多」「中央値」が在る（${r.ans}）`);
    const hit = names.filter(n => r.ans.includes(n));
    if (hit.length) say(id, `分かれた行に、答えの名前が在る（${hit.join('・')}）`);
  }
  const ppl = r.m.filter(x => /人/.test(x));
  if (ppl.length !== 1 || ppl[0] !== people) say('r7', `人数の字「${ppl.join('・')}」（あるべき「${people}」の1つだけ）`);
  const items = [...(how ? [how] : []), people, month];
  if (!same(r.m, items)) say('r8', `小さい字「${r.m.join('｜')}」（あるべき「${items.join('｜')}」）`);
  if (squash(r.text) !== squash(q.ja.label + v + items.join(''))) say('r8', `行に、質問・答え・小さい字のほかの字が在る「${r.text}」`);
  const attrs = r.attrs.filter(([n, val]) => n !== 'class' || /\d/.test(val));
  if (attrs.length) say('r8', `行に、class のほかの属性・数字の入った属性が在る（${attrs.map(a => a.join('=')).join(' ')}）`);
  return bad;
};
/* ページの中で、集計の欄（sel）の行を読む。attrs ＝ 行とその中の要素が持つ属性ぜんぶ（字に出なくても、属性に数が入っていれば分かる）。 */
const factRowsOf = (p, sel) => p.evaluate(sel => {
  const vis = el => !!el && el.getClientRects().length > 0, tx = el => (el ? el.textContent : '').trim();
  return [...document.querySelectorAll(sel + ' .crl-fact')].map(r => ({
    on: vis(r), k: tx(r.querySelector('.crl-fact-k')), v: tx(r.querySelector('.crl-ans-v')), ans: tx(r.querySelector('.crl-ans')), text: tx(r),
    m: [...r.querySelectorAll('.crl-ans-m > span')].map(tx), how: [...r.querySelectorAll('.crl-how')].map(tx),
    attrs: [r, ...r.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => [a.name, a.value])),
  }));
}, sel);
/* 開いている人の画面で、集計の行を見る4本（r1〜r8 と、待遇の板の集計）。鍵の無い会員の場面（runRows）では行が1つも出ないので、
   ここへ出してある。呼ぶのは、開いた返事を返す場面だけ（GM9）。4つの ok は、runRows に在った時の字のまま。 */
async function digestRowsOk(p, tag, sel, keys) {
  const rows = await factRowsOf(p, sel);
  const want = FACT_ROWS.filter(f => keys.includes(f.question_id)).sort((a, b) => keys.indexOf(a.question_id) - keys.indexOf(b.question_id));
  /* 行の中身。出す行は、検査用の行のうち「出さない」（want.none）のほか全部・欄が持つ質問の並びのまま。
     r1 行の数（いちばん多い答えが並んだ行も、消さずに「回答が分かれています」で出す）・r6 出さない行の質問の字が、どの行にも無い。
     r2〜r8 は factRowBad。 */
  const shown = want.filter(f => !f.want.none), rb = [];
  if (rows.length !== shown.length) rb.push(`r1 回答の行 ${rows.length}（あるべき ${shown.length}）：${rows.map(r => r.k.slice(0, 10)).join('｜')}`);
  for (const f of want.filter(f => f.want.none)) if (rows.some(r => r.k === QBY.get(f.question_id).ja.label)) rb.push(`r6 出さないはずの行が在る「${QBY.get(f.question_id).ja.label}」`);
  for (const [i, f] of shown.entries()) {
    const r = rows.find(x => x.k === QBY.get(f.question_id).ja.label);
    if (!r) rb.push(`r1 ${i + 1}行め: 「${QBY.get(f.question_id).ja.label}」の行が無い`);
    else rb.push(...factRowBad(r, f, `${i + 1}行め`));
  }
  if (rows.length === shown.length && !same(rows.map(r => r.k), shown.map(f => QBY.get(f.question_id).ja.label))) rb.push('r1 行の並びが、欄が持つ質問の並びと違う');
  const of = (...ids) => rb.filter(b => ids.some(id => b.startsWith(id + ' ')));
  ok(!of('r1', 'r2', 'r3', 'r4', 'r5', 'r6').length, `${tag}: 集まった回答の行 ── いちばん多い答えが1つの時だけ、その名前に「最多」（選べるだけ選ぶ質問で並んだ時は、並んだ答えぜんぶ）・並んだ時は「${SPLIT_TEXT}」・数の質問は「中央値」・読めない行は出さない`, of('r1', 'r2', 'r3', 'r4', 'r5', 'r6').join(' ／ '));
  ok(!of('r7').length, `${tag}: 集まった回答の人数は、どの行も「回答 N人」の1つだけ（N ＝ その質問に答えた人の数）`, of('r7').join(' ／ '));
  ok(!of('r8').length, `${tag}: 集まった回答の行に在るのは 質問・答え・［最多か中央値］・回答 N人・年月 だけ ── 答えごとの人数は、字にも属性にも無い`, of('r8').join(' ／ '));
}
/* 待遇の板の集計の欄（給与・待遇のタブでは、タブが板を開いた形で出す ＝ ここでは押さずに読める）。
   検査用の BEN_ROWS のうち、欄が持つ質問の行だけが出る：着陸手当の有無 ＝ 答えの名前＋「最多」・
   数え方 ＝ いちばん多い答えが並んだ ＝「回答が分かれています」。
   額の質問は、返事に数字が入っていても行を出さない（どの欄も指していない。額は通貨が無いと出せない）。 */
async function benRowsOk(p, tag) {
  const up = await p.waitForFunction(() => {
    const pn = document.getElementById('pvg-p-benefits'), b = pn && pn.querySelector('.pvg-ans .crl[data-live="fact"]');
    return !!b && !pn.hidden && b.getClientRects().length > 0 && !/^(idle|loading)$/.test(b.dataset.state);
  }, { timeout: 15000 }).then(() => true, () => false);
  const rows = up ? await factRowsOf(p, '#pvg-p-benefits .pvg-ans') : [], all = up ? await factRowsOf(p, '.pvg') : [];
  const shown = BEN_ROWS.filter(f => !f.want.none), bad = [];
  if (!up) bad.push('待遇の板の集計の欄が、出てこない／落ち着かない');
  else {
    if (!same(rows.map(r => r.k), shown.map(f => QBY.get(f.question_id).ja.label))) bad.push(`行「${rows.map(r => r.k).join('｜')}」（あるべき ${shown.length}行：${shown.map(f => f.question_id).join('・')}）`);
    else for (const [i, f] of shown.entries()) bad.push(...factRowBad(rows[i], f, `${i + 1}行め`));
    for (const f of BEN_ROWS.filter(f => f.want.none)) {
      if (all.some(r => r.k === QBY.get(f.question_id).ja.label)) bad.push(`出さないはずの行が在る「${QBY.get(f.question_id).ja.label}」`);
      if (f.median_num != null && all.some(r => r.text.includes(String(f.median_num)))) bad.push(`額の数字 ${f.median_num} が、行に出ている`);
    }
  }
  ok(!bad.length, `${tag}: 待遇の板の集計 ── 着陸手当の選ぶ質問は、3人そろえば出る（最多／${SPLIT_TEXT}／回答 N人）・額の質問は、数字が届いても出さない`, bad.join(' ／ '));
}
/* 答えるカードの読み出し（pv_contrib_give）。'give' の場面でだけ、カードの中身を返す：聞く会社は ANA（ANA のページでは JAL）
   ── カードが聞くのは読む人自身の会社で、開いているページの会社ではない。ほかの場面では、未ログインへの返事（状態の1語）。
   over ＝ その場面だけ差し替える欄（要る数を変える、など）。1回の返事ごと差し替える時は、場面が seen.give に { status, body } を置く。
   ⚠️ 検査のために作った中身で、本物の回答の数ではない（答えた数 3・要る数 5 は、この検査のファイルの中にしか無い）。 */
const GIVE_RE = /\/rest\/v1\/rpc\/pv_contrib_give$/;
const GIVE_ASK = ['reserve_duty', 'sick_leave'];
const giveOf = slug => (slug === 'ana' ? { airline: 'jal', name: 'JAL' } : { airline: 'ana', name: 'ANA' });
const giveBody = (mode, slug, over) => (mode === 'give'
  ? JSON.stringify({ ok: true, state: 'give', ...giveOf(slug), have: 3, need: 5, ask: GIVE_ASK, ...(over || {}) })
  : stateBody('login'));
const STUB = [
  [/\/rest\/v1\/rpc\/pv_reviews$/, '{"unlocked":false,"rows":[]}'],
  [PAY_RE, '{"ok":true,"state":"locked","rows":[]}'],
  [FACT_RE, ''],
  [GIVE_RE, ''],
  /* 月の勤務の集計と会員の補足：未ログインに本物のサーバーが返すのは、状態の1語だけ（db/work-months.sql・db/contrib.sql）。 */
  [/\/rest\/v1\/rpc\/pv_work_view$/, '{"ok":true,"state":"login"}'],
  [/\/rest\/v1\/rpc\/pv_contrib_notes$/, '{"ok":true,"state":"login"}'],
  /* ホテル：確認済みのパイロットでない人に本物のサーバーが返すのは、状態の1語だけ（db/stays.sql）。都市を選んだ時にだけ呼ぶ。 */
  [/\/rest\/v1\/rpc\/pv_stays$/, '{"ok":true,"state":"locked"}'],
];
/* 集計の口と同じ1語を返す、横の2つの口（月の勤務・会員の補足）。上の表の、未ログインへの1語を返す行から拾う（名前をもう一度書かない）。 */
const SIDE = STUB.filter(([, body]) => body === stateBody('login')).map(([re]) => re);
if (SIDE.length !== 2) throw new Error('検査の前提が崩れた（月の勤務と補足の口を、上の表から2つ拾えない）');
/* 未ログインの画面で、欄が落ち着く先。月の勤務と回答の集計は鍵（ログインと給与の提出で開く）・補足は欄ごと出さない・ほかは「まだありません」。 */
const CALM = x => (x.kind === 'work' || x.kind === 'fact' ? x.on && x.state === 'locked' : x.kind === 'notes' ? !x.on && x.state === 'empty' : x.on && x.state === 'empty');
/* ── 開いていない人に出る1行と入口 ──
   下の字は、画面に出るはずの字を検査が自分で持つもの（career-live.js から読み込まない ＝ あちらを変えたら、ここで赤くなる）。 */
const LOGIN_LINE = 'ログインと給与の提出で開きます', LOGIN_GO = 'ログイン';
/* いま見えている実データの欄（.crl）を、欄ごとに読む。ページの中で動く（外の変数を1つも使わない）。判定は外でする。
   見えている ＝ SETTLED と同じ決め方（箱を持っている）。at ＝ 欄の居場所（板の名前。「集まった回答」は got）。 */
function slotsSee() {
  const vis = e => !!e && e.getClientRects().length > 0, tx = e => (e ? e.textContent : '').replace(/\s+/g, '');
  return [...document.querySelectorAll('.crl[data-live]')].filter(vis).map(e => ({
    live: e.getAttribute('data-live'), state: e.getAttribute('data-state'), entry: e.getAttribute('data-entry'),
    keys: (e.getAttribute('data-keys') || '').split(',').filter(Boolean).length,
    at: e.closest('.pvg-got') ? 'got' : (e.closest('.pvg-panel') || {}).id || '',
    text: tx(e), lock: [...e.querySelectorAll('.crl-lock')].map(tx), rows: e.querySelectorAll('.crl-fact').length,
    links: [...e.querySelectorAll('a')].map(a => ({ text: tx(a), href: a.getAttribute('href') || '', cta: a.classList.contains('crl-cta'), login: a.hasAttribute('data-crl-login'), on: vis(a) })),
  }));
}
/* 欄の印（data-entry）が「入口は自分では出さない」（"0"）か「答えるカードだけ」（"give"）＝ ログインも給与の提出の入口も、この欄には出ない。 */
const STAMPED = x => x.entry === '0' || x.entry === 'give';
const SLOT_AT = { got: '集まった回答', 'pvg-p-work': '勤務', 'pvg-p-benefits': '待遇', 'pvg-p-living': '暮らし' };
const slotName = x => (x.live === 'work' ? '月の勤務' : `${SLOT_AT[x.at] || x.at || '?'}の集計`);
/* M1 未ログインの人に見えている、集計の欄（fact）と月の勤務の欄（work）。slots ＝ slotsSee() の答え・hash ＝ 住所の # に在るタブの名前（概要は ''）。
     ・どの欄も鍵の形・回答の行は無い・1行は LOGIN_LINE だけ（欄が持つ質問が何であっても、同じ1行）
     ・印の付いた集計の欄は、リンクを1つも持たない。そのかわり、同じ面の見えているどれかの欄に、ログインへのリンクが在る
     ・ほかの集計の欄と月の勤務の欄は、入口が「ログイン」の1つだけ（給与の提出の入口は出ない）。行き先はログインの画面で、
       タブを住所の # で開いている時は、同じタブへ戻る（%23<タブ>）
   返すのは、破れている約束の文（空なら全部守れている）。saw ＝ 判定した欄の種類を書き留める（1つも判定せずに緑、を防ぐ）。 */
function loginBad(slots, hash, saw) {
  const bad = [], on = slots.flatMap(x => x.links.filter(a => a.on));
  for (const x of slots.filter(x => x.live === 'fact' || x.live === 'work')) {
    const say = t => bad.push(`${slotName(x)}: ${t}`), bare = x.live === 'fact' && STAMPED(x);
    saw.add(x.live === 'work' ? 'month' : bare ? 'stamped' : 'own');
    if (x.state !== 'locked') say(`欄が ${x.state}（鍵の形のはず）`);
    if (x.rows) say(`回答の行が ${x.rows}つ`);
    if (!same(x.lock, [LOGIN_LINE])) say(`1行「${x.lock.join('｜')}」（あるべき「${LOGIN_LINE}」）`);
    if (bare) {
      if (x.links.length) say(`印（${x.entry}）の付いた欄に、リンクが ${x.links.length}つ（${x.links.map(a => a.text).join('｜')}）`);
      if (!on.some(a => /(^|\/)login\.html\?/.test(a.href))) say('同じ面の見えている欄に、ログインへのリンクが無い');
    } else {
      const a = x.links.find(a => a.login);
      if (x.links.length !== 1 || !a || x.links.some(a => a.cta)) say(`入口が「${LOGIN_GO}」の1つだけになっていない（リンク ${x.links.length}つ：${x.links.map(a => a.text + (a.cta ? '〔給与の入口の形〕' : '')).join('｜')}）`);
      if (a && !(a.on && a.text === LOGIN_GO)) say(`入口の字「${a.text}」${a.on ? '' : '（見えていない）'}`);
      if (a && !a.href.startsWith('../login.html?redirect=')) say(`「${LOGIN_GO}」の行き先 ${a.href}`);
      else if (a && (hash ? !a.href.endsWith('%23' + hash) : a.href.includes('%23'))) say(`「${LOGIN_GO}」が、いまのタブへ戻らない（${a.href}）`);
    }
    if (x.text !== LOGIN_LINE + x.links.map(a => a.text).join('')) say(`1行と入口のほかの字が在る「${x.text.slice(0, 60)}」`);
  }
  return bad;
}
/* M5 開いているタブ1つぶんの欄（slots ＝ slotsSee() の答え）を、約束に通す。who ＝ 読む人：'login' 未ログイン／'locked' 鍵の無い会員。
     a（R-a） 「匿名で給与を提出する」の入口は、見えているものが、1つのタブに多くて1つ
     b（R-b） 印の付いた欄（入口を自分では出さない欄）が鍵の1行を出している時、同じタブの見えているどれかの欄に、その人の入口が在る
              （未ログイン ＝ ログインの画面へのリンク／鍵の無い会員 ＝ このページの会社の、給与の提出へのリンク）
     c（R-c） 見えている集計の欄と月の勤務の欄の、鍵の1行が、どの欄も同じ字
     line     鍵の無い会員の時だけ：見えている集計の欄は、どれも PAY_LINE の1行（欄が持つ質問が何であっても）。
              その1行と、欄が自分で出す入口のほかに、字は無い ＝ 回答の行も、返事に付いてきた人数・中央値も、どのタブの欄にも出ない
              （偽のサーバーは、鍵の掛かった返事に行を付けて返している。「集まった回答」の欄だけを見ていると、ほかのタブの欄に出ても緑のまま）
   返すのは、約束ごとの、破れている所の文（空なら守れている）。判定するのは欄そのもの ＝ 欄がほかの板へ移っても、同じ約束のまま。 */
const PAY_LINE = '給与の提出で開きます', PAY_GO = '匿名で給与を提出する';
function tabRules(slots, s, who) {
  const out = { a: [], b: [], c: [], line: [] }, gated = slots.filter(x => x.live === 'fact' || x.live === 'work');
  const on = slots.flatMap(x => x.links.filter(a => a.on)), pay = on.filter(a => a.text === PAY_GO);
  if (pay.length > 1) out.a.push(`「${PAY_GO}」が ${pay.length}つ見えている`);
  const entry = who === 'login' ? on.some(a => a.href.includes('login.html')) : on.some(a => a.href.includes(`pay-report.html?airline=${s}`));
  if (!entry) for (const x of slots.filter(x => STAMPED(x) && x.lock.length)) out.b.push(`${slotName(x)}（印 ${x.entry}）が鍵の1行を出しているのに、同じタブの見えている欄に、${who === 'login' ? 'ログイン' : '給与の提出'}へのリンクが無い`);
  if (new Set(gated.map(x => x.lock.join('｜'))).size > 1) out.c.push(`鍵の1行が、欄ごとに違う（${gated.map(x => `${slotName(x)}「${x.lock.join('｜')}」`).join('・')}）`);
  if (who === 'locked') for (const x of gated.filter(x => x.live === 'fact' && !same(x.lock, [PAY_LINE]))) out.line.push(`${slotName(x)}の1行「${x.lock.join('｜')}」（あるべき「${PAY_LINE}」）`);
  if (who === 'locked') for (const x of gated.filter(x => x.live === 'fact' && same(x.lock, [PAY_LINE]) && (x.rows || x.text !== PAY_LINE + x.links.map(a => a.text).join('')))) out.line.push(`${slotName(x)}に、鍵の1行と入口のほかの字が在る${x.rows ? `（回答の行 ${x.rows}つ）` : ''}「${x.text.slice(0, 60)}」`);
  return out;
}
const M5_LABEL = {
  a: `「${PAY_GO}」の入口は、どのタブでも、見えているものが多くて1つ`,
  b: '入口を自分では出さない欄（印の付いた欄）が鍵の1行を出しているタブには、見えている欄のどれかに、その人の入口が在る',
  c: '同じタブに見えている集計の欄と月の勤務の欄は、鍵の1行が同じ字',
  line: `見えている集計の欄は、どのタブでも「${PAY_LINE}」の1行（その欄の入口のほかに、字も回答の行も無い）`,
};
const M1_SAW = ['stamped', 'own', 'month'], M1_SAW_NAME = { stamped: '印の付いた集計の欄', own: '入口を自分で出す集計の欄', month: '月の勤務の欄' };
const M1_LABEL = `未ログインの人 ── 見えている集計の欄と月の勤務の欄は、どれも「${LOGIN_LINE}」の1行。入口は「${LOGIN_GO}」の1つだけ（印の付いた欄は入口を持たず、同じ面の欄に在る）・給与の提出の入口は出ない・回答の行は無い`;
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
/* 職位と在籍年数は、投稿した人が書いた文字列がそのまま届く（2件め＝年数・3件め＝職位にタグを書いた形）。
   カードには字として出るだけで、働いてはいけない。 */
const HOSTILE = '<img src=x onerror=__pvgHit=1>';
const ratedRows = slug => RATED.map((sc, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`, airline: slug, orig_lang: 'ja', position: i === 2 ? HOSTILE : i ? 'first_officer' : 'captain',
  tenure_bucket: i === 1 ? HOSTILE : '', fleet: '', job_role: '', created_at: `2026-0${7 + i}-15T00:00:00Z`,
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

async function open(browser, slug, w, h, mode, pre) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const seen = { mode, asked: 0, unknown: new Set(), stay: null, stays: 0, stayAsked: 0, mod: [], modReply: '{"ok":true}', factCalls: [] };
  /* 答えるカードの口：give ＝ その場面だけ差し替える返事（{ status, body }。置かなければ giveBody）・giveCalls ＝ 呼ばれた回数。
     nav ＝ 並びを置いた場面でだけ、ページが移ろうとした行き先を控えて止める（カードのリンクが進む先を見る時）。 */
  seen.give = null; seen.giveCalls = 0; seen.nav = null;
  p.setDefaultTimeout(30000);
  p.on('pageerror', e => trouble.push(`${slug} ${w}: ${String(e.message).slice(0, 140)}`));
  p.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) trouble.push(`${r.status()} ${r.url()}`); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
  /* 動きの途中を測らない（動きを減らす設定の人の画面で測る）。 */
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  /* 開く前に置いておくもの（手元の鍵の控えだけが残っている人の場面）。ふだんは何も置かない。 */
  if (pre) await p.evaluateOnNewDocument(pre);
  await p.setRequestInterception(true);
  p.on('request', r => {
    let u; try { u = new URL(r.url()); } catch { return r.continue(); }
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return r.continue();
    /* 204 で返す ＝ ブラウザは、いまのページに居たままになる（abort だと、エラーのページへ移ってしまう） */
    if (seen.nav && r.isNavigationRequest() && r.frame() === p.mainFrame()) { seen.nav.push(u.pathname + u.search); return r.respond({ status: 204 }); }
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
      /* 集計の口がまだ無い時（本物のサーバーは 404 を返す）。 */
      if (seen.mode === 'facts404' && FACT_RE.test(u.pathname)) {
        return r.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"code":"PGRST202","message":"stub"}' });
      }
      /* 'give' の場面：月の勤務と会員の補足の口も、集計の口と同じ1語だけを返す（本物のサーバーは、3つの口で同じ1語を返す）。 */
      if (/^give/.test(seen.mode) && SIDE.some(re => re.test(u.pathname))) {
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: stateBody('give') });
      }
      const hit = seen.mode !== 'off' && STUB.find(([re]) => re.test(u.pathname));
      if (hit) {
        if (hit[0] === FACT_RE) {
          seen.factCalls.push(r.postData() || '');
          return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: factBody(seen.mode) });
        }
        if (hit[0] === GIVE_RE) {
          seen.giveCalls++;
          const g = seen.give || {};
          return r.respond({ status: g.status || 200, contentType: 'application/json', headers: cors, body: g.body || giveBody(seen.mode, slug) });
        }
        /* 'rows' の場面では、月の勤務の口も、鍵の無い会員への1語を返す（本物のサーバーが、給与を出していない会員に返す形）。 */
        const body = seen.mode === 'rows' && hit[0] === PAY_RE ? maskedBody(slug)
                   : /^rated/.test(seen.mode) && REV_RE.test(u.pathname) ? ratedBody(slug) : seen.mode === 'rows' && /\/rest\/v1\/rpc\/pv_work_view$/.test(u.pathname) ? '{"ok":true,"state":"locked"}' : hit[1];
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
          /* 下の欄の錠前の1行は「書かれている字」を読む（見えているかは locks が見る）。
             要約の欄が同じことを言っている時、この1行は隠れる ── 見えている字で読むと、隠した瞬間に null になる */
          lock: (() => { const x = e.querySelector('.crl-lock'); return x ? x.textContent.replace(/\s+/g, ' ').trim() : null; })(),
          /* 評価の箱の中で、いま見えている錠前の1行（同じ意味の行を2つ重ねていないかを見る） */
          locks: $$('.crl-lock', c).filter(on).map(x => x.textContent.replace(/\s+/g, ' ').trim()) }; })(),
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
      /* 件数・錠前の1行・行の束が、どこに置かれているか（見えていなければ null） */
      geo: Object.fromEntries([['count', '.crl-count'], ['lock', '.crl-lock'], ['ul', '.crl-rows']].map(([k, q]) => {
        const e = box.querySelector(q); if (!e || !on(e)) return [k, null];
        const r = e.getBoundingClientRect();
        /* 字が何行に組まれているか（絵は数えない）。札の最後の1文字だけが次の行へ落ちた形を捕まえる。 */
        const tops = [], w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) {
          if (!n.nodeValue.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const c of rg.getClientRects()) if (c.width > 0.5 && !tops.some(y => Math.abs(y - c.top) < 4)) tops.push(c.top);
        }
        return [k, { x: r.left, r: r.right, y: r.top, b: r.bottom, lines: tops.length }];
      })),
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
        return { cta: a.classList.contains('pv-gg'), text: k && m ? t(k) + '／' + t(m) : t(a), stacked: k && m ? k.getBoundingClientRect().bottom <= m.getBoundingClientRect().top + 1 : null, href: a.getAttribute('href') };
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
    for (const sh of document.styleSheets) { if (/\/(pv-glance|career-live|pv-gg)\.css/.test(sh.href || '')) walk(sh.cssRules); }
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
  /* 話題の札の見た目（測るだけ。判定は外でする）。色は、同じ場所に置いた見本（トークンをそのまま塗った箱）と並べて返す。 */
  G.plates = () => {
    const c = document.querySelector('.pvg-askc'), grid = c.querySelector('.pvg-topics');
    const box = el => { if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const pr = document.createElement('i');
    pr.style.cssText = 'position:fixed;left:-99px;top:0;color:var(--pv-accent-ink);background:var(--pv-ink-2)';
    c.closest('.pvg').appendChild(pr);
    const tok = { name: getComputedStyle(pr).color, meta: getComputedStyle(pr).backgroundColor };
    /* 札の地と枠のトークンも、同じ見本に塗って読む（色の値をここに書かない）。暗い画面の値は半透明 ＝ 札と同じ属性で読んで、字のまま比べる。 */
    pr.style.cssText = 'position:fixed;left:-99px;top:0;background:var(--pv-accent-soft);border-top:1px solid var(--pv-accent-line)';
    tok.soft = getComputedStyle(pr).backgroundColor; tok.line = getComputedStyle(pr).borderTopColor;
    pr.remove();
    const tile = c.querySelector('a.pvg-topic-a'), tchip = tile && tile.querySelector('.pvg-ico');
    return {
      flat: c.hasAttribute('data-flat'), card: getComputedStyle(c).backgroundColor, grid: box(grid), tok,
      topics: $$('details.pvg-topic', c).map(t => {
        const sum = t.querySelector(':scope > summary'), nm = sum.querySelector('.pvg-tp-n'), chip = sum.querySelector('.pvg-ico'), a = t.querySelector('.pvg-ask a');
        const cs = getComputedStyle(sum), cn = nm ? getComputedStyle(nm) : null, ca = a ? getComputedStyle(a) : null;
        /* 絵そのもの（線画）：箱の大きさ・透け具合（絵から札までを掛け合わせる）・線の色・その下の地の色。
           箱が在るだけでは「見えている」と言えない ── 透明でも、地と同じ色でも、箱は在る。 */
        const svg = chip && chip.querySelector('svg'), cv = svg ? getComputedStyle(svg) : null;
        let op = 1;
        for (let e = svg; e && e !== t; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        return { id: t.dataset.topic, open: t.open, sum: box(sum), body: box(t.querySelector(':scope > .pvg-body')), chip: chip && on(chip) ? box(chip) : null,
                 pic: svg && box(svg) ? { ...box(svg), op, vis: cv.visibility, ink: cv.stroke, under: getComputedStyle(chip).backgroundColor } : null,
                 bg: cs.backgroundColor, edge: parseFloat(cs.borderTopWidth) || 0, edgeInk: cs.borderTopColor, ink: cs.color, hover: sum.matches(':hover'),
                 name: cn && { fs: parseFloat(cn.fontSize), fw: +cn.fontWeight, ink: cn.color, sw: nm.scrollWidth, cw: nm.clientWidth },
                 q: ca && { fs: parseFloat(ca.fontSize), fw: +ca.fontWeight } };
      }),
      tile: tile && { box: box(tile), arrow: box(tile.querySelector(':scope > svg')), chip: box(tchip), pic: box(tchip && tchip.querySelector('svg')) },
    };
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
/* 話題の札（「ひとつ教えて」のカード）── 測ったものを、約束ごとに突き合わせる。
   rank ＝ 話題の名前が質問より先に読める（名前のほうが大きく、太い・濃い緑）。
   face ＝ 色だけで見分けさせない（地の色・枠・絵が在って、見えている）。色は「違って見える」だけでは通さない ──
          地は淡い緑（--pv-accent-soft）・枠は緑の線（--pv-accent-line）・絵は濃い緑（--pv-accent-ink）。ページが解いた値と突き合わせる
          （「カードと違う色」だけを見ていた頃は、札を白や灰色に塗り替えても緑のままだった）。
   row  ＝ 同じ行の札は高さも、その下の質問の頭もそろう・行は端から端まで札で埋まる・「ホテル・レストラン」は1行ぜんぶ。
   fit  ＝ 札は押せる高さ・名前が札からはみ出さない。
   tile ＝ 「ホテル・レストラン」の矢印は右端・左の絵は箱のまんなか。
   1行の札の数：狭い画面は1・広い画面は2・中身の箱が 1040px 以上で4（pv-glance.css の写し）。 */
const PLATE_COLS = { col: 1, side: 2, row: 4 };
function plateBad(pl, kind) {
  const B = { rank: [], face: [], row: [], fit: [], tile: [] }, near = (a, b) => Math.abs(a - b) <= 1;
  if (pl.topics.length !== 4 || !pl.grid || pl.topics.some(t => !t.sum || !t.name || !t.q)) {
    for (const k of Object.keys(B)) B[k].push(`話題の札・名前・質問の行のどれかが測れない（札 ${pl.topics.length}枚）`);
    return B;
  }
  for (const t of pl.topics) {
    const at = `「${t.id}」`;
    /* 日本語の字は 400／500／700 しか読み込んでいない ＝ 名前は 700・質問は 500 まで（600 は 700 で描かれて、名前と同じ太さになる）。 */
    if (!(t.name.fs >= t.q.fs + 2 && t.name.fw >= 700 && t.q.fw <= 500)) B.rank.push(`${at}: 名前（${t.name.fs}px・太さ ${t.name.fw}）と質問（${t.q.fs}px・太さ ${t.q.fw}）`);
    if (t.name.ink !== pl.tok.name) B.rank.push(`${at}: 名前の色 ${t.name.ink}（濃い緑は ${pl.tok.name}）`);
    if (!(alpha(t.bg) > 0 && t.bg !== pl.card)) B.face.push(`${at}: 地の色が無い（札 ${t.bg}・カード ${pl.card}）`);
    else if (t.bg !== pl.tok.soft) B.face.push(`${at}: 地が淡い緑でない（札 ${t.bg}・淡い緑は ${pl.tok.soft}）`);
    /* 枠と絵は「在る」だけでなく「見える」まで測る（透明な枠・地と同じ色の枠・透けた絵・地と同じ色の線は、在っても見えない）。
       絵の下の地 ＝ 絵の小さい箱の色。箱が透明なら、その下の札の地。 */
    if (t.edge < 1) B.face.push(`${at}: 枠が無い`);
    else if (!(alpha(t.edgeInk) > 0 && t.edgeInk !== t.bg)) B.face.push(`${at}: 枠が見えない（枠 ${t.edgeInk}・札の地 ${t.bg}）`);
    else if (t.edgeInk !== pl.tok.line) B.face.push(`${at}: 枠が緑の線でない（枠 ${t.edgeInk}・緑の線は ${pl.tok.line}）`);
    const k = t.pic, under = k && alpha(k.under) > 0 ? k.under : t.bg;
    if (!(t.chip && t.chip.w >= 20 && t.chip.h >= 20)) B.face.push(`${at}: 絵が見えていない`);
    else if (!(k && k.w >= 14 && k.h >= 14)) B.face.push(`${at}: 絵が小さすぎる（${k ? `${Math.round(k.w)}×${Math.round(k.h)}px` : '線画が無い'}）`);
    else if (!(k.op > 0 && k.vis === 'visible')) B.face.push(`${at}: 絵が透けていて見えない（透け具合 ${k.op}・${k.vis}）`);
    else if (!(/^rgba?\(/.test(k.ink) && alpha(k.ink) > 0 && k.ink !== under)) B.face.push(`${at}: 絵の線が見えない（線 ${k.ink}・その下の地 ${under}）`);
    else if (k.ink !== pl.tok.name) B.face.push(`${at}: 絵の線が濃い緑でない（線 ${k.ink}・濃い緑は ${pl.tok.name}）`);
    if (t.sum.h < 44) B.fit.push(`${at}: 高さ ${Math.round(t.sum.h)}px`);
    if (t.name.sw > t.name.cw + 1) B.fit.push(`${at}: 名前がはみ出す（字 ${t.name.sw}px・入れ物 ${t.name.cw}px）`);
  }
  const rows = [];
  for (const t of pl.topics) { const r = rows.find(x => near(x[0].sum.y, t.sum.y)); if (r) r.push(t); else rows.push([t]); }
  const cols = PLATE_COLS[kind];
  if (!same(rows.map(r => r.length), Array.from({ length: 4 / cols }, () => cols))) B.row.push(`1行に ${rows.map(r => r.length).join('・')}枚（${cols}枚ずつのはず）`);
  for (const r of rows) {
    const who = r.map(t => t.id).join('・');
    if (!r.every(t => near(t.sum.h, r[0].sum.h))) B.row.push(`${who}: 札の高さ ${r.map(t => Math.round(t.sum.h)).join('・')}px`);
    if (pl.flat && !r.every(t => t.body && r[0].body && near(t.body.y, r[0].body.y))) B.row.push(`${who}: 質問の頭 ${r.map(t => t.body ? Math.round(t.body.y) : '—').join('・')}`);
    if (!(near(r[0].sum.x, pl.grid.x) && near(r[r.length - 1].sum.r, pl.grid.r))) B.row.push(`${who}: 行が ${Math.round(r[0].sum.x)}〜${Math.round(r[r.length - 1].sum.r)}（箱は ${Math.round(pl.grid.x)}〜${Math.round(pl.grid.r)}）`);
  }
  const k = pl.tile;
  if (!(k && k.box && k.arrow && k.chip && k.pic)) { B.row.push('「ホテル・レストラン」が見えていない'); B.tile.push('入口・矢印・絵のどれかが見えていない'); return B; }
  if (!near(k.box.w, pl.grid.w)) B.row.push(`「ホテル・レストラン」の幅 ${Math.round(k.box.w)}px（箱は ${Math.round(pl.grid.w)}px）`);
  if (!(k.box.r - k.arrow.r >= 0 && k.box.r - k.arrow.r <= 14)) B.tile.push(`矢印が右端から ${Math.round(k.box.r - k.arrow.r)}px`);
  if (!(near(k.pic.x + k.pic.w / 2, k.chip.x + k.chip.w / 2) && near(k.pic.y + k.pic.h / 2, k.chip.y + k.chip.h / 2))) B.tile.push(`絵が箱のまんなかから横に ${Math.round(k.pic.x + k.pic.w / 2 - k.chip.x - k.chip.w / 2)}px`);
  return B;
}
/* 話題の札の字は、出荷した HTML のまま ── 回答が読めても・0件でも・読めなくても、札に数字や知らせが入らない
   （札の数は質問の数。回答の数は「集まった回答」の欄にだけ出る）。欄が落ち着いてから読む。 */
const PLATE_WORDS = Object.fromEntries(FIVE.map(s => [s, topicsOf(PART[s].glance).map(t => unesc(t.sum.replace(/<[^>]+>/g, '')))]));
async function plateWords(p, s, tag) {
  const st = await p.waitForFunction(() => { const c = document.querySelector('.pvg-askc .crl[data-live="fact"]'); return !!c && !/^(idle|loading)$/.test(c.dataset.state) && c.dataset.state; }, { timeout: 8000 }).then(h => h.jsonValue(), () => null);
  const now = await p.evaluate(() => [...document.querySelectorAll('.pvg-askc details.pvg-topic > summary')].map(x => x.textContent));
  ok(!!st && now.length === 4 && same(now, PLATE_WORDS[s]), `${tag}: 話題の札の字は、出荷した HTML と1文字も違わない（回答の欄がどう変わっても、札に数字や知らせが入らない）`, `回答の欄 ${st || '落ち着かない'}／${now.join('｜')}`);
}
const press = async h => { await h.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await h.click(); };
/* 質問の行に触れたまま押して、押しているあいだ縮んでいるかを測る（縮んでいれば ''・縮まなければ理由）。
   決まりの字を読む検査（上の「動きを消していない・言い直していない」）は、書き方が1つ違うだけで素通りする。ここは画面で起きたことを見る。
   「縮んだ」＝ 縦横が同じだけ小さくなり、上下左右にはずれていない形（触れただけの形は 1px 上へずれる ＝ 縮んでいない）。
   ⚠️ 離すのは押したのと同じ場所。押したまま外へ動かすと、ブラウザがリンクをつかんで運び始め、離したことがページへ届かない。
   同じ場所で離すと「押した」ことになるので、そのあいだだけ押したことをページへ渡さない（提出の面を開かせない）。 */
async function rowShrink(p, row) {
  if (!row) return '質問の行が無い（測れていない）';
  await row.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await row.hover();
  if (!(await row.evaluate(el => el.matches(':hover')))) { await p.mouse.move(0, 0); return '質問の行にマウスを載せても、触れた形にならない（測れていない）'; }
  await p.evaluate(() => { window.__pvgEat = e => { e.preventDefault(); e.stopImmediatePropagation(); }; addEventListener('click', window.__pvgEat, true); });
  let why = '';
  try {
    await p.mouse.down();
    const shrunk = await p.waitForFunction(el => { const m = /^matrix\(([\d.]+), 0, 0, ([\d.]+), 0, 0\)$/.exec(getComputedStyle(el).transform); return !!m && m[1] === m[2] && +m[1] < 1; }, { timeout: 3000 }, row).then(() => true, () => false);
    if (!shrunk) why = `触れたまま押しても縮まない（押しているあいだの形 ${await row.evaluate(el => getComputedStyle(el).transform)}）`;
  } finally {
    await p.mouse.up();
    await p.evaluate(() => { removeEventListener('click', window.__pvgEat, true); delete window.__pvgEat; });
    await row.evaluate(el => el.blur());
    await p.mouse.move(0, 0);
  }
  return why;
}
const hard =(pr, ms, what) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what}: ${ms / 1000}秒で終わらなかった`)), ms))]);

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
    ok(shown.length >= 5 && shown.every(CALM), `${tag}: 0件の時は、どの欄も「まだありません」（月の勤務と回答の集計は鍵）`, shown.map(x => `${x.kind}:${x.state}`).join(' '));
    ok(live.every(x => !NO_NUM.test(x.text)), `${tag}: 0件の時に、どの欄も数字・0・星を1つも出さない`, live.filter(x => NO_NUM.test(x.text)).map(x => x.text.slice(0, 30)).join(' ／ '));
    /* M1 未ログインの人の1行と入口。まず、開いた直後に見えている欄。板の中の欄は、下で板を1枚ずつ開いた所で同じ判定に通し、まとめて1行で言う。 */
    const m1 = [], m1Saw = new Set();
    for (const b of loginBad(await ev(slotsSee), '', m1Saw)) m1.push(`開いた直後 ── ${b}`);
    if (!m1Saw.size) m1.push('開いた直後に、集計の欄が1つも見えていない');
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
    /* 話題の札（質問の束の頭）。明るい画面と暗い画面の両方で測る（暗い画面は、色のトークンが差し替わったあとの形）。 */
    await plateWords(p, s, tag);
    {
      const B = plateBad(await ev(() => window.__pvg.plates()), kind), dark = [];
      const was = await ev(() => document.documentElement.getAttribute('data-theme'));
      try {
        await ev(() => document.documentElement.setAttribute('data-theme', 'dark'));
        const dk = await ev(() => window.__pvg.plates());
        for (const [k, list] of Object.entries(plateBad(dk, kind))) for (const x of list) B[k].push(`暗い画面 ${x}`);
        if (kind === 'col') {
          /* 触れた時（札を押せる、狭い画面だけ）。触れた時の字の色を言い直し忘れると、小さい字が、暗い画面で作り直していない緑に替わる
             （明るい画面では同じ緑なので、暗い画面でしか分からない）。 */
          const sum = await p.$('.pvg-askc details.pvg-topic > summary');
          /* 札が崩れていると、マウスを載せる所で投げることがある。ここで止めると、下の6行（どう崩れたか）が1つも出ない ＝ 受けて先へ進む。 */
          let hv = null;
          try {
            await sum.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
            await sum.hover();
            hv = await ev(() => window.__pvg.plates());
          } catch (e) { dark.push(`札にマウスを載せられない（測れていない）: ${String((e && e.message) || e).slice(0, 80)}`); }
          await p.mouse.move(0, 0);
          const t = hv && hv.topics[0];
          if (!t) { /* 上で書いた */ }
          else if (!t.hover) dark.push('札にマウスを載せても、触れた形にならない（測れていない）');
          else {
            if (t.name.ink !== hv.tok.name) dark.push(`触れた時の名前の色 ${t.name.ink}（濃い緑は ${hv.tok.name}）`);
            if (t.ink !== hv.tok.meta) dark.push(`触れた時の小さい字の色 ${t.ink}（灰色は ${hv.tok.meta}）`);
          }
        } else {
          /* 広い画面では札は押せず、触れるのは「ほか◯問」。ここも同じ話 ── 触れた時の色が、暗い画面で作り直していない緑
             （地とのコントラストが約3:1）に替わると読みにくくなる。「ほか◯問」は文字リンク（.pvg-link）の1つで、
             触れた時の色は文字リンクぜんぶの決まり（pv-glance.css の .pvg .pvg-link:hover）が決める ＝ ここが見ているのは、その決まり。
             「ほか◯問」が1つも無い時は測らない（在るべき束に無ければ、下の「質問の束」が落ちる）。 */
          const more = await p.evaluateHandle(() => [...document.querySelectorAll('.pvg-askc [data-pvg-askmore]')].find(b => b.getClientRects().length) || null);
          const btn = more.asElement();
          if (btn) {
            let hv = null;
            try {
              await btn.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
              await btn.hover();
              hv = await btn.evaluate(el => ({ hover: el.matches(':hover'), ink: getComputedStyle(el).color }));
            } catch (e) { dark.push(`「ほか◯問」にマウスを載せられない（測れていない）: ${String((e && e.message) || e).slice(0, 80)}`); }
            await p.mouse.move(0, 0);
            if (!hv) { /* 上で書いた */ }
            else if (!hv.hover) dark.push('「ほか◯問」にマウスを載せても、触れた形にならない（測れていない）');
            else if (hv.ink !== dk.tok.name) dark.push(`「ほか◯問」に触れた時の色 ${hv.ink}（濃い緑は ${dk.tok.name}）`);
          }
        }
        for (const t of dk.topics) if (t.ink !== dk.tok.meta) dark.push(`「${t.id}」: 小さい字の色 ${t.ink}（灰色は ${dk.tok.meta}）`);
      } finally {
        await ev(w0 => { const r = document.documentElement; if (w0 === null) r.removeAttribute('data-theme'); else r.setAttribute('data-theme', w0); }, was);
      }
      ok(!B.rank.length, `${tag}: 話題の名前が、質問より先に読める ── 名前は濃い緑で、質問より 2px 以上大きく、太い`, B.rank.slice(0, 4).join(' ／ '));
      ok(!B.face.length, `${tag}: 話題の札は、色だけで見分けさせない ── 淡い緑の地・緑の枠・濃い緑の絵が在って、見えている`, B.face.slice(0, 4).join(' ／ '));
      ok(!B.row.length, `${tag}: 話題の札の並び ── 同じ行の札は高さも質問の頭もそろう・行は端から端まで札で埋まる・「ホテル・レストラン」は1行ぜんぶの幅`, B.row.slice(0, 4).join(' ／ '));
      ok(!B.fit.length, `${tag}: 話題の札は 44px 以上の高さで、名前が札からはみ出さない`, B.fit.slice(0, 4).join(' ／ '));
      ok(!B.tile.length, `${tag}: 「ホテル・レストラン」の入口 ── 矢印は右端・左の絵は箱のまんなか`, B.tile.slice(0, 4).join(' ／ '));
      ok(!dark.length, `${tag}: 暗い画面でも、札の小さい字は灰色のまま${kind === 'col' ? '・触れても名前は濃い緑、小さい字は灰色のまま（作り直していない緑に替わらない）' : '・「ほか◯問」に触れても濃い緑のまま（作り直していない緑に替わらない）'}`, dark.slice(0, 4).join(' ／ '));
    }
    /* 質問の束（板を開く前に見る。広い画面は最初から開いた形・狭い画面は畳んだ形） */
    {
      const bad = [], a0 = await ev(() => window.__pvg.ask());
      /* 質問の行は、触れたまま押すと少し縮む。行が見えている時に測る（狭い画面は束を1つ開いたあと・広い画面は最初から）。
         測れなかった時（行が出ていない・載せられない）も理由を残す ── 黙って通さない。 */
      let shrink = null;
      const tryShrink = async () => { try { shrink = await rowShrink(p, await p.$('.pvg-askc details.pvg-topic .pvg-ask a')); } catch (e) { shrink = `測れていない: ${String((e && e.message) || e).slice(0, 80)}`; } };
      if (kind === 'col') {
        if (a0.flat || a0.topics.some(t => t.open)) bad.push('狭い画面なのに、束が最初から開いている');
        const sum = await p.$('.pvg-askc details.pvg-topic > summary');
        await press(sum);
        const a1 = await ev(() => window.__pvg.ask());
        if (!a1.topics[0].open) bad.push('束の見出しを押しても開かない');
        else if (a1.topics[0].shown !== a1.topics[0].n) bad.push(`開いた束に ${a1.topics[0].shown}／${a1.topics[0].n}問しか出ない`);
        if (a1.topics[0].open) await tryShrink(); else shrink = '束が開かないので、質問の行が出ていない（測れていない）';
        await press(sum);
        if ((await ev(() => window.__pvg.ask())).topics[0].open) bad.push('束の見出しをもう一度押しても閉じない');
      } else {
        if (!a0.flat || !a0.topics.every(t => t.open)) bad.push('広い画面なのに、束が開いた形になっていない');
        await ev(() => document.querySelector('.pvg-askc details.pvg-topic > summary').click());
        if (!(await ev(() => window.__pvg.ask())).topics[0].open) bad.push('開いた形の束が、見出しで閉じてしまう');
        await tryShrink();
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
      ok(shrink === '', `${tag}: 質問の行は、触れたまま押すと少し縮む（触れた時の決まりが、押した時の縮みを消していない）`, shrink || '');
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
        if (!calm || !lv.length || !lv.every(x => CALM(x) && !NO_NUM.test(x.text))) bad.push(`${c.id}: 開いた板の欄が落ち着かない ── 集計と月の勤務は鍵・補足は出さない（${lv.map(x => `${x.kind}:${x.state}:${x.on ? '見える' : '隠れる'}`)}）`);
        if (calm) for (const b of loginBad(await ev(slotsSee), '', m1Saw)) m1.push(`${c.id} を開いた形 ── ${b}`);
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
    /* M1 のまとめ：開いた直後と、3枚の板を開いた形。印の付いた欄・入口を自分で出す欄・月の勤務の欄の3つとも、どこかで判定している。 */
    for (const k of M1_SAW.filter(k => !m1Saw.has(k))) m1.push(`${M1_SAW_NAME[k]}を、1つも判定していない`);
    ok(!m1.length, `${tag}: ${M1_LABEL}（開いた直後・板を開いた形）`, [...new Set(m1)].slice(0, 6).join(' ／ '));

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

    /* ── 最後に、募集の1枚 ──
       募集は概要の中の1枚だけ（6つのタブに「採用」は無い）。右上の入口は、会社の募集ページを新しいタブで開く。
       ★2026-10-08 「募集要項を開く」（下の古い節へ寄るボタン）は、古い節ごと外した。
         古い節が残っていた頃は、上の1枚と下の節で、確かめた日の違う字が食い違っていた。
       ⚠️ ここに「タブを切り替えるボタン」を戻さない。無いタブへ切り替えると、どの面も選ばれず、
          ページの中身がぜんぶ消える（実際にそうなっていた）。 */
    {
      const j = await ev(() => {
        const on = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
        const card = document.querySelector('.pvg-jobs'), a = card && card.querySelector('.pvg-hd a.pvg-link');
        const ar = a && on(a) ? a.getBoundingClientRect() : null, cr = card && on(card) ? card.getBoundingClientRect() : null;
        return {
          cards: document.querySelectorAll('.pvg-jobs').length, on: on(card),
          text: a ? a.textContent.replace(/\s+/g, ' ').trim() : '', href: a ? a.getAttribute('href') : '',
          target: a ? a.getAttribute('target') : '', rel: a ? a.getAttribute('rel') : '',
          inside: !!ar && !!cr && ar.left >= cr.left - 1 && ar.right <= cr.right + 1 && ar.top >= cr.top - 1 && ar.bottom <= cr.bottom + 1,
          rows: card ? [...card.querySelectorAll('.pvg-dl > *')].filter(on).length : 0,
          old: [...document.querySelectorAll('[data-pvg-tab="jobs"]')].length,
          tab: window.PVGlance ? window.PVGlance.at() : '',
          faces: [...document.querySelectorAll('[data-pvg-pane]')].filter(on).length,
        };
      });
      const want = jobsLedger(s)[0];
      ok(j.cards === 1 && j.on && j.rows > 0 && j.tab === 'overview' && j.faces > 0, `${tag}: 募集の1枚は、概要に1つだけ・中身が出ている`, JSON.stringify(j));
      ok(j.text === '会社の募集ページ' && !!want && j.href === want.url && j.target === '_blank' && /\bnoopener\b/.test(j.rel || '') && j.inside,
        `${tag}: 募集の1枚の入口は「会社の募集ページ」── 台帳のいちばん上の資料を新しいタブで開く・カードからはみ出さない`, JSON.stringify(j));
      ok(j.old === 0, `${tag}: 「募集要項を開く」（タブを切り替えるボタン）が残っていない`, String(j.old));
    }
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
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
    await plateWords(p, s, tag);
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
    await plateWords(p, s, `${tag}・読み直したあと`);
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
    await plateWords(p, s, tag);
    /* 鍵の無い会員（検査用の行 FACT_ROWS・BEN_ROWS が、鍵の掛かった返事に付いてくる）── 行は1つも出ない。
       「ひとつ教えて」のカードの「集まった回答」は鍵の1行だけ。話題の札は「質問 N問」のまま ＝ 札に人数・件数・「回答」の字が入らない。
       逆も見る：「集まった回答」の欄に「◯問」と書かない（質問の数を、回答の数のように見せない）。
       開いている人の行（最多／分かれた／中央値・回答 N人・年月）は、開いた返事を返す場面が見る（digestRowsOk・benRowsOk）。 */
    {
      const got = await ev(() => {
        const c = document.querySelector('.pvg-askc'), box = c.querySelector('.pvg-got'), slot = box && box.querySelector('.crl[data-live="fact"]');
        const vis = el => !!el && el.getClientRects().length > 0, tx = el => (el ? el.textContent : '').trim();
        return {
          state: slot ? slot.dataset.state : null, keys: slot ? (slot.getAttribute('data-keys') || '').split(',') : [], text: tx(box),
          lock: slot ? [...slot.querySelectorAll('.crl-lock')].map(tx) : [],
          stray: [...c.querySelectorAll('.crl-fact')].filter(r => !r.closest('.pvg-got')).length,
          plates: [...c.querySelectorAll('details.pvg-topic > summary')].map(x => ({ on: vis(x), text: tx(x) })),
        };
      });
      const rows = await factRowsOf(p, '.pvg-askc .pvg-got');
      const want = FACT_ROWS.filter(f => got.keys.includes(f.question_id)).sort((a, b) => got.keys.indexOf(a.question_id) - got.keys.indexOf(b.question_id));
      const bad = [];
      if (got.state !== 'locked') bad.push(`回答の欄が ${got.state}（鍵の1行のはず）`);
      if (!same(got.lock, ['給与の提出で開きます'])) bad.push(`鍵の1行「${got.lock.join('｜')}」`);
      if (rows.length) bad.push(`回答の行が ${rows.length}つ出ている（鍵の無い会員には1つも出さない）`);
      if (want.length !== FACT_ROWS.length) bad.push(`検査用の ${FACT_ROWS.length}行のうち、欄が持つ質問は ${want.length}行`);
      if (/\d\s*問/.test(got.text)) bad.push('「集まった回答」の欄に「◯問」と書いてある');
      if (got.stray) bad.push(`回答の行が、欄の外に ${got.stray}つ`);
      if (got.plates.length !== 4) bad.push(`話題の札 ${got.plates.length}枚`);
      for (const t of got.plates) {
        if (!t.on) bad.push(`札「${t.text.slice(0, 12)}」が見えていない`);
        if (/回答|\d\s*[人件]/.test(t.text)) bad.push(`札に回答の数が入っている「${t.text}」`);
        if (!/質問 \d+問/.test(t.text)) bad.push(`札に「質問 N問」が無い「${t.text}」`);
      }
      ok(!bad.length, `${tag}: 鍵の無い会員 ── 「集まった回答」は鍵の1行だけ（行は1つも出ない）・話題の札は「質問 N問」のまま`, bad.slice(0, 4).join(' ／ '));
      const leak = await ev((page, slot) => {
        const t = document.body.innerText, s = [...document.querySelectorAll('.crl')].map(e => e.textContent).join('\n');
        return [...page.filter(x => t.includes(x) || s.includes(x)), ...slot.filter(x => s.includes(x))];
      }, LEAK_PAGE, LEAK_SLOT);
      ok(!leak.length, `${tag}: 鍵の無い会員 ── 返事に付いてきた行の人数・中央値が、ページの字にも欄にも出ていない`, [...new Set(leak)].join(' '));
    }
    /* M2 鍵の無い会員（偽のサーバー）──「集まった回答」の欄に在るのは、鍵の1行だけ。行も、入口も、欄の中に無い
       （この欄が自分で出す入口は、答えるカードだけ）。給与の提出の入口は、概要の見えている欄のどれかに在る（このページの会社の分）。
       偽のサーバーは、鍵の掛かった返事に、わざと行を付けて返している ── その人数も中央値も、画面に出ていない。
       ⚠️ 字で見る（HTML では見ない ── ページの HTML は、属性の値の中に「9.5」を持っている）。
          LEAK_PAGE はページの字と欄の字の両方・LEAK_SLOT（人数と「1500」）は欄の字でだけ見る（「3人そろった項目だけ」のような地の文が、欄の外に在る）。 */
    {
      const slots = await ev(slotsSee), got = slots.filter(x => x.at === 'got'), bad = [];
      if (got.length !== 1) bad.push(`「集まった回答」の欄が ${got.length}つ見えている`);
      for (const x of got) {
        if (x.state !== 'locked') bad.push(`欄が ${x.state}（鍵の形のはず）`);
        if (x.rows) bad.push(`回答の行が ${x.rows}つ出ている`);
        if (!same(x.lock, [PAY_LINE])) bad.push(`1行「${x.lock.join('｜')}」（あるべき「${PAY_LINE}」）`);
        if (x.links.length) bad.push(`欄の中にリンクが ${x.links.length}つ（${x.links.map(a => a.text).join('｜')}）`);
        if (x.text !== PAY_LINE) bad.push(`欄に、鍵の1行のほかの字が在る「${x.text.slice(0, 60)}」`);
      }
      if (!slots.some(x => x.links.some(a => a.on && a.href.includes(`pay-report.html?airline=${s}`)))) bad.push(`概要の見えている欄に、給与の提出（pay-report.html?airline=${s}）へのリンクが無い`);
      const leak = await ev((page, slot) => {
        const t = document.body.innerText, c = [...document.querySelectorAll('.crl')].map(e => e.textContent).join('\n');
        return [...page.filter(x => t.includes(x) || c.includes(x)), ...slot.filter(x => c.includes(x))];
      }, LEAK_PAGE, LEAK_SLOT);
      if (leak.length) bad.push(`返事に付いてきた行の字が出ている（${[...new Set(leak)].join(' ')}）`);
      ok(!bad.length, `${tag}: 鍵の無い会員 ──「集まった回答」は「${PAY_LINE}」の1行だけ（回答の行も入口も、欄の中に無い）・給与の提出の入口は、概要の見えている欄に在る・返事に付いてきた行の人数も中央値も出ていない`, bad.slice(0, 5).join(' ／ '));
    }
    await ev(() => window.__pvg.top());
    const sh = await ev(() => window.__pvg.shape());
    const rp = await ev(() => window.__pvg.realpay());
    if (!rp) { ok(false, `${tag}: 提出された年収の箱が見えている`); return; }
    /* 概要は短い入口 ＝ 見本の1行だけ（2026-10-08 オーナーのご指示「ぼかし3行で縦長にしすぎない」）。
       欄が持つのは新しい3行（data-top="3"）で、給与・待遇のタブではその3行が出る。全部は REAL PAY に在る。 */
    const N = MASK_AGE.length, top = Math.min(3, N), nShow = 1;
    const rowBad = list => {
      const bad = [];
      for (const [i, r] of list.entries()) {
        const at = `${i + 1}行め`;
        if (r.mask !== 'line' || !r.hid) bad.push(`${at}: 伏せた行の形でない`);
        if (r.a !== '' || r.b !== '年収') bad.push(`${at}: 伏せた欄に字が在る（「${r.a}」「${r.b}」）`);
        if (r.extra) bad.push(`${at}: 開いた行の部品（職位・機材・額・印）が ${r.extra}つ在る`);
        if (squash(r.c || '') !== VF_TEXT(MASK_VF[i]) + AGE_TEXT[MASK_AGE[i]]) bad.push(`${at}: 出典と投稿時期が、サーバーの返事と違う（${r.c}）`);
        if (!(same(r.plates.map(x => [x.w, x.h]), [[52, 12], [44, 12], [86, 14]]) && r.plates.every(x => !x.kids && x.attrs === 1 && /blur\(/.test(x.blur)))) {
          bad.push(`${at}: 板が「中身の無い、ぼかした板」でない（${r.plates.map(x => `${x.w}×${x.h}`).join(' ')}）`);
        }
      }
      return bad;
    };
    ok(rp.state === 'locked' && rp.count === `${N}件の提出`, `${tag}: 鍵は掛かったまま・件数はこの会社の分だけ（ほかの会社の行を数えない）`, `${rp.state}・${rp.count}`);
    ok(rp.total === top && rp.rows.length === nShow, `${tag}: 概要に見える行は見本の ${nShow}行だけ（欄が持つのは ${top}行・残りは給与・待遇のタブ）`, `${rp.rows.length}／${rp.total}行・箱の幅 ${Math.round(rp.width)}`);
    {
      /* 短い入口の形：件数と「給与の提出で開きます」が同じ行・その下に見本の行。
         ⚠️ いちばん狭い箱（296px 未満 ＝ 画面 343px まで）だけは、札が件数の真下の段に下りる。
            札は 174px 要り、320px の画面で件数の横に残るのは 162〜171px ── 横に置くと最後の1文字「す」だけが
            次の行へ落ちていた（2026-10-09 に直した。この検査は「同じ行に在る」しか見ておらず、緑のままだった）。
            どの幅でも、札の字は1行。幅の線は pv-glance.css の写しなので、あちらを動かしたらここも直す。 */
      const g = rp.geo, bad = [], narrow = rp.width < LOCK_UNDER;
      const span = `件数 ${g.count ? Math.round(g.count.y) + '〜' + Math.round(g.count.b) : '—'}・錠前 ${g.lock ? Math.round(g.lock.y) + '〜' + Math.round(g.lock.b) : '—'}・箱の幅 ${Math.round(rp.width)}`;
      if (!(g.count && g.lock && g.ul)) bad.push('件数・錠前の1行・行の束のどれかが見えていない');
      else {
        if (!narrow && !(g.lock.y < g.count.b && g.lock.b > g.count.y && g.lock.x >= g.count.r - 1)) bad.push(`件数と錠前の1行が同じ行に並んでいない（${span}）`);
        if (narrow && !(g.lock.y >= g.count.b - 1 && Math.abs(g.lock.x - g.count.x) <= 1)) bad.push(`札が件数の真下の段に下りていない（${span}）`);
        if (g.lock.lines !== 1) bad.push(`札の字が ${g.lock.lines}行に折れている（${span}）`);
        if (g.count.lines !== 1) bad.push(`件数の字が ${g.count.lines}行に折れている（${span}）`);
        if (!(g.ul.y >= Math.max(g.count.b, g.lock.b) - 1)) bad.push('見本の行が、件数の行より上に在る');
      }
      ok(!bad.length, `${tag}: 件数と「給与の提出で開きます」が1行に並び（いちばん狭い箱では件数の真下）、札の字は折れない・その下に見本の行`, bad.join(' ／ '));
    }
    ok(!rowBad(rp.rows).length, `${tag}: 行に出るのは 出典と投稿時期 だけ ── 職位・機材・額の所は、中身の無いぼかした板`, rowBad(rp.rows).slice(0, 5).join(' ／ '));
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
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
    /* 給与・待遇のタブでは、欄が持つ3行がそのまま出る（概要で減らしたのは「何行めまで見せるか」だけ）。 */
    {
      await ev(() => document.querySelector('.pvg-tabs [data-pvg-tab="pay"]').click());
      const moved = await p.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'pay' && document.body.classList.contains('pvg-at-pay'), { timeout: 15000 }).then(() => true, () => false);
      const rp3 = await ev(() => window.__pvg.realpay());
      const bad = !moved ? ['給与・待遇のタブへ移れない'] : !rp3 ? ['提出された年収の箱が見えていない'] : rowBad(rp3.rows);
      if (moved && rp3 && rp3.rows.length !== top) bad.push(`見える行が ${rp3.rows.length}行（あるべき ${top}行）`);
      if (moved && rp3 && NO_NUM.test(rp3.rest)) bad.push(`件数と投稿時期のほかに数字が在る：${rp3.rest.slice(0, 60)}`);
      ok(!bad.length, `${tag}: 給与・待遇のタブでは ${top}行とも出る ── どの行も 出典と投稿時期 だけ（板の幅は全行で同じ）`, bad.slice(0, 5).join(' ／ '));
      const geo3 = await ev(() => window.__pvg.geom(true));
      ok(!geo3.length, `${tag}: 給与・待遇のタブでも、切れ・はみ出し・重なりが無い`, geo3.slice(0, 8).join('\n      '));
    }
    /* M5 鍵の無い会員（偽のサーバー）── 6つのタブを順に開き、開いたタブごとに、見えている欄を約束（tabRules）に通す。
       タブを押す → そのタブになるまで待つ → 欄が落ち着くまで待つ（時間では待たない）→ 1回だけ読む。判定は外でする。
       ⚠️ 偽のサーバーは、口ごとに別々に答える：集計の口は「鍵の無い会員」（行つき）・月の勤務の口も「鍵の無い会員」・
          給与の一覧と補足は今までどおり。ここが言えるのは、その返事を受けた画面の形だけ（誰に何が返るかは、本物の SQL を通す側が見る）。
       GUARD 「勤務・訓練」のタブで、印の付いた集計の欄が1つと、月の勤務の欄が、どちらも鍵の1行を出している
             （見ていなければ、上の約束は、空のタブで緑になる）。 */
    {
      const R = { a: [], b: [], c: [], line: [] }, guard = TAB_IDS.includes('work') ? [] : ['「勤務・訓練」のタブが無い'];
      for (const id of TAB_IDS) {
        await ev(id => document.querySelector(`.pvg-tabs [data-pvg-tab="${id}"]`).click(), id);
        const there = await p.waitForFunction(id => !!window.PVGlance && window.PVGlance.at() === id && document.body.classList.contains(`pvg-at-${id}`), { timeout: 15000 }, id).then(() => true, () => false);
        const calm = there && (await p.waitForFunction(SETTLED, { timeout: 15000 }).then(() => true, () => false));
        if (!calm) { for (const k of Object.keys(R)) R[k].push(`「${TAB_NAME[id]}」へ移れない・欄が落ち着かない`); if (id === 'work') guard.push('「勤務・訓練」を開けない'); continue; }
        const slots = await ev(slotsSee), r = tabRules(slots, s, 'locked');
        for (const k of Object.keys(R)) for (const b of r[k]) R[k].push(`「${TAB_NAME[id]}」── ${b}`);
        if (id === 'work') {
          const f = slots.filter(x => x.live === 'fact' && STAMPED(x) && x.lock.length), m = slots.filter(x => x.live === 'work' && x.lock.length);
          if (f.length !== 1 || m.length !== 1) guard.push(`鍵の1行を出している欄：印の付いた集計の欄 ${f.length}つ・月の勤務の欄 ${m.length}つ（あるべきは1つずつ）`);
        }
      }
      for (const k of Object.keys(R)) ok(!R[k].length, `${tag}: ${M5_LABEL[k]}`, [...new Set(R[k])].slice(0, 6).join(' ／ '));
      ok(!guard.length, `${tag}: 「勤務・訓練」のタブで、印の付いた集計の欄と月の勤務の欄を、どちらも鍵の1行が出た形で見ている（上の約束が、空のタブで緑になっていない）`, guard.join(' ／ '));
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 件数と札が横に並ぶのは箱 296px（画面 344px）から。その下では札が件数の下の段へ下りる。
   351 ＝ 横に並ぶ側で、VIEWS が持っているいちばん狭い幅（320 は下りる側）。 */
const ROWS_W = [320, 351, 390, 768, 1440];
const LOCK_UNDER = 296;

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
    await plateWords(p, s, tag);
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
        if (r.items !== 1) bad.push(`見えている口コミが ${r.items}件（あるべき 1件）`);
        if (!(r.texts.length === r.items && r.texts.every(t => t.startsWith(CLIP.slice(0, 20))))) bad.push(`本文の所に、サーバーが渡した抜粋のほかの字が在る：${r.texts.map(t => t.slice(0, 24)).join(' ／ ')}`);
        if (r.full) bad.push(`伏せていない本文が ${r.full}つ出ている`);
        if (r.lock !== '口コミの投稿で開きます') bad.push(`下の欄に書かれている錠前の1行が「${r.lock}」（要約の欄が無い会社では、この1行が見える）`);
        /* 要約の欄が「要約は口コミの投稿で開きます」と言っている時、同じ意味の1行をもう1つ見せない。 */
        if (!same(r.locks, [SUM_LOCK_TEXT])) bad.push(`見えている錠前の行が ${r.locks.length}つ（${r.locks.join('｜')}）`);
      }
      ok(!bad.length, `${tag}: 概要の口コミは新しい1件・本文は抜粋だけ・錠前の1行は「${SUM_LOCK_TEXT}」の1つだけ（同じ意味の行を重ねない）`, bad.join(' ／ '));
    }
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（星の行が押し出さない）`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    const pr = await ev(() => window.__pvg.probe('#pvg-score'));
    ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 評価の字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
    if (process.env.PV_GLANCE_SHOT) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/rated-${s}-${w}.png`, clip: { x: 0, y: 0, width: w, height: w < 700 ? 2000 : 1500 } });
    {
      /* 口コミの一覧（口コミのタブ）のカード。届いた2件が描かれるまで待つ ── 字として出たか、タグとして働いたかのどちらか。 */
      const META = '#airline-review-section .rv-reviewer-meta';
      const drawn = await p.waitForFunction((sel, mark) => [...document.querySelectorAll(sel)].filter(e => e.textContent.includes(mark)).length >= 2 || !!document.querySelector(`${sel} img`),
        { timeout: 8000 }, META, HOSTILE).then(() => true, () => false);
      const x = await ev((sel, mark) => {
        const m = [...document.querySelectorAll(sel)];
        return { shown: m.filter(e => e.textContent.includes(mark)).length, tags: m.reduce((n, e) => n + e.querySelectorAll(':not(.rv-meta-sep)').length, 0), hit: !!window.__pvgHit };
      }, META, HOSTILE);
      const bad = [];
      if (!drawn) bad.push('タグを書いた2件が、一覧に描かれていない');
      if (x.shown !== 2) bad.push(`書かれたタグが字として出ているカードが ${x.shown}枚（あるべき 2枚）`);
      if (x.tags) bad.push(`職位・年数の所で、書かれたタグが ${x.tags}つ働いている`);
      if (x.hit) bad.push('書かれたタグの中の命令が動いた');
      ok(!bad.length, `${tag}: 口コミのカードの職位・在籍年数に書かれたタグは、字として出るだけ（働かない）`, bad.join(' ／ '));
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
const RATED_W = [390, 768, 1440];
/* 「点数の付いた口コミは在るが、要約の口がまだ無い時」＝ いまの本番の形（要約の口は未適用・返事は 404）。
   上の場面（要約の口が「鍵の無い人」と答える）では、下の欄の錠前の1行「口コミの投稿で開きます」は隠れる。
   その1行が人の目に見えるのはこちらの形だけなので、**見えていること**はここで測る（字が書かれているだけでは足りない）。 */
async function runRated404(browser, s, [w, h]) {
  const tag = `${s} ${w}（評価が在る・要約の口が無い時）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'rated404');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const rows = ratedRows(s);
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    const sc = await ev(() => window.__pvg.score());
    const bad = scoreBad(s, sc, live.filter(IS_SCORE), rows, 'empty');
    const r = sc.card && sc.card.revs;
    if (!r) bad.push('口コミの欄が無い');
    else {
      if (r.state !== 'locked') bad.push(`鍵の無い人なのに、欄が ${r.state}`);
      if (r.items !== 1) bad.push(`見えている口コミが ${r.items}件（あるべき 1件）`);
      if (r.full) bad.push(`伏せていない本文が ${r.full}つ出ている`);
      if (!same(r.locks, ['口コミの投稿で開きます'])) bad.push(`見えている錠前の行が ${r.locks.length}つ（${r.locks.join('｜')}）── あるべきは「口コミの投稿で開きます」の1つ`);
    }
    ok(!bad.length, `${tag}: 要約の欄は場所を取らない・星と図は点数どおり・錠前の1行「口コミの投稿で開きます」が見えている`, bad.join(' ／ '));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 「集計の口がまだ無い時」（M4）：集計の口（pv_contrib_facts）だけが 404 を返す。ほかの口は、0件の時と同じ返事。
   見えている集計の欄は「準備中」だけ。「まだ集計がありません」とは書かない ── つながっていないことを、0件のように見せない。
   数字もリンクも出さない（開くものが無いので、入口も出さない）。 */
const FACT_OFF = '準備中', FACT_NONE = 'まだ集計がありません';
async function runFacts404(browser, s, [w, h]) {
  const tag = `${s} ${w}（集計の口が無い時）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'facts404');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on && x.kind === 'fact');
    const slots = (await ev(slotsSee)).filter(x => x.live === 'fact'), bad = [];
    if (!slots.length || live.length !== slots.length) bad.push(`見えている集計の欄が ${slots.length}つ（もう1つの読み方では ${live.length}つ）`);
    for (const x of live) if (x.state !== 'off' || x.retry) bad.push(`欄が ${x.state}${x.retry ? '・「やり直す」が在る' : ''}（あるべき off）`);
    for (const x of slots) {
      if (x.state !== 'off') bad.push(`${slotName(x)}: 欄が ${x.state}（あるべき off）`);
      if (x.text !== FACT_OFF) bad.push(`${slotName(x)}: 字「${x.text.slice(0, 40)}」（あるべき「${FACT_OFF}」だけ）`);
      if (x.text.includes(FACT_NONE)) bad.push(`${slotName(x)}: 「${FACT_NONE}」と書いてある`);
      if (NO_NUM.test(x.text)) bad.push(`${slotName(x)}: 数字が在る`);
      if (x.links.length) bad.push(`${slotName(x)}: リンクが ${x.links.length}つ（${x.links.map(a => a.text).join('｜')}）`);
    }
    ok(!bad.length, `${tag}: 見えている集計の欄は「${FACT_OFF}」だけ ──「${FACT_NONE}」と書かない・数字もリンクも出さない（つながっていないことを、0件のように見せない）`, [...new Set(bad)].join(' ／ '));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

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
    /* タブの帯：見えている範囲・流した量・端の印（枠の data-more と、矢印の濃さ）・6つの名前の位置 */
    strip: (() => {
      const s = q('#pvg-tabs'); if (!vis(s)) return null;
      const wr = s.closest('.pvg-tabwrap'), b = s.getBoundingClientRect();
      return {
        wrap: !!wr, l: b.left, r: b.right, sl: s.scrollLeft, max: s.scrollWidth - s.clientWidth,
        more: wr ? (wr.getAttribute('data-more') || '') : '',
        fade: parseFloat(getComputedStyle(s).getPropertyValue('--pvg-fade')) || 0,
        markL: wr ? +getComputedStyle(wr, '::before').opacity : -1, markR: wr ? +getComputedStyle(wr, '::after').opacity : -1,
        lab: all('.pvg-tabs > a[data-pvg-tab]').map(a => { const r = (a.querySelector('span') || a).getBoundingClientRect(); return [a.getAttribute('data-pvg-tab'), r.left, r.right]; }),
      };
    })(),
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
/* タブの帯の決まり（2026-10-08 オーナーのご指示「タブ名が途中で切れて気付けない」）。
     ・選んだタブの名前は、帯の見える所（端の霞みの内側）に全部入っている
     ・続きが在る側の端にだけ印が出る（印は pv-glance.js が実際に測って枠へ書く。ここでも測り直して突き合わせる）
     ・名前が端で切れている／丸ごと外に在るのに、その側に印が無い ＝「気付けない切れ」
     ・「追加」のボタンは帯の右・画面の中
     ・幅 700 以上は、6つ全部が1列に入る（iPad で流させない）
   t ＝ いま選んでいるはずのタブ。 */
function stripBad(r, w, t) {
  const st = r.strip, bad = [];
  if (!st) return ['タブの帯が見えていない'];
  if (!st.wrap) return ['タブの並びを包む枠（.pvg-tabwrap）が無い ＝ 端の印を置けない'];
  const want = st.max > 1 ? [st.sl > 1 ? 'l' : '', st.sl < st.max - 1 ? 'r' : ''].filter(Boolean).join(' ') : '';
  if (st.more !== want) bad.push(`端の印が帯の位置と合わない（在る「${st.more}」・在るべき「${want}」）`);
  const L = /(^| )l( |$)/.test(st.more), R = /(^| )r( |$)/.test(st.more);
  if (st.markL !== (L ? 1 : 0) || st.markR !== (R ? 1 : 0)) bad.push(`端の矢印の濃さが印と合わない（左 ${st.markL}・右 ${st.markR}・印「${st.more}」）`);
  if (st.lab.length !== TABS.length) bad.push(`タブの名前が ${st.lab.length}つ`);
  const lo = st.l + (L ? st.fade : 0), hi = st.r - (R ? st.fade : 0), cur = st.lab.find(x => x[0] === t);
  if (!cur) bad.push(`選んだタブ（${t}）の名前が無い`);
  else if (!(cur[1] >= lo - 0.5 && cur[2] <= hi + 0.5)) bad.push(`選んだタブの名前が、帯の見える所に全部入っていない（名前 ${Math.round(cur[1])}〜${Math.round(cur[2])}・見える所 ${Math.round(lo)}〜${Math.round(hi)}）`);
  for (const [id, a, b] of st.lab) {
    if (a < st.l - 0.5 && !L) bad.push(`「${TAB_NAME[id]}」が左端で切れているか外に在るのに、左の印が無い`);
    if (b > st.r + 0.5 && !R) bad.push(`「${TAB_NAME[id]}」が右端で切れているか外に在るのに、右の印が無い`);
  }
  if (!(r.add && r.add.x >= st.r - 0.5 && r.add.x + r.add.w <= w + 0.5)) bad.push(`「追加」のボタンが帯に重なるか、画面の外に出ている（帯の右端 ${Math.round(st.r)}・ボタン ${r.add ? Math.round(r.add.x) + '〜' + Math.round(r.add.x + r.add.w) : '無い'}）`);
  if (w >= 700 && st.max > 1) bad.push(`幅 ${w} で、6つのタブが1列に入っていない（${Math.round(st.max)}px ぶん流れる）`);
  return bad;
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
  /* 帯の端の印が、帯の位置と合って落ち着くまで待つ（時間では待たない。矢印は .2s かけて現れる）。 */
  const seated = () => until(() => {
    const s = document.getElementById('pvg-tabs'), wr = s && s.closest('.pvg-tabwrap');
    if (!s || !wr) return true;                       // 枠が無いことは、下の検査が知らせる
    const max = s.scrollWidth - s.clientWidth, x = s.scrollLeft;
    const want = max > 1 ? [x > 1 ? 'l' : '', x < max - 1 ? 'r' : ''].filter(Boolean).join(' ') : '';
    return (wr.getAttribute('data-more') || '') === want &&
      [getComputedStyle(wr, '::before').opacity, getComputedStyle(wr, '::after').opacity].every(v => +v === 0 || +v === 1);
  });
  const stripNote = [], strip = async (t, when) => { await seated(); for (const b of stripBad(await see(), w, t)) stripNote.push(`${when}：${b}`); };
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
    await strip('overview', '最初の表示');
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
    const m1 = [], m1Saw = new Set();
    const m5 = { a: [], b: [], c: [] };
    for (const t of TAB_IDS) {
      const moved = t === 'overview' ? true : (await tap(`.pvg-tabs [data-pvg-tab="${t}"]`)) && (await atTab(t));
      if (moved) await strip(t, `「${TAB_NAME[t]}」を押した後`);
      const r = await see(FACE[t]);
      ok(moved && r.at === t && r.cls === `pvg-at-${t}` && r.cur.join() === t && r.hash === (t === 'overview' ? '' : `#${t}`) && !r.hid.length && !r.out.length && r.over <= 0 && !r.faded,
        `${tag}:「${TAB_NAME[t]}」を押す → その中身だけが出る・選んだ印は1つ・住所に残る・横にあふれない`,
        JSON.stringify({ at: r.at, 印: r.cur, 住所: r.hash, 出ていない: r.hid, 出ている: r.out, 横あふれ: r.over, 薄いまま: r.faded }));
      /* 口コミを書く入口は、概要と口コミのタブで下の行が違う（どちらも2行・同じ行き先）。ほかのタブには出ない。 */
      if (RV_GIVE[t]) ok(same(r.write, [[GG, RV_GIVE[t], `../submit-review.html?airline=${s}`]]), `${tag}:「${TAB_NAME[t]}」の口コミを書く入口は「${GG}／${RV_GIVE[t]}」1つ ── 自分の会社を選んだ投稿の画面へ`, r.write.map(x => x.join(' ')).join(' ‖ '));
      else ok(!r.write.length, `${tag}:「${TAB_NAME[t]}」には、評価スコアのカードの入口が出ていない`, r.write.map(x => x.join(' ')).join(' ‖ '));
      /* 外した古い節（◯◯について・フライト環境・訓練・福利厚生・募集要項・他社との比較・比較表）は、どのタブにも出ない。
         中身は新しい部品の中に在る（会社のカード・給与の1枚・募集の1枚・3つの板）＝ 新旧の2か所に並べない。
         残すと決めた節は数えない（いまは無い。「よくある質問」も 2026-10-09 に外した）。 */
      { const kept = Object.values(KEPT), dup = r.h2.filter(x => !kept.some(re => re.test(x)) && (GONE_H2.test(x) || DROP_H2.test(x))); ok(!dup.length, `${tag}:「${TAB_NAME[t]}」に、外した古い節が出ていない`, dup.join(' ／ ')); }
      /* M1 このタブで見えている欄（未ログインの人）。欄が落ち着くのを待って、1回だけ読む（時間では待たない）。言うのは、6つを回ったあとの1行。 */
      if (!(await until(SETTLED))) m1.push(`「${TAB_NAME[t]}」の欄が落ち着かない`);
      else for (const b of loginBad(await p.evaluate(slotsSee), t === 'overview' ? '' : t, m1Saw)) m1.push(`「${TAB_NAME[t]}」── ${b}`);
      /* M5 同じタブを、未ログインの人の約束（tabRules）にも通す。読むのは、欄が落ち着いたあとの1回。言うのは、6つを回ったあとの3行。 */
      {
        const r = (await until(SETTLED)) ? tabRules(await p.evaluate(slotsSee), s, 'login') : null;
        for (const k of Object.keys(m5)) for (const b of r ? r[k] : ['欄が落ち着かない']) m5[k].push(`「${TAB_NAME[t]}」── ${b}`);
      }
    }
    for (const k of M1_SAW.filter(k => !m1Saw.has(k))) m1.push(`${M1_SAW_NAME[k]}を、どのタブでも判定していない`);
    ok(!m1.length, `${tag}: ${M1_LABEL}（6つのタブ・行き先は同じタブへ戻る）`, [...new Set(m1)].slice(0, 6).join(' ／ '));
    for (const k of Object.keys(m5)) ok(!m5[k].length, `${tag}: 未ログインの人 ── ${M5_LABEL[k]}`, [...new Set(m5[k])].slice(0, 6).join(' ／ '));
    /* ── 2) 戻る・進む・読み直し ── */
    {
      const walk = [];
      await p.goBack(); walk.push(['戻る', 'life', await atTab('life'), (await see()).hash]); await strip('life', '戻る');
      await p.goBack(); walk.push(['戻る', 'work', await atTab('work'), (await see()).hash]); await strip('work', 'もう一度戻る');
      await p.goForward(); walk.push(['進む', 'life', await atTab('life'), (await see()).hash]); await strip('life', '進む');
      const bad = walk.filter(([, t, hit, hash]) => !(hit && hash === `#${t}`)).map(([how, t, , hash]) => `${how} →「${TAB_NAME[t]}」にならない（住所 ${hash}）`);
      await p.reload({ waitUntil: 'load', timeout: 60000 });
      const again = await atTab('life');
      if (again) await strip('life', '読み直し');
      const r = await see(FACE.life);
      if (!(again && !r.hid.length && !r.out.length && r.cur.join() === 'life')) bad.push(`読み直すと「暮らし・家族」でなくなる（${r.at}）`);
      await p.goBack();
      if (!(await atTab('work'))) bad.push(`読み直したあとの「戻る」が「勤務・訓練」にならない（${(await see()).at}）`);
      ok(!bad.length, `${tag}: 戻る・進む・読み直しで、選んだタブが分かる`, bad.join(' ／ '));
    }
    /* ── 3) 住所で直接開く ── */
    {
      /* いちばん右のタブを住所で直接開く ＝ 帯が最初から右へ流れている形（左に印・右は無し） */
      await fresh(`${url}#stay`);
      if (await atTab('stay')) await strip('stay', '住所（#stay）で直接');
      else stripNote.push('住所（#stay）で直接：「ステイ先」にならない');
      await fresh(`${url}#reviews`);
      if (await atTab('reviews')) await strip('reviews', '住所（#reviews）で直接');
      const hit = await atTab('reviews'), r = await see(FACE.reviews);
      ok(hit && !r.hid.length && !r.out.length, `${tag}: 住所（#reviews）で直接開く →「口コミ」`, JSON.stringify({ at: r.at, 出ていない: r.hid, 出ている: r.out }));
      await fresh(`${url}#pvg-stay`);
      const hit2 = await atTab('overview'), r2 = await see({ on: ['#pvg-stay', '.pvg-co'], off: [] });
      ok(hit2 && !r2.hid.length, `${tag}: 古い住所（#pvg-stay）は、概要のまま開く（中身が消えない）`, JSON.stringify({ at: r2.at, 出ていない: r2.hid }));
    }
    /* ── 3z) タブの帯：ここまでに書き留めた分をまとめて1行 ──
       最初の表示／6つを1つずつ押した後／戻る・進む・読み直し／住所で直接（いちばん右の「ステイ先」と「口コミ」）。 */
    ok(!stripNote.length, `${tag}: タブの帯 ── 選んだタブの名前が全部見えている・続きの在る側にだけ印が出る・切れた名前に気付ける・「追加」が帯に重ならない${w >= 700 ? '・6つが1列に入る' : ''}`,
       [...new Set(stripNote)].slice(0, 10).join('\n      '));
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
      /* a) 金額の出どころ（#kyuyo-konkyo）。置き場は、給与の1枚の中の畳んだ説明（概要にも「給与・待遇」にも出る）。
            ほかのページと、このページの中のリンクが、この住所へ来る。来たら、畳んだ説明が開いて、頭から読める高さに在る
            （閉じたままだと、寄った先に見出しの1行しか無い ＝「この数字の出どころ」を押したのに、出どころが見えない）。
            ★2026-10-08 までは下の古い節（出どころの表）が同じ住所を持っていた。古い節を外して、住所はここへ移した。
            2通りで見る ── 住所で直接開く（最初の読み込み）／「給与・待遇」に居るときに住所だけ替わる（ページの中のリンク）。 */
      const badSrc = [];
      const srcAt = () => p.evaluate(() => {
        const on = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
        const box = document.getElementById('kyuyo-konkyo'), r = on(box) ? box.getBoundingClientRect() : null;
        const inner = box ? [...box.children].filter(c => c.nodeName !== 'SUMMARY') : [];
        return {
          n: document.querySelectorAll('#kyuyo-konkyo').length, tag: box ? box.nodeName : '', open: !!box && box.open === true,
          body: inner.length > 0 && inner.some(on), top: r ? Math.round(r.top) : null, vh: innerHeight, at: window.PVGlance.at(),
        };
      });
      const srcOk = a => a.n === 1 && a.tag === 'DETAILS' && a.open && a.body && a.top !== null && a.top >= 60 && a.top <= a.vh - 120;
      const srcWait = tab => until(tab => {
        const box = document.getElementById('kyuyo-konkyo');
        if (!box || !box.open || !window.PVGlance || window.PVGlance.at() !== tab) return false;
        const t = box.getBoundingClientRect().top;
        return t >= 60 && t <= innerHeight - 120;
      }, tab);
      await fresh(`${url}#kyuyo-konkyo`);
      await srcWait('overview');
      { const a = await srcAt(); if (!(srcOk(a) && a.at === 'overview')) badSrc.push(`住所（#kyuyo-konkyo）で開いても、出どころの説明が開いて見えていない（${JSON.stringify(a)}）`); }
      await fresh(`${url}#pay`);
      if (!(await atTab('pay'))) badSrc.push('「給与・待遇」が住所で開かない');
      else {
        const shut = await p.evaluate(() => { const box = document.getElementById('kyuyo-konkyo'); if (!box) return false; box.open = false; return !box.open; });
        await p.evaluate(() => { location.hash = '#kyuyo-konkyo'; });
        await srcWait('pay');
        const a = await srcAt();
        if (!(shut && srcOk(a) && a.at === 'pay')) badSrc.push(`「給与・待遇」でページの中のリンク（#kyuyo-konkyo）を踏むと、タブが替わるか、出どころの説明が開かない（${JSON.stringify(a)}）`);
      }
      ok(!badSrc.length, `${tag}: 金額の出どころの住所（#kyuyo-konkyo）── 畳んだ説明が開いて、頭から読める高さに出る（住所で直接／ページの中のリンク）`, badSrc.join(' ／ '));
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
    /* ── 7) 集計の口は、ページを1回開くごとに1回だけ呼ぶ（M3）── どのタブを開いても増えない。
       この場面は同じページを何度も開き直すので、数えるのは「開き直してから」の1回ぶんだけ
       （前のページを先に閉じてから数を戻す ＝ 前のページの問い合わせが紛れ込まない）。
       ホテルの場面が置いた仮の鍵は、もう外してある ＝ 読む人は未ログイン。
       送る中身：会社はこのページの会社・聞く質問は、並べ替えてあって重なりの無い並び（多くて 120。サーバーは、それより多いと断る）。 */
    {
      await p.goto('about:blank');
      seen.factCalls.length = 0;
      await fresh(url);
      const bad = [];
      for (const id of TAB_IDS) {
        const there = (id === 'overview' || (await tap(`.pvg-tabs [data-pvg-tab="${id}"]`))) && (await atTab(id)) && (await until(SETTLED));
        if (!there) bad.push(`「${TAB_NAME[id]}」を開けない・欄が落ち着かない`);
      }
      const calls = seen.factCalls.slice();
      let sent = null; try { sent = JSON.parse(calls[0] || 'null'); } catch { /* 読めない中身は null のまま */ }
      const q = (sent && sent.p) || {}, keys = q.keys;
      if (calls.length !== 1) bad.push(`集計の口を ${calls.length}回呼んだ（あるべき 1回）`);
      if (q.airline !== s) bad.push(`送った会社が「${q.airline}」（あるべき「${s}」）`);
      if (!(Array.isArray(keys) && keys.length >= 1 && keys.length <= 120 && keys.every(k => typeof k === 'string') && same(keys, [...new Set(keys)].sort()))) {
        bad.push(`聞く質問が、並べ替えた重なりの無い 1〜120 個の並びでない（${Array.isArray(keys) ? `${keys.length}個` : typeof keys}）`);
      }
      ok(!bad.length, `${tag}: 集計の口は、ページを1回開くごとに1回だけ呼ぶ（6つのタブを全部開いても増えない）── 送るのは、このページの会社と、並べ替えた重なりの無い質問の並び（多くて 120）`, bad.join(' ／ '));
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* タブの場面を流す幅。320 ＝ 帯に3つしか入らない幅。744 ＝ iPad mini（6つが入りきらなかった幅。VIEWS には無い）。 */
const TABS_W = [320, 390, 768, 1440];
const TABS_EXTRA = !WANT_W || WANT_W.includes(744) ? [[744, 950, 'side']] : [];
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

/* 「Give & Get のボタン」：形はサイトに1つ（pv-gg.css）。基準はトップページのいちばん上の黒いボタン。
   pv-gg.css はそこからの写しなので、**トップを実際に開いて測り**、会社ページに出ている全部と突き合わせる。
   見るもの ── 概要（給与の1枚・評価スコアの1枚）／給与・待遇（給与の1枚）／口コミ（評価スコアの1枚・一覧の錠前・「続きを読む」の小窓）。
   2026-10-07 の形（上の行が小さく薄い・左寄せ・四角い角）へ戻ると、ここが落ちる。
   ⚠️ トップのファイルは読むだけ。トップの見本の額や言葉は写さない（比べるのは形だけ）。
   ⚠️ わざと違えてある2つ：折り返し（トップは1行に固定・こちらは狭い箱で折れる）と、字の寄せ（こちらは折れてもまんなか）。 */
const GG_KEYS = ['alignItems', 'justifyContent', 'columnGap', 'minHeight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'borderTopWidth',
  'backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textDecorationLine', 'boxShadow',
  'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'cursor'];
const GG_NAME = { alignItems: '縦の寄せ', justifyContent: '横の寄せ', columnGap: '字と矢印の間', minHeight: '高さの下限', paddingTop: '上の余白', paddingBottom: '下の余白', paddingLeft: '左の余白', paddingRight: '右の余白',
  borderTopLeftRadius: '角の丸み', borderTopRightRadius: '角の丸み', borderBottomLeftRadius: '角の丸み', borderBottomRightRadius: '角の丸み', borderTopWidth: '枠線',
  backgroundColor: '地の色', color: '字の色', fontFamily: '書体', fontSize: '字の大きさ', fontWeight: '字の太さ', lineHeight: '行の高さ', letterSpacing: '字間', textDecorationLine: '下線', boxShadow: '影',
  transitionProperty: '動かすもの', transitionDuration: '動きの長さ', transitionTimingFunction: '動きの緩急', cursor: 'カーソル' };
/* ページの中で動く（外の変数を1つも使わない）。sel を渡せばその1つ（トップの基準）、渡さなければ見えている .pv-gg の全部。 */
function ggSee(KEYS, sel) {
  const on = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
  const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const box = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const ink = e => { const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  return [...document.querySelectorAll(sel || '.pv-gg')].filter(on).map(e => {
    const c = getComputedStyle(e), tb = e.querySelector('.pv-gg-t'), lines = tb ? [...tb.children] : [], svg = e.querySelector('svg');
    const card = e.closest('.pvg-rmg-box') || e.closest('.pvg-card') || e.closest('#airline-review-section') || e.closest('.pvg');
    return {
      at: window.PVGlance ? window.PVGlance.at() : '',
      where: e.closest('#pv-readmore-gate') ? 'dialog' : e.closest('.pvg-rv-cta-overview') ? 'score-overview' : e.closest('.pvg-rv-cta-reviews') ? 'score-reviews' : e.closest('#airline-review-section') ? 'list' : e.closest('.crl') ? 'pay' : e.closest('.pv-gate-card') ? 'lock' : e.closest('#airline-voices') ? 'voices' : '?',
      tag: e.tagName, text: lines.length ? lines.map(t).join('／') : t(e), href: e.getAttribute('href') || '', cta: e.getAttribute('data-pv-cta') || '', onclick: e.getAttribute('onclick') || '',
      css: Object.fromEntries(KEYS.map(k => [k, c[k]])), display: c.display, ws: c.whiteSpace, overflow: c.overflowX + ' ' + c.overflowY,
      box: box(e), vw: document.documentElement.clientWidth, clipX: e.scrollWidth - e.clientWidth, clipY: e.scrollHeight - e.clientHeight,
      tbox: tb ? { ...box(tb), align: getComputedStyle(tb).textAlign } : null,
      lines: lines.map(l => { const s = getComputedStyle(l); return { text: t(l), size: s.fontSize, weight: s.fontWeight, op: s.opacity, color: s.color, align: s.textAlign, lang: l.getAttribute('lang') || '', box: box(l), ink: ink(l), over: l.scrollWidth - l.clientWidth,
        /* 実際に折れた行（1字ずつ位置を読んで、同じ高さの字をまとめる）と、書き手が置いた語の切れ目 */
        rows: (() => { const out = [], rg = document.createRange(), w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT); let n, top = null;
          while ((n = w.nextNode())) for (let i = 0; i < n.data.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (!r || !r.width) continue;
            if (top === null || Math.abs(r.top - top) > r.height / 2) { out.push(''); top = r.top; } out[out.length - 1] += n.data[i]; }
          return out.map(x => x.trim()).filter(Boolean); })(),
        cut: (() => { const out = ['']; for (const c of l.childNodes) { if (c.nodeType === 1 && c.tagName === 'WBR') out.push(''); else out[out.length - 1] += c.textContent; } return out.map(x => x.trim()).filter(Boolean); })() }; }),
      /* ボタンを切り落としている親（overflow が hidden／clip で、ボタンがその箱から出ている） */
      cutBy: (() => { const b = e.getBoundingClientRect(); for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a);
        if (!/hidden|clip/.test(s.overflowX + s.overflowY)) continue; const r = a.getBoundingClientRect();
        if (b.top < r.top - 0.5 || b.bottom > r.bottom + 0.5 || b.left < r.left - 0.5 || b.right > r.right + 0.5) return '.' + String(a.className || a.tagName).trim().split(/\s+/).join('.'); } return ''; })(),
      svg: svg && on(svg) ? box(svg) : null,
      card: card ? box(card) : null,
      /* 旧い形の会社ページで、ボタンのすぐ外の箱（錠前の板・口コミの鍵の箱・小窓の板） */
      host: (h => (h ? box(h) : null))(e.closest('.pv-gate-card, .rv-post-gate, #pv-readmore-gate > div')),
    };
  });
}
/* トップの基準は1回だけ測る（幅 1440。スマホの幅ではトップのボタンは画面いっぱいに伸びる ＝ 別の形）。 */
let ggBaseOnce = null;
function ggBase(browser) {
  if (!ggBaseOnce) ggBaseOnce = (async () => {
    const ctx = await browser.createBrowserContext();
    try {
      const p = await ctx.newPage();
      p.setDefaultTimeout(30000);
      await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await p.setRequestInterception(true);
      p.on('request', r => {
        let u; try { u = new URL(r.url()); } catch { return r.continue(); }
        if (['data:', 'blob:', 'about:'].includes(u.protocol) || u.origin === BASE || LIBS.test(u.hostname)) return r.continue();
        return r.abort();                              // 本番の DB も解析タグも読まない（測るのは形だけ）
      });
      await p.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
      await p.waitForFunction(() => { const e = document.querySelector('#hero-section .hero-btn--p'); return !!e && e.getClientRects().length > 0; });
      await p.evaluate(() => document.fonts.ready.then(() => true));
      const got = await p.evaluate(ggSee, GG_KEYS, '#hero-section .hero-btn--p');
      return got.length === 1 ? got[0] : null;
    } catch { return null; } finally { await ctx.close().catch(() => {}); }
  })();
  return ggBaseOnce;
}
/* ボタン1つの形を、トップの黒いボタン（lp）と突き合わせる。タブのある形も旧い形も、この1つの物差しで測る。
   opt.tone ＝ 色だけは別の答えと比べる時（暗い画面・暗い板の上では、サイトの色の決まりで白黒が入れ替わる）。
   opt.words ＝ 下の行が空白で語を分ける言葉（英語）。折れてよいのは語と語のあいだだけ。 */
function ggJudge(g, lp, who, shape, lay, opt = {}) {
  const tone = opt.tone || { backgroundColor: lp.css.backgroundColor, color: lp.css.color };
  const want = k => (k in tone ? tone[k] : lp.css[k]);
  /* a) 形 ＝ トップの黒いボタン */
  const diff = [...new Set(GG_KEYS.filter(k => g.css[k] !== want(k)).map(k => `${GG_NAME[k]} ${g.css[k]}（${k in tone && opt.tone ? 'あるべき' : 'トップは'} ${want(k)}）`))];
  if (diff.length) shape.push(`${who}: ${diff.join('・')}`);
  if (!/(^|-)flex$/.test(g.display)) shape.push(`${who}: 並べ方が ${g.display}`);
  if (g.box.h < lp.box.h - 0.5) shape.push(`${who}: 高さ ${g.box.h.toFixed(1)}（トップは ${lp.box.h.toFixed(1)}）`);
  if (!(g.svg && lp.svg && Math.abs(g.svg.w - lp.svg.w) <= 0.5 && Math.abs(g.svg.h - lp.svg.h) <= 0.5)) shape.push(`${who}: 矢印の大きさが違う（${g.svg ? g.svg.w + '×' + g.svg.h : '無い'}）`);
  /* b) 2行：同じ大きさ・同じ太さ・同じ濃さ・まんなか・上が「Give & Get」 */
  if (g.lines.length !== 2) { lay.push(`${who}: 字が ${g.lines.length}行（あるべき 2行）`); return; }
  const [k, m] = g.lines;
  if (!(k.text === GG && k.lang === 'en')) lay.push(`${who}: 上の行が「${k.text}」`);
  if (!(k.box.b <= m.box.t + 1)) lay.push(`${who}: 2行が上下に積まれていない`);
  for (const [l, name] of [[k, '上の行'], [m, '下の行']]) {
    if (l.size !== lp.css.fontSize || l.weight !== lp.css.fontWeight) shape.push(`${who}: ${name}が ${l.size}・太さ ${l.weight}（トップは ${lp.css.fontSize}・${lp.css.fontWeight}）`);
    if (l.op !== '1' || l.color !== want('color')) shape.push(`${who}: ${name}が薄い（濃さ ${l.op}・色 ${l.color}）`);
    if (l.align !== 'center') lay.push(`${who}: ${name}がまんなかに寄っていない（${l.align}）`);
    if (Math.abs((l.ink.l + l.ink.r) / 2 - (g.tbox.l + g.tbox.r) / 2) > 1) lay.push(`${who}: ${name}の字が、字の箱のまんなかに無い`);
    if (l.over > 1 || l.ink.l < g.box.l - 0.5 || l.ink.r > g.box.r + 0.5 || l.ink.t < g.box.t - 0.5 || l.ink.b > g.box.b + 0.5) lay.push(`${who}: ${name}の字がボタンからはみ出す・欠ける`);
  }
  /* b2) 折れるのは語の切れ目でだけ。上の行（Give & Get）は折れない */
  if (k.rows.length !== 1) lay.push(`${who}: 上の行が ${k.rows.length}行に折れている（${k.rows.join('／')}）`);
  const cut = opt.words ? m.text.split(' ') : GG_CUT[m.text];
  if (!cut) lay.push(`${who}: 下の行「${m.text}」の語の切れ目を、検査が知らない`);
  else {
    const mark = opt.words ? [m.text] : cut;       // 空白で分かれる言葉には、切れ目の印（<wbr>）を置かない
    if (!same(m.cut, mark)) lay.push(`${who}: 下の行の語の切れ目が「${m.cut.join('｜')}」（あるべき「${mark.join('｜')}」）`);
    const ends = new Set(cut.map((_, i) => cut.slice(0, i + 1).join('').length)), rows = m.rows.map(r => r.replace(/\s+/g, '')); let at = 0;
    if (rows.join('') !== cut.join('') || !rows.every(r => ends.has(at += r.length))) lay.push(`${who}: 下の行が語の途中で折れている（${m.rows.join('／')}）`);
  }
  if (g.cutBy) lay.push(`${who}: 親の箱（${g.cutBy}）に切り落とされている`);
  /* c) 中身（字の箱＋矢印）がボタンのまんなか・切れない・カードと画面の中 */
  const padL = parseFloat(g.css.paddingLeft), padR = parseFloat(g.css.paddingRight);
  const left = g.tbox.l - g.box.l - padL, right = g.box.r - padR - (g.svg ? g.svg.r : g.tbox.r);
  if (Math.abs(left - right) > 1.5 || left < -0.5) lay.push(`${who}: 中身がボタンのまんなかに無い（左の空き ${left.toFixed(1)}・右の空き ${right.toFixed(1)}）`);
  if (g.clipX > 1 || g.clipY > 1) lay.push(`${who}: 中身がボタンに入りきらない（横 ${g.clipX}・縦 ${g.clipY}）`);
  if (g.box.l < -0.5 || g.box.r > g.vw + 0.5) lay.push(`${who}: 画面の外へ出ている（${Math.round(g.box.l)}〜${Math.round(g.box.r)}・画面 ${g.vw}）`);
  if (g.card && (g.box.l < g.card.l - 0.5 || g.box.r > g.card.r + 0.5)) lay.push(`${who}: カードの外へ出ている`);
}
const GG_W = [320, 390, 768, 1440];
/* タブごとに、出ているはずのボタン（置き場 → 下の行の字）。上の行は全部「Give & Get」。 */
const GG_FACE = {
  overview: [['pay', '全ての給与情報を解放する'], ['score-overview', RV_GIVE.overview]],
  pay: [['pay', '全ての給与情報を解放する']],
  reviews: [['score-reviews', RV_GIVE.reviews], ['list', RV_GIVE.reviews]],
};
/* ★2026-10-09 「続きを読む」の小窓（鍵の無い人が押した時に出る）も、同じボタン。口コミのタブに居るまま開いて測る。
   ここだけ古い橙の四角いボタンと、色を直書きした黒い板のままだった（測っていなかったので、検査は通っていた）。 */
const GG_ALL = { ...GG_FACE, dialog: [['dialog', RV_GIVE.reviews]] };
const GG_AT = { ...TAB_NAME, dialog: '続きを読むの小窓' };
async function runGG(browser, s, [w, h]) {
  const tag = `${s} ${w}（Give & Get のボタン）`;
  const lp = await ggBase(browser);
  if (!lp) { ok(false, `${tag}: トップページのいちばん上の黒いボタンを測れた（基準）`); return; }
  /* 鍵の無い人に口コミが在る時 ＝ 一覧の錠前のボタンまで出る形 */
  const { ctx, p, ready } = await open(browser, s, w, h, 'rated');
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  try {
    ok(ready, `${tag}: 開ける`);
    /* 動きの決まり（transition）まで比べるので、測るあいだだけ「動きを減らす」を外す（トップも外した状態で測ってある）。 */
    const measure = async () => {
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      const r = await p.evaluate(ggSee, GG_KEYS, '');
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      return r;
    };
    const shape = [], lay = [], dlg = [], seenAt = {};
    const gateOpen = () => { const e = document.querySelector('#pv-readmore-gate .pv-gg'); return !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true }); };
    for (const t of Object.keys(GG_ALL)) {
      if (t === 'dialog') {
        /* 「続きを読む」を押した時と同じ口を呼ぶ（鍵の無い人 ＝ 本文は出ず、小窓が開く） */
        await p.evaluate(() => window.pvReadMore('pvg-none', ''));
        if (!(await until(gateOpen))) { dlg.push('小窓が開かない'); continue; }
      } else if (t !== 'overview') {
        await p.evaluate(sel => document.querySelector(sel).click(), `.pvg-tabs [data-pvg-tab="${t}"]`);
        if (!(await until(t => window.PVGlance.at() === t, t))) { lay.push(`「${GG_AT[t]}」へ切り替わらない`); continue; }
      }
      /* 出ているはずのボタンが全部そろうまで待つ（一覧の錠前は、口コミを読み終えてから出る） */
      const want = GG_ALL[t];
      if (t !== 'dialog') await until(n => [...document.querySelectorAll('.pv-gg')].filter(e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true })).length >= n, want.length);
      /* 小窓の番では小窓の中だけ、ほかの番ではページの中だけを見る（小窓のうしろに、ページのボタンは出たまま） */
      const got = (await measure()).filter(g => (t === 'dialog') === (g.where === 'dialog'));
      seenAt[t] = got.map(g => g.where);
      for (const [where, main] of want) {
        const hit = got.filter(g => g.where === where);
        if (hit.length !== 1) lay.push(`「${GG_AT[t]}」の ${where} のボタンが ${hit.length}つ（あるべき 1つ）`);
        else if (hit[0].text !== `${GG}／${main}`) lay.push(`「${GG_AT[t]}」の ${where} の字が「${hit[0].text}」（あるべき「${GG}／${main}」）`);
      }
      const extra = got.filter(g => !want.some(x => x[0] === g.where));
      if (extra.length) lay.push(`「${GG_AT[t]}」に、決めていない置き場のボタンが在る（${extra.map(g => g.where + '「' + g.text + '」').join('・')}）`);
      for (const g of got) ggJudge(g, lp, `「${GG_AT[t]}」の ${g.where}`, shape, lay);
      if (t === 'dialog') {
        /* 小窓そのもの：画面の中に収まる・ボタンは1つでまんなか・板の色はサイトの色（明暗に付いていく）・
           押せるものに状態と 44px・開くと中のボタンへ移る・Esc で閉じて開き直せる（開き直しても増えない）。 */
        const d = await p.evaluate(() => {
          const gate = document.getElementById('pv-readmore-gate'), bx = gate.querySelector('.pvg-rmg-box'), btn = gate.querySelector('.pv-gg');
          if (!bx || !btn) return null;
          const root = document.documentElement, was = root.getAttribute('data-theme');
          const tone = () => {
            const pr = document.createElement('i'); pr.style.cssText = 'position:fixed;left:-99px;top:0;background:var(--pv-surface);color:var(--pv-text)'; document.body.appendChild(pr);
            const a = getComputedStyle(bx), b = getComputedStyle(pr), o = { bg: a.backgroundColor, ink: a.color, wbg: b.backgroundColor, wink: b.color }; pr.remove(); return o;
          };
          const now = tone();
          root.setAttribute('data-theme', was === 'dark' ? 'light' : 'dark');
          const other = tone();
          if (was === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', was);
          const r = bx.getBoundingClientRect(), b = btn.getBoundingClientRect(), ttl = document.getElementById(bx.getAttribute('aria-labelledby') || '-');
          const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: document.documentElement.clientWidth, vh: window.innerHeight, off: Math.abs((b.left + b.right) / 2 - (r.left + r.right) / 2),
            role: bx.getAttribute('role'), modal: bx.getAttribute('aria-modal'), named: !!ttl && !!ttl.textContent.trim(),
            n: gate.querySelectorAll('.pv-gg').length, old: gate.querySelectorAll('.btn-review-post, .pvg-rmg-box [style]').length, hit: !!top && btn.contains(top),
            now, other, focus: btn.contains(document.activeElement) };
        });
        if (!d) dlg.push('小窓の板かボタンが無い');
        else {
          if (d.l < -0.5 || d.r > d.vw + 0.5 || d.t < -0.5 || d.b > d.vh + 0.5) dlg.push(`板が画面の外へ出る（左 ${Math.round(d.l)}・右 ${Math.round(d.r)}・上 ${Math.round(d.t)}・下 ${Math.round(d.b)}／画面 ${d.vw}×${d.vh}）`);
          if (d.off > 1) dlg.push(`ボタンが板のまんなかに無い（${d.off.toFixed(1)}px ずれ）`);
          if (d.n !== 1 || d.old) dlg.push(`ボタンが ${d.n}つ・古い橙のボタンや直書きの見た目が ${d.old}つ`);
          if (!d.hit) dlg.push('ボタンの上に別のものが被っている');
          for (const [x, name] of [[d.now, 'いまの明暗'], [d.other, '反対の明暗']]) if (x.bg !== x.wbg || x.ink !== x.wink) dlg.push(`${name}で、板の色がサイトの色でない（地 ${x.bg}・字 ${x.ink}／あるべき ${x.wbg}・${x.wink}）`);
          if (d.now.bg === d.other.bg) dlg.push(`明るい・暗いを替えても、板の色が変わらない（${d.now.bg}）`);
          if (!(d.role === 'dialog' && d.modal === 'true' && d.named)) dlg.push('読み上げ向けの名札（dialog・見出しの名前）が無い');
          if (!d.focus) dlg.push('開いた時に、中のボタンへ移っていない（キーボードで使う人が、幕のうしろに取り残される）');
        }
        const pr = await p.evaluate(() => window.__pvg.probe('#pv-readmore-gate'));
        dlg.push(...[...pr.small, ...pr.tap, ...pr.bare].slice(0, 6));
        {
          /* 小窓が開いているあいだ、Tab は小窓の中だけを回る（幕のうしろのリンクへ出ていかない）。前へ4回・後ろへ5回 ＝ どちらの端も1度は越える。 */
          let out = 0;
          for (const back of [0, 0, 0, 0, 1, 1, 1, 1, 1]) {
            if (back) await p.keyboard.down('Shift');
            await p.keyboard.press('Tab');
            if (back) await p.keyboard.up('Shift');
            if (!(await p.evaluate(() => document.getElementById('pv-readmore-gate').contains(document.activeElement)))) out++;
          }
          if (out) dlg.push(`Tab を押すと、幕のうしろへ出ていく（9回のうち ${out}回）`);
        }
        await p.keyboard.press('Escape');
        if (!(await until(() => getComputedStyle(document.getElementById('pv-readmore-gate')).display === 'none'))) dlg.push('Esc で閉じない');
        await p.evaluate(() => window.pvReadMore('pvg-none', ''));
        if (!(await until(gateOpen))) dlg.push('閉じたあと、もう一度開けない');
        else if ((await p.evaluate(() => document.querySelectorAll('#pv-readmore-gate').length)) !== 1) dlg.push('開き直すたびに、小窓が増える');
      }
      if (process.env.PV_GLANCE_SHOT) {
        const y = await p.evaluate(() => { const e = [...document.querySelectorAll('.pv-gg')].find(x => x.getClientRects().length > 0); if (!e) return 0; e.scrollIntoView({ block: 'center' }); return 1; });
        if (y) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/gg-${s}-${w}-${t}.png` });
      }
    }
    ok(!shape.length, `${tag}: 形がトップのいちばん上の黒いボタンと同じ（丸い形・16px・太さ 600・余白・色・影・動き）── 概要／給与・待遇／口コミ／「続きを読む」の小窓で変わらない`, [...new Set(shape)].slice(0, 8).join('\n      '));
    ok(!lay.length, `${tag}: 2行ともまんなか・同じ大きさと濃さ・字が欠けない・カードと画面の中 ── 出ているのは決めた置き場だけ`, [...new Set(lay)].slice(0, 8).join('\n      ') + (lay.length ? `\n      見えていた置き場: ${JSON.stringify(seenAt)}` : ''));
    ok(!dlg.length, `${tag}: 「続きを読む」の小窓 ── 画面の中に収まる・同じボタンが1つでまんなか・板はサイトの色（明るい・暗いの両方）・押せるものに状態と 44px・開くと中のボタンへ移る・Esc で閉じて開き直せる`, [...new Set(dlg)].slice(0, 8).join('\n      '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* ★2026-10-09 旧い形の会社ページ（タブを JS が作る形 ＝ 日本語の5社のほか全部と、英語版の全部）の鍵の面。
   同じボタンを、共有の JS 2本（premium-auth-lock.js・airline-reviews-ui.js）が出す。1枚を日英で実際に開いて測る。
     明るい画面 … 形がトップの黒いボタンと同じ／2行ともまんなか／語の途中で折れない／箱と画面の中
     暗い画面   … 色がサイトの色の決まりに付いていく（白黒が入れ替わる）
     小窓       … 板は明暗によらず暗い色なので、ボタンは暗い側の色。見出しと説明の字が板の上で読める
     行き先     … 給与の錠前は給与の提出へ（戻り先つき）・口コミは投稿の入口へ。古いボタンと同じ
     出ていないもの … 古い橙のボタン・GIVE → GET の札・カード1枚ごとの解除ボタン・待ち受けの箱
   ⚠️ 形のファイル（pv-gg.css）が読めない時は、古いボタンのまま出る（素の字のボタンを出さない）── 読めなくして確かめる。
   ⚠️ 2本の JS は版の印なしで読まれる ＝ 最大4時間、片方だけ古いことがある。錠前の JS が無い（＝合図が無い）時、
      口コミの側は古いボタンのままで居る ── 錠前の JS を止めて確かめる。
   ここの口コミは、決まった返事（鍵の無い人に返る3件）で描かせる。本番の DB は読まない。 */
const OLD_SAMPLE = 'emirates';
const OLD_PATH = { ja: '/airlines/' + OLD_SAMPLE + '.html', en: '/en/airlines/' + OLD_SAMPLE + '.html' };
const OLD_PAY = { ja: '/pay-report.html', en: '/en/pay-report.html' };
const OLD_POST = 'if(window.openReviewModal)openReviewModal()';
const OLD_AT = { lock: '給与の錠前', voices: '概要の「海外の評判」の鍵', list: '口コミの一覧の鍵', dialog: '続きを読むの小窓' };
/* 日本語の旧い形のページは、検索に渡す構造化データの件数を数え直すために、口コミの表へ「件数だけ」を聞く（airline-base.js）。0件で返す。 */
const OLD_COUNT_RE = /\/rest\/v1\/reviews_v2$/;
/* 字と地の明るさの比（WCAG の式）。色は rgb()／rgba() の字で届く。 */
const lumOf = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const [r, g, b] = m[1].split(/[,\s/]+/).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lumOf(a), y = lumOf(b); return x === null || y === null ? 0 : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function openOld(browser, lang, w, h, { block = '', stale = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const seen = { unknown: new Set(), asked: 0 };
  const who = `旧い形 ${lang} ${w}`;
  p.setDefaultTimeout(30000);
  p.on('pageerror', e => trouble.push(`${who}: ${String(e.message).slice(0, 140)}`));
  p.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) trouble.push(`${r.status()} ${r.url()}`); });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  /* 明るい画面から測る（英語ページの既定は暗い画面。トップの基準は明るい画面で測ってある）。 */
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('pv-theme', 'light'); } catch (e) { /* 保存領域が無い時は既定のまま */ } });
  /* 手元の鍵の控えだけが残っている人（控えは「口コミが読める」と言うが、サーバは伏せて返す）。ログインの印は置かない。 */
  if (stale) await p.evaluateOnNewDocument(() => { try { localStorage.setItem('pv_unlock_expiry', String(Date.now() + 365 * 864e5)); } catch (e) { /* 保存領域が無い時は置けない ＝ 下で「控えが生きている」が落ちる */ } });
  await p.setRequestInterception(true);
  p.on('request', r => {
    let u; try { u = new URL(r.url()); } catch { return r.continue(); }
    if (['data:', 'blob:', 'about:'].includes(u.protocol)) return r.continue();
    if (u.origin === BASE) {
      if (block === 'css' && u.pathname === '/pv-gg.css') return r.abort();
      /* 空のファイルが 200 で届く（配信の途中・切れた写し）。読み込みは「成功」で終わるが、決まりは1つも入っていない。 */
      if (block === 'empty' && u.pathname === '/pv-gg.css') return r.respond({ status: 200, contentType: 'text/css', body: '' });
      if (block === 'lock' && u.pathname === '/airlines/premium-auth-lock.js') return r.abort();
      return r.continue();
    }
    if (LIBS.test(u.hostname)) return r.continue();
    if (/\.supabase\.co$/.test(u.hostname)) {
      const cors = { 'access-control-allow-origin': '*' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS', 'access-control-allow-headers': r.headers()['access-control-request-headers'] || '*' } });
      seen.asked++;
      if (REV_RE.test(u.pathname)) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: ratedBody(OLD_SAMPLE) });
      if (r.method() === 'HEAD' && OLD_COUNT_RE.test(u.pathname)) return r.respond({ status: 200, headers: { ...cors, 'access-control-expose-headers': 'content-range', 'content-range': '*/0' } });
      const hit = STUB.find(([re]) => re.test(u.pathname));
      if (hit && hit[0] === FACT_RE) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: factBody('') });
      if (hit) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: hit[1] });
      seen.unknown.add(`${r.method()} ${u.pathname}`);
      return r.respond({ status: 500, contentType: 'application/json', headers: cors, body: '{"message":"stub"}' });
    }
    return r.abort();
  });
  await p.goto(BASE + OLD_PATH[lang], { waitUntil: 'load', timeout: 60000 });
  /* 落ち着くまで待つ：タブが出来た・形のファイルの合否が出た（錠前の JS を止めた回は、合図そのものが無い）・
     「海外の評判」の鍵が描かれた・待ち受けの箱が残っていない・錠前の掛かった面の全部に板が出た
     （板はログインの確認のあとに出る ＝ 形の合否より遅いことがある。待たずに数えると、混んだ回に嘘の赤が出る）。
     ⚠️ 口コミの一覧は、口コミのタブを開いた時に初めて描かれる。ここで待つと、必ず時間切れになる。 */
  const ready = await p.waitForFunction(lockOff => !!document.querySelector('.airline-tab-btn') &&
    (lockOff ? !window.PVGG : !!window.PVGG && /^(yes|no)$/.test(window.PVGG.state())) &&
    (lockOff || [...document.querySelectorAll('.premium-gate.pv-locked')].every(g => !!g.querySelector('.pv-gate-card'))) &&
    !!document.querySelector('#airline-voices .rv-post-gate') && !document.querySelector('[data-pvgg-wait]'), {}, block === 'lock').then(() => true, () => false);
  await p.evaluate(() => document.fonts.ready.then(() => true));
  return { ctx, p, seen, ready };
}
/* ページの中で動く：タブの一覧と、錠前の面がどのタブに居るか。 */
function oldMap() {
  return {
    tabs: [...document.querySelectorAll('.airline-tab-btn')].map(b => b.dataset.tab),
    gates: [...document.querySelectorAll('.premium-gate')].map(g => ({ tab: g.dataset.tabSection || '', locked: g.classList.contains('pv-locked'), cards: g.querySelectorAll('.pv-gate-card').length })),
    voices: !!document.getElementById('airline-voices'),
    state: window.PVGG ? window.PVGG.state() : '',
    path: location.pathname,
  };
}
/* ページの中で動く：古い形のボタンと札を数える（見えているものだけ）。 */
function oldLeft() {
  const on = e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
  const n = s => [...document.querySelectorAll(s)].filter(on).length;
  const a = [...document.querySelectorAll('.pv-gate-card a.pv-btn-main')].filter(on).map(e => ({ href: e.getAttribute('href') || '', cta: e.getAttribute('data-pv-cta') || '', text: e.textContent.replace(/\s+/g, ' ').trim() }));
  return { main: a, pills: n('.pv-gate-card .pv-give-take'), card: n('.rv-locked-btn'), list: n('#airline-review-section .rv-post-gate .btn-review-post'), voices: n('#airline-voices .rv-post-gate .btn-review-post'),
    dialog: n('#pv-readmore-gate .btn-review-post'), gg: n('.pv-gg'), wait: document.querySelectorAll('[data-pvgg-wait]').length, hit: window.__pvgHit === 1,
    /* 口コミの側の今までのボタン：見えているものの字と押した先（数だけでは、字や行き先が変わっても気づけない） */
    old: (o => [...o('.rv-locked-btn', 'card'), ...o('#airline-review-section .rv-post-gate .btn-review-post', 'list'), ...o('#airline-voices .rv-post-gate .btn-review-post', 'voices'), ...o('#pv-readmore-gate .btn-review-post', 'dialog')])(
      (sel, at) => [...document.querySelectorAll(sel)].filter(on).map(e => ({ at, text: e.textContent.replace(/\s+/g, ' ').trim(), onclick: e.getAttribute('onclick') || '' }))) };
}
/* タブを押して、切り替わるまで待つ。口コミのタブは、押した時に一覧を描く ＝ 一覧の鍵が出て、待ち受けの箱が無くなるまで待つ。 */
const oldTab = async (p, tab) => {
  await p.evaluate(t => document.querySelector('.airline-tab-btn[data-tab="' + t + '"]').click(), tab);
  return p.waitForFunction(t => { const b = document.querySelector('.airline-tab-btn[data-tab="' + t + '"]'); return !!b && b.classList.contains('active') &&
    (t !== 'reviews' || (!!document.querySelector('#airline-review-section .rv-post-gate') && !document.querySelector('[data-pvgg-wait]'))); }, { timeout: 8000 }, tab).then(() => true, () => false);
};
/* 給与の錠前の行き先：給与の提出のページ・戻り先はこのページ。 */
const oldPayBad = (href, lang) => {
  let u; try { u = new URL(href, BASE + OLD_PATH[lang]); } catch { return `読めない行き先「${href}」`; }
  if (u.origin !== BASE || u.pathname !== OLD_PAY[lang]) return `行き先が ${u.pathname}（あるべき ${OLD_PAY[lang]}）`;
  if (u.searchParams.get('return') !== OLD_PATH[lang]) return `戻り先が「${u.searchParams.get('return')}」（あるべき ${OLD_PATH[lang]}）`;
  return '';
};

async function runGGOld(browser, lang, [w, h]) {
  const tag = `旧い形の会社ページ ${lang} ${w}（Give & Get のボタン）`;
  const lp = await ggBase(browser);
  if (!lp) { ok(false, `${tag}: トップページのいちばん上の黒いボタンを測れた（基準）`); return; }
  const html = read((lang === 'en' ? 'en/' : '') + 'airlines/' + OLD_SAMPLE + '.html');
  const nGate = (html.match(/class="premium-gate[" ]/g) || []).length;
  const { ctx, p, seen, ready } = await openOld(browser, lang, w, h);
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  try {
    ok(ready, `${tag}: 開ける（タブ・形のファイルの合否・「海外の評判」の鍵がそろう）`);
    const map = await p.evaluate(oldMap);
    const shape = [], lay = [], dest = [], dark = [], dlg = [], seenAt = {};
    ok(map.state === 'yes', `${tag}: 形のファイル（pv-gg.css）を読めた`, `合図 ＝「${map.state}」`);
    ok(nGate > 0 && map.gates.length === nGate && map.gates.every(g => g.locked && g.cards === 1 && map.tabs.includes(g.tab)) && map.voices,
      `${tag}: 見本のページに、測る面がそろっている（給与の錠前 ${nGate}つ・「海外の評判」の鍵・口コミの一覧の鍵）`, JSON.stringify(map));
    const measure = async () => {
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
      const r = await p.evaluate(ggSee, GG_KEYS, '');
      await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      return r;
    };
    /* 暗い画面での色：サイトの色の決まり（--pv-cta-dark／--pv-cta-dark-ink）に付いていく。その場で明暗を替えて読み、戻す。 */
    const flip = () => p.evaluate(() => {
      const on = e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
      const root = document.documentElement, was = root.getAttribute('data-theme');
      const read = () => {
        const pr = document.createElement('i'); pr.style.cssText = 'position:fixed;left:-99px;top:0;background:var(--pv-cta-dark);color:var(--pv-cta-dark-ink)'; document.body.appendChild(pr);
        const s = getComputedStyle(pr), want = { bg: s.backgroundColor, ink: s.color }; pr.remove();
        return { want, got: [...document.querySelectorAll('.pv-gg')].filter(on).filter(e => !e.closest('#pv-readmore-gate')).map(e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, ink: c.color }; }) };
      };
      const light = read();
      root.setAttribute('data-theme', 'dark');
      const dk = read();
      if (was === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', was);
      return { was, light, dk };
    });
    const face = { lock: OLD_GG[lang].pay, voices: OLD_GG[lang].top, list: OLD_GG[lang].all, dialog: OLD_GG[lang].all };
    let locks = 0;
    /* 古い形のものは、タブごとに数えて足す（見えているものだけを数えるので、いま開いているタブの分しか数えられない。
       口コミのタブでだけ数えていた時は、別のタブの錠前に残った古い橙のボタンを見逃していた）。 */
    const leftAll = { main: [], pills: 0, card: 0, list: 0, voices: 0, wait: 0 };
    for (const tab of map.tabs) {
      if (!(await oldTab(p, tab))) { lay.push(`「${tab}」のタブへ切り替わらない`); continue; }
      const want = [...map.gates.filter(g => g.tab === tab).map(() => 'lock'), ...(tab === 'overview' ? ['voices'] : []), ...(tab === 'reviews' ? ['list'] : [])];
      await until(n => [...document.querySelectorAll('.pv-gg')].filter(e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true })).length >= n, want.length);
      const got = (await measure()).filter(g => g.where !== 'dialog');
      seenAt[tab] = got.map(g => g.where);
      const lf = await p.evaluate(oldLeft);
      for (const k of ['pills', 'card', 'list', 'voices', 'wait']) leftAll[k] += lf[k];
      leftAll.main.push(...lf.main.map(x => `「${tab}」: ${x.text}`));
      if (!same([...seenAt[tab]].sort(), [...want].sort())) lay.push(`「${tab}」のタブに出ているボタンが ${JSON.stringify(seenAt[tab])}（あるべき ${JSON.stringify(want)}）`);
      for (const g of got) {
        const who = `「${tab}」のタブの${OLD_AT[g.where] || g.where}`;
        if (g.text !== `${GG}／${face[g.where]}`) lay.push(`${who}: 字が「${g.text}」（あるべき「${GG}／${face[g.where]}」）`);
        ggJudge(g, lp, who, shape, lay, { words: lang === 'en' });
        if (!g.host) lay.push(`${who}: すぐ外の箱が見つからない`);
        else {
          if (g.box.l < g.host.l - 0.5 || g.box.r > g.host.r + 0.5) lay.push(`${who}: 箱の外へ出ている`);
          if (Math.abs((g.box.l + g.box.r) / 2 - (g.host.l + g.host.r) / 2) > 1.5) lay.push(`${who}: 箱のまんなかに無い（${((g.box.l + g.box.r) / 2 - (g.host.l + g.host.r) / 2).toFixed(1)}px ずれ）`);
        }
        if (g.where === 'lock') {
          locks++;
          const bad = g.tag !== 'A' ? `リンクでない（${g.tag}）` : g.cta !== 'salary' ? `数える印が「${g.cta}」（あるべき salary）` : oldPayBad(g.href, lang);
          if (bad) dest.push(`${who}: ${bad}`);
        } else if (!(g.tag === 'BUTTON' && g.onclick === OLD_POST && !g.href)) dest.push(`${who}: 押した先が口コミの投稿の入口でない（${g.tag}・${g.onclick || g.href}）`);
      }
      if (got.length) {
        const f = await flip();
        if (f.was !== 'light') dark.push(`「${tab}」: 明るい画面で開いていない（${f.was}）`);
        for (const [x, name] of [[f.light, '明るい画面'], [f.dk, '暗い画面']]) if (!x.got.length || !x.got.every(c => c.bg === x.want.bg && c.ink === x.want.ink)) dark.push(`「${tab}」の${name}: ボタンの色が ${JSON.stringify(x.got[0] || null)}（あるべき ${JSON.stringify(x.want)}）`);
        if (f.light.want.bg === f.dk.want.bg) dark.push(`「${tab}」: 明るい・暗いを替えても、ボタンの色が変わらない（${f.light.want.bg}）`);
        else if (contrast(f.dk.want.bg, f.dk.want.ink) < 4.5 || contrast(f.light.want.bg, f.light.want.ink) < 4.5) dark.push(`「${tab}」: ボタンの字が地の上で読みにくい`);
      }
      if (process.env.PV_GLANCE_SHOT) {
        const y = await p.evaluate(() => { const e = [...document.querySelectorAll('.pv-gg')].find(x => x.getClientRects().length > 0); if (!e) return 0; document.documentElement.style.scrollBehavior = 'auto'; const r = e.getBoundingClientRect(); scrollTo(0, Math.max(0, scrollY + r.top + r.height / 2 - innerHeight / 2)); return 1; });
        if (y) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/ggold-${lang}-${w}-${tab}.png` });
      }
    }
    if (locks !== nGate) lay.push(`給与の錠前のボタンが、全部のタブを回って ${locks}つ（あるべき ${nGate}つ ＝ 錠前の面の数）`);
    /* 古い形のものが、どのタブにも残っていない */
    ok(!leftAll.main.length && !leftAll.pills && !leftAll.card && !leftAll.list && !leftAll.voices && !leftAll.wait,
      `${tag}: 古い橙のボタン・GIVE → GET の札・カード1枚ごとの解除ボタン・待ち受けの箱が、1つも残っていない`, JSON.stringify(leftAll));
    if (map.tabs.includes('reviews')) await oldTab(p, 'reviews');
    const left = await p.evaluate(oldLeft);
    ok(!left.hit, `${tag}: 口コミの職位・在籍年数に書かれたタグが、働いていない`);
    /* 「続きを読む」の小窓（鍵の無い人が押した時） */
    await p.evaluate(() => window.pvReadMore('pvg-none', ''));
    if (!(await until(() => { const e = document.querySelector('#pv-readmore-gate .pv-gg'); return !!e && e.getClientRects().length > 0; }))) dlg.push('小窓が開かない・同じボタンが出ない');
    else {
      const d = await p.evaluate(() => {
        const gate = document.getElementById('pv-readmore-gate'), bx = gate.firstElementChild, btn = gate.querySelector('.pv-gg');
        const pr = document.createElement('i'); pr.setAttribute('data-theme', 'dark'); pr.style.cssText = 'position:fixed;left:-99px;top:0;background:var(--pv-cta-dark);color:var(--pv-cta-dark-ink)'; document.body.appendChild(pr);
        const s = getComputedStyle(pr), tone = { backgroundColor: s.backgroundColor, color: s.color }; pr.remove();
        const r = bx.getBoundingClientRect(), bg = getComputedStyle(bx).backgroundColor;
        const words = [...bx.querySelectorAll('*')].filter(e => !e.closest('.pv-gg') && e.getClientRects().length > 0 && [...e.childNodes].some(n => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.nodeValue)))
          .map(e => ({ text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24), ink: getComputedStyle(e).color }));
        const top = (b => document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2))(btn.getBoundingClientRect());
        return { tone, bg, theme: bx.getAttribute('data-theme') || '', words, n: gate.querySelectorAll('.pv-gg').length, old: gate.querySelectorAll('.btn-review-post').length, hit: !!top && btn.contains(top),
          l: r.left, r: r.right, t: r.top, b: r.bottom, vw: document.documentElement.clientWidth, vh: window.innerHeight };
      });
      const got = (await measure()).filter(g => g.where === 'dialog');
      if (got.length !== 1 || d.n !== 1 || d.old) dlg.push(`小窓のボタンが ${d.n}つ・古い橙のボタンが ${d.old}つ（あるべき 同じボタンが 1つだけ）`);
      for (const g of got) {
        const who = OLD_AT.dialog;
        if (g.text !== `${GG}／${face.dialog}`) dlg.push(`字が「${g.text}」（あるべき「${GG}／${face.dialog}」）`);
        /* 板は明暗によらず暗い色 ＝ ボタンは暗い側の色（地と字だけが違い、ほかの形はトップと同じ） */
        const sh = [], la = [];
        ggJudge(g, lp, who, sh, la, { words: lang === 'en', tone: d.tone });
        dlg.push(...sh, ...la);
        if (g.host && Math.abs((g.box.l + g.box.r) / 2 - (g.host.l + g.host.r) / 2) > 1.5) dlg.push('ボタンが板のまんなかに無い');
        if (!(g.tag === 'BUTTON' && g.onclick === OLD_POST)) dlg.push(`押した先が口コミの投稿の入口でない（${g.onclick}）`);
        if (contrast(g.css.backgroundColor, d.bg) < 3) dlg.push(`ボタンが板の色に沈んでいる（ボタン ${g.css.backgroundColor}・板 ${d.bg}）`);
      }
      if (d.theme !== 'dark') dlg.push(`板に「暗い側の色で描く」の印が無い（${d.theme || '無し'}）`);
      if (!d.hit) dlg.push('ボタンの上に別のものが被っている');
      if (d.l < -0.5 || d.r > d.vw + 0.5 || d.t < -0.5 || d.b > d.vh + 0.5) dlg.push(`板が画面の外へ出る（左 ${Math.round(d.l)}・右 ${Math.round(d.r)}・上 ${Math.round(d.t)}・下 ${Math.round(d.b)}／画面 ${d.vw}×${d.vh}）`);
      /* 板の上の字が読める（明るい画面では、色を直書きした字を濃い色へ替える決まりが在り、見出しが板に沈んでいた） */
      const dim = d.words.filter(x => contrast(x.ink, d.bg) < 3);
      if (!d.words.length || dim.length) dlg.push(`板の上の字が読めない（${dim.map(x => `「${x.text}」${x.ink}`).join('・') || '字が無い'}／板 ${d.bg}）`);
      if (process.env.PV_GLANCE_SHOT) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/ggold-${lang}-${w}-dialog.png` });
    }
    ok(!shape.length, `${tag}: 形がトップのいちばん上の黒いボタンと同じ（丸い形・16px・太さ 600・余白・色・影・動き）── 給与の錠前／「海外の評判」の鍵／口コミの一覧の鍵で変わらない`, [...new Set(shape)].slice(0, 8).join('\n      '));
    ok(!lay.length, `${tag}: 2行ともまんなか・同じ大きさと濃さ・字が欠けない・語の途中で折れない・箱と画面の中 ── 出ているのは決めた置き場だけ`, [...new Set(lay)].slice(0, 8).join('\n      ') + (lay.length ? `\n      見えていた置き場: ${JSON.stringify(seenAt)}` : ''));
    ok(!dest.length, `${tag}: 行き先が古いボタンと同じ（給与の錠前 → 給与の提出・戻り先つき／口コミ → 投稿の入口）`, [...new Set(dest)].slice(0, 6).join('\n      '));
    ok(!dark.length, `${tag}: 暗い画面では、ボタンの色がサイトの色の決まりに付いていく（白黒が入れ替わり、字が読める）`, [...new Set(dark)].slice(0, 6).join('\n      '));
    ok(!dlg.length, `${tag}: 「続きを読む」の小窓 ── 同じボタンが1つでまんなか・暗い板の上で見える色・見出しと説明が読める・画面の中`, [...new Set(dlg)].slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 決まった返事を用意していない口を、ページが呼んでいない`, [...seen.unknown].join('・'));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 形のファイルが読めない時（block 'css'）・空で届いた時（block 'empty'）と、錠前の JS が無い時（block 'lock'）：古いボタンのまま出る。
   「古いボタンのまま」＝ 数だけでなく、字も押した先も今までと同じ（OLD_WAS・OLD_CLICK）。 */
async function runGGOldOff(browser, lang, [w, h], block) {
  const tag = `旧い形の会社ページ ${lang} ${w}（${block === 'css' ? '形のファイルが読めない時' : block === 'empty' ? '形のファイルが空で届いた時' : '錠前の JS が無い時'}）`;
  const html = read((lang === 'en' ? 'en/' : '') + 'airlines/' + OLD_SAMPLE + '.html');
  const nGate = (html.match(/class="premium-gate[" ]/g) || []).length;
  const { ctx, p, ready } = await openOld(browser, lang, w, h, { block });
  try {
    ok(ready, `${tag}: 開ける`);
    const map = await p.evaluate(oldMap);
    const bad = [];
    if (block !== 'lock' && map.state !== 'no') bad.push(`合図が「${map.state}」（あるべき no）`);
    const oldBad = (b, who) => { if (b.text !== OLD_WAS[lang][b.at]) bad.push(`${who}: 字が「${b.text}」（今までは「${OLD_WAS[lang][b.at]}」）`); if (b.onclick !== OLD_CLICK[b.at]) bad.push(`${who}: 押した先が「${b.onclick}」（今までは「${OLD_CLICK[b.at]}」）`); };
    let main = 0, pills = 0;
    for (const tab of map.tabs) {
      if (!(await oldTab(p, tab))) { bad.push(`「${tab}」のタブへ切り替わらない`); continue; }
      const x = await p.evaluate(oldLeft);
      if (x.gg) bad.push(`「${tab}」: 形の無い新しいボタンが ${x.gg}つ出ている`);
      if (x.wait) bad.push(`「${tab}」: 待ち受けの箱が ${x.wait}つ残っている`);
      main += x.main.length; pills += x.pills;
      for (const a of x.main) { const b = a.cta !== 'salary' ? `数える印が「${a.cta}」` : !a.text ? '字が無い' : oldPayBad(a.href, lang); if (b) bad.push(`「${tab}」の古い錠前のボタン: ${b}`);
        else if (a.text !== OLD_WAS[lang].lock) bad.push(`「${tab}」の古い錠前のボタン: 字が「${a.text}」（今までは「${OLD_WAS[lang].lock}」）`); }
      for (const b of x.old) oldBad(b, `「${tab}」の${b.at === 'card' ? '口コミ1枚ごとの古いボタン' : OLD_AT[b.at]}`);
      if (tab === 'overview' && x.voices !== 1) bad.push(`「海外の評判」の鍵の古いボタンが ${x.voices}つ（あるべき 1つ）`);
      if (tab === 'reviews' && (x.list !== 1 || x.card < 1)) bad.push(`口コミの一覧の鍵の古いボタンが ${x.list}つ・カードの解除ボタンが ${x.card}つ（あるべき 1つ・1つ以上）`);
    }
    /* 錠前の JS が無い回は、錠前の板そのものが出ない（板を出すのがその JS）。口コミの側だけを見る。 */
    if (block !== 'lock' && (main !== nGate || pills !== nGate)) bad.push(`古い錠前のボタンが ${main}つ・GIVE → GET の札が ${pills}つ（あるべき どちらも ${nGate}つ）`);
    await p.evaluate(() => window.pvReadMore('pvg-none', ''));
    const opened = await p.waitForFunction(() => { const e = document.querySelector('#pv-readmore-gate .btn-review-post'); return !!e && e.getClientRects().length > 0; }, { timeout: 8000 }).then(() => true, () => false);
    if (!opened) bad.push('小窓に古いボタンが出ない');
    else {
      const dl = (await p.evaluate(oldLeft)).old.filter(b => b.at === 'dialog');
      if (dl.length !== 1) bad.push(`小窓の古いボタンが ${dl.length}つ（あるべき 1つ）`);
      for (const b of dl) oldBad(b, OLD_AT.dialog);
    }
    if (opened && await p.evaluate(() => { const g = document.getElementById('pv-readmore-gate'); return g.querySelectorAll('.pv-gg').length > 0 || !!g.firstElementChild.getAttribute('data-theme'); })) bad.push('小窓に、形の無い新しいボタンか「暗い側の色で描く」の印が出ている');
    ok(!bad.length, `${tag}: 古いボタンのまま出る（素の字のボタンを出さない・字も行き先も今までと同じ・待ち受けの箱が残らない）`, [...new Set(bad)].slice(0, 8).join('\n      '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* ★2026-10-09 手元の鍵の控え（pv_unlock_expiry）だけが生きていて、サーバは本文を伏せて返す時。
   控えは下げる向きには直らない（別の会員でログインした・自分の口コミが消えた・ログインが切れた）。
   口コミ1枚ごとのボタンは置かない形なので、一覧のいちばん下の入口が出ていないと、伏せたカードが並ぶだけになる。 */
async function runGGOldStale(browser, lang, [w, h]) {
  const tag = `旧い形の会社ページ ${lang} ${w}（手元の鍵の控えだけが残っている時）`;
  const { ctx, p, ready } = await openOld(browser, lang, w, h, { stale: true });
  try {
    ok(ready, `${tag}: 開ける`);
    const bad = [];
    if (!(await oldTab(p, 'reviews'))) bad.push('口コミのタブを開いても、一覧のいちばん下の入口が出ない');
    const x = await p.evaluate(() => {
      const on = e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
      return { key: Number(localStorage.getItem('pv_unlock_expiry') || 0) > Date.now(), state: window.PVGG ? window.PVGG.state() : '',
        hidden: [...document.querySelectorAll('#airline-review-section .rv-srv-lock')].filter(on).length };
    });
    /* 場面が本当にその形か：控えは生きている・形は読めた・伏せたカードが並んでいる */
    if (!x.key) bad.push('手元の鍵の控えが生きていない（この場面を作れていない）');
    if (x.state !== 'yes') bad.push(`形のファイルの合図が「${x.state}」（あるべき yes）`);
    if (x.hidden < 1) bad.push('サーバが伏せて返した口コミのカードが、1枚も並んでいない');
    const got = (await p.evaluate(ggSee, GG_KEYS, '')).filter(g => g.where === 'list');
    if (got.length !== 1) bad.push(`一覧のいちばん下の入口が ${got.length}つ（あるべき 1つ）`);
    for (const g of got) {
      if (g.text !== `${GG}／${OLD_GG[lang].all}`) bad.push(`入口の字が「${g.text}」（あるべき「${GG}／${OLD_GG[lang].all}」）`);
      if (!(g.tag === 'BUTTON' && g.onclick === OLD_POST)) bad.push(`入口を押した先が口コミの投稿の入口でない（${g.tag}・${g.onclick || g.href}）`);
      if (g.box.l < -0.5 || g.box.r > g.vw + 0.5) bad.push('入口が画面の外へ出ている');
    }
    const lf = await p.evaluate(oldLeft);
    if (lf.card || lf.list || lf.wait) bad.push(`古い形のものが残っている（口コミ1枚ごとのボタン ${lf.card}・一覧の古いボタン ${lf.list}・待ち受けの箱 ${lf.wait}）`);
    ok(!bad.length, `${tag}: 伏せたカードが並ぶ一覧のいちばん下に、入口が1つ出る（字と押した先は鍵の無い人と同じ・1枚ごとのボタンは出ない）`, [...new Set(bad)].slice(0, 8).join('\n      '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 同じことを、主要5社のページ（タブのある形）で。口コミの一覧は同じ JS が描く。タブは開かない（描かれたかどうかだけを見る）。 */
async function runRatedStale(browser, s, [w, h]) {
  const tag = `${s} ${w}（手元の鍵の控えだけが残っている時）`;
  const { ctx, p, ready } = await open(browser, s, w, h, 'rated', () => { try { localStorage.setItem('pv_unlock_expiry', String(Date.now() + 365 * 864e5)); } catch (e) { /* 置けない時は、下で「控えが生きている」が落ちる */ } });
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    const GATE = '#airline-review-section .rv-post-gate';
    const drawn = await p.waitForFunction(() => !!document.querySelector('#airline-review-section .rv-srv-lock'), { timeout: 8000 }).then(() => true, () => false);
    const x = await p.evaluate(sel => {
      const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
      const b = [...document.querySelectorAll(sel + ' .pv-gg')];
      return { key: Number(localStorage.getItem('pv_unlock_expiry') || 0) > Date.now(), gates: document.querySelectorAll(sel).length, card: document.querySelectorAll('#airline-review-section .rv-locked-btn').length,
        btn: b.map(e => ({ tag: e.tagName, onclick: e.getAttribute('onclick') || '', text: [...e.querySelectorAll('.pv-gg-t > *')].map(t).join('／') })) };
    }, GATE);
    const bad = [];
    if (!x.key) bad.push('手元の鍵の控えが生きていない（この場面を作れていない）');
    if (!drawn) bad.push('サーバが伏せて返した口コミのカードが、一覧に描かれていない');
    if (x.gates !== 1 || x.btn.length !== 1) bad.push(`一覧のいちばん下の入口が ${x.gates}つ・その中のボタンが ${x.btn.length}つ（あるべき どちらも 1つ）`);
    for (const b of x.btn) {
      if (b.text !== `${GG}／${RV_GIVE.reviews}`) bad.push(`入口の字が「${b.text}」（あるべき「${GG}／${RV_GIVE.reviews}」）`);
      if (!(b.tag === 'BUTTON' && b.onclick === OLD_POST)) bad.push(`入口を押した先が口コミの投稿の入口でない（${b.tag}・${b.onclick}）`);
    }
    if (x.card) bad.push(`口コミ1枚ごとのボタンが ${x.card}つ出ている`);
    ok(!bad.length, `${tag}: 伏せたカードが並ぶ一覧のいちばん下に、入口が1つ出る（1枚ごとのボタンは出ない）`, bad.join(' ／ '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* 「自分の会社への回答が足りない人」：ログインも給与の提出も済んでいて、このページの会社は自分の会社ではなく、
   自分の会社への回答がまだ足りない人。本物のサーバーがこの人に返す状態は 'give'。
   偽のサーバーは、集計・月の勤務・補足の口で 'give' の1語だけを返し、答えるカードの口で、カードの中身を返す
   （聞く会社は ANA〔ANA のページでは JAL〕・答えた数 3・要る数 5・聞く質問2つ）。
   見るのは「ひとつ教えて」のカードの「集まった回答」の欄（答えるカードを、自分で出す欄）。
   ⚠️ 絵の検査。誰が 'give' になるか・数え方が正しいかは、本物の SQL を通す側（db/test-contrib.mjs）が見る。
   下の字は、画面に出るはずの字を検査が自分で持つもの（career-live.js から読み込まない ＝ あちらを変えたら、ここで赤くなる）。 */
const GIVE_W = [390, 768, 1440];
const GIVE_LINE = need => `自分の会社に${need}つ答えると開きます`, GIVE_HEAD = name => `${name}の待遇情報を、足りない情報から埋める`;
const GIVE_COUNT = (have, need) => `あなたが答えた項目：${have}／${need}`, GIVE_GO = '匿名で答える';
async function runGive(browser, s, [w, h]) {
  const tag = `${s} ${w}（自分の会社への回答が足りない人）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'give');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const G = giveOf(s), SEL = '.pvg-askc .pvg-got';
  /* 「集まった回答」の欄に、いま出ているもの */
  const slotOf = () => ev(sel => {
    const box = document.querySelector(sel), slot = box && box.querySelector('.crl[data-live="fact"]');
    if (!slot) return null;
    const vis = el => !!el && el.getClientRects().length > 0, tx = el => (el ? el.textContent : '').trim();
    const cards = [...slot.querySelectorAll('.crl-give')], card = cards[0] || null;
    return {
      on: vis(slot), state: slot.dataset.state, text: tx(slot), lock: [...slot.querySelectorAll('.crl-lock')].map(tx),
      cards: cards.length, cardOn: vis(card), head: card ? [...card.querySelectorAll('.crl-give-h')].map(tx) : [], count: card ? [...card.querySelectorAll('.crl-give-n')].map(tx) : [],
      links: [...slot.querySelectorAll('a')].map(a => ({ text: tx(a), href: a.getAttribute('href') || '', cls: a.className, give: a.getAttribute('data-crl-give'), inCard: !!card && card.contains(a), on: vis(a) })),
      facts: slot.querySelectorAll('.crl-fact').length,
    };
  }, SEL);
  /* 欄が「1行＋答えるカード1枚」になっているか。have・need ＝ 偽のサーバーが返した数（画面は、その数のまま出す） */
  const cardBad = (g, have, need) => {
    if (!g) return ['「集まった回答」の欄が無い'];
    const bad = [];
    if (!g.on) bad.push('欄が見えていない');
    if (g.state !== 'locked') bad.push(`欄が ${g.state}（鍵の形のはず）`);
    if (!same(g.lock, [GIVE_LINE(need)])) bad.push(`1行「${g.lock.join('｜')}」（あるべき「${GIVE_LINE(need)}」）`);
    if (g.cards !== 1 || !g.cardOn) bad.push(`答えるカードが ${g.cards}つ${g.cards && !g.cardOn ? '（見えていない）' : ''}`);
    if (!same(g.head, [GIVE_HEAD(G.name)])) bad.push(`見出し「${g.head.join('｜')}」（あるべき「${GIVE_HEAD(G.name)}」）`);
    if (!same(g.count, [GIVE_COUNT(have, need)])) bad.push(`答えた数「${g.count.join('｜')}」（あるべき「${GIVE_COUNT(have, need)}」）`);
    if (g.links.length !== 1) bad.push(`欄の中のリンクが ${g.links.length}つ（${g.links.map(a => a.text).join('｜')}）`);
    for (const a of g.links.slice(0, 1)) {
      if (!(a.text === GIVE_GO && a.inCard && a.on && a.cls === 'crl-cta' && a.give === '1')) bad.push(`入口「${a.text}」（class ${a.cls}・カードの中 ${a.inCard}・見えている ${a.on}）`);
      if (!a.href.endsWith(`airline-conditions.html?airline=${G.airline}&q=${GIVE_ASK[0]}`)) bad.push(`入口の行き先 ${a.href}`);
    }
    if (/ログイン|匿名で給与を提出する/.test(g.text)) bad.push(`欄に、ログインか給与の提出の入口の字が在る「${g.text.slice(0, 80)}」`);
    if (g.facts) bad.push(`回答の行が ${g.facts}つ出ている`);
    return bad;
  };
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    /* GM1 「集まった回答」は、1行と、答えるカード1枚。入口は「匿名で答える」の1つだけ（ログイン・給与の提出の入口は、この欄には出ない）。
           見えている集計と月の勤務の欄は、どれも鍵の形で落ち着いている（読み出せない・準備中になっていない）。 */
    {
      const bad = cardBad(await slotOf(), 3, 5);
      for (const x of live.filter(x => /^(fact|work)$/.test(x.kind) && x.state !== 'locked')) bad.push(`見えている欄（${x.kind}）が ${x.state}`);
      ok(!bad.length, `${tag}: 「集まった回答」は「${GIVE_LINE(5)}」の1行と、答えるカード1枚 ──「${GIVE_HEAD(G.name)}」「${GIVE_COUNT(3, 5)}」・入口は「${GIVE_GO}」の1つだけ（聞く会社は、このページの会社ではない）`, bad.slice(0, 5).join(' ／ '));
    }
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    /* GM2 要る数（◯つ）と答えた数は、サーバーが返した数のまま（画面の側に 5 と書いていない）。同じページを、6／7 の返事で開き直す。 */
    {
      seen.give = { body: giveBody('give', s, { have: 6, need: 7 }) };
      await p.reload({ waitUntil: 'load', timeout: 60000 });
      const again = await p.waitForFunction(SETTLED).then(() => true, () => false);
      await ev(LIB);
      const bad = again ? cardBad(await slotOf(), 6, 7) : ['開き直したページが落ち着かない'];
      ok(!bad.length, `${tag}: 要る数と答えた数は、サーバーが返した数のまま出る（返事が 6／7 なら「${GIVE_LINE(7)}」「${GIVE_COUNT(6, 7)}」）`, bad.slice(0, 5).join(' ／ '));
    }
    /* GM3 入口を押すと、このページの「情報を追加」の面を、読む人自身の会社について開く（PVContrib.openFor へ、会社・名前・聞く質問を渡す）。
           面が開いた時（true が返った時）だけ、リンクを止める ＝ ページは移らない。
           面が開かなかった時（false が返った時 ＝ ログインが切れていた、など）と、面の入口が無い時（古い部品・面の無いページ）は、
           同じ押下が、リンクのまま質問の画面へ進む（行き先を控えて、中身の無い返事で止める ＝ 検査のページは移らない）。
           面の入口は、押す前に記録係に差し替える：'opens' ＝ true を返す・'refuses' ＝ false を返す・'none' ＝ 入口そのものを外す。 */
    {
      seen.nav = [];
      const press = how => ev((sel, how) => {
        const a = document.querySelector(sel + ' a[data-crl-give]'), C = window.PVContrib, calls = [];
        if (!a || !C) return null;
        const had = typeof C.openFor;
        if (how === 'none') delete C.openFor;
        else C.openFor = o => { calls.push({ airline: o && o.airline, name: o && o.name, ask: o && o.ask, from: !!o && o.from === a }); return how === 'opens'; };
        a.click();
        return { calls, had, now: typeof C.openFor };
      }, SEL, how);
      const navs = async n => { for (const t0 = Date.now(); seen.nav.length < n && Date.now() - t0 < 8000;) await new Promise(go => setTimeout(go, 20)); };
      const href0 = await ev(() => location.href);
      const a1 = await press('opens');
      await ev(() => new Promise(go => requestAnimationFrame(() => requestAnimationFrame(go))));
      const stay = { href: (await ev(() => location.href)) === href0, nav: seen.nav.length };
      const a2 = await press('refuses');
      await navs(1);
      const a3 = await press('none');
      await navs(2);
      const want = [{ airline: G.airline, name: G.name, ask: GIVE_ASK, from: true }], to = `/airline-conditions.html?airline=${G.airline}&q=${GIVE_ASK[0]}`;
      ok(!!a1 && a1.had === 'function' && same(a1.calls, want) && stay.href && stay.nav === 0 && !!a2 && same(a2.calls, want) && !!a3 && a3.now === 'undefined' && same(seen.nav, [to, to]),
         `${tag}: 「${GIVE_GO}」を押すと、読む人自身の会社（${G.name}）について「情報を追加」の面を開く ── 会社・名前・聞く質問を1回渡し、面が開けばページは移らない。面が開かなかった時と、面の入口が無い時は、リンクのまま質問の画面（${to}）へ進む`,
         JSON.stringify({ opens: a1, stay, refuses: a2 && a2.calls.length, none: a3 && a3.now, nav: seen.nav }).slice(0, 320));
      seen.nav = null;
    }
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている8つだけ`, [...seen.unknown].join(' '));
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
  if (wantS('off')) for (const s of ONLY) for (const v of VIEWS.filter(x => OFF_W.includes(x[0]))) work.push(() => runOff(browser, s, v), () => runFacts404(browser, s, v));
  if (wantS('rows')) for (const s of ONLY) for (const v of VIEWS.filter(x => ROWS_W.includes(x[0]))) work.push(() => runRows(browser, s, v));
  if (wantS('rated')) for (const s of ONLY) for (const v of VIEWS.filter(x => RATED_W.includes(x[0]))) work.push(() => runRated(browser, s, v), () => runRated404(browser, s, v));
  if (wantS('rated')) for (const s of ONLY) { const v = VIEWS.find(x => RATED_W.includes(x[0])); if (v) work.push(() => runRatedStale(browser, s, v)); }
  if (wantS('tabs')) for (const s of ONLY) for (const v of [...VIEWS.filter(x => TABS_W.includes(x[0])), ...TABS_EXTRA]) work.push(() => runTabs(browser, s, v));
  if (wantS('cards')) for (const s of ONLY) work.push(() => runCards(browser, s));
  if (wantS('gg')) for (const s of ONLY) for (const v of VIEWS.filter(x => GG_W.includes(x[0]))) work.push(() => runGG(browser, s, v));
  if (wantS('give')) for (const s of ONLY) for (const v of VIEWS.filter(x => GIVE_W.includes(x[0]))) work.push(() => runGive(browser, s, v));
  if (wantS('ggold') && (WANT_S || !argOf('--only'))) for (const lang of ['ja', 'en']) {
    const vs = VIEWS.filter(x => GG_W.includes(x[0]));
    for (const v of vs) work.push(() => runGGOld(browser, lang, v));
    if (vs.length) work.push(() => runGGOldOff(browser, lang, vs[0], 'css'), () => runGGOldOff(browser, lang, vs[vs.length - 1], 'lock'),
      () => runGGOldOff(browser, lang, vs[0], 'empty'), () => runGGOldStale(browser, lang, vs[vs.length - 1]));
  }
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
