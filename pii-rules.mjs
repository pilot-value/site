/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pii-rules.mjs
   「書いてはいけない／出してはいけない」語の判定を1箇所に集める。

   なぜ切り出したか。
     assert-no-pii.mjs（リポジトリの中身）と
     mail-bot/check-reply-headers.mjs（外へ出ていくメール）は、
     見る対象が違うだけで「何を漏れとみなすか」は同じでなければならない。
     片方にだけ語を足して、もう片方が素通しするのが一番危ない。

   ★ このファイルに実名を書かない。固有名詞は .pii-denylist（gitignore 済み）にだけ置く。
════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/* 個人メールのドメイン。info@pilot-value.com のようなロールアドレスは通す。 */
export const PERSONAL_MAIL =
  /[A-Za-z0-9._%+-]+@(gmail\.com|googlemail\.com|icloud\.com|me\.com|yahoo\.co\.jp|yahoo\.com|outlook\.com|outlook\.jp|hotmail\.com|live\.jp|docomo\.ne\.jp|ezweb\.ne\.jp|softbank\.ne\.jp)/i;

/* ★ 先頭の (^|[^\w/.-]) は URL の途中を拾わないための境界。
   これが無いと https://www.aircanada.com/ca/en/aco/home/about/careers.html の
   /home/about に当たって、外部リンクを直すたびに偽陽性で落ちる（実際に踏んだ）。 */
export const BASE_RULES = [
  {
    id: 'local-abs-path',
    why: 'macOS のホームディレクトリ＝ログイン名。実名由来だと身元がそのまま出る',
    re: /(^|[^\w/.-])\/Users\/[A-Za-z0-9._-]+/,
    fix: "fileURLToPath(new URL('.', import.meta.url)) で自分の位置から解く",
  },
  {
    id: 'personal-email',
    why: '個人メールは氏名・他サービスのアカウントに直結する',
    re: PERSONAL_MAIL,
    fix: 'info@pilot-value.com か noreply@pilot-value.com を使う',
  },
  {
    id: 'home-path-other-os',
    why: 'Windows/WSL/Linux で作業したときの同種の漏れ',
    re: /(^|[^\w/.-])([A-Za-z]:\\Users\\[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+\/)/,
    fix: '同上。絶対パスを書かない',
  },
];

export const DENY_FILE = path.join(ROOT, '.pii-denylist');

/* .employer-denylist — 勤務先が割れる語。氏名とは別の危険なので別ファイルにする。

   ★ここに勤務先の「社名」を入れてはいけない。 サイトは110社の航空会社を扱っていて、
     どの社名も本文・データ・ロゴ名に山ほど出る。社名を入れた瞬間に全部が偽陽性になる。
     入れるのは**中の人しか書けない語**（社内の部門コード・手当の呼び名・社内指標の書式）。
     外から見て「この人はここの社員だ」と分かるのはそちらの語で、社名の方ではない。 */
export const EMPLOYER_FILE = path.join(ROOT, '.employer-denylist');

/* 「ここに書けない語」をローカルだけで持つ仕組み。
   1行1パターン（正規表現）。# で始まる行と空行は無視。
   ★ new RegExp(行) は大文字小文字を区別する。[Ss] のように呼び出し側で書く決まり。 */
export function loadDenylist(file = DENY_FILE, id = 'denylist', why = '.pii-denylist に登録された語') {
  const rules = [];
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      rules.push({ id, why, re: new RegExp(s), fix: '別の語に置き換える' });
    }
  }
  return { rules, count: rules.length, exists: fs.existsSync(file) };
}

/* 勤務先語彙の読み込み。呼び出し側を短く保つための薄い包み。 */
export function loadEmployerDenylist() {
  return loadDenylist(EMPLOYER_FILE, 'employer',
    '.employer-denylist に登録された語（中の人しか書けない社内語彙）');
}

/* denylist が無いときの直し方。assert 側とメール側で同じ文言を出す。 */
export function denylistHint(file = DENY_FILE) {
  const name = path.basename(file);
  return fs.existsSync(file)
    ? `中身が空。${name === '.pii-denylist' ? '氏名パターン' : '社内語彙'}を書く`
    : `iCloud Drive の Claude-Backup から ${name} を復元する（gitignore 済みなので clone には付いてこない）`;
}
