/* submit-review.html / en/submit-review.html
   「持ち主が分からないまま口コミを投稿できてしまう」道を塞ぐ。

   読み込み時の getSession() が通信エラーで例外を投げると、try/catch が無いので
   どちらの分岐も走らず、#form-wrap が既定で見えているためフォームが開いたまま
   currentUserId が null で残る。submitReview() はセッションを取り直さないので
   そのまま sha256('null::pv_anon::<社名>::2026') で投稿が通り、
   全員が同じ持ち主不明のハッシュになる（2人目以降は「すでに投稿済み」と誤って弾かれる）。

   ついでに同じ導線の穴を2つ塞ぐ：
     ・ログイン壁のリンクが ?airline= を捨てる
     ・?airline= が未知のコードのとき「その他」にするのに自由入力欄を出さない

   冪等：何度実行しても同じ結果になる。
   実行: node patch-review-authguard.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';

const T = {
  ja: { file: 'submit-review.html', btn: '投稿して解放する 🔓' },
  en: { file: 'en/submit-review.html', btn: 'Post and unlock 🔓' },
};

for (const [lang, t] of Object.entries(T)) {
  const url = new URL(t.file, import.meta.url);
  let s = readFileSync(url, 'utf8');
  const before = s;
  const done = [];

  /* 1. フォームは既定で隠す（ログイン確認が通ったときだけ出す） */
  if (s.includes('<div id="form-wrap">')) {
    s = s.replace('<div id="form-wrap">', '<div id="form-wrap" style="display:none">');
    done.push('form-wrap を既定 display:none');
  }

  /* 2. ログイン確認を try/catch で包み、失敗したらログイン壁を出す */
  const authRe = /\(async function\(\) \{\n  const \{ data: \{ session \} \} = await _sb\.auth\.getSession\(\);\n[\s\S]*?\n\}\)\(\);/;
  const AUTH = `(async function() {
  // ★フォームは既定で display:none。ここが通ったときだけ出す。
  //   逆にすると、getSession() が例外を投げたときにどちらの分岐も走らず、
  //   フォームが開いたまま currentUserId が null で残る。その状態の投稿は
  //   全員が同じ sha256('null::pv_anon::…') になり、持ち主不明の行が1つでき、
  //   2人目以降は「すでに投稿済み」と誤って弾かれる。
  const showGate = () => {
    // 会社の指定（?airline=）をログインの往復で落とさない。
    const link = document.querySelector('#login-gate a[href^="login.html"]');
    if (link) link.href = 'login.html?next=' + encodeURIComponent('submit-review.html' + location.search);
    document.getElementById('login-gate').style.display = '';
    document.getElementById('form-wrap').style.display = 'none';
    // ${lang === 'ja'
      ? '口コミを書く気で来て、ログイン壁に当たった人の数。sign_up と突き合わせると'
      : 'How many people arrived intending to write a review and hit the login wall.'}
    // ${lang === 'ja'
      ? '「壁 → 登録 → 投稿」のどこで落ちているかが初めて分かる。'
      : 'Cross-referenced with sign_up, this finally shows where wall → signup → post leaks.'}
    try { if (typeof gtag === 'function') gtag('event', 'review_login_wall'); } catch (e) {}
  };
  let session = null;
  try { ({ data: { session } } = await _sb.auth.getSession()); } catch (e) { session = null; }
  if (!session) { showGate(); return; }
  currentUserId = session.user.id;
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('form-wrap').style.display = '';
})();`;
  if (authRe.test(s)) { s = s.replace(authRe, () => AUTH); done.push('ログイン確認に try/catch'); }
  else if (!s.includes('const showGate = () =>')) throw new Error(`ログイン確認が見つからない: ${t.file}`);

  /* 3. ?airline= が未知のときは自由入力欄も出す */
  const preRe = /(  const ok = Array\.prototype\.some\.call\(sel\.options, o => o\.value === a\);\n  sel\.value = ok \? a : 'other';\n)/;
  const PRE = `  // 「その他」にしたら自由入力欄も出す。出さないと、次へ進めないのに
  // 「社名を入力してください」と見えない欄を指すエラーが出る行き止まりになる。
  // toggleOtherAirline() は focus() するので、読み込み時はここで表示だけ変える。
  const other = document.getElementById('f-airline-other');
  if (other) other.style.display = (sel.value === 'other') ? '' : 'none';
`;
  if (preRe.test(s) && !s.includes("if (other) other.style.display")) {
    s = s.replace(preRe, (m) => m + PRE);
    done.push('?airline= で自由入力欄を出す');
  }

  /* 4. ハッシュの材料に null を入れない */
  const hashRe = /(async function makeProofHash\(userId, airline\) \{\n)(  const data =)/;
  if (hashRe.test(s) && !s.includes("makeProofHash: 持ち主")) {
    s = s.replace(hashRe, (_, head, tail) =>
      head +
      `  // 持ち主が分からないまま投稿させない。null が来ると全員が同じハッシュになる。\n` +
      `  if (!userId) throw new Error('not signed in');  // makeProofHash: 持ち主が要る\n` +
      tail);
    done.push('makeProofHash に null ガード');
  }

  /* 5. 送信の直前にセッションを取り直す */
  const subRe = /(  try \{\n)(    const proofHash = await makeProofHash\(currentUserId, effectiveAirline\(v\)\);)/;
  const SUB = `    // ★ここで取り直す。ログイン確認は読み込み時の1回だけなので、そのあと
    //   期限が切れても currentUserId は古いまま／null のまま送信されてしまう。
    let uid = currentUserId;
    if (!uid) {
      try {
        const { data: { session } } = await _sb.auth.getSession();
        uid = session && session.user.id;
      } catch (e) {}
    }
    if (!uid) {
      document.getElementById('login-gate').style.display = '';
      document.getElementById('form-wrap').style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    currentUserId = uid;

    const proofHash = await makeProofHash(uid, effectiveAirline(v));`;
  if (subRe.test(s)) { s = s.replace(subRe, (_, head) => head + SUB); done.push('送信前にセッション再取得'); }
  else if (!s.includes('let uid = currentUserId;')) throw new Error(`submitReview の入口が見つからない: ${t.file}`);

  if (s === before) { console.log(`・${t.file} 変更なし（すでに当たっている）`); continue; }
  writeFileSync(url, s);
  console.log(`✅ ${t.file} — ${done.join(' / ')}`);
}
