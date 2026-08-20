/* 明細解析で新しく触れるデータを personal-data.html に書き足す。
   機能を出す前にここを直す。あとから足すのは順番が逆で、
   「書いていないことをやっていた」期間が残る。

   足すのは3つ：
     ① 給与明細の画像 …… 端末で黒塗り→解析→即破棄。保存しない
     ② 給与レポート   …… そもそも今まで一覧に無かった（既存の抜け）
     ③ IPアドレスのHMAC … 回数制限のために30日だけ持つ。平文では持たない
   併せて「保持期間」と「海外移転」に、実際に何がどこへ行くかを書く。
   実行: node patch-personal-data.mjs                                        */
import { readFileSync, writeFileSync } from 'fs';

const ROW = (label, body) =>
  `      <div class="data-row">\n` +
  `        <div><p style="color:#e8edf2;font-weight:600;font-size:.9rem">${label}</p></div>\n` +
  `        <div><p>${body}</p></div>\n` +
  `      </div>\n`;

const JA = {
  file: 'personal-data.html',
  anchorRows: `      <div class="data-row">
        <div><p style="color:#e8edf2;font-weight:600;font-size:.9rem">投稿コンテンツ</p></div>
        <div><p>コミュニティへの投稿・コメント。利用規約に違反する場合は削除対象。</p></div>
      </div>
`,
  newRows:
    ROW('給与明細の画像',
      '自動入力のために解析するときだけ使います。<b>氏名・社員番号などはお使いの端末の中で黒く塗ってから送信</b>され、塗る前の画像が端末を出ることはありません。' +
      '画像はサーバのメモリ上で読み取るだけで、<b>ストレージにもデータベースにも保存せず、ログにも残しません</b>。読み取りが終わり次第、破棄されます。'),
  newRows2:
    ROW('給与レポート',
      '金額・時間・会社などの投稿内容。<b>誰が投稿したかを結び付けずに保存します</b>（アカウントIDそのものではなく、復元できないハッシュで重複投稿だけを判定しています）。統計値の算出に使用します。') +
    ROW('IPアドレス（ハッシュ化）',
      '明細の読み取り回数の上限（未ログインは1日1回）を数えるためだけに使います。' +
      '<b>IPアドレスそのものは保存せず、復元できないハッシュに変換して30日間だけ</b>保持し、その後削除します。'),
  retFrom: `        <li>コミュニティ投稿：退会後も匿名化した形で残存する場合があります</li>`,
  retTo: `        <li>コミュニティ投稿：退会後も匿名化した形で残存する場合があります</li>
        <li>給与明細の画像：<b>保存しません</b>（読み取り後ただちに破棄）</li>
        <li>回数制限用のハッシュ化IPアドレス：30日後に削除</li>`,
  ovFrom: `      <p>当サイトは日本国内を主な運営基盤としています。サービス提供にあたり、一部のデータ処理が海外のサーバーで行われる場合があります。その際は適切な保護措置を講じます。</p>`,
  ovTo: `      <p>当サイトは日本国内を主な運営基盤としています。サービス提供にあたり、一部のデータ処理が海外のサーバーで行われる場合があります。その際は適切な保護措置を講じます。</p>
      <p style="margin-top:12px">具体的には、次の処理で海外の事業者を利用しています。</p>
      <ul>
        <li><b>給与明細の読み取り</b>：Anthropic 社（米国）の API に、<b>端末側で黒塗りしたあとの画像</b>を送って解析します。画像は解析のためだけに送られ、当サイトでは保存しません。</li>
        <li><b>口コミの翻訳</b>：同社の API に投稿本文を送って日英に翻訳します。</li>
        <li><b>認証・データベース</b>：Supabase 社のサービスを利用しています。</li>
      </ul>`,
  dateFrom: `最終更新日：2026年3月26日`,
  dateTo: `最終更新日：2026年8月4日`,
};

const EN = {
  file: 'en/personal-data.html',
  anchorRows: `      <div class="data-row">
        <div><p style="color:#e8edf2;font-weight:600;font-size:.9rem">Posted content</p></div>
        <div><p>Posts and comments submitted to the community. Content that violates the Terms of Service is subject to removal.</p></div>
      </div>
`,
  newRows:
    ROW('Payslip images',
      'Used only to read the figures for auto-fill. <b>Your name, staff number and similar details are blacked out on your own device before anything is sent</b>, and the un-redacted image never leaves your device. ' +
      'The image is read in server memory only — it is <b>never written to storage or to a database, and never written to logs</b> — and is discarded as soon as it has been read.'),
  newRows2:
    ROW('Pay reports',
      'The figures, hours and airline you submit. <b>They are stored without being linked to who submitted them</b> (we keep an irreversible hash rather than your account ID, purely to detect duplicate submissions). Used to produce aggregate statistics.') +
    ROW('IP address (hashed)',
      'Used only to count payslip reads against the daily limit (one per day when signed out). ' +
      '<b>The IP address itself is never stored: it is converted into an irreversible hash and kept for 30 days only</b>, then deleted.'),
  retFrom: `        <li>Community posts: may remain in anonymized form even after you withdraw</li>`,
  retTo: `        <li>Community posts: may remain in anonymized form even after you withdraw</li>
        <li>Payslip images: <b>not retained at all</b> — discarded immediately after being read</li>
        <li>Hashed IP addresses used for rate limiting: deleted after 30 days</li>`,
  ovFrom: `      <p>This site is operated primarily from within Japan. In the course of providing the service, some data processing may take place on servers located overseas. Where this occurs, we implement appropriate protective measures.</p>`,
  ovTo: `      <p>This site is operated primarily from within Japan. In the course of providing the service, some data processing may take place on servers located overseas. Where this occurs, we implement appropriate protective measures.</p>
      <p style="margin-top:12px">Specifically, the following processing involves providers outside Japan.</p>
      <ul>
        <li><b>Reading payslips</b>: the <b>already-redacted</b> image is sent to Anthropic's API (United States) to be read. It is sent solely for that purpose and is not stored by us.</li>
        <li><b>Translating reviews</b>: review text is sent to the same API to be translated between Japanese and English.</li>
        <li><b>Authentication and database</b>: provided by Supabase.</li>
      </ul>`,
  dateFrom: `Last updated: March 26, 2026`,
  dateTo: `Last updated: August 4, 2026`,
};

for (const c of [JA, EN]) {
  let s = readFileSync(c.file, 'utf8');
  const before = s.length;
  const rowsBefore = (s.match(/class="data-row"/g) || []).length;

  const put = (from, to) => {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${c.file}: 「${from.slice(0, 46).replace(/\n/g, '⏎')}…」が ${n} 箇所`);
    s = s.replace(from, to);
  };

  put(c.anchorRows, c.anchorRows + c.newRows + c.newRows2);
  put(c.retFrom, c.retTo);
  put(c.ovFrom, c.ovTo);
  put(c.dateFrom, c.dateTo);

  const rowsAfter = (s.match(/class="data-row"/g) || []).length;
  if (rowsAfter !== rowsBefore + 3) throw new Error(`${c.file}: 行が ${rowsAfter - rowsBefore} 増えた（3のはず）`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${c.file}: </html> が1つでない`);
  if (/transition:\s*all/.test(s)) throw new Error(`${c.file}: transition:all が入った`);
  // 書いてはいけないこと（保存する、と読める文言が混ざっていないか）
  if (/明細.{0,12}を保存し(ます|、)/.test(s)) throw new Error(`${c.file}: 明細を保存すると読める文言がある`);

  writeFileSync(c.file, s);
  console.log(`✅ ${c.file}  ${before} → ${s.length} bytes（データ種別 ${rowsBefore - 1} → ${rowsAfter - 1} 件）`);
}
