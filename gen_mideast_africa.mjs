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

const T_ME=[
  {title:'型式訓練（EASA/GCAA/GACA認定）',body:'UAE・サウジ・カタール等の航空当局またはEASA認定ATOでのtype rating取得。地上学科→シミュレーター→LIFUS。'},
  {title:'LIFUS（ライン訓練）',body:'型式取得後、教官機長同乗のもとでLine Flying Under Supervision。通常50〜80レグ程度。'},
  {title:'定期審査（OPC/LPC）',body:'年1〜2回のプロフィシェンシーチェック。ICAO基準に基づき各国当局が監督。'},
  {title:'機長昇格',body:'シニオリティ制またはメリット制。中東系FSCは飛行時間と社内審査を重視。外国人機長の採用実績も多い。'},
];
const T_AF=[
  {title:'型式訓練（ICAO基準）',body:'各国航空当局（ECAA/SACAA/KCAA/ECAA等）認定施設またはOEMトレーニングセンターでの型式訓練。'},
  {title:'LIFUS',body:'型式取得後、ライン訓練を実施。エチオピア航空は自社訓練センター（Aviation Academy）を保有。'},
  {title:'定期審査',body:'年1〜2回のOPC/LPC。ICAO Annex 1/6準拠。'},
  {title:'機長昇格',body:'エチオピア航空は自社養成が中心。ケニア・南アフリカ等は外国人機長の直接採用実績あり。'},
];
const B_ME=[
  {icon:'🌴',title:'免税（タックスフリー）',body:'UAE・サウジ・バーレーン・クウェート・オマーン等は所得税ゼロ。手取りがそのまま年収になる。'},
  {icon:'🏠',title:'住宅手当',body:'企業提供の住居または住宅手当。家族帯同可のケースが多い。'},
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの無料または大幅割引航空券。提携会社含む。'},
  {icon:'🏥',title:'医療保険',body:'本人・家族向けの包括的な医療保険（歯科含む）。ライセンス喪失保険も一般的。'},
  {icon:'🚗',title:'送迎・交通費',body:'空港〜自宅間の送迎サービスまたは交通手当。'},
  {icon:'💰',title:'ボーナス',body:'業績連動型または契約ボーナス。一部は年2回払い。'},
];
const B_AF=[
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引または無料航空券。STARアライアンス等の提携会社も利用可能（エチオピア）。'},
  {icon:'🏥',title:'医療保険',body:'本人・家族向けの医療保険。エチオピア・南アフリカは比較的充実。'},
  {icon:'🌍',title:'海外手当',body:'外国人パイロット向けの住宅手当・生活費補助。USD建て契約が多い。'},
  {icon:'📅',title:'有給休暇',body:'年間20〜30日。長距離路線乗務者はリカバリー休暇含む。'},
];

const airlines=[

// ── Middle East ──────────────────────────────────────────────────────────────
{
  file:'saudia.html',code:'SVA',color:'#1A7A4A',
  nameEn:'Saudia',nameJa:'サウディア（Saudia）',
  subtitle:'サウジアラビア国営フラッグキャリア · スカイチーム加盟',
  tags:[{cls:'tag-green',label:'🇸🇦 サウジアラビア'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'免税'}],
  stats:[{val:'¥2,880万〜3,960万',label:'機長年収（免税）',color:'#1A7A4A'},{val:'¥1,440万〜2,160万',label:'FO年収（免税）',color:'#34d399'},{val:'約150機',label:'保有機材数'},{val:'95都市+',label:'就航都市数'}],
  overview:'サウディア（旧サウジアラビア航空）は1945年設立のサウジアラビア国営フラッグキャリア。ジッダ・リヤド・ダンマームをハブに中東・欧州・アジア・北米へ就航。サウジアラビアは所得税ゼロのため、手取りがそのまま年収となる点が外国人パイロットに人気。スカイチーム加盟（2012年）。ビジョン2030に向けて路線拡大中。',
  facts:[{k:'本社',v:'ジッダ（サウジアラビア）'},{k:'ハブ',v:'キング・アブドゥルアジーズ国際空港（JED）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1945年'},{k:'保有機材',v:'約150機'},{k:'所得税',v:'なし（免税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B777/A330等）',range:'¥2,880万〜¥3,960万',avg:'¥3,300万',pct:100,note:'免税・手当込み',noteTag:'gold'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥1,440万〜¥2,160万',avg:'¥1,800万',pct:55,note:'USD建て契約',noteTag:'green'},
  ],
  salaryNote:'※ USD/JPY=150、SAR/JPY=40換算。サウジアラビアは個人所得税ゼロ。USD月額$16,000〜$22,000（機長）の業界水準を参考にした参考値。住宅手当・送迎・医療保険は別途支給。',
  ops:{routes:'ジッダ・リヤドハブから欧州（ロンドン・パリ・フランクフルト等）、アジア（日本・タイ・マレーシア等）、北米、アフリカ、中東域内に就航。ハジ・ウムラ季節便も運航。',fleet:'Boeing 777-300ER, B787-9/10, B737 MAX 8, A321, A320。約150機。'},
  training:T_ME,
  benefits:B_ME,
  hiringStatus:'外国人機長・FO採用実績あり。時期により採用状況が変動。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。ジッダ/リヤドベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠・GACA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'契約',v:'固定期間契約（2〜3年更新）'}],
      note:'※ ビジョン2030に向け採用拡大中。エージェント経由の募集が多い。'},
  ],
  recruitUrl:'https://www.saudia.com/about-saudia/careers',
},

{
  file:'turkish-airlines.html',code:'THY',color:'#C8102E',
  nameEn:'Turkish Airlines',nameJa:'ターキッシュ エアラインズ（Turkish Airlines）',
  subtitle:'最多就航国を誇る · スターアライアンス加盟',
  tags:[{cls:'tag-red',label:'🇹🇷 トルコ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'世界最多就航国'}],
  stats:[{val:'¥1,440万〜2,880万',label:'機長年収（税引前）',color:'#C8102E'},{val:'¥540万〜1,080万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約440機',label:'保有機材数'},{val:'130カ国+',label:'就航国数（世界最多）'}],
  overview:'ターキッシュ エアラインズは世界130カ国以上・340都市以上に就航し「最多就航国」の航空会社として知られる。イスタンブール空港をハブに欧州・アジア・アフリカ・米州を網羅。スターアライアンス加盟。トルコは所得税があり（最高40%）、外国人パイロットへの待遇はUSD建て特別契約で提供される場合もある。機材はB787, A330/350, B777等のワイドボディから国内線ナローボディまで多彩。',
  facts:[{k:'本社',v:'イスタンブール（トルコ）'},{k:'ハブ',v:'イスタンブール空港（IST）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1933年'},{k:'保有機材',v:'約440機'},{k:'所得税',v:'あり（最高40%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ',range:'¥1,440万〜¥2,880万',avg:'¥2,100万',pct:100,note:'税引前・TRY+USD',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥540万〜¥1,080万',avg:'¥780万',pct:37,note:'トルコ税制適用',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。トルコの所得税（最高40%）が適用。外国人パイロットはUSD建て特別契約の場合もある。Glassdoor等の公開データ（2025年）参考値。',
  ops:{routes:'イスタンブールハブから欧州全土、北米（ニューヨーク・シカゴ等）、アジア（日本・中国・タイ等）、アフリカ（50都市以上）、中東に就航。世界最多就航国ネットワーク。',fleet:'Boeing 787-9, B777-300ER, B737 MAX 8/9, Airbus A350-900, A330-200/300, A321neo, A320neo。約440機。'},
  training:T_ME,
  benefits:[
    {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの大幅割引航空券。スターアライアンス提携会社も利用可能。'},
    {icon:'🏥',title:'医療保険',body:'本人・家族向けの包括的医療保険。'},
    {icon:'💰',title:'ボーナス',body:'業績連動型ボーナス。年2〜4回払いのケースが多い。'},
    {icon:'📅',title:'有給休暇',body:'年間22〜28日。長距離路線は追加リカバリー休暇あり。'},
    {icon:'🏠',title:'住宅手当',body:'外国人パイロット向けイスタンブール住宅手当または提供住居。'},
    {icon:'🌐',title:'レイオーバー手当',body:'海外ステイ中の宿泊・日当支給。都市ランク別。'},
  ],
  hiringStatus:'外国人機長採用実績あり。タイプレーティング保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。イスタンブールベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,000h以上（目安）'},{k:'型式',v:'B787/A350/B777等ワイドボディ優遇'}],
      note:'※ 自社の訓練センター（Aviation Academy）での型式訓練も行う。'},
  ],
  recruitUrl:'https://www.turkishairlines.com/en-int/corporate/careers/',
},

{
  file:'oman-air.html',code:'WY',color:'#C8102E',
  nameEn:'Oman Air',nameJa:'オマーン エア（Oman Air）',
  subtitle:'オマーン国営フラッグキャリア · 免税国',
  tags:[{cls:'tag-red',label:'🇴🇲 オマーン'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'免税'},{cls:'tag-blue',label:'中東'}],
  stats:[{val:'¥1,800万〜2,880万',label:'機長年収（免税）',color:'#C8102E'},{val:'¥900万〜1,440万',label:'FO年収（免税）',color:'#ff8888'},{val:'約50機',label:'保有機材数'},{val:'55都市+',label:'就航都市数'}],
  overview:'オマーン エアはオマーンの国営フラッグキャリア。マスカットをハブにアジア・欧州・アフリカ・中東域内に就航。オマーンは個人所得税ゼロ。外国人パイロット採用を積極的に行っており、住宅・医療・教育費が手厚くサポートされる。機材はB787とB737が主力で比較的コンパクトなネットワークながら高品質サービスで定評がある。',
  facts:[{k:'本社',v:'マスカット（オマーン）'},{k:'ハブ',v:'マスカット国際空港（MCT）'},{k:'アライアンス',v:'なし'},{k:'設立',v:'1993年'},{k:'保有機材',v:'約50機'},{k:'所得税',v:'なし（免税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787/B737）',range:'¥1,800万〜¥2,880万',avg:'¥2,200万',pct:100,note:'免税・手当込み',noteTag:'gold'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥900万〜¥1,440万',avg:'¥1,100万',pct:50,note:'USD建て',noteTag:'green'},
  ],
  salaryNote:'※ USD/JPY=150換算。オマーンは個人所得税ゼロ。USD月額$10,000〜$16,000（機長）の業界水準を参考にした参考値。住宅・医療・教育費は別途支給。',
  ops:{routes:'マスカットハブから欧州（ロンドン・フランクフルト・チューリッヒ等）、アジア（バンコク・クアラルンプール・デリー・東京等）、アフリカ、中東域内に就航。',fleet:'Boeing 787-8/9, B737 MAX 8, B737-800。約50機。'},
  training:T_ME,
  benefits:B_ME,
  hiringStatus:'外国人機長・FO採用中。B787型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。マスカットベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（B787は1,000h以上）'},{k:'契約',v:'固定期間契約（2〜3年更新）'}],
      note:'※ 住宅・家族医療保険・帰国航空券が支給される標準パッケージ。'},
  ],
  recruitUrl:'https://careers.omanair.com',
},

{
  file:'gulf-air.html',code:'GF',color:'#B8860B',
  nameEn:'Gulf Air',nameJa:'ガルフ エア（Gulf Air）',
  subtitle:'バーレーン国営フラッグキャリア · 中東老舗航空会社',
  tags:[{cls:'tag-gold',label:'🇧🇭 バーレーン'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'免税'},{cls:'tag-blue',label:'中東'}],
  stats:[{val:'¥1,800万〜2,700万',label:'機長年収（免税）',color:'#B8860B'},{val:'¥900万〜1,440万',label:'FO年収（免税）',color:'#f5c842'},{val:'約30機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'ガルフ エアは1950年設立の中東最古の航空会社のひとつ。バーレーンのフラッグキャリアとしてアジア・欧州・アフリカ・中東に就航。バーレーンは個人所得税ゼロ。外国人パイロット採用実績が豊富で、家族帯同可の手厚いパッケージが特徴。A320/A321とA330のmixedフリート。',
  facts:[{k:'本社',v:'マナーマ（バーレーン）'},{k:'ハブ',v:'バーレーン国際空港（BAH）'},{k:'アライアンス',v:'なし'},{k:'設立',v:'1950年'},{k:'保有機材',v:'約30機'},{k:'所得税',v:'なし（免税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A330/A321）',range:'¥1,800万〜¥2,700万',avg:'¥2,200万',pct:100,note:'免税・手当込み',noteTag:'gold'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥900万〜¥1,440万',avg:'¥1,100万',pct:50,note:'USD建て',noteTag:'green'},
  ],
  salaryNote:'※ USD/JPY=150換算。バーレーンは個人所得税ゼロ。USD月額$10,000〜$15,000（機長）を参考にした参考値。住宅・家族医療保険・帰国航空券は別途支給。',
  ops:{routes:'バーレーンハブから欧州（ロンドン・アテネ等）、アジア（タイ・スリランカ・インド等）、アフリカ、中東域内に就航。',fleet:'Airbus A321neo, A321ceo, A330-200/300。約30機。'},
  training:T_ME,
  benefits:B_ME,
  hiringStatus:'外国人機長・FO採用実績あり。A320族またはA330型式保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。バーレーンベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'型式',v:'A330またはA320族優遇'}],
      note:'※ バーレーン現地の生活費は中東主要都市に比べ低めで生活しやすい環境。'},
  ],
  recruitUrl:'https://www.gulfair.com/about-us/careers',
},

{
  file:'kuwait-airways.html',code:'KAC',color:'#007A3D',
  nameEn:'Kuwait Airways',nameJa:'クウェート航空（Kuwait Airways）',
  subtitle:'クウェート国営フラッグキャリア · 石油産業国',
  tags:[{cls:'tag-green',label:'🇰🇼 クウェート'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'免税'},{cls:'tag-blue',label:'中東'}],
  stats:[{val:'¥2,160万〜3,240万',label:'機長年収（免税）',color:'#007A3D'},{val:'¥1,080万〜1,800万',label:'FO年収（免税）',color:'#34d399'},{val:'約25機',label:'保有機材数'},{val:'40都市+',label:'就航都市数'}],
  overview:'クウェート航空は1954年設立のクウェート国営フラッグキャリア。クウェートシティをハブに中東・欧州・アジアに就航。クウェートは個人所得税ゼロで、石油収益を背景に外国人パイロット待遇は中東でも高水準。A330とA320族による現代的フリート。フリートモダナイズを進めており、外国人採用を継続。',
  facts:[{k:'本社',v:'クウェートシティ（クウェート）'},{k:'ハブ',v:'クウェート国際空港（KWI）'},{k:'アライアンス',v:'なし'},{k:'設立',v:'1954年'},{k:'保有機材',v:'約25機'},{k:'所得税',v:'なし（免税）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A330/A320）',range:'¥2,160万〜¥3,240万',avg:'¥2,700万',pct:100,note:'免税・手当込み',noteTag:'gold'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥1,080万〜¥1,800万',avg:'¥1,440万',pct:53,note:'USD建て',noteTag:'green'},
  ],
  salaryNote:'※ USD/JPY=150換算。クウェートは個人所得税ゼロ。USD月額$12,000〜$18,000（機長）を参考にした参考値。住宅・家族医療保険・帰国航空券は別途支給。',
  ops:{routes:'クウェートシティハブから欧州（ロンドン・パリ・フランクフルト等）、アジア（バンコク・マニラ・カイロ等）、中東域内に就航。',fleet:'Airbus A330-200/800neo, A320neo, A321neo。約25機。'},
  training:T_ME,
  benefits:B_ME,
  hiringStatus:'外国人機長・FO採用中。A330またはA320型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。クウェートシティベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'型式',v:'A330/A320族優遇'}],
      note:'※ クウェートの生活水準は高く、安全で快適な居住環境。家族学校費用補助あり。'},
  ],
  recruitUrl:'https://www.kuwaitairways.com/en/careers',
},

{
  file:'royal-jordanian.html',code:'RJ',color:'#9B111E',
  nameEn:'Royal Jordanian',nameJa:'ロイヤル ヨルダニアン（Royal Jordanian）',
  subtitle:'ヨルダン王国フラッグキャリア · ワンワールド加盟',
  tags:[{cls:'tag-red',label:'🇯🇴 ヨルダン'},{cls:'tag-blue',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'},{cls:'tag-blue',label:'中東'}],
  stats:[{val:'¥1,260万〜2,160万',label:'機長年収（税引前）',color:'#9B111E'},{val:'¥630万〜1,080万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約25機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'ロイヤル ヨルダニアンは1963年設立のヨルダン王国フラッグキャリア。アンマンをハブに中東・欧州・北米・アジアに就航。ワンワールド加盟。ヨルダンは所得税があり（最高30%）、中東の中では給与水準がやや低いが、生活費も比較的低い。B787とA320族による現代的フリートを保有。外国人パイロット採用実績あり。',
  facts:[{k:'本社',v:'アンマン（ヨルダン）'},{k:'ハブ',v:'クイーン・アリア国際空港（AMM）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1963年'},{k:'保有機材',v:'約25機'},{k:'所得税',v:'あり（最高30%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787/A330）',range:'¥1,260万〜¥2,160万',avg:'¥1,700万',pct:100,note:'税引前・USD建て',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥630万〜¥1,080万',avg:'¥850万',pct:50,note:'JOD＋USD',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。ヨルダンの所得税（最高30%）が適用。USD月額$7,000〜$12,000（機長）を参考にした参考値。住宅手当は別途。',
  ops:{routes:'アンマンハブから欧州（ロンドン・フランクフルト・パリ等）、北米（ニューヨーク・シカゴ・デトロイト等）、アジア（バンコク・クアラルンプール等）、中東域内に就航。',fleet:'Boeing 787-8, Airbus A320/A321。約25機。'},
  training:T_ME,
  benefits:[...B_ME.slice(1),{icon:'🏛️',title:'ワンワールド特典',body:'ワンワールド加盟航空会社の広範なスタッフトラベル・ラウンジ利用特典。'}],
  hiringStatus:'外国人パイロット採用実績あり。B787またはA320型式保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。アンマンベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'型式',v:'B787/A320族優遇'}],
      note:'※ アンマンは中東の中でも生活費が比較的低く、居住環境は良好。'},
  ],
  recruitUrl:'https://www.rj.com/en/careers',
},

// ── Africa ───────────────────────────────────────────────────────────────────
{
  file:'ethiopian-airlines.html',code:'ET',color:'#EFC050',
  nameEn:'Ethiopian Airlines',nameJa:'エチオピア航空（Ethiopian Airlines）',
  subtitle:'アフリカ最大の航空会社 · スターアライアンス加盟',
  tags:[{cls:'tag-gold',label:'🇪🇹 エチオピア'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-green',label:'アフリカNo.1'}],
  stats:[{val:'¥1,440万〜2,520万',label:'機長年収（外国人契約）',color:'#EFC050'},{val:'¥720万〜1,260万',label:'FO年収（外国人契約）',color:'#f5c842'},{val:'約140機',label:'保有機材数'},{val:'130都市+',label:'就航都市数'}],
  overview:'エチオピア航空はアフリカ最大の航空会社。アジス・アベバをハブに世界130都市以上に就航し、アフリカ域内ネットワークも最大級。スターアライアンス加盟。自社のAviation Academyで大量のパイロット・エンジニアを養成しており、自社養成比率が高い。外国人パイロットはUSD建て特別契約で雇用。B787・B777・B737MAXなど最新機材を大量保有。',
  facts:[{k:'本社',v:'アジス・アベバ（エチオピア）'},{k:'ハブ',v:'ボレ国際空港（ADD）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1945年'},{k:'保有機材',v:'約140機'},{k:'所得税',v:'外国人：要確認'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ（B787/B777）',range:'¥1,440万〜¥2,520万',avg:'¥1,920万',pct:100,note:'USD建て特別契約',noteTag:'gold'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥720万〜¥1,260万',avg:'¥960万',pct:50,note:'USD建て',noteTag:'green'},
  ],
  salaryNote:'※ USD/JPY=150換算。外国人パイロットはUSD月額$8,000〜$14,000（機長）の契約が一般的。住宅手当・医療保険・帰国航空券別途。エチオピアの生活費は低く実質的な購買力は高い。',
  ops:{routes:'アジス・アベバハブから欧州（ロンドン・フランクフルト・パリ等）、北米（ニューヨーク・ワシントン・ヒューストン等）、アジア（北京・東京・上海等）、アフリカ全土（60都市以上）に就航。',fleet:'Boeing 787-8/9, B777-200LR/F, B737 MAX 8/9, Airbus A350-900。約140機。'},
  training:T_AF,
  benefits:B_AF,
  hiringStatus:'外国人機長・FO採用実績あり。B787/B777/A350型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。アジス・アベバベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'契約',v:'固定期間契約（2〜3年）USD建て'}],
      note:'※ Aviation Academyで型式訓練可能。自社養成パイロットとの共存採用。'},
  ],
  recruitUrl:'https://www.ethiopianairlines.com/aa/about-us/careers',
},

{
  file:'south-african-airways.html',code:'SAA',color:'#006BA6',
  nameEn:'South African Airways',nameJa:'南アフリカ航空（South African Airways）',
  subtitle:'南アフリカ国営フラッグキャリア · スターアライアンス加盟',
  tags:[{cls:'tag-blue',label:'🇿🇦 南アフリカ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'アフリカ'}],
  stats:[{val:'¥900万〜1,500万',label:'機長年収（参考値）',color:'#006BA6'},{val:'¥450万〜900万',label:'FO年収（参考値）',color:'#5fb0ff'},{val:'約25機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'南アフリカ航空（SAA）は1934年設立の南アフリカ国営フラッグキャリア。ヨハネスブルグをハブに欧州・アジア・北米・アフリカ域内に就航。2020年に行政管理手続き（破産保護）を経て2021年に再出発。スターアライアンス加盟。ZAR（南アフリカランド）建て給与のため、為替変動の影響を受ける。現在は規模縮小状態で採用は限定的。',
  facts:[{k:'本社',v:'ヨハネスブルグ（南アフリカ）'},{k:'ハブ',v:'オルタムボ国際空港（JNB）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1934年'},{k:'保有機材',v:'約25機（再建中）'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A330/B737）',range:'¥900万〜¥1,500万',avg:'¥1,200万',pct:100,note:'ZAR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥450万〜¥900万',avg:'¥650万',pct:54,note:'ZAR建て',noteTag:'gray'},
  ],
  salaryNote:'※ ZAR/JPY≈8換算（変動あり）。南アフリカの所得税は最高45%。ZAR建て給与のため円換算値は為替に大きく左右される。2021年再建後の採用状況は変動中。',
  ops:{routes:'ヨハネスブルグハブからロンドン・フランクフルト・ムンバイ・香港等の国際線とアフリカ域内（ナイロビ・ルサカ・ハラレ等）に就航。国内線も多数。',fleet:'Airbus A330-200/300, Boeing B737-800。約25機（再建中）。'},
  training:T_AF,
  benefits:[
    {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの割引航空券。スターアライアンス加盟会社でも利用可能。'},
    {icon:'🏥',title:'医療保険',body:'本人・家族向けの医療保険（南アフリカの民間医療保険制度）。'},
    {icon:'📅',title:'有給休暇',body:'年間20〜25日。南アフリカ労働法準拠。'},
    {icon:'💰',title:'退職年金',body:'確定拠出型年金制度あり。'},
  ],
  hiringStatus:'2021年再建後、採用は限定的。公式サイトで最新情報を確認。',
  hiringColor:'#6b7d93',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際・国内線乗務。ヨハネスブルグベース。',status:'要公式確認',stag:'gray',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠・SACAA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,000h以上（目安）'},{k:'型式',v:'A330またはB737優遇'}],
      note:'※ 2020〜2021年の再建過程を経て採用再開。最新状況は公式サイトを必ずご確認ください。'},
  ],
  recruitUrl:'https://www.flysaa.com/about-us/careers',
},

{
  file:'kenya-airways.html',code:'KQ',color:'#CC0000',
  nameEn:'Kenya Airways',nameJa:'ケニア航空（Kenya Airways）',
  subtitle:'ケニアフラッグキャリア · "The Pride of Africa"',
  tags:[{cls:'tag-red',label:'🇰🇪 ケニア'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'アフリカ'}],
  stats:[{val:'¥900万〜1,800万',label:'機長年収（外国人契約）',color:'#CC0000'},{val:'¥450万〜900万',label:'FO年収',color:'#ff8888'},{val:'約40機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'ケニア航空は"The Pride of Africa"のキャッチフレーズで知られるケニアのフラッグキャリア。ナイロビをハブにアフリカ域内・欧州・アジアに就航。スカイチーム加盟。外国人パイロットはUSD建て特別契約で採用実績あり。B787とB737を主力とするモダンフリートを保有。財務的な課題を抱えつつも採用継続中。',
  facts:[{k:'本社',v:'ナイロビ（ケニア）'},{k:'ハブ',v:'ジョモ・ケニヤッタ国際空港（NBO）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1977年'},{k:'保有機材',v:'約40機'},{k:'所得税',v:'外国人：要確認'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787/B737）',range:'¥900万〜¥1,800万',avg:'¥1,350万',pct:100,note:'USD建て特別契約',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥450万〜¥900万',avg:'¥650万',pct:48,note:'KES＋USD',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。外国人パイロットはUSD月額$5,000〜$10,000（機長）が目安。ナイロビの生活費は低く実質購買力が高い。公式採用ページで最新条件を確認してください。',
  ops:{routes:'ナイロビハブからアフリカ域内（40都市以上）、欧州（ロンドン・パリ・アムステルダム等）、アジア（バンコク・広州等）、中東（ドバイ等）に就航。',fleet:'Boeing 787-8, B737-800/MAX 8。約40機。'},
  training:T_AF,
  benefits:B_AF,
  hiringStatus:'外国人機長・FO採用実績あり。B787またはB737型式保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。ナイロビベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'契約',v:'固定期間契約（2〜3年）USD建て'}],
      note:'※ ナイロビはアフリカのビジネスハブとして生活環境も整備されている。'},
  ],
  recruitUrl:'https://www.kenya-airways.com/about-us/careers/',
},

{
  file:'egyptair.html',code:'MS',color:'#2F5597',
  nameEn:'EgyptAir',nameJa:'エジプト航空（EgyptAir）',
  subtitle:'エジプト国営フラッグキャリア · スターアライアンス加盟',
  tags:[{cls:'tag-blue',label:'🇪🇬 エジプト'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'アフリカ・中東'}],
  stats:[{val:'¥900万〜1,500万',label:'機長年収（外国人契約）',color:'#2F5597'},{val:'¥450万〜750万',label:'FO年収',color:'#5fb0ff'},{val:'約70機',label:'保有機材数'},{val:'75都市+',label:'就航都市数'}],
  overview:'エジプト航空は1932年設立の世界でも最古の航空会社のひとつ。カイロをハブに欧州・アジア・アフリカ・北米に就航。スターアライアンス加盟。エジプトポンド（EGP）の大幅下落が続いており、ローカル契約の実質給与は低下している。外国人パイロットはUSD建て特別契約で採用されるケースもある。B787・A220・B737を主力とするフリートを保有。',
  facts:[{k:'本社',v:'カイロ（エジプト）'},{k:'ハブ',v:'カイロ国際空港（CAI）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1932年'},{k:'保有機材',v:'約70機'},{k:'所得税',v:'あり（最高25%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（B787/A220）',range:'¥900万〜¥1,500万',avg:'¥1,200万',pct:100,note:'USD建て（外国人）',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥450万〜¥750万',avg:'¥580万',pct:48,note:'EGP＋USD',noteTag:'gray'},
  ],
  salaryNote:'※ USD/JPY=150換算。外国人パイロットはUSD月額$6,000〜$10,000（機長）程度が目安。ローカルパイロットのEGP建て給与は為替影響で実質価値が低下中。住宅手当別途。',
  ops:{routes:'カイロハブから欧州（ロンドン・パリ・フランクフルト等）、北米（ニューヨーク・ロサンゼルス等）、アジア（東京・北京・タイ等）、アフリカ・中東域内に就航。',fleet:'Boeing 787-9, B737-800, Airbus A220-300, A320/A321neo。約70機。'},
  training:T_AF,
  benefits:B_AF,
  hiringStatus:'外国人パイロット採用実績あり。B787またはA320族型式保有者優遇。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（外国人採用）',sub:'国際線乗務。カイロベース。',status:'不定期採用',stag:'blue',
      details:[{k:'必要資格',v:'ATPL（ICAO準拠・ECAA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'契約',v:'固定期間契約（2〜3年）'}],
      note:'※ カイロは物価が低く、USD建て収入の実質購買力は高い。観光・文化的環境も魅力。'},
  ],
  recruitUrl:'https://www.egyptair.com/en/about-egyptair/careers/Pages/default.aspx',
},

];

airlines.forEach(a=>{
  const html=page(a);
  writeFileSync(`airlines/${a.file}`,html,'utf8');
  console.log(`Created: ${a.file}`);
});
console.log('Middle East & Africa airlines done!');
