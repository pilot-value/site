/* ==========================================================================
   salary-leveling.js — PILOT VALUE 共有レベリング・グリッド（Levels.fyi 型）
   年次×役職の共通「背骨」で各社の年収を段位ごとに横並び比較する描画中核。
   world-airlines.html（フル比較UI＝チップpicker/検索付き）と
   index.html（コンパクト主役版＝主要4社）が共用する。

   一元化する“ドリフトしやすい”部分：
   ・.lvl-* のCSS（ヒートマップ配色・内訳バー含む）を injectCSS() で1回注入
   ・ヒートマップ（年収→セル背景の濃さ）＝heatAlpha()
   ・就航区分の重心移動＝modeBand()
   ・Levels.fyi 風の内訳棒グラフ＝breakdownHtml()（構成比モデル＝目安ラベル付き）
   ・ツールチップ本文＝tipHtml()／セル＝cellHtml()

   データは SSOT（salary-data.mjs）→ salary-data.json（生成物）。
   数値の唯一の正は SALARY。ラダーは機械導出、内訳は代表値repの内分（目安）で捏造しない。
   非ESモジュール（search.js / lang-toggle.js と同じ <script src> 規約）。
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.PVLeveling) return;                       // 二重読み込みガード

  // ── データ URL（このスクリプト自身の位置を基準に解決）────────────
  // currentScript は同期実行中のみ有効なので、IIFE 冒頭で確定させる。
  var _selfSrc = (d.currentScript && d.currentScript.src) || '';
  var DATA_URL = 'salary-data.json';
  try { if (_selfSrc) DATA_URL = new URL('salary-data.json', _selfSrc).href; } catch (e) {}
  var ASSET_BASE = '';
  try { if (_selfSrc) ASSET_BASE = new URL('./', _selfSrc).href; } catch (e) {}

  // 表示社名。airlines-meta.js は name(日本語)/en(英語)を両方持つので、EN ページでは en を主にする。
  function nameOf(a) { return (IS_EN && a && a.en) ? a.en : (a ? a.name : ''); }

  // ── 表示言語（/en/ 配下 or <html lang="en"> ＝英語ページ）──────
  // 判定は currency.js の isENPage() と同一規約。日本語ページでは T() が引数を
  // そのまま返す＝描画結果は 1 バイトも変わらない（回帰ゼロ）。
  function isENPage() {
    try {
      if (w.location && w.location.pathname.indexOf('/en/') !== -1) return true;
      var lang = d.documentElement && d.documentElement.getAttribute('lang');
      return !!(lang && lang.toLowerCase().indexOf('en') === 0);
    } catch (e) { return false; }
  }
  var IS_EN = isENPage();
  // 日本語原文（ソース中の文字列そのもの）→ 英訳。金額の「万」単位は対象外
  // （currency.js が DOM 上の「万」トークンを走査するため絶対に触らない）。
  var L10N = {
    '全機種平均': 'All fleet average',
    '国内ナローボディ': 'Domestic narrow-body',
    '国際ワイドボディ': 'International wide-body',
    '訓練生・発令前': 'Trainee · pre-assignment',
    'リージョナル機 副操縦士': 'Regional First Officer',
    '小型機（単通路）副操縦士': 'Narrow-body First Officer',
    '大型機（複通路）副操縦士': 'Wide-body First Officer',
    'リージョナル機 機長': 'Regional Captain',
    '小型機（単通路）機長': 'Narrow-body Captain',
    '大型機（複通路）機長': 'Wide-body Captain',
    '査察機長・教官・運行幹部': 'Check airman · Instructor · Flight ops',
    '訓練機（C172 / G58）・FFS': 'Trainers (C172 / G58) · FFS',
    '全機種（査察・教官ライセンス保有）': 'All types (check airman / instructor rated)',
    '自社養成・航大卒・私大卒 訓練生': 'Airline cadet · Civil Aviation College · university cadets',
    'ANAウイングス・J-AIR・JAC・海外Regional': 'ANA Wings · J-AIR · JAC · overseas regionals',
    'ANA/JAL小型機・Peach・Jetstar': 'ANA/JAL narrow-body · Peach · Jetstar',
    'ANA/JAL国際線・Emirates・Qatar': 'ANA/JAL international · Emirates · Qatar',
    '地方路線機長・リージョナル機長': 'Regional route captains',
    '国内線機長・LCC機長・米メジャーN機長': 'Domestic captains · LCC captains · US major narrow-body',
    '長距離国際線機長・A380·747 機長': 'Long-haul international captains · A380/747 captains',
    'Check Pilot・Instructor・運航管理者': 'Check pilot · Instructor · Flight operations',
    '推定年収（目安）の内訳': 'Estimated annual salary breakdown',
    '基本給': 'Base pay',
    '乗務手当': 'Flight allowance',
    '賞与': 'Bonus',
    '※内訳は一般的な構成比に基づく': 'Breakdown uses a typical pay mix — an ',
    '目安': 'approximation',
    '。実額の内訳は現役の給与明細で解放します。': '. Actual reported breakdowns unlock when pilots submit a payslip.',
    '国内ナローは飛行時間が短めで乗務手当が抑えめ＝レンジ下側に寄ります。': 'Domestic narrow-body flying has shorter block hours and a lower flight allowance, so pay sits at the low end of the range.',
    '国際ワイドは飛行時間が長く乗務手当が厚い＝レンジ上側に寄ります。': 'International wide-body flying has longer block hours and a richer flight allowance, so pay sits at the high end of the range.',
    '国際線ワイドボディは月間ブロックタイムが伸び、同年次でもレンジ上側に寄ります。': 'International wide-body flying builds more monthly block time, so pay sits higher in the range at the same seniority.',
    '推定レンジ ': 'Estimated range ',
    '該当機材': 'Aircraft types',
    '具体例': 'Examples',
    'データ種別': 'Data type',
    '監修レンジ×機種推計': 'Verified range × type estimate',
    '推計レンジ×機種推計': 'Estimated range × type estimate',
    '※機種別の切り分けは現行レンジからの推計。実額は現役の給与明細で解放します。': 'Type-by-type splits are estimated from the current range. Actual reported pay unlocks when pilots submit a payslip.',
    '（': ' (',
    '）': ')',
    '・': ' · ',
    'レンジ ': 'Range ',
    ' ／ ': ' / ',
    '各社ページ監修の実額': 'Actual reported, verified on the airline page',
    '現行レンジからの推計': 'Estimated from the current range',
    'データ募集中': 'Collecting data',
    '役職手当は現役の明細で': 'Management pay via submitted payslips',
    '実額は明細で解放': 'Actual pay unlocks with a payslip',
    '実額': 'Actual',
    '推計': 'Estimate',
    ' の詳細ページを見る →': ' — view the full salary page →',
    ' の年収詳細': ' annual salary details',
    '閉じる': 'Close',
    '推定年収': 'Est. annual salary',
    '。実額の内訳は現役パイロットの給与明細で解放されます。': '. Actual reported breakdowns unlock when working pilots submit a payslip.',
    '給与明細を出して解放する': 'Submit a payslip to unlock',
    '募集中': 'Collecting',
    '会社を選ぶと、機種ごとの段位で年収を横並び比較できます。': 'Pick airlines to compare annual salary side by side, level by level for each aircraft type.',
    ' を比較から外す': ': remove from comparison',
    '会社を選ぶと、段位ごとに年収を横並び比較できます。': 'Pick airlines to compare annual salary side by side at every level.',
    '年次 / 役職': 'Seniority / Rank',
    '上＝役職・下＝若手': 'Top = senior · bottom = junior',
    '比較から外す': 'Remove from comparison',
    '会社を選んで比較': 'Pick airlines to compare',
    'よく見られる航空会社': 'Popular airlines',
    '会社を追加': 'Add airline',
    '航空会社を検索…（社名・地域）': 'Search airlines… (name or region)',
    '航空会社を検索': 'Search airlines',
    ' 社': ' airlines',
    '社まで表示中。新しく選ぶと一番古い会社と入れ替わります。': ' airlines max — selecting another replaces the oldest.',
    '「': '"',
    '」に一致する会社がありません': '" — no matching airlines',
    '＋': '+',
    '給与データを読み込めませんでした。時間をおいて再度お試しください。': 'Could not load the salary data. Please try again in a moment.',
    '給与データを読み込み中…': 'Loading salary data…'
  };
  function T(s) { return IS_EN && L10N[s] ? L10N[s] : s; }

  // ページ間リンクは EN 版が実在するときだけ言語ディレクトリ内に留め、無ければ
  // ルート（日本語版）へ退避する。/en/ から存在しないページを踏むと 404 になるため。
  // 実在判定は lang-toggle.js が生成する PV_EN_PAGES を唯一の正として参照する。
  function pageHref(f) {
    if (!IS_EN) return f;
    var set = window.PV_EN_PAGES;
    return (set && set.has(f.split('#')[0])) ? f : ASSET_BASE + f;
  }

  // ── 定数（world-airlines と一致）─────────────────────────────
  var TONE     = { train:'#6b7d93', fo:'#5fb0ff', cap:'#f5c842', mgmt:'#c07cff' };
  var MODE_LAB = { all:T('全機種平均'), dom:T('国内ナローボディ'), intl:T('国際ワイドボディ') };
  // 内訳バーの3成分カラー（reference画像＝Salary緑 / Stock青 / Bonus金 に対応）
  var COMP     = { base:'#34d399', duty:'#5fb0ff', bonus:'#f5c842' };
  // ヒートマップ全社グローバル域（万）。300=訓練生下限 / 8700≒Delta機長シニア上限。
  var HEAT_MIN = 300, HEAT_MAX = 8700;

  // ── 機種ベースのレベリング体系（オーナー確定スプレッドシート＝唯一の正）──
  // 縦軸を「年次×役職」から「機種（Regional/Narrow/Wide）×FO/CAP＋Trainee＋Check」に再定義。
  // 数値は作らず、既存 8 段 ladder を支払い額の昇順で 1:1 にリラベルするだけ（円はブレンドしない）。
  // spine=既存 ladder キー。上→下＝T…CAP CK（Levels.fyi Indeed L0-top と同じ並び）。
  var LEVELS = [
    { code:'T',      name:'Trainee',            role:T('訓練生・発令前'),           fleet:T('訓練機（C172 / G58）・FFS'),                 ex:T('自社養成・航大卒・私大卒 訓練生'),          spine:'cadet',    cat:null },
    { code:'FO R',   name:'Regional FO',        role:T('リージョナル機 副操縦士'),   fleet:'DHC-8(Q400) / ATR42·72 / E170·190 / CRJ',   ex:T('ANAウイングス・J-AIR・JAC・海外Regional'),  spine:'fo_early', cat:'r'  },
    { code:'FO N',   name:'Narrowbody FO',      role:T('小型機（単通路）副操縦士'),  fleet:'B737 / A320·321 / A220 / B757',             ex:T('ANA/JAL小型機・Peach・Jetstar'),            spine:'fo_mid',   cat:'n'  },
    { code:'FO W',   name:'Widebody FO',        role:T('大型機（複通路）副操縦士'),  fleet:'A330 / B767 / B787 / A350 / B777 / A380',   ex:T('ANA/JAL国際線・Emirates・Qatar'),           spine:'fo_snr',   cat:'w'  },
    { code:'CAP R',  name:'Regional Captain',   role:T('リージョナル機 機長'),       fleet:'DHC-8(Q400) / ATR42·72 / E170·190 / CRJ',   ex:T('地方路線機長・リージョナル機長'),           spine:'cap_new',  cat:'r'  },
    { code:'CAP N',  name:'Narrowbody Captain', role:T('小型機（単通路）機長'),      fleet:'B737 / A320·321 / A220 / B757',             ex:T('国内線機長・LCC機長・米メジャーN機長'),     spine:'cap_mid',  cat:'n'  },
    { code:'CAP W',  name:'Widebody Captain',   role:T('大型機（複通路）機長'),      fleet:'A330 / B767 / B787 / A350 / B777 / A380',   ex:T('長距離国際線機長・A380·747 機長'),          spine:'cap_snr',  cat:'w'  },
    { code:'CAP CK', name:'Check Airman',       role:T('査察機長・教官・運行幹部'),  fleet:T('全機種（査察・教官ライセンス保有）'),        ex:T('Check Pilot・Instructor・運航管理者'),      spine:'mgmt',     cat:null }
  ];
  // Levels.fyi 丸パクリ＝縦軸＝年収の“絶対スケール”。箱の縦位置が年収を表し、
  // 同じ高さ＝同じ年収（会社をまたいで一致）＝JAL CAP N ≒ Emirates FO R が横で揃う。
  var INCOME_PX = 432;  // 年収レンジ全域に割り当てる px（縦幅=旧360×1.2＝オーナーFB6）
  var CK_H      = 22;   // CAP CK（データ募集中）＝各列の最下部に固定小で置く
  var GAP       = 0.5;  // 箱同士＝髪の毛1本(0.5px)の均一な隙間（縦の段間も横の列間も同じ）
  var MINH      = 16;   // 薄い年収帯でも潰れない最小箱高（重なりは「実描画下端＋GAP」連結で回避）
  var TOPPAD    = 2;    // 図の最上部の余白
  var AMT_MIN_H = 28;   // 箱がこれ以上なら箱内に推定年収も表示
  var CODE_MIN_H = 12;  // 箱がこれ未満なら箱内コードは非表示（hover で表示）

  // ── utils ────────────────────────────────────────────────────
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }
  function r10(n) { return Math.round(n / 10) * 10; }
  // n は「万」単位（×10,000円）。通貨切替ランタイムがあれば現在通貨で整形（表示専用・円がベース）。
  function fmtMan(n) {
    if (w.PVCurrency && typeof w.PVCurrency.fmt === 'function') return w.PVCurrency.fmt(Math.round(Number(n) * 10000));
    return '¥' + Number(n).toLocaleString('en-US') + '万';
  }
  // lo・hi は「万」単位のレンジ。JPY（既定）は黄金の見た目 `lo–hi万` をそのまま維持し、
  // 非JPY選択時のみ両端を現在通貨へ変換（ツールチップ/セルのレンジ行を金額表示と一致させる）。
  // ★ 英語ページは JPY でも「万」を使わない。万＝1万という位取りは日本語圏の知識なので、
  //   英語の読者には ¥22,000,000–¥35,000,000 と桁のまま出す（currency.js の fmt() と同じ規約）。
  function fmtRange(lo, hi) {
    if (w.PVCurrency && typeof w.PVCurrency.get === 'function' && (IS_EN || w.PVCurrency.get() !== 'JPY')) {
      return w.PVCurrency.fmt(Math.round(Number(lo) * 10000)) + '–' + w.PVCurrency.fmt(Math.round(Number(hi) * 10000));
    }
    return (+lo).toLocaleString('en-US') + '–' + (+hi).toLocaleString('en-US') + '万';
  }

  // ── ブランド色→HSL（Levels.fyi風パステルの生成に使う・オーナーFB8②）──
  function hexToHsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255,
        g = parseInt(hex.slice(3, 5), 16) / 255,
        b = parseInt(hex.slice(5, 7), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var h = 0, s = 0, l = (mx + mn) / 2;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r)      h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = ((b - r) / d + 2);
      else               h = ((r - g) / d + 4);
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  // 段位t(0=T…1=CAP W)で明度を段階変化。Levels.fyi のように淡く上品な面（鮮やかにし過ぎない）。
  function lvlPastel(hsl, t, dark) {
    var S = Math.min(72, Math.max(46, hsl.s));
    if (dark) return 'hsl(' + hsl.h + ',' + Math.round(S * 0.8) + '%,' + (30 + t * 22).toFixed(1) + '%)';
    return 'hsl(' + hsl.h + ',' + Math.round(S * 0.95) + '%,' + (91 - t * 24).toFixed(1) + '%)';
  }

  // ── 社ロゴ＝各社の正規ロゴ画像（assets/airline-logos/<slug>.<ext>）。無い社はブランド色モノグラムにフォールバック（オーナーFB9①）──
  function monogram(a) {
    var s = ((a && (a.en || a.name)) || '').replace(/[^A-Za-z ]/g, ' ').trim();
    if (!s) return '✈';
    var w = s.split(/\s+/);
    return (w.length >= 2 ? (w[0][0] + w[1][0]) : s.slice(0, 2)).toUpperCase();
  }
  // 各社 slug を file/slug/PV_slugOf から解決
  function slugOf(a) {
    if (a && a.slug) return a.slug;
    if (typeof window !== 'undefined' && window.PV_slugOf) { try { var s = window.PV_slugOf(a); if (s) return s; } catch (e) {} }
    return (a && a.file) ? String(a.file).replace(/^.*\//, '').replace(/\.html$/, '') : '';
  }
  function logoExt(a) {
    var map = (typeof window !== 'undefined' && window.PV_LOGOS) || {};
    var sl = slugOf(a);
    return sl && map[sl] ? map[sl] : null;
  }
  function monoHtml(a) {
    var p = hexToRgb(a.color).split(',');
    var lum = 0.299 * +p[0] + 0.587 * +p[1] + 0.114 * +p[2];
    var txt = lum > 150 ? '#1a2233' : '#fff';
    return '<span class="lvl-logo" style="background:' + a.color + ';color:' + txt + '">' + monogram(a) + '</span>';
  }
  function logoHtml(a) {
    var ext = logoExt(a);
    if (!ext) return monoHtml(a); // 正規ロゴが無い社はモノグラム
    var p = hexToRgb(a.color).split(',');
    var lum = 0.299 * +p[0] + 0.587 * +p[1] + 0.114 * +p[2];
    var txt = lum > 150 ? '#1a2233' : '#fff';
    // 白ピルに自然縦横比で実ロゴを載せる。読込失敗時は onerror でモノグラム（.lg-fail）に切替
    return '<span class="lvl-logo lvl-logo-real">' +
      '<span class="lvl-mono" style="background:' + a.color + ';color:' + txt + '">' + monogram(a) + '</span>' +
      '<img class="lvl-lg-img" alt="" loading="lazy" src="' + ASSET_BASE + 'assets/airline-logos/' + slugOf(a) + '.' + ext + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'lg-fail\')">' +
      '</span>';
  }

  // ── 機材フラグ判定（各社が実際に保有する機材帯だけ段を出す）──
  // a.fleet = 'r'/'n'/'w' の組合せ短縮文字列（例 'nw' / 'w' / 'rnw'）。
  // T・CAP CK（cat=null）は常時表示。fleet 未設定の社は全段表示＝後方互換・段階導入。
  function fleetHas(a, cat) {
    if (cat == null) return true;
    var f = a && a.fleet;
    if (!f) return true;
    return f.indexOf(cat) >= 0;
  }

  // ── 就航区分で重心を動かす（新しい数字は作らず同一レンジ内で寄せるだけ）──
  // 基本給の機種差は小さく、変動要因は月間ブロックタイム＝国内は下側・国際は上側。
  function modeBand(c, mode) {
    var s = c.hi - c.lo;
    if (mode === 'dom')  return { lo:c.lo,               hi:r10(c.lo + s * 0.55), rep:r10(c.lo + s * 0.28) };
    if (mode === 'intl') return { lo:r10(c.lo + s * 0.45), hi:c.hi,               rep:r10(c.lo + s * 0.72) };
    return                       { lo:c.lo,               hi:c.hi,               rep:r10(c.lo + s * 0.5)  };
  }

  // ── ヒートマップ：年収→セル背景アルファ（.05〜.77）。色相はブランド色を維持 ──
  // sqrt圧縮で低段（訓練生）も可視／濃淡の幅を広げ最上段がはっきり濃い、を両立。
  function heatAlpha(rep) {
    var lo = Math.sqrt(HEAT_MIN), hi = Math.sqrt(HEAT_MAX);
    var v  = Math.max(HEAT_MIN, Math.min(HEAT_MAX, rep));
    var t  = (Math.sqrt(v) - lo) / (hi - lo);
    return +(0.05 + t * 0.72).toFixed(3);
  }

  // ── 段位ベースの濃淡：年収に依らず「上（T）＝薄い→下（CAP CK）＝濃い」（オーナーFB6）──
  // levelIdx＝LEVELS内の順位（0=T … 7=CAP CK）。全社で同段＝同じ濃さ＝縦のグラデが揃う。
  function posAlpha(levelIdx) {
    var t = levelIdx / (LEVELS.length - 1);   // 0(T)…1(CAP CK)
    return +(0.15 + t * 0.6).toFixed(3);      // 上=薄→下=濃・全体を鮮やか寄りに（オーナーFB7③）
  }

  // ── 内訳モデル（構成比の“目安”。事実値の平均化ではなく代表値repを内分するだけ）──
  // 国際ワイドほど乗務手当を厚く（modeBand と同じ「ブロックタイム」論理）。
  function compRatio(mode) {
    if (mode === 'dom')  return { base:0.58, duty:0.27, bonus:0.15 };
    if (mode === 'intl') return { base:0.46, duty:0.40, bonus:0.14 };
    return                       { base:0.52, duty:0.33, bonus:0.15 };
  }
  function compModel(rep, mode) {
    var r = compRatio(mode);
    var base = r10(rep * r.base), duty = r10(rep * r.duty);
    var bonus = r10(Math.max(0, rep - base - duty));   // 端数は賞与へ寄せ合計≒rep
    return { base:base, duty:duty, bonus:bonus };
  }

  // ── 内訳バー HTML（tooltip 内・Levels.fyi 風の積み上げ棒＋凡例）──
  function breakdownHtml(rep, mode) {
    var r = compRatio(mode), m = compModel(rep, mode);
    var pB = (r.base * 100).toFixed(1),
        pD = (r.duty * 100).toFixed(1),
        pX = (100 - r.base * 100 - r.duty * 100).toFixed(1);
    return '' +
      '<div class="lvl-tip-est">' + T('推定年収（目安）の内訳') + '</div>' +
      '<div class="lvl-tip-bar">' +
        '<span class="lvl-tip-seg" style="width:' + pB + '%;background:' + COMP.base  + '"></span>' +
        '<span class="lvl-tip-seg" style="width:' + pD + '%;background:' + COMP.duty  + '"></span>' +
        '<span class="lvl-tip-seg" style="width:' + pX + '%;background:' + COMP.bonus + '"></span>' +
      '</div>' +
      '<div class="lvl-tip-legend">' +
        '<span><i style="background:' + COMP.base  + '"></i>' + T('基本給')   + '<b>' + fmtMan(m.base)  + '</b></span>' +
        '<span><i style="background:' + COMP.duty  + '"></i>' + T('乗務手当') + '<b>' + fmtMan(m.duty)  + '</b></span>' +
        '<span><i style="background:' + COMP.bonus + '"></i>' + T('賞与')     + '<b>' + fmtMan(m.bonus) + '</b></span>' +
      '</div>' +
      '<div class="lvl-tip-model">' + T('※内訳は一般的な構成比に基づく') + '<b>' + T('目安') + '</b>' + T('。実額の内訳は現役の給与明細で解放します。') + '</div>';
  }

  function noteByMode(mode) {
    if (mode === 'dom')  return T('国内ナローは飛行時間が短めで乗務手当が抑えめ＝レンジ下側に寄ります。');
    if (mode === 'intl') return T('国際ワイドは飛行時間が長く乗務手当が厚い＝レンジ上側に寄ります。');
    return T('国際線ワイドボディは月間ブロックタイムが伸び、同年次でもレンジ上側に寄ります。');
  }

  // ── 機種レベル用ツールチップ（等級コード＋役割＋該当機材＋具体例＋内訳）──
  function levelTipHtml(dset, mode) {
    return '' +
      '<div class="lvl-tip-co"><span class="d"></span>' + dset.flag + ' ' + dset.co + '</div>' +
      '<div class="lvl-tip-code"><b>' + dset.code + '</b><span>' + dset.lv + '</span></div>' +
      '<div class="lvl-tip-role">' + dset.role + '</div>' +
      '<div class="lvl-tip-amt">' + fmtMan(+dset.rep) + '</div>' +
      '<div class="lvl-tip-rng">' + T('推定レンジ ') + fmtRange(dset.lo, dset.hi) + '</div>' +
      '<div class="lvl-tip-meta"><span>' + T('該当機材') + '</span><b>' + dset.fleet + '</b></div>' +
      '<div class="lvl-tip-meta"><span>' + T('具体例') + '</span><b>' + dset.ex + '</b></div>' +
      '<div class="lvl-tip-row"><span>' + T('データ種別') + '</span><b>' +
        (dset.kind === 'authored' ? T('監修レンジ×機種推計') : T('推計レンジ×機種推計')) + '</b></div>' +
      breakdownHtml(+dset.rep, mode) +
      '<div class="lvl-tip-note">' + T('※機種別の切り分けは現行レンジからの推計。実額は現役の給与明細で解放します。') + '</div>';
  }

  // ── ツールチップ本文（world-airlines / index 共用）──
  function tipHtml(dset, mode) {
    if (dset.code) return levelTipHtml(dset, mode);   // 機種レベル・レイアウト
    var yr = (dset.yr && dset.yr !== '—') ? T('（') + dset.yr + T('）') : '';
    return '' +
      '<div class="lvl-tip-co"><span class="d"></span>' + dset.flag + ' ' + dset.co + '</div>' +
      '<div class="lvl-tip-lv">' + dset.rank + T('・') + dset.lv + yr + '</div>' +
      '<div class="lvl-tip-amt">' + fmtMan(+dset.rep) + '</div>' +
      '<div class="lvl-tip-rng">' + T('レンジ ') + fmtRange(dset.lo, dset.hi) + T(' ／ ') + MODE_LAB[mode] + '</div>' +
      '<div class="lvl-tip-row"><span>' + T('データ種別') + '</span><b>' +
        (dset.kind === 'authored' ? T('各社ページ監修の実額') : T('現行レンジからの推計')) + '</b></div>' +
      breakdownHtml(+dset.rep, mode) +
      '<div class="lvl-tip-note">' + noteByMode(mode) + '</div>';
  }

  // ── セル HTML（ヒートマップ配色つき）──
  // sz（任意）＝{minH,fs}：段位でマス目を段階拡大するピラミッド用（index home のみ・graduated:true）
  function cellHtml(a, s, rg, mode, sz) {
    var rgb = hexToRgb(a.color);
    var szCell = sz ? ';min-height:' + sz.minH + 'px' : '';   // 高さのみ段階変化（文字は一律）
    var c = s.ladder[rg.key];
    if (!c || c.kind === 'collect') {
      return '<div class="lvl-cell collect" style="--ac-rgb:' + rgb + szCell + '">' +
        '<span class="lvl-collect-t">' + T('データ募集中') + '</span>' +
        '<span class="lvl-collect-s">' + (rg.tone === 'mgmt' ? T('役職手当は現役の明細で') : T('実額は明細で解放')) + '</span></div>';
    }
    var b = modeBand(c, mode);
    var tag = c.kind === 'authored'
      ? '<span class="lvl-tag authored">' + T('実額') + '</span>'
      : '<span class="lvl-tag est">' + T('推計') + '</span>';
    return '<button class="lvl-cell" style="--ac-rgb:' + rgb + ';--heat:' + heatAlpha(b.rep) + szCell + '"' +
      ' data-co="' + nameOf(a) + '" data-flag="' + a.flag + '" data-color="' + a.color + '"' +
      ' data-file="' + (a.file || '') + '"' +
      ' data-lv="' + rg.label + '" data-yr="' + rg.years + '" data-rank="' + rg.rank + '"' +
      ' data-rep="' + b.rep + '" data-lo="' + b.lo + '" data-hi="' + b.hi + '" data-kind="' + c.kind + '">' +
      '<span class="lvl-amt">' + fmtMan(b.rep) + '</span>' +
      '<span class="lvl-rng">' + fmtRange(b.lo, b.hi) + '</span>' +
      tag + '</button>';
  }

  // ── クリック時の詳細モーダル（ドーナツ内訳＋各社ページリンク）──
  // reference（Levels.fyi）準拠：総額＋基本給/乗務手当/賞与の円グラフ＋「その航空会社へ飛ぶ」導線。
  function openCellModal(dset, mode) {
    var rep = +dset.rep;
    var m = compModel(rep, mode), r = compRatio(mode);
    var total = m.base + m.duty + m.bonus;
    var rgb = hexToRgb(dset.color || '#5fb0ff');
    var R = 52, SW = 20, C = 2 * Math.PI * R, acc = 0;
    var pB = Math.round(r.base * 100), pD = Math.round(r.duty * 100);
    var segs = [
      { v:m.base,  c:COMP.base,  nm:T('基本給'),   p:pB },
      { v:m.duty,  c:COMP.duty,  nm:T('乗務手当'), p:pD },
      { v:m.bonus, c:COMP.bonus, nm:T('賞与'),     p:Math.max(0, 100 - pB - pD) }
    ];
    var arcs = '', legend = '';
    segs.forEach(function (s) {
      var len = (total > 0 ? s.v / total : 0) * C;
      arcs += '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + s.c + '" stroke-width="' + SW +
        '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 66 66)"></circle>';
      acc += len;
      legend += '<div class="lvl-modal-leg"><i style="background:' + s.c + '"></i>' +
        '<span class="nm">' + s.nm + '</span><span class="amt">' + fmtMan(s.v) + '</span>' +
        '<span class="pct">' + s.p + '%</span></div>';
    });
    var yr = (dset.yr && dset.yr !== '—') ? T('（') + dset.yr + T('）') : '';
    var kindTag = dset.kind === 'authored'
      ? '<span class="lvl-modal-tag authored">' + T('各社ページ監修の実額') + '</span>'
      : '<span class="lvl-modal-tag est">' + T('現行レンジからの推計') + '</span>';
    var detailBtn = dset.file
      ? '<a class="lvl-modal-btn primary" href="' + dset.file + '">' + dset.co + T(' の詳細ページを見る →') + '</a>'
      : '';
    var ov = d.createElement('div');
    ov.className = 'lvl-modal-ov';
    ov.style.setProperty('--ac-rgb', rgb);
    ov.innerHTML =
      '<div class="lvl-modal-card" role="dialog" aria-modal="true" aria-label="' + dset.co + ' ' + dset.lv + T(' の年収詳細') + '">' +
        '<button class="lvl-modal-x" aria-label="' + T('閉じる') + '">✕</button>' +
        '<div class="lvl-modal-head"><span class="lvl-modal-flag">' + dset.flag + '</span>' +
          '<div><div class="lvl-modal-co">' + dset.co + '</div>' +
          '<div class="lvl-modal-lv">' + dset.rank + T('・') + dset.lv + yr + T(' ／ ') + MODE_LAB[mode] + '</div></div></div>' +
        '<div class="lvl-modal-body">' +
          '<div class="lvl-modal-donut"><svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">' +
            '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="rgba(128,140,160,.12)" stroke-width="' + SW + '"></circle>' +
            arcs + '</svg>' +
            '<div class="lvl-modal-center"><span>' + T('推定年収') + '</span><b>' + fmtMan(rep) + '</b></div></div>' +
          '<div class="lvl-modal-legend">' + legend + '</div>' +
        '</div>' +
        kindTag +
        '<div class="lvl-modal-note">' + T('※内訳は一般的な構成比に基づく') + '<b>' + T('目安') + '</b>' + T('。実額の内訳は現役パイロットの給与明細で解放されます。') + '</div>' +
        '<div class="lvl-modal-cta">' + detailBtn +
          '<a class="lvl-modal-btn ghost" href="' + pageHref('pay-report.html') + '">' + T('給与明細を出して解放する') + '</a>' +
        '</div>' +
      '</div>';
    function close() {
      ov.classList.remove('show');
      d.removeEventListener('keydown', onKey);
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('.lvl-modal-x')) close();
    });
    d.addEventListener('keydown', onKey);
    d.body.appendChild(ov);
    ov.getBoundingClientRect();          // reflow → トランジション発火
    ov.classList.add('show');
  }

  // ── 機種レベルのセル（Levels.fyi 型：箱内は等級コードのみ／縦位置＝年収／絶対配置）──
  // top・h は「共通の年収スケール」で算出済み px。会社をまたいで同じ y＝同じ年収。
  function levelCellHtml(a, s, L, mode, top, h, showCode) {
    var rgb = hexToRgb(a.color);
    var c = s.ladder[L.spine];
    var pos = ';top:' + top.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px';
    if (!c || c.kind === 'collect') {   // CAP CK＝データ募集中（列の最下部）
      return '<div class="lvl-cell lvl-lvbox collect" style="--ac-rgb:' + rgb + pos + '">' +
        '<span class="lvl-code">' + L.code + '</span>' +
        (h >= 20 ? '<span class="lvl-lvbox-sub">' + T('募集中') + '</span>' : '') + '</div>';
    }
    var b = modeBand(c, mode);
    var hsl = hexToHsl(a.color);
    var t = LEVELS.indexOf(L) / (LEVELS.length - 2);   // 0(T)…1(CAP W)＝CAP CK 除く段位
    var pal = ';--bl:' + lvlPastel(hsl, t, false) + ';--bd:' + lvlPastel(hsl, t, true);
    return '<button class="lvl-cell lvl-lvbox" style="--ac-rgb:' + rgb + pal + pos + '"' +
      ' data-co="' + nameOf(a) + '" data-flag="' + a.flag + '" data-color="' + a.color + '"' +
      ' data-file="' + (a.file || '') + '"' +
      ' data-code="' + L.code + '" data-lv="' + L.name + '" data-rank="' + L.code + '"' +
      ' data-role="' + L.role + '" data-fleet="' + L.fleet + '" data-ex="' + L.ex + '"' +
      ' data-yr="" data-rep="' + b.rep + '" data-lo="' + b.lo + '" data-hi="' + b.hi + '" data-kind="' + c.kind + '">' +
      (showCode ? '<span class="lvl-code">' + L.code + '</span>' : '') + '</button>';
  }

  // ── 機種レベルのカラム描画（Levels.fyi 丸パクリ：縦軸＝年収の絶対スケール／オーナーFB10①）──
  // 各社 1 列。縦軸の最上端＝¥0。各箱の「下端」がその等級の年収位置＝同じ年収＝同じ縦位置（会社間で一致）。
  // 上＝T（低年収）→下＝CAP W（高年収）。列が下まで届くほど天井が高い。
  // ・機材で出し分け：その社が持たない機材帯（fleet フラグ）の段は出さない（抜けた年収帯は次の箱が吸収）。
  // ・箱は連続スタック（隙間は髪の毛1本 GAP のみ）。下端は年収に固定＝floor しない（「下線＝年収」を厳守）。
  function renderLevels(gridEl, SAL, opts) {
    var meta = opts.meta || {}, slugs = opts.slugs || [], mode = opts.mode || 'all';
    var cols = slugs.map(function (sl) { return { sl:sl, a:meta[sl], s:SAL.airlines[sl] }; })
                    .filter(function (x) { return x.a && x.s && x.s.ladder; });
    gridEl.style.gridTemplateColumns = '';
    if (!cols.length) {
      gridEl.innerHTML = '<div class="lvl-empty">' + T('会社を選ぶと、機種ごとの段位で年収を横並び比較できます。') + '</div>';
      return;
    }
    var INCOME = LEVELS.filter(function (L) { return L.spine !== 'mgmt'; });  // T…CAP W（CAP CK は非表示＝オーナーFB8③）

    // 各社が実際に保有する機材帯の段だけを抽出（fleet フラグで出し分け）
    cols.forEach(function (o) {
      o.levels = [];
      INCOME.forEach(function (L) {
        if (!fleetHas(o.a, L.cat)) return;              // 持たない機材帯は段を出さない
        var c = o.s.ladder[L.spine];
        if (!c || c.kind === 'collect') return;
        o.levels.push({ L:L, b:modeBand(c, mode) });
      });
    });

    // 縦軸＝年収の絶対スケール（オーナーFB10①）：縦軸の最上端を ¥0 とし、各箱の「下端」が
    // その等級の代表年収 rep の位置になる。スケールは全表示列で共通＝「同じ年収＝同じ縦位置」を
    // 会社間で保証。列の下端が深いほど天井が高い。fleet で抜けた段はその年収帯を次の箱が吸収。
    var maxRep = 1;
    cols.forEach(function (o) {
      o.levels.forEach(function (x) { maxRep = Math.max(maxRep, x.b.rep); });
    });
    var scale = INCOME_PX / maxRep;   // px / 万円（y=0＝¥0）

    var maxBottom = 0;
    cols.forEach(function (o) {
      var prevBottom = TOPPAD;
      o.boxes = o.levels.map(function (x, i) {
        var bottom = TOPPAD + x.b.rep * scale;              // 箱の下端＝その等級の年収
        var top = (i === 0) ? TOPPAD : prevBottom + GAP;    // 上端＝すぐ上の箱の下端＋髪の毛1本
        var h = Math.max(1, bottom - top);                  // 下端は年収に固定（floor しない＝「下線＝年収」を厳守）
        prevBottom = bottom;
        return { L:x.L, top:top, h:h };
      });
      maxBottom = Math.max(maxBottom, prevBottom);
    });
    var chartH = Math.ceil(maxBottom + TOPPAD);

    // --n＝表示社数。列幅 --colw は CSS 側 calc で --total(898px 固定) を N 分割＝1〜5社すべて
    // 総横幅一定（オーナーFB10.1「5社だと横幅が広くなるから揃えて」＝5社も総幅を広げず列を細く割る）。
    var html = '<div class="lvl-levels" style="--n:' + cols.length + '">';
    // 会社ヘッダ（× ＋ 小ロゴ＋社名の細ピル・列と同じ中央寄せ／国旗なし＝オーナーFB8④）
    html += '<div class="lvl-lv-head">';
    cols.forEach(function (o) {
      var a = o.a;
      html += '<div class="lvl-chead" style="--ac-rgb:' + hexToRgb(a.color) + '" title="' + a.name + (a.en ? ' / ' + a.en : '') + '">' +
        (opts.removable ? '<button class="lvl-chead-x" data-x="' + o.sl + '" aria-label="' + nameOf(a) + T(' を比較から外す') + '">×</button>' : '') +
        '<span class="lvl-chead-nm' + (logoExt(a) ? ' has-logo' : '') + '">' + logoHtml(a) +
        (logoExt(a) ? '' : '<span class="cn">' + nameOf(a) + '</span>') + '</span></div>';
    });
    html += '</div>';
    // 本体（縦軸の数字なし・各社カラムのみ・中央寄せ）
    html += '<div class="lvl-lv-body" style="height:' + chartH + 'px">';
    html += '<div class="lvl-lv-plot">';
    cols.forEach(function (o) {
      var a = o.a;
      html += '<div class="lvl-col" style="--ac-rgb:' + hexToRgb(a.color) + '">';
      o.boxes.forEach(function (bx) {
        html += levelCellHtml(a, o.s, bx.L, mode, bx.top, bx.h, bx.h >= CODE_MIN_H);
      });
      html += '</div>';
    });
    html += '</div></div></div>';
    gridEl.innerHTML = html;
  }

  // ── グリッド本体を描画（コンパクト版＝index／フル版の再描画にも使える）──
  // opts: { meta:{slug:{code,name,en,flag,color}}, slugs:[], mode, removable, layout }
  function renderInto(gridEl, SAL, opts) {
    if (opts.layout === 'levels') return renderLevels(gridEl, SAL, opts);   // 機種ベース Levels.fyi カラム
    var meta = opts.meta || {}, slugs = opts.slugs || [], mode = opts.mode || 'all';
    var cols = slugs.map(function (sl) { return { sl:sl, a:meta[sl], s:SAL.airlines[sl] }; })
                    .filter(function (x) { return x.a && x.s && x.s.ladder; });
    if (!cols.length) {
      gridEl.style.gridTemplateColumns = '1fr';
      gridEl.innerHTML = '<div class="lvl-empty">' + T('会社を選ぶと、段位ごとに年収を横並び比較できます。') + '</div>';
      return;
    }
    gridEl.style.gridTemplateColumns = 'minmax(138px,176px) repeat(' + cols.length + ', minmax(104px,1fr))';
    var h = '<div class="lvl-corner"><span class="lvl-rung-rk lvl-rk-corner">' + T('年次 / 役職') + '</span>' +
            '<span class="lvl-rung-yr">' + T('上＝役職・下＝若手') + '</span></div>';
    cols.forEach(function (o) {
      var a = o.a;
      h += '<div class="lvl-chead" style="--ac-rgb:' + hexToRgb(a.color) + '">' +
        '<div class="lvl-chead-top">' +
        '<div class="ac-code" style="background:' + a.color + '20;color:' + a.color + ';border:1px solid ' + a.color + '35">' + a.code + '</div>' +
        '<div style="min-width:0"><div class="lvl-chead-nm">' + a.flag + ' ' + nameOf(a) + '</div>' +
        '<div class="lvl-chead-en">' + (a.en || '') + '</div></div>' +
        (opts.removable ? '<button class="lvl-chead-x" data-x="' + o.sl + '" title="' + T('比較から外す') + '" aria-label="' + nameOf(a) + T(' を比較から外す') + '">×</button>' : '') +
        '</div></div>';
    });
    var N = SAL.spine.length;
    [].concat(SAL.spine).reverse().forEach(function (rg, ri) {
      // graduated:true（index home のみ）＝Levels.fyi 型に「箱の高さだけ」段階変化。文字サイズは一律。
      // ピーク＝シニア機長（最上位の実データ段）が最大、訓練生が最小。
      // 役職(mgmt＝データ募集中で実額なし)は訓練生と同じ最小に（オーナー指示）。
      var sz = null;
      if (opts.graduated) {
        var sen = N - 1 - ri;                       // 0=訓練生 … N-1=役職
        var t   = (rg.tone === 'mgmt') ? 0          // 役職＝最小（訓練生と同寸）
                : ((N - 2) > 0 ? sen / (N - 2) : 0); // 訓練生0 → シニア機長1
        sz = { minH: Math.round(44 + t * 48) };     // 44〜92px（高さのみ・文字は据置）
      }
      h += '<div class="lvl-rung" style="--tone:' + (TONE[rg.tone] || '#6b7d93') +
        (sz ? ';min-height:' + sz.minH + 'px' : '') + '">' +
        '<span class="lvl-rung-rk">' + rg.rank + '</span>' +
        '<span class="lvl-rung-lab">' + rg.label + '</span>' +
        '<span class="lvl-rung-yr">' + rg.years + '</span></div>';
      cols.forEach(function (o) { h += cellHtml(o.a, o.s, rg, mode, sz); });
    });
    gridEl.innerHTML = h;
  }

  // ── ツールチップの配線（desktop=hover / mobile=tap で pin）──
  function wireTooltip(gridEl, tipEl, scrollEl, getMode) {
    var tipCell = null, pinned = false;
    function show(cell) {
      tipEl.style.setProperty('--ac', cell.dataset.color);
      tipEl.style.setProperty('--ac-rgb', hexToRgb(cell.dataset.color));
      tipEl.innerHTML = tipHtml(cell.dataset, getMode());
      tipEl.classList.add('show');
      tipEl.setAttribute('aria-hidden', 'false');
      tipCell = cell; position(cell);
    }
    function position(cell) {
      var r = cell.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
      var left = r.left + r.width / 2 - t.width / 2;
      left = Math.max(8, Math.min(left, w.innerWidth - t.width - 8));
      var top = r.top - t.height - 9;
      if (top < 8) top = r.bottom + 9;
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
    }
    function hide() { if (pinned) return; tipEl.classList.remove('show'); tipEl.setAttribute('aria-hidden', 'true'); tipCell = null; }
    function reset() { pinned = false; hide(); }
    gridEl.addEventListener('mouseover', function (e) { var c = e.target.closest('.lvl-cell:not(.collect)'); if (c && !pinned) show(c); });
    gridEl.addEventListener('mouseout',  function (e) { var c = e.target.closest('.lvl-cell'); if (c) hide(); });
    gridEl.addEventListener('focusin',   function (e) { var c = e.target.closest('.lvl-cell:not(.collect)'); if (c) show(c); });
    gridEl.addEventListener('focusout',  function () { hide(); });
    // クリック（desktop）／タップ（mobile）＝内訳ドーナツ＋各社リンクのモーダルを開く。
    // hover ツールチップ（内訳バー）は据置＝desktop は hover=バー / click=モーダル。
    gridEl.addEventListener('click',     function (e) {
      var c = e.target.closest('.lvl-cell:not(.collect)'); if (!c) return;
      hide();
      openCellModal(c.dataset, getMode());
    });
    w.addEventListener('scroll', function () { if (tipCell) position(tipCell); }, { passive:true });
    if (scrollEl) scrollEl.addEventListener('scroll', function () { if (tipCell) position(tipCell); }, { passive:true });
    return { reset:reset };
  }

  // ── salary-data.json を1回だけ取得（キャッシュ）──
  // ページ相対で書くと /en/ 配下から /en/salary-data.json を見に行って 404 になる。
  // このスクリプト自身の URL を基準に解決すれば、どの階層のページからでもルート直下を指す。
  var _promise = null;
  function load() {
    if (_promise) return _promise;
    _promise = fetch(DATA_URL).then(function (r) {
      if (!r.ok) throw new Error('salary-data.json fetch failed');
      return r.json();
    });
    return _promise;
  }

  // ── マウント（index.html コンパクト主役版 / 多社ピッカー対応）──
  // mount(gridSelector, {
  //   tip, meta, slugs, mode, modeButtons, layout, // 基本（layout:'levels' で機種8段カラム）
  //   picker, quick, max, pool                      // ピッカー（Levels.fyi 風：クイック選択＋企業検索ドロップダウン）
  // })
  //   picker（セレクタ or 要素）を渡すと、クイック選択ピル＋「会社を追加」検索ドロップダウンで列を追加/削除（最大 max 社）。
  //   quick=よく見る社 slug 配列。列ヘッダの × でも外せる。pool は slug 配列 または 'all'（=meta 全社）。
  //   旧 API（opts.chipHost）も host セレクタとして後方互換。
  function mount(gridSel, opts) {
    opts = opts || {};
    var gridEl = typeof gridSel === 'string' ? d.querySelector(gridSel) : gridSel;
    if (!gridEl) return null;
    var tipEl = opts.tip ? (typeof opts.tip === 'string' ? d.querySelector(opts.tip) : opts.tip) : null;
    var scrollEl = gridEl.closest ? gridEl.closest('.lvl-scroll') : null;
    var meta = opts.meta || {};
    var max = opts.max || 4;
    // ピッカー host（新 API＝opts.picker がセレクタ／旧 API＝opts.chipHost も後方互換）
    var pickSel = (typeof opts.picker === 'string') ? opts.picker : opts.chipHost;
    var pickHost = pickSel ? (typeof pickSel === 'string' ? d.querySelector(pickSel) : pickSel) : null;
    var picker = !!pickHost;
    var quickPref = opts.quick || [];
    var state = { mode: opts.mode || 'all', slugs: (opts.slugs || []).slice() };
    var avail = [];         // ピッカーで選べる slug（ラダー保有・pool 順）
    var els = null;         // ピッカー内部要素の参照
    var dropOpen = false;
    var tip = tipEl ? wireTooltip(gridEl, tipEl, scrollEl, function () { return state.mode; }) : null;

    // ── ピッカー土台（クイック選択行＋企業検索ドロップダウン）を1回だけ構築 ──
    var SRCH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    function buildPicker() {
      if (!pickHost) return;
      pickHost.innerHTML =
        '<div class="lvl-pick-row">' +
          '<span class="lvl-pick-cap">' + T('会社を選んで比較') + '</span>' +
          '<span class="lvl-quick" role="group" aria-label="' + T('よく見られる航空会社') + '"></span>' +
          '<button type="button" class="lvl-add" aria-haspopup="listbox" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' + T('会社を追加') + '</button>' +
          '<span class="lvl-pick-count"></span>' +
        '</div>' +
        '<div class="lvl-drop" hidden>' +
          '<div class="lvl-drop-search">' + SRCH + '<input type="text" class="lvl-drop-input" placeholder="' + T('航空会社を検索…（社名・地域）') + '" aria-label="' + T('航空会社を検索') + '"></div>' +
          '<div class="lvl-drop-list" role="listbox"></div>' +
        '</div>';
      els = {
        quick: pickHost.querySelector('.lvl-quick'),
        add:   pickHost.querySelector('.lvl-add'),
        count: pickHost.querySelector('.lvl-pick-count'),
        drop:  pickHost.querySelector('.lvl-drop'),
        input: pickHost.querySelector('.lvl-drop-input'),
        list:  pickHost.querySelector('.lvl-drop-list')
      };
      els.add.addEventListener('click', function (e) { e.stopPropagation(); toggleDrop(); });
      // カーソルを合わせただけで検索ドロップダウンを開く（オーナーFB6：ホバーで検索）
      els.add.addEventListener('mouseenter', function () { openDrop(); });
      els.quick.addEventListener('click', function (e) { var b = e.target.closest('.lvl-qchip'); if (b && b.dataset.sl) toggle(b.dataset.sl); });
      els.input.addEventListener('input', function () { renderList(els.input.value); });
      els.input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrop(); els.add.focus(); } });
      els.list.addEventListener('click', function (e) {
        var r = e.target.closest('.lvl-drop-item');
        if (r && r.dataset.sl && r.getAttribute('aria-disabled') !== 'true') toggle(r.dataset.sl);
      });
      d.addEventListener('click', function (e) { if (dropOpen && !pickHost.contains(e.target)) closeDrop(); });
    }

    // クイック行＝明示 quick（存在するもの）だけ＝固定長。追加社を混ぜない＝「会社を追加」が左へ動かない（オーナーFB8①）
    function quickList() {
      var out = [], seen = {};
      quickPref.forEach(function (sl) {
        if (!seen[sl] && avail.indexOf(sl) >= 0) { seen[sl] = 1; out.push(sl); }
      });
      return out;
    }
    function renderPicker() {
      if (!els) return;
      var html = '';
      quickList().forEach(function (sl) {
        var a = meta[sl]; if (!a) return;
        var on = state.slugs.indexOf(sl) >= 0;   // 満席でも選択可（入替）＝dis なし
        html += '<button type="button" class="lvl-qchip' + (on ? ' on' : '') +
          '" data-sl="' + sl + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' style="--ch:' + a.color + ';--ch-rgb:' + hexToRgb(a.color) + '">' + logoHtml(a) + '<span class="qc-t">' + nameOf(a) + '</span></button>';
      });
      els.quick.innerHTML = html;
      els.count.textContent = state.slugs.length + ' / ' + max + T(' 社');
    }
    function renderList(q) {
      if (!els) return;
      q = (q || '').trim().toLowerCase();
      // スペース区切りの語すべてを部分一致（英語＝空白を挟んでも一致・例 "air asia"→AirAsia）
      var toks = q.split(/\s+/).filter(Boolean);
      var rows = avail.filter(function (sl) {
        if (!toks.length) return true;
        var a = meta[sl]; if (!a) return false;
        var hay = (a.name + ' ' + (a.en || '') + ' ' + (a.region || '') + ' ' + sl).toLowerCase();
        return toks.every(function (t) { return hay.indexOf(t) >= 0; });
      });
      rows.sort(function (x, y) {
        var ax = meta[x], ay = meta[y];
        return (ax.region || '').localeCompare(ay.region || '') || (nameOf(ax) > nameOf(ay) ? 1 : -1);
      });
      var html = '';
      if (state.slugs.length >= max) html += '<div class="lvl-drop-hint">' + max + T('社まで表示中。新しく選ぶと一番古い会社と入れ替わります。') + '</div>';
      rows.forEach(function (sl) {
        var a = meta[sl], on = state.slugs.indexOf(sl) >= 0;   // 満席でも選べる（入替）＝dis なし
        html += '<button type="button" class="lvl-drop-item' + (on ? ' on' : '') + '" data-sl="' + sl + '"' +
          ' role="option" aria-selected="' + (on ? 'true' : 'false') + '">' +
          logoHtml(a) +
          '<span class="di-nm">' + nameOf(a) + '</span>' +
          '<span class="di-rg">' + (a.region || '') + '</span>' +
          '<span class="di-ck">' + (on ? '✓' : T('＋')) + '</span></button>';
      });
      els.list.innerHTML = html || '<div class="lvl-drop-empty">' + T('「') + (q || '') + T('」に一致する会社がありません') + '</div>';
    }
    function toggleDrop() { dropOpen ? closeDrop() : openDrop(); }
    function openDrop() {
      if (!els) return;
      dropOpen = true; els.drop.hidden = false; els.add.setAttribute('aria-expanded', 'true');
      // 「会社を追加」ボタンの右端に合わせて右側に出す（画面左に出ない・ボタン直下）
      els.drop.style.left = 'auto';
      els.drop.style.right = Math.max(0, pickHost.clientWidth - (els.add.offsetLeft + els.add.offsetWidth)) + 'px';
      renderList(els.input.value);
      w.setTimeout(function () { els.input.focus(); }, 0);
    }
    function closeDrop() { if (!els) return; dropOpen = false; els.drop.hidden = true; els.add.setAttribute('aria-expanded', 'false'); }

    function toggle(sl) {
      var i = state.slugs.indexOf(sl);
      if (i >= 0) state.slugs.splice(i, 1);
      else {
        if (state.slugs.length >= max) state.slugs.shift();  // 満席なら一番古い社を外して入替（検索から常に選べる）
        state.slugs.push(sl);
      }
      renderPicker();
      if (dropOpen) renderList(els.input.value);
      redrawGrid();
    }

    function redrawGrid() {
      if (tip) tip.reset();
      load().then(function (SAL) {
        renderInto(gridEl, SAL, { meta:meta, slugs:state.slugs, mode:state.mode, removable:picker, graduated:!!opts.graduated, layout:opts.layout });
      }).catch(function () {
        gridEl.innerHTML = '<div class="lvl-empty">' + T('給与データを読み込めませんでした。時間をおいて再度お試しください。') + '</div>';
      });
    }

    function draw() {
      if (tip) tip.reset();
      gridEl.innerHTML = '<div class="lvl-empty">' + T('給与データを読み込み中…') + '</div>';
      gridEl.style.gridTemplateColumns = '1fr';
      load().then(function (SAL) {
        if (picker) {
          var pool = (opts.pool && opts.pool !== 'all') ? opts.pool : Object.keys(meta);
          avail = pool.filter(function (sl) { var s = SAL.airlines[sl]; return s && s.ladder; });
          state.slugs = state.slugs.filter(function (sl) { return avail.indexOf(sl) >= 0; });
          if (!state.slugs.length) state.slugs = avail.slice(0, Math.min(max, avail.length));
          renderPicker();
        }
        renderInto(gridEl, SAL, { meta:meta, slugs:state.slugs, mode:state.mode, removable:picker, graduated:!!opts.graduated, layout:opts.layout });
      }).catch(function () {
        gridEl.innerHTML = '<div class="lvl-empty">' + T('給与データを読み込めませんでした。時間をおいて再度お試しください。') + '</div>';
      });
    }

    // ピッカー配線（クイック／検索は buildPicker 内・列ヘッダ × は委譲）
    if (picker) {
      buildPicker();
      gridEl.addEventListener('click', function (e) {
        var x = e.target.closest('.lvl-chead-x');
        if (x && x.dataset.x) toggle(x.dataset.x);
      });
    }

    // 就航区分トグル配線（任意）
    if (opts.modeButtons) {
      var btns = d.querySelectorAll(opts.modeButtons);
      Array.prototype.forEach.call(btns, function (btn) {
        btn.addEventListener('click', function () {
          state.mode = btn.dataset.mode;
          Array.prototype.forEach.call(btns, function (b) {
            var on = b === btn;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          redrawGrid();
        });
      });
    }
    draw();
    // 通貨切替に追随＝箱内の推定年収・内訳バー・ツールチップを現在通貨で再描画
    w.addEventListener('pv-currency-change', redrawGrid);
    return {
      setMode: function (m) { state.mode = m; redrawGrid(); },
      setSlugs: function (s) { state.slugs = (s || []).slice(); if (picker) renderPicker(); redrawGrid(); },
      redraw: draw
    };
  }

  // ── CSS 注入（.lvl-* を1回だけ）──────────────────────────────
  function injectCSS() {
    if (d.getElementById('pv-leveling-css')) return;
    var css =
    '#range-view{position:relative}' +
    '.lvl-note{display:flex;align-items:flex-start;gap:11px;background:rgba(245,200,66,.06);border:1px solid rgba(245,200,66,.18);border-radius:12px;padding:13px 16px;margin-bottom:15px;font-size:.8rem;color:#c9b070;line-height:1.65}' +
    '.lvl-note b{color:#f5c842;font-weight:700}' +
    '.lvl-controls{display:flex;flex-direction:column;gap:15px;margin-bottom:16px}' +
    '.lvl-pick-lab{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:.72rem;color:#6b7d93;margin-bottom:8px}' +
    '.lvl-pick-lab b{color:#e8edf2;font-weight:700;font-size:.78rem}' +
    '.lvl-pickcount{margin-left:auto;font-size:.7rem;color:#8595a8;font-weight:600}' +
    '.lvl-chips{display:flex;flex-wrap:wrap;gap:7px;max-height:104px;overflow-y:auto;padding:2px 4px 2px 0;scrollbar-width:thin;-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 18px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 18px),transparent)}' +
    '.lvl-chips::-webkit-scrollbar{width:6px}' +
    '.lvl-chips::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}' +
    '.lvl-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;font-size:.74rem;font-weight:600;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#9fb0c3;cursor:pointer;transition:background .18s,border-color .18s,color .18s}' +
    '.lvl-chip .ch-dot{width:8px;height:8px;border-radius:50%;background:var(--ch);flex:none}' +
    '.lvl-chip:hover{color:#e8edf2;border-color:rgba(var(--ch-rgb),.55)}' +
    '.lvl-chip:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}' +
    '.lvl-chip.on{background:rgba(var(--ch-rgb),.15);border-color:rgba(var(--ch-rgb),.65);color:#fff}' +
    '.lvl-chip.on:hover{color:#fff}' +
    '.lvl-chip.dis{opacity:.38;cursor:not-allowed}' +
    /* ── Levels.fyi 風ピッカー（クイック行＋検索ドロップダウン） ── */
    '.lvl-picker{position:relative;z-index:50}' +  /* グリッドより上に重ねる（ドロップが透けないように）*/
    '.lvl-pick-row{display:flex;align-items:flex-start;flex-wrap:nowrap;gap:8px}' +
    '.lvl-pick-cap{flex:none;padding-top:5px;font-size:.72rem;font-weight:600;color:#8595a8;letter-spacing:.02em;margin-right:2px}' +
    '.lvl-quick{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 auto;min-width:0}' +
    '.lvl-logo{width:17px;height:17px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:.5rem;font-weight:700;letter-spacing:.02em;line-height:1;flex:none;font-family:inherit}' +
    // 実ロゴは白ピルに自然縦横比（高さ固定・幅auto・横幅上限で長いワードマークを抑制）
    '.lvl-logo-real{width:auto!important;min-width:15px;max-width:58px;background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:4px;padding:1px 3px;box-sizing:border-box;overflow:hidden;position:relative;display:inline-flex;align-items:center;justify-content:center}' +
    '.lvl-logo-real .lvl-mono{position:absolute;inset:0;display:none;align-items:center;justify-content:center;border-radius:inherit}' +
    '.lvl-logo-real .lvl-lg-img{position:static;display:block;height:100%;width:auto;max-width:100%;object-fit:contain;background:transparent}' +
    // 画像読込失敗時＝白ピルをやめ正方モノグラムに戻す
    '.lvl-logo-real.lg-fail{width:auto!important;aspect-ratio:1;min-width:0;max-width:none;padding:0;background:transparent}' +
    '.lvl-logo-real.lg-fail .lvl-mono{display:flex}' +
    '.lvl-qchip{display:inline-flex;align-items:center;gap:6px;padding:4px 11px 4px 5px;border-radius:999px;font-size:.68rem;font-weight:400;font-family:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#9fb0c3;cursor:pointer;transition:background .18s,border-color .18s,color .18s}' +
    '.lvl-qchip .lvl-logo{width:16px;height:16px;font-size:.46rem;border-radius:4px}' +
    '.lvl-qchip .lvl-logo-real{height:16px;max-width:52px}' +
    '.lvl-qchip:hover{color:#e8edf2;border-color:rgba(var(--ch-rgb),.55)}' +
    '.lvl-qchip:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}' +
    '.lvl-qchip.on{background:rgba(var(--ch-rgb),.16);border-color:rgba(var(--ch-rgb),.65);color:#fff}' +
    '.lvl-qchip.on:hover{color:#fff}' +
    '.lvl-qchip.dis{opacity:.36;cursor:not-allowed}' +
    '.lvl-add{flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:.73rem;font-weight:700;font-family:inherit;background:rgba(245,200,66,.1);border:1px dashed rgba(245,200,66,.45);color:#f5c842;cursor:pointer;transition:background .18s,border-color .18s}' +
    '.lvl-add:hover{background:rgba(245,200,66,.18);border-color:rgba(245,200,66,.7)}' +
    '.lvl-add:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}' +
    '.lvl-add.dis{opacity:.62}' +  /* 満席でも開ける（中で選択済み社を✕して入替可能に）— pointer-events は殺さない */
    '.lvl-add svg{opacity:.9}' +
    '.lvl-pick-count{flex:none;padding-top:6px;font-size:.7rem;font-weight:600;color:#8595a8;white-space:nowrap}' +
    '.lvl-drop{position:absolute;z-index:90;top:calc(100% + 7px);right:0;left:auto;width:min(340px,100%);background:#141c26;border:1px solid rgba(255,255,255,.13);border-radius:14px;box-shadow:0 18px 44px -12px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.02);overflow:hidden}' +
    '.lvl-drop-search{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.08);color:#6b7d93}' +
    '.lvl-drop-input{flex:1;background:transparent;border:none;outline:none;font-family:inherit;font-size:.82rem;color:#e8edf2}' +
    '.lvl-drop-input::placeholder{color:#5c6b7e}' +
    /* ★iOS は 16px 未満の入力欄に触れるとページごと拡大し、戻らない（2026-08-27 実測）。⚠️ 16px を下げない。 */
    '@media (pointer:coarse),(max-width:820px){.lvl-drop-input{font-size:16px}}' +
    '.lvl-drop-list{max-height:264px;overflow-y:auto;padding:5px;scrollbar-width:thin}' +
    '.lvl-drop-list::-webkit-scrollbar{width:7px}' +
    '.lvl-drop-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:4px}' +
    '.lvl-drop-item{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:none;border-radius:9px;background:transparent;color:#c3d0e0;font-family:inherit;font-size:.8rem;text-align:left;cursor:pointer;transition:background .14s}' +
    '.lvl-drop-item:hover{background:rgba(255,255,255,.05)}' +
    '.lvl-drop-item:focus-visible{outline:2px solid rgba(245,200,66,.55);outline-offset:-2px}' +
    '.lvl-drop-item.on{background:rgba(245,200,66,.09)}' +
    '.lvl-drop-item.dis{opacity:.4;cursor:not-allowed}' +
    '.lvl-drop-item .lvl-logo{width:20px;height:20px;font-size:.55rem;border-radius:5px}' +
    '.lvl-drop-item .lvl-logo-real{height:20px;max-width:72px}' +
    '.lvl-drop-item .di-nm{font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lvl-drop-item .di-rg{font-size:.68rem;color:#7787a0;flex:none}' +
    '.lvl-drop-item .di-ck{width:18px;text-align:center;font-weight:800;color:#f5c842;flex:none}' +
    '.lvl-drop-item.dis .di-ck{color:#7787a0}' +
    '.lvl-drop-empty{padding:20px 14px;text-align:center;font-size:.78rem;color:#6b7d93}' +
    '.lvl-drop-hint{margin:2px 5px 6px;padding:7px 10px;border-radius:8px;background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.22);font-size:.68rem;line-height:1.5;color:#d8c07f}' +
    '.lvl-mode{display:inline-flex;gap:3px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:3px;align-self:flex-start;max-width:100%;overflow:auto}' +
    '.lvl-mode-btn{padding:7px 14px;border-radius:7px;font-size:.73rem;font-weight:600;border:none;background:transparent;color:#6b7d93;cursor:pointer;transition:background .2s,color .2s;white-space:nowrap;font-family:inherit}' +
    '.lvl-mode-btn.on{background:rgba(245,200,66,.14);color:#f5c842}' +
    '.lvl-mode-btn:not(.on):hover{color:#e8edf2}' +
    '.lvl-mode-btn:focus-visible{outline:2px solid rgba(245,200,66,.6);outline-offset:2px}' +
    '.lvl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px;scrollbar-width:thin}' +
    '.lvl-grid{display:grid;gap:6px;min-width:min-content}' +
    '.lvl-chead{display:flex;flex-direction:column;gap:5px;padding:11px 12px;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,rgba(var(--ac-rgb),.16),rgba(var(--ac-rgb),.04));border:1px solid rgba(var(--ac-rgb),.3);border-bottom:2px solid rgba(var(--ac-rgb),.5)}' +
    '.lvl-chead-top{display:flex;align-items:center;gap:8px;min-width:0}' +
    '.lvl-chead .ac-code{display:flex;align-items:center;justify-content:center;border-radius:7px;font-weight:800;width:30px;height:30px;font-size:.55rem;flex:none}' +
    '.lvl-chead-nm{font-size:.76rem;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lvl-chead-en{font-size:.57rem;color:#6b7d93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lvl-chead-x{margin-left:auto;flex:none;width:21px;height:21px;border-radius:6px;border:none;background:rgba(255,255,255,.07);color:#8595a8;font-size:.9rem;line-height:1;cursor:pointer;transition:background .15s,color .15s}' +
    '.lvl-chead-x:hover{background:rgba(255,90,90,.2);color:#ff8f8f}' +
    '.lvl-rung,.lvl-corner{position:sticky;left:0;z-index:2;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:10px 13px;min-width:138px;background:#0d1220;border-radius:10px;border:1px solid rgba(255,255,255,.06);border-left:3px solid var(--tone,transparent)}' +
    '.lvl-corner{z-index:3;justify-content:flex-end}' +
    '.lvl-rung-rk{font-size:.54rem;color:var(--tone);font-weight:800;letter-spacing:.05em}' +
    '.lvl-rk-corner{color:#6b7d93}' +
    '.lvl-rung-lab{font-size:.76rem;font-weight:700;color:#e8edf2;line-height:1.25}' +
    '.lvl-rung-yr{font-size:.6rem;color:#6b7d93}' +
    '.lvl-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:104px;padding:10px 10px;background:rgba(var(--ac-rgb),var(--heat,.05));border:1px solid rgba(var(--ac-rgb),.18);border-radius:10px;cursor:pointer;text-align:center;transition:background .16s,border-color .16s,transform .16s;font-family:inherit}' +
    '.lvl-cell:hover,.lvl-cell:focus-visible{background:rgba(var(--ac-rgb),calc(var(--heat,.05) + .12));border-color:rgba(var(--ac-rgb),.6);outline:none;transform:translateY(-1px)}' +
    '.lvl-amt{font-size:1.05rem;font-weight:800;color:#f2f5f8;line-height:1.08;letter-spacing:-.02em;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}' +
    '.lvl-rng{font-size:.6rem;color:#8595a8;white-space:nowrap}' +
    '.lvl-tag{font-size:.52rem;font-weight:800;letter-spacing:.05em;padding:1px 7px;border-radius:999px;margin-top:1px}' +
    '.lvl-tag.authored{background:rgba(52,211,153,.16);color:#5fe0b0}' +
    '.lvl-tag.est{background:rgba(245,200,66,.14);color:#e0be5a}' +
    '.lvl-cell.collect{cursor:default;background:repeating-linear-gradient(135deg,rgba(255,255,255,.02) 0 6px,transparent 6px 12px);border-style:dashed;border-color:rgba(255,255,255,.14)}' +
    '.lvl-cell.collect:hover{transform:none;border-color:rgba(255,255,255,.14);background:repeating-linear-gradient(135deg,rgba(255,255,255,.03) 0 6px,transparent 6px 12px)}' +
    '.lvl-collect-t{font-size:.63rem;color:#8595a8;font-weight:700}' +
    '.lvl-collect-s{font-size:.53rem;color:#5a6b80;line-height:1.35}' +
    /* ── 機種レベル・カラム（Levels.fyi 丸パクリ：縦軸＝年収の絶対スケール）── */
    /* --total＝4社時の総横幅を固定。--n(表示社数)で N 分割＝3/2/1社でも総幅は同じ（列が広がる） */
    '.lvl-levels{--n:4;--total:898px;--colw:calc((var(--total) - (var(--n) - 1) * 0.5px) / var(--n));min-width:min-content}' +
    /* ヘッダ行＝Levels.fyi 丸パクリ：素の×（丸背景なし）＋中立枠の社名チップ */
    '.lvl-lv-head{display:flex;justify-content:center;gap:0.5px;padding-top:14px;margin-bottom:20px}' +   /* 社名行の上下の余白を約1.8倍に（オーナーFB9③）*/
    '.lvl-lv-head .lvl-chead{width:var(--colw);flex:none;display:inline-flex;flex-direction:row;align-items:center;justify-content:center;gap:5px;padding:0;border:none;background:none}' +
    '.lvl-lv-head .lvl-chead-nm{display:inline-flex;align-items:center;gap:5px;max-width:100%;font-size:.58rem;font-weight:300;color:#e8edf2;line-height:1.15;letter-spacing:.01em;padding:3px 9px 3px 5px;border:1px solid rgba(255,255,255,.18);border-radius:7px;background:transparent}' +
    '.lvl-lv-head .lvl-chead-nm .cn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lvl-lv-head .lvl-chead-nm .lvl-logo{width:15px;height:15px;font-size:.44rem;border-radius:4px}' +
    // 実ロゴ列見出し＝ロゴ単体（社名テキスト省略）。外側チップの枠/背景を外し白ピルのロゴを主役に
    '.lvl-lv-head .lvl-chead-nm.has-logo{border:none;background:none;padding:2px 3px}' +
    '.lvl-lv-head .lvl-chead-nm.has-logo .lvl-logo-real{height:21px;max-width:132px;border-radius:5px;padding:2px 4px}' +
    '.lvl-lv-head .lvl-chead-x{margin:0;flex:none;padding:0 3px;border:none;border-radius:0;background:none;color:#8595a8;font-size:1rem;line-height:1;cursor:pointer;transition:color .15s}' +
    '.lvl-lv-head .lvl-chead-x:hover{background:none;color:#e05555}' +
    '.lvl-lv-head .lvl-chead-x:focus-visible{outline:2px solid rgba(150,162,178,.6);outline-offset:2px;border-radius:4px}' +
    /* 本体＝縦軸の数字なし・各社カラムのみ・中央寄せ */
    '.lvl-lv-body{position:relative;display:flex;justify-content:center}' +
    '.lvl-lv-plot{position:relative;display:flex;justify-content:center;gap:0.5px}' +
    '.lvl-col{position:relative;width:var(--colw);flex:none;height:100%;z-index:1}' +
    /* 箱＝縦位置＝年収（top/height はインライン算出）／全角丸・中央揃え・髪の毛1本の隙間 */
    '.lvl-lvbox{position:absolute;left:0;right:0;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0 6px;border:none;border-radius:6px;background:var(--bl);transform:none;overflow:hidden;transition:filter .14s}' +
    '.lvl-lvbox:hover,.lvl-lvbox:focus-visible{transform:none;background:var(--bl);filter:brightness(1.06) saturate(1.08);z-index:3}' +
    '.lvl-lvbox .lvl-code{font-size:.7rem;font-weight:300;letter-spacing:.14em;color:#f4f8fc;line-height:1;white-space:nowrap;text-shadow:0 1px 1px rgba(0,0,0,.4)}' +
    '.lvl-lvbox.collect{cursor:default;flex-direction:column;gap:1px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 5px,transparent 5px 10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}' +
    '.lvl-lvbox.collect:hover{filter:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}' +
    '.lvl-lvbox.collect .lvl-code{color:#93a3b8;font-size:.56rem;font-weight:300;letter-spacing:.12em}' +
    '.lvl-lvbox-sub{font-size:.42rem;font-weight:700;letter-spacing:.04em;color:#7c8ba0;line-height:1}' +
    /* 機種レベル用ツールチップの追加行 */
    '.lvl-tip-code{display:flex;align-items:baseline;gap:8px;margin-bottom:3px}' +
    '.lvl-tip-code b{font-size:1.02rem;font-weight:300;letter-spacing:.09em;color:#fff}' +
    '.lvl-tip-code span{font-size:.62rem;color:#9fb0c3}' +
    '.lvl-tip-role{font-size:.63rem;color:#9fb0c3;margin-bottom:9px}' +
    '.lvl-tip-meta{display:flex;justify-content:space-between;gap:12px;font-size:.6rem;color:#8595a8;padding:3px 0;line-height:1.45}' +
    '.lvl-tip-meta b{color:#c9d4e2;font-weight:600;text-align:right;max-width:62%}' +
    '@media(max-width:640px){.lvl-levels{--colw:150px}.lvl-lv-head .lvl-chead{padding:4px 9px}.lvl-lv-head .lvl-chead-nm{font-size:.54rem}.lvl-lv-head .lvl-chead-nm .lvl-logo{width:13px;height:13px;font-size:.4rem}.lvl-lv-head .lvl-chead-nm.has-logo .lvl-logo-real{height:18px;max-width:108px}}' +
    /* 機種レベル・ライト */
    '[data-theme="light"] .lvl-lv-head .lvl-chead-nm{color:#0f172a;border-color:rgba(15,23,42,.18)}' +
    '[data-theme="light"] .lvl-lv-head .lvl-chead-x{background:none;color:#64748b}' +
    '[data-theme="light"] .lvl-lvbox .lvl-code{color:#0f172a;text-shadow:0 1px 1px rgba(255,255,255,.55)}' +
    '[data-theme="light"] .lvl-lvbox.collect{background:repeating-linear-gradient(135deg,rgba(0,0,0,.05) 0 5px,transparent 5px 10px);box-shadow:inset 0 0 0 1px rgba(0,0,0,.16)}' +
    '[data-theme="light"] .lvl-lvbox.collect:hover{box-shadow:inset 0 0 0 1px rgba(0,0,0,.16)}' +
    '[data-theme="light"] .lvl-lvbox.collect .lvl-code{color:#475569}' +
    '[data-theme="light"] .lvl-lvbox-sub{color:#64748b}' +
    '[data-theme="light"] .lvl-tip-code b{color:#0f172a}' +
    '[data-theme="light"] .lvl-tip-code span{color:#475569}' +
    '[data-theme="light"] .lvl-tip-role{color:#475569}' +
    '[data-theme="light"] .lvl-tip-meta{color:#64748b}' +
    '[data-theme="light"] .lvl-tip-meta b{color:#0f172a}' +
    '.lvl-tip{position:fixed;z-index:60;width:250px;max-width:calc(100vw - 16px);background:#131a29;border:1px solid rgba(var(--ac-rgb),.5);border-radius:12px;padding:13px 14px;box-shadow:0 14px 36px -8px rgba(0,0,0,.72),0 0 0 1px rgba(0,0,0,.4);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .14s,transform .14s}' +
    '.lvl-tip.show{opacity:1;transform:translateY(0)}' +
    '.lvl-tip-co{display:flex;align-items:center;gap:7px;font-size:.74rem;font-weight:700;color:#fff;margin-bottom:6px}' +
    '.lvl-tip-co .d{width:9px;height:9px;border-radius:50%;background:var(--ac);flex:none}' +
    '.lvl-tip-lv{font-size:.64rem;color:#9fb0c3;margin-bottom:9px}' +
    '.lvl-tip-amt{font-size:1.2rem;font-weight:800;color:#f5c842;line-height:1;margin-bottom:3px}' +
    '.lvl-tip-rng{font-size:.63rem;color:#8595a8;margin-bottom:10px}' +
    '.lvl-tip-row{display:flex;justify-content:space-between;gap:14px;font-size:.62rem;color:#9fb0c3;padding:4px 0;border-top:1px solid rgba(255,255,255,.07)}' +
    '.lvl-tip-row b{color:#e8edf2;font-weight:700;text-align:right}' +
    '.lvl-tip-note{font-size:.58rem;color:#7c8ba0;line-height:1.55;margin-top:9px}' +
    /* 内訳バー（Levels.fyi 風） */
    '.lvl-tip-est{font-size:.53rem;font-weight:800;letter-spacing:.06em;color:#7c8ba0;text-transform:uppercase;margin:11px 0 5px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)}' +
    '.lvl-tip-bar{display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:9px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}' +
    '.lvl-tip-seg{height:100%}' +
    '.lvl-tip-seg:not(:last-child){box-shadow:1px 0 0 rgba(19,26,41,.85)}' +
    '.lvl-tip-legend{display:flex;flex-direction:column;gap:5px}' +
    '.lvl-tip-legend span{display:flex;align-items:center;gap:7px;font-size:.62rem;color:#9fb0c3}' +
    '.lvl-tip-legend i{width:9px;height:9px;border-radius:2px;flex:none}' +
    '.lvl-tip-legend b{margin-left:auto;color:#e8edf2;font-weight:700}' +
    '.lvl-tip-model{font-size:.55rem;color:#7c8ba0;line-height:1.5;margin-top:9px}' +
    '.lvl-tip-model b{color:#c9b070;font-weight:700}' +
    '.lvl-legend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-size:.68rem;color:#6b7d93;margin-top:15px}' +
    '.lvl-legend .lg{display:inline-flex;align-items:center;gap:7px}' +
    '.lvl-legend .sw{width:17px;height:11px;border-radius:3px;flex:none}' +
    '.lvl-legend .sw.authored{background:rgba(52,211,153,.4);box-shadow:inset 0 0 0 1px rgba(52,211,153,.7)}' +
    '.lvl-legend .sw.est{background:rgba(245,200,66,.3);box-shadow:inset 0 0 0 1px rgba(245,200,66,.6)}' +
    '.lvl-legend .sw.collect{background:repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 4px,transparent 4px 8px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}' +
    '.lvl-legend .sw.heat{width:40px;background:linear-gradient(90deg,rgba(150,163,184,.16),rgba(120,133,160,.85));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}' +
    '.lvl-empty{padding:44px 20px;text-align:center;color:#6b7d93;font-size:.85rem;line-height:1.7}' +
    '@media(max-width:640px){' +
      '.lvl-rung,.lvl-corner{min-width:120px;padding:9px 10px}' +
      '.lvl-rung-lab{font-size:.68rem}' +
      '.lvl-cell{min-width:92px;padding:9px 6px}' +
      '.lvl-amt{font-size:.92rem}' +
      '.lvl-chead-en{display:none}' +
      '.lvl-legend{gap:11px}' +
      '.lvl-pick-row{flex-wrap:wrap}' +          /* 狭幅は折返し可（「会社を追加」は quick の下段へ）*/
      '.lvl-quick{flex-basis:100%}' +
    '}' +
    /* ── light mode ── */
    '[data-theme="light"] .lvl-note{background:rgba(180,150,0,.07);border-color:rgba(180,150,0,.2);color:#7a6420}' +
    '[data-theme="light"] .lvl-note b{color:#8a6e00}' +
    '[data-theme="light"] .lvl-pick-lab b{color:#0f172a}' +
    '[data-theme="light"] .lvl-chip{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#4a5568}' +
    '[data-theme="light"] .lvl-chip:hover,[data-theme="light"] .lvl-chip.on{color:#0f172a}' +
    '[data-theme="light"] .lvl-mode{background:rgba(0,0,0,.04);border-color:rgba(0,0,0,.1)}' +
    '[data-theme="light"] .lvl-mode-btn{color:#4a5568}' +
    '[data-theme="light"] .lvl-mode-btn.on{background:rgba(180,150,0,.12);color:#8a6e00}' +
    '[data-theme="light"] .lvl-mode-btn:not(.on):hover{color:#0f172a}' +
    '[data-theme="light"] .lvl-rung,[data-theme="light"] .lvl-corner{background:#eef2f8;border-color:rgba(0,0,0,.07)}' +
    '[data-theme="light"] .lvl-rung-lab{color:#0f172a}' +
    '[data-theme="light"] .lvl-chead-x{background:rgba(0,0,0,.05);color:#4a5568}' +
    '[data-theme="light"] .lvl-amt{color:#0f172a}' +
    '[data-theme="light"] .lvl-rng{color:#5a6b80}' +   /* 濃色セル上でのレンジ可読性 */
    '[data-theme="light"] .lvl-cell{background:rgba(var(--ac-rgb),calc(var(--heat,.05) + .03))}' +
    '[data-theme="light"] .lvl-cell:hover,[data-theme="light"] .lvl-cell:focus-visible{background:rgba(var(--ac-rgb),calc(var(--heat,.05) + .17))}' +
    '[data-theme="light"] .lvl-cell.collect{background:repeating-linear-gradient(135deg,rgba(0,0,0,.03) 0 6px,transparent 6px 12px);border-color:rgba(0,0,0,.13)}' +
    /* Levels.fyi 風パステル面（テーマ別に明度を切替・.lvl-cell の heat 背景を上書き＝オーナーFB8②）*/
    '[data-theme="light"] .lvl-lvbox{background:var(--bl)}' +
    '[data-theme="dark"] .lvl-lvbox{background:var(--bd)}' +
    '[data-theme="light"] .lvl-lvbox:hover,[data-theme="light"] .lvl-lvbox:focus-visible{background:var(--bl)}' +
    '[data-theme="dark"] .lvl-lvbox:hover,[data-theme="dark"] .lvl-lvbox:focus-visible{background:var(--bd)}' +
    '[data-theme="light"] .lvl-collect-t{color:#4a5568}' +
    '[data-theme="light"] .lvl-tip{background:#fff;border-color:rgba(var(--ac-rgb),.4);box-shadow:0 14px 36px -8px rgba(20,30,50,.28),0 0 0 1px rgba(0,0,0,.06)}' +
    '[data-theme="light"] .lvl-tip-co{color:#0f172a}' +
    '[data-theme="light"] .lvl-tip-lv{color:#4a5568}' +
    '[data-theme="light"] .lvl-tip-amt{color:#8a6e00}' +
    '[data-theme="light"] .lvl-tip-rng{color:#64748b}' +
    '[data-theme="light"] .lvl-tip-row{color:#4a5568}' +
    '[data-theme="light"] .lvl-tip-row b{color:#0f172a}' +
    '[data-theme="light"] .lvl-tip-note{color:#64748b}' +
    '[data-theme="light"] .lvl-tip-est{color:#64748b;border-color:rgba(0,0,0,.08)}' +
    '[data-theme="light"] .lvl-tip-legend span{color:#4a5568}' +
    '[data-theme="light"] .lvl-tip-legend b{color:#0f172a}' +
    '[data-theme="light"] .lvl-tip-model{color:#64748b}' +
    '[data-theme="light"] .lvl-tip-model b{color:#8a6e00}' +
    '[data-theme="light"] .lvl-legend .sw.heat{background:linear-gradient(90deg,rgba(100,116,139,.16),rgba(60,72,95,.8))}' +
    /* muted grays lacking a light override — darken for legibility on white */
    '[data-theme="light"] .lvl-chead-en{color:#64748b}' +
    '[data-theme="light"] .lvl-rung-yr{color:#64748b}' +
    '[data-theme="light"] .lvl-pick-lab{color:#64748b}' +
    '[data-theme="light"] .lvl-pickcount{color:#64748b}' +
    '[data-theme="light"] .lvl-pick-cap{color:#64748b}' +
    '[data-theme="light"] .lvl-pick-count{color:#64748b}' +
    '[data-theme="light"] .lvl-qchip{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.1);color:#4a5568}' +
    '[data-theme="light"] .lvl-qchip:hover,[data-theme="light"] .lvl-qchip.on{color:#0f172a}' +
    '[data-theme="light"] .lvl-add{background:rgba(180,130,10,.1);border-color:rgba(180,130,10,.4);color:#8a6400}' +
    '[data-theme="light"] .lvl-add:hover{background:rgba(180,130,10,.16);border-color:rgba(180,130,10,.6)}' +
    '[data-theme="light"] .lvl-drop{background:#fff;border-color:rgba(15,23,42,.13);box-shadow:0 18px 44px -12px rgba(20,30,50,.32),0 0 0 1px rgba(0,0,0,.04)}' +
    '[data-theme="light"] .lvl-drop-search{border-bottom-color:rgba(0,0,0,.08);color:#64748b}' +
    '[data-theme="light"] .lvl-drop-input{color:#0f172a}' +
    '[data-theme="light"] .lvl-drop-input::placeholder{color:#94a3b8}' +
    '[data-theme="light"] .lvl-drop-item{color:#334155}' +
    '[data-theme="light"] .lvl-drop-item:hover{background:rgba(0,0,0,.04)}' +
    '[data-theme="light"] .lvl-drop-item.on{background:rgba(180,130,10,.09)}' +
    '[data-theme="light"] .lvl-drop-item .di-rg{color:#64748b}' +
    '[data-theme="light"] .lvl-drop-item .di-ck{color:#8a6400}' +
    '[data-theme="light"] .lvl-drop-item.dis .di-ck{color:#94a3b8}' +
    '[data-theme="light"] .lvl-drop-empty{color:#64748b}' +
    '[data-theme="light"] .lvl-drop-hint{background:rgba(180,130,10,.09);border-color:rgba(180,130,10,.28);color:#8a6400}' +
    '[data-theme="light"] .lvl-collect-s{color:#475569}' +
    '[data-theme="light"] .lvl-legend{color:#475569}' +
    '[data-theme="light"] .lvl-rung-rk{color:#475569}' +
    '[data-theme="light"] .lvl-rk-corner{color:#475569}' +
    /* ── セルクリック詳細モーダル（ドーナツ内訳＋各社リンク）── */
    '.lvl-modal-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(6,10,18,.74);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .2s}' +
    '.lvl-modal-ov.show{opacity:1}' +
    '.lvl-modal-card{position:relative;width:100%;max-width:420px;max-height:calc(100vh - 36px);overflow-y:auto;background:#131a29;border:1px solid rgba(var(--ac-rgb),.5);border-radius:18px;padding:22px 22px 20px;box-shadow:0 24px 60px -12px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.4);transform:translateY(10px) scale(.98);transition:transform .22s cubic-bezier(.22,1,.36,1)}' +
    '.lvl-modal-ov.show .lvl-modal-card{transform:translateY(0) scale(1)}' +
    '.lvl-modal-x{position:absolute;top:13px;right:13px;width:30px;height:30px;border-radius:8px;border:none;background:rgba(255,255,255,.06);color:#9fb0c3;font-size:.9rem;line-height:1;cursor:pointer;transition:background .15s,color .15s}' +
    '.lvl-modal-x:hover{background:rgba(255,90,90,.2);color:#ff8f8f}' +
    '.lvl-modal-x:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7);outline-offset:2px}' +
    '.lvl-modal-head{display:flex;align-items:center;gap:11px;margin-bottom:16px;padding-right:34px}' +
    '.lvl-modal-flag{font-size:1.6rem;line-height:1;flex:none}' +
    '.lvl-modal-co{font-size:1.02rem;font-weight:800;color:#fff;line-height:1.2}' +
    '.lvl-modal-lv{font-size:.72rem;color:#9fb0c3;margin-top:2px}' +
    '.lvl-modal-body{display:flex;align-items:center;gap:20px;margin-bottom:2px}' +
    '.lvl-modal-donut{position:relative;flex:none;width:132px;height:132px}' +
    '.lvl-modal-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}' +
    '.lvl-modal-center span{font-size:.54rem;color:#8595a8;font-weight:700;letter-spacing:.04em}' +
    '.lvl-modal-center b{font-size:.98rem;font-weight:800;color:#f2f5f8;line-height:1.1;margin-top:2px}' +
    '.lvl-modal-legend{flex:1;min-width:0;display:flex;flex-direction:column;gap:9px}' +
    '.lvl-modal-leg{display:flex;align-items:center;gap:9px;font-size:.72rem;color:#9fb0c3}' +
    '.lvl-modal-leg i{width:11px;height:11px;border-radius:3px;flex:none}' +
    '.lvl-modal-leg .nm{font-weight:600}' +
    '.lvl-modal-leg .amt{margin-left:auto;color:#e8edf2;font-weight:700}' +
    '.lvl-modal-leg .pct{width:38px;text-align:right;color:#8595a8;font-size:.66rem}' +
    '.lvl-modal-tag{display:inline-block;font-size:.56rem;font-weight:800;letter-spacing:.05em;padding:3px 9px;border-radius:999px;margin:14px 0 0}' +
    '.lvl-modal-tag.authored{background:rgba(52,211,153,.16);color:#5fe0b0}' +
    '.lvl-modal-tag.est{background:rgba(245,200,66,.14);color:#e0be5a}' +
    '.lvl-modal-note{font-size:.62rem;color:#8595a8;line-height:1.6;margin:9px 0 15px}' +
    '.lvl-modal-note b{color:#c9b070;font-weight:700}' +
    '.lvl-modal-cta{display:flex;flex-direction:column;gap:9px}' +
    '.lvl-modal-btn{display:block;text-align:center;padding:12px 14px;border-radius:11px;font-size:.8rem;font-weight:700;text-decoration:none;transition:background .16s,border-color .16s,transform .12s;cursor:pointer;font-family:inherit}' +
    '.lvl-modal-btn:active{transform:translateY(1px)}' +
    '.lvl-modal-btn.primary{background:rgba(var(--ac-rgb),.9);color:#fff;border:1px solid rgba(var(--ac-rgb),.9)}' +
    '.lvl-modal-btn.primary:hover{background:rgba(var(--ac-rgb),1)}' +
    '.lvl-modal-btn.primary:focus-visible{outline:2px solid rgba(var(--ac-rgb),.7);outline-offset:2px}' +
    '.lvl-modal-btn.ghost{background:rgba(255,255,255,.05);color:#c9d4e2;border:1px solid rgba(255,255,255,.16)}' +
    '.lvl-modal-btn.ghost:hover{background:rgba(255,255,255,.1);color:#fff}' +
    '.lvl-modal-btn.ghost:focus-visible{outline:2px solid rgba(var(--ac-rgb),.6);outline-offset:2px}' +
    '@media(max-width:480px){.lvl-modal-body{flex-direction:column;gap:14px}.lvl-modal-donut{margin:0 auto}.lvl-modal-legend{width:100%}}' +
    '[data-theme="light"] .lvl-modal-ov{background:rgba(226,232,240,.62)}' +
    '[data-theme="light"] .lvl-modal-card{background:#fff;border-color:rgba(var(--ac-rgb),.4);box-shadow:0 24px 60px -12px rgba(20,30,50,.3),0 0 0 1px rgba(0,0,0,.06)}' +
    '[data-theme="light"] .lvl-modal-x{background:rgba(0,0,0,.05);color:#475569}' +
    '[data-theme="light"] .lvl-modal-co{color:#0f172a}' +
    '[data-theme="light"] .lvl-modal-lv{color:#475569}' +
    '[data-theme="light"] .lvl-modal-center span{color:#64748b}' +
    '[data-theme="light"] .lvl-modal-center b{color:#0f172a}' +
    '[data-theme="light"] .lvl-modal-leg{color:#475569}' +
    '[data-theme="light"] .lvl-modal-leg .amt{color:#0f172a}' +
    '[data-theme="light"] .lvl-modal-leg .pct{color:#64748b}' +
    '[data-theme="light"] .lvl-modal-note{color:#64748b}' +
    '[data-theme="light"] .lvl-modal-note b{color:#8a6e00}' +
    '[data-theme="light"] .lvl-modal-btn.ghost{background:rgba(0,0,0,.04);color:#334155;border-color:rgba(0,0,0,.14)}' +
    '[data-theme="light"] .lvl-modal-btn.ghost:hover{background:rgba(0,0,0,.07);color:#0f172a}';
    var st = d.createElement('style');
    st.id = 'pv-leveling-css';
    st.textContent = css;
    d.head.appendChild(st);
  }

  injectCSS();

  // ── 公開API ─────────────────────────────────────────────────
  w.PVLeveling = {
    injectCSS: injectCSS,
    load: load,
    mount: mount,
    renderInto: renderInto,
    wireTooltip: wireTooltip,
    cellHtml: cellHtml,
    tipHtml: tipHtml,
    breakdownHtml: breakdownHtml,
    modeBand: modeBand,
    heatAlpha: heatAlpha,
    compModel: compModel,
    fmtMan: fmtMan,
    r10: r10,
    hexToRgb: hexToRgb,
    TONE: TONE,
    MODE_LAB: MODE_LAB
  };
})(window, document);
