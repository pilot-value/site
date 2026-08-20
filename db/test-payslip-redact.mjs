/* ════════════════════════════════════════════════════════════════
   明細の自動黒塗りを、実際に送られるバイト列で検査する

   「塗ったつもり」を目視で信じない。この検査は
     ① 画面に出た黒塗り矩形が、正解の PII 領域を覆っているか
     ② ★ネットワークに実際に出ていく image_b64 を横取りして復号し、
        PII 領域の画素が本当に黒いか
   の2つを見る。②が本番。①だけ通っても、焼き込みを忘れていたら
   見た目は黒いのに中身は素通しになる。

   Anthropic は呼ばない（横取りして偽の結果を返す）＝1円もかからない。
   ついでに「解析結果→フォーム自動入力」と「自動投稿していないこと」も見る。

   前提: node serve.mjs が動いていること／node db/fixtures/make-payslips.mjs 実行済み
   実行: node db/test-payslip-redact.mjs

   ★これは**単独で走らせる。** 他の node を同時に回さない。
     OCR は 40 秒（payslip.js の OCR_MS）で打ち切る決まりで、2700×2700 の読み取りは
     CPU が空いていれば余裕で収まるが、裏で別の重い処理が回っていると 40 秒を割り込む。
     割り込むと `語 0／行 0／0ms` になり、黒塗りが1つも置けず**最初の様式だけが7件落ちる**。
     製品側は正しく振る舞っている（「自動の探索ができませんでした」と大きく言い、
     当てずっぽうの黒塗りを置かない）ので、これは検査の走らせ方の問題。
     ❌ が最初の様式に固まっていて診断が `0ms` なら、それを疑う。
     ★同じ理由で、学習データの取得（十数MB）も 40 秒の中で起きる。回線が遅い日は
       1枚目だけが同じ落ち方をするので、ループの前に**暖機**を1回入れてある。
   ════════════════════════════════════════════════════════════════ */
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(DIR, 'fixtures');
const TMP = mkdtempSync(path.join(tmpdir(), 'pv-payslip-'));   // 退化画像の置き場（リポジトリに残さない）
const URL_JA = 'http://localhost:3000/pay-report.html';
const FN = '/functions/v1/parse-payslip';

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}${extra ? ' → ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' → ' + extra : ''}`); }
};

/* 偽の解析結果。実在の明細ではないし、API も叩かない。 */
const FAKE = {
  ok: true,
  result: {
    currency: 'JPY',
    period: { year: 2026, month: 7 },
    earnings: [
      { label: '基本給', amount: 420000, kind: 'base' },
      { label: '職務手当', amount: 185000, kind: 'command' },
      { label: '変動付加乗務手当', amount: 148200, kind: 'flight_variable' },
      { label: '深夜割増', amount: 23400, kind: 'flight_variable' },
      { label: '住宅手当', amount: 60000, kind: 'housing' },
      { label: '通勤手当', amount: 18000, kind: 'transport' },
      { label: '日当（非課税）', amount: 42000, kind: 'per_diem' },
    ],
    deductions_total: 221354,
    net_pay: 690146,
    hours: [
      { label: '総勤務時間', value: 168.5, kind: 'duty' },
      { label: '乗務時間', value: 78.2, kind: 'block' },
      { label: '深夜時間', value: 12.0, kind: 'night' },
    ],
    unmapped: [{ label: '特別加算', amount: 12000 }],
    confidence: 'high',
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALL = JSON.parse(readFileSync(path.join(FIX, 'payslips.json'), 'utf8'));

/* ★1つの様式だけを見たいとき: node db/test-payslip-redact.mjs --id cn,sea
   1枚 40 秒級の OCR を26回まわすと1回15分かかり、赤が出た様式を
   もう一度見るだけで同じ時間を払うことになる。既定は今までどおり全部。
   ★下の実装検査（payslip.js を読むだけの節）は fixtures に依らないので、
   絞って走らせても消えない。 */
const only = (() => {
  const i = process.argv.indexOf('--id');
  return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null;
})();
const fixtures = only ? ALL.filter((f) => only.has(f.id)) : ALL;
if (only && !fixtures.length) { console.error('その id の様式が無い'); process.exit(1); }
if (only) console.log(`※ --id 指定: ${fixtures.map((f) => f.id).join(', ')}（全 ${ALL.length} 枚のうち）`);

/* ★明細の欄は最初 hidden。入口カードを押さないと出てこない。

   pay-report.html の入口を2択（明細を落とす／手で入れる）にした回から、
   明細一式は <div class="ps" id="ps" hidden> の中に入り、#entry-payslip を
   押したときだけ現れるようになった。この検査はそれを知らないまま隠れた
   #ps-file に直接 uploadFile していたので、確認画面が高さ0で描かれ、
   「幅が足りない」「明細が戻らない」と嘘の落ち方をして最後に例外で止まっていた。

   ＝黒塗りの検査が、本番のせいではなく段取りのせいで死んでいた。
   画面の入口を変えたらここも直す。ページを開いたら必ずこれを通す。 */
const openPayslip = async (page) => {
  await page.waitForSelector('#entry-payslip', { timeout: 10000 });
  await page.click('#entry-payslip');
  await page.waitForFunction(() => {
    const n = document.getElementById('ps');
    return !!n && !n.hidden && n.offsetHeight > 0;
  }, { timeout: 10000 });
};

/* ★端末の言語を、その明細を持っている人の端末に合わせる。
   payslip.js の SCRIPT_PACK は navigator.languages を見て OCR の学習データを
   1つだけ足す（zh→chi_sim / ko→kor）。検査のブラウザは既定で en-US なので、
   そのままだと中国・韓国の明細を jpn+eng だけで読むことになり、
   **本番では起きない落ち方**（ハングルが1文字も読めない）を測ってしまう。
   実際 kr は「계좌번호」を読めず口座番号が素通りしていた＝検査の設定のせい。
   ラテン文字（独・仏）は eng で読めるので locale を持たせていない。 */
const useLocale = async (page, locale) => {
  if (!locale) return;
  const langs = [locale, locale.split('-')[0], 'en-US'];
  await page.setExtraHTTPHeaders({ 'Accept-Language': langs.join(',') });
  await page.evaluateOnNewDocument((ls) => {
    Object.defineProperty(navigator, 'languages', { get: () => ls });
    Object.defineProperty(navigator, 'language', { get: () => ls[0] });
  }, langs);
};

const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });

/* ★測る前に、学習データを1回だけ落としておく（暖機）。
   OCR は tesseract 本体と学習データ（jpn+eng で十数MB）を CDN から取りに行く。
   **その通信も 40 秒（payslip.js の OCR_MS）の中で起きる**ので、回線が遅い日は
   1枚目だけが 語0／0ms で終わり、黒塗りが1枚も置けずに7件まとめて赤くなる。
   これは検査の走り出しの都合であって黒塗りの実力ではない（2枚目以降は
   IndexedDB から読むので同じ様式が緑になる＝再現条件が「順番」でしか変わらない）。
   ここで先に温めておけば、下のループは**どの様式も同じ条件**で測れる。
   ★製品の「落としきれなかったとき」の振る舞いは、下の「退化画像」の節が
     別に見ている（画面が黙らず、枠を全体にして大きく警告する）。 */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
  await page.goto(URL_JA, { waitUntil: 'networkidle2', timeout: 30000 });
  await openPayslip(page);
  /* PDF は OCR を回さない＝暖機にならないので、画像の様式を1枚選ぶ */
  const warm = fixtures.find((f) => !/\.pdf$/i.test(f.file)) || fixtures[0];
  await (await page.$('#ps-file')).uploadFile(path.join(FIX, warm.file));
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const c = document.getElementById('ps-confirm');
    return !!c && !c.disabled;
  }, { timeout: 180000 });
  console.log(`※ OCR の学習データを先に取得（暖機 ${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  await page.close();
}

/* 「探している最中」を実際に何回観測できたか。0 なら、下の assertion が
   一度も本物の待機画面を見ないまま緑になっている＝信号として死んでいる。 */
let sawWaiting = 0;

for (const fx of fixtures) {
  const isPdf = /\.pdf$/i.test(fx.file);
  console.log(`\n══ ${fx.id} （PII ${fx.pii.length} 箇所${isPdf ? '・PDF' : ''}）`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
  await useLocale(page, fx.locale);

  let sent = null;                                   // 実際に出ていったリクエスト本文
  let ocrFetched = false;                            // tesseract を取りに行ったか
  const rpcCalls = [];                               // 投稿系 RPC を呼んでいないかを見る
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (/tesseract/i.test(u)) ocrFetched = true;
    if (u.includes('/rest/v1/rpc/')) rpcCalls.push(u.split('/rpc/')[1].split('?')[0]);
    if (!u.includes(FN)) return req.continue();
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
    try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = { _unparsable: true }; }
    req.respond({
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify(FAKE),
    });
  });

  await page.goto(URL_JA, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  await openPayslip(page);

  // ── ① 落とす → 探している間は明細を出さない → 探し終わる ─────────
  const input = await page.$('#ps-file');
  await input.uploadFile(path.join(FIX, fx.file));
  // PDF は先に pdf.js を取りに行くぶん、確認画面が出るまで少し遅い
  await page.waitForSelector('.ps-edit', { timeout: isPdf ? 30000 : 8000 });

  /* ★探している最中の画面を**その場で**測る。
     以前は明細を先に描いて、探索の結果をあとから上に乗せていた。その数秒は
     「黒塗りの無い明細」と「送る」ボタンが並んで見え、出来上がりと見まちがえて
     送れてしまう。送信ボタンは元から disabled だが、disabled は目に入らない。
     ここは**探索が終わる前**にしか観測できないので、待つより先に測る。 */
  const during = await page.evaluate(() => {
    const vis = (s) => {
      const n = document.querySelector(s);
      return !!n && getComputedStyle(n).display !== 'none' && n.offsetHeight > 0;
    };
    return {
      waiting: !!document.querySelector('.ps-edit.is-wait'),
      stage: vis('.ps-stage'), send: vis('.ps-btn-go'), wait: vis('.ps-wait'),
    };
  });
  /* PDF に文字の層があるときは OCR を回さないので、ここに来た時点でもう
     探し終わっていることがある。それは正しい姿なので「隠れていない」を赤にしない。
     見るのは**探している最中なら必ず隠れている**こと。実際に隠れた状態を
     一度も観測しないまま緑になっては意味が無いので、下の sawWaiting で数える。 */
  if (during.waiting) sawWaiting++;
  ok(!during.waiting || (!during.stage && !during.send && during.wait),
    '★探している間は明細も「送る」も画面に出ていない',
    during.waiting
      ? `探索中に観測／明細=${during.stage ? '出' : '無'} / 送る=${during.send ? '出' : '無'}`
        + ` / 待機の箱=${during.wait ? '出' : '無'}`
      : '観測した時点で探索は終わっていた（PDF の文字の層＝OCR を回していない）');

  /* ★層B（ラベルOCR）が終わるまで待つ。確認チェックが押せるようになる＝探索終了。
     初回だけ学習データ 8.7MB を取りに行くので長めに待つ（以降は IndexedDB から）。 */
  await page.waitForFunction(() => {
    const c = document.getElementById('ps-confirm');
    return !!c && !c.disabled;
  }, { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 250));

  /* ── PDF は「読み取る」のではなく「そのまま読む」──────────────
     ★ここが PDF を足した意味。文字が文字として入っているので、
       OCR の読み違いが原理的に起きない＝社員番号を塗り残す余地が無い。
       裏を返すと、OCR に落ちていたらそれは静かな後退なので、
       tesseract を**一度も取りに行っていない**ことまで実測で押さえる。 */
  if (isPdf) {
    const note = await page.evaluate(() => (document.getElementById('ps-scan') || {}).textContent || '');
    ok(/PDF の文字をそのまま読めました/.test(note), '★PDF の文字の層をそのまま読んだ', note.slice(0, 90));
    ok(!ocrFetched, '★PDF では OCR を一度も動かさない（読み違いが起きない）');
    /* ★規約に「2ページ目以降は送られません」と書いた。書いた以上、実測で固定する。
       この fixture の2ページ目には**別人の**氏名・社員番号・IBAN が載っている。 */
    if (fx.pages === 2) {
      ok(/2ページのうち1ページ目だけ/.test(note), '★何ページ目を読んだかを画面に出している');
    }
  }

  const view = await page.evaluate(() => {
    const box = (n) => n && ({
      x: parseFloat(n.style.left) / 100, y: parseFloat(n.style.top) / 100,
      w: parseFloat(n.style.width) / 100, h: parseFloat(n.style.height) / 100,
    });
    const fw = document.getElementById('ps-frwarn');
    return {
      rects: [...document.querySelectorAll('.ps-rect')].map(box),
      frame: box(document.querySelector('.ps-frame')),
      warnShown: !!fw && fw.style.display !== 'none',
      /* 送る画素を切り出す**元**の大きさ。fixture の width/height は CSS の大きさで
         あって画素数ではない（dsf を下げた様式では食い違う）。診断がそのまま
         「元 W×H」を持っているので、そこから読む＝診断自体もここで守られる。 */
      diag: typeof window.__psdiag === 'function' ? window.__psdiag() : '',
      /* 確認画面が**実際に何 px で出ているか**。cvNat は canvas の持つ画素数で、
         これ以上大きくは出せない（引き伸ばしても字は読めない）。 */
      cvW: (document.querySelector('.ps-cv') || {}).clientWidth || 0,
      cvNat: (document.querySelector('.ps-cv') || {}).width || 0,
      /* 探し終わったら明細が戻っていること（隠したまま詰まない） */
      stageBack: (() => {
        const n = document.querySelector('.ps-stage');
        return !!n && getComputedStyle(n).display !== 'none' && n.offsetHeight > 0;
      })(),
    };
  });
  const dm = /元 (\d+)×(\d+)/.exec(view.diag || '');
  const srcW = dm ? +dm[1] : fx.width, srcH = dm ? +dm[2] : fx.height;
  ok(!!dm, '診断が切り出し元の大きさを持っている', dm ? `${srcW}×${srcH}` : '読めない');
  const rects = view.rects;
  /* 層B（ラベル探索）が当たった数。上端の帯を廃止したので、ここはもう
     「必ず1枚は出る」下駄を履いていない＝**探索の実力そのもの**が出る。 */
  /* ★0枚のときは「何語読めて手がかりがいくつ立ったか」まで出す。
     出さないと、語彙が足りないのか・そもそも1語も読めなかったのか（学習データの
     取得に失敗した等）が区別できず、直しようのない赤になる。診断の1行目は
     数字と経路だけで、語の字は入っていない。 */
  ok(rects.length > 0, '層Bが黒塗りを置けた（帯の下駄なしで）',
    rects.length ? `${rects.length} 枚` : `0 枚／${(view.diag || '').split('\n')[1] || '診断なし'}`);

  /* ── 確認画面が「読める大きさ」で出ていること ──────────────────
     ★この道具の安全は、最後に**本人が字を読んで**確かめることに乗っている。
       以前は .ps-cv{max-height:62vh} で、A4縦の紙は高さで先に頭打ちになり、
       幅は本文の段組み（max-w-2xl＝約640px）の半分ほどしか使えなかった。
       字が読めないまま「氏名・社員番号・口座番号が残っていないことを確認しました」
       にチェックが付く＝**確認していないのに確認したことになる**。
       見た目の話ではなく約束が静かに外れる壊れ方なので、実測で固定する。
     ★上限は canvas の持つ画素数。それ以上に引き伸ばしても字は読めない。 */
  const wantW = Math.min(view.cvNat, 900);
  ok(view.cvW >= wantW,
    '★確認画面が読める幅で出ている（62vh で本文段組みに閉じ込めない）',
    `${view.cvW}px（元 ${view.cvNat}px／要 ${wantW}px 以上）`);
  ok(view.stageBack, '★探し終われば明細が戻る（隠したまま詰まらない）');

  /* ── 送る枠 ────────────────────────────────────────────────
     ★守りが2枚になった。1枚目は**枠の外を画像ごと切り落とす**こと、
       2枚目はこれまでどおり枠の中を黒く塗ること。
       だから正解の見方も1つの規則にまとめる：
         「枠の外に出ている」か「黒く塗られている」か、そのどちらか。
       枠にまたがる領域は、**枠に残るぶんだけ**を黒く塗れていればよい。 */
  ok(!!view.frame, '送る枠が置かれている',
    view.frame ? `${(view.frame.w * 100).toFixed(0)}%×${(view.frame.h * 100).toFixed(0)}%`
      + (view.frame.w * view.frame.h > 0.995 ? '（画像全体）' : '') : 'なし');
  const F = view.frame || { x: 0, y: 0, w: 1, h: 1 };
  const clip = (b) => {
    const x0 = Math.max(b.x, F.x), y0 = Math.max(b.y, F.y);
    const x1 = Math.min(b.x + b.w, F.x + F.w), y1 = Math.min(b.y + b.h, F.y + F.h);
    return (x1 > x0 && y1 > y0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  };

  /* ★枠が自動で置けなかったときは、画像全体が送られる。そのことを画面が
     **大きく**言っていなければならない。黙って全部送るのが一番重い壊れ方で、
     しかも画面には「n か所を塗りました」と成功のように出てしまう。 */
  const whole = F.w * F.h > 0.995;
  ok(whole === view.warnShown,
    whole ? '★枠が画像全体のときは「全部送る」と画面が警告している'
      : '★枠が絞れているときに余計な警告を出していない',
    `枠=${whole ? '全体' : '一部'} / 警告=${view.warnShown ? '出ている' : '出ていない'}`);

  // 正解の PII 領域が矩形の和で覆われているか（格子で数える）
  const covered = (b) => {
    const N = 12;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const px = b.x + b.w * (i / N), py = b.y + b.h * (j / N);
      if (!rects.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)) return false;
    }
    return true;
  };
  /* ★ここだけは「自動で覆えること」を求めない様式がある。
     jp-full-small は、実測した症状（現実の写真で口座の行が塗られない）を
     再現するために**わざと画素を粗くした**もので、同じ中身が原寸なら5か所とも通る。
     OCR は内部で 2800px まで拡大するが、引き伸ばしても情報は増えない＝物理的な限界で、
     語彙や様式をいくら足しても越えられない。そこがこの反転の出発点だった。
     この場合に product が約束しているのは「自動で塗れる」ではなく
       ① 枠が置けなかったことを画面で**大きく**言う（下の whole===warnShown で実測）
       ② 本人が枠を合わせれば、読めなかったものも画像ごと消える
     の2つで、②は下の「手で枠を合わせる」節が5か所すべてを実測している。
     ここを赤いままにすると、通らないことが分かっている赤が常駐して
     テスト全体が信号として死ぬ。かわりに**黙って緑にせず**、
     覆えていないことと、どこで担保しているかを1行ずつ出す。
     ★この逃げ道は id を名指ししているので、他の様式が枠を置けなくなったら
       そちらは今まで通り赤くなる（自動で緩くはならない）。 */
  const NO_AUTO_FRAME = new Set(['jp-full-small']);
  const degraded = NO_AUTO_FRAME.has(fx.id);
  if (degraded) {
    ok(whole, '★画素が粗すぎて枠が置けない様式であることを確認（緩めてよい前提）',
      whole ? '枠=画像全体' : '枠が置けている＝前提が変わった');
  }
  for (const b of fx.pii) {
    const c = clip(b);
    if (degraded && c && !covered(c)) {
      ok(true, `△ 自動では覆えない（画面が警告済み／手で枠を合わせる節で消えることを実測）「${b.text}」`);
      continue;
    }
    ok(!c || covered(c), `PII が枠の外か黒く覆われている「${b.text}」`,
      c ? (covered(c) ? '枠の中・黒' : '枠の中・素通り') : '枠の外＝切り落とし');
  }

  /* ★塗りすぎも切りすぎも失敗。「隠す」だけを測っていると、この向きの壊れ方は見えない。
     ラベルの行を画像の右端まで塗る実装だと、左に個人情報・右に勤務時間表という
     実在の組み方で時間の列ごと潰れ、時給（このサイトの中心）が出せなくなる。
     枠を入れたことで**切り落として同じことが起きる**経路が増えたので、
     解析に要る値が枠の中に丸ごと残っているかも一緒に見る。 */
  const hits = (b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return rects.some((r) => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
  };
  const held = (b) => b.x >= F.x - 1e-6 && b.y >= F.y - 1e-6
    && b.x + b.w <= F.x + F.w + 1e-6 && b.y + b.h <= F.y + F.h + 1e-6;
  for (const b of fx.keep || []) {
    ok(held(b), `★枠が切り落としていない（解析に要る値）「${b.text}」`);
    ok(!hits(b), `★塗りすぎていない（残すべき値）「${b.text}」`);
  }

  /* ── ①-b 確認を入れるまでは送れない ────────────────────────
     規約に「本人が確認したうえで送る」と書く以上、確認なしで1バイトも
     出ていかないことを実測で押さえる。ボタンの見た目ではなく通信で見る。 */
  await page.click('#ps-send').catch(() => {});           // disabled なので何も起きないはず
  await new Promise((r) => setTimeout(r, 400));
  ok(sent === null, '確認チェック前は送信されない', sent ? '出てしまった' : '');

  // ── ② 確認を入れて送る → 実際に出ていったバイト列を検査 ──────
  await page.click('#ps-confirm');
  await page.click('#ps-send');
  await page.waitForFunction(() => !!document.querySelector('.ps-res, .ps-msg-warn'), { timeout: 15000 });

  ok(!!sent && typeof sent.image_b64 === 'string' && sent.image_b64.length > 1000,
    '画像が送信された', sent ? `${Math.round((sent.image_b64 || '').length / 1024)}KB(b64)` : 'なし');
  ok(!!sent && Object.keys(sent).sort().join(',') === 'image_b64,lang,mime',
    '送っているのは画像・MIME・言語だけ', sent ? Object.keys(sent).sort().join(',') : '');

  if (sent && sent.image_b64) {
    /* ★送る画像は枠の切り出しなので、正解の座標も枠の座標系へ移す。
       枠の外に出ているものは**画像に存在しない**＝測るべき画素が無い。 */
    const mapped = fx.pii.map((b) => {
      const c = clip(b);
      return c && { x: (c.x - F.x) / F.w, y: (c.y - F.y) / F.h, w: c.w / F.w, h: c.h / F.h };
    });
    const shot = await page.evaluate(async (b64, boxes) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const out = [];
      for (const b of boxes) {
        let max = 0;
        const N = 14;
        for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
          const px = Math.min(c.width - 1, Math.round((b.x + b.w * (i / N)) * c.width));
          const py = Math.min(c.height - 1, Math.round((b.y + b.h * (j / N)) * c.height));
          const d = cx.getImageData(px, py, 1, 1).data;
          max = Math.max(max, 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]);
        }
        out.push(Math.round(max));
      }
      return { w: c.width, h: c.height, maxLum: out };
    }, sent.image_b64, mapped.filter(Boolean));

    let mi = 0;
    fx.pii.forEach((b, i) => {
      if (!mapped[i]) {
        /* ★これが反転の効き目。**検出できていようがいまいが**、枠の外は
           画像として存在しないので測るものが無い。漏れようがない。 */
        ok(true, `★枠の外なので送られた画像に存在しない「${b.text}」`);
        return;
      }
      const lum = shot.maxLum[mi++];
      if (degraded && lum > 16) {
        ok(true, `△ 自動では塗れず素通り（同じ5か所が「手で枠を合わせる」節では消えている）「${b.text}」`,
          `最大輝度 ${lum}`);
        return;
      }
      ok(lum <= 16, `★送られた画像の画素が黒い「${b.text}」`, `最大輝度 ${lum}（許容16）`);
    });
    ok(shot.w > 0 && shot.h > 0, '送られた画像が復号できる', `${shot.w}×${shot.h}`);

    /* ★切り落としを**画像の形そのもの**で押さえる。文言や UI ではなく、
       出ていったバイト列の縦横比が枠の縦横比と一致していれば、
       枠の外の画素は物理的に入っていない。 */
    const cw = F.w * srcW, ch = F.h * srcH;
    ok(Math.abs(shot.w / shot.h - cw / ch) < 0.02,
      '★送られた画像は枠の切り出しになっている（枠の外は画素として存在しない）',
      `縦横比 ${(shot.w / shot.h).toFixed(3)}（枠 ${(cw / ch).toFixed(3)}）`);
    /* ★解像度が落ちていないこと。切り出す元は原寸（PDF なら描き直した原寸）で、
       縮めるのは長辺 1568 まで。work（表示用に 1568 へ縮めた絵）から切っていると、
       ここが枠の割合のぶんだけ小さくなる＝金額の字が潰れる。 */
    const wantEdge = Math.round(Math.min(1568, Math.max(cw, ch)));
    ok(Math.abs(Math.max(shot.w, shot.h) - wantEdge) <= 2,
      '★原寸から切り出している（長辺が縮んでいない）',
      `長辺 ${Math.max(shot.w, shot.h)}px（期待 ${wantEdge}px・元 ${srcW}×${srcH}）`);
    /* ★2ページ目が混ざっていないことを、画像そのものの形で見る。
       混ざれば縦が倍になって縦横比が半分になる＝別人の氏名・IBAN が
       黒塗りされないまま米国へ出ていく、という一番重い事故がここで止まる。 */
    if (fx.pages === 2) {
      const want = cw / ch, got = shot.w / shot.h;
      ok(Math.abs(got - want) < 0.02,
        '★送った画像は1ページ目だけ（2ページ目の別人の氏名・口座は入っていない）',
        `縦横比 ${got.toFixed(3)}（1ページ目の枠 ${want.toFixed(3)}）`);
    }
  }

  // ── ③ 解析結果がフォームに入り、★勝手に投稿されていない ──
  if (fx.id === fixtures[0].id) {
    /* ★内訳の表・控除合計・分類できなかった行は <details class="ps-fold"> に畳んである。
       読み取り直後に見たいのは時給と年収ペースであって表ではない、という設計判断で、
       payslip.js に理由つきで書いてある。innerText は閉じた details の中を返さないので、
       ここで開いてから読む。開かずに読むと「捨てている」と誤って落ちる。 */
    await page.evaluate(() => {
      document.querySelectorAll('details.ps-fold').forEach((d) => { d.open = true; });
    });
    const v = await page.evaluate(() => {
      const g = (id) => (document.getElementById(id) || {}).value;
      return {
        base: g('f-base'), command: g('f-command'), other: g('f-other'),
        perdiem: g('f-perdiem'), transport: g('f-transport'),
        housing: g('f-housing'), housingAmt: g('f-housing-amt'),
        block: g('f-block'), cur: g('f-currency'), y: g('f-year'), m: g('f-month'),
        marked: document.querySelectorAll('.ai-filled').length,
        rate: (document.getElementById('ps-rate') || {}).textContent || '',
        formBodyHidden: document.getElementById('form-body').hidden,
        s1: document.getElementById('s1').offsetParent !== null,
        res: (document.querySelector('.ps-res') || {}).innerText || '',
      };
    });
    /* ★金額の欄は桁区切りを入れて表示する（"420,000"）。生の数字と見比べる。
       ここを `=== '420000'` のままにすると、桁区切りを入れた回に全件が落ちて
       「フォームに入っていない」という嘘の落ち方をする（実際にそうなっていた）。 */
    const dg = (s) => String(s == null ? '' : s).replace(/[^\d.-]/g, '');
    ok(dg(v.base) === '420000', '基本給が入る', v.base);
    ok(dg(v.command) === '185000', '職務手当が機長・役職手当に入る', v.command);
    /* ★2026-08-14：分類できなかった「特別加算 12,000」もここに入る（148200+23400+12000）。
       前はどの欄にも入らず、年収から黙って消えていた。 */
    ok(dg(v.other) === '183600',
       '★変動乗務手当＋分類できなかった行がその他手当に入る（148200+23400+12000）', v.other);
    ok(dg(v.perdiem) === '42000', 'パーディアムが入る', v.perdiem);
    ok(dg(v.transport) === '18000', '交通費が入る', v.transport);
    ok(v.housing === 'allowance' && dg(v.housingAmt) === '60000', '住宅手当が現金として入る', v.housingAmt);
    ok(dg(v.block) === '78.2', '乗務時間が入る', v.block);
    ok(v.cur === 'JPY', '通貨が入る', v.cur);
    ok(v.y === '2026' && v.m === '7', '対象月が入る', `${v.y}/${v.m}`);
    ok(v.marked >= 8, 'AIが埋めた欄がハイライトされている', `${v.marked} 欄`);
    /* ★入口で「明細から自動入力」を選んだ時点ではフォームはまだ出ていない（ステップ 1/2）。
       読めた時点で payslip.js が window.PVEnterMode('manual') を呼んで出す。
       ここが出ないと、読み取れても入力を始められないまま行き止まりになる。
       ★2段目以降（会社・職位・機材）は前の段が埋まってから開く段階表示なので、
       明細だけでは開かない。**開いていないのが正しい。**
       代わりに「あと何が要るか」を画面が言っているかを見る。 */
    ok(!v.formBodyHidden && v.s1, '読み取れたらフォームが出る（ステップ 1/2 → 2/2）',
      v.formBodyHidden ? 'form-body が隠れたまま' : '');
    ok(/あと\d+つで送信できます/.test(v.res) && /会社と職位を選ぶ/.test(v.res),
      '★あと何が要るかを画面が言っている（会社・職位・機材は明細に書いていない）');
    ok(/乗務時間あたり/.test(v.rate), '乗務時間あたりの時給が出る');
    ok(/総勤務時間あたり/.test(v.rate), '★総勤務時間あたりの時給が出る（自分では思いつかない方）');
    ok(!rpcCalls.includes('submit_pay_report'),
      '★勝手に投稿していない（submit_pay_report を1度も呼んでいない）',
      rpcCalls.length ? rpcCalls.join(',') : 'RPC 呼び出しなし');

    const body = await page.evaluate(() => document.body.innerText);
    ok(/まだ投稿されていません/.test(body), '「まだ投稿されていません」と書いてある');
    ok(/特別加算/.test(body), '分類できなかった項目を黙って捨てていない');
    ok(/221,354/.test(body) && /690,146/.test(body), '控除合計・差引支給額を画面に出している');

    /* ── 分類できなかった行の扱い（2026-08-14）────────────────────
       前は「これはどれですか？ 分かる方はあとで手で入れてください」と宿題を出し、
       金額はどの欄にも入っていなかった。＝明細を落とした人ほど年収が低く出た。
       いまは金額を先に数えて、最後に軽く1問だけ聞く。答えなくても完成している。 */
    const q = await page.evaluate(() => {
      const c = document.querySelector('.ps-q');
      if (!c) return null;
      return {
        t: (c.querySelector('.ps-q-t') || {}).textContent || '',
        label: (c.querySelector('.ps-q-lb') || {}).textContent || '',
        amount: (c.querySelector('.ps-q-am') || {}).textContent || '',
        skip: !!c.querySelector('.ps-q-skip'),
        chips: [].map.call(c.querySelectorAll('.ps-q-c .chip'), (b) => b.textContent),
        inFold: !!c.closest('details'),
      };
    });
    ok(!!q, '★分類できなかった行があると、最後に確認カードが出る');
    if (q) {
      ok(/あと1項目/.test(q.t), '聞くのは1件ずつ（残り件数を出す）', q.t);
      ok(/特別加算/.test(q.label) && /12,000/.test(q.amount), 'ラベルと金額をそのまま見せる',
         `${q.label} ${q.amount}`);
      ok(q.skip, '★スキップが必ず在る（答えなくてもレポートは完成している）');
      ok(q.chips.length === 6, '6択', q.chips.join('／'));
      ok(!q.inFold, '★畳んだ内訳の外に出ている（中だと既定で閉じていて誰にも見えない）');

      /* 「賞与・一時金」を押す＝6択のうち年収が実際に動く2つの片方。
         その他手当から抜けて賞与の欄へ移る。移した先を空にし忘れると二重に数える。 */
      await page.evaluate(() => {
        const b = document.querySelectorAll('.ps-q-c .chip')[3];
        if (b) b.click();
      });
      const after = await page.evaluate(() => {
        const g = (id) => (document.getElementById(id) || {}).value;
        return { other: g('f-other'), bonus: g('f-bonus-mo'), detail: g('f-psdetail'),
                 card: !!document.querySelector('.ps-q') };
      });
      ok(dg(after.bonus) === '12000', '答えると賞与の欄へ移る', after.bonus);
      ok(dg(after.other) === '171600', '★移した元（その他手当）から抜けている＝二重に数えない',
         after.other);
      ok(!after.card, '答え終わったらカードごと消える（1件しか無かった）');
      ok(/"asked":"bonus"/.test(after.detail || ''),
         '★本人の答えが内訳データに残る（これが語彙の正解データになる）');
    }
  }

  await page.close();
}

/* ══ 手で枠を合わせる ══════════════════════════════════════════
   ★この節がこの反転そのものの証明。

   jp-full-small は jp-full と**紙の作りが1バイトも同じ**で、画素の細かさだけが
   0.62 倍になっている。それだけで最下部の口座の表が1文字も読めなくなり、
   これまでの「探して塗る」では黒塗りが1枚も当たらず、そのまま外へ出ていた。
   引き伸ばしても情報は増えないので、検出をどれだけ賢くしても直らない。

   枠にすると、読めていようがいまいが枠の外は画像として存在しない。
   ここでは自動配置に頼らず、**四隅のつまみを本物のポインタで引いて**
   人が枠を合わせたときに、5つの個人情報が送られたバイト列から
   物理的に消えることを測る。 */
console.log('\n══ 手で枠を合わせる（読めなかった個人情報が本当に消えるか）');
{
  /* ★様式があるかは**常に全枚**を見る（--id で絞っても、この節が黙って消えない）。
     節そのものは、その様式を選んでいるときだけ動かす。 */
  const fx = ALL.find((f) => f.id === 'jp-full-small');
  if (!fx) ok(false, 'jp-full-small の様式がある');
  else if (only && !only.has(fx.id)) console.log('  … --id で外したので飛ばす');
  else {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
    let sent = null;
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (!u.includes(FN)) return req.continue();
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS, body: '' });
      try { sent = JSON.parse(req.postData() || '{}'); } catch { sent = { _unparsable: true }; }
      req.respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(FAKE) });
    });
    await page.goto(URL_JA, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));
    await openPayslip(page);
    const inp = await page.$('#ps-file');
    await inp.uploadFile(path.join(FIX, fx.file));
    await page.waitForSelector('.ps-edit', { timeout: 8000 });
    await page.waitForFunction(() => {
      const c = document.getElementById('ps-confirm');
      return !!c && !c.disabled;
    }, { timeout: 90000 });
    await new Promise((r) => setTimeout(r, 250));

    /* ★出発点の確認。ここが「自動で n か所塗りました」と成功のように出ていたら、
       本人は枠を直す理由に気づけない＝黙って全部送る。 */
    const before = await page.evaluate(() => {
      const n = document.querySelector('.ps-frame');
      const fw = document.getElementById('ps-frwarn');
      return {
        w: n ? parseFloat(n.style.width) : 0, h: n ? parseFloat(n.style.height) : 0,
        warn: !!fw && fw.style.display !== 'none',
        warnText: fw ? fw.textContent : '',
      };
    });
    ok(before.w > 99 && before.h > 99, '字が潰れて読めない画像では枠が画像全体になる',
      `${before.w.toFixed(0)}%×${before.h.toFixed(0)}%`);
    ok(before.warn && /画像がすべて送られます/.test(before.warnText),
      '★そのことを画面が大きく言っている（黙って全部送らない）');

    // 目標の枠。上は氏名の下、左は役職員番号の右、下は口座の表の上
    const WANT = { x: 0.09, y: 0.07, x1: 1.0, y1: 0.85 };
    const stage = await page.evaluate(() => {
      const s = document.querySelector('.ps-stage').getBoundingClientRect();
      return { left: s.left, top: s.top, w: s.width, h: s.height };
    });
    const gripTo = async (sel, tx, ty) => {
      const b = await page.evaluate((s) => {
        const n = document.querySelector(s);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, sel);
      if (!b) return false;
      await page.mouse.move(b.x, b.y);
      await page.mouse.down();
      const gx = stage.left + stage.w * tx, gy = stage.top + stage.h * ty;
      // 何度かに分けて動かす（1回の跳躍だと pointermove が1つも出ない環境がある）
      for (let k = 1; k <= 6; k++) {
        await page.mouse.move(b.x + (gx - b.x) * (k / 6), b.y + (gy - b.y) * (k / 6));
      }
      await page.mouse.up();
      return true;
    };
    const okNw = await gripTo('.ps-frame-grip.is-nw', WANT.x, WANT.y);
    const okSe = await gripTo('.ps-frame-grip.is-se', WANT.x1, WANT.y1);
    ok(okNw && okSe, '四隅のつまみが画面にある（本人が枠を直せる）');

    const after = await page.evaluate(() => {
      const n = document.querySelector('.ps-frame');
      const fw = document.getElementById('ps-frwarn');
      return {
        x: parseFloat(n.style.left) / 100, y: parseFloat(n.style.top) / 100,
        w: parseFloat(n.style.width) / 100, h: parseFloat(n.style.height) / 100,
        warn: !!fw && fw.style.display !== 'none',
      };
    });
    ok(Math.abs(after.x - WANT.x) < 0.03 && Math.abs(after.y - WANT.y) < 0.03
      && Math.abs(after.x + after.w - WANT.x1) < 0.03 && Math.abs(after.y + after.h - WANT.y1) < 0.03,
      '★つまみを引いた通りに枠が動く',
      `x ${after.x.toFixed(3)}..${(after.x + after.w).toFixed(3)} y ${after.y.toFixed(3)}..${(after.y + after.h).toFixed(3)}`);
    ok(!after.warn, '枠を絞ったら「全部送ります」の警告が消える');

    /* ★解析に要る値を切っていないか。ここを見ないと「枠で全部切り落とす」で
       緑になってしまい、道具として無意味なものが通る。 */
    for (const b of fx.keep || []) {
      const held = b.x >= after.x - 1e-6 && b.y >= after.y - 1e-6
        && b.x + b.w <= after.x + after.w + 1e-6 && b.y + b.h <= after.y + after.h + 1e-6;
      ok(held, `★手で合わせた枠が解析に要る値を残している「${b.text}」`);
    }

    await page.click('#ps-confirm');
    await page.click('#ps-send');
    await page.waitForFunction(() => !!document.querySelector('.ps-res, .ps-msg-warn'), { timeout: 15000 });
    ok(!!sent && typeof sent.image_b64 === 'string', '画像が送信された');

    if (sent && sent.image_b64) {
      const shot = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/jpeg;base64,' + b64;
        await img.decode();
        return { w: img.naturalWidth, h: img.naturalHeight };
      }, sent.image_b64);
      const cw = after.w * fx.width, ch = after.h * fx.height;
      ok(Math.abs(shot.w / shot.h - cw / ch) < 0.03,
        '★送られたのは手で合わせた枠の切り出しそのもの',
        `縦横比 ${(shot.w / shot.h).toFixed(3)}（枠 ${(cw / ch).toFixed(3)}）`);
      /* ★本題。5つとも枠の外＝**送られた画像に画素として存在しない**。
         自動検出は1つも当てられていないのに、外へは出ない。 */
      for (const b of fx.pii) {
        const inside = b.x + b.w > after.x && b.x < after.x + after.w
          && b.y + b.h > after.y && b.y < after.y + after.h;
        ok(!inside, `★枠の外なので送られた画像に存在しない「${b.text}」`,
          inside ? '枠の中に残っている' : '');
      }
    }
    await page.close();
  }
}

/* 上の「探している間は隠れている」は、探索が一瞬で終わる様式では素通りする。
   本物の待機画面を一度も見ないまま緑になっていないことを、ここで数字にする。 */
ok(sawWaiting > 0, '★探している最中の画面を実際に観測できている',
  `${sawWaiting} 様式で観測`);

/* ══ 退化画像 ══════════════════════════════════════════════════
   何ひとつ読めない画像を食わせる。
   ★層Aを廃止したので、ここでの約束が**反転した**。
     旧：何も見つからなくても上端の帯だけは塗る（＝黒が必ず1つ出る）
     新：何も見つからなければ**塗らない**。代わりに画面が声を上げる。
   帯は当てずっぽうで、真っ白な写真の上2割を塗っても隠せたものは何も無い。
   「塗った気にさせる」ほうが危ない。だからここで見るのは黒の有無ではなく、
   **塗れなかったことを画面が本人に伝えているか**。伝わっていれば本人が
   枠を狭められる（枠の外は端末を出ない＝黒塗りより強い）。 */
console.log('\n══ 退化画像（何も読めないとき、画面が黙っていないか）');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1400 });
  await page.goto(URL_JA, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 400));
  await openPayslip(page);

  const cases = [
    ['真っ白（罫線も文字も無い）', 'white'],
    ['真っ黒（全面が暗い＝閾値が効かない）', 'black'],
    ['全面が一様なノイズ（空白帯が現れない）', 'noise'],
  ];
  for (const [name, mode] of cases) {
    const b64 = await page.evaluate((mode) => {
      const c = document.createElement('canvas');
      c.width = 800; c.height = 1000;
      const cx = c.getContext('2d');
      if (mode === 'white') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, 800, 1000); }
      else if (mode === 'black') { cx.fillStyle = '#000'; cx.fillRect(0, 0, 800, 1000); }
      else {
        const im = cx.createImageData(800, 1000);
        for (let i = 0; i < im.data.length; i += 4) {
          const v = ((i * 2654435761) >>> 8) & 0xff;   // 決め打ちの疑似乱数（毎回同じ絵）
          im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
        }
        cx.putImageData(im, 0, 0);
      }
      return c.toDataURL('image/png').split(',')[1];
    }, mode);

    const p = path.join(TMP, `degenerate-${mode}.png`);
    writeFileSync(p, Buffer.from(b64, 'base64'));

    await page.evaluate(() => { const n = document.getElementById('ps-panel'); if (n) n.innerHTML = ''; });
    const inp = await page.$('#ps-file');
    await inp.uploadFile(p);
    // 探索が終わるまで待つ（終わる＝確認チェックが押せるようになる）
    await page.waitForFunction(() => {
      const c = document.getElementById('ps-confirm');
      return !!c && !c.disabled;
    }, { timeout: 120000 });
    await new Promise((r) => setTimeout(r, 200));

    const m = await page.evaluate(() => {
      const scan = document.getElementById('ps-scan');
      const warn = document.querySelector('.ps-warn');
      const fw = document.getElementById('ps-frwarn');
      const vis = (n) => !!n && getComputedStyle(n).display !== 'none' && n.offsetHeight > 0;
      return {
        rects: document.querySelectorAll('.ps-rect').length,
        scan: vis(scan) ? scan.textContent : '',
        warn: vis(warn),
        frameWarn: vis(fw),
      };
    });
    /* 塗れなかったこと自体は失敗ではない（読めない画像なのだから当然）。
       失敗なのは、塗れていないのに画面が何も言わないこと。 */
    ok(m.rects === 0 && /⚠/.test(m.scan) && m.warn && m.frameWarn,
      `★塗れないときは黙っていない：${name}`,
      `黒 ${m.rects} 個／⚠探索 ${/⚠/.test(m.scan) ? '出' : '無'}／⚠塗り無し ${m.warn ? '出' : '無'}／⚠枠が全部 ${m.frameWarn ? '出' : '無'}`);
  }
  await page.close();
}

// ── コード側の約束：画像・ラベルをログに出していないこと ──────
console.log('\n══ Edge Function のログ検査');
const fn = readFileSync(path.join(DIR, '..', 'supabase', 'functions', 'parse-payslip', 'index.ts'), 'utf8');
const logs = fn.match(/console\.(log|info|warn|error|debug)\([^)]*\)/g) || [];
const bad = logs.filter((l) => /body|b64|image|parsed|raw|text|label|amount/.test(l));
ok(bad.length === 0, '画像・明細本文をログに出していない', logs.join(' / ') || 'console 呼び出しなし');
ok(!/storage|\.from\(\s*['"]/.test(fn) || !/upload|insert/.test(fn.replace(/pv_parse_quota[\s\S]{0,80}/g, '')),
  '画像を Storage にも DB にも書いていない');

/* ── 手がかり語の語彙（多言語）─────────────────────────────────
   画像を1枚ずつ通す検査だけでは、語彙は「その様式に出てくる語」しか守れない。
   ここは payslip.js の norm() / labelHit() / LABELS を**そのまま持ってきて**、
   当たるべき語と、絶対に当ててはいけない語を直接ぶつける。

   当ててはいけない側が本番。ラベル語を増やすと、明細の**項目名**に誤爆して
   支給額・控除額の行を黒く塗り潰す＝時給が出せなくなる。増やすときは
   必ずこちらにも足す。「Contribution に emp が入っている」類の事故はここで止まる。 */
console.log('\n══ 手がかり語の語彙（多言語）');
{
  const src = readFileSync(path.join(DIR, '..', 'payslip.js'), 'utf8');
  const carve = (name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('payslip.js に function ' + name + ' が無い');
    let d = 0, started = false;
    for (let k = i; k < src.length; k++) {
      if (src[k] === '{') { d++; started = true; }
      else if (src[k] === '}') { d--; if (started && d === 0) return src.slice(i, k + 1); }
    }
    throw new Error('括弧が閉じていない: ' + name);
  };
  const table = src.slice(src.indexOf('var LABELS = ['), src.indexOf('];', src.indexOf('var LABELS = [')) + 2);
  const sandbox = {};
  new Function('S', table + carve('norm') + carve('labelHit')
    + '\nfor (var i = 0; i < LABELS.length; i++) LABELS[i] = norm(LABELS[i]);'
    + '\nS.hit = function (s) { return labelHit(norm(s)); }; S.n = LABELS.length;')(sandbox);
  const hit = sandbox.hit;

  /* 当たるべき語。**印字のされ方**の揺れも一緒に見る
     （全角空き・全角コロン・アクセント・大文字・区切り記号）。 */
  const MUST = [
    ['日本', ['氏名', '氏　名', '社員番号', '役職員番号', '職員番号', '乗員番号', '口座番号',
      '振込先', '銀行', '支店', '個人番号', 'マイナンバー', '生年月日']],
    ['英語圏・湾岸', ['Name', 'Surname', 'Employee', 'Emp No', 'Staff No', 'Crew ID', 'Payee',
      'Account', 'A/C No', 'IBAN', 'Bank', 'Sort Code', 'SSN', 'Address', 'Date of Birth']],
    ['中国語', ['姓名', '工号', '账号', '帐号', '銀行', '身份证', '地址']],
    ['韓国語', ['성명', '사원번호', '계좌번호', '은행', '주소']],
    ['スペイン語・葡語', ['Nombre', 'Apellido', 'Empleado', 'Cuenta', 'Sucursal',
      'Nome', 'Matrícula', 'Agência', 'Endereço', 'CPF']],
    ['仏・独・伊・蘭', ['Nom', 'Prénom', 'Matricule', 'Compte', 'Banque',
      'Vorname', 'Personalnummer', 'Kontonummer', 'Cognome', 'Matricola',
      'Naam', 'Rekeningnummer', 'Personeelsnummer']],
    ['土・尼・越・北欧・中東欧', ['Sicil No', 'Hesap No', 'Nama', 'Rekening', 'Alamat',
      'Số tài khoản', 'Họ tên', 'Nazwisko', 'PESEL', 'Personnummer', 'Ansatt', 'Jméno']],
    ['露・亜・泰・印・希・ヘブライ', ['Фамилия', 'Табельный номер', 'Счёт', 'Адрес',
      'رقم الحساب', 'الاسم', 'البنك', 'ชื่อ', 'บัญชี', 'नाम', 'खाता', 'Ονομα', 'חשבון']],
  ];
  for (const [lang, words] of MUST) {
    const miss = words.filter((w) => !hit(w));
    ok(miss.length === 0, `${lang}：${words.length} 語すべてに当たる`, miss.join(' / '));
  }

  /* ★絶対に当ててはいけない語＝明細の項目名。ここが1つでも当たると、
     その行が丸ごと黒くなって金額か勤務時間が読めなくなる。 */
  const NEVER = [
    '基本給', '所得税', '厚生年金保険料', '雇用保険料', '支給合計', '差引支給額',
    '変動付加乗務時間', '特別勤務割増手当', '深夜時間', '乗務時間', '不就労時間',
    '乗務日数', '等級号俸', '時間外割増', '住宅手当', '共済会費',
    'Basic Salary', 'Housing Allowance', 'Flying Hours', 'Overtime', 'Gross Pay',
    'Net Pay', 'Total Deductions', 'Pension', 'Provident Fund', 'Gratuity',
    'Leave Salary', 'Ticket Allowance', 'Exemption', 'Contribution', 'Contributions',
    'Payroll Period', 'Pay Period', 'Earnings', 'Deductions', 'Year to Date',
    /* ★'Descontos'（葡・控除）は実測で足した語。イタリア語の手がかり 'conto' が
       この語のまん中に当たり、ブラジルの明細の控除合計が黒く塗られて
       読み取りが null になっていた（latam・2026-08-14）。 */
    'Charges sociales', 'Retenues', 'Impuesto', 'Descuentos', 'Descontos',
    'Total de descontos', 'Desconto', 'Grundgehalt',
    'Steuer', 'Abzüge', 'Retribuzione', 'Contributi', 'Vergi Matrahı', 'Tunjangan',
    'Podatek', 'Skatt', 'Основной оклад', 'Налог',
  ];
  const oops = NEVER.filter((w) => hit(w));
  ok(oops.length === 0,
    `★明細の項目名 ${NEVER.length} 語のどれにも当たらない（当たると金額・勤務時間の行が潰れる）`,
    oops.join(' / '));

  /* ★現実の様式がこれで落ちた。手がかり表の「職員番号」より前に1字ある
     「役職員番号」に、先頭一致だけでは永久に当たらない。 */
  ok(hit('役職員番号') && hit('役職員番号：'),
    'payslip.js: ★ラベルの**途中**でも当たる（「役職員番号」の中の「職員番号」）');
  /* ★ハングルは NFD でチャモに分解される。norm() が NFC で組み直していないと、
     韓国語のラベルだけが静かに外れる。 */
  ok(hit('사원번호') && hit('계좌번호'),
    'payslip.js: ★ハングルが分解されたまま比較されていない（norm が NFC で組み直す）');
  /* ★ラテン文字の短い語を途中一致で見ると Contribution / Exemption に誤爆する。 */
  ok(!hit('Contribution') && !hit('Exemption') && hit('Emp No'),
    'payslip.js: ★ラテン文字は4字未満だと先頭一致まで（emp が exemption に当たらない）');
  /* ★PDF から取り出した日本語は、見た目が同じでも符号が違うことがある。
     Chrome が作る PDF の「氏名」「銀行」「口座番号」は
     **康熙部首**（⽒＝U+2F12 / ⾏＝U+2F0C / ⼝＝U+2F1D）で入ってくる。
     norm() が互換の分解（NFKD）を通していないと、PDF のときだけ静かに全部外れる
     ——しかも画面では正しく見えるので、目視では絶対に気づけない。 */
  ok(hit('⽒名') && hit('銀⾏') && hit('⼝座番号'),
    'payslip.js: ★康熙部首で入っていても当たる（PDF の「⽒名」「銀⾏」「⼝座番号」）');
  ok(hit('社員番号') && hit('ＩＢＡＮ') && hit('Ａｃｃｏｕｎｔ　Ｎｏ'),
    'payslip.js: ★全角で組まれていても当たる');

  /* ★4-c OCR の誤読形。「口　座　番　号」は全角空きで組まれていて、
     tesseract は「ロロ座番号」と返す（実測）。誤読は norm() では直せない
     ——別の字なのだから当然で、直そうとすると他の一致まで一緒に動く。
     だから手がかり表の側に**返ってきた形をそのまま**持つ。
     ここが消えると、見出しが読めた日でも口座の行に手がかりが立たなくなる。 */
  ok(hit('ロ座番号') && hit('ロロ座番号') && hit('囗座番号') && hit('口坐番号'),
    'payslip.js: ★口座番号の OCR 誤読形に当たる（ロ・囗・坐）');
  /* 振込先のブロックに実際に印字される語。見出しが読めた日はこちらで当てる。 */
  ok(['振込金額', '預金種別', '口座名義', '銀行名', '支店名', '普通預金', '金融機関']
    .every((w) => hit(w)),
    'payslip.js: 振込先のブロックの実務語に当たる');
  console.log(`  … 手がかり語 ${sandbox.n} 語`);

  /* ── 4-b の語彙（bankish）は LABELS の部分集合で、**別の危なさ**を持つ ────
     bankish に当たった行は列の切れ目で止まらず**行の右端まで**塗られ、
     枠の下端もそこで切られる。誤爆したときの被害が labelHit より大きいので、
     当たるべき語と当ててはいけない語を別に固定する。 */
  const sb2 = {};
  new Function('S', src.slice(src.indexOf('var BANKY = ['), src.indexOf('];', src.indexOf('var BANKY = [')) + 2)
    + carve('norm')
    + '\nfor (var i = 0; i < BANKY.length; i++) BANKY[i] = norm(BANKY[i]);'
    + carve('bankish')
    + '\nS.bank = bankish; S.n = BANKY.length;')(sb2);
  const bank = sb2.bank;
  const BANK_MUST = ['口座', '口座番号', '振込先', '振込金額', '銀行', '銀行名', '支店', '支店名',
    '普通預金', '預金種別', '口座名義', 'Account', 'A/C No', 'IBAN', 'Bank', 'Branch', 'Sort Code',
    '계좌번호', '은행', '账号', 'Kontonummer', 'Rekeningnummer', 'رقم الحساب'];
  const bmiss = BANK_MUST.filter((w) => !bank(w));
  ok(bmiss.length === 0, `4-b：振込先の語 ${BANK_MUST.length} 語すべてに当たる`, bmiss.join(' / '));
  /* ★ここが本番。氏名・社員番号で右端まで塗ってはいけない（右に勤務時間の表が
     来る様式があり、潰すと時給が出せない）。項目名に当たるのは論外。 */
  const BANK_NEVER = ['氏名', '社員番号', '役職員番号', '住所', '生年月日', 'Name', 'Staff No',
    'Employee', 'SSN', '基本給', '所得税', '支給合計', '差引支給額', '深夜時間', '乗務時間',
    'Basic Salary', 'Gross Pay', 'Net Pay', 'Provident Fund'];
  const boops = BANK_NEVER.filter((w) => bank(w));
  ok(boops.length === 0,
    `4-b：氏名・社員番号・項目名 ${BANK_NEVER.length} 語のどれにも当たらない（当たると行の右端まで潰れる）`,
    boops.join(' / '));
  console.log(`  … 振込先の語 ${sb2.n} 語`);

  /* ── 4-e「用語のまわりの数字」の当たり方 ──────────────────────────
     4-b は**用語と同じ行**しか塗らない。だが振込先はこう組まれる：

       銀 行 ｜ 支 店 ｜ 口 座 番 号 ｜ 振 込 金 額     ← 見出し
       0009  ｜ 200  ｜ 3100343    ｜ 762,981        ← 値（口座番号はここ）

     値は**別の行**で、しかもラベルから**4列右**にある。だから 4-e は行を離れて
     用語のまわりを直接見る。ここで測るのは2つだけで、どちらも折れると静かに漏れる：
       ・広さ（nearBox）… 一段下と4列右に届くか。上と左には行き過ぎないか
       ・塗る語（numish）… 表の金額と勤務時間を巻き込まないか            */
  const sb3 = {};
  new Function('S', src.slice(src.indexOf('var BN_DOWN'), src.indexOf('\n', src.indexOf('var BN_DOWN')))
    + carve('nearBox')
    + src.slice(src.indexOf('var MONEY_SEP'), src.indexOf('\n', src.indexOf('var TIMEH')))
    + carve('numish')
    + '\nS.box = nearBox; S.num = numish; S.down = BN_DOWN; S.right = BN_RIGHT;')(sb3);
  const { box, num } = sb3;

  /* ラベル「口座番号」が y 0.800〜0.816・x 0.170〜0.260 にあるとする（行送り 0.016）。 */
  const pitch = 0.016;
  const b = box(0.800, 0.816, 0.170, 0.260, pitch);
  const inside = (w) => w.y1 >= b.top && w.y0 <= b.bot && w.x1 >= b.lft && w.x0 <= b.rgt;

  /* ★① 一段下の値に届く。isHdr（数字が1つも無い見出しの行だけ一段下に伸ばす）は
     見出しに支店番号や西暦が混じった瞬間に外れる。ここが 4-e の存在理由。 */
  ok(inside({ y0: 0.820, y1: 0.836, x0: 0.170, x1: 0.240 }),
    '4-e：★用語の**一段下**にある値が「まわり」に入る（見出しと値が別の行でも当たる）');
  /* OCR がこのブロックを2行3行に割ることがあるので、二段下でもまだ届く。 */
  ok(inside({ y0: 0.845, y1: 0.858, x0: 0.170, x1: 0.240 }),
    '4-e：OCR が行を割って値が二段下に落ちても、まだ「まわり」に入る');

  /* ★② 4列右の値に届く。銀行｜支店｜口座番号｜振込金額 が横一列に並ぶ様式。 */
  ok(inside({ y0: 0.820, y1: 0.836, x0: 0.560, x1: 0.640 }),
    '4-e：★用語の**4列右**にある値が「まわり」に入る（横一列に並ぶ振込先）');

  /* まわりは下と右に寄っている。上と左まで広げると、
     すぐ上の差引支給額・すぐ左の項目名を巻き込む。 */
  ok(!inside({ y0: 0.770, y1: 0.786, x0: 0.170, x1: 0.240 }),
    '4-e：一段より上は「まわり」ではない（すぐ上の行の金額を巻き込まない）');
  ok(!inside({ y0: 0.820, y1: 0.836, x0: 0.800, x1: 0.880 }),
    '4-e：紙の右端までは広げない');

  /* ★③ 表を巻き込まない歯止め＝numish。ここが緩むと、口座は隠れても
     金額と勤務時間が一緒に黒くなって時給が出せなくなる（＝このサイトの中身が消える）。 */
  /* ★IBAN の先頭（AE44 / GB29）は2桁しかないので、ここには入らない。それでいい
     ——隠したいのは口座番号そのもので、それは続く4桁ずつの塊（0330 0000 0123）と
     つながりの IBAN 一括のほう。2桁を拾いにいくと勤務日数の 12 まで黒くなる。 */
  const NUM_MUST = ['3100343', '5207164', '0037', '412', '0009', '520', '7164',
    '１２３４５６７', '0330', '0123', 'GB29NWBK60161331926819'];
  const nmiss = NUM_MUST.filter((t) => !num(t));
  ok(nmiss.length === 0,
    `4-e：口座・支店・銀行コードの ${NUM_MUST.length} 通りを塗る対象と見る`, nmiss.join(' / '));
  /* ★桁区切りを持つ数字＝表の金額。口座番号・支店番号は桁区切りを持たない。
     この1点だけで、表と振込先を分けている。 */
  const NUM_NEVER = ['983,300', '762,981', '1,234,567', '1.234.567', '1 234 567',
    '118H45', '164:30', '57H00', '12', '08-14', '3'];
  const noops = NUM_NEVER.filter((t) => num(t));
  ok(noops.length === 0,
    `4-e：★桁区切りのある金額・勤務時間・2桁 ${NUM_NEVER.length} 通りは塗らない（表を巻き込まない証拠）`,
    noops.join(' / '));
}

/* ── 記載と実装が合っていること ────────────────────────────────
   ★この節がこのファイルで一番重い。

   規約（personal-data.html）には「氏名・社員番号・口座番号を端末の中で
   探して塗り、本人が確認したあとの画像を Anthropic（米国）へ送る」と
   **保証として**書いてある。以前これは事実と違った——黒塗りは画像の上端に
   帯を1枚置くだけで、文字の位置を一切見ていなかった。保存していないので
   流出ではないが、世界規模＝GDPR 前提でこの記載のまま公開はできない。

   だから「文言があること」だけを見ても意味がない。**文言を支えている実装が
   消えたらここが落ちる**形にする。片方だけ直しても通らない。         */
console.log('\n══ 記載と実装の一致');
const js = readFileSync(path.join(DIR, '..', 'payslip.js'), 'utf8');

// (a) 実装側：この5つのどれが欠けても、上の保証は嘘になる
const IMPL = [
  [/tessedit_pageseg_mode/, 'OCR の領域分割が自動（PSM 3）— 既定の 6 では表組みが壊れて何も見つからない'],
  [/['"]jpn['"]\s*,\s*['"]eng['"]/, 'OCR の言語が jpn と eng の両方 — 片方だと数字か日本語のどちらかが落ちる'],
  [/氏名[\s\S]{0,400}社員番号[\s\S]{0,400}口座/, 'ラベル語に氏名・社員番号・口座がある'],
  [/['"]iban['"][\s\S]{0,200}|['"]account['"]/, 'ラベル語に英語圏・湾岸の口座語がある'],
  [/ps-confirm/, '送信前の確認チェックがある'],
  [/getTextContent/, 'PDF の文字の層を読んでいる'],
  /* ★PDF に文字の層があるのに OCR へ落ちたら、それは静かな後退。
     読み違いが起きない経路を持っているのに使っていない、という壊れ方は
     画面には一切現れない（どちらでも「塗りました」と出る）。 */
  [/if \(pre && pre\.length\)/, '★PDF の文字の層があるときは OCR を動かさない'],
  [/normalize\('NFKD'\)/, '★互換の分解を通す（PDF の康熙部首・全角をここで吸収する）'],
  /* ★「枠の中だけを送る」を支えている3つ。どれが消えても、上の文言は嘘になる。
     枠を置く／原寸から枠を切り出す／枠が紙ぜんぶのときは大きく言う。 */
  [/function frameFrom/, '★送る枠を自動で置いている'],
  [/drawImage\(src \|\| work/, '★送る画素は原寸から枠を切り出して作る（表示用の縮小画からではない）'],
  [/ps-frwarn/, '★枠が画像全体になったら警告を出す'],
  [/function frameIsWhole/, '★警告の条件は「いま枠が紙ぜんぶか」で決めている'],
  /* ★その警告を、ふつうの注意書き（.ps-warn の .76rem の金色一行）に戻さない。
     文言が正しくても、まわりと同じ見え方だと読み飛ばされて「黙って全部送る」に等しくなる。
     専用クラスを持っていることをここで留め、スタイルの定義は下で JP/EN 両方に求める。 */
  [/el\('p', 'ps-frwarn'/, '★その警告は専用の見た目（小さな注意書きに紛れさせない）'],
];
for (const [re, label] of IMPL) ok(re.test(js), `payslip.js: ${label}`);
/* ★塗り方の規則は1つだけ。経路ごとに矩形の作り方を分けると、
   片方だけ直って片方だけ壊れる状態が生まれる（そして壊れた側は誰も見ない）。
   定義1つ＋呼び出し2つ＝OCR からも PDF からも同じところを通っている。 */
ok((js.match(/buildRects\(/g) || []).length >= 3,
  'payslip.js: ★OCR と PDF が同じ buildRects を通る',
  `${(js.match(/buildRects\(/g) || []).length} 箇所`);
// 確認していない状態では送らない、というガードがコードにあること（挙動は上で実測済み）
ok(/ocrState\s*===\s*'running'[\s\S]{0,120}checked/.test(js),
  'payslip.js: 探索中・未確認なら doSend() が何もしない');
/* ★層A（上端の帯）は廃止した。戻さないことをここで固定する。
   帯は「当てずっぽうに紙の上2〜4割を塗る」だけで、本当に隠したい最下部の
   振込先には届かない。それ以上に悪いのは、帯が層B（ラベル探索）の失敗を
   覆い隠して、このスイートまで緑にしてしまうこと。塗れていないことが
   見えなくなる＝いちばん危ない。復活させるなら、まずこの行を消すことになる。 */
ok(!/function detectAuto|function rowDarkness|ANALYSIS_W/.test(js),
  'payslip.js: ★上端の帯（層A）は復活していない（層Bの失敗を覆い隠さない）');
/* ★口座を守る道は4本ある。上の様式別の検査は「どれか1本でも通れば緑」なので、
   1本折れても他が代わりに通ってしまい、折れたことに気づけない。
   4本とも生きていることを、ここで名指しで留める。 */
const ROUTES = [
  [/function valueOnlyRow/, '4-a 値だけの行を行ごと塗る（見出しが1文字も読めなくても当たる）'],
  [/function bankish/, '4-b 振込先の行だけ行の右端まで塗る（氏名の行では止める）'],
  [/'ロ座'|'ロ座番号'/, '4-c OCR の誤読形を手がかり表に持つ'],
  [/frameDiag\.cut = 1/, '★4-d 枠の下端を口座の行の上で切る（切り落としは黒塗りより強い）'],
  /* ★4-e。1〜4 はどれも「行」に縛られていて、値が別の行に組まれた瞬間に
     まとめて外れる（現実の様式2枚がこれで通り抜けた）。行を離れて
     用語のまわりを見る道が、いま口座番号を実際に止めている1本。 */
  [/function nearBox\([\s\S]*function numish\(|function numish\([\s\S]*function nearBox\(/,
    '★4-e 用語の**まわりの数字**を塗る（値が一段下・4列右でも当たる）'],
];
for (const [re, label] of ROUTES) ok(re.test(js), `payslip.js: ${label}`);
/* 定義があるだけでは通してはいけない。上の 4-e は、この2つが実際に
   呼ばれていて初めて紙の上で効く（定義だけ残して呼び出しを消す、が一番静かな後退）。 */
ok((js.match(/nearBox\(/g) || []).length >= 2 && (js.match(/numish\(/g) || []).length >= 2,
  'payslip.js: ★4-e は定義だけでなく実際に呼ばれている');
/* ★4-d と 4-a は同じ1つの判定（valueOnlyRow）を見る。別々に書くと
   「枠は外したのに黒塗りは外す」というちぐはぐが静かに生まれる。 */
ok((js.match(/valueOnlyRow\(/g) || []).length >= 3,
  'payslip.js: ★枠の下端と黒塗りが同じ「値だけの行」の判定を見ている',
  `${(js.match(/valueOnlyRow\(/g) || []).length} 箇所`);
/* ★PDF の文字の層は合字（ﬀ ﬁ）で語を割る。[Sta][ff][No] 418822 が実測で出て、
   同じ紙なのに PNG は緑・PDF だけ赤という気づきにくい落ち方をしていた。
   空白の無い切れ目だけを継ぐ規則がここ。消すと湾岸の PDF で社員番号が出ていく。 */
ok(/function glueHit/.test(js) && /GLUE_GAP/.test(js),
  'payslip.js: ★PDF の合字くずれ（[Sta][ff]）を継いでから手がかりに当てる');
/* ★氏名は社員番号と縦に接して並ぶ。字が小さいと氏名だけ OCR に返ってこない
   （jp-lcc で実測）。当たった手がかりの一段上まで塗る規則が消えると、
   帯が無くなったいま氏名は素通りになる。 */
ok(/headBlock/.test(js),
  'payslip.js: ★紙の頭では、当たった手がかりの一段上まで塗る（読めなかった氏名を巻き込む）');
/* ★画像は <img> から描き写す。createImageBitmap からではない。
   同じファイル・同じ寸法・同じ倍率でも、ImageBitmap 経由だと OCR の読み取り語数が
   半分以下に落ちて、氏名・社員番号・口座が1つも見つからなくなる（実測で10検査が落ちる）。
   画素の平均差は 0.5・最大 38 で、**目で見ても違いが分からない**。
   だから目視では二度と気づけない。ここで文字として留める。 */
ok(/function loadImage[\s\S]{0,300}new Image\(\)/.test(js)
  && !/function loadImage\s*\([\s\S]{0,120}return createImageBitmap/.test(js),
  'payslip.js: ★画像は <img> から読む（createImageBitmap 経由だと OCR が半減して何も見つからない）');

/* (b) 文言側：実装どおりの約束が、**本人が実際に読む場所に**書いてあること。

   ★約束の置き場所は 2026-08-13 の「入口を2択にする」回（0048ff5）で動いた。
     pay-report.html にあった長い注意書き（.ps-priv）を消し、
     塗る／枠の外を切り落とす／保存しない の説明を、明細を上げた**直後の確認画面**
     ＝ payslip.js の T.redacted / T.frameLead / T.note / T.confirm へ移した。
     読ませるべきは、送るかどうかを決める直前のそこだから、という判断。
     この検査は移した先を見ていなかったので、以来ずっと14件が落ちたままだった。
     ＝約束が消えたのではなく、検査が置き場所に付いていっていなかった。
   ★文言を別のファイルへ動かしたら、ここも一緒に動かす。
     「どこかに書いてあればよい」にしない（読まれない所に置いた時に気づけない）。 */
const COPY = [
  ['payslip.js', [
    ['送られるのは<b>明るい枠の中だけ</b>です', '★送るのは枠の中だけと書いてある（日）'],
    ['枠の外は端末から出ません', '★枠の外は端末を出ないと書いてある（日）'],
    ['この端末の中で探して黒く塗ります', '枠の中も探して塗る（日）'],
    ['残っていないことを確認しました', '本人が確認してから送る（日）'],
    ['抜けがあれば足してください', '自動検出は完璧ではないと断っている（日）'],
    ['明細の部分だけを切り取った画像', '切り出しを勧めている（日）'],
    ['解析にだけ使い、保存しません', '保存しないと書いてある（日）'],
    ['Only what is <b>inside the bright frame</b> is sent', '★送るのは枠の中だけと書いてある（英）'],
    ['Nothing outside the frame leaves your device', '★枠の外は端末を出ないと書いてある（英）'],
    ['found and blacked out here on your device', '枠の中も探して塗る（英）'],
    ['is left inside the frame', '本人が確認してから送る（英）'],
    ['Add more if anything was missed', '自動検出は完璧ではないと断っている（英）'],
    ['cropped to just the payslip', '切り出しを勧めている（英）'],
    ['is never stored', '保存しないと書いてある（英）'],
  ]],
  ['pay-report.html', [
    ['accept="application/pdf', 'PDF を選べる'],
    ['<b>PDF のまま</b>落とすのがいちばん正確に読めます', 'PDF を勧めている'],
  ]],
  ['en/pay-report.html', [
    ['accept="application/pdf', 'PDF を選べる'],
    ['Dropping <b>the PDF itself</b> reads most accurately', 'PDF を勧めている'],
  ]],
  ['personal-data.html', [
    ['ご本人が確認した「送る枠」の中だけ', '★送るのは枠の中だけと書いてある'],
    ['枠の外は端末を出ません', '★枠の外は端末を出ないと書いてある'],
    ['自動で探して黒く塗り', '枠の中も探して塗る'],
    ['ご確認いただいてから送信', '本人が確認してから送る'],
    ['端末の中で1ページ目だけを画像にしてから', 'PDF は1ページ目だけと書いてある'],
  ]],
  ['en/personal-data.html', [
    ['only what is inside the “sent area” frame you approved', '★送るのは枠の中だけと書いてある'],
    ['never leaves your device', '★枠の外は端末を出ないと書いてある'],
    ['found and blacked out automatically', '枠の中も探して塗る'],
    ['after you have checked it', '本人が確認してから送る'],
    ['only its first page is turned into an image', 'PDF は1ページ目だけと書いてある'],
  ]],
];
for (const [f, needles] of COPY) {
  const s = readFileSync(path.join(DIR, '..', f), 'utf8');
  for (const [needle, label] of needles) ok(s.includes(needle), `${f}: ${label}`);
}

/* (b-2) 枠が画像ぜんぶのときの警告に、**目立つ見た目が定義されている**こと。
   payslip.js が専用クラスを付けていても、スタイルが無ければ素の <p> と同じで、
   「大きく言う」という約束が見た目の側から静かに外れる。JP/EN 両方に求める。 */
for (const f of ['pay-report.html', 'en/pay-report.html']) {
  const s = readFileSync(path.join(DIR, '..', f), 'utf8');
  ok(/\.ps-frwarn\{[^}]*background:/.test(s),
    `${f}: ★枠が全体のときの警告に目立つ見た目がある`);
  ok(/\[data-theme="light"\] \.ps-frwarn\{/.test(s),
    `${f}: ★その警告はライトテーマでも見える`);
  /* ★確認画面を高さで頭打ちにしない。62vh に戻ると、A4縦の紙は幅が本文段組みの
     半分になり明細の字が読めなくなる＝確認が形だけになる。文字として留める。 */
  ok(!/\.ps-cv\{[^}]*max-height:\s*\d+vh\b/.test(s),
    `${f}: ★確認画面の canvas を画面高さで頭打ちにしていない`);
  ok(/\.ps-edit\{[^}]*width:\s*min\(/.test(s),
    `${f}: ★確認画面は本文の段組みより広く出る`);
  /* ★探している間、明細を隠す見た目が**定義されている**こと。
     payslip.js が is-wait を付けても、CSS が無ければ何も隠れない＝
     塗る前の明細が数秒見えて、完成品と見まちがえて送れてしまう。 */
  ok(/\.ps-edit\.is-wait\s*>\s*\.ps-stage[\s\S]{0,400}?display:\s*none/.test(s),
    `${f}: ★探している間は明細（.ps-stage）を隠す見た目がある`);
  ok(/\.ps-edit\.is-wait\s*>[\s\S]{0,400}?\.ps-btn-go[\s\S]{0,200}?display:\s*none/.test(s),
    `${f}: ★探している間は「送る」も画面から消える（disabled は目に入らない）`);
  ok(/\.ps-edit\.is-wait\s*>\s*\.ps-wait\{[^}]*display:\s*flex/.test(s),
    `${f}: ★代わりに出す待機の箱がある`);
  ok(/\[data-theme="light"\] \.ps-edit\.is-wait\s*>\s*\.ps-wait\{/.test(s),
    `${f}: ★待機の箱はライトテーマでも見える`);
  /* ★「原寸で確認」の窓は廃止した（方針判断）。確認画面そのものを段組みの外へ
     広げて字が読める大きさにしたので、もう一枚の窓は要らない。戻すなら上の
     .ps-edit{width:min(…)} と一緒に考えること。ここは残骸が残らないよう固定する。 */
  ok(!/\.ps-zoom|\.ps-btn-zoom|psZoomIn/.test(s),
    `${f}: ★「原寸で確認」の見た目は残っていない`);
}

// (c) 事実と違っていた頃の文言が残っていないこと
for (const f of ['personal-data.html', 'pay-report.html']) {
  const s = readFileSync(path.join(DIR, '..', f), 'utf8');
  ok(!/端末の中で黒く塗ってから送/.test(s) && !/端末側で黒塗りしたあとの画像を送/.test(s),
    `${f}: 「探さずに塗っていた」頃の文言が残っていない`);
}

/* (c-2) ★「送らない」と読める言い回しを、投稿画面に一切書かない（2026-08-13 その5）。

   2026-08-13（その4）に入口カードへ「画像は送りません。端末の中で数字だけ取り出します」と
   書いた。**これは嘘だった。** 端末でやっているのは黒塗りで、読み取りは枠の中を
   切り出した画像を Anthropic に送ってやっている。personal-data.html には正しく
   「枠の中だけを送る」と書いてあり、同じサイトの中で矛盾していた。

   ★言い換えずに消した（方針判断「嘘言うくらいなら何も言わなくて良い」）。
     残した「匿名 — 氏名も社員番号も送りません」は事実（塗ってから送っている）。
     送る範囲の説明は、いちばん効く場所＝送る直前の確認画面が
     payslip.js の T.frameLead / T.note で出す。入口で先回りして約束する必要が無い。

   ★この検査が守るのは「短く書く」ではなく「事実だけ書く」。
     売り文句を強くしたくなったら、消したこの行が3回目に戻ってくる。 */
{
  const NEVER_SAY = [
    [/画像は送りません/, '「画像は送りません」'],
    [/画像は(?:どこにも)?送信されません/, '「画像は送信されません」'],
    [/端末の中で数字だけ/, '「端末の中で数字だけ取り出します」'],
    [/The image is not sent/i, '"The image is not sent"'],
    [/(?:figures|numbers) are read on(?: this| your)? device/i, '"read on this device"'],
    [/never (?:leaves|leave) your device/i, '"never leaves your device"'],
  ];
  for (const f of ['pay-report.html', 'en/pay-report.html']) {
    /* ★HTML コメントは外して見る。消した理由を書き残したコメントには、
       禁止した文言そのものが引用として入っている（入っていてほしい）。
       画面に出るのはコメントの外だけなので、そこだけを見る。 */
    const s = readFileSync(path.join(DIR, '..', f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const said = NEVER_SAY.filter(([re]) => re.test(s)).map(([, label]) => label);
    ok(said.length === 0,
      `${f}: ★「送らない」と読める言い回しを書いていない（枠の中は実際に送っている）`,
      said.join(' / '));
  }
  /* ★personal-data.html の「枠の外は端末を出ません」は事実なので対象外。
     そちらは上の COPY 節が「書いてあること」を要求している。 */
}

await browser.close();
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
