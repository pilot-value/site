/* ════════════════════════════════════════════════════════════════
   assert-i18n.mjs — 言語を足す仕組みの約束を、ファイルを読むだけで確かめる（2026-11-02・多言語化）
   実行: node assert-i18n.mjs   ネットワーク不要・何も書かない。

   見ること
     1) 機械で作る言語のページ（es/）の、画面に出る字に日本語が1文字も無い
     2) 訳の辞書（i18n/tm-<言語>.mjs）：状態が決まった値だけ・訳に日本語の字が無い・
        JS の訳はコードの形が原文と同じ（引用符の中だけ違う）
     3) 部品の辞書：書き足した es の各項目が、en の同じ項目とコードの形が同じ
     4) 表示通貨：メニューの通貨すべてに、全言語の名前・スペイン語の記号がある
     5) 会員の言語（db/profile-lang.sql）の一覧が langs.mjs の言語とそろっている
     6) pv-session.js の PV_LANG_PAGES が langs.mjs の pages とそろっている（gen-lang.mjs が書く）
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'parse5';
import { LANGS } from './langs.mjs';
import { jsShape } from './i18n-core.mjs';
import { MSG_FILES, dicts } from './gen-msg.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + String(e).slice(0, 500) : ''))); };
const JA = /[ぁ-んァ-ヶ一-龠]/;
const GEN = LANGS.filter((l) => !l.hand);

console.log('\n▼ 1) 機械で作る言語のページに日本語の字が出ていない');
for (const L of GEN) {
  for (const bare of L.pages) {
    const rel = L.dir + bare;
    if (!fs.existsSync(path.join(ROOT, rel))) { ok(false, `${rel} がある`, 'node gen-lang.mjs を流す'); continue; }
    const doc = parse(read(rel));
    const hits = [];
    const walk = (n) => {
      if (n.nodeName === '#text' && JA.test(n.value)) hits.push(n.value.trim().slice(0, 40));
      if (['script', 'style', 'noscript', 'template'].includes(n.tagName)) return;
      for (const a of n.attrs || []) if (['alt', 'title', 'aria-label', 'placeholder'].includes(a.name) && JA.test(a.value)) hits.push(a.value.slice(0, 40));
      (n.childNodes || []).forEach(walk);
    };
    walk(doc);
    ok(!hits.length, `${rel}：画面に出る字に日本語が無い`, hits.slice(0, 5).join(' / '));
  }
}

console.log('\n▼ 2) 訳の辞書');
for (const L of GEN) {
  const f = `i18n/tm-${L.code}.mjs`;
  if (!fs.existsSync(path.join(ROOT, f))) { ok(false, `${f} がある`); continue; }
  const { TM } = await import(path.join(ROOT, f));
  const ST = new Set(['validated', 'needs_review', 'manual']);
  const bad = [];
  for (const [k, v] of Object.entries(TM)) {
    if (!ST.has(v.st)) bad.push(`状態が変: ${v.st} ← ${k.slice(0, 40)}`);
    /* JS の訳は、元のコードにある日本語（正規表現・日本語の鍵）はそのまま残ってよい。元に無い日本語が増えたら落とす */
    const jaSet = (x) => new Set((x || '').match(/[ぁ-んァ-ヶ一-龠ー・（）]+/g) || []);
    const srcJa = jaSet(k);
    if ([...jaSet(v.es)].some((w) => !srcJa.has(w))) bad.push(`日本語の字: ${k.slice(0, 40)}`);
    const js = /^jsl?:/.test(k);
    if (js !== /^jsl?:/.test(v.es || '') || (js && k.slice(0, k.indexOf(':')) !== v.es.slice(0, v.es.indexOf(':')))) bad.push(`JS の印が合わない: ${k.slice(0, 40)}`);
    if (js) {
      const a = k.slice(k.indexOf(':') + 1), b = v.es.slice(v.es.indexOf(':') + 1);
      if (jsShape(a) !== jsShape(b)) bad.push(`コードの形が違う: ${a.slice(0, 50)}`);
    }
  }
  ok(!bad.length, `${f}：${Object.keys(TM).length} 件・状態・日本語・コードの形`, bad.slice(0, 6).join('\n     '));
}

console.log('\n▼ 3) 部品の辞書（en と書き足した言語の形が同じ）');
for (const file of MSG_FILES) {
  const src = read(file);
  const probs = [];
  for (const L of GEN) {
    const re = new RegExp(`\\/\\*PV-MSG:${L.code}\\*\\/\\s*(?:${L.code}:|var \\w+_${L.code.toUpperCase()} =)\\s*([\\s\\S]*?);?\\s*\\/\\*\\/PV-MSG:${L.code}\\*\\/`, 'g');
    const blocks = [...src.matchAll(re)].map((m) => m[1]);
    const ds = dicts(src);
    if (blocks.length !== ds.length) { probs.push(`${L.code} の辞書が ${blocks.length} 個・en は ${ds.length} 個（node gen-msg.mjs）`); continue; }
    ds.forEach((d, i) => { if (jsShape(src.slice(d.start, d.end)) !== jsShape(blocks[i])) probs.push(`${L.code} の ${i + 1} 個目の形が en と違う`); });
  }
  ok(!probs.length, `${file}`, probs.join(' / '));
}

console.log('\n▼ 4) 表示通貨の名前と記号');
{
  const c = read('currency.js');
  const order = (c.match(/var ORDER = \[([^\]]*)\]/) || [, ''])[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  const nameBlock = c.slice(c.indexOf('var NAME = {'), c.indexOf('};', c.indexOf('var NAME = {')));
  const symEs = (c.match(/var SYM_ES = \{([^}]*)\}/) || [, ''])[1];
  const label = (c.match(/var LABEL = \{([^}]*)\}/) || [, ''])[1];
  for (const lang of ['ja', 'en', ...GEN.map((l) => l.code)]) {
    const line = (nameBlock.match(new RegExp(`\\n\\s*${lang}: \\{([^}]*)\\}`)) || [, ''])[1];
    const miss = order.filter((k) => !new RegExp(`\\b${k}:`).test(line));
    ok(!miss.length, `通貨の名前（${lang}）がメニューの ${order.length} 通貨すべてにある`, miss.join(' '));
  }
  const missSym = order.filter((k) => k !== 'JPY' && !new RegExp(`\\b${k}:`).test(symEs));
  ok(!missSym.length, 'スペイン語の記号（SYM_ES）が円以外の全部にある', missSym.join(' '));
  const missLab = order.filter((k) => !new RegExp(`\\b${k}:`).test(label));
  ok(!missLab.length, 'メニューの札（LABEL）が全部にある', missLab.join(' '));
}

console.log('\n▼ 5) 会員の言語の一覧');
{
  const sql = read('db/profile-lang.sql');
  const want = LANGS.map((l) => `'${l.code}'`).join(', ');
  const lists = [...sql.matchAll(/in \(([^)]*)\)/g)].map((m) => m[1].trim());
  ok(lists.length >= 2 && lists.every((x) => x === want), `制約と関数の言語の一覧が langs.mjs（${want}）と同じ`, lists.join(' | '));
}

console.log('\n▼ 6) pv-session.js の PV_LANG_PAGES');
{
  const s = read('pv-session.js');
  const m = s.match(/\/\*PV-LANG-PAGES\*\/window\.PV_LANG_PAGES = ([\s\S]*?);\/\*\/PV-LANG-PAGES\*\//);
  const want = JSON.stringify(Object.fromEntries(GEN.map((l) => [l.code, l.pages])));
  ok(m && m[1] === want, 'langs.mjs の pages と同じ（違えば node gen-lang.mjs → node inject-session.mjs → node gen-lang.mjs）', m ? m[1] : '印が無い');
}

console.log(`\n==== ${pass}/${pass + fail} passed ====`);
process.exit(fail ? 1 : 0);
