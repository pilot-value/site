import { TwitterApi } from 'twitter-api-v2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// .env を手動で読み込む
const __dir = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dir, '.env'), 'utf8');
for (const line of envText.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
}

const client = new TwitterApi({
  appKey:        process.env.API_KEY,
  appSecret:     process.env.API_SECRET,
  accessToken:   process.env.ACCESS_TOKEN,
  accessSecret:  process.env.ACCESS_TOKEN_SECRET,
});

// ─── 投稿テンプレート ───────────────────────────────────────────
const tweets = [

  // 【比較系】
  `デルタ航空のシニア機長：年収8,000万円
ANAのシニア機長：年収2,500万円

同じ空を飛んで、同じ命を預かって
3倍以上の差がある。

これは「安すぎる」じゃなくて
「搾取されてる」と言う。

#パイロット年収 #航空業界`,

  `Emirates機長の年収：3,500万円〜（非課税）
Qatar Airways機長の年収：3,000万円〜（非課税）
ANAの機長の年収：約2,200万円（課税後1,400万程度）

中東はタックスフリー。
実質2倍以上の差がある。

日本のパイロットが海外に流れる理由がわかる。

#パイロット転職 #海外転職`,

  `日本 vs 世界 パイロット年収比較（機長）

🇯🇵 ANA：約2,200万円
🇯🇵 JAL：約2,000万円
🇺🇸 Delta：約7,500万円
🇺🇸 United：約6,800万円
🇦🇪 Emirates：約3,500万円（非課税）
🇸🇬 Singapore：約2,800万円

日本のパイロットの給料は
「世界基準で見ると」安すぎる。

詳細 → https://pilot-value.com

#パイロット年収`,

  `副操縦士になるまでにかかるお金

フライトスクール費用：2,000〜3,000万円
訓練期間：最低3〜5年

副操縦士の初年度年収：約1,200万円
手取り：約800万円

投資回収に20〜30年かかる計算。

「パイロットは高給」という幻想、
もうやめませんか。

#パイロット #航空業界の真実`,

  // 【告発系】
  `誰も言わないパイロット不足の本当の理由：

✗ パイロットが少ないから
✓ 給料が安くて海外に転職するから

Emirates・Qatar Airwaysが
積極的に日本人パイロットを採用している。

日本の航空会社が改善しなければ
この流れは止まらない。

#パイロット不足 #航空業界`,

  `LCCパイロットの現実

大手の半分以下の年収
同じ空を飛ぶ
同じ責任を負う

「格安」の代償を
誰が払っているか。

#LCC #パイロット年収 #航空業界`,

  `日本のパイロット訓練費用：約3,000万円
アメリカのパイロット訓練費用：約1,500万円

なぜか日本はフライトスクールも高い。

なり方も難しく
なってからの給料も安い。

それでもパイロットを目指す人たちを
尊敬する。

#パイロット志望 #フライトスクール`,

  // 【データ系】
  `機長昇格までにかかる年数

ANA・JAL：平均15〜20年
Emirates：平均8〜12年
Delta・United：平均7〜10年（状況による）

日本は昇格が遅い
＝副操縦士の安い給料が長く続く

これも日本のパイロットが
海外に行く理由のひとつ。

#パイロット転職 #機長`,

  `パイロットの年収ランキング（機長・推定）

1位 🇺🇸 Delta：¥7,500万
2位 🇺🇸 United：¥6,800万
3位 🇺🇸 American：¥6,200万
4位 🇺🇸 Southwest：¥5,500万
5位 🇦🇪 Emirates：¥3,500万（非課税）

日本最高のANAは何位？

117社の比較 → https://pilot-value.com

#パイロット年収ランキング`,

  `副操縦士 vs 機長の年収差（日本）

ANA副操縦士：約1,500万円
ANA機長：約2,200万円
差額：約700万円

Emirates副操縦士：約2,000万円（非課税）
Emirates機長：約3,500万円（非課税）
差額：約1,500万円

どちらの会社で働くべきか、
データが語っている。

詳細 → https://pilot-value.com/airlines/emirates.html

#パイロット転職`,

  // 【共感系】
  `「パイロットは高収入でいいですね」

訓練費3,000万円
試験何十回
体力・精神的プレッシャー
不規則な生活
家族と過ごせない夜

それでも「高収入」ですか？
世界基準で比べたら？

日本のパイロットはもっと評価されるべき。

#パイロット #航空業界`,

  `パイロット志望の学生へ

自社養成：競争率100倍以上
私費訓練：3,000万円の借金からスタート

それでもなりたい？
なれた後のリアルも知っておいて。

副操縦士初年度手取り：約800万円
機長になれるのは：20年後

海外の選択肢も含めて考えて。

詳細 → https://pilot-value.com

#パイロット志望 #自社養成`,

  `海外で働く日本人パイロットに聞いた

「Emirates転職後、年収が1.8倍になった」
「税金がないから手取りはさらに大きい」
「昇格も早かった」
「後悔していない」

日本に帰る理由がない、と。

詳細 → https://pilot-value.com/airlines/emirates.html

#パイロット転職 #海外転職 #Emirates`,

  // 【教育系】
  `知らないと損するパイロット転職の基礎

必要資格：
・ATPL（航空運送事業操縦士技能証明）
・計器飛行証明
・英語能力（ICAO Level 4以上）
・一定の飛行時間（会社による）

これがあれば
Emirates・Qatar・Singaporeへの転職が現実的に。

詳細 → https://pilot-value.com/world-jobs.html

#パイロット転職 #ATPL`,

  `パイロット転職でおすすめの航空会社3選

1. Emirates（UAE）
年収3,500万〜、非課税、住宅手当あり

2. Qatar Airways（カタール）
年収3,000万〜、非課税、充実した福利厚生

3. Singapore Airlines（シンガポール）
年収2,800万〜、アジア最高クラスの待遇

いずれも日本人パイロットを積極採用中。

詳細 → https://pilot-value.com/world-airlines.html

#パイロット転職 #海外転職`,

];

// ─── 投稿済みインデックスを管理 ───────────────────────────────
import { existsSync, writeFileSync } from 'fs';

const indexFile = join(__dir, '.posted-index.json');
let posted = [];
if (existsSync(indexFile)) {
  try { posted = JSON.parse(readFileSync(indexFile, 'utf8')); } catch {}
}

// 未投稿のものから選ぶ（全部使ったらリセット）
const remaining = tweets.map((_, i) => i).filter(i => !posted.includes(i));
if (remaining.length === 0) {
  posted = [];
  remaining.push(...tweets.map((_, i) => i));
}

const pick = remaining[Math.floor(Math.random() * remaining.length)];
const text = tweets[pick];

// ─── 投稿 ────────────────────────────────────────────────────
try {
  const { data } = await client.v2.tweet(text);
  console.log('✅ 投稿成功！');
  console.log('Tweet ID:', data.id);
  console.log('---');
  console.log(text);
  console.log('---');

  posted.push(pick);
  writeFileSync(indexFile, JSON.stringify(posted));
} catch (err) {
  console.error('❌ 投稿失敗:', err.message || err);
  if (err.data) console.error('詳細:', JSON.stringify(err.data, null, 2));
}
