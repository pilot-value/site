/* profile.html / en/profile.html のマイページに「あなたが出したもの」を出す。
   冪等：すでに当たっていれば何もしない。 */
import { readFileSync, writeFileSync } from 'node:fs';

const T = {
  ja: {
    file: 'profile.html', i18n: '  <script src="review-i18n.js"></script>',
    head: 'あなたが出したもの', hRev: '口コミ', hPay: '給与レポート',
    loading: '読み込み中…', noRev: 'まだ投稿していません', noPay: 'まだ出していません',
    failed: '読み込めませんでした。時間をおいて開き直してください',
    locale: 'ja-JP', submitted: 'を提出',
  },
  en: {
    file: 'en/profile.html', i18n: '  <script src="../review-i18n.js"></script>',
    head: 'What you have contributed', hRev: 'Reviews', hPay: 'Pay reports',
    loading: 'Loading…', noRev: 'You have not posted a review yet',
    noPay: 'You have not submitted a pay report yet',
    failed: 'Could not load this list. Please reopen the page in a moment',
    locale: 'en-US', submitted: ' submitted',
  },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ★色を要素に直に書かない。すぐ上の pv-b-* が「ライトテーマで文字が背景に溶けていた」
   という理由でここに移されている。同じ穴を掘らない（実際1度掘って、白地に
   #b0c0d4 の本文＝ほぼ読めない状態になった）。 */
const CSS = `    /* あなたが出したもの（口コミ／給与レポートの一覧） */
    .mine-h{font-size:.8rem;font-weight:700;color:#b0c0d4;margin-bottom:8px}
    [data-theme="light"] .mine-h{color:#475569}
    .mine-row{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .mine-row:last-child{border-bottom:none}
    [data-theme="light"] .mine-row{border-bottom-color:rgba(0,0,0,.06)}
    .mine-tag{display:inline-flex;font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(245,200,66,.1);color:#f5c842;border:1px solid rgba(245,200,66,.2)}
    [data-theme="light"] .mine-tag{background:rgba(161,114,0,.08);color:#a07200;border-color:rgba(161,114,0,.3)}
    .mine-when{font-size:.72rem;color:#6b7d93}
    .mine-body{font-size:.82rem;line-height:1.6;color:#c9d4e0}
    [data-theme="light"] .mine-body{color:#334155}
    .mine-empty{font-size:.84rem;color:#6b7d93}
`;

function card(t) {
  return `    <!-- あなたが出したもの。口コミも給与も user_id を持たない匿名テーブルなので、
         pv-reunlock.js が proof_hash を作り直して本人の行だけを引き当てる。
         ★ここを固定のゼロ件にすると、出した本人に「投稿はありません」と出続ける。 -->
    <div class="glass" id="my-reviews-card" style="margin-top:20px">
      <div style="font-size:.92rem;font-weight:700;margin-bottom:16px">${t.head}</div>

      <div class="mine-h">${t.hRev}</div>
      <div id="my-reviews-list" class="mine-empty">${t.loading}</div>

      <div class="mine-h" style="margin-top:20px">${t.hPay}</div>
      <div id="my-pay-list" class="mine-empty">${t.loading}</div>
    </div>`;
}

function renderBlock(t, lang) {
  const period = lang === 'ja'
    ? "`${r.period_year}年${r.period_month}月分`"
    : "MONTHS[r.period_month - 1] + ' ' + r.period_year";
  return `    /* ── あなたが出したもの ────────────────────────────────────
       口コミも給与も user_id を持たない。pv-reunlock.js が proof_hash を
       総当たりで作り直して本人の行だけを引く（給与はサーバの my_pay_reports）。
       ここで出さないと、実際には保存されているのに本人には何も見えない。 */

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const CMT = ['culture_comment','salary_comment','benefits_comment','wlb_comment',
                 'ops_comment','training_comment','mgmt_comment'];

    // 口コミは利用者が書いた文字列。innerHTML に入るので必ず通す。
    const esc = (s) => window.PVReviewI18n ? PVReviewI18n.esc(s)
      : String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // 会社コード → 社名。pv_airlines は SSOT から生成され anon に公開済み
    // （gen-airline-codes.mjs）。社名をこの画面で二重に持たない。
    let airlineNames = {};
    async function loadAirlineNames(codes) {
      const want = [...new Set(codes.filter(Boolean))];
      if (!want.length) return;
      try {
        const { data } = await sb.from('pv_airlines').select('code,name_ja,name_en').in('code', want);
        for (const a of (data || [])) airlineNames[a.code] = a.${lang === 'ja' ? 'name_ja' : 'name_en'} || a.code;
      } catch (e) {}
    }
    // 引けなければコードのまま出す（「その他」の自由入力は社名そのものが入っている）
    const airlineLabel = (code) => airlineNames[code] || code || '—';
    const fmtDate = (x) => x ? new Date(x).toLocaleDateString('${t.locale}') : '';
    const snippet = (x) => {
      const s = String(x || '').trim();
      return s ? esc(s.slice(0, 80)) + (s.length > 80 ? '…' : '') : '';
    };

    const postRow = (label, date, body) => \`
        <div class="mine-row">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
            <span class="mine-tag">\${esc(label)}</span>
            <span class="mine-when">\${esc(date)}</span>
          </div>\${body ? \`
          <div class="mine-body">\${body}</div>\` : ''}
        </div>\`;

    /* ★ null ＝引けなかった、[] ＝本当にゼロ件。ここを一緒にすると、通信や権限で
       失敗しただけの人に「まだ投稿していません」と言い切ることになる。それが
       今回の報告そのもの（出したのに、出していないことにされる）の作り方。 */
    function renderReviews(revs) {
      const el = document.getElementById('my-reviews-list');
      if (!el) return;
      if (!revs) { el.textContent = '${t.failed}'; return; }
      if (!revs.length) { el.textContent = '${t.noRev}'; return; }
      el.innerHTML = revs.map(r => {
        // 訳文があればページの言語で出す（community.html と同じ出し分け）
        const body = window.PVReviewI18n ? PVReviewI18n.pick(r).text
                                         : (CMT.map(k => r[k]).find(v => v && v.trim()) || '');
        return postRow(airlineLabel(r.airline), fmtDate(r.created_at), snippet(body));
      }).join('');
    }

    function renderMyPay(reports) {
      const el = document.getElementById('my-pay-list');
      if (!el) return;
      if (!reports) { el.textContent = '${t.failed}'; return; }
      if (!reports.length) { el.textContent = '${t.noPay}'; return; }
      // ★金額は出さない。マイページは人に見せる場面がある。実額は my-value.html 側。
      el.innerHTML = reports.map(r => {
        const name = (r.airline === 'other' && r.airline_other) ? r.airline_other : airlineLabel(r.airline);
        const period = (r.period_year && r.period_month) ? ${period} : '';
        return postRow(name, fmtDate(r.created_at), period ? esc(period) + '${t.submitted}' : '');
      }).join('');
    }

    // 上の pvCheckReunlock と同じ照合結果を使う（pv-reunlock.js がキャッシュ
    // するので通信は増えない）。await しないのは、ここで詰まってもバッジや
    // プロフィール本体の描画を止めないため。
    async function renderMyPosts() {
      let revs = null, reports = null;                 // null のまま＝引けなかった
      try {
        const extra = window.PVReviewI18n ? PVReviewI18n.EXTRA_COLS : '';
        if (window.pvFindMyReviews) revs = await pvFindMyReviews(sb, currentUser.id, { extraCols: extra });
      } catch (e) {}
      try {
        const d = window.pvMyPayReports ? await pvMyPayReports(sb, currentUser.id) : null;
        // my_pay_reports は古い順。ゼロ件でも reports は [] で返る（＝無いのは失敗のときだけ）
        if (d && Array.isArray(d.reports)) reports = d.reports.slice().reverse();
      } catch (e) {}
      await loadAirlineNames([...(revs || []).map(r => r.airline),
                              ...(reports || []).map(r => r.airline)]);
      renderReviews(revs);
      renderMyPay(reports);
    }
`;
}

for (const [lang, t] of Object.entries(T)) {
  const url = new URL(t.file, import.meta.url);
  let s = readFileSync(url, 'utf8');
  const before = s;

  // 1. review-i18n.js を読み込む（訳文の出し分けと esc / EXTRA_COLS を使う）
  const anchor = t.i18n.replace('review-i18n.js', 'pv-reunlock.js');
  if (!s.includes(t.i18n)) {
    if (!s.includes(anchor)) throw new Error(`pv-reunlock.js の script タグが無い: ${t.file}`);
    s = s.replace(anchor, anchor + '\n' + t.i18n);
  }

  // 2. 一覧の CSS（テーマ2つぶん）。★ライトテーマの上書きまでを1組にして持つ
  if (!s.includes('.mine-row{')) {
    const cssAnchor = '    [data-theme="light"] .pv-b-gold{color:#a07200}\n';
    if (!s.includes(cssAnchor)) throw new Error(`CSS の差し込み先が無い: ${t.file}`);
    s = s.replace(cssAnchor, cssAnchor + CSS);
  }

  // 3. カードを口コミ／給与の2ブロックに
  const cardRe = /    <!-- My reviews -->\n    <div class="glass" id="my-reviews-card"[\s\S]*?\n    <\/div>/;
  if (cardRe.test(s)) s = s.replace(cardRe, () => card(t));
  else if (!s.includes('id="my-pay-list"')) throw new Error(`カードが見つからない: ${t.file}`);

  // 4. 「ゼロ件固定」をやめ、照合の後ろで実データを描く
  const zeroRe = /\n *\/\/ (口コミ一覧は現状ゼロ件固定|This list is always empty)[\s\S]*?\n *renderReviews\(\[\]\);\n/;
  if (zeroRe.test(s)) s = s.replace(zeroRe, () => '\n');
  const reunlock = /(try \{ if \(window\.pvCheckReunlock\) await pvCheckReunlock\(sb, currentUser\.id\); \} catch\(e\) \{\}\n)/;
  if (!s.includes('renderMyPosts();')) {
    if (!reunlock.test(s)) throw new Error(`pvCheckReunlock の行が無い: ${t.file}`);
    s = s.replace(reunlock, (m) => m + '\n      // 出したものを一覧にする（上と同じ proof_hash の照合結果を使う）\n      renderMyPosts();\n');
  }

  // 5. renderReviews を差し替え、給与側と共通ヘルパを足す
  // ★差し替え後のブロックにも renderReviews があるので、先に「もう当たっているか」で
  //   降りる。順番を逆にすると2回目の実行で自分自身を包み直して二重になる。
  const fnRe = /    function renderReviews\(revs\) \{[\s\S]*?\n    \}\n/;
  if (s.includes('function renderMyPay')) { /* 適用済み */ }
  else if (fnRe.test(s)) s = s.replace(fnRe, () => renderBlock(t, lang));
  else throw new Error(`renderReviews が見つからない: ${t.file}`);

  if (s === before) { console.log(`・${t.file} 変更なし（すでに当たっている）`); continue; }
  writeFileSync(url, s);
  console.log(`✅ ${t.file}`);
}
