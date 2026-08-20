import fs from 'fs';
import path from 'path';

const DIR = './airlines';

// ===== SHARED HELPERS =====
function insertBefore(html, marker, content) {
  const idx = html.indexOf(marker);
  if (idx === -1) return html;
  return html.slice(0, idx) + content + html.slice(idx);
}

// ===== EMIRATES EXPANSION =====
function expandEmirates() {
  const fp = path.join(DIR, 'emirates.html');
  let html = fs.readFileSync(fp, 'utf8');

  const newSections = `
  <!-- 手取り比較：ANA vs Emirates -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">手取り比較</div>
    <h2 class="text-2xl font-bold mb-2">エミレーツ vs ANA — 手取り年収の衝撃的な差</h2>
    <p class="text-muted text-sm mb-6">UAE（ドバイ）は個人所得税ゼロ。同じ仕事をしても手取りがANAの約2倍になる仕組みを解説します。</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:#f5c842">エミレーツ（ドバイ）</th><th style="color:#3d9bff">ANA（東京）</th><th>差額</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td style="color:#f5c842" class="font-bold">¥4,500万（非課税）</td>
            <td class="text-accent font-bold">¥2,700万（課税前）</td>
            <td><span class="tag tag-gold">+¥1,800万</span></td>
          </tr>
          <tr>
            <td class="font-semibold">所得税</td>
            <td style="color:#34d399" class="font-bold">ゼロ（UAE個人所得税なし）</td>
            <td class="text-muted">約▲¥530万</td>
            <td><span class="tag tag-green">EK完全有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">住民税</td>
            <td style="color:#34d399" class="font-bold">ゼロ</td>
            <td class="text-muted">約▲¥250万</td>
            <td><span class="tag tag-green">EK完全有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">社会保険料</td>
            <td style="color:#34d399" class="font-bold">ゼロ（一部自己負担あり）</td>
            <td class="text-muted">約▲¥150万</td>
            <td><span class="tag tag-green">EK有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">住宅費（年間）</td>
            <td style="color:#34d399" class="font-bold">会社負担（約¥600万相当）</td>
            <td class="text-muted">自己負担（東京：約¥240万〜）</td>
            <td><span class="tag tag-gold">+¥600万〜</span></td>
          </tr>
          <tr>
            <td class="font-semibold">子弟教育費（子1人）</td>
            <td style="color:#34d399" class="font-bold">会社負担（約¥300万相当）</td>
            <td class="text-muted">自己負担</td>
            <td><span class="tag tag-gold">+¥300万〜</span></td>
          </tr>
          <tr>
            <td class="font-semibold font-bold">実質 手取りパッケージ</td>
            <td style="color:#34d399" class="font-bold text-lg">約¥5,400万〜¥6,000万</td>
            <td class="text-accent font-bold text-lg">約¥1,770万</td>
            <td><span class="font-bold" style="color:#34d399">約3.0〜3.4倍差</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 p-4 rounded-xl text-sm" style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2)">
      <span style="color:#34d399" class="font-semibold">💡 非課税の実力：</span><span class="text-muted"> ANAで同じ手取りを得るには額面¥7,500万〜¥8,000万が必要。エミレーツは「給与の全額が手取り」という圧倒的な優位性を持ちます。</span>
    </div>
  </div>

  <!-- ドバイ生活のリアル -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">ドバイ生活</div>
    <h2 class="text-2xl font-bold mb-2">日本人パイロットが語るドバイ生活の実態</h2>
    <p class="text-muted text-sm mb-6">年収だけが全てではない——ドバイ移住のメリット・デメリットを率直に解説します。</p>
    <div class="grid md:grid-cols-2 gap-6">
      <div>
        <h3 class="font-semibold mb-4" style="color:#34d399">メリット</h3>
        <div class="space-y-3">
          <div class="info-card">
            <div class="font-semibold mb-1">税金ゼロの圧倒的な手取り</div>
            <div class="text-sm text-muted">所得税・住民税・社会保険料が一切かからない。給料の全額が手取りになる唯一の選択肢。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">日本人コミュニティが充実</div>
            <div class="text-sm text-muted">ドバイには約4,000人の日本人が在住。日本語学校・日本食スーパー・日本食レストランが揃い、生活に困らない。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">世界中に飛べる路線</div>
            <div class="text-sm text-muted">150都市以上への国際線。様々な文化・国への路線を担当でき、パイロットとして最高の経験が積める。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">年間42日の有給＋帰省チケット</div>
            <div class="text-sm text-muted">ビジネスクラス確定の帰省チケットが年1回支給。休暇中の日本帰国も苦にならない。</div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="font-semibold mb-4" style="color:#fb923c">デメリット・注意点</h3>
        <div class="space-y-3">
          <div class="info-card">
            <div class="font-semibold mb-1">家族との距離</div>
            <div class="text-sm text-muted">日本に家族を残す場合、長距離別居となる。帯同の場合は子どもの日本語教育・配偶者の仕事問題が課題。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">ドバイの物価・生活費</div>
            <div class="text-sm text-muted">住宅・食費・車は東京並みかそれ以上。会社住宅手当があっても自己負担分が発生することも。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">雇用の安定性リスク</div>
            <div class="text-sm text-muted">2020年コロナ禍では大規模な一時解雇が発生。外資系航空会社の雇用は業績連動で不安定な側面もある。</div>
          </div>
          <div class="info-card">
            <div class="font-semibold mb-1">日本の年金・社会保険の空白</div>
            <div class="text-sm text-muted">海外勤務期間中は日本の厚生年金が停止。帰国後の老後設計を別途考える必要がある。</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">エミレーツ航空パイロット よくある質問（FAQ）</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">エミレーツ航空パイロットの年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長（Captain）の年収は約4,500万円（非課税）、副操縦士（F/O）は約2,250万円（非課税）が目安です。UAEは個人所得税ゼロのため、これが全額手取りになります。住宅手当・教育手当を加えると実質パッケージは5,500万〜6,000万円相当になります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">エミレーツとANAの年収差はどのくらいですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">額面ではエミレーツ機長4,500万円 vs ANA機長2,700万円で約1,800万円の差。ただし手取りで比較するとエミレーツは非課税で4,500万円がそのまま手取りになるのに対し、ANAは税引き後約1,770万円。さらに住宅・教育手当を含めると実質3倍以上の差になります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">日本人パイロットはエミレーツに転職できますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">はい、可能です。エミレーツは世界中のパイロットを積極採用しており、日本人パイロットの採用実績も多数あります。条件はICAO Level 4以上の英語力・ATPL保有・一定の飛行時間（機長は3,000時間以上）です。転職エージェント経由での応募が一般的です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">エミレーツパイロットの機長昇格は何年かかりますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">F/Oとして入社した場合、機長昇格まで5〜8年が目安です。エミレーツは「Direct Entry Captain（即戦力機長）」としての直接採用も盛んで、他社での機長経験者はF/Oを経ずに機長として入社するルートもあります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">ドバイでの生活費はどのくらいかかりますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">ドバイの生活費は東京とほぼ同水準か若干高い程度です。住宅は会社の住宅手当（AED3,600〜4,100/月）でカバーできますが、立地や広さによっては自己負担が発生することも。食費・外食費は東京より高め。日本食食材は「サクラマート」等で入手可能ですが割高です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">エミレーツとカタール航空、どちらの待遇が良いですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">エミレーツ機長4,500万円 vs カタール機長3,800万円で、年収はエミレーツが約700万円高い。どちらも非課税。エミレーツはドバイ、カタールはドーハベースで、生活環境の好みが選択基準になります。エミレーツのほうが規模が大きく日本人パイロットも多い傾向です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">エミレーツ航空を辞めてANAやJALに戻れますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">現時点では、ANA・JALともに外資系からの中途採用（即戦力採用）は公開していません。エミレーツへの転職は基本的に「戻れない一方通行」として覚悟して判断することが推奨されます。ただし国内LCCやフリーランスチャーター会社等への転職は可能な場合があります。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">エミレーツ航空と他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      <a href="ana.html" class="stat-card block text-center hover:border-blue-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">ANA 機長年収</div>
        <div class="font-bold text-xl text-accent">¥2,700万</div>
        <div class="text-xs text-muted mt-1">課税後手取り¥1,770万</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="qatar-airways.html" class="stat-card block text-center hover:border-yellow-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">カタール航空 機長年収</div>
        <div class="font-bold text-xl" style="color:#f5c842">¥3,800万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドーハベース</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="singapore-airlines.html" class="stat-card block text-center hover:border-green-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">シンガポール航空 機長年収</div>
        <div class="font-bold text-xl" style="color:#34d399">¥3,500万〜</div>
        <div class="text-xs text-muted mt-1">低税率 / SINGAポールベース</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
    </div>
    <div class="mt-4 text-center">
      <a href="ana-vs-emirates.html" style="color:#f5c842;font-size:.85rem;text-decoration:none">ANA vs エミレーツ 完全比較ページを見る →</a>
    </div>
  </div>
`;

  html = insertBefore(html, '<footer', newSections);
  // Also expand JSON-LD FAQ
  html = html.replace(
    /\{"@type":"Question","name":"エミレーツ航空のパイロットに転職するには？".*?\}\s*\]\s*\]/s,
    `{"@type":"Question","name":"エミレーツ航空のパイロットに転職するには？","acceptedAnswer":{"@type":"Answer","text":"エミレーツへの転職はICAO Level 4以上の英語力・ATPL・一定の飛行時間（機長3,000時間以上、F/O1,500時間以上）が必要です。転職エージェント（CAE、Parc Aviation等）経由での応募が一般的。日本人の採用実績も多数あります。"}},
        {"@type":"Question","name":"エミレーツとANAの手取り年収差はどのくらいですか？","acceptedAnswer":{"@type":"Answer","text":"エミレーツ機長の手取りは約4,500万円（非課税で全額手取り）、ANAは約1,770万円。差は約2,730万円で、住宅・教育手当を含めた実質パッケージはエミレーツがANAの約3倍になります。"}},
        {"@type":"Question","name":"エミレーツ航空パイロットのドバイ生活の実態は？","acceptedAnswer":{"@type":"Answer","text":"ドバイは日本人コミュニティ（約4,000人）が充実し、日本語学校・日本食スーパーもあります。生活費は東京並みかやや高め。住宅は会社手当でカバーされますが、家族帯同の場合は子どもの教育や配偶者の就労が課題になることがあります。"}}
      ]
    ]`
  );

  fs.writeFileSync(fp, html, 'utf8');
  console.log('✓ emirates');
}

// ===== SINGAPORE AIRLINES EXPANSION =====
function expandSingapore() {
  const fp = path.join(DIR, 'singapore-airlines.html');
  let html = fs.readFileSync(fp, 'utf8');

  const newSections = `
  <!-- 手取り比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">手取り比較</div>
    <h2 class="text-2xl font-bold mb-2">シンガポール航空 vs ANA — 手取り年収の差</h2>
    <p class="text-muted text-sm mb-6">シンガポールの所得税率は最大22%（累進課税）と日本（約35〜45%）より大幅に低い。その差が手取りに直結します。</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:#34d399">シンガポール航空（SIN）</th><th style="color:#3d9bff">ANA（東京）</th><th>差</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td class="font-bold" style="color:#34d399">¥3,500万〜¥4,000万</td>
            <td class="text-accent font-bold">¥2,700万</td>
            <td><span class="tag tag-green">+¥800万〜1,300万</span></td>
          </tr>
          <tr>
            <td class="font-semibold">所得税率（最高）</td>
            <td style="color:#34d399">約22%（シンガポール）</td>
            <td class="text-muted">約45%（日本）</td>
            <td><span class="tag tag-green">SQ有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">機長 手取り（推計）</td>
            <td class="font-bold" style="color:#34d399">約¥2,800万〜¥3,200万</td>
            <td class="text-accent font-bold">約¥1,770万</td>
            <td><span class="font-bold" style="color:#34d399">約1.6〜1.8倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">住宅手当</td>
            <td style="color:#34d399">あり（SGD 4,000〜5,000/月）</td>
            <td class="text-muted">社宅・手当あり</td>
            <td><span class="tag tag-green">SQ有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">生活環境</td>
            <td class="text-muted">英語通用・安全・日本食充実</td>
            <td class="text-muted">母国語・家族近い</td>
            <td><span class="tag tag-gray">好みによる</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- シンガポール生活実態 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">シンガポール生活</div>
    <h2 class="text-2xl font-bold mb-2">シンガポール勤務の実態</h2>
    <div class="grid md:grid-cols-2 gap-6">
      <div>
        <h3 class="font-semibold mb-4" style="color:#34d399">メリット</h3>
        <div class="space-y-3">
          <div class="info-card"><div class="font-semibold mb-1">低税率で手取りが増える</div><div class="text-sm text-muted">最高税率22%。日本の半分程度の税率で、高年収帯でも手取り率が高い。</div></div>
          <div class="info-card"><div class="font-semibold mb-1">アジアのハブ空港</div><div class="text-sm text-muted">チャンギ空港は世界最高水準。全路線が国際線で、多様な路線経験が積める。</div></div>
          <div class="info-card"><div class="font-semibold mb-1">生活環境の良さ</div><div class="text-sm text-muted">英語が公用語で暮らしやすく、日本食・日本語教育環境も充実。治安は世界トップレベル。</div></div>
          <div class="info-card"><div class="font-semibold mb-1">航空会社の信頼性</div><div class="text-sm text-muted">スカイトラックス5スター常連。世界最高水準のサービス・機材で誇りを持って働ける。</div></div>
        </div>
      </div>
      <div>
        <h3 class="font-semibold mb-4" style="color:#fb923c">注意点</h3>
        <div class="space-y-3">
          <div class="info-card"><div class="font-semibold mb-1">物価・生活費が高い</div><div class="text-sm text-muted">シンガポールは東京より生活費が高め。住宅費は会社手当でカバーされるが、全体的な生活コストは要計算。</div></div>
          <div class="info-card"><div class="font-semibold mb-1">採用競争が激しい</div><div class="text-sm text-muted">世界中の優秀なパイロットが集まるアジアのトップキャリア。採用基準は高く書類選考から厳しい。</div></div>
          <div class="info-card"><div class="font-semibold mb-1">ANAへの帰還は困難</div><div class="text-sm text-muted">ANA・JALは現役パイロットの中途採用を原則行っていない。転職は基本的に不可逆の決断。</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">シンガポール航空パイロット よくある質問</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">シンガポール航空パイロットの年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長（Captain）は約¥3,500万〜¥4,000万円（税引前）、副操縦士（F/O）は約¥1,700万〜¥2,200万円が目安です。シンガポールの最高税率は22%（日本の約半分）のため、手取り率が高く実質収入はANAを大幅に上回ります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">シンガポール航空とANA、手取りではどちらが高いですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">シンガポール航空機長の手取りは約¥2,800万〜¥3,200万円（低税率の恩恵あり）、ANAは約¥1,770万円。約1.6〜1.8倍の差があります。住宅手当も加えると実質差はさらに大きくなります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">日本人パイロットはシンガポール航空に転職できますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">はい、可能です。ICAO Level 4以上の英語力・ATPL保有・必要飛行時間を満たせば応募できます。ただし採用競争は非常に厳しく、世界中の優秀なパイロットと競います。転職エージェント経由での応募が一般的です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">シンガポール航空とエミレーツ、どちらが良いですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">年収ではエミレーツが高い（機長4,500万円 vs SQ3,500万〜）ですが、シンガポールの生活環境・文化の多様性・医療体制を評価する人も多い。家族帯同のしやすさはシンガポールが有利な場合が多いです。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">シンガポール航空と他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      <a href="emirates.html" class="stat-card block text-center hover:border-yellow-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">エミレーツ 機長年収</div>
        <div class="font-bold text-xl" style="color:#f5c842">¥4,500万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドバイベース</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="ana.html" class="stat-card block text-center hover:border-blue-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">ANA 機長年収</div>
        <div class="font-bold text-xl text-accent">¥2,700万</div>
        <div class="text-xs text-muted mt-1">課税後手取り¥1,770万</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="qatar-airways.html" class="stat-card block text-center hover:border-orange-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">カタール航空 機長年収</div>
        <div class="font-bold text-xl" style="color:#fb923c">¥3,800万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドーハベース</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
    </div>
  </div>
`;

  html = insertBefore(html, '<footer', newSections);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✓ singapore-airlines');
}

// ===== QATAR AIRWAYS EXPANSION =====
function expandQatar() {
  const fp = path.join(DIR, 'qatar-airways.html');
  let html = fs.readFileSync(fp, 'utf8');

  const newSections = `
  <!-- 手取り比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">手取り比較</div>
    <h2 class="text-2xl font-bold mb-2">カタール航空 vs ANA — 手取り年収の差</h2>
    <p class="text-muted text-sm mb-6">カタール（ドーハ）は個人所得税ゼロ。エミレーツ同様、給料の全額が手取りになります。</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:#fb923c">カタール航空（DOH）</th><th style="color:#3d9bff">ANA（東京）</th><th>差</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td class="font-bold" style="color:#fb923c">¥3,800万（非課税）</td>
            <td class="text-accent font-bold">¥2,700万（課税前）</td>
            <td><span class="tag tag-orange">+¥1,100万</span></td>
          </tr>
          <tr>
            <td class="font-semibold">所得税</td>
            <td style="color:#34d399" class="font-bold">ゼロ（カタール個人所得税なし）</td>
            <td class="text-muted">約▲¥530万</td>
            <td><span class="tag tag-green">QR完全有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">機長 実質手取り</td>
            <td class="font-bold" style="color:#fb923c">約¥4,400万（住宅手当込み）</td>
            <td class="text-accent font-bold">約¥1,770万</td>
            <td><span class="font-bold" style="color:#34d399">約2.5倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">住宅手当</td>
            <td style="color:#34d399">あり（会社提供または手当）</td>
            <td class="text-muted">社宅・手当あり</td>
            <td><span class="tag tag-green">QR有利</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 p-4 rounded-xl text-sm" style="background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.2)">
      <span class="font-semibold" style="color:#fb923c">カタール vs エミレーツ：</span><span class="text-muted"> エミレーツが年収4,500万円に対してカタールは3,800万円と約700万円低いですが、どちらも非課税で手取りはANAの2〜2.5倍。ドバイとドーハ、どちらの生活が合うかで選択が分かれます。</span>
    </div>
  </div>

  <!-- ドーハ生活の実態 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">ドーハ生活</div>
    <h2 class="text-2xl font-bold mb-2">ドーハ（カタール）勤務の実態</h2>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="info-card"><div class="font-semibold mb-2" style="color:#34d399">✓ 税金ゼロで全額手取り</div><div class="text-sm text-muted">カタールも個人所得税ゼロ。¥3,800万円がそのまま手取りに。</div></div>
      <div class="info-card"><div class="font-semibold mb-2" style="color:#34d399">✓ 世界最高水準の航空会社</div><div class="text-sm text-muted">スカイトラックス「ベストエアライン」を複数回受賞。プロとしての誇りが持てる職場。</div></div>
      <div class="info-card"><div class="font-semibold mb-2" style="color:#34d399">✓ 住宅・車・教育手当完備</div><div class="text-sm text-muted">住宅は会社提供または手当支給。子弟教育費も一定額まで会社負担。</div></div>
      <div class="info-card"><div class="font-semibold mb-2" style="color:#fb923c">⚠ 夏の酷暑</div><div class="text-sm text-muted">ドーハの夏（6〜9月）は気温50度近くに達する。屋外活動は限定的になる。</div></div>
      <div class="info-card"><div class="font-semibold mb-2" style="color:#fb923c">⚠ 文化・生活習慣の違い</div><div class="text-sm text-muted">イスラム文化圏のため飲酒規制あり（一部ホテルのみ可）。生活習慣の適応が必要。</div></div>
      <div class="info-card"><div class="font-semibold mb-2" style="color:#fb923c">⚠ 日本人コミュニティは小さめ</div><div class="text-sm text-muted">ドバイと比べるとドーハの日本人コミュニティは小規模。孤独を感じやすい場合も。</div></div>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">カタール航空パイロット よくある質問</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">カタール航空パイロットの年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長（Captain）は約¥3,800万円（非課税）、副操縦士（F/O）は約¥2,000万円（非課税）が目安です。カタールは個人所得税ゼロのため全額が手取りになります。住宅・教育手当を含めた実質パッケージは¥4,500万円相当になります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">カタール航空とエミレーツ、どちらの年収が高いですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">年収はエミレーツが高く、機長でエミレーツ4,500万円 vs カタール3,800万円と約700万円の差があります。どちらも非課税。ドバイ（エミレーツ）かドーハ（カタール）か、生活環境の好みで選ぶことになります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">カタール航空の機長昇格は何年かかりますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">F/Oとして入社した場合、機長昇格まで5〜8年が目安です。Direct Entry Captainとしての採用も積極的に行っています。他社での機長経験があれば、F/Oを経ずに機長として入社できる可能性があります。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">カタール航空と他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      <a href="emirates.html" class="stat-card block text-center hover:border-yellow-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">エミレーツ 機長年収</div>
        <div class="font-bold text-xl" style="color:#f5c842">¥4,500万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドバイ</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="ana.html" class="stat-card block text-center hover:border-blue-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">ANA 機長年収</div>
        <div class="font-bold text-xl text-accent">¥2,700万</div>
        <div class="text-xs text-muted mt-1">課税後手取り¥1,770万</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="etihad.html" class="stat-card block text-center hover:border-green-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">エティハド 機長年収</div>
        <div class="font-bold text-xl" style="color:#34d399">¥3,500万</div>
        <div class="text-xs text-muted mt-1">非課税 / アブダビ</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
    </div>
  </div>
`;

  html = insertBefore(html, '<footer', newSections);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✓ qatar-airways');
}

// ===== LUFTHANSA EXPANSION =====
function expandLufthansa() {
  const fp = path.join(DIR, 'lufthansa.html');
  let html = fs.readFileSync(fp, 'utf8');

  const newSections = `
  <!-- 手取り比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">手取り比較</div>
    <h2 class="text-2xl font-bold mb-2">ルフトハンザ vs ANA — 年収・手取り比較</h2>
    <p class="text-muted text-sm mb-6">ドイツの所得税率は最大45%と高いが、年収の天井（最大5,000万円）がANAより約2,000万円高い。</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:#f5c842">ルフトハンザ（FRA）</th><th style="color:#3d9bff">ANA（東京）</th><th>差</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td class="font-bold" style="color:#f5c842">¥3,500万〜¥5,000万</td>
            <td class="text-accent font-bold">¥2,700万</td>
            <td><span class="tag tag-gold">+¥800万〜2,300万</span></td>
          </tr>
          <tr>
            <td class="font-semibold">所得税率（最高）</td>
            <td class="text-muted">最高45%（ドイツ）</td>
            <td class="text-muted">最高45%（日本）</td>
            <td><span class="tag tag-gray">ほぼ同等</span></td>
          </tr>
          <tr>
            <td class="font-semibold">機長 手取り（推計）</td>
            <td class="font-bold" style="color:#f5c842">約¥2,200万〜¥3,000万</td>
            <td class="text-accent font-bold">約¥1,770万</td>
            <td><span class="font-bold" style="color:#34d399">約1.2〜1.7倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">年収上限</td>
            <td class="font-bold" style="color:#34d399">¥5,000万（シニア機長）</td>
            <td class="font-bold text-accent">¥3,000万</td>
            <td><span class="tag tag-gold">LH上限が高い</span></td>
          </tr>
          <tr>
            <td class="font-semibold">労働組合の力</td>
            <td style="color:#34d399">非常に強力（Vereinigung Cockpit）</td>
            <td class="text-muted">組合あり</td>
            <td><span class="tag tag-green">LH有利</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">ルフトハンザ航空パイロット よくある質問</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">ルフトハンザ航空パイロットの年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長（Captain）は¥3,500万〜¥5,000万円、副操縦士（F/O）は¥1,500万〜¥2,500万円が目安です。欧州最大の航空会社グループとして、欧州トップクラスの給与水準を誇ります。ドイツの所得税率は高いですが、労働組合（VC）が強く給与・労働条件を守っています。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">ルフトハンザとANAの年収差はどのくらいですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">ルフトハンザ機長は最大5,000万円に対しANAは最大3,000万円。ただしドイツの税率も高いため手取りベースでは差が縮まります。年収の「天井の高さ」がルフトハンザの最大の優位点です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">日本人パイロットはルフトハンザに転職できますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">技術的には可能ですが、ルフトハンザはドイツ語能力が採用の壁となることが多く、英語だけでは難しい場合があります。英語対応のグループ会社（Swiss、Austrian等）への転職のほうが現実的な選択肢です。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">ルフトハンザと他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      <a href="emirates.html" class="stat-card block text-center hover:border-yellow-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">エミレーツ 機長年収</div>
        <div class="font-bold text-xl" style="color:#f5c842">¥4,500万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドバイ</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="ana.html" class="stat-card block text-center hover:border-blue-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">ANA 機長年収</div>
        <div class="font-bold text-xl text-accent">¥2,700万</div>
        <div class="text-xs text-muted mt-1">課税後手取り¥1,770万</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="cathay-pacific.html" class="stat-card block text-center hover:border-green-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">キャセイパシフィック</div>
        <div class="font-bold text-xl" style="color:#34d399">¥4,000万</div>
        <div class="text-xs text-muted mt-1">機長最高 / 香港ベース</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
    </div>
  </div>
`;

  html = insertBefore(html, '<footer', newSections);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✓ lufthansa');
}

// ===== CATHAY PACIFIC EXPANSION =====
function expandCathay() {
  const fp = path.join(DIR, 'cathay-pacific.html');
  let html = fs.readFileSync(fp, 'utf8');

  const newSections = `
  <!-- 手取り比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">手取り比較</div>
    <h2 class="text-2xl font-bold mb-2">キャセイパシフィック vs ANA — 手取り比較</h2>
    <p class="text-muted text-sm mb-6">香港の個人所得税率は最大15%（標準税率）と日本の約3分の1。高年収でも手取り率が非常に高い。</p>
    <div class="overflow-x-auto">
      <table>
        <thead>
          <tr><th>比較項目</th><th style="color:#34d399">キャセイパシフィック（HKG）</th><th style="color:#3d9bff">ANA（東京）</th><th>差</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-semibold">機長 年収（額面）</td>
            <td class="font-bold" style="color:#34d399">¥2,800万〜¥4,000万</td>
            <td class="text-accent font-bold">¥2,700万</td>
            <td><span class="tag tag-green">+¥100万〜1,300万</span></td>
          </tr>
          <tr>
            <td class="font-semibold">所得税率（最高）</td>
            <td style="color:#34d399">最高15%（香港）</td>
            <td class="text-muted">最高45%（日本）</td>
            <td><span class="tag tag-green">CX大幅有利</span></td>
          </tr>
          <tr>
            <td class="font-semibold">機長 手取り（推計）</td>
            <td class="font-bold" style="color:#34d399">約¥2,400万〜¥3,400万</td>
            <td class="text-accent font-bold">約¥1,770万</td>
            <td><span class="font-bold" style="color:#34d399">約1.4〜1.9倍</span></td>
          </tr>
          <tr>
            <td class="font-semibold">住宅費（香港）</td>
            <td class="text-muted">世界最高水準の家賃（一部手当あり）</td>
            <td class="text-muted">東京：高め</td>
            <td><span class="tag tag-orange">香港の方が高い</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 p-4 rounded-xl text-sm" style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2)">
      <span style="color:#34d399" class="font-semibold">香港の税制メリット：</span><span class="text-muted"> 香港の所得税は最大15%と日本の3分の1以下。額面が同じでも手取りが大幅に増える。ただし香港の家賃は世界最高水準なので、生活費との兼ね合いが重要です。</span>
    </div>
  </div>

  <!-- FAQ -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">よくある質問</div>
    <h2 class="text-2xl font-bold mb-6">キャセイパシフィック航空パイロット よくある質問</h2>
    <div class="space-y-4">
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">キャセイパシフィックパイロットの年収はいくらですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">機長（Captain）は¥2,800万〜¥4,000万円、副操縦士（F/O）は¥1,500万〜¥2,200万円が目安です。香港の所得税は最大15%と低く、手取り率はANAを大幅に上回ります。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">キャセイパシフィックとANA、手取りではどちらが多いですか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">キャセイパシフィック機長の手取りは約¥2,400万〜¥3,400万円（香港の低税率の恩恵）、ANAは約¥1,770万円。約1.4〜1.9倍の差があります。ただし香港の生活費、特に住宅費は世界最高水準のため、実質的な豊かさは計算が必要です。</div>
      </details>
      <details class="rounded-xl overflow-hidden" style="background:rgba(17,22,32,.6);border:1px solid rgba(255,255,255,.07)">
        <summary class="p-5 cursor-pointer font-semibold flex items-center justify-between select-none">日本人パイロットはキャセイパシフィックに転職できますか？<span class="text-muted text-xl">+</span></summary>
        <div class="px-5 pb-5 text-sm text-muted leading-relaxed">はい、可能です。ICAO Level 4以上の英語力・ATPL保有・必要飛行時間を満たせば応募できます。日本人パイロットの採用実績があります。ただし政治的な香港情勢のリスクも考慮する必要があります（2020年以降、状況は変化しています）。</div>
      </details>
    </div>
    <style>details summary::-webkit-details-marker{display:none}details[open] summary span{transform:rotate(45deg);display:inline-block;transition:transform .2s}</style>
  </div>

  <!-- 他社比較 -->
  <div class="glass p-8 fade-up">
    <div class="section-badge mb-4">年収比較</div>
    <h2 class="text-2xl font-bold mb-6">キャセイパシフィックと他社の比較</h2>
    <div class="grid md:grid-cols-3 gap-4">
      <a href="emirates.html" class="stat-card block text-center hover:border-yellow-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">エミレーツ 機長年収</div>
        <div class="font-bold text-xl" style="color:#f5c842">¥4,500万</div>
        <div class="text-xs text-muted mt-1">非課税 / ドバイ</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="singapore-airlines.html" class="stat-card block text-center hover:border-green-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">シンガポール航空</div>
        <div class="font-bold text-xl" style="color:#34d399">¥3,500万〜</div>
        <div class="text-xs text-muted mt-1">低税率 / シンガポール</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
      <a href="ana.html" class="stat-card block text-center hover:border-blue-400/40 transition-colors" style="text-decoration:none">
        <div class="text-xs text-muted uppercase tracking-widest mb-2">ANA 機長年収</div>
        <div class="font-bold text-xl text-accent">¥2,700万</div>
        <div class="text-xs text-muted mt-1">手取り¥1,770万 / 東京</div>
        <div class="text-xs text-accent mt-2">詳細を見る →</div>
      </a>
    </div>
  </div>
`;

  html = insertBefore(html, '<footer', newSections);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('✓ cathay-pacific');
}

// ===== FIX STUB PAGES (パイロット情報 only) =====
function fixStubPages() {
  const STUBS = [
    ['korean-air', '大韓航空パイロット年収【2026年最新】機長2,200万〜2,800万円・副操縦士1,100万〜1,600万円 | PILOT VALUE',
      '大韓航空パイロットの年収を解説。機長平均2,500万円・副操縦士1,300万円。ソウルベース・韓国航空会社の給与体系・採用情報。'],
    ['eva-air', 'エバー航空パイロット年収【2026年最新】機長2,000万〜2,800万円・副操縦士1,000万〜1,500万円 | PILOT VALUE',
      'エバー航空パイロットの年収を解説。台湾最高水準・スカイトラックス5スターキャリアの給与体系・採用情報。'],
    ['thai-airways', 'タイ国際航空パイロット年収【2026年最新】機長1,800万〜2,500万円・副操縦士900万〜1,400万円 | PILOT VALUE',
      'タイ国際航空パイロットの年収を解説。バンコクベース・スターアライアンス加盟の給与体系・採用・生活情報。'],
    ['malaysia-airlines', 'マレーシア航空パイロット年収【2026年最新】機長1,800万〜2,400万円・副操縦士900万〜1,300万円 | PILOT VALUE',
      'マレーシア航空パイロットの年収を解説。クアラルンプールベース・ワンワールド加盟キャリアの給与体系・採用情報。'],
    ['air-india', 'エア・インディアパイロット年収【2026年最新】機長1,500万〜2,200万円・副操縦士800万〜1,200万円 | PILOT VALUE',
      'エア・インディアパイロットの年収を解説。タタ傘下で再建中のインド最大フラッグキャリアの給与体系・採用情報。'],
    ['british-airways', 'ブリティッシュエアウェイズパイロット年収【2026年最新】機長3,200万〜4,500万円・副操縦士1,400万〜2,200万円 | PILOT VALUE',
      'ブリティッシュエアウェイズパイロットの年収を解説。欧州トップキャリア・ロンドンベースの給与体系・採用情報。'],
    ['air-france', 'エールフランスパイロット年収【2026年最新】機長3,000万〜4,000万円・副操縦士1,300万〜2,000万円 | PILOT VALUE',
      'エールフランスパイロットの年収を解説。欧州2位のキャリア・パリベースの給与体系・採用情報・生活費比較。'],
    ['qantas', 'カンタス航空パイロット年収【2026年最新】機長3,000万〜4,200万円・副操縦士1,300万〜2,000万円 | PILOT VALUE',
      'カンタス航空パイロットの年収を解説。オーストラリア最大・シドニーベースの給与体系・採用情報・移住メリット。'],
    ['air-canada', 'エア・カナダパイロット年収【2026年最新】機長3,500万〜5,000万円・副操縦士1,500万〜2,500万円 | PILOT VALUE',
      'エア・カナダパイロットの年収を解説。北米上位キャリア・トロントベースの給与体系・採用情報・カナダ移住実態。'],
    ['turkish-airlines', 'ターキッシュエアラインズパイロット年収【2026年最新】機長2,200万〜3,200万円・副操縦士1,100万〜1,700万円 | PILOT VALUE',
      'ターキッシュエアラインズパイロットの年収を解説。イスタンブールベース・世界最多就航都市数を誇るキャリアの給与・採用情報。'],
    ['finnair', 'フィンエアーパイロット年収【2026年最新】機長2,800万〜3,800万円・副操縦士1,300万〜2,000万円 | PILOT VALUE',
      'フィンエアーパイロットの年収を解説。アジア欧州最短ルートを持つフィンランドキャリアの給与体系・採用情報・ヘルシンキ生活。'],
    ['easyjet', 'イージージェットパイロット年収【2026年最新】機長2,500万〜3,200万円・副操縦士1,000万〜1,600万円 | PILOT VALUE',
      'イージージェットパイロットの年収を解説。欧州最大LCCとして驚くほど高い給与体系・採用情報・ベース選択の自由度。'],
    ['ryanair', 'ライアンエアーパイロット年収【2026年最新】機長2,200万〜3,000万円・副操縦士900万〜1,400万円 | PILOT VALUE',
      'ライアンエアーパイロットの年収を解説。世界最大のLCC・ダブリンベースの給与体系・採用情報・契約形態の実態。'],
    ['garuda-indonesia', 'ガルーダ・インドネシア航空パイロット年収【2026年最新】機長1,500万〜2,200万円・副操縦士800万〜1,200万円 | PILOT VALUE',
      'ガルーダ・インドネシア航空パイロットの年収を解説。ジャカルタベース・東南アジア最大の航空会社の給与・採用情報。'],
    ['airasia', 'エアアジアグループパイロット年収【2026年最新】機長1,200万〜1,800万円・副操縦士650万〜1,000万円 | PILOT VALUE',
      'エアアジアグループパイロットの年収を解説。東南アジア最大LCC・クアラルンプールベースの給与体系・採用情報。'],
  ];

  let updated = 0;
  for (const [slug, title, desc] of STUBS) {
    const fp = path.join(DIR, `${slug}.html`);
    if (!fs.existsSync(fp)) { console.log(`  スキップ(なし): ${slug}`); continue; }
    let html = fs.readFileSync(fp, 'utf8');
    // Only update if it's still a stub title
    if (html.includes('パイロット情報 | PILOT VALUE') || html.includes('パイロット情報</title>')) {
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
      html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${desc}"`);
      fs.writeFileSync(fp, html, 'utf8');
      console.log(`  ✓ stub→updated: ${slug}`);
      updated++;
    }
  }
  console.log(`\nスタブページ更新: ${updated}件`);
}

// ===== UPDATE SITEMAP.XML =====
function updateSitemap() {
  const fp = './sitemap.xml';
  let xml = fs.readFileSync(fp, 'utf8');
  const today = '2026-04-15';

  // Add ana-vs-jal if not present
  if (!xml.includes('ana-vs-jal')) {
    const entry = `  <url><loc>https://pilot-value.com/airlines/ana-vs-jal.html</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;
    xml = xml.replace(
      '<url><loc>https://pilot-value.com/airlines/ana.html</loc>',
      entry + '  <url><loc>https://pilot-value.com/airlines/ana.html</loc>'
    );
  }

  // Update lastmod for recently modified pages
  const recentPages = ['ana.html', 'jal.html', 'emirates.html', 'singapore-airlines.html',
    'qatar-airways.html', 'cathay-pacific.html', 'lufthansa.html',
    'delta.html', 'united.html', 'american.html', 'southwest.html', 'etihad.html'];

  for (const page of recentPages) {
    const pattern = new RegExp(`(<url><loc>https://pilot-value\\.com/airlines/${page}</loc><lastmod>)[^<]+(</lastmod>)`, 'g');
    xml = xml.replace(pattern, `$1${today}$2`);
  }

  fs.writeFileSync(fp, xml, 'utf8');
  console.log('✓ sitemap.xml updated');
}

// ===== RUN ALL =====
console.log('=== Phase 1: Major airline page expansions ===');
expandEmirates();
expandSingapore();
expandQatar();
expandLufthansa();
expandCathay();

console.log('\n=== Phase 2: Fix stub page titles/descriptions ===');
fixStubPages();

console.log('\n=== Phase 3: Update sitemap.xml ===');
updateSitemap();

console.log('\n=== 全完了 ===');
