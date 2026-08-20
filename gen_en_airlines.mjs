import { writeFileSync, mkdirSync } from 'fs';
import { SALARY, ladderFor, SPINE } from './salary-data.mjs';
import { airlines_orphans } from './orphan-data.mjs';
import { airlines_c } from './airlines_c.mjs';

/* ── SSOT-driven salary rendering (English pages) ──────────────────────────
   すべての年収数値は salary-data.mjs（唯一の正）由来。ページ側に数値は手打ちしない。
   表示は英語読者向けに ¥…M 圧縮（¥1M = 100万円）＝ currency.js が USD 既定へ変換。 */
const _trimZero = (s) => String(s).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
const enM = (man) => '¥' + _trimZero((man / 100).toFixed(1)) + 'M';   // 3700→¥37M, 3120→¥31.2M
const enRange = (o) => enM(o.lo) + '–' + enM(o.hi);                   // {lo,hi}→¥33.5M–¥50.5M

// 8段キャリアラダーの英語ラベル（SPINE と同順）。数値は ladderFor() が SSOT から機械導出。
const LADDER_EN = {
  cadet:    { label: 'Cadet / Trainee',                    years: '≤2 yrs'    },
  fo_early: { label: 'First Officer — Junior',             years: '3–5 yrs'   },
  fo_mid:   { label: 'First Officer — Mid',                years: '6–10 yrs'  },
  fo_snr:   { label: 'First Officer — Senior',             years: '11–15 yrs' },
  cap_new:  { label: 'Captain — New',                      years: '15–18 yrs' },
  cap_mid:  { label: 'Captain — Mid',                      years: '19–24 yrs' },
  cap_snr:  { label: 'Senior Captain',                     years: '25+ yrs'   },
  mgmt:     { label: 'Management / Instructor / Examiner', years: '—'         },
};

function ladderSectionEN(slug, d) {
  const L = ladderFor(slug, d);
  const rows = SPINE.map((s) => {
    const rung = L[s.key], en = LADDER_EN[s.key];
    if (!rung || rung.kind === 'collect') {
      return `<tr><td><span class="font-semibold">${en.label}</span></td><td class="text-muted">${en.years}</td><td><span class="text-muted text-sm">Data wanted</span></td><td><span class="tag tag-gray">crowd-sourced</span></td></tr>`;
    }
    const badge = rung.kind === 'authored'
      ? `<span class="tag tag-green">verified</span>`
      : `<span class="tag tag-gray">est.</span>`;
    return `<tr><td><span class="font-semibold">${en.label}</span></td><td class="text-muted">${en.years}</td><td><div class="text-sm">${enRange(rung)}</div></td><td>${badge}</td></tr>`;
  }).join('');
  return `
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Career Ladder</div>
<h2 class="text-2xl font-bold mb-2">Pay by Seniority</h2>
<p class="text-xs text-muted mb-6">Modeled from the captain / first-officer ranges above, sliced into standard career stages. Bands marked <span class="tag tag-gray">est.</span> are derived from those ranges (not official); <span class="tag tag-green">verified</span> bands come from active-pilot data. Management pay is crowd-sourced from verified pilots.</p>
<div class="overflow-x-auto"><table>
<thead><tr><th>Career Stage</th><th>Years</th><th>Annual (pre-tax)</th><th>Source</th></tr></thead>
<tbody>${rows}</tbody></table></div>
</div>`;
}

/* ── SSOT-driven comparison table（当社 vs ANA/JAL Japanベースライン）───────────
   年収は SSOT のみ・税は taxFree フラグと日本の既知値のみ＝捏造ゼロ。住宅/教育列は出さない。 */
// Japan-domiciled carriers → pilots pay Japanese income tax (~33%). Slugs verified against airlines/ on disk
// (fixed stale: solaseed-air→solaseed, air-do→airdo, oriental-air-bridge→orc) + all JP regionals confirmed 日本-based.
const JAPAN_CARRIERS = new Set(['ana','jal','skymark','peach','zipair','jetstar-japan','spring-japan','starflyer','solaseed','ibex','fda','airdo','orc','toki-air','airjapan','amx','ana-wings','daiichi-air','eagle-jet','hac','j-air','jac','jta','rac','root-aviation','shin-central','shin-nihon','toho-air']);
function taxCellEN(slug, d) {
  if (d.taxFree) return '<span class="tag tag-green">0% (tax-free)</span>';
  if (JAPAN_CARRIERS.has(slug)) return '<span class="tag tag-gray">~33% (Japan)</span>';
  return '<span class="text-muted text-sm">Income tax applies</span>';
}
function cmpRow(slug, d, name, flag, hi, color) {
  const label = `${name}${flag ? ' ' + flag : ''}`;
  const nameHtml = hi ? `<span class="font-bold" style="color:${color}">${label}</span>` : `<span class="font-semibold">${label}</span>`;
  const capHtml  = hi ? `<span class="font-bold" style="color:${color}">${enRange(d.cap)}</span>` : enRange(d.cap);
  return `<tr><td>${nameHtml}</td><td>${capHtml}</td><td>${enRange(d.fo)}</td><td>${taxCellEN(slug, d)}</td></tr>`;
}
function flagOf(a) {
  const m = ((a.tags && a.tags[0] && a.tags[0].label) || '').match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  return m ? m[0] : '';
}
function comparisonSectionEN(slug, d, a) {
  const rows = [ cmpRow(slug, d, a.nameEn, flagOf(a), true, a.color) ];
  // 日本メジャーをベースライン固定（当社が ANA/JAL 自身なら相手側＋海外アンカーへ差替え）
  if (slug !== 'ana' && SALARY.ana) rows.push(cmpRow('ana', SALARY.ana, 'ANA', '🇯🇵', false));
  if (slug !== 'jal' && SALARY.jal) rows.push(cmpRow('jal', SALARY.jal, 'JAL', '🇯🇵', false));
  if ((slug === 'ana' || slug === 'jal') && SALARY.emirates) rows.push(cmpRow('emirates', SALARY.emirates, 'Emirates', '🇦🇪', false));
  return `
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Comparison</div>
<h2 class="text-2xl font-bold mb-6">${a.nameEn} vs Japan Majors</h2>
<div class="overflow-x-auto"><table>
<thead><tr><th>Airline</th><th>Captain (range)</th><th>First Officer</th><th>Income Tax</th></tr></thead>
<tbody>${rows.join('')}</tbody></table></div>
<p class="text-xs text-muted mt-4">* Salary figures are SSOT reference values (pre-tax unless marked tax-free). ANA / JAL shown as the Japan baseline — ~33% income tax applies in Japan, so after-tax take-home is lower than the headline. Tax-free carriers pay 100% take-home. Verify exact figures with each airline.</p>
</div>`;
}

/* ── SSOT-driven FAQ（＋FAQPage 構造化データ）。回答の数値は全て SSOT・要件は jobs 由来。 */
function faqItemsEN(slug, d, a) {
  const items = [];
  const capAvg = enM(d.cap.avg), foAvg = enM(d.fo.avg);
  const taxPhrase = d.taxFree ? '100% tax-free (no personal income tax)' : 'pre-tax';
  items.push({
    q: `What is ${a.nameEn} captain salary in 2026?`,
    a: `${a.nameEn} captain pay averages about ${capAvg} per year (range ${enRange(d.cap)}), ${taxPhrase}. Figures are reference values based on public data and industry benchmarks.`
  });
  items.push({
    q: `What is ${a.nameEn} first officer salary?`,
    a: `${a.nameEn} first officer pay averages about ${foAvg} per year (range ${enRange(d.fo)}), ${taxPhrase}, rising with seniority — see the Career Ladder above for the year-by-year breakdown.`
  });
  if (d.taxFree) {
    items.push({
      q: `Is ${a.nameEn} salary really tax-free?`,
      a: `Yes — there is no personal income tax in the home country, so pilots keep 100% of gross pay. For a Japanese pilot that is roughly 1.5× the take-home of an equivalent ANA / JAL salary, which is taxed around 33%.`
    });
  }
  const j = a.jobs && a.jobs[0];
  if (j && j.details && j.details.length) {
    const req = j.details.map(x => `${x.k}: ${x.v}`).join('; ');
    items.push({
      q: `What are the requirements to become a ${a.nameEn} pilot?`,
      a: `${j.title}${j.sub ? ' — ' + j.sub : ''}. Key requirements — ${req}.${j.note ? ' ' + j.note.replace(/^\*\s*/, '') : ''}`
    });
  }
  if (slug !== 'ana' && slug !== 'jal' && SALARY.ana) {
    const anaCap = enM(SALARY.ana.cap.avg);
    items.push({
      q: `How does ${a.nameEn} pay compare to ANA or JAL?`,
      a: d.taxFree
        ? `${a.nameEn} captains average ${capAvg} tax-free, versus roughly ${anaCap} pre-tax at ANA / JAL (taxed ~33%). After tax the overseas gap is even wider.`
        : `${a.nameEn} captains average ${capAvg}, versus roughly ${anaCap} at ANA / JAL. Both figures are pre-tax; Japan applies ~33% income tax.`
    });
  }
  return items;
}
function faqSectionHtml(items) {
  if (!items.length) return '';
  const acc = items.map((it, i) => `
<details class="info-card cursor-pointer"${i === 0 ? ' open' : ''}>
<summary class="font-semibold">${it.q}</summary>
<p class="text-sm text-muted mt-3">${it.a}</p>
</details>`).join('');
  return `
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">FAQ</div>
<h2 class="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
<div class="space-y-4">${acc}</div>
</div>`;
}
function faqJsonLd(items) {
  if (!items.length) return '';
  const obj = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map(it => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })) };
  return `<script type="application/ld+json">${JSON.stringify(obj)}<\/script>`;
}

mkdirSync('en/airlines', { recursive: true });

/* ── Shared CSS ── */
const CSS = `*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}
body{background-color:#0a0c0f;color:#e8edf2;font-family:'Inter','Noto Sans JP',sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:128px;opacity:.3}
nav{position:fixed;top:0;left:0;right:0;z-index:200;transition:background .4s,border-color .4s}
nav.scrolled{background:rgba(10,12,15,.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.nav-link{color:rgba(255,255,255,.6);font-size:.85rem;font-weight:500;letter-spacing:.04em;transition:color .2s;text-decoration:none}.nav-link:hover{color:#fff}
.glass{background:rgba(17,22,32,.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.07);border-radius:16px}
.glass-raised{background:rgba(24,33,47,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.10);border-radius:16px}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:600}
.tag-blue{background:rgba(61,155,255,.12);color:#5fb0ff;border:1px solid rgba(61,155,255,.2)}
.tag-gold{background:rgba(245,200,66,.10);color:#f5c842;border:1px solid rgba(245,200,66,.2)}
.tag-green{background:rgba(52,211,153,.10);color:#34d399;border:1px solid rgba(52,211,153,.2)}
.tag-gray{background:rgba(255,255,255,.06);color:#8899aa;border:1px solid rgba(255,255,255,.1)}
.tag-orange{background:rgba(249,115,22,.12);color:#fb923c;border:1px solid rgba(249,115,22,.2)}
.tag-red{background:rgba(232,25,44,.12);color:#ff5555;border:1px solid rgba(232,25,44,.2)}
.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:10px;background:#3d9bff;color:#fff;font-size:.9rem;font-weight:600;border:none;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s,background .2s}
.btn-primary:hover{background:#5eb3ff;transform:translateY(-1px);box-shadow:0 8px 30px rgba(61,155,255,.35)}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.875rem;font-weight:600;border:1px solid rgba(255,255,255,.12);text-decoration:none;transition:background .2s}
.btn-ghost:hover{background:rgba(255,255,255,.12)}
.fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s cubic-bezier(.16,1,.3,1)}.fade-up.visible{opacity:1;transform:translateY(0)}
.salary-bar-track{height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.salary-bar-fill{height:100%;border-radius:999px;transition:width 1.4s cubic-bezier(.16,1,.3,1);width:0}
.stat-card{padding:20px;border-radius:14px;background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(61,155,255,.10);border:1px solid rgba(61,155,255,.25);font-size:.75rem;font-weight:600;color:#3d9bff;letter-spacing:.08em;text-transform:uppercase}
table{width:100%;border-collapse:collapse}th{font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7d93;padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07)}
td{padding:13px 16px;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background:rgba(255,255,255,.02)}
.logo-img{height:44px;width:auto;filter:brightness(1.15) drop-shadow(0 0 8px rgba(249,115,22,.5));transition:filter .3s}
footer{background:#060809;border-top:1px solid rgba(255,255,255,.05)}
.hero-airline{position:relative;padding:160px 0 80px;overflow:hidden}
.info-card{background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;margin-bottom:8px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}
.theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s;flex-shrink:0}
.theme-toggle:hover{background:rgba(255,255,255,.14)}
.lang-toggle{display:inline-flex;align-items:center;gap:4px;padding:0 10px;height:38px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.75rem;font-weight:700;letter-spacing:.04em;border:1px solid rgba(255,255,255,.12);cursor:pointer;transition:background .2s;flex-shrink:0;white-space:nowrap}
.lang-toggle:hover{background:rgba(255,255,255,.13)}
[data-theme="light"] body{background-color:#f3f5f8!important;color:#0f172a!important}
[data-theme="light"] nav{background:rgba(243,245,248,.96)!important;border-bottom:1px solid rgba(0,0,0,.08)!important;backdrop-filter:blur(16px)!important}
[data-theme="light"] .glass{background:rgba(255,255,255,.92)!important;border-color:rgba(0,0,0,.08)!important}
[data-theme="light"] .stat-card{background:#fff!important;border-color:rgba(0,0,0,.08)!important}
[data-theme="light"] .info-card{background:rgba(0,0,0,.03)!important;border-color:rgba(0,0,0,.07)!important}
[data-theme="light"] .nav-link{color:rgba(15,23,42,.55)!important}
[data-theme="light"] .btn-ghost{background:rgba(0,0,0,.05)!important;color:#0f172a!important;border-color:rgba(0,0,0,.12)!important}
[data-theme="light"] table th{color:#4a5568!important;border-bottom-color:rgba(0,0,0,.08)!important}`;

const JS = `window.addEventListener('scroll',()=>{document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');e.target.querySelectorAll('[data-width]').forEach(b=>{b.style.width='0';setTimeout(()=>{b.style.width=b.dataset.width+'%'},80)});io.unobserve(e.target)}})},{threshold:.01,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));
setTimeout(()=>{document.querySelectorAll('.fade-up:not(.visible)').forEach(el=>{el.classList.add('visible');el.querySelectorAll('[data-width]').forEach(b=>{b.style.width='0';setTimeout(()=>{b.style.width=b.dataset.width+'%'},80)})})},300);
(function(){var t=localStorage.getItem('pv-theme')||'dark';document.documentElement.setAttribute('data-theme',t)})();
var tb=document.getElementById('theme-toggle');if(tb){tb.innerHTML=document.documentElement.getAttribute('data-theme')==='light'?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>';tb.addEventListener('click',function(){var nt=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',nt);localStorage.setItem('pv-theme',nt);tb.innerHTML=nt==='light'?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>'});}`;

/* ── HTML template ── */
function page(a) {
  const slug = a.file.replace(/\.html$/, '');
  const d = SALARY[slug];   // SSOT。存在すれば年収は全てここ由来（手打ち a.stats/a.salaryRows を上書き）
  const heroStats = d
    ? [{ val: enM(d.cap.avg), label: 'Capt. Avg (pre-tax)' },
       { val: enM(d.fo.avg),  label: 'FO Avg (pre-tax)' },
       ...a.stats.slice(2)]
    : a.stats;
  const salRows = d
    ? [{ pos: 'Captain',       sub: (a.salaryRows && a.salaryRows[0] && a.salaryRows[0].sub) || 'International widebody',
         range: enRange(d.cap), avg: enM(d.cap.avg), pct: 100,
         note: d.taxFree ? 'Tax-free' : 'Pre-tax', noteTag: d.taxFree ? 'gold' : 'gray' },
       { pos: 'First Officer', sub: (a.salaryRows && a.salaryRows[1] && a.salaryRows[1].sub) || 'Seniority-based',
         range: enRange(d.fo),  avg: enM(d.fo.avg), pct: Math.max(20, Math.round(d.fo.avg / d.cap.avg * 100)),
         note: 'Seniority-based', noteTag: 'blue' }]
    : a.salaryRows;
  const ladderHtml = d ? ladderSectionEN(slug, d) : '';
  const cmpHtml   = d ? comparisonSectionEN(slug, d, a) : '';
  const faqItems  = d ? faqItemsEN(slug, d, a) : [];
  const faqHtml   = faqSectionHtml(faqItems);
  const faqLd     = faqJsonLd(faqItems);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<script>(function(){var t=localStorage.getItem('pv-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}());<\/script>
<title>${a.nameEn} Pilot Salary 2026 | PILOT VALUE</title>
<meta name="description" content="${a.nameEn} pilot salary 2026: captain avg ${heroStats[0].val}. ${a.subtitle}"/>
<meta name="robots" content="index,follow"/>
<link rel="canonical" href="https://pilot-value.com/en/airlines/${a.file}"/>
<link rel="alternate" hreflang="ja" href="https://pilot-value.com/airlines/${a.file}"/>
<link rel="alternate" hreflang="en" href="https://pilot-value.com/en/airlines/${a.file}"/>
<link rel="alternate" hreflang="x-default" href="https://pilot-value.com/airlines/${a.file}"/>
${faqLd}
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet"/>
<script>tailwind.config={theme:{extend:{colors:{bg:'#0a0c0f',surface:'#111620',raised:'#18212f',accent:'#3d9bff',gold:'#f5c842',orange:'#f97316',text:'#e8edf2',muted:'#6b7d93'},fontFamily:{sans:['Inter','Noto Sans JP','sans-serif']}}}};<\/script>
<style>${CSS}
.section-badge{background:${a.color}18;border:1px solid ${a.color}40;color:${a.color}}
</style>
</head>
<body class="relative" data-lang="en">

<nav id="main-nav">
<div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
<a href="../../en/index.html"><img src="../../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" class="logo-img"/></a>
<div class="hidden md:flex items-center gap-6">
<a href="../../en/index.html#compare" class="nav-link">Japan vs Overseas</a>
<a href="../../en/index.html#ranking" class="nav-link">Salary Rankings</a>
<a href="../../en/world-airlines.html" class="nav-link">World Airlines</a>
<a href="../../en/index.html#jobs" class="nav-link">Job Openings</a>
</div>
<div class="flex items-center gap-3">
<button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark/light mode"></button>
<a href="../../en/world-airlines.html" class="btn-ghost text-sm py-2 px-4 hidden md:inline-flex">← World Airlines</a>
</div>
</div>
</nav>

<div class="hero-airline" style="background:linear-gradient(180deg,${a.color}12 0%,transparent 60%)">
<div class="absolute inset-0" style="background:radial-gradient(ellipse 50% 60% at 20% 40%,${a.color}10 0%,transparent 70%)"></div>
<div class="max-w-7xl mx-auto px-6 relative">
<div class="flex items-start gap-6 mb-8">
<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0" style="background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.code}</div>
<div>
<div class="flex flex-wrap items-center gap-3 mb-3">${a.tags.map(t=>`<span class="tag ${t.cls}">${t.label}</span>`).join('')}</div>
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2" style="background:linear-gradient(135deg,#fff,${a.color});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${a.nameEn}</h1>
<p class="text-muted text-lg">${a.subtitle}</p>
</div>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
${heroStats.map(s=>`<div class="stat-card text-center"><div class="text-xl font-extrabold mb-1" style="color:${s.color||a.color}">${s.val}</div><div class="text-xs text-muted">${s.label}</div></div>`).join('')}
</div>
</div>
</div>

<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Overview</div>
<h2 class="text-2xl font-bold mb-4">About ${a.nameEn}</h2>
<div class="grid lg:grid-cols-2 gap-8">
<div>${(Array.isArray(a.overview)?a.overview:[a.overview]).map(p=>`<p class="text-muted leading-relaxed mb-4">${p}</p>`).join('')}</div>
<div class="grid grid-cols-2 gap-4">${a.facts.map(f=>`<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${f.k}</div><div class="font-semibold text-sm">${f.v}</div></div>`).join('')}</div>
</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Salary Data</div>
<h2 class="text-2xl font-bold mb-2">Pilot Salary (as of March 2026)</h2>
<p class="text-xs text-muted mb-6">* Figures are reference values based on public data and industry benchmarks. Verify actual compensation with each airline's official recruitment information.</p>
<div class="overflow-x-auto mb-4"><table>
<thead><tr><th>Position</th><th>Salary Range</th><th>Avg / Reference</th><th>Notes</th></tr></thead>
<tbody>
${salRows.map(r=>`<tr>
<td><span class="font-semibold">${r.pos}</span><br><span class="text-xs text-muted">${r.sub||''}</span></td>
<td><div class="text-sm">${r.range}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${r.color||a.color}88,${r.color||a.color})" data-width="${r.pct}"></div></div></td>
<td><span class="font-bold text-lg" style="color:${r.color||a.color}">${r.avg}</span></td>
<td>${r.note?`<span class="tag tag-${r.noteTag||'gray'}">${r.note}</span>`:''}</td>
</tr>`).join('')}
</tbody></table></div>
<p class="text-xs text-muted">${a.salaryNote}</p>
</div>
${ladderHtml}
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Operations</div>
<h2 class="text-2xl font-bold mb-6">Routes &amp; Fleet</h2>
<div class="grid md:grid-cols-2 gap-6">
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">Routes</div><p class="text-muted text-sm leading-relaxed">${Array.isArray(a.ops.routes)?a.ops.routes.join(' / '):a.ops.routes}</p></div>
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">Fleet</div><p class="text-muted text-sm leading-relaxed">${Array.isArray(a.ops.fleet)?(a.ops.fleet[0]&&a.ops.fleet[0].name?a.ops.fleet.map(f=>f.name+(f.desc?' — '+f.desc:'')).join(', '):a.ops.fleet.join(', ')):a.ops.fleet}</p></div>
</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Training</div>
<h2 class="text-2xl font-bold mb-6">Training &amp; Checkrides</h2>
<div class="grid md:grid-cols-2 gap-4">${a.training.map(t=>`<div class="info-card"><div class="font-semibold mb-2" style="color:${a.color}">${t.title}</div><p class="text-sm text-muted">${t.body}</p></div>`).join('')}</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Benefits</div>
<h2 class="text-2xl font-bold mb-6">Benefits &amp; Perks</h2>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${a.benefits.map(b=>`<div class="stat-card"><div class="text-2xl mb-2">${b.icon}</div><div class="font-semibold text-sm mb-1">${b.title}</div><p class="text-xs text-muted">${b.body}</p></div>`).join('')}</div>
</div>

<div class="glass p-8 fade-up">
<div class="section-badge mb-4">Job Openings</div>
<h2 class="text-2xl font-bold mb-2">Recruitment Info (as of March 2026)</h2>
<p class="text-sm text-muted mb-6">Hiring status: <strong style="color:${a.hiringColor||a.color}">${a.hiringStatus}</strong></p>
<div class="space-y-5">${a.jobs.map(j=>`<div class="glass-raised p-6" style="border-color:${a.color}25">
<div class="flex items-start justify-between mb-3 flex-wrap gap-2">
<div><div class="font-bold text-base mb-0.5">${j.title}</div><div class="text-sm text-muted">${j.sub}</div></div>
<span class="tag tag-${j.statusTag||j.stag||'gray'}">${j.status}</span>
</div>
<div class="grid sm:grid-cols-2 gap-3 mb-3">${j.details.map(d=>`<div class="text-sm"><span class="text-muted">${d.k}: </span><span>${d.v}</span></div>`).join('')}</div>
${j.note?`<p class="text-xs text-muted mt-2">${j.note}</p>`:''}
</div>`).join('')}
</div>
${a.recruitUrl?`<div class="mt-6"><a href="${a.recruitUrl}" target="_blank" rel="noopener" class="btn-primary">${a.nameEn} Official Careers Page <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9 3h4v4M13 3l-7 7M5 5H3v8h8v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>`:''}
</div>
${cmpHtml}
${faqHtml}
</div>

<footer class="py-10"><div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
<a href="../../en/index.html"><img src="../../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" style="height:28px;opacity:.7"/></a>
<p class="text-xs text-muted">Salary figures are reference values. Verify actual conditions on each airline's official website.</p>
<a href="../../en/world-airlines.html" class="btn-ghost text-sm py-2 px-4">← World Airlines</a>
</div></footer>

<script>${JS}<\/script>
<script src="../../lang-toggle.js"><\/script>
<script src="../../currency.js"><\/script>
</body></html>`;
}

/* ═══════════════════════════════════════════════════
   AIRLINE DATA — generate_airlines.mjs (13 airlines)
   ═══════════════════════════════════════════════════ */

const airlines_main = [
  {
    file:'skymark.html', code:'SKY', color:'#34d399',
    nameEn:'Skymark Airlines',
    subtitle:"Japan's 3rd largest carrier. Domestic-only with strong cost efficiency.",
    tags:[{cls:'tag-blue',label:'🇯🇵 Japan'},{cls:'tag-green',label:'Domestic Only'},{cls:'tag-gray',label:'Independent'}],
    stats:[{val:'¥19M',label:'Capt. Avg Salary (est.)'},{val:'¥10M',label:'F/O Avg Salary (est.)'},{val:'B737NG',label:'Fleet'},{val:'~30 aircraft',label:'Fleet Size'}],
    overview:[
      'Skymark Airlines is an independent carrier founded in 1998, ranking third in Japan behind ANA and JAL. Operating domestic routes from Haneda to major cities nationwide.',
      'After filing for civil rehabilitation in 2015, Skymark successfully restructured and relisted in 2021. With competitive pricing and efficient operations, the airline continues stable growth. Domestic-only operations mean short-haul, high-frequency flying style.'
    ],
    facts:[{k:'HQ',v:'Ota, Tokyo (Haneda)'},{k:'Founded',v:'1998'},{k:'Hub',v:'Haneda Airport (HND)'},{k:'Routes',v:'~15 domestic routes'},{k:'Fleet Type',v:'B737NG (single type)'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain',sub:'B737NG',range:'¥16M–¥23M',avg:'¥19M',pct:100,note:'Estimated',noteTag:'gray'},
      {pos:'First Officer',sub:'B737NG',range:'¥7M–¥12M',avg:'¥10M',pct:53,note:'Estimated',noteTag:'gray'},
    ],
    salaryNote:'💡 Skymark contracts foreign captains; reported compensation is $9,000–$14,250/month (gross). Public data on Japanese employee salaries is limited.',
    ops:{routes:'Haneda hub to Sapporo, Fukuoka, Naha, Kobe and other major domestic airports. High-frequency, short-haul domestic focus. No international operations.',fleet:'B737-800 / B737-800NG'},
    training:[
      {title:'B737 Type Rating',body:'B737 type rating training at contracted centers (Naha, Narita). Existing license holders need type rating only.'},
      {title:'Captain Upgrade',body:'Upgrade after F/O experience. Single-type fleet means no aircraft change upon upgrade. Based on assessment and vacancies.'},
      {title:'Recurrent Checks',body:'Simulator proficiency checks 1–2x per year. Conducted by JCAB-certified examiners.'},
      {title:'Training Environment',body:'Single-type operation means efficient training. Crew can become B737 experts relatively quickly.'}
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Employee discount tickets for self and family on Skymark routes.'},
      {icon:'🏥',title:'Health Insurance',body:'Health insurance association membership. Medical exam support for pilots.'},
      {icon:'🏦',title:'Retirement Plan',body:'Defined contribution pension. Lump-sum retirement payment based on tenure.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for loss of license due to work or non-work causes.'},
      {icon:'🏠',title:'Housing Allowance',body:'Housing allowance or company housing near Haneda base.'},
      {icon:'📚',title:'Training Costs',body:'Type rating and recurrent check costs covered by the company.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'Captain — B737NG',sub:'Domestic captain. Haneda base.',status:'Open',statusTag:'green',
        details:[{k:'License',v:'B737 type (ATPL)'},{k:'Minimum Hours',v:'3,000h PIC (guideline)'},{k:'Employment',v:'Full-time or contract'}],
        note:'* Hiring status may change. Check official recruiting page for the latest.'},
      {title:'First Officer — B737NG',sub:'Domestic F/O.',status:'Rolling',statusTag:'blue',
        details:[{k:'License',v:'CPL + Instrument Rating'},{k:'Min. Hours',v:'500h+'},{k:'English',v:'Aviation English certificate'}],
        note:'* No cadet program currently. Experienced/licensed candidates preferred.'}
    ],
    recruitUrl:'https://www.skymark.co.jp/ja/company/recruit/'
  },
  {
    file:'zipair.html', code:'ZIP', color:'#a78bfa',
    nameEn:'ZIPAIR Tokyo',
    subtitle:'JAL Group international LCC. Growing carrier operating B787 Dreamliner.',
    tags:[{cls:'tag-blue',label:'🇯🇵 Japan'},{cls:'tag-green',label:'Hiring'},{cls:'tag-blue',label:'Int\'l LCC'},{cls:'tag-gray',label:'JAL Group'}],
    stats:[{val:'¥25M',label:'Capt. Avg Salary (est.)'},{val:'¥15M',label:'F/O Avg Salary (est.)'},{val:'B787',label:'Fleet'},{val:'Est. 2020',label:'New Carrier'}],
    overview:[
      'ZIPAIR Tokyo was established in 2018 as a wholly owned subsidiary of Japan Airlines (JAL), commencing operations in 2020. Using B787 Dreamliner aircraft, it operates from Narita to Bangkok, Seoul, Honolulu, Los Angeles, and San Jose.',
      'Positioned as a LHCC (Low-to-High Cost Carrier) between full-service and LCC, ZIPAIR benefits from JAL Group infrastructure while offering a dynamic growth environment as a young airline.'
    ],
    facts:[{k:'HQ',v:'Narita, Chiba (NRT)'},{k:'Founded',v:'2018 (ops 2020)'},{k:'Parent',v:'Japan Airlines (JAL)'},{k:'Routes',v:'International only'},{k:'Fleet',v:'B787-8 Dreamliner'},{k:'Ret. Age',v:'60 (ext. to 65)'}],
    salaryRows:[
      {pos:'Captain',sub:'B787',range:'¥22M–¥31M',avg:'¥25M',pct:100,note:'Estimated',noteTag:'gray'},
      {pos:'First Officer',sub:'B787',range:'¥12M–¥19M',avg:'¥15M',pct:60,note:'Estimated',noteTag:'gray'},
    ],
    salaryNote:'💡 Reference: Air Japan (AJX) public data — Captain $10,930–$16,090/month, F/O $6,800–$9,660/month. ZIPAIR actual figures may differ.',
    ops:{routes:'International routes from Narita (NRT): LA (LAX), San Jose (SJC), Honolulu (HNL), Bangkok, Seoul, Kuala Lumpur. International-only LCC, no domestic ops.',fleet:'B787-8 (sole aircraft type). Expansion planned.'},
    training:[
      {title:'B787 Type Rating',body:'Using JAL Group training infrastructure. Ground school → simulator → line training at Narita base.'},
      {title:'Existing Type Holders',body:'B787-rated pilots undergo abbreviated transition. Full type rating course for pilots from other types.'},
      {title:'Captain Upgrade',body:'Internal upgrade after F/O service. Young airline may offer earlier upgrade opportunities depending on demand.'},
      {title:'JAL Group Standards',body:'Training aligned with JAL Group safety management standards. Safety culture at JAL level.'}
    ],
    benefits:[
      {icon:'✈️',title:'JAL Group Staff Travel',body:'Employee discount program for JAL and ZIPAIR flights. Group-wide connectivity.'},
      {icon:'🏥',title:'Health Insurance',body:'Health insurance with medical exam support. Loss of license coverage included.'},
      {icon:'🏦',title:'Retirement Plan',body:'Defined contribution pension. Lump-sum retirement benefit based on tenure.'},
      {icon:'📋',title:'1,500h Guarantee',body:'Monthly minimum flight hours guarantee (approx. 70h/month).'},
      {icon:'🌍',title:'International Allowance',body:'Daily allowance for overseas layovers (~¥5,300/day).'},
      {icon:'📚',title:'Growth Opportunity',body:'As a new carrier, early exposure to diverse roles and routes is likely.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'Captain — B787',sub:'International captain. Narita base.',status:'Actively Hiring',statusTag:'green',
        details:[{k:'Min. Hours',v:'1,500h PIC'},{k:'License',v:'ATPL'},{k:'Ret. Age',v:'60 (ext. to 65)'}],
        note:'* ~150 hiring plan announced Oct 2024. Active expansion phase.'},
      {title:'First Officer — B787',sub:'International F/O.',status:'Open',statusTag:'green',
        details:[{k:'License',v:'CPL + Instrument Rating'},{k:'Min. Hours',v:'1,500h+ (ATPL preferred)'},{k:'English',v:'ICAO Level 4+'}],
        note:''}
    ],
    recruitUrl:'https://www.zipairtokyo.com/en/recruit/'
  },
  {
    file:'peach.html', code:'APJ', color:'#f472b6',
    nameEn:'Peach Aviation',
    subtitle:'ANA Group LCC. A320 family on domestic and short-haul international routes.',
    tags:[{cls:'tag-blue',label:'🇯🇵 Japan'},{cls:'tag-gray',label:'Check Status'},{cls:'tag-blue',label:'LCC'},{cls:'tag-gray',label:'ANA Group'}],
    stats:[{val:'¥24M',label:'Capt. Salary (est.)'},{val:'¥14M',label:'F/O Salary (est.)'},{val:'A320',label:'Fleet'},{cls:'tag-green',val:'Est. 2011',label:'Founded'}],
    overview:[
      'Peach Aviation, founded in 2011, is a wholly owned ANA subsidiary LCC. Based at Kansai International Airport (KIX), it operates A320 family aircraft on domestic routes and short-haul international routes to Korea, Taiwan, and Hong Kong.',
      'While achieving significant cost reductions as an LCC, Peach maintains ANA Group safety standards and training quality. The Kansai-centric network is a major draw for pilots based in western Japan.'
    ],
    facts:[{k:'HQ',v:'Izumisano, Osaka (KIX)'},{k:'Founded',v:'2011'},{k:'Parent',v:'ANA (All Nippon Airways)'},{k:'Hub',v:'Kansai Int\'l Airport (KIX)'},{k:'Fleet',v:'A320/A321neo'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain',sub:'A320/A321',range:'¥20M–¥28M',avg:'¥24M',pct:100,note:'Based on public data',noteTag:'gray'},
      {pos:'First Officer',sub:'Entry to senior',range:'¥10M–¥16M',avg:'¥14M',pct:58,note:'Incl. allowances',noteTag:'gray'},
    ],
    salaryNote:'💡 Public data suggests captain salary ~¥24M incl. commuting allowance. F/O Year 1 approx. ¥10M–¥12M. 30–50% lower than ANA mainline, but regular schedule is a plus.',
    ops:{routes:'KIX/OKA hub to major domestic airports. International: Seoul (ICN/PUS), Taiwan, Hong Kong, Kuala Lumpur. High aircraft utilization (10h+/day).',fleet:'A320-200, A321neo'},
    training:[
      {title:'A320 Type Rating',body:'Partial use of ANA Group training infrastructure. Ground → simulator → line training.'},
      {title:'Recurrent Checks',body:'Simulator proficiency checks 1–2x per year. JCAB-certified examiners.'},
      {title:'Captain Upgrade',body:'Assessment and vacancy-based upgrade. Upgrade opportunities vary in this LCC format.'},
      {title:'Single-Type Efficiency',body:'A320 family-only operation. High leg count on short routes builds solid experience quickly.'}
    ],
    benefits:[
      {icon:'✈️',title:'ANA Group Travel',body:'Employee discount tickets for ANA and Peach flights. Group-wide benefits.'},
      {icon:'🏥',title:'Health Insurance',body:'ANA Group or Peach health insurance. Medical exam support.'},
      {icon:'🏦',title:'Retirement Plan',body:'Defined contribution pension. Retirement benefits lower than ANA mainline.'},
      {icon:'📅',title:'Regular Schedule',body:'Domestic/short-haul routes mean relatively regular schedule. No extended overseas stays.'},
      {icon:'📋',title:'Loss of License',body:'Income replacement for loss of license.'},
      {icon:'🌸',title:'Kansai Base',body:'KIX-based. Major advantage for pilots residing in western Japan.'}
    ],
    hiringStatus:'Check official site',
    jobs:[
      {title:'Captain / First Officer — A320 Family',sub:'Domestic & short-haul international. KIX base.',status:'Check Official Page',statusTag:'gray',
        details:[{k:'License',v:'A320 type (ATPL/CPL+IR)'},{k:'Min. Hours',v:'Per official announcement'},{k:'Employment',v:'Full-time (permanent)'}],
        note:'* Check Peach official site for current hiring status. Also check ANA Group careers.'}
    ],
    recruitUrl:'https://www.flypeach.com/company/recruit/'
  },
  {
    file:'jetstar-japan.html', code:'GK', color:'#fb923c',
    nameEn:'Jetstar Japan',
    subtitle:'JAL/Qantas JV LCC. A320 on domestic and international routes.',
    tags:[{cls:'tag-blue',label:'🇯🇵 Japan'},{cls:'tag-green',label:'Hiring'},{cls:'tag-blue',label:'LCC'},{cls:'tag-gray',label:'JAL/Qantas Group'}],
    stats:[{val:'¥24M',label:'Capt. Salary (est.)'},{val:'¥15M',label:'F/O Salary (est.)'},{val:'A320',label:'Fleet'},{val:'Est. 2012',label:'Founded'}],
    overview:[
      'Jetstar Japan was established in 2012 as a joint venture between JAL, the Qantas Group, and Mitsubishi Corporation. Operating domestic routes from Narita, Kansai, and Chubu as its main bases.',
      'As part of the Jetstar global network (Qantas Group), pilots benefit from MyID staff travel on Jetstar and Qantas flights. Public data makes the F/O compensation structure relatively transparent.'
    ],
    facts:[{k:'HQ',v:'Narita, Chiba (NRT)'},{k:'Founded',v:'2012'},{k:'Parent',v:'JAL / Qantas Group'},{k:'Hubs',v:'NRT / KIX / NGO'},{k:'Fleet',v:'A320-200 / A321neo'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain',sub:'A320/A321',range:'¥20M–¥29M',avg:'¥24M',pct:100,note:'Estimated',noteTag:'gray'},
      {pos:'First Officer',sub:'Entry to senior',range:'¥13M–¥16M',avg:'¥15M',pct:63,note:'Sign-on bonus extra',noteTag:'green'},
    ],
    salaryNote:'💡 Public data: F/O monthly base ¥1.25M (gross), annual bonus 10%, sign-on bonus ~$10,000 (paid in 3 installments). Productivity pay adds ~$9,100/month equivalent.',
    ops:{routes:'Domestic network from NRT/KIX/NGO hubs. Domestic: Hokkaido, Kyushu, Okinawa. International: Cairns, Bali, Singapore. High utilization LCC model.',fleet:'A320-200, A321neo'},
    training:[
      {title:'A320 Type Rating',body:'Ground → simulator (JAL Group or external ATC) → initial operating experience (IOE).'},
      {title:'Jetstar Global Standards',body:'Training aligned with Qantas Group safety standards. Links to Jetstar Australia headquarters.'},
      {title:'Captain Upgrade',body:'Internal upgrade after F/O service. Relatively efficient process due to single aircraft family.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. JCAB-certified examiners.'}
    ],
    benefits:[
      {icon:'✈️',title:'MyID Staff Travel',body:'Discounted tickets on Jetstar, Qantas and Oneworld partners. International flights also available. Major perk.'},
      {icon:'💰',title:'Sign-On Bonus',body:'~$10,000 sign-on bonus paid in 3 installments upon joining.'},
      {icon:'📈',title:'Productivity Pay',body:'Variable pay based on flight hours. Income grows with more flying.'},
      {icon:'🏥',title:'Health Insurance',body:'Health insurance membership. Loss of license coverage.'},
      {icon:'📅',title:'Daily Allowance',body:'¥5,000/night domestic, ¥4,000/night international layover (tax-free).'},
      {icon:'🏦',title:'Retirement Plan',body:'Defined contribution pension. Tenure-based retirement benefit.'}
    ],
    hiringStatus:'Actively Hiring',
    jobs:[
      {title:'Captain — A320/A321',sub:'Domestic & international. NRT/KIX/NGO base.',status:'Open',statusTag:'green',
        details:[{k:'License',v:'A320 type (ATPL)'},{k:'Employment',v:'Full-time'},{k:'Base Options',v:'NRT / KIX / NGO (selectable)'}],
        note:'* See official careers site for full details.'},
      {title:'First Officer — A320/A321',sub:'F/O position.',status:'Open',statusTag:'green',
        details:[{k:'License',v:'CPL + IR (A320 type preferred)'},{k:'Sign-On',v:'~$10,000 (installments)'},{k:'English',v:'Aviation English certificate'}],
        note:''}
    ],
    recruitUrl:'https://career-jp.jetstar.com/'
  },
  {
    file:'spring-japan.html', code:'IJ', color:'#f87171',
    nameEn:'Spring Japan',
    subtitle:'JAL Group LCC. A320 on domestic routes and China-focused international routes.',
    tags:[{cls:'tag-blue',label:'🇯🇵 Japan'},{cls:'tag-gray',label:'Check Status'},{cls:'tag-blue',label:'LCC'},{cls:'tag-gray',label:'JAL Group'}],
    stats:[{val:'¥20M',label:'Capt. Salary (est.)'},{val:'¥12M',label:'F/O Salary (est.)'},{val:'A320',label:'Fleet'},{val:'Est. 2012',label:'Founded'}],
    overview:[
      'Spring Japan (春秋航空日本) was established in 2012 as a joint venture with China\'s Spring Airlines Group, now part of the JAL Group. Operating from Narita with domestic and China-focused international routes.',
      'One of the few Japanese LCCs with strong China route coverage. For pilots with Chinese language skills, this is a particularly unique career opportunity.'
    ],
    facts:[{k:'HQ',v:'Narita, Chiba (NRT)'},{k:'Founded',v:'2012'},{k:'Parent',v:'JAL Group'},{k:'Hub',v:'Narita (NRT)'},{k:'Fleet',v:'A320-200'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain',sub:'A320',range:'¥17M–¥25M',avg:'¥20M',pct:100,note:'Estimated',noteTag:'gray'},
      {pos:'First Officer',sub:'A320',range:'¥9M–¥14M',avg:'¥12M',pct:60,note:'Estimated',noteTag:'gray'},
    ],
    salaryNote:'💡 Limited public data on Spring Japan salaries. Estimates based on comparable Japan LCC carriers. Contact recruiting directly for actual figures.',
    ops:{routes:'NRT hub — domestic: Hiroshima, Takamatsu, Saga. International: Shanghai (PVG/SHA), Xi\'an, Wuhan and other China mainland cities.',fleet:'A320-200'},
    training:[
      {title:'A320 Type Rating',body:'Using JAL Group training infrastructure. Ground → simulator → line training.'},
      {title:'China Route Operations',body:'China route operations require awareness of Chinese airspace procedures. Chinese language ability is organizationally valued.'},
      {title:'Captain Upgrade',body:'Assessment-based upgrade. Small carrier may offer earlier upgrade opportunities.'},
      {title:'JAL Group Standards',body:'Safety management and quality aligned with JAL Group standards.'}
    ],
    benefits:[
      {icon:'✈️',title:'JAL Group Staff Travel',body:'Employee discount tickets for JAL Group airlines.'},
      {icon:'🏥',title:'Health Insurance',body:'Health insurance. Medical exam support.'},
      {icon:'🌏',title:'China Route Experience',body:'Rare opportunity to fly China mainland routes as a Japan-based LCC pilot. Unique career experience.'},
      {icon:'🏦',title:'Retirement Plan',body:'Defined contribution pension and retirement lump sum.'},
      {icon:'📋',title:'Loss of License',body:'Coverage for work and non-work loss of license.'},
      {icon:'📅',title:'International Allowance',body:'Daily allowance for China layovers.'}
    ],
    hiringStatus:'Check official site',
    jobs:[
      {title:'Captain / First Officer — A320',sub:'Domestic & China routes. Narita base.',status:'Check Official Page',statusTag:'gray',
        details:[{k:'License',v:'A320 type (ATPL/CPL+IR)'},{k:'Language',v:'Japanese required. ICAO Level 4+ English.'},{k:'Details',v:'See official page'}],
        note:'* Check Spring Japan official site and JAL Group careers page for current openings.'}
    ],
    recruitUrl:'https://www.springjapan.com/ja/recruit/'
  },
  {
    file:'united.html', code:'UAL', color:'#3d9bff',
    nameEn:'United Airlines',
    subtitle:"One of the US big-3. Widebody captain salary among the world's highest.",
    tags:[{cls:'tag-orange',label:'🇺🇸 USA'},{cls:'tag-green',label:'Actively Hiring'},{cls:'tag-orange',label:'Top Pay'},{cls:'tag-gray',label:'Star Alliance'}],
    stats:[{val:'~¥63M',label:'Capt. Avg (widebody)'},{val:'~¥39M',label:'F/O Avg'},{val:'~¥85M',label:'Capt. Max'},{val:'Star Alliance',label:'Alliance'}],
    overview:[
      'United Airlines, founded 1926, is a US major carrier. With hubs at Chicago (ORD), Denver (DEN), Houston (IAH), Newark (EWR), San Francisco (SFO), Washington (IAD), and Los Angeles (LAX), it serves six continents as a Star Alliance core member.',
      'Widebody captain pay is among the highest in the industry. Year 12+ captains on the B777 can earn about $569,000/year (~¥85M). Recent contract revisions significantly improved the pay structure.'
    ],
    facts:[{k:'HQ',v:'Chicago, Illinois'},{k:'Founded',v:'1926'},{k:'Alliance',v:'Star Alliance'},{k:'Main Hubs',v:'ORD/DEN/IAH/EWR+'},{k:'Fleet Size',v:'~800 aircraft'},{k:'Ret. Age',v:'65 (federal)'}],
    salaryRows:[
      {pos:'Captain Year 1',sub:'Narrowbody',range:'¥54M–¥63M',avg:'~¥54M',pct:64,color:'#3d9bff',note:'High from Day 1',noteTag:'blue'},
      {pos:'Captain Year 12 (B777)',sub:'Widebody peak',range:'¥63M–¥85M',avg:'~¥85M',pct:100,color:'#3d9bff',note:'Industry-leading',noteTag:'orange'},
      {pos:'First Officer Year 1',sub:'',range:'¥18M–¥39M',avg:'~¥18M',pct:21,color:'#5ec4ff',note:'Domestic start',noteTag:'gray'},
      {pos:'First Officer Year 12',sub:'',range:'¥39M–¥52M',avg:'~¥52M',pct:61,color:'#5ec4ff',note:'Int\'l F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 USD/JPY=150. Federal income tax (up to 37%) applies, but 401(k)/HSA tax advantages can maximize take-home. Routes include Japan (NRT/HND/OSA).',
    ops:{routes:'Global 6-continent network. Japan routes (NRT/HND/OSA). 7 major US hubs. Pacific routes to Japan, China, HK, Sydney. Domestic narrowbody, international widebody.',fleet:'B777-200/300, B787-8/9/10, B767-300ER, B737 MAX'},
    training:[
      {title:'New F/O Training',body:'Ground → simulator (Denver Training Center) → IOE. Fully paid training.'},
      {title:'Bidding System (Seniority)',body:'Seniority-based aircraft/route/base selection. More senior = more preferred choices.'},
      {title:'Captain Upgrade',body:'Typically 7–12 years. Depends on fleet demand and seniority. Check ride required before line ops.'},
      {title:'Advanced Qualification Program',body:'FAA-certified training program. Customized to individual competencies.'},
      {title:'United Aviate Academy',body:'Proprietary pilot pipeline. Military, university, and feeder school pathways.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. Support training available if needed.'}
    ],
    benefits:[
      {icon:'🏦',title:'401(k) Retirement Plan',body:'Company matching contributions available. Key tax-advantaged retirement tool.'},
      {icon:'💰',title:'Profit Sharing',body:'Company performance-based distribution. Can add 10%+ of annual salary in good years.'},
      {icon:'✈️',title:'Travel Privileges',body:'Free/discounted tickets for self, family, and pass riders. Star Alliance partners included.'},
      {icon:'🏥',title:'Medical/Dental/Vision',body:'Comprehensive family health insurance. Company HSA contributions included.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for work and non-work loss of license.'},
      {icon:'🎓',title:'Education Support',body:'Continuing education support. Children\'s scholarship program.'}
    ],
    hiringStatus:'Actively Hiring',
    jobs:[
      {title:'First Officer — All Aircraft',sub:'B737/B757/B767/B777/B787',status:'Actively Hiring',statusTag:'green',
        details:[{k:'License',v:'ATP Certificate (R-ATP accepted)'},{k:'Min. Hours',v:'1,500h (R-ATP: 1,000h)'},{k:'Work Auth.',v:'US Green Card or citizenship required'}],
        note:'* US work authorization required. United Aviate Academy pipeline also available. Thousands of hires planned in recent years.'}
    ],
    recruitUrl:'https://careers.united.com/us/en/c/pilot-jobs'
  },
  {
    file:'american.html', code:'AAL', color:'#f87171',
    nameEn:'American Airlines',
    subtitle:'Largest US carrier by passengers. Oneworld member. Top-tier pay.',
    tags:[{cls:'tag-orange',label:'🇺🇸 USA'},{cls:'tag-green',label:'Actively Hiring'},{cls:'tag-orange',label:'Top Pay'},{cls:'tag-gray',label:'Oneworld'}],
    stats:[{val:'~¥59M',label:'Capt. Avg'},{val:'~¥34M',label:'F/O Avg'},{val:'~¥86M',label:'Capt. Max'},{val:'World\'s Largest',label:'Passenger Volume'}],
    overview:[
      'American Airlines, founded 1930, has major hubs at Dallas (DFW), Charlotte (CLT), Philadelphia (PHL), and Miami (MIA). With routes to 50+ countries and 350+ cities, it\'s a Oneworld leader.',
      '2024 contract revisions pushed captain pay to industry-leading levels. Year 12 widebody captains earn about $573,000/year (~¥86M). ~1,500 pilot hires planned for 2026.'
    ],
    facts:[{k:'HQ',v:'Fort Worth, Texas'},{k:'Founded',v:'1930'},{k:'Alliance',v:'Oneworld'},{k:'Main Hubs',v:'DFW/CLT/PHL/MIA/LAX'},{k:'Fleet Size',v:'~950 aircraft'},{k:'Ret. Age',v:'65 (federal)'}],
    salaryRows:[
      {pos:'Captain Year 1',sub:'',range:'¥50M–¥59M',avg:'~¥50M',pct:58,color:'#f87171',note:'High from Day 1',noteTag:'orange'},
      {pos:'Captain Year 12 (Widebody)',sub:'',range:'¥59M–¥86M',avg:'~¥86M',pct:100,color:'#f87171',note:'Industry-leading',noteTag:'orange'},
      {pos:'First Officer Year 1',sub:'',range:'¥17M–¥34M',avg:'~¥17M',pct:20,color:'#fca5a5',note:'Domestic start',noteTag:'gray'},
      {pos:'First Officer Year 12',sub:'',range:'¥34M–¥53M',avg:'~¥53M',pct:62,color:'#fca5a5',note:'Int\'l F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 USD/JPY=150. Federal income tax applies. Maximize 401(k)/HSA to increase take-home. 1,500 pilot hires planned for 2026. Japan routes (NRT/HND/OSA).',
    ops:{routes:'DFW largest hub worldwide. Routes to Japan (NRT/HND/OSA), Europe, Asia Pacific, Latin America, Caribbean. Widebody international, narrowbody domestic.',fleet:'B777-300ER, B787-8/9, A321neo, B737 MAX'},
    training:[
      {title:'New F/O Training',body:'Fort Worth or Charlotte training centers. Ground → simulator → IOE. Fully paid.'},
      {title:'Bidding System (Seniority)',body:'Seniority-based aircraft/route/base selection system.'},
      {title:'Captain Upgrade',body:'Typically 7–12 years. Seniority and fleet vacancies drive timing. Check ride required.'},
      {title:'AA Training Center',body:'State-of-the-art facility adjacent to DFW HQ. Multiple latest-generation simulators.'},
      {title:'AA Cadet Academy',body:'Proprietary pilot development program with partner schools.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year.'}
    ],
    benefits:[
      {icon:'🏦',title:'401(k) Retirement Plan',body:'Company matching contributions. Key retirement vehicle.'},
      {icon:'💰',title:'Profit Sharing',body:'Performance-linked profit distribution. Significant bonus potential in good years.'},
      {icon:'✈️',title:'AAdvantage Travel',body:'Free/discounted tickets for self and family. Oneworld partner access.'},
      {icon:'🏥',title:'Medical/Dental/Vision',body:'Comprehensive family health insurance. HSA option.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for loss of license.'},
      {icon:'🎓',title:'Education Support',body:'Continuing education and children\'s scholarship programs.'}
    ],
    hiringStatus:'Actively Hiring',
    jobs:[
      {title:'First Officer — All Aircraft',sub:'B737/A321/B757/B767/B787/B777',status:'Actively Hiring',statusTag:'green',
        details:[{k:'License',v:'ATP Certificate'},{k:'Min. Hours',v:'1,500h (military/university: 1,000h)'},{k:'Work Auth.',v:'US Green Card or citizenship required'}],
        note:'* US work authorization required. AA Cadet Academy pathway available. 1,500 hires planned 2026.'}
    ],
    recruitUrl:'https://jobs.aa.com/go/Flight-Operations/7630600/'
  },
  {
    file:'southwest.html', code:'SWA', color:'#fbbf24',
    nameEn:'Southwest Airlines',
    subtitle:"Largest US LCC. B737-only operation with strong profit sharing.",
    tags:[{cls:'tag-orange',label:'🇺🇸 USA'},{cls:'tag-blue',label:'Hiring'},{cls:'tag-gray',label:'B737-Only LCC'}],
    stats:[{val:'~¥48M',label:'Capt. Avg Salary'},{val:'~¥26M',label:'F/O Avg'},{val:'15%',label:'Profit Share Cap'},{val:'B737 Only',label:'Single-Type'}],
    overview:[
      'Southwest Airlines, founded 1967, is the largest US LCC. Operating solely on B737 is its defining business model. Serving 107 US cities, it maintains top domestic passenger rankings.',
      'No widebody aircraft means no long-haul international, but training/maintenance costs are minimized and profit-sharing directly benefits pilots. 2026 average captain salary exceeds $321,000 (~¥48M).'
    ],
    facts:[{k:'HQ',v:'Dallas, Texas'},{k:'Founded',v:'1967'},{k:'Alliance',v:'None (independent)'},{k:'Cities Served',v:'107 US cities'},{k:'Fleet',v:'B737-700/800/MAX7/MAX8 only'},{k:'Ret. Age',v:'65 (federal)'}],
    salaryRows:[
      {pos:'Captain Year 1',sub:'B737',range:'¥41M–¥48M',avg:'~¥41M',pct:58,color:'#fbbf24',note:'High from Day 1',noteTag:'orange'},
      {pos:'Captain Year 12',sub:'B737 (uniform)',range:'¥48M–¥71M',avg:'~¥71M',pct:100,color:'#fbbf24',note:'+ Profit Sharing',noteTag:'green'},
      {pos:'First Officer Year 1',sub:'',range:'¥17M–¥26M',avg:'~¥17M',pct:24,color:'#fde68a',note:'',noteTag:'gray'},
      {pos:'First Officer Year 12',sub:'',range:'¥26M–¥40M',avg:'~¥40M',pct:56,color:'#fde68a',note:'Domestic F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 No widebody premium — seniority drives pay increases uniformly. Profit sharing (up to 15%) adds significant annual income. 2026 captain average $321,000 (~¥48M) before profit share.',
    ops:{routes:'107 US cities. Point-to-point model (no hub-and-spoke). Dallas (DAL), Chicago (MDW), Las Vegas (LAS), Denver (DEN) are main stations. High frequency, high utilization.',fleet:'B737-700, B737-800, B737 MAX 7, B737 MAX 8'},
    training:[
      {title:'B737 Single-Type Training',body:'Only B737 operated — type training once, no aircraft changes ever. Maximally efficient.'},
      {title:'Dallas Love Field Training Center',body:'State-of-the-art facility adjacent to Dallas HQ. Latest B737 simulators.'},
      {title:'Captain Upgrade',body:'Seniority-based. No aircraft change needed. Typically 7–12 years to upgrade.'},
      {title:'Point-to-Point Operations',body:'Short-haul, high-frequency flying builds high leg count and solid technical foundation.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year.'},
      {title:'Training Efficiency',body:'Single type keeps retraining costs low — benefit for both company and pilots.'}
    ],
    benefits:[
      {icon:'💰',title:'Profit Sharing',body:'Up to 15% of company profits shared with all employees including pilots. Recent years: hundreds of thousands yen per pilot.'},
      {icon:'🏦',title:'401(k) Retirement Plan',body:'Company matching contributions. Key retirement vehicle.'},
      {icon:'✈️',title:'Travel Privileges',body:'Free tickets for self, family, and 2 designated companions. All Southwest routes.'},
      {icon:'🏥',title:'Medical/Dental/Vision',body:'Comprehensive family health insurance.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for loss of license.'},
      {icon:'📅',title:'Regular Schedule',body:'Domestic-only means no overseas stays. Popular for work-life balance.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'First Officer — B737',sub:'Domestic (some short-haul international)',status:'Hiring',statusTag:'blue',
        details:[{k:'License',v:'ATP Certificate'},{k:'Min. Hours',v:'1,500h'},{k:'Work Auth.',v:'US Green Card or citizenship required'}],
        note:'* US work authorization required. Slightly reduced hiring pace post-2025, but ongoing. Check official careers page.'}
    ],
    recruitUrl:'https://careers.southwestair.com/pilot'
  },
  {
    file:'qatar-airways.html', code:'QR', color:'#f472b6',
    nameEn:'Qatar Airways',
    subtitle:'Doha-based Middle East major. Tax-free pay with generous housing & education allowances.',
    tags:[{cls:'tag-gold',label:'🇶🇦 Qatar'},{cls:'tag-green',label:'Actively Hiring'},{cls:'tag-green',label:'Zero Income Tax'},{cls:'tag-gray',label:'Oneworld'}],
    stats:[{val:'¥29M',label:'Capt. Salary (tax-free)'},{val:'¥21M',label:'F/O Salary (tax-free)'},{val:'0%',label:'Qatar Income Tax'},{val:'75h',label:'Monthly Hours Guarantee'}],
    overview:[
      'Qatar Airways, founded 1993, is the state-owned flag carrier of Qatar. Hubbing at Hamad International Airport (HIA) in Doha, it serves 160+ cities in 60+ countries as a Oneworld core member.',
      'Qatar has NO personal income tax — 100% of salary is take-home. Add housing, education, and transportation allowances and this becomes one of the most popular overseas destinations for Japanese pilots.'
    ],
    facts:[{k:'HQ',v:'Doha, Qatar'},{k:'Founded',v:'1993'},{k:'Hub',v:'Hamad Int\'l Airport (DOH)'},{k:'Destinations',v:'160+ cities'},{k:'Income Tax',v:'0% (all take-home)'},{k:'Ret. Age',v:'60 (ext. possible)'}],
    salaryRows:[
      {pos:'Captain (A380/B777/A350)',sub:'Senior widebody',range:'¥26M–¥48M',avg:'¥29M',pct:100,color:'#f472b6',note:'100% tax-free',noteTag:'green'},
      {pos:'First Officer',sub:'',range:'¥19M–¥27M',avg:'¥21M',pct:72,color:'#f9a8d4',note:'100% tax-free',noteTag:'green'},
    ],
    salaryNote:'💡 Captain base $9,300–$9,500/month + flying pay $32.95–$34/h (75h guaranteed). Housing allowance AED 3,600–4,100/month (~¥150K–170K) paid additionally. Zero tax.',
    ops:{routes:'Doha hub to 160+ cities worldwide. Japan (NRT/HND/OSA) direct flights. Africa, Middle East, South Asia, Europe, North America, Southeast Asia. All international routes.',fleet:'A380, B777-300ER, A350-900/1000, A321neo'},
    training:[
      {title:'Type Rating (Direct Entry)',body:'Qatar Airways Flight Training Center (QAFTC) in Doha. World-class modern facility.'},
      {title:'Life in Doha',body:'Doha is rapidly developing. English widely spoken. International schools and Japanese food available. Safe environment.'},
      {title:'Captain Upgrade',body:'Typically 3–7 years as F/O. Direct Entry Captains also actively recruited. Based on performance and vacancies.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. International-standard training quality.'},
      {title:'Hours Guarantee',body:'75h/month guaranteed. Basic pay protected even if below guarantee.'},
      {title:'Training Costs',body:'Company covers type rating on joining (bond applies). Departure before term triggers repayment obligation.'}
    ],
    benefits:[
      {icon:'🚫💰',title:'Zero Income Tax',body:'Qatar has no personal income tax. Entire salary is take-home. Worth millions of yen annually.'},
      {icon:'🏠',title:'Housing Allowance',body:'Captain: AED 4,100/month (~¥170K). F/O: AED 3,600/month (~¥150K). Company housing also available.'},
      {icon:'🎓',title:'Education Allowance',body:'Up to 3 children, up to age 21. Company subsidizes international school fees in Doha.'},
      {icon:'✈️',title:'Home Leave Tickets',body:'Annual confirmed home leave tickets (business class). Qatar/Oneworld discount tickets also available.'},
      {icon:'🚗',title:'Transportation Allowance',body:'USD 400/month transport allowance. Covers Doha commuting costs.'},
      {icon:'🏥',title:'Global Medical Insurance',body:'Worldwide medical/dental coverage for pilot and entire family.'}
    ],
    hiringStatus:'Actively Hiring',
    jobs:[
      {title:'Captain — A380/B777/A350 (Direct Entry)',sub:'Doha-based international captain.',status:'Actively Hiring',statusTag:'green',
        details:[{k:'Min. Hours',v:'3,000h PIC (type-rated preferred)'},{k:'English',v:'ICAO Level 4+'},{k:'Work Visa',v:'Sponsored by Qatar Airways'}],
        note:'* Japanese passport holders have been hired. Applications via recruitment agencies also common. Retirement age 60 (extension policy exists).'},
      {title:'First Officer — All Aircraft',sub:'Doha-based international F/O.',status:'Actively Hiring',statusTag:'green',
        details:[{k:'License',v:'ATPL (frozen) or CPL+IR'},{k:'Min. Hours',v:'1,500h+'},{k:'Monthly Guarantee',v:'75h'}],
        note:''}
    ],
    recruitUrl:'https://careers.qatarairways.com/qatarairways/go/Pilot-Jobs/8505700/'
  },
  {
    file:'etihad.html', code:'EY', color:'#34d399',
    nameEn:'Etihad Airways',
    subtitle:'Abu Dhabi flag carrier. Tax-free package on par with Emirates.',
    tags:[{cls:'tag-gold',label:'🇦🇪 UAE'},{cls:'tag-blue',label:'Hiring'},{cls:'tag-green',label:'Zero Income Tax'},{cls:'tag-gray',label:'Abu Dhabi Govt'}],
    stats:[{val:'¥34M',label:'Capt. Salary (tax-free)'},{val:'¥23M',label:'F/O Salary (tax-free)'},{val:'0%',label:'UAE Income Tax'},{val:'Abu Dhabi',label:'Base City'}],
    overview:[
      'Etihad Airways, founded 2003, is the UAE\'s Abu Dhabi-based national flag carrier. Hubbing at Abu Dhabi International Airport (AUH), it serves 80+ countries and 100+ cities.',
      'Like Emirates, UAE has ZERO personal income tax — full salary is take-home. Housing, education, and home leave allowances are comprehensive. The total package is comparable to Emirates.'
    ],
    facts:[{k:'HQ',v:'Abu Dhabi, UAE'},{k:'Founded',v:'2003'},{k:'Hub',v:'Abu Dhabi Int\'l (AUH)'},{k:'Destinations',v:'100+ cities'},{k:'Income Tax',v:'0% (all take-home)'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain (B787/A350/B777)',sub:'Senior widebody',range:'¥30M–¥60M',avg:'¥34M',pct:100,color:'#34d399',note:'100% tax-free',noteTag:'green'},
      {pos:'First Officer',sub:'',range:'¥19M–¥31M',avg:'¥23M',pct:68,color:'#6ee7b7',note:'100% tax-free',noteTag:'green'},
    ],
    salaryNote:'💡 AED/JPY≈41. UAE income tax = 0%. Housing + education + home leave allowances on top. Purchasing power ~1.8–2× equivalent Japanese salary.',
    ops:{routes:'AUH hub to 100+ cities. Japan (NRT/HND/NGO) direct flights. Africa, Europe, North America, Australia, South Asia. All international.',fleet:'B787-9/10, A350-1000, B777-300ER, A321neo'},
    training:[
      {title:'Type Rating (Direct Entry)',body:'Etihad Aviation Training (EAT) center in Abu Dhabi. State-of-the-art simulators.'},
      {title:'Life in Abu Dhabi',body:'Quieter than Dubai. English widely spoken. International schools and medical facilities available.'},
      {title:'Captain Upgrade',body:'Typically 4–8 years as F/O. Direct Entry Captains also actively recruited.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. International standard maintained.'},
      {title:'Training Costs',body:'Company-funded type rating. Bond applies — repayment if leaving early.'},
      {title:'Language Environment',body:'All operations in English. Multinational crew. International workplace.'}
    ],
    benefits:[
      {icon:'🚫💰',title:'Zero Income Tax',body:'UAE income tax = 0%. Full salary as take-home. Same tax advantage as Emirates.'},
      {icon:'🏠',title:'Housing Allowance',body:'Company housing or position-based housing allowance. Family accommodation supported.'},
      {icon:'🎓',title:'Education Allowance',body:'Children\'s education (international schools) subsidized. UAE has excellent school options.'},
      {icon:'✈️',title:'Home Leave Tickets',body:'Annual confirmed home leave tickets (business class). Etihad flights home.'},
      {icon:'🏥',title:'Medical/Dental Insurance',body:'Comprehensive global medical coverage for pilot and family.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for work and non-work loss of license.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'Captain — B787/A350/B777 (Direct Entry)',sub:'Abu Dhabi-based international captain.',status:'Hiring',statusTag:'blue',
        details:[{k:'Min. Hours',v:'3,000h PIC'},{k:'English',v:'ICAO Level 4+'},{k:'Work Visa',v:'Sponsored by Etihad Airways'}],
        note:'* UAE work visa sponsored by Etihad. Japanese passport holders hired. Recruitment agencies common route.'},
      {title:'First Officer — All Aircraft',sub:'Abu Dhabi-based international F/O.',status:'Hiring',statusTag:'blue',
        details:[{k:'License',v:'ATPL (frozen) or CPL+IR'},{k:'Min. Hours',v:'1,500h+'},{k:'Contract',v:'Fixed Term → Permanent'}],
        note:''}
    ],
    recruitUrl:'https://www.etihad.com/en/careers/pilots'
  },
  {
    file:'singapore-airlines.html', code:'SIA', color:'#a78bfa',
    nameEn:'Singapore Airlines',
    subtitle:"Asia's most awarded carrier. Excellent benefits and world-class training.",
    tags:[{cls:'tag-blue',label:'🇸🇬 Singapore'},{cls:'tag-blue',label:'Hiring'},{cls:'tag-gray',label:'Star Alliance'}],
    stats:[{val:'¥34M',label:'Capt. Salary'},{val:'¥19M',label:'F/O Salary (incl. allowances)'},{val:'SGD125/h',label:'Capt. Flying Pay'},{val:'Top-Rated',label:'Skytrax Awards'}],
    overview:[
      'Singapore Airlines (SIA), tracing its roots to 1947, is known as one of the world\'s premier full-service carriers. Hubbing at Singapore Changi Airport (SIN), it serves 35+ countries and 100+ cities as a Star Alliance core member.',
      'A record multiple Skytrax World\'s Best Airline winner, SIA offers top-tier training facilities and generous allowances. Singapore — English-speaking, low crime, Asian hub city — provides an excellent living environment.'
    ],
    facts:[{k:'HQ',v:'Singapore'},{k:'Founded',v:'1972 (current form)'},{k:'Hub',v:'Changi Airport (SIN)'},{k:'Destinations',v:'100+ cities'},{k:'Income Tax',v:'Up to 22% (lower than Japan)'},{k:'Ret. Age',v:'62 (re-employment available)'}],
    salaryRows:[
      {pos:'Captain (Senior)',sub:'Widebody international',range:'¥28M–¥42M',avg:'¥34M',pct:100,color:'#a78bfa',note:'+ flying pay',noteTag:'blue'},
      {pos:'First Officer',sub:'Incl. allowances',range:'¥11M–¥23M',avg:'¥19M',pct:56,color:'#c4b5fd',note:'Incl. long-haul allowance',noteTag:'blue'},
    ],
    salaryNote:'💡 SGD/JPY≈112. Singapore income tax max 22% — lower than Japan. Flying pay (Capt SGD125/h, F/O SGD82/h) added on top of base. Japan routes: NRT/HND/OSA/NGO/FUK/CTS.',
    ops:{routes:'SIN hub to 100+ cities. Japan routes most frequent among Asian carriers. Australia, Europe, North America, Middle East, South Asia. All international (no domestic in Singapore).',fleet:'A380, A350-900/1000, B777-300ER, B737-8 MAX'},
    training:[
      {title:'Type Rating',body:'SIA Flight Training Centre (FTC) in Singapore. World-class simulator facilities.'},
      {title:'Direct Entry Captain / F/O',body:'Experienced pilot direct entry recruitment. Line operations begin after type rating.'},
      {title:'Captain Upgrade',body:'12+ years as F/O guideline. Pure seniority system — predictable if slow.'},
      {title:'Training Quality',body:'Industry-leading safety and training standards. IOSA certified. Strong CRM training culture.'},
      {title:'Life in Singapore',body:'English-speaking clean city-state. Excellent public transport. High medical standards. Japanese community present.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. High technical standards required.'}
    ],
    benefits:[
      {icon:'✈️',title:'SQ Staff Travel',body:'Singapore Airlines staff discount/free tickets for self and family. Star Alliance partners included.'},
      {icon:'🏥',title:'Medical/Dental Insurance',body:'Comprehensive medical coverage. Singapore healthcare is top-tier.'},
      {icon:'🏦',title:'CPF (Central Provident Fund)',body:'Singapore mandatory retirement savings. Company contributes. Solid retirement foundation.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for work and non-work loss of license.'},
      {icon:'🎓',title:'Education Allowance',body:'Children\'s education subsidized. Singapore international schools are world-class.'},
      {icon:'🌟',title:'Prestige',body:'Flying for perennially top-rated airline carries significant career brand value.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'Direct Entry Captain / First Officer',sub:'Singapore-based international operations.',status:'Hiring',statusTag:'blue',
        details:[{k:'Min. Hours',v:'Capt 3,000h / F/O 1,500h+'},{k:'English',v:'ICAO Level 4+'},{k:'Work Visa',v:'Employment Pass (SIA-sponsored)'}],
        note:'* Singapore Employment Pass sponsored by SIA. Check SIA official careers for current openings.'}
    ],
    recruitUrl:'https://www.singaporeair.com/en_UK/sg/flying-with-us/careers/'
  },
  {
    file:'cathay-pacific.html', code:'CX', color:'#5ec4ff',
    nameEn:'Cathay Pacific',
    subtitle:'Hong Kong flag carrier. Strict seniority with comprehensive allowances.',
    tags:[{cls:'tag-blue',label:'🇭🇰 Hong Kong'},{cls:'tag-blue',label:'Hiring'},{cls:'tag-gray',label:'Oneworld'}],
    stats:[{val:'¥36M',label:'Capt. Salary'},{val:'¥24M',label:'F/O Salary'},{val:'HK',label:'Base (HKD)'},{val:'Oneworld',label:'Alliance'}],
    overview:[
      'Cathay Pacific, founded 1946, is the Hong Kong flag carrier. Hubbing at Hong Kong International Airport (HKG), it serves 60+ countries and 100+ cities as a Oneworld core member.',
      'Promotions are on pure seniority — typically 12+ years to captain. While slower, the system is transparent and predictable. Direct Entry F/O hiring is active and pick-up pace has recovered in 2025–2026.'
    ],
    facts:[{k:'HQ',v:'Hong Kong (HKG)'},{k:'Founded',v:'1946'},{k:'Hub',v:'Hong Kong Int\'l (HKG)'},{k:'Destinations',v:'100+ cities'},{k:'Income Tax',v:'Up to 17% (low)'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain Capt.4 (Senior)',sub:'B777/A350 widebody',range:'¥36M–¥57M',avg:'~¥57M',pct:100,color:'#5ec4ff',note:'+ productivity pay',noteTag:'blue'},
      {pos:'Captain Capt.1 (New)',sub:'',range:'¥30M–¥36M',avg:'~¥30M',pct:53,color:'#5ec4ff',note:'Just upgraded',noteTag:'gray'},
      {pos:'First Officer FO2',sub:'',range:'¥24M–¥32M',avg:'~¥32M',pct:56,color:'#93c5fd',note:'Incl. productivity',noteTag:'blue'},
      {pos:'First Officer FO1 (New)',sub:'',range:'¥18M–¥24M',avg:'~¥18M',pct:32,color:'#93c5fd',note:'',noteTag:'gray'},
    ],
    salaryNote:'💡 HKD/JPY≈19. Hong Kong income tax max 17% — among the lowest in major cities. Productivity pay (HKD 3,000–5,000/month) and layover allowances added.',
    ops:{routes:'HKG hub to 100+ cities. Japan (NRT/HND/OSA/NGO/FUK) frequent direct flights. Europe, North America, Australia, Middle East, Southeast Asia, South Asia. All international.',fleet:'A350-900/1000, B777-300ER, B777-200, A321neo'},
    training:[
      {title:'Type Rating',body:'Cathay Pacific City training center adjacent to HKG. Latest generation simulators.'},
      {title:'Pure Seniority System',body:'All upgrades, aircraft bids, and schedule bids decided purely by seniority number. Transparent.'},
      {title:'Second Officer (SO) Program',body:'Low-hours entry via SO position. Experience accumulates before F/O promotion.'},
      {title:'Captain Upgrade (Command)',body:'Typically 12–16+ years. Pure seniority-based — predictable given company size and demand.'},
      {title:'Recurrent Checks',body:'Proficiency checks 1–2x per year. Civil Aviation Department (CAD) standards.'},
      {title:'Life in Hong Kong',body:'English is one of two official languages. Japanese food and community available. High living costs are a challenge.'}
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount/free tickets for self and family. Cathay Pacific and Oneworld partners.'},
      {icon:'🏥',title:'Medical/Dental Insurance',body:'Comprehensive family health coverage. Hong Kong high-standard medical facilities.'},
      {icon:'🏦',title:'MPF (Mandatory Provident Fund)',body:'Hong Kong mandatory retirement savings. Company 5% + personal 5%.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement for loss of license.'},
      {icon:'🎓',title:'Education Allowance',body:'Children\'s education subsidy (conditions apply). International schools world-class.'},
      {icon:'📅',title:'Annual Leave',body:'21–35 days annual leave depending on rank. Increases with seniority.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'Direct Entry First Officer (DEFO)',sub:'Hong Kong-based international F/O.',status:'Hiring',statusTag:'blue',
        details:[{k:'License',v:'Valid ATPL or equivalent foreign license'},{k:'Min. Hours',v:'1,500h+ multi-engine IFR'},{k:'Process',v:'App → Online interview → Sim assessment → HK interview'}],
        note:'* As of Nov 2025, online interviews ongoing; simulator assessment planned for Jan 2026. Contact: flightcrew_recruitment@cathaypacific.com'},
      {title:'Second Officer (SO)',sub:'Low-hours entry route.',status:'Check Status',statusTag:'gray',
        details:[{k:'License',v:'Frozen ATPL or CPL+IR'},{k:'Est. Hours',v:'250–500h'},{k:'Progression',v:'SO experience → F/O promotion'}],
        note:''}
    ],
    recruitUrl:'https://www.cathaypacific.com/cx/en_HK/careers/work-at-cathay/roles/cabin-crew.html'
  },
  {
    file:'lufthansa.html', code:'LH', color:'#a78bfa',
    nameEn:'Lufthansa',
    subtitle:"Europe's largest aviation group. 5% pay raise implemented January 2026.",
    tags:[{cls:'tag-green',label:'🇩🇪 Germany'},{cls:'tag-blue',label:'Hiring'},{cls:'tag-gray',label:'Star Alliance'}],
    stats:[{val:'~¥34M',label:'Capt. Avg Salary'},{val:'~¥19M',label:'F/O Avg Salary'},{val:'EUR266,500',label:'Senior Capt. Annual'},{val:'Star Alliance',label:'Alliance'}],
    overview:[
      'Lufthansa (Deutsche Lufthansa AG), founded 1926, is the German flag carrier and Europe\'s largest aviation group. Hubs at Frankfurt (FRA) and Munich (MUC). A founding Star Alliance member.',
      'Group includes Swiss International Air Lines, Austrian Airlines, Brussels Airlines, and Eurowings. Following union (Vereinigung Cockpit) negotiations 2024–2026, a 5% pay increase took effect January 2026, pushing senior captain pay to EUR 266,500–279,500.'
    ],
    facts:[{k:'HQ',v:'Frankfurt, Germany'},{k:'Founded',v:'1926'},{k:'Alliance',v:'Star Alliance'},{k:'Main Hubs',v:'Frankfurt (FRA) / Munich (MUC)'},{k:'Income Tax',v:'Up to 45% (high)'},{k:'Ret. Age',v:'65'}],
    salaryRows:[
      {pos:'Captain Year 1 (New Upgrade)',sub:'EUR153,000/yr',range:'¥25M–¥34M',avg:'~¥25M',pct:58,color:'#a78bfa',note:'New captain',noteTag:'gray'},
      {pos:'Captain Year 20 (Senior)',sub:'EUR265,000/yr',range:'¥34M–¥43M',avg:'~¥43M',pct:100,color:'#a78bfa',note:'Post Jan 2026 +5%',noteTag:'green'},
      {pos:'First Officer Year 10',sub:'EUR185,000/yr',range:'¥19M–¥30M',avg:'~¥30M',pct:70,color:'#c4b5fd',note:'',noteTag:'blue'},
      {pos:'First Officer Year 1',sub:'EUR77,000/yr',range:'¥13M–¥19M',avg:'~¥13M',pct:30,color:'#c4b5fd',note:'',noteTag:'gray'},
    ],
    salaryNote:'💡 EUR/JPY≈163. Germany has high income tax (up to 45%). However, international layover per diem (EUR60–70/day, tax-free) adds EUR8,000–12,000/year for long-haul crews.',
    ops:{routes:'FRA/MUC hubs to Europe, worldwide. Japan (NRT/HND/OSA) direct flights. European short/medium via Eurowings. Long-haul to Americas, Asia, Africa, Middle East.',fleet:'B747-8, A340/A380 (partial), A350-900, A320/A321neo'},
    training:[
      {title:'Lufthansa Aviation Training (LAT)',body:'One of the largest aviation training organizations in the world. Centers in Frankfurt, Munich, and more.'},
      {title:'Ab Initio Program',body:'Zero-to-ATPL cadet program. Initial training at partner schools across Europe.'},
      {title:'Type Rating (Direct Entry)',body:'Experienced pilot type rating. Entry position based on flight experience.'},
      {title:'Captain Upgrade',body:'Combination of seniority and performance assessment. Typically 8–15 years as F/O.'},
      {title:'Vereinigung Cockpit (VC)',body:'German pilot union. Negotiated the 2024–2026 pay increases. Collective bargaining agreement.'},
      {title:'Recurrent Checks',body:'EASA-standard proficiency checks. 1–2x per year.'}
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Lufthansa Group discount tickets for self and family. Star Alliance partial access.'},
      {icon:'🏥',title:'German Social Insurance',body:'Germany\'s comprehensive public health insurance and pension system. Strong social safety net.'},
      {icon:'🏦',title:'Company Pension',body:'Supplemental company pension on top of German public pension. Stable retirement income.'},
      {icon:'💼',title:'European Lifestyle',body:'Frankfurt and Munich offer excellent infrastructure. Public transport developed. German language learning recommended.'},
      {icon:'📋',title:'Loss of License Insurance',body:'Income replacement per German law.'},
      {icon:'📅',title:'Annual Leave',body:'European-standard generous annual leave (30+ days). Strong work-life balance culture.'}
    ],
    hiringStatus:'Hiring',
    jobs:[
      {title:'First Officer (Direct Entry)',sub:'Frankfurt / Munich base.',status:'Hiring',statusTag:'blue',
        details:[{k:'License',v:'EASA ATPL or equivalent'},{k:'Min. Hours',v:'1,500h+ multi-engine IFR'},{k:'Work Auth.',v:'EU/EFTA citizenship or work visa required'}],
        note:'* Non-EU/EFTA applicants need work authorization. Apply via Lufthansa Group careers. German language helpful but not mandatory.'}
    ],
    recruitUrl:'https://lufthansagroup.careers/en/jobs/?q=pilot'
  },
];

/* ═══════════════════════════════════════════════════
   AIRLINE DATA — gen_asia.mjs (22 airlines)
   ═══════════════════════════════════════════════════ */

const airlines_asia = [
  {
    file:'korean-air.html', code:'KAL', color:'#0032A0',
    nameEn:'Korean Air',
    subtitle:'South Korea\'s largest airline. SkyTeam founding member.',
    tags:[{cls:'tag-blue',label:'🇰🇷 Korea'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'International'}],
    stats:[{val:'¥19M–¥36M',label:'Capt. Salary (pre-tax)'},{val:'¥9M–¥18M',label:'F/O Salary (pre-tax)'},{val:'160+ aircraft',label:'Fleet Size'},{val:'120+ cities',label:'Network'}],
    overview:'Korean Air, founded 1969, is South Korea\'s largest international carrier. Hubbing at Incheon International Airport, it serves 120+ cities in the Americas, Europe, Asia, and the Middle East. A SkyTeam founding member, it has been pursuing a merger with Asiana Airlines (2024–2026).',
    facts:[{k:'HQ',v:'Seoul, South Korea'},{k:'Hub',v:'Incheon Int\'l (ICN)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1969'},{k:'Fleet',v:'160+ aircraft'},{k:'Income Tax',v:'Yes (Korea)'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l widebody',range:'¥19M–¥36M',avg:'¥28M',pct:100,note:'KRW+USD allowances',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & int\'l',range:'¥9M–¥18M',avg:'¥12M',pct:44,note:'Varies by seniority',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Korean income tax max 42%. International crew receive FX allowances. Reference values based on Glassdoor 2025 data.',
    ops:{routes:'ICN hub to Americas (NY, LA, Seattle), Europe (London, Paris, Frankfurt), SE Asia, Middle East, Oceania. Extensive Japan routes (NRT/HND/KIX).',fleet:'B777-200ER/300ER, B787-9, B737-8/9, A220-300, A321neo'},
    training:[
      {title:'Type Rating (CAAK Standards)',body:'Type training at CAA Korea-approved ATCs. Ground → simulator → LIFUS. Standard ICAO-based process.'},
      {title:'LIFUS (Line Training)',body:'Post-type-rating supervised line flying. Typically 50–75 legs.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAK requirements.'},
      {title:'Captain Upgrade',body:'Seniority-based. After meeting F/O hours and passing internal assessments.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discounted/standby tickets for self and family. SkyTeam partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Comprehensive medical coverage for pilot and family. Loss of license insurance.'},
      {icon:'💰',title:'Performance Bonus',body:'Annual performance-linked bonus (2–4 months typical).'},
      {icon:'📅',title:'Annual Leave',body:'20–30 days. Long-haul crews receive recovery leave.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension or defined contribution plan.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers by city tier.'},
    ],
    hiringStatus:'Foreign pilot hiring limited as of March 2026. Check official recruiting page.',
    hiringColor:'#6b7d93',
    jobs:[
      {title:'Captain / First Officer (Regular Recruitment)',sub:'Domestic & international. ICN base.',status:'Check Official Page',statusTag:'gray',
        details:[{k:'License',v:'ATPL/CPL (ICAO mutual recognition)'},{k:'English',v:'ICAO Level 4+'},{k:'Min. Hours',v:'Capt 5,000h / F/O 1,500h (guideline)'},{k:'Employment',v:'Full-time'}],
        note:'* Foreign pilot conditions vary. Always check official careers page.'},
    ],
    recruitUrl:'https://www.koreanair.com/kr/ko/careers',
  },
  {
    file:'eva-air.html', code:'EVA', color:'#00A599',
    nameEn:'EVA Air',
    subtitle:"Taiwan's 2nd largest carrier. Star Alliance member. 5-star service.",
    tags:[{cls:'tag-green',label:'🇹🇼 Taiwan'},{cls:'tag-blue',label:'Star Alliance'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'5-Star Rated'}],
    stats:[{val:'¥18M–¥28M',label:'Capt. Salary (est.)'},{val:'¥9M–¥15M',label:'F/O Salary (est.)'},{val:'~90 aircraft',label:'Fleet Size'},{val:'60+ cities',label:'Destinations'}],
    overview:'EVA Air, founded 1989, is Taiwan\'s second largest international carrier. Consistently rated Skytrax 5-Star, it operates long-haul routes to North America and Europe plus short-haul Asian routes. A Star Alliance member with global connectivity. Has a history of hiring foreign pilots.',
    facts:[{k:'HQ',v:'Taipei, Taiwan'},{k:'Hub',v:'Taoyuan Int\'l Airport (TPE)'},{k:'Alliance',v:'Star Alliance'},{k:'Founded',v:'1989'},{k:'Fleet',v:'~90 aircraft'},{k:'Income Tax',v:'Yes (Taiwan)'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l (B777/B787)',range:'¥18M–¥28M',avg:'¥22M',pct:100,note:'TWD+USD allowances',noteTag:'green'},
      {pos:'First Officer',sub:'International',range:'¥9M–¥15M',avg:'¥12M',pct:55,note:'Seniority-based',noteTag:'gray'},
    ],
    salaryNote:'💡 TWD/JPY≈4.5, USD/JPY=150. Taiwan income tax up to 40%. Foreign pilots typically offered USD-denominated special contracts.',
    ops:{routes:'TPE hub to Americas (NY, Chicago, LA), Europe (Vienna, Amsterdam), SE Asia, Japan, Korea.',fleet:'B787-9/10, B777-300ER, B777F, A321neo'},
    training:[
      {title:'Type Rating (ICAO/CAA)',body:'Type training at approved ATCs. Ground → simulator → LIFUS. Standard ICAO-based process.'},
      {title:'LIFUS',body:'Post-type-rating supervised line operations. Typically 50–75 legs.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAA Taiwan standards.'},
      {title:'Captain Upgrade',body:'Seniority-based. Internal assessment + vacancy-dependent.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount/standby tickets for self and family. Star Alliance partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Comprehensive family medical coverage. Loss of license insurance.'},
      {icon:'🌟',title:'5-Star Environment',body:'Skytrax 5-Star rated workplace. High-quality service standards.'},
      {icon:'💰',title:'Performance Bonus',body:'Annual performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension plan.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign captain hiring on irregular basis. Check official site.',
    hiringColor:'#f5c842',
    jobs:[
      {title:'Captain — B777/B787',sub:'Int\'l widebody captain.',status:'Irregular Hiring',statusTag:'blue',
        details:[{k:'License',v:'ATPL (ICAO-compliant)'},{k:'Min. Hours',v:'5,000h PIC (widebody preferred)'},{k:'English',v:'ICAO Level 4+'},{k:'Contract',v:'Taiwan employment or special contract'}],note:''},
    ],
    recruitUrl:'https://www.evaair.com/en-global/about-eva-air/careers/',
  },
  {
    file:'china-airlines.html', code:'CAL', color:'#D00027',
    nameEn:'China Airlines',
    subtitle:"Taiwan's flag carrier. SkyTeam member.",
    tags:[{cls:'tag-red',label:'🇹🇼 Taiwan'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥17M–¥27M',label:'Capt. Salary (est.)'},{val:'¥8M–¥14M',label:'F/O Salary (est.)'},{val:'~90 aircraft',label:'Fleet'},{val:'50+ cities',label:'Destinations'}],
    overview:'China Airlines (CAL) is Taiwan\'s flag carrier. Hubbing at Taoyuan Int\'l Airport, it serves Americas, Europe, Asia, and Oceania. Note: despite the name, this is the carrier of Taiwan (Republic of China), not Mainland China (PRC). A major freighter operator as well.',
    facts:[{k:'HQ',v:'Taipei, Taiwan'},{k:'Hub',v:'Taoyuan Int\'l Airport (TPE)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1959'},{k:'Fleet',v:'~89 aircraft'},{k:'Income Tax',v:'Yes (Taiwan)'}],
    salaryRows:[
      {pos:'Captain',sub:'International',range:'¥17M–¥27M',avg:'¥21M',pct:100,note:'TWD+allowances',noteTag:'red'},
      {pos:'First Officer',sub:'International',range:'¥8M–¥14M',avg:'¥11M',pct:52,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 TWD/JPY≈4.5. Foreign hire may offer USD-denominated special contracts.',
    ops:{routes:'TPE/KHH hubs to Americas (LA, NY), Europe (Amsterdam), SE Asia, Japan, Oceania.',fleet:'B777-300ER, B787-9, A350-900, B737-800'},
    training:[
      {title:'Type Rating',body:'CAA Taiwan-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line operations post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year.'},
      {title:'Captain Upgrade',body:'Seniority + internal assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount/standby tickets. SkyTeam partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Comprehensive family coverage.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked annual bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension plan.'},
      {icon:'📅',title:'Annual Leave',body:'20–30 days + recovery leave for long-haul.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign pilot hiring on irregular basis. Check official site.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Pilot (Regular Recruitment)',sub:'International routes.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Experience',v:'Widebody experience preferred'}],note:''}],
    recruitUrl:'https://www.china-airlines.com/au/en/fly/about-china-airlines/jobs/pilot',
  },
  {
    file:'starlux.html', code:'JX', color:'#2C5DE5',
    nameEn:'STARLUX Airlines',
    subtitle:'Taiwan\'s premium new carrier. Launch 2020. Active expansion.',
    tags:[{cls:'tag-blue',label:'🇹🇼 Taiwan'},{cls:'tag-gold',label:'Premium Carrier'},{cls:'tag-orange',label:'New Carrier'},{cls:'tag-blue',label:'Independent'}],
    stats:[{val:'¥22M–¥32M',label:'Capt. Salary (est.)'},{val:'¥10M–¥16M',label:'F/O Salary (est.)'},{val:'~25 aircraft',label:'Fleet'},{val:'Est. 2020',label:'Launch Year'}],
    overview:'STARLUX Airlines launched in January 2020 as a Taiwan premium independent carrier. Founded by former EVA Air Group CEO. Offering premium service on medium and long-haul routes, it opened North American routes (LA, etc.) with A350-900 in 2024. Actively hiring pilots in its growth phase.',
    facts:[{k:'HQ',v:'Taipei, Taiwan'},{k:'Hub',v:'Taoyuan Int\'l Airport (TPE)'},{k:'Founded',v:'2018 (ops 2020)'},{k:'Alliance',v:'None (independent)'},{k:'Fleet',v:'A321neo, A350-900'},{k:'Phase',v:'Expansion'}],
    salaryRows:[
      {pos:'Captain',sub:'A350/A321 international',range:'¥22M–¥32M',avg:'¥26M',pct:100,note:'Premium positioning',noteTag:'blue'},
      {pos:'First Officer',sub:'International',range:'¥10M–¥16M',avg:'¥13M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 TWD/JPY≈4.5. STARLUX offers competitive compensation as a premium carrier. Verify at time of recruitment.',
    ops:{routes:'TPE hub to Asia (Tokyo, Osaka, Seoul, Bangkok, Singapore), North America (LA, SF, Seattle).',fleet:'A321neo (medium-haul), A350-900 (long-haul North America)'},
    training:[
      {title:'Type Rating (A321/A350)',body:'Airbus-certified ATC type training. New airline with cutting-edge training setup.'},
      {title:'Premium Service Training',body:'STARLUX proprietary premium service standards training.'},
      {title:'LIFUS / OPC',body:'Standard post-type-rating line training and recurrent proficiency checks.'},
      {title:'Upgrade Opportunity',body:'As a young airline, early advancement to senior roles is possible.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'STARLUX employee discount travel. Growing network means more opportunities.'},
      {icon:'💼',title:'Premium Environment',body:'Flying for a top-rated premium carrier provides distinctive career brand value.'},
      {icon:'📈',title:'Growth Opportunity',body:'New carrier means early senior role and upgrade opportunities.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
    ],
    hiringStatus:'Actively hiring in expansion phase (March 2026). Foreign captain hiring confirmed.',
    hiringColor:'#34d399',
    jobs:[
      {title:'Captain — A350-900',sub:'Long-haul North America captain.',status:'Hiring (Check Status)',statusTag:'green',
        details:[{k:'License',v:'ATPL (ICAO mutual recognition)'},{k:'Experience',v:'Widebody captain preferred'},{k:'English',v:'ICAO Level 4+'}],note:''},
      {title:'First Officer — A321neo/A350',sub:'Short-haul and long-haul routes.',status:'Hiring (Check Status)',statusTag:'green',
        details:[{k:'License',v:'CPL/ATPL'},{k:'English',v:'ICAO Level 4+'}],note:''},
    ],
    recruitUrl:'https://www.starlux-airlines.com/en-TW/about/career',
  },
  {
    file:'thai-airways.html', code:'TG', color:'#6B1F7C',
    nameEn:'Thai Airways International',
    subtitle:'Thailand flag carrier. Star Alliance member. Post-restructure.',
    tags:[{cls:'tag-blue',label:'🇹🇭 Thailand'},{cls:'tag-blue',label:'Star Alliance'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥14M–¥25M',label:'Capt. Salary (est.)'},{val:'¥7M–¥13M',label:'F/O Salary (est.)'},{val:'~80 aircraft',label:'Fleet'},{val:'70+ cities',label:'Destinations'}],
    overview:'Thai Airways International (THAI) is Thailand\'s flag carrier. Hubbing at Bangkok Suvarnabhumi Airport, it serves a wide network to Europe, Northeast Asia, and South Asia. After filing for business reorganization in 2020 and completing it in 2024, THAI is rebuilding its network with improved finances.',
    facts:[{k:'HQ',v:'Bangkok, Thailand'},{k:'Hub',v:'Suvarnabhumi Airport (BKK)'},{k:'Alliance',v:'Star Alliance'},{k:'Founded',v:'1960'},{k:'Status',v:'Post-restructure (2024)'},{k:'Income Tax',v:'Yes (Thailand)'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l widebody',range:'¥14M–¥25M',avg:'¥19M',pct:100,note:'USD+THB allowances',noteTag:'blue'},
      {pos:'First Officer',sub:'International',range:'¥7M–¥13M',avg:'¥9.5M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150, THB/JPY≈4.3. Foreign pilots often on USD-denominated contracts. Compensation improving post-restructure.',
    ops:{routes:'Bangkok hub to Europe (London, Frankfurt, Paris), Japan (NRT, HND), East Asia, South Asia.',fleet:'B777-200/300ER, B787-8/9, A350-900'},
    training:[
      {title:'Type Rating (ICAO/CAAT)',body:'Thailand CAAT-approved training. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating. ~50–75 legs.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAT.'},
      {title:'Captain Upgrade',body:'Seniority + performance assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount/standby tickets. Star Alliance partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'📅',title:'Annual Leave',body:'20–30 days.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension plan.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Restructuring phase. Hiring limited. Check official site.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Pilot Recruitment',sub:'Check official site for current openings.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'English',v:'ICAO Level 4+'}],note:''}],
    recruitUrl:'https://www.thaiairways.com/en_TH/about_thai/about/career.page',
  },
  {
    file:'malaysia-airlines.html', code:'MH', color:'#003580',
    nameEn:'Malaysia Airlines',
    subtitle:'Malaysia flag carrier. Oneworld member.',
    tags:[{cls:'tag-blue',label:'🇲🇾 Malaysia'},{cls:'tag-gold',label:'Oneworld'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥13M–¥23M',label:'Capt. Salary (est.)'},{val:'¥6M–¥12M',label:'F/O Salary (est.)'},{val:'~80 aircraft',label:'Fleet'},{val:'50+ cities',label:'Destinations'}],
    overview:'Malaysia Airlines (MAB) hubs at Kuala Lumpur International Airport. Post the 2014 dual tragedies (MH370, MH17), the airline restructured and continues operations today as a Oneworld member. Has a history of foreign captain recruitment.',
    facts:[{k:'HQ',v:'Kuala Lumpur, Malaysia'},{k:'Hub',v:'Kuala Lumpur Int\'l (KUL)'},{k:'Alliance',v:'Oneworld'},{k:'Founded',v:'1947'},{k:'Status',v:'Post-restructure'},{k:'Income Tax',v:'Yes (Malaysia)'}],
    salaryRows:[
      {pos:'Captain',sub:'International',range:'¥13M–¥23M',avg:'¥17M',pct:100,note:'MYR+USD allowances',noteTag:'blue'},
      {pos:'First Officer',sub:'International',range:'¥6M–¥12M',avg:'¥8.5M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 MYR/JPY≈33, USD/JPY=150. Foreign hires may receive USD-denominated contracts.',
    ops:{routes:'KL hub to Japan, China, SE Asia, Europe (London), Australia.',fleet:'A330-200/300, A350-900, B737-800 MAX'},
    training:[
      {title:'Type Rating',body:'CAAM (Malaysia) approved ATC. Standard ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line flying post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year.'},
      {title:'Captain Upgrade',body:'Seniority + assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. Oneworld partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign pilot hiring on irregular basis. Check official site.',
    hiringColor:'#f5c842',
    jobs:[{title:'Direct Entry Captain',sub:'Int\'l widebody.',status:'Irregular Hiring',statusTag:'blue',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Experience',v:'5,000h+ widebody'}],note:''}],
    recruitUrl:'https://www.malaysiaairlines.com/my/en/site/careers.html',
  },
  {
    file:'garuda-indonesia.html', code:'GA', color:'#00843D',
    nameEn:'Garuda Indonesia',
    subtitle:'Indonesia flag carrier. SkyTeam member. Post-restructure.',
    tags:[{cls:'tag-green',label:'🇮🇩 Indonesia'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥11M–¥19M',label:'Capt. Salary (est.)'},{val:'¥5M–¥11M',label:'F/O Salary (est.)'},{val:'~65 aircraft',label:'Fleet'},{val:'50+ cities',label:'Destinations'}],
    overview:'Garuda Indonesia, founded 1949, is Indonesia\'s state flag carrier. Hubbing at Jakarta Soekarno-Hatta Airport, it operates domestic and international routes. Completed financial restructuring in 2022. Former Skytrax 5-Star recipient.',
    facts:[{k:'HQ',v:'Jakarta, Indonesia'},{k:'Hub',v:'Soekarno-Hatta (CGK)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1949'},{k:'Owner',v:'Indonesian Government'},{k:'Income Tax',v:'Yes (Indonesia)'}],
    salaryRows:[
      {pos:'Captain',sub:'International',range:'¥11M–¥19M',avg:'¥15M',pct:100,note:'USD+IDR allowances',noteTag:'green'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥5M–¥11M',avg:'¥7.5M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign pilots often offered USD contracts. Verify current compensation with recruiter.',
    ops:{routes:'Jakarta/Bali hubs to SE Asia, East Asia (incl. Japan), Middle East, Europe (Amsterdam).',fleet:'B737-800, B737 MAX 8, B777-300ER, A330-300'},
    training:[
      {title:'Type Rating',body:'DGCA Indonesia approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per DGCA.'},
      {title:'Captain Upgrade',body:'Seniority + internal assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. SkyTeam partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign pilot hiring on irregular basis. Check official site.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Pilot Recruitment',sub:'Domestic & international.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'English',v:'ICAO Level 4+'}],note:''}],
    recruitUrl:'https://career.garuda-indonesia.com/',
  },
  {
    file:'vietnam-airlines.html', code:'VN', color:'#BE0A30',
    nameEn:'Vietnam Airlines',
    subtitle:'Vietnam state flag carrier. SkyTeam member.',
    tags:[{cls:'tag-red',label:'🇻🇳 Vietnam'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥10M–¥18M',label:'Capt. Salary (est.)'},{val:'¥5M–¥10M',label:'F/O Salary (est.)'},{val:'~100 aircraft',label:'Fleet'},{val:'50+ cities',label:'Destinations'}],
    overview:'Vietnam Airlines is Vietnam\'s state flag carrier. Hubbing at Hanoi Noi Bai Airport, it serves East Asia, Europe, and Australia. Operating A350 and B787, it has had a consistent demand for foreign captains. SkyTeam member.',
    facts:[{k:'HQ',v:'Hanoi, Vietnam'},{k:'Hubs',v:'Noi Bai (HAN) / Tan Son Nhat (SGN)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1956'},{k:'Owner',v:'Vietnamese Government'},{k:'Foreign Hire',v:'Track record'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l (A350/B787)',range:'¥10M–¥18M',avg:'¥14M',pct:100,note:'USD contract common',noteTag:'red'},
      {pos:'First Officer',sub:'International',range:'¥5M–¥10M',avg:'¥7M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign pilots often offered USD contracts. Vietnam income tax may apply.',
    ops:{routes:'Hanoi/HCMC to Japan, Korea, China, Europe (London, Paris, Frankfurt), Australia.',fleet:'A350-900, A321neo, B787-9/10, B787-8, B737 MAX'},
    training:[
      {title:'Type Rating',body:'Vietnam CAAV-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAV.'},
      {title:'Captain Upgrade',body:'Seniority + assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. SkyTeam partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign captain hiring track record. Active recruitment periods due to pilot shortage.',
    hiringColor:'#f5c842',
    jobs:[{title:'Contract Captain',sub:'Foreign pilot direct hire.',status:'Irregular Hiring',statusTag:'blue',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Experience',v:'Widebody captain'},{k:'Contract',v:'USD fixed-term'}],note:''}],
    recruitUrl:'https://www.vietnamairlines.com/vn/en/the-vietnam-airlines/careers',
  },
  {
    file:'philippine-airlines.html', code:'PAL', color:'#0033A0',
    nameEn:'Philippine Airlines',
    subtitle:'Philippine flag carrier. Oneworld member. Asia\'s oldest airline.',
    tags:[{cls:'tag-blue',label:'🇵🇭 Philippines'},{cls:'tag-gold',label:'Oneworld'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥11M–¥20M',label:'Capt. Salary (est.)'},{val:'¥5M–¥11M',label:'F/O Salary (est.)'},{val:'~80 aircraft',label:'Fleet'},{val:'40+ cities',label:'Destinations'}],
    overview:'Philippine Airlines (PAL), founded 1941, is the flag carrier of the Philippines. Hubbing at Manila Ninoy Aquino International Airport, it serves Americas, Middle East, East Asia, and SE Asia. After completing Chapter 11 restructuring in 2022, PAL is rebuilding. Oneworld member.',
    facts:[{k:'HQ',v:'Manila, Philippines'},{k:'Hub',v:'Ninoy Aquino Int\'l (MNL)'},{k:'Alliance',v:'Oneworld'},{k:'Founded',v:'1941'},{k:'Status',v:'Post-restructure (2022)'},{k:'Income Tax',v:'Yes (Philippines)'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l widebody',range:'¥11M–¥20M',avg:'¥15M',pct:100,note:'USD+PHP allowances',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥5M–¥11M',avg:'¥7.5M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign pilots typically offered USD contracts.',
    ops:{routes:'Manila to Americas (LA, NY, SF), Middle East, East Asia (Japan/Korea), SE Asia.',fleet:'A350-900, A330-300, A321neo/ceo, B777-300ER'},
    training:[
      {title:'Type Rating',body:'CAAP Philippines-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAP.'},
      {title:'Captain Upgrade',body:'Seniority + internal assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. Oneworld partners included.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign pilot hiring on irregular basis. Check official site.',
    hiringColor:'#f5c842',
    jobs:[{title:'Pilot Recruitment',sub:'International routes.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'English',v:'ICAO Level 4+'}],note:''}],
    recruitUrl:'https://www.philippineairlines.com/aboutus/careers',
  },
  {
    file:'airasia.html', code:'AK', color:'#D20001',
    nameEn:'AirAsia Group',
    subtitle:"Southeast Asia's largest LCC. A320-family across multiple countries.",
    tags:[{cls:'tag-red',label:'🇲🇾 Malaysia-based'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'SE Asia\'s Largest LCC'}],
    stats:[{val:'¥9M–¥16M',label:'Capt. Salary (est.)'},{val:'¥4.5M–¥9M',label:'F/O Salary (est.)'},{val:'200+ aircraft',label:'Group Fleet'},{val:'165+ cities',label:'Destinations'}],
    overview:'AirAsia Group, founded 2001, is SE Asia\'s largest LCC. Operating exclusively on A320 family across Malaysia, Thailand, Indonesia, Philippines, and India. Regular foreign pilot hiring. Group entities include AirAsia and AirAsia X (long-haul).',
    facts:[{k:'HQ',v:'Kuala Lumpur, Malaysia'},{k:'Hubs',v:'KL (KLIA2) + Group hubs'},{k:'Founded',v:'2001'},{k:'Fleet',v:'A320 family only'},{k:'Group Coverage',v:'MY/TH/ID/PH/IN'},{k:'Employment',v:'Full-time or contract'}],
    salaryRows:[
      {pos:'Captain — A320',sub:'SE Asia short/medium routes',range:'¥9M–¥16M',avg:'¥12M',pct:100,note:'MYR + allowances',noteTag:'orange'},
      {pos:'First Officer — A320',sub:'Domestic & International',range:'¥4.5M–¥9M',avg:'¥6.5M',pct:54,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 MYR/JPY≈33. LCC base pay lower than FSC but productivity/duty pay supplements income.',
    ops:{routes:'SE Asian cities, Japan, Korea, China, India, Middle East. AirAsia X handles long-haul.',fleet:'A320/A321 family exclusively. 200+ aircraft group-wide.'},
    training:[
      {title:'Type Rating (LCC)',body:'A320 type training. Costs sometimes split or employee-funded depending on contract.'},
      {title:'LIFUS',body:'Supervised line operations post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per EASA/local authority.'},
      {title:'Captain Upgrade',body:'3,000–5,000h F/O required. Faster upgrade possible at some LCCs.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Discount',body:'Employee discount on own flights. Group airlines included.'},
      {icon:'🏥',title:'Health Insurance',body:'Basic medical coverage. May be less comprehensive than FSC.'},
      {icon:'📈',title:'Duty Pay',body:'Per-flight duty pay or productivity bonus.'},
      {icon:'📅',title:'Annual Leave',body:'Per local labor law.'},
    ],
    hiringStatus:'Regular hiring across group entities. Check by specific country entity.',
    hiringColor:'#34d399',
    jobs:[{title:'Captain / First Officer — A320',sub:'Group entities (MY/TH/ID etc.)',status:'Regular Hiring',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Type',v:'A320 type (preferred)'},{k:'English',v:'ICAO Level 4+'}],note:'Apply to relevant group entity career page.'}],
    recruitUrl:'https://careers.airasia.com/',
  },
  {
    file:'scoot.html', code:'TR', color:'#FEC10D',
    nameEn:'Scoot',
    subtitle:'Singapore Airlines Group LCC. Medium and long-haul routes.',
    tags:[{cls:'tag-gold',label:'🇸🇬 Singapore'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'SQ Group'}],
    stats:[{val:'¥16M–¥24M',label:'Capt. Salary (est.)',color:'#d4a00b'},{val:'¥8M–¥14M',label:'F/O Salary (est.)'},{val:'~60 aircraft',label:'Fleet'},{val:'70+ cities',label:'Destinations'}],
    overview:'Scoot is the LCC subsidiary of the Singapore Airlines Group. Operating medium and long-haul routes across East Asia, SE Asia, Australia, and Europe using B787 and A320 family. Singapore-based, benefiting from relatively low tax rates. Proven record of hiring foreign pilots.',
    facts:[{k:'HQ',v:'Singapore'},{k:'Hub',v:'Changi Airport (SIN)'},{k:'Parent',v:'Singapore Airlines Group'},{k:'Founded',v:'2011'},{k:'Fleet',v:'B787-8/9, A320/A321neo'},{k:'Income Tax',v:'Yes (Singapore, low rate)'}],
    salaryRows:[
      {pos:'Captain',sub:'B787 long-haul / A320 short-haul',range:'¥16M–¥24M',avg:'¥20M',pct:100,note:'SGD (low tax)',noteTag:'gold'},
      {pos:'First Officer',sub:'International',range:'¥8M–¥14M',avg:'¥11M',pct:55,note:'SGD',noteTag:'gray'},
    ],
    salaryNote:'💡 SGD/JPY≈112. Singapore income tax max 24% (low). Note: Singapore living costs are high.',
    ops:{routes:'SIN to Japan, Korea, Taiwan, China, Australia, Europe (Berlin). 70+ cities.',fleet:'B787-8/9 (long-haul), A320/A321neo (short/medium)'},
    training:[
      {title:'Type Rating',body:'Scoot / SIA Group ATC. Ground → simulator → LIFUS.'},
      {title:'SIA Group Standards',body:'Singapore Airlines Group safety and training standards applied. High-quality training culture.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAS (Singapore).'},
      {title:'Captain Upgrade',body:'Vacancy + seniority based.'},
    ],
    benefits:[
      {icon:'✈️',title:'SIA Group Travel',body:'SQ and Scoot employee discount tickets.'},
      {icon:'🌏',title:'Singapore Base',body:'Asia\'s financial hub. Multicultural, English-speaking environment.'},
      {icon:'🏥',title:'Health Insurance',body:'Comprehensive medical coverage (Singapore high-standard healthcare).'},
      {icon:'💰',title:'Low Tax Rate',body:'Singapore income tax max 24% — lower than Japan.'},
    ],
    hiringStatus:'Regular foreign pilot hiring. Demand for both B787 and A320 type-rated pilots.',
    hiringColor:'#34d399',
    jobs:[
      {title:'Captain — B787',sub:'Long-haul international.',status:'Hiring (Check Status)',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'B787 Type',v:'Preferred or willing to obtain'},{k:'Experience',v:'Widebody captain experience'}],note:''},
      {title:'First Officer — A320/A321',sub:'Short/medium-haul routes.',status:'Hiring (Check Status)',statusTag:'green',details:[{k:'License',v:'CPL/ATPL'},{k:'English',v:'ICAO Level 4+'}],note:''},
    ],
    recruitUrl:'https://careers.flyscoot.com/',
  },
  {
    file:'indigo.html', code:'6E', color:'#005499',
    nameEn:'IndiGo',
    subtitle:"India's largest LCC. A320-family only. Massive growth.",
    tags:[{cls:'tag-blue',label:'🇮🇳 India'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'Asia\'s Largest LCCs'}],
    stats:[{val:'¥10M–¥18M',label:'Capt. Salary (est.)'},{val:'¥5M–¥9M',label:'F/O Salary (est.)'},{val:'350+ aircraft',label:'Fleet (incl. orders)'},{val:'100+ cities',label:'Destinations'}],
    overview:'IndiGo, founded 2006, is India\'s largest airline with ~60% domestic market share. One of the world\'s largest A320-family operators with 500+ aircraft on order. Chronic pilot shortage drives active foreign pilot recruitment.',
    facts:[{k:'HQ',v:'Gurugram, India'},{k:'Hub',v:'Delhi Indira Gandhi Int\'l (DEL)'},{k:'Founded',v:'2006'},{k:'Fleet',v:'A320 family only'},{k:'Market Share',v:'~60% India domestic'},{k:'Income Tax',v:'Yes (India)'}],
    salaryRows:[
      {pos:'Captain — A320',sub:'Domestic & international',range:'¥10M–¥18M',avg:'¥14M',pct:100,note:'INR+USD (int\'l routes)',noteTag:'blue'},
      {pos:'First Officer — A320',sub:'Domestic & international',range:'¥5M–¥9M',avg:'¥7M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150, INR/JPY≈1.8. USD contracts for foreign pilots. India\'s rapid aviation growth creates high pilot demand.',
    ops:{routes:'All major Indian cities and regional airports at high frequency. International (Middle East, SE Asia) rapidly expanding.',fleet:'A320neo/A321neo exclusively. World-scale A320 operator.'},
    training:[
      {title:'Type Rating (A320)',body:'DGCA India-approved ATC. Ground → simulator → LIFUS.'},
      {title:'Rapid Expansion Training Demand',body:'IndiGo\'s growth drives investment in training centers. Demand for foreign captains driven by India pilot shortage.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per DGCA India.'},
      {title:'Captain Upgrade',body:'3,000–5,000h F/O required. Rapid growth may accelerate some upgrades.'},
    ],
    benefits:[
      {icon:'✈️',title:'India\'s Growth Market',body:'India is the world\'s fastest growing aviation market. Dynamic career environment.'},
      {icon:'💰',title:'Foreign Pilot Package',body:'USD-denominated special packages for foreign hires.'},
      {icon:'📈',title:'Fast Upgrade',body:'Rapid growth creates more upgrade opportunities.'},
      {icon:'📅',title:'Annual Leave',body:'Per Indian labor law.'},
    ],
    hiringStatus:'Actively hiring foreign captains with A320 type (March 2026).',
    hiringColor:'#34d399',
    jobs:[{title:'Captain — A320/A321neo',sub:'Foreign direct entry (Direct Entry)',status:'Actively Hiring',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Type',v:'A320 type (required)'},{k:'Min. Hours',v:'1,500h+ PIC on A320'},{k:'English',v:'ICAO Level 4+'},{k:'Contract',v:'USD fixed-term or permanent'}],note:'India DGCA documentation process required.'}],
    recruitUrl:'https://careers.goindigo.in/',
  },
  {
    file:'air-india.html', code:'AI', color:'#8B1538',
    nameEn:'Air India',
    subtitle:'India flag carrier. Tata Group-owned. Massive fleet expansion.',
    tags:[{cls:'tag-red',label:'🇮🇳 India'},{cls:'tag-blue',label:'Star Alliance'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'Tata Group'}],
    stats:[{val:'¥12M–¥22M',label:'Capt. Salary (est.)'},{val:'¥6M–¥12M',label:'F/O Salary (est.)'},{val:'120+ aircraft',label:'Current Fleet'},{val:'World-Scale',label:'470+ aircraft ordered'}],
    overview:'Air India completed privatization under Tata Group in 2022. A massive 470+ aircraft order (A350, A321neo, B787, B777X) was announced in 2023. Star Alliance membership in progress. Large-scale pilot hiring underway to support rapid expansion.',
    facts:[{k:'HQ',v:'Delhi, India'},{k:'Hubs',v:'Delhi (DEL) / Mumbai (BOM)'},{k:'Parent',v:'Tata Group (privatized 2022)'},{k:'Alliance',v:'Star Alliance (pending)'},{k:'Orders',v:'470+ A350/A321/B787/B777X'},{k:'Income Tax',v:'Yes (India)'}],
    salaryRows:[
      {pos:'Captain',sub:'Int\'l widebody',range:'¥12M–¥22M',avg:'¥17M',pct:100,note:'USD contract for foreign hires',noteTag:'red'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥6M–¥12M',avg:'¥9M',pct:52,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Tata-led reform improving compensation. USD contracts for foreign pilots.',
    ops:{routes:'Delhi/Mumbai to Americas (NY, Chicago), UK (London), Europe, SE Asia, Japan/East Asia. Domestic network expanding.',fleet:'B777-200LR/300ER, B787-8, A350 (receiving), A321neo, A319. Rapidly expanding.'},
    training:[
      {title:'Type Rating',body:'DGCA India-approved ATC. Upgrading simulator centers under Tata management.'},
      {title:'Tata Group Reform',body:'Comprehensive upgrade of training systems under Tata leadership. Modernizing infrastructure.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per DGCA India.'},
      {title:'Captain Upgrade',body:'Assessment-based. Major expansion creates opportunities.'},
    ],
    benefits:[
      {icon:'📈',title:'India Growth Market',body:"India's largest carrier riding the world's fastest aviation growth."},
      {icon:'✈️',title:'Staff Travel',body:'Air India and Tata Group airlines discount tickets.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Actively hiring with massive expansion. Foreign captain hiring confirmed (March 2026).',
    hiringColor:'#34d399',
    jobs:[
      {title:'Direct Entry Captain',sub:'International (B777/B787/A350)',status:'Hiring',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Experience',v:'Widebody captain'},{k:'English',v:'ICAO Level 4+'}],note:''},
      {title:'First Officer',sub:'Domestic & international.',status:'Hiring',statusTag:'green',details:[{k:'License',v:'CPL/ATPL'},{k:'English',v:'ICAO Level 4+'}],note:''},
    ],
    recruitUrl:'https://careers.airindia.com/',
  },
  {
    file:'air-china.html', code:'CA', color:'#D50012',
    nameEn:'Air China',
    subtitle:'China flag carrier. Star Alliance member.',
    tags:[{cls:'tag-red',label:'🇨🇳 China'},{cls:'tag-blue',label:'Star Alliance'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'State-Owned'}],
    stats:[{val:'¥17M–¥30M',label:'Capt. Salary (foreign/est.)'},{val:'¥8M–¥16M',label:'F/O Salary (est.)'},{val:'430+ aircraft',label:'Fleet'},{val:'100+ cities',label:'Int\'l Destinations'}],
    overview:"Air China is China's flag carrier and Star Alliance member. Hubbing at Beijing Capital and Daxing airports, it serves global routes. Has historically recruited foreign pilots, particularly captains, though policy varies by period.",
    facts:[{k:'HQ',v:'Beijing, China'},{k:'Hubs',v:'Beijing Capital (PEK) / Daxing (PKX)'},{k:'Alliance',v:'Star Alliance'},{k:'Founded',v:'1988'},{k:'Owner',v:'Chinese Government'},{k:'Foreign Hire',v:'Track record (policy varies)'}],
    salaryRows:[
      {pos:'Captain (Foreign Contract)',sub:'Int\'l widebody',range:'¥17M–¥30M',avg:'¥22M',pct:100,note:'USD special contract',noteTag:'red'},
      {pos:'First Officer',sub:'China domestic & int\'l',range:'¥8M–¥16M',avg:'¥11M',pct:50,note:'CNY+USD',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150, CNY/JPY≈20. USD special contracts for foreign pilots. China income tax up to 45% but foreign exemptions may apply. Verify current policy.',
    ops:{routes:'Beijing hub to Europe (London, Frankfurt, LA, NY), SE Asia, Japan (NRT/HND), Middle East, Oceania.',fleet:'B777-300ER, B737-8, A350, A321neo, A320neo, C919 (domestic). 430+ aircraft.'},
    training:[
      {title:'Type Rating',body:'CAAC China-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAAC.'},
      {title:'CAAC License Conversion',body:'Foreign license conversion to CAAC required. Time and cost involved. Plan accordingly.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Air China discount tickets. Star Alliance partners included.'},
      {icon:'🏙️',title:'Beijing/Shanghai Life',body:'Major China cities. Cost of living lower than Japan in some respects.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign pilot hiring policy varies. Recent trend toward Chinese pilot training. Check latest status.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Contract Captain (Foreign)',sub:'Int\'l widebody (irregular)',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Experience',v:'5,000h+ widebody'},{k:'CAAC',v:'License conversion required'}],note:'⚠️ CAAC license conversion requires time and cost. Plan carefully.'}],
    recruitUrl:'https://www.airchina.com.cn/en/info/recruitmnet/',
  },
  {
    file:'china-southern.html', code:'CZ', color:'#006AB6',
    nameEn:'China Southern Airlines',
    subtitle:'China\'s largest by passenger count. SkyTeam member.',
    tags:[{cls:'tag-blue',label:'🇨🇳 China'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'State-Owned'}],
    stats:[{val:'¥16M–¥28M',label:'Capt. Salary (foreign/est.)'},{val:'¥7M–¥14M',label:'F/O Salary (est.)'},{val:'600+ aircraft',label:'Fleet'},{val:'200+ cities',label:'Destinations'}],
    overview:"China Southern Airlines (CZ) is China's largest carrier by passenger count. Hubbing at Guangzhou Baiyun Airport and Beijing Daxing, it serves domestic and international routes. SkyTeam member. Has actively recruited foreign captains in the past.",
    facts:[{k:'HQ',v:'Guangzhou, China'},{k:'Hubs',v:'Guangzhou (CAN) / Beijing Daxing (PKX)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1988'},{k:'Owner',v:'Chinese Government'},{k:'Scale',v:"China's largest by passengers"}],
    salaryRows:[
      {pos:'Captain (Foreign Contract)',sub:'Int\'l widebody',range:'¥16M–¥28M',avg:'¥21M',pct:100,note:'USD special contract',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥7M–¥14M',avg:'¥10M',pct:47,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign special hiring on USD contracts. Policy varies — verify current status.',
    ops:{routes:'Guangzhou/Beijing to SE Asia, Japan (NRT/HND/KIX), Europe, Americas, Oceania (Sydney).',fleet:'B787, B777, B737 series, A380, A330, A321/A320, C919. 600+ aircraft.'},
    training:[
      {title:'Type Rating',body:'CAAC China-approved ATC.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC per CAAC.'},
      {title:'CAAC License Conversion',body:'Required for foreign pilots. Time and cost involved.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. SkyTeam partners.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage for pilot and family.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign hiring policy varies. Check latest status.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Contract Captain (Foreign)',sub:'International (irregular)',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'CAAC',v:'License conversion required'}],note:''}],
    recruitUrl:'https://hr.csair.com/recruitment/',
  },
  {
    file:'china-eastern.html', code:'MU', color:'#0063BE',
    nameEn:'China Eastern Airlines',
    subtitle:'Shanghai-based. One of China\'s big-3. SkyTeam member.',
    tags:[{cls:'tag-blue',label:'🇨🇳 China'},{cls:'tag-blue',label:'SkyTeam'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'State-Owned'}],
    stats:[{val:'¥16M–¥28M',label:'Capt. Salary (foreign/est.)'},{val:'¥7M–¥14M',label:'F/O Salary (est.)'},{val:'500+ aircraft',label:'Fleet'},{val:'150+ cities',label:'Destinations'}],
    overview:"China Eastern Airlines (MU) hubs at Shanghai Pudong and Hongqiao airports. One of China's big-3, SkyTeam member. Excellent Japan routes (NRT/HND/KIX/NGO/FUK among most frequent). Has history of foreign pilot recruitment.",
    facts:[{k:'HQ',v:'Shanghai, China'},{k:'Hubs',v:'Shanghai Pudong (PVG) / Hongqiao (SHA)'},{k:'Alliance',v:'SkyTeam'},{k:'Founded',v:'1988'},{k:'Owner',v:'Chinese Government'},{k:'Japan Routes',v:'Very frequent (NRT/HND/KIX+)'}],
    salaryRows:[
      {pos:'Captain (Foreign Contract)',sub:'Int\'l widebody',range:'¥16M–¥28M',avg:'¥21M',pct:100,note:'USD special contract',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥7M–¥14M',avg:'¥10M',pct:47,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign special contracts typically USD-denominated.',
    ops:{routes:'Shanghai to Japan (NRT/HND/KIX/NGO/FUK+), Europe, Americas, SE Asia, Oceania. Japan routes very frequent.',fleet:'A350, A330, A321/A320neo/ceo, B777, B737 MAX. 500+ aircraft.'},
    training:[
      {title:'Type Rating',body:'CAAC China-approved ATC.'},
      {title:'LIFUS',body:'Supervised line ops.'},
      {title:'Recurrent Checks',body:'OPC/LPC per CAAC.'},
      {title:'CAAC License Conversion',body:'Required for foreign pilots.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets. SkyTeam partners.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'📅',title:'Annual Leave',body:'20–25 days.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign hiring on irregular basis. Check latest status.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Contract Captain (Foreign)',sub:'International (irregular)',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'CAAC',v:'License conversion required'}],note:''}],
    recruitUrl:'https://hr.ceair.com/',
  },
  {
    file:'hainan-airlines.html', code:'HU', color:'#0063A7',
    nameEn:'Hainan Airlines',
    subtitle:'China\'s largest private carrier. Skytrax 5-Star. HNA Group.',
    tags:[{cls:'tag-blue',label:'🇨🇳 China'},{cls:'tag-gold',label:'Skytrax 5-Star'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gray',label:'Private'}],
    stats:[{val:'¥15M–¥25M',label:'Capt. Salary (foreign/est.)'},{val:'¥7M–¥13M',label:'F/O Salary (est.)'},{val:'200+ aircraft',label:'Fleet'},{val:'60+ cities',label:'Int\'l Destinations'}],
    overview:"Hainan Airlines is China's largest private independent carrier under HNA Group. Known for Skytrax 5-Star quality service. Hubs at Beijing and Haikou, operating domestically and internationally. Post HNA Group financial restructuring, still operating. History of foreign pilot recruitment.",
    facts:[{k:'HQ',v:'Haikou, Hainan, China'},{k:'Hubs',v:'Beijing Capital (PEK) / Haikou (HAK)'},{k:'Alliance',v:'None'},{k:'Founded',v:'1993'},{k:'Quality',v:'Skytrax 5-Star'},{k:'Foreign Hire',v:'Track record'}],
    salaryRows:[
      {pos:'Captain (Foreign Contract)',sub:'International',range:'¥15M–¥25M',avg:'¥20M',pct:100,note:'USD contract',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥7M–¥13M',avg:'¥9.5M',pct:47,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign pilots typically on USD special contracts.',
    ops:{routes:'Beijing/Haikou to all major Chinese cities, international routes (US, Europe, Japan, SE Asia).',fleet:'B787-8/9, B737-800 MAX, A330. 200+ aircraft.'},
    training:[
      {title:'Type Rating',body:'CAAC China-approved ATC.'},
      {title:'LIFUS',body:'Supervised line ops.'},
      {title:'Recurrent Checks',body:'OPC/LPC per CAAC.'},
      {title:'CAAC License Conversion',body:'Required for foreign pilots.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Travel',body:'Discount tickets on Hainan Airlines flights.'},
      {icon:'🌟',title:'5-Star Quality',body:'Flying for a Skytrax 5-Star carrier brings prestige.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage.'},
      {icon:'💰',title:'Bonus',body:'Performance-linked bonus.'},
      {icon:'🏦',title:'Pension',body:'Corporate pension.'},
      {icon:'🌐',title:'Layover Allowance',body:'Per diem for international layovers.'},
    ],
    hiringStatus:'Foreign hiring track record. Post-HNA restructuring status requires verification.',
    hiringColor:'#6b7d93',
    jobs:[{title:'Foreign Captain',sub:'International (irregular)',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'CAAC',v:'License conversion required'}],note:''}],
    recruitUrl:'https://www.hnair.com/HNA/chinese/recruitmentEnter.do',
  },
  {
    file:'vietjet.html', code:'VJ', color:'#E30022',
    nameEn:'VietJet Air',
    subtitle:"Vietnam's largest LCC. Rapid growth. A320-family only.",
    tags:[{cls:'tag-red',label:'🇻🇳 Vietnam'},{cls:'tag-orange',label:'LCC'},{cls:'tag-orange',label:'Rapid Growth'}],
    stats:[{val:'¥9M–¥15M',label:'Capt. Salary (est.)'},{val:'¥4M–¥8M',label:'F/O Salary (est.)'},{val:'~90 aircraft',label:'Fleet'},{val:'160+ routes',label:'International Routes'}],
    overview:"VietJet Air, founded 2011, is Vietnam's first private LCC and largest passenger carrier. Hubbing at Ho Chi Minh City and Hanoi, it rapidly expanded across SE Asia, East Asia, and South Asia. A320-family only. Fast growth drives consistent foreign captain demand.",
    facts:[{k:'HQ',v:'Hanoi, Vietnam'},{k:'Hubs',v:'Tan Son Nhat (SGN) / Noi Bai (HAN)'},{k:'Founded',v:'2011'},{k:'Fleet',v:'A320 family only'},{k:'Growth',v:"Vietnam's largest by passengers"},{k:'Foreign Hire',v:'Active'}],
    salaryRows:[
      {pos:'Captain — A320',sub:'Domestic & international',range:'¥9M–¥15M',avg:'¥12M',pct:100,note:'USD contract for foreign',noteTag:'red'},
      {pos:'First Officer — A320',sub:'Domestic & International',range:'¥4M–¥8M',avg:'¥6M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign captain USD contracts confirmed. Vietnam income tax applies.',
    ops:{routes:'HCMC/Hanoi to SE Asia, Japan (NRT/KIX), Korea, Taiwan, India.',fleet:'A320/A321neo. ~90 aircraft (large orders outstanding).'},
    training:[
      {title:'Type Rating (LCC)',body:'CAAV Vietnam-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops post-type rating.'},
      {title:'Recurrent Checks',body:'OPC/LPC per CAAV.'},
      {title:'Captain Upgrade',body:'A320 hours required. Rapid growth may accelerate some upgrades.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Discount',body:'VietJet employee discount tickets.'},
      {icon:'🏥',title:'Health Insurance',body:'Basic medical coverage.'},
      {icon:'📈',title:'Duty Pay',body:'Per-flight duty or productivity pay.'},
      {icon:'📅',title:'Annual Leave',body:'Per Vietnamese labor law.'},
    ],
    hiringStatus:'Actively hiring foreign captains with A320 type (A320 type required).',
    hiringColor:'#34d399',
    jobs:[{title:'Contract Captain — A320/A321',sub:'Foreign direct entry.',status:'Hiring',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Type',v:'A320 type (required)'},{k:'English',v:'ICAO Level 4+'},{k:'Contract',v:'USD fixed-term'}],note:'Vietnam DGCA license conversion required.'}],
    recruitUrl:'https://careers.vietjetair.com/',
  },
  {
    file:'bamboo-airways.html', code:'QH', color:'#35774E',
    nameEn:'Bamboo Airways',
    subtitle:'Vietnam private FSC. Launch 2019.',
    tags:[{cls:'tag-green',label:'🇻🇳 Vietnam'},{cls:'tag-gray',label:'Hybrid FSC/LCC'},{cls:'tag-gray',label:'Mid-size'}],
    stats:[{val:'¥8M–¥14M',label:'Capt. Salary (est.)'},{val:'¥4M–¥8M',label:'F/O Salary (est.)'},{val:'~30 aircraft',label:'Fleet'},{val:'Est. 2019',label:'Launch Year'}],
    overview:'Bamboo Airways, launched 2019, is a Vietnam private carrier. Originally backed by FLC Group. Operating from Hanoi and HCMC on domestic and international routes (Japan, Korea, etc.) using A320 family and B787. Foreign pilot recruitment track record.',
    facts:[{k:'HQ',v:'Hanoi, Vietnam'},{k:'Hubs',v:'Noi Bai (HAN) / Tan Son Nhat (SGN)'},{k:'Founded',v:'2017 (ops 2019)'},{k:'Fleet',v:'A320/A321, B787'},{k:'Foreign Hire',v:'Track record'},{k:'Income Tax',v:'Yes (Vietnam)'}],
    salaryRows:[
      {pos:'Captain',sub:'Domestic & Int\'l',range:'¥8M–¥14M',avg:'¥11M',pct:100,note:'USD contract',noteTag:'green'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥4M–¥8M',avg:'¥6M',pct:54,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. USD contracts for foreign hires.',
    ops:{routes:'Hanoi/HCMC to major domestic airports, Japan (NRT/KIX), Korea, Taiwan.',fleet:'A320/A321, B787-9. ~30 aircraft.'},
    training:[
      {title:'Type Rating',body:'CAAV Vietnam-approved ATC. Ground → simulator → LIFUS.'},
      {title:'LIFUS',body:'Supervised line ops.'},
      {title:'Recurrent Checks',body:'OPC/LPC per CAAV.'},
      {title:'Captain Upgrade',body:'Based on hours and assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Discount',body:'Bamboo Airways employee discount tickets.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage.'},
      {icon:'📈',title:'Duty Pay',body:'Per-flight duty pay.'},
      {icon:'📅',title:'Annual Leave',body:'Per Vietnamese labor law.'},
    ],
    hiringStatus:'Foreign pilot hiring track record. Check official site.',
    hiringColor:'#f5c842',
    jobs:[{title:'Pilot Recruitment',sub:'Domestic & international.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Type',v:'A320 or B787'}],note:''}],
    recruitUrl:'https://bambooairways.com/vn-en/landing/careers/',
  },
  {
    file:'hong-kong-express.html', code:'UO', color:'#9333EA',
    nameEn:'HK Express',
    subtitle:'Hong Kong LCC. Qatar Airways Group subsidiary.',
    tags:[{cls:'tag-blue',label:'🇭🇰 Hong Kong'},{cls:'tag-orange',label:'LCC'},{cls:'tag-gold',label:'Qatar Airways Group'}],
    stats:[{val:'¥15M–¥22M',label:'Capt. Salary (est.)'},{val:'¥7M–¥13M',label:'F/O Salary (est.)'},{val:'~30 aircraft',label:'Fleet'},{val:'30+ cities',label:'Destinations'}],
    overview:'HK Express is a Hong Kong-based LCC owned by the Qatar Investment Authority (Qatar Airways Group). Operating A320 family exclusively across East Asia and SE Asia, including Japan (NRT/KIX/OKA). HK income tax is low (max 17%).',
    facts:[{k:'HQ',v:'Hong Kong'},{k:'Hub',v:'Hong Kong Int\'l Airport (HKG)'},{k:'Owner',v:'Qatar Airways Group (QIA)'},{k:'Fleet',v:'A320/A321neo'},{k:'Founded',v:'2004'},{k:'Income Tax',v:'Yes (HK, up to 17%)'}],
    salaryRows:[
      {pos:'Captain — A320/A321',sub:'East & SE Asia routes',range:'¥15M–¥22M',avg:'¥18M',pct:100,note:'HKD (low tax)',noteTag:'blue'},
      {pos:'First Officer',sub:'International',range:'¥7M–¥13M',avg:'¥10M',pct:55,note:'HKD/JPY≈19',noteTag:'gray'},
    ],
    salaryNote:'💡 HKD/JPY≈19. HK income tax max 17% — among the lowest in major cities. Note: HK living costs are high.',
    ops:{routes:'HKG to Japan (NRT/KIX/OKA/FUK), Korea, Taiwan, Thailand, Philippines, Vietnam.',fleet:'A320/A321neo. ~30 aircraft.'},
    training:[
      {title:'Type Rating (LCC)',body:'CAD Hong Kong-approved ATC. Ground → simulator → LIFUS.'},
      {title:'Qatar Group Benefit',body:'Part of Qatar Airways Group — potential access to group resources and network.'},
      {title:'Recurrent Checks',body:'OPC/LPC 1–2x per year per CAD HK.'},
      {title:'Captain Upgrade',body:'Vacancy + seniority based.'},
    ],
    benefits:[
      {icon:'🏙️',title:'Hong Kong Base',body:'Asia financial center. Low income tax (max 17%).'},
      {icon:'✈️',title:'Qatar Group Benefit',body:'Qatar Airways Group employee benefits access.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage.'},
      {icon:'📅',title:'Annual Leave',body:'Per HK labor law.'},
    ],
    hiringStatus:'A320 type-rated pilots actively sought. Check official site.',
    hiringColor:'#f5c842',
    jobs:[{title:'Captain / First Officer — A320/A321',sub:'East Asia routes.',status:'Check Official Page',statusTag:'blue',details:[{k:'License',v:'ATPL (ICAO/CASL)'},{k:'Type',v:'A320 type preferred'}],note:''}],
    recruitUrl:'https://hkexpress.com/en-hk/about/careers/',
  },
  {
    file:'batik-air.html', code:'ID', color:'#5C256C',
    nameEn:'Batik Air',
    subtitle:'Lion Air Group FSC brand. Indonesia-based.',
    tags:[{cls:'tag-blue',label:'🇮🇩 Indonesia'},{cls:'tag-gold',label:'Lion Group'},{cls:'tag-gray',label:'Hybrid FSC'}],
    stats:[{val:'¥9M–¥16M',label:'Capt. Salary (est.)'},{val:'¥4M–¥8M',label:'F/O Salary (est.)'},{val:'~50 aircraft',label:'Fleet'},{val:'40+ cities',label:'Destinations'}],
    overview:"Batik Air is the full-service brand of Indonesia's Lion Air Group. Based in Jakarta, it operates domestic and short-haul international routes using B737 and A320. Foreign pilot recruitment track record.",
    facts:[{k:'HQ',v:'Jakarta, Indonesia'},{k:'Hub',v:'Soekarno-Hatta (CGK)'},{k:'Group',v:'Lion Air Group'},{k:'Founded',v:'2013'},{k:'Fleet',v:'B737/A320'},{k:'Income Tax',v:'Yes (Indonesia)'}],
    salaryRows:[
      {pos:'Captain',sub:'Domestic & Int\'l',range:'¥9M–¥16M',avg:'¥12M',pct:100,note:'USD contract for foreign',noteTag:'blue'},
      {pos:'First Officer',sub:'Domestic & Int\'l',range:'¥4M–¥8M',avg:'¥6M',pct:50,note:'Reference value',noteTag:'gray'},
    ],
    salaryNote:'💡 USD/JPY=150. Foreign pilots often offered USD contracts.',
    ops:{routes:'Jakarta to all major Indonesian cities, Singapore, Malaysia.',fleet:'B737-800, B737 MAX 8/9, A320/A321'},
    training:[
      {title:'Type Rating',body:'DGCA Indonesia-approved ATC.'},
      {title:'LIFUS',body:'Supervised line ops.'},
      {title:'Recurrent Checks',body:'OPC/LPC per DGCA.'},
      {title:'Captain Upgrade',body:'Hours + assessment.'},
    ],
    benefits:[
      {icon:'✈️',title:'Staff Discount',body:'Batik Air and Lion Group discount tickets.'},
      {icon:'🏥',title:'Health Insurance',body:'Medical coverage.'},
      {icon:'📈',title:'Duty Pay',body:'Per-flight duty pay.'},
      {icon:'📅',title:'Annual Leave',body:'Per Indonesian labor law.'},
    ],
    hiringStatus:'Foreign pilot hiring on irregular basis.',
    hiringColor:'#f5c842',
    jobs:[{title:'Contract Captain',sub:'Domestic & international.',status:'Check Official Page',statusTag:'gray',details:[{k:'License',v:'ATPL (ICAO)'},{k:'English',v:'ICAO Level 4+'}],note:''}],
    recruitUrl:'https://www.batikair.com/en/about-us/career',
  },
  {
    file:'royal-brunei.html', code:'BI', color:'#B8860B',
    nameEn:'Royal Brunei Airlines',
    subtitle:'Brunei flag carrier. Tax-free. Long-haul routes.',
    tags:[{cls:'tag-gold',label:'🇧🇳 Brunei'},{cls:'tag-gray',label:'FSC'},{cls:'tag-green',label:'Tax-Free'}],
    stats:[{val:'¥16M–¥24M',label:'Capt. Salary (tax-free)'},{val:'¥8M–¥14M',label:'F/O Salary (tax-free)'},{val:'~12 aircraft',label:'Fleet'},{val:'Tax-Free',label:'No Brunei Income Tax'}],
    overview:'Royal Brunei Airlines is the flag carrier of Brunei Darussalam. Despite small scale, it operates long-haul routes (UK, Australia, etc.). Brunei has NO personal income tax — take-home equivalent to Middle East levels. Consistent foreign captain and F/O recruitment.',
    facts:[{k:'HQ',v:'Bandar Seri Begawan, Brunei'},{k:'Hub',v:'Brunei Int\'l Airport (BWN)'},{k:'Founded',v:'1974'},{k:'Owner',v:'Brunei Government'},{k:'Fleet',v:'B787-8, A320'},{k:'Income Tax',v:'None (tax-free)'}],
    salaryRows:[
      {pos:'Captain — B787',sub:'Long-haul int\'l (tax-free)',range:'¥16M–¥24M',avg:'¥20M',pct:100,note:'USD (tax-free)',noteTag:'gold'},
      {pos:'First Officer',sub:'International (tax-free)',range:'¥8M–¥14M',avg:'¥11M',pct:55,note:'Tax-free',noteTag:'green'},
    ],
    salaryNote:'💡 USD/JPY=150. Brunei has no personal income tax. Middle East-level tax advantage. Cost of living in Brunei is affordable.',
    ops:{routes:'BSB to London, Melbourne, Tokyo (NRT), Singapore, Kuala Lumpur, Dubai.',fleet:'B787-8 (long-haul), A320neo (short/medium)'},
    training:[
      {title:'Type Rating',body:'Boeing/Airbus-approved ATC for B787/A320. Standard ground → simulator → LIFUS process.'},
      {title:'B787 Long-Haul Training',body:'B787 type rating at Boeing-certified center. Long-haul specific procedures included.'},
      {title:'Recurrent Checks',body:'OPC per Brunei DCA. 1–2x per year.'},
      {title:'Captain Upgrade',body:'Based on hours and assessment.'},
    ],
    benefits:[
      {icon:'💰',title:'Zero Income Tax',body:'Brunei has no personal income tax. Full salary as take-home.'},
      {icon:'🏠',title:'Housing Allowance',body:'Housing support for foreign pilots (confirm at recruitment).'},
      {icon:'✈️',title:'Staff Travel',body:'Royal Brunei Airlines discount tickets.'},
      {icon:'🏙️',title:'Peaceful Living',body:'Brunei is safe, affordable, and peaceful. Low-key expatriate lifestyle.'},
    ],
    hiringStatus:'Consistent foreign pilot recruitment. B787 captains and A320 type-rated pilots in demand.',
    hiringColor:'#34d399',
    jobs:[
      {title:'Captain — B787-8',sub:'Foreign direct entry (tax-free)',status:'Hiring (Check Status)',statusTag:'green',details:[{k:'License',v:'ATPL (ICAO)'},{k:'Type',v:'B787 type preferred'},{k:'Min. Hours',v:'3,000h PIC+'},{k:'Contract',v:'USD (tax-free)'}],note:''},
      {title:'First Officer — A320',sub:'Short/medium-haul routes.',status:'Hiring (Check Status)',statusTag:'green',details:[{k:'License',v:'CPL/ATPL (ICAO)'},{k:'English',v:'ICAO Level 4+'}],note:''},
    ],
    recruitUrl:'https://www.royalbrunei.com/about-us/careers/',
  },
];

/* ═══════════════════════════════════════════════════
   GENERATE FILES
   ═══════════════════════════════════════════════════ */

let count = 0;
for (const a of [...airlines_main, ...airlines_asia, ...airlines_orphans, ...airlines_c]) {
  writeFileSync(`en/airlines/${a.file}`, page(a));
  console.log(`Created: en/airlines/${a.file}`);
  count++;
}
console.log(`\n✓ Generated ${count} EN airline pages.`);
