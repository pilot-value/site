/* ════════════════════════════════════════════════════════════════
   gen-airline-codes.mjs
   SSOT（salary-data.mjs の SALARY）から、会社の選択肢を生成する。

     salary-data.mjs ──┬─→ airline-codes.json        （SSOT の全社 ＋ other）
                       ├─→ submit-review.html    #f-airline（ja 表記）
                       └─→ en/submit-review.html #f-airline（en 表記）

   ★向きが以前と逆。以前は submit-review.html を読んで JSON を作っていたため、
     HTML の 35 社が事実上の正になり、SSOT の 110 社と乖離していた。
     結果、75 社のパイロットは「その他」で自由入力するしかなく、
     社名が会社ページと結合できない＝集計できない行になっていた。
     社名は SSOT から生成し、手で書かない。

   airline-codes.json の用途: ログイン/OAuth コールバック時の「再解放」照合。
   reviews_v2 は匿名（proof_hash）で user_id を持たないため
   「この人の全口コミ」を直接引けない。代わりに投稿可能な全社コードの
   proof_hash を計算して照合する（pv-reunlock.js）。

   実行: node gen-airline-codes.mjs
════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'fs';
import { SALARY } from './salary-data.mjs';

const KEYS = Object.keys(SALARY);

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

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// JS のオブジェクトリテラルを組む。'-' を含むキーは引用が要る。
const jsKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const jsStr = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/* 地域ごとに <optgroup> を組む。地域内の並びは SSOT の並び順をそのまま使う
   （大手が先頭に来るよう手で整えてあるので、並べ直さない）。 */
function buildOptions(lang) {
  const g = GROUPS[lang];
  const seen = new Set();
  const out = [];

  for (const region of g.order) {
    const members = KEYS.filter((k) => SALARY[k].region === region);
    if (!members.length) throw new Error(`region に1社も居ない: ${region}`);
    out.push(`              <optgroup label="${esc(g.label[region])}">`);
    for (const k of members) {
      const name = SALARY[k][lang];
      if (!name) throw new Error(`${lang} 名が無い: ${k}`);
      out.push(`                <option value="${k}">${esc(name)}</option>`);
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

  // 差し替えた結果を数え直す（プレースホルダ ＋ SSOT の全社 ＋ other）
  const block = next.match(re);
  const n = [...(block[1] + block[2]).matchAll(/<option value="/g)].length;
  const want = KEYS.length + 2;
  if (n !== want) throw new Error(`option 数が合わない: ${path} → ${n} != ${want}`);

  writeFileSync(url, next);
  return n;
}

// ── 1. airline-codes.json（SSOT の全社 ＋ other）───────────────
const codes = [...KEYS, 'other'];
if (new Set(codes).size !== codes.length) throw new Error('コードが重複している');
if (codes.length !== KEYS.length + 1) throw new Error('件数が合わない');
writeFileSync(new URL('./airline-codes.json', import.meta.url), JSON.stringify(codes));
console.log(`✅ airline-codes.json 書き出し: ${codes.length} 件（${KEYS.length} 社 ＋ other）`);

/* 確認画面で社名を出すための対応表。ここを更新し忘れると、一覧に無いコードが
   'qatar-airways' のような生の文字列のまま利用者に見える（実際そうなっていた）。 */
function patchLabels(path, lang) {
  const url = new URL(path, import.meta.url);
  const html = readFileSync(url, 'utf8');

  const body = KEYS.map((k) => `  ${jsKey(k)}: ${jsStr(SALARY[k][lang])},`).join('\n');
  const other = lang === 'ja' ? 'その他' : 'Other';
  const lit = [
    '/*BEGIN:LABELS*/const AIRLINE_LABELS = {',
    '  // ★手で書かない。node gen-airline-codes.mjs が SSOT から生成する。',
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

// ── 3. DB 側の会社マスタ（pay_reports が外部キーで参照する）────
// SQL からは salary-data.mjs を読めないので、ここから流し込む。
// これが無いと DB 側で社名を検証できず、また集計不能な行が入る。
{
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const rows = KEYS.map((k) => {
    const a = SALARY[k];
    return `  (${q(k)}, ${q(a.ja)}, ${q(a.en)}, ${q(a.region)})`;
  }).concat([`  ('other', ${q('その他（自由入力）')}, ${q('Other (free text)')}, 'other')`]);

  const sql = `-- ════════════════════════════════════════════════════════════════
-- db/airlines.generated.sql — ★自動生成。手で編集しない。
--   生成元: salary-data.mjs（SSOT）
--   再生成: node gen-airline-codes.mjs
--
-- pay_reports.airline / reviews の会社コードを DB 側で検証するためのマスタ。
-- 何度流しても安全（upsert）。SSOT から消えた社は無効化するだけで消さない
-- （過去の投稿が外部キーで残っているため）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_airlines (
  code    text primary key,
  name_ja text not null,
  name_en text not null,
  region  text not null,
  active  boolean not null default true
);

insert into public.pv_airlines (code, name_ja, name_en, region) values
${rows.join(',\n')}
on conflict (code) do update
  set name_ja = excluded.name_ja,
      name_en = excluded.name_en,
      region  = excluded.region,
      active  = true;

-- SSOT から消えた社は残したまま active=false にする（投稿の参照先を壊さない）
update public.pv_airlines set active = false
 where code not in (${[...KEYS, 'other'].map(q).join(', ')});

alter table public.pv_airlines enable row level security;
drop policy if exists pv_airlines_read on public.pv_airlines;
create policy pv_airlines_read on public.pv_airlines for select to anon, authenticated using (true);

-- 検算：${KEYS.length + 1} 件（${KEYS.length}社 ＋ other）
select count(*) filter (where active) as 有効, count(*) as 全件 from public.pv_airlines;
`;
  writeFileSync(new URL('./db/airlines.generated.sql', import.meta.url), sql);
  console.log(`✅ db/airlines.generated.sql 書き出し: ${rows.length} 件`);
}

// ── 4. pv-reunlock.js のフォールバック（fetch 失敗時の保険）────
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
