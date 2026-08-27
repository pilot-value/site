/* pay-report の select が実際に何px足りないかを測る（目分量で直さないため）。
   ★2026-08-27、狭い幅（320 / 360 / 390px）で2つ測るのを足した ──
     ① 常設バー（#sticky-submit）の箱が ちょうど [0, 画面幅]。左右に1pxも出ない
     ② ページが横に溢れていない（scrollWidth === clientWidth）
     ③ バーの金額が省略記号に化けていない（①では捕まらない。下の valNeed を参照）
   オーナーの実機で「画面の下の部分が見切れる」＝バーの数字とボタンの端が
   左右とも切れていた。手元の Chrome では起きない。iOS はページが横に溢れると
   レイアウト幅を広げ、position:fixed;left:0;right:0 はその広げられた幅に貼りつくので、
   見えている窓からはみ出す。②が本当の原因なので、数で押さえる。 */
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

for (const [lang, url] of [['ja', 'http://localhost:3000/pay-report.html'],
                           ['en', 'http://localhost:3000/en/pay-report.html']]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  /* S2〜S4 は条件を満たすまで hidden。閉じたまま測ると幅が 0 になり、
     全部の select が「溢れている」と出る。先に開けてから測る。
     ja と en は同一オリジンなので、前の言語のプリセットも消しておく。 */
  await page.evaluate(() => {
    localStorage.clear();
    /* ★2026-08-13 から、入口の2択で「手で入力」を押すまでフォームが出ない。
       押さずに測ると s1〜s4 が hidden のままで、全部が「幅0＝溢れている」になる。 */
    const em = document.getElementById('entry-manual');
    if (em) em.click();
    const put = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    /* ★段（s2〜s4）は前の段のゲートを満たすまで hidden。ゲートは
       pay-report.html の GATE_ROLE / GATE_HOURS / GATE_PAY と同じ顔ぶれ。
       あちらに必須を1つ足したらここも足す（足さないと「開けきれていない」で落ちる）。 */
    put('f-airline', 'emirates'); put('f-position', 'cap'); put('f-fleet', 'b777');
    /* ★教官も選ぶ。選ばないと教官の節ごと hidden で、中の select が測れない。 */
    put('f-jobrole', 'line,instructor,examiner,union,management,nonline');
    if (typeof syncRoleBoxes === 'function') syncRoleBoxes();
    put('f-age', '40-49');
    put('f-block', '86.5'); put('f-stay', '12');
    put('f-currency', 'AED'); put('f-gross', '77800'); put('f-netpay', '71600');
    put('f-bonus-mo', '0'); put('f-perdiem', '6200');
    put('f-housing', 'allowance'); put('f-housing-amt', '17500');
    put('f-contract', 'direct'); put('f-taxcountry', 'AE'); put('f-seniority', '12');
    put('f-base', '48500');
    for (const c of [...document.querySelectorAll('.chip[data-open]')]) c.click();
    /* ★変動給の「種類」は行の中にあるので、1行足さないと測れない
       （2026-08-26 に10択へ増えた。いちばん長い語が入りきるかを見たい）。 */
    const d = document.getElementById('pay-detail');
    if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); }
    if (typeof pdAdd === 'function') pdAdd('var', true);
    /* ★教官・審査・管理職の「支給単位」と組合の「支給元」は、追加の支給が「ある」を
       選ぶまで出ない（2026-08-26 その3〜その6）。選ぶ値が組合だけ違う。
       ★兼務・配属（2026-08-27 その7）は select が「追加報酬」の1つだけ（支給単位を聞かない）。 */
    for (const [did, eid, v] of [['instr-detail', 'f-instr-extra', 'separate'],
                                 ['exam-detail', 'f-exam-extra', 'separate'],
                                 ['union-detail', 'f-union-extra', 'yes'],
                                 ['mgmt-detail', 'f-mgmt-extra', 'separate'],
                                 ['nonline-detail', 'f-nonline-extra', 'separate']]) {
      const dd = document.getElementById(did);
      if (dd) { dd.open = true; dd.dispatchEvent(new Event('toggle')); }
      if (document.getElementById(eid)) put(eid, v);
    }
  });
  await new Promise((r) => setTimeout(r, 400));
  const hidden = await page.evaluate(() =>
    ['s1', 's2', 's3', 's4'].filter((id) => document.getElementById(id).offsetParent === null));
  if (hidden.length) throw new Error('測る前に開けきれていない: ' + hidden.join(','));

  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d');
    const out = [];
    /* ★measure するのは <select> だけ。f-nationality は 2026-08-12 に欄ごと廃止、
       f-jobrole は 2026-08-26 にチェックボックス群になった（どちらも options が無い）。 */
    const targets = ['f-currency', 'f-taxcountry', 'f-airline', 'f-fleet', 'f-position', 'f-housing', 'f-contract']
      .map((id) => [id, document.getElementById(id)]);
    const vb = document.querySelector('#pd-var-rows .pd-basis');
    if (vb) targets.push(['pd-basis〈変動給の種類〉', vb]);
    for (const [id, nm] of [['f-instr-extra', '教官・追加報酬'], ['f-instr-method', '教官・支給単位'],
                            ['f-exam-extra', '審査・追加報酬'], ['f-exam-method', '審査・支給単位'],
                            ['f-union-extra', '組合・追加報酬'], ['f-union-src', '組合・支給元'],
                            ['f-mgmt-extra', '管理職・追加報酬'], ['f-mgmt-method', '管理職・支給単位'],
                            ['f-nonline-extra', '兼務・配属・追加報酬']]) {
      const el = document.getElementById(id);
      if (el) targets.push([`${id}〈${nm}〉`, el]);
    }
    for (const [id, el] of targets) {
      if (!el || !el.options) continue;
      const cs = getComputedStyle(el);
      cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      // select の中身が使える横幅 = box幅 - 左右padding - 矢印分
      const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
      const avail = el.getBoundingClientRect().width - padL - padR;
      let worst = null;
      for (const o of el.options) {
        const w = cv.measureText(o.textContent).width;
        if (!worst || w > worst.w) worst = { w, t: o.textContent };
      }
      out.push({ id, box: Math.round(el.getBoundingClientRect().width), avail: Math.round(avail),
                 need: Math.round(worst.w), over: Math.round(worst.w - avail), worst: worst.t,
                 selNeed: Math.round(cv.measureText(el.selectedOptions[0] ? el.selectedOptions[0].textContent : '').width) });
    }
    // ラベルの行数ズレ（grid の中で input の上端が揃っているか）
    const rows = [];
    for (const g of document.querySelectorAll('.grid2, .grid3')) {
      const tops = [...g.querySelectorAll('.form-input')].map((i) => Math.round(i.getBoundingClientRect().top));
      const labs = [...g.querySelectorAll('.form-label')].map((l) => Math.round(l.getBoundingClientRect().height));
      if (new Set(tops).size > 1) rows.push({ tops, labelHeights: labs, txt: [...g.querySelectorAll('.form-label')].map((l) => l.textContent.trim()) });
    }
    return { out, rows };
  });

  console.log(`\n════ ${lang} ════`);
  for (const o of r.out) {
    const flag = o.over > 0 ? `❌ ${o.over}px はみ出す` : '✅';
    console.log(`${flag}  #${o.id}  box=${o.box} 使える=${o.avail} 最長=${o.need} 「${o.worst}」`);
  }
  console.log(`--- input の上端が揃っていない grid: ${r.rows.length} 箇所 ---`);
  for (const x of r.rows) console.log(`  tops=${x.tops.join(',')}  labelH=${x.labelHeights.join(',')}  ${x.txt.join(' | ')}`);

  /* ── 狭い幅：常設バーと横溢れ ─────────────────────────────── */
  console.log('--- 狭い幅（常設バー / 横溢れ）---');
  for (const w of [320, 360, 390]) {
    await page.setViewport({ width: w, height: 760 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r2) => setTimeout(r2, 500));
    const b = await page.evaluate(() => {
      const el = document.getElementById('sticky-submit');
      const de = document.documentElement;
      const nav = document.getElementById('main-nav');
      const inner = nav && nav.firstElementChild;
      let navR = 0, navL = 0;
      if (inner) {
        navR = 0; navL = 1e9;
        [].forEach.call(inner.children, (c) => {
          if (getComputedStyle(c).display === 'none') return;
          const r3 = c.getBoundingClientRect();
          navR = Math.max(navR, r3.right); navL = Math.min(navL, r3.left);
        });
      }
      if (!el) return { none: true };
      /* ★hidden が出る・出ないの唯一の判断（position:fixed なので offsetParent は常に null）。 */
      if (el.hasAttribute('hidden')) return { hidden: true, sw: de.scrollWidth, cw: de.clientWidth, navL, navR };
      const r4 = el.getBoundingClientRect();
      /* ★金額が省略記号（…）に化けていないか。.sticky-cta-val は overflow:hidden ＋
         text-overflow:ellipsis なので、切れても箱の座標は [0,画面幅] のまま＝
         ①では捕まらない。2026-08-27、英語の 320px で「JPY / yr」が 16px ぶん
         消えていた（ボタンの文字数が言語で違い、en は 160px / ja は 118px）。 */
      const v = document.querySelector('.sticky-cta-val');
      return { left: Math.round(r4.left), right: Math.round(r4.right), width: Math.round(r4.width),
               sw: de.scrollWidth, cw: de.clientWidth, navL: Math.round(navL), navR: Math.round(navR),
               valNeed: v ? Math.ceil(v.scrollWidth) : 0, valHave: v ? Math.floor(v.clientWidth) : 0,
               navH: nav ? Math.round(nav.getBoundingClientRect().height) : -1 };
    });
    if (b.none)  { console.log(`  ${w}px  ❌ #sticky-submit が無い`); continue; }
    const hs = b.sw > b.cw ? `❌ 横に溢れている scrollWidth=${b.sw} > ${b.cw}` : '✅ 横に溢れていない';
    const navOK = b.navR <= w + 0.5 && b.navL >= -0.5 ? '✅' : `❌ ヘッダーが [${b.navL},${b.navR}]`;
    if (b.hidden) { console.log(`  ${w}px  バーは hidden（§3 がまだ出ていない）  ${hs}  ヘッダー${navOK}`); continue; }
    const barOK = b.left === 0 && b.right === w ? '✅' : `❌ [${b.left},${b.right}] であるべきは [0,${w}]`;
    const short = b.valNeed - b.valHave;
    const valOK = short > 0 ? `❌ 金額が ${short}px 切れている` : '✅ 金額が切れていない';
    console.log(`  ${w}px  バー${barOK}  ${hs}  ${valOK}  ヘッダー${navOK} h=${b.navH}`);
  }
  await page.setViewport({ width: 1440, height: 900 });
  await page.close();
}
await browser.close();
