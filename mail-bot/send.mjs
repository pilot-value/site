/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — mail-bot/send.mjs  v1.1
   会員向けメール配信（オプトインした会員のみ）。
     welcome  … 新規オプトイン会員へ歓迎＋使い方
     digest   … 新着口コミ／年収更新などの定期便
     announce … 一度だけのお知らせ（給与レポート公開）。文面は announce-mail.mjs

   法令順守:
     - 送信対象は profiles.email_opt_in = true のみ（特定電子メール法のオプトイン）。
     - 全メールに受信者固有の解除リンク（unsubscribe.html?token=unsub_token）を明記。
     - 送信元は認証済みドメイン（Resend で SPF/DKIM/DMARC 済）を使うこと。

   依存追加なし（Supabase REST ＋ Resend を fetch）。tweet-bot と同型。

   使い方:
     node mail-bot/send.mjs welcome            # 新規オプトイン会員へ歓迎メール
     node mail-bot/send.mjs digest             # オプトイン会員へ新着ダイジェスト
     node mail-bot/send.mjs welcome --dry-run  # 送らず対象と本文プレビュー
     node mail-bot/send.mjs digest  --backfill # 初回：直近分をまとめて（--since=ISO も可）

     node mail-bot/send.mjs announce                        # 送らない。誰に何が届くかだけ出す
     node mail-bot/send.mjs announce --to=info@…    --send  # ★自分の受信箱で現物を見る（会員には出ない）
     node mail-bot/send.mjs announce --send                 # 本番（1人1通・二度は送らない）

   ★ announce だけは既定が「送らない」。--dry-run を付け忘れて全員に飛ぶ事故を
     起こしようがない側に倒してある（取り消せない操作なので）。
════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dir, '.env');
if (!existsSync(envPath)) { console.error('❌ mail-bot/.env がありません。mail-bot/.env.example を参照。'); process.exit(1); }
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const s = line.trim(); if (!s || s.startsWith('#')) continue;
  const [k, ...v] = s.split('='); if (k && v.length) process.env[k.trim()] = v.join('=').trim();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'PILOT VALUE <noreply@pilot-value.com>';
const SITE_URL     = (process.env.SITE_URL || 'https://pilot-value.com').replace(/\/$/, '');

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || 'info@pilot-value.com';

const args     = process.argv.slice(2);
const MODE     = args.find(a => !a.startsWith('--'));
const BACKFILL = args.includes('--backfill');
const sinceArg = (args.find(a => a.startsWith('--since=')) || '').split('=')[1];
const onlyArg  = (args.find(a => a.startsWith('--only=')) || '').split('=')[1];
const langArg  = (args.find(a => a.startsWith('--lang=')) || '').split('=')[1];  // ja|en|both
const toArg    = (args.find(a => a.startsWith('--to=')) || '').split('=')[1];    // 自分宛の下見だけに使う
/* announce は「--send と書いたときだけ送る」。他のモードは従来どおり
   「--dry-run と書いたときだけ送らない」。既定を逆にしてあるのはわざと。 */
const DRY = MODE === 'announce' ? !args.includes('--send') : args.includes('--dry-run');

if (!['welcome', 'digest', 'announce'].includes(MODE)) { console.error('使い方: node mail-bot/send.mjs <welcome|digest|announce> [--dry-run] [--send] [--only=ADDR] [--to=ADDR] [--backfill] [--since=ISO]'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 未設定'); process.exit(1); }
if (!DRY && !RESEND_KEY) { console.error('❌ RESEND_API_KEY 未設定（実送信には必須）'); process.exit(1); }

const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
const POS = { captain:'機長', fo:'副操縦士', cadet:'訓練生' };

async function sbSelect(table, select, filters = []) {
  const params = new URLSearchParams();
  params.set('select', select);
  for (const f of filters) params.append(f[0], f[1]);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
  });
  if (!res.ok) throw new Error(`${table} REST ${res.status}: ${await res.text()}`);
  return res.json();
}

/* opt = { text, headers, idempotencyKey, replyTo } — どれも任意。
   idempotencyKey は「同じ鍵の2回目は送らない」を Resend 側に約束させるもの。
   途中で落ちて流し直したとき、既に届いた人へ二通目が飛ばない。 */
async function sendEmail(to, subject, html, opt = {}) {
  if (DRY) return { dry: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + RESEND_KEY,
      'Content-Type': 'application/json',
      ...(opt.idempotencyKey ? { 'Idempotency-Key': opt.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL, to: [to], subject, html,
      ...(opt.text ? { text: opt.text } : {}),
      ...(opt.replyTo ? { reply_to: opt.replyTo } : {}),
      ...(opt.headers ? { headers: opt.headers } : {}),
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ── 共通レイアウト（メールクライアント向けに明色・インライン） ── */
function layout(inner, unsubToken) {
  const unsub = `${SITE_URL}/unsubscribe.html?token=${encodeURIComponent(unsubToken || '')}`;
  return `<div style="background:#f3f5f8;padding:24px 0;font-family:-apple-system,'Segoe UI','Noto Sans JP',sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ef">
      <div style="background:#0a0c0f;padding:18px 24px"><span style="color:#f5c842;font-weight:800;letter-spacing:.04em">PILOT VALUE</span></div>
      <div style="padding:26px 24px;color:#1f2937;font-size:14px;line-height:1.8">${inner}</div>
      <div style="padding:16px 24px;border-top:1px solid #eef0f4;color:#9aa5b1;font-size:11px;line-height:1.7">
        このメールは、登録時または設定画面で通知を希望した方にお送りしています。<br>
        配信停止は <a href="${unsub}" style="color:#6b7280">こちら（ワンクリック）</a>／
        設定は <a href="${SITE_URL}/profile.html" style="color:#6b7280">マイページ</a> から。<br>
        PILOT VALUE ・ <a href="${SITE_URL}" style="color:#6b7280">${SITE_URL.replace(/^https?:\/\//,'')}</a>
      </div>
    </div>
  </div>`;
}

/* ── state ── */
const stateFile = join(__dir, '.send-state.json');
/* announceSent は { profiles.id: 送った時刻 }。announce を二度流しても
   同じ人に二通目が行かないための控え。消すと二重送信になる。 */
let state = { lastWelcomeAt: null, lastDigestAt: null, announceSent: {} };
if (existsSync(stateFile)) { try { state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf8')) }; } catch {} }
const saveState = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const nowIso = new Date().toISOString();

/* ════════════════════ welcome ════════════════════ */
async function runWelcome() {
  const since = BACKFILL ? null : (sinceArg || state.lastWelcomeAt || nowIso);
  const firstRun = !state.lastWelcomeAt && !BACKFILL && !sinceArg;
  const filters = [['email_opt_in', 'eq.true'], ['order', 'created_at.asc']];
  if (since) filters.push(['created_at', 'gt.' + since]);
  const members = await sbSelect('profiles', 'name,email,unsub_token,created_at,email_opt_in', filters);

  console.log(`[welcome] 対象 ${members.length} 名${firstRun ? '（初回=監視開始。既存会員へは送りません。全員へ送るには --backfill）' : ''}`);
  if (members.length === 0) {
    if (firstRun) { state.lastWelcomeAt = nowIso; saveState(); console.log('✓ 監視開始（基準時刻を保存）'); }
    return;
  }

  let sent = 0, last = null;
  for (const m of members) {
    if (!m.email) continue;
    const name = esc(m.name || 'パイロット');
    const inner = `
      <p style="margin:0 0 14px">${name} さん、PILOT VALUE へのご登録ありがとうございます ✈️</p>
      <p style="margin:0 0 14px">当サイトは、日本のパイロットが<strong>世界のエアラインの年収・待遇・現場のリアル</strong>を、
      忖度なく比較して次のキャリアを判断するためのプラットフォームです。</p>
      <p style="margin:0 0 8px;font-weight:700">はじめの一歩</p>
      <ol style="margin:0 0 16px;padding-left:1.2em">
        <li>あなたの年収・待遇を<strong>1社ぶん匿名で投稿</strong>（所要3分・個人は特定されません）</li>
        <li>その瞬間、<strong>全社の口コミが解放</strong>されます（年収データは給与明細を1枚出すと90日間）</li>
      </ol>
      <p style="margin:0 0 20px"><a href="${SITE_URL}/submit-review.html" style="display:inline-block;background:#f5c842;color:#000;font-weight:800;text-decoration:none;padding:11px 22px;border-radius:9px">口コミを投稿してデータを解放する →</a></p>
      <p style="margin:0;color:#6b7280;font-size:13px">今後、年収データの更新や新着口コミ、新規エアライン情報を厳選してお届けします。不要になればいつでも下部から解除できます。</p>`;
    try {
      await sendEmail(m.email, `PILOT VALUE へようこそ、${m.name || ''}さん ✈️`, layout(inner, m.unsub_token));
      sent++; last = m.created_at;
      console.log(`${DRY ? '  [dry]' : '  ✓'} welcome → ${m.email}`);
    } catch (e) { console.error(`  ❌ ${m.email}: ${e.message}`); }
  }
  if (!DRY && last) { state.lastWelcomeAt = last; saveState(); }
  console.log(`[welcome] ${DRY ? 'プレビュー' : '送信'} ${sent}/${members.length}`);
}

/* ════════════════════ digest ════════════════════ */
async function runDigest() {
  const since = BACKFILL ? new Date(Date.now() - 7 * 864e5).toISOString()
              : (sinceArg || state.lastDigestAt || new Date(Date.now() - 7 * 864e5).toISOString());

  const reviews = await sbSelect('reviews_v2',
    'airline,position,age_bucket,monthly_salary,annual_salary,culture_comment,salary_comment,wlb_comment,created_at',
    [['created_at', 'gt.' + since], ['order', 'created_at.asc']]);

  console.log(`[digest] 基準 ${since} 以降の新着口コミ ${reviews.length} 件`);
  if (reviews.length === 0) { console.log('新着なし。配信をスキップ。'); return; }

  // 航空会社別の件数と、代表的な抜粋を数件
  const byAirline = {};
  for (const r of reviews) byAirline[r.airline] = (byAirline[r.airline] || 0) + 1;
  const topAirlines = Object.entries(byAirline).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const excerpts = reviews
    .map(r => ({ a: r.airline, t: [r.culture_comment, r.salary_comment, r.wlb_comment].filter(Boolean).join(' ') }))
    .filter(x => x.t.length >= 30).slice(0, 4);

  const listHtml = topAirlines.map(([a, n]) =>
    `<li><strong>${esc(a)}</strong> … 新着 ${n} 件</li>`).join('');
  const exHtml = excerpts.map(x =>
    `<div style="border-left:3px solid #f5c842;padding:6px 0 6px 12px;margin:10px 0;color:#374151;font-size:13px">
       <span style="color:#9aa5b1;font-size:11px">${esc(x.a)}</span><br>${esc(x.t.slice(0, 140))}${x.t.length > 140 ? '…' : ''}</div>`).join('');

  const recipients = await sbSelect('profiles', 'name,email,unsub_token,email_opt_in', [['email_opt_in', 'eq.true']]);
  console.log(`[digest] 配信対象（オプトイン）${recipients.length} 名`);

  let sent = 0;
  for (const m of recipients) {
    if (!m.email) continue;
    const name = esc(m.name || 'パイロット');
    const inner = `
      <p style="margin:0 0 14px">${name} さん、この期間の新着です。</p>
      <p style="margin:0 0 8px;font-weight:700">🆕 新着口コミ ${reviews.length} 件（航空会社別）</p>
      <ul style="margin:0 0 14px;padding-left:1.2em;color:#374151">${listHtml}</ul>
      ${exHtml ? `<p style="margin:0 0 4px;font-weight:700">現場の声（抜粋）</p>${exHtml}` : ''}
      <p style="margin:16px 0 0"><a href="${SITE_URL}/community.html" style="display:inline-block;background:#f5c842;color:#000;font-weight:800;text-decoration:none;padding:11px 22px;border-radius:9px">最新の口コミを見る →</a></p>
      <p style="margin:14px 0 0;color:#6b7280;font-size:13px">※ 詳細な年収データは、給与明細を1枚出すと90日間解放されます。</p>`;
    try {
      await sendEmail(m.email, `【PILOT VALUE】新着口コミ ${reviews.length} 件のダイジェスト`, layout(inner, m.unsub_token));
      sent++;
      console.log(`${DRY ? '  [dry]' : '  ✓'} digest → ${m.email}`);
    } catch (e) { console.error(`  ❌ ${m.email}: ${e.message}`); }
  }
  if (!DRY) { state.lastDigestAt = nowIso; saveState(); }
  console.log(`[digest] ${DRY ? 'プレビュー' : '送信'} ${sent}/${recipients.length}`);
}

/* ════════════════════ announce ════════════════════
   一度だけのお知らせ。文面は mail-bot/announce-mail.mjs（日英・金額なし）。

   ここが守っていること:
     ① 送るのは email_opt_in = true の人だけ。それ以外は数に入れない
     ② 1人1通。送った相手は .send-state.json に控え、二度目は飛ばす
     ③ 受信箱側のワンクリック解除（List-Unsubscribe）を付ける。
        押した先は本番で動いている remind-payslip の ?u= で、email_opt_in が落ちる
     ④ 送信の間隔を空ける（まとめて叩くと迷惑メール判定に寄る）           */
async function runAnnounce() {
  const { build } = await import('./announce-mail.mjs');

  /* ★自分の受信箱で現物を見るための逃げ道。会員には1通も出さない。
     絵（shot-remind.mjs --announce）では Gmail の折り返し・画像の出方・
     迷惑メール判定までは分からない。送る前に必ず1通これで見る。
       node mail-bot/send.mjs announce --to=info@pilot-value.com --send
       node mail-bot/send.mjs announce --to=info@pilot-value.com --send --filed --lang=en */
  if (toArg) {
    const me = {
      id: 'self-preview', email: toArg, name: null, country: null,
      unsub_token: 'preview-token', pay_report_count: args.includes('--filed') ? 3 : 0,
    };
    const b = build(me, { siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL, adminEmail: ADMIN_EMAIL, lang: langArg });
    console.log(`[announce] 自分宛のプレビュー（会員には送りません）… ${b.lang} / ${b.filed ? '提出済み' : '未提出'}`);
    console.log(`           ${b.subject}`);
    if (DRY) return console.log('           ※ 送りません。実際に送るには --send を付けてください。');
    await sendEmail(toArg, '[preview] ' + b.subject, b.html, { text: b.text, replyTo: ADMIN_EMAIL });
    return console.log('  ✓ 送りました');
  }

  const people = await sbSelect('profiles',
    'id,name,email,country,unsub_token,pay_report_count,email_opt_in',
    [['email_opt_in', 'eq.true'], ['order', 'created_at.asc']]);

  const sentBefore = state.announceSent || {};
  let targets = people.filter(m => m.email && String(m.email).includes('@'));
  const already = targets.filter(m => sentBefore[m.id]).length;
  targets = targets.filter(m => !sentBefore[m.id]);
  if (onlyArg) targets = targets.filter(m => String(m.email).toLowerCase() === onlyArg.toLowerCase());

  console.log(`[announce] オプトイン ${people.length} 名／送信済み ${already} 名／今回の対象 ${targets.length} 名`
    + (onlyArg ? `（--only=${onlyArg}）` : ''));
  if (DRY) console.log('           ※ 送りません。実際に送るには --send を付けてください。');
  if (targets.length === 0) return;

  let sent = 0;
  for (const m of targets) {
    const b = build(m, { siteUrl: SITE_URL, supabaseUrl: SUPABASE_URL, adminEmail: ADMIN_EMAIL, lang: langArg });
    const headers = {
      'List-Unsubscribe': (b.oneClickUrl ? `<${b.oneClickUrl}>, ` : '') + `<${b.unsubUrl}>, <mailto:${ADMIN_EMAIL}?subject=unsubscribe>`,
      ...(b.oneClickUrl ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}),
    };
    try {
      await sendEmail(m.email, b.subject, b.html, {
        text: b.text, headers, replyTo: ADMIN_EMAIL,
        idempotencyKey: `pv-announce-payreport-${m.id}`,
      });
      sent++;
      if (!DRY) { (state.announceSent ||= {})[m.id] = nowIso; saveState(); }
      /* 宛先は出さない。ここの出力を貼って渡すと会員のメールが漏れる。 */
      const L = { ja: '日本語', en: '英語', both: '日英ともに' }[b.lang] || b.lang;
      console.log(`${DRY ? '  [dry]' : '  ✓'} ${L.padEnd(5, '　')} ${b.filed ? '提出済みの人へ' : '未提出の人へ'} … ${b.subject}`);
      if (!DRY) await new Promise(r => setTimeout(r, 320));
    } catch (e) { console.error(`  ❌ 1名ぶん失敗: ${e.message}`); }
  }
  console.log(`[announce] ${DRY ? 'プレビュー' : '送信'} ${sent}/${targets.length}`);
  if (DRY) console.log('           本文を絵で見る: node shot-remind.mjs --announce');
}

(async () => {
  try {
    if (MODE === 'welcome') await runWelcome();
    else if (MODE === 'announce') await runAnnounce();
    else await runDigest();
  } catch (e) { console.error('❌', e.message); process.exit(1); }
})();
