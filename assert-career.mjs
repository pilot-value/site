/* ══════════════════════════════════════════════════════════════════
   assert-career.mjs — 概要と2社比較の1枚（career.html）

   この1枚は「普通に見えたまま静かに嘘になる」形をいくつも持っている。
   1つずつ見張る。

     ① 数字が正本とずれる ── 画面の額は gen-career.mjs が SALARY と BASIS から書く。
        ここでは**あちらの cell() を呼ばずに**同じ答えを作り直して突き合わせる
        （呼んでしまうと、あちらが間違えた日に検査も一緒に間違える）。
     ② 上限が平の額に見える ── 「〜」・斜線の棒・「上限」の字の3つが必ず一緒に出る。
        1つでも落ちると、求人の上限が推定年収と同じ顔で並ぶ。
        斜線は札（class）ではなく**描かれた模様**で見る。公表額の一覧でも「〜」と「上限」が対。
     ③ 目盛が歪む ── 棒は 0 から・全部の棒が同じ目盛・描かれた長さが額に比例する。
        棒の土台が全部同じ位置・同じ幅で、目盛の両端がそこに合っていることまで測る。
     ④ 概要と比較で同じ会社の額が違う（候補で実際に起きていた形）。
     ⑤ 住所と「戻る」── 画面ごとに住所があり、戻る・進む・直接開くで同じ画面に戻る。
        戻っても進んでも、見ていた位置に出る。会社の選び直しと入れ替えは履歴を積まない。
        入れ替えは置き場所ごと（読み上げと Tab の順が画面と同じ）。
     ⑥ 通貨 ── 切り替えると全部の額が変わり、円に戻すと1文字も違わない。
        原貨の額と出どころは変わらない。
     ⑦ 大きさ ── 年収が最初の1画面に入る・横に溢れない・字 12px 以上・押す場所 44px 以上。
        どの通貨に切り替えても、額が箱からはみ出さない（狭い幅と広い幅の両方で測る）。
        目盛の字どうしがくっつかない（字数の多い通貨で、2つの額が1つの数に見える）。
     ⑧ 写真 ── 台帳に在る写真だけ・撮影情報が残っていない・
        作者とライセンスを示すことが条件の写真には必ずクレジットが付いている（読める形で）・
        クレジットの中に台帳に無い文言が無い。
     ⑩ 出どころ ── 「会社が公表している金額」の下に、会社の公表ではない資料（報道など）を並べない。
     ⑨ 登録の対 ── NOINDEX の3つ・JA_ONLY の2つ。1つ忘れても何も赤くならない。

   使い方（node serve.mjs を起動した状態で）
     node assert-career.mjs
   ══════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS, TIERS, figures, cardFigure } from './salary-basis.mjs';
import { PHOTOS, PHOTO_DIR, SMALL_W, needsCredit, primary, smallH, src as photoSrc } from './airline-photos.mjs';
import { render, FIVE, PAIR, ROLES, PAGE } from './gen-career.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const BASE = 'http://localhost:3000';
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length * 2))}`);

const HTML = read(PAGE);
const CSS = read('career.css');
const JS = read('career.js');

/* 「書いていないこと」を見る検査は、コメントを外してから見る
   （禁則そのものが、相手のファイルの注意書きに一字一句書いてある）。 */
const noCssCmt = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ');
const noJsCmt = t => noCssCmt(t).replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, h) => h);
const noTagCmt = t => t.replace(/<!--[\s\S]*?-->/g, ' ');
const CSSC = noCssCmt(CSS);
const JSC = noJsCmt(JS);

const name = s => SALARY[s].ja;
const yen = m => `¥${m.toLocaleString('en-US')}万`;
/* 鍵の名前の末尾で決まる言い添え（年収の下限・手当の下限）。 */
const tail = key => (/_over$/.test(key) ? '超' : /_from$/.test(key) ? 'から' : '');
/* 鍵の名前の頭で決まる印（求人の上限）。公表額の一覧では額の頭に「〜」が付く。 */
const upTo = key => (/^max_/.test(key) ? '〜' : '');

/* ══════════════════════════════════════════════════════════════════
   A) 生成物と、数字を持たない2つのファイル
   ══════════════════════════════════════════════════════════════════ */
head('生成物');
ok(render(HTML) === HTML, `${PAGE} は gen-career.mjs の出力と1文字も違わない`,
   'node gen-career.mjs を流す（career.css / career.js を直したあとも）');

const BLOCK = (HTML.match(/<!--PV-CAREER-->([\s\S]*)<!--\/PV-CAREER-->/) || [])[1] || '';
ok(BLOCK.length > 0, '管理ブロックが在る');
/* 管理ブロックの外に金額が1つも無い（手で足した額は、正本を直しても動かない）。 */
const OUTSIDE = noTagCmt(HTML.replace(BLOCK, () => '')).replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
ok(!/[¥$]\s?\d|\d\s*万/.test(OUTSIDE), '管理ブロックの外に金額が無い', (OUTSIDE.match(/.{0,12}(?:[¥$]\s?\d|\d\s*万).{0,12}/) || [''])[0]);

ok(!/[¥万円]/.test(JSC), 'career.js に金額の字（¥・万・円）が無い');
ok(!/\d{3,}/.test(JSC), 'career.js に3けた以上の数が無い', (JSC.match(/.{0,20}\d{3,}.{0,20}/) || [''])[0]);
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(JSC), 'career.js は HTML を組み立てない（見せる・隠すだけ）');

head('career.css');
ok(!/#[0-9a-fA-F]{3,8}\b/.test(CSSC), '色の直書き（hex）が無い', (CSSC.match(/.{0,20}#[0-9a-fA-F]{3,8}\b/) || [''])[0]);
ok(!/\b(?:rgba?|hsla?)\(/.test(CSSC), '色の直書き（rgb / hsl）が無い');
ok(!/prefers-color-scheme/.test(CSSC), 'prefers-color-scheme を書いていない（ダークはトークンが差し替える）');
{
  /* 動かすのは transform と opacity だけ。 */
  const moved = [...CSSC.matchAll(/transition\s*:\s*([^;}]+)/g)]
    .flatMap(m => m[1].replace(/\([^()]*\)/g, '').split(','))
    .map(s => s.trim().split(/\s+/)[0]);
  ok(moved.length > 0 && moved.every(p => ['transform', 'opacity', 'none'].includes(p)),
     'transition は transform と opacity だけ', [...new Set(moved)].join(', '));
  const frames = [...CSSC.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .flatMap(m => [...m[1].matchAll(/([\w-]+)\s*:/g)].map(x => x[1]));
  ok(frames.length > 0 && frames.every(p => ['transform', 'opacity'].includes(p)),
     'アニメーションは transform と opacity だけ', [...new Set(frames)].join(', '));
  ok(/prefers-reduced-motion\s*:\s*reduce/.test(CSSC), '動きを減らす設定の人には動かさない');
  /* 押せるものには hover / focus-visible / active を全部（下の「押せるものの種類」と対）。 */
  const need = [
    '.cr a:focus-visible', '.cr button:focus-visible', '.cr summary:focus-visible', '.cr-sel:focus-visible',
    '.cr-tile:hover', '.cr-tile:active', '.cr-back:hover', '.cr-back:active', '.cr-btn:hover', '.cr-btn:active',
    '.cr-link:hover', '.cr-link:active', '.cr-card-n:hover', '.cr-card-n:active',
    '.cr-swap:hover', '.cr-swap:active', '.cr-side:hover', '.cr-side:active',
    'summary:hover', 'summary:active', '.cr-credits a:hover', '.cr-credits a:active',
    '.cr-srcs a:hover', '.cr-srcs a:active',
  ];
  const lack = need.filter(s => !CSSC.includes(s));
  ok(!lack.length, '押せるものに hover / focus-visible / active が全部ある', lack.join(' / '));
}

/* ══════════════════════════════════════════════════════════════════
   B) 言っていること（画面に出る文字）
   ══════════════════════════════════════════════════════════════════ */
head('文言');
const TEXT = noTagCmt(BLOCK).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
ok(/次のキャリアを、\s*選択する。/.test(TEXT), '入口の見出しは「次のキャリアを、選択する。」');
ok(!/平均年収/.test(TEXT), '「平均年収」と書かない（推定を平均と呼ばない）');
ok(!/公式(?:サイト)?では(?:ない|ありません|ございません)|非公式|公式のものでは/.test(TEXT), '「公式ではない」の断りを置かない（オーナー判断 2026-10-03）');
ok(!/(?<![\d,.])0\s*万円|¥\s?0万/.test(TEXT), '「0万円」を出さない');
/* 「2社の比較」は社数ではない。3社以上の数（1けたも・全角も）を社数として見る。 */
ok(!/(?<![\d０-９])(?:[3-9３-９]|[\d０-９]{2,})\s*社/.test(noTagCmt(HTML).replace(/<script\b[\s\S]*?<\/script>/g, ' ')), '掲載社数を書かない');
ok(!/総合順位|ランキング|[\d０-９]\s*位|首位|トップ|勝ち|負け|勝る|劣る|圧勝|優位/.test(TEXT), '順位・勝ち負けの語を書かない');
ok(!/[★☆⭐✩✪✭✮✯]/u.test(TEXT), '星を出さない');

/* ══════════════════════════════════════════════════════════════════
   C) 登録の対（CLAUDE.md「ページを1枚足すとき」）
   ══════════════════════════════════════════════════════════════════ */
head('登録');
/* その集合の「[ から最初の ])」までだけを見る（後ろに続く別の集合に在っても通さない）。 */
const inSet = (file, set) => {
  const t = read(file);
  const from = t.indexOf(`const ${set} = new Set([`);
  const to = from < 0 ? -1 : t.indexOf('])', from);
  return to > from && t.slice(from, to).includes(`'${PAGE}'`);
};
for (const f of ['gen-sitemap.mjs', 'seo-normalize.mjs', 'assert-seo.mjs']) ok(inSet(f, 'NOINDEX'), `${f} の NOINDEX に在る`);
for (const f of ['seo-normalize.mjs', 'assert-seo.mjs']) ok(inSet(f, 'JA_ONLY'), `${f} の JA_ONLY に在る（日本語だけ）`);
ok(new RegExp(`'${PAGE.replace('.', () => '\\.')}'\\s*:\\s*\\{\\s*ja\\s*:`).test(read('seo-normalize.mjs')), 'seo-normalize.mjs の COPY に題名が在る');
ok(/<meta name="robots" content="noindex,follow"\s*\/?>/.test(HTML), '検索に出さない（noindex）');
ok(!read('sitemap.xml').includes(PAGE), 'sitemap.xml に載っていない');
ok(!fs.existsSync(path.join(ROOT, 'en', PAGE)), `en/${PAGE} は無い（置いたら JA_ONLY の2つから外す）`);
ok(!/hreflang="en"/.test(HTML), '英語版への hreflang を出していない');
ok(read('assert-founding.mjs').includes(`'${PAGE}'`), 'assert-founding.mjs の除外リストに在る');
ok(read('assert-header.mjs').includes(`'/${PAGE}`), 'assert-header.mjs が測っている');
ok(read('assert-generated.mjs').includes(`'gen-career.mjs'`), 'assert-generated.mjs が流し忘れを見ている');
ok(read('check.mjs').includes(`'assert-career.mjs'`), 'check.mjs の一式にこの検査が入っている');
/* メニューにはまだ載せない（オーナーが形を決めるまでの下見用）。 */
ok(!read('patch-side-nav.mjs').includes(PAGE), '左メニューにまだ載せていない');

/* ══════════════════════════════════════════════════════════════════
   D) 写真の台帳 ⇄ ファイル ⇄ HTML
   ══════════════════════════════════════════════════════════════════ */
head('写真（台帳とファイル）');
/* JPEG の節を頭から歩いて、大きさと「撮影情報の節があるか」を読む。 */
function jpeg(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let o = 2, w = 0, h = 0;
  const meta = [];
  while (o + 4 <= buf.length && buf[o] === 0xFF) {
    const m = buf[o + 1];
    if (m === 0xDA || m === 0xD9) break;
    const len = buf.readUInt16BE(o + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { h = buf.readUInt16BE(o + 5); w = buf.readUInt16BE(o + 7); }
    /* APP1＝Exif / XMP、APP13＝IPTC、COM＝コメント。カメラと編集ソフトが書くのはこの3つ。 */
    if (m === 0xE1 || m === 0xED || m === 0xFE) meta.push('FF' + m.toString(16).toUpperCase());
    o += 2 + len;
  }
  return { w, h, meta };
}
const LEDGER = Object.entries(PHOTOS).flatMap(([slug, list]) => list.map(p => ({ slug, ...p })));
const BY_SRC = new Map();
for (const p of LEDGER) {
  BY_SRC.set(photoSrc(p), { p, w: p.w, h: p.h });
  BY_SRC.set(photoSrc(p, true), { p, w: SMALL_W, h: smallH(p) });
}
{
  const onDisk = fs.readdirSync(path.join(ROOT, PHOTO_DIR)).filter(f => !f.startsWith('.')).sort();
  const want = [...BY_SRC.keys()].map(s => path.basename(s)).sort();
  ok(same(onDisk, want), `${PHOTO_DIR}/ に在るのは台帳の写真だけ（大小2枚ずつ・${want.length}枚）`,
     `余り: ${onDisk.filter(f => !want.includes(f)).join(', ') || 'なし'} ／ 不足: ${want.filter(f => !onDisk.includes(f)).join(', ') || 'なし'}`);
  const wrong = [];
  for (const [s, x] of BY_SRC) {
    const file = path.join(ROOT, s);
    if (!fs.existsSync(file)) continue;
    const j = jpeg(fs.readFileSync(file));
    if (!j) { wrong.push(`${s}: JPEG ではない`); continue; }
    if (j.w !== x.w || j.h !== x.h) wrong.push(`${s}: 実物 ${j.w}×${j.h} / 台帳 ${x.w}×${x.h}`);
    if (j.meta.length) wrong.push(`${s}: 撮影情報の節が残っている（${j.meta.join(' ')}）`);
  }
  ok(!wrong.length, '写真の大きさが台帳どおり・撮影情報が残っていない', wrong.join('\n      '));
  const bad = LEDGER.filter(p => !p.source || !p.author || !p.licence || !p.aircraft
    || (needsCredit(p) && (!/^https:\/\//.test(p.licence_url || '') || !p.changes)));
  ok(!bad.length, '台帳の全部の写真に 出所・作者・ライセンス・機種 が在る', bad.map(p => p.file).join(', '));
  /* ライセンスは、使う条件を確かめてある3種だけ（名前とリンクが対）。
     知らないライセンスや書き間違いは「示す条件あり」に倒れるが、商用不可・改変不可はそもそも使えない。 */
  const LICENCES = {
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0',
    'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0',
  };
  const odd = LEDGER.filter(p => LICENCES[p.licence] !== p.licence_url);
  ok(!odd.length, '台帳のライセンスは条件を確かめてある3種だけ（名前とリンクが対）', odd.map(p => `${p.file}: ${p.licence}`).join(', '));
  ok(LEDGER.every(p => needsCredit(p) === (p.licence !== 'CC0')), 'クレジットを出さなくてよいのは CC0 だけ');
  ok(FIVE.every(s => primary(s)), '先行5社すべてに写真が在る');

  const imgs = [...BLOCK.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  const off = [];
  for (const tag of imgs) {
    const at = k => (tag.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const big = BY_SRC.get(at('src'));
    if (!big) { off.push(`台帳に無い写真: ${at('src')}`); continue; }
    if (String(big.w) !== at('width') || String(big.h) !== at('height')) off.push(`${at('src')}: width / height が台帳と違う`);
    if (at('srcset') !== `${photoSrc(big.p, true)} ${SMALL_W}w, ${photoSrc(big.p)} ${big.p.w}w`) off.push(`${at('src')}: srcset が台帳と違う`);
    /* 写真の説明は「会社名の 機種」。機種は写真の台帳のもので、年収の対象機種とは別。 */
    if (at('alt') !== `${name(big.p.slug)}の ${big.p.aircraft}`) off.push(`${at('src')}: alt「${at('alt')}」`);
  }
  ok(imgs.length > 0 && !off.length, `HTML の写真 ${imgs.length}か所が全部台帳どおり`, off.join('\n      '));
  ok(!/data:image\/(?:jpe?g|png|webp)/.test(BLOCK), '写真を文字にして埋め込んでいない');
}

/* ══════════════════════════════════════════════════════════════════
   E) ここからブラウザ
   ══════════════════════════════════════════════════════════════════ */
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const trouble = [];   // ページの中の例外と、読めなかった自サイトのファイル

const ready = page => page.waitForFunction(() =>
  !document.documentElement.classList.contains('cr-boot') && !!window.PVCurrency
  && !!document.querySelector('#cr .cr-view:not([hidden])'));
/* 字と動きが落ち着くまで待つ（時間では待たない）。 */
const settle = page => page.evaluate(async () => {
  await document.fonts.ready;
  const mine = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#cr'));
  await Promise.all(mine.map(a => a.finished.catch(() => {})));
});
async function open(q = '', w = 390, h = 680, opt = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => trouble.push(`${q || '（入口）'}: ${e.message}`));
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) trouble.push(`${r.status()} ${r.url()}`); });
  await page.setViewport({ width: w, height: h });
  if (opt.js === false) await page.setJavaScriptEnabled(false);
  if (opt.block) {
    await page.setRequestInterception(true);
    page.on('request', r => (r.url().includes(opt.block) ? r.abort() : r.continue()));
  }
  await page.goto(`${BASE}/${PAGE}${q}`, { waitUntil: 'load' });
  if (opt.js !== false) await ready(page);
  return { page, close: () => ctx.close() };
}
const go = async (page, q) => { await page.goto(`${BASE}/${PAGE}${q}`, { waitUntil: 'load' }); await ready(page); };
const search = page => page.evaluate(() => location.search);
const until = (page, q) => page.waitForFunction(x => location.search === x, { timeout: 5000 }, q).then(() => true, () => false);
/* いま見えている画面（1つだけのはず）。 */
const view = page => page.evaluate(() => [...document.querySelectorAll('#cr .cr-view')].filter(v => !v.hidden)
  .map(v => v.dataset.view + (v.dataset.airline ? ':' + v.dataset.airline : '')).join(' + '));

try {
  /* ── ①〜④ 数字 ───────────────────────────────────────────────── */
  head('数字（正本との突き合わせ）');
  const { page, close } = await open('?view=compare');
  const dom = await page.evaluate(() => {
    const t = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const bar = el => (el ? { cls: [...el.classList], w: el.style.getPropertyValue('--w').trim() } : null);
    const pub = root => ({
      none: t(root.querySelector('.cr-none')),
      rows: [...root.querySelectorAll('.cr-grp')].flatMap(g => {
        const tag = t(g.querySelector('.cr-grp-k .cr-tag'));
        return [...g.querySelectorAll('.cr-fig')].map(f => ({
          tag, group: t(g.querySelector('.cr-grp-k')).slice(tag.length).trim(),
          kind: t(f.querySelector('dt')), amount: t(f.querySelector('dd b')), orig: t(f.querySelector('.cr-orig')) || '',
        }));
      }),
      srcs: [...root.querySelectorAll('.cr-srcs a')].map(a => a.getAttribute('href')),
      basis: !!root.querySelector('.cr-basis'),
    });
    const out = {};
    for (const sec of document.querySelectorAll('#cr .cr-view[data-view="airline"]')) {
      const s = sec.dataset.airline;
      const o = out[s] = { h1: t(sec.querySelector('.cr-h1')), ov: {}, cmp: {}, tax: t(sec.querySelector('.cr-pay .cr-tax')), pub: pub(sec.querySelector('.cr-pub')) };
      for (const n of sec.querySelectorAll('.cr-num')) {
        o.ov[n.dataset.role] = {
          name: t(n.querySelector('.cr-vh')), role: t(n.querySelector('.cr-num-r')), v: t(n.querySelector('.cr-num-v')),
          tag: t(n.querySelector('.cr-tag')), sub: t(n.querySelector('.cr-sub')) || '',
          bar: bar(sec.querySelector('.cr-mini .cr-fill.is-' + n.dataset.role)),
        };
      }
    }
    for (const pair of document.querySelectorAll('#cr .cr-cmp .cr-pair')) {
      for (const row of pair.querySelectorAll('.cr-row')) {
        out[row.dataset.airline].cmp[pair.dataset.role] = {
          name: t(row.querySelector('.cr-row-co')), role: t(row.querySelector('.cr-vh')), v: t(row.querySelector('.cr-row-v')),
          tag: t(row.querySelector('.cr-tag')), sub: t(row.querySelector('.cr-sub')) || '',
          bar: bar(row.querySelector('.cr-fill')),
        };
      }
    }
    for (const card of document.querySelectorAll('#cr .cr-cmp .cr-card')) out[card.dataset.airline].card = pub(card.querySelector('.cr-pub'));
    for (const p of document.querySelectorAll('#cr .cr-cmp .cr-taxes .cr-tax')) out[p.dataset.airline].cmpTax = t(p.querySelector('span'));
    return {
      co: out,
      order: [...document.querySelectorAll('#cr .cr-view[data-view="airline"]')].map(s => s.dataset.airline),
      axes: [...document.querySelectorAll('#cr .cr-axis')].map(a => [...a.children].map(c => c.textContent.trim())),
      div: document.getElementById('cr').style.getPropertyValue('--cr-div').trim(),
      def: [document.getElementById('cr').dataset.a, document.getElementById('cr').dataset.b],
    };
  });

  ok(same(dom.order, FIVE), '概要は先行5社ぶん', dom.order.join(', '));
  ok(same(dom.def, PAIR), '比較を社名なしで開いたときの2社', dom.def.join(' × '));

  /* 額の作り直し。会社が公表した年額があればそれ・無ければ推定（会社ページのカードと同じ決め方）。 */
  const want = (slug, rank) => {
    const tier = BASIS[slug]?.[rank]?.tier;
    const c = cardFigure(slug, rank);
    if (!c || c.held || !TIERS[tier]) return null;
    if (c.estimate) { const avg = SALARY[slug][rank].avg; return { man: avg, text: yen(avg), tag: TIERS[tier].ja, up: false, over: false }; }
    const hits = figures(slug, rank).filter(x => !x.training && x.man === c.man);
    if (hits.length !== 1) return null;
    const f = hits[0];
    return { man: c.man, text: c.yen + tail(f.key), tag: TIERS[tier].ja, up: !!c.up, over: /_over$/.test(f.key) };
  };

  const axisMax = Math.round(Number(dom.div) * 1000);
  const mans = [];
  for (const s of FIVE) {
    for (const [r, label] of ROLES) {
      const w = want(s, r), a = dom.co[s].ov[r], b = dom.co[s].cmp[r];
      const who = `${name(s)} ${label}`;
      if (!w || !a || !b) { ok(false, `${who}: 額が出ている`); continue; }
      mans.push(w.man);
      ok(a.v === w.text && b.v === w.text, `${who} ＝ ${w.text}（概要と比較で同じ）`, `概要「${a.v}」／比較「${b.v}」`);
      ok(a.name === name(s) && a.role === label && b.name === name(s) && b.role === label, `${who}: 社名と職位が額のそばに在る`);
      for (const [where, x] of [['概要', a], ['比較', b]]) {
        ok(x.tag === w.tag || (w.up && x.tag === `${w.tag}（上限）`), `${who}（${where}）: 札は「${w.tag}」`, `「${x.tag}」`);
        const up = [x.v.startsWith('〜'), x.bar.cls.includes('is-max'), (x.tag + x.sub).includes('上限')];
        ok(up.every(v => v === w.up), `${who}（${where}）: 上限の印が3つそろっている（〜・斜線・「上限」の字）`, up.join(' / '));
        const over = [x.v.endsWith('超'), x.bar.cls.includes('is-over')];
        ok(over.every(v => v === w.over), `${who}（${where}）: 「超」の印が2つそろっている`, over.join(' / '));
        ok(x.bar.w === `${Math.round(w.man / axisMax * 1000) / 10}%`, `${who}（${where}）: 棒の長さが額に比例`, x.bar.w);
      }
      ok(a.tag === b.tag && a.sub === b.sub, `${who}: 札と一言が概要と比較で同じ`);
    }
    ok(dom.co[s].h1 === name(s), `${name(s)}: 見出しが社名`);
    ok(dom.co[s].tax === BASIS[s].tax && dom.co[s].cmpTax === BASIS[s].tax, `${name(s)}: 税の扱いが台帳どおり（概要と比較）`, `${dom.co[s].tax} ／ ${dom.co[s].cmpTax}`);
  }

  /* 目盛。0 から・全部の棒が入る・いちばん近い 1,000万 の倍数・どの画面も同じ。 */
  const top = Math.max(...mans);
  ok(axisMax % 1000 === 0 && axisMax >= top && axisMax - 1000 < top, `目盛の右端 ${yen(axisMax)} は全部の棒が入るいちばん近い 1,000万 の倍数`, `最大の棒 ${yen(top)}`);
  ok(dom.axes.length === FIVE.length + 1 && dom.axes.every(a => same(a, ['0', yen(axisMax / 2), yen(axisMax)])),
     '目盛は 0 から・どの画面も同じ', JSON.stringify(dom.axes[0]));

  /* 会社が公表している金額。訓練生は出さない。 */
  head('会社が公表している金額');
  for (const s of FIVE) {
    const exp = ['cap', 'fo', 'crew'].flatMap(r => figures(s, r).filter(f => !f.training).map(f => ({
      tag: TIERS[BASIS[s][r].tier].ja, group: f.group, kind: f.kind, amount: upTo(f.key) + f.text + tail(f.key),
      orig: f.cur === 'JPY' ? '' : `${upTo(f.key)}${f.cur} ${f.amount.toLocaleString('en-US')}${tail(f.key) ? ' ' + tail(f.key) : ''}`,
    })));
    const got = dom.co[s].pub;
    ok(same(got.rows, exp), `${name(s)}: 台帳の ${exp.length}件がそのまま出ている（札・区分・名前・額・原貨）`,
       `画面 ${JSON.stringify(got.rows)}\n      台帳 ${JSON.stringify(exp)}`);
    ok(exp.length ? got.none === null : got.none === '公表なし', `${name(s)}: ${exp.length ? '「公表なし」と書いていない' : '「公表なし」'}`);
    ok(same(dom.co[s].card, got), `${name(s)}: 比較のカードと概要で同じ中身`);
    /* 上限の額は、一覧でも「〜」と「上限」の字が対（原貨の額にも「〜」）。 */
    ok(got.rows.every(x => x.amount.startsWith('〜') === /上限/.test(x.kind) && (!x.orig || x.orig.startsWith('〜') === /上限/.test(x.kind))),
       `${name(s)}: 一覧の上限の額には「〜」と「上限」の字がそろっている`, got.rows.map(x => `${x.kind} ${x.amount} ${x.orig}`).join(' ／ '));
    /* 出どころは「会社が公表した資料」だけ・台帳のものが全部。報道など（secondary）と訓練生の資料は並べない。 */
    const urls = exp.length ? (BASIS[s].src || []).filter(x => !x.secondary && !/訓練生|自社養成/.test(x.name)).map(x => x.url) : [];
    ok(same(got.srcs, urls) && (!exp.length || urls.length > 0),
       `${name(s)}: 出どころは台帳の「会社が公表した資料」そのまま${exp.length ? `（${urls.length}つ）` : '（公表なしなので出さない）'}`,
       `画面 ${got.srcs.join(', ')}\n      台帳 ${urls.join(', ')}`);
    const second = (BASIS[s].src || []).filter(x => x.secondary).map(x => x.url);
    ok(second.every(u => !BLOCK.includes(u) && !BLOCK.includes(u.replace(/&/g, () => '&amp;'))),
       `${name(s)}: 会社の公表ではない資料（報道など）をどこにも並べていない`, second.filter(u => BLOCK.includes(u)).join(', '));
    /* 平均と名乗れるのは、会社が公表した平均だけ。 */
    ok(got.rows.every(x => x.tag !== '平均' || /会社が公表した平均/.test(x.kind)), `${name(s)}: 「平均」の札は会社が公表した平均にだけ`);
  }

  /* ── ③ 描かれた棒 ───────────────────────────────────────────── */
  head('棒（描かれた長さ）');
  for (const [w, h] of [[390, 680], [1280, 800]]) {
    /* 比較は 2社×2職位＝4本、概要は 機長・副操縦士＝2本。
       概要は5社とも測る。1社しか見ていなかった頃は、ほかの会社の棒が1本ずれても通っていた（2026-10-04）。
       上限の棒が必ず在るのはエティハドの入る画面だけ。 */
    for (const [q, n, capped] of [['?view=compare&a=etihad&b=eva-air', 4, true], ...FIVE.map(x => [`?airline=${x}`, 2, x === 'etihad'])]) {
      await page.setViewport({ width: w, height: h });
      await go(page, q);
      await settle(page);
      const { bars, axis } = await page.evaluate(() => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const ax = [...v.querySelectorAll('.cr-axis')].filter(a => a.getClientRects().length).map(a => {
          const r = a.getBoundingClientRect();
          return { left: r.left, right: r.right };
        });
        return {
          axis: ax,
          bars: [...v.querySelectorAll('.cr-fill')].filter(f => f.getClientRects().length).map(f => {
            const a = f.getBoundingClientRect(), b = f.parentElement.getBoundingClientRect();
            return {
              w: parseFloat(f.style.getPropertyValue('--w')), fill: a.width, track: b.width, left: a.left - b.left,
              tl: b.left, tr: b.right, max: f.classList.contains('is-max'), bg: getComputedStyle(f).backgroundImage,
            };
          }),
        };
      });
      const off = bars.filter(b => Math.abs(b.fill - b.track * b.w / 100) > 1 || Math.abs(b.left) > 0.5);
      ok(bars.length === n && !off.length, `${w}px ${q}: ${n}本とも 0 から始まり、描かれた長さが目盛どおり`, `${bars.length}本 ${JSON.stringify(off)}`);
      /* 同じ目盛＝土台が全部同じ位置・同じ幅で、目盛の両端がそこに合っている。 */
      const t0 = bars[0] || { tl: 0, tr: 0 };
      ok(bars.every(b => Math.abs(b.tl - t0.tl) <= 0.5 && Math.abs(b.tr - t0.tr) <= 0.5),
         `${w}px ${q}: 棒の土台が全部同じ位置・同じ幅`, bars.map(b => `${b.tl}〜${b.tr}`).join(' ／ '));
      ok(axis.length === 1 && Math.abs(axis[0].left - t0.tl) <= 1 && Math.abs(axis[0].right - t0.tr) <= 1,
         `${w}px ${q}: 目盛の両端が棒の土台に合っている`, `目盛 ${JSON.stringify(axis)} ／ 土台 ${t0.tl}〜${t0.tr}`);
      /* 斜線は描かれた模様で見る（札だけ付いていて模様が無い、を通さない）。 */
      const stripe = b => /repeating-linear-gradient/.test(b.bg);
      ok((!capped || bars.some(b => b.max)) && bars.every(b => stripe(b) === b.max),
         `${w}px ${q}: 上限の棒だけが斜線で描かれている`, bars.map(b => `${b.max ? '上限' : '平'}:${stripe(b) ? '斜線' : '無地'}`).join(' '));
    }
  }

  /* ── ⑤ 住所と「戻る」 ────────────────────────────────────────── */
  head('住所・戻る・進む');
  await page.setViewport({ width: 390, height: 680 });
  await go(page, '');
  ok(await view(page) === 'home' && await search(page) === '', '入口が開く');
  const SUFFIX = ' | PILOT VALUE';
  ok(await page.title() === '次のキャリアを、選択する。' + SUFFIX, '入口の題名', await page.title());
  const len0 = await page.evaluate(() => history.length);

  await page.click('.cr-tile[href$="airline=jal"]');
  ok(await until(page, '?airline=jal') && await view(page) === 'airline:jal', '会社を押すと概要が開く（住所が変わる）', await search(page));
  ok(await page.title() === name('jal') + SUFFIX, '題名が社名になる', await page.title());
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#cr .cr-view:not([hidden]) .cr-h1')), '見出しへ焦点が移る（読み上げが新しい画面を読む）');
  ok(await page.evaluate(() => history.length) === len0 + 1 && await page.evaluate(() => scrollY) === 0, '履歴が1段増え、画面の頭から始まる');

  await page.click('#cr .cr-view:not([hidden]) .cr-btn');
  ok(await until(page, '?view=compare&a=jal&b=cathay-pacific') && await view(page) === 'compare', '「他社と比較」で、この会社を1社目に置いて開く', await search(page));
  const len2 = await page.evaluate(() => history.length);
  ok(len2 === len0 + 2, '履歴がもう1段増える');

  /* いま並んでいる2社（上から・左から）。 */
  const shown = () => page.evaluate(() => {
    const vis = sel => [...document.querySelectorAll('#cr .cr-view:not([hidden]) ' + sel)].filter(e => e.getClientRects().length);
    const order = els => els.slice().sort((a, b) => {
      const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
      return Math.round(x.top - y.top) || x.left - y.left;
    }).map(e => e.dataset.airline);
    return {
      rows: [...document.querySelectorAll('#cr .cr-pair')].map(p => order(vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`))),
      cards: order(vis('.cr-card')), taxes: order(vis('.cr-taxes .cr-tax')),
      opts: ['a', 'b'].map(s => vis(`.cr-side[data-side="${s}"] .cr-opt`).map(e => e.dataset.airline)),
      sel: [document.getElementById('cr-a').value, document.getElementById('cr-b').value],
      off: ['cr-a', 'cr-b'].map(id => [...document.getElementById(id).options].filter(o => o.disabled).map(o => o.value)),
      credits: vis('.cr-credit').map(e => e.dataset.airline),
      /* 置き場所の順（読み上げと Tab が進む順）。見た目の順と同じでなければならない。 */
      dom: [...document.querySelectorAll('#cr .cr-pair')].map(p => vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`).map(e => e.dataset.airline))
        .concat([vis('.cr-card').map(e => e.dataset.airline), vis('.cr-taxes .cr-tax').map(e => e.dataset.airline)]),
    };
  });
  const pairOk = async (a, b, label) => {
    const g = await shown();
    const exp = {
      rows: ROLES.map(() => [a, b]), cards: [a, b], taxes: [a, b], opts: [[a], [b]], sel: [a, b], off: [[b], [a]],
      credits: [a, b].filter(s => needsCredit(primary(s))),
      dom: [...ROLES.map(() => [a, b]), [a, b], [a, b]],
    };
    ok(same(g, exp), label, JSON.stringify(g));
  };
  await pairOk('jal', 'cathay-pacific', '2社だけが並ぶ（棒・カード・税・写真・クレジット）。相手の会社は選べない');

  await page.select('#cr-b', 'etihad');
  ok(await until(page, '?view=compare&a=jal&b=etihad'), '会社を選び直すと住所が変わる', await search(page));
  await pairOk('jal', 'etihad', '選び直した2社に入れ替わる');
  await page.click('#cr-swap');
  ok(await until(page, '?view=compare&a=etihad&b=jal'), '入れ替えると住所も入れ替わる', await search(page));
  await pairOk('etihad', 'jal', '入れ替えた順に並ぶ');
  ok(await page.evaluate(() => history.length) === len2, '選び直しと入れ替えは履歴を積まない（戻る1回で出られる）');

  await page.click('#cr .cr-view:not([hidden]) .cr-card[data-airline="etihad"] .cr-card-n');
  ok(await until(page, '?airline=etihad') && await view(page) === 'airline:etihad', '比較のカードから、その会社の概要へ');
  await page.goBack();
  ok(await until(page, '?view=compare&a=etihad&b=jal') && await view(page) === 'compare', '戻ると、選び直したままの比較に戻る', await search(page));
  await pairOk('etihad', 'jal', '戻ったあとも同じ2社・同じ順');
  await page.goBack();
  ok(await until(page, '?airline=jal') && await view(page) === 'airline:jal', 'もう1回戻ると会社の概要');
  await page.goBack();
  ok(await until(page, '') && await view(page) === 'home', 'もう1回戻ると入口');
  ok(await page.title() === '次のキャリアを、選択する。' + SUFFIX, '題名も入口に戻る', await page.title());
  await page.goForward();
  ok(await until(page, '?airline=jal') && await view(page) === 'airline:jal', '進むと会社の概要');

  /* 戻ったとき、見ていた位置に戻る（画面を差し替えるので、ブラウザ任せでは戻らない）。 */
  await go(page, '');
  const y0 = await page.evaluate(() => { const y = Math.min(240, document.documentElement.scrollHeight - innerHeight); scrollTo(0, y); return scrollY; });
  ok(y0 >= 100, '入口は 390×680 で下へ送れる高さがある', String(y0));
  await page.evaluate(() => document.querySelector('.cr-tile[href$="airline=ana"]').click());
  ok(await until(page, '?airline=ana') && await page.evaluate(() => scrollY) === 0, '下のほうで会社を押しても、概要は頭から');
  await page.goBack();
  await until(page, '');
  ok(await page.waitForFunction(y => Math.abs(scrollY - y) <= 1, { timeout: 5000 }, y0).then(() => true, () => false),
     '戻ると、見ていた位置に戻る', `${await page.evaluate(() => scrollY)} / ${y0}`);
  /* ブラウザの「戻る」で出た画面にも、進むと同じ位置で戻る
     （出るときに位置を残す間が無いので、送り終えるたびに残してある）。 */
  await page.goForward();
  await until(page, '?airline=ana');
  const y1 = await page.evaluate(() => { const y = Math.min(300, document.documentElement.scrollHeight - innerHeight); scrollTo(0, y); return scrollY; });
  const kept = await page.waitForFunction(() => scrollY > 0 && history.state && Math.abs(history.state.y - scrollY) < 1, { timeout: 5000 }).then(() => true, () => false);
  ok(y1 >= 100 && kept, '概要を下へ送ると、その位置がいまの段に残る', `${y1} / ${JSON.stringify(await page.evaluate(() => history.state))}`);
  await page.goBack();
  await until(page, '');
  await page.goForward();
  await until(page, '?airline=ana');
  ok(await page.waitForFunction(y => Math.abs(scrollY - y) <= 1, { timeout: 5000 }, y1).then(() => true, () => false),
     '戻るで出た画面へ進むと、見ていた位置に戻る', `${await page.evaluate(() => scrollY)} / ${y1}`);

  /* 直接開く。知らない会社・知らない画面は入口へ。同じ会社を2つは選べない。 */
  const DIRECT = [
    ['?airline=eva-air', '?airline=eva-air', 'airline:eva-air', '会社を直接開ける'],
    ['?view=compare&a=ana&b=eva-air', '?view=compare&a=ana&b=eva-air', 'compare', '比較を直接開ける'],
    ['?view=compare', `?view=compare&a=${PAIR[0]}&b=${PAIR[1]}`, 'compare', '社名なしの比較は既定の2社'],
    ['?view=compare&a=cathay-pacific', '?view=compare&a=cathay-pacific&b=jal', 'compare', '片方だけ決まっていれば、相手は既定のうち別のほう'],
    ['?view=compare&b=jal', '?view=compare&a=cathay-pacific&b=jal', 'compare', '2社目だけ決まっていても同じ'],
    ['?view=compare&a=ana&b=ana', `?view=compare&a=ana&b=${PAIR[1]}`, 'compare', '同じ会社を2つは選べない'],
    ['?view=compare&a=nope&b=zzz', `?view=compare&a=${PAIR[0]}&b=${PAIR[1]}`, 'compare', '知らない会社は既定の2社へ'],
    ['?airline=nope', '', 'home', '知らない会社は入口へ'],
    ['?airline=', '', 'home', '空の会社は入口へ'],
    ['?view=zzz', '', 'home', '知らない画面は入口へ'],
  ];
  for (const [q, exp, v, label] of DIRECT) {
    await go(page, q);
    const got = [await search(page), await view(page)];
    ok(got[0] === exp && got[1] === v, `${label}（${q}）`, got.join(' ／ '));
    if (v === 'compare') { const u = new URLSearchParams(exp); await pairOk(u.get('a'), u.get('b'), `  └ その2社が並ぶ`); }
  }
  await close();

  /* career.js が届かなくても、入口は読める（見えないまま固まらない）。 */
  {
    const { page: p, close: c } = await open('?airline=jal', 390, 680, { block: '/career.js' });
    const st = await p.evaluate(() => {
      const h = document.querySelector('#cr .cr-home .cr-h1');
      return { boot: document.documentElement.classList.contains('cr-boot'), vis: getComputedStyle(h).visibility, box: h.getClientRects().length };
    });
    ok(!st.boot && st.vis === 'visible' && st.box > 0, 'career.js が届かなくても入口が見える', JSON.stringify(st));
    await c();
  }

  /* ── ⑥ 通貨 ─────────────────────────────────────────────────── */
  head('通貨の切り替え');
  {
    const { page: p, close: c } = await open('?view=compare&a=etihad&b=eva-air');
    const MONEY = '#cr .cr-num-v, #cr .cr-row-v, #cr .cr-axis span:not(:first-child), #cr .cr-fig dd b';
    const snap = () => p.evaluate(sel => ({
      all: document.getElementById('cr').textContent,
      keep: [...document.querySelectorAll('#cr .pv-no-cur')].map(e => e.textContent),
      money: [...document.querySelectorAll(sel)].map(e => e.textContent.trim()),
      ov: Object.fromEntries([...document.querySelectorAll('#cr .cr-num')].map(n => [n.closest('.cr-view').dataset.airline + '/' + n.dataset.role, n.querySelector('.cr-num-v').textContent.trim()])),
      cmp: Object.fromEntries([...document.querySelectorAll('#cr .cr-cmp .cr-row')].map(r => [r.dataset.airline + '/' + r.parentElement.dataset.role, r.querySelector('.cr-row-v').textContent.trim()])),
    }), MONEY);
    const jpy = await snap();
    ok(await p.evaluate(() => window.PVCurrency.get()) === 'JPY', '日本語ページの既定は円');
    const curs = (await p.evaluate(() => Object.keys(window.PVCurrency.rates))).filter(x => x !== 'JPY');
    ok(curs.length >= 6, `切替メニューの通貨が読める（円のほか${curs.length}つ）`);
    for (const cur of curs) {
      await p.evaluate(x => window.PVCurrency.set(x), cur);
      const done = await p.waitForFunction(sel => [...document.querySelectorAll(sel)].every(e => !/[¥万円]/.test(e.textContent)), { timeout: 5000 }, MONEY).then(() => true, () => false);
      const s = await snap();
      const left = s.money.filter(t => /[¥万円]/.test(t));
      ok(done && !left.length, `${cur}: 額が全部切り替わる（${s.money.length}か所）`, left.slice(0, 4).join(' / '));
      ok(same(s.keep, jpy.keep), `${cur}: 原貨の額・為替の注記・出どころは変わらない`);
      const differ = Object.keys(s.ov).filter(k => s.ov[k] !== s.cmp[k]);
      ok(Object.keys(s.ov).length === Object.keys(s.cmp).length && !differ.length, `${cur}: 概要と比較で同じ額`, differ.map(k => `${k} ${s.ov[k]} / ${s.cmp[k]}`).join(' ／ '));
      ok(s.ov['etihad/cap'].startsWith('〜') && s.ov['eva-air/fo'].endsWith('超'), `${cur}: 上限の「〜」と「超」が残る`, `${s.ov['etihad/cap']} ／ ${s.ov['eva-air/fo']}`);
      /* いちばん狭い画面でも、額が箱からはみ出さない。 */
      const clip = await p.evaluate(() => [...document.querySelectorAll('#cr .cr-view:not([hidden]) .cr-row-v')]
        .filter(e => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth).length);
      ok(clip === 0, `${cur}: 比較の額が画面からはみ出さない`);
    }
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    const back = await p.waitForFunction(t => document.getElementById('cr').textContent === t, { timeout: 5000 }, jpy.all).then(() => true, () => false);
    ok(back, '円に戻すと1文字も違わない');

    /* どの幅でも、どの通貨でも、額が箱に収まる。
       大きい額の字は折り返さないので、通貨で字数が増えた分だけ黙って切れる（「〜AED 674K」）。
       狭い側：320px ＝ いちばん狭い画面／360px ＝ よくあるスマホの幅。
       広い側：900px ＝ 写真と2列に並び始める所／1001px ＝ 左メニューが出て箱がいちばん狭くなる所／1280px。
       ★広い側を測っていなかった頃、広い画面で字を 40px に固定していて、AED にすると額が列からはみ出し、
         900〜1024px ではページごと横に溢れていた。検査は全部緑のままだった（2026-10-04）。
         画面が広くても、額の入る箱が広いとは限らない。 */
    const WIDTHS = [320, 360, 900, 1001, 1280];
    const cutAt = Object.fromEntries(WIDTHS.map(w => [w, []]));
    /* 目盛の字も同じ。字数の多い通貨だと、まんなかの字と右端の字がくっついて1つの数に見える
       （320px・AED で、あいだが 3px だった。2026-10-04）。出ている字どうしの間を測る。 */
    const AXIS_GAP = 8;
    const tightAt = Object.fromEntries(WIDTHS.map(w => [w, []]));
    for (const q of [...FIVE.map(s => `?airline=${s}`), '?view=compare&a=etihad&b=eva-air', '?view=compare&a=cathay-pacific&b=ana']) {
      await go(p, q);
      for (const w of WIDTHS) {
        await p.setViewport({ width: w, height: 568 });
        for (const cur of ['JPY', ...curs]) {
          await p.evaluate(x => window.PVCurrency.set(x), cur);
          await p.waitForFunction((sel, yen) => [...document.querySelectorAll(sel)].every(e => /[¥万円]/.test(e.textContent) === yen), { timeout: 5000 }, MONEY, cur === 'JPY').catch(() => {});
          const cut = await p.evaluate(() => {
            const wide = e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
            return [...document.querySelectorAll('#cr .cr-view:not([hidden]) :is(.cr-num-v, .cr-row-v, .cr-fig b)')]
              .filter(e => e.getClientRects().length)
              .filter(e => {
                const t = wide(e), box = (e.closest('.cr-num, .cr-row, .cr-fig') || document.documentElement).getBoundingClientRect();
                return t.right > box.right + 0.5 || t.right > innerWidth + 0.5 || (e.matches('.cr-num-v') && t.width > e.clientWidth + 0.5);
              })
              .map(e => `${e.className}「${e.textContent.trim()}」`)
              .concat(document.documentElement.scrollWidth > document.documentElement.clientWidth ? ['横に溢れる'] : []);
          });
          if (cut.length) cutAt[w].push(`${cur} ${q}: ${cut.join(', ')}`);
          const tight = await p.evaluate(GAP => [...document.querySelectorAll('#cr .cr-view:not([hidden]) .cr-axis')]
            .filter(a => a.getClientRects().length).flatMap(a => {
              const ar = a.getBoundingClientRect();
              const t = [...a.children].filter(s => s.getClientRects().length && getComputedStyle(s).visibility !== 'hidden').map(s => {
                const r = document.createRange(); r.selectNodeContents(s);
                const x = r.getBoundingClientRect();
                return { l: x.left, r: x.right, t: s.textContent.trim() };
              });
              const bad = [];
              /* 両端（0 といちばん大きい額）は必ず出ている。まんなかは狭い画面でだけ引っ込めてよい。 */
              if (t.length < 2 || t[0].t !== '0') bad.push(`目盛の両端の字が出ていない（${t.map(x => x.t).join(' / ')}）`);
              for (let i = 1; i < t.length; i++) if (t[i].l - t[i - 1].r < GAP) bad.push(`「${t[i - 1].t}」と「${t[i].t}」のあいだが ${Math.round((t[i].l - t[i - 1].r) * 10) / 10}px`);
              if (t.some(x => x.l < ar.left - 0.5 || x.r > ar.right + 0.5)) bad.push('目盛の字が目盛からはみ出す');
              return bad;
            }), AXIS_GAP);
          if (tight.length) tightAt[w].push(`${cur} ${q}: ${tight.join(', ')}`);
        }
      }
    }
    for (const w of WIDTHS) ok(!cutAt[w].length, `${w}px: どの通貨でも額が切れない・横に溢れない（${curs.length + 1}通貨 × 7画面）`, cutAt[w].join('\n      '));
    for (const w of WIDTHS) ok(!tightAt[w].length, `${w}px: どの通貨でも目盛の字どうしがくっつかない（あいだ ${AXIS_GAP}px 以上）・両端の字が出ている`, tightAt[w].join('\n      '));

    /* 比較の画面の、写真のカードと棒の行。
       ★いちばん狭い画面（〜344px）で、長い社名（キャセイパシフィック）が語の途中で折れて2行になり、
         その頭の字と略号の札の角が、まんなかの入れ替えボタンの下に入っていた（2026-10-04）。
         上の検査は全部緑のままだった ── 字は箱の中に在り、横にも溢れていなかったから。
       幅は、規則が切り替わる境目の両側（339/340・351/352）を必ず踏む。5社とも左と右に1回ずつ置く。
       字の行数は、字そのものの四角で数える（先頭の丸や矢印を「2行目」と数えない）。 */
    const RING = FIVE.map((s, i) => `?view=compare&a=${s}&b=${FIVE[(i + 1) % FIVE.length]}`);
    const PICK_W = [320, 339, 340, 351, 352, 360, 390, 768, 1280];
    const ROW_W = [320, 339, 340, 360];
    const pickBad = Object.fromEntries(PICK_W.map(w => [w, { wrap: [], hit: [], mark: [] }]));
    const rowBad = Object.fromEntries(ROW_W.map(w => [w, []]));
    const fit = () => p.evaluate(() => {
      const V = document.querySelector('#cr .cr-view:not([hidden])');
      const text = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).flatMap(n => {
        const g = document.createRange(); g.selectNodeContents(n);
        return [...g.getClientRects()].filter(x => x.width > 1);
      });
      const lines = rs => { const t = rs.map(x => x.top).sort((a, b) => a - b); return t.filter((y, i) => !i || y - t[i - 1] > 6).length; };
      const shown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const btn = V.querySelector('.cr-swap');
      const sw = btn ? btn.getBoundingClientRect() : null;
      /* 丸いボタンと四角の重なり（px）。正なら掛かっている。 */
      const hit = x => {
        const cx = sw.left + sw.width / 2, cy = sw.top + sw.height / 2;
        return sw.width / 2 - Math.hypot(Math.max(x.left - cx, 0, cx - x.right), Math.max(x.top - cy, 0, cy - x.bottom));
      };
      const tiles = [...V.querySelectorAll('.cr-opt')].filter(o => o.getClientRects().length).map(o => {
        const n = o.querySelector('.cr-opt-n'), ic = n.querySelector('.cr-ic'), code = o.querySelector('.cr-code');
        const tr = text(n), af = getComputedStyle(code, '::after');
        /* 「押せば選び直せる」の目印 ── 社名の横の矢印か、略号の札の中の矢印。 */
        const inChip = af.content !== 'none' && af.display !== 'none' && parseFloat(af.width) > 0 && parseFloat(af.borderRightWidth) > 0;
        const over = !sw ? [['入れ替えボタンが無い', 1]] : [['社名', Math.max(...tr.map(hit))], ['略号の札', hit(code.getBoundingClientRect())]]
          .concat(shown(ic) ? [['矢印', hit(ic.getBoundingClientRect())]] : []);
        return {
          name: n.textContent.trim(), lines: lines(tr),
          over: over.filter(x => x[1] > 0).map(x => `${x[0]}に ${Math.round(x[1] * 10) / 10}px`),
          marks: (shown(ic) ? 1 : 0) + (inChip ? 1 : 0),
        };
      });
      const rows = [...V.querySelectorAll('.cr-row-co')].filter(e => e.getClientRects().length)
        .map(e => ({ name: e.textContent.trim(), lines: lines(text(e)), v: e.closest('.cr-row').querySelector('.cr-row-v').textContent.trim() }));
      return { tiles, rows };
    });
    for (const q of RING) {
      await go(p, q);
      await settle(p);
      for (const w of PICK_W) {
        await p.setViewport({ width: w, height: 568 });
        const { tiles } = await fit();
        const b = pickBad[w];
        if (tiles.length !== 2) b.wrap.push(`${q}: 写真のカードが2枚見つからない（${tiles.length}枚）`);
        tiles.forEach((t, i) => {
          const at = `${i ? '右' : '左'}「${t.name}」`;
          if (t.lines !== 1) b.wrap.push(`${at} ${t.lines}行`);
          if (t.over.length) b.hit.push(`${at} ${t.over.join('・')}`);
          if (t.marks !== 1) b.mark.push(`${at} 目印 ${t.marks}つ`);
        });
        if (!ROW_W.includes(w)) continue;
        for (const cur of ['JPY', ...curs]) {
          await p.evaluate(x => window.PVCurrency.set(x), cur);
          await p.waitForFunction((sel, yen) => [...document.querySelectorAll(sel)].every(e => /[¥万円]/.test(e.textContent) === yen), { timeout: 5000 }, MONEY, cur === 'JPY').catch(() => {});
          const { rows } = await fit();
          if (!rows.length) rowBad[w].push(`${cur} ${q}: 棒の行が見つからない`);
          for (const r of rows) if (r.lines !== 1) rowBad[w].push(`${cur}「${r.name}」${r.lines}行（額「${r.v}」）`);
        }
      }
    }
    for (const w of PICK_W) {
      ok(!pickBad[w].wrap.length, `${w}px: 比較の写真のカードで、社名が1行に収まる（5社を左と右に1回ずつ）`, pickBad[w].wrap.join('\n      '));
      ok(!pickBad[w].hit.length, `${w}px: 入れ替えボタンが、社名・略号の札・矢印に掛からない`, pickBad[w].hit.join('\n      '));
      ok(!pickBad[w].mark.length, `${w}px: どのカードにも「選び直せる」目印がちょうど1つ出ている`, pickBad[w].mark.join('\n      '));
    }
    for (const w of ROW_W) ok(!rowBad[w].length, `${w}px: どの通貨でも、棒の行の社名が1行に収まる`, rowBad[w].slice(0, 8).join('\n      '));
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    await c();
  }

  /* ── ⑦ 大きさ ───────────────────────────────────────────────── */
  head('大きさ（溢れ・最初の1画面・字・押す場所）');
  const VIEWS = ['', ...FIVE.map(s => `?airline=${s}`), '?view=compare', '?view=compare&a=etihad&b=eva-air'];
  /* 押せるものの種類。ここに無い形のものが増えたら落とす（hover / active を付け忘れる）。 */
  const MAIN = '.cr-tile, .cr-back, .cr-btn, .cr-swap, .cr-sel, .cr-more > summary, .cr-link, .cr-card-n';
  const INLINE = '.cr-credits a, .cr-srcs a';
  for (const [w, h] of [[320, 568], [390, 680], [768, 1024], [1280, 800]]) {
    const { page: p, close: c } = await open('', w, h);
    const bad = [];
    for (const q of VIEWS) {
      await go(p, q);
      await settle(p);
      const m = await p.evaluate((MAIN, INLINE) => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const on = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        /* 最初の1画面に年収が入っているか（開く前に測る）。 */
        const first = v.querySelector('.cr-pay') || v.querySelector('.cr-pair');
        const fold = first ? Math.round(first.getBoundingClientRect().bottom) : null;
        v.querySelectorAll('details').forEach(d => { d.open = true; });
        const small = new Set(), tap = new Set(), stray = new Set(), cut = new Set();
        const tw = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          if (!n.nodeValue.trim()) continue;
          const el = n.parentElement;
          if (!on(el) || el.closest('.cr-vh')) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 12) small.add(`${el.className || el.tagName} ${fs}px`);
        }
        for (const el of v.querySelectorAll('a, button, select, summary')) {
          if (!on(el)) continue;
          if (el.matches(MAIN)) {
            const b = el.getBoundingClientRect();
            if (b.width < 44 || b.height < 44) tap.add(`${el.className || el.tagName} ${Math.round(b.width)}×${Math.round(b.height)}`);
          } else if (!el.matches(INLINE)) stray.add(el.outerHTML.slice(0, 70));
        }
        for (const el of v.querySelectorAll('.cr-num-v, .cr-row-v, .cr-fig b, .cr-tile-n, .cr-opt-n, .cr-hero-n, .cr-row-co')) {
          if (!on(el)) continue;
          let host = el.parentElement;
          while (host && !host.getClientRects().length) host = host.parentElement;   // display:contents の親は箱を持たない
          const b = el.getBoundingClientRect(), box = host.getBoundingClientRect();
          if (b.right > innerWidth + 0.5 || b.left < -0.5 || el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) cut.add(`${el.className} 「${el.textContent.trim().slice(0, 14)}」`);
          if (b.right > box.right + 1 && !el.matches('.cr-num-v')) cut.add(`${el.className} が箱の外`);
        }
        const sel = [...v.querySelectorAll('select')].map(s => parseFloat(getComputedStyle(s).fontSize));
        return {
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fold, vh: innerHeight, small: [...small], tap: [...tap], stray: [...stray], cut: [...cut], sel,
        };
      }, MAIN, INLINE);
      const at = `${w}×${h} ${q || '（入口）'}`;
      if (m.over > 0) bad.push(`${at}: 横に ${m.over}px 溢れる`);
      if (m.fold !== null && w >= 390 && m.fold > m.vh) bad.push(`${at}: 年収が最初の1画面に入らない（下端 ${m.fold} / 画面 ${m.vh}）`);
      if (m.small.length) bad.push(`${at}: 12px 未満の字 ${m.small.join(', ')}`);
      if (m.tap.length) bad.push(`${at}: 44px 未満の押す場所 ${m.tap.join(', ')}`);
      if (m.stray.length) bad.push(`${at}: 知らない形の押せるもの ${m.stray.join(' ')}`);
      if (m.cut.length) bad.push(`${at}: 字がはみ出す ${m.cut.join(', ')}`);
      if (m.sel.some(f => f < 16)) bad.push(`${at}: 選ぶ欄の字が 16px 未満（iOS が画面ごと拡大する）`);
    }
    ok(!bad.length, `${w}×${h}: ${VIEWS.length}画面とも 溢れない・${w >= 390 ? '年収が最初の1画面に入る・' : ''}字 12px 以上・押す場所 44px 以上`, bad.join('\n      '));
    await c();
  }

  /* ── ⑧ 写真とクレジット（画面） ─────────────────────────────── */
  head('写真とクレジット（画面）');
  {
    const { page: p, close: c } = await open('');
    const CHANGES = [...new Set(LEDGER.map(x => x.changes).filter(Boolean))];
    for (const q of VIEWS) {
      await go(p, q);
      /* 下のほうの写真は近づくまで読まない。1枚ずつ画面に入れて、読み終わるのを待つ。 */
      const n = await p.evaluate(() => document.querySelectorAll('#cr .cr-view:not([hidden]) img').length);
      let loaded = true;
      for (let i = 0; i < n; i++) {
        const fine = await p.evaluate(async i => {
          const im = [...document.querySelectorAll('#cr .cr-view:not([hidden]) img')][i];
          if (!im.getClientRects().length) return true;      // 選ばれていない会社の写真（読まないのが正しい）
          im.scrollIntoView({ block: 'center' });
          if (!im.complete) await new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); });
          return im.naturalWidth > 0;
        }, i);
        loaded = loaded && fine;
      }
      const g = await p.evaluate(() => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const on = el => el.getClientRects().length > 0;
        /* クレジットは「在る」だけでは足りない。読める形で出ていること
           （読み上げ専用の箱に入れる・透明にする・見えなくする、は示したことにならない）。
           ⚠️ 親の透明度までは遡らない（画面を切り替えた直後は .cr-view が透明から現れる途中）。 */
        const seen = el => {
          if (!on(el) || el.closest('.cr-vh')) return false;
          const cs = getComputedStyle(el);
          return cs.visibility === 'visible' && cs.opacity !== '0' && parseFloat(cs.fontSize) >= 12;
        };
        const cr = v.querySelector('.cr-credits');
        return {
          imgs: [...v.querySelectorAll('img')].filter(on).map(i => i.getAttribute('src')),
          links: cr ? [...cr.querySelectorAll('a')].filter(on).map(a => [a.getAttribute('href'), a.textContent.trim(), a.target, a.rel]) : [],
          /* 1枚ぶんの塊ごとに、中のリンクを順に。 */
          spans: cr && seen(cr) ? [...cr.querySelectorAll('.cr-credit')].filter(seen).map(s => [...s.querySelectorAll('a')].filter(seen).map(a => [a.getAttribute('href'), a.textContent.trim()])) : [],
          text: cr ? [...cr.childNodes].map(n => (n.nodeType === 3 ? n.nodeValue : n.hidden ? '' : n.textContent)).join(' ') : '',
        };
      });
      const at = q || '（入口）';
      ok(loaded && g.imgs.length > 0, `${at}: 写真 ${g.imgs.length}枚が全部読める`);
      const used = [...new Set(g.imgs)].map(s => BY_SRC.get(s)?.p);
      const lack = [], extra = [];
      for (const ph of used) {
        if (needsCredit(ph)) {
          /* その写真の塊を出所のリンクで探し、同じ塊の中にライセンスが在ることまで見る
             （別の写真が同じライセンスなら通る、という抜け道を作らない）。 */
          const mine = g.spans.find(sp => sp.some(l => l[0] === ph.source));
          if (!mine || !mine.some(l => l[0] === ph.source && l[1] === ph.author)) lack.push(`${ph.file}: 作者（出所へのリンク）`);
          if (!mine || !mine.some(l => l[0] === ph.licence_url && l[1] === ph.licence)) lack.push(`${ph.file}: ライセンス`);
          if (mine && mine.length !== 2) lack.push(`${ph.file}: 塊の中のリンクが2つでない`);
          if (!g.text.includes(ph.changes)) lack.push(`${ph.file}: 加工の中身`);
        } else if (g.links.some(l => l[0] === ph.source)) extra.push(ph.file);
      }
      ok(!lack.length, `${at}: 示すことが条件の写真には 作者・ライセンス・加工の中身 が付いている`, lack.join(' / '));
      ok(!extra.length, `${at}: 条件の無い写真（CC0）には何も足していない`, extra.join(', '));
      ok(g.links.every(l => used.some(ph => ph.source === l[0] || ph.licence_url === l[0])), `${at}: 出ていない写真のクレジットが無い`);
      ok(g.links.every(l => l[2] === '_blank' && /noopener/.test(l[3])), `${at}: クレジットのリンクは別の窓で開く`);
      /* クレジットの中に、台帳に無い文言が無い。 */
      let rest = g.text;
      for (const w of [...LEDGER.flatMap(x => [x.author, x.licence, x.aircraft]), ...CHANGES, ...FIVE.map(name), '写真']
        .filter(Boolean).sort((a, b) => b.length - a.length)) rest = rest.split(w).join('');
      rest = rest.replace(/[\s（）／]/g, '');
      ok(rest === '', `${at}: クレジットの中に台帳に無い文言が無い`, `残り「${rest}」`);
    }
    await c();
  }

  head('ページの中のエラー');
  ok(!trouble.length, '例外が出ていない・自サイトのファイルが全部読める', [...new Set(trouble)].join('\n      '));
} finally {
  await browser.close();
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
