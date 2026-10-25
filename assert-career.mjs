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
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { unbake } from './cur-core.mjs';
import { BASIS, TIERS, figures } from './salary-basis.mjs';
import { viewOf, rentCell, GLANCE, LEAD } from './pv-airline-view.mjs';
import { PHOTOS, PHOTO_DIR, SMALL_W, needsCredit, primary, smallH, src as photoSrc } from './airline-photos.mjs';
import * as PLACE from './place-photos.mjs';
import { render, FIVE, PAIR, ROLES, PAGE, DEEP, cell, tabOfKey, CMP_KEYS, NEAR, PAGE_EN, WORDS as CR_WORDS, checkWords as crCheckWords } from './gen-career.mjs';
import { curCore, bakeHtml } from './cur-core.mjs';
import { frozenPrint, matrixPrint, qrMatrix } from './career-qr.mjs';
/* 航空会社一覧の形（並び・地域 ── 台帳との突き合わせは assert-directory.mjs が持つ）と、投稿先だけの会社（年収を載せない会社）。 */
import { model as dirModel, REGIONS as DIR_REGIONS } from './directory-model.mjs';
import { OPS } from './airline-ops.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
/* 2026-10-21（P12.86-9）：開く先は PV_BASE で替えられる（serve-local の自分のポートで流すため。3000 は本番の DB につながる）。既定は今までどおり */
const BASE = process.env.PV_BASE || 'http://localhost:3000';
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const head = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length * 2))}`);

const HTML = read(PAGE);
/* ★2026-10-24 段階5 compare-all-1：比較が持つ会社 ＝ 年収の正本（SALARY）の鍵。この検査が自分で持つ一覧（生成側の ALL は読まない）。 */
const ALLK = Object.keys(SALARY);
/* ★2026-10-24 オーナー P12.104「年収はもっと高い人もいるだろうからMAX7000万はおかしい」：棒の目盛に決まった上限は無い。右端は、その画面に
   描く額（推定年収 avg・その幅の上の額 hi・会社が公表している機長と副操縦士の額）のどれもが入る、いちばん近い 1,000万 の倍数。
   1社の画面はその会社・比較とカードは並べた会社をあわせて1本。生成側（pv-airline-view.mjs の scaleOf）を読まずに、正本（SALARY）と
   台帳（figures）からここで作る。 */
const DRAWN = s => ['cap', 'fo'].flatMap(r => [SALARY[s][r].avg, SALARY[s][r].hi, ...figures(s, r).filter(f => !f.training).map(f => f.man)]).filter(n => n > 0);
const SCALE = (...list) => Math.ceil(Math.max(...list.filter(Boolean).flatMap(DRAWN)) / 1000) * 1000;
/* 右端が額に合っているか（右端は 1,000万 の倍数・どの額も右端以下・いちばん大きい額との差は 1,000万 未満）。 */
const fits = (top, ...list) => { const v = list.filter(Boolean).flatMap(DRAWN); return top > 0 && top % 1000 === 0 && v.every(x => x <= top) && top - Math.max(...v) < 1000; };
/* 比較に家賃の箱を置ける会社。生成側の rentable() は読まずに、同じ決まり（読み口 viewOf().living が、箱の決まりどおりの
   1か月あたりの家賃を持つ）をここで打ち直す。先行5社は必ず置く。 */
const RENT_KEYS = ['what', 'period', 'caveat', 'per_month', 'currency', 'cols'];
const boxable = s => {
  if (FIVE.includes(s)) return true;
  const L = viewOf(s).living;
  if (!L || L.research || L.per !== 'month' || !L.measure || !L.city || !(L.rents || []).length) return false;
  if ((L.basis || []).some(b => !RENT_KEYS.includes(b.key))) return false;
  for (const x of L.rents) if (!x.name || (Object.keys(x.value || {}).length && (!x.when || !x.src?.url || !x.src?.name))) return false;
  const lead = L.rents.filter(x => x.lead);
  if (lead.length !== 1 || !L.cols.some(([k]) => rentCell(L.cur, lead[0].value[k]))) return false;
  const by = k => (L.basis || []).find(b => b.key === k)?.value || '';
  return !!(by('what') || lead[0].cond || by('caveat') || by('per_month'));
};
const RENTB = ALLK.filter(boxable);
/* 比較に税の行を置く会社 ＝ 会社ページと同じ読み口が税の扱いを持つ会社。 */
const TAXED = ALLK.filter(s => viewOf(s).pay.tax);
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
/* 比較の社名の行き先（属性で見る）＝ いま改良している会社ページ（airlines/{slug}.html の概要）。 */
const NAME_HREF = s => `airlines/${s}.html`;

/* ══════════════════════════════════════════════════════════════════
   A) 生成物と、数字を持たない2つのファイル
   ══════════════════════════════════════════════════════════════════ */
head('生成物');
ok(render(HTML) === HTML, `${PAGE} は gen-career.mjs の出力と1文字も違わない`,
   'node gen-career.mjs を流す（career.css / career.js を直したあとも）');

/* ★2026-10-22 段階4 cmp-pay-3（T-S1）：この1枚の5社は、先行5社の正本（airline-rollout.mjs の LEAD）そのもの（同じ配列）。
   生成側（gen-career.mjs・gen-airline-glance.mjs）に並びを打ち直さない ── 打ち直すと、正本を直してもこの1枚だけ古い並びのまま残る。 */
{
  const typed = ['gen-career.mjs', 'gen-airline-glance.mjs'].filter(f => read(f).includes("'jal', 'ana', 'cathay-pacific'"));
  ok(FIVE === LEAD && !typed.length, '比較の5社（gen-career.mjs の FIVE）は、先行5社の正本（airline-rollout.mjs の LEAD）そのもの・生成側に並びを打っていない',
     `${FIVE === LEAD ? '' : `FIVE=${FIVE.join(',')} は LEAD と別の配列 `}${typed.length ? `並びを打っている: ${typed.join('・')}` : ''}`);
}

const BLOCK = (HTML.match(/<!--PV-CAREER-->([\s\S]*)<!--\/PV-CAREER-->/) || [])[1] || '';
ok(BLOCK.length > 0, '管理ブロックが在る');
/* ★2026-10-21 リード P12.91-7：「会社が公表している金額」の一覧は、機長・副操縦士の公表額が台帳に在る会社にだけ置く。
   無い会社（JAL・ANA ── 運航乗務員の平均を外したあと）は一覧ごと出さない ＝「公表なし」の行をこの1枚のどこにも書かない。
   どの会社に在るかは、生成側を読まずに台帳（figures）から作り直す。 */
const WITH_PUB = FIVE.filter(s => ['cap', 'fo'].some(r => figures(s, r).some(f => !f.training)));
ok(!/公表なし|class="cr-none"/.test(BLOCK) && (BLOCK.match(/class="cr-pub"/g) || []).length === WITH_PUB.length * 2,
   `「会社が公表している金額」の一覧は、機長・副操縦士の公表額が在る${WITH_PUB.length}社（${WITH_PUB.map(name).join('・')}）にだけ・概要と比較に1つずつ（「公表なし」の行をどこにも書かない）`,
   `一覧 ${(BLOCK.match(/class="cr-pub"/g) || []).length}（あるべき ${WITH_PUB.length * 2}）／「公表なし」${(BLOCK.match(/公表なし/g) || []).length}か所`);
/* 管理ブロックの外に金額が1つも無い（手で足した額は、正本を直しても動かない）。 */
const OUTSIDE = noTagCmt(HTML.replace(BLOCK, () => '')).replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
ok(!/[¥$]\s?\d|\d\s*万/.test(OUTSIDE), '管理ブロックの外に金額が無い', (OUTSIDE.match(/.{0,12}(?:[¥$]\s?\d|\d\s*万).{0,12}/) || [''])[0]);

ok(!/[¥万円]/.test(JSC), 'career.js に金額の字（¥・万・円）が無い');
ok(!/\d{3,}/.test(JSC), 'career.js に3けた以上の数が無い', (JSC.match(/.{0,20}\d{3,}.{0,20}/) || [''])[0]);
ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(JSC), 'career.js は HTML を組み立てない（見せる・隠すだけ）');

/* 古い会社コードの表は2か所に在る（career-live.js と airlines/airline-reviews-ui.js）。会社ページの「会員の投稿 n 件」と
   比較の「会員の投稿 n件」は、この2つが同じ集合のときだけ同じ数になる。片方だけ直すと、どの検査も緑のまま数がずれる。 */
{
  const pairs = (file, name) => {
    const m = read(file).match(new RegExp('var ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\};'));
    return m ? [...m[1].matchAll(/'([a-z0-9-]+)'\s*:\s*'([a-z0-9-]+)'/g)].map(x => `${x[1]}=${x[2]}`).sort() : null;
  };
  const a = pairs('career-live.js', 'LEGACY'), b = pairs('airlines/airline-reviews-ui.js', 'LEGACY_OF');
  ok(!!a && !!b && a.length > 0 && b.length > 0, '古い会社コードの表を2つとも読めた（career-live.js・airline-reviews-ui.js）', JSON.stringify([a, b]));
  ok(same(a, b), '古い会社コードの表が、比較（career-live.js）と会社ページ（airline-reviews-ui.js）で同じ集合', JSON.stringify([a, b]));
}

/* ★2026-10-22 段階4 cmp-pay-2：比較の「提出された年収」の区画（career-live.js の var PAY_TOP から、次の「/* ──」の区切りまで）。
   まだどの画面もこの欄を持たない（置くのは WP-cmp-pay-4）── ここで見るのはファイルの約束だけ（どれも、わざと壊して赤くなるのを確かめた）。 */
head('career-live.js（比較：提出された年収）');
{
  const RAW = read('career-live.js'), LJ = noJsCmt(RAW);
  const at = RAW.indexOf('\n  var PAY_TOP'), end = at < 0 ? -1 : RAW.indexOf('\n  /* ──', at + 1);
  const BLK = at < 0 || end < 0 ? '' : RAW.slice(at, end), BC = noJsCmt(BLK);
  const fnOf = (src, nm) => (src.match(new RegExp(`\\n  function ${nm}\\([^)]*\\) \\{\\n([\\s\\S]*?)\\n  \\}\\n`)) || [])[1] || '';
  ok(/\n  KIND\['cmp-pay'\] = function \(box, ids\) \{/.test(BLK) && ['payCell', 'companyMed', 'medCell', 'aggBlock', 'aggFill'].every(n => fnOf(BC, n)),
     "比較の給与の区画が読めた（var PAY_TOP から次の区切りまで・KIND['cmp-pay'] と中央値の部品が在る）", `${at}・${end}`);
  /* T-S3b どの2社でも同じ道を通る ── 区画（コメントも含めて）に、会社の符号を1つも書かない */
  const SLUGS = [...new Set([...GLANCE, ...Object.keys(SALARY)])];
  const named = SLUGS.filter(s => new RegExp(`['"\`]${s}['"\`]`).test(BLK));
  ok(BLK.length > 0 && !named.length, `比較の給与の区画に、会社の符号を1つも書かない（${SLUGS.length}社のどれも）`, named.join(','));
  /* T-S4 画面は行からもサーバーの額からも何も計算しない（数えるのは返ってきた行の本数だけ） */
  const calc = ['.reduce(', '.sort(', 'Math.'].filter(x => BC.includes(x));
  ok(BLK.length > 0 && !calc.length, '比較の給与の区画は、足さない・並べ替えない・計算しない（.reduce( ・ .sort( ・ Math. が無い）', calc.join(' '));
  /* T-S6（ファイルの半分）中央値の額の印 data-agg を付けるのは medCell だけ・中央値の器の印 data-kind="aggregate" を付けるのは aggBlock だけ */
  const aggAt = LJ.split("setAttribute('data-agg'").length - 1, kindAt = LJ.split("'data-kind', 'aggregate'").length - 1;
  ok(aggAt === 1 && fnOf(BC, 'medCell').includes("setAttribute('data-agg'") && !/dataset\.agg\b/.test(LJ) &&
     kindAt === 1 && fnOf(BC, 'aggBlock').includes("setAttribute('data-kind', 'aggregate')"),
     '中央値の額の印（data-agg）を付けるのは medCell だけ・中央値の器の印（data-kind="aggregate"）を付けるのは aggBlock だけ', `data-agg ${aggAt}か所・aggregate ${kindAt}か所`);
  /* A24 やり直しのボタンは段階で1つ（共通の retryBtn）。この区画は宣言しない。中央値の「やり直す」は、その写し（形と字だけ。動きはここで1つ） */
  const decl = ['function retryBtn(', 'function paintError('].filter(x => BC.includes(x)), af = fnOf(BC, 'aggFill');
  ok(BLK.length > 0 && !decl.length && af.includes('retryBtn().cloneNode(true)') && !/retryBtn\([^)]/.test(LJ),
     '比較の給与の区画は、やり直しのボタンを自分で作らない（retryBtn・paintError を宣言しない）・中央値の「やり直す」は共通の retryBtn() の写し（cloneNode）',
     decl.join(' ') || (af.includes('retryBtn().cloneNode(true)') ? '引数つきの retryBtn(…) が在る' : '中央値のやり直しが retryBtn().cloneNode(true) でない'));
  /* T-S8 読む人が替わった・通貨を替えた時の3つの並び */
  const su = fnOf(LJ, 'setUid');
  ok(/drop\('cmed:'\)/.test(su), '読む人が替わったら、中央値の答えも捨てる（setUid の drop に cmed:）', (su.split('\n').find(l => l.includes('drop(')) || '').trim());
  ok(/reset\(\[[^\]]*'cmp-pay'[^\]]*\]\)/.test(su), '読む人が替わったら、比較の給与の欄も描き直す（setUid の reset に cmp-pay）', (su.split('\n').find(l => l.includes('reset(')) || '').trim());
  const cur = (LJ.match(/addEventListener\('pv-currency-change', function \(\) \{([\s\S]*?)\n  \}\);/) || [])[1] || '';
  ok(/'cmp-pay'/.test(cur) && /'realpay'/.test(cur) && /run\(box, k, /.test(cur), '通貨を替えたら、比較の給与の欄も（開いている時だけ）描き直す（pv-currency-change が realpay と cmp-pay を名指す）', cur.trim().slice(0, 160));
  /* A3（P12.86-5）人数はどこにも出さない ── 中央値の答えから人数を受け取らない・「人」を組み立てない */
  const cm = fnOf(BC, 'companyMed');
  const ppl = [/['"`]人['"`]|人['"`]\s*[;,)+]/, /\bpeople\b/, /T\.(people|answered)\b/].filter(re => re.test(BC)).map(String);
  ok(BLK.length > 0 && !!cm && !ppl.length && !/\bn\s*:/.test(cm),
     '比較の給与の区画は、人数を受け取らない・出さない（companyMed に people も n も無い・「人」を組み立てない）', ppl.join(' ') || (/\bn\s*:/.test(cm) ? 'companyMed に n:' : ''));
}

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
    '.cr a:focus-visible', '.cr button:focus-visible', '.cr summary:focus-visible', '.cr-pickb:focus-visible', '.cr-pk:hover', '.cr-pk:active',
    '.cr-sheet-x:hover', '.cr-sheet-x:active',
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
/* 比較の画面（<section class="cr-view cr-cmp" … </section>）。比較の中のリンクは、career.html の中の古い概要へ行かない。 */
const CMP = (BLOCK.match(/<section class="cr-view cr-cmp"[\s\S]*?<\/section>/) || [''])[0];
ok(CMP.length > 0 && !/href="[^"]*[?&](?:amp;)?airline=/.test(CMP), '比較の中から、career.html の中の古い概要（?airline=）へ行くリンクが無い',
   (CMP.match(/href="[^"]*[?&](?:amp;)?airline=[^"]*"/) || [`比較の画面 ${CMP.length}字`])[0]);
/* 比較の読む順（置き場所の順 ＝ 読み上げと Tab の順）。ほかの区画が足す箱（提出された年収・AI の要約・DEEP PAY の置き場）は、
   在るときだけ、決まった間に在ること。月の働き方と待遇を1つにまとめる入れ物（cr-lives）は無い。 */
{
  const at = m => CMP.indexOf(m);
  const REQ = ['class="cr-panel"', 'class="cr-sec cr-cmp-rev"', 'data-live="cmp-stars"', 'class="cr-sec cr-rents"', 'class="cr-sec cr-cmp-work"',
    'data-live="cmp-work"', 'class="cr-sec cr-cmp-ben"', 'class="cr-cards"', 'id="cr-to-card"'];
  const pos = REQ.map(at);
  const rising = pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1]));
  const facts = [...CMP.matchAll(/data-live="cmp-facts"/g)].map(m => m.index);
  const last = facts.length ? facts[facts.length - 1] : -1;
  const between = (m, lo, hi) => at(m) < 0 || (at(m) > lo && at(m) < hi);
  const opt = [
    between('class="cr-sec cr-subpay"', at('class="cr-panel"'), at('class="cr-sec cr-cmp-rev"')),
    between('data-live="cmp-summary"', at('data-live="cmp-stars"'), at('class="cr-sec cr-rents"')),
    between('id="cr-deep"', last, at('class="cr-cards"')),
  ];
  const factsOk = facts.length > 0 && facts.every(i => i > at('data-live="cmp-work"')) && last > at('class="cr-sec cr-cmp-ben"') && last < at('class="cr-cards"');
  ok(rising && opt.every(Boolean) && factsOk && !CMP.includes('cr-lives'), '比較の読む順：年収 → 提出された年収 → 口コミ → 家賃 → 月の働き方 → 待遇 → 内訳（公表額）',
     JSON.stringify({ pos, opt, facts, lives: CMP.includes('cr-lives') }));
}

/* ★2026-10-23 段階4 cmp-links-card-5（T-L3）：比較の節の下の「詳しく」は、会社ごとに4本 ── 年収・口コミ・月の働き方・待遇。
   行き先は会社ページ（airlines/{slug}.html）の該当タブ（待遇は 給与・待遇 のタブ ── 会社ページが待遇の欄をそこに出す）。
   見える字は 社名＋「詳しく」、読み上げの名前は 節の見出し＋その字（aria-labelledby ── 字を足さない）。社名のリンクは1本（会社ページの頭）。
   家賃の箱の「ほかの街」は暮らしのタブ（街が2つ以上の会社だけ・その会社の箱の中）。ほかに airlines/ へ行くリンクを比較に置かない。 */
head('比較の「詳しく」と「ほかの街」（行き先）');
const GOS = [['pay', 'pay'], ['rev', 'reviews'], ['work', 'work'], ['ben', 'pay']];
{
  const ids = new Set([...BLOCK.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const strip = t => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const attr = (a, k) => (a.match(new RegExp(` ${k}="([^"]*)"`)) || [])[1];
  const FEET = [...CMP.matchAll(/<a class="cr-link cr-go"[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
  const LINKS = [...CMP.matchAll(/<a class="cr-link" href="[^"]*">[\s\S]*?<\/a>/g)].map(m => m[0]);
  const expAir = [];
  /* ★2026-10-24 段階5 compare-all-1（E5.1 P5 ＝ T-A3）：比較は掲載している全社ぶんの「詳しく」を持つ（見せるのは選んだ2社だけ）。
     (a) 4本の id と行き先・(c) 見える字と読み上げの名前・(d) 会社ページのファイルとタブ は全社。# は、そのページのファイルがそのタブを
     持つときだけ（タブの無い今までの形のページはページの頭へ）── タブを持つページは、足が使うタブを全部持つ。
     (b) 社名のリンクは今までどおり先行5社だけ（比較のカードを持つのは5社 ── X3 = B）・ほかの会社には1本も無い。
     (f)「ほかの街」は、比較に家賃の箱を持つ会社（RENTB ── 先行5社は必ず入る）で今までと同じ決まり・箱の無い会社には1本も無い。 */
  for (const s of ALLK) {
    const five = FIVE.includes(s);
    const file = path.join(ROOT, 'airlines', `${s}.html`), P = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const tabs = new Set([...P.matchAll(/ data-pvg-tab="([a-z]+)"/g)].map(m => m[1]));
    const hash = t => (tabs.has(t) ? `#${t}` : '');
    const feet = FEET.filter(a => attr(a, 'data-airline') === s);
    const exp = GOS.map(([k, t]) => [`cr-go-${k}-${s}`, `airlines/${s}.html${hash(t)}`]);
    const got = feet.map(a => [attr(a, 'id'), attr(a, 'href')]);
    const words = feet.map(strip);
    const lab = feet.map(a => (attr(a, 'aria-labelledby') || '').split(' '));
    const labOk = lab.length === GOS.length && lab.every((l, i) => l.length === 2 && l[0] === `cr-cmp-h-${GOS[i][0]}` && l[1] === exp[i][0] && ids.has(l[0]) && ids.has(l[1]));
    const names = CMP.split(`class="cr-card-n" href="airlines/${s}.html"`).length - 1;
    const boxed = RENTB.includes(s), more = boxed && viewOf(s).living.rents.length > 1;
    const used = [...new Set([...GOS.map(g => g[1]), ...(more ? ['life'] : [])])];
    const lack = tabs.size ? used.filter(t => !tabs.has(t)) : [];
    ok(same(got, exp) && words.every(w => w === name(s) + '詳しく') && labOk && names === (five ? 1 : 0) && !!P && !lack.length,
       tabs.size ? `${name(s)}: 比較の「詳しく」は、会社ページの 給与・待遇／口コミ／勤務・訓練 のタブへ（節ごと・会社ごとに1本）`
         : `${name(s)}: 比較の「詳しく」は、会社ページ（タブの無い今までの形）の頭へ（節ごと・会社ごとに1本）`,
       JSON.stringify({ got, words, lab, names, page: !!P, lack }));
    const life = `airlines/${s}.html${hash('life')}`;
    const box = (CMP.match(new RegExp(`<article class="cr-rentb" data-airline="${s}"[\\s\\S]*?</article>`)) || [''])[0];
    const towns = LINKS.filter(a => strip(a) === 'ほかの街' && attr(a, 'href') === life);
    const inBox = (box.match(/<a class="cr-link" href="[^"]*">[\s\S]*?<\/a>/g) || []).filter(a => strip(a) === 'ほかの街' && attr(a, 'href') === life);
    ok(more ? towns.length === 1 && inBox.length === 1 : towns.length === 0,
       `${name(s)}: 家賃の箱の「ほかの街」は、会社ページの暮らしのタブへ（${more ? 'その会社の箱の中に1本' : boxed ? '街が1つなので置かない' : '比較に箱が無いので置かない'}）`,
       `比較に ${towns.length}本・箱の中に ${inBox.length}本（街 ${viewOf(s).living?.rents?.length ?? 0}）`);
    expAir.push(...exp.map(e => e[1]), ...(five ? [`airlines/${s}.html`] : []), ...(more ? [life] : []));
  }
  const air = [...CMP.matchAll(/href="(airlines\/[^"]*)"/g)].map(m => m[1]);
  ok(same([...air].sort(), [...expAir].sort()), '比較の中の airlines/ へのリンクは、「詳しく」・社名・「ほかの街」のほかに無い',
     JSON.stringify({ extra: air.filter(h => !expAir.includes(h)), missing: expAir.filter(h => !air.includes(h)) }));
}

/* ★T-L5（静的な半分）：箱・「詳しく」の先・会社ページのタブが食い違わない。月の働き方の箱の回答の欄は CMP_KEYS.work・待遇の箱は
   CMP_KEYS.pay（欄はそれぞれちょうど1つ）。2つの一覧は同じ質問を持たない。どの質問も、その箱の「詳しく」の先のタブが家（tabOfKey）。
   赤くなったら、直すのは決まり（gen-career.mjs の tabOfKey）── 会社ページでも「詳しく」でもない。 */
{
  /* 箱の見出しから、その箱の「詳しく」の手前まで（「詳しく」は箱のいちばん下）。 */
  const boxOf = cls => { const i = CMP.indexOf(`class="cr-sec ${cls}"`), j = i < 0 ? -1 : CMP.indexOf('<p class="cr-gos">', i); return j < 0 ? '' : CMP.slice(i, j); };
  const slots = t => [...t.matchAll(/<div class="crl" data-live="cmp-facts"([^>]*)>/g)].map(m => (m[1].match(/ data-keys="([^"]*)"/) || [])[1]);
  const footTab = k => (CMP.match(new RegExp(` id="cr-go-${k}-${FIVE[0]}" href="airlines/${FIVE[0]}\\.html#([a-z]+)"`)) || [])[1];
  const W = slots(boxOf('cr-cmp-work')), B = slots(boxOf('cr-cmp-ben'));
  const shared = CMP_KEYS.work.filter(k => CMP_KEYS.pay.includes(k));
  const tw = footTab('work'), tb = footTab('ben');
  const stray = [...CMP_KEYS.work.filter(k => tabOfKey(k) !== tw).map(k => `${k}→${tabOfKey(k)}（月の働き方の足は ${tw}）`),
                 ...CMP_KEYS.pay.filter(k => tabOfKey(k) !== tb).map(k => `${k}→${tabOfKey(k)}（待遇の足は ${tb}）`)];
  ok(!shared.length && W.length === 1 && W[0] === CMP_KEYS.work.join(',') && B.length === 1 && B[0] === CMP_KEYS.pay.join(',') && !!tw && !!tb && !stray.length,
     '比較の箱と「詳しく」の先が食い違わない：月の働き方の箱の質問は、その足の先のタブ（勤務・訓練）が家・待遇の箱の質問は 給与・待遇 が家（同じ質問を2つの箱に置かない）',
     JSON.stringify({ shared, W: W.length, B: B.length, workSame: W[0] === CMP_KEYS.work.join(','), benSame: B[0] === CMP_KEYS.pay.join(','), tw, tb, stray }));
}

/* ★2026-10-22 段階4 cmp-pay-4（T-S3a）：比較の「提出された年収」の生きた欄は、出荷の HTML では空 ── 「—」だけで、数字を1つも持たない
   （件数も額も、開いた人の鍵でサーバーが決める。生成側が数字を書けば、鍵の無い人にも届く）。置き場は data-kind="submitted" の箱で、
   見出しは会社ページと同じ「提出された年収」と小さな「REAL PAY」。（箱の並びは、上の「読む順」が見る）
   T-S5（ファイルの半分）：比較の住所の鍵（career.js の KEYS）に、給与の職位・機材・月の鍵を足さない ── 一字一句このまま。
   比較の給与の区画が組む REAL PAY への住所は air= と pos= だけ（REAL PAY の機材の絞り込みを戻さない）。 */
head('比較の提出された年収（出荷の形・住所）');
{
  const slots = [...CMP.matchAll(/<div class="crl" data-live="cmp-pay"[^>]*>[\s\S]*?<\/div>/g)].map(m => m[0]);
  const sec = CMP.match(/<div class="cr-sec cr-subpay" data-kind="submitted">\s*<h2 class="cr-h2">([\s\S]*?)<\/h2>\s*(<div class="crl" data-live="cmp-pay"[^>]*>[\s\S]*?<\/div>)\s*<\/div>/);
  const h2 = sec ? sec[1].replace(/<[^>]+>/g, '') : '';
  ok(HTML.split('data-live="cmp-pay"').length === 2 && slots.length === 1 && !!sec && h2 === '提出された年収REAL PAY',
     '比較の「提出された年収」の欄（data-live="cmp-pay"）は career.html にちょうど1つ・data-kind="submitted" の箱の中・見出しは「提出された年収」＋「REAL PAY」',
     `欄 ${HTML.split('data-live="cmp-pay"').length - 1}（比較の画面に ${slots.length}）・箱 ${!!sec}・見出し「${h2}」`);
  ok(slots.length === 1 && slots[0].replace(/<[^>]+>/g, '').trim() === '—' && !/\d/.test(slots[0]),
     '比較の「提出された年収」の欄は、出荷の HTML では「—」だけ（字にも属性にも数字が1つも無い）', slots[0] || '（欄が無い）');
  const KEYS_LINE = "var KEYS = ['airline', 'view', 'tab', 'stay', 'd', 'a', 'b'];";
  ok(JS.split(KEYS_LINE).length === 2, '比較の住所の鍵（career.js の KEYS）は、給与の職位・機材・月の鍵を持たない（一字一句このまま）',
     (JS.match(/var KEYS = [^\n]*/) || ['（KEYS が無い）'])[0]);
  const RAW = read('career-live.js');
  const at = RAW.indexOf('\n  var PAY_TOP'), end = at < 0 ? -1 : RAW.indexOf('\n  /* ──', at + 1);
  const BC = at < 0 || end < 0 ? '' : noJsCmt(RAW.slice(at, end));
  const qk = [...BC.matchAll(/'[^'\n]*'/g)].flatMap(m => [...m[0].matchAll(/[?&]([A-Za-z_]+)=/g)].map(x => x[1]));
  ok(BC.includes("'actual-pay.html?air='") && qk.includes('pos') && qk.every(k => k === 'air' || k === 'pos'),
     '比較の給与の区画が組む REAL PAY への住所は air= と pos= だけ（機材・月の絞り込みを付けない）', `住所の鍵: ${qk.join(',') || '（無い）'}`);
}

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
for (const f of ['gen-sitemap.mjs', 'seo-normalize.mjs', 'assert-seo.mjs']) ok(inSet(f, 'NOINDEX'), `${f} の NOINDEX に在る（名前で当たる ── 英語の ${PAGE_EN} も同じ）`);
/* ★2026-10-25 英語の EN-9 で向け直した（弱めていない）：前は「JA_ONLY の2つに在る・en/career.html は無い・hreflang="en" を出さない」。
   英語の1枚（en/career.html）を置いたので、いまは その反対が2つとも1か所も欠けずにそろっていること ── JA_ONLY の2つから外れている・
   COPY に英語の題名・英語も noindex・2枚が互いを hreflang で指し合う・英語の1枚も gen-career.mjs の出力と1文字も違わない（下の C3）。 */
for (const f of ['seo-normalize.mjs', 'assert-seo.mjs']) ok(!inSet(f, 'JA_ONLY'), `${f} の JA_ONLY から外れている（英語版 ${PAGE_EN} が在る）`);
ok(new RegExp(`'${PAGE.replace('.', () => '\\.')}'\\s*:\\s*\\{\\s*ja\\s*:[^}]*\\},\\s*en\\s*:\\s*\\{\\s*t\\s*:`).test(read('seo-normalize.mjs')), 'seo-normalize.mjs の COPY に題名が在る（日本語と英語）');
ok(/<meta name="robots" content="noindex,follow"\s*\/?>/.test(HTML), '検索に出さない（noindex）');
ok(!read('sitemap.xml').includes(PAGE), 'sitemap.xml に載っていない（日本語も英語も）');
const EN_HTML = fs.existsSync(path.join(ROOT, PAGE_EN)) ? read(PAGE_EN) : '';
ok(!!EN_HTML && /<meta name="robots" content="noindex,follow"\s*\/?>/.test(EN_HTML) && /<html lang="en"/.test(EN_HTML), `${PAGE_EN} が在り、英語（<html lang="en">）で、検索に出さない（noindex）`);
{
  const alt = (h, l) => (h.match(new RegExp(`<link rel="alternate" hreflang="${l}" href="([^"]*)"\\s*/?>`)) || [])[1];
  const want = { ja: 'https://pilot-value.com/career.html', en: 'https://pilot-value.com/en/career.html' };
  ok([HTML, EN_HTML].every(h => alt(h, 'ja') === want.ja && alt(h, 'en') === want.en),
     '日本語と英語の2枚が、互いを hreflang で指し合う（ja → career.html・en → en/career.html）', JSON.stringify([HTML, EN_HTML].map(h => [alt(h, 'ja'), alt(h, 'en')])));
}
ok(/var EN_PAGES = new Set\(\[[^\]]*"career\.html"/.test(read('lang-toggle.js')), '言葉の切り替え（lang-toggle.js の EN_PAGES ── gen-en-manifest.mjs が書く）に career.html が在る');
ok(read('assert-founding.mjs').includes(`'${PAGE}'`) && read('assert-founding.mjs').includes(`'${PAGE_EN}'`), 'assert-founding.mjs の除外リストに在る（日本語と英語）');
ok(read('assert-header.mjs').includes(`'/${PAGE}`) && read('assert-header.mjs').includes(`'/${PAGE_EN}`), 'assert-header.mjs が測っている（日本語と英語）');
ok(read('assert-generated.mjs').includes(`'gen-career.mjs'`), 'assert-generated.mjs が流し忘れを見ている');
ok(read('check.mjs').includes(`'assert-career.mjs'`), 'check.mjs の一式にこの検査が入っている');
/* メニューにはまだ載せない（オーナーが形を決めるまでの下見用）。 */
ok(!read('patch-side-nav.mjs').includes(PAGE), '左メニューにまだ載せていない');

/* ══════════════════════════════════════════════════════════════════
   C2) 保存するカードの住所と QR（★2026-10-22 段階4 cmp-links-card-3・T-C1）
   ══════════════════════════════════════════════════════════════════ */
head('保存するカードの住所と QR');
/* カードの材料（career.html の #crc-data）。住所は、いま改良している会社ページ（airlines/{slug}.html・タブも問い合わせも付けない）。
   QR の行列は、別の読み取り器で読めた行列の指紋（career-qr.mjs の FROZEN）と同じ ── 住所を変えると、どの QR も読み直しが要る。 */
let CARD_DATA = null;
try { CARD_DATA = JSON.parse((HTML.match(/<script type="application\/json" id="crc-data">([\s\S]*?)<\/script>/) || [])[1] || 'null'); } catch { CARD_DATA = null; }
const CARD_AIR = (CARD_DATA && CARD_DATA.airlines) || {};
{
  const CNAME = read('CNAME').trim(), bad = [];
  for (const s of FIVE) {
    const a = CARD_AIR[s], url = a ? a.url : undefined, want = `https://${CNAME}/airlines/${s}.html`;
    const fp = typeof url === 'string' ? frozenPrint(url) : null;
    const rows = a && Array.isArray(a.qr) ? a.qr : [];
    const mp = rows.length ? matrixPrint(rows.map(r => [...r].map(Number))) : null;
    if (url !== want || /[?#]/.test(String(url)) || !fs.existsSync(path.join(ROOT, 'airlines', `${s}.html`)) || fp === null || mp !== fp)
      bad.push(`${s}: 住所 ${url}（あるべき ${want}）・指紋 ${mp}（FROZEN ${fp}）`);
  }
  ok(!!CNAME && !!CARD_DATA && !bad.length, 'カードの住所は、いま改良している会社ページ（5社）。QR は、別の読み取り器で読めた行列と同じ', bad.join(' ／ ') || `CNAME ${CNAME}・材料 ${!!CARD_DATA}`);
}

/* ══════════════════════════════════════════════════════════════════
   C3) 英語の1枚（en/career.html ── ★2026-10-25 英語の EN-9）
   同じ1枚を英語で：gen-career.mjs の同じ部品・同じ並び・同じ数字で、字だけ英語（WORDS.en と台帳の英語）・額は HTML の時点でドルの span。
   見るのは 生成の出力と1文字も違わない／字の対（WORDS の鍵と形）／見える字に日本語が無い／額は日本語の1枚と同じ（焼き残しが無い）／
   骨組み（字を外したタグと属性）が日本語の1枚と同じ／カードの住所・QR・地域の名前は英語のページのもの／口コミの6分類は英語の名前。
   ══════════════════════════════════════════════════════════════════ */
head('英語の1枚（en/career.html）');
{
  ok(!!EN_HTML && render(EN_HTML, 'en') === EN_HTML, `${PAGE_EN} は gen-career.mjs の出力（render(…, 'en')）と1文字も違わない`, 'node gen-career.mjs を流す');
  const words = crCheckWords();
  ok(!words.length && !!CR_WORDS.en && Object.keys(CR_WORDS.en).length === Object.keys(CR_WORDS.ja).length,
     'この1枚の字の表（gen-career.mjs の WORDS）は、日本語と英語で鍵も形も同じ・英語に日本語の字が無い', words.slice(0, 4).join(' ／ '));
  const blk = h => { const a = h.indexOf('<!--PV-CAREER-->'), b = h.indexOf('<!--/PV-CAREER-->'); return a < 0 || b < a ? '' : h.slice(a, b); };
  const JB = blk(HTML), EB = blk(EN_HTML), EU = unbake(EB);
  const un = t => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const noScript = t => t.replace(/<script\b[\s\S]*?<\/script>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  /* 見える字と、読み上げ・乗せたときに出る字（alt・title・aria-label・placeholder・data-label）。写真の作者名（台帳の字）と “…” の中（原文の題）は除く */
  const JA_RE = /[　-ヿ㐀-鿿＀-￯]/;
  const AUTH = [...new Set([...Object.values(PHOTOS).flat(), ...Object.values(PLACE.PHOTOS).flat()].map(p => p.author).filter(a => a && JA_RE.test(a)))];
  const clean = t => { let s = un(t).replace(/“[^”]*”/g, ' '); for (const a of AUTH) s = s.split(a).join(' '); return s; };
  const shown = [...noScript(EB).replace(/<[^>]*>/g, '\n').split('\n'), ...[...noScript(EB).matchAll(/\s(?:alt|title|aria-label|placeholder|data-label)="([^"]*)"/g)].map(m => m[1])];
  const jaLeft = [...new Set(shown.map(clean).map(s => s.trim()).filter(s => s && JA_RE.test(s)))];
  ok(!!EB && !jaLeft.length, `${PAGE_EN} の見える字と alt・title・aria-label・placeholder に日本語の字が無い（写真の作者名・“…” の中の原文の題を除く）`, jaLeft.slice(0, 6).join(' ／ '));
  /* 額：英語の1枚の額は、焼いた span を戻すと日本語の1枚と同じ並びの同じ字（比較の行・概要の大きい額・目盛）。どれも SALARY の推定 */
  const vals = (t, re) => [...t.matchAll(re)].map(m => m[1]);
  const ROW_V = /<b class="cr-row-v">([^<]*)<\/b>/g, MAIN_V = /data-main="(?:cap|fo)">([^<]*)<\/b>/g, AX = /<div class="cr-axis"[^>]*><span>0<\/span><span>([^<]*)<\/span><span>([^<]*)<\/span>/g;
  const jr = vals(JB, ROW_V), er = vals(EU, ROW_V), jm = vals(JB, MAIN_V), em = vals(EU, MAIN_V);
  const axes = t => [...t.matchAll(AX)].map(m => m[1] + '|' + m[2]);
  /* 職位の板（.cr-pair）ごとに切って、その中の行を読む（行は板の中にだけ在る ── 次の板の頭まで） */
  const rowsOf = t => t.split('<div class="cr-pair" data-role="').slice(1).flatMap(seg => { const r = seg.slice(0, seg.indexOf('"'));
    return [...seg.matchAll(/<div class="cr-row" data-airline="([^"]+)"[\s\S]*?<b class="cr-row-v">([^<]*)<\/b>/g)].map(x => [r, x[1], x[2]]); });
  const badRow = rowsOf(EU).filter(([r, s, v]) => v !== yen(SALARY[s][r].avg));
  ok(jr.length === 2 * ALLK.length && same(jr, er) && jm.length > 0 && same(jm, em) && same(axes(JB), axes(EU)) && !badRow.length && rowsOf(EU).length === 2 * ALLK.length,
     `${PAGE_EN} の額（比較の行 ${er.length}・概要の大きい額 ${em.length}・目盛）は、ドルの span を戻すと日本語の1枚と同じ字 ── どれも SALARY の推定`,
     JSON.stringify({ rows: [jr.length, er.length], main: [jm, em], bad: badRow.slice(0, 4) }));
  /* 焼き残しが無い：焼いた span を戻してから焼き直すと、1文字も違わない（＝ どの円の額も HTML の時点でドルの span ── bake-en-currency.mjs を流しても変わらない） */
  const C_EN = await curCore('USD', 'en');
  ok(!!EB && bakeHtml(EU, C_EN) === EB && (EB.match(/<span class="pv-cur" data-jpy="\d+" data-orig="¥[\d,]+万">/g) || []).length >= er.length,
     `${PAGE_EN} の円の額は、どれも HTML の時点でドルの span（焼き残しが無い・data-orig は「¥…万」の形）`);
  /* 骨組み：字を外し、言葉で違ってよい属性（alt・title・aria-label・placeholder・data-label）と道の頭の ../ を外すと、日本語の1枚と同じ */
  const bones = t => noScript(t).replace(/>[^<]*</g, '><').replace(/\s(?:alt|title|aria-label|placeholder|data-label)="[^"]*"/g, '')
    .replace(/(\s(?:src|srcset|href)=")((?:[^"]*?))"/g, (m, a, v) => a + v.replace(/(^|, )\.\.\//g, (x, p) => p) + '"');
  const jb = bones(JB), eb = bones(EU);
  let at = 0; while (at < jb.length && jb[at] === eb[at]) at++;
  ok(!!JB && jb === eb, `${PAGE_EN} の骨組み（字を外したタグと属性）は日本語の1枚と同じ ── 同じ部品・同じ画面・同じ会社・同じ並び`, jb === eb ? '' : `最初の違い：日本語「${jb.slice(at - 60, at + 80)}」／英語「${eb.slice(at - 60, at + 80)}」`);
  /* カードの材料：住所と QR は英語の会社ページ（en/airlines/{slug}.html ── 在るファイル）・地域の名前は英語・写真は en/ から見た道 */
  let ED = null;
  try { ED = JSON.parse((EN_HTML.match(/<script type="application\/json" id="crc-data">([\s\S]*?)<\/script>/) || [])[1] || 'null'); } catch { ED = null; }
  const EA = (ED && ED.airlines) || {}, CNAME = read('CNAME').trim(), RN = Object.fromEntries(DIR_REGIONS.map(R => [R.ja, R.en]));
  const cBad = [];
  for (const s of ALLK) {
    const a = EA[s], j = CARD_AIR[s], want = `https://${CNAME}/en/airlines/${s}.html`;
    if (!a || !j) { cBad.push(`${s}: 材料が無い`); continue; }
    if (a.url !== want || !fs.existsSync(path.join(ROOT, 'en', 'airlines', `${s}.html`))) cBad.push(`${s}: 住所 ${a.url}`);
    if (!same(a.qr, qrMatrix(want).map(r => r.join('')))) cBad.push(`${s}: QR が住所の行列でない`);
    if (a.g !== RN[j.g]) cBad.push(`${s}: 地域「${a.g}」（日本語「${j.g}」の英語であること）`);
    if (a.ja !== j.ja || a.en !== j.en || a.code !== j.code || a.color !== j.color) cBad.push(`${s}: 社名・略号・色が日本語の材料と違う`);
    if (!same((a.photos || []).map(p => p.src), (j.photos || []).map(p => `../${p.src}`)) || (a.photos || []).some(p => !fs.existsSync(path.join(ROOT, 'en', p.src)))) cBad.push(`${s}: 写真の道`);
  }
  ok(!!ED && !cBad.length && Object.keys(EA).join() === Object.keys(CARD_AIR).join(),
     `${PAGE_EN} のカードの材料：住所と QR は英語の会社ページ（en/airlines/{slug}.html）・地域の名前は英語・社名と色は日本語の材料と同じ・写真は en/ から見た道（${ALLK.length}社）`, cBad.slice(0, 6).join(' ／ '));
  /* 口コミの6分類の名前（比較の6角形）：英語の会社ページの口コミの欄と同じ英語（airlines/airline-reviews-data.js の CAT_FULL_EN） */
  const catsEn = (read('airlines/airline-reviews-data.js').match(/const CAT_FULL_EN\s*=\s*(\[[^\]]*\]);/) || [])[1];
  const got = (EN_HTML.match(/<script type="application\/json" id="crl-cats">([\s\S]*?)<\/script>/) || [])[1];
  ok(!!catsEn && !!got && same(JSON.parse(got), JSON.parse(catsEn.replace(/'/g, '"'))), `${PAGE_EN} の口コミの6分類の名前は CAT_FULL_EN`, `${got} ／ ${catsEn}`);
}
/* T-C4：カードの評価の1行の字は、会社ページ・比較の「n件の評価」と同じ字（2つのファイルに1つずつ）。星は形で描く（字にしない）。
   カードは実データの欄（.crl）を読まない ── 欄を避ける inLive の1か所のほかに、.crl の選び方も 'crl-' を探す口も持たない（評価は PVCareer.rating から来る）。 */
{
  const CC = read('career-card.js'), LIVE = read('career-live.js');
  const cardW = (CC.match(/\n {4}[^\n]*\brated: '([^']*)'\n {2}\};/) || [])[1];
  const liveW = (LIVE.match(/\n {4}revRated: function \(n\) \{ return n \+ '([^']*)'; \},\n/) || [])[1];
  ok(cardW === '件の評価' && liveW === cardW, 'カードの評価件数の字は、会社ページ・比較と同じ「件の評価」（career-card.js の WORD.rated ＝ career-live.js の revRated）',
     JSON.stringify({ card: cardW, live: liveW }));
  /* ★2026-10-25 英語の EN-9：英語のカード（WORD_EN）も、英語の比較・会社ページ（career-live.js の英語の revRated）と同じ字 ── 1件は単数 */
  const cardEn = (CC.match(/\n {2}var WORD_EN = \{[\s\S]*?\n {4}rated1: '([^']*)'[\s\S]*?\brated: '([^']*)'\n {2}\};/) || []).slice(1);
  const liveEn = (LIVE.match(/\n {4}revRated: function \(n\) \{ return n \+ \(n === 1 \? '([^']*)' : '([^']*)'\); \},\n/) || []).slice(1);
  ok(cardEn.length === 2 && same(cardEn, liveEn) && /\bif \(LANG === 'en'\) WORD = WORD_EN;/.test(CC),
     '英語のカードの評価件数の字は、英語の比較・会社ページと同じ（1件は「 rating」・ほかは「 ratings」）── ページが英語なら WORD_EN に替わる', JSON.stringify({ card: cardEn, live: liveEn }));
  /* カードの字の2つの表（WORD・WORD_EN）は鍵が同じ・英語の字に日本語の字が無い・空でない（片方だけ直すと、英語のカードに鍵の名前や undefined が描かれる） */
  const kv = name => { const b = (CC.match(new RegExp(`\\n {2}var ${name} = \\{([\\s\\S]*?)\\n {2}\\};`)) || [])[1] || ''; return Object.fromEntries([...b.matchAll(/(\w+):\s*'([^']*)'/g)].map(m => [m[1], m[2]])); };
  const wj = kv('WORD'), we = kv('WORD_EN'), kj = Object.keys(wj).sort(), ke = Object.keys(we).sort();
  const jaInEn = ke.filter(k => /[　-ヿ㐀-鿿＀-￯]/.test(we[k]) || !we[k].trim());
  ok(kj.length > 20 && same(kj, ke) && !jaInEn.length, 'カードの字の表は、日本語（WORD）と英語（WORD_EN）で鍵が同じ・英語の字に日本語の字が無く空でない',
     JSON.stringify({ onlyJa: kj.filter(k => !ke.includes(k)), onlyEn: ke.filter(k => !kj.includes(k)), jaInEn }));
  /* コメントの見出しの ★ は字ではなく書き手の印（描かれない）── コメントを外して見る */
  ok(!/[★☆⭐✩✪✭✮✯]/u.test(noJsCmt(CC)), 'カードの JS は星の字を持たない（星は形で描く）', (noJsCmt(CC).match(/.{0,30}[★☆⭐✩✪✭✮✯].{0,30}/u) || [''])[0]);
  const CODE = noJsCmt(CC).split('\n').filter(l => !/^\s+function inLive\(el\) \{/.test(l)).join('\n');
  ok(/\n {2}function inLive\(el\) \{ return !!\(el && el\.closest && el\.closest\('\.crl, \.crs-zone'\)\); \}\n/.test(CC) && !/\.crl\b|crl-/.test(CODE),
     'カードの JS は実データの欄（.crl）を選ばない ── inLive のほかに .crl の選び方も crl- を探す口も無い', (CODE.match(/.{0,30}(?:\.crl\b|crl-).{0,30}/) || [''])[0]);
}

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
  /* ライセンスは、使う条件を確かめてある種類だけ（名前とリンクが対）。
     知らないライセンスや書き間違いは「示す条件あり」に倒れるが、商用不可・改変不可はそもそも使えない。
     ★2026-10-25 段階5 compare-all-14（先行5社のほかの102社の写真・同じ強さの当て直し）：3種 → 6種。CC BY 2.0・CC BY-SA 4.0 と
     Public domain（作者が権利を放棄した写真。出どころの印が2つ ── どちらかのリンクとだけ対）を足した。どれも商用と改変ができる。 */
  const LICENCES = {
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0',
    'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0',
    'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0',
    'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0',
  };
  const PD = ['https://creativecommons.org/publicdomain/mark/1.0/', 'https://commons.wikimedia.org/wiki/Template:PD-self'];
  const odd = LEDGER.filter(p => !(p.licence === 'Public domain' ? PD.includes(p.licence_url) : Object.hasOwn(LICENCES, p.licence) && LICENCES[p.licence] === p.licence_url));
  ok(!odd.length, '台帳のライセンスは条件を確かめてある6種だけ（名前とリンクが対）', odd.map(p => `${p.file}: ${p.licence}`).join(', '));
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

  /* ★2026-10-25 段階5 compare-all-4（CA-3b1・同じ強さの当て直し）：会社を選ぶ面と写真の無い会社の札にはロゴの絵が在る。ロゴの札
     （.pvg-logo）を先に切り取ってから、残りの絵を全部台帳と突き合わせる（ロゴは下の「ロゴ」の検査が持つ）。 */
  const imgs = [...BLOCK.replace(/<span class="pvg-logo[^"]*" aria-hidden="true">[\s\S]*?<\/span>/g, () => '').matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
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

/* T-C5（★2026-10-26 段階5 compare-all-14・P12.122）：比較の札は、先行5社のほかの会社でも台帳の1枚目の写真を出す（career.js がカードの島から
   置く）。写真を出すなら、示すことが条件の写真のクレジットが同じページに在ること（CC BY / BY-SA の使う条件 ── 外す道は無い）。日英の2枚で：
     a) 比較の段のクレジット（.cr-credits ── 1つ）に、台帳に写真の在る会社のうち示すことが条件の写真の会社がちょうど1つずつ。社名（正本の字）・
        作者（出所へのリンク）・ライセンス（その名前の頁へのリンク）の順で、どちらも別の窓で開く。条件の無い写真（CC0）の会社は置かない。
        見えているのは並べた2社（PAIR）のぶんだけ。
     b) 頭の字は2つ（data-n="1" と "2" ── 英語は Photo / Photos・日本語は同じ字）で、見えているのは並べた2社のクレジットの数のほう。
     c) カードの島の1枚目の写真に説明（alt）が在り、字は先行5社の写真の札と同じ形（「会社名の 機種」／ "Name Aircraft"）。2枚目からは持たない。 */
{
  const bad = [];
  const un = t => t.replace(/&quot;/g, () => '"').replace(/&lt;/g, () => '<').replace(/&gt;/g, () => '>').replace(/&amp;/g, () => '&');
  const want = ALLK.filter(s => primary(s) && needsCredit(primary(s)));
  for (const [lang, h] of [['ja', HTML], ['en', EN_HTML]]) {
    const nm = s => SALARY[s][lang];
    const sec = h.split('data-view="compare"')[1]?.split('data-view="card"')[0] || '';
    const ps = [...sec.matchAll(/<p class="cr-credits">([\s\S]*?)<\/p>/g)].map(m => m[1]);
    if (ps.length !== 1) { bad.push(`${lang}: 比較のクレジットの段 ${ps.length}つ`); continue; }
    const spans = [...ps[0].matchAll(/<span class="cr-credit" data-airline="([^"]+)"( hidden)?>([\s\S]*?)<\/span>/g)].map(m => ({ s: m[1], hidden: !!m[2], body: m[3] }));
    const got = spans.map(x => x.s);
    if (!same([...got].sort(), [...want].sort()) || new Set(got).size !== got.length)
      bad.push(`${lang}: クレジットの会社 ${got.length}（条件のある写真の会社 ${want.length}）── 欠け ${want.filter(s => !got.includes(s)).join(', ') || 'なし'}・余り ${got.filter(s => !want.includes(s)).join(', ') || 'なし'}`);
    for (const x of spans) {
      const p = primary(x.s);
      if (!p) continue;
      const links = [...x.body.matchAll(/<a href="([^"]*)" target="_blank" rel="noopener">([^<]*)<\/a>/g)].map(m => [un(m[1]), un(m[2])]);
      const label = un(x.body.split('<a ')[0]).trim();
      if (label !== nm(x.s)) bad.push(`${lang} ${x.s}: 社名「${label}」`);
      if (!same(links, [[p.source, p.author], [p.licence_url, p.licence]]) || (x.body.match(/<a /g) || []).length !== 2) bad.push(`${lang} ${x.s}: 作者とライセンスのリンク ${JSON.stringify(links)}`);
      if (x.hidden === PAIR.includes(x.s)) bad.push(`${lang} ${x.s}: ${x.hidden ? '並べた2社なのに隠れている' : '並べていないのに見えている'}`);
    }
    const heads = [...ps[0].matchAll(/<span data-n="([12])"( hidden)?>([^<]*)<\/span>/g)].map(m => ({ n: Number(m[1]), hidden: !!m[2], t: m[3] }));
    const k = PAIR.filter(s => want.includes(s)).length;
    const words = heads.length === 2 && heads[0].n === 1 && heads[1].n === 2
      && (lang === 'ja' ? heads[0].t === heads[1].t && heads[0].t.startsWith('写真')
        : /^Photo(?: |$)/.test(heads[0].t) && heads[1].t === `Photos${heads[0].t.slice(5)}`);
    if (!words || heads.filter(x => !x.hidden).length !== 1 || heads.find(x => !x.hidden).n !== (k === 1 ? 1 : 2)) bad.push(`${lang}: 頭の字 ${JSON.stringify(heads)}（並べた2社のクレジット ${k}）`);
    let isle = null;
    try { isle = JSON.parse((h.match(/<script type="application\/json" id="crc-data">([\s\S]*?)<\/script>/) || [])[1] || 'null').airlines; } catch { isle = null; }
    if (!isle) { bad.push(`${lang}: カードの島が読めない`); continue; }
    for (const s of ALLK) {
      const ph = (isle[s] || {}).photos || [], p = primary(s);
      if (!p) { if (ph.length) bad.push(`${lang} ${s}: 台帳に無い写真が島に在る`); continue; }
      const alt = lang === 'ja' ? `${nm(s)}の ${p.aircraft}` : `${nm(s)} ${p.aircraft}`;
      if (!ph[0] || ph[0].alt !== alt) bad.push(`${lang} ${s}: 島の1枚目の説明「${ph[0] ? ph[0].alt : '（写真が無い）'}」`);
      if (ph.slice(1).some(x => 'alt' in x)) bad.push(`${lang} ${s}: 2枚目からも説明を持つ`);
    }
  }
  ok(want.length > FIVE.length && !bad.length,
     `比較の札に写真を出す会社の、示すことが条件の写真のクレジット（${want.length}社）が日英の比較の段に1つずつ（社名・作者と出所・ライセンスのリンク）・見えているのは並べた2社だけ・頭の字は見えているクレジットの数・カードの島の1枚目に写真の説明`,
     bad.slice(0, 8).join('\n      '));
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

/* ══════════════════════════════════════════════════════════════════
   E0) 掲載している全社（★2026-10-24 段階5 compare-all-1・CA-1 / CA-1t）
   比較は、年収の正本（SALARY）の全社ぶんの 年収の行・「詳しく」・税の行・家賃の箱 を持ち、選んだ2社だけ見せる（ほかは hidden）。
   どれも生成側の書き出し（ALL・目盛・rentable）を読まずに、台帳とページのファイルから作り直して突き合わせる。
   ══════════════════════════════════════════════════════════════════ */
head('掲載している全社（比較の材料）');
{
  /* 開きタグの位置から、同じ名前の閉じタグまで（入れ子を数える）。 */
  const elementAt = (html, i) => {
    const tag = (html.slice(i, i + 20).match(/^<([a-z][a-z0-9]*)/) || [])[1];
    if (!tag) return '';
    const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    re.lastIndex = i;
    let depth = 0, m;
    while ((m = re.exec(html))) {
      depth += m[0][1] === '/' ? -1 : 1;
      if (!depth) return html.slice(i, m.index + m[0].length);
    }
    return '';
  };
  const decode = t => t.replace(/&quot;/g, () => '"').replace(/&lt;/g, () => '<').replace(/&gt;/g, () => '>').replace(/&amp;/g, () => '&');
  const strip = t => decode(t.replace(/<[^>]+>/g, () => '')).replace(/\s+/g, () => ' ').trim();
  const PAIRS = Object.fromEntries([...CMP.matchAll(/<div class="cr-pair" data-role="([a-z]+)">/g)].map(m => [m[1], elementAt(CMP, m.index)]));
  const rowsOf = r => [...(PAIRS[r] || '').matchAll(/<div class="cr-row" data-airline="([^"]+)"/g)].map(m => ({ s: m[1], html: elementAt(PAIRS[r], m.index) }));
  const ROWS = Object.fromEntries(ROLES.map(([r]) => [r, rowsOf(r)]));
  const GOSB = [...CMP.matchAll(/<p class="cr-gos">/g)].map(m => elementAt(CMP, m.index));
  const goCo = g => [...g.matchAll(/<a class="cr-link cr-go"[^>]*?\sdata-airline="([^"]+)"/g)].map(m => m[1]);
  const sorted = a => [...a].sort();

  /* 2社を選ぶ面（#cr-sheet-l）の中身（★2026-10-25 段階5 compare-all-4・CA-3b1）── 地域の見出しの行と、会社の行だけ（ほかの形の行が在れば、
     下の T-A12a が数の食い違いで落とす）。
     ★2026-10-25 段階5 compare-all-5（CA-3b2・同じ強さの当て直し）：会社の行は検索の鍵（data-c ＝ 略号・data-k ＝ 呼び名）を必ず持つ形だけを読む
     （鍵の無い行は読めない ＝ 上の T-A1 と下の T-A12a が数で落とす）。鍵の中身は下の T-A12b が航空会社一覧と突き合わせる。 */
  const SHEET_L = elementAt(BLOCK, BLOCK.indexOf('<ul class="cr-sheet-l" id="cr-sheet-l">'));
  const SHEET = [...SHEET_L.matchAll(/<li class="cr-pk-gl" role="presentation" data-region="([a-z]+)"><h3 class="cr-pk-g">([^<]*)<\/h3><\/li>|<li><button type="button" class="cr-pk" data-airline="([^"]+)" data-c="([^"]*)" data-k="([^"]*)" style="--cr-co:([^"]*)">([\s\S]*?)<\/button><\/li>/g)]
    .map(m => (m[1] ? { g: m[1], h: decode(m[2]) } : { s: m[3], c: decode(m[4]), k: decode(m[5]), co: m[6], html: m[7] }));
  const PK = SHEET.filter(x => x.s);

  /* T-A1 1つの集合：年収の行（機長・副操縦士）と、4つの「詳しく」の列は、どれも正本と同じ会社（並びも正本の順）。
     ★2026-10-24 段階5 compare-all-2（CA-2）：カードの島（#crc-data）の会社も同じ集合（先行5社が先）。
     ★2026-10-25 段階5 compare-all-4（CA-3b1）：2社を選ぶ面の会社も同じ集合（並びは航空会社一覧の並び ── 下の T-A12a）。 */
  const ISLK = Object.keys(CARD_AIR);
  const sets = [...ROLES.map(([r]) => ROWS[r].map(x => x.s)), ...GOSB.map(goCo), ISLK, PK.map(x => x.s)];
  ok(GOSB.length === GOS.length && sets.length === ROLES.length + GOS.length + 2 && sets.every(x => same(sorted(x), sorted(ALLK)))
     && ROLES.every(([r]) => same(ROWS[r].map(x => x.s), ALLK)) && same(ISLK.slice(0, FIVE.length), FIVE),
     `比較が持つ会社は、年収の正本と同じ ${ALLK.length}社（数は打っていない）`,
     JSON.stringify({ gos: GOSB.length, sizes: sets.map(x => x.length), lack: sets.map(x => ALLK.filter(s => !x.includes(s)).slice(0, 4)), extra: sets.map(x => x.filter(s => !ALLK.includes(s)).slice(0, 4)), isleHead: ISLK.slice(0, FIVE.length) }));

  /* T-A2 全社の行：どの行も推定年収（SALARY の avg ＝ 会社ページと同じ読み口の推定）。
     ★2026-10-24 オーナー P12.104（同じ強さの当て直し ── リード L2）：2026-10-24 までは「目盛はこの1枚に1本（掲載している全社が入る
     1,000万 の倍数 ── ¥7,000万）」を見ていた。いまは目盛に決まった上限が無く、画面ごと（下の「棒の目盛（画面ごと）」）。
     行は、その会社の目盛の右端（data-scale）と額（data-man）を持ち、棒の長さは、既定の2社（PAIR）の行は2社をあわせた目盛・ほかの行は
     その会社の目盛に対する割合（選ばれたら career.js が並べた2社の目盛で描き直す ── ブラウザの段で見る）。 */
  {
    const bad = [];
    for (const [r, label] of ROLES) for (const s of ALLK) {
      const list = ROWS[r].filter(x => x.s === s), avg = SALARY[s][r].avg, port = viewOf(s).pay[r]?.est?.man;
      if (list.length !== 1) { bad.push(`${s}/${r}: 行が${list.length}本`); continue; }
      const h = list[0].html;
      const v = (h.match(/<b class="cr-row-v">([^<]*)<\/b>/) || [])[1];
      const co = (h.match(/<span class="cr-row-co">([\s\S]*?)<\/span>/) || [])[1];
      const nm = co != null ? (co.match(/^<i class="cr-dot" aria-hidden="true"><\/i>([^<]*)$/) || [])[1] : undefined;
      const vh = [...h.matchAll(/<span class="cr-vh">([^<]*)<\/span>/g)].map(m => m[1]);
      const tag = [...h.matchAll(/<span class="cr-tag">([^<]*)<\/span>/g)].map(m => decode(m[1]));
      const w = parseFloat((h.match(/<i class="cr-fill"[^>]*style="--w:([\d.]+)%"/) || [])[1]);
      const man = +((h.match(/<i class="cr-fill"[^>]*\sdata-man="(\d+)"/) || [])[1]), sc = +((h.match(/^<div class="cr-row"[^>]*\sdata-scale="(\d+)"/) || [])[1]);
      const top = PAIR.includes(s) ? SCALE(...PAIR) : SCALE(s);
      const why = [
        avg !== port && `正本 ${avg} ≠ 読み口 ${port}`,
        v !== yen(avg) && `額「${v}」≠ ${yen(avg)}`,
        (nm === undefined || decode(nm) !== SALARY[s].ja) && `社名「${co}」`,
        !same(vh, [label]) && `職位の字 ${JSON.stringify(vh)}`,
        !same(tag, [TIERS.estimate.ja]) && `札 ${JSON.stringify(tag)}`,
        /確認中|〜|超|上限/.test(strip(h)) && `「${strip(h)}」`,
        man !== avg && `棒の額 ${man}`,
        !(sc === SCALE(s) && fits(sc, s)) && `目盛の右端 ${sc}（あるべき ${SCALE(s)}）`,
        !(Math.abs(w - (avg / top) * 100) < 0.01) && `棒 ${w}%（目盛 ${top}）`,
      ].filter(Boolean);
      if (why.length) bad.push(`${s}/${r}: ${why.join('・')}`);
    }
    ok(!bad.length,
       '比較の年収の行は、全社とも 推定年収（SALARY の avg）・行はその会社の目盛の右端と額を持ち、棒はその目盛（既定の2社は2社をあわせた目盛）で描いてある',
       `${bad.slice(0, 4).join(' ／ ')}${bad.length > 4 ? ` ほか${bad.length - 4}` : ''}`);

    /* 棒の目盛（画面ごと・決まった上限なし ── ★2026-10-24 オーナー P12.104）：
       a) 1社の画面（概要・詳細・エティハドのタブ）は、囲みの刻みの数（--cr-div）と、中の目盛の字が、その会社の右端。
       b) 比較：囲みの刻みの数と、見えている目盛の1本が、既定の2社をあわせた右端。目盛の字は、ありうる右端（掲載している全社の右端）ごとに
          1本ずつ・小さい順・刻みの数（data-div）つきで、見えているのは既定の2社の1本だけ（選び直したら career.js が見せる1本を替える）。
       c) この1枚に、全部の画面で1本の目盛（.cr の刻みの数）が無い。
       右端はどれも「額のどれもが右端以下・いちばん大きい額との差は 1,000万 未満」（ユナイテッドは機長の幅の上 ¥8,530万 → ¥9,000万）。 */
    const sbad = [];
    const axesIn = h => [...h.matchAll(/<div class="cr-axis"([^>]*)>([\s\S]*?)<\/div>/g)].map(m => ({
      scale: +((m[1].match(/\sdata-scale="(\d+)"/) || [])[1] || 0), div: +((m[1].match(/\sdata-div="(\d+)"/) || [])[1] || 0), hidden: /\shidden(?=[\s>]|$)/.test(m[1]),
      labels: [...m[2].matchAll(/<span>([^<]*)<\/span>/g)].map(x => x[1]) }));
    const labelsOf = top => ['0', yen(top / 2), yen(top)];
    const one = [...BLOCK.matchAll(/<section class="cr-view (?:cr-co|cr-det)[^"]*" data-view="(?:airline|detail)" data-airline="([^"]+)"[^>]*>/g)];
    for (const m of one) {
      const s = m[1], sec = elementAt(BLOCK, m.index), n = +((m[0].match(/style="[^"]*--cr-div:(\d+)"/) || [])[1] || 0), top = n * 1000, ax = axesIn(sec);
      if (!(top === SCALE(s) && fits(top, s))) sbad.push(`${s}: 刻み ${n}（あるべき ${SCALE(s) / 1000}）`);
      if (!ax.length || !ax.every(a => same(a.labels, labelsOf(SCALE(s))) && !a.scale && !a.hidden)) sbad.push(`${s}: 目盛 ${JSON.stringify(ax.map(a => a.labels))}`);
    }
    if (one.length !== FIVE.length + DEEP.length * ROLES.length) sbad.push(`1社の画面 ${one.length}`);
    const cmpTop = +(((CMP.match(/^<section class="cr-view cr-cmp"[^>]*style="[^"]*--cr-div:(\d+)"/) || [])[1]) || 0) * 1000;
    if (!(cmpTop === SCALE(...PAIR) && fits(cmpTop, ...PAIR))) sbad.push(`比較の刻み ${cmpTop / 1000}（あるべき ${SCALE(...PAIR) / 1000}）`);
    const cax = axesIn(elementAt(CMP, CMP.indexOf('<div class="cr-panel"'))), WANT = [...new Set(ALLK.map(s => SCALE(s)))].sort((a, b) => a - b);
    if (!same(cax.map(a => a.scale), WANT)) sbad.push(`比較の目盛の右端 ${cax.map(a => a.scale).join(',')}（あるべき ${WANT.join(',')}）`);
    const off = cax.filter(a => !same(a.labels, labelsOf(a.scale)) || a.div * 1000 !== a.scale);
    if (off.length) sbad.push(`比較の目盛の字 ${JSON.stringify(off)}`);
    /* ★2026-10-25 オーナー P12.110（WP-compare-all-11）：比較の目盛の1本ごとに、すぐ後ろに右の列の写し（.cr-axis2）がちょうど1つ・字も同じ
       （スマホの2列の板で、右の列の棒の下に出る）。写しはほかの場所に無い。 */
    {
      const ph = elementAt(CMP, CMP.indexOf('<div class="cr-panel"')), lab = h => [...h.matchAll(/<span>([^<]*)<\/span>/g)].map(x => x[1]);
      const twin = [...ph.matchAll(/<div class="cr-axis"[^>]*>([\s\S]*?)<\/div>\n<div class="cr-axis2" aria-hidden="true">([\s\S]*?)<\/div>/g)];
      const nCopy = (BLOCK.match(/class="cr-axis2"/g) || []).length;
      if (!(twin.length === cax.length && nCopy === cax.length && twin.every(m => same(lab(m[1]), lab(m[2])))))
        sbad.push(`右の列の目盛の写し ${twin.length}（全体で ${nCopy}・目盛 ${cax.length}本）${twin.filter(m => !same(lab(m[1]), lab(m[2]))).map(m => ` ／ 目盛 ${lab(m[1]).join('・')} ≠ 写し ${lab(m[2]).join('・')}`).join('')}`);
    }
    const shown = cax.filter(a => !a.hidden);
    if (!(shown.length === 1 && shown[0].scale === SCALE(...PAIR))) sbad.push(`比較で見えている目盛 ${shown.map(a => a.scale).join(',') || 'なし'}`);
    if (/<div class="cr" id="cr"[^>]*--cr-div/.test(BLOCK)) sbad.push('全部の画面で1本の刻み（.cr の --cr-div）が在る');
    ok(!sbad.length,
       `棒の目盛は画面ごと（決まった上限なし）── 1社の画面はその会社の右端・比較は既定の2社（${PAIR.map(name).join('・')}）をあわせた右端 ${yen(SCALE(...PAIR))}・比較の目盛の字は右端ごとに1本（${WANT.map(yen).join('・')}）`,
       sbad.slice(0, 6).join(' ／ '));
    /* ★2026-10-25 オーナー P12.106（WP-compare-all-10・同じ強さの当て直し ── リード L2）：前は年収の板の「税の行」の箱（.cr-taxes の
       p.cr-tax）を見ていた。いまは足が会社ごとに1行（社名・税の扱い・「詳しく」）── 年収の板の「詳しく」の列（板の中の .cr-gos）の、
       会社ごとの入れ物（.cr-ft）に、その会社の「詳しく」が1本と、税の扱いの字（.cr-tx ── 頭に社名を読み上げにだけ置く）が0か1つ。
       税の扱いの字を持つ会社は、読み口が税の扱いを持つ会社と同じ集合・字は会社ページと同じ（viewOf().pay.tax）。 */
    const payFoot = elementAt(CMP, CMP.indexOf('<p class="cr-gos">', CMP.indexOf('<div class="cr-panel"')));
    const fts = [...payFoot.matchAll(/<span class="cr-go cr-ft" data-airline="([^"]+)"/g)].map(m => ({ s: m[1], html: elementAt(payFoot, m.index) }));
    const taxes = [], ftBad = [];
    for (const f of fts) {
      const links = [...f.html.matchAll(/<a class="cr-link cr-go" id="cr-go-([a-z]+)-([^"]+)"/g)].map(m => `${m[1]}-${m[2]}`);
      const tx = [...f.html.matchAll(/<span class="cr-tx"><span class="cr-vh">([^<]*)<\/span>([^<]*)<\/span>/g)].map(m => ({ nm: decode(m[1]), t: decode(m[2]) }));
      if (!same(links, [`pay-${f.s}`])) ftBad.push(`${f.s}: 「詳しく」${JSON.stringify(links)}`);
      if (tx.length > 1 || (f.html.match(/class="cr-tx"/g) || []).length !== tx.length) ftBad.push(`${f.s}: 税の字 ${tx.length}`);
      if (tx.length === 1) { taxes.push({ s: f.s, t: tx[0].t }); if (tx[0].nm !== SALARY[f.s].ja) ftBad.push(`${f.s}: 税の字の頭の社名「${tx[0].nm}」`); }
    }
    const taxBad = taxes.filter(x => x.t !== viewOf(x.s).pay.tax).map(x => `${x.s}「${x.t}」`);
    ok(same(fts.map(x => x.s), ALLK) && !ftBad.length && same(taxes.map(x => x.s), TAXED) && !taxBad.length,
       `比較の年収の板の足は会社ごとに1行（社名・税の扱い・「詳しく」）── 税の扱いの字は、読み口が税の扱いを持つ会社（${TAXED.length}社）に1つずつ・字は会社ページと同じ（viewOf().pay.tax）`,
       `${fts.length}行 ／ ${ftBad.slice(0, 4).join(' ')} ／ 税 ${taxes.length} ／ 無い: ${TAXED.filter(s => !taxes.some(x => x.s === s)).join(',')} ／ 余り: ${taxes.filter(x => !TAXED.includes(x.s)).map(x => x.s).join(',')} ／ ${taxBad.join(' ')}`);
  }

  /* T-A4 check-salary.mjs が、比較の年収の行を全部「その会社の額」として読める。読み方（ROLE・GAP・NUM・NAME_CHAR・DERIVED・aliases）は
     check-salary.mjs のソースから読んで評価する（ここに写さない）。拾い方の決まり（社名の前の字・長い呼び名・行の切れ目・ほかの会社の
     呼び名・年額でない言葉）は check-salary.mjs の2周目のとおり。 */
  {
    const SRC = read('check-salary.mjs');
    const take = (re, what) => { const m = SRC.match(re); if (!m) throw new Error(`check-salary.mjs に ${what} が無い`); return Function(`return (${m[1]});`)(); };
    const ROLE_ = take(/^const ROLE = ('[^'\n]*');/m, 'ROLE');
    const GAP_ = take(/^const GAP = ('[^'\n]*');/m, 'GAP');
    const NUM_ = take(/^const NUM = ('[^'\n]*');/m, 'NUM');
    const DERIVED_ = take(/^const DERIVED = (\/[^\n]*\/[a-z]*);/m, 'DERIVED');
    const NAME_CHAR_ = take(/^const NAME_CHAR = (\/[^\n]*\/[a-z]*);/m, 'NAME_CHAR');
    const aliases = take(/^(function aliases\(d\) \{\n[\s\S]*?\n\})/m, 'aliases()');
    const ALIAS = Object.entries(SALARY).flatMap(([slug, d]) => aliases(d).map(a => ({ slug, a }))).sort((x, y) => y.a.length - x.a.length);
    const ALL_ALIAS = ALIAS.map(x => x.a);
    const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
    /* 拾えた1つずつの位置が、どの会社のどの職位の行の中か（行の範囲で見る）。 */
    const spans = ROLES.flatMap(([r]) => {
      const at = CMP.indexOf(PAIRS[r]);
      return ROWS[r].map(x => { const i = CMP.indexOf(x.html, at); return { s: x.s, r, from: i, to: i + x.html.length }; });
    });
    const rowAt = i => spans.find(x => i >= x.from && i < x.to);
    const read2 = new Set(), wrong = [];
    for (const { slug, a } of ALIAS) {
      const re = new RegExp(rx(a) + GAP_ + ROLE_ + GAP_ + NUM_ + '(?:\\s*万?\\s*[〜~–—-]\\s*' + NUM_ + ')?\\s*万', 'g');
      let m;
      while ((m = re.exec(CMP)) !== null) {
        const span = m[0];
        if (m.index > 0 && NAME_CHAR_.test(CMP[m.index - 1])) continue;
        if (ALL_ALIAS.some(x => x.length > a.length && CMP.startsWith(x, m.index))) continue;
        const inner = span.slice(a.length);
        if (/<\/(?:tr|thead|tbody|table|section|article|li|ul|ol)>/.test(inner)) continue;
        if (ALL_ALIAS.some(x => x !== a && !a.includes(x) && inner.includes(x))) continue;
        if (DERIVED_.test(CMP.slice(Math.max(0, m.index - 40), m.index + span.length + 20))) continue;
        if (/運航乗務[員職]|訓練生|初任給|チャレンジ手当/.test(span)) continue;
        const role = /機長|Captain/.test(m[1]) ? 'cap' : 'fo', lo = +m[2].replace(/,/g, () => '');
        const row = rowAt(m.index + span.length - 1);
        if (!row) continue;   // 比較の年収の行の外（この検査が見るのは行だけ）
        if (row.s !== slug || row.r !== role || m[3] || lo !== SALARY[slug][role].avg) wrong.push(`${slug}/${role} ${lo}（${row.s}/${row.r} の行）`);
        else read2.add(`${slug}/${role}`);
      }
    }
    const unread = ALLK.flatMap(s => ROLES.map(([r]) => `${s}/${r}`)).filter(k => !read2.has(k));
    ok(spans.length === ALLK.length * ROLES.length && !unread.length && !wrong.length, '比較の年収は、全社とも check-salary.mjs が自分の会社の額として読める',
       `行 ${spans.length} ／ 読めない: ${unread.slice(0, 6).join(', ')}${unread.length > 6 ? ` ほか${unread.length - 6}` : ''} ／ 別の会社として読む: ${wrong.slice(0, 4).join(', ')}`);
  }

  /* T-A6 台帳に中身が在る会社にだけ箱：比較のカードは先行5社に1枚ずつ（X3 = B）・税の行と家賃の箱は台帳に中身の在る会社だけ・
     家賃の節の折り返しの印（data-wrap）は1つ。先行5社のほかの会社の要素に「準備中」などの断りを置かない。生きた欄（crl）を家賃の節と
     公表額の箱に置かない。 */
  {
    const cards = [...CMP.matchAll(/<div class="cr-card" data-airline="([^"]+)"/g)].map(m => m[1]);
    /* ★2026-10-25 P12.106（同じ強さの当て直し）：税の行は、年収の板の足の会社ごとの1行の中の税の扱いの字（.cr-tx）。 */
    const taxes = [...CMP.matchAll(/<span class="cr-go cr-ft" data-airline="([^"]+)"/g)].filter(m => elementAt(CMP, m.index).includes('<span class="cr-tx">')).map(m => m[1]);
    const rents = [...CMP.matchAll(/<article class="cr-rentb" data-airline="([^"]+)"/g)].map(m => m[1]);
    const wraps = [...BLOCK.matchAll(/<[a-z][^>]*\sdata-wrap(?:[\s=][^>]*)?>/g)].map(m => m[0]);
    const NOTE = /準備中|未取得|確認できていません|公表なし/;
    const said = [...CMP.matchAll(/<[a-z][a-z0-9]*\b[^>]*\sdata-airline="([^"]+)"/g)].filter(m => !FIVE.includes(m[1]))
      .map(m => [m[1], elementAt(CMP, m.index)]).filter(([, h]) => NOTE.test(h)).map(([s, h]) => `${s}「${(h.match(NOTE) || [''])[0]}」`);
    const rentSec = elementAt(CMP, CMP.indexOf('<div class="cr-sec cr-rents"'));
    const cardSec = elementAt(CMP, CMP.indexOf('<div class="cr-cards"'));
    const live = [/class="crl"/.test(rentSec) && '家賃の節', /class="crl"/.test(cardSec) && '公表額の箱'].filter(Boolean);
    ok(cards.length === FIVE.length && same(sorted(cards), sorted(FIVE)) && same(sorted(taxes), sorted(TAXED)) && same(sorted(rents), sorted(RENTB))
       && wraps.length === 1 && /^<div class="cr-sec cr-rents" data-wrap>$/.test(wraps[0]) && !said.length && !!rentSec && !!cardSec && !live.length,
       '比較のカードは先行5社に1枚ずつ（公表額の一覧は機長・副操縦士の公表額が在る会社だけ）・家賃の箱・税の行は、台帳に中身が在る会社にだけ在る（無い会社に空の箱も断りも置かない）',
       JSON.stringify({ cards, taxes: taxes.length, rents, wraps, said: said.slice(0, 4), rentSec: !!rentSec, cardSec: !!cardSec, live }));
    /* ★2026-10-25 WP-compare-all-13 F2（当て直し・同じ強さ）：家賃の箱が片方の会社にだけ在るとき、もう片方の列は空けずに、会社ページの暮らしの板と
       同じ1行（「家賃の資料を確認できていません」）を出す ── 箱は家賃の節に1つだけ（.cr-rentn ── 会社ごとの箱を足さない・社名を HTML に書かない・
       最初は隠れている）。社名と置く列は career.js が並べた2社から決める（ブラウザの検査は T-A0b'）。
       会社ページに家賃の額が在る会社（比較の箱の決まりに合わないだけ）は data-held に並ぶ ＝ その会社には出さない ── 資料が在るのに「確認できていません」と
       言わない。data-held は、ここで台帳（viewOf().living）から作り直した組と同じ（生成側を借りない）。字は日英とも、会社ページに出ている字そのもの。 */
    const HELD = ALLK.filter(s => !RENTB.includes(s) && ((viewOf(s).living || {}).rents || []).some(r => Object.keys(r.value || {}).length));
    const nb = [...rentSec.matchAll(/<article class="cr-rentn"[^>]*>[\s\S]*?<\/article>/g)].map(m => m[0]);
    const held = nb.length ? ((nb[0].match(/ data-held="([^"]*)"/) || [])[1] || '').split(' ').filter(Boolean) : null;
    const RENT_NONE = { ja: '家賃の資料を確認できていません', en: 'We have not been able to confirm rent sources' };
    const words = { ja: (nb[0] || '').includes(`<p class="cr-rentn-t">${RENT_NONE.ja}</p>`), en: EN_HTML.split(`<p class="cr-rentn-t">${RENT_NONE.en}</p>`).length === 2,
      jaCo: read('airlines/united.html').includes(`>${RENT_NONE.ja}</p>`), enCo: read('en/airlines/united.html').includes(`>${RENT_NONE.en}</p>`) };
    ok(nb.length === 1 && / hidden>/.test(nb[0].split('\n')[0]) && !/data-airline=/.test(nb[0]) && /<b class="cr-rentn-n"><\/b>/.test(nb[0])
       && held !== null && same(sorted(held), sorted(HELD)) && Object.values(words).every(Boolean),
       `家賃の節の「資料を確認できていません」の箱は1つだけ（最初は隠れている・社名も会社の印も HTML に無い）・会社ページに家賃の額が在る${HELD.length}社（data-held）には出さない・字は日英とも会社ページの暮らしの板の字`,
       JSON.stringify({ n: nb.length, held, HELD, words }));
  }

  /* T-A8 重さ（P7.9）：全社ぶんの材料を持つ career.html の大きさに上限を置く。SIZE0 は全社ぶんを入れる前（dafc536 の career.html）・
     GROW1 は全社ぶんを入れた差（段階5 compare-all-1 で作り直した career.html − SIZE0）── どちらも測った値。ROOM は GROW1 に、
     後の2つ（カードの材料 CA-2：150,000 / 25,000 / 50・会社を選ぶ板 CA-3b：100,000 / 12,000 / 1,500）の見込みを足して1回だけ切り上げた幅。
     ★GROW1 の gzip（+24,632）は見込み（+12,000）の倍 ── うち 17.0KB は段階4の「詳しく」を全社ぶんに広げたぶん（リードが受け入れた・
     2026-10-24。軽くするのは後の作業）。あとの作業は SIZE0・GROW1・ROOM を変えない。gz ＝ zlib.gzipSync の大きさ・tags ＝ /<[a-z]/g の数。 */
  {
    const SIZE0 = { raw: 186913, gz: 28565, tags: 2576 };   // dafc536 の career.html
    const GROW1 = { raw: 343610, gz: 24632, tags: 5006 };   // 段階5 compare-all-1 で作り直した career.html（530,523 / 53,197 / 7,582）− SIZE0
    const up = (n, step) => Math.ceil(n / step) * step;
    /* ★2026-10-25 段階5 compare-all-11（P12.110）：リードが認めた幅（この作業に gzip で 2,048 まで）のうち、使った 600（色の近さを測る座標 data-lab ×全社と、
       右の列の目盛の写し）。ROOM そのものは変えない。 */
    const GRANT11 = { raw: 0, gz: 600, tags: 0 };
    /* ★2026-10-25 段階5 compare-all-12：同じ幅の残り（1,448）のうち 150（税の扱いの字を2列の板で2行に切ったときの、入れ物の title ×25社）。 */
    const GRANT12 = { raw: 0, gz: 150, tags: 0 };
    /* ★2026-10-25 段階5 compare-all-13：同じ幅の残り（1,298）のうち 150（家賃の箱の無い列の「資料を確認できていません」の箱1つと、その箱を出さない会社の並び data-held）。
       この作業の前の HEAD（a61b3699）で、すでに上限の 34 下まで来ていた（英語の EN-9 の合流のぶん）。リードが認めた（P12.118・2026-10-25）。 */
    const GRANT13 = { raw: 0, gz: 150, tags: 0 };
    /* ★2026-10-25 P12.118：リードが ROOM を gzip で 4,096 広げた（次の作業 WP-14 / 15 で career.html に写真のクレジットと家賃の行が入る）。
       ROOM を広げるのはリードだけ。 */
    const LEAD118 = { raw: 0, gz: 4096, tags: 0 };
    /* ★2026-10-26 P12.122 / P12.122b：リードが ROOM を広げた（この作業 compare-all-14 の全部で 生の大きさ +25,000・gzip +3,584）。
       比較の札に、先行5社のほかの会社の写真が出る ── 示すことが条件の写真（CC BY / BY-SA など）のクレジットを、会社ページと同じく作者と
       ライセンスのリンクで全社ぶん置き（外す道は無い）、カードの島の1枚目に写真の説明（alt）を足した。ROOM を広げるのはリードだけ。 */
    const LEAD122 = { raw: 25000, gz: 3584, tags: 0 };
    const ROOM = { raw: up(GROW1.raw + 250000, 25000) + LEAD122.raw, gz: up(GROW1.gz + 37000, 2500) + GRANT11.gz + GRANT12.gz + GRANT13.gz + LEAD118.gz + LEAD122.gz, tags: up(GROW1.tags + 1550, 250) };
    const bytes = fs.readFileSync(path.join(ROOT, PAGE));
    const now = { raw: bytes.length, gz: zlib.gzipSync(bytes).length, tags: (bytes.toString('utf8').match(/<[a-z]/g) || []).length };
    const kb = n => Math.round(n / 1024);
    ok(['raw', 'gz', 'tags'].every(k => now[k] <= SIZE0[k] + ROOM[k]),
       `career.html は ${kb(now.raw)}KB（送るときは ${kb(now.gz)}KB・要素 ${now.tags}）── 全社ぶんの上限の内`,
       ['raw', 'gz', 'tags'].map(k => `${k} ${now[k]} / 上限 ${SIZE0[k] + ROOM[k]}`).join(' ／ '));
  }

  /* T-A9 会社ページが推定年収を書いている：比較は全社の推定を出す。その会社のページ（airlines/{slug}.html を、check-salary.mjs と同じく
     unbake して読む）が、機長と副操縦士の推定の額を2つとも書いていること。書いていない会社の数は、全社ぶんを入れた日（dafc536）の
     数 N0 を超えない（N0 = 0 ── 2026-10-11 に1社だったエミレーツは、全社へ広げる d2 で両方を書くようになった）。 */
  {
    const N0 = 0;
    const MISS = ALLK.filter(s => {
      const f = path.join(ROOT, 'airlines', `${s}.html`), t = fs.existsSync(f) ? unbake(fs.readFileSync(f, 'utf8')) : '';
      return !ROLES.every(([r]) => t.includes(SALARY[s][r].avg.toLocaleString('en-US')));
    });
    ok(MISS.length <= N0, `会社ページが推定年収を書いていない会社: ${MISS.join(', ') || 'なし'}（比較は推定を出す。増えたら落ちる）`,
       MISS.map(s => `${s}: 機長 ${SALARY[s].cap.avg.toLocaleString('en-US')}万・副操縦士 ${SALARY[s].fo.avg.toLocaleString('en-US')}万`).join('\n      '));
  }

  /* T-A10 カードの島と QR（★2026-10-24 段階5 compare-all-2・CA-2）：保存するカードの材料（#crc-data）は掲載している全社ぶん。
     住所はその会社のページ（?・# を付けない）で、ページのファイルが在る・英語の社名が在る・写真は台帳（airline-photos.mjs）に在る会社だけ。
     QR は、あるべき住所をこの検査がその場で符号化した行列（career-qr.mjs の qrMatrix）と同じで、正方形・大きさは別の読み取り器で
     読めた5社（FROZEN の指紋の頭）と同じ大きさのどちらか。島の字に ¥ と 万 は無い（額を持たない）。
     先行5社を FROZEN に結ぶ検査（T-C1）は、上の「保存するカードの住所と QR」のまま。
     ★2026-10-25 段階5 compare-all-5（CA-3b2）：島の g（カードの選ぶ欄が会社を束ねる地域の名前）は、その会社の地域の名前
     （directory-model.mjs の REGIONS の ja ── 航空会社一覧の見出しと同じ字。地域は model() の region）。 */
  {
    const CNAME = read('CNAME').trim();
    const ISL_TEXT = (HTML.match(/<script type="application\/json" id="crc-data">([\s\S]*?)<\/script>/) || [])[1] || '';
    const QSIZE = new Set(FIVE.map(s => Number(String(frozenPrint(`https://${CNAME}/airlines/${s}.html`)).split(':')[0])));
    const RJ = Object.fromEntries(DIR_REGIONS.map(R => [R.code, R.ja])), DM = dirModel();
    const bad = [], bySize = {};
    for (const s of ALLK) {
      const a = CARD_AIR[s];
      if (!a) { bad.push(`${s}: 島に無い`); continue; }
      const want = `https://${CNAME}/airlines/${s}.html`, rows = Array.isArray(a.qr) ? a.qr : [], why = [];
      if (a.url !== want || /[?#]/.test(String(a.url))) why.push(`住所 ${a.url}（あるべき ${want}）`);
      if (!DM.airlines[s] || !RJ[DM.airlines[s].region] || a.g !== RJ[DM.airlines[s].region]) why.push(`地域「${a.g}」（あるべき「${DM.airlines[s] && RJ[DM.airlines[s].region]}」）`);
      if (!fs.existsSync(path.join(ROOT, 'airlines', `${s}.html`))) why.push('会社ページのファイルが無い');
      if (!String(a.en || '').trim()) why.push('英語の社名が無い');
      if (!(PHOTOS[s] || []).length && (a.photos || []).length) why.push(`写真 ${(a.photos || []).length}枚（台帳に無い）`);
      if (!same(rows, qrMatrix(want).map(r => r.join(''))) || !rows.every(r => typeof r === 'string' && r.length === rows.length) || !QSIZE.has(rows.length))
        why.push(`QR ${rows.length}行（あるべき住所の行列と違う・正方形でない・大きさが5社と違う）`);
      bySize[rows.length] = (bySize[rows.length] || 0) + 1;
      if (why.length) bad.push(`${s}: ${why.join('・')}`);
    }
    ok(!!CNAME && QSIZE.size === 2 && !QSIZE.has(NaN) && !bad.length && !!ISL_TEXT && !/[¥￥万]/.test(ISL_TEXT),
       'カードの住所と QR は掲載している全社ぶん（QR の大きさは、別の読み取り器で読めた5社と同じ2通り）',
       [...bad.slice(0, 6), `5社の大きさ ${[...QSIZE].join('・')} ／ 島の大きさ ${JSON.stringify(bySize)} ／ 島の字の ¥・万 ${(ISL_TEXT.match(/.{0,20}[¥￥万].{0,20}/) || ['なし'])[0]}`].join(' ／ '));
  }

  /* T-A14 a 読み込んだだけでは全社を走らせない：gen-career.mjs は会社ページの生成器（gen-airline-glance.mjs）も読む。
     全社の読み口（viewOf）を走らせるのは、先行5社の1行と career() の中だけ。career() を呼ぶのは build() と cardData() の頭の2か所だけ
     （ファイルの地の文で呼ばない）。コメントを外して見る。
     ★2026-10-24 段階5 compare-all-2（CA-2・同じ強さの当て直し）：カードの材料（cardData()）も全社ぶんを書くので、その頭にも1か所。
       呼ぶ数が2で、2つとも関数の頭に在る ＝ ほかのどこにも無い（前は 数が1で build() の頭）。 */
  {
    const G = noJsCmt(read('gen-career.mjs'));
    const views = [...G.matchAll(/(?<![\w.])viewOf\(/g)].map(m => m.index);
    const fiveAt = G.indexOf('const VIEW = Object.fromEntries(FIVE.map(s => [s, viewOf(s)]));');
    const cAt = G.indexOf('\nfunction career() {');
    let cEnd = -1;
    if (cAt >= 0) {
      let d = 0;
      for (let i = G.indexOf('{', cAt); i < G.length; i++) {
        if (G[i] === '{') d++;
        else if (G[i] === '}' && !--d) { cEnd = i; break; }
      }
    }
    const inFive = i => fiveAt >= 0 && i > fiveAt && i < fiveAt + 70;
    const inCareer = i => cAt >= 0 && i > cAt && i < cEnd;
    const calls = [...G.matchAll(/(?<![\w.])career\(\)/g)].map(m => m.index).filter(i => !G.startsWith('function career()', i - 'function '.length));
    const first = /\nexport function build\(\) \{\n\s*career\(\);\n/.test(G);
    const cardFirst = /\nexport function cardData\(\) \{\n\s*career\(\);\n/.test(G);
    ok(views.length === 2 && views.filter(inFive).length === 1 && views.filter(inCareer).length === 1 && calls.length === 2 && first && cardFirst,
       'gen-career.mjs は、読み込まれただけでは全社の読み口を走らせない（会社ページの生成器も読む）',
       JSON.stringify({ viewOf: views.length, five: views.filter(inFive).length, inCareer: views.filter(inCareer).length, careerCalls: calls.length, buildFirst: first, cardFirst }));
  }

  /* T-A11 選ぶ欄を置かない・選ぶ面は1つ（★2026-10-25 段階5 compare-all-3・CA-3a）：比較の2社は、札を押すと開く選ぶ面（<dialog>）で選ぶ。
     比較の画面に <select> は無い。面は管理ブロックに1つだけで、比較の画面の後ろ・#cr の中（比較の画面の中に置くと、面の会社が
     「比較の会社ごとの要素」に数えられ、選ばれていない会社が見えたままになる）。札のボタンは「1社目」「2社目」の2つ・面の見出しは空でない
     （見出しの字は押した札の data-label を career.js が写す。HTML は1社目の字で出す）。career.js は無くなった2つの選ぶ欄の id と .options を読まない。
     押せるものの印の一覧（上の「押せるものに hover / focus-visible / active が全部ある」の need）に、面の5つが在る。 */
  {
    const dialogs = [...BLOCK.matchAll(/<dialog\b/g)].map(m => m.index);
    const cmpAt = BLOCK.indexOf(CMP), dEnd = BLOCK.indexOf('</dialog>');
    const inCr = /^\s*<div class="cr" id="cr"/.test(BLOCK) && dEnd >= 0 && dEnd < BLOCK.lastIndexOf('</div>');
    const plates = [...BLOCK.matchAll(/<button type="button" class="cr-pickb" id="cr-open-([ab])" data-label="([^"]*)"/g)].map(m => [m[1], m[2]]);
    const heading = ((BLOCK.match(/<h2 class="cr-sheet-h" id="cr-sheet-h">([^<]*)<\/h2>/) || [])[1] || '').trim();
    const oldIds = JSC.match(/['"`]#?cr-[ab]['"`]|\.options\b/g) || [];
    const NEED_SRC = (read('assert-career.mjs').match(/const need = \[([\s\S]*?)\];/) || [])[1] || '';
    const NEW_NEED = ['.cr-pickb:focus-visible', '.cr-pk:hover', '.cr-pk:active', '.cr-sheet-x:hover', '.cr-sheet-x:active'];
    const needLack = NEW_NEED.filter(x => !NEED_SRC.includes(`'${x}'`));
    ok(CMP.length > 0 && !/<select\b/.test(CMP) && dialogs.length === 1 && cmpAt >= 0 && dialogs[0] > cmpAt + CMP.length && inCr
       && (BLOCK.match(/class="cr-pickb"/g) || []).length === 2 && same(plates, [['a', '1社目'], ['b', '2社目']]) && !!heading
       && !oldIds.length && !needLack.length,
       '比較の会社選びは選ぶ面1つ：比較の画面に <select> が無い・<dialog> は管理ブロックに1つ（比較の画面の後ろ・#cr の中）・札のボタンは「1社目」「2社目」の2つ・面の見出しが空でない・career.js は無くなった選ぶ欄の id と .options を読まない・押せるものの印の一覧に面の5つ',
       JSON.stringify({ select: (CMP.match(/<select\b/g) || []).length, dialogs: dialogs.length, afterCmp: dialogs.length === 1 && cmpAt >= 0 && dialogs[0] > cmpAt + CMP.length, inCr, plates, heading, oldIds, needLack }));
  }

  /* 一覧の行（airlines-meta.js）とロゴの在る会社（airline-logos.js）── 生成側と同じ読み方で、ここで読む（生成側の関数は呼ばない）。 */
  const winOf = f => { const w = {}; new Function('window', read(f))(w); return w; };
  const META_ROWS = winOf('airlines-meta.js').PV_AIRLINES || [];
  const PV_LOGOS = winOf('airline-logos.js').PV_LOGOS || {};

  /* T-A12a 選ぶ面は航空会社一覧と同じ（★2026-10-25 段階5 compare-all-4・CA-3b1）：面の会社は掲載している全社で、並びは航空会社一覧の並び
     （directory-model.mjs の model() ── 一覧の形そのもの。台帳との突き合わせは assert-directory.mjs が持つ）。会社の行は、その会社の地域の
     見出しの下。略号の字と色（--cr-co）は一覧の行のまま。見出しは一覧の地域の名前（REGIONS の ja）で、会社の在る地域だけ・地域の順。
     見出しの行は読み上げの「一覧の項目」に数えない（role="presentation"）。面の中の行は、この2つの形だけ。 */
  {
    const M = dirModel(), bad = [];
    let cur = null;
    for (const x of SHEET) {
      if (x.g) { cur = x.g; continue; }
      const row = META_ROWS.find(r => r.file === `airlines/${x.s}.html`), A = M.airlines[x.s];
      const c = decode((x.html.match(/<span class="cr-pk-c">([^<]*)<\/span>/) || [])[1] || '');
      if (!row || !A) { bad.push(`${x.s}: 航空会社一覧に無い`); continue; }
      if (A.region !== cur) bad.push(`${x.s}: 見出し「${cur}」の下（地域 ${A.region}）`);
      if (c !== row.code) bad.push(`${x.s}: 略号「${c}」（一覧 ${row.code}）`);
      if (x.co !== row.color) bad.push(`${x.s}: 色 ${x.co}（一覧 ${row.color}）`);
    }
    const heads = SHEET.filter(x => x.g), want = DIR_REGIONS.filter(R => M.slugs.some(s => M.airlines[s].region === R.code));
    const li = (SHEET_L.match(/<li\b/g) || []).length;
    ok(PK.length > 0 && li === SHEET.length && same(PK.map(x => x.s), M.slugs) && same(sorted(M.slugs), sorted(ALLK))
       && same(heads.map(x => x.h), want.map(R => R.ja)) && same(heads.map(x => x.g), want.map(R => R.code)) && !bad.length,
       '比較の選ぶ面は、航空会社一覧と同じ会社・同じ並び・同じ地域',
       JSON.stringify({ li, read: SHEET.length, entries: PK.length, firstOff: PK.findIndex((x, i) => x.s !== M.slugs[i]), heads: heads.map(x => x.h), bad: bad.slice(0, 6) }));
  }

  /* T-A12b 比較の検索は、航空会社一覧と同じ鍵・同じ言葉（★2026-10-25 段階5 compare-all-5・CA-3b2）：面の会社の行の検索の鍵
     （data-k ＝ 呼び名・data-c ＝ 略号）は、航空会社一覧（world-airlines.html）のその会社のカード（li.wd-li）の鍵と1文字も違わない
     （どちらも directory-model.mjs の model() から書く ── 片方だけ直すと、同じ字を打って当たる会社が2つの画面で変わる）。
     検索の欄は面の中に1つ・会社の一覧の上。欄の字（placeholder と読み上げの名前）と、見つからないときの1行（出荷は隠したまま）は、
     航空会社一覧と同じ字（決まっている字 ── P7.10）。 */
  {
    const WA = read('world-airlines.html'), bad = [];
    const attr = (t, k) => { const v = (t.match(new RegExp(`\\s${k}="([^"]*)"`)) || [])[1]; return v === undefined ? undefined : decode(v); };
    const cards = {};
    for (const m of WA.matchAll(/<li class="wd-li"[^>]*>/g)) { const s = attr(m[0], 'data-slug'); (cards[s] = cards[s] || []).push(m[0]); }
    for (const s of ALLK) {
      const xs = PK.filter(x => x.s === s), cs = cards[s] || [];
      if (xs.length !== 1 || cs.length !== 1) { bad.push(`${s}: 面の行 ${xs.length}・一覧のカード ${cs.length}`); continue; }
      const k = attr(cs[0], 'data-k'), c = attr(cs[0], 'data-c');
      if (!xs[0].k || xs[0].k !== k) bad.push(`${s}: 呼び名「${xs[0].k}」（一覧「${k}」）`);
      if (!xs[0].c || xs[0].c !== c) bad.push(`${s}: 略号「${xs[0].c}」（一覧「${c}」）`);
    }
    const SAY = '航空会社名・国名で検索', NONE = '該当する航空会社が見つかりませんでした';
    const DLG = elementAt(BLOCK, BLOCK.indexOf('<dialog'));
    const fields = [...DLG.matchAll(/<input\b[^>]*>/g)].map(m => m[0]);
    const q = fields[0] || '', dirQ = (WA.match(/<input id="search"[^>]*>/) || [''])[0];
    const zero = [...DLG.matchAll(/<p class="cr-sheet-0" id="cr-sheet-0" role="status"( hidden)?>([^<]*)<\/p>/g)].map(m => [!!m[1], decode(m[2])]);
    const fieldOk = fields.length === 1 && attr(q, 'id') === 'cr-sheet-q' && attr(q, 'type') === 'search' && DLG.indexOf(q) < DLG.indexOf('<ul class="cr-sheet-l"')
      && attr(q, 'placeholder') === SAY && attr(q, 'aria-label') === SAY && attr(dirQ, 'placeholder') === SAY && attr(dirQ, 'aria-label') === SAY;
    ok(!bad.length && fieldOk && same(zero, [[true, NONE]]) && WA.includes(NONE) && (BLOCK.match(/cr-sheet-0/g) || []).length === 2,
       '比較の検索は、航空会社一覧と同じ鍵・同じ言葉',
       JSON.stringify({ bad: bad.slice(0, 6), fields: fields.map(f => f.slice(0, 90)), dirField: [attr(dirQ, 'placeholder'), attr(dirQ, 'aria-label')], zero, dirNone: WA.includes(NONE) }));
  }

  /* T-A13 比較の検索は、航空会社一覧と同じ字の関数（★2026-10-25 段階5 compare-all-5・CA-3b2）：career.js の検索の6つ（fold・spaced・
     compact・starts・query・tier）は、pv-directory.js の6つを1文字も変えずに写したもの（空白の量だけは見ない）。写しは career.js の
     var wdFind = (function () { … })(); の囲みの中にだけ在る ── 外へ出すと query という名前が住所を作る関数（function query(st)）を
     上書きし、ページのどの住所も壊れる。住所の関数は囲みの外にちょうど1つ。
     囲みの名前 wdFind は career.js の中で1回だけ宣言する（設計の名前 find は「戻る目印を探す」関数がすでに使っていて、あとの代入が
     検索を上書きし、選ぶ面が開かなくなった ── 2026-10-25 に作る途中で実際に起きた）。 */
  {
    const close = (t, at) => {   // at の後ろの最初の { から、それと対になる } まで
      let d = 0;
      for (let i = t.indexOf('{', at); i >= 0 && i < t.length; i++) {
        if (t[i] === '{') d++;
        else if (t[i] === '}' && !--d) return i + 1;
      }
      return -1;
    };
    const fnText = (t, name) => { const at = t.indexOf(`function ${name}(`), end = at < 0 ? -1 : close(t, at); return end < 0 ? null : t.slice(at, end); };
    const flat = t => (t == null ? null : t.replace(/\s+/g, () => ' ').trim());
    const DIRJS = read('pv-directory.js'), OPEN = 'var wdFind = (function () {', fAt = JS.indexOf(OPEN), fEnd = fAt < 0 ? -1 : close(JS, fAt + OPEN.length - 1);
    const decl = (JSC.match(/\b(?:var|let|const|function)\s+wdFind\b/g) || []).length;
    const BOX = fAt >= 0 && fEnd > 0 ? JS.slice(fAt, fEnd) : '', REST = fAt >= 0 && fEnd > 0 ? JS.slice(0, fAt) + JS.slice(fEnd) : JS;
    const SIX = ['fold', 'spaced', 'compact', 'starts', 'query', 'tier'];
    const diff = SIX.filter(n => { const a = flat(fnText(DIRJS, n)), b = flat(fnText(BOX, n)); return !a || !b || a !== b; });
    const outside = SIX.filter(n => n !== 'query' && REST.includes(`function ${n}(`));
    const qs = (REST.match(/function query\(/g) || []).length, qst = (REST.match(/function query\(st\) \{/g) || []).length;
    ok(JS.split(OPEN).length === 2 && !!BOX && !diff.length && !outside.length && qs === 1 && qst === 1 && !BOX.includes('function query(st)') && decl === 1,
       '比較の検索は、航空会社一覧と同じ字の関数（6つ）',
       JSON.stringify({ box: !!BOX, diff, outside, queryOutside: qs, addressFn: qst, declared: decl }));
  }

  /* T-A16 ロゴ（★2026-10-25 段階5 compare-all-4・CA-3b1）：面の会社の行には、ロゴの札がちょうど1つ（.cr-pk-lg の中）。ロゴの在る会社は、
     その会社自身のロゴの絵1枚（assets/airline-logos/{slug}.{拡張子}・alt は空・見えたときに読む）で、札ごと読み上げない（aria-hidden）。
     ロゴの無い会社は頭文字の札（絵を置かない・1〜2字）。上の写真の検査はロゴを切り取ってから見る ── 切り取ったあとにロゴの絵が残らない・
     先行5社の写真の札（.cr-opt）にロゴを置かない。 */
  {
    const bad = [];
    const attr = (t, k) => (t.match(new RegExp(`\\s${k}="([^"]*)"`)) || [])[1];
    for (const x of PK) {
      const n = (x.html.match(/class="pvg-logo/g) || []).length;
      const box = (x.html.match(/^<span class="cr-pk-lg">(<span class="pvg-logo[^"]*" aria-hidden="true">[\s\S]*?<\/span>)<\/span>/) || [])[1];
      if (n !== 1 || !box) { bad.push(`${x.s}: ロゴの札 ${n}つ${box ? '' : '（.cr-pk-lg の中に無い・読み上げる）'}`); continue; }
      const imgs = [...box.matchAll(/<img\b[^>]*>/g)].map(m => m[0]), mono = decode((box.match(/<b class="pvg-mono"[^>]*>([^<]*)<\/b>/) || [])[1] || '');
      if (PV_LOGOS[x.s]) {
        const t = imgs[0] || '';
        if (imgs.length !== 1 || /is-mono/.test(box) || attr(t, 'src') !== `assets/airline-logos/${x.s}.${PV_LOGOS[x.s]}` || attr(t, 'alt') !== '' || attr(t, 'loading') !== 'lazy')
          bad.push(`${x.s}: 絵 ${imgs.length}枚 ${t.slice(0, 100)}`);
      } else if (!/^<span class="pvg-logo is-mono"/.test(box) || imgs.length || ![1, 2].includes([...mono].length)) bad.push(`${x.s}: 頭文字の札 ${box.slice(0, 100)}`);
    }
    const fiveLogo = [...CMP.matchAll(/<div class="cr-opt" data-airline="([^"]+)"/g)].filter(m => /pvg-logo/.test(elementAt(CMP, m.index))).map(m => m[1]);
    const left = BLOCK.replace(/<span class="pvg-logo[^"]*" aria-hidden="true">[\s\S]*?<\/span>/g, () => '');
    /* 上の写真の検査が切り取るロゴの札（この形の span）は、選ぶ面の会社の行の中の1つずつだけ。ほかの場所に置くと、その中の絵は台帳と
       突き合わされない（台帳に無い写真を札に包めば通ってしまう）ので、数で縛る（★2026-10-25 compare-all-4 の検品で足した）。 */
    const cut = (BLOCK.match(/<span class="pvg-logo[^"]*" aria-hidden="true">/g) || []).length;
    ok(PK.length === ALLK.length && !bad.length && !fiveLogo.length && !left.includes('assets/airline-logos/') && cut === PK.length,
       '選ぶ面のロゴは、その会社自身のロゴか頭文字（読み上げない）',
       JSON.stringify({ entries: PK.length, cut, bad: bad.slice(0, 6), fiveLogo, left: (left.match(/.{0,40}assets\/airline-logos\/.{0,40}/) || [''])[0] }));
  }

  /* T-A14 b（★2026-10-25 段階5 compare-all-4・CA-3b1）：航空会社一覧の形（model()）を読むのは dir() の中の1か所だけ。dir()・listed()・career() を
     呼ぶ所は、どれも関数の中 ── ファイルの地の文（読み込んだときに走る文）には無い（このファイルは会社ページの生成器 gen-airline-glance.mjs も
     読む。一覧の決まりの1つの誤りで、全部の会社ページの生成まで止めない）。コメントを外して見る。地の文の1文 ＝ 字下げの無い行から始まる文
     （字下げの無い行でも、テンプレートの中身 ── < や ${ で始まる行 ── は文の頭に数えない）。その文が関数の宣言（function）か、矢印の関数を
     置くだけの const / let のときだけ、中の呼び出しは後で走る（すぐ呼ぶ (() => …)() は地の文）。 */
  {
    const G = noJsCmt(read('gen-career.mjs')), lines = G.split('\n');
    const START = /^(?!\$\{)[A-Za-z_$]/;
    const FN = /^(?:export\s+)?(?:async\s+)?function\b|^(?:export\s+)?(?:const|let)\s+[\w$]+\s*=\s*(?:\([^()]*\)|[\w$]+)\s*=>/;
    const stmtOf = i => { for (let k = G.slice(0, i).split('\n').length - 1; k >= 0; k--) if (START.test(lines[k])) return lines[k]; return ''; };
    const hits = [...G.matchAll(/(model|dir|listed|career)\(/g)].filter(m => {
      const p = G[m.index - 1] || '';
      if (/[\w$]/.test(p) || (p === '.' && G[m.index - 2] !== '.')) return false;   // 名前の一部・ほかのものの口（x.listed(）。広げる ...listed( は数える
      return !/function\s+$/.test(G.slice(Math.max(0, m.index - 12), m.index));
    });
    const dAt = G.indexOf('\nconst dir = () => {'), dEnd = dAt >= 0 ? G.indexOf('\n};', dAt) : -1;
    const models = hits.filter(m => m[1] === 'model');
    const loose = hits.filter(m => !FN.test(stmtOf(m.index))).map(m => `${m[1]}()「${stmtOf(m.index).slice(0, 48)}」`);
    ok(models.length === 1 && dAt >= 0 && models[0].index > dAt && models[0].index < dEnd && !loose.length,
       'gen-career.mjs は、読み込まれただけでは全社の読み口と航空会社一覧の決まりを走らせない（会社ページの生成器も読む）',
       JSON.stringify({ model: models.length, inDir: models.map(m => m.index > dAt && m.index < dEnd), loose }));
  }
}

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
const trouble = [];   // ページの中の例外と、読めなかった自サイトのファイル
const NET_OFF = /googletagmanager|google-analytics|clarity\.ms|doubleclick|supabase\.co/;

const ready = page => page.waitForFunction(() =>
  !document.documentElement.classList.contains('cr-boot') && !!window.PVCurrency
  && !!document.querySelector('#cr .cr-view:not([hidden])'));
/* いまの位置が段（history.state）に書かれたか。段の y は、いま見ている画面の「残さない欄」（誰が見ても同じ字の顔でない欄・
   片側だけの欄 ── 開いた欄の高さは、受け取った人にしか無い行の数を語る）を高さ 0 とみなした位置
   （★2026-10-24 段階4 cmp-links-card-8：career.js の keep() が 2026-10-23 から書く形。assert-cmp-frame.mjs の FLAT_Y と同じ決まり）。
   前の待ち「y ＝ いまの位置（|y − scrollY| < 1）」は、同じ強さでこちらへ移した：残さない欄の無い人（空の保存先のゲスト）は
   今までどおり いまの位置そのもの。口コミの点が在る保存先では、ゲストの評価の欄が開くので、前の待ちは時間切れで赤くなっていた。
   顔の一覧は比較の設計（LC-A19）の字そのもの ── 製品の SAME_FACE と1字も違わないことは assert-cmp-frame.mjs が見ている。
   ページで流す（window.__flatY として置いてから呼ぶ） */
const SAME_SHEET = 'locked|login|give|few|empty|off|error';
const SHOWN_LIVE = '#cr .cr-view:not([hidden]) .crl[data-live]';
const FLAT_Y = (sel, same) => {
  const re = new RegExp(`^(${same})$`), bar = document.querySelector('.mr-top'), e = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  let hid = 0;
  for (const b of document.querySelectorAll(sel)) {
    if ((re.test(b.getAttribute('data-state') || '') && !b.hasAttribute('data-part')) || (b.parentElement && b.parentElement.closest('.crl[data-live]'))) continue;
    const r = b.getBoundingClientRect();
    hid += Math.max(0, Math.min(e, r.bottom) - r.top);
  }
  return Math.round(window.scrollY - hid);
};
const keptAt = async page => {
  await page.evaluate(`window.__flatY = ${FLAT_Y};`);
  return page.waitForFunction((sel, same) => scrollY > 0 && history.state && history.state.y === window.__flatY(sel, same),
    { timeout: 5000 }, SHOWN_LIVE, SAME_SHEET).then(() => true, () => false);
};
/* 字と動きが落ち着くまで待つ（時間では待たない）。 */
const settle = page => page.evaluate(async () => {
  await document.fonts.ready;
  const mine = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#cr'));
  await Promise.all(mine.map(a => a.finished.catch(() => {})));
});
/* opt.path：career.html のほかのページを開く（会社ページ ── companyPage）。opt.errs：そのページの例外と読めなかったファイルを書く先
   （会社ページには会社ページの検査が在る。ここの trouble には入れず、控えとして出す）。 */
async function open(q = '', w = 390, h = 680, opt = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = opt.errs || trouble;
  page.on('pageerror', e => errs.push(`${opt.path || q || '（入口）'}: ${e.message}`));
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  await page.setViewport({ width: w, height: h });
  if (opt.js === false) await page.setJavaScriptEnabled(false);
  if (opt.before) await page.evaluateOnNewDocument(opt.before);   // ページのどのスクリプトよりも先に流す（書き留め役）
  /* この検査からは、解析タグにも本番の DB にも1本も出さない
     （手元で開いた回が訪問として数えられる／ネットの調子で答えが変わる、の両方を避ける）。
     生きた欄は「読めなかった」の姿で落ち着く ＝ 出荷した HTML の字だけを見ることになる。 */
  await page.setRequestInterception(true);
  page.on('request', r => ((opt.block && r.url().includes(opt.block)) || NET_OFF.test(r.url()) ? r.abort() : r.continue()));
  await page.goto(`${BASE}/${opt.path || PAGE}${q}`, { waitUntil: 'load' });
  if (opt.js !== false && !opt.path) await ready(page);
  return { page, close: () => ctx.close() };
}
/* 会社ページ（airlines/{slug}.html）を1社に1回だけ開いて読む（★2026-10-23 段階4 cmp-links-card-5・E7.5）。
   tabs ＝ ページが持つタブ／facts ＝ 会員の回答の欄ごとの 質問の鍵 と、その欄が出るタブ（panes：その要素と祖先の data-pvg-pane の重なり。
   どこにも無ければ全部のタブ）／towns ＝ 街ごとの字（その街の詳細と、暮らしのタブの中でその街を名指す行 ── 札・家賃の棒の行・出典の参考）／
   townPane ＝ その街の詳細が出るタブ。開くのは、この検査の open()（解析タグと本番の DB へは1本も出さない）。 */
const CO_NOTES = [];
const coPages = new Map();
async function companyPage(s) {
  if (coPages.has(s)) return coPages.get(s);
  const errs = [];
  const { page: p, close: c } = await open('', 1280, 800, { path: `airlines/${s}.html`, errs });
  await p.waitForFunction(() => !!window.PVGlance, { timeout: 15000 }).catch(() => {});
  const got = await p.evaluate(() => {
    const all = [...new Set([...document.querySelectorAll('[data-pvg-tab]')].map(e => e.getAttribute('data-pvg-tab')))];
    const panes = el => {
      let set = null;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const v = n.getAttribute('data-pvg-pane');
        if (v == null) continue;
        const l = v.split(/\s+/).filter(Boolean);
        set = set ? set.filter(x => l.includes(x)) : l;
      }
      return set || all;
    };
    const t = el => el.textContent.replace(/\s+/g, ' ').trim();
    const facts = [...document.querySelectorAll('.crl[data-live="fact"]')].map(e => ({ keys: (e.getAttribute('data-keys') || '').split(',').filter(Boolean), panes: panes(e) }));
    const towns = {}, townPane = {};
    for (const d of document.querySelectorAll('section[id^="pvg-town-"]')) {
      const k = d.id.slice('pvg-town-'.length);
      const h4 = d.querySelector('.pvg-td-h h4');
      const main = h4 && h4.firstChild && h4.firstChild.nodeType === 3 ? h4.firstChild.nodeValue.trim() : '';
      const keyed = [...document.querySelectorAll('[data-town]')].filter(x => x.getAttribute('data-town') === k && panes(x).includes('life'));
      /* 出典の参考の行は、街の名前（と、続く地区の括弧）で始まる ──「南崁（蘆竹區） 月 TWD 10,000」 */
      const named = main ? [...document.querySelectorAll('[data-pvg-ev] li > span')].filter(x => panes(x).includes('life') && t(x).startsWith(main) && /^[ （]/.test(t(x).slice(main.length))) : [];
      towns[k] = [d, ...keyed, ...named].map(t).join(' ／ ');
      townPane[k] = panes(d);
    }
    return { tabs: all, facts, towns, townPane };
  });
  await c();
  if (errs.length) CO_NOTES.push(...errs);
  coPages.set(s, got);
  return got;
}
const go = async (page, q) => { await page.goto(`${BASE}/${PAGE}${q}`, { waitUntil: 'load' }); await ready(page); };
/* 比較の2社の片方を選ぶ（★2026-10-25 段階5 compare-all-3：2つの選ぶ欄は無くなり、札を押すと開く選ぶ面 #cr-sheet で選ぶ）。
   cmp-stubs.mjs の choose() の写し（この検査は検査の部品を読まない）。札を押す → 面が開く → その会社を押す → 面が閉じて、
   その側の札がその会社になるまで待つ。side ＝ 'a' | 'b' */
const choose = async (page, side, slug) => {
  await page.click(`#cr-open-${side}`);
  await page.waitForSelector('#cr-sheet[open]');
  await page.click(`#cr-sheet-l .cr-pk[data-airline="${slug}"]`);
  await page.waitForFunction((sd, s) => { const o = document.querySelector(`#cr .cr-side[data-side="${sd}"] .cr-opt:not([hidden])`); return !document.getElementById('cr-sheet').open && !!o && o.dataset.airline === s; }, {}, side, slug);
};
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
    /* ★2026-10-24 段階5 compare-all-1（E5.1 R0）：比較は全社ぶんの行・税の行を持つ（概要を持つのは先行5社だけ）── 概要の無い会社の入れ物もここで作る。 */
    const at = s => out[s] || (out[s] = { h1: null, ov: {}, cmp: {}, cmpN: {}, pubs: 0, tax: null, pub: null });
    for (const pair of document.querySelectorAll('#cr .cr-cmp .cr-pair')) {
      for (const row of pair.querySelectorAll('.cr-row')) {
        const vh = [...row.querySelectorAll('.cr-vh')].map(t);
        const v = row.querySelector('.cr-row-v');
        const o = at(row.dataset.airline);
        o.cmpN[pair.dataset.role] = (o.cmpN[pair.dataset.role] || 0) + 1;
        o.cmp[pair.dataset.role] = {
          name: t(row.querySelector('.cr-row-co')) || vh[0] || null, role: vh[vh.length - 1] || null, v: t(v), look: v ? v.dataset.look || '' : '',
          tag: t(row.querySelector('.cr-tag')), sub: t(row.querySelector('.cr-sub')) || '',
          bar: bar(row.querySelector('.cr-fill')), href: row.getAttribute('href'),
        };
      }
    }
    for (const card of document.querySelectorAll('#cr .cr-cmp .cr-card')) {
      at(card.dataset.airline).card = pub(card.querySelector('.cr-pub'));
      at(card.dataset.airline).cardPubs = card.querySelectorAll('.cr-pub').length;
    }
    /* ★2026-10-25 P12.106（同じ強さの当て直し）：税の扱いの字は、年収の板の足の会社ごとの1行（.cr-ft）の中（頭の読み上げだけの社名は除いて読む）。 */
    for (const x of document.querySelectorAll('#cr .cr-cmp .cr-ft .cr-tx')) {
      const c = x.cloneNode(true);
      c.querySelectorAll('.cr-vh').forEach(v => v.remove());
      at(x.closest('.cr-ft').dataset.airline).cmpTax = t(c);
    }
    return {
      co: out,
      order: [...document.querySelectorAll('#cr .cr-view[data-view="airline"]')].map(s => s.dataset.airline),
      /* 目盛の字は、置き場の画面（と比較では右端の印・見えているか）と一緒に拾う（★2026-10-24 P12.104 ── 目盛は画面ごと） */
      axes: [...document.querySelectorAll('#cr .cr-axis')].map(a => {
        const v = a.closest('.cr-view');
        return { labels: [...a.children].map(c => c.textContent.trim()), scale: Number(a.dataset.scale || 0), shown: !a.hidden,
          view: v ? v.dataset.view : '', airline: v ? v.dataset.airline || '' : '', div: v ? Number(v.style.getPropertyValue('--cr-div').trim() || 0) : 0 };
      }),
      div: document.getElementById('cr').style.getPropertyValue('--cr-div').trim(),
      pair: [...document.querySelectorAll('#cr .cr-cmp .cr-pair[data-role="cap"] .cr-row')].filter(r => !r.hidden).map(r => r.dataset.airline),
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

  /* 棒の目盛（★2026-10-24 オーナー P12.104）：概要はその会社の右端・比較の行は、並べている2社なら2社をあわせた右端・隠れている行はその会社の右端。 */
  const topAt = (s, where) => (where === '比較' && dom.pair.includes(s) ? SCALE(...dom.pair) : SCALE(s));
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
        ok(!!x.bar && /%$/.test(x.bar.w) && Math.abs(parseFloat(x.bar.w) - w.man / topAt(s, where) * 100) < 0.01,
           `${who}（${where}）: 棒の長さが額に比例（目盛 0〜${yen(topAt(s, where))}）`, x.bar && x.bar.w);
      }
      ok(a.tag === b.tag && a.sub === b.sub, `${who}: 札と一言が概要と比較で同じ`);
      if (DEEP.includes(s)) {
        const href = `${PAGE}?airline=${s}&d=${r}-est`;
        ok(a.href === href, `${who}: 概要の行から、その推定の詳細へ行ける`, String(a.href));
      }
      ok(b.href === null, `${who}: 比較の行は入口にしない（どの会社も）`, String(b.href));
    }
    ok(dom.co[s].h1 === name(s), `${name(s)}: 見出しが社名`);
    ok(dom.co[s].tax === BASIS[s].tax && dom.co[s].cmpTax === BASIS[s].tax,
       `${name(s)}: 税の扱いが台帳どおり（概要と比較）`, `${dom.co[s].tax} ／ ${dom.co[s].cmpTax}`);
  }

  /* 目盛。0 から・全部の棒が入る・いちばん近い 1,000万 の倍数・どの画面も同じ。
     ★2026-10-21（全社へ広げる d1・同じ強さの当て直し ── assert-airline-glance.mjs の AXIS と同じ）：目盛は会社ページと1つ
     （rollout.build.txt WP-roll-b 4・P12.86-4「1つの目盛」）＝ 新しい会社ページを持つ会社（SWITCH ＝ GLANCE）の推定年収ぜんぶが入る、
     いちばん近い 1,000万 の倍数。ここでは生成側の AXIS を読まずに SALARY から作り直す。この1枚の棒（5社）も全部入る。 */
  /* ★2026-10-24 段階5 compare-all-1（E5.1 P2・同じ強さの当て直し）：この1枚は掲載している全社の棒を持つ（比較の行）。右端は、
     この1枚に在るいちばん大きい棒（全社の推定年収）が入る、いちばん近い 1,000万 の倍数。生成側の AXIS を読まずに SALARY から作り直す。
     （会社ページの目盛は新しい形の会社から作る ── 全社が切り替わると同じ値。いまは spirit のほかが切り替わっていて同じ ¥7,000万） */
  /* ★2026-10-24 オーナー P12.104（同じ強さの当て直し ── リード L2）：上の2つ（右端は全社の推定が入る1本・どの画面も同じ目盛）は、
     「決まった上限を置かない・画面ごとの目盛」に替わった。どの画面の目盛も 0 から・右端は 1,000万 の倍数で、その画面に描く額のどれもが右端以下・
     いちばん大きい額との差は 1,000万 未満。概要・詳細はその会社の右端（囲みの刻みの数も）。比較は、見えている目盛が1本だけで、並べた2社を
     あわせた右端（囲みの刻みの数も）。隠れている比較の目盛は、右端の印どおりの字。全部の画面で1本の刻み（.cr の --cr-div）は無い。 */
  {
    const bad = [];
    for (const a of dom.axes) {
      const top = a.view === 'compare' ? (a.shown ? SCALE(...dom.pair) : a.scale) : SCALE(a.airline);
      if (!same(a.labels, ['0', yen(top / 2), yen(top)])) bad.push(`${a.view}:${a.airline || a.scale} の字 ${a.labels.join('・')}（あるべき 0〜${yen(top)}）`);
      if (a.view !== 'compare' && !(a.div * 1000 === top && fits(top, a.airline))) bad.push(`${a.view}:${a.airline} の刻み ${a.div}`);
    }
    const shown = dom.axes.filter(a => a.view === 'compare' && a.shown);
    if (!(dom.pair.length === 2 && shown.length === 1 && shown[0].scale === SCALE(...dom.pair) && shown[0].div * 1000 === shown[0].scale && fits(shown[0].scale, ...dom.pair)))
      bad.push(`比較：並べた2社 ${dom.pair.join('・')} ／ 見えている目盛 ${shown.map(a => `${a.scale}（刻み ${a.div}）`).join(',') || 'なし'}`);
    if (dom.div) bad.push(`全部の画面で1本の刻み（.cr の --cr-div:${dom.div}）`);
    ok(!bad.length && dom.axes.length >= FIVE.length + 1, `目盛は 0 から・画面ごと（概要・詳細はその会社の右端・比較は並べた2社をあわせた右端 ${yen(SCALE(...dom.pair))}）── 決まった上限なし`,
       bad.slice(0, 6).join(' ／ '));
  }

  /* ★2026-10-22 段階4 cmp-pay-3（T-S2a）：比較の年収の板は推定の板（data-kind="estimate"）。税の行のすぐ次に、対象の1行
     「推定年収　機種の指定なし」（会社ページの「対象：機種の指定なし」と同じ字の置き場 ── gen-career.mjs の EST_TARGET）。
     ★2026-10-25 オーナー P12.106（WP-compare-all-10・同じ強さの当て直し ── リード L2）：行ごとの札「推定」を見出しの1回にまとめたので、
     その1行の置き場は板の見出し（「年収」── #cr-cmp-h-pay）のすぐ次（見出しの行 .cr-panel-top の中）。ちょうど1つ・字・推定の板の中は前のまま。
     会社が公表した額の入れ物は data-kind="published"。字は決めごとなので、生成側から借りずにここへ書く。
     棒の行には、check-salary.mjs が「年額ではない」と読んで照合から外す言葉を書かない（書くと、その行の額が黙って照合から外れる）。 */
  head('比較の年収の板（推定・対象の1行）');
  {
    const DERIVED = /手取|月収|月額|毎月|月あたり|税引|実質|パッケージ|take-?home|after[- ]tax|per month|monthly|effectively|package/i;   // check-salary.mjs の DERIVED の写し
    const g = await page.evaluate(src => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]'), re = new RegExp(src, 'i');
      const tg = V ? [...V.querySelectorAll('p.cr-tgt')] : [], p = tg[0], prev = p ? p.previousElementSibling : null;
      const rows = V ? [...V.querySelectorAll('.cr-pair .cr-row')] : [];
      return {
        n: tg.length, all: document.querySelectorAll('#cr p.cr-tgt').length, text: p ? p.textContent.replace(/\s+/g, '') : '',
        prev: !!prev && prev.matches('h2.cr-panel-h#cr-cmp-h-pay') && !!p.parentElement.matches('.cr-panel-top'), inEst: !!(p && p.closest('.cr-panel[data-kind="estimate"]')),
        pub: V ? V.querySelectorAll('.cr-cards[data-kind="published"]').length : 0, cards: V ? V.querySelectorAll('.cr-cards').length : 0,
        rows: rows.length, said: rows.filter(r => re.test(r.textContent)).map(r => r.textContent.replace(/\s+/g, ' ').trim()),
      };
    }, DERIVED.source);
    ok(g.n === 1 && g.all === 1 && g.text === '推定年収機種の指定なし' && g.prev && g.inEst,
       '比較の年収の板（data-kind="estimate"）に、見出し（年収）のすぐ次の1行「推定年収　機種の指定なし」がちょうど1つ',
       `${g.n}つ（この1枚で ${g.all}）「${g.text}」 前が見出し ${g.prev} ／ 推定の板の中 ${g.inEst}`);
    ok(g.cards === 1 && g.pub === 1, '比較の「会社が公表している金額」の入れ物は data-kind="published"', `${g.pub}/${g.cards}`);
    /* ★2026-10-24 段階5 compare-all-1：比較の棒の行は全社ぶん（見せるのは選んだ2社）── 数える相手を正本の全社へ（同じ強さ） */
    ok(g.rows === ALLK.length * ROLES.length && !g.said.length, `比較の棒の行（${g.rows}）に、check-salary.mjs が年額ではないと読む言葉が無い`, g.said.join(' ／ '));
  }

  /* ★2026-10-22 段階4 cmp-pay-4：比較の画面に、提出された年収の欄の機材・職位・月の絞り込みを置かない（T-S5。DEEP PAY の置き場 #cr-deep の
     中は数えない）。給与の欄が読み終わってから数える。
     ★2026-10-25 段階5 compare-all-3（当て直し・強くした）：前は「選ぶ欄は2社を選ぶ2つだけ」。2社はいま札を押すと開く選ぶ面（#cr-sheet）で選ぶので、比較の画面（#cr-deep の外）に
     <select> は1つも無い。面にも <select> は無く、入力欄も無い（compare-all-5 で検索の欄 #cr-sheet-q が1つ入る）・押せるのは会社（.cr-pk）と
     「閉じる」（.cr-sheet-x）だけ。
     ★2026-10-25 段階5 compare-all-5（CA-3b2・同じ強さの当て直し）：面の入力欄は検索の欄 #cr-sheet-q ちょうど1つ（ほかの入力欄・<select> が
     1つでも増えれば落ちる ── 機材の絞り込みを戻さない、の見張りはそのまま）。
     棒と目盛（.cr-track・.cr-fill・.cr-axis）は推定の板（data-kind="estimate"）の中にだけ ── 公表額の箱・提出された年収の箱に棒を描かない。
     3つの箱（推定・公表・提出）は1つずつ（T-S6）。 */
  head('比較の箱の種類（推定・公表・提出）と選ぶ欄');
  {
    const paid = await page.waitForFunction(() => {
      const b = document.querySelector('#cr .cr-view[data-view="compare"] .crl[data-live="cmp-pay"]');
      return !!b && !!b.getAttribute('data-for') && !['idle', 'loading'].includes(b.getAttribute('data-state'));
    }, { timeout: 20000, polling: 100 }).then(() => true, () => false);
    const k = await page.evaluate(() => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]');
      if (!V) return null;
      const bars = [...V.querySelectorAll('.cr-track, .cr-fill, .cr-axis')];
      return {
        pay: (V.querySelector('.crl[data-live="cmp-pay"]') || { getAttribute: () => null }).getAttribute('data-state'),
        sel: [...V.querySelectorAll('select')].filter(s => !s.closest('#cr-deep')).map(s => s.id || s.className),
        sheet: (S => S && { sel: S.querySelectorAll('select').length, inputs: [...S.querySelectorAll('input')].map(i => i.id || i.className),
          other: [...S.querySelectorAll('button')].filter(b => !b.matches('.cr-pk, .cr-sheet-x')).map(b => b.id || b.className || b.tagName),
          pk: S.querySelectorAll('.cr-pk').length, x: S.querySelectorAll('.cr-sheet-x').length })(document.getElementById('cr-sheet')),
        bars: bars.length,
        out: bars.filter(b => !b.closest('[data-kind="estimate"]')).map(b => `${b.className}（${(b.closest('[data-kind]') || { dataset: {} }).dataset.kind || '箱の外'}）`),
        kinds: ['estimate', 'published', 'submitted'].map(x => V.querySelectorAll(`[data-kind="${x}"]`).length),
      };
    });
    ok(paid && !!k && same(k.sel, []) && !!k.sheet && k.sheet.sel === 0 && same(k.sheet.inputs, ['cr-sheet-q']) && !k.sheet.other.length && k.sheet.pk > 0 && k.sheet.x === 1,
       `比較の画面に選ぶ欄（<select>）が無い・2社を選ぶ面 #cr-sheet にも <select> が無く、入力欄は検索の欄1つだけ・押せるのは会社と「閉じる」だけ（提出された年収の欄が読み終わった顔「${k && k.pay}」で数えた）`,
       JSON.stringify({ paid, sel: k && k.sel, sheet: k && k.sheet }));
    ok(!!k && k.bars > 0 && !k.out.length && same(k.kinds, [1, 1, 1]),
       '棒と目盛は推定の板（data-kind="estimate"）の中にだけ・推定／公表／提出の箱は1つずつ', JSON.stringify(k && { bars: k.bars, out: k.out, kinds: k.kinds }));
  }

  /* 会社が公表している金額。訓練生は出さない。 */
  head('会社が公表している金額');
  for (const s of FIVE) {
    /* 機長と副操縦士を分けない額（台帳の crew ＝ 運航乗務員の平均）は出さない（2026-10-21 P12.77）── 下の段で、ページのどこにも無いことも見る */
    const exp = ['cap', 'fo'].flatMap(r => figures(s, r).filter(f => !f.training).map(f => ({
      tag: TIERS[BASIS[s][r].tier].ja, group: f.group, kind: f.kind, amount: upTo(f.key) + f.text + tail(f.key),
      orig: f.cur === 'JPY' ? '' : `${upTo(f.key)}${f.cur} ${f.amount.toLocaleString('en-US')}${tail(f.key) ? ' ' + tail(f.key) : ''}`,
    })));
    const got = dom.co[s].pub;
    /* ★2026-10-21 リード P12.91-7：機長・副操縦士の公表額が無い会社（JAL・ANA）は、一覧そのものを出さない
       （「公表なし」の行も、見出しも・前提も・出どころも無い）。 */
    if (!exp.length) {
      ok(dom.co[s].pubs === 0 && dom.co[s].cardPubs === 0 && !got && !dom.co[s].card,
         `${name(s)}: 機長・副操縦士の公表額が無いので、「会社が公表している金額」の一覧を出さない（概要にも比較のカードにも）`,
         `概要 ${dom.co[s].pubs} ／ 比較 ${dom.co[s].cardPubs}`);
      continue;
    }
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
    ok(got.none === null, `${name(s)}: 「公表なし」と書いていない`);
    ok(same(dom.co[s].card, got), `${name(s)}: 比較のカードと概要で同じ中身`);
    /* 上限の額は、一覧でも「〜」と「上限」の字が対（原貨の額にも「〜」）。 */
    ok(got.rows.every(x => x.amount.startsWith('〜') === /上限/.test(x.kind) && (!x.orig || x.orig.startsWith('〜') === /上限/.test(x.kind))),
       `${name(s)}: 一覧の上限の額には「〜」と「上限」の字がそろっている`, got.rows.map(x => `${x.kind} ${x.amount} ${x.orig}`).join(' ／ '));
    /* 出どころは「会社が公表した資料」だけ・台帳のものが全部。報道など（secondary）と訓練生の資料は並べない。 */
    const urls = (BASIS[s].src || []).filter(x => !x.secondary && !/訓練生|自社養成/.test(x.name)).map(x => x.url);
    ok(same(got.srcs, urls) && urls.length > 0,
       `${name(s)}: 出どころは台帳の「会社が公表した資料」そのまま（${urls.length}つ）`,
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
      const { bars, axis, copy, hatch } = await page.evaluate(() => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        const tx = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const ax = [...v.querySelectorAll('.cr-axis')].filter(a => a.getClientRects().length).map(a => {
          const r = a.getBoundingClientRect();
          return { left: r.left, right: r.right, labels: [...a.children].map(s => s.textContent.trim()) };
        });
        /* 右の列の目盛の写し（★P12.110 ── スマホの比較だけ見える）。 */
        const copy = [...v.querySelectorAll('.cr-axis2')].filter(a => a.getClientRects().length).map(a => {
          const r = a.getBoundingClientRect();
          return { left: r.left, right: r.right, labels: [...a.children].map(s => s.textContent.trim()) };
        });
        return {
          axis: ax, copy,
          bars: [...v.querySelectorAll('.cr-fill')].filter(f => f.getClientRects().length).map(f => {
            const a = f.getBoundingClientRect(), b = f.parentElement.getBoundingClientRect();
            return {
              w: parseFloat(f.style.getPropertyValue('--w')), fill: a.width, track: b.width, left: a.left - b.left,
              tl: b.left, tr: b.right, pub: !!f.closest('.cr-pub'), bg: getComputedStyle(f).backgroundImage, s: (f.closest('[data-airline]') || {}).dataset?.airline || '',
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
      /* 同じ目盛＝土台が全部同じ位置・同じ幅で、目盛の両端がそこに合っている。
         ★2026-10-25 オーナー P12.110（WP-compare-all-11・同じ強さの当て直し ── リード L2）：スマホ（〜759px）の比較の年収の板は2列（左の会社｜右の会社）。
         同じ目盛 ＝ 土台が全部同じ幅・同じ会社の土台は同じ列（左の会社が左・右の会社が右）。左の列の目盛は見えている1本の .cr-axis、右の列は
         そのすぐ後ろの写し .cr-axis2（字も同じ）── どちらも両端がその列の土台に合っている。ほかの画面と広い画面は今までどおり（写しは出ない）。 */
      const two = w < 1000 && q.includes('view=compare');   // ★WP-compare-all-12：2列は 999px まで（タブレットも）
      const t0 = bars[0] || { tl: 0, tr: 0 };
      const cols = two ? [...new Set(bars.map(b => b.s))].map(s => bars.filter(b => b.s === s)) : [bars];
      const t1 = two && cols[1] ? cols[1][0] : null;
      ok(bars.every(b => Math.abs((b.tr - b.tl) - (t0.tr - t0.tl)) <= 0.5) && cols.every(cl => cl.every(b => Math.abs(b.tl - cl[0].tl) <= 0.5 && Math.abs(b.tr - cl[0].tr) <= 0.5))
         && (!two || (cols.length === 2 && cols.every(cl => cl.length === n / 2) && t1.tl > t0.tr)),
         two ? `${w}px ${q}: 棒の土台が全部同じ幅・同じ会社の土台は同じ列（左の会社が左・右の会社が右）` : `${w}px ${q}: 棒の土台が全部同じ位置・同じ幅`,
         bars.map(b => `${b.s} ${b.tl}〜${b.tr}`).join(' ／ '));
      ok(axis.length === 1 && Math.abs(axis[0].left - t0.tl) <= 1 && Math.abs(axis[0].right - t0.tr) <= 1
         && (two ? copy.length === 1 && !!t1 && Math.abs(copy[0].left - t1.tl) <= 1 && Math.abs(copy[0].right - t1.tr) <= 1 && same(copy[0].labels, axis[0].labels) : !copy.length),
         `${w}px ${q}: 目盛の両端が棒の土台に合っている${two ? '（右の列は、字の同じ写しの目盛）' : ''}`, `目盛 ${JSON.stringify(axis)} ／ 写し ${JSON.stringify(copy)} ／ 土台 ${t0.tl}〜${t0.tr}${t1 ? ` ・ ${t1.tl}〜${t1.tr}` : ''}`);
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

  /* ── 目盛は並べた2社で1本（★2026-10-24 オーナー P12.104「年収はもっと高い人もいるだろうからMAX7000万はおかしい」）──
     決まった上限は無い。2社をあわせた右端 ＝ 2社の額（推定・幅の上の額・公表額）のどれもが入る、いちばん近い 1,000万 の倍数。
     a) 低い2社（エバー航空・JAL）は低い右端 ── 掲載している会社のいちばん大きい目盛に引っぱられない。
     b) 選び直すと、右端・見えている目盛の1本・刻みの数・棒の長さ（描いた長さも）が、新しい2社のものに替わる。入れ替えても同じ。
     c) カード：2社のカードは2社で1本（JAL・ユナイテッド航空 ＝ ユナイテッドの幅の上の額で決まる）・1社のカードはその会社の目盛。
        棒は 額 ÷ 右端・目盛の字は右端の字。
     壊して確かめた形：career.js が2社の目盛を決め直さない／カードが1社目の目盛だけで描く／生成側に全社で1本の目盛を戻す → どれもここが赤。 */
  head('目盛は並べた2社で1本（選び直し・カード）');
  {
    const driver = (...list) => {
      const v = list.flatMap(s => ROLES.flatMap(([r, l]) => [[SALARY[s][r].avg, `${name(s)} ${l}の推定`], [SALARY[s][r].hi, `${name(s)} ${l}の幅の上の額`],
        ...figures(s, r).filter(f => !f.training).map(f => [f.man, `${name(s)} ${l}の公表額`])])).sort((a, b) => b[0] - a[0]);
      return `${v[0][1]} ${yen(v[0][0])}`;
    };
    const snapCmp = () => page.evaluate(() => {
      const v = document.querySelector('#cr .cr-view[data-view="compare"]');
      return {
        div: v.style.getPropertyValue('--cr-div').trim(),
        axis: [...v.querySelectorAll('.cr-panel .cr-axis')].filter(a => a.getClientRects().length)
          .map(a => ({ scale: Number(a.dataset.scale || 0), labels: [...a.children].map(c => c.textContent.trim()) })),
        rows: [...v.querySelectorAll('.cr-pair .cr-row')].filter(r => !r.hidden).map(r => {
          const f = r.querySelector('.cr-fill'), a = f.getBoundingClientRect(), b = f.parentElement.getBoundingClientRect();
          return { s: r.dataset.airline, role: r.closest('.cr-pair').dataset.role, w: parseFloat(f.style.getPropertyValue('--w')), fill: a.width, track: b.width };
        }),
      };
    });
    const cmpBad = (got, a, b) => {
      const top = SCALE(a, b), why = [];
      if (Number(got.div) * 1000 !== top) why.push(`刻み ${got.div}`);
      if (!(got.axis.length === 1 && got.axis[0].scale === top && same(got.axis[0].labels, ['0', yen(top / 2), yen(top)]))) why.push(`見えている目盛 ${JSON.stringify(got.axis)}`);
      if (!fits(top, a, b)) why.push(`右端 ${top} が2社の額に合わない`);
      const rows = got.rows.map(x => `${x.s}/${x.role}`).sort(), wantRows = [a, b].flatMap(s => ROLES.map(([r]) => `${s}/${r}`)).sort();
      if (!same(rows, wantRows)) why.push(`見えている行 ${rows.join(',')}`);
      for (const x of got.rows) {
        const m = SALARY[x.s][x.role].avg;
        if (!(Math.abs(x.w - (m / top) * 100) < 0.01) || Math.abs(x.fill - x.track * x.w / 100) > 1)
          why.push(`${x.s}/${x.role} 棒 ${x.w}%（あるべき ${((m / top) * 100).toFixed(2)}%）描いた ${Math.round(x.fill)}/${Math.round(x.track)}px`);
      }
      return why;
    };
    await page.setViewport({ width: 390, height: 680 });
    await go(page, '?view=compare&a=eva-air&b=jal');
    await settle(page);
    const low = cmpBad(await snapCmp(), 'eva-air', 'jal');
    ok(!low.length && SCALE('eva-air', 'jal') < Math.max(...ALLK.map(s => SCALE(s))),
       `低い2社（${name('eva-air')}・${name('jal')}）は低い右端 ${yen(SCALE('eva-air', 'jal'))}（${driver('eva-air', 'jal')} が入る、いちばん近い 1,000万 の倍数）`, low.join(' ／ '));
    await choose(page, 'a', 'cathay-pacific');
    ok(await until(page, '?view=compare&a=cathay-pacific&b=jal'), '選び直すと住所が変わる（エバー航空 → キャセイパシフィック）', await search(page));
    await settle(page);
    const re = cmpBad(await snapCmp(), 'cathay-pacific', 'jal');
    ok(!re.length && SCALE('cathay-pacific', 'jal') !== SCALE('eva-air', 'jal'),
       `選び直すと、右端・見えている目盛・刻みの数・棒の長さが新しい2社のもの（${yen(SCALE('cathay-pacific', 'jal'))} ── ${driver('cathay-pacific', 'jal')}）に替わる`, re.join(' ／ '));
    await page.click('#cr-swap');
    ok(await until(page, '?view=compare&a=jal&b=cathay-pacific'), '入れ替えると住所も入れ替わる', await search(page));
    await settle(page);
    const sw = cmpBad(await snapCmp(), 'jal', 'cathay-pacific');
    ok(!sw.length, '入れ替えても、2社をあわせた目盛は同じ', sw.join(' ／ '));
    for (const want of [['jal', 'united'], ['united', 'jal'], ['eva-air', 'jal'], ['jal'], ['united']]) {
      const q = `?view=card&a=${want[0]}${want[1] ? `&b=${want[1]}` : ''}`;
      await go(page, q);
      const up = await page.waitForFunction(n => {
        const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
        return !!(m && m.cards && m.cards.length === n && m.cards.every(k => k.roles && k.roles.cap && k.roles.fo));
      }, { timeout: 8000 }, want.length).then(() => true, () => false);
      const m = up ? await page.evaluate(() => window.PVCareerCard.model().cards.map(k => ({ slug: k.slug, axis: k.axis, w: { cap: k.roles.cap.w, fo: k.roles.fo.w } }))) : null;
      const top = SCALE(...want), why = [];
      if (!m) why.push('カードの材料が出来ない');
      else for (const k of m) {
        if (!same(k.axis, ['0', yen(top / 2), yen(top)])) why.push(`${k.slug} の目盛 ${k.axis.join('・')}`);
        for (const [r] of ROLES) if (!(Math.abs(k.w[r] - SALARY[k.slug][r].avg / top) < 0.001)) why.push(`${k.slug}/${r} 棒 ${k.w[r]}（あるべき ${SALARY[k.slug][r].avg / top}）`);
      }
      ok(!why.length && fits(top, ...want),
         `${q}: カードの目盛は${want.length > 1 ? '2社で1本' : 'その会社の目盛'} ── 0〜${yen(top)}（${driver(...want)} が入る・棒は 額 ÷ 右端・目盛の字は右端の字）`, why.join(' ／ '));
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
  const shown = (pg = page) => pg.evaluate(() => {
    const vis = sel => [...document.querySelectorAll('#cr .cr-view:not([hidden]) ' + sel)].filter(e => e.getClientRects().length);
    const order = els => els.slice().sort((a, b) => {
      const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
      return Math.round(x.top - y.top) || x.left - y.left;
    }).map(e => e.dataset.airline);
    /* 年収の行は1社に1本（推定年収）。家賃の箱も1社に1つ（その会社の拠点の街）。
       ★2026-10-25 P12.106（同じ強さの当て直し）：税の行は、年収の板の足の会社ごとの1行（.cr-ft）のうち、税の扱いの字（.cr-tx）を持つもの。 */
    const taxed = () => vis('.cr-ft').filter(e => e.querySelector('.cr-tx'));
    return {
      rows: [...document.querySelectorAll('#cr .cr-cmp .cr-pair[data-role]')].map(p => order(vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`))),
      cards: order(vis('.cr-card')), taxes: order(taxed()), rents: order(vis('.cr-rentb')),
      opts: ['a', 'b'].map(s => vis(`.cr-side[data-side="${s}"] .cr-opt`).map(e => e.dataset.airline)),
      /* 節ごとの「詳しく」（置き場所の順 ＝ 読み上げと Tab の順）。 */
      gos: [...document.querySelectorAll('#cr .cr-cmp .cr-gos')].map(g => [...g.children].filter(e => e.getClientRects().length).map(e => e.dataset.airline)),
      credits: vis('.cr-credit[data-airline]').map(e => e.dataset.airline),
      /* 置き場所の順（読み上げと Tab が進む順）。見た目の順と同じでなければならない。 */
      dom: [...document.querySelectorAll('#cr .cr-cmp .cr-pair[data-role]')].map(p => vis(`.cr-pair[data-role="${p.dataset.role}"] .cr-row`).map(e => e.dataset.airline))
        .concat([vis('.cr-card').map(e => e.dataset.airline), taxed().map(e => e.dataset.airline), vis('.cr-rentb').map(e => e.dataset.airline)]),
    };
  });
  /* 選ぶ面：相手の会社は押せない・いまの会社に印・見出しは札の名前・開いているあいだ後ろは動かない・閉じると札へ戻る。 */
  const sheetOf = async pg => {
    const out = [];
    for (const side of ['a', 'b']) {
      await pg.click(`#cr-open-${side}`);
      await pg.waitForSelector('#cr-sheet[open]');
      const s = await pg.evaluate(() => [
        [...document.querySelectorAll('#cr-sheet-l .cr-pk:disabled')].map(e => e.dataset.airline),
        [...document.querySelectorAll('#cr-sheet-l .cr-pk[aria-current="true"]')].map(e => e.dataset.airline),
        document.getElementById('cr-sheet-h').textContent.trim(),
        document.documentElement.classList.contains('cr-sheeting'),
      ]);
      await pg.keyboard.press('Escape');
      /* Esc で面は閉じるが、閉じた知らせ（close）は1拍あとに届く ── 印が外れるのもその時。外れるまで待ってから読む
         （外れないまま5秒たてば、下の読みが true のまま ＝ 赤）。 */
      await pg.waitForFunction(() => !document.getElementById('cr-sheet').open && !document.documentElement.classList.contains('cr-sheeting'), { timeout: 5000 }).catch(() => {});
      out.push([...s, ...(await pg.evaluate(() => [document.documentElement.classList.contains('cr-sheeting'), document.activeElement ? document.activeElement.id : '']))]);
    }
    return out;
  };
  const pairOk = async (a, b, label, pg = page) => {
    const g = await shown(pg);
    g.sheet = await sheetOf(pg);
    /* 「会社が公表している金額」の箱は、2社のどちらにも一覧が無ければ描かない（2026-10-22 LEAD AMENDMENT）。片方に在れば、2社とも社名が並ぶ。 */
    const cards = [a, b].some(s => WITH_PUB.includes(s)) ? [a, b] : [];
    const exp = {
      rows: ROLES.map(() => [a, b]), cards, taxes: [a, b], rents: [a, b], opts: [[a], [b]],
      gos: GOS.map(() => [a, b]),
      credits: [a, b].filter(s => needsCredit(primary(s))),
      dom: [...ROLES.map(() => [a, b]), cards, [a, b], [a, b]],
      sheet: [[[b], [a], '1社目', true, false, 'cr-open-a'], [[a], [b], '2社目', true, false, 'cr-open-b']],
    };
    ok(same(g, exp), label, JSON.stringify(g));
  };
  await pairOk('jal', 'cathay-pacific', '2社だけが並ぶ（棒・カード・税・家賃の箱・写真・クレジット）。相手の会社は選べない');
  /* ★2026-10-23 段階4 cmp-links-card-5（T-L4）：比較の中の会社ごとの要素（.cr-opt・生きた欄・DEEP PAY の置き場の中を除く）は、
     全部 career.js の pair() の「選んだ2社だけ見せる」一覧に入っている。一覧は career.js から読む（ここに写さない）。
     入れ替えの一覧（並べ直す箱）に「詳しく」の行が在ることも見る ── 選び直し・入れ替えのあとの並びは pairOk の gos が見る。 */
  {
    const lists = [...JS.matchAll(/each\(cmp\.querySelectorAll\('([^']+)'\)/g)].map(m => m[1]);
    const LIST1 = lists.find(l => l.split(',').map(x => x.trim()).includes('.cr-row')) || '';
    const LIST2 = lists.find(l => l.split(',').map(x => x.trim()).includes('.cr-pair')) || '';
    const stray = LIST1 ? await page.evaluate(L1 => [...document.querySelectorAll('#cr .cr-cmp [data-airline]')]
      .filter(e => !e.matches('.cr-opt') && !e.closest('.crl, #cr-deep') && !e.matches(L1)).map(e => `${e.className || e.tagName}（${e.dataset.airline}）`), LIST1) : ['（一覧が読めない）'];
    ok(!!LIST1 && LIST2.split(',').map(x => x.trim()).includes('.cr-gos') && !stray.length, '比較の会社ごとの要素は、全部「選んだ2社だけ見せる」の一覧に入っている',
       JSON.stringify({ LIST1, LIST2, stray }));
  }

  await choose(page, 'b', 'etihad');
  ok(await until(page, '?view=compare&a=jal&b=etihad'), '会社を選び直すと住所が変わる', await search(page));
  await pairOk('jal', 'etihad', '選び直した2社に入れ替わる');
  await page.click('#cr-swap');
  ok(await until(page, '?view=compare&a=etihad&b=jal'), '入れ替えると住所も入れ替わる', await search(page));
  await pairOk('etihad', 'jal', '入れ替えた順に並ぶ');
  ok(await page.evaluate(() => history.length) === len2, '選び直しと入れ替えは履歴を積まない（戻る1回で出られる）');

  /* 社名の行き先は「属性」で見る。比較から1段積む動きは「カードを保存」で見る ── 社名は career.html の外へ出るので、
     1つの文書の中の行き来（戻る・進む）の途中に置かない。 */
  const NAME = '#cr .cr-view:not([hidden]) .cr-card[data-airline="etihad"] .cr-card-n';
  ok(await page.$eval(NAME, a => a.getAttribute('href')) === NAME_HREF('etihad') && !(await page.$eval(NAME, a => a.hasAttribute('data-go'))),
     '比較の社名は、いま改良している会社ページ（airlines/…）へ出る（career.html の中の古い概要へ行かない）', await page.$eval(NAME, a => a.getAttribute('href')));
  /* 1段積むのは、同じ文書の中（読み直さない）。読み直しても住所と画面は同じになるので、目印と履歴の段数でも見る。 */
  await page.evaluate(() => { window.__crSameDoc = 1; });
  await page.click('#cr-to-card');
  ok(await until(page, '?view=card&a=etihad&b=jal') && await view(page) === 'card'
     && await page.evaluate(() => window.__crSameDoc === 1) && await page.evaluate(() => history.length) === len2 + 1,
     '比較から「カードを保存」へ（履歴が1段積まれる）', `${await search(page)} ／ 履歴 ${await page.evaluate(() => history.length)}（あるべき ${len2 + 1}）`);
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
  const kept = await keptAt(page);
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
      /* ★2026-10-24 段階5 compare-all-1（E5.1 P3）：比較は全社ぶんの行を持つ ── 概要の額は比較の中に同じ額で在り、比較の行は全社ぶん読めている */
      ok(Object.keys(s.ov).every(k => k in s.cmp) && Object.keys(s.cmp).length === ALLK.length * ROLES.length && !differ.length, `${cur}: 概要と比較で同じ額`, differ.map(k => `${k} ${s.ov[k]} / ${s.cmp[k]}`).join(' ／ '));
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
          const tight = await p.evaluate(GAP => [...document.querySelectorAll('#cr .cr-view:not([hidden]) :is(.cr-axis, .cr-axis2)')]
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
      /* ★2026-10-25 オーナー P12.110「スマホの画面も比較の年収のカードデカすぎるだろ」（WP-compare-all-11・同じ強さの当て直し ── リード L2）：
         前は「棒の行の社名が1行に収まる」を見ていた（長い社名と額が1行に並んで、社名が語の途中で折れた ── 2026-10-04）。スマホの年収の板は
         上の2枚の札と同じ2列になり、欄の中に社名を書かない（上の札が言う・行の社名は読み上げにだけ）。見るのは欄そのもの ──
         社名は画面に出ず読み上げにだけ在る・額は1行で欄（.cr-row）の中・同じ職位の左右の欄が重ならない。額の字は通貨で替わる（中の字まで数える）。 */
      const srOnly = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.position === 'absolute' && s.clipPath === 'inset(50%)' && r.width <= 1 && r.height <= 1; };
      const deep = e => { const g = document.createRange(); g.selectNodeContents(e); return [...g.getClientRects()].filter(x => x.width > 1); };
      const rows = [...V.querySelectorAll('.cr-pair .cr-row')].filter(r => !r.hidden).map(r => {
        const co = r.querySelector('.cr-row-co'), v = r.querySelector('.cr-row-v'), c = r.getBoundingClientRect(), f = deep(v);
        const l = Math.min(...f.map(x => x.left)), rr = Math.max(...f.map(x => x.right));
        return { role: r.closest('.cr-pair').dataset.role, name: co.textContent.trim(), sr: srOnly(co), lines: lines(f), v: v.textContent.trim(),
          cell: { l: c.left, r: c.right, t: c.top, b: c.bottom }, inCell: f.length > 0 && l >= c.left - 0.5 && rr <= c.right + 0.5 };
      });
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
          if (rows.length !== 4) rowBad[w].push(`${cur} ${q}: 年収の欄 ${rows.length}つ`);
          for (const r of rows) {
            if (!r.sr || !r.name) rowBad[w].push(`${cur}「${r.name}」: 欄の中に社名が見えている（読み上げにだけ残す）`);
            if (r.lines !== 1 || !r.inCell) rowBad[w].push(`${cur}「${r.name}」の額「${r.v}」: ${r.lines}行${r.inCell ? '' : '・欄の外'}`);
          }
          for (const role of ['cap', 'fo']) {
            const [x, y] = rows.filter(r => r.role === role);
            if (x && y && x.cell.l < y.cell.r - 0.5 && y.cell.l < x.cell.r - 0.5 && x.cell.t < y.cell.b - 0.5 && y.cell.t < x.cell.b - 0.5) rowBad[w].push(`${cur} ${q} ${role}: 左右の欄が重なる`);
          }
        }
      }
    }
    for (const w of PICK_W) {
      ok(!pickBad[w].wrap.length, `${w}px: 比較の写真のカードで、社名が1行に収まる（5社を左と右に1回ずつ）`, pickBad[w].wrap.join('\n      '));
      ok(!pickBad[w].hit.length, `${w}px: 入れ替えボタンが、社名・略号の札・矢印に掛からない`, pickBad[w].hit.join('\n      '));
      ok(!pickBad[w].mark.length, `${w}px: どのカードにも「選び直せる」目印がちょうど1つ出ている`, pickBad[w].mark.join('\n      '));
    }
    for (const w of ROW_W) ok(!rowBad[w].length, `${w}px: どの通貨でも、年収の欄の額が1行で欄の中に収まり、左右の欄が重ならない（欄の中に社名を書かない ── 読み上げにだけ）`, rowBad[w].slice(0, 8).join('\n      '));
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    await c();
  }

  /* R3 掲載している全社の社名（★2026-10-25 段階5 compare-all-4・CA-3b1 ── 上の「狭い画面で社名が語の途中で折れない／入れ替えボタンが社名と
     略号の札に掛からない」を、先行5社から掲載している全社へ広げる）。1枚のページで、4つの大きさごとに、全社を2社ずつ並べ替えて
     （正本の順に 1・2社目、3・4社目 … と、その左右を入れ替えたもの ── どの会社も左と右に1回ずつ、札・年収の行・「詳しく」に立つ。
     3行の社名が右の札に立っても入れ替えボタンに掛からないことまで見るため）、両側を測る：
       a) 写真の無い会社の札（.cr-opt-x）の社名は正本の字（SALARY の ja）・2行まで（374px 以下は3行まで）。語の途中で折れるのは、その1語だけで
          社名の箱より長いときだけ（語の切れ目 ＝「・」の後ろ・空白・「（」の前。行は字ごとの四角で数え、1語の幅は同じ字の写しを折らずに札の中に
          置いて測る）。そういう社名は大きさごとに LONG に集めて出す ── 390px と 1001px では1つも無いこと。
       b) その札の「選び直せる」印（札の中の ▼ ── ★WP-compare-all-12 から 352px 以上は社名の中・351px まではロゴの段）はちょうど1つ・
          社名の字とロゴの段とその ▼ が、まんなかの入れ替えボタン（丸）に掛からない・
          札にロゴが在る・2枚の札の高さが同じ（±1px）。
       c) 先行5社のほかの会社の年収の行の社名（.cr-row-co）と「詳しく」の社名（.cr-go-n）は 2行まで（374px 以下は3行まで）・はみ出さない・
          その行の額（.cr-row-v）が行の外へ出ない（先行5社は上の1行の検査）。
     それから、行の額の字がいちばん長くなる通貨（PVCurrency.rates から、ページの中で選ぶ ── 円は除く。同じ長さなら字の合計が長いほう）にして、
     もう1周 c) だけを測る。最後に円へ戻す。 */
  head('掲載している全社の社名（札・年収の行・「詳しく」）');
  {
    const { page: p, close: c } = await open('?view=compare', 390, 680);
    await settle(p);
    const PAIRS = Array.from({ length: Math.ceil(ALLK.length / 2) }, (_, i) => [ALLK[2 * i], ALLK[2 * i + 1] || ALLK.find(s => s !== ALLK[2 * i])])
      .flatMap(([a, b]) => [[a, b], [b, a]]);
    const SIZES = [[320, 568], [360, 640], [390, 680], [1001, 800]];
    const JA = Object.fromEntries(ALLK.map(s => [s, SALARY[s].ja]));
    const measure = (w, plates) => p.evaluate((FIVE_, JA, w, plates) => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]');
      const on = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const most = w < 375 ? 3 : 2, bad = [], long = [];
      /* 字ごとの四角と行の番号（空白は数えない）。 */
      const chars = el => {
        const out = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) for (let i = 0; i < n.nodeValue.length; i++) {
          const ch = n.nodeValue[i];
          let r = null;
          if (ch.trim()) { const g = document.createRange(); g.setStart(n, i); g.setEnd(n, i + 1); r = [...g.getClientRects()].find(x => x.width > 0.5) || null; }
          out.push({ ch, r, line: -1 });
        }
        let line = -1, top = null;
        for (const x of out) { if (!x.r) continue; if (top === null || x.r.top - top > 6) { line++; top = x.r.top; } x.line = line; }
        return out;
      };
      const linesOf = cs => cs.reduce((m, x) => Math.max(m, x.line + 1), 0);
      const cut = (t, i) => i <= 0 || i >= t.length || t[i - 1] === '・' || !t[i - 1].trim() || !t[i].trim() || t[i] === '（';
      const wordAt = (t, k) => { let a = k, z = k + 1; while (!cut(t, a)) a--; while (!cut(t, z)) z++; return t.slice(a, z).trim(); };
      /* 行が替わる所のうち、語の切れ目でない所（そこから始まる字の番号）。 */
      const inner = cs => { const t = cs.map(x => x.ch).join(''), out = []; let prev = null;
        cs.forEach((x, k) => { if (!x.r) return; if (prev && x.line > prev.line && !cut(t, k)) out.push(wordAt(t, k)); prev = x; });
        return out; };
      const widthOf = (host, el, word) => {
        const cs = getComputedStyle(el), s = document.createElement('span');
        s.textContent = word;
        s.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap';
        for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'fontFeatureSettings', 'fontKerning']) s.style[k] = cs[k];
        host.appendChild(s); const wd = s.getBoundingClientRect().width; s.remove(); return wd;
      };
      const btn = V.querySelector('.cr-swap'), sw = btn ? btn.getBoundingClientRect() : null;
      const hit = x => { const cx = sw.left + sw.width / 2, cy = sw.top + sw.height / 2; return sw.width / 2 - Math.hypot(Math.max(x.left - cx, 0, cx - x.right), Math.max(x.top - cy, 0, cy - x.bottom)); };
      if (plates) {
        const sides = [...V.querySelectorAll('.cr-side')].map(sd => [...sd.querySelectorAll('.cr-opt')].filter(on));
        if (sides.length !== 2 || sides.some(l => l.length !== 1)) bad.push(`見えている札 ${sides.map(l => l.length).join('・')}枚`);
        const hs = sides.map(l => l[0]).filter(Boolean).map(o => o.querySelector('.cr-opt-p').getBoundingClientRect().height);
        if (hs.length === 2 && Math.abs(hs[0] - hs[1]) > 1) bad.push(`札の高さ ${hs.map(h => Math.round(h)).join(' / ')}`);
        /* ★2026-10-25 オーナー「航空会社名のカードももっと小さくていい。大きすぎる」（WP-compare-all-11 の LEAD AMENDMENT ── R3 の高さの当て直し）：
           札（色の線と枠を含む .cr-side）は 760px から 64px まで・スマホは 72px まで（374px 以下で3行の社名が出ているときだけ 84px まで）。
           前は写真の無い札を 140px / 168px に高くして、社名を入れ替えボタンの帯より下に置いていた ── いまは低い札のまま、下の入れ替えボタンの検査が同じ強さで見る。 */
        const sideH = Math.max(...[...V.querySelectorAll('.cr-side')].map(sd => sd.getBoundingClientRect().height));
        const three = sides.map(l => l[0]).filter(Boolean).some(o => linesOf(chars(o.querySelector('.cr-opt-n'))) >= 3);
        const capH = w >= 760 ? 64 : three && w < 375 ? 84 : 72;
        if (sideH > capH + 0.5) bad.push(`札の高さ ${Math.round(sideH)}px（${capH}px まで）`);
        for (const o of sides.map(l => l[0]).filter(x => x && x.classList.contains('cr-opt-x'))) {
          const s = o.dataset.airline, n = o.querySelector('.cr-opt-n'), t = o.querySelector('.cr-opt-t'), lg = o.querySelector('.cr-opt-lg');
          if (t.textContent !== JA[s]) bad.push(`${s}: 札の社名「${t.textContent}」`);
          const cs = chars(t), lines = linesOf(cs), box = n.getBoundingClientRect().width;
          if (lines > most) bad.push(`${s}: 札の社名 ${lines}行`);
          for (const wd of inner(cs)) { if (widthOf(n, t, wd) > box + 0.5) long.push(s); else bad.push(`${s}: 札の社名が語の途中で折れる（「${wd}」は箱 ${Math.round(box)}px に入る）`); }
          /* ★2026-10-25 WP-compare-all-12（同じ強さの当て直し ── リード L2）：写真の無い札の ▼ は2か所（ロゴの段と社名の中）に在り、出すのは
             幅で1つ（352px からは社名の後ろ ── 写真の札と同じ所・351px まではロゴの段）。前はロゴの段の中だけを数えていた ── いまは札の中で
             見えている ▼ をちょうど1つ。その ▼ も、入れ替えボタンに掛からないか測る。 */
          const ics = [...o.querySelectorAll('.cr-ic')].filter(on);
          if (ics.length !== 1) bad.push(`${s}: 「選び直せる」印 ${ics.length}つ`);
          if (!lg.querySelector('.pvg-logo')) bad.push(`${s}: 札にロゴが無い`);
          if (!sw) { bad.push('入れ替えボタンが無い'); continue; }
          /* ロゴの段は広い画面では display:contents（箱を持たない ── 箱で測ると何も測らずに通る）。箱が無いときは、段の中の見えている部品を
             1つずつ測る。部品が1つも見えなければ赤。 */
          const lgParts = lg.getClientRects().length ? [lg] : [...lg.children].filter(on);
          if (!lgParts.length) bad.push(`${s}: ロゴの段の部品が見えない`);
          const over = [...cs.filter(x => x.r).map(x => ['社名', hit(x.r)]), ...lgParts.map(e => ['ロゴの段', hit(e.getBoundingClientRect())]),
            ...ics.map(e => ['印', hit(e.getBoundingClientRect())])].filter(x => x[1] > 0);
          if (over.length) bad.push(`${s}: 入れ替えボタンが${[...new Set(over.map(x => x[0]))].join('・')}に掛かる（${Math.round(Math.max(...over.map(x => x[1])) * 10) / 10}px）`);
        }
      }
      for (const el of V.querySelectorAll('.cr-row-co, .cr-go-n')) {
        if (!on(el)) continue;
        const s = (el.closest('[data-airline]') || {}).dataset?.airline;
        if (!s || FIVE_.includes(s)) continue;
        const kind = el.matches('.cr-row-co') ? '年収の行' : '「詳しく」', lines = linesOf(chars(el));
        /* ★2026-10-25 オーナー P12.110（WP-compare-all-11・同じ強さの当て直し）：スマホの年収の板では、行の社名と足の社名を欄の中に書かない
           （上の札が言う）── 読み上げにだけ残す字（画面に出ない ＝ 折れも切れもしない）。その字は正本の社名そのもの（読み上げで、どの会社の額か・
           どの会社のページか分かる）。画面に出ている社名は今までどおり。額が行（欄）の外へ出ないことも今までどおり。 */
        const sr = (() => { const c = getComputedStyle(el), r = el.getBoundingClientRect(); return c.position === 'absolute' && c.clipPath === 'inset(50%)' && r.width <= 1 && r.height <= 1; })();
        if (sr && el.textContent.trim() !== JA[s]) bad.push(`${s}: ${kind}の読み上げの社名「${el.textContent.trim()}」`);
        if (!sr && lines > most) bad.push(`${s}: ${kind}の社名 ${lines}行`);
        if (!sr && el.scrollWidth > el.clientWidth + 1) bad.push(`${s}: ${kind}の社名がはみ出す（${el.scrollWidth} / ${el.clientWidth}）`);
        if (el.matches('.cr-row-co')) {
          const row = el.closest('.cr-row'), v = row.querySelector('.cr-row-v');
          /* ★P12.110：スマホの欄では額の箱（.cr-row-v）が欄の幅いっぱいなので、箱ではなく字そのもの（中の字の範囲）で測る。 */
          const g = document.createRange(); g.selectNodeContents(v);
          const vr = g.getBoundingClientRect(), rr = row.getBoundingClientRect();
          if (Math.max(vr.right, v.getBoundingClientRect().right) > rr.right + 0.5 || vr.left < rr.left - 0.5) bad.push(`${s}: 額「${v.textContent.trim()}」が行の外`);
        }
      }
      return { bad, long };
    }, FIVE, JA, w, plates);
    const walk = async (w, plates, cur) => {
      const bad = [], long = new Set();
      for (const [a, b] of PAIRS) {
        await p.evaluate((a, b) => window.PVCareer.replace({ view: 'compare', a, b }), a, b);
        const got = await p.evaluate(() => location.search);
        if (got !== `?view=compare&a=${a}&b=${b}`) { bad.push(`${a}|${b}: 開いたのは ${got}`); continue; }
        const m = await measure(w, plates);
        bad.push(...m.bad.map(x => `${cur ? cur + ' ' : ''}${a}|${b} ${x}`));
        m.long.forEach(s => long.add(s));
      }
      return { bad, long: [...long] };
    };
    for (const [w, h] of SIZES) {
      await p.setViewport({ width: w, height: h });
      const r = await walk(w, true);
      console.log(`    LONG ${w}px: ${r.long.join(', ') || 'なし'}`);
      const longBad = [390, 1001].includes(w) && r.long.length ? [`1語が箱より長い社名 ${r.long.join(', ')}（この幅では無いはず）`] : [];
      ok(!r.bad.length && !longBad.length,
         `${w}px: 掲載している全社の社名が、札・年収の行・「詳しく」で切れない・語の途中で折れない（1語が箱より長いときだけ）・入れ替えボタンに掛からない`,
         [...longBad, ...r.bad].slice(0, 8).join('\n      '));
    }
    const WIDEST = await p.evaluate(() => {
      const C = window.PVCurrency;
      let best = null;
      for (const cur of Object.keys(C.rates).filter(x => x !== 'JPY')) {
        C.set(cur);
        const t = [...document.querySelectorAll('#cr .cr-cmp .cr-row-v')].map(e => e.textContent.trim());
        const sc = [Math.max(...t.map(x => x.length)), t.reduce((n, x) => n + x.length, 0)];
        if (!best || sc[0] > best.sc[0] || (sc[0] === best.sc[0] && sc[1] > best.sc[1])) best = { cur, sc };
      }
      return best ? best.cur : null;
    });
    await p.evaluate(x => window.PVCurrency.set(x), WIDEST);
    for (const [w, h] of SIZES) {
      await p.setViewport({ width: w, height: h });
      const r = await walk(w, false, WIDEST);
      ok(!!WIDEST && !r.bad.length, `${w}px・${WIDEST}: 年収の行・「詳しく」の社名と額が切れない`, r.bad.slice(0, 8).join('\n      '));
    }
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    await c();
  }

  /* R4（★2026-10-25 段階5 compare-all-4・CA-3b1 ── 状態を1回だけ見る）：先行5社のほかの会社どうし（united|delta）を直に開くと、2枚とも写真の無い会社の
     札（その会社の社名とロゴ）で、年収の行はその2社。投稿先だけの会社（OPS ── 年収を載せない会社。台帳から読む）と知らない名前の住所は、
     既定の2社へ直る（住所も直る）。
     ★2026-10-26 段階5 compare-all-14（P12.122・強めた当て直し）：2社とも台帳に写真が在るようになった ── その札の地に、その会社の台帳の1枚目の写真
     （career.js がカードの島から置く）。写真の説明・選び直し・写真の無い会社・クレジットは assert-career-live.mjs の場面 plates が日英 × 2つの大きさで見る。 */
  head('先行5社のほかの会社どうし・比較に出せない会社の住所');
  {
    const { page: p, close: c } = await open('?view=compare&a=united&b=delta', 1280, 800);
    const plates = () => p.evaluate(() => [...document.querySelectorAll('#cr .cr-cmp .cr-side')].map(sd => [...sd.querySelectorAll('.cr-opt')]
      .filter(o => o.getClientRects().length).map(o => [o.classList.contains('cr-opt-x'), o.dataset.airline, (o.querySelector('.cr-opt-t') || {}).textContent || '', !!o.querySelector('.cr-opt-lg .pvg-logo'),
        [...o.querySelectorAll('.cr-opt-p img')].filter(i => !i.closest('.pvg-logo')).map(i => i.getAttribute('src')).join(' ')])));
    const g = await shown(p), pl = await plates();
    ok(same(pl, [[[true, 'united', name('united'), true, photoSrc(primary('united'))]], [[true, 'delta', name('delta'), true, photoSrc(primary('delta'))]]]) && same(g.rows, ROLES.map(() => ['united', 'delta'])),
       '先行5社のほかの2社を並べると、2枚とも写真の無い会社の札（社名とロゴ）で、地にその会社の台帳の1枚目の写真・年収の行はその2社', JSON.stringify({ plates: pl, rows: g.rows }));
    const OPS0 = Object.keys(OPS)[0];
    await go(p, `?view=compare&a=${OPS0}&b=zzz`);
    const q = await search(p), g2 = await shown(p);
    ok(!!OPS0 && !(OPS0 in SALARY) && q === `?view=compare&a=${PAIR[0]}&b=${PAIR[1]}` && same(g2.rows, ROLES.map(() => PAIR)),
       `比較に出せない会社（投稿先だけの ${OPS0}・知らない名前）の住所は、既定の2社（${PAIR.map(name).join('・')}）へ直る`, JSON.stringify({ q, rows: g2.rows }));
    await c();
  }

  /* T-A0b'（★2026-10-25 段階5 compare-all-4・CA-A20 ── 先行5社のほかの会社を選べるようになって、片方にだけ在る箱が初めて出る）：
     片方の会社にだけ在る箱（公表額の一覧・家賃の箱）は、その会社の列に置く（もう片方の列は空ける）・2社とも無ければ、見出しごと出さない
     （家賃の節・税の行・写真のクレジットも）。「会社が公表している金額」の箱は、一覧を持つ会社が並べた2社に1社も無ければ出さない
     （2026-10-22 LEAD AMENDMENT。先行5社のうち一覧を持たない会社のカードは社名だけ）。1280×800。 */
  head('片方の会社にだけ在る箱は、その会社の列（2社とも無ければ見出しごと出さない）');
  {
    const { page: p, close: c } = await open('', 1280, 800);
    const boxes = () => p.evaluate(() => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]');
      const vis = el => !!el && el.getClientRects().length > 0;
      const one = sel => {
        const b = V.querySelector(sel);
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { shown: vis(b), only: b.getAttribute('data-only'), mid: r.left + r.width / 2,
          kids: [...b.children].filter(e => e.dataset.airline && vis(e)).map(e => { const x = e.getBoundingClientRect(); return { s: e.dataset.airline, l: x.left, r: x.right }; }) };
      };
      /* ★2026-10-25 P12.106（同じ強さの当て直し）：税の行の箱（.cr-taxes）は無くなり、税の扱いの字は年収の板の足の会社ごとの1行（.cr-ft）の中。
         「箱が見えている」＝ 税の扱いの字が1つでも見えている・kids ＝ 字の見えている会社の1行（並びの順）。 */
      const taxes = (() => { const ks = [...V.querySelectorAll('.cr-ft')].filter(e => vis(e) && vis(e.querySelector('.cr-tx')));
        return { shown: ks.length > 0, only: null, mid: 0, kids: ks.map(e => ({ s: e.dataset.airline })) }; })();
      /* ★WP-compare-all-13 F2：家賃の箱の無い会社の列の「資料を確認できていません」の箱（見えている時だけ）── 誰のぶん・社名・字・列（家賃の節の中点の左か右か） */
      const nb = V.querySelector('.cr-rentbs > .cr-rentn'), nbox = V.querySelector('.cr-rentbs');
      const none = nb && vis(nb) ? (() => { const r = nb.getBoundingClientRect(), B = nbox.getBoundingClientRect();
        return { s: nb.getAttribute('data-none'), name: nb.querySelector('.cr-rentn-n').textContent, t: nb.querySelector('.cr-rentn-t').textContent,
          side: r.right <= B.left + B.width / 2 + 1 ? 'a' : r.left >= B.left + B.width / 2 - 1 ? 'b' : '?' }; })() : null;
      return { cards: one('.cr-cards'), rents: one('.cr-rentbs'), wrap: vis(V.querySelector('.cr-rents[data-wrap]')), taxes, credits: one('.cr-credits'), none };
    });
    const right = (x, s) => !!x && x.shown && x.only === 'b' && x.kids.length === 1 && x.kids[0].s === s && x.kids[0].l >= x.mid - 1;
    const left = (x, s) => !!x && x.shown && x.only === 'a' && x.kids.length === 1 && x.kids[0].s === s && x.kids[0].r <= x.mid + 1;
    const gone = x => !!x && !x.shown;
    /* もう片方の列：その会社の名前と、会社ページの暮らしの板と同じ1行（家賃の箱の無い列に置く）。null ＝ 出さない（2社とも箱が在る・
       2社とも無い・会社ページに家賃の額が在る会社 ── 資料が在るのに「確認できていません」と言わない）。 */
    const noneAt = (g, s, side) => !!g.none && g.none.s === s && g.none.name === name(s) && g.none.t === '家賃の資料を確認できていません' && g.none.side === side;
    const SCENES = [
      ['emirates', 'jal', g => right(g.rents, 'jal') && g.wrap && gone(g.cards) && g.taxes.shown && same(g.taxes.kids.map(k => k.s), ['emirates', 'jal']) && !g.taxes.only
        && noneAt(g, 'emirates', 'a')],
      ['jal', 'united', g => left(g.rents, 'jal') && g.wrap && gone(g.cards) && noneAt(g, 'united', 'b')],
      ['emirates', 'cathay-pacific', g => right(g.cards, 'cathay-pacific') && right(g.rents, 'cathay-pacific') && noneAt(g, 'emirates', 'a')],
      ['cathay-pacific', 'united', g => left(g.cards, 'cathay-pacific') && left(g.rents, 'cathay-pacific') && noneAt(g, 'united', 'b')],
      /* ★2026-10-26 段階5 compare-all-14（P12.122・同じ強さの当て直し）：united と delta に台帳の写真が付いた ── united は CC0（クレジットを出さない）・
         delta は示すことが条件の写真（Public domain）なので、写真のクレジットは delta の1つだけが見える。2社とも条件のある写真が無いときに段ごと
         出さないことは、条件の無い写真の2社（united|american ── どちらも CC0）で見る。 */
      ['united', 'delta', g => gone(g.cards) && gone(g.rents) && !g.wrap && gone(g.taxes) && !!g.credits && g.credits.shown && same(g.credits.kids.map(k => k.s), ['delta']) && g.none === null],
      ['united', 'american', g => gone(g.credits)],
      ['jal', 'peach', g => left(g.rents, 'jal') && g.wrap && g.none === null],
      ['jal', 'ana', g => g.rents && g.rents.shown && !g.rents.only && g.rents.kids.length === 2 && g.none === null],
    ];
    for (const [a, b, want] of SCENES) {
      await go(p, `?view=compare&a=${a}&b=${b}`);
      await settle(p);
      const g = await boxes();
      ok(want(g), `${a}|${b}: 公表額の一覧が片方の会社にだけ在るときは、その会社の列に置く・2社とも無いときは見出しごと出さない（家賃の箱・節・税・クレジットも）・家賃の箱の無い会社の列には会社ページと同じ「家賃の資料を確認できていません」（会社ページに家賃の額が在る会社には出さない）`,
         JSON.stringify(g));
    }
    await c();
  }

  /* ── ⑦ 大きさ ───────────────────────────────────────────────── */
  head('比較 → カード保存の入口が、いま並べている2社を連れていく');
  {
    const { page: p, close: c } = await open(`?view=compare&a=${DEEP[0]}&b=jal`);
    const to = () => p.evaluate(() => { const x = document.getElementById('cr-to-card'); return x ? x.getAttribute('href') : null; });
    const first = await to();
    ok(first === `${PAGE}?view=card&a=${DEEP[0]}&b=jal`, '開いたときの2社', String(first));
    await choose(p, 'b', 'ana');
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
  /* 写真の無い会社の札と、概要を持たない会社のカード（全社を開けるようにしたあと）。
     ★2026-10-26 段階5 compare-all-14（P12.122）：写真の無い会社の札にも、台帳に写真の在る会社は写真が出る（career.js）── 比較の2つは下の写真の検査にも入れる。 */
  const WIDE_VIEWS = ['?view=compare&a=united&b=delta', '?view=compare&a=jal&b=united', '?view=card&a=united'];
  const VIEWS = [...OLD_VIEWS, ...DEEP_VIEWS, ...WIDE_VIEWS];
  /* 写真の出る画面（詳細とカードは、ここでは見ない ── 詳細に写真は無く、カードの写真は画像の中へ描く）。
     ★2026-10-26（P12.122）：先行5社のほかの会社の札の写真（CC0 と Public domain の united|delta・CC BY の emirates と先行5社の jal・CC BY の2社 skymark|qantas）。 */
  const PHOTO_VIEWS = [...OLD_VIEWS, ...DEEP.flatMap(s => [`?airline=${s}&tab=life`, `?airline=${s}&stay=NRT`, `?view=compare&a=${s}&b=jal`]),
    ...WIDE_VIEWS.filter(q => q.startsWith('?view=compare')), '?view=compare&a=emirates&b=jal', '?view=compare&a=skymark&b=qantas'];
  /* 押せるものの種類。ここに無い形のものが増えたら落とす（hover / active を付け忘れる）。 */
  const MAIN = '.cr-tile, .cr-back, .cr-btn, .cr-swap, .cr-pickb, .cr-pk, .cr-sheet-x, summary, .cr-link, .cr-card-n, '
    + '.cr-tab, a.cr-bar, .cr-ent, .cr-ask, .cr-dest, .cr-job, .crl-cta, .crl-link, .crl-retry, .crs-act, .crs-ent, .crc-opt, .crc-sel, .crc-th, .crc-btn, .pv-gg';
  const INLINE = '.cr-credits a, .cr-srcs a';
  for (const [w, h] of [[320, 568], [390, 680], [768, 1024], [1280, 800]]) {
    const { page: p, close: c } = await open('', w, h);
    const bad = [], past = [];
    /* 測る範囲（ROOT）。既定は見えている画面。★2026-10-25 段階5 compare-all-3（R2）：比較の画面では、1社目の札を押して開いた
       選ぶ面（'#cr-sheet' ── どの画面の外にも在る #cr の子）も同じ物差しで測る。面では最初の1画面と年収の箱は測らない（null）。 */
    const measure = (ROOT = '#cr .cr-view:not([hidden])') => p.evaluate((MAIN, INLINE, ROOT) => {
        const v = document.querySelector(ROOT), inView = ROOT !== '#cr-sheet';
        const on = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        /* 最初の1画面に年収が入っているか（開く前に測る）。 */
        /* 深く作った会社の年収の箱は、推定の2行（押せる棒）＋目盛＋税の1行。「年収が入っている」は推定の2行で測る。
           箱の下端（税の1行）まで入らない大きさは落とさずに、下で1行ずつ知らせる（黙って緑にしない）。 */
        const deep = inView ? v.querySelector('.cr-pay-deep') : null;
        const ests = deep ? [...deep.querySelectorAll('a.cr-bar.cr-bar-est')] : [];
        const first = !inView ? null : ests.length ? ests[ests.length - 1] : v.querySelector('.cr-pay') || v.querySelector('.cr-pair');
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
        for (const el of v.querySelectorAll('.cr-num-v, .cr-bar-v, .cr-row-v, .cr-fig b, .cr-tile-n, .cr-opt-n, .cr-hero-n, .cr-row-co, .cr-pk-n, .cr-pk-c')) {
          if (!on(el)) continue;
          /* ★P12.110：読み上げにだけ残す字（スマホの比較の年収の板の社名 ── 1px に切り取った箱）は画面に出ないので、はみ出しを測らない。 */
          if ((s => s.position === 'absolute' && s.clipPath === 'inset(50%)')(getComputedStyle(el)) && el.getBoundingClientRect().width <= 1) continue;
          let host = el.parentElement;
          while (host && !host.getClientRects().length) host = host.parentElement;   // display:contents の親は箱を持たない
          const b = el.getBoundingClientRect(), box = host.getBoundingClientRect();
          if (b.right > innerWidth + 0.5 || b.left < -0.5 || el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) cut.add(`${el.className} 「${el.textContent.trim().slice(0, 14)}」`);
          if (b.right > box.right + 1 && !el.matches('.cr-num-v')) cut.add(`${el.className} が箱の外`);
        }
        const sel = [...v.querySelectorAll('select, input')].map(s => parseFloat(getComputedStyle(s).fontSize));
        return {
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fold, deepEnd, vh: innerHeight, small: [...small], tap: [...tap], stray: [...stray], cut: [...cut], sel,
        };
      }, MAIN, INLINE, ROOT);
    const judge = (m, at) => {
      if (m.noEst) { bad.push(`${at}: 推定年収の行が見つからない`); return; }
      if (m.deepEnd !== null && w >= 390 && m.deepEnd > m.vh) past.push(`${at}: 年収の箱の下端（税の1行）までは最初の1画面に収まらない（下端 ${m.deepEnd} / 画面 ${m.vh}）`);
      if (m.over > 0) bad.push(`${at}: 横に ${m.over}px 溢れる`);
      if (m.fold !== null && w >= 390 && m.fold > m.vh) bad.push(`${at}: 年収が最初の1画面に入らない（下端 ${m.fold} / 画面 ${m.vh}）`);
      if (m.small.length) bad.push(`${at}: 12px 未満の字 ${m.small.join(', ')}`);
      if (m.tap.length) bad.push(`${at}: 44px 未満の押す場所 ${m.tap.join(', ')}`);
      if (m.stray.length) bad.push(`${at}: 知らない形の押せるもの ${m.stray.join(' ')}`);
      if (m.cut.length) bad.push(`${at}: 字がはみ出す ${m.cut.join(', ')}`);
      if (m.sel.some(f => f < 16)) bad.push(`${at}: 選ぶ欄の字が 16px 未満（iOS が画面ごと拡大する）`);
    };
    let sheetDone = false;
    for (const q of VIEWS) {
      await go(p, q);
      await settle(p);
      judge(await measure(), `${w}×${h} ${q || '（入口）'}`);
      if (sheetDone || !q.startsWith('?view=compare')) continue;
      /* その大きさの最初の比較の画面で1回：1社目の札を押して選ぶ面を開き（動きが終わるまで待つ）、面を同じ物差しで測って、Esc で閉じる
         （面の中身はどの2社でも同じ会社の並び ── 比較の画面ごとに測り直さない）。 */
      sheetDone = true;
      const at = `${w}×${h} ${q} の選ぶ面`;
      await p.click('#cr-open-a');
      if (await p.waitForSelector('#cr-sheet[open]', { timeout: 5000 }).then(() => true, () => false)) {
        await p.evaluate(() => Promise.all(document.getElementById('cr-sheet').getAnimations().map(x => x.finished.catch(() => {}))));
        judge(await measure('#cr-sheet'), at);
      } else bad.push(`${at}: 1社目の札を押しても開かない`);
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.getElementById('cr-sheet').open, { timeout: 5000 }).catch(() => {});
    }
    ok(!bad.length, `${w}×${h}: ${VIEWS.length}画面とも（比較の画面は選ぶ面も） 溢れない・${w >= 390 ? '年収が最初の1画面に入る・' : ''}字 12px 以上・押す場所 44px 以上`, bad.join('\n      '));
    for (const x of past) console.log('    ⚠ ' + x);
    await c();
  }

  /* ★2026-10-25 オーナー P12.106（WP-compare-all-10）「2社比較のページの年収比較のカード大きすぎるよ。会社名とこの年収比較でpc 画面いっぱいに
     使うの勿体なさすぎるし、いけてない。もっと利用者のこと考えて。」
     (B) 最初の1画面：PC（1440×900・1280×800・1001×700 ── 1001 は左のメニューが出るいちばん狭い幅）では、2枚の札・年収の板の下端・
         「提出された年収」の見出しの頭が最初の1画面に入る。スマホ（390×680）では、2枚の札と機長の2行が入る。2社は写真の在る会社と無い会社
         （jal｜united ── 税の扱いの字が片方にだけ在る組）。札と板の高さは行に書き出すだけ（判定しない ── 大きさは見た目の決まり C）。
     (A) 行の札：並べた行がどれも推定のあいだは、見出しの1行「推定年収　機種の指定なし」が1回だけ見え、行の札（「推定」）は行の中に在るが
         画面には出ない（読み上げにだけ残す ── 1行ずつ聞いても推定と分かる）。推定でない種類の行（data-kind）が見えている板では、どの行も
         自分の札を見せ、見出しの1行は出さない（推定でない額に「推定年収」と言わない）── 台帳にいまそういう行は無いので、ページの上で1行を
         推定でない種類（求人の掲載額）に替えた写しで確かめ、元に戻すと最初の姿へ戻ることも見る。広い画面とスマホの2つの幅で。
     ★2026-10-25 オーナー P12.110「スマホの画面も比較の年収のカードデカすぎるだろ。画面いっぱいじゃねーか」（WP-compare-all-11・(B) を広げた）：
         スマホ（390×680・375×667・360×640）でも、2枚の札・年収の板の全部・「提出された年収」の見出しの頭が最初の1画面に入る。いちばん狭い
         320×568 では、2枚の札と、機長・副操縦士の両方の額が入る。(A) の札の決まりは、スマホの2列の欄の中でも同じ（札は欄の中に収まる）。 */
  head('比較の最初の1画面（PC とスマホ）と行の札（推定年収は見出しに1回）');
  {
    const { page: p, close: c } = await open('?view=compare&a=jal&b=united', 1440, 900);
    /* ★2026-10-25 WP-compare-all-12：タブレット（768×1024・820×1180 ── スマホと同じ2列の板）でも、2枚の札・年収の板の全部・「提出された年収」の見出しの頭。 */
    for (const [w, h] of [[1440, 900], [1280, 800], [1001, 700], [820, 1180], [768, 1024], [390, 680], [375, 667], [360, 640], [320, 568]]) {
      await p.setViewport({ width: w, height: h });
      await p.evaluate(() => window.scrollTo(0, 0));
      await settle(p);
      const m = await p.evaluate(() => {
        const V = document.querySelector('#cr .cr-view[data-view="compare"]');
        const R = el => (el ? el.getBoundingClientRect() : null);
        const panel = R(V.querySelector('.cr-panel')), sub = R(V.querySelector('.cr-subpay .cr-h2')), pick = R(V.querySelector('.cr-pick'));
        const caps = [...V.querySelectorAll('.cr-pair[data-role="cap"] .cr-row')].filter(r => r.getClientRects().length).map(R);
        const figs = [...V.querySelectorAll('.cr-pair .cr-row')].filter(r => r.getClientRects().length).map(r => R(r.querySelector('.cr-row-v')));
        const n = v => (v == null ? null : Math.round(v));
        return { vh: innerHeight, y: Math.round(scrollY), pickB: n(pick && pick.bottom), pickH: n(pick && pick.height), panelB: n(panel && panel.bottom),
          panelH: n(panel && panel.height), subT: n(sub && sub.top), caps: caps.length, capB: caps.length ? n(Math.max(...caps.map(r => r.bottom))) : null,
          figs: figs.length, figB: figs.length ? n(Math.max(...figs.map(r => r.bottom))) : null };
      });
      const whole = w >= 360;
      const good = m.y === 0 && m.pickB != null && m.pickB <= m.vh
        && (whole ? m.panelB != null && m.panelB <= m.vh && m.subT != null && m.subT <= m.vh : m.figs === 4 && m.figB <= m.vh);
      ok(good, whole ? `${w}×${h}: 比較（jal｜united）の最初の1画面に、2枚の札・年収の板の全部・「提出された年収」の見出しの頭が入る`
        : `${w}×${h}: 比較（jal｜united）の最初の1画面に、2枚の札と、機長・副操縦士の両方の額が入る`, JSON.stringify(m));
      console.log(`    （${w}×${h}）札の高さ ${m.pickH}px・年収の板 ${m.panelH}px・板の下端 ${m.panelB} ／「提出された年収」の頭 ${m.subT} ／ 額の下端 ${m.figB} ／ 画面 ${m.vh}`);
    }
    const chips = () => p.evaluate(() => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]');
      const seen = el => {
        if (!el || !el.getClientRects().length) return false;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.clipPath === 'none';
      };
      const rows = [...V.querySelectorAll('.cr-pair .cr-row')].filter(r => !r.hidden);
      const tg = [...V.querySelectorAll('.cr-tgt')];
      return {
        /* ★P12.110：見えている札は、その行（スマホでは2列の欄）の中に収まる（inRow ── 見えていない札は null）。 */
        rows: rows.map(r => { const k = r.querySelector('.cr-row-k'), on = seen(k), a = on ? k.querySelector('.cr-tag').getBoundingClientRect() : null, b = r.getBoundingClientRect();
          return { s: r.dataset.airline, kind: r.dataset.kind || '', word: k ? k.textContent.trim() : null, shown: on, inRow: on ? a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5 : null }; }),
        tg: tg.length, tgShown: tg.filter(seen).length,
      };
    });
    const EST = TIERS.estimate.ja, OTHER = TIERS.offer_posting.ja;
    for (const [w, h] of [[1280, 800], [390, 680]]) {
      await p.setViewport({ width: w, height: h });
      const g0 = await chips();
      ok(g0.rows.length === 4 && g0.rows.every(r => !r.kind && r.word === EST && !r.shown) && g0.tg === 1 && g0.tgShown === 1,
         `${w}px 行がどれも推定の板：見出しの1行「推定年収　機種の指定なし」が1回だけ見え、行の札「${EST}」は4行とも行の中に在って画面には出ない（読み上げにだけ）`, JSON.stringify(g0));
      await p.evaluate(word => {
        const r = document.querySelector('#cr .cr-view[data-view="compare"] .cr-pair[data-role="cap"] .cr-row:not([hidden])');
        r.dataset.kind = 'offer_posting';
        r.querySelector('.cr-row-k .cr-tag').textContent = word;
      }, OTHER);
      const g1 = await chips();
      ok(g1.rows.length === 4 && g1.rows.filter(r => r.kind).length === 1 && g1.rows.every(r => r.shown && r.inRow && r.word === (r.kind ? OTHER : EST)) && g1.tg === 1 && g1.tgShown === 0,
         `${w}px 推定でない種類の行が見えている板（ページの上の写し）：4行とも自分の札（「${OTHER}」と「${EST}」）を、その行${w < 1000 ? '（2列の欄）' : ''}の中に見せ、見出しの1行「推定年収」は出さない`, JSON.stringify(g1));
      await p.evaluate(word => {
        const r = document.querySelector('#cr .cr-view[data-view="compare"] .cr-pair[data-role="cap"] .cr-row[data-kind]');
        delete r.dataset.kind;
        r.querySelector('.cr-row-k .cr-tag').textContent = word;
      }, EST);
      const g2 = await chips();
      ok(same(g2, g0), `${w}px 写しを元に戻すと、最初の姿（見出しに1回・行の札は読み上げにだけ）へ戻る`, JSON.stringify(g2));
    }
    await c();
  }

  /* ★2026-10-25 オーナー P12.110（WP-compare-all-11）：色の近い2社（エミレーツ｜JAL・スイス｜TAP ── どちらも赤）は、色のほかでも見分けられる。
     (A) 決まりは1つ ── 2社の会社の色（airlines-meta.js）の OKLab の距離が、生成側の NEAR（比較の画面の data-near-max）より小さいときだけ、
         比較の画面に data-near が立ち、右の会社（並びの2つ目）の 札の色の線は破線・棒は縁取り（inset の影）・点は輪（地が透明）になる。
         左の会社にも、色の離れた2社にも、何も付かない。組み合わせの一覧は持たない。座標（L・a・b を 100 倍して丸めた整数）は生成側が機長の行の
         data-lab に書く ── ここでは会社の色から作り直して全社ぶん突き合わせ、近い・遠いも作り直した座標で決める（生成側・career.js の計算を借りない）。
         棒に斜線の模様を使わない（このページで斜線の棒は「求人の上限」の印）。広い画面とスマホの2つの幅で、入れ替えたときも。 */
  head('色の近い2社（右の会社に、色のほかの手がかり）');
  {
    const META = (() => { const win = {}; new Function('window', read('airlines-meta.js'))(win); return win.PV_AIRLINES; })();
    const hex = s => (META.find(x => x.file === `airlines/${s}.html`) || {}).color || '';
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lab = h => {
      const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
        s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]
        .map(x => Math.round(x * 100) || 0);
    };
    const dist = (a, b) => { const x = lab(hex(a)), y = lab(hex(b)); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    const r3 = v => Math.round(v * 10) / 10;
    const capAt = CMP.indexOf('<div class="cr-pair" data-role="cap"'), foAt = CMP.indexOf('<div class="cr-pair" data-role="fo"');
    const LABS = [...CMP.matchAll(/<div class="cr-row" data-airline="([^"]+)"[^>]*\sdata-lab="([^"]*)"/g)].map(m => [m[1], m[2], m.index]);
    const labBad = LABS.filter(([s, v]) => v !== lab(hex(s)).join(' ')).map(([s, v]) => `${s}「${v}」≠ ${lab(hex(s)).join(' ')}`);
    ok(capAt > 0 && foAt > capAt && LABS.length === ALLK.length && LABS.every(x => x[2] > capAt && x[2] < foAt) && !labBad.length && same(LABS.map(x => x[0]).sort(), [...ALLK].sort()),
       `色の座標（data-lab）は機長の行にだけ・全社（${ALLK.length}社）ぶん・会社の色から作り直した座標と同じ`, `${LABS.length}本 ／ ${labBad.slice(0, 3).join(' ／ ')}`);
    ok(['emirates', 'jal', 'swiss', 'tap', 'united'].every(s => /^#[0-9a-f]{6}$/i.test(hex(s))) && dist('emirates', 'jal') < NEAR && dist('swiss', 'tap') < NEAR && dist('jal', 'united') >= NEAR,
       `オーナーの挙げた2組（エミレーツ｜JAL ${r3(dist('emirates', 'jal'))}・スイス｜TAP ${r3(dist('swiss', 'tap'))}）は NEAR ${NEAR} より近く、JAL｜ユナイテッド（${r3(dist('jal', 'united'))}）は遠い`);
    const SAMPLE = [['emirates', 'jal'], ['jal', 'emirates'], ['swiss', 'tap'], ['tap', 'swiss'], ['jal', 'united'], ['skymark', 'qantas'], ['jal', 'cathay-pacific'], ['ana', 'united']];
    const { page: p, close: c } = await open('?view=compare&a=emirates&b=jal', 1280, 800);
    const cues = () => p.evaluate(() => {
      const V = document.querySelector('#cr .cr-view[data-view="compare"]');
      const side = sd => { const o = [...V.querySelectorAll(`.cr-side[data-side="${sd}"] .cr-opt`)].find(x => !x.hidden); return o ? { s: o.dataset.airline, edge: getComputedStyle(o).borderBottomStyle } : null; };
      const per = s => {
        const fills = [...V.querySelectorAll('.cr-pair .cr-row:not([hidden]) .cr-fill')].filter(f => f.closest('.cr-row').dataset.airline === s).map(f => getComputedStyle(f));
        /* ★WP-compare-all-13 F2：家賃の節の点も（その会社の家賃の箱か、その会社の「資料を確認できていません」の箱 ── 見えているものだけ） */
        const rent = [...V.querySelectorAll('.cr-rentbs > .cr-rentb:not([hidden]), .cr-rentbs > .cr-rentn:not([hidden])')]
          .filter(b => b.getClientRects().length > 0 && (b.dataset.airline || b.getAttribute('data-none')) === s).map(b => b.querySelector('.cr-dot')).filter(Boolean);
        const dots = [...V.querySelectorAll(':is(.cr-pair, .cr-gos) > [data-airline]:not([hidden]) .cr-dot')].filter(d => d.closest(':is(.cr-pair, .cr-gos) > [data-airline]').dataset.airline === s)
          .concat(rent).map(d => getComputedStyle(d));
        return { fills: fills.length, hollow: fills.filter(x => /inset/.test(x.boxShadow)).length, stripe: fills.filter(x => /repeating-linear-gradient/.test(x.backgroundImage)).length,
          dots: dots.length, ring: dots.filter(x => /inset/.test(x.boxShadow) && x.backgroundColor === 'rgba(0, 0, 0, 0)').length };
      };
      const a = side('a'), b = side('b');
      return { max: V.getAttribute('data-near-max'), near: V.hasAttribute('data-near'), a, b, pa: a && per(a.s), pb: b && per(b.s) };
    });
    for (const [w, h] of [[1280, 800], [390, 680]]) {
      await p.setViewport({ width: w, height: h });
      const bad = [], seen = [];
      for (const [a, b] of SAMPLE) {
        await p.evaluate((a, b) => window.PVCareer.replace({ view: 'compare', a, b }), a, b);
        const g = await cues(), want = dist(a, b) < NEAR;
        const none = x => x && x.hollow === 0 && x.ring === 0 && x.stripe === 0 && x.fills === 2 && x.dots > 0;
        const cue = x => x && x.hollow === x.fills && x.fills === 2 && x.ring === x.dots && x.dots > 0 && x.stripe === 0;
        const right = g.max === String(NEAR) && g.near === want && g.a && g.b && g.a.s === a && g.b.s === b && g.a.edge === 'solid' && none(g.pa)
          && (want ? g.b.edge === 'dashed' && cue(g.pb) : g.b.edge === 'solid' && none(g.pb));
        seen.push(`${a}|${b}${want ? '（近い）' : ''}`);
        if (!right) bad.push(`${a}|${b} 距離 ${r3(dist(a, b))}: ${JSON.stringify(g)}`);
      }
      ok(!bad.length, `${w}px 色の近い2社だけ、右の会社の札の線は破線・棒は縁取り・点は輪（家賃の節の点も ── 斜線の模様は使わない）── 左の会社と、色の離れた2社には何も付かない（${seen.join('・')}）`, bad.slice(0, 3).join('\n      '));
    }
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
    /* ★2026-10-24 段階5 compare-all-1（E5.1 P1）：比較の行は全社ぶん（224 ── 数は正本から） */
    ok(n0.main === FIVE.length * ROLES.length && n0.rows === ALLK.length * ROLES.length && n0.det === DEEP.length * ROLES.length && !found.length,
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
          ok(x.fills === 1 && Math.abs(parseFloat(x.w) - avg(s, r) / SCALE(s) * 100) < 0.01 && !/[〜超]|上限|下限|目標/.test(x.top) && x.pub === 0,
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
          ok(!!y && y.text === yen(a) && y.tag === '推定' && y.look !== 'held' && Math.abs(y.w - a / SCALE(...want)) < 0.001,
            `${q}: カードの ${name(x.slug)} ${l} は推定年収 ${yen(a)}（「推定」の札・棒は額に比例）`, JSON.stringify(y && { text: y.text, tag: y.tag, look: y.look, w: y.w }));
          ok(!!y && (!y.lim || (/^〜/.test(y.lim.text) && /上限/.test(`${y.lim.tag}${y.lim.sub}`))),
            `${q}: カードの ${name(x.slug)} ${l} に公表した上限を載せるなら「〜」と「上限」の字つき`, JSON.stringify(y && y.lim));
        }
      }
    }
    /* R5（★2026-10-24 段階5 compare-all-2・E5.5）概要を持たない会社のカード（比較の行から読む）。額・札・棒は画面と同じ。
       生きた欄の中に置いた行は読まない。中身は上の5社の繰り返しと1文字も違わない（会社だけ united 単独と jal|united）。 */
    for (const want of [['united'], ['jal', 'united']]) {
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
          ok(!!y && y.text === yen(a) && y.tag === '推定' && y.look !== 'held' && Math.abs(y.w - a / SCALE(...want)) < 0.001,
            `${q}: カードの ${name(x.slug)} ${l} は推定年収 ${yen(a)}（「推定」の札・棒は額に比例）`, JSON.stringify(y && { text: y.text, tag: y.tag, look: y.look, w: y.w }));
          ok(!!y && (!y.lim || (/^〜/.test(y.lim.text) && /上限/.test(`${y.lim.tag}${y.lim.sub}`))),
            `${q}: カードの ${name(x.slug)} ${l} に公表した上限を載せるなら「〜」と「上限」の字つき`, JSON.stringify(y && y.lim));
        }
    }
    await go(p, '?view=card&a=united');
    const upU = await p.waitForFunction(() => window.PVCareerCard && window.PVCareerCard.model() && window.PVCareerCard.model().cards.length === 1, { timeout: 5000 })
      .then(() => true, () => false);
    const planted = !upU ? null : await p.evaluate(async () => {
      const pair = document.querySelector('#cr .cr-view[data-view="compare"] .cr-pair[data-role="cap"]');
      const real = pair.querySelector('.cr-row[data-airline="united"]');
      const live = document.createElement('div'); live.className = 'crl';
      const fake = real.cloneNode(true); fake.querySelector('.cr-row-v').textContent = 'PLANTED'; live.appendChild(fake);
      pair.insertBefore(live, pair.firstChild);
      await window.PVCareerCard.redraw();
      const text = window.PVCareerCard.model().cards[0].roles.cap.text;
      live.remove();
      return text;
    });
    ok(planted === yen(avg('united', 'cap')), 'カードは、生きた欄（.crl）の中の行を読まない（概要の無い会社）', String(planted));
    await c();
  }

  /* ── ①（続き）推定年収が 会社ページ・比較・カード で同じ字 ─────── */
  head('推定年収が 会社ページ・比較・カード で同じ字（全通貨・写真を替えても）');
  {
    /* ★2026-10-22 段階4 cmp-pay-3（T-E1・T-E2）。同じ会社・同じ職位の推定年収は、会社ページ（airlines/{slug}.html の大きい額）・
       比較（棒の行の額・隠れている行も）・保存するカード（PVCareerCard.model() の字）の3か所で、どの通貨でも1文字も違わない。
       円のときは、正本 SALARY の avg からこの検査が自分で作った ¥…万 とも同じ。カードの写真を替えても（p・p2）、職位の字は変わらない。
       壊して確かめる道具（配っているファイルは1つも触らない。このブラウザに渡す写しだけを、その場で替える）：
         --self-e1  会社ページ（先行5社の1社目）の機長の額を 1万 多くした写しを渡す → ここが赤
         --self-e2  カードの JS を「写真が2枚目以降のとき、もう一方の会社の職位を読む」写しにして渡す → ここが赤 */
    const SELF_E1 = process.argv.includes('--self-e1'), SELF_E2 = process.argv.includes('--self-e2');
    if (SELF_E1 || SELF_E2) console.log(`    ⚠ 壊して確かめる回（${[SELF_E1 && '--self-e1', SELF_E2 && '--self-e2'].filter(Boolean).join(' ')}）── この節が赤くなるのが正しい`);
    const swaps = [], swapBad = [];
    if (SELF_E1) swaps.push({ path: `airlines/${FIVE[0]}.html`, fn: t => {
      const was = `<p class="pvg-big">${yen(SALARY[FIVE[0]].cap.avg)}</p>`, a = t.indexOf('data-rank="cap"'), b = a < 0 ? -1 : t.indexOf('<p class="pvg-big">', a);
      if (b < 0 || !t.startsWith(was, b)) { swapBad.push(`${FIVE[0]} の機長の額が見つからない`); return t; }
      return t.slice(0, b) + `<p class="pvg-big">${yen(SALARY[FIVE[0]].cap.avg + 1)}</p>` + t.slice(b + was.length);
    } });
    if (SELF_E2) swaps.push({ path: 'career-card.js', fn: t => {
      const A = 'var photos = a.photos || [], roles = {}, axis = [];';
      if (t.split(A).length !== 2) { swapBad.push('career-card.js の readCard() の1行が見つからない'); return t; }
      return t.replace(A, () => `${A} if (photoIx > 0) for (var j = 0; j < list.length; j++) if (list[j].getAttribute('data-airline') !== slug) { sec = list[j]; break; }`);
    } });
    const ORIGIN = new URL(BASE).origin;
    const openAt = async rel => {
      const ctx = await browser.createBrowserContext();
      const pg = await ctx.newPage();
      pg.on('pageerror', e => trouble.push(`${rel}: ${e.message}`));
      pg.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) trouble.push(`${r.status()} ${r.url()}`); });
      await pg.setViewport({ width: 390, height: 680 });
      await pg.setRequestInterception(true);
      pg.on('request', async r => {
        if (NET_OFF.test(r.url())) return r.abort();
        const u = new URL(r.url()), sw = u.origin === ORIGIN && swaps.find(x => u.pathname === `/${x.path}`);
        if (!sw) return r.continue();
        try {
          const res = await fetch(r.url());
          return r.respond({ status: res.status, contentType: res.headers.get('content-type') || undefined, body: sw.fn(await res.text()) });
        } catch (e) { swapBad.push(`${sw.path}: ${e.message}`); return r.abort(); }
      });
      await pg.goto(`${BASE}/${rel}`, { waitUntil: 'load' });
      return { pg, close: () => ctx.close() };
    };
    const set = (pg, cur) => pg.evaluate(x => window.PVCurrency.set(x), cur);
    /* カードの材料（社名・写真・職位ごとの字）。 */
    const model = pg => pg.evaluate(() => {
      const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
      return m && m.cards ? m.cards.map(k => ({ slug: k.slug, photo: k.photo ? k.photo.src : null,
        roles: Object.fromEntries(Object.entries(k.roles || {}).map(([r, v]) => [r, v && v.text])) })) : null;
    });
    const drawn = (pg, n) => pg.waitForFunction(n => {
      const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
      return !!(m && m.cards && m.cards.length === n && m.cards.every(k => k.roles && k.roles.cap && k.roles.fo));
    }, { timeout: 8000 }, n).then(() => true, () => false);
    /* 通貨を替えたあと、カードが描き直されて字が前の通貨の字から変わるまで待つ（時間では待たない）。 */
    const moved = (pg, prev) => pg.waitForFunction(prev => {
      const m = window.PVCareerCard.model();
      return !!(m && m.cards && m.cards.length === prev.length && m.cards.every((k, i) => ['cap', 'fo'].every(r => k.roles[r] && k.roles[r].text !== prev[i].roles[r])));
    }, { timeout: 8000 }, prev).then(() => true, () => false);

    /* a) 3か所の字を通貨ごとに集める。通貨は 円 ＋ PVCurrency.rates の鍵の全部。 */
    const got = {};   // got[cur][`${slug}/${rank}`] = { page, cmp, card: [..] }
    const put = (cur, k, where, v) => { const o = ((got[cur] ||= {})[k] ||= { page: null, cmp: null, card: [] }); if (where === 'card') o.card.push(v); else o[where] = v; };
    const { pg: cp, close: cc } = await openAt(`${PAGE}?view=compare`);
    await ready(cp);
    const curs = await cp.evaluate(() => Object.keys(window.PVCurrency.rates));
    const CURS = ['JPY', ...curs.filter(x => x !== 'JPY')];
    for (const cur of CURS) {
      await set(cp, cur);
      const rows = await cp.evaluate(() => [...document.querySelectorAll('#cr .cr-pair[data-role] .cr-row[data-airline] .cr-row-v')]
        .map(v => [`${v.closest('.cr-row').dataset.airline}/${v.closest('.cr-pair').dataset.role}`, v.textContent.replace(/\s+/g, ' ').trim()]));
      for (const [k, v] of rows) put(cur, k, 'cmp', v);
    }
    await cc();
    for (const s of FIVE) {
      const { pg, close } = await openAt(`airlines/${s}.html`);
      const up = await pg.waitForFunction(() => !!window.PVCurrency && document.querySelectorAll('.pvg-rank[data-rank] .pvg-big').length === 2, { timeout: 8000 }).then(() => true, () => false);
      if (!up) trouble.push(`airlines/${s}.html: 推定年収の大きい額か通貨の切り替えが読めない`);
      for (const cur of CURS) {
        if (up) await set(pg, cur);
        const big = up ? await pg.evaluate(() => [...document.querySelectorAll('.pvg-rank[data-rank]')].map(r => [r.dataset.rank, r.querySelector('.pvg-big').textContent.replace(/\s+/g, ' ').trim()])) : [];
        for (const [r, v] of big) put(cur, `${s}/${r}`, 'page', v);
      }
      await close();
    }
    let cardLost = [];
    for (const [a, b] of [[FIVE[0], FIVE[1]], [FIVE[2], FIVE[3]], [FIVE[4], FIVE[0]]]) {
      const q = `?view=card&a=${a}&b=${b}`, { pg, close } = await openAt(`${PAGE}${q}`);
      await ready(pg);
      let prev = (await drawn(pg, 2)) ? await model(pg) : null;
      if (!prev) cardLost.push(`${q}: カードの材料が出来ない`);
      for (const cur of CURS) {
        if (!prev) break;
        if (cur !== 'JPY') {
          await set(pg, cur);
          if (!(await moved(pg, prev))) { cardLost.push(`${q} ${cur}: 通貨を替えてもカードの字が変わらない`); break; }
          prev = await model(pg);
        }
        for (const k of prev) for (const [r] of ROLES) put(cur, `${k.slug}/${r}`, 'card', k.roles[r]);
      }
      await close();
    }
    /* b) 通貨ごとに、5社 × 2職位 の3か所が同じ字・円は正本の ¥…万。 */
    let compared = 0;
    for (const cur of CURS) {
      const bad = [];
      for (const s of FIVE) for (const [r, l] of ROLES) {
        const o = (got[cur] || {})[`${s}/${r}`] || { page: null, cmp: null, card: [] }, want = cur === 'JPY' ? yen(SALARY[s][r].avg) : o.cmp;
        const all = [o.page, o.cmp, ...o.card];
        if (!o.page || !o.cmp || !o.card.length || all.some(v => v !== want)) bad.push(`${name(s)} ${l}: 会社ページ「${o.page}」比較「${o.cmp}」カード「${o.card.join('」「')}」${cur === 'JPY' ? `（正本 ${want}）` : ''}`);
        else compared += 3;
      }
      ok(!bad.length, `${cur}: 5社 × 2職位の推定年収が、会社ページ・比較・カードで同じ字${cur === 'JPY' ? '（正本 SALARY の avg の ¥…万）' : ''}`, bad.slice(0, 6).join('\n      '));
    }
    console.log(`    比べた字: ${compared}（${CURS.join('・')}）`);
    ok(!cardLost.length && !swapBad.length && compared === FIVE.length * ROLES.length * CURS.length * 3,
       `比べた字 ${compared}（5社 × 2職位 × ${CURS.length}通貨 × 3か所）── カードは通貨を替えるたびに描き直されて字が変わる`, [...cardLost, ...swapBad].join(' ／ '));

    /* c) T-E2 カードの写真を替えても（1社目 p = 0・1・2、2社目 p2 = 0・1）、職位の字は変わらない。写真は本当に替わっている。 */
    {
      const [a, b] = [DEEP[0], FIVE[0]], seen = [], photos = new Set(), lost = [];
      const { pg, close } = await openAt(`${PAGE}?view=card&a=${a}&b=${b}`);
      await ready(pg);
      for (const p of [0, 1, 2]) for (const q of [0, 1]) {
        await go(pg, `?view=card&a=${a}&b=${b}${p ? `&p=${p}` : ''}${q ? `&p2=${q}` : ''}`);
        if (!(await drawn(pg, 2))) { lost.push(`p=${p} p2=${q}: カードの材料が出来ない`); continue; }
        const m = await model(pg);
        photos.add(`${m[0].photo}|${m[1].photo}`);
        seen.push({ at: `p=${p} p2=${q}`, roles: JSON.stringify(m.map(k => [k.slug, k.roles.cap, k.roles.fo])) });
      }
      await close();
      const base = seen[0] && seen[0].roles, differ = seen.filter(x => x.roles !== base);
      ok(!lost.length && !swapBad.length && seen.length === 6 && photos.size === 6 && !differ.length && base === JSON.stringify([a, b].map(s => [s, yen(SALARY[s].cap.avg), yen(SALARY[s].fo.avg)])),
         `カードの写真を替えても（${name(a)} p=0・1・2 × ${name(b)} p2=0・1 ＝ 写真の組 ${photos.size}通り）、職位の字は変わらない（各社の推定年収のまま）`,
         [...lost, ...swapBad, ...differ.map(x => `${x.at}: ${x.roles}`), base ? '' : '材料が無い'].filter(Boolean).join(' ／ ').slice(0, 400));
    }
  }

  /* ── 保存するカード：写真を替えても動かない・描くのは公開の字と絵だけ（★2026-10-22 段階4 cmp-links-card-3・T-C2・T-C3）── */
  head('保存するカード（写真を替えても動かない・描く字と絵は公開の一覧から）');
  {
    /* 書き留め役（I-4b）：キャンバスに描かれた字（fillText / strokeText）と絵（drawImage の元。キャンバスは '(canvas)'）を、
       ページのどのスクリプトよりも先に window.__drawn へ書き留める。
       ⚠️ 元は assert-cmp-frame.mjs の RECORDER（1つの文）。ここはその写し ── 直すときは2つを同じに直す。 */
    const RECORDER = () => {
      const P = CanvasRenderingContext2D.prototype, D = window.__drawn = { text: [], img: [] };
      const fT = P.fillText, sT = P.strokeText, dI = P.drawImage;
      P.fillText = function (s) { D.text.push(String(s)); return fT.apply(this, arguments); };
      P.strokeText = function (s) { D.text.push(String(s)); return sT.apply(this, arguments); };
      P.drawImage = function (src) {
        D.img.push(typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement ? '(canvas)' : String((src && (src.currentSrc || src.src)) || ''));
        return dI.apply(this, arguments);
      };
    };
    const cardModel = pg => pg.evaluate(() => (window.PVCareerCard && window.PVCareerCard.model ? window.PVCareerCard.model() : null));
    const cardsUp = (pg, n) => pg.waitForFunction(n => {
      const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
      return !!(m && m.cards && m.cards.length === n && m.layout);
    }, { timeout: 8000 }, n).then(() => true, () => false);
    /* 評価の読み（このページの読みと同じ答え ＝ 通信は増えない）が落ち着いてから、もう一度描かせる（途中で評価が届いて字が替わらない） */
    const calm = (pg, slugs) => pg.evaluate(async slugs => {
      const pv = window.PVCareer;
      if (pv && typeof pv.rating === 'function') await Promise.all(slugs.map(s => Promise.resolve(pv.rating(s)).then(() => 0, () => 0)));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await window.PVCareerCard.redraw();
    }, slugs);

    /* T-C2：写真を1枚ずつ替えて、カードの材料（写真のほか全部）が1文字も変わらない */
    for (const s of FIVE) {
      const photos = ((CARD_AIR[s] || {}).photos || []), seen = [], lost = [];
      const { page: pg, close } = await open(`?view=card&a=${s}`);
      if (!(await cardsUp(pg, 1)) || photos.length < 2) lost.push(`カードの材料が出来ない（写真 ${photos.length}枚）`);
      else {
        await calm(pg, [s]);
        for (let i = 0; i < photos.length; i++) {
          const was = await pg.evaluate(() => document.getElementById('crc-root').getAttribute('data-drawn'));
          await pg.evaluate(i => document.querySelectorAll('#crc-root .crc-ph')[0].querySelectorAll('.crc-th')[i].click(), i);
          const got = await pg.waitForFunction((was, src) => {
            const m = window.PVCareerCard.model();
            return document.getElementById('crc-root').getAttribute('data-drawn') !== was && !!(m && m.cards[0].photo && m.cards[0].photo.src === src);
          }, { timeout: 8000 }, was, photos[i].src).then(() => true, () => false);
          if (!got) { lost.push(`写真${i + 1}: 描き直されない`); continue; }
          const { photo, ...rest } = (await cardModel(pg)).cards[0];
          seen.push(JSON.stringify(rest));
        }
      }
      await close();
      const differ = seen.filter(x => x !== seen[0]);
      ok(!lost.length && seen.length === photos.length && !differ.length && /"url":"https:/.test(seen[0] || '') && /"qr":\["/.test(seen[0] || ''),
         `${name(s)}：写真を替えても、額・棒・評価・住所・QR は1文字も変わらない（写真 ${photos.length}枚）`,
         [...lost, ...differ.map(x => `${seen[0]} → ${x}`)].join(' ／ ').slice(0, 500));
    }

    /* T-C3：描かれた字は、カードの WORD（ファイルから読む）と材料の公開の字だけ。住所はその並びのつなぎ目で切っただけ。絵は台帳の写真か '(canvas)' だけ */
    {
      const { page: pg, close } = await open('?view=card&a=jal&b=ana', 390, 680, { before: RECORDER });
      const up = await cardsUp(pg, 2);
      if (up) await calm(pg, ['jal', 'ana']);
      const m = up ? await cardModel(pg) : null;
      const d = await pg.evaluate(() => (window.__drawn ? { text: window.__drawn.text.slice(), img: window.__drawn.img.slice() } : null));
      await close();
      const CC = read('career-card.js');
      const WBLK = (CC.match(/\n {2}var WORD = \{([\s\S]*?)\n {2}\};/) || [])[1] || '';
      const WORDS = [...WBLK.matchAll(/:\s*'([^']*)'/g)].map(x => x[1]);
      const PHOTO_WORD = (WBLK.match(/\bphoto: '([^']*)'/) || [])[1] || '';
      const plain = new Set(WORDS), addr = [], cred = [], pics = new Set(['(canvas)']), bad = [];
      for (const a of Object.values(CARD_AIR)) for (const p of a.photos || []) pics.add(new URL(p.src, `${BASE}/${PAGE}`).href);
      for (const c of (m && m.cards) || []) {
        [c.ja, c.en, c.code].forEach(v => plain.add(v));
        for (const r of Object.values(c.roles || {})) {
          [r.text, r.tag, r.sub].forEach(v => plain.add(v));
          if (r.lim) [r.lim.text, r.lim.tag, r.lim.sub].forEach(v => plain.add(v));
        }
        (c.axis || []).forEach(v => plain.add(v));
        if (c.rating) { plain.add(c.rating.avg); plain.add(c.rating.text); }
        addr.push(String(c.url).replace(/^https?:\/\//, ''));
        if (c.photo && c.photo.credit) cred.push(`${PHOTO_WORD} ${c.photo.credit}`);
      }
      const text = (d && d.text) || [], img = (d && d.img) || [];
      for (const t of text) if (!plain.has(t) && !(t && [...addr, ...cred].some(x => x.includes(t)))) bad.push(`字「${t}」`);
      for (const u of img) if (!pics.has(u)) bad.push(`絵 ${u}`);
      /* いちばん後の1回（WORD.brand から描き始める）で、住所の切れ端をつなぐと住所そのものになる */
      const lastAt = text.lastIndexOf(WORDS[0]), lastPaint = lastAt < 0 ? [] : text.slice(lastAt), left = addr.slice();
      for (const t of lastPaint) {
        const k = t ? left.findIndex(x => x.startsWith(t)) : -1;
        if (k >= 0) left[k] = left[k].slice(t.length);
      }
      ok(up && !!d && text.length > 0 && img.length >= 2 && WORDS[0] === 'PILOT VALUE' && !!PHOTO_WORD && left.every(x => x === '') && !bad.length,
         'カードに描かれる字と絵は、公開の一覧に在るものだけ（WORD・社名・略号・額と札・目盛・評価・住所の切れ端・写真のクレジット・台帳の写真）',
         JSON.stringify({ up, drawn: text.length, img: img.length, bad: bad.slice(0, 6), addrLeft: left }).slice(0, 600));
    }

    /* T-C4（★2026-10-25 段階5 compare-all-14・絵の本 #15）：写真の欄の名前（と、カードの見本の読み上げの名前）に、括弧が2重にならない。
       社名がもう括弧で終わる2社（日本航空（JAL）・全日本空輸（ANA）── どちらも写真が2枚 ＝ 欄が2つとも見える）を並べて、日本語と英語で見る。 */
    for (const [file, lang] of [[PAGE, 'ja'], [PAGE_EN, 'en']]) {
      const { page: pg, close } = await open('?view=card&a=jal&b=ana', 390, 680, { path: file });
      await ready(pg);
      const up = await cardsUp(pg, 2);
      const got = up ? await pg.evaluate(() => ({
        legends: [...document.querySelectorAll('#crc-root fieldset')].filter(f => f.querySelector('.crc-ph') && f.getClientRects().length)
          .map(f => f.querySelector('legend').textContent),
        aria: (document.querySelector('#crc-root canvas') || { getAttribute: () => '' }).getAttribute('aria-label') || '',
      })) : null;
      await close();
      const names = ['jal', 'ana'].map(s => SALARY[s][lang]);
      const twice = t => /[)）]\s*[)）]/.test(t);
      const even = t => (t.match(/[(（]/g) || []).length === (t.match(/[)）]/g) || []).length;
      ok(!!got && got.legends.length === 2 && got.legends.every((l, i) => l.includes(names[i]) && !twice(l) && even(l)) && names.every(n => got.aria.includes(n)) && !twice(got.aria) && even(got.aria),
         `${file}：写真の欄の名前に括弧が2重にならない（社名が括弧で終わる ${names.join('・')}）`, JSON.stringify(got));
    }
  }

  /* ── ②（続き）会社が公表した額は、一覧の中にだけ ─────────────── */
  head('会社が公表した額は、一覧の中にだけ在る');
  {
    /* 会社が公表した年額（求人の上限・目標年収・下限・乗員全体の平均）は「会社が公表している金額」の一覧にだけ出す。
       推定の欄・棒・目盛・詳細・家賃・カードの材料へ出さない（出すと、推定と公表額が同じ物差しに乗る）。 */
    /* ★2026-10-24 段階5 compare-all-1（E5.1 P7）：この1枚は全社の推定を出す（比較の行）── 推定とたまたま同じ額は、全社の推定から外す
       （外れる公表額は、いまは1件も無い ＝ 探す強さは今までと同じ）。 */
    const ests = new Set(ALLK.flatMap(s => ROLES.map(([r]) => SALARY[s][r].avg)));
    /* 機長と副操縦士を分けない額（台帳の crew）は一覧にも出さない（2026-10-21 P12.77）── CREW は、ページのどこにも無いことを下で見る。
       ★2026-10-24 段階5 compare-all-1（リード）：この1枚が全社ぶんの材料を持つので、探す相手も台帳の全社（先行5社のほかに、いまは スカイマーク）。 */
    const PUBS = FIVE.flatMap(s => ['cap', 'fo'].flatMap(r => figures(s, r).filter(f => !f.training && /(^|_)y(_|$)/.test(f.key))
      .map(f => ({ s, man: f.man, amount: f.amount, cur: f.cur }))));
    const CREW = ALLK.flatMap(s => figures(s, 'crew').filter(f => !f.training && /(^|_)y(_|$)/.test(f.key)).map(f => ({ s, man: f.man, amount: f.amount, cur: f.cur })))
      .filter(f => !ests.has(f.man));
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
    {
      const num2 = n => n.toLocaleString('en-US').replace(/,/g, ',?');
      const crewHit = text => CREW.filter(f => new RegExp(`(?<![\\d,.])${num2(f.man)}\\s*万|[¥￥]\\s*${num2(f.man)}(?![\\d,])|(?<![\\d,.])${num2(f.man * 10000)}(?![\\d,])`).test(String(text))).map(f => `${name(f.s)} ${f.man}万`);
      const hit = [...crewHit(out.inside), ...crewHit(out.outside), ...(out.data ? crewHit(out.data) : [])];
      ok(CREW.length >= 1 && !hit.length, `機長と副操縦士を分けない額（運航乗務員の平均 ${CREW.length}件）は、一覧の中にも外にも無い（P12.77）`, hit.join(', '));
    }
    ok(out.pubs === WITH_PUB.length * 2 && same(out.heads, ['会社が公表している金額']) && out.figs > 0 && out.figs === out.figsIn,
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
    /* ★2026-10-24 段階5 compare-all-1（E5.1 P4）：箱は、比較に家賃の箱を置ける会社（RENTB ── この検査が台帳から作り直す・先行5社は必ず入る）に1つずつ */
    ok(got.secs === 1 && got.all === RENTB.length && /1か月あたり/.test(got.h2 || ''), `比較の家賃の節は1つ・箱は会社ごとに1つ（${got.all}）・見出しに「1か月あたり」`, `節${got.secs} 箱${got.all}「${got.h2}」`);
    ok(same(got.boxes.filter(b => b.shown).map(b => b.slug), PAIR_Q), '見えている箱は、並べている2社のぶんだけ（選んだ順）', got.boxes.filter(b => b.shown).map(b => b.slug).join(','));
    ok(got.scale === 0, '2つの街を 同じ目盛・同じ表・年収の棒 に並べていない（箱を分ける）', `${got.scale}個`);
    ok(!/年額|1年あたり|年間|per year/i.test(got.plain), '箱の表に出ている字に 年額・1年あたり が無い（額は月額）', got.plain.match(/.{0,12}(?:年額|1年あたり|年間|per year).{0,12}/i)?.[0]);
    ok(!/安い|高い|割安|割高|お得|勝ち|負け|勝る|劣る|優位|差額|[\d.]\s*倍|より(?:安|高)/.test(got.text), '家賃の節に 安い・高い・差・倍 の語を書かない（街どうしを競わせない）', got.text.match(/.{0,12}(?:安い|高い|割安|割高|お得|勝ち|負け|勝る|劣る|優位|差額|[\d.]\s*倍|より(?:安|高)).{0,12}/)?.[0]);
    for (const s of RENTB) {
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
          imgs: [...v.querySelectorAll('img')].filter(i => on(i) && !i.closest('.pvg-logo')).map(i => i.getAttribute('src')),
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
      /* クレジットの中に、台帳に無い文言が無い。
         ★2026-10-26（P12.122・同じ強さの当て直し）：比較のクレジットの頭の社名は、先行5社のほかの会社も出る ── 正本の社名（SALARY の ja）を全社ぶん。 */
      let rest = g.text;
      for (const w of [...LEDGER.flatMap(x => [x.author, x.licence, x.aircraft]), ...PLACES.flatMap(x => [x.author, x.licence]), ...g.towns, ...CHANGES, ...ALLK.map(name), '写真']
        .filter(Boolean).sort((a, b) => b.length - a.length)) rest = rest.split(w).join('');
      rest = rest.replace(/[\s（）／]/g, '');
      ok(rest === '', `${at}: クレジットの中に台帳に無い文言が無い`, `残り「${rest}」`);
    }
    await c();
  }

  /* ── ⑫ 比較 → 会社ページ（★2026-10-23 段階4 cmp-links-card-5：T-L7・T-L5・T-L6）──────────────── */
  head('比較の箱と会社ページのタブ');
  {
    /* T-L7：比較の家賃の箱の額は、会社ページの暮らしのタブの、その街のところに在る（「ほかの街」の先で同じ額が読める）。
       箱は ⑪ と同じ読み方で読む。街のところ ＝ その街の詳細・札・家賃の棒の行・出典の参考の行（companyPage の towns）。 */
    const { page: p, close: c } = await open(`?view=compare&a=${PAIR[0]}&b=${PAIR[1]}`);
    const boxes = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#cr .cr-view[data-view="compare"] .cr-rentb')].map(b => [b.dataset.airline,
      [...b.querySelectorAll('dl.cr-rent > div')].map(d => ({ k: d.querySelector('dt').textContent.replace(/\s+/g, ' ').trim(),
        parts: [...d.querySelectorAll('dd > *')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) }))])));
    await c();
    for (const s of FIVE) {
      const L = viewOf(s).living, r = L.rents.find(x => x.lead), P = await companyPage(s);
      const rows = boxes[s] || [], text = (r && P.towns[r.key]) || '';
      const lack = rows.flatMap(o => o.parts.filter(v => !v || !text.includes(v)).map(v => `${o.k} ${v}`));
      ok(!!r && rows.length > 0 && !!text && !lack.length && (P.townPane[r.key] || []).includes('life'),
         `${name(s)}: 比較の箱の額は、会社ページの暮らしのタブの、その街（${r ? r.name : '？'}）のところに在る`,
         JSON.stringify({ town: r && r.key, rows: rows.length, lack, pane: r && P.townPane[r.key], text: text.slice(0, 160) }));
    }
    /* T-L5（会社ページの半分）：会社ページがタブに出す会員の回答の質問は、比較でも同じ節の下に在る（「詳しく」の先と食い違わない）。
       会社ページは直さない ── 赤くなったら直すのは gen-career.mjs の tabOfKey（決まり）。 */
    const LISTS = { work: CMP_KEYS.work, pay: CMP_KEYS.pay };
    for (const s of FIVE) {
      const P = await companyPage(s);
      for (const T of ['work', 'pay']) {
        const pageT = [...new Set(P.facts.filter(f => f.panes.includes(T)).flatMap(f => f.keys))];
        ok(pageT.length > 0, `${name(s)}: 会社ページの「${T}」のタブに、会員の回答の欄が在る`, JSON.stringify(P.facts.map(f => f.panes)));
        const off = pageT.filter(k => !LISTS[T].includes(k) || Object.entries(LISTS).some(([o, l]) => o !== T && l.includes(k)));
        ok(pageT.length > 0 && !off.length, `${name(s)}: 会社ページがそのタブ（${T}）に出す質問は、比較でも同じ節の下に在る（「詳しく」の先と食い違わない）`,
           `比較の別の節・どこにも無い: ${off.map(k => `${k}（${tabOfKey(k) || '比較に無い'}）`).join(', ')}`);
      }
    }
    if (CO_NOTES.length) console.log('    ・会社ページの中のエラー（会社ページの検査が見るもの。ここでは控えだけ）: ' + [...new Set(CO_NOTES)].join(' ／ '));
  }
  head('比較から会社ページへ出て、戻る（狭い画面）');
  {
    /* T-L6 (a)：比較の「詳しく」（月の働き方 → 勤務・訓練のタブ）と「ほかの街」（暮らしのタブ）から会社ページへ出て、
       そのタブが開く・戻ると同じ住所・同じ2社。
       ★2026-10-23 段階4 cmp-links-card-6（LEAD AMENDMENT「戻ったときの位置」）：戻ったあと、生きた欄が全部落ち着いてから、
       位置が出る前と同じ（|scrollY − y0| ≤ 1）。戻った直後の比較は生きた欄がまだ「—」で、ページの長さが違う
       （直す前は 390×680 で出る前 2358 → 戻ったあと 2305 ／ 2183 → 2115：2026-10-23 の基準の回）── career.js が段（history.state）に
       残した箱の高さで欄を置き、出る前のいちばん上の目印を、欄が埋まるあいだ同じ高さに合わせ直す（比較の設計 WP-6）。
       どちらが起きたかを先に確かめる：この検査は要求を横取りする（解析タグと本番の DB を止める）ので、ブラウザはページを手元に置かない
       （P12.36）＝ 戻ると読み込み直す。印（window.__left）が残っていたら手元から戻ったページ ── それは位置を戻す仕組みの証明にならないので赤。
       出る前に欄が落ち着くのを待つのは、出る前と戻ったあとで同じ顔（どちらも手元の空の保存先・ゲスト）の長さを比べるため。 */
    const Q = '?view=compare&a=jal&b=ana';
    const { page: p, close: c } = await open(Q, 390, 680);
    const legs = [['#cr-go-work-jal', '詳しく', 'jal', 'work'], ['#cr .cr-rentb[data-airline="ana"] .cr-rentb-go a', 'ほかの街', 'ana', 'life']];
    /* 比較の生きた欄が全部読み終わり（読み込み中でも、まだ何もしていない顔でもない）、見ている画面の出る動きが終わった */
    const calmCmp = async () => {
      const done = await p.waitForFunction(() => {
        const all = [...document.querySelectorAll('#cr .cr-view[data-view="compare"] .crl[data-live]')];
        return all.length > 0 && all.every(b => b.getAttribute('data-for') === 'jal|ana' && !['idle', 'loading'].includes(b.getAttribute('data-state')));
      }, { timeout: 20000, polling: 100 }).then(() => true, () => false);
      await p.evaluate(async () => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        if (v) await Promise.all(v.getAnimations().map(a => a.finished.catch(() => {})));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      return done;
    };
    for (const [sel, word, s, tab] of legs) {
      const calm0 = await calmCmp();
      await p.evaluate(x => document.querySelector(x).scrollIntoView({ block: 'center' }), sel);
      const kept = await keptAt(p);
      const y0 = await p.evaluate(() => scrollY);
      await p.evaluate(() => { window.__left = 1; });
      await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click(sel)]);
      const out = await p.waitForFunction(t => !!window.PVGlance && window.PVGlance.at() === t, { timeout: 15000 }, tab).then(() => true, () => false);
      const at = await p.evaluate(() => ({ path: location.pathname, hash: location.hash, tab: window.PVGlance ? window.PVGlance.at() : null }));
      await p.goBack({ waitUntil: 'load' });
      await ready(p);
      const back = await until(p, Q);
      ok(kept && out && at.path === `/airlines/${s}.html` && at.hash === `#${tab}` && back,
         `比較の「${word}」から会社ページの「${tab}」のタブへ出て、戻ると同じ住所・同じ2社`,
         JSON.stringify({ kept, out, at, back: await search(p) }));
      const how = await p.evaluate(() => (window.__left === 1 ? '手元から戻った' : '読み込み直した'));
      const yNow = await p.evaluate(() => scrollY);
      const calm1 = await calmCmp();
      const y1 = await p.evaluate(() => scrollY);
      ok(calm0 && calm1 && how === '読み込み直した' && Math.abs(y1 - y0) <= 1,
         `比較の「${word}」から出て戻ると（${how}ページ）、欄が全部落ち着いたあとも出る前と同じ位置（出る前 ${y0} → ${y1}・ずれ ${y1 - y0}px ≤ 1）`,
         JSON.stringify({ calm0, calm1, how, y0, yNow, y1 }));
      console.log(`    ・「${word}」から戻った位置: ${how}ページ・出る前 ${y0} → 戻った直後 ${yNow} → 欄が落ち着いたあと ${y1}`);
      await pairOk('jal', 'ana', `  └ 戻ったあとも同じ2社（JAL・ANA。どちらにも公表額の一覧が無いので、その箱は描かない）`, p);
    }
    await c();
  }
  head('通貨を替えたまま、選び直し・入れ替え');
  {
    /* T-L6 (b)：通貨を替えたまま会社を選び直し・入れ替えても、額はその通貨のまま（推定年収の行は必ずその通貨・公表額と家賃は
       原貨の字（pv-no-cur）のほかに ¥・万 が無い）。「詳しく」の字は通貨で変わらない。円に戻すと推定年収の行は ¥。 */
    const { page: p, close: c } = await open('?view=compare&a=jal&b=cathay-pacific', 1280, 800);
    /* ★2026-10-25 P12.106（同じ強さの当て直し）：年収の板の足は会社ごとの1行（.cr-ft ── これも「選んだ2社だけ見せる」の .cr-go）に包んだので、
       「詳しく」はリンク（a.cr-go）だけを読む。 */
    const feet = () => p.evaluate(() => [...document.querySelectorAll('#cr .cr-cmp a.cr-go')].filter(e => e.getClientRects().length).map(e => e.textContent.trim()));
    const read = () => p.evaluate(() => {
      const v = document.querySelector('#cr .cr-view[data-view="compare"]');
      const on = e => e.getClientRects().length > 0;
      return {
        rows: [...v.querySelectorAll('.cr-row-v')].filter(on).map(e => e.textContent.trim()),
        rest: [...v.querySelectorAll('.cr-fig b, .cr-rent dd span')].filter(e => on(e) && !e.closest('.pv-no-cur')).map(e => e.textContent.trim()),
      };
    });
    await p.evaluate(() => window.PVCurrency.set('USD'));
    await choose(p, 'b', 'etihad');
    const moved = await until(p, '?view=compare&a=jal&b=etihad');
    await p.click('#cr-swap');
    const swapped = await until(p, '?view=compare&a=etihad&b=jal');
    const u = await read(), f1 = await feet();
    await p.evaluate(() => window.PVCurrency.set('JPY'));
    const j = await read(), f2 = await feet();
    const fx = GOS.flatMap(() => ['etihad', 'jal'].map(s => name(s) + '詳しく'));
    ok(moved && swapped && u.rows.length === ROLES.length * 2 && u.rows.every(t => /\$/.test(t) && !/[¥万]/.test(t)) && u.rest.length > 0 && u.rest.every(t => !/[¥万]/.test(t))
       && same(f1, fx) && same(f2, fx) && j.rows.length === ROLES.length * 2 && j.rows.every(t => /¥/.test(t)),
       '通貨を替えたまま会社を選び直し・入れ替えても、額はその通貨のまま', JSON.stringify({ moved, swapped, usd: u, feet: [f1, f2], jpy: j.rows }));
    await c();
  }

  /* ── 英語の1枚（en/career.html）── ★2026-10-25 英語の EN-9 ─────────────────────────────
     同じ1枚を英語で開いて、狭い幅と広い幅の2つで見る（日本語の検査の全部を英語でもう一度は流さない ── RULING O）：
       (a) 見えている字（生きた欄の「読めなかった」の姿・選ぶ面・上の帯と左のメニューも）に日本語の字が無い（写真の作者名・“…” の中を除く）
       (b) 比較の最初の1画面に、2枚の札・年収の板の全部・「Submitted pay」の見出しの頭が入る（日本語と同じ約束）
       (c) 横に溢れない・額と社名が箱からはみ出さない（ドルと、字数の多い AED で）
       (d) 保存するカード：描いた社名は英語の社名・住所は英語の会社ページ・描いた字に日本語の字が無い */
  head('英語の1枚（en/career.html）を開く');
  {
    const JA_RE = /[　-ヿ㐀-鿿＀-￯]/;
    const AUTH = [...new Set([...Object.values(PHOTOS).flat(), ...Object.values(PLACE.PHOTOS).flat()].map(x => x.author).filter(a => a && JA_RE.test(a)))];
    const jaOf = list => [...new Set(list.map(t => { let s = String(t || '').replace(/“[^”]*”/g, ' '); for (const a of AUTH) s = s.split(a).join(' '); return s.replace(/\s+/g, ' ').trim(); }).filter(s => JA_RE.test(s)))];
    const goEn = async (p, q) => { await p.goto(`${BASE}/${PAGE_EN}${q}`, { waitUntil: 'load' }); await ready(p); await settle(p); };
    /* 見えている字（画面の字と、読み上げ・乗せたときに出る字）。手元のサーバー（serve-local.mjs）が配る瞬間に差し込む会員の切替（[data-pv-local] ──
       公開するファイルには1文字も無い）は数えない */
    const seenText = p => p.evaluate(() => {
      const on = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[data-pv-local]');
      const out = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode());) { const el = n.parentElement; if (n.nodeValue.trim() && el && !el.closest('script, style, noscript') && on(el)) out.push(n.nodeValue); }
      for (const el of document.querySelectorAll('[alt], [title], [aria-label], [placeholder]')) if (on(el)) for (const a of ['alt', 'title', 'aria-label', 'placeholder']) if (el.hasAttribute(a)) out.push(el.getAttribute(a));
      return out;
    });
    const VIEWS_EN = ['', '?airline=jal', '?airline=etihad', '?airline=etihad&tab=work', '?airline=etihad&tab=life', '?airline=etihad&stay=NRT', '?airline=etihad&d=cap-est',
      '?view=compare&a=jal&b=united', '?view=compare&a=emirates&b=jal', '?view=compare&a=swiss&b=tap'];
    const MONEY_NAMES = '.cr-num-v, .cr-bar-v, .cr-row-v, .cr-fig b, .cr-tile-n, .cr-opt-n, .cr-hero-n, .cr-row-co, .cr-pk-n, .cr-pk-c, .cr-go-n, .cr-tx, .cr-role, .cr-tgt';
    const cutOf = p => p.evaluate(sel => {
      const v = document.querySelector('#cr .cr-view:not([hidden])'), out = [];
      const on = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      for (const el of v.querySelectorAll(sel)) {
        if (!on(el)) continue;
        if ((s => s.position === 'absolute' && s.clipPath === 'inset(50%)')(getComputedStyle(el)) && el.getBoundingClientRect().width <= 1) continue;   // 読み上げにだけ残す字
        if (getComputedStyle(el).webkitLineClamp && getComputedStyle(el).webkitLineClamp !== 'none') continue;   // 2行で切る税の字（字は title と会社ページに在る）
        const b = el.getBoundingClientRect();
        if (b.right > innerWidth + 0.5 || b.left < -0.5 || (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)) out.push(`${el.className}「${el.textContent.trim().slice(0, 18)}」`);
      }
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, cut: out };
    }, MONEY_NAMES);
    for (const [w, h] of [[390, 680], [1440, 900]]) {
      const { page: p, close: c } = await open('', w, h, { path: PAGE_EN });
      await ready(p);
      const jaBad = [], cut = [];
      for (const q of VIEWS_EN) {
        await goEn(p, q);
        /* 生きた欄が落ち着くまで（通信は止めてあるので「読めなかった」の姿）── 待ちは条件で */
        await p.waitForFunction(() => [...document.querySelectorAll('#cr .cr-view:not([hidden]) .crl[data-live]')].every(b => !/^(idle|loading)$/.test(b.getAttribute('data-state') || '')), { timeout: 8000 }).catch(() => {});
        const j = jaOf(await seenText(p));
        if (j.length) jaBad.push(`${q || '（入口）'}：${j.slice(0, 3).join(' ／ ')}`);
        const k = await cutOf(p);
        if (k.over > 0 || k.cut.length) cut.push(`${q || '（入口）'}：横 ${k.over}px ${k.cut.slice(0, 3).join(' ')}`);
        if (q === '?view=compare&a=jal&b=united') {
          /* 選ぶ面も（1社目の札を押して開き、Esc で閉じる） */
          await p.click('#cr-open-a');
          if (await p.waitForSelector('#cr-sheet[open]', { timeout: 5000 }).then(() => true, () => false)) {
            const s = jaOf(await seenText(p));
            if (s.length) jaBad.push(`選ぶ面：${s.slice(0, 3).join(' ／ ')}`);
            await p.keyboard.press('Escape');
            await p.waitForFunction(() => !document.getElementById('cr-sheet').open, { timeout: 5000 }).catch(() => {});
          } else jaBad.push('選ぶ面が開かない');
          /* (b) 最初の1画面（日本語の検査と同じ物差し） */
          await p.evaluate(() => window.scrollTo(0, 0));
          await settle(p);
          const m = await p.evaluate(() => {
            const V = document.querySelector('#cr .cr-view[data-view="compare"]'), R = el => (el ? el.getBoundingClientRect() : null), n = v => (v == null ? null : Math.round(v));
            const panel = R(V.querySelector('.cr-panel')), sub = R(V.querySelector('.cr-subpay .cr-h2')), pick = R(V.querySelector('.cr-pick'));
            return { vh: innerHeight, y: Math.round(scrollY), pickB: n(pick && pick.bottom), pickH: n(pick && pick.height), panelB: n(panel && panel.bottom), panelH: n(panel && panel.height), subT: n(sub && sub.top),
              sub: V.querySelector('.cr-subpay .cr-h2') ? V.querySelector('.cr-subpay .cr-h2').textContent.trim() : '' };
          });
          ok(m.y === 0 && m.pickB <= m.vh && m.panelB != null && m.panelB <= m.vh && m.subT != null && m.subT <= m.vh && /^Submitted pay/.test(m.sub),
             `en ${w}×${h}: 比較（jal｜united）の最初の1画面に、2枚の札・年収の板の全部・「Submitted pay」の見出しの頭が入る（日本語と同じ約束）`, JSON.stringify(m));
          console.log(`    （en ${w}×${h}）札の高さ ${m.pickH}px・年収の板 ${m.panelH}px・板の下端 ${m.panelB} ／「Submitted pay」の頭 ${m.subT} ／ 画面 ${m.vh}`);
        }
      }
      ok(!jaBad.length, `en ${w}×${h}: ${VIEWS_EN.length}画面と選ぶ面の見える字（alt・title・aria-label・placeholder も）に日本語の字が無い`, jaBad.join('\n      '));
      /* (c) 字数の多い通貨（AED）でも、比較の3組（jal｜united・emirates｜jal・swiss｜tap）で溢れない・はみ出さない */
      ok(await p.evaluate(() => window.PVCurrency.get()) !== 'JPY', `en ${w}×${h}: 英語のページの既定の通貨は円ではない`, await p.evaluate(() => window.PVCurrency.get()));
      await p.evaluate(() => window.PVCurrency.set('AED'));
      for (const q of VIEWS_EN.filter(x => x.startsWith('?view=compare'))) {
        await goEn(p, q);
        await p.waitForFunction(() => [...document.querySelectorAll('#cr .cr-row-v')].filter(e => e.getClientRects().length).every(e => /AED/.test(e.textContent)), { timeout: 5000 }).catch(() => {});
        const k = await cutOf(p);
        if (k.over > 0 || k.cut.length) cut.push(`AED ${q}：横 ${k.over}px ${k.cut.slice(0, 3).join(' ')}`);
      }
      await p.evaluate(() => window.PVCurrency.set('USD'));
      ok(!cut.length, `en ${w}×${h}: 横に溢れない・額と社名が箱からはみ出さない（${VIEWS_EN.length}画面・比較の3組は AED でも）`, cut.join('\n      '));
      await c();
    }
    /* (d) 保存するカード（英語）：描いた社名は英語の社名・住所は英語の会社ページ・描いた字に日本語の字が無い */
    const REC = () => {
      const P = CanvasRenderingContext2D.prototype, D = window.__drawn = { text: [] };
      const fT = P.fillText;
      P.fillText = function (s) { D.text.push(String(s)); return fT.apply(this, arguments); };
    };
    const { page: p, close: c } = await open('?view=card&a=jal&b=united', 390, 680, { path: PAGE_EN, before: REC });
    await ready(p);
    const up = await p.waitForFunction(() => { const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model(); return !!(m && m.cards && m.cards.length === 2 && m.layout); }, { timeout: 8000 }).then(() => true, () => false);
    const m = up ? await p.evaluate(() => window.PVCareerCard.model()) : null;
    const drawn = await p.evaluate(() => (window.__drawn ? window.__drawn.text.slice() : []));
    const ui = await p.evaluate(() => [...document.querySelectorAll('#crc-root label, #crc-root legend, #crc-root button, #crc-root option')].map(e => e.textContent.trim()).filter(Boolean));
    const CNAME = read('CNAME').trim();
    const cards = (m && m.cards) || [];
    ok(up && cards.length === 2 && cards.every(x => x.ja === SALARY[x.slug].en && x.en === '' && x.url === `https://${CNAME}/en/airlines/${x.slug}.html`)
       && ['jal', 'united'].every((s, i) => cards[i] && cards[i].slug === s),
       'en カード：描く社名は英語の社名（下に添える名前は無し）・住所と QR は英語の会社ページ', JSON.stringify(cards.map(x => ({ s: x.slug, ja: x.ja, en: x.en, url: x.url }))));
    const jd = jaOf([...drawn, ...ui]);
    ok(up && drawn.length > 5 && !jd.length && drawn.includes('Captain') && drawn.includes('Pilot pay'),
       'en カード：描いた字と選ぶ欄の字に日本語の字が無い（見出しは「Pilot pay」・職位は「Captain」）', jd.slice(0, 6).join(' ／ ') || `${drawn.length}個`);
    await c();
  }

  head('ページの中のエラー');
  ok(!trouble.length, '例外が出ていない・自サイトのファイルが全部読める', [...new Set(trouble)].join('\n      '));
} finally {
  await browser.close();
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
