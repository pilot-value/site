/* ════════════════════════════════════════════════════════════════
   announce-mail.mjs — 「給与レポートができました」の1通ぶんの文面

   一斉配信の本体は mail-bot/send.mjs announce。ここは**文面だけ**を持つ。
   分けてあるのは、送らずに絵で確かめられるようにするため
   （node shot-remind.mjs --announce が、この build() をそのまま呼ぶ）。
   写経した複製を撮ると「絵は直したが本物は古い」が起きる。

   ── 本文に入れないもの（remind-payslip と同じ約束）──────────
   金額・会社名・職位・機材・明細の項目名を1つも入れない。
   pay_reports は user_id を持たず proof_hash だけで繋がっている＝
   DB の中では「誰がいくら」を持たない設計にしてある。その数字をメールに
   載せた瞬間、Resend のログと受信箱に「このメールアドレスの人の報酬額」が残る。
   こちらの設計で守っているものを、送信で外に出すことになる。
   → db/test-announce.mjs がこのファイルを検査して固定している。

   ── 書いてよい事実の出どころ ────────────────────────────────
   ここの主張は全部サイトの実装から取っている。盛らない。
     ・明細から自動入力 …… pay-report.html:692 の入口
     ・端末の中で黒塗り／枠の中だけ送る／保存しない
                      …… payslip.js:60（枠の外は端末から出ません…保存しません）
     ・最後だけログイン …… pay-login.js（2026-08-14）
     ・解放90日 ……… db/pay-reports.sql:722（now() + interval '90 days'）
     ・出る数字4つ …… pay-report.html renderResult()
                      年換算の総額／時間あたり報酬（$/block hour）／推定手取り（年）／解放
   ★同区分パーセンタイルは書かない。n≧5 でしか出ないので、
     いま受け取る人には出ない（＝書いたら嘘になる）。
   ════════════════════════════════════════════════════════════════ */

/* 言語の見当は remind-payslip の判定をそのまま借りる。
   ここで書き直すと、月次リマインドは日本語・お知らせは英語、のように
   同じ人に違う言語で届く。判定は1つに保つ。 */
import { langOf } from '../supabase/functions/remind-payslip/index.ts';

export { langOf };

/* ★ langOf は「分からなければ英語」で必ず片方に決める。届ける側としては
   それでいいが、こちらは分からない人が実際にいる（登録が Google や
   コードだけだと、signup.html を通らないので居住国が空のまま）。
   氏名も居住国も手がかりが無い人には、日本語と英語を1通に両方入れる。
   当てずっぽうで片方に決めて、読めない1通を送るよりよい。 */
export function langModeOf(p) {
  const known = /[぀-ヿ一-鿿]/.test(String(p?.name ?? '')) || String(p?.country ?? '').trim() !== '';
  return known ? langOf(p) : 'both';
}

/* ★日英ともに入れるときは英語を上、日本語を下にする（2026-08-23 オーナー判断）。
   この形になるのは「言語の手がかりがまったく無い人」だけ。
   実際に見たところ、その人たちは居住国も在籍企業も空で、氏名も半分は空だった。
   日本語しか読めない人はどのみち下まで読めるが、英語しか読めない人は
   上が日本語だと自分宛でないと思って閉じる。読めないほうを上に置かない。
   ★build() と buildFounding() で並びを変えない。同じ人に届く2通で
     上下が入れ替わると、同じサービスから来たものに見えない。 */
const BOTH_ORDER = ['en', 'ja'];

/* 仕切りの一言は「次に来る言語」で決める。固定文にすると、
   英語を上にした瞬間に「English follows.」が英語の上に出て逆さになる。 */
const dividerFor = (nextLang) => `
    <div style="margin:4px 0 26px;border-top:1px solid #e6e9ef"></div>
    <p style="margin:0 0 18px;color:#9aa5b1;font-size:11px">${
      nextLang === 'ja' ? '日本語は下に続きます。' : 'English follows.'}</p>`;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 送信元・宛先の既定。send.mjs から .env の値で上書きされる。 */
export const DEFAULTS = {
  siteUrl: 'https://pilot-value.com',
  supabaseUrl: '',
  adminEmail: 'info@pilot-value.com',
};

/* ── 見本の明細（架空の機長1人・2026年2〜7月の6枚）─────────────
   メールに貼る図は、この行を**実物の my-value.html に描かせて撮った画像**
   （gen-mail-images.mjs）。本文の見本カードの数字も、ここから引いた値を書く。
   元を2つ持つと、同じメールの中で図と本文に違う金額が並ぶ。

   ★実在の会社・人の値ではない。すべて説明のための架空の値。
   ★列の名前と意味は db/pay-reports.sql の my_pay_reports() と同じ。
   ★gross_monthly は入れない。入れると pay-viz.js の segments() が null を返し、
     支給構成のドーナツが描かれない（総支給1本の行は内訳を持たないため）。
   ★flight_variable_pay は other_allowance の**内訳**。足すと二重計上になる
     （pay-viz.js が割って描く）。 */
const SAMPLE_MONTH = {
  base_pay: 700000,            // 基本給
  command_pay: 500000,         // 機長・役職手当
  other_allowance: 370000,     // うち乗務変動手当 320,000／その他手当 50,000
  flight_variable_pay: 320000,
  housing_type: 'allowance', housing_amount: 120000,
  per_diem: 110000, transport: 0,
  net_pay_actual: 1280000, deduction_total: 520000,   // 総支給 1,800,000／月
  block_hours: 62.5, duty_hours: 105,
};

export const SAMPLE_ROWS = [2, 3, 4, 5, 6, 7].map((mo) => ({
  airline: 'other', airline_other: '見本', position: 'cap', fleet: 'b787', job_role: 'line',
  period_year: 2026, period_month: mo,
  /* ★ドル換算は currency.js の表示レート（160円/USD）で揃える。画像は
       my-value.html をそのまま撮っているので、そちらは必ずこのレートで出る。
       ここだけ別のレートにすると、同じメールの中で図と本文の $ が食い違う。 */
  currency: 'JPY', fx_to_jpy: 1, fx_to_usd: 1 / 160,
  /* 年換算 21,600,000（＝1,800,000 × 12）。時間あたりは calc() が
     (21,600,000/12 − パーディアム 110,000) ÷ 62.5h ＝ ¥27,040/h ＝ $169/bh。 */
  annual_total_orig: 21600000, annual_total_usd: 135000, annual_total_jpy: 21600000,
  usd_per_block_hour: 169, net_annual_jpy: 15360000,
  bonus_month: 0, bonus_annual: 0, profit_share_annual: 0,
  source: 'payslip', verify_level: 0,
  created_at: `2026-${String(mo).padStart(2, '0')}-25T00:00:00Z`,
  ...SAMPLE_MONTH,
}));

/* 画像の版。src に ?v=… で付ける。
   ★理由は2つ。
     1. Cloudflare が画像を4時間持つ。図を作り直しても、版を上げないと
        受信箱には古い絵が出続ける。
     2. 公開直後に 404 を1回でも引くと、その「無い」がしばらく残る。
        実際に push 直後の確認で起き、同じ URL が端末によって 404 と 200 に割れた。
   ★中身から作った指紋。gen-mail-images.mjs が画像と一緒に出す。
     作り直したのに直し忘れると db/test-announce.mjs が正しい値を出して落ちる。 */
export const IMG_VER = '2f7197ed';

/* ── レポートの見本 ─────────────────────────────────────────
   ★項目名の一覧（「年換算の総額 … 明細1ヶ月ぶんから」）だけを載せていたが、
     それでは何が返ってくるのか分からず、ログインする理由にならなかった。
     実物と同じ並びの1枚を、そのままメールに入れる。
   ★ここの数字は説明のための架空の例。実在の会社・人の値ではない。
     必ず「見本」の印と note を一緒に出す（片方だけ消せないよう同じ物に入れてある）。
   ★行の見出しは pay-report.html の renderResult と同じ言葉。
     db/test-announce.mjs が両方を突き合わせている。
   ★金額が本文に出るのは、この SAMPLE の中の文字列としてだけ。
     会員本人の数字は1つも載せない（給与レポートは user_id を持たない設計）。
     test-announce の①は、SAMPLE を取り除いた残りに金額が無いことを見ている。 */
export const SAMPLE = {
  ja: {
    tag: '見本',
    eyebrow: '受け取りました',
    big: 'JPY 21,600,000',
    sub: '年換算の総額（2026年7月の明細から）',
    rows: [
      ['換算', '$135,000 ／ ¥2,160万'],
      ['時間あたり報酬', '$169 / block hour'],
      ['推定手取り（年）', '¥1,536万'],
      ['給与詳細の解放', '90日間'],
    ],
    note: '※ 上記はすべて架空の見本です。ご自身の数値は、ログイン後の画面にのみ表示されます。',
    /* 累計報酬。毎月戻ってくる理由はここ（my-value.js の「累計だけカードを一段
       持ち上げてある」と同じ考え）。 */
    cum: {
      head: '毎月アップロードすると、累計報酬が積み上がります',
      img: 'report-cum-ja.jpg',
      alt: '見本：累計報酬のカード。2026年2月から7月までの6枚ぶんが折れ線で積み上がっている。',
      cap: '累計報酬 ¥1,080万（6ヶ月ぶんをアップロードした場合）。月平均の額面 ¥180万、通算の乗務時間あたり ¥27,040。',
    },
    /* 支給構成。★出すのは支給の側だけ。控除の内訳（税・年金・組合費…）は
       画面にも出さないし保存もしていない（my-value.js の taxNote）。ここにも書かない。 */
    bd: {
      head: '支給の内訳も、明細から自動で分解されます',
      img: 'report-bd-ja.png',
      alt: '見本：支給構成のカード。基本給・機長手当・乗務変動手当などの割合をドーナツ図で示している。',
      cap: '基本給 39%、機長・役職手当 28%、乗務変動手当 18%、住宅手当 7%、パーディアム 6%、その他手当 3%。固定 73% ／ 変動 24%。',
    },
  },
  en: {
    tag: 'Sample',
    eyebrow: 'Received',
    big: 'JPY 21,600,000',
    sub: 'Annualised total (from your July 2026 payslip)',
    rows: [
      /* ★英語側は「万」を使わない。en/pay-report.html の jpyMan は桁を丸ごと出す
           （日本語版だけが /10000 して「万」を付ける）。ここを揃えないと、
           メールで見た形と画面で出る形が違う物に見える。 */
      ['Converted', '$135,000 / ¥21,600,000'],
      ['Pay per block hour', '$169 / block hour'],
      ['Estimated take-home (yr)', '¥15,360,000'],
      ['Pay detail unlocked', '90 days'],
    ],
    note: 'All figures above are a made-up example. Your own numbers are shown only after you sign in.',
    cum: {
      head: 'Upload one every month and the total builds up',
      img: 'report-cum-en.jpg',
      alt: 'Sample: the total pay card, with six months from February to July 2026 stacking up along a trend line.',
      /* ★英語ページの既定通貨は USD（currency.js）。画像もその表示で撮ってあるので、
           説明も $ で書く。ここだけ円にすると図と本文が別物に見える。 */
      cap: 'Total pay recorded $68K after six months of payslips. Average gross $11K per month, $169 per block hour.',
    },
    bd: {
      head: 'The breakdown is split out from the payslip too',
      img: 'report-bd-en.png',
      alt: 'Sample: the pay breakdown card, showing base pay, command pay and flight variable pay as a donut chart.',
      cap: 'Base pay 39%, command / position 28%, flight variable 18%, housing 7%, per diem 6%, other allowances 3%. Fixed 73% / variable 24%.',
    },
  },
};

/* ── 文面 ───────────────────────────────────────────────────
   2通り出し分ける。同じ文面を全員に送ると、既に明細を出した人に
   「できました」と言うことになり、いちばん熱心な人から解除される。 */
function copy(lang, filed) {
  if (lang === 'ja') {
    return {
      /* ★件名に【PILOT VALUE】を付けない。差出人名がすでに PILOT VALUE なので
           同じ言葉が二度出るだけで、スマホの一覧で見える最初の15文字を潰す。
         ★呼び名は画面と同じ「給与レポート」にする（pay-report.html の <title>）。
           ここだけ言い換えると、開いた人がその名前の物を探すことになる。 */
      subject: filed
        ? '新機能：給与レポートの入力が短くなりました！'
        : '新機能：給与レポートが追加されました！',
      hi: 'こんにちは',
      /* ★書き出しで件名を言い直さない。件名で「何が起きたか」は済んでいるので、
           ここは「自分に何の得があるか」を1行目に置く。 */
      lead: filed
        ? '給与レポートの入力画面を作り直しました。以前より入力の手間が少なくなっています。変更点は次の3つです。'
        : '給与明細の画像をアップロードすると、金額の項目が自動で入力されます。手で入力する手間はほとんどありません。',
      changesHead: filed ? '変更点' : '',
      changes: filed
        ? [
          '明細の画像をアップロードすると、金額の項目が自動で入力されます（手入力の手間が減りました）',
          '入力の途中でログインを求めるのをやめました。ログインが必要なのは、最後にレポートを表示するときだけです',
          '役職・区分を必須にしました。同じ機長でも、ライン機長と教官では待遇が異なるためです',
        ]
        : [],
      statsHead: filed ? '表示されるレポートはこちらです' : '明細を1枚アップロードすると、こんなレポートが表示されます',
      sample: SAMPLE.ja,
      /* ★未提出の人に「時間あたり報酬とは何か」を説明しない（2026-08-15 オーナー指示）。
           図で伝わっているものを文章で言い直すと、読む量が増えるだけで
           かえって疑問や突っ込みどころを増やす。注記は必要最小限にする。 */
      pitch: filed
        ? '今月分をアップロードすると、給与詳細の閲覧期間がその日から90日間に延長されます。'
        : '',
      cta: filed ? '今月の明細をアップロードする' : '明細をアップロードする',
      sub: 'マイページを見る',
      safeHead: filed ? '' : '給与明細の取り扱い',
      /* 既に出したことがある人には、明細の扱いを説明し直さない。
         一度通った道を読ませると長いだけで、いちばん熱心な人の時間を取る。
         ★「このメールに金額は書いていません」も置かない。書いていないものを
           わざわざ断ると、読んだ人が逆に「載る可能性があるのか」と考える。 */
      safe: filed
        ? []
        : [
          '氏名・社員番号・口座番号は、送信前に<b>お使いの端末上で塗りつぶします</b>。塗りつぶした部分は画素ごと削除されるため、送信後に復元することはできません。',
          '送信されるのは<b>枠内の情報だけ</b>です。読み取りに使用した画像は保存しません。',
        ],
      why: 'このメールは、ご登録のときに「年収データの更新などをメールで受け取る」にチェックを入れた方にお送りしています。',
      unsub: '配信を停止する',
    };
  }
  return {
    /* 英語の件名に「!」を付けない。日本語では自然でも、英語の件名では
       迷惑メール判定の点数を押し上げる。伝わる中身は同じにしてある。 */
    subject: filed
      ? 'New: the pay report is quicker to fill in'
      : 'New: the pay report is live',
    hi: 'Hi,',
    lead: filed
      ? 'We have rebuilt the pay report form. It takes fewer steps than before. Three things changed.'
      : 'Upload a payslip image and the money fields are filled in for you. There is almost nothing left to type by hand.',
    changesHead: filed ? 'What changed' : '',
    changes: filed
      ? [
        'Upload a payslip image and the money fields are filled in for you — much less typing.',
        'We no longer ask you to sign in partway through. You sign in only at the end, when the report is shown.',
        'Role is now required. A line captain and a training captain are not paid the same, so we stopped grouping them together.',
      ]
      : [],
    statsHead: filed ? 'This is the report you get' : 'Upload one payslip and you get a report like this',
    sample: SAMPLE.en,
    pitch: filed
      ? 'Upload this month and your pay detail stays unlocked for another 90 days from that day.'
      : '',
    cta: filed ? 'Upload this month\'s payslip' : 'Upload a payslip',
    sub: 'Go to your page',
    safeHead: filed ? '' : 'What happens to your payslip',
    safe: filed
      ? []
      : [
        'Your name, staff number and account number are <b>masked on your own device</b> before anything is sent. Those pixels are deleted, so they cannot be recovered from what we receive.',
        'Only <b>what is inside the frame</b> is sent. The image used for the reading is not stored.',
      ],
    why: 'You are getting this because you ticked "email me useful updates" when you registered.',
    unsub: 'Unsubscribe',
  };
}

/* 見本の1枚目（受け取った直後に出る要約）。実物（pay-report.html の .res）と
   同じ並びで、受信箱で崩れないよう table と行内 style だけで組む。
   ★これは画像にしない。画像を止めている受信箱で、肝心の数字が空になる。
   ★「見本」の印は角に固定で出す。数字だけが切り取られて広まらないようにする。 */
function sampleCard(s) {
  const row = ([k, v], i) =>
    `<tr>
       <td style="padding:9px 12px 9px 0;color:#6b7a8c;font-size:13px;white-space:nowrap;${i ? 'border-top:1px solid #eef0f4' : ''}">${esc(k)}</td>
       <td style="padding:9px 0;text-align:right;font-weight:800;color:${i === 1 ? '#a97b09' : '#111'};font-size:${i === 1 ? '16px' : '15px'};white-space:nowrap;${i ? 'border-top:1px solid #eef0f4' : ''}">${esc(v)}</td>
     </tr>`;
  return `
    <table style="border-collapse:collapse;width:100%;margin:0 0 8px;background:#f7f9fb;border:1px solid #e6e9ef;border-radius:12px">
      <tr><td style="padding:18px 18px 16px">
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="color:#1a7f4b;font-weight:800;font-size:12px;letter-spacing:.02em">${esc(s.eyebrow)}</td>
            <td style="text-align:right"><span style="background:#e6e9ef;color:#6b7a8c;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px">${esc(s.tag)}</span></td>
          </tr>
        </table>
        <div style="font-size:27px;font-weight:800;color:#1a7f4b;letter-spacing:-.02em;margin:6px 0 2px">${esc(s.big)}</div>
        <div style="font-size:12px;color:#6b7a8c;margin:0 0 10px">${esc(s.sub)}</div>
        <table style="border-collapse:collapse;width:100%">${s.rows.map(row).join('')}</table>
      </td></tr>
    </table>`;
}

/* 累計報酬と支給構成の図。
   ★受信箱では JS も SVG も conic-gradient も動かない。折れ線とドーナツは
     画像でしか出せないので、**実物の my-value.html を撮った1枚**を貼る
     （gen-mail-images.mjs）。似せて作り直すと、画面と別の物が届く。
   ★画像を止めている受信箱のために、下に要約を文字で置く（cap）。
     alt も「見本」で始める。画像だけが切り取られて広まっても架空と分かる。
   ★幅は本文と同じ 512px。元は 1200px なので拡大されない。 */
function chartImg(site, c) {
  return `
    <p style="margin:0 0 10px;font-weight:800;color:#111;font-size:13px">${esc(c.head)}</p>
    <img src="${esc(site)}/assets/mail/${esc(c.img)}?v=${esc(IMG_VER)}" width="512" alt="${esc(c.alt)}"
         style="display:block;width:100%;max-width:512px;height:auto;border:0;border-radius:12px">
    <p style="margin:10px 0 22px;color:#6b7a8c;font-size:12px;line-height:1.7">${esc(c.cap)}</p>`;
}

const bullets = (arr) =>
  `<ul style="margin:0 0 18px;padding-left:1.15em;color:#333">${
    arr.map((s) => `<li style="margin:0 0 6px">${s}</li>`).join('')
  }</ul>`;

/* 1言語ぶんの中身。両方入りのときはこれを2回並べる。
   skipSafe は2枚目用。同じ「明細の扱い」を1通に2度書かない（長いだけ）。 */
function blockHtml(t, u, skipSafe, site) {
  if (skipSafe) t = { ...t, safeHead: '', safe: [] };
  return `
    <p style="margin:0 0 6px">${esc(t.hi)}</p>
    <p style="margin:0 0 20px;color:#333">${esc(t.lead)}</p>

    ${t.changes.length
      ? `<p style="margin:0 0 8px;font-weight:800;color:#111">${esc(t.changesHead)}</p>${bullets(t.changes.map(esc))}`
      : ''}

    <p style="margin:0 0 8px;font-weight:800;color:#111">${esc(t.statsHead)}</p>
    ${sampleCard(t.sample)}
    ${chartImg(site, t.sample.cum)}
    ${chartImg(site, t.sample.bd)}
    <p style="margin:0 0 22px;color:#9aa5b1;font-size:11px;line-height:1.6">${esc(t.sample.note)}</p>

    ${t.pitch ? `<p style="margin:0 0 22px;color:#333">${esc(t.pitch)}</p>` : ''}

    <p style="margin:0 0 10px">
      <a href="${esc(u.payUrl)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(t.cta)}</a>
    </p>
    <p style="margin:0 0 26px"><a href="${esc(u.meUrl)}" style="color:#2f5d8c;text-decoration:none">${esc(t.sub)} →</a></p>

    ${!t.safe.length ? ''
      : t.safeHead
        ? `<p style="margin:0 0 8px;font-weight:800;color:#111;font-size:13px">${esc(t.safeHead)}</p>${bullets(t.safe)}`
        : `<p style="margin:0;color:#6b7a8c;font-size:12px">${t.safe.join(' ')}</p>`}`;
}

/* 文字だけの版も付ける。HTML を切っている受信箱で空白の1通にしないため。 */
const strip = (s) => String(s).replace(/<[^>]+>/g, '');
function blockText(t, u, skipSafe) {
  if (skipSafe) t = { ...t, safeHead: '', safe: [] };
  return [
    strip(t.hi), '',
    strip(t.lead), '',
    ...(t.changes.length ? [strip(t.changesHead), ...t.changes.map((s) => '  - ' + strip(s)), ''] : []),
    `${strip(t.statsHead)}（${strip(t.sample.tag)}）`, '',
    `  ${strip(t.sample.eyebrow)}`,
    `  ${strip(t.sample.big)}`,
    `  ${strip(t.sample.sub)}`, '',
    ...t.sample.rows.map(([k, v]) => `  ${strip(k)} …… ${strip(v)}`), '',
    /* 図の中身は言葉で書く。HTML を切っている受信箱では画像が出ないので、
       ここが空だと「グラフが返ってくる」という話だけが残る。
       ★画像の URL は書かない。文字だけの版に長いリンクが並ぶと読めなくなる。 */
    `  ${strip(t.sample.cum.head)}`,
    `    ${strip(t.sample.cum.cap)}`, '',
    `  ${strip(t.sample.bd.head)}`,
    `    ${strip(t.sample.bd.cap)}`, '',
    strip(t.sample.note), '',
    ...(t.pitch ? [strip(t.pitch), ''] : []),
    `${strip(t.cta)}: ${u.payUrl}`,
    `${strip(t.sub)}: ${u.meUrl}`, '',
    ...(!t.safe.length ? []
      : t.safeHead ? [strip(t.safeHead), ...t.safe.map((s) => '  - ' + strip(s))]
        : t.safe.map(strip)),
  ].join('\n');
}

/* p = { name, country, unsub_token, pay_report_count }
   o = { siteUrl, supabaseUrl, adminEmail, lang }  ← lang を渡すと判定を上書き

   ★name は言語の判定（langOf）にしか使わない。宛名には出さない。
     この人たちは匿名で給与と職場のことを出してくれている。
     受信箱と Resend の送信ログに「このアドレス＝この氏名」を残さない。 */
export function build(p, o = {}) {
  const opt = { ...DEFAULTS, ...o };
  const site = String(opt.siteUrl).replace(/\/+$/, '');
  const lang = opt.lang || langModeOf(p);
  const filed = Number(p?.pay_report_count || 0) > 0;
  const langs = lang === 'both' ? BOTH_ORDER : [lang];

  const urls = (l) => {
    const pre = l === 'en' ? 'en/' : '';
    return { payUrl: `${site}/${pre}pay-report.html`, meUrl: `${site}/${pre}my-value.html` };
  };
  /* 解除リンクは1本だけ。言語ごとに2本出すと、どちらを押しても同じ所へ行くのに
     「2種類ある」と読めてしまう。★行き先は本文の先頭の言語に合わせる
     （日英ともは英語が上なので英語の解除ページ。文言だけ英語でページが日本語、
     という食い違いを作らない）。解除ページ自体は日英どちらにもある。 */
  const unsubPage = (l) => `${site}/${l === 'en' ? 'en/' : ''}unsubscribe.html?token=${encodeURIComponent(p?.unsub_token || '')}`;
  const unsubUrl = unsubPage(langs[0]);
  /* 受信箱側のワンクリック解除（RFC 8058）。remind-payslip が既に本番で
     この入口を持っているので、そこを指す（新しく作らない）。 */
  const oneClickUrl = opt.supabaseUrl
    ? `${String(opt.supabaseUrl).replace(/\/+$/, '')}/functions/v1/remind-payslip?u=${encodeURIComponent(p?.unsub_token || '')}`
    : '';

  const parts = langs.map((l) => ({ l, t: copy(l, filed), u: urls(l) }));

  /* 件名。両方入りのときは英語＋短い日本語（受信箱で切れない長さに収める）。 */
  const subject = lang === 'both'
    ? `${parts[0].t.subject}${filed ? ' / 入力が速くなりました' : ' / 給与レポートを公開しました'}`
    : parts[0].t.subject;

  const foot = parts[0].t;
  const html =
    `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
        <div style="background:#0a0c0f;padding:18px 24px">
          <span style="color:#f5c842;font-weight:800;letter-spacing:.04em;font-size:15px">PILOT VALUE</span>
        </div>
        <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">
          ${parts.map((x, i) => blockHtml(x.t, x.u, i > 0, site))
            .reduce((a, b, i) => a + dividerFor(langs[i]) + b)}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
          ${esc(foot.why)}<br>
          <a href="${esc(unsubUrl)}" style="color:#6b7280">${esc(foot.unsub)}</a>
          ・<a href="${esc(site)}" style="color:#6b7280">${esc(site.replace(/^https?:\/\//, ''))}</a>
        </div>
      </div>
    </div>`;

  const text = [
    parts.map((x, i) => blockText(x.t, x.u, i > 0)).join('\n\n— — —\n\n'),
    '', '--',
    strip(foot.why),
    `${strip(foot.unsub)}: ${unsubUrl}`,
  ].join('\n');

  return { lang, filed, subject, html, text, unsubUrl, oneClickUrl, ...urls(langs[0]) };
}

/* ════════════════════════════════════════════════════════════════
   FOUNDING PILOT 100 のお知らせ（buildFounding）

   ── なぜ文面が1種類なのか ──────────────────────────────────
   受け取るのは登録者**全員**で、そのうち番号を持っているのは一部。
   にもかかわらず「番号あり用」と「まだの人用」に割らないのは、
   後者が必ず「出せばもらえます」という**勧誘**になるから。
   勧誘が入った時点で特定電子メール法の広告宣伝メールになり、
   4条の「送信者の氏名・住所」の表示義務が発生する。
   運営者の身元を守る方針（CLAUDE.md／avoid-disclosure-request-until-scale）と
   正面からぶつかるので、文面を1種類に保って**お知らせ**の側に置く。
   「出すと番号が入る」は、マイページの沈んだ板が黙って伝える。

   ── 本文に入れないもの ──────────────────────────────────
   ・金額・会社名・職位・機材・明細の項目名（build() と同じ約束）
   ・★受け取った人自身の番号。「このアドレスの人は No.7」が
     受信箱と Resend の送信ログに残る。番号はログインした画面でだけ見せる。
   ・★人数・残り枠。会員の規模が読める（db/referrals.sql:19 と同じ約束）。
   ・「番号を持っているか」を言い当てる書き方。全員に同じ文面が届くので、
     「あなたには番号があります」も「まだありません」も嘘になる人が出る。
   → db/test-announce.mjs が全部を検査して固定している。
   ════════════════════════════════════════════════════════════════ */

/* 板の見本。★数字は題名の "FOUNDING PILOT 100" だけ。
   画像にしない ―― 画像を止めている受信箱で、称号そのものが消えるため。

   ★番号の枠を描かない。画面の板は、番号が無い人にだけ「—」を出す。
     ★2026-08-23、番号そのものを画面からも外した（オーナー判断）。
     板は称号の名前だけを出す。 */
function foundingPlaque(t) {
  return `
    <table style="border-collapse:collapse;width:100%;margin:0 0 22px;background:#14161c;border:1px solid #6b5410;border-radius:14px">
      <tr><td style="padding:20px 22px">
        <table style="border-collapse:collapse">
          <tr>
            <!-- 画面（pv-founding.js）の四芒星は SVG だが、Gmail は SVG を落とすので
                 ここは文字の ✦（U+2726）を使う。絵文字ではない字なので色が付かない。
                 字を持たない環境で豆腐にならないよう、記号フォントを後ろに並べておく。 -->
            <td style="vertical-align:top;padding-right:14px;color:#f5c842;font-size:19px;line-height:1;font-family:'Apple Symbols','Segoe UI Symbol','Noto Sans Symbols 2',sans-serif">✦</td>
            <td style="vertical-align:top">
              <div style="color:#f5c842;font-weight:800;font-size:17px;letter-spacing:.11em">FOUNDING PILOT 100</div>
              <div style="color:#d9b64a;font-weight:700;font-size:12px;letter-spacing:.06em;padding-top:7px">${esc(t.plaqueSub)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>`;
}

function foundingCopy(lang) {
  if (lang === 'ja') {
    return {
      subject: 'マイページに「FOUNDING PILOT 100」を追加しました',
      hi: 'こんにちは',
      plaqueSub: '創設メンバー',
      /* ★「あなたには番号があります／ありません」と言わない。
           全員に同じ文面が届くので、どちらを書いても嘘になる人が出る。 */
      paras: [
        'PILOT VALUE のマイページに「FOUNDING PILOT 100」という欄を追加しました。',
        'このサービスには、まだ中身がほとんど無かった時期に、見返りの保証も無いまま自分の給与や職場のことを出してくださった方がいます。いま他のパイロットが読んでいるデータは、その最初の一枚から始まっています。',
        /* ★数字を書かない。「100」は題字の FOUNDING PILOT 100 が言っている。
           本文に素の数字を1つ許すと、次に「残り86枠」「会員31名」が入る道ができる。
           ★通し番号のことも書かない（2026-08-23 に画面から外した）。
           書くと、ログインしても番号が無い人が探すことになる。 */
        '最初に出してくださった方に、この称号をお渡ししています。一度お渡ししたら外れません。あとから登録した方が追い越すこともありません。',
        'マイページの一番上に置いています。ログインするとご覧いただけます。',
      ],
      /* VISION の1行。ここが無いと「バッジを配りました」だけの通知になる。 */
      vision: 'パイロットという職業の価値は、パイロット自身が持っている情報からしか上がりません。PILOT VALUE が見ているのはそこだけです。',
      cta: 'マイページを見る',
      /* ★オプトインで絞らずに全員へ送るので、理由を正直に書く。
           「チェックを入れた方に」と書くと、入れていない人には嘘になる。 */
      why: 'このメールは、PILOT VALUE にご登録いただいた方へ、サービスからのお知らせとしてお送りしています。',
      unsub: '配信を停止する',
    };
  }
  return {
    subject: 'FOUNDING PILOT 100 is now on your PILOT VALUE page',
    hi: 'Hi,',
    plaqueSub: 'Founding Member',
    paras: [
      'We have added a FOUNDING PILOT 100 panel to your PILOT VALUE page.',
      'Early on, when there was almost nothing here, some pilots shared their own pay and their own workplace with no guarantee of anything in return. Everything other pilots read today started from those first entries.',
      'The pilots who shared first are the ones who carry it. Once given, it stays, and nobody who joins later can take it.',
      'We have put it at the top of your page. Sign in to see it.',
    ],
    vision: 'The value of this profession can only be raised by what pilots themselves know. That is the only thing PILOT VALUE is built for.',
    cta: 'Go to your page',
    why: 'This is a service notice sent to people registered with PILOT VALUE.',
    unsub: 'Unsubscribe',
  };
}

/* p = { name, country, unsub_token }
   o = { siteUrl, supabaseUrl, adminEmail, lang } */
export function buildFounding(p, o = {}) {
  const opt = { ...DEFAULTS, ...o };
  const site = String(opt.siteUrl).replace(/\/+$/, '');
  const lang = opt.lang || langModeOf(p);
  const langs = lang === 'both' ? BOTH_ORDER : [lang];

  const meUrl = (l) => `${site}/${l === 'en' ? 'en/' : ''}profile.html`;
  /* ★こちらは日英ぶん2本出す（下の foot の理由）。それぞれ自分の言語のページへ。
     「Unsubscribe」を押したら日本語のページが出る、という食い違いを作らない。 */
  const unsubPage = (l) => `${site}/${l === 'en' ? 'en/' : ''}unsubscribe.html?token=${encodeURIComponent(p?.unsub_token || '')}`;
  const unsubUrl = unsubPage(langs[0]);
  /* 受信箱側のワンクリック解除（RFC 8058）。本番で動いている remind-payslip の
     入口をそのまま指す（新しい解除の窓口を作らない）。 */
  const oneClickUrl = opt.supabaseUrl
    ? `${String(opt.supabaseUrl).replace(/\/+$/, '')}/functions/v1/remind-payslip?u=${encodeURIComponent(p?.unsub_token || '')}`
    : '';

  const parts = langs.map((l) => ({ l, t: foundingCopy(l), me: meUrl(l) }));

  const subject = lang === 'both'
    ? `${parts[0].t.subject} / マイページに追加しました`
    : parts[0].t.subject;

  const blockHtml2 = (t, me, first) => `
    <p style="margin:0 0 18px">${esc(t.hi)}</p>
    ${first ? foundingPlaque(t) : ''}
    ${t.paras.map((s) => `<p style="margin:0 0 16px;color:#333">${esc(s)}</p>`).join('')}
    <p style="margin:22px 0 22px;padding:14px 16px;background:#f7f9fb;border-left:3px solid #f5c842;color:#333;font-size:13px;line-height:1.8">${esc(t.vision)}</p>
    <p style="margin:0 0 4px">
      <a href="${esc(me)}" style="display:inline-block;background:#f5c842;color:#111;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(t.cta)}</a>
    </p>`;

  const blockText2 = (t, me) => [
    strip(t.hi), '',
    `  ✦ FOUNDING PILOT 100 — ${strip(t.plaqueSub)}`, '',
    ...t.paras.flatMap((s) => [strip(s), '']),
    strip(t.vision), '',
    `${strip(t.cta)}: ${me}`,
  ].join('\n');

  /* ★足元は日英ともに出す。build() は先頭の言語だけを出すが、こちらは
     オプトインで絞らず全員に送るので、解除のしかたが読めない人が出ると困る。
     日英ともの人（言語の手がかりが無い人）は、英語しか読めない可能性がある。 */
  const feet = parts.map((x) => x.t);
  const unsubLink = parts
    .map((x) => `<a href="${esc(unsubPage(x.l))}" style="color:#6b7280">${esc(x.t.unsub)}</a>`)
    .join(' / ');

  const html =
    `<div style="background:#f3f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
        <div style="background:#0a0c0f;padding:18px 24px">
          <span style="color:#f5c842;font-weight:800;letter-spacing:.04em;font-size:15px">PILOT VALUE</span>
        </div>
        <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">
          ${parts.map((x, i) => blockHtml2(x.t, x.me, i === 0))
            .reduce((a, b, i) => a + dividerFor(langs[i]) + b)}
        </div>
        <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
          ${feet.map((t) => esc(t.why)).join('<br>')}<br>
          ${unsubLink}
          ・<a href="${esc(site)}" style="color:#6b7280">${esc(site.replace(/^https?:\/\//, ''))}</a>
        </div>
      </div>
    </div>`;

  const text = [
    parts.map((x) => blockText2(x.t, x.me)).join('\n\n— — —\n\n'),
    '', '--',
    ...feet.map((t) => strip(t.why)),
    ...parts.map((x) => `${strip(x.t.unsub)}: ${unsubPage(x.l)}`),
  ].join('\n');

  return { lang, subject, html, text, unsubUrl, oneClickUrl, meUrl: meUrl(langs[0]) };
}
