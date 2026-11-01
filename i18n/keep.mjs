/* ════════════════════════════════════════════════════════════════
   i18n/keep.mjs — 訳さずにそのまま残す文（会社名・サービスの名前）
   translate-tm.mjs（AI に渡さない）と gen-lang.mjs（訳し漏れに数えない）が同じ物差しを使う。
   ════════════════════════════════════════════════════════════════ */
import { SALARY } from '../salary-data.mjs';
import { OPS } from '../airline-ops.mjs';
import { plain } from '../i18n-core.mjs';

export const KEEP = new Set(['PILOT VALUE', 'REAL PAY', 'DEEP PAY', 'VOTE', 'Give & Get', 'FOUNDING PILOT']);   // サービスの名前
for (const d of [...Object.values(SALARY), ...Object.values(OPS)]) {
  if (!d.en) continue;
  KEEP.add(d.en); KEEP.add(d.en.replace(/\s*\(.*?\)\s*/g, '').trim());
  for (const a of d.alias || []) if (/^[\x20-\x7e]+$/.test(a)) KEEP.add(a);
}

/* AI に訳させる文か（英字が2つ以上並び、残す名前そのものではない） */
export const needsAI = (key) => /[A-Za-z]{2,}/.test(plain(key)) && !KEEP.has(plain(key));
