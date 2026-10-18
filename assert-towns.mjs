/* assert-towns.mjs — 住みやすい街（pv-contrib.js の街の面 ⇄ db/towns.sql）を、手元の本物の保存先につないで歩く（2026-10-16）。

   面の字と呼ぶ口は assert-contrib.mjs の「ソース」が見る。ここでは serve-local.mjs の使い捨ての保存先に本物の SQL
   （db/towns.sql・db/towns.generated.sql）を流し、面とブラウザの外からの呼び出しの両方で確かめる。

   場面 frame（F1・F2）
     F1  使い捨ての保存先が立つ・会員 'a' が入る・会社ページが開く・ページの入口から、今ある面の一覧が開く。
     F2  ブラウザの外から：'a' として submit_town_post（種の街）→ ok・保存先に1行・my_town_posts がその1行を返す。
         ログインしていない人の pv_town_board の返事は {"ok":true,"state":"login"} そのもの。
         ログインしていない人の pv_town_options は、その基地の種の名前を、種の並びで返す。
   場面 sheet（S1〜S3）
     S1  見出し「住みやすい街を追加」・文脈の行は「会社 · 基地」・会社も基地も聞かない・候補は入口の名前を入口の並びで・
         札に下の行（区・ラテン文字の表記）を出さない。
     S2  街の検索：2字打つと、その字を含む候補だけが残る・選ぶと欄に入り、候補が全部戻る・選んだ札に焦点が残り、→ で隣の札へ。
     S2b （--only cathay-pacific）ラテン文字の "tung" で東涌だけが残る・選ぶと「東涌」・保存の通信は town '東涌'。
         どの会社でも：カードの下の行の頭の3字を打つと、そのカードの札が出る。
     S3  会員が選ぶ・チェックする・送る：submit_town_post が1本（会社・基地・街・言葉と、答えたものだけ）・
         「情報を追加しました」と「あなたの投稿」・保存先に1行。読み直して開く：その候補に「あなたの投稿」・選ぶと保存した値・
         ボタンは「匿名で更新する」。
     S3b 街だけを出した会員の一覧に「あなたの投稿はまだありません。」が出ない（ok ok・data-pvc-town ok）。
         何も出していない会員には出る。
     S4  直す：良い点を足す →「情報を更新しました」・良い点の横に「確認待ち」・保存先の text_state は pending。
     S4b 街そのもの：保存後のカードの「自分の回答を見る」から別の候補を選んで送る → 通信に was・行は1つで、新しい街の下。
         入口から開いて同じ変更をすると（was なし）行は2つ ＝ 足すのは直すことではない。
     S4c 「修正」（data-pvc-ctx の付いた押し所）から開いて、戻る → 進むで面へ戻っても、直している途中のまま（通信に was）。
     S5  0 と未回答と読めない字：空の所要時間は通信に入らない（null）・「0」はサーバの文で断られ、その欄に印・打った字は残る。
         月額「20万」（通貨あり）は打ったとおりの字で送られ、サーバの「家賃の月額が正しくありません」・月額の欄に印・「20万」は欄に残る。
         「250,000」は数 250000 で送られ、保存される。
     S6  番地のような街の名前：「保存できませんでした」とサーバの文・打った字は残る。間取り「1-2-3」：その文・間取りの欄に印・家賃の欄は開いたまま。
     S7  届かない：「送れていません」→ 読み直すと、一覧に「住みやすい街の回答が、この端末に残っています。」と「続きを開く」→ 打った内容が戻る → 送れる。
     S8  位置を取らない（navigator.geolocation を数える物に替えて、呼ばれた数は0）・「住所」の欄が無い・
         面は pv_town_board も pv_town_queue も呼ばない（pv_town_board を読むのは、ページの街の欄の1本だけ）。
     S9  打った内容は消えない：自分の投稿のある街 X を、良い点を打ってから選ぶ → 打った字のまま（X の保存した字を上に書かない）・
         「あなたの投稿」「匿名で更新する」→ 送ると X の1行が打った字に。打つ前に選ぶと X の保存した値・自分の投稿の無い街へ移ると空に戻る。
     S10 見出しは送るボタンと同じ決まり：入口から開く →「住みやすい街を追加」。自分の投稿のある街を打つ（・札で選ぶ）→ ボタンが
         「匿名で更新する」になり、見出しは「住みやすい街」。投稿の無い街へ打ち替える → どちらも追加に戻る。
     S11 状態の1行（「これまでの投稿を確認しています…」・読めなかった時の1行）は、390×680 と 1440×820 のどちらでも、開いた面の
         最初の画面に在る（面の中を送らずに・窓の中・面の見える所の中・上に何も重なっていない）（P12.53。前は送るボタンの下）。
     X1  自分の街の投稿の読みが失敗しても（failNext）、月の勤務の入力は保存した値で1回だけ描かれ、読み込み中の行は2度と出ない・
         一覧は今までの2つの状態・街の入力は使える（読み込み中の行は残らない）。読みが止まったままでも、月の勤務はすぐ使える。

   場面 anon（A1〜A7）
     A1  ログインなしで保存：通信は submit_contrib_anon（kind 'town'）・カードに「ログインなしで保存しました。」・
         保存先は預かりに1行だけ（会員の行も、新しい候補も無い）・端末に控えの鍵。
     A1b 預けたのが街だけの人の一覧に「ログインなしで保存した回答があります。」とその2行。
     A2  読み直して開く：預けた投稿が戻る（「あなたの投稿」・値）・直すと預かりの1行が置き換わる・PVContrib.myTowns() もその1件。
     A3  ほかのブラウザ：何も出ない・my_contrib_anon を呼ばない（鍵が無い）・PVContrib.myTowns() は anon で通信なし。
     A4  途中でログイン（預かりの口が1回「無い」と答えた）：login.html?return=…?add=town → 戻ると、打った値のまま・「ログインしました」。
     A5  引き継ぎ：預かりが空になるまで待つ → 本人の投稿・鍵は端末から消える・my_town_posts（PVContrib.myTowns()）が返す。
     A6  2人の会員：a の保存後のカード／a が「修正」で開いた確認待ちの名前が出ているまま、b が同じタブで・ほかのタブで
         ログイン → a のものは出ない・数えない・送らない・街の欄は空・a の名前はページのどこにも無い・打った字は残る。
         ほかのタブで替わったあと、'b' が街を保存して「もう1項目を答える」→「通勤・タクシー」を開いても、a の「修正」の街は
         面の頭の行（「…からの通勤」）にも、ページのどこにも無い。
         ページのほかの鍵の要る欄も同じ：'pay' に開いていた REAL PAY の行は、同じタブで 'b' に替わると、ページのどこにも残らない。
     A7  面を閉じたまま読む人が替わったあとの「修正」（会社ページの街の欄の本物の「修正」を押す）：
         'a' が街を出す → 'b' に替わって入口から開く（'a' の街はどこにも無い）→ 'a' に戻って「修正」を押す → 直す面
         （欄は 'a' の街・「あなたの投稿」・「住みやすい街」・「匿名で更新する」。空の「追加」にならない）。
         'a' の「修正」が欄に残ったまま、ページに何も届かない替わり方で 'b' になる → その「修正」を押す → 'b' の追加の面で、
         'a' の街はページのどこにも無い・何も送らない。続けて 'b' が街を保存して「もう1項目を答える」→「通勤・タクシー」を
         開いても、'a' の街は面の頭の行にも、ページのどこにも無い。

   場面 board（B1〜B11）── 会社ページの街の欄（career-live.js の KIND.towns）⇄ pv_town_board。読む人は本物の呼び出しで作る
     （給与は submit_pay_report・街は面か submit_town_post。給与フォームは歩かない ── P5.5 の手元の給与フォームの確かめは無い）。
     B1  最初の1人から：'pay'（この会社の給与）は空の欄（'empty'・器ごと出ない）→ 'a' が面で候補を選ぶ → 読み直すと
         「人気の居住地」・その街・「回答 1人」。
     B2  'b' が打った名前と良い点：通るまで 'pay' のどこにも無い・'b' の欄に「あなたの投稿」・名前・「確認待ち」→ 運営が名前を通す
         → その街と「回答 1人」（文は無い）→ 文を rev で通す →「良い点」の下にその字。
     B3  並びと数：欄の並び ＝ 返事の並び ＝ 保存先の並び（人数の多い順）・どの「回答 N人」も保存先の count(*)。
     B4  ログインなし／鍵の無い会員／ほかの会社の給与で答えが足りない人：返事の字そのもの・鍵の1行・入口は1つ・
         ほかの人の名前も数も欄に無い（自分の行だけは出る）。
     B6  期限切れ：開く前に切れていれば鍵の1行。開いているあいだも、一覧の字は local / session の保存領域に1つも無い。
     B8  2人の会員：開いている 'pay' が同じタブで・ほかのタブでログアウト → 一覧は消え、鍵の1行・pv_town_board を読み直す
         → 'b' が入る → 'b' の形。
     B9  面はほかの人の回答を読まない：通った会員の名前は候補に無い（ログインなしも 'pay' も同じ候補）・面は pv_town_board を
         呼ばない・'pay' がその名前を打つと、その場で数に入る（保存後のカードに「確認待ち」が無い）。
     B11 保存の合図：街を保存すると、読み直さずに pv_town_board が1本だけ・数が上がる。月の勤務を保存しても読み直さない
         （一覧の節は同じもの）。
     B10 つながっていない（pv_town_board が無い）：欄は「準備中」・入口は見えていて押せる（終わったら関数を戻す）。
   場面 admin（AD1〜AD7）── /admin.html（admin-queue.js）を、手元の運営（'op' ＝ 手元のオーナー）とほかの人で歩く
     AD1 運営の数 ＝ 保存先で数えた確認待ち（名前・文・ステイ先の待ち行列）。会員が面で名前と文を出すと、2つ上がり、2行とも出る。
     AD2 ほかの人には何も無い：会員とログインなしは門だけ・会員の pv_town_queue は forbidden そのもの・待っている名前と文は
         ほかの会員のどの返事にも無い。
     AD3 「承認」を2行に押す → 数が戻る・'pay' の欄にその街と、打ったとおりの字（「20万円」を含む。運営の画面も同じ字）。
     AD4 「追加」→ 街：ログインなしの面の候補に出る・一覧（人気の居住地）には出ない。
     AD5 ログインなしの街は誰の数も上げない・その人がログインすると1つ上がる。
     AD6 ログインなしで足したホテル：運営の数が1つ上がり、誰にも届かない → 「承認」→ オーナーが承認した人（'pilot'）には届き、
         給与の鍵だけの人（'pay'）とオーナーではない運営（'c' ＝ この保存先の中だけで運営の名簿へ）には鍵の返事そのもの。
         承認の前に：同じ確認待ちのホテルに、管理ページの行とオーナーの都市の欄（career-stay.js）が出す押し所は、同じ数・同じ字・
         同じ並び（「承認」「却下」。欄に「公開」「削除」を出さない ── 管理ページは確認待ちを消す口を持たない。P12.53）。
     AD6b オーナーが自分で足した確認待ちのホテル：管理ページの行とオーナーの都市の欄の押し所は同じ（「承認」「却下」。P12.56）。
         欄で「承認」を押すと、サーバーが own_post で断り「自分が出したものは、別の運営が確認します。」── 「公開しました。」は
         出ない・確認待ちのまま・オーナーが承認した人（'pilot'）にも届かない（人が1回見る決まりは、いつもサーバー）。
     AD7 オーナーの2つの一覧：'a' がマイページから FIXTURE の画像で申請 →「申請してきた人」→「画像を見る」→「verified」→
         'a' がホテルを読める・画像と申請は保存先から消える・「会員一覧」で verified →「取り消す」→ 次の読みは鍵。
         「会員一覧」の「verified」も同じ（'b'）。いま verified の人の「見送り」は承認を取り上げない（'pay'・英語の画面）。
         オーナーではない運営（'c'）・ほかの会員（'pay'）・ログインなしには一覧も画像も無く、オーナーの4つの口は門の返事だけ。
     ★証明の画像は、その場でキャンバスに描いた FIXTURE だけ（本物の画像は使わない・ファイルも作らない）。

   入口：ページに入口（data-pvc-open="town" と data-pvc-base を持つもの）が在ればそれを押す（「暮らし・家族」のタブの中に
         在るので、見えていなければ先にそのタブを押す）。無ければ、カードと同じ関数
         （gen-airline-glance.mjs の ledgerTowns・baseCode）から同じ4つの属性を作った入口を差し込んで押す（どちらかを出力に書く）。
         差し込む入口の名前は、サーバの候補の種（db/towns.generated.sql）と字まで同じであることを、先に確かめる。
         ログインから ?add=town で戻るページ（A4）には、ページの台本より先に同じ入口を置く（ページに入口が無い時だけ）。
   場面 tap（T1）── 開いた直後の「暮らし・家族」（街の欄の入口が在るタブ）を、人の速さで押す（WP-polish-b B2・2026-10-18）
     T1  1440×820 と 390×844（指）：ページが最初に描かれてから、社名の下の星の欄に答えが来るまで、「暮らし・家族」のタブは
         1px も動かない（毎フレーム測る）。前は 44px 下がって 26px 上がり、読み終えた直後に押した指が帯の外に落ちていた。
         1440 は、読み終えた瞬間にタブが在った所を、本物の押す・離す（その間 90ms）で押す → 「暮らし・家族」に切り替わる。
         （390 では、最初の画面でこのタブは「情報を追加」の下に隠れていて、帯を送ってから押す ＝ 動かないことだけを見る）

   ★本番にも 3000 番にも1回も通信しない（local-chain.mjs の bring・open。終われば保存先ごと消す）。
   ★手元の会員（serve-local.mjs の MEMBERS）は模擬。ここで通ったことは、本番で通った証拠にはならない。
   ★PV_TOWN_SHOTS=<リポジトリの外のフォルダ> を付けると、面の絵を書き出す（390×680 と 1440×820）。

   実行: node assert-towns.mjs [--scenes frame,sheet,anon,board,admin,tap] [--only <会社>]（既定：全部の場面・jal）
*/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBERS, OTP } from './serve-local.mjs';
import { bring, open, rpcAs, seedOf } from './local-chain.mjs';
import { viewOf } from './pv-airline-view.mjs';
import { ledgerTowns, baseCode } from './gen-airline-glance.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? ' ' + e : ''))); };
const J = (v) => { try { return JSON.stringify(v).slice(0, 500); } catch { return String(v); } };

/* 画面の字（pv-contrib.js の字。ここで字を固定する） */
const HEAD = '住みやすい街を追加';
/* 自分の投稿を直している回の見出し（ボタンが「匿名で更新する」の時 ＝ 保存後のカードの見出しと同じ字。P12.41 a・P12.42） */
const FIX_HEAD = '住みやすい街';
const ADDED = '情報を追加しました';
const MINE = 'あなたの投稿';
const ADD_BTN = '匿名で追加する', UPD_BTN = '匿名で更新する';
const LOGIN_STATE = '{"ok":true,"state":"login"}';
const UPDATED = '情報を更新しました', PENDING = '確認待ち', SAY_NO = '保存できませんでした';
const NONE_YET = 'あなたの投稿はまだありません。';
const LOADING = 'これまでの投稿を確認しています…';
const NOREAD = 'これまでの投稿を読み込めませんでした。このまま送れます（同じ街の投稿があれば、今回の内容に置き換わります）。';
const FAIL_T = '送れていません', KEPT = '住みやすい街の回答が、この端末に残っています。', RESUME = '続きを開く';
/* ログインせずに保存した回（場面 anon）。日数はサーバの写し（pv-contrib.js の HELD_DAYS）を読む */
const HELD_DAYS = +((read('pv-contrib.js').match(/var HELD_DAYS = (\d+);/) || [])[1] || 0);
const SAVED_HELD = 'ログインなしで保存しました。', LIST_HELD = 'ログインなしで保存した回答があります。';
const LIST_HELD_D = ['この端末から確認・修正できます。',
  `ログインすると、あなたの投稿として引き継がれ、会社ごとの集計に入ります。ログインしないままの回答は${HELD_DAYS}日で消えます。`];
const BACK_T = 'ログインしました';
/* 月の勤務の種（X1）：先月・語彙の最初の機種（打ち込まない） */
const FLEET = JSON.parse(read('pv-vocab.json')).fleets.find((x) => !x.retired).code;
const LAST = (() => { const n = new Date(); let y = n.getFullYear(), m = n.getMonth(); if (m === 0) { y -= 1; m = 12; } return { y, m }; })();

const argv = process.argv.slice(2);
const val = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const SCENES = { frame, sheet, anon, board, admin, tap };
const want = (val('--scenes') || Object.keys(SCENES).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const unknown = want.filter((s) => !SCENES[s]);
if (unknown.length) { console.error(`✗ 知らない場面: ${unknown.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
const SLUG = val('--only') || 'jal';
if (!/^[a-z0-9-]+$/.test(SLUG) || !fs.existsSync(path.join(ROOT, 'airlines', SLUG + '.html'))) {
  console.error(`✗ 会社のページが無い: airlines/${SLUG}.html`); process.exit(2);
}
const SHOTS = process.env.PV_TOWN_SHOTS ? path.resolve(process.env.PV_TOWN_SHOTS) : '';
if (SHOTS && (SHOTS + path.sep).startsWith(ROOT)) { console.error('✗ PV_TOWN_SHOTS はリポジトリの外に置く'); process.exit(2); }

/* 入口の4つの属性（カードと同じ関数・同じ並び。ページに入口が在れば、そちらを押す） */
const VIEW = viewOf(SLUG), BASE = baseCode(VIEW);
if (!VIEW.living || !BASE) { console.error(`✗ ${SLUG} には暮らしの台帳か基地が無い（街の面が開かない会社）`); process.exit(2); }
const ENTRY = {
  base: BASE,
  /* 入口の data-pvc-basetext と同じ決め方（gen-airline-glance.mjs の townAdd）── 空港の3字が無い会社（ANA）は街の名前だけ（後ろに空白を残さない） */
  text: [VIEW.base.city, VIEW.base.iata.join('・')].filter(Boolean).join(' '),
  ports: VIEW.living.airports.map((a) => a.iata),
  towns: ledgerTowns(VIEW).map((t) => [t.name, t.sub]),
};
const NAMES = ENTRY.towns.map((t) => t[0]);
/* サーバの候補の種（db/towns.generated.sql の「-- 1.」の行）から、この会社・基地の名前を種の並びで */
const SEED_NAMES = (() => {
  const text = read('db/towns.generated.sql'), i = text.indexOf('\n-- 1.'), j = text.indexOf('\n  ) as v(', i);
  return i < 0 ? [] : text.slice(i, j).split('\n').filter((l) => /^ {4}\(/.test(l))
    .map((l) => [...l.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, () => "'")))
    .filter((r) => r[0] === SLUG && r[1] === BASE).map((r) => r[2]);
})();

const M = Object.fromEntries(MEMBERS.map((m) => [m.key, m]));
const tick = () => new Promise((r) => setTimeout(r, 100));
/* 条件がそろうまで待つ（時間では待たない。ms は上限） */
const until = async (cond, ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    if (await cond()) return true;
    if (Date.now() - t0 > ms) return false;
    await tick();
  }
};
/* 返事の字を、読めれば JSON にしてから書き直す（空白の付け方で比べ損ねない） */
const norm = (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return String(t); } };
/* 検索の字の比べ方（見た目だけ：小文字・空白なし） */
const fold = (s) => String(s).toLowerCase().replace(/[\s　]+/g, '');

let browser = null;
const PAGES = [], BROUGHT = [];

async function scene(title, fn) {
  console.log(`\n════ ${title} ════`);
  await fn();
}

/* 使い捨ての保存先を1つ立て、道具をそろえる。場面ごとに1つ（終われば消す）。 */
async function kit() {
  const L = await bring();
  BROUGHT.push(L);
  if (!browser) browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox'] });
  const base = L.base;
  console.log(`\n手元の保存先 ${base}（使い捨て）・${SLUG}（基地 ${BASE}）`);

  const page = async (o = {}) => { const p = await open(browser, base, { w: 390, h: 680, ...o }); PAGES.push(p); return p; };
  const shut = async (p) => { try { await p.ctx.close(); } catch { /* 閉じられなくても先へ */ } };
  const go = async (p) => {
    await p.page.goto(`${base}/airlines/${SLUG}.html`, { waitUntil: 'load', timeout: 60000 });
    await p.page.waitForFunction(() => !!window.PVContrib
      && [...document.styleSheets].some((s) => s.href && s.href.includes('pv-contrib.css')), { timeout: 30000 });
  };
  /* ページの会社の名前（ページの字。面の写しは読まない） */
  const company = (p) => p.page.evaluate(() => (document.body.getAttribute('data-pvc-name') || '').trim()
    || ((document.querySelector('.hero-airline h1') || {}).textContent || '').trim());
  /* 入口。ページに在ればそれ、無ければ同じ4つの属性の入口を差し込む（どちらだったかを返す） */
  const entry = (p) => p.page.evaluate((e) => {
    if (document.querySelector('[data-pvc-open="town"][data-pvc-base]:not([data-test-entry])')) return 'page';
    if (document.querySelector('[data-test-entry]')) return 'injected';
    const a = document.createElement('a');
    a.href = '?add=town'; a.textContent = '＋住みやすい街を追加';
    a.setAttribute('data-pvc-open', 'town');
    a.setAttribute('data-pvc-base', e.base);
    a.setAttribute('data-pvc-basetext', e.text);
    a.setAttribute('data-pvc-ports', JSON.stringify(e.ports));
    a.setAttribute('data-pvc-towns', JSON.stringify(e.towns));
    a.setAttribute('data-test-entry', '');
    a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9000;min-height:44px;padding:12px;background:#fff';
    document.body.appendChild(a);
    return 'injected';
  }, ENTRY);
  /* 面が開き切って（滑り込みが終わって）、条件がそろうまで */
  const sheetIn = (p, cond, arg) => p.page.waitForFunction((src, a) => {
    const r = document.querySelector('.pvc-root');
    if (!r || r.hidden || !r.classList.contains('is-in')) return false;
    const s = r.querySelector('.pvc-sheet').getBoundingClientRect();
    if (Math.abs(s.right - document.documentElement.clientWidth) > 1 || Math.abs(s.bottom - window.innerHeight) > 1) return false;
    return new Function('r', 'a', src)(r, a);
  }, { timeout: 20000 }, cond, arg);
  const waitTown = (p) => sheetIn(p, `const f = r.querySelector('form[data-pvc-form="town"]'), s = f && f.querySelector('fieldset.pvc-set');
    return !!s && !s.disabled;`);
  const waitList = (p) => sheetIn(p, `const st = r.querySelector('[data-pvc-state]');
    return !!r.querySelector('.pvc-tiles') && !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'));`);
  /* ページの入口は「暮らし・家族」のタブの中に在る ── 見えていなければ、そのタブを押してから入口を押す */
  const openTown = async (p) => {
    const how = await entry(p);
    const sel = how === 'page' ? '[data-pvc-open="town"][data-pvc-base]:not([data-test-entry])' : '[data-test-entry]';
    if (how === 'page' && !(await p.page.$eval(sel, (n) => n.getClientRects().length > 0))) {
      await p.page.click('.pvg-tabs [data-pvg-tab="life"]');
      await p.page.waitForFunction((s) => { const n = document.querySelector(s); return !!n && n.getClientRects().length > 0; }, { timeout: 20000 }, sel);
    }
    await p.page.click(sel);
    await waitTown(p);
    return how;
  };
  /* ページの台本より先に、入口を置いておく（ページに入口が無い時だけ。ログインから ?add=town で戻ってきたページが、
     読み込んだその場で街の面を開けるように ── 面は開く時に入口の4つの属性を読む）。そのタブで開く全部のページに効く。 */
  const early = (p) => p.page.evaluateOnNewDocument((e) => {
    const put = () => {
      if (!document.body || !document.body.getAttribute('data-airline')) return;
      if (document.querySelector('[data-pvc-open="town"][data-pvc-base]')) return;
      const a = document.createElement('a');
      a.href = '?add=town'; a.textContent = '＋住みやすい街を追加';
      a.setAttribute('data-pvc-open', 'town');
      a.setAttribute('data-pvc-base', e.base);
      a.setAttribute('data-pvc-basetext', e.text);
      a.setAttribute('data-pvc-ports', JSON.stringify(e.ports));
      a.setAttribute('data-pvc-towns', JSON.stringify(e.towns));
      a.setAttribute('data-test-entry', '');
      a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9000;min-height:44px;padding:12px;background:#fff';
      document.body.appendChild(a);
    };
    document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') put(); });
  }, ENTRY);
  /* 街の面の見えている形 */
  const face = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), f = r && r.querySelector('form[data-pvc-form="town"]');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const vis = (n) => !!n && n.getClientRects().length > 0;
    const title = r ? tx(r.querySelector('.pvc-title')) : '';
    if (!f) return { title, form: false, saved: !!(r && r.querySelector('[data-pvc-saved]')), chips: [], ctl: {}, labels: [], bad: [], msg: [] };
    const chips = [...f.querySelectorAll('.pvc-towns .pvc-chip')].map((c) => {
      const i = c.querySelector('input'), fc = c.querySelector('.pvc-chip-f');
      return { name: i.value, shown: vis(c), text: fc ? fc.innerText.trim() : '', checked: i.checked,
        mine: vis(fc && fc.querySelector('.pvc-mine')), focus: document.activeElement === i };
    });
    const ctl = {};
    for (const n of f.querySelectorAll('input[name],select[name],textarea[name]')) {
      if (n.name === 'town_pick') continue;
      ctl[n.name] = n.type === 'checkbox' ? n.checked : n.value;
    }
    const send = f.querySelector('button.pvc-send[type="submit"]'), wait = f.querySelector('[data-pvc-wait]');
    return {
      title, form: true, ctx: tx(f.querySelector('.pvc-ctx-line')), chips, ctl,
      labels: [...f.querySelectorAll('label.pvc-label')].map((l) => l.firstChild ? l.firstChild.textContent.trim() : ''),
      bad: [...f.querySelectorAll('[aria-invalid="true"]')].map((n) => n.name),
      msg: [...f.querySelectorAll('[data-pvc-msg]')].map((m) => ({ kind: m.getAttribute('data-pvc-msg'),
        title: tx(m.querySelector('.pvc-msg-t')), text: tx(m.querySelector('.pvc-msg-d')) })),
      send: tx(send), sendOff: !!(send && send.disabled), wait: vis(wait) ? tx(wait) : '',
      tag: vis(f.querySelector('#pvc-l-town .pvc-mine')),
      rentOpen: vis(f.querySelector('#pvc-fold-rent')), tripOpen: vis(f.querySelector('#pvc-fold-trip')),
      focusName: document.activeElement ? (document.activeElement.name || '') + ':' + (document.activeElement.value || '') : '',
    };
  });
  /* 保存後のカード */
  const card = (p) => p.page.evaluate(() => {
    const c = document.querySelector('.pvc-root [data-pvc-saved]');
    if (!c) return null;
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const rows = {};
    for (const x of c.querySelectorAll('.pvc-sum-r')) {
      const v = x.querySelector('.pvc-sum-v'), k = x.querySelector('.pvc-sum-k .pvc-mine');
      rows[x.getAttribute('data-k')] = { v: tx(v), none: v.classList.contains('is-none'), wait: k ? tx(k) : '' };
    }
    return { head: tx(c.querySelector('.pvc-saved-h')), sub: tx(c.querySelector('.pvc-saved-s')),
      mine: !!c.querySelector('.pvc-saved-s .pvc-mine'), rows };
  });
  /* 街の欄に打つ（空にしてから、キーで打つ） */
  const typeTown = async (p, s) => {
    await p.page.$eval('.pvc-root #pvc-f-town', (n) => { n.focus(); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true })); });
    if (s) await p.page.keyboard.type(s);
  };
  /* 候補の札を押す（札の label を押す ＝ 人が押す所） */
  const pick = async (p, name) => {
    const h = await p.page.evaluateHandle((nm) => [...document.querySelectorAll('.pvc-root .pvc-towns .pvc-chip')]
      .find((c) => c.querySelector('input').value === nm) || null, name);
    const e = h.asElement();
    if (!e) throw new Error(`候補「${name}」の札が無い`);
    await e.click();
    await until(async () => (await face(p)).ctl.town === name, 5000);
  };
  const choose = (p, name, value) => p.page.select(`.pvc-root form[data-pvc-form="town"] select[name="${name}"]`, value);
  const tickOwn = async (p) => {
    const on = await p.page.$eval('.pvc-root input[name="own"]', (n) => n.checked);
    if (!on) await p.page.click('.pvc-root label.pvc-own');
  };
  const sentOf = (p, from = 0, fn = 'submit_town_post') => p.st.sent.filter((s) => s.fn === fn).slice(from);
  /* 送るボタンを押し、保存後のカードか、面の知らせが出るまで待つ。押したあとに出ていった submit_town_post
     （ログインしていない人は fn に submit_contrib_anon）を返す */
  const send = async (p, fn = 'submit_town_post') => {
    const n0 = sentOf(p, 0, fn).length;
    await p.page.click('.pvc-root form[data-pvc-form="town"] .pvc-send[type="submit"]');
    await p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return !!r.querySelector('[data-pvc-saved]') || !!r.querySelector('form[data-pvc-form="town"] .pvc-msg');
    }, { timeout: 20000 });
    return sentOf(p, n0, fn);
  };
  /* 保存先の、その会員の街の投稿（持ち主として読む） */
  const rowsOf = async (who) => (await L.q(
    `select t.name as town, t.state as town_state, s.text_state, s.lived, s.good, s.concern,
            s.rent_amount::text as amount, s.rent_currency as currency, s.trip_mode as mode, s.trip_minutes as minutes
       from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
      where s.author_hash = public.pv_town_hash($1::uuid, $2) order by t.tkey collate "C"`, [M[who].id, SLUG])).rows;
  /* 面を閉じる（Esc）。閉じ切って、面の段が履歴から降りるまで */
  const closeSheet = async (p) => {
    await p.page.keyboard.press('Escape');
    await p.page.waitForFunction(() => {
      const r = document.querySelector('.pvc-root');
      return (!r || !r.classList.contains('is-in')) && !(history.state && history.state.pvc);
    }, { timeout: 20000 });
  };
  /* ページの入口から一覧を開き、件数の読みが（街の読みまで）届くまで。town:false なら、一覧の2つの状態がそろうまで
     （街の読みの状態は待たない ＝ 街の読みが来ない形でも、待ちで止まらずに中身を見られる） */
  const openList = async (p, town = true) => {
    const at = await p.page.evaluate(() => {
      for (const n of document.querySelectorAll('[data-test-hit]')) n.removeAttribute('data-test-hit');
      const n = [...document.querySelectorAll('[data-pvc-open="list"]')].find((x) => x.getClientRects().length);
      if (!n) return false;
      n.setAttribute('data-test-hit', '');
      return true;
    });
    if (!at) throw new Error('ページに一覧の入口が無い');
    await p.page.click('[data-test-hit]');
    await sheetIn(p, `const st = r.querySelector('[data-pvc-state]');
      return !!r.querySelector('.pvc-tiles') && !!st && /^(ok|anon|off|fail) (ok|anon|off|fail)$/.test(st.getAttribute('data-pvc-state'))
        && (!a || !/^(loading|idle)$/.test(st.getAttribute('data-pvc-town') || ''));`, town);
  };
  const listFace = (p) => p.page.evaluate(() => {
    const r = document.querySelector('.pvc-root'), st = r.querySelector('[data-pvc-state]');
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    if (!st) return { state: null, town: null, text: '', msgs: [] };      // 一覧が出ていない（保存後のカードのまま 等）
    return { state: st.getAttribute('data-pvc-state'), town: st.getAttribute('data-pvc-town'), text: st.hidden ? '' : tx(st),
      msgs: [...r.querySelectorAll('.pvc-main > .pvc-msg')].map((m) => ({ text: tx(m.querySelector('.pvc-msg-d')),
        acts: [...m.querySelectorAll('[data-pvc-act]')].map((b) => tx(b)) })) };
  });
  /* 打つ欄（input・textarea）に、空にしてから打つ */
  const typeIn = async (p, name, s) => {
    await p.page.$eval(`.pvc-root form[data-pvc-form="town"] [name="${name}"]`, (n) => {
      n.focus(); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (s) await p.page.keyboard.type(s);
  };
  /* 家賃・通勤の折りたたみを開く（閉じていれば押す） */
  const unfold = async (p, key) => {
    const open = await p.page.$eval(`.pvc-root [data-pvc-fold="${key}"] .pvc-fold-b`, (b) => b.getAttribute('aria-expanded') === 'true');
    if (!open) await p.page.click(`.pvc-root [data-pvc-fold="${key}"] .pvc-fold-b`);
  };
  /* 保存後のカードの「自分の回答を見る」 */
  const edit = async (p) => {
    await p.page.click('.pvc-root [data-pvc-saved] [data-pvc-act="edit"]');
    await waitTown(p);
  };
  const shot = async (p, name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    const f = path.join(SHOTS, `towns-${SLUG}-${name}.png`);
    await p.page.screenshot({ path: f });
    console.log(`  （絵）${f}`);
  };
  /* login.html で、その会員のメールに手元のコードを入れて入る（いま login.html に居る前提）。着いた住所を返す */
  const loginVia = async (p, who) => {
    await p.page.click('button[onclick="showEmailStep()"]');
    await p.page.waitForSelector('#otp-email', { visible: true });
    await p.page.type('#otp-email', M[who].email);
    await p.page.click('#otp-send-btn');
    await p.page.waitForSelector('#otp-code', { visible: true });
    await Promise.all([p.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.page.type('#otp-code', OTP)]);
    return p.page.url();
  };
  /* 読み直さずに、読む人を替える。how 'same' ＝ 同じタブで別の会員のログインを書き、タブへ戻った合図を出す
     ／'tab' ＝ 同じブラウザのほかのタブで書く（こちらのタブには触らない。合図は storage で届く）。 */
  const swap = async (p, who, how) => {
    const s = await seedOf(base, who);
    const put = (x) => { localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session)); localStorage.setItem('pv_user', JSON.stringify(x.pv_user)); };
    if (how === 'same') {
      await p.page.evaluate(put, s);
      await p.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      return;
    }
    const t = await p.ctx.newPage();
    await t.goto(base + '/pv-vocab.json', { waitUntil: 'domcontentloaded' });
    await p.page.bringToFront();                 // 最初のタブを前へ戻す（裏のタブでは、描画に合わせた待ちが進まない）
    await t.evaluate(put, s);
    await t.close();
  };
  /* 保存先：預かりの街の行・会員の街の行の数・街の行の数（候補を含む） */
  const deposits = async () => (await L.q(
    `select airline, payload->>'town' as town, payload->>'good' as good from public.pv_contrib_pending where kind = 'town' order by id`)).rows;
  const count = async (table) => (await L.q(`select count(*)::int as n from public.${table}`)).rows[0].n;
  return { L, base, page, shut, go, company, entry, openTown, waitTown, waitList, face, card, typeTown, pick, choose, tickOwn, send, sentOf, rowsOf, shot,
    closeSheet, openList, listFace, typeIn, unfold, edit, sheetIn, early, loginVia, swap, deposits, count };
}

/* ════ 場面 frame（F1・F2）══════════════════════════════════════ */
async function frame() {
  const K = await kit();
  const { L, base, page, shut, go, company, waitList, rowsOf } = K;
  await scene('F1 手元の保存先・会員の入室・会社ページ・面の一覧', async () => {
    const a = await page({ who: 'a' });
    await go(a);
    const co = await company(a);
    const at = await a.page.evaluate(() => {
      const n = [...document.querySelectorAll('[data-pvc-open="list"]')].find((x) => x.getClientRects().length);
      if (!n) return false;
      n.setAttribute('data-test-hit', '');
      return true;
    });
    if (at) await a.page.click('[data-test-hit]');
    await waitList(a);
    const L1 = await a.page.evaluate(() => ({
      title: document.querySelector('.pvc-root .pvc-title').textContent,
      state: document.querySelector('.pvc-root [data-pvc-state]').getAttribute('data-pvc-state'),
    }));
    ok(at && !!co && L1.title === `${co}に情報を追加` && L1.state === 'ok ok' && a.st.supa.size === 0,
      `F1 使い捨ての保存先（${base}）で、会員 'a' が ${SLUG} のページを開き、ページの入口から面の一覧が開く（「${co}に情報を追加」・自分の投稿の読みは ok ok）`,
      J({ at, co, L1 }));
    await shut(a);
  });
  await scene('F2 ブラウザの外から：保存・自分の分・ログインしていない人の一覧と候補', async () => {
    const T0 = SEED_NAMES[0];
    const r = await rpcAs(base, 'a', 'submit_town_post', { airline: SLUG, base_iata: BASE, town: T0, lang: 'ja' });
    const rows = await rowsOf('a');
    const mine = await rpcAs(base, 'a', 'my_town_posts', { airline: SLUG });
    const posts = mine.body && Array.isArray(mine.body.posts) ? mine.body.posts : null;
    ok(!!T0 && r.status === 200 && r.body && r.body.ok === true && r.body.saved === true && rows.length === 1 && rows[0].town === T0
      && posts && posts.length === 1 && posts[0].town === T0 && posts[0].base === BASE,
      `F2 'a' として submit_town_post（種の街「${T0}」）→ ok・保存先に1行・my_town_posts がその1行を返す`, J({ r: r.body, rows, posts }));
    const g = await rpcAs(base, null, 'pv_town_board', { airline: SLUG, base: BASE });
    const keys = [...String(g.text).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]).join();
    ok(g.status === 200 && norm(g.text) === LOGIN_STATE && keys === 'ok,state',
      `F2 ログインしていない人の pv_town_board の返事は ${LOGIN_STATE} そのもの（鍵は ok と state だけ）`, J({ status: g.status, text: g.text }));
    const o = await rpcAs(base, null, 'pv_town_options', { airline: SLUG, base: BASE });
    ok(o.status === 200 && o.body && o.body.ok === true && J(o.body.towns) === J(SEED_NAMES) && SEED_NAMES.length > 0,
      `F2 ログインしていない人の pv_town_options は、${BASE} の種の名前を種の並びで返す（${SEED_NAMES.join('・')}）`, J(o.body));
  });
}

/* ════ 場面 sheet（S1〜S3）══════════════════════════════════════ */
async function sheet() {
  const K = await kit();
  const { L, base, page, shut, go, company, openTown, waitTown, face, card, typeTown, pick, choose, tickOwn, send, rowsOf, shot,
    closeSheet, openList, listFace, typeIn, unfold, edit, sheetIn } = K;
  ok(J(NAMES) === J(SEED_NAMES) && NAMES.length > 0,
    `入口の街の名前（カードと同じ関数 ledgerTowns）は、サーバの候補の種（db/towns.generated.sql）と字まで同じ・同じ並び（${NAMES.join('・')}）`,
    J({ NAMES, SEED_NAMES }));
  const a = await page({ who: 'a' });
  await go(a);
  const co = await company(a);
  await scene('S1 見出し・文脈の行・候補', async () => {
    const how = await openTown(a);
    console.log(how === 'page' ? '  （入口：ページの入口を押した）'
      : '  （入口：ページに無いので、カードと同じ関数から作った同じ4つの属性の入口を差し込んで押した）');
    const f = await face(a);
    await shot(a, '390-form');
    ok(f.title === HEAD, `S1 見出しは「${HEAD}」`, J(f.title));
    ok(f.ctx === `${co} · ${ENTRY.text}`, `S1 文脈の行は「${co} · ${ENTRY.text}」（会社 · 基地）`, J(f.ctx));
    const asked = Object.keys(f.ctl).filter((n) => /airline|base|company/.test(n));
    ok(asked.length === 0 && !f.labels.some((l) => /会社|基地/.test(l)),
      'S1 会社も基地も聞かない（そう名付いた欄も、そう書いた見出しも無い）', J({ names: Object.keys(f.ctl), labels: f.labels }));
    ok(J(f.chips.map((c) => c.name)) === J(NAMES) && f.chips.every((c) => c.shown && !c.checked && !c.mine),
      `S1 候補は入口の名前を、入口の並びで（${NAMES.join('・')}）・どれも出ていて、どれも選ばれていない`, J(f.chips));
    ok(f.chips.every((c) => c.text === c.name),
      'S1 札に出る字は街の名前だけ（カードの下の行 ── 区・ラテン文字の表記 ── を札に出さない）', J(f.chips.map((c) => c.text)));
    if (SHOTS) {
      const w = await page({ who: 'a', w: 1440, h: 820 });
      await go(w);
      await openTown(w);
      await shot(w, '1440-form');
      await shut(w);
    }
  });

  await scene('S2 街の検索', async () => {
    const src = ENTRY.towns.find((t) => t[1]) || ENTRY.towns[0];
    const typed = (src[1] || src[0]).slice(0, 2);
    const expect = ENTRY.towns.filter((t) => fold(t[0]).includes(fold(typed)) || fold(t[1]).includes(fold(typed))).map((t) => t[0]);
    await typeTown(a, typed);
    const f1 = await face(a);
    const shown = f1.chips.filter((c) => c.shown).map((c) => c.name);
    ok(expect.length > 0 && J(shown) === J(expect),
      `S2 「${typed}」と2字打つと、その字を（名前か、カードの下の行に）含む候補だけが残る（${expect.join('・')}）`, J({ shown, expect }));
    const P = expect[0], next = NAMES[(NAMES.indexOf(P) + 1) % NAMES.length];
    await pick(a, P);
    const f2 = await face(a);
    ok(f2.ctl.town === P && f2.chips.every((c) => c.shown) && f2.chips.find((c) => c.name === P).checked && f2.chips.find((c) => c.name === P).focus,
      `S2 「${P}」を選ぶ → 欄に「${P}」・候補が全部戻る・選んだ札に焦点が残る`, J({ town: f2.ctl.town, chips: f2.chips }));
    await a.page.keyboard.press('ArrowRight');
    await until(async () => (await face(a)).ctl.town === next, 5000);
    const f3 = await face(a);
    ok(f3.ctl.town === next && f3.chips.find((c) => c.name === next).focus && f3.chips.find((c) => c.name === next).checked,
      `S2 → で隣の札（「${next}」）へ移り、欄も「${next}」になる`, J({ town: f3.ctl.town, focus: f3.focusName }));
  });

  await scene('S2b ラテン文字・カードの下の行で探す', async () => {
    const bad = [];
    for (const [name, sub] of ENTRY.towns) {
      if (!sub) continue;
      const t3 = [...sub].slice(0, 3).join('');
      await typeTown(a, t3);
      const f = await face(a);
      const c = f.chips.find((x) => x.name === name);
      if (!c || !c.shown) bad.push({ name, sub, t3, shown: f.chips.filter((x) => x.shown).map((x) => x.name) });
    }
    const subs = ENTRY.towns.filter((t) => t[1]).length;
    ok(bad.length === 0, `S2b カードの下の行の頭の3字を打つと、そのカードの札が出る（下の行のある ${subs} 枚どれも）`, J(bad));
    if (SLUG === 'cathay-pacific') {
      await typeTown(a, 'tung');
      const f = await face(a);
      ok(J(f.chips.filter((c) => c.shown).map((c) => c.name)) === J(['東涌']),
        'S2b （キャセイ）ラテン文字の「tung」で、東涌だけが残る', J(f.chips.filter((c) => c.shown).map((c) => c.name)));
      await pick(a, '東涌');
      ok((await face(a)).ctl.town === '東涌', 'S2b 東涌を選ぶ → 欄に「東涌」', J((await face(a)).ctl.town));
    }
  });

  await scene('S3 会員の保存・読み直し', async () => {
    const T0 = NAMES[0];
    if ((await face(a)).ctl.town !== T0) { await typeTown(a, ''); await pick(a, T0); }
    await choose(a, 'lived', 'now');
    await tickOwn(a);
    const f0 = await face(a);
    ok(f0.send === ADD_BTN && !f0.sendOff, `S3 選んでチェックすると、ボタンは「${ADD_BTN}」で押せる`, J({ send: f0.send, off: f0.sendOff }));
    const sent = await send(a);
    const c = await card(a);
    await shot(a, '390-saved');
    const p = sent[0] && sent[0].p ? sent[0].p : {};
    const keys = Object.keys(p).sort().join();
    ok(sent.length === 1 && keys === 'airline,base_iata,concern,good,lang,lived,lived_to_year,town'
      && p.airline === SLUG && p.base_iata === BASE && p.town === T0 && p.lived === 'now' && p.lang === 'ja'
      && p.lived_to_year === null && p.good === null && p.concern === null,
      `S3 送ると submit_town_post が1本：会社・基地・街「${T0}」・言葉と、答えた住んだ時期だけ（ほかは null ＝ 未回答。家賃・通勤・was の鍵は無い）`, J(sent));
    if (SLUG === 'cathay-pacific') ok(p.town === '東涌', "S2b （キャセイ）保存の通信は town '東涌'", J(p.town));
    ok(c && c.head === ADDED && c.mine && c.rows.town && c.rows.town.v === T0 && c.rows.lived && c.rows.lived.v === 'いま住んでいる',
      `S3 保存後のカードは「${ADDED}」と「${MINE}」・街「${T0}」・住んだ時期「いま住んでいる」`, J(c));
    const rows = await rowsOf('a');
    ok(rows.length === 1 && rows[0].town === T0 && rows[0].lived === 'now',
      `S3 保存先に、'a' の行が1つ（「${T0}」・いま住んでいる）`, J(rows));
    await a.page.reload({ waitUntil: 'load' });
    await a.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await openTown(a);
    const f1 = await face(a);
    const c0 = f1.chips.find((x) => x.name === T0);
    ok(c0 && c0.mine && f1.chips.filter((x) => x.mine).length === 1 && f1.ctl.town === '' && f1.send === ADD_BTN,
      `S3 読み直して開く：「${T0}」の札に「${MINE}」（ほかの札には無い）・欄は空・ボタンは「${ADD_BTN}」`, J({ chips: f1.chips, town: f1.ctl.town, send: f1.send }));
    await pick(a, T0);
    const f2 = await face(a);
    ok(f2.ctl.lived === 'now' && f2.tag && f2.send === UPD_BTN,
      `S3 「${T0}」を選ぶ → 保存した値（いま住んでいる）が入る・欄の見出しに「${MINE}」・ボタンは「${UPD_BTN}」`, J({ lived: f2.ctl.lived, tag: f2.tag, send: f2.send }));
  });

  const [T0, T1, T2] = NAMES;
  await scene('S3b 街だけを出した会員の一覧', async () => {
    await closeSheet(a);
    await openList(a);
    const la = await listFace(a);
    ok(la.state === 'ok ok' && la.town === 'ok' && la.text !== NONE_YET && la.text === '',
      `S3b 街だけを出した 'a' の一覧：「${NONE_YET}」が出ない（data-pvc-state ok ok・data-pvc-town ok）`, J(la));
    const b = await page({ who: 'b' });
    await go(b);
    await openList(b);
    const lb = await listFace(b);
    ok(lb.state === 'ok ok' && lb.town === 'ok' && lb.text === NONE_YET,
      `S3b 何も出していない 'b' の一覧には「${NONE_YET}」が出る`, J(lb));
    await shut(b);
    await closeSheet(a);
  });

  await scene('S4 直す ── 良い点を足す', async () => {
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T0);
    await typeIn(a, 'good', '駅が近くて静か');
    await tickOwn(a);
    const sent = await send(a);
    const c = await card(a), rows = await rowsOf('a');
    ok(sent.length === 1 && sent[0].p.town === T0 && sent[0].p.good === '駅が近くて静か' && !('was' in sent[0].p)
      && c && c.head === UPDATED && c.rows.good && c.rows.good.v === '駅が近くて静か' && c.rows.good.wait === PENDING
      && rows.length === 1 && rows[0].town === T0 && rows[0].text_state === 'pending' && rows[0].good === '駅が近くて静か',
      `S4 「${T0}」に良い点を足して送る →「${UPDATED}」・良い点の横に「${PENDING}」・保存先は1行のまま（text_state pending）`, J({ sent, c, rows }));
  });

  await scene('S4b 街そのものを直す・足すのは直すことではない', async () => {
    await edit(a);
    const f0 = await face(a);
    await pick(a, T1);
    await tickOwn(a);
    const sent = await send(a);
    const rows = await rowsOf('a');
    ok(f0.ctl.town === T0 && sent.length === 1 && sent[0].p.was === T0 && sent[0].p.town === T1
      && rows.length === 1 && rows[0].town === T1,
      `S4b 保存後のカードの「自分の回答を見る」→「${T1}」を選んで送る：通信に was「${T0}」・行は1つで「${T1}」の下`, J({ f0: f0.ctl.town, sent, rows }));
    await closeSheet(a);
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T0);
    await tickOwn(a);
    const s2 = await send(a);
    const r2 = await rowsOf('a');
    ok(s2.length === 1 && !('was' in s2[0].p) && s2[0].p.town === T0 && r2.length === 2 && J(r2.map((r) => r.town).sort()) === J([T0, T1].sort()),
      `S4b 入口から開いて同じ変更（「${T0}」を選んで送る）：通信に was が無く、行は2つ（足すのは、直すことではない）`, J({ s2, r2 }));
    await closeSheet(a);
  });

  await scene('S4c 「修正」から開いて、戻る → 進む', async () => {
    /* 「修正」の押し所（会社ページの街の欄の「修正」と同じ形 ── data-pvc-open="town" と data-pvc-ctx）。ページにまだ無いので差し込む */
    await a.page.evaluate((nm) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = '修正';
      b.setAttribute('data-pvc-open', 'town'); b.setAttribute('data-pvc-ctx', nm); b.setAttribute('data-test-fix', '');
      b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;min-width:88px;min-height:44px';
      document.body.appendChild(b);
    }, T1);
    await a.page.click('[data-test-fix]');
    await waitTown(a);
    const f0 = await face(a);
    await a.page.evaluate(() => history.back());
    await a.page.waitForFunction(() => { const r = document.querySelector('.pvc-root'); return !r.classList.contains('is-in'); }, { timeout: 20000 });
    await a.page.evaluate(() => history.forward());
    await waitTown(a);
    const f1 = await face(a);
    await pick(a, T2);
    await tickOwn(a);
    const sent = await send(a);
    const rows = await rowsOf('a');
    ok(f0.ctl.town === T1 && f1.ctl.town === T1 && sent.length === 1 && sent[0].p.was === T1 && sent[0].p.town === T2
      && J(rows.map((r) => r.town).sort()) === J([T0, T2].sort()),
      `S4c 「修正」（${T1}）から開く → 戻る → 進む：面は直している途中のまま（欄は「${T1}」）・「${T2}」を選んで送ると通信に was「${T1}」・行は「${T0}」「${T2}」`,
      J({ f0: f0.ctl.town, f1: f1.ctl.town, sent, rows }));
    await closeSheet(a);
    await a.page.evaluate(() => { const b = document.querySelector('[data-test-fix]'); if (b) b.remove(); });
  });

  await scene('S5 0 と未回答と読めない字', async () => {
    await openTown(a);
    await typeTown(a, '');
    await pick(a, T1);
    await unfold(a, 'trip');
    await choose(a, 'mode', 'train');
    await tickOwn(a);
    const s1 = await send(a);
    const c1 = await card(a);
    const p1 = s1[0] && s1[0].p;
    ok(s1.length === 1 && p1.trip && p1.trip.mode === 'train' && p1.trip.minutes === null && !p1.rent && c1 && c1.head === ADDED,
      'S5 交通手段だけ選んで所要時間は空のまま送る → 通信の所要時間は null（0 ではない）・家賃の鍵は無い・保存される', J({ s1, head: c1 && c1.head }));
    await edit(a);
    await typeIn(a, 'minutes', '0');
    await tickOwn(a);
    const s2 = await send(a);
    const f2 = await face(a);
    ok(s2.length === 1 && s2[0].p.trip && s2[0].p.trip.minutes === 0
      && f2.msg.length === 1 && f2.msg[0].title === SAY_NO && f2.msg[0].text === '通勤の所要時間は1〜600分で入れてください'
      && J(f2.bad) === J(['minutes']) && f2.ctl.minutes === '0',
      'S5 所要時間に「0」→ 送られるのは 0・サーバの「通勤の所要時間は1〜600分で入れてください」・所要時間の欄に印・「0」は欄に残る', J({ s2, msg: f2.msg, bad: f2.bad, v: f2.ctl.minutes }));
    await typeIn(a, 'minutes', '');
    await unfold(a, 'rent');
    await choose(a, 'currency', 'JPY');
    await typeIn(a, 'amount', '20万');
    const s3 = await send(a);
    const f3 = await face(a);
    ok(s3.length === 1 && s3[0].p.rent && s3[0].p.rent.amount === '20万' && s3[0].p.rent.currency === 'JPY'
      && f3.msg.length === 1 && f3.msg[0].text === '家賃の月額が正しくありません' && J(f3.bad) === J(['amount']) && f3.ctl.amount === '20万',
      'S5 月額「20万」（通貨 JPY）→ 打ったとおりの字「20万」で送られる・サーバの「家賃の月額が正しくありません」・月額の欄に印・「20万」は欄に残る',
      J({ rent: s3[0] && s3[0].p.rent, msg: f3.msg, bad: f3.bad, v: f3.ctl.amount }));
    await typeIn(a, 'amount', '250,000');
    const s4 = await send(a);
    const c4 = await card(a), r4 = (await rowsOf('a')).find((r) => r.town === T1);
    ok(s4.length === 1 && s4[0].p.rent && s4[0].p.rent.amount === 250000 && c4 && c4.head === UPDATED
      && r4 && Number(r4.amount) === 250000 && r4.currency === 'JPY' && r4.mode === 'train' && r4.minutes === null,
      'S5 月額「250,000」→ 数 250000 で送られ、保存される（保存先は 250000 JPY・所要時間は null のまま）', J({ rent: s4[0] && s4[0].p.rent, r4 }));
  });

  await scene('S6 番地のような字・間取りの断り', async () => {
    await closeSheet(a);
    await openTown(a);
    await typeTown(a, `${T0}1-2-3`);
    await tickOwn(a);
    const s1 = await send(a);
    const f1 = await face(a);
    ok(s1.length === 1 && f1.msg.length === 1 && f1.msg[0].title === SAY_NO && f1.msg[0].text === '街・最寄駅に、番地・部屋番号・URL は書けません'
      && f1.ctl.town === `${T0}1-2-3` && J(f1.bad) === J(['town']),
      `S6 街の欄に「${T0}1-2-3」→「${SAY_NO}」とサーバの「街・最寄駅に、番地・部屋番号・URL は書けません」・打った字は残る・街の欄に印`, J({ msg: f1.msg, v: f1.ctl.town, bad: f1.bad }));
    await typeTown(a, '');
    await pick(a, T1);
    await typeIn(a, 'layout', '1-2-3');
    const s2 = await send(a);
    const f2 = await face(a);
    await shot(a, '390-refused');
    ok(s2.length === 1 && s2[0].p.rent && s2[0].p.rent.layout === '1-2-3'
      && f2.msg.length === 1 && f2.msg[0].text === '間取りが正しくありません' && J(f2.bad) === J(['layout']) && f2.rentOpen && f2.ctl.layout === '1-2-3',
      'S6 間取り「1-2-3」→ サーバの「間取りが正しくありません」・間取りの欄に印・家賃の欄は開いたまま・字は残る', J({ msg: f2.msg, bad: f2.bad, open: f2.rentOpen }));
    await typeIn(a, 'layout', '');
  });

  await scene('S7 届かない → 端末に残る → 続きを開く', async () => {
    await typeIn(a, 'good', '通勤が楽');
    await K.L.failNext('submit_town_post', 'drop', 9);          // 切れた通信はブラウザが自分でやり直すので、何回か切る
    await tickOwn(a);
    const s1 = await send(a);
    const f1 = await face(a);
    await K.L.failOff();
    ok(s1.length === 1 && f1.msg.length === 1 && f1.msg[0].title === FAIL_T && f1.ctl.good === '通勤が楽',
      `S7 通信が切れる →「${FAIL_T}」・打った字は残る`, J({ msg: f1.msg, good: f1.ctl.good }));
    await a.page.reload({ waitUntil: 'load' });
    await a.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await K.entry(a);
    await openList(a);
    const l = await listFace(a);
    const box = l.msgs.find((m) => m.text === KEPT);
    ok(!!box && box.acts.includes(RESUME), `S7 読み直して一覧を開く →「${KEPT}」と「${RESUME}」`, J(l.msgs));
    await a.page.click('.pvc-root .pvc-main > .pvc-msg [data-pvc-act="resume"]');
    await waitTown(a);
    const f2 = await face(a);
    ok(f2.ctl.town === T1 && f2.ctl.good === '通勤が楽', `S7 「${RESUME}」→ 街の入力に、打った内容が戻る（「${T1}」・良い点「通勤が楽」）`, J(f2.ctl));
    await tickOwn(a);
    const s2 = await send(a);
    const c2 = await card(a), r2 = (await rowsOf('a')).find((r) => r.town === T1);
    ok(s2.length === 1 && c2 && c2.head === UPDATED && r2 && r2.good === '通勤が楽',
      `S7 そのまま送れる →「${UPDATED}」・保存先の「${T1}」の良い点は「通勤が楽」`, J({ head: c2 && c2.head, r2 }));
    await closeSheet(a);
  });

  await scene('S8 位置を取らない・住所を聞かない・一覧の口を呼ばない', async () => {
    const g = await page({ who: 'b' });
    await g.page.evaluateOnNewDocument(() => {
      const n = { n: 0 };
      window.__geo = n;
      const fake = { getCurrentPosition() { n.n++; }, watchPosition() { n.n++; return 1; }, clearWatch() {} };
      try { Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => fake }); } catch (e) { /* そのまま */ }
    });
    await go(g);
    /* ページの街の欄（暮らしの板の .crl[data-live="towns"]）が読み終わるまで待ってから、面を開く
       ── 一覧（pv_town_board）を読んでよいのは、その欄の1本だけ。面を開く前に出ていて、面を開いたあとも増えない */
    const BOX = '.pvg-liv-got > .crl[data-live="towns"]';
    await g.page.click('.pvg-tabs [data-pvg-tab="life"]');
    await g.page.waitForFunction((s) => { const b = document.querySelector(s); return !!b && /^(locked|open|empty|error|off)$/.test(b.getAttribute('data-state') || ''); }, { timeout: 20000 }, BOX);
    const boxIs = await g.page.$eval(BOX, (b) => ({ airline: b.getAttribute('data-airline'), base: b.getAttribute('data-base') }));
    const byBox = g.st.sent.filter((x) => x.fn === 'pv_town_board').map((x) => x.p);
    await openTown(g);
    await pick(g, T0);
    await unfold(g, 'rent');
    await unfold(g, 'trip');
    await typeIn(g, 'good', '検査の字');
    const f = await face(g);
    const geo = await g.page.evaluate(() => window.__geo ? window.__geo.n : -1);
    const named = Object.keys(f.ctl).filter((k) => /addr|住所|lat|lng|geo/i.test(k));
    const boards = g.st.sent.filter((x) => x.fn === 'pv_town_board').map((x) => x.p), queue = g.st.calls.filter((c) => c === 'pv_town_queue');
    const mine = J({ airline: SLUG, base: BASE });
    ok(geo === 0, 'S8 位置を取らない（navigator.geolocation を数える物に替えて、呼ばれた数は 0）', J({ geo }));
    ok(named.length === 0 && !f.labels.some((l) => /住所/.test(l)), 'S8 「住所」の欄が無い（そう名付いた欄も、そう書いた見出しも無い）', J({ names: Object.keys(f.ctl), labels: f.labels }));
    ok(J(boxIs) === mine && byBox.length === 1 && J(byBox[0]) === mine && boards.length === 1 && queue.length === 0 && g.st.calls.includes('pv_town_options'),
      'S8 街の一覧（pv_town_board）を読むのは、ページの街の欄の1本だけ（面を開く前・この会社と基地）。面は、一覧も運営の確認待ち（pv_town_queue）も呼ばない（呼ぶのは候補の pv_town_options）',
      J({ boxIs, byBox, boards, calls: g.st.calls }));
    await shut(g);
  });

  await scene('S9 打った内容は、自分の投稿のある街を選んでも消えない', async () => {
    const X = T1, Y = T2;
    const put = await rpcAs(base, 'c', 'submit_town_post', { airline: SLUG, base_iata: BASE, town: X, good: '保存した良い点', lang: 'ja' });
    const c = await page({ who: 'c' });
    await go(c);
    await openTown(c);
    await typeIn(c, 'good', '打った良い点');
    await pick(c, X);
    const f1 = await face(c);
    ok(put.body && put.body.ok === true && f1.ctl.good === '打った良い点' && f1.tag && f1.send === UPD_BTN,
      `S9 自分の投稿のある「${X}」を、良い点を打ってから選ぶ → 欄は打った字のまま（保存した字を上に書かない）・「${MINE}」・「${UPD_BTN}」`,
      J({ put: put.body, good: f1.ctl.good, tag: f1.tag, send: f1.send }));
    await tickOwn(c);
    const s1 = await send(c);
    const rows = await rowsOf('c');
    ok(s1.length === 1 && s1[0].p.town === X && s1[0].p.good === '打った良い点' && rows.length === 1 && rows[0].town === X && rows[0].good === '打った良い点',
      `S9 送ると、「${X}」の1行が打った字になる（行は1つ）`, J({ s1, rows }));
    await closeSheet(c);
    await openTown(c);
    await pick(c, X);
    const f2 = await face(c);
    await pick(c, Y);
    const f3 = await face(c);
    ok(f2.ctl.good === '打った良い点' && f2.send === UPD_BTN && f3.ctl.good === '' && f3.send === ADD_BTN && !f3.tag,
      `S9 打つ前に「${X}」を選ぶ → 保存した値が入る／自分の投稿の無い「${Y}」へ移る → 空に戻る（「${ADD_BTN}」）`, J({ f2: f2.ctl.good, f3: f3.ctl.good, send: f3.send }));
    await shut(c);
  });

  await scene('S10 見出しは、送るボタンと同じ決まり', async () => {
    /* S9 で 'c' が出した「T1」（自分の投稿のある街）と、出していない「T2」 */
    const X = T1, Y = T2;
    const mine = (await rowsOf('c')).map((r) => r.town);
    if (!(mine.includes(X) && !mine.includes(Y))) throw new Error(`前提が崩れた（'c' の投稿が「${X}」だけではない）: ` + J(mine));
    const c = await page({ who: 'c' });
    await go(c);
    await openTown(c);
    const f0 = await face(c);
    ok(f0.title === HEAD && f0.ctl.town === '' && f0.send === ADD_BTN && !f0.tag,
      `S10 入口から開く：見出しは「${HEAD}」・欄は空・ボタンは「${ADD_BTN}」`, J({ title: f0.title, town: f0.ctl.town, send: f0.send }));
    await typeTown(c, X);
    await until(async () => (await face(c)).send === UPD_BTN, 5000);
    const f1 = await face(c);
    ok(f1.ctl.town === X && f1.tag && f1.send === UPD_BTN && f1.title === FIX_HEAD,
      `S10 自分の投稿のある「${X}」を打つ → 「${MINE}」・ボタンは「${UPD_BTN}」・見出しも「${FIX_HEAD}」（「…を追加」と言わない）`,
      J({ title: f1.title, town: f1.ctl.town, tag: f1.tag, send: f1.send }));
    await typeTown(c, Y);
    await until(async () => (await face(c)).send === ADD_BTN, 5000);
    const f2 = await face(c);
    ok(f2.ctl.town === Y && !f2.tag && f2.send === ADD_BTN && f2.title === HEAD,
      `S10 投稿の無い「${Y}」へ打ち替える → ボタンは「${ADD_BTN}」・見出しは「${HEAD}」に戻る`,
      J({ title: f2.title, town: f2.ctl.town, tag: f2.tag, send: f2.send }));
    await typeTown(c, '');
    await pick(c, X);
    const f3 = await face(c);
    ok(f3.ctl.town === X && f3.send === UPD_BTN && f3.title === FIX_HEAD,
      `S10 候補の札で「${X}」を選んでも同じ（「${UPD_BTN}」・見出し「${FIX_HEAD}」）`, J({ title: f3.title, town: f3.ctl.town, send: f3.send }));
    await shut(c);
  });

  await scene('S11 状態の1行（読み込み中・読めなかった）は、開いた面の最初の画面に在る（390・1440）', async () => {
    /* 状態の1行の箱が、開いたままの面の最初の画面に在るか：面の中は送っていない・ページの窓の中・面の見える所の中・
       箱の真ん中に在るのがその1行（上に何も重なっていない）。読み込み中は欄が止まっている（灰色の欄だけが見える時の1行） */
    const where = (p) => p.page.evaluate(() => {
      const r = document.querySelector('.pvc-root'), f = r && r.querySelector('form[data-pvc-form="town"]');
      const w = f && f.querySelector('[data-pvc-wait]'), m = r && r.querySelector('.pvc-main');
      if (!w || !m || w.hidden || !w.getClientRects().length) return { shown: false };
      const b = w.getBoundingClientRect(), mb = m.getBoundingClientRect();
      const top = Math.max(0, mb.top), bottom = Math.min(innerHeight, mb.bottom);
      const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { shown: true, text: w.textContent, scroll: Math.round(m.scrollTop), box: [Math.round(b.top), Math.round(b.bottom)],
        view: [Math.round(top), Math.round(bottom)], inside: b.height > 0 && b.top >= top && b.bottom <= bottom, onTop: !!at && w.contains(at),
        off: !!(f.querySelector('fieldset.pvc-set') || {}).disabled };
    });
    const firstScreen = (s) => s.shown && s.scroll === 0 && s.inside && s.onTop;
    for (const [w, h] of [[390, 680], [1440, 820]]) {
      /* 読み込み中：自分の街の投稿の読みを止めたまま（返事が来ない）開く */
      const s = await page({ who: 'c', w, h });
      await s.page.evaluateOnNewDocument(() => {
        const F = window.fetch;
        window.fetch = function (input, init) {
          const u = String((input && input.url) || input);
          if (/\/rest\/v1\/rpc\/my_town_posts(\?|$)/.test(u)) return new Promise(() => {});
          return F.apply(this, arguments);
        };
      });
      await go(s);
      await K.entry(s);
      await s.page.evaluate(() => window.PVContrib.open({ topic: 'town' }));
      await sheetIn(s, `const f = r.querySelector('form[data-pvc-form="town"]'), w = f && f.querySelector('[data-pvc-wait]');
        return !!w && !w.hidden && w.textContent === ${J(LOADING)};`);
      const l = await where(s);
      await shot(s, `${w}-s11-loading`);
      ok(firstScreen(l) && l.text === LOADING && l.off,
        `★S11 ${w}×${h} 読み込み中（欄が止まっている）：「${LOADING}」の1行は、開いた面の最初の画面に在る`, J(l));
      await shut(s);
      /* 読めなかった：自分の街の投稿の読みを1本だけ落として開く */
      const e = await page({ who: 'c', w, h });
      await go(e);
      await K.L.failNext('my_town_posts', '', 1);
      await K.entry(e);
      await e.page.evaluate(() => window.PVContrib.open({ topic: 'town' }));
      await sheetIn(e, `const f = r.querySelector('form[data-pvc-form="town"]'), w = f && f.querySelector('[data-pvc-wait]');
        return !!w && !w.hidden && w.textContent === ${J(NOREAD)};`);
      await K.L.failOff();
      const x = await where(e);
      await shot(e, `${w}-s11-read-failed`);
      ok(firstScreen(x) && x.text === NOREAD && !x.off,
        `★S11 ${w}×${h} 読めなかった（欄は使える）：「${NOREAD}」の1行は、開いた面の最初の画面に在る`, J(x));
      await shut(e);
    }
  });

  await scene('X1 街の読みが失敗・止まっても、月の勤務は待たない', async () => {
    const w = await rpcAs(base, 'b', 'submit_work_month', { airline: SLUG, year: LAST.y, month: LAST.m, position: 'fo', fleet: FLEET, block_hours: 40, stay_nights: 3, lang: 'ja' });
    if (!(w.body && w.body.ok)) throw new Error('前提が崩れた（月の勤務を置けない）: ' + J(w.body || w.text));
    /* 月の勤務の入力が描かれるたびに、読み込み中（欄が閉じている）か・値が入っているかを書き留める */
    const watch = () => {
      const log = [];
      window.__draws = log;
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const f = n.matches('form[data-pvc-form="work"]') ? n : n.querySelector && n.querySelector('form[data-pvc-form="work"]');
          if (!f) continue;
          const s = f.querySelector('fieldset.pvc-set'), wt = f.querySelector('[data-pvc-wait]');
          log.push({ off: !!(s && s.disabled), wait: wt ? wt.textContent : '', block: (f.querySelector('[name="block_hours"]') || {}).value || '' });
        }
      }).observe(document, { subtree: true, childList: true });
    };
    const workReady = (p) => sheetIn(p, `const f = r.querySelector('form[data-pvc-form="work"]'), s = f && f.querySelector('fieldset.pvc-set');
      return !!s && !s.disabled && f.querySelector('[name="block_hours"]').value !== '';`);
    const b = await page({ who: 'b' });
    await b.page.evaluateOnNewDocument(watch);
    await go(b);
    await K.L.failNext('my_town_posts', '', 1);
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'work' }));
    await workReady(b);
    await until(() => b.st.got.some((x) => x.fn === 'my_town_posts'));
    await b.page.evaluate(() => fetch('/pv-vocab.json', { cache: 'no-store' }).then((r) => r.text()));
    await K.L.failOff();
    const draws = await b.page.evaluate(() => window.__draws);
    const town = b.st.got.filter((x) => x.fn === 'my_town_posts').map((x) => x.status);
    const filled = draws.filter((d) => !d.off), waits = draws.filter((d) => d.wait === LOADING);
    ok(J(town) === J([503]) && filled.length === 1 && filled[0].block === '40' && waits.length <= 1,
      'X1 自分の街の投稿の読みが失敗しても（failNext → 503）、月の勤務の入力は保存した値（40）で1回だけ描かれ、読み込み中の行は2度と出ない',
      J({ town, draws }));
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'list' }));
    await sheetIn(b, `const st = r.querySelector('[data-pvc-state]'); return !!r.querySelector('.pvc-tiles') && !!st && st.getAttribute('data-pvc-town') === 'fail';`);
    const l = await listFace(b);
    ok(l.state === 'ok ok' && l.town === 'fail', 'X1 一覧は今までの2つの状態のまま（ok ok）・街の読みは fail', J(l));
    await K.entry(b);
    await b.page.evaluate(() => window.PVContrib.open({ topic: 'town' }));
    await waitTown(b);
    const f = await face(b);
    ok(f.wait === NOREAD,
      `X1 街の入力は使える（欄が開いている）・読み込み中の行は残らず「${NOREAD}」`, J({ wait: f.wait }));
    await shut(b);

    const s = await page({ who: 'b' });
    await s.page.evaluateOnNewDocument(() => {
      const F = window.fetch;
      window.__stalled = 0;
      window.fetch = function (input, init) {
        const u = String((input && input.url) || input);
        if (/\/rest\/v1\/rpc\/my_town_posts(\?|$)/.test(u)) { window.__stalled++; return new Promise(() => {}); }
        return F.apply(this, arguments);
      };
    });
    await go(s);
    await s.page.evaluate(() => window.PVContrib.open({ topic: 'work' }));
    await workReady(s);
    const held = await s.page.evaluate(() => window.__stalled);
    ok(held >= 1 && !s.st.got.some((x) => x.fn === 'my_town_posts'),
      'X1 街の読みが止まったまま（返事が来ない）でも、月の勤務の入力はすぐ使える（保存した値・欄が開いている）', J({ held }));
    await shut(s);
  });
}

/* ════ 場面 anon（A1〜A7）══════════════════════════════════════ */
async function anon() {
  const K = await kit();
  const { L, page, go, shut, openTown, waitTown, face, card, typeTown, pick, choose, tickOwn, send, sentOf, rowsOf,
    closeSheet, openList, listFace, typeIn, unfold, sheetIn, early, loginVia, swap, deposits, count } = K;
  const T1 = NAMES[1];
  /* ログインせずに打つ街（種に無い名前 ＝ 会員が出せば、運営の確認を待つ候補になる名前） */
  const NEW = '天王洲';
  if (SEED_NAMES.includes(NEW) || !T1) throw new Error(`前提が崩れた（「${NEW}」が種に在る・種の街が2つ無い）: ${J(SEED_NAMES)}`);
  const G1 = 'ログインなしの良い点', G2 = 'ログインなしで直した良い点';
  /* ログインせずに預けた回の箱（保存後のカードの中・一覧の上） */
  const heldOf = (p, sel) => p.page.evaluate((s) => {
    const b = document.querySelector(s), tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    if (!b) return { shown: false, title: '', lines: [] };
    return { shown: !b.hidden && b.getClientRects().length > 0, title: tx(b.querySelector('.pvc-held-t')), lines: [...b.querySelectorAll('.pvc-held-d')].map(tx) };
  }, sel);
  /* 開いている街の面で街 town を保存し、保存後のカードの「もう1項目を答える」→ 一覧の「通勤・タクシー」を開く（人が押す所を押す）。
     返すのは、その面の頭の行（「…からの通勤」は、面を開いた押し所が持ってきた街の名前）と、ページに gone の字が在るか・
     このあいだに送ったもの。前の人の「修正」の街（gone）を、次の人の別の項目へ持ち越さないことを見る（P12.42） */
  const taxiAfter = async (p, town, gone) => {
    const n0 = p.st.calls.length;
    await typeTown(p, town);
    await tickOwn(p);
    const s = await send(p), c = await card(p);
    const out = { saved: s.length === 1 && !!c, towns: s.map((x) => x.p && x.p.town), form: false, line: '', where: null, subs: [] };
    if (out.saved) {
      await p.page.click('.pvc-root [data-pvc-saved] [data-pvc-act="more"]');
      await K.waitList(p);
      await p.page.click('.pvc-root .pvc-tiles [data-pvc-tile="taxi"]');
      await sheetIn(p, `const f = r.querySelector('form[data-pvc-form="taxi"]'), s = f && f.querySelector('fieldset.pvc-set');
        return !!s && !s.disabled;`);
      Object.assign(out, await p.page.evaluate((nm) => {
        const f = document.querySelector('.pvc-root form[data-pvc-form="taxi"]'), n = f && f.querySelector('.pvc-ctx-line');
        return { form: !!f, line: n ? n.textContent.replace(/\s+/g, ' ').trim() : '', where: document.documentElement.outerHTML.includes(nm) };
      }, gone));
    }
    out.subs = p.st.calls.slice(n0).filter((x) => /^(submit_|claim_)/.test(x));
    return out;
  };
  /* その結果が「持ち越していない」か（面が描けた・頭の行が在る・gone はその行にもページにも無い・送ったのは town の1本だけ） */
  const carried = (t, town, gone) => !(t.saved && t.form && t.line !== '' && !t.line.includes(gone) && t.where === false
    && t.towns.length === 1 && t.towns[0] === town && t.subs.length === 1 && t.subs[0] === 'submit_town_post');
  const g = await page();
  await early(g);
  await go(g);

  await scene('A1 ログインなしで保存する', async () => {
    const towns0 = await count('pv_towns');
    await openTown(g);
    await typeTown(g, NEW);
    await typeIn(g, 'good', G1);
    await tickOwn(g);
    const sent = await send(g, 'submit_contrib_anon');
    const c = await card(g), h = await heldOf(g, '.pvc-root [data-pvc-saved] [data-pvc-held]');
    const dep = await deposits(), posts = await count('pv_town_posts'), towns1 = await count('pv_towns');
    const named = (await L.q('select count(*)::int as n from public.pv_towns where name = $1', [NEW])).rows[0].n;
    const key = await g.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
    const d = sent[0] && sent[0].p && sent[0].p.data ? sent[0].p.data : {};
    ok(sent.length === 1 && sent[0].p.kind === 'town' && d.town === NEW && d.airline === SLUG && d.base_iata === BASE && d.good === G1
      && !('key' in sent[0].p) && sentOf(g).length === 0,
      `A1 ログインせずに送る → 通信は submit_contrib_anon が1本（kind 'town'・街「${NEW}」・良い点。鍵はまだ無い）・会員の入口 submit_town_post は1本も出ない`, J(sent));
    ok(c && c.head === ADDED && c.mine && c.rows.town && c.rows.town.v === NEW && h.shown && h.title === SAVED_HELD,
      `A1 保存後のカードは「${ADDED}」「${MINE}」・街「${NEW}」と、今までの箱「${SAVED_HELD}」`, J({ c, h }));
    ok(dep.length === 1 && dep[0].airline === SLUG && dep[0].town === NEW && dep[0].good === G1 && posts === 0 && towns1 === towns0 && named === 0
      && /^[0-9a-f]{48}$/.test(key || ''),
      `A1 保存先：預かりに1行（${SLUG}・「${NEW}」）・会員の街の行は0・街の候補は増えない（「${NEW}」の行が無い）・この端末に控えの鍵`,
      J({ dep, posts, towns0, towns1, named, key: !!key }));
  });

  await scene('A1b 預けたのが街だけの人の一覧', async () => {
    await g.page.reload({ waitUntil: 'load' });
    await g.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await openList(g, false);
    const l = await listFace(g), h = await heldOf(g, '.pvc-root [data-pvc-heldslot]');
    ok(l.state === 'ok ok' && l.town === 'ok' && h.shown && h.title === LIST_HELD && J(h.lines) === J(LIST_HELD_D),
      `A1b 読み直して一覧を開く：「${LIST_HELD}」とその2行（${LIST_HELD_D.join(' ／ ')}）が出る（預けたのは街だけ）`, J({ l, h }));
  });

  await scene('A2 読み直して開く・直す', async () => {
    await closeSheet(g);
    await openTown(g);
    await typeTown(g, NEW);
    const f0 = await face(g);
    ok(f0.tag && f0.ctl.good === G1 && f0.send === UPD_BTN,
      `A2 読み直して開き「${NEW}」と打つ → 欄の見出しに「${MINE}」・預けた良い点「${G1}」が入る・ボタンは「${UPD_BTN}」`, J({ tag: f0.tag, good: f0.ctl.good, send: f0.send }));
    await typeIn(g, 'good', G2);
    await tickOwn(g);
    const sent = await send(g, 'submit_contrib_anon');
    const c = await card(g), dep = await deposits(), key = await g.page.evaluate(() => localStorage.getItem('pv_contrib_key'));
    const mt = await g.page.evaluate(() => window.PVContrib.myTowns());
    ok(sent.length === 1 && sent[0].p.key === key && sent[0].p.data.good === G2 && c && c.head === UPDATED
      && dep.length === 1 && dep[0].town === NEW && dep[0].good === G2
      && mt.k === 'ok' && mt.held === true && mt.rows.length === 1 && mt.rows[0].town === NEW && mt.rows[0].good === G2,
      `A2 良い点を直して送る（控えの鍵つき）→「${UPDATED}」・預かりは1行のまま中身が置き換わる・PVContrib.myTowns() もその1件（held）`, J({ sent, dep, mt }));
  });

  await scene('A3 ほかのブラウザ（鍵の無い端末）', async () => {
    const h = await page();
    await go(h);
    await openTown(h);
    await typeTown(h, NEW);
    const f = await face(h);
    const n0 = h.st.calls.length;
    const mt = await h.page.evaluate(() => window.PVContrib.myTowns());
    const later = h.st.calls.slice(n0);
    const seen = await h.page.evaluate((xs) => { const t = document.documentElement.outerHTML; return xs.filter((x) => t.includes(x)); }, [G1, G2]);
    ok(!f.tag && f.ctl.good === '' && f.send === ADD_BTN && f.chips.every((x) => !x.mine) && seen.length === 0
      && !h.st.calls.includes('my_contrib_anon') && !h.st.calls.includes('my_town_posts')
      && mt.k === 'anon' && mt.held === false && mt.rows.length === 0 && later.length === 0,
      `A3 ほかのブラウザで開いて「${NEW}」と打つ：「${MINE}」も預けた字も出ない・my_contrib_anon は1本も出ない（鍵が無い）・PVContrib.myTowns() は anon で通信なし`,
      J({ tag: f.tag, good: f.ctl.good, send: f.send, seen, calls: h.st.calls, mt, later }));
    await shut(h);
  });

  const G4 = 'ログイン前に打った良い点', C4 = 'ログイン前に打った気になる点';
  await scene('A4 途中でログインする（預かりの口が1回「無い」と答えた）', async () => {
    /* 預かりの口（submit_contrib_anon）が1回だけ「関数が無い」と答える（このタブの印が立っている時だけ・1回で印を下ろす） */
    await g.page.evaluateOnNewDocument(() => {
      const F = window.fetch;
      window.fetch = function (input, init) {
        const u = String((input && input.url) || input);
        let on = false;
        try { on = sessionStorage.getItem('__pvt_off') === '1'; } catch (e) { on = false; }
        if (on && /\/rest\/v1\/rpc\/submit_contrib_anon(\?|$)/.test(u)) {
          try { sessionStorage.removeItem('__pvt_off'); } catch (e) { /* そのまま */ }
          return Promise.resolve(new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.submit_contrib_anon in the schema cache', details: null, hint: null }),
            { status: 404, headers: { 'content-type': 'application/json' } }));
        }
        return F.apply(this, arguments);
      };
    });
    await closeSheet(g);
    await g.page.reload({ waitUntil: 'load' });
    await g.page.waitForFunction(() => !!window.PVContrib, { timeout: 30000 });
    await openTown(g);
    await typeTown(g, '');
    await pick(g, T1);
    await choose(g, 'lived', 'past');
    await choose(g, 'lived_to_year', '2020');
    await typeIn(g, 'good', G4);
    await typeIn(g, 'concern', C4);
    await unfold(g, 'rent');
    await typeIn(g, 'layout', '1LDK');
    await typeIn(g, 'area', '40');
    await choose(g, 'currency', 'JPY');
    await typeIn(g, 'amount', '180000');
    await unfold(g, 'trip');
    await choose(g, 'mode', 'train');
    await choose(g, 'airport', ENTRY.ports[0]);
    await typeIn(g, 'terminal', '1');
    await choose(g, 'hour', '7');
    await typeIn(g, 'minutes', '35');
    await tickOwn(g);
    const typed = (await face(g)).ctl;
    const dep0 = await deposits(), anon0 = sentOf(g, 0, 'submit_contrib_anon').length;
    await g.page.evaluate(() => sessionStorage.setItem('__pvt_off', '1'));
    await Promise.all([g.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
      g.page.click('.pvc-root form[data-pvc-form="town"] .pvc-send[type="submit"]')]);
    const at = new URL(g.page.url()), ret = at.searchParams.get('return');
    ok(at.pathname === '/login.html' && ret === `/airlines/${SLUG}.html?add=town` && sentOf(g, 0, 'submit_contrib_anon').length === anon0
      && J(await deposits()) === J(dep0),
      `A4 預かりの口が「無い」と答える → login.html?return=/airlines/${SLUG}.html?add=town へ（何も保存されていない）`, J({ path: at.pathname, ret }));
    await loginVia(g, 'c');
    await waitTown(g);
    const f = await face(g);
    const want = { town: T1, lived: 'past', lived_to_year: '2020', good: G4, concern: C4, layout: '1LDK', area: '40', area_unit: 'm2',
      currency: 'JPY', amount: '180000', mode: 'train', airport: ENTRY.ports[0], terminal: '1', hour: '7', minutes: '35', own: true };
    const diff = Object.keys(want).filter((k) => f.ctl[k] !== want[k]);
    ok(J(f.ctl) === J(typed) && !diff.length && f.msg.some((m) => m.kind === 'back' && m.title === BACK_T) && f.rentOpen && f.tripOpen,
      `A4 'c' として login.html で入って戻る → 街の面が開き、打った値がどれもそのまま（街「${T1}」・住んだ時期・良い点・気になる点・家賃・通勤・チェック）・「${BACK_T}」`,
      J({ diff, ctl: f.ctl, msg: f.msg }));
  });

  await scene('A5 ログインしたら、預けた街が本人の投稿になる', async () => {
    const empty = await until(async () => (await deposits()).length === 0, 20000);
    const rows = await rowsOf('c');
    const keys = await g.page.evaluate(() => [localStorage.getItem('pv_contrib_key'), sessionStorage.getItem('pv_contrib_key')]);
    const mt = await g.page.evaluate(() => window.PVContrib.myTowns());
    ok(empty && rows.length === 1 && rows[0].town === NEW && rows[0].good === G2 && rows[0].town_state === 'pending' && keys.every((k) => k === null)
      && g.st.calls.includes('claim_contrib') && mt.k === 'ok' && mt.held === false && mt.rows.length === 1 && mt.rows[0].town === NEW,
      `A5 預かりが空になるまで待つ → 預けた「${NEW}」は 'c' の投稿（確認待ちの候補）・控えの鍵は端末から消える・my_town_posts（PVContrib.myTowns()）がその1件を返す`,
      J({ empty, rows, keys, mt }));
    await closeSheet(g);
  });

  await scene('A6 2人の会員（同じタブ・ほかのタブ）', async () => {
    const WN = '月島', TY = '画面の前の人が打った字';
    const u = await page({ who: 'a' });
    await go(u);
    await openTown(u);
    await typeTown(u, WN);
    await tickOwn(u);
    const s0 = await send(u), c0 = await card(u);
    if (!(s0.length === 1 && c0 && c0.rows.town && c0.rows.town.v === WN && c0.rows.town.wait === PENDING)) {
      throw new Error('前提が崩れた（a の確認待ちの街の保存後のカードが出ていない）: ' + J({ s0, c0 }));
    }
    const where = () => u.page.evaluate((nm) => document.documentElement.outerHTML.includes(nm), WN);
    const subs = (from) => u.st.calls.slice(from).filter((x) => /^(submit_|claim_)/.test(x));
    const listed = (t) => sheetIn(u, `const st = r.querySelector('[data-pvc-state]');
      return !r.querySelector('[data-pvc-saved]') && !!r.querySelector('.pvc-tiles') && !!st && st.getAttribute('data-pvc-state') === 'ok ok'
        && st.getAttribute('data-pvc-town') === 'ok' && (st.hidden ? '' : st.textContent.trim()) === a;`, t).then(() => true, () => false);
    /* a の「修正」から開く（会社ページの街の欄の「修正」と同じ形。開いたら押し所は外す ── 押し所の字にも街の名前が在る） */
    const fix = async () => {
      await u.page.evaluate((nm) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = '修正';
        b.setAttribute('data-pvc-open', 'town'); b.setAttribute('data-pvc-ctx', nm); b.setAttribute('data-test-fix', '');
        b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9000;min-width:88px;min-height:44px';
        document.body.appendChild(b);
      }, WN);
      await u.page.click('[data-test-fix]');
      await waitTown(u);
      await u.page.evaluate(() => { const b = document.querySelector('[data-test-fix]'); if (b) b.remove(); });
      const f = await face(u);
      if (!(f.ctl.town === WN && f.tag)) throw new Error('前提が崩れた（「修正」から開いた面の欄に、a の確認待ちの街が無い）: ' + J(f.ctl));
      await typeIn(u, 'good', TY);
    };
    /* 1) 保存後のカードが出ているまま、同じタブで b に替わる */
    let n0 = u.st.calls.length;
    await swap(u, 'b', 'same');
    const gone = await listed(NONE_YET);
    ok(gone && !(await where()) && subs(n0).length === 0,
      `A6 a の保存後のカード（「${WN}」・${PENDING}）が出ているまま、同じタブで 'b' がログイン → カードは消えて一覧・「${NONE_YET}」（a の街を数えない）・「${WN}」はページのどこにも無い・何も送らない`,
      J({ gone, list: await listFace(u), subs: subs(n0) }));
    /* 2) a の「修正」で確認待ちの名前が欄に入っているまま、同じタブで b に替わる */
    await swap(u, 'a', 'same');
    await closeSheet(u);
    await fix();
    n0 = u.st.calls.length;
    await swap(u, 'b', 'same');
    const c2 = await until(async () => (await face(u)).ctl.town === '', 8000);
    const f2 = await face(u);
    ok(c2 && f2.ctl.good === TY && !f2.tag && f2.chips.every((x) => !x.mine) && f2.send === ADD_BTN && !(await where()) && subs(n0).length === 0,
      `A6 a が「修正」で開いた確認待ちの「${WN}」が欄に在るまま、同じタブで 'b' がログイン → 街の欄は空・「${WN}」はページのどこにも無い・打ってまだ送っていない字は残る・何も送らない`,
      J({ c2, ctl: f2.ctl, tag: f2.tag, send: f2.send, subs: subs(n0) }));
    /* 3) 同じ形で、ほかのタブで b に替わる（こちらのタブには触らない） */
    await swap(u, 'a', 'same');
    await closeSheet(u);
    await fix();
    n0 = u.st.calls.length;
    await swap(u, 'b', 'tab');
    const c3 = await until(async () => (await face(u)).ctl.town === '', 8000);
    const f3 = await face(u);
    ok(c3 && f3.ctl.good === TY && !f3.tag && f3.chips.every((x) => !x.mine) && f3.send === ADD_BTN && !(await where()) && subs(n0).length === 0,
      `A6 同じ形で、ほかのタブで 'b' がログイン（こちらのタブには触らない）→ 街の欄は空・「${WN}」はページのどこにも無い・打った字は残る・何も送らない`,
      J({ c3, ctl: f3.ctl, tag: f3.tag, send: f3.send, subs: subs(n0) }));
    /* 3b) そのまま（面は開いたまま）'b' が街を保存して、別の項目へ進む。a の「修正」が持ってきた街の名前は、
           'b' の「通勤・タクシー」の頭の行（「…からの通勤」）にも、ページのどこにも出ない */
    const t3 = await taxiAfter(u, NAMES[0], WN);
    ok(!carried(t3, NAMES[0], WN),
      `A6 ほかのタブで 'b' に替わったあと、'b' が「${NAMES[0]}」を保存 →「もう1項目を答える」→「通勤・タクシー」：a の「修正」の「${WN}」は面の頭の行にも、ページのどこにも無い（送ったのは 'b' の街の1本だけ）`,
      J(t3));
    /* 4) ページのほかの鍵の要る欄（02b の欄）も同じ：'pay' に開いていた REAL PAY の行が出ているまま、同じタブで 'b' がログイン
          → その行の字はページのどこにも無い（字も属性の値も）・欄は 'b' の鍵の形。'pay' の給与は、その会員としての本物の呼び出しで作る */
    const YEAR = (await L.q(`select extract(year from current_date)::int as y`)).rows[0].y - 1;
    const filed = await rpcAs(K.base, 'pay', 'submit_pay_report', { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET,
      position: 'cap', airline: SLUG, period_year: YEAR, period_month: 3, gross_monthly: 9000 });
    if (!(filed.body && filed.body.ok === true)) throw new Error(`前提が崩れた（'pay' の給与が保存されていない）: ` + J(filed.body));
    const P = await page({ who: 'pay' }), PAYBOX = '.crl[data-live="realpay"]';
    await go(P);
    await P.page.click('.pvg-tabs [data-pvg-tab="pay"]');
    const payState = () => P.page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => e.getAttribute('data-state')), PAYBOX);
    await until(async () => (await payState()).includes('open'), 30000);
    const rows = await P.page.evaluate((s) => [...document.querySelectorAll(s + ' .crl-rows > li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), PAYBOX);
    const left = () => P.page.evaluate((rs) => {
      const text = document.documentElement.textContent.replace(/\s+/g, ' ');
      const attrs = [...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value)).join('\n').replace(/\s+/g, ' ');
      return rs.filter((r) => text.includes(r) || attrs.includes(r));
    }, rows);
    if (!rows.length || (await left()).length !== rows.length) throw new Error(`前提が崩れた（'pay' に REAL PAY の行が出ていない・探し方で見つからない）: ` + J({ rows, st: await payState() }));
    const n4 = P.st.calls.length;
    await swap(P, 'b', 'same');
    const gone4 = await until(async () => (await left()).length === 0 && (await payState()).every((s) => s === 'locked'), 15000);
    ok(gone4 && (await payState()).length > 0 && P.st.calls.slice(n4).filter((x) => /^(submit_|claim_)/.test(x)).length === 0,
      `A6 ページのほかの鍵の要る欄も同じ：'pay' に開いていた REAL PAY の行が出ているまま、同じタブで 'b' がログイン → その行の字はページのどこにも無い・欄は 'b' の鍵の形・何も送らない`,
      J({ rows, left: await left(), st: await payState(), calls: P.st.calls.slice(n4) }));
    await shut(P);
  });

  await scene('A7 面を閉じたまま読む人が替わったあとの「修正」', async () => {
    /* 'a' の街（種に無い名前 ＝ 確認待ちの候補になる名前）。押すのは、会社ページの街の欄（career-live.js）が描いた本物の「修正」 */
    const WA = '勝どき', BOX = '.crl[data-live="towns"]';
    if (SEED_NAMES.includes(WA)) throw new Error(`前提が崩れた（「${WA}」が種に在る）: ${J(SEED_NAMES)}`);
    const u = await page({ who: 'a' });
    await go(u);
    /* 街の欄（見えている方）の状態と、自分の行の「修正」が持つ街 */
    const boxFace = () => u.page.evaluate((s) => {
      const b = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length > 0);
      return b ? { state: b.getAttribute('data-state'), own: [...b.querySelectorAll('.crl-town-ed')].map((x) => x.getAttribute('data-pvc-ctx')) } : null;
    }, BOX);
    const settled = (st) => !!st && !/^(idle|loading)$/.test(st.state || '');
    const where = () => u.page.evaluate((nm) => document.documentElement.outerHTML.includes(nm), WA);
    const subs = (from) => u.st.calls.slice(from).filter((x) => /^(submit_|claim_)/.test(x));
    await openTown(u);
    await typeTown(u, WA);
    await tickOwn(u);
    const s0 = await send(u), c0 = await card(u);
    if (!(s0.length === 1 && c0 && c0.rows.town && c0.rows.town.v === WA)) throw new Error('前提が崩れた（a の街の保存後のカードが出ていない）: ' + J({ s0, c0 }));
    await closeSheet(u);
    const own0 = await until(async () => { const b = await boxFace(); return settled(b) && b.own.includes(WA); }, 20000);
    if (!own0) throw new Error(`前提が崩れた（街の欄に 'a' の「${WA}」の「修正」が無い）: ` + J(await boxFace()));
    /* 1) 面を閉じたまま、同じタブで 'b' に替わる → 'b' が入口から開く（面には 'b' の印が付く） */
    let n0 = u.st.calls.length;
    await swap(u, 'b', 'same');
    await until(async () => { const b = await boxFace(); return settled(b) && !b.own.includes(WA); }, 20000);
    await openTown(u);
    const f1 = await face(u);
    ok(f1.ctl.town === '' && !f1.tag && f1.send === ADD_BTN && f1.title === HEAD && !(await where()) && subs(n0).length === 0,
      `A7 面を閉じたまま同じタブで 'b' に替わり、入口から開く → 欄は空・見出し「${HEAD}」・「${ADD_BTN}」・'a' の「${WA}」はページのどこにも無い（街の欄にも）・何も送らない`,
      J({ title: f1.title, town: f1.ctl.town, tag: f1.tag, send: f1.send, box: await boxFace(), subs: subs(n0) }));
    await closeSheet(u);
    /* 2) 面を閉じたまま、同じタブで 'a' に戻る（ログインし直す）→ 街の欄の「修正」を押す */
    await swap(u, 'a', 'same');
    const own2 = await until(async () => { const b = await boxFace(); return settled(b) && b.own.includes(WA); }, 20000);
    n0 = u.st.calls.length;
    const fix = await u.page.evaluateHandle((s, nm) => [...document.querySelectorAll(s + ' .crl-town-ed')]
      .find((x) => x.getClientRects().length > 0 && x.getAttribute('data-pvc-ctx') === nm) || null, BOX, WA);
    if (!own2 || !fix.asElement()) throw new Error(`前提が崩れた（'a' に戻った街の欄に「${WA}」の「修正」が無い）: ` + J(await boxFace()));
    await fix.asElement().click();
    await waitTown(u);
    await until(async () => (await face(u)).send === UPD_BTN, 8000);
    const f2 = await face(u);
    ok(f2.ctl.town === WA && f2.tag && f2.send === UPD_BTN && f2.title === FIX_HEAD && subs(n0).length === 0,
      `A7 面を閉じたまま 'b' → 'a' に戻り（同じタブでログインし直す）、街の欄の「修正」（${WA}）を押す → 直す面：欄は「${WA}」・「${MINE}」・見出し「${FIX_HEAD}」・「${UPD_BTN}」（空の「追加」にならない）`,
      J({ title: f2.title, town: f2.ctl.town, tag: f2.tag, send: f2.send, subs: subs(n0) }));
    await closeSheet(u);
    /* 3) 'a' の「修正」が街の欄に残ったまま、ページに何も届かない替わり方で 'b' になる（同じタブで鍵だけが書き替わる。合図は出さない）。
          書き替えと押すのは同じ1回の中（あいだに時計の確かめが入らない）── その「修正」を押す */
    const own3 = await until(async () => { const b = await boxFace(); return settled(b) && b.own.includes(WA); }, 20000);
    if (!own3) throw new Error(`前提が崩れた（街の欄に「${WA}」の「修正」が無い）: ` + J(await boxFace()));
    const sb = await seedOf(K.base, 'b');
    n0 = u.st.calls.length;
    const pressed = await u.page.evaluate((x, s, nm) => {
      const b = [...document.querySelectorAll(s + ' .crl-town-ed')].find((e) => e.getClientRects().length > 0 && e.getAttribute('data-pvc-ctx') === nm);
      if (!b) return false;
      localStorage.setItem('sb-local-auth-token', JSON.stringify(x.session));
      localStorage.setItem('pv_user', JSON.stringify(x.pv_user));
      b.click();
      return true;
    }, sb, BOX, WA);
    if (!pressed) throw new Error(`前提が崩れた（「${WA}」の「修正」を押せない）`);
    await waitTown(u);
    await until(async () => { const b = await boxFace(); return settled(b) && !b.own.includes(WA); }, 20000);
    const f3 = await face(u);
    ok(f3.ctl.town === '' && !f3.tag && f3.send === ADD_BTN && f3.title === HEAD && !(await where()) && subs(n0).length === 0,
      `A7 'a' の「修正」（${WA}）が街の欄に残ったまま、ページに何も届かずに 'b' になる → その「修正」を押す：'b' の追加の面（欄は空・見出し「${HEAD}」・「${ADD_BTN}」）・「${WA}」はページのどこにも無い・何も送らない`,
      J({ title: f3.title, town: f3.ctl.town, tag: f3.tag, send: f3.send, box: await boxFace(), subs: subs(n0) }));
    /* 4) その面のまま 'b' が街を保存して、別の項目へ進む。押した「修正」が持っていた 'a' の街の名前は、
          'b' の「通勤・タクシー」の頭の行（「…からの通勤」）にも、ページのどこにも出ない */
    const t4 = await taxiAfter(u, NAMES[0], WA);
    ok(!carried(t4, NAMES[0], WA),
      `A7 続けて 'b' が「${NAMES[0]}」を保存 →「もう1項目を答える」→「通勤・タクシー」：押した「修正」の「${WA}」は面の頭の行にも、ページのどこにも無い（送ったのは 'b' の街の1本だけ）`,
      J(t4));
    await shut(u);
  });
}

/* ════ 場面 board・admin の字と道具 ══════════════════════════════════
   字は career-live.js（欄）・admin-queue.js（運営の画面）・admin.html（門）の字。ここで字を固定する。 */
const TBOX = '.pvg-liv-got > .crl[data-live="towns"]';
const TOWN_HEAD = '人気の居住地', GOOD_L = '良い点', WAIT_T = '確認待ち', OFF_T = '準備中';
const LOCK_LOGIN = 'ログインと給与の提出で開きます', LOCK_PAY = '給与の提出で開きます';
const LOGIN_T = 'ログイン', PAY_GO = '匿名で給与を提出する', GIVE_GO = '匿名で答える', FIX_T = '修正';
const giveLock = (n) => `自分の会社に${n}つ答えると開きます`;
const answered = (n) => `回答 ${n}人`;
const LOCKED_STATE = '{"ok":true,"state":"locked"}', GIVE_STATE = '{"ok":true,"state":"give"}';
const FORBIDDEN = '{"ok":false,"status":"forbidden"}';
const GATE_LOGIN = 'このページを見るにはログインが必要です。', GATE_NOADMIN = 'このアカウントには管理者の権限がありません。';
const ADDED_ADM = '追加しました。';
/* オーナーの2つの一覧の字（admin-queue.js の T。WP-towns-13v で決めた字） */
const OWNER_WORDS = ['申請してきた人', '会員一覧', 'verified', '画像を見る'];
/* 画像で verified にしたあと取り消した人の会員一覧の行（admin-queue.js の T.reapply。2026-10-18・P12.60 Q1 のオーナーだけの文） */
const REAPPLY_T = 'この人は以前に申請したことがあるため、画像を見てからでないと verified にできません。本人がマイページから新しい画像を出すと「申請してきた人」に並びます。';
/* その会社のページの、就航地の一覧の最初の都市（ステイ先の欄を #stay-XXX で直接開く。assert-stays.mjs と同じ決め方） */
const STAY_IATA = (read(`airlines/${SLUG}.html`).match(/href="#stay-([A-Z]{3})" data-city="\1"/) || [])[1] || '';
/* 管理画面の「会社・基地」の選択肢の字（admin-queue.js の airName ＝ pv-airlines.json の日本語の名前） */
const AIR_JA = ((JSON.parse(read('pv-airlines.json')).airlines || {})[SLUG] || {}).ja || '';
const keysOf = (t) => [...String(t).matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)].map((m) => m[1]).join();

/* 街の欄の道具（場面 board・admin が使う）。K は kit() の道具 */
function boxKit(K) {
  const { base, go } = K;
  /* 欄が読み終わった（待ちの絵でない） */
  const settledBox = (p) => p.page.waitForFunction((s) => {
    const b = document.querySelector(s);
    return !!b && /^(locked|open|empty|error|off)$/.test(b.getAttribute('data-state') || '');
  }, { timeout: 20000 }, TBOX);
  /* 「暮らし・家族」のタブを開き（開いていなければ押す）、街の欄が読み終わるまで */
  const life = async (p) => {
    const shown = await p.page.$eval('#pvg-p-living', (n) => !n.hidden && n.getClientRects().length > 0).catch(() => false);
    if (!shown) await p.page.click('.pvg-tabs [data-pvg-tab="life"]');
    await settledBox(p);
  };
  /* 会社ページを開き直して（読み直し）、街の欄を読む */
  const visit = async (p) => { await go(p); await life(p); };
  /* 街の欄の見えている形（ほかの人の一覧・自分の行・鍵の1行・入口・答えるカード） */
  const boxOf = (p) => p.page.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b) return null;
    const tx = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    const first = (n) => (n && n.firstChild ? n.firstChild.textContent.trim() : '');
    return {
      state: b.getAttribute('data-state'),
      wrap: !!b.parentElement && b.parentElement.getClientRects().length > 0,
      head: tx(b.querySelector('.crl-town-h')),
      towns: [...b.querySelectorAll('ol.crl-towns > li.crl-town')].map((li) => ({
        name: tx(li.querySelector('.crl-town-k .crl-town-n')), n: tx(li.querySelector('.crl-town-k .crl-town-c')),
        mine: !!li.querySelector('.crl-town-k .crl-note-me'),
        parts: [...li.querySelectorAll(':scope > p.crl-town-l')].map((l) => ({ label: tx(l),
          items: [...((l.nextElementSibling && l.nextElementSibling.matches('ul.crl-town-tx')) ? l.nextElementSibling.querySelectorAll(':scope > li.crl-town-t') : [])].map(first) })),
      })),
      own: [...b.querySelectorAll('.crl-town-own > li')].map((li) => ({ name: tx(li.querySelector('.crl-town-n')),
        say: tx(li.querySelector('.crl-town-st')), fix: tx(li.querySelector('.crl-town-ed')) })),
      mineHead: tx(b.querySelector('.crl-town-me > .crl-note-h')),
      lock: tx(b.querySelector('.crl-lock')),
      give: tx(b.querySelector('.crl-give .crl-give-h')),
      text: tx(b), html: b.innerHTML,
    };
  }, TBOX);
  /* 「暮らし・家族」のタブ全体：字（属性の値も）と、押せるもの（字と行き先） */
  const tabOf = (p) => p.page.evaluate(() => {
    const t = document.getElementById('pvg-p-living');
    if (!t) return null;
    const vis = (n) => n.getClientRects().length > 0;
    return {
      text: t.textContent.replace(/\s+/g, ' '),
      attrs: [...t.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value)).join('\n'),
      links: [...t.querySelectorAll('a, button')].filter(vis).map((a) => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') || '' })),
    };
  });
  const boards = (p) => p.st.sent.filter((x) => x.fn === 'pv_town_board').length;
  const lastGot = (p, fn) => { const g = p.st.got.filter((x) => x.fn === fn); return g.length ? g[g.length - 1] : null; };
  /* 給与を、その会員としての本物の呼び出しで出す（給与の鍵が生きる）。month を変えると、もう1件 */
  const file = async (who, airline, month = 3) => {
    const y = (await K.L.q(`select extract(year from current_date)::int as y`)).rows[0].y - 1;
    const r = await rpcAs(base, who, 'submit_pay_report', { currency: 'USD', lang: 'en', tax_rate_pct: 0, fleet: FLEET,
      position: 'cap', airline, period_year: y, period_month: month, gross_monthly: 9000 });
    if (!(r.body && r.body.ok === true)) throw new Error(`前提が崩れた（'${who}' の給与が保存されていない）: ` + J(r.body || r.text));
  };
  return { settledBox, life, visit, boxOf, tabOf, boards, lastGot, file };
}

/* ════ 場面 board（B1〜B11）══════════════════════════════════════ */
async function board() {
  const K = await kit();
  const { L, base, page, shut, go, openTown, typeTown, typeIn, pick, tickOwn, send, card, closeSheet, rowsOf, face, swap, sheetIn } = K;
  const { visit, boxOf, tabOf, boards, lastGot, file } = boxKit(K);
  /* 'a' が選ぶ候補（種の最初）・3人が挙げる街（種のうち、名前の並びで最後のもの ＝ 名前で並べ替えると先頭に来ない）・
     'b' が打つ名前（種に無い ＝ 運営の確認を待つ候補）と、その良い点 */
  const T0 = NAMES[0], TOP = NAMES.filter((n) => n !== T0).sort().pop(), WB = '勝どき', GOOD = 'スーパーが近い';
  if (!T0 || !TOP || SEED_NAMES.includes(WB) || [T0, WB, TOP].sort()[0] === TOP) {
    throw new Error(`前提が崩れた（種の街が2つ無い・「${WB}」が種に在る・名前の並びで「${TOP}」が先頭）: ${J(SEED_NAMES)}`);
  }
  /* 欄に出してはいけないもの：一覧の名前（自分の行のぶんは除く）・文・人数（欄の中に「…人」が1つも無い）。
     タブ全体では、台帳のカードに種の名前と運賃の「1人」（片道・1人）が元から在る ── タブで見るのは、打たれた名前・文・「回答 N人」 */
  const leak = (b, own = []) => [T0, TOP, WB].filter((n) => !own.includes(n) && b.html.includes(n))
    .concat([GOOD].filter((t) => b.html.includes(t))).concat(/\d人/.test(b.text) ? ['…人'] : []);
  const tabLeak = (t, own = []) => [WB].filter((n) => !own.includes(n) && (t.text.includes(n) || t.attrs.includes(n)))
    .concat([GOOD].filter((x) => t.text.includes(x) || t.attrs.includes(x))).concat(/回答\s*\d+人/.test(t.text) ? ['回答 N人'] : []);
  await file('pay', SLUG);
  const P = await page({ who: 'pay' });

  await scene('B1 最初の1人から', async () => {
    await visit(P);
    const b0 = await boxOf(P), r0 = lastGot(P, 'pv_town_board');
    const a = await page({ who: 'a' });
    await go(a);
    await openTown(a);
    await pick(a, T0);
    await tickOwn(a);
    const s = await send(a);
    await shut(a);
    await visit(P);
    const b1 = await boxOf(P);
    ok(b0.state === 'empty' && !b0.wrap && r0 && norm(r0.text) === '{"ok":true,"state":"open","towns":[]}' && s.length === 1 && s[0].p.town === T0
      && b1.state === 'open' && b1.wrap && b1.head === TOWN_HEAD && J(b1.towns.map((t) => [t.name, t.n])) === J([[T0, answered(1)]]),
      `★B1 'pay'（この会社の給与）は空の欄（'empty'・器ごと出ない）→ 'a' が面で「${T0}」を選んで送る → 'pay' が読み直すと「${TOWN_HEAD}」・「${T0}」・「${answered(1)}」（1人から出る）`,
      J({ b0: { state: b0.state, wrap: b0.wrap }, r0: r0 && r0.text, s, b1: { state: b1.state, head: b1.head, towns: b1.towns } }));
  });

  await scene('B2 打った名前と良い点は、通るまで誰にも見えない', async () => {
    const bp = await page({ who: 'b' });
    await go(bp);
    await openTown(bp);
    await typeTown(bp, WB);
    await typeIn(bp, 'good', GOOD);
    await tickOwn(bp);
    const s = await send(bp);
    await closeSheet(bp);
    await until(async () => (await boxOf(bp)).own.some((r) => r.name === WB), 20000);
    const own = await boxOf(bp);
    await shut(bp);
    const g0 = P.st.got.length;
    await visit(P);
    const p1 = await boxOf(P), html1 = await P.page.evaluate(() => document.documentElement.outerHTML);
    const wire1 = P.st.got.slice(g0).map((x) => norm(x.text)).join('\n');
    ok(s.length === 1 && s[0].p.town === WB && s[0].p.good === GOOD
      && J(own.own) === J([{ name: WB, say: WAIT_T, fix: FIX_T }]) && own.mineHead === MINE
      && !p1.towns.some((t) => t.name === WB) && !html1.includes(WB) && !html1.includes(GOOD) && !wire1.includes(WB) && !wire1.includes(GOOD),
      `★B2 'b' が「${WB}」と良い点を出す → 'b' の欄に「${MINE}」・「${WB}」・「${WAIT_T}」／通るまで 'pay' のページにも、'pay' が受け取った返事にも、名前も文も無い`,
      J({ s, own: { head: own.mineHead, own: own.own }, p1: p1.towns.map((t) => t.name), html: [html1.includes(WB), html1.includes(GOOD)], wire: [wire1.includes(WB), wire1.includes(GOOD)] }));
    /* 運営（'op'）が名前を通す（rpcAs ＝ 本物の呼び出し） */
    const q1 = await rpcAs(base, 'op', 'pv_town_queue', {});
    const t1 = q1.body && Array.isArray(q1.body.towns) ? q1.body.towns.find((t) => t.name === WB) : null;
    if (!t1) throw new Error(`前提が崩れた（運営の待ち行列に「${WB}」が無い）: ` + J(q1.body));
    const m1 = await rpcAs(base, 'op', 'pv_town_moderate', { target: 'town', id: t1.id, state: 'public' });
    await visit(P);
    const p2 = await boxOf(P), html2 = await P.page.evaluate(() => document.documentElement.outerHTML);
    const w2 = p2.towns.find((t) => t.name === WB);
    ok(m1.body && m1.body.ok === true && !!w2 && w2.n === answered(1) && w2.parts.length === 0 && !html2.includes(GOOD),
      `★B2 運営が名前を通す → 'pay' の欄に「${WB}」と「${answered(1)}」・文はまだ無い（ページのどこにも「${GOOD}」が無い）`, J({ m1: m1.body, w2 }));
    const q2 = await rpcAs(base, 'op', 'pv_town_queue', {});
    const x2 = q2.body && Array.isArray(q2.body.texts) ? q2.body.texts.find((t) => t.town === WB && t.good === GOOD) : null;
    if (!x2) throw new Error(`前提が崩れた（運営の待ち行列に「${WB}」の文が無い）: ` + J(q2.body));
    const m2 = await rpcAs(base, 'op', 'pv_town_moderate', { target: 'text', id: x2.id, state: 'public', rev: x2.rev });
    await visit(P);
    const w3 = (await boxOf(P)).towns.find((t) => t.name === WB);
    ok(m2.body && m2.body.ok === true && !!w3 && J(w3.parts) === J([{ label: GOOD_L, items: [GOOD] }]),
      `★B2 文を rev で通す → 「${WB}」の「${GOOD_L}」の下に「${GOOD}」（打ったとおりの字）`, J({ m2: m2.body, w3 }));
  });

  await scene('B3 並びと数は保存先のとおり', async () => {
    /* ほかの3人が同じ街を挙げる（本物の呼び出し）。数は保存先から数える（検査に数を打ち込まない） */
    for (const who of ['c', 'pilot', 'op']) {
      const r = await rpcAs(base, who, 'submit_town_post', { airline: SLUG, base_iata: BASE, town: TOP, lang: 'ja' });
      if (!(r.body && r.body.ok === true)) throw new Error(`前提が崩れた（'${who}' の街が保存されていない）: ` + J(r.body || r.text));
    }
    await visit(P);
    const b = await boxOf(P), got = lastGot(P, 'pv_town_board');
    let rep = null;
    try { rep = JSON.parse(got.text).towns.map((t) => [t.name, t.n]); } catch { rep = null; }
    const db = (await L.q(
      `select t.name, count(s.id)::int as n from public.pv_towns t join public.pv_town_posts s on s.town_id = t.id
        where t.airline = $1 and t.base_iata = $2 and t.state = 'public' and t.alias_of is null
        group by t.id, t.name, t.tkey order by count(s.id) desc, t.tkey collate "C"`, [SLUG, BASE])).rows.map((r) => [r.name, r.n]);
    const dom = b.towns.map((t) => t.name), want = db.map((r) => answered(r[1]));
    ok(!!rep && J(dom) === J(rep.map((r) => r[0])) && J(rep) === J(db) && J(b.towns.map((t) => t.n)) === J(want)
      && db.length === 3 && db[0][0] === TOP && db[0][1] === 3 && b.towns.every((t) => !/位/.test(t.name + t.n)),
      `★B3 欄の並び ＝ 返事の並び ＝ 保存先の並び（人数の多い順：${db.map((r) => r[0] + ' ' + r[1]).join('・')}）・どの「回答 N人」も保存先の count(*)・順位の字は無い`,
      J({ dom, rep, db, shown: b.towns.map((t) => t.n) }));
  });

  await scene('B4 開いていない3つの形（ログインなし・鍵の無い会員・ほかの会社の給与）', async () => {
    /* 'c' はほかの会社の給与を出した会員（本物の呼び出し・答えは0） */
    await file('c', SLUG === 'ana' ? 'jal' : 'ana');
    /* ログインなし */
    const G = await page();
    await visit(G);
    const gb = await boxOf(G), gr = lastGot(G, 'pv_town_board'), gt = await tabOf(G);
    const gLogin = gt.links.filter((l) => l.text === LOGIN_T);
    let back = '';
    if (gLogin.length === 1) {
      await Promise.all([G.page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
        G.page.evaluate((s, t) => { [...document.querySelectorAll(s + ' a')].find((a) => a.textContent.trim() === t).click(); }, TBOX, LOGIN_T)]);
      const u = new URL(G.page.url());
      back = u.pathname + '?' + (u.searchParams.get('redirect') || '');
    }
    ok(!!gr && norm(gr.text) === LOGIN_STATE && keysOf(gr.text) === 'ok,state' && gb.state === 'locked' && gb.lock === LOCK_LOGIN
      && gb.towns.length === 0 && leak(gb).length === 0 && tabLeak(gt).length === 0
      && gLogin.length === 1 && gt.links.filter((l) => l.text === PAY_GO).length === 0 && back === `/login.html?airlines/${SLUG}.html#life`,
      `★B4 ログインなし：返事は ${LOGIN_STATE} そのもの・欄は「${LOCK_LOGIN}」と、タブにただ1つの「${LOGIN_T}」（押すと #life へ戻る login.html）・名前も文も「…人」も無い`,
      J({ reply: gr && gr.text, box: { state: gb.state, lock: gb.lock, leak: leak(gb) }, tab: tabLeak(gt), login: gLogin, back }));
    await shut(G);
    /* 鍵の無い会員（'pilot'：自分の行が1つある） */
    const I = await page({ who: 'pilot' });
    await visit(I);
    const ib = await boxOf(I), ir = lastGot(I, 'pv_town_board'), it = await tabOf(I);
    ok(!!ir && norm(ir.text) === LOCKED_STATE && keysOf(ir.text) === 'ok,state' && ib.state === 'locked' && ib.lock === LOCK_PAY
      && ib.towns.length === 0 && J(ib.own) === J([{ name: TOP, say: '', fix: FIX_T }]) && leak(ib, [TOP]).length === 0 && tabLeak(it).length === 0
      && it.links.filter((l) => l.text === PAY_GO).length === 1 && it.links.filter((l) => l.text === LOGIN_T).length === 0,
      `★B4 鍵の無い会員（'pilot'）：返事は ${LOCKED_STATE} そのもの・欄は自分の行（「${TOP}」と「${FIX_T}」）と「${LOCK_PAY}」・タブにただ1つの「${PAY_GO}」・ほかの人の名前も文も数も無い`,
      J({ reply: ir && ir.text, box: { state: ib.state, lock: ib.lock, own: ib.own, leak: leak(ib, [TOP]) }, tab: tabLeak(it), links: it.links.map((l) => l.text) }));
    await shut(I);
    /* ほかの会社の給与で、答えがまだ足りない会員（'c'：ANA の給与・自分の行が1つある） */
    const C = await page({ who: 'c' });
    await visit(C);
    const cb = await boxOf(C), cr = lastGot(C, 'pv_town_board'), ct = await tabOf(C);
    let need = NaN;
    try { need = JSON.parse(lastGot(C, 'pv_contrib_give').text).need; } catch { need = NaN; }
    ok(!!cr && norm(cr.text) === GIVE_STATE && keysOf(cr.text) === 'ok,state' && cb.state === 'locked' && Number.isInteger(need) && cb.lock === giveLock(need)
      && !!cb.give && cb.towns.length === 0 && J(cb.own) === J([{ name: TOP, say: '', fix: FIX_T }]) && leak(cb, [TOP]).length === 0 && tabLeak(ct).length === 0
      && ct.links.filter((l) => l.text === GIVE_GO).length === 1 && ct.links.filter((l) => l.text === PAY_GO || l.text === LOGIN_T).length === 0,
      `★B4 ほかの会社の給与で答えが足りない会員（'c'）：返事は ${GIVE_STATE} そのもの・欄は自分の行と「${giveLock(need)}」・答えるカード（入口はただ1つの「${GIVE_GO}」）・ほかの人の名前も文も数も無い`,
      J({ reply: cr && cr.text, box: { state: cb.state, lock: cb.lock, give: cb.give, own: cb.own, leak: leak(cb, [TOP]) }, tab: tabLeak(ct), links: ct.links.map((l) => l.text) }));
    await shut(C);
  });

  await scene('B6 期限切れ・保存領域', async () => {
    const LIST = [T0, TOP, WB, GOOD];
    const expire = () => L.q(`update public.profiles set access_until = now() - interval '1 minute' where id = $1`, [M.pay.id]);
    const stored = (p) => p.page.evaluate((xs) => {
      const all = [];
      for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { const k = s.key(i); all.push(k + '=' + s.getItem(k)); }
      const t = all.join('\n');
      return xs.filter((x) => t.includes(x));
    }, LIST);
    try {
      /* a) 開く前に切れている */
      await expire();
      const E = await page({ who: 'pay' });
      await visit(E);
      const eb = await boxOf(E), er = lastGot(E, 'pv_town_board');
      ok(!!er && norm(er.text) === LOCKED_STATE && eb.state === 'locked' && eb.lock === LOCK_PAY && eb.towns.length === 0 && leak(eb).length === 0 && !/\d人/.test(eb.text),
        `★B6 'pay' の鍵が開く前に切れている：返事は ${LOCKED_STATE}（鍵の無い会員と同じ字）・欄は鍵の1行・名前も数も無い`, J({ reply: er && er.text, state: eb.state, lock: eb.lock, leak: leak(eb) }));
      await shut(E);
      /* b) 生きているあいだに開き（一覧が出ている）、そのあと切れて読み直す */
      await file('pay', SLUG, 4);
      const F = await page({ who: 'pay' });
      await visit(F);
      const fb = await boxOf(F), inStore = await stored(F);
      await expire();
      await visit(F);
      const fb2 = await boxOf(F), fr2 = lastGot(F, 'pv_town_board'), inStore2 = await stored(F);
      ok(fb.state === 'open' && fb.towns.length === 3 && inStore.length === 0 && inStore2.length === 0
        && !!fr2 && norm(fr2.text) === LOCKED_STATE && fb2.state === 'locked' && fb2.towns.length === 0 && leak(fb2).length === 0,
        `★B6 鍵が生きているあいだは一覧が出ていて、local / session の保存領域に一覧の字（名前も文も）は1つも無い → 切れて読み直すと鍵の1行（${LOCKED_STATE}）`,
        J({ open: { state: fb.state, n: fb.towns.length }, inStore, inStore2, after: { reply: fr2 && fr2.text, state: fb2.state, leak: leak(fb2) } }));
      await shut(F);
    } finally {
      await file('pay', SLUG, 5);          // 鍵を、もう1件の本物の給与で生き返らせる
    }
  });

  await scene('B8 2人の会員（同じタブ・ほかのタブ）', async () => {
    const out = async () => { localStorage.removeItem('sb-local-auth-token'); localStorage.removeItem('pv_user'); };
    const shape = async (p, want) => until(async () => { const b = await boxOf(p); return !!b && want(b); }, 15000);
    const isLogin = (b) => b.state === 'locked' && b.lock === LOCK_LOGIN && b.towns.length === 0;
    const isB = (b) => b.state === 'locked' && b.lock === LOCK_PAY && b.towns.length === 0 && J(b.own.map((r) => r.name)) === J([WB]);
    for (const how of ['same', 'tab']) {
      const S = await page({ who: 'pay' });
      await visit(S);
      const s0 = await boxOf(S), n0 = boards(S);
      if (!(s0.state === 'open' && s0.towns.length === 3)) throw new Error(`前提が崩れた（'pay' に一覧が出ていない）: ` + J(s0));
      if (how === 'same') {
        await S.page.evaluate(out);
        await S.page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
      } else {
        const t = await S.ctx.newPage();
        await t.goto(base + '/pv-vocab.json', { waitUntil: 'domcontentloaded' });
        await S.page.bringToFront();
        await t.evaluate(out);
        await t.close();
      }
      const gone = await shape(S, isLogin);
      const s1 = await boxOf(S), n1 = boards(S), r1 = lastGot(S, 'pv_town_board');
      ok(gone && leak(s1).length === 0 && !/\d人/.test(s1.text) && n1 > n0 && !!r1 && norm(r1.text) === LOGIN_STATE,
        `★B8 一覧が出ている 'pay' が${how === 'same' ? '同じタブで' : 'ほかのタブで'}ログアウト → 欄の一覧は消え（名前も文も数も無い）、「${LOCK_LOGIN}」・pv_town_board を読み直した（返事は ${LOGIN_STATE}）`,
        J({ gone, box: { state: s1.state, lock: s1.lock, leak: leak(s1) }, boards: [n0, n1], reply: r1 && r1.text }));
      await swap(S, 'b', how);
      const asB = await shape(S, isB);
      const s2 = await boxOf(S), r2 = lastGot(S, 'pv_town_board');
      ok(asB && leak(s2, [WB]).length === 0 && !!r2 && norm(r2.text) === LOCKED_STATE,
        `★B8 そのあと${how === 'same' ? '同じタブで' : 'ほかのタブで'} 'b' が入る → 'b' の形（自分の行「${WB}」と「${LOCK_PAY}」・返事は ${LOCKED_STATE}）`,
        J({ asB, box: { state: s2.state, lock: s2.lock, own: s2.own, leak: leak(s2, [WB]) }, reply: r2 && r2.text }));
      await shut(S);
    }
  });

  await scene('B9 面はほかの人の回答を読まない', async () => {
    /* 面の候補（pv_town_options の返事が届き、描き終わってから） */
    const chipsOf = async (p) => {
      await until(() => p.st.got.some((x) => x.fn === 'pv_town_options'), 20000);
      await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      return (await face(p)).chips.map((c) => c.name);
    };
    const G = await page();
    await visit(G);
    const g0 = boards(G);
    await openTown(G);
    const gChips = await chipsOf(G);
    await pick(G, T0);
    await typeIn(G, 'good', '面の中で打った字');
    const g1 = boards(G);
    await shut(G);
    await visit(P);
    const p0 = boards(P);
    await openTown(P);
    const pChips = await chipsOf(P);
    await typeTown(P, WB);
    await tickOwn(P);
    const p1 = boards(P);
    ok(J(gChips) === J(SEED_NAMES) && J(pChips) === J(gChips) && !gChips.includes(WB) && g1 === g0 && p1 === p0
      && G.st.sent.filter((x) => x.fn === 'pv_town_options').every((x) => J(x.p) === J({ airline: SLUG, base: BASE })),
      `★B9 通った会員の名前「${WB}」は面の候補に無い（ログインなしも 'pay' も同じ候補：${gChips.join('・')}）・面を開いて使っても pv_town_board は増えない`,
      J({ gChips, pChips, guest: [g0, g1], pay: [p0, p1] }));
    /* 'pay' がその名前を打って送る → その場で数に入る（確認待ちが付かない） */
    const s = await send(P), c = await card(P), rows = await rowsOf('pay');
    ok(s.length === 1 && s[0].p.town === WB && !!c && c.rows.town && c.rows.town.v === WB && c.rows.town.wait === ''
      && rows.length === 1 && rows[0].town === WB && rows[0].town_state === 'public',
      `★B9 'pay' が「${WB}」を打って送る → 保存後のカードに「${WAIT_T}」が無い（town_state 'public' ＝ その場で数に入る）`, J({ s, card: c && c.rows.town, rows }));
    await closeSheet(P);
    /* B11 その保存で、読み直さずに pv_town_board が1本だけ・数が上がる */
    const up = await until(async () => { const b = await boxOf(P); const w = b && b.towns.find((t) => t.name === WB); return !!w && w.n === answered(2); }, 20000);
    const p2 = boards(P);
    ok(up && p2 === p1 + 1,
      `B11 街の保存（topic 'town'）のあと、読み直さずに pv_town_board が1本だけ出て、「${WB}」は「${answered(2)}」`, J({ up, boards: [p1, p2] }));
    /* B11 月の勤務を面で保存しても、欄は読み直さない（一覧の節は同じもの） */
    await P.page.evaluate((s) => { const ol = document.querySelector(s + ' ol.crl-towns'); if (ol) ol.__pvtMark = 1; }, TBOX);
    await P.page.evaluate(() => window.PVContrib.open({ topic: 'work' }));
    await sheetIn(P, `const f = r.querySelector('form[data-pvc-form="work"]'), s = f && f.querySelector('fieldset.pvc-set'); return !!s && !s.disabled;`);
    const WF = '.pvc-root form[data-pvc-form="work"]';
    await P.page.select(`${WF} select[name="position"]`, 'cap');
    await P.page.$eval(`${WF} [name="block_hours"]`, (n) => { n.focus(); n.value = ''; n.dispatchEvent(new Event('input', { bubbles: true })); });
    await P.page.keyboard.type('60');
    if (!(await P.page.$eval(`${WF} input[name="own"]`, (n) => n.checked))) await P.page.click(`${WF} label.pvc-own`);
    const w0 = P.st.got.filter((x) => x.fn === 'submit_work_month').length;
    await P.page.click(`${WF} .pvc-send[type="submit"]`);
    await P.page.waitForFunction(() => !!document.querySelector('.pvc-root [data-pvc-saved]'), { timeout: 20000 });
    await closeSheet(P);
    /* 保存の合図のあと、欄の読み直しが走るなら次の1手で始まる（later ＝ setTimeout 0）── その手を2回流してから見る */
    await P.page.evaluate(() => new Promise((r) => setTimeout(() => setTimeout(r, 0), 0)));
    const wr = P.st.got.filter((x) => x.fn === 'submit_work_month').slice(w0);
    const same = await P.page.evaluate((s) => { const b = document.querySelector(s), ol = b && b.querySelector('ol.crl-towns'); return { st: b && b.getAttribute('data-state'), mark: !!(ol && ol.__pvtMark === 1) }; }, TBOX);
    let wok = false;
    try { wok = wr.length === 1 && JSON.parse(wr[0].text).ok === true; } catch { wok = false; }
    ok(wok && boards(P) === p2 && same.st === 'open' && same.mark,
      'B11 月の勤務を面で保存しても（topic \'work\'）、pv_town_board は増えず、欄の一覧の節は同じもの（描き直していない）', J({ wok, boards: [p2, boards(P)], same }));
  });

  await scene('B10 つながっていない（pv_town_board が無い）', async () => {
    const def = (await L.q(`select pg_get_functiondef('public.pv_town_board(jsonb)'::regprocedure) as d`)).rows[0].d;
    await L.q(`drop function public.pv_town_board(jsonb)`);
    try {
      const O = await page({ who: 'pay' });
      await visit(O);
      const ob = await boxOf(O);
      const how = await openTown(O);
      ok(ob.state === 'off' && ob.text === OFF_T && how === 'page',
        `B10 欄は「${OFF_T}」だけ・ページの入口（＋住みやすい街を追加）は見えていて、押すと街の面が開く`, J({ state: ob.state, text: ob.text, how }));
      await shut(O);
    } finally {
      /* 同じ関数を戻す（db/towns.sql の定義そのもの ＝ 落とす前に保存先から読んだ字）と、同じ権限 */
      await L.q(def);
      await L.q(`revoke all on function public.pv_town_board(jsonb) from public`);
      await L.q(`grant execute on function public.pv_town_board(jsonb) to anon, authenticated`);
    }
    const back = await rpcAs(base, null, 'pv_town_board', { airline: SLUG, base: BASE });
    ok(back.status === 200 && norm(back.text) === LOGIN_STATE, `B10 終わったら関数を戻した（ログインなしの返事は ${LOGIN_STATE} に戻る）`, J({ status: back.status, text: back.text }));
  });
}

/* ════ 場面 admin（AD1〜AD7）══════════════════════════════════════ */
async function admin() {
  const K = await kit();
  const { L, base, page, shut, go, openTown, typeTown, typeIn, tickOwn, send, card, face, loginVia, deposits } = K;
  const { visit, boxOf, file } = boxKit(K);
  if (!STAY_IATA || !AIR_JA) throw new Error(`前提が崩れた（${SLUG} のページに就航地の都市が無い・pv-airlines.json に名前が無い）`);
  /* 'a' が打つ名前と文（文は「20万円」を含む ＝ 通貨の切り替えで字が変わらないこと）・運営が足す街・ログインなしの街・ホテル */
  const WN = '晴海', WT = '家賃は20万円くらい', NT = '有明', NA = '天王洲', HOTEL = '手元検査ホテル';
  if ([WN, NT, NA].some((n) => SEED_NAMES.includes(n))) throw new Error(`前提が崩れた（検査の名前が種に在る）: ${J(SEED_NAMES)}`);
  const ADM = async (who, w = 1440, lang = 'ja') => {
    const p = await page({ who, w, h: 900 });
    await p.page.goto(`${base}/${lang === 'en' ? 'en/' : ''}admin.html`, { waitUntil: 'load', timeout: 60000 });
    return p;
  };
  /* 運営の画面：数（承認の横）が読み終わり、承認の面が開いている */
  const ready = async (p) => {
    await p.page.waitForFunction(() => { const n = document.getElementById('adm-n'); return !!n && n.getAttribute('data-state') === 'ok'; }, { timeout: 30000 });
    if (await p.page.$eval('#adm-q', (e) => e.hidden)) await p.page.click('#adm-b-q');
  };
  const reload = async (p) => { await p.page.reload({ waitUntil: 'load', timeout: 60000 }); await ready(p); };
  /* 門だけの画面（ログインなし・運営ではない会員）：門の字が決まるまで */
  const gated = async (p, msg) => {
    await p.page.waitForFunction((m) => { const g = document.getElementById('gate-msg'); return !!g && g.textContent.trim() === m; }, { timeout: 30000 }, msg);
    return p.page.evaluate(() => ({ bar: !!document.getElementById('adm-top') && document.getElementById('adm-top').getClientRects().length > 0,
      dash: getComputedStyle(document.getElementById('dashboard')).display, rows: document.querySelectorAll('#adm-q li').length }));
  };
  const badge = (p) => p.page.$eval('#adm-n', (n) => n.textContent.trim());
  const rowsAdm = (p) => p.page.evaluate(() => [...document.querySelectorAll('#adm-q li.adm-row')].map((li) => ({
    kind: li.getAttribute('data-adm'), id: li.getAttribute('data-id'),
    v: ((li.querySelector('.adm-row-v') || {}).textContent || '').trim(), t: [...li.querySelectorAll('.adm-row-t')].map((x) => x.textContent) })));
  /* 保存先で数えた確認待ち（名前・文は db/towns.sql の待ち行列の決まり／ステイ先は、その待ち行列の返事の数） */
  const waiting = async () => {
    const t = (await L.q(`select
        (select count(*)::int from public.pv_towns t where t.state = 'pending' and t.alias_of is null
            and exists (select 1 from public.pv_town_posts s where s.town_id = t.id)) as towns,
        (select count(*)::int from public.pv_town_posts s join public.pv_towns t on t.id = s.town_id
          where s.text_state = 'pending' and t.state <> 'rejected') as texts`)).rows[0];
    const sq = await rpcAs(base, 'op', 'pv_stay_queue', {});
    const st = sq.body && sq.body.ok === true && Array.isArray(sq.body.places) && Array.isArray(sq.body.photos) ? sq.body.places.length + sq.body.photos.length : NaN;
    return t.towns + t.texts + st;
  };
  const press = async (p, sel, act) => {
    const h = await p.page.evaluateHandle((s) => document.querySelector(s), sel);
    if (!h.asElement()) throw new Error(`前提が崩れた（押す所が無い: ${sel}）`);
    await p.page.click(`${sel} [data-act="${act}"]`);
  };
  const rowSel = async (p, kind, test) => {
    const id = await p.page.evaluate((k, src) => {
      const f = new Function('li', src);
      const li = [...document.querySelectorAll(`#adm-q li.adm-row[data-adm="${k}"]`)].find((x) => f(x));
      return li ? li.getAttribute('data-id') : null;
    }, kind, test);
    return id ? `#adm-q li.adm-row[data-adm="${kind}"][data-id="${id}"]` : null;
  };
  await file('pay', SLUG);
  /* 運営が開く前から待っているもの（数が0から始まらないように）：'pilot' が打った名前と文（2つ）・ログインなしのホテル（1つ） */
  const pre = [await rpcAs(base, 'pilot', 'submit_town_post', { airline: SLUG, base_iata: BASE, town: '佃', good: '検査の前から待っている文', lang: 'ja' }),
    await rpcAs(base, null, 'pv_stay_add', { airline: SLUG, iata: STAY_IATA, kind: 'hotel', name: '検査の前から待っているホテル' })];
  if (!pre.every((r) => r.body && r.body.ok === true)) throw new Error('前提が崩れた（前から待っているもの）: ' + J(pre.map((r) => r.body || r.text)));
  const O = await ADM('op');
  await ready(O);
  let w0 = 0;

  await scene('AD1 運営の数と、会員が出した名前と文', async () => {
    w0 = await waiting();
    const n0 = await badge(O);
    const top = await O.page.evaluate(() => {
      const b = document.getElementById('adm-top'), h = document.querySelector('#dashboard h1');
      return !!b && !!h && b.getClientRects().length > 0 && b.getBoundingClientRect().bottom <= h.getBoundingClientRect().top;
    });
    const a = await page({ who: 'a' });
    await go(a);
    await openTown(a);
    await typeTown(a, WN);
    await typeIn(a, 'good', WT);
    await tickOwn(a);
    const s = await send(a);
    await shut(a);
    await reload(O);
    const n1 = await badge(O), w1 = await waiting(), rs = await rowsAdm(O);
    ok(top && n0 === String(w0) && s.length === 1 && w1 === w0 + 2 && n1 === String(w0 + 2)
      && rs.some((r) => r.kind === 'town' && r.v === WN) && rs.some((r) => r.kind === 'text' && r.t.includes(WT)),
      `★AD1 運営の画面の一番上に「承認」と数・数は保存先で数えた確認待ち（${w0}）→ 'a' が面で「${WN}」と良い点を出す → 読み直すと2つ上がり（${w0 + 2}）、名前の行と文の行が出る`,
      J({ top, n0, w0, s: s.map((x) => x.p.town), n1, w1, rows: rs.map((r) => r.kind + ':' + (r.v || r.t.join('|'))) }));
  });

  await scene('AD2 ほかの人には、運営の数も行も無い', async () => {
    const A = await ADM('a'), G = await ADM(null);
    const ga = await gated(A, GATE_NOADMIN), gg = await gated(G, GATE_LOGIN);
    const qa = await rpcAs(base, 'a', 'pv_town_queue', {});
    const seen = [];
    for (const who of ['b', 'c', 'pay', 'pilot', null]) {
      for (const [fn, p] of [['pv_town_queue', {}], ['pv_town_board', { airline: SLUG, base: BASE }], ['pv_town_options', { airline: SLUG, base: BASE }], ['my_town_posts', { airline: SLUG }]]) {
        const r = await rpcAs(base, who, fn, p), t = norm(r.text);
        if (t.includes(WN) || t.includes(WT)) seen.push(`${who || 'ログインなし'}:${fn}`);
      }
    }
    const calls = [...A.st.calls, ...G.st.calls].filter((c) => /^pv_(town|stay)_/.test(c));
    ok(!ga.bar && ga.dash === 'none' && ga.rows === 0 && !gg.bar && gg.dash === 'none' && gg.rows === 0 && calls.length === 0
      && norm(qa.text) === FORBIDDEN && seen.length === 0,
      `★AD2 会員 'a' とログインなしの /admin.html は門だけ（「承認」も数も行も無い・待ち行列を呼ばない）・'a' の pv_town_queue は ${FORBIDDEN} そのもの・待っている「${WN}」と文は、ほかの会員のどの返事にも無い`,
      J({ ga, gg, calls, qa: qa.text, seen }));
    await shut(A);
    await shut(G);
  });

  await scene('AD3 「承認」を2行に押す', async () => {
    const ts = await rowSel(O, 'town', `return li.querySelector('.adm-row-v').textContent.trim() === ${J(WN)};`);
    if (!ts) throw new Error(`前提が崩れた（「${WN}」の行が無い）`);
    await press(O, ts, 'ok');
    await O.page.waitForFunction((s) => !document.querySelector(s), { timeout: 20000 }, ts);
    const xs = await rowSel(O, 'text', `return [...li.querySelectorAll('.adm-row-t')].some((x) => x.textContent === ${J(WT)});`);
    if (!xs) throw new Error(`前提が崩れた（「${WT}」の文の行が無い）: ` + J(await rowsAdm(O)));
    const shown = await O.page.$$eval(`${xs} .adm-row-t`, (ns) => ns.map((n) => n.textContent));
    await press(O, xs, 'ok');
    await O.page.waitForFunction((s) => !document.querySelector(s), { timeout: 20000 }, xs);
    await until(async () => (await badge(O)) === String(w0), 10000);
    const n = await badge(O);
    const P = await page({ who: 'pay' });
    await visit(P);
    const b = await boxOf(P), w = b.towns.find((t) => t.name === WN);
    ok(n === String(w0) && J(shown) === J([WT]) && !!w && w.n === answered(1) && J(w.parts) === J([{ label: GOOD_L, items: [WT] }]),
      `AD3 名前と文の行に「承認」→ 数は ${w0} に戻る・'pay' の欄に「${WN}」（${answered(1)}）と「${WT}」── 運営の画面と同じ字、打ったとおり`,
      J({ n, shown, w }));
    await shut(P);
  });

  await scene('AD4 「追加」→ 街', async () => {
    await O.page.click('#adm-b-a');
    await O.page.waitForSelector('#adm-a form[data-adm="add-town"] select[data-k="scope"] option:nth-child(2)', { timeout: 20000 });
    const v = await O.page.$eval('#adm-a form[data-adm="add-town"] select[data-k="scope"]', (s, want) => {
      const o = [...s.options].find((x) => x.textContent === want);
      return o ? o.value : null;
    }, `${AIR_JA} · ${BASE}`);
    if (v === null) throw new Error(`前提が崩れた（「${AIR_JA} · ${BASE}」の選択肢が無い）`);
    await O.page.select('#adm-a form[data-adm="add-town"] select[data-k="scope"]', v);
    await O.page.type('#adm-a form[data-adm="add-town"] input[data-k="name"]', NT);
    await O.page.click('#adm-a form[data-adm="add-town"] button[type="submit"]');
    await O.page.waitForFunction((t) => { const s = document.querySelector('#adm-a form[data-adm="add-town"] [data-adm="add-say"]'); return !!s && s.textContent.trim() === t; }, { timeout: 20000 }, ADDED_ADM);
    const G = await page();
    await visit(G);
    await openTown(G);
    await until(() => G.st.got.some((x) => x.fn === 'pv_town_options'), 20000);
    await G.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const chips = (await face(G)).chips.map((c) => c.name);
    await shut(G);
    const P = await page({ who: 'pay' });
    await visit(P);
    const b = await boxOf(P);
    await shut(P);
    ok(chips.includes(NT) && !b.towns.some((t) => t.name === NT) && b.state === 'open',
      `AD4 運営が「追加」で「${NT}」を足す（「${ADDED_ADM}」）→ ログインなしの面の候補に出る・'pay' の「${TOWN_HEAD}」には出ない（誰も挙げていない）`,
      J({ chips, towns: b.towns.map((t) => t.name) }));
  });

  await scene('AD5 ログインなしの街は、ログインしてから数える', async () => {
    const g = await page();
    await go(g);
    await openTown(g);
    await typeTown(g, NA);
    await tickOwn(g);
    const s = await send(g, 'submit_contrib_anon');
    await reload(O);
    const n1 = await badge(O), w1 = await waiting();
    await g.page.goto(`${base}/login.html?return=/airlines/${SLUG}.html`, { waitUntil: 'load', timeout: 60000 });
    await loginVia(g, 'pilot');
    const claimed = await until(async () => (await deposits()).length === 0, 20000);
    await reload(O);
    const n2 = await badge(O), rs = await rowsAdm(O);
    ok(s.length === 1 && n1 === String(w0) && w1 === w0 && claimed && n2 === String(w0 + 1) && rs.some((r) => r.kind === 'town' && r.v === NA),
      `AD5 ログインなしで「${NA}」を保存しても、運営の数は ${w0} のまま → その人が 'pilot' としてログインし、預けた街が引き継がれると ${w0 + 1}（「${NA}」の行）`,
      J({ s: s.length, n1, w1, claimed, n2, rows: rs.map((r) => r.kind + ':' + r.v) }));
    await shut(g);
  });

  await scene('AD6 ログインなしで足したホテル', async () => {
    /* オーナーではない運営 ── この使い捨ての保存先の中だけで、会員 'c' を運営の名簿に入れる */
    await L.q(`insert into public.pv_admins (user_id, note) values ($1, '検査：オーナーではない運営（使い捨ての保存先だけ）') on conflict (user_id) do nothing`, [M.c.id]);
    await reload(O);
    const n0 = Number(await badge(O));
    const SL = '#pvg-city .crl[data-live="hotels"]', ZN = `${SL} + .crs-zone`, FM = `${ZN} .crs-formbox > .crs-form`;
    const g = await page({ w: 1440, h: 820 });
    await g.page.goto(`${base}/airlines/${SLUG}.html#stay-${STAY_IATA}`, { waitUntil: 'load', timeout: 60000 });
    await g.page.waitForFunction((s, code) => {
      const e = document.querySelector(s);
      return !!e && e.getClientRects().length > 0 && e.getAttribute('data-stay') === code && !/^(idle|loading)$/.test(e.dataset.state || '')
        && !!(e.nextElementSibling && e.nextElementSibling.classList.contains('crs-zone'));
    }, { timeout: 30000 }, SL, STAY_IATA);
    await g.page.click(`${ZN} .crs-ent[data-kind="hotel"]`);
    await g.page.waitForSelector(`${FM} [data-k="name"]`, { visible: true });
    await g.page.focus(`${FM} [data-k="name"]`);
    await g.page.keyboard.type(HOTEL);
    await g.page.click(`${FM} button[type="submit"]`);
    await until(() => g.st.got.some((x) => x.fn === 'pv_stay_add'), 20000);
    const added = g.st.got.filter((x) => x.fn === 'pv_stay_add');
    let ab = null;
    try { ab = JSON.parse(added[0].text); } catch { ab = null; }
    const sentAdd = g.st.sent.filter((x) => x.fn === 'pv_stay_add');
    await shut(g);
    await reload(O);
    const n1 = Number(await badge(O)), rs1 = await rowsAdm(O);
    const W = { airline: SLUG, iata: STAY_IATA };
    const reads = async () => {
      const o = {};
      for (const who of ['pilot', 'pay', 'c', null]) o[who || 'guest'] = await rpcAs(base, who, 'pv_stays', W);
      return o;
    };
    const r1 = await reads();
    const leaked = Object.entries(r1).filter(([, r]) => norm(r.text).includes(HOTEL)).map(([k]) => k);
    ok(sentAdd.length === 1 && !('key' in (sentAdd[0].p || {})) && ab && ab.ok === true && ab.item && ab.item.state === 'pending'
      && n1 === n0 + 1 && rs1.some((r) => r.kind === 'place' && r.v === HOTEL) && leaked.length === 0,
      `★AD6 ログインしていない画面から「${HOTEL}」を足す（確認待ち）→ 運営の数は1つ上がり（${n0}→${n1}）、その行が出る・まだ誰の返事にも無い（'pilot'・'pay'・'c'・ログインなし）`,
      J({ sent: sentAdd.map((x) => x.p), reply: ab, n0, n1, leaked }));
    const ps = await rowSel(O, 'place', `return li.querySelector('.adm-row-v').textContent.trim() === ${J(HOTEL)};`);
    if (!ps) throw new Error(`前提が崩れた（「${HOTEL}」の行が無い）`);
    /* ★P12.53：同じ確認待ちのホテルに、2つの面が出す押し所（管理ページの行の全部のボタン ⇄ オーナーの都市の欄のそのカードの
       承認・却下・削除）は、同じ数・同じ字・同じ並び。欄はオーナー 'op' として開く（見てよい人＝ほかの人の確認待ちも返る） */
    const admActs = await O.page.evaluate((s) => [...document.querySelectorAll(s + ' .adm-acts button')].map((b) => b.textContent.trim()), ps);
    const v = await page({ who: 'op', w: 1440, h: 820 });
    await v.page.goto(`${base}/airlines/${SLUG}.html#stay-${STAY_IATA}`, { waitUntil: 'load', timeout: 60000 });
    const cardOf = `return [...document.querySelectorAll(s + ' .crs-card')].find((c) => ((c.querySelector('.crs-name') || {}).textContent || '').trim() === nm) || null;`;
    const seenCard = await v.page.waitForFunction((s, code, nm, src) => {
      const e = document.querySelector(s);
      return !!e && e.getAttribute('data-stay') === code && e.dataset.state === 'open' && !!new Function('s', 'nm', src)(s, nm);
    }, { timeout: 30000 }, SL, STAY_IATA, HOTEL, cardOf).then(() => true, () => false);
    const slotActs = await v.page.evaluate((s, nm, src) => {
      const c = new Function('s', 'nm', src)(s, nm);
      return c ? [...c.querySelectorAll('button[data-act="pub"], button[data-act="rej"], button[data-act="del"]')].map((b) => b.textContent.trim()) : null;
    }, SL, HOTEL, cardOf);
    await shut(v);
    ok(seenCard && admActs.length > 0 && J(slotActs) === J(admActs),
      `★AD6 確認待ちの「${HOTEL}」に、管理ページの行とオーナーの都市の欄が出す押し所は同じ（${admActs.join('・')}）── 欄に「公開」も「削除」も無い`,
      J({ seenCard, admin: admActs, slot: slotActs }));
    await press(O, ps, 'ok');
    await O.page.waitForFunction((s) => !document.querySelector(s), { timeout: 20000 }, ps);
    await until(async () => (await badge(O)) === String(n0), 10000);
    const n2 = Number(await badge(O)), r2 = await reads();
    const names = (r) => (r.body && Array.isArray(r.body.places) ? r.body.places.map((x) => x.name) : []);
    ok(n2 === n0 && r2.pilot.body && r2.pilot.body.state === 'open' && names(r2.pilot).includes(HOTEL)
      && norm(r2.pay.text) === LOCKED_STATE && norm(r2.c.text) === LOCKED_STATE && !norm(r2.guest.text).includes(HOTEL),
      `★AD6 「承認」→ 数は戻り、オーナーが承認した 'pilot' には「${HOTEL}」が届く・給与の鍵だけの 'pay' とオーナーではない運営 'c' には ${LOCKED_STATE} そのもの`,
      J({ n2, pilot: names(r2.pilot), pay: r2.pay.text, c: r2.c.text, guest: r2.guest.text.slice(0, 120) }));
  });

  await scene('AD6b オーナーが自分で足した確認待ちのホテル', async () => {
    const OWN = '手元検査ホテル（オーナーの追加）', OWN_T = '自分が出したものは、別の運営が確認します。', PUB_T = '公開しました。';
    const SL = '#pvg-city .crl[data-live="hotels"]';
    const W = { airline: SLUG, iata: STAY_IATA };
    const add = await rpcAs(base, 'op', 'pv_stay_add', { ...W, kind: 'hotel', name: OWN });
    if (!(add.body && add.body.ok === true && add.body.item && add.body.item.state === 'pending')) throw new Error('前提が崩れた（オーナーの追加が確認待ちにならない）: ' + add.text.slice(0, 200));
    await reload(O);
    const ps = await rowSel(O, 'place', `return li.querySelector('.adm-row-v').textContent.trim() === ${J(OWN)};`);
    if (!ps) throw new Error(`前提が崩れた（「${OWN}」の行が無い）`);
    const admActs = await O.page.evaluate((s) => [...document.querySelectorAll(s + ' .adm-acts button')].map((b) => b.textContent.trim()), ps);
    const v = await page({ who: 'op', w: 1440, h: 820 });
    await v.page.goto(`${base}/airlines/${SLUG}.html#stay-${STAY_IATA}`, { waitUntil: 'load', timeout: 60000 });
    const cardOf = `return [...document.querySelectorAll(s + ' .crs-card')].find((c) => ((c.querySelector('.crs-name') || {}).textContent || '').trim() === nm) || null;`;
    const seenCard = await v.page.waitForFunction((s, code, nm, src) => {
      const e = document.querySelector(s);
      return !!e && e.getAttribute('data-stay') === code && e.dataset.state === 'open' && !!new Function('s', 'nm', src)(s, nm);
    }, { timeout: 30000 }, SL, STAY_IATA, OWN, cardOf).then(() => true, () => false);
    const slotActs = await v.page.evaluate((s, nm, src) => {
      const c = new Function('s', 'nm', src)(s, nm);
      return c ? [...c.querySelectorAll('button[data-act="pub"], button[data-act="rej"], button[data-act="del"]')].map((b) => b.textContent.trim()) : null;
    }, SL, OWN, cardOf);
    ok(seenCard && admActs.length > 0 && J(slotActs) === J(admActs),
      `★AD6b オーナーが自分で足した確認待ちの「${OWN}」にも、管理ページの行とオーナーの都市の欄が出す押し所は同じ（${admActs.join('・')}）── 欄に「削除」は無い`,
      J({ seenCard, admin: admActs, slot: slotActs }));
    /* 欄の「承認」を押す（本物の押し方）→ サーバーの own_post の文が欄に出る */
    const n0 = v.st.sent.filter((x) => x.fn === 'pv_stay_moderate').length;
    await v.page.evaluate((s, nm, src) => { const c = new Function('s', 'nm', src)(s, nm); const b = c && c.querySelector('button[data-act="pub"]'); if (b) b.setAttribute('data-test-own', ''); }, SL, OWN, cardOf);
    const hasPub = !!(await v.page.$('[data-test-own]'));
    if (hasPub) await v.page.click('[data-test-own]');
    const said = await until(() => v.page.evaluate((s, t) => { const e = document.querySelector(s), z = e && e.nextElementSibling; return ((e ? e.textContent : '') + (z ? z.textContent : '')).includes(t); }, SL, OWN_T), 15000);
    const text = await v.page.evaluate((s) => { const e = document.querySelector(s), z = e && e.nextElementSibling; return (e ? e.textContent : '') + (z ? z.textContent : ''); }, SL);
    const mods = v.st.sent.filter((x) => x.fn === 'pv_stay_moderate').slice(n0).map((x) => x.p);
    const replies = v.st.got.filter((x) => x.fn === 'pv_stay_moderate').map((x) => norm(x.text));
    const still = (await L.q(`select state from public.pv_stay_places where name = $1`, [OWN])).rows.map((r) => r.state);
    const pr = await rpcAs(base, 'pilot', 'pv_stays', W);
    const pilotSees = norm(pr.text).includes(OWN);
    await shut(v);
    ok(hasPub && said && !text.includes(PUB_T) && mods.length === 1 && replies.some((t) => t.includes('own_post')) && J(still) === J(['pending']) && !pilotSees,
      `★AD6b 欄で自分の分の「承認」を押すと、サーバーが断り「${OWN_T}」が出る ──「${PUB_T}」は出ない・確認待ちのまま・'pilot' にも届かない`,
      J({ hasPub, said, mods, replies, still, pilotSees }));
  });

  await scene('AD7 オーナーの2つの一覧（申請してきた人・会員一覧）', async () => {
    const W = { airline: SLUG, iata: STAY_IATA };
    const reads = async (who) => (await rpcAs(base, who, 'pv_stays', W));
    const opens = (r) => !!r.body && r.body.state === 'open' && Array.isArray(r.body.places) && r.body.places.some((x) => x.name === HOTEL);
    const imgs = async (who) => (await L.q(`select count(*)::int as n from public.pv_proof_images where user_id = $1`, [M[who].id])).rows[0].n;
    const offers = async (who) => (await L.q(`select count(*)::int as n from public.pv_proof where user_id = $1`, [M[who].id])).rows[0].n;
    const viewer = async (who) => (await L.q(`select to_jsonb(v) as j from public.pv_stay_viewers v where user_id = $1`, [M[who].id])).rows[0]?.j || null;
    const verifies = (p, from = 0) => p.st.sent.filter((x) => x.fn === 'pv_stay_viewer_verify').slice(from).map((x) => x.p);
    /* マイページ（日本語・英語）から、その場で描いた FIXTURE の画像で申請する（ファイルは作らない） */
    const apply = async (who, lang) => {
      const p = await page({ who, w: 390, h: 844 });
      await p.page.goto(`${base}/${lang === 'en' ? 'en/' : ''}profile.html`, { waitUntil: 'load', timeout: 60000 });
      await p.page.waitForSelector('#pv-proof-slot .mp-cta', { timeout: 30000 });
      /* 押すのは、ページの読みが全部答え、書体がそろい、ボタンが10コマ続けて同じ位置になってから
         （マイページのほかの欄が読み込みで伸びると、押した点がずれて外れる ── 混んだ回に、製品は正しいのにここで止まっていた） */
      await until(() => p.st.got.filter((x) => !x.fn.includes('/')).length >= p.st.sent.length, 20000);
      await p.page.evaluate(() => document.fonts.ready.then(() => true));
      await p.page.waitForFunction(() => {
        const b = document.querySelector('#pv-proof-slot .mp-cta');
        if (!b) return false;
        const y = Math.round(b.getBoundingClientRect().top + window.scrollY), k = window.__pvtCta || (window.__pvtCta = { y: NaN, n: 0 });
        k.n = k.y === y ? k.n + 1 : 0;
        k.y = y;
        return k.n >= 10;
      }, { timeout: 20000, polling: 'raf' });
      await p.page.click('#pv-proof-slot .mp-cta');
      await p.page.waitForSelector('#pvpo-back input[type=file]', { timeout: 10000 });
      await p.page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 480; c.height = 240;
        const g = c.getContext('2d');
        g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 480, 240);
        g.fillStyle = '#1b1b1b'; g.font = 'bold 64px sans-serif'; g.fillText('FIXTURE', 92, 140);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'fixture.jpg', { type: 'image/jpeg' }));
        const i = document.querySelector('#pvpo-back input[type=file]');
        i.files = dt.files;
        i.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await p.page.waitForSelector('#pvpo-back [data-act="send"]:not([disabled])', { timeout: 20000 });
      await p.page.click('#pvpo-back [data-act="send"]');
      await p.page.waitForFunction(() => { const t = document.getElementById('pvpo-t'); return !!t && /受け取りました|received/.test(t.textContent); }, { timeout: 20000 });
      const sent = p.st.sent.filter((x) => x.fn === 'pv_stay_apply' && x.p && typeof x.p.image === 'string').length;
      await shut(p);
      return sent;
    };
    const ownerReady = async (p) => {
      await ready(p);
      await p.page.waitForFunction(() => !!document.querySelector('#adm-q h2[data-adm-owner="members"]'), { timeout: 30000 });
    };
    const APP = (who) => `#adm-q li[data-adm="app"][data-id="${M[who].id}"]`, MEM = (who) => `#adm-q li[data-adm="member"][data-id="${M[who].id}"]`;
    /* 画像の面を開く → 画像が読み終わるまで。返すのは画像の大きさと頭の字・行のボタン */
    const sheet = async (p, who) => {
      const acts0 = await p.page.$$eval(`${APP(who)} > .adm-acts [data-act]`, (ns) => ns.map((n) => n.getAttribute('data-act')));
      await p.page.click(`${APP(who)} [data-act="view"]`);
      await p.page.waitForSelector(`${APP(who)} .adm-sheet [data-act="verify"]`, { timeout: 20000 });
      await p.page.waitForFunction((s) => { const i = document.querySelector(s + ' .adm-sheet img'); return !!i && i.complete && i.naturalWidth > 0; }, { timeout: 20000 }, APP(who));
      const img = await p.page.$eval(`${APP(who)} .adm-sheet img`, (i) => ({ w: i.naturalWidth, h: i.naturalHeight, head: i.getAttribute('src').slice(0, 23) }));
      return { acts0, img };
    };
    const cleanOf = (p) => p.page.evaluate((words) => ({
      owner: document.querySelectorAll('#adm-q [data-adm-owner], #adm-q li[data-adm="app"], #adm-q li[data-adm="member"], .adm-sheet').length,
      words: words.filter((w) => document.body.textContent.includes(w)),
      img: document.querySelectorAll('img.adm-img').length + (document.documentElement.outerHTML.includes('data:image/jpeg') ? 1 : 0),
    }), OWNER_WORDS);
    const FOUR = (id, other) => [['pv_stay_applicants', {}], ['pv_stay_members', {}], ['pv_stay_applicant_image', { id }],
      ['pv_stay_viewer_verify', { id: other, state: 'approved', via: 'member' }]];

    /* 1) 'a' がマイページから申請（日本語・390）。申請だけでは何も開かない */
    const sa = await apply('a', 'ja');
    const ia = await imgs('a'), ra0 = await reads('a');
    if (!(sa === 1 && ia === 1 && norm(ra0.text) === LOCKED_STATE)) throw new Error('前提が崩れた（a の申請）: ' + J({ sa, ia, ra0: ra0.text }));

    /* 2) 申請が待っているあいだの、ほかの人 ── オーナーではない運営 'c'・ほかの会員 'pay'・ログインなし */
    const Cp = await ADM('c');
    await ready(Cp);
    const cv = await cleanOf(Cp);
    const cGot = Cp.st.got.filter((x) => x.fn === 'pv_stay_applicants' || x.fn === 'pv_stay_members').map((x) => norm(x.text));
    const cFour = [];
    for (const [fn, p] of FOUR(M.a.id, M.b.id)) cFour.push(norm((await rpcAs(base, 'c', fn, p)).text));
    const Pp = await ADM('pay'), Gp = await ADM(null);
    const pg = await gated(Pp, GATE_NOADMIN), gg = await gated(Gp, GATE_LOGIN);
    const pv = await cleanOf(Pp), gv = await cleanOf(Gp);
    const pageCalls = [...Pp.st.calls, ...Gp.st.calls].filter((c) => /^pv_stay_/.test(c));
    const pFour = [], gFour = [];
    for (const [fn, p] of FOUR(M.a.id, M.b.id)) {
      pFour.push(norm((await rpcAs(base, 'pay', fn, p)).text));
      const r = await rpcAs(base, null, fn, p);
      gFour.push({ status: r.status, ok: !!(r.body && r.body.ok === true), text: r.text.slice(0, 200) });
    }
    const b64 = (await L.q(`select encode(bytes, 'base64') as b from public.pv_proof_images where user_id = $1`, [M.a.id])).rows[0].b.replace(/\s+/g, '').slice(0, 40);
    const leaks = (ts) => ts.some((t) => t.includes(b64) || t.includes(M.a.email));
    const vb = await viewer('b');
    ok(cv.owner === 0 && cv.words.length === 0 && cv.img === 0 && cGot.length === 2 && cGot.every((t) => t === FORBIDDEN) && cFour.every((t) => t === FORBIDDEN)
      && vb === null && !leaks([...cGot, ...cFour]),
      `★AD7 申請が待っているあいだ、オーナーではない運営 'c' の /admin.html には2つの一覧も画像も無く（${OWNER_WORDS.join('・')} の字も無い）、ページの2つの読みとオーナーの4つの口は ${FORBIDDEN} そのもの・'b' には何も書かれない`,
      J({ cv, cGot, cFour, vb }));
    ok(!pg.bar && pg.dash === 'none' && !gg.bar && gg.dash === 'none' && pv.owner === 0 && pv.img === 0 && gv.owner === 0 && gv.img === 0 && pageCalls.length === 0
      && pFour.every((t) => t === FORBIDDEN) && gFour.every((x) => x.status !== 200 && !x.ok) && !leaks([...pFour, ...gFour.map((x) => x.text)]),
      `★AD7 ほかの会員 'pay' とログインなしの /admin.html は門だけ（一覧も画像も無い・オーナーの口を呼ばない）・'pay' の4つの口は ${FORBIDDEN}・ログインなしは4つとも通らない（画像の字もメールも返らない）`,
      J({ pg, gg, pv, gv, pageCalls, pFour, gFour }));
    await shut(Cp); await shut(Pp); await shut(Gp);

    /* 3) オーナー（'op'）：申請してきた人 →「画像を見る」→「verified」→ 'a' がホテルを読める */
    const Op = await ADM('op');
    await ownerReady(Op);
    const sh = await sheet(Op, 'a');
    const v0 = verifies(Op).length;
    await press(Op, `${APP('a')} .adm-sheet`, 'verify');
    await Op.page.waitForFunction((s) => !document.querySelector(s), { timeout: 20000 }, APP('a'));
    /* 待ちで止めない（verified にならなければ、この下の1行が赤くなる） */
    await Op.page.waitForSelector(`${MEM('a')} [data-act="revoke"]`, { timeout: 20000 }).catch(() => null);
    const tagA = await Op.page.$$eval(`${MEM('a')} .adm-tag`, (ns) => ns.map((n) => n.textContent.trim()));
    const ia2 = await imgs('a'), oa2 = await offers('a'), va = await viewer('a'), ra1 = await reads('a');
    ok(J(sh.acts0) === J(['view']) && sh.img.w === 480 && sh.img.h === 240 && sh.img.head === 'data:image/jpeg;base64,'
      && J(verifies(Op, v0)) === J([{ id: M.a.id, state: 'approved', via: 'applicant' }])
      && ia2 === 0 && oa2 === 0 && !!va && va.state === 'approved' && va.decided_by === M.op.id && opens(ra1) && tagA.includes('verified'),
      `★AD7 'a' がマイページから FIXTURE の画像で申請 → オーナーの「申請してきた人」に 'a'（行のボタンは「画像を見る」だけ）→ 画像（480×240）→「verified」→ 画像と申請は保存先から消え、'a' は ${SLUG} の ${STAY_IATA} のホテル（「${HOTEL}」）を読める・「会員一覧」の 'a' は verified`,
      J({ acts0: sh.acts0, img: sh.img, sent: verifies(Op, v0), ia2, oa2, va: va && { state: va.state, by: va.decided_by }, ra1: ra1.text.slice(0, 160), tagA }));
    /* 'a' の会社ページのステイ先の欄にも、そのホテル（鍵の1行は無い） */
    const Ap = await page({ who: 'a', w: 390, h: 844 });
    await Ap.page.goto(`${base}/airlines/${SLUG}.html#stay-${STAY_IATA}`, { waitUntil: 'load', timeout: 60000 });
    const seeA = await Ap.page.waitForFunction((h) => document.body.innerText.includes(h), { timeout: 30000 }, HOTEL).then(() => true, () => false);
    const lockA = await Ap.page.evaluate(() => [...document.querySelectorAll('.crs-lock')].filter((e) => e.getClientRects().length).length);
    ok(seeA && lockA === 0, `AD7 'a' の会社ページ（#stay-${STAY_IATA}）に「${HOTEL}」が出る・鍵の1行は無い`, J({ seeA, lockA }));
    await shut(Ap);
    /* 「取り消す」→ 次の読みは鍵。'a' は画像で verified になった人なので、取り消したあとの行に「verified」は無く、
       本人が新しい画像を出すまで画像なしでは決められないことを書く（Q1・2026-10-18。サーバーの reapply をそのまま描く） */
    const v1 = verifies(Op).length;
    await press(Op, MEM('a'), 'revoke');
    await Op.page.waitForSelector(`${MEM('a')} [data-adm="reapply"]`, { timeout: 20000 });
    const ra2 = await reads('a');
    const rowA = await Op.page.evaluate((sel) => { const li = document.querySelector(sel), r = li && li.querySelector('[data-adm="reapply"]');
      return { btns: li ? [...li.querySelectorAll('button')].map((b) => b.getAttribute('data-act')) : null, say: r ? r.textContent : null }; }, MEM('a'));
    ok(J(verifies(Op, v1)) === J([{ id: M.a.id, state: 'revoked', via: 'member' }]) && norm(ra2.text) === LOCKED_STATE
      && J(rowA.btns) === '[]' && rowA.say === REAPPLY_T,
      `★AD7 「会員一覧」の 'a' に「取り消す」→ {id, state:'revoked', via:'member'} だけを送り、'a' の次の読みは ${LOCKED_STATE}・画像で verified になっていた 'a' の行には「verified」が無く、新しい画像が要ると書く（Q1）`, J({ sent: verifies(Op, v1), ra2: ra2.text, rowA }));
    /* 4) 「会員一覧」の「verified」（申請していない 'b'）も同じ */
    const rb0 = await reads('b'), v2 = verifies(Op).length;
    await press(Op, MEM('b'), 'verify');
    await Op.page.waitForSelector(`${MEM('b')} [data-act="revoke"]`, { timeout: 20000 });
    const rb1 = await reads('b'), vbb = await viewer('b');
    ok(norm(rb0.text) === LOCKED_STATE && J(verifies(Op, v2)) === J([{ id: M.b.id, state: 'approved', via: 'member' }]) && opens(rb1)
      && !!vbb && vbb.state === 'approved' && vbb.decided_by === M.op.id,
      `★AD7 「会員一覧」の 'b' に「verified」→ 'b' も「${HOTEL}」を読める（前は ${LOCKED_STATE}）`, J({ rb0: rb0.text, sent: verifies(Op, v2), rb1: rb1.text.slice(0, 160) }));
    await shut(Op);
    /* 5) いま verified の人の申請に「見送り」：承認を取り上げない（英語の画面・390）。
          verified になった人は自分からは申請できない（pv_stay_apply が受け取らない）ので、'pay' が申請してから、
          その承認を保存先の持ち主として書く（db/test-stays.mjs の P12.17 と同じ置き方 ── 画面ではこの形を作れない） */
    const sp = await apply('pay', 'en');
    await L.q(`insert into public.pv_stay_viewers (user_id, state, asked_at, decided_by, decided_at) values ($1, 'approved', now(), $2, now())
                on conflict (user_id) do update set state = 'approved', decided_by = excluded.decided_by, decided_at = excluded.decided_at`, [M.pay.id, M.op.id]);
    const vp0 = await viewer('pay'), rp0 = await reads('pay');
    const En = await ADM('op', 390, 'en');
    await ownerReady(En);
    const she = await sheet(En, 'pay');
    const v3 = verifies(En).length;
    await press(En, `${APP('pay')} .adm-sheet`, 'decline');
    await En.page.waitForFunction((s) => !document.querySelector(s), { timeout: 20000 }, APP('pay'));
    /* 待ちで止めない（承認が取り上げられたら、この下の1行が赤くなる） */
    await En.page.waitForSelector(`${MEM('pay')} [data-act="revoke"]`, { timeout: 20000 }).catch(() => null);
    const vp1 = await viewer('pay'), rp1 = await reads('pay'), ip1 = await imgs('pay'), op1 = await offers('pay');
    ok(sp === 1 && opens(rp0) && she.img.w === 480 && J(verifies(En, v3)) === J([{ id: M.pay.id, state: 'denied', via: 'applicant' }])
      && J(vp1) === J(vp0) && opens(rp1) && ip1 === 0 && op1 === 0,
      `★AD7 いま verified の 'pay' の申請に、オーナーが英語の画面（390）で「Decline」→ 承認の行は1文字も変わらず、'pay' は「${HOTEL}」を読めるまま・申請は終わる（画像は消える）`,
      J({ sp, sent: verifies(En, v3), vp0, vp1, rp1: rp1.text.slice(0, 160), ip1, op1 }));
    await shut(En);
  });
}

/* ════ 場面 tap（T1）══════════════════════════════════════════ */
async function tap() {
  const K = await kit();
  const { base } = K;
  for (const [w, h] of [[1440, 820], [390, 844]]) {
    await scene(`T1 開いた直後の「暮らし・家族」（${w}×${h}）`, async () => {
      const touch = w < 900;
      const p = await K.page({ w, h, touch });
      /* 最初のフレームから毎フレーム、タブの位置（ページの中の上端）を書き留める。読み終えた瞬間（load）には、
         タブの見えている所（ほかの物が重なっていない所）のまんなかも書き留める ＝ 人がそのとき狙う所 */
      await p.page.evaluateOnNewDocument(() => {
        window.__t1 = { tops: [], at: null, clicks: [], stop: false };
        const T = window.__t1, q = '#pvg-tabs [data-pvg-tab="life"]';
        const spot = () => {
          const a = document.querySelector(q);
          if (!a) return null;
          const b = a.getBoundingClientRect(), y = b.top + b.height / 2, run = [];
          for (let x = Math.max(1, b.left + 4); x < Math.min(innerWidth - 1, b.right - 4); x += 4) { const e = document.elementFromPoint(x, y); if (e && a.contains(e)) run.push(x); }
          return run.length ? { x: run[Math.floor(run.length / 2)], y } : null;
        };
        const frame = () => {
          const a = document.querySelector(q);
          if (a) { const y = Math.round(a.getBoundingClientRect().top + scrollY); if (T.tops[T.tops.length - 1] !== y) T.tops.push(y); }
          if (!T.stop) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        addEventListener('load', () => { T.at = spot(); });
        document.addEventListener('click', (e) => { const t = e.target; T.clicks.push(t && t.closest && t.closest('[data-pvg-tab]') ? 'tab:' + t.closest('[data-pvg-tab]').getAttribute('data-pvg-tab') : (t && t.tagName) || '?'); }, true);
      });
      await p.page.goto(`${base}/airlines/${SLUG}.html`, { waitUntil: 'load', timeout: 60000 });
      /* 星の欄に答えが来て、そのあと2フレーム描かれるまで（どの答えでもよい：開いた・0件・落ちた・口が無い） */
      const settled = await until(() => p.page.evaluate(() => { const s = document.querySelector('.pvg-hero .crl[data-live="stars"]'); return !!s && !/^(idle|loading)$/.test(s.getAttribute('data-state') || ''); }), 20000);
      await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const T = await p.page.evaluate(() => { window.__t1.stop = true; return { tops: window.__t1.tops.slice(), at: window.__t1.at }; });
      ok(settled && T.tops.length === 1,
        `★T1 ${w}×${h}：最初に描かれてから星の欄に答えが来るまで、「暮らし・家族」のタブは1pxも動かない`, J({ settled, tops: T.tops }));
      if (touch) return;
      /* 読み終えた瞬間に狙った所を、本物の押す・離すで押す（間の 90ms は押している長さ。ページを待つ時間ではない） */
      const cdp = await p.page.createCDPSession();
      if (T.at) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: T.at.x, y: T.at.y });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: T.at.x, y: T.at.y, button: 'left', clickCount: 1 });
        await new Promise((r) => setTimeout(r, 90));
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: T.at.x, y: T.at.y, button: 'left', clickCount: 1 });
      }
      const on = await until(() => p.page.evaluate(() => document.body.classList.contains('pvg-at-life')), 3000);
      const clicks = await p.page.evaluate(() => window.__t1.clicks.slice());
      ok(!!T.at && on && clicks[0] === 'tab:life',
        `★T1 ${w}×${h}：読み終えた瞬間にタブが在った所を人の速さで押すと、「暮らし・家族」に切り替わる`, J({ at: T.at, on, clicks }));
    });
  }
}

/* 場面ごとに：止まったら1行の失敗にして次の場面へ（どの場面も自分の保存先を持つ）。終わったら窓を閉じ、保存先を消す。 */
const closeAll = async () => {
  for (const p of PAGES) { try { await p.ctx.close(); } catch { /* もう閉じてある */ } }
  for (const L of BROUGHT) await L.stop().catch(() => {});
};
try {
  for (const s of want) {
    try { await SCENES[s](); }
    catch (e) { ok(false, `場面が途中で止まった（${s}）`, String(e && e.stack || e).slice(0, 600)); }
    finally { await closeAll(); }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const L of BROUGHT) await L.stop().catch(() => {});
}
/* 閉じの行（どの実行でも出す） */
const blocked = PAGES.flatMap((p) => [...p.st.blocked]), supa = PAGES.flatMap((p) => [...p.st.supa]), errs = PAGES.flatMap((p) => p.st.errs);
console.log('');
ok(PAGES.length > 0 && blocked.length === 0 && supa.length === 0,
  `★どのページ（${PAGES.length}枚）の st.blocked と st.supa も空 ── 手元と書体・部品の配信元のほかへ、1本も投げていない`, J({ blocked, supa }));
ok(errs.length === 0, '★どのページにも、スクリプトの止まり（pageerror）が無い', J(errs));
console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exitCode = fail ? 1 : 0;
