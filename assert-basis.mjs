/* ════════════════════════════════════════════════════════════════
   assert-basis.mjs — 「その数字は誰の、何を含んだ、どの時点の金額か」が
   画面と検索結果の両方で正しく出ているかを見る。

   check-salary.mjs との違い ──
     あちらは「載っている金額が SSOT と合っているか」を見る。
     金額を消したページは、あちらでは ✅ になる。だが
       ・検索結果に出る紹介文や、検索エンジンが読む年収欄に古い金額が残っている
       ・数字は消したが「平均」という札だけ残っている
       ・「推計平均」「参考値」と名前を変えて残してある
       ・出所を画面に出していない
     はどれも通ってしまう。そこを見るのがこちら。

   ⚠️ check-salary.mjs は社名と数字の間に24文字しか許さず、その間に数字が
      挟まると諦める。だから紹介文・OG・構造化データを一度も見ていない。
      ここが見ていなかった場所そのものなので、head を必ず見る。

   ★2026-09-30、オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」で
     **「確認中」の等級を使っている会社は0社になった**（全部「推定」に戻した）。
     A) D) G) は「確認中」の職位だけを見る検査なので、いまは1件も鳴らない。
     ⚠️ **消さない。** 等級 held は「本当に数字が1つも無い会社」のために残してあり、
        次に1社でも held に置いた瞬間、この3本がその社を見張る側に戻る。
     いま実際に効いているのは B) C) D) I) J) ── とくに D) は「推定の数字に
     『平均年収』の札を付け直す」ことを禁じている（①は「平均をやめる」を
     取り消していない）。

   見るもの（すべて salary-basis.mjs の23社・日英)
     A) 確認中にした元の金額が head（題名・紹介文・OG・構造化データ）に残っていないか〔いま休眠〕
        ── 万円の形（3,700万）でも、生の円（37000000）でも探す
     B) 「推計平均」「参考値」で言い換えて残していないか（オーナーが明示的に却下）
     C) 出所の節（PV-BASIS）が在るか。確認日とリンクが在るか
     D) 「平均」と名乗れない職位に「平均年収」の札が残っていないか
     E) 総待遇に現金給与や住宅・学費をもう一度足す書き方になっていないか
     F) 英語版で「税引前」と「非課税」が同じページに同居していないか
     G) 全部が確認中の会社の構造化データに、年収欄が残っていないか〔いま休眠〕
     H) 画面に出した出所（リンク・確認日）が台帳と一致しているか
     I) 一覧ページ（world-airlines）の会社カードが台帳どおりか
        ── カードは1行しか出せないので、出してよいのは「年額の現金」だけ。
           総待遇を他社の現金と並べない・月額を12倍して年額にしない・
           確認中の社に金額を出さない・「平均」の札を残さない
     J) 会社ページの旧い帯が戻っていないか（2026-10-08 に全会社ページから外した）
        ── 「パイロット転職を検討中の方へ」の橙の帯と、その直後の
           「国別で比べる／同じ国の他社」の箱（PV-CLINK）がページに無い・
           道具（link-countries / gen-new-airline / gen-faq）が書かない・
           残すべき入口（他社と比較・footer・世界一覧の国の帯）は残っている

   使い方: node assert-basis.mjs [--v]
   ════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { BASIS, TIERS, figures } from './salary-basis.mjs';
import { SALARY } from './salary-data.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const V = process.argv.includes('--v');
/* 推定の社の「画面にこう出ていてほしい額」。年収の唯一の正は salary-data.mjs なので、
   台帳ではなくこちらから取る（台帳に数字を持たせると更新の場所が2つになる）。 */
const yenMan = (slug, rank = 'cap') => {
  const v = SALARY[slug]?.[rank]?.avg;
  return v == null ? '' : `\u00a5${v.toLocaleString('en-US')}\u4e07`;
};

const RANKS = { cap: '機長', fo: '副操縦士', crew: '運航乗務員', trainee: '訓練生' };

/* ★ 監査（第6版）の対象23社。**ここは手で書いた固定の一覧**で、BASIS から作らない。
   BASIS の鍵を巡回するだけだと、対象社が BASIS から**抜け落ちたことに気づけない**
   （実際に中国国際航空・中国東方航空の2社が抜けていた。2026-09-29 オーナー経由の
   レビュー・指摘2）。オーナーが挙げた順のまま並べてある。 */
const AUDIT_23 = [
  /* 日本 6社 */
  'ana', 'jal', 'skymark', 'zipair', 'peach', 'jetstar-japan',
  /* アジア 11社 */
  'singapore-airlines', 'cathay-pacific', 'korean-air', 'eva-air', 'thai-airways',
  'air-india', 'air-china', 'china-eastern', 'china-southern', 'china-airlines', 'starlux',
  /* 中東 6社 */
  'emirates', 'etihad', 'qatar-airways', 'saudia', 'gulf-air', 'oman-air',
];

/* 監査の対象ではないが、同じ扱いに揃えた会社（関連・追加対象）。
   ここに入れた社は「23社」の数には入れない。消すためのリストではない。 */
const EXTRA = ['j-air', 'malaysia-airlines'];

let fail = 0, warn = 0, ok = 0;
const bad = (f, msg) => { fail++; console.log(`❌ ${f}\n   ${msg}`); };
const soft = (f, msg) => { warn++; console.log(`⚠️  ${f}\n   ${msg}`); };

/** head だけを切り出す。<body> より前に、題名・紹介文・OG・構造化データが全部入っている。 */
const headOf = (html) => {
  const i = html.search(/<body[\s>]/i);
  return i < 0 ? html : html.slice(0, i);
};

/** 万円の額を、ページに書かれうる形すべてに広げる（1500 → 1,500万 / 1500万 / 15000000 / 15,000,000）。 */
const forms = (man) => {
  const yen = man * 10000;
  return [
    `${man.toLocaleString('en-US')}万`,
    `${man}万`,
    String(yen),
    yen.toLocaleString('en-US'),
  ];
};

/** その職位で「平均」と言っていいか。 */
const avgOk = (slug, rank) => !!TIERS[BASIS[slug][rank]?.tier]?.avg;

/* ── 対象集合の照合。ページを1枚も読む前に、まずここで落ちる ───────────── */
{
  const have = new Set(Object.keys(BASIS));
  const miss = AUDIT_23.filter((s2) => !have.has(s2));
  if (miss.length) {
    bad('salary-basis.mjs', `監査対象23社のうち${miss.length}社が BASIS に無い → ${miss.join(', ')}\n   （対象から外すのではなく、等級を決めて足す。決まっていなければ held で置く）`);
  }
  const extra = [...have].filter((s2) => !AUDIT_23.includes(s2) && !EXTRA.includes(s2));
  if (extra.length) {
    soft('salary-basis.mjs', `監査対象23社・関連対象${EXTRA.length}社のどちらにも無い社が BASIS に居る → ${extra.join(', ')}\n   （足したのが意図どおりなら EXTRA に書き足す。数えるときに23社に混ざらないようにするため）`);
  }
  if (AUDIT_23.length !== 23) bad('assert-basis.mjs', `AUDIT_23 が${AUDIT_23.length}社になっている（23社であるはず）`);
}

for (const slug of Object.keys(BASIS)) {
  const b = BASIS[slug];

  for (const lang of ['ja', 'en']) {
    const rel = lang === 'ja' ? `airlines/${slug}.html` : `en/airlines/${slug}.html`;
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { bad(rel, 'ページが無い'); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const head = headOf(html);
    let pageBad = 0;
    const hit = (m) => { bad(rel, m); pageBad++; };

    /* ── A) 確認中の元の金額が head に残っていないか ───────────────── */
    for (const [rank, nm] of Object.entries(RANKS)) {
      const r = b[rank];
      if (!r?.held?.was) continue;
      if (r.tier !== 'held') continue;      // 金額を載せ直した職位は対象外
      for (const [k, v] of Object.entries(r.held.was)) {
        if (v == null) continue;
        for (const f of forms(v)) {
          /* 生の円は6桁以上なので他の数と当たりにくい。万円の形は
             「1,500万」のように短いので、head の中でも紹介文・題名・
             構造化データに限れば、そのページ自身の会社の話しかしていない。
             ただし FAQ の答えは他社に触れるので、他社名の直後は見逃す。 */
          let from = 0;
          for (;;) {
            const i = head.indexOf(f, from);
            if (i < 0) break;
            from = i + 1;
            const before = head.slice(Math.max(0, i - 40), i);
            /* 他社の話（「ANA機長は年約2,700万円」）は check-salary.mjs が見る。
               ここでは自社の数字として出ているものだけ捕まえる。 */
            if (/[（(]\s*(ANA|JAL|全日空|日本航空|エミレーツ|カタール|シンガポール)/.test(before)) continue;
            if (/(ANA|JAL|全日空|日本航空|Emirates|Qatar|Singapore|ANA機長|JAL機長)[^。]{0,12}$/.test(before)) continue;
            hit(`確認中にした${nm}の${k}（${v}万円）が head に残っている → 「${f}」\n   …${head.slice(Math.max(0, i - 60), i + f.length + 20).replace(/\s+/g, ' ')}…`);
            break;
          }
        }
      }
    }

    /* ── B) 言い換えて残していないか ─────────────────────────────── */
    /* ⚠️ 金額のそばだけを見る。フッターの断り書きは、どの金額のことも
         指していない（全ページに在る）。ここが捕まえたいのは
         「機長 参考値 ¥2,500万」のように、根拠不明の平均を名前だけ変えて
         金額と並べて残す形。
       ★2026-09-30、フッターの「掲載データは参考値です。」は掃除で
         「掲載データは当サイトの推計です。」に変わった（349枚・1503件）。
       ⚠️ **「推定」をこの表に足さない。** 却下されたのは「推計平均」＝
          平均を名乗り直す言い方で、「推定」はオーナー自身が選んだ語
          （「確認中じゃなくて推定とかにすりゃいいじゃん」）。
          足すと、指示どおりに直した画面が全部赤くなる。 */
    for (const w of lang === 'ja' ? ['推計平均', '参考値'] : ['estimated average', 'reference value']) {
      let from = 0;
      for (;;) {
        const i = html.indexOf(w, from);
        if (i < 0) break;
        from = i + 1;
        const near = html.slice(Math.max(0, i - 120), i + 120);
        if (!/([¥$€£]\s?[\d,]{3,}|[\d,]{3,}\s?万|\d{2,3}K)/.test(near)) continue;
        hit(`「${w}」で言い換えて金額と並べている（オーナーが却下した言い方）\n   …${near.replace(/\s+/g, ' ')}…`);
        break;
      }
    }

    /* ── C) 出所の節が在るか ────────────────────────────────────
       ★2026-09-30、**全職位が推定の会社には出所の節を求めない。**
         あの節は「会社が出している金額を載せているので、その出所を示す」ためにある。
         推定だけの会社に載っているのは当サイトが公開情報から出した数字で、
         出所として示すべき会社の資料がそもそも無い（オーナー指示で節そのものを消した）。
       ⚠️ 代わりに**別のことを必ず見る** ── 「これは当サイトの推計で、会社が公表した額ではない」
          と画面に書いてあるか。ここを外すと、推定の数字が会社の公表額として読まれる。
          節を消したぶんの歯止めはこの1行だけなので、消さない。 */
    const allEst = ['cap', 'fo', 'crew', 'trainee']
      .filter((r) => b[r]).every((r) => b[r].tier === 'estimate');
    const hasBasis = /id="kyuyo-konkyo"/.test(html);
    if (allEst) {
      const saysEst = lang === 'ja'
        ? /当サイトが推計|当サイトの推計|推定年収/.test(html)
        : /our own estimate|our estimate|estimated salary/i.test(html);
      if (!saysEst) {
        hit(lang === 'ja'
          ? '全職位が推定なのに「当サイトが推計した金額（会社の公表額ではない）」と画面に書いていない'
          : 'every rank is our estimate, but the page never says the figures are our own estimate');
      }
    } else if (!hasBasis) {
      hit('出所の節（id="kyuyo-konkyo"）が無い。この金額が誰の・何を含んだ・いつの金額かを画面に出していない');
    } else {
      /* 節の終わり。3つの形がある ──
           昔からの節    … 「▲ /PV-BASIS」の目印まで
           畳んだ箱      … id が <details> に付いている（先行5社。給与の1枚の「この金額は誰の・何を含んだ・いつの金額か」）。
                            その箱を閉じる </details> まで。中に入れ子の <details> は無い（gen-airline-glance.mjs の payDetails）
           どちらでもない … 先頭の 8000字
         ★ 畳んだ箱を 8000字で切らない。箱が短いと、うしろに続く別のカード（募集・会社）の確認日とリンクまで
           拾って、出どころが1つも無いのに通る。 */
      const at = html.indexOf('id="kyuyo-konkyo"');
      const sec = html.slice(at);
      const folded = /<details\b[^>]*$/.test(html.slice(Math.max(0, at - 200), at));
      const end = folded ? sec.indexOf('</details>') : sec.indexOf('▲ /PV-BASIS');
      const blk = end > 0 ? sec.slice(0, end) : sec.slice(0, 8000);
      if (!/確認日|Checked/i.test(blk)) hit('出所の節に確認日が無い（確認日 ≠ 発行日）');
      /* 外部の資料は https、このサイト自身の資料は相対リンク（H を参照）。 */
      const selfLinked = (b.src || []).some((s) => /pilot-value\.com/.test(s.url)
        && new RegExp(`href="[^"]*${s.url.split('/').pop()}"`).test(blk));
      if (!/<a [^>]*href="https?:/.test(blk) && !selfLinked) hit('出所の節に資料へのリンクが無い');
    }

    /* ── D) 確認中の職位に「平均」の札が残っていないか ──────────────
       ⚠️ 捕まえたいのは「札 ＋ 金額」の組。
          「機長・副操縦士の平均年収 ／ 公表なし」のように、札の後ろに金額が
          出てこない書き方は**正しい**（会社が出していないことを言っている）。
          札の文字だけで落とすと、正直に書いたページが赤くなり、
          次に触る人が「検査を避ける言い換え」を探し始める。 */
    for (const [rank, nm] of Object.entries(RANKS)) {
      if (!b[rank] || avgOk(slug, rank)) continue;
      const pats = lang === 'ja'
        ? [new RegExp(`${nm}[^。<]{0,8}平均年収`, 'g'), new RegExp(`平均年収[^。<]{0,8}${nm}`, 'g')]
        : [];
      for (const re of pats) {
        for (const m of html.matchAll(re)) {
          /* 札と金額は同じ一文（または同じ表の行）に居る。文の切れ目で止めないと、
             「ANA は機長の平均年収を公表しておらず…」の次の文に出てくる
             別会社の金額を、この会社の札だと読み違える。 */
          let after = html.slice(m.index, m.index + m[0].length + 90);
          const dot = after.indexOf('。');
          if (dot > 0) after = after.slice(0, dot);
          if (!/([¥$€£]\s?[\d,]{3,}|[\d,]{3,}\s?万|\d{2,3}K)/.test(after)) continue;
          hit(`${nm}は「${TIERS[b[rank].tier].ja}」なのに「平均年収」の札で金額を出している → 「${
            after.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 60)}」`);
          break;
        }
      }
    }

    /* ── E) 二重加算の書き方 ─────────────────────────────────── */
    const dbl = lang === 'ja'
      ? /(総待遇|パッケージ)[^。]{0,120}?(加えると|足すと|上乗せ|プラスすると)/
      : /(total package|package)[^.]{0,140}?(on top of (this|that)|add(ing)? .{0,30}on top)/i;
    const dm = html.match(dbl);
    if (dm) hit(`総待遇にもう一度足す書き方が残っている → 「${dm[0].slice(0, 90).replace(/\s+/g, ' ')}」`);

    /* ── F) 非課税の国なのに英語版が「税引前」と書いていないか ────── */
    /* ⚠️ 課税の国では "pre-tax unless marked tax-free" は正しい注記なので見ない。
         捕まえたいのは、所得税が無い国の会社で金額に「税引前」と札を付けている形
         （エミレーツ・エティハド・カタール・ガルフ・サウディアの英語版）。 */
    if (lang === 'en' && /^非課税/.test(b.tax || '') && /pre-tax/i.test(html)) {
      const m = html.match(/.{0,60}pre-tax.{0,40}/i);
      hit(`所得税が無い国の会社なのに "pre-tax"（税引前）と書いている → 「${(m?.[0] || '').replace(/\s+/g, ' ')}」`);
    }

    /* ── G) 全部が確認中なのに構造化データに年収欄が残っていないか ── */
    const allHeld = ['cap', 'fo', 'crew'].every((r) => !b[r] || b[r].tier === 'held');
    if (allHeld && /"estimatedSalary"/.test(head)) {
      hit('金額を公開できる職位が1つも無いのに、構造化データに年収欄（estimatedSalary）が残っている');
    }

    /* ── H) 画面の出所が台帳と一致しているか ───────────────────
       ⚠️ 出所がこのサイト自身のページのこともある（スターラックスの採用試験ガイド）。
          そのときは本番の絶対URLを画面に書かず、相対リンクで指すのが正しい。
          台帳の url が pilot-value.com なら、末尾のファイル名で照合する。
       ★2026-10-21（全社へ広げる d1 の続き・同じ強さの当て直し）：生成器が書く会社ページはリンクの「&」を HTML の決まりどおり
         「&amp;」で書く（中国東方航空の人材会社の求人 …detail.aspx?u=28&JobType=0）。同じ住所なので、その書き方でも在ると数える。 */
    const shownHere = (u) => {
      if (html.includes(u) || html.includes(u.replace(/&/g, '&amp;'))) return true;
      const own = u.match(/^https?:\/\/(?:www\.)?pilot-value\.com\/(.+)$/);
      return !!own && new RegExp(`href="[^"]*${own[1].split('/').pop()}"`).test(html);
    };
    if (hasBasis && b.src?.length) {
      const shown = b.src.filter((s) => shownHere(s.url)).length;
      if (!shown) {
        hit(`台帳に出所が${b.src.length}件あるのに、画面にそのリンクが1本も出ていない`);
      } else if (shown < b.src.length && V) {
        soft(rel, `台帳の出所${b.src.length}件のうち画面に出ているのは${shown}件`);
      }
    }

    if (!pageBad) { ok++; if (V) console.log(`✅ ${rel}`); }
  }
}

/* ── I) 一覧ページの会社カード ──────────────────────────────────
   world-airlines.html の1枚のカードは「札＋金額」の1行しか持てない。
   そこに何を出してよいかは台帳で決まる。ここが腐ると、各社ページを
   全部直しても**一覧だけが古い平均を出し続ける**（画面は普通に動く）。 */
{
  const rel = 'airlines-meta.js';
  const meta = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  /* カードに出してよいのは年額の現金だけ。pkg_y（総待遇）と月額は入れない。 */
  const YEARLY_CASH = new Set(['cash_y', 'cash_y_over', 'max_y', 'target_y', 'avg_y', 'reward_y', 'month_x']);

  for (const slug of Object.keys(BASIS)) {
    const row = meta.match(new RegExp(`^\\{code:[^\\n]*?file:'airlines/${slug}\\.html'[^\\n]*$`, 'm'))?.[0];
    if (!row) { bad(rel, `${slug} の行が無い（一覧カードに出ない）`); continue; }
    const sal = row.match(/salary:'([^']*)'/)?.[1] ?? '';
    const note = row.match(/salNote:'([^']*)'/)?.[1] ?? '';
    const f = (figures(slug, 'cap') || []).find((x) => YEARLY_CASH.has(x.key) && !x.training);
    /* ★2026-09-30、推定の社は台帳に掲載額が1件も無い（推定の金額は SALARY にある）。
         ここで f が無いことを「確認中」の証拠にすると、推定に戻した20社が全部落ちる。 */
    const isEst = BASIS[slug].cap?.tier === 'estimate';

    if (isEst) {
      const want = yenMan(slug);
      if (sal !== want) bad(rel, `${slug}：一覧カードの金額が推定（SSOT）とずれている → 画面「${sal}」／SSOT「${want}」`);
      /* 札は持たなくてよい ── 持たない社は world-airlines.html の既定の札に落ちて、
         そこが「機長 推定年収」になっている（下でその既定そのものを見ている）。
         札を持つならそれも「推定」と名乗っていること。 */
      if (note && !note.includes('推定')) {
        bad(rel, `${slug}：機長は推定なのに一覧カードの札が「${note}」（「推定」と名乗っていない）`);
      }
    } else if (!f) {
      /* ★2026-09-30。台帳に年額が無い（＝会社が出しているのは月額だけ）社は、
           カードには**推定の年収**を出す（オーナー指示「確認中じゃなくて推定とかにすりゃいいじゃん」）。
           推定は台帳の外の87社と同じ作りなので、他社の現金と同じ列に並べられる。
         ⚠️ ここで必ず見るのは「月額を12倍した数字になっていないか」。
            サウディア・中国南方・中国東方は月額の広告しか無いので、12倍が一番やりがちな間違い
            （オーナーが名指しで禁止）。SSOT の推定と一致していることを条件にすれば、
            12倍の数字はそもそも通らない。 */
      const want = yenMan(slug);
      if (sal !== want) {
        bad(rel, `${slug}：一覧カードの金額が推定（SSOT）とずれている → 画面「${sal}」／SSOT「${want}」\n   （この社は台帳に年額が無い。月額を12倍して年額にしない・総待遇を他社の現金と並べない）`);
      }
      const x12 = (figures(slug, 'cap') || []).filter((y) => /_m$/.test(y.key) || y.monthly)
        .map((y) => `¥${(y.man * 12).toLocaleString('en-US')}万`);
      if (x12.includes(sal)) {
        bad(rel, `${slug}：一覧カードの「${sal}」は月額を12倍した数字（オーナーが名指しで禁止）`);
      }
    } else {
      const want = `${f.key === 'max_y' ? '〜' : ''}¥${f.man.toLocaleString('en-US')}万`;
      if (sal !== want) bad(rel, `${slug}：一覧カードの金額が台帳とずれている → 画面「${sal}」／台帳「${want}」`);
      const tier = BASIS[slug].cap?.tier || 'held';
      if (!note.includes(TIERS[tier].ja)) {
        bad(rel, `${slug}：一覧カードの札が等級と違う → 画面「${note}」／台帳「${TIERS[tier].ja}」`);
      }
    }
    if (!avgOk(slug, 'cap') && /平均/.test(note)) {
      bad(rel, `${slug}：機長は「${TIERS[BASIS[slug].cap?.tier || 'held'].ja}」なのに、一覧カードの札が「${note}」（平均と名乗っている）`);
    }
    /* 札を持たなくてよいのは「カードに推定を出す社」＝推定の等級か、台帳に年額が無い社。
       どちらも既定の札「機長 推定年収」に落ちて、それが正しい（既定は上で見ている）。 */
    if (!note && !isEst && f) bad(rel, `${slug}：一覧カードの札（salNote）が無い ＝ 共通の札に落ちる（等級を名乗れない）`);
  }

  /* 札を行ごとに出す形になっているか（ここが戻ると25社ぶんが黙って「平均年収」に戻る）。
     ★2026-09-30、**既定の札そのもの**も見る。札を持たない社（推定の20社と台帳の外の87社）は
       全部ここに落ちるので、ここが「平均年収」に戻った瞬間に107社が「平均」を名乗る。
       画面は普通に出るので、見ても気づけない。 */
  for (const [p, key, dflt, ng] of [
    ['world-airlines.html', 'salNote', '機長 推定年収', '平均'],
    ['en/world-airlines.html', 'salNoteEn', 'Captain estimated salary', 'average'],
  ]) {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    if (!html.includes(`a.${key}`)) bad(p, `会社カードの札が行ごとに出ていない（a.${key} を読んでいない）＝25社が共通の札に戻る`);
    const d = html.match(new RegExp(`a\\.${key} \\|\\| '([^']*)'`))?.[1];
    if (d == null) bad(p, `会社カードの既定の札が読めない（a.${key} || '…' の形が変わった）`);
    else if (d !== dflt) {
      bad(p, `会社カードの既定の札が「${d}」になっている（「${dflt}」であること）`
        + (new RegExp(ng, 'i').test(d) ? `\n   ★これは「平均」を名乗っている。札を持たない107社が全部こうなる` : ''));
    }
  }
  if (!fail) ok++;
}

/* ── J) 会社ページの旧い帯が戻っていないか（2026-10-08）──────────────
   オーナー指示で、全会社ページ（日英）から次の2つを外した。
     ・「✈ パイロット転職を検討中の方へ …」の橙の帯
     ・その直後の「国別で比べる／同じ国の他社」の箱（<!--PV-CLINK-->）
   どちらも**道具が書いていた**もの ── link-countries.mjs が箱を「剥がして入れ直し」、
   gen-new-airline.mjs が借り元から帯を持ち込み、gen-faq.mjs が帯を差し込みの目印にしていた。
   ページを直しても、道具を流した瞬間に戻る。だから「ページに無い」と
   「道具が書かない」の両方を見る。
   ★以前の J は、箱の中の金額が台帳どおりかを見ていた。箱そのものが無くなったので、
     見るものを「戻っていないこと」に替えた（箱を戻すなら、先に git で前の J を戻すこと。
     あの箱は生成物で、国の平均や他社の金額を黙って古い値に戻す）。
   ⚠️ 外しすぎも見る ── 新しい「他社と比較」の入口・通常の footer・
      世界一覧とサイトマップの国の帯（<!--PV-CBAND-->）は外していない。
   ⚠️ 比較記事（SALARY に無い slug）の橙の帯は会社ページではないので対象外。 */
{
  const BAND = /<div style="background:rgba\(249,115,22,\.06\)[^>]*>\s*<a href="\.\.\/pilot-tenshoku\.html"/;
  /* 通常の footer に在るはずの、利用案内と法務の7本。 */
  const FOOT_LINKS = ['guide.html', 'policy.html', 'terms.html', 'privacy.html', 'personal-data.html', 'help.html', 'sitemap.html'];
  for (const dir of ['airlines', 'en/airlines']) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const fn of fs.readdirSync(base).filter((f) => f.endsWith('.html'))) {
      const slug = fn.replace(/\.html$/, '');
      const rel = `${dir}/${fn}`;
      const html = fs.readFileSync(path.join(base, fn), 'utf8');
      /* 国別の箱は、会社ページでも比較記事でも置かない。 */
      if (/<!--\/?PV-CLINK-->/.test(html) || /class="pvcl[\s"-]/.test(html) || /\.pvcl[{-]/.test(html)) {
        bad(rel, '「国別で比べる／同じ国の他社」の箱（PV-CLINK）が戻っている。2026-10-08 に全会社ページから外した\n   ★どの道具が書いたかを先に探す（ページを手で消しても、次に流した回に戻る）');
      }
      if (!SALARY[slug]) continue;                        /* ここから下は会社ページだけ */
      if (BAND.test(html) || /パイロット転職を検討中の方へ/.test(html) || /Thinking about a pilot career move\?/.test(html)) {
        bad(rel, '「パイロット転職を検討中の方へ」の橙の帯が戻っている。2026-10-08 に全会社ページから外した');
      }
      const foot = (/<footer\b[\s\S]*?<\/footer>/i.exec(html) || [''])[0];
      if (!foot) bad(rel, '通常の footer が無い（旧い帯と一緒に外してはいけない）');
      /* ★footer が「在る」だけでは足りない（2026-10-09）。日本語の会社ページ13枚は、ロゴと著作権表示だけの短い footer で、
         利用案内・規約・個人情報の扱いへの道が1本も無かった。「在る」しか見ていなかったので、ずっと緑のままだった。
         ⚠️ 英語の会社ページは、いまどの1枚にも法務のリンクが無い（別の作業）。ここで見るのは日本語だけ。 */
      else if (dir === 'airlines') {
        const lost = FOOT_LINKS.filter((h) => !foot.includes(`href="../${h}"`));
        if (lost.length) bad(rel, `footer に利用案内・法務のリンクが無い（${lost.join('・')}）。短い footer のまま＝規約と個人情報の扱いへ行けない`);
      }
    }
  }

  /* 道具の側。書く処理が残っていたら、ページがいま正しくても次に流した回に戻る。 */
  const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lc = src('link-countries.mjs');
  if (/class="pvcl|pvcl-pill|pvcl-head|function block\(/.test(lc) || /`<!--PV-CLINK-->/.test(lc)) {
    bad('link-countries.mjs', '国別の箱（PV-CLINK）を書く処理が戻っている。いまは外すだけの道具（流すたびに全会社ページへ箱が戻る）');
  }
  if (!/OLD_CLINK/.test(lc) || !/OLD_BAND/.test(lc)) {
    bad('link-countries.mjs', '旧い帯を外す処理（OLD_CLINK / OLD_BAND）が無い＝古い借り元から持ち込まれた帯を片づける道が無い');
  }
  const gn = src('gen-new-airline.mjs');
  if (/\['<div style="background:rgba\(249,115,22,\.06\)'/.test(gn) || /html\.indexOf\('<div style="background:rgba\(249,115,22,\.06\)'/.test(gn)) {
    bad('gen-new-airline.mjs', '橙の帯を「本文の終わり」や「必要な目印」として探している。帯はもう無いので新しい会社ページが起こせない／借り元から帯を持ち込む');
  }
  const gf = src('gen-faq.mjs');
  if (/'<div style="background:rgba\(249,115,22,\.06\)'/.test(gf)) {
    bad('gen-faq.mjs', '橙の帯を FAQ の差し込みの目印にしている。帯はもう無いので「差し込み位置が見つからない」で落ちる（目印は <footer）');
  }

  /* 外しすぎていないか。 */
  for (const slug of ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']) {
    const p = path.join(ROOT, 'airlines', `${slug}.html`);
    if (!fs.existsSync(p)) continue;
    const n = fs.readFileSync(p, 'utf8').split(`../career.html?view=compare&amp;a=${slug}`).length - 1;
    if (n !== 1) bad(`airlines/${slug}.html`, `新しい「他社と比較」の入口が ${n} 本（1本であること。旧い帯と一緒に外さない）`);
  }
  for (const p of ['world-airlines.html', 'sitemap.html', 'en/world-airlines.html', 'en/sitemap.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) continue;
    if (!src(p).includes('<!--PV-CBAND-->')) bad(p, '国別ページへの帯（PV-CBAND）が無い。外したのは会社ページの箱だけで、こちらは残す（国別ページへの入口がここだけになった）');
  }
  if (!fail) ok++;
}

const audited = AUDIT_23.filter((s2) => BASIS[s2]).length;
console.log(`\n監査対象 ${audited}/23社 ＋ 関連 ${EXTRA.filter((s2) => BASIS[s2]).length}社 を見た`);
console.log(`${ok} pass · ${warn} warn · ${fail} fail`);
if (fail) {
  console.log('\n直す前に workflows/deploy-checklist.md を読む（検査のほうが正しいことがほとんど）。');
  process.exit(1);
}
