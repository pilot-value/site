/* db/test-roster-ui.mjs — マイレポートの「勤務ロスター」のタブ（my-roster.js / roster-upload.js）の約束（2026-11-09）
   サーバも DB もブラウザも要らない。pay-viz.js → pv-report-engine.js → my-roster.js → roster-upload.js を node の vm で読み、
   画面を持たない部品（PVRoster._ / PVRosterUpload._）を直接呼ぶ。

   守っていること（どれも、わざと壊すと赤くなることをこのファイルの最後で確かめる）
   ① 読み方の保存は「足りなかった鍵の答えだけ」。答え済みの鍵を上書きしない。
   ② 勤務コードは丸ごと置き換える口（set_roster_profile）なので、前の答えを残して足す（消さない）。
   ③ 保存する1日は決めた欄だけで組み直す（切れの印 cut・partial、知らない鍵は送らない）。
   ④ 地上の業務に空港を作らない（場所 loc だけ・矢印を出さない）。区分の分からない便は「区分確認中」。
   ⑤ 画像の扱いの言い方が「送るが保存しない」（「画像は送りません」と書かない・CLAUDE.md の1つの言い方）。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const VIZ = read('pay-viz.js'), ENG = read('pv-report-engine.js'), ROS = read('my-roster.js'), UP = read('roster-upload.js');

function load(ros, up, lang = 'ja') {
  const win = { document: { documentElement: { getAttribute: () => lang }, addEventListener() {}, createElement() { return {}; } }, addEventListener() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const s of [VIZ, ENG, ros, up]) vm.runInContext(s, ctx);
  return { P: win.PVRoster && win.PVRoster._, U: win.PVRosterUpload && win.PVRosterUpload._ };
}

function checks({ P, U }) {
  const fails = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };
  if (!P || !U) return ['部品が読めない'];

  // ①
  const p1 = U.patchOf({ kind: 'actual', time_ref: null, time_meaning: null, codes: {} }, { kind: 'planned', time_ref: 'utc' });
  ok(p1 && !('kind' in p1) && p1.time_ref === 'utc', '① 答え済みの「実績か予定か」は送らない・足りない「時刻の基準」だけ送る');
  ok(U.patchOf({ kind: 'actual' }, {}) === null, '① 新しい答えが無ければ何も送らない');

  // ②
  const p2 = U.patchOf({ codes: { OFF1: 'off', VAC: 'vac' } }, { codes: { RDO: 'off', SBY: '' } });
  ok(p2 && p2.codes && p2.codes.OFF1 === 'off' && p2.codes.VAC === 'vac' && p2.codes.RDO === 'off', '② 前の勤務コードの答えを残して足す');
  ok(p2 && p2.codes && !('SBY' in p2.codes), '② 選ばなかったコード（空）は送らない');

  // ③
  const day = { date: '2026-10-11', code: null, d_on: '08:00', d_off: null, d_off_day: 0, cut: 'bottom', page: 1, row: 3, name: 'X',
    legs: [{ seq: 1, flight: '1131', from: 'HND', to: 'KIX', loc: null, out: '09:00', in: null, in_day: 0, block: null, role: 'CAP', kind: 'operating', partial: true, page: 1, row: 4, note: 'x' }] };
  const s = U.stripDay(day);
  ok(!('cut' in s) && !('name' in s), '③ 1日から cut と知らない鍵を外す');
  ok(s.legs.length === 1 && !('partial' in s.legs[0]) && !('note' in s.legs[0]) && s.legs[0].flight === '1131' && s.legs[0].from === 'HND', '③ 便から partial と知らない鍵を外し、決めた欄は残す');

  // ④
  /* 空港が混ざって届いても（古い行・読み違い）、地上の業務は場所だけを出す */
  const g = P.legHTML({ seq: 1, flight: null, from: 'HND', to: 'NRT', loc: 'TRC', out: '09:00', in: '16:00', inDay: 0, blockMin: null, role: 'GT', kind: 'ground' });
  ok(g.includes('TRC') && !g.includes('→') && !g.includes('HND'), '④ 地上の業務は場所だけ（矢印・空港を出さない）');
  const u = P.legHTML({ seq: 1, flight: '1301', from: 'HND', to: 'ITM', loc: null, out: '09:00', in: '10:10', inDay: 0, blockMin: 70, role: 'X', kind: 'unknown' });
  ok(u.includes(P.T.kindUnknown), '④ 区分の分からない便は「区分確認中」');
  const c = P.cellParts({ isDuty: true, cls: 'ground', dOn: '09:00', code: 'GND', legs: [{ kind: 'ground', loc: 'TRC', from: null, to: null }] });
  ok(c.sub === 'TRC' && !c.subH, '④ カレンダーの升でも地上の業務は場所だけ');
  return fails;
}

let pass = 0, fail = 0;
const say = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

console.log('▼ いまの my-roster.js / roster-upload.js');
const now = checks(load(ROS, UP));
say(now.length === 0, '約束①〜④がすべて守られている' + (now.length ? '：' + now.join(' / ') : ''));
const en = checks(load(ROS, UP, 'en'));
say(en.length === 0, '英語のページでも同じ' + (en.length ? '：' + en.join(' / ') : ''));

console.log('▼ ⑤ 画像の扱いの言い方');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const code = strip(UP) + strip(ROS);
  say(!/画像は送りません|画像を送りません|images? (are|is) never sent|never (send|upload)s? (the |your )?image/i.test(code), '「画像は送らない」と書いていない');
  say(/読み取りのために送りますが、保存しません/.test(UP) && /sent to be read and are not stored/.test(UP), '「読み取りのために送るが保存しない」と日英で書いている');
}

/* ▼ 壊す証明：守りの1行を外すと、上の検査が赤くなること */
console.log('▼ 壊す証明');
const BREAK = [
  ['① 答え済みの鍵も送る', "if (!pr[k] && a[k]) { p[k] = a[k]; any = true; }", "if (a[k]) { p[k] = a[k]; any = true; }", 'up'],
  ['② 前の勤務コードを捨てる', "codes[k] = pr.codes[k]; });   // ★丸ごと", "});   // ★丸ごと", 'up'],
  ['③ 1日を丸ごと送る', 'var days = U.merged.days.map(stripDay);', 'var days = U.merged.days;', 'up',
    (src) => src.replace('function stripDay(x) {', () => 'function stripDay(x) { return x;')],
  ['④ 地上の業務にも矢印を出す', "var where = l.kind === 'ground'", "var where = false", 'ros']
];
for (const [name, from, to, which, extra] of BREAK) {
  const src = which === 'up' ? UP : ROS;
  if (src.split(from).length !== 2) { say(false, `${name}：差し替える1行が1回だけ無い（検査が古い）`); continue; }
  let broken = src.replace(from, () => to);
  if (extra) broken = extra(broken);
  let f;
  try { f = checks(load(which === 'ros' ? broken : ROS, which === 'up' ? broken : UP)); } catch (e) { f = ['読み込めない: ' + e.message]; }
  say(f.length > 0, `${name} → 赤くなる（${f.length}件）`);
}

console.log(`\n══ ${pass} pass / ${fail} fail ══`);
process.exit(fail ? 1 : 0);
