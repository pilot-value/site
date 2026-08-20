/* 英語版のログイン戻り先。ルート側と同じ2つの穴が空いている。
     ① getRedirect が redirect= しか読まない（next= / return= で来た人は profile へ）
     ② auth-callback が .html で終わるだけで通す（外部サイトへ飛ばせる）
   ルート側（login.html / auth-callback.html）は手で直したので、ここは en/ の2枚。

   ★redirectTo のホストは触らない。
     Supabase の Redirect URLs に何が登録されているかを手元から確認できないので、
     /en/auth-callback.html に変えると英語のGoogleログインを壊しうる。
     戻り先は next= で運べば足りる（ルートの callback が同一オリジン判定して転送する）。
   実行: node patch-login-redirect.mjs                                       */
import { readFileSync, writeFileSync } from 'fs';

const OLD_GET = `    function getRedirect(){ return new URLSearchParams(location.search).get('redirect')||'profile.html'; }`;

const NEW_GET = `    /* ★戻り先のパラメータ名がサイト内で3種類に割れている。
         next= / redirect= / return=（airlines 配下はパスで来る）。
       redirect しか読んでいなかったので、他の2つで来た人は全員 profile へ落ちていた。
       ★外部サイトへ飛ばされないよう、拡張子ではなく同一オリジンで判定する
         （?next=https://evil.com/x.html は .html で終わってしまうため）。 */
    function safePath(to){
      if (!to) return '';
      if (/^[a-z][a-z0-9+.-]*:/i.test(to)) return '';      // http: javascript: data: …
      if (to.startsWith('//') || to.includes('\\\\')) return '';
      try {
        const u = new URL(to, location.href);
        return u.origin === location.origin ? u.pathname + u.search + u.hash : '';
      } catch (e) { return ''; }
    }
    function getRedirect(){
      const q = new URLSearchParams(location.search);
      return safePath(q.get('next') || q.get('redirect') || q.get('return')) || 'profile.html';
    }`;

const OLD_OAUTH = `      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://pilot-value.com/auth-callback.html' }
      });`;

const NEW_OAUTH = `      /* ★戻り先を callback にも引き継ぐ。ここで落としていたので、
         Google で入った人は必ず profile.html に着地していた。 */
      const to = getRedirect();
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://pilot-value.com/auth-callback.html'
                    + (to === 'profile.html' ? '' : '?next=' + encodeURIComponent(to)),
        }
      });`;

const OLD_CB = `    // next パラメータがあればそこへ、なければprofile
    const next = new URLSearchParams(location.search).get('next');
    window.location.replace(next && next.endsWith('.html') ? next : 'profile.html');`;

const NEW_CB = `    /* next パラメータがあればそこへ、なければprofile。
       ★.html で終わるだけを条件にすると ?next=https://evil.com/x.html が通り、
         ログイン直後に外部サイトへ飛ばせてしまう（オープンリダイレクト）。
         拡張子ではなく「同一オリジンに解決されるか」で判定する。 */
    const raw = new URLSearchParams(location.search).get('next') || '';
    let next = '';
    if (raw && !/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('//') && !raw.includes('\\\\')) {
      try {
        const u = new URL(raw, location.href);
        if (u.origin === location.origin) next = u.pathname + u.search + u.hash;
      } catch (e) { next = ''; }
    }
    window.location.replace(next || 'profile.html');`;

const JOBS = [
  { file: 'en/login.html',         subs: [[OLD_GET, NEW_GET], [OLD_OAUTH, NEW_OAUTH]] },
  { file: 'en/auth-callback.html', subs: [[OLD_CB, NEW_CB]] },
];

for (const { file, subs } of JOBS) {
  let s = readFileSync(file, 'utf8');
  const before = s.length;
  for (const [from, to] of subs) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${file}: 「${from.slice(0, 50).replace(/\n/g, '⏎')}…」が ${n} 箇所`);
    s = s.replace(from, to);
  }
  if (s.includes(`.get('redirect')||'profile.html'`)) throw new Error(`${file}: 古い getRedirect が残っている`);
  if (s.includes(`next.endsWith('.html')`)) throw new Error(`${file}: 古い endsWith 判定が残っている`);
  if ((s.match(/<\/html>/g) || []).length !== 1) throw new Error(`${file}: </html> が1つでない`);
  writeFileSync(file, s);
  console.log(`✅ ${file}  ${before} → ${s.length} bytes`);
}

// 直し漏れが無いことをサイト全体で確認する
import { execSync } from 'child_process';
const left = execSync(
  `grep -rln "get('redirect')||'profile.html'\\|next.endsWith('.html')" . --include='*.html' || true`,
  { encoding: 'utf8' },
).trim();
console.log(left ? `\n⚠ まだ残っている: ${left}` : '\n── 古い判定はサイト内に残っていない');
