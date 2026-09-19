/* ════════════════════════════════════════════════════════════════
   gen-airline-codes.mjs
   会社の選択肢と DB 側の会社マスタを、2つの名簿から生成する。

     salary-data.mjs の SALARY ─┐   年収がある社（会社ページを持つ）
     airline-ops.mjs  の OPS  ─┴─→ ALL（合流）
                                    ├─→ airline-codes.json     （全社 ＋ other）
                                    ├─→ pv-airlines.json       （画面が社名を引く辞書）
                                    ├─→ submit-review.html    #f-airline ＋ AIRLINE_LABELS
                                    ├─→ en/submit-review.html #f-airline ＋ AIRLINE_LABELS
                                    ├─→ pay-report.html       #f-airline
                                    ├─→ en/pay-report.html    #f-airline
                                    ├─→ db/airlines.generated.sql（pv_airlines 表）
                                    └─→ pv-reunlock.js FALLBACK_CODES

   ★向きが以前と逆。以前は submit-review.html を読んで JSON を作っていたため、
     HTML の 35 社が事実上の正になり、SSOT の 110 社と乖離していた。
     結果、75 社のパイロットは「その他」で自由入力するしかなく、
     社名が会社ページと結合できない＝集計できない行になっていた。
     社名は名簿から生成し、手で書かない。

   ★なぜ名簿が2つあるか（2026-09-13）
     SALARY は「年収の唯一の正」。小規模航空会社・チャーター会社・
     ビジネスジェット運航会社は公開年収が無く、SALARY に入れると
     推測の数値を書くか、会社ページの無い社を数え始めることになる。
     「年収がある社」と「投稿できる社」を分けた。詳細は airline-ops.mjs の冒頭。

   ★社名の衝突検査（下の checkNameCollisions）
     pv_airline_resolve（db/pay-rows.sql:668）は7つの名前で完全一致を取り、
     複数当たったら code の若い順に1つ選ぶ。つまり別法人どうしの社名が
     正規化後に一致すると、片方の会社の投稿が黙ってもう片方に混ざる。
     ここで例外にして止める。

   airline-codes.json の用途: ログイン/OAuth コールバック時の「再解放」照合。
   reviews_v2 は匿名（proof_hash）で user_id を持たないため
   「この人の全口コミ」を直接引けない。代わりに投稿可能な全社コードの
   proof_hash を計算して照合する（pv-reunlock.js）。

   実行: node gen-airline-codes.mjs
════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'fs';
import { SALARY } from './salary-data.mjs';
import { OPS } from './airline-ops.mjs';

/* --check … 書き出さずに検査だけ流す（gen-fx-rates.mjs と同じ作法）。
   PV_OPS_INJECT は --check のときだけ効く検査用の注入口で、
   assert-generated.mjs が「社名の衝突検査が本当に落ちるか」を試すのに使う。
   書き出しの経路では絶対に効かない（偽の会社が生成物に混ざらないように）。 */
const CHECK = process.argv.includes('--check');
const INJECT = (CHECK && process.env.PV_OPS_INJECT) ? JSON.parse(process.env.PV_OPS_INJECT) : null;

const ALL = { ...SALARY, ...OPS, ...(INJECT || {}) };
const KEYS = Object.keys(ALL);

// ── 地域グループ。語彙は world-airlines.html の data-region と同一 ──
// JP は日本の読者が多いので日本から、EN は最初の主戦場（湾岸・契約市場）から並べる。
const GROUPS = {
  ja: {
    order: ['japan', 'mideast', 'asia', 'europe', 'us', 'oceania', 'latam', 'africa'],
    label: { japan:'日本', mideast:'中東', asia:'アジア', europe:'欧州',
             us:'北米', oceania:'オセアニア', latam:'中南米', africa:'アフリカ' },
    other: '一覧にない会社',
    otherLabel: 'その他（自分で入力）',
  },
  en: {
    order: ['mideast', 'asia', 'europe', 'us', 'oceania', 'latam', 'africa', 'japan'],
    label: { mideast:'Middle East', asia:'Asia', europe:'Europe', us:'North America',
             oceania:'Oceania', latam:'Latin America', africa:'Africa', japan:'Japan' },
    other: 'Not listed',
    otherLabel: 'Other (enter manually)',
  },
};

const KINDS = ['bizjet', 'charter', 'regional', 'cargo'];

/* ── 検査①：会社コードの衝突 ────────────────────────────────
   同じ code が両方の名簿にあると、後勝ちで片方が黙って消える。
   （既に SALARY にある社を OPS へ書いてしまう事故を止める） */
{
  const dup = Object.keys({ ...OPS, ...(INJECT || {}) })
    .filter((k) => Object.prototype.hasOwnProperty.call(SALARY, k));
  if (dup.length) {
    throw new Error(
      `会社コードが SALARY と OPS で衝突: ${dup.join(', ')}\n` +
      '  → 既に年収付きで載っている社。airline-ops.mjs から消す。');
  }
}

/* ── 検査②：OPS の形 ────────────────────────────────────── */
for (const [k, a] of Object.entries({ ...OPS, ...(INJECT || {}) })) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(k)) throw new Error(`code の形が不正: ${k}（小文字英数とハイフンのみ）`);
  for (const f of ['ja', 'en', 'region', 'kind', 'src']) {
    if (!a[f] || typeof a[f] !== 'string') throw new Error(`${k}: ${f} が無い`);
  }
  if (!GROUPS.ja.order.includes(a.region)) throw new Error(`${k}: region が不正: ${a.region}`);
  if (!KINDS.includes(a.kind)) throw new Error(`${k}: kind が不正: ${a.kind}`);
  if (a.alias != null && (!Array.isArray(a.alias) || a.alias.some((s) => typeof s !== 'string')))
    throw new Error(`${k}: alias は文字列の配列`);
  if (a.cap || a.fo) throw new Error(`${k}: 年収は airline-ops.mjs に書かない（SALARY へ昇格させる）`);
}

/* ── 検査③：社名の衝突 ──────────────────────────────────────
   db/pay-rows.sql:656-695 の pv_airline_norm / pv_airline_resolve を写したもの。
   あちらを変えたらここも直す。 */
const airNorm = (s) => String(s == null ? '' : s)
  .toLowerCase()
  // [[:space:]]　・･'".,/_()（）[]‐‑‒–—―−ー－-  ← SQL の文字クラスと同じ
  .replace(/[\s　・･'".,/_()（）[\]‐‑‒–—―−ー－-]+/g, '');

/* 1社から取れる7つの名前（code / 和名 / 英名 / それぞれの括弧の外と中） */
function nameVariants(code, a) {
  const outside = (s) => String(s || '').replace(/[（(][\s\S]*/, '');
  const inside = (s) => (String(s || '').match(/[（(]([^）)]+)[）)]/) || [])[1] || '';
  return [code, a.ja, a.en, outside(a.ja), inside(a.ja), outside(a.en), inside(a.en)];
}

{
  const owner = new Map(); // 正規化後の名前 → その名前を出す code の集合
  for (const k of KEYS) {
    for (const nm of nameVariants(k, ALL[k])) {
      const n = airNorm(nm);
      if (!n) continue;
      if (!owner.has(n)) owner.set(n, new Set());
      owner.get(n).add(k);
    }
  }
  const clash = [...owner.entries()].filter(([, s]) => s.size > 1);
  if (clash.length) {
    throw new Error(
      '社名が別の会社どうしで一致する（pv_airline_resolve がどちらか一方に寄せてしまう）:\n' +
      clash.map(([n, s]) => `  「${n}」 → ${[...s].join(' / ')}`).join('\n') +
      '\n  → 別法人なら名前を分ける。同じ会社なら片方を消す。');
  }
}

if (CHECK) {
  console.log(`✅ 検査のみ（書き出さない）: ${KEYS.length} 社 ＝ 年収あり ${Object.keys(SALARY).length} ＋ 投稿先のみ ${Object.keys(OPS).length}`);
  console.log('   コードの衝突なし／OPS の形も正しい／社名の衝突なし');
  process.exit(0);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// JS のオブジェクトリテラルを組む。'-' を含むキーは引用が要る。
const jsKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const jsStr = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/* 地域ごとに <optgroup> を組む。地域内の並びは名簿の並び順をそのまま使う
   （大手が先頭に来るよう手で整えてあるので、並べ直さない）。
   OPS の社は各地域の末尾に付く（ALL の合流順がそのまま出る）。 */
function buildOptions(lang) {
  const g = GROUPS[lang];
  const seen = new Set();
  const out = [];

  for (const region of g.order) {
    const members = KEYS.filter((k) => ALL[k].region === region);
    if (!members.length) throw new Error(`region に1社も居ない: ${region}`);
    out.push(`              <optgroup label="${esc(g.label[region])}">`);
    for (const k of members) {
      const a = ALL[k];
      const name = a[lang];
      if (!name) throw new Error(`${lang} 名が無い: ${k}`);
      // data-alias は会社欄の検索だけが読む（DB にも公開集計にも出ない）。
      // 年収がある112社の別名は search.js の PV_DB から引くのでここには出さない。
      const al = Array.isArray(a.alias) && a.alias.length
        ? ` data-alias="${esc(a.alias.join('|'))}"` : '';
      out.push(`                <option value="${k}"${al}>${esc(name)}</option>`);
      seen.add(k);
    }
    out.push('              </optgroup>');
  }

  const missed = KEYS.filter((k) => !seen.has(k));
  if (missed.length) throw new Error(`どの地域にも出ていない: ${missed.join(', ')}`);

  // 「一覧にない会社」は最後。集計では airline_other 側に隔離する。
  out.push(`              <optgroup label="${esc(g.other)}">`);
  out.push(`                <option value="other">${esc(g.otherLabel)}</option>`);
  out.push('              </optgroup>');
  return out.join('\n');
}

/* #f-airline の中身だけを差し替える。select タグと直後のプレースホルダ
   （<option value="">…）は各ページの文言を保つため、そのまま残す。 */
function patchSelect(path, lang) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');

  // ★ プレースホルダ直後の改行は group 1 に含めない。含めると、まだ空の
  //   select（新規ページの初回生成）で group 3 の `\n</select>` が食われて一致しない。
  const re = /(<select[^>]*id="f-airline"[^>]*>\s*\n\s*<option value="">[^<]*<\/option>)([\s\S]*?)(\n\s*<\/select>)/;
  const m = html.match(re);
  if (!m) throw new Error(`#f-airline の select が見つからない: ${path}`);

  // ★replace の第2引数は関数で渡す。文字列だと社名に含まれる $ が $' $& $1 の
  //   置換パターンとして解釈され、生成物が壊れる（gen-vocab.mjs の CUR_META で実際に起きた）。
  const opts = buildOptions(lang);
  const next = html.replace(re, (_, head, __, tail) => `${head}\n${opts}${tail}`);

  // 差し替えた結果を数え直す（プレースホルダ ＋ 全社 ＋ other）
  const block = next.match(re);
  const n = [...(block[1] + block[2]).matchAll(/<option value="/g)].length;
  const want = KEYS.length + 2;
  if (n !== want) throw new Error(`option 数が合わない: ${path} → ${n} != ${want}`);

  writeFileSync(url, next);
  return n;
}

// ── 1. airline-codes.json（全社 ＋ other）─────────────────────
const codes = [...KEYS, 'other'];
if (new Set(codes).size !== codes.length) throw new Error('コードが重複している');
if (codes.length !== KEYS.length + 1) throw new Error('件数が合わない');
writeFileSync(new URL('./airline-codes.json', import.meta.url), JSON.stringify(codes));
console.log(`✅ airline-codes.json 書き出し: ${codes.length} 件（${KEYS.length} 社 ＋ other）`);
console.log(`   内訳: 年収あり ${Object.keys(SALARY).length} 社 ＋ 投稿先のみ ${Object.keys(OPS).length} 社`);

/* 確認画面で社名を出すための対応表。ここを更新し忘れると、一覧に無いコードが
   'qatar-airways' のような生の文字列のまま利用者に見える（実際そうなっていた）。 */
function patchLabels(path, lang) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');

  const body = KEYS.map((k) => `  ${jsKey(k)}: ${jsStr(ALL[k][lang])},`).join('\n');
  const other = lang === 'ja' ? 'その他' : 'Other';
  const lit = [
    '/*BEGIN:LABELS*/const AIRLINE_LABELS = {',
    '  // ★手で書かない。node gen-airline-codes.mjs が名簿から生成する。',
    body,
    `  other: ${jsStr(other)},`,
    '};/*END:LABELS*/',
  ].join('\n');

  // 初回はマーカーが無いので、既存の定義ごと置き換える。
  const re = /\/\*BEGIN:LABELS\*\/[\s\S]*?\/\*END:LABELS\*\/|const AIRLINE_LABELS = \{[\s\S]*?\n\};/;
  if (!re.test(html)) throw new Error(`AIRLINE_LABELS が見つからない: ${path}`);

  const next = html.replace(re, () => lit); // 同上：文字列で渡さない
  const n = (next.match(/\/\*BEGIN:LABELS\*\/[\s\S]*?\/\*END:LABELS\*\//)[0].match(/^  [^ ]/gm) || []).length;
  if (n !== KEYS.length + 2) throw new Error(`ラベル数が合わない: ${path} → ${n}`);

  writeFileSync(url, next);
  return KEYS.length + 1;
}

// ── 2. 投稿フォーム4枚 ─────────────────────────────────────────
// 口コミ側は確認画面で社名を出すため AIRLINE_LABELS が要る。
// 給与側は select の option テキストをそのまま読むので対応表を持たない
// （同じ社名を2箇所で持つと、片方だけ更新されて必ず食い違う）。
for (const [path, lang] of [['./submit-review.html', 'ja'], ['./en/submit-review.html', 'en']]) {
  const opts = patchSelect(path, lang);
  const labels = patchLabels(path, lang);
  console.log(`✅ ${path.replace('./', '')} → #f-airline ${opts} option / AIRLINE_LABELS ${labels} 件`);
}
for (const [path, lang] of [['./pay-report.html', 'ja'], ['./en/pay-report.html', 'en']]) {
  const opts = patchSelect(path, lang);
  console.log(`✅ ${path.replace('./', '')} → #f-airline ${opts} option`);
}

// ── 3. 画面が社名を引く辞書（pv-airlines.json）──────────────────
// REAL PAY / DEEP PAY / 会社比較 / 市場価値レポートが読む。
// ⚠️ salary-data.json には混ぜない。あちらは「年収の帯を持つ社」の辞書で、
//   check-salary.mjs が SALARY と1対1で照合している。
{
  const airlines = {};
  for (const k of KEYS) {
    const a = ALL[k];
    airlines[k] = { ja: a.ja, en: a.en, region: a.region, kind: a.kind || 'airline' };
  }
  const json = {
    note: '自動生成（node gen-airline-codes.mjs）。手で編集しない。',
    airlines,
  };
  writeFileSync(new URL('./pv-airlines.json', import.meta.url), JSON.stringify(json));
  console.log(`✅ pv-airlines.json 書き出し: ${KEYS.length} 社`);
}

// ── 4. DB 側の会社マスタ（pay_reports が外部キーで参照する）────
// SQL からは名簿を読めないので、ここから流し込む。
// これが無いと DB 側で社名を検証できず、また集計不能な行が入る。
{
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  /* 公開年収の幅（万円）。REAL PAY が「公開年収から大きく外れた本人申告の行」に
     ⚠ を付けるのに読む（db/pay-rows.sql の fence）。年収の無い社（OPS）は null
     ＝比べる相手が無いので ⚠ は付かない。SALARY の社で幅が欠けていたら止める
     （黙って null にすると、その社だけ ⚠ が一生付かない）。 */
  const band = (k) => {
    if (!(k in SALARY)) return 'null, null, null, null';
    const out = [];
    for (const p of ['cap', 'fo']) {
      const r = SALARY[k][p];
      if (!r || !Number.isInteger(r.lo) || !Number.isInteger(r.hi) || r.lo <= 0 || r.lo > r.hi)
        throw new Error(`SALARY.${k}.${p} の lo/hi が整数の幅になっていない: ${JSON.stringify(r)}`);
      out.push(r.lo, r.hi);
    }
    return out.join(', ');
  };
  const rows = KEYS.map((k) => {
    const a = ALL[k];
    return `  (${q(k)}, ${q(a.ja)}, ${q(a.en)}, ${q(a.region)}, ${band(k)})`;
  }).concat([`  ('other', ${q('その他（自由入力）')}, ${q('Other (free text)')}, 'other', null, null, null, null)`]);
  const nBand = KEYS.filter((k) => k in SALARY).length;

  const sql = `-- ════════════════════════════════════════════════════════════════
-- db/airlines.generated.sql — ★自動生成。手で編集しない。
--   生成元: salary-data.mjs（年収がある社）＋ airline-ops.mjs（投稿先だけの社）
--   再生成: node gen-airline-codes.mjs
--
-- pay_reports.airline / reviews の会社コードを DB 側で検証するためのマスタ。
-- 何度流しても安全（upsert）。名簿から消えた社は無効化するだけで消さない
-- （過去の投稿が外部キーで残っているため）。
--
-- ★このファイルを貼ると、過去の「その他（自由入力）」の投稿のうち
--   社名が新しく登録した会社と完全一致するものは、行を1行も書き換えずに
--   REAL PAY で正しい社名に出るようになる（pv_airline_resolve が実行時に引くため）。
--   pay_reports を update してはいけない（持ち主の proof_hash が外れる）。
--
-- ★cap_lo / cap_hi / fo_lo / fo_hi は公開年収の幅（万円・salary-data.mjs のまま）。
--   REAL PAY が「公開年収から大きく外れた本人申告の行」に ⚠ を付けるのに読む
--   （db/pay-rows.sql の fence）。年収の幅を直したら、このファイルも流し直して貼る。
--   貼らないと ⚠ の判定だけが古い幅のまま残る（画面は普通に動く）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_airlines (
  code    text primary key,
  name_ja text not null,
  name_en text not null,
  region  text not null,
  active  boolean not null default true
);
alter table public.pv_airlines add column if not exists cap_lo integer;
alter table public.pv_airlines add column if not exists cap_hi integer;
alter table public.pv_airlines add column if not exists fo_lo  integer;
alter table public.pv_airlines add column if not exists fo_hi  integer;

insert into public.pv_airlines (code, name_ja, name_en, region, cap_lo, cap_hi, fo_lo, fo_hi) values
${rows.join(',\n')}
on conflict (code) do update
  set name_ja = excluded.name_ja,
      name_en = excluded.name_en,
      region  = excluded.region,
      cap_lo  = excluded.cap_lo,
      cap_hi  = excluded.cap_hi,
      fo_lo   = excluded.fo_lo,
      fo_hi   = excluded.fo_hi,
      active  = true;

-- 名簿から消えた社は残したまま active=false にする（投稿の参照先を壊さない）
update public.pv_airlines set active = false
 where code not in (${[...KEYS, 'other'].map(q).join(', ')});

alter table public.pv_airlines enable row level security;
drop policy if exists pv_airlines_read on public.pv_airlines;
create policy pv_airlines_read on public.pv_airlines for select to anon, authenticated using (true);

-- 検算：${KEYS.length + 1} 件（${KEYS.length}社 ＋ other）・年収の幅あり ${nBand} 社
select count(*) filter (where active) as 有効, count(*) as 全件,
       count(*) filter (where active and cap_hi is not null and fo_hi is not null) as 年収の幅あり
  from public.pv_airlines;
`;
  writeFileSync(new URL('./db/airlines.generated.sql', import.meta.url), sql);
  console.log(`✅ db/airlines.generated.sql 書き出し: ${rows.length} 件`);
}

// ── 5. pv-reunlock.js のフォールバック（fetch 失敗時の保険）────
// 手で直すと必ず腐るので、ここから書き換える。
{
  const url = new URL('./pv-reunlock.js', import.meta.url);
  const js = readFileSync(url, 'utf8');
  const re = /\/\*BEGIN:CODES\*\/[\s\S]*?\/\*END:CODES\*\//;
  if (!re.test(js)) throw new Error('pv-reunlock.js の BEGIN:CODES マーカーが無い');
  const lit = '[' + codes.map((c) => `'${c}'`).join(',') + ']';
  writeFileSync(url, js.replace(re, () => `/*BEGIN:CODES*/${lit}/*END:CODES*/`)); // 同上
  console.log(`✅ pv-reunlock.js FALLBACK_CODES: ${codes.length} 件`);
}
