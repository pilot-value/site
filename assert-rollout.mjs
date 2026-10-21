/* ═══════════════════════════════════════════════════════════════════
   assert-rollout.mjs ── 新しい会社ページを全社へ広げる生成器の約束（2026-10-21・全社へ広げる b）

   リポジトリには1バイトも書かない。会社を切り替えて流すのは、使い捨てのフォルダに作った写しの中だけ
   （会社ページ・切り替えの1か所・生成器・調べの台帳は本物の写し、ほかは元のファイルへのリンク。終わったら消す）。
   ブラウザは使わない。

   守っていること（どれも、壊すと赤くなることを確かめてある）
     A  切り替えは1か所（airline-rollout.mjs の SWITCH）。SWITCH の外の会社ページには、新しい会社ページの印が1つも無い。
        先行5社のページは生成器の出力と1文字も違わない。棒の目盛は SWITCH の全社の推定から決まる。
     B  画面に出してよい行（airline-rollout.mjs の why）── 本物の調べの台帳で:
        使い方が 保留・空欄・未指定・無し の行は出さない／機長と副操縦士を分けない給与は出さない（P12.77）／
        空港までの移動は、その会社の拠点の空港の行だけ（同じ街のほかの会社の空港の行を出さない）／日付の無い過去の行は出さない／
        過去・参考の行は、言い方（過去は過去として・参考は背景として）ができるまで、どのカードにも置かない（107社の読み口で）
     C  今のページの古い節（107枚ぜんぶ）が台帳に在る。先行5社ではない会社では「よくある質問」と検索向けの読み物を外さない。
        外すのは、新しい部品がその話を出せるときだけ。どの会社も読み口（viewOf）が通る。
     D  写しの中で3社（ブリティッシュ・エアウェイズ、スカイマーク、南アフリカ航空 ＝ 台帳の待遇が過去の行だけの会社）を切り替えて流す:
        2回めは「✓ 変更なし」／「よくある質問」と FAQPage が同じ字で残る／<head> は部品の <link> の塊のほかは同じ／
        海外の評判のカードの部品を読んだまま／残す節は残り外す節は無い／推定年収は SALARY・乗員全体の平均は出ない／
        資料が無い所は今までの字／過去・参考の行の字がページに無く、勤務・待遇のカードの1行めは条件つきの行（無ければ今までの字）／
        調べの台帳の写しで行の使い方を 保留・未指定・参考・過去（日付つき）にすると、その行の字がページから消える／
        check-salary.mjs が ❌0／SWITCH の外のページは1文字も変わらず、先行5社は島（#crc-data）の1行だけ
   使い方: node assert-rollout.mjs
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SALARY } from './salary-data.mjs';
import { BASIS } from './salary-basis.mjs';
import { LEAD, SWITCH, SHOWN, why, research } from './airline-rollout.mjs';
import { GLANCE, AXIS, viewOf } from './pv-airline-view.mjs';
import { build, pageOf, TABBED, NO_FAQ, LEGACY, LEGACY_REST, legacyPlan, legacyAct, legacyReady } from './gen-airline-glance.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, failN = 0;
const ok = (c, msg, detail = '') => { if (c) pass++; else { failN++; console.log(`❌ ${msg}${detail ? `\n     ${String(detail).slice(0, 700)}` : ''}`); } };
const read = f => fs.readFileSync(path.join(HERE, f), 'utf8');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const block = (html, name) => { const a = html.indexOf(`<!--${name}-->`), b = html.indexOf(`<!--/${name}-->`); return a >= 0 && b > a ? html.slice(a, b + name.length + 7) : ''; };
/* 開きタグの位置から対になる </div> まで（生成器の関数を使わずに、ここで数える） */
const divTo = (h, i) => { const re = /<div\b|<\/div>/g; re.lastIndex = i; let d = 0, m; while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (!d) return m.index + 6; } return h.length; };
const faqSections = h => [...h.matchAll(/<div class="glass p-8 fade-up"[^>]*>/g)].map(m => h.slice(m.index, divTo(h, m.index)))
  .filter(sec => /<h2\b[^>]*>[^<]*よくある質問/.test(sec) && !/<div class="glass p-8 fade-up"/.test(sec.slice(1))).join('\n');
const ALL = Object.keys(SALARY);
const OTHER = ALL.filter(s => !LEAD.includes(s));
const ORIG = Object.fromEntries(ALL.map(s => [s, read(pageOf(s))]));
const REPO_SHA = sha(ALL.map(s => ORIG[s]).join('\u0000'));

/* ═══ A) 1か所の切り替え ═══ */
ok(same(LEAD, ['jal', 'ana', 'cathay-pacific', 'etihad', 'eva-air']), 'A 先行5社は JAL・ANA・キャセイ・エティハド・エバー', LEAD.join(','));
ok(LEAD.every(s => SWITCH.includes(s)) && GLANCE === SWITCH && same([...TABBED], [...SWITCH]) && same([...NO_FAQ], [...LEAD]),
  'A 切り替えは SWITCH の1か所（GLANCE・TABBED は SWITCH そのもの・「よくある質問」を置かないのは先行5社だけ）');
{
  const MARK = /<!--PV-HERO-->|<!--PV-GLANCE-->|data-pv-glance="1"/;
  const bad = ALL.filter(s => !SWITCH.includes(s) && MARK.test(ORIG[s]));
  ok(!bad.length, `A SWITCH の外の会社ページ（${ALL.length - SWITCH.length}枚）に、新しい会社ページの印が1つも無い`, bad.join(','));
  const missing = SWITCH.filter(s => !MARK.test(ORIG[s]));
  ok(!missing.length, 'A SWITCH の会社ページには新しい会社ページの印が在る（流し忘れが無い）', missing.join(','));
  let stale = [];
  try { stale = LEAD.filter(s => build(s, ORIG[s]) !== ORIG[s]); } catch (e) { stale = [String(e.message)]; }
  ok(!stale.length, 'A 先行5社のページは gen-airline-glance.mjs の出力と1文字も違わない', stale.join(','));
  const want = Math.ceil(Math.max(...SWITCH.flatMap(s => ['cap', 'fo'].map(r => SALARY[s][r].avg))) / 1000) * 1000;
  ok(AXIS === want, `A 棒の目盛の右端は SWITCH の全社の推定のいちばん大きい額から（${want}万）`, `AXIS=${AXIS}`);
  let refused = '';
  try { build(OTHER.find(s => !SWITCH.includes(s)), ORIG[OTHER.find(s => !SWITCH.includes(s))]); } catch (e) { refused = e.message; }
  ok(/SWITCH に無い/.test(refused), 'A 生成器は SWITCH に無い会社のページを作らない（断る）', refused || '作ってしまった');
}

/* ═══ B) 画面に出してよい行（本物の台帳）═══ */
const R = research();
const rowsOf = slug => Object.values(R.FACTS[slug] || {}).flat();
{
  const all = [...Object.values(R.FACTS).flatMap(F => Object.values(F).flat()), ...Object.values(R.SOURCES).flat()];
  const unset = all.filter(r => !SHOWN.includes(r.use));
  ok(unset.length >= 1 && unset.every(r => why(r)), `B 使い方が4つ（条件つき・募集・過去・参考）でない行は出さない（台帳に ${unset.length}行）`, unset.filter(r => !why(r)).map(r => r.id).join(','));
  const base = rowsOf('british-airways').find(r => r.use === '条件つき' && r.domain !== 'pay');
  ok(!!base && !why(base), 'B 見本の行（ブリティッシュ・エアウェイズの条件つきの行）は出せる', base && why(base));
  for (const u of ['保留', '空欄', '未指定', undefined, '']) ok(base && why({ ...base, use: u }), `B 使い方が「${u ?? '無し'}」の行は出さない`);
  for (const u of SHOWN) {
    const x = { ...base, use: u, effective: { from: '2017-05-01', to: null } };
    ok(base && !why(x), `B 使い方が「${u}」の行は why を通る（日付つき。過去・参考をカードに置くのは言い方ができてから ── 下の段）`, why(x));
  }
  ok(base && why({ ...base, use: '過去', effective: { from: null, to: null }, src: base.src.map(s => ({ ...s, published: null })) }), 'B 日付の無い過去の行は出さない');
  const pay = Object.values(R.SOURCES).flat();
  const mixed = pay.filter(r => !['cap', 'fo'].includes(r.rank || (r.applies_to && r.applies_to.rank)));
  ok(mixed.length >= 1 && mixed.every(r => why(r, { pay: true })), `B 機長と副操縦士を分けない給与は、使い方が何でも出さない（台帳に ${mixed.length}行）`, mixed.filter(r => !why(r, { pay: true })).map(r => r.id).slice(0, 5).join(','));
  const capRow = pay.find(r => r.rank === 'cap' && SHOWN.includes(r.use) && r.use !== '過去');
  ok(!!capRow && !why(capRow, { pay: true }), 'B 機長の給与の行は出せる（使い方が4つのどれかなら）', capRow && why(capRow, { pay: true }));
  for (const rk of ['all', 'crew', undefined]) ok(capRow && why({ ...capRow, rank: rk, applies_to: { ...(capRow.applies_to || {}), rank: rk } }, { pay: true }), `B 職位が「${rk ?? '無し'}」の給与は出さない`);
  /* 空港までの移動：ダラスの Love Field の行（サウスウエストの拠点）を、同じ街につないだアメリカン（DFW の会社）に出さない */
  const love = (R.LIVING.dallas ? R.LIVING.dallas.commute : []).find(r => /Love Field/.test(`${r.value} ${r.label_ja}`));
  const swBase = rowsOf('southwest').filter(r => r.key === 'pilot_base' && !why(r)).map(r => r.value);
  ok(!!love && !!why(love, { bases: [] }) && !!why(love, { bases: ['DFW'] }), 'B 空港までの移動：Love Field（DAL）の行は、拠点が DFW の会社にも、拠点の分からない会社にも出さない', love && love.id);
  ok(!!love && swBase.includes('DAL') && !why(love, { bases: swBase }), 'B 同じ行は、拠点に DAL を持つサウスウエストには出せる', swBase.join('・'));
  ok(!!love && why({ ...love, label_ja: 'ダラスの空港アクセス', value: '電車で空港へ', value_text: null, cond_ja: '' }, { bases: ['DAL'] }), 'B 空港の名前の無い移動の行は出さない（空港が決まらない）');
}
/* 過去・参考の行（why は通る）は、画面の言い方ができるまで（全社へ広げる c の言い回しの表）どのカードにも置かない。
   言い方の無いまま並べると、過去の制度が今の制度に読める ── 今の待遇・勤務の1行めにもなっていた（11社）。
   ★ここは airline-rollout.mjs の WORDED を読まずに、決まりの字（条件つき・募集）で見る（WORDED に過去を足すだけでは緑にならない）。 */
{
  const V = Object.fromEntries(OTHER.map(s => [s, viewOf(s)]));
  const wordless = OTHER.flatMap(s => rowsOf(s).filter(r => (r.use === '過去' || r.use === '参考') && !why(r)).map(r => [s, r]));
  const leak = [];
  for (const s of OTHER) {
    const v = V[s];
    for (const f of [...v.work, ...v.benefits, ...v.company.profile, ...v.company.scale]) if (f.use !== '条件つき') leak.push(`${s}:${f.id}（${f.use}）`);
    for (const f of [...v.jobs, ...v.base.rows]) if (f.use !== '条件つき' && f.use !== '募集') leak.push(`${s}:${f.id}（${f.use}）`);
  }
  const unheld = wordless.filter(([s, r]) => !V[s].held.some(h => h.id === r.id && /言い方/.test(h.why))).map(([s, r]) => `${s}:${r.id}`);
  ok(wordless.length >= 1 && !leak.length && !unheld.length,
    `B 過去・参考の行（台帳に ${wordless.length}行）は、言い方ができるまでどのカードにも置かない（勤務・待遇・会社の数字は条件つきだけ・募集と拠点は条件つきと募集だけ）── 出さない行に理由つきで数える`,
    [...leak, ...unheld.map(x => `出さない行に無い ${x}`)].slice(0, 6).join(' ／ '));
}

/* ═══ C) 古い節の台帳（107枚ぜんぶ）・どの会社も読み口が通る ═══ */
{
  const unknown = [], faqDrop = [], keepDrop = [], wrong = [], view = [];
  for (const s of ALL) {
    let v;
    try { v = viewOf(s); if (!/^#[0-9a-fA-F]{6}$/.test(v.color) || !/^[A-Z0-9]{2,4}$/.test(v.code) || v.pay.cap.est.man !== SALARY[s].cap.avg || v.pay.fo.est.man !== SALARY[s].fo.avg) view.push(s); }
    catch (e) { view.push(`${s}（${e.message}）`); continue; }
    if (LEAD.includes(s)) continue;
    for (const p of legacyPlan(s, ORIG[s], v)) {
      if (!p.row) { unknown.push(`${s}:${p.title}`); continue; }
      if (/よくある質問/.test(p.title) && p.act !== 'keep') faqDrop.push(s);
      if (p.row.state === 'keep' && p.act !== 'keep') keepDrop.push(`${s}:${p.title}`);
      /* 外すのは needs の全部が出せるときだけ（ここで作り直して突き合わせる） */
      const want = p.row.state === 'keep' || p.row.rest === 'keep' ? 'keep' : p.row.rest === 'drop' ? 'drop'
        : (p.row.needs || []).length && p.row.needs.every(n => legacyReady[n](v)) ? 'drop' : 'keep';
      if (want !== p.act) wrong.push(`${s}:${p.title}=${p.act}`);
    }
  }
  ok(!view.length, `C どの会社（${ALL.length}社）も読み口（viewOf）が通る ── 色・略号が読め、推定年収は SALARY の avg`, view.join(' ／ '));
  ok(!unknown.length, `C 先行5社ではない会社のページ（${OTHER.length}枚）の古い節は、どれも台帳（LEGACY・LEGACY_REST）に在る`, unknown.join(' ／ '));
  ok(!faqDrop.length, 'C 先行5社ではない会社では「よくある質問」を外さない', faqDrop.join(','));
  ok(!keepDrop.length && LEGACY_REST.filter(r => r.state === 'keep').length >= 4, 'C 検索向けの読み物（「…vs ANA —」「…の実態」「…に転職するには」ほか）は外さない', keepDrop.join(' ／ '));
  ok(!wrong.length, 'C 古い節を外すのは、新しい部品がその話を出せるとき（needs の全部）だけ', wrong.slice(0, 6).join(' ／ '));
  const lead = LEAD.flatMap(s => LEGACY.map(r => [s, r, legacyAct({ slug: s }, r)])).filter(([, r, a]) => a !== (r.state === 'keep' ? 'keep' : 'drop'));
  ok(!lead.length, 'C 先行5社の古い節の決め方は今までどおり（keep 以外は外す・「よくある質問」も外す）', lead.map(([s, r]) => `${s}:${r.name}`).join(','));
}

/* ═══ D) 写しの中で2社を切り替える ═══ */
/* PV_ROLLOUT_TRY=all（か会社の ID をカンマで）── 調べるときだけ、写しの中で切り替える会社を替える。
   既定は見本の2社と、台帳の待遇が過去の行だけの1社（南アフリカ航空 ── 過去の行が今の待遇の1行めになっていた会社）。
   ⚠️ 既定でない回は、目盛の段（額の大きい会社を足す）と「先行5社は島の1行だけ」を見ない（切り替える会社しだいで目盛が動くため）。 */
const SWEEP = process.env.PV_ROLLOUT_TRY || '';
const TRY = (SWEEP === 'all' ? OTHER : SWEEP ? SWEEP.split(',') : ['british-airways', 'skymark', 'south-african-airways']).filter(s => !SWITCH.includes(s));
/* 過去・参考の行（why は通る・字の長さが4字から）。下の2つの段が見る */
const wordlessOf = s => rowsOf(s).filter(r => (r.use === '過去' || r.use === '参考') && !why(r) && typeof r.label_ja === 'string' && r.label_ja.length > 3);
const htmlEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const htmlText = h => h.replace(/<span[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-rollout-'));
try {
  ok(SWEEP ? TRY.length > 0 : TRY.length === 3, SWEEP ? `D 写しの中で切り替える会社（${TRY.length}社）` : 'D 写しで切り替える3社（ブリティッシュ・エアウェイズ・スカイマーク・南アフリカ航空）は、まだ SWITCH に無い', TRY.join(','));
  if (!SWEEP) ok(TRY.some(s => wordlessOf(s).length), 'D 写しで切り替える会社に、台帳に過去の行を持つ会社が在る（過去・参考の段が空振りしない）', TRY.map(s => `${s}:${wordlessOf(s).length}`).join(','));
  /* 写し：上の段はリンク。会社ページのフォルダは本物のフォルダ（ページは本物の写し）。生成の道すじのモジュールと台帳は本物の写し。 */
  const COPY = ['airline-rollout.mjs', 'pv-airline-view.mjs', 'gen-airline-glance.mjs', 'gen-career.mjs', 'gen-faq.mjs', 'research-ledger.mjs'];
  for (const b of fs.readdirSync(HERE)) {
    if (['.git', 'airlines', ...COPY].includes(b)) continue;
    fs.symlinkSync(path.join(HERE, b), path.join(T, b));
  }
  for (const f of COPY) fs.copyFileSync(path.join(HERE, f), path.join(T, f));
  fs.mkdirSync(path.join(T, 'airlines'));
  for (const b of fs.readdirSync(path.join(HERE, 'airlines'))) {
    if (b.endsWith('.html')) fs.copyFileSync(path.join(HERE, 'airlines', b), path.join(T, 'airlines', b));
    else fs.symlinkSync(path.join(HERE, 'airlines', b), path.join(T, 'airlines', b));
  }
  const sw = path.join(T, 'airline-rollout.mjs'), SW = 'export const SWITCH = Object.freeze([...LEAD]);';
  const swText = fs.readFileSync(sw, 'utf8');
  ok(swText.split(SW).length === 2, 'D 切り替えの1行（SWITCH）が写しの中にちょうど1つ');
  fs.writeFileSync(sw, swText.replace(SW, () => `export const SWITCH = Object.freeze([...LEAD, ${TRY.map(s => `'${s}'`).join(', ')}]);`));
  const gen = () => spawnSync(process.execPath, ['gen-airline-glance.mjs'], { cwd: T, encoding: 'utf8' });
  const page = s => fs.readFileSync(path.join(T, pageOf(s)), 'utf8');
  const r1 = gen(), r2 = gen();
  ok(r1.status === 0 && TRY.every(s => r1.stdout.includes(pageOf(s))), `D 写しの中で切り替えた${TRY.length}社のページが生成できる（止まらない）`, r1.stderr || r1.stdout);
  ok(r2.status === 0 && /✓ 変更なし/.test(r2.stdout), 'D 2回めは「✓ 変更なし」', r2.stdout + r2.stderr);
  for (const s of TRY) {
    const a = ORIG[s], b = page(s), g = block(b, 'PV-GLANCE');
    ok(/<!--PV-HERO-->/.test(b) && g && /data-pv-glance="1"/.test(b) && /id="pvg-tabs"/.test(b), `D ${s}: 新しい会社ページの塊とタブが在る`);
    /* よくある質問：塊の中身は同じ字（足してよいのは、どのタブの節かの印 data-pvg-pane だけ） */
    /* gen-faq.mjs の塊（PV-FAQ）か、塊を持たない会社（手で書いた節・JS で描く節）では「よくある質問」の見出しを持つ節ぜんぶ */
    const faq = h => (block(h, 'PV-FAQ') || faqSections(h)).replace(/ data-pvg-pane="[a-z ]+"/g, '');
    ok(faq(a) && faq(a) === faq(b), `D ${s}:「よくある質問」の節が、前と同じ字で残る`);
    const ld = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    ok(/FAQPage/.test(ld(a)) && ld(a) === ld(b), `D ${s}: 検索向けの構造化データ（FAQPage・Article ほか）が1文字も変わらない`);
    const head = h => h.slice(0, h.indexOf('</head>')).replace(/<!--PV-GLANCE-HEAD-->[\s\S]*?<!--\/PV-GLANCE-HEAD-->\n/, '');
    ok(head(a) === head(b), `D ${s}: <head>（題・説明・検索向けの字）は、部品の <link> の塊のほかは1文字も同じ`);
    ok(['airline-reviews-data.js', 'airline-reviews-ui.js'].every(f => b.includes(`src="${f}"`)), `D ${s}: 海外の評判のカードの部品を読んだまま`);
    const plan = legacyPlan(s, a, viewOf(s));
    const h2 = h => [...h.slice(h.indexOf('<!--/PV-GLANCE-->')).matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
    const below = h2(b);
    const lost = plan.filter(p => p.act === 'keep' && !below.includes(p.title)).map(p => p.title);
    const left = plan.filter(p => p.act === 'drop' && below.includes(p.title)).map(p => p.title);
    ok(plan.some(p => p.act === 'keep') && !lost.length && !left.length, `D ${s}: 残すと決めた古い節は残り（${plan.filter(p => p.act === 'keep').length}）、外すと決めた節は無い（${plan.filter(p => p.act === 'drop').length}）`, `残らなかった: ${lost.join('・')} ／ 残った: ${left.join('・')}`);
    /* 外した節の話を、新しいページが本当に出しているか（生成器の legacyReady を使わず、出来上がったページの字で見る） */
    const cellOf = id => (g.match(new RegExp(`<article class="pvg-card pvg-cell" data-cell="${id}"[\\s\\S]*?</article>`)) || [''])[0];
    const SHOWS = {
      pay: () => /<article class="pvg-card pvg-pay"/.test(g) && /<p class="pvg-big">/.test(g),
      intro: () => /data-pvg-about="lead"/.test(g),
      fleet: () => /class="pvg-fleet"/.test(g),
      network: () => /id="pvg-st-list"/.test(g),
      work: () => !!cellOf('work') && !cellOf('work').includes('会社が公表している勤務の条件を確認できていません'),
      benefits: () => !!cellOf('benefits') && !cellOf('benefits').includes('会社が公表している待遇を確認できていません'),
      jobs: () => /<article class="pvg-card pvg-jobs"/.test(g) && !g.includes('会社が公表している募集を確認できていません。'),
      compare: () => /pvg-btn-cmp/.test(block(b, 'PV-HERO')),
    };
    /* rest:'drop'（出してはいけない額を載せた節 ── P12.77）は、新しい部品を待たずに外す（理由は台帳の rest_why） */
    const early = plan.filter(p => p.act === 'drop' && p.row.rest !== 'drop' && !(p.row.needs || []).every(n => SHOWS[n] && SHOWS[n]())).map(p => `${p.title}（${p.row.needs}）`);
    ok(!early.length, `D ${s}: 外した古い節の話は、新しいページが出している（出していない話の節は外していない）`, early.join(' ／ '));
    /* 過去・参考の行は、言い方ができるまでページに無い。勤務・待遇のカードの1行め（見出し）は条件つきの行か、無ければ今までの字 */
    const wl = wordlessOf(s), seen = wl.filter(r => g.includes(htmlEsc(r.label_ja)));
    ok(!seen.length, `D ${s}: 過去・参考の行（台帳に ${wl.length}行）の字が、ページに無い（言い方ができるまで）`, seen.map(r => `${r.use}：${r.label_ja}`).join(' ／ '));
    const cond = new Set(rowsOf(s).filter(r => r.use === '条件つき').map(r => r.label_ja));
    const heads = ['work', 'benefits'].map(id => htmlText((cellOf(id).match(/<p class="pvg-k">([\s\S]*?)<\/p>/) || ['', ''])[1]));
    ok(heads.every(k => k === '会社の公表' || cond.has(k)), `D ${s}: 勤務・待遇のカードの1行め（見出し）は、条件つきの行か、無ければ今までの「会社の公表」`, heads.join(' ／ '));
    const big = [...g.matchAll(/<p class="pvg-big">([^<]*)<\/p>/g)].map(m => m[1]);
    ok(same(big, ['cap', 'fo'].map(r => `¥${SALARY[s][r].avg.toLocaleString('en-US')}万`)), `D ${s}: 推定年収は SALARY の avg（機長・副操縦士）`, big.join(' ／ '));
    ok(!/data-kind="crew"|全体の平均/.test(g), `D ${s}: 機長と副操縦士を分けない額（乗員全体の平均）を出さない（P12.77）`);
    /* 本文（<body> から）のどこにも、運航乗務員の平均の額を残さない ── 残した古い節の中も（P12.77。<head> の題と説明はこの生成器の外） */
    const body = b.slice(b.indexOf('<body'));
    const crewText = body.replace(/<[^>]*>/g, ' ').match(/運航乗務員(?:の平均|全体)[^。]{0,40}\d[\d,]*万/g) || [];
    ok(!crewText.length, `D ${s}: ページの本文に、運航乗務員の平均の額が無い（残した古い節の中も・P12.77）`, crewText.join(' ／ '));
    const crewNotes = (BASIS[s] && BASIS[s].crew ? BASIS[s].notes || [] : []).filter(n => g.includes(n));
    ok(!crewNotes.length, `D ${s}: 乗員全体の平均が在る会社の、年収の根拠の注を出さない`, crewNotes.join(' ／ '));
    ok(g.includes('就航地ごとのホテル・レストランは、会社が公表する就航地の一覧を確認してから開きます。') && g.includes('家賃の資料を確認できていません'),
      `D ${s}: 資料をまだ出せない所は、今までの字（就航地「…確認してから開きます。」・暮らし「家賃の資料を確認できていません」）`);
    const unset = rowsOf(s).filter(r => !SHOWN.includes(r.use)).filter(r => [r.label_ja, r.value].some(t => typeof t === 'string' && t.length > 3 && g.includes(t)));
    ok(!unset.length, `D ${s}: 使い方が4つでない台帳の行の字が、ページに無い`, unset.map(r => r.id).join(','));
  }
  /* 台帳の写しで、出ている行の使い方を 保留・未指定、参考・過去（日付つき ＝ why は通る）に替えると、その行の字がページから消える
     （ほかの行は残る）。参考・過去は、言い方ができるまで出さない（airline-rollout.mjs の WORDED）。 */
  if (TRY.includes('british-airways')) {
    const s = 'british-airways', v = viewOf(s), g0 = block(page(s), 'PV-GLANCE');
    const onPage = [...v.benefits, ...v.jobs, ...v.work].filter(f => f.id && f.label.length > 3 && g0.split(f.label).length === 2);
    ok(onPage.length >= 5, `D ${s}: 台帳の行がページに出ている（${onPage.length}行）`);
    if (onPage.length >= 5) {
      const [x, y, z, p, q] = onPage;
      const led = path.join(T, 'research-ledger.mjs'), t = fs.readFileSync(led, 'utf8');
      const a0 = t.indexOf('/*PV-IMPORT-JSON*/') + 18, b0 = t.indexOf('/*/PV-IMPORT-JSON*/');
      const J = JSON.parse(t.slice(a0, b0));
      for (const [f, u] of [[x, '保留'], [y, '未指定'], [p, '参考'], [q, '過去']]) for (const rows of Object.values(J.FACTS[s])) for (const r of rows) if (r.id === f.id) {
        r.use = u;
        if (u === '過去') r.effective = { ...(r.effective || {}), from: '2019-04-01' };
        if (u === '参考' || u === '過去') ok(!why(r), `D ${s}: 替えた「${u}」の行は why を通る（消えるのは言い方が無いから）`, why(r));
      }
      fs.writeFileSync(led, t.slice(0, a0) + JSON.stringify(J) + t.slice(b0));
      const r3 = gen(), g1 = block(page(s), 'PV-GLANCE');
      ok(r3.status === 0 && !g1.includes(x.label) && !g1.includes(y.label), `D ${s}: 使い方を 保留・未指定 に替えた2行の字が、ページから消える`, `${x.label} ／ ${y.label}`);
      ok(r3.status === 0 && !g1.includes(p.label) && !g1.includes(q.label), `D ${s}: 使い方を 参考・過去（日付つき）に替えた2行の字も、ページから消える（言い方ができるまで）`, `${p.label} ／ ${q.label}`);
      ok(z && g1.includes(z.label), `D ${s}: 替えていない行は残る`, z && z.label);
    }
  }
  /* 「よくある質問」を書く道具は、切り替えた会社を飛ばさない（今までどおり書き直す）── そして流しても1文字も変えない。
     見るだけの切り替え（--dry）で流す ＝ 1文字も書かない。⚠️ --check は書き込む。使わない。 */
  const fq = spawnSync(process.execPath, ['gen-faq.mjs', '--dry'], { cwd: T, encoding: 'utf8' });
  ok(fq.status === 0 && TRY.every(s => new RegExp(`[＋↺] ja ${s}\\s`).test(fq.stdout)) && /日本語: 可視FAQを新設 0枚 ／ 既存FAQに構造化データを合わせた 0枚/.test(fq.stdout),
    `D gen-faq.mjs は切り替えた${TRY.length}社の「よくある質問」を今までどおり書き直す側に数え、流しても日本語のページを1文字も変えない`, (fq.stdout.match(/^.*(british-airways|skymark|south-african-airways|日本語).*$/gm) || []).join(' ／ ') + fq.stderr);
  const cs = spawnSync(process.execPath, [path.join(HERE, 'check-salary.mjs')], { cwd: T, encoding: 'utf8' });
  const csLine = (cs.stdout.match(/\d+ファイル・\d+件照合[^\n]*/) || [''])[0];
  ok(cs.status === 0 && /❌0 ⚠️0/.test(csLine), 'D 切り替えた写しで check-salary.mjs が ❌0 ⚠️0（新しい会社ページの額も、残した節の額も正本どおり）', csLine || cs.stdout.slice(-400));
  const changed = ALL.filter(s => !SWITCH.includes(s) && !TRY.includes(s) && page(s) !== ORIG[s]);
  ok(!changed.length, `D SWITCH の外の会社ページ（写しの中の${ALL.length - SWITCH.length - TRY.length}枚）は1文字も変わらない`, changed.join(','));
  if (!SWEEP) {
    const lead = LEAD.filter(s => { const a = ORIG[s].split('\n'), b = page(s).split('\n'); return a.length !== b.length || a.some((l, i) => l !== b[i] && !/id="crc-data"/.test(l)); });
    ok(!lead.length, 'D 先行5社のページは、島（#crc-data に会社が足される）の1行のほかは変わらない（目盛が動かない額の会社だけなので）', lead.join(','));
    /* 目盛の右端は、切り替えた会社ぜんぶの推定から（額の大きい会社を足すと、先行5社の目盛と棒も一緒に動く）。 */
    {
      const BIG = Object.keys(SALARY).filter(s => !SWITCH.includes(s) && !TRY.includes(s)).sort((a, b) => SALARY[b].cap.avg - SALARY[a].cap.avg)[0];
      const end = Math.ceil(Math.max(...[...SWITCH, ...TRY, BIG].flatMap(s => ['cap', 'fo'].map(r => SALARY[s][r].avg))) / 1000) * 1000;
      const t2 = fs.readFileSync(sw, 'utf8').replace(/export const SWITCH = Object\.freeze\(\[\.\.\.LEAD, ([^\]]*)\]\);/, (m, x) => `export const SWITCH = Object.freeze([...LEAD, ${x}, '${BIG}']);`);
      fs.writeFileSync(sw, t2);
      const r4 = gen();
      const widths = s => [...block(page(s), 'PV-GLANCE').matchAll(/<i class="pvg-bar pvg-bar-est" style="width:([\d.]+)%"><\/i>/g)].map(m => +m[1]);
      const want = s => ['cap', 'fo'].map(r => +Math.min(100, (SALARY[s][r].avg / end) * 100).toFixed(2));
      const off = [...LEAD, BIG].filter(s => !page(s).includes(`--pvg-n:${end / 1000}"`) || !same(widths(s), want(s)));
      ok(r4.status === 0 && end > AXIS && !off.length, `D 推定のいちばん大きい会社（${BIG}・¥${SALARY[BIG].cap.avg.toLocaleString('en-US')}万）を足すと、目盛の右端は ¥${end.toLocaleString('en-US')}万になり、先行5社の棒もその目盛で描かれる`, off.join(',') + r4.stderr);
    }
  }
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}
ok(sha(ALL.map(s => read(pageOf(s))).join('\u0000')) === REPO_SHA, 'リポジトリの会社ページは、この検査で1バイトも変わっていない');

console.log(`${failN ? '❌' : '✅'} assert-rollout: ${pass} pass / ${failN} fail（写しの中で${TRY.length}社を切り替えて流した。リポジトリには書いていない）`);
process.exit(failN ? 1 : 0);
