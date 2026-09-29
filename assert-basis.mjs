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

   使い方: node assert-basis.mjs [--v]
   ════════════════════════════════════════════════════════════════ */

import fs from 'fs';
import path from 'path';
import { BASIS, TIERS } from './salary-basis.mjs';

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
      if (!/<a [^>]*href="https?:/.test(blk)) hit('出所の節に資料へのリンクが無い');
    }

    /* ── D) 確認中の職位に「平均」の札が残っていないか ────────────── */
    for (const [rank, nm] of Object.entries(RANKS)) {
      if (!b[rank] || avgOk(slug, rank)) continue;
      const pats = lang === 'ja'
        ? [new RegExp(`${nm}[^。<]{0,8}平均年収`), new RegExp(`平均年収[^。<]{0,8}${nm}`)]
        : [];
      for (const re of pats) {
        const m = html.match(re);
        if (m) hit(`${nm}は「${TIERS[b[rank].tier].ja}」なのに「平均年収」の札が残っている → 「${m[0]}」`);
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

    /* ── H) 画面の出所が台帳と一致しているか ─────────────────── */
    if (hasBasis && b.src?.length) {
      const shown = b.src.filter((s) => html.includes(s.url)).length;
      if (!shown) {
        hit(`台帳に出所が${b.src.length}件あるのに、画面にそのリンクが1本も出ていない`);
      } else if (shown < b.src.length && V) {
        soft(rel, `台帳の出所${b.src.length}件のうち画面に出ているのは${shown}件`);
      }
    }

    if (!pageBad) { ok++; if (V) console.log(`✅ ${rel}`); }
  }
}

const audited = AUDIT_23.filter((s2) => BASIS[s2]).length;
console.log(`\n監査対象 ${audited}/23社 ＋ 関連 ${EXTRA.filter((s2) => BASIS[s2]).length}社 を見た`);
console.log(`${ok} pass · ${warn} warn · ${fail} fail`);
if (fail) {
  console.log('\n直す前に workflows/deploy-checklist.md を読む（検査のほうが正しいことがほとんど）。');
  process.exit(1);
}
