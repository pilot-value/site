import fs from 'fs';
import path from 'path';

const DIR = './airlines';

function insertBefore(html, marker, content) {
  const idx = html.indexOf(marker);
  if (idx === -1) return html;
  return html.slice(0, idx) + content + html.slice(idx);
}

// ===== US AIRLINES SHARED EXPANSION =====
function makeUsExpansion(airline) {
  const map = {
    delta: {
      name: 'デルタ航空', code: 'DL', color: '#e8192c', city: 'アトランタ',
      cap: '¥7,500万〜¥9,000万', fo: '¥3,000万〜¥5,000万',
      capHand: '約¥4,500万〜¥5,200万', foHand: '約¥1,800万〜¥2,900万',
      times: '3.3倍', slug: 'delta',
      links: [['united.html','ユナイテッド航空','¥8,500万','米国3位'],['american.html','アメリカン航空','¥8,000万','米国2位'],['emirates.html','エミレーツ航空','¥4,500万（非課税）','中東トップ']],
      fact: 'デルタ航空の機長年収は最高9,000万円——ANAの機長が15〜18年かけて到達する2,700万円と比べ、3倍以上の開きがあります。',
      why: '米国パイロット不足が続く中、強力な労働組合（ALPA）が毎年大幅な賃上げ交渉に成功しており、2023年以降のCBA（労働協約）で年収が急上昇しました。',
    },
    united: {
      name: 'ユナイテッド航空', code: 'UA', color: '#1a56ff', city: 'シカゴ',
      cap: '¥6,800万〜¥8,500万', fo: '¥2,800万〜¥4,800万',
      capHand: '約¥4,000万〜¥5,000万', foHand: '約¥1,600万〜¥2,800万',
      times: '3.0倍', slug: 'united',
      links: [['delta.html','デルタ航空','¥9,000万','米国1位'],['american.html','アメリカン航空','¥8,000万','米国2位'],['emirates.html','エミレーツ航空','¥4,500万（非課税）','中東トップ']],
      fact: 'ユナイテッド航空の機長年収は最高8,500万円——ANAの約3倍です。世界最大のハブ空港（シカゴ・デンバー）を拠点に、太平洋路線では日本路線を多数運航しています。',
      why: 'ALPAの強力な交渉力と米国のパイロット不足が重なり、2023〜2024年の新CBAで大幅な賃上げが実現。太平洋路線手当でさらに上乗せされます。',
    },
    american: {
      name: 'アメリカン航空', code: 'AA', color: '#0078d2', city: 'ダラス',
      cap: '¥6,500万〜¥8,000万', fo: '¥2,500万〜¥4,500万',
      capHand: '約¥3,800万〜¥4,600万', foHand: '約¥1,400万〜¥2,600万',
      times: '3.0倍', slug: 'american',
      links: [['delta.html','デルタ航空','¥9,000万','米国1位'],['united.html','ユナイテッド航空','¥8,500万','米国2位'],['emirates.html','エミレーツ航空','¥4,500万（非課税）','中東トップ']],
      fact: 'アメリカン航空の機長年収は最高8,000万円——世界最多の路線網を持つ米国最大の航空会社として、ANA機長の約3倍の年収水準を実現しています。',
      why: '米国航空会社は強力な労働組合（ALPA）が年収を守り続けており、パイロット不足が深刻な現在、採用・待遇ともに過去最高水準が続いています。',
    },
    southwest: {
      name: 'サウスウエスト航空', code: 'WN', color: '#f5b800', city: 'ダラス',
      cap: '¥5,500万〜¥7,000万', fo: '¥2,000万〜¥3,500万',
      capHand: '約¥3,200万〜¥4,000万', foHand: '約¥1,100万〜¥2,000万',
      times: '2.6倍', slug: 'southwest',
      links: [['delta.html','デルタ航空','¥9,000万','米国1位'],['united.html','ユナイテッド航空','¥8,500万','米国2位'],['american.html','アメリカン航空','¥8,000万','米国3位']],
      fact: 'サウスウエスト航空は「LCC（格安航空会社）」でありながら機長年収最高7,000万円——ANAの2.5倍以上。LCCなのに高待遇な理由があります。',
      why: 'サウスウエストはLCCですが「全員正規社員・高待遇・強い労働組合」という独自モデル。国内線のみで運航するため飛行頻度が高く、飛行時間手当が積み上がります。',
    },
  };
  const d = map[airline];

  return `
  <!-- ANA比較テーブル -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">ANA比較</div>
    <h2 class="text-2xl font-bold mb-2">${d.name} vs ANA — 年収・手取りの差</h2>
    <p class="text-muted text-sm mb-4">${d.fact}</p>
    <p class="text-muted text-sm mb-6">${d.why}</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:${d.color}">${d.name}</th><th style="color:#3d9bff">ANA（日本）</th><th>差</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td class="font-bold" style="color:${d.color}">${d.cap}</td>
            <td class="text-accent font-bold">¥2,700万</td>
            <td><span class="tag tag-orange">約${d.times}差</span></td>
          </tr>
          <tr>
            <td class="font-semibold">機長 手取り（推計）</td>
            <td class="font-bold" style="color:${d.color}">${d.capHand}</td>
            <td class="text-accent font-bold">約¥1,770万</td>
            <td><span class="tag tag-orange">約2〜3倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">副操縦士 年収</td>
            <td style="color:${d.color}">${d.fo}</td>
            <td class="text-muted">¥1,400万〜¥1,800万</td>
            <td><span class="tag tag-orange">約2倍以上</span></td>
          </tr>
          <tr>
            <td class="font-semibold">副操縦士 手取り（推計）</td>
            <td style="color:${d.color}">${d.foHand}</td>
            <td class="text-muted">約¥980万〜¥1,230万</td>
            <td><span class="tag tag-orange">約1.5〜2倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">労働組合の力</td>
            <td style="color:#34d399" class="font-bold">ALPA（世界最強水準）</td>
            <td class="text-muted">組合あり（日本基準）</td>
            <td><span class="tag tag-green">米国有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">米国市民権・永住権</td>
            <td class="text-muted">原則必要（一部例外あり）</td>
            <td style="color:#34d399" class="font-bold">不要</td>
            <td><span class="tag tag-blue">ANA有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">勤務地</td>
            <td class="text-muted">${d.city}（米国）</td>
            <td style="color:#34d399" class="font-bold">日本</td>
            <td><span class="tag tag-blue">ANA有利</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 p-4 rounded-xl text-sm" style="background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.2)">
      <span class="font-semibold" style="color:#fb923c">⚠️ 米国航空会社の注意点：</span><span class="text-muted"> 米国の大手3社（デルタ・ユナイテッド・アメリカン）は原則として<strong style="color:#e8edf2">米国市民権または永住権（グリーンカード）</strong>が必要です。日本人パイロットが直接採用されるケースは非常に稀で、まずエミレーツ等の外資系でキャリアを積むルートが現実的です。</span>
    </div>
  </div>

  <!-- なぜ米国は高いのか -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">高給の理由</div>
    <h2 class="text-2xl font-bold mb-2">なぜ米国パイロットの年収はANAの3倍なのか</h2>
    <div class="grid md:grid-cols-2 gap-4 mt-4">
      <div class="info-card">
        <div class="text-2xl mb-2">✊</div>
        <div class="font-semibold mb-1">ALPA（米国パイロット協会）の強力な交渉力</div>
        <div class="text-sm text-muted">米国最大の航空労働組合ALPAが年収・労働条件を強力に守る。ストライキ権を背景に航空会社側が大幅な賃上げを余儀なくされている。</div>
      </div>
      <div class="info-card">
        <div class="text-2xl mb-2">✈️</div>
        <div class="font-semibold mb-1">深刻なパイロット不足</div>
        <div class="text-sm text-muted">米国では2020年代に入り定年退職するパイロットが急増。需給ギャップが拡大し、航空会社がパイロット確保のため年収を大幅に引き上げている。</div>
      </div>
      <div class="info-card">
        <div class="text-2xl mb-2">📋</div>
        <div class="font-semibold mb-1">1,500時間ルール（Airline Hiring Rule）</div>
        <div class="text-sm text-muted">米国は航空会社パイロットに1,500時間の飛行経験を義務付け。訓練コストが高く、その分年収も高く設定される。</div>
      </div>
      <div class="info-card">
        <div class="text-2xl mb-2">💰</div>
        <div class="font-semibold mb-1">飛行時間あたり報酬（Pay Per Hour）</div>
        <div class="text-sm text-muted">米国は飛行時間1時間あたりの報酬が日本の3〜5倍。月80〜90時間飛ぶと基本給以外の飛行手当だけで数百万円に達する。</div>
      </div>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">${d.name}パイロット よくある質問</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">${d.name}のパイロット年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長で${d.cap}、副操縦士で${d.fo}が目安です。米国の強力な労働組合ALPAと慢性的なパイロット不足が重なり、2023〜2024年のCBA（労働協約）更新で大幅な賃上げが実現しました。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">${d.name}とANA、年収差はどのくらいですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長の額面年収はANA2,700万円に対し${d.name}は最高${d.cap.split('〜')[1]}で約${d.times}の差があります。手取りベースでは米国の所得税（連邦税＋州税）が加わるため差は縮まりますが、それでも約2〜3倍の水準です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">日本人パイロットは${d.name}に転職できますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">米国の大手航空会社は原則として米国市民権または永住権（グリーンカード）が必要です。日本国籍のみでの採用は非常に困難です。現実的なルートは、まずエミレーツ・カタール等の外資系でキャリアを積み、米国永住権取得後に転職する方法です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">なぜ米国パイロットの年収はANAの3倍なのですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">①ALPA（米国パイロット協会）の強力な交渉力、②深刻なパイロット不足、③1,500時間ルールによる高訓練コスト、④飛行時間あたり報酬（Pay Per Hour）が日本の3〜5倍——この4要素が重なり、米国パイロットの年収は世界最高水準を維持しています。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">${d.name}と他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      ${d.links.map(([href, name, sal, note]) => `<a href="${href}" class="stat-card block text-center hover:border-white/20 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">${name}</div>
        <div class="font-bold text-xl" style="color:#f5c842">${sal}</div>
        <div class="text-xs text-muted mt-1">${note}</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>`).join('\n      ')}
    </div>
    <div class="mt-4 text-center">
      <a href="ana.html" style="color:#3d9bff;font-size:.85rem;text-decoration:none">ANA パイロット年収詳細（手取り・機種別）→</a>
    </div>
  </div>
`;
}

// Apply US expansions
for (const slug of ['delta', 'united', 'american', 'southwest']) {
  const fp = path.join(DIR, `${slug}.html`);
  let html = fs.readFileSync(fp, 'utf8');
  html = insertBefore(html, '<footer', makeUsExpansion(slug));
  fs.writeFileSync(fp, html, 'utf8');
  console.log(`✓ ${slug}`);
}

// ===== CREATE: 外資 vs 国内 まとめページ =====
function createGaikaVsKokusai() {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <script>(function(){var t=localStorage.getItem('pv-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}());</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>外資系 vs 日系パイロット年収比較【2026年最新】ANA・JAL vs エミレーツ・デルタ・シンガポール航空 | PILOT VALUE</title>
  <meta name="description" content="外資系vs日系パイロット年収を完全比較。ANA・JAL機長2,700万円に対し、エミレーツ4,500万（非課税）・デルタ9,000万円・シンガポール3,500万円。転職すべきか残るべきか、手取り・生活・老後まで解説。"/>
  <meta name="keywords" content="外資系 パイロット 年収,日系 外資 パイロット 比較,ANA エミレーツ 転職,パイロット 転職 外資,海外 航空会社 年収"/>
  <meta name="robots" content="index,follow"/>
  <meta property="og:title" content="外資系 vs 日系パイロット年収比較【2026年】ANA・JAL vs 世界の航空会社 | PILOT VALUE"/>
  <meta property="og:description" content="外資系vs日系パイロット年収を完全比較。手取り・生活・老後まで解説。転職すべきか残るべきか。"/>
  <meta property="og:url" content="https://pilot-value.com/airlines/gaishi-vs-nikkei.html"/>
  <meta property="og:type" content="article"/>
  <link rel="canonical" href="https://pilot-value.com/airlines/gaishi-vs-nikkei.html"/>
  <script type="application/ld+json">
  [{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"PILOT VALUE","item":"https://pilot-value.com"},{"@type":"ListItem","position":2,"name":"世界の航空会社一覧","item":"https://pilot-value.com/world-airlines.html"},{"@type":"ListItem","position":3,"name":"外資系 vs 日系パイロット年収比較","item":"https://pilot-value.com/airlines/gaishi-vs-nikkei.html"}]},
  {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
    {"@type":"Question","name":"外資系航空会社と日系航空会社、パイロット年収はどちらが高いですか？","acceptedAnswer":{"@type":"Answer","text":"外資系が圧倒的に高い。エミレーツ機長4,500万円（非課税）、デルタ9,000万円に対し、ANAは2,700万円（課税前）。手取りベースではエミレーツがANAの約2.5倍、デルタが約2.5〜3倍になります。"}},
    {"@type":"Question","name":"日本人パイロットが外資系に転職するには何が必要ですか？","acceptedAnswer":{"@type":"Answer","text":"ICAO Level 4以上の英語力・ATPL保有・必要飛行時間が最低条件です。エミレーツ・カタール・シンガポール航空は日本人の採用実績があります。米国航空会社は原則として永住権が必要です。"}}
  ]}]
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
  <script>tailwind.config={theme:{extend:{colors:{bg:'#0a0c0f',surface:'#111620',raised:'#18212f',accent:'#3d9bff',gold:'#f5c842',orange:'#f97316',text:'#e8edf2',muted:'#6b7d93'},fontFamily:{sans:['Inter','Noto Sans JP','sans-serif']}}}};</script>
  <style>
    *,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}
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
    .btn-ghost{display:inline-flex;align-items:center;gap:8px;padding:11px 24px;border-radius:10px;background:rgba(255,255,255,.07);color:#e8edf2;font-size:.875rem;font-weight:600;border:1px solid rgba(255,255,255,.12);text-decoration:none;transition:background .2s}
    .btn-ghost:hover{background:rgba(255,255,255,.12)}
    .fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s cubic-bezier(.16,1,.3,1)}.fade-up.visible{opacity:1;transform:translateY(0)}
    .stat-card{padding:20px;border-radius:14px;background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)}
    .section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(61,155,255,.10);border:1px solid rgba(61,155,255,.25);font-size:.75rem;font-weight:600;color:#3d9bff;letter-spacing:.08em;text-transform:uppercase}
    table{width:100%;border-collapse:collapse}
    th{font-size:.72rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7d93;padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,.07)}
    td{padding:13px 16px;font-size:.875rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:rgba(255,255,255,.02)}
    .logo-img{height:44px;width:auto;filter:brightness(1.15) drop-shadow(0 0 8px rgba(249,115,22,.5))}
    footer{background:#060809;border-top:1px solid rgba(255,255,255,.05)}
    .info-card{background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;margin-bottom:8px}
    details summary::-webkit-details-marker{display:none}
    details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a0c0f}::-webkit-scrollbar-thumb{background:#18212f;border-radius:3px}
  </style>
  <link rel="stylesheet" href="airline-base.css"/>
</head>
<body class="relative">
<nav id="main-nav">
  <div class="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
    <a href="../index.html"><img src="../assets/logo.png" alt="PILOT VALUE" class="logo-img"/></a>
    <div class="hidden md:flex items-center gap-6">
      <a href="../index.html#compare" class="nav-link">日本 vs 海外</a>
      <a href="../index.html#ranking" class="nav-link">年収ランキング</a>
      <a href="../world-airlines.html" class="nav-link">世界の航空会社一覧</a>
      <a href="../index.html#jobs" class="nav-link">求人情報</a>
      <a href="../community.html" class="nav-link">最新の口コミ</a>
    </div>
    <div class="flex items-center gap-3">
      <button id="theme-toggle" class="theme-toggle" aria-label="ダーク/ライト切替"></button>
      <a href="../world-airlines.html" class="btn-ghost text-sm py-2 px-4 hidden md:inline-flex">← 一覧に戻る</a>
    </div>
  </div>
</nav>

<div style="position:relative;padding:160px 0 80px;overflow:hidden;background:linear-gradient(180deg,rgba(61,155,255,.05) 0%,transparent 60%)">
  <div class="max-w-7xl mx-auto px-6 relative text-center">
    <div class="flex flex-wrap justify-center gap-3 mb-6">
      <span class="tag tag-blue">🇯🇵 日系：ANA・JAL</span>
      <span class="tag" style="background:rgba(255,255,255,.08);color:#e8edf2;border:1px solid rgba(255,255,255,.2)">vs</span>
      <span class="tag tag-gold">🌍 外資系：Emirates・Delta・SQ他</span>
    </div>
    <h1 class="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style="background:linear-gradient(135deg,#3d9bff,#fff,#f5c842);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">外資系 vs 日系<br>パイロット年収 完全比較</h1>
    <p class="text-muted text-lg max-w-2xl mx-auto mb-6">ANA・JAL機長2,700万円に対し、外資系は最大9,000万円。<br>転職すべきか残るべきか——手取り・生活・老後まで徹底解説。</p>
  </div>
</div>

<div class="max-w-7xl mx-auto px-6 pb-24 space-y-10">

  <!-- 全社比較ランキング -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収ランキング</div>
    <h2 class="text-2xl font-bold mb-6">世界の主要航空会社 パイロット年収ランキング（機長）</h2>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>順位</th><th>航空会社</th><th>国・地域</th><th>機長 年収（額面）</th><th>機長 手取り（推計）</th><th>ANA比</th></tr>
        </thead>
        <tbody>
          <tr style="background:rgba(255,215,0,.04)">
            <td class="font-bold text-xl" style="color:#f5c842">🥇</td>
            <td><a href="delta.html" style="color:#f5c842;font-weight:bold;text-decoration:none">デルタ航空</a></td>
            <td class="text-muted">🇺🇸 米国</td>
            <td class="font-bold" style="color:#f5c842">¥7,500万〜¥9,000万</td>
            <td class="font-bold" style="color:#34d399">約¥4,500万〜¥5,200万</td>
            <td><span class="tag tag-orange">約3.3倍</span></td>
          </tr>
          <tr>
            <td class="font-bold text-xl" style="color:#e8edf2">🥈</td>
            <td><a href="united.html" style="color:#e8edf2;font-weight:bold;text-decoration:none">ユナイテッド航空</a></td>
            <td class="text-muted">🇺🇸 米国</td>
            <td class="font-bold" style="color:#e8edf2">¥6,800万〜¥8,500万</td>
            <td style="color:#34d399">約¥4,000万〜¥5,000万</td>
            <td><span class="tag tag-orange">約3.0倍</span></td>
          </tr>
          <tr>
            <td class="font-bold text-xl" style="color:#cd7f32">🥉</td>
            <td><a href="american.html" style="color:#cd7f32;font-weight:bold;text-decoration:none">アメリカン航空</a></td>
            <td class="text-muted">🇺🇸 米国</td>
            <td class="font-bold" style="color:#cd7f32">¥6,500万〜¥8,000万</td>
            <td style="color:#34d399">約¥3,800万〜¥4,600万</td>
            <td><span class="tag tag-orange">約3.0倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">4</td>
            <td><a href="southwest.html" style="color:#f5b800;font-weight:bold;text-decoration:none">サウスウエスト航空</a></td>
            <td class="text-muted">🇺🇸 米国</td>
            <td class="font-bold" style="color:#f5b800">¥5,500万〜¥7,000万</td>
            <td style="color:#34d399">約¥3,200万〜¥4,000万</td>
            <td><span class="tag tag-orange">約2.6倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">5</td>
            <td><a href="emirates.html" style="color:#f5c842;font-weight:bold;text-decoration:none">エミレーツ航空</a></td>
            <td class="text-muted">🇦🇪 UAE</td>
            <td class="font-bold" style="color:#f5c842">¥4,500万（非課税）</td>
            <td class="font-bold" style="color:#f5c842">¥4,500万（全額手取り）</td>
            <td><span class="tag tag-gold">約2.5倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">6</td>
            <td><a href="lufthansa.html" style="color:#f5c842;text-decoration:none">ルフトハンザ航空</a></td>
            <td class="text-muted">🇩🇪 ドイツ</td>
            <td>¥3,500万〜¥5,000万</td>
            <td class="text-muted">約¥2,200万〜¥3,000万</td>
            <td><span class="tag tag-orange">約1.5倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">7</td>
            <td><a href="qatar-airways.html" style="color:#f5c842;text-decoration:none">カタール航空</a></td>
            <td class="text-muted">🇶🇦 カタール</td>
            <td>¥3,800万（非課税）</td>
            <td class="text-muted">¥3,800万（全額手取り）</td>
            <td><span class="tag tag-orange">約2.1倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">8</td>
            <td><a href="cathay-pacific.html" style="color:#34d399;text-decoration:none">キャセイパシフィック</a></td>
            <td class="text-muted">🇭🇰 香港</td>
            <td>¥2,800万〜¥4,000万</td>
            <td class="text-muted">約¥2,400万〜¥3,400万</td>
            <td><span class="tag tag-green">約1.4〜1.9倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">9</td>
            <td><a href="singapore-airlines.html" style="color:#34d399;text-decoration:none">シンガポール航空</a></td>
            <td class="text-muted">🇸🇬 シンガポール</td>
            <td>¥3,200万〜¥4,000万</td>
            <td class="text-muted">約¥2,600万〜¥3,200万</td>
            <td><span class="tag tag-green">約1.5〜1.8倍</span></td>
          </tr>
          <tr>
            <td class="font-bold">10</td>
            <td><a href="etihad.html" style="color:#fb923c;text-decoration:none">エティハド航空</a></td>
            <td class="text-muted">🇦🇪 UAE</td>
            <td>¥3,500万（非課税）</td>
            <td class="text-muted">¥3,500万（全額手取り）</td>
            <td><span class="tag tag-orange">約2.0倍</span></td>
          </tr>
          <tr style="background:rgba(61,155,255,.04)">
            <td class="font-bold" style="color:#3d9bff">—</td>
            <td><a href="ana.html" style="color:#3d9bff;font-weight:bold;text-decoration:none">ANA（全日本空輸）</a></td>
            <td class="text-muted">🇯🇵 日本</td>
            <td class="font-bold text-accent">¥2,700万（課税前）</td>
            <td class="font-bold text-accent">約¥1,770万</td>
            <td><span class="tag tag-gray">基準</span></td>
          </tr>
          <tr style="background:rgba(245,200,66,.03)">
            <td class="font-bold" style="color:#f5c842">—</td>
            <td><a href="jal.html" style="color:#f5c842;font-weight:bold;text-decoration:none">JAL（日本航空）</a></td>
            <td class="text-muted">🇯🇵 日本</td>
            <td class="font-bold" style="color:#f5c842">¥2,700万（課税前）</td>
            <td class="font-bold" style="color:#f5c842">約¥1,770万</td>
            <td><span class="tag tag-gray">基準</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 p-4 rounded-xl text-sm text-muted" style="background:rgba(61,155,255,.07);border:1px solid rgba(61,155,255,.15)">
      ※ 上記は2026年3月時点の参考値。米国は連邦税・州税を考慮した推計手取り。UAE・カタールは個人所得税ゼロのため額面=手取り。
    </div>
  </div>

  <!-- 日系に残るメリット -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">選択基準</div>
    <h2 class="text-2xl font-bold mb-6">外資系 vs 日系——それぞれのリアルなメリット</h2>
    <div class="grid md:grid-cols-2 gap-6">
      <div>
        <h3 class="font-bold text-xl mb-4" style="color:#f5c842">外資系を選ぶ理由</h3>
        <div class="space-y-3">
          <div class="info-card"><div class="font-semibold mb-1" style="color:#34d399">💰 手取りが2〜3倍</div><div class="text-sm text-muted">UAE・米国の非課税・低税率により、同じ仕事でも手取りが圧倒的に増える。</div></div>
          <div class="info-card"><div class="font-semibold mb-1" style="color:#34d399">⚡ 機長昇格が早い</div><div class="text-sm text-muted">エミレーツ・カタールはF/O入社後5〜8年で機長。ANAの15〜18年と比べて大幅に早い。</div></div>
          <div class="info-card"><div class="font-semibold mb-1" style="color:#34d399">🌍 世界最大規模の路線</div><div class="text-sm text-muted">150都市以上・全路線国際線。パイロットとしての経験・視野が格段に広がる。</div></div>
          <div class="info-card"><div class="font-semibold mb-1" style="color:#34d399">✈️ 最新鋭機をすぐ乗れる</div><div class="text-sm text-muted">エミレーツはA380の世界最多保有社。入社後比較的早期に大型機に乗れる機会がある。</div></div>
        </div>
      </div>
      <div>
        <h3 class="font-bold text-xl mb-4 text-accent">日系（ANA・JAL）に残る理由</h3>
        <div class="space-y-3">
          <div class="info-card"><div class="font-semibold mb-1 text-accent">👨‍👩‍👧 家族・親族と日本で暮らせる</div><div class="text-sm text-muted">海外単身赴任・家族帯同の苦労なし。子供の教育・親の介護をすぐできる安心感。</div></div>
          <div class="info-card"><div class="font-semibold mb-1 text-accent">🛡 雇用の安定性</div><div class="text-sm text-muted">2020年コロナ禍でエミレーツは大規模解雇。日系大手は雇用を守り続けた。</div></div>
          <div class="info-card"><div class="font-semibold mb-1 text-accent">🏛 年金・退職金制度</div><div class="text-sm text-muted">厚生年金・企業年金・退職金制度が整備。老後の生活設計が立てやすい。</div></div>
          <div class="info-card"><div class="font-semibold mb-1 text-accent">🔄 日本語で働ける</div><div class="text-sm text-muted">英語の壁なし。日本の文化・習慣の中でストレスなく長く働き続けられる。</div></div>
        </div>
      </div>
    </div>
    <div class="mt-6 p-5 rounded-xl" style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.2)">
      <p class="font-semibold mb-2" style="color:#34d399">結論：正解はない——人生の優先順位で決める</p>
      <p class="text-sm text-muted">「年収・手取り」を最大化したいなら外資系。「家族・安定・老後」を優先するなら日系。どちらが正解かは個人の価値観と家族状況によります。外資系への転職は「不可逆な決断」になりやすい（ANA・JALへの帰還は困難）ため、トータルライフプランで慎重に判断してください。</p>
    </div>
  </div>

  <!-- 個別ページリンク -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">各社詳細</div>
    <h2 class="text-2xl font-bold mb-6">各航空会社の詳細ページ</h2>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${[
        ['ana.html','ANA','#3d9bff','¥2,700万','機長平均 / 日本最大'],
        ['jal.html','JAL','#f5c842','¥2,700万','機長平均 / 5年完了ボーナスあり'],
        ['emirates.html','エミレーツ','#f5c842','¥4,500万（非課税）','機長 / ドバイベース'],
        ['qatar-airways.html','カタール航空','#fb923c','¥3,800万（非課税）','機長 / ドーハベース'],
        ['singapore-airlines.html','シンガポール航空','#34d399','¥3,500万〜','機長 / シンガポール'],
        ['cathay-pacific.html','キャセイパシフィック','#34d399','¥4,000万','機長最高 / 香港'],
        ['lufthansa.html','ルフトハンザ','#f5c842','¥5,000万','機長最高 / 欧州最高水準'],
        ['delta.html','デルタ航空','#e8192c','¥9,000万','機長最高 / 世界最高水準'],
        ['united.html','ユナイテッド航空','#1a56ff','¥8,500万','機長最高 / 米国2位'],
        ['american.html','アメリカン航空','#0078d2','¥8,000万','機長最高 / 米国最大'],
        ['southwest.html','サウスウエスト航空','#f5b800','¥7,000万','機長最高 / LCCなのに高待遇'],
        ['etihad.html','エティハド航空','#34d399','¥3,500万（非課税）','機長 / アブダビ'],
      ].map(([href,name,color,sal,note]) => `<a href="${href}" class="stat-card block hover:border-white/20 transition-colors" style="text-decoration:none">
        <div class="font-bold mb-1" style="color:${color}">${name}</div>
        <div class="font-bold text-lg" style="color:${color}">${sal}</div>
        <div class="text-xs text-muted mt-1">${note}</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>`).join('\n      ')}
    </div>
  </div>

</div>

<footer class="py-10">
  <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
    <a href="../index.html"><img src="../assets/logo.png" alt="PILOT VALUE" class="logo-img h-7 opacity-70"/></a>
    <div class="text-xs text-muted">© 2026 PILOT VALUE. 掲載データは参考値です。</div>
    <a href="../world-airlines.html" class="btn-ghost text-sm py-2 px-4">← 航空会社一覧</a>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,.06);margin-top:20px;padding-top:16px;text-align:center"><div style="display:flex;flex-wrap:wrap;justify-content:center"><a href="../guide.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">ご利用案内</a><a href="../policy.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">運営ポリシー</a><a href="../terms.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">利用規約</a><a href="../privacy.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">プライバシーポリシー</a><a href="../personal-data.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">パーソナルデータの扱い</a><a href="../help.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none;border-right:1px solid rgba(255,255,255,.08)">ヘルプ</a><a href="../sitemap.html" style="color:#6b7d93;font-size:.72rem;padding:5px 14px;text-decoration:none">サイトマップ</a></div></div>
</footer>
<script>
window.addEventListener('scroll',()=>{document.getElementById('main-nav').classList.toggle('scrolled',window.scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}})},{threshold:.01,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));
setTimeout(()=>{document.querySelectorAll('.fade-up:not(.visible)').forEach(el=>el.classList.add('visible'))},300);
</script>
<script src="airline-base.js"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(DIR, 'gaishi-vs-nikkei.html'), html, 'utf8');
  console.log('✓ gaishi-vs-nikkei.html');
}

createGaikaVsKokusai();

// ===== UPDATE SITEMAP =====
function updateSitemap() {
  let xml = fs.readFileSync('./sitemap.xml', 'utf8');
  const today = '2026-04-15';
  const newPages = ['ana-vs-emirates', 'gaishi-vs-nikkei'];
  for (const slug of newPages) {
    if (!xml.includes(slug)) {
      const entry = `  <url><loc>https://pilot-value.com/airlines/${slug}.html</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;
      xml = xml.replace('<url><loc>https://pilot-value.com/airlines/ana-vs-jal.html</loc>', entry + '  <url><loc>https://pilot-value.com/airlines/ana-vs-jal.html</loc>');
    }
  }
  const updatePages = ['delta.html','united.html','american.html','southwest.html'];
  for (const p of updatePages) {
    xml = xml.replace(new RegExp(`(<url><loc>https://pilot-value\\.com/airlines/${p}</loc><lastmod>)[^<]+(</lastmod>)`,'g'), `$1${today}$2`);
  }
  fs.writeFileSync('./sitemap.xml', xml, 'utf8');
  console.log('✓ sitemap.xml updated');
}
updateSitemap();

// ===== TWITTER POSTS =====
const tweets = [
  `【衝撃データ】ANA機長の手取りは月147万円。
でもエミレーツ機長の手取りは月375万円。

同じ「パイロット」なのに手取りが約2.5倍。
さらに住宅・教育手当を含めると実質3倍差になる。

非課税の力がこれほど大きいとは——
詳細はこちら👇
https://pilot-value.com/airlines/ana-vs-emirates.html`,

  `【LCCなのに年収7,000万円の謎】

サウスウエスト航空のパイロット年収は
機長で5,500万〜7,000万円。

ANAの「2.5倍」。
しかも格安航空会社（LCC）。

なぜこんなに高いのか？
答えは「ALPA＋パイロット不足」にある。

👇詳細
https://pilot-value.com/airlines/southwest.html`,

  `日本人パイロットが知らない事実。

ANA機長（15〜18年かけて到達）→手取り月147万
エミレーツF/O（入社即日）→手取り月187万

入社直後のF/Oが
ベテランANA機長を超えている。

これが外資転職の現実。
https://pilot-value.com/airlines/gaishi-vs-nikkei.html`,

  `【ANA vs デルタ 年収比較】

ANA機長：2,700万円（手取り1,770万）
デルタ機長：最大9,000万円（手取り約5,200万）

差：約3.3倍

ただし——デルタは米国永住権が必要。
日本人が直接転職できる外資系はエミレーツ・カタール・シンガポール航空が現実的。

https://pilot-value.com/airlines/delta.html`,

  `「パイロットは安定してる」

確かに。でも知ってほしいのは——

同じ国際線機長が
・日本にいれば手取り147万/月
・ドバイにいれば手取り375万/月

「安定」はANAにある。
「最大の手取り」はエミレーツにある。

どちらを選ぶかは人生観の問題。
https://pilot-value.com/airlines/ana-vs-emirates.html`,
];

fs.writeFileSync('./tweet-bot/batch-tweets.json', JSON.stringify(tweets, null, 2), 'utf8');
console.log(`✓ ${tweets.length}件のツイート生成 → tweet-bot/batch-tweets.json`);

console.log('\n=== Phase 2 完了 ===');
