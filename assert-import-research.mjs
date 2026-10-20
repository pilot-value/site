/* ══════════════════════════════════════════════════════════════════════
   assert-import-research.mjs ── 調査パックの取り込み（import-research-pack.mjs）の約束

   作り物のパックだけで流す（test_only: true。URL は .invalid ＝ どこにも届かない名前）。
   本物の台帳は読むだけ。書くのは、使い捨てのフォルダに写した台帳の上だけ（終わったら消す）。
   決まりの検査（validate_pack.py）はリポジトリの外に在るので、ここでは同じ形の答えを返す小さな身代わりを使う。

   守っていること（どれも、壊すと赤くなることを確かめてある）
     A1 apply が書くのは取り込みの台帳（research-ledger.mjs）だけ ── salary-data.mjs・ほかの台帳・db/ は1バイトも変わらない
     A2 検査のエラーが在るパックは1件も入らない（check は止まる・apply は断る）
     A3 空・null は消す指示ではない（次の版に無い記録・値の無い記録で、入れた行は消えない）
     A4 引用と URL の無い記録は入らない（承認されても）
     A5 2回流しても同じ（2回目は「✓ 変更なし」・台帳は1バイトも違わない）
     A6 オーナーの決まり：入れてよいのは「追加」「既存と一致」で、保留でなく、給与の差が 25% 以内のものだけ
     A7 7つの分類（上が勝つ ── 2つに当たる記録は、どの境目でも表の上の分類になる）・新しい会社・1.1.0 のパック・壊れたパック
     A8 出し直し（版が上がる）：同じ ID で中身が変わったら競合・前の値は HISTORY に残る
     A9 暮らしは街ごとに1つ（同じ街の会社が何社あっても、街は1つ・同じ行は1つ）── 家賃は部屋の型ごとに見る（1部屋ずつの記録と
        まとめた記録）・地区の字の違い（「英: …」・大文字・アクセント）では分けない・1つの資料の同じ額を2つの街に入れない・
        同じ資料の同じ地区・同じ部屋で額が違えば競合（決まりでは入れない・承認されても入れない）
     A10 test_only のパックはリポジトリへは入らない／plan はリポジトリの中へ書かない／古くなった plan・手で直した plan は断る
     A11 間取りの呼び名の意味（P12.73）：台帳の字が、出どころの言い方の意味と合っている（台北の「1房」を 2-Bed と出せば赤）
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, 'import-research-pack.mjs');
const I = await import(pathToFileURL(TOOL).href);

let pass = 0, failN = 0;
const ok = (c, msg, detail = '') => { if (c) { pass++; } else { failN++; console.log(`❌ ${msg}${detail ? `\n     ${String(detail).slice(0, 600)}` : ''}`); } };
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-import-test-'));
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function tree(dir, base = dir, out = {}) {
  for (const b of fs.readdirSync(dir)) {
    const p = path.join(dir, b);
    if (fs.statSync(p).isDirectory()) tree(p, base, out); else out[path.relative(base, p)] = sha(p);
  }
  return out;
}
/** 本物の台帳を写した使い捨ての root（db/ も置いて、書かれないことを見る）。 */
function scratchRoot(name) {
  const r = path.join(T, name);
  fs.mkdirSync(path.join(r, 'db'), { recursive: true });
  for (const f of I.LEDGER_FILES) fs.copyFileSync(path.join(HERE, f), path.join(r, f));
  fs.writeFileSync(path.join(r, 'db', 'stays.sql'), '-- 写し（書かれないことを見るためだけに置く）\n');
  return r;
}

try {
  /* ── 身代わりの検査と、作り物の決まり ── */
  const STUB = path.join(T, 'stub_validate.py');
  fs.writeFileSync(STUB, [
    'import json, sys',
    'a = [x for x in sys.argv[1:]]',
    'if "--today" in a: i = a.index("--today"); del a[i:i + 2]',
    'f = [x for x in a if not x.startswith("--")][-1]',
    'p = json.load(open(f, encoding="utf-8"))',
    'errs = []',
    'if "label_en" in json.dumps(p): errs.append({"path": "（パック全体）", "message": "知らない欄 label_en"})',
    'if "STUB-PACK-ERROR" in (p.get("notes_ja") or ""): errs.append({"path": "records[0]", "message": "作り物のエラー"})',
    'for i, r in enumerate(p.get("records", [])):',
    '    if "STUB-REC-ERROR" in (r.get("label_ja") or ""): errs.append({"path": "records[%d]" % i, "message": "作り物の記録のエラー"})',
    'stage = "shape" if any(e["message"].startswith("知らない欄") for e in errs) else "content"',
    'print(json.dumps({"validator_version": "stub", "contract_version": "1.1.1", "baseline_id": None, "results": [{"file": f, "pack_id": p.get("pack_id"), "readable": True, "stage": stage, "counts": {}, "ok": not errs, "errors": errs, "warnings": []}]}))',
    'sys.exit(1 if errs else 0)',
  ].join('\n'));
  const FM = path.join(T, 'field-map.csv');
  fs.writeFileSync(FM, ['domain,item,fillable_by_pack,pack_slot,store',
    'pay,cash_y,yes,record,x', 'pay,other,candidate,record,', 'pay,source_entry,yes,sources,x',
    'work,days_off,yes,record,x', 'work,roster_pattern,candidate,record,', 'benefits,housing,yes,record,x', 'benefits,staff_travel,yes,record,x',
    'fleet,<機種の鍵>,yes,record,x', 'jobs,<募集の鍵>,yes,record,x', 'profile,founded,yes,record,x',
    'destinations,operated_airport,yes,record,x', 'destinations,not_operated_airport,yes,record,x',
    'living,rent,yes,record,x', 'living,commute,yes,record,x', 'living,town_candidate,yes,record,x'].join('\n') + '\n');

  /* ── 作り物のパック ── */
  const SRC = (id, extra = {}) => ({ source_id: id, source_type: 'official_package', publisher_kind: 'airline', publisher: 'テスト', title: `テストの資料 ${id}`,
    url: `https://pilot-value-test.invalid/${id}`, published: '2026-09-01', retrieved: '2026-10-19', ...extra });
  const R = (id, company, domain, item, value, more = {}) => ({
    record_id: `${company}.${domain}.${id}`, company_id: company, domain, item, label_ja: `テスト ${id}`, value,
    value_text: typeof value === 'number' ? String(value) : value, unit: null, currency: null, per: null, cond_ja: 'テストの条件。',
    info_kind: 'published_policy', applies_to: { pilot_specific: true },
    evidence: [{ source_id: more.src || 'src-a', locator: 'p.1', quote: `テストの引用 ${id}`, supports: ['value'] }],
    effective: { from: null, to: null, note_ja: 'テスト' }, relation: { type: 'new' },
    verification: { status: 'confirmed', checked_at: '2026-10-19' }, ...more.r,
  });
  const PACK = (id, rev, records, more = {}) => ({ contract_version: '1.1.1', pack_id: id, pack_revision: rev, created_at: '2026-10-19',
    researcher: 'test', test_only: true, baseline_id: null, scope: { company_ids: [], note_ja: 'テスト' },
    sources: [SRC('src-a'), SRC('src-nourl', { url: null }), SRC('src-2nd', { source_type: 'third_party_reference', publisher_kind: 'media' }),
      SRC('src-rent', { url: 'https://rent-test.invalid/sydney', source_type: 'third_party_reference', publisher_kind: 'portal' })],
    records, conflicts: [], out_of_master: [], notes_ja: '', ...more });
  const rent = (company, id, value, extra = {}) => R(id, company, 'living', 'rent', value, { src: 'src-rent', r: {
    currency: 'AUD', per: 'month', value_text: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, `$${v}`])), info_kind: 'published_statistic',
    cond_ja: 'Bondi。英: Bondi。原部屋表記「1 bedroom」。', applies_to: { base: 'Sydney', pilot_specific: false },
    amount: { kind: 'other', stat: 'median', tax: 'unknown', includes: [], excludes: [], unclear: [] }, ...extra } });

  const QA = PACK('pvr-test-qantas', 1, [
    R('days-off', 'qantas', 'work', 'days_off', '月に8日'),                                            // 追加
    R('founded', 'qantas', 'profile', 'founded', '1920'),                                              // 追加
    R('syd', 'qantas', 'destinations', 'operated_airport', 'BNE'),                                     // 追加（PLACES に在る）
    R('zzz', 'qantas', 'destinations', 'operated_airport', 'ZZQ'),                                     // 対象不明（PLACES に無い）
    R('roster', 'qantas', 'work', 'roster_pattern', '5日乗務'),                                        // 対象不明（受け取り候補）
    R('missing', 'qantas', 'benefits', 'housing', null, { r: { missing: { reason: 'not_published' }, value_text: null } }),   // 対象不明（空欄）
    R('notopen', 'qantas', 'benefits', 'housing', '住宅手当あり', { r: { verification: { status: 'not_opened', checked_at: null } } }),   // 根拠不足
    R('noquote', 'qantas', 'jobs', 'fo-a320', 'A320 FO 募集', { r: { evidence: [{ source_id: 'src-a', locator: 'p', quote: '', supports: ['value'] }] } }), // 根拠不足
    R('nourl', 'qantas', 'jobs', 'cap-a330', 'A330 機長 募集', { src: 'src-nourl' }),                  // 根拠不足（URL なし）
    R('second', 'qantas', 'benefits', 'staff_travel', '無料航空券', { src: 'src-2nd' }),               // 根拠不足（二次情報だけで「公表」）
    R('cf-a', 'qantas', 'fleet', 'b787_9', 14, { r: { unit: '機' } }),                                 // 競合（食い違い）
    R('cf-b', 'qantas', 'fleet', 'b787_9-b', 15, { r: { unit: '機' } }),                               // 競合（食い違い）
    R('pay-big', 'qantas', 'pay', 'cash_y', 700000, { r: { currency: 'AUD', per: 'year', value_text: 'AUD 700,000', applies_to: { rank: 'cap', pilot_specific: true },
      cond_ja: '機長の年額。', amount: { kind: 'cash_y', stat: 'example', tax: 'unknown', includes: [], excludes: [], unclear: [] } } }),   // 追加だが差が 25% 超
    R('pay-ok', 'qantas', 'pay', 'cash_y', 190000, { r: { currency: 'AUD', per: 'year', value_text: 'AUD 190,000', applies_to: { rank: 'fo', pilot_specific: true },
      cond_ja: '副操縦士の年額。', amount: { kind: 'cash_y', stat: 'example', tax: 'unknown', includes: [], excludes: [], unclear: [] } } }),  // 追加（推定年収の幅の中に近い）
    R('held', 'qantas', 'work', 'days_off', '年に120日'),                                        // 追加だが保留
    rent('qantas', 'rent-bondi', { '1bed': 900 }),                                                     // 追加（新しい街シドニー）
    rent('qantas', 'rent-bad', { '2bed': 1200 }, { cond_ja: 'Bondi。英: Bondi。原部屋表記「1 bedroom」。' }),   // 根拠不足（型の意味が資料と違う）
    R('town', 'qantas', 'living', 'town_candidate', 'Bondi', { r: { applies_to: { base: 'Sydney', pilot_specific: false }, cond_ja: 'Bondi。英: Bondi。' } }),
    rent('qantas', 'rent-bondi-2', { '2bed': 1300 }, { cond_ja: 'Bondi。英: Bondi。原部屋表記「2 bedroom」。' }),             // 追加（同じ街・同じ地区の別の部屋）
    R('commute', 'qantas', 'living', 'commute', 'Bondi Junction 駅からバスで15分', { r: { applies_to: { base: 'Sydney', pilot_specific: false }, cond_ja: 'BONDÍ。英: Bondí。' } }),   // 既存と一致（地区の字が大文字・アクセントだけ違う）
    /* 上が勝つ：2つの分類に当たる記録（表の境目ごとに1件） */
    R('tu-weak', 'qantas', 'work', 'roster_pattern', '4日乗務', { r: { verification: { status: 'not_opened', checked_at: null } } }),   // 対象不明 ＞ 根拠不足
    R('cf-weak', 'qantas', 'fleet', 'a380', 10, { r: { unit: '機', verification: { status: 'not_opened', checked_at: null } } }),      // 根拠不足 ＞ 競合
    R('cf-corr', 'qantas', 'benefits', 'housing', '住宅手当なし', { r: { relation: { type: 'corrects', target_record_ids: ['qantas.benefits.notopen'] } } }),   // 競合 ＞ 訂正候補
    rent('qantas', 'cf-twin', { '3bed': 2100 }, { cond_ja: 'Manly。英: Manly。原部屋表記「3 bedroom」。' }),                   // 競合 ＞ 既存と一致（先行の会社でない街の同じ行）
    rent('qantas', 'rent-tokyo', { '1bed': 150000 }, { currency: 'JPY', applies_to: { base: 'Tokyo', pilot_specific: false }, cond_ja: '東京都大田区。英: Ota。原部屋表記「1LDK」。' }),   // 競合（先行の会社の街）
  ], { conflicts: [{ conflict_id: 'cf-test', company_id: 'qantas', kind: 'between_sources', record_ids: ['qantas.fleet.cf-a', 'qantas.fleet.cf-b'], description_ja: 'テスト', researcher_view_ja: 'テスト' },
    { conflict_id: 'cf-order', company_id: 'qantas', kind: 'between_sources', record_ids: ['qantas.fleet.cf-weak', 'qantas.benefits.cf-corr', 'qantas.living.cf-twin'], description_ja: 'テスト', researcher_view_ja: 'テスト' }] });
  const JQ = PACK('pvr-test-jetstar', 1, [
    rent('jetstar', 'rent-bondi', { '1bed': 900 }),                                                    // 既存と一致（同じ街・同じ地区・同じ資料・同じ額）
    rent('jetstar', 'rent-bondi-950', { '1bed': 950 }),                                                // 競合（同じ街・同じ地区・同じ資料・同じ部屋で額が違う）
    rent('jetstar', 'rent-bondi-x', { '3bed': 2100 }, { cond_ja: 'Manly。英: Manly。原部屋表記「3 bedroom」。' }),   // 追加（同じ街）
    R('commute', 'jetstar', 'living', 'commute', 'Bondi Junction 駅からバスで15分', { r: { applies_to: { base: 'Sydney', pilot_specific: false }, cond_ja: 'Bondi。英: Bondi。' } }),   // 追加
  ]);
  const foStd = (id, value, more = {}) => R(id, 'emirates', 'pay', 'cash_y', value, { r: { currency: 'AED', per: 'year', value_text: `AED ${value}`, applies_to: { rank: 'fo', pilot_specific: true },
    cond_ja: '副操縦士 Standard の現金給与の年額。', amount: { kind: 'cash_y', stat: 'example', tax: 'unknown', includes: [], excludes: [], unclear: [] }, ...more } });
  const EK = PACK('pvr-test-emirates', 1, [
    foStd('fo-std', 385000),                                                                           // 既存と一致（年収の根拠の台帳）
    foStd('fo-corr', 385000, { relation: { type: 'corrects', target_record_ids: ['emirates.pay.fo-std'] } }),   // 訂正候補 ＞ 既存と一致
    foStd('fo-cf', 385000), foStd('fo-cf-b', 390000),                                                  // 競合 ＞ 既存と一致 ／ 競合 ＞ 訂正候補
    R('cap-new', 'emirates', 'pay', 'cash_y', 600000, { r: { currency: 'AED', per: 'year', value_text: 'AED 600,000', applies_to: { rank: 'cap', pilot_specific: true },
      cond_ja: '機長の現金給与の年額。', amount: { kind: 'cash_y', stat: 'example', tax: 'unknown', includes: [], excludes: [], unclear: [] } } }),   // 訂正候補（同じ枠で違う額）
  ], { conflicts: [{ conflict_id: 'cf-ek', company_id: 'emirates', kind: 'between_sources', record_ids: ['emirates.pay.fo-cf', 'emirates.pay.fo-cf-b'], description_ja: 'テスト', researcher_view_ja: 'テスト' }] });
  const FJ = PACK('pvr-test-fiji', 1, [R('days-off', 'fiji-airways', 'work', 'days_off', '月に9日')]);  // 新しい会社
  const NZ = PACK('pvr-test-zealand', 1, [
    rent('air-new-zealand', 'rent-all', { '1bed': 900, '2bed': 1300 }, { cond_ja: '英: Bondi。部屋型別の表。' }),            // 既存と一致（1部屋ずつの2行と、部屋ごとに同じ額・地区は「英: …」だけ）
    rent('air-new-zealand', 'rent-coogee-all', { studio: 600, '1bed': 800 }, { cond_ja: 'Coogee。英: Coogee。部屋型別の表。' }),   // 追加
    rent('air-new-zealand', 'rent-coogee-1', { '1bed': 800 }, { cond_ja: 'Coogee。英: Coogee。原部屋表記「1 bedroom」。' }),    // 既存と一致（まとめた行の中に同じ額 ── 逆の順）
    rent('air-new-zealand', 'rent-part', { '1bed': 900, '3bed': 1900 }, { cond_ja: 'Bondi。英: Bondi。部屋型別の表。' }),      // 競合（一部の部屋だけ同じ額）
    rent('air-new-zealand', 'rent-dfw', { '1bed': 900 }, { applies_to: { base: 'Sydney/Bankstown', pilot_specific: false } }),  // 競合（同じ資料・同じ額が街 sydney に在る）
  ]);
  const OLD = { ...PACK('pvr-test-old', 1, [
    { ...R('name', 'fiji-airways', 'company_master', 'name_ja', 'フィジー') },
    { ...R('area', 'fiji-airways', 'living', 'residential_area', 'Namaka', { r: { applies_to: { base: 'Nadi', pilot_specific: false } } }), label_en: 'Namaka' },
    { ...rent('fiji-airways', 'rent-old', { '1LDK': 50000, '2 rooms': 60000 }), label_en: 'Martintar' },
  ]), contract_version: '1.1.0' };
  const BAD = PACK('pvr-test-bad', 1, [R('x', 'fiji-airways', 'work', 'days_off', '月に7日'),
    R('recerr', 'fiji-airways', 'fleet', 'a380', 10, { r: { label_ja: 'STUB-REC-ERROR', unit: '機' } }),   // 形式エラー（検査のエラーの記録）
    R('fine', 'fiji-airways', 'work', 'days_off', '月に6日'),                                         // エラーの無い記録も、エラーの残るパックからは入れない
    R('fe-tu', 'no-such-air', 'work', 'days_off', '月に5日', { r: { label_ja: 'STUB-REC-ERROR' } })], { notes_ja: 'STUB-PACK-ERROR' });   // 形式エラー ＞ 対象不明

  const PD = path.join(T, 'packs');
  fs.mkdirSync(PD);
  const write = (p) => { const f = path.join(PD, `${p.pack_id}.json`); fs.writeFileSync(f, JSON.stringify(p, null, 1)); return f; };
  for (const p of [QA, JQ, EK, FJ, NZ, OLD, BAD]) write(p);
  const DEC = path.join(T, 'decisions.json');
  const all = [QA, JQ, EK, FJ, NZ, OLD, BAD].flatMap(p => p.records);
  fs.writeFileSync(DEC, JSON.stringify(all.map(r => ({ record_id: r.record_id, publication_class: r.record_id === 'qantas.work.held' ? 'hold' : r.record_id.startsWith('emirates.') ? 'recruitment_only' : r.value === null ? 'omit_missing' : 'context_with_conditions' }))));
  const packsBefore = tree(PD);

  /* ── A11 間取りの呼び名の意味（本物の台帳を読むだけ）── */
  {
    const L = await I.loadLedgers(HERE);
    const bad = I.layoutCheck(L);
    ok(!bad.length && Object.keys(I.LEDGER_TERMS).length === 5, `★A11 台帳の間取りの字は、出どころの言い方の意味どおり（東京・東京の区の参考・香港・台北・アブダビ）`, bad.join(' ／ '));
    ok(I.layoutWord('r591', '獨立套房') === 'Studio' && I.layoutWord('r591', '1房') === '1-Bed' && I.layoutWord('athome', '1LDK') === '1-Bed'
       && I.layoutWord('suumo', '1K/1DK') === 'Studio・1-Bed' && I.layoutWord('hse', '2 Rooms') === '2-Bed' && I.readTerm('2 rooms') === null
       && I.readTerm('2 værelses / 1 bedroom') === '1-Bed' && I.readTerm('1K') === 'Studio',
       '★A11 意味の表：獨立套房＝Studio・1房＝1-Bed・1LDK＝1-Bed・1K/1DK＝Studio・1-Bed・28Hse の 2 Rooms＝2-Bed／「2 rooms」は寝室の数とみなさない');
  }
  /* ── check ── */
  {
    const good = run('check', path.join(PD, 'pvr-test-qantas.json'), '--validator', STUB);
    ok(good.status === 0 && /✓ check: 1 パックともエラー 0/.test(good.stdout), 'check: エラーの無いパックは通る', good.stdout + good.stderr);
    const bad = run('check', path.join(PD, 'pvr-test-bad.json'), '--validator', STUB);
    ok(bad.status === 1 && /何も書いていない/.test(bad.stdout), '★A2 check: 検査のエラーが在るパックで止まる（終わりの値 1）', bad.stdout + bad.stderr);
    const old = run('check', path.join(PD, 'pvr-test-old.json'), '--validator', STUB);
    ok(old.status === 0 && /1\.1\.0 から直した/.test(old.stdout), '★A7 check: 1.1.0 のパックは直してから検査にかける（label_en が残っていれば検査が落とす）', old.stdout + old.stderr);
  }

  /* ── plan ── */
  const ROOT = scratchRoot('root');
  const rootBefore = tree(ROOT);
  const OUT = path.join(T, 'plan');
  {
    const inRoot = run('plan', PD, '--validator', STUB, '--fieldmap', FM, '--decisions', DEC, '--root', ROOT, '--out', path.join(ROOT, 'plan-here'), '--test', '--today', '2026-10-20');
    ok(inRoot.status === 2 && !fs.existsSync(path.join(ROOT, 'plan-here')), '★A10 plan: 書き出し先がリポジトリ（root）の中なら止まり、何も書かない', inRoot.stdout + inRoot.stderr);
  }
  const pl = run('plan', PD, '--validator', STUB, '--fieldmap', FM, '--decisions', DEC, '--root', ROOT, '--out', OUT, '--test', '--today', '2026-10-20');
  ok(pl.status === 0, 'plan: 流れる', pl.stdout + pl.stderr);
  const P = JSON.parse(fs.readFileSync(path.join(OUT, 'import-plan.json'), 'utf8'));
  const cat = id => (P.records.find(x => x.id === id) || {}).cat;
  const rec = id => P.records.find(x => x.id === id) || {};
  ok(JSON.stringify(tree(PD)) === JSON.stringify(packsBefore) && JSON.stringify(tree(ROOT)) === JSON.stringify(rootBefore), 'plan: パックのフォルダにも root にも書かない（書くのは --out だけ）');
  const want = {
    'qantas.work.days-off': 'addition', 'qantas.profile.founded': 'addition', 'qantas.destinations.syd': 'addition',
    'qantas.destinations.zzz': 'target_unknown', 'qantas.work.roster': 'target_unknown', 'qantas.benefits.missing': 'target_unknown',
    'qantas.benefits.notopen': 'weak_evidence', 'qantas.jobs.noquote': 'weak_evidence', 'qantas.jobs.nourl': 'weak_evidence', 'qantas.benefits.second': 'weak_evidence',
    'fiji-airways.fleet.recerr': 'format_error', 'qantas.fleet.cf-a': 'conflict', 'qantas.fleet.cf-b': 'conflict',
    'qantas.pay.pay-big': 'addition', 'qantas.pay.pay-ok': 'addition', 'qantas.work.held': 'addition',
    'qantas.living.rent-bondi': 'matches', 'qantas.living.rent-bad': 'weak_evidence', 'qantas.living.town': 'addition',
    'jetstar.living.rent-bondi': 'addition', 'jetstar.living.rent-bondi-x': 'addition',
    'emirates.pay.fo-std': 'matches', 'emirates.pay.cap-new': 'correction', 'fiji-airways.work.days-off': 'addition',
    'fiji-airways.work.x': 'format_error',
  };
  const wrong = Object.entries(want).filter(([id, c]) => cat(id) !== c);
  ok(!wrong.length, `★A7 plan: 7つの分類（上が勝つ）── ${Object.keys(want).length}件が決めたとおり`, wrong.map(([id, c]) => `${id}: ${cat(id)}（期待 ${c}）`).join(' ／ '));
  ok(new Set(Object.values(want)).size === 7, 'plan: 作り物のパックは7つの分類を全部含む');
  const order = {
    'no-such-air.work.fe-tu': 'format_error', 'qantas.work.tu-weak': 'target_unknown', 'qantas.fleet.cf-weak': 'weak_evidence',
    'qantas.benefits.cf-corr': 'conflict', 'emirates.pay.fo-corr': 'correction', 'qantas.living.cf-twin': 'conflict',
    'emirates.pay.fo-cf': 'conflict', 'emirates.pay.fo-cf-b': 'conflict',
  };
  const orderBad = Object.entries(order).filter(([id, c]) => cat(id) !== c || rec(id).auto !== false);
  ok(!orderBad.length, `★A7 plan: 上の分類が勝つ ── 2つに当たる記録 ${Object.keys(order).length}件（形式エラー＞対象不明＞根拠不足＞競合＞訂正候補＞既存と一致・競合＞街の同じ行・競合＞年収の根拠の台帳の一致）はどれも上の分類で、決まりでは入れない`,
     orderBad.map(([id, c]) => `${id}: ${cat(id)} auto=${rec(id).auto}（期待 ${c}）`).join(' ／ '));
  const a9 = { 'qantas.living.rent-bondi-2': 'addition', 'jetstar.living.commute': 'addition', 'qantas.living.commute': 'matches',
    'air-new-zealand.living.rent-all': 'matches', 'air-new-zealand.living.rent-coogee-all': 'addition', 'air-new-zealand.living.rent-coogee-1': 'matches',
    'air-new-zealand.living.rent-part': 'conflict', 'air-new-zealand.living.rent-dfw': 'conflict', 'jetstar.living.rent-bondi-950': 'conflict' };
  const a9Bad = Object.entries(a9).filter(([id, c]) => cat(id) !== c || (c === 'conflict' && rec(id).auto !== false));
  if (!/同じ街・同じ地区・同じ資料で額が違う/.test((rec('jetstar.living.rent-bondi-950').why || []).join(''))) a9Bad.push(['jetstar.living.rent-bondi-950 の理由', '「同じ街・同じ地区・同じ資料で額が違う」が無い']);
  if (rec('air-new-zealand.living.rent-all').entry?.district !== 'Bondi') a9Bad.push(['air-new-zealand.living.rent-all の地区', `「${rec('air-new-zealand.living.rent-all').entry?.district}」（「英: 」の印を外した Bondi のはず）`]);
  ok(!a9Bad.length, '★A9 plan: 同じ行は「既存と一致」（1部屋ずつ⇄まとめた記録・地区の字「英: …」・大文字とアクセント）／一部の部屋だけ同じ額・1つの資料の同じ額が別の拠点の書き方に入ったもの・同じ資料の同じ地区・同じ部屋で額が違うものは競合',
     a9Bad.map(([id, c]) => `${id}: ${cat(id)} auto=${rec(id).auto}（期待 ${c}）`).join(' ／ '));
  ok(rec('qantas.pay.pay-big').pay_gap && rec('qantas.pay.pay-big').pay_gap.over === true && rec('qantas.pay.pay-big').auto === false
     && rec('qantas.pay.pay-ok').auto === true, '★A6 plan: 給与の額がサイトの推定年収から 25% を超えて離れたら、追加でも決まりでは入れない', JSON.stringify(rec('qantas.pay.pay-big').pay_gap));
  ok(rec('qantas.work.held').use === '保留' && rec('qantas.work.held').auto === false, '★A6 plan: 保留の記録は、追加でも決まりでは入れない');
  const autoIds = fs.readFileSync(path.join(OUT, 'auto-approved.txt'), 'utf8').split('\n').filter(Boolean);
  const autoBad = P.records.filter(x => x.auto && (!['addition', 'matches'].includes(x.cat) || x.use === '保留' || (x.pay_gap && x.pay_gap.over)));
  ok(autoIds.length === P.records.filter(x => x.auto).length && autoIds.length > 0 && !autoBad.length, `★A6 plan: auto-approved.txt ＝ 追加・既存と一致・保留でない・差 25% 以内（${autoIds.length}件）`, autoBad.map(x => x.id).join(' '));
  ok(P.records.filter(x => x.pack === 'pvr-test-old').every(x => !/name/.test(x.item)) && cat('fiji-airways.living.area') === 'addition'
     && rec('fiji-airways.living.area').item === 'town_candidate' && /英: Namaka/.test(rec('fiji-airways.living.area').entry.cond_ja || '')
     && /部屋の型「2 rooms」を読めない/.test(rec('fiji-airways.living.rent-old').why.join('')) && rec('fiji-airways.living.rent-old').entry.value['1bed'] === 50000,
     '★A7 plan: 1.1.0 は会社の名前を外し・label_en を「英: …」へ・住宅地を town_candidate へ・1LDK を 1bed へ（「2 rooms」は寝室の数とみなさず印つきで残す）',
     JSON.stringify(P.records.filter(x => x.pack === 'pvr-test-old').map(x => [x.id, x.item, x.cat, x.why])));
  const ownerTxt = fs.readFileSync(path.join(OUT, 'owner-list.txt'), 'utf8');
  ok(/資料どうしの食い違い（cf-test）/.test(ownerTxt) && /訂正候補|違う額/.test(ownerTxt) && /差 \+\d/.test(ownerTxt), 'plan: オーナーの一覧に、食い違い・訂正候補・差 25% 超の給与が載る', ownerTxt.slice(0, 400));
  ok(/ニュージーランド航空[^\n]*拠点「Sydney\/Bankstown」[^\n]*別の街 sydney（[^\n]*この会社をどの街につなぐかを決める/.test(ownerTxt)
     && /資料どうしの食い違い（cf-order）：[^\n]*（根拠不足）/.test(ownerTxt),
     'plan: オーナーの一覧に、2つの街に入りかけた行（会社・拠点ごとに1行）と、食い違いのどの側も（ほかの分類の側は分類の名前つきで）載る', ownerTxt.split("\n").filter(l => /Bankstown|cf-order/.test(l)).join("\n") || ownerTxt.slice(400, 1600));
  {
    const BASE = path.join(T, 'baseline.json');
    fs.writeFileSync(BASE, JSON.stringify({ baseline_id: 'test', ledger_files: { 'living-facts.mjs': 'sha256:0000000000000000' } }));
    const OUT3 = path.join(T, 'plan3');
    const pl3 = run('plan', PD, '--validator', STUB, '--fieldmap', FM, '--decisions', DEC, '--root', ROOT, '--out', OUT3, '--baseline', BASE, '--test', '--today', '2026-10-20');
    const own3 = fs.existsSync(path.join(OUT3, 'owner-list.txt')) ? fs.readFileSync(path.join(OUT3, 'owner-list.txt'), 'utf8') : '';
    const tokyoLine = t => (t.split('\n').find(l => /東京「東京都大田区」の暮らし/.test(l)) || '');
    ok(pl3.status === 0 && cat('qantas.living.rent-tokyo') === 'conflict' && /調べのあいだに台帳が変わった/.test(tokyoLine(own3)) && !!tokyoLine(ownerTxt) && !/調べのあいだに台帳が変わった/.test(tokyoLine(ownerTxt)),
       '★plan: 先行の会社の街の行に「調べのあいだに台帳が変わった」と書くのは、本当に変わったときだけ', `${tokyoLine(ownerTxt)} ／ ${tokyoLine(own3)} ／ ${pl3.stderr}`);
  }
  {
    const long = { value: Object.fromEntries([139599, 140797, 144700, 148196, 149029, 149828, 150831, 151825, 152725, 153001].map((v, i) => [String(i + 1), v])), currency: 'EUR', per: 'year' };
    const vs = I.valueShort(long);
    const full = I.valueShort(long, Infinity);
    const nums = s => (s.match(/\d[\d,]*/g) || []);
    ok(vs.length <= 90 && /… EUR\/年$/.test(vs) && nums(vs.replace(/… EUR\/年$/, '')).every(n => nums(full).includes(n)) && /153,001 EUR\/年$/.test(full),
       '★plan: 長い値は数の途中で切らない（「…」の前は区切り・単位は残す。切った数が別の数に読めない）', `${vs} ／ ${full}`);
  }
  ok(!/\/Users\/|\/private\/|\/var\/folders\//.test(fs.readFileSync(path.join(OUT, 'import-plan.json'), 'utf8') + ownerTxt), 'plan: 書いたものに手元のフォルダの場所が入らない');

  /* ── apply ── */
  const APPROVED = path.join(OUT, 'auto-approved.txt');
  const STORE = path.join(ROOT, I.STORE_FILE);
  const a1 = run('apply', path.join(OUT, 'import-plan.json'), '--approved', APPROVED, '--root', ROOT, '--test');
  ok(a1.status === 0 && fs.existsSync(STORE), 'apply: 決まりで入れてよい記録を入れる', a1.stdout + a1.stderr);
  const after1 = tree(ROOT);
  const changed = Object.keys({ ...rootBefore, ...after1 }).filter(f => rootBefore[f] !== after1[f]);
  ok(changed.length === 1 && changed[0] === I.STORE_FILE, `★A1 apply: 書いたのは ${I.STORE_FILE} だけ（salary-data.mjs・ほかの台帳・db/ は1バイトも変わらない）`, changed.join(' '));
  const S1 = I.readStore(ROOT).store;
  ok(S1.FACTS['fiji-airways']?.work?.length === 1 && !!S1.FACTS.qantas?.work?.some(e => e.id === 'qantas.work.days-off'),
     '★A7 apply: 新しい会社（フィジー・エアウェイズ）の台帳の行を作る', JSON.stringify(Object.keys(S1.FACTS)));
  const all1 = JSON.stringify(S1);
  ok(!all1.includes('qantas.work.held') && !all1.includes('qantas.pay.pay-big') && !all1.includes('qantas.jobs.nourl'), '★A6 apply: 保留・差 25% 超・根拠不足は入っていない');
  const e1 = S1.FACTS.qantas?.work?.find(e => e.id === 'qantas.work.days-off');
  ok(e1 && e1.pack === 'pvr-test-qantas' && e1.src?.[0]?.url && e1.checked_at === '2026-10-19' && e1.use === '条件つき' && e1.evidence[0].quote,
     'apply: 入れた行に パックの ID・記録の ID・資料（URL）・確かめた日・使い方・引用 が付く', JSON.stringify(e1));
  ok((S1.SOURCES.qantas || []).every(e => e.status === 'candidate') && (S1.SOURCES.qantas || []).some(e => e.id === 'qantas.pay.pay-ok'),
     'apply: 給与は出所の台帳の候補（candidate）としてだけ入る', JSON.stringify(S1.SOURCES.qantas || []));
  ok(S1.CONFIRMS.some(c => c.id === 'emirates.pay.fo-std' && c.target === 'BASIS.emirates'), 'apply: 年収の根拠の台帳と同じ額は、値を書かずに「確かめた」控えだけを残す');
  /* A9 街は1つ */
  const syd = S1.LIVING.sydney;
  const seenIds = id => ((syd?.rents || []).concat(syd?.commute || []).find(r => r.id === id)?.seen || []).map(s => s.id);
  ok(syd && JSON.stringify(Object.keys(S1.LIVING).sort()) === '["nadi","sydney"]' && JSON.stringify(syd.airlines) === '["air-new-zealand","jetstar","qantas"]'
     && JSON.stringify(S1.CITY_OF.qantas) === '["sydney"]' && JSON.stringify(S1.CITY_OF.jetstar) === '["sydney"]' && JSON.stringify(S1.CITY_OF['air-new-zealand']) === '["sydney"]'
     && seenIds('jetstar.living.rent-bondi').includes('qantas.living.rent-bondi'),
     '★A9 apply: 暮らしは街ごとに1つ（3社の同じ街は1つ・3社とも街につながる・2社の同じ行は1行）', JSON.stringify(S1.LIVING));
  const roomRows = {};
  for (const r of syd?.rents || []) for (const [k, v] of Object.entries(r.value || {})) (roomRows[`${k}=${v}`] ||= []).push(r.id);
  ok(JSON.stringify((syd?.rents || []).map(r => r.id).sort()) === JSON.stringify(['air-new-zealand.living.rent-coogee-all', 'jetstar.living.rent-bondi', 'jetstar.living.rent-bondi-x', 'qantas.living.rent-bondi-2'])
     && Object.values(roomRows).every(l => l.length === 1)
     && seenIds('jetstar.living.rent-bondi').includes('air-new-zealand.living.rent-all') && seenIds('qantas.living.rent-bondi-2').includes('air-new-zealand.living.rent-all')
     && seenIds('air-new-zealand.living.rent-coogee-all').includes('air-new-zealand.living.rent-coogee-1'),
     '★A9 apply: 家賃は部屋の型ごとに1つ ── 1部屋ずつの記録とまとめた記録が出会っても、同じ額は1行（どちらの順でも。まとめた記録は部屋ごとの行に「見た」を足す）',
     JSON.stringify({ rows: (syd?.rents || []).map(r => [r.id, r.value, (r.seen || []).map(s => s.id)]), roomRows }));
  ok((syd?.commute || []).length === 1 && seenIds('jetstar.living.commute').includes('qantas.living.commute'),
     '★A9 apply: 地区の字の違い（「英: …」・大文字・アクセント）では行を分けない（足は1行・2社め以降は「見た」）', JSON.stringify(syd?.commute));
  ok(!S1.LIVING['sydney-bankstown'] && !JSON.stringify(S1).includes('air-new-zealand.living.rent-dfw') && !JSON.stringify(S1).includes('air-new-zealand.living.rent-part'),
     '★A9 apply: 1つの資料の同じ額は、拠点の書き方の違う2つめの街に入らない（街を作らない）・一部の部屋だけ同じ額の記録も決まりでは入らない', JSON.stringify(Object.keys(S1.LIVING)));
  {
    const L0 = await I.loadLedgers(HERE);
    const clone = () => JSON.parse(JSON.stringify(S1));
    const base0 = I.verifyStore(clone(), L0).filter(b => /LIVING/.test(b));
    /* 写し1：まとめた行を、部屋ごとの行に分けて足す（地区は「英: …」だけ・大文字） */
    const s1 = clone();
    const src = s1.LIVING.sydney.rents.find(r => r.id === 'qantas.living.rent-bondi-2');
    s1.LIVING.sydney.rents.push({ ...src, id: 'x.living.split', pack: 'pvr-test-x', district: '英: BONDI', district_en: null, value: { '2bed': 1300 }, seen: [] });
    /* 写し2：同じ行を別の街に */
    const s2 = clone();
    const row = s2.LIVING.sydney.rents.find(r => r.id === 'jetstar.living.rent-bondi');
    s2.LIVING['sydney-bankstown'] = { name: 'Sydney/Bankstown', airlines: ['jetstar'], rents: [{ ...row, id: 'x.living.dfw', pack: 'pvr-test-x', seen: [] }], commute: [], towns: [] };
    s2.CITY_OF.jetstar = ['sydney', 'sydney-bankstown'];
    /* 写し3：足を、地区の字だけ変えてもう1行 */
    const s3 = clone();
    const cm = s3.LIVING.sydney.commute[0];
    s3.LIVING.sydney.commute.push({ ...cm, id: 'x.living.commute', pack: 'pvr-test-x', district: 'Bondí', district_en: 'BONDI', seen: [] });
    const v1 = I.verifyStore(s1, L0), v2 = I.verifyStore(s2, L0), v3 = I.verifyStore(s3, L0);
    ok(!base0.length && v1.some(b => /x\.living\.split.*同じ地区・同じ資料・同じ値の行が2つ|qantas\.living\.rent-bondi-2.*同じ地区・同じ資料・同じ値の行が2つ/.test(b))
       && v2.some(b => /同じ資料・同じ値の行が街「sydney」にも在る|同じ資料・同じ値の行が街「sydney-bankstown」にも在る/.test(b))
       && v3.some(b => /同じ地区・同じ資料・同じ値の行が2つ/.test(b)),
       '★A9 verify: 同じ行が同じ街に2つ（部屋ごとに分けた写し・地区の字だけ違う写し）・2つの街に1つずつ在れば、台帳の検査が落とす',
       JSON.stringify({ base0, v1: v1.filter(b => /LIVING/.test(b)), v2: v2.filter(b => /LIVING/.test(b)), v3: v3.filter(b => /LIVING/.test(b)) }));
  }
  /* A5 2回目 */
  const before2 = fs.existsSync(STORE) ? fs.readFileSync(STORE) : Buffer.alloc(0);
  const a2 = run('apply', path.join(OUT, 'import-plan.json'), '--approved', APPROVED, '--root', ROOT, '--test');
  ok(a2.status === 0 && /✓ 変更なし/.test(a2.stdout) && before2.length > 0 && fs.readFileSync(STORE).equals(before2), '★A5 apply: 2回流しても同じ（「✓ 変更なし」・台帳は1バイトも違わない）', a2.stdout + a2.stderr);
  /* A4 承認されても入れない */
  const FORCE = path.join(T, 'force.txt');
  fs.writeFileSync(FORCE, ['qantas.jobs.nourl', 'qantas.jobs.noquote', 'qantas.benefits.missing', 'fiji-airways.fleet.recerr', 'fiji-airways.work.fine', 'qantas.destinations.zzz'].join('\n'));
  const a3 = run('apply', path.join(OUT, 'import-plan.json'), '--approved', FORCE, '--root', ROOT, '--test');
  const S3 = fs.existsSync(STORE) ? fs.readFileSync(STORE, 'utf8') : '';
  ok(a3.status === 0 && before2.length > 0 && fs.readFileSync(STORE).equals(before2) && !/qantas\.jobs\.nourl|qantas\.benefits\.missing|fiji-airways\.work\.fine|fiji-airways\.fleet\.recerr/.test(S3)
     && (a3.stdout.match(/入れない:/g) || []).length === 6,
     '★A4 apply: 引用・URL の無い記録、空の記録、形式エラー・対象不明は、承認されても入れない', a3.stdout + a3.stderr);
  /* A9 承認されても入れない：一部の部屋だけ同じ額の記録・別の街に同じ行が在る記録 */
  {
    const F9 = path.join(T, 'force9.txt');
    fs.writeFileSync(F9, 'pvr-test-zealand air-new-zealand.living.rent-part\npvr-test-zealand air-new-zealand.living.rent-dfw\npvr-test-jetstar jetstar.living.rent-bondi-950\n');
    const a9r = run('apply', path.join(OUT, 'import-plan.json'), '--approved', F9, '--root', ROOT, '--test');
    ok(a9r.status === 0 && fs.readFileSync(STORE).equals(before2) && /rent-part ── 一部の部屋の型だけ同じ額の行が在る/.test(a9r.stdout) && /rent-dfw ── 同じ資料・同じ値の行が街「sydney」に在る/.test(a9r.stdout)
       && /rent-bondi-950 ── 同じ地区・同じ資料・同じ部屋の型で額の違う行が在る/.test(a9r.stdout),
       '★A9 apply の門：一部の部屋だけ同じ額の記録・別の街に同じ行が在る記録・同じ部屋で額の違う記録は、承認されても入れない（台帳は1バイトも変わらない）', a9r.stdout + a9r.stderr);
  }
  /* A4 apply の門そのもの（分類が「追加」でも、引用と URL の無い記録は入れない）。plan を経ずに門だけを見る */
  {
    const L0 = await I.loadLedgers(HERE);
    const base = { cat: 'addition', use: '条件つき', domain: 'work', company: 'qantas', target: 'FACTS.qantas.work', test_only: false,
      entry: { value: '月に8日', evidence: [{ source_id: 's', quote: '引用', supports: ['value'] }], src: [{ source_id: 's', url: 'https://pilot-value-test.invalid/s' }] } };
    const noUrl = { ...base, entry: { ...base.entry, src: [{ source_id: 's', url: null }] } };
    const noQuote = { ...base, entry: { ...base.entry, evidence: [{ source_id: 's', quote: ' ', supports: ['value'] }] } };
    const pay = { ...base, domain: 'pay', target: 'FACTS.qantas.work' };
    ok(I.gate(base, { validator_ok: true }, ROOT, {}, L0) === null && /引用と URL/.test(I.gate(noUrl, { validator_ok: true }, ROOT, {}, L0) || '')
       && /引用と URL/.test(I.gate(noQuote, { validator_ok: true }, ROOT, {}, L0) || ''),
       '★A4 apply の門：分類が「追加」でも、引用か URL の無い記録は入れない');
    ok(/出所の台帳/.test(I.gate(pay, { validator_ok: true }, ROOT, {}, L0) || '') && /検査のエラー/.test(I.gate(base, { validator_ok: false }, ROOT, {}, L0) || ''),
       '★A1/A2 apply の門：給与は出所の台帳の候補にだけ・検査のエラーの残るパックからは入れない');
  }
  /* A2 壊れたパック：plan のどの記録も入れない */
  ok(P.records.filter(x => x.pack === 'pvr-test-bad').every(x => !x.auto) && cat('fiji-airways.work.x') === 'format_error' && cat('fiji-airways.work.fine') === 'addition'
     && rec('fiji-airways.work.fine').blocked === true,
     '★A2 plan: 検査のエラーが在るパックは、エラーの記録は形式エラー・ほかの記録は分類まで出すが、どれも決まりでは入れない');

  /* ── A8 出し直し（版 2）・A3 空は消さない ── */
  const QA2 = PACK('pvr-test-qantas', 2, [
    R('days-off', 'qantas', 'work', 'days_off', '月に10日'),                                          // 同じ ID で中身が変わった → 競合
    R('founded', 'qantas', 'profile', 'founded', '1920'),                                              // 同じ → 既存と一致
    R('jobs-new', 'qantas', 'jobs', 'so-b737', 'B737 SO 募集'),                                        // 新しい → 追加
    rent('qantas', 'rent-bondi', { '1bed': 900 }),                                                     // 前の版で別の会社の行と1つになった行 → 同じ中身なら既存と一致（競合にしない）
    R('syd', 'qantas', 'destinations', 'operated_airport', null, { r: { missing: { reason: 'not_checked' }, value_text: null } }),   // 空 → 消さない
    // town は版 2 に無い → 消さない
  ]);
  const PD2 = path.join(T, 'packs2'); fs.mkdirSync(PD2);
  fs.writeFileSync(path.join(PD2, 'q2.json'), JSON.stringify(QA2));
  const DEC2 = path.join(T, 'decisions2.json');
  fs.writeFileSync(DEC2, JSON.stringify(QA2.records.map(r => ({ record_id: r.record_id, publication_class: r.value === null ? 'omit_missing' : 'context_with_conditions' }))));
  const OUT2 = path.join(T, 'plan2');
  const pl2 = run('plan', PD2, '--validator', STUB, '--fieldmap', FM, '--decisions', DEC2, '--root', ROOT, '--out', OUT2, '--test', '--today', '2026-10-21');
  const P2 = JSON.parse(fs.readFileSync(path.join(OUT2, 'import-plan.json'), 'utf8'));
  const c2 = id => (P2.records.find(x => x.id === id) || {}).cat;
  ok(pl2.status === 0 && c2('qantas.work.days-off') === 'conflict' && c2('qantas.profile.founded') === 'matches' && c2('qantas.jobs.jobs-new') === 'addition' && c2('qantas.living.rent-bondi') === 'matches',
     '★A8 plan: 版が上がったパック ── 同じ ID で中身が変わった記録は競合・同じ記録は既存と一致・新しい記録は追加', JSON.stringify(P2.records.map(x => [x.id, x.cat])));
  const a4 = run('apply', path.join(OUT2, 'import-plan.json'), '--approved', path.join(OUT2, 'auto-approved.txt'), '--root', ROOT, '--test');
  const S4 = I.readStore(ROOT).store;
  ok(a4.status === 0 && S4.FACTS.qantas?.work?.find(e => e.id === 'qantas.work.days-off')?.value === '月に8日'
     && !!S4.NETWORK.qantas?.list?.some(e => e.id === 'qantas.destinations.syd' && e.value === 'BNE')
     && !!S4.LIVING.sydney?.towns?.some(e => e.id === 'qantas.living.town') && !!S4.FACTS.qantas?.jobs?.some(e => e.id === 'qantas.jobs.jobs-new')
     && S4.packs['pvr-test-qantas']?.revision === 2,
     '★A3 apply: 空・次の版に無いことは消す指示ではない（就航地・住宅地は残る）／競合は決まりでは入れない（前の値のまま）', a4.stdout + a4.stderr);
  const OWN = path.join(T, 'owner-approved.txt');
  fs.writeFileSync(OWN, 'pvr-test-qantas qantas.work.days-off\n');
  const a5 = run('apply', path.join(OUT2, 'import-plan.json'), '--approved', OWN, '--root', ROOT, '--test');
  const S5 = I.readStore(ROOT).store;
  ok(a5.status === 0 && S5.FACTS.qantas?.work?.find(e => e.id === 'qantas.work.days-off')?.value === '月に10日'
     && S5.HISTORY.some(h => h.replaced?.id === 'qantas.work.days-off' && h.replaced?.value === '月に8日' && h.by?.rev === 2),
     '★A8 apply: オーナーが選んだ競合は入れ替わり、前の値は HISTORY に残る（黙って上書きしない）', JSON.stringify(S5.HISTORY));

  /* ── A10 test_only はリポジトリへ入らない／古い plan・直した plan は断る ── */
  {
    const REPO = scratchRoot('looks-like-repo');
    fs.mkdirSync(path.join(REPO, '.git'));
    const r = run('apply', path.join(OUT, 'import-plan.json'), '--approved', APPROVED, '--root', REPO, '--test');
    ok(!fs.existsSync(path.join(REPO, I.STORE_FILE)) && (r.stdout.match(/test_only のパック/g) || []).length === autoIds.length,
       '★A10 apply: test_only のパックは、リポジトリ（.git の在る root）には1件も入らない', `${(r.stdout.match(/test_only のパック/g) || []).length} / ${autoIds.length} ${fs.existsSync(path.join(REPO, I.STORE_FILE))} ${r.stdout.slice(-300)} ${r.stderr}`);
    const STALE = scratchRoot('stale');
    fs.appendFileSync(path.join(STALE, 'airline-ops.mjs'), '\n// 変わった\n');
    const s = run('apply', path.join(OUT, 'import-plan.json'), '--approved', APPROVED, '--root', STALE, '--test');
    ok(s.status === 2 && !fs.existsSync(path.join(STALE, I.STORE_FILE)) && /plan を作り直す/.test(s.stderr), '★A10 apply: plan のあとで台帳が変わっていたら断る（plan を作り直す）', s.stdout + s.stderr);
    const TAMPER = path.join(T, 'tampered.json');
    const pj = JSON.parse(fs.readFileSync(path.join(OUT, 'import-plan.json'), 'utf8'));
    pj.records.find(x => x.id === 'qantas.work.held').cat = 'addition';
    pj.records.find(x => x.id === 'qantas.work.held').use = '条件つき';
    fs.writeFileSync(TAMPER, JSON.stringify(pj));
    const FRESH = scratchRoot('fresh');
    const t = run('apply', TAMPER, '--approved', APPROVED, '--root', FRESH, '--test');
    ok(t.status === 2 && !fs.existsSync(path.join(FRESH, I.STORE_FILE)), '★A10 apply: 手で直した plan（指紋が合わない）は断る', t.stdout + t.stderr);
  }

  /* verify（作り物を入れた取り込みの台帳）*/
  {
    const vr = run('verify', '--root', ROOT);
    ok(vr.status === 0 && /✅/.test(vr.stdout), 'verify: 作り物を入れた取り込みの台帳も、決まりどおり', vr.stdout + vr.stderr);
  }
} finally {
  fs.rmSync(T, { recursive: true, force: true });
}

console.log(`\n${failN ? '❌' : '✅'} assert-import-research: ${pass} pass / ${failN} fail（作り物のパック・使い捨ての台帳の写し。本物の台帳は読むだけ）`);
if (failN) process.exit(1);
