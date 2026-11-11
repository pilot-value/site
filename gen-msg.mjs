/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — gen-msg.mjs（2026-11-02・多言語化の段2）
   共通の部品（JS）の辞書 { ja: {…}, en: {…} } に、機械で作る言語の辞書（es: {…}）を足す。

   使い方
     node gen-msg.mjs            訳の辞書（i18n/tm-<言語>.mjs）から es: {…} を書く（何度流しても同じ）
     node gen-msg.mjs --check    書かずに、変わる部品と訳の足りない項目の数だけ出す

   決まり
     ・es の辞書は en の辞書の写し。値（引用符の中の字）だけを訳で差し替える。鍵・並び・コード・コメントは en のまま。
     ・訳の辞書に無い値は英語のまま残す（スペイン語のページでも英語で出る＝壊れない）。
     ・書く場所は en: {…} の直後。/*PV-MSG:es*／ … /*／PV-MSG:es*／ の印の間だけを書き換える。手で直さない。
     ・部品が辞書をどう選ぶかは各部品の中（window.PV_T）。ここは辞書を足すだけ。
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsStrings, jsText } from './i18n-core.mjs';
import { LANGS } from './langs.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 辞書を持つ部品（スペイン語のページが読むもの） */
/* 対応表の形の名前（日本語の文 → 英語の文）。es は NAME_ES に書く */
const MAP_NAMES = ['L10N', 'PV_SEARCH_L10N', 'EN_WORD'];   // EN_WORD はトップの見本（lp.js）

export const MSG_FILES = ['pay-wizard.js', 'pay-login.js', 'payslip.js', 'pv-app.js', 'pv-follow.js', 'pv-gates.js', 'pv-give-first.js', 'app-nav.js',
  'pv-referral.js', 'pv-conditions.js', 'my-value.js', 'my-year.js', 'my-roster.js', 'roster-upload.js', 'my-analysis.js', 'actual-pay.js', 'pv-proof-offer.js', 'pv-proof.js', 'ap-preview.js', 'review-i18n.js',
  /* 段3（2026-11-02）：会社ページ・トップ */
  'career-live.js', 'career-stay.js', 'pv-contrib.js', 'lp.js', 'airlines/airline-reviews-ui.js',
  /* 2026-11-02：口コミ一覧（Vote） */
  'vote.js', 'career-card.js', 'pv-glance.js',
  /* 対応表の形（日本語 → 英語）：比べる図・検索 */
  'salary-leveling.js', 'search.js'];

const OPEN = (code) => `/*PV-MSG:${code}*/`;
const CLOSE = (code) => `/*/PV-MSG:${code}*/`;

/* 文字列とコメントを空白にした写し（波括弧・カンマを数えるため） */
function mask(src) {
  const a = src.split('');
  for (const s of jsStrings(src)) for (let k = s.start + 1; k < s.end - 1; k++) if (a[k] !== '\n') a[k] = ' ';
  let out = a.join('');
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/(^|[^:\\'"`])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  return out;
}
const closeOf = (m, i) => {          // m[i] は { [ ( のどれか。対応する閉じの位置
  const open = m[i]; const close = { '{': '}', '[': ']', '(': ')' }[open];
  let d = 0;
  for (let k = i; k < m.length; k++) { if (m[k] === open) d++; else if (m[k] === close) { d--; if (!d) return k; } }
  return -1;
};
/* オブジェクト { … }（o は { の位置）の、深さ1の「鍵: 値」を返す */
function props(src, m, o) {
  const end = closeOf(m, o); const out = [];
  let k = o + 1; let start = k; let depth = 0;
  const push = (a, b) => {
    const seg = m.slice(a, b);
    const c = seg.search(/:/);
    if (c < 0 || !seg.slice(0, c).trim()) return;
    const key = src.slice(a, a + c).trim().replace(/^['"]|['"]$/g, '');
    let vs = a + c + 1; while (/\s/.test(src[vs])) vs++;
    let ve = b; while (ve > vs && /[\s,]/.test(src[ve - 1])) ve--;
    out.push({ key, vs, ve });
  };
  for (; k < end; k++) {
    const ch = m[k];
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) { push(start, k); start = k + 1; }
  }
  push(start, end);
  return { end, list: out };
}

/* ファイルの中の言語の辞書（ja と en を持つオブジェクト）を全部 */
export function dicts(src) {
  const clean = src.replace(/(,\s*|\n[ \t]*)\/\*PV-MSG:[a-z-]+\*\/[\s\S]*?\/\*\/PV-MSG:[a-z-]+\*\//g, (m) => m.replace(/[^\n]/g, ' '));   // 前に書いた es は見ない（プロパティの形と変数の形）
  const m = mask(clean);
  const out = [];
  const re = /(^|[{,\s])en\s*:\s*\{/g;
  let r;
  while ((r = re.exec(m))) {
    const o = r.index + r[0].length - 1;
    /* 親のオブジェクトに ja: が在るか（言語の辞書かどうか） */
    let p = r.index, d = 0;
    for (; p >= 0; p--) { if (m[p] === '}') d++; else if (m[p] === '{') { if (!d) break; d--; } }
    if (p < 0) continue;
    const parent = props(clean, m, p);
    if (!parent.list.some((x) => x.key === 'ja')) continue;
    const en = props(clean, m, o);
    out.push({ form: 'prop', start: o, end: en.end + 1, list: en.list, ja: parent.list.find((x) => x.key === 'ja') });
  }
  /* 変数の形：var T = {日本語} と var T_EN = {英語}（career-live.js）。es は var T_ES = {…}; として T_EN の後ろに書く */
  const re2 = /\bvar\s+([A-Z][A-Z0-9_]*)_EN\s*=\s*\{/g;
  while ((r = re2.exec(m))) {
    const name = r[1];
    const o = r.index + r[0].length - 1;
    const en = props(clean, m, o);
    const jm = new RegExp('\\bvar\\s+' + name + '\\s*=\\s*\\{').exec(m);
    const jaObj = jm ? jm.index + jm[0].length - 1 : -1;
    let semi = en.end + 1; while (semi < m.length && /\s/.test(m[semi])) semi++;
    out.push({ form: 'var', name, start: o, end: en.end + 1, after: m[semi] === ';' ? semi + 1 : en.end + 1, list: en.list, jaObj });
  }
  /* 対応表の形（日本語 → 英語の表）。名前を名指しした表だけ */
  for (const name of MAP_NAMES) {
    const mm = new RegExp('(^|\\n)\\s*var\\s+' + name + '\\s*=\\s*\\{').exec(m);
    if (!mm) continue;
    const o = mm.index + mm[0].length - 1;
    const en = props(clean, m, o);
    if (en.list.some((x) => x.key === 'ja' || x.key === 'en')) continue;   // { ja: {…}, en: {…} } は言語の辞書（上の形が扱う）
    let semi = en.end + 1; while (semi < m.length && /\s/.test(m[semi])) semi++;
    out.push({ form: 'map', name, start: o, end: en.end + 1, after: m[semi] === ';' ? semi + 1 : en.end + 1, list: en.list });
  }
  /* ★ファイルの中の順に並べる（書くときは前から順に切り貼りする。2つの形が混ざる lp.js で位置がずれた・2026-11-02） */
  return out.sort((a, b) => a.start - b.start);
}

/* 訳す単位（値に人が読む英字があるもの）。key は 'js:' ＋ 値のソース */
export function msgUnits(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const units = [];
  for (const dct of dicts(src)) {
    const m = mask(src);
    const jaProps = dct.form === 'var' ? (dct.jaObj >= 0 ? props(src, m, dct.jaObj).list : []) : dct.ja ? props(src, m, src.indexOf('{', dct.ja.vs)).list : [];
    for (const p of dct.list) {
      const v = src.slice(p.vs, p.ve);
      if (!/[A-Za-z]{2,}/.test(jsText(v))) continue;
      const jp = jaProps.find((x) => x.key === p.key);
      units.push({ key: 'js:' + v, value: v, prop: dct.form === 'map' ? 'translation of a Japanese UI string' : p.key, file, ja: dct.form === 'map' ? p.key : jp ? jsText(src.slice(jp.vs, jp.ve)) : '' });
    }
  }
  return units;
}

/* es の辞書を書く */
function write(file, code, TM, CHECK) {
  const abs = path.join(ROOT, file);
  const orig = fs.readFileSync(abs, 'utf8');
  const re = new RegExp(`(,\\s*|\\n[ \\t]*)\\/\\*PV-MSG:${code}\\*\\/[\\s\\S]*?\\/\\*\\/PV-MSG:${code}\\*\\/`, 'g');
  const src = orig.replace(re, '');
  const tr = (k) => (TM[k] && ['validated', 'manual'].includes(TM[k].st) ? TM[k].es.slice(3) : null);
  let out = ''; let i = 0; let missing = 0; let done = 0;
  for (const dct of dicts(src)) {
    let block = ''; let k = dct.start;
    for (const p of dct.list) {
      const v = src.slice(p.vs, p.ve);
      if (!/[A-Za-z]{2,}/.test(jsText(v))) continue;
      const t = tr('js:' + v);
      if (!t) { missing++; continue; }
      block += src.slice(k, p.vs) + t; k = p.ve; done++;
    }
    block += src.slice(k, dct.end);
    if (dct.form === 'var' || dct.form === 'map') {
      out += src.slice(i, dct.after) + `\n  ${OPEN(code)} var ${dct.name}_${code.toUpperCase()} = ${block}; ${CLOSE(code)}`;   // var X_EN → X_ES ／ 対応表 L10N → L10N_ES
      i = dct.after;
    } else {
      out += src.slice(i, dct.end) + `, ${OPEN(code)} ${code}: ${block} ${CLOSE(code)}`;
      i = dct.end;
    }
  }
  out += src.slice(i);
  if (out !== orig && !CHECK) fs.writeFileSync(abs, out);
  return { changed: out !== orig, missing, done };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const CHECK = process.argv.includes('--check');
  for (const L of LANGS.filter((l) => !l.hand && !l.base?.startsWith?.('es-'))) {
    const tmFile = path.join(ROOT, 'i18n', `tm-${L.code}.mjs`);
    const { TM } = fs.existsSync(tmFile) ? await import(tmFile) : { TM: {} };
    let n = 0;
    console.log(`${CHECK ? '[check] ' : ''}${L.code}:`);
    for (const f of MSG_FILES) {
      const r = write(f, L.code, TM, CHECK);
      if (r.changed) n++;
      console.log(`  ${f.padEnd(20)} 訳した ${String(r.done).padStart(4)} / 英語のまま ${String(r.missing).padStart(3)}${r.changed ? (CHECK ? '  （変わる）' : '  （書いた）') : ''}`);
    }
    console.log(`  ${n} 本が${CHECK ? '変わる' : '変わった'}`);
  }
}
