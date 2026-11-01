/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — i18n-core.mjs（2026-11-01・多言語化の段1）
   英語のページから「訳す単位」を取り出し、訳した字を元の位置へ差し戻す部品。
   translate-tm.mjs（訳を作る）と gen-lang.mjs（訳したページを書く）がこれを呼ぶ。

   訳す単位
     ・本文の「ひと続きの文」。段落・見出し・表のマス・ボタンの中の、字と飾りのタグ（a・strong・span など）のまとまり。
       ブロックの要素（div・p・li・td・button・label …）の境目で切る。
     ・属性は alt / title / aria-label / placeholder の4つだけ。data-* やリンク先は触らない。
     ・単位の中のタグは番号の札に置き換えて AI に渡す（<g1>…</g1> は中身を訳すタグ、<x2/> はそのまま残す部品）。
       訳した字のタグは、札から元のタグを組み直すだけ ── AI が書いたタグ・属性・リンクは1つも通さない。

   訳さないもの
     script・style・noscript・template・textarea・pre・iframe などの中身／translate="no"・notranslate の要素／
     ドルの金額の span（class="pv-cur"・焼き込み済み）／code・kbd／svg・img・input（部品としてそのまま残す）／<!-- コメント -->。

   約束
     ・ページ全体を書き直さない。差し戻すのは訳した単位の字だけ（英語版との差分が訳だけになる）。
     ・差し戻しは位置（ソースの何文字目か）で行う。String.replace は使わない（$ の事故を起こさない）。
   ════════════════════════════════════════════════════════════════ */
import { parse } from 'parse5';

/* 中を見ない（訳さない・単位の境目になる） */
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'textarea', 'pre', 'iframe', 'object', 'video', 'audio', 'head']);
/* 文の中に混ざる飾りのタグ（中身も訳す） */
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'data', 'dfn', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'font']);
/* 文の中の「そのまま残す部品」（中身を訳さない） */
const ATOMIC = new Set(['br', 'wbr', 'img', 'input', 'svg', 'math', 'code', 'kbd', 'samp', 'var', 'canvas', 'picture']);
/* 訳す属性 */
export const ATTRS = ['alt', 'title', 'aria-label', 'placeholder'];

const attrOf = (el, name) => (el.attrs || []).find((a) => a.name === name)?.value;
const isEl = (n) => n && n.tagName !== undefined;
const noTranslate = (el) => attrOf(el, 'translate') === 'no'
  || /(^|\s)(notranslate|pv-cur)(\s|$)/.test(attrOf(el, 'class') || '');

/* 要素が「文の中に置ける」か（中にブロックを持たない飾りのタグ・部品） */
function inlineish(el) {
  if (ATOMIC.has(el.tagName) || noTranslate(el)) return true;
  if (!INLINE.has(el.tagName)) return false;
  return (el.childNodes || []).every((c) => !isEl(c) || inlineish(c));
}
/* 字（空白以外）を持つか。部品・訳さない要素の中の字は数えない */
function hasText(n) {
  if (n.nodeName === '#text') return /\S/.test(n.value);
  if (!isEl(n) || ATOMIC.has(n.tagName) || noTranslate(n)) return false;
  return (n.childNodes || []).some(hasText);
}
const collapse = (s) => s.replace(/[ \t\r\n\f]+/g, ' ');

/* 文字列の HTML 化（訳した字を差し戻すとき） */
export const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
export const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

/**
 * ページから訳す単位を取り出す。
 * @returns {{ units: Unit[], attrs: AttrUnit[] }}
 *   Unit     = { kind:'text', start, end, key, tags: Map<id,{open,close}|{raw}>, path, lead, trail }
 *   AttrUnit = { kind:'attr', start, end, key, name, quote, path }
 *   key は札つきで空白を1つに縮めた英語（訳の辞書のキー）。
 */
export function extract(html) {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const units = [];
  const attrs = [];

  const pathOf = (stack) => stack.join('>');

  /* inUnit ＝ 文の中のタグの属性。差し戻しは文の単位が restore() の中で一緒にやる（位置を重ねない）。 */
  function collectAttrs(el, stack, inUnit = false) {
    const loc = el.sourceCodeLocation?.attrs;
    if (!loc) return;
    for (const name of ATTRS) {
      const v = attrOf(el, name);
      if (v === undefined || !/[A-Za-z]/.test(v) || !loc[name]) continue;
      const raw = html.slice(loc[name].startOffset, loc[name].endOffset);
      const m = raw.match(/^[^=]+=\s*(["']?)/);
      if (!m) continue;
      const quote = m[1];
      const vStart = loc[name].startOffset + m[0].length;
      const vEnd = loc[name].endOffset - (quote ? 1 : 0);
      attrs.push({ kind: 'attr', start: vStart, end: vEnd, key: collapse(v).trim(), name, quote, path: pathOf(stack) + '@' + name, inUnit });
    }
  }

  function makeUnit(run, stack, idx) {
    let n = 0;
    const tags = new Map();
    const ser = (node) => {
      if (node.nodeName === '#text') return collapse(node.value);
      if (node.nodeName === '#comment') { const id = ++n; tags.set(id, { raw: html.slice(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset) }); return `<x${id}/>`; }
      const loc = node.sourceCodeLocation;
      if (ATOMIC.has(node.tagName) || noTranslate(node)) {
        if (node.tagName === 'img' || node.tagName === 'input') collectAttrs(node, [...stack, node.tagName], true);
        const id = ++n; tags.set(id, { raw: html.slice(loc.startOffset, loc.endOffset) }); return `<x${id}/>`;
      }
      collectAttrs(node, [...stack, node.tagName], true);
      const id = ++n;
      const open = html.slice(loc.startTag.startOffset, loc.startTag.endOffset);
      const close = loc.endTag ? html.slice(loc.endTag.startOffset, loc.endTag.endOffset) : '';
      tags.set(id, { open, close, startTag: loc.startTag.startOffset });
      return `<g${id}>${node.childNodes.map(ser).join('')}</g${id}>`;
    };
    const first = run[0].sourceCodeLocation;
    const last = run[run.length - 1].sourceCodeLocation;
    const raw = html.slice(first.startOffset, last.endOffset);
    const lead = raw.length - raw.trimStart().length;
    const trail = raw.length - raw.trimEnd().length;
    const key = run.map(ser).join('').replace(/ {2,}/g, ' ').trim();
    units.push({ kind: 'text', start: first.startOffset + lead, end: last.endOffset - trail, key, tags, path: pathOf(stack) + '#' + idx });
  }

  function walk(node, stack) {
    let run = [];
    let idx = 0;
    /* 間に字の無い飾りのタグの並び（メニューのリンクの列・「見出し」「必須」の札の並び）は1つの文ではない
       ＝ 字を持つ要素が2つ以上あって、そのあいだに字が1つも無ければ、要素ごとに中へ入って分ける。 */
    const flush = () => {
      if (!run.some(hasText)) { run = []; return; }
      /* 両端の空白・コメント・部品（アイコンの svg など）は単位に入れない（HTML にそのまま残る）。
         残りが飾りのタグ1つだけなら、その中へ入る（「<g1>HOME</g1>」ではなく「HOME」を訳す）。 */
      const edge = (c) => (c.nodeName === '#text' && !/\S/.test(c.value)) || c.nodeName === '#comment'
        || (isEl(c) && !hasText(c));
      while (run.length && edge(run[0])) run.shift();
      while (run.length && edge(run[run.length - 1])) run.pop();
      if (run.length === 1 && isEl(run[0])) {
        const el = run[0]; run = [];
        const label = `${el.tagName}~${idx++}`; collectAttrs(el, [...stack, label]); walk(el, [...stack, label]);
        return;
      }
      const bareText = run.some((c) => c.nodeName === '#text' && /\S/.test(c.value));
      const texty = run.filter((c) => isEl(c) && hasText(c));
      if (!bareText && texty.length >= 2) {
        for (const el of texty) { const label = `${el.tagName}~${idx++}`; collectAttrs(el, [...stack, label]); walk(el, [...stack, label]); }
      } else makeUnit(run, stack, idx++);
      run = [];
    };
    const counts = {};
    for (const ch of node.childNodes || []) {
      if (ch.nodeName === '#text' || ch.nodeName === '#comment') { run.push(ch); continue; }
      if (!isEl(ch)) continue;
      counts[ch.tagName] = (counts[ch.tagName] || 0) + 1;
      const label = `${ch.tagName}${attrOf(ch, 'id') ? '#' + attrOf(ch, 'id') : ''}:${counts[ch.tagName]}`;
      if (SKIP.has(ch.tagName)) { flush(); continue; }
      if (inlineish(ch)) { run.push(ch); continue; }
      flush();
      collectAttrs(ch, [...stack, label]);
      if (!noTranslate(ch)) walk(ch.tagName === 'template' ? ch.content : ch, [...stack, label]);
    }
    flush();
  }

  const htmlEl = doc.childNodes.find((c) => c.tagName === 'html');
  const body = htmlEl?.childNodes.find((c) => c.tagName === 'body');
  if (body) { collectAttrs(body, ['body']); walk(body, ['body']); }
  /* 部品の中の属性（img の alt など）も拾う */
  const atoms = (n, stack) => {
    for (const c of n.childNodes || []) {
      if (!isEl(c)) continue;
      if (c.tagName === 'img' || c.tagName === 'input') collectAttrs(c, [...stack, c.tagName]);
      atoms(c.tagName === 'template' ? c.content : c, [...stack, c.tagName]);
    }
  };
  if (body) atoms(body, ['body']);
  /* 同じ位置の属性を2回拾わない */
  const seen = new Set();
  const uniqAttrs = attrs.filter((a) => (seen.has(a.start) ? false : (seen.add(a.start), true)));
  return { units, attrs: uniqAttrs };
}

/* 札の一覧（<g1> </g1> <x2/>）── 訳の前後で同じ集合か比べるため */
export const tagSet = (s) => (s.match(/<\/?[gx]\d+\/?>/g) || []).sort().join(' ');

/**
 * 札つきの訳を HTML に戻す。札に無いタグ・属性は1つも通さない（<> は全部文字として書く）。
 * attrTr(name, english) → 訳（無ければ null）。飾りのタグの中の title なども訳す。
 */
export function restore(unit, text, attrTr = () => null) {
  if (tagSet(text) !== tagSet(unit.key)) throw new Error(`札が合わない: ${unit.key} → ${text}`);
  let out = '';
  let i = 0;
  const re = /<(\/?)([gx])(\d+)(\/?)>/g;
  let m;
  while ((m = re.exec(text))) {
    out += escText(text.slice(i, m.index));
    i = re.lastIndex;
    const t = unit.tags.get(Number(m[3]));
    if (m[2] === 'x') { out += /^<(img|input)\b/i.test(t.raw) ? translateTagAttrs(t.raw, attrTr) : t.raw; continue; }
    if (m[1]) { out += t.close; continue; }
    out += translateTagAttrs(t.open, attrTr);
  }
  return out + escText(text.slice(i));
}

/* 開きタグの中の訳す属性だけを差し替える */
function translateTagAttrs(open, attrTr) {
  let s = open;
  for (const name of ATTRS) {
    const re = new RegExp(`(\\s${name}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'i');
    const m = s.match(re);
    if (!m) continue;
    const tr = attrTr(name, collapse(decodeBasic(m[3])).trim());
    if (tr == null) continue;
    s = s.slice(0, m.index) + m[1] + m[2] + escAttr(tr) + m[2] + s.slice(m.index + m[0].length);
  }
  return s;
}
const decodeBasic = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/**
 * 差し戻し。edits = [{ start, end, text }]（重ならないこと）。後ろから当てる。
 */
export function splice(html, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let prev = Infinity;
  let out = html;
  for (const e of sorted) {
    if (e.end > prev) throw new Error(`差し戻しの位置が重なった: ${e.start}-${e.end}`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    prev = e.start;
  }
  return out;
}

/* 単位の札を外した素の字（AI の点検表・日本語との突き合わせ用） */
export const plain = (key) => key.replace(/<\/?[gx]\d+\/?>/g, '').replace(/ {2,}/g, ' ').trim();

/* 点検表の器（Artifact の決まりに合わせた断片：doctype・html・head・body は公開のときに付く） */
export function reportPage(rows, m) {
  const DARK = '--bg:#0f1512;--surface:#16201b;--ink:#e3ebe6;--mute:#97a69e;--line:#27342d;--brand:#62c49a;--warn:#e3a35a;--bad:#e6807d;--es:#cdeedc;color-scheme:dark';
  return '<title>スペイン語の試し訳</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">\n'
  + '<style>\n/* 表を1枚：英語 → スペイン語 → 日本語に戻した文。行の左端の色が採否。狭い画面では1行を1枚に積む */\n'
  + ':root{--bg:#f2f6f3;--surface:#ffffff;--ink:#15201a;--mute:#56645c;--line:#d8e1db;--brand:#1f6b4f;--warn:#a8590b;--bad:#a12d2d;--es:#0e3a2a;'
  + '--f-body:"Noto Sans JP","Hiragino Sans",system-ui,sans-serif;--f-es:"Source Serif 4",Georgia,serif}\n'
  + '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){' + DARK + '}}\n:root[data-theme="dark"]{' + DARK + '}\n'
  + 'body{background:var(--bg);color:var(--ink);font:15px/1.7 var(--f-body);padding-block:28px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}\n'
  + '.wrap{max-width:1280px;margin:0 auto;display:grid;gap:18px}\n'
  + 'h1{font-size:clamp(20px,3vw,26px);line-height:1.3;margin:0;text-wrap:balance;letter-spacing:-.01em}\n'
  + '.lead{color:var(--mute);margin:0;max-width:68ch}.lead b{color:var(--ink)}\n'
  + '.sum{display:flex;gap:8px;flex-wrap:wrap}\n'
  + '.chip{display:inline-flex;gap:7px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13px;font-variant-numeric:tabular-nums}\n'
  + '.chip i{width:8px;height:8px;border-radius:50%;background:var(--mute)}.chip.ok i{background:var(--brand)}.chip.rv i{background:var(--warn)}.chip.ng i{background:var(--bad)}\n'
  + '.tbl{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px;min-width:0}\n'
  + 'table{border-collapse:collapse;width:100%}\n'
  + 'th,td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}\n'
  + 'th{font-size:12px;font-weight:500;color:var(--mute);letter-spacing:.04em;white-space:nowrap}\n'
  + 'tr:last-child td{border-bottom:0}\n'
  + 'td.n{width:4.5em;color:var(--mute);font-variant-numeric:tabular-nums;border-left:4px solid var(--line)}\n'
  + 'tr.validated td.n{border-left-color:var(--brand)}tr.needs_review td.n{border-left-color:var(--warn)}tr.failed td.n{border-left-color:var(--bad)}\n'
  + 'td[lang="es"] b{font-family:var(--f-es);font-weight:600;font-size:16px;color:var(--es)}\n'
  + '.pg{font-size:11px;word-break:break-all;margin-top:2px}.ja,.sub{font-size:12.5px;color:var(--mute);margin-top:6px}\n'
  + '.memo{font-size:12.5px;color:var(--mute);min-width:13em}\n'
  + '@media (max-width:820px){table,tbody,tr,td{display:block}thead{display:none}tr{border-bottom:1px solid var(--line);border-left:4px solid var(--line);padding:10px 0}'
  + 'tr.validated{border-left-color:var(--brand)}tr.needs_review{border-left-color:var(--warn)}tr.failed{border-left-color:var(--bad)}'
  + 'td{border:0;padding:4px 14px}td.n{border-left:0;width:auto}td.memo{min-width:0}td::before{content:attr(data-h);display:block;font-size:11px;color:var(--mute);letter-spacing:.04em}td.n::before{display:none}}\n'
  + '</style>\n<div class="wrap">\n<h1>スペイン語（中南米）の試し訳</h1>\n'
  + '<p class="lead">英語の原文 → スペイン語の訳 → <b>そのスペイン語を日本語に戻した文</b>の順に並べています。いちばん見てほしいのは、日本語に戻した文が原文と同じ意味になっているかです。右端は AI の確認のメモです。</p>\n'
  + '<div class="sum"><span class="chip ok"><i></i>採用 ' + m.ok + '</span><span class="chip rv"><i></i>要確認 ' + m.review + '</span><span class="chip ng"><i></i>機械検査で落とした ' + m.failed + '</span><span class="chip"><i></i>AI の呼び出し ' + m.calls + '回・約 $' + m.usd + '</span></div>\n'
  + '<div class="tbl"><table><thead><tr><th>#</th><th>英語（原文）</th><th>スペイン語（訳）</th><th>日本語に戻した文</th><th>確認のメモ</th></tr></thead><tbody>\n' + rows + '\n</tbody></table></div>\n</div>\n';
}
