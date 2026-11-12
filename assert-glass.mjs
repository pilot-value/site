#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   assert-glass.mjs — すりガラスと動き（2026-11-12・pv-glass.css / pv-glass.js / inject-glass.mjs）の静的な約束
   ① app-nav.css を読む全ページ（日英西）に <!--PV-GLASS--> の塊がちょうど1つ・中身は glassBlock と1文字も違わない
      （＝ pv-glass.* を直して inject-glass.mjs → gen-lang.mjs es を流し忘れると、ここで落ちる）
   ② 試作の名残（ui-trial.css / ui-trial.js）がどこにも無い
   ③ page-dates.mjs が塊を取り除いてから比べる（全ページが一斉に「今日直した」にならない）
   ④ pv-glass.js：本番の住所でも効く（手元だけの早帰りが無い）・自動の検査と検索のロボットと「動きを減らす」には動きを付けない
   ⑤ pv-glass.css：規則は全部 html[data-ui] の下（JS が読めないページでは1行も効かない）・transition-all を使わない
   動きそのもの（止まったあとに本当の形に戻っているか）は assert-glass-motion.mjs（ブラウザ）。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GLASS_DIRS, SKIP, BLOCK_RE, glassBlock, wantsGlass } from './inject-glass.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('✓  ' + msg); } else { fail++; console.log('✗  ' + msg + (extra ? '\n     ' + extra : '')); } };

console.log('\n① 全ページの PV-GLASS の塊');
const dirs = [...GLASS_DIRS, ['es', '../'], ['es/airlines', '../../'], ['es/countries', '../../']];
let pages = 0; const missing = [], wrong = [], twice = [];
for (const [dir, rel] of dirs) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.html'))) {
    const name = path.posix.join(dir === '.' ? '' : dir, f);
    if (SKIP.has(name)) continue;
    const html = fs.readFileSync(path.join(abs, f), 'utf8');
    if (!wantsGlass(html)) continue;
    pages++;
    const n = (html.match(/<!--PV-GLASS-->/g) || []).length;
    if (!n) { missing.push(name); continue; }
    if (n > 1) twice.push(name);
    if (html.match(BLOCK_RE)[0] !== glassBlock(rel)) wrong.push(name);
  }
}
ok(pages > 500, `対象のページを数えた（${pages}枚）`);
ok(missing.length === 0, '塊の無いページが無い', missing.slice(0, 8).join(' '));
ok(twice.length === 0, '塊が2つあるページが無い', twice.slice(0, 8).join(' '));
ok(wrong.length === 0, '塊の中身が glassBlock と1文字も違わない（指紋が新しい）── 直すなら node inject-glass.mjs → node gen-lang.mjs es', wrong.slice(0, 8).join(' '));
const admin = fs.existsSync(path.join(ROOT, 'admin.html')) ? fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8') : '';
ok(!/<!--PV-GLASS-->/.test(admin), '運営の画面（admin.html）には入れない');

console.log('\n② 試作の名残');
let left = '';
try { left = execSync("git grep -l -e 'ui-trial\\.css' -e 'ui-trial\\.js' -- '*.html' '*.js' '*.css'", { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { left = ''; }
ok(left === '', 'ui-trial.css / ui-trial.js を読むページ・部品が無い', left.split('\n').slice(0, 6).join(' '));
ok(!fs.existsSync(path.join(ROOT, 'ui-trial.js')) && !fs.existsSync(path.join(ROOT, 'ui-trial.css')), '試作のファイルそのものが無い');

console.log('\n③ 更新日');
const pd = fs.readFileSync(path.join(ROOT, 'page-dates.mjs'), 'utf8');
ok(/const GLASS = \/<!--PV-GLASS-->/.test(pd) && /\.replace\(GLASS, ''\)/.test(pd), 'page-dates.mjs が塊を取り除いてから比べる');

console.log('\n④ pv-glass.js');
const js = fs.readFileSync(path.join(ROOT, 'pv-glass.js'), 'utf8');
ok(!/if \(!LOCAL\) return/.test(js), '本番の住所でも効く（手元だけの早帰りが無い）');
ok(/navigator\.webdriver/.test(js) && /__pvMotion/.test(js), '自動の検査では動きを付けない（撮影と動きの検査だけ window.__pvMotion で動かす）');
ok(/prefers-reduced-motion: reduce/.test(js) && /\|\| BOT \|\| AUTO/.test(js), '「動きを減らす」・検索のロボット・自動の検査は同じ「動かさない」に入る');
ok(/hero-h1/.test(js), 'トップの大見出しは1字ずつに割らない（最初に描く絵の主役）');
ok(/backgroundClip|BackgroundClip/.test(js), '字の形に色を塗った見出しは割らない');

console.log('\n⑤ pv-glass.css');
const css = fs.readFileSync(path.join(ROOT, 'pv-glass.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const loose = [];
/* 塊の頭（{ の前）を1つずつ見る。@ の行・キーフレームの from/to/％・View Transitions の擬似要素は除く */
const heads = css.match(/[^{}]+\{/g) || [];
for (const h0 of heads) {
  const h = h0.slice(0, -1).trim();
  if (!h || h.startsWith('@') || /^(from|to|\d+%)(\s*,\s*(from|to|\d+%))*$/.test(h)) continue;
  for (const sel of h.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean)) {
    if (/::view-transition/.test(sel) || /^html\[data-ui\]/.test(sel) || /^html\.ut-pagevt/.test(sel)) continue;
    loose.push(sel);
  }
}
ok(loose.length === 0, '規則は全部 html[data-ui] の下（または切り替えの一瞬だけの名前）', loose.slice(0, 6).join(' ｜ '));
ok(!/transition\s*:\s*all|transition-all/.test(css), 'transition-all を使わない');

console.log(`\n==== ${pass}/${pass + fail} passed ====`);
if (fail) process.exit(1);
