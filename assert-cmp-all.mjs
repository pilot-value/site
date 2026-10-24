/* ══════════════════════════════════════════════════════════════════
   assert-cmp-all.mjs — 全社どうしの比較を、ブラウザで通して歩く（2026-10-25・段階5 compare-all-6）

   比較（career.html?view=compare）は年収の正本（SALARY）の112社のどの2社でも並べられる。6,216 の組は全部は試せないので、
   組ではなく集合で見る（比較の設計 D20）── 静かな部分は assert-career.mjs が112社ぶん見ている。ここは、人が出会う流れを手で通す。

   守っているもの（どれも人が出会う流れ ＝ 決まりの B。壊して赤を見る決まり A は assert-career.mjs の側に在る）
     ・場面 ring（T-B1）── 390×680 と 1280×800 は円で、1280×800 はもう一度ドルで。正本の並び（Object.keys(SALARY)）の1社目と2社目で
       開き、選ぶ面で「古いほうの側」に次の会社を選んでいく（112手）→ 入れ替え → もう112手。112 は偶数なので、1周だけだと
       同じ会社がいつも同じ側に来る ── 入れ替えを1回はさんで、どの会社も1回は左・1回は右に立つ（数えて確かめる）。
       1手ごとに：住所に2社・履歴の数は開いたときのまま・札が2社・会社ごとの並び（年収の2行・税・公表額・家賃・クレジット・
       「詳しく」の足）が見えているのはその2社だけ（その入れ物が持つ会社だけ・この順）── 持つ会社が無い入れ物は隠れている
       （公表額の箱は、一覧が無ければ隠れてよい）・生きた欄が全部その2社のもの（data-for）で、社名の札（.crl-co）が2社の名前の順・
       棒の長さ ＝ 額 ÷ 2社の目盛の右端（正本と台帳からここで作る ── 生成側の関数は読まない）・描いた長さも同じ・見えている目盛は
       その右端の1本・円の回は行の額が正本の額の字・ドルの回は見えている字に ¥ も 万 も無い・ページのエラーが0。
     ・場面 find（T-B2）── 選ぶ面の検索が、航空会社一覧（world-airlines.html）と同じ会社を同じ順に出す。言葉の一覧 QUERIES は
       一覧の正本（directory-model.mjs の model()）の7社ごとの1社（16社・8つの地域にまたがる）の日本語名・英語名・略号の全部・
       国名（日・英）と、決めた11語（ana・UA・ドイツ・Germany・ｴﾐﾚｰﾂ・ぴーち・ＡＮＡ・"ana "・エール フランス・airfrance・zzzz）。
       一覧の側は assert-directory-ui.mjs の dirOpen() で開き（地域は「すべて」）、終わりに quiet() が空。zzzz は両方に同じ1文。
       キーボード（1280）：欄 → ↓ で最初の会社 → ↑ で欄 → Enter で最初の当たりを選ぶ（住所がその会社・履歴は増えない）・
       Esc で閉じて焦点は札のボタン・開いているあいだ Tab で面の外へ出ない。
       指（390・pointer: coarse）：開いても検索欄に焦点を置かない（文字盤で一覧を隠さない）・どの会社の行も 44px 以上・
       後ろのページが動かない（開く前・見出しの帯を引く・地を引く・短くした一覧を引く・閉じたあと、の scrollY が同じ）・
       欄で押して面の外 20px で離しても閉じない・欄の横の余白を押しても閉じない・地を押すと閉じる。
     ・場面 card（T-B5）── 1社のカード（ユナイテッド・イーグルジェット・スイス）と2社のカード（ユナイテッド｜デルタ・JAL｜ユナイテッド・
       エミレーツ｜JAL・スイス｜イーグルジェット）× 2つのデザイン × 円とドル：カードの職位の字 ＝ 比較の画面に見えているその会社の額
       （同じ通貨）・棒 ＝ 額 ÷ カードの目盛の右端（2社は2社で1本）・2社のカードは同じ目盛の3つの字・その字は画面の同じ右端の目盛の字・
       どのカードにも住所と QR・描いた字はカードの WORD と材料の公開の字と住所の切れ端と写真のクレジットだけ
       （assert-career.mjs の T-C3 と同じ決め方）。JAL｜ユナイテッドは、会員 c の画面で生きた欄に植えた印（assert-cmp-frame.mjs の
       場面 leak と同じ形の ZZ…ZZ と、提出された年収の額）が画面に出たのを見届けてから描かせる ── 描いた字にも材料にも印が無い。
       （カードの額の決まり A は assert-career.mjs の R5。ここは B）
     ・場面 back（T-B6）── 390×680、ユナイテッド｜デルタとエミレーツ｜JAL：右の会社の「詳しく」の足を1本ずつ押す →
       /airlines/{slug}.html（タブの在るページは、その足の # のタブ）→ 戻る（読み込み直したページ）→ 同じ住所・同じ2社・同じ順・
       欄が全部落ち着いたあとも位置が出る前と 1px のうち（assert-career.mjs の T-L6 (a) と同じ形）。
     ・門（どの場面も）── 開く画面は全部 cmp-stubs.mjs の門（または一覧の dirOpen の門）を通る。通してよいのは、この検査が起こした
       手元のサーバーと部品・書体の配信元（LIBS）だけ。場面の終わりに：止めた外への要求 0・本番の supabase への要求 0・すり抜け 0・
       用意していない返事 0。ブラウザは localhost と LIBS のほかの名前を引けない（cmp-stubs.mjs の NO_NAMES）。

   実行: node assert-cmp-all.mjs [--scenes ring,find,card,back] [--shots <リポジトリの外のフォルダ>]
     --scenes  場面を選ぶ。付けなければ全部（ring・find・card・back）。ブラウザを使う ── ほかのブラウザの検査と同時に流さない
     --shots   場面の区切りの画面を撮って置く（置き場は打った場所。ファイルに書かない）
   自分で手元の保存先を空いているポートで起こし（cmp-stubs.mjs の startLocal ── 一時フォルダ。3000番・3100番は使わない）、
   終わったら丸ごと捨てる。生きた欄の返事は全部この検査が作る（MOCK ── 何も保存しない・ゲストの顔。カードの印の回だけ会員 c）。
   結果の行の頭に、静かな部分（手元で配ったページそのもの）を見た行は [REAL LOCAL]、生きた欄の返事に頼る行は [MOCK]。
   本番については何も言わない（本番は 未確認）。
   check.mjs には入っていない（手で流す ── P5.1）。後で足す場面（faces・local）は、発売のあとの回（compare-all-8）。
   ══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import * as H from './cmp-stubs.mjs';
import { SALARY } from './salary-data.mjs';
import { figures } from './salary-basis.mjs';
import { model as dirModel } from './directory-model.mjs';
import { dirOpen, quiet } from './assert-directory-ui.mjs';

const read = (rel) => fs.readFileSync(path.join(H.ROOT, rel), 'utf8');
const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const WANT = argOf('--scenes') ? argOf('--scenes').split(',').map((s) => s.trim()).filter(Boolean) : null;
const SHOTS = argOf('--shots') ? path.resolve(argOf('--shots')) : null;
if (SHOTS && (SHOTS + path.sep).startsWith(H.ROOT)) { console.error('--shots はリポジトリの外に置く'); process.exit(2); }

/* ── 数え方と書き方 ─────────────────────────────────────────── */
let pass = 0, fail = 0;
const ok = (cond, label, detail = '', tag = 'MOCK') => {
  const t = tag === 'local' ? '[REAL LOCAL]' : '[MOCK]';
  if (cond) { pass++; console.log(`${t} ✓ ${label}`); }
  else { fail++; console.log(`${t} ✗ ${label}${detail ? `\n      ${String(detail).slice(0, 900)}` : ''}`); }
};
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 44 - t.length))}`);
const J = (v) => JSON.stringify(v);
const same = (a, b) => J(a) === J(b);
/* 描いたあとの2コマ */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

/* ── 正本と台帳から作る数（生成側の関数は読まない ── assert-career.mjs の DRAWN / SCALE と同じ決め方）──────── */
const ALLK = Object.keys(SALARY);
const ROLES = ['cap', 'fo'];
const JA = (s) => SALARY[s].ja;
const yen = (m) => `¥${m.toLocaleString('en-US')}万`;
/* 目盛に入れる額（推定 avg・幅の上の額 hi・会社が公表している機長と副操縦士の額）と、並べた会社をあわせた右端（1,000万 の倍数へ切り上げ） */
const DRAWN = (s) => ROLES.flatMap((r) => [SALARY[s][r].avg, SALARY[s][r].hi, ...figures(s, r).filter((f) => !f.training).map((f) => f.man)]).filter((n) => n > 0);
const SCALE = (...list) => Math.ceil(Math.max(...list.filter(Boolean).flatMap(DRAWN)) / 1000) * 1000;

/* 生きた欄の返事（ゲストの落ち着いた顔）。給与の一覧は鍵の無いゲストの答え・行なし（cmp-stubs.mjs の payFix） */
const GUEST = { pv_pay_rows: () => ({ status: 200, body: H.payFix.guest() }) };

/* ── 舞台（1回の実行に1つ）─────────────────────────────────────── */
let env = null, browser = null;
const PAGES = [];
const open = async (size, opt = {}) => {
  const o = await H.open(browser, env.local, size, { mode: 'mock', ...opt, stub: { ...GUEST, ...(opt.stub || {}) } });
  PAGES.push(o);
  return o;
};
/* 場面の終わりに、その場面で開いた全部の画面の門を確かめる */
const netCheck = (label, list) => {
  const sum = (k) => list.reduce((n, o) => n + o.st[k].length, 0);
  const got = { through: sum('through'), supa: sum('supa'), blocked: sum('blocked'), unknown: sum('unknown') };
  ok(got.through === 0 && got.supa === 0 && got.blocked === 0 && got.unknown === 0,
    `${label}：門 ── 外への要求を止めた 0・本番の supabase 0・すり抜け 0・用意していない返事 0`,
    J({ ...got, eg: list.flatMap((o) => [...o.st.through, ...o.st.supa, ...o.st.blocked, ...o.st.unknown]).slice(0, 6) }));
};

/* 比較の生きた欄が全部その2社のもので、読み終わった（読み込み中でも、まだ何もしていない顔でもない） */
const settled = (page, want, ms = 15000) => page.waitForFunction((want) => {
  const all = [...document.querySelectorAll('#cr .cr-view[data-view="compare"] .crl[data-live]')].filter((b) => b.getClientRects().length);
  return all.length > 0 && all.every((b) => b.getAttribute('data-for') === want && !['idle', 'loading'].includes(b.getAttribute('data-state')));
}, { timeout: ms, polling: 50 }, want).then(() => true, () => false);
const ready = (page) => page.waitForFunction(() => !!(window.PVCareer && window.PVCareer.state && window.PVCurrency), { timeout: 20000 });

/* 比較の画面の、いま見えているもの（1回の evaluate で） */
const snap = (page) => page.evaluate(() => {
  const v = document.querySelector('#cr .cr-view[data-view="compare"]');
  const vis = (e) => !!e && e.getClientRects().length > 0;
  const kindOf = (b) => (b.classList.contains('cr-pair') ? `年収の行（${b.dataset.role}）` : [...b.classList].find((c) => /^cr-(taxes|cards|rentbs|credits|gos)$/.test(c)));
  const boxes = [...v.querySelectorAll('.cr-pair, .cr-taxes, .cr-cards, .cr-rentbs, .cr-credits, .cr-gos')].map((b, i) => ({
    kind: kindOf(b), i, shown: vis(b),
    has: [...new Set([...b.children].map((c) => c.dataset && c.dataset.airline).filter(Boolean))],
    seen: [...b.children].filter((c) => c.dataset && c.dataset.airline && vis(c)).map((c) => c.dataset.airline),
  }));
  /* 棒の長さはレイアウトの長さ（offsetWidth）で読む ── 行が出るたびに棒は 0.9 秒かけて伸びる（career.css の cr-grow ＝ transform の動き）ので、
     見た目の幅（getBoundingClientRect）は動きの途中の幅。動きが終わったあとの見た目の幅（drawn）も一緒に返す（呼ぶ側が動きを待ってから読む回だけ使う） */
  const rows = [...v.querySelectorAll('.cr-pair .cr-row')].filter(vis).map((r) => {
    const f = r.querySelector('.cr-fill');
    return { s: r.dataset.airline, role: r.closest('.cr-pair').dataset.role, man: Number(f.dataset.man), w: parseFloat(f.style.getPropertyValue('--w')),
      fill: f.offsetWidth, track: f.parentElement.clientWidth, drawn: f.getBoundingClientRect().width,
      text: ((r.querySelector('.cr-row-v') || {}).textContent || '').trim() };
  });
  const axis = [...v.querySelectorAll('.cr-panel .cr-axis')].filter(vis).map((a) => Number(a.dataset.scale));
  const live = [...v.querySelectorAll('.crl[data-live]')].filter(vis).filter((b) => !(b.parentElement && b.parentElement.closest('.crl[data-live]')))
    .map((b) => ({ k: b.dataset.live, st: b.dataset.state, for: b.getAttribute('data-for'),
      tags: [...b.querySelectorAll('.crl-cmp > .crl-cmp-head > .crl-co')].map((x) => x.textContent.trim()) }));
  /* 見えている字のうち、¥ か 万 を含むもの（原貨のまま出す印 .pv-no-cur の中は除く） */
  const yenLeft = [];
  const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!/[¥万]/.test(n.data)) continue;
    const el = n.parentElement;
    if (!el || !el.getClientRects().length || el.closest('.pv-no-cur')) continue;
    yenLeft.push(n.data.trim().slice(0, 40));
  }
  const plates = [...v.querySelectorAll('.cr-side')].map((s) => { const o = s.querySelector('.cr-opt:not([hidden])'); return o ? o.dataset.airline : null; });
  return { search: location.search, hl: history.length, boxes, rows, axis, live, yenLeft, plates, sheet: document.getElementById('cr-sheet').open };
});
/* 1手のあとの比較が約束どおりか（[] ＝ 約束どおり） */
const pairBad = (s, a, b, h0, cur, calmed = false) => {
  const why = [], top = SCALE(a, b);
  if (s.search !== `?view=compare&a=${a}&b=${b}`) why.push(`住所 ${s.search}`);
  if (s.hl !== h0) why.push(`履歴の数 ${h0} → ${s.hl}`);
  if (s.sheet) why.push('選ぶ面が開いたまま');
  if (s.plates.join('|') !== `${a}|${b}`) why.push(`札 ${s.plates.join('|')}`);
  for (const x of s.boxes) {
    const want = [a, b].filter((k) => x.has.includes(k));
    if (/^年収の行/.test(x.kind) && !(x.shown && same(x.seen, [a, b]))) why.push(`${x.kind} 見えている ${x.seen.join(',') || 'なし'}`);
    else if (x.shown && !same(x.seen, want)) why.push(`${x.kind}#${x.i} 見えている ${x.seen.join(',') || 'なし'}（あるべき ${want.join(',') || 'なし'}）`);
    else if (!x.shown && want.length && /^cr-(taxes|rentbs|credits)$/.test(x.kind)) why.push(`${x.kind}#${x.i} 隠れている（持つ会社 ${want.join(',')}）`);
  }
  const rows = s.rows.map((r) => `${r.s}/${r.role}`).sort(), wantRows = [a, b].flatMap((k) => ROLES.map((r) => `${k}/${r}`)).sort();
  if (!same(rows, wantRows)) why.push(`見えている年収の行 ${rows.join(',')}`);
  for (const r of s.rows) {
    const m = SALARY[r.s] && SALARY[r.s][r.role] ? SALARY[r.s][r.role].avg : NaN;
    if (r.man !== m) why.push(`${r.s}/${r.role} 棒の額 ${r.man}（正本 ${m}）`);
    if (!(Math.abs(r.w - (m / top) * 100) < 0.01) || Math.abs(r.fill - (r.track * m) / top) > 1)
      why.push(`${r.s}/${r.role} 棒 ${r.w}%（あるべき ${((m / top) * 100).toFixed(2)}% ＝ ${m} ÷ ${top}）長さ ${Math.round(r.fill)}/${Math.round(r.track)}px`);
    if (calmed && Math.abs(r.drawn - r.fill) > 1) why.push(`${r.s}/${r.role} 動きが終わったあとの見た目の幅 ${Math.round(r.drawn)}px（長さ ${r.fill}px）`);
    if (cur === 'JPY' && r.text !== yen(m)) why.push(`${r.s}/${r.role} 額の字 ${r.text}（正本 ${yen(m)}）`);
  }
  if (!same(s.axis, [top])) why.push(`見えている目盛 ${s.axis.join(',')}（あるべき ${top}）`);
  for (const l of s.live) {
    if (l.for !== `${a}|${b}`) why.push(`欄 ${l.k} の2社 ${l.for}`);
    if (l.tags.length && !same(l.tags, [JA(a), JA(b)])) why.push(`欄 ${l.k} の社名の札 ${l.tags.join('・')}`);
  }
  if (cur !== 'JPY' && s.yenLeft.length) why.push(`${cur} なのに ¥・万 の字 ${s.yenLeft.slice(0, 3).join(' ／ ')}`);
  return why;
};

/* ── 場面の登録 ───────────────────────────────────────────── */
const SCENES = {};
const scene = (key, label, fn) => { SCENES[key] = { key, label, fn }; };

/* ══ ring ═══════════════════════════════════════════════════════ */
scene('ring', '112社を1回ずつ左と右に（選ぶ面で選び直していく）', async () => {
  const runs = [['sp', 390, 680, 'JPY'], ['pc', 1280, 800, 'JPY'], ['pc', 1280, 800, 'USD']];
  const n = ALLK.length;
  for (const [size, w, h, cur] of runs) {
    const t0 = Date.now();
    const o = await open(size, { url: `/career.html?view=compare&a=${ALLK[0]}&b=${ALLK[1]}` });
    const { page, st } = o;
    if (size === 'pc') await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await ready(page);
    if (cur !== 'JPY') await page.evaluate((c) => window.PVCurrency.set(c), cur);
    const h0 = await page.evaluate(() => history.length);
    let a = ALLK[0], b = ALLK[1];
    const age = { [a]: 0, [b]: 1 };
    const left = Object.fromEntries(ALLK.map((k) => [k, 0])), right = Object.fromEntries(ALLK.map((k) => [k, 0]));
    const bad = [], errs0 = st.errs.length;
    let steps = 0, nBad = 0;
    const look = async (label) => {
      const calm = await settled(page, `${a}|${b}`);
      await frames(page);
      const why = pairBad(await snap(page), a, b, h0, cur);
      if (!calm) why.push('生きた欄が2社のものとして読み終わらない');
      if (st.errs.length > errs0) why.push(`ページのエラー ${st.errs.slice(errs0).join(' ／ ')}`);
      if (why.length && bad.length < 8) bad.push(`${label}（${a}|${b}）: ${why.slice(0, 4).join(' ／ ')}`);
      if (why.length) nBad++;
      left[a]++; right[b]++;
    };
    await look('開いたところ');
    for (let lap = 0; lap < 2; lap++) {
      if (lap === 1) {
        await page.click('#cr-swap');
        await page.waitForFunction((a, b) => [...document.querySelectorAll('#cr .cr-view[data-view="compare"] .cr-side')]
          .map((s) => (s.querySelector('.cr-opt:not([hidden])') || {}).dataset).map((d) => d && d.airline).join('|') === `${b}|${a}`, {}, a, b);
        [a, b] = [b, a];
        steps++;
        await look('入れ替え');
      }
      for (let i = 1; i <= n; i++) {
        const next = ALLK[(i + 1) % n];
        const side = age[a] < age[b] ? 'a' : 'b';
        await H.choose(page, side, next);
        age[next] = lap * n + i + 1;
        if (side === 'a') a = next; else b = next;
        steps++;
        await look(`${lap + 1}周目 ${i}手目 ${side === 'a' ? '左' : '右'}に ${next}`);
      }
    }
    await page.evaluate(() => Promise.all(document.getAnimations().map((x) => x.finished.catch(() => 0))));
    await frames(page);
    const end = pairBad(await snap(page), a, b, h0, cur, true);
    ok(!end.length, `ring ${w}×${h} ${cur}：最後の手（${a}｜${b}）で出る動きが終わったあと、棒の見た目の幅 ＝ 長さ（額 ÷ ${yen(SCALE(a, b))}）`, end.join(' ／ '), 'local');
    const once = ALLK.filter((k) => !(left[k] >= 1 && right[k] >= 1));
    const secs = Math.round((Date.now() - t0) / 1000);
    ok(!nBad && once.length === 0,
      `ring ${w}×${h} ${cur}：${steps}手（選び直し ${2 * n}・入れ替え 1）のどの手でも、住所・履歴・札・会社ごとの並び・生きた欄・棒と目盛が並べた2社のもの${cur === 'JPY' ? '・行の額は正本の字' : '・見えている字に ¥ も 万 も無い'}・どの会社も左と右に1回以上（${secs}秒）`,
      `外れた手 ${nBad}：${bad.join('\n      ')}${once.length ? `\n      左右の片方にしか立たない ${once.slice(0, 8).join(',')}` : ''}`);
    console.log(`  ・${w}×${h} ${cur}：${steps}手・${secs}秒・左に立った回数の最小 ${Math.min(...Object.values(left))}・右 ${Math.min(...Object.values(right))}`);
    await shot(page, `ring-${w}-${cur}`);
    await o.close();
  }
});

/* ══ find ═══════════════════════════════════════════════════════ */
/* 検索の言葉：一覧の正本 model() の7社ごとの1社（16社）の、日本語名・英語名・略号・国名（日・英）＋ 決めた11語 */
const DM = dirModel();
const PICK16 = DM.slugs.filter((s, i) => i % 7 === 0);
const FIXED = ['ana', 'UA', 'ドイツ', 'Germany', 'ｴﾐﾚｰﾂ', 'ぴーち', 'ＡＮＡ', 'ana ', 'エール フランス', 'airfrance', 'zzzz'];
const QUERIES = [...new Set([...PICK16.flatMap((s) => { const A = DM.airlines[s]; return [A.ja, A.en, ...A.codes, A.country.ja, A.country.en]; }), ...FIXED])].filter((q) => q !== '');
const NONE_SENT = '該当する航空会社が見つかりませんでした';

scene('find', '選ぶ面の検索は航空会社一覧と同じ会社を同じ順に出す・キーボードと指', async () => {
  /* 一覧の側（dirOpen ── 地域は「すべて」） */
  const L = { base: env.url };
  const P = await dirOpen(browser, L, { rel: 'world-airlines.html', w: 1440, h: 900 });
  const typeAll = (page, field, list, qs) => page.evaluate((field, list, qs, none) => {
    const el = document.querySelector(field), out = [];
    const slugOf = (e) => (e.dataset.airline || e.getAttribute('href') || '').replace(/^airlines\//, () => '').replace(/\.html$/, () => '');
    for (const q of qs) {
      el.value = q;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const seen = [...document.querySelectorAll(list)].filter((e) => e.getClientRects().length > 0 && !(e.closest('li') && e.closest('li').hidden)).map(slugOf);
      const msg = [...document.querySelectorAll('#no-results, #cr-sheet-0')].filter((e) => e.getClientRects().length > 0 && !e.hidden).map((e) => e.textContent.replace(/\s+/g, () => ' ').trim());
      out.push({ q, seen, none: msg.some((m) => m.includes(none)) });
    }
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return out;
  }, field, list, qs, NONE_SENT);
  const dir = await typeAll(P.page, '#search', '#airline-grid a[href^="airlines/"]', QUERIES);
  const q0 = quiet(P.st, 'find（一覧）');
  ok(q0.length === 0 && P.st.errs.length === 0, `一覧のページは、打っているあいだサーバーの口を1本も呼ばず、外へも出ない（quiet が空・エラー 0）`, J({ q0, errs: P.st.errs }), 'local');
  await P.ctx.close();

  for (const [size, w, h] of [['pc', 1280, 800], ['sp', 390, 680]]) {
    const o = await open(size, { url: '/career.html?view=compare&a=jal&b=ana' });
    const { page } = o;
    if (size === 'pc') await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await ready(page);
    await page.click('#cr-open-a');
    await page.waitForSelector('#cr-sheet[open]');
    const got = await typeAll(page, '#cr-sheet-q', '#cr-sheet-l .cr-pk', QUERIES);
    const diff = got.map((g, i) => ({ q: g.q, s: g.seen, d: dir[i].seen, n: [g.none, dir[i].none] }))
      .filter((x) => !same(x.s, x.d) || x.n[0] !== x.n[1] || (x.q === 'zzzz' && !(x.n[0] && x.n[1] && !x.s.length)));
    const hits = got.reduce((t, g) => t + g.seen.length, 0);
    ok(!diff.length && got.length === QUERIES.length && hits > 0,
      `${w}×${h}：${QUERIES.length}語（16社 ${PICK16.join('・')} の名前・略号・国名 ＋ 決めた11語）のどれでも、選ぶ面に見えている会社 ＝ 航空会社一覧に見えているカード（同じ順）・zzzz は両方とも「${NONE_SENT}」だけ（当たりの合計 ${hits}）`,
      diff.slice(0, 5).map((x) => `「${x.q}」 面 ${x.s.join(',') || '0'} ／ 一覧 ${x.d.join(',') || '0'} ／ 1文 ${x.n.join('・')}`).join('\n      '), 'local');
    if (size === 'pc') await shot(page, `find-${w}-sheet`);
    await page.keyboard.press('Escape');
    await o.close();
  }

  /* キーボード（1280・指でない端末） */
  {
    const o = await open('pc', { url: '/career.html?view=compare&a=jal&b=ana' });
    const { page } = o;
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await ready(page);
    const h0 = await page.evaluate(() => history.length);
    const act = () => page.evaluate(() => { const e = document.activeElement; return e ? (e.id || (e.dataset && e.dataset.airline) || e.tagName) : null; });
    const firstHit = () => page.evaluate(() => { const e = [...document.querySelectorAll('#cr-sheet-l .cr-pk')].find((x) => x.getClientRects().length && !x.disabled && !x.closest('li').hidden); return e ? e.dataset.airline : null; });
    await page.click('#cr-open-a');
    await page.waitForSelector('#cr-sheet[open]');
    const f0 = await act();
    await page.keyboard.type('qr');
    const first = await firstHit();
    await page.keyboard.press('ArrowDown');
    const f1 = await act();
    await page.keyboard.press('ArrowUp');
    const f2 = await act();
    ok(f0 === 'cr-sheet-q' && !!first && f1 === first && f2 === 'cr-sheet-q',
      `キーボード：開くと検索欄 → 「qr」→ ↓ で最初の会社（${first}）→ ↑ で欄へ戻る`, J({ f0, first, f1, f2 }), 'local');
    await page.keyboard.press('Enter');
    const picked = await page.waitForFunction((s) => !document.getElementById('cr-sheet').open && location.search === `?view=compare&a=${s}&b=ana`, { timeout: 8000 }, first).then(() => true, () => false);
    const h1 = await page.evaluate(() => history.length);
    ok(picked && h1 === h0, `Enter で最初の当たり（${first}）を選ぶ → 面が閉じ、住所が ?view=compare&a=${first}&b=ana・履歴は増えない（${h0} → ${h1}）`,
      J({ picked, search: await page.evaluate(() => location.search) }), 'local');
    await page.click('#cr-open-a');
    await page.waitForSelector('#cr-sheet[open]');
    await page.keyboard.press('Escape');
    const esc = await page.waitForFunction(() => !document.getElementById('cr-sheet').open && document.activeElement === document.getElementById('cr-open-a'), { timeout: 8000 }).then(() => true, () => false);
    ok(esc, 'Esc（欄が空のとき）で面が閉じ、焦点は1社目の札のボタン（#cr-open-a）', J({ act: await act() }), 'local');
    /* Tab で面の外へ出ない（面の中の押せるもの ＋ 3回） */
    await page.click('#cr-open-a');
    await page.waitForSelector('#cr-sheet[open]');
    const nFocus = await page.evaluate(() => document.getElementById('cr-sheet').querySelectorAll('button:not([disabled]), input').length);
    const out = [], gaps = [];
    let prevGap = false;
    for (let i = 0; i < nFocus + 3; i++) {
      await page.keyboard.press('Tab');
      const at = await page.evaluate(() => { const s = document.getElementById('cr-sheet'), e = document.activeElement;
        return !e || e === document.body || e === document.documentElement ? 'none' : s.contains(e) ? 'in' : (e.id || e.className || e.tagName); });
      if (at === 'none') { if (prevGap) out.push(`${i + 1}回目 2回続けてページの外`); gaps.push(i + 1); prevGap = true; continue; }
      prevGap = false;
      if (at !== 'in') out.push(`${i + 1}回目 後ろのページの ${at}`);
    }
    ok(nFocus > 100 && !out.length && gaps.length <= 1,
      `開いているあいだ、Tab を ${nFocus + 3}回押しても、焦点は後ろのページの要素へ行かない（押せるもの ${nFocus}・ブラウザ自身の止まり所をはさんで面の頭へ戻った回 ${gaps.length}：${gaps.join(',') || 'なし'}回目）`,
      out.slice(0, 4).join(' ／ '), 'local');
    /* 欄に字が在るときの Esc（記録だけ ── Chrome は1回目で欄の字を消し、2回目で閉じる） */
    await page.focus('#cr-sheet-q');
    await page.keyboard.type('qr');
    await page.keyboard.press('Escape');
    const e1 = await page.evaluate(() => ({ open: document.getElementById('cr-sheet').open, q: document.getElementById('cr-sheet-q').value }));
    console.log(`  ・欄に「qr」が在るときの Esc 1回目：面 ${e1.open ? '開いたまま' : '閉じた'}・欄 「${e1.q}」（記録だけ）`);
    if (e1.open) await page.keyboard.press('Escape');
    await o.close();
  }

  /* 指（390・pointer: coarse） */
  {
    const o = await open('sp', { url: '/career.html?view=compare&a=jal&b=ana' });
    const { page } = o;
    await ready(page);
    const coarse = await page.evaluate(() => matchMedia('(pointer:coarse)').matches);
    await page.evaluate(() => { const b = document.getElementById('cr-open-b'); window.scrollTo(0, Math.max(0, Math.round(window.scrollY + b.getBoundingClientRect().top - 160))); });
    await frames(page);
    const y0 = await page.evaluate(() => window.scrollY);
    const box = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
    const b0 = await box('#cr-open-b');
    await page.touchscreen.tap(b0.x + b0.w / 2, b0.y + b0.h / 2);
    const opened = await page.waitForSelector('#cr-sheet[open]', { timeout: 8000 }).then(() => true, () => false);
    const fq = await page.evaluate(() => document.activeElement === document.getElementById('cr-sheet-q'));
    const tall = await page.evaluate(() => [...document.querySelectorAll('#cr-sheet-l .cr-pk')].map((e) => [e.dataset.airline, e.getBoundingClientRect().height]).filter(([, hh]) => !(hh >= 44)));
    ok(coarse && opened && !fq && !tall.length, `指（pointer: coarse ${coarse}）：札を押すと面が開き、検索欄に焦点を置かない・どの会社の行も 44px 以上`, J({ opened, fq, tall: tall.slice(0, 4) }), 'local');
    const drag = async (x, y, dy) => {
      await page.touchscreen.touchStart(x, y);
      for (let k = 1; k <= 6; k++) await page.touchscreen.touchMove(x, y + (dy * k) / 6);
      await page.touchscreen.touchEnd();
      await frames(page);
    };
    const sh = await box('#cr-sheet'), top = await box('.cr-sheet-top');
    const ys = [];
    await drag(top.x + top.w / 2, top.y + top.h / 2, 160); ys.push(['見出しの帯', await page.evaluate(() => window.scrollY)]);
    await drag(sh.x + sh.w / 2, Math.max(4, sh.y / 2), 200); ys.push(['地', await page.evaluate(() => window.scrollY)]);
    await page.evaluate(() => { const q = document.getElementById('cr-sheet-q'); q.value = 'qr'; q.dispatchEvent(new Event('input', { bubbles: true })); });
    const pk = await box('#cr-sheet-l .cr-pk:not([disabled])');
    await drag(pk.x + pk.w / 2, pk.y + pk.h / 2, -220); ys.push(['短くした一覧', await page.evaluate(() => window.scrollY)]);
    const still = await page.evaluate(() => document.getElementById('cr-sheet').open);
    ok(still && ys.every(([, y]) => y === y0), `後ろのページは動かない：開く前 ${y0} ／ ${ys.map(([k, y]) => `${k}を引いたあと ${y}`).join(' ／ ')}（面は開いたまま）`, J({ still, ys }), 'local');
    const fld = await box('#cr-sheet-q'), sh2 = await box('#cr-sheet');
    await page.mouse.move(fld.x + fld.w / 2, fld.y + fld.h / 2);
    await page.mouse.down();
    await page.mouse.move(fld.x + fld.w / 2, sh2.y - 20, { steps: 4 });
    await page.mouse.up();
    await frames(page);
    const k1 = await page.evaluate(() => document.getElementById('cr-sheet').open);
    await page.mouse.click(sh2.x + 3, fld.y + fld.h / 2);
    await frames(page);
    const k2 = await page.evaluate(() => document.getElementById('cr-sheet').open);
    await page.mouse.click(sh2.x + sh2.w / 2, sh2.y - 20);
    const shut = await page.waitForFunction(() => !document.getElementById('cr-sheet').open, { timeout: 8000 }).then(() => true, () => false);
    await frames(page);
    const y9 = await page.evaluate(() => window.scrollY);
    ok(k1 && k2 && shut && y9 === y0, `欄で押して面の外 20px で離しても閉じない（${k1 ? '開いたまま' : '閉じた'}）・欄の横の余白を押しても閉じない（${k2 ? '開いたまま' : '閉じた'}）・地を押すと閉じる（${shut ? '閉じた' : '開いたまま'}）・閉じたあとも位置は ${y9}（開く前 ${y0}）`,
      J({ k1, k2, shut, y0, y9, sheet: sh2, field: fld }), 'local');
    await o.close();
  }
});

/* ══ card ═══════════════════════════════════════════════════════ */
/* 書き留め役（assert-cmp-frame.mjs の RECORDER と同じ文 ── 直すときは3つを同じに直す：あちら・assert-career.mjs の T-C3・ここ） */
const RECORDER = () => {
  const P = CanvasRenderingContext2D.prototype, D = window.__drawn = { text: [], img: [] };
  const fT = P.fillText, sT = P.strokeText, dI = P.drawImage;
  P.fillText = function (s) { D.text.push(String(s)); return fT.apply(this, arguments); };
  P.strokeText = function (s) { D.text.push(String(s)); return sT.apply(this, arguments); };
  P.drawImage = function (src) {
    D.img.push(typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement ? '(canvas)' : String((src && (src.currentSrc || src.src)) || ''));
    return dI.apply(this, arguments);
  };
};
const CC = read('career-card.js');
const WBLK = (CC.match(/\n {2}var WORD = \{([\s\S]*?)\n {2}\};/) || [])[1] || '';
const WORDS = [...WBLK.matchAll(/:\s*'([^']*)'/g)].map((x) => x[1]);
const PHOTO_WORD = (WBLK.match(/\bphoto: '([^']*)'/) || [])[1] || '';
const cardModel = (page) => page.evaluate(() => (window.PVCareerCard && window.PVCareerCard.model ? window.PVCareerCard.model() : null));
/* 描いた字が公開の一覧（WORD・材料の公開の字・住所の切れ端・写真のクレジット）に在るか（assert-career.mjs の T-C3 と同じ決め方） */
const drawnBad = (text, img, m, pics) => {
  const plain = new Set(WORDS), addr = [], cred = [], bad = [];
  for (const c of (m && m.cards) || []) {
    [c.ja, c.en, c.code].forEach((v) => plain.add(v));
    for (const r of Object.values(c.roles || {})) {
      [r.text, r.tag, r.sub].forEach((v) => plain.add(v));
      if (r.lim) [r.lim.text, r.lim.tag, r.lim.sub].forEach((v) => plain.add(v));
    }
    (c.axis || []).forEach((v) => plain.add(v));
    if (c.rating) { plain.add(c.rating.avg); plain.add(c.rating.text); }
    addr.push(String(c.url).replace(/^https?:\/\//, () => ''));
    if (c.photo && c.photo.credit) cred.push(`${PHOTO_WORD} ${c.photo.credit}`);
  }
  for (const t of text) if (!plain.has(t) && !(t && [...addr, ...cred].some((x) => x.includes(t)))) bad.push(`字「${t}」`);
  for (const u of img) if (!pics.includes(u)) bad.push(`絵 ${u}`);
  return bad;
};
/* カードの材料がその会社の並びで描かれ、評価の読みも落ち着いた（描き直しまで） */
const cardIs = async (page, slugs) => {
  const up = await page.waitForFunction((want) => {
    const m = window.PVCareerCard && window.PVCareerCard.model && window.PVCareerCard.model();
    const r = document.getElementById('crc-root');
    return !!(m && m.cards && m.cards.map((c) => c.slug).join('|') === want && m.layout && r && r.getAttribute('data-drawn'));
  }, { timeout: 15000, polling: 50 }, slugs.join('|')).then(() => true, () => false);
  await page.evaluate(async (slugs) => {
    const pv = window.PVCareer;
    if (pv && typeof pv.rating === 'function') await Promise.all(slugs.map((s) => Promise.resolve(pv.rating(s)).then(() => 0, () => 0)));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, slugs);
  return up;
};
/* デザインのボタンを押して、描き直しを待つ（描いた字を数え直すため、押す前に書き留めを空にする） */
const designTo = async (page, word) => {
  const was = await page.evaluate(() => { window.__drawn.text = []; window.__drawn.img = []; return document.getElementById('crc-root').getAttribute('data-drawn'); });
  const hit = await page.evaluate((w) => {
    const b = [...document.querySelectorAll('#crc-root button')].find((x) => x.textContent.trim() === w);
    if (!b) return false;
    b.click();
    return true;
  }, word);
  const moved = !!hit && await page.waitForFunction((was) => document.getElementById('crc-root').getAttribute('data-drawn') !== was, { timeout: 8000 }, was).then(() => true, () => false);
  await frames(page);
  return moved;
};
/* 比較の画面に見えている、会社ごとの額の字（いまの通貨）と、その右端の目盛の3つの字 */
const pageFigs = (page, top) => page.evaluate((top) => {
  const v = document.querySelector('#cr .cr-view[data-view="compare"]'), out = {};
  for (const r of v.querySelectorAll('.cr-pair .cr-row')) {
    if (!r.getClientRects().length) continue;
    (out[r.dataset.airline] = out[r.dataset.airline] || {})[r.closest('.cr-pair').dataset.role] = ((r.querySelector('.cr-row-v') || {}).textContent || '').trim();
  }
  const ax = v.querySelector(`.cr-panel .cr-axis[data-scale="${top}"]`);
  return { figs: out, axis: ax ? [...ax.children].map((c) => c.textContent.trim()) : null };
}, top);

scene('card', 'どの会社のカードも、比較の画面と同じ額・2社で1本の目盛・住所と QR・描くのは公開の字だけ', async () => {
  const CASES = [['united'], ['eagle-jet'], ['swiss'], ['united', 'delta'], ['jal', 'united'], ['emirates', 'jal'], ['swiss', 'eagle-jet']];
  for (const cur of ['JPY', 'USD']) {
    for (const c of CASES) {
      const [a, b] = c, partner = b || (a === 'jal' ? 'ana' : 'jal');
      const o = await open('pc', { url: `/career.html?view=compare&a=${a}&b=${partner}`, before: `(${RECORDER})();` });
      const { page } = o;
      await ready(page);
      if (cur !== 'JPY') await page.evaluate((x) => window.PVCurrency.set(x), cur);
      await settled(page, `${a}|${partner}`);
      const top = SCALE(...c);
      const pf = await pageFigs(page, top);
      await page.evaluate(() => { window.__drawn.text = []; window.__drawn.img = []; });
      await page.evaluate((st) => window.PVCareer.go(st), { view: 'card', a, b: b || null });
      const up = await cardIs(page, c);
      const pics = await page.evaluate(() => {
        const out = new Set(['(canvas)']);
        try { for (const x of Object.values(JSON.parse(document.getElementById('crc-data').textContent).airlines || {})) for (const p of x.photos || []) out.add(new URL(p.src, location.href).href); } catch (e) { /* 写真は0枚 */ }
        return [...out];
      });
      const why = [];
      if (!up) why.push('カードが描かれない');
      for (const word of ['黒×金', 'カラフル']) {
        if (!up) break;
        if (!(await designTo(page, word))) { why.push(`${word} に描き直されない`); continue; }
        const m = await cardModel(page);
        const d = await page.evaluate(() => ({ text: window.__drawn.text.slice(), img: window.__drawn.img.slice() }));
        if (!m || !m.cards || m.cards.length !== c.length) { why.push(`${word}: 材料の枚数 ${m && m.cards && m.cards.length}`); continue; }
        for (const k of m.cards) {
          for (const r of ROLES) {
            const want = (pf.figs[k.slug] || {})[r];
            if (!k.roles[r] || k.roles[r].text !== want) why.push(`${word} ${k.slug}/${r} カード「${k.roles[r] && k.roles[r].text}」画面「${want}」`);
            if (!k.roles[r] || !(Math.abs(k.roles[r].w - SALARY[k.slug][r].avg / top) < 0.001)) why.push(`${word} ${k.slug}/${r} 棒 ${k.roles[r] && k.roles[r].w}（あるべき ${SALARY[k.slug][r].avg} ÷ ${top}）`);
          }
          if (!same(k.axis, pf.axis)) why.push(`${word} ${k.slug} の目盛 ${J(k.axis)}（画面の右端 ${top} の目盛 ${J(pf.axis)}）`);
          if (k.url !== `https://pilot-value.com/airlines/${k.slug}.html` || !Array.isArray(k.qr) || !k.qr.length) why.push(`${word} ${k.slug} 住所 ${k.url}・QR ${Array.isArray(k.qr) ? k.qr.length : '無し'}`);
        }
        if (m.cards.length === 2 && !same(m.cards[0].axis, m.cards[1].axis)) why.push(`${word} 2枚の目盛が違う ${J(m.cards.map((k) => k.axis))}`);
        const bad = drawnBad(d.text, d.img, m, pics);
        if (!d.text.length || bad.length) why.push(`${word} 描いた字 ${d.text.length}本・公開の一覧に無い ${bad.slice(0, 4).join(' ／ ')}`);
      }
      ok(!why.length, `${cur} ${c.join('｜')}：2つのデザインとも、職位の字 ＝ 比較の画面の額・棒 ＝ 額 ÷ ${yen(top)}・目盛の字 ＝ 画面の同じ右端の字${c.length === 2 ? '（2枚で同じ）' : ''}・住所と QR・描いた字は公開の一覧だけ`,
        why.slice(0, 6).join('\n      '), 'local');
      if (cur === 'JPY') await shot(page, `card-${c.join('-')}`);
      await o.close();
    }
  }

  /* 植えた印：JAL｜ユナイテッドを会員 c の画面で、生きた欄が「開いた」答え（印入り）で埋まってからカードを描く */
  const ZZ = { body: (s) => `ZZ本文-${s}-ZZ`, sum: (s) => `ZZ要約-${s}-ZZ` };
  const LEAK_PAY = { jal: [383800, 352000], united: [591400, 522000] }, LEAK_MED = 528000;
  const coOf = (p) => (p && Array.isArray(p.airlines) ? p.airlines[0] : (p && p.airline) || '');
  const SC = ['culture_score', 'salary_score', 'benefits_score', 'wlb_score', 'ops_score', 'training_score'];
  const rated = (id, v, extra) => ({ id, airline: 'x', created_at: '2026-09-01T00:00:00Z', cats: ['salary'], ...Object.fromEntries(SC.map((k) => [k, v])), ...extra });
  const stub = {
    pv_reviews: (p) => { const s = coOf(p); return { status: 200, body: { ok: true, unlocked: true, rows: [rated(s + '1', 4, { salary_comment: `検査の口コミ ${ZZ.body(s)}` }), rated(s + '2', 3, { wlb_comment: `検査の口コミその二 ${ZZ.body(s)}` })] } }; },
    pv_review_summary: (p) => ({ status: 200, body: { ok: true, state: 'open', n: 3, as_of: '2026-10-01',
      good: [{ text: `検査の良い点 ${ZZ.sum(coOf(p))}`, cat: 'training' }], concern: [{ text: `検査の気になる点 ${ZZ.sum(coOf(p))}`, cat: 'wlb' }] } }),
    pv_pay_rows: () => ({ status: 200, body: H.payFix.open(['jal', 'united'].flatMap((s) => [H.payRowFix(s, { annual_usd: LEAK_PAY[s][0] }), H.payRowFix(s, { pos: 'fo', annual_usd: LEAK_PAY[s][1] })]), []) }),
    pv_company_pay: (p) => ({ status: 200, body: { ok: true, state: 'open', period: { from: '2024-10', to: '2026-09' }, floor: 3,
      airlines: Object.fromEntries(((p && p.airlines) || []).map((s) => [s, { cap: { s: 'ok', median_usd: LEAK_MED }, fo: { s: 'few' } }])) } }),
  };
  {
    const o = await open('pc', { who: 'c', url: '/career.html?view=compare&a=jal&b=united', stub, before: `(${RECORDER})();` });
    const { page } = o;
    await ready(page);
    await settled(page, 'jal|united');
    const seenOn = await page.evaluate(() => {
      const v = document.querySelector('#cr .cr-view[data-view="compare"]'), t = v.innerText || '';
      const vis = (e) => e.getClientRects().length > 0;
      return { zz: (t.match(/ZZ[^\s]*?ZZ/g) || []), amt: [...v.querySelectorAll('.crl[data-live="cmp-pay"] .crl-amt')].filter(vis).map((e) => e.textContent.trim()) };
    });
    const pre = seenOn.zz.length > 0 && seenOn.amt.length > 0;
    ok(pre, pre ? `（前提）会員 c の比較 JAL｜ユナイテッドに、植えた印 ${[...new Set(seenOn.zz)].length}種（${[...new Set(seenOn.zz)].join('・')}）と提出された年収の額 ${seenOn.amt.length}つ（${seenOn.amt.join(' ')}）が出た`
      : '（前提）この場面は落ちることができない（植えた印か提出された年収の額が、比較の画面に出ていない）', J(seenOn));
    if (pre) {
      await page.evaluate(() => { window.__drawn.text = []; window.__drawn.img = []; });
      await page.evaluate((st) => window.PVCareer.go(st), { view: 'card', a: 'jal', b: 'united' });
      const up = await cardIs(page, ['jal', 'united']);
      const models = [], texts = [];
      for (const word of ['黒×金', 'カラフル']) {
        if (up && await designTo(page, word)) { models.push(J(await cardModel(page))); texts.push(...await page.evaluate(() => window.__drawn.text.slice())); }
      }
      const amts = [...new Set(seenOn.amt)];
      const leak = (s) => /ZZ/.test(s) || amts.some((x) => s.includes(x)) || /検査の(口コミ|良い点|気になる点)/.test(s);
      ok(up && models.length === 2 && texts.length > 0 && !texts.some(leak) && !models.some(leak),
        `JAL｜ユナイテッドのカード（2つのデザイン）の描いた字 ${texts.length}本にも材料にも、植えた印・提出された年収の額・口コミと要約の字が1つも無い`,
        J({ up, models: models.length, hit: texts.filter(leak).slice(0, 4), inModel: models.some(leak) }));
    }
    await o.close();
  }
});

/* ══ back ═══════════════════════════════════════════════════════ */
scene('back', '比較 → 右の会社の「詳しく」→ 会社ページ → 戻る（同じ2社・同じ順・同じ位置）', async () => {
  for (const [a, b] of [['united', 'delta'], ['emirates', 'jal']]) {
    const Q = `?view=compare&a=${a}&b=${b}`;
    const o = await open('sp', { url: `/career.html${Q}` });
    const { page } = o;
    await ready(page);
    const calm = async () => {
      const done = await settled(page, `${a}|${b}`, 20000);
      await page.evaluate(async () => {
        const v = document.querySelector('#cr .cr-view:not([hidden])');
        if (v) await Promise.all(v.getAnimations().map((x) => x.finished.catch(() => {})));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      return done;
    };
    const feet = await page.evaluate((b) => [...document.querySelectorAll(`#cr .cr-view[data-view="compare"] .cr-go[data-airline="${b}"]`)]
      .filter((e) => e.getClientRects().length).map((e, i) => ({ i, href: e.getAttribute('href') })), b);
    ok(feet.length >= 1 && feet.every((f) => f.href.startsWith(`airlines/${b}.html`)), `${a}｜${b}：右の会社（${b}）の「詳しく」の足 ${feet.length}本 ── 行き先はどれも airlines/${b}.html`, J(feet), 'local');
    for (const f of feet) {
      const calm0 = await calm();
      const sel = `#cr .cr-view[data-view="compare"] .cr-go[data-airline="${b}"]`;
      await page.evaluate((sel, i) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)[i].scrollIntoView({ block: 'center' }), sel, f.i);
      await frames(page);
      const y0 = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => { window.__left = 1; });
      const hash = f.href.includes('#') ? f.href.slice(f.href.indexOf('#')) : '';
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }),
        page.evaluate((sel, i) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)[i].click(), sel, f.i)]);
      const tab = hash.slice(1);
      const tabbed = !!tab && await page.waitForFunction((t) => !!window.PVGlance && window.PVGlance.at() === t, { timeout: 15000 }, tab).then(() => true, () => false);
      const at = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, glance: !!window.PVGlance, tab: window.PVGlance ? window.PVGlance.at() : null }));
      await page.goBack({ waitUntil: 'load', timeout: 45000 });
      await ready(page);
      const back = await page.waitForFunction((q) => location.search === q, { timeout: 8000 }, Q).then(() => true, () => false);
      const how = await page.evaluate(() => (window.__left === 1 ? '手元から戻った' : '読み込み直した'));
      const calm1 = await calm();
      const y1 = await page.evaluate(() => window.scrollY);
      const s = await snap(page);
      ok(calm0 && calm1 && at.path === `/airlines/${b}.html` && at.hash === hash && (!tab || !at.glance || tabbed) && back && how === '読み込み直した'
        && same(s.plates, [a, b]) && Math.abs(y1 - y0) <= 1,
        `${a}｜${b}：足 ${f.i + 1}（${f.href}）→ ${at.path}${at.hash}${at.glance ? `（タブ ${at.tab}）` : ''} → 戻る（${how}ページ）→ 同じ住所・札は ${s.plates.join('｜')}・位置は出る前 ${y0} → ${y1}（ずれ ${y1 - y0}px ≤ 1）`,
        J({ calm0, calm1, at, tabbed, back, how, plates: s.plates, y0, y1 }));
    }
    await shot(page, `back-${a}-${b}`);
    await o.close();
  }
});

/* ── 実行 ───────────────────────────────────────────────────── */
const want = WANT || Object.keys(SCENES);
const unknownScene = want.filter((k) => !SCENES[k]);
if (unknownScene.length) { console.error(`知らない場面: ${unknownScene.join(', ')}（あるのは ${Object.keys(SCENES).join(', ')}）`); process.exit(2); }
const T0 = Date.now();
try {
  env = await H.startLocal();
  if (['3000', '3100'].includes(new URL(env.url).port)) throw new Error('3000 番・3100 番では流さない');
  browser = await H.launch();
  console.log(`手元の使い捨ての保存先 ${env.url}（3000 番でも本番でもない）・生きた欄の返事はこの検査が作る（MOCK）`);
  for (const k of want) {
    const S = SCENES[k], t0 = Date.now(), n0 = PAGES.length, f0 = fail;
    head(`${k}：${S.label}`);
    try { await S.fn(); }
    catch (e) { ok(false, `${k}：場面が最後まで歩けない`, String(e && e.stack || e).split('\n').slice(0, 3).join(' ／ ')); }
    netCheck(k, PAGES.slice(n0));
    const errs = PAGES.slice(n0).flatMap((o) => o.st.errs);
    ok(!errs.length, `${k}：ページのエラー 0`, errs.slice(0, 4).join(' ／ '));
    for (const o of PAGES.slice(n0)) await o.close();
    console.log(`  （${k}：${Math.round((Date.now() - t0) / 1000)}秒${fail > f0 ? `・✗ ${fail - f0}` : ''}）`);
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  if (env) await env.stop().catch(() => {});
}
console.log(`\n══ ${pass} pass / ${fail} fail ══（${Math.round((Date.now() - T0) / 1000)}秒）`);
process.exit(fail ? 1 : 0);
