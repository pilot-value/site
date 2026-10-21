/* ══════════════════════════════════════════════════════════════════════
   import-research-pack.mjs ── 調査パック（ChatGPT の調べ）の取り込み

   決まりの正本は、調べの受け渡しの決まり（research-contract.md の 11章）と追補 1.1.1。
   その一式はリポジトリの外に在る（場所を書かない ＝ 利用者の名前が入る）。この道具は場所を引数で受け取る。

   ■ 3つの動詞（どれも、渡されたパック・決まりの一式は読むだけ）
     check <pack.json|フォルダ> --validator <validate_pack.py>
         決まりの検査（python3 -I）を流す。エラーが1つでも在れば止まる。何も書かない。
     plan  <pack.json|フォルダ> --contract <決まりの一式のフォルダ> [--decisions <RECORD-PUBLICATION-DECISIONS.json>]
           [--out <フォルダ>] [--skip <会社ID,…>] [--today YYYY-MM-DD]
         記録を1件ずつ、今の台帳と比べて7つに分ける（形式エラー／対象不明／根拠不足／競合／訂正候補／既存と一致／追加。
         上のものが勝つ）。書くのは --out（既定はパックの隣）の3つだけ ── リポジトリの中には書かない（書こうとすると止まる）:
           import-plan.json   記録ごとの分類と、入れるときに台帳へ書く形（apply が読む）
           auto-approved.txt  オーナーの決まり（2026-10-19）で入れてよい記録の ID
           owner-list.txt     オーナーに見てほしいもの（日本語・短く）
     apply <import-plan.json> --approved <ID の一覧のファイル> [--root <フォルダ>] [--test]
         オーナーが選んだ記録だけを、取り込みの台帳（<root>/research-ledger.mjs）へ書く。書くのはこの1ファイルだけ。
         2回流しても同じ（2回目は「✓ 変更なし」）。前の値は消さずに履歴へ（黙って上書きしない）。
         暮らしは街ごとに1つ・同じ行は1つ（家賃は部屋の型ごとに見る。2社め以降は行に「見た」を足す）。
         同じ行が別の街に在る記録・一部の部屋だけ同じ額の記録は、承認されても入れない（どの街か・どの額かを先に決める）。
     verify [--root <フォルダ>]
         取り込みの台帳の形と、間取りの呼び名の意味（下の LAYOUT）を見る。

   ■ 書かないもの（どの動詞も）
     salary-data.mjs（サイトの推定年収）・会員のデータ・db/ ・ほかの台帳のファイル。
     給与の記録は「出所の台帳の候補（領収書）」としてだけ入る。額を動かすかは workflows/update-salary.md で人が決める。

   ■ なぜ取り込みの台帳が別のファイルなのか（airline-facts.mjs の FACTS などへ直接書かない理由）
     ・airline-facts.mjs の検査は先行の4社以外の会社を「この台帳に置く会社ではない」として落とす。
     ・airline-destinations.mjs の NETWORK は、db/stays.sql の pv_stay_network() と1字も違わないことを
       db/test-stays.mjs（★N1）が見ている。NETWORK に足すと SQL の検査が赤くなる（この道具は db/ を書かない）。
     ・salary-basis.mjs の BASIS は FAQ・国別ページ・検索向けの説明文・salary-data.mjs が読む。書くと公開の字が動く。
     ・living-facts.mjs の街には、地区を選んだ理由（pick_ja）と最初の1画面に出す1行が要る。パックの街には無い。
     → 入れた記録は research-ledger.mjs に、台帳ごとの節（FACTS・NETWORK・LIVING・CITY_OF・SOURCES）に分けて置く。
       どの画面もまだ読まない（会社ページを全社へ広げる回が、切り替えた会社のぶんだけ読む）。

   見るもの: node assert-import-research.mjs
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STORE_FILE = 'research-ledger.mjs';
const BEGIN = '/*PV-IMPORT-JSON*/';
const END = '/*/PV-IMPORT-JSON*/';

/* ════════════ 7つの分類（上が勝つ）════════════ */
export const CATS = ['format_error', 'target_unknown', 'weak_evidence', 'conflict', 'correction', 'matches', 'addition'];
export const CAT_JA = {
  format_error: '形式エラー', target_unknown: '対象不明', weak_evidence: '根拠不足', conflict: '競合',
  correction: '訂正候補', matches: '既存と一致', addition: '追加',
};
/* 記録の使い方（調べた側の RECORD-PUBLICATION-DECISIONS.json の publication_class）。保留は画面に出さない。 */
export const USE = {
  context_with_conditions: '条件つき', recruitment_only: '募集', historical_only: '過去',
  reference_only: '参考', hold: '保留', omit_missing: '空欄',
};
const USES = new Set(Object.values(USE));
/* 給与の額がサイトの推定年収（SALARY）と同じ職位でこれ以上ずれたら、決まりでは入れずにオーナーに見せる。 */
export const PAY_GAP = 0.25;
/* 推定年収と比べてよいのは、1年ぶんの給与の額だけ（決まりの一式の「額の種類」の表）。
   other（手当・給与表の1行・提案の額など）を比べると、妻手当 500 BHD を年収と比べて「差 -99%」になる（2026-10-20 ガルフ・エア）。 */
export const PAY_GAP_KINDS = new Set(['cash_y', 'pkg_y', 'max_y', 'target_y', 'cash_y_over', 'reward_y', 'avg_y']);
const RANKS_PAY = ['cap', 'fo'];

/* ════════════ 間取りの呼び名（P12.73）── 出どころごとに1つの表：出どころの言い方 → 画面の字（寝室の数）════════════
   部屋の数の合計を寝室の数とみなさない（「2 rooms」「2部屋」「2 værelses」だけでは読まない）。分からない言い方は null。 */
const JP_LAYOUT = {
  'ワンルーム': 'Studio', '1R': 'Studio', '1K': 'Studio',
  '1DK': '1-Bed', '1LDK': '1-Bed', '1SLDK': '1-Bed',
  '2K': '2-Bed', '2DK': '2-Bed', '2LDK': '2-Bed', '2SLDK': '2-Bed',
  '3K': '3-Bed', '3DK': '3-Bed', '3LDK': '3-Bed', '3SLDK': '3-Bed',
  '4K～': '4-Bed〜', '4K〜': '4-Bed〜', '4LDK': '4-Bed', '4LDK〜': '4-Bed〜',
};
export const LAYOUT = {
  athome: JP_LAYOUT,          // アットホーム（東京）
  suumo: JP_LAYOUT,           // SUUMO（東京の区・市の参考）
  homes: JP_LAYOUT,           // LIFULL HOME'S（パック）
  hse: { '1 Room': '1-Bed', '2 Rooms': '2-Bed', '3 Rooms': '3-Bed', '1房': '1-Bed', '2房': '2-Bed', '3房': '3-Bed' },   // 28Hse の記録の欄「Bedroom:」（房間數量）
  r591: { '獨立套房': 'Studio', '1房': '1-Bed', '2房': '2-Bed', '3房': '3-Bed' },                                      // 591租屋網
  bayut: { 'Studio': 'Studio', '1-Bed': '1-Bed', '2-Bed': '2-Bed', '3-Bed': '3-Bed' },                                  // Bayut（自分の字が同じ）
  pack: { studio: 'Studio', '1bed': '1-Bed', '2bed': '2-Bed', '3bed': '3-Bed' },                                         // 追補 1.1.1 の鍵
};
/** 台帳の街ごとに、列の鍵 → 出どころの言い方（棒の列は words_src と同じでなければならない。検査が見る）。 */
export const LEDGER_TERMS = {
  'tokyo': { site: 'athome', terms: { ldk1: '1LDK', ldk2: '2LDK', ldk3: '3LDK' } },
  'tokyo.refs.suumo_wards': { site: 'suumo', terms: { oneroom: 'ワンルーム', k1: '1K/1DK', ldk1: '1LDK/2K/2DK', ldk2: '2LDK/3K/3DK', ldk3: '3LDK/4K～' } },
  'hongkong': { site: 'hse', terms: { bed1: '1 Room', bed2: '2 Rooms', bed3: '3 Rooms' } },
  'taipei': { site: 'r591', terms: { suite: '獨立套房', bed1: '1房', bed2: '2房', bed3: '3房' } },
  'abudhabi': { site: 'bayut', terms: { studio: 'Studio', bed1: '1-Bed', bed2: '2-Bed', bed3: '3-Bed' } },
};
/** パックの鍵 → 新しい街の台帳の鍵（1つの表。新しい街はアブダビと同じ studio / bed1-3 の組。今ある街の鍵は変えない）。 */
export const PACK_TO_LEDGER_KEY = { studio: 'studio', '1bed': 'bed1', '2bed': 'bed2', '3bed': 'bed3' };
const LEDGER_KEY_WORD = { studio: 'Studio', bed1: '1-Bed', bed2: '2-Bed', bed3: '3-Bed' };

/** 出どころの言い方1つを画面の字に。'1K/1DK' や '1K・1DK' のような組は、型ごとに読んで元の順に「・」でつなぐ（同じ字は1つ）。 */
export function layoutWord(site, term) {
  const table = LAYOUT[site];
  if (!table || typeof term !== 'string') return null;
  const parts = term.split(/[\/・]/).map(s => s.trim()).filter(Boolean);
  const words = [];
  for (const p of parts) {
    const w = table[p] ?? null;
    if (!w) return null;
    if (words[words.length - 1] !== w) words.push(w);
  }
  return words.length ? words.join('・') : null;
}

/** パックの資料の言い方（cond_ja の「原部屋表記「…」」）を読む。英語の掲載サイトは寝室の言葉だけを読む。 */
export function readTerm(term) {
  if (typeof term !== 'string') return null;
  const t = term.normalize('NFKC').trim();
  const jp = layoutWord('homes', t.replace(/\s+/g, ''));
  if (jp) return jp;
  if (/^studio$/i.test(t) || /^0\s*(bed|bedroom)s?$/i.test(t)) return 'Studio';
  if (/^(studio|1bed|2bed|3bed)$/.test(t)) return LAYOUT.pack[t];
  const num = { one: 1, two: 2, three: 3, four: 4 };
  const m = t.match(/(?:^|[^\d])(\d|one|two|three|four)\s*-?\s*(?:bed(?:room)?s?|br|bd)\b/i)
         || t.match(/phòng ngủ\s*(\d)/i) || t.match(/(\d)\s*房/);
  if (!m) return null;
  const n = /^\d$/.test(m[1]) ? +m[1] : num[m[1].toLowerCase()];
  return n >= 1 && n <= 3 ? `${n}-Bed` : null;
}

/* ════════════ 小さな道具 ════════════ */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
/** キーを並べ替えた JSON（同じ中身なら同じ字）。 */
export function canon(x) {
  if (Array.isArray(x)) return `[${x.map(canon).join(',')}]`;
  if (isObj(x)) return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canon(x[k])}`).join(',')}}`;
  return JSON.stringify(x === undefined ? null : x);
}
const sortDeep = x => Array.isArray(x) ? x.map(sortDeep) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortDeep(x[k])])) : x;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fail = (msg, code = 2) => { console.error(`✗ ${msg}`); process.exit(code); };
const inside = (child, parent) => { const c = path.resolve(child), p = path.resolve(parent); return c === p || c.startsWith(p + path.sep); };
const real = p => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
/** この道具が「リポジトリ」とみなす場所（.git を持つ）。test_only のパックはここへ書かない。 */
export const isRepository = root => fs.existsSync(path.join(root, '.git'));

function slug(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ════════════ 台帳を読む（root のファイルだけ。書かない）════════════ */
export const LEDGER_FILES = ['salary-data.mjs', 'airline-ops.mjs', 'salary-basis.mjs', 'salary-sources.mjs', 'airline-facts.mjs',
  'career-facts.mjs', 'living-facts.mjs', 'airline-destinations.mjs', 'fx-rates.mjs'];

export async function loadLedgers(root) {
  const imp = f => import(pathToFileURL(path.join(root, f)).href);
  const [sd, ops, sb, ss, af, cf, lf, ad, fx] = await Promise.all(LEDGER_FILES.map(imp));
  const prints = Object.fromEntries(LEDGER_FILES.map(f => [f, 'sha256:' + sha(fs.readFileSync(path.join(root, f))).slice(0, 16)]));
  return {
    root, prints,
    SALARY: sd.SALARY, OPS: ops.OPS, BASIS: sb.BASIS, SOURCES: ss.SOURCES, SOURCE_TYPES: ss.SOURCE_TYPES, STATUSES: ss.STATUSES,
    FACTS: { ...af.FACTS, etihad: cf.FACTS.etihad }, LIVING: lf.LIVING, CITY_OF: { ...lf.CITY_OF, etihad: 'abudhabi' },
    ABUDHABI: lf.ABUDHABI, EY_LIVING: cf.FACTS.etihad && cf.FACTS.etihad.living, PLACES: ad.PLACES, NETWORK: ad.NETWORK, JPY_PER: fx.JPY_PER,
  };
}

/* ════════════ 取り込みの台帳（research-ledger.mjs）════════════ */
const EMPTY = () => ({ format: 1, packs: {}, FACTS: {}, NETWORK: {}, LIVING: {}, CITY_OF: {}, SOURCES: {}, CONFIRMS: [], CORRECTIONS: [], HISTORY: [] });

export function readStore(root) {
  const f = path.join(root, STORE_FILE);
  if (!fs.existsSync(f)) return { store: EMPTY(), text: null };
  const text = fs.readFileSync(f, 'utf8');
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a < 0 || b < a || text.indexOf(BEGIN, a + 1) >= 0) throw new Error(`${STORE_FILE} の印（${BEGIN}）が1組ではない`);
  return { store: JSON.parse(text.slice(a + BEGIN.length, b)), text };
}

function storeText(store) {
  const json = JSON.stringify(sortDeep(store), null, 1);
  if (/__proto__/.test(json)) throw new Error('__proto__ を含む鍵は書けない');
  return `/* ${STORE_FILE} ── 調査パックから取り込んだ記録の台帳。import-research-pack.mjs apply だけが書く（手で直さない）。
   どの画面もまだ読まない。会社ページを全社へ広げる回が、切り替えた会社のぶんだけ読む。
   ・どの行にも pack（パックの ID）・id（記録の ID）・src（資料と URL）・checked_at（調べた側が引用まで確かめた日）・use（使い方）が付く。
   ・use ＝ 条件つき／募集（求人の条件として）／過去（その日付の話として）／参考（背景として）／保留（画面に出さない）。
   ・給与は SOURCES（出所の台帳の候補）だけ。サイトの推定年収（salary-data.mjs）は動かさない。
   ・前の値は消さずに HISTORY へ。空・null は削除の指示ではない。
   見るもの: node import-research-pack.mjs verify */
export const LEDGER = ${BEGIN}${json}${END};
export default LEDGER;
`;
}

/** 書くのはここだけ。root/research-ledger.mjs 以外は1バイトも書かない。 */
function writeStore(root, store) {
  const text = storeText(store);
  const f = path.join(root, STORE_FILE);
  if (fs.existsSync(f) && fs.readFileSync(f, 'utf8') === text) return false;
  if (fs.existsSync(f) && fs.lstatSync(f).isSymbolicLink()) throw new Error(`${STORE_FILE} がリンク ── 書かない`);
  const tmp = f + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, f);
  return true;
}

/* ════════════ 決まりの検査（validate_pack.py）════════════ */
export function runValidator(validator, packFile, today) {
  if (!validator || !fs.existsSync(validator)) return { ran: false, ok: false, errors: [{ path: '（検査）', message: '検査の道具が無い' }], warnings: [] };
  const args = ['-I', validator, '--json', ...(today ? ['--today', today] : []), packFile];
  const r = spawnSync('python3', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  let out;
  try { out = JSON.parse(r.stdout); } catch { return { ran: true, ok: false, errors: [{ path: '（検査）', message: `検査の結果を読めない（終了 ${r.status}）${(r.stderr || '').slice(0, 200)}` }], warnings: [] }; }
  const res = (out.results || [])[0] || {};
  return { ran: true, ok: !!res.ok && r.status === 0, stage: res.stage, errors: res.errors || [], warnings: res.warnings || [],
    validator_version: out.validator_version, contract_version: out.contract_version, baseline_id: out.baseline_id };
}

/* ════════════ 1.1.0 のパックを 1.1.1 の形に直す（P12.69）════════════ */
const NAME_ITEMS = /^(name|name_ja|name_en|name_local|local_name|official_name|official_name_[a-z]+|legal_name|company_name|trade_name)$/;
const TOWN_ITEMS = /^(residential_area|residential_areas|town|towns|area|district|neighbourhood|neighborhood|living_area)$/;
export function convert110(pack) {
  const log = [];
  if (pack.contract_version !== '1.1.0') return { pack, log };
  const p = JSON.parse(JSON.stringify(pack));
  p.records = (p.records || []).filter(r => {
    if (r.domain === 'company_master' || NAME_ITEMS.test(String(r.item))) { log.push(`会社の名前の記録を外した: ${r.record_id}`); return false; }
    return true;
  });
  for (const r of p.records) {
    if (r.label_en !== undefined) {
      if (r.label_en) {
        const head = String(r.cond_ja || '').split('。')[0];
        const rest = String(r.cond_ja || '').slice(head.length).replace(/^。/, '');
        r.cond_ja = `${head}。英: ${r.label_en}。${rest}`.replace(/。。/g, '。');
      }
      log.push(`label_en を cond_ja の「英: …」へ: ${r.record_id}`);
      delete r.label_en;
    }
    if (r.domain === 'living' && TOWN_ITEMS.test(String(r.item))) { log.push(`住宅地の記録を town_candidate へ: ${r.record_id}（${r.item}）`); r.item = 'town_candidate'; delete r.item_is_new; }
    if (r.domain === 'living' && r.item === 'rent' && isObj(r.value)) {
      const v = {}, vt = {}, kept = [];
      for (const [k, x] of Object.entries(r.value)) {
        const w = readTerm(k);
        const key = w && Object.keys(LAYOUT.pack).find(pk => LAYOUT.pack[pk] === w);
        if (key && !(key in v)) { v[key] = x; if (isObj(r.value_text)) vt[key] = r.value_text[k]; log.push(`部屋の型 ${JSON.stringify(k)} → ${key}: ${r.record_id}`); }
        else { v[k] = x; if (isObj(r.value_text)) vt[k] = r.value_text[k]; kept.push(k); }
      }
      r.value = v; if (isObj(r.value_text)) r.value_text = vt;
      if (kept.length) { r.layout_unread = kept; log.push(`部屋の型を読めない（資料の言い方のまま・印つき）: ${r.record_id} ${JSON.stringify(kept)}`); }
    }
  }
  p.contract_version = '1.1.1';
  p.converted_from = '1.1.0';
  return { pack: p, log };
}

/* ════════════ 決まりの一式を読む ════════════ */
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function readFieldMap(file) {
  const m = new Map();
  for (const r of readCsv(file)) m.set(`${r.domain}|${r.item}`, r);
  return m;
}

/* ════════════ 分類 ════════════ */
const FACT_DOMAINS = ['profile', 'base', 'scale', 'fleet', 'work', 'benefits', 'jobs'];
const SECONDARY = new Set(['third_party_reference', 'community_reference']);
const PRIMARY_FOR_LIVING = new Set(['portal', 'operator', 'government']);

function fieldRow(fm, r) {
  if (r.domain === 'fleet') return fm.get('fleet|<機種の鍵>') || null;
  if (r.domain === 'jobs') return fm.get(`jobs|${r.item}`) || fm.get('jobs|<募集の鍵>') || null;
  return fm.get(`${r.domain}|${r.item}`) || null;
}

/**
 * 取り込みの台帳に置き場を作った項目（全社へ広げる a2・2026-10-21 リード P12.83）。鍵は「分野|項目」・値は置き場（会社ページの今の欄）。
 * 決まりの一式の field-map.csv では「受け取り候補」（pension・roster_pattern・training_bond）か、表に無い新しい項目
 * （pilot_base_city・headquarters_country・headquarters_city・annual_days_off ── item_is_new で届く）だった。ROUND4 で多くの会社に
 * 届いたので、ほかの項目と同じ決まり（使い方・引用と URL・2回流しても同じ）で FACTS.<会社>.<分野> に入れる。
 * 画面の字は airline-display.mjs の言い方の表だけ（言い方の無い行は「画面の言い方がまだ無い」として出ない）。
 * ⚠️ field-map.csv（リポジトリの外の決まりの一式）には書き足さない：表に在る項目に item_is_new を付けたパックは、決まりの検査
 *    （validate_pack.py）がエラーにする ── 届いている ROUND4 のパックが1件も入らなくなる。次に決まりの一式を出し直すときに、この表を写す。
 * ⚠️ registered_office_country（登記上の国）は本社ではない。ここへ足さない・本社の国と混ぜない。
 * ⚠️ ここに無い項目（小さな項目 278種類）は今までどおり「対象不明」（置き場を作るかは別に決める）。
 */
export const PLACED = Object.freeze({
  'benefits|pension': '待遇',
  'work|roster_pattern': '勤務',
  'work|training_bond': '勤務',
  'work|annual_days_off': '勤務',
  'base|pilot_base_city': '拠点',
  'profile|headquarters_country': '会社',
  'profile|headquarters_city': '会社',
});

/**
 * 拠点の書き方が違うだけで同じ街（決めた人と日付を添える）。左の鍵で届いた記録は右の街に入る。
 *   dallas-fort-worth → dallas：アメリカン航空の「Dallas/Fort Worth」の家賃は、フロンティア航空・サウスウエスト航空の
 *   「Dallas」と同じ資料（RentCafe のダラス市）・4部屋とも同じ額だった（2026-10-20 リードが決めた。家賃はダラス市のもの）。
 */
export const CITY_SAME = { 'dallas-fort-worth': 'dallas' };
/** 拠点の字から街の鍵。英語の名前（「 / 」の右・カンマの区切り）→ 無ければ PLACES の日本語の都市名。決まらなければ null。 */
export function cityKey(base, L) {
  if (typeof base !== 'string' || !base.trim()) return null;
  const b = base.replace(/[（(][^）)]*[）)]/g, '').trim();
  let en = b;
  if (b.includes(' / ')) { const right = b.split(' / ').pop(); en = right.split(',').pop(); }
  else if (b.includes(',')) en = b.split(',')[0];
  let k = slug(en);
  if (!k) {
    const ja = b.replace(/[都道府県市区町村]$/, '');
    const hit = Object.values(L.PLACES).find(([city]) => city.replace(/（.*$/, '') === ja || city.replace(/（.*$/, '') === b);
    if (hit) k = slug(hit[1].split(' ')[0]);
  }
  if (!k) return null;
  if (CITY_SAME[k]) k = CITY_SAME[k];
  const flat = k.replace(/-/g, '');
  for (const have of [...Object.keys(L.LIVING), 'abudhabi']) if (have.replace(/-/g, '') === flat) return have;
  return k;
}
const headOf = s => String(s || '').split('。')[0].trim();
const enOf = s => { const m = String(s || '').match(/英:\s*([^。]+)/); return m ? m[1].trim() : null; };
/** 地区の名前（cond_ja の最初の文）。「英: …」だけの文なら、その印を外した英語の名前。 */
const districtOf = s => headOf(s).replace(/^英:\s*/, '');

/* ════════════ 暮らしの行どうしが同じか（街は1つ・同じ行は1つ）════════════
   同じ行 ＝ 同じ項目・同じ資料（URL）・同じ地区・同じ通貨・同じ値。家賃は部屋の型ごとに見る
   （1部屋ずつの記録と、4部屋をまとめた記録が出会っても、どの部屋も同じ額なら同じ行）。
   ⚠️ 指紋から地区と通貨を外さない。Eurostat の冊子のように1つの資料に何十もの街が載っていると、
   別の街の別の行が1部屋だけ偶然同じ額になる（2026-10-20、ダブリンとロンドン・ウィーンとローマなど7件が
   「同じ行が別の街に在る」と止まった）。 */
const fold = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/** 地区を比べる鍵（日本語の名前と英語の名前の両方。「英: …」の印・アクセント・大文字小文字・記号は見ない）。 */
export function districtKeys(e) {
  return [...new Set([e.district, e.district_en].map(s => fold(String(s || '').replace(/^英:\s*/, ''))).filter(Boolean))];
}
const sameDistrict = (a, b) => { const A = districtKeys(a); return districtKeys(b).some(k => A.includes(k)); };
const urlOf = e => ((e.src || [])[0] || {}).url || '';
/** 行の指紋（家賃は部屋の型ごとに1つ・ほかは行に1つ。地区の名前が日英2つなら2つずつ）。同じ指紋 ＝ 同じ資料・同じ地区・同じ通貨の同じ値。 */
export function rowPrints(e) {
  const ds = districtKeys(e);
  const at = (ds.length ? ds : ['']).map(d => `${urlOf(e)}|${d}|${e.currency || ''}`);
  if (e.key === 'rent' && isObj(e.value)) return at.flatMap(p => Object.entries(e.value).map(([k, v]) => `${p}|rent|${k}|${canon(v)}`));
  return at.map(p => `${p}|${e.key}|${canon(e.value)}`);
}
/**
 * 新しい行 e が、その街の行 list の中でどうなるか（自分と同じパック・同じ ID の行は見ない）。
 *   same    ＝ どの部屋も同じ額の行が在る（rows ＝ その行。新しい行は作らず、その行に「見た」を足す）
 *   partial ＝ 一部の部屋だけ同じ額の行が在る（入れると同じ額が2つの行に載る）
 *   differs ＝ 同じ部屋で額の違う行が在る（other ＝ その行）
 *   none    ＝ 同じ行は無い
 */
export function twinOf(list, e) {
  const near = (list || []).filter(r => r.key === e.key && urlOf(r) === urlOf(e) && sameDistrict(r, e) && !(r.id === e.id && r.pack === e.pack));
  if (e.key !== 'rent' || !isObj(e.value)) {
    const rows = near.filter(r => canon(r.value) === canon(e.value));
    return { status: rows.length ? 'same' : 'none', rows, other: null };
  }
  const rows = [];
  let covered = 0, other = null;
  for (const [k, v] of Object.entries(e.value)) {
    const hit = near.filter(r => isObj(r.value) && r.value[k] !== undefined);
    const eq = hit.find(r => canon(r.value[k]) === canon(v));
    if (eq) { covered++; if (!rows.includes(eq)) rows.push(eq); }
    else if (hit.length && !other) other = hit[0];
  }
  const n = Object.keys(e.value).length;
  return { status: other ? 'differs' : n && covered === n ? 'same' : covered ? 'partial' : 'none', rows, other };
}
/**
 * 同じ資料・同じ値の行が2つ以上の街に在るとき（拠点の書き方が違うだけ ── 例「Dallas」と「Dallas/Fort Worth」）、どの記録が「よその街」か。
 * つながった街のまとまりごとに、その行を持つパックの数がいちばん多い街が1つだけなら、そこが行の街。ほかの街の記録は競合
 * （この会社をどの街につなぐかはオーナーが決める）。いちばん多い街が2つ以上なら、どの街の記録も競合。返すのは「パック 記録」→ 理由。
 */
export function awayRows(items) {
  const fp = new Map();
  for (const it of items) for (const f of rowPrints(it.e)) {
    const m = fp.get(f) || fp.set(f, new Map()).get(f);
    const ps = m.get(it.city) || m.set(it.city, new Set()).get(it.city);
    ps.add(it.pack);
    for (const s of it.e.seen || []) ps.add(s.pack);
  }
  const up = new Map();
  const find = c => { while (up.has(c) && up.get(c) !== c) c = up.get(c); return c; };
  const shared = [...fp.values()].filter(m => m.size > 1);
  for (const m of shared) { const [a, ...rest] = [...m.keys()].map(find); for (const b of rest) if (a !== b) up.set(b, a); }
  const packs = new Map();
  for (const m of shared) for (const [c, ps] of m) { const g = find(c); const per = packs.get(g) || packs.set(g, new Map()).get(g); per.set(c, new Set([...(per.get(c) || []), ...ps])); }
  const res = new Map();
  for (const it of items) {
    const m = rowPrints(it.e).map(f => fp.get(f)).find(x => x.size > 1);
    if (!m) continue;
    const per = packs.get(find(it.city));
    const best = Math.max(...[...per.values()].map(s => s.size));
    const tops = [...per].filter(([, s]) => s.size === best).map(([c]) => c);
    if (tops.length === 1 && tops[0] === it.city) continue;
    const others = [...per.keys()].filter(c => c !== it.city);
    res.set(`${it.pack} ${it.e.id}`, `同じ資料・同じ値の行が別の街（${others.join('・')}）にも在る ── 街は1つ。この会社をどの街につなぐかを決める`);
  }
  return res;
}

function urlOk(u) { return typeof u === 'string' && /^https:\/\/\S+$/.test(u); }

/** 記録を、入れるときに書く形にする（パックの意味を落とさない。画面の字は会社ページを作る回が決める）。 */
function entryOf(pack, r, srcById, use, extra = {}) {
  const ev = (r.evidence || []).map(e => ({ source_id: e.source_id, locator: e.locator ?? null, quote: e.quote, supports: e.supports || [] }));
  const ids = [...new Set(ev.map(e => e.source_id))];
  const src = ids.map(id => srcById.get(id)).filter(Boolean).map(s => ({
    source_id: s.source_id, source_type: s.source_type, publisher_kind: s.publisher_kind, publisher: s.publisher, title: s.title,
    url: s.url ?? null, published: s.published ?? null, retrieved: s.retrieved ?? null, ...(s.updated ? { updated: s.updated } : {}),
  }));
  const at = Object.fromEntries(Object.entries(r.applies_to || {}).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)));
  return sortDeep({
    id: r.record_id, pack: pack.pack_id, rev: pack.pack_revision, company: r.company_id, domain: r.domain, key: r.item,
    label_ja: r.label_ja ?? null, value: r.value ?? null, value_text: r.value_text ?? null,
    unit: r.unit ?? null, currency: r.currency ?? null, per: r.per ?? null, cond_ja: r.cond_ja ?? null,
    info_kind: r.info_kind ?? null, applies_to: at, amount: r.amount ?? null, effective: r.effective ?? null,
    use, evidence: ev, src, checked_at: (r.verification || {}).checked_at ?? null,
    ...(r.relation && r.relation.type && r.relation.type !== 'new' ? { relation: { type: r.relation.type, targets: r.relation.target_record_ids || [], ref: r.relation.target_existing_ref || null } } : {}),
    ...extra,
  });
}
/** 記録の中身の指紋 ＝ パックの記録そのもの（版の番号は除く）と使い方。ほかのパックとの関係（同じ行の相手）では変わらない。 */
const hashOf = (r, use) => sha(canon({ r, use })).slice(0, 16);

/** 給与の額（年額・元の通貨）を万円の [下, 上] に。比べられない記録は null。 */
function payRange(r, J) {
  const a = r.amount || {};
  if (r.per !== 'year' || !r.currency || !J[r.currency]) return null;
  if (['upper', 'lower', 'target'].includes(a.stat) || r.info_kind === 'operator_estimate') return null;
  const v = r.value;
  const nums = typeof v === 'number' ? [v] : Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number') ? v : null;
  if (!nums) return null;
  const toMan = x => (x * J[r.currency]) / 10000;
  return [toMan(Math.min(...nums)), toMan(Math.max(...nums))];
}

/**
 * パック（いくつでも）を、今の台帳と取り込みの台帳に比べて分ける。
 * 返すのは記録ごとの { id, pack, company, cat, why[], target, use, entry, auto, pay_gap? } と、パックごとのまとめ。
 */
export function classify(packs, L, store, fm, opts = {}) {
  const out = [], perPack = [];
  const master = new Set([...Object.keys(L.SALARY), ...Object.keys(L.OPS || {})]);
  const skip = new Set(opts.skip || []);
  const decisions = opts.decisions || null;
  const changedLedgers = opts.changedLedgers || new Set();
  const citySite = new Map();      // 街 → 家賃の出どころの URL の主（最初の1つ）
  const recs = [];

  for (const { pack, validation, file } of packs) {
    const info = { pack_id: pack.pack_id, revision: pack.pack_revision, file: path.basename(file || ''), test_only: !!pack.test_only,
      contract_version: pack.contract_version, converted_from: pack.converted_from || null, validator_ok: validation.ok,
      errors: validation.errors.length, warnings: validation.warnings.length, records: (pack.records || []).length, skipped: false };
    const companies = [...new Set((pack.records || []).map(r => r.company_id))];
    if (companies.length && companies.every(c => skip.has(c))) { info.skipped = true; perPack.push(info); continue; }
    const before = store.packs[pack.pack_id];
    if (before && pack.pack_revision < before.revision) info.older = before.revision;
    perPack.push(info);
    const srcById = new Map((pack.sources || []).map(s => [s.source_id, s]));
    const errAt = new Map();
    for (const e of validation.errors) {
      const m = String(e.path || '').match(/^records\[(\d+)\]/);
      if (m) errAt.set(+m[1], [...(errAt.get(+m[1]) || []), e.message]);
    }
    const shapeError = !validation.ok && (validation.stage === 'shape' || [...errAt.keys()].length === 0);
    const inConflict = new Map();
    for (const c of pack.conflicts || []) for (const id of c.record_ids || []) inConflict.set(id, c);
    (pack.records || []).forEach((r, i) => recs.push({ pack, r, i, srcById, errAt, shapeError, inConflict, info }));
  }

  /* 1〜3：記録ひとつで決まる分類（形式エラー・対象不明・根拠不足）と置き場。4〜7 はほかの記録と比べるので、全部そろってから。 */
  const staged = [];
  for (const { pack, r, i, srcById, errAt, shapeError, inConflict, info } of recs) {
    const why = [];
    const dec = decisions ? decisions.get(r.record_id) : null;
    const use = dec ? (USE[dec.publication_class] || '未指定') : (r.value === null ? '空欄' : '未指定');
    const st = { cat: null };
    let target = null, extra = {};
    const company = r.company_id;
    /* どの順で当たっても、表の上の分類が勝つ（CATS の並び） */
    const setCat = (c, w) => { if (!st.cat || CATS.indexOf(c) < CATS.indexOf(st.cat)) st.cat = c; if (w) why.push(w); };

    /* 1 形式エラー */
    if (shapeError) setCat('format_error', 'パックの形のエラー（検査）');
    if (errAt.has(i)) setCat('format_error', `検査のエラー: ${errAt.get(i).join(' ／ ')}`);
    /* 記録にエラーが無くても、エラーの残るパックからは1件も入れない（差分までは出す） */
    const blocked = !info.validator_ok ? 'パックに検査のエラーが残っている（直した出し直しを待つ・1件も入れない）' : null;
    if (info.older) setCat('format_error', `取り込み済みの版（${info.older}）より古い版`);
    if (pack.test_only && !opts.test) setCat('format_error', 'test_only のパック（取り込まない）');
    if (!['pay', 'profile', 'base', 'scale', 'fleet', 'work', 'benefits', 'jobs', 'destinations', 'living'].includes(r.domain))
      setCat('format_error', `パックでは書けない分野（${r.domain}）`);

    /* 2 対象不明（置き場） */
    const row = fieldRow(fm, r), placed = PLACED[`${r.domain}|${r.item}`];
    if (!master.has(company)) setCat('target_unknown', '会社が一覧に無い');
    else if (r.domain === 'pay' && !L.SALARY[company]) setCat('target_unknown', '年収の台帳に無い会社');
    if ((r.relation || {}).type === 'retracts') {
      const t = ((r.relation || {}).target_record_ids || []).map(id => whereIs(store, id)).find(Boolean);
      if (t) target = t; else setCat('target_unknown', '取り下げる相手の記録が、取り込みの台帳に無い');
    }
    else if (r.value === null || r.value === undefined) setCat('target_unknown', `値が無い記録（${(r.missing || {}).reason || '理由なし'}）── 空欄のまま・今の値を消さない`);
    else if (r.domain === 'pay') target = `SOURCES.${company}`;
    else if (r.item_is_new && !placed) setCat('target_unknown', `新しい項目（${r.item}）── 置き場がまだ無い`);
    else if (!placed && (!row || row.fillable_by_pack !== 'yes')) setCat('target_unknown', `項目「${r.item}」は${row ? '受け取り候補（置き場がまだ無い）' : 'field-map に無い'}`);
    else if (FACT_DOMAINS.includes(r.domain)) target = `FACTS.${company}.${r.domain}`;
    else if (r.domain === 'destinations') {
      const code = typeof r.value === 'string' ? r.value : '';
      if (!L.PLACES[code]) setCat('target_unknown', `空港 ${code || '?'} の呼び名が台帳（PLACES）に無い`);
      else target = `NETWORK.${company}.${r.item === 'operated_airport' ? 'list' : 'held'}`;
    } else if (r.domain === 'living') {
      const city = cityKey((r.applies_to || {}).base, L);
      if (!city) setCat('target_unknown', `街が決まらない（拠点「${(r.applies_to || {}).base || ''}」）`);
      else {
        const part = r.item === 'rent' ? 'rents' : r.item === 'commute' ? 'commute' : 'towns';
        target = `LIVING.${city}.${part}`;
        extra = { city, district: districtOf(r.cond_ja), district_en: enOf(r.cond_ja) };
      }
    }

    /* 3 根拠不足 */
    const ev = r.evidence || [];
    const valueEv = ev.filter(e => (e.supports || []).some(s => s === 'value' || s === 'estimate_input' || s === 'absence'));
    const evSrc = ev.map(e => srcById.get(e.source_id)).filter(Boolean);
    if (r.value !== null && r.value !== undefined) {
      if ((r.verification || {}).status !== 'confirmed') setCat('weak_evidence', `確認の状態が confirmed でない（${(r.verification || {}).status}）`);
      if (!valueEv.length || valueEv.some(e => !String(e.quote || '').trim())) setCat('weak_evidence', '値を支える引用が無い');
      if (!valueEv.length || valueEv.some(e => !urlOk((srcById.get(e.source_id) || {}).url))) setCat('weak_evidence', '値を支える資料に URL が無い');
      if (['published_policy', 'published_statistic'].includes(r.info_kind) && evSrc.length && evSrc.every(s => SECONDARY.has(s.source_type))
          && !(r.domain === 'living' && evSrc.every(s => PRIMARY_FOR_LIVING.has(s.publisher_kind))))
        setCat('weak_evidence', '二次情報だけで「公表された」と名乗っている');
      if (r.domain === 'living' && r.item === 'rent' && isObj(r.value)) {
        const layout = {};
        const terms = [...String(r.cond_ja || '').matchAll(/原部屋表記「([^」]*)」/g)].map(m => m[1]);
        for (const k of Object.keys(r.value)) {
          const word = LAYOUT.pack[k];
          if (!word) { setCat('target_unknown', `部屋の型「${k}」を読めない（資料の言い方のまま）`); continue; }
          layout[PACK_TO_LEDGER_KEY[k]] = { word, pack_key: k };
        }
        if (terms.length && Object.keys(r.value).length === 1) {
          const [k] = Object.keys(r.value);
          const w = readTerm(terms[0]);
          if (w && LAYOUT.pack[k] && w !== LAYOUT.pack[k]) setCat('weak_evidence', `部屋の型が資料の言い方と合わない（資料「${terms[0]}」＝${w}／パック ${k}）`);
          if (layout[PACK_TO_LEDGER_KEY[k]]) layout[PACK_TO_LEDGER_KEY[k]].term = terms[0];
          if (!w) why.push(`型の原文「${terms[0]}」は表で読めない（パックの鍵のまま）`);
        }
        extra.layout = layout;
      }
    }

    const entry = entryOf(pack, r, srcById, use, extra);
    staged.push({ pack, r, inConflict, why, use, st, setCat, company, target, extra, evSrc, blocked, entry, h: hashOf(r, use) });
  }

  /* 暮らし：比べる相手の行 ＝ 取り込みの台帳に在る行 ＋ この plan で前に出た行（入れられる見込みのある記録だけ） */
  const canGoIn = x => !!x.target && x.target.startsWith('LIVING.') && !['format_error', 'target_unknown', 'weak_evidence'].includes(x.st.cat) && !x.blocked;
  const storeRows = Object.entries(store.LIVING || {}).flatMap(([c, C]) => ['rents', 'commute', 'towns'].flatMap(k => (C[k] || []).map(e => ({ city: c, pack: e.pack, e }))));
  const away = awayRows([...storeRows, ...staged.filter(canGoIn).map(x => ({ city: x.extra.city, pack: x.pack.pack_id, e: x.entry }))]);
  const cityRows = new Map();
  for (const { city, e } of storeRows) cityRows.set(city, [...(cityRows.get(city) || []), e]);

  /* 4 競合 ／ 5 訂正候補 ／ 6 既存と一致 ／ 7 追加 */
  for (const x of staged) {
    const { pack, r, inConflict, why, use, st, setCat, company, target, extra, evSrc, blocked, entry, h } = x;
    if (inConflict.has(r.record_id)) setCat('conflict', `資料どうしの食い違い（${inConflict.get(r.record_id).conflict_id}）`);
    const stored = findStored(store, r.record_id, pack.pack_id);
    /* 中身（記録そのもの）は同じで、調べた側の「使い方」だけが変わった ── 例「参考」→「条件つき」。競合にせず、最新の判断に書き換える
       （「保留」になったものは出さなくなる＝厳しい側へ動くだけ）。2026-10-20、ROUND4 で 585件がこれで競合に落ちていた。 */
    const relabel = stored && stored.h !== h ? [...new Set([...USES, '未指定'])].find(u => u !== use && hashOf(r, u) === stored.h) : undefined;
    if (stored && stored.h !== h && relabel === undefined) setCat('conflict', '取り込み済みの記録が、同じ ID で中身が変わって届いた');
    const rel = r.relation || { type: 'new' };
    if (['corrects', 'supersedes', 'retracts', 'contradicts'].includes(rel.type)) {
      if (rel.type === 'contradicts') setCat('conflict', `今の値と食い違う（${rel.target_existing_ref || (rel.target_record_ids || []).join(',')}）`);
      else setCat('correction', `${rel.type}: ${(rel.target_record_ids || []).join(',') || rel.target_existing_ref || ''}`);
    }
    if (target && target.startsWith('LIVING.')) {
      const city = extra.city;
      const hand = city === 'abudhabi' || L.LIVING[city];
      if (hand && changedLedgers.has('living-facts.mjs')) setCat('conflict', `街「${city}」は先行の会社の台帳に在り、調べのあいだに台帳が変わっている（黙って足さない）`);
      else if (hand) setCat('conflict', `街「${city}」は先行の会社の台帳に在る（出どころ・地区の選び方が違う）`);
      /* 1つの街に家賃の出典は1つ ── 比べるのは画面に出しうる記録どうしだけ（保留・空欄・未指定の記録は出典の席を取らない）。
         2026-10-21（a2）：空港の呼び名を足すと、日本語の拠点名（「ベルリン」）の記録も街が決まるようになり、保留の記録が先に席を取って、
         取り込み済みの記録（Eurostat のベルリン）を「2つめの出典」として競合にしていた。 */
      if (r.item === 'rent' && !['保留', '空欄', '未指定'].includes(use)) {
        const host = (evSrc[0] && evSrc[0].url ? String(evSrc[0].url).replace(/^https?:\/\/([^/]+).*$/, '$1') : '');
        if (!citySite.has(city)) citySite.set(city, host);
        else if (citySite.get(city) !== host) setCat('conflict', `同じ街に2つめの家賃の出どころ（${citySite.get(city)} と ${host}）── 1つの街に出典は1つ`);
      }
      /* 街は1つ・同じ行は1つ（家賃は部屋の型ごと・地区の書き方の違いは見ない） */
      const t = twinOf(cityRows.get(city) || [], entry);
      if (t.status === 'same') setCat('matches', `同じ街・同じ地区・同じ資料の行が別の記録に在る（${t.rows.map(y => y.id).join('・')}）`);
      else if (t.status === 'differs') setCat('conflict', `同じ街・同じ地区・同じ資料で額が違う（${t.other.id}）`);
      else if (t.status === 'partial') setCat('conflict', `一部の部屋の型だけ同じ額の行が在る（${t.rows.map(y => y.id).join('・')}）── 同じ額を2つの行に置かない`);
      const far = away.get(`${pack.pack_id} ${r.record_id}`);
      if (far) setCat('conflict', far);
      if (canGoIn(x)) cityRows.set(city, [...(cityRows.get(city) || []), entry]);
    }
    let basis = null;
    if (r.domain === 'pay' && st.cat !== 'format_error' && L.BASIS[company]) {
      const rank = (r.applies_to || {}).rank;
      const kind = (r.amount || {}).kind;
      const B = L.BASIS[company];
      const groups = (B[rank] || {}).groups || [];
      const same = groups.filter(g => kind && g[kind] !== undefined);
      if (same.length && B.cur === r.currency && typeof r.value === 'number') {
        if (same.some(g => g[kind] === r.value)) { setCat('matches', `年収の根拠の台帳の ${rank}・${kind} と同じ額`); basis = 'matches'; }
        else { setCat('correction', `年収の根拠の台帳の ${rank}・${kind}（${same.map(g => `${num(g[kind])} ${B.cur}「${g.name || ''}」`).join('・')}）と違う額（時期・条件が違うだけかもしれない）`); basis = 'correction'; }
      }
    }
    if (stored && stored.h === h) setCat('matches', '取り込み済み（同じ中身）');
    if (relabel !== undefined) setCat('matches', `取り込み済み（中身は同じ・使い方だけ ${relabel}→${use}）`);
    if (!st.cat) setCat('addition', '');
    if (blocked) why.push(blocked);
    out.push({ id: r.record_id, pack: pack.pack_id, rev: pack.pack_revision, company, domain: r.domain, item: r.item, cat: st.cat, why, target, use,
      h, entry, test_only: !!pack.test_only, ...(basis ? { basis } : {}), ...(blocked ? { blocked: true } : {}), ...(relabel !== undefined && st.cat === 'matches' ? { relabel } : {}), _r: r });
  }

  /* 給与：同じ会社・同じ職位の、年額で比べられる記録の幅が、サイトの推定年収（SALARY）の平均から 25% を超えて離れていたら、決まりでは入れない。 */
  const groups = new Map();
  for (const x of out) {
    if (x.domain !== 'pay' || !L.SALARY[x.company] || !['条件つき', '過去'].includes(x.use)) continue;
    if (!PAY_GAP_KINDS.has((x._r.amount || {}).kind)) continue;
    const at = x._r.applies_to || {};
    const rank = at.rank;
    /* 職位の書いていない、パイロットだけの平均・中央値は「乗員全体」として、機長と副操縦士の平均の中間と比べる（目安） */
    const crewMean = !rank && at.pilot_specific === true && ['average', 'median'].includes((x._r.amount || {}).stat);
    const g = RANKS_PAY.includes(rank) ? rank : rank === 'crew' || crewMean ? 'crew' : null;
    const rg = g && payRange(x._r, L.JPY_PER);
    if (!rg) continue;
    const k = `${x.company}|${g}`;
    groups.set(k, [...(groups.get(k) || []), [x, rg]]);
  }
  const payGroups = [];
  for (const [k, list] of groups) {
    const [company, g] = k.split('|');
    const S = L.SALARY[company];
    const site = g === 'crew' ? (S.cap && S.fo ? (S.cap.avg + S.fo.avg) / 2 : null) : (S[g] || {}).avg;
    if (!site) continue;
    const lo = Math.min(...list.map(([, r]) => r[0])), hi = Math.max(...list.map(([, r]) => r[1]));
    const end = site < lo ? lo : site > hi ? hi : site;
    const gap = (end - site) / site;
    const pg = { company, rank: g, ids: list.map(([x]) => x.id), lo: Math.round(lo), hi: Math.round(hi), site: Math.round(site), gap: Math.round(gap * 1000) / 10, over: Math.abs(gap) > PAY_GAP };
    payGroups.push(pg);
    for (const [x] of list) x.pay_gap = pg;
  }

  /* オーナーの決まり（2026-10-19）：検査に通り・保留でなく・「追加」か「既存と一致」で・給与の差が 25% 以内のものだけ。 */
  for (const x of out) {
    x.auto = (x.relabel !== undefined || (['addition', 'matches'].includes(x.cat) && USES.has(x.use) && !['保留', '空欄'].includes(x.use) && !(x.pay_gap && x.pay_gap.over)))
      && !x.blocked && (!x.test_only || !!opts.test);
    delete x._r;
  }
  return { records: out, packs: perPack, payGroups };
}

/** 取り込みの台帳のどこに、その記録が在るか（'FACTS.<会社>.<分野>' の形）。無ければ null。 */
function whereIs(store, id) {
  for (const [s, a] of Object.entries(store.FACTS)) for (const [k, l] of Object.entries(a)) if (l.some(e => e.id === id)) return `FACTS.${s}.${k}`;
  for (const [s, a] of Object.entries(store.NETWORK)) for (const [k, l] of Object.entries(a)) if (l.some(e => e.id === id)) return `NETWORK.${s}.${k}`;
  for (const [c, C] of Object.entries(store.LIVING)) for (const k of ['rents', 'commute', 'towns']) if ((C[k] || []).some(e => e.id === id)) return `LIVING.${c}.${k}`;
  for (const [s, l] of Object.entries(store.SOURCES)) if (l.some(e => e.id === id)) return `SOURCES.${s}`;
  return null;
}

function findStored(store, id, packId) {
  const p = store.packs[packId];
  if (!p || !p.records || !p.records[id]) return null;
  return { h: p.records[id] };
}

/* ════════════ plan ════════════ */
function packFiles(arg) {
  const st = fs.statSync(arg);
  if (st.isDirectory()) return fs.readdirSync(arg).filter(f => f.endsWith('.json')).sort().map(f => path.join(arg, f));
  return [arg];
}

function readPack(file, tmpDir) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const { pack, log } = convert110(raw);
  let checkFile = file;
  if (pack !== raw) {
    checkFile = path.join(tmpDir, path.basename(file));
    fs.writeFileSync(checkFile, JSON.stringify(pack));
  }
  return { pack, log, checkFile, sha: 'sha256:' + sha(fs.readFileSync(file)).slice(0, 16) };
}

function readDecisions(file) {
  if (!file) return null;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Map(list.map(d => [d.record_id, d]));
}

export async function plan(args) {
  const root = path.resolve(args.root || HERE);
  const contract = args.contract;
  const validator = args.validator || (contract && path.join(contract, 'tools', 'validate_pack.py'));
  const fmFile = args.fieldmap || (contract && path.join(contract, 'field-map.csv'));
  const baseFile = args.baseline || (contract && path.join(contract, 'baseline.json'));
  if (!fmFile || !fs.existsSync(fmFile)) fail('field-map.csv が無い（--contract か --fieldmap）');
  const files = packFiles(args._[1]);
  const outDir = path.resolve(args.out || path.dirname(files[0]));
  for (const no of [root, HERE]) if (inside(real(outDir), real(no)) || inside(outDir, no)) fail(`書き出し先がリポジトリの中（${path.basename(outDir)}）── plan はリポジトリの外にだけ書く`);
  const L = await loadLedgers(root);
  const { store } = readStore(root);
  const fm = readFieldMap(fmFile);
  let changed = new Set(), baseline = null;
  if (baseFile && fs.existsSync(baseFile)) {
    baseline = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
    for (const [f, p] of Object.entries(baseline.ledger_files || {})) if (L.prints[f] && L.prints[f] !== p) changed.add(f);
  }
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(require_tmp()), 'pv-import-'));
  const packs = [];
  const convLog = [];
  try {
    for (const f of files) {
      const { pack, log, checkFile, sha: s } = readPack(f, tmp);
      convLog.push(...log.map(l => `${path.basename(f)}: ${l}`));
      const validation = runValidator(validator, checkFile, args.today);
      packs.push({ pack, validation, file: f, sha: s });
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const decisions = readDecisions(args.decisions);
  const skip = (args.skip || '').split(',').filter(Boolean);
  const res = classify(packs, L, store, fm, { decisions, skip, changedLedgers: changed, test: !!args.test });
  const made_on = args.today || new Date().toISOString().slice(0, 10);
  const body = {
    format: 1, made_on, root_prints: L.prints, baseline_id: baseline ? baseline.baseline_id : null, changed_since_baseline: [...changed],
    packs: res.packs.map(p => ({ ...p, sha: (packs.find(x => x.pack.pack_id === p.pack_id) || {}).sha })),
    validator: packs[0] ? { version: packs[0].validation.validator_version, contract_version: packs[0].validation.contract_version } : null,
    conversions: convLog, skip, pay_groups: res.payGroups, records: res.records,
  };
  const planObj = { ...body, checksum: sha(canon(body)) };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'import-plan.json'), JSON.stringify(planObj, null, 1));
  fs.writeFileSync(path.join(outDir, 'auto-approved.txt'), res.records.filter(x => x.auto).map(x => `${x.pack} ${x.id}`).join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'owner-list.txt'), ownerList(planObj, L));
  fs.writeFileSync(path.join(outDir, 'owner-list-all.tsv'), ownerTable(planObj, L));
  const n = c => res.records.filter(x => x.cat === c).length;
  console.log(`plan: ${res.packs.length}パック（とばした ${res.packs.filter(p => p.skipped).length}）・記録 ${res.records.length}件`);
  console.log('  ' + CATS.map(c => `${CAT_JA[c]} ${n(c)}`).join('／'));
  console.log(`  決まりで入れてよい: ${res.records.filter(x => x.auto).length}件 → auto-approved.txt`);
  console.log(`  書いた場所: ${path.basename(outDir)}/（import-plan.json・auto-approved.txt・owner-list.txt・owner-list-all.tsv）── リポジトリの外`);
  return planObj;
}
function require_tmp() { return os.tmpdir(); }

/* ════════════ オーナーの一覧（日本語・短く）════════════ */
const man0 = x => `${Math.round(x).toLocaleString('en-US')}万円`;
const PER_JA = { year: '年', month: '月', hour: '時間', day: '日', block_hour: 'ブロック時間', sector: '区間', one_off: '1回' };
const num = x => typeof x === 'number' ? x.toLocaleString('en-US') : String(x);
/** 値を短く（元の通貨・元の単位のまま。円に直さない）。長いときは数の途中で切らない（区切りの手前まで戻して「…」・単位は残す）。 */
export function valueShort(e, max = 90) {
  const v = e.value;
  const s = isObj(v) ? Object.entries(v).map(([k, x]) => `${k} ${Array.isArray(x) ? x.map(num).join('〜') : num(x)}`).join('・')
    : Array.isArray(v) ? v.map(num).join('〜') : num(v);
  const numeric = typeof v === 'number' || Array.isArray(v) || isObj(v);
  const unit = !numeric ? '' : e.currency ? ` ${e.currency}` : e.unit ? `${/^[\x20-\x7e]/.test(String(e.unit)) ? ' ' : ''}${e.unit}` : '';
  const tail = `${unit}${e.per ? `/${PER_JA[e.per] || e.per}` : ''}`;
  if (s.length + tail.length <= max) return s + tail;
  const cut = s.slice(0, Math.max(0, max - tail.length - 1));
  const at = cut.lastIndexOf('・') > 0 ? cut.lastIndexOf('・') : Math.max(cut.lastIndexOf('〜'), cut.lastIndexOf(' '), cut.lastIndexOf('、'));
  return `${(at > 0 ? cut.slice(0, at) : cut.replace(/[\d.,]+$/, '')).replace(/[・〜、\s]+$/, '')}…${tail}`;
}
const srcDate = e => { const s = (e.src || [])[0] || {}; return s.published || (s.retrieved ? `${s.retrieved} に開いた` : '日付なし'); };
const RANK_JA = { cap: '機長', fo: '副操縦士', crew: '乗員全体' };
const ITEM_JA = { rent: '家賃', commute: '足', town_candidate: '住宅地' };

export function ownerList(p, L) {
  const R = p.records;
  const by = c => R.filter(x => x.cat === c);
  const lines = [];
  const name = id => (L.SALARY[id] || (L.OPS || {})[id] || {}).ja || id;
  const names = list => { const n = [...new Set(list.map(x => name(x.company)))]; return n.length > 3 ? `${n.slice(0, 3).join('・')} ほか${n.length - 3}社` : n.join('・'); };
  lines.push(`調査パックの取り込み ── オーナーに見てほしいもの（${p.made_on} に作った一覧。まだ何も入れていない）`);
  lines.push('決まり（2026-10-19 オーナー）：検査に通り・保留でなく・「追加」か「既存と一致」の記録だけを入れる。それ以外はこの一覧へ。');
  lines.push('サイトの推定年収（salary-data.mjs）は変えない。会員のデータには触らない。');
  lines.push('');
  const skipped = p.packs.filter(x => x.skipped).map(x => x.pack_id);
  lines.push(`■ 数 ── パック ${p.packs.length}（別に置いた ${skipped.length}${skipped.length ? `：${skipped.join('・')}` : ''}）・記録 ${R.length}件`);
  lines.push('  ' + CATS.map(c => `${CAT_JA[c]} ${by(c).length}`).join('／'));
  const auto = R.filter(x => x.auto);
  lines.push(`  決まりで入れる：${auto.length}件（追加 ${auto.filter(x => x.cat === 'addition').length}・既存と一致 ${auto.filter(x => x.cat === 'matches').length}）`);
  const held = R.filter(x => ['addition', 'matches'].includes(x.cat) && x.use === '保留').length;
  const gap = R.filter(x => ['addition', 'matches'].includes(x.cat) && x.pay_gap && x.pay_gap.over).length;
  lines.push(`  「追加・既存と一致」でも決まりでは入れない：保留 ${held}件・給与の差が25%を超える ${gap}件`);
  const rl = R.filter(x => x.relabel !== undefined);
  if (rl.length) {
    const t = new Map(); for (const x of rl) { const k = `${x.relabel}→${x.use}`; t.set(k, (t.get(k) || 0) + 1); }
    lines.push(`  中身は同じで使い方だけが変わった：${rl.length}件（${[...t].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('・')}）── 調べた側の最新の判断に書き換える（決まりで入れる数に入っている）`);
  }
  lines.push('');

  lines.push('■ 1. 決めてほしいもの（1行＝1件：会社／何／サイトの今／パック／資料の日付）');
  let k = 0;
  const done = new Set();
  for (const pg of p.pay_groups.filter(g => g.over)) {
    const S = L.SALARY[pg.company];
    const now = pg.rank === 'crew' ? `推定年収 機長${S.cap.avg.toLocaleString('en-US')}万・副${S.fo.avg.toLocaleString('en-US')}万（中間${man0(pg.site)}）` : `推定年収の平均 ${man0(pg.site)}`;
    const recs = R.filter(x => pg.ids.includes(x.id) && x.company === pg.company);
    recs.forEach(x => done.add(x));
    lines.push(`  ${++k}. ${name(pg.company)}／給与（${RANK_JA[pg.rank]}・${recs.length}件：${recs.map(x => x.entry.label_ja || x.id).join('／')}）／${now}／${recs.map(x => valueShort(x.entry)).join('・')}＝約${man0(pg.lo)}${pg.hi !== pg.lo ? `〜${man0(pg.hi)}` : ''}（差 ${pg.gap > 0 ? '+' : ''}${pg.gap}%）／${[...new Set(recs.map(x => srcDate(x.entry)))].join('・')}`);
  }
  for (const x of by('correction')) {
    done.add(x);
    lines.push(`  ${++k}. ${name(x.company)}／${x.entry.label_ja || x.item}／${x.why.filter(Boolean).join('／')}／${valueShort(x.entry)}／${srcDate(x.entry)}`);
  }
  /* 資料どうしの食い違い：1つの食い違い ＝ 1行。ほかの分類に入った側も（分類の名前をつけて）並べる */
  const cf = new Map();
  for (const x of R) { const m = x.why.join('').match(/資料どうしの食い違い（([^）]+)）/); if (m) cf.set(m[1], [...(cf.get(m[1]) || []), x]); }
  const side = x => `${x.entry.label_ja || x.id}${x.cat === 'conflict' ? '' : `（${CAT_JA[x.cat]}）`}`;
  const cfIdle = [];
  for (const [id, list] of cf) {
    if (!list.some(x => x.cat === 'conflict')) { cfIdle.push(id); continue; }
    list.forEach(x => done.add(x));
    lines.push(`  ${++k}. ${name(list[0].company)}／資料どうしの食い違い（${id}）：${list.map(side).join(' ｜ ')}／サイトにはまだ無い／${list.map(x => valueShort(x.entry)).join(' ｜ ')}／${[...new Set(list.map(x => srcDate(x.entry)))].join('・')}`);
  }
  /* 先行の会社の街へ入る記録：街ごと・地区ごとに1行 */
  const hc = new Map();
  for (const x of by('conflict').filter(x => !done.has(x) && /先行の会社の台帳に在/.test(x.why.join('')))) {
    const kk = `${x.target.split('.')[1]}|${x.entry.district || ''}`;
    hc.set(kk, [...(hc.get(kk) || []), x]);
  }
  const changedLF = (p.changed_since_baseline || []).includes('living-facts.mjs');
  for (const [kk, list] of hc) {
    list.forEach(x => done.add(x));
    const [city, dist] = kk.split('|');
    const C = L.LIVING[city] || {};
    const now = `${C.city_ja || city}の台帳は ${(C.rents || []).map(r => r.ja).join('・')}（${((L.LIVING[city] || {}).site) || ''}）${changedLF ? '。調べのあいだに台帳が変わった' : ''}`;
    const uniq = [...new Map(list.map(x => [canon([x.item, x.entry.value]), x])).values()];
    lines.push(`  ${++k}. ${names(list)}／${C.city_ja || city}「${dist}」の暮らし ${list.length}件（同じ中身 ${uniq.length}件：${uniq.map(x => `${ITEM_JA[x.item] || x.item} ${valueShort(x.entry)}`).join('・')}）／${now}／先行の会社の街なので決まりでは入れない／${[...new Set(list.map(x => srcDate(x.entry)))].join('・')}`);
  }
  /* 同じ行が2つの街に（拠点の書き方が違うだけ）：会社・街ごとに1行 */
  const aw = new Map();
  for (const x of by('conflict').filter(x => !done.has(x) && /にも在る ── 街は1つ/.test(x.why.join('')))) {
    const kk = `${x.company}|${x.target.split('.')[1]}`;
    aw.set(kk, [...(aw.get(kk) || []), x]);
  }
  for (const [, list] of aw) {
    list.forEach(x => done.add(x));
    const m = list.map(x => x.why.join('').match(/別の街（([^）]+)）にも在る/)).find(Boolean);
    const others = m ? m[1].split('・') : [];
    const there = others.map(c => `${c}（${names(R.filter(y => y.auto && y.target && y.target.startsWith(`LIVING.${c}.`))) || '決まりで入る会社なし'}）`).join('・');
    lines.push(`  ${++k}. ${name(list[0].company)}／拠点「${(list[0].entry.applies_to || {}).base || ''}」の暮らし ${list.length}件（${list.map(x => `${ITEM_JA[x.item] || x.item} ${valueShort(x.entry)}`).join('・')}）／同じ資料・同じ値の行が別の街 ${there}に在る（街は1つ）／この会社をどの街につなぐかを決める／${[...new Set(list.map(x => srcDate(x.entry)))].join('・')}`);
  }
  for (const x of by('conflict').filter(x => !done.has(x))) {
    lines.push(`  ${++k}. ${name(x.company)}／${x.entry.label_ja || x.item}／競合：${x.why.filter(Boolean).join('／')}／${valueShort(x.entry)}／${srcDate(x.entry)}`);
  }
  if (!k) lines.push('  なし');
  lines.push('');

  const group = (list, keyf) => { const m = new Map(); for (const x of list) { const kk = keyf(x); m.set(kk, [...(m.get(kk) || []), x]); } return [...m].sort((a, b) => b[1].length - a[1].length); };
  const tu = by('target_unknown').filter(x => !/^値が無い/.test(x.why.find(Boolean) || ''));
  lines.push(`■ 2. 置き場がまだ無いもの（${tu.length}件。項目ごと。置き場を作るかを決める。入れない）`);
  const gs = group(tu, x => (x.why.find(Boolean) || '').replace(/空港 \S+ の/, '空港の'));
  for (const [why, list] of gs.slice(0, 15)) lines.push(`  ・${why} ── ${list.length}件・${new Set(list.map(x => x.company)).size}社（例：${name(list[0].company)}「${list[0].entry.label_ja || list[0].id}」）`);
  if (gs.length > 15) lines.push(`  ・ほか ${gs.length - 15}種類 ${gs.slice(15).reduce((t, [, l]) => t + l.length, 0)}件（新しい項目が1〜3件ずつ。import-plan.json に全部）`);
  lines.push('');
  const we = by('weak_evidence');
  lines.push(`■ 3. 根拠が足りないもの（${we.length}件。入れない。調べる側に返す候補）`);
  for (const [why, list] of group(we, x => (x.why.find(Boolean) || '').replace(/（.*$/, '')))
    lines.push(`  ・${why} ── ${list.length}件・${names(list)}`);
  lines.push('');
  const miss = by('target_unknown').filter(x => /^値が無い/.test(x.why.find(Boolean) || ''));
  lines.push('■ 4. 入れないもの（決めることは無い）');
  lines.push(`  ・空欄の記録 ${miss.length}件 ── 空欄のまま（0 や「無し」にしない・今の値を消さない）`);
  lines.push(`  ・保留 ${R.filter(x => x.use === '保留').length}件（どの分類でも）── 調べた側が「出さない・計算に使わない」とした記録`);
  if (cfIdle.length) lines.push(`  ・資料どうしの食い違いで、どの側の記録もまだ入れられないもの ${cfIdle.length}件（${cfIdle.join('・')}）── 置き場ができたときに一緒に決める（全部は owner-list-all.tsv）`);
  if (by('format_error').length) lines.push(`  ・形式エラー ${by('format_error').length}件 ── 直した出し直しを待つ`);
  const blockedPacks = p.packs.filter(x => !x.skipped && !x.validator_ok);
  if (blockedPacks.length) lines.push(`  ・検査のエラーが残るパック ${blockedPacks.length}（${blockedPacks.map(x => x.pack_id).join('・')}）── 記録 ${R.filter(x => x.blocked).length}件は分類だけ出し、1件も入れない`);
  const payIn = R.filter(x => x.auto && x.domain === 'pay');
  const notCompared = payIn.filter(x => !x.pay_gap);
  if (payIn.length) {
    lines.push('');
    lines.push(`■ 5. 入る給与の記録 ${payIn.length}件 ── 出所の台帳の候補（領収書）として入るだけ。推定年収は動かない`);
    lines.push(`  ・年額で推定年収と比べたもの ${payIn.length - notCompared.length}件（会社・職位ごとの幅で比べて、差は25%以内）`);
    lines.push(`  ・額を比べていないもの ${notCompared.length}件（時給・月額・職位の分からない表・募集・参考。比べると月額×12 などの計算が要る）`);
  }
  lines.push('');
  lines.push('入れた記録は research-ledger.mjs（取り込みの台帳）に入る。どの画面もまだ読まない（会社ページを広げる回が読む）。公開は別の承認。');
  return lines.join('\n') + '\n';
}

/** 決まりでは入れない記録の全部（1行＝1件：分類／会社／何／サイトの今・理由／パック／資料の日付／記録の ID）。短い一覧の元。 */
export function ownerTable(p, L) {
  const name = id => (L.SALARY[id] || (L.OPS || {})[id] || {}).ja || id;
  const cell = x => String(x ?? '').replace(/[\t\n\r]+/g, ' ');
  const rows = [['分類', '会社', '何', 'サイトの今・理由', 'パック', '資料の日付', '使い方', 'パック ID', '記録 ID'].join('\t')];
  for (const x of p.records.filter(r => !r.auto)) {
    const why = [...x.why.filter(Boolean), ...(x.pay_gap && x.pay_gap.over ? [`給与の差 ${x.pay_gap.gap}%（サイト ${x.pay_gap.site}万円）`] : [])].join('／');
    rows.push([CAT_JA[x.cat], name(x.company), x.entry.label_ja || x.item, why, valueShort(x.entry), srcDate(x.entry), x.use, x.pack, x.id].map(cell).join('\t'));
  }
  return rows.join('\n') + '\n';
}

/* ════════════ apply ════════════ */
export async function apply(args) {
  const planFile = args._[1];
  if (!planFile || !args.approved) fail('使い方: apply <import-plan.json> --approved <ID の一覧>');
  const root = path.resolve(args.root || HERE);
  const p = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const { checksum, ...body } = p;
  if (sha(canon(body)) !== checksum) fail('plan の中身が、作ったときと違う（手で直された？）── plan を作り直す');
  const L = await loadLedgers(root);
  for (const [f, s] of Object.entries(p.root_prints || {})) if (L.prints[f] !== s) fail(`台帳 ${f} が plan のあとで変わった ── plan を作り直す`);
  const wanted = fs.readFileSync(args.approved, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const keyOf = x => `${x.pack} ${x.id}`;
  const known = new Set(p.records.map(keyOf));
  const onlyId = new Map();
  for (const x of p.records) onlyId.set(x.id, onlyId.has(x.id) ? null : keyOf(x));
  const approved = new Set();
  const refused = [];
  for (const w of wanted) {
    const k = /\s/.test(w) ? w.split(/\s+/).slice(0, 2).join(' ') : onlyId.get(w);
    if (k && known.has(k)) approved.add(k); else refused.push([w, 'plan に無い ID']);
  }
  const packInfo = new Map(p.packs.map(x => [x.pack_id, x]));
  const { store } = readStore(root);
  const done = [];
  /* plan の並びで入れる（承認の一覧の並びに左右されない） */
  for (const x of p.records.filter(r => approved.has(keyOf(r)))) {
    const why = gate(x, packInfo.get(x.pack) || {}, root, args, L);
    if (why) { refused.push([x.id, why]); continue; }
    const d = put(store, x, p.made_on);
    if (d.refused) { refused.push([x.id, d.refused]); continue; }
    done.push(d);
  }
  for (const d of done.filter(d => d.changed)) {
    const P = store.packs[d.rec.pack] = store.packs[d.rec.pack] || { revision: d.rec.rev, records: {} };
    P.revision = Math.max(P.revision, d.rec.rev);
    P.sha = (packInfo.get(d.rec.pack) || {}).sha || P.sha || null;
    P.records[d.rec.id] = d.rec.h;
  }
  const bad = verifyStore(store, L);
  if (bad.length) { for (const b of bad.slice(0, 20)) console.error(`✗ ${b}`); fail(`取り込みの台帳が決まりに合わない（${bad.length}件）── 何も書いていない`, 1); }
  /* 1件も変わらなければ書かない（台帳がまだ無ければ作らない） */
  const wrote = done.some(d => d.changed) ? writeStore(root, store) : false;
  for (const [id, w] of refused) console.log(`  入れない: ${id} ── ${w}`);
  console.log(`apply: 承認 ${wanted.length}件 → 入れた ${done.filter(d => d.changed).length}件・同じだった ${done.filter(d => !d.changed).length}件・入れない ${refused.length}件`);
  console.log(wrote ? `  ${STORE_FILE} を書いた` : '✓ 変更なし');
  return { wrote, refused, done };
}

/** 承認されても入れない理由（無ければ null）。検査からも呼ぶ。 */
export function gate(x, pi, root, args, L) {
  if (!pi.validator_ok) return 'パックに検査のエラー（1件も入れない）';
  if (x.test_only && (!args.test || isRepository(root))) return 'test_only のパック（リポジトリには入れない）';
  if (['format_error', 'target_unknown', 'weak_evidence'].includes(x.cat)) return `${CAT_JA[x.cat]}は入れられない`;
  const retract = (x.entry.relation || {}).type === 'retracts';
  if (!retract && (x.use === '空欄' || x.entry.value === null || x.entry.value === undefined)) return '値が無い（空は削除の指示ではない）';
  if (!retract && !hasQuoteAndUrl(x.entry)) return '引用と URL の無い記録は入れない';
  /* 取り込み済みの行が「未指定」（調べた側の判断が無くなった）に付け直されたときは通す ── 前の使い方のまま画面に残さないため（出さない側へ動くだけ） */
  if (!USES.has(x.use) && !(x.relabel !== undefined && x.use === '未指定')) return `使い方（${x.use}）が決まっていない`;
  if (x.domain === 'pay' && x.target !== `SOURCES.${x.company}`) return '給与は出所の台帳（候補）にだけ入る';
  if (!x.target || !/^(FACTS|NETWORK|LIVING|SOURCES)\./.test(x.target)) return '置き場が無い';
  const [sec, a] = x.target.split('.');
  if (sec === 'LIVING' && (L.LIVING[a] || a === 'abudhabi')) return `先行の会社の街（${a}）は living-facts.mjs を人が直す（この道具は書かない）`;
  if (sec === 'FACTS' && L.FACTS[a]) return `先行の会社（${a}）の事実は airline-facts.mjs を人が直す（この道具は書かない）`;
  if (sec === 'NETWORK' && L.NETWORK[a]) return `先行の会社（${a}）の就航地は airline-destinations.mjs を人が直す（この道具は書かない）`;
  return null;
}

export function hasQuoteAndUrl(e) {
  const vs = (e.evidence || []).filter(x => (x.supports || []).some(s => s === 'value' || s === 'estimate_input'));
  if (!vs.length) return false;
  const srcs = new Map((e.src || []).map(s => [s.source_id, s]));
  return vs.every(x => String(x.quote || '').trim() && urlOk((srcs.get(x.source_id) || {}).url));
}

/** 給与の記録を、出所の台帳（salary-sources.mjs の SOURCES）の1行の形に（状態はいつも候補）。 */
function receipt(e) {
  const s = (e.src || [])[0] || {};
  return {
    rank: ['cap', 'fo'].includes((e.applies_to || {}).rank) ? e.applies_to.rank : 'all', source_type: s.source_type, name: s.title,
    url: s.url, published_at: ISO.test(String(s.published)) ? s.published : null, accessed_at: s.retrieved, status: 'candidate',
    value_orig: valueShort(e, Infinity), quote: ((e.evidence || []).find(v => (v.supports || []).includes('value')) || {}).quote || '', note: e.cond_ja,
  };
}
/**
 * 1件を置き場へ。返すのは { changed, rec, refused? }。同じ ID・同じ中身なら何もしない。中身が違えば前の行を HISTORY へ移してから置く。
 * 暮らしは街ごとに1つ：同じ行（twinOf）が在れば新しい行は作らず、その行に「見た」（seen）を足す。
 * 一部の部屋だけ同じ額の行・同じ部屋で額の違う行・別の街の同じ行が在れば入れない（refused。台帳にも街にも何も足さない）。
 */
function put(store, x, on) {
  const e = { ...x.entry, h: x.h, imported_on: on };
  const [sec, a, b] = x.target.split('.');
  const rel = e.relation || {};
  const targets = ['corrects', 'supersedes', 'retracts'].includes(rel.type) ? rel.targets : [];
  if (sec === 'LIVING' && rel.type !== 'retracts') {
    const cur = ((store.LIVING[a] || {})[b] || []).filter(r => !targets.includes(r.id));
    if (!cur.some(r => r.id === e.id && r.pack === e.pack)) {
      const t = twinOf(cur, e);
      if (t.status === 'partial') return { changed: false, rec: x, refused: `一部の部屋の型だけ同じ額の行が在る（${t.rows.map(r => r.id).join('・')}）── 同じ額を2つの行に置かない` };
      if (t.status === 'differs') return { changed: false, rec: x, refused: `同じ地区・同じ資料・同じ部屋の型で額の違う行が在る（${t.other.id}）── どちらを使うかを先に決める` };
      const mine = new Set(rowPrints(e));
      for (const [c, C] of Object.entries(store.LIVING)) if (c !== a) for (const k of ['rents', 'commute', 'towns']) {
        const r = (C[k] || []).find(y => rowPrints(y).some(f => mine.has(f)));
        if (r) return { changed: false, rec: x, refused: `同じ資料・同じ値の行が街「${c}」に在る（${r.id}）── 街は1つ。この会社をどの街につなぐかを先に決める` };
      }
    }
  }
  let list;
  if (sec === 'FACTS') { store.FACTS[a] = store.FACTS[a] || {}; list = store.FACTS[a][b] = store.FACTS[a][b] || []; }
  else if (sec === 'NETWORK') { store.NETWORK[a] = store.NETWORK[a] || {}; list = store.NETWORK[a][b] = store.NETWORK[a][b] || []; }
  else if (sec === 'SOURCES') { list = store.SOURCES[a] = store.SOURCES[a] || []; Object.assign(e, receipt(e)); }
  else {
    const C = store.LIVING[a] = store.LIVING[a] || { name: null, name_en: null, airlines: [], rents: [], commute: [], towns: [] };
    if (!C.name) C.name = (x.entry.applies_to || {}).base || a;
    C.airlines = [...new Set([...C.airlines, x.company])].sort();
    store.CITY_OF[x.company] = [...new Set([...(store.CITY_OF[x.company] || []), a])].sort();
    list = C[b];
  }
  let changed = false;
  const by = { pack: x.pack, id: x.id, rev: x.rev };
  /* 年収の根拠の台帳（人が直す台帳）と同じ額・違う額 ＝ 値は書かず、控えだけ（訂正は workflows/update-salary.md で人が） */
  if (x.basis) {
    const c = { target: `BASIS.${x.company}`, pack: x.pack, id: x.id, h: x.h, checked_at: e.checked_at, url: e.url || null,
      ...(x.basis === 'correction' ? { value: e.value, currency: e.currency, why: x.why.join('／') } : {}) };
    const into = x.basis === 'matches' ? store.CONFIRMS : store.CORRECTIONS;
    if (!into.some(y => canon(y) === canon(c))) { into.push(c); into.sort((p, q) => (`${p.pack} ${p.id}` < `${q.pack} ${q.id}` ? -1 : 1)); changed = true; }
  }
  /* 前の記録を置き換える・取り下げる（オーナーが承認したときだけ。前の行は HISTORY に残る） */
  for (const t of targets) {
    const j = list.findIndex(r => r.id === t);
    if (j >= 0) { store.HISTORY.push({ replaced: list[j], by, why: rel.type, on }); list.splice(j, 1); changed = true; }
  }
  if (rel.type === 'retracts') return { changed, rec: x };
  const i = list.findIndex(r => r.id === e.id && r.pack === e.pack);
  if (i >= 0) {
    if (list[i].h === e.h) return { changed, rec: x };
    store.HISTORY.push({ replaced: list[i], by, why: x.cat === 'conflict' ? 'オーナーが選んだ（同じ ID で中身が変わって届いた）' : x.why.join('／'), on });
    list[i] = e;
    return { changed: true, rec: x };
  }
  if (sec === 'LIVING') {
    const t = twinOf(list, e);
    if (t.status === 'same') {
      const s = { pack: x.pack, id: x.id, company: x.company };
      for (const twin of t.rows) {
        twin.seen = twin.seen || [];
        if (twin.seen.some(y => canon(y) === canon(s))) continue;
        twin.seen.push(s);
        twin.seen.sort((p, q) => (`${p.pack} ${p.id}` < `${q.pack} ${q.id}` ? -1 : 1));
        changed = true;
      }
      return { changed, rec: x };
    }
  }
  list.push(e);
  list.sort((p, q) => (`${p.id} ${p.pack}` < `${q.id} ${q.pack}` ? -1 : 1));
  return { changed: true, rec: x };
}

/* ════════════ verify（取り込みの台帳の形 ＋ 間取りの呼び名の意味）════════════ */
export function verifyStore(store, L) {
  const bad = [];
  const each = (where, list) => {
    for (const e of list || []) {
      const w = `${where}[${e.id}]`;
      if (!e.pack || !e.id) bad.push(`${w}: pack / id が無い`);
      /* 未指定 ＝ 取り込んだあとで調べた側の判断が無くなった行（画面に出さない）。新しく入る行は apply の門が USES だけに絞っている */
      if (!USES.has(e.use) && e.use !== '未指定') bad.push(`${w}: use が「${e.use}」`);
      if (e.use === '空欄' || e.value === null || e.value === undefined) bad.push(`${w}: 値の無い行（空は削除の指示ではない・行を作らない）`);
      if (!hasQuoteAndUrl(e)) bad.push(`${w}: 引用と URL の無い行`);
      if (e.checked_at !== null && !ISO.test(String(e.checked_at))) bad.push(`${w}: checked_at の形`);
      if (!ISO.test(String(e.imported_on))) bad.push(`${w}: imported_on が無い`);
    }
  };
  for (const [s, a] of Object.entries(store.FACTS || {})) {
    if (!L.SALARY[s] && !(L.OPS || {})[s]) bad.push(`FACTS.${s}: 会社が一覧に無い`);
    for (const [k, list] of Object.entries(a)) { if (!FACT_DOMAINS.includes(k)) bad.push(`FACTS.${s}.${k}: 置き場の名前`); each(`FACTS.${s}.${k}`, list); }
  }
  for (const [s, n] of Object.entries(store.NETWORK || {})) for (const [k, list] of Object.entries(n)) {
    if (!['list', 'held'].includes(k)) bad.push(`NETWORK.${s}.${k}: 置き場の名前`);
    each(`NETWORK.${s}.${k}`, list);
    for (const e of list) if (!L.PLACES[e.value]) bad.push(`NETWORK.${s}.${k}[${e.id}]: 空港 ${e.value} が PLACES に無い`);
  }
  for (const [c, C] of Object.entries(store.LIVING || {})) {
    if (L.LIVING[c] || c === 'abudhabi') bad.push(`LIVING.${c}: 先行の会社の街へは入れない`);
    for (const k of ['rents', 'commute', 'towns']) each(`LIVING.${c}.${k}`, C[k]);
    for (const a of C.airlines || []) if (!(store.CITY_OF[a] || []).includes(c)) bad.push(`LIVING.${c}: ${a} が CITY_OF に無い`);
    for (const r of C.rents || []) {
      for (const [lk, m] of Object.entries(r.layout || {})) {
        if (LEDGER_KEY_WORD[lk] !== m.word) bad.push(`LIVING.${c}.rents[${r.id}]: 鍵 ${lk} の字が「${m.word}」`);
        if (LAYOUT.pack[m.pack_key] !== m.word) bad.push(`LIVING.${c}.rents[${r.id}]: パックの鍵 ${m.pack_key} の意味が「${m.word}」でない`);
        if (m.term && readTerm(m.term) && readTerm(m.term) !== m.word) bad.push(`LIVING.${c}.rents[${r.id}]: 資料の言い方「${m.term}」の意味は ${readTerm(m.term)}（台帳は ${m.word}）`);
      }
      for (const k2 of Object.keys(r.value || {})) if (!LAYOUT.pack[k2]) bad.push(`LIVING.${c}.rents[${r.id}]: 部屋の型「${k2}」を読めない`);
    }
  }
  /* 街は1つ・同じ行は1つ：同じ資料・同じ値（家賃は部屋の型ごと）が、同じ街の同じ地区に2行あっても、2つの街に1行ずつあってもいけない */
  const at = new Map(), dup = new Set();
  for (const [c, C] of Object.entries(store.LIVING || {})) for (const k of ['rents', 'commute', 'towns']) for (const r of C[k] || []) for (const f of rowPrints(r)) {
    for (const [c2, r2] of at.get(f) || []) {
      if (c2 !== c) dup.add(`LIVING.${c}.${k}[${r.id}]: 同じ資料・同じ値の行が街「${c2}」にも在る（${r2.id}）── 街は1つ`);
      else if (sameDistrict(r, r2)) dup.add(`LIVING.${c}.${k}[${r.id}]: 同じ地区・同じ資料・同じ値の行が2つ（${r2.id}）── 街は1つ・行は1つ`);
    }
    at.set(f, [...(at.get(f) || []), [c, r]]);
  }
  bad.push(...dup);
  for (const [s, cities] of Object.entries(store.CITY_OF || {})) for (const c of cities) if (!(store.LIVING[c] || {}).airlines || !store.LIVING[c].airlines.includes(s)) bad.push(`CITY_OF.${s}: ${c} の街に会社が無い`);
  for (const [s, list] of Object.entries(store.SOURCES || {})) {
    if (!L.SALARY[s]) bad.push(`SOURCES.${s}: 年収の台帳に無い会社`);
    each(`SOURCES.${s}`, list);
    for (const e of list) {
      const w = `SOURCES.${s}[${e.id}]`;
      if (!['cap', 'fo', 'all'].includes(e.rank)) bad.push(`${w}: rank`);
      if (!L.SOURCE_TYPES.includes(e.source_type)) bad.push(`${w}: source_type が語彙に無い（${e.source_type}）`);
      if (e.status !== 'candidate') bad.push(`${w}: パックから入れた資料は candidate だけ（${e.status}）`);
      if (!e.name || !urlOk(e.url) || !ISO.test(String(e.accessed_at))) bad.push(`${w}: 資料の名前・URL・開いた日`);
    }
  }
  return bad.concat(layoutCheck(L));
}

/** 台帳の街の、列と棒の呼び名が、出どころの言い方の「意味」と合っているか（P12.73。字の形だけでなく意味を見る）。 */
export function layoutCheck(L) {
  const bad = [];
  const quotesOf = c => [...(c.rents || []), ...(c.rents || []).flatMap(r => r.estates || []), ...(c.rent_basis || [])].map(x => `${x.quote || ''} ${x.name_quote || ''}`).join(' ');
  const one = (where, site, cols, words, wordsSrc, quoteText) => {
    const T = LEDGER_TERMS[where];
    if (!T) { bad.push(`${where}: 間取りの意味の表（LEDGER_TERMS）に、この街が無い`); return; }
    if (T.site !== site) bad.push(`${where}: 出どころが ${site}（表は ${T.site}）`);
    const shown = [...(cols || []), ...Object.entries(words || {})];
    for (const [k, w] of shown) {
      const term = T.terms[k];
      if (!term) { bad.push(`${where}.${k}: 列「${w}」の出どころの言い方が表に無い`); continue; }
      if (wordsSrc && wordsSrc[k] !== undefined && wordsSrc[k] !== term) bad.push(`${where}.${k}: words_src「${wordsSrc[k]}」と表「${term}」が違う`);
      const meant = layoutWord(T.site, term);
      if (meant !== w) bad.push(`${where}.${k}: 「${w}」と出しているが、出どころの「${term}」の意味は ${meant || '（読めない）'}`);
      if (quoteText !== null) for (const part of term.split('/')) if (!quoteText.includes(part)) bad.push(`${where}.${k}: 出どころの言い方「${part}」が台帳の引用に無い`);
    }
  };
  for (const [city, c] of Object.entries(L.LIVING)) {
    if (!c.site) continue;
    const q = quotesOf(c);
    one(city, c.site, c.cols, c.words, c.words_src, city === 'hongkong' ? (c.rent_basis || []).map(x => x.quote || '').join(' ') : q);
    for (const g of c.refs || []) one(`${city}.refs.${g.key}`, g.site, g.cols, null, null, (g.rent_basis || []).map(x => x.quote || '').join(' ') + ' ' + (g.rows || []).map(x => x.quote || '').join(' '));
  }
  if (L.ABUDHABI) {
    const ey = (L.EY_LIVING || {}).rents || [];
    one('abudhabi', L.ABUDHABI.site, [['studio', 'Studio'], ['bed1', '1-Bed'], ['bed2', '2-Bed'], ['bed3', '3-Bed']].filter(([k]) => ey.some(r => r.value && r.value[k] !== undefined)),
      L.ABUDHABI.words, null, ey.map(r => r.quote || '').join(' '));
  }
  return bad;
}

export async function verify(args) {
  const root = path.resolve(args.root || HERE);
  const L = await loadLedgers(root);
  const { store, text } = readStore(root);
  const bad = verifyStore(store, L);
  if (bad.length) { for (const b of bad) console.log(`❌ ${b}`); console.log(`\n❌ import-research-pack verify: ${bad.length}件`); process.exit(1); }
  const n = o => Object.values(o).reduce((t, v) => t + (Array.isArray(v) ? v.length : Object.values(v).reduce((u, w) => u + (Array.isArray(w) ? w.length : 0), 0)), 0);
  console.log(`✅ import-research-pack verify: ${text ? `取り込みの台帳 FACTS ${n(store.FACTS)}・NETWORK ${n(store.NETWORK)}・LIVING ${Object.keys(store.LIVING).length}街・SOURCES ${n(store.SOURCES)}` : '取り込みの台帳はまだ無い'}／間取りの呼び名は出どころの意味どおり（${Object.keys(LEDGER_TERMS).length}か所）`);
}

/* ════════════ check ════════════ */
export async function check(args) {
  const validator = args.validator || (args.contract && path.join(args.contract, 'tools', 'validate_pack.py'));
  if (!validator) fail('--validator <validate_pack.py> が要る');
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(require_tmp()), 'pv-import-'));
  let bad = 0, n = 0;
  try {
    for (const f of packFiles(args._[1])) {
      const { pack, log, checkFile } = readPack(f, tmp);
      const v = runValidator(validator, checkFile, args.today);
      n++;
      if (!v.ok) bad++;
      console.log(`${v.ok ? '✓' : '✗'} ${path.basename(f)}（${pack.pack_id || '?'} 版${pack.pack_revision ?? '?'}）エラー ${v.errors.length}・注意 ${v.warnings.length}${log.length ? `・1.1.0 から直した ${log.length}件` : ''}`);
      for (const e of v.errors.slice(0, 10)) console.log(`    [エラー] ${e.path} ${e.message}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(bad ? `✗ check: ${bad}/${n} パックにエラー ── 何も書いていない` : `✓ check: ${n} パックともエラー 0 ── 何も書いていない`);
  if (bad) process.exit(1);
}

/* ════════════ 入口 ════════════ */
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) { const k = s.slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) a[k] = true; else { a[k] = v; i++; } }
    else a._.push(s);
  }
  return a;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const verb = args._[0];
  const run = { check, plan, apply, verify }[verb];
  if (!run) fail('使い方: node import-research-pack.mjs check|plan|apply|verify …（頭の説明を読む）');
  if (['check', 'plan'].includes(verb) && !args._[1]) fail(`${verb} <pack.json|フォルダ> が要る`);
  await run(args);
}
