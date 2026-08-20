/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — mail-bot/smtp-check.mjs  v1.0
   Gmail の「他のメールアドレスを追加」に入れるのと同じ SMTP 資格情報を、
   Gmail に貼る前に単体で検証する。

   なぜ要るのか。
     Gmail の送信元追加は、認証に失敗しても「認証に失敗しました」としか出ない。
     ホスト名・ポート・ユーザー名・キーのどれが悪いのか分からないまま
     試行錯誤することになる。ここで先に 235（認証成功）まで取っておけば、
     Gmail 側で失敗したときの原因を「Gmail の設定」に絞り込める。

   既定は認証までで、メールは送らない（--send を付けたときだけ送る）。

   使い方:
     node mail-bot/smtp-check.mjs                 # 認証だけ確認（送信しない）
     node mail-bot/smtp-check.mjs --send          # info@pilot-value.com へテスト送信
     node mail-bot/smtp-check.mjs --port=465      # 暗黙 TLS でも通るか確認
     node mail-bot/smtp-check.mjs --verbose       # SMTP のやり取りを表示（キーは伏せる）

   ★ 依存追加なし。node:net と node:tls だけで SMTP を喋る（リポジトリの方針に合わせた）。
   ★ APIキーは絶対に表示しない。--verbose でも AUTH の行は伏せ字にする。
════════════════════════════════════════════════════════════════ */
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dir = fileURLToPath(new URL('.', import.meta.url));

/* ── .env（send.mjs と同じ読み方）─────────────────────────────── */
const envPath = join(__dir, '.env');
if (!existsSync(envPath)) {
  console.error('❌ mail-bot/.env がありません。mail-bot/.env.example を参照。');
  process.exit(1);
}
/* ★ 既に環境変数にある値は上書きしない。
   Gmail 用に新しく発行したキーを .env を書き換えずに試せるようにするため:
     RESEND_API_KEY=re_xxx node mail-bot/smtp-check.mjs
   （send.mjs 側は常に .env を優先する。あちらは本番配信なので、
     その場の環境変数で送信元が変わらない方が安全という判断） */
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const s = line.trim();
  if (!s || s.startsWith('#')) continue;
  const [k, ...v] = s.split('=');
  const key = k?.trim();
  if (key && v.length && process.env[key] === undefined) process.env[key] = v.join('=').trim();
}

const args    = process.argv.slice(2);
const SEND    = args.includes('--send');
const VERBOSE = args.includes('--verbose');
const PORT    = Number((args.find((a) => a.startsWith('--port=')) || '').split('=')[1] || 587);

/* Resend の SMTP リレー。ユーザー名は固定文字列 'resend'、
   パスワードは HTTP API と同じキーをそのまま使う。 */
const HOST = 'smtp.resend.com';
const USER = 'resend';
const PASS = process.env.RESEND_API_KEY;

/* 返信の送信元。noreply@ ではなく info@ を使う。
   問い合わせへの返信は「返せるアドレス」から出す必要がある。 */
const FROM_ADDR = 'info@pilot-value.com';
const FROM_NAME = 'PILOT VALUE';
const TO_ADDR   = (args.find((a) => a.startsWith('--to=')) || '').split('=')[1] || 'info@pilot-value.com';

if (!PASS) {
  console.error('❌ RESEND_API_KEY が mail-bot/.env にありません。');
  process.exit(1);
}

/* ── SMTP の最小クライアント ──────────────────────────────────
   応答は複数行になる（継続行は "250-"、最終行は "250 "）。
   最終行が来るまで読み切らずに次のコマンドを送ると同期がずれるので、
   「先頭3桁のあとが空白の行」が現れるまで待つ。 */
function wrap(sock) {
  let buf = '';
  let pending = null;
  sock.setEncoding('utf8');

  const flush = () => {
    if (!pending) return;
    const lines = buf.split('\n');
    const i = lines.findIndex((l) => /^\d{3} /.test(l));
    if (i < 0) return;
    const code = Number(lines[i].slice(0, 3));
    const text = lines.slice(0, i + 1).join('\n').replace(/\r/g, '').trim();
    buf = lines.slice(i + 1).join('\n');
    const p = pending;
    pending = null;
    p.res({ code, text });
  };

  const die = (e) => {
    const p = pending;
    pending = null;
    if (p) p.rej(e instanceof Error ? e : new Error(String(e)));
  };

  sock.on('data', (d) => { buf += d; flush(); });
  sock.on('error', die);
  sock.on('close', () => die(new Error('接続が切れた')));
  sock.setTimeout(20000, () => die(new Error('20秒応答が無い')));

  return {
    sock,
    read: () => new Promise((res, rej) => { pending = { res, rej }; flush(); }),
    write: (s, redact = false) => {
      if (VERBOSE) console.log('   C: ' + (redact ? '（伏せ字）' : s.replace(/\r\n$/, '')));
      sock.write(s);
    },
  };
}

const once = (em, ev) =>
  new Promise((res, rej) => {
    const onOk = (v) => { em.off('error', onErr); res(v); };
    const onErr = (e) => { em.off(ev, onOk); rej(e); };
    em.once(ev, onOk);
    em.once('error', onErr);
  });

async function cmd(conn, line, expect, label, redact = false) {
  conn.write(line + '\r\n', redact);
  const r = await conn.read();
  if (VERBOSE) console.log('   S: ' + r.text.replace(/\n/g, '\n      '));
  if (!expect.includes(r.code)) {
    throw new Error(`${label} が ${r.code} を返した:\n      ${r.text.replace(/\n/g, '\n      ')}`);
  }
  return r;
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/* ── テストメール本文 ────────────────────────────────────────
   ★ 実在の氏名・個人アドレスを1文字も入れない（このメールも公開されうる前提で書く）。 */
function buildMessage() {
  const now = new Date();
  const subject = '返信経路の疎通テスト（PILOT VALUE）';
  const body = [
    'これは info@pilot-value.com を送信元にした返信経路のテストです。',
    '',
    '受け取ったら Gmail で次を確認してください:',
    '  1. 差出人が「PILOT VALUE <info@pilot-value.com>」になっている',
    '  2. 「…経由」「via gmail.com」の表示が出ていない',
    '  3. ︙ →「メッセージのソースを表示」→「元のメッセージをダウンロード」で .eml を保存し、',
    '     node mail-bot/check-reply-headers.mjs <保存した.eml> を実行して合格すること',
    '',
    `送信時刻: ${now.toISOString()}`,
  ].join('\n');

  const headers = [
    `From: =?UTF-8?B?${b64(FROM_NAME)}?= <${FROM_ADDR}>`,
    `To: <${TO_ADDR}>`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <smtpcheck.${now.getTime().toString(36)}@pilot-value.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].join('\r\n');

  /* base64 は 76 文字で折る（RFC 2045）。長い行を嫌う MTA がある。 */
  const encoded = b64(body).replace(/(.{76})/g, '$1\r\n');
  return `${headers}\r\n\r\n${encoded}\r\n`;
}

/* ── 本体 ───────────────────────────────────────────────────── */
console.log(`\n── Resend SMTP 疎通確認 ${HOST}:${PORT} ──`);
console.log(`   ユーザー名: ${USER}`);
console.log(`   パスワード: RESEND_API_KEY（${PASS.length} 文字・表示しない）`);
console.log(`   送信元:     ${FROM_NAME} <${FROM_ADDR}>`);
console.log(`   モード:     ${SEND ? `送信する → ${TO_ADDR}` : '認証まで（送信しない）'}\n`);

let conn;
try {
  const implicitTLS = PORT === 465 || PORT === 2465;

  if (implicitTLS) {
    const sock = tls.connect({ host: HOST, port: PORT, servername: HOST });
    await once(sock, 'secureConnect');
    conn = wrap(sock);
  } else {
    const raw = net.connect({ host: HOST, port: PORT });
    await once(raw, 'connect');
    conn = wrap(raw);
  }

  const greet = await conn.read();
  if (greet.code !== 220) throw new Error(`挨拶が 220 でない: ${greet.text}`);
  console.log('✓ 接続できた');

  await cmd(conn, 'EHLO pilot-value.com', [250], 'EHLO');

  if (!implicitTLS) {
    /* STARTTLS。ここを省くと平文で API キーを流すことになる。 */
    await cmd(conn, 'STARTTLS', [220], 'STARTTLS');
    const sec = tls.connect({ socket: conn.sock, servername: HOST });
    await once(sec, 'secureConnect');
    conn = wrap(sec);
    await cmd(conn, 'EHLO pilot-value.com', [250], 'STARTTLS 後の EHLO');
    console.log('✓ STARTTLS で暗号化された');
  } else {
    console.log('✓ 暗黙 TLS で暗号化されている');
  }

  await cmd(conn, 'AUTH LOGIN', [334], 'AUTH LOGIN');
  await cmd(conn, b64(USER), [334], 'ユーザー名', true);
  await cmd(conn, b64(PASS), [235], 'パスワード（RESEND_API_KEY）', true);
  console.log('✓ 認証に成功した（235）— この資格情報をそのまま Gmail に入れてよい');

  if (SEND) {
    await cmd(conn, `MAIL FROM:<${FROM_ADDR}>`, [250], 'MAIL FROM');
    await cmd(conn, `RCPT TO:<${TO_ADDR}>`, [250, 251], 'RCPT TO');
    await cmd(conn, 'DATA', [354], 'DATA');

    /* 行頭のドットはエスケープする（RFC 5321 の dot-stuffing）。
       今の本文には出ないが、本文を書き換えたときに黙って壊れるのを防ぐ。 */
    const msg = buildMessage().replace(/\r\n\./g, '\r\n..');
    conn.write(msg + '\r\n.\r\n');
    const r = await conn.read();
    if (r.code !== 250) throw new Error(`本文の受理が ${r.code}: ${r.text}`);
    console.log(`✓ 送信を受理された → ${TO_ADDR}`);
    console.log('   ' + r.text);
  }

  await cmd(conn, 'QUIT', [221], 'QUIT');
  conn.sock.end();

  console.log('\n── 次にやること ──');
  if (!SEND) {
    console.log('  1. node mail-bot/smtp-check.mjs --send   （自分宛にテスト送信）');
    console.log('  2. Gmail 側の送信元追加（手順は mail-bot/README.md）');
  } else {
    console.log('  1. 受信したメールを .eml で保存する');
    console.log('  2. node mail-bot/check-reply-headers.mjs <保存した.eml>');
  }
  console.log('');
  process.exit(0);
} catch (e) {
  console.error(`\n✗ 失敗: ${e.message}\n`);
  console.error('  よくある原因:');
  console.error('   ・535 → RESEND_API_KEY が無効か、送信権限の無いキー');
  console.error('   ・450/403 → 送信元ドメインが Resend で未認証（pilot-value.com は認証済のはず）');
  console.error('   ・接続できない → ネットワークが 587 を塞いでいる。--port=465 を試す');
  try { conn?.sock.destroy(); } catch { /* 後始末なので握りつぶす */ }
  process.exit(1);
}
