import { writeFileSync } from 'fs';
const CSS=`*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}body{background:#0a0c0f;color:#e8edf2;font-family:'Inter','Noto Sans JP',sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:128px;opacity:.3}nav{position:fixed;top:0;left:0;right:0;z-index:200;transition:background .4s}nav.scrolled{background:rgba(10,12,15,.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}.nav-link{color:rgba(255,255,255,.6);font-size:.85rem;font-weight:500;letter-spacing:.04em;transition:color .2s;text-decoration:none}.nav-link:hover{color:#fff}.glass{background:rgba(17,22,32,.7);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.07);border-radius:16px}.glass-raised{background:rgba(24,33,47,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.10);border-radius:16px}.tag{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:600}.tag-blue{background:rgba(61,155,255,.12);color:#5fb0ff;border:1px solid rgba(61,155,255,.2)}.tag-gold{background:rgba(245,200,66,.10);color:#f5c842;border:1px solid rgba(245,200,66,.2)}.tag-green{background:rgba(52,211,153,.10);color:#34d399;border:1px solid rgba(52,211,153,.2)}.tag-gray{background:rgba(255,255,255,.06);color:#8899aa;border:1px solid rgba(255,255,255,.1)}.tag-orange{background:rgba(249,115,22,.12);color:#fb923c;border:1px solid rgba(249,115,22,.2)}.tag-red{background:rgba(232,25,44,.12);color:#ff5555;border:1px solid rgba(232,25,44,.2)}.btn-orange{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:10px;background:linear-gradient(135deg,#f97316,#f5c842);color:#000;font-size:.9rem;font-weight:600;text-decoration:none;transition:opacity .2s,transform .2s}.btn-orange:hover{opacity:.9;transform:translateY(-1px)}.btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.875rem;font-weight:600;border:1px solid rgba(255,255,255,.12);text-decoration:none;transition:background .2s}.btn-ghost:hover{background:rgba(255,255,255,.12)}.fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s cubic-bezier(.16,1,.3,1)}.fade-up.visible{opacity:1;transform:translateY(0)}.salary-bar-track{height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}.salary-bar-fill{height:100%;border-radius:999px;transition:width 1.4s cubic-bezier(.16,1,.3,1);width:0}.stat-card{padding:20px;border-radius:14px;background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)}.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7d93;padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07)}td{padding:13px 16px;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background:rgba(255,255,255,.02)}.logo-img{height:44px;width:auto;filter:brightness(1.15) drop-shadow(0 0 8px rgba(249,115,22,.5))}.info-card{background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:24px;margin-bottom:8px}footer{background:#060809;border-top:1px solid rgba(255,255,255,.05)}.hero-airline{position:relative;padding:160px 0 80px;overflow:hidden}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}`;
const JS=`window.addEventListener('scroll',()=>{document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40)},{passive:true});const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');animateBars(e.target);io.unobserve(e.target);}});},{threshold:0.01,rootMargin:'0px 0px -30px 0px'});function animateBars(c){c.querySelectorAll('[data-width]').forEach(b=>{b.style.width='0';setTimeout(()=>{b.style.width=(b.dataset.width||0)+'%';},80);});}document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));setTimeout(()=>{document.querySelectorAll('.fade-up:not(.visible)').forEach(el=>{el.classList.add('visible');animateBars(el);});},300);`;

function page(a){return`<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${a.nameJa} パイロット情報 | PILOT VALUE</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet"/>
<style>${CSS}.section-badge{background:${a.color}18;border:1px solid ${a.color}40;color:${a.color}}</style></head>
<body class="relative">
<nav id="main-nav"><div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
<a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" class="logo-img"/></a>
<div class="hidden md:flex items-center gap-6"><a href="../index.html#compare" class="nav-link">日本 vs 海外</a><a href="../index.html#ranking" class="nav-link">機長ランキング</a><a href="../world-airlines.html" class="nav-link" style="color:#f5c842">世界の航空会社</a></div>
<a href="../world-airlines.html" class="btn-ghost text-sm py-2 px-4">← 世界の航空会社</a>
</div></nav>
<div class="hero-airline" style="background:linear-gradient(180deg,${a.color}12 0%,transparent 60%)">
<div class="absolute inset-0" style="background:radial-gradient(ellipse 50% 60% at 20% 40%,${a.color}10 0%,transparent 70%)"></div>
<div class="max-w-7xl mx-auto px-6 relative">
<div class="flex items-start gap-6 mb-8">
<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0" style="background:${a.color}20;color:${a.color};border:1px solid ${a.color}35">${a.code}</div>
<div><div class="flex flex-wrap items-center gap-3 mb-3">${a.tags.map(t=>`<span class="tag ${t.cls}">${t.label}</span>`).join('')}</div>
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-2" style="background:linear-gradient(135deg,#fff,${a.color});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${a.nameJa}</h1>
<p class="text-muted text-lg">${a.nameEn} — ${a.subtitle}</p></div></div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">${a.stats.map(s=>`<div class="stat-card text-center"><div class="text-xl font-extrabold mb-1" style="color:${s.color||a.color}">${s.val}</div><div class="text-xs text-muted">${s.label}</div></div>`).join('')}</div>
</div></div>
<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">
<div class="glass p-8 fade-up"><div class="section-badge mb-4">概要</div><h2 class="text-2xl font-bold mb-4">${a.nameJa}について</h2>
<div class="grid lg:grid-cols-2 gap-8"><p class="text-muted leading-relaxed">${a.overview}</p>
<div class="grid grid-cols-2 gap-4">${a.facts.map(f=>`<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${f.k}</div><div class="font-semibold text-sm">${f.v}</div></div>`).join('')}</div></div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">年収データ</div>
<h2 class="text-2xl font-bold mb-2">パイロット年収（2026年3月・参考値）</h2>
<p class="text-xs text-muted mb-6">※ 掲載年収は公開データ・業界水準を基にした参考値です。実際の給与条件は各社採用情報でご確認ください。</p>
<div class="overflow-x-auto mb-4"><table><thead><tr><th>ポジション</th><th>年収レンジ</th><th>参考中央値</th><th>備考</th></tr></thead><tbody>
${a.salaryRows.map(r=>`<tr><td><span class="font-semibold">${r.pos}</span><br><span class="text-xs text-muted">${r.sub}</span></td>
<td><div class="text-sm">${r.range}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${a.color}88,${a.color})" data-width="${r.pct}"></div></div></td>
<td><span class="font-bold text-lg" style="color:${a.color}">${r.avg}</span></td>
<td><span class="tag tag-${r.noteTag||'gray'}">${r.note}</span></td></tr>`).join('')}
</tbody></table></div>
<p class="text-xs text-muted">${a.salaryNote}</p></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">運航環境</div><h2 class="text-2xl font-bold mb-6">路線・機材</h2>
<div class="grid md:grid-cols-2 gap-6">
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">就航路線</div><p class="text-muted text-sm leading-relaxed">${a.ops.routes}</p></div>
<div><div class="text-xs text-muted uppercase tracking-widest font-semibold mb-3">保有機材</div><p class="text-muted text-sm leading-relaxed">${a.ops.fleet}</p></div>
</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">訓練環境</div><h2 class="text-2xl font-bold mb-6">訓練・審査</h2>
<div class="grid md:grid-cols-2 gap-4">${a.training.map(t=>`<div class="info-card"><div class="font-semibold mb-2" style="color:${a.color}">${t.title}</div><p class="text-sm text-muted">${t.body}</p></div>`).join('')}</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">福利厚生</div><h2 class="text-2xl font-bold mb-6">ベネフィット</h2>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${a.benefits.map(b=>`<div class="stat-card"><div class="text-2xl mb-2">${b.icon}</div><div class="font-semibold text-sm mb-1">${b.title}</div><p class="text-xs text-muted">${b.body}</p></div>`).join('')}</div></div>
<div class="glass p-8 fade-up"><div class="section-badge mb-4">募集要項</div><h2 class="text-2xl font-bold mb-2">採用情報（2026年3月現在）</h2>
<p class="text-sm text-muted mb-6">採用状況：<strong style="color:${a.hiringColor||a.color}">${a.hiringStatus}</strong></p>
<div class="space-y-5">${a.jobs.map(j=>`<div class="glass-raised p-6" style="border-color:${a.color}25">
<div class="flex items-start justify-between mb-3 flex-wrap gap-2"><div><div class="font-bold text-base mb-0.5">${j.title}</div><div class="text-sm text-muted">${j.sub}</div></div>
<span class="tag tag-${j.stag}">${j.status}</span></div>
<div class="grid sm:grid-cols-2 gap-3 mb-3">${j.details.map(d=>`<div class="text-sm"><span class="text-muted">${d.k}：</span><span>${d.v}</span></div>`).join('')}</div>
${j.note?`<p class="text-xs text-muted mt-2">${j.note}</p>`:''}</div>`).join('')}</div>
${a.recruitUrl?`<div class="mt-6"><a href="${a.recruitUrl}" target="_blank" class="btn-orange">採用ページへ（外部サイト）<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M8 2h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></a></div>`:''}
</div></div>
<footer class="py-10"><div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
<a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" style="height:28px;opacity:.7"/></a>
<p class="text-xs text-muted">掲載年収は参考値。実際の条件は各社公式サイトでご確認ください。</p>
<a href="../world-airlines.html" class="btn-ghost text-sm py-2 px-4">← 世界の航空会社</a>
</div></footer>
<script>${JS}<\/script><script src="../currency.js"><\/script></body></html>`;}

const T_US=[
  {title:'型式訓練（FAA承認）',body:'FAA認定ATO（承認訓練機関）での型式訓練。Part 142訓練センター（CAE・FlightSafety等）を利用。地上学科→シミュレーター→LOFT。'},
  {title:'IOE（Initial Operating Experience）',body:'型式取得後、教官機長（Check Airman）同乗のもとでInitial Operating Experienceを実施。通常25〜50レグ程度。'},
  {title:'定期審査（PC/LOE）',body:'年1〜2回のProficiency Check（PC）またはLine Operational Evaluation（LOE）。FAA Part 121/135準拠。'},
  {title:'機長昇格',body:'シニオリティ制が基本。必要飛行時間（通常5,000〜8,000h以上）とCheck Airmanによる審査をクリア。R-ATP（1,500h）制度あり。'},
];
const T_OC=[
  {title:'型式訓練（CASA/CAA NZ承認）',body:'CASA（オーストラリア）またはCAA New Zealand認定訓練センターでの型式訓練。OEMセンターまたは自社シミュレーターを使用。'},
  {title:'LIFUS',body:'型式取得後、教官機長同乗のライン訓練。通常50〜80レグ程度。'},
  {title:'定期審査（OPC/LPC）',body:'年1〜2回のProficiency Check。各国民間航空規制準拠。'},
  {title:'機長昇格',body:'シニオリティ制が基本。CASA/CAA NZの要件を満たした後、社内審査で昇格。'},
];
const T_LA=[
  {title:'型式訓練（ICAO/各国当局承認）',body:'各国航空当局（ANAC/Aerocivil/DGAC等）認定またはFAA/EASA準拠の訓練センターでの型式訓練。'},
  {title:'LIFUS',body:'型式取得後、教官機長同乗のライン訓練を実施。'},
  {title:'定期審査',body:'年1〜2回のProficiency Check。各国規制に準拠。'},
  {title:'機長昇格',body:'シニオリティ制が主流。飛行時間要件は各社・各国規制に依存。'},
];
const B_US=[
  {icon:'✈️',title:'スタッフトラベル（Pass）',body:'本人・家族向けのPassトラベル。自社便・提携会社での無料または大幅割引搭乗。'},
  {icon:'🏥',title:'医療・歯科・眼科保険',body:'包括的な医療保険（本人・家族）。ライセンス喪失保険も一般的。'},
  {icon:'💰',title:'401(k)退職年金',body:'会社マッチング付き確定拠出型年金（401(k)）。最大5〜16%のマッチングが多い。'},
  {icon:'📅',title:'有給休暇',body:'年間15〜30日程度（シニオリティにより増加）。フリップ・スキップ等の休暇取得柔軟性あり。'},
  {icon:'💵',title:'パーディエム（Per Diem）',body:'飛行日の日当（$2〜4/時間程度）。国内線・国際線で異なる。'},
  {icon:'🌐',title:'国際線手当',body:'国際線乗務者への追加手当・宿泊費支給。'},
];
const B_OC=[
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引または無料搭乗特典。アライアンス提携会社含む。'},
  {icon:'🏥',title:'医療保険',body:'オーストラリア・NZの公的医療（Medicare/ACC）に加え、民間医療保険（含む歯科）。'},
  {icon:'💰',title:'スーパーアニュエーション（退職年金）',body:'豪州：Superannuation（法定積立11%以上）、NZ：KiwiSaver。老後の手厚い積立制度。'},
  {icon:'📅',title:'有給休暇',body:'年間20〜25日。オーストラリア・NZの労働法に準拠。'},
  {icon:'💵',title:'日当（Per Diem）',body:'乗務時の日当。国内・国際線で異なる。'},
  {icon:'🌏',title:'路線多様性',body:'南太平洋・アジア・欧州・北米路線とオセアニア域内の多様な乗務機会。'},
];
const B_LA=[
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引搭乗特典。アライアンス提携会社利用可。'},
  {icon:'🏥',title:'医療保険',body:'本人・家族向けの医療保険。各国の公的医療との組み合わせ。'},
  {icon:'💰',title:'ボーナス',body:'業績連動型ボーナス。年1〜2回払い。'},
  {icon:'📅',title:'有給休暇',body:'年間15〜25日。各国労働法準拠。'},
];

const airlines=[

// ── Americas (US/Canada) ─────────────────────────────────────────────────────
{
  file:'alaska-airlines.html',code:'AS',color:'#0060AB',
  nameEn:'Alaska Airlines',nameJa:'アラスカ航空（Alaska Airlines）',
  subtitle:'米国西海岸最大の航空会社 · ワンワールド加盟',
  tags:[{cls:'tag-blue',label:'🇺🇸 米国'},{cls:'tag-blue',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'西海岸No.1'}],
  stats:[{val:'¥5,250万〜6,000万+',label:'機長年収（税引前）',color:'#0060AB'},{val:'¥2,250万〜3,750万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約350機',label:'保有機材数'},{val:'120都市+',label:'就航都市数'}],
  overview:'アラスカ航空は米国西海岸・アラスカ州を基盤に全米・カナダ・メキシコ・中南米・ハワイに就航する大手航空会社。ワンワールド加盟。ホライゾン航空を子会社に持ち、2016年にヴァージン・アメリカを買収して拡大。B737 MAXを中心に統一フリートへ移行中。米国の主要キャリアの中では比較的安定した財務状況で知られる。',
  facts:[{k:'本社',v:'シアトル（米国）'},{k:'ハブ',v:'シアトル・タコマ空港（SEA）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1932年'},{k:'保有機材',v:'約350機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（B737/A320系）',range:'¥5,250万〜¥6,000万+',avg:'¥5,600万',pct:100,note:'USD建て・税引前',noteTag:'gold'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥2,250万〜¥3,750万',avg:'¥3,000万',pct:54,note:'シニオリティ制',noteTag:'blue'},
  ],
  salaryNote:'※ USD/JPY=150換算。米国連邦所得税最高37%＋州税。2024年の新労働協約でキャプテン年収$350,000〜$400,000+（約¥5,250万〜6,000万）に引き上げ。業界水準参考値。',
  ops:{routes:'シアトル・サンフランシスコ・ポートランド等西海岸ハブから全米・アラスカ・ハワイ・カナダ・メキシコ・中南米・コスタリカ等に就航。',fleet:'Boeing 737-900/MAX 9, B737-800/MAX 8, Airbus A319/A320/A321（ヴァージン継承分）。約350機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'定期採用中。FAA ATP保有者対象。米国就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。シアトル/ポートランドベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）またはR-ATP（1,000h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'機長7,000h以上（目安）'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ 日本国籍者は就労ビザ（H-1B等）または永住権が必要。採用倍率は高い。'},
  ],
  recruitUrl:'https://jobs.alaskaair.com',
},

{
  file:'jetblue.html',code:'B6',color:'#003876',
  nameEn:'JetBlue Airways',nameJa:'ジェットブルー航空（JetBlue Airways）',
  subtitle:'米国プレミアムLCC · 快適性で差別化',
  tags:[{cls:'tag-blue',label:'🇺🇸 米国'},{cls:'tag-orange',label:'LCC/ULCC混合'},{cls:'tag-gray',label:'独立系'},{cls:'tag-gold',label:'コスパ重視'}],
  stats:[{val:'¥2,850万〜4,050万',label:'機長年収（税引前）',color:'#003876'},{val:'¥1,350万〜2,250万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約280機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'ジェットブルー航空は2000年設立の米国プレミアムLCC。ニューヨーク（JFK/EWR）・ボストンをベースに北米・カリブ海・中南米・欧州（ロンドン・アムステルダム等）に就航。全席に個人液晶モニター・広めのシートを装備し「快適なLCC」として差別化。スピリット航空との合併交渉は2024年に破談。A320族とA220が主力。',
  facts:[{k:'本社',v:'ニューヨーク（米国）'},{k:'ハブ',v:'JFK/ボストン（BOS）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'2000年'},{k:'保有機材',v:'約280機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（A320/A220）',range:'¥2,850万〜¥4,050万',avg:'¥3,400万',pct:100,note:'USD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥1,350万〜¥2,250万',avg:'¥1,800万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。米国連邦所得税最高37%。$190,000〜$270,000（機長）の業界水準参考値。ニューヨークは生活費が高く注意。',
  ops:{routes:'JFK/ボストンハブから米国東海岸・カリブ海（50都市以上）・中南米・西海岸・欧州（ロンドン・アムステルダム）に就航。',fleet:'Airbus A321neo/XLR, A321ceo, A320ceo, A220-300。約280機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'定期採用中。FAA ATP保有者対象。米国就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。JFK/ボストンベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'機長7,000h以上（目安）'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ JetBlueは独特の企業文化（クルーフォーカス）で知られ、従業員満足度が高い。'},
  ],
  recruitUrl:'https://careers.jetblue.com',
},

{
  file:'spirit.html',code:'NK',color:'#FFD700',
  nameEn:'Spirit Airlines',nameJa:'スピリット航空（Spirit Airlines）',
  subtitle:'米国最大のULCC · 超低コスト特化',
  tags:[{cls:'tag-gold',label:'🇺🇸 米国'},{cls:'tag-orange',label:'ULCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-red',label:'再建中'}],
  stats:[{val:'¥1,650万〜3,000万',label:'機長年収（税引前）',color:'#FFD700'},{val:'¥900万〜1,650万',label:'FO年収（税引前）',color:'#f5c842'},{val:'約190機',label:'保有機材数'},{val:'80都市+',label:'就航都市数'}],
  overview:'スピリット航空は米国最大のULCC（超低コスト航空）。徹底したアンバンドル戦略（基本運賃に手荷物・座席指定等を別途課金）で低運賃を実現。2024年11月に連邦破産法適用を申請し再建手続き中（2025年1月承認済み）。A320族で統一されたフリート。再建後の採用状況は要確認。',
  facts:[{k:'本社',v:'マイラマー（米国フロリダ）'},{k:'ハブ',v:'フォートローダーデール（FLL）・アトランタ'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1980年'},{k:'保有機材',v:'約190機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（A320族）',range:'¥1,650万〜¥3,000万',avg:'¥2,200万',pct:100,note:'USD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥900万〜¥1,650万',avg:'¥1,200万',pct:55,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。$110,000〜$200,000（機長）の業界水準参考値。2024〜2025年の破産再建プロセス中のため、実際の条件・採用状況は大きく変動している可能性あり。',
  ops:{routes:'フォートローダーデール・アトランタハブから米国国内線・カリブ海・中南米・メキシコに就航。',fleet:'Airbus A321neo/ceo, A320neo/ceo, A319。約190機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'2024年11月破産法申請・再建中。採用状況は要確認。',
  hiringColor:'#6b7d93',
  jobs:[
    {title:'機長・副操縦士（採用状況要確認）',sub:'国内外線乗務。再建プロセス中。',status:'要公式確認',stag:'gray',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'要確認'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ 2024〜2025年の連邦破産法申請・再建プロセス中のため、採用・雇用条件は不安定。最新情報を必ずご確認ください。'},
  ],
  recruitUrl:'https://www.spirit.com/about/careers',
},

{
  file:'frontier.html',code:'F9',color:'#00AE42',
  nameEn:'Frontier Airlines',nameJa:'フロンティア航空（Frontier Airlines）',
  subtitle:'米国環境重視のULCC · 動物テールデザインで有名',
  tags:[{cls:'tag-green',label:'🇺🇸 米国'},{cls:'tag-orange',label:'ULCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-blue',label:'コロラド'}],
  stats:[{val:'¥1,500万〜2,700万',label:'機長年収（税引前）',color:'#00AE42'},{val:'¥750万〜1,500万',label:'FO年収（税引前）',color:'#34d399'},{val:'約130機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'フロンティア航空はデンバーを拠点とするULCCで、各機の尾翼に異なる動物デザインを施すユニークなブランディングで知られる。A320族に統一されたフリートで米国全土・カリブ海・メキシコ・中南米に就航。スピリット航空との合併交渉は2023年に破談。燃費効率の高い機材で「グリーン航空会社」を標榜。',
  facts:[{k:'本社',v:'デンバー（米国コロラド）'},{k:'ハブ',v:'デンバー（DEN）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1994年'},{k:'保有機材',v:'約130機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（A320族）',range:'¥1,500万〜¥2,700万',avg:'¥2,100万',pct:100,note:'USD建て・税引前',noteTag:'green'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥750万〜¥1,500万',avg:'¥1,100万',pct:52,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。$100,000〜$180,000（機長）の業界水準参考値。ULCCの中では比較的安定した採用を継続。',
  ops:{routes:'デンバーハブから米国全土・カリブ海・メキシコ・中南米に就航。季節運航路線も多い。',fleet:'Airbus A321neo, A320neo, A319。約130機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'定期採用中。FAA ATP保有者対象。米国就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。デンバーベース主体。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'要確認'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ A320族型式評価（A320 Type Rating）保有者優遇。'},
  ],
  recruitUrl:'https://www.flyfrontier.com/fly/about-us/careers/',
},

{
  file:'allegiant.html',code:'G4',color:'#F4A024',
  nameEn:'Allegiant Air',nameJa:'アリジャント エアー（Allegiant Air）',
  subtitle:'米国小規模都市に特化したULCC · 観光路線専門',
  tags:[{cls:'tag-gold',label:'🇺🇸 米国'},{cls:'tag-orange',label:'ULCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-blue',label:'リゾート特化'}],
  stats:[{val:'¥1,500万〜2,700万',label:'機長年収（税引前）',color:'#F4A024'},{val:'¥750万〜1,500万',label:'FO年収（税引前）',color:'#f5c842'},{val:'約130機',label:'保有機材数'},{val:'130都市+',label:'就航都市数'}],
  overview:'アリジャント エアーは米国の小規模都市から直接ラスベガス・フロリダ等の観光地へ低運賃でつなぐ独特のビジネスモデルのULCC。直航路線に特化し乗継なし・週2〜3便の効率的な運航が特徴。A320族に移行中でボーイング機も保有。ラスベガス本社で経営効率を重視した成長を続ける。',
  facts:[{k:'本社',v:'ラスベガス（米国ネバダ）'},{k:'ハブ',v:'ラスベガス（LAS）・サンフランシスコ（SFO）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1997年'},{k:'保有機材',v:'約130機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内線（A320族）',range:'¥1,500万〜¥2,700万',avg:'¥2,000万',pct:100,note:'USD建て・税引前',noteTag:'gold'},
    {pos:'副操縦士（First Officer）',sub:'国内線',range:'¥750万〜¥1,500万',avg:'¥1,050万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。$100,000〜$180,000（機長）の業界水準参考値。米国国内線専門の安定したビジネスモデル。',
  ops:{routes:'ラスベガス・フロリダ・アリゾナ等観光地と全米の小規模都市（130+）を直結。乗継なし直航モデルが特徴。',fleet:'Airbus A320, A319, Boeing 757-200（一部）。約130機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'定期採用中。FAA ATP保有者対象。米国就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内線乗務。ラスベガスベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'要確認'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ 週2〜3便の運航スタイルで、他の仕事・家族との両立が比較的容易とされる。'},
  ],
  recruitUrl:'https://www.allegiantair.com/about-allegiant/careers',
},

{
  file:'air-canada.html',code:'AC',color:'#C8102E',
  nameEn:'Air Canada',nameJa:'エア カナダ（Air Canada）',
  subtitle:'カナダ最大のフラッグキャリア · スターアライアンス加盟',
  tags:[{cls:'tag-red',label:'🇨🇦 カナダ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'北米第2位'}],
  stats:[{val:'¥2,750万〜4,400万',label:'機長年収（税引前）',color:'#C8102E'},{val:'¥1,375万〜2,200万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約200機',label:'保有機材数'},{val:'230都市+',label:'就航都市数'}],
  overview:'エア カナダはカナダ最大のフラッグキャリア。トロント・モントリオール・バンクーバーをハブに世界230都市以上に就航。スターアライアンス加盟。カナダは所得税あり（最高33%連邦税＋州税）。CAD（カナダドル）建て給与はUSD比較でやや低めだが生活水準が高い。B787・B777・A220が主力。ルージュ（子会社LCC）も運営。',
  facts:[{k:'本社',v:'モントリオール（カナダ）'},{k:'ハブ',v:'トロント（YYZ）・バンクーバー（YVR）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1936年'},{k:'保有機材',v:'約200機'},{k:'所得税',v:'あり（連邦最高33%＋州税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ（B787/B777）',range:'¥2,750万〜¥4,400万',avg:'¥3,500万',pct:100,note:'CAD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国際線',range:'¥1,375万〜¥2,200万',avg:'¥1,800万',pct:51,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ CAD/JPY=110換算。連邦所得税33%＋州税（オンタリオ州最高13.16%等）。CAD $250,000〜$400,000（機長）の業界水準参考値。カナダは公的医療・社会保障が充実。',
  ops:{routes:'トロント・バンクーバーハブから北米全土・欧州（ロンドン・フランクフルト等）・アジア（東京・香港等）・南米・カリブ海・オーストラリアに就航。',fleet:'Boeing 787-8/9, B777-200LR/300ER, B737 MAX 8, Airbus A220-300, A319/A320/A321。約200機。'},
  training:T_US,
  benefits:[...B_US,{icon:'🏥',title:'カナダ公的医療',body:'カナダはMedicare（州立公的医療）で基本医療費無料。歯科・眼科は追加保険でカバー。'}],
  hiringStatus:'定期採用中。Transport Canada ATP保有者対象。カナダ就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。トロント/バンクーバーベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'Transport Canada ATPL'},{k:'英語',v:'ICAO Level 4以上（英仏バイリンガル優遇）'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'就労資格',v:'カナダ市民/永住権/就労許可必須'}],
      note:'※ カナダ永住権はポイント制（Express Entry）で取得しやすい。パイロットは優先職種。'},
  ],
  recruitUrl:'https://www.aircanada.com/ca/en/aco/home/about/careers.html',
},

{
  file:'westjet.html',code:'WS',color:'#00439C',
  nameEn:'WestJet Airlines',nameJa:'ウエストジェット航空（WestJet Airlines）',
  subtitle:'カナダ第2位の航空会社 · 低コスト志向から転換',
  tags:[{cls:'tag-blue',label:'🇨🇦 カナダ'},{cls:'tag-gray',label:'FSC/LCC混合'},{cls:'tag-gray',label:'独立系'},{cls:'tag-orange',label:'カナダ'}],
  stats:[{val:'¥2,200万〜3,850万',label:'機長年収（税引前）',color:'#00439C'},{val:'¥1,100万〜1,980万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約170機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'ウエストジェット航空はカナダ第2位の航空会社。カルガリーをハブにカナダ国内・米国・カリブ海・メキシコ・欧州に就航。かつてはLCC志向だったがB787導入で長距離路線・プレミアムサービスにも進出。子会社のSwoop（ULCC）も保有。2020〜2022年のコロナ禍では大幅リストラを経て回復。',
  facts:[{k:'本社',v:'カルガリー（カナダ）'},{k:'ハブ',v:'カルガリー（YYC）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1994年'},{k:'保有機材',v:'約170機'},{k:'所得税',v:'あり（連邦最高33%＋州税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（B787/B737）',range:'¥2,200万〜¥3,850万',avg:'¥3,000万',pct:100,note:'CAD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥1,100万〜¥1,980万',avg:'¥1,500万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ CAD/JPY=110換算。カナダの所得税（連邦＋州）は最高約50%。CAD $200,000〜$350,000（機長）の業界水準参考値。',
  ops:{routes:'カルガリーハブからカナダ全国・米国（60都市以上）・カリブ海・ハワイ・メキシコ・欧州（ロンドン等）に就航。',fleet:'Boeing 787-9, B737 MAX 8/10, B737-800。約170機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'定期採用中。Transport Canada ATP保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。カルガリーベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'Transport Canada ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'就労資格',v:'カナダ市民/永住権/就労許可'}],
      note:'※ アルバータ州は州所得税なし（カナダ唯一）。カルガリーは生活費が東海岸より低め。'},
  ],
  recruitUrl:'https://www.westjet.com/en-ca/about-westjet/careers',
},

{
  file:'porter.html',code:'PD',color:'#3D1152',
  nameEn:'Porter Airlines',nameJa:'ポーターエアラインズ（Porter Airlines）',
  subtitle:'カナダのプレミアムLCC · エンブラエルからA220へ移行',
  tags:[{cls:'tag-blue',label:'🇨🇦 カナダ'},{cls:'tag-orange',label:'プレミアムLCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-gold',label:'東カナダ'}],
  stats:[{val:'¥1,650万〜2,750万',label:'機長年収（税引前）',color:'#3D1152'},{val:'¥825万〜1,375万',label:'FO年収（税引前）',color:'#9b59b6'},{val:'約80機',label:'保有機材数（拡大中）',color:'#3D1152'},{val:'30都市+',label:'就航都市数'}],
  overview:'ポーターエアラインズはトロント・ビリービショップ空港を拠点とするカナダのプレミアムLCC。従来のE175から大幅な機材更新でA220-300を採用し、カナダ国内・米国東海岸・カリブ海・メキシコへの路線拡大を進めている。ビジネス旅客向けに無料スナック・ビール・ワインを提供するユニークなサービスで差別化。急成長中で採用活発。',
  facts:[{k:'本社',v:'トロント（カナダ）'},{k:'ハブ',v:'トロント・ビリーピショップ（YTZ）・ピアソン（YYZ）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'2006年'},{k:'保有機材',v:'約80機（拡大中）'},{k:'所得税',v:'あり（連邦最高33%＋州税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（A220/E175）',range:'¥1,650万〜¥2,750万',avg:'¥2,200万',pct:100,note:'CAD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥825万〜¥1,375万',avg:'¥1,100万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ CAD/JPY=110換算。CAD $150,000〜$250,000（機長）の業界水準参考値。急成長フェーズで採用ペースが速い。',
  ops:{routes:'トロントハブからカナダ主要都市（バンクーバー・カルガリー・モントリオール等）、米国東海岸・フロリダ・カリブ海・メキシコに就航。A220導入で路線拡大中。',fleet:'Airbus A220-300, Embraer E175。約80機（受注残あり）。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'採用積極化中。Transport Canada ATP保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（積極採用中）',sub:'国内外線乗務。トロントベース。',status:'採用積極化',stag:'green',
      details:[{k:'必要資格',v:'Transport Canada ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'就労資格',v:'カナダ市民/永住権/就労許可'}],
      note:'※ A220-300導入に伴い採用が急増中。成長フェーズのため昇格機会も多い。'},
  ],
  recruitUrl:'https://www.flyporter.com/en-ca/about/careers',
},

{
  file:'breeze-airways.html',code:'MX',color:'#00B4D8',
  nameEn:'Breeze Airways',nameJa:'ブリーズ エアウェイズ（Breeze Airways）',
  subtitle:'米国新興航空会社 · 直航路線に特化',
  tags:[{cls:'tag-blue',label:'🇺🇸 米国'},{cls:'tag-orange',label:'LCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-green',label:'新興'}],
  stats:[{val:'¥1,500万〜2,700万',label:'機長年収（税引前）',color:'#00B4D8'},{val:'¥750万〜1,500万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約70機',label:'保有機材数'},{val:'60都市+',label:'就航都市数'}],
  overview:'ブリーズ エアウェイズは2021年に就航した米国の新興航空会社。JetBlue創業者のデビッド・ニールマンが設立。「飛行機で行けなかった都市を直接つなぐ」コンセプトで乗継なし直航路線に特化。A220とE190/E195を使用し、小〜中規模都市ペアに参入。急成長中でパイロット採用を継続中。',
  facts:[{k:'本社',v:'ソルトレークシティ（米国ユタ）'},{k:'ハブ',v:'チャールストン・プロビデンス等（多拠点）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'2021年'},{k:'保有機材',v:'約70機'},{k:'所得税',v:'あり（連邦最高37%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内線（A220/E190）',range:'¥1,500万〜¥2,700万',avg:'¥2,000万',pct:100,note:'USD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内線',range:'¥750万〜¥1,500万',avg:'¥1,050万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。新興航空会社のため給与水準は確立途上。$100,000〜$180,000（機長）の業界参考値。成長フェーズのため条件が変動している可能性あり。',
  ops:{routes:'米国の小〜中規模都市（チャールストン・プロビデンス・タルサ等）間の直航路線。乗継なし直航モデルに特化。',fleet:'Airbus A220-300, Embraer E190/E195。約70機。'},
  training:T_US,
  benefits:B_US,
  hiringStatus:'採用積極化中。FAA ATP保有者対象。成長フェーズ。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（積極採用中）',sub:'国内線乗務。複数ベース選択可。',status:'採用積極化',stag:'green',
      details:[{k:'必要資格',v:'FAA ATP（1,500h）'},{k:'英語',v:'ネイティブまたは流暢'},{k:'最低飛行時間',v:'要確認（成長中のため条件緩和あり）'},{k:'就労資格',v:'米国市民/永住権/就労ビザ必須'}],
      note:'※ 新興航空会社のため昇格が早い可能性あり。A220型式評価保有者優遇。'},
  ],
  recruitUrl:'https://www.flybreeze.com/about/careers',
},

// ── Oceania ───────────────────────────────────────────────────────────────────
{
  file:'qantas.html',code:'QF',color:'#EE0000',
  nameEn:'Qantas Airways',nameJa:'カンタス航空（Qantas Airways）',
  subtitle:'オーストラリアフラッグキャリア · 世界最古の航空会社',
  tags:[{cls:'tag-red',label:'🇦🇺 オーストラリア'},{cls:'tag-blue',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'世界最長路線（Project Sunrise）'}],
  stats:[{val:'¥3,136万〜5,096万',label:'機長年収（税引前）',color:'#EE0000'},{val:'¥1,470万〜2,548万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約200機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'カンタス航空は1920年設立の世界最古の航空会社のひとつ。シドニー・メルボルンをハブに欧州・北米・アジア・太平洋に就航。ワンワールド創設メンバー。オーストラリアは所得税あり（最高45%）。2025〜2026年にProject Sunrise（シドニー〜ロンドン直航・A350-1000使用）を計画。子会社Jetstarも運営。',
  facts:[{k:'本社',v:'シドニー（オーストラリア）'},{k:'ハブ',v:'シドニー（SYD）・メルボルン（MEL）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1920年'},{k:'保有機材',v:'約200機'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ（B787/A380）',range:'¥3,136万〜¥5,096万',avg:'¥4,000万',pct:100,note:'AUD建て・税引前',noteTag:'gold'},
    {pos:'副操縦士（First Officer）',sub:'国際線',range:'¥1,470万〜¥2,548万',avg:'¥2,000万',pct:50,note:'シニオリティ制',noteTag:'blue'},
  ],
  salaryNote:'※ AUD/JPY=98換算。オーストラリア所得税最高45%。AUD $320,000〜$520,000（機長）の業界水準。豪州は公的医療（Medicare）・スーパーアニュエーション（退職年金11%）が充実。',
  ops:{routes:'シドニー・メルボルンハブから欧州（ロンドン・フランクフルト等）、北米（ロサンゼルス・サンフランシスコ等）、アジア（東京・北京・シンガポール等）、南太平洋に就航。国内線シェアも高い。',fleet:'Boeing 787-9, B737 MAX 10, Airbus A380-800, A350-1000（発注済み）, A321neo。約200機。'},
  training:T_OC,
  benefits:B_OC,
  hiringStatus:'定期採用中。CASA ATPL保有者対象。豪州就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。シドニー/メルボルンベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'CASA ATPL（またはICAO相互承認）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（ワイドボディ経験優遇）'},{k:'就労資格',v:'豪州市民/永住権/就労ビザ必須'}],
      note:'※ 豪州の長期就労ビザ（TSS/482ビザ等）でパイロットとして就労可能な場合あり。JCAB→CASA免許変換が必要。'},
  ],
  recruitUrl:'https://www.qantas.com/au/en/about-us/careers.html',
},

{
  file:'air-new-zealand.html',code:'NZ',color:'#00539C',
  nameEn:'Air New Zealand',nameJa:'ニュージーランド航空（Air New Zealand）',
  subtitle:'NZフラッグキャリア · 革新的客室で受賞多数',
  tags:[{cls:'tag-blue',label:'🇳🇿 ニュージーランド'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-green',label:'安全賞受賞'}],
  stats:[{val:'¥2,450万〜3,920万',label:'機長年収（税引前）',color:'#00539C'},{val:'¥1,176万〜1,960万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約100機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'ニュージーランド航空はNZのフラッグキャリア。オークランドをハブにアジア（東京・上海等）・太平洋（ロサンゼルス等）・オーストラリア・南太平洋・英国に就航。スターアライアンス加盟。「スカイカウチ」など革新的な客室設備でAirline Ratingの最高得点を多数受賞。B787とATR72が主力。',
  facts:[{k:'本社',v:'オークランド（ニュージーランド）'},{k:'ハブ',v:'オークランド国際空港（AKL）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1940年'},{k:'保有機材',v:'約100機'},{k:'所得税',v:'あり（最高39%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787）',range:'¥2,450万〜¥3,920万',avg:'¥3,200万',pct:100,note:'NZD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国際線',range:'¥1,176万〜¥1,960万',avg:'¥1,600万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ NZD/JPY≈90換算（変動あり）。NZ所得税最高39%。NZD $270,000〜$435,000（機長）の業界水準参考値。NZはACCによる傷害補償制度が充実。',
  ops:{routes:'オークランドハブからアジア（東京・上海・シンガポール等）・北米（ロサンゼルス・ヒューストン等）・英国・オーストラリア・南太平洋（クック諸島等）に就航。',fleet:'Boeing 787-9/10, ATR 72-600, Boeing 777-200ER（退役中）。約100機。'},
  training:T_OC,
  benefits:B_OC,
  hiringStatus:'定期採用中。CAA NZ ATPL保有者対象。NZ就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。オークランドベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'CAA NZ ATPL（またはICAO相互承認）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（B787優遇）'},{k:'就労資格',v:'NZ市民/永住権/就労ビザ'}],
      note:'※ ニュージーランドはワーキングホリデーや永住権取得がしやすく、生活環境も良好。'},
  ],
  recruitUrl:'https://www.airnewzealand.co.nz/careers',
},

{
  file:'fiji-airways.html',code:'FJ',color:'#0073B0',
  nameEn:'Fiji Airways',nameJa:'フィジー エアウェイズ（Fiji Airways）',
  subtitle:'フィジーフラッグキャリア · 南太平洋の玄関口',
  tags:[{cls:'tag-blue',label:'🇫🇯 フィジー'},{cls:'tag-gray',label:'FSC'},{cls:'tag-green',label:'南太平洋'},{cls:'tag-gold',label:'外国人採用実績'}],
  stats:[{val:'¥1,200万〜2,100万',label:'機長年収（外国人契約）',color:'#0073B0'},{val:'¥600万〜1,200万',label:'FO年収（外国人契約）',color:'#5fb0ff'},{val:'約15機',label:'保有機材数'},{val:'15都市+',label:'就航都市数'}],
  overview:'フィジー エアウェイズはフィジーのフラッグキャリア。ナンディをハブにオーストラリア・NZ・北米・日本・香港・シンガポール等に就航。南太平洋の観光ハブとして重要な役割を担う。外国人パイロット採用実績あり。A350とB737を主力とするシンプルなフリート。非課税フィジーの環境と島国ならではのライフスタイルが魅力。',
  facts:[{k:'本社',v:'ナンディ（フィジー）'},{k:'ハブ',v:'ナンディ国際空港（NAN）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1951年'},{k:'保有機材',v:'約15機'},{k:'所得税',v:'あり（フィジー）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A350/B737）',range:'¥1,200万〜¥2,100万',avg:'¥1,600万',pct:100,note:'USD建て（外国人）',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥600万〜¥1,200万',avg:'¥800万',pct:50,note:'USD/FJD建て',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。外国人パイロットはUSD月額$8,000〜$14,000（機長）程度の特別契約が一般的。フィジーの生活費は低く、南太平洋の楽園ライフが魅力。',
  ops:{routes:'ナンディハブからオーストラリア（シドニー・メルボルン・ブリスベン等）、NZ（オークランド）、北米（ロサンゼルス・サンフランシスコ）、日本（成田・関西）、香港・シンガポール等に就航。',fleet:'Airbus A350-900, Boeing 737-800/MAX 8。約15機。'},
  training:T_OC,
  benefits:[
    {icon:'🌊',title:'南太平洋ライフスタイル',body:'フィジーの美しい海・自然・島国文化。家族帯同でも魅力的な生活環境。'},
    {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引搭乗特典。'},
    {icon:'🏥',title:'医療保険',body:'外国人パイロット向けの医療保険。住宅手当も一般的。'},
    {icon:'💵',title:'USD建て収入',body:'外国人契約はUSD建てが一般的。為替リスクが低い。'},
  ],
  hiringStatus:'外国人機長・FO採用実績あり。A350またはB737型式保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。ナンディベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'契約',v:'固定期間契約（2〜3年）USD建て'}],
      note:'※ フィジーは観光業と航空業が密接に連携。日本路線もあり日本人パイロットに親和性がある。'},
  ],
  recruitUrl:'https://www.fijiairways.com/about-fiji-airways/careers/',
},

{
  file:'jetstar.html',code:'JQ',color:'#FF5900',
  nameEn:'Jetstar Airways',nameJa:'ジェットスター・エアウェイズ（Jetstar）',
  subtitle:'カンタスグループLCC · アジア太平洋展開',
  tags:[{cls:'tag-orange',label:'🇦🇺 オーストラリア'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'カンタスグループ'},{cls:'tag-green',label:'アジア太平洋'}],
  stats:[{val:'¥1,960万〜2,940万',label:'機長年収（税引前）',color:'#FF5900'},{val:'¥784万〜1,568万',label:'FO年収（税引前）',color:'#fb923c'},{val:'約90機',label:'保有機材数'},{val:'60都市+',label:'就航都市数'}],
  overview:'ジェットスターはカンタスグループが2004年に設立したLCC。オーストラリア国内線・アジア太平洋線を低運賃で展開。日本ではジェットスター・ジャパン（別会社）として運営。豪州・NZ・シンガポール・日本・ベトナムにグループ会社を展開するアジア太平洋最大級のLCCネットワーク。A320族とB787が主力。',
  facts:[{k:'本社',v:'メルボルン（オーストラリア）'},{k:'ハブ',v:'メルボルン（MEL）・シドニー（SYD）'},{k:'アライアンス',v:'カンタスグループ（ワンワールド関連）'},{k:'設立',v:'2004年'},{k:'保有機材',v:'約90機'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国内外線（B787/A320）',range:'¥1,960万〜¥2,940万',avg:'¥2,400万',pct:100,note:'AUD建て・税引前',noteTag:'orange'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥784万〜¥1,568万',avg:'¥1,100万',pct:46,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ AUD/JPY=98換算。AUD $200,000〜$300,000（機長）の業界水準参考値。カンタスグループ内での異動機会もあり。',
  ops:{routes:'メルボルン・シドニーハブからオーストラリア国内線・NZ・アジア（日本・タイ・インドネシア等）・太平洋島嶼国に就航。',fleet:'Boeing 787-8, Airbus A321, A320。約90機。'},
  training:T_OC,
  benefits:[...B_OC,{icon:'🦘',title:'カンタスグループ特典',body:'カンタス便へのスタッフトラベル特典あり。グループ内訓練施設利用可能。'}],
  hiringStatus:'定期採用中。CASA ATPL保有者対象。豪州就労許可必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。メルボルン/シドニーベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'CASA ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'就労資格',v:'豪州市民/永住権/就労ビザ'}],
      note:'※ カンタスグループ内昇格でカンタス本体へ移籍できる可能性あり。'},
  ],
  recruitUrl:'https://www.jetstar.com/au/en/about-us/careers',
},

// ── LATAM ─────────────────────────────────────────────────────────────────────
{
  file:'latam.html',code:'LA',color:'#E30613',
  nameEn:'LATAM Airlines',nameJa:'ラタム航空（LATAM Airlines）',
  subtitle:'南米最大の航空グループ · 6カ国統合',
  tags:[{cls:'tag-red',label:'🇧🇷🇨🇱 南米'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-gold',label:'南米No.1'}],
  stats:[{val:'¥1,350万〜2,700万',label:'機長年収（税引前）',color:'#E30613'},{val:'¥675万〜1,350万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約310機',label:'保有機材数'},{val:'150都市+',label:'就航都市数'}],
  overview:'ラタム航空はLAN（チリ）とTAM（ブラジル）が2012年に合併した南米最大の航空グループ。チリ・ブラジル・コロンビア・エクアドル・ペルー・パラグアイに地域会社を持ち、南米域内・欧州・北米・大洋州に就航。2020年に米国連邦破産法を申請、2022年に再建完了。A320族とB787・A350が主力。',
  facts:[{k:'本社',v:'サンティアゴ（チリ）'},{k:'ハブ',v:'サンティアゴ（SCL）・サンパウロ（GRU）'},{k:'アライアンス',v:'なし（独立系、元ワンワールド脱退）'},{k:'設立',v:'2012年（LAN+TAM合併）'},{k:'保有機材',v:'約310機'},{k:'所得税',v:'あり（各国異なる）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787/A350）',range:'¥1,350万〜¥2,700万',avg:'¥2,000万',pct:100,note:'USD建て（外国人）',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国内外線',range:'¥675万〜¥1,350万',avg:'¥1,000万',pct:50,note:'BRL/CLP建て',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。USD月額$9,000〜$18,000（機長）を参考にした参考値。国籍・ベース国により通貨・税率が異なる。2022年再建後の条件を参考にした。',
  ops:{routes:'サンティアゴ・サンパウロハブから南米域内全土・北米（マイアミ・ニューヨーク等）・欧州（マドリッド・ロンドン・フランクフルト等）・大洋州（シドニー）に就航。',fleet:'Boeing 787-8/9, Airbus A350-900, A321neo, A320neo, A319。約310機。'},
  training:T_LA,
  benefits:B_LA,
  hiringStatus:'採用中（再建後）。外国人パイロット採用実績あり。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（採用中）',sub:'国際線乗務。サンティアゴ/サンパウロベース。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠・各国認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'スペイン語',v:'推奨（チリ/コロンビア系）'}],
      note:'※ ブラジルはポルトガル語、チリはスペイン語。各国規制により就労許可取得が必要。'},
  ],
  recruitUrl:'https://www.latamairlines.com/br/en/latam-group/working-at-latam',
},

{
  file:'avianca.html',code:'AV',color:'#C60B1E',
  nameEn:'Avianca',nameJa:'アビアンカ航空（Avianca）',
  subtitle:'コロンビア最大 · 世界第2位の歴史を持つ航空会社',
  tags:[{cls:'tag-red',label:'🇨🇴 コロンビア'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'中南米'}],
  stats:[{val:'¥1,200万〜2,100万',label:'機長年収（税引前）',color:'#C60B1E'},{val:'¥600万〜1,050万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約130機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'アビアンカ航空は1919年設立の世界で2番目に古い歴史を持つ航空会社。コロンビアのボゴタをハブに中南米・北米・欧州・カリブ海に就航。スターアライアンス加盟。2020年に破産申請し2021年に再建完了。A320族が主力のシンプルなフリートで効率化を進める。',
  facts:[{k:'本社',v:'ボゴタ（コロンビア）'},{k:'ハブ',v:'エル・ドラード国際空港（BOG）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1919年'},{k:'保有機材',v:'約130機'},{k:'所得税',v:'あり（コロンビア）'}],
  salaryRows:[
    {pos:'機長（Capitán）',sub:'国内外線（A320族）',range:'¥1,200万〜¥2,100万',avg:'¥1,600万',pct:100,note:'USD建て（外国人）',noteTag:'blue'},
    {pos:'副操縦士（Copiloto）',sub:'国内外線',range:'¥600万〜¥1,050万',avg:'¥800万',pct:50,note:'COP/USD建て',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。コロンビアの生活費は低く、USD建て収入の実質購買力が高い。業界水準参考値。',
  ops:{routes:'ボゴタハブから中南米（メキシコシティ・リマ・ブエノスアイレス等）、北米（マイアミ・ニューヨーク・ロサンゼルス）、欧州（マドリッド・ロンドン）、カリブ海に就航。',fleet:'Airbus A321neo, A320neo, A319。約130機（再建後）。'},
  training:T_LA,
  benefits:B_LA,
  hiringStatus:'採用中（再建後）。ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（採用中）',sub:'国内外線乗務。ボゴタベース。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（AEROCIVIL/ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'スペイン語',v:'日常会話レベル推奨'}],
      note:'※ ボゴタは標高2,640mの高地都市。気候は涼しく過ごしやすい。生活費は低い。'},
  ],
  recruitUrl:'https://www.avianca.com/co/es/sobre-avianca/trabaja-con-nosotros/',
},

{
  file:'aeromexico.html',code:'AM',color:'#006CB7',
  nameEn:'Aeromexico',nameJa:'アエロメヒコ（Aeromexico）',
  subtitle:'メキシコフラッグキャリア · スカイチーム加盟',
  tags:[{cls:'tag-blue',label:'🇲🇽 メキシコ'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'中南米'}],
  stats:[{val:'¥1,050万〜1,950万',label:'機長年収（税引前）',color:'#006CB7'},{val:'¥525万〜975万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約120機',label:'保有機材数'},{val:'90都市+',label:'就航都市数'}],
  overview:'アエロメヒコはメキシコのフラッグキャリア。メキシコシティをハブに中南米・北米（デルタ航空と提携）・欧州・アジアに就航。スカイチーム加盟。2020年に連邦破産法申請、2022年に再建完了。デルタ航空と深い提携関係。B787-8/9が国際線主力。',
  facts:[{k:'本社',v:'メキシコシティ（メキシコ）'},{k:'ハブ',v:'ベニート・フアレス国際空港（MEX）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1934年'},{k:'保有機材',v:'約120機'},{k:'所得税',v:'あり（最高35%）'}],
  salaryRows:[
    {pos:'機長（Capitán）',sub:'国際線（B787/B737）',range:'¥1,050万〜¥1,950万',avg:'¥1,500万',pct:100,note:'USD建て（外国人）',noteTag:'blue'},
    {pos:'副操縦士（Copiloto）',sub:'国内外線',range:'¥525万〜¥975万',avg:'¥750万',pct:50,note:'MXN/USD建て',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。メキシコシティの生活費は低く、USD建て収入の購買力が高い。業界水準参考値。',
  ops:{routes:'メキシコシティハブから北米（米国60都市以上・デルタ航空提携）、中南米（30都市以上）、欧州（マドリッド・アムステルダム等）、アジア（東京等）に就航。',fleet:'Boeing 787-8/9, B737 MAX 9, B737-800。約120機。'},
  training:T_LA,
  benefits:B_LA,
  hiringStatus:'採用中（再建後）。ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（採用中）',sub:'国際線乗務。メキシコシティベース。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（AFAC/ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（B787優遇）'},{k:'スペイン語',v:'日常会話レベル推奨'}],
      note:'※ デルタ航空との提携でコードシェア路線多数。メキシコシティは中南米のビジネスハブ。'},
  ],
  recruitUrl:'https://www.aeromexico.com/es-mx/sobre-aeromexico/trabaja-con-nosotros',
},

{
  file:'copa-airlines.html',code:'CM',color:'#004A94',
  nameEn:'Copa Airlines',nameJa:'コパ航空（Copa Airlines）',
  subtitle:'パナマハブ · 中南米路線のネットワーク拠点',
  tags:[{cls:'tag-blue',label:'🇵🇦 パナマ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'中南米ハブ'}],
  stats:[{val:'¥1,200万〜2,250万',label:'機長年収（税引前）',color:'#004A94'},{val:'¥600万〜1,125万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約100機',label:'保有機材数'},{val:'80都市+',label:'就航都市数'}],
  overview:'コパ航空はパナマシティをハブとする中南米最重要の乗継ハブ航空会社。スターアライアンス加盟。ユナイテッド航空（主要株主）と深い提携関係。中南米80都市以上への路線で「中南米のハブ」として機能。パナマは米ドルを公用通貨とし、税率も低め（所得税最高25%）。B737MAXを主力に整備された近代的フリート。',
  facts:[{k:'本社',v:'パナマシティ（パナマ）'},{k:'ハブ',v:'トクメン国際空港（PTY）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1947年'},{k:'保有機材',v:'約100機'},{k:'所得税',v:'あり（最高25%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B737 MAX）',range:'¥1,200万〜¥2,250万',avg:'¥1,700万',pct:100,note:'USD建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'国際線',range:'¥600万〜¥1,125万',avg:'¥850万',pct:50,note:'USD建て',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。パナマはドル経済（為替リスクなし）・所得税最高25%。USD月額$8,000〜$15,000（機長）の業界水準参考値。生活費は中米で比較的低め。',
  ops:{routes:'パナマシティハブから中南米80都市以上・北米（マイアミ・ニューヨーク等）・カリブ海に就航。中南米内は最大のネットワーク密度。',fleet:'Boeing 737 MAX 8/9/10, B737-800。約100機。'},
  training:T_LA,
  benefits:[
    {icon:'💵',title:'USD給与（為替リスクなし）',body:'パナマはドル経済圏。USD建て給与のため為替変動リスクがない。'},
    {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引搭乗特典。スターアライアンス提携会社も利用可能。'},
    {icon:'🏥',title:'医療保険',body:'本人・家族向けの包括的医療保険。'},
    {icon:'💰',title:'ボーナス',body:'業績連動型ボーナス。パナマの経済成長に連動。'},
  ],
  hiringStatus:'定期採用中。ATPL保有者対象。B737型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。パナマシティベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'ATPL（AAC/ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（B737MAX優遇）'},{k:'スペイン語',v:'日常会話レベル推奨'}],
      note:'※ パナマは中米の金融・ビジネスハブ。USD給与で生活費が低い点が魅力。'},
  ],
  recruitUrl:'https://www.copaair.com/en/web/us/work-with-us',
},

];

airlines.forEach(a=>{
  const html=page(a);
  writeFileSync(`airlines/${a.file}`,html,'utf8');
  console.log(`Created: ${a.file}`);
});
console.log('Americas / Oceania / LATAM airlines done!');
