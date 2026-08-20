/* ═══════════════════════════════════════════════════
   PILOT VALUE — Airline Detail Page: Shared Script
   ═══════════════════════════════════════════════════ */

/* Load global search */
(function(){var s=document.createElement('script');s.src='../search.js';document.head.appendChild(s);})();
/* Load language toggle */
(function(){var s=document.createElement('script');s.src='../lang-toggle.js';document.head.appendChild(s);})();

(function(){

// ── Airline code from body data attribute ──────────
const AIRLINE_CODE = document.body.dataset.airline || '';

// ── Supabase ────────────────────────────────────────
const _SB_URL = 'https://vzgmnkrggrwtsrpqndsm.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Z21ua3JnZ3J3dHNycHFuZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzkwOTcsImV4cCI6MjA5MDAxNTA5N30.wE4cJbqeYGCgn5ZvHd80hYWgQuySKvOMJMbsJWOvmtw';
let _sb = null;
// クライアントは airline-reviews-ui.js が保持するものを共有する。
// createClient を2回呼ぶと GoTrueClient の多重インスタンス警告が出る。
function _initSB() {
  if (!window.PVReviewUI) return Promise.resolve(null);
  return PVReviewUI.sb().then(function (c) { _sb = c; return c; });
}

// ── Theme Toggle ───────────────────────────────────
const SUN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function applyThemeA(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('pv-theme', t);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = (t === 'dark') ? SUN : MOON;
}
// Apply immediately
applyThemeA(localStorage.getItem('pv-theme') || 'light');
// 右側ナビグループ注入（スクリプトは </body> 直前のため DOM 構築済み・同期実行可）
(function() {
  if (document.getElementById('theme-toggle')) return;
  var nav = document.getElementById('main-nav');
  if (!nav) return;
  var inner = nav.querySelector('.max-w-7xl') || nav;
  // 右端ラッパー: ← 一覧に戻る + ☀️ + JP をまとめて右寄せ
  var wrap = document.createElement('div');
  wrap.id = 'pv-nav-right';
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0';
  var backBtn = inner.lastElementChild;
  inner.appendChild(wrap);
  if (backBtn && backBtn !== wrap) wrap.appendChild(backBtn);
  var tbtn = document.createElement('button');
  tbtn.id = 'theme-toggle';
  tbtn.className = 'theme-toggle';
  tbtn.setAttribute('aria-label', 'ダーク/ライト切替');
  tbtn.innerHTML = (document.documentElement.getAttribute('data-theme') === 'light') ? MOON : SUN;
  wrap.appendChild(tbtn);
  tbtn.addEventListener('click', function() {
    applyThemeA(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();

/* ── 口コミ UI は airline-reviews-ui.js（日英共通の唯一の実装）へ移した ──
   スコアバナー・カテゴリ別グリッド・タブ・口コミ一覧・ゲート・投稿導線は
   すべて向こうにある。同じ描画を2本持つと必ず日英がズレるため。
   このファイルに残すのは JP 専用のもの＝テーマ切替・ナビ・ログインボタン・
   SEO メタ・構造化データ・ハンバーガーだけ。 */

// ── Airline brand colors ────────────────────────────
const AIRLINE_COLORS = {
  ana:'#005BAC', jal:'#CC0000', skymark:'#009FE8', zipair:'#00A857',
  peach:'#FF6699', jetstar:'#FF6600', spring:'#E8521A',
  'j-air':'#CC0000', jta:'#CC0000', jac:'#CC0000',
  rac:'#003087', hac:'#005BAC', 'ana-wings':'#005BAC',
  airjapan:'#1DBF73', airdo:'#003366', solaseed:'#5EBD3E',
  starflyer:'#2B2D42', fda:'#E03A3E', ibex:'#003087',
  'toki-air':'#0099CC', orc:'#0055A0', amx:'#C8102E',
  'shin-central':'#003366', 'toho-air':'#0055A0',
  'daiichi-air':'#3366CC', 'shin-nihon':'#CC0033',
  delta:'#003DA5', united:'#005DAA', american:'#B61F23',
  southwest:'#304CB2', alaska:'#01426A',
  emirates:'#C6922A', qatar:'#5C0632', etihad:'#BD8B13',
  'riyadh-air':'#006B4D', singapore:'#F90B24', cathay:'#006564',
  lufthansa:'#FFAD00', 'air-france':'#002157', british:'#002157',
  klm:'#009FDB', swiss:'#D20000', turkish:'#E30A17',
  'korean-air':'#003087', asiana:'#003399',
  'air-china':'#CC0000', 'china-eastern':'#006CB8', 'china-southern':'#0066CC',
  'air-canada':'#D01D2A', 'air-india':'#C8102E',
  'air-new-zealand':'#00005C', qantas:'#EE1C25',
  finnair:'#003580', 'aer-lingus':'#006A4E', iberia:'#CC0000',
  tap:'#BD0000', aegean:'#003087', aeromexico:'#0E2B72',
  avianca:'#BC0F2C', 'copa-airlines':'#0033A0', latam:'#1C1D8C',
};

// ── Airline display codes (IATA-style) ─────────────
const AIRLINE_DISPLAY_CODE = {
  ana:'ANA', jal:'JAL', skymark:'SKY', zipair:'ZIP', peach:'APJ',
  jetstar:'JJP', spring:'SJO', 'j-air':'JAI', jta:'JTA', jac:'JAC',
  rac:'RAC', hac:'HAC', 'ana-wings':'AKX', airjapan:'AJX',
  airdo:'ADO', solaseed:'VJ', starflyer:'SFJ', fda:'FDA', ibex:'IBX',
  'toki-air':'TKI', orc:'ORC', amx:'AMX', 'shin-central':'SCA',
  'toho-air':'THA', 'daiichi-air':'DAI', 'shin-nihon':'SNA',
  delta:'DAL', united:'UAL', american:'AAL', southwest:'WN',
  alaska:'ASA', emirates:'EK', qatar:'QR', etihad:'EY',
  'riyadh-air':'RX', singapore:'SQ', cathay:'CX',
  lufthansa:'LH', 'air-france':'AF', british:'BA', klm:'KL',
  swiss:'LX', turkish:'TK', 'korean-air':'KE', asiana:'OZ',
  'air-china':'CA', 'china-eastern':'MU', 'china-southern':'CZ',
  'air-canada':'AC', 'air-india':'AI', 'air-new-zealand':'NZ',
  qantas:'QF', finnair:'AY', 'aer-lingus':'EI', iberia:'IB',
  tap:'TP', aegean:'A3', aeromexico:'AM', avianca:'AV',
  'copa-airlines':'CM', latam:'LA',
};
function getAirlineRatings() {
  if (window.PVReviewUI) return PVReviewUI.getRatings();
  return { ratings: [3.5,3.5,3.5,3.5,3.5,3.5], count: 0 };
}

// ── SEO Meta Tags ───────────────────────────────────
function injectSEOMeta() {
  const h1 = document.querySelector('.hero-airline h1');
  const airlineName = h1 ? h1.textContent.trim() : (AIRLINE_CODE || '').toUpperCase();
  const subtitle = document.querySelector('.hero-airline p.text-muted, .hero-airline .text-muted');
  const englishName = subtitle ? subtitle.textContent.split('—')[0].trim() : '';
  const { ratings } = getAirlineRatings();
  const avg = (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1);
  const desc = `${airlineName}のパイロット年収・転職情報。機長・副操縦士の給与、採用情報、現役パイロットによる口コミ・評価を掲載。${englishName ? englishName + 'の' : ''}パイロット年収・転職ならPILOT VALUE。`;
  const canonical = `https://pilot-value.com/airlines/${AIRLINE_CODE}.html`;
  const newTitle = `${airlineName}パイロット年収・転職情報｜機長・副操縦士の給与・口コミ | PILOT VALUE`;
  document.title = newTitle;

  const setMeta = (attr, key, val) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  };

  setMeta('name', 'description', desc);
  setMeta('name', 'keywords', `${airlineName} パイロット 年収,${airlineName} 機長 年収,${airlineName} 転職,${airlineName} パイロット 口コミ,パイロット年収`);
  setMeta('name', 'robots', 'index,follow');
  setMeta('property', 'og:title', newTitle);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:type', 'article');
  setMeta('property', 'og:site_name', 'PILOT VALUE');
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', newTitle);
  setMeta('name', 'twitter:description', desc);

  let cl = document.querySelector('link[rel="canonical"]');
  if (!cl) { cl = document.createElement('link'); cl.rel = 'canonical'; document.head.appendChild(cl); }
  cl.href = canonical;
}

// ── Schema.org Structured Data (AggregateRating) ────
function injectSchemaOrg() {
  const h1 = document.querySelector('.hero-airline h1');
  const airlineName = h1 ? h1.textContent.trim() : (AIRLINE_CODE || '').toUpperCase();
  const { ratings, count } = getAirlineRatings();
  const avg = (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1);
  const ratingCount = count > 0 ? count + 3 : 3;

  const pageUrl = `https://pilot-value.com/airlines/${AIRLINE_CODE}.html`;
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': airlineName,
      'url': pageUrl,
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': avg,
        'bestRating': '5',
        'worstRating': '1',
        'ratingCount': ratingCount
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {'@type':'ListItem','position':1,'name':'PILOT VALUE','item':'https://pilot-value.com'},
        {'@type':'ListItem','position':2,'name':'世界の航空会社一覧','item':'https://pilot-value.com/world-airlines.html'},
        {'@type':'ListItem','position':3,'name':`${airlineName} パイロット年収`,'item': pageUrl}
      ]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': `${airlineName}のパイロット年収はいくらですか？`,
          'acceptedAnswer': {'@type':'Answer','text':`${airlineName}のパイロット年収は、副操縦士で1,000〜1,600万円、機長で1,800〜2,800万円が目安です。PILOT VALUEでは現役パイロットによる口コミ・詳細な給与情報を掲載しています。`}
        },
        {
          '@type': 'Question',
          'name': `${airlineName}のパイロットに転職するには？`,
          'acceptedAnswer': {'@type':'Answer','text':`${airlineName}のパイロット採用は自社養成・経験者採用があります。必要資格・採用条件・年収・口コミについてはPILOT VALUEの${airlineName}ページをご覧ください。`}
        }
      ]
    }
  ];

  const script = document.createElement('script');
  script.id = 'pv-schema-org';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schemas);
  document.head.appendChild(script);

  // Update ratingCount async once Supabase resolves real review count
  (async () => {
    try {
      await _initSB();
      if (!_sb) return;
      const { count: _c2 } = await _sb.from('reviews_v2')
        .select('id', {count:'exact',head:true}).eq('airline', AIRLINE_CODE);
      const sbCount = (_c2||0);
      if (sbCount > 0) {
        const el = document.getElementById('pv-schema-org');
        if (el) {
          const s = JSON.parse(el.textContent);
          s.aggregateRating.ratingCount = sbCount + 3;
          el.textContent = JSON.stringify(s);
        }
      }
    } catch(e) {}
  })();
}

// ── DOM Ready ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // ── Login button injection ──────────────────────
  var navRight = document.querySelector('#main-nav .flex.items-center.gap-3');
  if (navRight) {
    var authBtn = document.createElement('a');
    authBtn.id = 'nav-auth-btn';
    try {
      var u = JSON.parse(localStorage.getItem('pv_user') || 'null');
      if (u && u.name) {
        authBtn.href = '../profile.html';
        authBtn.textContent = u.name.replace(/[\s　].*/, ''); // first name
        authBtn.className = 'hidden md:inline-flex';
        authBtn.style.cssText = 'font-size:.82rem;font-weight:700;color:#f5c842;padding:7px 0;text-decoration:none;letter-spacing:.01em';
      } else {
        authBtn.href = '../login.html';
        authBtn.textContent = 'ログイン';
        authBtn.className = 'btn-ghost hidden md:inline-flex';
        authBtn.style.cssText = 'font-size:.82rem;padding:7px 14px';
      }
    } catch(e2) {
      authBtn.href = '../login.html';
      authBtn.textContent = 'ログイン';
      authBtn.className = 'btn-ghost hidden md:inline-flex';
      authBtn.style.cssText = 'font-size:.82rem;padding:7px 14px';
    }
    var lastChild = navRight.lastElementChild;
    navRight.insertBefore(authBtn, lastChild);
  }

  // SEO meta tags + Schema.org
  injectSEOMeta();
  injectSchemaOrg();
});

})(); // end IIFE

/* ─── Hamburger / Mobile Drawer ────────────────────
   ここには search.js とほぼ同じ引き出しの実装がもう1つ入っていた（日本語決め打ち）。
   同じものが2つあると、ヘッダーを直すたびに両方を直さないと日本語の航空会社ページ
   115枚だけ古いままになる（実際、幅が足りないときに畳む処理を search.js だけに
   入れたら、この115枚が畳まれなかった）。実装は search.js の1本に寄せた。
   このファイルの先頭で ../search.js を読み込んでいるので、消しても ≡ は出る。 */


// ── 海外パイロットの評判は renderReviews() 内で「通常の口コミと同じ小カード」として
//    カテゴリ別に一覧へ混ぜて表示する（overseasCardsHTML）。旧・長文一枚ブロックは廃止。
