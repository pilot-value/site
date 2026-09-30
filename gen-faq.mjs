/* ════════════════════════════════════════════════════════════════
   gen-faq.mjs — 航空会社ページ220枚の FAQ を SSOT から作り直す

   ── 日本語側で直すこと ────────────────────────────────────────
   1. 110枚のうち98枚が、FAQPage の構造化データを出しているのに
      ページ本文にFAQが1問も無い。Google の FAQ 構造化データは
      「回答がページ上でユーザーに見えていること」が条件なので、
      今の状態は無効なだけでなく手動対策の対象になりうる。
      残り12枚は手書きのFAQがあるが、その本文とJSON-LDの中身が
      別物になっている。書いてある内容と申告がずれている。

   2. 出ている3問が seo-batch-update.mjs 由来の定型文で、
      副操縦士・月収・手取りに一言も答えていない。
      狙っているのは「[社名] 副操縦士 年収」「パイロット 月収」
      「[社名] 手取り」なので、答えが無いページは拾われない。

   ── 英語側で足すこと ──────────────────────────────────────
   英語版は captain / first officer / requirements / 比較（＋非課税社は
   tax-free）を既に持っているが、月額に答える問がどこにも無い。
   "pilot salary per month" 系のクエリに対して答えを持っていない。
   1問だけ足す。既存の4〜5問には手を触れない。

   ── どう作るか ────────────────────────────────────────────
   数値は全て salary-data.mjs（SSOT）から毎回計算する。
   ページに書いてある数字を読み取って再利用はしない。

   日本語・可視FAQが無いページ … SSOT から5問（機長／副操縦士／月収／
     非課税または比較）を組み、可視セクションとJSON-LDを
     <!--PV-FAQ--> の管理ブロックに一緒に入れる。同じ配列から両方を
     作るので、本文と構造化データが原理的にずれない。

   日本語・可視FAQがあるページ … 本文は書き換えない（手書きの中身のほうが
     濃い）。ページに見えている <details> から Q/A を読み取って JSON-LD を
     組み直す。申告を本文に合わせる向きで直す。

   英語（全110枚） … 月収の1問を可視FAQの末尾と FAQPage の両方に足す。

   starlux（日本語） … FAQをJSで描画していて <details> が無い。対象外。

   ── 通貨の扱い ────────────────────────────────────────────
   currency.js は <script> を走査対象から外すので、JSON-LD は実行時に
   変換されない。英語ページの既定表示は USD なので、
     ・可視テキスト → ¥…M（英語ページの既存表記。currency.js が $…K へ変換する）
     ・JSON-LD     → 変換後と同じ見え方になる USD を直接書く
   と書き分ける。レートと圧縮表記は currency.js から読んで合わせるので、
   ページに出る文字列と構造化データの文字列が一致する（実測で確認済み。
   例: zipair 可視 ¥2.08M → 表示 $13K、LD も $13K）。
   日本語ページは既定 JPY なので、可視も LD も ¥…万 のままでよい。

   ── 書かない数字 ──────────────────────────────────────────
   ・課税国の手取り額（税率を推測で埋めることになる）
   ・SSOT に無い機種別・年次別の内訳

   実行: node gen-faq.mjs
        node gen-faq.mjs --dry
════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { SALARY } from './salary-data.mjs';
import { AIRLINE_COUNTRY, BY_CODE } from './airline-countries.mjs';
/* 根拠の等級。等級を決めた会社は SALARY の平均・レンジを1文字も書かない。 */
import { BASIS, TIERS, figures, FX_AS_OF } from './salary-basis.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const DRY = process.argv.includes('--dry');

/* 通貨切替（currency.js）が拾える標準の円表記だけを使う。独自フォーマットは
   assert-currency / assert-jp が落ちる。CLAUDE.md「通貨表記のルール」。 */
const man = (v) => `¥${Math.round(v).toLocaleString('en-US')}万`;
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* レートと圧縮表記は currency.js の実装をそのまま写す。数字を二重管理しない。 */
const CUR = fs.readFileSync(path.join(ROOT, 'currency.js'), 'utf8');
const RATE_USD = (() => {
  const m = CUR.match(/RATES\s*=\s*\{[^}]*USD:\s*([\d.]+)/);
  if (!m) throw new Error('currency.js から USD レートが読めない。RATES の書式が変わった可能性がある');
  return parseFloat(m[1]);
})();
const trimZero = (s) => String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
/* currency.js の compact() と同じ丸め。ページに出る文字列と一致させるため。 */
function usd(manYen) {
  const v = Math.round(manYen) * 10000 / RATE_USD;
  const a = Math.abs(v);
  if (a >= 1e6) return '$' + trimZero((v / 1e6).toFixed(1)) + 'M';
  if (a >= 1e4) return '$' + Math.round(v / 1e3).toLocaleString('en-US') + 'K';
  if (a >= 1e3) return '$' + trimZero((v / 1e3).toFixed(1)) + 'K';
  return '$' + Math.round(v).toLocaleString('en-US');
}

/* 比較の基準は日本の大手。ANA と JAL は SSOT で同値。
   ⚠️ **この値に「平均」と付けない。** ANA・JAL の機長の数字は出どころ・対象・計算方法を
      確認できていない＝公開情報からの推定（salary-basis.mjs の等級 estimate）。
      書いてよいか・何と呼ぶかは必ず avgWord('ana','cap') で聞く。
      ★2026-09-30 まで、ここは「確認中なので1文字も書かない」だった。オーナー指示
        「確認中じゃなくて推定とかにすりゃいいじゃん」で、数字は書く・平均とは呼ばない、に変えた。
   ⚠️ 等級の違う数字（公式募集例・総待遇）を引き算・倍率の相手にしない。 */
const BASE = SALARY.ana.cap.avg;

/* ══ 根拠の等級で文章を作る（salary-basis.mjs に等級がある会社だけ）══════
   ★ 等級のある会社では SALARY の平均・レンジを1文字も書かない。
     「確認中」の職位は金額を書かず、0 や空欄にもしない。
   ⚠️ 年額を12で割って「月収」と呼ばない。公表された月額があるときだけ月額を書く。
   ⚠️ 総待遇に現金給与や住宅・学費をもう一度足さない。
   ⚠️ 平均でない数字を「平均」と呼ばない（呼び方は TIERS の1か所）。           */
const RANK_JA = { cap: '機長', fo: '副操縦士' };
const RANK_EN = { cap: 'captains', fo: 'first officers' };
const hasBasis = (slug) => !!BASIS[slug];
const isHeldRank = (slug, rank) => BASIS[slug]?.[rank]?.tier === 'held';
/** 平均として書いていい会社か（等級を決めていない＝今までどおり SALARY を書く）。 */
const mayWriteAvg = (slug, rank) => {
  const t = BASIS[slug]?.[rank]?.tier;
  return t === undefined ? true : !!TIERS[t].avg;
};
/** ★SALARY の数字を文章に書いてよいか、書くなら何と呼ぶか（2026-09-30）。
    オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」で、等級 estimate は
    **金額を書く**ようになった。ただし「平均」とは呼ばない。

    返り値 … '平均' / '推定' / null（＝ SALARY の数字は書かない職位。
              会社が出した額のほうを書く ── 公式募集例・求人・過去広告・給与例）
    ⚠️ mayWriteAvg と混ぜない。あちらは「平均」の語を許すかだけを聞いている。 */
const avgWord = (slug, rank) => {
  const t = BASIS[slug]?.[rank]?.tier;
  if (t === undefined) return '平均';
  if (t === 'estimate') return '推定';
  return TIERS[t].avg ? '平均' : null;
};
const avgWordEn = (slug, rank) => {
  const w = avgWord(slug, rank);
  return w === '平均' ? 'average' : w === '推定' ? 'estimated' : null;
};

/** 「直接入社機長は年間の現金給与が約2,489万円、月間の現金給与が約208万円」の並び。 */
function figJa(slug, rank, keys = null) {
  const byGroup = new Map();
  for (const f of figures(slug, rank)) {
    if (keys && !keys.includes(f.key)) continue;
    if (!byGroup.has(f.group)) byGroup.set(f.group, []);
    byGroup.get(f.group).push(`${f.kind}が${f.text}`);
  }
  return [...byGroup].map(([g, parts]) => `${g}は${parts.join('、')}`).join('。');
}
/** 英語側。円で書く（本文は bake-en-currency.mjs がドルにする）／LD は最初からドル。
    ⚠️ 採用区分も金額の種類も**英語の呼び名**を使う。
       2026-09-30 まで日本語のほうを使っていて、英語ページの FAQ に
       「昇格後（機長歴10年目安）: 月額 ¥2.11M」がそのまま出ていた（10社）。
       台帳に英語が無ければ落とす ── 日本語で埋めて見逃すより、空で気づくほうがいい。 */
function figEn(slug, rank, fmt, keys = null) {
  const byGroup = new Map();
  for (const f of figures(slug, rank)) {
    if (keys && !keys.includes(f.key)) continue;
    if (!f.group_en || !f.kind_en) continue;
    if (!byGroup.has(f.group_en)) byGroup.set(f.group_en, []);
    byGroup.get(f.group_en).push(`${f.kind_en} ${fmt(f.man)}`);
  }
  return [...byGroup].map(([g, parts]) => `${g}: ${parts.join(', ')}`).join('; ');
}
/** 出所の確認日。「いつ確認したか」を文章に入れる（確認日 ≠ 発行日）。 */
const accessedJa = (slug) => {
  const ds = (BASIS[slug]?.src || []).map((s) => s.accessed).filter(Boolean).sort();
  return ds.length ? ds[ds.length - 1] : null;
};

/* ★「確認中」の言い方。★★ 断定していいのは「当サイトが確認した資料の範囲」だけ。
   ⚠️ 「会社は給与を公表していません」と書かない（2026-09-29 オーナー経由のレビュー・指摘1）。
      ・「この職位の平均・レンジの根拠を確認できない」ことと
      ・「会社が給与を公表していない」ことは、別のことである。
      資料が見つからなかったのは、資料が存在しないことの証明ではない
      （シンガポール航空には過去の労使協約があり、現在の平均には使えないが、
        「資料が無い」と言い切ることもできない）。
   ⚠️ 共通化するのは言い方の骨だけ。会社ごとの事実は salary-basis.mjs の
      notes / src が持っており、そちらから文章に入る。 */
const HELD_JA = (slug, name, nm) => {
  const hasSrc = (BASIS[slug]?.src || []).length > 0;
  const acc = accessedJa(slug);
  return `当サイトは以前、${name}の${nm}の年収を平均として載せていました。`
    + `ただし、その数字をどの資料から作ったかの記録が残っていませんでした。`
    + (hasSrc
      ? `このページに出している資料は、${nm}の平均やレンジを示すものではありません。`
      : `${acc ? `${acc}までに当サイトが確認した資料の中には、` : '当サイトが確認した資料の中には、'}${nm}の給与額を示すものがありませんでした。`)
    + `そのため、金額の表示を「確認中」にしています。0円や空欄にはせず、元の値は変更の記録として残しています。`
    + `これは${name}が給与を公表していないという意味ではありません。当サイトが確認できた範囲での話です。`
    + `誰に・どの条件で当てはまるかが分かる資料が取れた時点で、その条件を付けて載せ直します。`;
};
const HELD_EN = (slug, name, nm) => {
  const hasSrc = (BASIS[slug]?.src || []).length > 0;
  const acc = accessedJa(slug);
  return `We used to publish an average for ${name} ${nm}. There was no record of which document that number came from. `
    + (hasSrc
      ? `The documents shown on this page do not state an average or a range for ${nm}. `
      : `Nothing we checked${acc ? ` up to ${acc}` : ''} stated a pay figure for ${nm}. `)
    + `So the figure now reads under review. We have not replaced it with a zero or a blank — the old value is kept as a change record. `
    + `That is not the same as saying ${name} publishes no pay figures; it is the limit of what we were able to check. `
    + `Once we have a document that says who a figure applies to and on what terms, we will publish it with those terms attached.`;
};

/* ★「推定」の言い方（2026-09-30 オーナー指示）。
   「なんで各航空会社の機長、FOの平均年収を確認中にしちゃうんだよ。
     確認中じゃなくて推定とかにすりゃいいじゃん。」

   ⚠️ 「平均」と書かない。この数字は公開情報からの推計で、全社員の実測平均ではない
      （サイトの他の場所でも「推定年収（公開情報）」と書いている ── lp.js の注意書き）。
   ⚠️ 弁解を書かない（2026-09-30 指摘④「いいわけの部分いらないから削除」）。
      「なぜ平均と呼べないか」「資料が取れたら載せ直す」は書かない。
      推定であることと、数字が上下する理由だけ書く。
   ⚠️ 「会社は給与を公表していません」と書かない（オーナー経由のレビュー・指摘1）。 */
const EST_JA = (slug, name, nm, rank) => {
  const d = SALARY[slug], r = d[rank];
  return `${name}の${nm}の年収は、当サイトの推定で約${man(r.avg)}です（幅はおおむね${man(r.lo)}〜${man(r.hi)}）。`
    + `公開情報から当サイトが推計した金額で、${name}が公表した金額ではありません。`
    + (d.taxFree ? `所在国に個人所得税が無いため、この金額が手取りに近くなります。` : `いずれも税引き前の金額です。`)
    + `機種・在籍年数・乗務する路線によって上下します。`;
};
const EST_EN = (slug, name, nm, fmt, rank) => {
  const d = SALARY[slug], r = d[rank];
  return `We estimate annual pay for ${name} ${nm} at about ${fmt(r.avg)}, with a range of roughly ${fmt(r.lo)}–${fmt(r.hi)}. `
    + `That is our own estimate from public information, not a figure ${name} publishes. `
    + (d.taxFree ? `There is no personal income tax where the airline is based, so this is close to take-home. ` : `These are gross figures, before income tax. `)
    + `Where you sit inside the range is set by the aircraft type, years of service and the routes you fly.`;
};

function buildJaBasis(slug) {
  const b = BASIS[slug], d = SALARY[slug], name = d.ja;
  const country = BY_CODE[AIRLINE_COUNTRY[slug]];
  const acc = accessedJa(slug);
  const items = [];

  for (const rank of ['cap', 'fo']) {
    const r = b[rank], nm = RANK_JA[rank];
    const q = `${name}の${nm}の年収はいくらですか？`;
    if (r.tier === 'estimate') { items.push({ q, a: EST_JA(slug, name, nm, rank) }); continue; }
    if (r.tier === 'held') { items.push({ q, a: HELD_JA(slug, name, nm) }); continue; }
    const label = TIERS[r.tier].ja;
    /* 月額・月手当は次の問で扱う。ここは年額として通るものだけ。 */
    const y = figJa(slug, rank, ['cash_y', 'pkg_y', 'max_y', 'target_y', 'cash_y_over', 'reward_y', 'month_x']);
    /* ⚠️ 年額が1つも無い会社がある（サウディア・中国南方は月額しか資料が無い）。
       そのまま流すと「…です。。全社員の平均ではありません。」と、
       **答えに金額が1つも入らないまま**文だけが出る。2026-09-30 まで出ていた。
       ★月額に12を掛けて年収にしない（オーナーが名指しで禁止）。無いと書く。 */
    const m = figJa(slug, rank, ['cash_m', 'base_m', 'allow_m_from', 'month']);
    const tail = `${r.groups[0]?.cond ? `${r.groups[0].cond}という条件が付きます。` : ''}`
      + (b.notes[0] ? b.notes[0] : '')
      + (acc ? `資料の確認日は${acc}です。` : '');
    items.push({
      q,
      a: y
        ? `当サイトが${nm}について載せているのは「${label}」です。${y}。全社員の平均ではありません。${tail}`
        : `当サイトが確認した資料の中に、${name}の${nm}の年額はありませんでした。`
          + (m ? `あるのは「${label}」の月額だけです（${m}）。月額に12を掛けた数字は実際の年間の受給額ではないため、年収としては出していません。`
               : `そのため年収は出していません。`)
          + tail,
    });
  }

  /* 月収。★年額を12で割らない。公表された月額があるときだけ書く。 */
  const mj = ['cap', 'fo'].map((rank) => figJa(slug, rank, ['cash_m', 'base_m', 'allow_m_from', 'month']))
    .filter(Boolean).join('。');
  items.push({
    q: `${name}のパイロットの月収はいくらですか？`,
    a: mj
      ? `${mj}。これは会社が公表しているそのままの月額で、年額を12で割った数字ではありません。`
        + `月額に12を掛けた額と、公表されている年額は一致しません。どちらもそのまま載せています。`
        + `住宅・学費などを含む総待遇を12で割った額は、月給ではありません。`
      : `当サイトは${name}の月額を出していません。年額を12で割った数字は実際の毎月の支給額ではなく、`
        + `その月に飛んだ時間で上下するためです。`,
  });

  /* 税。★税率は書かない（居住国・扶養・控除で変わる）。旧平均も書かない。 */
  const cja = country ? country.ja : '所在国';
  items.push(d.taxFree ? {
    q: `${name}のパイロットの給与は本当に非課税ですか？`,
    a: `${cja}には個人所得税が無いため、${name}の現金給与は税を引かれずそのまま受け取れます。${b.tax}。`
      + `日本の航空会社の年収は税引き前の金額なので、同じ額面でも手元に残る金額は変わります。`
      + `なお日本の居住者判定など個人の税務は別途確認が必要です。`,
  } : {
    q: `${name}のパイロットの給与は税引き前ですか？`,
    a: `このページに載せている金額はすべて税引き前（額面）です。${b.tax}。`
      + `手取りは居住国・扶養・各種控除で変わるため、額面から一律の割合で出すことはできません。`
      + `個人所得税の無い国（UAE・カタールなど）の航空会社とは、同じ額面でも手元に残る額が変わります。`,
  });

  /* ANA・JAL との比較。★種類の違う数字どうしで差や倍率を出さない。
     ★2026-09-30、職位ごとに見るようにした。ANA・JAL は「推定」なので、
       相手も「推定」の職位は**差を出す**（推定どうしの比較は成立する）。
       等級が違う職位（公式募集例・総待遇・条件つきの給与例）だけ差を出さない。
       前はここが「ANA 側が確認中だから何も出さない」で、両社とも推定に戻った今は
       「機長が『推定』、副操縦士が『推定』で、種類の違う数字です」という嘘になる。 */
  if (slug !== 'ana' && slug !== 'jal') {
    const cmpParts = [], noCmp = [];
    for (const rk of ['cap', 'fo']) {
      const w = avgWord(slug, rk), aw = avgWord('ana', rk);
      if (w && aw && w === aw) {
        const diff = d[rk].avg - SALARY.ana[rk].avg;
        const cmp = diff === 0 ? 'ほぼ同じ' : diff > 0 ? `${man(diff)}高い` : `${man(-diff)}低い`;
        cmpParts.push(`${RANK_JA[rk]}は${name}が${w}約${man(d[rk].avg)}、ANA・JALが${w}約${man(SALARY.ana[rk].avg)}で、${cmp}水準です`);
      } else {
        noCmp.push(`${RANK_JA[rk]}（${name}側は「${TIERS[b[rk].tier].ja}」）`);
      }
    }
    const anaW = avgWord('ana', 'cap');
    items.push({
      q: `${name}のパイロット年収はANA・JALと比べてどうですか？`,
      a: (cmpParts.length ? `${cmpParts.join('。')}。`
        : anaW ? `ANA・JALの機長は${anaW}約${man(BASE)}、副操縦士は${anaW}約${man(SALARY.ana.fo.avg)}です。` : '')
        + (noCmp.length ? `${noCmp.join('と')}は、対象や含むものが違う金額どうしになるため、差額・倍率は出していません。` : '')
        + (d.taxFree
          ? `${name}の所在国には個人所得税が無く、ANA・JALの金額は税引き前なので、手取りで比べると差はさらに広がります。`
          : `いずれも税引き前の金額どうしの比較です。`),
    });
  }
  return items;
}

/* ── 日本語・SSOT から5問（等級を決めていない会社）──────────────── */
function buildJa(slug) {
  if (hasBasis(slug)) return buildJaBasis(slug);
  const d = SALARY[slug];
  const name = d.ja;
  const { cap, fo } = d;
  const country = BY_CODE[AIRLINE_COUNTRY[slug]];
  const gap = cap.avg - fo.avg;
  const ratio = (cap.avg / fo.avg).toFixed(1);

  const items = [
    {
      q: `${name}の機長の年収はいくらですか？`,
      a: `${name}の機長（Captain）の年収は平均${man(cap.avg)}です（レンジ${man(cap.lo)}〜${man(cap.hi)}）。`
        + (d.taxFree
          ? `${country ? country.ja : '所在国'}は個人所得税が無いため、この金額がそのまま手取りに近くなります。`
          : `いずれも税引き前の金額です。`)
        + `機種・在籍年数・乗務する路線によって上下します。`,
    },
    {
      q: `${name}の副操縦士の年収はいくらですか？`,
      a: `${name}の副操縦士（First Officer）の年収は平均${man(fo.avg)}です（レンジ${man(fo.lo)}〜${man(fo.hi)}）。`
        + `機長との差は平均で${man(gap)}、倍率にすると約${ratio}倍です。`
        + `副操縦士の年収は在籍年数とともに上がり、機長昇格で大きく段が変わります。`,
    },
    {
      q: `${name}のパイロットの月収はいくらですか？`,
      a: `年収を12で割った単純計算では、機長で1か月あたり約${man(cap.avg / 12)}、副操縦士で約${man(fo.avg / 12)}です。`
        + `実際の支給額は月ごとの乗務時間で変動します。賞与のある会社では毎月の支給額はこれより低く、賞与月に上振れします。`,
    },
  ];

  /* 手取りの問。**課税国の社にだけ**置く。
     非課税の社には下の「本当に非課税ですか？」が同じことを答えているので、
     語違いの2問目を作らない。
     ★ 税率は書かない。居住国・扶養・控除で変わるものを一律の割合で出すと
       推測を数字にすることになる（VERIFIED-PILOT.md の原則）。 */
  if (!d.taxFree) {
    items.push({
      q: `${name}のパイロットの手取りはいくらですか？`,
      a: `このページに載せている金額はすべて税引き前（額面）です。機長平均${man(cap.avg)}、副操縦士平均${man(fo.avg)}も額面で、ここから所得税・住民税・社会保険料が引かれます。`
        + `手取りは居住国・扶養・各種控除で変わるため、額面から一律の割合で出すことはできません。`
        + `同じ額面でも、個人所得税の無い国（UAE・カタールなど）の航空会社とは手元に残る額が変わります。`,
    });
  }

  if (d.taxFree) {
    items.push({
      q: `${name}のパイロットの給与は本当に非課税ですか？`,
      a: `${country ? country.ja : '所在国'}には個人所得税が無いため、${name}の給与は額面がほぼそのまま手取りになります。`
        + `機長平均${man(cap.avg)}は、額面と手取りがほぼ同じ額と考えられます。`
        + `日本の航空会社の年収は税引き前の金額なので、同じ額面でも手元に残る金額は大きく変わります。`
        + `なお日本の居住者判定など個人の税務は別途確認が必要です。`,
    });
  }

  /* ANA・JAL と比べる問。
     ⚠️ **相手の数字が出せないときは、差額も倍率も出さない。**
        2026-09-29 まで、ここは「ANA・JALはともに機長平均¥2,700万で、¥200万低い水準です」と
        書いていた。その ¥2,700万 は出どころを確認できず「確認中」になった数字なので、
        引き算の相手に使うと、根拠の無い差が111枚のページに出続ける。
        ★ただし問そのものは消さない。この会社自身の平均は今までどおり出せるので、
          「相手の金額が出せないので差は出していない」と答える。 */
  if (slug !== 'ana' && slug !== 'jal') {
    /* ★2026-09-30、ANA・JAL が「推定」に戻ったので差を出せるようになった。
       ⚠️ ただし呼び方が片方だけ「平均」になると、同じ作り方の数字に別の名前が付く
          （この会社は台帳の外＝平均、ANA・JAL は台帳で推定）。
          なので**この1文では両方とも呼び名を付けず**、末尾で「どちらも公開情報をもとに
          当サイトが出した数字」と書く。名前の食い違いを文章で埋めない。 */
    const anaOk = avgWord('ana', 'cap') && avgWord('ana', 'fo');
    const diff = cap.avg - BASE;
    const cmp = diff === 0 ? 'ほぼ同水準です'
      : diff > 0 ? `${man(diff)}高い水準です`
        : `${man(-diff)}低い水準です`;
    items.push({
      q: `${name}のパイロット年収はANA・JALと比べてどうですか？`,
      a: anaOk
        ? `${name}の機長は${man(cap.avg)}、ANA・JALはともに機長${man(BASE)}で、${cmp}。`
          + `副操縦士は${name}が${man(fo.avg)}、ANA・JALが${man(SALARY.ana.fo.avg)}です。`
          + `どちらも公開情報をもとに当サイトが出した数字です。`
          + (d.taxFree
            ? `ただし${name}は非課税、ANA・JALは税引き前の金額なので、手取りで比べると差はさらに広がります。`
            : `いずれも税引き前の金額どうしの比較です。`)
        : `${name}の機長は平均${man(cap.avg)}、副操縦士は平均${man(fo.avg)}です（いずれも税引き前）。`
          + `ANA・JALの金額は当サイトでは出していないため、差額や倍率はここでは出していません。`
          + (d.taxFree
            ? `なお${name}の所在国には個人所得税が無いため、税引き前で並ぶ日本の会社の金額とは、同じ額面でも手元に残る額が変わります。`
            : ''),
    });
  }

  return items;
}

/* ── 英語・足す問。可視は円（実行時に変換）、LD は変換後と同じ USD ──
   英語ページの既存表記は `¥25M`（＝2,500万）で、生の万表記は使わない。
   月額もその書式に合わせる（208万 → ¥2.08M）。currency.js の 7) `¥N M` が拾う。

   ★ 何を足すかは、既に答えている問を数えてから決めた。英語110枚には
     captain salary / first officer salary / requirements / vs ANA・JAL
     （非課税の社は tax-free も）が既にある。だから
     "How much do {Airline} pilots make?" は上の2問の言い換えにしかならず、足さない。
     まだどこにも答えが無いのは次の2つ:
       ・pay scale（段階別の給与表はページにあるのに、問としては無い）
       ・税引き前か後か（非課税の社にしか税の問が無い）                  */
const manM = (v) => `¥${trimZero((Math.round(v) / 100).toFixed(2))}M`;

/* 英語・等級のある会社。★問文は等級の無い会社と同じ3つに揃える
   （EN_MANAGED が問文の型で前回ぶんを剥がすので、型を増やすと古い問が残る）。 */
function buildEnBasis(slug) {
  const b = BASIS[slug], d = SALARY[slug], name = d.en;
  const acc = accessedJa(slug);
  const items = [];

  const M_KEYS = ['cash_m', 'base_m', 'allow_m_from', 'month'];
  const monthly = (f) => {
    const s = ['cap', 'fo'].map((rank) => figEn(slug, rank, f, M_KEYS)).filter(Boolean).join('; ');
    return s
      ? `${s}. These are the monthly figures the airline publishes, not an annual figure divided by twelve. `
        + `Twelve times the monthly figure does not equal the published annual figure, and we leave both as published. `
        + `A total package that includes housing and school fees divided by twelve is not a monthly salary.`
      : `We do not publish a monthly figure for ${name}. An annual figure divided by twelve is not what lands in a given month — what you are paid moves with the hours you fly.`;
  };
  items.push({ q: `What is ${name} pilot salary per month?`, aHtml: monthly(manM), aLd: monthly(usd) });

  const Y_KEYS = ['cash_y', 'pkg_y', 'max_y', 'target_y', 'cash_y_over', 'reward_y', 'month_x'];
  const scale = (f) => {
    const parts = [];
    for (const rank of ['cap', 'fo']) {
      const r = b[rank];
      if (r.tier === 'estimate') { parts.push(EST_EN(slug, name, RANK_EN[rank], f, rank)); continue; }
      if (r.tier === 'held') { parts.push(HELD_EN(slug, name, RANK_EN[rank])); continue; }
      const y = figEn(slug, rank, f, Y_KEYS);
      if (y) parts.push(`For ${RANK_EN[rank]} we publish a ${TIERS[r.tier].en.toLowerCase()} rather than an average — ${y}. This is not an all-staff average.`);
    }
    if (b.notes_en?.[0]) parts.push(b.notes_en[0]);
    if (acc) parts.push(`Source checked ${acc}; yen figures are converted for comparison at the rate held as of ${FX_AS_OF}, not a live rate.`);
    return parts.join(' ');
  };
  items.push({ q: `What is the ${name} pilot pay scale?`, aHtml: scale(manM), aLd: scale(usd) });

  if (!d.taxFree) {
    const tax = `Every figure on this page is gross, before income tax. `
      + `Take-home depends on where you are resident and on your own deductions, so no single percentage applies, and we do not publish one. `
      + `Airlines based in countries with no personal income tax — the UAE, Qatar, Saudi Arabia — leave more of the same gross figure in your hand.`;
    items.push({ q: `Is ${name} pilot salary before or after tax?`, aHtml: tax, aLd: tax });
  }
  return items;
}

function buildEnExtra(slug) {
  if (hasBasis(slug)) return buildEnBasis(slug);
  const d = SALARY[slug];
  const name = d.en;
  const { cap, fo } = d;
  const capM = Math.round(cap.avg / 12);
  const foM = Math.round(fo.avg / 12);
  const ratio = (cap.avg / fo.avg).toFixed(1);
  const items = [];

  const monthly = `Dividing the annual average by 12, ${name} captains earn about {CAP} a month and first officers about {FO}. `
    + `What actually lands each month moves with block hours flown, and where an annual bonus is paid the regular monthly figure sits lower with a spike in the bonus month.`;
  items.push({
    q: `What is ${name} pilot salary per month?`,
    aHtml: monthly.replace('{CAP}', manM(capM)).replace('{FO}', manM(foM)),
    aLd: monthly.replace('{CAP}', usd(capM)).replace('{FO}', usd(foM)),
  });

  /* 給与表はページ内にある（"Pay Scale by Seniority"）。その段差を数字で言う。 */
  const scale = `${name} first officers average {FO} and captains {CAP} — a step of about {GAP}, or roughly ${ratio}×. `
    + `The full range runs {FOLO} to {CAPHI}, and where you sit inside it is set by seniority, type rating and the routes you fly. `
    + `The seniority table on this page breaks the same range into career stages.`;
  const fill = (f) => scale.replace('{FO}', f(fo.avg)).replace('{CAP}', f(cap.avg))
    .replace('{GAP}', f(cap.avg - fo.avg)).replace('{FOLO}', f(fo.lo)).replace('{CAPHI}', f(cap.hi));
  items.push({
    q: `What is the ${name} pilot pay scale?`,
    aHtml: fill(manM), aLd: fill(usd),
  });

  /* 税引き前か後か。非課税の社には既に tax-free の問があるので置かない。
     ★ 税率は書かない。居住国と控除で変わるものを推測で数字にしない。 */
  if (!d.taxFree) {
    const tax = `Every figure on this page is gross, before income tax. Captains average {CAP} and first officers {FO} pre-tax, `
      + `and income tax, social insurance and any local levies come out of that. `
      + `Take-home depends on where you are resident and on your own deductions, so no single percentage applies. `
      + `Airlines based in countries with no personal income tax — the UAE, Qatar, Saudi Arabia — leave more of the same gross figure in your hand.`;
    items.push({
      q: `Is ${name} pilot salary before or after tax?`,
      aHtml: tax.replace('{CAP}', manM(cap.avg)).replace('{FO}', manM(fo.avg)),
      aLd: tax.replace('{CAP}', usd(cap.avg)).replace('{FO}', usd(fo.avg)),
    });
  }

  return items;
}

/* 前回の実行ぶんを落とすための、管理している問の見分け方。
   文言を変えても重複しないよう、問文そのものではなく型で当てる。 */
const EN_MANAGED = [/pilot salary per month\?$/i, /pilot pay scale\?$/i, /pilot salary before or after tax\?$/i];

/* ── 可視ブロック。ページ側で既に定義されているクラスに乗せる ──────
   glass / section-badge / fade-up は日本語110枚すべてに存在することを確認済み。
   独自CSSを足さないので、ライトテーマもページ側の規則がそのまま効く。 */
function visibleJa(slug, items) {
  const name = SALARY[slug].ja;
  return `<!--PV-FAQ-->
<div class="glass p-8 fade-up">
  <div class="section-badge mb-4">よくある質問</div>
  <h2 class="text-2xl font-bold mb-6">${escHtml(name)}パイロット年収 よくある質問（FAQ）</h2>
  <div class="space-y-4">
${items.map(({ q, a }) => `    <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
      <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">${escHtml(q)}<span class="text-muted text-xl">+</span></summary>
      <div class="px-5 pb-5 text-sm text-muted leading-relaxed">${escHtml(a)}</div>
    </details>`).join('\n')}
  </div>
</div>
<!--/PV-FAQ-->
`;
}

/* 英語は既存の <details> と同じ形（gen_en_airlines.mjs 由来の info-card）に合わせる。 */
function visibleEn({ q, aHtml }) {
  return `<!--PV-FAQ-->
<details class="info-card cursor-pointer">
<summary class="font-semibold">${escHtml(q)}</summary>
<p class="text-sm text-muted mt-3">${escHtml(aHtml)}</p>
</details>
<!--/PV-FAQ-->
`;
}

/* ── 可視FAQを持つページから Q/A を読む ───────────────────────────
   <details> は全ページで FAQ 見出しより後ろにしか無いことを確認済み。
   summary 内の「＋」記号（span）は質問文ではないので先に落とす。 */
function extractVisible(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return [];
  const out = [];
  const re = /<details[^>]*>([\s\S]*?)<\/details>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m.index < at) continue;
    const inner = m[1];
    const s = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    if (!s) continue;
    const q = strip(s[1].replace(/<span[^>]*>[\s\S]*?<\/span>/g, ''));
    const a = strip(inner.slice(s.index + s[0].length));
    if (q.length >= 6 && a.length >= 20) out.push({ q, a });
  }
  return out;
}
/* ★本文のFAQを JavaScript で描いているページから拾う（2026-09-30）。
   スターラックスだけ `const faqs=[{q:"…",a:"…"}, …]` を script の中に持っていて、
   <details> が1つも無い。そのため2026-09-30 まで「対象外」に落ち、
   **本文だけ直して <head> の構造化データが古い数字を持ったまま**になっていた
   （画面は正しく、検索結果とAIの引用だけが古い ── 気づけない形）。
   ⚠️ 中身は素の JavaScript なので JSON.parse できない（鍵に引用符が無い）。
      {q:"…",a:"…"} の組だけを取り出す。答えの中の引用符は 「」 を使っているので
      ASCII の " は現れないが、\" が来ても切れないようにしてある。 */
function extractJsFaqs(html, marker) {
  const at = html.indexOf(marker);
  if (at === -1) return [];
  const out = [];
  for (const m of html.matchAll(/\{\s*q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*"((?:[^"\\]|\\.)*)"\s*\}/g)) {
    const q = strip(m[1]), a = strip(m[2]);
    if (q.length >= 6 && a.length >= 20) out.push({ q, a });
  }
  return out;
}

const strip = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/* ── FAQPage の mainEntity を書き換える ────────────────────────────
   FAQPage は単独タグのことも、BreadcrumbList / Article と同じ配列に
   入っていることもある。script タグごと足したり消したりせず、
   見つけた FAQPage の中身だけ差し替えて他の型を巻き添えにしない。
   mutate(list) が新しい mainEntity を返す。 */
function patchFaqLd(html, mutate) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let json;
    try { json = JSON.parse(m[1]); } catch { continue; }
    const arr = Array.isArray(json) ? json : [json];
    const faq = arr.find((x) => x && x['@type'] === 'FAQPage');
    if (!faq) continue;
    faq.mainEntity = mutate(faq.mainEntity || []);
    const rebuilt = `<script type="application/ld+json">${JSON.stringify(Array.isArray(json) ? arr : arr[0])}</script>`;
    return { html: html.replace(m[0], () => rebuilt), done: true };
  }
  return { html, done: false };
}
const asQuestion = ({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } });

/* 管理ブロックの剥がし。末尾の空行まで食う — 食わないと、ブロックだけ消えて
   前後の改行が毎回1本ずつ残り、再実行のたびにファイルが伸びて冪等でなくなる。
   （差し込み位置の直後は必ず閉じタグなので、意味のある空行を巻き込まない） */
const STRIP = /<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t\n]*/g;
/* 英語は既存の <details> の直後に足すので、こちらが自分で入れた前後の改行も一緒に返す。
   剥がした結果が元のファイルと1バイトも違わないので、何回流しても同じ形に落ち着く。 */
const STRIP_EN = /\n?<!--PV-FAQ-->[\s\S]*?<!--\/PV-FAQ-->[ \t\n]*/g;

/* ── 日本語の差し込み位置。本文コンテナ（max-w-7xl … pb-24）の中の末尾。
      直後にある転職CTAの帯を目印にして、コンテナを閉じる </div> の手前へ。
      110枚すべてに両方あることを確認済み。 */
const CTA = '<div style="background:rgba(249,115,22,.06)';

const report = [];
let jaMade = 0, jaRelinked = 0, enAdded = 0, skipped = 0, failed = 0;

/* ══ 日本語 ═══════════════════════════════════════════════════ */
for (const slug of Object.keys(SALARY)) {
  const abs = path.join(ROOT, 'airlines', `${slug}.html`);
  if (!fs.existsSync(abs)) { report.push(`  ? ja ${slug}: ページが無い`); skipped++; continue; }
  const orig = fs.readFileSync(abs, 'utf8');

  /* まず剥がす。問数が変わっても、SSOT が動いても、同じ扱いで直る。 */
  let html = orig.replace(STRIP, '');

  const existing = extractVisible(html, 'よくある質問');
  let items, mode;
  if (existing.length >= 2) {
    items = existing;
    mode = '本文→LD';
  } else if (/<h2[^>]*>[^<]*よくある質問[^<]*<\/h2>/.test(html)) {
    /* ⚠️ 見出しで判定する。本文のどこかに「よくある質問」の語が在るかで見ると、
         出所の節に「自社養成のよくある質問では…」と書いてあるタイ国際航空が
         ここに落ちて**FAQが二度と作り直されなくなる**（2026-09-30 までそうなっていた。
         画面には前に作ったFAQが残るので、古い文言のままでも気づけない）。 */
    /* 見出しはあるが <details> が無い（starlux はJSで描画）。
       ★script の中の faqs 配列から拾う。拾えないときだけ対象外にする。 */
    const js = extractJsFaqs(html, 'よくある質問');
    if (js.length < 2) {
      report.push(`  - ja ${slug}: 可視FAQがJS描画で読めない。対象外`);
      skipped++;
      continue;
    }
    items = js;
    mode = '本文（JS）→LD';
  } else {
    items = buildJa(slug);
    mode = 'SSOT→本文+LD';
    const cta = html.indexOf(CTA);
    const at = cta === -1 ? -1 : html.lastIndexOf('</div>', cta);
    if (at === -1) { report.push(`  ! ja ${slug}: 差し込み位置が見つからない`); failed++; continue; }
    html = html.slice(0, at) + visibleJa(slug, items) + html.slice(at);
  }

  const r = patchFaqLd(html, () => items.map(asQuestion));
  if (!r.done) { report.push(`  ! ja ${slug}: FAQPage の JSON-LD が見つからない`); failed++; continue; }
  html = r.html;

  if (html !== orig) {
    if (!DRY) fs.writeFileSync(abs, html);
    if (mode.startsWith('本文')) jaRelinked++; else jaMade++;
  }
  report.push(`  ${mode.startsWith('本文') ? '↺' : '＋'} ja ${slug.padEnd(20)} ${String(items.length).padStart(2)}問  ${mode}`);
}

/* ══ 英語 — 月収の1問だけ足す ══════════════════════════════════ */
const EN_ANCHOR = /<h2[^>]*>Frequently Asked Questions<\/h2>/;
for (const slug of Object.keys(SALARY)) {
  const abs = path.join(ROOT, 'en/airlines', `${slug}.html`);
  if (!fs.existsSync(abs)) { skipped++; continue; }
  const orig = fs.readFileSync(abs, 'utf8');
  let html = orig.replace(STRIP_EN, '');

  const at = html.search(EN_ANCHOR);
  if (at === -1) { report.push(`  ! en ${slug}: FAQ の見出しが無い`); failed++; continue; }
  const last = html.lastIndexOf('</details>');
  if (last < at) { report.push(`  ! en ${slug}: FAQ の <details> が無い`); failed++; continue; }

  const extra = buildEnExtra(slug);
  const pos = last + '</details>'.length;
  html = html.slice(0, pos) + '\n' + extra.map(visibleEn).join('') + html.slice(pos);

  /* 既に入っている管理下の問（前回の実行ぶん）は落としてから足す。文言を変えても重複しない。 */
  const r = patchFaqLd(html, (list) => [
    ...list.filter((x) => !EN_MANAGED.some((re) => re.test(x && x.name || ''))),
    ...extra.map((it) => asQuestion({ q: it.q, a: it.aLd })),
  ]);
  if (!r.done) { report.push(`  ! en ${slug}: FAQPage の JSON-LD が見つからない`); failed++; continue; }
  html = r.html;

  if (html !== orig) { if (!DRY) fs.writeFileSync(abs, html); enAdded++; }
  report.push(`  ＋ en ${slug.padEnd(20)} ${extra.length}問追加`);
}

console.log(report.join('\n'));
console.log(`\n${DRY ? '[dry-run] ' : ''}日本語: 可視FAQを新設 ${jaMade}枚 ／ 既存FAQに構造化データを合わせた ${jaRelinked}枚`);
console.log(`${DRY ? '[dry-run] ' : ''}英語:   月収・給与表・税引き前後の問を追加 ${enAdded}枚`);
console.log(`${DRY ? '[dry-run] ' : ''}対象外 ${skipped}枚 ／ 失敗 ${failed}枚`);
if (failed) process.exitCode = 1;
