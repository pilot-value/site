/* career-card.js — 保存カード（career.html の ?view=card&a={slug}[&b={slug}]）。
 *
 * ★金額を1つも持たない。額・札・棒の長さは、同じページの「会社の概要」の DOM から読む
 *   （[data-main] の字／[data-main-tag] の札／[data-main-bar] の額 data-man／[data-lim]・[data-lim-tag]・[data-lim-bar]）。
 *   概要を持たない会社（先行5社のほか）は、比較の行（.cr-row の字・札・棒の額）から読む（★2026-10-24 段階5 compare-all-2）。
 *   目盛は、載せる会社の目盛（比較の行の data-scale）の大きいほう ── 2社のカードは2社で1本。棒の長さは 額 ÷ 右端、
 *   目盛の字は比較の板の、その右端の1本から読む（★2026-10-24 P12.104）。
 *   通貨を切り替えたら、currency.js が直した字をそのまま読み直して描き直す。
 * ★本命の数字は、5社とも推定年収（[data-main] の字と「推定」の札）。career.html はそれだけを書く。
 * ★会社が公表した上限は、DOM に [data-lim] が在るときだけ描く（いまの career.html には無い）。
 *   描くときは3つが必ず一緒に出る ──「〜」（DOM の字）・斜線の棒・「上限」の字。
 * ★生きた欄（.crl ＝ REAL PAY・口コミ・星・乗員ホテル・勤務の実データ）は読まない・絵に載せない。
 *   公開の評価（平均と評価件数の2つの数）だけは、欄からではなく career-live.js の PVCareer.rating から受け取って描く（下の「公開の評価」）。
 * ★示すことが条件の写真のクレジット（#crc-data の credit）は、必ず絵の中に入る。
 * ・絵の寸法・字の太さ・絵の色は、すぐ下の「絵の定数」にまとめてある（3けた以上の数はその塊の中だけ）。
 * ・QR は #crc-data の行列をそのまま描く（1 が暗いマス・1マスは整数の画素・四方に明るい余白）。
 * ・このファイルが落ちても、ほかの画面と金額はそのまま読める。
 */
(function () {
  'use strict';

  /* ── 絵の定数 ここから（寸法・字の太さ・絵の色。金額でも為替でもない） ─────────── */
  var D = {
    W: 1200, H: 1500, M: 64, GAP: 32,
    BYTE: 255, GRAIN: 128, GRAIN_A: .05,
    HEAD_BASE: 100, HEAD: 30, HEAD_SUB: 26, TRACK: 5, TOP: 132,
    W_NUM: 800, W_HEAD: 700, W_MID: 600, W_TEXT: 500,
    FRAME: 28, FRAME_R: 24, FRAME_W: 2,
    PR: 28, SCRIM_AT: .38, BADGE_H: 44, BADGE_PX: 16,
    SMALL: 24, SMALL_LH: 34, CAP: .36, DESC: .2,
    PILL_H: 40, PILL_PX: 16, PILL_GAP: 14,
    ROW_GAP: 36, BAR_GAP: 12, LIM_GAP: 16, LBAR_GAP: 10, AXIS_LH: 40, FOOT_GAP: 24,
    HATCH: 7, MARK: 5, TICK: 10, TAIL: 34, SWATCH: 56,
    MOD: 6, QUIET: 4, QPAD: 8, QR_R: 14, URL: 30, URL_LH: 32,
    RATE_MAX: 5, RATE_PTS: 5, RATE_STAR: 26, RATE_GAP: 5, RATE_IN: .42, RATE_LH: 48, RATE_PAD: 12, RATE_MIN: 18, RATE_BASE: 4,
    ONE: { PH_MIN: 240, PH_MAX: 520, NAME: 64, EN: 28, PAD: 32,
           VAL: 124, VAL_LH: 132, VAL_MIN: 72, HELD: 60, HELD_LH: 76, ROLE: 36, ROLE_LH: 0, BAR: 28,
           LIM: 72, LIM_LH: 84, LIM_MIN: 48, LBAR: 22 },
    TWO: { PH_MIN: 200, PH_MAX: 500, NAME: 40, EN: 24, PAD: 24,
           VAL: 84, VAL_LH: 92, VAL_MIN: 52, HELD: 48, HELD_LH: 64, ROLE: 30, ROLE_LH: 46, BAR: 20,
           LIM: 52, LIM_LH: 62, LIM_MIN: 40, LBAR: 18 }
  };
  var INK = {
    color: {
      dark: [10, 16, 32], white: [255, 255, 255], fallback: [61, 155, 255],
      deep: .56, glow: .72, tint: .45, tone: .84,
      text: '#FFFFFF', soft: 'rgba(255,255,255,.78)', hair: 'rgba(255,255,255,.18)',
      track: 'rgba(255,255,255,.16)', pillBg: 'rgba(255,255,255,.12)', pillLine: 'rgba(255,255,255,.38)',
      valHi: '#FFFFFF', valLo: '#FFFFFF', fillA: [255, 255, 255], fillB: [255, 255, 255],
      hatchHi: 'rgba(255,255,255,.94)', hatchLo: 'rgba(255,255,255,.26)', mark: '#FFFFFF',
      chip: 'rgba(10,16,32,.84)', scrim: 'rgba(4,8,18,.78)', onPhoto: '#FFFFFF', onPhotoSoft: 'rgba(255,255,255,.82)',
      qrLight: '#F6F8FB', qrDark: '#0A1020', badgeBg: 'rgba(255,255,255,.94)', badgeInk: '#0A1628'
    },
    gold: {
      bg: '#0C0B09', glowTop: 'rgba(201,162,77,.22)', glowEnd: 'rgba(201,162,77,0)',
      sheen: 'rgba(255,244,214,.07)', sheenEnd: 'rgba(255,244,214,0)',
      frame: ['#8F6E2B', '#F3E2A9', '#A8843A'], toneRgb: [224, 202, 158],
      text: '#EADBB0', soft: 'rgba(234,219,176,.74)', hair: 'rgba(214,180,100,.3)',
      track: 'rgba(234,219,176,.13)', pillBg: 'rgba(214,180,100,.1)', pillLine: 'rgba(214,180,100,.58)',
      valHi: '#FBEFC8', valLo: '#C9A24D', fillA: [143, 110, 43], fillB: [240, 217, 150],
      hatchHi: 'rgba(233,207,138,.96)', hatchLo: 'rgba(233,207,138,.24)', mark: '#F3E2A9',
      chip: 'rgba(12,11,9,.88)', scrim: 'rgba(8,6,3,.82)', onPhoto: '#F6E9C4', onPhotoSoft: 'rgba(246,233,196,.82)',
      qrLight: '#F3EAD2', qrDark: '#0C0B09', badgeBg: 'rgba(243,234,210,.94)', badgeInk: '#0C0B09'
    }
  };
  /* ── 絵の定数 ここまで ───────────────────────────────────────────────── */

  /* ★2026-10-25 英語の EN-9：ページの <html lang> が en（en/career.html）なら、下の字は英語（WORD_EN ── 鍵は WORD と同じ）。
     読むのはページの言葉だけ（端末の言語設定は読まない）。社名はいまの言葉の名前（#crc-data の ja／en）、英語のカードの見出しは英語の社名だけ。 */
  var LANG = /^en(-|$)/i.test(document.documentElement.getAttribute('lang') || '') ? 'en' : 'ja';
  var FAM_NUM = 'Inter, "Noto Sans JP", sans-serif';     // 数字・英字
  var FAM_JP = LANG === 'en' ? FAM_NUM : '"Noto Sans JP", Inter, sans-serif';      // 見出し・日本語（英語のカードは英字の書体を先に）
  var THEMES = ['color', 'gold'];
  var ROLES = ['cap', 'fo'];
  /* 住所に足す鍵: 写真（1社目・2社目）とデザイン。
     ⚠️ q・s・search・query・keyword は使わない（解析タグが「サイト内検索」と数える）。 */
  var KEY_P = 'p', KEY_Q = 'p2', KEY_T = 't';
  var WORD = {
    brand: 'PILOT VALUE', head: 'パイロットの年収', cap: '機長', fo: '副操縦士', max: '上限',
    photo: '写真（縮小・トリミング）',
    one: '1社', two: '2社', count: '会社の数', co: '会社', coA: '1社目', coB: '2社目', pic: '写真',
    rated1: '件の評価', lp: '（', rp: '）', mid: '・',
    design: 'デザイン', color: 'カラフル', gold: '黒×金', save: '画像を保存', share: '共有', preview: 'カードの見本', rated: '件の評価'
  };
  /* 英語の字。サイトに在る英語を先に（Captain・First Officer・1 airline ＝ 航空会社一覧・Save card の画面の字・photo の断り ＝ 写真の台帳の英語）。
     ★「上限」の英語は、英語の会社ページの上限の印と同じく maximum（斜線の棒と「〜」の DOM の字 ── 英語は up to ── と必ず一緒に出る）。 */
  var WORD_EN = {
    brand: 'PILOT VALUE', head: 'Pilot pay', cap: 'Captain', fo: 'First Officer', max: 'Maximum',
    photo: 'Photo (resized and cropped)',
    one: '1 airline', two: '2 airlines', count: 'Number of airlines', co: 'Airline', coA: 'First airline', coB: 'Second airline', pic: 'Photo',
    rated1: ' rating', lp: ' (', rp: ')', mid: ' · ',
    design: 'Design', color: 'Colorful', gold: 'Black & gold', save: 'Save image', share: 'Share', preview: 'Card preview', rated: ' ratings'
  };
  if (LANG === 'en') WORD = WORD_EN;
  /* カードに描く社名（いまの言葉の名前）と、その下に添える英語の名前（英語のカードは添えない ── 同じ名前を2度言わない） */
  var nameOf = function (a) { return (LANG === 'en' ? a.en : a.ja) || ''; };
  var subOf = function (a) { return LANG === 'en' ? '' : a.en || ''; };
  /* 欄の名前の後ろに社名を添える形（「写真（エミレーツ）」）。★2026-10-25 WP-compare-all-14（絵の本 #15）：社名がもう括弧で終わる会社
     （日本航空（JAL）・Swiss International Air Lines (SWISS)）は、括弧をもう1組重ねず「・」でつなぐ（「写真（日本航空（JAL））」にしない）。 */
  var tagged = function (head, t) { return /[)）]$/.test(t) ? head + WORD.mid + t : head + WORD.lp + t + WORD.rp; };

  var cr = document.getElementById('cr');
  var root = document.getElementById('crc-root');
  var island = document.getElementById('crc-data');
  if (!cr || !root || !island) return;
  var DATA;
  try { DATA = JSON.parse(island.textContent); } catch (e) { return; }
  var AIR = (DATA && DATA.airlines) || {};
  var SLUGS = Object.keys(AIR);
  if (!SLUGS.length) return;

  var noop = function () {};
  var known = function (s) { return !!s && Object.prototype.hasOwnProperty.call(AIR, s); };
  var PV = function () { return window.PVCareer || null; };

  /* ── DOM から読む（字だけ。数を作らない） ─────────────────────────────── */
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function inLive(el) { return !!(el && el.closest && el.closest('.crl, .crs-zone')); }
  function pick(scope, attr, role) {
    var list = scope.querySelectorAll('[' + attr + '="' + role + '"]');
    for (var i = 0; i < list.length; i++) if (!inLive(list[i])) return list[i];
    return null;
  }
  /* 札と棒に職位が書いていないときは、額のいちばん近い囲みの中から探す。 */
  function nearBy(sec, attr, role, from) {
    var el = pick(sec, attr, role);
    if (el || !from) return el;
    for (var p = from.parentElement; p && sec.contains(p); p = p.parentElement) {
      if (p.querySelectorAll('[data-lim]').length > 1) break;
      var hit = p.querySelector('[' + attr + ']');
      if (hit && !inLive(hit)) return hit;
    }
    return null;
  }
  /* 棒の長さ（0〜1）＝ 棒の額（data-man）÷ このカードの目盛の右端（★2026-10-24 P12.104：2社のカードは2社で1本・1社はその会社の目盛）。
     額も右端も画面の HTML の数から読む（ここに額を持たない）。 */
  function share(el, top) {
    var m = el ? Number(el.getAttribute('data-man')) : NaN;
    return isFinite(m) && m > 0 && top > 0 ? Math.max(0, Math.min(1, m / top)) : null;
  }
  function subOf(tag) {
    var p = tag && tag.parentElement, s = p && p.querySelector('.cr-sub');
    return s && !inLive(s) ? txt(s) : '';
  }
  function readRole(sec, role, top) {
    var main = pick(sec, 'data-main', role);
    if (!main || !txt(main)) return null;
    var look = main.getAttribute('data-look') || '';
    var tag = pick(sec, 'data-main-tag', role);
    var out = { role: role, text: txt(main), look: look, tag: txt(tag), sub: subOf(tag),
                w: look === 'held' ? null : share(pick(sec, 'data-main-bar', role), top), lim: null };
    var lim = pick(sec, 'data-lim', role);
    if (lim && txt(lim)) {
      var lt = nearBy(sec, 'data-lim-tag', role, lim);
      out.lim = { text: txt(lim), tag: txt(lt), sub: subOf(lt), w: share(nearBy(sec, 'data-lim-bar', role, lim), top) };
    }
    return out;
  }
  /* 概要を持たない会社は、比較の行（同じページの字）から読む。目盛はこの1枚に1本なので、2社とも同じ目盛で読める。
     ⚠️ 生きた欄（.crl）の中の行は読まない ── 限定の中身を画像へ持ち込まない。 */
  function cmpRowOf(slug, role) {
    var list = cr.querySelectorAll('.cr-view[data-view="compare"] .cr-pair[data-role="' + role + '"] .cr-row');
    for (var i = 0; i < list.length; i++) if (list[i].getAttribute('data-airline') === slug && !inLive(list[i])) return list[i];
    return null;
  }
  function readRow(slug, role, top) {             // -> readRole() と同じ形（概要の無い会社）
    var row = cmpRowOf(slug, role), v = row && row.querySelector('.cr-row-v');
    if (!v || !txt(v)) return null;
    return { role: role, text: txt(v), look: '', tag: txt(row.querySelector('.cr-tag')), sub: '', w: share(row.querySelector('.cr-fill'), top), lim: null };
  }
  /* このカードの目盛の右端（★2026-10-24 P12.104）＝ 載せる会社の目盛（比較の行の data-scale）の大きいほう。2社のカードは2社で1本。 */
  function scaleOf(slugs) {
    var top = 0;
    slugs.forEach(function (s) { var r = s && cmpRowOf(s, ROLES[0]), v = r ? Number(r.getAttribute('data-scale')) : 0; if (v > top) top = v; });
    return top;
  }
  /* 目盛の字は、比較の板に右端ごとに置いてある1本から読む（字は HTML に在る ＝ 通貨切替が直した字をそのまま読む）。 */
  function axisOf(top) {
    var out = [], list = cr.querySelectorAll('.cr-view[data-view="compare"] .cr-panel .cr-axis[data-scale]');
    for (var i = 0; i < list.length; i++) {
      if (inLive(list[i]) || Number(list[i].getAttribute('data-scale')) !== top) continue;
      Array.prototype.forEach.call(list[i].children, function (s) { out.push(txt(s)); });
      break;
    }
    return out;
  }
  function readCard(slug, photoIx, top) {
    var a = AIR[slug], sec = null, list = cr.querySelectorAll('.cr-view[data-view="airline"]');
    for (var i = 0; i < list.length; i++) if (list[i].getAttribute('data-airline') === slug) sec = list[i];
    var photos = a.photos || [], roles = {}, axis = [];
    axisOf(top).forEach(function (s) { axis.push(s); });
    if (sec) {
      ROLES.forEach(function (r) { var v = readRole(sec, r, top); if (v) roles[r] = v; });
    } else {
      ROLES.forEach(function (r) { var v = readRow(slug, r, top); if (v) roles[r] = v; });
    }
    return { slug: slug, ja: nameOf(a), en: subOf(a), code: a.code || '', color: a.color || '',
             url: a.url || '', qr: a.qr || [], photo: photos[photoIx] || photos[0] || null, roles: roles, axis: axis, rating: ratingOf(slug) };
  }

  /* ── 公開の評価（星の図・平均・評価件数）──
     career-live.js が会社ページ・比較と同じ計算で出した「平均」と「評価件数」の2つの数だけを受け取る。
     口コミの行・本文・抜粋はここへ来ない。読めていない・点数の付いた投稿が無い会社は、行ごと描かない。
     聞くのは、カードを開くたびに1社につき1回（落ちても、開き直すまで聞き直さない）。保存と共有は待たない＝見本に出ているものがそのまま画像になる。 */
  var RATED = {};                                 // slug → { avg, n } ｜ null（評価なし）。分からない会社は鍵が無い
  var ASKED = {};                                 // このカードを開いてから聞いた会社
  function sameRate(a, b) { return a === b || (!!a && !!b && a.avg === b.avg && a.n === b.n); }
  function askRating(slug) {
    if (ASKED[slug]) return;
    ASKED[slug] = true;
    var pv = PV(), p;
    if (!pv || typeof pv.rating !== 'function') return;
    try { p = Promise.resolve(pv.rating(slug)); } catch (e) { return; }
    p.then(function (r) {
      var avg = r ? Number(r.avg) : NaN, n = r ? Math.floor(Number(r.n)) : NaN;
      var v = (isFinite(avg) && avg > 0 && isFinite(n) && n > 0) ? { avg: Math.min(D.RATE_MAX, avg), n: n } : null;
      var had = Object.prototype.hasOwnProperty.call(RATED, slug), old = RATED[slug];
      RATED[slug] = v;
      if (had ? !sameRate(old, v) : !!v) schedule();
    }, function () {                                // 読めなかった ＝ 分からない（null＝評価なし とは別）。行を描かない
      if (Object.prototype.hasOwnProperty.call(RATED, slug)) { delete RATED[slug]; schedule(); }
    });
  }
  function ratingOf(slug) {
    var v = Object.prototype.hasOwnProperty.call(RATED, slug) ? RATED[slug] : null;
    return v ? { avg: v.avg.toFixed(1), fill: Math.round(v.avg / D.RATE_MAX * 1000) / 1000, n: v.n, text: v.n + (v.n === 1 ? WORD.rated1 : WORD.rated) } : null;
  }

  /* ── 描く道具 ───────────────────────────────────────────────────── */
  function font(ctx, wt, px, fam) { ctx.font = wt + ' ' + px + 'px ' + fam; }
  function tw(ctx, s) { return ctx.measureText(s).width; }
  function fit(ctx, s, wt, px, fam, maxW, minPx) {
    font(ctx, wt, px, fam);
    while (px > minPx && tw(ctx, s) > maxW) { px -= 2; font(ctx, wt, px, fam); }
    return px;
  }
  function put(ctx, s, x, y, align, fill) { ctx.textAlign = align; ctx.fillStyle = fill; ctx.fillText(s, x, y); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rgb(hex) {
    var s = String(hex || '').replace('#', '');
    if (s.length === 3) s = s.replace(/./g, function (ch) { return ch + ch; });
    var n = parseInt(s, 16);
    if (s.length !== 6 || !isFinite(n)) return null;
    return [n >> 16 & D.BYTE, n >> 8 & D.BYTE, n & D.BYTE];
  }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function css(c, al) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (al == null ? 1 : al) + ')'; }
  /* 区切りの字の後ろでだけ折る（語の途中で折らない）。 */
  function wrap(ctx, s, maxW, breaks) {
    var toks = [], cur = '', i;
    for (i = 0; i < s.length; i++) {
      cur += s.charAt(i);
      if (breaks.indexOf(s.charAt(i)) >= 0) { toks.push(cur); cur = ''; }
    }
    if (cur) toks.push(cur);
    var lines = [], line = '';
    toks.forEach(function (t) {
      if (line && tw(ctx, (line + t).replace(/\s+$/, '')) > maxW) { lines.push(line.replace(/\s+$/, '')); line = t.replace(/^\s+/, ''); }
      else line += t;
    });
    if (line.replace(/\s+$/, '')) lines.push(line.replace(/\s+$/, ''));
    return lines;
  }

  function basePal(t) {
    var K = INK[t], P = Object.create(K);
    P.theme = t;
    P.val = function (ctx, y0, y1) {
      if (K.valHi === K.valLo) return K.valHi;
      var g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, K.valHi); g.addColorStop(1, K.valLo);
      return g;
    };
    return P;
  }
  function cardPal(P, card) {
    var o = Object.create(P), c = rgb(card.color) || P.fallback || P.fillA;
    o.co = c;
    if (P.theme === 'color') { o.fillA = mix(c, P.white, P.tint); o.toneRgb = mix(c, P.white, P.tone); }
    return o;
  }

  var grainTile = null;
  function grain(ctx) {
    if (!grainTile) {
      var c = document.createElement('canvas');
      c.width = c.height = D.GRAIN;
      var g = c.getContext('2d'), im = g.createImageData(D.GRAIN, D.GRAIN), d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = Math.random() < .5 ? 0 : D.BYTE;
        d[i + 3] = Math.round(Math.random() * D.BYTE);
      }
      g.putImageData(im, 0, 0);
      grainTile = c;
    }
    ctx.save();
    ctx.globalAlpha = D.GRAIN_A;
    ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
    ctx.fillRect(0, 0, D.W, D.H);
    ctx.restore();
  }

  function glow(ctx, x, y, r, from, to) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, from); g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, D.W, D.H);
  }
  function backdrop(ctx, P, cols) {
    var W = D.W, H = D.H;
    if (P.theme === 'gold') {
      ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
      glow(ctx, W / 2, 0, W, P.glowTop, P.glowEnd);
      glow(ctx, W, H, W * .8, P.glowTop, P.glowEnd);
      var s = ctx.createLinearGradient(0, H * .2, W, H * .7);
      s.addColorStop(0, P.sheenEnd); s.addColorStop(.46, P.sheenEnd); s.addColorStop(.5, P.sheen);
      s.addColorStop(.54, P.sheenEnd); s.addColorStop(1, P.sheenEnd);
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
      grain(ctx);
      var f = ctx.createLinearGradient(0, 0, W, H);
      f.addColorStop(0, P.frame[0]); f.addColorStop(.5, P.frame[1]); f.addColorStop(1, P.frame[2]);
      ctx.strokeStyle = f; ctx.lineWidth = D.FRAME_W;
      rr(ctx, D.FRAME, D.FRAME, W - D.FRAME * 2, H - D.FRAME * 2, D.FRAME_R); ctx.stroke();
      return;
    }
    var a = cols[0].P.co, b = cols.length > 1 ? cols[1].P.co : mix(a, P.white, .3);
    ctx.fillStyle = css(mix(cols.length > 1 ? mix(a, b, .5) : a, P.dark, P.deep));
    ctx.fillRect(0, 0, W, H);
    glow(ctx, 0, 0, W * .95, css(a, P.glow), css(a, 0));
    glow(ctx, W, cols.length > 1 ? 0 : H * .42, W * .9, css(b, cols.length > 1 ? P.glow : .34), css(b, 0));
    glow(ctx, W / 2, H * 1.08, W * .95, css(P.dark, .62), css(P.dark, 0));
    grain(ctx);
  }

  function header(ctx, P) {
    font(ctx, D.W_NUM, D.HEAD, FAM_NUM);
    if ('letterSpacing' in ctx) ctx.letterSpacing = D.TRACK + 'px';
    put(ctx, WORD.brand, D.M, D.HEAD_BASE, 'left', P.text);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    font(ctx, D.W_HEAD, D.HEAD_SUB, FAM_JP);
    put(ctx, WORD.head, D.W - D.M, D.HEAD_BASE, 'right', P.soft);
  }

  function pillW(ctx, s) { font(ctx, D.W_HEAD, D.SMALL, FAM_JP); return Math.ceil(tw(ctx, s)) + D.PILL_PX * 2; }
  /* 札。cy は札のまんなかの高さ。 */
  function pill(ctx, P, x, cy, s) {
    var w = pillW(ctx, s), y = Math.round(cy - D.PILL_H / 2);
    rr(ctx, x, y, w, D.PILL_H, D.PILL_H / 2);
    ctx.fillStyle = P.pillBg; ctx.fill();
    ctx.strokeStyle = P.pillLine; ctx.lineWidth = D.FRAME_W; ctx.stroke();
    put(ctx, s, x + D.PILL_PX, Math.round(cy + D.SMALL * D.CAP), 'left', P.text);
    return w;
  }
  function hatch(ctx, P, x, y, w, h) {
    ctx.fillStyle = P.hatchLo; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P.hatchHi;
    for (var i = -h; i < w + h; i += D.HATCH * 2) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + D.HATCH, y + h);
      ctx.lineTo(x + i + D.HATCH + h, y); ctx.lineTo(x + i + h, y);
      ctx.closePath(); ctx.fill();
    }
  }
  /* 棒。0 から始まり、長さは 額 ÷ このカードの目盛の右端（2社のカードは2社で同じ目盛）。
     look="max" は斜線＋端の印＋「上限」の字。look="over" は端を開けたままにする。 */
  function bar(ctx, P, x, y, w, h, f, look) {
    var fw = w * f, r = h / 2;
    ctx.fillStyle = P.track; rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.save();
    rr(ctx, x, y, look === 'over' ? w : Math.max(fw, 1), h, r); ctx.clip();
    if (look === 'max') hatch(ctx, P, x, y, fw, h);
    else {
      var g = ctx.createLinearGradient(x, 0, x + Math.max(fw, 1), 0);
      g.addColorStop(0, css(P.fillA)); g.addColorStop(1, css(P.fillB));
      ctx.fillStyle = g; ctx.fillRect(x, y, fw, h);
      if (look === 'over') {
        var t = ctx.createLinearGradient(x + fw, 0, x + fw + D.TAIL, 0);
        t.addColorStop(0, css(P.fillB, .7)); t.addColorStop(1, css(P.fillB, 0));
        ctx.fillStyle = t; ctx.fillRect(x + fw, y, D.TAIL, h);
      }
    }
    ctx.restore();
    if (look !== 'max') return;
    ctx.fillStyle = P.mark;
    rr(ctx, x + fw - D.MARK / 2, y - D.MARK, D.MARK, h + D.MARK * 2, D.MARK / 2); ctx.fill();
    maxWord(ctx, P, x, y, w, h, fw);
  }
  function maxWord(ctx, P, x, y, w, h, fw) {
    font(ctx, D.W_HEAD, D.SMALL, FAM_JP);
    var lw = tw(ctx, WORD.max), lx = x + fw + D.MARK + D.TICK, base = Math.round(y + h / 2 + D.SMALL * D.CAP);
    if (lx + lw <= x + w) { put(ctx, WORD.max, lx, base, 'left', P.text); return; }
    var bx = x + fw - D.MARK - D.TICK * 3 - lw;                  // 右に余地が無いときは、棒の中に地を敷いて書く
    ctx.fillStyle = P.chip;
    rr(ctx, bx, y - D.MARK, lw + D.TICK * 2, h + D.MARK * 2, D.TICK); ctx.fill();
    put(ctx, WORD.max, bx + D.TICK, base, 'left', P.text);
  }

  /* 棒の長さが DOM に無い上限: 長さを作らず、斜線の見本と「上限」の字だけ出す。 */
  function swatch(ctx, P, x, y, h) {
    ctx.save(); rr(ctx, x, y, D.SWATCH, h, h / 2); ctx.clip(); hatch(ctx, P, x, y, D.SWATCH, h); ctx.restore();
    font(ctx, D.W_HEAD, D.SMALL, FAM_JP);
    put(ctx, WORD.max, x + D.SWATCH + D.TICK, Math.round(y + h / 2 + D.SMALL * D.CAP), 'left', P.text);
  }

  /* 上限の額（別の行）。棒の長さが DOM に無いときは、長さを作らず、斜線の見本と「上限」の字だけ出す。 */
  function limBlock(ctx, P, L, two, x, y, w, lim, paint) {
    var y0 = y, lh = L.LIM_LH, by = y + lh - Math.round(lh * D.DESC), cy = by - Math.round(L.LIM * D.CAP);
    var pw = lim.tag ? pillW(ctx, lim.tag) : 0, sw = 0, px, vw;
    if (lim.sub) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); sw = tw(ctx, lim.sub); }
    if (!two) {
      var left = pw + (sw ? (pw ? D.PILL_GAP : 0) + sw : 0), cx = x;
      if (paint) {
        if (pw) { pill(ctx, P, cx, cy, lim.tag); cx += pw + D.PILL_GAP; }
        if (sw) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); put(ctx, lim.sub, cx, Math.round(cy + D.SMALL * D.CAP), 'left', P.soft); }
      }
      px = fit(ctx, lim.text, D.W_NUM, L.LIM, FAM_NUM, w - left - D.GAP, L.LIM_MIN);
      if (paint) put(ctx, lim.text, x + w, by, 'right', P.val(ctx, by - px, by));
      y += lh;
    } else {
      px = fit(ctx, lim.text, D.W_NUM, L.LIM, FAM_NUM, w - (pw ? pw + D.PILL_GAP : 0), L.LIM_MIN);
      vw = tw(ctx, lim.text);
      if (paint) {
        put(ctx, lim.text, x, by, 'left', P.val(ctx, by - px, by));
        if (pw) pill(ctx, P, x + vw + D.PILL_GAP, by - Math.round(px * D.CAP), lim.tag);
      }
      y += lh;
      if (sw) {
        if (paint) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); put(ctx, lim.sub, x, y + D.SMALL, 'left', P.soft); }
        y += D.SMALL_LH;
      }
    }
    y += D.LBAR_GAP;
    if (paint) {
      if (lim.w != null) bar(ctx, P, x, y, w, L.LBAR, lim.w, 'max');
      else swatch(ctx, P, x, y, L.LBAR);
    }
    return y + L.LBAR - y0;
  }

  /* 1つの職位（1社ぶん）。paint=false のときは高さだけ返す。 */
  function roleBlock(ctx, P, L, two, x, y, w, r, paint) {
    var y0 = y, held = r.look === 'held';
    var px = held ? L.HELD : L.VAL, lh = held ? L.HELD_LH : L.VAL_LH;
    var wt = held ? D.W_HEAD : D.W_NUM, fam = held ? FAM_JP : FAM_NUM, floor = held ? D.SMALL : L.VAL_MIN;
    var by = y + lh - Math.round(lh * D.DESC);
    var pw = r.tag ? pillW(ctx, r.tag) : 0, sw = 0, vw;
    if (r.sub) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); sw = tw(ctx, r.sub); }
    if (!two) {
      font(ctx, D.W_HEAD, L.ROLE, FAM_JP);
      var lw = tw(ctx, WORD[r.role]), cx = x + lw + D.PILL_GAP;
      var left = lw + (pw ? D.PILL_GAP + pw : 0) + (sw ? D.PILL_GAP + sw : 0);
      if (paint) {
        put(ctx, WORD[r.role], x, by, 'left', P.text);
        if (pw) { pill(ctx, P, cx, by - Math.round(L.ROLE * D.CAP), r.tag); cx += pw + D.PILL_GAP; }
        if (sw) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); put(ctx, r.sub, cx, by, 'left', P.soft); }
      }
      px = fit(ctx, r.text, wt, px, fam, w - left - D.GAP, floor);
      if (paint) put(ctx, r.text, x + w, by, 'right', held ? P.text : P.val(ctx, by - px, by));
      y += lh;
    } else {
      px = fit(ctx, r.text, wt, px, fam, w - (pw ? pw + D.PILL_GAP : 0), floor);
      vw = tw(ctx, r.text);
      if (paint) {
        put(ctx, r.text, x, by, 'left', held ? P.text : P.val(ctx, by - px, by));
        if (pw) pill(ctx, P, x + vw + D.PILL_GAP, by - Math.round(px * D.CAP), r.tag);
      }
      y += lh;
      if (sw) {
        if (paint) { font(ctx, D.W_TEXT, D.SMALL, FAM_JP); put(ctx, r.sub, x, y + D.SMALL, 'left', P.soft); }
        y += D.SMALL_LH;
      }
    }
    if (!held && (r.w != null || r.look === 'max')) {
      y += D.BAR_GAP;
      if (paint) { if (r.w != null) bar(ctx, P, x, y, w, L.BAR, r.w, r.look); else swatch(ctx, P, x, y, L.BAR); }
      y += L.BAR;
    }
    if (r.lim) { y += D.LIM_GAP; y += limBlock(ctx, P, L, two, x, y, w, r.lim, paint); }
    return y - y0;
  }
  function hasBar(card) {
    return ROLES.some(function (k) {
      var r = card.roles[k];
      return !!r && ((r.look !== 'held' && r.w != null) || (!!r.lim && r.lim.w != null));
    });
  }

  function axis(ctx, P, x, y, w, labels) {
    var n = labels.length;
    font(ctx, D.W_TEXT, D.SMALL, FAM_NUM);
    labels.forEach(function (s, i) {
      var at = n > 1 ? i / (n - 1) : 0;
      put(ctx, s, x + w * at, y + D.SMALL + 2, at === 0 ? 'left' : at === 1 ? 'right' : 'center', P.soft);
    });
  }

  function photo(ctx, P, L, img, x, y, w, h, c) {
    ctx.save();
    rr(ctx, x, y, w, h, D.PR); ctx.clip();
    ctx.fillStyle = css(mix(P.co, P.dark || [0, 0, 0], .5)); ctx.fillRect(x, y, w, h);
    if (img) {
      var s = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / s, sh = h / s;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = css(P.toneRgb); ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    var g = ctx.createLinearGradient(0, y + h * D.SCRIM_AT, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.scrim);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    var pad = L.PAD, base = y + h - pad;
    if (c.en) { font(ctx, D.W_TEXT, L.EN, FAM_NUM); put(ctx, c.en, x + pad, base, 'left', P.onPhotoSoft); base -= L.EN + D.TICK; }
    fit(ctx, c.ja, D.W_HEAD, L.NAME, FAM_JP, w - pad * 2, L.EN);
    put(ctx, c.ja, x + pad, base, 'left', P.onPhoto);
    if (c.code) {
      font(ctx, D.W_NUM, D.SMALL, FAM_NUM);
      var bw = Math.ceil(tw(ctx, c.code)) + D.BADGE_PX * 2;
      ctx.fillStyle = P.badgeBg; rr(ctx, x + pad, y + pad, bw, D.BADGE_H, D.TICK); ctx.fill();
      put(ctx, c.code, x + pad + D.BADGE_PX, Math.round(y + pad + D.BADGE_H / 2 + D.SMALL * D.CAP), 'left', P.badgeInk);
    }
    ctx.restore();
    if (P.theme === 'gold') {
      ctx.strokeStyle = P.pillLine; ctx.lineWidth = D.FRAME_W;
      rr(ctx, x, y, w, h, D.PR); ctx.stroke();
    }
  }

  function qrSize(c) { return c.qr.length ? (c.qr.length + D.QUIET * 2) * D.MOD + D.QPAD * 2 : 0; }
  /* QR。明るい板 → 四方に明るい余白（QUIET マス以上）→ 1 が暗いマス。1マス＝MOD 画素（整数）。
     plate は板の大きさ（2社でマスの数が違っても板をそろえる。余白は増える方向にしか動かない）。 */
  function qr(ctx, P, rows, x, y, plate) {
    var n = rows.length, o = Math.round((plate - n * D.MOD) / 2);
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = P.qrLight; rr(ctx, x, y, plate, plate, D.QR_R); ctx.fill();
    ctx.fillStyle = P.qrDark;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (rows[r].charAt(c) === '1') ctx.fillRect(x + o + c * D.MOD, y + o + r * D.MOD, D.MOD, D.MOD);
    }
    return { x: x + o, y: y + o, mod: D.MOD, n: n, quiet: Math.floor((o - D.QPAD) / D.MOD) };
  }
  function shortUrl(u) { return String(u).replace(/^https?:\/\//, ''); }
  /* 写真のクレジット。作者名とライセンス名は、それぞれ1行の中に収める（名前の途中で折らない）。 */
  function creditLines(ctx, c, maxW) {
    var credit = c.photo && c.photo.credit;
    if (!credit) return [];
    var parts = String(credit).split(' / '), pieces = [WORD.photo], lines = [], line = '';
    parts.forEach(function (s, i) { pieces.push(i ? '/ ' + s : s); });
    pieces.forEach(function (pc) {
      var joined = line ? line + ' ' + pc : pc;
      if (tw(ctx, joined) <= maxW) { line = joined; return; }
      if (line) lines.push(line);
      if (tw(ctx, pc) <= maxW) { line = pc; return; }
      var sub = wrap(ctx, pc, maxW, ' ・');
      line = sub.pop() || '';
      sub.forEach(function (l) { lines.push(l); });
    });
    if (line) lines.push(line);
    return lines;
  }

  /* 下の帯: QR・公開ページの住所・写真のクレジット。高さを返す（paint=false は測るだけ）。 */
  function footer(ctx, cols, two, bottom, paint, out) {
    var plate = Math.max.apply(null, cols.map(function (o) { return qrSize(o.c); })), hmax = plate, parts = [];
    cols.forEach(function (o) {
      var c = o.c, has = qrSize(c) > 0, tx, tW;
      if (two) { tx = o.x + (has ? plate + D.TICK * 2 : 0); tW = o.x + o.w - tx; }
      else { tx = o.x; tW = o.w - (has ? plate + D.GAP : 0); }
      font(ctx, D.W_MID, two ? D.SMALL : D.URL, FAM_NUM);
      var urls = c.url ? wrap(ctx, shortUrl(c.url), tW, '/') : [];
      font(ctx, D.W_TEXT, D.SMALL, FAM_JP);
      var cred = creditLines(ctx, c, tW);
      var uLh = two ? D.URL_LH : D.URL + D.TICK;
      var th = urls.length * uLh + (cred.length ? D.TICK + cred.length * D.URL_LH : 0);
      hmax = Math.max(hmax, th);
      parts.push({ o: o, has: has, tx: tx, urls: urls, cred: cred, uLh: uLh });
    });
    if (!paint) return hmax;
    parts.forEach(function (p) {
      var o = p.o, y;
      if (p.has) out.push(qr(ctx, o.P, o.c.qr, two ? o.x : o.x + o.w - plate, bottom - plate, plate));
      if (two) {
        y = bottom - hmax;
        font(ctx, D.W_MID, D.SMALL, FAM_NUM);
        p.urls.forEach(function (s) { y += p.uLh; put(ctx, s, p.tx, y - D.TICK + 2, 'left', o.P.text); });
        y += p.cred.length ? D.TICK : 0;
        font(ctx, D.W_TEXT, D.SMALL, FAM_JP);
        p.cred.forEach(function (s) { y += D.URL_LH; put(ctx, s, p.tx, y - D.TICK + 2, 'left', o.P.soft); });
      } else {
        y = bottom - D.TICK;
        font(ctx, D.W_MID, D.URL, FAM_NUM);
        p.urls.slice().reverse().forEach(function (s) { put(ctx, s, p.tx, y, 'left', o.P.text); y -= p.uLh; });
        y -= p.cred.length ? D.TICK - 2 : 0;
        font(ctx, D.W_TEXT, D.SMALL, FAM_JP);
        p.cred.slice().reverse().forEach(function (s) { put(ctx, s, p.tx, y, 'left', o.P.soft); y -= D.URL_LH; });
      }
    });
    return hmax;
  }

  function starPath(ctx, cx, cy, R) {
    ctx.beginPath();
    for (var i = 0; i < D.RATE_PTS * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / D.RATE_PTS, q = i % 2 ? R * D.RATE_IN : R;
      if (i) ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); else ctx.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q);
    }
    ctx.closePath();
  }
  /* 星は形で描く（字にしない）。塗る幅は平均 ÷ 5（会社ページ・比較の星と同じ決め方）。 */
  function rateLine(ctx, P, x, base, w, r) {
    var R = D.RATE_STAR / 2, cy = base - R, tot = D.RATE_MAX * D.RATE_STAR + (D.RATE_MAX - 1) * D.RATE_GAP;
    function stars(fill) {
      ctx.fillStyle = fill;
      for (var i = 0; i < D.RATE_MAX; i++) { starPath(ctx, x + R + i * (D.RATE_STAR + D.RATE_GAP), cy, R); ctx.fill(); }
    }
    stars(P.track);
    ctx.save(); ctx.beginPath(); ctx.rect(x, cy - R, tot * r.fill, D.RATE_STAR); ctx.clip(); stars(P.text); ctx.restore();
    var tx = x + tot + D.RATE_PAD;
    font(ctx, D.W_NUM, D.SMALL, FAM_NUM); put(ctx, r.avg, tx, base - D.RATE_BASE, 'left', P.text);
    tx += Math.ceil(tw(ctx, r.avg)) + D.RATE_PAD;
    var px = fit(ctx, r.text, D.W_TEXT, D.SMALL, FAM_JP, x + w - tx, D.RATE_MIN);
    font(ctx, D.W_TEXT, px, FAM_JP); put(ctx, r.text, tx, base - D.RATE_BASE, 'left', P.soft);
  }

  function paint(ctx, m, imgs) {
    var two = m.cards.length > 1, L = two ? D.TWO : D.ONE, P = basePal(m.t);
    var iw = D.W - D.M * 2, cw = two ? (iw - D.GAP) / 2 : iw, qrs = [];
    var cols = m.cards.map(function (c, i) { return { x: D.M + i * (cw + D.GAP), w: cw, c: c, P: cardPal(P, c) }; });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.textBaseline = 'alphabetic';
    ctx.clearRect(0, 0, D.W, D.H);
    backdrop(ctx, P, cols);
    header(ctx, P);

    var bottom = D.H - D.M, fh = footer(ctx, cols, two, bottom, false, qrs), fy = bottom - fh;
    var roles = ROLES.filter(function (k) { return cols.some(function (o) { return !!o.c.roles[k]; }); });
    var hs = roles.map(function (k) {
      return L.ROLE_LH + Math.max.apply(null, cols.map(function (o) {
        return o.c.roles[k] ? roleBlock(ctx, o.P, L, two, o.x, 0, o.w, o.c.roles[k], false) : 0;
      }));
    });
    var showAxis = cols.some(function (o) { return o.c.axis.length > 1 && hasBar(o.c); });
    var anyRate = cols.some(function (o) { return !!o.c.rating; });
    var body = roles.length * D.ROW_GAP + (showAxis ? D.AXIS_LH : 0) + (anyRate ? D.RATE_LH : 0);
    hs.forEach(function (v) { body += v; });
    var avail = fy - D.FOOT_GAP - D.TOP - body;
    var ph = Math.max(L.PH_MIN, Math.min(L.PH_MAX, avail)), slack = Math.max(0, avail - ph);

    cols.forEach(function (o, i) { photo(ctx, o.P, L, imgs[i], o.x, D.TOP, o.w, ph, o.c); });
    var y = D.TOP + ph + slack / 2;
    if (anyRate) {
      cols.forEach(function (o) { if (o.c.rating) rateLine(ctx, o.P, o.x, y + D.RATE_LH - D.RATE_PAD, o.w, o.c.rating); });
      y += D.RATE_LH;
    }
    roles.forEach(function (k, i) {
      if (i) { ctx.fillStyle = P.hair; ctx.fillRect(D.M, Math.round(y + D.ROW_GAP / 2), iw, D.FRAME_W); }
      y += D.ROW_GAP;
      if (two) { font(ctx, D.W_HEAD, L.ROLE, FAM_JP); put(ctx, WORD[k], D.M, y + L.ROLE, 'left', P.text); }
      cols.forEach(function (o) {
        if (o.c.roles[k]) roleBlock(ctx, o.P, L, two, o.x, y + L.ROLE_LH, o.w, o.c.roles[k], true);
      });
      y += hs[i];
    });
    if (showAxis) cols.forEach(function (o) { if (o.c.axis.length > 1 && hasBar(o.c)) axis(ctx, P, o.x, y + D.TICK, o.w, o.c.axis); });
    footer(ctx, cols, two, bottom, true, qrs);
    return { qr: qrs, photoH: ph, over: Math.max(0, L.PH_MIN - avail) };
  }

  /* ── 写真と書体を待つ ─────────────────────────────────────────────── */
  var imgCache = {};
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (!imgCache[src]) {
      imgCache[src] = new Promise(function (res) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () { res(im); };
        im.onerror = function () { res(null); };
        im.src = src;
      });
    }
    return imgCache[src];
  }
  /* キャンバスは「読み終えた書体」でしか描けない。これから描く字を渡して、その字の分を先に読ませる。 */
  function fontsFor(strs) {
    var fs = document.fonts;
    if (!fs || !fs.load) return Promise.resolve();
    var s = strs.join('') || WORD.brand;
    var want = [D.W_HEAD + ' 24px "Noto Sans JP"', D.W_TEXT + ' 24px "Noto Sans JP"',
                D.W_NUM + ' 24px Inter', D.W_MID + ' 24px Inter', D.W_TEXT + ' 24px Inter'];
    return Promise.all(want.map(function (f) { return fs.load(f, s).catch(noop); }))
      .then(function () { return fs.ready; }).catch(noop);
  }
  function stringsOf(m) {
    var out = [WORD.brand, WORD.head, WORD.cap, WORD.fo, WORD.max, WORD.photo, WORD.rated];
    m.cards.forEach(function (c) {
      out.push(c.ja, c.en, c.code, c.url, c.photo ? c.photo.credit : '');
      if (c.rating) out.push(c.rating.avg, c.rating.text);
      c.axis.forEach(function (s) { out.push(s); });
      ROLES.forEach(function (k) {
        var r = c.roles[k];
        if (!r) return;
        out.push(r.text, r.tag, r.sub);
        if (r.lim) out.push(r.lim.text, r.lim.tag, r.lim.sub);
      });
    });
    return out;
  }

  /* ── 画面（見本と選ぶ所） ─────────────────────────────────────────── */
  var S = { a: null, b: null, p: 0, q: 0, t: THEMES[0] };
  var ui = null, active = false, busy = false, lastB = null, last = null, seq = 0, job = Promise.resolve(), raf = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function field(label, legend) {
    var f = el(legend ? 'fieldset' : 'div', 'crc-f');
    var l = el(legend ? 'legend' : 'label', 'crc-l', label);
    f.appendChild(l);
    return { box: f, label: l };
  }
  function seg(list, onPick) {
    var box = el('div', 'crc-seg');
    list.forEach(function (it) {
      var b = el('button', 'crc-opt', it.text);
      b.type = 'button'; b.value = it.value;
      b.addEventListener('click', function () { onPick(it.value); });
      box.appendChild(b);
    });
    return box;
  }
  function press(box, value) {
    Array.prototype.forEach.call(box.children, function (b) { b.setAttribute('aria-pressed', String(b.value === String(value))); });
  }
  function select(id, onPick) {
    var s = el('select', 'crc-sel');
    s.id = id;
    /* 会社は地域ごとに束ねる（地域の名前は航空会社一覧の見出しと同じ字 ── 材料の g。出てきた順に1つずつ）。g の無い会社は束ねずに並べる。 */
    var groups = {};
    SLUGS.forEach(function (k) {
      var g = AIR[k].g || '', o = el('option', '', nameOf(AIR[k]) || k);
      o.value = k;
      if (!g) { s.appendChild(o); return; }
      if (!groups[g]) { groups[g] = el('optgroup'); groups[g].label = g; s.appendChild(groups[g]); }
      groups[g].appendChild(o);
    });
    s.addEventListener('change', function () { onPick(s.value); });
    return s;
  }
  function build() {
    var wrapEl = el('div', 'crc'), stage = el('div', 'crc-stage'), panel = el('div', 'crc-panel');
    var cv = el('canvas', 'crc-canvas');
    cv.width = D.W; cv.height = D.H;
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', WORD.preview);
    stage.appendChild(cv);

    var fCount = field(WORD.count, true);
    var segN = seg([{ value: '1', text: WORD.one }, { value: '2', text: WORD.two }], function (v) {
      if (v === '1') { if (S.b) lastB = S.b; S.b = null; }
      else if (!S.b) { S.b = known(lastB) && lastB !== S.a ? lastB : SLUGS.filter(function (k) { return k !== S.a; })[0] || null; S.q = 0; }
      changed();
    });
    fCount.box.appendChild(segN);

    var cos = el('div', 'crc-cos'), fA = field(WORD.co, false), fB = field(WORD.coB, false);
    var selA = select('crc-a', function (v) { if (v === S.b) { S.b = S.a; S.q = S.p; } S.a = v; S.p = 0; changed(); });
    var selB = select('crc-b', function (v) { if (v === S.a) return; S.b = v; S.q = 0; changed(); });
    fA.label.htmlFor = 'crc-a'; fB.label.htmlFor = 'crc-b';
    fA.box.appendChild(selA); fB.box.appendChild(selB);
    cos.appendChild(fA.box); cos.appendChild(fB.box);

    var fPa = field(WORD.pic, true), fPb = field(WORD.pic, true);
    var thA = el('div', 'crc-ph'), thB = el('div', 'crc-ph');
    fPa.box.appendChild(thA); fPb.box.appendChild(thB);

    var fT = field(WORD.design, true);
    var segT = seg(THEMES.map(function (t) { return { value: t, text: WORD[t] }; }), function (v) { S.t = v; changed(); });
    fT.box.appendChild(segT);

    var act = el('div', 'crc-act'), save = el('button', 'crc-btn', WORD.save), share = el('button', 'crc-btn is-ghost', WORD.share);
    save.type = 'button'; share.type = 'button'; share.hidden = true;
    save.addEventListener('click', onSave);
    share.addEventListener('click', onShare);
    act.appendChild(save); act.appendChild(share);

    [fCount.box, cos, fPa.box, fPb.box, fT.box, act].forEach(function (n) { panel.appendChild(n); });
    wrapEl.appendChild(stage); wrapEl.appendChild(panel);
    root.textContent = '';
    root.appendChild(wrapEl);
    ui = { cv: cv, ctx: cv.getContext('2d'), segN: segN, segT: segT, selA: selA, selB: selB, fA: fA, fB: fB,
           fPa: fPa, fPb: fPb, thA: thA, thB: thB, save: save, share: share };
    try {
      var probe = new File([''], 'a.png', { type: 'image/png' });
      share.hidden = !(navigator.canShare && navigator.share && navigator.canShare({ files: [probe] }));
    } catch (e) { share.hidden = true; }
  }
  function thumbs(box, slug, ix, onPick) {
    var photos = AIR[slug].photos || [];
    box.textContent = '';
    photos.forEach(function (p, i) {
      var b = el('button', 'crc-th'), im = el('img');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(i === ix));
      b.setAttribute('aria-label', WORD.pic + ' ' + (i + 1));
      im.src = p.src; im.alt = ''; im.width = p.w; im.height = p.h; im.decoding = 'async';
      b.appendChild(im);
      b.addEventListener('click', function () { onPick(i); });
      box.appendChild(b);
    });
  }
  function refresh() {
    var two = !!S.b;
    press(ui.segN, two ? '2' : '1');
    press(ui.segT, S.t);
    ui.selA.value = S.a;
    ui.fA.label.textContent = two ? WORD.coA : WORD.co;
    ui.fB.box.hidden = !two;
    if (two) ui.selB.value = S.b;
    Array.prototype.forEach.call(ui.selA.options, function (o) { o.disabled = false; });
    Array.prototype.forEach.call(ui.selB.options, function (o) { o.disabled = o.value === S.a; });
    ui.fPa.label.textContent = two ? tagged(WORD.pic, nameOf(AIR[S.a])) : WORD.pic;
    thumbs(ui.thA, S.a, S.p, function (i) { S.p = i; changed(); });
    ui.fPa.box.hidden = (AIR[S.a].photos || []).length < 2;
    ui.fPb.box.hidden = !two || (AIR[S.b].photos || []).length < 2;
    if (two) {
      ui.fPb.label.textContent = tagged(WORD.pic, nameOf(AIR[S.b]));
      thumbs(ui.thB, S.b, S.q, function (i) { S.q = i; changed(); });
    }
    ui.cv.setAttribute('aria-label', tagged(WORD.preview, nameOf(AIR[S.a]) + (two ? WORD.mid + nameOf(AIR[S.b]) : '')));
  }

  /* ── 住所（選び直しは履歴を積まない） ─────────────────────────────────── */
  function clampIx(slug, v) {
    var n = parseInt(v, 10), len = slug && AIR[slug] ? (AIR[slug].photos || []).length : 0;
    return n > 0 && n < len ? n : 0;
  }
  function take(st) {
    var q = new URLSearchParams(location.search);
    var a = st && known(st.a) ? st.a : q.get('a');
    var b = st && 'b' in st ? st.b : q.get('b');
    if (!known(a)) a = known(S.a) ? S.a : SLUGS[0];
    if (!known(b) || b === a) b = null;
    S.a = a; S.b = b;
    S.p = clampIx(a, q.get(KEY_P)); S.q = b ? clampIx(b, q.get(KEY_Q)) : 0;
    S.t = THEMES.indexOf(q.get(KEY_T)) >= 0 ? q.get(KEY_T) : THEMES[0];
  }
  function href() {
    var q = new URLSearchParams();
    q.set('view', 'card'); q.set('a', S.a);
    if (S.b) q.set('b', S.b);
    if (S.p) q.set(KEY_P, String(S.p));
    if (S.b && S.q) q.set(KEY_Q, String(S.q));
    if (S.t !== THEMES[0]) q.set(KEY_T, S.t);
    return location.pathname + '?' + q.toString();
  }
  function changed() {
    var pv = PV();
    busy = true;
    try { if (pv && pv.replace) pv.replace({ view: 'card', a: S.a, b: S.b || null, p: S.p, q: S.q, t: S.t }); } catch (e) {}
    busy = false;
    try { history.replaceState(history.state, '', href()); } catch (e2) {}
    refresh();
    render();
  }

  /* ── 描き直し ───────────────────────────────────────────────────── */
  function render() {
    if (!ui) return job;
    var my = ++seq, st = { a: S.a, b: S.b, p: S.p, q: S.q, t: S.t };
    job = job.then(function () {
      if (my !== seq) return null;
      askRating(st.a); if (st.b) askRating(st.b);
      var top = scaleOf([st.a, st.b]);              // 2社は同じ目盛（★2026-10-24 P12.104）
      var m = { t: st.t, cards: [readCard(st.a, st.p, top)] };
      if (st.b) m.cards.push(readCard(st.b, st.q, top));
      return Promise.all([fontsFor(stringsOf(m)), Promise.all(m.cards.map(function (c) { return loadImg(c.photo && c.photo.src); }))])
        .then(function (r) {
          if (my !== seq) return null;
          m.layout = paint(ui.ctx, m, r[1]);
          last = m;
          root.setAttribute('data-drawn', String(my));
          return m;
        });
    }).catch(noop);
    return job;
  }
  function schedule() {
    if (!active || raf) return;
    raf = requestAnimationFrame(function () { raf = 0; render(); });
  }

  /* ── 保存・共有 ─────────────────────────────────────────────────── */
  function fileName() { return 'pilot-value-' + S.a + (S.b ? '-' + S.b : '') + '.png'; }
  function toBlob() {
    return render().then(function () {
      return new Promise(function (res) { ui.cv.toBlob(res, 'image/png'); });
    });
  }
  var lastUrl = null;
  function onSave() {
    var name = fileName();
    toBlob().then(function (blob) {
      if (!blob) return;
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      lastUrl = URL.createObjectURL(blob);
      var a = el('a');
      a.href = lastUrl; a.download = name; a.hidden = true;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }).catch(noop);
  }
  function onShare() {
    var name = fileName();
    toBlob().then(function (blob) {
      if (!blob) return null;
      return navigator.share({ files: [new File([blob], name, { type: 'image/png' })] });
    }).catch(noop);
  }

  /* ── 出入り ─────────────────────────────────────────────────────── */
  function open(st) {
    active = true;
    ASKED = {};
    take(st);
    if (!ui) build();
    refresh();
    render();
  }
  cr.addEventListener('cr:show', function (e) {
    if (busy) return;
    var st = e.detail || {};
    if (st.view !== 'card') { active = false; return; }
    open(st);
  });
  window.addEventListener('pv-currency-change', schedule);   // 字は currency.js が直し終えている。次の描画の前に読み直す
  window.addEventListener('load', schedule);                  // 書体の一覧が後から届くことがある
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', function () { if (last && seq) schedule(); });

  window.PVCareerCard = {
    model: function () { return last ? JSON.parse(JSON.stringify(last)) : null; },
    redraw: function () { return render(); }
  };

  var pv0 = PV(), st0 = null;
  try { st0 = pv0 && pv0.state ? pv0.state() : null; } catch (e) { st0 = null; }
  if (st0 && st0.view === 'card') open(st0);
  else if (!st0 && new URLSearchParams(location.search).get('view') === 'card') open(null);
})();
