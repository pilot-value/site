/* ══════════════════════════════════════════════════════════════════
   assert-career.mjs — 概要と2社比較の1枚（career.html）

   この1枚は「普通に見えたまま静かに嘘になる」形をいくつも持っている。
   1つずつ見張る。

     ① 数字が正本とずれる ── 本命の額と棒は、5社とも・どちらの職位も推定年収（SALARY の avg）。
        ここでは**あちらの cell() を呼ばずに**同じ答えを作り直して突き合わせる
        （呼んでしまうと、あちらが間違えた日に検査も一緒に間違える）。
        年収を「確認中」と出さない（★2026-10-06 オーナー決定。概要・比較・詳細・カードのどこにも）。
     ② 会社が公表した額が、推定と同じ顔で並ぶ ── 公表額は「会社が公表している金額」の一覧にだけ在り、
        1行ごとに種類の名前（求人の上限・目標年収・下限・平均）が付く。棒にも目盛にも載せない。
        求人の上限には「〜」・斜線の印・「上限」の字の3つが必ず一緒に出る。
        斜線は札（class）ではなく**描かれた模様**で見る。
     ⑪ 家賃 ── 額は1か月あたり。街ごとに箱が1つで、箱ごとに物差しの名前・出どころ・時点が付く。
        2つの街を1本の目盛・1つの表に並べない（条件のそろわない街を競わせない）。
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
import { BASIS, TIERS, figures } from './salary-basis.mjs';
import { viewOf, rentCell } from './pv-airline-view.mjs';
import { PHOTOS, PHOTO_DIR, SMALL_W, needsCredit, primary, smallH, src as photoSrc } from './airline-photos.mjs';
import * as PLACE from './place-photos.mjs';
import { render, FIVE, PAIR, ROLES, PAGE, DEEP, cell } from './gen-career.mjs';

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
/* 段階3の面の社名（オーナー 2026-10-18 V2「日本は日本語、他は英語」・2026-10-19 P12.65）：比較の家賃の箱の「地域を選んだ理由」の1行に
   台帳の字のまま出てくるその会社の名前も、日本の会社は日本語・ほかは英語。検査が自分で持つ写し（正本 SALARY の ja / en を地域で選ぶ。
   生成側・読み口の coText は呼ばない）。日本語の社名（すぐ後ろに「航空」が続けばそこまで）を、かぎかっこ「…」の外でだけ替える。 */
const sayText = (s, t) => {
  const ja = SALARY[s].ja, say = SALARY[s].region === 'japan' ? ja : SALARY[s].en, str = String(t ?? '');
  if (say === ja) return str;
  return str.split(/(「[^」]*」)/).map(p => (p.startsWith('「') ? p : p.split(`${ja}航空`).join(say).split(ja).join(say))).join('');
};
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
/* 街と就航地の写真（place-photos.mjs）。台帳は別だが、守ることは同じ。 */
const PLACES = Object.entries(PLACE.PHOTOS).flatMap(([key, list]) => list.map(p => ({ key, place: true, ...p })));
const creditDue = p => (p.place ? PLACE.needsCredit(p) : needsCredit(p));
const srcOf = (p, small) => (p.place ? PLACE.src(p, small) : photoSrc(p, small));
const smallW = p => (p.place ? PLACE.SMALL_W : SMALL_W);
const BY_SRC = new Map();
for (const p of LEDGER) {
  BY_SRC.set(photoSrc(p), { p, w: p.w, h: p.h });
  BY_SRC.set(photoSrc(p, true), { p, w: SMALL_W, h: smallH(p) });
}
for (const p of PLACES) {
  BY_SRC.set(PLACE.src(p), { p, w: p.w, h: p.h });
  BY_SRC.set(PLACE.src(p, true), { p, w: PLACE.SMALL_W, h: PLACE.smallH(p) });
}
{
  for (const dir of [PHOTO_DIR, PLACE.PHOTO_DIR]) {
    const onDisk = fs.readdirSync(path.join(ROOT, dir)).filter(f => !f.startsWith('.')).sort();
    const want = [...BY_SRC.keys()].filter(s => s.startsWith(dir + '/')).map(s => path.basename(s)).sort();
    ok(same(onDisk, want), `${dir}/ に在るのは台帳の写真だけ（大小2枚ずつ・${want.length}枚）`,
       `余り: ${onDisk.filter(f => !want.includes(f)).join(', ') || 'なし'} ／ 不足: ${want.filter(f => !onDisk.includes(f)).join(', ') || 'なし'}`);
  }
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

  /* 街と就航地の写真 ── 出所・作者・ライセンス・写っているもの。ライセンスは名前とリンクが対。 */
  const badP = PLACES.filter(p => !p.source || !p.author || !p.licence || !p.subject
    || (creditDue(p) && (!/^https:\/\//.test(p.licence_url || '') || !p.changes)));
  ok(PLACES.length > 0 && !badP.length, `街と就航地の写真 ${PLACES.length}枚に 出所・作者・ライセンス・写っているもの が在る`, badP.map(p => p.file).join(', '));
  const PLACE_LICENCES = {
    ...LICENCES,
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0',
    'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0',
    'CC BY-SA 3.0 DE': 'https://creativecommons.org/licenses/by-sa/3.0/de/deed.en',
    'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0',
    'CC BY 2.5': 'https://creativecommons.org/licenses/by/2.5',
    'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0',
  };
  const oddP = PLACES.filter(p => PLACE_LICENCES[p.licence] !== p.licence_url);
  ok(!oddP.length, '街と就航地の写真のライセンスは、商用と改変ができるものだけ（名前とリンクが対）', oddP.map(p => `${p.file}: ${p.licence}`).join(', '));
  ok(PLACES.every(p => creditDue(p) === (p.licence !== 'CC0')), '街と就航地の写真も、クレジットを出さなくてよいのは CC0 だけ');
  /* 保留にした写真（写っているものを確かめ切れていない）は、台帳にも画面にも出さない。 */
  const heldOut = Object.entries(PLACE.HELD).filter(([k, x]) => PLACE.PHOTOS[k]
    || (x.photo && x.photo.file && new RegExp(`${PLACE.PHOTO_DIR}/${x.photo.file}(?:-\\d+)?\\.jpg`).test(HTML)));
  ok(!heldOut.length, `保留の写真 ${Object.keys(PLACE.HELD).length}件を画面に出していない`, heldOut.map(([k]) => k).join(', '));

  const imgs = [...BLOCK.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  const off = [];
  for (const tag of imgs) {
    const at = k => (tag.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const big = BY_SRC.get(at('src'));
    if (!big) { off.push(`台帳に無い写真: ${at('src')}`); continue; }
    if (String(big.w) !== at('width') || String(big.h) !== at('height')) off.push(`${at('src')}: width / height が台帳と違う`);
    if (at('srcset') !== `${srcOf(big.p, true)} ${smallW(big.p)}w, ${srcOf(big.p)} ${big.p.w}w`) off.push(`${at('src')}: srcset が台帳と違う`);
    /* 写真の説明は「会社名の 機種」。機種は写真の台帳のもので、年収の対象機種とは別。
       街と就航地の写真は、台帳の「写っているもの」をそのまま。 */
    const alt = big.p.place ? big.p.subject : `${name(big.p.slug)}の ${big.p.aircraft}`;
    if (at('alt') !== alt && at('alt') !== alt.replace(/&/g, () => '&amp;')) off.push(`${at('src')}: alt「${at('alt')}」`);
  }
  ok(imgs.length > 0 && !off.length, `HTML の写真 ${imgs.length}か所が全部台帳どおり`, off.join('\n      '));
  ok(!/data:image\/(?:jpe?g|png|webp)/.test(BLOCK), '写真を文字にして埋め込んでいない');
}

/* ══════════════════════════════════════════════════════════════════
   E) ここからブラウザ
   ══════════════════════════════════════════════════════════════════ */
head('career-sec.css（会社・募集・待遇・街の節の見た目）');
{
  const SEC = noCssCmt(read('career-sec.css'));
  ok(!/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|prefers-color-scheme/.test(SEC), '色はトークンだけ（hex・rgb・hsl・prefers-color-scheme の直書きが無い）');
  const tr = [...SEC.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)].map(m => m[1]);
  ok(tr.every(t => t.split(',').every(x => /^\s*(transform|opacity)\b/.test(x))), '動かすのは transform と opacity だけ', tr.join(' | '));
  const lackSec = ['.cr-job:hover', '.cr-job:focus-visible', '.cr-job:active'].filter(x => !SEC.includes(x));
  ok(!lackSec.length, '押せるもの（募集の行）に hover・focus-visible・active が在る', lackSec.join(', '));
  ok(/career-sec\.css\?v=\w+/.test(HTML), 'career.html が career-sec.css を指紋つきで読んでいる');
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const trouble = [];   // ページの中の例外と、読めなかった自サイトのファイル
const NET_OFF = /googletagmanager|google-analytics|clarity\.ms|doubleclick|supabase\.co/;

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
  /* この検査からは、解析タグにも本番の DB にも1本も出さない
     （手元で開いた回が訪問として数えられる／ネットの調子で答えが変わる、の両方を避ける）。
     生きた欄は「読めなかった」の姿で落ち着く ＝ 出荷した HTML の字だけを見ることになる。 */
  await page.setRequestInterception(true);
  page.on('request', r => ((opt.block && r.url().includes(opt.block)) || NET_OFF.test(r.url()) ? r.abort() : r.continue()));
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
    const pub = root => (!root ? null : {
      none: t(root.querySelector('.cr-none')),
      rows: [...root.querySelectorAll('.cr-grp')].flatMap(g => {
        const tag = t(g.querySelector('.cr-grp-k .cr-tag'));
        return [...g.querySelectorAll('.cr-fig')].map(f => ({
          tag, group: t(g.querySelector('.cr-grp-k')).slice(tag.length).trim(),
          kind: t(f.querySelector('dt')), amount: t(f.querySelector('dd b')), orig: t(f.querySelector('.cr-orig')) || '',
        }));
      }),
      /* 上限の印（斜線の印と、行の札）。rows とは別に持つ ── rows は台帳とそのまま突き合わせる。 */
      marks: [...root.querySelectorAll('.cr-fig')].map(f => ({
        kind: t(f.querySelector('dt')), hatch: f.querySelectorAll('.cr-hatch').length, max: f.classList.contains('is-max'),
      })),
      loose: root.querySelectorAll('.cr-hatch').length - root.querySelectorAll('.cr-fig .cr-hatch').length,
      srcs: [...root.querySelectorAll('.cr-srcs a')].map(a => a.getAttribute('href')),
      basis: !!root.querySelector('.cr-basis'),
    });
    const out = {};
    for (const sec of document.querySelectorAll('#cr .cr-view[data-view="airline"]')) {
      const s = sec.dataset.airline;
      const o = out[s] = {
        h1: t(sec.querySelector('.cr-h1')), ov: {}, cmp: {}, cmpN: {}, pubs: sec.querySelectorAll('.cr-pub').length,
        tax: t(sec.querySelector('.cr-pay .cr-tax')), pub: pub(sec.querySelector('.cr-pub')),
      };
      /* 本命の行は、会社の形で2通り ── 押せる棒（詳細を持つ会社）か、大きい額＋小さい棒。
         どちらも中身は同じ：社名・職位・推定の額・「推定」の札・棒。 */
      for (const a of sec.querySelectorAll('a.cr-bar[data-role]')) {
        const v = a.querySelector('.cr-bar-v');
        o.ov[a.dataset.role] = {
          name: t(a.querySelector('.cr-vh')), role: t(a.querySelector('.cr-bar-r')), v: t(v), look: v ? v.dataset.look || '' : '',
          tag: t(a.querySelector('.cr-tag')), sub: t(a.querySelector('.cr-sub')) || '',
          bar: bar(a.querySelector('.cr-fill')), href: a.getAttribute('href'),
        };
      }
      for (const n of sec.querySelectorAll('.cr-num')) {
        const v = n.querySelector('.cr-num-v');
        o.ov[n.dataset.role] = {
          name: t(n.querySelector('.cr-vh')), role: t(n.querySelector('.cr-num-r')), v: t(v), look: v ? v.dataset.look || '' : '',
          tag: t(n.querySelector('.cr-tag')), sub: t(n.querySelector('.cr-sub')) || '',
          bar: bar(sec.querySelector('.cr-mini .cr-fill.is-' + n.dataset.role)), href: null,
        };
      }
    }
    for (const pair of document.querySelectorAll('#cr .cr-cmp .cr-pair')) {
      for (const row of pair.querySelectorAll('.cr-row')) {
        const vh = [...row.querySelectorAll('.cr-vh')].map(t);
        const v = row.querySelector('.cr-row-v');
        const o = out[row.dataset.airline];
        o.cmpN[pair.dataset.role] = (o.cmpN[pair.dataset.role] || 0) + 1;
        o.cmp[pair.dataset.role] = {
          name: t(row.querySelector('.cr-row-co')) || vh[0] || null, role: vh[vh.length - 1] || null, v: t(v), look: v ? v.dataset.look || '' : '',
          tag: t(row.querySelector('.cr-tag')), sub: t(row.querySelector('.cr-sub')) || '',
          bar: bar(row.querySelector('.cr-fill')), href: row.getAttribute('href'),
        };
      }
    }
    for (const card of document.querySelectorAll('#cr .cr-cmp .cr-card')) {
      out[card.dataset.airline].card = pub(card.querySelector('.cr-pub'));
      out[card.dataset.airline].cardPubs = card.querySelectorAll('.cr-pub').length;
    }
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

  /* 額の作り直し。本命の額は、5社とも・どちらの職位も推定年収（SALARY の avg）。
     会社が公表した額はここには入れない（下の「会社が公表している金額」の一覧だけ）。 */
  const want = (slug, rank) => {
    const avg = SALARY[slug]?.[rank]?.avg;
    return Number.isFinite(avg) && avg > 0 ? { man: avg, text: yen(avg), tag: TIERS.estimate.ja } : null;
  };

  const axisMax = Math.round(Number(dom.div) * 1000);
  const mans = [];
  for (const s of FIVE) {
    for (const [r, label] of ROLES) {
      const who = `${name(s)} ${label}`;
      const w = want(s, r), a = dom.co[s].ov[r], b = dom.co[s].cmp[r];
      if (!w || !a || !b) { ok(false, `${who}: 推定年収が出ている（概要と比較）`, `正本 ${JSON.stringify(w)} ／ 概要 ${JSON.stringify(a)} ／ 比較 ${JSON.stringify(b)}`); continue; }
      mans.push(w.man);
      ok(a.v === w.text && b.v === w.text, `${who} ＝ ${w.text}（SALARY の avg・概要と比較で同じ）`, `概要「${a.v}」／比較「${b.v}」`);
      ok(cell(s, r).man === w.man && cell(s, r).text === w.text, `${who}: 生成側も同じ額を持っている`, JSON.stringify(cell(s, r)));
      ok(a.name === name(s) && a.role === label && b.name === name(s) && b.role === label, `${who}: 社名と職位が額のそばに在る`);
      ok(dom.co[s].cmpN[r] === 1, `${who}: 比較の年収の行は1本だけ（公表額の行を並べていない）`, `${dom.co[s].cmpN[r]}本`);
      for (const [where, x] of [['概要', a], ['比較', b]]) {
        ok(x.tag === w.tag, `${who}（${where}）: 札は「${w.tag}」`, `「${x.tag}」`);
        ok(x.look !== 'held' && !/確認中/.test(x.v + x.tag + x.sub), `${who}（${where}）: 年収を「確認中」と出していない`, `「${x.v}」 look=${x.look}`);
        /* 推定の額に、公表額の印（〜・超・上限・斜線）を付けない ── 付くと、推定が求人の額の顔になる。 */
        const marks = [/[〜超]/.test(x.v), /上限|下限|目標/.test(x.tag + x.sub), !!x.bar && (x.bar.cls.includes('is-max') || x.bar.cls.includes('is-over'))];
        ok(marks.every(v => !v), `${who}（${where}）: 推定の額に公表額の印（〜・超・上限）を付けていない`, marks.join(' / '));
        ok(!!x.bar && /%$/.test(x.bar.w) && Math.abs(parseFloat(x.bar.w) - w.man / axisMax * 100) < 0.01,
           `${who}（${where}）: 棒の長さが額に比例`, x.bar && x.bar.w);
      }
      ok(a.tag === b.tag && a.sub === b.sub, `${who}: 札と一言が概要と比較で同じ`);
      if (DEEP.includes(s)) {
        const href = `${PAGE}?airline=${s}&d=${r}-est`;
        ok(a.href === href && b.href === href, `${who}: 概要と比較の行から、その推定の詳細へ行ける`, `${a.href} ／ ${b.href}`);
      }
    }
    ok(dom.co[s].h1 === name(s), `${name(s)}: 見出しが社名`);
    ok(dom.co[s].tax === BASIS[s].tax && dom.co[s].cmpTax === BASIS[s].tax,
       `${name(s)}: 税の扱いが台帳どおり（概要と比較）`, `${dom.co[s].tax} ／ ${dom.co[s].cmpTax}`);
  }

  /* 目盛。0 から・全部の棒が入る・いちばん近い 1,000万 の倍数・どの画面も同じ。 */
  const top = Math.max(...mans);
  ok(axisMax % 1000 === 0 && axisMax >= top && axisMax - 1000 < top, `目盛の右端 ${yen(axisMax)} は全部の棒が入るいちばん近い 1,000万 の倍数`, `最大の棒 ${yen(top)}`);
  ok(dom.axes.length >= FIVE.length + 1 && dom.axes.every(a => same(a, ['0', yen(axisMax / 2), yen(axisMax)])),
     '目盛は 0 から・どの画面も同じ', JSON.stringify(dom.axes[0]));

  /* 会社が公表している金額。訓練生は出さない。 */
  head('会社が公表している金額');
  for (const s of FIVE) {
    const exp = ['cap', 'fo', 'crew'].flatMap(r => figures(s, r).filter(f => !f.training).map(f => ({
      tag: TIERS[BASIS[s][r].tier].ja, group: f.group, kind: f.kind, amount: upTo(f.key) + f.text + tail(f.key),
      orig: f.cur === 'JPY' ? '' : `${upTo(f.key)}${f.cur} ${f.amount.toLocaleString('en-US')}${tail(f.key) ? ' ' + tail(f.key) : ''}`,
    })));
    const got = dom.co[s].pub;
    if (!got) { ok(false, `${name(s)}: 概要に「会社が公表している金額」の一覧が在る`); continue; }
    ok(dom.co[s].pubs === 1 && dom.co[s].cardPubs === 1, `${name(s)}: 一覧は概要に1つ・比較のカードに1つ`, `概要 ${dom.co[s].pubs} ／ 比較 ${dom.co[s].cardPubs}`);
    /* 1行ごとに、誰の額か（区分）・何の額か（種類の名前）・札が付いている。 */
    ok(got.rows.every(x => x.tag && x.group && x.kind), `${name(s)}: 公表額の全部の行に、札・区分・種類の名前が付いている`,
       got.rows.filter(x => !(x.tag && x.group && x.kind)).map(x => JSON.stringify(x)).join(' ／ '));
    /* 上限の印は3つで1組 ── 「〜」（下の検査）・斜線の印・「上限」の字。上限でない行には斜線を付けない。 */
    ok(got.marks.every(m => m.hatch === (/上限/.test(m.kind) ? 1 : 0) && m.max === /上限/.test(m.kind)) && got.loose === 0
       && same(dom.co[s].card.marks, got.marks) && dom.co[s].card.loose === 0,
       `${name(s)}: 斜線の印は「上限」の行にだけ・1つずつ（概要と比較のカード）`, JSON.stringify(got.marks));
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
    /* 比較は 2社×2職位＝4本、概要は 機長・副操縦士＝2本。どれも推定年収の棒。
       概要は5社とも測る。1社しか見ていなかった頃は、ほかの会社の棒が1本ずれても通っていた（2026-10-04）。
       求人の上限を持つのはエティハドだけ ── 斜線の印が在るのは、エティハドの入る画面の公表額の一覧だけ。 */
    for (const [q, n, capped] of [['?view=compare&a=etihad&b=eva-air', 4, true], ...FIVE.map(x => [`?airline=${x}`, 2, x === 'etihad'])]) {
      await page.setViewport({ width: w, height: h });
      await go(page, q);
      await settle(page);
      const { bars, axis, hatch } = await page.evaluate(() => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const tx = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
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
              tl: b.left, tr: b.right, pub: !!f.closest('.cr-pub'), bg: getComputedStyle(f).backgroundImage,
            };
          }),
          /* 斜線の印（会社が公表した上限の額の左に付く小さい模様）。 */
          hatch: [...v.querySelectorAll('.cr-hatch')].filter(h => h.getClientRects().length).map(h => {
            const r = h.getBoundingClientRect(), fig = h.closest('.cr-pub .cr-fig');
            return {
              w: r.width, h: r.height, bg: getComputedStyle(h).backgroundImage, inFig: !!fig,
              kind: tx(fig && fig.querySelector('dt')), amount: tx(fig && fig.querySelector('dd b')), orig: tx(fig && fig.querySelector('.cr-orig')),
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
      /* 斜線は描かれた模様で見る（札だけ付いていて模様が無い、を通さない）。
         推定の棒は全部無地。斜線は「会社が公表している金額」の上限の行にだけ在り、「〜」と「上限」の字と一緒。 */
      const stripe = b => /repeating-linear-gradient/.test(b.bg);
      ok(bars.every(b => !stripe(b) && !b.pub), `${w}px ${q}: 棒は全部推定年収（無地・公表額の一覧の中に棒が無い）`,
         bars.map(b => `${b.pub ? '一覧の中' : '年収'}:${stripe(b) ? '斜線' : '無地'}`).join(' '));
      const three = hatch.filter(x => x.inFig && stripe(x) && x.w >= 8 && x.h >= 6 && /上限/.test(x.kind) && x.amount.startsWith('〜') && (!x.orig || x.orig.startsWith('〜')));
      ok(hatch.length === (capped ? ROLES.length : 0) && three.length === hatch.length,
         `${w}px ${q}: ${capped ? `上限の印が${ROLES.length}件とも3つそろって描かれている（〜・斜線・「上限」の字）` : '上限の無い会社に斜線の印が無い'}`,
         hatch.map(x => `${x.kind} ${x.amount}:${stripe(x) ? '斜線' : '模様なし'} ${Math.round(x.w)}×${Math.round(x.h)}`).join(' ／ ') || '印が1つも無い');
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
    /* 年収の行は1社に1本（推定年収）。家賃の箱も1社に1つ（その会社の拠点の街）。 */
    return {
      rows: [...document.querySelectorAll('#cr .cr-cmp .cr-pair[data-role]')].map(p => order(vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`))),
      cards: order(vis('.cr-card')), taxes: order(vis('.cr-taxes .cr-tax')), rents: order(vis('.cr-rentb')),
      opts: ['a', 'b'].map(s => vis(`.cr-side[data-side="${s}"] .cr-opt`).map(e => e.dataset.airline)),
      sel: [document.getElementById('cr-a').value, document.getElementById('cr-b').value],
      off: ['cr-a', 'cr-b'].map(id => [...document.getElementById(id).options].filter(o => o.disabled).map(o => o.value)),
      credits: vis('.cr-credit[data-airline]').map(e => e.dataset.airline),
      /* 置き場所の順（読み上げと Tab が進む順）。見た目の順と同じでなければならない。 */
      dom: [...document.querySelectorAll('#cr .cr-cmp .cr-pair[data-role]')].map(p => vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`).map(e => e.dataset.airline))
        .concat([vis('.cr-card').map(e => e.dataset.airline), vis('.cr-taxes .cr-tax').map(e => e.dataset.airline), vis('.cr-rentb').map(e => e.dataset.airline)]),
    };
  });
  const pairOk = async (a, b, label) => {
    const g = await shown();
    const exp = {
      rows: ROLES.map(() => [a, b]), cards: [a, b], taxes: [a, b], rents: [a, b], opts: [[a], [b]], sel: [a, b], off: [[b], [a]],
      credits: [a, b].filter(s => needsCredit(primary(s))),
      dom: [...ROLES.map(() => [a, b]), [a, b], [a, b], [a, b]],
    };
    ok(same(g, exp), label, JSON.stringify(g));
  };
  await pairOk('jal', 'cathay-pacific', '2社だけが並ぶ（棒・カード・税・家賃の箱・写真・クレジット）。相手の会社は選べない');

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
    /* 額の字が入る所の全部 ── 推定年収（概要・比較・詳細）・目盛・会社が公表した額・家賃の円額。
       家賃は、円の街は太字そのものが円額・外貨の街は太字が原貨（pv-no-cur ＝ 変えない）で、その下が円額。 */
    const MONEY = '#cr .cr-num-v, #cr .cr-bar-v, #cr .cr-row-v, #cr .cr-det-v, #cr .cr-axis span:not(:first-child), #cr .cr-fig dd b, #cr .cr-rent dd b:not(.pv-no-cur), #cr .cr-rent dd span';
    const snap = () => p.evaluate(sel => ({
      /* あとから通信で埋まる欄と、保存するカードの画面は、通貨の往復の照合から外す（字が通信の結果で変わる）。 */
      all: (() => { const c = document.getElementById('cr').cloneNode(true); c.querySelectorAll('.crl, [data-view="card"]').forEach(e => e.remove()); return c.textContent; })(),
      keep: [...document.querySelectorAll('#cr .pv-no-cur')].map(e => e.textContent),
      money: [...document.querySelectorAll(sel)].map(e => e.textContent.trim()),
      /* 概要の額（推定年収）。会社の形で置き場所が2通りあるが、どちらも本命の額（data-main）。 */
      ov: Object.fromEntries([...document.querySelectorAll('#cr .cr-view[data-view="airline"] :is(.cr-num, a.cr-bar)[data-role] [data-main]')]
        .map(n => [n.closest('.cr-view').dataset.airline + '/' + n.closest('[data-role]').dataset.role, n.textContent.trim()])),
      cmp: Object.fromEntries([...document.querySelectorAll('#cr .cr-cmp .cr-row')].map(r => [r.dataset.airline + '/' + r.closest('.cr-pair').dataset.role, r.querySelector('.cr-row-v').textContent.trim()])),
      /* 会社が公表した額（概要の一覧）。上限の「〜」と下限の「超」は、通貨を変えても残らなければならない。 */
      pub: Object.fromEntries([...document.querySelectorAll('#cr .cr-view[data-view="airline"]')].map(v => [v.dataset.airline,
        [...v.querySelectorAll('.cr-pub .cr-fig dd b')].map(b => b.textContent.trim())])),
      /* 推定の額そのもの。公表額の印（〜・超）が付いてはいけない。 */
      est: [...document.querySelectorAll('#cr [data-main], #cr .cr-row-v, #cr .cr-det-v')].map(e => e.textContent.trim()),
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
      ok(Object.keys(s.ov).length === FIVE.length * ROLES.length, `${cur}: 5社とも・どちらの職位も推定の額が出ている`, Object.keys(s.ov).join(', '));
      const up = s.pub.etihad || [], over = s.pub['eva-air'] || [];
      ok(up.length === ROLES.length && up.every(t => t.startsWith('〜')) && over.length === 1 && over[0].endsWith('超'),
         `${cur}: 公表額の上限の「〜」と下限の「超」が残る`, `${up.join(' / ')} ／ ${over.join(' / ')}`);
      ok(s.est.length > 0 && s.est.every(t => !/[〜超]|確認中/.test(t)), `${cur}: 推定の額に「〜」「超」「確認中」が付かない`, s.est.filter(t => /[〜超]|確認中/.test(t)).join(' / '));
      /* いちばん狭い画面でも、額が箱からはみ出さない。 */
      const clip = await p.evaluate(() => [...document.querySelectorAll('#cr .cr-view:not([hidden]) .cr-row-v')]
        .filter(e => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth).length);
      ok(clip === 0, `${cur}: 比較の額が画面からはみ出さない`);
    }
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    const back = await p.waitForFunction(t => (() => { const c = document.getElementById('cr').cloneNode(true); c.querySelectorAll('.crl, [data-view="card"]').forEach(e => e.remove()); return c.textContent; })() === t, { timeout: 5000 }, jpy.all).then(() => true, () => false);
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
    /* 家賃の額も同じ ── 外貨の街は原貨と円額が上下に並び、幅のある額（HKD 15,800〜18,500）は字数が多い。
       比較の家賃の箱（.cr-rentb）と、暮らしのタブの街（.cr-town）の両方を測る。 */
    const FIT_VIEWS = [...FIVE.map(s => `?airline=${s}`), ...DEEP.map(s => `?airline=${s}&tab=life`), '?view=compare&a=etihad&b=eva-air', '?view=compare&a=cathay-pacific&b=ana'];
    for (const q of FIT_VIEWS) {
      await go(p, q);
      for (const w of WIDTHS) {
        await p.setViewport({ width: w, height: 568 });
        for (const cur of ['JPY', ...curs]) {
          await p.evaluate(x => window.PVCurrency.set(x), cur);
          await p.waitForFunction((sel, yen) => [...document.querySelectorAll(sel)].every(e => /[¥万円]/.test(e.textContent) === yen), { timeout: 5000 }, MONEY, cur === 'JPY').catch(() => {});
          const cut = await p.evaluate(() => {
            const wide = e => { const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect(); };
            const V = document.querySelector('#cr .cr-view:not([hidden])');
            /* 家賃の行 ── 部屋の名前と額が同じ高さで重ならない（額が長くなると、名前の上に乗る）。 */
            const over = [...V.querySelectorAll('.cr-rent > div')].filter(d => d.getClientRects().length).filter(d => {
              const k = wide(d.querySelector('dt'));
              return [...d.querySelectorAll('dd > *')].some(x => { const v = wide(x); return v.top < k.bottom - 1 && v.bottom > k.top + 1 && v.left < k.right - 0.5; });
            }).map(d => `家賃の名前と額が重なる「${d.textContent.replace(/\s+/g, ' ').trim()}」`);
            return [...V.querySelectorAll(':is(.cr-num-v, .cr-bar-v, .cr-row-v, .cr-fig b, .cr-rent dd b, .cr-rent dd span)')]
              .filter(e => e.getClientRects().length)
              .filter(e => {
                const t = wide(e), box = (e.closest('.cr-num, .cr-bar, .cr-row, .cr-fig, .cr-rentb, .cr-town') || document.documentElement).getBoundingClientRect();
                return t.left < box.left - 0.5 || t.right > box.right + 0.5 || t.right > innerWidth + 0.5 || (e.matches('.cr-num-v') && t.width > e.clientWidth + 0.5);
              })
              .map(e => `${e.className || e.tagName.toLowerCase()}「${e.textContent.trim()}」`)
              .concat(over)
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
    for (const w of WIDTHS) ok(!cutAt[w].length, `${w}px: どの通貨でも額（年収・公表額・家賃）が切れない・重ならない・横に溢れない（${curs.length + 1}通貨 × ${FIT_VIEWS.length}画面）`, cutAt[w].join('\n      '));
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
  head('比較 → カード保存の入口が、いま並べている2社を連れていく');
  {
    const { page: p, close: c } = await open(`?view=compare&a=${DEEP[0]}&b=jal`);
    const to = () => p.evaluate(() => { const x = document.getElementById('cr-to-card'); return x ? x.getAttribute('href') : null; });
    const first = await to();
    ok(first === `${PAGE}?view=card&a=${DEEP[0]}&b=jal`, '開いたときの2社', String(first));
    await p.evaluate(() => { const x = document.getElementById('cr-b'); x.value = 'ana'; x.dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForFunction(() => /b=ana/.test(location.search));
    const next = await to();
    ok(next === `${PAGE}?view=card&a=${DEEP[0]}&b=ana`, '選び直したあとの2社', String(next));
    await c();
  }

  head('大きさ（溢れ・最初の1画面・字・押す場所）');
  const OLD_VIEWS = ['', ...FIVE.map(s => `?airline=${s}`), '?view=compare', '?view=compare&a=etihad&b=eva-air'];
  /* 深い会社（DEEP）の、タブ・就航地・詳細・カードの画面。 */
  const DEEP_VIEWS = DEEP.flatMap(s => [`?airline=${s}&tab=work`, `?airline=${s}&tab=life`, `?airline=${s}&stay=NRT`,
    `?airline=${s}&d=cap-est`, `?airline=${s}&d=fo-est`, `?view=compare&a=${s}&b=jal`, `?view=card&a=${s}&b=jal`, `?view=card&a=${s}`]);
  const VIEWS = [...OLD_VIEWS, ...DEEP_VIEWS];
  /* 写真の出る画面（詳細とカードは、ここでは見ない ── 詳細に写真は無く、カードの写真は画像の中へ描く）。 */
  const PHOTO_VIEWS = [...OLD_VIEWS, ...DEEP.flatMap(s => [`?airline=${s}&tab=life`, `?airline=${s}&stay=NRT`, `?view=compare&a=${s}&b=jal`])];
  /* 押せるものの種類。ここに無い形のものが増えたら落とす（hover / active を付け忘れる）。 */
  const MAIN = '.cr-tile, .cr-back, .cr-btn, .cr-swap, .cr-sel, summary, .cr-link, .cr-card-n, '
    + '.cr-tab, a.cr-bar, a.cr-row, .cr-ent, .cr-ask, .cr-dest, .cr-job, .crl-cta, .crl-link, .crl-retry, .crs-act, .crs-ent, .crc-opt, .crc-sel, .crc-th, .crc-btn';
  const INLINE = '.cr-credits a, .cr-srcs a';
  for (const [w, h] of [[320, 568], [390, 680], [768, 1024], [1280, 800]]) {
    const { page: p, close: c } = await open('', w, h);
    const bad = [], past = [];
    for (const q of VIEWS) {
      await go(p, q);
      await settle(p);
      const m = await p.evaluate((MAIN, INLINE) => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const on = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        /* 最初の1画面に年収が入っているか（開く前に測る）。 */
        /* 深く作った会社の年収の箱は、推定の2行（押せる棒）＋目盛＋税の1行。「年収が入っている」は推定の2行で測る。
           箱の下端（税の1行）まで入らない大きさは落とさずに、下で1行ずつ知らせる（黙って緑にしない）。 */
        const deep = v.querySelector('.cr-pay-deep');
        const ests = deep ? [...deep.querySelectorAll('a.cr-bar.cr-bar-est')] : [];
        const first = ests.length ? ests[ests.length - 1] : v.querySelector('.cr-pay') || v.querySelector('.cr-pair');
        const fold = first ? Math.round(first.getBoundingClientRect().bottom) : null;
        const deepEnd = deep ? Math.round(deep.getBoundingClientRect().bottom) : null;
        if (deep && !ests.length) return { noEst: true };
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
        for (const el of v.querySelectorAll('.cr-num-v, .cr-bar-v, .cr-row-v, .cr-fig b, .cr-tile-n, .cr-opt-n, .cr-hero-n, .cr-row-co')) {
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
          fold, deepEnd, vh: innerHeight, small: [...small], tap: [...tap], stray: [...stray], cut: [...cut], sel,
        };
      }, MAIN, INLINE);
      const at = `${w}×${h} ${q || '（入口）'}`;
      if (m.noEst) { bad.push(`${at}: 推定年収の行が見つからない`); continue; }
      if (m.deepEnd !== null && w >= 390 && m.deepEnd > m.vh) past.push(`${at}: 年収の箱の下端（税の1行）までは最初の1画面に収まらない（下端 ${m.deepEnd} / 画面 ${m.vh}）`);
      if (m.over > 0) bad.push(`${at}: 横に ${m.over}px 溢れる`);
      if (m.fold !== null && w >= 390 && m.fold > m.vh) bad.push(`${at}: 年収が最初の1画面に入らない（下端 ${m.fold} / 画面 ${m.vh}）`);
      if (m.small.length) bad.push(`${at}: 12px 未満の字 ${m.small.join(', ')}`);
      if (m.tap.length) bad.push(`${at}: 44px 未満の押す場所 ${m.tap.join(', ')}`);
      if (m.stray.length) bad.push(`${at}: 知らない形の押せるもの ${m.stray.join(' ')}`);
      if (m.cut.length) bad.push(`${at}: 字がはみ出す ${m.cut.join(', ')}`);
      if (m.sel.some(f => f < 16)) bad.push(`${at}: 選ぶ欄の字が 16px 未満（iOS が画面ごと拡大する）`);
    }
    ok(!bad.length, `${w}×${h}: ${VIEWS.length}画面とも 溢れない・${w >= 390 ? '年収が最初の1画面に入る・' : ''}字 12px 以上・押す場所 44px 以上`, bad.join('\n      '));
    for (const x of past) console.log('    ⚠ ' + x);
    await c();
  }

  /* ── ①（続き）推定年収を出している・「確認中」が無い ─────────── */
  head('推定年収を出している・「確認中」が無い（概要・比較・詳細・カード）');
  {
    /* ★2026-10-06 オーナー決定「推定年収を一律「確認中」に戻さない」。5社とも 機長・副操縦士の推定年収が主情報。
       2026-10-05 までは、ここに「保留にした推定を、どこにも出していない」という逆向きの検査が在った。
       わざと書き直してある ── 戻すと、年収が「確認中」に戻っても緑のままになる。 */
    const WORD = '確認中';
    /* 文言は決めごとなので、生成側から借りずにここへ書く（片方だけ変えると赤くなる）。 */
    const PLAIN = '当サイトの推定（公開情報からの推計）。根拠の資料はまだ記録していません。';
    const TARGET = '機種の指定なし';
    const norm = x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
    const avg = (s, r) => SALARY[s][r].avg;

    /* a) 配っているファイル。 */
    ok(!BLOCK.includes(WORD), 'career.html のどこにも「確認中」が無い（本文・属性・カードの材料）');
    ok(!/data-look="held"|\sdata-lim[=\s>-]/.test(BLOCK), 'career.html に「保留」の印（data-look="held"）と、推定に重ねる上限（data-lim）が無い');
    ok(!noJsCmt(read('career-card.js')).includes(WORD) && !JSC.includes(WORD), 'カードを描く JS・見せ方の JS は「確認中」の字を持たない（字は全部 HTML から読む）');

    const { page: p, close: c } = await open(`?airline=${FIVE[0]}`);
    /* b) 年収の額と札の欄を全部拾う（見えていない画面のぶんも）。探す道具は、下でわざと汚して効き目を確かめる。 */
    const heldAt = () => p.evaluate(WORD => [...document.querySelectorAll('#cr [data-main], #cr [data-main-tag], #cr .cr-row-v, #cr .cr-row-k, #cr .cr-det-v, #cr .cr-det-k')]
      .filter(e => !e.closest('.crl') && e.textContent.includes(WORD)).map(e => e.className)
      .concat([...document.querySelectorAll('#cr [data-look="held"]')].map(e => 'data-look ' + e.className)), WORD);
    const n0 = await p.evaluate(() => ({
      main: document.querySelectorAll('#cr [data-main]').length,
      rows: document.querySelectorAll('#cr .cr-row-v').length,
      det: document.querySelectorAll('#cr .cr-det-v').length,
    }));
    const found = await heldAt();
    ok(n0.main === FIVE.length * ROLES.length && n0.rows === FIVE.length * ROLES.length && n0.det === DEEP.length * ROLES.length && !found.length,
      `年収の欄 ${n0.main + n0.rows + n0.det}か所（概要・比較・詳細）のどれも「確認中」でない`, `概要${n0.main} 比較${n0.rows} 詳細${n0.det} ／ ${found.join(', ')}`);
    await p.evaluate(WORD => { const b = document.querySelector('#cr [data-main]'); b.dataset.keep = b.textContent; b.textContent = WORD; }, WORD);
    const caught = await heldAt();
    await p.evaluate(() => { const b = document.querySelector('#cr [data-main][data-keep]'); b.textContent = b.dataset.keep; delete b.dataset.keep; });
    ok(caught.length === 1 && !(await heldAt()).length, 'わざと概要の年収を「確認中」に戻すと、この検査が拾う（このブラウザの中だけ。配っているファイルは触らない）', caught.join(', '));

    /* c) 推定年収の説明 ── 根拠が台帳に在る職位（est.backed）だけ 根拠・算出方法・時点。
          無い職位は1行だけ（根拠・幅・件数・時点を作らない）。対象は「機種の指定なし」。 */
    const info = await p.evaluate(() => {
      const t = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
      const rows = dl => (dl ? [...dl.querySelectorAll('.cr-fact')].map(f => [t(f.querySelector('dt')), t(f.querySelector('dd'))]) : null);
      const notes = {};
      for (const v of document.querySelectorAll('#cr .cr-view[data-view="airline"]')) {
        const all = v.querySelectorAll('details.cr-est'), d = all[0];
        notes[v.dataset.airline] = !d ? null : {
          n: all.length, sum: t(d.querySelector('summary')), inPub: !!d.closest('.cr-pub'),
          parts: [...d.querySelectorAll('.cr-est-r')].map(q => ({
            role: t(q.firstChild), target: t(q.querySelector('span')),
            rows: rows(q.nextElementSibling && q.nextElementSibling.matches('dl.cr-facts') ? q.nextElementSibling : null),
          })),
        };
      }
      const det = [...document.querySelectorAll('#cr .cr-view[data-view="detail"]')].map(v => {
        const f = v.querySelectorAll('.cr-fill');
        return {
          slug: v.dataset.airline, d: v.dataset.d, h1: t(v.querySelector('h1')), v: t(v.querySelector('.cr-det-v')),
          tag: t(v.querySelector('.cr-det-k .cr-tag')), top: t(v.querySelector('.cr-det-top')), fills: f.length,
          w: f[0] ? f[0].style.getPropertyValue('--w').trim() : '', rows: rows(v.querySelector('dl.cr-facts')),
          links: [...v.querySelectorAll('.cr-else a')].map(a => [a.getAttribute('href'), t(a)]),
          pub: v.querySelectorAll('.cr-pub, .cr-fig, .cr-hatch').length,
        };
      });
      return { notes, det };
    });
    const estRows = (s, r) => {
      const e = viewOf(s).pay[r].est;
      return e.backed ? [['根拠', norm(e.basis)], ['算出方法', norm(e.method)], ['時点', norm(e.asOf)]] : [['推定', PLAIN]];
    };
    const why = (s, r) => (viewOf(s).pay[r].est.backed ? '根拠・算出方法・時点は台帳どおり' : '根拠の無い推定は1行だけ（根拠・幅・件数・時点を作らない）');
    for (const s of FIVE) {
      ok(ROLES.every(([r]) => viewOf(s).pay[r].est.man === avg(s, r)), `${name(s)}: 読み口（pv-airline-view.mjs）の推定は正本の avg と同じ額`,
        ROLES.map(([r]) => `${viewOf(s).pay[r].est.man}/${avg(s, r)}`).join(' '));
      if (DEEP.includes(s)) {
        const mine = info.det.filter(x => x.slug === s);
        ok(info.notes[s] === null && same(mine.map(x => x.d), ROLES.map(([r]) => `${r}-est`)),
          `${name(s)}: 推定年収の詳細は職位ごとに1枚（${ROLES.map(([r]) => `d=${r}-est`).join('・')}）。求人の上限だけの画面は持たない`, mine.map(x => x.d).join(','));
        for (const [i, [r, l]] of ROLES.entries()) {
          const x = mine[i];
          if (!x) continue;
          const other = ROLES.find(([q]) => q !== r);
          ok(x.h1 === `${name(s)} ${l}の推定年収` && x.v === yen(avg(s, r)) && x.tag === '推定',
            `${name(s)} ${l}の詳細: 見出しと額（${yen(avg(s, r))}・「推定」の札）`, `「${x.h1}」「${x.v}」「${x.tag}」`);
          ok(x.fills === 1 && Math.abs(parseFloat(x.w) - avg(s, r) / axisMax * 100) < 0.01 && !/[〜超]|上限|下限|目標/.test(x.top) && x.pub === 0,
            `${name(s)} ${l}の詳細: 棒は推定の1本だけ（額に比例）・公表額の印も一覧も混ぜない`, `棒${x.fills}本 ${x.w} ／ ${x.top}`);
          ok(same(x.rows, [['対象', `${l}${TARGET}`], ...estRows(s, r)]), `${name(s)} ${l}の詳細: 対象は「${TARGET}」・${why(s, r)}`, JSON.stringify(x.rows));
          ok(same(x.links, [[`${PAGE}?airline=${s}&d=${other[0]}-est`, `${other[1]}の推定年収`]]), `${name(s)} ${l}の詳細: もう一方の職位の推定へ行ける`, JSON.stringify(x.links));
        }
      } else {
        const x = info.notes[s];
        ok(!!x && x.n === 1 && x.sum === '推定年収について' && !x.inPub && same(x.parts.map(q => q.role), ROLES.map(([, l]) => l)) && x.parts.every(q => q.target === TARGET),
          `${name(s)}: 「推定年収について」は1つ・職位ごと・対象は「${TARGET}」・公表額の一覧の外`, JSON.stringify(x && { n: x.n, sum: x.sum, parts: x.parts.map(q => [q.role, q.target]) }));
        if (!x) continue;
        for (const [i, [r, l]] of ROLES.entries()) ok(!!x.parts[i] && same(x.parts[i].rows, estRows(s, r)), `${name(s)} ${l}: ${why(s, r)}`, JSON.stringify(x.parts[i] && x.parts[i].rows));
      }
    }
    const backed = FIVE.flatMap(s => ROLES.filter(([r]) => viewOf(s).pay[r].est.backed).map(([, l]) => `${name(s)} ${l}`));
    console.log(`    根拠が台帳に在る推定: ${backed.join('・') || 'なし'}`);

    /* d) 無くした住所（求人の上限だけの詳細）は、その会社の概要へ落ち着く。 */
    for (const s of DEEP) {
      await go(p, `?airline=${s}&d=cap-max`);
      ok(await view(p) === `airline:${s}`, `?airline=${s}&d=cap-max（無くした住所）は ${name(s)} の概要を出す`, await view(p));
      await go(p, `?airline=${s}&d=cap-est`);
      ok(await view(p) === `detail:${s}`, `?airline=${s}&d=cap-est は推定年収の詳細を出す`, await view(p));
    }

    /* e) 保存するカード ── 本命の数字は推定年収（札も「推定」・棒は額に比例）。
          公表した上限を載せるなら「〜」と「上限」の字つき（いまは載せていない）。 */
    for (const s of FIVE) {
      const other = FIVE[(FIVE.indexOf(s) + 1) % FIVE.length];
      for (const want of [[s], [s, other]]) {
        const q = `?view=card&a=${want[0]}${want[1] ? `&b=${want[1]}` : ''}`;
        await go(p, q);
        const got = await p.waitForFunction(n => {
          const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
          return !!(m && m.cards && m.cards.length === n && m.cards.every(k => k.roles));
        }, { timeout: 5000 }, want.length).then(() => true, () => false);
        ok(got, `${q}: カードの材料が出来る`);
        if (!got) continue;
        const card = await p.evaluate(() => {
          const m = window.PVCareerCard.model();
          return { cards: m.cards.map(k => ({ slug: k.slug, roles: k.roles })), json: JSON.stringify(m), text: document.querySelector('#cr .cr-view:not([hidden])').textContent };
        });
        ok(same(card.cards.map(x => x.slug), want) && !card.json.includes(WORD) && !card.text.includes(WORD), `${q}: カードの材料にも画面にも「確認中」が無い`, card.cards.map(x => x.slug).join(','));
        for (const x of card.cards) for (const [r, l] of ROLES) {
          const y = x.roles && x.roles[r], a = avg(x.slug, r);
          ok(!!y && y.text === yen(a) && y.tag === '推定' && y.look !== 'held' && Math.abs(y.w - a / axisMax) < 0.001,
            `${q}: カードの ${name(x.slug)} ${l} は推定年収 ${yen(a)}（「推定」の札・棒は額に比例）`, JSON.stringify(y && { text: y.text, tag: y.tag, look: y.look, w: y.w }));
          ok(!!y && (!y.lim || (/^〜/.test(y.lim.text) && /上限/.test(`${y.lim.tag}${y.lim.sub}`))),
            `${q}: カードの ${name(x.slug)} ${l} に公表した上限を載せるなら「〜」と「上限」の字つき`, JSON.stringify(y && y.lim));
        }
      }
    }
    await c();
  }

  /* ── ②（続き）会社が公表した額は、一覧の中にだけ ─────────────── */
  head('会社が公表した額は、一覧の中にだけ在る');
  {
    /* 会社が公表した年額（求人の上限・目標年収・下限・乗員全体の平均）は「会社が公表している金額」の一覧にだけ出す。
       推定の欄・棒・目盛・詳細・家賃・カードの材料へ出さない（出すと、推定と公表額が同じ物差しに乗る）。 */
    const ests = new Set(FIVE.flatMap(s => ROLES.map(([r]) => SALARY[s][r].avg)));
    const PUBS = FIVE.flatMap(s => ['cap', 'fo', 'crew'].flatMap(r => figures(s, r).filter(f => !f.training && /(^|_)y(_|$)/.test(f.key))
      .map(f => ({ s, man: f.man, amount: f.amount, cur: f.cur }))));
    /* 推定とたまたま同じ額の公表額は探せない（探すと推定そのものを拾う）。在れば下で知らせる。 */
    const skip = PUBS.filter(f => ests.has(f.man)), seek = PUBS.filter(f => !ests.has(f.man));
    const num = n => n.toLocaleString('en-US').replace(/,/g, ',?');
    const leaks = text => seek.filter(f => new RegExp(
      `(?<![\\d,.])${num(f.man)}\\s*万|[¥￥]\\s*${num(f.man)}(?![\\d,])|(?<![\\d,.])${num(f.man * 10000)}(?![\\d,])`
      + (f.cur === 'JPY' ? '' : `|${f.cur}\\s*${num(f.amount)}(?![\\d,])`)).test(String(text))).map(f => `${name(f.s)} ${f.man}万`);

    const { page: p, close: c } = await open('?view=compare');
    const out = await p.evaluate(() => {
      const cr = document.getElementById('cr'), k = cr.cloneNode(true);
      k.querySelectorAll('.cr-pub, .crl').forEach(e => e.remove());
      const data = document.getElementById('crc-data');
      return {
        outside: k.outerHTML, inside: [...cr.querySelectorAll('.cr-pub')].map(e => e.outerHTML).join('\n'), data: data ? data.textContent : null,
        pubs: cr.querySelectorAll('.cr-pub').length, heads: [...new Set([...cr.querySelectorAll('.cr-pub > .cr-h2')].map(e => e.textContent.trim()))],
        figs: cr.querySelectorAll('.cr-fig').length, figsIn: cr.querySelectorAll('.cr-pub .cr-fig').length,
        scale: cr.querySelectorAll('.cr-pub :is(.cr-track, .cr-fill, .cr-axis)').length,
        estIn: cr.querySelectorAll('.cr-pub :is([data-main], .cr-row-v, .cr-det-v, .cr-est)').length,
      };
    });
    const inside = leaks(out.inside), outside = [...leaks(out.outside), ...(out.data ? leaks(out.data) : [])];
    ok(seek.length >= FIVE.length && inside.length === seek.length, `探す道具が効いている（公表した年額 ${seek.length}件を、一覧の中では全部拾う）`, `拾えたのは ${inside.join(', ')}`);
    ok(!outside.length, `公表した年額 ${seek.length}件は、一覧の外（推定の欄・棒・詳細・家賃・カードの材料）のどこにも無い`, outside.join(', '));
    ok(out.pubs === FIVE.length * 2 && same(out.heads, ['会社が公表している金額']) && out.figs > 0 && out.figs === out.figsIn,
      `一覧は概要と比較に1つずつ（${out.pubs}）・見出しは全部「会社が公表している金額」・額の行（${out.figs}）は一覧の中だけ`, `${out.heads.join(' / ')} ／ 行 ${out.figs}・うち一覧の中 ${out.figsIn}`);
    ok(out.scale === 0 && out.estIn === 0, '一覧の中に 棒・目盛・推定の欄 を置いていない（公表額を推定と同じ物差しに乗せない）', `棒・目盛 ${out.scale} ／ 推定の欄 ${out.estIn}`);
    /* わざと公表額を推定の欄へ写して、赤くなることを確かめる（写すのは複製のほう。画面も配っているファイルも触らない）。 */
    const planted = await p.evaluate(v => {
      const k = document.getElementById('cr').cloneNode(true);
      k.querySelectorAll('.cr-pub, .crl').forEach(e => e.remove());
      k.querySelector('.cr-row-v').textContent = v;
      return k.outerHTML;
    }, yen(seek[0].man));
    ok(leaks(planted).length > 0, 'わざと公表額を推定の欄へ写すと、この検査が拾う');
    if (skip.length) console.log('    ⚠ 推定と同じ額なので探せない公表額: ' + skip.map(f => `${name(f.s)} ${f.man}万`).join(', '));
    await c();
  }

  /* ── ⑪ 家賃 ─────────────────────────────────────────────────── */
  head('家賃（1か月あたり・街ごとに別の箱）');
  {
    /* ★2026-10-06 オーナー決定「家賃は月額で表示・比較し、条件の揃わない街を同じ目盛で競わせない」。
       比較の画面は、会社ごとに 拠点の街の箱を1つずつ。箱の中に その街の物差し（何の家賃か）・出どころ・時点 を持つ。
       2つの街を1つの表・1つの目盛に並べない。額は読み口（pv-airline-view.mjs の living）の月額をそのまま。 */
    const norm = x => String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
    const cellOf = (L, v) => { const k = rentCell(L.cur, v); return k ? (k.orig ? [norm(k.orig), norm(k.yen)] : [norm(k.yen)]) : null; };
    const PAIR_Q = ['etihad', 'cathay-pacific'];
    const { page: p, close: c } = await open(`?view=compare&a=${PAIR_Q[0]}&b=${PAIR_Q[1]}`);
    const got = await p.evaluate(() => {
      const t = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
      const rows = dl => (dl ? [...dl.querySelectorAll(':scope > div')].map(d => {
        const parts = [...d.querySelectorAll('dd > *')];
        return { k: t(d.querySelector('dt')), v: parts.map(t), keep: parts.map(e => e.classList.contains('pv-no-cur')) };
      }) : []);
      const sec = document.querySelector('#cr .cr-view[data-view="compare"] .cr-rents');
      const plain = sec ? sec.cloneNode(true) : null;
      if (plain) plain.querySelectorAll('details').forEach(e => e.remove());
      return {
        secs: document.querySelectorAll('#cr .cr-rents').length, all: document.querySelectorAll('#cr .cr-rentb').length,
        h2: sec ? t(sec.querySelector('.cr-h2')) : null, text: sec ? t(sec) : '', plain: plain ? t(plain) : '',
        scale: sec ? sec.querySelectorAll('.cr-track, .cr-fill, .cr-axis, table, .cr-pair, .cr-row').length : -1,
        boxes: sec ? [...sec.querySelectorAll('.cr-rentb')].map(b => ({
          slug: b.dataset.airline, shown: b.getClientRects().length > 0, tag: b.tagName,
          city: t(b.querySelector('.cr-rentb-h span')), measure: t(b.querySelector('.cr-rentb-k .cr-tag')),
          k: t(b.querySelector('.cr-rentb-k')), pick: t(b.querySelector('.cr-rentb-k small')),
          dls: b.querySelectorAll('dl.cr-rent').length, rows: rows(b.querySelector('dl.cr-rent')),
          src: t(b.querySelector('.cr-rentb-s')), when: t(b.querySelector('.cr-rentb-s span')),
          more: t(b.querySelector('details.cr-more summary')), links: [...b.querySelectorAll('.cr-srcs a')].map(a => a.getAttribute('href')),
        })) : [],
        towns: [...document.querySelectorAll('#cr .cr-towns')].map(s => ({
          slug: s.closest('[data-airline]').dataset.airline, h: t(s.querySelector('.cr-town-h')), tag: t(s.querySelector('.cr-town-h .cr-tag')),
          scale: s.querySelectorAll('.cr-track, .cr-fill, .cr-axis, table').length, more: t(s.querySelector('details.cr-more summary')),
          list: [...s.querySelectorAll('.cr-town')].map(li => ({ n: t(li.querySelector('.cr-town-n')), rows: rows(li.querySelector('dl.cr-rent')) })),
        })),
      };
    });
    ok(got.secs === 1 && got.all === FIVE.length && /1か月あたり/.test(got.h2 || ''), `比較の家賃の節は1つ・箱は会社ごとに1つ（${got.all}）・見出しに「1か月あたり」`, `節${got.secs} 箱${got.all}「${got.h2}」`);
    ok(same(got.boxes.filter(b => b.shown).map(b => b.slug), PAIR_Q), '見えている箱は、並べている2社のぶんだけ（選んだ順）', got.boxes.filter(b => b.shown).map(b => b.slug).join(','));
    ok(got.scale === 0, '2つの街を 同じ目盛・同じ表・年収の棒 に並べていない（箱を分ける）', `${got.scale}個`);
    ok(!/年額|1年あたり|年間|per year/i.test(got.plain), '箱の表に出ている字に 年額・1年あたり が無い（額は月額）', got.plain.match(/.{0,12}(?:年額|1年あたり|年間|per year).{0,12}/i)?.[0]);
    ok(!/安い|高い|割安|割高|お得|勝ち|負け|勝る|劣る|優位|差額|[\d.]\s*倍|より(?:安|高)/.test(got.text), '家賃の節に 安い・高い・差・倍 の語を書かない（街どうしを競わせない）', got.text.match(/.{0,12}(?:安い|高い|割安|割高|お得|勝ち|負け|勝る|劣る|優位|差額|[\d.]\s*倍|より(?:安|高)).{0,12}/)?.[0]);
    for (const s of FIVE) {
      const L = viewOf(s).living, lead = L.rents.filter(r => r.lead), b = got.boxes.filter(x => x.slug === s);
      ok(L.per === 'month' && lead.length === 1 && b.length === 1 && b[0].tag === 'ARTICLE' && b[0].dls === 1, `${name(s)}: 家賃は月額・箱は1つ・出す地域は台帳の先頭の1つ`, `per=${L.per} 先頭${lead.length} 箱${b.length}`);
      if (lead.length !== 1 || b.length !== 1) continue;
      const r = lead[0], x = b[0];
      const exp = L.cols.map(([k, l]) => { const v = cellOf(L, r.value[k]); return v ? { k: norm(l), v } : null; }).filter(Boolean);
      ok(exp.length > 0 && same(x.rows.map(o => ({ k: o.k, v: o.v })), exp), `${name(s)}: 家賃の額は台帳の月額どおり（${r.name}・${exp.length}行）`,
        `${JSON.stringify(x.rows.map(o => [o.k, ...o.v]))} ≠ ${JSON.stringify(exp.map(o => [o.k, ...o.v]))}`);
      ok(x.rows.every(o => same(o.keep, L.cur === 'JPY' ? [false] : [true, false])), `${name(s)}: ${L.cur === 'JPY' ? '円の額は通貨の切り替えが読める' : '原貨の額は切り替えで動かない・円の額は切り替えが読める'}`, JSON.stringify(x.rows.map(o => o.keep)));
      /* 地域を選んだ理由（pick）は台帳の字のまま ── ただし社名だけは段階3の面の決まり（sayText。エバー航空 → 「EVA Airの事業所がある」） */
      ok(x.city === norm(L.city) && x.measure === norm(L.measure) && x.k.includes(norm(r.label)) && (!r.pick || x.pick === norm(sayText(s, r.pick)))
        && (s !== 'eva-air' || x.pick === 'EVA Airの事業所がある'),
        `${name(s)}: 箱に その街（${L.city}）・物差し（${L.measure}）・地域（${r.label}） が書いてある${r.pick ? `・選んだ理由は「${sayText(s, r.pick)}」（社名は日本の会社は日本語・ほかは英語）` : ''}`,
        `「${x.city}」「${x.measure}」「${x.k}」「${x.pick}」`);
      ok(x.src.includes(norm(r.src.name)) && x.when === norm(r.when) && x.links.includes(r.src.url) && x.more === '前提と出どころ',
        `${name(s)}: 箱に 出どころ と 時点（${r.when}） が書いてあり、出どころへ行ける`, `「${x.src}」 ${x.links.join(' ')}`);
    }
    /* 暮らしのタブ（深く作った会社）── 1つの街の中の地域を、全部にそろっている間取りだけで並べる。 */
    ok(same(got.towns.map(x => x.slug), DEEP), `「拠点の街」の節を持つのは深く作った会社だけ（${DEEP.join(', ')}）`, got.towns.map(x => x.slug).join(','));
    for (const x of got.towns) {
      const s = x.slug, L = viewOf(s).living;
      const rooms = L.cols.filter(([k]) => L.rents.every(r => cellOf(L, r.value[k])));
      const exp = L.rents.map(r => ({ n: norm(r.name), rows: rooms.map(([k, l]) => ({ k: norm(l), v: cellOf(L, r.value[k]) })) }));
      ok(/1か月あたり/.test(x.h) && x.tag === norm(L.measure) && rooms.length > 0 && rooms.every(([, l]) => x.h.includes(norm(l))) && x.scale === 0,
        `${name(s)} 暮らし: 家賃の見出しに「1か月あたり」・物差し（${L.measure}）・間取り（${rooms.map(q => q[1]).join('・')}）。目盛も表も無い`, `「${x.h}」`);
      ok(same(x.list.map(o => ({ n: o.n, rows: o.rows.map(q => ({ k: q.k, v: q.v })) })), exp), `${name(s)} 暮らし: ${exp.length}地域の家賃は台帳の月額どおり`,
        `${JSON.stringify(x.list.map(o => [o.n, ...o.rows.map(q => q.v.join(' '))]))} ≠ ${JSON.stringify(exp.map(o => [o.n, ...o.rows.map(q => q.v.join(' '))]))}`);
      ok(x.more === '家賃の前提と出どころ', `${name(s)} 暮らし: 家賃の前提と出どころを開ける`, String(x.more));
    }
    await c();
  }

  /* ── ⑧ 写真とクレジット（画面） ─────────────────────────────── */
  head('写真とクレジット（画面）');
  {
    const { page: p, close: c } = await open('');
    const CHANGES = [...new Set([...LEDGER, ...PLACES].map(x => x.changes).filter(Boolean))];
    for (const q of PHOTO_VIEWS) {
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
        /* クレジットの段は1画面に2つ在ることがある（機体の写真の段と、街・就航地の写真の段）。見えているものを全部読む。 */
        const crs = [...v.querySelectorAll('.cr-credits')].filter(on);
        return {
          imgs: [...v.querySelectorAll('img')].filter(on).map(i => i.getAttribute('src')),
          links: crs.flatMap(cr => [...cr.querySelectorAll('a')].filter(on).map(a => [a.getAttribute('href'), a.textContent.trim(), a.target, a.rel])),
          /* 1枚ぶんの塊ごとに、中のリンクを順に。 */
          spans: crs.filter(seen).flatMap(cr => [...cr.querySelectorAll('.cr-credit')].filter(seen).map(s => [...s.querySelectorAll('a')].filter(seen).map(a => [a.getAttribute('href'), a.textContent.trim()]))),
          text: crs.map(cr => [...cr.childNodes].map(n => (n.nodeType === 3 ? n.nodeValue : n.hidden ? '' : n.textContent)).join(' ')).join(' '),
          /* 街の写真のクレジットは、その街の名前を前に付ける（画面に出ている街の名前と同じ字）。 */
          towns: [...v.querySelectorAll('.cr-town-n')].filter(on).map(e => e.textContent.trim()),
        };
      });
      const at = q || '（入口）';
      ok(loaded && g.imgs.length > 0, `${at}: 写真 ${g.imgs.length}枚が全部読める`);
      const stranger = [...new Set(g.imgs)].filter(s => !BY_SRC.get(s));
      ok(!stranger.length, `${at}: 台帳に無い写真が出ていない`, stranger.join(', '));
      const used = [...new Set(g.imgs)].map(s => BY_SRC.get(s)?.p).filter(Boolean);
      const lack = [], extra = [];
      for (const ph of used) {
        if (creditDue(ph)) {
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
      for (const w of [...LEDGER.flatMap(x => [x.author, x.licence, x.aircraft]), ...PLACES.flatMap(x => [x.author, x.licence]), ...g.towns, ...CHANGES, ...FIVE.map(name), '写真']
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
