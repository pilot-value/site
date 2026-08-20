/* ═══════════════════════════════════════════════════════════════════
   assert-no-pii.mjs — オーナーの身元がリポジトリと本番サイトから辿れないこと

   このリポジトリは PUBLIC で、GitHub Pages が main のルートを丸ごと配信する。
   つまり「リポジトリに入れた」＝「pilot-value.com から誰でも落とせる」。
   実際に以下が 200 で読めていた（2026-08-09 に塞いだ）:
     https://pilot-value.com/shot-remind.mjs   … 検証用サンプルに実名が入っていた
     https://pilot-value.com/patch-payslip.mjs … const ROOT が /Users/<実名由来のID>
     https://pilot-value.com/VISION.md         … 事業戦略
   運営者が誰かを特定されると職業上の実害が出る。

   ── 3つのモードがある ──────────────────────────────────────────────
   node assert-no-pii.mjs             ローカル走査。追跡ファイル全部＋git の作者設定
   node assert-no-pii.mjs --live      本番プローブ。_config.yml の exclude が効いて
                                      いるかは localhost では絶対に分からないので分けた
   node assert-no-pii.mjs --history   git 履歴の中身。今のファイルが綺麗でも、
                                      **過去のコミットは公開リポジトリから誰でも取れる**

   ── 6つの検査 ─────────────────────────────────────────────────────
   A) テキストの中身        追跡テキスト全部（SVG を含む）を1行ずつ RULES に当てる
   B) バイナリのメタデータ  JPEG/PNG/PDF は中身でなく「メタデータの入れ物」だけ開ける。
                            画素は見ない（無駄だし、圧縮バイト列は偽陽性の温床）
   C) 配信される拡張子      _config.yml は除外リスト方式なので、新種のファイル
                            （.csv .sh .log …）が入ると素通しで本番配信される
   D) git の作者            次のコミットと、履歴に残っている作者（メールと表示名の両方）
   E) 本番プローブ          --live のときだけ
   F) git 履歴の中身        --history のときだけ

   ★ なぜ F) が要るか（2026-08-20 に実際に踏んだ）。
     A) は「今のファイル」しか見ない。2026-08-09 に絶対パスを全部消して A) は 0 件に
     なったが、**過去のコミットの中身はそのまま残っていた**。公開リポジトリでは
     raw.githubusercontent.com/<org>/<repo>/<古いSHA>/<ファイル> で誰でも取れるので、
     消したはずの実名が1,400箇所ほど公開されたままだった。A) が通ることは
     「履歴が綺麗」を1ミリも意味しない。

   ★ このスクリプト自身も GitHub 上で公開される。だから実名をここに書かない。
     組み込みルールは「/Users/ で始まる絶対パス」「個人メールのドメイン」のように
     名前を知らなくても当たる形にしてある。特定の氏名など個別の語を足したいときは
     .pii-denylist、勤務先が割れる社内語彙は .employer-denylist
     （どちらも gitignore 済み・ローカル限り）に1行1パターンで書く。
   ═══════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
/* 「何を漏れとみなすか」は pii-rules.mjs に集約してある。
   mail-bot/check-reply-headers.mjs（外へ出るメールの検査）と同じ判定を使うため。
   片方にだけ語を足して、もう片方が素通しするのを避ける。 */
import { PERSONAL_MAIL, BASE_RULES, DENY_FILE, EMPLOYER_FILE, loadDenylist, loadEmployerDenylist, denylistHint } from './pii-rules.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const LIVE = process.argv.includes('--live');
const HISTORY = process.argv.includes('--history');
const ORIGIN = 'https://pilot-value.com';

let fail = 0, ran = 0;
const ok = (cond, name, detail = '') => {
  ran++;
  if (!cond) fail++;
  console.log(`${cond ? '✓' : '✗ FAIL'}  ${name}${detail ? `\n        → ${detail}` : ''}`);
};

/* ══════════════════════════════════════════════════════════════════
   A) 追跡テキストの中身
   ══════════════════════════════════════════════════════════════════ */

/* ルールの実体は pii-rules.mjs。3つの束を足し合わせる:
     組み込み3種            /Users/ 絶対パス・個人メール・他OSのホーム
     .pii-denylist          氏名など、その人を指す固有名詞
     .employer-denylist     勤務先が割れる社内語彙（社名は入れない。理由は pii-rules.mjs）

   ★ 身元と勤務先は別の危険。氏名が漏れれば「誰か」が分かり、社内語彙が漏れれば
     「どこの社員か」が分かる。片方だけでも、もう片方と突き合わせれば特定に届く。 */
const { rules: denyRules, count: denyLoaded } = loadDenylist();
const { rules: empRules, count: empLoaded } = loadEmployerDenylist();
const RULES = [...BASE_RULES, ...denyRules, ...empRules];

/* 走査対象。
   ★ svg はバイナリではなく XML なので、ここ（A）で1行ずつ読む。
     Illustrator や Sketch は書き出すとき作者名を素のテキストで埋めることがあり、
     B) の入れ物パーサより A) の全文走査の方が確実に当たる。
   ★ csv/log/eml/toml/ini を足してある。今は1本も無いが、_config.yml の exclude は
     除外リスト方式なので、この種のファイルを置いた日に黙って本番配信される。
     C) が「見慣れない拡張子」として知らせるより前に、中身をここで見ておく。 */
const TEXT = /\.(mjs|js|ts|json|html|css|md|sql|yml|yaml|txt|xml|svg|sh|command|csv|log|eml|toml|ini)$/i;
const SKIP = /^(package-lock\.json|node_modules\/)/;

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8').split('\0').filter(Boolean);

const SELF = 'assert-no-pii.mjs';
const scanned = [];
const hits = [];

for (const f of tracked) {
  if (f === SELF || !TEXT.test(f) || SKIP.test(f)) continue;
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
  scanned.push(f);
  const lines = src.split('\n');
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(rule.re);
      if (m) hits.push({ f, line: i + 1, rule, sample: m[0] });
    }
  }
}

console.log(`\n── A) 追跡テキスト ${scanned.length} 本を走査（.pii-denylist ${denyLoaded} 件 ＋ .employer-denylist ${empLoaded} 件）──`);
for (const h of hits) {
  console.log(`   ${h.f}:${h.line}  [${h.rule.id}] ${h.sample}`);
  console.log(`        なぜ困る: ${h.rule.why}`);
  console.log(`        直し方  : ${h.rule.fix}`);
}
ok(hits.length === 0, `追跡テキストに個人を特定できる文字列が無い`, hits.length ? `${hits.length} 件` : '');

/* ★ 無いときに素通しさせない。
   組み込みルールだけでも /Users/ 絶対パスと個人メールは止まるが、氏名は1つも止まらない。
   Mac を替えて作り直し忘れたときに「✓ 全部通った」と出るのが一番危ないので、落とす。 */
ok(denyLoaded > 0,
   '.pii-denylist が存在して1件以上読めている（氏名の検査が生きている）',
   denyLoaded > 0 ? '' : denylistHint(DENY_FILE));

ok(empLoaded > 0,
   '.employer-denylist が存在して1件以上読めている（勤務先の検査が生きている）',
   empLoaded > 0 ? '' : denylistHint(EMPLOYER_FILE));

/* ══════════════════════════════════════════════════════════════════
   B) バイナリのメタデータ

   A) はテキストしか見ないので、jpg / png / pdf は1本も検査されていなかった。
   カメラの写真は撮影地の緯度経度を、Word や Illustrator が書き出す PDF は
   OS のアカウント名を、それぞれ既定で埋める。中身を1文字も読まずに身元が出る。

   ★ 画素は見ない。メタデータの「入れ物」だけを開けて、そこの文字列に RULES を当てる。
     圧縮された画素バイト列から可読文字列を拾うやり方だと、5文字程度のパターンが
     偶然一致して不定期に落ちるようになる（検査が信用されなくなるのが一番まずい）。
   ══════════════════════════════════════════════════════════════════ */
const BIN = /\.(jpe?g|png|pdf|webp)$/i;

/* PNG: 長さ4 + 型4 + データ + CRC4 の連なり */
function pngChunks(b) {
  const out = [];
  if (b.length < 8) return out;
  let i = 8;
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString('latin1', i + 4, i + 8);
    if (len > b.length) break;
    out.push({ type, data: b.subarray(i + 8, i + 8 + len) });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

/* JPEG: SOI のあと 0xFF+マーカー+長さ2+データ。SOS(0xDA) から先は画素なので見ない */
function jpegSegments(b) {
  const out = [];
  if (b[0] !== 0xff || b[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break;
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) break;
    const len = b.readUInt16BE(i + 2);
    if (len < 2) break;
    out.push({ marker: m, data: b.subarray(i + 4, i + 2 + len) });
    i += 2 + len;
  }
  return out;
}

/* TIFF(EXIF) の IFD を歩いて、ASCII タグの値と GPS IFD の有無を返す。
   ExifIFD(0x8769) と GPSIFD(0x8825) はネストするので追う。 */
function exifRead(t) {
  const res = { ascii: [], gps: false };
  if (t.length < 8) return res;
  const le = t.toString('latin1', 0, 2) === 'II';
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  try {
    if (u16(2) !== 42) return res;
    const seen = new Set();
    const walk = (off, depth) => {
      if (depth > 3 || off <= 0 || off + 2 > t.length || seen.has(off)) return;
      seen.add(off);
      const n = u16(off);
      for (let k = 0; k < n; k++) {
        const e = off + 2 + k * 12;
        if (e + 12 > t.length) return;
        const tag = u16(e), typ = u16(e + 2), cnt = u32(e + 4);
        if (tag === 0x8825) res.gps = true;
        if (tag === 0x8769 || tag === 0x8825) walk(u32(e + 8), depth + 1);
        else if (typ === 2 && cnt > 1 && cnt < 4096) {
          const p = cnt <= 4 ? e + 8 : u32(e + 8);
          if (p >= 0 && p + cnt <= t.length) {
            const v = t.toString('utf8', p, p + cnt).replace(/\0+$/, '').trim();
            if (v) res.ascii.push({ tag, v });
          }
        }
      }
    };
    walk(u32(4), 0);
  } catch { /* 壊れた EXIF は「読めなかった」で済ませる。ここで落とす意味はない */ }
  return res;
}

/* 人が書いた「誰が作ったか」の欄。値そのものは RULES で判定するが、
   埋まっていること自体を目視できるように別枠で出す。 */
const AUTHOR_TAGS = { 0x010e: 'ImageDescription', 0x013b: 'Artist', 0x8298: 'Copyright', 0x9c9d: 'XPAuthor' };

/* そのファイルのメタデータを [{ where, text }] で返す */
function binMeta(file, b) {
  const out = [];
  const ext = path.extname(file).toLowerCase();

  if (ext === '.png') {
    for (const c of pngChunks(b)) {
      if (c.type === 'tEXt') out.push({ where: 'tEXt', text: c.data.toString('utf8').replace(/\0/g, ' = ') });
      else if (c.type === 'iTXt') out.push({ where: 'iTXt/XMP', text: c.data.toString('utf8') });
      else if (c.type === 'zTXt') {
        const z = c.data.indexOf(0);
        try { out.push({ where: 'zTXt', text: zlib.inflateSync(c.data.subarray(z + 2)).toString('utf8') }); } catch {}
      } else if (c.type === 'eXIf') {
        const x = exifRead(c.data);
        if (x.gps) out.push({ where: 'eXIf', text: '★GPS-IFD', gps: true });
        for (const a of x.ascii) out.push({ where: `eXIf/${AUTHOR_TAGS[a.tag] ?? '0x' + a.tag.toString(16)}`, text: a.v, author: a.tag in AUTHOR_TAGS });
      }
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    for (const s of jpegSegments(b)) {
      /* ★ APPn(0xE0-0xEF) と COM(0xFE) だけがメタデータ。
         DQT/DHT/SOF は量子化テーブルとハフマン表＝ただのバイト列で、
         ここを文字列として読むと偽陽性しか生まない。 */
      const isMeta = (s.marker >= 0xe0 && s.marker <= 0xef) || s.marker === 0xfe;
      if (!isMeta) continue;
      /* APP0=JFIF は固定ヘッダ、APP2=ICC は色プロファイル。どちらも PII を持たない。
         ICC は数十KB あって出力を埋めるだけなので開けない。 */
      if (s.marker === 0xe0) continue;
      if (s.marker === 0xe2 && s.data.toString('latin1', 0, 11) === 'ICC_PROFILE') continue;
      if (s.marker === 0xe1 && s.data.toString('latin1', 0, 4) === 'Exif') {
        const x = exifRead(s.data.subarray(6));
        if (x.gps) out.push({ where: 'APP1/Exif', text: '★GPS-IFD', gps: true });
        for (const a of x.ascii) out.push({ where: `APP1/${AUTHOR_TAGS[a.tag] ?? '0x' + a.tag.toString(16)}`, text: a.v, author: a.tag in AUTHOR_TAGS });
      } else {
        out.push({ where: s.marker === 0xfe ? 'COM' : `APP${s.marker - 0xe0}`, text: s.data.toString('utf8') });
      }
    }
  } else if (ext === '.webp') {
    /* RIFF: 12バイトのあと 型4 + 長さ4 + データ（奇数長はパディング1） */
    let i = 12;
    while (i + 8 <= b.length) {
      const t = b.toString('latin1', i, i + 4);
      const len = b.readUInt32LE(i + 4);
      if (len > b.length) break;
      const d = b.subarray(i + 8, i + 8 + len);
      if (t === 'EXIF') {
        const x = exifRead(d);
        if (x.gps) out.push({ where: 'EXIF', text: '★GPS-IFD', gps: true });
        for (const a of x.ascii) out.push({ where: `EXIF/${AUTHOR_TAGS[a.tag] ?? '0x' + a.tag.toString(16)}`, text: a.v, author: a.tag in AUTHOR_TAGS });
      } else if (t === 'XMP ') out.push({ where: 'XMP', text: d.toString('utf8') });
      i += 8 + len + (len % 2);
    }
  } else if (ext === '.pdf') {
    const s = b.toString('latin1');
    /* 文書情報辞書。Word / Illustrator / Pages はここに OS のアカウント名を入れる */
    for (const m of s.matchAll(/\/(Author|Title|Subject|Keywords|Creator|Producer)\s*\(((?:\\.|[^\\)])*)\)/g)) {
      out.push({ where: `/${m[1]}`, text: m[2], author: m[1] === 'Author' });
    }
    /* XMP パケット（dc:creator などが入る） */
    for (const m of s.matchAll(/<\?xpacket begin[\s\S]{0,60000}?<\?xpacket end[^>]*\?>/g)) {
      out.push({ where: 'XMP', text: Buffer.from(m[0], 'latin1').toString('utf8') });
    }
  }
  return out;
}

const binFiles = tracked.filter((f) => BIN.test(f) && !SKIP.test(f));
const binHits = [];
const binNotes = [];
let withMeta = 0;

for (const f of binFiles) {
  let b;
  try { b = fs.readFileSync(path.join(ROOT, f)); } catch { continue; }
  const meta = binMeta(f, b);
  if (meta.length) withMeta++;
  for (const m of meta) {
    if (m.gps) {
      binHits.push({ f, where: m.where, id: 'gps',
        why: '撮影地の緯度経度。自宅・勤務先・よく行く空港が特定できる',
        fix: '画像から EXIF を落とす（プレビュー.app で書き出し直すか、スクリーンショットに置き換える）',
        sample: 'GPS IFD が入っている' });
      continue;
    }
    for (const rule of RULES) {
      const hit = m.text.match(rule.re);
      if (hit) binHits.push({ f, where: m.where, id: rule.id, why: rule.why, fix: rule.fix, sample: hit[0] });
    }
    if (m.author && m.text.trim()) binNotes.push(`${f}  [${m.where}] ${m.text.trim().slice(0, 80)}`);
  }
}

console.log(`\n── B) 追跡バイナリ ${binFiles.length} 本のメタデータ（${withMeta} 本が何か持っている）──`);
for (const h of binHits) {
  console.log(`   ${h.f}  [${h.where}] ${h.sample}`);
  console.log(`        なぜ困る: ${h.why}`);
  console.log(`        直し方  : ${h.fix}`);
}
ok(binHits.length === 0,
   'バイナリのメタデータに位置情報・個人を特定できる文字列が無い',
   binHits.length ? `${binHits.length} 件` : '');

/* 作者欄が埋まっていること自体は違反ではない（航空会社のロゴは先方が入れている）。
   落とさずに見せるだけにして、自分で作った画像に紛れ込んだときに気づけるようにする。 */
if (binNotes.length) {
  console.log(`   ⚠️  作者欄が埋まっているファイル ${binNotes.length} 件（第三者の素材なら問題ない。自作なら消す）`);
  for (const n of binNotes.slice(0, 10)) console.log(`        ${n}`);
}

/* ══════════════════════════════════════════════════════════════════
   C) 本番で配信される拡張子

   _config.yml の exclude は「除外リスト方式」。つまり、そこに書いていない種類の
   ファイルは全部配信される。将来 .csv や .log や .bak をコミットしたとき、
   誰も何も言わないまま pilot-value.com から落とせるようになる。
   「配信されて良い拡張子」の側を明示して、増えたら気づけるようにする。
   ══════════════════════════════════════════════════════════════════ */
const SERVED_EXT = new Set(['html', 'css', 'js', 'json', 'xml', 'txt', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'ico', 'webmanifest', 'woff', 'woff2']);
const SERVED_NOEXT = new Set(['CNAME']);

/* _config.yml の exclude: を読む。ここが唯一の正なので、値をここに書き写さない */
const cfgSrc = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
const excludes = [];
{
  let inList = false;
  for (const raw of cfgSrc.split('\n')) {
    if (/^exclude:\s*$/.test(raw)) { inList = true; continue; }
    if (inList) {
      const m = raw.match(/^\s+-\s*"?([^"#\s]+)"?/);
      if (m) { excludes.push(m[1]); continue; }
      if (/^\S/.test(raw)) break;   // 次のトップレベルキーで終わり
    }
  }
}
/* Jekyll は先頭が . か _ のものを既定で配信しない（EntryFilter#special?）。
   .gitignore と _config.yml が本番で 404 なのを実測済み。 */
const isExcluded = (f) =>
  f.split('/').some((seg) => seg.startsWith('.') || seg.startsWith('_')) ||
  excludes.some((e) =>
    e.startsWith('*.') ? f.toLowerCase().endsWith(e.slice(1).toLowerCase())
    : e.endsWith('/')  ? f === e.slice(0, -1) || f.startsWith(e)
    : f === e);

const servedFiles = tracked.filter((f) => !isExcluded(f));
const unexpected = servedFiles.filter((f) => {
  const base = path.basename(f);
  const ext = path.extname(base).slice(1).toLowerCase();
  return ext ? !SERVED_EXT.has(ext) : !SERVED_NOEXT.has(base);
});

console.log(`\n── C) 本番で配信される ${servedFiles.length} 本の拡張子（除外ルール ${excludes.length} 件を適用）──`);
for (const f of unexpected) console.log(`   ${f}`);
ok(unexpected.length === 0,
   '見慣れない種類のファイルが本番から配信されない',
   unexpected.length
     ? `${unexpected.length} 件。配信して良いなら assert-no-pii.mjs の SERVED_EXT に足す。`
       + `そうでないなら _config.yml の exclude に足して --live で 404 を確認する`
     : '');

/* ══════════════════════════════════════════════════════════════════
   D) git の作者設定 — ここが個人メールだと、次のコミットで履歴に刻まれる
   ══════════════════════════════════════════════════════════════════ */
const gitcfg = (k) => {
  try { return execFileSync('git', ['config', k], { cwd: ROOT }).toString().trim(); }
  catch { return ''; }
};
const cfgMail = gitcfg('user.email');
const cfgName = gitcfg('user.name');
console.log(`\n── D) git の作者 ──`);
ok(cfgMail !== '' && !PERSONAL_MAIL.test(cfgMail),
   'これから作るコミットの作者メールが個人メールでない',
   cfgMail ? `user.email = ${cfgMail}` : 'user.email が未設定（グローバル設定が使われる）');

/* ★ 表示名も履歴に刻まれる。メールだけ直して user.name が本名のままだと、
     コミット1本で氏名が公開される。グローバル設定を引き継いだときに起きる。 */
const badCfgName = cfgName ? RULES.filter((r) => r.re.test(cfgName)) : [];
ok(cfgName !== '' && badCfgName.length === 0,
   'これから作るコミットの作者表示名が本名でない',
   cfgName
     ? (badCfgName.length ? `user.name = ${cfgName} が [${badCfgName.map((r) => r.id).join(', ')}] に当たる` : '')
     : 'user.name が未設定（グローバル設定が使われる）');

/* 履歴に残っている作者。書き換え済みなら1種類だけになる。
   ★ %ae/%ce（メール）に加えて %an/%cn（表示名）も見る。
     2026-08-09 の書き換えでメールは統一されたが、表示名は別の欄で、
     ここを見ていないと本名のまま残っていても気づけない。 */
const idents = execFileSync('git', ['log', '--all', '--format=%ae%n%ce%n%an%n%cn'],
  { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString().split('\n').map((s) => s.trim()).filter(Boolean);
const authors = [...new Set(idents)];
const badAuthors = authors.filter((a) => PERSONAL_MAIL.test(a) || RULES.some((r) => r.re.test(a)));
ok(badAuthors.length === 0,
   `git 履歴の作者に個人メール・本名が無い（メールと表示名で ${authors.length} 種類）`,
   badAuthors.length ? badAuthors.join(', ') : '');

/* ══════════════════════════════════════════════════════════════════
   E) 本番プローブ（--live のときだけ）
      _config.yml の exclude は GitHub Pages のビルドでしか効かない。
      push 後1〜2分待ってから走らせる。
   ══════════════════════════════════════════════════════════════════ */
const MUST_404 = [
  // 実名・ローカルパスが入っていた本体
  'shot-remind.mjs', 'shot-pay.mjs', 'patch-payslip.mjs',
  'db/test-remind.mjs', 'db/test-form-contract.mjs',
  // 設計ドキュメント（CLAUDE.md はリポジトリ構造の地図＝他への案内板になる）
  'CLAUDE.md', 'VISION.md', 'VERIFIED-PILOT.md', 'DATA-PROVENANCE.md',
  'workflows/update-salary.md', 'workflows/add-airline.md',
  // 内部構造
  'salary-data.mjs', 'salary-sources.mjs', 'check-salary.mjs', 'assert-no-pii.mjs',
  // ドットで始まるものは Jekyll が既定で外す。「そのはず」で済ませずここで実測する
  '.githooks/pre-commit', '.gitignore',
  'db/contacts.sql', 'db/pay-reports.sql',
  'supabase/functions/notify-admin/index.ts',
  'mail-bot/send.mjs', 'tweet-bot/post.mjs',
  'package.json', 'package-lock.json',
];

/* ★ ここを 404 にしてしまうとサイトが壊れる。_config.yml を書き換えたら必ず通す */
const MUST_200 = [
  '', 'sitemap.xml', 'robots.txt',
  'currency.js', 'salary-leveling.js', 'payslip.js',
  'salary-data.json', 'airline-codes.json', 'pv-vocab.json',
  'airlines/ana.html', 'airlines/airline-base.js',
  'en/index.html', 'countries/japan.html', 'assets/logo.png',
];

const status = async (p) => {
  try {
    const r = await fetch(`${ORIGIN}/${p}`, { redirect: 'follow' });
    return r.status;
  } catch (e) { return `ERR(${e.message})`; }
};

if (LIVE) {
  console.log(`\n── E) 本番プローブ ${ORIGIN} ──`);

  const gone = await Promise.all(MUST_404.map(status));
  const stillServed = MUST_404.filter((p, i) => gone[i] === 200);
  ok(stillServed.length === 0,
     `ツール・ドキュメント ${MUST_404.length} 本が本番から配信されていない`,
     stillServed.length ? stillServed.map((p) => `${ORIGIN}/${p} がまだ 200`).join('\n        → ') : '');

  const live = await Promise.all(MUST_200.map(status));
  const broken = MUST_200.filter((p, i) => live[i] !== 200);
  ok(broken.length === 0,
     `サイトが実行時に読むファイル ${MUST_200.length} 本が 200 のまま（壊していない）`,
     broken.length ? broken.map((p, i) => `${ORIGIN}/${p} → ${live[MUST_200.indexOf(p)]}`).join('\n        → ') : '');

  if (broken.length) {
    console.log(`\n   ⚠️  _config.yml の exclude が行き過ぎている。該当を exclude から外して push し直す。`);
  }
} else {
  console.log(`\n── E) 本番プローブはスキップ（node assert-no-pii.mjs --live で実行）──`);
  console.log(`      _config.yml の exclude が効いているかは本番でしか確認できない。push 後に必ず走らせる。`);
}

/* ══════════════════════════════════════════════════════════════════
   F) git 履歴の中身（--history のときだけ）

   A) は「今のファイル」しか見ない。だが公開リポジトリでは過去のコミットも
   そのまま配られる:
     raw.githubusercontent.com/<org>/<repo>/<古いSHA>/<ファイル>
   2026-08-09 に絶対パスを全部消して A) は 0 件になったのに、履歴には
   実名由来のログイン名が 1,400 箇所ほど残ったままで、実際に外から取れていた
   （2026-08-20 に発見）。**A) が通ることは「履歴が綺麗」を意味しない。**

   ★ 見つかったときの直し方は「その行を直して commit」ではない。
     過去のコミットは書き換えても GitHub 側に残りうる（unreachable object や
     外部のミラー）。**リポジトリを作り直して古い方を消す**しかない。

   毎回の commit では走らせない（.githooks/pre-commit は A〜D だけ）。
   履歴を触ったとき、公開する前、Mac を替えたときに手で走らせる。
   ══════════════════════════════════════════════════════════════════ */
if (HISTORY) {
  console.log(`\n── F) git 履歴の中身 ──`);

  /* 「<sha> <パス>」の行が blob と tree。同じ中身は何度コミットされても sha が
     1つなので、ここで自然に潰れる。パスが分かるので拡張子で絞れる。 */
  const pathOf = new Map();
  const objLines = execFileSync('git', ['rev-list', '--all', '--objects'],
    { cwd: ROOT, maxBuffer: 512 * 1024 * 1024 }).toString().split('\n');
  for (const line of objLines) {
    const sp = line.indexOf(' ');
    if (sp < 0) continue;                        // パスの無い行＝コミット
    const sha = line.slice(0, sp);
    const f = line.slice(sp + 1);
    if (!f || f === SELF || !TEXT.test(f) || SKIP.test(f)) continue;
    if (!pathOf.has(sha)) pathOf.set(sha, f);    // 同じ blob が別名で入っていても1回
  }

  /* git cat-file --batch は「<sha> <型> <長さ>\n<中身>\n」を続けて吐く。
     ★中身は長さで切る。改行で切ると、改行を含むファイルで必ず壊れる。 */
  const readBlobs = (shas, onBlob) => {
    for (let i = 0; i < shas.length; i += 500) {   // 500 ずつに割ってメモリを抑える
      const out = execFileSync('git', ['cat-file', '--batch'],
        { cwd: ROOT, input: shas.slice(i, i + 500).join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
      let pos = 0;
      while (pos < out.length) {
        const nl = out.indexOf(0x0a, pos);
        if (nl < 0) break;
        const parts = out.slice(pos, nl).toString('utf8').split(' ');
        const start = nl + 1;
        if (parts.length < 3) { pos = start; continue; }        // 「<sha> missing」
        const [sha, type, sizeStr] = parts;
        const size = Number(sizeStr);
        if (!Number.isFinite(size)) { pos = start; continue; }
        if (type === 'blob') onBlob(sha, out.slice(start, start + size));
        pos = start + size + 1;                                  // 中身のあとに改行が1つ
      }
    }
  };

  /* 1つの blob につき、当たったルールごとに1件だけ拾う（同じ穴を何百行も出さない） */
  const scanBody = (buf) => {
    const lines = buf.toString('utf8').split('\n');
    const found = [];
    for (const rule of RULES) {
      for (let n = 0; n < lines.length; n++) {
        const m = lines[n].match(rule.re);
        if (m) { found.push({ line: n + 1, rule, sample: m[0] }); break; }
      }
    }
    return found;
  };

  const reachable = [...pathOf.keys()];
  const histHits = [];
  readBlobs(reachable, (sha, buf) => {
    for (const h of scanBody(buf)) histHits.push({ ...h, sha, f: pathOf.get(sha) });
  });

  /* まず種類ごとの数。114件の詳細を眺めるより、内訳の方が先に要る */
  if (histHits.length) {
    const byRule = new Map();
    for (const h of histHits) byRule.set(h.rule.id, (byRule.get(h.rule.id) || 0) + 1);
    const byFile = new Set(histHits.map((h) => h.f));
    console.log(`   内訳: ${[...byRule].map(([id, n]) => `${id} ${n}`).join(' / ')}`
      + `（${byFile.size} 種類のファイル・${new Set(histHits.map((h) => h.sha)).size} 個の blob）`);
  }

  /* どのコミットに入っているかまで出す。0件のはずなので先頭20件で足りる */
  for (const h of histHits.slice(0, 20)) {
    let where = '';
    try {
      where = execFileSync('git', ['log', '--all', '--format=%h', '--find-object=' + h.sha],
        { cwd: ROOT }).toString().trim().split('\n').slice(0, 5).join(' ');
    } catch { /* 見つからなくても報告は続ける */ }
    console.log(`   ${h.f}:${h.line}  [${h.rule.id}] ${h.sample}`);
    console.log(`        blob ${h.sha.slice(0, 12)}${where ? ` / コミット ${where}` : ''}`);
  }
  if (histHits.length > 20) console.log(`   … 他 ${histHits.length - 20} 件`);

  ok(histHits.length === 0,
     `git 履歴のテキスト ${reachable.length} 本に個人を特定できる文字列が無い`,
     histHits.length
       ? `${histHits.length} 件。**この行を直して commit しても消えない。**\n`
       + `        公開リポジトリなら raw.githubusercontent.com から古い SHA で今も取れる。\n`
       + `        直し方: 履歴の無いリポジトリを作り直して push し、古い方を削除する`
       : '');

  /* ── ここから下は落とさない。手元にしか無いものなので公開はされていない ── */

  /* 到達できない blob（force push や rebase の残骸）。push はされないが、
     「作り直したのに古い中身がまだ手元に居る」ことを知らせる価値がある。
     パスが無いので拡張子で絞れない。大きいものは飛ばす。 */
  const allBlobs = execFileSync('git',
    ['cat-file', '--batch-all-objects', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    { cwd: ROOT, maxBuffer: 512 * 1024 * 1024 }).toString().split('\n');
  const reach = new Set(reachable);
  const orphanShas = [];
  for (const line of allBlobs) {
    const [sha, type, size] = line.split(' ');
    if (type !== 'blob' || reach.has(sha)) continue;
    if (Number(size) > 2 * 1024 * 1024) continue;
    orphanShas.push(sha);
  }
  const orphanHits = new Set();
  readBlobs(orphanShas, (sha, buf) => { if (scanBody(buf).length) orphanHits.add(sha); });

  console.log(`\n   到達できない blob ${orphanShas.length} 個のうち ${orphanHits.size} 個に当たりがある`);
  if (orphanHits.size) {
    console.log(`   ⚠️  手元の .git に、もう参照されていない古い中身が残っている。`);
    console.log(`      push はされないが、この .git を誰かに渡すと出る。`);
    console.log(`      消すには: git reflog expire --expire=now --all && git gc --prune=now`);
  }
} else {
  console.log(`\n── F) git 履歴の中身はスキップ（node assert-no-pii.mjs --history で実行）──`);
  console.log(`      今のファイルが綺麗でも、過去のコミットは公開リポジトリから誰でも取れる。`);
}

console.log(`\n==== ${ran - fail}/${ran} passed ====`);
process.exit(fail ? 1 : 0);
