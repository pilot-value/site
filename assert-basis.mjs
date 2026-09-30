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

   見るもの（すべて salary-basis.mjs の23社・日英)
     A) 確認中にした元の金額が head（題名・紹介文・OG・構造化データ）に残っていないか
        ── 万円の形（3,700万）でも、生の円（37000000）でも探す
     B) 「推計平均」「参考値」で言い換えて残していないか（オーナーが明示的に却下）
     C) 出所の節（PV-BASIS）が在るか。確認日とリンクが在るか
     D) 確認中の職位に「平均年収」の札が残っていないか
     E) 総待遇に現金給与や住宅・学費をもう一度足す書き方になっていないか
     F) 英語版で「税引前」と「非課税」が同じページに同居していないか
     G) 全部が確認中の会社の構造化データに、年収欄が残っていないか
     H) 画面に出した出所（リンク・確認日）が台帳と一致しているか
     I) 一覧ページ（world-airlines）の会社カードが台帳どおりか
        ── カードは1行しか出せないので、出してよいのは「年額の現金」だけ。
           総待遇を他社の現金と並べない・月額を12倍して年額にしない・
           確認中の社に金額を出さない・「平均」の札を残さない
     J) 各社ページの下にある国別リンクの帯（PV-CLINK）が台帳どおりか
        ── 根拠を調べた社が混ざる国で「機長平均 ¥…」を出さない・
           確認中の社の丸い札に数字を出さない・金額を出す社は種類を名乗る

   使い方: node assert-basis.mjs [--v]
   ════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { BASIS, TIERS, figures, cardFigure } from './salary-basis.mjs';
import { AIRLINE_COUNTRY } from './airline-countries.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/%20/g, ' ');
const V = process.argv.includes('--v');

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
    /* ⚠️ 金額のそばだけを見る。ページ末尾の「掲載データは参考値です。」は
         サイト共通のフッターで、どの金額のことも指していない（全ページに在る）。
         ここが捕まえたいのは「機長 参考値 ¥2,500万」のように、
         根拠不明の平均を名前だけ変えて金額と並べて残す形。 */
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

    /* ── C) 出所の節が在るか ──────────────────────────────────── */
    const hasBasis = /id="kyuyo-konkyo"/.test(html);
    if (!hasBasis) {
      hit('出所の節（id="kyuyo-konkyo"）が無い。この金額が誰の・何を含んだ・いつの金額かを画面に出していない');
    } else {
      const sec = html.slice(html.indexOf('id="kyuyo-konkyo"'));
      const end = sec.indexOf('▲ /PV-BASIS');
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
          台帳の url が pilot-value.com なら、末尾のファイル名で照合する。 */
    const shownHere = (u) => {
      if (html.includes(u)) return true;
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

    if (!f) {
      if (sal !== '確認中') {
        bad(rel, `${slug}：台帳に機長の年額の現金が無いのに、一覧カードが「${sal}」を出している\n   （月額を12倍して年額にしない・総待遇を他社の現金と並べない）`);
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
    if (!note) bad(rel, `${slug}：一覧カードの札（salNote）が無い ＝ 共通の「機長 平均年収」が出てしまう`);
  }

  /* 札を行ごとに出す形になっているか（ここが戻ると25社ぶんが黙って「平均年収」に戻る）。 */
  for (const [p, key] of [['world-airlines.html', 'salNote'], ['en/world-airlines.html', 'salNoteEn']]) {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    if (!html.includes(`a.${key}`)) bad(p, `会社カードの札が行ごとに出ていない（a.${key} を読んでいない）＝25社が共通の「平均年収」に戻る`);
  }
  if (!fail) ok++;
}

/* ── J) 各社ページの下の国別リンクの帯（PV-CLINK）────────────────
   link-countries.mjs が 232枚に貼り直している帯。各社ページ本体を全部
   直しても、この帯だけが「掲載3社・機長平均 ¥2,700万」と
   下げたはずの平均を出し続ける（帯は生成物なので画面を見ても気づけない）。
   ⚠️ 帯を作り直す側が台帳を読まなくなったら、ここで落ちる。 */
{
  /* 根拠を調べた社が1社でも混ざる国＝国の平均を出さない国。 */
  const heldCountry = (code) =>
    Object.entries(AIRLINE_COUNTRY).some(([s2, c2]) => c2 === code && BASIS[s2]);

  /* ⚠️ 英語ページの <em> の中は <span class="pv-cur" …>$170K</span> に焼いてある。
        [^<]* で取ると空に見えるので、中身を丸ごと取ってからタグを落とす。 */
  const PILL = /<a href="([a-z0-9-]+)\.html" class="pvcl-pill"><span>[^<]*<\/span>(?:<em>([\s\S]*?)<\/em>)?/g;
  const text = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  for (const dir of ['airlines', 'en/airlines']) {
    const ja = dir === 'airlines';
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const fn of fs.readdirSync(base).filter((f) => f.endsWith('.html'))) {
      const slug = fn.replace(/\.html$/, '');
      const code = AIRLINE_COUNTRY[slug];
      if (!code || !heldCountry(code)) continue;          /* 触っていない国は見ない */
      const rel = `${dir}/${fn}`;
      const html = fs.readFileSync(path.join(base, fn), 'utf8');
      const blk = html.match(/<!--PV-CLINK-->[\s\S]*?<!--\/PV-CLINK-->/)?.[0];
      if (!blk) continue;                                  /* 帯が無いページは対象外 */

      /* 帯の見出しに国の平均を出していないか。 */
      if (ja && /機長平均\s*¥/.test(blk)) {
        bad(rel, '国別リンクの帯が「機長平均 ¥…」を出している（この国は金額の意味が社ごとに違うので国の平均を出さない）');
      }
      if (!ja && /captain avg/.test(blk)) {
        bad(rel, '国別リンクの帯が "captain avg" を出している（この国は国全体の平均を出さない）');
      }

      /* 丸い札（他社への入口）が、台帳の等級どおりか。 */
      for (const m of blk.matchAll(PILL)) {
        const peer = m[1];
        const em = text(m[2]);
        const c = cardFigure(peer, 'cap');
        if (!c) continue;                                  /* 台帳に無い社は今までどおり */
        const want = c.held ? (ja ? '確認中' : 'Under review')
                            : (ja ? `${c.kindJa} ${c.yen}` : `${c.kindEn} ${c.yen}`);
        if (c.held && /[0-9]/.test(em)) {
          bad(rel, `帯の中の「${peer}」に数字が出ている（「${em}」）。この社は確認中なので金額を1つも出さない`);
        } else if (ja && em !== want) {
          bad(rel, `帯の中の「${peer}」の札が台帳と違う → 画面「${em}」／台帳「${want}」`);
        } else if (!ja && c.held && em !== want) {
          bad(rel, `帯の中の「${peer}」の札が台帳と違う → 画面「${em}」／台帳「${want}」`);
        }
      }
    }
  }

  /* 帯を作る側が台帳を読んでいるか（読まなくなると全部が黙って平均に戻る）。 */
  const gen = fs.readFileSync(path.join(ROOT, 'link-countries.mjs'), 'utf8');
  if (!/salary-basis\.mjs/.test(gen)) {
    bad('link-countries.mjs', '国別リンクの帯を作る側が台帳を読んでいない＝流した瞬間に232枚が古い平均に戻る');
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
