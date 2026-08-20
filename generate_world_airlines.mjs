import { writeFileSync } from 'fs';

const CSS = `
*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}
body{background-color:#0a0c0f;color:#e8edf2;font-family:'Inter','Noto Sans JP',sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:128px;opacity:.3}
nav{position:fixed;top:0;left:0;right:0;z-index:200;transition:background .4s,border-color .4s}
nav.scrolled{background:rgba(10,12,15,.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.nav-link{color:rgba(255,255,255,.6);font-size:.85rem;font-weight:500;letter-spacing:.04em;transition:color .2s;text-decoration:none}
.nav-link:hover{color:#fff}
.glass{background:rgba(17,22,32,.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.07);border-radius:16px}
.glass-raised{background:rgba(24,33,47,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.10);border-radius:16px}
.gradient-text{background:linear-gradient(135deg,#ffffff 0%,#a8c8f0 60%,#3d9bff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:600}
.tag-blue{background:rgba(61,155,255,.12);color:#5fb0ff;border:1px solid rgba(61,155,255,.2)}
.tag-gold{background:rgba(245,200,66,.10);color:#f5c842;border:1px solid rgba(245,200,66,.2)}
.tag-green{background:rgba(52,211,153,.10);color:#34d399;border:1px solid rgba(52,211,153,.2)}
.tag-gray{background:rgba(255,255,255,.06);color:#8899aa;border:1px solid rgba(255,255,255,.1)}
.tag-orange{background:rgba(249,115,22,.12);color:#fb923c;border:1px solid rgba(249,115,22,.2)}
.tag-red{background:rgba(232,25,44,.12);color:#ff5555;border:1px solid rgba(232,25,44,.2)}
.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:10px;background:#3d9bff;color:#fff;font-size:.9rem;font-weight:600;border:none;cursor:pointer;text-decoration:none;transition:transform .2s,box-shadow .2s,background .2s}
.btn-primary:hover{background:#5eb3ff;transform:translateY(-1px);box-shadow:0 8px 30px rgba(61,155,255,.35)}
.btn-orange{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:10px;background:linear-gradient(135deg,#f97316,#f5c842);color:#000;font-size:.9rem;font-weight:600;border:none;cursor:pointer;text-decoration:none;transition:opacity .2s,transform .2s}
.btn-orange:hover{opacity:.9;transform:translateY(-1px)}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.875rem;font-weight:600;border:1px solid rgba(255,255,255,.12);text-decoration:none;transition:background .2s,border-color .2s}
.btn-ghost:hover{background:rgba(255,255,255,.12)}
.fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s cubic-bezier(.16,1,.3,1)}
.fade-up.visible{opacity:1;transform:translateY(0)}
.salary-bar-track{height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.salary-bar-fill{height:100%;border-radius:999px;transition:width 1.4s cubic-bezier(.16,1,.3,1);width:0}
.stat-card{padding:20px;border-radius:14px;background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(61,155,255,.10);border:1px solid rgba(61,155,255,.25);font-size:.75rem;font-weight:600;color:#3d9bff;letter-spacing:.08em;text-transform:uppercase}
table{width:100%;border-collapse:collapse}
th{font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7d93;padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07)}
td{padding:13px 16px;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
.logo-img{height:44px;width:auto;filter:brightness(1.15) drop-shadow(0 0 8px rgba(249,115,22,.5));transition:filter .3s}
footer{background:#060809;border-top:1px solid rgba(255,255,255,.05)}
.hero-airline{position:relative;padding:160px 0 80px;overflow:hidden}
.info-card{background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px;margin-bottom:8px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}
`;

const JS = `
window.addEventListener('scroll',()=>{document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');animateBars(e.target);io.unobserve(e.target);}});},{threshold:0.01,rootMargin:'0px 0px -30px 0px'});
function animateBars(container){container.querySelectorAll('[data-width]').forEach(bar=>{bar.style.width='0';setTimeout(()=>{bar.style.width=(bar.dataset.width||0)+'%';},80);});}
document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));
setTimeout(()=>{document.querySelectorAll('.fade-up:not(.visible)').forEach(el=>{el.classList.add('visible');animateBars(el);});},300);
`;

function page(a) {
  const sectionBadgeColor = a.color;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${a.nameJa}（${a.nameEn}）パイロット情報 | PILOT VALUE</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet"/>
  <script>tailwind.config={theme:{extend:{colors:{bg:'#0a0c0f',surface:'#111620',raised:'#18212f',accent:'${a.color}',gold:'#f5c842',orange:'#f97316',text:'#e8edf2',muted:'#6b7d93'},fontFamily:{sans:['Inter','Noto Sans JP','sans-serif']}}}};<\/script>
  <style>${CSS}
  .section-badge{background:${a.color}18;border:1px solid ${a.color}40;color:${a.color}}
  .gradient-text{background:linear-gradient(135deg,#ffffff 0%,${a.color}cc 60%,${a.color} 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  </style>
</head>
<body class="relative">

<nav id="main-nav">
  <div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
    <a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" class="logo-img"/></a>
    <div class="hidden md:flex items-center gap-6">
      <a href="../index.html#compare" class="nav-link">日本 vs 海外</a>
      <a href="../index.html#ranking" class="nav-link">機長ランキング</a>
      <a href="../world-jobs.html" class="nav-link" style="color:#f5c842">世界の求人</a>
    </div>
    <a href="../world-jobs.html" class="btn-ghost text-sm py-2 px-4">← 世界の求人</a>
  </div>
</nav>

<div class="hero-airline" style="background:linear-gradient(180deg,${a.color}12 0%,transparent 60%)">
  <div class="absolute inset-0" style="background:radial-gradient(ellipse 50% 60% at 20% 40%,${a.color}10 0%,transparent 70%)"></div>
  <div class="max-w-7xl mx-auto px-6 relative">
    <div class="flex items-start gap-6 mb-8">
      <div class="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0" style="background:${a.color}20;color:${a.color};border:1px solid ${a.color}35">${a.code}</div>
      <div>
        <div class="flex flex-wrap items-center gap-3 mb-3">
          ${a.tags.map(t=>`<span class="tag ${t.cls}">${t.label}</span>`).join('')}
        </div>
        <h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight gradient-text mb-2">${a.nameJa}</h1>
        <p class="text-muted text-lg">${a.nameEn} — ${a.subtitle}</p>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      ${a.stats.map(s=>`<div class="stat-card text-center"><div class="text-2xl font-extrabold mb-1" style="color:${s.color||a.color}">${s.val}</div><div class="text-xs text-muted">${s.label}</div></div>`).join('')}
    </div>
  </div>
</div>

<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">

  <!-- 概要 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">航空会社の概要</div>
    <h2 class="text-2xl font-bold mb-4">${a.nameJa}について</h2>
    <div class="grid lg:grid-cols-2 gap-8">
      <div>
        <p class="text-muted leading-relaxed">${a.overview}</p>
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${a.facts.map(f=>`<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${f.k}</div><div class="font-semibold text-sm">${f.v}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- 年収 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収データ</div>
    <h2 class="text-2xl font-bold mb-6">パイロット年収（2026年3月現在）</h2>
    <div class="overflow-x-auto mb-6">
      <table>
        <thead><tr><th>ポジション</th><th>年収レンジ</th><th>平均・参考値</th><th>備考</th></tr></thead>
        <tbody>
          ${a.salaryRows.map(r=>`<tr>
            <td><span class="font-semibold">${r.pos}</span><br><span class="text-xs text-muted">${r.sub}</span></td>
            <td><div class="text-sm">${r.range}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${a.color}88,${a.color})" data-width="${r.pct}"></div></div></td>
            <td><span class="font-bold text-xl" style="color:${a.color}">${r.avg}</span></td>
            <td><span class="tag tag-${r.noteTag||'gray'}">${r.note}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted">${a.salaryNote}</p>
  </div>

  <!-- 運航環境 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">運航環境</div>
    <h2 class="text-2xl font-bold mb-6">フライト環境・路線・機材</h2>
    <div class="grid md:grid-cols-2 gap-6">
      <div>
        <div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">就航路線</div>
        <p class="text-muted text-sm leading-relaxed">${a.ops.routes}</p>
      </div>
      <div>
        <div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">保有機材</div>
        <p class="text-muted text-sm leading-relaxed">${a.ops.fleet}</p>
      </div>
    </div>
  </div>

  <!-- 訓練 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">訓練環境</div>
    <h2 class="text-2xl font-bold mb-6">訓練・審査システム</h2>
    <div class="grid md:grid-cols-2 gap-4">
      ${a.training.map(t=>`<div class="info-card"><div class="font-semibold mb-2" style="color:${a.color}">${t.title}</div><p class="text-sm text-muted">${t.body}</p></div>`).join('')}
    </div>
  </div>

  <!-- 福利厚生 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">福利厚生</div>
    <h2 class="text-2xl font-bold mb-6">ベネフィット・待遇</h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${a.benefits.map(b=>`<div class="stat-card"><div class="text-2xl mb-2">${b.icon}</div><div class="font-semibold text-sm mb-1">${b.title}</div><p class="text-xs text-muted">${b.body}</p></div>`).join('')}
    </div>
  </div>

  <!-- 募集要項 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">募集要項</div>
    <h2 class="text-2xl font-bold mb-2">採用情報（2026年3月現在）</h2>
    <p class="text-sm text-muted mb-6">採用状況：<strong style="color:${a.hiringStatusColor||a.color}">${a.hiringStatus}</strong></p>
    <div class="space-y-5">
      ${a.jobs.map(j=>`<div class="glass-raised p-6" style="border-color:${a.color}25">
        <div class="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <div class="font-bold text-base mb-0.5">${j.title}</div>
            <div class="text-sm text-muted">${j.sub}</div>
          </div>
          <span class="tag tag-${j.statusTag}">${j.status}</span>
        </div>
        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          ${j.details.map(d=>`<div class="text-sm"><span class="text-muted">${d.k}：</span><span>${d.v}</span></div>`).join('')}
        </div>
        ${j.note?`<p class="text-xs text-muted mt-2">${j.note}</p>`:''}
      </div>`).join('')}
    </div>
    ${a.recruitUrl?`<div class="mt-6"><a href="${a.recruitUrl}" target="_blank" class="btn-orange">採用ページへ（外部サイト）<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M8 2h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a></div>`:''}
  </div>

</div>

<footer class="py-10">
  <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
    <a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" style="height:28px;opacity:.7"/></a>
    <div class="flex gap-5 text-sm text-muted">
      <a href="../index.html" class="hover:text-text transition-colors">ホーム</a>
      <a href="../world-jobs.html" class="hover:text-text transition-colors">世界の求人</a>
      <a href="../community.html" class="hover:text-text transition-colors">コミュニティ</a>
    </div>
    <p class="text-xs text-muted">掲載情報は参考値。実際の採用条件は各社公式サイトをご確認ください。</p>
  </div>
</footer>

<script>${JS}<\/script>
<script src="../currency.js"><\/script>
</body>
</html>`;
}

// ─── Airline data ────────────────────────────────────────────────

const airlines = [

  {
    file:'riyadh-air.html',
    code:'RIA',
    color:'#c4943b',
    nameEn:'Riyadh Air',
    nameJa:'リヤドエア（Riyadh Air）',
    subtitle:'サウジアラビア第2の国営フラッグキャリア — 2025年就航開始',
    tags:[
      {cls:'tag-gold',label:'🇸🇦 サウジアラビア'},
      {cls:'tag-green',label:'非課税'},
      {cls:'tag-orange',label:'新設航空会社'},
      {cls:'tag-blue',label:'積極採用中'},
    ],
    stats:[
      {val:'¥4,300万〜5,700万',label:'機長年収（非課税）',color:'#c4943b'},
      {val:'¥2,900万〜3,100万',label:'副操縦士年収（非課税）',color:'#f5c842'},
      {val:'124機',label:'発注機材数',color:'#34d399'},
      {val:'2025.10',label:'就航開始',color:'#3d9bff'},
    ],
    overview:'リヤドエア（Riyadh Air）は、サウジアラビアの公共投資基金（PIF）が100%出資する新設航空会社。サウジアラビア第2のフラッグキャリアとしてサウディアと並立し、2025年10月に初就航を果たした。リヤドのキング・ハーリド国際空港を拠点に、アジア・欧州・中東の主要都市に国際線を展開。政府の「Vision 2030」観光・経済多角化戦略の中核を担う航空会社として、大規模なパイロット採用を継続中。',
    facts:[
      {k:'本社',v:'リヤド（サウジアラビア）'},
      {k:'ハブ',v:'キング・ハーリド国際空港'},
      {k:'就航開始',v:'2025年10月'},
      {k:'オーナー',v:'サウジPIF（公共投資基金）'},
      {k:'就航都市（計画）',v:'15都市以上（2026年）'},
      {k:'個人所得税',v:'なし（非課税）'},
    ],
    salaryRows:[
      {pos:'機長（Captain）— 広胴機',sub:'B787-9',range:'¥4,320万〜¥5,760万',avg:'〜¥5,000万',pct:100,note:'SAR 90,000-120,000/月（非課税）',noteTag:'gold'},
      {pos:'機長（Captain）— 狭胴機',sub:'A321neo',range:'¥4,080万〜¥5,520万',avg:'〜¥4,800万',pct:92,note:'SAR 85,000-115,000/月（非課税）',noteTag:'gold'},
      {pos:'副操縦士（F/O）— 広胴機',sub:'B787-9',range:'¥3,120万',avg:'¥3,120万',pct:62,note:'SAR 65,000/月（非課税）',noteTag:'green'},
      {pos:'副操縦士（F/O）— 狭胴機',sub:'A321neo',range:'¥2,880万',avg:'¥2,880万',pct:56,note:'SAR 60,000/月（非課税）',noteTag:'green'},
    ],
    salaryNote:'※ SAR/JPY=40換算（2026年3月）。サウジアラビアに個人所得税なし。飛行時間超過手当（SAR 400〜600/時間）は別途支給。上記は基本月額×12ヶ月での試算。',
    ops:{
      routes:'リヤド発の国際線を中心に展開。2026年夏は15都市以上に就航予定：アンマン、バンコク、カイロ、ドバイ、ロンドン・ヒースロー、マドリード、マンチェスター、マニラ、ムンバイ、パリ・シャルル・ド・ゴール、クアラルンプール、ジャカルタ、イスラマバード、ラホール、ジェッダ。',
      fleet:'発注機材：Boeing 787-9（39機）、Airbus A321neo（60機）、Airbus A350-1000（25機）の計124機。2026年時点では主にB787-9とA321neoを運航。',
    },
    training:[
      {title:'型式訓練',body:'各機材の型式訓練は認定訓練センター（ATC）で実施。B787はボーイング認定センター、A321はエアバス認定センターを利用。'},
      {title:'国際基準訓練',body:'ICAO基準に準拠。すべての訓練はIATA Operational Safety Audit（IOSA）認証下で実施。'},
      {title:'審査体制',body:'定期プロフィシェンシーチェック（年2回）、路線審査、危機対応訓練（UPRT）を含む包括的な審査体系を構築中。'},
      {title:'昇格',body:'新設航空会社のため、初期から採用される副操縦士には今後の機長昇格機会が豊富。シニアティが蓄積される前の今がチャンス。'},
    ],
    benefits:[
      {icon:'🏠',title:'住宅',body:'リヤド市内の外国人向け住宅を支給。'},
      {icon:'📚',title:'子供教育費',body:'最大3名分の国際学校授業料を全額支援。'},
      {icon:'✈️',title:'無料渡航',body:'年間20往復の自宅-リヤド間ビジネスクラス無料航空券。'},
      {icon:'💹',title:'利益配分',body:'航空会社の利益に応じた年次配分（Profit Sharing）。'},
      {icon:'📈',title:'年次昇給',body:'毎年5%の自動昇給制度。'},
      {icon:'🎉',title:'ラマダンボーナス',body:'イスラム暦ラマダン月に特別ボーナス支給。'},
      {icon:'🏥',title:'医療・生命保険',body:'本人・家族対象のグローバル医療・生命保険を完備。'},
      {icon:'💰',title:'超過飛行手当',body:'月75時間超過分はSAR 400〜600/時間の追加支給。'},
    ],
    hiringStatus:'積極採用中（2026年3月現在）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'副操縦士（First Officer）— Boeing 787-9',sub:'ワイドボディ国際線副操縦士',status:'募集中',statusTag:'green',
        details:[
          {k:'必要飛行時間',v:'2,000時間以上（マルチクルー・ジェット機）'},
          {k:'必要資格',v:'有効なICAO ATPL'},
          {k:'身体検査',v:'第一種・制限なし'},
          {k:'英語',v:'ICAO英語能力 Level 5以上'},
          {k:'年齢',v:'59歳未満'},
        ],
        note:'※ 直近12ヶ月の操縦時間が一定基準以上であること。詳細はLatest Pilot Jobs掲載の原文をご確認ください。'},
      {title:'A321 Cadre Check Pilot（審査教官）— A321neo',sub:'A321型式の訓練・審査教官',status:'募集中',statusTag:'green',
        details:[
          {k:'必要資格',v:'A320/A321 TRI/TRE または相当'},
          {k:'経験',v:'A320ファミリー機長として相応の経験'},
          {k:'英語',v:'ICAO英語能力 Level 5以上'},
        ],
        note:''},
    ],
    recruitUrl:'https://www.riyadhair.com/en/careers/pilots',
  },

  {
    file:'wizz-air.html',
    code:'W6',
    color:'#c5007c',
    nameEn:'Wizz Air UK',
    nameJa:'ウィズエアUK（Wizz Air UK）',
    subtitle:'欧州最大級ウルトラLCC — Airbus A320ファミリー専業',
    tags:[
      {cls:'tag-blue',label:'🇬🇧 イギリス'},
      {cls:'tag-orange',label:'ULCC'},
      {cls:'tag-blue',label:'A320/A321'},
      {cls:'tag-gray',label:'欧州路線'},
    ],
    stats:[
      {val:'¥3,800万+',label:'機長総年収（参考値）',color:'#c5007c'},
      {val:'¥680万〜¥1,050万',label:'FO基本給',color:'#a855f7'},
      {val:'250機+',label:'A320ファミリー'},
      {val:'3.5〜5年',label:'FO→機長昇格目安'},
    ],
    overview:'ウィズエアUK（Wizz Air UK）は、ハンガリー系超格安航空会社ウィズエアのイギリス法人。英国に運航証明（AOC）を持ち、主にロンドン・ガトウィックなどを拠点として欧州各都市に運航する。Airbus A320/A321ファミリーのみを保有し、効率的なオペレーションを実現。欧州最大規模のULCC（Ultra Low Cost Carrier）の一つ。積極的な機材拡大に伴い、機長・副操縦士を定期採用している。',
    facts:[
      {k:'本社',v:'ロンドン（英国）'},
      {k:'親会社',v:'Wizz Air Holdings（ハンガリー）'},
      {k:'主要拠点',v:'ガトウィック空港・ルートン空港'},
      {k:'機材',v:'Airbus A320/A321 専業'},
      {k:'就航路線',v:'欧州中心（200路線以上）'},
      {k:'所得税',v:'あり（英国・最大45%）'},
    ],
    salaryRows:[
      {pos:'機長（Direct Entry Captain）',sub:'A320/A321',range:'¥1,850万〜¥2,768万（基本給）',avg:'総額¥3,800万+',pct:100,note:'Duty Pay込みで£200,000+も可能',noteTag:'orange'},
      {pos:'副操縦士（First Officer）',sub:'A320/A321型式あり',range:'¥680万〜¥1,050万（基本給）',avg:'¥1,000万〜',pct:35,note:'Duty Pay別途',noteTag:'gray'},
    ],
    salaryNote:'※ GBP/JPY=190換算（2026年3月）。英国は所得税が高く（最大45%）、手取りはグロスの50〜60%程度。中東系（非課税）との直接比較には注意。欧州ULCC特有の「Duty Pay（便ごと加算）」が総年収を大きく左右する。',
    ops:{
      routes:'英国・欧州各地（200路線以上）。ガトウィック・ルートン・バーミンガムを主要拠点に東欧・南欧へ多数就航。中東・アフリカへの路線も拡大中。',
      fleet:'Airbus A320/A321 250機以上（neo含む）。ウィズエアグループ全体では750機超の大規模フリートを保有。',
    },
    training:[
      {title:'A320型式訓練',body:'型式未取得者向けのType Rating訓練をウィズエア・パイロット・アカデミーで実施可能（費用は要確認）。型式取得済み者は差分訓練のみ。'},
      {title:'ライン訓練（LIFUS）',body:'型式訓練後はLine Flying Under Supervision（LIFUS）を経て資格完了。通常75フライト程度。'},
      {title:'機長昇格',body:'副操縦士から機長昇格まで平均3.5〜5年。最低3,000ファクタードアワー＋1,000時間PIC（A320）が必要。欧州ULCC最速水準のひとつ。'},
      {title:'定期審査',body:'OPC（Operator Proficiency Check）とLPC（License Proficiency Check）を年2回実施。EASAの要件に準拠。'},
    ],
    benefits:[
      {icon:'✈️',title:'スタッフ割引',body:'本人・家族向けの大幅割引航空券。ウィズエアグループ全便対象。'},
      {icon:'📈',title:'Duty Pay',body:'フライトごとの追加pay。これが総年収を大きく増加させる変動型報酬。'},
      {icon:'🏥',title:'医療保険',body:'英国の国民保険制度（NHS）に加えて私的医療保険オプション。'},
      {icon:'📅',title:'有給休暇',body:'欧州法定休暇（最低28日）を保障。'},
      {icon:'🎓',title:'訓練費補助',body:'状況により型式訓練費用の補助あり（詳細は採用時に確認）。'},
    ],
    hiringStatus:'採用中（2026年3月・要最新確認）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'機長（Captain）— Airbus A320/A321',sub:'Direct Entry Captain',status:'募集中（要確認）',statusTag:'blue',
        details:[
          {k:'必要時間',v:'大型ジェット（50t超）1,500時間以上'},
          {k:'PIC経験',v:'同機材で1,000時間以上'},
          {k:'資格',v:'有効なEASA ATPL'},
          {k:'年収目安',v:'£97,550〜145,700（基本給）+ Duty Pay'},
        ],
        note:'締切：2026年3月25日（要最新確認）'},
      {title:'副操縦士（First Officer）— Airbus A320/A321',sub:'A320型式取得済み・未取得どちらも応募可',status:'募集中（要確認）',statusTag:'blue',
        details:[
          {k:'必要時間',v:'ME/IR マルチクルー 500時間以上'},
          {k:'資格',v:'ATPL理論合格済み（EASA）'},
          {k:'追加',v:'JOC/APS-MCC（ジェット）修了'},
          {k:'年収目安',v:'£35,700〜55,000（基本給）+ Duty Pay'},
        ],
        note:''},
    ],
    recruitUrl:'https://www.latestpilotjobs.com/jobs/view/id/19249.html',
  },

  {
    file:'root-aviation.html',
    code:'ROOT',
    color:'#34d399',
    nameEn:'Root Aviation',
    nameJa:'ルートアビエーション（Root Aviation）',
    subtitle:'アジア地域専門パイロット紹介エージェント',
    tags:[
      {cls:'tag-blue',label:'🌏 アジア'},
      {cls:'tag-green',label:'エージェント'},
      {cls:'tag-blue',label:'B777案件'},
    ],
    stats:[
      {val:'アジア',label:'活動地域'},
      {val:'B777',label:'案件機材'},
      {val:'即戦力',label:'採用タイプ'},
      {val:'要問合せ',label:'年収詳細'},
    ],
    overview:'Root Aviationはアジア地域の航空会社向けにパイロット採用を支援する専門エージェンシー。航空会社への直接雇用ではなく、エージェントを通じたポジションマッチングを行う。今回の求人はB777機長へのアップグレード案件で、B747経験者を対象にアジア圏の特定航空会社への就職斡旋を行う。詳細な就航先・雇用条件はRoot Aviationへの問い合わせが必要。',
    facts:[
      {k:'業態',v:'パイロット紹介エージェント'},
      {k:'活動地域',v:'アジア'},
      {k:'雇用形態',v:'クライアント航空会社による直接雇用（エージェント経由）'},
      {k:'対象機材',v:'Boeing 777'},
      {k:'年収',v:'要問い合わせ（クライアントによる）'},
      {k:'案件更新',v:'2026年3月23日掲載'},
    ],
    salaryRows:[
      {pos:'B777 機長（PIC）アップグレード',sub:'アジア圏エアライン（詳細非公開）',range:'詳細非公開',avg:'要問合せ',pct:60,note:'クライアント航空会社による',noteTag:'gray'},
    ],
    salaryNote:'※ 年収はクライアント航空会社の条件による。Root Aviationへ直接問い合わせること。',
    ops:{
      routes:'アジア圏（クライアント航空会社によって異なる）。',
      fleet:'Boeing 777（アップグレード対象）。B747経験者優先。',
    },
    training:[
      {title:'B777型式訓練',body:'B747からB777へのアップグレード訓練。クライアント航空会社の訓練センターにて実施。'},
      {title:'Line Training',body:'型式訓練後のライン就航訓練。雇用先の規定による。'},
    ],
    benefits:[
      {icon:'🌏',title:'アジア就業',body:'アジア圏での飛行機会。航空会社の状況により待遇は異なる。'},
      {icon:'📞',title:'エージェントサポート',body:'Root Aviationによる就職活動サポート・交渉代行。'},
    ],
    hiringStatus:'案件あり（2026年3月時点・締切2026.04.10）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'B777 PIC アップグレード案件',sub:'B747経験者対象',status:'募集中',statusTag:'green',
        details:[
          {k:'対象者',v:'B747-400/B747-800 機長経験者'},
          {k:'案件',v:'B777機長へのアップグレード'},
          {k:'エリア',v:'アジア（詳細非公開）'},
        ],
        note:'※ 詳細はLatest Pilot Jobs経由またはRoot Aviationへ直接お問い合わせください。'},
    ],
    recruitUrl:'https://www.latestpilotjobs.com/jobs/view/id/19683.html',
  },

  {
    file:'eagle-jet.html',
    code:'EJI',
    color:'#5ec4ff',
    nameEn:'Eagle Jet International, Inc.',
    nameJa:'イーグルジェット・インターナショナル（Eagle Jet International）',
    subtitle:'欧州チャーター会社 — 低時間パイロット採用あり',
    tags:[
      {cls:'tag-blue',label:'🇪🇺 ヨーロッパ'},
      {cls:'tag-gray',label:'チャーター'},
      {cls:'tag-green',label:'低時間者歓迎'},
      {cls:'tag-orange',label:'契約採用'},
    ],
    stats:[
      {val:'欧州',label:'活動地域'},
      {val:'A320',label:'対象機材'},
      {val:'契約',label:'雇用形態'},
      {val:'低時間歓迎',label:'採用特徴'},
    ],
    overview:'Eagle Jet Internationalは欧州を拠点とするチャーターオペレーター。A320の副操縦士を対象に、EASAライセンス保有者で型式未取得の低時間パイロットも応募可能というユニークな採用を行っている。航空会社での路線経験を積みたい訓練修了直後のパイロットにとって貴重な機会。雇用形態は契約ベース（フリーランス含む）。',
    facts:[
      {k:'業態',v:'チャーター運航会社'},
      {k:'地域',v:'欧州'},
      {k:'機材',v:'Airbus A320'},
      {k:'雇用形態',v:'契約社員（Contract/Freelance）'},
      {k:'採用特徴',v:'低時間者・型式未取得者歓迎'},
      {k:'応募先',v:'info@eaglejet.com'},
    ],
    salaryRows:[
      {pos:'副操縦士（F/O）契約',sub:'A320チャーター運航',range:'詳細非公開',avg:'要問合せ',pct:30,note:'契約ベース',noteTag:'gray'},
    ],
    salaryNote:'※ 契約ベースのため年収は就業量・条件による。欧州チャーターFOの一般的相場は年€30,000〜60,000程度。詳細はEagle Jetへ直接問い合わせること。',
    ops:{
      routes:'欧州各地のチャーター運航。詳細ルートは非公開。',
      fleet:'Airbus A320。',
    },
    training:[
      {title:'型式訓練（必要に応じて）',body:'A320型式未取得者の場合、入社後または入社前に自費での型式取得が必要になる場合あり。詳細は要確認。'},
      {title:'OJT',body:'チャーター運航を通じてのライン経験積み。'},
    ],
    benefits:[
      {icon:'✈️',title:'路線経験',body:'欧州チャーター路線での実務経験取得。'},
      {icon:'📄',title:'契約柔軟性',body:'契約ベースのため就業時間の柔軟性がある場合も。'},
    ],
    hiringStatus:'応募受付中（2026年3月時点・締切2026.04.04）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'副操縦士（F/O）— Airbus A320',sub:'EASA免許保有者・低時間・型式未取得者歓迎',status:'募集中',statusTag:'green',
        details:[
          {k:'応募条件',v:'有効なEASA計器飛行証明（IR）'},
          {k:'型式',v:'A320型式資格（なくても応募可）'},
          {k:'雇用形態',v:'契約社員（Contract/Freelancer）'},
          {k:'応募先',v:'info@eaglejet.com'},
        ],
        note:''},
    ],
    recruitUrl:'https://www.latestpilotjobs.com/jobs/view/id/18174.html',
  },

  {
    file:'airx-charter.html',
    code:'AXC',
    color:'#a78bfa',
    nameEn:'AirX Charter Ltd',
    nameJa:'エアXチャーター（AirX Charter Ltd）',
    subtitle:'マルタ拠点の欧州プライベートチャーター会社',
    tags:[
      {cls:'tag-blue',label:'🇪🇺 ヨーロッパ（マルタ）'},
      {cls:'tag-gray',label:'チャーター'},
      {cls:'tag-gold',label:'正社員'},
      {cls:'tag-blue',label:'EMB170/190'},
    ],
    stats:[
      {val:'マルタ',label:'本拠地'},
      {val:'EMB170/190',label:'対象機材'},
      {val:'正社員',label:'雇用形態'},
      {val:'要確認',label:'年収詳細'},
    ],
    overview:'AirX Charter Ltdはマルタを拠点とする欧州のプライベートチャーター会社。Embraer Lineage 1000（EMB170/190ベース）を用いた高品質なチャーターフライトを提供。副操縦士を正社員として採用予定。プライベートアビエーション・チャーター運航でのキャリアを積みたいパイロットに向けた機会。',
    facts:[
      {k:'本拠地',v:'マルタ（EU）'},
      {k:'業態',v:'プライベートチャーター'},
      {k:'対象機材',v:'Embraer Lineage 1000（EMB170/190）'},
      {k:'雇用形態',v:'正社員'},
      {k:'免許要件',v:'EASA CPL/ATPL'},
      {k:'締切',v:'2026年4月11日'},
    ],
    salaryRows:[
      {pos:'副操縦士（F/O）',sub:'Embraer EMB170/190 チャーター',range:'詳細非公開',avg:'要問合せ',pct:35,note:'欧州チャーターFO水準',noteTag:'gray'},
    ],
    salaryNote:'※ 詳細年収はAirX Charterへの問い合わせが必要。欧州プライベートチャーターFOの一般相場は€35,000〜70,000/年程度（正社員）。',
    ops:{
      routes:'欧州各地のプライベートチャーター。顧客は個人・法人の富裕層。',
      fleet:'Embraer Lineage 1000（EMB170/190ベースの大型プライベートジェット）。',
    },
    training:[
      {title:'EMB型式訓練',body:'EMB170/190型式資格が必要。資格未保有の場合は訓練が必要。詳細はAirXへ確認。'},
      {title:'チャーター運航訓練',body:'プライベートチャーター特有の運航手順・顧客対応を含む訓練。'},
    ],
    benefits:[
      {icon:'✈️',title:'チャーター経験',body:'富裕層向けのプライベートフライト経験。'},
      {icon:'🇪🇺',title:'欧州在住',body:'EU（マルタ）を拠点とした生活が可能。'},
      {icon:'💼',title:'正社員雇用',body:'契約社員ではなく正社員採用。安定した雇用。'},
    ],
    hiringStatus:'採用中（2026年3月時点・締切2026.04.11）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'副操縦士（F/O）— Embraer Lineage 1000（EMB170/190）',sub:'欧州プライベートチャーター運航',status:'募集中',statusTag:'green',
        details:[
          {k:'必要資格',v:'有効なEASA CPL/ATPL'},
          {k:'型式',v:'EMB170/190型式資格（あれば優遇）'},
          {k:'雇用形態',v:'正社員（Full Time）'},
        ],
        note:''},
    ],
    recruitUrl:'https://www.latestpilotjobs.com/jobs/view/id/19489.html',
  },

  {
    file:'solairus.html',
    code:'SOL',
    color:'#3d9bff',
    nameEn:'Solairus Aviation',
    nameJa:'ソレイラス・アビエーション（Solairus Aviation）',
    subtitle:'米国大手プライベートアビエーション会社',
    tags:[
      {cls:'tag-orange',label:'🇺🇸 アメリカ'},
      {cls:'tag-gold',label:'ビジネスジェット'},
      {cls:'tag-blue',label:'G600機長'},
      {cls:'tag-gray',label:'テキサス'},
    ],
    stats:[
      {val:'テキサス',label:'勤務地'},
      {val:'Gulfstream G600',label:'対象機材'},
      {val:'正社員',label:'雇用形態'},
      {val:'$150K+',label:'年収目安（参考）'},
    ],
    overview:'Solairus Aviationは米国最大規模のプライベートアビエーション会社のひとつ。法人・個人向けのチャータージェット運航管理を行い、米国各地を拠点に高品質なビジネスジェットサービスを提供。テキサス州オースティンを拠点としたGulfstream G600機長を採用中。プライベートアビエーション分野で最高クラスの機材を操縦する機会。',
    facts:[
      {k:'本社',v:'カリフォルニア州（米国）'},
      {k:'案件勤務地',v:'テキサス州オースティン'},
      {k:'業態',v:'プライベートチャーター（Part 135）'},
      {k:'対象機材',v:'Gulfstream G600'},
      {k:'雇用形態',v:'正社員'},
      {k:'所得税',v:'あり（米国連邦・州税）'},
    ],
    salaryRows:[
      {pos:'機長（Captain）— Gulfstream G600',sub:'プライベートチャーター運航',range:'$150,000〜$250,000+/年',avg:'¥2,300万〜¥3,800万',pct:60,note:'USD/JPY=150換算',noteTag:'blue'},
    ],
    salaryNote:'※ USD/JPY=150換算（2026年3月）。米国プライベートアビエーションのG600機長相場。連邦・州所得税あり。実際の待遇はSolairus Aviationへの確認が必要。',
    ops:{
      routes:'米国全土および国際チャーター（主にビジネス需要）。オースティンを拠点とした主要都市間フライト。',
      fleet:'Gulfstream G600（他にもG550、G450、Challenger等を保有）。',
    },
    training:[
      {title:'G600型式訓練',body:'Gulfstream G600の型式資格（必須）。FlightSafetyまたはCAE等での訓練。'},
      {title:'Part 135訓練',body:'米国FAA Part 135（チャーター運航）の規定に基づく訓練。'},
    ],
    benefits:[
      {icon:'✈️',title:'最高峰機材',body:'Gulfstream G600という最高クラスのビジネスジェットを操縦。'},
      {icon:'💰',title:'高年収',body:'ビジネスジェット機長として業界トップレベルの待遇。'},
      {icon:'🏠',title:'拠点安定',body:'テキサス州オースティンを拠点とした安定勤務。'},
    ],
    hiringStatus:'採用中（2026年3月時点・締切2026.04.08）',
    hiringStatusColor:'#34d399',
    jobs:[
      {title:'機長（Captain）— Gulfstream G600',sub:'テキサス州オースティン拠点',status:'募集中',statusTag:'green',
        details:[
          {k:'必要資格',v:'Gulfstream G600（またはG500）型式証明'},
          {k:'免許',v:'FAA ATP Certificate'},
          {k:'勤務地',v:'テキサス州オースティン'},
        ],
        note:'※ 詳細はLatest Pilot Jobs掲載の原文をご確認ください。'},
    ],
    recruitUrl:'https://www.latestpilotjobs.com/jobs/view/id/18579.html',
  },

];

airlines.forEach(a => {
  const html = page(a);
  writeFileSync(new URL(`./airlines/${a.file}`, import.meta.url), html);
  console.log(`Created: ${a.file}`);
});
console.log('All world airline pages generated!');
