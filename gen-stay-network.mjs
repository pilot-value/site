/* ════════════════════════════════════════════════════════════════
   gen-stay-network.mjs
   db/stays.sql の pv_stay_network()（3-n ＝ 運営の「追加」が公開で足せる空港）を、会社ページのステイ先に並ぶ空港から書き直す。
     先行5社        … airline-destinations.mjs の NETWORK の list
     ほかの会社     … pv-airline-view.mjs の viewOf(slug).network の list（調べで確かめた就航地。一覧の無い会社は入れない）
   db/test-stays.mjs の ★N1 が、この2つと SQL を1字も違わずに突き合わせている（その検査と同じ作り方）。
   なぜ要るか：2026-10-29 に就航地を出す会社を 19 → 96社に広げたとき、手で写す一覧を直し忘れた（★N1 が赤くなって気づいた）。

   実行: node gen-stay-network.mjs           db/stays.sql の関数の中身だけを書き直す（何度流しても同じ）
         node gen-stay-network.mjs --check   書かずに比べるだけ（古ければ 1 で終わる）
   ⚠️ 書き直したら、オーナーが db/stays.sql を Supabase の SQL Editor に貼るまで、本番の運営の「追加」は古い一覧のまま。
   ════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NETWORK } from './airline-destinations.mjs';
import { SWITCH, LEAD } from './airline-rollout.mjs';
import { viewOf } from './pv-airline-view.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(ROOT, 'db', 'stays.sql');
const HEAD = 'create or replace function public.pv_stay_network()';
const OPEN = '  select jsonb_build_object(\n';
const CLOSE = '\n  );\n$fn$;';

const want = [
  ...Object.entries(NETWORK).map(([s, n]) => [s, n.list]),
  ...SWITCH.filter(s => !LEAD.includes(s)).map(s => [s, viewOf(s).network]).filter(([, n]) => n && n.list.length).map(([s, n]) => [s, n.list.map(d => d.iata)]),
];
const lines = codes => { const out = []; for (let i = 0; i < codes.length; i += 20) out.push('      ' + codes.slice(i, i + 20).join(' ')); return out.join('\n'); };
/* ⚠️ Postgres の関数は引数を100個までしか受け取らない（jsonb_build_object は1社で2個）。
   101社を1つに入れると、貼った瞬間に「cannot pass more than 100 arguments」で落ちる ＝ 40社ずつ作って || でつなぐ。 */
const PER = 40;
const pair = ([s, codes]) => `    '${s}', regexp_split_to_array(btrim('\n${lines(codes)}\n    ', E' \\n'), '\\s+')`;
const groups = [];
for (let i = 0; i < want.length; i += PER) groups.push(want.slice(i, i + PER).map(pair).join(',\n'));
const body = groups.join('\n  ) || jsonb_build_object(\n');

const src = fs.readFileSync(FILE, 'utf8');
const h = src.indexOf(HEAD);
const a = h < 0 ? -1 : src.indexOf(OPEN, h);
const b = a < 0 ? -1 : src.indexOf(CLOSE, a);
if (h < 0 || a < 0 || b < 0) { console.error('✗ db/stays.sql に pv_stay_network() の中身が見つからない'); process.exit(2); }
const next = src.slice(0, a + OPEN.length) + body + src.slice(b);   // 文字列の置き換え（String.replace の $ の罠を通らない）
const n = want.reduce((x, [, c]) => x + c.length, 0);
if (process.argv.includes('--check')) {
  if (next !== src) { console.log(`❌ db/stays.sql の pv_stay_network() が古い（node gen-stay-network.mjs を流す）── ${want.length}社・${n}空港`); process.exit(1); }
  console.log(`✓ pv_stay_network() は最新（${want.length}社・${n}空港）`);
} else if (next === src) console.log(`✓ 変更なし（${want.length}社・${n}空港）`);
else { fs.writeFileSync(FILE, next); console.log(`✓ db/stays.sql の pv_stay_network() を書いた（${want.length}社・${n}空港）── Supabase に貼るまで本番は古いまま`); }
