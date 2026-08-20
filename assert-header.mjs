/* ═══════════════════════════════════════════════════════════════════
   assert-header.mjs — ヘッダーが幅ごとに正しく畳まれるか

   なぜ要るか
     ヘッダーは Tailwind の `md:`（768px）で真ん中のリンク群が出てくるが、
     **768px では入りきらない**。入らないぶんは文字が2行に折れ、ロゴに重なり、
     英語版は画面の外へ 173px 出ていた（2026-08-19 実測）。
     いまは search.js が **実測して自動で畳む**。畳む判断が JS にあるので、
     HTML を1枚も触っていなくても壊れうる。だから毎回ここで測る。

     ⚠️ `scrollWidth` では測れない。文字が折れて逃げるあいだ `scrollWidth` は
     増えないので「入っていない」ことを検出できない。子の幅を足して比べる。

   見るもの（日英6ページ × 7幅 = 42マス）
     1) ヘッダーの中身が画面からはみ出さない
     2) `#main-nav` の中に2行になった要素が無い
     3) 隣り合う中身が 20px 未満まで近づかない（入っていても詰まって見える）
     4) 畳んだときだけ ≡ が出る／畳んでいないとき ≡ は出ない
     5) CTA は残る — バーから消えるのは最後の段だけで、そのときは引き出しの先頭にある
     6) 引き出しにそのページのリンクが入っていて、**国別年収が入っていない**、
        **口コミへ行ける**（オーナー決定 2026-08-19）

   使い方（node serve.mjs を起動した状態で）
     node assert-header.mjs
   ═══════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';

/* テンプレートが違うものを1枚ずつ。同じ生成物を並べても同じ形が増えるだけ。 */
const PAGES = [
  ['/',                     'ja トップ'],
  ['/en/',                  'en トップ'],
  ['/world-airlines.html',  'ja 航空会社一覧'],
  ['/community.html',       'ja 口コミ'],
  ['/airlines/ana.html',    'ja 航空会社ページ'],
  ['/en/airlines/ana.html', 'en 航空会社ページ'],
];
const WIDTHS = [390, 768, 900, 1024, 1152, 1280, 1440];
const MIN_GAP = 19;          /* search.js の BREATH=20 に測定誤差ぶんの余裕 */

let fail = 0, ran = 0;
const ok = (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  console.log(`  ${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n          → ${detail}` : ''}`);
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ── 見た目を測る（1マスぶん）──────────────────────────────────── */
const measure = () => {
  const nav = document.getElementById('main-nav');
  if (!nav || !nav.firstElementChild) return { noNav: true };
  const inner = nav.firstElementChild;
  const vw = document.documentElement.clientWidth;

  const shown = [].filter.call(inner.children, (c) => getComputedStyle(c).display !== 'none');
  const boxes = shown.map((c) => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
  let minGap = Infinity;
  for (let i = 1; i < boxes.length; i++) minGap = Math.min(minGap, boxes[i].left - boxes[i - 1].right);

  /* 2行になったか — getClientRects() の top を **10px の幅でまとめて** 数える。
     絵文字（🇯🇵）や「▾」はベースラインが 1〜4px ずれるので、
     そのまま重複除去すると全部が「2行」になる。 */
  const SEL = 'a.nav-link,a.btn-ghost,a.btn-primary,a.btn-orange,#nav-auth-btn';
  let over = 0, twoLine = 0;
  const overNames = [], twoNames = [];
  nav.querySelectorAll(SEL).forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width === 0) return;
    const label = (el.textContent || '').trim().slice(0, 14);
    if (b.right > vw + 0.5 || b.left < -0.5) { over++; overNames.push(label); }
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const tops = [...rg.getClientRects()].map((r) => Math.round(r.top)).sort((a, c) => a - c);
    const lines = [];
    tops.forEach((t) => { if (!lines.length || t - lines[lines.length - 1] > 10) lines.push(t); });
    if (lines.length > 1) { twoLine++; twoNames.push(label); }
  });

  const ham = document.getElementById('pv-ham-btn');
  const cta = nav.querySelector('.btn-primary,.btn-orange');
  return {
    minGap: minGap === Infinity ? null : Math.round(minGap),
    over, overNames, twoLine, twoNames,
    hamVisible: !!ham && getComputedStyle(ham).display !== 'none',
    collapsed: nav.classList.contains('pv-nav-compact'),
    ctaInBar: cta ? cta.getBoundingClientRect().width > 0 : null,
    ctaHidden: nav.classList.contains('pv-nav-min'),
  };
};

/* ── 引き出しの中身を読む ──────────────────────────────────────── */
const readDrawer = () => {
  const btn = document.getElementById('pv-ham-btn');
  if (btn) btn.click();
  const d = document.getElementById('pv-nav-drawer');
  if (!d) return { noDrawer: true };
  const links = [...d.querySelectorAll('.pv-nd-link')].map((a) => ({
    text: (a.textContent || '').trim(),
    href: a.getAttribute('href') || '',
  }));
  const cta = d.querySelector('.pv-nd-cta');
  const navHrefs = [...document.querySelectorAll('#main-nav a.nav-link')].map((a) => a.getAttribute('href') || '');
  return {
    links,
    cta: cta ? { text: (cta.textContent || '').trim(), href: cta.getAttribute('href') || '' } : null,
    navHrefs,
  };
};

const abs = (href, base) => { try { return new URL(href, base).pathname.replace(/\/index\.html$/, '/'); } catch (e) { return href; } };

for (const [href, label] of PAGES) {
  console.log(`\n═══ ${label}  ${href} ═══`);
  let drawerDone = false;

  for (const w of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 820 });
    await page.goto(BASE + href, { waitUntil: 'networkidle2' });
    /* 通貨ピルと言語ボタンはあとから右側に差し込まれる。差し込まれた後を測る。 */
    await new Promise((r) => setTimeout(r, 1200));

    const m = await page.evaluate(measure);
    if (m.noNav) {
      ok(false, `${w}px — #main-nav がある`);
      await page.close();
      continue;
    }
    const tag = `${String(w).padStart(4)}px`;
    ok(m.over === 0, `${tag} 画面からはみ出していない`, m.over ? m.overNames.join(' / ') : '');
    ok(m.twoLine === 0, `${tag} 2行に折れた項目が無い`, m.twoLine ? m.twoNames.join(' / ') : '');
    ok(m.minGap === null || m.minGap >= MIN_GAP, `${tag} 中身どうしが ${MIN_GAP}px 以上あいている`,
       m.minGap === null ? '' : `いちばん狭いところ ${m.minGap}px`);
    ok(m.collapsed === m.hamVisible || (w <= 767 && m.hamVisible),
       `${tag} ≡ は畳んだときだけ出る`, `畳んだ=${m.collapsed} ≡=${m.hamVisible}`);
    /* CTA が無いページ（← トップ だけの一覧・航空会社ページ）は対象外 */
    if (m.ctaInBar !== null) {
      ok(m.ctaInBar || m.ctaHidden, `${tag} CTA が黙って消えていない`,
         m.ctaInBar ? '' : '最後の段＝引き出しの先頭に移した');
    }

    /* 引き出しの中身はページごとに1回だけ（幅で変わらない）。畳む幅で開ける。 */
    if (!drawerDone && m.hamVisible) {
      drawerDone = true;
      const d = await page.evaluate(readDrawer);
      if (d.noDrawer) {
        ok(false, '引き出しがある');
      } else {
        const paths = d.links.map((l) => abs(l.href, BASE + href));
        const navPaths = d.navHrefs.map((h) => abs(h, BASE + href))
          .filter((p) => !/countries\.html$/.test(p));
        const missing = navPaths.filter((p) => !paths.includes(p));
        ok(missing.length === 0, '引き出しにそのページのリンクが全部入っている',
           missing.length ? `足りない: ${missing.join(' / ')}` : `${d.links.length}本`);
        ok(!paths.some((p) => /countries\.html$/.test(p)), '引き出しに国別年収が入っていない',
           paths.filter((p) => /countries\.html$/.test(p)).join(' / '));
        ok(paths.some((p) => /community\.html$/.test(p)), '引き出しから口コミへ行ける');
        /* CTA を持たないページ（← トップ だけの一覧・航空会社ページ）にも
           pv-nav-min は付く。持っているページだけ見る。 */
        if (m.ctaHidden && m.ctaInBar !== null) {
          ok(!!d.cta, 'バーから消した CTA が引き出しの先頭にある', d.cta ? d.cta.text : '');
        }
      }
    }
    await page.close();
  }
}

await browser.close();
console.log(`\n==== ${ran - fail}/${ran} passed ====`);
process.exit(fail ? 1 : 0);
