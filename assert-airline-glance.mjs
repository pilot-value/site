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
     node assert-airline-glance.mjs --scenes off,cards               調べる時だけ（場面を絞る：view・off・rows・rated・tabs・cards・gg・ggold・give・work・work0・living・stay・find・towns）
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
import { LIVING, CITY_OF, ABUDHABI, SITES, FAMILY, MODES, BAR_STATS, whenText as livWhen } from './living-facts.mjs';
import { readBars, checkBars, axisEnd } from './pv-bars.mjs';
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
/* 「情報を追加」の面が持っている話題。一覧・月の勤務・住みやすい街と、質問のまとまり6つ（pv-contrib.js の GROUPS を下で読んで照合する）。 */
const ASK_GROUPS = ['taxi', 'staff_travel', 'upgrade', 'roster', 'career', 'benefits'];
const TOPICS = new Set(['list', 'work', 'town', ...ASK_GROUPS]);
/* 実データの欄：種類ごとの数（会社の事実6・補足5・月の勤務1・提出された年収1・口コミ1・点数1・星1・要約1・ホテル1・街1）。 */
const LIVE_BOXES = { fact: 6, notes: 5, work: 1, realpay: 1, reviews: 1, score: 1, stars: 1, summary: 1, hotels: 1, towns: 1 };
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
  ok(boxes.length === LIVE_N && same(Object.entries(kinds).sort(), Object.entries(LIVE_BOXES).sort()), `${s}: 実データの欄は${LIVE_N}（事実6・補足5・月の勤務1・年収1・口コミ1・点数1・星1・要約1・ホテル1・街1）`, JSON.stringify(kinds));
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
    /* S1 「勤務・訓練」の板：話題ごとの5つの面（並び・名前・入口は、生成側の表 SURFACES だけが決める）。
       どの面にも、会社の公表か「会社の公表は確認できていません」の1行が在る（月の勤務の面は、公表を持たない ＝ 数字はサーバーの集計だけ）。
       見出し（.pvg-askh）の下が空の面は無い。「3人そろった項目だけ」の1行は、板に1回だけ（面ごとに繰り返さない）。 */
    const iW = both.indexOf('<div class="pvg-card pvg-panel" id="pvg-p-work"'), iWE = iW < 0 ? -1 : both.indexOf('<article class="pvg-card pvg-cell" data-cell="benefits"', iW);
    const W = iW >= 0 && iWE > iW ? both.slice(iW, iWE) : '';
    const sfs = [...W.matchAll(/<section class="pvg-sf" data-sf="([a-z]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(m => ({ id: m[1], h: m[2] }));
    const SF_WANT = [['month', '月の勤務'], ['roster', '勤務予定・休日'], ['commute', '通勤'], ['travel', 'Staff Travel'], ['career', '昇格・訓練']];
    const sfNow = sfs.map(x => [x.id, text(one(x.h, /<h4 class="pvg-sf-t"[^>]*>([\s\S]*?)<\/h4>/) || '')]);
    ok(W.split('<section class="pvg-sf"').length - 1 === 5 && same(sfNow, SF_WANT),
       `${s}: 「勤務・訓練」の板は5つの面 ── ${SF_WANT.map(x => x[1]).join('／')}（この順）`, sfNow.map(x => x.join(':')).join(' ／ '));
    const NONE = '会社の公表は確認できていません';
    const pubBad = sfs.filter(x => x.id !== 'month').filter(x => {
      const pub = one(x.h, /<div class="pvg-sf-pub">([\s\S]*?)<\/div>/), none = one(x.h, /<p class="pvg-quiet pvg-sf-none">([\s\S]*?)<\/p>/);
      return pub != null ? !(/<dl class="pvg-dl">[\s\S]*?<dt>/.test(pub) && none == null) : none !== NONE;
    }).map(x => x.id);
    ok(sfs.length === 5 && !pubBad.length, `${s}: 話題の4つの面は、どれも会社の公表の一覧か「${NONE}」の1行を持つ`, pubBad.join(' '));
    const emptyH = [...W.matchAll(/<p class="pvg-askh">(?:(?!<\/p>)[\s\S])*<\/p>(\s*<\/(?:div|section)>)/g)].length;
    ok(W.length > 0 && !emptyH, `${s}: 「勤務・訓練」の板に、下が空の見出しが無い`, `${emptyH}か所`);
    const NOTE_LINE = 'パイロットの回答は、3人そろった項目だけを出しています。';
    const notes = [...W.matchAll(/<p class="[^"]*\bpvg-sfs-note\b[^"]*">([\s\S]*?)<\/p>/g)].map(m => text(m[1]));
    ok(notes.length === 1 && notes[0] === NOTE_LINE && text(W).split('3人そろった').length - 1 === 1,
       `${s}: 「勤務・訓練」の板の「${NOTE_LINE}」は1回だけ（面ごとに繰り返さない）`, `${notes.length}つ・「3人そろった」${text(W).split('3人そろった').length - 1}回`);
    /* S2 入口：「勤務・訓練」の板の入口は、面の表の6つだけ（面ごとに入口の行が1つ）。「匿名で答える」の行は、この板に無い。
       3つの板（勤務・訓練／待遇／暮らし）で、同じ話題・同じ質問・同じ街を開く入口は2つ無い。暮らしの入口は、どれも街を持って質問の前で開く（街ごとに1つ）。 */
    const iB = both.indexOf('<div class="pvg-card pvg-panel" id="pvg-p-benefits"'), iBE = iB < 0 ? -1 : both.indexOf('<article class="pvg-card pvg-cell" data-cell="living"', iB);
    const iL = both.indexOf('<div class="pvg-card pvg-panel" id="pvg-p-living"'), iLE = iL < 0 ? -1 : both.indexOf('<div class="pvg-more-grid pvg-g-st"', iL);
    const B = iB >= 0 && iBE > iB ? both.slice(iB, iBE) : '', L = iL >= 0 && iLE > iL ? both.slice(iL, iLE) : '';
    const entriesOf = h => [...h.matchAll(/<(a|button)\b([^>]*)\bdata-pvc-open="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g)].map(m => ({ text: text(m[5]), topic: m[3], q: one(m[2] + m[4], /data-pvc-q="([^"]*)"/) || '', ctx: unesc(one(m[2] + m[4], /data-pvc-ctx="([^"]*)"/) || '') }));
    const EW = entriesOf(W), EB = entriesOf(B), EL = entriesOf(L);
    const ENTRY_WANT = [['勤務時間を追加', 'work', ''], ['希望休の条件を追加', 'roster', 'days_off_request'], ['通勤の条件を追加', 'taxi', ''],
      ['Staff Travel の条件を追加', 'staff_travel', ''], ['昇格の条件を追加', 'upgrade', ''], ['訓練・キャリアの条件を追加', 'career', '']];
    const addsPer = sfs.map(x => x.h.split('<p class="pvg-sf-add">').length - 1);
    ok(same(EW.map(e => [e.text, e.topic, e.q]), ENTRY_WANT) && W.split('<p class="pvg-sf-add">').length - 1 === 5 && addsPer.length === 5 && addsPer.every(n => n === 1),
       `${s}: 「勤務・訓練」の板の入口は ${ENTRY_WANT.map(e => e[0]).join('／')} の6つ（面ごとに入口の行が1つ）`, EW.map(e => `${e.text}→${e.topic}${e.q ? ':' + e.q : ''}`).join(' ／ ') + ` ／ 行 ${addsPer.join(',')}`);
    ok(W.length > 0 && !/class="(?:[^"]* )?pvg-ask(?: [^"]*)?"/.test(W) && !text(W).includes('匿名で答える'), `${s}: 「勤務・訓練」の板に「匿名で答える」の行が無い（入口は面ごとの1行）`);
    ok(!PAGES[s].includes('pvg-addrow'), `${s}: 板の下の入口の行（pvg-addrow）が、ページのどこにも無い`);
    const triples = [...EW, ...EB, ...EL].map(e => [e.topic, e.q, e.ctx].join('|')), dup = triples.filter((t, i) => triples.indexOf(t) !== i);
    ok(EW.length && EL.length && !dup.length, `${s}: 勤務・訓練／待遇／暮らしの板で、同じ話題・同じ質問・同じ街を開く入口が2つ無い`, dup.join(' ／ '));
    const ELt = EL.filter(e => e.topic !== 'town');
    const ctxs = ELt.map(e => e.ctx);
    ok(ELt.length > 0 && ELt.every(e => e.q && e.ctx) && new Set(ctxs).size === ctxs.length,
       `${s}: 暮らしの板の入口は、「＋住みやすい街を追加」のほかは、どれも街を持ち、その質問の前で開く（街ごとに1つ）`, ELt.map(e => `${e.q || '(質問なし)'}@${e.ctx || '(街なし)'}`).join(' ／ '));
    /* E9.2 (b)「＋住みやすい街を追加」：ページの中に data-pvc-open="town" は1つだけ（「修正」は台本が自分の行ごとに足す）。
       暮らしの板の 住むエリア の見出しの行（header.pvg-liv-h）の、見出しのすぐ後ろの子。<a class="pvg-link pvg-liv-add">・字はそのまま・
       質問も街も指さない（data-pvc-q・data-pvc-ctx が無い）・属性はこの7つだけ（ほかに何も運ばない）。 */
    const TOWN_ATTRS = ['class', 'href', 'data-pvc-open', 'data-pvc-base', 'data-pvc-basetext', 'data-pvc-ports', 'data-pvc-towns'];
    const tEnt = /<a\b([^>]*)>([^<]*)<\/a>/.exec((PAGES[s].match(/<a\b[^>]*\bdata-pvc-open="town"[^>]*>[^<]*<\/a>/) || [''])[0]);
    const tHead = one(L, /<header class="pvg-liv-h">([\s\S]*?)<\/header>/);
    const tAttrs = tEnt ? [...tEnt[1].matchAll(/\s([a-z-]+)="[^"]*"/g)].map(m => m[1]) : [];
    ok(PAGES[s].split('data-pvc-open="town"').length - 1 === 1 && !!tEnt && tHead !== null && tHead.replace(/^<p class="pvg-askh">[\s\S]*?<\/p>/, '') === tEnt[0]
       && one(tEnt[1], / class="([^"]*)"/) === 'pvg-link pvg-liv-add' && unesc(tEnt[2]) === '＋住みやすい街を追加'
       && !/data-pvc-q=|data-pvc-ctx=/.test(tEnt[1]) && same([...tAttrs].sort(), [...TOWN_ATTRS].sort()) && tAttrs.length === TOWN_ATTRS.length,
       `${s}: 「＋住みやすい街を追加」は、暮らしの板に1つだけ（質問も街も指さない）── 住むエリアの見出しの行の中・字のまま・属性は ${TOWN_ATTRS.join('・')} だけ`,
       `${PAGES[s].split('data-pvc-open="town"').length - 1}つ ／ ${tEnt ? tEnt[0].slice(0, 160) : '入口なし'} ／ 属性 ${tAttrs.join(' ')}`);
    /* E9.3 前の案内（「勤務・訓練の通勤を見る」の行）の代わり：暮らしの板は、通勤の質問への案内で終わらない（A8） */
    ok(!PAGES[s].includes('pvg-liv-more') && !PAGES[s].includes('勤務・訓練の通勤を見る') && !PAGES[s].includes('ここに無い街に住んでいる方') && EL.some(e => e.topic === 'town'), `${s}: 暮らしの板は、通勤の質問への案内で終わらない（案内の行が無く、「＋住みやすい街を追加」が在る）`);
    ok(![...EW, ...EB, ...EL].some(e => e.text === '追加'), `${s}: 「追加」だけの入口が無い（何を足すのかが字で分かる）`);
    /* 暮らしの板には、集計・補足・月の勤務の欄を置かない（通勤の回答は、勤務・訓練の通勤の面に1つだけ）。 */
    ok(L.length > 0 && !/ data-live="(?:fact|notes|work)"/.test(L), `${s}: 暮らしの板に、集計・補足の欄を残していない（通勤は勤務・訓練の面に1つだけ）`);
    /* E9.5 暮らしの板の実データの欄は、会員が挙げた街の1つだけ：ページに data-live="towns" は1つ・住むエリアの節の閉じのすぐ後ろの
       div.pvg-liv-got の中・見出し「パイロットの回答」の次・会社はこのページ・基地は「＋住みやすい街を追加」の data-pvc-base。字はこのとおり（器だけ）。 */
    const gotBase = one(L, /<a class="pvg-link pvg-liv-add"[^>]* data-pvc-base="([A-Z]{3})"/);
    const GOT = `</section><div class="pvg-liv-got"><p class="pvg-askh">パイロットの回答</p><div class="crl" data-live="towns" data-airline="${s}" data-base="${gotBase}" data-state="idle"><span class="crl-ph">—</span></div></div>`;
    ok(!!gotBase && PAGES[s].split('data-live="towns"').length - 1 === 1 && L.split(GOT).length - 1 === 1 && L.split('<div class="pvg-liv-got">').length - 1 === 1,
       `${s}: 暮らしの板の実データの欄は、会員が挙げた街の1つだけ（住むエリアの節のすぐ後ろ・「パイロットの回答」の下・このページの会社・入口と同じ基地）`,
       `欄 ${PAGES[s].split('data-live="towns"').length - 1}つ・基地 ${gotBase}・${(one(L, /(<div class="pvg-liv-got">[\s\S]{0,240})/) || '器なし').slice(0, 240)}`);
    /* S3 欄：面ごとに集計の欄1つ＋補足の欄1つ（月の勤務の面は、月の勤務の欄1つ ── 帯で描く・補足も出す・鍵の一覧は持たない）。
       集計の欄の鍵 ＝ その面の話題の、答えられる質問ぜんぶ（額の質問は除く）。補足の欄（待遇の板の1つを含む5つ）の鍵 ＝ 答えられる質問ぜんぶ。
       どちらも、1つの質問は1つの欄にだけ入る。data-sub ＝ 台帳の親。子は親のすぐ下（親と子のあいだに、親の子孫でない質問を挟まない）。 */
    const boxIn = (h, k) => [...h.matchAll(/<div class="crl"([^>]*)>/g)].map(m => m[1]).filter(a => a.includes(` data-live="${k}"`));
    const keysIn = a => (one(a, / data-keys="([^"]*)"/) || '').split(',').filter(Boolean);
    const SF_TOPICS = { roster: ['roster'], commute: ['taxi'], travel: ['staff_travel'], career: ['upgrade', 'career'] };
    const slotBad = [];
    for (const x of sfs) {
      const fa = boxIn(x.h, 'fact'), na = boxIn(x.h, 'notes'), wa = boxIn(x.h, 'work');
      if (x.id === 'month') {
        if (!(wa.length === 1 && !fa.length && !na.length && / data-bars="1"/.test(wa[0]) && / data-notes="/.test(wa[0]) && / data-work="/.test(wa[0]) && !/ data-keys="/.test(wa[0]))) slotBad.push(`month: 月の勤務 ${wa.length}・集計 ${fa.length}・補足 ${na.length}`);
        continue;
      }
      if (fa.length !== 1 || na.length !== 1 || wa.length) { slotBad.push(`${x.id}: 集計 ${fa.length}・補足 ${na.length}・月の勤務 ${wa.length}`); continue; }
      const want = ASKABLE.filter(id => (SF_TOPICS[x.id] || []).includes(groupOf(id)) && !MONEY_Q.includes(id)).sort();
      if (!same([...keysIn(fa[0])].sort(), want)) slotBad.push(`${x.id}: 集計の鍵 ${keysIn(fa[0]).length}（あるべき ${want.length}）`);
    }
    const factAll = sfs.flatMap(x => boxIn(x.h, 'fact')).flatMap(keysIn), noteAll = boxes.map(m => m[1]).filter(a => a.includes(' data-live="notes"')).flatMap(keysIn);
    const factWant = ASKABLE.filter(id => ['roster', 'taxi', 'staff_travel', 'upgrade', 'career'].includes(groupOf(id)) && !MONEY_Q.includes(id)).sort();
    if (!same([...factAll].sort(), factWant)) slotBad.push(`4つの面の集計の鍵 ${factAll.length}（あるべき ${factWant.length}・重なりなし）`);
    if (!same([...noteAll].sort(), [...ASKABLE].sort())) slotBad.push(`補足の欄の鍵 ${noteAll.length}（あるべき ${ASKABLE.length}・重なりなし）`);
    ok(sfs.length === 5 && !slotBad.length, `${s}: 面ごとに集計の欄1つ＋補足の欄1つ（月の勤務は月の勤務の欄1つ）── 集計の欄は話題の質問ぜんぶ（額は除く）・補足の欄は質問ぜんぶ・どの質問も1つの欄にだけ`, slotBad.join(' ／ '));
    const subBad = [];
    for (const a of sfs.flatMap(x => boxIn(x.h, 'fact'))) {
      const ks = keysIn(a), sub = (one(a, / data-sub="([^"]*)"/) || '').split(',').filter(Boolean);
      const want = ks.filter(k => QBY.get(k) && QBY.get(k).parent).map(k => `${k}:${QBY.get(k).parent}`);
      if (!same(sub, want)) subBad.push(`${one(a, / data-sf="([^"]*)"/)}: data-sub が台帳の親と違う`);
      const under = (c, p) => { for (let q = QBY.get(c); q && q.parent; q = QBY.get(q.parent)) if (q.parent === p) return true; return false; };
      for (const c of ks) {
        const p = QBY.get(c) && QBY.get(c).parent; if (!p) continue;
        const ip = ks.indexOf(p), ic = ks.indexOf(c);
        if (ip < 0 || ic < ip || ks.slice(ip + 1, ic).some(k => !under(k, p))) subBad.push(`${one(a, / data-sf="([^"]*)"/)}: ${c} が親（${p}）のすぐ下に無い`);
      }
    }
    ok(sfs.length === 5 && !subBad.length, `${s}: 集計の欄の子の質問は、台帳の親（data-sub）のすぐ下に並ぶ（親と子のあいだに、親の子孫でない質問が無い）`, subBad.slice(0, 4).join(' ／ '));
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
    ok(/<h4 class="pvg-askh">ホテル・レストラン・場所<\/h4>/.test(city), `${s}: ホテルの見出しに、足した人の断りを書いていない`);
    /* 根拠・条件・時点：公式の資料と確かめた日。 */
    const off = one(G, /<a class="pvg-link pvg-st-off" href="([^"]*)" target="_blank" rel="noopener">公式の就航地<\/a>/);
    ok(off === net.src[0].url.replace(/&/g, '&amp;') && net.src.every(x => G.includes(`href="${x.url.replace(/&/g, '&amp;')}"`)), `${s}: 「公式の就航地」と根拠は、台帳の資料へ`, off || '');
    const [y, mo, da] = net.at.split('-').map(Number);
    ok(G.includes(`<span>${y}年${mo}月${da}日に公式の資料で確認</span>`), `${s}: 確かめた日（${net.at}）が出ている`);
  }
}
head('会員が挙げた街の欄（career-live.js の言葉 ⇄ career-stay.js・pv-contrib.js・生成側・読む会社）');
{
  /* E9.6 写しの字は、元の字と1文字も違わない（career-live.js は、ほかの部品の言葉を読めない ＝ 写しを持つ）。
       ・自分の行の札「確認待ち」「見送り」と「修正」（T.townWait・T.townNo・T.townEdit）＝ career-stay.js の T.pending・T.rejected・T.edit
       ・「ログインなしで保存した回答があります。」（T.townHeld）＝ 「情報を追加」の一覧の、預かりの箱の見出し（pv-contrib.js）
       ・街の面の気になる点の下の1行（C10）は pv-contrib.js に1回・月の勤務の補足の1行も1回
       ・街の面の交通手段の4つの字（pv-contrib.js の TMODE）＝ 会社ページの移動の字（生成側の MODE_JA）
       ・「人気の居住地」は career-live.js の1行だけ（生成側・pv-glance.js・pv-contrib.js・5社のページには無い）。暮らしの板の HTML に 人気・ランキング・1位 が無い
     P12.33 (a) ページの欄が読む自分の投稿は、いつもこのページの会社のぶん：PVContrib.myTowns は pageSlug() で読む
       （slug() で読むと、openFor で読む人自身の会社について開いたあと ── 閉じても ── ほかの会社の自分の投稿が、このページの欄に「あなたの投稿」として出る）。 */
  const CL = read('career-live.js'), CS = read('career-stay.js'), PC = read('pv-contrib.js'), GEN = read('gen-airline-glance.mjs'), PG = read('pv-glance.js');
  const wordOf = (src, k) => one(src, new RegExp(`\\n {4}${k}: +'([^'\\n]*)',`));
  for (const [k, ks] of [['townWait', 'pending'], ['townNo', 'rejected'], ['townEdit', 'edit']]) {
    const a = wordOf(CL, k), b = wordOf(CS, ks);
    ok(!!a && a === b, `街の欄の自分の行の「${a}」（T.${k}）は career-stay.js の T.${ks} と同じ字`, `career-live.js「${a}」／career-stay.js「${b}」`);
  }
  const held = wordOf(CL, 'townHeld');
  ok(!!held && PC.split('\n').filter(l => l.includes(`heldBox('${held}', [`)).length === 1,
     `街の欄の「${held}」（T.townHeld）は、「情報を追加」の一覧の預かりの箱の見出し（pv-contrib.js）と同じ字`, String(held));
  const C10 = '書いた場合は、確認のあと、給与を提出した会員に表示されます（名前は出ません）。', MONTH_NOTE = '書いた場合は、給与を提出した会員に表示されます（名前は出ません）。';
  ok(PC.split(C10).length - 1 === 1 && PC.split(MONTH_NOTE).length - 1 === 1, `街の面の「${C10}」は pv-contrib.js に1回・月の勤務の「${MONTH_NOTE}」も1回`,
     `${PC.split(C10).length - 1}回／${PC.split(MONTH_NOTE).length - 1}回`);
  const TM = Object.fromEntries([...(one(PC, /var TMODE = \[([^\n]*)\];/) || '').matchAll(/\['([a-z]+)', '([^']*)'\]/g)].map(m => [m[1], m[2]]));
  const MJ = Object.fromEntries([...(one(GEN, /const MODE_JA = \{([^}]*)\};/) || '').matchAll(/([a-z]+): '([^']*)'/g)].map(m => [m[1], m[2]]));
  const MK = ['train', 'taxi', 'bus', 'car'];
  ok(same(Object.keys(MJ).sort(), [...MK].sort()) && MK.every(k => TM[k] && TM[k] === MJ[k]), '街の面の交通手段の4つの字（pv-contrib.js の TMODE）は、会社ページの移動の字（生成側の MODE_JA）と同じ',
     MK.map(k => `${k}: ${TM[k]}／${MJ[k]}`).join(' ・ '));
  const HEAD = wordOf(CL, 'townHead'), lines = (t, w) => t.split('\n').filter(l => l.includes(w)).length;
  const elsewhere = [['gen-airline-glance.mjs', GEN], ['pv-glance.js', PG], ['pv-contrib.js', PC], ...FIVE.map(x => [pageOf(x), PAGES[x]])].filter(([, t]) => t.includes('人気の居住地')).map(([n]) => n);
  ok(HEAD === '人気の居住地' && lines(CL, '人気の居住地') === 1 && !elsewhere.length, '「人気の居住地」は career-live.js の1行だけ（生成側・pv-glance.js・pv-contrib.js・5社のページには無い）',
     `career-live.js ${lines(CL, '人気の居住地')}行・T.townHead「${HEAD}」・ほか ${elsewhere.join('・') || 'なし'}`);
  for (const x of FIVE) {
    const i = PAGES[x].indexOf('<div class="pvg-card pvg-panel" id="pvg-p-living"'), j = i < 0 ? -1 : PAGES[x].indexOf('<div class="pvg-more-grid pvg-g-st"', i);
    const P = i >= 0 && j > i ? PAGES[x].slice(i, j) : '';
    const hit = (P.match(/人気|ランキング|1位/g) || []);
    ok(!!P && !hit.length, `${x}: 暮らしの板の HTML に「人気」「ランキング」「1位」が無い（「人気の居住地」は、読めた街の一覧の上にだけ career-live.js が描く）`, hit.join('・'));
  }
  const exp = PC.split('\n').filter(l => /^\s+myTowns: function \(\) \{/.test(l));
  ok(exp.length === 1 && exp[0].trim() === 'myTowns: function () { return myTowns(pageSlug()); },' && !/myTowns\(slug\(\)\)/.test(noJsCmt(PC)),
     'ページの欄が読む自分の投稿は、このページの会社のぶん ── PVContrib.myTowns は pageSlug() で読む（openFor のあとの会社 slug() では読まない）', exp.join(' ／ ') || '書き出しが無い');
}
head('career-stay.js（ホテルの欄の言葉・ログインの入口の行き先 ⇄ career-live.js）');
{
  /* career-stay.js は career-live.js の言葉と関数を読めない（書き出していない）ので、写しを持つ。写しが1文字でもずれたら落とす。
     ・ログインの入口の行き先を作る2つの関数（loginHref・backHash）は、本体が1文字も違わない。
     ・「準備中」と「ログイン」は、career-live.js の T.off・T.login と同じ字。「あなたの投稿」（T.mine）は T.noteMine と同じ字。
     ★ホテルを見てよいのはオーナーと、オーナーが承認した人だけ（db/stays.sql）。給与の提出では開かないので、
       給与の提出で開く欄の言葉（T.loginPayLock・T.payLock・T.payGive）は career-stay.js のどこにも書かない（説明の中にも）。 */
  const CS = read('career-stay.js'), CL = read('career-live.js');
  const fnOf = (src, name) => one(src, new RegExp(`\\n(  function ${name}\\(\\) \\{\\n[\\s\\S]*?\\n  \\})\\n`));
  const wordOf = (src, k) => one(src, new RegExp(`\\n {4}${k}: +'([^'\\n]*)',`));
  for (const f of ['loginHref', 'backHash']) {
    const a = fnOf(CS, f), b = fnOf(CL, f);
    ok(!!a && !!b && a === b, `ホテルの欄のログインの入口：function ${f} の本体が career-live.js と1文字も違わない`, `${a === null ? 'career-stay.js に無い' : ''}${b === null ? 'career-live.js に無い' : ''}${a && b && a !== b ? `career-stay.js「${a.slice(0, 120)}」` : ''}`);
  }
  /* 自分が足したものの札（T.mine）は、提出された一覧の札（career-live.js の T.noteMine）と同じ字。 */
  for (const [k, kl] of [['off', 'off'], ['login', 'login'], ['mine', 'noteMine']]) {
    const a = wordOf(CS, k), b = wordOf(CL, kl);
    ok(!!a && a === b, `ホテルの欄の「${b}」は career-live.js の T.${kl} と同じ字`, `career-stay.js「${a}」／career-live.js「${b}」`);
  }
  const pay = ['loginPayLock', 'payLock', 'payGive'].map(k => [k, wordOf(CL, k)]);
  const held = pay.filter(([, t]) => t && CS.includes(t));
  ok(pay.every(([, t]) => !!t) && !held.length, `ホテルの欄は給与の提出では開かない ── career-stay.js に「${pay.map(([, t]) => t).join('」「')}」の字が無い`,
     `${pay.filter(([, t]) => !t).map(([k]) => `career-live.js に T.${k} が無い`).join('・')}${held.map(([k, t]) => `T.${k}「${t}」が在る`).join('・')}`);
  /* ★見てよい人になる申し込みは、画面に置かない（2026-10-16 オーナー：「確認を申し込むはいらない」）。会社の画面5枚と career.html、
     そこが読む部品のどれにも、申し込みの口の名前（pv_stay_viewer_request）と「確認を申し込む」の字が無い。
     呼ばないこと・欄に「確認を申し込む」「確認待ち」が出ないことは、場面 stay（S-v）と tabs（3b-member）が画面で見る。 */
  {
    const pages = [...FIVE.map(s => `airlines/${s}.html`), 'career.html'], files = new Set(pages);
    for (const pg of pages) for (const m of read(pg).matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
      if (!/^(https?:)?\/\//.test(m[1])) files.add(path.posix.join(path.posix.dirname(pg), m[1].split(/[?#]/)[0]));
    }
    const gone = [...files].filter(f => !fs.existsSync(path.join(ROOT, f)));
    const hit = [...files].filter(f => !gone.includes(f)).flatMap(f => ['pv_stay_viewer_request', '確認を申し込む'].filter(t => read(f).includes(t)).map(t => `${f}「${t}」`));
    ok(files.has('career-stay.js') && !gone.length && !hit.length, `見てよい人になる申し込みは画面に置かない ── 会社の画面5枚・career.html と、そこが読む部品に、申し込みの口（pv_stay_viewer_request）と「確認を申し込む」の字が無い`,
       [...hit, ...gone.map(f => `${f} が読めない`), files.has('career-stay.js') ? '' : 'career-stay.js を読む画面が無い'].filter(Boolean).join('・'));
  }
}
head('ホテルの欄の外の面（.crs-zone）⇄ 保存するカード（career-card.js）');
{
  /* 入口と追加の面は、欄（.crl）のすぐ後ろの兄弟（.crs-zone）に career-stay.js が作る。そこには送った人のホテル名のような
     サーバーの字が入る。カードが読むのは会社の画面（data-view="airline"）の印のある字だけで、欄の中は読まない（inLive）。
     ・inLive は欄の外の面も「読まない所」に数える（偶然ではなく決まりにする）。
     ・career.html のホテルの欄は、どれも就航地の画面（data-view="stay"）の中 ＝ その横に作る面も、会社の画面には出ない。
     （面そのものに印の属性・cr-sub・cr-axis が無いことは、場面 stay が追加の面を開いて見る。） */
  const CC = read('career-card.js'), CH = read('career.html');
  ok(/\n  function inLive\(el\) \{ return !!\(el && el\.closest && el\.closest\('\.crl, \.crs-zone'\)\); \}\n/.test(CC),
     'カードは、実データの欄（.crl）と、その外の面（.crs-zone）の中の字を読まない（career-card.js の inLive）', one(CC, /\n(  function inLive\([^\n]*)/) || 'inLive が無い');
  const where = [...CH.matchAll(/<div class="crl" data-live="hotels"/g)].map(m => {
    const before = CH.slice(0, m.index), at = before.lastIndexOf('<section class="cr-view'), tail = at < 0 ? '' : before.slice(at);
    if (at < 0 || tail.includes('</section>')) return '画面の外';
    return (tail.match(/^<section class="cr-view[^"]*" data-view="([a-z]+)"/) || [])[1] || '読めない';
  });
  ok(where.length > 0 && where.every(v => v === 'stay'), `career.html のホテルの欄（${where.length}）は、どれも就航地の画面（data-view="stay"）の中 ＝ 欄の外の面は、カードが読む会社の画面に出ない`,
     [...new Set(where)].join('・'));
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

head('月の勤務を枠と帯で描く部品（career-live.js / career-live.css）');
{
  /* S8a 月の勤務の6項目は、項目ごとの枠の中に、職位ごとの帯と数字で描く（会社ページの面だけ：欄に data-bars="1"）。
       ・帯の軸の右端は T.workMax の1か所（時間 240・日と泊 31）。集まった値に合わせて伸び縮みさせない（会社どうしで帯の長さが比べられなくなる）
       ・帯を2つの全幅の束に並べる形（見本と違う形）の部品を持ち込まない
       ・240 は物差しで、会社の決まりではない。軸を説明する字（注記の「帯の軸の右端」から workOver まで）に、上限・規定・法定・制限を書かない
       ・枠の CSS の注記に、いちばん短い帯（96px）と枠のいちばん狭い幅（304px）を書いておく。.crl-wb の決まりは動きを持たない
     数の合計（transition が何か所か）はここに書かない（ほかの直しで動く数を、ここで縛らない）。 */
  const LJS = read('career-live.js'), LCSS = read('career-live.css');
  const want = ['workMax: { h: 240, d: 31 }', 'function workScale(', 'function barRow(', 'function workBars(', 'function workCapLine(', 'T.workMax[it.fam]'];
  const miss = want.filter(w => !LJS.includes(w));
  ok(!miss.length, '月の勤務の帯：軸の右端は T.workMax（時間 240・日と泊 31）の1か所で、帯を描く部品（workScale・barRow・workBars・workCapLine）が在る', `無い：${miss.join(' ／ ')}`);
  const gone = ['crl-wb-g', 'crl-wb-it', 'crl-wb-ax'].flatMap(w => [['career-live.js', LJS], ['career-live.css', LCSS]].filter(([, t]) => t.includes(w)).map(([f]) => `${f}: ${w}`));
  ok(!gone.length, '月の勤務は項目ごとの枠（見本の形）。帯を全幅の束に並べる部品を持たない', gone.join(' ／ '));
  /* 切り出す範囲は「帯の軸の右端」の行から workOver: の行まで。どちらかが無い・2つ在る時は落とす（何も読まずに通さない） */
  const L = LJS.split('\n');
  const rows = s => L.reduce((a, l, i) => (l.includes(s) ? [...a, i] : a), []);
  const from = rows('帯の軸の右端'), to = rows('workOver:');
  const span = from.length === 1 && to.length === 1 && to[0] > from[0] ? L.slice(from[0], to[0] + 1) : [];
  const words = span.filter(l => /上限|規定|法定|制限/.test(l)).map(l => l.trim().slice(0, 80));
  ok(span.length > 0 && ['workMax:', 'workCap:', 'workAxis:'].every(k => span.some(l => l.includes(k))) && !words.length,
     '軸の数を説明する字（「帯の軸の右端」の注記から workOver まで）に、上限・規定・法定・制限が無い（240 は物差しで、会社の決まりではない）',
     span.length ? words.join(' ／ ') : `切り出せない（「帯の軸の右端」${from.length}行・workOver: ${to.length}行）`);
  const C = noCssCmt(LCSS);
  const note = (LCSS.match(/\/\*[\s\S]*?\*\//g) || []).find(c => c.includes('月の勤務を枠で')) || '';
  let flat = C, prev;
  do { prev = flat; flat = flat.replace(/@[^{};]+\{((?:[^{}]|\{[^{}]*\})*)\}/g, (m, inner) => inner); } while (flat !== prev);
  const moving = [...flat.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].includes('.crl-wb') && /transition/.test(m[2])).map(m => m[1].trim());
  ok(/\b96px\b/.test(note) && /\b304px\b/.test(note) && C.includes('.crl-wb-c{') && !moving.length,
     '枠の CSS：注記に帯のいちばん短い長さ（96px）と枠のいちばん狭い幅（304px）が書いてあり、.crl-wb-c の決まりが在り、.crl-wb の決まりに transition が無い',
     `注記 ${note ? '在る' : '無い'}・96px ${/\b96px\b/.test(note)}・304px ${/\b304px\b/.test(note)}・.crl-wb-c ${C.includes('.crl-wb-c{')}・動く決まり ${moving.join(' ／ ')}`);
}

/* 概要のカードに出る行。面を作り直しても、ここから1行も減らさない（ボタンの件数だけが変わった） */
const CARD_LINES = {
  jal: { work: ['休日', ['勤務時間の決め方', '訓練の場所'], 1, 'ほか5件と出典'], benefits: ['賞与', ['社宅・寮', '社員の航空券'], 1, 'ほか3件と出どころ'] },
  ana: { work: ['休日', ['勤務時間の決め方', '乗務のパターン'], 1, 'ほか4件と出典'], benefits: ['賞与', ['寮・社宅', '諸手当'], 1, 'ほか5件と出どころ'] },
  'cathay-pacific': { work: ['年次休暇（First Officer）', ['年次休暇（Second Officer）', '昇格の決まり方'], 1, 'ほか4件と出典'], benefits: ['社員の航空券', ['住宅手当', '月々の手当（First Officer）'], 1, 'ほか6件と出どころ'] },
  etihad: { work: ['年次休暇', [], 3, 'ほか1件と出典'], benefits: ['教育手当（初等）', ['教育手当（中等）', '住宅'], 1, 'ほか7件と出どころ'] },
  'eva-air': { work: ['休日', ['年次休暇', '有給の病気休暇'], 1, 'ほか3件と出典'], benefits: ['住まい', ['賞与', '社員の航空券'], 1, 'ほか2件と出どころ'] },
};
head('「勤務・訓練」の板の印・同じ項目は1か所・概要のカード・出典（S4〜S7）');
{
  /* S4 黙る印（data-quiet）と入口の印（data-entry="login"）は、面の表（SURFACES）が名指しした面にだけ付く。
       ・誰に見せるかを決めるのはサーバーの1か所。印はその写しではなく「同じ文・同じ入口を何度も出さない」ための印 ＝ どの面に付くかを名前で見る
       ・月の勤務の欄の下の1行は、黙る面（ページの印から読む）の名前をそのまま並べる
       ・生成側は、区分の一覧を決まりとして持たない
     S5 会社の公表の項目は、勤務・訓練と待遇の2つの板で1か所にだけ出る。待遇のカードに出る項目が勤務・訓練へ移っていれば、待遇の板の頭の1行が名指しする。
     S6 概要のカードの行は CARD_LINES のまま（ボタンの件数だけが変わった）。ボタンの件数＋1（カードの頭の項目が板に在るとき）＝ 開く板の項目の数。
     S7 「勤務・訓練」の板の資料は、どれも「出典」の畳みの中。資料は、そこに出ている項目の台帳の資料と同じ並び（移した項目の資料を落としていない）。 */
  const cutOf = (h, a, b) => { const i = h.indexOf(a), j = i < 0 ? -1 : h.indexOf(b, i); return i >= 0 && j > i ? h.slice(i, j) : ''; };
  const dtsOf = h => [...h.matchAll(/<dl class="pvg-dl">([\s\S]*?)<\/dl>/g)].flatMap(m => [...m[1].matchAll(/<dt>([\s\S]*?)<\/dt>/g)].map(d => text(without(d[1], 'pvg-tag'))));
  const srcUrls = h => [...new Set([...h.matchAll(/<a class="pvg-src" href="([^"]*)"/g)].map(m => unesc(m[1])))];
  const h4Of = h => text(one(h, /<h4 class="pvg-sf-t"[^>]*>([\s\S]*?)<\/h4>/) || '');
  const GEN = read('gen-airline-glance.mjs');
  for (const s of FIVE) {
    const both = PART[s].hero + PART[s].glance;
    const W = cutOf(both, '<div class="pvg-card pvg-panel" id="pvg-p-work"', '<article class="pvg-card pvg-cell" data-cell="benefits"');
    const B = cutOf(both, '<div class="pvg-card pvg-panel" id="pvg-p-benefits"', '<article class="pvg-card pvg-cell" data-cell="living"');
    const sfs = [...W.matchAll(/<section class="pvg-sf" data-sf="([a-z]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(m => ({ id: m[1], h: m[2] }));
    const slots = [...W.matchAll(/<div class="crl"([^>]*)>/g)].map(m => m[1]).map(a => ({ live: one(a, / data-live="([^"]*)"/), sf: one(a, / data-sf="([^"]*)"/), quiet: one(a, / data-quiet="([^"]*)"/), entry: one(a, / data-entry="([^"]*)"/) }));
    /* S4 (a) */
    const quietAt = slots.filter(x => x.quiet != null).map(x => `${x.live}:${x.sf}:${x.quiet}`);
    ok(sfs.length === 5 && W.split('data-quiet=').length - 1 === quietAt.length && same(quietAt, ['fact:roster:1', 'fact:career:1']),
       `${s}: 「勤務・訓練」の板で黙る印（data-quiet="1"）を持つのは、勤務予定・休日と昇格・訓練の集計の欄だけ`, quietAt.join(' ／ ') || '印なし');
    /* S4 (b) 黙る2つの欄は、ページの印で見つける */
    const entryAt = slots.filter(x => x.entry != null).map(x => `${x.live}:${x.sf}:${x.entry}`);
    const noEntry = slots.filter(x => x.sf === 'month' || x.quiet === '1').filter(x => x.entry != null).map(x => `${x.live}:${x.sf}`);
    ok(sfs.length === 5 && W.split('data-entry=').length - 1 === entryAt.length && same(entryAt, ['fact:commute:login', 'fact:travel:login'])
       && slots.some(x => x.sf === 'month' && x.live === 'work') && !noEntry.length && !W.includes('data-entry="0"'),
       `${s}: 入口の印（data-entry="login"）を持つのは、通勤と Staff Travel の集計の欄だけ ── 月の勤務の欄と黙る2つの欄は入口の印を持たない・data-entry="0" が無い`,
       `入口の印 ${entryAt.join(' ／ ') || 'なし'}・持ってはいけない欄 ${noEntry.join(' ／ ') || 'なし'}・data-entry="0" ${W.includes('data-entry="0"')}`);
    /* S4 (c) 黙る面は、ページの印から読む（どの面かは (a) が名前で見ている） */
    const quietNames = sfs.filter(x => [...x.h.matchAll(/<div class="crl"([^>]*)>/g)].some(m => / data-quiet="1"/.test(m[1]))).map(x => h4Of(x.h));
    const scope = [...W.matchAll(/<p class="[^"]*\bpvg-sf-scope\b[^"]*">([\s\S]*?)<\/p>/g)].map(m => text(m[1]));
    const SCOPE = `${quietNames.join('、')}の回答も、同じ条件で開きます。`;
    ok(quietNames.length > 0 && scope.length === 1 && scope[0] === SCOPE,
       `${s}: 月の勤務の欄の下の1行は、黙る面の名前を「、」で並べて「の回答も、同じ条件で開きます。」`, `ページ「${scope.join(' ／ ')}」・あるべき「${SCOPE}」`);
    /* S5 */
    const inW = sfs.flatMap(x => dtsOf(x.h)), inB = dtsOf(B), every = [...inW, ...inB];
    const twice = every.filter((l, i) => every.indexOf(l) !== i);
    ok(inW.length > 0 && inB.length > 0 && dtsOf(W).length === inW.length && !twice.length,
       `${s}: 会社の公表の項目は、勤務・訓練の面と待遇の板のどこか1か所にだけ出る`, twice.join(' ／ '));
    const cardOf = id => {
      const c = one(both, new RegExp(`<article class="pvg-card pvg-cell" data-cell="${id}"[^>]*>([\\s\\S]*?)</article>`)) || '';
      const k = one(c, /<p class="pvg-k">([\s\S]*?)<\/p>/) || '';
      return {
        k: text(k), label: text(without(k, 'pvg-tag')),
        also: [...(one(c, /<ul class="pvg-also">([\s\S]*?)<\/ul>/) || '').matchAll(/<li><span>([\s\S]*?)<\/span>/g)].map(m => text(m[1])),
        qs: (one(c, /<div class="pvg-qs">([\s\S]*?)<\/div>/) || '').split('<li>').length - 1,
        more: text(one(c, /<button type="button" class="pvg-more"[^>]*>([\s\S]*?)<\/button>/) || ''),
      };
    };
    const ben = cardOf('benefits'), printed = [ben.label, ...ben.also].filter(l => inW.includes(l));
    const moved = one(B.slice(B.indexOf('</header>') + '</header>'.length).trimStart(), /^<p class="pvg-quiet pvg-moved">([\s\S]*?)<\/p>/);
    ok(B.length > 0 && (!printed.length || (moved != null && printed.every(l => text(moved).includes(l)) && moved.includes('<a class="pvg-link" href="#work">'))),
       `${s}: 待遇のカードに出る項目が勤務・訓練の板に在れば、待遇の板は頭の1行でそれを名指しし、勤務・訓練へ案内する（href="#work"）`,
       `勤務・訓練へ移った項目 ${printed.join('・') || 'なし'}・頭の1行 ${moved == null ? '無い' : `「${text(moved)}」`}`);
    /* S6 */
    for (const id of ['work', 'benefits']) {
      const [lead, also, quick, more] = CARD_LINES[s][id], c = cardOf(id), panel = id === 'work' ? W : B;
      const n = dtsOf(panel).length, num = Number(one(c.more, /^ほか(\d+)件/) || NaN);
      ok(c.k.startsWith(lead) && same(c.also, also) && c.qs === quick && c.more === more && num + (dtsOf(panel).includes(lead) ? 1 : 0) === n,
         `${s}: 概要の${id === 'work' ? '勤務' : '待遇'}のカードの行は CARD_LINES のまま（${lead}／${also.join('・') || '小さな行なし'}／匿名で答える ${quick}つ／「${more}」）・件数＋頭の項目 ＝ 開く板の項目の数`,
         `${c.k}／${c.also.join('・') || '小さな行なし'}／匿名で答える ${c.qs}つ／「${c.more}」・開く板の項目 ${n}`);
    }
    /* S7 */
    const sums = [...W.matchAll(/<details class="[^"]*\bpvg-srcd\b[^"]*"[^>]*>\s*<summary>([\s\S]*?)<\/summary>/g)].map(m => text(m[1]));
    const loose = W.replace(/<details class="[^"]*\bpvg-srcd\b[^"]*"[^>]*>[\s\S]*?<\/details>/g, '').includes('pvg-srcs');
    ok(sums.length > 0 && sums.every(t => t.startsWith('出典')) && !W.includes('出どころ') && !loose,
       `${s}: 「勤務・訓練」の板の資料は、どれも「出典」の畳みの中（「出どころ」の字も、畳まずに並べた資料の行も無い）`, `${sums.join(' ／ ')}・畳まない行 ${loose}`);
    const LED = s === 'etihad' ? EY_FACTS.etihad.benefits : [...CO_FACTS[s].work, ...CO_FACTS[s].benefits];
    const byLabel = new Map(), srcBad = [];
    for (const x of LED) { if (byLabel.has(x.ja)) srcBad.push(`台帳に同じ名前が2つ：${x.ja}`); byLabel.set(x.ja, x); }
    for (const [where, h] of [...sfs.filter(x => x.id !== 'month').map(x => [x.id, x.h]), ['待遇の板', B]]) {
      const shown = dtsOf(h), unknown = shown.filter(l => !byLabel.has(l));
      if (unknown.length) { srcBad.push(`${where}: 台帳に無い項目 ${unknown.join('・')}`); continue; }
      const want = [...new Set(shown.map(l => byLabel.get(l).src && byLabel.get(l).src.url).filter(Boolean))];
      if (!same(srcUrls(h), want)) srcBad.push(`${where}: 資料 ${srcUrls(h).length}件（台帳 ${want.length}件・並びも見る）`);
    }
    /* エティハドの台帳は、会社ページに出さない行（税・機長昇格・教官の手当）も持つ ＝ 出ている項目の数は S6 が見る */
    if (s !== 'etihad') { const on = new Set(every), gone = LED.filter(x => !on.has(x.ja)).map(x => x.ja); if (gone.length) srcBad.push(`板から消えた項目 ${gone.join('・')}`); }
    ok(sfs.length === 5 && !srcBad.length, `${s}: 勤務・訓練の面と待遇の板の資料は、そこに出ている項目の台帳の資料と同じ並び（勤務・訓練へ移した項目の資料も落としていない）`, srcBad.join(' ／ '));
  }
  /* S4 (d) */
  const lists = ['PAY_SECTIONS', 'p_section', 'section in (', 'section not in ('].filter(w => GEN.includes(w));
  ok(!lists.length, '生成側（gen-airline-glance.mjs）は、区分の一覧を決まりとして持たない（2つの印は、面の表の名指しだけ）', lists.join(' ／ '));
}
head('生成側と CSS の止め・読む人が替わった時の月の勤務（S8b・N8）');
{
  /* S8b 生成側の5つの止めが在る。板の下の入口の行（pvg-addrow）を持ち帰っていない。面と頭の1行の決まりは動きを持たない（数の合計は書かない） */
  const GEN = read('gen-airline-glance.mjs'), GCSS = read('pv-glance.css'), GL = GEN.split('\n');
  const THROWS = ['同じ名前の入口か', '入口の質問', '同じ話題を2つの面が', 'どの面に出すか決めていない', '出典が会社の公表ではない'];
  const lost = THROWS.filter(w => !GL.some(l => l.includes(w) && l.includes('throw new Error(')));
  ok(!lost.length, '生成側の5つの止め（同じ入口・入口の質問・同じ話題・置き場の無い公表・会社の公表ではない出典）が在る', `無い：${lost.join(' ／ ')}`);
  ok(!GEN.includes('pvg-addrow') && !GCSS.includes('pvg-addrow'), '板の下の入口の行（pvg-addrow）を、生成側にも pv-glance.css にも持っていない');
  let flat = noCssCmt(GCSS), prev;
  do { prev = flat; flat = flat.replace(/@[^{};]+\{((?:[^{}]|\{[^{}]*\})*)\}/g, (m, inner) => inner); } while (flat !== prev);
  const moving = [...flat.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => /\.pvg-sf|\.pvg-moved/.test(m[1]) && /transition/.test(m[2])).map(m => m[1].trim());
  ok(!moving.length, '面（.pvg-sf…）と待遇の板の頭の1行（.pvg-moved）の決まりは、動きを持たない（transition が無い）', moving.join(' ／ '));
  /* N8 読む人が替わったら、前の人の月の勤務と補足を残さない（setUid が wkv: と note: を捨て、work / notes の欄を描き直す） */
  const LJ = noJsCmt(read('career-live.js'));
  const body = (LJ.match(/\n  function setUid\([^)]*\) \{\n([\s\S]*?)\n  \}\n/) || [])[1] || '';
  ok(/drop\('wkv:'\)/.test(body) && /drop\('note:'\)/.test(body) && /reset\(\[[^\]]*'work'[^\]]*\]\)/.test(body) && /reset\(\[[^\]]*'notes'[^\]]*\]\)/.test(body),
    '読む人が替わったら、月の勤務と補足も聞き直す（setUid が wkv: と note: を捨て、work / notes を描き直す）');
}
head('口コミの一覧の部品の持ち越し（区分の絵・「要約のもと」の札の字）');
{
  /* E9.5・A41：区分のタイルの絵は、区分の名前で引く（並び順の番号 CAT_ICONS[i] で引くと、区分と絵がずれる）。
     「要約のもと」の札の字は、日本語と英語で1行ずつ。英語のページには要約の欄が無いので、英語の札の字はここでしか見られない。
     注釈を落とした字で読む（注釈の中に書いても、ここは赤にならない）。 */
  const ui = noJsCmt(read('airlines/airline-reviews-ui.js')), lines = ui.split('\n'), n = t => lines.filter(l => l.includes(t)).length;
  ok(!ui.includes('CAT_ICONS[i]'), '口コミの一覧の部品は、区分のタイルの絵を並び順で選ばない（CAT_ICONS[i] が無い）');
  const TAG_JA = "sumSrcTag: '要約のもと',", TAG_EN = "sumSrcTag: 'Used in the summary',";
  ok(n(TAG_JA) === 1 && n(TAG_EN) === 1, '「要約のもと」の札の字は、日本語「要約のもと」と英語「Used in the summary」の1行ずつ', `日本語 ${n(TAG_JA)}行・英語 ${n(TAG_EN)}行`);
}
/* 場面 living（ブラウザ）が読む、家賃の棒の行の答え ＝ 下の SB の BR そのもの（台帳から・団地が在れば団地）。ページからは読まない。 */
const LIV_BARS = {};
head('暮らし（街・家賃・空港までの移動）');
{
  /* 期待する値は台帳から作る（viewOf も生成側も通さない）。エティハドの家賃は career-facts.mjs（1年あたり → 12で割って1の位で丸める）、
     棒の間取り・空港・移動は living-facts.mjs の ABUDHABI。エティハドの列の名前だけは台帳に無い（読み口の COLS_EY）＝ 同じ字をここに持つ（字が変われば赤）。
     団地ごとの家賃（estates）を持つ街は、rent_from の団地の額と名前で読む（カードの小さな字は「団地の名前・間取り」）。 */
  const EY_COLS = [['studio', 'スタジオ'], ['bed1', '1寝室'], ['bed2', '2寝室']];
  const perM = v => Object.fromEntries(Object.entries(v || {}).map(([k, n]) => [k, Array.isArray(n) ? n.map(x => Math.round(x / 12)) : Math.round(n / 12)]));
  const LED = s => (s === 'etihad'
    ? { c: ABUDHABI, cols: EY_COLS, lead: 'bed1', refs: [], estates: [],
        towns: EY_FACTS.etihad.living.rents.map((r, i) => ({ key: r.key, ja: r.ja, sub: r.en || '', area: '', iata: r.iata || '', lead: i === 0, month: perM(r.value),
          when: livWhen(r), urls: [r.src && r.src.url, r.pick_src && r.pick_src.url] })) }
    : (c => ({ c, cols: c.cols, lead: c.lead_col, refs: c.refs || [],
        estates: c.rents.flatMap(r => (r.estates || []).map(e => ({ key: e.key, town: r.key, month: e.value || {}, n: e.n || {} }))),
        towns: c.rents.map(r => {
          const e = r.estates ? r.estates.find(x => x.key === r.rent_from) || null : null;
          return { key: r.key, ja: r.ja, sub: r.sub_ja || r.en || '', area: e ? e.ja : (r.rent_area_ja || ''), iata: r.iata || '', lead: !!r.lead, month: (e ? e.value : r.value) || {},
            when: e ? livWhen(e) : r.value ? livWhen(r) : '',
            urls: [r.src && r.src.url, r.pick_src && r.pick_src.url, ...(r.estates || []).map(x => x.src && x.src.url)] };
        }) }))(LIVING[CITY_OF[s]]));
  /* この検査の道具（読み口の計算は借りない） */
  const tagEnd = (h, i, tag) => {
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    re.lastIndex = i;
    for (let d = 0, m; (m = re.exec(h));) { d += m[1] ? -1 : 1; if (!d) return re.lastIndex; }
    return -1;
  };
  const cutAt = (h, start, tag) => { const i = h.indexOf(start); const j = i < 0 ? -1 : tagEnd(h, i, tag); return i < 0 || j < 0 ? '' : h.slice(i, j); };
  const cutsOf = (h, re, tag) => [...h.matchAll(re)].map(m => ({ m, h: h.slice(m.index, tagEnd(h, m.index, tag)) }));
  const livOf = s => cutAt(PART[s].glance, '<section class="pvg-liv"', 'section');
  const panelOf = s => cutAt(PART[s].glance, '<div class="pvg-card pvg-panel" id="pvg-p-living"', 'div');
  /* 額の字の数（円の目安 small.pvg-yen は外す）。「万円」なら円に直す */
  const amountsOf = h => { const t = text(h.replace(/<small class="pvg-yen"[^>]*>[\s\S]*?<\/small>/g, '')); const n = [...t.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m => +m[0].replace(/,/g, ''));
    return t.includes('万円') ? n.map(x => Math.round(x * 10000)) : n; };
  const want = v => (Array.isArray(v) ? v : [v]);
  const mm = n => (n < 60 ? `${n}分` : `${Math.floor(n / 60)}時間${n % 60}分`);
  const minOf = x => Object.values(x.value)[0];
  const cardRows = (c, key) => (c.by_town ? (c.commute || []).filter(x => x.via === 'gmaps' && x.town === key && !x.warn && FAMILY[x.mode] === c.card_family
    && (c.ends[x.end] || {}).iata === c.airports[0][0]) : []);
  const MODE_W = { train: '電車', taxi: 'タクシー', bus: 'バス', car: '車' };
  const KIND_W = { walk_total: '徒歩込み', shown_total: '経路の合計' };
  const chipsOf = rows => MODES.filter(m => rows.some(x => (x.modes || [x.mode]).includes(m))).map(m => MODE_W[m]);
  const spanOf = rows => { const v = rows.map(minOf), lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? mm(lo) : hi < 60 ? `${lo}〜${hi}分` : `${mm(lo)}〜${mm(hi)}`; };
  const mainOf = ja => ja.replace(/（[^（）]+）$/, ''), tailOf = ja => (/（([^（）]+)）$/.exec(ja) || [])[1] || '';
  const amp = u => String(u).replace(/&/g, '&amp;');
  for (const s of FIVE) {
    const D = LED(s), c = D.c, T = D.towns, sec = livOf(s), panel = panelOf(s);
    const cards = cutsOf(sec, /<li><button type="button" class="pvg-town" data-town="([^"]*)"/g, 'li').map(({ m, h }) => ({
      key: m[1], h, n: unesc(one(h, /<b class="pvg-town-n">([^<]*)<\/b>/) || ''), sub: unesc(one(h, /<span class="pvg-town-s"[^>]*>([^<]*)<\/span>/) || ''),
      rent: cutAt(h, '<span class="pvg-town-r">', 'span'), way: cutAt(h, '<span class="pvg-town-a">', 'span') }));
    const card = k => cards.find(x => x.key === k);
    /* SL1 */
    ok(sec && cards.length === T.length && same(cards.map(x => [x.key, x.n, x.sub]), T.map(t => [t.key, mainOf(t.ja), t.sub || tailOf(t.ja)])),
       `${s}: 暮らしのカードは、台帳の街と同じ数・同じ順・同じ名前`, `${cards.map(x => `${x.key}:${x.n}/${x.sub}`).join(' ')} ／ 台帳 ${T.map(t => `${t.key}:${mainOf(t.ja)}`).join(' ')}`);
    /* SL2 */
    const barsOn = sec.includes(' data-pvg-rent'), label = Object.fromEntries(D.cols);
    const colOf = t => (t.month[D.lead] != null ? D.lead : (D.cols.find(([k]) => t.month[k] != null) || [])[0]);
    const rentBad = T.flatMap(t => {
      const x = card(t.key), col = colOf(t);
      if (!x) return [`${t.key}: カードが無い`];
      if (!col) return x.rent ? [`${t.key}: 家賃の無い街に家賃の行`] : [];
      const word = (barsOn && c.bars.includes(col) && c.words[col]) || String(label[col] || '').replace(/（[^）]*）/g, '');
      const lab = unesc(one(x.rent, /^<span class="pvg-town-r"><small>([^<]*)<\/small>/) || ''), got = amountsOf(x.rent.replace(/^<span class="pvg-town-r"><small>[^<]*<\/small>/, ''));
      const bad = [];
      if (lab !== (t.area ? `${t.area}・` : '') + word) bad.push(`${t.key}: 字「${lab}」`);
      if (!same(got, want(t.month[col]))) bad.push(`${t.key}: 額 ${got.join('〜')}（台帳 ${want(t.month[col]).join('〜')}）`);
      return bad;
    });
    ok(cards.length && !rentBad.length, `${s}: カードの家賃は、その街の・先頭の間取りの・台帳の額（家賃の無い街には家賃の行が無い）`, rentBad.join(' ／ '));
    /* SL3 */
    const wayBad = T.flatMap(t => {
      const x = card(t.key), rows = cardRows(c, t.key);
      if (!x) return [];
      if (!rows.length) return x.way ? [`${t.key}: 行の無い街に移動の字`] : [];
      if (!x.way) return [`${t.key}: 移動の字が無い`];
      const chips = [...x.way.matchAll(/<i class="pvg-mode">([^<]*)<\/i>/g)].map(m => m[1]), code = one(x.way, /<i class="pvg-code3">([^<]*)<\/i>/), tx = one(x.way, /<span>([^<]*)<\/span><\/span>$/);
      return same(chips, chipsOf(rows)) && code === c.airports[0][0] && tx === spanOf(rows) ? [] : [`${t.key}: ${chips.join('・')} ${code} ${tx}（台帳 ${chipsOf(rows).join('・')} ${c.airports[0][0]} ${spanOf(rows)}）`];
    });
    ok(cards.length && !wayBad.length, `${s}: カードの移動は、その街の Google マップの行から（手段・空港・分、着く場所で違えば幅）。行の無い街には出さない`, wayBad.join(' ／ '));
    /* SL4 */
    const details = cutsOf(sec, /<section class="pvg-td" id="pvg-town-([^"]*)" data-town-detail="([^"]*)"/g, 'section');
    const detBad = details.length === T.length ? [] : [`詳細 ${details.length}つ（台帳 ${T.length}）`];
    for (const t of T) {
      const d = (details.find(x => x.m[2] === t.key) || {}).h || '';
      if (!d) { detBad.push(`${t.key}: 詳細が無い`); continue; }
      const keys = [...d.matchAll(/ data-way="([^"]*)"/g)].map(m => m[1]), list = c.commute || [];
      let wantKeys;
      if (c.by_town) {
        const mine = list.filter(x => x.town === t.key), gm = mine.filter(x => x.via === 'gmaps'), g = gm.filter(x => !x.warn);
        wantKeys = [...g.map(x => x.key), ...mine.filter(x => x.via !== 'gmaps' && (x.cur || !gm.length)).map(x => x.key)];
        const ends = [...new Set(g.map(x => x.end))], lis = cutsOf(d, /<li data-end="([^"]*)">/g, 'li');
        if (!same(lis.map(x => x.m[1]), ends)) detBad.push(`${t.key}: 着く場所 ${lis.map(x => x.m[1]).join('・')}（台帳 ${ends.join('・')}）`);
        for (const { m, h } of lis) {
          const figs = g.filter(x => x.end === m[1]).sort((a, b) => (a.mode === 'car') - (b.mode === 'car'));
          if (!figs.length) continue;
          const lab = unesc(one(h, /<span class="pvg-way-l">([^<]*)<\/span>/) || ''), wl = `${figs[0].from_ja} → ${c.ends[m[1]].ja}`;
          if (lab !== wl) detBad.push(`${t.key}: 札「${lab}」（台帳「${wl}」）`);
          const got = [...h.matchAll(/<span class="pvg-way-f" data-way="([^"]*)">([\s\S]*?)<\/span>/g)].map(f => [f[1], unesc(one(f[2], /<b>([^<]*)<\/b>/) || ''), [...f[2].matchAll(/<small>([^<]*)<\/small>/g)].map(y => y[1])]);
          const exp = figs.map(x => { const k = Object.keys(x.value)[0]; return [x.key, mm(x.value[k]), [...(KIND_W[k] ? [KIND_W[k]] : []), ...(x.ride != null ? [`乗車${x.ride}分`] : [])]]; });
          if (!same(got, exp)) detBad.push(`${t.key}/${m[1]}: ${JSON.stringify(got)}（台帳 ${JSON.stringify(exp)}）`);
        }
      } else wantKeys = (t.iata ? list.filter(x => x.iata === t.iata) : list).map(x => x.key);
      if (!same([...keys].sort(), [...wantKeys].sort())) detBad.push(`${t.key}: 行 ${keys.join('・') || '無し'}（台帳 ${wantKeys.join('・') || '無し'}）`);
      const opens = [...d.matchAll(/ data-pvc-open="[^"]*"([^>]*)>/g)].map(m => unesc(one(m[1], /data-pvc-ctx="([^"]*)"/) || ''));
      if (!(opens.length === 1 && opens[0] === mainOf(t.ja))) detBad.push(`${t.key}: 入口 ${opens.length}つ（街 ${opens.join('・')}）`);
    }
    ok(cards.length && !detBad.length, `${s}: 街の詳細に在る移動の行は、その街の行だけ（着く場所ごと・ほかの街の行も、注意の付いた行も混ざっていない）`, detBad.slice(0, 6).join(' ／ '));
    /* SL5 */
    const evs = sec.split('class="pvg-dt pvg-srcd pvg-ev"').length - 1, ev = cutAt(sec, '<details class="pvg-dt pvg-srcd pvg-ev" data-pvg-ev>', 'details');
    const evBad = evs === 1 && ev ? [] : [`出典の畳み ${evs}つ`];
    const urls = [...T.flatMap(t => t.urls), ...D.refs.flatMap(g => g.rows.map(r => r.src && r.src.url)), ...(c.commute || []).map(x => x.src && x.src.url)].filter(Boolean);
    for (const u of new Set(urls)) if (!ev.includes(`href="${amp(u)}"`)) evBad.push(`出典に無い ${u}`);
    const srcRows = cutsOf(ev, /<li data-way-src="([^"]*)">/g, 'li');
    if (!same(srcRows.map(x => x.m[1]).sort(), (c.commute || []).map(x => x.key).sort())) evBad.push(`移動の記録 ${srcRows.map(x => x.m[1]).join('・') || '無し'}（台帳 ${(c.commute || []).map(x => x.key).join('・') || '無し'}）`);
    for (const x of c.commute || []) {
      const h = (srcRows.find(y => y.m[1] === x.key) || {}).h || '', w = h.split(' data-way-warn>').length - 1, wt = unesc(one(h, /<span class="pv-no-cur" data-way-warn>([^<]*)<\/span>/) || '');
      if (x.warn ? !(w === 1 && wt === x.warn) : w !== 0) evBad.push(`${x.key}: 注意 ${w}つ「${wt}」（台帳「${x.warn || ''}」）`);
      if (c.by_town && !x.town && sec.includes(` data-way="${x.key}"`)) evBad.push(`${x.key}: 街の鍵の無い行が、詳細に在る`);
    }
    for (const g of D.refs) {
      const li = cutAt(ev, `<li data-ref="${g.key}">`, 'li'), got = [...li.matchAll(/<span class="pv-no-cur" data-ref-basis="[^"]*">([^<]*)<\/span>/g)].map(m => unesc(m[1]));
      if (!li || !same(got, (g.rent_basis || []).map(b => b.value))) evBad.push(`参考 ${g.key}: 断り ${got.length}つ（台帳 ${(g.rent_basis || []).length}）`);
    }
    ok(sec && !evBad.length, `${s}: 「出典」は都市に1つ。台帳の出どころは全部その中に在り、街の鍵の無い移動の行はそこにだけ在る`, evBad.slice(0, 6).join(' ／ '));
    /* SL6 */
    const rank = (text(panel).match(/人気|ランキング|おすすめ|安い|高い|割安|割高|お得|[\d.]\s*倍/g) || []);
    ok(panel && !rank.length, `${s}: 暮らしの板に、人気・順位・安い・高い の語が無い`, rank.join('・'));
    /* SL8 */
    const cellH = one(PART[s].glance, /<article class="pvg-card pvg-cell" data-cell="living"[^>]*>([\s\S]*?)\n<\/article>/) || '';
    const k = text(one(cellH, /<p class="pvg-k">([\s\S]*?)<\/p>/) || ''), vH = one(cellH, /<p class="pvg-v[^"]*">([\s\S]*?)<\/p>/) || '', note = text(one(cellH, /<p class="pvg-note">([\s\S]*?)<\/p>/) || '');
    const more = one(cellH, /<button type="button" class="pvg-more"[^>]*><span>([^<]*)<\/span>/) || '', also = [...cellH.matchAll(/<ul class="pvg-also"><li><span>[^<]*<\/span><b>([\s\S]*?)<\/b><\/li><\/ul>/g)].map(m => text(m[1]));
    const LT = T.find(t => t.lead) || T[0], lr = LT ? cardRows(c, LT.key) : [], site = c.site ? SITES[c.site].name : '';
    const cellBad = [];
    if (!cellH || !LT) cellBad.push('暮らしの欄か台帳の先頭の街が無い');
    else if (LT.month[D.lead] != null) {
      if (!k.startsWith(`${LT.ja}${LT.area ? `（${LT.area}）` : ''}・`)) cellBad.push(`名前「${k}」`);
      if (!same(amountsOf(vH), want(LT.month[D.lead]))) cellBad.push(`額 ${amountsOf(vH).join('〜')}（台帳 ${want(LT.month[D.lead]).join('〜')}）`);
      if (!(site && (note === site || note.startsWith(`${site}・`)))) cellBad.push(`出どころ「${note}」（台帳 ${site}）`);
    } else if (lr.length) {
      if (k !== `${LT.ja}・空港までの移動`) cellBad.push(`名前「${k}」`);
      if (text(vH) !== `${chipsOf(lr).join('・')} ${spanOf(lr)}`) cellBad.push(`移動「${text(vH)}」`);
      if (more !== '出どころを見る') cellBad.push(`ボタン「${more}」`);
    } else if (!(k === '拠点の街' && note === '家賃の資料を確認できていません')) cellBad.push(`家賃も移動も無い街の字「${k}」「${note}」`);
    if (LT && lr.length && !(also.length === 1 && also[0].endsWith(spanOf(lr)))) cellBad.push(`移動の1行「${also.join('／')}」`);
    ok(!cellBad.length, `${s}: 概要の暮らしの欄は、台帳の先頭の街（家賃の額と出どころの名前、無ければ空港までの分）`, cellBad.join(' ／ '));
    /* SL9 */
    const fold = cutAt(panel, '<details class="pvg-dt pvg-srcd pvg-phc">', 'details'), need = T.filter(t => { const p = placePhoto(t.key); return p && placeCredit(p); });
    const crs = [...fold.matchAll(/<li data-cr="([^"]*)"><b>([^<]*)<\/b><span>([\s\S]*?)<\/span><\/li>/g)].map(m => ({ key: m[1], name: unesc(m[2]), h: m[3] }));
    const crBad = [];
    if (!same(crs.map(x => x.key).sort(), need.map(t => t.key).sort())) crBad.push(`行 ${crs.map(x => x.key).join('・') || '無し'}（台帳 ${need.map(t => t.key).join('・') || '無し'}）`);
    for (const t of need) {
      const p = placePhoto(t.key), x = crs.find(y => y.key === t.key);
      if (x && !(x.name === mainOf(t.ja) && text(x.h).includes(p.author) && x.h.includes(`href="${amp(p.source)}"`) && x.h.includes(`href="${amp(p.licence_url)}"`) && text(x.h).includes(p.licence))) crBad.push(`${t.key}: 作者・出所・ライセンスが台帳と違う`);
    }
    if (need.length ? one(fold, /<summary>写真の出典<small>(\d+)枚<\/small>/) !== String(need.length) : fold !== '') crBad.push(`枚数「${one(fold, /<small>(\d+)枚/)}」（台帳 ${need.length}）`);
    ok(panel && !crBad.length, `${s}: 街の写真のクレジット（示すことが条件の写真は、作者名とライセンスのリンクつき）`, crBad.join(' ／ '));
    /* E9.4「＋住みやすい街を追加」が面へ渡すのは、カードのとおり（ページから作り直す。生成側の関数は呼ばない）。
       基地 ＝ 同じ板の section.pvg-liv の data-base。空港 ＝ 3字の並びで、頭がその基地・この都市の台帳の空港と同じ並び
       （移動の行と見出しの空港は、この台帳から作られる。全日空のページは見出しに空港の3字を出さず、成田は移動の行にも無い
       ＝ ページの字だけでは確かめられないので、行の出どころの台帳と突き合わせる）・頭の基地はページに3字で出ている。
       街 ＝ 同じ板のカードの [名前, 下の行 か ""] を、カードの順に。属性のどこにも額（数字＋万・円）・「¥」・通貨の3字が無い。 */
    const tEnt = one(panel, /<a class="pvg-link pvg-liv-add"([^>]*)>/) || '';
    const tAttr = n => unesc(one(tEnt, new RegExp(` ${n}="([^"]*)"`)) || '');
    const tJson = n => { try { return JSON.parse(tAttr(n)); } catch { return null; } };
    const tBase = tAttr('data-pvc-base'), tPorts = tJson('data-pvc-ports'), tTowns = tJson('data-pvc-towns');
    const secBase = one(sec, /^<section class="pvg-liv"[^>]* data-base="([^"]*)"/);
    const CUR3 = JSON.parse(read('pv-vocab.json')).currencies.map(x => x.code);
    const e94 = [];
    if (!tEnt) e94.push('入口が無い');
    else {
      if (!(tBase && tBase === secBase)) e94.push(`基地 ${tBase}（節の data-base ${secBase}）`);
      if (!(Array.isArray(tPorts) && tPorts.length > 0 && tPorts.every(p => /^[A-Z]{3}$/.test(p)) && tPorts[0] === tBase && same(tPorts, c.airports.map(a => a[0]))))
        e94.push(`空港 ${JSON.stringify(tPorts)}（台帳 ${JSON.stringify(c.airports.map(a => a[0]))}・頭は基地 ${tBase}）`);
      if (!(PAGES[s].includes(`<i class="pvg-code3">${tBase}</i>`) || (one(PART[s].hero, /<span class="pvg-base">([\s\S]*?)<\/span>/) || '').includes(tBase))) e94.push(`基地 ${tBase} がページに3字で出ていない`);
      if (!same(tTowns, cards.map(x => [x.n, x.sub]))) e94.push(`街 ${JSON.stringify(tTowns)}（カード ${JSON.stringify(cards.map(x => [x.n, x.sub]))}）`);
      const raw = unesc(tEnt);
      if (/\d\s*(?:万|円)|¥|￥/.test(raw) || CUR3.some(k => new RegExp(`\\b${k}\\b`).test(raw))) e94.push(`額・通貨の字 ${raw.slice(0, 120)}`);
    }
    ok(!e94.length, `${s}: 「＋住みやすい街を追加」が面へ渡すのは、カードのとおり（基地・空港・街の名前。額も通貨も渡さない）`, e94.join(' ／ '));
    /* TG5 入口の街は、サーバの候補の種に在る（db/towns.generated.sql を字として読む）。
       data-pvc-towns の名前は「-- 1.」の行（その会社・その基地）に、lang="en" の下の行は「-- 2.」の別の書き方の行に在る。 */
    const seedSql = read('db/towns.generated.sql');
    const seedRows = (head) => {
      const i = seedSql.indexOf(`\n-- ${head}.`), j = i < 0 ? -1 : seedSql.indexOf('\n  ) as v(', i);
      return i < 0 || j < 0 ? [] : seedSql.slice(i, j).split('\n').filter(l => /^ {4}\(/.test(l))
        .map(l => [...l.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, () => "'")).join('|'));
    };
    const sec1 = new Set(seedRows(1)), sec2 = new Set(seedRows(2)), tg5 = [];
    if (!sec1.size || !sec2.size) tg5.push('種の節が読めない');
    for (const t of Array.isArray(tTowns) ? tTowns : []) if (!sec1.has([s, tBase, t[0]].join('|'))) tg5.push(`「${t[0]}」が種の街に無い`);
    for (const x of cards.filter(x => x.h.includes('<span class="pvg-town-s" lang="en">'))) if (!sec2.has([s, tBase, x.n, x.sub].join('|'))) tg5.push(`「${x.n}」の「${x.sub}」が種の別の書き方に無い`);
    ok(Array.isArray(tTowns) && tTowns.length > 0 && !tg5.length, `${s}: 入口の街は、サーバの候補の種に在る（名前は種の街・ラテン文字の下の行は種の別の書き方）`, tg5.join(' ／ '));
    /* TG6 暮らしの板は、街の一覧に「3人そろった」と言わない（「パイロットの回答」の見出しの下は、1件目から出る） */
    ok(panel && !panel.includes('3人そろった') && !text(panel).includes('3人そろった'), `${s}: 暮らしの板は、街の一覧に「3人そろった」と言わない`);

    /* SB1〜SB5 家賃の棒（都市に1組）。棒の行は台帳から：団地ごとの家賃（estates）が在れば団地、無ければ額を持つ街。
       棒にできる数字の種類は台帳の BAR_STATS（ここに2つめの一覧を書かない）。 */
    const BR = D.estates.length ? D.estates.map(e => ({ id: e.key, town: e.town, month: e.month, n: e.n }))
      : T.filter(t => Object.keys(t.month).length).map(t => ({ id: t.key, town: t.key, month: t.month, n: null }));
    const valOf = (x, k) => (x && typeof x.month[k] === 'number' ? x.month[k] : null);
    const barCity = c.site != null && BAR_STATS.includes(c.stat) && BR.some(x => c.bars.some(k => valOf(x, k) !== null));
    LIV_BARS[s] = { on: barCity, bars: c.bars, lead: D.lead, rows: BR };
    const rbN = sec.split('<div class="pvg-rb" data-pvg-rent').length - 1, rb = cutAt(sec, '<div class="pvg-rb" data-pvg-rent', 'div');
    const groups = readBars(rb, 'pvg-rb'), sizeOf = g => one(g.attrs, /data-size-panel="([^"]*)"/);
    const live = barCity && rbN === 1 && groups.length > 0;
    /* SB1 */
    const btns = [...rb.matchAll(/<button type="button" class="pvg-rb-b" data-pvg-size="([^"]*)" aria-pressed="(true|false)">([^<]*)<\/button>/g)].map(m => ({ k: m[1], on: m[2] === 'true', w: unesc(m[3]) }));
    const sLine = one(rb, /<p class="pvg-rb-s pv-no-cur">([\s\S]*?)<\/p>/) || '';
    const sHead = unesc(one(sLine, /^([^<]*)/) || ''), sSpans = [...sLine.matchAll(/<span>([^<]*)<\/span>/g)].map(m => unesc(m[1]));
    const LT0 = T.find(t => t.lead) || T[0];
    const sb1 = rbN === (barCity ? 1 : 0) ? [] : [`棒の組 ${rbN}つ（台帳 ${barCity ? 1 : 0}）`];
    if (barCity && rbN === 1) {
      const words = c.bars.map(k => c.words[k]), sWant = [...(c.beside_ja ? [c.beside_ja] : []), LT0 ? LT0.when : ''];
      if (!same(groups.map(sizeOf), c.bars) || !same(groups.map(g => unesc(g.caption)), words)) sb1.push(`組 ${groups.map(g => `${sizeOf(g)}:${unesc(g.caption)}`).join('・')}（台帳 ${c.bars.map(k => `${k}:${c.words[k]}`).join('・')}）`);
      if (!same(btns.map(b => b.k), c.bars) || !same(btns.map(b => b.w), words)) sb1.push(`ボタン ${btns.map(b => `${b.k}:${b.w}`).join('・') || '無し'}（台帳 ${c.bars.map(k => `${k}:${c.words[k]}`).join('・')}）`);
      const on = btns.filter(b => b.on).map(b => b.k);
      if (!same(on, [D.lead])) sb1.push(`押してある間取り ${on.join('・') || '無し'}（台帳 ${D.lead}）`);
      if (sHead !== SITES[c.site].name || !same(sSpans, sWant)) sb1.push(`下の行「${sHead}｜${sSpans.join('｜')}」（台帳 ${SITES[c.site].name}｜${sWant.join('｜')}）`);
    }
    ok(sec && !sb1.length, `${s}: 家賃の棒の組は、台帳に棒にできる数字が在る都市にだけ在る（間取りのボタン＝出どころの呼び名）`, sb1.join(' ／ '));
    /* SB2 行の並び・額の無い行・行の街（data-town）。比例は SB3 */
    const cbL = live ? checkBars(groups, c.bars.map(k => BR.map(x => ({ id: x.id, value: valOf(x, k) })))) : { bad: [], end: null };
    const sb2 = cbL.bad.filter(b => !/比例していない|100% を超えている/.test(b));
    for (const m of rb.matchAll(/<li class="pvg-rb-row(?: is-none)?" data-bar="([^"]*)"(?: data-town="([^"]*)")?>/g)) {
      const x = BR.find(y => y.id === m[1]);
      if (!x || m[2] !== x.town) sb2.push(`${m[1]}: data-town「${m[2] || '無し'}」（台帳 ${x ? x.town : '台帳に無い行'}）`);
    }
    ok(!barCity || (live && !sb2.length), `${s}: 棒の行は、どの間取りでも台帳の街の順（並べ替えていない）・額の無い行に棒が無い`, sb2.slice(0, 6).join(' ／ '));
    /* SB3 比例・0 から・1つの目盛（並びはページのまま突き合わせる ＝ 並べ替えは SB2 だけが赤） */
    const cbP = live ? checkBars(groups, groups.map(g => g.rows.map(r => ({ id: r.id, value: valOf(BR.find(x => x.id === r.id), sizeOf(g)) })))) : { bad: [], end: null };
    const widths = groups.flatMap(g => g.rows.map(r => parseFloat(r.width))).filter(Number.isFinite), top = widths.length ? Math.max(...widths) : NaN;
    const zeros = [...rb.matchAll(/<span class="pvg-rb-ax"><i>([\s\S]*?)<\/i>/g)].map(m => m[1]);
    const sb3 = cbP.bad.filter(b => /比例していない|100% を超えている/.test(b));
    if (live && !(top >= 66 && top <= 100)) sb3.push(`いちばん長い棒 ${top}%`);
    if (live && !(zeros.length === groups.length && zeros.every(z => z === '0'))) sb3.push(`目盛の左端 ${zeros.join('・')}`);
    ok(!barCity || (live && !sb3.length), `${s}: 棒の長さは額に比例・0 から・全部の間取りで1つの目盛（いちばん長い棒は 66%〜100%）`, sb3.slice(0, 6).join(' ／ '));
    /* SB4 目盛の右端の字・棒の横の額（団地の行は件数も）・列の長さ（em） */
    const ends = [...rb.matchAll(/<span class="pvg-rb-ax"><i>[\s\S]*?<\/i><i>([\s\S]*?)<\/i><\/span>/g)].map(m => m[1]), endN = ends.length ? amountsOf(ends[0]) : [];
    const sb4 = [];
    if (live) {
      if (!(ends.length === groups.length && ends.every(e => e === ends[0]))) sb4.push(`右端の字 ${ends.map(e => text(e)).join('・')}`);
      if (!(endN.length === 1 && cbP.end > 0 && Math.abs(endN[0] - cbP.end) <= cbP.end * 0.001)) sb4.push(`右端 ${endN.join('・')}（棒から ${cbP.end}）`);
      const st = one(rb, /^<div class="pvg-rb" data-pvg-rent style="([^"]*)">/) || '';
      if (!/^--rb-n:\d+(?:\.\d+)?em;--rb-v:\d+(?:\.\d+)?em$/.test(st)) sb4.push(`列の長さ「${st}」`);
      for (const { m: gm, h: gh } of cutsOf(rb, /<div class="pvg-rb-g" data-size-panel="([^"]*)">/g, 'div'))
        for (const { m: rm, h: rh } of cutsOf(gh, /<li class="pvg-rb-row" data-bar="([^"]*)"[^>]*>/g, 'li')) {
          const x = BR.find(y => y.id === rm[1]), v = cutAt(rh, '<span class="pvg-rb-v">', 'span');
          const cnt = one(v, /<small class="pvg-rb-c">([^<]*)<\/small>/), amt = amountsOf(v.replace(/<small class="pvg-rb-c">[\s\S]*?<\/small>/g, ''));
          const wantC = x && x.n && x.n[gm[1]] != null ? `${x.n[gm[1]]}件` : null;
          if (!same(amt, [valOf(x, gm[1])])) sb4.push(`${gm[1]}/${rm[1]}: 額 ${amt.join('・')}（台帳 ${valOf(x, gm[1])}）`);
          if ((cnt || null) !== wantC) sb4.push(`${gm[1]}/${rm[1]}: 件数「${cnt || '無し'}」（台帳 ${wantC || '無し'}）`);
        }
    }
    ok(!barCity || (live && !sb4.length), `${s}: 目盛の右端の字は、棒から逆算した額と同じ・どの間取りでも同じ字。棒の横の額は台帳の額`, sb4.slice(0, 6).join(' ／ '));
    /* SB5（A15 の向け直し）額の無い街：カードに家賃の行が無い・棒の組に行が無い・詳細に「家賃の資料を確認できていません」が1つ。
       出どころの無い拠点：棒の組も、家賃の行も表も無い。 */
    const sb5 = [];
    for (const t of T.filter(t => !Object.keys(t.month).length)) {
      const x = card(t.key), d = (details.find(y => y.m[2] === t.key) || {}).h || '', k = d.split('家賃の資料を確認できていません').length - 1;
      if (x && x.rent) sb5.push(`${t.key}: カードに家賃の行`);
      if (rb.includes(` data-town="${t.key}"`)) sb5.push(`${t.key}: 棒の組に行`);
      if (k !== 1) sb5.push(`${t.key}: 詳細の「家賃の資料を確認できていません」${k}つ`);
    }
    if (c.site == null && (rbN || sec.includes('<span class="pvg-town-r">') || sec.includes('<dl class="pvg-kv">'))) sb5.push('出どころの無い拠点に、家賃の棒・行・表');
    ok(sec && !sb5.length, `${s}: 家賃の出どころが無い拠点・額の無い街には、家賃の行も棒も無い`, sb5.join(' ／ '));
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
     mode 'rated404' … 口コミは 'rated' と同じ・要約の口だけ 404（＝ いまの本番の形。要約の欄は未接続の1行を出し、下の欄の錠前の1行が見える）
     mode 'off'   … 全部 500 ＝「読めない時」
     mode 'facts404' … 集計の口（pv_contrib_facts）だけ 404 ＝ 口がまだ無い時（ほかは 'empty' と同じ）
     mode 'work'  … 月の勤務の口が、開いている人への返事に、検査用の幅（WORK_FIX）を付けて返す
     mode 'work0' … 月の勤務の口が、開いている人への返事を、どの項目も数字なしで返す（NO_WORK）
     mode 'work2' … 'work' と同じ。月の勤務の返事だけ、機長の勤務・拘束時間が別の幅（WORK_FIX2）＝ 2回めの読み込みで、目盛が値に合わせて動かないことを見る
     mode 'give'  … ログインも給与の提出も済んでいて、自分の会社への回答が足りない人：集計・月の勤務・補足の口は、状態の語 'give' に、わざと中身
                    （検査用の行・月の勤務の幅・補足の文）を付けて返す ＝ 画面が1文字も出さないことを見る・答えるカードの口が、カードの中身を返す
     mode 'giveOpen' … 同じ人が、要る数まで答えたあと ＝ ほかの人の回答が開いている人：集計の口は、開いた返事に検査用の行を付けて返す・
                    月の勤務は数字なし・補足は0件・答えるカードの口は 'open' の1語（開いている人に、カードの中身は返らない）
   口コミの要約の口（pv_review_summary）は、本番にまだ無い（2026-10-07）。無い時に本物のサーバーが返すのは 404 なので、
   SUM_BY_MODE に無い場面では 404 を返す ＝ 要約の欄は未接続の1行（評価が0件のページでは畳む）。作った文で埋めない。
   場面ごとの返事は SUM_BY_MODE（rated ＝ ログイン済みで鍵なし／ratedLogin ＝ 未ログイン／ratedFew／ratedNone／ratedOpen）。わざと要約の文を混ぜる（画面が1文字も出さないことを見る）。 */
const LIBS = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com)$/;
const PAY_RE = /\/rest\/v1\/rpc\/pv_pay_rows$/;
/* ホテルの欄だけ、場面ごとに返事を差し替えられる（seen.stay）。運営の公開・却下は、送られた中身を控える（seen.mod）。
   ふだんは下の STUB のまま ＝ 鍵の1行。差し替えるのは「開いた時の画面」を見る1場面だけ。 */
const STAY_RE = /\/rest\/v1\/rpc\/pv_stays$/, STAY_MOD_RE = /\/rest\/v1\/rpc\/pv_stay_moderate$/, STAY_ADD_RE = /\/rest\/v1\/rpc\/pv_stay_add$/,
  STAY_VREQ_RE = /\/rest\/v1\/rpc\/pv_stay_viewer_request$/,
  STAY_UPD_RE = /\/rest\/v1\/rpc\/pv_stay_update$/, STAY_DEL_RE = /\/rest\/v1\/rpc\/pv_stay_delete$/, STAY_CLAIM_RE = /\/rest\/v1\/rpc\/pv_stay_claim$/;
/* 待遇の集計（pv_contrib_facts）。ふだんは未ログインへの返事（状態の1語）。'rows' の時だけ、鍵の無い会員への返事
   ＝ 状態は 'locked'。わざと下の行を付けて返す（サーバーが間違えて送ってきても、画面が1行も出さないことを見る）。
   'give'（自分の会社への回答が足りない人）でも、同じ行を付けて返す。'giveOpen'（開いている人）は、開いた返事に同じ行。
   'work'・'work0'（開いている人。「勤務・訓練」のタブの場面）は、開いた返事に FACT_ROWS と子だけに行がある1行／行なし
   （補足の口は、どちらも未ログインへの1語のまま）。
   ★これは絵の検査。立場ごとに何が返るか・「最多」の決め方（lead）が正しいかは、本物の SQL を通す側
     （db/test-contrib.mjs・assert-contrib.mjs）が見る。
   ⚠️ 検査のために作った行で、本物の集計ではない（人数も答えも、この検査のファイルの中にしか無い）。
   FACT_ROWS の9行は、勤務・訓練の面（通勤・Staff Travel・昇格・訓練）と「集まった回答」に出る質問・BEN_ROWS の3行は待遇の板だけが持ちうる質問。
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
const factBody = mode => (mode === 'work' || mode === 'work2' || mode === 'work0'
  /* 〔検査用の見本〕開いている人（自分の会社の人・5つ答えた人）への返事。子だけに行がある質問（reserve_days）を1つ混ぜる */
  ? JSON.stringify({ ok: true, state: 'open', facts: mode === 'work0' ? [] : [...FACT_ROWS, { question_id: 'reserve_days', kind: 'num', n: 4, lead: null, median_num: 6, ym: '2026-09' }].map(wire) })
  : mode === 'rows'
  ? JSON.stringify({ ok: true, state: 'locked', facts: SENT.map(wire) })   // 鍵の無い会員。行が付いてきても、画面は1行も出さない
  : mode === 'give' ? JSON.stringify({ ok: true, state: 'give', facts: SENT.map(wire) })      // 自分の会社への回答が足りない人。行が付いてきても、画面は1行も出さない
  : mode === 'giveOpen' ? JSON.stringify({ ok: true, state: 'open', facts: SENT.map(wire) })  // 開いている人。欄が聞いた質問の行だけを出す
  : JSON.stringify({ ok: true, state: 'login' }));                         // 未ログイン
/* 街の一覧の口は、集計の口と同じ語で答える（本物は、どちらも pv_contrib_sees の1語）。開いている場面では、街は0件。 */
const townBody = mode => { const w = JSON.parse(factBody(mode)).state; return w === 'open' ? '{"ok":true,"state":"open","towns":[]}' : stateBody(w); };
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
   ── カードが聞くのは読む人自身の会社で、開いているページの会社ではない。'giveOpen' の場面では 'open' の1語
   （要る数まで答えた人に、カードの中身は返らない）。ほかの場面では、未ログインへの返事（状態の1語）。
   over ＝ その場面だけ差し替える欄（要る数を変える、など）。1回の返事ごと差し替える時は、場面が seen.give に { status, body } を置く。
   ⚠️ 検査のために作った中身で、本物の回答の数ではない（答えた数 3・要る数 5 は、この検査のファイルの中にしか無い）。 */
const GIVE_RE = /\/rest\/v1\/rpc\/pv_contrib_give$/;
const GIVE_ASK = ['reserve_duty', 'sick_leave'];
const giveOf = slug => (slug === 'ana' ? { airline: 'jal', name: 'JAL' } : { airline: 'ana', name: 'ANA' });
const giveBody = (mode, slug, over) => (mode === 'give'
  ? JSON.stringify({ ok: true, state: 'give', ...giveOf(slug), have: 3, need: 5, ask: GIVE_ASK, ...(over || {}) })
  : mode === 'giveOpen' ? stateBody('open') : stateBody('login'));
/* 月の勤務の集計の口（WORK_RE）。場面ごとの返事は workBody の1か所が決める：'work' ＝ 開いている人に、検査用の幅（WORK_FIX）・
   'work2' ＝ 同じ人に、機長の勤務・拘束時間だけ別の幅（WORK_FIX2）・
   'work0' ＝ 開いている人に、どの項目も数字なし（NO_WORK）・'rows' ＝ 鍵の無い会員への1語・ほかの場面 ＝ 未ログインへの1語。
   'give'・'giveOpen' の場面では、ここは呼ばれない（下の handler の、横の2つの口の分かれ道が先に答える）。 */
const WORK_RE = /\/rest\/v1\/rpc\/pv_work_view$/;
/* 〔検査用の見本。実データではない〕月の勤務の集計。軸を超える幅・両端が同じ・0・片側だけ・どちらも無い を1つずつ入れてある */
const WORK_FIX = { cap: { block_hours: { lo: 65, hi: 80 }, duty_hours: { lo: 200, hi: 300 }, work_days: { lo: 18, hi: 18 }, duty_days: { lo: 12, hi: 15 }, days_off: { lo: 9, hi: 11 }, stay_nights: { lo: 0, hi: 0 } },
                   fo:  { block_hours: { lo: 70, hi: 85 }, duty_hours: { lo: 250, hi: 300 }, work_days: null, duty_days: { lo: 13, hi: 16 }, days_off: null, stay_nights: { lo: 4, hi: 8 } } };
const NO_WORK = Object.fromEntries(['cap', 'fo'].map(p => [p, Object.fromEntries(Object.keys(WORK_FIX.cap).map(k => [k, null]))]));
/* 〔検査用の見本。実データではない〕2回めの読み込み用：機長の勤務・拘束時間だけ別の幅。WORK_FIX は書き換えない
   （ページは横に並べて開く ＝ JOBS。1つの見本を書き換えて戻すと、隣のページの1回めの返事に紛れ込む） */
const WORK_FIX2 = { ...WORK_FIX, cap: { ...WORK_FIX.cap, duty_hours: { lo: 100, hi: 120 } } };
const workBody = mode => (mode === 'work' ? JSON.stringify({ ok: true, state: 'open', months: 12, by: WORK_FIX })
  : mode === 'work2' ? JSON.stringify({ ok: true, state: 'open', months: 12, by: WORK_FIX2 })
  : mode === 'work0' ? JSON.stringify({ ok: true, state: 'open', months: 12, by: NO_WORK })
  : mode === 'rows' ? '{"ok":true,"state":"locked"}' : '{"ok":true,"state":"login"}');
/* 会員が挙げた街の一覧の口（db/towns.sql の pv_town_board）。返事は場面ごと（townBody・seen.town）。 */
const TOWN_RE = /\/rest\/v1\/rpc\/pv_town_board$/;
const STUB = [
  [/\/rest\/v1\/rpc\/pv_reviews$/, '{"unlocked":false,"rows":[]}'],
  [PAY_RE, '{"ok":true,"state":"locked","rows":[]}'],
  [FACT_RE, ''],
  [GIVE_RE, ''],
  /* 月の勤務の集計と会員の補足：未ログインに本物のサーバーが返すのは、状態の1語だけ（db/work-months.sql・db/contrib.sql）。 */
  [WORK_RE, '{"ok":true,"state":"login"}'],
  [/\/rest\/v1\/rpc\/pv_contrib_notes$/, '{"ok":true,"state":"login"}'],
  /* ホテル：見てよい人でない人に本物のサーバーが返すのは、状態の1語だけ（db/stays.sql。自分が送った行の無い人には）。都市を選んだ時にだけ呼ぶ。 */
  [/\/rest\/v1\/rpc\/pv_stays$/, '{"ok":true,"state":"locked"}'],
  /* 会員が挙げた街：本物のサーバーが返すのは、集計の口と同じ状態の1語（db/towns.sql の pv_town_board）。語は場面ごと（townBody）。 */
  [TOWN_RE, ''],
  [/\/rest\/v1\/rpc\/my_town_posts$/, '{"ok":true,"posts":[]}'],
  [/\/rest\/v1\/rpc\/pv_town_options$/, '{"ok":true,"towns":[]}'],
];
/* 集計の口と同じ1語を返す、横の2つの口（月の勤務・会員の補足）。上の表の、未ログインへの1語を返す行から拾う（名前をもう一度書かない）。 */
const SIDE = STUB.filter(([, body]) => body === stateBody('login')).map(([re]) => re);
if (SIDE.length !== 2) throw new Error('検査の前提が崩れた（月の勤務と補足の口を、上の表から2つ拾えない）');
/* 'give'／'giveOpen' の場面で、横の2つの口が返すもの。i ＝ SIDE の並び（0 ＝ 月の勤務・1 ＝ 会員の補足）。
     'give'     … 状態の語 'give' に、わざと中身を付けて返す：月の勤務は、機長・副操縦士の6項目ぜんぶに幅（MONTH_LEAK）・
                  補足は、月の勤務の分と、台帳の質問ぜんぶの分（どの欄が持つ質問にも当たる）に、同じ文（NOTE_LEAK）。
                  本物のサーバーが返すのは状態の1語だけ。間違えて中身を送ってきても、画面が1文字も出さないことを見る。
     'giveOpen' … 開いている人への返事：月の勤務は、どの項目も数字なし（3人そろっていない時に本物が返す形）・補足は0件。
   ⚠️ 検査のために作った中身で、本物の集計でも、本物の補足でもない（幅も文も、この検査のファイルの中にしか無い）。
   6項目の鍵は、月の勤務の口（db/work-months.sql）が、開いている人に返す鍵。 */
if (!/work/.test(SIDE[0].source) || !/notes/.test(SIDE[1].source)) throw new Error('検査の前提が崩れた（上の表の並びが、月の勤務 → 補足 でない）');
const NOTE_LEAK = '検査用の補足です。開いていない人の画面に出てはいけません';
const MONTH_KEYS = ['block_hours', 'duty_hours', 'work_days', 'duty_days', 'days_off', 'stay_nights'];
const MONTH_LEAK = { lo: 61.3, hi: 83.7 };
const sideBody = (mode, i, slug) => {
  const leak = mode === 'give', state = leak ? 'give' : 'open';
  const pos = () => Object.fromEntries(MONTH_KEYS.map(k => [k, leak ? { ...MONTH_LEAK } : null]));
  if (i === 0) return JSON.stringify({ ok: true, state, airline: slug, months: 12, by: { cap: pos(), fo: pos() } });
  const notes = leak ? [{ topic: 'work', q: null, text: NOTE_LEAK, mine: false }, ...QUESTIONS.map(q => ({ topic: q.section, q: q.id, text: NOTE_LEAK, mine: false }))] : [];
  return JSON.stringify({ ok: true, state, notes });
};
/* 'give' の返事に付けた中身から作る「出てはいけない字」：ページの字にも、欄の字にも無いこと。 */
const GIVE_LEAK = [...LEAK_PAGE, NOTE_LEAK, String(MONTH_LEAK.lo), String(MONTH_LEAK.hi)];
/* 未ログインの画面で、欄が落ち着く先。月の勤務と回答の集計は鍵（ログインと給与の提出で開く）・補足は欄ごと出さない・ほかは「まだありません」。
   黙る集計の欄（data-quiet="1"）は、鍵のまま見えないのが落ち着いた形（鍵の文は同じ板の月の勤務の欄が1回だけ言う）。 */
const CALM = x => (x.kind === 'towns' ? x.on && x.state === 'locked' : x.kind === 'work' ? x.on && x.state === 'locked' : x.kind === 'fact' ? x.state === 'locked' && (x.quiet ? !x.on : x.on) : x.kind === 'notes' ? !x.on && x.state === 'empty' : x.on && x.state === 'empty');
/* ── 開いていない人に出る1行と入口 ──
   下の字は、画面に出るはずの字を検査が自分で持つもの（career-live.js から読み込まない ＝ あちらを変えたら、ここで赤くなる）。 */
const LOGIN_LINE = 'ログインと給与の提出で開きます', LOGIN_GO = 'ログイン';
/* いま見えている実データの欄（.crl）を、欄ごとに読む。ページの中で動く（外の変数を1つも使わない）。判定は外でする。
   見えている ＝ SETTLED と同じ決め方（箱を持っている）。at ＝ 欄の居場所（板の名前。「集まった回答」は got）。
   sf ＝ 欄が入っている面の名前（ページに書いてある字。「勤務・訓練」の板の欄だけ。落ちた時の文に、どの面の欄かを書くためだけに使う）。
   cards ＝ 欄の中の、見えている答えるカードの数・retry ＝ 見えている「やり直す」の数。 */
function slotsSee() {
  const vis = e => !!e && e.getClientRects().length > 0, tx = e => (e ? e.textContent : '').replace(/\s+/g, '');
  return [...document.querySelectorAll('.crl[data-live]')].filter(vis).map(e => ({
    live: e.getAttribute('data-live'), state: e.getAttribute('data-state'), entry: e.getAttribute('data-entry'),
    keys: (e.getAttribute('data-keys') || '').split(',').filter(Boolean).length,
    at: e.closest('.pvg-got') ? 'got' : (e.closest('.pvg-panel') || {}).id || '',
    sf: (t => (t ? t.textContent.trim() : ''))(e.closest('.pvg-sf') && e.closest('.pvg-sf').querySelector('.pvg-sf-t')),
    text: tx(e), lock: [...e.querySelectorAll('.crl-lock')].map(tx), rows: e.querySelectorAll('.crl-fact').length,
    cards: [...e.querySelectorAll('.crl-give')].filter(vis).length, retry: [...e.querySelectorAll('.crl-retry')].filter(vis).length,
    links: [...e.querySelectorAll('a')].map(a => ({ text: tx(a), href: a.getAttribute('href') || '', cta: a.classList.contains('crl-cta'), login: a.hasAttribute('data-crl-login'), on: vis(a) })),
  }));
}
/* 黙る集計の欄（data-quiet="1"：勤務予定・休日と昇格・訓練の面）を、見えているかどうかに関わらず全部読む。ページの中で動く。判定は外でする。
   開いていない人には、鍵の形・見えない・字が1つも無い（鍵の1行は、同じ板の月の勤務の欄が1回だけ言う）。 */
function quietSee() {
  return [...document.querySelectorAll('.crl[data-live="fact"][data-quiet="1"]')].map(e => ({
    at: (e.closest('.pvg-panel') || {}).id || '', state: e.getAttribute('data-state'), on: e.getClientRects().length > 0, text: (e.textContent || '').replace(/\s+/g, ''),
  }));
}
/* 黙る集計の欄が、約束のとおりか（「勤務・訓練」の板に2つ・どちらも鍵の形・見えない・字が無い）。返すのは、破れている所の文。 */
const quietBad = q => [
  ...(q.length !== 2 || q.some(x => x.at !== 'pvg-p-work') ? [`黙る集計の欄が ${q.length}つ（${q.map(x => x.at).join('・')}）── あるべきは「勤務・訓練」の板に2つ`] : []),
  ...q.filter(x => x.state !== 'locked' || x.on || x.text).map(x => `黙る集計の欄が ${x.state}・${x.on ? '見えている' : '見えない'}・字「${x.text.slice(0, 40)}」（あるべき 鍵の形・見えない・字なし）`),
];
/* 欄の印（data-entry）が「入口は自分では出さない」（"0"）か「答えるカードだけ」（"give"）＝ ログインも給与の提出の入口も、この欄には出ない。 */
const STAMPED = x => x.entry === '0' || x.entry === 'give';
/* 落ちた時の文に書く、欄の名前。「勤務・訓練」の板の集計の欄は、面の名前で呼ぶ（板に4つ在る）。暮らし・家族の板には、もう集計の欄が無い。 */
const SLOT_AT = { got: '集まった回答', 'pvg-p-work': '勤務・訓練', 'pvg-p-benefits': '待遇' };
const slotName = x => (x.live === 'work' ? '月の勤務' : `${x.sf || SLOT_AT[x.at] || x.at || '?'}の集計`);
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
  /* 鍵の無い会員には、印 "login" の欄（通勤・Staff Travel）も入口を自分では出さない（給与の提出の入口は、同じ板の月の勤務の欄に1つ）。
     未ログインの人には、その欄が自分の「ログイン」を出す ＝ ここでは判定しない（STAMPED は広げない：M1 の判定と共有している）。 */
  if (!entry) for (const x of slots.filter(x => (STAMPED(x) || (who === 'locked' && x.entry === 'login')) && x.lock.length)) out.b.push(`${slotName(x)}（印 ${x.entry}）が鍵の1行を出しているのに、同じタブの見えている欄に、${who === 'login' ? 'ログイン' : '給与の提出'}へのリンクが無い`);
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
const SUM_LOGIN = JSON.stringify({ ok: true, state: 'login', n: 3, as_of: '2026-09-30', good: [{ text: SUM_LEAK, cat: 'culture', ids: [] }], concern: [] });   // わざと中身を付けた返事（画面は読まないはず）
const SUM_FEW = '{"ok":true,"state":"few"}';
const SUM_NONE = '{"ok":true,"state":"none"}';
const SUM_500 = '{"code":"XX000","details":null,"hint":null,"message":"検査用の失敗"}';
const SUM_SRC = [1, 2, 3].map(i => `00000000-0000-4000-8000-00000000000${i}`);      // ratedRows の id と同じ3つ
const SUM_G = '検査用の良い点という声が複数ある';
const SUM_C = '検査用の気になる点という声が複数ある';
const SUM_OPEN = JSON.stringify({ ok: true, state: 'open', n: 3, as_of: '2026-09-30',
  good: [{ text: SUM_G, cat: 'culture', ids: SUM_SRC.slice(0, 2) }],
  concern: [{ text: SUM_C, cat: 'wlb', ids: SUM_SRC.slice(1, 3) }] });
const SUM_LONG = c => ('検査用の長い点' + c).padEnd(90, 'あ');                          // 日本語の上限いっぱい（90字）
const SUM_OPEN_MAX = JSON.stringify({ ok: true, state: 'open', n: 3, as_of: '2026-09-30',
  good: ['ア', 'イ', 'ウ'].map(c => ({ text: SUM_LONG('良' + c), cat: 'culture', ids: SUM_SRC.slice(0, 2) })),
  concern: ['ア', 'イ', 'ウ'].map(c => ({ text: SUM_LONG('気' + c), cat: 'wlb', ids: SUM_SRC.slice(1, 3) })) });
const SUM_LOGIN_TEXT = 'ログインが必要です';
const SUM_FEW_TEXT = '口コミがまだ少ないため、要約はありません';
const SUM_NONE_TEXT = '口コミの要約は、まだありません';
const SUM_OFF_TEXT = '準備中';
const SUM_BY_MODE = { rated: SUM_LOCKED, ratedLogin: SUM_LOGIN, ratedFew: SUM_FEW, ratedNone: SUM_NONE, ratedOpen: SUM_OPEN, ratedOpenMax: SUM_OPEN_MAX };
/* 鍵を持つ人に pv_reviews() が返す形（本文の6列が付く）。3件とも社風と勤務に本文が在り、字は1件ずつ違う
   ＝ 「要約のもと」の札が付いたカードを、本文の字で見分けられる（id は画面に出ない）。 */
const SUM_BODY = ['あ', 'い', 'う'];
const ratedOpenBody = slug => JSON.stringify({ unlocked: true, rows: ratedRows(slug).map((r, i) => ({ ...r, translations: {},
  culture_comment: `検査用の本文・社風・${SUM_BODY[i]}`, wlb_comment: `検査用の本文・勤務・${SUM_BODY[i]}`,
  salary_comment: '', benefits_comment: '', ops_comment: '', training_comment: '' })) });
const revBodyOf = (mode, slug) => /^ratedOpen/.test(mode) ? ratedOpenBody(slug) : ratedBody(slug);
/* 要約の欄の形の移り変わりを、ページが始まる前から控える（data-state と、その時の高さ）。要約の場面が pre として渡すための部品。 */
const SUM_WATCH = () => { window.__sumSeq = []; new MutationObserver(ms => ms.forEach(m => { const t = m.target; if (t.getAttribute && t.getAttribute('data-live') === 'summary') window.__sumSeq.push([t.getAttribute('data-state'), Math.round(t.getBoundingClientRect().height)]); })).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state'] }); };
const trouble = [];
/* 実データの欄が落ち着く（見えている欄が「まだ」「読み込み中」でなくなる）まで待つ。時間では待たない。 */
const SETTLED = () => !!window.PVCurrency && !!document.querySelector('.pvg') &&
  ![...document.querySelectorAll('.pvg .crl, .pvg-hero .crl')].some(n => n.getClientRects().length && /^(idle|loading)$/.test(n.dataset.state));

async function open(browser, slug, w, h, mode, pre) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  const seen = { mode, asked: 0, unknown: new Set(), stay: null, stays: 0, stayAsked: 0, mod: [], modReply: '{"ok":true}', factCalls: [], stayStatus: 200, stayStall: false, add: null, added: [], vreq: null, vreqd: [], edit: null, edited: [], del: null, deleted: [], claim: '{"ok":true}', claimed: [], town: null };
  /* 答えるカードの口：give ＝ その場面だけ差し替える返事（{ status, body }。置かなければ giveBody）・giveCalls ＝ 呼ばれた回数。
     nav ＝ 並びを置いた場面でだけ、ページが移ろうとした行き先を控えて止める（カードのリンクが進む先を見る時）。 */
  seen.give = null; seen.giveCalls = 0; seen.nav = null;
  /* 横の2つの口（月の勤務・会員の補足）が呼ばれた回数。並びは SIDE のとおり。 */
  seen.sideCalls = [0, 0];
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
        return SUM_BY_MODE[seen.mode] ? r.respond({ status: 200, contentType: 'application/json', headers: cors, body: SUM_BY_MODE[seen.mode] })
          : seen.mode === 'ratedErr' ? r.respond({ status: 500, contentType: 'application/json', headers: cors, body: SUM_500 })
          : r.respond({ status: 404, contentType: 'application/json', headers: cors, body: SUM_404 });
      }
      if (STAY_RE.test(u.pathname)) seen.stays++;
      /* 返事をしない（届かないままの読み出し）。待つのをやめるのはページの側（career-stay.js の STAY_WAIT）。 */
      if (seen.stayStall && STAY_RE.test(u.pathname)) return;
      if (seen.stay && STAY_RE.test(u.pathname)) { seen.stayAsked++; return r.respond({ status: seen.stayStatus, contentType: 'application/json', headers: cors, body: seen.stay }); }
      if (seen.stay && STAY_MOD_RE.test(u.pathname)) {
        let sent = null; try { sent = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null のまま控える */ }
        seen.mod.push(sent);
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.modReply });
      }
      /* 足す口（pv_stay_add）：場面が返事を置いた時だけ答え、送られた中身を控える（seen.add・seen.added）。 */
      if (seen.stay && seen.add && STAY_ADD_RE.test(u.pathname)) {
        let sent = null; try { sent = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null のまま控える */ }
        seen.added.push(sent);
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.add });
      }
      /* 直す口・消す口（pv_stay_update・pv_stay_delete）：場面が返事を置いた時だけ答え、送られた中身を控える（seen.edited・seen.deleted）。 */
      if (seen.stay && ((seen.edit && STAY_UPD_RE.test(u.pathname)) || (seen.del && STAY_DEL_RE.test(u.pathname)))) {
        let sent = null; try { sent = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null のまま控える */ }
        const del = STAY_DEL_RE.test(u.pathname);
        (del ? seen.deleted : seen.edited).push(sent);
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: del ? seen.del : seen.edit });
      }
      /* 引き取りの口（pv_stay_claim）：ふだんは {"ok":true}。場面が { status, body } を置くと、その形で答える。送られた中身を控える（seen.claimed）。 */
      if (seen.stay && seen.claim && STAY_CLAIM_RE.test(u.pathname)) {
        let sent = null; try { sent = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null のまま控える */ }
        seen.claimed.push(sent);
        const c = typeof seen.claim === 'string' ? { status: 200, body: seen.claim } : seen.claim;
        return r.respond({ status: c.status, contentType: 'application/json', headers: cors, body: c.body });
      }
      /* 見てよい人の申し込みの口（pv_stay_viewer_request）：★画面はもう呼ばない（2026-10-16 オーナー：「確認を申し込むはいらない」）。
         呼ばれたら、どの場面でも中身を控える（seen.vreqd。場面 stay の終わりと 3b-member が 0 本を見る）。
         答えるのは、場面がわざと返事を置いた時だけ（seen.vreq ＝ 呼んでしまう版なら申し込みの面が出る返事）。置かなければ、知らない口として 500。 */
      if (STAY_VREQ_RE.test(u.pathname)) {
        seen.vreqd.push(r.postData() || '');
        if (seen.vreq) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.vreq });
      }
      /* 集計の口がまだ無い時（本物のサーバーは 404 を返す）。 */
      if (seen.mode === 'facts404' && FACT_RE.test(u.pathname)) {
        return r.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"code":"PGRST202","message":"stub"}' });
      }
      /* 'give'・'giveOpen' の場面：月の勤務と会員の補足の口も、集計の口と同じ状態の語で答える（本物のサーバーは、3つの口で同じ語を返す）。
         中身は sideBody（'give' では、わざと中身を付ける）。呼ばれた回数は、どの場面でも数える。 */
      const side = SIDE.findIndex(re => re.test(u.pathname));
      if (side >= 0) seen.sideCalls[side]++;
      if (/^give/.test(seen.mode) && side >= 0) {
        return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: sideBody(seen.mode, side, slug) });
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
        /* 自分の街の投稿の口（my_town_posts）：場面 towns が返事を置いた時だけ、その返事（seen.town.mine）。置かなければ上の表のまま（0件）。 */
        if (seen.town && seen.town.mine != null && /\/rest\/v1\/rpc\/my_town_posts$/.test(u.pathname)) {
          return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: seen.town.mine });
        }
        if (hit[0] === TOWN_RE) {
          const t = seen.town || {};
          return r.respond({ status: t.status || 200, contentType: 'application/json', headers: cors, body: t.body != null ? t.body : townBody(seen.mode) });
        }
        if (hit[0] === WORK_RE) {
          return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: workBody(seen.mode) });
        }
        const body = seen.mode === 'rows' && hit[0] === PAY_RE ? maskedBody(slug)
                   : /^rated/.test(seen.mode) && REV_RE.test(u.pathname) ? revBodyOf(seen.mode, slug) : hit[1];
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
          state: e.dataset.state, h: e.getBoundingClientRect().height, text: e.textContent.replace(/\s+/g, ' ').trim(), items: $$('.crl-sum-li, .crl-sum-h, .crl-sum-title', e).length,
          why: (e.firstElementChild && e.firstElementChild.getAttribute('data-why')) || null,
          links: $$('a, button', e).filter(on).length,
          login: $$('a', e).filter(on).map(a => a.getAttribute('href')),
          ai: $$('.crl-sum-ai', e).filter(on).length,
          pts: ['good', 'concern'].map(k => $$('.crl-sum-col[data-kind="' + k + '"] .crl-sum-li', e).length),
          by: (() => { const x = e.querySelector('.crl-sum-by'); return x ? x.textContent : null; })(),
          box: (() => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; })(),
          arrows: $$('a.crl-sum-a', e).map(a => { const b = a.getBoundingClientRect(); return { href: a.getAttribute('href'), cat: a.getAttribute('data-pvg-cat'), ids: a.getAttribute('data-pvg-ids'), label: a.getAttribute('aria-label'), w: b.width, h: b.height }; }),
          seq: (window.__sumSeq || []).slice() }; })(),
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
        scoreBox: (() => { const e = c.querySelector('.crl[data-live="score"]'); const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height }; })(),
        give: $$('.crl[data-live="reviews"] a', c).filter(on).length,
        logins: $$('[data-crl-login]', c).filter(on).length,
        y: c.getBoundingClientRect().top + scrollY, next: (() => { const n = c.nextElementSibling; return n ? n.getBoundingClientRect().top + scrollY : null; })(),
        /* 給与の1枚と同じ段の、すぐ次に在る */
        row: c.parentElement.classList.contains('pvg-payrow') && !!c.previousElementSibling && c.previousElementSibling.classList.contains('pvg-pay'),
      },
    };
  };
  G.live = () => $$('.pvg .crl, .pvg-hero .crl').map(e => ({
    kind: e.dataset.live, state: e.dataset.state, air: e.dataset.airline, on: on(e), hero: !!e.closest('.pvg-hero'),
    panel: (e.closest('.pvg-panel') || {}).id || '', text: e.textContent.replace(/\s+/g, ' ').trim(), retry: !!e.querySelector('.crl-retry'),
    quiet: e.dataset.quiet === '1', sf: e.dataset.sf || '',
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
/* 口コミの要約の欄のあるべき形（名前で引く）。hidden ＝ 0件のページ（上の評価が「まだありません」）では畳む／
   off ＝ 口が無い（未接続）／few ＝ 口コミが少ない／none ＝ 要約がまだ無い／login ＝ ログインの1行と入口1つ／locked ＝ 鍵の無い人の1行／
   error ＝ 読めなかった（「やり直す」1つ）。どの形も要約の項目を持たず、入口は login と error の1つだけ。 */
const SUM_WANT = {
  hidden: x => x.h === 0 && !x.items && x.links === 0,
  off:    x => x.state === 'empty'  && x.why === 'off'   && x.text === SUM_OFF_TEXT  && !x.items && x.links === 0,
  few:    x => x.state === 'empty'  && x.why === 'few'   && x.text === SUM_FEW_TEXT  && !x.items && x.links === 0,
  none:   x => x.state === 'empty'  && x.why === 'none'  && x.text === SUM_NONE_TEXT && !x.items && x.links === 0,
  login:  x => x.state === 'locked' && x.why === 'login' && x.text.startsWith(SUM_LOGIN_TEXT) && !x.items && x.links === 1 && x.login.length === 1 && /login\.html/.test(x.login[0]),
  locked: x => x.state === 'locked' && x.why === 'key'   && x.text === SUM_LOCK_TEXT && !x.items && x.links === 0,
  error:  x => x.state === 'error'  && !x.items && x.links === 1,
};
/* 評価スコア：社名の行とカードが同じ答えを出しているか。rows ＝ 偽のサーバーが返した口コミ（0件なら []）。
   sum ＝ 口コミの要約の欄のあるべき形の名前（SUM_WANT の hidden | off | few | none | login | locked | error）。 */
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
  else if (!SUM_WANT[sum](c.sum)) bad.push(`要約の欄が「${sum}」の形でない（${c.sum.state}・${c.sum.why}・高さ ${Math.round(c.sum.h)}・「${c.sum.text.slice(0, 40)}」・項目 ${c.sum.items}・入口 ${c.sum.links}）`);
  if (c.sum && sum !== 'hidden' && sum !== 'error' && !(c.sum.h >= 40)) bad.push(`要約の1行が低い（${c.sum.h}px）`);
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
      const bad = scoreBad(s, sc, live.filter(IS_SCORE), [], 'hidden');
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
        /* 暮らしの板の実データの欄は、会員が挙げた街の1つだけ（通勤の回答は、勤務・訓練の通勤の面に1つだけ）＝ その1つが鍵の形で見えているのが、落ち着いた形。 */
        const town = c.id === 'pvg-p-living';
        if (!calm || (town ? !(lv.length === 1 && lv[0].kind === 'towns' && CALM(lv[0]) && !NO_NUM.test(lv[0].text)) : !lv.length || !lv.every(x => CALM(x) && !NO_NUM.test(x.text)))) bad.push(`${c.id}: 開いた板の欄が落ち着かない ── 集計と月の勤務は鍵・補足は出さない（${lv.map(x => `${x.kind}:${x.state}:${x.on ? '見える' : '隠れる'}`)}）`);
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
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
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
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
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
       GUARD 「勤務・訓練」のタブで、月の勤務の欄が鍵の1行と入口「匿名で給与を提出する」の1つを出し、
             通勤・Staff Travel の集計の欄（印 "login"）が鍵の1行だけを出し（入口なし）、黙る2つの集計の欄は鍵の形・見えない・字なし
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
          const m = slots.filter(x => x.live === 'work'), f = slots.filter(x => x.live === 'fact'), lg = f.filter(x => x.entry === 'login');
          const mOn = m.length === 1 ? m[0].links.filter(a => a.on) : [];
          if (m.length !== 1 || !same(m[0].lock, [PAY_LINE]) || mOn.length !== 1 || mOn[0].text !== PAY_GO) guard.push(`月の勤務の欄 ${m.length}つ・1行「${m.length ? m[0].lock.join('｜') : ''}」・入口 ${mOn.map(a => a.text).join('｜') || '無し'}（あるべき 1つ・「${PAY_LINE}」・「${PAY_GO}」の1つ）`);
          if (f.length !== 2 || lg.length !== 2 || lg.some(x => !same(x.lock, [PAY_LINE]) || x.links.length)) guard.push(`見えている集計の欄 ${f.length}つ（印 "login" ${lg.length}つ）・${lg.map(x => `「${x.lock.join('｜')}」リンク ${x.links.length}つ`).join('・')}（あるべき 通勤・Staff Travel の2つ・「${PAY_LINE}」だけ・リンクなし）`);
          for (const b of quietBad(await ev(quietSee))) guard.push(b);
        }
      }
      for (const k of Object.keys(R)) ok(!R[k].length, `${tag}: ${M5_LABEL[k]}`, [...new Set(R[k])].slice(0, 6).join(' ／ '));
      ok(!guard.length, `${tag}: 「勤務・訓練」のタブで、月の勤務の欄（鍵の1行＋「${PAY_GO}」）・通勤と Staff Travel の集計の欄（鍵の1行だけ）・黙る2つの集計の欄（鍵の形・見えない・字なし）を見ている（上の約束が、空のタブで緑になっていない）`, guard.join(' ／ '));
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
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
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
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
    if (process.env.PV_GLANCE_SHOT) await p.screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/rated-${s}-${w}.png`, clip: { x: 0, y: 0, width: w, height: w < 700 ? 2000 : 1500 } });
    if (process.env.PV_GLANCE_SHOT && w === 390) await sumShot(p, [w, h], `sum-key-${s}-${w}-overview`);
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
    /* ruling H3（A3）と Z11 b：鍵の無い会員。概要と口コミのタブの両方で、要約の欄は「鍵」の1行だけ（欄の中にリンクが無い）・
       カードの中で見えている錠前の1行はその1つ・ログインの入口は無い・口コミのタブでは、書く入口がそのタブの2行のボタン1つ（見えている・44px 以上）。
       ページのソース（属性の中・隠した所も）と手元の保存に、サーバーが混ぜた要約の文も元の口コミの番号も無い（字として出ないだけでは足りない）。 */
    {
      const leak = (await sumLeakOf(p)).map(b => `概要：${b}`), bad = [];
      if (sc.card && sc.card.logins !== 0) bad.push(`概要：カードの中にログインの入口が ${sc.card.logins}つ（あるべき 0）`);
      await ev(sel => document.querySelector(sel).click(), '.pvg-tabs [data-pvg-tab="reviews"]');
      const there = (await until(t => window.PVGlance.at() === t, 'reviews')) && (await until(SETTLED));
      const sc2 = there ? await ev(() => window.__pvg.score()) : null, c2 = sc2 && sc2.card;
      if (!there) bad.push('口コミのタブへ切り替わらない・欄が落ち着かない');
      else if (!c2) bad.push('口コミのタブで、評価・口コミのカードが見えていない');
      else {
        if (!c2.sum || !SUM_WANT.locked(c2.sum)) bad.push(`口コミのタブ：要約の欄が「locked」の形でない（${c2.sum ? `${c2.sum.state}・${c2.sum.why}・「${c2.sum.text.slice(0, 40)}」・項目 ${c2.sum.items}・入口 ${c2.sum.links}` : '欄が無い'}）`);
        if (!c2.revs || !same(c2.revs.locks, [SUM_LOCK_TEXT])) bad.push(`口コミのタブ：見えている錠前の行が ${c2.revs ? `${c2.revs.locks.length}つ（${c2.revs.locks.join('｜')}）` : '読めない'}（あるべき「${SUM_LOCK_TEXT}」の1つ）`);
        if (c2.logins !== 0) bad.push(`口コミのタブ：カードの中にログインの入口が ${c2.logins}つ（あるべき 0）`);
        const hs = await ev(() => [...document.querySelectorAll('#pvg-score a[href*="submit-review"]')].filter(a => a.getClientRects().length && a.checkVisibility({ visibilityProperty: true })).map(a => Math.round(a.getBoundingClientRect().height)));
        if (!same(c2.write, [{ k: 'Give & Get', m: RV_GIVE.reviews, stacked: true, href: `../submit-review.html?airline=${s}` }]) || !(hs.length === 1 && hs[0] >= 44)) {
          bad.push(`口コミのタブ：書く入口が、2行のボタン「Give & Get／${RV_GIVE.reviews}」1つ（44px 以上）でない：${c2.write.map(a => `${a.k || ''}／${a.m}${a.stacked ? '' : '（2行でない）'} → ${a.href}`).join(' ‖ ') || '見えていない'}（高さ ${hs.join('・') || '—'}）`);
        }
        for (const b of await sumLeakOf(p)) leak.push(`口コミのタブ：${b}`);
      }
      ok(!bad.length, `${tag}: 概要と口コミのタブの両方で、要約は「${SUM_LOCK_TEXT}」の1行だけ（リンク無し）・錠前の1行はその1つ・ログインの入口は無い・口コミのタブの書く入口は「${RV_GIVE.reviews}」の2行のボタン1つ`, bad.join(' ／ '));
      ok(!leak.length, `${tag}: 概要と口コミのタブの両方で、ページのソース（属性の中も）と手元の保存に、サーバーが混ぜた要約の文も元の口コミの番号も無い`, leak.join(' ／ '));
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
async function runRated404(browser, s, [w, h, kind]) {
  const tag = `${s} ${w}（評価が在る・要約の口が無い時）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'rated404');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const rows = ratedRows(s);
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    const sc = await ev(() => window.__pvg.score());
    const bad = scoreBad(s, sc, live.filter(IS_SCORE), rows, 'off');
    const r = sc.card && sc.card.revs;
    if (!r) bad.push('口コミの欄が無い');
    else {
      if (r.state !== 'locked') bad.push(`鍵の無い人なのに、欄が ${r.state}`);
      if (r.items !== 1) bad.push(`見えている口コミが ${r.items}件（あるべき 1件）`);
      if (r.full) bad.push(`伏せていない本文が ${r.full}つ出ている`);
      if (!same(r.locks, ['口コミの投稿で開きます'])) bad.push(`見えている錠前の行が ${r.locks.length}つ（${r.locks.join('｜')}）── あるべきは「口コミの投稿で開きます」の1つ`);
    }
    ok(!bad.length, `${tag}: 要約の欄は未接続の1行「${SUM_OFF_TEXT}」（件数も作った文も無い）・星と図は点数どおり・錠前の1行「口コミの投稿で開きます」が見えている`, bad.join(' ／ '));
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
    if (process.env.PV_GLANCE_SHOT && w === 390) await sumShot(p, [w, h], `sum-off-${s}-${w}-overview`);
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 要約の文（SUM_LEAK）と元の口コミの番号（SUM_SRC）が、ページのソース（属性の中・隠した所も）と手元の保存に無いか。
   返すのは見つかった所の文（空なら無い）。開いた要約（鍵を持つ人）の画面には使わない ── 矢印が番号を持つのは決めた形。 */
const sumLeakOf = p => p.evaluate((leak, ids) => {
  const src = document.documentElement.outerHTML, bad = [];
  if (src.includes(leak)) bad.push('ページのソースに、サーバーが混ぜた要約の文が在る');
  const hit = ids.filter(id => src.includes(id));
  if (hit.length) bad.push(`ページのソースに、元の口コミの番号が ${hit.length}つ在る`);
  for (const [n, st] of [['localStorage', () => localStorage], ['sessionStorage', () => sessionStorage]]) {
    try { const S = st(); for (let i = 0; i < S.length; i++) { const k = S.key(i); if (String(S.getItem(k)).includes(leak)) bad.push(`${n} の ${k} に、要約の文が在る`); } } catch (e) { /* 読めない保存には、何も置けていない */ }
  }
  return bad;
}, SUM_LEAK, SUM_SRC);
/* 要約の欄の見本の絵（PV_GLANCE_SHOT=<フォルダ> がある時だけ撮る・検査の合否には使わない。M1）。名前は sum-<形>-<会社>-<幅>-<タブ>[-dark].png。
   撮るのは評価・口コミのカード（#pvg-score）だけ。カードが画面より高い時は、画面の高さだけをカードが入るまで伸ばし、上の帯（ヘッダーとタブ）の
   下へカードを寄せてから撮る（そのままだと、上の帯がカードの頭に重なって写る）。撮ったあと、画面の大きさを元へ戻す（このあとの測りは元の大きさで）。
   dark ＝ 同じ形を暗い色でもう1枚（data-theme を替えて撮り、元の値へ戻す。色の決まりは data-theme で切り替わる）。 */
async function sumShot(p, [w, h], name, dark) {
  if (!process.env.PV_GLANCE_SHOT) return;
  const dir = process.env.PV_GLANCE_SHOT.replace(/\/$/, () => ''), SEL = '#pvg-score', view = hh => ({ width: w, height: hh, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
  const tall = await p.evaluate(sel => { const e = document.querySelector(sel); return e && e.getClientRects().length ? Math.ceil(e.getBoundingClientRect().height) : 0; }, SEL);
  if (!tall) return;
  const frame = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await p.setViewport(view(Math.max(h, tall + 260)));
  await p.evaluate(sel => new Promise(r => { scrollTo({ top: scrollY + document.querySelector(sel).getBoundingClientRect().top - 220, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }), SEL);
  const box = await p.$(SEL);
  await box.screenshot({ path: `${dir}/${name}.png` });
  if (dark) {
    const was = await p.evaluate(() => { const root = document.documentElement, was = root.getAttribute('data-theme');
      root.setAttribute('data-theme', 'dark');
      return was; });
    await frame();
    await box.screenshot({ path: `${dir}/${name}-dark.png` });
    await p.evaluate(was => { const root = document.documentElement; if (was === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', was); }, was);
  }
  await p.setViewport(view(h));
  await frame();
}
/* 要約の欄が通った形（SUM_WATCH が控えた [形, 高さ]）：「読み込み中」→ 最後の形 だけを通り、最後の形で終わる（ほかの形を先に見せない）。
   jump を見る時は、読み込み中に取っていた高さと、いまの高さの差が 2px まで（答えが来て下が動かない）。 */
const SUM_FINAL = { login: 'locked', locked: 'locked', few: 'empty', none: 'empty', error: 'error' };
function seqBad(sum, want, jump) {
  const q = (sum && sum.seq) || [], st = q.map(x => x[0]), fin = SUM_FINAL[want], i = st.indexOf(fin), bad = [];
  if (!(st.length >= 2 && st[0] === 'loading' && st[st.length - 1] === fin && i > 0 && st.slice(0, i).every(x => x === 'loading') && st.slice(i).every(x => x === fin))) {
    bad.push(`要約の欄が通った形が ${st.join(' → ') || '無し'}（あるべき loading → ${fin}）`);
  }
  if (jump) {
    const now = Math.round(sum.h), wait = q.filter(x => x[0] === 'loading').map(x => x[1]);
    if (!wait.length || wait.some(x => Math.abs(x - now) > 2)) bad.push(`答えが来て要約の欄の高さが動く（読み込み中 ${wait.join('・') || '—'}px → ${now}px）`);
  }
  return bad;
}
/* 要約の欄が1行で済む4つの形（WP 9）：未ログイン（ログインの1行と入口1つ）・口コミが少ない・要約がまだ無い・読めなかった（「やり直す」1つ）。
   偽のサーバーが、要約の口でその形の返事を返す（未ログインの返事には、わざと要約の文を付けてある ── 閉じた形は、届いた中身を描かない）。
   概要と口コミのタブの両方で：欄の形（SUM_WANT。同じ1つの箱）・ページのソースと手元の保存に要約の文も元の口コミの番号も無い・
   カードの中の錠前の1行とログインの入口は1つまで（未ログインは 錠前「ログインが必要です」1つ・ログイン1つ）・
   欄は「読み込み中」→ 最後の形 だけを通る。概要では、読み込み中の高さから動かない（読めなかった時は形だけ：やり直すの箱は1行より高い）・
   並び・最初の1画面・切れ・知っている口だけ。未ログインは、入口の字の大きさと押す場所・ログインの入口がこのページへ戻る
   （#reviews で開けば %23reviews まで ＝ facts-gate の backHash）。
   ⚠️ 絵の検査。誰にどの返事が返るかは、本物の SQL を通す側（db/test-review-summary.mjs）が見る。 */
const SUM_ONE = { ratedLogin: 'login', ratedFew: 'few', ratedNone: 'none', ratedErr: 'error' };
async function runRatedLogin(browser, s, v) { return runRatedOne(browser, s, v, 'ratedLogin'); }
async function runRatedFew(browser, s, v) { return runRatedOne(browser, s, v, 'ratedFew'); }
async function runRatedNone(browser, s, v) { return runRatedOne(browser, s, v, 'ratedNone'); }
async function runRatedErr(browser, s, v) { return runRatedOne(browser, s, v, 'ratedErr'); }
async function runRatedOne(browser, s, [w, h, kind], mode) {
  const want = SUM_ONE[mode], login = want === 'login', tag = `${s} ${w}（要約の欄 ${want}）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, mode, SUM_WATCH);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  const fresh = async addr => { await p.goto('about:blank'); await p.goto(addr, { waitUntil: 'load', timeout: 60000 }); await until(() => !!window.PVGlance); };
  /* 錠前の1行とログインの入口（カードの中で見えているもの）。未ログインは ちょうど 錠前1（要約の欄の1行）・ログイン1。ほかの形は どちらも1つまで。 */
  const cBad = (c, at) => {
    const r = c.revs, n = r ? r.locks.length : -1, bad = [];
    if (login ? !(r && same(r.locks, [SUM_LOGIN_TEXT])) : !(r && n <= 1)) bad.push(`${at}：見えている錠前の行が ${r ? `${n}つ（${r.locks.join('｜')}）` : '読めない'}（あるべき ${login ? `「${SUM_LOGIN_TEXT}」の1つ` : '1つまで'}）`);
    if (login ? c.logins !== 1 : !(c.logins <= 1)) bad.push(`${at}：カードの中のログインの入口が ${c.logins}つ（あるべき ${login ? '1つ' : '1つまで'}）`);
    return bad;
  };
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const rows = ratedRows(s);
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    const sc = await ev(() => window.__pvg.score()), c = sc.card;
    const bad = scoreBad(s, sc, live.filter(IS_SCORE), rows, want);
    ok(!bad.length, `${tag}: 概要 ── 星と図は点数どおり・書く入口は2行のボタン1つ・要約の欄は「${want}」の形`, bad.join(' ／ '));
    const B = { b: (await sumLeakOf(p)).map(x => `概要：${x}`), c: c ? cBad(c, '概要') : ['概要：カードが見えていない'], d: c && c.sum ? seqBad(c.sum, want, want !== 'error').map(x => `概要：${x}`) : [] }, face = [];
    if (login) {
      const href = c && c.sum && c.sum.login.length === 1 ? c.sum.login[0] : '';
      ok(href.startsWith('../login.html?redirect=') && href.endsWith(encodeURIComponent(`airlines/${s}.html`)), `${tag}: ログインの入口が、このページ（airlines/${s}.html）へ戻る`, href || '入口が無い');
    }
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（星の行が押し出さない）`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    if (login) {
      const pr = await ev(() => window.__pvg.probe('#pvg-score'));
      ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 評価の字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    }
    if (process.env.PV_GLANCE_SHOT && w === 390) await sumShot(p, [w, h], `sum-${want}-${s}-${w}-overview`);
    /* 口コミのタブへ（概要と同じ1つの箱）。SUM_WANT で形だけを見る ── scoreBad は概要の書く入口を見るので、ここでは使わない（A35）。 */
    await ev(sel => document.querySelector(sel).click(), '.pvg-tabs [data-pvg-tab="reviews"]');
    const there = (await until(t => window.PVGlance.at() === t, 'reviews')) && (await until(SETTLED));
    const sc2 = there ? await ev(() => window.__pvg.score()) : null, c2 = sc2 && sc2.card;
    /* E9.6：未ログインの人の口コミのタブ。一覧（.pvg-rvl）の中のログインの入口（login.html?return=）も、口コミのタブへ戻る（%23reviews まで付ける）。 */
    const rvl = login && there ? await ev(() => [...document.querySelectorAll('.pvg-rvl a')].filter(a => (a.getAttribute('href') || '').includes('login.html?return='))
      .map(a => ({ href: a.getAttribute('href'), on: a.getClientRects().length > 0 && a.checkVisibility({ visibilityProperty: true }) }))) : null;
    if (!there) face.push('口コミのタブへ切り替わらない・欄が落ち着かない');
    else if (!c2 || !c2.sum) face.push('口コミのタブで、評価・口コミのカードか要約の欄が見えていない');
    else {
      if (!SUM_WANT[want](c2.sum)) face.push(`口コミのタブ：要約の欄が「${want}」の形でない（${c2.sum.state}・${c2.sum.why}・高さ ${Math.round(c2.sum.h)}・「${c2.sum.text.slice(0, 40)}」・項目 ${c2.sum.items}・入口 ${c2.sum.links}）`);
      for (const x of await sumLeakOf(p)) B.b.push(`口コミのタブ：${x}`);
      B.c.push(...cBad(c2, '口コミのタブ'));
      B.d.push(...seqBad(c2.sum, want, false).map(x => `口コミのタブ：${x}`));
    }
    ok(!face.length, `${tag}: 口コミのタブでも、要約の欄は同じ「${want}」の形`, face.join(' ／ '));
    /* 見えている入口が1つも無い時は、通ったとは数えずに知らせる（黙って緑にしない）。 */
    if (login && rvl) {
      if (!rvl.some(x => x.on)) notice(`${tag}: not applicable: no login link in the list（口コミのタブの一覧の中に、見えているログインの入口が無い）`);
      else ok(rvl.every(x => x.href.endsWith('%23reviews')), `${tag}: 口コミのタブの一覧の中のログインの入口（login.html?return=）は、どれも %23reviews まで付けて、口コミのタブへ戻る`, rvl.map(x => `${x.href}${x.on ? '' : '（隠れている）'}`).join(' ／ '));
    }
    ok(!B.b.length, `${tag}: 概要と口コミのタブの両方で、ページのソース（属性の中も）と手元の保存に、届いた要約の文も元の口コミの番号も無い（閉じた形は届いた中身を描かない）`, B.b.join(' ／ '));
    ok(!B.c.length, `${tag}: 概要と口コミのタブの両方で、カードの錠前の1行とログインの入口は ${login ? `「${SUM_LOGIN_TEXT}」1つ・ログイン1つ` : '1つまで'}（同じ案内を重ねない）`, B.c.join(' ／ '));
    ok(!B.d.length, `${tag}: 要約の欄は「読み込み中」→「${SUM_FINAL[want]}」だけを通る${want === 'error' ? '' : '・答えが来ても高さが動かない（2px まで）'}`, B.d.join(' ／ '));
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
    if (login) {
      /* 口コミのタブで開いた時：ログインの入口は、その同じタブへ戻る（同じページの物 ＝ 偽のサーバーと SUM_WATCH は付いたまま）。 */
      await fresh(`${BASE}/airlines/${s}.html#reviews`);
      await p.evaluate(LIB);
      const calm = await until(SETTLED);
      const c3 = calm ? (await ev(() => window.__pvg.score())).card : null;
      const href = c3 && c3.sum && c3.sum.login.length === 1 ? c3.sum.login[0] : '';
      ok(href.endsWith(encodeURIComponent(`airlines/${s}.html#reviews`)), `${tag}: 口コミのタブ（#reviews）で開いたら、ログインの入口は %23reviews まで付けて戻る`, href || (calm ? '入口が無い' : '開き直した画面が落ち着かない'));
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 「開いている要約」（WP 10）：鍵を持つ人の形 ── 偽のサーバーが、要約の口で 'open'（良い点・気になる点に元の口コミの番号つき）、
   口コミの口で本文つきの3件を返す。手元の鍵の控え（pv_unlock_expiry）は、この偽のブラウザの中の印にすぎない。
   ⚠️ この場面が言えるのは、'open' の返事を受けたページが描く形だけ。誰が 'open' を受け取るかはサーバーが決め、
      本物の SQL を通す側（db/test-review-summary.mjs・REAL LOCAL）が見る。
   概要と口コミのタブの両方で：a) 見出し・「良い点」「気になる点」・点の数と字が届いたとおり／b)「AI 要約」と件数・日付の1行／
   c) 欄は鍵や空の形を一度も通らない／d) 矢印は #reviews・分類・元の口コミの番号・読み上げの名前・44px 以上。
   置き場所（図の右か下・頭やまんなかのそろい）はここでは固定しない ── 一度見て、測った数を報告に書いた（RULING O の C）。
   横あふれ・字の切れは geom(true) が見る。
   f) 良い点の矢印 → 口コミのタブ・その分類・元の口コミのカードにだけ「要約のもと」。気になる点も同じ。選び直すと札が消える。
   g) 修飾キーを押したままの矢印は、ページが受けない（ブラウザに任せる）。
   ratedOpenMax（最初の会社だけ）：サーバーが送れるいちばん長い形（3点＋3点・90字）で、点の数と字。 */
const SUM_OPEN_PRE = `(${SUM_WATCH})(); try { localStorage.setItem('pv_unlock_expiry', String(Date.now() + 365 * 864e5)); } catch (e) {}`;
const SUM_OPEN_SENT = mode => { const x = JSON.parse(SUM_BY_MODE[mode]); return [x.good.map(i => i.text), x.concern.map(i => i.text)]; };
async function runRatedOpen(browser, s, v) { return runRatedOpenAt(browser, s, v, 'ratedOpen'); }
async function runRatedOpenMax(browser, s, v) { return runRatedOpenAt(browser, s, v, 'ratedOpenMax'); }
async function runRatedOpenAt(browser, s, [w, h, kind], mode) {
  const max = mode === 'ratedOpenMax', tag = `${s} ${w}（要約の欄 open${max ? '・いちばん長い形' : ''}）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, mode, SUM_OPEN_PRE);
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  /* 開いた要約の中身（見出し・列の見出し・点の字） */
  const openSee = () => {
    const c = document.querySelector('#pvg-score'), e = c && c.querySelector('.crl[data-live="summary"]');
    if (!e) return null;
    const t = n => n.textContent.replace(/\s+/g, ' ').trim();
    return { title: [...e.querySelectorAll('.crl-sum-title')].map(t), heads: [...e.querySelectorAll('.crl-sum-h')].map(t),
      good: [...e.querySelectorAll('.crl-sum-col[data-kind="good"] .crl-sum-t')].map(t), concern: [...e.querySelectorAll('.crl-sum-col[data-kind="concern"] .crl-sum-t')].map(t) };
  };
  const [G0, C0] = SUM_OPEN_SENT(mode), want = max ? [3, 3] : [1, 1];
  /* a〜d を1つのタブで見る。at ＝ 'overview' | 'reviews'。返すのは破れている所の文（ピンの名前ごと）。 */
  const faceBad = async at => {
    const sc = await ev(() => window.__pvg.score()), c = sc.card, sum = c && c.sum, o = await ev(openSee), B = { a: [], b: [], c: [], d: [] };
    if (!sum || !o) { for (const k of Object.keys(B)) B[k].push(`${at}：要約の欄が見えていない`); return B; }
    if (sum.state !== 'open') B.a.push(`${at}：欄が ${sum.state}（あるべき open）`);
    if (!same(o.title, ['口コミの要約'])) B.a.push(`${at}：見出し「${o.title.join('｜')}」`);
    if (!same(o.heads, ['良い点', '気になる点'])) B.a.push(`${at}：列の見出し「${o.heads.join('｜')}」`);
    if (!same(sum.pts, want)) B.a.push(`${at}：点の数 ${sum.pts.join('・')}（あるべき ${want.join('・')}）`);
    if (!same(o.good, G0) || !same(o.concern, C0)) B.a.push(`${at}：点の字が届いた字と違う（良い点「${o.good.map(x => x.slice(0, 12)).join('｜')}」・気になる点「${o.concern.map(x => x.slice(0, 12)).join('｜')}」）`);
    if (!max) {
      if (sum.by !== 'AI 要約会員の口コミ 3件から2026-09-30 更新' || sum.ai !== 1) B.b.push(`${at}：下の1行「${sum.by}」・「AI 要約」の札 ${sum.ai}つ`);
      const st = sum.seq.map(x => x[0]);
      if (st.includes('locked') || st.includes('empty') || st[st.length - 1] !== 'open') B.c.push(`${at}：欄が通った形 ${st.join(' → ') || '無し'}（鍵や空の形を通らずに open）`);
      const ar = sum.arrows, wantA = [['culture', SUM_SRC.slice(0, 2).join(',')], ['wlb', SUM_SRC.slice(1, 3).join(',')]];
      if (ar.length !== 2 || ar.some((a, i) => !(a.href === '#reviews' && a.cat === wantA[i][0] && a.ids === wantA[i][1] && a.label === 'この要約のもとになった口コミを見る' && a.w >= 44 && a.h >= 44))) {
        B.d.push(`${at}：矢印 ${ar.length}つ（${ar.map(a => `${a.href}・${a.cat}・${a.ids}・「${a.label}」・${Math.round(a.w)}×${Math.round(a.h)}`).join(' ／ ')}）`);
      }
    }
    return B;
  };
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const B = await faceBad('overview');
    const sh = await ev(() => window.__pvg.shape());
    ok(!shapeBad(sh, kind).length, `${tag}: 概要の並びが崩れない`, shapeBad(sh, kind).join(' ／ '));
    if (w >= FOLD_FROM) ok(!foldBadOf(sh, w, h).length, `${tag}: 最初の1画面（高さ ${h}）に ${FOLD_WHAT(w)}（星の行が押し出さない）`, foldBadOf(sh, w, h).join('・'));
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    if (!max) {
      const pr = await ev(() => window.__pvg.probe('#pvg-score'));
      ok(!pr.small.length && !pr.tap.length && !pr.bare.length, `${tag}: 評価の字 12px 以上・押す場所 44px 以上・押せるものに状態が在る`, [...pr.small, ...pr.tap, ...pr.bare].slice(0, 8).join('\n      '));
    }
    if (process.env.PV_GLANCE_SHOT && !max) await sumShot(p, [w, h], `sum-open-${s}-${w}-overview`);
    /* 口コミのタブへ（概要と同じ1つの箱）── 押し方は WP 9 の場面と同じ。 */
    await ev(sel => document.querySelector(sel).click(), '.pvg-tabs [data-pvg-tab="reviews"]');
    const there = (await until(t => window.PVGlance.at() === t, 'reviews')) && (await until(SETTLED));
    if (!there) for (const k of Object.keys(B)) B[k].push('口コミのタブへ切り替わらない・欄が落ち着かない');
    else { const R = await faceBad('reviews'); for (const k of Object.keys(B)) B[k].push(...R[k]); }
    if (process.env.PV_GLANCE_SHOT && !max && there && w === 1440) await sumShot(p, [w, h], `sum-open-${s}-${w}-reviews`, true);
    ok(!B.a.length, `${tag}: 概要と口コミのタブの両方で、見出し「口コミの要約」・「良い点」「気になる点」・点は ${want.join('＋')}（届いた字のとおり）`, B.a.join(' ／ '));
    if (!max) {
      ok(!B.b.length, `${tag}: 概要と口コミのタブの両方で、下の1行は「AI 要約」「会員の口コミ 3件から」「2026-09-30 更新」`, B.b.join(' ／ '));
      ok(!B.c.length, `${tag}: 鍵を持つ人の要約の欄は、鍵や空の形を一度も通らない`, B.c.join(' ／ '));
      ok(!B.d.length, `${tag}: 概要と口コミのタブの両方で、矢印は #reviews・社風／勤務・元の口コミの番号・「この要約のもとになった口コミを見る」・44px 以上`, B.d.join(' ／ '));
    }
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
    if (max) return;
    /* E9.5（持ち越し）：区分のタイル6枚は、絵（.rcg-icon の svg）を1つずつ持ち、6つの絵は互いに違う（区分ごとの絵。並び順で選ばない）。
       タイルの右の矢印も svg なので、数えるのは絵の箱の中だけ。DOM を読むだけ（タイルが画面に見えている必要は無い）。 */
    {
      const t = await ev(() => [...document.querySelectorAll('#airline-review-cats .rcg-card')].map(c => ({ icons: c.querySelectorAll('.rcg-icon').length, svg: [...c.querySelectorAll('.rcg-icon svg')].map(x => x.outerHTML),
        key: (/pvSetReviewCat\('([a-z]+)'\)/.exec(c.getAttribute('onclick') || '') || [])[1] || '?' })));
      const single = t.filter(x => x.icons === 1 && x.svg.length === 1), dup = single.filter((x, i) => single.some((y, j) => j < i && y.svg[0] === x.svg[0])).map(x => x.key);
      ok(t.length === 6 && single.length === 6 && !dup.length, `${tag}: 区分のタイル6枚に絵が1つずつ・6つの絵は互いに違う（区分ごとの絵）`,
        `タイル ${t.length}枚・絵の数 ${t.map(x => `${x.key} ${x.svg.length}`).join('・')}${dup.length ? `・前のタイルと同じ絵 ${dup.join('・')}` : ''}`);
    }
    /* f) 元の口コミへ辿る。カード ＝ 一覧（#airline-review-section）の会員の口コミ（本文に「検査用の本文」が在る。
          本文の頭には分類の札「【企業文化】」などが付くので「で始まる」では測れない）。
          公開情報からの引用のカードも同じ形で並ぶが、数えない・隠さない。札は一覧ぜんぶで数える（引用のカードに付いても赤）。 */
    const listSee = src => {
      const sec = document.getElementById('airline-review-section'), vis = n => !!n && n.getClientRects().length > 0 && n.checkVisibility({ visibilityProperty: true });
      if (!sec) return null;
      const body = n => [...n.querySelectorAll('.rv-comment')].map(x => x.textContent.replace(/\s+/g, '')).join('');
      const mem = [...sec.querySelectorAll('.rv-card-wrap')].filter(n => body(n).includes('検査用の本文'));
      const chip = [...sec.querySelectorAll('button.rcf-chip.active')].map(b => (/pvSetReviewCat\('([a-z]+)'\)/.exec(b.getAttribute('onclick') || '') || [])[1] || '?');
      const l = document.querySelector('.pvg-rvl');
      return { pane: window.PVGlance.at() === 'reviews' && vis(sec), chip, cards: mem.length,
        tags: [...sec.querySelectorAll('.rv-sum-tag')].map(x => x.textContent.trim()),
        tagged: mem.filter(n => n.querySelector('.rv-sum-tag')).map(n => body(n).slice(-1)).sort().join(''),
        ids: l ? src.filter(i => l.innerHTML.includes(i)).length : -1 };
    };
    const F = [];
    const step = async (what, go, chip, tagged, three) => {
      if (!(await go())) { F.push(`${what}：押す所が無い`); return; }
      const done = await until((chip, n) => { const sec = document.getElementById('airline-review-section'); if (!sec) return false;
        const a = [...sec.querySelectorAll('button.rcf-chip.active')].map(b => (/pvSetReviewCat\('([a-z]+)'\)/.exec(b.getAttribute('onclick') || '') || [])[1]);
        return window.PVGlance.at() === 'reviews' && a.length === 1 && a[0] === chip && sec.querySelectorAll('.rv-sum-tag').length === n; }, chip, tagged.length);
      const x = await ev(listSee, SUM_SRC);
      if (!x) { F.push(`${what}：一覧が無い`); return; }
      if (!done || !x.pane || !same(x.chip, [chip]) || (three && x.cards !== 3) || x.tags.length !== tagged.length || x.tags.some(t => t !== '要約のもと') || x.tagged !== tagged || x.ids) {
        F.push(`${what}：口コミのタブ ${x.pane ? '見えている' : '見えていない'}・選ばれた分類 ${x.chip.join('｜') || '無し'}（あるべき ${chip}）・会員のカード ${x.cards}枚・札 ${x.tags.length}つ「${x.tags.join('｜')}」・札の付いたカード「${x.tagged}」（あるべき「${tagged}」）・一覧の中の番号 ${x.ids}`);
      }
    };
    /* 押す所が無い時は、落ちずに f の赤い行を出す（その先の測りも続ける） */
    const clickIn = sel => ev(sel => { const n = document.querySelector(sel); if (n) n.click(); return !!n; }, sel);
    await ev(() => window.__pvg.top());
    await ev(sel => document.querySelector(sel).click(), '.pvg-tabs [data-pvg-tab="overview"]');
    await until(t => window.PVGlance.at() === t, 'overview');
    await step('概要で良い点の矢印', () => clickIn('#pvg-score .crl-sum-col[data-kind="good"] a.crl-sum-a'), 'culture', 'あい', true);
    await step('気になる点の矢印', () => clickIn('#pvg-score .crl-sum-col[data-kind="concern"] a.crl-sum-a'), 'wlb', 'いう', true);
    const other = await ev(() => { const b = [...document.querySelectorAll('#airline-review-section button.rcf-chip')].map(b => (/pvSetReviewCat\('([a-z]+)'\)/.exec(b.getAttribute('onclick') || '') || [])[1]).find(k => k && k !== 'all' && k !== 'wlb' && k !== 'culture'); return b || null; });
    if (!other) F.push('ほかの分類の札が無い');
    else await step(`ほかの分類（${other}）を選ぶ`, () => clickIn(`#airline-review-section button.rcf-chip[onclick="pvSetReviewCat('${other}')"]`), other, '');
    await step('「すべて」を選ぶ', () => clickIn(`#airline-review-section button.rcf-chip[onclick="pvSetReviewCat('all')"]`), 'all', '');
    const tile = await ev(() => { const t = document.querySelector('#airline-review-cats .rcg-grid button.rcg-card'); return t ? (/pvSetReviewCat\('([a-z]+)'\)/.exec(t.getAttribute('onclick') || '') || [])[1] || null : null; });
    if (!tile) F.push('分類のタイルが無い');
    else await step(`分類のタイル（${tile}）を押す`, () => clickIn(`#airline-review-cats .rcg-grid button.rcg-card[onclick="pvSetReviewCat('${tile}')"]`), tile, '');
    ok(!F.length, `${tag}: 良い点の矢印 → 口コミのタブ・社風・元の口コミ「あ」「い」にだけ「要約のもと」／気になる点 →「い」「う」／分類・すべて・タイルで選び直すと札は0（一覧に番号を書かない）`, F.join(' ／ '));
    /* g) 修飾キー（ctrl・meta）を押したままの矢印は、ページが受けない ── 押したことを窓で控え、控えたあとでこちらが止める（偽のブラウザはどこへも行かない）。 */
    const G = [];
    for (const key of ['ctrlKey', 'metaKey']) {
      const r = await ev((key, sel) => {
        const sec = document.getElementById('airline-review-section'), a = document.querySelector(sel);
        if (!sec || !a) return null;
        const chip = () => [...sec.querySelectorAll('button.rcf-chip.active')].map(b => b.getAttribute('onclick')).join('|');
        const before = chip(), at = window.PVGlance.at();
        let seenPrev = null;
        const f = e => { seenPrev = e.defaultPrevented; e.preventDefault(); };
        window.addEventListener('click', f);
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, [key]: true }));
        window.removeEventListener('click', f);
        return { prev: seenPrev, tags: sec.querySelectorAll('.rv-sum-tag').length, same: chip() === before, at, now: window.PVGlance.at() };
      }, key, '#pvg-score .crl-sum-col[data-kind="good"] a.crl-sum-a');
      if (!r) G.push(`${key}：矢印か一覧が無い`);
      else if (r.prev !== false || r.tags || !r.same) G.push(`${key}：ページが受けた ${r.prev}・札 ${r.tags}つ・分類 ${r.same ? 'そのまま' : '変わった'}（タブ ${r.at} → ${r.now}）`);
    }
    ok(!G.length, `${tag}: 修飾キー（ctrl・meta）を押したままの矢印は、ページが受けない（札は付かない・分類も変わらない）`, G.join(' ／ '));
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
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* 「勤務・訓練」のタブを、読む人の立場ごとに開いて見る（場面 work・work0）。偽のサーバーの場面を1つずつ、ページを1回ずつ開く：
     未ログイン（''）・鍵の無い会員（'rows'）・開いている人（'work'）・自分の会社への回答が足りない人（'give'）・
     読めない時（'off'）・集計の口が無い時（'facts404'）。work0 ＝ 開いている人で、集めたものが何も無い時（'work0'）。
   見るのは板の5つの面の欄：月の勤務・勤務予定・休日（黙る欄）・通勤・Staff Travel・昇格・訓練（黙る欄）。
   開いていない人には、見えている欄ごとに鍵の1行と、その人の入口（未ログイン ＝ 欄ごとの「ログイン」3つ・鍵の無い会員 ＝ 月の勤務の
   「匿名で給与を提出する」1つ・回答が足りない人 ＝ 月の勤務の答えるカード1枚）だけ。その奥（回答の行・人数・値）は何も無い。
   「見えない」は2つの約束：計算された display が none・字が1つも無い（欄が何も受け取っていない）。
   人数（「3人」）や値（「9.5」）は、欄（.crl）の字でだけ探す（板の地の文と、概要のカードが「3人そろった」と言う）。
   ⚠️ 絵の検査（MOCK）。誰にどの状態が返るかは、本物の SQL を通す側（db/test-contrib.mjs・assert-contrib.mjs）が見る。 */
async function runWork(browser, s, [w, h], only) {
  const SCOPE = '勤務予定・休日、昇格・訓練の回答も、同じ条件で開きます。', ASKH = 'パイロットの回答';
  const SF = { roster: '勤務予定・休日', commute: '通勤', travel: 'Staff Travel', career: '昇格・訓練' };
  const QUIET = ['roster', 'career'], LOUD = ['commute', 'travel'], FOUR = ['roster', 'commute', 'travel', 'career'];
  /* 板の欄と、板・ページの数を、1回だけ読む。ページの中で動く（外の変数を1つも使わない）。判定は外でする。 */
  const see = payGo => {
    const vis = e => !!e && e.getClientRects().length > 0, sq = e => (e ? e.textContent : '').replace(/\s+/g, ''), tr = e => (e ? e.textContent : '').trim();
    const P = document.getElementById('pvg-p-work'), WB = ['.crl-wb', '.crl-wb-c', '.crl-wb-tr', '.crl-wb-cap'];
    if (!P) return null;
    const slots = [...P.querySelectorAll('.crl[data-live]')].map(e => ({
      live: e.getAttribute('data-live'), sf: e.getAttribute('data-sf') || '', quiet: e.getAttribute('data-quiet') === '1',
      state: e.getAttribute('data-state'), on: vis(e), display: getComputedStyle(e).display, text: sq(e),
      lock: [...e.querySelectorAll('.crl-lock')].map(sq), retry: [...e.querySelectorAll('.crl-retry')].filter(vis).length,
      links: [...e.querySelectorAll('a')].map(a => ({ text: sq(a), on: vis(a), login: a.hasAttribute('data-crl-login'), cta: a.classList.contains('crl-cta'), give: a.getAttribute('data-crl-give') === '1' })),
      cards: [...e.querySelectorAll('.crl-give')].map(c => ({ on: vis(c), head: [...c.querySelectorAll('.crl-give-h')].map(tr), count: [...c.querySelectorAll('.crl-give-n')].map(tr) })),
      rows: [...e.querySelectorAll('.crl-fact')].map(r => ({ ctx: r.classList.contains('is-ctx'), sub: r.classList.contains('is-sub'), k: tr(r.querySelector('.crl-fact-k')), ans: !!r.querySelector('.crl-ans'), v: tr(r.querySelector('.crl-ans-v')), text: sq(r) })),
    }));
    const head = {};
    for (const f of P.querySelectorAll('.pvg-sf')) { const hd = f.querySelector('.pvg-sf-got > .pvg-askh'); if (hd) head[f.getAttribute('data-sf')] = { on: vis(hd), text: tr(hd) }; }
    const sc = P.querySelector('.pvg-sf-scope'), seen = [...document.querySelectorAll('a')].filter(vis);
    return {
      slots, head, scope: sc ? { on: vis(sc), text: tr(sc) } : null,
      panel: {
        pay: [...P.querySelectorAll('a')].filter(a => sq(a) === payGo).map(a => ({ on: vis(a), month: !!a.closest('.crl[data-live="work"]') })),
        login: P.querySelectorAll('a[data-crl-login]').length, loginOn: [...P.querySelectorAll('a[data-crl-login]')].filter(vis).length,
        give: P.querySelectorAll('.crl-give').length, wb: WB.reduce((n, c) => n + P.querySelectorAll(c).length, 0),
      },
      page: {
        crl: [...document.querySelectorAll('.crl')].map(e => e.textContent).join('\n'), facts: document.querySelectorAll('.crl-fact').length,
        give: [...document.querySelectorAll('.crl-give')].filter(vis).length, login: [...document.querySelectorAll('a[data-crl-login]')].filter(vis).length,
        pay: seen.filter(a => sq(a) === payGo).length, wb: WB.reduce((n, c) => n + document.querySelectorAll(c).length, 0),
      },
    };
  };
  /* 1つの場面でページを開き、「勤務・訓練」のタブへ移り、見えている欄が落ち着くまで待ってから（時間では待たない）1回だけ読む。
     more ＝ 同じページで、そのあと1回だけ読む・撮るもの（開いている人の月の勤務の面）。返したものは R.x に入る。 */
  const load = async (mode, who, more) => {
    const { ctx, p, ready } = await open(browser, s, w, h, mode);
    try {
      if (!ready) return { lost: `${who}: 「読み込み中」のまま固まる` };
      await p.evaluate(() => document.querySelector('.pvg-tabs [data-pvg-tab="work"]').click());
      const at = await p.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'work' && document.body.classList.contains('pvg-at-work'), { timeout: 15000 }).then(() => true, () => false);
      /* 欄は見えた時に読みに行く（career-live.js）。見えていない欄が読み終わったかは、待たずに約束の側で見る（鍵の形・字なし）。 */
      const calm = at && (await p.waitForFunction(SETTLED, { timeout: 15000 }).then(() => true, () => false));
      if (!calm) return { lost: `${who}: 「勤務・訓練」へ移れない・欄が落ち着かない` };
      const R = await p.evaluate(see, PAY_GO);
      if (!R) return { lost: `${who}: 「勤務・訓練」の板が無い` };
      if (more) R.x = await more(p);
      return R;
    } finally {
      await ctx.close().catch(() => {});
    }
  };
  const pick = (R, live, sf) => { const a = R.slots.filter(x => x.live === live && (live === 'work' || x.sf === sf)); return a.length === 1 ? a[0] : null; };
  const nm = sf => (sf ? `${SF[sf]}の集計` : '月の勤務');
  const say = (tag, label, R, judge) => { const bad = R.lost ? [R.lost] : judge(R); ok(!bad.length, `${tag}: ${label}`, [...new Set(bad)].slice(0, 6).join(' ／ ')); };
  /* 黙る2つの欄（勤務予定・休日、昇格・訓練）：鍵の形のまま見えない（display none）／字が無い／面の「パイロットの回答」も見えない。 */
  const quietShown = R => QUIET.flatMap(sf => {
    const x = pick(R, 'fact', sf);
    if (!x) return [`${nm(sf)}が無い`];
    if (!x.quiet) return [`${nm(sf)}に黙る印が無い（${x.state}・display ${x.display}）`];
    return x.state !== 'locked' || x.display !== 'none' || x.on ? [`${nm(sf)}が ${x.state}・display ${x.display}${x.on ? '・見えている' : ''}（あるべき 鍵の形・display none）`] : [];
  });
  const quietText = R => QUIET.flatMap(sf => { const x = pick(R, 'fact', sf); return !x ? [`${nm(sf)}が無い`] : x.text ? [`${nm(sf)}に字が在る「${x.text.slice(0, 40)}」`] : []; });
  const quietHead = R => QUIET.flatMap(sf => (!R.head[sf] ? [`${SF[sf]}の面に「${ASKH}」の見出しが無い`] : R.head[sf].on ? [`${SF[sf]}の面の「${R.head[sf].text}」が見えている`] : []));
  const scopeOn = R => (!R.scope ? ['添え書きが無い'] : !R.scope.on || R.scope.text !== SCOPE ? [`添え書き ${R.scope.on ? '見えている' : '見えない'}「${R.scope.text}」（あるべき 見えている「${SCOPE}」）`] : []);
  const QUIET_LABEL = ['黙る2つの集計の欄（勤務予定・休日、昇格・訓練）は、鍵の形のまま見えない（display none）', '黙る2つの集計の欄は、字を1つも持たない（何も受け取っていない）', `黙る2つの面の「${ASKH}」の見出しは見えない`];
  const SCOPE_LABEL = `板の添え書き「${SCOPE}」が見えている`;
  try {
    if (only === 'work0') {
      /* B4' 開いている人・集めたものが何も無い：「まだ集計がありません」と言う（隠さない・0 と書かない）。月の勤務に棒も目盛も無い。 */
      const tag = `${s} ${w}（勤務・訓練・開いている人・集計なし）`, Z = await load('work0', '集計なし');
      say(tag, `月の勤務は「${FACT_NONE}」だけ ── 棒・目盛・帯・添え書き（.crl-wb）が無い・数字が無い`, Z, R => {
        const x = pick(R, 'work');
        return [
          ...(R.panel.wb ? [`月の勤務の棒の部品が ${R.panel.wb}つ`] : []),
          ...(!x ? ['月の勤務の欄が無い'] : !x.on || x.text !== FACT_NONE ? [`月の勤務が ${x.state}${x.on ? '' : '・見えていない'}「${x.text.slice(0, 40)}」（あるべき「${FACT_NONE}」だけ）`] : []),
          ...(x && NO_NUM.test(x.text) ? ['月の勤務に数字が在る'] : []),
        ];
      });
      say(tag, `4つの集計の欄は、どれも見えている「${ASKH}」の下に「${FACT_NONE}」`, Z, R => FOUR.flatMap(sf => {
        const x = pick(R, 'fact', sf), hd = R.head[sf];
        return [
          ...(!hd || !hd.on || hd.text !== ASKH ? [`${SF[sf]}の面の「${ASKH}」が見えていない`] : []),
          ...(!x ? [`${nm(sf)}が無い`] : !x.on || x.text !== FACT_NONE ? [`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}「${x.text.slice(0, 40)}」`] : []),
        ];
      }));
      return;
    }
    /* B1 未ログイン：月の勤務と、通勤・Staff Travel の集計に「ログインと給与の提出で開きます」＋「ログイン」（1行が3つ・入口が3つ・どれも同じ1行）。 */
    {
      const tag = `${s} ${w}（勤務・訓練・未ログイン）`, L = await load('', '未ログイン');
      say(tag, `月の勤務と、通勤・Staff Travel の集計の欄は「${LOGIN_LINE}」の1行と入口「${LOGIN_GO}」の1つ（板に1行が3つ・入口が3つ）`, L, R => [
        ...[null, ...LOUD].flatMap(sf => {
          const x = pick(R, sf ? 'fact' : 'work', sf), lg = x ? x.links.filter(a => a.login) : [];
          if (!x) return [`${nm(sf)}が無い`];
          const b = [];
          if (x.state !== 'locked' || !x.on) b.push(`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}`);
          if (!same(x.lock, [LOGIN_LINE])) b.push(`${nm(sf)}の1行「${x.lock.join('｜')}」`);
          if (x.links.length !== 1 || lg.length !== 1 || !lg[0].on || lg[0].text !== LOGIN_GO) b.push(`${nm(sf)}の入口「${x.links.map(a => a.text + (a.login ? '' : '〔ログインの入口でない〕')).join('｜') || '無し'}」`);
          if (x.text !== LOGIN_LINE + LOGIN_GO) b.push(`${nm(sf)}に、1行と入口のほかの字が在る「${x.text.slice(0, 50)}」`);
          return b;
        }),
        ...(R.panel.loginOn !== 3 || R.panel.login !== 3 ? [`板の「${LOGIN_GO}」が ${R.panel.loginOn}つ見えている（在るのは ${R.panel.login}つ・あるべき 3つ）`] : []),
      ]);
      say(tag, QUIET_LABEL[0], L, quietShown);
      say(tag, QUIET_LABEL[1], L, quietText);
      say(tag, QUIET_LABEL[2], L, quietHead);
      say(tag, SCOPE_LABEL, L, scopeOn);
      say(tag, `板の欄に数字が無い・「${PAY_GO}」も答えるカードも、月の勤務の棒も無い`, L, R => [
        ...R.slots.filter(x => NO_NUM.test(x.text)).map(x => `${x.live === 'work' ? '月の勤務' : `${SF[x.sf] || x.sf}の${x.live === 'notes' ? '補足' : '集計'}`}に数字「${x.text.slice(0, 40)}」`),
        ...(R.panel.pay.length ? [`「${PAY_GO}」が ${R.panel.pay.length}つ`] : []),
        ...(R.panel.give ? [`答えるカードが ${R.panel.give}枚`] : []),
        ...(R.panel.wb ? [`月の勤務の棒の部品が ${R.panel.wb}つ`] : []),
      ]);
    }
    /* B2 鍵の無い会員（偽のサーバーは、鍵の掛かった返事に、わざと行を付けて返す）：見えている「匿名で給与を提出する」は月の勤務の欄の中の1つだけ・
       通勤と Staff Travel の集計は「給与の提出で開きます」の1行だけ・回答の行は、ページのどの欄にも無い（概要の「集まった回答」も ＝ 1つの返事、1つの状態）。 */
    {
      const tag = `${s} ${w}（勤務・訓練・鍵の無い会員）`, M = await load('rows', '鍵の無い会員');
      say(tag, `月の勤務は「${PAY_LINE}」・板に見えている「${PAY_GO}」は、月の勤務の欄の中の1つだけ`, M, R => {
        const x = pick(R, 'work'), on = R.panel.pay.filter(a => a.on);
        return [
          ...(!x ? ['月の勤務の欄が無い'] : x.state !== 'locked' || !x.on || !same(x.lock, [PAY_LINE]) ? [`月の勤務が ${x.state}${x.on ? '' : '・見えていない'}「${x.lock.join('｜')}」`] : []),
          ...(on.length !== 1 || !on[0].month ? [`見えている「${PAY_GO}」が ${on.length}つ（月の勤務の欄の中 ${on.filter(a => a.month).length}つ）`] : []),
        ];
      });
      say(tag, QUIET_LABEL[0], M, quietShown);
      say(tag, QUIET_LABEL[1], M, quietText);
      say(tag, SCOPE_LABEL, M, scopeOn);
      say(tag, `通勤・Staff Travel の集計の欄は「${PAY_LINE}」の1行だけ ── リンクも、回答の行も、親の質問の行も無い`, M, R => LOUD.flatMap(sf => {
        const x = pick(R, 'fact', sf);
        if (!x) return [`${nm(sf)}が無い`];
        const b = [], c = x.rows.filter(r => r.ctx).length;
        if (x.state !== 'locked' || !x.on || !same(x.lock, [PAY_LINE])) b.push(`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}「${x.lock.join('｜')}」`);
        if (x.links.length) b.push(`${nm(sf)}にリンクが ${x.links.length}つ（${x.links.map(a => a.text).join('｜')}）`);
        if (x.rows.length - c) b.push(`${nm(sf)}に回答の行が ${x.rows.length - c}つ`);
        if (c) b.push(`${nm(sf)}に親の質問の行が ${c}つ`);
        if (x.text !== PAY_LINE + x.links.map(a => a.text).join('')) b.push(`${nm(sf)}に、1行のほかの字が在る「${x.text.slice(0, 50)}」`);
        return b;
      }));
      say(tag, `板に「${LOGIN_GO}」も答えるカードも無い・返事に付いてきた人数も中央値も、ページのどの欄（.crl）の字にも無い・回答の行は、ページのどの欄にも無い（概要の「集まった回答」も）`, M, R => [
        ...(R.panel.login ? [`板に「${LOGIN_GO}」が ${R.panel.login}つ`] : []),
        ...(R.panel.give ? [`板に答えるカードが ${R.panel.give}枚`] : []),
        ...LEAK_SLOT.filter(t => R.page.crl.includes(t)).map(t => `欄の字に「${t}」`),
        ...(R.page.facts ? [`回答の行が、ページの欄に ${R.page.facts}つ`] : []),
      ]);
    }
    /* B3r 開いている人：子の質問の行は、値の無い親の質問の行の下に立つ（親の行が出ていない時だけ、親の質問の字を上に置く）。
       通勤 ＝ タクシーの費用（回答 3人）の上に、出社・帰宅の移動 → どの形で提供されるか の2行・Staff Travel ＝ 上位クラス（回答 6人）の上に1行。
       同じページで、月の勤務の面（B3'）も読む。PV_GLANCE_SHOT=<フォルダ> を渡すと、その面を work-<会社>-<幅>.png に撮って置く（見本と
       見比べるため。検査の合否には使わない）。 */
    {
      /* 月の勤務の面を1回だけ読む。面は section で絞る（面の中の欄も data-sf="month" を持つ）。ページの中で動く（外の変数を1つも使わない）。
         枠の名前は、単位（small.crl-unit）を除いた字で比べる。 */
      const monthSee = () => {
        const M = document.querySelector('#pvg-p-work section.pvg-sf[data-sf="month"]');
        if (!M) return null;
        const tr = e => (e ? e.textContent : '').trim(), vis = e => !!e && e.getClientRects().length > 0;
        const box = e => { if (!vis(e)) return null; const r = e.getBoundingClientRect(); return { l: r.left, w: r.width }; };
        return {
          cells: [...M.querySelectorAll('.crl-wb-c')].map(c => {
            const k = c.querySelector(':scope > .crl-wk-k'), nm = k ? k.cloneNode(true) : null;
            if (nm) for (const u of nm.querySelectorAll('small.crl-unit')) u.remove();
            return {
              k: c.getAttribute('data-k'), fam: c.getAttribute('data-fam'), name: tr(nm),
              rows: [...c.querySelectorAll(':scope > .crl-wb-r')].map(r => {
                const t = r.querySelector('.crl-wb-tr'), o = r.querySelector('.crl-wb-o');
                return {
                  pos: r.getAttribute('data-pos'), p: tr(r.querySelector('.crl-wb-p')), n: tr(r.querySelector('.crl-wb-n')), u: tr(r.querySelector('.crl-wb-u')),
                  none: tr(r.querySelector(':scope > .crl-none')), text: r.textContent.replace(/\s+/g, ''),
                  track: t ? { box: box(t), over: t.classList.contains('is-over') } : null, band: t ? box(t.querySelector('.crl-wb-b')) : null,
                  mark: o ? { on: vis(o), text: tr(o) } : null,
                };
              }),
            };
          }),
          caps: [...M.querySelectorAll('.crl-wb-cap')].map(p => [...p.children].map(tr)),
          text: M.textContent, lock: document.querySelectorAll('#pvg-p-work .crl-lock').length,
        };
      };
      const tag = `${s} ${w}（勤務・訓練・開いている人）`, O = await load('work', '開いている人', async p => {
        const X = await p.evaluate(monthSee), SEL = '#pvg-p-work section.pvg-sf[data-sf="month"]';
        /* 絵は、読み終わったあとに撮る。面が画面より高い時は、画面の高さだけを面が入るまで伸ばし、上の帯（ヘッダーとタブ）の下へ面を寄せてから撮る
           （そのままだと、上の帯が面の頭に重なって写る）。幅と端末の種類は変えない ＝ 面の組み方は読んだ時のまま。 */
        if (process.env.PV_GLANCE_SHOT && X) {
          const tall = await p.evaluate(sel => Math.ceil(document.querySelector(sel).getBoundingClientRect().height), SEL);
          await p.setViewport({ width: w, height: Math.max(h, tall + 260), deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
          await p.evaluate(sel => new Promise(r => { scrollTo({ top: scrollY + document.querySelector(sel).getBoundingClientRect().top - 220, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }), SEL);
          await (await p.$(SEL)).screenshot({ path: `${process.env.PV_GLANCE_SHOT.replace(/\/$/, '')}/work-${s}-${w}.png` });
        }
        return X;
      });
      const label = id => QBY.get(id).ja.label, people = id => `${FACT_ROWS.find(f => f.question_id === id).n}人`;
      const under = (sf, row, ctxs) => R => {
        const x = pick(R, 'fact', sf);
        if (!x) return [`${nm(sf)}が無い`];
        const b = [], i = x.rows.findIndex(r => !r.ctx && r.k === label(row)), c = x.rows.map((r, j) => [r, j]).filter(([r]) => r.ctx);
        if (x.state !== 'open' || !x.on) b.push(`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}`);
        if (i < 0) b.push(`「${label(row)}」の行が無い`);
        else if (!x.rows[i].text.includes(people(row))) b.push(`「${label(row)}」の行に「${people(row)}」が無い「${x.rows[i].text.slice(0, 60)}」`);
        if (!same(c.map(([r]) => r.k), ctxs.map(label))) b.push(`親の質問の行「${c.map(([r]) => r.k).join('｜') || '無し'}」（あるべき「${ctxs.map(label).join('｜')}」の順）`);
        if (i >= 0 && c.some(([, j]) => j > i)) b.push(`親の質問の行が「${label(row)}」の行より下に在る`);
        for (const [r] of c) if (r.ans || NO_NUM.test(r.text) || r.text !== squash(r.k)) b.push(`親の質問の行「${r.k}」に、答えか数字が在る「${r.text.slice(0, 50)}」`);
        return b;
      };
      say(tag, '通勤の面：「タクシーでの出社・帰宅の費用」の行（回答 3人）は、値の無い親の質問の行2つ（出社・帰宅の移動 → どの形で提供されるか）の下に立つ', O, under('commute', 'commuting_taxi_cost', ['commuting_transport', 'commuting_transport_method']));
      say(tag, 'Staff Travel の面：「上位クラスに乗れるか」の行（回答 6人）は、値の無い親の質問の行1つ（社員向けの航空券制度）の下に立つ', O, under('travel', 'staff_travel_cabin', ['staff_travel']));
      /* B3' 月の勤務の6つの枠（ruling E・addendum A1）。枠ごとに機長と副操縦士の1行ずつ：職位の名前｜軸と帯｜数字｜単位。
         字と帯の位置は、偽のサーバーの返事（WORK_FIX）からここで作り直して突き合わせる（返事の数字をここへ書き写さない）。
         目盛は単位ごとに固定（時間 0〜240・日と泊 0〜31 ── ruling D。会社の決まりの数字ではない）。帯の左端は CSS と同じ
         min(lo／目盛 × 軸, 軸 − 4px)・長さは max((min(hi, 目盛) − lo)／目盛 × 軸, 4px)。lo が目盛より上なら帯を描かない。 */
      const ITEMS = [['block_hours', '乗務時間', '時間', 'h'], ['duty_hours', '勤務・拘束時間', '時間', 'h'], ['work_days', '勤務日数', '日', 'd'],
        ['duty_days', '乗務日数', '日', 'd'], ['days_off', '公休日数', '日', 'd'], ['stay_nights', 'ステイ泊数', '泊', 'd']];
      const POS = [['cap', '機長'], ['fo', '副操縦士']], MAX = { h: 240, d: 31 }, NONE = '未取得', OVER = '目盛の外';
      const CAP = ['帯と数字は、回答のまんなか半分の幅', '目盛は、時間が 0〜240、日と泊が 0〜31'], WORDS = ['上限', '規定', '法定', '制限'];
      const rowOf = (X, k, pos) => { const c = X && X.cells.find(x => x.k === k); return (c && c.rows.find(x => x.pos === pos)) || null; };
      const cellsBad = (X, by) => {
        if (!X) return ['月の勤務の面が無い'];
        const b = [];
        if (!same(X.cells.map(c => c.k), ITEMS.map(i => i[0]))) b.push(`枠の並び「${X.cells.map(c => c.k).join('｜')}」`);
        for (const [k, name, u, fam] of ITEMS) {
          const c = X.cells.find(x => x.k === k);
          if (!c) continue;
          if (c.name !== name || c.fam !== fam) b.push(`${k} の枠の名前「${c.name}」・目盛 ${c.fam}（あるべき「${name}」・${fam}）`);
          if (!same(c.rows.map(r => r.pos), POS.map(x => x[0]))) { b.push(`${name}の枠の行「${c.rows.map(r => r.pos).join('｜')}」（あるべき 機長・副操縦士の2行）`); continue; }
          for (const [i, [pos, pn]] of POS.entries()) {
            const r = c.rows[i], v = by[pos][k], at = `${name}・${pn}`;
            if (r.p !== pn) b.push(`${at}: 職位の名前「${r.p}」`);
            if (v == null) {
              if (r.none !== NONE || r.track || r.n || r.u || NO_NUM.test(r.text)) b.push(`${at}: 値が無いのに「${r.text}」${r.track ? '・軸が在る' : ''}（あるべき「${NONE}」だけ・軸なし）`);
              continue;
            }
            const n = v.lo === v.hi ? String(v.lo) : `${v.lo}〜${v.hi}`;
            if (r.n !== n || r.u !== u || r.none) b.push(`${at}: 「${r.n}」「${r.u}」${r.none ? `「${r.none}」` : ''}（あるべき「${n}」「${u}」）`);
            if (!r.track) b.push(`${at}: 軸が無い`);
          }
        }
        return b;
      };
      const bandBad = (X, by) => {
        if (!X) return ['月の勤務の面が無い'];
        const b = [], len = [];
        for (const [k, name, , fam] of ITEMS) for (const [pos, pn] of POS) {
          const r = rowOf(X, k, pos), v = by[pos][k], at = `${name}・${pn}（${v ? `${v.lo}〜${v.hi}` : '値なし'}）`;
          if (!r || !r.track || !v) continue;                       // 行の並び・「未取得」・軸の有る無しは、1つ前の約束が見る
          if (!r.track.box) { b.push(`${at}: 軸が見えていない`); continue; }
          const L = r.track.box.w, max = MAX[fam], over = v.hi > max;
          len.push(L);
          if (r.track.over !== over) b.push(`${at}: 軸の「目盛の外」の印が${r.track.over ? '在る' : '無い'}`);
          if (over !== !!(r.mark && r.mark.on && r.mark.text === OVER)) b.push(`${at}: 「${OVER}」が${r.mark && r.mark.on ? `見えている「${r.mark.text}」` : '見えない'}`);
          if (v.lo > max) { if (r.band) b.push(`${at}: 目盛より上の幅に帯が在る`); continue; }
          if (!r.band) { b.push(`${at}: 帯が無い`); continue; }
          const left = Math.min(v.lo / max * L, L - 4), width = Math.max((Math.min(v.hi, max) - v.lo) / max * L, 4), got = r.band.l - r.track.box.l;
          if (Math.abs(got - left) > 1) b.push(`${at}: 帯の左端 ${got.toFixed(1)}px（あるべき ${left.toFixed(1)}px・軸 ${L.toFixed(1)}px・目盛 0〜${max}）`);
          if (Math.abs(r.band.w - width) > 1) b.push(`${at}: 帯の長さ ${r.band.w.toFixed(1)}px（あるべき ${width.toFixed(1)}px）`);
        }
        if (len.length && Math.max(...len) - Math.min(...len) > 0.5) b.push(`面の軸の長さがそろわない（${Math.min(...len).toFixed(1)}〜${Math.max(...len).toFixed(1)}px）`);
        return b;
      };
      say(tag, `月の勤務は6つの枠（${ITEMS.map(i => i[1]).join('｜')}）── 枠ごとに機長・副操縦士の1行ずつ・数字と単位は返事のとおり・値の無い側は「${NONE}」だけで軸を描かない（0 で埋めない）`, O, R => cellsBad(R.x, WORK_FIX));
      say(tag, `月の勤務の帯は、返事の幅を固定の目盛（時間 0〜${MAX.h}・日と泊 0〜${MAX.d}）に置いた位置と長さ（短くても 4px・0 も描く）・目盛を超える幅は右端で切って「${OVER}」・面のどの軸も同じ長さ`, O, R => bandBad(R.x, WORK_FIX));
      say(tag, `月の勤務の面の下の1行は1回だけ「${CAP[0]}」「${CAP[1]}」・面のどこにも ${WORDS.join('／')} の字が無い（目盛は会社の決まりではない）`, O, R => (!R.x ? ['月の勤務の面が無い'] : [
        ...(R.x.caps.length !== 1 || !same(R.x.caps[0], CAP) ? [`面の下の1行「${R.x.caps.map(c => c.join('｜')).join(' ‖ ') || '無し'}」（${R.x.caps.length}つ）`] : []),
        ...WORDS.filter(t => R.x.text.includes(t)).map(t => `面に「${t}」`),
      ]));
      say(tag, `開いた板に鍵の1行が無い・月の勤務は開いている・板の添え書き「${SCOPE}」は見えていない（開いている人に「同じ条件で開きます」と言わない）`, O, R => {
        const x = pick(R, 'work');
        return [
          ...(!x ? ['月の勤務の欄が無い'] : x.state !== 'open' || !x.on ? [`月の勤務が ${x.state}${x.on ? '' : '・見えていない'}`] : []),
          ...(R.x && R.x.lock ? [`板に鍵の1行が ${R.x.lock}つ`] : []),
          ...(!R.scope ? ['添え書きが無い'] : R.scope.on ? [`添え書きが見えている「${R.scope.text}」`] : []),
        ];
      });
      /* 数の質問の行：昇格・訓練の面の upgrade_years ／ 勤務予定・休日の面の reserve_days（子だけに行がある質問。親 reserve_duty の行は値なし）。
         値は偽のサーバーの返事（factBody）の中央値と、質問の台帳の単位から作る。 */
      const FR = JSON.parse(factBody('work')).facts, med = id => { const f = FR.find(x => x.question_id === id); return f ? `${f.median_num}${QBY.get(id).num.ja}` : null; };
      say(tag, `昇格・訓練の面に「${label('upgrade_years')}」の中央値「${med('upgrade_years')}」・勤務予定・休日の面に「${label('reserve_days')}」の「${med('reserve_days')}」が、値の無い親の質問の行「${label('reserve_duty')}」のすぐ下に、子の行（字下げ）で`, O, R => {
        const b = [], cr = pick(R, 'fact', 'career'), ro = pick(R, 'fact', 'roster');
        const up = cr ? cr.rows.find(r => !r.ctx && r.k === label('upgrade_years')) : null;
        if (!up || up.v !== med('upgrade_years')) b.push(`昇格・訓練の面の「${label('upgrade_years')}」の行${up ? `「${up.v}」` : 'が無い'}`);
        const i = ro ? ro.rows.findIndex(r => !r.ctx && r.k === label('reserve_days')) : -1, rd = i >= 0 ? ro.rows[i] : null, c = i > 0 ? ro.rows[i - 1] : null;
        if (!rd) b.push(`勤務予定・休日の面に「${label('reserve_days')}」の行が無い`);
        else {
          if (rd.v !== med('reserve_days')) b.push(`「${label('reserve_days')}」の行「${rd.v}」`);
          if (!rd.sub) b.push(`「${label('reserve_days')}」の行が子の行（字下げ）でない`);
          if (!c || !c.ctx || c.ans || c.k !== label('reserve_duty')) b.push(`「${label('reserve_days')}」のすぐ上の行「${c ? c.k : '無し'}」（あるべき 値の無い親の質問の行）`);
        }
        return b;
      });
      /* 2回めの読み込み（mode 'work2'・A27）：返事の、機長の勤務・拘束時間だけが違う。目盛が集まった値に合わせて動けば、機長の乗務時間の帯が動く。
         目盛の話は幅によらないので、幅 390 の1回だけ。 */
      if (w === 390) {
        const d2 = WORK_FIX2.cap.duty_hours, Z = await load('work2', '2回めの読み込み', p => p.evaluate(monthSee));
        say(tag, `2回めの読み込み（返事の、機長の勤務・拘束時間だけが ${d2.lo}〜${d2.hi}）でも、機長の乗務時間の帯は同じ位置・同じ長さ（目盛は集まった値で動かない）`, Z, R => {
          const at = X => { const r = rowOf(X, 'block_hours', 'cap'); return r && r.band ? r.band : null; }, a = at(O.x), z = at(R.x), dh = rowOf(R.x, 'duty_hours', 'cap');
          return [
            ...(!dh || dh.n !== `${d2.lo}〜${d2.hi}` ? [`2回めの機長の勤務・拘束時間「${dh ? dh.n : '無し'}」（返事が替わっていない）`] : []),
            ...(!a || !z ? [`機長の乗務時間の帯が${a ? '' : '1回めに'}${z ? '' : '2回めに'}無い`]
              : Math.abs(a.l - z.l) > 0.5 || Math.abs(a.w - z.w) > 0.5 ? [`帯 1回め 左 ${a.l.toFixed(1)}・長さ ${a.w.toFixed(1)}px ／ 2回め 左 ${z.l.toFixed(1)}・長さ ${z.w.toFixed(1)}px`] : []),
          ];
        });
      }
    }
    /* B8 自分の会社への回答が足りない人（給与の鍵は生きている・ほかの会社のページ）：集計・補足・月の勤務の口は、どれも 'give'。
       月の勤務の欄にだけ、1行と答えるカード1枚。通勤と Staff Travel は同じ1行だけ。字は、偽のサーバーの返事（giveBody）から作る。 */
    {
      const tag = `${s} ${w}（勤務・訓練・自分の会社への回答が足りない人）`, V = await load('give', '回答が足りない人');
      const g = JSON.parse(giveBody('give', s)), gLine = GIVE_LINE(g.need), gHead = GIVE_HEAD(g.name), gCount = GIVE_COUNT(g.have, g.need);
      say(tag, `月の勤務の欄は「${gLine}」の1行と、答えるカード1枚（「${gHead}」「${gCount}」・入口は「${GIVE_GO}」の1つ）`, V, R => {
        const x = pick(R, 'work');
        if (!x) return ['月の勤務の欄が無い'];
        const b = [], c = x.cards[0];
        if (x.state !== 'locked' || !x.on) b.push(`月の勤務が ${x.state}${x.on ? '' : '・見えていない'}`);
        if (!same(x.lock, [gLine])) b.push(`1行「${x.lock.join('｜')}」（あるべき「${gLine}」）`);
        if (x.cards.length !== 1 || !c.on) b.push(`答えるカードが ${x.cards.length}枚${c && !c.on ? '（見えていない）' : ''}`);
        if (c && (!same(c.head, [gHead]) || !same(c.count, [gCount]))) b.push(`カードの字「${[...c.head, ...c.count].join('｜')}」`);
        if (x.links.length !== 1 || !(x.links[0].on && x.links[0].cta && x.links[0].give && x.links[0].text === GIVE_GO)) b.push(`入口「${x.links.map(a => a.text).join('｜') || '無し'}」`);
        if (x.text !== squash(gLine + gHead + gCount + GIVE_GO)) b.push(`1行とカードのほかの字が在る「${x.text.slice(0, 80)}」`);
        return b;
      });
      say(tag, `通勤・Staff Travel の集計の欄は「${gLine}」の1行だけ（答えるカードも、リンクも、回答の行も無い）`, V, R => LOUD.flatMap(sf => {
        const x = pick(R, 'fact', sf);
        if (!x) return [`${nm(sf)}が無い`];
        return x.state !== 'locked' || !x.on || !same(x.lock, [gLine]) || x.text !== squash(gLine) || x.cards.length || x.links.length || x.rows.length
          ? [`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}「${x.text.slice(0, 50)}」（カード ${x.cards.length}・リンク ${x.links.map(a => a.text).join('｜') || '0'}・行 ${x.rows.length}）`] : [];
      }));
      say(tag, QUIET_LABEL[0], V, quietShown);
      say(tag, QUIET_LABEL[1], V, quietText);
      say(tag, QUIET_LABEL[2], V, quietHead);
      say(tag, SCOPE_LABEL, V, scopeOn);
      say(tag, `タブに見えている答えるカードは1枚だけ ── 「${LOGIN_GO}」も「${PAY_GO}」も見えていない・回答の行も月の勤務の棒も、ページに無い`, V, R => [
        ...(R.page.give !== 1 ? [`見えている答えるカードが ${R.page.give}枚`] : []),
        ...(R.page.login ? [`見えている「${LOGIN_GO}」が ${R.page.login}つ`] : []),
        ...(R.page.pay ? [`見えている「${PAY_GO}」が ${R.page.pay}つ`] : []),
        ...(R.page.facts ? [`回答の行が ${R.page.facts}つ`] : []),
        ...(R.page.wb ? [`月の勤務の棒の部品が ${R.page.wb}つ`] : []),
      ]);
    }
    /* B5 読めない時（どの口も 500）：月の勤務と4つの集計の欄は「いま読み出せません」＋「やり直す」（黙る2つの欄も、鍵の形でないので見えている）。
       集計の口が無い時（集計の口だけ 404）：4つの集計の欄は見えていて「準備中」だけ・添え書きは出さない（開くものがまだ無い）。 */
    {
      const tag = `${s} ${w}（勤務・訓練・読めない時）`, E = await load('off', '読めない時');
      say(tag, `月の勤務と4つの集計の欄は、どれも見えていて「${GIVE_ERR}」と「${GIVE_RETRY}」（黙る2つの欄も）`, E, R => [null, ...FOUR].flatMap(sf => {
        const x = pick(R, sf ? 'fact' : 'work', sf);
        return !x ? [`${nm(sf)}が無い`] : !x.on || x.state !== 'error' || x.text !== squash(GIVE_ERR + GIVE_RETRY) || x.retry !== 1 ? [`${nm(sf)}が ${x.state}${x.on ? '' : '・見えていない'}「${x.text.slice(0, 40)}」`] : [];
      }));
    }
    {
      const tag = `${s} ${w}（勤務・訓練・集計の口が無い時）`, F = await load('facts404', '集計の口が無い時');
      say(tag, `4つの集計の欄は、どれも見えていて「${FACT_OFF}」だけ（黙る2つも）──「${FACT_NONE}」と書かない・数字もリンクも無い`, F, R => FOUR.flatMap(sf => {
        const x = pick(R, 'fact', sf);
        if (!x) return [`${nm(sf)}が無い`];
        const b = [];
        if (!x.on) b.push(`${nm(sf)}が見えていない（${x.state}）`);
        if (x.text !== FACT_OFF) b.push(`${nm(sf)}の字「${x.text.slice(0, 40)}」（あるべき「${FACT_OFF}」だけ）`);
        if (x.text.includes(FACT_NONE)) b.push(`${nm(sf)}に「${FACT_NONE}」`);
        if (NO_NUM.test(x.text)) b.push(`${nm(sf)}に数字`);
        if (x.links.length) b.push(`${nm(sf)}にリンクが ${x.links.length}つ`);
        return b;
      }));
      say(tag, `板の添え書き「${SCOPE}」は見えていない（つながっていない回答を「同じ条件で開きます」と言わない）`, F, R => (!R.scope ? ['添え書きが無い'] : R.scope.on ? [`添え書きが見えている「${R.scope.text}」`] : []));
    }
  } catch (e) {
    ok(false, `${s} ${w}（勤務・訓練）: 最後まで測れた`, String(e && e.message).slice(0, 300));
  }
}
/* 開いている人で、集めたものが何も無い時（場面 work0）。中身は runWork の1か所。 */
async function runWork0(browser, s, v) { return runWork(browser, s, v, 'work0'); }
/* B6' 月の勤務の枠の大きさ（場面 work・開いている人 ＝ mode 'work'）。1つのページを開き、幅だけを CARD_W の12通りに変えて測る
   （container query は、幅を変えた瞬間に効く）。どの幅でも：帯の軸は 96px 以上で、面のどの軸も同じ長さ（同じ目盛の帯を見比べられる）・
   数字／単位／職位の名前と板の入口の字が切れない（scrollWidth ≦ clientWidth）・枠と面の外へ出ない・板と面とページが横にあふれない。
   ★軸のいちばん短い長さ（96px）は career-live.css の1か所。列の幅を変えた時に、ここが落ちる。
   列の数・軸が数字の行に在るか・面が2列ぶんに広がるかは形の話で、ここでは測らない（組んだ時に目で見た）。 */
async function runWorkSizes(browser, s) {
  const tag = `${s}（勤務・訓練・月の勤務の枠の大きさ）`, widths = CARD_W.filter(w => !WANT_W || WANT_W.includes(w));
  if (!widths.length) return;
  const { ctx, p, ready } = await open(browser, s, 390, 680, 'work');
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 15000 }, ...a).then(() => true, () => false);
  /* ページの中で動く（外の変数を1つも使わない） */
  const measure = () => {
    const P = document.getElementById('pvg-p-work'), M = P && P.querySelector('section.pvg-sf[data-sf="month"]'), R = [];
    if (!M || !M.querySelector('.crl-wb')) return ['月の勤務の枠が無い'];
    const vis = e => e.getClientRects().length > 0, t = e => e.textContent.replace(/\s+/g, '').slice(0, 24);
    const len = [...M.querySelectorAll('.crl-wb-tr')].filter(vis).map(e => e.getBoundingClientRect().width);
    if (!len.length) R.push('帯の軸が1本も見えていない');
    else {
      const lo = Math.min(...len), hi = Math.max(...len);
      if (lo < 96 - 0.01) R.push(`帯の軸が 96px より短い（${lo.toFixed(2)}px）`);
      if (hi - lo > 0.5) R.push(`面の軸の長さがそろわない（${lo.toFixed(1)}〜${hi.toFixed(1)}px）`);
    }
    for (const e of P.querySelectorAll('.crl-wb-n, .crl-wb-u, .crl-wb-p, .pvg-sf-add a')) {
      if (!vis(e)) continue;
      const host = e.closest('.crl-wb-c') || e.closest('.pvg-sf'), r = e.getBoundingClientRect(), h = host.getBoundingClientRect();
      if (e.scrollWidth > e.clientWidth) R.push(`切れ ${e.className}「${t(e)}」${e.scrollWidth} > ${e.clientWidth}`);
      if (r.left < h.left - 0.5 || r.right > h.right + 0.5) R.push(`${host.classList.contains('crl-wb-c') ? '枠' : '面'}の外へ出る ${e.className}「${t(e)}」`);
    }
    for (const e of [P, ...P.querySelectorAll('.pvg-sf')]) if (vis(e) && e.scrollWidth > e.clientWidth + 1) R.push(`横にあふれる ${e.id || e.className}（${e.scrollWidth} > ${e.clientWidth}）`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) R.push(`ページが横にあふれる（${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}）`);
    return R;
  };
  const bad = [];
  try {
    if (!ready) bad.push('「読み込み中」のまま固まる');
    else {
      await p.evaluate(() => document.querySelector('.pvg-tabs [data-pvg-tab="work"]').click());
      const at = await until(() => !!window.PVGlance && window.PVGlance.at() === 'work' && document.body.classList.contains('pvg-at-work'));
      if (!(at && (await until(SETTLED)))) bad.push('「勤務・訓練」へ移れない・欄が落ち着かない');
      else for (const w of widths) {
        /* 端末の種類は開いた時のまま（変えるとページが読み直される）。変えるのは幅だけ */
        await p.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        if (!(await until(w => document.documentElement.clientWidth === w, w))) { bad.push(`幅 ${w}: 画面の幅が変わらない`); continue; }
        await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        for (const x of (await p.evaluate(measure)).slice(0, 4)) bad.push(`幅 ${w}: ${x}`);
      }
    }
  } catch (e) {
    bad.push(`最後まで測れない（${String(e && e.message).slice(0, 200)}）`);
  } finally {
    await ctx.close().catch(() => {});
  }
  ok(!bad.length, `${tag}: 幅 ${widths.join('・')} のどれでも ── 帯の軸は 96px 以上で、面のどの軸も同じ長さ・数字／単位／職位の名前と板の入口の字が切れない・枠と面の外へ出ない・板が横にあふれない`, bad.slice(0, 12).join('\n      '));
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
          /* 入口（data-crs-entry）のほかの部品の数と、入口の並び（種類・字・行き先）。鍵の1行に添えてよいのは、ログインの鍵が無い人の「ログイン」1つだけ。 */
          extra: slot.querySelectorAll('img, form, input, button, a[href]:not([data-crs-entry])').length, who: slot.getAttribute('data-who'),
          entry: [...slot.querySelectorAll('a[href][data-crs-entry]')].map(a => [a.getAttribute('data-crs-entry'), a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href')]),
          hash: location.hash, at: window.PVGlance.at(), top: Math.round(r.top), over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const LOCK = 'Only VERIFIED PILOT';
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
        /* 見てよい人でない人（ここは未ログイン）：ホテルの欄は鍵の1行と、入口「ログイン」の1つだけ。名前も写真も入力欄も出ない。
           ログインの行き先は、この会社ページのこの都市へ戻る住所。給与の提出への入口は置かない（給与ではホテルは開かない）。 */
        const back = `login.html?redirect=${encodeURIComponent(`airlines/${s}.html`)}${encodeURIComponent(`#stay-${pick.iata}`)}`;
        const one1 = c.entry.length === 1 && c.entry[0][0] === 'login' && c.entry[0][1] === 'ログイン' && String(c.entry[0][2]).endsWith(back);
        if (!(c.state === 'locked' && c.who === 'login' && c.slot === LOCK + 'ログイン' && one1 && c.extra === 0)) bad.push(`ホテルの欄が鍵の1行と入口1つ（ログイン）になっていない（${c.state}・${c.who}・${c.slot.slice(0, 40)}・入口 ${JSON.stringify(c.entry)}・ほかの部品 ${c.extra}）`);
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
      ok(!bad.length, `${tag}: ステイ先 ── 都市を押す → 詳細（字・写真・クレジット・Google Maps が台帳のまま／ホテルの欄は鍵の1行と入口1つ）→ 戻る・進む／住所で直接開く／一覧に無い3字は一覧のまま`, bad.join(' ／ '));
      /* ── 3b-member) ログインの鍵が在る人（会員。中身の読めない鍵でも同じ）：ホテルの欄は鍵の1行だけ。ログインの入口も
            給与の提出の入口も、確認の申し込みも添えない（ログインはもう済んでいる・給与の提出ではホテルは開かない・
            見てよい人はオーナーが決める ＝ 申し込みの口 pv_stay_viewer_request を呼ばない。2026-10-16 オーナー）。
            ★偽のサーバーは、呼ばれたら「まだ申し込んでいない」（'none'）と答える用意をしておく（呼んでしまう版では、ボタンが出る）。
            2つ目の都市を開いてから見る（1つ目の都市で呼んでいれば、そのころにはもう偽のサーバーに届いている）。
            鍵は開いたあとに置く（登録だけの会員に出す板を呼ばない）。 ── */
      {
        const KEY = 'sb-check-auth-token', mb = [], two = [pick.iata, net.list.find(d => d.iata !== pick.iata).iata];
        await fresh(`${url}#stay`);
        if (!((await atTab('stay')) && (await cityIs('')))) mb.push('ステイ先のタブが一覧で開かない');
        await p.evaluate(k => localStorage.setItem(k, '{}'), KEY);
        seen.vreq = '{"ok":true,"state":"none"}';
        const v0 = seen.vreqd.length;
        try {
          for (const code of two) {
            if (!((await tap(`#pvg-st-list .pvg-city[data-city="${code}"]`)) && (await cityIs(code)))) { mb.push(`${code} を押しても詳細にならない`); break; }
            const m = await cityRead();
            if (!(m.state === 'locked' && m.who === 'member' && m.slot === LOCK && m.parts === 0 && m.extra === 0 && !m.entry.length)) mb.push(`${code}：会員のホテルの欄が鍵の1行だけになっていない（${m.state}・${m.who}・${m.slot.slice(0, 40)}・入口 ${JSON.stringify(m.entry)}・部品 ${m.parts}）`);
            if (code === two[0] && !((await tap('#pvg-city [data-pvg-cityback]')) && (await cityIs('')))) { mb.push('一覧へ戻れない'); break; }
          }
          if (seen.vreqd.length !== v0) mb.push(`申し込みの口を ${seen.vreqd.length - v0}回呼んだ（${seen.vreqd.slice(v0, v0 + 2).join(' ')}）`);
        } finally {
          await p.evaluate(k => localStorage.removeItem(k), KEY);
          seen.vreq = null;
        }
        ok(!mb.length, `${tag}: ステイ先 ── ログインの鍵が在る人のホテルの欄は、鍵の1行だけ（ログインも給与の提出も確認の申し込みも添えない・申し込みの口を呼ばない）`, mb.join(' ／ '));
      }
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
          rej: !!e.querySelector('[data-act="rej"]'), say: say ? say.textContent.trim() : '', parts: e.querySelectorAll('img, a[href], form, input, button').length,
          /* 入口（data-crs-entry）のほかの部品の数と、入口の種類の並び。鍵が消えた人の欄に在ってよいのは「ログイン」の1つだけ。 */
          extra: e.querySelectorAll('img, form, input, button, a[href]:not([data-crs-entry])').length,
          entry: [...e.querySelectorAll('a[href][data-crs-entry]')].map(a => a.getAttribute('data-crs-entry')).join(' ') };
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
        if (r.text.includes(NAME) || r.extra || r.entry !== 'login') bad.push(`鍵が消えたあとの欄に、ホテル名か部品が残る（部品 ${r.extra}・入口「${r.entry}」── 在ってよいのは「ログイン」の1つだけ）`);
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
          if (r.text.includes(NAME) || r.extra || r.entry !== 'login') bad.push(`戻ってきた時の欄に、ホテル名か部品が残る（部品 ${r.extra}・入口「${r.entry}」── 在ってよいのは「ログイン」の1つだけ）`);
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
      /* 都市を開いたまま「情報を追加」→ ホテル・ステイ：面が閉じ、同じ都市のまま（一覧へ戻さない）・焦点は「ホテルを追加」・
         そのボタンが画面に入っている（時間では待たない）。狭い幅の1回だけ（390）。
         一覧に居る時は閉じるだけ（焦点は開いたボタンへ）── assert-contrib.mjs の場面が見ている。 */
      if (w === 390) {
        const code = networkOf(s).list[0].iata, miss = [];
        await fresh(`${url}#stay`);
        const opened = (await atTab('stay')) && (await tap(`#pvg-st-list .pvg-city[data-city="${code}"]`)) && (await until(c => {
          const e = document.querySelector('#pvg-city .crl[data-live="hotels"]');
          return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === c && !/^(idle|loading)$/.test(e.dataset.state) && !!document.querySelector('#pvg-city .crs-ent');
        }, code));
        if (!opened) miss.push(`${code} の詳細が開かない`);
        else if (!((await tap('.pvg-tabbar .pvg-add')) && (await sheetIs('list')))) miss.push('都市を開いたまま、話題の一覧が開かない');
        else if (!((await tap('.pvc-root [data-pvc-tile="stay"]')) && (await sheetIs('closed')))) miss.push('ホテル・ステイを押しても面が閉じない');
        else {
          const inView = await until(() => {
            const a = document.activeElement;
            if (!a || !a.matches('#pvg-city .crs-ent[data-kind="hotel"]')) return false;
            const r = a.getBoundingClientRect();
            return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
          });
          const r = await p.evaluate(() => {
            const a = document.activeElement, box = document.getElementById('pvg-city'), e = box && box.querySelector('.crl[data-live="hotels"]');
            const ar = a ? a.getBoundingClientRect() : null, vis = x => !!x && x.getClientRects().length > 0;
            return { hash: location.hash, at: window.PVGlance.at(), city: window.PVGlance.city(), box: vis(box) && !vis(document.getElementById('pvg-stay')),
              stay: e ? e.getAttribute('data-stay') : '', focus: a ? `${a.getAttribute('data-kind') || a.tagName} ${a.textContent.trim()}` : '',
              y: ar ? [Math.round(ar.top), Math.round(ar.bottom)] : null, vh: innerHeight };
          });
          if (!(inView && r.hash === `#stay-${code}` && r.at === 'stay' && r.city === code && r.box && r.stay === code && r.focus === 'hotel ホテルを追加')) miss.push(JSON.stringify(r));
        }
        ok(!miss.length, `${tag}: 都市を開いたまま「情報を追加」→ ホテル・ステイ ── 面が閉じ、同じ都市のまま（#stay-<空港>）・焦点は「ホテルを追加」・そのボタンが画面に入っている`, miss.join(' ／ '));
        await fresh(url);
        await atTab('overview');
      }
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
    /* ── 5b) T7「勤務・訓練」の6つの入口 ── どれも、読む人に見えている字のとおりの話題を開く。
       入口は字で探す（ページが書いている data-pvc-open では探さない ＝「通勤の条件を追加」が Staff Travel を開いても気づける）。
       字と話題の対は、ここに書いた表（設計の「入口」の表のとおり）。押す → その話題の入力が開く → 会社を選び直させない →
       希望休は、その質問の所から開く → × で閉じる → 「勤務・訓練」に居たまま。 */
    {
      const WANT = [['勤務時間を追加', 'work', ''], ['希望休の条件を追加', 'roster', 'days_off_request'], ['通勤の条件を追加', 'taxi', ''],
        ['Staff Travel の条件を追加', 'staff_travel', ''], ['昇格の条件を追加', 'upgrade', ''], ['訓練・キャリアの条件を追加', 'career', '']];
      const bad = [];
      if (!((await tap('.pvg-tabs [data-pvg-tab="work"]')) && (await atTab('work')))) bad.push('「勤務・訓練」へ移れない');
      else for (const [label, topic, q] of WANT) {
        /* 字が同じ入口を、板の入口の行から全部拾う。押すための住所は、見つけた入口そのものから作る（面の名前と、行の中の何番め）。 */
        const hit = await p.evaluate(label => [...document.querySelectorAll('#pvg-p-work .pvg-sf-add a')].filter(a => a.textContent.trim() === label).map(a => {
          const sf = a.closest('.pvg-sf'), sel = `#pvg-p-work .pvg-sf[data-sf="${sf ? sf.getAttribute('data-sf') : ''}"] .pvg-sf-add > a:nth-child(${[...a.parentElement.children].indexOf(a) + 1})`;
          return { open: a.getAttribute('data-pvc-open') || '', q: a.getAttribute('data-pvc-q') || '', sel: document.querySelector(sel) === a ? sel : '' };
        }), label);
        if (hit.length !== 1 || !hit[0].sel) { bad.push(`「${label}」の入口が ${hit.length}つ`); continue; }
        const a = hit[0];
        if (a.open !== topic) bad.push(`「${label}」の入口が開く話題「${a.open}」（あるべき「${topic}」）`);
        if (a.q !== q) bad.push(`「${label}」の入口が指す質問「${a.q}」（あるべき「${q}」）`);
        if (!((await tap(a.sel)) && (await sheetIs(topic)))) bad.push(`「${label}」を押しても「${topic}」の入力が開かない`);
        else {
          const r = await see();
          if (!r.sheet || r.sheet.pick) bad.push(`「${label}」の入力で、会社を選び直させている`);
          if (q) {
            const at = await p.evaluate(q => {
              const box = document.querySelector(`.pvc-root form [data-q="${q}"]`), mn = document.querySelector('.pvc-root .pvc-main');
              if (!box || !mn) return false;
              const r = box.getBoundingClientRect(), m = mn.getBoundingClientRect();
              return box.getClientRects().length > 0 && r.top < m.bottom && r.bottom > m.top;
            }, q);
            if (!at) bad.push(`「${label}」で開いた入力に、質問 ${q} が見えていない`);
          }
        }
        if ((await see()).sheet && !((await tap('.pvc-root .pvc-close')) && (await sheetIs('closed')))) bad.push(`「${label}」で開いた入力が × で閉じない`);
        const r = await see();
        if (r.at !== 'work') bad.push(`「${label}」の入力を閉じたあと「勤務・訓練」に居ない（${r.at}）`);
      }
      ok(!bad.length, `${tag}: 「勤務・訓練」の6つの入口は、どれも字のとおりの話題の入力を開く（字で探す・会社を選び直させない・希望休はその質問の所から）・閉じても「勤務・訓練」に居る`, bad.join(' ／ '));
    }
    /* ── 5c) B7 ほかのタブから「勤務・訓練」への案内（狭い幅と広い幅の1つずつ：390・1440）──
       給与・待遇の、待遇の板の頭の1行の「勤務・訓練で見る」（その行 .pvg-moved を持つページだけ）。
       案内は字で探す（見えている1つ）。押す →「勤務・訓練」が選ばれ・板が見え・住所が #work → 戻る → 押す前のタブ。 */
    if (w === 390 || w === 1440) {
      const bad = [];
      for (const [from, host, label] of [['pay', '.pvg-moved', '勤務・訓練で見る']]) {
        if (!((await tap(`.pvg-tabs [data-pvg-tab="${from}"]`)) && (await atTab(from)))) { bad.push(`「${TAB_NAME[from]}」へ移れない`); continue; }
        const hit = await p.evaluate((host, label) => {
          const on = e => e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
          const a = [...document.querySelectorAll('a')].filter(e => on(e) && e.textContent.trim() === label), sel = `${host} > a.pvg-link`, one = document.querySelectorAll(sel);
          return { n: a.length, has: !!document.querySelector(host), sel: a.length === 1 && one.length === 1 && one[0] === a[0] ? sel : '' };
        }, host, label);
        if (from === 'pay' && !hit.has) continue;
        if (hit.n !== 1 || !hit.sel) { bad.push(`「${TAB_NAME[from]}」に見えている「${label}」が ${hit.n}つ${hit.n === 1 ? '（案内の行の中に無い）' : ''}`); continue; }
        if (!((await tap(hit.sel)) && (await atTab('work')))) { bad.push(`「${label}」を押しても「勤務・訓練」にならない（${(await see()).at}）`); continue; }
        const r = await see(FACE.work);
        if (!(r.cur.join() === 'work' && r.hash === '#work' && !r.hid.length && !r.out.length)) bad.push(`「${label}」を押したあと ── 選んだ印「${r.cur.join()}」・住所 ${r.hash}・出ていない ${r.hid.join(' ') || '無し'}・出ている ${r.out.join(' ') || '無し'}`);
        await p.goBack();
        if (!(await atTab(from))) bad.push(`「${label}」で来たあとの「戻る」が「${TAB_NAME[from]}」にならない（${(await see()).at}）`);
      }
      ok(!bad.length, `${tag}: 給与・待遇の「勤務・訓練で見る」── 押すと「勤務・訓練」のタブ（選んだ印・板・住所 #work）・戻るで押す前のタブ`, bad.join(' ／ '));
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

/* ── ステイ先のホテルの欄：五つの状態と、返事の来ない読み出し（場面 stay）──
   偽のサーバーが都市ごとの読み出し（pv_stays）に返す答えを、場面の中で差し替える（seen.stay・seen.stayStatus・seen.stayStall）。
   ・まだつながっていない（関数が無い 404・この会社か空港が保存先に無い bad_iata）＝「準備中」。やり直しの言葉は出さない。
     覚えない ＝ 同じ都市を開き直すと、もう一度聞く。
   ・0件 ＝ 今ある2つの文。読めない（500）＝「読み込めませんでした」＋「もう一度」。鍵の1行は、タブの場面の 3b（未ログイン）・3b-member（会員）。
   ★「見られない」の答えが来たら、ほかの都市で持っていた開いた答えを全部捨てる（承認を取り消された人の画面に、
     前に開いていた都市の一覧を残さない）。ログインの鍵は在るまま ＝ 鍵が消えた時の網（forgetIfGone）とは別の道を見る。
   ・返事が来ない読み出しは、待ちの絵のあと STAY_WAIT（career-stay.js の値）で「読み込めませんでした」になる。待つあいだに聞き直さない。
     本当に待つ（時計を進めない）ので、1社・1つの幅だけで流す。
   ⚠️ 出すホテルは架空（検査の中だけ・どこにも保存しない）。 */
const STAY_W = [390];
const STAY_SLOT = '#pvg-city .crl[data-live="hotels"]';
/* 欄の外の面（入口・一言・追加の面）。欄のすぐ後ろの兄弟。入口の3つは、どの状態でもこの字で並ぶ。 */
const STAY_ZONE = `${STAY_SLOT} + .crs-zone`;
const STAY_ENTS = 'hotel ホテルを追加 ／ food レストランを追加 ／ spot 場所を追加';
const STAY_NAME = '検査用の架空のホテル', STAY_PID = '00000000-0000-4000-8000-0000000000b2';
const STAY_OPEN = JSON.stringify({ ok: true, state: 'open', can_add: true, is_operator: false, others: [],
  places: [{ id: STAY_PID, kind: 'hotel', name: STAY_NAME, address: '架空の住所 4-5-6', state: 'public', mine: false, photos: [] }] });
const STAY_EMPTY = JSON.stringify({ ok: true, state: 'open', can_add: true, is_operator: false, places: [], others: [] });
const STAY_LOCKED = '{"ok":true,"state":"locked"}';
const STAY_404 = '{"code":"PGRST202","details":null,"hint":null,"message":"Could not find the function public.pv_stays(p) in the schema cache"}';
function stayKit(p, s) {
  const url = `${BASE}/airlines/${s}.html`;
  const until = (fn, ms, ...a) => p.waitForFunction(fn, { timeout: ms }, ...a).then(() => true, () => false);
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
  const list = () => until(() => { const v = e => !!e && e.getClientRects().length > 0; return !!window.PVGlance && window.PVGlance.at() === 'stay' && v(document.getElementById('pvg-stay')) && !v(document.getElementById('pvg-city')); }, 8000);
  /* 欄がその都市のその状態になるまで待つ（時間では待たない）。 */
  const slotIs = (code, state, ms = 8000) => until((sel, code, state) => {
    const e = document.querySelector(sel);
    return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code && e.dataset.state === state;
  }, ms, STAY_SLOT, code, state);
  const look = () => p.evaluate(sel => {
    const e = document.querySelector(sel), t = q => { const x = e.querySelector(q); return x ? x.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { state: e.dataset.state, who: e.getAttribute('data-who'), text: e.textContent.replace(/\s+/g, ' ').trim(),
      retry: e.querySelectorAll('[data-act="retry"]').length, skel: !!e.querySelector('.crs-skel'),
      extra: e.querySelectorAll('img, form, input, button, a[href]:not([data-crs-entry])').length, entry: e.querySelectorAll('a[data-crs-entry]').length,
      emptyT: t('.crs-empty-t'), emptyS: t('.crs-empty-s') };
  }, STAY_SLOT);
  const fresh = async () => { await p.goto('about:blank'); await p.goto(`${url}#stay`, { waitUntil: 'load', timeout: 60000 }); return list(); };
  /* 都市を開いて、欄がその状態になるのを待つ。一覧へ戻る。 */
  const city = async (code, state, ms) => (await tap(`#pvg-st-list .pvg-city[data-city="${code}"]`)) && (await slotIs(code, state, ms));
  const back = async () => (await tap('#pvg-city [data-pvg-cityback]')) && (await list());
  /* 欄の外の面：見えている入口（種類と字）・一言・開いている追加の面の中身・焦点の在りか・カードが読む印の数。 */
  const zone = () => p.evaluate(sel => {
    const s = document.querySelector(sel), z = s && s.nextElementSibling;
    if (!z || !z.classList.contains('crs-zone')) return null;
    const vis = e => !!e && e.getClientRects().length > 0, tx = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    const f = z.querySelector('.crs-formbox > .crs-form'), act = document.activeElement;
    return {
      ents: [...z.querySelectorAll('.crs-ent')].filter(vis).map(b => `${b.getAttribute('data-kind')} ${tx(b)}`).join(' ／ '),
      say: tx(z.querySelector('.crs-zone-say')), form: !!f, row: vis(z.querySelector('.crs-ents')),
      kind: f ? ((f.querySelector('input[type="radio"]:checked') || {}).value || '') : '',
      ctx: f && f.firstElementChild && f.firstElementChild.classList.contains('crs-ctx') ? [...f.firstElementChild.children].map(tx) : [],
      photo: !!(f && f.querySelector('.crs-pf, [data-pick]')), hours: !!(f && vis(f.querySelector('.crs-hf'))),
      fsay: f ? tx(f.querySelector('.crs-form-say')) : '', name: f ? ((f.querySelector('[data-k="name"]') || {}).value || '') : '',
      focus: act && act.closest && act.closest('.crs-zone') === z ? (act.getAttribute('data-kind') || act.getAttribute('data-k') || act.tagName) : '',
      marks: [z, ...z.querySelectorAll('*')].reduce((n, e) => n + [...e.attributes].filter(a => /^data-(main|lim)/.test(a.name)).length, 0) + z.querySelectorAll('.cr-sub, .cr-axis').length,
      city: s.getAttribute('data-city') || '',
    };
  }, STAY_SLOT);
  /* 欄の外の一言が、その字になるまで待つ。 */
  const zsayIs = (text, ms = 8000) => until((sel, t) => {
    const s = document.querySelector(sel), z = s && s.nextElementSibling, q = z && z.querySelector('.crs-zone-say');
    return !!q && q.textContent.trim() === t;
  }, ms, STAY_SLOT, text);
  return { until, tap, list, slotIs, look, fresh, city, back, zone, zsayIs };
}
async function runStay(browser, s, [w, h]) {
  const tag = `${s} ${w}（ホテルの欄の状態）`;
  const { ctx, p, ready, seen } = await open(browser, s, w, h, 'empty');
  const K = stayKit(p, s);
  try {
    ok(ready, `${tag}: 開ける`);
    const net = networkOf(s), [A, B, C, D, E, F] = net.list.map(x => x.iata);
    if (!F) { ok(false, `${tag}: 就航地が6つ以上ある会社で見る`, `${net.list.length}空港`); return; }
    /* S-c の前半：どの状態でも、欄の外に入口の3つが同じ字で並ぶ（S-a の各状態と、下の S-c で見る）。zb に溜めて、S-c の行で出す。 */
    const zb = [];
    const ents = async at => { const z = await K.zone(); const got = z ? z.ents : '面が無い'; if (got !== STAY_ENTS) zb.push(`${at}：欄の外の入口が3つそろわない（${got}）`); return z; };
    /* S-a 五つの状態（鍵の1行は、タブの場面の 3b・3b-member が見る） */
    {
      const bad = [];
      if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
      /* まだつながっていない：関数が無い（404）。「準備中」だけ・やり直しの言葉なし。開き直すと、もう一度聞く（覚えていない）。 */
      seen.stay = STAY_404; seen.stayStatus = 404;
      if (!(await K.city(A, 'off'))) bad.push(`${A}：関数が無い時に「準備中」にならない（${(await K.look()).state}）`);
      else {
        const r = await K.look();
        if (!(r.text === '準備中' && !r.retry && !r.extra && !r.entry)) bad.push(`${A}：関数が無い時の欄が「準備中」だけでない（「${r.text}」・もう一度 ${r.retry}・部品 ${r.extra}・入口 ${r.entry}）`);
        /* つながっていない時に入口を押す ＝ 欄の外の一言が「準備中」・追加の面は開かない（保存できないものを打たせない）。 */
        await ents(`${A} 準備中`);
        if (!(await K.tap(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`))) zb.push(`${A}：準備中の時に「ホテルを追加」を押せない`);
        else if (!(await K.zsayIs('準備中')) || (await K.zone()).form) zb.push(`${A}：準備中の時に押すと、一言が「準備中」でない・追加の面が開く（「${(await K.zone()).say}」）`);
        const a0 = seen.stays;
        if (!((await K.back()) && (await K.city(A, 'off')))) bad.push(`${A}：開き直すと「準備中」にならない`);
        else if (seen.stays - a0 !== 1) bad.push(`${A}：「準備中」を覚えている（開き直して聞いた回数 ${seen.stays - a0}、1回のはず）`);
      }
      if (!(await K.back())) bad.push('一覧へ戻れない');
      /* この会社・この空港が保存先に無い（bad_iata）も「準備中」（読めなかったのでも、0件でもない）。 */
      seen.stay = '{"ok":false,"status":"bad_iata"}'; seen.stayStatus = 200;
      if (!(await K.city(B, 'off'))) bad.push(`${B}：保存先に無い空港（bad_iata）が「準備中」にならない（${(await K.look()).state}）`);
      else { const r = await K.look(); if (!(r.text === '準備中' && !r.retry && !r.extra && !r.entry)) bad.push(`${B}：bad_iata の欄が「準備中」だけでない（「${r.text}」・もう一度 ${r.retry}）`); await ents(`${B} bad_iata`); }
      if (!(await K.back())) bad.push('一覧へ戻れない');
      /* 0件：今ある2つの文。 */
      seen.stay = STAY_EMPTY;
      if (!(await K.city(C, 'empty'))) bad.push(`${C}：0件の時に空の形にならない（${(await K.look()).state}）`);
      else { const r = await K.look(); if (!(r.emptyT === '泊まったホテルを、次のパイロットへ。' && r.emptyS === 'ホテルの名前だけでも追加できます。確認のあと公開されます。')) bad.push(`${C}：0件の2つの文が違う（「${r.emptyT}」「${r.emptyS}」）`); await ents(`${C} 0件`); }
      if (!(await K.back())) bad.push('一覧へ戻れない');
      /* 読めない（500）：「読み込めませんでした」＋「もう一度」。 */
      seen.stay = '{"message":"stub"}'; seen.stayStatus = 500;
      if (!(await K.city(D, 'error'))) bad.push(`${D}：読めない時（500）に「読み込めませんでした」にならない（${(await K.look()).state}）`);
      else { const r = await K.look(); if (!(r.text === '読み込めませんでしたもう一度' && r.retry === 1 && r.extra === 1)) bad.push(`${D}：読めない時の欄が「読み込めませんでした」＋「もう一度」だけでない（「${r.text}」・もう一度 ${r.retry}・部品 ${r.extra}）`); await ents(`${D} 読めない`); }
      if (!(await K.back())) bad.push('一覧へ戻れない');
      seen.stay = null; seen.stayStatus = 200;
      ok(!bad.length, `${tag}: ホテルの欄の状態 ── つながっていない（404・bad_iata）は「準備中」だけ・覚えない／0件は今ある2つの文／読めない時は「読み込めませんでした」＋「もう一度」`, bad.join(' ／ '));
    }
    /* ★「見られない」の答えで、ほかの都市の開いた答えを全部捨てる（ログインの鍵は在るまま）。 */
    {
      const bad = [], KEY = 'sb-check-auth-token';
      await p.evaluate(k => localStorage.setItem(k, '{}'), KEY);
      try {
        seen.stay = STAY_OPEN;
        if (!(await K.city(E, 'open'))) bad.push(`${E} のホテルの欄が開かない`);
        else if (!(await K.look()).text.includes(STAY_NAME)) bad.push(`${E}：開いた欄にホテル名が無い`);
        if (!(await K.back())) bad.push('一覧へ戻れない');
        seen.stay = STAY_LOCKED;
        if (!(await K.city(F, 'locked'))) bad.push(`${F}：「見られない」の答えで鍵の1行にならない`);
        if (!(await K.back())) bad.push('一覧へ戻れない');
        const a0 = seen.stays;
        if (!(await K.city(E, 'locked'))) bad.push(`「見られない」の答えのあと、前に開いていた ${E} を選び直すと、開いていた時の一覧がそのまま出る（「${(await K.look()).text.slice(0, 40)}」）`);
        else {
          const r = await K.look();
          if (r.text.includes(STAY_NAME) || seen.stays - a0 !== 1) bad.push(`${E}：前の一覧が残る・聞き直さない（ホテル名 ${r.text.includes(STAY_NAME)}・聞いた回数 ${seen.stays - a0}）`);
        }
      } finally {
        await p.evaluate(k => localStorage.removeItem(k), KEY);
        seen.stay = null;
      }
      ok(!bad.length, `${tag}: ホテルの欄 ──「見られない」の答えが来たら、ほかの都市で開いていた答えも全部捨てる（選び直すと聞き直して鍵の1行。前の一覧を出さない）`, bad.join(' ／ '));
    }
    /* S-c 入口と追加の面（ログインしていない人）。足せない会社（can_add:false）で押す → 一言だけ。
       鍵の1行の都市で「レストランを追加」→ 面が欄の外に開く（会社・都市・3字が頭に・入口の列は隠れる・写真の欄は無い）→
       送る（中身を控える）→ 返事ごとの出し方（queue_full は面が残る／locked は「送信中…」のまま残らない／通れば面が閉じ、
       入口が戻り、押した入口に焦点が戻り、欄の外の一言が「追加しました。…」）。 */
    {
      const bad = [], sent = [];
      let measured = false;
      const NAME = '検査用の架空のレストラン', ITEM = { id: '00000000-0000-4000-8000-0000000000b3', kind: 'food', name: NAME, state: 'pending', mine: true, photos: [] };
      const CO = JSON.parse(read('pv-airlines.json')).airlines[s].ja;
      const SEND = `${STAY_ZONE} .crs-form button[type="submit"]`;
      const formIs = want => K.until((sel, want) => { const s = document.querySelector(sel), z = s && s.nextElementSibling; return !!z && !!z.querySelector('.crs-formbox > .crs-form') === want; }, 8000, STAY_SLOT, want);
      const fsayIs = text => K.until((sel, t) => { const s = document.querySelector(sel), z = s && s.nextElementSibling, q = z && z.querySelector('.crs-form-say'); return !!q && q.textContent.trim() === t; }, 8000, STAY_SLOT, text);
      if (!(await K.back())) bad.push('一覧へ戻れない');
      seen.stay = JSON.stringify({ ok: true, state: 'open', can_add: false, is_operator: false, others: [], places: JSON.parse(STAY_OPEN).places });
      if (!(await K.city(A, 'open'))) bad.push(`${A}：足せない会社の一覧が開かない（${(await K.look()).state}）`);
      else {
        await ents(`${A} 足せない会社`);
        if (!(await K.tap(`${STAY_ZONE} .crs-ent[data-kind="spot"]`))) bad.push(`${A}：「場所を追加」を押せない`);
        else if (!(await K.zsayIs('この就航地には、いま追加できません。')) || (await K.zone()).form) bad.push(`${A}：足せない会社で押すと、一言が違う・追加の面が開く（「${(await K.zone()).say}」）`);
      }
      if (!(await K.back())) bad.push('一覧へ戻れない');
      seen.stay = STAY_LOCKED;
      if (!(await K.city(B, 'locked'))) bad.push(`${B}：鍵の1行にならない`);
      else {
        let z = await ents(`${B} 鍵の1行`);
        if (!((await K.tap(`${STAY_ZONE} .crs-ent[data-kind="food"]`)) && (await formIs(true)))) bad.push(`${B}：「レストランを追加」で追加の面が開かない`);
        else {
          z = await K.zone();
          if (!(z.kind === 'food' && z.ctx.join('｜') === `${CO}｜${z.city}｜${B}` && z.city && !z.row && !z.photo && z.focus === 'name'))
            bad.push(`${B}：開いた面が違う（種類 ${z.kind}・頭「${z.ctx.join('｜')}」・都市「${z.city}」・入口の列 ${z.row}・写真の欄 ${z.photo}・焦点 ${z.focus}）`);
          sent.push(z.marks ? `欄の外の面に、カードが読む印（data-main／data-lim／cr-sub／cr-axis）が ${z.marks}個ある` : '');
          console.log(`  ・${s} ${w} 追加の面（レストラン）：ステイ時間の欄 ${z.hours ? '見えている' : '隠れている'}`);
          await p.type(`${STAY_ZONE} [data-k="name"]`, NAME);
          /* 返事 1：運営の確認待ちがいっぱい ＝ 面は残り、打った字もそのまま。 */
          seen.add = '{"ok":false,"status":"queue_full"}';
          await K.tap(SEND);
          if (!(await fsayIs('この就航地には、いま追加できません。')) || !(z = await K.zone()).form || z.name !== NAME) bad.push(`${B}：queue_full で面が残らない・一言が違う（「${(await K.zone()).fsay}」）`);
          /* 返事 2：資格が変わった ＝「送信中…」のまま残らない（欄は読み直す）。 */
          const a0 = seen.stays;
          seen.add = '{"ok":false,"status":"locked"}';
          await K.tap(SEND);
          if (!(await fsayIs('うまくいきませんでした。もう一度お試しください。')) || !(await K.zone()).form) bad.push(`${B}：locked の返事で「うまくいきませんでした。…」にならない（「${(await K.zone()).fsay}」）`);
          /* 読み直しの1本が届くまで待つ（時間では決めない：届いたら次へ。8秒で届かなければ落とす）。 */
          for (let i = 0; i < 80 && seen.stays - a0 < 1; i++) await new Promise(res => setTimeout(res, 100));
          if (!(await K.slotIs(B, 'locked'))) bad.push(`${B}：locked の返事のあと、欄が鍵の1行に戻らない`);
          else if (seen.stays - a0 !== 1) bad.push(`${B}：locked の返事のあと、欄を1回だけ読み直す（${seen.stays - a0}回）`);
          /* 返事 3：通った ＝ 面が閉じ、入口が戻り、押した入口に焦点が戻り、欄の外の一言が「追加しました。…」。 */
          seen.add = JSON.stringify({ ok: true, item: ITEM });
          await K.tap(SEND);
          if (!((await formIs(false)) && (await K.zsayIs('追加しました。確認のあと公開されます。')))) bad.push(`${B}：通ったあと面が閉じない・一言が違う（「${(await K.zone()).say}」）`);
          else { z = await K.zone(); if (!(z.row && z.ents === STAY_ENTS && z.focus === 'food')) bad.push(`${B}：通ったあと入口が戻らない・焦点が押した入口に無い（入口 ${z.ents}・焦点 ${z.focus}）`); }
          /* 送った中身（3回とも同じ）：会社・空港・種類・名前・都市の名前。★都市はこの欄の都市（data-city）。 */
          const want = { airline: s, iata: B, kind: 'food', name: NAME, city: z.city };
          const got = seen.added.map(x => (x && x.p) || {});
          measured = true;
          if (!(got.length === 3 && z.city && got.every(g => Object.keys(want).every(k => g[k] === want[k]))))
            sent.push(`送った中身が違う（${got.length}回・${JSON.stringify(got[0] || null).slice(0, 200)}）`);
        }
      }
      seen.stay = null; seen.add = null;
      ok(!zb.length && !bad.length, `${tag}: 欄の外の入口と追加の面 ── どの状態でも入口は3つ（ホテル・レストラン・場所を追加）／準備中・足せない会社は一言だけ／押した種類で面が開く（会社・都市・3字）／返事ごとの出し方`, [...zb, ...bad].join(' ／ '));
      ok(measured && !sent.filter(Boolean).length, `${tag}: 追加の面が送る中身 ── 会社・空港・押した種類・名前・この都市の名前（city）／欄の外の面にカードが読む印が無い`,
         measured ? sent.filter(Boolean).join(' ／ ') : '追加の面まで進めなかった（上の行）');
    }
    /* S-v 見てよい人になる申し込みは、画面に置かない（2026-10-16 オーナー：「確認を申し込むはいらない。…送信ボタンだけで良くない？」）。
       ★会員の鍵の1行は、鍵の1行だけ：「確認を申し込む」も「確認待ち」も出ない ── 開いた時・ホテルを足したあとの読み直し・ほかの都市。
         偽のサーバーは、申し込みの口が呼ばれたら「まだ」→（足す時から）「確認待ち」と答える用意をしておく（呼んでしまう版では面が出る）。
       ★会員がホテルを足す：入口 → 名前 → 送るを1回押す ＝ 足す口（pv_stay_add）が1本だけ（会社・空港・種類・名前・都市）。ほかには送らない。
         送ったものは場面の終わりの行で出す（申し込みの口を1回も呼ばないことは、場面の全部で数える）。
       鍵は開いたあとに置く（登録だけの会員に出す板を呼ばない）。 */
    const vSent = [];
    let vMeasured = false;
    {
      const bad = [], KEY = 'sb-check-auth-token', LOCKW = 'Only VERIFIED PILOT', NAME = '検査用の架空のホテル（会員）';
      const ITEM = { id: '00000000-0000-4000-8000-0000000000b5', kind: 'hotel', name: NAME, state: 'pending', mine: true, photos: [] };
      const SEND = `${STAY_ZONE} .crs-form button[type="submit"]`;
      const face = () => p.evaluate(sel => {
        const e = document.querySelector(sel);
        return { state: e.dataset.state, who: e.getAttribute('data-who'), text: e.textContent.replace(/\s+/g, ' ').trim(),
          parts: e.querySelectorAll('img, a[href], form, input, button').length };
      }, STAY_SLOT);
      const lockOnly = async at => { const f = await face(); if (!(f.state === 'locked' && f.who === 'member' && f.text === LOCKW && f.parts === 0)) bad.push(`${at}：会員の欄が鍵の1行だけでない（${JSON.stringify(f)}）`); };
      const formIs = want => K.until((sel, want) => { const s = document.querySelector(sel), z = s && s.nextElementSibling; return !!z && !!z.querySelector('.crs-formbox > .crs-form') === want; }, 8000, STAY_SLOT, want);
      const net = networkOf(s).list.map(x => x.iata);
      try {
        if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
        await p.evaluate(k => { localStorage.setItem(k, '{}'); localStorage.removeItem('pv_stay_key'); }, KEY);
        seen.stay = STAY_LOCKED; seen.vreq = '{"ok":true,"state":"none"}';
        if (!(await K.city(net[2], 'locked'))) bad.push(`${net[2]}：鍵の1行にならない`);
        else {
          await lockOnly(`${net[2]}（開いた時）`);
          if (!((await K.tap(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`)) && (await formIs(true)))) bad.push(`${net[2]}：会員が「ホテルを追加」を押しても追加の面が開かない`);
          else {
            const city0 = (await K.zone()).city;
            await p.type(`${STAY_ZONE} [data-k="name"]`, NAME);
            seen.add = JSON.stringify({ ok: true, item: ITEM });
            seen.vreq = '{"ok":true,"state":"pending"}';
            const a0 = seen.asked, s0 = seen.stays, d0 = seen.added.length;
            await K.tap(SEND);
            if (!((await formIs(false)) && (await K.zsayIs('追加しました。確認のあと公開されます。')) && (await K.slotIs(net[2], 'locked')))) bad.push(`${net[2]}：送るを1回押したあと、面が閉じない・一言が違う・欄が鍵の1行に戻らない（「${(await K.zone()).say}」）`);
            else await lockOnly(`${net[2]}（足したあと）`);
            const got = seen.added.slice(d0).map(x => (x && x.p) || {}), want = { airline: s, iata: net[2], kind: 'hotel', name: NAME, city: city0 };
            vMeasured = true;
            if (!(got.length === 1 && city0 && Object.keys(want).every(k => got[0][k] === want[k]))) vSent.push(`会員が送るを1回押して、足す口が1本・その中身にならない（${got.length}本・${JSON.stringify(got[0] || null).slice(0, 200)}）`);
            const more = seen.asked - a0 - got.length - (seen.stays - s0);
            if (more) vSent.push(`会員が送るを押した時に、足す口と一覧の読み直しのほかにも ${more}本送った`);
          }
        }
        if (!((await K.back()) && (await K.city(net[3], 'locked')))) bad.push(`${net[3]}：ほかの都市が鍵の1行にならない`);
        else await lockOnly(`${net[3]}（ほかの都市）`);
      } finally {
        seen.stay = null; seen.add = null; seen.vreq = null;
        await p.evaluate(k => localStorage.removeItem(k), KEY).catch(() => {});
      }
      ok(!bad.length, `${tag}: ホテルの欄に「確認を申し込む」「確認待ち」を出さない ── 会員の鍵の1行は、開いた時・ホテルを足したあと・ほかの都市でも鍵の1行だけ（申し込みの口が呼ばれたら「まだ」「確認待ち」と答える用意があっても）`, bad.join(' ／ '));
    }
    /* ── 端末の控えの鍵・自分の投稿・引き取り・書きかけ（S-d〜S-h）──
       ★ログインせずに足した人は、この端末の控えの鍵（pv_stay_key）で、自分が足したものだけを見る・直す・消す。
         欄の中は鍵の1行のまま、自分の分は欄の外の列にだけ出る（写真は描かない・聞かない）。
       ★ログインの鍵が消えたら、ログインして読んだ自分の分も画面に残さない（控えの鍵だけの人の画面は、読み直しに行かない）。
       ★ログインしている端末に控えの鍵が在れば、読む前に1回だけ引き取りを頼み、引き取れたら控えの鍵を捨てる。
       ★書きかけはこのタブだけ・打った字と打った人の印だけ（サーバーの答えは置かない）。ほかの人の印のものは戻さずに消す。
       ログインの鍵は、どれもページが開いたあとに置く（登録だけの会員に出す板を呼ばない）。
       鍵・控え・書きかけは、どの場面の後にも残さない（各場面の finally）。⚠️ ホテルは架空（検査の中だけ・どこにも保存しない）。 */
    {
      const AUTH = 'sb-check-auth-token', DEV = 'pv_stay_key', DEVK = '0123456789abcdef'.repeat(3), DR = `pv_stay_draft:${s}|`;
      const NAME = '検査用の架空のホテル（自分の投稿）', PID = '00000000-0000-4000-8000-0000000000b4';
      const ITEM = { id: PID, kind: 'hotel', name: NAME, address: '架空の住所 7-8-9', state: 'pending', mine: true, photos: [] };
      const OWN = (it = ITEM) => JSON.stringify({ ok: true, state: 'locked', own: [it] });
      const SEND = `${STAY_ZONE} .crs-form button[type="submit"]`, ADDED = '追加しました。確認のあと公開されます。';
      /* ページが投げた rpc の名前と中身（順番つき）。読むだけ（答えるのは上の偽のサーバー）。 */
      const calls = [];
      const spy = r => {
        let m = null; try { m = /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(new URL(r.url()).pathname); } catch { /* 住所の読めない要求は数えない */ }
        if (!m || r.method() !== 'POST') return;
        let b = null; try { b = JSON.parse(r.postData() || 'null'); } catch { /* 読めない中身は null */ }
        calls.push({ fn: m[1], p: (b && b.p) || null });
      };
      const since = (i, fn) => calls.slice(i).filter(c => c.fn === fn);
      const store = o => p.evaluate(o => { for (const [k, v] of Object.entries(o)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } }, o);
      const devHeld = () => p.evaluate(k => localStorage.getItem(k), DEV);
      const draftOf = code => p.evaluate(k => sessionStorage.getItem(k), DR + code);
      /* ログインの鍵・控えの鍵・書きかけを全部片づける（ページがサイトに居る時だけ読める）。 */
      const clean = () => p.evaluate((a, d) => {
        localStorage.removeItem(a); localStorage.removeItem(d);
        for (const k of Object.keys(sessionStorage)) if (k.indexOf('pv_stay_draft:') === 0) sessionStorage.removeItem(k);
      }, AUTH, DEV).catch(() => {});
      const formIs = want => K.until((sel, want) => { const s = document.querySelector(sel), z = s && s.nextElementSibling; return !!z && !!z.querySelector('.crs-formbox > .crs-form') === want; }, 8000, STAY_SLOT, want);
      /* 欄の外の自分の分：カードごとの名前・札・ボタン・写真の数。 */
      const ownRead = () => p.evaluate(sel => {
        const s = document.querySelector(sel), z = s && s.nextElementSibling, ul = z && z.querySelector('.crs-own');
        const tx = e => e.textContent.replace(/\s+/g, ' ').trim();
        return { hidden: !ul || ul.hidden, cards: ul ? [...ul.querySelectorAll('.crs-card')].map(c => ({ name: tx(c.querySelector('.crs-name') || c),
          badges: [...c.querySelectorAll('.crs-top .crs-badge')].map(tx), acts: [...c.querySelectorAll('button[data-act]')].map(b => `${b.getAttribute('data-act')}:${tx(b)}`),
          photos: c.querySelectorAll('.crs-photos, .crs-ph, img').length })) : [] };
      }, STAY_SLOT);
      const ownIs = n => K.until((sel, n) => { const s = document.querySelector(sel), z = s && s.nextElementSibling, ul = z && z.querySelector('.crs-own'); return !!ul && ul.querySelectorAll('.crs-card').length === n && (n === 0 || !ul.hidden); }, 8000, STAY_SLOT, n);
      /* 保存領域（localStorage・sessionStorage）の、値にホテル名を含む鍵の名前。 */
      const sweep = n => p.evaluate(n => [...Object.entries(localStorage), ...Object.entries(sessionStorage)].filter(([, v]) => String(v).includes(n)).map(([k]) => k), n);
      /* ほかの画面から戻ってきた知らせ（3c と同じ形。前面を取られていても「見えている」に固定してから）。 */
      const backToPage = () => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
      const idle = async (ms, moved) => { for (let t = 0; t < ms; t += 100) { if (moved()) return true; await new Promise(res => setTimeout(res, 100)); } return moved(); };
      p.on('request', spy);
      try {
        /* S-d 端末の控えの鍵と、自分の投稿（ログインしていない人）：足した返事の鍵を置く → 次の読み出しが鍵を送る →
           欄の外に「あなたの投稿」「確認待ち」・修正・削除のカード1枚（欄は鍵の1行のまま）→ 削除（2回）は鍵を送る。保存領域にホテル名が無い。 */
        {
          const key = [], bad = [];
          try {
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            seen.stay = STAY_LOCKED;
            if (!(await K.city(A, 'locked'))) bad.push(`${A}：鍵の1行にならない`);
            else if (!((await K.tap(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`)) && (await formIs(true)))) bad.push(`${A}：「ホテルを追加」で追加の面が開かない`);
            else {
              await p.type(`${STAY_ZONE} [data-k="name"]`, NAME);
              seen.add = JSON.stringify({ ok: true, item: ITEM, key: DEVK });
              seen.stay = OWN();
              const c0 = calls.length;
              await K.tap(SEND);
              if (!((await K.zsayIs(ADDED)) && (await ownIs(1)))) bad.push(`${A}：足したあと、欄の外に自分の分が出ない（${JSON.stringify(await ownRead())}）`);
              const held = await devHeld(), rd = since(c0, 'pv_stays');
              if (held !== DEVK) key.push(`足した返事の鍵を pv_stay_key に置かない（${held}）`);
              if (!(rd.length === 1 && rd[0].p && rd[0].p.key === DEVK)) key.push(`足したあとの読み出しが、控えの鍵を送らない（${JSON.stringify(rd.map(c => c.p))}）`);
              const o = await ownRead(), r = await K.look(), c = o.cards[0] || {};
              if (!(o.cards.length === 1 && !o.hidden && c.name === NAME && c.badges.join('／') === 'あなたの投稿／確認待ち' && c.acts.join('／') === 'edit:修正／del:削除' && !c.photos))
                bad.push(`欄の外の自分の分が、「あなたの投稿」「確認待ち」・修正・削除のカード1枚でない（${JSON.stringify(o).slice(0, 300)}）`);
              if (!(r.state === 'locked' && r.extra === 0 && r.entry === 1 && !r.text.includes(NAME))) bad.push(`欄が鍵の1行のままでない（${r.state}・部品 ${r.extra}・入口 ${r.entry}・「${r.text.slice(0, 60)}」）`);
              const left = await sweep(NAME);
              if (left.length) bad.push(`保存領域の値にホテル名が残る（${left.join('・')}）`);
              /* 削除は2回押す。消す口は控えの鍵を送る。消したあとの読み直しには、自分の分が無い。 */
              seen.del = '{"ok":true}';
              if (!(await K.tap(`${STAY_ZONE} .crs-own [data-act="del"]`))) bad.push('自分の分の「削除」を押せない');
              else {
                seen.stay = STAY_LOCKED;
                if (!(await K.tap(`${STAY_ZONE} .crs-own [data-act="del"][data-sure]`))) bad.push('「削除する」を押せない');
                else if (!((await K.zsayIs('削除しました。')) && (await ownIs(0)))) bad.push(`消したあと、一言が「削除しました。」でない・自分の分が残る（「${(await K.zone()).say}」）`);
              }
              const dl = seen.deleted.map(x => (x && x.p) || {});
              if (!(dl.length === 1 && dl[0].target === 'place' && dl[0].id === PID && dl[0].key === DEVK)) key.push(`削除が、控えの鍵を添えた1本でない（${JSON.stringify(dl)}）`);
            }
          } finally {
            await clean();
            seen.stay = null; seen.add = null; seen.del = null; seen.deleted = [];
          }
          ok(!key.length, `${tag}: 端末の控えの鍵 ── ログインせずに足した返事の鍵を pv_stay_key に置く・次の読み出しと削除が、その鍵を送る`, key.join(' ／ '));
          ok(!bad.length, `${tag}: 自分の投稿 ── 欄の外に「あなたの投稿」「確認待ち」・修正・削除のカード1枚（欄は鍵の1行のまま・部品なし）／削除のあとは消える／保存領域の値にホテル名が無い`, bad.join(' ／ '));
        }
        /* S-e 返事の自分の分に写真が入っていても、写真の列を描かない・写真を聞かない・読み直しに行かない（2秒待つ）。 */
        {
          const bad = [];
          try {
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            seen.stay = OWN({ ...ITEM, photos: [{ id: '00000000-0000-4000-8000-0000000000b5', mine: true, state: 'public' }] });
            const c0 = calls.length;
            if (!((await K.city(B, 'locked')) && (await ownIs(1)))) bad.push(`${B}：欄の外に自分の分が出ない`);
            else {
              const n0 = seen.stays;
              await new Promise(res => setTimeout(res, 2000));
              const o = await ownRead(), ph = since(c0, 'pv_stay_photo').length;
              if ((o.cards[0] || {}).photos || ph || seen.stays !== n0) bad.push(`写真の部品 ${(o.cards[0] || {}).photos}・写真を聞いた ${ph}回・読み直し ${seen.stays - n0}回（どれも 0 のはず）`);
            }
          } finally {
            await clean();
            seen.stay = null;
          }
          ok(!bad.length, `${tag}: 自分の投稿の写真 ── 返事に写真が入っていても、写真の列を描かない・写真を聞かない・読み直しに行かない`, bad.join(' ／ '));
        }
        /* S-f ログインの鍵が消えたら、ログインして読んだ自分の分を残さない／控えの鍵だけの人は、同じ知らせで読み直しに行かない。 */
        {
          const gone = [], quiet = [];
          try {
            await clean();
            if (!(await K.fresh())) gone.push('ステイ先のタブが一覧で開かない');
            await store({ [AUTH]: '{}' });
            seen.stay = OWN();
            if (!((await K.city(C, 'locked')) && (await ownIs(1)))) gone.push(`${C}：ログインの鍵が在る人の自分の分が出ない`);
            else {
              await store({ [AUTH]: null });
              seen.stay = STAY_LOCKED;
              await backToPage();
              const off = await ownIs(0), left = await p.evaluate(n => document.documentElement.innerHTML.includes(n), NAME);
              if (!off || left) gone.push(`ログインの鍵が消えて戻ってきたのに、自分の分のカードかホテル名が残る（カード ${!off}・ホテル名 ${left}）`);
            }
            await clean();
            if (!(await K.fresh())) quiet.push('ステイ先のタブが一覧で開かない');
            await store({ [DEV]: DEVK });
            seen.stay = OWN();
            if (!((await K.city(D, 'locked')) && (await ownIs(1)))) quiet.push(`${D}：控えの鍵だけの人の自分の分が出ない`);
            else {
              const n0 = seen.stays;
              await backToPage();
              const moved = await idle(1500, () => seen.stays !== n0);
              if (moved || (await ownRead()).cards.length !== 1) quiet.push(`控えの鍵だけの人が戻ってきただけで読み直す・カードが消える（読み直し ${seen.stays - n0}回）`);
            }
          } finally {
            await clean();
            seen.stay = null;
          }
          ok(!gone.length, `${tag}: 自分の投稿 ── ログインの鍵が消えて戻ってきたら、ログインして読んだ自分の分のカードもホテル名も残さない`, gone.join(' ／ '));
          ok(!quiet.length, `${tag}: 自分の投稿 ── 控えの鍵だけの人（ログインしていない）は、戻ってきただけでは読み直しに行かない（カードはそのまま）`, quiet.join(' ／ '));
        }
        /* S-g 引き取り：ログインの鍵と控えの鍵が在る → 読む前に pv_stay_claim を1回 → 引き取れたら控えの鍵を捨て、読み出しは鍵を送らない／
           引き取りの口が無い（404）→ 控えの鍵は残り、読み出しがそれを送る／ログインの鍵が無い → 引き取りを頼まない。 */
        {
          const bad = [];
          const tryCity = async (code, want) => {
            seen.claimed = [];
            const c0 = calls.length;
            if (!(await K.city(code, 'locked'))) { bad.push(`${code}：鍵の1行にならない`); return; }
            const order = calls.slice(c0).map(c => c.fn).filter(f => f === 'pv_stay_claim' || f === 'pv_stays').join(' ');
            const rd = since(c0, 'pv_stays'), held = await devHeld(), cl = seen.claimed.map(x => (x && x.p) || {});
            const got = { order, claimKeys: cl.map(x => x.key === DEVK), held: held === DEVK, readKey: rd.length === 1 && rd[0].p ? rd[0].p.key === DEVK : null };
            if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${code}：${JSON.stringify(got)}（${JSON.stringify(want)} のはず）`);
          };
          try {
            seen.stay = STAY_LOCKED;
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            await store({ [AUTH]: '{}', [DEV]: DEVK });
            await tryCity(E, { order: 'pv_stay_claim pv_stays', claimKeys: [true], held: false, readKey: false });
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            await store({ [AUTH]: '{}', [DEV]: DEVK });
            seen.claim = { status: 404, body: '{"code":"PGRST202","message":"stub"}' };
            await tryCity(F, { order: 'pv_stay_claim pv_stays', claimKeys: [true], held: true, readKey: true });
            seen.claim = '{"ok":true}';
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            await store({ [DEV]: DEVK });
            await tryCity(A, { order: 'pv_stays', claimKeys: [], held: true, readKey: true });
          } finally {
            await clean();
            seen.stay = null; seen.claim = '{"ok":true}'; seen.claimed = [];
          }
          ok(!bad.length, `${tag}: 引き取り ── ログインしている端末に控えの鍵が在れば、読む前に1回だけ頼む（引き取れたら鍵を捨て、読み出しは鍵を送らない）／頼めなければ鍵は残り読み出しに添える／ログインしていなければ頼まない`, bad.join(' ／ '));
        }
        /* S-h 書きかけ（ログインしていない人）：打つと pv_stay_draft:<会社>|<空港> に、決まった9つの鍵だけ・u は ''・at は打った時刻。
           読み直すと面が戻る（種類と字・焦点は取らない）／ログインの入口は、この都市へ戻る住所／「やめる」と送って通ったあとは消える／
           ほかの都市には面が無い／手で置いたほかの人の印（u = 'someone-else'・打ったばかりの時刻）の書きかけは、戻さない。
           ★WP-keep-1（2026-10-17）で付け直した：時刻（at）が足された（30分を過ぎたら消す）。ログインしていない今、会員の印の書きかけは
             出さずにそのまま置く（ログインが知らせなく切れた人が戻れば、30分のうちは戻る）。別の会員がログインした時に消すのは assert-stays の S9。 */
        {
          const shape = [], other = [], flow = [];
          const TXT = '検査用の架空の書きかけ', NOTE = '架空のひとこと', WANT = 'v,u,at,kind,name,address,maps_url,stay_hours,note';
          const url = `${BASE}/airlines/${s}.html`;
          const reopen = async code => { await p.goto('about:blank'); await p.goto(`${url}#stay-${code}`, { waitUntil: 'load', timeout: 60000 }); return K.slotIs(code, 'locked'); };
          try {
            await clean();
            if (!(await K.fresh())) flow.push('ステイ先のタブが一覧で開かない');
            seen.stay = STAY_LOCKED;
            if (!((await K.city(A, 'locked')) && (await K.tap(`${STAY_ZONE} .crs-ent[data-kind="spot"]`)) && (await formIs(true)))) flow.push(`${A}：「場所を追加」で追加の面が開かない`);
            else {
              await p.type(`${STAY_ZONE} [data-k="name"]`, TXT);
              await p.type(`${STAY_ZONE} [data-k="note"]`, NOTE);
              const raw = await draftOf(A);
              let o = null; try { o = JSON.parse(raw); } catch { /* 読めない形は下で落ちる */ }
              if (!(o && Object.keys(o).join(',') === WANT && o.v === 1 && o.u === '' && typeof o.at === 'number' && Math.abs(Date.now() - o.at) < 60000 && o.kind === 'spot' && o.name === TXT && o.note === NOTE)) shape.push(`書きかけの形が違う（${String(raw).slice(0, 300)}）`);
              /* その時のログインの入口の行き先（押した時に決め直す。押しても移らないようにして読む）。 */
              const href = await p.evaluate(sel => {
                const a = document.querySelector(sel + ' a[data-crs-entry]');
                if (!a) return '';
                a.addEventListener('click', e => e.preventDefault(), { once: true });
                a.click();
                return a.getAttribute('href') || '';
              }, STAY_SLOT);
              if (!href.endsWith(`%23stay-${A}`)) flow.push(`ログインの入口が、この都市へ戻る住所でない（${href}）`);
              /* 読み直す（#stay-<空港>）→ 面が戻る */
              if (!((await reopen(A)) && (await formIs(true)))) flow.push(`#stay-${A} を読み直すと、書きかけの面が戻らない`);
              else {
                const z = await K.zone(), note = await p.evaluate(sel => ((document.querySelector(sel).nextElementSibling.querySelector('.crs-formbox > .crs-form [data-k="note"]')) || {}).value || '', STAY_SLOT);
                if (!(z.kind === 'spot' && z.name === TXT && note === NOTE && z.focus === '' && !z.row)) flow.push(`戻った面が違う（種類 ${z.kind}・名前「${z.name}」・ひとこと「${note}」・焦点 ${z.focus || 'なし'}・入口の列 ${z.row}）`);
                /* 「やめる」→ 書きかけも消える */
                await K.tap(`${STAY_ZONE} .crs-form [data-act="unform"]`);
                if (!((await formIs(false)) && (await draftOf(A)) === null)) flow.push('「やめる」のあとも、面か書きかけが残る');
                /* 打ち直して送り、通る → 書きかけは消える */
                if (!((await K.tap(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`)) && (await formIs(true)))) flow.push('「ホテルを追加」で面が開き直さない');
                else {
                  await p.type(`${STAY_ZONE} [data-k="name"]`, TXT);
                  const typed = (await draftOf(A)) !== null;
                  seen.add = JSON.stringify({ ok: true, item: { id: '00000000-0000-4000-8000-0000000000b6', kind: 'hotel', name: TXT, state: 'pending', mine: true, photos: [] } });
                  await K.tap(SEND);
                  if (!(typed && (await formIs(false)) && (await K.zsayIs(ADDED)) && (await draftOf(A)) === null)) flow.push(`送って通ったあとも書きかけが残る（打った時に置いた ${typed}）`);
                }
                /* ほかの都市には面が無い */
                if (!((await K.back()) && (await K.city(B, 'locked')))) flow.push(`${B}：鍵の1行にならない`);
                else if ((await K.zone()).form) flow.push(`${B}：ほかの都市に追加の面が出る`);
              }
            }
            /* ほかの人の印の書きかけ（手で置いた）→ 同じページのまま都市を開く → 面は出ない・書きかけは消える。
               ★読み直すと、読む人の知らせ（INITIAL_SESSION）の片づけが先に消すので、都市を開いた時の片づけ（restoreDraft）は
                 ページを替えないこちらでしか見えない（知らせの届かないログアウトのあと、次の人が都市を開く時の網）。 */
            const OTHER = JSON.stringify({ v: 1, u: 'someone-else', at: Date.now(), kind: 'hotel', name: '検査用の架空のほかの人の字', address: '', maps_url: '', stay_hours: '', note: '' });
            await p.evaluate((k, v) => sessionStorage.setItem(k, v), DR + D, OTHER);
            if (!(((await K.back()) || (await K.fresh())) && (await K.city(D, 'locked')))) other.push(`${D}：鍵の1行にならない`);
            else {
              const f = (await K.zone()).form, left = await draftOf(D);
              if (f || left !== OTHER) other.push(`同じページのまま開いた都市で、ほかの人の印の書きかけが戻る・書き換わる（面 ${f}・書きかけ ${String(left).slice(0, 80)}）`);
            }
            /* 読み直す → 面は出ない・書きかけは消える */
            await p.evaluate((k, v) => sessionStorage.setItem(k, v), DR + C, OTHER);
            if (!(await reopen(C))) other.push(`#stay-${C} が鍵の1行で開かない`);
            else {
              const f = (await K.zone()).form, left = await draftOf(C);
              if (f || left !== OTHER) other.push(`ほかの人の印の書きかけが戻る・書き換わる（面 ${f}・書きかけ ${String(left).slice(0, 80)}）`);
            }
          } finally {
            await clean();
            seen.stay = null; seen.add = null;
          }
          ok(!shape.length, `${tag}: 書きかけ ── 打つと pv_stay_draft:<会社>|<空港> に、決まった9つの鍵（${WANT}）だけを置く・ログインしていなければ u は ''・at は打った時刻（サーバーの答えは置かない）`, shape.join(' ／ '));
          ok(!other.length, `${tag}: 書きかけ ── ほかの人の印（u = 'someone-else'）の書きかけは、同じページで都市を開いても・読み直しても、ログインしていない今は戻さない（その人のために、1文字も変えずに置く）`, other.join(' ／ '));
          ok(!flow.length, `${tag}: 書きかけ ── 読み直すと面が戻る（種類と字・焦点は取らない）／ログインの入口はこの都市へ戻る住所／「やめる」と送って通ったあとは消える／ほかの都市には面が無い`, flow.join(' ／ '));
        }
        /* S-i ログインする前に開いた追加の面：ほかのタブでログインした（鍵が置かれ、この画面には知らせ SIGNED_IN だけが届く ──
           supabase-js がタブのあいだで使う道）→ 面と字はそのまま → そのログインが知らせなく消えて戻ってきたら、面も字も画面に残さない。
           ★WP-keep-1（2026-10-17）で付け直した：書きかけは、ログインした会員（c1）の印に付け直されて、このタブにそのまま残る
             （ログインが知らせなく切れただけ ＝ 同じ人がログインし直せば30分のうちは戻る。ログインしていない今は出さない）。 */
        {
          const bad = [], TXT = '検査用の架空の書きかけ（ログインの前）';
          try {
            await clean();
            if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
            seen.stay = STAY_LOCKED;
            if (!((await K.city(A, 'locked')) && (await K.tap(`${STAY_ZONE} .crs-ent[data-kind="hotel"]`)) && (await formIs(true)))) bad.push(`${A}：「ホテルを追加」で追加の面が開かない`);
            else {
              await p.type(`${STAY_ZONE} [data-k="name"]`, TXT);
              const n0 = seen.stays;
              await store({ [AUTH]: '{}' });
              await p.evaluate(() => { const c = new BroadcastChannel('sb-vzgmnkrggrwtsrpqndsm-auth-token'); c.postMessage({ event: 'SIGNED_IN', session: { user: { id: '00000000-0000-4000-8000-0000000000c1' } } }); c.close(); });
              const reread = (await idle(8000, () => seen.stays > n0)) && (await K.slotIs(A, 'locked'));
              const kept = reread && (await formIs(true)) && (await K.zone()).name === TXT;
              if (!kept) bad.push(`ほかのタブでログインしたら、面か打った字が消える・読み直さない（読み直し ${seen.stays - n0}回）`);
              else {
                await store({ [AUTH]: null });
                await backToPage();
                const shut = await formIs(false);
                const left = await p.evaluate(t => [...document.querySelectorAll('input, textarea')].some(i => i.value === t), TXT), draft = await draftOf(A);
                let dj = null; try { dj = JSON.parse(draft); } catch { dj = null; }
                if (!(shut && !left && dj && dj.u === '00000000-0000-4000-8000-0000000000c1' && dj.name === TXT)) bad.push(`ログインが知らせなく消えて戻ってきたのに、面か字が残る・書きかけが c1 の印で残っていない（面 ${!shut}・字 ${left}・書きかけ ${String(draft).slice(0, 120)}）`);
              }
            }
          } finally {
            await clean();
            seen.stay = null;
          }
          ok(!bad.length, `${tag}: 書きかけ ── ログインの前に開いた追加の面は、ほかのタブでのログインでは残し、そのログインが知らせなく消えて戻ってきたら面も字も画面に残さない（書きかけはログインした会員の印でこのタブに残る）`, bad.join(' ／ '));
        }
      } finally {
        p.off('request', spy);
        await clean();
      }
    }
    /* S-v の終わり（送るもの）：この画面は、見てよい人の申し込みの口を1回も呼ばない ── 場面の全部で数える
       （S-a〜S-h：ログインしていない人も会員も・都市を開く・足す・直す・消す・引き取り・書きかけ）。
       会員が送るを1回押した時に送ったもの（S-v）も、ここで出す。 */
    ok(vMeasured && !seen.vreqd.length && !vSent.length, `${tag}: 送るもの ── この画面は申し込みの口（pv_stay_viewer_request）を1回も呼ばない（場面の全部・ログインしていない人も会員も）／会員が送るを1回押すと、足す口（pv_stay_add）が1本だけ（会社・空港・種類・名前・都市）で、ほかには送らない`,
       [seen.vreqd.length ? `申し込みの口を ${seen.vreqd.length}回呼んだ（${seen.vreqd.slice(0, 2).join(' ')}）` : '', ...vSent, vMeasured ? '' : '会員が足す所まで進めなかった（S-v の行）'].filter(Boolean).join(' ／ '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
async function runStayStall(browser, s, [w, h]) {
  const tag = `${s} ${w}（ホテルの欄・返事が来ない）`;
  const { ctx, p, ready, seen } = await open(browser, s, w, h, 'empty');
  const K = stayKit(p, s);
  try {
    ok(ready, `${tag}: 開ける`);
    const WAIT = Number(one(read('career-stay.js'), /\n  var STAY_WAIT = (\d+);/));
    const A = networkOf(s).list[0].iata, bad = [];
    if (!(WAIT >= 1000 && WAIT <= 30000)) bad.push(`career-stay.js の STAY_WAIT が読めない（${WAIT}）`);
    if (!(await K.fresh())) bad.push('ステイ先のタブが一覧で開かない');
    seen.stayStall = true;
    const a0 = seen.stays;
    /* 待ちの絵。届かない読み出しは1本だけ。 */
    if (!(await K.city(A, 'loading'))) bad.push(`${A}：待ちの絵にならない`);
    else if (!(await K.look()).skel) bad.push(`${A}：待ちの絵（骨組み）が無い`);
    /* 返事が1つも来ないうちから、欄の外に入口の3つが在る（返事のあとで下に湧かない）。 */
    const z0 = await K.zone();
    ok(!!z0 && z0.ents === STAY_ENTS && seen.stayAsked === 0, `${tag}: 返事を待つあいだも、欄の外に入口の3つ（ホテル・レストラン・場所を追加）が在る`, z0 ? `${z0.ents}（返事 ${seen.stayAsked}）` : '欄の外の面が無い');
    const t0 = Date.now(), n1 = seen.stays;
    /* 本当に待つ（時計を進めない）。上限を過ぎても終わらなければ落とす。 */
    const ended = Number.isFinite(WAIT) && await K.slotIs(A, 'error', WAIT + 10000);
    const took = Date.now() - t0;
    if (!ended) bad.push(`${A}：返事が来ないまま、${Math.round((WAIT + 10000) / 1000)}秒たっても「読み込めませんでした」にならない（待ちの絵のまま）`);
    else {
      const r = await K.look();
      if (!(r.text === '読み込めませんでしたもう一度' && r.retry === 1)) bad.push(`${A}：返事が来ない時の欄が「読み込めませんでした」＋「もう一度」でない（「${r.text}」）`);
      if (took < WAIT - 1000) bad.push(`${A}：STAY_WAIT（${WAIT}ms）より早く「読み込めませんでした」になった（${took}ms）`);
    }
    if (!(n1 - a0 === 1 && seen.stays === n1)) bad.push(`${A}：待つあいだに聞き直している（聞いた回数：待ちの前 ${n1 - a0}・待つあいだ ${seen.stays - n1}）`);
    /* 「もう一度」を押した人だけがやり直す：返事が来れば一覧になる。 */
    seen.stayStall = false; seen.stay = STAY_OPEN;
    if (ended) {
      if (!((await K.tap(`${STAY_SLOT} [data-act="retry"]`)) && (await K.slotIs(A, 'open')))) bad.push(`${A}：「もう一度」で一覧にならない（${(await K.look()).state}）`);
      else if (!(await K.look()).text.includes(STAY_NAME) || seen.stays !== n1 + 1) bad.push(`${A}：「もう一度」の一覧が違う・聞いた回数が1回でない（${seen.stays - n1}回）`);
    }
    seen.stay = null;
    console.log(`  ・ホテルの欄の「返事が来ない」場面は ${s} ${w} で流した（待った時間 ${(took / 1000).toFixed(1)}秒・上限 ${WAIT}ms）`);
    ok(!bad.length, `${tag}: 返事が来ない読み出しは、待ちの絵のあと STAY_WAIT で「読み込めませんでした」＋「もう一度」になる・待つあいだに聞き直さない・「もう一度」で一覧になる`, bad.join(' ／ '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* ── 就航地の一覧：探す字と地域の札は「戻る」と読み直しで残る（場面 find）──
   打つ・地域の札を押す → 都市を開く → 読み直す →「‹ 就航地」：同じカード・同じ並び・同じ数・押した札・欄の字・同じ位置（2px 以内）。
   一覧の上で読み直しても、同じカード・数・札・欄（読み直したあとの位置はブラウザが決める ＝ 見ない）。
   住所で直接開いた都市から「‹ 就航地」は、全部の一覧（戻すものが無い）。打っても札を押しても、履歴の段は増えない（書き換えるだけ）。
   狭い幅の1回だけ（FIND_W）。幅を絞った回（--sizes）は、その幅で流す。 */
const FIND_W = [390];
async function runFind(browser, s, [w, h]) {
  const tag = `${s} ${w}（就航地を探す・戻る・読み直し）`;
  const { ctx, p, ready } = await open(browser, s, w, h, 'empty');
  const K = stayKit(p, s), url = `${BASE}/airlines/${s}.html`;
  /* いまの一覧：見えているカードの並び・数の字・押した札・欄の字・位置・全部の枚数・履歴の段の数。 */
  const read = () => p.evaluate(() => {
    const box = document.getElementById('pvg-stay'), lis = [...document.querySelectorAll('#pvg-st-list > li')];
    return {
      cards: lis.filter(li => !li.hidden && li.getClientRects().length > 0).map(li => { const a = li.querySelector('.pvg-city[data-city]'); return a ? a.getAttribute('data-city') : '?'; }),
      n: ((box && box.querySelector('[data-pvg-stn]')) || {}).textContent || '',
      pill: box ? [...box.querySelectorAll('[data-pvg-rg][aria-pressed="true"]')].map(b => b.getAttribute('data-pvg-rg')).join(',') : '',
      q: (document.getElementById('pvg-st-q') || {}).value, y: Math.round(window.scrollY), all: lis.length, len: history.length,
    };
  });
  /* 位置が5コマ続けて同じになるまで待つ（時間では待たない。5秒で諦める）。 */
  const still = () => p.evaluate(() => new Promise(res => {
    let last = -1, n = 0; const t0 = performance.now();
    const tick = () => { const y = Math.round(scrollY); n = y === last ? n + 1 : 0; last = y; if (n >= 5 || performance.now() - t0 > 5000) return res(n >= 5); requestAnimationFrame(tick); };
    tick();
  }));
  const sameList = (a, b) => JSON.stringify([a.cards, a.n, a.pill, a.q]) === JSON.stringify([b.cards, b.n, b.pill, b.q]);
  const show = r => `${r.cards.length}枚（${r.cards.slice(0, 6).join(' ')}${r.cards.length > 6 ? ' …' : ''}）・数「${r.n}」・札「${r.pill}」・欄「${r.q}」・位置 ${r.y}`;
  const grow = [], back = [], direct = [];
  try {
    ok(ready, `${tag}: 開ける`);
    if (!(await K.fresh())) back.push('ステイ先のタブが一覧で開かない');
    else {
      /* 打つ1字と押す地域の札：その地域で2枚以上・その地域の全部より少なく残り、札を押さなければもっと残る組（いちばん半分に近いもの）。 */
      const pick = await p.evaluate(() => {
        const items = [...document.querySelectorAll('#pvg-st-list > li')].map(li => ({ q: li.getAttribute('data-q') || '', rg: li.getAttribute('data-rg') || '' }));
        const rgs = [...document.querySelectorAll('#pvg-stay [data-pvg-rg]')].map(b => b.getAttribute('data-pvg-rg')).filter(Boolean);
        let best = null;
        for (const rg of rgs) {
          const mine = items.filter(i => i.rg === rg);
          for (const c of 'abcdefghijklmnopqrstuvwxyz') {
            const k = mine.filter(i => i.q.includes(c)).length, all = items.filter(i => i.q.includes(c)).length, d = Math.abs(k - mine.length / 2);
            if (k >= 2 && k < mine.length && all > k && (!best || d < best.d)) best = { rg, c, k, d };
          }
        }
        return best;
      });
      if (!pick) back.push('2枚以上が残る1字と地域の札が見つからない');
      else {
        const len0 = (await read()).len;
        await p.type('#pvg-st-q', pick.c.toUpperCase());
        const tapped = await K.tap(`#pvg-stay [data-pvg-rg="${pick.rg}"]`);
        const narrowed = tapped && (await K.until(k => document.querySelectorAll('#pvg-st-list > li:not([hidden])').length === k, 8000, pick.k));
        const r0 = await read();
        if (r0.len !== len0) grow.push(`「${pick.c.toUpperCase()}」を打って「${pick.rg}」を押したら、履歴の段が ${len0} → ${r0.len}`);
        if (!(narrowed && r0.cards.length === pick.k && r0.n === String(pick.k) && r0.pill === pick.rg)) back.push(`しぼった一覧が違う（${show(r0)}・${pick.k}枚のはず）`);
        else {
          /* 2枚めのカードを画面のまんなかへ（滑らせない）→ 落ち着いてから読む → そのカードを押す。
             比べる位置は、押した瞬間の位置（押す前の寄せ直しで数 px 動くことがある ── 見ていた所は、押した時の所）。 */
          const code = r0.cards[1];
          await p.evaluate(c => document.querySelector(`#pvg-st-list .pvg-city[data-city="${c}"]`).scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }), code);
          await still();
          const before = await read();
          await p.evaluate(() => { window.__pvgFindY = null; document.addEventListener('click', () => { window.__pvgFindY = Math.round(scrollY); }, { capture: true, once: true }); });
          const opened = (await K.tap(`#pvg-st-list .pvg-city[data-city="${code}"]`)) && (await K.slotIs(code, 'locked'));
          before.y = await p.evaluate(() => window.__pvgFindY);
          if (!(before.y > 0)) back.push(`押した時の位置が読めない・一覧が短くて確かめられない（位置 ${before.y}）`);
          if (!opened) back.push(`${code} を押しても詳細にならない`);
          else {
            await p.reload({ waitUntil: 'load', timeout: 60000 });
            if (!(await K.slotIs(code, 'locked'))) back.push(`読み直すと ${code} の詳細にならない`);
            else if (!((await K.tap('#pvg-city [data-pvg-cityback]')) && (await K.list()))) back.push('読み直したあと「‹ 就航地」で一覧に戻らない');
            else {
              await still();
              const after = await read();
              if (!(sameList(after, before) && Math.abs(after.y - before.y) <= 2)) back.push(`読み直して「‹ 就航地」── 前 ${show(before)} ／ 後 ${show(after)}`);
              await p.reload({ waitUntil: 'load', timeout: 60000 });
              if (!(await K.list())) back.push('一覧の上で読み直すと、一覧にならない');
              else { const again = await read(); if (!sameList(again, before)) back.push(`一覧の上で読み直す ── 前 ${show(before)} ／ 後 ${show(again)}`); }
            }
          }
        }
      }
    }
    /* 住所で直接開いた都市 →「‹ 就航地」：全部の一覧（書き留めが無い ＝ 戻すものが無い） */
    {
      const code = networkOf(s).list[0].iata;
      await p.goto('about:blank');
      await p.goto(`${url}#stay-${code}`, { waitUntil: 'load', timeout: 60000 });
      if (!(await K.slotIs(code, 'locked'))) direct.push(`#stay-${code} が詳細で開かない`);
      else if (!((await K.tap('#pvg-city [data-pvg-cityback]')) && (await K.list()))) direct.push('「‹ 就航地」で一覧に戻らない');
      else { const r = await read(); if (!(r.all > 0 && r.cards.length === r.all && r.n === String(r.all) && r.pill === '' && r.q === '')) direct.push(`戻った一覧 ── ${show(r)}（全部の ${r.all}枚・札「すべて」・欄は空のはず）`); }
    }
    ok(!grow.length, `${tag}: 探す欄に打っても地域の札を押しても、履歴の段は増えない（書き換えるだけ）`, grow.join(' ／ '));
    ok(!back.length, `${tag}: 打って地域の札を押す → 都市 → 読み直す →「‹ 就航地」── 同じカード・同じ並び・同じ数・押した札・欄の字・同じ位置（2px 以内）／一覧の上で読み直しても同じ一覧`, back.join(' ／ '));
    ok(!direct.length, `${tag}: 住所で直接開いた都市から「‹ 就航地」── 全部の一覧（札「すべて」・欄は空）`, direct.join(' ／ '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

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

/* 「暮らし・家族」の街のカードと家賃の棒（場面 living・mode 'empty'）。1440 と 390 で1枚ずつ開く（--sizes で幅を替えた時は「開ける」だけ ＝ 絵のため）。
     1440 ── LS2 街のカードを押す（マウスと Tab＋Enter）：その街の詳細だけが出る・押された印が移る・その街の棒の行が全部印つきで、ほかの行には無い・
                 住所も履歴の長さも動かない
             LS3 間取りの切り替え：ボタンへ Tab で着いて Enter／Space・焦点は押したボタンのまま・出ている組は1つ・履歴を積まない・画面が動かない
             LS4 棒の土台（.pvg-rb-track）は、どの行・どの組でも、USD に換えたあとも、切り替えが動かなかった形でも同じ長さ（±0.5px）。
                 棒は 土台 × 台帳の比（額 ÷ 目盛の右端。±0.6px）
     390  ── LS7 切り替えが動かなかった時の形（出荷した HTML のまま）：どの組も見出しつきで出る・切り替えのボタンは出ない
   期待する行と比は台帳から（LIV_BARS ＝ SB の BR）。ページからは読まない。家賃の棒が無い都市（台帳で決まる）は LS3・LS4・LS7 を
   1行ずつ「無い」で見る（都市に棒が増えても、行の数は動かない）。待つのはいつも条件（押した印・出た板）。
   PV_GLANCE_SHOT=<フォルダ> を渡すと、別に開いたページで living-<会社>-<幅>-<形>.png を撮る（open・town2・size3・cur-USD・dark。合否には使わない）。 */
function livSee() {
  const on = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
  const wd = e => (e ? e.getBoundingClientRect().width : null);
  const box = document.querySelector('.pvg [data-pvg-rent]'), a = document.activeElement;
  return {
    url: location.href, hist: history.length, y: scrollY, rent: !!box, sw: !!box && on(box.querySelector('.pvg-rb-sw')),
    active: !a ? '' : a.hasAttribute('data-pvg-size') ? `size:${a.getAttribute('data-pvg-size')}` : a.matches('.pvg-town[data-town]') ? `town:${a.getAttribute('data-town')}` : a.tagName,
    btns: box ? [...box.querySelectorAll('[data-pvg-size]')].map(b => ({ k: b.getAttribute('data-pvg-size'), on: b.getAttribute('aria-pressed') === 'true' })) : [],
    panels: box ? [...box.querySelectorAll('[data-size-panel]')].map(g => ({ k: g.getAttribute('data-size-panel'), shown: on(g), cap: on(g.querySelector('.pvg-rb-t')),
      rows: [...g.querySelectorAll('[data-bar]')].map(li => ({ id: li.getAttribute('data-bar'), mark: li.hasAttribute('data-on'),
        track: wd(li.querySelector('.pvg-rb-track')), fill: wd(li.querySelector('.pvg-rb-fill')) })) })) : [],
    tracks: document.querySelectorAll('.pvg .pvg-rb-track').length,
    cards: [...document.querySelectorAll('.pvg [data-pvg-towns] .pvg-town[data-town]')].map(b => ({ k: b.getAttribute('data-town'), on: b.getAttribute('aria-pressed') === 'true', td: b.getAttribute('aria-controls') })),
    tds: [...document.querySelectorAll('.pvg .pvg-td')].filter(on).map(t => t.id),
  };
}
const LIV_SZ = k => `.pvg [data-pvg-rent] [data-pvg-size="${k}"]`, LIV_TW = k => `.pvg [data-pvg-towns] .pvg-town[data-town="${k}"]`;
/* 切り替えが動かなかった時の形へ戻す（出荷した HTML と同じ：data-js も hidden も無い） */
const LIV_BARE = () => { const b = document.querySelector('.pvg [data-pvg-rent]'); if (!b) return; b.removeAttribute('data-js'); b.querySelectorAll('[data-size-panel]').forEach(g => { g.hidden = false; }); };
async function livTab(p) {
  await p.evaluate(() => window.PVGlance.go('life'));
  const there = await p.waitForFunction(() => { const e = document.getElementById('pvg-p-living');
    return window.PVGlance.at() === 'life' && !!e && e.getClientRects().length > 0 && e.checkVisibility(); }, { timeout: 8000 }).then(() => true, () => false);
  if (!there) throw new Error('「暮らし・家族」のタブへ移れない');
}
async function runLiving(browser, s, [w, h]) {
  const tag = `${s} ${w}（暮らし・家賃の棒と街のカード）`, L = LIV_BARS[s];
  if (process.env.PV_GLANCE_SHOT) await livShots(browser, s, [w, h]).catch(e => notice(`${tag}: 絵を撮れなかった（${String(e && e.message).slice(0, 120)}）`));
  const { ctx, p, ready } = await open(browser, s, w, h, 'empty');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const pressed = q => p.waitForFunction(q => { const e = document.querySelector(q); return !!e && e.getAttribute('aria-pressed') === 'true'; }, { timeout: 5000 }, q).then(() => true, () => false);
  const key = async (k, shift) => { if (shift) await p.keyboard.down('Shift'); await p.keyboard.press(k); if (shift) await p.keyboard.up('Shift'); };
  /* 画面が止まるまで待つ（5コマ続けて同じ位置。動きは押してから2コマ止まったまま始まる）。カードを押すと詳細へ寄せる動きが十数コマ続く
     （html{scroll-behavior:smooth}）＝ 止まる前に測ると、その動きを「切り替えで画面が動いた」と数えてしまう。600コマで止まらなければ、そのまま進む（下の判定が落とす）。 */
  const still = () => ev(() => new Promise(r => { let y = scrollY, n = 0, k = 0;
    const f = () => { if (++k > 600) return r(false); if (scrollY === y) { if (++n >= 5) return r(true); } else { y = scrollY; n = 0; } requestAnimationFrame(f); };
    requestAnimationFrame(f); }));
  try {
    ok(ready, `${tag}: 開ける`);
    await livTab(p);
    const b0 = await ev(livSee);
    if (w === 1440) {
      /* LS2 */
      const keys = b0.cards.map(c => c.k), ls2 = [];
      const judge = (r, k, how) => {
        const card = r.cards.find(c => c.k === k), ids = L.on ? L.rows.filter(x => x.town === k).map(x => x.id) : [], rows = r.panels.flatMap(g => g.rows);
        if (!card) { ls2.push(`${how} ${k}: カードが無い`); return; }
        if (!same(r.tds, [card.td])) ls2.push(`${how} ${k}: 見えている詳細 ${r.tds.join('・') || '無し'}（あるべき ${card.td} だけ）`);
        const on = r.cards.filter(c => c.on).map(c => c.k);
        if (!same(on, [k])) ls2.push(`${how} ${k}: 押された印 ${on.join('・') || '無し'}`);
        const off = [...new Set(rows.filter(x => x.mark !== ids.includes(x.id)).map(x => `${x.id}${x.mark ? 'に印' : 'に印が無い'}`))];
        const gone = ids.filter(id => !rows.some(x => x.id === id)).map(id => `${id}の行が無い`);
        if (off.length || gone.length) ls2.push(`${how} ${k}: 棒の行 ${[...off, ...gone].join('・')}（台帳のこの街の行 ${ids.join('・') || '無し'}）`);
        if (r.url !== b0.url || r.hist !== b0.hist) ls2.push(`${how} ${k}: 住所か履歴が動いた（${b0.hist} → ${r.hist} 段）`);
      };
      for (const k of [...keys.slice(1), keys[0]]) {
        await still();
        await ev(q => document.querySelector(q).scrollIntoView({ block: 'center', behavior: 'instant' }), LIV_TW(k));
        await (await p.$(LIV_TW(k))).click();
        if (!(await pressed(LIV_TW(k)))) ls2.push(`マウス ${k}: 押しても印が移らない`);
        judge(await ev(livSee), k, 'マウス');
      }
      await still();
      await ev(q => document.querySelector(q).focus(), LIV_TW(keys[0]));
      for (let i = 1; i <= keys.length; i++) {
        const k = keys[i % keys.length];                                   // 2枚め → … → 最後 → Shift+Tab で先頭へ戻る
        if (i < keys.length) await key('Tab'); else for (let j = 1; j < keys.length; j++) await key('Tab', true);
        const a = (await ev(livSee)).active;
        if (a !== `town:${k}`) { ls2.push(`キーボード ${k}: Tab で着かない（焦点 ${a}）`); continue; }
        await key('Enter');
        if (!(await pressed(LIV_TW(k)))) ls2.push(`キーボード ${k}: Enter で印が移らない`);
        judge(await ev(livSee), k, 'キーボード');
      }
      ok(keys.length > 0 && !ls2.length, `${tag}: カードを押すと、その街の詳細だけが出る（キーボードでも）・棒の行の印が移る`, ls2.slice(0, 6).join(' ／ '));
      /* LS3 */
      if (!L.on) ok(!b0.rent && !b0.btns.length, `${tag}: 家賃の棒が無い都市（台帳）には、間取りの切り替えも無い`, `棒の組 ${b0.rent ? '在る' : '無い'}・ボタン ${b0.btns.length}`);
      else {
        const ls3 = [], r0 = await ev(livSee), n = L.bars.length, KEYS = ['Enter', 'Space'];
        const judge3 = (r, k, how) => {
          const on = r.btns.filter(b => b.on).map(b => b.k), shown = r.panels.filter(g => g.shown).map(g => g.k);
          if (!same(on, [k])) ls3.push(`${how}: 押された印 ${on.join('・') || '無し'}（あるべき ${k}）`);
          if (!same(shown, [k])) ls3.push(`${how}: 出ている組 ${shown.join('・') || '無し'}（あるべき ${k} だけ）`);
          if (r.url !== b0.url || r.hist !== b0.hist) ls3.push(`${how}: 住所か履歴が動いた（${b0.hist} → ${r.hist} 段）`);
        };
        if (!r0.rent || !r0.sw) ls3.push(r0.rent ? '切り替えのボタンが見えない' : '家賃の棒の組が無い（台帳には在る）');
        else {
          judge3(r0, L.lead, '開いた時');
          await still();
          await ev(q => { const e = document.querySelector(q); e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.focus({ preventScroll: true }); }, LIV_SZ(L.bars[0]));
          for (let i = 1; i <= n; i++) {
            const k = L.bars[i % n], how = KEYS[(i < n ? i - 1 : n - 1) % 2];   // Enter と Space を交互に（どちらも1回は押す）
            if (i < n) await key('Tab'); else for (let j = 1; j < n; j++) await key('Tab', true);
            await still();
            const a = await ev(livSee);
            if (a.active !== `size:${k}`) { ls3.push(`${k}: Tab で着かない（焦点 ${a.active}）`); continue; }
            await key(how);
            if (!(await pressed(LIV_SZ(k)))) ls3.push(`${k}: ${how} で切り替わらない`);
            await still();
            const r = await ev(livSee);
            judge3(r, k, `${k}（${how}）`);
            if (r.active !== `size:${k}`) ls3.push(`${k}（${how}）: 焦点が押したボタンから外れた（${r.active}）`);
            if (Math.abs(r.y - a.y) > 1) ls3.push(`${k}（${how}）: 画面が動いた（${Math.round(r.y - a.y)}px）`);
          }
        }
        ok(!ls3.length, `${tag}: 間取りの切り替え ── ボタンにキーボードで着いて Enter／Space で切り替わる・出ている組は1つ・履歴を積まない`, ls3.slice(0, 6).join(' ／ '));
      }
      /* LS4 */
      if (!L.on) ok(!b0.tracks, `${tag}: 家賃の棒が無い都市（台帳）には、棒の土台も無い`, `土台 ${b0.tracks}本`);
      else {
        const vals = L.rows.flatMap(x => L.bars.map(k => x.month[k])).filter(v => typeof v === 'number' && v > 0);
        const end = vals.length ? axisEnd(Math.max(...vals)) : NaN;
        const ratio = (id, k) => { const x = L.rows.find(y => y.id === id), v = x ? x.month[k] : null; return typeof v === 'number' && v > 0 ? v / end : null; };
        const ls4 = [], all = [];
        const take = (g, how) => {
          for (const x of L.rows) if (ratio(x.id, g.k) !== null && !g.rows.some(r => r.id === x.id && r.track > 0)) ls4.push(`${how} ${g.k}/${x.id}: 土台が無い`);
          for (const r of g.rows) {
            const v = ratio(r.id, g.k);
            if (v === null) { if (r.track !== null) ls4.push(`${how} ${g.k}/${r.id}: 額の無い行に土台`); continue; }
            if (!(r.track > 0)) continue;
            all.push([`${how} ${g.k}/${r.id}`, r.track]);
            if (!(Math.abs(r.fill - r.track * v) <= 0.6)) ls4.push(`${how} ${g.k}/${r.id}: 棒 ${(+r.fill).toFixed(1)}px（土台 ${r.track.toFixed(1)}px × 台帳の比 ${v.toFixed(4)} ＝ ${(r.track * v).toFixed(1)}px）`);
          }
        };
        const sweep = async how => {
          for (const k of L.bars) {
            await ev(q => document.querySelector(q).click(), LIV_SZ(k));
            if (!(await pressed(LIV_SZ(k)))) { ls4.push(`${how} ${k}: 切り替わらない`); continue; }
            const g = (await ev(livSee)).panels.find(x => x.k === k && x.shown);
            if (g) take(g, how); else ls4.push(`${how} ${k}: 組が出ない`);
          }
        };
        if (!b0.rent) ls4.push('家賃の棒の組が無い（台帳には在る）');
        else {
          await sweep('JPY');
          const cur = await ev(() => { window.PVCurrency.set('USD'); return window.PVCurrency.get(); });
          if (cur !== 'USD') ls4.push(`USD に換わらない（${cur}）`); else await sweep('USD');
          await ev(() => window.PVCurrency.set('JPY'));
          await ev(LIV_BARE);
          const f = await ev(livSee);
          for (const k of L.bars) { const g = f.panels.find(x => x.k === k && x.shown); if (g) take(g, 'HTML のまま'); else ls4.push(`HTML のまま ${k}: 組が出ない`); }
          const ws = all.map(x => x[1]), lo = Math.min(...ws), hi = Math.max(...ws);
          if (!all.length) ls4.push('土台を1本も測れていない');
          else if (hi - lo > 0.5) ls4.push(`土台の長さが揃わない ${lo.toFixed(1)}px（${all.find(x => x[1] === lo)[0]}）〜 ${hi.toFixed(1)}px（${all.find(x => x[1] === hi)[0]}）`);
        }
        ok(!ls4.length, `${tag}: 棒の土台は、どの行も・どの間取りの組も・USD に換えても・切り替えが動かない形でも同じ長さ。棒は土台に対して額の比`, ls4.slice(0, 6).join(' ／ '));
      }
    } else if (w === 390) {
      /* LS7 */
      if (!L.on) ok(!b0.rent && !b0.btns.length, `${tag}: 家賃の棒が無い都市（台帳）には、棒の組も切り替えのボタンも無い`, `棒の組 ${b0.rent ? '在る' : '無い'}・ボタン ${b0.btns.length}`);
      else {
        await ev(LIV_BARE);
        const r = await ev(livSee), ls7 = [];
        if (!r.rent) ls7.push('家賃の棒の組が無い（台帳には在る）');
        if (r.sw) ls7.push('切り替えのボタンが見えている');
        if (!same(r.panels.map(g => g.k), L.bars)) ls7.push(`組 ${r.panels.map(g => g.k).join('・') || '無し'}（台帳 ${L.bars.join('・')}）`);
        for (const g of r.panels) { if (!g.shown) ls7.push(`${g.k}: 組が出ていない`); else if (!g.cap) ls7.push(`${g.k}: 組の見出しが出ていない`); }
        ok(!ls7.length, `${tag}: 切り替えが動かなかった時の形 ── どの間取りの棒も出たまま・切り替えのボタンは出ない`, ls7.join(' ／ '));
      }
    }
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 場面 living の絵（PV_GLANCE_SHOT がある時だけ・合否には使わない）。板が画面より高い時は、画面の高さだけを板が入るまで伸ばし、
   上の帯（ヘッダーとタブ）の下へ板を寄せてから撮る（幅と端末の種類は変えない ＝ 組み方は測った時のまま）。 */
async function livShots(browser, s, [w, h]) {
  const dir = process.env.PV_GLANCE_SHOT.replace(/\/$/, () => ''), L = LIV_BARS[s];
  const { ctx, p } = await open(browser, s, w, h, 'empty');
  const shot = async state => {
    const tall = await p.evaluate(() => Math.ceil(document.getElementById('pvg-p-living').getBoundingClientRect().height));
    await p.setViewport({ width: w, height: Math.max(h, tall + 260), deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
    await p.evaluate(() => new Promise(r => { scrollTo({ top: scrollY + document.getElementById('pvg-p-living').getBoundingClientRect().top - 220, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }));
    await (await p.$('#pvg-p-living')).screenshot({ path: `${dir}/living-${s}-${w}-${state}.png` });
  };
  try {
    await livTab(p);
    await shot('open');
    const towns = await p.evaluate(() => [...document.querySelectorAll('.pvg [data-pvg-towns] .pvg-town[data-town]')].map(b => b.getAttribute('data-town')));
    if (towns[1]) { await p.evaluate(q => document.querySelector(q).click(), LIV_TW(towns[1])); await shot('town2'); }
    if (L.on && L.bars.length) { await p.evaluate(q => document.querySelector(q).click(), LIV_SZ(L.bars[Math.min(2, L.bars.length - 1)])); await shot('size3'); }
    await p.evaluate(() => window.PVCurrency.set('USD'));
    await shot('cur-USD');
    await p.evaluate(() => { window.PVCurrency.set('JPY'); document.documentElement.setAttribute('data-theme', 'dark'); });
    await shot('dark');
  } finally {
    await ctx.close().catch(() => {});
  }
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
   偽のサーバーは、集計・月の勤務・補足の口で、状態の語 'give' を返し（わざと、検査用の行・月の勤務の幅・補足の文を付ける）、
   答えるカードの口で、カードの中身を返す（聞く会社は ANA〔ANA のページでは JAL〕・答えた数 3・要る数 5・聞く質問2つ）。
   見るのは、どのタブでも：見えている集計の欄と月の勤務の欄が、欄の印（data-entry）どおりに「1行だけ」か「1行＋答えるカード」か・
   返事に付いてきた中身が1文字も出ないこと・カードの読み出しが失敗した時・保存できた知らせで読み直すこと。
   ⚠️ 絵の検査。誰が 'give' になるか・数え方が正しいかは、本物の SQL を通す側（db/test-contrib.mjs）が見る。
   下の字は、画面に出るはずの字を検査が自分で持つもの（career-live.js から読み込まない ＝ あちらを変えたら、ここで赤くなる）。 */
const GIVE_W = [390, 768, 1440];
const GIVE_LINE = need => `自分の会社に${need}つ答えると開きます`, GIVE_HEAD = name => `${name}の待遇情報を、足りない情報から埋める`;
const GIVE_COUNT = (have, need) => `あなたが答えた項目：${have}／${need}`, GIVE_GO = '匿名で答える';
const GIVE_LINE_RE = new RegExp(`^${GIVE_LINE('\\d+')}$`);
/* 答えるカードの読み出しが失敗した時に、欄に出る字（読めない時・口がまだ無い時）。 */
const GIVE_ERR = 'いま読み出せません', GIVE_RETRY = 'やり直す';
/* GM4 'give' の人に、タブごとに見えているはずの、集計の欄（fact）と月の勤務の欄（work）── [欄の種類, 居場所, 欄の印, 答えるカードの数]。
   カードを出すかどうかは、欄の印（data-entry）が決める：印なし ＝ 1行＋答えるカード／"0"・"login" ＝ 1行だけ（同じ板のほかの欄が出す）／"give" ＝ 1行＋答えるカード。
     概要 ＝「集まった回答」（印 "give"）／勤務・訓練 ＝ 通勤と Staff Travel の集計（印 "login"：1行だけ）と月の勤務（カードはこちら）・
     黙る2つの集計の欄（勤務予定・休日、昇格・訓練）は見えない（quietBad が別に見る）／
     給与・待遇 ＝ 待遇の集計／暮らし・家族 ＝ 集計・月の勤務の欄なし（街の一覧の欄は giveBad の外）（通勤の回答は、勤務・訓練の通勤の面に1つだけ）。口コミ・ステイ先には、どちらの欄も無い。 */
const GIVE_FACE = {
  overview: [['fact', 'got', 'give', 1]],
  pay: [['fact', 'pvg-p-benefits', null, 1]],
  reviews: [],
  work: [['fact', 'pvg-p-work', 'login', 0], ['fact', 'pvg-p-work', 'login', 0], ['work', 'pvg-p-work', null, 1]],
  life: [],
  stay: [],
};
/* GM4 いま見えている欄（slots ＝ slotsSee() の答え）が、want（GIVE_FACE の1行ぶん）のとおりか。
   どの欄も鍵の形・1行は GIVE_LINE(need)・回答の行は無い。カードを出す欄は、1行のほかに、見出し・答えた数・入口「匿名で答える」の1つだけ。
   カードを出さない欄は、1行のほかに1文字も無い（リンクも無い）。返すのは、破れている所の文（空なら守れている）。 */
function giveBad(slots, want, name, have, need) {
  const bad = [], gated = slots.filter(x => x.live === 'fact' || x.live === 'work'), key = a => a.join(':');
  const got = gated.map(x => key([x.live, x.at, x.entry, x.cards])).sort(), exp = want.map(key).sort();
  if (!same(got, exp)) bad.push(`見えている欄〔種類:居場所:印:カードの数〕が ${got.join('｜') || '無し'}（あるべき ${exp.join('｜') || '無し'}）`);
  for (const x of gated) {
    const say = t => bad.push(`${slotName(x)}: ${t}`), line = GIVE_LINE(need);
    if (x.state !== 'locked') say(`欄が ${x.state}（鍵の形のはず）`);
    if (!same(x.lock, [line])) say(`1行「${x.lock.join('｜')}」（あるべき「${line}」）`);
    if (x.rows) say(`回答の行が ${x.rows}つ`);
    if (x.text !== line + (x.cards ? GIVE_HEAD(name) + GIVE_COUNT(have, need) + GIVE_GO : '')) say(`1行${x.cards ? 'と答えるカード' : ''}のほかの字が在る「${x.text.slice(0, 80)}」`);
    if (x.links.length !== x.cards || x.links.some(a => !(a.on && a.cta && a.text === GIVE_GO))) say(`リンクが ${x.links.length}つ（${x.links.map(a => a.text).join('｜')}）── あるべきは${x.cards ? `「${GIVE_GO}」の1つ` : '無し'}`);
  }
  return bad;
}
/* R-d 答えるカードは、1つのタブに、見えているものが多くて1枚。概要では、開いた板の外に多くて1枚
       （板は1度に1枚しか開かない。板の中の欄のカードは、その板を開いた人にだけ見える）。
       1行だけを出していてカードを持たない欄が在る時、同じタブの見えているどれかの欄に、答えるカードが在る。
   cards ＝ ページの中で見えている答えるカードぜんぶ（板の中に在るものは true）。 */
function cardRule(slots, cards, tab) {
  const bad = [], n = tab === 'overview' ? cards.filter(inPanel => !inPanel).length : cards.length;
  if (n > 1) bad.push(`見えている答えるカードが${tab === 'overview' ? '、開いた板の外に' : ''} ${n}枚`);
  for (const x of slots.filter(x => !x.cards && x.lock.some(t => GIVE_LINE_RE.test(t)))) if (!cards.length) bad.push(`${slotName(x)}が「${x.lock.join('｜')}」の1行だけを出しているのに、同じタブに、見えている答えるカードが無い`);
  return bad;
}
/* GM10 長い社名（20字）。検査のために作った名前で、実在の会社ではない。 */
const GIVE_LONG = 'テスト用の長い名前の航空ホールディングス';
if ([...GIVE_LONG].length !== 20) throw new Error('検査の前提が崩れた（長い社名が20字でない）');
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
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  /* タブを押す → そのタブになるまで待つ → 欄が落ち着くまで待つ（時間では待たない）。 */
  const goTab = async id => {
    await ev(id => document.querySelector(`.pvg-tabs [data-pvg-tab="${id}"]`).click(), id);
    return (await until(id => !!window.PVGlance && window.PVGlance.at() === id && document.body.classList.contains(`pvg-at-${id}`), id)) && (await until(SETTLED));
  };
  /* 同じページを開き直す（答えるカードの口の返事を差し替えてから）。 */
  const reopen = async () => {
    await p.reload({ waitUntil: 'load', timeout: 60000 });
    const calm = await p.waitForFunction(SETTLED).then(() => true, () => false);
    await ev(LIB);
    return calm;
  };
  /* 偽のサーバーが呼ばれた回数（集計・月の勤務・補足・答えるカード）。 */
  const calls = () => ({ fact: seen.factCalls.length, month: seen.sideCalls[0], notes: seen.sideCalls[1], give: seen.giveCalls });
  const NEW = (a, b) => `集計 ${b.fact - a.fact}回・月の勤務 ${b.month - a.month}回・補足 ${b.notes - a.notes}回・答えるカード ${b.give - a.give}回`;
  /* いま見えている欄・見えている答えるカード（板の中に在るものは true）・返事に付いてきた中身のうち、画面に出ている字。 */
  const seeAll = async () => ({
    slots: await ev(slotsSee),
    ...(await ev((page, slot) => {
      const vis = e => e.getClientRects().length > 0, t = document.body.innerText, c = [...document.querySelectorAll('.crl')].map(e => e.textContent).join('\n');
      return { cards: [...document.querySelectorAll('.crl-give')].filter(vis).map(e => !!e.closest('.pvg-panel')), leak: [...page.filter(x => t.includes(x) || c.includes(x)), ...slot.filter(x => c.includes(x))] };
    }, GIVE_LEAK, LEAK_SLOT)),
  });
  /* カードの入口を押す。面の入口（PVContrib.openFor）は、押す前に記録係に差し替える：
     'opens' ＝ true を返す・'refuses' ＝ false を返す・'none' ＝ 入口そのものを外す。 */
  const record = how => ev((sel, how) => {
    const a = document.querySelector(sel + ' a[data-crl-give]'), C = window.PVContrib, calls = [];
    if (!a || !C) return null;
    const had = typeof C.openFor;
    if (how === 'none') delete C.openFor;
    else C.openFor = o => { calls.push({ airline: o && o.airline, name: o && o.name, ask: o && o.ask, from: !!o && o.from === a }); return how === 'opens'; };
    a.click();
    return { calls, had, now: typeof C.openFor };
  }, SEL, how);
  /* ページが移ろうとした行き先が n 個たまるまで待つ（seen.nav を置いた場面でだけ）。 */
  const navs = async n => { for (const t0 = Date.now(); seen.nav.length < n && Date.now() - t0 < 8000;) await new Promise(go => setTimeout(go, 20)); };
  const saved = () => ev(slug => { document.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'roster', slug } })); }, G.airline);
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
    /* GM4・R-d・GM5 6つのタブを順に開き（概要は、開いた直後の形と、勤務の板を開いた形）、開くたびに1回だけ読む。判定は外でする。
         GM4 見えている集計の欄と月の勤務の欄は、GIVE_FACE のとおり（欄の印が "0" の欄は1行だけ・ほかは1行＋答えるカード）。
         R-d 答えるカードは、1つのタブに多くて1枚（概要では、開いた板の外に多くて1枚）・1行だけの欄が在るタブには、どこかにカードが在る。
         GM5 偽のサーバーは 'give' の返事に、わざと中身を付けて返している（検査用の行・月の勤務の幅・補足の文）── その字は、
             どのタブでも、ページの字にも欄の字にも無い（人数と額は、欄の字でだけ見る：「3人そろった項目だけ」のような地の文が、欄の外に在る）。 */
    {
      const F = { gm4: [], rd: [], leak: [] }, lost = t => { for (const k of Object.keys(F)) F[k].push(t); };
      const judge = async (tab, at, want) => {
        const x = await seeAll();
        for (const b of giveBad(x.slots, want, G.name, 3, 5)) F.gm4.push(`${at} ── ${b}`);
        if (want.some(w => w[1] === 'pvg-p-work')) for (const b of quietBad(await ev(quietSee))) F.gm4.push(`${at} ── ${b}`);
        for (const b of cardRule(x.slots, x.cards, tab)) F.rd.push(`${at} ── ${b}`);
        if (x.leak.length) F.leak.push(`${at} ── ${[...new Set(x.leak)].join(' ')}`);
      };
      await judge('overview', `「${TAB_NAME.overview}」`, GIVE_FACE.overview);
      /* 概要で、勤務の板を開いた形：板の中に、通勤と Staff Travel の集計（1行だけ）と月の勤務（1行＋カード）・黙る2つの欄は見えない。板の外のカードは「集まった回答」の1枚のまま。 */
      {
        const PANEL = 'pvg-p-work', btn = await p.$(`.pvg .pvg-more[aria-controls="${PANEL}"]`);
        if (btn) await press(btn);
        const up = !!btn && (await until(id => !document.getElementById(id).hidden, PANEL)) && (await until(SETTLED));
        if (!up) lost('概要で、勤務の板を開けない・欄が落ち着かない');
        else await judge('overview', `「${TAB_NAME.overview}」で勤務の板を開いた形`, [...GIVE_FACE.overview, ...GIVE_FACE.work]);
        if (up) { await press(btn); await until(id => document.getElementById(id).hidden, PANEL); }
      }
      for (const id of TAB_IDS.filter(id => id !== 'overview')) {
        if (!(await goTab(id))) { lost(`「${TAB_NAME[id]}」へ移れない・欄が落ち着かない`); continue; }
        await judge(id, `「${TAB_NAME[id]}」`, GIVE_FACE[id]);
      }
      ok(!F.gm4.length, `${tag}: どのタブでも、見えている集計の欄と月の勤務の欄は「${GIVE_LINE(5)}」の1行 ── 答えるカードを出すのは、欄の印が許す欄だけ（概要 ＝「集まった回答」・勤務・訓練 ＝ 月の勤務〔通勤と Staff Travel の集計は1行だけ・黙る2つの欄は鍵の形で見えず字なし〕・給与・待遇 ＝ 待遇の集計・暮らし・家族 ＝ 欄なし）`, [...new Set(F.gm4)].slice(0, 6).join(' ／ '));
      ok(!F.rd.length, `${tag}: 答えるカードは、どのタブでも、見えているものが多くて1枚（概要では、開いた板の外に多くて1枚）・1行だけの欄が在るタブには、見えているどれかの欄に、答えるカードが在る`, [...new Set(F.rd)].slice(0, 6).join(' ／ '));
      ok(!F.leak.length, `${tag}: 'give' の返事に付いてきた中身（回答の行の人数・中央値・月の勤務の幅・補足の文）が、どのタブでも、ページの字にも欄にも出ていない`, [...new Set(F.leak)].slice(0, 6).join(' ／ '));
      if (!(await goTab('overview'))) lost('概要へ戻れない');
    }
    /* GM8b 保存できた知らせ（pvc:saved）で、答えるカードの読み出しも、もう一度だけ呼ぶ ── 答えた数と、次に聞く質問が、新しい返事のものに替わる。
            偽のサーバーの返事を「答えた数 4・次に聞くのは、2つめの質問だけ」に替えてから、知らせを流す（読み込み直さない）。 */
    {
      const n0 = calls(), next = GIVE_ASK[1];
      seen.give = { body: giveBody('give', s, { have: 4, ask: [next] }) };
      await saved();
      const drawn = await until((sel, text) => { const n = document.querySelector(sel + ' .crl-give-n'); return !!n && n.textContent.trim() === text; }, SEL, GIVE_COUNT(4, 5));
      await until(SETTLED);
      const n1 = calls(), g = await slotOf(), a = await record('opens'), bad = [];
      if (n1.give !== n0.give + 1) bad.push(`答えるカードの口を ${n1.give - n0.give}回呼んだ（あるべき 1回）`);
      if (!drawn || !g || !same(g.count, [GIVE_COUNT(4, 5)])) bad.push(`答えた数「${g ? g.count.join('｜') : ''}」（あるべき「${GIVE_COUNT(4, 5)}」）`);
      if (!g || g.links.length !== 1 || !g.links[0].href.endsWith(`airline-conditions.html?airline=${G.airline}&q=${next}`)) bad.push(`入口の行き先 ${g ? g.links.map(x => x.href).join('｜') : ''}（あるべきは &q=${next}）`);
      if (!a || !same(a.calls, [{ airline: G.airline, name: G.name, ask: [next], from: true }])) bad.push(`押した時に面へ渡した中身 ${JSON.stringify(a && a.calls).slice(0, 160)}`);
      ok(!bad.length, `${tag}: 保存できた知らせで、答えるカードの読み出しを、もう一度だけ呼ぶ ── 答えた数が「${GIVE_COUNT(4, 5)}」に替わり、入口の行き先と、面へ渡す質問が、次に聞く質問（${next}）に替わる`, bad.join(' ／ '));
    }
    /* GM8 要る数まで答えたあとの知らせ：偽のサーバーを「開いている人」の返事に替えてから、同じ知らせを流す（読み込み直さない）。
           流すのは「勤務・訓練」のタブ（集計の欄4つ〔通勤・Staff Travel・黙る2つ〕と月の勤務の欄。開いた返事では5つとも開いた形になる）。知らせの前には1回も呼ばない。知らせのあと、
           集計・月の勤務・補足の口を1回ずつだけ呼ぶ（答えるカードの口は呼ばない）。欄は鍵の形でなくなり、答えるカードは1枚も残らない。
           概要へ戻ると「集まった回答」に行が出ている（集計の口は、もう呼ばない）。ページは読み込み直されていない（置いた印が残っている）。 */
    {
      const bad = [], rowsWant = FACT_ROWS.filter(f => !f.want.none).length, at = await goTab('work');
      await ev(() => { window.__pvgKeep = 'kept'; });
      const n0 = calls();
      seen.give = null; seen.mode = 'giveOpen';
      await ev(() => new Promise(go => requestAnimationFrame(() => requestAnimationFrame(go))));
      const n1 = calls();
      await saved();
      const opened = await until(() => {
        const b = [...document.querySelectorAll('#pvg-p-work .crl[data-live="fact"], #pvg-p-work .crl[data-live="work"]')];
        return b.length === 5 && b.every(e => /^(open|empty)$/.test(e.dataset.state));
      });
      await until(SETTLED);
      const n2 = calls(), x = await seeAll();
      const back = await goTab('overview'), g = await slotOf(), n3 = calls();
      const left = await ev(() => ({ cards: document.querySelectorAll('.crl-give').length, keep: window.__pvgKeep || '' }));
      if (!at) bad.push('「勤務・訓練」へ移れない');
      if (!same(n1, n0)) bad.push(`知らせの前に呼んだ（${NEW(n0, n1)}）`);
      if (!same([n2.fact - n1.fact, n2.month - n1.month, n2.notes - n1.notes, n2.give - n1.give], [1, 1, 1, 0])) bad.push(`知らせのあとに呼んだのが ${NEW(n1, n2)}（あるべきは 集計・月の勤務・補足を1回ずつ、答えるカードは0回）`);
      if (!opened) bad.push('「勤務・訓練」の集計の欄と月の勤務の欄が、開いた形にならない');
      for (const y of x.slots.filter(y => y.live === 'fact' || y.live === 'work')) if (y.lock.length || y.cards || !/^(open|empty)$/.test(y.state)) bad.push(`${slotName(y)}が ${y.state}（鍵の1行 ${y.lock.length}つ・答えるカード ${y.cards}枚）`);
      if (!back || !g || g.state !== 'open' || g.facts !== rowsWant) bad.push(`概要の「集まった回答」が ${g ? `${g.state}・回答の行 ${g.facts}つ` : '無い'}（あるべき open・${rowsWant}行）`);
      if (n3.fact !== n2.fact) bad.push(`概要へ戻った時に、集計の口をもう ${n3.fact - n2.fact}回呼んだ`);
      if (left.cards) bad.push(`答えるカードが ${left.cards}枚残っている`);
      if (left.keep !== 'kept') bad.push('ページが読み込み直された（置いた印が消えた）');
      ok(!bad.length, `${tag}: 要る数まで答えたあとの知らせで、集計・月の勤務・補足の口を1回ずつだけ読み直す（知らせの前には呼ばない・読み込み直さない）── 鍵の1行も答えるカードも残らず、「集まった回答」に行が出る`, bad.slice(0, 6).join(' ／ '));
      seen.mode = 'give';
    }
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
           面の入口は、押す前に記録係に差し替える（上の record）。 */
    {
      seen.nav = [];
      const href0 = await ev(() => location.href);
      const a1 = await record('opens');
      await ev(() => new Promise(go => requestAnimationFrame(() => requestAnimationFrame(go))));
      const stay = { href: (await ev(() => location.href)) === href0, nav: seen.nav.length };
      const a2 = await record('refuses');
      await navs(1);
      const a3 = await record('none');
      await navs(2);
      const want = [{ airline: G.airline, name: G.name, ask: GIVE_ASK, from: true }], to = `/airline-conditions.html?airline=${G.airline}&q=${GIVE_ASK[0]}`;
      ok(!!a1 && a1.had === 'function' && same(a1.calls, want) && stay.href && stay.nav === 0 && !!a2 && same(a2.calls, want) && !!a3 && a3.now === 'undefined' && same(seen.nav, [to, to]),
         `${tag}: 「${GIVE_GO}」を押すと、読む人自身の会社（${G.name}）について「情報を追加」の面を開く ── 会社・名前・聞く質問を1回渡し、面が開けばページは移らない。面が開かなかった時と、面の入口が無い時は、リンクのまま質問の画面（${to}）へ進む`,
         JSON.stringify({ opens: a1, stay, refuses: a2 && a2.calls.length, none: a3 && a3.now, nav: seen.nav }).slice(0, 320));
      seen.nav = null;
    }
    /* GM7 一覧に無い会社（符号 'other'）が自分の会社の人。社名はサーバーが返した字で、タグの形をしていても、字としてしか出ない。
           入口の行き先は、質問の画面そのもの（会社も質問も付けない ── あちらが、いちばん新しい給与の会社について開く）。
           押しても「情報を追加」の面は呼ばない（面は、一覧に在る会社しか開けない）＝ リンクのまま進む。 */
    {
      const NAME = 'Test <b>Charter</b>', bad = [];
      seen.give = { body: giveBody('give', s, { airline: 'other', name: NAME, ask: [] }) };
      const g = (await reopen()) ? await slotOf() : null;
      if (!g) bad.push('開き直したページが落ち着かない／「集まった回答」の欄が無い');
      else {
        if (g.cards !== 1 || !same(g.head, [GIVE_HEAD(NAME)])) bad.push(`見出し「${g.head.join('｜')}」（あるべき「${GIVE_HEAD(NAME)}」）`);
        const tags = await ev(sel => document.querySelectorAll(`${sel} .crl-give b, ${sel} .crl-give-h *`).length, SEL);
        if (tags) bad.push(`社名の中のタグが、要素として ${tags}つ出来ている`);
        if (g.links.length !== 1 || !/(^|\/)airline-conditions\.html$/.test(g.links[0].href)) bad.push(`入口の行き先 ${g.links.map(a => a.href).join('｜')}（あるべきは、? の付かない airline-conditions.html）`);
        seen.nav = [];
        const a = await record('opens');
        await navs(1);
        if (!a || a.calls.length) bad.push(`押した時に「情報を追加」の面を ${a ? a.calls.length : '?'}回呼んだ（一覧に無い会社では呼ばない）`);
        if (!same(seen.nav, ['/airline-conditions.html'])) bad.push(`押した先 ${JSON.stringify(seen.nav)}（あるべき /airline-conditions.html）`);
        seen.nav = null;
      }
      ok(!bad.length, `${tag}: 一覧に無い会社が自分の会社の時 ── 社名は字として出る（タグとして働かない）・入口の行き先は質問の画面そのもの（会社も質問も付けない）・押しても「情報を追加」の面は呼ばず、リンクのまま進む`, bad.join(' ／ '));
    }
    /* GM10 社名が長い時（20字）。答えるカードは欄の中に収まり、見出しは折れて、字がカードの外へ出ない。入口は高さ 44px 以上。
            キーボードで入口に着くと、輪が出る（入口に置いてから Shift+Tab → Tab）。
            PV_GLANCE_SHOT=<フォルダ> を渡すと、その形を撮って置く（明るい色・暗い色・輪が出た形。検査の合否には使わない）。 */
    {
      const bad = [];
      seen.give = { body: giveBody('give', s, { name: GIVE_LONG }) };
      const m = (await reopen()) ? await ev(sel => {
        const slot = document.querySelector(sel + ' .crl[data-live="fact"]'), card = slot && slot.querySelector('.crl-give'), hd = card && card.querySelector('.crl-give-h'), a = card && card.querySelector('a[data-crl-give]');
        if (!hd || !a) return null;
        a.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const S = slot.getBoundingClientRect(), C = card.getBoundingClientRect(), A = a.getBoundingClientRect(), rg = document.createRange();
        rg.selectNodeContents(hd);
        const q = [...rg.getClientRects()];
        return {
          head: hd.textContent.trim(), inside: C.left >= S.left - 1 && C.right <= S.right + 1 && C.top >= S.top - 1 && C.bottom <= S.bottom + 1 && A.left >= C.left - 1 && A.right <= C.right + 1,
          over: [slot, card, hd].map(e => e.scrollWidth - e.clientWidth), page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cut: q.filter(r => r.right > C.right + 0.5 || r.left < C.left - 0.5).length, lines: new Set(q.map(r => Math.round(r.top))).size, aH: Math.round(A.height),
        };
      }, SEL) : null;
      if (!m) bad.push('開き直したページが落ち着かない／答えるカードが無い');
      else {
        if (m.head !== GIVE_HEAD(GIVE_LONG)) bad.push(`見出し「${m.head}」`);
        if (!m.inside) bad.push('答えるカード（か、その入口）が、欄の外へ出ている');
        if (m.over.some(d => d > 1) || m.page > 1) bad.push(`横にあふれている（欄 ${m.over[0]}px・カード ${m.over[1]}px・見出し ${m.over[2]}px・ページ ${m.page}px）`);
        if (m.cut) bad.push(`見出しの字が、カードの外へ出ている（${m.cut}か所・${m.lines}行）`);
        if (m.aH < 44) bad.push(`入口の高さ ${m.aH}px（44px 以上のはず）`);
        await ev(sel => document.querySelector(sel + ' a[data-crl-give]').focus(), SEL);
        await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); await p.keyboard.press('Tab');
        const ring = await ev(sel => { const a = document.querySelector(sel + ' a[data-crl-give]'), cs = getComputedStyle(a); return { at: document.activeElement === a, fv: a.matches(':focus-visible'), style: cs.outlineStyle, px: parseFloat(cs.outlineWidth) || 0 }; }, SEL);
        if (!(ring.at && ring.fv && ring.style === 'solid' && ring.px >= 2)) bad.push(`キーボードで入口に着いた時の輪（入口に居る ${ring.at}・:focus-visible ${ring.fv}・outline ${ring.px}px ${ring.style}）`);
        if (process.env.PV_GLANCE_SHOT) {
          const dir = process.env.PV_GLANCE_SHOT.replace(/\/$/, ''), box = await p.$(SEL), theme = t => ev(t => { const r = document.documentElement; if (t === null) r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); }, t);
          const was = await ev(() => document.documentElement.getAttribute('data-theme'));
          await box.screenshot({ path: `${dir}/give-${s}-${w}-ring.png` });
          await ev(() => document.activeElement && document.activeElement.blur());
          await box.screenshot({ path: `${dir}/give-${s}-${w}.png` });
          await theme('dark');
          await box.screenshot({ path: `${dir}/give-${s}-${w}-dark.png` });
          await theme(was);
        }
      }
      ok(!bad.length, `${tag}: 社名が長い時（20字）── 答えるカードは欄の中に収まる・見出しは折れて、字がカードの外へ出ない・入口は高さ 44px 以上・キーボードで入口に着くと、輪が出る`, bad.join(' ／ '));
    }
    /* GM6 答えるカードの読み出しが失敗した時（'give' の欄はどれも、1行の「◯つ」にこの返事が要る）。
         (1) 500 → 見えている欄は「いま読み出せません」＋「やり直す」。
         (2) 'open' の1語（別のタブで要る数まで答えた直後 ＝ 読む口は、まだ 'give' と言っている）→ 同じく「いま読み出せません」＋「やり直す」。
             「やり直す」を押すと、答えるカードの口をもう1回だけ呼び、読む口は呼ばない。1行はそのまま残る（次に読み込むまで・次の知らせまで）。
         (3) 404（口がまだ無い）→「準備中」だけ（「やり直す」は出ない）。
       どの形でも：数字を書いた1行（◯つ答えると開きます）を出さない・中身の無い答えるカードを出さない。
       概要を開き直して「集まった回答」を見たあと、「勤務・訓練」のタブ（見えている欄は、月の勤務と、通勤・Staff Travel の集計の3つ。黙る2つの欄は
       答えるカードを読まずに鍵の形のまま隠れている）で、返事を差し替えながら「やり直す」を押す。 */
    {
      const bad = [], gated = async () => (await ev(slotsSee)).filter(x => x.live === 'fact' || x.live === 'work');
      const fault = (slots, n, state, text, at) => {
        if (slots.length !== n) bad.push(`${at}: 見えている集計・月の勤務の欄が ${slots.length}つ（あるべき ${n}つ）`);
        for (const x of slots) {
          if (x.state !== state || x.text !== text) bad.push(`${at}: ${slotName(x)}が ${x.state}「${x.text.slice(0, 40)}」（あるべき ${state}「${text}」）`);
          if (x.cards || x.lock.length) bad.push(`${at}: ${slotName(x)}に、鍵の1行 ${x.lock.length}つ・答えるカード ${x.cards}枚`);
          if (x.retry !== (state === 'error' ? 1 : 0)) bad.push(`${at}: ${slotName(x)}の「${GIVE_RETRY}」が ${x.retry}つ`);
        }
      };
      const retry = async at => {
        if (!(await ev(() => { const b = document.querySelector('#pvg-p-work .crl .crl-retry'); if (b) b.click(); return !!b; }))) bad.push(`${at}: 押す「${GIVE_RETRY}」が無い`);
        await until(SETTLED);
      };
      seen.give = { status: 500, body: '{"message":"stub"}' };
      if (!(await reopen())) bad.push('開き直したページが落ち着かない');
      fault(await gated(), 1, 'error', GIVE_ERR + GIVE_RETRY, '500・概要');
      if (!(await goTab('work'))) bad.push('「勤務・訓練」へ移れない');
      fault(await gated(), 3, 'error', GIVE_ERR + GIVE_RETRY, '500・勤務・訓練');
      seen.give = { body: stateBody('open') };
      const n0 = calls();
      await retry(`'open' の返事`);
      const n1 = calls();
      fault(await gated(), 3, 'error', GIVE_ERR + GIVE_RETRY, `'open' の返事`);
      await retry(`'open' の返事・2回め`);
      const n2 = calls();
      fault(await gated(), 3, 'error', GIVE_ERR + GIVE_RETRY, `'open' の返事・2回め`);
      for (const [a, b, at] of [[n0, n1, '1回め'], [n1, n2, '2回め']]) if (!same([b.fact - a.fact, b.month - a.month, b.notes - a.notes, b.give - a.give], [0, 0, 0, 1])) bad.push(`「${GIVE_RETRY}」の${at}で呼んだのが ${NEW(a, b)}（あるべきは、答えるカードの口を1回だけ）`);
      seen.give = { status: 404, body: '{"code":"PGRST202","message":"stub"}' };
      await retry('404');
      fault(await gated(), 3, 'off', FACT_OFF, '404');
      ok(!bad.length, `${tag}: 答えるカードの読み出しが失敗した時 ── 読めない時と、'open' の1語が返った時は「${GIVE_ERR}」＋「${GIVE_RETRY}」（押すと、答えるカードの口だけをもう1回呼ぶ・1行は残る）・口が無い時は「${FACT_OFF}」。数字を書いた1行も、中身の無いカードも出さない`, [...new Set(bad)].slice(0, 6).join(' ／ '));
    }
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}
/* 「回答が開いている人」（GM9）：ログインも給与の提出も済んでいて、ほかの人の回答を見てよい人
   （自分の会社のページを見ている・自分の会社に、要る数まで答えた）。偽のサーバーは最初から、開いた返事を返す：
   集計の口は、検査用の行（FACT_ROWS・BEN_ROWS と、聞いてもいない質問の1行）・月の勤務は数字なし・補足は0件。
   回答の行が画面に出るのは、偽のサーバーの場面では、ここだけ ＝ 行の中身（最多／分かれた／中央値・回答 N人・年月）と、
   行が出た形での切れ・はみ出しは、ここで見る（digestRowsOk・benRowsOk は、鍵の無い会員の場面から、ここへ移ってきた）。
   ⚠️ 絵の検査。誰に開いた返事が返るか・「最多」の決め方が正しいかは、本物の SQL を通す側（db/test-contrib.mjs）が見る。 */
async function runGiveOpen(browser, s, [w, h]) {
  const tag = `${s} ${w}（回答が開いている人）`;
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'giveOpen');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  try {
    ok(ready, `${tag}: 「読み込み中」のまま固まらない`);
    await ev(() => window.__pvg.top());
    const live = (await ev(() => window.__pvg.live())).filter(x => x.on);
    /* 開いた面：見えている集計の欄と月の勤務の欄に、鍵の1行も、答えるカードも無い（読み出せない・準備中にもなっていない）。
       聞いてもいない質問の行（LEAK_ROW）の数字は、ページの字にも欄にも無い。 */
    {
      const bad = [], slots = (await ev(slotsSee)).filter(x => x.live === 'fact' || x.live === 'work');
      if (!slots.some(x => x.at === 'got')) bad.push('「集まった回答」の欄が見えていない');
      for (const x of live.filter(x => /^(fact|work)$/.test(x.kind) && !/^(open|empty)$/.test(x.state))) bad.push(`見えている欄（${x.kind}）が ${x.state}`);
      for (const x of slots) if (x.lock.length || x.cards || x.retry) bad.push(`${slotName(x)}に、鍵の1行 ${x.lock.length}つ・答えるカード ${x.cards}枚・「やり直す」${x.retry}つ`);
      const leak = await ev(list => {
        const t = document.body.innerText, c = [...document.querySelectorAll('.crl')].map(e => e.textContent).join('\n');
        return list.filter(x => t.includes(x) || c.includes(x));
      }, [String(LEAK_ROW.median_num), `${LEAK_ROW.n}人`]);
      if (leak.length) bad.push(`聞いていない質問の行の字が出ている（${leak.join(' ')}）`);
      if (seen.giveCalls) bad.push(`答えるカードの口を ${seen.giveCalls}回呼んだ（開いている人には要らない）`);
      ok(!bad.length, `${tag}: 開いている人 ── 見えている集計の欄と月の勤務の欄に、鍵の1行も答えるカードも無い・聞いていない質問の行は出ない・答えるカードの口は呼ばない`, bad.slice(0, 5).join(' ／ '));
    }
    /* 回答が在る時（検査用の集計 FACT_ROWS）── 2つの数え方が同じ画面に並んだ時に、混ざらないこと。
       「ひとつ教えて」のカードの中で、人数（回答 ◯人）が出るのは「集まった回答」の欄だけ。
       話題の札は「質問 N問」のまま ＝ 札に人数・件数・「回答」の字が入らない。
       逆も見る：「集まった回答」の欄に「◯問」と書かない（質問の数を、回答の数のように見せない）。
       鍵の無い会員の場面では行が1つも出ないので、2つが並ぶのを見られるのはここだけ。行の中身は digestRowsOk。 */
    {
      const got = await ev(() => {
        const c = document.querySelector('.pvg-askc'), box = c.querySelector('.pvg-got'), slot = box && box.querySelector('.crl[data-live="fact"]');
        const vis = el => !!el && el.getClientRects().length > 0, tx = el => (el ? el.textContent : '').trim();
        return {
          state: slot ? slot.dataset.state : null, keys: slot ? (slot.getAttribute('data-keys') || '').split(',') : [], text: tx(box),
          stray: [...c.querySelectorAll('.crl-fact')].filter(r => !r.closest('.pvg-got')).length,
          plates: [...c.querySelectorAll('details.pvg-topic > summary')].map(x => ({ on: vis(x), text: tx(x) })),
        };
      });
      const want = FACT_ROWS.filter(f => got.keys.includes(f.question_id)).sort((a, b) => got.keys.indexOf(a.question_id) - got.keys.indexOf(b.question_id));
      const bad = [];
      if (got.state !== 'open') bad.push(`回答の欄が ${got.state}（回答が出た形のはず）`);
      if (want.length !== FACT_ROWS.length) bad.push(`検査用の ${FACT_ROWS.length}行のうち、欄が持つ質問は ${want.length}行`);
      if (/\d\s*問/.test(got.text)) bad.push('「集まった回答」の欄に「◯問」と書いてある');
      if (got.stray) bad.push(`回答の行が、欄の外に ${got.stray}つ`);
      if (got.plates.length !== 4) bad.push(`話題の札 ${got.plates.length}枚`);
      for (const t of got.plates) {
        if (!t.on) bad.push(`札「${t.text.slice(0, 12)}」が見えていない`);
        if (/回答|\d\s*[人件]/.test(t.text)) bad.push(`札に回答の数が入っている「${t.text}」`);
        if (!/質問 \d+問/.test(t.text)) bad.push(`札に「質問 N問」が無い「${t.text}」`);
      }
      ok(!bad.length, `${tag}: 回答が在る時 ── カードの中で人数（回答 ◯人）が出るのは「集まった回答」の欄だけ・話題の札は「質問 N問」のまま（2つの数え方を混ぜない）`, bad.slice(0, 4).join(' ／ '));
      await digestRowsOk(p, tag, '.pvg-askc .pvg-got', got.keys);
    }
    /* 行が出た形で測る（鍵の無い会員の場面の同じ2本は、行の無い画面を測っている）。 */
    const geo = await ev(() => window.__pvg.geom(true));
    ok(!geo.length, `${tag}: 切れ・はみ出し・重なりが無い`, geo.slice(0, 8).join('\n      '));
    /* 給与・待遇のタブ：待遇の板の集計（着陸手当の2行）と、その形での切れ・はみ出し。 */
    {
      await ev(() => document.querySelector('.pvg-tabs [data-pvg-tab="pay"]').click());
      await p.waitForFunction(() => !!window.PVGlance && window.PVGlance.at() === 'pay' && document.body.classList.contains('pvg-at-pay'), { timeout: 15000 }).then(() => true, () => false);
      await benRowsOk(p, tag);
      const geo3 = await ev(() => window.__pvg.geom(true));
      ok(!geo3.length, `${tag}: 給与・待遇のタブでも、切れ・はみ出し・重なりが無い`, geo3.slice(0, 8).join('\n      '));
    }
    ok(!seen.unknown.size, `${tag}: 実データの欄が呼ぶのは、検査が知っている11だけ`, [...seen.unknown].join(' '));
  } catch (e) {
    ok(false, `${tag}: 最後まで測れた`, String(e && e.message).slice(0, 300));
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════════════
   場面 towns（--scenes towns）── 暮らしの板の「パイロットの回答」の欄（.pvg-liv-got > .crl[data-live="towns"]。
   描くのは career-live.js の KIND.towns）。偽のサーバーの返事を、状態ごとに差し替える：seen.town ＝ { status, body }
   （pv_town_board の返事）と mine（my_town_posts の返事。置かなければ0件）。描き直させるのは、街を保存した時の知らせ
   （'pvc:saved' の topic 'town' ── 欄はこの時、必ず読み直す）。幅は 390 と 1440（--sizes を付けた回は、その幅）。
   1枚のページの中で、次の順に移す：
     M1  未ログイン（'login'）：鍵の形・「ログインと給与の提出で開きます」・欄の入口は「ログイン」1つ・欄に数字が無い・
         見出し「パイロットの回答」・「＋住みやすい街を追加」は欄の外で、欄より前
     M5  開いていて、街0・自分の行も無い：欄は 'empty'・器（.pvg-liv-got）ごと出ない・入口は見えたまま
     M6  人数の無い街・人数 0 の街・人数が整数でない街は描かない（「0人」を出さない）
     M4  開いていて3つ（3人・1人・1人）：「人気の居住地」・返事の並びのまま（名前で並べ替えない）・「回答 N人」・
         「良い点」「気になる点」と文・「あなたの投稿」は自分のものにだけ・順位を付けない（番号も「位」も無い）
     M9  USD に替えても、欄の字は1文字も変わらない（会員の文「家賃は20万円くらい」を額として換算しない）
     M11 開いている欄：ほかの話題（月の勤務）の保存の知らせでは読み直さない（通信 0・欄の中身もそのまま）／
         街の保存の知らせでは1回だけ読み直す（★鍵の1行を出している欄は、どの保存のあとでも読み直す ＝ ここは開いた欄で見る）
     M7  404（口がまだ無い）→「準備中」／500 →「いま読み出せません」＋「やり直す」・押すと聞き直す（1回）
     M8  'give' → 02b の1行と答えるカード
     M2  鍵の無い会員（'locked'）の自分の行。街の名前はタグの形（HOSTILE）：「あなたの投稿」・名前は字のまま（要素が生まれない）・
         「確認待ち」・「修正」で街の面が開き、欄にその名前・面の見出しは「住みやすい街」（直す回は「…を追加」と言わない）・
         送るボタンは「匿名で更新する」
     M3  'locked' の返事に街が付いてきても、欄にもページにも保存領域にも1文字も出ない
     M10 キーボード：Tab で「＋住みやすい街を追加」に着く・Enter で面が開く・Escape で閉じる・焦点は入口へ戻る
   会員にするのは M2 から。ログインの鍵はページが開いたあとに置く（登録だけの会員に出す板を呼ばない）。
   面（pv-contrib.js）を初めて開くのは M2 の「修正」── 未ログインのまま面を開いたあとで会員に替わると、「修正」の街の名前が
   読む人の替わりの片づけ（readerReset）で消える（検査の外で見つけた穴。直すのはこの場面ではない）。
   ⚠️ 街の名前と文は、検査のために作った架空のもの（この検査のファイルの中にしか無い）。本物の投稿ではない。
   ⚠️ 絵の検査。誰に開くか・人数の数え方は、本物の SQL を通す側（db/test-towns.mjs・assert-towns.mjs）が見る。
   下の字は、画面に出るはずの字を検査が自分で持つもの（career-live.js・pv-contrib.js から読み込まない ＝ あちらを変えたら、ここで赤くなる）。
   ══════════════════════════════════════════════════════════════════ */
const TOWNS_W = [390, 1440];
const TOWN_GOT = 'パイロットの回答', TOWN_HEAD = '人気の居住地', TOWN_MINE = 'あなたの投稿', TOWN_WAIT = '確認待ち', TOWN_EDIT = '修正';
const TOWN_GOOD = '良い点', TOWN_CONCERN = '気になる点', TOWN_OFF = '準備中', TOWN_ERR = 'いま読み出せません', TOWN_RETRY = 'やり直す';
const TOWN_SHEET = '住みやすい街', TOWN_UPD = '匿名で更新する';
const townN = n => `回答 ${n}人`;
const townOpen = towns => JSON.stringify({ ok: true, state: 'open', towns });
const TOWN_RENT = '家賃は20万円くらい';
/* M4 の3つ。並びは返事のまま（人数の多い順）＝ 名前の並び（ア・イ・ウ）とは違う並びにしてある */
const TOWN_THREE = [
  { name: '検査の街ウ', n: 3, mine: false, good: [{ text: TOWN_RENT, mine: false }, { text: '駅が近い（検査用）', mine: true }], concern: [{ text: '夜がにぎやか（検査用）', mine: false }] },
  { name: '検査の街ア', n: 1, mine: true, good: [], concern: [{ text: '坂が多い（検査用）', mine: false }] },
  { name: '検査の街イ', n: 1, mine: false, good: [{ text: '公園が近い（検査用）', mine: false }], concern: [] },
];
/* M6 描くのは、本当の人数（1 以上の整数）を持つ最後の1つだけ */
const TOWN_ODD = [
  { name: '人数の無い街（検査用）', mine: false, good: [{ text: '描かれてはいけない文（検査用）', mine: false }], concern: [] },
  { name: '人数ゼロの街（検査用）', n: 0, mine: false, good: [], concern: [] },
  { name: '人数が半端な街（検査用）', n: 1.5, mine: false, good: [], concern: [] },
  { name: '二人の街（検査用）', n: 2, mine: false, good: [], concern: [] },
];
const TOWN_LEAK = '検査用の街の名前です。鍵の掛かった人の画面に出てはいけません', TOWN_LEAK_T = '検査用の街の文です。鍵の掛かった人の画面に出てはいけません';
const TOWN_LOCKED_LEAK = JSON.stringify({ ok: true, state: 'locked', towns: [{ name: TOWN_LEAK, n: 4, mine: false, good: [{ text: TOWN_LEAK_T, mine: false }], concern: [] }] });
const TOWN_404 = '{"code":"PGRST202","details":null,"hint":null,"message":"Could not find the function public.pv_town_board(p) in the schema cache"}';
const TOWN_500 = '{"code":"XX000","details":null,"hint":null,"message":"検査用の失敗"}';
const TOWN_ME = '00000000-0000-4000-8000-0000000000d7';
/* M2 の自分の行（my_town_posts の返事の形 ＝ db/towns.sql の pv_town_post_json）。基地は、ページの欄の data-base */
const townPosts = base => JSON.stringify({ ok: true, posts: [{ town: HOSTILE, base, town_state: 'pending', lived: null, lived_to_year: null, good: null, concern: null, text_state: 'none', rent: null, trip: null }] });
/* 欄と、その器・入口を読む。ページの中で動く（外の変数を1つも使わない）。判定は外でする。 */
function townSee() {
  const box = document.querySelector('.pvg-liv-got > .crl[data-live="towns"]'), got = box && box.parentElement;
  const ent = document.querySelector('#pvg-p-living .pvg-liv-h > a[data-pvc-open="town"]');
  const vis = e => !!e && e.getClientRects().length > 0 && e.checkVisibility({ visibilityProperty: true });
  const tx = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
  /* 文そのもの（後ろに付く「あなたの投稿」の札を除く） */
  const body = e => { const c = e.cloneNode(true); c.querySelectorAll('.crl-note-me').forEach(x => x.remove()); return c.textContent.trim(); };
  if (!box) return null;
  const ol = box.querySelector('ol.crl-towns');
  return {
    state: box.getAttribute('data-state'), on: vis(box), base: box.getAttribute('data-base') || '',
    got: !!got && getComputedStyle(got).display !== 'none', gotHead: got ? tx(got.querySelector(':scope > .pvg-askh')) : '',
    text: tx(box), raw: box.textContent,
    lock: [...box.querySelectorAll('.crl-lock')].map(tx),
    links: [...box.querySelectorAll('a')].map(a => ({ text: tx(a), href: a.getAttribute('href') || '', on: vis(a) })),
    btns: [...box.querySelectorAll('button')].map(b => ({ text: tx(b), on: vis(b) })),
    cards: [...box.querySelectorAll('.crl-give')].map(c => ({ head: tx(c.querySelector('.crl-give-h')), count: tx(c.querySelector('.crl-give-n')), on: vis(c) })),
    heads: [...box.querySelectorAll('.crl-town-h')].map(tx),
    meHead: [...box.querySelectorAll('.crl-town-me > .crl-note-h')].map(tx),
    own: [...box.querySelectorAll('.crl-town-own > li')].map(li => { const n = li.querySelector('.crl-town-n');
      return { name: n ? n.textContent : '', kids: n ? n.children.length : -1, say: tx(li.querySelector('.crl-town-st')), edit: tx(li.querySelector('.crl-town-ed')) }; }),
    list: [...box.querySelectorAll('ol.crl-towns > li.crl-town')].map(li => ({
      name: tx(li.querySelector('.crl-town-k > .crl-town-n')), n: tx(li.querySelector('.crl-town-k > .crl-town-c')),
      mine: [...li.querySelectorAll('.crl-town-k > .crl-note-me')].map(tx),
      labels: [...li.querySelectorAll(':scope > .crl-town-l')].map(tx),
      texts: [...li.querySelectorAll('.crl-town-t')].map(t => ({ text: body(t), mine: [...t.querySelectorAll('.crl-note-me')].map(tx) })),
    })),
    marker: ol ? getComputedStyle(ol).listStyleType : '',
    hostile: document.querySelectorAll('img[src="x"]').length + (typeof window.__pvgHit === 'undefined' ? 0 : 1),
    curs: box.querySelectorAll('span.pv-cur').length,
    ent: { on: vis(ent), before: !!ent && !!got && !!(ent.compareDocumentPosition(got) & Node.DOCUMENT_POSITION_FOLLOWING), inBox: !!ent && box.contains(ent) },
  };
}
async function runTowns(browser, s, [w, h]) {
  const tag = `${s} ${w}（暮らし・パイロットの回答の欄）`, G = giveOf(s);
  const { ctx, p, seen, ready } = await open(browser, s, w, h, 'empty');
  const ev = (fn, ...a) => p.evaluate(fn, ...a);
  const BOX = '.pvg-liv-got > .crl[data-live="towns"]', ENT = '#pvg-p-living .pvg-liv-h > a[data-pvc-open="town"]';
  /* ページが投げた街の口（pv_town_board・my_town_posts）の本数。読むだけ（答えるのは上の偽のサーバー） */
  const calls = { board: 0, mine: 0 };
  p.on('request', r => {
    if (r.method() !== 'POST') return;
    let n = ''; try { n = new URL(r.url()).pathname; } catch { return; }
    if (/\/rest\/v1\/rpc\/pv_town_board$/.test(n)) calls.board++;
    else if (/\/rest\/v1\/rpc\/my_town_posts$/.test(n)) calls.mine++;
  });
  const until = (fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a).then(() => true, () => false);
  /* 欄が落ち着く（「まだ」「読み込み中」でなくなる）まで待つ。時間では待たない */
  const calm = () => until(sel => { const b = document.querySelector(sel); return !!b && !/^(idle|loading)$/.test(b.getAttribute('data-state')); }, BOX);
  /* 返事を置いて、街を保存した時の知らせで描き直させる（欄は、その場で「まだ」に戻ってから読み直す） */
  const redraw = async t => { seen.town = t; await ev(sl => document.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'town', slug: sl } })), s); return calm(); };
  /* ページの「あとで」（setTimeout 0）と、描いたあとの2コマ（通貨の部品が、増えた字を包むのは次のコマ）が過ぎるまで */
  const frames = () => ev(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => r(true))), 0)));
  const see = () => ev(townSee);
  const sheetSee = () => ev(() => {
    const r = document.querySelector('.pvc-root'), f = r && r.querySelector('[data-pvc-form="town"]'), t = r && r.querySelector('.pvc-title');
    const i = f && f.querySelector('#pvc-f-town'), b = f && f.querySelector('.pvc-send');
    return { open: !!r && !r.hidden && r.classList.contains('is-in'), form: !!f, title: t ? t.textContent : '', town: i ? i.value : null, send: b ? b.textContent.trim() : '' };
  });
  const shut = async () => { await p.keyboard.press('Escape'); return until(() => { const r = document.querySelector('.pvc-root'); return !r || !r.classList.contains('is-in'); }); };
  const DIGIT = /[0-9０-９]/;
  /* 絵（PV_GLANCE_SHOT=<フォルダ> がある時だけ撮る・検査の合否には使わない）。名前は towns-<会社>-<幅>-<形>[-dark].png。
     撮るのは「パイロットの回答」の器（.pvg-liv-got）。'panel' は暮らしの板ごと（入口の位置を見る）・'sheet' は開いた面を画面ごと。 */
  const SHOT = process.env.PV_GLANCE_SHOT ? process.env.PV_GLANCE_SHOT.replace(/\/$/, () => '') : '';
  const shot = async (name, how = 'got', dark = false) => {
    if (!SHOT) return;
    const was = await ev(dk => { const v = document.documentElement.getAttribute('data-theme'); if (dk) document.documentElement.setAttribute('data-theme', 'dark'); return v; }, dark);
    try {
      const file = `${SHOT}/towns-${s}-${w}-${name}${dark ? '-dark' : ''}.png`;
      if (how === 'sheet') await p.screenshot({ path: file });
      else {
        /* 上に貼り付く帯（ヘッダーとタブ）に掛からないよう、画面の高さだけを伸ばして、帯の下へ寄せてから撮る（幅と端末の種類は変えない） */
        const sel = how === 'panel' ? '#pvg-p-living' : '.pvg-liv-got';
        const tall = await ev(q => { const e = document.querySelector(q); return e ? Math.ceil(e.getBoundingClientRect().height) : 0; }, sel);
        await p.setViewport({ width: w, height: Math.max(h, tall + 260), deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
        await ev(q => new Promise(r => { const e = document.querySelector(q); if (e) scrollTo({ top: scrollY + e.getBoundingClientRect().top - 220, behavior: 'instant' }); requestAnimationFrame(() => requestAnimationFrame(r)); }), sel);
        const el = await p.$(sel);
        if (el) await el.screenshot({ path: file, captureBeyondViewport: false });
      }
    } catch (e) { notice(`${tag}: 絵を撮れなかった（${name}・${String(e && e.message).slice(0, 100)}）`); }
    finally {
      await ev(v => { if (v === null) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); }, was);
      if (how !== 'sheet') await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 900, hasTouch: w < 1100 });
    }
  };
  try {
    ok(ready, `${tag}: 開ける`);
    await livTab(p);
    if (!(await calm())) throw new Error('「パイロットの回答」の欄が落ち着かない');
    /* M1 */
    {
      const r = await see(), bad = [];
      if (!r) bad.push('欄が無い');
      else {
        if (r.state !== 'locked' || !r.on) bad.push(`欄が ${r.state}${r.on ? '' : '（見えていない）'}（あるべき 鍵の形）`);
        if (!r.got || r.gotHead !== TOWN_GOT) bad.push(`見出し「${r.gotHead}」${r.got ? '' : '（器が出ていない）'}`);
        if (!same(r.lock, [LOGIN_LINE])) bad.push(`1行「${r.lock.join('｜')}」（あるべき「${LOGIN_LINE}」）`);
        if (r.links.length !== 1 || r.links[0].text !== LOGIN_GO || !r.links[0].on || !r.links[0].href.includes('login.html')) bad.push(`欄の入口 ${r.links.map(a => `「${a.text}」${a.href}`).join('・') || '無し'}（あるべき「${LOGIN_GO}」1つ）`);
        if (r.btns.length || r.cards.length || r.own.length) bad.push(`ボタン ${r.btns.length}・カード ${r.cards.length}・自分の行 ${r.own.length}`);
        if (DIGIT.test(r.text)) bad.push(`欄に数字「${r.text}」`);
        if (!r.ent.on || !r.ent.before || r.ent.inBox) bad.push(`「＋住みやすい街を追加」${r.ent.on ? '' : 'が見えない・'}${r.ent.before ? '' : 'が欄より前に無い・'}${r.ent.inBox ? 'が欄の中' : ''}`);
      }
      ok(!bad.length, `${tag}: M1 未ログイン ──「${TOWN_GOT}」の下は鍵の形：「${LOGIN_LINE}」と入口「${LOGIN_GO}」の1つ・数字なし・「＋住みやすい街を追加」は欄の外で、欄より前`, bad.join(' ／ '));
      await shot('login'); await shot('login-panel', 'panel');
    }
    /* M5 */
    {
      const a = await redraw({ body: townOpen([]) }), r = await see(), bad = [];
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'empty') bad.push(`欄が ${r.state}（あるべき empty）`);
        if (r.got) bad.push(`「${TOWN_GOT}」の器が出ている`);
        if (r.text) bad.push(`欄に字「${r.text}」`);
        if (!r.ent.on) bad.push('「＋住みやすい街を追加」が見えない');
      }
      ok(!bad.length, `${tag}: M5 開いていて街0・自分の行も無い ── 欄は空・「${TOWN_GOT}」の器ごと出ない・「＋住みやすい街を追加」は見えたまま`, bad.join(' ／ '));
    }
    /* M6 */
    {
      const a = await redraw({ body: townOpen(TOWN_ODD) }), r = await see(), bad = [];
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'open') bad.push(`欄が ${r.state}（あるべき open）`);
        if (!same(r.list.map(t => [t.name, t.n]), [['二人の街（検査用）', townN(2)]])) bad.push(`描いた街 ${r.list.map(t => `${t.name}「${t.n}」`).join('・') || '無し'}（あるべき「二人の街（検査用）」「${townN(2)}」だけ）`);
        if (/0人|undefined|NaN|1\.5|描かれてはいけない/.test(r.text)) bad.push(`欄の字「${r.text.slice(0, 160)}」`);
      }
      ok(!bad.length, `${tag}: M6 人数の無い街・人数 0 の街・人数が整数でない街は描かない（「0人」を出さない）── 描くのは「${townN(2)}」の1つだけ`, bad.join(' ／ '));
    }
    /* M4 */
    {
      const a = await redraw({ body: townOpen(TOWN_THREE) }), r = await see(), bad = [];
      const W = TOWN_THREE.map(t => ({ name: t.name, n: townN(t.n), mine: t.mine ? [TOWN_MINE] : [],
        labels: [...(t.good.length ? [TOWN_GOOD] : []), ...(t.concern.length ? [TOWN_CONCERN] : [])],
        texts: [...t.good, ...t.concern].map(x => ({ text: x.text, mine: x.mine ? [TOWN_MINE] : [] })) }));
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'open' || !r.on || !r.got) bad.push(`欄が ${r.state}${r.on ? '' : '（見えていない）'}${r.got ? '' : '（器が出ていない）'}`);
        if (!same(r.heads, [TOWN_HEAD])) bad.push(`見出し「${r.heads.join('｜')}」（あるべき「${TOWN_HEAD}」）`);
        if (!same(r.list.map(t => t.name), W.map(t => t.name))) bad.push(`並び ${r.list.map(t => t.name).join('・') || '無し'}（返事の並び ${W.map(t => t.name).join('・')}）`);
        for (const [i, t] of W.entries()) { const g = r.list[i]; if (g && g.name === t.name && !same(g, t)) bad.push(`${t.name}: ${JSON.stringify(g)}（あるべき ${JSON.stringify(t)}）`); }
        if (r.marker !== 'none') bad.push(`並びに番号の印（list-style ${r.marker}）`);
        if (/[0-9０-９]+\s*位|第\s*[0-9０-９]|No\.\s*[0-9]|[①-⑳]|ランキング/.test(r.text)) bad.push(`順位の字「${r.text.slice(0, 160)}」`);
        if (r.meHead.length || r.own.length) bad.push('自分の行が出ている（未ログインで、自分の投稿は無い）');
      }
      ok(!bad.length, `${tag}: M4 開いていて3つ ──「${TOWN_HEAD}」・返事の並びのまま（名前で並べ替えない）・「${townN(3)}」「${townN(1)}」「${townN(1)}」・「${TOWN_GOOD}」「${TOWN_CONCERN}」と文・「${TOWN_MINE}」は自分のものにだけ・順位を付けない`, bad.slice(0, 5).join(' ／ '));
      await shot('open'); await shot('open', 'got', true);
    }
    /* M9 */
    {
      await frames();
      const r0 = await see(), bad = [];
      const cur = await ev(() => { window.PVCurrency.set('USD'); return window.PVCurrency.get(); });
      await frames();
      const r1 = await see();
      if (cur !== 'USD') bad.push(`USD に換わらない（${cur}）`);
      if (!r0 || !r1) bad.push('欄が無い');
      else {
        if (r1.raw !== r0.raw) bad.push(`欄の字が変わった「${r0.text.slice(0, 80)}」→「${r1.text.slice(0, 80)}」`);
        if (!r1.list.some(t => t.texts.some(x => x.text === TOWN_RENT))) bad.push(`「${TOWN_RENT}」がそのまま無い`);
        if (r0.curs || r1.curs) bad.push(`欄の中に、通貨の部品が包んだ額（span.pv-cur）が ${Math.max(r0.curs, r1.curs)}つ`);
      }
      await ev(() => window.PVCurrency.set('JPY'));
      ok(!bad.length, `${tag}: M9 USD に替えても、欄の字は1文字も変わらない（会員の文「${TOWN_RENT}」を額として換算しない）`, bad.join(' ／ '));
    }
    /* M11（開いた欄で見る） */
    {
      const bad = [];
      await ev(sel => { const b = document.querySelector(sel); if (b && b.firstElementChild) b.firstElementChild.__pvgKeep = 1; }, BOX);
      const c0 = calls.board;
      await ev(sl => document.dispatchEvent(new CustomEvent('pvc:saved', { detail: { topic: 'work', slug: sl } })), s);
      await frames();
      await until(SETTLED);
      const kept = await ev(sel => { const b = document.querySelector(sel); return !!b && b.getAttribute('data-state') === 'open' && !!b.firstElementChild && b.firstElementChild.__pvgKeep === 1; }, BOX);
      if (calls.board !== c0) bad.push(`月の勤務の保存の知らせで、街の一覧を ${calls.board - c0}回読んだ`);
      if (!kept) bad.push('月の勤務の保存の知らせで、開いていた欄が描き直された');
      const c1 = calls.board, a = await redraw(seen.town), r = await see();
      if (!a || calls.board - c1 !== 1) bad.push(`街の保存の知らせで、街の一覧を ${calls.board - c1}回読んだ（あるべき 1回）`);
      if (!r || r.state !== 'open' || !same(r.list.map(t => t.name), TOWN_THREE.map(t => t.name))) bad.push(`読み直したあとの欄 ${r ? r.state : '無し'}`);
      ok(!bad.length, `${tag}: M11 開いている欄 ── 月の勤務の保存の知らせでは読み直さない（通信 0・欄の中身もそのまま）／街の保存の知らせでは1回だけ読み直す`, bad.join(' ／ '));
    }
    /* M7 */
    {
      const bad = [];
      const a = await redraw({ status: 404, body: TOWN_404 }), r = await see();
      if (!a || !r || r.state !== 'off' || r.text !== TOWN_OFF || r.lock.length || r.btns.length || r.links.length) bad.push(`404 の時 欄 ${r ? `${r.state}「${r.text}」` : '無し'}（あるべき「${TOWN_OFF}」だけ）`);
      if (r && !r.ent.on) bad.push('404 の時「＋住みやすい街を追加」が見えない');
      await shot('off');
      const b = await redraw({ status: 500, body: TOWN_500 }), e = await see();
      await shot('error');
      if (!b || !e || e.state !== 'error' || e.text !== TOWN_ERR + TOWN_RETRY || e.btns.length !== 1 || e.btns[0].text !== TOWN_RETRY || !e.btns[0].on) bad.push(`500 の時 欄 ${e ? `${e.state}「${e.text}」` : '無し'}（あるべき「${TOWN_ERR}」＋「${TOWN_RETRY}」）`);
      else {
        seen.town = { body: stateBody('login') };
        const c0 = calls.board;
        await press(await p.$(`${BOX} .crl-retry`));
        const back = await calm(), r2 = await see();
        if (!back || calls.board - c0 !== 1 || !r2 || r2.state !== 'locked') bad.push(`「${TOWN_RETRY}」を押したあと 聞いた回数 ${calls.board - c0}（あるべき 1）・欄 ${r2 ? r2.state : '無し'}`);
      }
      ok(!bad.length, `${tag}: M7 口がまだ無い（404）は「${TOWN_OFF}」・読めない（500）は「${TOWN_ERR}」＋「${TOWN_RETRY}」で、押すと1回聞き直す`, bad.join(' ／ '));
    }
    /* M8 */
    {
      seen.give = { status: 200, body: giveBody('give', s) };
      const a = await redraw({ body: stateBody('give') }), r = await see(), bad = [];
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'locked') bad.push(`欄が ${r.state}（あるべき 鍵の形）`);
        if (!same(r.lock, [GIVE_LINE(5)])) bad.push(`1行「${r.lock.join('｜')}」（あるべき「${GIVE_LINE(5)}」）`);
        if (r.cards.length !== 1 || !r.cards[0].on || r.cards[0].head !== GIVE_HEAD(G.name) || r.cards[0].count !== GIVE_COUNT(3, 5)) bad.push(`答えるカード ${JSON.stringify(r.cards)}`);
        if (r.links.length !== 1 || r.links[0].text !== GIVE_GO || !r.links[0].on) bad.push(`欄の入口 ${r.links.map(l => `「${l.text}」`).join('・') || '無し'}（あるべき「${GIVE_GO}」1つ）`);
        if (r.text.includes(LOGIN_GO) || r.text.includes(PAY_GO)) bad.push(`ログインか給与の提出の字が在る「${r.text.slice(0, 80)}」`);
      }
      await shot('give');
      seen.give = null;
      ok(!bad.length, `${tag}: M8 'give' ── 02b の1行「${GIVE_LINE(5)}」と答えるカード1枚（「${GIVE_HEAD(G.name)}」「${GIVE_COUNT(3, 5)}」・入口「${GIVE_GO}」の1つ）`, bad.join(' ／ '));
    }
    /* M2（ここから会員。面はまだ1度も開いていない ＝ 開くのは、この会員が初めて） */
    {
      const bad = [], base = ((await see()) || {}).base || '';
      seen.town = { body: stateBody('locked'), mine: townPosts(base) };
      await ev((k, id) => {
        localStorage.setItem(k, JSON.stringify({ user: { id } }));
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      }, 'sb-check-auth-token', TOWN_ME);
      const m0 = calls.mine, a = await redraw(seen.town), r = await see();
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'locked') bad.push(`欄が ${r.state}（あるべき 鍵の形）`);
        if (calls.mine === m0) bad.push('自分の投稿の口（my_town_posts）を読んでいない');
        if (!same(r.meHead, [TOWN_MINE])) bad.push(`自分の行の見出し「${r.meHead.join('｜')}」（あるべき「${TOWN_MINE}」）`);
        if (r.own.length !== 1 || r.own[0].name !== HOSTILE || r.own[0].kids !== 0 || r.own[0].say !== TOWN_WAIT || r.own[0].edit !== TOWN_EDIT) bad.push(`自分の行 ${JSON.stringify(r.own)}`);
        if (r.hostile) bad.push('街の名前から要素が生まれた（img が在る・onerror が動いた）');
        if (!same(r.lock, [PAY_LINE]) || !r.links.some(l => l.text === PAY_GO && l.href.endsWith(`pay-report.html?airline=${s}`))) bad.push(`鍵の1行と入口「${r.lock.join('｜')}」${r.links.map(l => `「${l.text}」`).join('')}`);
        await shot('own'); await shot('own', 'got', true);
        const fix = await p.$(`${BOX} .crl-town-own .crl-town-ed`);
        if (!fix) bad.push(`「${TOWN_EDIT}」が無い`);
        else {
          await press(fix);
          const opened = await until(() => { const x = document.querySelector('.pvc-root'), i = x && x.querySelector('[data-pvc-form="town"] #pvc-f-town'); return !!x && x.classList.contains('is-in') && !!i && !!i.value; });
          const f = await sheetSee();
          await shot('fix-sheet', 'sheet');
          if (!opened || !f.form) bad.push(`「${TOWN_EDIT}」で街の面が開かない（${JSON.stringify(f)}）`);
          else {
            if (f.town !== HOSTILE) bad.push(`面の欄「${f.town}」（あるべき その街の名前のまま）`);
            if (f.title !== TOWN_SHEET) bad.push(`面の見出し「${f.title}」（直す回は「${TOWN_SHEET}」──「…を追加」と言わない）`);
            if (f.send !== TOWN_UPD) bad.push(`送るボタン「${f.send}」（あるべき「${TOWN_UPD}」）`);
            if (((await see()) || {}).hostile) bad.push('面を開いたあと、街の名前から要素が生まれた');
            if (!(await shut())) bad.push('Escape で閉じない');
          }
        }
      }
      ok(!bad.length, `${tag}: M2 鍵の無い会員の自分の行 ──「${TOWN_MINE}」・タグの形の街の名前は字のまま（要素が生まれない）・「${TOWN_WAIT}」・「${TOWN_EDIT}」で街の面が開き、欄にその名前・見出しは「${TOWN_SHEET}」・ボタンは「${TOWN_UPD}」`, bad.join(' ／ '));
    }
    /* M3 */
    {
      const bad = [], a = await redraw({ body: TOWN_LOCKED_LEAK, mine: '{"ok":true,"posts":[]}' }), r = await see();
      const leak = await ev(xs => {
        const h = document.documentElement.outerHTML, t = document.body.innerText;
        const st = [localStorage, sessionStorage].flatMap(S => Object.keys(S).map(k => `${k}=${S.getItem(k)}`)).join('\n');
        return xs.filter(x => h.includes(x) || t.includes(x) || st.includes(x));
      }, [TOWN_LEAK, TOWN_LEAK_T]);
      if (!a || !r) bad.push('欄が落ち着かない');
      else {
        if (r.state !== 'locked' || !same(r.lock, [PAY_LINE])) bad.push(`欄 ${r.state}「${r.lock.join('｜')}」（あるべき 鍵の形「${PAY_LINE}」）`);
        if (r.list.length || r.heads.length || r.text.includes(townN(4))) bad.push(`街の一覧が出ている（${r.list.length}つ）「${r.text.slice(0, 80)}」`);
      }
      if (leak.length) bad.push(`返事に付いてきた字が、ページか保存領域に在る：${leak.join('｜')}`);
      ok(!bad.length, `${tag}: M3 鍵の掛かった返事（'locked'）に街が付いてきても、欄にもページにも保存領域にも1文字も出ない`, bad.join(' ／ '));
    }
    /* M10（同じ会員のまま） */
    {
      const bad = [];
      if (!(await redraw({ body: stateBody('locked') }))) bad.push('欄が落ち着かない');
      const i = await ev(sel => {
        const e = document.querySelector(sel);
        if (!e) return -1;
        e.scrollIntoView({ block: 'center', behavior: 'instant' });
        const vis = n => n.getClientRects().length > 0 && n.checkVisibility({ visibilityProperty: true });
        const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(n => n.tabIndex >= 0 && !n.disabled && vis(n));
        /* 入口の手前で、本当に焦点を受け取るもの（畳んだ <details> の中のリンクなどは受け取らない）を探して置く */
        for (let k = all.indexOf(e) - 1; k >= 0; k--) { all[k].focus({ preventScroll: true }); if (document.activeElement === all[k]) return k + 1; }
        return all.indexOf(e) < 0 ? -1 : 0;
      }, ENT);
      if (i < 1) bad.push('「＋住みやすい街を追加」の手前に、焦点を置ける所が無い');
      else {
        await p.keyboard.press('Tab');
        const at = await ev(sel => document.activeElement === document.querySelector(sel), ENT);
        if (!at) bad.push(`Tab で着かない（焦点 ${await ev(() => { const x = document.activeElement; return x ? `${x.tagName}.${x.className}` : '無し'; })}）`);
        else {
          await p.keyboard.press('Enter');
          const opened = await until(() => { const r = document.querySelector('.pvc-root'); return !!r && !r.hidden && r.classList.contains('is-in') && !!r.querySelector('[data-pvc-form="town"]'); });
          if (!opened) bad.push('Enter で街の面が開かない');
          else if (!(await shut())) bad.push('Escape で閉じない');
          else if (!(await until(sel => document.activeElement === document.querySelector(sel), ENT))) bad.push('閉じたあと、焦点が「＋住みやすい街を追加」へ戻らない');
        }
      }
      ok(!bad.length, `${tag}: M10 キーボード ── Tab で「＋住みやすい街を追加」に着く・Enter で街の面が開く・Escape で閉じる・焦点は入口へ戻る`, bad.join(' ／ '));
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
  if (wantS('off')) for (const s of ONLY) for (const v of VIEWS.filter(x => OFF_W.includes(x[0]))) work.push(() => runOff(browser, s, v), () => runFacts404(browser, s, v));
  if (wantS('rows')) for (const s of ONLY) for (const v of VIEWS.filter(x => ROWS_W.includes(x[0]))) work.push(() => runRows(browser, s, v));
  if (wantS('rated')) for (const s of ONLY) for (const v of VIEWS.filter(x => RATED_W.includes(x[0]))) work.push(() => runRated(browser, s, v), () => runRated404(browser, s, v), () => runRatedLogin(browser, s, v), () => runRatedFew(browser, s, v), () => runRatedNone(browser, s, v), () => runRatedErr(browser, s, v), () => runRatedOpen(browser, s, v));
  if (wantS('rated')) for (const s of ONLY) { const v = VIEWS.find(x => RATED_W.includes(x[0])); if (v) work.push(() => runRatedStale(browser, s, v)); }
  if (wantS('rated')) for (const s of ONLY.slice(0, 1)) for (const v of VIEWS.filter(x => RATED_W.includes(x[0]))) work.push(() => runRatedOpenMax(browser, s, v));
  if (wantS('tabs')) for (const s of ONLY) for (const v of [...VIEWS.filter(x => TABS_W.includes(x[0])), ...TABS_EXTRA]) work.push(() => runTabs(browser, s, v));
  if (wantS('stay')) {
    /* 幅を絞った回（--sizes）は、その幅で流す（一度だけ別の幅を見る時に、ここを書き換えなくてよい）。 */
    const vs = WANT_W ? VIEWS : VIEWS.filter(x => STAY_W.includes(x[0]));
    for (const s of ONLY) for (const v of vs) work.push(() => runStay(browser, s, v));
    if (ONLY.length && vs.length) work.push(() => runStayStall(browser, ONLY[0], vs[0]));
    console.log(`  ・ホテルの欄（stay）を流す幅：${vs.map(v => v[0]).join('・') || 'なし'}（返事が来ない場面は ${ONLY[0] || '—'} ${vs.length ? vs[0][0] : '—'} の1回だけ）`);
  }
  if (wantS('find')) {
    const vs = WANT_W ? VIEWS : VIEWS.filter(x => FIND_W.includes(x[0]));
    for (const s of ONLY) for (const v of vs) work.push(() => runFind(browser, s, v));
    console.log(`  ・就航地を探す・戻る・読み直し（find）を流す幅：${vs.map(v => v[0]).join('・') || 'なし'}`);
  }
  if (wantS('cards')) for (const s of ONLY) work.push(() => runCards(browser, s));
  if (wantS('gg')) for (const s of ONLY) for (const v of VIEWS.filter(x => GG_W.includes(x[0]))) work.push(() => runGG(browser, s, v));
  if (wantS('give')) for (const s of ONLY) for (const v of VIEWS.filter(x => GIVE_W.includes(x[0]))) work.push(() => runGive(browser, s, v), () => runGiveOpen(browser, s, v));
  if (wantS('work')) for (const s of ONLY) for (const v of VIEWS.filter(x => ROWS_W.includes(x[0]))) work.push(() => runWork(browser, s, v));
  if (wantS('work')) for (const s of ONLY) work.push(() => runWorkSizes(browser, s));
  if (wantS('work0')) for (const s of ONLY) for (const v of VIEWS.filter(x => ROWS_W.includes(x[0]))) work.push(() => runWork0(browser, s, v));
  if (wantS('living')) for (const s of ONLY) for (const v of VIEWS.filter(x => WANT_W || [390, 1440].includes(x[0]))) work.push(() => runLiving(browser, s, v));
  if (wantS('towns')) for (const s of ONLY) for (const v of VIEWS.filter(x => WANT_W || TOWNS_W.includes(x[0]))) work.push(() => runTowns(browser, s, v));
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
