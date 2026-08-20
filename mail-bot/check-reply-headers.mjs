/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — mail-bot/check-reply-headers.mjs  v1.0
   実際に送った返信メール（.eml）に身元が乗っていないかを機械的に確かめる。

   なぜ「送信元の表示」を目で見るだけでは足りないのか。
     Gmail の画面上は「PILOT VALUE」と出ていても、ヘッダには
     X-Google-Original-From や Sender に個人アドレスが残ることがある。
     受け取った相手が「元のメッセージを表示」を押せば全部見える。
     さらに署名や表示名は MIME で base64 に包まれるので、
     .eml を素のまま grep しても日本語の氏名は1文字も引っかからない。
     ここでは encoded-word と本文の base64 / quoted-printable を
     ちゃんと復号してから当てる。

   ★ 判定ルールは pii-rules.mjs（assert-no-pii.mjs と同一）。片方だけ緩くならないようにしてある。

   使い方:
     node mail-bot/check-reply-headers.mjs <保存した.eml>
     node mail-bot/check-reply-headers.mjs <保存した.eml> --verbose   # 復号したヘッダ・本文を表示

   .eml の取り方（Gmail）:
     メールを開く → 右上の ︙ → メッセージのソースを表示 → 元のメッセージをダウンロード
════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { BASE_RULES, DENY_FILE, EMPLOYER_FILE, loadDenylist, loadEmployerDenylist, denylistHint } from '../pii-rules.mjs';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const FILE = args.find((a) => !a.startsWith('--'));

if (!FILE) {
  console.error('使い方: node mail-bot/check-reply-headers.mjs <保存した.eml> [--verbose]');
  process.exit(1);
}
if (!fs.existsSync(FILE)) {
  console.error(`❌ ファイルが無い: ${FILE}`);
  process.exit(1);
}

let fail = 0, ran = 0;
const ok = (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n        → ${detail}` : ''}`);
};

const { rules: denyRules, count: denyLoaded } = loadDenylist();
const { rules: empRules, count: empLoaded } = loadEmployerDenylist();
/* ★ assert-no-pii.mjs と同じ3つの束。問い合わせに返信するとき、氏名だけでなく
   社内語彙（部門コードや手当の呼び名）を書いても勤務先が割れる。 */
const RULES = [...BASE_RULES, ...denyRules, ...empRules];

/* ── MIME の復号 ───────────────────────────────────────────────
   ★ latin1 で読んでバイトを1:1で保つ。ここで utf8 として読むと
     base64 の前の生バイトが壊れて、復号結果が別物になる。 */
const raw = fs.readFileSync(FILE, 'latin1');

const dec = (buf, charset) => {
  try { return new TextDecoder(charset || 'utf-8').decode(buf); }
  catch { return buf.toString('latin1'); }        // iso-2022-jp 等が無い環境でも止めない
};

const qpDecode = (s) =>
  Buffer.from(
    s.replace(/=\r?\n/g, '')                       // ソフト改行
     .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))),
    'latin1',
  );

/* =?UTF-8?B?…?= / =?ISO-2022-JP?Q?…?= を人が読める形に戻す。
   ★ 連続する encoded-word の間の空白は「無いもの」として扱う決まり（RFC 2047）。
     ここを消さないと「山田 太郎」が「山田  太郎」になって正規表現が外れる。 */
function decodeWords(s) {
  return s
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, data) => {
      const buf = enc.toUpperCase() === 'B'
        ? Buffer.from(data, 'base64')
        : qpDecode(data.replace(/_/g, ' '));
      return dec(buf, cs);
    });
}

function splitEntity(s) {
  const i = s.search(/\r?\n\r?\n/);
  if (i < 0) return { head: s, body: '' };
  return { head: s.slice(0, i), body: s.slice(i).replace(/^\r?\n\r?\n/, '') };
}

/* 折り返された行（次行が空白始まり）を1行に戻してから name/value に割る。 */
function headerPairs(head) {
  const out = [];
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = /^([!-9;-~]+):\s?([\s\S]*)$/.exec(line);
    if (m) out.push({ name: m[1].toLowerCase(), value: decodeWords(m[2]).trim() });
  }
  return out;
}

const { head: topHead, body: topBody } = splitEntity(raw);
const headers = headerPairs(topHead);
const get = (n) => headers.filter((h) => h.name === n).map((h) => h.value);
const first = (n) => get(n)[0] || '';

/* ── 本文（MIME を再帰的に降りて復号）───────────────────────── */
const texts = [];       // { ct, text }
const attachNames = []; // 添付のファイル名。ここに氏名が入るのもよくある漏れ

function walk(entity, depth = 0) {
  if (depth > 8) return;                                   // 壊れた multipart で無限に潜らない
  const { head, body } = splitEntity(entity);
  const hs = headerPairs(head);
  const ctRaw = (hs.find((h) => h.name === 'content-type') || {}).value || 'text/plain';
  const ct = ctRaw.toLowerCase();
  const cte = ((hs.find((h) => h.name === 'content-transfer-encoding') || {}).value || '7bit').toLowerCase();
  const cd = (hs.find((h) => h.name === 'content-disposition') || {}).value || '';

  const fn = /filename\s*=\s*"?([^";\r\n]+)"?/i.exec(cd) || /\bname\s*=\s*"?([^";\r\n]+)"?/i.exec(ctRaw);
  if (fn) attachNames.push(decodeWords(fn[1]));

  const bm = /boundary\s*=\s*"?([^";\r\n]+)"?/i.exec(ctRaw);
  if (ct.startsWith('multipart/') && bm) {
    const segs = body.split('--' + bm[1]);
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].startsWith('--')) break;                 // 終端デリミタ
      walk(segs[i].replace(/^\r?\n/, ''), depth + 1);
    }
    return;
  }

  /* 葉。text/* だけ中身を読む。添付の生バイトを文字列として当てても
     偽陽性を生むだけなので、添付はファイル名だけ見る（上で拾った）。 */
  if (!ct.startsWith('text/') && !ct.startsWith('message/')) return;

  const buf =
    cte.includes('base64') ? Buffer.from(body.replace(/\s+/g, ''), 'base64')
    : cte.includes('quoted-printable') ? qpDecode(body)
    : Buffer.from(body, 'latin1');
  const cs = (/charset\s*=\s*"?([^";\r\n]+)"?/i.exec(ctRaw) || [])[1];
  texts.push({ ct: ct.split(';')[0], text: dec(buf, cs) });
}
walk(`${topHead}\n\n${topBody}`);

/* ── ヘッダの分類 ─────────────────────────────────────────────
   相手に渡るヘッダと、自分の受信側で後から付くヘッダを分ける。
   Cloudflare が Gmail へ転送した控えを検査すると、Delivered-To や
   Received の "for <…>" に自分の個人アドレスが必ず載る。
   それは「相手が見るもの」ではないので、落とさずに ℹ️ で示すだけにする。
   ★ 分類に無いヘッダは危険側（相手に渡る）として扱う。取りこぼすより鳴らす。 */
const INBOUND = /^(received|x-received|delivered-to|x-forwarded-|x-original-to|to|cc|bcc|authentication-results|received-spf|dkim-signature|arc-|x-gm-|x-google-|list-unsubscribe|autocrypt|x-spam|x-cloudflare|x-ses)/;

/* ★ x-google-original-from は x-google- で始まるが、無害どころか本丸。
   Gmail が差出人を書き換えたときに元の個人アドレスが入る。
   前方一致だけで分類すると、これを「受信側で付くだけ」と誤って報告する（実際に踏んだ）。 */
const OUTBOUND_FORCE = /^(from|sender|reply-to|return-path|resent-from|x-google-original-from)$/;
const isInbound = (n) => !OUTBOUND_FORCE.test(n) && INBOUND.test(n);

const outboundHeaders = headers.filter((h) => !isInbound(h.name));
const inboundHeaders  = headers.filter((h) =>  isInbound(h.name));

const hits = (text, where) => {
  const out = [];
  for (const r of RULES) {
    const m = r.re.exec(text);
    if (m) out.push({ where, id: r.id, why: r.why, fix: r.fix, sample: m[0].slice(0, 60) });
  }
  return out;
};

console.log(`\n── ${FILE} を検査（.pii-denylist から ${denyLoaded} 件読み込み）──`);
if (VERBOSE) {
  console.log('\n[相手に渡るヘッダ]');
  for (const h of outboundHeaders) console.log(`   ${h.name}: ${h.value.slice(0, 160)}`);
  console.log('\n[本文]');
  for (const t of texts) console.log(`   --- ${t.ct} ---\n${t.text.split('\n').map((l) => '   ' + l).join('\n')}`);
  console.log('');
}

/* ── 0) 検査そのものが生きているか ───────────────────────────── */
ok(denyLoaded > 0,
   '.pii-denylist が読めている（氏名の検査が生きている）',
   denyLoaded > 0 ? '' : denylistHint(DENY_FILE));
ok(empLoaded > 0,
   '.employer-denylist が読めている（勤務先の検査が生きている）',
   empLoaded > 0 ? '' : denylistHint(EMPLOYER_FILE));

/* ── 1) 相手に渡るヘッダに身元が無いか ──────────────────────── */
const headerHits = outboundHeaders.flatMap((h) => hits(`${h.name}: ${h.value}`, h.name));
ok(headerHits.length === 0,
   `相手に渡るヘッダ ${outboundHeaders.length} 本に個人を特定できる文字列が無い`,
   headerHits.map((h) => `${h.where}: ${h.sample}  … ${h.why}`).join('\n        → '));

/* ── 2) 本文・署名に身元が無いか ─────────────────────────────
   署名は base64 に包まれる。ここは復号済みのテキストに当てている。 */
const bodyHits = texts.flatMap((t) => hits(t.text, t.ct));
ok(bodyHits.length === 0,
   `本文 ${texts.length} パートに個人を特定できる文字列が無い（署名を含む）`,
   bodyHits.map((h) => `${h.where}: ${h.sample}  … ${h.why}\n           直し方: ${h.fix}`).join('\n        → '));

/* ── 3) 添付のファイル名 ────────────────────────────────────── */
const nameHits = attachNames.flatMap((n) => hits(n, 'filename'));
ok(nameHits.length === 0,
   `添付ファイル名 ${attachNames.length} 件に氏名が無い`,
   nameHits.map((h) => h.sample).join(' / '));

/* ── 4) 差出人が info@pilot-value.com か ─────────────────────── */
const from = first('from');
ok(/info@pilot-value\.com/i.test(from),
   '差出人が info@pilot-value.com',
   /info@pilot-value\.com/i.test(from) ? '' : `From: ${from || '（無し）'} … Gmail の送信元を切り替え忘れている`);

/* ── 5) Gmail が差出人を書き換えていないか ───────────────────
   ★ これが今回の本丸。Gmail が自前のサーバから別名で送ると、
     元の個人アドレスを X-Google-Original-From に残し、受信側に「…経由」と表示する。
     外部 SMTP（Resend）を指定できていれば、このヘッダは付かない。 */
const xgof = first('x-google-original-from');
ok(xgof === '',
   'X-Google-Original-From が無い（Gmail が差出人を書き換えていない）',
   xgof ? `${xgof} … Gmail の送信元設定で「SMTP サーバー経由で送信」を選び直す` : '');

/* ── 6) Sender / Return-Path が個人でないか ─────────────────── */
const sender = first('sender');
ok(sender === '' || /pilot-value\.com/i.test(sender),
   'Sender ヘッダが個人アドレスでない',
   sender && !/pilot-value\.com/i.test(sender) ? `Sender: ${sender}` : '');

/* ★ 送信基盤ごとに Return-Path のドメインが違う。
   実際の返信は Gmail → Brevo の SMTP リレー（smtp-relay.brevo.com）を通るので
   bounce は brevo/sendinblue 側になる。Resend（通知メール）は amazonses。
   ここを Resend だけにしていると、正しい返信を誤って落とす。 */
const rp = first('return-path');
const RP_OK = /(pilot-value\.com|amazonses\.com|resend\.com|brevo\.com|sendinblue\.com)/i;
ok(rp === '' || RP_OK.test(rp),
   'Return-Path が自ドメインか送信基盤のもの',
   rp && !RP_OK.test(rp) ? `Return-Path: ${rp}` : '');

/* ── 7) Message-ID の生成元 ───────────────────────────────────
   ★ 実物は <CAF…@mail.gmail.com> でサブドメインが入る。
     /@gmail\.com/ だけでは当たらない（実際に素通しした）。 */
const mid = first('message-id');
const MID_GMAIL = /@([\w-]+\.)*(gmail|googlemail)\.com/i;
ok(mid === '' || !MID_GMAIL.test(mid),
   'Message-ID が Gmail 生成でない（自前のサーバから出ていない証跡）',
   MID_GMAIL.test(mid) ? `Message-ID: ${mid} … Gmail 自身が送っている。外部 SMTP 経由になっていない` : '');

/* ── 参考情報（落とさない）──────────────────────────────────
   受信側で付くヘッダに個人アドレスが出るのは正常。相手には渡らない。 */
const inHits = inboundHeaders.flatMap((h) => hits(`${h.value}`, h.name));
if (inHits.length) {
  const names = [...new Set(inHits.map((h) => h.where))];
  console.log(`\nℹ️  受信側で付くヘッダ ${names.length} 種（${names.join(', ')}）に個人アドレスが見えるが、`);
  console.log('    これは自分の受信箱へ転送された控えだから。相手が受け取る本文には含まれない。');
}

console.log(`\n==== ${ran - fail}/${ran} passed ====`);
if (fail) {
  console.log('\n直し方は mail-bot/README.md「返信経路」節。');
  process.exit(1);
}
console.log('この返信は身元を漏らしていない。');
process.exit(0);
