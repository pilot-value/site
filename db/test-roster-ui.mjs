/* db/test-roster-ui.mjs — マイレポートの「勤務ロスター」のタブ（my-roster.js / roster-upload.js）の約束（2026-11-09）
   サーバも DB もブラウザも要らない。pay-viz.js → pv-report-engine.js → my-roster.js → roster-upload.js を node の vm で読み、
   画面を持たない部品（PVRoster._ / PVRosterUpload._）を直接呼ぶ。

   守っていること（どれも、わざと壊すと赤くなることをこのファイルの最後で確かめる）
   ① 読み方の保存は「足りなかった鍵の答えだけ」。答え済みの鍵を上書きしない。
   ② 勤務コードは丸ごと置き換える口（set_roster_profile）なので、前の答えを残して足す（消さない）。
   ③ 保存する1日は決めた欄だけで組み直す（切れの印 cut・partial、知らない鍵は送らない）。
   ④ 地上の業務に空港を作らない（場所 loc だけ・矢印を出さない）。区分の分からない便は「区分確認中」。
   ⑤ 画像の扱いの言い方が「送るが保存しない」（「画像は送りません」と書かない・CLAUDE.md の1つの言い方）。
   ⑥ CSV は表示中の月だけ（ファイル名と1行目にその月・ほかの月の日を書かない）・1日の行と便の行・地上の業務に空港の欄を書かない。
   ⑦ 空欄の日・読めなかった日（unread）は保存に送らない。本人が入れた日だけ送る（2026-11-09）。
      「読めなかった日」は読み取りが覆った範囲（返ってきた日付の前〜後・印字の期間が狭ければそちら）の中だけ。月の残りを足さない。
   ⑧ 1日を直す画面の検品はサーバー（db/roster.sql）と同じ形：形の合わない時刻・空港は保存しない・"7:05" は "07:05" に・
      地上の業務は空港を落とす・中身の無い行は落として 1..n に振り直す・16件まで。
   ⑨ 月の数字で、分からない値を 0:00 にしない（便の時間が1つも分からなければ「—」と「便の時間が無い便 N」）。
   ⑩ 手で入れた日（manual）の資料はページ数ではなく「手で入れた日」。日の板に「この日を直す／入れる」。
   ⑪ 聞く前に埋める（2026-11-10）：本人の読み方 → 会社の辞書（my_roster_airline_codes）の順。辞書で埋まるものは聞かず、保存で本人の読み方へ入る。
      知らない言葉の印（'#'＋小文字16進16字）は「勤務表の言葉 A」と日付で聞き（印は画面に出さない・大文字にしない）、その日の見た目（cat）の多い方を選んでおく。
   ⑫ 何も書いていない日：問いは1つだけ。「休み」なら OFF の日として送る・「何も無い日」なら送らない。答えがあれば「読めなかった日」に並べない。
   ⑬ 「読めなかった日」の札は決まった5つ（OFF・VAC・SBY・TRN・GND）がいつもある。見た目からの候補は点線で示すだけで、
      押すか「この内容で決める」まで送らない。便や時刻が読めた日は、コードが読めなくても便ごと送る。
   ⑭ 便の乗務の区分（role）はどこにも持たない（送る日・直す画面・CSV）。
   ⑮ 読み取りの間違いを運営に知らせる：直した所の種類と数だけ（日付・時刻・空港・便名・印を書かない）・500字まで・運営だけが見る（p_private）。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const VIZ = read('pay-viz.js'), ENG = read('pv-report-engine.js'), ROS = read('my-roster.js'), UP = read('roster-upload.js');

function load(ros, up, lang = 'ja') {
  const win = { document: { documentElement: { getAttribute: () => lang }, addEventListener() {}, createElement() { return {}; } }, addEventListener() {}, setTimeout, clearTimeout };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const s of [VIZ, ENG, ros, up]) vm.runInContext(s, ctx);
  return { P: win.PVRoster && win.PVRoster._, U: win.PVRosterUpload && win.PVRosterUpload._, W: win.PVRosterUpload };
}
/* 画面の無い箱と、押した札（open() と onClick が触るところだけ） */
function fakeBox() { return { innerHTML: '', querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, contains() { return true; }, scrollIntoView() {} }; }
function tap(U, attrs) {
  const t = { disabled: false, getAttribute: (k) => (k in attrs ? attrs[k] : null), closest() { return t; }, querySelector() { return null; }, parentNode: { querySelectorAll: () => [] } };
  U.click({ target: t });
}
const TOK1 = '#0123456789abcdef', TOK2 = '#fedcba9876543210';

function checks({ P, U, W }) {
  const fails = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };
  if (!P || !U || !W) return ['部品が読めない'];

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
  ok(s.legs.length === 1 && !('partial' in s.legs[0]) && !('note' in s.legs[0]) && !('flight' in s.legs[0]) && s.legs[0].from === 'HND', '③ 便から partial・知らない鍵・★便名を外し、決めた欄は残す');
  ok(!('role' in s.legs[0]), '⑭ 送る便に乗務の区分（role）を持たない');

  // ④
  /* 空港が混ざって届いても（古い行・読み違い）、地上の業務は場所だけを出す */
  const g = P.legHTML({ seq: 1, flight: null, from: 'HND', to: 'NRT', loc: 'TRC', out: '09:00', in: '16:00', inDay: 0, blockMin: null, role: 'GT', kind: 'ground' });
  ok(g.includes('TRC') && !g.includes('→') && !g.includes('HND'), '④ 地上の業務は場所だけ（矢印・空港を出さない）');
  const u = P.legHTML({ seq: 1, flight: '1301', from: 'HND', to: 'ITM', loc: null, out: '09:00', in: '10:10', inDay: 0, blockMin: 70, role: 'X', kind: 'unknown' });
  ok(u.includes(P.T.kindUnknown), '④ 区分の分からない便は「区分確認中」');
  const c = P.cellParts({ isDuty: true, cls: 'ground', dOn: '09:00', code: 'GND', legs: [{ kind: 'ground', loc: 'TRC', from: null, to: null }] });
  ok(c.sub === 'TRC' && !c.subH, '④ カレンダーの升でも地上の業務は場所だけ');

  // ⑥ CSV（表示中の月だけ）
  if (P.csvOf && P.compute && P.S) {
    const leg = (seq, o) => Object.assign({ seq, flight: 'PV' + seq, from: 'AAA', to: 'BBB', loc: null, out: '08:00', in: '09:10', in_day: 0, block: '1:10', role: 'CAP', kind: 'operating' }, o || {});
    P.S.days = [
      { date: '2026-08-31', code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [leg(1)] },
      { date: '2026-09-01', code: null, d_on: '22:00', d_off: '06:30', d_off_day: 1, legs: [leg(1, { out: '23:00', in: '05:40', in_day: 1, block: '6:40' })] },
      { date: '2026-09-02', code: 'TRN', d_on: '09:00', d_off: '17:00', d_off_day: 0, legs: [leg(1, { flight: null, from: 'HND', to: 'NRT', loc: 'TRC', block: null, role: 'GT', kind: 'ground' })] },
      { date: '2026-09-03', code: 'OFF', d_on: null, d_off: null, d_off_day: 0, legs: [] },
      { date: '2026-10-01', code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [leg(1)] }
    ];
    P.S.profile = { kind: 'actual', time_ref: 'local', tz: null, codes: { OFF: 'off', TRN: 'training' } };
    P.S.ym = null;
    P.compute();
    const cv = P.csvOf('2026-09');
    ok(cv && cv.name === 'pilot-value-roster_2026-09', '⑥ ファイル名にその月：' + (cv && cv.name));
    ok(cv && cv.rows[0].join(' ').includes('2026-09'), '⑥ 1行目にその月');
    const dates = cv ? cv.rows.slice(2).map((r) => r[0]) : [];
    ok(dates.length && dates.every((x) => /^2026-09-/.test(x)), '⑥ ほかの月の日を書かない');
    ok(cv && !cv.rows[1].includes('role'), '⑭ CSV に乗務の区分の列が無い');
    const H = cv ? cv.rows[1] : [], night = cv ? cv.rows.find((r) => r[0] === '2026-09-01' && r[1] === 'day') : null;
    ok(night && night[H.indexOf('d_off')] === '06:30' && night[H.indexOf('d_off_day')] === 1 && night[H.indexOf('duty_min')] === 510, '⑥ 日をまたぐ D-OFF は +日 と勤務の分');
    const g = cv ? cv.rows.find((r) => r[0] === '2026-09-02' && r[1] === 'leg') : null;
    ok(g && g[H.indexOf('loc')] === 'TRC' && g[H.indexOf('from')] === '' && g[H.indexOf('to')] === '' && g[H.indexOf('kind')] === 'ground', '⑥ 地上の業務は場所だけ（空港の欄は空）');
    const fl = cv ? cv.rows.find((r) => r[0] === '2026-09-01' && r[1] === 'leg') : null;
    ok(fl && fl[H.indexOf('time_hm')] === '6:40' && fl[H.indexOf('time_min')] === 400 && fl[H.indexOf('from')] === 'AAA', '⑥ 便の行：時間は H:MM と分・空港は原本の表記');
    ok(P.csvOf('2027-01') === null, '⑥ 無い月は何も書かない');
  } else ok(false, '⑥ CSV の部品が無い');

  // ⑦ 空欄・読めなかった日は送らない
  const E0 = { code: null, d_on: null, d_off: null, d_off_day: 0, legs: [] };
  ok(U.stripDay(Object.assign({ date: '2026-10-16', blank: true }, E0)) === null, '⑦ 空欄の日（blank）は送らない');
  ok(U.stripDay(Object.assign({ date: '2026-10-17', unread: true }, E0)) === null, '⑦ 読めなかった日（unread）で何も読めていなければ送らない');
  const ur = U.stripDay(Object.assign({ date: '2026-10-17', unread: true }, E0, { d_on: '07:00', d_off: '15:00',
    legs: [{ seq: 1, from: 'HND', to: 'KIX', out: '08:00', in: '09:10', in_day: 0, block: '1:10', kind: 'operating', role: 'CAP' }] }));
  ok(ur && ur.code === null && ur.d_on === '07:00' && ur.legs.length === 1 && ur.legs[0].block === '1:10' && !('unread' in ur) && !('role' in ur.legs[0]),
     '⑬ コードだけ読めなかった日（unread）でも、時刻と便は送る（コードは空）');
  ok(U.stripDay(Object.assign({ date: '2026-10-18' }, E0)) === null, '⑦ 印が無くても中身の無い日は送らない');
  const filled = U.stripDay(Object.assign({ date: '2026-10-16' }, E0, { code: 'OFF1', edited: true }));
  ok(filled && filled.code === 'OFF1' && !('edited' in filled), '⑦ 本人が入れた日は送る（印は送らない）');

  // ⑦ 読めなかった日は覆った範囲の中だけ（1〜21日の2枚で 22〜31日を並べない）
  if (U.coverage && P.S) {
    const dd = (n) => '2026-10-' + String(n).padStart(2, '0');
    const day = (n, o) => Object.assign({ date: dd(n), code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [] }, o || {});
    const days = [];
    for (let n = 1; n <= 21; n++) days.push(n === 16 ? day(n, { d_on: null, d_off: null, blank: true }) : n === 17 ? day(n, { d_on: null, d_off: null, unread: true }) : day(n));
    const cv = U.coverage(days, null);
    ok(cv.range && cv.range.from === dd(1) && cv.range.to === dd(21) && cv.total === 21 && cv.read === 19, '⑦ 範囲は返ってきた日付の前〜後（m = 21・読めた日 19）：' + JSON.stringify(cv.range) + ' ' + cv.total);
    ok(cv.missing.join() === [dd(16), dd(17)].join(), '⑦ 範囲の中の空欄・読めなかった日だけを並べ、22〜31日は並べない：' + cv.missing.join());
    const cp = U.coverage(days, { from: dd(5), to: dd(31) });
    ok(cp.range.from === dd(5) && cp.range.to === dd(21) && cp.total === 17, '⑦ 印字の期間が狭ければそちらに寄せる（広い側には広げない）');
  } else ok(false, '⑦ 範囲の部品が無い');

  // ⑧ 1日を直す画面の検品
  if (U.cleanDay && U.normTime && U.normBlock) {
    const C = U.cleanDay;
    ok(U.normTime('7:05') === '07:05' && U.normTime('705') === '07:05' && U.normTime('0735') === '07:35' && U.normTime('24:00') === '24:00' &&
       U.normTime('25:00') === false && U.normTime('7:5') === false && U.normTime('') === '', '⑧ 時刻は "7:05"・"705" を "07:05" に・形の合わないものは不可');
    ok(U.normBlock('1:35') === '1:35' && U.normBlock('135') === '1:35' && U.normBlock('24:00') === '24:00' && U.normBlock('24:01') === false && U.normBlock('1:75') === false,
       '⑧ 便の時間は H:MM・24時間まで');
    const bad = C('2026-10-20', { code: 'off1', d_on: '7:5', d_off: '15:00', legs: [{ kind: 'operating', from: 'HN', to: 'KIX', out: '0800', in: '0910', block: '1:10' }] });
    ok(bad.day === null && bad.errs.d_on === 'errTime' && bad.errs['leg0.from'] === 'errApt' && !bad.errs.code && !bad.errs['leg0.to'],
       '⑧ 形の合わない時刻・空港は保存しない（その欄だけに印）');
    const good = C('2026-10-20', { code: 'off1', d_on: '7:05', d_off: '1:30', d_off_day: 1, legs: [
      { kind: 'ground', from: 'HND', to: 'NRT', loc: 'trc', out: '0900', in: '1600', block: '', role: 'gt' },
      { kind: 'operating', from: '', to: '', loc: '', out: '', in: '', block: '', role: '' },
      { kind: 'operating', from: 'hnd', to: 'kix', out: '1700', in: '0010', in_day: 1, block: '110', role: 'cap', flight: 'PV1' }] });
    const D = good.day, g0 = D && D.legs[0], g1 = D && D.legs[1];
    ok(D && D.code === 'OFF1' && D.d_on === '07:05' && D.d_off === '01:30' && D.d_off_day === 1, '⑧ "7:05" は "07:05"・コードは大文字・翌日の印');
    ok(g0 && g0.kind === 'ground' && g0.from === null && g0.to === null && g0.loc === 'TRC' && g0.out === '09:00', '⑧ 地上の業務は空港を落として場所だけ');
    ok(D && D.legs.length === 2 && g1.seq === 2 && g1.from === 'HND' && g1.in_day === 1 && g1.block === '1:10' && !('role' in g1) && !('flight' in g1),
       '⑧ 中身の無い行は落として順番を 1..n に・便名と乗務の区分は持たない');
    const tk = C('2026-10-20', { code: TOK1.toUpperCase() });
    ok(tk.day && tk.day.code === TOK1 && !tk.errs.code, '⑪ 直す画面でも読み取りの印は小文字のまま保存できる（大文字にしない）');
    ok(C('2026-10-20', { code: '', d_on: '', d_off: '', legs: [] }).errs.day === 'errEmpty', '⑧ 何も無い日は保存しない');
    ok(C('2026-10-20', { code: 'TOOLONGCODE123' }).errs.code === 'errCode' &&
       C('2026-10-20', { legs: [{ kind: 'operating', from: 'HND', block: '25:00' }] }).errs['leg0.block'] === 'errBlock' &&
       C('2026-10-20', { legs: [{ kind: 'ground', loc: 'X' }] }).errs['leg0.loc'] === 'errLoc', '⑧ コード・便の時間・場所もサーバーと同じ形');
    const many = C('2026-10-20', { legs: Array.from({ length: 17 }, () => ({ kind: 'operating', from: 'HND', to: 'KIX' })) });
    ok(many.day === null && many.errs.legs, '⑧ 1日16件まで');
    const dr = U.draftOf({ date: '2026-10-20', legs: [{ seq: 2, from: 'KIX', block_min: 70, kind: 'operating' }, { seq: 1, from: 'HND', block: '1:05', kind: 'x' }] });
    ok(dr.legs[0].from === 'HND' && dr.legs[0].kind === 'unknown' && dr.legs[1].block === '1:10', '⑧ 保存済みの日（block_min）も直す画面に読める');
  } else ok(false, '⑧ 直す画面の部品が無い');

  // ⑨ 月の数字で分からない値を 0:00 にしない ／ ⑩ 手で入れた日・日の板のボタン
  if (P.kpiHTML && P.docsHTML && P.dayHTML && P.compute && P.S) {
    const L = (o) => Object.assign({ seq: 1, from: 'AAA', to: 'BBB', loc: null, out: '08:00', in: '09:10', in_day: 0, block: null, role: 'CAP', kind: 'operating' }, o || {});
    const vals = (h) => [...h.matchAll(/<b class="rs-kpi-v">([^<]*)/g)].map((m) => m[1]);
    P.S.profile = { kind: 'actual', time_ref: 'local', tz: null, codes: {} };
    P.S.days = [
      { date: '2026-07-01', code: null, d_on: '07:00', d_off: '15:00', d_off_day: 0, legs: [L(), L({ seq: 2, from: 'BBB', to: 'AAA' })] },
      { date: '2026-07-02', code: null, d_on: null, d_off: null, d_off_day: 0, legs: [] }
    ];
    P.S.ym = null; P.compute();
    const k1 = P.kpiHTML(P.S.byYm['2026-07']), v1 = vals(k1);
    ok(v1[1] === '—' && !k1.includes('0:00') && k1.includes(P.fill(P.T.kNoTime, { n: 2 })), '⑨ 便の時間が1つも分からない月は「—」と「便の時間が無い便 2」（0:00 にしない）：' + v1[1]);
    P.S.days[0].legs[0].block = '1:10';
    P.S.ym = null; P.compute();
    const k2 = P.kpiHTML(P.S.byYm['2026-07']), v2 = vals(k2);
    ok(v2[0] === '1:10' && k2.includes(P.fill(P.T.kNoTime, { n: 1 })), '⑨ 一部だけ分かれば分かった分（★2026-11-11 から大きい数字は便の時間）と「便の時間が無い便 1」：' + v2.join(' / '));
    P.S.days = [{ date: '2026-07-03', code: null, d_on: null, d_off: null, d_off_day: 0, legs: [L({ block: '1:00' })] }];
    P.S.ym = null; P.compute();
    const v3 = vals(P.kpiHTML(P.S.byYm['2026-07']));
    ok(v3[0] === '1:00' && v3[1] === '—', '⑨ 勤務の時刻が1日も分からなければ勤務時間も「—」（大きい数字は便の時間 1:00）：' + v3.join(' / '));
    ok(!P.S.byYm['2026-07'].days.some((x) => x.date === '2026-07-02'), '⑦ 前に保存された空の日はカレンダーの日に数えない');
    P.S.docs = [
      { id: 'm1', date_from: '2026-07-03', date_to: '2026-07-03', pages: 1, days: 1, days_owned: 1, created_at: '2026-11-09T00:00:00Z', manual: true },
      { id: 'p1', date_from: '2026-07-01', date_to: '2026-07-31', pages: 3, days: 31, days_owned: 30, created_at: '2026-11-08T00:00:00Z' }];
    const dh = P.docsHTML(), rows = dh.split('<li class="rs-doc"');
    ok(rows.length === 3 && rows[1].includes(P.T.docManual) && !rows[1].includes(P.fill(P.T.docPages, { n: 1 })) && rows[2].includes(P.fill(P.T.docPages, { n: 3 })),
       '⑩ 手で入れた日の資料は「' + P.T.docManual + '」（ページ数ではない）');
    const dy = P.dayHTML('2026-07-03'), no = P.dayHTML('2026-07-09');
    ok(dy.includes('data-act="edit"') && dy.includes(P.T.editDay) && no.includes(P.T.addDay), '⑩ 日の板に「この日を直す」・記録の無い日は「この日を入れる」');
    const cal = P.calHTML('2026-07', {}, { interactive: true, edit: true, ask: { '2026-07-05': 1 }, flag: { '2026-07-06': 1 }, askLabel: 'X' });
    ok(/data-date="2026-07-05"[^>]*>.*?<span class="rs-c-m">\?<\/span>/.test(cal) && /class="rs-cell is-none is-ask"/.test(cal) && /has-iss[^"]*" data-date="2026-07-06"/.test(cal) && !cal.includes('aria-pressed'),
       '⑩ 確かめる画面のカレンダー：読めなかった日は「?」・確かめてほしい日に印・押す札ではない（aria-pressed なし）');
    /* ★2026-11-12 前に出した日（prev）は薄く・押せない（data-date を付けない） */
    const pd = { date: '2026-07-07', ym: '2026-07', isDuty: false, cls: 'off', code: 'OFF', legs: [] };
    const cp = P.calHTML('2026-07', { '2026-07-07': pd }, { interactive: true, edit: true, prev: { '2026-07-07': 1 }, prevLabel: 'P' });
    ok(/<span class="rs-cell [^"]*is-prev"[^>]*>/.test(cp) && !cp.includes('data-date="2026-07-07"'), '⑩ 前に出した日は薄く（is-prev）・押せない');
  } else ok(false, '⑨⑩ 月の数字・資料・日の板の部品が無い');

  // ⑪〜⑮ 取り込みの確認（画面の無い箱で open → prepare → 押す）
  if (U.prepare && U.asks && U.missHTML && U.sendDays && U.profilePatch && U.fixSummary && U.sendFix) {
    const lang = P.L, dd = (n) => '2026-10-' + String(n).padStart(2, '0');
    const E = { code: null, d_on: null, d_off: null, d_off_day: 0, legs: [] };
    const day = (n, o) => Object.assign({ date: dd(n) }, E, o || {});
    const M = () => ({ days: [
      day(1, { code: 'RDO', cat: 'off' }),
      day(2, { code: TOK1, cat: 'off' }), day(3, { code: TOK1, cat: 'off' }), day(4, { code: TOK1, cat: 'unclear' }),
      day(5, { code: TOK2, cat: 'sick' }),
      day(6, { blank: true, cat: 'blank' }), day(7, { blank: true, cat: 'blank' }),
      day(8, { unread: true, cat: 'off' }),
      day(9, { unread: true, cat: 'duty', d_on: '07:00', d_off: '15:00', legs: [{ seq: 1, from: 'HND', to: 'KIX', out: '08:00', in: '09:10', in_day: 0, block: '1:10', kind: 'operating', role: 'CAP' }] }),
      day(10, { cat: 'unclear', blank: true }),
      day(12, { code: 'OFF', cat: 'off' })
    ], issues: [], period: null, hints: {} });
    const box = fakeBox();
    W.open(box, { sb: null, airline: 'xx', other: null, airlineLabel: 'X Air', done() {},
      profile: { kind: 'actual', time_ref: 'local', time_meaning: 'block', codes: {} },
      learned: { ok: true, codes: { RDO: 'off', 'BAD KEY': 'off', ZZ: 'weird' } } });
    U.prepare(M(), 2);
    const q = U.asks(), a = U.answers();
    ok(!q.codes.includes('RDO') && a.codes.RDO === 'off' && !q.kind && !q.ref && !q.mean, '⑪ 会社の辞書にあるコード（と本人が答え済みの読み方）は聞かない：' + q.codes.join());
    ok(q.codes.includes(TOK1) && q.codes.includes(TOK2) && q.codes.every((c) => c === c.trim() && (!c.startsWith('#') || c === c.toLowerCase())), '⑪ 知らない言葉の印は小文字のまま聞く');
    ok(a.codes[TOK1] === 'off' && !(TOK2 in a.codes), '⑪ 見た目の多い方（休み）を選んでおく・病欠などは選ばない');
    U.setStep('ask');
    const vis = (h) => h.replace(/<[^>]*>/g, ' ');   // 画面に見える字（札の中の印 data-c は字にならない）
    const ah = U.askHTML();
    const lab = P.fill(P.T.tokL, { k: 'A' });
    ok(vis(ah).includes(lab) && !vis(ah).includes(TOK1.slice(1)) && !vis(ah).includes(TOK2.slice(1)) && !/#[0-9a-f]{16}/i.test(vis(ah)), '⑪ 印は「' + lab + '」と出し、印そのものは出さない');
    ok(ah.includes(lang === 'en' ? 'Oct 2, 3, 4' : '2・3・4日'), '⑪ 印の出てくる日付を添える');
    ok((ah.match(/data-q="blank" data-v="off"/g) || []).length === 1, '⑫ 何も書いていない日の問いは1つだけ');
    tap(U, { 'data-u': 'ans', 'data-q': 'blank', 'data-v': 'off' });
    tap(U, { 'data-u': 'next' });
    const sd = U.sendDays(), at = (n) => sd.find((x) => x.date === dd(n));
    ok(at(6) && at(6).code === 'OFF' && at(7) && at(7).code === 'OFF' && U.profilePatch().blank === 'off', '⑫ 「休み」と答えたら何も書いていない日は OFF として送る（答えは本人の読み方へ）');
    ok(at(9) && at(9).code === null && at(9).legs.length === 1 && !('role' in at(9).legs[0]), '⑬ コードが読めなかった日も時刻と便を送る');
    const pp = U.profilePatch();
    ok(pp && pp.codes && pp.codes.RDO === 'off' && pp.codes[TOK1] === 'off', '⑪ 会社の辞書で埋めた答えも、保存で本人の読み方に入る（印は小文字のまま）');
    const mh = U.missHTML();
    ok(['OFF', 'VAC', 'SBY', 'TRN', 'GND'].every((c) => mh.includes('data-id="' + dd(10) + '" data-c="' + c + '"')), '⑬ 決まった5つの札がいつもある');
    ok(!/#[0-9a-f]{16}/i.test(vis(mh)) && vis(mh).includes(lab), '⑬ このスケジュールの印の札も「' + lab + '」の字で');
    ok(!mh.includes('data-id="' + dd(6) + '"') && !mh.includes('data-id="' + dd(9) + '"'), '⑫⑬ 答えた何も書いていない日・便の読めた日は「読めなかった日」に並べない');
    ok(/class="ru-chip is-sug" data-u="fill" data-id="2026-10-08" data-c="OFF" aria-pressed="false"/.test(mh) && mh.includes('data-u="sugall"'), '⑬ 見た目からの候補は点線で示す（選んだことにはしない）');
    ok(!at(8), '⑬ 候補は押すまで送らない');
    tap(U, { 'data-u': 'sugall' });
    const sd2 = U.sendDays().find((x) => x.date === dd(8));
    ok(sd2 && sd2.code === 'OFF' && !U.missHTML().includes('data-u="sugall"'), '⑬ 「この内容で決める」で候補をまとめて入れる');
    tap(U, { 'data-u': 'fill', 'data-id': dd(10), 'data-c': 'VAC' });
    const cf = U.checkFix(), bad = [dd(8), dd(10), '10/', 'HND', 'KIX', '08:00', '09:10', TOK1.slice(1), 'RDO', 'VAC'];
    ok(cf.n === 2 && !bad.some((x) => cf.text.includes(x)) && cf.text.includes('X Air'), '⑮ 要約は直した数だけ（日付・時刻・空港・コードの字を書かない）：' + cf.text);
    ok(U.sendDays().every((x) => (x.legs || []).every((l) => !('role' in l))), '⑭ 送る日のどの便にも role が無い');

    /* 会社の辞書だけで全部そろう会社 → 聞く画面を出さない（「何も無い日」は送らない） */
    W.open(fakeBox(), { sb: null, airline: 'yy', other: null, airlineLabel: 'Y', done() {}, profile: { codes: {} },
      learned: { ok: true, kind: 'planned', time_ref: 'utc', time_meaning: 'flight', blank: 'none', codes: { OFF: 'off' } } });
    U.prepare({ days: [day(1, { code: 'OFF', cat: 'off' }), day(2, { blank: true, cat: 'blank' }), day(3, { d_on: '07:00', d_off: '12:00' })], issues: [], period: null, hints: { kind: 'actual' } }, 1);
    const q2 = U.asks(), p2 = U.profilePatch();
    /* ★2026-11-11 から「飛んだ分は何月の給与明細に出るか」（pay_lag）だけは、会社の辞書があっても本人に1回聞く（人ごとの答え） */
    ok(!q2.blank && !q2.kind && !q2.codes.length && q2.lag === true && U.needAsk(), '⑪ 会社の辞書でそろう会社には聞かない（聞くのは「明細に出る月」だけ）');
    ok(p2 && p2.kind === 'planned' && p2.time_ref === 'utc' && p2.time_meaning === 'flight' && p2.blank === 'none' && p2.codes.OFF === 'off', '⑪ 辞書の答えを本人の読み方として保存する');
    ok(!U.sendDays().some((x) => x.date === dd(2)) && !U.missHTML().includes('data-id="' + dd(2) + '"'), '⑫ 「何も無い日」なら送らず、読めなかった日にも並べない');
    const q3 = (W.open(fakeBox(), { sb: null, airline: 'yy', other: null, airlineLabel: 'Y', done() {}, profile: { codes: {}, pay_lag: 1 },
      learned: { ok: true, kind: 'planned', time_ref: 'utc', time_meaning: 'flight', blank: 'none', codes: { OFF: 'off' } } }),
      U.prepare({ days: [day(1, { code: 'OFF', cat: 'off' }), day(3, { d_on: '07:00', d_off: '12:00' })], issues: [], period: null, hints: { kind: 'actual' } }, 1), U.asks());
    ok(q3.lag === false && !U.needAsk(), '⑪ 「明細に出る月」を答えてある会社では、何も聞かない');

    /* 運営に知らせる本文 */
    const before = { date: dd(20), code: null, d_on: '07:00', d_off: null, d_off_day: 0, legs: [
      { seq: 1, from: 'HND', to: 'CTS', out: '08:00', in: '09:35', block: null, kind: 'unknown' },
      { seq: 2, from: 'CTS', to: 'HND', out: '11:00', in: '12:40', block: null, kind: 'operating' }] };
    const after = { date: dd(20), code: TOK1, d_on: '07:00', d_off: '13:10', d_off_day: 0, legs: [
      { seq: 1, from: 'HND', to: 'CTS', out: '08:05', in: '09:35', block: '1:30', kind: 'operating' },
      { seq: 2, from: 'CTS', to: 'HND', out: '11:00', in: '12:40', block: '1:35', kind: 'operating' },
      { seq: 3, from: 'HND', to: 'ITM', out: '15:00', in: '16:10', block: '1:10', kind: 'deadhead' }] };
    const sm = U.fixSummary([{ b: before, a: after }, { b: null, a: day(21, { code: 'QRX' }) }], { airline: 'X Air', build: '2026-11-11', pages: 3 });
    const forbid = [dd(20), dd(21), 'HND', 'CTS', 'ITM', '08:0', '09:35', '11:00', '13:10', '1:30', TOK1.slice(1), 'QRX'];
    ok(sm.n === 8 && !forbid.some((x) => sm.text.includes(x)), '⑮ 要約は種類と数だけ（便の時間2・出発時刻1・便の種類1・コード1・D-OFF 1・足した便1・入れた日1）：' + sm.n + ' ' + sm.text);
    const body = U.fixBody(sm, 'x'.repeat(400));
    ok(body.length <= 500 && body.startsWith(sm.text) && U.fixBody(sm, '').length <= 280, '⑮ 本文は500字まで（一言は200字まで）');
    const calls = [], sb = { rpc(n, a) { calls.push([n, a]); return Promise.resolve({ data: { ok: true } }); } };
    const F0 = { open: true, comment: '', msg: null, busy: false, sent: false };
    U.sendFix(F0, sb, U.fixSummary([], { airline: 'X' }), () => {});
    ok(!calls.length && F0.msg, '⑮ 直した所が無ければ、一言（4文字以上）が無いと送らない');
    U.sendFix({ open: true, comment: ' 3日目の便がずれていました ', msg: null, busy: false, sent: false }, sb, sm, () => {});
    const c0 = calls[0];
    ok(c0 && c0[0] === 'pv_request_submit' && c0[1].p_private === true && c0[1].p_category === 'bug' && c0[1].p_body.length <= 500 &&
       !forbid.some((x) => c0[1].p_body.includes(x)), '⑮ 運営だけが見る要望（bug・p_private）として送る');
  } else ok(false, '⑪〜⑮ 取り込みの確認の部品が無い');

  // ⑪ スケジュールのタブでも印を出さない
  const ct = P.cellParts({ isDuty: false, cls: 'off', code: TOK1, legs: [] }), cu = P.cellParts({ isDuty: false, cls: null, code: TOK1, legs: [] });
  ok(!String(ct.main + ct.sub + cu.main + cu.sub).includes('#') && P.codeText(TOK1).indexOf('#') < 0 && P.canon(TOK1.toUpperCase()) === TOK1, '⑪ カレンダー・日の板に印を出さない（意味か「' + P.fill(P.T.tokL, { k: '' }).trim() + '」）');
  const dl = P.legHTML({ seq: 1, from: 'HND', to: 'KIX', out: '08:00', in: '09:10', inDay: 0, blockMin: 70, role: 'CAP', kind: 'deadhead' });
  ok(dl.includes(P.T.kindDh) && !dl.includes('CAP'), '⑭ DH の札は「DH」だけ（乗務の区分を出さない）');
  return fails;
}

let pass = 0, fail = 0;
const say = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

console.log('▼ いまの my-roster.js / roster-upload.js');
const now = checks(load(ROS, UP));
say(now.length === 0, '約束①〜④・⑥〜⑮がすべて守られている' + (now.length ? '：' + now.join(' / ') : ''));
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
  ['④ 地上の業務にも矢印を出す', "var where = l.kind === 'ground'", "var where = false", 'ros'],
  ['⑥ CSV にほかの月の日も書く', "    m.days.forEach(function (x) {\n      var on = x.dOn || x.dOff;", "    S.months.reduce(function (a, y) { return a.concat(y.days); }, []).forEach(function (x) {\n      var on = x.dOn || x.dOff;", 'ros'],
  ['⑥ 地上の業務に空港を書く', "gnd ? '' : (l.from || ''), gnd ? '' : (l.to || '')", "(l.from || ''), (l.to || '')", 'ros'],
  ['⑥ ファイル名に月を入れない', "return { name: 'pilot-value-roster_' + ym, rows: rows };", "return { name: 'pilot-value-roster', rows: rows };", 'ros'],
  ['⑦ 空欄・読めなかった日も送る', "    if (empty(x)) return null;   // ★空欄", "    // ★空欄", 'up'],
  ['⑦ 読めなかった日を月の終わりまで数える', "var a = dates[0], b = dates[dates.length - 1], p = periodOk(period);", "var a = dates[0], b = dates[0].slice(0, 7) + '-31', p = periodOk(period);", 'up'],
  ['⑧ 地上の業務にも空港を残す', "var from = gnd ? '' : upT(l.from), to = gnd ? '' : upT(l.to)", "var from = upT(l.from), to = upT(l.to)", 'up'],
  ['⑧ 時刻を直さずに見る', "var v = P.pad2(+m[1]) + ':' + m[2];", 'var v = s;', 'up'],
  ['⑧ 空港の形を見ない', "if (from && !RX_APT.test(from)) errs[p + 'from'] = 'errApt';", '', 'up'],
  ['⑨ 分からない便の時間を 0:00 で出す', "var op = (opN && opGap >= opN) ? null : v(m.blockMin.operating, P.blockMin.operating);", 'var op = v(m.blockMin.operating, P.blockMin.operating);', 'ros'],
  ['⑩ 手で入れた日もページ数で出す', "(dc.manual ? T.docManual : fill(dc.pages === 1 ? T.docPage1 : T.docPages, { n: dc.pages }))", "fill(dc.pages === 1 ? T.docPage1 : T.docPages, { n: dc.pages })", 'ros'],
  ['⑪ 会社の辞書を見ずに聞く', "codes: unknownCodes().filter(function (c) { return !lr.codes[c]; }) };", 'codes: unknownCodes() };', 'up'],
  ['⑪ 印を大文字にする', "code = codeT(dr.code)", 'code = upT(dr.code)', 'up'],
  ['⑪ 印をそのまま画面に出す', "function codeShow(c) { return P.isTok(c) ? tokName(c) : c; }", 'function codeShow(c) { return c; }', 'up'],
  ['⑫ 「休み」でも何も書いていない日を埋めない', "      if (mode === 'off') {", '      if (false) {', 'up'],
  ['⑬ 候補を押す前に入れてしまう', "    prefill();\n    applyBlank();\n  }", "    prefill();\n    applyBlank();\n    sugRows().forEach(function (dt) { fillCode(dt, sugOf(dt)); });\n  }", 'up'],
  ['⑬ 決まった5つの札を出さない', 'var out = STD_CHIPS.slice();', 'var out = [];', 'up'],
  ['⑬ コードが読めなかった日を便ごと捨てる', "if (x.unread || x.blank) {", "if (x.unread) return true; if (x.blank) {", 'up'],
  ['⑭ 送る便に role を戻す', "block: l.block || null,\n                 kind: l.kind || 'unknown', page", "block: l.block || null, role: 'CAP',\n                 kind: l.kind || 'unknown', page", 'up'],
  ['⑮ 要約に日付を書く', "{ airline: U.ctx.airlineLabel, build", "{ airline: Object.keys(U.edits).join(','), build", 'up'],
  ['⑮ 誰でも見える要望として送る', "p_category: 'bug', p_private: true", "p_category: 'bug', p_private: false", 'up']
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
