/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — ga-core.mjs（2026-10-29）
   GA4 を「読むだけ」で叩くための共通部分。鍵でトークンを取り、見えるプロパティに runReport を投げる。

   使っているもの
     ga-usage.mjs        訪問とつまずき（手で流す・何も書かない）
     gen-vote-popular.mjs Vote の「よく見られている会社」の並びを書き出す

   約束
     ・**読むだけ。** 鍵は GA4 の「閲覧者」権限しか持たない（課金も設定変更もできない）。
     ・**パッケージを足さない。** Node の crypto で JWT を署名する。
     ・**絶対パスを書かない**（公開リポジトリ：ログイン名がそのまま漏れる）。
     ・⚠️ ネットを叩くので check.mjs に入れない。
   ════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs';
import { createSign } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const KEY_PATH = path.join(ROOT, 'mail-bot/.env.ga.json');

/* ★ボットを外す。国まるごとなので、シンガポールの本物も一緒に落ちる（ga-usage.mjs の冒頭の注意）。 */
export const NOT_BOT = { notExpression: { filter: { fieldName: 'country', stringFilter: { matchType: 'EXACT', value: 'Singapore' } } } };
export const iso = (d) => new Date(d).toISOString().slice(0, 10);

/* 鍵 → トークン → プロパティ。失敗したらその場で止める（黙って空の答えを返さない）。 */
export async function gaConnect() {
  if (!existsSync(KEY_PATH)) {
    console.error('❌ GA4 の鍵がありません: mail-bot/.env.ga.json');
    console.error('   （このファイルは gitignore 済みなので clone には付いてきません。');
    console.error('     iCloud の Claude-Backup から戻すか、Google Cloud Console で作り直してください）');
    process.exit(1);
  }
  const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600, iat,
  });
  const jwt = unsigned + '.' + createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const tok = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })).json();
  if (!tok.access_token) {
    console.error('❌ 鍵が通りませんでした:', JSON.stringify(tok).slice(0, 200));
    console.error('   GA4 側で「閲覧者」に追加されているか、鍵が失効していないか確認してください。');
    process.exit(1);
  }
  const AH = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

  /* プロパティは鍵から見えるものを使う（IDを書き写さない） */
  const sum = await (await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', { headers: AH })).json();
  const P = (sum.accountSummaries ?? []).flatMap((a) => a.propertySummaries ?? [])[0]?.property;
  if (!P) { console.error('❌ 見えるプロパティがありません（GA4 の閲覧者に入っていない可能性）'); process.exit(1); }

  const run = async (body) => {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/${P}:runReport`,
      { method: 'POST', headers: AH, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { console.error('❌ GA4:', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
    return j.rows ?? [];
  };
  return { run };
}
