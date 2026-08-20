import { writeFileSync, mkdirSync } from 'fs';

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
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}`;

const JS = `window.addEventListener('scroll',()=>{document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');e.target.querySelectorAll('[data-width]').forEach(b=>{b.style.width='0';setTimeout(()=>{b.style.width=b.dataset.width+'%'},80)});io.unobserve(e.target)}})},{threshold:.01,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));
setTimeout(()=>{document.querySelectorAll('.fade-up:not(.visible)').forEach(el=>{el.classList.add('visible');el.querySelectorAll('[data-width]').forEach(b=>{b.style.width='0';setTimeout(()=>{b.style.width=b.dataset.width+'%'},80)})})},300);`;

function page(a) {
  const gradStyle = `background:linear-gradient(135deg,${a.color},#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text`;
  const heroGrad = `background:linear-gradient(180deg,${a.color}11 0%,transparent 60%)`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${a.nameEn} パイロット年収・求人情報 | PILOT VALUE</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet"/>
<script>tailwind.config={theme:{extend:{colors:{bg:'#0a0c0f',surface:'#111620',raised:'#18212f',accent:'#3d9bff',gold:'#f5c842',orange:'#f97316',text:'#e8edf2',muted:'#6b7d93'},fontFamily:{sans:['Inter','Noto Sans JP','sans-serif']}}}};<\/script>
<style>${CSS}</style>
</head>
<body class="relative">
<nav id="main-nav">
<div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
<a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" class="logo-img"/></a>
<div class="hidden md:flex items-center gap-6"><a href="../index.html#compare" class="nav-link">日本 vs 海外</a><a href="../index.html#ranking" class="nav-link">機長ランキング</a><a href="../index.html#jobs" class="nav-link">求人情報</a></div>
<a href="../index.html" class="btn-ghost text-sm py-2 px-4">← 一覧に戻る</a>
</div>
</nav>

<div class="hero-airline" style="${heroGrad}">
<div class="max-w-7xl mx-auto px-6 relative">
<div class="flex items-start gap-6 mb-8">
<div class="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0" style="background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.code}</div>
<div>
<div class="flex flex-wrap items-center gap-3 mb-3">${a.tags.map(t=>`<span class="tag ${t.cls}">${t.text}</span>`).join('')}</div>
<h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight" style="${gradStyle}">${a.nameEn}</h1>
<p class="text-muted text-lg mt-2">${a.nameJa} — ${a.subtitle}</p>
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
<h2 class="text-2xl font-bold mb-4">${a.nameEn}について</h2>
<div class="grid lg:grid-cols-2 gap-8">
<div>${a.overview.map(p=>`<p class="text-muted leading-relaxed mb-4">${p}</p>`).join('')}</div>
<div class="grid grid-cols-2 gap-4">${a.facts.map(f=>`<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${f.k}</div><div class="font-semibold">${f.v}</div></div>`).join('')}</div>
</div>
</div>

<!-- 年収 -->
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">年収データ（2026年3月現在）</div>
<h2 class="text-2xl font-bold mb-6">パイロット年収</h2>
<div class="overflow-x-auto"><table>
<thead><tr><th>ポジション</th><th>年収レンジ</th><th>平均年収</th><th>備考</th></tr></thead>
<tbody>
${a.salaryRows.map(r=>`<tr>
<td><span class="font-semibold">${r.pos}</span>${r.sub?`<br><span class="text-xs text-muted">${r.sub}</span>`:''}</td>
<td><div class="text-sm">${r.range}</div><div class="mt-1 salary-bar-track w-32"><div class="salary-bar-fill" style="background:linear-gradient(90deg,${r.color||a.color}88,${r.color||a.color})" data-width="${r.pct}"></div></div></td>
<td><span class="font-bold text-lg" style="color:${r.color||a.color}">${r.avg}</span></td>
<td>${r.note?`<span class="tag tag-${r.noteTag||'blue'}">${r.note}</span>`:''}</td>
</tr>`).join('')}
</tbody>
</table></div>
${a.salaryNote?`<div class="mt-4 p-4 rounded-xl" style="background:${a.color}11;border:1px solid ${a.color}33"><p class="text-sm" style="color:${a.color}">${a.salaryNote}</p></div>`:''}
</div>

<!-- 運航環境 -->
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">運航環境</div>
<h2 class="text-2xl font-bold mb-6">フライト環境・路線・機材</h2>
<div class="grid md:grid-cols-2 gap-6">
<div><h3 class="font-semibold mb-3" style="color:${a.color}">路線・ネットワーク</h3><ul class="space-y-2 text-sm text-muted">${a.ops.routes.map(r=>`<li class="flex items-start gap-2"><span style="color:${a.color}" class="mt-0.5">✦</span>${r}</li>`).join('')}</ul></div>
<div><h3 class="font-semibold mb-3 text-accent">機材フリート</h3><div class="grid grid-cols-2 gap-3">${a.ops.fleet.map(f=>`<div class="stat-card text-center py-3"><div class="font-bold" style="color:${a.color}">${f.name}</div><div class="text-xs text-muted mt-1">${f.desc}</div></div>`).join('')}</div></div>
</div>
</div>

<!-- 訓練 -->
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">訓練環境</div>
<h2 class="text-2xl font-bold mb-6">訓練・昇格システム</h2>
<div class="grid md:grid-cols-2 gap-6">
${a.training.map(t=>`<div class="info-card"><div class="font-semibold mb-1">${t.title}</div><div class="text-sm text-muted">${t.body}</div></div>`).join('')}
</div>
</div>

<!-- 福利厚生 -->
<div class="glass p-8 fade-up">
<div class="section-badge mb-4">福利厚生</div>
<h2 class="text-2xl font-bold mb-6">ベネフィット・待遇</h2>
<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
${a.benefits.map(b=>`<div class="info-card"><div class="text-2xl mb-2">${b.icon}</div><div class="font-semibold mb-1">${b.title}</div><div class="text-sm text-muted">${b.body}</div></div>`).join('')}
</div>
</div>

<!-- 募集要項 -->
<div class="glass p-8 fade-up" style="border-color:rgba(52,211,153,.2)">
<div class="flex items-center gap-3 mb-6">
<div class="section-badge" style="background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.3);color:#34d399">2026年3月現在 募集中</div>
<span class="tag tag-${a.hiringStatus==='積極採用中'?'green':'blue'}">${a.hiringStatus}</span>
</div>
<h2 class="text-2xl font-bold mb-6">募集要項</h2>
<div class="space-y-5">
${a.jobs.map(j=>`<div class="glass-raised p-6">
<div class="flex items-start justify-between mb-3">
<div><div class="font-bold text-lg">${j.title}</div><div class="text-muted text-sm">${j.sub}</div></div>
<span class="tag tag-${j.statusTag||'green'}">${j.status}</span>
</div>
<div class="grid md:grid-cols-3 gap-4 mb-4">
${j.details.map(d=>`<div><div class="text-xs text-muted uppercase tracking-widest mb-1">${d.k}</div><div class="text-sm">${d.v}</div></div>`).join('')}
</div>
${j.note?`<div class="text-xs text-muted">${j.note}</div>`:''}
</div>`).join('')}
</div>
<div class="mt-6"><a href="${a.recruitUrl}" target="_blank" rel="noopener" class="btn-primary">${a.nameEn}公式採用ページへ <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9 3h4v4M13 3l-7 7M5 5H3v8h8v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a></div>
</div>

</div>
<footer class="py-10"><div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4"><a href="../index.html"><img src="../baland_ass/ロゴイメージ.png" alt="PILOT VALUE" class="h-7 w-auto opacity-70"/></a><div class="text-xs text-muted">© 2026 PILOT VALUE. 掲載データは参考値です。</div><a href="../index.html" class="btn-ghost text-sm py-2 px-4">← 航空会社一覧</a></div></footer>
<script>${JS}<\/script>
<script src="../currency.js"><\/script>
</body></html>`;
}

const airlines = [
  {
    file:'skymark.html', code:'SKY', color:'#34d399',
    nameEn:'Skymark Airlines', nameJa:'スカイマーク航空', subtitle:'日本第3位の独立系キャリア。国内線専業のコスト競争力に強み。',
    tags:[{cls:'tag-blue',text:'🇯🇵 日本'},{cls:'tag-green',text:'国内線専業'},{cls:'tag-gray',text:'独立系キャリア'}],
    stats:[{val:'¥1,900万',label:'機長 平均年収（推定）'},{val:'¥950万',label:'副操縦士 平均年収（推定）'},{cls:'tag-green'},{val:'B737NG',label:'主要機材'},{val:'約30機',label:'保有機材数'}],
    overview:['スカイマーク（Skymark Airlines）は1998年設立の独立系航空会社です。大手2社（ANA/JAL）に次ぐ国内第3位の規模を持ち、羽田を中心に全国主要都市への国内線を運航しています。','2015年に一度民事再生法を申請しましたが再建を果たし、2021年に再上場。競争力のある価格設定と効率的な運航で安定成長を続けています。国内線専業のため、短時間・高頻度の運航スタイルが特徴です。'],
    facts:[{k:'本社',v:'東京都大田区（羽田）'},{k:'設立',v:'1998年'},{k:'ハブ空港',v:'羽田空港（HND）'},{k:'路線数',v:'国内線約15路線'},{k:'機材統一',v:'B737NG（単一機種運航）'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'B737NG',range:'¥1,600万〜¥2,300万',avg:'¥1,900万',pct:100,note:'推定値',noteTag:'gray'},
      {pos:'副操縦士（F/O）',sub:'B737NG',range:'¥700万〜¥1,200万',avg:'¥950万',pct:50,note:'推定値',noteTag:'gray'},
    ],
    salaryNote:'💡 スカイマークは外国人機長の契約採用を行っており、その場合の報酬は月額$9,000〜14,250（総支給）との報告があります。日本人正社員の給与水準についての公開データは限られています。',
    ops:{
      routes:['羽田〜新千歳・福岡・那覇・神戸・新千歳など主要国内線','短時間・高頻度の国内線運航に特化した効率的スケジュール','国際線は運航なし。将来的な国際線参入の可能性は模索中','旅客ロードファクターは国内平均を上回る水準を維持'],
      fleet:[{name:'B737-800',desc:'国内線主力機'},{name:'B737-800NG',desc:'高頻度運航対応'}]
    },
    training:[
      {title:'型式訓練（B737）',body:'B737型式限定訓練。那覇・成田等の契約訓練センターで実施。既存ライセンス保有者は型式訓練のみで就航可能。'},
      {title:'機長昇格',body:'F/O経験後の昇格。B737単一機種のため昇格後も同機材での運航継続。評価と空席による。'},
      {title:'定期審査',body:'年1〜2回のシミュレーター審査（PC）。国土交通省認定の審査員により実施。'},
      {title:'訓練環境の特徴',body:'単一機種運航のため訓練が効率的。搭乗員は早い段階でB737のエキスパートになれる。'}
    ],
    benefits:[
      {icon:'✈️',title:'航空券優待',body:'本人・家族向けの社員割引航空券。スカイマーク運航路線での利用。'},
      {icon:'🏥',title:'医療保険',body:'健康保険組合加入。パイロット身体検査サポート。'},
      {icon:'🏦',title:'退職金制度',body:'確定拠出年金制度あり。勤続年数に応じた退職一時金。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失に対する収入補償制度。'},
      {icon:'🏠',title:'住宅手当',body:'勤務地（羽田）近郊の住宅手当または社宅制度。'},
      {icon:'📚',title:'訓練費用',body:'型式訓練費用は会社負担。定期審査費用も会社負担。'}
    ],
    hiringStatus:'募集中',
    jobs:[
      {title:'機長（Captain）— B737NG',sub:'国内線機長。羽田ベース勤務。',status:'募集中',statusTag:'green',
        details:[{k:'必要資格',v:'B737型式限定（定期運送用操縦士）'},{k:'必要飛行時間',v:'機長 3,000時間以上（目安）'},{k:'雇用形態',v:'正社員または契約社員'}],
        note:'※ 採用状況は変動します。公式採用ページおよびお問い合わせにて最新情報をご確認ください。'},
      {title:'副操縦士（F/O）— B737NG',sub:'国内線副操縦士。',status:'随時募集',statusTag:'blue',
        details:[{k:'必要資格',v:'事業用操縦士（CPL）+計器飛行証明'},{k:'目安飛行時間',v:'500時間以上'},{k:'英語要件',v:'英語無線通信士（航空）'}],
        note:'※ 自社養成制度は現在実施していない模様。有資格者の採用が中心。'}
    ],
    recruitUrl:'https://www.skymark.co.jp/ja/company/recruit/'
  },
  {
    file:'zipair.html', code:'ZIP', color:'#a78bfa',
    nameEn:'ZIPAIR Tokyo', nameJa:'ジップエア・トウキョウ', subtitle:'JALグループのLCC国際線。B787で運航する成長中のキャリア。',
    tags:[{cls:'tag-blue',text:'🇯🇵 日本'},{cls:'tag-green',text:'募集中'},{cls:'tag-blue',text:'LCC国際線'},{cls:'tag-gray',text:'JALグループ'}],
    stats:[{val:'¥2,500万',label:'機長 平均年収（推定）'},{val:'¥1,500万',label:'副操縦士 平均年収（推定）'},{val:'B787',label:'運航機材'},{val:'2020年設立',label:'新設キャリア'}],
    overview:['ZIPAIR Tokyoは日本航空（JAL）の完全子会社として2018年に設立、2020年より運航開始したLCC国際線専業キャリアです。B787ドリームライナーを使用し、成田〜バンコク・ソウル・ホノルル・ロサンゼルス・サンノゼ等を運航しています。','LCCながらB787という高品質機材を使用し、フルサービスとLCCの中間的な位置づけ（LHCC）を目指しています。JALグループとしての安定した基盤と、設立間もない成長中のキャリアならではのダイナミックな環境が共存します。'],
    facts:[{k:'本社',v:'千葉県成田市（成田空港）'},{k:'設立',v:'2018年（運航開始2020年）'},{k:'親会社',v:'日本航空（JAL）'},{k:'路線数',v:'国際線のみ'},{k:'機材',v:'B787-8ドリームライナー'},{k:'退職年齢',v:'60歳（65歳まで契約延長可）'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'B787',range:'¥2,200万〜¥3,100万',avg:'¥2,500万',pct:100,note:'推定値',noteTag:'gray'},
      {pos:'副操縦士（F/O）',sub:'B787',range:'¥1,200万〜¥1,900万',avg:'¥1,500万',pct:60,note:'推定値',noteTag:'gray'},
    ],
    salaryNote:'💡 Air Japan（AJX）の公開データ参照：機長月額$10,930〜$16,090、F/O月額$6,800〜$9,660。ZIPAIRの実際の数値は異なる可能性があります。',
    ops:{
      routes:['成田（NRT）をベースに北米・東南アジア・ハワイを結ぶ国際線','ロサンゼルス（LAX）・サンノゼ（SJC）・ホノルル（HNL）等 長距離太平洋路線','バンコク・ソウル・クアラルンプール等 アジア短〜中距離路線','国内線は運航しない国際線専業LCC'],
      fleet:[{name:'B787-8',desc:'唯一の使用機材'},{name:'B787拡張',desc:'今後の拡大予定あり'}]
    },
    training:[
      {title:'B787型式訓練',body:'JALグループの訓練インフラを活用。成田をベースに地上学科→シミュレーター→実機訓練。'},
      {title:'既取得資格者向け',body:'B787型式保有者は移行訓練のみ。他機種からの移行はフルコース型式訓練を実施。'},
      {title:'機長昇格',body:'F/O入社後の昇格審査。若い会社のため昇格機会は比較的早い可能性がある（需要次第）。'},
      {title:'JALグループとの連携',body:'JAL本体のノウハウを活用した訓練体制。安全管理体制はJALグループ水準。'}
    ],
    benefits:[
      {icon:'✈️',title:'JALグループ航空券優待',body:'JAL・ZIPAIR便の社員割引制度。JALグループ内の連携あり。'},
      {icon:'🏥',title:'医療保険',body:'健康保険組合加入。航空身体検査サポート。ライセンス喪失保険。'},
      {icon:'🏦',title:'退職金・年金',body:'確定拠出年金制度。勤続年数に応じた退職一時金制度。'},
      {icon:'📋',title:'1,500時間保証',body:'月間最低保証飛行時間あり（70時間/月目安）。'},
      {icon:'🌍',title:'国際線手当',body:'海外滞在時の日当（日当¥5,300/日 相当）別途支給。'},
      {icon:'📚',title:'成長機会',body:'新設キャリアのため、早期に多様な役割・路線を経験できる可能性が高い。'}
    ],
    hiringStatus:'募集中',
    jobs:[
      {title:'機長（Captain）— B787',sub:'国際線機長。成田ベース勤務。',status:'積極採用',statusTag:'green',
        details:[{k:'必要飛行時間',v:'1,500時間以上（機長として）'},{k:'必要資格',v:'定期運送用操縦士免許（ATPL）'},{k:'退職年齢',v:'60歳（65歳まで延長制度あり）'}],
        note:'※ 2024年10月に約150名の採用計画を発表。積極的な拡大局面にあります。'},
      {title:'副操縦士（F/O）— B787',sub:'国際線副操縦士。',status:'募集中',statusTag:'green',
        details:[{k:'必要資格',v:'事業用操縦士（CPL）+計器飛行証明'},{k:'目安飛行時間',v:'1,500時間以上（ATPLライセンス保有者優遇）'},{k:'英語要件',v:'ICAO Level 4以上'}],
        note:''}
    ],
    recruitUrl:'https://www.zipairtokyo.com/en/recruit/'
  },
  {
    file:'peach.html', code:'APJ', color:'#f472b6',
    nameEn:'Peach Aviation', nameJa:'ピーチ・アビエーション', subtitle:'ANAグループのLCC。A320ファミリーで国内・国際線を運航。',
    tags:[{cls:'tag-blue',text:'🇯🇵 日本'},{cls:'tag-gray',text:'要確認'},{cls:'tag-blue',text:'LCC'},{cls:'tag-gray',text:'ANAグループ'}],
    stats:[{val:'¥2,350万',label:'機長 年収（目安）'},{val:'¥1,400万',label:'副操縦士 年収（目安）'},{val:'A320',label:'主要機材'},{val:'2011年設立',label:'設立年'}],
    overview:['Peach Aviation（ピーチ）は2011年設立のANA完全子会社LCCです。大阪（関西国際空港）をメインベースに、A320ファミリーで国内線・近距離国際線（韓国・台湾・香港等）を運航しています。','LCCとして大幅なコスト削減を実現している一方、ANAグループとしての安全基準・訓練品質は維持されています。関西発着を中心とした路線網が特徴で、西日本在住パイロットには勤務地の面でもメリットがあります。'],
    facts:[{k:'本社',v:'大阪府泉佐野市（関西空港）'},{k:'設立',v:'2011年'},{k:'親会社',v:'全日本空輸（ANA）'},{k:'ハブ空港',v:'関西国際空港（KIX）'},{k:'機材',v:'A320/A321neo'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'A320/A321',range:'¥2,000万〜¥2,800万',avg:'¥2,350万',pct:100,note:'公開データに基づく',noteTag:'gray'},
      {pos:'副操縦士（F/O）',sub:'初年度〜シニア',range:'¥1,000万〜¥1,600万',avg:'¥1,400万',pct:60,note:'手当込み',noteTag:'gray'},
    ],
    salaryNote:'💡 公開情報によれば機長年収は通勤手当込みで約¥2,350万。F/O初年度は約¥1,000万〜1,300万。ANA本体比で30〜50%低い水準ですが、LCCとして勤務パターンが規則的という利点もあります。',
    ops:{
      routes:['関西（KIX）・那覇（OKA）をベースに全国主要都市間を運航','国際線：韓国（仁川・釜山）・台湾・香港・クアラルンプール等 近距離アジア路線','国内線：東京（成田）・札幌・福岡・鹿児島・石垣等','LCCモデルによる高い機体稼働率（1機あたり1日10時間以上）'],
      fleet:[{name:'A320-200',desc:'国内・近距離国際線'},{name:'A321neo',desc:'中容量・中距離路線'}]
    },
    training:[
      {title:'A320型式訓練',body:'ANAグループの訓練インフラを一部活用。地上学科→シミュレーター訓練→実機訓練の順。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック（シミュレーター）。国土交通省認可の審査員による。'},
      {title:'機長昇格',body:'F/O経験後の評価・空席ベースで昇格。LCCとして比較的少ない乗員数のため昇格機会はケースバイケース。'},
      {title:'訓練の特徴',body:'A320単一機種ファミリーのため、効率的な訓練体制。短距離路線が多く、発着回数の経験を積みやすい。'}
    ],
    benefits:[
      {icon:'✈️',title:'ANAグループ優待',body:'ANA・ピーチ便の社員割引航空券。グループ各社での優待利用可能。'},
      {icon:'🏥',title:'医療保険',body:'ANAグループ健康保険組合加入またはピーチ独自の健康保険。'},
      {icon:'🏦',title:'退職金・年金',body:'確定拠出年金制度。LCCとして退職金水準はANA本体より低め。'},
      {icon:'📅',title:'規則的な勤務',body:'国内・近距離路線のため比較的規則的なスケジュール。長期海外滞在なし。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失に対する収入補償。'},
      {icon:'🌸',title:'関西ベース',body:'関西空港ベース勤務が中心。関西在住者には生活面でのメリット大。'}
    ],
    hiringStatus:'採用状況確認要',
    jobs:[
      {title:'機長・副操縦士（A320 Family）',sub:'国内線・近距離国際線。関西空港ベース。',status:'公式ページ要確認',statusTag:'gray',
        details:[{k:'必要資格',v:'A320型式（ATPL/CPL+計器）'},{k:'必要飛行時間',v:'公式発表に基づく'},{k:'雇用形態',v:'正社員（無期雇用）'}],
        note:'※ 現在の採用状況はPeach公式サイトでご確認ください。ANAグループ各社のキャリアサイトも参照。'}
    ],
    recruitUrl:'https://www.flypeach.com/company/recruit/'
  },
  {
    file:'jetstar-japan.html', code:'GK', color:'#fb923c',
    nameEn:'Jetstar Japan', nameJa:'ジェットスター・ジャパン', subtitle:'JAL・カンタスJVのLCC。A320系で国内線・国際線を運航。',
    tags:[{cls:'tag-blue',text:'🇯🇵 日本'},{cls:'tag-green',text:'募集中'},{cls:'tag-blue',text:'LCC'},{cls:'tag-gray',text:'JAL/Qantasグループ'}],
    stats:[{val:'¥2,400万',label:'機長 年収（推定）'},{val:'¥1,450万',label:'副操縦士 年収（推定）'},{val:'A320',label:'主要機材'},{val:'2012年設立',label:'設立年'}],
    overview:['Jetstar Japan（ジェットスター・ジャパン）はJAL・カンタスグループ・三菱商事の合弁で2012年に設立されたLCCです。成田・関西・中部を拠点に国内線を中心に運航しています。','カンタスグループ（Jetstar）の傘下であるため、オーストラリアを含むジェットスターグローバルネットワークの一員。スタッフトラベル（MyID）の恩恵としてJetstar・Qantas便の割引航空券が利用可能。公開データでは副操縦士の年収・給与体系が比較的明確に把握されています。'],
    facts:[{k:'本社',v:'千葉県成田市（成田空港）'},{k:'設立',v:'2012年'},{k:'親会社',v:'JAL・カンタスグループ等'},{k:'ハブ空港',v:'成田・関西・中部'},{k:'機材',v:'A320-200 / A321neo'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'A320/A321',range:'¥2,000万〜¥2,900万',avg:'¥2,400万',pct:100,note:'推定値',noteTag:'gray'},
      {pos:'副操縦士（F/O）',sub:'初年度〜シニア',range:'¥1,250万〜¥1,600万',avg:'¥1,450万',pct:60,note:'サインオンボーナス別途',noteTag:'green'},
    ],
    salaryNote:'💡 公開データによれば副操縦士の月額基本給は¥120万（グロス）、年間ボーナス10%、サインオンボーナス約$10,000（3回に分けて支給）。生産性給与を加えた実質月収は約$9,100相当。',
    ops:{
      routes:['成田（NRT）・関西（KIX）・中部（NGO）を拠点とした国内線網','国内線：北海道・九州・沖縄等 全国主要空港へ','国際線：ケアンズ・バリ・シンガポール等 アジア太平洋短〜中距離路線','高稼働率・高頻度のLCC運航スタイル'],
      fleet:[{name:'A320-200',desc:'国内線主力'},{name:'A321neo',desc:'中長距離・高効率'}]
    },
    training:[
      {title:'A320型式訓練',body:'地上学科→シミュレーター（JALグループまたは外部訓練センター）→実機IOE。既取得者は差分訓練。'},
      {title:'Jetstarグローバル基準',body:'カンタスグループの安全基準に基づく訓練体制。オーストラリアのJetstar本社との連携あり。'},
      {title:'機長昇格',body:'F/O経験後の社内昇格審査。LCCとして比較的効率的な昇格プロセス（機材単純化のため）。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。国土交通省認可審査員による。'}
    ],
    benefits:[
      {icon:'✈️',title:'MyID スタッフトラベル',body:'Jetstar・Qantas便を含むOneworld各社の割引航空券。海外路線も利用可能。これは大きな特典。'},
      {icon:'💰',title:'サインオンボーナス',body:'入社時に約$10,000のサインオンボーナス（3回分割支給）。'},{icon:'📈',title:'生産性給与',body:'飛行時間に応じた生産性給与あり。月間フライト時間が増えるほど収入が増加。'},
      {icon:'🏥',title:'医療保険',body:'健康保険組合加入。ライセンス喪失保険完備。'},
      {icon:'📅',title:'日当',body:'国内線¥5,000/夜、国際線¥4,000/夜の日当（非課税）。'},
      {icon:'🏦',title:'退職金制度',body:'確定拠出年金制度。勤続年数に応じた退職給付。'}
    ],
    hiringStatus:'積極採用中',
    jobs:[
      {title:'機長（Captain）— A320/A321',sub:'国内線・国際線機長。成田・関西・中部ベース。',status:'募集中',statusTag:'green',
        details:[{k:'必要資格',v:'A320型式（定期運送用操縦士）'},{k:'雇用形態',v:'正社員'},{k:'ベース',v:'成田・関西・中部（選択）'}],
        note:'※ 採用詳細は公式キャリアサイト（career-jp.jetstar.com）にてご確認ください。'},
      {title:'副操縦士（F/O）— A320/A321',sub:'副操縦士。',status:'募集中',statusTag:'green',
        details:[{k:'必要資格',v:'CPL+計器飛行証明（A320型式あれば尚可）'},{k:'サインオン',v:'約$10,000（分割）'},{k:'英語',v:'英語無線通信士（航空）'}],
        note:''}
    ],
    recruitUrl:'https://career-jp.jetstar.com/'
  },
  {
    file:'spring-japan.html', code:'IJ', color:'#f87171',
    nameEn:'Spring Japan', nameJa:'春秋航空日本', subtitle:'JAL傘下のLCC。A320で国内線・中国路線を中心に運航。',
    tags:[{cls:'tag-blue',text:'🇯🇵 日本'},{cls:'tag-gray',text:'要確認'},{cls:'tag-blue',text:'LCC'},{cls:'tag-gray',text:'JALグループ'}],
    stats:[{val:'¥2,000万',label:'機長 年収（推定）'},{val:'¥1,150万',label:'副操縦士 年収（推定）'},{val:'A320',label:'主要機材'},{val:'2012年設立',label:'設立年'}],
    overview:['Spring Japan（春秋航空日本）は中国の春秋航空グループとの合弁で2012年に設立されたLCCです。現在はJALグループの一員。成田を拠点に国内線と中国を中心とした国際線を運航しています。','A320単一機種での効率的な運航が特徴。中国路線の経験が積める数少ない日本のLCCとして、中国語を含む多言語対応パイロットには特に興味深いキャリア先です。'],
    facts:[{k:'本社',v:'千葉県成田市（成田空港）'},{k:'設立',v:'2012年'},{k:'親会社',v:'JALグループ'},{k:'ハブ空港',v:'成田国際空港（NRT）'},{k:'機材',v:'A320-200'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（Captain）',sub:'A320',range:'¥1,700万〜¥2,500万',avg:'¥2,000万',pct:100,note:'推定値',noteTag:'gray'},
      {pos:'副操縦士（F/O）',sub:'A320',range:'¥900万〜¥1,400万',avg:'¥1,150万',pct:58,note:'推定値',noteTag:'gray'},
    ],
    salaryNote:'💡 Spring Japanの給与については公開データが限られています。同規模の日本LCCキャリアとの比較から推定した値です。実際の数値は採用担当へ直接お問い合わせください。',
    ops:{
      routes:['成田（NRT）ベースの国内線・国際線','国内線：広島・高松・佐賀等 地方路線に強み','国際線：上海（浦東・虹橋）・西安・武漢等 中国本土路線','日中間路線に強みを持つ数少ない日本LCC'],
      fleet:[{name:'A320-200',desc:'国内・中国路線主力'},{name:'A320拡大',desc:'機材増強計画あり'}]
    },
    training:[
      {title:'A320型式訓練',body:'JALグループの訓練インフラ活用。地上学科→シミュレーター訓練→実機IOE。'},
      {title:'中国路線対応',body:'国際線（中国路線）への対応として、航空英語以外に中国語対応も組織として重視。'},
      {title:'機長昇格',body:'F/O経験後の評価ベース昇格。小規模キャリアのため比較的早期の昇格可能性あり。'},
      {title:'JALグループ基準',body:'JALグループの安全管理体制に準拠した訓練・品質管理を実施。'}
    ],
    benefits:[
      {icon:'✈️',title:'JALグループ優待',body:'JALグループ各社の社員割引航空券制度。'},
      {icon:'🏥',title:'医療保険',body:'健康保険組合加入。航空身体検査サポート。'},
      {icon:'🌏',title:'中国路線経験',body:'中国本土路線を担当するレアな日本LCC。中国語スキルがある方には特にユニークな経験。'},
      {icon:'🏦',title:'退職金制度',body:'確定拠出年金および退職一時金制度。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失カバー。'},
      {icon:'📅',title:'国際線手当',body:'中国路線滞在時の日当・海外滞在手当別途支給。'}
    ],
    hiringStatus:'採用状況確認要',
    jobs:[
      {title:'機長・副操縦士（A320）',sub:'国内線・中国路線。成田ベース勤務。',status:'公式ページ要確認',statusTag:'gray',
        details:[{k:'必要資格',v:'A320型式（ATPL/CPL+計器）'},{k:'言語',v:'日本語必須。英語ICAO Level 4以上。'},{k:'採用形態',v:'詳細は公式ページにて'}],
        note:'※ 採用情報はSpring Japan公式サイトおよびJALグループ採用ページでご確認ください。'}
    ],
    recruitUrl:'https://www.springjapan.com/ja/recruit/'
  },
  {
    file:'united.html', code:'UAL', color:'#3d9bff',
    nameEn:'United Airlines', nameJa:'ユナイテッド航空', subtitle:'米国大手3社のひとつ。ワイドボディ機長年収は業界最高水準。',
    tags:[{cls:'tag-orange',text:'🇺🇸 USA'},{cls:'tag-green',text:'積極採用中'},{cls:'tag-orange',text:'業界最高水準'},{cls:'tag-gray',text:'スターアライアンス'}],
    stats:[{val:'¥6,320万',label:'機長 平均年収'},{val:'¥3,870万',label:'副操縦士 平均年収'},{val:'$465/h',label:'機長 最高時間給'},{val:'スターアライアンス',label:'アライアンス'}],
    overview:['ユナイテッド航空は1926年創業の米国大手キャリア。シカゴ（ORD）・デンバー（DEN）・ヒューストン（IAH）・ニューアーク（EWR）・サンフランシスコ（SFO）・ワシントン（IAD）・ロサンゼルス（LAX）をハブとし、世界6大陸へ就航するスターアライアンスのコアメンバーです。','ワイドボディ機長の年収は業界最高水準で、B777を担当するYear 12以上の機長は年収$558,000（約¥8,400万）に達します。近年の大幅な労働協約改定により給与体系が大幅に改善されました。'],
    facts:[{k:'本社',v:'シカゴ、イリノイ州'},{k:'設立',v:'1926年'},{k:'アライアンス',v:'スターアライアンス'},{k:'主要ハブ',v:'ORD/DEN/IAH/EWR等'},{k:'保有機材数',v:'約800機'},{k:'退職年齢',v:'65歳（連邦規制）'}],
    salaryRows:[
      {pos:'機長 Year 1',sub:'ナローボディ',range:'¥5,370万',avg:'約¥5,370万',pct:63,color:'#3d9bff',note:'初年度から高水準',noteTag:'blue'},
      {pos:'機長 Year 12（B777）',sub:'ワイドボディ最高水準',range:'¥8,530万',avg:'約¥8,530万',pct:100,color:'#3d9bff',note:'業界最高クラス',noteTag:'orange'},
      {pos:'副操縦士 Year 1',sub:'',range:'¥1,790万',avg:'約¥1,790万',pct:21,color:'#5ec4ff',note:'国内線スタート',noteTag:'gray'},
      {pos:'副操縦士 Year 12',sub:'',range:'¥5,220万',avg:'約¥5,220万',pct:61,color:'#5ec4ff',note:'国際線F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 USD/JPY=150換算。連邦所得税（最大37%）が課されますが、401(k)・HSA等の税制優遇を活用することで実質手取りを最大化できます。',
    ops:{
      routes:['世界最多規模の6大陸ルートネットワーク。日本路線（成田・羽田・大阪）への直行便あり','シカゴ・デンバー・ヒューストン・ニューアーク等7つの主要ハブ空港を運用','太平洋路線では日本・中国・香港・シドニー等を運航','国内線はナローボディ（B737/A320）中心、国際線はワイドボディ（B777/B787/B767）が主力'],
      fleet:[{name:'B777-200/300',desc:'長距離国際線最上位'},{name:'B787-8/9/10',desc:'中距離国際線'},{name:'B767-300ER',desc:'国際線・大陸横断'},{name:'B737 MAX',desc:'国内線主力'}]
    },
    training:[
      {title:'新人F/O訓練',body:'地上学科→シミュレーター（コデンバー訓練センター）→IOE（初期運航経験）。全てパイドトレーニング。'},
      {title:'機材移行（Bid System）',body:'年功序列（シニアリティ）による機材・路線選択制度（Bidding）。シニアになるほど希望路線・機材を選択できる。'},
      {title:'機長昇格',body:'通常7〜12年でのUpgrade。会社の機材需要・シニアリティに依存。チェック合格後に機長就航。'},
      {title:'Advanced Qualification Program',body:'FAA認定の最新訓練プログラム。個人の技量に応じたカスタマイズされた訓練内容。'},
      {title:'United Aviate Academy',body:'独自のパイロット採用・育成パイプライン。軍出身・航空大学・指定校からの採用ルート。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。不合格の場合は補充訓練→再審査のサポート体制。'}
    ],
    benefits:[
      {icon:'🏦',title:'401(k) 退職プラン',body:'会社拠出あり（条件による）。個人追加拠出も可能。老後のための節税手段として最重要。'},
      {icon:'💰',title:'プロフィットシェアリング',body:'会社業績に応じた利益配分。好業績年は年収の10%超が追加支給されることも。'},
      {icon:'✈️',title:'航空券特典',body:'本人・家族・Pass Rider向けの無料・割引航空券。スターアライアンス各社でも利用可。'},
      {icon:'🏥',title:'医療・歯科・視力',body:'包括的な医療保険。家族も対象。HSA（医療貯蓄口座）へ会社拠出あり。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償保険。'},
      {icon:'🎓',title:'教育支援',body:'本人のスキルアップ・継続教育支援。子どもへの奨学金プログラム。'}
    ],
    hiringStatus:'積極採用中',
    jobs:[
      {title:'First Officer — Domestic & International',sub:'全機材（B737/B757/B767/B777/B787）',status:'積極採用',statusTag:'green',
        details:[{k:'必要資格',v:'ATP Certificate（R-ATP可）'},{k:'必要飛行時間',v:'1,500時間（R-ATPは1,000時間）'},{k:'米国就労資格',v:'グリーンカードまたは市民権必須'}],
        note:'※ 米国での就労資格が必要。United Aviate Academyを通じた採用パイプラインも活用可能。近年数千名規模の採用計画あり。'}
    ],
    recruitUrl:'https://careers.united.com/us/en/c/pilot-jobs'
  },
  {
    file:'american.html', code:'AAL', color:'#f87171',
    nameEn:'American Airlines', nameJa:'アメリカン航空', subtitle:'米国最大の旅客輸送量を持つ大手キャリア。ワンワールド加盟。',
    tags:[{cls:'tag-orange',text:'🇺🇸 USA'},{cls:'tag-green',text:'積極採用中'},{cls:'tag-orange',text:'業界最高水準'},{cls:'tag-gray',text:'ワンワールド'}],
    stats:[{val:'¥5,930万',label:'機長 平均年収'},{val:'¥3,440万',label:'副操縦士 平均年収'},{val:'$447/h',label:'機長 最高時間給'},{val:'世界最大',label:'旅客輸送量（一時期）'}],
    overview:['アメリカン航空は1930年創業。ダラス（DFW）・シャーロット（CLT）・フィラデルフィア（PHL）・マイアミ（MIA）をメインハブとし、世界50カ国以上・350都市以上への路線網を持つワンワールドのリーダー的存在です。','2024年の大幅な労働協約改定により、機長の年収は業界トップ水準に。Year 12ワイドボディ機長は年収$469,590（約¥7,000万）。2026年には約1,500名のパイロット採用を計画しています。'],
    facts:[{k:'本社',v:'フォートワース、テキサス州'},{k:'設立',v:'1930年'},{k:'アライアンス',v:'ワンワールド'},{k:'主要ハブ',v:'DFW/CLT/PHL/MIA/LAX'},{k:'保有機材数',v:'約950機（最大規模）'},{k:'退職年齢',v:'65歳（連邦規制）'}],
    salaryRows:[
      {pos:'機長 Year 1',sub:'',range:'¥5,010万',avg:'約¥5,010万',pct:58,color:'#f87171',note:'初年度から最高水準',noteTag:'orange'},
      {pos:'機長 Year 12（ワイドボディ）',sub:'',range:'¥8,600万',avg:'約¥8,600万',pct:100,color:'#f87171',note:'業界最高クラス',noteTag:'orange'},
      {pos:'副操縦士 Year 1',sub:'',range:'¥1,710万',avg:'約¥1,710万',pct:20,color:'#fca5a5',note:'国内線スタート',noteTag:'gray'},
      {pos:'副操縦士 Year 12',sub:'',range:'¥5,260万',avg:'約¥5,260万',pct:61,color:'#fca5a5',note:'国際線F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 USD/JPY=150換算。連邦所得税が課されますが、401(k)・HSA等の税制優遇を最大活用することで手取りを最大化できます。2026年に1,500名の採用計画あり。',
    ops:{
      routes:['ダラス（DFW）を世界最大規模のハブとして運用。北中南米・欧州・アジア太平洋・カリブ海・中東に就航','日本路線（成田・羽田・大阪）への直行便を運航','国内線は全米幅広く展開。チャーター便・カーゴ部門も保有','ラテンアメリカ路線では業界最多の路線数'],
      fleet:[{name:'B777-300ER',desc:'長距離国際線最上位'},{name:'B787-8/9',desc:'中距離国際線'},{name:'A321neo',desc:'国内・短距離国際'},{name:'B737 MAX',desc:'国内線主力'}]
    },
    training:[
      {title:'新人F/O訓練',body:'フォートワースまたはチャーロットの訓練センターで地上学科→シミュレーター訓練→IOE。全てパイド。'},
      {title:'Bid System（シニアリティ）',body:'年功序列による機材・路線・ベース選択制度。シニアになるほど希望が通りやすくなる。'},
      {title:'機長昇格（Upgrade）',body:'通常7〜12年でUpgrade。シニアリティと機材空席次第。チェック合格後に機長就航。'},
      {title:'American Airlines Training Center',body:'フォートワース（DFW）の本社隣接訓練センター。最新シミュレーターを多数保有。'},
      {title:'American Airlines Cadet Academy',body:'独自のパイロット育成プログラム。提携校から優先採用ルートあり。'},
      {title:'定期審査',body:'年1〜2回のPC（プロフィシェンシーチェック）。継続的な技量維持が求められる。'}
    ],
    benefits:[
      {icon:'🏦',title:'401(k) 退職プラン',body:'会社マッチング拠出あり。節税効果の高い老後積立制度。'},
      {icon:'💰',title:'プロフィットシェアリング',body:'会社業績連動の利益配分。好業績時には年収の大幅な上乗せが期待できる。'},
      {icon:'✈️',title:'航空券特典（AAdvantage）',body:'本人・家族の無料・割引航空券。ワンワールド各社でも利用可能。'},
      {icon:'🏥',title:'医療・歯科・視力',body:'包括的な家族向け医療保険。HSA（医療貯蓄口座）も活用可能。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償保険。'},
      {icon:'🎓',title:'教育支援',body:'継続教育支援。子どもへの奨学金・教育支援プログラムあり。'}
    ],
    hiringStatus:'積極採用中',
    jobs:[
      {title:'First Officer — 全機材',sub:'B737/A321/B757/B767/B787/B777等',status:'積極採用',statusTag:'green',
        details:[{k:'必要資格',v:'ATP Certificate'},{k:'必要飛行時間',v:'1,500時間（軍出身・大学卒は1,000時間）'},{k:'米国就労資格',v:'グリーンカードまたは市民権必須'}],
        note:'※ 米国での就労資格が必要。American Airlines Cadet Academyを通じた採用ルートも利用可能。2026年に1,500名採用計画。'}
    ],
    recruitUrl:'https://jobs.aa.com/go/Flight-Operations/7630600/'
  },
  {
    file:'southwest.html', code:'SWA', color:'#fbbf24',
    nameEn:'Southwest Airlines', nameJa:'サウスウエスト航空', subtitle:'米国最大のLCC。B737専業・強力な利益配分が特徴。',
    tags:[{cls:'tag-orange',text:'🇺🇸 USA'},{cls:'tag-blue',text:'採用中'},{cls:'tag-gray',text:'B737専業LCC'}],
    stats:[{val:'¥4,820万',label:'機長 平均年収'},{val:'¥2,610万',label:'副操縦士 平均年収'},{val:'15%',label:'プロフィットシェア上限'},{val:'B737専業',label:'単一機種運航'}],
    overview:['サウスウエスト航空は1967年創業の米国最大のLCC（Low Cost Carrier）です。B737一機種のみで全路線を運航するシンプルなビジネスモデルが最大の特徴。全米107都市に就航し、国内線旅客輸送量では業界トップクラスを維持しています。','ワイドボディ機は保有しないため長距離国際線はありませんが、その分訓練・整備コストを徹底的に削減し、利益配分（プロフィットシェアリング）でパイロットに還元しています。2026年平均機長年収は約$347,000（約¥5,200万）と業界屈指。'],
    facts:[{k:'本社',v:'ダラス、テキサス州'},{k:'設立',v:'1967年'},{k:'アライアンス',v:'非加盟（独立系）'},{k:'就航都市',v:'全米107都市'},{k:'機材',v:'B737-700/800/MAX7/MAX8のみ'},{k:'退職年齢',v:'65歳（連邦規制）'}],
    salaryRows:[
      {pos:'機長 Year 1',sub:'B737',range:'$334,000/年（$334/h）',avg:'約¥5,000万',pct:92,color:'#fbbf24',note:'初年度から最高水準',noteTag:'orange'},
      {pos:'機長 Year 12',sub:'B737（全機材同一）',range:'$364,000+/年',avg:'約¥5,500万',pct:100,color:'#fbbf24',note:'プロフィットシェア追加',noteTag:'green'},
      {pos:'副操縦士 Year 1',sub:'',range:'$133,000/年',avg:'約¥2,000万',pct:37,color:'#fde68a',note:'',noteTag:'gray'},
      {pos:'副操縦士 Year 12',sub:'',range:'$255,000/年',avg:'約¥3,800万',pct:70,color:'#fde68a',note:'国内線F/O',noteTag:'blue'},
    ],
    salaryNote:'💡 ワイドボディ機を保有しないため機材による給与差がなく、シニアリティが上がるほど単純に昇給します。プロフィットシェアリング（最大15%）が加わると総収入は大幅に増加。2026年機長平均$347,000（約¥5,200万）を超えるケースが多数。',
    ops:{
      routes:['全米107都市への国内線ネットワーク（カリブ海・メキシコ等の近距離国際線も一部）','ポイントトゥポイント方式：ハブ&スポーク方式を採用しない独自の路線設計','ダラス（DAL・乗り継ぎなし直行ルート多数）・シカゴ（MDW）・ラスベガス（LAS）・デンバー（DEN）等が主要拠点','高頻度・高稼働率のスケジュール。1日最大10便以上を単一機種で処理'],
      fleet:[{name:'B737-700',desc:'短距離国内線'},{name:'B737-800',desc:'国内線主力'},{name:'B737 MAX 7',desc:'後継機導入中'},{name:'B737 MAX 8',desc:'後継機導入中'}]
    },
    training:[
      {title:'B737単一機種訓練',body:'唯一の機材がB737のため、型式訓練はB737のみ。機材変更・型式移行が不要で訓練が効率的。'},
      {title:'Dallas Love Field 訓練センター',body:'テキサス州ダラスの本社に隣接する最新訓練施設。最新型B737シミュレーターを保有。'},
      {title:'機長昇格',body:'シニアリティベース。B737単一機種のため機材変更なしでUpgrade。通常7〜12年が目安。'},
      {title:'Point-to-Point運航スタイル',body:'短距離・高頻度路線が多いため、発着回数経験を多く積める。長距離国際線なし。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。'},
      {title:'訓練特典',body:'B737単一機種のため再訓練コストが低く、会社・パイロット双方にとって効率的なシステム。'}
    ],
    benefits:[
      {icon:'💰',title:'プロフィットシェアリング',body:'会社利益の最大15%を全従業員（パイロット含む）に配分。2024年実績は機長に数百万円相当の追加収入。'},
      {icon:'🏦',title:'401(k) 退職プラン',body:'会社マッチング拠出あり。老後の資産形成に有利。'},
      {icon:'✈️',title:'航空券特典',body:'本人・家族・指定人（最大2名）への無料航空券。Southwest全路線で利用可。'},
      {icon:'🏥',title:'医療・歯科・視力',body:'包括的な家族向け医療保険。選択肢の多い保険プラン。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償保険。'},
      {icon:'📅',title:'規則的なスケジュール',body:'国内線専業のため海外滞在なし。家族との時間を確保しやすい勤務形態が人気。'}
    ],
    hiringStatus:'採用中',
    jobs:[
      {title:'First Officer — B737',sub:'全米国内線（一部近距離国際）',status:'採用中',statusTag:'blue',
        details:[{k:'必要資格',v:'ATP Certificate'},{k:'必要飛行時間',v:'1,500時間'},{k:'米国就労資格',v:'グリーンカードまたは市民権必須'}],
        note:'※ 米国での就労資格が必要。2025年以降やや採用を絞っているが継続的に募集中。公式採用ページで詳細確認を。'}
    ],
    recruitUrl:'https://careers.southwestair.com/pilot'
  },
  {
    file:'qatar-airways.html', code:'QR', color:'#f472b6',
    nameEn:'Qatar Airways', nameJa:'カタール航空', subtitle:'ドーハ拠点の中東大手。非課税+住宅・教育手当が充実。',
    tags:[{cls:'tag-gold',text:'🇶🇦 Qatar'},{cls:'tag-green',text:'積極採用中'},{cls:'tag-green',text:'所得税ゼロ'},{cls:'tag-gray',text:'ワンワールド'}],
    stats:[{val:'¥2,600万〜4,800万',label:'機長 年収（非課税）'},{val:'¥1,850万〜2,700万',label:'副操縦士 年収（非課税）'},{val:'0%',label:'カタール個人所得税'},{val:'75h保証',label:'月間最低飛行時間'}],
    overview:['カタール航空は1993年設立、カタール国営のフラッグキャリアです。ドーハのハマド国際空港（HIA）をハブとし、世界160都市以上に就航するワンワールドの主要メンバー。ドーハの戦略的な地理的位置を活かし、世界中の旅客を結ぶ乗継ハブとして機能しています。','最大の特徴はカタールに<strong style="color:#f472b6">個人所得税が存在しないこと</strong>。全額が手取りとなる給与に加え、住宅・教育・交通手当が充実しており、日本のパイロットに特に人気の転職先の一つです。'],
    facts:[{k:'本社',v:'ドーハ、カタール'},{k:'設立',v:'1993年'},{k:'ハブ空港',v:'ハマド国際空港（DOH）'},{k:'就航都市',v:'160都市以上'},{k:'所得税',v:'0%（全額手取り）'},{k:'退職年齢',v:'60歳（契約により延長可）'}],
    salaryRows:[
      {pos:'機長（A380/B777/A350）',sub:'シニア・ワイドボディ',range:'$139,000〜$300,000/年',avg:'¥2,600万〜4,800万',pct:100,color:'#f472b6',note:'全額非課税',noteTag:'green'},
      {pos:'副操縦士（F/O）',sub:'',range:'$100,000〜$120,000/年',avg:'¥1,850万〜2,700万',pct:40,color:'#f9a8d4',note:'全額非課税',noteTag:'green'},
    ],
    salaryNote:'💡 機長月額ベース$9,300〜$9,500 + 飛行給$32.95〜$34/h（75時間保証）。住宅手当AED 3,600〜4,100/月（¥15万〜17万/月）が別途支給。非課税のため全額手取り。',
    ops:{
      routes:['ドーハ（DOH）から世界160都市以上への長距離国際線ネットワーク','日本（成田・羽田・大阪）への直行便を複数運航。ドーハ経由の乗継需要が多い','アフリカ・中東・南アジア・欧州・北米・東南アジアへの広大なルート網','全路線が国際線。国内線は非常に限定的'],
      fleet:[{name:'A380',desc:'長距離超大型機'},{name:'B777-300ER',desc:'主力長距離機'},{name:'A350-900/1000',desc:'最新鋭中〜長距離'},{name:'A321neo',desc:'中短距離路線'}]
    },
    training:[
      {title:'型式訓練（Direct Entry）',body:'ドーハのQatar Airways Flight Training Center（QAFTC）で型式訓練。世界最新鋭の施設。'},
      {title:'生活環境（ドーハ）',body:'ドーハは近年急速に発展。英語が広く通じ、インターナショナルスクール・日本食料品も充実。治安は良好。'},
      {title:'機長昇格',body:'F/O入社後おおむね3〜7年。Direct Entry Captainとして採用されることも多い。評価と空席による。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。国際水準の訓練品質を維持。'},
      {title:'保証飛行時間',body:'月間75時間の飛行時間保証制度あり。未達でも基本給は保証される。'},
      {title:'訓練費用',body:'入社に際する型式訓練は会社負担（ボンドあり）。途中退職の場合は訓練費用の返還義務が生じる場合あり。'}
    ],
    benefits:[
      {icon:'🚫💰',title:'所得税ゼロ',body:'カタールに個人所得税は存在しない。給与全額が手取り。これだけで年間数百万円のメリット。'},
      {icon:'🏠',title:'住宅手当',body:'機長：AED 4,100/月（約¥17万）、F/O：AED 3,600/月（約¥15万）。会社提供住宅の場合もあり。'},
      {icon:'🎓',title:'教育手当',body:'子ども3人まで、21歳まで。ドーハのインターナショナルスクールの授業料を会社が補助。'},
      {icon:'✈️',title:'帰省チケット',body:'年間の確定帰省チケット（ビジネスクラス）。Qatar Airways・oneworld各社の割引航空券も利用可。'},
      {icon:'🚗',title:'交通手当',body:'USD 400/月の交通手当支給。ドーハでの移動コストをカバー。'},
      {icon:'🏥',title:'世界医療保険',body:'パイロット本人および家族全員向けの世界規模の医療・歯科保険。海外でも利用可能。'}
    ],
    hiringStatus:'積極採用中',
    jobs:[
      {title:'Captain — A380/B777/A350（Direct Entry）',sub:'ドーハベース国際線機長',status:'積極採用',statusTag:'green',
        details:[{k:'必要飛行時間',v:'機長 3,000時間以上（型式保有者優先）'},{k:'英語力',v:'ICAO Level 4以上'},{k:'就労ビザ',v:'Qatar Airways側がサポート'}],
        note:'※ 日本国籍保有者の採用実績あり。転職エージェント経由での応募も一般的。退職年齢は原則60歳（延長制度あり）。'},
      {title:'First Officer — 全機材',sub:'ドーハベース国際線副操縦士',status:'積極採用',statusTag:'green',
        details:[{k:'必要資格',v:'ATPL（凍結可）または CPL+IR'},{k:'必要飛行時間',v:'1,500時間以上'},{k:'月間保証',v:'75時間保証'}],
        note:''}
    ],
    recruitUrl:'https://careers.qatarairways.com/qatarairways/go/Pilot-Jobs/8505700/'
  },
  {
    file:'etihad.html', code:'EY', color:'#34d399',
    nameEn:'Etihad Airways', nameJa:'エティハド航空', subtitle:'アブダビ国営の中東大手。非課税パッケージがEmiratesと同水準。',
    tags:[{cls:'tag-gold',text:'🇦🇪 UAE'},{cls:'tag-blue',text:'採用中'},{cls:'tag-green',text:'所得税ゼロ'},{cls:'tag-gray',text:'アブダビ国営'}],
    stats:[{val:'¥3,700万〜5,300万',label:'機長 年収（非課税）'},{val:'¥1,600万〜3,200万',label:'副操縦士 年収（非課税）'},{val:'0%',label:'UAE個人所得税'},{val:'アブダビ',label:'ベース都市'}],
    overview:['エティハド航空は2003年設立のアブダビ（UAE）の国営フラッグキャリアです。アブダビ国際空港（AUH）をハブとし、世界80カ国以上・100都市以上に就航しています。','UAE内ではドバイを本拠とするEmirates、シャルジャを本拠とするAir Arabiaと並ぶ主要キャリア。Emiratesと同様に個人所得税ゼロのUAEにベースを置くため、給与の全額が手取りとなります。住宅・教育・帰省手当も充実しており、総合的なパッケージはEmiratesと同水準です。'],
    facts:[{k:'本社',v:'アブダビ、UAE'},{k:'設立',v:'2003年'},{k:'ハブ空港',v:'アブダビ国際空港（AUH）'},{k:'就航都市',v:'100都市以上'},{k:'所得税',v:'0%（全額手取り）'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（B787/A350/B777）',sub:'シニア・ワイドボディ',range:'AED 835,000〜1,185,000/年',avg:'¥3,700万〜5,300万',pct:100,color:'#34d399',note:'全額非課税',noteTag:'green'},
      {pos:'副操縦士（F/O）',sub:'',range:'AED 360,000〜720,000/年',avg:'¥1,600万〜3,200万',pct:61,color:'#6ee7b7',note:'全額非課税',noteTag:'green'},
    ],
    salaryNote:'💡 AED/JPY≈41換算。UAE個人所得税は0%のため全額手取り。Emiratesと同様に住宅手当・教育手当・帰省手当が充実。生活水準では日本の年収の1.8〜2倍相当と考えられます。',
    ops:{
      routes:['アブダビ（AUH）から世界100都市以上への国際線ネットワーク','日本（成田・羽田・名古屋）への直行便を運航','アフリカ・欧州・北米・オーストラリア・南アジアへの幅広いルート網','全路線が国際線。アブダビ経由の乗継需要を取り込むビジネスモデル'],
      fleet:[{name:'B787-9/10',desc:'主力中〜長距離機'},{name:'A350-1000',desc:'最新鋭長距離機'},{name:'B777-300ER',desc:'長距離旗艦機'},{name:'A321neo',desc:'中短距離路線'}]
    },
    training:[
      {title:'型式訓練（Direct Entry）',body:'アブダビのEtihad Aviation Training（EAT）センターで型式訓練。最新鋭のシミュレーター設備。'},
      {title:'生活環境（アブダビ）',body:'ドバイより落ち着いた雰囲気のアブダビ。英語が通じ、インターナショナルスクール・医療施設も充実。'},
      {title:'機長昇格',body:'F/O入社後おおむね4〜8年。Direct Entry Captainも積極採用。評価と空席による。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。国際水準の訓練品質を維持。'},
      {title:'訓練費用',body:'会社が型式訓練費用を負担。ただし一定期間内の退職には返還義務が生じる場合あり。'},
      {title:'言語環境',body:'業務は全て英語。多国籍のクルーと共に飛ぶ国際的な職場環境。'}
    ],
    benefits:[
      {icon:'🚫💰',title:'所得税ゼロ',body:'UAE個人所得税は0%。給与全額が手取り。Emiratesと同じ非課税環境。'},
      {icon:'🏠',title:'住宅手当',body:'会社提供住宅またはポジションに応じた住宅手当。家族向け住居もサポート。'},
      {icon:'🎓',title:'教育手当',body:'子どもの教育費（インターナショナルスクール）の補助。UAE内の選択肢が充実。'},
      {icon:'✈️',title:'帰省チケット',body:'年間確定帰省チケット（ビジネスクラス）。Etihad便での帰国が可能。'},
      {icon:'🏥',title:'医療・歯科保険',body:'パイロット本人・家族向けの包括的医療保険。世界中の提携医療機関で利用可。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償制度。'}
    ],
    hiringStatus:'採用中',
    jobs:[
      {title:'Captain — B787/A350/B777（Direct Entry）',sub:'アブダビベース国際線機長',status:'採用中',statusTag:'blue',
        details:[{k:'必要飛行時間',v:'機長 3,000時間以上'},{k:'英語力',v:'ICAO Level 4以上'},{k:'就労ビザ',v:'Etihad Airways側がサポート'}],
        note:'※ UAE就労ビザはEtihad側がスポンサー。日本国籍保有者の採用実績あり。転職エージェント経由も一般的。'},
      {title:'First Officer — 全機材',sub:'アブダビベース国際線副操縦士',status:'採用中',statusTag:'blue',
        details:[{k:'必要資格',v:'ATPL（凍結可）または CPL+IR'},{k:'必要飛行時間',v:'1,500時間以上'},{k:'雇用形態',v:'Fixed Term → Permanent Contract'}],
        note:''}
    ],
    recruitUrl:'https://www.etihad.com/en/careers/pilots'
  },
  {
    file:'singapore-airlines.html', code:'SIA', color:'#a78bfa',
    nameEn:'Singapore Airlines', nameJa:'シンガポール航空', subtitle:'アジア最高評価のキャリア。充実した手当とワールドクラスの訓練環境。',
    tags:[{cls:'tag-blue',text:'🇸🇬 Singapore'},{cls:'tag-blue',text:'採用中'},{cls:'tag-gray',text:'スターアライアンス'}],
    stats:[{val:'¥3,200万〜4,000万',label:'機長 年収'},{val:'¥1,700万〜2,200万',label:'副操縦士 年収（手当込み）'},{val:'SGD125/h',label:'機長 飛行時間給'},{val:'アジア最高評価',label:'Skytrax等 多数受賞'}],
    overview:['シンガポール航空（SIA）はシンガポール政府系のフラッグキャリアとして1947年の前身から発展し、現在は世界有数のプレミアムキャリアとして知られています。シンガポール国際空港（SIN）をハブとし、世界35カ国・100都市以上に就航するスターアライアンスの主要メンバー。','Skytrax World Airline Awardsで最多受賞歴を誇り、客室・機内サービスの品質で業界最高評価。パイロットとしてもアジアトップクラスの訓練環境と充実した手当が魅力です。シンガポールは英語公用語、低い犯罪率、アジアのハブとして優れた生活環境を提供します。'],
    facts:[{k:'本社',v:'シンガポール'},{k:'設立',v:'1972年（現在の形）'},{k:'ハブ空港',v:'シンガポール国際空港（SIN）'},{k:'就航都市',v:'100都市以上'},{k:'所得税',v:'課税あり（最大22%）'},{k:'退職年齢',v:'62歳（再雇用あり）'}],
    salaryRows:[
      {pos:'機長（シニア）',sub:'ワイドボディ国際線',range:'SGD 285,000〜355,000/年',avg:'¥3,200万〜4,000万',pct:100,color:'#a78bfa',note:'飛行給別途加算',noteTag:'blue'},
      {pos:'副操縦士（F/O）',sub:'手当込み',range:'SGD 150,000〜195,000/年',avg:'¥1,700万〜2,200万',pct:55,color:'#c4b5fd',note:'長距離手当含む',noteTag:'blue'},
    ],
    salaryNote:'💡 SGD/JPY≈112換算。シンガポールには個人所得税がありますが、最大22%と日本より低め。飛行時間給（機長SGD125/h、F/O SGD82/h）が基本給に加算されます。',
    ops:{
      routes:['シンガポール（SIN）から世界100都市以上への国際線ネットワーク','日本（成田・羽田・大阪・名古屋・福岡・札幌）への便数が多く、日本人乗客にも身近なキャリア','オーストラリア・欧州・北米・中東・南アジアへの幅広い路線','全路線が国際線（シンガポールは国内線なし）。乗継需要が大きな収益源'],
      fleet:[{name:'A380',desc:'超長距離旗艦機'},{name:'A350-900/1000',desc:'最新鋭長距離機'},{name:'B777-300ER',desc:'主力長距離機'},{name:'B737-8 MAX',desc:'中短距離路線'}]
    },
    training:[
      {title:'型式訓練',body:'シンガポールのSIA Flight Training Centre（FTC）で実施。世界最新鋭のシミュレーター設備を保有。'},
      {title:'Direct Entry Captain / F/O',body:'既存ライセンス保有者向けのDirect Entry採用。型式訓練後、速やかにライン就航。'},
      {title:'機長昇格',body:'F/O入社後12年以上が目安（厳格な年功序列）。Command Upgradeは完全にシニアリティベース。'},
      {title:'訓練品質',body:'業界最高水準の安全・訓練品質。IOSA認定取得。SIA流のCRM（Crew Resource Management）訓練が充実。'},
      {title:'生活環境',body:'シンガポールは英語公用語のクリーンな都市国家。公共交通機関が発達、医療水準も高い。日本語コミュニティも存在。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。高い技術水準が要求される。'}
    ],
    benefits:[
      {icon:'✈️',title:'SQスタッフトラベル',body:'本人・家族向けのSingapore Airlines便割引・無料航空券。スターアライアンス各社でも一部利用可。'},
      {icon:'🏥',title:'医療・歯科保険',body:'包括的な医療保険。シンガポールの医療水準は非常に高い。家族も対象。'},
      {icon:'🏦',title:'CPF（中央積立基金）',body:'シンガポールの強制的な退職積立制度（CPF）への会社拠出。老後資産の強固な基盤。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償制度。'},
      {icon:'🎓',title:'教育手当',body:'子どもの教育費補助。シンガポールのインターナショナルスクールは世界屈指の教育環境。'},
      {icon:'🌟',title:'世界最高品質の職場',body:'毎年Skytraxで最高評価を受けるキャリアでの勤務。プロとしてのキャリアに大きなブランド価値。'}
    ],
    hiringStatus:'採用中',
    jobs:[
      {title:'Direct Entry Captain / First Officer',sub:'シンガポールベース国際線',status:'採用中',statusTag:'blue',
        details:[{k:'必要飛行時間',v:'機長3,000h/F/O1,500h以上'},{k:'英語力',v:'ICAO Level 4以上'},{k:'就労ビザ',v:'SIAがスポンサー（Employ Pass）'}],
        note:'※ シンガポール就労ビザ（Employment Pass）はSIA側がスポンサー。採用情報はSIA公式採用サイトにて随時確認を。'}
    ],
    recruitUrl:'https://www.singaporeair.com/en_UK/sg/flying-with-us/careers/'
  },
  {
    file:'cathay-pacific.html', code:'CX', color:'#5ec4ff',
    nameEn:'Cathay Pacific', nameJa:'キャセイパシフィック航空', subtitle:'香港フラッグキャリア。厳格な年功序列と充実した手当。',
    tags:[{cls:'tag-blue',text:'🇭🇰 Hong Kong'},{cls:'tag-blue',text:'採用中'},{cls:'tag-gray',text:'ワンワールド'}],
    stats:[{val:'¥2,600万〜4,400万',label:'機長 年収'},{val:'¥1,700万〜2,600万',label:'副操縦士 年収'},{val:'香港',label:'ベース（HKD）'},{val:'ワンワールド',label:'アライアンス'}],
    overview:['キャセイパシフィック航空は1946年創業の香港のフラッグキャリア。香港国際空港（HKG）をハブとし、世界60カ国以上・100都市以上に就航するワンワールドのコアメンバーです。','パイロットの昇格は完全な年功序列（Pure Seniority）。新人として入社してから機長になるまでに通常12年以上かかりますが、その分給与体系は透明でプレディクタブル。Direct Entry F/O採用も積極的で、2025〜2026年は採用ペースが回復傾向にあります。'],
    facts:[{k:'本社',v:'香港（HKG）'},{k:'設立',v:'1946年'},{k:'ハブ空港',v:'香港国際空港（HKG）'},{k:'就航都市',v:'100都市以上'},{k:'所得税',v:'課税あり（最大17%・低率）'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長 Capt.4（シニア）',sub:'B777/A350 ワイドボディ',range:'HKD 1,811,088/年（$232,000）',avg:'約¥4,400万',pct:100,color:'#5ec4ff',note:'生産性給・手当別途',noteTag:'blue'},
      {pos:'機長 Capt.1（新規昇格）',sub:'',range:'HKD 1,372,512/年（$175,000）',avg:'約¥2,600万',pct:59,color:'#5ec4ff',note:'昇格直後',noteTag:'gray'},
      {pos:'副操縦士 FO2',sub:'',range:'HKD 1,073,868/年（$137,000）',avg:'約¥2,600万',pct:59,color:'#93c5fd',note:'生産性給含む',noteTag:'blue'},
      {pos:'副操縦士 FO1（新規）',sub:'',range:'HKD 892,416/年（$114,000）',avg:'約¥1,700万',pct:39,color:'#93c5fd',note:'',noteTag:'gray'},
    ],
    salaryNote:'💡 HKD/JPY≈19換算。香港の個人所得税は最大17%と主要都市の中では低率。生産性給（月額HKD 3,000〜5,000）・滞在手当も別途加算されます。',
    ops:{
      routes:['香港（HKG）から世界100都市以上への国際線ネットワーク','日本（成田・羽田・大阪・名古屋・福岡）への頻繁な直行便','欧州・北米・オーストラリア・中東・東南アジア・南アジアへの幅広い路線','全路線が国際線（香港は国内線なし）'],
      fleet:[{name:'A350-900/1000',desc:'最新鋭長距離旗艦'},{name:'B777-300ER',desc:'主力長距離機'},{name:'B777-200',desc:'中距離国際線'},{name:'A321neo',desc:'地域路線'}]
    },
    training:[
      {title:'型式訓練',body:'香港のCathay Pacific City（HKG隣接）の訓練センターで実施。最新型シミュレーターを保有。'},
      {title:'Pure Seniority System',body:'昇格・機材選択・スケジュール選択は全て年功序列（Seniority Number）で決まる。透明性が高い。'},
      {title:'Second Officer（SO）制度',body:'新卒・飛行時間少ない採用はSecond Officer（SO）から開始。SOとして経験を積んだ後F/Oへ昇格。'},
      {title:'機長昇格（Command）',body:'通常12〜16年以上が必要。完全年功序列のため会社規模・需要に依存するが予測可能。'},
      {title:'定期審査',body:'年1〜2回のプロフィシェンシーチェック。CAD（民用航空処）の基準に準拠。'},
      {title:'生活環境（香港）',body:'英語が公用語のひとつ。日本食・日本語コミュニティも充実。高い生活コストが課題。'}
    ],
    benefits:[
      {icon:'✈️',title:'スタッフトラベル',body:'本人・家族向けの優待航空券。Cathay Pacific・ワンワールド各社での利用可能。'},
      {icon:'🏥',title:'医療・歯科保険',body:'包括的な家族向け医療保険。香港の高水準医療施設が利用可能。'},
      {icon:'🏦',title:'MPF（強制積立制度）',body:'香港の強制退職積立制度（MPF）。会社拠出5%+個人拠出5%。老後資産形成。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上・業務外のライセンス喪失をカバーする収入補償制度。'},
      {icon:'🎓',title:'教育手当',body:'子どもの教育費補助（条件付き）。香港のインターナショナルスクールは世界水準。'},
      {icon:'📅',title:'年次休暇',body:'役職に応じて21〜35日の年次有給休暇。経験年数とともに増加。'}
    ],
    hiringStatus:'採用中',
    jobs:[
      {title:'Direct Entry First Officer（DEFO）',sub:'香港ベース国際線副操縦士',status:'採用中',statusTag:'blue',
        details:[{k:'必要資格',v:'ATPL（有効）または同等の外国ライセンス'},{k:'必要飛行時間',v:'1,500時間以上（マルチエンジン計器飛行）'},{k:'採用プロセス',v:'書類→オンライン面接→シミュレーター選考→香港面接'}],
        note:'※ 2025年11月時点でオンライン面接継続中、2026年1月にシミュレーター選考を予定との情報あり。採用窓口：flightcrew_recruitment@cathaypacific.com'},
      {title:'Second Officer（SO）',sub:'低時間ライセンス保有者向けの入社ルート',status:'確認要',statusTag:'gray',
        details:[{k:'必要資格',v:'ATPL凍結または CPL+IR'},{k:'目安飛行時間',v:'250〜500時間'},{k:'昇格',v:'SOとしての経験後F/Oへ昇格'}],
        note:''}
    ],
    recruitUrl:'https://www.cathaypacific.com/cx/en_HK/careers/work-at-cathay/roles/cabin-crew.html'
  },
  {
    file:'lufthansa.html', code:'LH', color:'#a78bfa',
    nameEn:'Lufthansa', nameJa:'ルフトハンザ', subtitle:'欧州最大の航空グループ。2026年1月に5%賃上げ実施済。',
    tags:[{cls:'tag-green',text:'🇩🇪 Germany'},{cls:'tag-blue',text:'採用中'},{cls:'tag-gray',text:'スターアライアンス'}],
    stats:[{val:'¥4,200万',label:'機長 平均年収'},{val:'¥2,200万',label:'副操縦士 Year10年収'},{val:'EUR266,500',label:'シニア機長 年収'},{val:'スターアライアンス',label:'アライアンス'}],
    overview:['ルフトハンザ（Deutsche Lufthansa AG）は1926年創業のドイツのフラッグキャリアであり、欧州最大の航空グループです。フランクフルト（FRA）とミュンヘン（MUC）をメインハブとし、スターアライアンスの創設メンバーでもあります。','傘下にSwiss International Air Lines、Austrian Airlines、Brussels Airlines、Eurowings等を抱える巨大グループ。2024〜2026年にかけて労働組合（Vereinigung Cockpit: VC）との交渉により大幅な賃上げが実現。2026年1月に5%引き上げにより、シニア機長の年収はEUR 266,500〜279,500に達します。'],
    facts:[{k:'本社',v:'フランクフルト、ドイツ'},{k:'設立',v:'1926年'},{k:'アライアンス',v:'スターアライアンス'},{k:'主要ハブ',v:'フランクフルト（FRA）・ミュンヘン（MUC）'},{k:'所得税',v:'課税あり（最大45%）'},{k:'退職年齢',v:'65歳'}],
    salaryRows:[
      {pos:'機長（Year 1入社直後昇格）',sub:'EUR163,800〜169,000/年',range:'EUR163,800〜179,000',avg:'約¥2,700万〜2,900万',pct:62,color:'#a78bfa',note:'新人機長',noteTag:'gray'},
      {pos:'機長（Year 20・シニア）',sub:'EUR266,500〜279,500/年',range:'EUR266,500〜279,500',avg:'約¥4,300万〜4,600万',pct:100,color:'#a78bfa',note:'2026年1月5%賃上げ後',noteTag:'green'},
      {pos:'副操縦士（Year 10）',sub:'EUR136,500〜143,000/年',range:'EUR136,500〜143,000',avg:'約¥2,200万〜2,300万',pct:51,color:'#c4b5fd',note:'',noteTag:'blue'},
      {pos:'副操縦士（Year 1）',sub:'EUR82,550〜85,800/年',range:'EUR82,550〜85,800',avg:'約¥1,300万〜1,400万',pct:31,color:'#c4b5fd',note:'',noteTag:'gray'},
    ],
    salaryNote:'💡 EUR/JPY≈163換算。ドイツは高い所得税率（最大45%）が課される点に注意。ただし国際線の税免除日当（EUR60〜70/日）が非課税で加算されます。長距離国際線パイロットは年間EUR8,000〜12,000相当の非課税日当を得る場合があります。',
    ops:{
      routes:['フランクフルト（FRA）・ミュンヘン（MUC）から欧州・世界全域への路線網','日本（成田・羽田・大阪）への長距離直行便を運航','欧州域内はEurowings傘下で展開。長距離はLH本体・Swiss・Austrian等が担当','北米・アジア・アフリカ・中東・南米への広大なグローバルネットワーク'],
      fleet:[{name:'B747-8',desc:'旗艦超長距離機'},{name:'A340/A380',desc:'長距離旗艦機（一部）'},{name:'A350-900',desc:'最新鋭長距離機'},{name:'A320/A321neo',desc:'欧州域内・中距離'}]
    },
    training:[
      {title:'Lufthansa Aviation Training (LAT)',body:'世界最大規模の航空訓練機関のひとつ。フランクフルト・ミュンヘン等の訓練センターで実施。'},
      {title:'AB Initio（自社養成）',body:'ゼロから操縦士を養成するAB INITIOプログラム。欧州各地の提携飛行学校で初期訓練を実施。'},
      {title:'型式訓練（Direct Entry）',body:'既存ライセンス保有者の型式訓練。経験年数に応じたポジションでの就航。'},
      {title:'機長昇格',body:'年功序列と実力評価の組み合わせ。通常F/O就航後8〜15年でのUpgrade。'},
      {title:'Vereinigung Cockpit（VC）',body:'ドイツのパイロット組合。給与・労働条件の交渉窓口。2024〜2026年の賃上げも組合交渉の成果。'},
      {title:'定期審査',body:'欧州航空安全機関（EASA）の基準に基づく定期審査。年1〜2回のプロフィシェンシーチェック。'}
    ],
    benefits:[
      {icon:'✈️',title:'スタッフ航空券',body:'本人・家族向けのLufthansaグループ航空券優待。スターアライアンス各社でも部分的に利用可。'},
      {icon:'🏥',title:'ドイツ社会保険',body:'ドイツの充実した公的医療保険・年金制度。高い所得税の見返りとして厚い社会保障。'},
      {icon:'🏦',title:'企業年金',body:'会社が提供する追加年金制度。ドイツの公的年金と組み合わせて老後の安定した収入を確保。'},
      {icon:'💼',title:'欧州での生活',body:'フランクフルト・ミュンヘンは生活インフラが充実。公共交通機関も発達。ドイツ語環境のため語学学習が推奨。'},
      {icon:'📋',title:'ライセンス喪失保険',body:'業務上のライセンス喪失に対する収入補償。ドイツ法に基づく制度。'},
      {icon:'📅',title:'年次休暇',body:'欧州基準の充実した年次有給休暇（30日以上）。ワークライフバランスを重視する欧州文化。'}
    ],
    hiringStatus:'採用中',
    jobs:[
      {title:'First Officer（Direct Entry）',sub:'フランクフルト・ミュンヘンベース',status:'採用中',statusTag:'blue',
        details:[{k:'必要資格',v:'EASA ATPL または同等外国ライセンス'},{k:'必要飛行時間',v:'1,500時間以上（マルチエンジン計器飛行）'},{k:'EU就労資格',v:'EU/EFTA市民権またはビザが必要'}],
        note:'※ EU/EFTA圏外の方は就労ビザが必要。Lufthansa Group採用サイトにて応募可。ドイツ語は必須ではないがあると有利。'},
      {title:'Captain Upgrade（Internal Only）',sub:'社内F/Oからの昇格',status:'内部昇格のみ',statusTag:'gray',
        details:[{k:'昇格方式',v:'年功序列+実力評価'},{k:'目安期間',v:'F/O就航後8〜15年'},{k:'機材選択',v:'Biddingシステム'}],
        note:''}
    ],
    recruitUrl:'https://be-lufthansa.com/en/pilot-careers/'
  },
];

airlines.forEach(a => {
  const html = page(a);
  writeFileSync(new URL(`./airlines/${a.file}`, import.meta.url), html);
  console.log(`Created: ${a.file}`);
});

console.log('All airline pages generated!');
