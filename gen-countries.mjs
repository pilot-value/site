/* ════════════════════════════════════════════════════════════════
   gen-countries.mjs — 国別ハブページを SSOT から生成する

   なぜ作るか
     「エミレーツ パイロット 年収」のような社名クエリは既存の会社ページで
     取れているが、「UAE パイロット 年収」「pilot salary in Japan」のような
     国クエリの受け皿がサイトに1枚も無かった。国名は検索需要が社名より
     広く、かつ会社ページ110枚への内部リンクのハブにもなる。

   何を書くか（と、書かないか）
     ・数値は全部 salary-data.mjs（SSOT）から計算する。手で書かない。
     ・国メタ（航空当局・所得税の有無）は airline-countries.mjs。
     ・査証・生活費・採用条件のような手元に無い情報は書かない。
       埋めれば文章は厚くなるが、検証できないものを載せない方が優先
       （VERIFIED-PILOT.md / CLAUDE.md「数字を盛らない」）。

   出力
     countries.html / en/countries.html            … 国一覧
     countries/{slug}.html / en/countries/{slug}.html … 各国（掲載社がある全カ国）
     {region}-pilot-salary.html / en/{region}-pilot-salary.html … 地域ハブ7枚
       （北米・中東・ヨーロッパ・オセアニア・アジア・中南米・アフリカ。
        日本は countries/japan.html と重複するので作らない ＝ 下の REGIONS）

   head の SEO 部分は seo-normalize.mjs が後から入れる。
   このスクリプトは <title> と description の素だけ置く。

   実行: node gen-countries.mjs
        node gen-countries.mjs --dry   （書かずに件数だけ）
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, yearly } from './salary-basis.mjs';
import { AIRLINE_COUNTRY, COUNTRIES, nameIn, nameFull } from './airline-countries.mjs';
import { curCore } from './cur-core.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const DRY = process.argv.includes('--dry');
const S = SALARY;
const N = Object.keys(S).length;

/* ── 根拠を調べた会社は、平均の材料にしない（2026-09-29 オーナー決定）──
   salary-basis.mjs に載っている会社は、画面に出す金額を
   「公式募集例」「求人の掲載額」「推定」などに変えた。
   SALARY の平均・レンジは**そのまま公開しない**と決めたものなので、
   国や世界の平均を作るときの材料にもしない。

   ⚠️ 0 で埋めない。**足し算から外す**（0 を入れると平均が下がる＝嘘になる）。
   ⚠️ その国に1社でも混ざったら、国の平均そのものを出さない。
     残った社だけの平均は「その国の平均」ではないし、公式募集の現金給与と
     福利厚生込みの総額と根拠不明の推計が混ざったものは比べられない
     （オーナー「会社の数字の単純平均を、その国のパイロット全体の平均と
     呼ばないでください」）。代わりに**各社の根拠付きの金額を並べる**。 */
/* ★2026-09-30、除外の線を引き直した。オーナー指示
     「なんで各航空会社の機長、FOの平均年収を確認中にしちゃうんだよ。
       確認中じゃなくて推定とかにすりゃいいじゃん。」

   推定（estimate）は台帳の外の87社と**同じ作り**── 公開情報から出した機長・副操縦士の
   年収 ── なので、同じ物差しで足して割れる。除外するのは物差しが違う社だけ:
   公式募集例・求人の掲載額・過去の募集広告・条件つきの給与例・会社が公表した平均。

   ⚠️ 2026-09-30 まで「台帳に載っている25社ぜんぶ」を外していた。その結果
      世界平均が112社→87社、順位の付く国が51→37に減り、
      ANA・JAL・エミレーツが国別ページから金額ごと消えた。オーナーが見たのはこの画面。
   ⚠️ 0 で埋めない。**足し算から外す**（0 を入れると平均が下がる＝嘘になる）。
   ⚠️ 「掲載社の単純平均」を「その国のパイロット全体の平均」と呼ばない（オーナーの禁止事項）。
      文言が「掲載N社の平均」なのはそのため。 */
/* ⚠️ 見るのは機長と副操縦士だけ。国の平均はこの2つだけで作っているので、
      運航乗務員（JAL・スカイマークの有報の平均）や訓練生（ANA・ピーチの募集要項）が
      在ることを理由に国の平均を止めると、日本が理由なく落ちる。 */
const STRONGER = (k) => ['cap', 'fo'].some((r) => {
  const t = BASIS[k]?.[r]?.tier;
  return t !== undefined && t !== 'estimate';
});
const CHECKED = new Set(Object.keys(BASIS).filter(STRONGER));

/* ★2026-09-30（2回目）── 平均の材料からは1社も外さない。
   1回目は上の CHECKED（物差しが違う社）を平均から外したが、そうすると
   **その社が1つでも居る国の平均が丸ごと消える**。実際に UAE・サウジアラビア・香港・
   中国・台湾・オマーンの6カ国と、中東・アジアの2地域が「確認中」になっていた
   （順位の付く国が 51 → 45 に減った）。オーナー指示は「確認中にするな」。

   外す必要がそもそも無かった。**公式募集例を持つ社も、推定の年収は別に持っている** ──
   salary-data.mjs の cap.avg / fo.avg は112社ぜんぶに在り、どれも同じ作り
   （公開情報から当サイトが出した推定）。公式の募集例は会社ページに**足して**出すもので、
   推定を置き換えるものではない。だから国の平均は112社ぜんぶの推定で作れる。

   ⚠️ CHECKED は消さない。国別ページの「会社が公表している金額」の表がこれで決まる
      （そちらは物差しの違いがそのまま意味を持つ）。平均の話とは別。
   ⚠️ 0 で埋めない ── 推定が無い社は S に無いので、そもそも足し算に入らない。
   ⚠️ 「掲載社の単純平均」を「その国のパイロット全体の平均」と呼ばない（オーナーの禁止事項）。
      文言が「掲載N社の推定年収の平均」なのはそのため。 */
const PUB = Object.keys(S);
const NPUB = PUB.length;

const HELD = (ja) => (ja ? '確認中' : 'Under review');
/** 保留のときは金額を書かない（0 で埋めない）。 */
const manH = (v, ja) => (v == null ? HELD(ja) : man(v));
const usdH = (v, ja) => (v == null ? HELD(ja) : usd(v));
const rangeH = (lo, hi, ja) => (lo == null || hi == null ? HELD(ja) : range(lo, hi));

/** その会社・職位で公開できる年間の金額を「区分：金額（何の額か・等級）」の形にする。
    確認中、または年額が無ければ null（0 や空欄で埋めない）。
    ⚠️ 金額の作り方は salary-basis.mjs の figures() 1か所。ここに写さない。
    ⚠️ 訓練期間中の額は「その職位の年収」ではないので外す。
    M は金額の書き方（本文は円・構造化データと紹介文は $）。 */
function paidLines(slug, rank, ja, M) {
  const b = BASIS[slug]?.[rank];
  if (!b || b.tier === 'held') return null;
  /* ★推定は SALARY の金額をそのまま出す（2026-09-30 オーナー指示
       「確認中じゃなくて推定とかにすりゃいいじゃん」）。
     ⚠️ 金額は salary-data.mjs から取る。台帳の held.was にも同じ数字が控えてあるが、
        そちらを読むと年収の正がリポジトリに2か所できる（SSOT は salary-data.mjs だけ）。
     ⚠️ 「平均」と書かない。公開情報から当サイトが推計した金額で、実測の平均ではない。 */
  if (b.tier === 'estimate') {
    const r = S[slug]?.[rank];
    if (!r) return null;
    return [ja ? `${M(r.avg)}（${TIERS.estimate.ja}）` : `${M(r.avg)} (${TIERS.estimate.en})`];
  }
  const t = ja ? TIERS[b.tier].ja : TIERS[b.tier].en;
  const fs = yearly(slug, rank).filter((f) => !f.training);
  if (!fs.length) return null;
  return fs.map((f) => {
    const grp = ja ? f.group : (f.group_en || f.group);
    const kind = ja ? f.kind : (f.kind_en || f.kind);
    /* 何の額かの説明に等級の語が既に入っているときは重ねない
       （「平均年間給与・平均」になっていた）。 */
    const lbl = kind.includes(t) ? kind : (ja ? `${kind}・${t}` : `${kind}, ${t}`);
    return ja ? `${grp}：${M(f.man)}（${lbl}）` : `${grp}: ${M(f.man)} (${lbl})`;
  });
}
/** その社で1つでも金額を出せるか（機長・副操縦士・運航乗務員のどれか）。 */
const PRANKS = ['cap', 'fo', 'crew'];
const hasPaid = (slug, ja, M) => PRANKS.some((r) => paidLines(slug, r, ja, M));

/* ── 数値ヘルパ ──────────────────────────────────────────────────
   通貨は currency.js が実行時に走査して変換する。標準の円表記
   （¥1,800万 / 1,800万円）以外で書くと変換から漏れる。          */
const man = (v) => `¥${Math.round(v).toLocaleString('en-US')}万`;
const range = (lo, hi) => `¥${Math.round(lo).toLocaleString('en-US')}万〜${Math.round(hi).toLocaleString('en-US')}万`;
/* ★ <head> の中（title / description / og）は currency.js の走査対象外。
   本文に ¥1,850万 と書くのは正しい（実行時に $116K へ変換される）が、
   description に同じ書き方をすると英語版の検索結果に「¥1,850万」が
   そのまま出る。head に入る金額だけは生成時に USD へ寄せる。
   レートは currency.js / seo-normalize.mjs と同じ 160。 */
/* ★ドルの換算レートを手で持たない（2026-09-18）。
   ここが 160 のまま置き去りになり、currency.js（158.95）が塗る本文と食い違って
   **同じページの中でタイトルが $231K・本文が $233K** になっていた。
   画面では本文だけ見えるので誰も気づかない。焼き込んで初めて並んで見えた。 */
const USD_RATE = (await curCore('USD', 'en')).RATES.USD;
const usd = (v) => `$${Math.round((v * 10000) / USD_RATE / 1000).toLocaleString('en-US')}K`;
const usdRange = (lo, hi) => `${usd(lo)}–${usd(hi)}`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round10 = (v) => Math.round(v / 10) * 10;

/* ── タイトルの幅 ───────────────────────────────────────────────
   ★ この3行は seo-normalize.mjs（width / BRAND / TITLE_MAX）と同じ規則。
     あちらが SERP 幅で切る側で、ここは切られない形を作る側なので、
     片方だけ変えると生成したタイトルが後段で切られる。動かすなら両方。
   全角2・半角1で数えるのは、Google の切り詰めが文字数ではなく
   ピクセル幅（約600px）で効くため。 */
const width = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const CORE_MAX = 70 - width(' | PILOT VALUE');
/* 候補を情報量の多い順に受け取り、幅に収まる最初のものを返す。
   全部溢れたら最後（＝一番短い形）。 */
const fitTitle = (cands) => cands.find((t) => width(t) <= CORE_MAX) || cands[cands.length - 1];

/* hub フラグでは絞らない。掲載社が1社でも、その国の順位・世界平均との差・
   所得税の有無・近隣国との比較は他のどのページにも載っていない情報なので、
   国ページとして成立する（現に hub 27カ国のうち10カ国は1社しか無い）。
   全社ページから国ハブへリンクを張るためにも、穴が無い方がいい。 */
const hubs = (Array.isArray(COUNTRIES) ? COUNTRIES : Object.values(COUNTRIES));

/* ── 国ごとの集計 ───────────────────────────────────────────────── */
function statsOf(c) {
  const all = Object.keys(S).filter((k) => AIRLINE_COUNTRY[k] === c.code);
  /* 出どころを調べた社（国別ページの「会社が公表している金額」の表に出す社）。
     ⚠️ 平均を止める条件ではない ── 並びも平均も、112社ぜんぶが持っている推定年収で作る
        （上の PUB の節）。ここで止めていた頃は6カ国が「確認中」になっていた。 */
  const checked = all.filter((k) => CHECKED.has(k));
  const mixed = false;
  const slugs = [...all].sort((a, b) => S[b].cap.avg - S[a].cap.avg);
  /* ★出どころを調べた社（台帳に載っている社）。**平均を止めるかどうかとは別の話。**
       ・ledger … どちらの表に出すか（上の「出どころを調べた会社」の表）
       ・checked … 国の平均を出すか（物差しの違う金額が混ざる社だけ・上の STRONGER）
     2026-09-30 まで1つの集合が両方を決めていたので、推定の16社が
     表からも平均からも同時に落ちていた。 */
  const ledger = slugs.filter((k) => BASIS[k]);
  const caps = slugs.map((k) => S[k].cap);
  const fos = slugs.map((k) => S[k].fo);
  /* 地域は所属各社の region の最頻値。SSOT に国の region は無いので導出する。 */
  const tally = {};
  for (const k of slugs) tally[S[k].region] = (tally[S[k].region] || 0) + 1;
  const region = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const agg = mixed ? {
    capAvg: null, capLo: null, capHi: null, foAvg: null, foLo: null, foHi: null,
  } : {
    capAvg: round10(mean(caps.map((x) => x.avg))),
    capLo: Math.min(...caps.map((x) => x.lo)),
    capHi: Math.max(...caps.map((x) => x.hi)),
    foAvg: round10(mean(fos.map((x) => x.avg))),
    foLo: Math.min(...fos.map((x) => x.lo)),
    foHi: Math.max(...fos.map((x) => x.hi)),
  };
  return {
    ...c, slugs, region, checked, ledger, mixed,
    n: slugs.length,
    ...agg,
    top: mixed ? null : slugs[0],
  };
}

const ALL = hubs.map(statsOf).filter((c) => c.n > 0);
/* 世界の値は「平均をそのまま掲載している社」だけで作る（上の PUB）。
   平均の材料にしない社を 0 として足さない＝人数から外す。 */
const WORLD_CAP = round10(mean(PUB.map((k) => S[k].cap.avg)));
const WORLD_FO = round10(mean(PUB.map((k) => S[k].fo.avg)));
/* 順位は、金額を出している国どうしでしか付けられない。 */
const RANKED = ALL.filter((c) => !c.mixed).sort((a, b) => b.capAvg - a.capAvg);
const HOLD_C = ALL.filter((c) => c.mixed);
const rankOf = (code) => {
  const i = RANKED.findIndex((c) => c.code === code);
  return i < 0 ? null : i + 1;
};

/* ── 地域ハブ ─────────────────────────────────────────────────────
   国ページ51枚の上に、地域という段が無かった。「中東 パイロット 年収」
   「pilot salary middle east」は国名クエリより広く、かつ国ページ51枚と
   会社ページ110枚への内部リンクを1枚に束ねられる。

   ★ japan は作らない。region==='japan' は26社・1カ国で、
     countries/japan.html と中身が完全に重複する。同じ内容の2枚は
     どちらの評価も薄める。日本へは各ハブから countries/japan.html へ
     リンクを張って繋ぐ。

   ★ URL はルート直下の {slug}.html。ルート直下28枚の既存パターンと同じで、
     URL にキーワードが乗り、lang-toggle の EN-PAGES 枠がそのまま効く
     （node gen-en-manifest.mjs で再生成される）。

   en は文中に出す形（"pilots in the Middle East"）、enCap は文頭形。
   the が要るのは中東だけだが、分岐を書くより2フィールド持つ方が読める。 */
const REGIONS = [
  { key: 'us', slug: 'north-america-pilot-salary', ja: '北米', en: 'North America', enCap: 'North America' },
  { key: 'mideast', slug: 'middle-east-pilot-salary', ja: '中東', en: 'the Middle East', enCap: 'The Middle East' },
  { key: 'europe', slug: 'europe-pilot-salary', ja: 'ヨーロッパ', en: 'Europe', enCap: 'Europe' },
  { key: 'oceania', slug: 'oceania-pilot-salary', ja: 'オセアニア', en: 'Oceania', enCap: 'Oceania' },
  { key: 'asia', slug: 'asia-pilot-salary', ja: 'アジア', en: 'Asia', enCap: 'Asia' },
  { key: 'latam', slug: 'latin-america-pilot-salary', ja: '中南米', en: 'Latin America', enCap: 'Latin America' },
  { key: 'africa', slug: 'africa-pilot-salary', ja: 'アフリカ', en: 'Africa', enCap: 'Africa' },
];

function regionStats(r) {
  /* 社の集合は SSOT の region で決める（国ページの有無に依存させない）。 */
  const all = Object.keys(S).filter((k) => S[k].region === r.key);
  const checked = all.filter((k) => CHECKED.has(k));
  /* ★ 国と同じ扱い（上の PUB の節）。地域の平均も112社ぜんぶの推定年収で作る。
       止めていた頃は中東とアジアの2地域が「確認中」になっていた。 */
  const mixed = false;
  const slugs = mixed
    ? [...all].sort((a, b) => S[a].ja.localeCompare(S[b].ja, 'ja'))
    : [...all].sort((a, b) => S[b].cap.avg - S[a].cap.avg);
  const countries = ALL.filter((c) => c.region === r.key)
    .sort((a, b) => (mixed
      ? (ja0(a) < ja0(b) ? -1 : 1)
      : b.capAvg - a.capAvg));
  const caps = slugs.map((k) => S[k].cap);
  const fos = slugs.map((k) => S[k].fo);
  /* ★ airline-countries.mjs に国コードが無い社（root-aviation / eagle-jet）は
     国別内訳の合計に入らない。社数と国別内訳の合計が食い違うので、
     ページ側で注記を出すために名前を持っておく。黙って数を合わせない。 */
  const orphans = slugs.filter((k) => !countries.some((c) => c.slugs.includes(k)));
  /* 国ページと同じ。表の振り分け（ledger）と平均を止める判定（checked）は別。 */
  const ledger = slugs.filter((k) => BASIS[k]);
  const agg = mixed ? {
    capAvg: null, capLo: null, capHi: null, foAvg: null, foLo: null, foHi: null,
  } : {
    capAvg: round10(mean(caps.map((x) => x.avg))),
    capLo: Math.min(...caps.map((x) => x.lo)),
    capHi: Math.max(...caps.map((x) => x.hi)),
    foAvg: round10(mean(fos.map((x) => x.avg))),
    foLo: Math.min(...fos.map((x) => x.lo)),
    foHi: Math.max(...fos.map((x) => x.hi)),
  };
  return {
    ...r, slugs, countries, orphans, checked, ledger, mixed,
    n: slugs.length,
    nc: countries.length,
    ...agg,
    taxFree: slugs.filter((k) => S[k].taxFree).length,
    top: mixed ? null : slugs[0],
  };
}
const ja0 = (c) => c.ja;

const REG = REGIONS.map(regionStats).filter((r) => r.n > 0);
/* 金額を出している地域どうしでしか順位を付けられない。 */
const REG_RANKED = REG.filter((r) => !r.mixed).sort((a, b) => b.capAvg - a.capAvg);
const hubOf = (regionKey) => REG.find((r) => r.key === regionKey);

/* ── 共通パーツ ─────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}
body{background:#0a0c0f;color:#e8edf2;font-family:'Inter','Noto Sans JP',sans-serif;line-height:1.8;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:128px;opacity:.3}
nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(10,12,15,.95);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.logo-img{height:40px;width:auto}
.btn-ghost{display:inline-flex;align-items:center;padding:8px 18px;border-radius:8px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.85rem;font-weight:600;border:1px solid rgba(255,255,255,.12);text-decoration:none;transition:background .2s,transform .2s}
.btn-ghost:hover{background:rgba(255,255,255,.13);transform:translateY(-1px)}
.btn-ghost:focus-visible,.c-card:focus-visible,.crumb a:focus-visible,.salary-table a:focus-visible{outline:2px solid #f5c842;outline-offset:2px}
.glass{background:rgba(17,22,32,.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.07);border-radius:16px}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700}
.tag-gold{background:rgba(245,200,66,.10);color:#f5c842;border:1px solid rgba(245,200,66,.22)}
.tag-green{background:rgba(52,211,153,.10);color:#34d399;border:1px solid rgba(52,211,153,.22)}
.tag-blue{background:rgba(61,155,255,.10);color:#5fb0ff;border:1px solid rgba(61,155,255,.22)}
.crumb{font-size:.75rem;color:#6b7d93}
.crumb a{color:#8899aa;text-decoration:none}.crumb a:hover{color:#f5c842}
.hero-flag{font-size:3.4rem;line-height:1;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))}
h1.c-title{font-size:clamp(1.8rem,4.4vw,2.9rem);font-weight:900;letter-spacing:-.03em;line-height:1.2;background:linear-gradient(135deg,#fff 30%,#f5c842);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat-card{padding:18px 20px;border-radius:14px;background:rgba(17,22,32,.65);border:1px solid rgba(255,255,255,.07)}
.stat-label{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:#6b7d93;font-weight:700}
.stat-value{font-size:1.5rem;font-weight:900;letter-spacing:-.02em;margin-top:4px}
.stat-sub{font-size:.75rem;color:#8899aa;margin-top:2px}
.salary-table{width:100%;border-collapse:collapse}
.salary-table th{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7d93;padding:12px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);white-space:nowrap}
.salary-table td{padding:13px 14px;font-size:.88rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
.salary-table tr:last-child td{border-bottom:none}
.salary-table tr:hover td{background:rgba(255,255,255,.025)}
.salary-table a{color:#e8edf2;text-decoration:none;font-weight:700}
.salary-table a:hover{color:#f5c842}
.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.bar-row{display:grid;grid-template-columns:minmax(96px,auto) 1fr minmax(84px,auto);align-items:center;gap:12px;padding:7px 0}
.bar-track{height:10px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#3d9bff,#5fb0ff)}
.bar-fill.is-self{background:linear-gradient(90deg,#f5c842,#ffd964)}
.bar-name{font-size:.82rem;color:#b0bec9}
.bar-val{font-size:.82rem;font-weight:700;text-align:right}
.article h2{font-size:1.4rem;font-weight:800;margin:2.6rem 0 1rem;padding-bottom:.5rem;border-bottom:1px solid rgba(255,255,255,.08)}
.article p{margin-bottom:1.1rem;color:#b0bec9}
.article strong{color:#e8edf2}
/* リンク色は本文の <p> の中だけ。.article a だと詳細度(0,1,1)で
   .salary-table a / .c-card / .btn-ghost に勝ってしまい、表もカードも
   ボタンも青い下線付きになる（実測）。 */
.article p a{color:#3d9bff;text-decoration:underline;text-underline-offset:2px}
.c-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.c-card{display:block;padding:16px 18px;border-radius:14px;background:rgba(17,22,32,.65);border:1px solid rgba(255,255,255,.07);text-decoration:none;color:inherit;transition:transform .22s cubic-bezier(.16,1,.3,1),border-color .22s,background .22s}
.c-card:hover{transform:translateY(-2px);border-color:rgba(245,200,66,.35);background:rgba(24,33,47,.8)}
.c-card:active{transform:translateY(0)}
.c-card .cc-flag{font-size:1.6rem;line-height:1}
.c-card .cc-name{font-weight:800;font-size:.95rem;margin-top:6px}
.c-card .cc-meta{font-size:.75rem;color:#8899aa}
.c-card .cc-pay{font-size:1.05rem;font-weight:900;color:#f5c842;margin-top:6px;font-variant-numeric:tabular-nums}
details.faq{border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(17,22,32,.6);margin-bottom:10px;overflow:hidden}
details.faq summary{list-style:none;cursor:pointer;padding:15px 18px;font-weight:700;font-size:.94rem;display:flex;justify-content:space-between;gap:12px;align-items:center}
details.faq summary::-webkit-details-marker{display:none}
details.faq summary::after{content:'+';color:#f5c842;font-weight:900;font-size:1.15rem}
details.faq[open] summary::after{content:'−'}
details.faq summary:hover{color:#f5c842}
details.faq .faq-a{padding:0 18px 16px;color:#b0bec9;font-size:.88rem}
footer{background:#060809;border-top:1px solid rgba(255,255,255,.05)}
.foot-link{color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;transition:color .2s}
.foot-link:hover{color:#e8edf2}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}
.tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
[data-theme="light"] .stat-card,[data-theme="light"] .c-card,[data-theme="light"] details.faq{background:#fff;border-color:rgba(0,0,0,.08)}
[data-theme="light"] .stat-label,[data-theme="light"] .cc-meta,[data-theme="light"] .crumb{color:#64748b}
[data-theme="light"] .salary-table th{color:#64748b;background:rgba(0,0,0,.03);border-bottom-color:rgba(0,0,0,.1)}
[data-theme="light"] .salary-table td{border-bottom-color:rgba(0,0,0,.06)}
[data-theme="light"] .salary-table a{color:#0f172a}
[data-theme="light"] .salary-table tr:hover td{background:rgba(0,0,0,.02)}
[data-theme="light"] .article p,[data-theme="light"] .bar-name,[data-theme="light"] details.faq .faq-a{color:#475569}
/* strong に light を書き忘れると #e8edf2 のまま＝白地に白文字で消える（実測）。 */
[data-theme="light"] .article strong{color:#0f172a}
[data-theme="light"] .stat-value,[data-theme="light"] .bar-val,[data-theme="light"] details.faq summary{color:#0f172a}
[data-theme="light"] .bar-track{background:rgba(0,0,0,.07)}
[data-theme="light"] h1.c-title{background:linear-gradient(135deg,#0f172a 30%,#b08900);-webkit-background-clip:text;background-clip:text}
[data-theme="light"] .c-card .cc-pay{color:#a37b00}
[data-theme="light"] footer{background:#eef1f5;border-top-color:rgba(0,0,0,.07)}
`.trim();

/* ★ gtag は「直読みの <script async>」で書かない。後回しローダーで書く。
   ここは defer-third-party.mjs が全ページに入れている管理ブロック
   （<!--PV-3P--> … <!--/PV-3P-->）と **バイト単位で同じもの** を、
   最初から出している。

   なぜ揃えるか: 以前ここは直読みタグだった。そのせいで
   gen-countries.mjs を流し直すたびに、defer-third-party.mjs が
   103枚に入れた後回し化が丸ごと巻き戻っていた（実際に起きた）。
   同じものを出しておけば、生成し直しても後回しのままで、
   そのあと node defer-third-party.mjs を回しても 0枚（何も変わらない）。

   ★ 中身を変えるときは defer-third-party.mjs の loader() が正。
     あちらを直してから、このリテラルを合わせる。ズレると
     生成 → defer の往復で差分が出続ける。

   ★ 広告（AdSense）はここに書かない。
     このサイトは広告を一切出さない方針（オーナー確認済み・2026-08-07）。
     以前ここには adsbygoogle.js（ca-pub-6347707485416495）が入っていて、
     広告枠 <ins> を1つも置いていないのに **自動広告** だったため、
     Google が勝手に位置を決めて全ページに挿し込める状態だった。
     出す判断に変わるまで足さない。 */
const GTAG = `<!-- Google tag (gtag.js) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-3XYF69VQ3X');
</script>
<!--PV-3P-->
<script>
/* 広告と解析は、表示が終わるまで読まない。async でも帯域は奪うため。
   利用者が最初に触った時か load の、どちらか早いほうで読み込む。
   戻すときは node defer-third-party.mjs --undo */
(function(){
  var done=false;
  function boot(){
    if(done)return; done=true;
    [{"src":"https://www.googletagmanager.com/gtag/js?id=G-3XYF69VQ3X","cross":false}].forEach(function(it){
      var s=document.createElement('script');
      s.src=it.src; s.async=true;
      if(it.cross)s.crossOrigin='anonymous';
      document.head.appendChild(s);
    });
  }
  ['pointerdown','keydown','touchstart','scroll','wheel'].forEach(function(ev){
    addEventListener(ev,boot,{once:true,passive:true});
  });
  if(document.readyState==='complete')boot();
  else addEventListener('load',boot,{once:true});
})();
</script>
<!--/PV-3P-->`;

/* depth: ルート直下は '' 、countries/ 配下は '../' */
const nav = (lang, up) => `<nav id="main-nav">
  <div class="max-w-6xl mx-auto px-5 flex items-center justify-between h-[64px]">
    <a href="${up}index.html"><img src="${up}${lang === 'ja' ? '' : '../'}assets/logo.png" alt="PILOT VALUE" class="logo-img"/></a>
    <div class="flex items-center gap-3">
      <a href="${up}world-airlines.html" class="btn-ghost hidden md:inline-flex">${lang === 'ja' ? '航空会社一覧' : 'All Airlines'}</a>
      <a href="${up}world-jobs.html" class="btn-ghost">${lang === 'ja' ? '求人情報' : 'Jobs'}</a>
    </div>
  </div>
</nav>`;

const FOOT_LINKS = {
  ja: [['guide.html', 'ご利用案内'], ['policy.html', '運営ポリシー'], ['terms.html', '利用規約'],
    ['privacy.html', 'プライバシーポリシー'], ['help.html', 'ヘルプ'], ['sitemap.html', 'サイトマップ']],
  en: [['guide.html', 'Guide'], ['policy.html', 'Policy'], ['terms.html', 'Terms'],
    ['privacy.html', 'Privacy'], ['help.html', 'Help'], ['sitemap.html', 'Sitemap']],
};

const footer = (lang, up) => `<footer class="py-10 relative">
  <div class="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
    <a href="${up}index.html"><img src="${up}${lang === 'ja' ? '' : '../'}assets/logo.png" alt="PILOT VALUE" style="height:28px;opacity:.7"/></a>
    <p style="font-size:.75rem;color:#6b7d93">${lang === 'ja'
    ? '掲載年収は当サイトの推計。実際の条件は各社公式サイトでご確認ください。'
    : "Salary figures are our own estimates. Please confirm actual terms on each airline's official website."}</p>
    <a href="${up}index.html" class="btn-ghost">${lang === 'ja' ? '← トップへ' : '← Home'}</a>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,.06);margin-top:20px;padding-top:16px;text-align:center">
    <div style="display:flex;flex-wrap:wrap;justify-content:center">${FOOT_LINKS[lang]
    .map(([h, t]) => `<a href="${up}${h}" class="foot-link">${t}</a>`).join('')}</div>
  </div>
</footer>`;

/* ⚠️ search.js を外さない（2026-09-29）。
   これがハンバーガー ≡ と引き出しを組み立てる。無いと**スマホから他のページへ行く手段が
   丸ごと無くなる**（広い画面は普通に出るので、PC で見ているかぎり気づけない）。
   実際、このスクリプトを流し直した 2026-09-29 に 118枚から消えて
   `assert-links.mjs` の「スマホでメニューが出ない」が 0 → 118 になった。
   並びも変えない ── app-nav.js は search.js の**後**に読む決まりで、
   それを足すのは patch-side-nav.mjs（下の ⚠️ を読むこと）。 */
const scripts = (up, lang) => `<script src="${up}${lang === 'ja' ? '' : '../'}pv-toggles.js"></script>
<script src="${up}${lang === 'ja' ? '' : '../'}lang-toggle.js"></script>
<script src="${up}${lang === 'ja' ? '' : '../'}search.js"></script>
<script src="${up}${lang === 'ja' ? '' : '../'}currency.js"></script>`;

/* ⚠️⚠️ このスクリプトはページを**丸ごと書き直す**。流したあと、必ず続けて3本流す
        （2026-09-29。流し忘れて 118枚のナビが黙って古い形に戻った）──

          node inject-session.mjs      … pv-session.js（ログイン状態の判定）
          node patch-side-nav.mjs      … 左レール／引き出しと app-nav.js・app-nav.css
          node seo-normalize.mjs       … PV-SEO の管理ブロック

        ここで出している `<head>` と `<nav>` は**土台だけ**で、サイト共通のナビは
        別のスクリプトが後から配る形になっている。だから生成し直した直後のページは
        必ず「ナビの無い状態」になる。**画面は広い幅では普通に見えるので気づけない。**
        見るものは `node assert-links.mjs`（ファビコン・スマホのメニュー）。 */
function shell({ lang, title, desc, keywords, body, jsonld, up }) {
  /* ルートから見た相対の頭（countries/ は '../'、en/countries/ は '../../'）。 */
  const root = `${up}${lang === 'ja' ? '' : '../'}`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
<link rel="icon" type="image/png" sizes="32x32" href="${root}assets/favicon-32.png"/>
<link rel="apple-touch-icon" href="${root}assets/favicon-180.png"/>
  <script>(function(){var t=localStorage.getItem('pv-theme')||'light';document.documentElement.setAttribute('data-theme',t);}());</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>${STYLE}</style>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}${GTAG}
</head>
<body class="relative">
${nav(lang, up)}
<main class="relative" style="padding-top:88px">
${body}
</main>
${footer(lang, up)}
${scripts(up, lang)}
</body>
</html>
`;
}

/* ── 比較バー（世界平均・日本・当該国）─────────────────────────── */
function bars(rows, lang) {
  const max = Math.max(...rows.map((r) => r.v));
  return `<div>${rows.map((r) => `  <div class="bar-row">
    <div class="bar-name">${r.name}</div>
    <div class="bar-track"><div class="bar-fill${r.self ? ' is-self' : ''}" style="width:${((r.v / max) * 100).toFixed(1)}%"></div></div>
    <div class="bar-val num">${man(r.v)}</div>
  </div>`).join('\n')}</div>`;
}

/* ════════════════════════════════════════════════════════════════
   各国ページ
   ════════════════════════════════════════════════════════════════ */
function countryPage(c, lang) {
  const up = '../';
  const ja = lang === 'ja';
  /* ★ 英語の国名は「文に入れる形」と「素の形」で違う。
       name      文中・タイトル・h1 → "the USA"（"in United States" は英語として壊れている）
       nameLong  本文の初出で一度だけ → "the United States"
       nameBare  表のセル・チャートのラベル・keywords → "United States"（文ではないので冠詞なし）
     日本語はどれも同じ。冠詞も略称も無いので c.ja のまま。 */
  const name = ja ? c.ja : nameIn(c);
  const nameLong = ja ? c.ja : nameFull(c);
  const nameBare = ja ? c.ja : c.en;
  /* 文頭に来るときの形。地域ページの enCap と同じ役目（"the UAE levies…" は文頭で崩れる）。 */
  const nameCap = ja ? c.ja : nameIn(c).replace(/^the /, 'The ');
  /* 略称（USA / UK / UAE）。持たない国は nameBare と同じ値になる。 */
  const nameAbbr = ja ? c.ja : nameIn(c).replace(/^the /, '');
  /* ★ この国の平均・順位・世界比を出さない（根拠を調べた社が混ざる国）。 */
  const held = c.mixed;
  const rank = rankOf(c.code);
  const diff = held ? null : Math.round(((c.capAvg - WORLD_CAP) / WORLD_CAP) * 100);
  /* 混ざる国では「いちばん高い社」を出さない（社ごとに金額の意味が違うので
     高い順に並べられない）。社名が要る所のために先頭の社は持っておくが、
     順位の意味は持たせない。 */
  const topA = S[c.top || c.slugs[0]];
  const topName = ja ? topA.ja : topA.en;
  const taxFree = c.tax === 'none';
  const jp = ALL.find((x) => x.code === 'JP');
  /* 所属地域のハブ。日本だけは region==='japan' でハブを作っていないので undefined。 */
  const hub = hubOf(c.region);

  /* 同じ地域の他の国。地域が薄いときは年収が近い国で補う。
     ⚠️ 平均を保留した国は数で並べられないので後ろに回す（null は比較できない）。 */
  const byAvg = (a, b) => (b.capAvg ?? -1) - (a.capAvg ?? -1);
  let sibs = ALL.filter((x) => x.region === c.region && x.code !== c.code).sort(byAvg);
  if (sibs.length < 4) {
    const extra = ALL.filter((x) => x.code !== c.code && !sibs.includes(x))
      .sort((a, b) => (a.capAvg == null || b.capAvg == null || c.capAvg == null
        ? (a.capAvg == null ? 1 : 0) - (b.capAvg == null ? 1 : 0)
        : Math.abs(a.capAvg - c.capAvg) - Math.abs(b.capAvg - c.capAvg)));
    sibs = sibs.concat(extra).slice(0, 6);
  } else sibs = sibs.slice(0, 6);

  /* ★ 51カ国のうち 34カ国は掲載1社。「1 Airlines Compared」「1社を比較」は
     英語としても日本語としても壊れているし、1社しか無いものは比較できない。
     n===1 のときは文型ごと変える。 */
  const one = c.n === 1;

  /* ★ タイトルは「収まる中で一番情報量の多い形」を選ぶ。
     seo-normalize.mjs は幅が CORE_MAX を超えたタイトルを区切り記号で
     後ろから落とす。そこに長い文型を渡すと、意味の途中で切られる：

       オーストリアのパイロット年収【2026年最新】機長・副操縦士の給与  幅62
         → 「・」で切られて …【2026年最新】機長          ← 尻切れ

     国名の長さで幅が変わるので、固定の1文型では必ずどこかが切れる。
     候補を情報量の多い順に並べ、収まる最初のものを採る
     （seo-normalize.mjs の airlineTitle と同じやり方）。

     ★ 1社だけの国は社名を入れる。34カ国が該当し、そこには
       ドイツ（ルフトハンザ）・韓国（大韓航空）のような主要市場が含まれる。
       「機長・副操縦士の給与」は全34カ国で同じ文字列＝差別化にならないが、
       社名なら「ルフトハンザ 年収」のような社名クエリの受け皿になる。 */
  const title = fitTitle(ja
    ? [...(one ? [`${name}のパイロット年収【2026年最新】${topName}`]
                : [`${name}のパイロット年収【2026年最新】${c.n}社を比較`, `${name}のパイロット年収【2026年最新】${c.n}社`]),
       `${name}のパイロット年収【2026年最新】`,
       `${name}のパイロット年収`]
    : [...(one ? [`Pilot Salary in ${name} 2026 — ${topName}`]
                : [`Pilot Salary in ${name} 2026 — ${c.n} Airlines Compared`, `Pilot Salary in ${name} 2026 — ${c.n} Airlines`]),
       `Pilot Salary in ${name} 2026`]);

  /* ★ 平均を保留した国は、紹介文でも平均を言わない。
       検索結果に出る一文なので、ここに古い平均が残ると画面を直した意味が無い。 */
  const desc = held
    ? (ja
        ? `${one ? `${name}のパイロット年収。掲載は${topName}。` : `${name}に本拠を置く航空会社${c.n}社のパイロット年収。`}会社が公表した募集例・求人の掲載額・当サイトの推定を区分ごとに掲載。金額の種類が社ごとに違うため、国全体の平均は出していません。${taxFree ? '個人所得税はありません。' : ''}`
        : `${one ? `Pilot pay in ${name}, based on ${topName}.` : `Pilot pay at the ${c.n} airlines based in ${name}.`} Each figure is labelled — official posting, job advert, or our own estimate. No country average: the figures are not the same kind of number.${taxFree ? ' No personal income tax.' : ''}`)
    : (ja
        ? `${one ? `${name}のパイロット年収。掲載は${topName}。` : `${name}のパイロット年収を航空会社${c.n}社で比較。`}機長の推定年収は平均${man(c.capAvg)}（${range(c.capLo, c.capHi)}）、副操縦士は平均${man(c.foAvg)}。${taxFree ? '個人所得税が課されないため額面がそのまま手取りになります。' : `世界${NPUB}社の平均との比較と社別の一覧を掲載。`}`
        : `${one ? `Pilot pay in ${name}, based on ${topName}.` : `Pilot pay in ${name} across ${c.n} airlines.`} Captain estimate ${usd(c.capAvg)} (${usdRange(c.capLo, c.capHi)}), first officers ${usd(c.foAvg)}. ${taxFree ? 'No personal income tax, so the headline figure is take-home.' : `Compared against the ${NPUB}-airline world average, airline by airline.`}`);

  const keywords = ja
    ? `${name} パイロット 年収,${name} 航空会社 給与,${name} 機長 年収,${name} 副操縦士 年収,パイロット 海外 転職 ${name},${topName} パイロット 年収,PILOT VALUE`
    /* ここは文ではないので冠詞を付けない。略称を持つ国は素の名前と略称の両方を出す
       （"United States" と "USA" は同じ国の別の呼び名であって、水増しではない）。 */
    : `pilot salary ${nameBare},${nameBare} airline pilot pay,captain salary ${nameBare},first officer salary ${nameBare},${nameAbbr !== nameBare ? `pilot salary ${nameAbbr},` : ''}${topName} pilot salary,pilot jobs ${nameBare},PILOT VALUE`;

  /* ── FAQ（すべて SSOT から答えが出るものだけ）──────────────────
     ★ 金額の書き方を引数にする理由
       同じ FAQ を2箇所に出す：本文の <details class="faq"> と、
       構造化データ（JSON-LD）。この2つで正しい書き方が違う。

         本文     ¥4,380万 で書く。currency.js が実行時に走査して
                  英語ページなら $274K へ変換する（既定 USD）。
                  ここを $274K で固定すると通貨切替が効かなくなる。
         JSON-LD  currency.js は SKIP_TAG で <script> を除外するので
                  **一生変換されない**。英語ページの構造化データに
                  「¥4,380万」と書くと、Google が読む機械可読層が
                  日本円・万単位のままになる（英語52枚が該当していた）。

       description は同じ理由で既に usd() を使っている（上の USD_RATE の
       コメント）。同じ扱いを JSON-LD にも広げる。 */
  /* ★ 平均を保留した国は、FAQ の3問を差し替える（2026-09-29）。
       ・国の平均を答えない代わりに、金額を出せる社をその場で挙げる
       ・「いちばん高い社」を答えない（社ごとに金額の意味が違う）
       ・世界の順位を答えない（この国の平均が無いので並べられない）
     ⚠️ 空の答えを残さない。「なぜ出していないか」を必ず書く。 */
  const mkFaqHeld = (M) => {
    const paid = c.slugs.filter((s) => hasPaid(s, ja, M));
    const names = (xs) => xs.map((s) => (ja ? S[s].ja : S[s].en)).join(ja ? '・' : ', ');
    const sample = paid.slice(0, 3).map((s) => {
      const ls = PRANKS.flatMap((r) => paidLines(s, r, ja, M) || []);
      return ja ? `${S[s].ja}は${ls.join('、')}` : `${S[s].en} — ${ls.join('; ')}`;
    });
    const why = ja
      ? '会社が公表した募集の例、採用代理会社の求人、本人の申告が社ごとに混ざり、現金給与だけの額と住宅・学費などを含んだ総額も混ざります。同じ物差しになっていないので、単純に平均すると比べられない数になります。'
      : 'The figures come from different kinds of source — the airline\'s own vacancy, a recruitment agency advert, a pilot\'s own report — and some are cash pay while others include housing and school fees. They are not on one scale, so averaging them produces a number that cannot be compared.';
    return ja ? [
      [`${name}のパイロットの年収はいくらですか？`,
        `${name}の掲載${c.n}社については、国全体の平均を出していません。${why}${paid.length
          ? `金額を掲載できたのは${paid.length}社です。${sample.join('。')}。`
          : ''}${c.n - paid.length > 0 ? `残る${c.n - paid.length}社は、公開情報から当サイトが出した平均を掲載しています。` : ''}`],
      [`${name}で最もパイロットの年収が高い航空会社はどこですか？`,
        `高い順に並べることはしていません。${why}各社のページで、その金額が誰の・何を含んだ・いつの金額かと一緒に見てください。`],
      [`${name}のパイロット年収は世界的に見て高いですか？`,
        `国ごとの順位は出していません。順位は各国の掲載社の平均を並べたものですが、${name}の掲載社は金額の種類が混ざっているため、その平均を出していません。`],
    ] : [
      [`How much do pilots earn in ${name}?`,
        `We do not publish a country average for the ${c.n} airlines we list in ${name}. ${why}${paid.length
          ? ` We do publish figures for ${paid.length}: ${sample.join('. ')}.`
          : ''}${c.n - paid.length > 0 ? ` For the other ${c.n - paid.length} we publish our own average from public information.` : ''}`],
      [`Which airline in ${name} pays pilots the most?`,
        `We do not rank them. ${why} Each airline's page shows what its figure covers, who it applies to and when it was published.`],
      [`How does ${name} rank worldwide for pilot pay?`,
        `We do not give ${name} a rank. The ranking compares country averages, and the figures for ${name} are not the same kind of number, so we do not average them.`],
    ];
  };

  const mkFaqOpen = (M, R) => (ja ? [
    [`${name}のパイロットの年収はいくらですか？`,
      `PILOT VALUE が掲載している${name}の航空会社${c.n}社では、機長の推定年収の平均が${M(c.capAvg)}（${R(c.capLo, c.capHi)}）、副操縦士が${M(c.foAvg)}（${R(c.foLo, c.foHi)}）です。世界${NPUB}社の機長の推定年収の平均${M(WORLD_CAP)}と比べると${diff >= 0 ? `約${diff}%高い` : `約${Math.abs(diff)}%低い`}水準です。`],
    [`${name}で最もパイロットの年収が高い航空会社はどこですか？`,
      one
        ? `${name}で PILOT VALUE が掲載しているのは${topName}のみで、機長の推定年収の平均が${M(topA.cap.avg)}（${R(topA.cap.lo, topA.cap.hi)}）、副操縦士が${M(topA.fo.avg)}です。`
        : `掲載${c.n}社の中では${topName}が最も高く、機長の推定年収の平均が${M(topA.cap.avg)}（${R(topA.cap.lo, topA.cap.hi)}）、副操縦士が${M(topA.fo.avg)}です。`],
    [`${name}のパイロット年収は世界的に見て高いですか？`,
      `推定年収の平均を掲載している${RANKED.length}カ国で比べると${name}は第${rank}位です。世界${NPUB}社の平均は${M(WORLD_CAP)}で、${name}は${M(c.capAvg)}でした。`],
    ...(taxFree ? [[`${name}のパイロットの給与に所得税はかかりますか？`,
      `${name}では個人所得税が課されないため、掲載している金額がそのまま手取りに近くなります。所得税のある国の同額の給与と比べると、実際に手元に残る額は大きくなります。`]] : []),
    /* ⚠️ 日本との比較は、日本側の平均を保留したら出せない（倍率・差額は
         保留した数から作れない）。jp.capAvg が null の間はこの問い自体を出さない。 */
    ...(c.code !== 'JP' && jp?.capAvg != null ? [[`日本の航空会社と比べてどうですか？`,
      `日本の掲載${jp.n}社の機長の推定年収の平均は${M(jp.capAvg)}です。${name}の${M(c.capAvg)}と比べると${c.capAvg >= jp.capAvg ? `${M(c.capAvg - jp.capAvg)}高く` : `${M(jp.capAvg - c.capAvg)}低く`}なっています。`]] : []),
  ] : [
    [`How much do pilots earn in ${name}?`,
      `${one ? `At ${topName}, the only airline we list in ${name}` : `Across the ${c.n} airlines we list in ${name}`}, our captain estimate averages ${M(c.capAvg)} (${R(c.capLo, c.capHi)}) and first officers average ${M(c.foAvg)} (${R(c.foLo, c.foHi)}). That is ${diff >= 0 ? `about ${diff}% above` : `about ${Math.abs(diff)}% below`} the ${M(WORLD_CAP)} captain average across the ${NPUB} airlines whose average pay we publish.`],
    [`Which airline in ${name} pays pilots the most?`,
      one
        ? `${topName} is the only airline we list in ${name}: our captain estimate is ${M(topA.cap.avg)} (${R(topA.cap.lo, topA.cap.hi)}) and first officers ${M(topA.fo.avg)}.`
        : `Of the ${c.n} airlines listed, ${topName} pays the most: our captain estimate is ${M(topA.cap.avg)} (${R(topA.cap.lo, topA.cap.hi)}) and first officers ${M(topA.fo.avg)}.`],
    [`How does ${name} rank worldwide for pilot pay?`,
      `Ranked by captain average across the ${RANKED.length} countries we publish an estimate for, ${name} is number ${rank}. That average is ${M(WORLD_CAP)} across the ${NPUB} airlines whose average pay we publish; ${name} sits at ${M(c.capAvg)}.`],
    ...(taxFree ? [[`Is pilot pay in ${name} tax-free?`,
      `${nameCap} levies no personal income tax, so the figures shown are close to take-home. Against an identical gross salary in a country that taxes income, the amount you actually keep is materially higher.`]] : []),
    ...(c.code !== 'JP' && jp ? [[`How does it compare with Japanese airlines?`,
      `Our captain estimate across the ${jp.n} Japanese airlines we list averages ${M(jp.capAvg)}. ${nameCap} at ${M(c.capAvg)} is ${c.capAvg >= jp.capAvg ? `${M(c.capAvg - jp.capAvg)} higher` : `${M(jp.capAvg - c.capAvg)} lower`}.`]] : []),
  ]);

  /* 本文用は円表記（currency.js が変換する）。 */
  const faq = held ? mkFaqHeld(man) : mkFaqOpen(man, range);
  /* 構造化データ用は、英語ページだけ USD で固定して書く。
     日本語ページは日本円のままが正しいので faq をそのまま使う。 */
  const faqLd = ja ? faq : (held ? mkFaqHeld(usd) : mkFaqOpen(usd, usdRange));

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: faqLd.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      {
        '@type': 'ItemList',
        name: ja ? `${name}の航空会社パイロット年収ランキング` : `Pilot salary by airline in ${name}`,
        numberOfItems: c.n,
        itemListElement: c.slugs.map((s, i) => ({
          '@type': 'ListItem', position: i + 1, name: ja ? S[s].ja : S[s].en,
          url: `https://pilot-value.com/${ja ? '' : 'en/'}airlines/${s}.html`,
        })),
      },
    ],
  };

  /* ★ 金額の表は2つに分ける（2026-09-29）。
       ・上＝根拠を確認した社。「何の額か・等級」を必ず並べて出し、
         金額を1つも出せない職位だけ「確認中」と書く（0 や空欄で埋めない）
       ・下＝まだ調べていない社。今までどおり平均とレンジを出す
     混ぜて1つの表にすると、読む側には同じ物差しの数字に見えてしまう。 */
  const RK3 = [['cap', '機長', 'Captain'], ['fo', '副操縦士', 'First officer'], ['crew', '運航乗務員', 'Flight crew']];
  /* 会社自身が出した金額（公式募集例・求人・過去広告・条件つきの給与例）が取れた社の数。
     ⚠️ 推定は「会社が出した金額」ではないので数えない（paidLines は推定も返すので
        等級で絞る）。 */
  const OWN = (slug) => ['cap', 'fo', 'crew'].some((r) => {
    const t = BASIS[slug]?.[r]?.tier;
    return t !== undefined && t !== 'estimate' && t !== 'held' && yearly(slug, r).some((f) => !f.training);
  });
  const paidN = c.ledger.filter(OWN).length;
  const basisRows = c.ledger.map((s) => {
    const a = S[s];
    const ls = [];
    for (const [r, jn, en] of RK3) {
      if (!BASIS[s][r]) continue;
      const p = paidLines(s, r, ja, man);
      ls.push([ja ? jn : en, p ? p.join(ja ? '／' : '; ') : HELD(ja)]);
    }
    if (!ls.length) ls.push([ja ? '機長・副操縦士' : 'Captain / first officer', HELD(ja)]);
    return ls.map((L, i) => `      <tr>
${i === 0 ? `        <td rowspan="${ls.length}"><a href="${up}airlines/${s}.html">${esc(ja ? a.ja : a.en)}</a></td>\n` : ''}        <td>${L[0]}</td>
        <td>${L[1]}</td>
      </tr>`).join('\n');
  }).join('\n');

  /* 平均とレンジをそのまま出す社（この国のうち、台帳に載っていない社）。
     ⚠️ 判定は !BASIS[s]。CHECKED（＝物差しが違う社）で切ると、
        推定の社が**両方の表に出る**（2026-09-30 に踏んだ）。 */
  const openSlugs = c.slugs.filter((s) => !BASIS[s]);
  const rows = openSlugs.map((s) => {
    const a = S[s];
    return `      <tr>
        <td><a href="${up}${ja ? '' : ''}airlines/${s}.html">${esc(ja ? a.ja : a.en)}</a></td>
        <td class="num" style="font-weight:800;color:#f5c842">${man(a.cap.avg)}</td>
        <td class="num" style="color:#8899aa">${range(a.cap.lo, a.cap.hi)}</td>
        <td class="num" style="font-weight:700">${man(a.fo.avg)}</td>
        <td class="num" style="color:#8899aa">${range(a.fo.lo, a.fo.hi)}</td>
      </tr>`;
  }).join('\n');

  /* ★出どころを調べた社の表（2026-09-30）。
       **国の平均を出す国でもこの表を出す。** 2026-09-29 の作りでは、平均を出さない国
       （held）のときだけこの表が出ていた。推定に戻した結果、日本・シンガポール・韓国など
       平均を出す国では ANA・JAL などが「機長 平均」の表に落ち、
       推定の数字に「平均」の札が付くことになる。それはオーナーが外したものそのもの。 */
  const basisTable = c.ledger.length ? `
    <h3>${ja ? `出どころを調べた会社（${c.ledger.length}社）` : `Airlines whose sources we have checked (${c.ledger.length})`}</h3>
    <p>${ja
    ? `「公式募集例」は会社自身が募集で示した額、「求人の掲載額」は採用を代行する会社の求人、「過去の募集広告」は過去に出た募集、「条件つきの給与例」は資料と計算式が確認できるモデル額です。「推定」は当サイトが公開情報から推計した金額で、会社が公表した平均ではありません。`
    : `“Official posting” means the airline’s own published figure, “job posting” a recruitment agency’s advert, “past ad” a vacancy that has since closed, and “modelled example” a figure we can reproduce from a published document and its formula. “Estimated” is our own estimate from public information, not a figure the airline publishes.`}</p>
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>${ja ? '航空会社' : 'Airline'}</th>
          <th>${ja ? '職位' : 'Position'}</th>
          <th>${ja ? '掲載している年間の金額' : 'Annual figure we publish'}</th>
        </tr></thead>
        <tbody>
${basisRows}
        </tbody>
      </table>
    </div>
` : '';

  /* 台帳に載っていない社の表。上の表と併せて出すときだけ見出しを付ける。 */
  const openTable = openSlugs.length ? `${c.ledger.length ? `
    <h3>${ja ? `そのほかの掲載社（${openSlugs.length}社）` : `Other airlines we list (${openSlugs.length})`}</h3>
    <p>${ja
    ? `この${openSlugs.length}社は平均とレンジを掲載しています。出どころの確認は上の${c.ledger.length}社から順に進めています。`
    : `For these ${openSlugs.length} we publish an average and a range. We are working through the sources airline by airline, starting with the ${c.ledger.length} above.`}</p>` : ''}
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>${ja ? '航空会社' : 'Airline'}</th>
          <th>${ja ? '機長 推定年収' : 'Captain est.'}</th>
          <th>${ja ? '機長 レンジ' : 'Captain range'}</th>
          <th>${ja ? '副操縦士 推定年収' : 'F/O est.'}</th>
          <th>${ja ? '副操縦士 レンジ' : 'F/O range'}</th>
        </tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
` : '';

  /* 並べて比べる帯は、保留した国では出さない（保留した数は並べられない）。 */
  const cmpRows = held ? [] : [
    { name: ja ? '世界の推定平均' : 'World average', v: WORLD_CAP },
    ...(c.code !== 'JP' && jp?.capAvg != null ? [{ name: ja ? '日本' : 'Japan', v: jp.capAvg }] : []),
    { name: `${c.flag} ${nameBare}`, v: c.capAvg, self: true },
    ...RANKED.slice(0, 3).filter((x) => x.code !== c.code && x.code !== 'JP')
      .map((x) => ({ name: `${x.flag} ${ja ? x.ja : x.en}`, v: x.capAvg })),
  ];

  const body = `<div class="max-w-6xl mx-auto px-5">

  <p class="crumb mb-4">
    <a href="${up}index.html">${ja ? 'ホーム' : 'Home'}</a> ›
    <a href="${up}countries.html">${ja ? '国別のパイロット年収' : 'Pilot Salary by Country'}</a> ›
    <span>${esc(nameBare)}</span>
  </p>

  <header class="flex items-start gap-5 mb-7">
    <div class="hero-flag" aria-hidden="true">${c.flag}</div>
    <div>
      <h1 class="c-title">${esc(ja ? `${name}のパイロット年収` : `Pilot Salary in ${name}`)}</h1>
      <p style="color:#8899aa;font-size:.9rem;margin-top:6px">${held ? (ja
    ? `${name}に本拠を置く航空会社${c.n}社を掲載しています。金額は、会社が公表した募集の例・採用の求人・過去の募集広告・当サイトの推定を区分ごとに出しています。航空当局は${c.auth}。`
    : `${c.n} airline${one ? '' : 's'} based in ${nameLong}. Each figure is labelled by what it is — the airline's own vacancy, a recruitment advert, a closed advert, or our own estimate. Civil aviation authority: ${c.auth}.`) : (ja
    ? (one
        ? `${name}に本拠を置く${topName}を、機長・副操縦士それぞれの推定年収とレンジで掲載しています。航空当局は${c.auth}。`
        : `${name}に本拠を置く航空会社${c.n}社を、機長・副操縦士それぞれの推定年収とレンジで比較しています。航空当局は${c.auth}。`)
    : (one
        ? `${topName}, based in ${nameLong}, with our captain and first officer estimates and ranges. Civil aviation authority: ${c.auth}.`
        : `${c.n} airlines based in ${nameLong}, compared on our captain and first officer estimates and ranges. Civil aviation authority: ${c.auth}.`))}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <span class="tag tag-blue">${ja ? `${c.n}社を掲載` : `${c.n} airline${one ? '' : 's'}`}</span>
        ${held
    ? `<span class="tag tag-blue">${ja ? '国全体の平均は出していません' : 'No country average'}</span>`
    : `<span class="tag tag-gold">${ja ? `${RANKED.length}カ国中 第${rank}位` : `#${rank} of ${RANKED.length} countries`}</span>`}
        ${taxFree ? `<span class="tag tag-green">${ja ? '個人所得税なし' : 'No income tax'}</span>` : ''}
      </div>
    </div>
  </header>

  <section class="stat-grid mb-10">${held ? `
    <div class="stat-card">
      <div class="stat-label">${ja ? '掲載している会社' : 'Airlines listed'}</div>
      <div class="stat-value num">${c.n}</div>
      <div class="stat-sub">${ja ? `うち${c.ledger.length}社は出どころを調べた` : `${c.ledger.length} with sources checked`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '金額を掲載できた会社' : 'Airlines with a figure'}</div>
      <div class="stat-value num" style="color:#f5c842">${paidN}</div>
      <div class="stat-sub">${ja ? '会社の募集・求人・本人の申告から' : 'from vacancies, adverts and pilot reports'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '国全体の平均' : 'Country average'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${ja ? '出していません' : 'Not published'}</div>
      <div class="stat-sub">${ja ? '社ごとに金額の意味が違うため' : 'the figures are not on one scale'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '個人所得税' : 'Personal income tax'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${taxFree ? (ja ? 'なし' : 'None') : (ja ? 'あり' : 'Yes')}</div>
      <div class="stat-sub">${esc(c.auth)}</div>
    </div>` : `
    <div class="stat-card">
      <div class="stat-label">${ja ? '機長 推定年収' : 'Captain estimate'}</div>
      <div class="stat-value num" style="color:#f5c842">${man(c.capAvg)}</div>
      <div class="stat-sub num">${range(c.capLo, c.capHi)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '副操縦士 推定年収' : 'First officer estimate'}</div>
      <div class="stat-value num">${man(c.foAvg)}</div>
      <div class="stat-sub num">${range(c.foLo, c.foHi)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '世界平均との差' : 'vs world average'}</div>
      <div class="stat-value num" style="color:${diff >= 0 ? '#34d399' : '#fb923c'}">${diff >= 0 ? '+' : ''}${diff}%</div>
      <div class="stat-sub">${ja ? `世界${NPUB}社平均 ` : `world avg `}<span class="num">${man(WORLD_CAP)}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '最高水準の会社' : 'Top payer'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${esc(topName)}</div>
      <div class="stat-sub num">${ja ? '機長 ' : 'captain '}${man(topA.cap.avg)}</div>
    </div>`}
  </section>

  <section class="article">
    <h2 id="airlines">${ja ? `${name}の航空会社別 パイロット年収` : `Pilot salary by airline in ${name}`}</h2>
${held ? `    <p>${ja
    ? `会社ごとに、その金額が<strong>誰の・何を含んだ・いつの金額か</strong>を添えて出しています。社名をクリックすると、出どころ（発行元・資料名・適用時点・確認日）と、保有機材・応募条件・現役パイロットの口コミが見られます。${taxFree ? `なお${name}では個人所得税が課されないため、下の金額はほぼそのまま手取りになります。` : ''}`
    : `Each figure is shown with <strong>who it applies to, what it includes and when it was published</strong>. Click an airline for the source itself — publisher, document, the period it applies to and the date we checked it — plus its fleet, hiring requirements and reviews from working pilots.${taxFree ? ` Note that ${name} levies no personal income tax, so these figures are close to take-home.` : ''}`}</p>

${basisTable}${openTable}
    <h2 id="compare">${ja ? `${name}の順位を出していない理由` : `Why we do not rank ${name}`}</h2>
    <p>${ja
    ? `${name}については、国全体の平均・世界の中での順位・他国との倍率を出していません。上の表のとおり、会社が募集で示した現金給与、採用代行会社の求人、本人の申告、住宅や学費を含んだ総待遇が混ざっています。これを単純に平均すると、どの会社の何の金額を足したのか説明できない数になります。会社の数字の単純平均は、その国のパイロット全体の平均ではありません。`
    : `We do not publish a country average for ${name}, a worldwide rank, or a multiple against another country. As the table above shows, the figures mix an airline’s own published cash pay, a recruitment agency’s advert, a pilot’s own report, and packages that include housing and school fees. Averaging those produces a number we could not explain. The unweighted mean of a few airlines is not the average for every pilot in a country.`}</p>
    <p>${ja
    ? `比べるときは、同じ種類の金額どうしで比べてください。各社のページに、その金額の発行元・資料名・適用時点・確認日を載せています。`
    : `To compare, compare like with like. Every airline page carries the publisher, the document, the period it applies to and the date we checked it.`}</p>` : `    <p>${ja
    ? `${c.ledger.length ? `出どころを調べた会社を先に、その金額が<strong>誰の・何を含んだ・いつの金額か</strong>を添えて出しています。そのほかの社は機長の推定年収が高い順です。` : `機長の推定年収が高い順に並べています。`}社名をクリックすると、その会社の年収の内訳・保有機材・応募条件・現役パイロットの口コミが見られます。${taxFree ? `なお${name}では個人所得税が課されないため、下の金額はほぼそのまま手取りになります。` : ''}`
    : `${c.ledger.length ? `Airlines whose sources we have checked come first, each figure shown with <strong>who it applies to, what it includes and when it was published</strong>. The rest are sorted by captain average, highest first.` : `Sorted by captain average, highest first.`} Click an airline for its pay breakdown, fleet, hiring requirements and reviews from working pilots.${taxFree ? ` Note that ${name} levies no personal income tax, so these figures are close to take-home.` : ''}`}</p>
${basisTable}${openTable}
    <h2 id="compare">${ja ? `${name}は世界のどのあたりか` : `Where ${name} sits worldwide`}</h2>
    <p>${ja
    ? `機長の推定年収の平均で比べたものです。${name}は${man(c.capAvg)}で、世界${NPUB}社の推定年収の平均${man(WORLD_CAP)}に対して<strong>${diff >= 0 ? `約${diff}%高い` : `約${Math.abs(diff)}%低い`}</strong>水準。平均を掲載している${RANKED.length}カ国の中では第${rank}位です。`
    : `Captain estimates side by side. ${nameCap} sits at ${man(c.capAvg)} against a ${man(WORLD_CAP)} average across all ${NPUB} airlines we list — <strong>${diff >= 0 ? `about ${diff}% above` : `about ${Math.abs(diff)}% below`}</strong>. That places it ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} of the ${RANKED.length} countries we give an average for.`}</p>
    <div class="glass" style="padding:18px 20px">${bars(cmpRows, lang)}</div>
    <p style="font-size:.78rem;color:#6b7d93;margin-top:10px">${ja
    ? `※ 各国の値は、その国に本拠を置く掲載社の機長の推定年収の単純平均です。副操縦士は${man(WORLD_FO)}（世界${NPUB}社）。どれも公開情報から当サイトが出した推定で、会社が公表した平均ではありません。会社が募集などで自分から示した金額は、各社のページに別に載せています。`
    : `Country figures are the unweighted mean of our captain estimates for the airlines we list there. First officers: ${man(WORLD_FO)} across ${NPUB} airlines. These are our own estimates from public information, not figures the airlines publish. Where an airline has published a figure itself, we show that separately on its own page.`}</p>`}

    <h2 id="others">${ja ? '他の国と比べる' : 'Compare other countries'}</h2>
${hub ? `    <p>${ja
    ? `${hub.ja}全体でまとめて見るなら <a href="${up}${hub.slug}.html">${hub.ja}のパイロット年収</a>（${hub.n}社・${hub.nc}カ国${hub.capAvg == null ? '' : `、機長平均${man(hub.capAvg)}`}）へ。`
    : `To see the whole region at once, go to <a href="${up}${hub.slug}.html">pilot salary in ${hub.en}</a> — ${hub.n} airlines across ${hub.nc} countries${hub.capAvg == null ? '' : `, captains averaging ${man(hub.capAvg)}`}.`}</p>\n` : ''}    <div class="c-grid">
${sibs.map((x) => `      <a class="c-card" href="${x.slug}.html">
        <div class="cc-flag">${x.flag}</div>
        <div class="cc-name">${esc(ja ? x.ja : x.en)}</div>
        <div class="cc-meta">${ja ? `${x.n}社` : `${x.n} airline${x.n > 1 ? 's' : ''}`}</div>
        <div class="cc-pay${x.capAvg == null ? '' : ' num'}"${x.capAvg == null ? ' style="font-size:.8rem;color:#8899aa"' : ''}>${manH(x.capAvg, ja)}</div>
      </a>`).join('\n')}
    </div>

    <h2 id="faq">${ja ? 'よくある質問' : 'Frequently asked questions'}</h2>
${faq.map(([q, a]) => `    <details class="faq"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join('\n')}

    <div class="glass" style="padding:22px 24px;margin-top:2.5rem">
      <p style="margin:0 0 12px;font-weight:800;font-size:1rem">${ja ? '次に見るなら' : 'Where to next'}</p>
      <div class="flex flex-wrap gap-3">
        <a href="${up}countries.html" class="btn-ghost">${ja ? '国別のパイロット年収 一覧' : 'All countries'}</a>
        <a href="${up}world-airlines.html" class="btn-ghost">${ja ? `世界${N}社の一覧` : `All ${N} airlines`}</a>
        <a href="${up}pilot-salary-guide.html" class="btn-ghost">${ja ? 'パイロット年収ガイド' : 'Pilot salary guide'}</a>
        <a href="${up}world-jobs.html" class="btn-ghost">${ja ? '海外の求人情報' : 'Overseas jobs'}</a>
      </div>
    </div>
  </section>
</div>`;

  return shell({ lang, title: `${title} | PILOT VALUE`, desc, keywords, body, jsonld, up });
}

/* ════════════════════════════════════════════════════════════════
   地域ハブ（ルート直下 {slug}.html / en/{slug}.html）
   ════════════════════════════════════════════════════════════════ */
function regionPage(r, lang) {
  const up = '';
  const ja = lang === 'ja';
  const name = ja ? r.ja : r.en;
  const nameCap = ja ? r.ja : r.enCap;
  /* ★ 根拠を調べた社が混ざる地域は、平均・順位・世界比・月収・最高の社を出さない
       （2026-09-29。アジアと中東がこれに当たる）。 */
  const held = r.mixed;
  const rank = held ? null : REG_RANKED.findIndex((x) => x.key === r.key) + 1;
  const diff = held ? null : Math.round(((r.capAvg - WORLD_CAP) / WORLD_CAP) * 100);
  const topA = S[r.top || r.slugs[0]];
  const topName = ja ? topA.ja : topA.en;
  const topC = r.countries[0];
  const jp = ALL.find((x) => x.code === 'JP');
  const others = REG.filter((x) => x.key !== r.key).sort((a, b) => (b.capAvg ?? -1) - (a.capAvg ?? -1));
  /* 月収は年収 ÷ 12 のみ。手当の内訳も賞与の比率も SSOT に無いので書かない。
     ⚠️ 平均を保留した地域では出せない（保留した数を12で割れない）。 */
  const capM = held ? null : Math.round(r.capAvg / 12);
  const foM = held ? null : Math.round(r.foAvg / 12);
  /* この地域で、根拠を確認して表示を変えた社／まだ調べていない社。 */
  /* ⚠️ 判定は !BASIS[s]。CHECKED（＝物差しが違う社）で切ると推定の社が両方の表に出る。 */
  const openSlugs = r.slugs.filter((s) => !BASIS[s]);
  const nth = (i) => (i === 1 ? '1st' : i === 2 ? '2nd' : i === 3 ? '3rd' : `${i}th`);

  const title = fitTitle(ja
    ? [`${name}のパイロット年収【2026年最新】${r.n}社・${r.nc}カ国を比較`,
       `${name}のパイロット年収【2026年最新】${r.n}社を比較`,
       `${name}のパイロット年収【2026年最新】`,
       `${name}のパイロット年収`]
    : [`Pilot Salary in ${name} 2026 — ${r.n} Airlines in ${r.nc} Countries`,
       `Pilot Salary in ${name} 2026 — ${r.n} Airlines Compared`,
       `Pilot Salary in ${name} 2026 — ${r.n} Airlines`,
       `Pilot Salary in ${name} 2026`]);

  /* head の中は currency.js の走査対象外。英語版の金額は生成時に USD へ寄せる
     （countryPage と同じ理由。上の USD_RATE のコメント）。 */
  const desc = held
    ? (ja
        ? `${name}のパイロット年収を航空会社${r.n}社・${r.nc}カ国で掲載。会社が公表した募集例・求人の掲載額・当サイトの推定を区分ごとに出しています。金額の種類が社ごとに違うため、地域全体の平均は出していません。`
        : `Pilot pay at ${r.n} airlines across ${r.nc} countries in ${name}. Every figure is labelled — official posting, job advert, or our own estimate. No regional average: the figures are not the same kind of number.`)
    : (ja
        ? `${name}のパイロット年収を航空会社${r.n}社・${r.nc}カ国で比較。機長は平均${man(r.capAvg)}（${range(r.capLo, r.capHi)}）、副操縦士は平均${man(r.foAvg)}。最高水準は${topName}の${man(topA.cap.avg)}。世界${NPUB}社の平均との差と、国別・社別の一覧を掲載。`
        : `Pilot pay across ${name}: ${r.n} airlines in ${r.nc} countries. Captains average ${usd(r.capAvg)} (${usdRange(r.capLo, r.capHi)}), first officers ${usd(r.foAvg)}. ${topName} pays the most at ${usd(topA.cap.avg)}. Country-by-country and airline-by-airline, against the ${NPUB}-airline world average.`);

  const keywords = ja
    ? `${name} パイロット 年収,${name} 航空会社 給与,${name} 機長 年収,${name} 副操縦士 年収,パイロット 海外 転職 ${name},${name} エアライン 年収 比較,PILOT VALUE`
    : `pilot salary ${name},airline pilot pay ${name},captain salary ${name},first officer salary ${name},pilot jobs ${name},highest paying airlines ${name},PILOT VALUE`;

  /* 本文は円表記（currency.js が実行時に変換）、JSON-LD は英語版だけ USD 固定。
     countryPage の mkFaq と同じ二重描画。 */
  /* ★ 平均を保留した地域は、5問を差し替える（2026-09-29）。
       ・地域の平均・順位・世界比を答えない代わりに、金額を出せる社を挙げる
       ・「いちばん高い社」「いちばん高い国」を答えない
       ・月収も出さない（保留した数を12で割れない）
     ⚠️ 空の答えを残さない。「なぜ出していないか」を必ず書く。 */
  const mkFaqHeld = (M) => {
    const paid = r.slugs.filter((s) => hasPaid(s, ja, M));
    const sample = paid.slice(0, 3).map((s) => {
      const ls = PRANKS.flatMap((k) => paidLines(s, k, ja, M) || []);
      return ja ? `${S[s].ja}は${ls.join('、')}` : `${S[s].en} — ${ls.join('; ')}`;
    });
    const why = ja
      ? '会社が公表した募集の例、採用代理会社の求人、本人の申告が社ごとに混ざり、現金給与だけの額と住宅・学費などを含んだ総額も混ざります。同じ物差しになっていないので、単純に平均すると比べられない数になります。'
      : 'The figures come from different kinds of source — the airline\'s own vacancy, a recruitment agency advert, a pilot\'s own report — and some are cash pay while others include housing and school fees. They are not on one scale, so averaging them produces a number that cannot be compared.';
    return ja ? [
      [`${name}のパイロットの年収はいくらですか？`,
        `${name}の掲載${r.n}社については、地域全体の平均を出していません。${why}${paid.length ? `金額を掲載できたのは${paid.length}社です。${sample.join('。')}。` : ''}`],
      [`${name}で最もパイロットの年収が高い航空会社はどこですか？`,
        `高い順に並べることはしていません。${why}各社のページで、その金額が誰の・何を含んだ・いつの金額かと一緒に見てください。`],
      ...(r.nc > 1 ? [[`${name}で最もパイロットの年収が高い国はどこですか？`,
        `国を高い順に並べることもしていません。国ごとの値は、その国の掲載社の金額を平均したものですが、${name}では社ごとに金額の意味が違うためその平均を出していません。`]] : []),
      [`${name}のパイロットの月収はいくらですか？`,
        `地域の平均を出していないので、それを12で割った月収も出していません。月あたりの額は、会社が月額として公表しているものだけを各社のページに載せています（年額を12で割った数は、実際に毎月入る額とは違います）。`],
      ...(r.taxFree > 0 ? [[`${name}のパイロットの給与に所得税はかかりますか？`,
        `掲載${r.n}社のうち${r.taxFree}社は個人所得税が課されない国に本拠を置いています。その場合、掲載している金額がそのまま手取りに近くなります。`]] : []),
    ] : [
      [`How much do pilots earn in ${name}?`,
        `We do not publish a regional average for the ${r.n} airlines we list in ${name}. ${why}${paid.length ? ` We do publish figures for ${paid.length}: ${sample.join('. ')}.` : ''}`],
      [`Which airline in ${name} pays pilots the most?`,
        `We do not rank them. ${why} Each airline's page shows what its figure covers, who it applies to and when it was published.`],
      ...(r.nc > 1 ? [[`Which country in ${name} pays pilots the most?`,
        `We do not rank the countries either. A country figure is the mean of its airlines' figures, and in ${name} those figures do not mean the same thing, so we are not publishing that mean.`]] : []),
      [`What is the monthly pilot salary in ${name}?`,
        `We do not publish a monthly figure, because we do not publish the regional annual average it would be divided from. Where an airline publishes a monthly figure itself, it is on that airline's page. An annual figure divided by twelve is not what lands each month.`],
      ...(r.taxFree > 0 ? [[`Is pilot pay in ${name} tax-free?`,
        `${r.taxFree} of the ${r.n} airlines listed ${r.taxFree > 1 ? 'are based in countries that levy' : 'is based in a country that levies'} no personal income tax, so for ${r.taxFree > 1 ? 'those' : 'that one'} the figures we publish are close to take-home.`]] : []),
    ];
  };

  const mkFaqOpen = (M, R) => (ja ? [
    [`${name}のパイロットの年収はいくらですか？`,
      `PILOT VALUE が掲載している${name}の航空会社${r.n}社では、機長の平均が${M(r.capAvg)}（${R(r.capLo, r.capHi)}）、副操縦士の平均が${M(r.foAvg)}（${R(r.foLo, r.foHi)}）です。世界${NPUB}社の機長の推定年収の平均${M(WORLD_CAP)}と比べると${diff >= 0 ? `約${diff}%高い` : `約${Math.abs(diff)}%低い`}水準で、平均を出している${REG_RANKED.length}地域の中では第${rank}位です。`],
    [`${name}で最もパイロットの年収が高い航空会社はどこですか？`,
      `掲載${r.n}社の中では${topName}が最も高く、機長の推定年収の平均が${M(topA.cap.avg)}（${R(topA.cap.lo, topA.cap.hi)}）、副操縦士が${M(topA.fo.avg)}（${R(topA.fo.lo, topA.fo.hi)}）です。`],
    ...(r.nc > 1 ? [[`${name}で最もパイロットの年収が高い国はどこですか？`,
      `${name}の掲載${r.nc}カ国では${topC.ja}が最も高く、同国の掲載${topC.n}社の機長平均は${M(topC.capAvg)}です。`]] : []),
    [`${name}のパイロットの月収はいくらですか？`,
      `${name}の平均年収を12で割ると、機長で月あたり約${M(capM)}、副操縦士で約${M(foM)}になります。実際に毎月入る額は乗務時間で動きますし、年1〜2回の賞与がある会社では毎月の額はこれより低く、賞与月に跳ねます。`],
    ...(r.taxFree > 0 ? [[`${name}のパイロットの給与に所得税はかかりますか？`,
      `掲載${r.n}社のうち${r.taxFree}社は個人所得税が課されない国に本拠を置いています。その場合、上の金額がそのまま手取りに近くなります。所得税のある国の同額の給与と比べると、手元に残る額は大きくなります。`]] : []),
    ...(jp?.capAvg != null ? [[`日本の航空会社と比べてどうですか？`,
      `日本の掲載${jp.n}社の機長の推定年収の平均は${M(jp.capAvg)}です。${name}の${M(r.capAvg)}と比べると${r.capAvg >= jp.capAvg ? `${M(r.capAvg - jp.capAvg)}高く` : `${M(jp.capAvg - r.capAvg)}低く`}なっています。`]] : []),
  ] : [
    [`How much do pilots earn in ${name}?`,
      `Across the ${r.n} ${nameCap === 'The Middle East' ? 'Middle Eastern' : name} airlines on PILOT VALUE, captains average ${M(r.capAvg)} (${R(r.capLo, r.capHi)}) and first officers average ${M(r.foAvg)} (${R(r.foLo, r.foHi)}). That is ${diff >= 0 ? `about ${diff}% above` : `about ${Math.abs(diff)}% below`} the ${M(WORLD_CAP)} captain average across the ${NPUB} airlines whose average pay we publish, and ${nth(rank)} of the ${REG_RANKED.length} regions we give an average for.`],
    [`Which airline in ${name} pays pilots the most?`,
      `Of the ${r.n} airlines listed, ${topName} pays the most: our captain estimate is ${M(topA.cap.avg)} (${R(topA.cap.lo, topA.cap.hi)}) and first officers ${M(topA.fo.avg)} (${R(topA.fo.lo, topA.fo.hi)}).`],
    ...(r.nc > 1 ? [[`Which country in ${name} pays pilots the most?`,
      `Of the ${r.nc} countries in ${name} that we cover, ${topC.en} is highest: captains at its ${topC.n} listed airline${topC.n > 1 ? 's' : ''} average ${M(topC.capAvg)}.`]] : []),
    [`What is the monthly pilot salary in ${name}?`,
      `Dividing the regional average by 12 gives roughly ${M(capM)} a month for captains and ${M(foM)} for first officers. What actually lands each month moves with block hours flown, and where an annual bonus is paid the regular monthly figure sits lower with a spike in the bonus month.`],
    ...(r.taxFree > 0 ? [[`Is pilot pay in ${name} tax-free?`,
      `${r.taxFree} of the ${r.n} airlines listed ${r.taxFree > 1 ? 'are based in countries that levy' : 'is based in a country that levies'} no personal income tax, so for ${r.taxFree > 1 ? 'those' : 'that one'} the figures above are close to take-home. Against an identical gross salary in a country that taxes income, the amount you actually keep is materially higher.`]] : []),
    ...(jp?.capAvg != null ? [[`How does it compare with Japanese airlines?`,
      `Our captain estimate across the ${jp.n} Japanese airlines we list averages ${M(jp.capAvg)}. ${nameCap} at ${M(r.capAvg)} is ${r.capAvg >= jp.capAvg ? `${M(r.capAvg - jp.capAvg)} higher` : `${M(jp.capAvg - r.capAvg)} lower`}.`]] : []),
  ]);

  const faq = held ? mkFaqHeld(man) : mkFaqOpen(man, range);
  const faqLd = ja ? faq : (held ? mkFaqHeld(usd) : mkFaqOpen(usd, usdRange));

  const selfUrl = `https://pilot-value.com/${ja ? '' : 'en/'}${r.slug}.html`;
  const h1 = ja ? `${name}のパイロット年収` : `Pilot Salary in ${name}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ja ? 'ホーム' : 'Home', item: `https://pilot-value.com/${ja ? '' : 'en/'}` },
          { '@type': 'ListItem', position: 2, name: h1, item: selfUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqLd.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      {
        '@type': 'ItemList',
        name: ja ? `${name}の航空会社パイロット年収ランキング` : `Pilot salary by airline in ${name}`,
        numberOfItems: r.n,
        itemListElement: r.slugs.map((s, i) => ({
          '@type': 'ListItem', position: i + 1, name: ja ? S[s].ja : S[s].en,
          url: `https://pilot-value.com/${ja ? '' : 'en/'}airlines/${s}.html`,
        })),
      },
    ],
  };

  const countryOf = (s) => r.countries.find((c) => c.slugs.includes(s));

  /* ⚠️ 平均を保留した国は番号を振らない（番号そのものが順位の主張になる）。 */
  const countryRows = r.countries.map((c, i) => `          <tr>
            <td style="color:#6b7d93;font-weight:700">${held ? '' : i + 1}</td>
            <td><a href="countries/${c.slug}.html">${c.flag} ${esc(ja ? c.ja : c.en)}</a></td>
            <td class="num">${c.n}</td>
            <td class="num" style="font-weight:800;color:${c.capAvg == null ? '#8899aa' : '#f5c842'}">${manH(c.capAvg, ja)}</td>
            <td class="num" style="color:#8899aa">${rangeH(c.capLo, c.capHi, ja)}</td>
            <td class="num">${manH(c.foAvg, ja)}</td>
            <td>${c.tax === 'none' ? `<span class="tag tag-green">${ja ? 'なし' : 'None'}</span>` : `<span style="color:#6b7d93;font-size:.8rem">${ja ? 'あり' : 'Yes'}</span>`}</td>
          </tr>`).join('\n');

  /* 平均とレンジをそのまま出す社（この地域のうち、まだ調べていない社）。 */
  const airlineRows = openSlugs.map((s) => {
    const a = S[s];
    const c = countryOf(s);
    return `      <tr>
        <td><a href="airlines/${s}.html">${esc(ja ? a.ja : a.en)}</a></td>
        <td style="color:#8899aa;font-size:.82rem;white-space:nowrap">${c ? `${c.flag} ${esc(ja ? c.ja : c.en)}` : '—'}</td>
        <td class="num" style="font-weight:800;color:#f5c842">${man(a.cap.avg)}</td>
        <td class="num" style="color:#8899aa">${range(a.cap.lo, a.cap.hi)}</td>
        <td class="num" style="font-weight:700">${man(a.fo.avg)}</td>
        <td class="num" style="color:#8899aa">${range(a.fo.lo, a.fo.hi)}</td>
      </tr>`;
  }).join('\n');

  /* ★ 根拠を確認した社は「何の額か・等級」と一緒に出す（平均の表に混ぜない）。 */
  const RK3 = [['cap', '機長', 'Captain'], ['fo', '副操縦士', 'First officer'], ['crew', '運航乗務員', 'Flight crew']];
  const basisRows = r.ledger.map((s) => {
    const a = S[s];
    const c = countryOf(s);
    const ls = [];
    for (const [k, jn, en] of RK3) {
      if (!BASIS[s][k]) continue;
      const pl = paidLines(s, k, ja, man);
      ls.push([ja ? jn : en, pl ? pl.join(ja ? '／' : '; ') : HELD(ja)]);
    }
    if (!ls.length) ls.push([ja ? '機長・副操縦士' : 'Captain / first officer', HELD(ja)]);
    return ls.map((L, i) => `      <tr>
${i === 0 ? `        <td rowspan="${ls.length}"><a href="airlines/${s}.html">${esc(ja ? a.ja : a.en)}</a></td>
        <td rowspan="${ls.length}" style="color:#8899aa;font-size:.82rem;white-space:nowrap">${c ? `${c.flag} ${esc(ja ? c.ja : c.en)}` : '—'}</td>\n` : ''}        <td>${L[0]}</td>
        <td>${L[1]}</td>
      </tr>`).join('\n');
  }).join('\n');
  /* 会社自身が出した金額が取れた社の数（推定は会社の金額ではないので数えない）。 */
  const OWN = (slug) => ['cap', 'fo', 'crew'].some((k) => {
    const t = BASIS[slug]?.[k]?.tier;
    return t !== undefined && t !== 'estimate' && t !== 'held' && yearly(slug, k).some((f) => !f.training);
  });
  const paidN = r.ledger.filter(OWN).length;

  /* ★出どころを調べた社の表（2026-09-30）。国ページと同じ理由で、
     **地域の平均を出す地域でもこの表を出す。** 推定の数字に「平均」の札が付くのを避ける。 */
  const basisTable = r.ledger.length ? `
    <h3>${ja ? `出どころを調べた会社（${r.ledger.length}社）` : `Airlines with sources checked (${r.ledger.length})`}</h3>
    <p style="font-size:.85rem;color:#8899aa">${ja
    ? `「公式募集例」は会社が自ら募集要項に載せた額、「求人の掲載額」は採用を扱う会社の求人に出ていた額、「過去の募集広告」は過去に出た募集、「条件つきの給与例」は資料と計算式が確認できるモデル額です。「推定」は当サイトが公開情報から推計した金額で、会社が公表した平均ではありません。`
    : `“Official posting” means a figure the airline itself published in a vacancy; “job posting” a figure from a recruitment agency's advert; “past ad” a vacancy that has since closed; “modelled example” a figure with a document and a calculation behind it. “Estimated” is our own estimate from public information, not a figure the airline publishes.`}</p>
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>${ja ? '航空会社' : 'Airline'}</th>
          <th>${ja ? '国' : 'Country'}</th>
          <th>${ja ? '職位' : 'Position'}</th>
          <th>${ja ? '掲載している年間の金額' : 'Annual figure we publish'}</th>
        </tr></thead>
        <tbody>
${basisRows}
        </tbody>
      </table>
    </div>
` : '';

  const openTable = openSlugs.length ? `${r.ledger.length ? `
    <h3>${ja ? `そのほかの掲載社（${openSlugs.length}社）` : `Other airlines listed (${openSlugs.length})`}</h3>
    <p style="font-size:.85rem;color:#8899aa">${ja
    ? `これらの会社の金額は、まだ出どころを1件ずつ確認していません。`
    : `We have not yet traced the sources for these airlines one by one.`}</p>` : ''}
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>${ja ? '航空会社' : 'Airline'}</th>
          <th>${ja ? '国' : 'Country'}</th>
          <th>${ja ? '機長 推定年収' : 'Captain est.'}</th>
          <th>${ja ? '機長 レンジ' : 'Captain range'}</th>
          <th>${ja ? '副操縦士 推定年収' : 'F/O est.'}</th>
          <th>${ja ? '副操縦士 レンジ' : 'F/O range'}</th>
        </tr></thead>
        <tbody>
${airlineRows}
        </tbody>
      </table>
    </div>
` : '';

  /* 並べて比べる帯は、保留した地域では出さない。 */
  const cmpRows = held ? [] : [
    { name: ja ? '世界の推定平均' : 'World average', v: WORLD_CAP },
    ...REG_RANKED.map((x) => ({ name: ja ? x.ja : x.enCap, v: x.capAvg, self: x.key === r.key })),
    ...(jp?.capAvg != null ? [{ name: ja ? '日本' : 'Japan', v: jp.capAvg }] : []),
  ];

  const body = `<div class="max-w-6xl mx-auto px-5">

  <p class="crumb mb-4">
    <a href="index.html">${ja ? 'ホーム' : 'Home'}</a> ›
    <span>${esc(h1)}</span>
  </p>

  <header class="mb-7">
    <h1 class="c-title">${esc(h1)}</h1>
    <p style="color:#8899aa;font-size:.9rem;margin-top:8px;max-width:74ch">${held ? (ja
    ? `${name}に本拠を置く航空会社${r.n}社（${r.nc}カ国）を掲載しています。金額は、会社が公表した募集の例・採用の求人・過去の募集広告・当サイトの推定を区分ごとに出しています。${r.taxFree > 0 ? `うち${r.taxFree}社は個人所得税の無い国に本拠を置きます。` : ''}`
    : `${r.n} airlines based in ${name}, across ${r.nc} countries. Each figure is labelled by what it is — the airline's own vacancy, a recruitment advert, a closed advert, or our own estimate.${r.taxFree > 0 ? ` ${r.taxFree} of them ${r.taxFree > 1 ? 'are based in countries' : 'is based in a country'} with no personal income tax.` : ''}`) : (ja
    ? `${name}に本拠を置く航空会社${r.n}社（${r.nc}カ国）を、機長・副操縦士それぞれの推定年収とレンジで比較しています。国ごとの内訳から各国のページへ、社名から各社のページへ辿れます。${r.taxFree > 0 ? `うち${r.taxFree}社は個人所得税の無い国に本拠を置きます。` : ''}`
    : `${r.n} airlines based in ${name}, across ${r.nc} countries, compared on our captain and first officer estimates and ranges. Drill into a country for its own page, or into an airline for its pay breakdown, fleet and pilot reviews.${r.taxFree > 0 ? ` ${r.taxFree} of them ${r.taxFree > 1 ? 'are based in countries' : 'is based in a country'} with no personal income tax.` : ''}`)}</p>
    <!-- 国旗の列。.hero-flag の drop-shadow は付けない。国ページは大きな旗1枚なので
         影が奥行きになるが、小さい旗を7〜18個並べるとライトテーマで灰色の滲みになる（実測）。 -->
    <div style="font-size:1.7rem;line-height:1.5;letter-spacing:.08em;margin-top:12px" aria-hidden="true">${r.countries.map((c) => c.flag).join('')}</div>
    <div class="mt-3 flex flex-wrap gap-2">
      <span class="tag tag-blue">${ja ? `${r.n}社・${r.nc}カ国` : `${r.n} airlines · ${r.nc} countries`}</span>
      ${held
    ? `<span class="tag tag-blue">${ja ? '地域全体の平均は出していません' : 'No regional average'}</span>`
    : `<span class="tag tag-gold">${ja ? `平均を出している${REG_RANKED.length}地域中 第${rank}位` : `#${rank} of ${REG_RANKED.length} regions`}</span>`}
      ${r.taxFree > 0 ? `<span class="tag tag-green">${ja ? `非課税 ${r.taxFree}社` : `${r.taxFree} tax-free`}</span>` : ''}
    </div>
  </header>

  <section class="stat-grid mb-10">${held ? `
    <div class="stat-card">
      <div class="stat-label">${ja ? '掲載している会社' : 'Airlines listed'}</div>
      <div class="stat-value num">${r.n}</div>
      <div class="stat-sub">${ja ? `${r.nc}カ国・うち${r.ledger.length}社は出どころを調べた` : `${r.nc} countries · ${r.ledger.length} with sources checked`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '金額を掲載できた会社' : 'Airlines with a figure'}</div>
      <div class="stat-value num" style="color:#f5c842">${paidN}</div>
      <div class="stat-sub">${ja ? '会社の募集・求人・本人の申告から' : 'from vacancies, adverts and pilot reports'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '地域全体の平均' : 'Regional average'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${ja ? '出していません' : 'Not published'}</div>
      <div class="stat-sub">${ja ? '社ごとに金額の意味が違うため' : 'the figures are not on one scale'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '個人所得税の無い国の会社' : 'Airlines in tax-free countries'}</div>
      <div class="stat-value num">${r.taxFree}</div>
      <div class="stat-sub">${ja ? `${r.n}社のうち` : `of ${r.n}`}</div>
    </div>` : `
    <div class="stat-card">
      <div class="stat-label">${ja ? '機長 推定年収' : 'Captain estimate'}</div>
      <div class="stat-value num" style="color:#f5c842">${man(r.capAvg)}</div>
      <div class="stat-sub num">${range(r.capLo, r.capHi)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '副操縦士 推定年収' : 'First officer estimate'}</div>
      <div class="stat-value num">${man(r.foAvg)}</div>
      <div class="stat-sub num">${range(r.foLo, r.foHi)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '世界平均との差' : 'vs world average'}</div>
      <div class="stat-value num" style="color:${diff >= 0 ? '#34d399' : '#fb923c'}">${diff >= 0 ? '+' : ''}${diff}%</div>
      <div class="stat-sub">${ja ? `世界${NPUB}社平均 ` : `world avg `}<span class="num">${man(WORLD_CAP)}</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '最高水準の会社' : 'Top payer'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${esc(topName)}</div>
      <div class="stat-sub num">${ja ? '機長 ' : 'captain '}${man(topA.cap.avg)}</div>
    </div>`}
  </section>

  <section class="article">
    <h2 id="countries">${ja ? `${name}の国別 パイロット年収` : `Pilot salary by country in ${name}`}</h2>
    <p>${held ? (ja
    ? `国名をクリックすると、その国の航空会社ごとの内訳と所得税の有無が見られます。出どころを確認した会社を含む国は、国全体の平均を出していないため空欄です（順位も付けていません）。`
    : `Open a country for its airline-by-airline breakdown and its income-tax status. Countries that include an airline whose sources we have checked show no country average, and no rank.`) : (ja
    ? `機長の推定年収が高い順です。国名をクリックすると、その国の航空会社ごとの内訳・世界平均との差・所得税の有無が見られます。`
    : `Sorted by captain average, highest first. Open a country for its airline-by-airline breakdown, how it compares with the world average, and its income-tax status.`)}</p>
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>#</th><th>${ja ? '国' : 'Country'}</th><th>${ja ? '社数' : 'Airlines'}</th>
          <th>${ja ? '機長 推定年収' : 'Captain est.'}</th><th>${ja ? '機長 レンジ' : 'Captain range'}</th>
          <th>${ja ? '副操縦士 推定年収' : 'F/O est.'}</th><th>${ja ? '所得税' : 'Income tax'}</th>
        </tr></thead>
        <tbody>
${countryRows}
        </tbody>
      </table>
    </div>
${r.orphans.length ? `    <p style="font-size:.78rem;color:#6b7d93;margin-top:10px">${ja
    ? `※ ${r.orphans.map((s) => esc(S[s].ja)).join('・')}は本拠国が未登録のため、上の国別内訳には含まれていません（下の全社一覧には含まれます）。`
    : `Note: ${r.orphans.map((s) => esc(S[s].en)).join(', ')} ${r.orphans.length > 1 ? 'have' : 'has'} no registered home country, so ${r.orphans.length > 1 ? 'they are' : 'it is'} excluded from the country table above but included in the airline list below.`}</p>\n` : ''}
    <h2 id="airlines">${ja ? `${name}の航空会社別 パイロット年収（${r.n}社）` : `Pilot salary by airline in ${name} (${r.n} airlines)`}</h2>
${held ? `    <p>${ja
    ? `社名をクリックすると、その会社の年収の内訳・保有機材・応募条件・現役パイロットの口コミが見られます。金額は2つの表に分けました。上の表は出どころを調べた会社で、会社が公表した募集の例・採用の求人・過去の募集広告・当サイトの推定のどれかを、区分ごとに出しています。下の表はまだ調べていない会社です。`
    : `Click an airline for its pay breakdown, fleet, hiring requirements and reviews from working pilots. The figures are in two tables. The first covers airlines whose sources we have checked, with each figure labelled by what kind of figure it is. The second covers airlines we have not checked yet.`}</p>

${basisTable}${openTable}` : `    <p>${ja
    ? `${r.ledger.length ? `出どころを調べた会社を先に、その金額が<strong>誰の・何を含んだ・いつの金額か</strong>を添えて出しています。そのほかの社は機長の推定年収が高い順です。` : `機長の推定年収が高い順に${r.n}社すべてを並べています。`}社名をクリックすると、その会社の年収の内訳・保有機材・応募条件・現役パイロットの口コミが見られます。`
    : `${r.ledger.length ? `Airlines whose sources we have checked come first, each figure shown with <strong>who it applies to, what it includes and when it was published</strong>. The rest are sorted by captain average, highest first.` : `All ${r.n} airlines, sorted by captain average.`} Click an airline for its pay breakdown, fleet, hiring requirements and reviews from working pilots.`}</p>
${basisTable}${openTable}`}

${held ? `    <h2 id="compare">${ja ? `${name}の順位を出していない理由` : `Why we do not rank ${name}`}</h2>
    <p>${ja
    ? `${name}の会社については、金額の出どころを1社ずつ確認する作業を始めています。その結果、同じ「年収」という言葉で並んでいた数字が、実際には別のものだと分かりました。会社が募集要項に載せた現金の額、住宅や学費まで含めた待遇の評価額、採用会社の求人に出ていた上限、本人が書いた額 ── 意味の違うものを1本の平均にすると、どの会社が高いのかという問いにも答えられません。`
    : `We are working through the ${name} airlines one at a time to trace where each figure came from. Doing that showed that numbers sitting side by side under the word “salary” are not the same kind of number: cash an airline published in a vacancy, a package value that folds in housing and school fees, a ceiling quoted in an agency advert, a figure written by a pilot who works there. Averaging those together cannot answer which airline pays more.`}</p>
    <p>${ja
    ? `そのため、この地域の平均年収・地域どうしの順位・世界平均との倍率は出していません。代わりに、上の表で会社ごとの金額と、それが誰に・どの条件で当てはまる額かを並べています。会社の数字の単純平均は、その地域のパイロット全体の平均ではありません。`
    : `So this page publishes no regional average, no ranking between regions and no multiple against the world average. Instead the tables above give each airline's figure together with who it applies to and on what terms. An unweighted mean of company figures is not the average pay of pilots in a region.`}</p>
` : `    <h2 id="compare">${ja ? `${name}は世界のどのあたりか` : `Where ${name} sits worldwide`}</h2>
    <p>${ja
    ? `機長の平均年収を地域ごとに比べたものです。${name}は${man(r.capAvg)}で、世界${NPUB}社の平均${man(WORLD_CAP)}に対して<strong>${diff >= 0 ? `約${diff}%高い` : `約${Math.abs(diff)}%低い`}</strong>水準。平均を出している${REG_RANKED.length}地域の中では第${rank}位です。`
    : `Captain averages by region. ${nameCap} sits at ${man(r.capAvg)} against a ${man(WORLD_CAP)} average across all ${NPUB} airlines we list — <strong>${diff >= 0 ? `about ${diff}% above` : `about ${Math.abs(diff)}% below`}</strong>. That is ${nth(rank)} of the ${REG_RANKED.length} regions we publish an average for.`}</p>
    <div class="glass" style="padding:18px 20px">${bars(cmpRows, lang)}</div>
    <p style="font-size:.78rem;color:#6b7d93;margin-top:10px">${ja
    ? `※ 各地域の値は、その地域の掲載社の機長の推定年収の単純平均。日本は地域ハブを別に置かず <a href="countries/japan.html">日本のページ</a>にまとめています。${name}の副操縦士の推定年収の平均は${man(r.foAvg)}（世界${NPUB}社では${man(WORLD_FO)}）。出どころを確認して表示を変えた会社は、この平均の材料に入れていません。`
    : `Regional figures are the unweighted mean of captain averages for the airlines we list there. Japan has no separate regional hub — see the <a href="countries/japan.html">Japan page</a>. First officers in ${name} average ${man(r.foAvg)}, against ${man(WORLD_FO)} across the ${NPUB} airlines we publish an average for. Airlines whose sources we have checked and relabelled are left out of that mean.`}</p>
`}

    <h2 id="regions">${ja ? '他の地域と比べる' : 'Compare other regions'}</h2>
    <div class="c-grid">
${others.map((x) => `      <a class="c-card" href="${x.slug}.html">
        <div class="cc-flag">${x.countries.slice(0, 3).map((c) => c.flag).join('')}</div>
        <div class="cc-name">${esc(ja ? x.ja : x.enCap)}</div>
        <div class="cc-meta">${ja ? `${x.n}社・${x.nc}カ国` : `${x.n} airlines · ${x.nc} countries`}</div>
        <div class="cc-pay${x.capAvg == null ? '' : ' num'}"${x.capAvg == null ? ' style="font-size:.8rem;color:#8899aa"' : ''}>${manH(x.capAvg, ja)}</div>
      </a>`).join('\n')}
${jp ? `      <a class="c-card" href="countries/japan.html">
        <div class="cc-flag">${jp.flag}</div>
        <div class="cc-name">${esc(ja ? jp.ja : jp.en)}</div>
        <div class="cc-meta">${ja ? `${jp.n}社` : `${jp.n} airlines`}</div>
        <div class="cc-pay${jp.capAvg == null ? '' : ' num'}"${jp.capAvg == null ? ' style="font-size:.8rem;color:#8899aa"' : ''}>${manH(jp.capAvg, ja)}</div>
      </a>` : ''}
    </div>

    <h2 id="faq">${ja ? 'よくある質問' : 'Frequently asked questions'}</h2>
${faq.map(([q, a]) => `    <details class="faq"><summary>${esc(q)}</summary><div class="faq-a">${a}</div></details>`).join('\n')}

    <div class="glass" style="padding:22px 24px;margin-top:2.5rem">
      <p style="margin:0 0 12px;font-weight:800;font-size:1rem">${ja ? '次に見るなら' : 'Where to next'}</p>
      <div class="flex flex-wrap gap-3">
        <a href="countries.html" class="btn-ghost">${ja ? '国別のパイロット年収 一覧' : 'All countries'}</a>
        <a href="world-airlines.html" class="btn-ghost">${ja ? `世界${N}社の一覧` : `All ${N} airlines`}</a>
        <a href="pilot-salary-guide.html" class="btn-ghost">${ja ? 'パイロット年収ガイド' : 'Pilot salary guide'}</a>
        <a href="world-jobs.html" class="btn-ghost">${ja ? '海外の求人情報' : 'Overseas jobs'}</a>
      </div>
    </div>
  </section>
</div>`;

  return shell({ lang, title: `${title} | PILOT VALUE`, desc, keywords, body, jsonld, up });
}

/* ════════════════════════════════════════════════════════════════
   国一覧ページ
   ════════════════════════════════════════════════════════════════ */
function indexPage(lang) {
  const ja = lang === 'ja';
  const up = '';
  const title = ja
    ? `国別のパイロット年収【2026年最新】${ALL.length}カ国を比較`
    : `Pilot Salary by Country 2026 — ${ALL.length} Countries Compared`;
  const top3 = RANKED.slice(0, 3);
  const desc = ja
    ? `パイロットの年収を国別に比較。掲載${ALL.length}カ国のうち平均を出している${RANKED.length}カ国では${top3.map((c) => `${c.ja}${man(c.capAvg)}`).join('・')}が上位。金額の種類が混ざる${HOLD_C.length}カ国は、会社ごとの金額を区分ごとに載せています。`
    /* ★ description は head の中＝currency.js の走査対象外。ここで man() を
       使うと英語版の検索結果に「¥4,380万」がそのまま出る（実際に出ていた）。
       国別ページ側と同じく USD で書く。 */
    : `Pilot pay compared country by country. Of ${ALL.length} countries listed, ${RANKED.length} carry an average — highest: ${top3.map((c) => `${c.en} ${usd(c.capAvg)}`).join(', ')}. For the ${HOLD_C.length} countries whose sources we are still checking, figures are listed airline by airline instead.`;
  const keywords = ja
    ? `パイロット 年収 国別,国別 パイロット 給与,海外 パイロット 年収,パイロット 年収 世界 比較,非課税 パイロット 年収,PILOT VALUE`
    : `pilot salary by country,pilot pay by country,highest paying countries for pilots,tax free pilot salary,international pilot salary comparison,PILOT VALUE`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'ItemList',
      name: ja ? '国別のパイロット年収ランキング' : 'Pilot salary by country',
      numberOfItems: RANKED.length,
      itemListElement: RANKED.map((c, i) => ({
        '@type': 'ListItem', position: i + 1, name: ja ? c.ja : c.en,
        url: `https://pilot-value.com/${ja ? '' : 'en/'}countries/${c.slug}.html`,
      })),
    }],
  };

  const body = `<div class="max-w-6xl mx-auto px-5">
  <p class="crumb mb-4"><a href="index.html">${ja ? 'ホーム' : 'Home'}</a> › <span>${ja ? '国別のパイロット年収' : 'Pilot Salary by Country'}</span></p>

  <header class="mb-8">
    <h1 class="c-title">${ja ? '国別のパイロット年収' : 'Pilot Salary by Country'}</h1>
    <p style="color:#8899aa;font-size:.95rem;margin-top:8px;max-width:70ch">${ja
    ? `世界${ALL.reduce((s2, c) => s2 + c.n, 0)}社のデータを、本拠を置く国ごとにまとめました。国名をクリックすると、その国の航空会社ごとの内訳が見られます。${HOLD_C.length}カ国は、金額の出どころを1社ずつ確認する作業の途中なので、国全体の平均を出していません（会社ごとの金額はそれぞれのページに出しています）。`
    : `The ${ALL.reduce((s2, c) => s2 + c.n, 0)} airlines we track, grouped by the country they are based in. Open a country for its airline-by-airline breakdown. ${HOLD_C.length} countries carry no country average, because we are part-way through tracing each airline's figures — the per-airline figures are on those pages.`}</p>
  </header>

  <section class="stat-grid mb-9">
    <div class="stat-card">
      <div class="stat-label">${ja ? '掲載国' : 'Countries'}</div>
      <div class="stat-value num">${ALL.length}</div>
      <div class="stat-sub">${ja ? `航空会社 ${ALL.reduce((s, c) => s + c.n, 0)}社` : `${ALL.reduce((s, c) => s + c.n, 0)} airlines`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '世界の機長平均' : 'World captain avg'}</div>
      <div class="stat-value num" style="color:#f5c842">${man(WORLD_CAP)}</div>
      <div class="stat-sub">${ja ? `掲載${NPUB}社の推定年収の平均` : `mean of our estimates across ${NPUB} airlines`}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '最高水準の国' : 'Highest country'}</div>
      <div class="stat-value" style="font-size:1.05rem;line-height:1.35">${RANKED[0].flag} ${esc(ja ? RANKED[0].ja : RANKED[0].en)}</div>
      <div class="stat-sub num">${man(RANKED[0].capAvg)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${ja ? '所得税なしの国' : 'No income tax'}</div>
      <div class="stat-value num">${ALL.filter((c) => c.tax === 'none').length}</div>
      <div class="stat-sub">${ALL.filter((c) => c.tax === 'none').map((c) => c.flag).join(' ')}</div>
    </div>
  </section>

  <section class="article">
    <h2 id="regions">${ja ? '地域から探す' : 'Browse by region'}</h2>
    <p>${ja
    ? `国が多いので、まず地域で絞れます。地域ページには、その地域の全社ランキングと国別の内訳が1枚にまとまっています。日本は地域ページを置かず <a href="countries/japan.html">日本のページ</a>にまとめています。`
    : `There are a lot of countries, so start from a region. Each region page carries the full airline ranking for that region plus the country-by-country breakdown. Japan has no separate region page — see the <a href="countries/japan.html">Japan page</a>.`}</p>
    <div class="c-grid">
${[...REG_RANKED, ...REG.filter((r) => r.mixed)].map((r) => `      <a class="c-card" href="${r.slug}.html">
        <div class="cc-flag">${r.countries.slice(0, 3).map((c) => c.flag).join('')}</div>
        <div class="cc-name">${esc(ja ? r.ja : r.enCap)}</div>
        <div class="cc-meta">${ja ? `${r.n}社・${r.nc}カ国` : `${r.n} airlines · ${r.nc} countries`}</div>
        <div class="cc-pay${r.capAvg == null ? '' : ' num'}"${r.capAvg == null ? ' style="font-size:.8rem;color:#8899aa"' : ''}>${manH(r.capAvg, ja)}</div>
      </a>`).join('\n')}
    </div>

    <h2 id="ranking">${ja ? `機長平均の高い順（${RANKED.length}カ国）` : `Ranked by captain average (${RANKED.length} countries)`}</h2>
    <p>${ja
    ? `掲載${ALL.length}カ国のうち、国全体の平均を出している${RANKED.length}カ国です。`
    : `The ${RANKED.length} of our ${ALL.length} countries that carry a country average.`}</p>
    <div class="c-grid">
${RANKED.map((c, i) => `      <a class="c-card" href="countries/${c.slug}.html">
        <div class="flex items-center justify-between">
          <div class="cc-flag">${c.flag}</div>
          <div style="font-size:.7rem;font-weight:800;color:#6b7d93">#${i + 1}</div>
        </div>
        <div class="cc-name">${esc(ja ? c.ja : c.en)}</div>
        <div class="cc-meta">${ja ? `${c.n}社` : `${c.n} airline${c.n > 1 ? 's' : ''}`}${c.tax === 'none' ? (ja ? '・非課税' : ' · tax-free') : ''}</div>
        <div class="cc-pay num">${man(c.capAvg)}</div>
      </a>`).join('\n')}
    </div>
${HOLD_C.length ? `
    <h2 id="checking">${ja ? `出どころを確認している国（${HOLD_C.length}カ国）` : `Countries we are still checking (${HOLD_C.length})`}</h2>
    <p>${ja
    ? `これらの国には、金額の出どころを1社ずつ確認した会社が含まれます。確認の結果、同じ「年収」で並んでいた数字が、会社が募集要項に載せた現金の額・住宅や学費まで含めた待遇の評価額・求人に出ていた上限・本人が書いた額と、別のものだと分かりました。1本の平均にできないので、国全体の平均と順位は出していません。会社ごとの金額は各国のページに出しています。`
    : `These countries include airlines whose figures we have traced one by one. That showed the numbers were not the same kind of number — cash published in a vacancy, a package value including housing and school fees, a ceiling quoted in an advert, a figure written by a pilot. They cannot go into one average, so these countries carry no country average and no rank. The per-airline figures are on each country page.`}</p>
    <div class="c-grid">
${HOLD_C.map((c) => `      <a class="c-card" href="countries/${c.slug}.html">
        <div class="cc-flag">${c.flag}</div>
        <div class="cc-name">${esc(ja ? c.ja : c.en)}</div>
        <div class="cc-meta">${ja ? `${c.n}社` : `${c.n} airline${c.n > 1 ? 's' : ''}`}${c.tax === 'none' ? (ja ? '・非課税' : ' · tax-free') : ''}</div>
        <div class="cc-pay" style="font-size:.8rem;color:#8899aa">${ja ? '会社ごとに掲載' : 'Listed per airline'}</div>
      </a>`).join('\n')}
    </div>
` : ''}

    <h2 id="table">${ja ? '一覧表' : 'Full table'}</h2>
    <div class="glass tbl-scroll" style="padding:4px">
      <table class="salary-table">
        <thead><tr>
          <th>#</th><th>${ja ? '国' : 'Country'}</th><th>${ja ? '社数' : 'Airlines'}</th>
          <th>${ja ? '機長 推定年収' : 'Captain est.'}</th><th>${ja ? '機長 レンジ' : 'Captain range'}</th>
          <th>${ja ? '副操縦士 推定年収' : 'F/O est.'}</th><th>${ja ? '所得税' : 'Income tax'}</th>
        </tr></thead>
        <tbody>
${[...RANKED, ...HOLD_C].map((c, i) => `          <tr>
            <td style="color:#6b7d93;font-weight:700">${c.capAvg == null ? '' : i + 1}</td>
            <td><a href="countries/${c.slug}.html">${c.flag} ${esc(ja ? c.ja : c.en)}</a></td>
            <td class="num">${c.n}</td>
            <td class="num" style="font-weight:800;color:${c.capAvg == null ? '#8899aa' : '#f5c842'}">${manH(c.capAvg, ja)}</td>
            <td class="num" style="color:#8899aa">${rangeH(c.capLo, c.capHi, ja)}</td>
            <td class="num">${manH(c.foAvg, ja)}</td>
            <td>${c.tax === 'none' ? `<span class="tag tag-green">${ja ? 'なし' : 'None'}</span>` : `<span style="color:#6b7d93;font-size:.8rem">${ja ? 'あり' : 'Yes'}</span>`}</td>
          </tr>`).join('\n')}
        </tbody>
      </table>
    </div>
    <p style="font-size:.78rem;color:#6b7d93;margin-top:10px">${ja
    ? `※ 各国の値は、その国に本拠を置く掲載社の掲載値を単純平均したもので、その国のパイロット全体の平均ではありません。金額の種類が混ざる国は平均を出していません（0として計算していません）。年収の正は <a href="world-airlines.html">航空会社別のページ</a>。`
    : `Country figures are the unweighted mean of the figures we list for airlines based there — not the average pay of pilots in that country. Countries whose figures are not on one scale have no average; they are not counted as zero. The per-airline pages are the source of record — see <a href="world-airlines.html">all airlines</a>.`}</p>

    <div class="glass" style="padding:22px 24px;margin-top:2.5rem">
      <p style="margin:0 0 12px;font-weight:800;font-size:1rem">${ja ? '次に見るなら' : 'Where to next'}</p>
      <div class="flex flex-wrap gap-3">
        <a href="world-airlines.html" class="btn-ghost">${ja ? `世界${N}社の一覧` : `All ${N} airlines`}</a>
        <a href="pilot-salary-guide.html" class="btn-ghost">${ja ? 'パイロット年収ガイド' : 'Pilot salary guide'}</a>
        <a href="world-jobs.html" class="btn-ghost">${ja ? '海外の求人情報' : 'Overseas jobs'}</a>
        <a href="community.html" class="btn-ghost">${ja ? '現役パイロットの口コミ' : 'Pilot reviews'}</a>
      </div>
    </div>
  </section>
</div>`;

  return shell({ lang, title: `${title} | PILOT VALUE`, desc, keywords, body, jsonld, up });
}

/* ════════════════════════════════════════════════════════════════
   書き出し
   ════════════════════════════════════════════════════════════════ */
let written = 0;
const write = (rel, html) => {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!DRY && (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== html)) { fs.writeFileSync(abs, html); written++; }
};

for (const c of ALL) {
  write(`countries/${c.slug}.html`, countryPage(c, 'ja'));
  write(`en/countries/${c.slug}.html`, countryPage(c, 'en'));
}
for (const r of REG) {
  write(`${r.slug}.html`, regionPage(r, 'ja'));
  write(`en/${r.slug}.html`, regionPage(r, 'en'));
}
write('countries.html', indexPage('ja'));
write('en/countries.html', indexPage('en'));

console.log(`${DRY ? '[dry-run] ' : ''}国別 ${ALL.length}カ国 + 地域 ${REG.length} + 一覧1 = ${(ALL.length + REG.length + 1) * 2} 枚（日英・更新 ${written}）`);
console.log(`  機長平均 上位: ${RANKED.slice(0, 5).map((c) => `${c.ja} ${man(c.capAvg)}`).join(' / ')}`);
console.log(`  地域: ${REG_RANKED.map((r) => `${r.ja} ${man(r.capAvg)}(${r.n}社)`).join(' / ')}`);
console.log(`  地域ハブに載る社数 ${REG.reduce((s, r) => s + r.n, 0)} + 日本 ${ALL.find((c) => c.code === 'JP')?.n ?? 0} = ${REG.reduce((s, r) => s + r.n, 0) + (ALL.find((c) => c.code === 'JP')?.n ?? 0)} / SSOT ${N}社`);
console.log(`  世界の推定平均: 機長 ${man(WORLD_CAP)} / 副操縦士 ${man(WORLD_FO)}（掲載${NPUB}社ぜんぶ・除外なし。出どころを調べた${CHECKED.size}社も推定は持っている）`);
console.log(`  国全体の平均を出していない国 ${HOLD_C.length}カ国: ${HOLD_C.map((c) => c.ja).join('・') || 'なし'}`);
console.log(`  地域の平均を出していない地域 ${REG.filter((r) => r.mixed).length}: ${REG.filter((r) => r.mixed).map((r) => r.ja).join('・') || 'なし'}`);
console.log('\n次: node gen-en-manifest.mjs → node seo-normalize.mjs → node gen-sitemap.mjs → node assert-seo.mjs');
