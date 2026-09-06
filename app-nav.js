/* ══════════════════════════════════════════════════════════════════════════
   app-nav.js ── サイト全体のナビの「開け閉め」だけを持つ
   ══════════════════════════════════════════════════════════════════════════
   読ませる先は 406枚（オーナー確定事項10・2026-09-06）──
     公開392枚（トップ・VOTE・AIRLINES・航空会社110社・国別・記事…）
     ＋ アプリ14枚（.mr-shell を持つ画面）
   入れないのは6枚だけ ── login / signup（日英4枚）・auth-callback・
   給与フォーム（pay-report 日英。書きかけの値が消えるため）。

   ★★search.js を1バイトも触らない。ただし**アプリ側とやり方が違う**。
     以前は「先に #pv-ham-btn を立てて search.js:416 のガードで inject() ごと止める」
     という手を使っていた。公開ページでこれをやると**ヘッダーの自動折り畳みまで死ぬ**
     ── fit() / fits() / needed() / pv-nav-compact… が同じ inject() の中に在るため。
     assert-header.mjs の約980項目がそこを見ている。

     だから今は逆向きにする ── **search.js を普通に走らせ、走り終わってから
     ≡ の中身だけ差し替える。**
       btn.replaceWith(btn.cloneNode(true))  ← id と class は残したまま listener だけ落とす
       #pv-nav-drawer / #pv-nav-overlay を remove()
       新しい listener で左の .mr-side を開くよう繋ぎ直す
     id も class も残るので、fit() の測定も CSS の規則も今までどおり効く。

   ★≡ の生まれ方は2通り。**読み込みの順番に頼らない**（並べ替え事故で静かに壊れる）。
       search.js を読むページ   → あちらが作ったものを繋ぎ直す
       読まないページ           → 自分で作る
     見分けは `<script src="…search.js">` が在るかどうか。アプリ14枚も
     airlines/ の日本語115枚も、これ1つで正しい道へ入る。

   ★中身（項目・アイコン・文言・aria-current）は patch-side-nav.mjs が
     HTML に静的に書いている。ここでは**作らない**。
     実行時に組み立てると、JS が落ちた人の画面からナビが丸ごと消えるうえ、
     航空会社110枚は内部リンクを3本失ったまま代わりが HTML に無い＝SEO が痩せる。

   ★ここが足すのは3つだけ ── ≡ ボタン（無いとき）／覆い／板の頭（× と見出し）。

   ⚠️ history を積まない（pushState も replaceState もしない）。
      Phase 4 で REAL PAY の詳細を「ブラウザの戻る」で閉じられるようにする。
      ナビの開け閉めまで積むと、戻るを押した人が詳細ではなくナビを閉じてしまう。

   見た目は app-nav.css。ここには色も大きさも書かない。
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var d = document;

  /* ── 日英。★同じ鍵で1ファイルに持つ（2か所に分けると片方だけ古くなる）── */
  var L10N = {
    ja: { menu: 'メニュー', close: '閉じる', title: 'メニュー' },
    en: { menu: 'Menu',     close: 'Close',  title: 'Menu' },
  };
  var IS_EN = /(^|\/)en\//.test(location.pathname) ||
              (d.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('en') === 0;
  var T = L10N[IS_EN ? 'en' : 'ja'];

  /* 板が左から出るのは狭い画面だけ。境目は app-nav.css の @media と同じ 1000px。
     ⚠️ 2か所に数を書いているので、片方を変えたらもう片方も変える。 */
  var NARROW = '(max-width:1000px)';

  /* このページは search.js を読むか。★読み込みの順番ではなく**在るか**で見る。 */
  function hasSearchJs() {
    var ss = d.querySelectorAll('script[src]');
    for (var i = 0; i < ss.length; i++) {
      if (/(^|\/)search\.js(\?|$)/.test(ss[i].getAttribute('src') || '')) return true;
    }
    return false;
  }

  /* ≡ の置き場。search.js が選ぶ場所と同じにする（2つ並ばないように）。 */
  function rightBox() {
    var top = d.querySelector('header.mr-top');
    if (top) return top.querySelector('.mr-top-r');
    var nav = d.getElementById('main-nav');
    if (!nav) return null;
    var r = nav.querySelectorAll('.flex.items-center');
    return r[r.length - 1] || null;
  }

  function makeBtn(side) {
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.id = 'pv-ham-btn';
    btn.className = 'pv-ham-btn';
    btn.innerHTML = '<span class="pv-ham-line"></span>' +
                    '<span class="pv-ham-line"></span>' +
                    '<span class="pv-ham-line"></span>';
    var box = rightBox();
    if (!box) return null;
    box.appendChild(btn);
    return btn;
  }

  /* ヘッダーの CTA を、引き出しを畳む前に板へ移す ───────────────────
     ★なぜ要るか ── search.js は**いちばん狭い段**（pv-nav-min）で
       ヘッダーの CTA を display:none にする（search.js:467）。その代わりに
       右の引き出しの先頭へ写しを1つ置いていた（search.js:546-556）。
       その引き出しをこちらが畳むので、**写しもこちらで引き受ける。**
       放っておくと community.html / pilot-tenshoku.html / privacy-pilot.html の
       日英6枚で「匿名で口コミを投稿」が 390px から**消える**
       ── ヘッダーにも板にも1本も無い状態になる（画面は普通に動いたまま）。
     ★★既定は hidden。板は「406枚どこでも同じ7項目」でなければならないので、
       広い画面のレールに8つ目の行が生えてはいけない。出すのは**ドロワーを
       開いた瞬間に、ヘッダーの CTA が実際に消えているときだけ**（setOpen 参照）。
     ★行き先が板に既に在るなら足さない。トップの日英2枚がそれで、
       CTA も板の1行目も pay-report.html ＝ 同じ行が2つ並ぶだけになる。
     ★class は付け替える。.pv-nd-cta のままだと search.js のオレンジの
       グラデーション（search.js:454）が板の中で1枚だけ浮く。あちらの規則は
       実行時に後から差さるので、同じ強さで書いても勝てない。
       検査が見つけられるよう data-pv-nd-cta のほうを残す。
     ★絵は「書いて出す」の記号。ここへ来る CTA は今のところ
       「口コミを投稿」と「給与を追加」の2種類しかない。 */
  function moveCta(side) {
    if (!side) return null;
    var src = d.querySelector('#pv-nav-drawer .pv-nd-cta');
    if (!src) return null;
    var href = src.getAttribute('href') || '';
    var rows = side.querySelectorAll('.mr-side-a');
    if (!href || !rows.length) return null;

    var a = d.createElement('a');
    a.href = href;
    /* ★#ハッシュを落として比べる ── 板の1行目は pay-report.html**#ps** で、
         トップの CTA は pay-report.html。字面のままだと別物に見えて、
         同じページへの行が2つ並ぶ。 */
    var bare = function (u) { return String(u || '').split('#')[0]; };
    for (var i = 0; i < rows.length; i++) {
      if (bare(rows[i].href) === bare(a.href)) return null;   /* 板に同じ行き先が在る */
    }
    a.className = 'mr-side-a';
    a.hidden = true;
    a.setAttribute('data-pv-nd-cta', '');
    a.setAttribute('data-pv-ev', 'nav_drawer_cta');
    a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
      '<path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg><span></span>';
    a.querySelector('span').textContent = (src.textContent || '').trim();
    rows[0].parentNode.insertBefore(a, rows[0].nextSibling);
    return a;
  }

  /* search.js が作った ≡ を、こちらの持ち物にする。
     ★clone-replace ── id も class も中身もそのままに、あちらの listener だけ落とす。
       消して作り直すと、fit() が掴んでいる参照と MutationObserver の見張りが
       ずれる（狭い幅でヘッダーが畳まれなくなる）。 */
  function adopt(btn, side) {
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    savedCta = moveCta(side);               /* ★畳む前に CTA を助け出す */
    /* 右から出る古い引き出しは畳む。★中身は板に移してある（お問い合わせも）。 */
    ['pv-nav-drawer', 'pv-nav-overlay'].forEach(function (id) {
      var el = d.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    /* search.js の closeD() が触りっぱなしにする可能性がある1行を戻す。 */
    d.body.style.overflow = '';
    return fresh;
  }

  var started = false;
  var savedCta = null;      /* 板へ移したヘッダーの CTA（無ければ null）*/

  function boot() {
    if (started) return true;

    /* ★板が無いページでは何もしない（認証4枚・給与フォーム2枚）。 */
    var side = d.querySelector('nav.mr-side');
    if (!side) return true;                 /* 用が無い＝もう待たない */

    /* ── ログインの行は、ログイン済みなら消す ────────────────────
       ★HTML には**出したまま**書き出してある（patch-side-nav.mjs の buildNav）。
         hidden で書き出すと、JS が動かない人には永久に出ない。
       ★公開ページで消せない理由 ── ヘッダーの #nav-auth-btn は多くのページで
         `hidden md:inline-flex`（＝iPhone では出ていない）。狭い画面では
         この1行がサイト唯一のログイン導線になる。
       ★判定は pv-session.js:108 と同じ「pv_user が在るか」だけ。中身は見ない
         （名前を持たない会員でも、ログイン済みならこの行は要らない）。
       ⚠️ localStorage が使えない設定のときは**出したまま**にする。
          消して入れなくなるより、余分に1行出るほうが安全。 */
    try {
      var lg = d.getElementById('pv-anav-login');
      if (lg && localStorage.getItem('pv_user') && lg.parentNode) {
        lg.parentNode.removeChild(lg);
      }
    } catch (e) { /* 見えないままにしない */ }

    var btn = d.getElementById('pv-ham-btn');
    if (btn) btn = adopt(btn, side);
    else if (hasSearchJs()) return false;   /* あちらがまだ ≡ を作っていない。待つ */
    else btn = makeBtn(side);
    if (!btn) return true;                  /* 置き場が無い＝これ以上できることは無い */

    started = true;

    btn.setAttribute('aria-label', T.menu);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', side.id || (side.id = 'pv-anav-side'));

    /* ── ① 覆い ─────────────────────────────────────────────── */
    var ov = d.getElementById('pv-anav-ov');
    if (!ov) {
      ov = d.createElement('div');
      ov.id = 'pv-anav-ov';
      d.body.appendChild(ov);
    }

    /* ── ② 板の頭（× と見出し）──────────────────────────────
       ★nav の**中の先頭**へ入れる。patch-side-nav.mjs が配った行には触らない。 */
    var head = d.createElement('div');
    head.className = 'mr-side-head';
    var ttl = d.createElement('span');
    ttl.className = 'mr-side-ttl';
    ttl.textContent = T.title;
    var x = d.createElement('button');
    x.type = 'button';
    x.className = 'mr-side-x';
    x.setAttribute('aria-label', T.close);
    x.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"' +
      ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
      ' stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    head.appendChild(ttl);
    head.appendChild(x);
    side.insertBefore(head, side.firstChild);

    /* ── 開け閉め ────────────────────────────────────────────── */
    var open = false;

    function narrow() {
      return !window.matchMedia || window.matchMedia(NARROW).matches;
    }

    function focusables() {
      var all = side.querySelectorAll('a[href],button:not([disabled])');
      var out = [];
      for (var i = 0; i < all.length; i++) {
        var r = all[i].getBoundingClientRect();
        if (r.width > 0 || r.height > 0) out.push(all[i]);
      }
      return out;
    }

    function setOpen(v) {
      if (v === open) return;
      open = v;
      /* ★助け出した CTA は、**開ける瞬間に**出すかどうかを決める。
           ヘッダーの CTA が実際に消えている段（pv-nav-min）のときだけ出す。
           幅で決め打ちしないのは、何段目まで畳むかがページの中身で変わるため。 */
      if (v && savedCta) {
        var nv = d.getElementById('main-nav');
        savedCta.hidden = !(nv && nv.classList.contains('pv-nav-min'));
      }
      d.body.classList.toggle('pv-anav-open', v);
      btn.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) {
        /* 開いた瞬間の焦点は板の中（× ではなく最初の行き先）。
           ★visibility が切り替わるのを待たずに focus すると効かないブラウザがある。 */
        window.requestAnimationFrame(function () {
          var f = focusables();
          var first = null;
          for (var i = 0; i < f.length; i++) {
            if (f[i] !== x) { first = f[i]; break; }
          }
          (first || x).focus();
        });
      } else {
        /* 閉じたら ≡ に焦点を戻す（どこへ飛んだか分からなくならない）。 */
        try { btn.focus(); } catch (e) { /* 画面から消えていれば何もしない */ }
      }
    }

    btn.addEventListener('click', function () { setOpen(!open); });
    x.addEventListener('click', function () { setOpen(false); });
    ov.addEventListener('click', function () { setOpen(false); });

    /* 板の中の行き先を押したら閉じる。
       ページを移れば消えるが、同じページの中の錠前（pv-gates.js の説明）や
       #ハッシュはその場に留まるので、板が乗ったままにしない。 */
    side.addEventListener('click', function (e) {
      if (!open) return;
      var t = e.target;
      while (t && t !== side) {
        if (t === head) return;                       /* 頭の × は上で拾っている */
        if (t.tagName === 'A' || t.tagName === 'BUTTON') { setOpen(false); return; }
        t = t.parentNode;
      }
    });

    d.addEventListener('keydown', function (e) {
      if (!open) return;
      var k = e.key;
      if (k === 'Escape' || k === 'Esc') { e.preventDefault(); setOpen(false); return; }
      if (k !== 'Tab') return;
      /* 開いている間、焦点を板の中に留める（後ろのページへ抜けさせない）。 */
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!side.contains(d.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* 広い画面へ戻したら、開いたままの状態を残さない
       （左レールに戻るので覆いと body の overflow だけが取り残される）。 */
    window.addEventListener('resize', function () {
      if (open && !narrow()) setOpen(false);
    });

    /* 戻るボタンで前のページへ帰ってきたとき（bfcache）に開いたままにしない。
       ★history は積んでいないので、ここで拾うのは「復元」だけ。 */
    window.addEventListener('pageshow', function () {
      if (open) setOpen(false);
    });
    return true;
  }

  /* ★search.js の inject() は DOMContentLoaded で走る。読み込みの順番が
     どうであれ ≡ が立つのを待てるよう、3回まで様子を見る。
     （DOMContentLoaded → 次のフレーム → load。それでも来なければ諦める＝
       板は出ないが、ページは今までどおり動く。） */
  function tryBoot() {
    if (boot()) return;
    window.requestAnimationFrame(function () {
      if (boot()) return;
      window.addEventListener('load', function () { boot(); });
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', tryBoot);
  else tryBoot();
}());
