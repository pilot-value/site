/* ════════════════════════════════════════════════════════════════
   assert-i18n.mjs — 言語を足す仕組みの約束を、ファイルを読むだけで確かめる（2026-11-02・多言語化）
   実行: node assert-i18n.mjs   ネットワーク不要・何も書かない。

   見ること
     1) 機械で作る言語のページ（es/）の、画面に出る字に日本語が1文字も無い
     2) 訳の辞書（i18n/tm-<言語>.mjs）：状態が決まった値だけ・訳に日本語の字が無い・
        JS の訳はコードの形が原文と同じ（引用符の中だけ違う）
     3) 部品の辞書：書き足した es の各項目が、en の同じ項目とコードの形が同じ
     4) 表示通貨：メニューの通貨すべてに、全言語の名前・スペイン語の記号がある
     5) 会員の言語（db/profile-lang.sql）の一覧が langs.mjs の言語とそろっている
     6) pv-session.js の PV_LANG_PAGES が langs.mjs の pages とそろっている（gen-lang.mjs が書く）
     7) 口コミの本文をどの言語で出すか（review-i18n.js の pick）
     8) 日英西のほかの言語の口コミ：札「〇〇から自動翻訳」・訳の無い原文に dir と lang（壊す証明つき）
   ════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'parse5';
import { LANGS } from './langs.mjs';
import { jsShape } from './i18n-core.mjs';
import { MSG_FILES, dicts } from './gen-msg.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, l, e = '') => { c ? (pass++, console.log('  ✅ ' + l)) : (fail++, console.log('  ❌ ' + l + (e ? '\n     ' + String(e).slice(0, 500) : ''))); };
const JA = /[ぁ-んァ-ヶ一-龠]/;
const GEN = LANGS.filter((l) => !l.hand);

console.log('\n▼ 1) 機械で作る言語のページに日本語の字が出ていない（英語のページに在る字＝出典の資料名・写真の作者名は除く）');
/* 画面に出る字の中の、日本語・中国語の字の並び。出典の資料名（「会社概要」）や写真の作者名（CC BY の条件で書かれたとおりに出す）は
   英語のページにも同じ字で在る ＝ 訳し残しではない。英語のページに無い並びが出たときだけ落とす（2026-11-02・会社ページ109枚を足したとき） */
const JA_RUN = /[ぁ-んァ-ヶ一-龠㐀-鿿ー・（）｜【】：，。、—々〜０-９Ａ-Ｚａ-ｚ－]+/g;
const runsOf = (html) => {
  const out = new Set();
  const walk = (n) => {
    if (n.nodeName === '#text') for (const m of n.value.match(JA_RUN) || []) if (JA.test(m)) out.add(m);
    if (['script', 'style', 'noscript', 'template'].includes(n.tagName)) return;
    for (const a of n.attrs || []) if (['alt', 'title', 'aria-label', 'placeholder'].includes(a.name)) for (const m of a.value.match(JA_RUN) || []) if (JA.test(m)) out.add(m);
    (n.childNodes || []).forEach(walk);
  };
  walk(parse(html));
  return out;
};
for (const L of GEN) {
  for (const bare of L.pages) {
    const rel = L.dir + bare;
    if (!fs.existsSync(path.join(ROOT, rel))) { ok(false, `${rel} がある`, 'node gen-lang.mjs を流す'); continue; }
    const en = runsOf(read('en/' + bare));
    const hits = [...runsOf(read(rel))].filter((x) => !en.has(x));
    ok(!hits.length, `${rel}：画面に出る字に、英語のページに無い日本語が無い`, hits.slice(0, 5).join(' / '));
  }
}

console.log('\n▼ 2) 訳の辞書');
for (const L of GEN) {
  const f = `i18n/tm-${L.code}.mjs`;
  if (!fs.existsSync(path.join(ROOT, f))) { ok(false, `${f} がある`); continue; }
  const { TM } = await import(path.join(ROOT, f));
  const ST = new Set(['validated', 'needs_review', 'manual']);
  const bad = [];
  for (const [k, v] of Object.entries(TM)) {
    if (!ST.has(v.st)) bad.push(`状態が変: ${v.st} ← ${k.slice(0, 40)}`);
    /* JS の訳は、元のコードにある日本語（正規表現・日本語の鍵）はそのまま残ってよい。元に無い日本語が増えたら落とす */
    const jaSet = (x) => new Set((x || '').match(/[ぁ-んァ-ヶ一-龠ー・（）]+/g) || []);
    const srcJa = jaSet(k);
    if ([...jaSet(v.es)].some((w) => !srcJa.has(w))) bad.push(`日本語の字: ${k.slice(0, 40)}`);
    const js = /^jsl?:/.test(k);
    if (js !== /^jsl?:/.test(v.es || '') || (js && k.slice(0, k.indexOf(':')) !== v.es.slice(0, v.es.indexOf(':')))) bad.push(`JS の印が合わない: ${k.slice(0, 40)}`);
    if (js) {
      const a = k.slice(k.indexOf(':') + 1), b = v.es.slice(v.es.indexOf(':') + 1);
      if (jsShape(a) !== jsShape(b)) bad.push(`コードの形が違う: ${a.slice(0, 50)}`);
    }
  }
  ok(!bad.length, `${f}：${Object.keys(TM).length} 件・状態・日本語・コードの形`, bad.slice(0, 6).join('\n     '));
}

console.log('\n▼ 3) 部品の辞書（en と書き足した言語の形が同じ）');
for (const file of MSG_FILES) {
  const src = read(file);
  const probs = [];
  for (const L of GEN) {
    const re = new RegExp(`\\/\\*PV-MSG:${L.code}\\*\\/\\s*(?:${L.code}:|var \\w+_${L.code.toUpperCase()} =)\\s*([\\s\\S]*?);?\\s*\\/\\*\\/PV-MSG:${L.code}\\*\\/`, 'g');
    const blocks = [...src.matchAll(re)].map((m) => m[1]);
    const ds = dicts(src);
    if (blocks.length !== ds.length) { probs.push(`${L.code} の辞書が ${blocks.length} 個・en は ${ds.length} 個（node gen-msg.mjs）`); continue; }
    ds.forEach((d, i) => { if (jsShape(src.slice(d.start, d.end)) !== jsShape(blocks[i])) probs.push(`${L.code} の ${i + 1} 個目の形が en と違う`); });
  }
  ok(!probs.length, `${file}`, probs.join(' / '));
}

console.log('\n▼ 4) 表示通貨の名前と記号');
{
  const c = read('currency.js');
  const order = (c.match(/var ORDER = \[([^\]]*)\]/) || [, ''])[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  const nameBlock = c.slice(c.indexOf('var NAME = {'), c.indexOf('};', c.indexOf('var NAME = {')));
  const symEs = (c.match(/var SYM_ES = \{([^}]*)\}/) || [, ''])[1];
  const label = (c.match(/var LABEL = \{([^}]*)\}/) || [, ''])[1];
  for (const lang of ['ja', 'en', ...GEN.map((l) => l.code)]) {
    const line = (nameBlock.match(new RegExp(`\\n\\s*${lang}: \\{([^}]*)\\}`)) || [, ''])[1];
    const miss = order.filter((k) => !new RegExp(`\\b${k}:`).test(line));
    ok(!miss.length, `通貨の名前（${lang}）がメニューの ${order.length} 通貨すべてにある`, miss.join(' '));
  }
  const missSym = order.filter((k) => k !== 'JPY' && !new RegExp(`\\b${k}:`).test(symEs));
  ok(!missSym.length, 'スペイン語の記号（SYM_ES）が円以外の全部にある', missSym.join(' '));
  const missLab = order.filter((k) => !new RegExp(`\\b${k}:`).test(label));
  ok(!missLab.length, 'メニューの札（LABEL）が全部にある', missLab.join(' '));
}

console.log('\n▼ 5) 会員の言語の一覧');
{
  const sql = read('db/profile-lang.sql');
  const want = LANGS.map((l) => `'${l.code}'`).join(', ');
  const lists = [...sql.matchAll(/in \(([^)]*)\)/g)].map((m) => m[1].trim());
  ok(lists.length >= 2 && lists.every((x) => x === want), `制約と関数の言語の一覧が langs.mjs（${want}）と同じ`, lists.join(' | '));
}

console.log('\n▼ 6) pv-session.js の PV_LANG_PAGES');
{
  const s = read('pv-session.js');
  const m = s.match(/\/\*PV-LANG-PAGES\*\/window\.PV_LANG_PAGES = ([\s\S]*?);\/\*\/PV-LANG-PAGES\*\//);
  const want = JSON.stringify(Object.fromEntries(GEN.map((l) => [l.code, l.pages])));
  ok(m && m[1] === want, 'langs.mjs の pages と同じ（違えば node gen-lang.mjs → node inject-session.mjs → node gen-lang.mjs）', m ? m[1] : '印が無い');
}

console.log('\n▼ 7) 口コミの本文をどの言語で出すか（review-i18n.js の pick）');
{
  /* ★2026-11-02 translate-review が日英西へ訳す。スペイン語のページはスペイン語の訳 → 無ければ英語の訳 → 原文。
     日英のページの選び方は今までどおり（スペイン語の原文には日英の訳）。 */
  const src = read('review-i18n.js');
  const load = (pvLang, htmlLang) => {
    const w = { PV_LANG: pvLang, PV_BASE: pvLang === 'ja' ? 'ja' : 'en' };
    w.PV_T = (T, L) => (pvLang === 'es' && T && T.es) || (T && T[L]);
    const d = { documentElement: { getAttribute: () => htmlLang }, getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
    new Function('window', 'document', src)(w, d);
    return w.PVReviewI18n;
  };
  const row = (orig, tr) => ({ orig_lang: orig, translations: tr, culture_comment: 'ORIG-' + orig });
  const ES = load('es', 'es-419'), EN = load('en', 'en'), JA = load('ja', 'ja');
  const txt = (R, r) => R.pick(r).cats[0].text;
  ok(ES && txt(ES, row('ja', { en: { culture: 'EN-TR' }, es: { culture: 'ES-TR' } })) === 'ES-TR', 'スペイン語のページ：スペイン語の訳があればそれ');
  ok(txt(ES, row('ja', { en: { culture: 'EN-TR' } })) === 'EN-TR', 'スペイン語のページ：スペイン語の訳がまだ無ければ英語の訳（埋め戻しの前）');
  ok(txt(ES, row('en', { ja: { culture: 'JA-TR' } })) === 'ORIG-en', 'スペイン語のページ：原文が英語で西訳が無ければ原文（日本語の訳を出さない）');
  ok(txt(ES, row('es', { en: { culture: 'EN-TR' } })) === 'ORIG-es', 'スペイン語のページ：原文がスペイン語なら原文');
  ok(txt(EN, row('es', { en: { culture: 'EN-TR' }, ja: { culture: 'JA-TR' } })) === 'EN-TR', '英語のページ：スペイン語の原文には英語の訳');
  ok(txt(JA, row('es', { en: { culture: 'EN-TR' }, ja: { culture: 'JA-TR' } })) === 'JA-TR', '日本語のページ：スペイン語の原文には日本語の訳');
  ok(txt(JA, row('en', { ja: { culture: 'JA-TR' }, es: { culture: 'ES-TR' } })) === 'JA-TR', '日本語のページ：今までどおり（英語の原文には日本語の訳）');
  ok(ES.pick(row('ja', { es: { culture: 'ES-TR' } })).translated === true && EN.pick(row('en', {})).translated === false, '訳を出したときだけ「自動翻訳」の印');
}

console.log('\n▼ 8) 日英西のほかの言語の口コミ（review-i18n.js の札・dir・lang。2026-11-15）');
{
  /* ★translate-review が orig_lang に本当の言語（ar・zh・he …）を入れ、日英西へ訳す。訳の無い口コミ（ログインなしの預かり・訳の失敗）は原文のまま出る。
       見ること：訳があれば訳文・札は「〇〇から自動翻訳」（言語名はページの言語）／訳が無ければ原文に dir="rtl" lang="ar"／
       日英西の原文と訳文には何も付けない（＝今までの口コミの見た目は1ピクセルも変わらない）。
     ★壊す証明：同じ見方を、わざと壊した review-i18n.js（向きを付けない・訳文にも付ける・札を「自動翻訳」だけに戻す）にも当て、そのときは落ちることを見る。 */
  const SRC = read('review-i18n.js');
  const loadFrom = (src, pvLang, htmlLang) => {
    const w = { PV_LANG: pvLang, PV_BASE: pvLang === 'ja' ? 'ja' : 'en' };
    w.PV_T = (T, L) => (pvLang === 'es' && T && T.es) || (T && T[L]);
    const d = { documentElement: { getAttribute: () => htmlLang }, getElementById: () => ({}), createElement: () => ({}), head: { appendChild() {} } };
    new Function('window', 'document', src)(w, d);
    return w.PVReviewI18n;
  };
  const AR = 'الرواتب جيدة جدا والجدول مريح';
  const TR = { ja: { culture: 'JA-TR' }, en: { culture: 'EN-TR' }, es: { culture: 'ES-TR' } };
  const PAGES = [['ja', 'ja', 'アラビア語', 'JA-TR'], ['en', 'en', 'Arabic', 'EN-TR'], ['es', 'es-419', 'árabe', 'ES-TR']];
  const visible = (h) => String(h).replace(/<[^>]+>/g, '');
  /* 1つの review-i18n.js に対する見方。返すのは落ちた項目の名前（空なら全部通った） */
  const judge = (src) => {
    const bad = [];
    for (const [pv, html, name, want] of PAGES) {
      const R = loadFrom(src, pv, html);
      const p = R.pick({ orig_lang: 'ar', culture_comment: AR, translations: TR });
      const note = R.noteHTML(p.from);
      if (!(p.cats[0].text === want && p.translated)) bad.push(`${pv}：訳があれば訳文`);
      if (!(visible(note).includes(name) && (note.match(/title="([^"]*)"/) || [])[1] === visible(note))) bad.push(`${pv}：札の見える字と title に言語名「${name}」`);
      const sh = R.noteHTML(p.from, 'short');   // Vote の流れる帯（狭い札の行）：見える字は「自動翻訳」だけ・言語名は title に
      if (!(!visible(sh).includes(name) && (sh.match(/title="([^"]*)"/) || [])[1] === visible(note))) bad.push(`${pv}：狭い札の行は見える字を短く・title に「${name}」`);
      if (!(R.attrs && R.attrs(p) === '' && R.attrs(p, p.cats[0]) === '')) bad.push(`${pv}：訳文には dir も lang も付けない`);
      if (!/<div class="rv-tr-orig" dir="rtl" lang="ar" hidden>/.test(R.origHTML(p.origText, p))) bad.push(`${pv}：「原文を表示」で開く原文に dir="rtl" lang="ar"`);
      const q = R.pick({ orig_lang: 'ar', culture_comment: AR });
      if (!(q.cats[0].text === AR && !q.translated && R.attrs(q) === ' dir="rtl" lang="ar"' && R.attrs(q, q.cats[0]) === ' dir="rtl" lang="ar"')) bad.push(`${pv}：訳が無ければ原文に dir="rtl" lang="ar"`);
      const lk = R.pick({ orig_lang: 'ar', cats: ['culture'], clip: { k: 'culture', o: AR.slice(0, 10) + '…' } });
      const lt = R.pick({ orig_lang: 'ar', cats: ['culture'], clip: { k: 'culture', o: AR.slice(0, 10) + '…', t: { ja: 'JA…', en: 'EN…', es: 'ES…' } } });
      if (!(R.attrs(lk) === ' dir="rtl" lang="ar"' && R.attrs(lt) === '')) bad.push(`${pv}：鍵の無い行の抜粋も、原文のときだけ`);
      const en = R.pick({ orig_lang: 'en', culture_comment: 'Pay is fine' }), ja = R.pick({ orig_lang: 'ja', culture_comment: '給与は普通' }), es = R.pick({ orig_lang: 'es', culture_comment: 'El sueldo está bien' });
      if (![en, ja, es].every((x) => R.attrs(x) === '' && R.attrs(x, x.cats[0]) === '' && R.origHTML('ORIG', x).indexOf(' dir=') < 0 && R.origHTML('ORIG', x).indexOf(' lang=') < 0)) bad.push(`${pv}：日英西の原文には何も付けない`);
      const zh = R.pick({ orig_lang: 'zh', culture_comment: '工资很好' }), he = R.pick({ orig_lang: 'he', culture_comment: 'שכר טוב מאוד' }), und = R.pick({ orig_lang: 'und', culture_comment: AR });
      if (!(R.attrs(zh) === ' lang="zh"' && R.attrs(he) === ' dir="rtl" lang="he"' && R.attrs(und) === ' dir="rtl"')) bad.push(`${pv}：dir は字で決める（中国語は lang だけ・ヘブライ語は rtl・言語が分からなくても字がアラビア文字なら rtl）`);
      if (visible(R.noteHTML('und')) !== R.noteHTML('und').match(/title="([^"]*)"/)[1] || /und/.test(R.noteHTML('und'))) bad.push(`${pv}：言語が分からない口コミの札にコードを出さない`);
    }
    return bad;
  };
  const bad = judge(SRC);
  ok(!bad.length, 'アラビア語の口コミ：日英西のページで訳文と「〇〇から自動翻訳」・訳が無ければ原文に dir="rtl" lang="ar"・日英西の文には何も付けない', bad.join(' / '));
  /* 壊す証明（関数形の replace ── $ を素通しにする） */
  const BREAK = [
    ['向きを付けない', (s) => s.replace("var a = isRtl(text) ? ' dir=\"rtl\"' : '';", () => "var a = '';")],
    ['訳文にも付ける', (s) => s.replace("if (p.translated) return '';", () => '')],
    ['札を「自動翻訳」だけに戻す', (s) => s.replace('var t = /^[a-z]{2}$/.test(code) ? u.from(code, langName(code)) : u.note;', () => 'var t = u.note;')],
    ['日英西にも lang を付ける', (s) => s.replace('var SITE_LANG = { ja: 1, en: 1, es: 1 };', () => 'var SITE_LANG = {};')],
  ];
  for (const [what, f] of BREAK) {
    const broken = f(SRC);
    let res;
    try { res = broken !== SRC ? judge(broken) : ['（壊す場所が見つからない）']; } catch (e) { res = ['例外 ' + e.message]; }
    ok(broken !== SRC && res.length > 0, `★壊す証明：review-i18n.js を「${what}」に壊すと、上の見方が落ちる`, broken === SRC ? '壊す場所が見つからない（review-i18n.js の字が変わった）' : 'どれも落ちなかった');
  }
}

console.log(`\n==== ${pass}/${pass + fail} passed ====`);
process.exit(fail ? 1 : 0);
