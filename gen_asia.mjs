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

const T_ASIA=[
  {title:'型式訓練',body:'認定訓練センター（ATC）での型式訓練（地上学科→シミュレーター→実機）を経てライン就航。'},
  {title:'LIFUS（ライン訓練）',body:'型式訓練修了後、教官機長同乗のもとでLine Flying Under Supervisionを実施。通常50〜75レグ程度。'},
  {title:'定期審査（OPC/LPC）',body:'年1〜2回のプロフィシェンシーチェック。各国航空当局（JCAB/CAAK等）の基準に基づく。'},
  {title:'機長昇格',body:'F/O経験・飛行時間・社内審査をクリア後、機長訓練（シミュレーター＋実機）。シニオリティ制が基本。'},
];
const T_LCC=[
  {title:'型式訓練（自費または会社補助）',body:'LCCではA320等の型式訓練費用を自己負担とするケースも。契約条件によって異なる。'},
  {title:'LIFUS',body:'型式取得後、教官機長のもとでライン訓練を実施。FSCと同様の手順。'},
  {title:'定期審査',body:'年1〜2回のOPC/LPC。EASA/CAAK等の規制に従う。'},
  {title:'昇格',body:'副操縦士から機長への昇格は最低3,000〜5,000時間以上。LCCは短期昇格できるケースもある。'},
];
const B_FSC=[
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの大幅割引または無料航空券。提携会社も利用可能。'},
  {icon:'🏥',title:'医療保険',body:'本人・家族向けの包括的な医療保険。ライセンス喪失保険も一般的。'},
  {icon:'💰',title:'ボーナス',body:'業績連動型ボーナス（年2〜4ヶ月分が多い）。一部はパフォーマンス評価と連動。'},
  {icon:'📅',title:'有給休暇',body:'年間20〜30日程度。長距離路線乗務者はリカバリー休暇も含む。'},
  {icon:'🏦',title:'退職金・年金',body:'企業年金または確定拠出年金制度あり。'},
  {icon:'🌐',title:'レイオーバー手当',body:'海外滞在中の日当・宿泊費支給。都市ランク別に設定。'},
];
const B_LCC=[
  {icon:'✈️',title:'スタッフ割引',body:'自社便の割引または無料搭乗。グループ便対象のことが多い。'},
  {icon:'🏥',title:'医療保険',body:'基本的な医療保険。FSCに比べカバレッジが限定的なケースも。'},
  {icon:'📈',title:'Duty Pay',body:'フライトごとのDuty Payまたはプロダクティビティボーナスあり。'},
  {icon:'📅',title:'有給休暇',body:'法定有給休暇。ローカル法に準拠。'},
];

const airlines=[

  // ── Northeast Asia ──────────────────────────────────────────────────────
  {
    file:'korean-air.html',code:'KAL',color:'#0032A0',
    nameEn:'Korean Air',nameJa:'大韓航空（Korean Air）',
    subtitle:'韓国最大の航空会社 · スカイチーム創設メンバー',
    tags:[{cls:'tag-blue',label:'🇰🇷 韓国'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'国際線'}],
    stats:[{val:'¥1,900万〜3,600万',label:'機長年収（税引前）',color:'#0032A0'},{val:'¥900万〜1,800万',label:'FO年収（税引前）',color:'#5b8dee'},{val:'約160機',label:'保有機材数'},{val:'120都市+',label:'就航ネットワーク'}],
    overview:'大韓航空（Korean Air）は1969年設立の韓国最大の国際航空会社。仁川国際空港をハブに北米・欧州・アジア・中東など世界120都市以上に就航。貨物部門でも世界トップクラスの実績を持つ。スカイチーム創設メンバーで、アシアナ航空との統合交渉（2024〜2026年）が業界注目を集めている。',
    facts:[{k:'本社',v:'ソウル（大韓民国）'},{k:'ハブ',v:'仁川国際空港（ICN）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1969年'},{k:'保有機材',v:'160機以上'},{k:'所得税',v:'あり（韓国）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線ワイドボディ',range:'¥1,900万〜¥3,600万',avg:'¥2,800万',pct:100,note:'KRW＋USD手当込み',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥900万〜¥1,800万',avg:'¥1,200万',pct:44,note:'シニオリティにより変動',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。韓国の所得税は累進課税（最高42%）。国際線乗務者は外貨建て手当あり。Glassdoor等の公開データ（2025年）をもとにした参考値。',
    ops:{routes:'仁川ハブから北米（ニューヨーク、ロサンゼルス、シアトル等）、欧州（ロンドン、パリ、フランクフルト等）、東南アジア、中東、大洋州に就航。日本路線も多数（成田・羽田・関西等）。',fleet:'Boeing 777-200ER/300ER, B787-9, B737-8/9, A220-300, A321neo, A380（退役計画中）。総160機超。'},
    training:T_ASIA,
    benefits:B_FSC,
    hiringStatus:'2026年3月現在、外国人パイロット採用は限定的。詳細は公式採用ページを参照。',
    hiringColor:'#6b7d93',
    jobs:[
      {title:'機長・副操縦士（定期採用）',sub:'国内外線乗務。仁川ベース。',status:'要公式確認',stag:'gray',
        details:[{k:'必要資格',v:'ATPL/CPL（ICAO相互承認）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上、FO1,500h以上（目安）'},{k:'雇用形態',v:'正社員'}],
        note:'※ 外国人パイロットの採用条件は不定期。公式採用ページを必ずご確認ください。'},
    ],
    recruitUrl:'https://www.koreanair.com/kr/ko/careers',
  },

  {
    file:'eva-air.html',code:'EVA',color:'#00A599',
    nameEn:'EVA Air',nameJa:'エバー航空（EVA Air）',
    subtitle:'台湾第2位の航空会社 · スターアライアンス加盟',
    tags:[{cls:'tag-green',label:'🇹🇼 台湾'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'5スター認定'}],
    stats:[{val:'¥1,800万〜2,800万',label:'機長年収（目安）',color:'#00A599'},{val:'¥900万〜1,500万',label:'FO年収（目安）',color:'#34d399'},{val:'約90機',label:'保有機材数'},{val:'60都市+',label:'就航都市数'}],
    overview:'エバー航空（EVA Air）は1989年創業の台湾第2位の国際航空会社。スカイトラックス5スター認定を継続的に取得するサービス品質で知られ、長距離路線（北米・欧州）と近距離アジア路線を展開。スターアライアンスメンバーとして世界的なネットワークを持つ。長距離路線の機長不足を背景に外国人パイロット採用も行ってきた実績がある。',
    facts:[{k:'本社',v:'台北（台湾）'},{k:'ハブ',v:'桃園国際空港（TPE）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1989年'},{k:'保有機材',v:'90機'},{k:'所得税',v:'あり（台湾）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線（B777/B787）',range:'¥1,800万〜¥2,800万',avg:'¥2,200万',pct:100,note:'TWD＋USD手当',noteTag:'green'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥900万〜¥1,500万',avg:'¥1,200万',pct:55,note:'シニオリティ制',noteTag:'gray'},
    ],
    salaryNote:'※ TWD/JPY≈4.5、USD/JPY=150換算。台湾は所得税あり（最高40%）。外国人パイロットには通常USD建ての特別契約が提示される。',
    ops:{routes:'桃園ハブから北米（ニューヨーク、シカゴ、ロサンゼルス等）、欧州（ウィーン、アムステルダム等）、東南アジア、日本、韓国等に就航。',fleet:'Boeing 787-9/10, B777-300ER, B777F, A321neo。90機超。'},
    training:T_ASIA,
    benefits:[...B_FSC,{icon:'🌟',title:'5スターサービス環境',body:'スカイトラックス5スター認定の環境での乗務。高品質サービス基準を保つ職場環境。'}],
    hiringStatus:'外国人機長採用実績あり。時期により採用状況が変動。要公式確認。',
    hiringColor:'#f5c842',
    jobs:[
      {title:'機長（Captain）— B777/B787',sub:'国際線ワイドボディ機長',status:'不定期採用',stag:'blue',
        details:[{k:'必要資格',v:'ATPL（ICAO準拠）'},{k:'必要時間',v:'機長5,000h以上（ワイドボディ経験優遇）'},{k:'英語',v:'ICAO Level 4以上'},{k:'契約',v:'台湾雇用法または特別契約'}],note:''},
    ],
    recruitUrl:'https://www.evaair.com/en-global/about-eva-air/careers/',
  },

  {
    file:'china-airlines.html',code:'CAL',color:'#D00027',
    nameEn:'China Airlines',nameJa:'チャイナエアライン（China Airlines）',
    subtitle:'台湾フラッグキャリア · スカイチーム加盟',
    tags:[{cls:'tag-red',label:'🇹🇼 台湾'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,700万〜2,700万',label:'機長年収（目安）',color:'#D00027'},{val:'¥800万〜1,400万',label:'FO年収（目安）',color:'#ff5555'},{val:'約90機',label:'保有機材数'},{val:'50都市+',label:'就航都市'}],
    overview:'チャイナエアライン（China Airlines）は台湾のフラッグキャリア。桃園国際空港をハブに北米・欧州・アジア・オセアニアへ就航する。EVA Airと並ぶ台湾の2大航空会社。貨物輸送でも高い実績を持つ。名称が中国（PRC）と混同されることがあるが、台湾（中華民国）の航空会社。',
    facts:[{k:'本社',v:'台北（台湾）'},{k:'ハブ',v:'桃園国際空港（TPE）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1959年'},{k:'保有機材',v:'89機'},{k:'所得税',v:'あり（台湾）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線',range:'¥1,700万〜¥2,700万',avg:'¥2,100万',pct:100,note:'TWD+手当',noteTag:'red'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥800万〜¥1,400万',avg:'¥1,100万',pct:52,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ TWD/JPY≈4.5換算。外国人採用はUSD建て特別契約の場合あり。',
    ops:{routes:'桃園・高雄ハブから北米（ロサンゼルス、ニューヨーク等）、欧州（アムステルダム等）、東南アジア、日本、オセアニアに就航。',fleet:'Boeing 777-300ER, B787-9, A350-900, B737-800。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人パイロット採用は不定期。詳細は公式サイトで確認。',hiringColor:'#6b7d93',
    jobs:[{title:'パイロット（定期採用）',sub:'国際線',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'経験',v:'ワイドボディ経験優遇'}],note:''}],
    recruitUrl:'https://www.china-airlines.com/au/en/fly/about-china-airlines/jobs/pilot',
  },

  {
    file:'starlux.html',code:'JX',color:'#2C5DE5',
    nameEn:'STARLUX Airlines',nameJa:'スターラックス航空（STARLUX Airlines）',
    subtitle:'台湾のプレミアム新設航空会社 · 2020年就航',
    tags:[{cls:'tag-blue',label:'🇹🇼 台湾'},{cls:'tag-gold',label:'プレミアムキャリア'},{cls:'tag-orange',label:'新設'},{cls:'tag-blue',label:'独立系'}],
    stats:[{val:'¥2,200万〜3,200万',label:'機長年収（目安）',color:'#2C5DE5'},{val:'¥1,000万〜1,600万',label:'FO年収（目安）',color:'#5b8dee'},{val:'約25機',label:'保有機材数'},{k:'2020年',label:'就航開始'}],
    overview:'スターラックス航空（STARLUX Airlines）は2020年1月就航の台湾のプレミアム独立系航空会社。EVA AirグループのCEOだった張國煒氏が創業。中距離・長距離路線でのプレミアムサービスを提供し、2024年からA350-900で北米路線（ロサンゼルス等）を開設。成長フェーズにあり積極的なパイロット採用を継続中。',
    facts:[{k:'本社',v:'台北（台湾）'},{k:'ハブ',v:'桃園国際空港（TPE）'},{k:'設立',v:'2018年（就航2020年）'},{k:'アライアンス',v:'未加盟（独立系）'},{k:'主力機材',v:'A321neo, A350-900'},{k:'成長段階',v:'拡張フェーズ'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'A350/A321 国際線',range:'¥2,200万〜¥3,200万',avg:'¥2,600万',pct:100,note:'プレミアムポジショニング',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥1,000万〜¥1,600万',avg:'¥1,300万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ TWD/JPY≈4.5換算。スターラックスはプレミアムキャリアとして競争力ある待遇を提供。詳細条件は採用時に確認。',
    ops:{routes:'桃園ハブからアジア各都市（東京、大阪、ソウル、バンコク、シンガポール等）および北米（ロサンゼルス、サンフランシスコ、シアトル等）に就航。',fleet:'Airbus A321neo（中距離）, A350-900（長距離北米路線）。発注機材も多数。'},
    training:[
      {title:'型式訓練（A321/A350）',body:'エアバス認定訓練センターでの型式訓練。新航空会社のため最先端の訓練環境を整備中。'},
      {title:'プレミアムサービス訓練',body:'スターラックス独自のプレミアムサービス基準に基づく乗務員訓練。'},
      {title:'LIFUS・OPC',body:'標準的な型式訓練後のライン訓練および定期審査体制。'},
      {title:'昇格',body:'新設航空会社のため、早期からシニア乗務員として活躍できる機会が多い。'},
    ],
    benefits:[
      {icon:'✈️',title:'スタッフ旅行',body:'スターラックス便の社員割引。成長する路線網で利用機会が増加中。'},
      {icon:'💼',title:'プレミアム環境',body:'高品質なキャビン・サービスを誇るプレミアムキャリアとしての乗務環境。'},
      {icon:'📈',title:'成長機会',body:'新設航空会社のため、キャリアの早い段階で上位ポジションへの昇格チャンスあり。'},
      {icon:'🏥',title:'医療保険',body:'本人・家族向け医療保険。'},
      {icon:'💰',title:'ボーナス',body:'業績連動ボーナス。'},
    ],
    hiringStatus:'拡張フェーズのため積極採用中（2026年3月）。外国人機長の採用実績あり。',
    hiringColor:'#34d399',
    jobs:[
      {title:'機長（Captain）— A350-900',sub:'北米・長距離国際線機長',status:'採用中（要確認）',stag:'green',
        details:[{k:'必要資格',v:'ATPL（ICAO相互承認）'},{k:'経験',v:'ワイドボディ機長経験者優先'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
      {title:'副操縦士（F/O）— A321neo/A350',sub:'中短距離および長距離路線',status:'採用中（要確認）',stag:'green',
        details:[{k:'必要資格',v:'CPL/ATPL'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
    ],
    recruitUrl:'https://www.starlux-airlines.com/en-TW/about/career',
  },

  // ── Southeast Asia ───────────────────────────────────────────────────────
  {
    file:'thai-airways.html',code:'TG',color:'#6B1F7C',
    nameEn:'Thai Airways International',nameJa:'タイ国際航空（Thai Airways）',
    subtitle:'タイ王国フラッグキャリア · スターアライアンス加盟',
    tags:[{cls:'tag-blue',label:'🇹🇭 タイ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,400万〜2,500万',label:'機長年収（目安）',color:'#6B1F7C'},{val:'¥700万〜1,300万',label:'FO年収（目安）'},{val:'약80機',label:'保有機材数'},{val:'70都市+',label:'就航都市'}],
    overview:'タイ国際航空（THAI）はタイのフラッグキャリア。バンコク・スワンナプーム空港をハブに欧州・北東アジア・南アジアに広域ネットワークを展開。2020年に経営再建（民事更生手続）を経て2024年に手続き完了。現在は財務健全化を図りながら路線を再整備中。スターアライアンス加盟。',
    facts:[{k:'本社',v:'バンコク（タイ）'},{k:'ハブ',v:'スワンナプーム国際空港（BKK）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1960年'},{k:'状況',v:'経営再建後（2024年完了）'},{k:'所得税',v:'あり（タイ）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線（広胴機）',range:'¥1,400万〜¥2,500万',avg:'¥1,900万',pct:100,note:'USD+THB手当',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥700万〜¥1,300万',avg:'¥950万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150、THB/JPY≈4.3換算。外国人パイロットはUSD建て契約が多い。経営再建後の待遇改善が進行中。',
    ops:{routes:'バンコクから欧州（ロンドン、フランクフルト、パリ等）、日本（成田、羽田等）、東アジア、南アジアに就航。',fleet:'Boeing 777-200/300ER, B787-8/9, Airbus A350-900。約80機。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'経営再建フェーズ。採用は限定的。詳細は公式サイトで確認。',hiringColor:'#6b7d93',
    jobs:[{title:'パイロット採用',sub:'採用詳細は公式サイト参照',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'英語',v:'ICAO Level 4以上'}],note:''}],
    recruitUrl:'https://www.thaiairways.com/en_TH/about_thai/about/career.page',
  },

  {
    file:'malaysia-airlines.html',code:'MH',color:'#003580',
    nameEn:'Malaysia Airlines',nameJa:'マレーシア航空（Malaysia Airlines）',
    subtitle:'マレーシアフラッグキャリア · ワンワールド加盟',
    tags:[{cls:'tag-blue',label:'🇲🇾 マレーシア'},{cls:'tag-gold',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,300万〜2,300万',label:'機長年収（目安）'},{val:'¥600万〜1,200万',label:'FO年収（目安）'},{val:'약80機',label:'保有機材数'},{val:'50都市+',label:'就航都市'}],
    overview:'マレーシア航空（Malaysia Airlines / MAB）はクアラルンプール国際空港を拠点とするマレーシアのフラッグキャリア。2014年のMH370・MH17相次ぐ事故から経営再建を経て現在に至る。ワンワールド加盟。外国人機長の採用実績を持つ。',
    facts:[{k:'本社',v:'クアラルンプール（マレーシア）'},{k:'ハブ',v:'クアラルンプール国際空港（KUL）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1947年'},{k:'状況',v:'経営再建後'},{k:'所得税',v:'あり（マレーシア）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線',range:'¥1,300万〜¥2,300万',avg:'¥1,700万',pct:100,note:'MYR+USD手当',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥600万〜¥1,200万',avg:'¥850万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ MYR/JPY≈33、USD/JPY=150換算。外国人採用時はUSD建て契約の場合あり。',
    ops:{routes:'KLハブから日本、中国、東南アジア、欧州（ロンドン等）、オーストラリアに就航。',fleet:'Airbus A330-200/300, A350-900, Boeing 737-800 MAX。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人パイロット採用実績あり（不定期）。最新情報は公式サイトで確認。',hiringColor:'#f5c842',
    jobs:[{title:'機長（Direct Entry Captain）',sub:'国際線広胴機',status:'不定期採用',stag:'blue',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'経験',v:'ワイドボディ5,000h以上'}],note:''}],
    recruitUrl:'https://www.malaysiaairlines.com/my/en/site/careers.html',
  },

  {
    file:'garuda-indonesia.html',code:'GA',color:'#00843D',
    nameEn:'Garuda Indonesia',nameJa:'ガルーダ・インドネシア航空（Garuda Indonesia）',
    subtitle:'インドネシアフラッグキャリア · スカイチーム加盟',
    tags:[{cls:'tag-green',label:'🇮🇩 インドネシア'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,100万〜1,900万',label:'機長年収（目安）'},{val:'¥500万〜1,100万',label:'FO年収（目安）'},{val:'約65機',label:'保有機材数'},{val:'50都市+',label:'就航都市'}],
    overview:'ガルーダ・インドネシア航空は1949年設立のインドネシアの国営フラッグキャリア。ジャカルタ・スカルノハッタ空港をハブに国内線・国際線を運航。2022年に財務再建を完了。スカイトラックス5スターを過去に取得した実績を持つ。',
    facts:[{k:'本社',v:'ジャカルタ（インドネシア）'},{k:'ハブ',v:'スカルノハッタ国際空港（CGK）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1949年'},{k:'オーナー',v:'インドネシア政府'},{k:'所得税',v:'あり（インドネシア）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線',range:'¥1,100万〜¥1,900万',avg:'¥1,500万',pct:100,note:'USD+IDR手当',noteTag:'green'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥500万〜¥1,100万',avg:'¥750万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。インドネシアルピア（IDR）建て給与もあり。外国人パイロットはUSD契約が多い。',
    ops:{routes:'ジャカルタ・バリ（デンパサール）ハブから東南アジア、東アジア（日本含む）、中東、欧州（アムステルダム）に就航。',fleet:'Boeing 737-800, 737 MAX 8, 777-300ER, Airbus A330-300。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人パイロット採用は不定期。財務再建後の採用状況は要確認。',hiringColor:'#6b7d93',
    jobs:[{title:'パイロット採用',sub:'国内外線',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'英語',v:'ICAO Level 4以上'}],note:''}],
    recruitUrl:'https://career.garuda-indonesia.com/',
  },

  {
    file:'vietnam-airlines.html',code:'VN',color:'#BE0A30',
    nameEn:'Vietnam Airlines',nameJa:'ベトナム航空（Vietnam Airlines）',
    subtitle:'ベトナム国営フラッグキャリア · スカイチーム加盟',
    tags:[{cls:'tag-red',label:'🇻🇳 ベトナム'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,000万〜1,800万',label:'機長年収（目安）'},{val:'¥500万〜1,000万',label:'FO年収（目安）'},{val:'約100機',label:'保有機材数'},{val:'50都市+',label:'就航都市'}],
    overview:'ベトナム航空はベトナムの国営フラッグキャリア。ハノイ・ノイバイ空港を主ハブに東アジア・欧州・オーストラリアへ就航。A350やB787等の先進機材を導入し、近年は外国人機長の需要が高い。スカイチーム加盟。',
    facts:[{k:'本社',v:'ハノイ（ベトナム）'},{k:'ハブ',v:'ノイバイ国際空港（HAN）・タンソンニャット（SGN）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1956年'},{k:'オーナー',v:'ベトナム政府'},{k:'外国人採用',v:'実績あり'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線（A350/B787）',range:'¥1,000万〜¥1,800万',avg:'¥1,400万',pct:100,note:'USD建て契約が多い',noteTag:'red'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥500万〜¥1,000万',avg:'¥700万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人パイロットへのUSD建て契約あり。ベトナムでの所得税が適用される場合あり。',
    ops:{routes:'ハノイ・ホーチミンから日本、韓国、中国、欧州（ロンドン、パリ、フランクフルト等）、オーストラリアに就航。',fleet:'Airbus A350-900, A321neo, Boeing 787-9/10, 787-8, 737 MAX。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人機長の採用実績あり。パイロット不足を背景に積極的な採用期間もある。',hiringColor:'#f5c842',
    jobs:[{title:'機長（Contract Captain）',sub:'外国人パイロット契約採用',status:'不定期採用',stag:'blue',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'経験',v:'ワイドボディ機長経験'},{k:'契約',v:'USD建て固定期間契約'}],note:''}],
    recruitUrl:'https://www.vietnamairlines.com/vn/en/the-vietnam-airlines/careers',
  },

  {
    file:'philippine-airlines.html',code:'PAL',color:'#0033A0',
    nameEn:'Philippine Airlines',nameJa:'フィリピン航空（Philippine Airlines）',
    subtitle:'フィリピンのフラッグキャリア · アジア最古の航空会社のひとつ',
    tags:[{cls:'tag-blue',label:'🇵🇭 フィリピン'},{cls:'tag-gold',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'}],
    stats:[{val:'¥1,100万〜2,000万',label:'機長年収（目安）'},{val:'¥500万〜1,100万',label:'FO年収（目安）'},{val:'約80機',label:'保有機材数'},{val:'40都市+',label:'就航都市'}],
    overview:'フィリピン航空（PAL）は1941年設立のフィリピンのフラッグキャリア。マニラ・ニノイアキノ国際空港を拠点に北米・中東・東アジア・東南アジアに就航。2021年にChapter 11（米連邦破産法）を申請し2022年に再建完了。ワンワールド加盟。',
    facts:[{k:'本社',v:'マニラ（フィリピン）'},{k:'ハブ',v:'ニノイアキノ国際空港（MNL）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1941年'},{k:'状況',v:'再建後（2022年）'},{k:'所得税',v:'あり（フィリピン）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線（広胴機）',range:'¥1,100万〜¥2,000万',avg:'¥1,500万',pct:100,note:'USD+PHP手当',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥500万〜¥1,100万',avg:'¥750万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人パイロットにはUSD建て契約が提示されることが多い。',
    ops:{routes:'マニラから北米（ロサンゼルス、ニューヨーク、サンフランシスコ等）、中東、東アジア（日本・韓国）、東南アジアに就航。',fleet:'Airbus A350-900, A330-300, A321neo/ceo, Boeing 777-300ER。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人パイロット採用実績あり（不定期）。再建後の採用動向は要確認。',hiringColor:'#f5c842',
    jobs:[{title:'パイロット採用',sub:'国際線',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'英語',v:'ICAO Level 4以上'}],note:''}],
    recruitUrl:'https://www.philippineairlines.com/aboutus/careers',
  },

  {
    file:'airasia.html',code:'AK',color:'#D20001',
    nameEn:'AirAsia Group',nameJa:'エアアジア・グループ（AirAsia Group）',
    subtitle:'東南アジア最大のLCC · アジア展開拠点多数',
    tags:[{cls:'tag-red',label:'🇲🇾 マレーシア拠点'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'アジア最大LCC'}],
    stats:[{val:'¥900万〜1,600万',label:'機長年収（目安）'},{val:'¥450万〜900万',label:'FO年収（目安）'},{val:'200機+',label:'グループ保有機材'},{val:'165都市+',label:'就航都市'}],
    overview:'エアアジア・グループは2001年設立。マレーシア・タイ・インドネシア・フィリピン・インド等に展開する東南アジア最大のLCC。A320ファミリー専業で、格安航空の代名詞的存在。外国人パイロットの採用実績もある。グループ各社（AirAsia、AirAsia X等）で構成。',
    facts:[{k:'本部',v:'クアラルンプール（マレーシア）'},{k:'ハブ',v:'クアラルンプール（KLIA2）他グループ各拠点'},{k:'設立',v:'2001年'},{k:'機材',v:'A320ファミリー専業'},{k:'グループ展開',v:'マレーシア・タイ・インドネシア・フィリピン・インド'},{k:'雇用形態',v:'正社員・契約多様'}],
    salaryRows:[
      {pos:'機長（Captain）— A320',sub:'東南アジア中短距離路線',range:'¥900万〜¥1,600万',avg:'¥1,200万',pct:100,note:'MYR+手当',noteTag:'orange'},
      {pos:'副操縦士（F/O）— A320',sub:'国内外線',range:'¥450万〜¥900万',avg:'¥650万',pct:54,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ MYR/JPY≈33換算。LCCのため基本給はFSCより低いが、生産性給与（Duty Pay）で補完されるケースもある。',
    ops:{routes:'東南アジア各都市、日本、韓国、中国、インド、中東に広域展開。AirAsia X（長距離）も含む。',fleet:'Airbus A320/A321 専業（グループ全体で200機以上）。'},
    training:T_LCC,benefits:B_LCC,
    hiringStatus:'グループ各社で定期採用あり。募集状況はエンティティにより異なる。',hiringColor:'#34d399',
    jobs:[{title:'機長（Captain）/ 副操縦士（F/O）— A320',sub:'グループ各社（マレーシア・タイ・インドネシア等）',status:'定期採用中',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'型式',v:'A320型式（優遇）'},{k:'英語',v:'ICAO Level 4以上'}],note:'応募先はグループ各社の採用ページ参照'}],
    recruitUrl:'https://careers.airasia.com/',
  },

  {
    file:'scoot.html',code:'TR',color:'#FEC10D',
    nameEn:'Scoot',nameJa:'スクート（Scoot）',
    subtitle:'シンガポール航空グループのLCC · 中長距離路線展開',
    tags:[{cls:'tag-gold',label:'🇸🇬 シンガポール'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'SQグループ'}],
    stats:[{val:'¥1,600万〜2,400万',label:'機長年収（目安）',color:'#d4a00b'},{val:'¥800万〜1,400万',label:'FO年収（目安）'},{val:'约60機',label:'保有機材数'},{val:'70都市+',label:'就航都市'}],
    overview:'スクート（Scoot）はシンガポール航空グループのLCC。中長距離路線を中心に東アジア・東南アジア・オーストラリア・欧州路線を展開。B787とA320ファミリーを保有。シンガポールを拠点とするため、税制メリット（シンガポールは比較的低税率）もある。外国人パイロットの採用実績が豊富。',
    facts:[{k:'本社',v:'シンガポール'},{k:'ハブ',v:'シンガポール・チャンギ国際空港（SIN）'},{k:'親会社',v:'Singapore Airlines Group'},{k:'設立',v:'2011年'},{k:'機材',v:'B787-8/9, A320/A321neo'},{k:'所得税',v:'あり（シンガポール・低率）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'B787 長距離 / A320 短距離',range:'¥1,600万〜¥2,400万',avg:'¥2,000万',pct:100,note:'SGD建て（低税率）',noteTag:'gold'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥800万〜¥1,400万',avg:'¥1,100万',pct:55,note:'SGD建て',noteTag:'gray'},
    ],
    salaryNote:'※ SGD/JPY≈112換算。シンガポール個人所得税は最高24%（低税率）。シンガポール拠点生活は物価が高い点に注意。',
    ops:{routes:'シンガポールから日本、韓国、台湾、中国、オーストラリア、欧州（ベルリン等）に就航。約70都市以上。',fleet:'Boeing 787-8/9（長距離）, Airbus A320/A321neo（短中距離）。約60機。'},
    training:[...T_LCC.slice(0,2),{title:'SIA Group基準',body:'シンガポール航空グループの高い安全・訓練基準が適用される。SIA Engineeringとの連携あり。'},{title:'定期審査',body:'CAAS（シンガポール民間航空局）基準によるOPC/LPC。年1〜2回。'}],
    benefits:[{icon:'✈️',title:'SIAグループ特典',body:'シンガポール航空・スクート等グループ各社の社員割引。'},{icon:'🌏',title:'シンガポール生活',body:'アジアの金融ハブ・シンガポールを拠点とした生活。多国籍環境。'},{icon:'🏥',title:'医療保険',body:'包括的な医療保険（シンガポール高水準の医療）。'},{icon:'💰',title:'低税率',body:'シンガポールの個人所得税は最高24%で中東ほどではないが低税率。'}],
    hiringStatus:'定期的に外国人パイロット採用あり。B787・A320どちらも需要あり。',hiringColor:'#34d399',
    jobs:[
      {title:'機長（Captain）— B787',sub:'長距離国際線',status:'採用中（要確認）',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'B787型式',v:'保有または取得意欲'},{k:'経験',v:'ワイドボディ機長経験'}],note:''},
      {title:'副操縦士（F/O）— A320/A321',sub:'中短距離路線',status:'採用中（要確認）',stag:'green',details:[{k:'資格',v:'CPL/ATPL'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
    ],
    recruitUrl:'https://careers.flyscoot.com/',
  },

  // ── South Asia ───────────────────────────────────────────────────────────
  {
    file:'indigo.html',code:'6E',color:'#005499',
    nameEn:'IndiGo',nameJa:'インディゴ（IndiGo）',
    subtitle:'インド最大のLCC · A320ファミリー専業',
    tags:[{cls:'tag-blue',label:'🇮🇳 インド'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'アジア最大LCCのひとつ'}],
    stats:[{val:'¥1,000万〜1,800万',label:'機長年収（目安）'},{val:'¥500万〜900万',label:'FO年収（目安）'},{val:'350機+',label:'保有機材数（発注含む）'},{val:'100都市+',label:'就航都市'}],
    overview:'インディゴ（IndiGo）は2006年設立のインド最大の航空会社。国内線シェア約60%を誇り、A320ファミリー500機超の発注を持つ世界最大規模のA320オペレーターのひとつ。急速な成長に伴いパイロット不足が慢性的で、外国人パイロット採用を積極的に実施している。',
    facts:[{k:'本社',v:'グルガオン（インド）'},{k:'ハブ',v:'デリー・インディラガンジー国際空港（DEL）'},{k:'設立',v:'2006年'},{k:'機材',v:'A320ファミリー専業'},{k:'国内線シェア',v:'インド国内約60%'},{k:'所得税',v:'あり（インド）'}],
    salaryRows:[
      {pos:'機長（Captain）— A320',sub:'国内線・国際線',range:'¥1,000万〜¥1,800万',avg:'¥1,400万',pct:100,note:'INR+USD（国際線）',noteTag:'blue'},
      {pos:'副操縦士（F/O）— A320',sub:'国内線・国際線',range:'¥500万〜¥900万',avg:'¥700万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150、INR/JPY≈1.8換算。外国人パイロットへのUSD建て契約あり。インドの急速な航空市場成長でパイロット需要が高い。',
    ops:{routes:'インド国内全主要都市・地方都市への高頻度運航。国際線（中東・東南アジア）も急拡大中。',fleet:'Airbus A320neo/A321neo 専業。世界最大規模のA320ファミリー発注数（500機超）。'},
    training:[...T_LCC,{title:'急拡大に伴う訓練需要',body:'インディゴの急成長により訓練センターを積極拡充。インドのパイロット不足から外国人機長に対する需要が高い。'}],
    benefits:[{icon:'✈️',title:'急成長市場',body:'インドの航空需要は世界最大成長率。キャリアの急成長が期待できる環境。'},{icon:'💰',title:'外国人手当',body:'外国人採用時はUSD建て特別待遇の場合あり。'},{icon:'📈',title:'昇格スピード',body:'急成長により昇格機会が多い。'},...B_LCC.slice(2)],
    hiringStatus:'外国人機長（A320型式取得者）を積極採用中（2026年3月）。',hiringColor:'#34d399',
    jobs:[{title:'機長（Captain）— A320/A321neo',sub:'外国人直接採用（Direct Entry）',status:'積極採用中',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'型式',v:'A320型式（必須）'},{k:'最低時間',v:'機長1,500h以上（A320で）'},{k:'英語',v:'ICAO Level 4以上'},{k:'契約',v:'USD建て固定期間または正社員'}],note:'インドDGCA（民間航空総局）の書類手続きが必要。'}],
    recruitUrl:'https://careers.goindigo.in/',
  },

  {
    file:'air-india.html',code:'AI',color:'#8B1538',
    nameEn:'Air India',nameJa:'エア・インディア（Air India）',
    subtitle:'インドのフラッグキャリア · スターアライアンス加盟（予定）',
    tags:[{cls:'tag-red',label:'🇮🇳 インド'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'タタ傘下'}],
    stats:[{val:'¥1,200万〜2,200万',label:'機長年収（目安）'},{val:'¥600万〜1,200万',label:'FO年収（目安）'},{val:'120機+',label:'現有機材'},{val:'世界最大級',label:'発注残（470機超）'}],
    overview:'エア・インディアは2022年にタタ・グループが国有化から民営化を完了。タタ傘下での大規模刷新が進む。2023年にAirbusとBoeingに合わせて470機超の大型発注を発表し世界を驚かせた。スターアライアンス加盟に向けた準備が進む。急速な成長に伴いパイロット大量採用が進行中。',
    facts:[{k:'本社',v:'デリー（インド）'},{k:'ハブ',v:'インディラガンジー国際空港（DEL）・ムンバイ（BOM）'},{k:'親会社',v:'タタ・グループ（2022年民営化）'},{k:'アライアンス',v:'スターアライアンス加盟準備中'},{k:'発注機材',v:'A350, A321neo, B787, B777X 等470機+'},{k:'所得税',v:'あり（インド）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国際線ワイドボディ',range:'¥1,200万〜¥2,200万',avg:'¥1,700万',pct:100,note:'USD建て外国人契約あり',noteTag:'red'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥600万〜¥1,200万',avg:'¥900万',pct:52,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。タタ傘下での刷新に伴い待遇改善が進行中。外国人パイロットのUSD建て採用あり。',
    ops:{routes:'デリー・ムンバイハブから北米（ニューヨーク、シカゴ等）、英国（ロンドン）、欧州、東南アジア、日本・東アジアに就航。国内線も広域展開。',fleet:'Boeing 777-200LR/300ER, B787-8, Airbus A350（受領中）, A321neo, A319。急拡大中。'},
    training:[...T_ASIA,{title:'タタグループ改革',body:'タタ傘下での大規模刷新により訓練システムも近代化。シミュレーターセンターを整備中。'}],
    benefits:[{icon:'📈',title:'急成長市場',body:'インド最大規模の航空拡張計画に乗るキャリア機会。'},{icon:'✈️',title:'スタッフ旅行',body:'エア・インディア及びタタ傘下各社の割引搭乗。'},...B_FSC.slice(1)],
    hiringStatus:'大規模拡張に伴い積極採用中。外国人機長採用実績あり（2026年3月）。',hiringColor:'#34d399',
    jobs:[
      {title:'機長（Direct Entry Captain）',sub:'国際線（B777/B787/A350）',status:'採用中',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'経験',v:'ワイドボディ機長経験'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
      {title:'副操縦士（F/O）',sub:'国内外線',status:'採用中',stag:'green',details:[{k:'資格',v:'CPL/ATPL'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
    ],
    recruitUrl:'https://careers.airindia.com/',
  },

  // ── China ────────────────────────────────────────────────────────────────
  {
    file:'air-china.html',code:'CA',color:'#D50012',
    nameEn:'Air China',nameJa:'中国国際航空（Air China）',
    subtitle:'中国フラッグキャリア · スターアライアンス加盟',
    tags:[{cls:'tag-red',label:'🇨🇳 中国'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'国営'}],
    stats:[{val:'¥1,700万〜3,000万',label:'機長年収（外国人・目安）'},{val:'¥800万〜1,600万',label:'FO年収（目安）'},{val:'430機+',label:'保有機材数'},{val:'100都市+',label:'国際就航都市'}],
    overview:'中国国際航空（Air China）は中国のフラッグキャリアであり、スターアライアンス加盟の国際航空会社。北京・首都国際空港および北京大興空港をハブに国内外に広域展開。過去には外国人パイロット（特に機長）の積極採用を実施してきたが、採用方針は時期により変動する。',
    facts:[{k:'本社',v:'北京（中国）'},{k:'ハブ',v:'北京首都（PEK）・大興（PKX）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1988年'},{k:'オーナー',v:'中国政府（国有）'},{k:'外国人採用',v:'過去実績あり（変動）'}],
    salaryRows:[
      {pos:'機長（外国人契約）',sub:'国際線ワイドボディ',range:'¥1,700万〜¥3,000万',avg:'¥2,200万',pct:100,note:'USD建て特別契約',noteTag:'red'},
      {pos:'副操縦士（F/O）',sub:'中国国内・外国人',range:'¥800万〜¥1,600万',avg:'¥1,100万',pct:50,note:'CNY+USD',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150、CNY/JPY≈20換算。外国人パイロットへのUSD建て特別契約あり。中国の個人所得税は最高45%だが、外国人向け優遇措置もある。採用条件は要確認。',
    ops:{routes:'北京ハブから欧米（ロンドン、フランクフルト、ロサンゼルス、ニューヨーク等）、東南アジア、日本（成田・羽田等）、中東、オセアニアに就航。',fleet:'Boeing 777-300ER, B737-8, Airbus A350, A321neo, A320neo, C919（国産）等430機超。'},
    training:T_ASIA,benefits:[...B_FSC,{icon:'🏙️',title:'北京・上海生活',body:'中国大都市を拠点とした生活。物価は上昇傾向だが生活費は日本より低いケースも。'}],
    hiringStatus:'外国人パイロット採用は方針が変動。近年は中国人パイロット育成を優先する傾向。要最新確認。',hiringColor:'#6b7d93',
    jobs:[{title:'外国人機長（Contract Captain）',sub:'国際線ワイドボディ（不定期）',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'経験',v:'ワイドボディ5,000h+'},{k:'中国CAAC',v:'免許書き換え必要'}],note:'⚠️ 中国のCAACライセンス書き換えには時間・費用がかかる場合あり。'}],
    recruitUrl:'https://www.airchina.com.cn/en/info/recruitmnet/',
  },

  {
    file:'china-southern.html',code:'CZ',color:'#006AB6',
    nameEn:'China Southern Airlines',nameJa:'中国南方航空（China Southern Airlines）',
    subtitle:'中国最大の旅客数を誇る航空会社 · スカイチーム加盟',
    tags:[{cls:'tag-blue',label:'🇨🇳 中国'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'国営'}],
    stats:[{val:'¥1,600万〜2,800万',label:'機長年収（外国人・目安）'},{val:'¥700万〜1,400万',label:'FO年収（目安）'},{val:'600機+',label:'保有機材数'},{val:'200都市+',label:'就航都市'}],
    overview:'中国南方航空（CZ）は中国最大の旅客数を持つ航空会社。広州天河国際空港をメインハブに国内全土と国際線に展開する。旅客数・機材数ともに中国最大規模。スカイチーム加盟。外国人機長採用を積極的に行ってきた時期もある。',
    facts:[{k:'本社',v:'広州（中国）'},{k:'ハブ',v:'広州天河（CAN）・北京大興（PKX）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1988年'},{k:'オーナー',v:'中国政府（国有）'},{k:'規模',v:'旅客数・機材中国最大'}],
    salaryRows:[
      {pos:'機長（外国人契約）',sub:'国際線ワイドボディ',range:'¥1,600万〜¥2,800万',avg:'¥2,100万',pct:100,note:'USD建て特別契約',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥700万〜¥1,400万',avg:'¥1,000万',pct:47,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人特別採用はUSD建て契約。時期により採用方針が変動するため要確認。',
    ops:{routes:'広州・北京から東南アジア、日本（成田・羽田・関西等）、欧米、オセアニア（シドニー等）に就航。',fleet:'Boeing 787, B777, B737シリーズ, Airbus A380, A330, A321/A320, C919等600機超。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人採用方針は変動。要最新確認。',hiringColor:'#6b7d93',
    jobs:[{title:'外国人機長（Contract Captain）',sub:'国際線（不定期）',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'CAAC書き換え',v:'必要'}],note:''}],
    recruitUrl:'https://hr.csair.com/recruitment/',
  },

  {
    file:'china-eastern.html',code:'MU',color:'#0063BE',
    nameEn:'China Eastern Airlines',nameJa:'中国東方航空（China Eastern Airlines）',
    subtitle:'上海拠点の中国3大キャリア · スカイチーム加盟',
    tags:[{cls:'tag-blue',label:'🇨🇳 中国'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'国営'}],
    stats:[{val:'¥1,600万〜2,800万',label:'機長年収（外国人・目安）'},{val:'¥700万〜1,400万',label:'FO年収（目安）'},{val:'500機+',label:'保有機材数'},{val:'150都市+',label:'就航都市'}],
    overview:'中国東方航空（MU）は上海・虹橋国際空港および浦東国際空港をハブとする中国3大航空会社のひとつ。スカイチーム加盟。日本路線が特に充実しており、成田・羽田・関西から上海への多数の便を運航。外国人パイロットの採用実績もある。',
    facts:[{k:'本社',v:'上海（中国）'},{k:'ハブ',v:'上海浦東（PVG）・虹橋（SHA）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1988年'},{k:'オーナー',v:'中国政府（国有）'},{k:'日本路線',v:'豊富（成田・羽田・関西等）'}],
    salaryRows:[
      {pos:'機長（外国人契約）',sub:'国際線ワイドボディ',range:'¥1,600万〜¥2,800万',avg:'¥2,100万',pct:100,note:'USD建て特別契約',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥700万〜¥1,400万',avg:'¥1,000万',pct:47,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人特別採用はUSD建て契約が一般的。',
    ops:{routes:'上海から日本（成田・羽田・関西・中部・福岡等）、欧米、東南アジア、オセアニアに就航。日本路線は特に充実。',fleet:'Airbus A350, A330, A321/A320neo/ceo, Boeing 777, B737 MAX等500機超。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人採用は不定期。要最新確認。',hiringColor:'#6b7d93',
    jobs:[{title:'外国人機長（Contract Captain）',sub:'国際線（不定期）',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'CAAC書き換え',v:'必要'}],note:''}],
    recruitUrl:'https://hr.ceair.com/',
  },

  {
    file:'hainan-airlines.html',code:'HU',color:'#0063A7',
    nameEn:'Hainan Airlines',nameJa:'海南航空（Hainan Airlines）',
    subtitle:'中国民間最大の独立系航空会社 · HNAグループ',
    tags:[{cls:'tag-blue',label:'🇨🇳 中国'},{cls:'tag-gold',label:'スカイトラックス5スター'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gray',label:'民間系'}],
    stats:[{val:'¥1,500万〜2,500万',label:'機長年収（外国人・目安）'},{val:'¥700万〜1,300万',label:'FO年収（目安）'},{val:'200機+',label:'保有機材数'},{val:'60都市+',label:'国際就航都市'}],
    overview:'海南航空（Hainan Airlines）はHNAグループ傘下の中国最大の民間独立系航空会社。スカイトラックス5スター認定の高品質サービスで知られる。北京・海口をハブに中国全土と国際線を展開。HNAグループの財務再編を経て現在も運営中。',
    facts:[{k:'本社',v:'海口（中国・海南省）'},{k:'ハブ',v:'北京首都（PEK）・海口（HAK）'},{k:'アライアンス',v:'未加盟'},{k:'設立',v:'1993年'},{k:'サービス',v:'スカイトラックス5スター'},{k:'外国人採用',v:'実績あり'}],
    salaryRows:[
      {pos:'機長（外国人契約）',sub:'国際線',range:'¥1,500万〜¥2,500万',avg:'¥2,000万',pct:100,note:'USD建て契約',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥700万〜¥1,300万',avg:'¥950万',pct:47,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人採用はUSD建て特別契約。',
    ops:{routes:'北京・海口から国内全主要都市、国際線（米国・欧州・日本・東南アジア）に就航。',fleet:'Boeing 787-8/9, B737-800 MAX, Airbus A330等200機超。'},
    training:T_ASIA,benefits:B_FSC,
    hiringStatus:'外国人採用実績あり。HNAグループ再編後の状況は要確認。',hiringColor:'#6b7d93',
    jobs:[{title:'外国人機長',sub:'国際線（不定期）',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'CAAC書き換え',v:'必要'}],note:''}],
    recruitUrl:'https://www.hnair.com/HNA/chinese/recruitmentEnter.do',
  },

  {
    file:'vietjet.html',code:'VJ',color:'#E30022',
    nameEn:'VietJet Air',nameJa:'ベトジェットエア（VietJet Air）',
    subtitle:'ベトナム最大のLCC · 急速成長する格安航空',
    tags:[{cls:'tag-red',label:'🇻🇳 ベトナム'},{cls:'tag-orange',label:'LCC'},{cls:'tag-orange',label:'急成長'}],
    stats:[{val:'¥900万〜1,500万',label:'機長年収（目安）'},{val:'¥400万〜800万',label:'FO年収（目安）'},{val:'約90機',label:'保有機材数'},{val:'160便以上',label:'国際線就航路線'}],
    overview:'ベトジェットエア（VietJet）は2011年設立のベトナム初の民間LCC。ホーチミン・ハノイをハブに東南アジア・東アジア・南アジアに急速展開。A320ファミリー専業。急成長に伴い外国人パイロット（特に機長）の需要が高く、採用を継続している。',
    facts:[{k:'本社',v:'ハノイ（ベトナム）'},{k:'ハブ',v:'タンソンニャット（SGN）・ノイバイ（HAN）'},{k:'設立',v:'2011年'},{k:'機材',v:'A320ファミリー専業'},{k:'成長',v:'ベトナム最大旅客数のLCC'},{k:'外国人採用',v:'積極的'}],
    salaryRows:[
      {pos:'機長（Captain）— A320',sub:'国内線・国際線',range:'¥900万〜¥1,500万',avg:'¥1,200万',pct:100,note:'USD建て外国人契約あり',noteTag:'red'},
      {pos:'副操縦士（F/O）— A320',sub:'国内外線',range:'¥400万〜¥800万',avg:'¥600万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人機長へのUSD建て契約実績あり。ベトナムでの所得税あり。',
    ops:{routes:'ホーチミン・ハノイから東南アジア各国、日本（成田・大阪等）、韓国、台湾、インド等に就航。',fleet:'Airbus A320/A321neo。約90機（発注含むと大幅増）。'},
    training:T_LCC,benefits:B_LCC,
    hiringStatus:'外国人機長を積極採用中（A320型式取得者優先）。',hiringColor:'#34d399',
    jobs:[{title:'機長（Contract Captain）— A320/A321',sub:'外国人直接採用',status:'採用中',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'型式',v:'A320型式（必須）'},{k:'英語',v:'ICAO Level 4以上'},{k:'契約',v:'USD建て固定期間'}],note:'ベトナムDGCA免許書き換えが必要。'}],
    recruitUrl:'https://careers.vietjetair.com/',
  },

  {
    file:'bamboo-airways.html',code:'QH',color:'#35774E',
    nameEn:'Bamboo Airways',nameJa:'バンブー・エアウェイズ（Bamboo Airways）',
    subtitle:'ベトナムの民間FSC · 2019年就航',
    tags:[{cls:'tag-green',label:'🇻🇳 ベトナム'},{cls:'tag-gray',label:'FSC寄り'},{cls:'tag-gray',label:'中規模'}],
    stats:[{val:'¥800万〜1,400万',label:'機長年収（目安）'},{val:'¥400万〜800万',label:'FO年収（目安）'},{val:'約30機',label:'保有機材数'},{val:'2019年',label:'就航開始'}],
    overview:'バンブー・エアウェイズは2019年就航のベトナムの民間航空会社。FLCグループが設立。ハノイ・ホーチミンから国内線と国際線（日本・韓国等）を運営。A320ファミリーとB787を保有。外国人パイロットの採用実績あり。',
    facts:[{k:'本社',v:'ハノイ（ベトナム）'},{k:'ハブ',v:'ノイバイ（HAN）・タンソンニャット（SGN）'},{k:'設立',v:'2017年（就航2019年）'},{k:'機材',v:'A320/A321, B787'},{k:'外国人採用',v:'実績あり'},{k:'所得税',v:'あり（ベトナム）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国内外線',range:'¥800万〜¥1,400万',avg:'¥1,100万',pct:100,note:'USD建て外国人契約',noteTag:'green'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥400万〜¥800万',avg:'¥600万',pct:54,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人採用はUSD建て契約の場合あり。',
    ops:{routes:'ハノイ・ホーチミンから国内全主要都市、日本（成田・大阪）、韓国、台湾に就航。',fleet:'Airbus A320/A321, Boeing 787-9。約30機。'},
    training:T_LCC,benefits:B_LCC,
    hiringStatus:'外国人パイロット採用実績あり。詳細は要確認。',hiringColor:'#f5c842',
    jobs:[{title:'パイロット採用',sub:'国内外線',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'型式',v:'A320またはB787'}],note:''}],
    recruitUrl:'https://bambooairways.com/vn-en/landing/careers/',
  },

  {
    file:'hong-kong-express.html',code:'UO',color:'#9333EA',
    nameEn:'HK Express',nameJa:'香港エクスプレス（HK Express）',
    subtitle:'香港のLCC · カタール航空グループ傘下',
    tags:[{cls:'tag-blue',label:'🇭🇰 香港'},{cls:'tag-orange',label:'LCC'},{cls:'tag-gold',label:'カタール航空グループ'}],
    stats:[{val:'¥1,500万〜2,200万',label:'機長年収（目安）'},{val:'¥700万〜1,300万',label:'FO年収（目安）'},{val:'约30機',label:'保有機材数'},{val:'30都市+',label:'就航都市'}],
    overview:'香港エクスプレス（HK Express）は香港を拠点とするLCC。カタール航空グループのQIA傘下で運営。A320ファミリー専業で東アジア・東南アジアに就航。日本（成田・関西・那覇等）路線も運航。香港を拠点とするため、中国との地政学的な位置に注意。',
    facts:[{k:'本社',v:'香港'},{k:'ハブ',v:'香港国際空港（HKG）'},{k:'オーナー',v:'カタール航空グループ（QIA）'},{k:'機材',v:'A320/A321neo'},{k:'就航開始',v:'2004年'},{k:'所得税',v:'あり（香港・低率）'}],
    salaryRows:[
      {pos:'機長（Captain）— A320/A321',sub:'東アジア・東南アジア路線',range:'¥1,500万〜¥2,200万',avg:'¥1,800万',pct:100,note:'HKD建て（低税率）',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国際線',range:'¥700万〜¥1,300万',avg:'¥1,000万',pct:55,note:'HKD/JPY≈19',noteTag:'gray'},
    ],
    salaryNote:'※ HKD/JPY≈19換算。香港の個人所得税は最高17%で低税率。生活費は高い点に注意。',
    ops:{routes:'香港から日本（成田・関西・那覇・福岡等）、韓国、台湾、タイ、フィリピン、ベトナム等に就航。',fleet:'Airbus A320/A321neo 約30機。'},
    training:T_LCC,benefits:[{icon:'🏙️',title:'香港拠点',body:'アジアの金融センター・香港を拠点とした生活。低税率（最高17%）。'},{icon:'✈️',title:'カタールグループ恩恵',body:'カタール航空グループのネットワーク・リソースへのアクセス可能性あり。'},...B_LCC.slice(1)],
    hiringStatus:'A320型式取得者の採用あり。詳細は公式サイトで確認。',hiringColor:'#f5c842',
    jobs:[{title:'機長・副操縦士 — A320/A321',sub:'東アジア路線',status:'要公式確認',stag:'blue',details:[{k:'資格',v:'ATPL（ICAO/CASL）'},{k:'型式',v:'A320型式優遇'}],note:''}],
    recruitUrl:'https://hkexpress.com/en-hk/about/careers/',
  },

  {
    file:'batik-air.html',code:'ID',color:'#5C256C',
    nameEn:'Batik Air',nameJa:'バティック・エア（Batik Air）',
    subtitle:'インドネシアのライオン・エアグループFSC',
    tags:[{cls:'tag-blue',label:'🇮🇩 インドネシア'},{cls:'tag-gold',label:'ライオングループ'},{cls:'tag-gray',label:'FSC寄り'}],
    stats:[{val:'¥900万〜1,600万',label:'機長年収（目安）'},{val:'¥400万〜800万',label:'FO年収（目安）'},{val:'約50機',label:'保有機材数'},{val:'40都市+',label:'就航都市'}],
    overview:'バティック・エア（Batik Air）はインドネシアのライオン・エアグループのFSC（フルサービスキャリア）ブランド。ジャカルタを拠点に国内線・短距離国際線を運営。Boeing 737とAirbus A320を保有。外国人パイロットの採用実績あり。',
    facts:[{k:'本社',v:'ジャカルタ（インドネシア）'},{k:'ハブ',v:'スカルノハッタ国際空港（CGK）'},{k:'グループ',v:'ライオン・エアグループ'},{k:'設立',v:'2013年'},{k:'機材',v:'B737/A320'},{k:'所得税',v:'あり（インドネシア）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'国内外線',range:'¥900万〜¥1,600万',avg:'¥1,200万',pct:100,note:'USD建て外国人契約あり',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'国内外線',range:'¥400万〜¥800万',avg:'¥600万',pct:50,note:'参考値',noteTag:'gray'},
    ],
    salaryNote:'※ USD/JPY=150換算。外国人パイロットはUSD建て契約の場合あり。',
    ops:{routes:'ジャカルタから国内全主要都市、シンガポール、マレーシア等に就航。',fleet:'Boeing 737-800, 737 MAX 8/9, Airbus A320/A321。'},
    training:T_ASIA,benefits:B_LCC,
    hiringStatus:'外国人パイロット採用実績あり（不定期）。',hiringColor:'#f5c842',
    jobs:[{title:'機長（Contract Captain）',sub:'国内外線',status:'要公式確認',stag:'gray',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'英語',v:'ICAO Level 4以上'}],note:''}],
    recruitUrl:'https://www.batikair.com/en/about-us/career',
  },

  {
    file:'royal-brunei.html',code:'BI',color:'#B8860B',
    nameEn:'Royal Brunei Airlines',nameJa:'ロイヤル・ブルネイ航空（Royal Brunei Airlines）',
    subtitle:'ブルネイのフラッグキャリア · 中長距離路線特化',
    tags:[{cls:'tag-gold',label:'🇧🇳 ブルネイ'},{cls:'tag-gray',label:'FSC'},{cls:'tag-green',label:'非課税'}],
    stats:[{val:'¥1,600万〜2,400万',label:'機長年収（目安・非課税）'},{val:'¥800万〜1,400万',label:'FO年収（目安・非課税）'},{val:'约12機',label:'保有機材数'},{val:'非課税',label:'ブルネイ所得税なし'}],
    overview:'ロイヤル・ブルネイ航空はブルネイ・ダルサラームのフラッグキャリア。小規模ながら長距離路線（英国・オーストラリア等）も保有する国際線中心の航空会社。ブルネイには個人所得税がなく、税引き後手取りが中東並みに高い。外国人機長・副操縦士の採用を継続的に実施。',
    facts:[{k:'本社',v:'バンダルスリブガワン（ブルネイ）'},{k:'ハブ',v:'ブルネイ国際空港（BWN）'},{k:'設立',v:'1974年'},{k:'オーナー',v:'ブルネイ政府'},{k:'機材',v:'B787-8, A320'},{k:'所得税',v:'なし（非課税）'}],
    salaryRows:[
      {pos:'機長（Captain）— B787',sub:'長距離国際線（非課税）',range:'¥1,600万〜¥2,400万',avg:'¥2,000万',pct:100,note:'USD建て（非課税）',noteTag:'gold'},
      {pos:'副操縦士（F/O）',sub:'国際線（非課税）',range:'¥800万〜¥1,400万',avg:'¥1,100万',pct:55,note:'非課税',noteTag:'green'},
    ],
    salaryNote:'※ USD/JPY=150換算。ブルネイには個人所得税なし。中東に近い税制優遇が特徴。生活費は安価。',
    ops:{routes:'バンダルスリブガワンからロンドン、メルボルン、東京（成田）、シンガポール、クアラルンプール、ドバイ等に就航。',fleet:'Boeing 787-8（長距離）, Airbus A320neo（短中距離）。小規模だが高品質。'},
    training:[...T_ASIA.slice(0,2),{title:'B787型式訓練',body:'Boeing認定センターでのB787型式訓練。長距離路線のための特別手順訓練を含む。'},{title:'定期審査',body:'ブルネイDCA基準によるOPC。年1〜2回。'}],
    benefits:[{icon:'💰',title:'非課税メリット',body:'ブルネイに個人所得税なし。手取り額が大幅に向上。'},{icon:'🏠',title:'住宅手当',body:'外国人パイロットへの住宅補助あり（要採用時確認）。'},{icon:'✈️',title:'スタッフ特典',body:'ロイヤル・ブルネイ便の割引搭乗。'},{icon:'🏙️',title:'穏やかな生活環境',body:'ブルネイは安全で物価が安く、穏やかな生活環境。'}],
    hiringStatus:'外国人パイロット採用を継続実施。B787機長・A320資格者に需要あり。',hiringColor:'#34d399',
    jobs:[
      {title:'機長（Captain）— B787-8',sub:'外国人直接採用（非課税）',status:'採用中（要確認）',stag:'green',details:[{k:'資格',v:'ATPL（ICAO）'},{k:'型式',v:'B787型式優遇'},{k:'最低時間',v:'機長3,000h以上'},{k:'契約',v:'USD建て（非課税）'}],note:''},
      {title:'副操縦士（F/O）— A320',sub:'中短距離路線',status:'採用中（要確認）',stag:'green',details:[{k:'資格',v:'CPL/ATPL（ICAO）'},{k:'英語',v:'ICAO Level 4以上'}],note:''},
    ],
    recruitUrl:'https://www.royalbrunei.com/about-us/careers/',
  },

];

airlines.forEach(a=>{
  writeFileSync(new URL(`./airlines/${a.file}`, import.meta.url),page(a));
  console.log(`Created: ${a.file}`);
});
console.log('Asia airlines done!');
