/* ════════════════════════════════════════════════════════════════
   i18n/seo-es.mjs — スペイン語のページの題名と説明文を、中南米の検索の言い方に合わせて組み直す（2026-11-03 段4）

   ★オーナー指示「SEO も上位3位に入るように徹底的に。新しい記事は不要」。
     本文は変えない（訳のまま）。変えるのは <title>（og:title も同じ字）と meta description だけ。
   ★根拠（2026-11-03 の調べ：Google の候補とトレンド・MX/CO/CL/PE/AR）
     ・問いの形「¿Cuánto gana un piloto de {会社}?」が、会社名つきの検索でもいちばん多い。
     ・salario より sueldo。piloto だけだと F1・空軍・運河の水先人と混ざる → 会社名の無い題名は「piloto de avión」。
     ・副操縦士は検索では「copiloto」。職位の正式名は primer oficial ＝ 説明文は「copiloto (primer oficial)」。
     ・スペインは「cobrar」（スペインのページだけ）。チリは「piloto comercial」。メキシコは「piloto aviador」。
   ★守ること
     ・数字を盛らない・足さない。題名に額を書かない（額は説明文の訳のまま＝ 本文と同じ数）。
     ・「verificado」「oficial」と書かない。年の字は英語の題名に在る年だけ（無ければ書かない＝古い年を残さない）。
     ・年収の無い会社（道B）は「¿Cuánto gana…?」にしない（答えがページに無い）。訳のまま。
   ════════════════════════════════════════════════════════════════ */
import { SALARY } from '../salary-data.mjs';

const BRAND = ' | PILOT VALUE';
/* 題名に出す会社の名前（スペイン語の正しい綴りがあるものだけ） */
const NAME_ES = { aeromexico: 'Aeroméxico' };
const yearOf = (s) => (s.match(/\b(20\d\d)\b/) || [])[1] || '';

/* 説明文：副操縦士は検索の言い方（copiloto）を先に。最初の1か所だけ */
function copiloto(d) {
  /* すぐ後ろに括弧（額の幅）が続くときは括弧を重ねない ＝ copilotos だけ */
  if (/\bprimeros oficiales\b/.test(d)) return d.replace(/\bprimeros oficiales\b( \()?/, (m, p) => (p ? 'copilotos' + p : 'copilotos (primeros oficiales)'));
  if (/\bprimer oficial\b/i.test(d)) return d.replace(/\b([Pp])rimer oficial\b( \()?/, (m, P, p) => (P === 'P' ? 'Copiloto' : 'copiloto') + (p ? p : ' (primer oficial)'));
  return d;
}

/* 長さの線は assert-seo.mjs と同じ（題名 70・説明文 100〜170。全角は2つと数える） */
const width = (s) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const TITLE_MAX = 70, DESC_MAX = 170, DESC_MIN = 100;
/* 題名：候補を順に試し、線に収まる最初のもの（言葉と年を残し、社名の飾りを先に落とす） */
const fit = (...cands) => cands.find((t) => t && width(t) <= TITLE_MAX) || cands[cands.length - 1];

/* 説明文を線に収める。数字は1つも作らない・書き換えない（落とすのは幅の括弧と後ろの文だけ） */
export function shortenDesc(d) {
  let s = d.replace(/US\$ ([\d.,]+) mil\s*[–-]\s*US\$ ([\d.,]+) mil/g, (m, a, b) => `US$ ${a}–${b} mil`)
    .replace(/de US\$ ([\d.,]+) mil a US\$ ([\d.,]+) mil/g, (m, a, b) => `US$ ${a}–${b} mil`);
  if (width(s) <= DESC_MAX) return s;
  /* 後ろの文から落とす（100字は残す） */
  const parts = s.split(/(?<=[.!?])\s+/);
  while (parts.length > 1 && width(parts.join(' ')) > DESC_MAX && width(parts.slice(0, -1).join(' ')) >= DESC_MIN) parts.pop();
  s = parts.join(' ');
  if (width(s) <= DESC_MAX) return s;
  /* 額の幅の括弧を後ろから落とす */
  let m;
  while (width(s) > DESC_MAX && (m = [...s.matchAll(/ \((?:US\$|de US\$)[^()]*\)/g)].pop())) s = s.slice(0, m.index) + s.slice(m.index + m[0].length);
  if (width(s) <= DESC_MAX) return s;
  s = s.replace('copilotos (primeros oficiales)', () => 'copilotos').replace('copiloto (primer oficial)', () => 'copiloto');
  if (width(s) <= DESC_MAX) return s;
  /* 最後の手：語の切れ目で切って … */
  const cut = s.slice(0, DESC_MAX - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—–-]\s*$/, '') + '…';
}

export function seoFix({ bare, title, desc }) {
  const r = fix({ bare, title, desc });
  return { title: fit(r.title, r.title.endsWith(BRAND) ? r.title.slice(0, -BRAND.length) : ''), desc: shortenDesc(r.desc) };
}

function fix({ bare, title, desc }) {
  const y = yearOf(title);
  /* 会社のページ（推定年収がある会社だけ） */
  const a = bare.match(/^airlines\/([a-z0-9-]+)\.html$/);
  if (a && SALARY[a[1]]) {
    const en = SALARY[a[1]].en;
    const name = NAME_ES[a[1]] || en;
    /* 短い名前：括弧の中の略称（Japan Airlines (JAL) → JAL）か、括弧を外した名前 */
    const abbr = (name.match(/\(([^()]+)\)\s*$/) || [])[1];
    const bareName = name.replace(/\s*\([^()]*\)\s*$/, '');
    const q = (n) => `¿Cuánto gana un piloto de ${n}?`;
    /* 年の字は英語の題名に在るときだけ（古い年を残さない）。無ければ「Sueldo estimado」 */
    const tail = y ? ` Sueldo ${y}` : ' Sueldo estimado';
    const t = fit(q(name) + tail + BRAND, q(name) + tail, q(bareName) + tail + BRAND, abbr && q(abbr) + tail + BRAND,
      q(bareName) + tail, q(name) + BRAND, q(bareName) + BRAND, q(name), q(bareName));
    let d = copiloto(desc);
    if (NAME_ES[a[1]]) d = d.split(en).join(name);
    return { title: t, desc: d };
  }
  /* 国のページ */
  const c = bare.match(/^countries\/([a-z-]+)\.html$/);
  if (c) {
    const m = title.match(/^Sueldo de pilotos en (.+?)(?: 20\d\d)?\s+—/);
    if (!m) return { title, desc };
    const pais = m[1];
    const q = c[1] === 'spain' ? `¿Cuánto cobra un piloto de avión en ${pais}?`
      : c[1] === 'chile' ? `¿Cuánto gana un piloto comercial en ${pais}?`
        : `¿Cuánto gana un piloto de avión en ${pais}?`;
    let d = copiloto(desc);
    if (c[1] === 'mexico') d = d.replace(/^Remuneración de pilotos en México/, () => 'Sueldo de piloto aviador en México');
    else d = d.replace(/^Remuneración de pilotos en /, () => 'Sueldo de pilotos en ');
    return { title: fit(q + (y ? ` Sueldo ${y}` : '') + BRAND, q + (y ? ` Sueldo ${y}` : ''), q), desc: d.split('Aeromexico').join('Aeroméxico') };
  }
  /* 一覧（会社ごと） */
  if (bare === 'world-airlines.html') {
    const n = (title.match(/\b(\d{2,3}) aerolíneas\b/) || [])[1];
    return n ? { title: `Sueldo de pilotos por aerolínea: ${n} aerolíneas comparadas` + BRAND, desc: copiloto(desc) } : { title, desc };
  }
  /* 給与ガイド */
  if (bare === 'pilot-salary-guide.html') {
    return { title: `¿Cuánto gana un piloto de avión? Guía de sueldos${y ? ' ' + y : ''}` + BRAND, desc: copiloto(desc) };
  }
  /* トップ（一覧・ガイドと題名がぶつからないよう「口コミ」も言う） */
  if (bare === 'index.html') {
    const n = (title.match(/\b(\d{2,3}) aerolíneas\b/) || [])[1];
    return n ? { title: `Sueldos y reseñas de pilotos de avión: ${n} aerolíneas${y ? ` [${y}]` : ''}` + BRAND, desc: copiloto(desc) } : { title, desc };
  }
  return { title, desc: copiloto(desc) };
}
