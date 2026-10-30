// check-salary.mjs — 全ページを salary-data.mjs と突き合わせて整合検証。
// node check-salary.mjs
//
// パス1: 各航空会社ページに、その会社の「機長平均」「副操縦士平均」が載っているか。
//        （2026-10-23 から英語の新しい会社ページ ── airline-rollout.mjs の EN_SWITCH の en/airlines/{slug}.html ── も）
// パス2: サイト全 HTML から「社名＋役職＋金額」の並びを拾って SSOT と突き合わせる。
//
// ★ パス2 を足した理由: パス1 は SALARY を回して airlines/{slug}.html しか見ないため、
//   トップ・記事・比較ページが SSOT と一度も照合されていなかった。他社の年収を語る
//   ページは、その他社のページを直しても直らない。実際にこれで見つかった例:
//     world-jobs.html    Cathay Pacific「機長年収2,500万円〜」（SSOT のレンジ下限3,000万すら下回る）
//     pilot-vs-isha.html ANA「機長 ¥4,200万」（SSOT は2,700万）
//     index.html         LCC の FAQ が3社とも平均より高い数字
//   いずれも JSON-LD の FAQ や比較表＝検索結果に出る場所だった。
//
// ★ パス1・パス2 の両方に「根拠の等級」が入っている（2026-09-29／向きは 2026-10-01 に裏返した）。
//   salary-basis.mjs で等級を決めた会社・職位には、**公開情報から出した推定年収を出す**。
//   公式募集例・求人の掲載額・条件つきの給与例が取れている職位は、その額を**推定の隣に併記する**
//   （オーナー指示「基本全て推定でいいじゃん」）。前は逆で、根拠の強い額が1つ取れていれば
//   推定を画面から外していた（25社×2職位のうち36件が金額ごと消えた）。
//   判定は2本立て ── 掲載額は salary-basis.mjs（原貨が正本）と、推定は SALARY と突き合わせる。
//   どちらにも当たらない数字だけを ❌ にする。
//   ⚠️ 等級を決めていない会社は今までどおり SALARY と突き合わせる（振る舞いは変わらない）。
//   ⚠️ 運航乗務員（会社が職位で分けていない1数字）と訓練生は SALARY に無いので、台帳だけで見る。
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SALARY, buildSalaryJson } from './salary-data.mjs';
import { BASIS, TIERS, figures as basisFigures } from './salary-basis.mjs';
/* 英語の会社ページを新しい形で書く会社（2026-10-23 英語の EN-7 ── パス1が英語のページも見る） */
import { EN_SWITCH } from './airline-rollout.mjs';
/* 英語ページの金額は HTML の時点でドルに焼き込んである（bake-en-currency.mjs）。
   元の円表記は span の data-orig に残っているが、**タグの中なので下の正規表現からは
   見えない**。戻さずに読むと、英語ページ 183枚が照合から黙って外れる。 */
import { unbake } from './cur-core.mjs';

// ── 生成物 salary-data.json が buildSalaryJson() と完全一致しているか（サラリーエンジン供給の整合） ──
// json は gen-salary-json.mjs の生成物（{spine, airlines:{slug:{...SALARY,ladder}}}）。
// 手編集や再生成漏れ・ラダー導出のズレをここで検出する。
function checkSalaryJson() {
  const p = 'salary-data.json';
  if (!existsSync(p)) return { ok: false, msg: `${p} が無い（node gen-salary-json.mjs を実行）` };
  let json;
  try { json = JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { ok: false, msg: `${p} が壊れている（JSON parse 失敗）` }; }
  const a = JSON.stringify(buildSalaryJson());
  const b = JSON.stringify(json);
  if (a !== b) return { ok: false, msg: `${p} が salary-data.mjs と不一致（node gen-salary-json.mjs で再生成）` };
  const nAir = Object.keys(json.airlines || {}).length;
  return { ok: true, msg: `${p} == buildSalaryJson()（${nAir}社／背骨${(json.spine||[]).length}段）` };
}

const man = (n) => n.toLocaleString('en-US') + '万';

// 既知の「これが残っていたら誤り」な陳腐化文字列（そのページ固有）
const STALE = {
  'skymark': ['2,900万', '2,400万', '950万', '¥9.5M'],
  'delta': ['9,000万',
    /* 2026-10-29 WP-compare-all-26（下の11社の注） */
    '6,160万', '4,950万', '8,690万', '3,510万', '1,680万', '5,020万', '¥61.6M', '¥35.1M'],
  'united': ['8,500万',
    '6,320万', '5,370万', '3,870万', '1,790万', '5,220万', '¥63.2M', '¥38.7M'],
  'american': ['8,000万',
    '5,930万', '5,010万', '3,440万', '1,710万', '5,260万', '¥59.3M', '¥34.4M'],
  'cathay-pacific': ['7,000万', '3,600万'],
  'singapore-airlines': ['5,800万', '3,400万', '¥34M'],
  'qatar-airways': ['5,100万', '2,900万', '¥29M', '2,050万', '¥20.5M'],
  'jal': ['900万〜2,700万', '900万〜¥2,700万'],
  /* 2026-10-20 BA の副操縦士（avg 1,660→2,590／lo 1,170→2,300／hi 2,460→3,400）と
     機長（avg 3,030→3,980／lo 2,020→3,320／hi 4,040→5,710）を、BA 自身の募集資料の給与例に合わせた。 */
  /* 2026-10-25 の見直し（P12.105）で、2026-10-20 の副操縦士の下端 1,170万 が新しい「機長との差 ¥1,170万」（3,980−2,810）と同じ字になった。
     差の文は正しいので、古い下端はレンジの形（1,170万〜）でだけ見張る。 */
  'british-airways': ['1,660万', '1,170万〜', '2,460万', '3,030万', '2,020万', '4,040万',
    /* 2026-10-25 副操縦士 avg 2,590→2,810・hi 3,400→3,910（会社の年金拠出15%を数えた） */
    '2,590万', '3,400万', '¥25.9M', '¥34M'],
  /* ★2026-10-25 オーナー承認の推定年収の見直し（P12.105・推定年収＝会社が1年に払うものすべて）。旧値を見張る。
     ⚠️ 新しい値と同じ字になる旧値は入れない（ジェットスター航空の旧 hi 3,100万＝新 avg・エミレーツの副操縦士の旧 hi 3,350万＝機長の lo）。
     ⚠️ 他社の額と同じ字になる旧値は、その社の言い回しごと入れる（イージージェットの旧 2,700万＝ANA・JAL の機長／
        ジェットスター航空の旧 1,750万＝同じ表のニュージーランド航空の副操縦士）。 */
  'emirates': ['5,100万', '3,700万', '5,050万', '2,800万', '¥37M', '¥28M'],
  'ryanair': ['2,240万', '1,030万', '1,460万', '¥22.4M', '¥10.3M', '¥14.6M',
    /* 2026-10-29 WP-compare-all-27（下の eurowings の注） */
    '2,800万', '1,480万', '¥28M', '¥14.8M'],
  'vueling': ['1,720万', '1,200〜2,400万', '¥950万', '推定年収950万', '1,380万', '¥17.2M', '¥9.5M', '¥13.8M', '¥24M',
    /* 2026-10-25 の2回目：四半期の生産性手当を足した（機長 avg 2,690→2,760・副操縦士 avg 1,090→1,150） */
    '2,690万', '1,090万', '¥26.9M', '¥10.9M'],
  'jetstar': ['2,400万', '1,900万〜3,100万', '1,900万', '1,350万', '¥950万', '950万〜1,750万', '¥24M', '¥13.5M', '¥17.5M',
    /* 2026-10-29 WP-compare-all-26（下の11社の注） */
    '3,100万', '3,010万', '3,640万', '1,810万', '1,680万', '2,230万', '¥31M', '¥18.1M'],
  'easyjet': ['推定年収2,700万', '推定2,700万', '推定で¥2,700万', '機長は¥2,700万', '機長¥2,700万、', '¥27M'],
  'qantas': ['2,100万', '¥21M',
    /* 2026-10-29 WP-compare-all-26（下の11社の注） */
    '3,700万', '2,140万', '1,660万', '3,120万〜', '¥37M', '¥21.4M'],
  'ita-airways': ['1,120万', '1,460万', '¥11.2M', '¥14.6M'],
  'norwegian': ['2,000万', '1,100万', '¥20M', '¥11M'],
  /* ★2026-10-27 オーナー判断（P12.133）── ルフトハンザの機長 3,440→3,900万（2026年の報道）。レンジは動かしていない。
     ⚠️ 旧値は他社の今の額と同じ字（3,440万＝アメリカン航空の副操縦士）。
        見張るのはその会社のページだけなので、いまの2枚には他社のその額が載っていないことを確かめて入れた。
     （中国南方航空は 2,950万のまま。2019年の草案の求人は今の条件ではないので使わなかった ── 2026-10-28 リード）
     ★2026-10-28 オーナー判断（P12.134）── 機長のレンジの上端 4,320→4,830万（同じ報道の「上位の職 約€260,000」）。
       旧い上端は日本語のページの説明文・Article の説明にだけ出ていた（英語のページは見える所に円のレンジが無い）。 */
  'lufthansa': ['3,440万', '¥34.4M',
    '4,320万'],
  /* ★2026-10-29 オーナー OK「11社ぜんぶ」（WP-compare-all-26）── 11社を給与表から作り直した。変わった avg・lo・hi の旧い字を見張る。
     ⚠️ 変わっていない字は入れない（ユナイテッド・アメリカンの機長の hi、サウスウエストの機長の lo・hi と副操縦士の avg・lo、
        アラスカ・ジェットブルーの機長の lo と副操縦士の avg・lo、カンタスの hi、イベリアの機長の lo と副操縦士の avg・lo）。
     ⚠️ 同じ社の今の額と同じ字になる旧値は、形ごと入れる（カンタスの旧い機長の lo 3,120万＝今の副操縦士の hi → 「3,120万〜」だけ）。
        短い字（580万・780万）は他の額の一部になる（1,580万・2,780万）ので「…万〜」の形で入れる。
     ⚠️ ジェットスター航空の 3,100万は、10-25 は新しい avg と同じ字なので入れなかった。今の avg は 3,620万なので入れる。
     デルタ・ユナイテッド・アメリカン・カンタス・ジェットスター航空は、上の行（同じ鍵）に足してある。 */
  'southwest':       ['4,820万', '4,030万', '¥48.2M'],
  'alaska-airlines': ['4,900万', '5,800万', '3,600万', '¥49M'],
  'jetblue':         ['4,200万', '4,700万', '3,000万', '¥42M'],
  'air-canada':      ['3,360万', '2,490万', '4,260万', '1,510万', '580万〜', '2,200万', '¥33.6M', '¥15.1M'],
  'iberia':          ['2,600万', '3,400万', '1,890万', '¥26M'],
  'tap':             ['2,240万', '1,720万', '3,100万', '1,120万', '780万〜', '1,550万', '¥22.4M', '¥11.2M'],
  /* ★2026-10-29 オーナー OK「年収OK」（WP-compare-all-27）── ユーロウイングスの機長の上端 3,480→3,760万／ライアンエアーの機長 2,800→3,060万・
     副操縦士 1,480→1,530万。ライアンエアーは上の行（同じ鍵）に足してある。
     ⚠️ 旧値は他社の今の額と同じ字（2,800万＝クウェート航空の機長／1,480万＝世界112社の副操縦士の平均）。
        見張るのはその会社のページだけなので、いまの2枚にはその額が載っていないことを確かめて入れた。
     ユーロウイングスの旧い上端は、日本語のページの Article の題と説明文にだけ出ていた（英語のページは見える所に円のレンジが無い）。 */
  'eurowings':       ['3,480万'],
  /* ★2026-10-29 オーナー OK（Gemini の年収の調べ 2回目）── KLM 機長 3,960→6,630万・副 2,240→3,070万／スイス機長 4,100→4,370万／
     オーストリア機長 2,600→4,670万・副 1,550→2,100万／チャイナエアライン機長 2,000→3,500万・副 1,100→1,500万。
     ⚠️ KLM の旧い副操縦士の上端 4,370万は、スイスの機長の新しい額と同じ字なので入れていない（見張るのは KLM のページだけだが、念のため）。 */
  'klm':             ['3,960万', '2,240万', '5,810万', '¥39.6M', '¥22.4M', '¥58.1M'],
  'swiss':           ['4,100万', '¥41M'],
  'austrian':        ['2,600万', '1,550万', '3,300万', '2,050万', '¥26M', '¥15.5M'],
  'china-airlines':  ['2,000万', '1,100万', '2,450万', '1,280万', '¥20M', '¥11M'],
  /* ★2026-10-30 オーナー OK（Gemini の年収の調べ 2回目の続き）── ロイヤル・ヨルダン機長 1,700→2,350万・副 900→1,620万／エア・リンガス機長 2,750→5,230万／
     フィンエアー機長 3,000→3,710万・副 1,550→1,850万／ウィズ・エアー機長 2,400→4,340万・副 1,120→1,950万／中国東方機長 2,900→4,770万。
     ⚠️ ロイヤル・ヨルダンの旧い副操縦士 900万は「1,900万」などにも当たるので「¥900万」の形だけ入れた（見張るのは文字が含まれるかだけ）。 */
  'royal-jordanian': ['1,700万', '¥900万', '2,200万', '1,150万', '¥17M'],
  'aer-lingus':      ['2,750万', '4,100万', '¥27.5M', '¥41M', '1,700万', '¥17M', '2,600万'],
  'finnair':         ['3,000万', '3,900万', '1,550万', '¥30M', '¥15.5M'],
  'wizz-air':        ['2,400万', '3,300万', '1,120万', '1,720万', '¥24M', '¥11.2M'],
  'china-eastern':   ['2,900万', '4,600万', '¥29M'],
  /* ★2026-10-30 夜 オーナー OK（はじいた資料も使う見直し 21社＋会員の中央値 9か所）── 直す前のページに在って、今のページに無い字だけ。 */
  'turkish-airlines':       ['2,500万', '¥25M', '1,400万', '¥14M'],
  'air-france':             ['3,530万', '¥35.3M', '1,810万', '¥18.1M', '2,920万'],
  'korean-air':             ['2,450万', '¥24.5M', '1,250万', '¥12.5M'],
  'asiana':                 ['2,180万', '¥21.8M', '2,450万'],
  'gulf-air':               ['¥27M', '1,500万', '¥15M'],
  'oman-air':               ['2,500万', '3,000万', '1,400万'],
  'aegean':                 ['1,300万', '¥13M', '660万', '¥6.6M'],
  'icelandair':             ['2,150万', '¥21.5M', '2,600万', '1,200万', '¥12M', '1,550万'],
  'lot':                    ['1,400万', '¥14M', '1,650万', '730万', '¥7.3M'],
  'sas':                    ['1,150万', '¥11.5M'],
  'virgin-atlantic':        ['3,600万', '¥36M', '4,600万', '1,920万', '¥19.2M', '2,420万'],
  'kenya-airways':          ['1,500万', '¥15M', '1,950万', '750万', '¥7.5M', '1,050万'],
  'south-african-airways':  ['1,300万', '¥13M', '1,700万', '720万', '¥7.2M', '950万'],
  'indigo':                 ['1,600万', '¥16M', '500万', '¥5M', '650万'],
  'egyptair':               ['1,550万', '¥15.5M', '1,900万', '850万', '¥8.5M'],
  'air-india':              ['1,550万', '¥15.5M'],
  'ethiopian-airlines':     ['1,600万', '¥16M'],
  'ana-wings':              ['2,000万', '¥20M', '2,300万', '1,300万', '¥13M'],
  'j-air':                  ['1,250万', '¥12.5M'],
  'etihad':                 ['2,300万'],
  'fda':                    ['1,600万', '¥16M'],
  'jetstar-japan':          ['2,400万', '¥24M', '1,450万', '¥14.5M'],
  'orc':                    ['850万', '¥8.5M', '1,000万'],
};

/* ── 根拠の等級（salary-basis.mjs）─────────────────────────────────
   その会社・その職位について「画面に出していい万円の数値」の集合を作る。
   原貨の金額から man() で毎回計算するので、レートを取り直せばここも一緒に動く。 */
const RANKS = { cap: '機長', fo: '副', crew: '運航乗務員', trainee: '訓練生' };
function basis(slug, rank) {
  const r = BASIS[slug]?.[rank];
  if (!r) return null;
  /* 金額の作り方は salary-basis.mjs の figures() 1か所。ここに写さない
     （欄を足したときに、片方だけ古くなって黙って検査から外れるのを防ぐ）。 */
  const allowed = new Set(basisFigures(slug, rank).map((f) => f.man));
  return { tier: r.tier, ja: TIERS[r.tier].ja, allowed, was: r.held?.was ?? null };
}

let pass = 0, warn = 0, fail = 0;
const lines = [];
/* ★2026-10-23 英語の EN-7：英語の新しい会社ページ（airline-rollout.mjs の EN_SWITCH の en/airlines/{slug}.html）もパス1で見る。
     前はパス1が airlines/{slug}.html しか開かず、英語の会社ページの推定年収は1度も SALARY と照合されていなかった（パス2 は「…万」しか
     読まないので、古い形の英語のページの「¥37M」の額も見えない）。新しい形の英語のページの額は、生成器が「¥3,700万」の形の data-orig を
     持つドルの span で書く ＝ unbake() で戻せば、日本語のページと同じ物差しで読める。古い形の英語のページ（EN-8 まで）はまだ見ない。 */
const PAGES1 = [...Object.entries(SALARY).map(([slug, d]) => [slug, d, `airlines/${slug}.html`, slug]),
  ...EN_SWITCH.map(slug => [slug, SALARY[slug], `en/airlines/${slug}.html`, `en/${slug}`])];
for (const [slug, d, p, who] of PAGES1) {
  if (!existsSync(p)) { lines.push(`❓ ${who}: page not found`); warn++; continue; }
  /* ★ 「同じ国の他社」リンク（link-countries.mjs の PV-CLINK ブロック）には
        他社の年収が入っている。そこを一緒に読むと、たとえば skymark のページに
        あるジェットスター・ジャパンの¥2,400万を skymark の古い数値と誤検知する
        （実際に stale:2,400万 の誤報が出た）。このページ自身の主張だけを見る。 */
  const html = unbake(readFileSync(p, 'utf8'))
    .replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '')
    /* ★2026-09-30、比較の一文も落とす。gen-faq.mjs が全社の FAQ に
         「ANA・JALの機長は推定約¥2,700万、副操縦士は推定約¥1,800万です。」を入れるので、
         そこに出ている ANA・JAL の額を**そのページの会社の額**と読んでしまう。
         実際にサウディアで起きた ── 旧平均が偶然 ANA・JAL の副操縦士と同じ 1,800万 で、
         「旧平均が残っている」と誤報した。PV-CLINK と同じ理屈で、このページ自身の主張だけを見る。 */
    .replace(/ANA・JALの機長は[^。]*?です。/g, '')
    .replace(/ANA and JAL captains[^.]*?\./g, '')
    /* ★2026-10-22（全社へ広げる d2 の検査役）、棒の目盛の一文も落とす。目盛の右端は SWITCH の全社の推定から決まる
         共通の物差し（gen-airline-glance.mjs の「棒の目盛は 0 〜 ¥…万。」）で、そのページの会社の額ではない。
         d2 で右端が ¥7,000万 になり、キャセイの古い額（STALE の 7,000万）と同じ字になって、⚠️ が出たままになった
         （出たままの ⚠️ は、本当に古い額が戻っても気づけない）。PV-CLINK と同じ理屈で、このページ自身の主張だけを見る。 */
    .replace(/<p class="pvg-axis">[^<]*<\/p>/g, '');
  /* 職位ごとに「出ていないと困るもの」と「残っていたら困るもの」を組む。
     等級を決めていない会社 = 今までどおり SALARY の平均が出ていること。
     等級のある会社         = その等級の掲載額のどれかが出ていること。

     ★2026-09-30、推定（estimate）の向きを裏返した。
       オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」で、元の平均は
       「推定」として画面に**戻す**ことになった。前はここが逆で、旧平均が
       ページに残っていたら落としていた（gone）。いまは estimate の職位では
       **出ていないと落とす**。

     ★2026-10-01、公式募集例・求人の掲載額・過去の募集広告・条件つきの給与例の職位も
       同じ向きに裏返した。オーナー指示「**なぜ半分以上確認中なの？基本全て推定でいいじゃん**」で、
       根拠の強い額が1つ取れている職位でも、**推定年収を併記する**ことになった
       （画面はもうそうなっている。実際にオマーン航空は「2017年の募集広告 1,951万」の隣に
       「推定 2,500万」を出している）。
       前はここで旧平均が残っていたら落としていた（`gone`）ので、画面が先に進んだぶん
       **18件が赤く出て、製品のほうが正しい**状態だった。
       ⚠️ 旧平均の見張りを外しただけにしない。`held.was.avg` は50件すべて
          `salary-data.mjs` の現在の avg と一致している（実測）ので、**その avg が
          出ていること**を代わりに求める。数字が古くなったページは今までどおり捕まる。 */
  const needAny = [], shown = [], crewOn = [];
  for (const [rank, nm] of Object.entries(RANKS)) {
    const B = basis(slug, rank);
    /* ★2026-10-21 P12.77（オーナー「そもそも運行乗務員の平均年収で出してどうするの？機長、副操縦士のわかないと意味ないじゃん」）。
         機長と副操縦士を分けない額（運航乗務員の平均）は、会社ページに**出さない**。向きを裏返した ──
         前は「出ていないと落とす」、いまは「出ていたら落とす」（同じ額の集合で見る）。台帳（BASIS.crew）には残る。 */
    if (rank === 'crew') {
      if (!B) continue;
      /* 見るのは画面と検索向けの字（題・説明・構造化データ・本文）。seo-normalize.mjs が元の題名を預けている注記（<!--PV-SRC …-->）は画面に出ないので見ない */
      const seen = html.replace(/<!--PV-SRC[\s\S]*?-->/g, '');
      const on = [...B.allowed].map(man).filter((s) => seen.includes(s));
      if (on.length) crewOn.push(...on);
      shown.push(`${nm}平均（出さない）`);
      continue;
    }
    /* crew（運航乗務員＝機長と副操縦士をあわせた会社公表の平均）と trainee（訓練生）は、
       その資料がある会社にだけ置いてある。無い会社では何も求めない。 */
    if (!B) { if (!d[rank]) continue; const s = man(d[rank].avg); needAny.push([nm, [s]]); shown.push(nm + s); continue; }
    if (B.tier === 'estimate') {
      /* ★2026-10-02、優先を入れ替えた。前は held.was.avg（確認中にする前の値）を先に見ていて、
           「50件すべて salary-data.mjs の現在の avg と一致している」ことが前提だった。
           エバー航空の年収を資料にもとづいて直した時点でその前提は崩れた
           （held.was は確認中の時代の値を残す履歴で、いま画面に出す額ではない）。
           画面に求めるのは **いまの SSOT の avg**。was は資料が無いときの保険に下げる。 */
      const s = man(d[rank]?.avg ?? B.was?.avg);
      needAny.push([`${nm}(推定)`, [s]]); shown.push(`${nm}推定${s}`); continue;
    }
    if (B.tier === 'held') { needAny.push([nm, ['確認中']]); shown.push(`${nm}確認中`); continue; }
    const list = [...B.allowed].sort((x, y) => y - x).map(man);
    /* ★ 推定年収も「出ていてよい額」に入れる（要求はしない）。
         会社自身が出している額が取れている職位では、推定を**併記してもしなくてもよい**。
         併記しているページ（オマーン航空・ピーチ・スターラックスなど）はこれで通り、
         会社の額だけで組んでいるページ（エミレーツ ── 公式の現金給与と総待遇の2つを
         並べていて、推定を足すと機長の金額が3つになる／エティハド）も通る。
         ⚠️ 「出ていなくてよい」は「何でも出せる」ではない。ページに出ている金額が
            SSOT と食い違っていれば、下のパス2（全ページ × SSOT）が ❌ にする。
            ここは「その職位に何か出ているか」・あちらは「出ている額が正しいか」。 */
    if (d[rank]) list.push(man(d[rank].avg));
    needAny.push([`${nm}(${B.ja})`, list]);
    shown.push(`${nm}${B.ja}${man([...B.allowed].sort((x, y) => y - x)[0])}`);
  }
  const miss = needAny.filter(([, list]) => !list.some((s) => html.includes(s)));
  const stale = (STALE[slug] || []).filter((s) => html.includes(s));
  let status = '✅', tag = '';
  if (miss.length || crewOn.length) {
    status = '❌'; fail++;
    tag = [...miss.map(([n, l]) => `missing:${n}[${l.join('/')}]`), ...(crewOn.length ? [`crew-shown:運航乗務員の平均[${crewOn.join('/')}]`] : [])].join(' ');
  } else if (stale.length) { status = '⚠️ '; warn++; tag = `stale:${stale.join(',')}`; }
  else { pass++; }
  lines.push(`${status} ${who.padEnd(20)} ${shown.join(' ')}   ${tag}`);
}
console.log(lines.join('\n'));
console.log(`\n${pass} pass · ${warn} warn · ${fail} fail  (of ${PAGES1.length} ── 日本語 ${Object.keys(SALARY).length}枚・英語の新しい会社ページ ${EN_SWITCH.length}枚)`);

// ── パス2: サイト全 HTML × SSOT のクロスチェック ─────────────────────────
// 「社名 …少し離れて… 役職 …少し離れて… 数値万」という並びを全部拾い、SSOT と比べる。
// 表のセル（<td>ANA</td><td>機長</td><td>2,700万</td>）も拾えるよう、隙間はタグを跨がせる。
//
// ❌ = その会社の [lo, hi] の外。反証の余地なく間違い。
// ⚠️ = レンジ内だが SSOT の節目（avg / lo / hi）でない。人が見る価値がある。
//      ⚠️ には原理的に消せない誤検知が1種類ある — 「中東（Emirates・Qatar など）では
//      機長の平均年収が2,900〜3,700万」のように、複数社の平均をまたぐ言い方。
//      1社の lo/hi と比べる作りなので区別できない。ALLOW に理由つきで置く。

/* sources-raw/ ＝ 出所資料の控え（gitignore 済み・配信されない）。よその記事の HTML が入るので、
   読みに行くと「他社サイトの推定年収」をこのサイトの誤りとして数える（2026-10-05 に20件の嘘の赤）。 */
const SKIP_DIR = new Set(['node_modules', '.git', 'temporary screenshots', 'sources-raw', 'baland_ass', 'supabase', 'db', '.github']);
function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIR.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

// 「全日本空輸（ANA）」→ ['全日本空輸（ANA）', '全日本空輸', 'ANA'] のように呼び名を展開。
// 2文字以下（「JAL」未満の断片）は普通の文中で誤爆するので捨てる。
function aliases(d) {
  const out = new Set();
  for (const raw of [d.ja, d.en]) {
    if (!raw) continue;
    out.add(raw);
    const m = raw.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*$/);
    if (m) { out.add(m[1].trim()); out.add(m[2].trim()); }
  }
  return [...out].filter((s) => s.length >= 3);
}
const ALIAS = [];
for (const [slug, d] of Object.entries(SALARY)) for (const a of aliases(d)) ALIAS.push({ slug, a });
ALIAS.sort((x, y) => y.a.length - x.a.length); // 長い呼び名を先に当てる
const ALL_ALIAS = ALIAS.map((x) => x.a);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ROLE = '(機長|副操縦士|Captain|Captains|First Officer|First Officers)';
const GAP = '(?:<[^>]*>|[^<>\\d]){0,24}';  // タグを跨ぐ。跨がないと表のセルが全部見えない
const NUM = '([\\d,]{3,6})';
// 年額そのものでない数値（手取り・月額・住宅手当込みの実質パッケージ）は SSOT と一致しなくて当然
const DERIVED = /手取|月収|月額|毎月|月あたり|税引|実質|パッケージ|take-?home|after[- ]tax|per month|monthly|effectively|package/i;
// 社名の直前がこれなら、より長い社名の一部（「日本航空」⊂「新日本航空」、「ANA」⊂「ANAウイングス」）
const NAME_CHAR = /[0-9A-Za-zぁ-ゖァ-ヺー一-鿿]/;

// レンジ内だが節目でない ⚠️ のうち、人が見て正しいと判断したもの。
// 消すのではなく理由を残す（数字を動かしたとき、この理由ごと見直せるように）。
/* 2026-09-30、5件あった例外を**全部外した**。
   どれも「カタールの平均2,900」「エミレーツの平均3,700」「ANA副操縦士の
   1,400〜2,100」のように、**根拠を確認できず公開表示をやめた平均**を
   正しいものとして指していた。指していた文はページから消えている。
   残しておくと、同じ金額が別の形で戻ってきたときに黙って通す。
   新しく足すときは、指す文が今もページに在ることを確かめてから足す
   （在るかどうかは下の「使われていない許容」が毎回知らせる）。 */
const ALLOW = [];
/* 使われなくなった例外を知らせる。
   例外は「人が一度見て正しいと判断した」印なので、指している文がページから
   消えたあとも残ると、次に同じ金額が現れたときに黙って見逃す穴になる。
   2026-09-30、スターラックスの体験記の行がまさにそれだった
   （根拠の無いレンジを公開表示から外したので、指していた文ごと消えていた）。 */
const allowUsed = new Set();

const files = walkHtml('.');
let nHit = 0, nBad = 0, nWarn = 0;
const cross = [];
for (const f of files) {
  const html = unbake(readFileSync(f, 'utf8')).replace(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/g, '');
  for (const { slug, a } of ALIAS) {
    const d = SALARY[slug];
    const re = new RegExp(esc(a) + GAP + ROLE + GAP + NUM + '(?:\\s*万?\\s*[〜~–—-]\\s*' + NUM + ')?\\s*万', 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const span = m[0];
      // ① 社名がより長い社名の一部でないか
      if (m.index > 0 && NAME_CHAR.test(html[m.index - 1])) continue;
      if (ALL_ALIAS.some((x) => x.length > a.length && html.startsWith(x, m.index))) continue;
      // ② 社名と金額のあいだに、別の社名や行の切れ目が挟まっていないか
      //    （比較表で「ANA（参考）」の見出しから隣の会社のセルまで届いてしまう）
      const inner = span.slice(a.length);
      if (/<\/(?:tr|thead|tbody|table|section|article|li|ul|ol)>/.test(inner)) continue;
      if (ALL_ALIAS.some((x) => x !== a && !a.includes(x) && inner.includes(x))) continue;
      // ③ 手取り・月額・実質パッケージは年額ではない
      if (DERIVED.test(html.slice(Math.max(0, m.index - 40), m.index + span.length + 20))) continue;

      /* ★ 運航乗務員（機長と副操縦士をあわせた会社公表の平均）と訓練生の額を、
           機長・副操縦士の額として判定しない。会社が職位で分けていない数字なので、
           機長の掲載額と突き合わせると必ず食い違い、直せない ❌ が出続ける。
           「機長と副操縦士をあわせた運航乗務員の平均」のように書くと m[1] に機長が入るため、
           まわりの言葉を見て先に振り分ける。 */
      /* ★2026-10-01、見る範囲を「役職の語から金額まで」に狭めた。
           前は金額の前後80字を見ていたので、
           「当サイトの推定で機長 約¥2,700万…**会社公表は運航乗務員**全体の平均2,005万円」
           のように**金額より後ろ**に出てくる運航乗務員を拾い、推定の 2,700万 を
           「運航乗務員の平均」として判定していた（JAL・スカイマークで8件の ❌）。
           見るのは span（社名から金額まで）だけにする ── その金額に付いている語は
           必ずこの中に在る。「運航乗務員（機長＋副操縦士）平均 ¥2,005万」のように
           役職の語より**前**に出る書き方も、社名から見るのでちゃんと拾える
           （役職から後ろだけに狭めると、こちらが18件まとめて ⚠️ に落ちた）。 */
      /* ★2026-10-06、「運航乗務職」も同じ扱いにする（ANA の有報はこの呼び名。3社をあわせた乗員全体の平均）。 */
      const role = /運航乗務[員職]/.test(span) && BASIS[slug]?.crew ? 'crew'
        : /訓練生|初任給|チャレンジ手当/.test(span) && BASIS[slug]?.trainee ? 'trainee'
        : /機長|Captain/.test(m[1]) ? 'cap' : 'fo';
      const lo = +m[2].replace(/,/g, '');
      const hi = m[3] ? +m[3].replace(/,/g, '') : null;
      nHit++;
      const text = span.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      const lineNo = () => html.slice(0, m.index).split('\n').length;

      /* ★ 等級のある職位は SALARY ではなく salary-basis.mjs の掲載額と突き合わせる。
           SALARY の平均・レンジは公開表示から外した種類の数字なので、ここで一致を
           求めると「外したはずの数字」をページに戻す方向に働いてしまう。
           ALLOW（人が見て正しいと判断した例外）はこちらには効かせない ──
           あれは SSOT のレンジに対する例外で、等級の話ではないため。 */
      /* ★2026-09-30、推定（estimate）だけはこの枝を通さず下の SSOT 突き合わせへ落とす。
           推定の職位に載せる数字は salary-data.mjs の avg / lo / hi そのものなので、
           台帳には掲載額が1件も無い（＝ここで判定すると必ず食い違う）。
           判定の中身は等級を作る前と1文字も同じ ── avg / lo / hi のどれかなら正、
           レンジ表記なら lo〜hi と一致、外れていれば ❌。 */
      const B = basis(slug, role);
      if (B && B.tier !== 'estimate') {
        if (B.tier === 'held') {
          nBad++;
          cross.push(`❌ ${f}:${lineNo()}  «${text.slice(0, 56)}»  ${slug} ${role} は確認中（金額を出さない）`);
          continue;
        }
        if (hi === null ? B.allowed.has(lo) : B.allowed.has(lo) && B.allowed.has(hi)) continue;
        /* ★2026-10-01 ── 台帳の掲載額ではなかった。ここで落とさず、下の SSOT 突き合わせへ送る。
             オーナー指示「**基本全て推定でいいじゃん**」で、根拠の強い額が取れている職位にも
             **推定年収を併記する**ことになった（オマーン航空のページは「2017年の募集広告 1,951万」の
             隣に「推定 2,500万」を出している）。推定の数字は salary-data.mjs が正なので、
             台帳ではなく SSOT と突き合わせるのが正しい判定。
             ⚠️ 運航乗務員（crew）と訓練生（trainee）は SALARY に無い＝下に比べる相手がいないので、
                ここで落とす。あちらは会社が職位で分けていない数字・訓練期間中の額で、推定とは別物。 */
        if (!d[role]) {
          nBad++;
          const list = [...B.allowed].sort((x, y) => y - x).map(man).join('／');
          cross.push(`❌ ${f}:${lineNo()}  «${text.slice(0, 56)}»  ${slug} ${role} は「${B.ja}」で ${list}`);
          continue;
        }
      }

      if (!d[role]) continue;   // crew / trainee は SALARY に無い（等級の側で見ている）
      const S = d[role];
      // 単独の数値は avg / lo / hi のどれかであれば正。レンジ表記は lo〜hi と一致すべき。
      if (hi === null ? [S.avg, S.lo, S.hi].includes(lo) : lo === S.lo && hi === S.hi) continue;
      const skip = ALLOW.findIndex(([af, frag]) => f.replace(/^\.\//, '') === af && text.includes(frag));
      if (skip >= 0) { allowUsed.add(skip); continue; }
      const outside = hi === null ? (lo < S.lo || lo > S.hi) : (hi < S.lo || lo > S.hi);
      if (outside) nBad++; else nWarn++;
      const ln = html.slice(0, m.index).split('\n').length;
      cross.push(`${outside ? '❌' : '⚠️ '} ${f}:${ln}  «${text.slice(0, 56)}»  SSOT ${role} ${S.avg}（${S.lo}〜${S.hi}）`);
    }
  }
}
console.log(`\n── 全ページ × SSOT クロスチェック ──`);
if (cross.length) console.log(cross.sort().join('\n'));
console.log(`${files.length}ファイル・${nHit}件照合  ❌${nBad} ⚠️${nWarn}（許容${ALLOW.length}件は除外）`);
const dead = ALLOW.map((a, i) => [a, i]).filter(([, i]) => !allowUsed.has(i));
if (dead.length) {
  console.log(`\n⚠️ 使われていない許容が ${dead.length} 件（指していた文がページから消えている＝穴になる前に外す）`);
  for (const [[af, frag]] of dead) console.log(`   ${af}  «${frag}»`);
}

const js = checkSalaryJson();
console.log(`\n${js.ok ? '✅' : '❌'} salary-data.json: ${js.msg}`);

// ★ 以前は salary-data.json の不一致でしか exit 1 にならず、ページ側の ❌ が
//   出力に埋もれて本番まで抜けていた。ページの ❌ も落とす。
if (!js.ok || fail || nBad) process.exitCode = 1;
