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

const T_EU=[
  {title:'型式訓練（EASA承認ATO）',body:'EASA認定のApproved Training Organisation（ATO）でのtype rating取得。地上学科→シミュレーター（MCC含む）→LIFUS。'},
  {title:'LIFUS（ライン訓練）',body:'型式取得後、教官機長同乗のもとでLine Flying Under Supervision。通常50〜80レグ程度（EASA FCL.060準拠）。'},
  {title:'定期審査（OPC/LPC）',body:'年1〜2回のProficiency Check（PC）。EASA FCL.625/735基準。各国CAA（CAA UK/DGAC/LBA等）が監督。'},
  {title:'機長昇格・追加資格',body:'SFO/Senior F/O期間を経て機長訓練。LVP（低視程手続き）・PBN・ETOPS・RVSM等の追加資格も取得。'},
];
const T_LCC=[
  {title:'型式訓練（EASA承認・費用負担注意）',body:'EASA認定ATO使用。LCCでは型式訓練費用を一部または全額自己負担とする契約形態もある。要確認。'},
  {title:'LIFUS',body:'型式取得後、教官機長同乗ライン訓練。短距離路線多数のLCCは比較的早くレグ数を稼げる。'},
  {title:'定期審査（OPC/LPC）',body:'EASA基準に基づく年1〜2回の審査。LCCも同等の安全基準。'},
  {title:'昇格',body:'副操縦士から機長昇格は最低4,000〜5,000h以上が目安。LCCは昇格機会が多いことも。'},
];
const B_EU_FSC=[
  {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの大幅割引または無料航空券。アライアンス提携会社でも利用可能。'},
  {icon:'🏥',title:'医療保険',body:'欧州の高水準な医療保険。ライセンス喪失保険も一般的。'},
  {icon:'💰',title:'ボーナス',body:'業績連動型ボーナス（年2〜4ヶ月分）。パフォーマンス評価と連動のケースも。'},
  {icon:'📅',title:'有給休暇',body:'年間25〜35日。欧州労働法（EU指令）による手厚い休暇制度。'},
  {icon:'🏦',title:'退職年金・企業年金',body:'確定給付型または確定拠出型の企業年金（DBP/DCP）。欧州は公的年金との二重構造。'},
  {icon:'🌐',title:'レイオーバー手当',body:'海外ステイ時の宿泊・日当支給。欧州主要都市は高コスト地域手当が高め。'},
];
const B_LCC=[
  {icon:'✈️',title:'スタッフ割引',body:'自社便の割引または無料搭乗特典。グループ・提携会社対象のことが多い。'},
  {icon:'🏥',title:'医療保険',body:'基本的な医療保険（欧州ではEHIC/公的医療制度との組み合わせ）。'},
  {icon:'📈',title:'生産性ボーナス',body:'Duty Payまたはプロダクティビティボーナス。フライト時間・レグ数連動が多い。'},
  {icon:'📅',title:'有給休暇',body:'EU指令に基づく最低20日以上。各国法に準拠。'},
  {icon:'🏠',title:'ベースシティ手当',body:'選択ベース都市（ロンドン・マドリッド等）での勤務手当。'},
];

const airlines=[

// ── Europe FSC ───────────────────────────────────────────────────────────────
{
  file:'air-france.html',code:'AF',color:'#002395',
  nameEn:'Air France',nameJa:'エール フランス（Air France）',
  subtitle:'フランス国際フラッグキャリア · スカイチーム創設メンバー',
  tags:[{cls:'tag-blue',label:'🇫🇷 フランス'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'4スター'}],
  stats:[{val:'¥1,956万〜3,260万',label:'機長年収（税引前）',color:'#002395'},{val:'¥978万〜1,630万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約220機',label:'保有機材数'},{val:'170都市+',label:'就航都市数'}],
  overview:'エール フランスは1933年設立のフランス国際フラッグキャリア。パリ・シャルル・ド・ゴール空港をハブに世界170都市以上に就航。スカイチーム創設メンバー。KLMとのAir France-KLMグループを形成し、Transavia（LCC子会社）も運営。フランスは所得税が高い（最高45%）がEuroパイロットの待遇は総じて安定。A380・B777・A350を主力とするワイドボディ重視のフリート。',
  facts:[{k:'本社',v:'パリ（フランス）'},{k:'ハブ',v:'CDG空港（CDG）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1933年'},{k:'保有機材',v:'約220機'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Commandant de Bord）',sub:'国際線ワイドボディ（A380/B777/A350）',range:'¥1,956万〜¥3,260万',avg:'¥2,600万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Copilote）',sub:'国際線',range:'¥978万〜¥1,630万',avg:'¥1,300万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。フランス所得税は最高45%（累進課税）。€120,000〜€200,000（機長）の業界水準を参考にした参考値。搭乗日当・レイオーバー手当は別途。',
  ops:{routes:'パリ・シャルル・ド・ゴールハブから北米（ニューヨーク・ロサンゼルス・モントリオール等）、アジア（東京・上海・バンコク等）、アフリカ（50都市以上）、中南米、中東に就航。',fleet:'Airbus A380-800, A350-900, A330-200/300, Boeing 777-200ER/300ER, A220-300, A320/A321。約220機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'EASA ATPL保有者の外国人採用は限定的。フランス語能力が有利。',
  hiringColor:'#6b7d93',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。パリCDGベース。',status:'要公式確認',stag:'gray',
      details:[{k:'必要資格',v:'EASA ATPL（またはFCL認定同等）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上（目安）'},{k:'フランス語',v:'日常会話レベル推奨'}],
      note:'※ 外国人採用はKLMと共同採用キャンペーン等で行われることがある。'},
  ],
  recruitUrl:'https://careers.airfranceklm.com',
},

{
  file:'klm.html',code:'KL',color:'#00A1DE',
  nameEn:'KLM Royal Dutch Airlines',nameJa:'KLMオランダ航空',
  subtitle:'世界最古の航空会社名を継承 · スカイチーム加盟',
  tags:[{cls:'tag-blue',label:'🇳🇱 オランダ'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'世界最古のブランド'}],
  stats:[{val:'¥2,445万〜3,912万',label:'機長年収（税引前）',color:'#00A1DE'},{val:'¥1,141万〜2,119万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約170機',label:'保有機材数'},{val:'160都市+',label:'就航都市数'}],
  overview:'KLMオランダ航空は1919年設立。「世界で最も古い名前を使い続ける航空会社」として知られ、アムステルダム・スキポールをハブに世界160都市以上に就航。Air France-KLMグループの一員。スカイチーム加盟。欧州主要FSCの中でも比較的良好な労使関係と安定した待遇で知られる。B777・B787・A330が主力。',
  facts:[{k:'本社',v:'アムステルダム（オランダ）'},{k:'ハブ',v:'スキポール空港（AMS）'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1919年'},{k:'保有機材',v:'約170機'},{k:'所得税',v:'あり（最高49.5%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ（B777/B787）',range:'¥2,445万〜¥3,912万',avg:'¥3,100万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥1,141万〜¥2,119万',avg:'¥1,600万',pct:52,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。オランダ所得税は最高49.5%（累進課税）。€150,000〜€240,000（機長）の業界水準参考値。30%ルーリング（外国人優遇税制）が適用される場合あり。',
  ops:{routes:'アムステルダム・スキポールハブから北米（ニューヨーク・ロサンゼルス等）、アジア（東京・北京・バンコク等）、アフリカ（ナイロビ・ヨハネスブルグ等）、南米に就航。',fleet:'Boeing 777-200ER/300ER, B787-9/10, B737-800/MAX, Airbus A330-300, Embraer E2。約170機。'},
  training:T_EU,
  benefits:[...B_EU_FSC,{icon:'🇳🇱',title:'30%ルーリング',body:'外国人採用の場合、オランダ政府の30%ルーリング（給与の30%を免税）が適用される可能性あり。'}],
  hiringStatus:'定期採用中。EASA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。アムステルダムベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'B777/B787/A330優遇'}],
      note:'※ 外国人採用あり。30%ルーリング適用で手取りが改善する可能性。'},
  ],
  recruitUrl:'https://careers.klm.com',
},

{
  file:'british-airways.html',code:'BA',color:'#2B3E82',
  nameEn:'British Airways',nameJa:'ブリティッシュ エアウェイズ（British Airways）',
  subtitle:'英国フラッグキャリア · ワンワールド創設メンバー',
  tags:[{cls:'tag-blue',label:'🇬🇧 英国'},{cls:'tag-blue',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'5スター'}],
  stats:[{val:'¥1,900万〜3,173万',label:'機長年収（税引前）',color:'#2B3E82'},{val:'¥1,045万〜1,710万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約280機',label:'保有機材数'},{val:'210都市+',label:'就航都市数'}],
  overview:'ブリティッシュ エアウェイズは英国最大のフラッグキャリア。ロンドン・ヒースロー（LHR）をハブに世界210都市以上に就航。ワンワールド創設メンバーとしてIberia・アメリカン航空等と緊密な提携関係を持つ。IAG（International Airlines Group）傘下。英国は所得税あり（最高45%）。B777・A380・B787が主力ワイドボディ。',
  facts:[{k:'本社',v:'ロンドン（英国）'},{k:'ハブ',v:'ヒースロー空港（LHR）'},{k:'アライアンス',v:'ワンワールド（IAG）'},{k:'設立',v:'1974年（BOAC合併）'},{k:'保有機材',v:'約280機'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線ワイドボディ（B777/A380/B787）',range:'¥1,900万〜¥3,173万',avg:'¥2,500万',pct:100,note:'GBP建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥1,045万〜¥1,710万',avg:'¥1,400万',pct:56,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ GBP/JPY=190換算。英国所得税は最高45%（累進課税）。£100,000〜£167,000（機長）の業界水準を参考にした参考値。搭乗日当・帰国手当等は別途。',
  ops:{routes:'ヒースローハブから北米（ニューヨーク・ロサンゼルス・シカゴ等・15都市以上）、アジア（東京・北京・シンガポール等）、中東・アフリカ・南米・オーストラリア等に就航。',fleet:'Boeing 777-200/300ER, B787-8/9/10, Airbus A380-800, A350-1000, A320/A321neo。約280機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'定期採用中。EASA/UK CAA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ヒースローベース主体。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'UK CAA/EASA ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'B777/A380/B787優遇'}],
      note:'※ Brexit後はUK CAA ATPL（またはEASAからの変換）が必要。EU市民・英国在住外国人でも申請可能。'},
  ],
  recruitUrl:'https://www.britishairways.com/careers',
},

{
  file:'virgin-atlantic.html',code:'VS',color:'#E2001A',
  nameEn:'Virgin Atlantic',nameJa:'ヴァージン アトランティック（Virgin Atlantic）',
  subtitle:'ヴァージングループ航空部門 · スカイチーム加盟',
  tags:[{cls:'tag-red',label:'🇬🇧 英国'},{cls:'tag-blue',label:'スカイチーム'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'チャレンジャー'}],
  stats:[{val:'¥1,710万〜2,850万',label:'機長年収（税引前）',color:'#E2001A'},{val:'¥950万〜1,520万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約37機',label:'保有機材数'},{val:'30都市+',label:'就航都市数'}],
  overview:'ヴァージン アトランティックは1984年にリチャード・ブランソンが設立したプレミアム航空会社。ロンドン・ヒースロー/ガトウィックをハブに北米・カリブ海・アジア・アフリカに就航。スカイチーム加盟（2023年）。"飛ぶことを愛する人のための航空会社"を標榜し、機内体験・クルーの多様性に注力。A350とB787による効率的なフリート。',
  facts:[{k:'本社',v:'クローリー（英国）'},{k:'ハブ',v:'ヒースロー/ガトウィック'},{k:'アライアンス',v:'スカイチーム'},{k:'設立',v:'1984年'},{k:'保有機材',v:'約37機'},{k:'所得税',v:'あり（最高45%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A350/B787）',range:'¥1,710万〜¥2,850万',avg:'¥2,200万',pct:100,note:'GBP建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥950万〜¥1,520万',avg:'¥1,200万',pct:55,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ GBP/JPY=190換算。英国所得税最高45%適用。£90,000〜£150,000（機長）の業界水準参考値。パイロット不足を背景に採用を積極化。',
  ops:{routes:'ロンドン発で北米（ニューヨーク・ロサンゼルス・マイアミ等）、カリブ海、アフリカ（ラゴス・ナイロビ等）、インドに就航。路線数はBAに比べ厳選。',fleet:'Airbus A350-1000, Boeing 787-9。約37機（高効率ツーエンジン機に特化）。'},
  training:T_EU,
  benefits:[...B_EU_FSC,{icon:'🎭',title:'多様性・インクルージョン',body:'ヴァージングループの文化として多様な採用を重視。LGBTQフレンドリーな職場環境。'}],
  hiringStatus:'定期採用中。UK CAA ATPL保有者対象。A350またはB787型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ロンドンベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'UK CAA ATPL（またはEASAから変換）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'A350/B787優遇'}],
      note:'※ ヴァージンは非伝統的な採用プロセスで知られ、個性とサービス精神を重視。'},
  ],
  recruitUrl:'https://careers.virgin-atlantic.com',
},

{
  file:'swiss.html',code:'LX',color:'#E8122D',
  nameEn:'Swiss International Air Lines',nameJa:'スイス インターナショナル エアラインズ（SWISS）',
  subtitle:'スイスの国際航空会社 · ルフトハンザグループ',
  tags:[{cls:'tag-red',label:'🇨🇭 スイス'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'ルフトハンザグループ'}],
  stats:[{val:'¥2,934万〜5,880万',label:'機長年収（税引前）',color:'#E8122D'},{val:'¥1,304万〜2,608万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約90機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'スイス インターナショナル エアラインズ（SWISS）はスイスのフラッグキャリアでルフトハンザグループの一員。チューリッヒ・ジュネーブをハブに世界100都市以上に就航。スターアライアンス加盟。スイスは物価が非常に高い反面、パイロット給与も欧州最高水準。CHF（スイスフラン）建て給与はJPY換算で非常に高額。ルフトハンザと同様の高品質訓練体制。',
  facts:[{k:'本社',v:'チューリッヒ（スイス）'},{k:'ハブ',v:'チューリッヒ空港（ZRH）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'2002年（旧Swissair後継）'},{k:'保有機材',v:'約90機'},{k:'所得税',v:'あり（州により異なる）'}],
  salaryRows:[
    {pos:'機長（Kommandant）',sub:'国際線ワイドボディ（A340/B777/B787）',range:'¥2,934万〜¥5,880万',avg:'¥4,200万',pct:100,note:'CHF建て・税引前',noteTag:'gold'},
    {pos:'副操縦士（Copilot）',sub:'国際線',range:'¥1,304万〜¥2,608万',avg:'¥1,900万',pct:45,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ CHF/JPY≈168換算（変動あり）。スイスの所得税は州により異なり（約20〜35%）。CHF 175,000〜350,000（機長）の業界水準参考値。スイスの生活費は高いが給与も欧州最高水準。',
  ops:{routes:'チューリッヒ/ジュネーブハブから欧州全土、北米（ニューヨーク・シカゴ・ボストン等）、アジア（東京・香港・シンガポール等）、アフリカ・中東に就航。',fleet:'Boeing 777-300ER, B787-9/10, Airbus A340-300（退役計画中）, A321, A220-100/300。約90機。'},
  training:T_EU,
  benefits:[...B_EU_FSC,{icon:'🏔️',title:'スイスの生活環境',body:'欧州随一の安全・清潔な生活環境。家族帯同に適した教育環境（英語学校多数）。'}],
  hiringStatus:'ルフトハンザグループ経由の採用あり。EASA ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。チューリッヒベース。',status:'要公式確認',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（BAZL認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'ドイツ語',v:'日常会話レベル推奨'}],
      note:'※ ルフトハンザグループの統合採用プロセス経由のケースも多い。'},
  ],
  recruitUrl:'https://www.swiss.com/global/en/company/careers.html',
},

{
  file:'austrian.html',code:'OS',color:'#CC0000',
  nameEn:'Austrian Airlines',nameJa:'オーストリア航空（Austrian Airlines）',
  subtitle:'オーストリアフラッグキャリア · ルフトハンザグループ',
  tags:[{cls:'tag-red',label:'🇦🇹 オーストリア'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'ルフトハンザグループ'}],
  stats:[{val:'¥1,956万〜2,934万',label:'機長年収（税引前）',color:'#CC0000'},{val:'¥978万〜1,467万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約75機',label:'保有機材数'},{val:'130都市+',label:'就航都市数'}],
  overview:'オーストリア航空はウィーンをハブとするオーストリアのフラッグキャリア。ルフトハンザグループの一員でスターアライアンス加盟。中欧・東欧へのアクセスが特に充実し、ウィーンは欧州と旧東側諸国を結ぶ重要ハブ。B777とB787によるロング路線から、A320/A321による欧州域内路線まで多彩な運航。',
  facts:[{k:'本社',v:'ウィーン（オーストリア）'},{k:'ハブ',v:'ウィーン空港（VIE）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1957年'},{k:'保有機材',v:'約75機'},{k:'所得税',v:'あり（最高55%）'}],
  salaryRows:[
    {pos:'機長（Kommandant）',sub:'国際線（B777/B787/A321）',range:'¥1,956万〜¥2,934万',avg:'¥2,400万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Copilot）',sub:'国内外線',range:'¥978万〜¥1,467万',avg:'¥1,200万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。オーストリアの所得税は最高55%（欧州でも高水準）。€120,000〜€180,000（機長）の業界水準参考値。',
  ops:{routes:'ウィーンハブから中東欧（プラハ・ワルシャワ・ブダペスト等）、北米（ニューヨーク・ワシントン・ロサンゼルス等）、アジア、アフリカ、中東に就航。',fleet:'Boeing 777-200ER, B787-9, Airbus A321neo, A321ceo, A320neo。約75機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'ルフトハンザグループ経由採用あり。EASA ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ウィーンベース。',status:'要公式確認',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（Austro Control認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'ドイツ語',v:'日常会話レベル推奨'}],
      note:'※ オーストリアはEU内での勤務・生活を検討する日本人パイロットにとって文化的に馴染みやすい環境。'},
  ],
  recruitUrl:'https://karriere.austrian.com',
},

{
  file:'finnair.html',code:'AY',color:'#003580',
  nameEn:'Finnair',nameJa:'フィンエアー（Finnair）',
  subtitle:'フィンランド国営フラッグキャリア · アジア・欧州の架け橋',
  tags:[{cls:'tag-blue',label:'🇫🇮 フィンランド'},{cls:'tag-blue',label:'ワンワールド'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'最北ルート'}],
  stats:[{val:'¥2,119万〜3,260万',label:'機長年収（税引前）',color:'#003580'},{val:'¥1,060万〜1,630万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約80機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'フィンエアーは1923年設立のフィンランド国営フラッグキャリア。ヘルシンキをハブに、北極圏経由の最短ルートでヨーロッパとアジアを結ぶ路線で知られる。ワンワールド加盟。アジア路線（東京・大阪・北京・ソウル等）では北極経由で飛行時間を大幅短縮。A350が長距離主力。ロシア上空飛行禁止（2022年〜）により路線を再編中。',
  facts:[{k:'本社',v:'ヘルシンキ（フィンランド）'},{k:'ハブ',v:'ヘルシンキ・ヴァンター空港（HEL）'},{k:'アライアンス',v:'ワンワールド'},{k:'設立',v:'1923年'},{k:'保有機材',v:'約80機'},{k:'所得税',v:'あり（最高51.5%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A350/A330）',range:'¥2,119万〜¥3,260万',avg:'¥2,700万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥1,060万〜¥1,630万',avg:'¥1,300万',pct:48,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。フィンランドの所得税は最高51.5%（北欧型高福祉）。€130,000〜€200,000（機長）の業界水準参考値。無償教育・医療等の社会保障が充実。',
  ops:{routes:'ヘルシンキハブから日本（東京・大阪・名古屋）、アジア（北京・ソウル・バンコク・上海等）、北米（ニューヨーク・ロサンゼルス等）、欧州全域に就航。北極圏経由ルートで最短移動時間。',fleet:'Airbus A350-900, A330-300, A321LR, A320/A321neo。約80機。'},
  training:T_EU,
  benefits:[...B_EU_FSC,{icon:'🌿',title:'北欧型福祉制度',body:'フィンランドの充実した公的医療・教育・社会保障制度。子育て環境として欧州有数。'}],
  hiringStatus:'定期採用中。EASA ATPL保有者対象。A350型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ヘルシンキベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（Traficom認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'フィンランド語',v:'不要（英語職場）'}],
      note:'※ フィンエアーは日本との往来が多く、日本語話者パイロットに親和性が高い職場環境。'},
  ],
  recruitUrl:'https://careers.finnair.com',
},

{
  file:'sas.html',code:'SK',color:'#00445B',
  nameEn:'SAS Scandinavian Airlines',nameJa:'SAS スカンジナビア航空',
  subtitle:'スカンジナビア3カ国の共同航空会社',
  tags:[{cls:'tag-blue',label:'🇸🇪🇩🇰🇳🇴 北欧3国'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'再建中'}],
  stats:[{val:'¥2,119万〜3,586万',label:'機長年収（税引前）',color:'#00445B'},{val:'¥1,060万〜1,793万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約130機',label:'保有機材数'},{val:'130都市+',label:'就航都市数'}],
  overview:'SASスカンジナビア航空はスウェーデン・デンマーク・ノルウェー3カ国が共同出資するフラッグキャリア。コペンハーゲン・ストックホルム・オスロをハブに欧州全域・北米・アジアに就航。スターアライアンス加盟。2022年に米国連邦破産法適用を申請し再建手続きを経て2024年に再出発。アクア・パートナーズ（カスタードおよびアポロ）傘下で再建中。',
  facts:[{k:'本社',v:'コペンハーゲン（デンマーク）'},{k:'ハブ',v:'CPH/ARN/OSL'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1946年'},{k:'保有機材',v:'約130機'},{k:'所得税',v:'あり（最高55〜56%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A330/A350）',range:'¥2,119万〜¥3,586万',avg:'¥2,800万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥1,060万〜¥1,793万',avg:'¥1,400万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算（SEK/DKK/NOKの一部EUR建て換算含む）。北欧の所得税は最高55〜56%（高福祉）。€130,000〜€220,000（機長）の業界水準参考値。2024年再建後の状況は要確認。',
  ops:{routes:'コペンハーゲン・ストックホルム・オスロハブから北米（ニューヨーク・シカゴ等）、アジア（東京・上海・バンコク等）、欧州全域に就航。',fleet:'Airbus A350-900, A330-300, A321LR/neo, A320neo。約130機（再建中）。'},
  training:T_EU,
  benefits:[...B_EU_FSC,{icon:'🌿',title:'北欧福祉モデル',body:'北欧3カ国の充実した公的医療・育児休暇・年金制度の恩恵。所得税は高いが社会保障が手厚い。'}],
  hiringStatus:'2024年再建後、採用再開中。最新状況は公式サイトで確認を。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。コペンハーゲン/ストックホルムベース。',status:'採用中（再建後）',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（各国CAA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'A350/A330/A321優遇'}],
      note:'※ 2022〜2024年再建プロセスを経て採用再開。組合交渉により条件が変動している可能性がある。'},
  ],
  recruitUrl:'https://www.flysas.com/en/careers/',
},

{
  file:'iberia.html',code:'IB',color:'#CC0000',
  nameEn:'Iberia',nameJa:'イベリア航空（Iberia）',
  subtitle:'スペインフラッグキャリア · ワンワールド加盟（IAG）',
  tags:[{cls:'tag-red',label:'🇪🇸 スペイン'},{cls:'tag-blue',label:'ワンワールド（IAG）'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'ラテンアメリカNo.1ルート'}],
  stats:[{val:'¥1,467万〜2,608万',label:'機長年収（税引前）',color:'#CC0000'},{val:'¥815万〜1,304万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約125機',label:'保有機材数'},{val:'150都市+',label:'就航都市数'}],
  overview:'イベリア航空は1927年設立のスペインフラッグキャリア。マドリッド・バラハスをハブに欧州・北中南米（20都市以上）・北アフリカ・中東に就航。ワンワールド・IAG（International Airlines Group）傘下。特にラテンアメリカ路線は世界最大規模の一角を占める。スペインの所得税は最高47%。A320族とA350が主力。',
  facts:[{k:'本社',v:'マドリッド（スペイン）'},{k:'ハブ',v:'マドリッド・バラハス空港（MAD）'},{k:'アライアンス',v:'ワンワールド（IAG）'},{k:'設立',v:'1927年'},{k:'保有機材',v:'約125機'},{k:'所得税',v:'あり（最高47%）'}],
  salaryRows:[
    {pos:'機長（Comandante）',sub:'国際線（A350/A330）',range:'¥1,467万〜¥2,608万',avg:'¥2,000万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Copiloto）',sub:'国際線',range:'¥815万〜¥1,304万',avg:'¥1,050万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。スペインの所得税は最高47%（累進課税）。€90,000〜€160,000（機長）の業界水準参考値。マドリッドは欧州の中で生活費が比較的抑えられる。',
  ops:{routes:'マドリッドハブからラテンアメリカ（ブエノスアイレス・ボゴタ・リマ・サンパウロ等20都市以上）、北米、欧州全域、北アフリカ・中東に就航。',fleet:'Airbus A350-900, A330-200/300, A321neo, A320neo, A319。約125機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'定期採用中。EASA ATPL保有者対象。スペイン語能力が有利。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。マドリッドベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（AESA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'スペイン語',v:'日常会話〜ビジネスレベル推奨'}],
      note:'※ IAGグループ内（BA・Vueling等）での異動・採用機会もある。'},
  ],
  recruitUrl:'https://www.iberia.com/careers',
},

{
  file:'tap.html',code:'TP',color:'#C0272D',
  nameEn:'TAP Air Portugal',nameJa:'TAPエア ポルトガル（TAP Air Portugal）',
  subtitle:'ポルトガルフラッグキャリア · 大西洋路線に強い',
  tags:[{cls:'tag-red',label:'🇵🇹 ポルトガル'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'大西洋路線'}],
  stats:[{val:'¥1,304万〜2,282万',label:'機長年収（税引前）',color:'#C0272D'},{val:'¥734万〜1,141万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約110機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'TAPエア ポルトガルは1945年設立のポルトガルフラッグキャリア。リスボン・ポルトをハブにブラジル（リオ・サンパウロ・フォルタレーザ等）・北米・アフリカ・欧州全域に就航。スターアライアンス加盟。2021〜2024年に国有化・民営化プロセスを経て再建中。A320族とA330が主力。ポルトガル語圏ネットワーク（ブラジル・アフリカ）に強い。',
  facts:[{k:'本社',v:'リスボン（ポルトガル）'},{k:'ハブ',v:'リスボン空港（LIS）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1945年'},{k:'保有機材',v:'約110機'},{k:'所得税',v:'あり（最高48%）'}],
  salaryRows:[
    {pos:'機長（Comandante）',sub:'国際線（A330/A321LR）',range:'¥1,304万〜¥2,282万',avg:'¥1,800万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Co-Piloto）',sub:'国際線',range:'¥734万〜¥1,141万',avg:'¥900万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。ポルトガルの所得税は最高48%。€80,000〜€140,000（機長）の業界水準参考値。リスボンは欧州の中で生活費が低めで人気の居住地。',
  ops:{routes:'リスボンハブからブラジル（サンパウロ・リオ・フォルタレーザ等10都市以上）、北米（ニューヨーク・ボストン等）、アフリカ（ルアンダ・マプト等）、欧州全域に就航。',fleet:'Airbus A330-200/300/900neo, A321LR/XLR, A320neo, A319。約110機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'採用中（再建プロセス経過後）。EASA ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。リスボンベース。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（ANAC認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'ポルトガル語',v:'不要（英語職場）'}],
      note:'※ NHRビザ制度によりポルトガルは外国人に有利な税制（要確認）。'},
  ],
  recruitUrl:'https://www.tapportugal.com/en/open-positions',
},

{
  file:'ita-airways.html',code:'AZ',color:'#008751',
  nameEn:'ITA Airways',nameJa:'ITAエアウェイズ（ITA Airways）',
  subtitle:'イタリア国営フラッグキャリア · 旧アリタリア後継',
  tags:[{cls:'tag-green',label:'🇮🇹 イタリア'},{cls:'tag-blue',label:'スカイチーム（準加盟）'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'再建中'}],
  stats:[{val:'¥1,304万〜2,119万',label:'機長年収（税引前）',color:'#008751'},{val:'¥652万〜1,060万',label:'FO年収（税引前）',color:'#34d399'},{val:'約80機',label:'保有機材数'},{val:'75都市+',label:'就航都市数'}],
  overview:'ITA Airwaysは2021年に経営破綻したアリタリア航空の後継として設立されたイタリア国営フラッグキャリア。ローマ・フィウミチーノをハブに欧州・北米・アジア・アフリカに就航。ルフトハンザグループへの売却交渉が2024年に妥結（完全子会社化予定）。スカイチーム準加盟。A320族・A330・A350が主力。',
  facts:[{k:'本社',v:'ローマ（イタリア）'},{k:'ハブ',v:'フィウミチーノ空港（FCO）'},{k:'アライアンス',v:'スカイチーム（準加盟）'},{k:'設立',v:'2021年（ITA Airways）'},{k:'保有機材',v:'約80機'},{k:'所得税',v:'あり（最高43%）'}],
  salaryRows:[
    {pos:'機長（Comandante）',sub:'国際線（A330/A350/A320）',range:'¥1,304万〜¥2,119万',avg:'¥1,700万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Co-Pilota）',sub:'国内外線',range:'¥652万〜¥1,060万',avg:'¥850万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。イタリアの所得税は最高43%。€80,000〜€130,000（機長）の業界水準参考値。ルフトハンザグループ入り後の条件変更の可能性あり。',
  ops:{routes:'ローマハブから北米（ニューヨーク・マイアミ等）、アジア（東京・上海・バンコク等）、アフリカ、欧州全域・国内線に就航。',fleet:'Airbus A350-900, A330-200/900neo, A321neo, A320neo, A319。約80機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'採用中。ルフトハンザグループ統合後の条件変更に注意。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ローマFCOベース。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（ENAC認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'イタリア語',v:'日常会話レベル推奨'}],
      note:'※ 2024〜2025年にかけてルフトハンザグループへの統合が進行中。条件は変動の可能性。'},
  ],
  recruitUrl:'https://www.ita-airways.com/en_en/ita-airways-careers.html',
},

{
  file:'aer-lingus.html',code:'EI',color:'#00A84F',
  nameEn:'Aer Lingus',nameJa:'エア リンガス（Aer Lingus）',
  subtitle:'アイルランドフラッグキャリア · IAGグループ',
  tags:[{cls:'tag-green',label:'🇮🇪 アイルランド'},{cls:'tag-blue',label:'ワンワールド（IAG）'},{cls:'tag-gray',label:'FSC'},{cls:'tag-gold',label:'北大西洋ルート'}],
  stats:[{val:'¥1,304万〜2,119万',label:'機長年収（税引前）',color:'#00A84F'},{val:'¥815万〜1,141万',label:'FO年収（税引前）',color:'#34d399'},{val:'約70機',label:'保有機材数'},{val:'100都市+',label:'就航都市数'}],
  overview:'エア リンガスは1936年設立のアイルランドフラッグキャリア。ダブリンをハブに北米（大西洋路線）・欧州全域に就航。IAGグループの一員でワンワールド加盟。アイルランドはプリクリアランス（US Customs &amp; Border Protection事前審査）をダブリンで実施でき、北米路線に特化したビジネスモデル。A320族とA330が主力。法人税が低いアイルランドの税制環境も特徴。',
  facts:[{k:'本社',v:'ダブリン（アイルランド）'},{k:'ハブ',v:'ダブリン空港（DUB）'},{k:'アライアンス',v:'ワンワールド（IAG）'},{k:'設立',v:'1936年'},{k:'保有機材',v:'約70機'},{k:'所得税',v:'あり（最高40%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'国際線（A330/A321）',range:'¥1,304万〜¥2,119万',avg:'¥1,700万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'国際線',range:'¥815万〜¥1,141万',avg:'¥950万',pct:56,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。アイルランドの所得税は最高40%。€80,000〜€130,000（機長）の業界水準参考値。ダブリンは英語環境で日本人も生活しやすい都市。',
  ops:{routes:'ダブリンハブから北米（ニューヨーク・ボストン・シカゴ・ロサンゼルス等）、欧州全域（ロンドン・アムステルダム・パリ等）に就航。',fleet:'Airbus A330-200/300, A321neo/LR, A320neo, A319。約70機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'定期採用中。EASA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ダブリンベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（IAA認定）'},{k:'英語',v:'ICAO Level 4以上（英語母語環境）'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'A330/A321優遇'}],
      note:'※ IAGグループ内（BA・Iberia等）での異動機会あり。ダブリンの英語環境は日本人パイロットにも馴染みやすい。'},
  ],
  recruitUrl:'https://www.aerlingus.com/information/careers/',
},

{
  file:'lot.html',code:'LO',color:'#003399',
  nameEn:'LOT Polish Airlines',nameJa:'LOTポーランド航空',
  subtitle:'ポーランド国営フラッグキャリア · スターアライアンス加盟',
  tags:[{cls:'tag-blue',label:'🇵🇱 ポーランド'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC'},{cls:'tag-orange',label:'中欧ハブ'}],
  stats:[{val:'¥1,304万〜2,282万',label:'機長年収（税引前）',color:'#003399'},{val:'¥652万〜1,141万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約80機',label:'保有機材数'},{val:'130都市+',label:'就航都市数'}],
  overview:'LOTポーランド航空は1929年設立のポーランド国営フラッグキャリア。ワルシャワをハブに欧州・北米・アジア・中東に就航。スターアライアンス加盟。ポーランドはEU域内で生活費が低めで、パイロット待遇もEUR建て契約が一般的。B787を主力長距離機として展開し、B737とDash 8で欧州域内・国内線を網羅。',
  facts:[{k:'本社',v:'ワルシャワ（ポーランド）'},{k:'ハブ',v:'ワルシャワ・ショパン空港（WAW）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1929年'},{k:'保有機材',v:'約80機'},{k:'所得税',v:'あり（最高32%）'}],
  salaryRows:[
    {pos:'機長（Kapitan）',sub:'国際線（B787/B737）',range:'¥1,304万〜¥2,282万',avg:'¥1,800万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（Pilot）',sub:'国内外線',range:'¥652万〜¥1,141万',avg:'¥900万',pct:50,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。ポーランドの所得税は最高32%（欧州では低め）。€80,000〜€140,000（機長）の業界水準参考値。ワルシャワの生活費はEU主要都市に比べ低く実質購買力が高い。',
  ops:{routes:'ワルシャワハブから北米（ニューヨーク・シカゴ・ロサンゼルス等）、アジア（東京・ソウル・北京等）、欧州全域・中東・国内線に就航。',fleet:'Boeing 787-8/9, B737 MAX 8, B737-800, Embraer E170/175/195。約80機。'},
  training:T_EU,
  benefits:B_EU_FSC,
  hiringStatus:'定期採用中。EASA ATPL保有者対象。B787型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'国際線乗務。ワルシャワベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（ULC認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長5,000h以上'},{k:'型式',v:'B787/B737優遇'}],
      note:'※ ワルシャワは欧州の中で生活費が低く、EUR建て収入の実質購買力が高い。'},
  ],
  recruitUrl:'https://careers.lot.com',
},

// ── Europe LCC ───────────────────────────────────────────────────────────────
{
  file:'aegean.html',code:'A3',color:'#00539C',
  nameEn:'Aegean Airlines',nameJa:'エーゲ航空（Aegean Airlines）',
  subtitle:'ギリシャ最大の航空会社 · スターアライアンス加盟',
  tags:[{cls:'tag-blue',label:'🇬🇷 ギリシャ'},{cls:'tag-blue',label:'スターアライアンス'},{cls:'tag-gray',label:'FSC/LCC混合'},{cls:'tag-orange',label:'欧州'}],
  stats:[{val:'¥978万〜1,630万',label:'機長年収（税引前）',color:'#00539C'},{val:'¥571万〜978万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約70機',label:'保有機材数'},{val:'150都市+',label:'就航都市数'}],
  overview:'エーゲ航空はギリシャ最大の航空会社でアテネをハブに地中海・欧州全域・中東・北アフリカに就航。スターアライアンス加盟。ギリシャの経済規模に比べ充実したネットワークを持ち、夏季の観光需要でピーク需要が大きい。A320族が主力でEASA基準の運営。所得税はギリシャ（最高44%）。',
  facts:[{k:'本社',v:'アテネ（ギリシャ）'},{k:'ハブ',v:'アテネ・エレフテリオス空港（ATH）'},{k:'アライアンス',v:'スターアライアンス'},{k:'設立',v:'1987年'},{k:'保有機材',v:'約70機'},{k:'所得税',v:'あり（最高44%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'欧州線（A320族）',range:'¥978万〜¥1,630万',avg:'¥1,300万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'欧州線',range:'¥571万〜¥978万',avg:'¥750万',pct:58,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。ギリシャ所得税最高44%。€60,000〜€100,000（機長）の業界水準参考値。アテネの生活費は欧州西側に比べ低め。',
  ops:{routes:'アテネハブから欧州全域（ロンドン・パリ・フランクフルト等）、地中海・北アフリカ・中東に就航。国内線（ギリシャ離島）も多数。',fleet:'Airbus A321neo, A320neo, A320ceo, A319。約70機。'},
  training:T_LCC,
  benefits:B_LCC,
  hiringStatus:'定期採用中。EASA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'欧州線乗務。アテネベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（HCAA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,000h以上（目安）'},{k:'型式',v:'A320族優遇'}],
      note:'※ ギリシャの夏季ピーク（4〜10月）に採用活動が活発化する傾向。'},
  ],
  recruitUrl:'https://www.aegeanair.com/en/aegean-group/careers/',
},

{
  file:'icelandair.html',code:'FI',color:'#003087',
  nameEn:'Icelandair',nameJa:'アイスランド航空（Icelandair）',
  subtitle:'レイキャビクをハブに大西洋を結ぶ · 乗り継ぎ特化',
  tags:[{cls:'tag-blue',label:'🇮🇸 アイスランド'},{cls:'tag-gray',label:'独立系'},{cls:'tag-gray',label:'FSC/LCC混合'},{cls:'tag-gold',label:'北大西洋ハブ'}],
  stats:[{val:'¥1,304万〜2,119万',label:'機長年収（税引前）',color:'#003087'},{val:'¥734万〜1,141万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約50機',label:'保有機材数'},{val:'50都市+',label:'就航都市数'}],
  overview:'アイスランド航空はレイキャビク・ケフラビークをハブに北米〜欧州の大西洋横断路線で独特のポジションを築く航空会社。アイスランドを乗り継ぎ点として無料ストップオーバーを提供するユニークな商品設計。B737 MAX中心のフリート。独立系（アライアンス非加盟）。アイスランドは物価が高く所得税も高いが、自然環境の豊かさで人気の居住地。',
  facts:[{k:'本社',v:'レイキャビク（アイスランド）'},{k:'ハブ',v:'ケフラビーク国際空港（KEF）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1937年'},{k:'保有機材',v:'約50機'},{k:'所得税',v:'あり（最高46.3%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'大西洋路線（B737 MAX/B767）',range:'¥1,304万〜¥2,119万',avg:'¥1,700万',pct:100,note:'USD/EUR建て',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'大西洋路線',range:'¥734万〜¥1,141万',avg:'¥900万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算（ISK/JPY換算含む）。アイスランド所得税最高46.3%。€80,000〜€130,000（機長）の業界水準参考値。アイスランドは生活費が高く注意。',
  ops:{routes:'ケフラビークハブから北米（ニューヨーク・ボストン・シカゴ等）と欧州（ロンドン・コペンハーゲン・フランクフルト等）を結ぶ大西洋路線が中心。',fleet:'Boeing 737 MAX 8/9, B767-300ER。約50機。'},
  training:T_LCC,
  benefits:[...B_LCC,{icon:'🌋',title:'アイスランドの自然環境',body:'オーロラ・温泉・大自然に囲まれた世界有数のライフスタイル環境。観光シーズンの飛行多様性も魅力。'}],
  hiringStatus:'定期採用中。EASA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'大西洋路線乗務。ケフラビークベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（Samgöngustofa認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,500h以上（目安）'},{k:'型式',v:'B737 MAX/B767優遇'}],
      note:'※ 英語が公用語（北欧圏）で日本人にも生活しやすい環境。冬の暗さには慣れが必要。'},
  ],
  recruitUrl:'https://www.icelandair.com/company/careers/',
},

{
  file:'norwegian.html',code:'DY',color:'#D41819',
  nameEn:'Norwegian Air Shuttle',nameJa:'ノルウェー エア シャトル（Norwegian）',
  subtitle:'欧州大手LCC · 低コスト長距離路線のパイオニア',
  tags:[{cls:'tag-red',label:'🇳🇴 ノルウェー'},{cls:'tag-orange',label:'LCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-blue',label:'欧州'}],
  stats:[{val:'¥1,304万〜2,119万',label:'機長年収（税引前）',color:'#D41819'},{val:'¥734万〜1,141万',label:'FO年収（税引前）',color:'#ff8888'},{val:'約80機',label:'保有機材数'},{val:'150都市+',label:'就航都市数（欧州内）'}],
  overview:'ノルウェー エア シャトルは北欧最大のLCCで欧州全域・北米路線を低コスト運賃で展開してきた。2020〜2021年のコロナ危機で経営再建を経て規模縮小後に再出発。B737を主力に欧州域内路線を中心に再展開中。ノルウェーは所得税が高い（最高47.4%）が北欧の豊かな社会保障が受けられる。',
  facts:[{k:'本社',v:'フォルネブ（ノルウェー）'},{k:'ハブ',v:'オスロ・ガーデルモーン空港（OSL）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1993年'},{k:'保有機材',v:'約80機'},{k:'所得税',v:'あり（最高47.4%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'欧州線（B737 MAX）',range:'¥1,304万〜¥2,119万',avg:'¥1,700万',pct:100,note:'NOK/EUR建て',noteTag:'blue'},
    {pos:'副操縦士（F/O）',sub:'欧州線',range:'¥734万〜¥1,141万',avg:'¥900万',pct:53,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算（NOK/JPY換算含む）。ノルウェー所得税最高47.4%。€80,000〜€130,000（機長）の業界水準参考値。2022年再建後の条件は変動している可能性あり。',
  ops:{routes:'オスロハブから欧州全域（スペイン・イタリア・ギリシャ等）、北アフリカ・カナリア諸島に就航。長距離（北米）路線は2022年再建時に撤退済み。',fleet:'Boeing 737 MAX 8, B737-800。約80機。'},
  training:T_LCC,
  benefits:B_LCC,
  hiringStatus:'採用中（再建後）。EASA ATPL保有者対象。',
  hiringColor:'#f5c842',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'欧州線乗務。オスロベース主体。',status:'採用中',stag:'blue',
      details:[{k:'必要資格',v:'EASA ATPL（Luftfartstilsynet認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,000h以上（目安）'},{k:'型式',v:'B737 MAX優遇'}],
      note:'※ 2022年の再建後、欧州域内路線に特化した新しいビジネスモデルで運営中。'},
  ],
  recruitUrl:'https://www.norwegian.com/en/about/careers/',
},

{
  file:'ryanair.html',code:'FR',color:'#073590',
  nameEn:'Ryanair',nameJa:'ライアンエアー（Ryanair）',
  subtitle:'欧州最大の乗客数を誇る超低コスト航空会社',
  tags:[{cls:'tag-blue',label:'🇮🇪 アイルランド'},{cls:'tag-orange',label:'ULCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-red',label:'欧州最大'}],
  stats:[{val:'¥1,630万〜2,445万',label:'機長年収（税引前）',color:'#073590'},{val:'¥734万〜1,304万',label:'FO年収（税引前）',color:'#5fb0ff'},{val:'約600機',label:'保有機材数'},{val:'200都市+',label:'就航都市数'}],
  overview:'ライアンエアーは欧州最大の旅客数を誇る超低コスト航空会社（ULCC）。アイルランドのダブリンをベースに欧州全域・北アフリカに200都市以上を結ぶ広大なネットワーク。B737 MAX/800で統一されたフリートと徹底したコスト管理で低運賃を実現。パイロットはEASA ATPLが必要で、一部は「パイロット派遣契約」形態で雇用されるケースもある。',
  facts:[{k:'本社',v:'ダブリン（アイルランド）'},{k:'ハブ',v:'ダブリン・スタンステッド等（多拠点）'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1984年'},{k:'保有機材',v:'約600機'},{k:'所得税',v:'各国法に依存（拠点国）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'欧州線（B737 MAX/800）',range:'¥1,630万〜¥2,445万',avg:'¥2,000万',pct:100,note:'EUR建て・契約形態注意',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'欧州線',range:'¥734万〜¥1,304万',avg:'¥1,000万',pct:50,note:'型式費用自己負担あり',noteTag:'orange'},
  ],
  salaryNote:'※ EUR/JPY=163換算。€100,000〜€150,000（機長）の業界水準参考値。一部パイロットは「Personal Service Company（自営業契約）」形態での雇用あり。型式訓練費用の自己負担が求められる場合がある。',
  ops:{routes:'ダブリン・スタンステッド等から欧州全域（スペイン・イタリア・ポルトガル・ポーランド等）、北アフリカ（モロッコ等）に就航。短距離路線に特化。',fleet:'Boeing 737 MAX 8-200, B737-800。約600機（世界有数の単機種大量保有）。'},
  training:T_LCC,
  benefits:[
    {icon:'✈️',title:'スタッフ割引',body:'自社便の割引搭乗特典（割引幅はLCC水準）。'},
    {icon:'📈',title:'生産性ボーナス',body:'レグ数連動のプロダクティビティボーナス。フライト時間が多いほど収入増加。'},
    {icon:'🏠',title:'ベース選択',body:'欧州各国30拠点以上からベース都市を選択可能（希望制）。'},
    {icon:'📅',title:'有給休暇',body:'EU指令準拠。拠点国の法律により異なる。'},
  ],
  hiringStatus:'常時採用中。欧州最大規模の採用数。EASA ATPL必須。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（常時採用）',sub:'欧州線乗務。多数ベース選択可能。',status:'常時採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（相互承認可）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'FO：500h以上（CPL保有）、機長：4,000h以上'},{k:'型式',v:'B737優遇・型式費用自己負担あり'}],
      note:'※ 一部の採用形態（パイロット派遣・自営業契約）では型式訓練費用の自己負担が必要。雇用形態の詳細は必ず確認すること。'},
  ],
  recruitUrl:'https://careers.ryanair.com',
},

{
  file:'easyjet.html',code:'U2',color:'#FF6600',
  nameEn:'easyJet',nameJa:'イージージェット（easyJet）',
  subtitle:'英国最大のLCC · 欧州全域に展開',
  tags:[{cls:'tag-orange',label:'🇬🇧 英国'},{cls:'tag-orange',label:'LCC'},{cls:'tag-gray',label:'独立系'},{cls:'tag-blue',label:'欧州'}],
  stats:[{val:'¥1,425万〜1,900万',label:'機長年収（税引前）',color:'#FF6600'},{val:'¥760万〜1,140万',label:'FO年収（税引前）',color:'#fb923c'},{val:'約350機',label:'保有機材数'},{val:'150都市+',label:'就航都市数'}],
  overview:'イージージェットは英国ルートン空港を拠点に設立されたLCCで、現在は欧州全域に150都市以上を結ぶ。ロンドン・アムステルダム・ジュネーブ・ミラノ等に主要ベースを持つ。A320族で統一されたフリート。Brexit後はeasyJet EuropeをEU子会社として設立し欧州路線を維持。パイロットはUK CAA/EASA ATPLが必要。',
  facts:[{k:'本社',v:'ルートン（英国）'},{k:'ハブ',v:'ルートン・ガトウィック・アムステルダム等'},{k:'アライアンス',v:'なし（独立系）'},{k:'設立',v:'1995年'},{k:'保有機材',v:'約350機'},{k:'所得税',v:'各国法（拠点国）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'欧州線（A320/A321）',range:'¥1,425万〜¥1,900万',avg:'¥1,650万',pct:100,note:'GBP建て・税引前',noteTag:'orange'},
    {pos:'副操縦士（First Officer）',sub:'欧州線',range:'¥760万〜¥1,140万',avg:'¥950万',pct:58,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ GBP/JPY=190換算（英国ベースの場合）。EU拠点ではEUR建て。£75,000〜£100,000（機長）の業界水準参考値。ベース都市の生活費により実質給与が大きく異なる。',
  ops:{routes:'ロンドン・アムステルダム・ジュネーブ・マドリッド・ミラノ等複数ベースから欧州全域・北アフリカ・中東に就航。短中距離路線に特化。',fleet:'Airbus A321neo, A320neo, A320ceo, A319。約350機。'},
  training:T_LCC,
  benefits:[...B_LCC,{icon:'📊',title:'インセンティブペイ',body:'フライト時間・生産性に連動した追加給与。繁忙期は収入増加の機会あり。'}],
  hiringStatus:'常時採用中。UK CAA/EASA ATPL保有者対象。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（常時採用）',sub:'欧州線乗務。複数ベース選択可。',status:'常時採用中',stag:'green',
      details:[{k:'必要資格',v:'UK CAA/EASA ATPL'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'FO：500h以上、機長：4,000h以上（目安）'},{k:'型式',v:'A320族（訓練費用会社負担のケースあり）'}],
      note:'※ easyJet GenXプログラムで型式訓練費用を会社負担するコースあり（条件あり）。'},
  ],
  recruitUrl:'https://careers.easyjet.com',
},

{
  file:'vueling.html',code:'VY',color:'#FFCC00',
  nameEn:'Vueling Airlines',nameJa:'ヴエリング航空（Vueling Airlines）',
  subtitle:'スペイン最大のLCC · IAGグループ傘下',
  tags:[{cls:'tag-gold',label:'🇪🇸 スペイン'},{cls:'tag-orange',label:'LCC'},{cls:'tag-blue',label:'IAGグループ'},{cls:'tag-blue',label:'欧州'}],
  stats:[{val:'¥1,141万〜1,793万',label:'機長年収（税引前）',color:'#FFCC00'},{val:'¥571万〜978万',label:'FO年収（税引前）',color:'#f5c842'},{val:'約130機',label:'保有機材数'},{val:'150都市+',label:'就航都市数'}],
  overview:'ヴエリング航空はスペイン最大のLCCでIAGグループ（British Airways・Iberia同グループ）傘下。バルセロナ・エル・プラット空港を主要ベースに欧州全域・北アフリカ・中東に就航。A320族で統一されたシンプルなフリート。スペインを拠点に地中海ネットワークに強く、バルセロナは欧州有数の観光・ビジネス都市として生活環境が良好。',
  facts:[{k:'本社',v:'バルセロナ（スペイン）'},{k:'ハブ',v:'バルセロナ・エル・プラット空港（BCN）'},{k:'アライアンス',v:'IAGグループ（ワンワールド関連）'},{k:'設立',v:'2004年'},{k:'保有機材',v:'約130機'},{k:'所得税',v:'あり（最高47%）'}],
  salaryRows:[
    {pos:'機長（Captain）',sub:'欧州線（A320/A321）',range:'¥1,141万〜¥1,793万',avg:'¥1,450万',pct:100,note:'EUR建て・税引前',noteTag:'blue'},
    {pos:'副操縦士（First Officer）',sub:'欧州線',range:'¥571万〜¥978万',avg:'¥750万',pct:52,note:'シニオリティ制',noteTag:'gray'},
  ],
  salaryNote:'※ EUR/JPY=163換算。スペイン所得税最高47%。€70,000〜€110,000（機長）の業界水準参考値。バルセロナの生活費は高めだが、欧州LCCの中では安定した雇用環境。',
  ops:{routes:'バルセロナハブから欧州全域（フランス・イタリア・ドイツ・英国等）、北アフリカ（モロッコ・チュニジア等）、中東（アブダビ等）に就航。国内線もカバー。',fleet:'Airbus A321neo, A320neo, A320ceo, A319。約130機。'},
  training:T_LCC,
  benefits:[...B_LCC,{icon:'🏖️',title:'バルセロナ生活環境',body:'地中海気候・ビーチ・文化的豊かさ。欧州でも人気の居住地であるバルセロナを拠点に生活。'}],
  hiringStatus:'定期採用中。EASA ATPL保有者対象。A320型式保有者優遇。',
  hiringColor:'#34d399',
  jobs:[
    {title:'機長・副操縦士（定期採用）',sub:'欧州線乗務。バルセロナ/マドリッドベース。',status:'採用中',stag:'green',
      details:[{k:'必要資格',v:'EASA ATPL（AESA認定）'},{k:'英語',v:'ICAO Level 4以上'},{k:'最低飛行時間',v:'機長4,000h以上（目安）'},{k:'型式',v:'A320族優遇'}],
      note:'※ IAGグループ内（BA・Iberia等）への異動機会あり。スペイン語があると職場環境に馴染みやすい。'},
  ],
  recruitUrl:'https://jobs.vueling.com',
},

];

airlines.forEach(a=>{
  const html=page(a);
  writeFileSync(`airlines/${a.file}`,html,'utf8');
  console.log(`Created: ${a.file}`);
});
console.log('Europe airlines done!');
