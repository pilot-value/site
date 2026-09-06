/* patch-my-value.mjs — 明細を出した直後の着地先を市場価値レポートに変える。

   背景：VERIFIED-PILOT の Give to Get は「明細を出す＝完全版の市場価値レポートが返る」
   という約束。いままで投稿直後のボタンは profile.html#pay-tracker（自分の記録の一覧）
   へ行っていた。記録は Give の控えであって、Get ではない。

   やることは1つだけ：
     投稿完了カードの主ボタンをレポート本体へ向け、文言を Get 側に直す。

   ★2026-09-06、レポートの置き場が変わった。my-value.html（1枚のページ）は
     MY PAGE の ③ YOUR PAY に統合され、あの住所は転送1枚になった。
     行き先を profile.html?new=1#your-pay に直してある。
     #your-pay まで書くのは、①②を飛ばして実額のところへ着けるため。

   ★ ?new=1 は **文言だけ** 変える印。数字は my_pay_reports() から作るので、
     初回の着地と翌月の再訪でページは同一になる（my-value.js の isNew を参照）。
   ★ 「別の月を出す」は残す。連続投稿の導線を潰さない。

   実行: node patch-my-value.mjs */
import { readFileSync, writeFileSync } from 'fs';

const FILES = [
  {
    f: 'pay-report.html',
    from: '<a href="my-value.html?new=1" class="btn-orange justify-center flex-1">マイレポートを見る →</a>',
    to:   '<a href="profile.html?new=1#your-pay" class="btn-orange justify-center flex-1">マイレポートを見る →</a>',
  },
  {
    f: 'en/pay-report.html',
    from: '<a href="my-value.html?new=1" class="btn-orange justify-center flex-1">See my report →</a>',
    to:   '<a href="profile.html?new=1#your-pay" class="btn-orange justify-center flex-1">See my report →</a>',
  },
];

let n = 0;
for (const { f, to, from } of FILES) {
  const s = readFileSync(f, 'utf8');

  // 二重適用よけ
  if (s.includes(to)) { console.log(`skip (already patched): ${f}`); continue; }

  const hits = s.split(from).length - 1;
  if (hits !== 1) throw new Error(`anchor not unique (${hits}): ${f}`);

  const out = s.replace(from, to);
  if (out === s) throw new Error(`no change: ${f}`);
  writeFileSync(f, out);
  n++;
  console.log(`patched: ${f}`);
}
console.log(`\n${n} file(s) patched`);
if (n !== 2 && n !== 0) throw new Error(`expected 2 files, got ${n}`);
