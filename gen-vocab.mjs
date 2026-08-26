/* ════════════════════════════════════════════════════════════════
   gen-vocab.mjs
   SSOT（pv-vocab.mjs）から入力語彙を生成する。

     pv-vocab.mjs ──┬─→ pv-vocab.json           （ブラウザ用・給与レポートが読む）
                    ├─→ submit-review.html      #f-fleet / #f-jobrole
                    └─→ en/submit-review.html   同上

   会社名は gen-airline-codes.mjs（SSOT = salary-data.mjs）が担当。
   ここは機種・職位・役職・年代・住居・契約形態・通貨。

   実行: node gen-vocab.mjs
════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'fs';
import {
  FLEETS, POSITIONS, LEGACY_POSITIONS, JOB_ROLES, AGE_BUCKETS, HOUSING, CONTRACT_TYPES, CURRENCIES,
  COUNTRIES, COUNTRIES_MAIN, TAX_DEFAULT_ZERO, CITIZENSHIP_TAXED, TAX_TABLE,
} from './pv-vocab.mjs';
import { JPY_PER, AS_OF as FX_AS_OF, SOURCE as FX_SOURCE } from './fx-rates.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── 検品（コード重複・欠けをここで落とす）─────────────────────
function checkCodes(name, list) {
  const codes = list.map((x) => x.code);
  if (new Set(codes).size !== codes.length) throw new Error(`${name}: コードが重複`);
  for (const x of list) {
    if (!x.ja || !x.en) throw new Error(`${name}: ja/en が欠けている → ${x.code}`);
  }
  return codes;
}
checkCodes('FLEETS', FLEETS);
checkCodes('POSITIONS', POSITIONS);
checkCodes('JOB_ROLES', JOB_ROLES);
checkCodes('AGE_BUCKETS', AGE_BUCKETS);
checkCodes('HOUSING', HOUSING);
checkCodes('CONTRACT_TYPES', CONTRACT_TYPES);
checkCodes('CURRENCIES', CURRENCIES);

for (const c of CURRENCIES) {
  if (!/^[A-Z]{3}$/.test(c.code)) throw new Error(`ISO 4217 でない: ${c.code}`);
  if (![0, 2, 3].includes(c.dec)) throw new Error(`小数桁が変: ${c.code}`);
}
for (const [from, to] of Object.entries(LEGACY_POSITIONS)) {
  if (!POSITIONS.some((p) => p.code === to)) throw new Error(`旧職位の寄せ先が無い: ${from}→${to}`);
  if (POSITIONS.some((p) => p.code === from)) throw new Error(`旧職位が現役と衝突: ${from}`);
}

/* 年代の刻みの検品。口コミ（submit-review.html の #f-age）は5歳刻みで先に集めており、
   給与レポートは10歳刻み。**5歳刻みが10歳刻みにきれいに収まる**あいだは、あとから
   2つのデータを同じ軸で並べられる。片方の境目をずらした瞬間にそれができなくなるので、
   ずらしたことに気づける形で止める。 */
{
  const rev = readFileSync(new URL('./submit-review.html', import.meta.url), 'utf8');
  const sel = rev.match(/<select[^>]*id="f-age"[^>]*>([\s\S]*?)<\/select>/);
  if (!sel) throw new Error('submit-review.html の #f-age が見つからない（口コミ側の年代が消えた？）');
  const span = (c) => (c.endsWith('+') ? [Number(c.slice(0, -1)), Infinity] : c.split('-').map(Number));
  const buckets = AGE_BUCKETS.map((b) => span(b.code));
  for (const [lo, hi] of buckets) if (!(hi >= lo)) throw new Error('AGE_BUCKETS: 上下が逆の段がある');
  for (const m of sel[1].matchAll(/<option value="([^"]+)"/g)) {
    const [lo, hi] = span(m[1]);
    if (!buckets.some(([blo, bhi]) => lo >= blo && hi <= bhi)) {
      throw new Error(`口コミの年代 ${m[1]} が AGE_BUCKETS のどの段にも収まらない（2つのデータを混ぜられなくなる）`);
    }
  }
}

/* 国コードの検品。名前を持たない代わりに、実在するかどうかを node の ICU に
   聞いて機械的に落とす。打ち間違えた 'JN' はここで止まる（止めないと利用者の
   画面に生の 'JN' がそのまま並ぶ）。 */
const REGION_JA = new Intl.DisplayNames(['ja'], { type: 'region' });
const REGION_EN = new Intl.DisplayNames(['en'], { type: 'region' });
if (new Set(COUNTRIES).size !== COUNTRIES.length) throw new Error('COUNTRIES: コードが重複');
for (const c of COUNTRIES) {
  if (!/^[A-Z]{2}$/.test(c)) throw new Error(`ISO 3166-1 alpha-2 でない: ${c}`);
  if (REGION_JA.of(c) === c || REGION_EN.of(c) === c) throw new Error(`実在しない国コード: ${c}`);
}
for (const [name, list] of [['TAX_DEFAULT_ZERO', TAX_DEFAULT_ZERO], ['CITIZENSHIP_TAXED', CITIZENSHIP_TAXED]]) {
  for (const c of list) if (!COUNTRIES.includes(c)) throw new Error(`${name}: COUNTRIES に無い国 → ${c}`);
}

/* 「よく選ばれる国」の検品。★ja と en は順番だけが違い、中身は同じでなければ
   ならない。片方にだけ国を足すと、日本語では選べて英語では選べない国ができる。
   重複も落とす（同じ国が上と下の両方に出ると、選んだつもりが別の option になる）。 */
{
  const ja = COUNTRIES_MAIN.ja, en = COUNTRIES_MAIN.en;
  for (const [lang, list] of Object.entries(COUNTRIES_MAIN)) {
    if (new Set(list).size !== list.length) throw new Error(`COUNTRIES_MAIN.${lang}: コードが重複`);
    for (const c of list) if (!COUNTRIES.includes(c)) throw new Error(`COUNTRIES_MAIN.${lang}: COUNTRIES に無い国 → ${c}`);
  }
  const only = (a, b) => a.filter((c) => !b.includes(c));
  if (only(ja, en).length || only(en, ja).length) {
    throw new Error(`COUNTRIES_MAIN: ja と en で中身が違う → ja のみ ${only(ja, en)} / en のみ ${only(en, ja)}`);
  }
}

/* 税率表の検品。★税務当局の出所（src）が無いものは載せない。
   段の上限は昇順で、最後は必ず null（上限なし）で閉じる。閉じ忘れると
   高額所得者の年収がどの段にも当たらず、税率が黙って null になる。 */
for (const [code, t] of Object.entries(TAX_TABLE)) {
  if (!COUNTRIES.includes(code)) throw new Error(`TAX_TABLE: COUNTRIES に無い国 → ${code}`);
  if (TAX_DEFAULT_ZERO.includes(code)) throw new Error(`TAX_TABLE: 0%の国に税率表がある → ${code}`);
  if (!/^[A-Z]{3}$/.test(t.cur || '')) throw new Error(`TAX_TABLE.${code}: cur が ISO 4217 でない`);
  if (!CURRENCIES.some((c) => c.code === t.cur)) throw new Error(`TAX_TABLE.${code}: 語彙に無い通貨 → ${t.cur}`);
  if (!Array.isArray(t.src) || !t.src.length) throw new Error(`TAX_TABLE.${code}: 出所（src）が無い`);
  for (const u of t.src) if (!/^https:\/\//.test(u)) throw new Error(`TAX_TABLE.${code}: src が https でない → ${u}`);
  for (const key of ['emp', 'basic', 'quick', 'bands']) {
    const tbl = t[key];
    if (!tbl) continue;
    let prev = 0;
    tbl.forEach((row, i) => {
      const cap = row[0];
      if (cap === null) {
        if (i !== tbl.length - 1) throw new Error(`TAX_TABLE.${code}.${key}: null が最後の段でない`);
      } else {
        if (!(cap > prev)) throw new Error(`TAX_TABLE.${code}.${key}: 上限が昇順でない → ${cap}`);
        prev = cap;
      }
    });
    if (tbl[tbl.length - 1][0] !== null) throw new Error(`TAX_TABLE.${code}.${key}: 最後の段が null で閉じていない`);
  }
}

/* 画面に配るのは税率表の「数字」だけ。出所（src）と取得日は配らない。
   SALARY に src を足さない理由と同じで、生成物は公開ファイルになる。
   出所を確かめたい人は pv-vocab.mjs（配信対象外）を見る。 */
const taxPublic = Object.fromEntries(
  Object.entries(TAX_TABLE).map(([code, t]) => {
    const { src, as_of, ...rest } = t;   // eslint-disable-line no-unused-vars
    return [code, rest];
  }),
);

// ── 1. ブラウザ用 JSON ─────────────────────────────────────────
const json = {
  fleets: FLEETS, positions: POSITIONS, legacyPositions: LEGACY_POSITIONS,
  jobRoles: JOB_ROLES, ageBuckets: AGE_BUCKETS,
  housing: HOUSING, contractTypes: CONTRACT_TYPES, currencies: CURRENCIES,
  countries: COUNTRIES, countriesMain: COUNTRIES_MAIN,
  taxZero: TAX_DEFAULT_ZERO, citizenshipTaxed: CITIZENSHIP_TAXED, taxTable: taxPublic,
};
writeFileSync(new URL('./pv-vocab.json', import.meta.url), JSON.stringify(json));
console.log(`✅ pv-vocab.json 書き出し: 機種${FLEETS.length} / 職位${POSITIONS.length} / 役職${JOB_ROLES.length} / 年代${AGE_BUCKETS.length} / 通貨${CURRENCIES.length} / 国${COUNTRIES.length}`);

// ── 2. 機種 select（cat でグループ分け）────────────────────────
const FLEET_GROUPS = {
  ja: { n:'ナローボディ（国内・近距離）', w:'ワイドボディ（国際・長距離）',
        r:'リージョナル・ターボプロップ', _:'その他' },
  en: { n:'Narrowbody (domestic / short-haul)', w:'Widebody (international / long-haul)',
        r:'Regional & turboprop', _:'Other' },
};

function fleetOptions(lang, pad) {
  const out = [];
  for (const cat of ['n', 'w', 'r', '_']) {
    const members = FLEETS.filter((f) => (f.cat || '_') === cat);
    if (!members.length) throw new Error(`機種が1つも無いグループ: ${cat}`);
    out.push(`${pad}<optgroup label="${esc(FLEET_GROUPS[lang][cat])}">`);
    for (const f of members) out.push(`${pad}  <option value="${f.code}">${esc(f[lang])}</option>`);
    out.push(`${pad}</optgroup>`);
  }
  return out.join('\n');
}

function listOptions(list, lang, pad) {
  return list.map((r) => `${pad}<option value="${r.code}">${esc(r[lang])}</option>`).join('\n');
}

/* 通貨は「AED — UAEディルハム」の形。明細に印字されているのはコードなので、
   コードを先に出さないと自分の通貨を探せない。 */
function currencyOptions(lang, pad) {
  return CURRENCIES.map((c) => `${pad}<option value="${c.code}">${c.code} — ${esc(c[lang])}</option>`).join('\n');
}

/* 国はコードだけ書き出し、表示名はブラウザの Intl.DisplayNames に出させる
   （ここで和名・英名を焼き込むと、国名の2つ目の SSOT ができる）。
   value=コード、テキストは保険としてこちらの ICU 名を入れておく。

   ★2段に分ける。244件を名前順に並べただけの select は、実際に住んでいる国を
     探すのに30回スクロールさせる。上に「よく選ばれる国」を出し、残りは下の
     optgroup に畳む。選択肢そのものは1つも減らさない。 */
const COUNTRY_GROUPS = {
  ja: { main: 'よく選ばれる国', rest: 'その他の国' },
  en: { main: 'Commonly selected', rest: 'All other countries' },
};

function countryOptions(lang, pad) {
  const dn = lang === 'ja' ? REGION_JA : REGION_EN;
  const main = COUNTRIES_MAIN[lang];
  const rest = COUNTRIES.filter((c) => !main.includes(c))
    .sort((a, b) => dn.of(a).localeCompare(dn.of(b), lang));
  const opt = (c) => `${pad}  <option value="${c}">${esc(dn.of(c))}</option>`;
  /* ★data-keep-order は「ブラウザ側で並べ替えるな」の印。上の段は
     "日本語なら日本を先頭に" という意味のある順番なので、名前順に直されると
     並べた意味が消える。下の段だけ利用者の言語で名前順にする。 */
  return [
    `${pad}<optgroup label="${esc(COUNTRY_GROUPS[lang].main)}" data-keep-order>`,
    ...main.map(opt),
    `${pad}</optgroup>`,
    `${pad}<optgroup label="${esc(COUNTRY_GROUPS[lang].rest)}">`,
    ...rest.map(opt),
    `${pad}</optgroup>`,
  ].join('\n');
}

/* select の中身だけ差し替える。開きタグとプレースホルダ
   （<option value="">…）は各ページの文言を保つため触らない。
   ★プレースホルダ直後の改行は group 1 に含めない。含めると、まだ空の select
   （新規ページの初回生成）で末尾の `\n</select>` が食われて一致しなくなる。 */
function patch(path, id, build, want) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');
  const re = new RegExp(
    `(<select[^>]*id="${id}"[^>]*>\\s*\\n(\\s*)<option value="">[^<]*</option>)([\\s\\S]*?)(\\n\\s*</select>)`,
  );
  const m = html.match(re);
  if (!m) throw new Error(`#${id} の select が見つからない: ${path}`);

  const next = html.replace(re, (_, head, pad, __, tail) => head + '\n' + build(pad) + tail);

  const b = next.match(re);
  const n = [...(b[1] + b[3]).matchAll(/<option value="/g)].length;
  if (n !== want + 1) throw new Error(`option 数が合わない: ${path}#${id} → ${n} != ${want + 1}`);

  writeFileSync(url, next);
  return n;
}

/* 役職・区分だけは select ではなく「チェックボックス群」（複数選択）。
   ★選ばれた値は同じ id を持つ hidden 入力にカンマ区切りで書き戻される（画面側の JS）。
     こうすると filled('f-jobrole') / val('f-jobrole') / 必須の印が今までどおり動き、
     変わるのは見た目だけになる。
   ⚠️ 差し替える範囲は <!--BEGIN:BOXES:id--> 〜 <!--END:BOXES:id-->。
     patchMap と同じ考え方で、外側の枠（説明文・aria）はページ側の文言を保つ。 */
function roleBoxes(lang, pad) {
  return JOB_ROLES.map((r) =>
    `${pad}<label class="rolebox"><input type="checkbox" name="f-jobrole" value="${r.code}">`
    + `<span>${esc(r[lang])}</span></label>`).join('\n');
}

function patchBoxes(path, id, build, want) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');
  const re = new RegExp(
    `(^([ \\t]*)<!--BEGIN:BOXES:${id}-->\\n)([\\s\\S]*?)(^[ \\t]*<!--END:BOXES:${id}-->)`, 'm');
  if (!re.test(html)) throw new Error(`#${id} のチェックボックス枠が見つからない: ${path}`);

  // ★replace の第2引数は必ず関数（文字列だと $ が置換パターンとして解釈される）。
  const next = html.replace(re, (_, head, pad, __, tail) => head + build(pad) + '\n' + tail);

  const block = next.match(re)[0];
  const n = [...block.matchAll(new RegExp(`name="${id}" value="`, 'g'))].length;
  if (n !== want) throw new Error(`チェックボックスの数が合わない: ${path}#${id} → ${n} != ${want}`);

  writeFileSync(url, next);
  return n;
}

// ── 3. 確認画面のラベル表 ──────────────────────────────────────
const jsKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const jsStr = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/* 機種を細分化した以上、ここも一緒に増やさないと確認画面に 'a220' と生で出る。
   マーカーが無い初回は既存の定義ごと置き換える。 */
function patchMap(path, name, list, lang) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');
  const body = list.map((x) => `  ${jsKey(x.code)}: ${jsStr(x[lang])},`).join('\n');
  const lit = [
    `/*BEGIN:${name}*/const ${name} = {`,
    '  // ★手で書かない。node gen-vocab.mjs が pv-vocab.mjs から生成する。',
    body,
    `};/*END:${name}*/`,
  ].join('\n');

  // 既存の定義は1行のものと複数行のものが混在しているので、どちらも拾う。
  const re = new RegExp(`\\/\\*BEGIN:${name}\\*\\/[\\s\\S]*?\\/\\*END:${name}\\*\\/|const ${name} = \\{[\\s\\S]*?\\};`);
  if (!re.test(html)) throw new Error(`${name} が見つからない: ${path}`);

  // ★replace の第2引数に文字列を渡さない（関数で渡す）。文字列だと $' $& $1 が
  //   置換パターンとして解釈され、生成物に $ が含まれた瞬間に壊れる。実際 CUR_META の
  //   USD 記号 '$' が $' と読まれ、ファイル末尾全部が13回複製された。
  const next = html.replace(re, () => lit);
  const block = next.match(new RegExp(`\\/\\*BEGIN:${name}\\*\\/[\\s\\S]*?\\/\\*END:${name}\\*\\/`))[0];
  const n = (block.match(/^  [^ /]/gm) || []).length;
  if (n !== list.length) throw new Error(`${name} の件数が合わない: ${path} → ${n} != ${list.length}`);

  writeFileSync(url, next);
  return n;
}

for (const [path, lang] of [['./submit-review.html', 'ja'], ['./en/submit-review.html', 'en']]) {
  const f = patch(path, 'f-fleet', (pad) => fleetOptions(lang, pad), FLEETS.length);
  const r = patchBoxes(path, 'f-jobrole', (pad) => roleBoxes(lang, pad), JOB_ROLES.length);
  const fl = patchMap(path, 'FLEET_LABELS', FLEETS, lang);
  const rl = patchMap(path, 'ROLE_LABELS', JOB_ROLES, lang);
  console.log(`✅ ${path.replace('./', '')} → #f-fleet ${f} option / #f-jobrole ${r} 択、FLEET_LABELS ${fl} / ROLE_LABELS ${rl} 件`);
}

// ── 3-2. 給与レポート（select が8本。ラベル表は持たない）──────
// 会社（#f-airline）は gen-airline-codes.mjs の担当。ここでは触らない。
const PAY_SELECTS = [
  ['f-position',    (lang, pad) => listOptions(POSITIONS, lang, pad),       POSITIONS.length],
  ['f-fleet',       (lang, pad) => fleetOptions(lang, pad),                 FLEETS.length],
  ['f-currency',    (lang, pad) => currencyOptions(lang, pad),              CURRENCIES.length],
  ['f-housing',     (lang, pad) => listOptions(HOUSING, lang, pad),         HOUSING.length],
  ['f-contract',    (lang, pad) => listOptions(CONTRACT_TYPES, lang, pad),  CONTRACT_TYPES.length],
  ['f-age',         (lang, pad) => listOptions(AGE_BUCKETS, lang, pad),    AGE_BUCKETS.length],
  // 国籍（f-nationality）は 2026-08-12 に廃止。居住国だけ聞く。
  ['f-taxcountry',  (lang, pad) => countryOptions(lang, pad),               COUNTRIES.length],
];

/* 画面側のロジックが要る定数（通貨の小数桁・記号、税0%の既定値、市民権課税）。
   ここを手で書くと、通貨を足したときに必ず片方だけ古くなる。 */
function patchMeta(path) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');
  const cur = CURRENCIES.map((c) => `${c.code}:[${c.dec},${jsStr(c.sym)}]`).join(',');
  const arr = (a) => '[' + a.map(jsStr).join(',') + ']';
  const lit = [
    '/*BEGIN:PVMETA*/',
    `const CUR_META = {${cur}};`,
    `const TAX_ZERO = ${arr(TAX_DEFAULT_ZERO)};`,
    `const CITIZEN_TAX = ${arr(CITIZENSHIP_TAXED)};`,
    `const TAX_TABLE = ${JSON.stringify(taxPublic)};`,
    '/*END:PVMETA*/',
  ].join('\n');
  const re = /\/\*BEGIN:PVMETA\*\/[\s\S]*?\/\*END:PVMETA\*\//;
  if (!re.test(html)) throw new Error(`PVMETA マーカーが無い: ${path}`);

  // ★ここは通貨記号 '$' を書き込む。文字列で replace すると $' が「マッチの後ろ全部」
  //   と解釈され、ファイル末尾が丸ごと複製される（実際に起きた）。必ず関数で渡す。
  const next = html.replace(re, () => lit);

  // 生成ブロックが literal と一字一句同じであることを確かめる（複製の再発検知）。
  const got = next.match(re)[0];
  if (got !== lit) throw new Error(`PVMETA の書き込みが壊れている: ${path} → ${got.length} chars`);

  writeFileSync(url, next);
  return CURRENCIES.length;
}

for (const [path, lang] of [['./pay-report.html', 'ja'], ['./en/pay-report.html', 'en']]) {
  const got = PAY_SELECTS.map(([id, build, want]) => `${id} ${patch(path, id, (pad) => build(lang, pad), want)}`);
  // 役職・区分は複数選択なので select ではない（上の patchBoxes を参照）。
  const roles = patchBoxes(path, 'f-jobrole', (pad) => roleBoxes(lang, pad), JOB_ROLES.length);
  const meta = patchMeta(path);
  console.log(`✅ ${path.replace('./', '')} → ${got.join(' / ')} / f-jobrole ${roles} 択、CUR_META ${meta} 通貨`);
}

// ── 4. DB 側の語彙マスタ ───────────────────────────────────────
// pay_reports が外部キーで参照する。SQL からは pv-vocab.mjs を読めないので流し込む。
{
  const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const rows = (list, cols) => list.map((x) => `  (${cols.map((c) => c(x)).join(', ')})`).join(',\n');

  /* 換算レートは fx-rates.mjs（node gen-fx-rates.mjs が作る45通貨）が唯一の正。
     2026-08-22 まではここで currency.js の RATES を読んでいたが、それは
     サイトの通貨切替に出す7通貨しか無く、残り38通貨で出した人は to_usd が
     無いまま集計から黙って外れていた（エバー航空の台湾ドル）。 */
  const USD_JPY = JPY_PER.USD;
  if (!USD_JPY) throw new Error('fx-rates.mjs に USD が無い');
  for (const c of Object.keys(JPY_PER)) {
    if (!CURRENCIES.some((x) => x.code === c)) throw new Error(`fx-rates.mjs にあって語彙に無い通貨: ${c}`);
  }
  for (const c of CURRENCIES) {
    if (!(JPY_PER[c.code] > 0)) throw new Error(`語彙にあってレートが無い通貨: ${c.code}（node gen-fx-rates.mjs）`);
  }

  /* サイトの表示（currency.js）と DB の集計（fx_rates）が同じ数字を使っていること。
     currency.js は非ESモジュールなので import できない。数値だけ突き合わせる。 */
  const cjs = readFileSync(new URL('./currency.js', import.meta.url), 'utf8');
  const mm = cjs.match(/var RATES = \{([^}]*)\};/);
  if (!mm) throw new Error('currency.js の RATES が読めない（形が変わった？）');
  for (const kv of mm[1].split(',')) {
    const [k, v] = kv.split(':').map((x) => x.trim());
    if (!/^[A-Z]{3}$/.test(k) || !(Number(v) > 0)) throw new Error(`RATES の要素が変: ${kv}`);
    if (Number(v) !== JPY_PER[k]) {
      throw new Error(`currency.js の ${k}=${v} が fx-rates.mjs の ${JPY_PER[k]} と違う（node gen-fx-rates.mjs で揃える）`);
    }
  }

  const fxRows = Object.entries(JPY_PER)
    .map(([c, jpy]) => `  (${q(c)}, ${(jpy / USD_JPY).toFixed(6)}, ${jpy.toFixed(6)})`)
    .join(',\n');

  const sql = `-- ════════════════════════════════════════════════════════════════
-- db/vocab.generated.sql — ★自動生成。手で編集しない。
--   生成元: pv-vocab.mjs（語彙）＋ currency.js（換算レート）
--   再生成: node gen-vocab.mjs
--
-- pay_reports が参照する語彙マスタ。何度流しても安全（upsert）。
-- 語彙から消えたコードは無効化するだけで消さない（過去の投稿が参照している）。
-- ════════════════════════════════════════════════════════════════

-- cat は 'other'（どれにも当てはまらない機材）だけ null を許す。
-- salary-leveling.js の r/n/w と同じ語彙。
create table if not exists public.pv_fleets (
  code text primary key, cat text check (cat is null or cat in ('r','n','w')),
  name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_positions (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_job_roles (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
-- 年代。刻みは10歳。口コミ（reviews_v2.age_bucket）は5歳刻みで先に集めており、
-- '20-24' + '25-29' = '20-29' のように、こちらの段へちょうど畳める形にしてある。
create table if not exists public.pv_age_buckets (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_housing_types (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_contract_types (
  code text primary key, name_ja text not null, name_en text not null, active boolean not null default true
);
create table if not exists public.pv_currencies (
  code char(3) primary key, dec smallint not null check (dec in (0,2,3)),
  sym text not null, name_ja text not null, name_en text not null, active boolean not null default true
);

insert into public.pv_fleets (code, cat, name_ja, name_en) values
${rows(FLEETS, [(x) => q(x.code), (x) => q(x.cat), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set cat = excluded.cat, name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_positions (code, name_ja, name_en) values
${rows(POSITIONS, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_job_roles (code, name_ja, name_en) values
${rows(JOB_ROLES, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_age_buckets (code, name_ja, name_en) values
${rows(AGE_BUCKETS, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_housing_types (code, name_ja, name_en) values
${rows(HOUSING, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_contract_types (code, name_ja, name_en) values
${rows(CONTRACT_TYPES, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

insert into public.pv_currencies (code, dec, sym, name_ja, name_en) values
${rows(CURRENCIES, [(x) => q(x.code), (x) => String(x.dec), (x) => q(x.sym), (x) => q(x.ja), (x) => q(x.en)])}
on conflict (code) do update set dec = excluded.dec, sym = excluded.sym,
  name_ja = excluded.name_ja, name_en = excluded.name_en, active = true;

update public.pv_fleets    set active = false where code not in (${FLEETS.map((x) => q(x.code)).join(', ')});
update public.pv_positions set active = false where code not in (${POSITIONS.map((x) => q(x.code)).join(', ')});
update public.pv_job_roles set active = false where code not in (${JOB_ROLES.map((x) => q(x.code)).join(', ')});
update public.pv_age_buckets set active = false where code not in (${AGE_BUCKETS.map((x) => q(x.code)).join(', ')});
update public.pv_housing_types  set active = false where code not in (${HOUSING.map((x) => q(x.code)).join(', ')});
update public.pv_contract_types set active = false where code not in (${CONTRACT_TYPES.map((x) => q(x.code)).join(', ')});
update public.pv_currencies set active = false where code not in (${CURRENCIES.map((x) => q(x.code)).join(', ')});

-- ── 換算レート ───────────────────────────────────────────────
-- ★ fx-rates.mjs（1通貨あたりの円。USD 1 = ${USD_JPY} 円）から生成。
--    基準日 ${FX_AS_OF} / 出所 ${FX_SOURCE} / 取り直しは node gen-fx-rates.mjs。
-- ★ 語彙の ${CURRENCIES.length} 通貨すべてにレートがある（2026-08-22 に7→${Object.keys(JPY_PER).length}）。
--    レートが無い通貨で出すと to_usd が無く annual_total_usd が null になり、
--    pay_benchmarks から黙って外れる。実際にエバー航空の台湾ドルが1件外れていた。
--    原本（currency ＋ 各金額）は必ず保存されるので、レートを入れた時点で再計算できる。
create table if not exists public.fx_rates (
  code   char(3) primary key references public.pv_currencies(code),
  to_usd numeric(14,6) not null check (to_usd > 0),
  to_jpy numeric(14,6) not null check (to_jpy > 0),
  as_of  date not null default current_date
);

insert into public.fx_rates (code, to_usd, to_jpy) values
${fxRows}
on conflict (code) do update
  set to_usd = excluded.to_usd, to_jpy = excluded.to_jpy, as_of = current_date;

-- ── レートが無くて集計から外れていた行を戻す ──────────────────
-- レートが無い通貨で出した行は annual_total_usd が null になり、pay_benchmarks の
-- 対象から外れる（提出は成功しているので本人には見えている）。原本の
-- annual_total_orig と currency は残っているので、レートが入った今なら計算し直せる。
-- ★ null の行だけを触る＝何度流しても同じ。既に入っている行のレートは書き替えない
--   （提出時点のレートで確定させる。あとから全部を今日のレートに揃えると、
--     過去の集計が流すたびに動いて再現しなくなる）。
-- ★ pay_reports がまだ無い環境（語彙を先に流す）でも落ちないように包む。
do $$
declare n int;
begin
  if to_regclass('public.pay_reports') is null then
    raise notice 'pay_reports がまだ無いので取りこぼしの復旧はしない';
    return;
  end if;

  with fixed as (
    update public.pay_reports r
       set fx_to_usd = f.to_usd,
           fx_to_jpy = f.to_jpy,
           fx_at     = f.as_of,
           annual_total_usd = round(r.annual_total_orig * f.to_usd, 2),
           annual_total_jpy = round(r.annual_total_orig * f.to_jpy, 2),
           usd_per_block_hour = case when coalesce(r.block_hours, 0) > 0
                then round(round(r.annual_total_orig * f.to_usd, 2) / (12 * r.block_hours), 2) end,
           net_annual_jpy = case when r.tax_rate_pct is not null
                then round(round(r.annual_total_orig * f.to_jpy, 2) * (1 - r.tax_rate_pct / 100), 2) end
      from public.fx_rates f
     where f.code = r.currency
       and r.annual_total_usd is null
       and r.annual_total_orig is not null
    returning 1)
  select count(*) into n from fixed;

  raise notice '取りこぼしを復旧: % 件', n;
end $$;

-- 語彙は誰でも読める（フォームのラベルに使う）。書き込みポリシーは作らない。
do $$
declare t text;
begin
  foreach t in array array['pv_fleets','pv_positions','pv_job_roles','pv_age_buckets',
                           'pv_housing_types','pv_contract_types','pv_currencies','fx_rates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- 検算：機種${FLEETS.length} / 職位${POSITIONS.length} / 役職${JOB_ROLES.length} / 年代${AGE_BUCKETS.length} / 通貨${CURRENCIES.length} / レート${Object.keys(JPY_PER).length}
select
  (select count(*) from public.pv_fleets     where active) as 機種,
  (select count(*) from public.pv_positions  where active) as 職位,
  (select count(*) from public.pv_job_roles  where active) as 役職,
  (select count(*) from public.pv_age_buckets where active) as 年代,
  (select count(*) from public.pv_currencies where active) as 通貨,
  (select count(*) from public.fx_rates)                   as レート;
`;
  writeFileSync(new URL('./db/vocab.generated.sql', import.meta.url), sql);
  console.log(`✅ db/vocab.generated.sql 書き出し: 機種${FLEETS.length} / 職位${POSITIONS.length} / 役職${JOB_ROLES.length} / 年代${AGE_BUCKETS.length} / 通貨${CURRENCIES.length} / レート${Object.keys(JPY_PER).length}`);
}
