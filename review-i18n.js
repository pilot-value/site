/* ══════════════════════════════════════════════════════════════
   review-i18n.js — 口コミの日↔英 表示を一本化する共有モジュール

   reviews_v2 の1行は「原文の言語(orig_lang)」と「反対言語の訳文(translations)」を
   持つ。このモジュールは、そのページの言語で読める本文を組み立てて返す。

     ・原文がページと同じ言語  → 原文をそのまま出す
     ・原文がページと違う言語  → translations[ページ言語] があれば訳文を出し、
                                 「自動翻訳」バッジと原文トグルを添える
     ・translations が無い/欠けている → その欄は原文にフォールバックする
       （＝ SQL 未適用でも Edge Function 未デプロイでもページは壊れない）
     ・原文は日英西のほかの言語でも来る（2026-11-15）→ 札は「〇〇から自動翻訳」、
       訳の無いまま原文を出す要素には dir と lang（attrs）

   利用側: community.html / en/community.html / airlines/airline-base.js /
           en-airline-reviews.js
   ══════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  var KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];

  var LABELS = {
    ja: { culture:'企業文化', salary:'給与', benefits:'福利厚生', wlb:'WLB',
          ops:'運航環境', training:'訓練環境', mgmt:'経営陣への提案' },
    en: { culture:'Culture', salary:'Pay', benefits:'Benefits', wlb:'WLB',
          ops:'Flight operations', training:'Training', mgmt:'Suggestions for management' }, /*PV-MSG:es*/ es: { culture:'Cultura', salary:'Remuneración', benefits:'Beneficios', wlb:'Equilibrio vida-trabajo',
          ops:'Operaciones de vuelo', training:'Entrenamiento', mgmt:'Sugerencias para la dirección' } /*/PV-MSG:es*/,
  };

  // ラベルの囲み方だけ言語で変える（日本語は【】、英語は []）
  var WRAP = {
    ja: function (label, text) { return '【' + label + '】' + text; },
    en: function (label, text) { return '[' + label + '] ' + text; },
    es: function (label, text) { return '[' + label + '] ' + text; },
  };

  /* ★2026-11-15 札の見える字は「〇〇から自動翻訳」（原文が日英西のほかの言語でも来るようになった）。
     n はページの言語での言語名（langName）。取れないときは日英西の3つだけ自前の名前、それも無ければコード。
     原文の言語が分からない（'und'・空）ときは from を呼ばず note だけ出す（noteHTML）。 */
  var UI = {
    ja: { note: '自動翻訳', from: function (l, n) { return (n || (l === 'en' ? '英語' : l === 'es' ? 'スペイン語' : l === 'ja' ? '日本語' : l)) + 'から自動翻訳'; },
          show: '原文を表示', hide: '原文を隠す' },
    en: { note: 'Machine-translated', from: function (l, n) { return 'Machine-translated from ' + (n || (l === 'ja' ? 'Japanese' : l === 'es' ? 'Spanish' : l === 'en' ? 'English' : l)); },
          show: 'Show original', hide: 'Hide original' }, /*PV-MSG:es*/ es: { note: 'Traducido automáticamente', from: function (l, n) { return 'Traducido automáticamente del ' + (n || (l === 'ja' ? 'japonés' : l === 'es' ? 'español' : l === 'en' ? 'inglés' : l)); },
          show: 'Mostrar original', hide: 'Ocultar original' } /*/PV-MSG:es*/,
  };

  /* 原文の言語の名前を、ページの言語で（ar → アラビア語 / Arabic / árabe）。
     コードが2字でない（'und'・空）・名前が引けない（コードがそのまま返る）ときは空。 */
  var DN = { l: '', f: null };
  function langName(code) {
    code = String(code || '').toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return '';
    var to = lang();
    try {
      if (DN.l !== to) DN = { l: to, f: new Intl.DisplayNames([to], { type: 'language' }) };
      var n = DN.f.of(code);
      return (n && n.toLowerCase() !== code) ? n : '';
    } catch (e) { return ''; }
  }

  /* ★原文に付ける dir と lang（2026-11-15。日英西のほかの言語の原文が来るようになった）。
     dir は本文の字で決める：アラビア文字・ヘブライ文字・シリア文字・ターナ文字の字が、字（\p{L}）全体の半分以上なら rtl。
     lang は原文の言語が2字の正しいコードで、しかも日英西でないときだけ。
     ⚠️ 日英西の原文には何も付けない ── 付けると、今までの口コミの字の組み方（書体の選び方・改行の位置）が変わる。
     ⚠️ 訳文には付けない（訳文はページの言語）。どちらを出しているかは attrs が決める。 */
  var SITE_LANG = { ja: 1, en: 1, es: 1 };
  var RE_L = null, RE_R = null;
  try {
    RE_L = new RegExp('\\p{L}', 'gu');
    RE_R = new RegExp('[\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Syriac}\\p{Script=Thaana}]', 'u');
  } catch (e) { RE_L = null; }   // \p{…} を読めない古いブラウザ：dir は付けない（今までどおり）
  function isRtl(s) {
    if (!RE_L || !s) return false;
    var all = String(s).match(RE_L) || [], r = 0;
    for (var i = 0; i < all.length; i++) if (RE_R.test(all[i])) r++;
    return all.length > 0 && r * 2 >= all.length;
  }
  function origAttrs(from, text) {
    var a = isRtl(text) ? ' dir="rtl"' : '';
    from = String(from || '').toLowerCase();
    if (/^[a-z]{2}$/.test(from) && !SITE_LANG[from]) a += ' lang="' + from + '"';
    return a;
  }
  /* 本文を出す要素に付ける属性（先頭に空白・エスケープ済み）。原文を出しているときだけ、訳文なら ''。
       attrs(p)    … pick() の答えの本文ぜんぶ（会社ページの .rv-comment）・鍵の無い行は抜粋
       attrs(p, c) … その1欄だけ（p.cats の1つ。vote.js のように欄ごとに出す所） */
  function attrs(p, c) {
    if (!p) return '';
    if (c) return c.o ? origAttrs(p.from, c.text) : '';
    if (p.locked) return p.clipOrig ? origAttrs(p.from, p.clipText) : '';
    if (p.translated) return '';
    return origAttrs(p.from, (p.cats || []).map(function (x) { return x.text; }).join(' '));
  }

  function lang() {
    /* スペイン語のページはスペイン語の訳（2026-11-02 translate-review が日英西へ訳す）。
       まだスペイン語の訳が無い口コミは英語の訳に落とす（pick の tr）。 */
    if (window.PV_LANG === 'es') return 'es';
    if (window.PV_BASE === 'en') return 'en';
    var l = (d.documentElement.getAttribute('lang') || '').toLowerCase();
    return l.indexOf('en') === 0 ? 'en' : 'ja';
  }
  /* 項目名と「自動翻訳」などの文言は、スペイン語の辞書（gen-msg.mjs が足す）があればそれ */
  var pickT = function (D, l) { return (window.PV_T && window.PV_T(D, l)) || D[l]; };

  // 口コミは利用者が書いた文字列。innerHTML に入る経路が複数あるので必ずここを通す。
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* 翻訳が改行を「\n」という2文字のまま返してくることがあり、そのまま出すと
     本文に \n が見えてしまう（英語版トップの口コミカードで実際に出た）。
     本物の改行・タブも1枚のカードでは詰めたいので、まとめて空白に均す。
     ⚠️ ここは原文も訳文も必ず通る唯一の口で、口コミを出すページが全部これを呼ぶ。
        直す場所を増やさない。 */
  function flatten(s) {
    if (!s) return s;
    return String(s)
      .replace(/\\[nrt]/g, ' ')        // 文字としての \n \r \t
      .replace(/[\r\n\t]+/g, ' ')      // 本物の改行・タブ
      .replace(/[ \u3000]{2,}/g, ' ')
      .trim();
  }

  /* 抜粋（先頭40字）は、金額の**途中**で切れていることがある。
     そのまま出すと currency.js が末尾の「¥3,500」を拾って
     **3,500円**に書き換える（元は ¥3,500万 ＝ 1万倍違う）。
     錠前の掛かったカードの中で起きるので、まず気づけない。
     → 切れている行（末尾が「…」）に限り、残った「通貨記号＋数字」を塊ごと落とす。

     ⚠️ 落とすのは通貨記号から始まる塊だけ。数字で終わるだけの行
        （「機材は A320…」「入社は 2019…」）は1文字も触らない。
        万・億が付いている形（「1,800万…」）はそのままで正しい
        ── あれは切れていても金額として正しく読める。
     ⚠️ flatten と同じで**ここ1か所だけ**。SQL 側（pv_review_clip）は触らない
        ── あちらを変えるとトップページの抜粋の見え方まで動く。 */
  function trimMoney(s) {
    if (!s) return s;
    var t = String(s);
    if (t.slice(-1) !== '…') return t;      // 切れていない＝落とすものは無い
    return t.slice(0, -1)
      .replace(/[¥＄$€£]\s*[0-9０-９][0-9０-９,.，\s]*$/, '')
      .replace(/[¥＄$€£]\s*$/, '')
      .replace(/[ \u3000]+$/, '') + '…';
  }

  /* 1行から表示用テキストを組み立てる。
     戻り値 { lang, from, translated, locked, cats, text, origCats, origText }

     ★ locked = true は「サーバが本文を送ってこなかった」行。
       鍵を持たない人には pv_reviews() が *_comment と translations を
       鍵ごと落として返し、代わりに cats（書かれたカテゴリの名前だけ）を付ける。
       ＝ 本文はここに**存在しない**（ぼかしているのではない）。
       REAL PAY が「実数は返さず、帯と項目名だけ出す」のと同じ形。
       これが無いと、未解放の人の画面でカテゴリ別の件数が全部 0 になる。 */
  function pick(row) {
    var to = lang();
    var from = (row && row.orig_lang) || 'ja';
    var T = (row && row.translations) || null;
    /* スペイン語の訳がまだ無い（言語を足す前の口コミ・埋め戻しの前）→ 英語の訳。原文が英語ならそのまま原文 */
    var tr = (T && (T[to] || (to === 'es' && from !== 'en' ? T.en : null))) || null;
    var lab = pickT(LABELS, to), wrap = WRAP[to];

    /* ★2026-11-20 書きかけの会員（口コミを1項目ずつ聞く板）。サーバは読める項目（open）の本文だけを送り、印 open を付ける。
         書いてあるのに読めない項目が残る行は locked のまま（text は空 ── 錠前の UI を外さない）で、part を立てる。
         cats には書いた項目を全部並べ、読める欄は本文、読めない欄は lock: true（抜粋の欄は抜粋の字）。
         読める項目だけの行（書いた項目が全部読める）は、下のふつうの行と同じ形で返る。 */
    var openK = (row && Object.prototype.toString.call(row.open) === '[object Array]') ? row.open : null;
    var wroteK = (row && Object.prototype.toString.call(row.cats) === '[object Array]') ? row.cats : [];
    if (openK && wroteK.some(function (k) { return openK.indexOf(k) < 0; })) {
      var pcl = row.clip || null;
      var pct = (pcl && pcl.k && pcl.t && (pcl.t[to] || (to === 'es' && from !== 'en' && pcl.t.en))) || '';
      var psnip = (pcl && pcl.k) ? trimMoney(flatten(pct || pcl.o || '')) : '';
      var pc = [], po = [], pused = false;
      for (var pi = 0; pi < KEYS.length; pi++) {
        var pk = KEYS[pi];
        if (wroteK.indexOf(pk) < 0 || !lab[pk]) continue;
        if (openK.indexOf(pk) >= 0) {
          var porig = flatten(row[pk + '_comment']), pt = flatten(tr && tr[pk]);
          var pshow = (from !== to && pt) ? pt : porig;
          if (!pshow) continue;
          if (from !== to && pt) pused = true;
          pc.push({ k: pk, label: lab[pk], text: pshow, o: !(from !== to && pt) });
          if (porig) po.push({ k: pk, label: lab[pk], text: porig });
        } else {
          pc.push({ k: pk, label: lab[pk], text: (psnip && pcl.k === pk) ? psnip : '', lock: true });
        }
      }
      return {
        /* translated は false のまま（鍵の無い行と同じ理由 ── 錠前の行で「原文を表示」を出さない）。訳した欄は o: false で分かる */
        lang: to, from: from, translated: false, locked: true, part: true, partTranslated: pused,
        clipped: !!psnip, clipKey: (psnip && pcl.k) || '', clipText: psnip, clipOrig: !!psnip && !pct,
        cats: pc, text: '', origCats: po, origText: '',
        /* 読める欄だけをつないだ本文（会社ページのカードが、錠前の上に出す）。text には入れない（上の理由） */
        openText: pc.filter(function (c) { return !c.lock; }).map(function (c) { return wrap(c.label, c.text); }).join(' / '),
        lockKeys: pc.filter(function (c) { return c.lock; }).map(function (c) { return c.k; }),
      };
    }

    // 本文の列が1つも来ていない＝鍵を持っていない。cats だけで組み立てる。
    var hasBody = false;
    for (var h = 0; h < KEYS.length; h++) {
      if (row && (KEYS[h] + '_comment') in row) { hasBody = true; break; }
    }
    if (!hasBody && row && Object.prototype.toString.call(row.cats) === '[object Array]') {
      /* ★2026-09-16、鍵の無い人にも「最初に書かれた欄の先頭40字」だけ届く
           （オーナー指示「いまは1文字も見れないので、最初の1行だけ読めるように」）。
           サーバは clip = { k:欄, o:原文40字, t:{訳文40字} } を1つだけ付ける。
         ⚠️ 抜粋を text に入れない ── community.html と airline-reviews-ui.js は
            text が空かどうかで「錠前を出すか」を決めている。入れた瞬間、
            **錠前の UI ごと消えて全文扱い**になる（本文は40字しか無いのに）。
         ⚠️ translated は false のまま ── true にすると両方のテンプレートが
            「原文を表示」を出し、origHTML() が原文を丸ごと画面に出す。 */
      var cl = (row && row.clip) || null;
      var ct = (cl && cl.k && cl.t && (cl.t[to] || (to === 'es' && from !== 'en' && cl.t.en))) || '';   // 抜粋の訳（無ければ原文の抜粋）
      var snip = (cl && cl.k)
        ? trimMoney(flatten(ct || cl.o || '')) : '';
      var locked = [];
      for (var c = 0; c < row.cats.length; c++) {
        var ck = row.cats[c];
        if (lab[ck]) {
          locked.push({ k: ck, label: lab[ck],
                        text: (snip && cl.k === ck) ? snip : '' });
        }
      }
      return {
        lang: to, from: from, translated: false, locked: true,
        clipped: !!snip, clipKey: (snip && cl.k) || '', clipText: snip, clipOrig: !!snip && !ct,
        cats: locked, text: '', origCats: [], origText: '',
      };
    }

    var cats = [], origCats = [], usedTranslation = false;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      var orig = flatten(row ? row[k + '_comment'] : '');
      var t = flatten(tr && tr[k]);
      // 訳文があるのは from !== to のときだけ。欠けている欄は原文に落とす。
      var show = (from !== to && t) ? t : orig;
      if (!show) continue;
      if (from !== to && t) usedTranslation = true;
      cats.push({ k: k, label: lab[k], text: show, o: !(from !== to && t) });   // o ＝ この欄は原文（attrs が見る）
      if (orig) origCats.push({ k: k, label: lab[k], text: orig });
    }
    // 長い順＝カードの主カテゴリ判定と読み応えのある順に揃える（既存挙動を踏襲）
    cats.sort(function (a, b) { return b.text.length - a.text.length; });
    origCats.sort(function (a, b) { return b.text.length - a.text.length; });

    var join = function (list) {
      return list.map(function (c) { return wrap(c.label, c.text); }).join(' / ');
    };
    return {
      lang: to, from: from, translated: usedTranslation, locked: false,
      cats: cats, text: join(cats),
      origCats: origCats, origText: usedTranslation ? join(origCats) : '',
    };
  }

  /* ══ 口コミを読む唯一の口 ═══════════════════════════════════════
     reviews_v2 は直接 select しない。DB 側で本文の列を anon / authenticated
     から外してあり（db/reviews-gate.sql）、鍵を持つ人にだけ本文を返すのは
     pv_reviews() の仕事。画面はぼかす側ではなく、**受け取らない側**になる。

     戻り値
       { unlocked:boolean, rows:Array }  … 取れた
       null                              … 取れなかった（0件と区別する）
     ★ null と [] を混ぜない。「取れなかった」を「0件」と言うと、
        通信が落ちた人の画面に「まだ投稿がありません」と嘘が出る
        （pv-reunlock.js に同じ決まりが書いてある）。 */
  function fetchRows(sb, params) {
    if (!sb || !sb.rpc) return Promise.resolve(null);
    return Promise.resolve(sb.rpc('pv_reviews', { p: params || {} }))
      .then(function (res) {
        if (!res || res.error) return null;
        var d0 = res.data;
        if (!d0 || Object.prototype.toString.call(d0.rows) !== '[object Array]') return null;
        return { unlocked: !!d0.unlocked, rows: d0.rows };
      })
      .catch(function () { return null; });
  }

  /* orig_lang / translations は後から足す列。DDL 未適用の環境では
     select 全体が 42703 で落ちて口コミが1件も出なくなるので、
     そのときだけ2列を外して1回だけ引き直す。
     run(extra) は「列リスト末尾に extra を足したクエリ」を返す関数。 */
  var EXTRA_COLS = ',orig_lang,translations';
  function fetchWithFallback(run) {
    return Promise.resolve(run(EXTRA_COLS)).then(function (res) {
      if (res && res.error && String(res.error.code) === '42703') return run('');
      return res;
    });
  }

  /* 「〇〇から自動翻訳」バッジ。訳文を出しているカードにだけ添える。
     ★2026-11-15 見える字にも「〇〇から」を出す（前は title の中だけ）。title も同じ字。
       原文の言語が分からない（'und'・空・2字でない）ときは「自動翻訳」だけ。
     mode … 'short' ＝ 見える字は「自動翻訳」だけ（title は「〇〇から自動翻訳」）。項目名と星と1行に並べる狭い札の行
                       （Vote の流れる帯 268/304px）用 ── 「〇〇から」を入れると英西は1つも収まらない（2026-11-15 実測）。
            'lead'  ＝ 行の頭に置く（左の余白なし）。 */
  function noteHTML(from, mode) {
    var u = pickT(UI, lang());
    var code = String(from || '').toLowerCase();
    var t = /^[a-z]{2}$/.test(code) ? u.from(code, langName(code)) : u.note;
    return '<span class="rv-tr-badge' + (mode === 'lead' ? ' is-lead' : mode === 'short' ? ' is-short' : '') + '" title="' + esc(t) + '">' +
      esc(mode === 'short' ? u.note : t) + '</span>';
  }

  /* 原文トグル。原文は消さずに畳んでおく（忠実性の担保）。
     p は pick() の答えか原文の言語のコード。渡すと、畳んだ原文に dir と lang が付く（origAttrs）。
     答えを渡したときは、項目名（ページの言語）を除いた本文の字だけで向きを決める。 */
  function origHTML(origText, p) {
    if (!origText) return '';
    var u = pickT(UI, lang());
    var at = !p ? '' : typeof p === 'string' ? origAttrs(p, origText)
      : origAttrs(p.from, (p.origCats || []).map(function (x) { return x.text; }).join(' '));
    return '<button type="button" class="rv-tr-toggle" data-show="' + esc(u.show) + '" data-hide="' + esc(u.hide) +
      '" onclick="PVReviewI18n.toggle(this)">' + esc(u.show) + '</button>' +
      '<div class="rv-tr-orig"' + at + ' hidden>' + esc(origText) + '</div>';
  }

  function toggle(btn) {
    var box = btn.nextElementSibling;
    if (!box) return;
    var open = box.hasAttribute('hidden');
    if (open) box.removeAttribute('hidden'); else box.setAttribute('hidden', '');
    btn.textContent = open ? btn.dataset.hide : btn.dataset.show;
  }

  /* バッジ・トグル・原文の最小スタイル。読み込んだページに1回だけ入れる。 */
  function injectCSS() {
    if (d.getElementById('pv-review-i18n-css')) return;
    var st = d.createElement('style');
    st.id = 'pv-review-i18n-css';
    st.textContent =
      '.rv-tr-badge{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;' +
        'font-size:.66rem;font-weight:600;letter-spacing:.02em;vertical-align:middle;' +
        // ★「〇〇から自動翻訳」は長い言語名で枠の幅を超える。丸い札の中で2〜3行に折れないよう1行に保ち、入らない分は … （全文は title）
        'max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
        'background:rgba(107,125,147,.14);color:#6b7d93;border:1px solid rgba(107,125,147,.28)}' +
      '.rv-tr-badge.is-lead{margin-left:0}' +
      // 'short'（Vote の流れる帯）は 2026-11-15 より前の形のまま ── 折らない行の中で … に縮められて「Machine-transla…」にならないように
      '.rv-tr-badge.is-short{max-width:none;white-space:normal;overflow:visible}' +
      '.rv-tr-toggle{display:inline-block;margin-top:8px;padding:0;border:0;background:none;cursor:pointer;' +
        'font-size:.72rem;font-weight:600;color:#6b7d93;text-decoration:underline;text-underline-offset:2px;' +
        'transition:color .15s cubic-bezier(.2,.8,.3,1),opacity .15s cubic-bezier(.2,.8,.3,1)}' +
      '.rv-tr-toggle:hover{color:#f5c842}' +
      '.rv-tr-toggle:focus-visible{outline:2px solid #f5c842;outline-offset:3px;border-radius:3px}' +
      '.rv-tr-toggle:active{opacity:.65}' +
      '.rv-tr-orig{margin-top:8px;padding:10px 12px;border-radius:8px;font-size:.82rem;line-height:1.75;' +
        'white-space:pre-wrap;background:rgba(107,125,147,.08);border:1px solid rgba(107,125,147,.18);color:#8fa0b4}' +
      // ライトテーマ。#6b7d93 / #8fa0b4 は白地だとコントラストが足りない。
      // ゴールドは JP 側（airline-base.css）と同じ #7a5800 に寄せる。
      '[data-theme="light"] .rv-tr-badge{background:rgba(15,23,42,.06);color:#475569;border-color:rgba(15,23,42,.16)}' +
      '[data-theme="light"] .rv-tr-toggle{color:#475569}' +
      '[data-theme="light"] .rv-tr-toggle:hover{color:#7a5800}' +
      '[data-theme="light"] .rv-tr-orig{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.12);color:#334155}';
    (d.head || d.documentElement).appendChild(st);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', injectCSS);
  else injectCSS();

  w.PVReviewI18n = {
    KEYS: KEYS, labels: function () { return pickT(LABELS, lang()); }, lang: lang,
    esc: esc, pick: pick, noteHTML: noteHTML, origHTML: origHTML, toggle: toggle,
    attrs: attrs, langName: langName,
    EXTRA_COLS: EXTRA_COLS, fetchWithFallback: fetchWithFallback,
    fetchRows: fetchRows,
  };
})(window, document);
