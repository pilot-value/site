/* pay-report の select が実際に何px足りないかを測る（目分量で直さないため）。 */
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
    put('f-jobrole', 'line'); if (typeof syncRoleBoxes === 'function') syncRoleBoxes();
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
  await page.close();
}
await browser.close();
