/* ════════════════════════════════════════════════════════════════
   gen-towns.mjs
   会社ページの「暮らし」のカードに出ている街の名前から、サーバの街の候補の種を書く。

     会社ページのカード（gen-airline-glance.mjs の ledgerTowns / baseCode）
        └─→ db/towns.generated.sql   （台帳の街・同じ街の別の書き方。オーナーが SQL Editor で流す）

   実行: node gen-towns.mjs            db/towns.generated.sql を書く
         node gen-towns.mjs --check    書かずに比べるだけ（違いを出し、古ければ 1 で終わる）

   ★名前はカードと同じ関数・同じ並びで読む（r.name を直接読まない ＝ カードと種の名前がずれない）。
   ★基地の3字は baseCode(v) の1つだけ。基地が無い会社・暮らしの台帳が無い会社には、1行も書かない
     （台帳に無い会社の街を、ここで打ち込まない）。
   ★2つの書き方が1つの鍵に畳まれるかは、ここでは決めない（鍵の式 pv_town_key を JS に写さない）。
     台帳の街を別の書き方へ変えないのは SQL の where、鍵がぶつからないことは db/test-towns.mjs の TG4 が見る。
   ★ここで止めるのは、1つの基地の中で字まで同じ名前が2つあるときと、別の書き方が同じ基地の街の名前と字まで同じときだけ。
════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLANCE, viewOf } from './pv-airline-view.mjs';
import { ledgerTowns, baseCode } from './gen-airline-glance.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
export const OUT = 'db/towns.generated.sql';

const q = s => `'${String(s).replace(/'/g, () => "''")}'`;
const list = rows => rows.map((r, i) => `    (${r.map(q).join(', ')})${i < rows.length - 1 ? ',' : ''}`).join('\n');

/* 種の行。main … [会社, 基地, 街]、alias … [会社, 基地, 街, 別の書き方] */
function seed() {
  const main = [], alias = [];
  for (const slug of GLANCE) {
    const v = viewOf(slug), base = baseCode(v);
    if (!v.living || !base) continue;
    const towns = ledgerTowns(v), names = new Set();
    for (const t of towns) {
      if (names.has(t.name)) throw new Error(`${slug} / ${base}: 同じ名前の街が2つある → ${t.name}`);
      names.add(t.name);
      main.push([slug, base, t.name]);
    }
    for (const t of towns) {
      if (!t.alias) continue;
      if (names.has(t.alias)) throw new Error(`${slug} / ${base}: 別の書き方が、同じ基地の街の名前と同じ → ${t.alias}`);
      alias.push([slug, base, t.name, t.alias]);
    }
  }
  return { main, alias };
}

export function build() {
  const { main, alias } = seed();
  const out = [
    '-- 生成物。手で直さない。直すのは台帳（living-facts.mjs ほか）→ node gen-towns.mjs',
    '-- 貼る順: db/towns.sql → **このファイル** → db/contrib.sql',
    'do $$',
    'begin',
    "  if to_regclass('public.pv_towns') is null or to_regprocedure('public.pv_town_key(text)') is null then",
    "    raise exception '先に db/towns.sql を実行してください（pv_towns / pv_town_key が無い）';",
    '  end if;',
    'end $$;',
    '',
  ];
  if (main.length) {
    out.push(
      '-- 1. 台帳の街（会社ページのカードの名前）',
      'insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, moderated_at)',
      "select v.airline, v.base, public.pv_town_key(v.name), v.name, 'ledger', 'public', now()",
      '  from (values',
      list(main),
      '  ) as v(airline, base, name)',
      'on conflict (airline, base_iata, tkey) do update set',
      "  name = excluded.name, origin = 'ledger', state = 'public', alias_of = null,",
      '  moderated_at = coalesce(public.pv_towns.moderated_at, excluded.moderated_at);',
      '',
    );
  }
  if (alias.length) {
    out.push(
      '-- 2. 同じ街の別の書き方（カードがラテン文字で添えている表記）。打った時点で、その街に入る。',
      '--    ★台帳の街そのものは、別の書き方に変えない（where の条件。鍵がぶつかったら、街のほうを残す）。',
      'insert into public.pv_towns (airline, base_iata, tkey, name, origin, state, alias_of, moderated_at)',
      "select v.airline, v.base, public.pv_town_key(v.alias), v.alias, 'ledger', 'public', t.id, now()",
      '  from (values',
      list(alias),
      '  ) as v(airline, base, name, alias)',
      '  join public.pv_towns t',
      '    on t.airline = v.airline and t.base_iata = v.base and t.tkey = public.pv_town_key(v.name) and t.alias_of is null',
      ' where public.pv_town_key(v.alias) is not null and public.pv_town_key(v.alias) <> t.tkey',
      'on conflict (airline, base_iata, tkey) do update set',
      "  name = excluded.name, origin = 'ledger', state = 'public', alias_of = excluded.alias_of,",
      '  moderated_at = coalesce(public.pv_towns.moderated_at, excluded.moderated_at)',
      "  where not (public.pv_towns.origin = 'ledger' and public.pv_towns.alias_of is null);",
      '',
    );
  }
  out.push(
    '-- 3. 別の書き方の行に付いていた投稿を、街の行へ移す（先に会員がその書き方で出していた場合。',
    '--    同じ人が両方に出していたら、街の行のほうを残す）。何度流しても同じ。',
    'delete from public.pv_town_posts s',
    ' using public.pv_towns a, public.pv_town_posts d',
    ' where s.town_id = a.id and a.alias_of is not null',
    '   and d.town_id = a.alias_of and d.author_hash = s.author_hash;',
    'update public.pv_town_posts s',
    '   set town_id = a.alias_of',
    '  from public.pv_towns a',
    ' where s.town_id = a.id and a.alias_of is not null;',
    '',
    '-- 検算：台帳の街と、別の書き方の数（会社・基地ごと）',
    'select t.airline, t.base_iata,',
    "       count(*) filter (where t.origin = 'ledger' and t.alias_of is null)     as 台帳の街,",
    "       count(*) filter (where t.origin = 'ledger' and t.alias_of is not null) as 別の書き方",
    '  from public.pv_towns t group by 1, 2 order by 1, 2;',
    '',
  );
  return out.join('\n');
}

/* ── 実行 ───────────────────────────────────────────── */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const file = path.join(ROOT, OUT);
  const want = build();
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (have === want) {
    console.log('✓ 変更なし');
  } else if (check) {
    const a = (have || '').split('\n'), b = want.split('\n');
    const A = new Set(a), B = new Set(b);
    for (const l of a) if (!B.has(l)) console.error(`- ${l}`);
    for (const l of b) if (!A.has(l)) console.error(`+ ${l}`);
    console.error(`❌ ${OUT} が古い（node gen-towns.mjs を流す）`);
    process.exit(1);
  } else {
    fs.writeFileSync(file, want);
    console.log(`✎ ${OUT}`);
  }
}
