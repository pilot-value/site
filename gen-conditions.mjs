/* ════════════════════════════════════════════════════════════════
   gen-conditions.mjs
   SSOT（pv-conditions.mjs）から待遇アンケートの質問を生成する。

     pv-conditions.mjs ──┬─→ pv-conditions.json          （ブラウザ用・pv-conditions.js が読む）
                         └─→ db/conditions.generated.sql （DB の質問マスタ）

   何度流しても同じ結果になる（生成物を消してから流しても同じ）。
   実行: node gen-conditions.mjs
════════════════════════════════════════════════════════════════ */
import { writeFileSync } from 'fs';
import { SECTIONS, QUESTIONS, SETTINGS, UNKNOWN, TEXT_MAX, LINES_MAX, LINE_NAME_MAX } from './pv-conditions.mjs';

const KINDS = ['choice', 'multi', 'num', 'lines'];
const TIERS = ['A', 'B', 'C'];   // A から先に埋める（横断比較に効く順）
const ID_RE = /^[a-z][a-z0-9_]{2,39}$/;   // 質問ID・節コード
const CODE_RE = /^[a-z][a-z0-9_]{0,39}$/;  // 選択肢コード（'no' 'fo' のような2文字もある）

// ── 検品 ──────────────────────────────────────────────────────
// ★ここで落ちるのは全部「あとで DB に入ってから直せなくなる」種類の間違い。
//   質問IDと選択肢コードは回答の行に焼き付くので、流したあとで直せない。

/* ── 頻度の設定 ────────────────────────────────────────────────
   ここで落ちるのは「本番に入ってから気づくと痛い」種類の間違い。
   窓が0や負だと同じ質問が延々と出る。問数が大きいと「10秒」という約束が嘘になる。 */
{
  const need = ['answer_reask_days', 'unknown_reask_days', 'skip_reask_days',
                'initial_limit', 'recurring_limit', 'profile_limit', 'modal_delay_ms'];
  for (const k of Object.keys(SETTINGS)) {
    if (!need.includes(k)) throw new Error(`SETTINGS: 知らない項目 → ${k}（DB 側にも足すこと）`);
  }
  for (const k of need) {
    const v = SETTINGS[k];
    if (!Number.isInteger(v) || v < 0) throw new Error(`SETTINGS.${k}: 0以上の整数で書く → ${v}`);
  }
  /* ★窓の大小関係を固定する。スキップ < わからない < 答えた。
     逆転すると「答えた人にいちばん早く聞き直す」ことになり、しつこさの原因になる。 */
  if (!(SETTINGS.skip_reask_days < SETTINGS.unknown_reask_days
        && SETTINGS.unknown_reask_days < SETTINGS.answer_reask_days)) {
    throw new Error('SETTINGS: 窓は skip < unknown < answer の順にする');
  }
  for (const k of ['initial_limit', 'recurring_limit', 'profile_limit']) {
    if (SETTINGS[k] < 1 || SETTINGS[k] > 10) throw new Error(`SETTINGS.${k}: 1〜10 の範囲で（1回に出す問数）`);
  }
  if (SETTINGS.recurring_limit > SETTINGS.initial_limit) {
    throw new Error('SETTINGS: 2回目以降のほうが初回より多い（負担が増える向きの設定になっている）');
  }
  if (SETTINGS.modal_delay_ms > 5000) throw new Error('SETTINGS.modal_delay_ms: 5秒を超えると、もう画面を離れている');
}

{
  const codes = SECTIONS.map((s) => s.code);
  if (new Set(codes).size !== codes.length) throw new Error('SECTIONS: コードが重複');
  for (const s of SECTIONS) {
    if (!ID_RE.test(s.code)) throw new Error(`SECTIONS: コードの形が不正 → ${s.code}`);
    if (!s.ja || !s.en) throw new Error(`SECTIONS: ja/en が欠けている → ${s.code}`);
  }
}

const seen = new Map();   // id → 定義（親の参照チェックに使う。★先に出た質問しか親にできない）
const usedPriority = new Map();
const usedBoost = new Map();   // boost → id（回答ゼロの人に出す順。同点だと順が決まらない）
let lastPriority = -1;

for (const q of QUESTIONS) {
  const at = `QUESTIONS[${q.id}]`;
  if (!ID_RE.test(String(q.id || ''))) throw new Error(`${at}: id の形が不正（小文字英数と _ で3〜40字）`);
  if (seen.has(q.id)) throw new Error(`${at}: id が重複`);
  if (!KINDS.includes(q.kind)) throw new Error(`${at}: kind が不正 → ${q.kind}`);
  if (!SECTIONS.some((s) => s.code === q.section)) throw new Error(`${at}: section が SECTIONS に無い → ${q.section}`);
  if (!Number.isInteger(q.version) || q.version < 1) throw new Error(`${at}: version は1以上の整数`);
  for (const l of ['ja', 'en']) {
    if (!q[l] || !q[l].label) throw new Error(`${at}: ${l}.label が無い`);
    if (typeof q[l].help !== 'string') throw new Error(`${at}: ${l}.help は文字列（不要なら ''）`);
  }
  if (!Number.isInteger(q.priority)) throw new Error(`${at}: priority が整数でない`);
  /* 優先順位を重複させない。同点だと DB 側の order by が不定になり、
     「次に聞く質問」が実行のたびに入れ替わる。 */
  if (usedPriority.has(q.priority)) throw new Error(`${at}: priority ${q.priority} が ${usedPriority.get(q.priority)} と重複`);
  /* ★このファイルの並び順と priority の昇順を一致させる。画面は JSON の並び順で描き、
     DB は order by priority で並べる。ここがずれると同じ質問集が2通りの順で出る。 */
  if (q.priority <= lastPriority) throw new Error(`${at}: priority ${q.priority} が前の質問より小さい（並び順と揃える）`);
  lastPriority = q.priority;
  usedPriority.set(q.priority, q.id);
  if (!TIERS.includes(q.tier)) throw new Error(`${at}: tier が A / B / C のどれでもない → ${q.tier}`);
  if (q.boost != null) {
    if (!Number.isInteger(q.boost) || q.boost < 1) throw new Error(`${at}: boost は1以上の整数（不要なら書かない）`);
    if (usedBoost.has(q.boost)) throw new Error(`${at}: boost ${q.boost} が ${usedBoost.get(q.boost)} と重複（順番が決まらない）`);
    usedBoost.set(q.boost, q.id);
  }

  // ── 選択肢 ──
  if (q.kind === 'choice' || q.kind === 'multi') {
    if (!Array.isArray(q.choices) || q.choices.length < 2) throw new Error(`${at}: 選択肢が2つ未満`);
    const cs = q.choices.map((c) => c.code);
    if (new Set(cs).size !== cs.length) throw new Error(`${at}: 選択肢のコードが重複`);
    for (const c of q.choices) {
      if (!CODE_RE.test(c.code)) throw new Error(`${at}: 選択肢コードの形が不正 → ${c.code}`);
      if (!c.ja || !c.en) throw new Error(`${at}: 選択肢の ja/en が欠けている → ${c.code}`);
    }
    /* ★1つ選ぶ質問には必ず「わからない」を置く。無いと、知らない人が
       当てずっぽうで答えるか、離脱するかの二択になる。どちらもデータを汚す。 */
    if (q.kind === 'choice') {
      if (cs[cs.length - 1] !== UNKNOWN) throw new Error(`${at}: choice は最後に '${UNKNOWN}' が要る`);
    } else if (cs.includes(UNKNOWN)) {
      /* 複数選択に「わからない」は要らない（何も選ばずに次へ進めばよい）。
         置くと「わからない＋路線」のような矛盾した回答が作れてしまう。 */
      throw new Error(`${at}: multi に '${UNKNOWN}' を入れない（未選択で表現する）`);
    }
  } else if (q.choices) {
    throw new Error(`${at}: kind=${q.kind} に choices は要らない`);
  }

  // ── 数値 ──
  if (q.kind === 'num') {
    const n = q.num;
    if (!n) throw new Error(`${at}: num（min/max/step/単位）が無い`);
    if (!(n.max > n.min)) throw new Error(`${at}: num.max が num.min 以下`);
    if (!(n.step > 0)) throw new Error(`${at}: num.step が0以下`);
    if (!n.ja || !n.en) throw new Error(`${at}: num の単位（ja/en）が無い`);
  } else if (q.num) {
    throw new Error(`${at}: kind=${q.kind} に num は要らない`);
  }

  // ── 明細行 ──
  if (q.kind === 'lines') {
    if (!q.line || !Array.isArray(q.line.freq) || !Array.isArray(q.line.category)) {
      throw new Error(`${at}: line.freq と line.category が要る`);
    }
    for (const list of [q.line.freq, q.line.category]) {
      for (const c of list) {
        if (!CODE_RE.test(c.code)) throw new Error(`${at}: line のコードが不正 → ${c.code}`);
        if (!c.ja || !c.en) throw new Error(`${at}: line の ja/en が欠けている → ${c.code}`);
      }
    }
  } else if (q.line) {
    throw new Error(`${at}: kind=${q.kind} に line は要らない`);
  }

  // ── 付帯フラグ ──
  if (q.currency && q.kind !== 'num') throw new Error(`${at}: currency は数値質問だけ`);
  if (q.note && q.kind !== 'choice' && q.kind !== 'multi') throw new Error(`${at}: note は選択式だけ`);

  // ── 親子 ──
  if (q.parent) {
    const p = seen.get(q.parent);
    if (!p) throw new Error(`${at}: parent '${q.parent}' が先に定義されていない`);
    if (p.kind !== 'choice' && p.kind !== 'multi') throw new Error(`${at}: parent が選択式でない`);
    if (!Array.isArray(q.parentWhen) || !q.parentWhen.length) throw new Error(`${at}: parentWhen が空`);
    for (const w of q.parentWhen) {
      if (!p.choices.some((c) => c.code === w)) throw new Error(`${at}: parentWhen '${w}' が親の選択肢に無い`);
    }
    if (q.parentWhen.includes(UNKNOWN)) throw new Error(`${at}: parentWhen に '${UNKNOWN}' を入れない`);
  } else if (q.parentWhen) {
    throw new Error(`${at}: parent が無いのに parentWhen がある`);
  }

  // ── 提出直後の1問に出してよい形か ──
  /* ★ここが「10秒で終わる」という約束の実体。数値入力・複数選択・自由記述を
     1問カードに出すと、約束が嘘になる。
     ★親があってもよい。出す側（next_condition_questions）が「その人自身が親に
       答えていて、答えが parent_when に入る」ときだけ候補に入れる。中途採用の扱いは
       1タップで終わるのに、親があるという理由だけで1問枠から外すのは本末転倒。 */
  if (q.micro) {
    if (q.kind !== 'choice') throw new Error(`${at}: micro は1つ選ぶ質問だけ（kind=${q.kind}）`);
    if (q.note) throw new Error(`${at}: 自由記述つきの質問を micro にしない`);
    if (q.isOpinion) throw new Error(`${at}: 体感の質問を micro にしない（1問枠は制度の有無に使う）`);
  }

  seen.set(q.id, q);
}

const micros = QUESTIONS.filter((q) => q.micro);
if (!micros.length) throw new Error('micro の質問が1つも無い（提出直後に出すものが無くなる）');

/* ── 最初の3問を、約束どおり出せる形か ────────────────────────────
   boost は「まだ1問も答えていない人」に出す順を決める。その人は親の質問にも
   答えていないので、★親を持つ質問は候補にすら入らない（出す側が親の答えで絞る）。
   親つきの質問に boost を付けると、指定したつもりの質問が黙って出ない。
   数値入力や複数選択も同じ理由で出ない（モーダルは1タップで終わる形だけ）。 */
{
  const boosted = QUESTIONS.filter((q) => q.boost).sort((a, b) => b.boost - a.boost);
  for (const q of boosted) {
    if (!q.micro) throw new Error(`QUESTIONS[${q.id}]: boost を付けるなら micro（1タップで終わる形）にする`);
    if (q.parent) throw new Error(`QUESTIONS[${q.id}]: 親を持つ質問に boost を付けない（初回の人には出ない）`);
  }
  if (boosted.length < SETTINGS.initial_limit) {
    throw new Error(`boost が ${boosted.length} 問しか無い。初回に ${SETTINGS.initial_limit} 問出すなら同数以上いる`);
  }
}

// ── ブラウザ用 JSON ───────────────────────────────────────────
{
  const json = {
    _: '★自動生成（node gen-conditions.mjs）。手で編集しない。生成元 pv-conditions.mjs',
    unknown: UNKNOWN,
    limits: { textMax: TEXT_MAX, linesMax: LINES_MAX, lineNameMax: LINE_NAME_MAX },
    /* 出す問数と待ち時間。★DB 側（pv_condition_settings）と同じ数字がここへ来る。
       画面が「3問出すつもり」なのに DB が1問しか返さない、が起きないようにする。 */
    settings: { ...SETTINGS },
    sections: SECTIONS.map((s) => ({ code: s.code, ja: s.ja, en: s.en })),
    questions: QUESTIONS.map((q) => {
      const o = {
        id: q.id, version: q.version, section: q.section, kind: q.kind,
        tier: q.tier, micro: !!q.micro, priority: q.priority, boost: q.boost || 0,
        isOpinion: !!q.isOpinion,
        ja: { label: q.ja.label, help: q.ja.help || '' },
        en: { label: q.en.label, help: q.en.help || '' },
      };
      if (q.parent) { o.parent = q.parent; o.parentWhen = q.parentWhen; }
      if (q.choices) o.choices = q.choices.map((c) => ({ code: c.code, ja: c.ja, en: c.en }));
      if (q.num) o.num = { min: q.num.min, max: q.num.max, step: q.num.step, ja: q.num.ja, en: q.num.en };
      if (q.line) o.line = q.line;
      if (q.currency) o.currency = true;
      if (q.note) o.note = true;
      return o;
    }),
  };
  writeFileSync(new URL('./pv-conditions.json', import.meta.url), JSON.stringify(json));
  console.log(`✅ pv-conditions.json 書き出し: 質問${QUESTIONS.length}（うち提出直後に出せるもの ${micros.length}）`);
}

// ── DB の質問マスタ ───────────────────────────────────────────
{
  const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const arr = (a) => (a && a.length ? `array[${a.map(q).join(', ')}]` : 'null');
  const num = (v) => (v == null ? 'null' : String(v));
  const bool = (v) => (v ? 'true' : 'false');
  const rows = (list, cols) => list.map((x) => `  (${cols.map((c) => c(x)).join(', ')})`).join(',\n');

  /* kind ごとの付帯情報は列にせず spec(jsonb) に畳む。
     質問の形が増えるたびに本番のテーブルを変えるのを避けるため。 */
  const spec = (x) => {
    const o = {};
    if (x.num) o.step = x.num.step;
    if (x.line) {
      o.freq = x.line.freq.map((c) => c.code);
      o.category = x.line.category.map((c) => c.code);
    }
    return q(JSON.stringify(o));
  };

  const tierCount = (t) => QUESTIONS.filter((x) => x.tier === t).length;
  const ids = QUESTIONS.map((x) => q(x.id)).join(', ');
  const secIds = SECTIONS.map((s) => q(s.code)).join(', ');

  const sql = `-- ════════════════════════════════════════════════════════════════
-- db/conditions.generated.sql — ★自動生成。手で編集しない。
--   生成元: pv-conditions.mjs
--   再生成: node gen-conditions.mjs
--
-- 待遇アンケートの質問マスタ。何度流しても安全（upsert）。
-- 質問から消えたコードは無効化するだけで消さない（回答が参照している）。
--
-- ★流す順番: このファイル → db/airline-conditions.sql
--   逆にすると参照先の質問が無くて落ちる（向こうの冒頭が止める）。
-- ════════════════════════════════════════════════════════════════

create table if not exists public.pv_condition_sections (
  code text primary key,
  name_ja text not null, name_en text not null,
  sort smallint not null default 0,
  active boolean not null default true
);

-- 1問の定義。回答は airline_conditions に「1回答＝1行」で入る。
--   kind        choice=1つ選ぶ / multi=複数選ぶ / num=数値 / lines=明細行
--   tier        A→B→C の順に埋める。A は全社を横並びで比較できる普遍的な項目
--   micro       給与レポート直後に1問だけ出してよいか
--               （1タップで終わる choice だけ。親があってもよく、出す側が親の答えを見て絞る）
--   boost       まだ1問も答えていない人にだけ効く最優先の並び替え（大きいほど先・既定0）。
--               最初の3問を指定するためのもの。priority を動かすと詳細ページの節の並びが崩れる
--   is_opinion  制度の有無でなく本人の体感。公開時に会社の事実として並べない
--   parent/parent_when  親の答えが parent_when に入るときだけ出す
--   spec        kind ごとの付帯情報（数値の刻み、明細行の語彙）
create table if not exists public.pv_condition_questions (
  id text primary key,
  version smallint not null default 1,
  section text not null references public.pv_condition_sections(code),
  kind text not null check (kind in (${KINDS.map(q).join(', ')})),
  tier char(1) not null default 'C',
  micro boolean not null default false,
  priority smallint not null default 100,
  boost smallint not null default 0,
  is_opinion boolean not null default false,
  parent text references public.pv_condition_questions(id),
  parent_when text[],
  choice_codes text[],
  num_min numeric(12,2),
  num_max numeric(12,2),
  has_currency boolean not null default false,
  has_note boolean not null default false,
  spec jsonb not null default '{}'::jsonb,
  label_ja text not null,
  label_en text not null,
  active boolean not null default true
);

-- 後から足した列（既にテーブルがある環境向け）。create table if not exists は列を足さない。
alter table public.pv_condition_questions add column if not exists tier char(1) not null default 'C';
alter table public.pv_condition_questions add column if not exists is_opinion boolean not null default false;
alter table public.pv_condition_questions add column if not exists has_currency boolean not null default false;
alter table public.pv_condition_questions add column if not exists has_note boolean not null default false;
alter table public.pv_condition_questions add column if not exists spec jsonb not null default '{}'::jsonb;
alter table public.pv_condition_questions add column if not exists boost smallint not null default 0;

-- 検品の一部は DB 側にも置く。SSOT を通さず手で1行入れられたときに効く。
-- ★毎回 drop してから付け直す。「無ければ作る」だと、条件を変えて流し直したときに
--   古い定義が残ったまま黙って通ってしまう（micro の条件は実際に一度変わっている）。
alter table public.pv_condition_questions drop constraint if exists pv_cq_tier_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_micro_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_parent_ck;
alter table public.pv_condition_questions drop constraint if exists pv_cq_choice_ck;
alter table public.pv_condition_questions
  add constraint pv_cq_tier_ck check (tier in (${TIERS.map(q).join(', ')}));
-- micro＝1タップで終わる形か。親の有無は見ない（親の答えを持つ人にだけ出す＝出す側の仕事）
alter table public.pv_condition_questions
  add constraint pv_cq_micro_ck check (not micro or (kind = 'choice' and not has_note and not is_opinion));
alter table public.pv_condition_questions
  add constraint pv_cq_parent_ck check (parent is null or coalesce(array_length(parent_when, 1), 0) > 0);
alter table public.pv_condition_questions
  add constraint pv_cq_choice_ck check (
    (kind in ('choice','multi')) = (coalesce(array_length(choice_codes, 1), 0) > 0));

insert into public.pv_condition_sections (code, name_ja, name_en, sort) values
${rows(SECTIONS, [(x) => q(x.code), (x) => q(x.ja), (x) => q(x.en), (x) => String(SECTIONS.indexOf(x))])}
on conflict (code) do update set name_ja = excluded.name_ja, name_en = excluded.name_en,
  sort = excluded.sort, active = true;

-- ★親は子より先に入れる（自己参照の外部キー）。並び順は pv-conditions.mjs の並びそのまま。
insert into public.pv_condition_questions
  (id, version, section, kind, tier, micro, priority, boost, is_opinion, parent, parent_when,
   choice_codes, num_min, num_max, has_currency, has_note, spec, label_ja, label_en) values
${rows(QUESTIONS, [
  (x) => q(x.id),
  (x) => String(x.version),
  (x) => q(x.section),
  (x) => q(x.kind),
  (x) => q(x.tier),
  (x) => bool(x.micro),
  (x) => String(x.priority),
  (x) => String(x.boost || 0),
  (x) => bool(x.isOpinion),
  (x) => q(x.parent),
  (x) => arr(x.parentWhen),
  (x) => arr(x.choices && x.choices.map((c) => c.code)),
  (x) => num(x.num && x.num.min),
  (x) => num(x.num && x.num.max),
  (x) => bool(x.currency),
  (x) => bool(x.note),
  spec,
  (x) => q(x.ja.label),
  (x) => q(x.en.label),
])}
on conflict (id) do update set
  version = excluded.version, section = excluded.section, kind = excluded.kind,
  tier = excluded.tier, micro = excluded.micro, priority = excluded.priority,
  boost = excluded.boost, is_opinion = excluded.is_opinion,
  parent = excluded.parent, parent_when = excluded.parent_when,
  choice_codes = excluded.choice_codes, num_min = excluded.num_min, num_max = excluded.num_max,
  has_currency = excluded.has_currency, has_note = excluded.has_note, spec = excluded.spec,
  label_ja = excluded.label_ja, label_en = excluded.label_en, active = true;

update public.pv_condition_sections  set active = false where code not in (${secIds});
update public.pv_condition_questions set active = false where id not in (${ids});

-- 聞く頻度の設定。★数字を持つ場所を1つにする（生成元は pv-conditions.mjs の SETTINGS）。
--   next_condition_questions がここを読む。同じ数字が pv-conditions.json にも入り、画面が読む。
--   ⚠️ SQL に interval '365 days' のような直書きを戻さない。片方だけ直る事故になる。
create table if not exists public.pv_condition_settings (
  key text primary key,
  value int not null
);

insert into public.pv_condition_settings (key, value) values
${Object.keys(SETTINGS).map((k) => `  (${q(k)}, ${String(SETTINGS[k])})`).join(',\n')}
on conflict (key) do update set value = excluded.value;

-- SSOT から消えた設定は残さない（古い key を読み続ける関数が出ないように）
delete from public.pv_condition_settings where key not in (${Object.keys(SETTINGS).map(q).join(', ')});

-- 1つ読む。key が無ければ既定値を返す（DB を流す前でも関数が落ちないように）
create or replace function public.pv_condition_setting(p_key text, p_default int)
returns int language sql stable set search_path = public, pg_temp as $$
  select coalesce((select value from public.pv_condition_settings where key = p_key), p_default)
$$;

-- 入力欄の上限。★画面（pv-conditions.js）と保存側（submit_airline_conditions）で
--   別々の数字を持たないよう、pv-conditions.mjs から配る。
create or replace function public.pv_condition_limits()
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'text_max', ${TEXT_MAX}, 'lines_max', ${LINES_MAX}, 'line_name_max', ${LINE_NAME_MAX},
    'unknown', ${q(UNKNOWN)})
$$;
grant execute on function public.pv_condition_limits() to anon, authenticated;

-- 質問文は誰でも読める（フォームのラベルに使う）。書き込みポリシーは作らない。
do $$
declare t text;
begin
  foreach t in array array['pv_condition_sections','pv_condition_questions','pv_condition_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- 検算：節${SECTIONS.length} / 質問${QUESTIONS.length} / 提出直後に出せる質問${micros.length}
--        Tier A${tierCount('A')} / B${tierCount('B')} / C${tierCount('C')}
select
  (select count(*) from public.pv_condition_sections  where active)                as 節,
  (select count(*) from public.pv_condition_questions where active)                as 質問,
  (select count(*) from public.pv_condition_questions where active and micro)      as 直後に出せる質問,
  (select count(*) from public.pv_condition_questions where active and tier = 'A') as tier_a,
  (select count(*) from public.pv_condition_questions where active and boost > 0) as 最初の3問,
  (select count(*) from public.pv_condition_settings)                             as 設定;
`;
  writeFileSync(new URL('./db/conditions.generated.sql', import.meta.url), sql);
  console.log(`✅ db/conditions.generated.sql 書き出し: 節${SECTIONS.length} / 質問${QUESTIONS.length} / micro${micros.length}`);
}
