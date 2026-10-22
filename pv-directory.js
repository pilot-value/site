/* pv-directory.js ── 航空会社一覧（world-airlines.html・en/world-airlines.html）の台本。見せる・隠すだけ。
   2枚のページの中に書いてあった台本を、1文字も変えずにここへ移した（WP-dd-3）。日英の2枚がこの1本を読む。
   ⚠️ カード・地域のボタン・社数・金額は gen-directory.mjs がページに書く。ここで作らない
      （check-salary.mjs は HTML を読む。JS が描いた額は誰も照合しない）。
   ⚠️ 直したら node gen-directory.mjs（ページが読む ?v= はこのファイルの中身の指紋。流さないと古い台本が残る）。
   ⚠️ ヘッダーのログインの1行はページの中に残してある（db/test-pay-gate.mjs がページの字を読む）。
   defer の無い台本なので、ここの const / let はページの中に書いてあった時と同じように見える。 */
// ── Nav scroll ─────────────────────────────────────────────────────
window.addEventListener('scroll',()=>{
  document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40);
},{passive:true});

// ── 一覧のカード・地域ボタン・社数は gen-directory.mjs がこのページに書く。ここは見せる・隠すだけ ──
// ⚠️ 金額も社名もここで作らない（check-salary.mjs は HTML を読む。JS が描いた額は誰も照合しない）。
const GRID  = document.getElementById('airline-grid');
const CARDS = Array.from(GRID.querySelectorAll('li[data-slug]'));
const STRIP = Array.from(document.querySelectorAll('#region-strip .rstrip-btn'));
const CNT   = document.getElementById('result-count');
const HAY   = new Map(CARDS.map(li=>[li,(li.dataset.k||'').toLowerCase()]));
const unit  = n => (CNT.dataset.fmt||'{n}').replace('{n}',()=>String(n));
const regionBtn = id => STRIP.find(b=>b.dataset.region===id);
const inRegion  = id => CARDS.filter(li=>id==='all'||li.dataset.region===id).length;

// ── State ──────────────────────────────────────────────────────────
let activeRegion = 'all';
let activeType   = 'all';
let searchQuery  = '';

function setRegion(id){
  activeRegion = id;
  STRIP.forEach(b=>{
    const active = b.dataset.region === id;
    const rc = b.dataset.rc||'#f5c842';
    b.setAttribute('aria-pressed', active?'true':'false');
    if(active){ b.classList.add('active'); b.style.background=`${rc}18`; b.style.borderColor=`${rc}55`; b.style.color=rc; }
    else { b.classList.remove('active'); b.style.background='rgba(255,255,255,.04)'; b.style.borderColor='rgba(255,255,255,.1)'; b.style.color='#6b7d93'; }
  });
  document.querySelectorAll('.map-region-group').forEach(g=>{
    const mapActive = id==='all' || id===g.dataset.region;
    g.querySelectorAll('.rgn').forEach(p=>p.classList.toggle('active', mapActive));
  });
  document.querySelectorAll('.pin-group').forEach(pg=>{ pg.classList.toggle('active', id==='all' || id===pg.dataset.region); });
  render();
}
STRIP.forEach(b=>b.addEventListener('click',()=>setRegion(b.dataset.region)));

// ── SVG map interaction ────────────────────────────────────────────
const tooltip = document.getElementById('map-tooltip');
document.querySelectorAll('.map-region-group, .pin-group').forEach(el=>{
  const rid = el.dataset.region; const btn = regionBtn(rid); if(!btn) return; const rc = btn.dataset.rc;
  el.addEventListener('mouseenter', ()=>{ tooltip.textContent = `${btn.dataset.emoji} ${btn.dataset.label}  ${unit(inRegion(rid))}`;
    tooltip.style.color = rc; tooltip.style.borderColor = rc+'44'; tooltip.style.opacity='1'; });
  el.addEventListener('mousemove', e=>{ const rect = document.getElementById('world-svg').getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left)+'px'; tooltip.style.top = (e.clientY - rect.top)+'px'; });
  el.addEventListener('mouseleave', ()=>{ tooltip.style.opacity='0'; });
  el.addEventListener('click', ()=>{ setRegion(activeRegion === rid ? 'all' : rid); GRID.scrollIntoView({behavior:'smooth',block:'start'}); });
});

// ── Type filter ────────────────────────────────────────────────────
document.querySelectorAll('.ftype-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeType = btn.dataset.type;
    document.querySelectorAll('.ftype-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

// ── Search ─────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input',e=>{
  searchQuery = e.target.value.toLowerCase();
  render();
});

// ── Render ─────────────────────────────────────────────────────────
function render(){
  let n = 0;
  CARDS.forEach(li=>{
    let on = true;
    if(activeRegion!=='all' && li.dataset.region!==activeRegion) on = false;
    if(activeType==='fsc' && li.dataset.type!=='fsc') on = false;
    if(activeType==='lcc' && li.dataset.type!=='lcc') on = false;
    if(activeType==='taxfree' && li.dataset.tax!=='1') on = false;
    if(searchQuery && !HAY.get(li).includes(searchQuery)) on = false;
    li.hidden = !on; if(on) n++;
  });
  const rview = document.getElementById('range-view'), noR = document.getElementById('no-results'), fbar = document.getElementById('filter-bar');
  CNT.textContent = n ? unit(n) : '';
  if(activeView==='range'){ if(fbar) fbar.style.display='none'; GRID.style.display='none'; noR.style.display='none'; rview.style.display='block'; mountWALeveling(); return; }
  if(fbar) fbar.style.display='';
  rview.style.display='none'; GRID.style.display=''; noR.style.display = n ? 'none' : 'block';
}

// ── Salary leveling grid：index と同一の Levels.fyi 型カラムを共有モジュール PVLeveling にマウント ──
let activeView   = 'card';
let waLvlMounted = false;
// レンジタブ初回表示時に1回だけマウント（隠れた要素での display:none 初期化差異を回避）。
function mountWALeveling(){
  if(waLvlMounted || typeof PVLeveling==='undefined' || !PVLeveling.mount) return;
  const META = {};
  (window.PV_AIRLINES||[]).forEach(a=>{ META[window.PV_slugOf(a)] = a; });
  PVLeveling.mount('#lvl-wa-grid', {
    tip:'#lvl-wa-tip', layout:'levels', picker:'#lvl-wa-picker',
    quick:['ana','jal','emirates','delta','united','singapore-airlines'],
    max:5, pool:'all', slugs:['ana','jal','emirates','delta'],
    mode:'all', meta:META
  });
  waLvlMounted = true;
}

// View toggle
document.querySelectorAll('.view-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    activeView = btn.dataset.view;
    document.querySelectorAll('.view-btn').forEach(b=>{
      const on = b===btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
    render();
  });
});

// ── Init ───────────────────────────────────────────────────────────
render();
STRIP.forEach(b=>{ const el=document.getElementById('pc-'+b.dataset.region); if(el) el.textContent=unit(inRegion(b.dataset.region)); });
document.querySelectorAll('.rgn').forEach(p=>p.classList.add('active'));

// ── THEME TOGGLE ───────────────────────────────────────────────────
const SUN_SVG_W  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON_SVG_W = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
function applyThemeW(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('pv-theme',t);
  const btn=document.getElementById('theme-toggle');
  if(btn) btn.innerHTML=t==='dark'?SUN_SVG_W:MOON_SVG_W;
}
document.getElementById('theme-toggle').addEventListener('click',function(){
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  applyThemeW(next);
});
applyThemeW(localStorage.getItem('pv-theme')||'light');
