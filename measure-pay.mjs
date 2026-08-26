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
    const put = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    put('f-airline', 'emirates'); put('f-position', 'cap'); put('f-fleet', 'b777');
    put('f-block', '86.5'); put('f-currency', 'AED'); put('f-base', '48500');
    for (const c of [...document.querySelectorAll('.chip[data-open]')]) c.click();
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
    for (const id of ['f-currency', 'f-taxcountry', 'f-airline', 'f-fleet', 'f-position', 'f-housing', 'f-contract']) {
      const el = document.getElementById(id);
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
