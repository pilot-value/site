/* 航空機の写真を assets/airlines/ へ書き出す（台帳は airline-photos.mjs）。
 *
 *   node import-airline-photos.mjs --from <元の写真が入っているフォルダ>
 *   node import-airline-photos.mjs --from <…> --only jal-a350
 *
 * ★元のファイルをそのまま写さない。ブラウザのキャンバスに描いて JPEG で書き出す
 *   ＝ 画素だけが残り、撮影情報（位置・機材・作者名のタグ）は1つも付いてこない。
 *   元の写真のうち1枚には位置情報の枠が残っていた（assert-no-pii.mjs の B が落とす形）。
 * ★元のフォルダの場所をこのファイルに書かない（このリポジトリは公開されていて、
 *   絶対パスには Mac のログイン名が入る）。毎回 --from で渡す。
 * ★引き伸ばさない。元が台帳の w より小さければ止まる。
 * ★何度流しても同じファイルになる（同じ画素を同じ品質で書き出すだけ）。
 *
 * 写真を足すとき：airline-photos.mjs に1行足す → これを流す → node assert-no-pii.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { PHOTOS, PHOTO_DIR, SMALL_W, smallH } from './airline-photos.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FROM = arg('--from');
const ONLY = arg('--only');

if (!FROM || !fs.existsSync(FROM)) {
  console.error('使い方: node import-airline-photos.mjs --from <元の写真が入っているフォルダ>');
  process.exit(1);
}
/* --only の名前が台帳に無いときは止まる（黙って0枚で「終わった」と出さない）。 */
if (ONLY && !Object.values(PHOTOS).flat().some(p => p.file === ONLY)) {
  console.error(`❌ 台帳（airline-photos.mjs）に ${ONLY} が無い`);
  process.exit(1);
}

const OUT = path.join(ROOT, PHOTO_DIR);
fs.mkdirSync(OUT, { recursive: true });

/* 撮影情報の入れ物（APP1＝Exif/XMP・APP13＝IPTC）が付いていないことを、書いた直後に確かめる。 */
function hasMetadata(buf) {
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const m = buf[i + 1];
    if (m === 0xda) break;                       // ここから先は画素
    if (m === 0xe1 || m === 0xed) return true;
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return false;
}

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><title>photos</title>');

let fail = 0, n = 0;
for (const [slug, list] of Object.entries(PHOTOS)) {
  for (const p of list) {
    if (ONLY && ONLY !== p.file) continue;
    const from = path.join(FROM, p.orig);
    if (!fs.existsSync(from)) { console.error(`❌ ${p.file}: 元の写真が無い（${p.orig}）`); fail++; continue; }
    const b64 = fs.readFileSync(from).toString('base64');

    const res = await page.evaluate(async (b64, sizes) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      const out = [];
      for (const s of sizes) {
        if (img.naturalWidth < s.w) return { err: `元が ${img.naturalWidth}px で、書き出す幅 ${s.w}px より小さい` };
        const c = document.createElement('canvas');
        c.width = s.w; c.height = s.h;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        /* 縦横比が1px ずれる写真は、中央を保ったまま端を切って合わせる（歪ませない）。 */
        const k = Math.max(s.w / img.naturalWidth, s.h / img.naturalHeight);
        const sw = s.w / k, sh = s.h / k;
        g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, s.w, s.h);
        out.push(c.toDataURL('image/jpeg', s.q).split(',')[1]);
      }
      return { out, nw: img.naturalWidth, nh: img.naturalHeight };
    }, b64, [
      { w: p.w, h: p.h, q: 0.84 },
      { w: SMALL_W, h: smallH(p), q: 0.8 },
    ]);

    if (res.err) { console.error(`❌ ${p.file}: ${res.err}`); fail++; continue; }

    const names = [`${p.file}.jpg`, `${p.file}-${SMALL_W}.jpg`];
    res.out.forEach((d, i) => {
      const buf = Buffer.from(d, 'base64');
      if (hasMetadata(buf)) { console.error(`❌ ${names[i]}: 撮影情報の入れ物が付いている`); fail++; return; }
      fs.writeFileSync(path.join(OUT, names[i]), buf);
      n++;
    });
    console.log(`✓ ${slug.padEnd(15)} ${p.file.padEnd(16)} ${res.nw}×${res.nh} → ${p.w}×${p.h} / ${SMALL_W}×${smallH(p)}`);
  }
}
await browser.close();

console.log(`\n${n} 枚を ${PHOTO_DIR}/ に書いた` + (fail ? `（❌ ${fail}）` : ''));
process.exit(fail ? 1 : 0);
