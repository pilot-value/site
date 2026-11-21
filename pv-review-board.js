/* ════════════════════════════════════════════════════════════════
   pv-review-board.js — 口コミを1項目ずつ聞く板（2026-11-20）

   オーナー決定「書いた項目は、全社ぶん読める。7項目書けば全部読める。」
   日英西で1本。文言は下の TX（PV_T が言語を選ぶ）。

   ── いつ出すか（決めるのは全部サーバ ── db/review-items.sql の pv_review_board）──────
   ・7日に1回・待遇の板（pv-conditions.js の askReturn）と同じ日に出さない・全部読める人には出さない。
   ・出してよいページかは pv-session.js の rvDue の1か所（7日の窓の中は通信ゼロ・読み込みもしない）。
   ・会員が自分で押して開いた板（Vote の「続きを書く」「書く」）は7日を待たない（open）。
   ・同じページに板は1枚（パイロット確認 → Give & Get → 待遇の板 → この板）。ほかの板が開いていたら重ねない。

   ── 守ること ────────────────────────────────────────────────
   ・1項目ずつその場で保存する（submit_review_item）。最後にまとめて送らない。
   ・1項目40字以上（サーバも同じ数で止める）。品質の判定（assessReviewQuality / assessReviewSet）は
     submit-review.html の写し ── assert-review-quality.mjs が7か所の写しを突き合わせている。1か所だけ直さない。
   ・書きかけは端末の中だけ（pv_rvdraft）。ログアウトで消える（pv-session.js の wipe）。
   ・× ・外側・Esc で閉じられる。「二度と出さない」は置かない（7日たてばまた聞く）。
   ・どの項目が読めるかは決めない（サーバの pv_review_my_cats）。ここは「書いた」を見せるだけ。
   ・ほかの人の人数・件数を出さない（サーバも返さない）。
   ════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';
  if (!w || !d || w.PVReviewBoard) return;

  var SELF = (d.currentScript && d.currentScript.src) || '';
  var KEYS = ['culture', 'salary', 'benefits', 'wlb', 'ops', 'training', 'mgmt'];
  var MIN = 40, MAX = 300;
  var K_DRAFT = 'pv_rvdraft', K_SKIP = 'pv_rvskip';

  var L = w.PV_BASE === 'en' || /^en/i.test(d.documentElement.lang || '') ? 'en' : 'ja';
  var ES = w.PV_LANG === 'es';

  var TX = {
    ja: {
      label: { culture: '企業文化', salary: '給与', benefits: '福利厚生', wlb: 'ワークライフバランス',
               ops: '運航環境', training: '訓練環境', mgmt: '経営陣への提案' },
      head: function (n) { return n ? n + 'の口コミを、1項目だけ。' : '口コミを、1項目だけ。'; },
      /* マスの中の字（狭いので折れてよい所に <wbr>） */
      tile: { culture: '企業文化', salary: '給与', benefits: '福利厚生', wlb: 'ワークライフ<wbr>バランス',
              ops: '運航環境', training: '訓練環境', mgmt: '経営陣への<wbr>提案' },
      lead: '書いた項目は、全社ぶん読めます',
      count: function (k) { return k + ' / 7 項目'; },
      place: function (l) { return l + 'について、良いところ・気になるところ（40字以上）'; },
      time: '約30秒',
      chars: function (n) { return n < MIN ? '<b>' + n + '</b> / ' + MIN + '字' : '<b>' + n + '</b>字'; },
      send: '匿名で送る', sending: '送っています…',
      skip: '今回はスキップ', prev: '← 前の質問', close: '閉じる',
      star: function (n) { return '評価 ' + n + ' / 5'; },
      restored: '書きかけを戻しました',
      sent: function (l) { return l + 'の口コミ、送りました'; },
      sentT: function (l) { return '全社の「' + l + '」の口コミが読めるようになりました。'; },
      read: function (l) { return l + 'の口コミを読む'; },
      more: '続けてもう1項目書く（約30秒）',
      left: function (n) { return 'あと<b>' + n + '項目</b>で、全社の口コミが全部読めます'; },
      allHead: '7 / 7 項目 完了', allLead: '全部の項目を書きました',
      allT: '全社の口コミが、全部読めるようになりました。',
      allS: function (n) { return '書いた7項目は、' + n + 'の口コミとして匿名で載ります。'; },
      readAll: '口コミを読む',
      air: '口コミを書く会社', airPick: '選んでください', pos: '職位', cap: '機長', fo: '副操縦士', next: '次へ',
      region: { japan: '日本', mideast: '中東', asia: 'アジア', europe: '欧州', us: '北米', oceania: 'オセアニア', latam: '中南米', africa: 'アフリカ' },
      order: ['japan', 'mideast', 'asia', 'europe', 'us', 'oceania', 'latam', 'africa'],
      err: {
        star: '評価（★）を選んでください。',
        short: '40字以上で書いてください。',
        long: '300字までです。',
        quality: '同じ字の繰り返しや、意味のない字の並びは送れません。実際に感じたことを書いてください。',
        copy: 'ほかの項目と同じ文は送れません。この項目のことを書いてください。',
        limit: '今日はここまでです。明日また書けます。',
        login: 'ログインが切れています。ログインし直してください。',
        net: '送れませんでした。もう一度押してください。'
      }
    },
    en: {
      /* 項目名は Vote（vote.js の cat）と同じ呼び名 ── 板から Vote へ移っても同じ名前で探せる */
      label: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits', wlb: 'Work-life balance',
               ops: 'Flight operations', training: 'Training', mgmt: 'Suggestions for management' },
      head: function (n) { return n ? 'Your ' + n + ' review — just one topic.' : 'Your review — just one topic.'; },
      tile: { culture: 'Culture', salary: 'Pay', benefits: 'Benefits', wlb: 'Work-life', ops: 'Flight ops',
              training: 'Training', mgmt: 'Management' },
      lead: 'Each topic you write opens that topic for every airline',
      count: function (k) { return k + ' / 7 topics'; },
      place: function (l) { return l + ': what works, what doesn’t (40+ characters)'; },
      time: 'About 30 sec',
      chars: function (n) { return n < MIN ? '<b>' + n + '</b> / ' + MIN : '<b>' + n + '</b> characters'; },
      send: 'Send anonymously', sending: 'Sending…',
      skip: 'Skip for now', prev: '← Previous', close: 'Close',
      star: function (n) { return n + ' of 5'; },
      restored: 'Draft restored',
      sent: function (l) { return l + ' review sent'; },
      sentT: function (l) { return 'You can now read “' + l + '” in every airline’s reviews.'; },
      read: function (l) { return 'Read ' + l + ' reviews'; },
      more: 'Write one more (about 30 sec)',
      left: function (n) { return '<b>' + n + ' more</b> to open every airline’s reviews in full'; },
      allHead: '7 / 7 topics done', allLead: 'You’ve written every topic',
      allT: 'Every airline’s reviews are now open in full.',
      allS: function (n) { return 'Your 7 topics are posted anonymously as a ' + n + ' review.'; },
      readAll: 'Read reviews',
      air: 'Airline you’re reviewing', airPick: 'Choose', pos: 'Position', cap: 'Captain', fo: 'First Officer', next: 'Next',
      region: { mideast: 'Middle East', asia: 'Asia', europe: 'Europe', us: 'North America', oceania: 'Oceania', latam: 'Latin America', africa: 'Africa', japan: 'Japan' },
      order: ['mideast', 'asia', 'europe', 'us', 'oceania', 'latam', 'africa', 'japan'],
      err: {
        star: 'Choose a rating (★).',
        short: 'Write at least 40 characters.',
        long: 'Up to 300 characters.',
        quality: 'Repeated or random characters can’t be sent. Write what you actually experienced.',
        copy: 'This is the same text as another topic. Write about this topic.',
        limit: 'That’s all for today. You can write more tomorrow.',
        login: 'You’ve been signed out. Please log in again.',
        net: 'Couldn’t send. Please try again.'
      }
    },
    es: {
      label: { culture: 'Cultura', salary: 'Remuneración', benefits: 'Beneficios', wlb: 'Equilibrio vida-trabajo',
               ops: 'Operaciones de vuelo', training: 'Entrenamiento', mgmt: 'Sugerencias para la dirección' },
      head: function (n) { return n ? 'Tu reseña de ' + n + ': solo un tema.' : 'Tu reseña: solo un tema.'; },
      tile: { culture: 'Cultura', salary: 'Remuneración', benefits: 'Beneficios', wlb: 'Vida y trabajo', ops: 'Operaciones',
              training: 'Entrenamiento', mgmt: 'Dirección' },
      lead: 'Cada tema que escribas se abre en todas las aerolíneas',
      count: function (k) { return k + ' / 7 temas'; },
      place: function (l) { return l + ': lo bueno y lo que no (40 caracteres o más)'; },
      time: 'Unos 30 s',
      chars: function (n) { return n < MIN ? '<b>' + n + '</b> / ' + MIN : '<b>' + n + '</b> caracteres'; },
      send: 'Enviar de forma anónima', sending: 'Enviando…',
      skip: 'Omitir por ahora', prev: '← Anterior', close: 'Cerrar',
      star: function (n) { return n + ' de 5'; },
      restored: 'Recuperamos tu borrador',
      sent: function (l) { return 'Reseña de ' + l + ' enviada'; },
      sentT: function (l) { return 'Ya puedes leer “' + l + '” en las reseñas de todas las aerolíneas.'; },
      read: function (l) { return 'Leer reseñas de ' + l; },
      more: 'Escribir un tema más (unos 30 s)',
      left: function (n) { return 'Te faltan <b>' + n + '</b> para abrir todas las reseñas completas'; },
      allHead: '7 / 7 temas listos', allLead: 'Escribiste todos los temas',
      allT: 'Las reseñas de todas las aerolíneas ya están abiertas por completo.',
      allS: function (n) { return 'Tus 7 temas se publican de forma anónima como reseña de ' + n + '.'; },
      readAll: 'Leer reseñas',
      air: 'Aerolínea que reseñas', airPick: 'Elige', pos: 'Cargo', cap: 'Capitán', fo: 'Primer oficial', next: 'Siguiente',
      region: { mideast: 'Medio Oriente', asia: 'Asia', europe: 'Europa', us: 'Norteamérica', oceania: 'Oceanía', latam: 'Latinoamérica', africa: 'África', japan: 'Japón' },
      order: ['latam', 'us', 'europe', 'mideast', 'asia', 'oceania', 'africa', 'japan'],
      err: {
        star: 'Elige una calificación (★).',
        short: 'Escribe al menos 40 caracteres.',
        long: 'Hasta 300 caracteres.',
        quality: 'No se pueden enviar caracteres repetidos o sin sentido. Escribe lo que viviste.',
        copy: 'Es el mismo texto que otro tema. Escribe sobre este tema.',
        limit: 'Por hoy es todo. Mañana puedes escribir más.',
        login: 'Tu sesión se cerró. Vuelve a iniciar sesión.',
        net: 'No se pudo enviar. Inténtalo de nuevo.'
      }
    }
  };
  var T = (w.PV_T && w.PV_T(TX, L)) || (ES ? TX.es : TX[L]);

  // ── 端末の保存（書きかけ・スキップ）。読めなくても板は動く ──────────────
  function load(k) { try { var v = JSON.parse(w.localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function save(k, v) { try { w.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 書けなくても続ける */ } }
  function draftGet(air, cat) { var v = load(K_DRAFT)[air + ':' + cat]; return v && typeof v.t === 'string' ? v : null; }
  function draftPut(air, cat, t, s) {
    var all = load(K_DRAFT), key = air + ':' + cat;
    if (t && t.trim()) all[key] = { t: t.slice(0, MAX + 50), s: s || 0, at: Date.now() }; else delete all[key];
    save(K_DRAFT, all);
  }
  function skipped(air) { var v = load(K_SKIP)[air]; return Array.isArray(v) ? v : []; }
  function skipPut(air, list) { var all = load(K_SKIP); all[air] = list; save(K_SKIP, all); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function len(t) { return Array.from(String(t || '').trim()).length; }
  function gt(name, p) { try { if (typeof w.gtag === 'function') w.gtag('event', name, p || {}); } catch (e) { /* 計測は落ちてもよい */ } }

  // ── 口コミ品質の自動検知（submit-review.html の写し。assert-review-quality.mjs が7か所を突き合わせる）──
  // ── 口コミ品質の自動検知（無意味な文字の羅列・乱打・水増しをブロック） ──
  // 誤検知を避けるため閾値は保守的。日本語主体の正規レビューは通し、乱打だけ弾く。
  // {ok:boolean, reason:string} を返す純関数。
  function assessReviewQuality(raw) {
    const t = (raw || '').replace(/\s+/g, ' ').trim();
    const len = t.length;
    if (len === 0) return { ok: true, reason: '' };

    // 1) 同一文字の連打（5文字以上の連続）例:「あああああ」「っっっっっ」
    if (/([^\p{N}\p{P}\p{S}\p{Z}\s\u0640])\1{4,}/u.test(t)) {
      return { ok: false, reason: '同じ文字が連続しすぎています（例:「あああああ」）。実際に感じたことを書いてください。' };
    }

    // 2) 同一語句の繰り返し（2文字以上の単位が3回以上連続し、全体の過半を占める）
    const rep = t.match(/(.{2,}?)\1{2,}/u);
    if (rep && rep[0].length >= Math.max(12, len * 0.5)) {
      return { ok: false, reason: '同じ語句の繰り返しが多すぎます（例:「〜は低い〜は低い…」）。具体的な内容に書き換えてください。' };
    }

    // 3) 文字の種類が極端に少ない＝水増し（40文字以上で異なり文字10種未満）
    const uniq = new Set(t.replace(/\s/g, '')).size;
    if (len >= 40 && uniq < 10) {
      return { ok: false, reason: '内容が乏しく文字数稼ぎと判定されました。あなたの具体的な経験を書いてください。' };
    }

    // 4) ラテン文字の乱打（母音がほとんど無いキーボード連打）
    const bare = t.replace(/\b[A-Z0-9]{2,10}(?:[\/-][A-Z0-9]{1,10})*\b/g, ' ');
    const latin = bare.match(/[A-Za-z]/g) || [];
    if (latin.length >= 12) {
      const vowels = bare.match(/[AEIOUaeiou]/g) || [];
      if (vowels.length / latin.length < 0.15) {
        return { ok: false, reason: '意味のない文字の羅列（キーボードの連打）と判定されました。実際の経験を文章で書いてください。' };
      }
    }

    // 5) 二連字（bigram）の多様性が極端に低い＝機械的な反復（固定長の窓ごとに測り、いちばん悪い窓で判定）
    if (len >= 40) {
      const ns = t.replace(/\s/g, '');
      const WIN = 200, STEP = 100;
      const diversity = (s) => {
        const grams = [];
        for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
        return grams.length >= 8 ? new Set(grams).size / grams.length : 1;
      };
      let worst = ns.length <= WIN ? diversity(ns) : 1;
      for (let i = 0; i + WIN <= ns.length; i += STEP) worst = Math.min(worst, diversity(ns.slice(i, i + WIN)));
      if (ns.length > WIN) worst = Math.min(worst, diversity(ns.slice(-WIN)));
      if (worst < 0.35) {
        return { ok: false, reason: '意味のない文字の羅列（同じパターンの反復）と判定されました。具体的な内容に書き換えてください。' };
      }
    }

    return { ok: true, reason: '' };
  }

  // ── カテゴリ間の同一段落コピペを検知（同じ文章を各カテゴリに貼り回す対策） ──
  function assessReviewSet(cats) {
    const norm = s => (s || '')
      .replace(/【[^】]*】/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    const items = Object.values(cats)
      .map(c => norm(c.comment))
      .filter(n => n.length >= 20);
    const bigrams = s => {
      const set = new Set();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };
    const sim = (a, b) => {
      if (a === b) return 1;
      if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
      const A = bigrams(a), B = bigrams(b);
      let inter = 0;
      for (const g of A) if (B.has(g)) inter++;
      const uni = A.size + B.size - inter;
      return uni ? inter / uni : 0;
    };
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (sim(items[i], items[j]) > 0.8) return { ok: false, reason: 'copy' };
      }
    }
    return { ok: true, reason: '' };
  }

  // ── 見た目（このファイルだけで完結。MY PAY の物差し：字は600〜700・緑と黒と灰・白いカード）──
  var CSS = [
    'html.pvrb-lock{overflow:hidden}',
    '.pvrb-back{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;',
    'background:rgba(10,12,15,.52);opacity:0;transition:opacity .3s cubic-bezier(.16,1,.3,1)}',
    '.pvrb-back.is-in{opacity:1}',
    '.pvrb-m{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;',
    '-webkit-overflow-scrolling:touch;box-sizing:border-box;border-radius:20px;padding:24px 22px 8px;',
    'background:var(--pv-surface,#fff);color:var(--pv-text,#111);border:1px solid var(--pv-border,#e7e7e3);',
    'box-shadow:0 1px 2px rgba(6,117,99,.06),0 12px 24px -12px rgba(6,117,99,.16),0 32px 64px -32px rgba(10,12,15,.45);',
    'opacity:0;transform:translateY(10px) scale(.985);transition:opacity .36s cubic-bezier(.16,1,.3,1),transform .36s cubic-bezier(.16,1,.3,1);',
    'font-family:inherit;text-align:left}',
    '.pvrb-back.is-in .pvrb-m{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){.pvrb-back,.pvrb-m{transition:none;transform:none}}',
    '.pvrb-x{position:absolute;top:8px;right:8px;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:12px;',
    'background:none;color:var(--pv-text-soft,#8a8a8a);font-size:1.35rem;line-height:1;cursor:pointer;transition:color .2s,background-color .2s,transform .18s}',
    '.pvrb-x:hover{color:var(--pv-text,#111);background:var(--pv-surface-soft,#f7f7f5)}',
    '.pvrb-x:active{transform:scale(.94)}',
    '.pvrb-m button:focus-visible,.pvrb-m select:focus-visible,.pvrb-m a:focus-visible{outline:2px solid var(--pv-accent,#0a8f79);outline-offset:2px}',
    '.pvrb-eb{font-size:1.02rem;font-weight:700;letter-spacing:-.01em;line-height:1.5;padding-right:40px;margin:0}',
    '.pvrb-done{display:flex;align-items:center;gap:8px;font-size:1.02rem;font-weight:700;letter-spacing:-.01em;line-height:1.5;',
    'color:var(--pv-accent-ink,#067563);padding-right:40px;margin:0}',
    '.pvrb-done::before{content:"";flex:none;width:20px;height:20px;border-radius:50%;background:var(--pv-accent,#0a8f79) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'3.2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 12.5l4 4 8-9\'/%3E%3C/svg%3E") center/12px no-repeat}',
    '.pvrb-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:14px;font-size:.76rem;font-weight:600;',
    'color:var(--pv-text-muted,#666)}',
    '.pvrb-n{flex:none;font-weight:700;color:var(--pv-accent-ink,#067563);white-space:nowrap}',
    '.pvrb-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}',
    '.pvrb-tile{min-height:44px;padding:6px 4px;border-radius:10px;border:1px solid transparent;background:var(--pv-surface-soft,#f7f7f5);',
    'color:var(--pv-text-soft,#8a8a8a);font:inherit;font-size:.66rem;font-weight:600;line-height:1.3;cursor:pointer;word-break:keep-all;overflow-wrap:break-word;',
    'transition:border-color .2s,background-color .2s,color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvrb-tile:hover{border-color:var(--pv-accent-line,#bfe6db);color:var(--pv-text,#111)}',
    '.pvrb-tile:active{transform:scale(.97)}',
    '.pvrb-tile.on{background:var(--pv-accent-soft,#e7f5f1);border-color:var(--pv-accent-line,#bfe6db);color:var(--pv-accent-ink,#067563)}',
    '.pvrb-tile.on::before{content:"\\2713\\a0"}',
    '.pvrb-tile.cur{background:var(--pv-accent,#0a8f79);border-color:transparent;color:#fff;font-weight:700}',
    '.pvrb-item{margin-top:20px;font-size:1rem;font-weight:700;letter-spacing:-.01em}',
    '.pvrb-stars{display:flex;gap:8px;margin-top:10px}',
    '.pvrb-star{width:44px;height:44px;display:grid;place-items:center;border-radius:10px;border:1px solid var(--pv-border,#e7e7e3);',
    'background:var(--pv-surface,#fff);color:var(--pv-border,#d7d7d3);font-size:20px;line-height:1;cursor:pointer;',
    'transition:border-color .2s,background-color .2s,color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvrb-star:hover{border-color:var(--pv-accent-line,#bfe6db)}',
    '.pvrb-star:active{transform:scale(.94)}',
    '.pvrb-star.on{color:var(--pv-accent,#0a8f79);border-color:var(--pv-accent-line,#bfe6db);background:var(--pv-accent-soft,#e7f5f1)}',
    '.pvrb-ta{display:block;width:100%;box-sizing:border-box;min-height:104px;margin-top:12px;padding:12px 14px;border-radius:12px;',
    'font:inherit;font-size:16px;line-height:1.6;color:var(--pv-text,#111);background:var(--pv-surface,#fff);',
    'border:1px solid var(--pv-border,#e7e7e3);resize:vertical;transition:border-color .2s,box-shadow .2s}',
    '.pvrb-ta::placeholder{color:var(--pv-text-soft,#8a8a8a)}',
    '.pvrb-ta:focus{outline:none;border-color:var(--pv-accent,#0a8f79);box-shadow:0 0 0 3px var(--pv-accent-soft,#e7f5f1)}',
    '.pvrb-saved{margin-top:6px;font-size:.72rem;font-weight:600;color:var(--pv-accent-ink,#067563)}',
    '.pvrb-cnt{display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:.72rem;font-weight:600;color:var(--pv-text-soft,#8a8a8a)}',
    '.pvrb-cnt b{color:var(--pv-accent-ink,#067563);font-weight:700}',
    '.pvrb-warn{margin-top:10px;padding:9px 12px;border-radius:10px;background:var(--pv-surface-soft,#f7f7f5);',
    'font-size:.78rem;font-weight:600;line-height:1.6;color:var(--pv-text,#111)}',
    '.pvrb-warn:empty{display:none}',
    '.pvrb-go{display:flex;justify-content:flex-end;margin-top:14px}',
    '.pvrb-btn{min-height:44px;padding:11px 20px;border-radius:12px;border:1px solid transparent;background:var(--pv-accent-dark,#067563);',
    'color:#fff;font:inherit;font-size:.86rem;font-weight:700;line-height:1.3;cursor:pointer;text-align:center;text-decoration:none;',
    'transition:background-color .2s,transform .18s cubic-bezier(.16,1,.3,1),opacity .2s}',
    '.pvrb-btn:hover{background:var(--pv-accent,#0a8f79)}',
    '.pvrb-btn:active{transform:scale(.97)}',
    '.pvrb-btn[disabled]{cursor:default;background:var(--pv-surface-soft,#f0f2f5);color:var(--pv-text-soft,#8a8a8a)}',
    '.pvrb-btn[disabled]:hover{background:var(--pv-surface-soft,#f0f2f5)}',
    '.pvrb-btn[disabled]:active{transform:none}',
    '.pvrb-sec{background:var(--pv-surface,#fff);color:var(--pv-accent-ink,#067563);border-color:var(--pv-accent-line,#bfe6db)}',
    '.pvrb-sec:hover{background:var(--pv-accent-soft,#e7f5f1)}',
    '.pvrb-btns{display:grid;gap:8px;margin-top:18px}',
    '.pvrb-t{margin:16px 0 0;font-size:.98rem;font-weight:700;line-height:1.65;letter-spacing:-.01em}',
    '.pvrb-s{margin:6px 0 0;font-size:.78rem;line-height:1.7;color:var(--pv-text-muted,#666)}',
    '.pvrb-left{margin:12px 0 0;text-align:center;font-size:.76rem;font-weight:600;line-height:1.6;color:var(--pv-text-muted,#666)}',
    '.pvrb-left b{color:var(--pv-accent-ink,#067563)}',
    '.pvrb-foot{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:12px;margin-top:18px;',
    'border-top:1px solid var(--pv-border,#e7e7e3)}',
    '.pvrb-step{justify-self:center;white-space:nowrap;font-size:.72rem;font-weight:700;letter-spacing:.06em;color:var(--pv-text-soft,#8a8a8a)}',
    '.pvrb-prev,.pvrb-skip{min-height:44px;padding:11px 2px;border:0;background:none;font:inherit;font-size:.76rem;font-weight:600;',
    'color:var(--pv-text-muted,#666);cursor:pointer;white-space:nowrap;transition:color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvrb-prev{justify-self:start}',
    '.pvrb-skip{justify-self:end;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px;',
    'text-decoration-color:var(--pv-border,#d7d7d3)}',
    '.pvrb-prev:hover,.pvrb-skip:hover{color:var(--pv-text,#111)}',
    '.pvrb-prev:active{transform:translateX(-2px)}',
    '.pvrb-skip:active{transform:scale(.97)}',
    '.pvrb-f{display:block;margin-top:18px}',
    '.pvrb-fl{display:block;font-size:.76rem;font-weight:600;color:var(--pv-text-muted,#666);margin-bottom:6px}',
    '.pvrb-sel{display:block;width:100%;box-sizing:border-box;min-height:46px;padding:10px 12px;border-radius:12px;font:inherit;font-size:16px;',
    'color:var(--pv-text,#111);background:var(--pv-surface,#fff);border:1px solid var(--pv-border,#e7e7e3);cursor:pointer}',
    '.pvrb-sel:hover{border-color:var(--pv-accent-line,#bfe6db)}',
    '.pvrb-pos{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.pvrb-pos button{min-height:44px;border-radius:12px;border:1px solid var(--pv-border,#e7e7e3);background:var(--pv-surface,#fff);',
    'color:var(--pv-text,#111);font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;',
    'transition:border-color .2s,background-color .2s,color .2s,transform .18s cubic-bezier(.16,1,.3,1)}',
    '.pvrb-pos button:hover{border-color:var(--pv-accent-line,#bfe6db)}',
    '.pvrb-pos button:active{transform:scale(.97)}',
    '.pvrb-pos button[aria-pressed="true"]{border-color:var(--pv-accent,#0a8f79);background:var(--pv-accent-soft,#e7f5f1);color:var(--pv-accent-ink,#067563);font-weight:700}',
    '@media (max-width:360px){.pvrb-m{padding:22px 16px 6px}.pvrb-tile{font-size:.62rem}.pvrb-star{width:40px;height:40px}}'
  ];
  function ensureStyle() {
    if (d.getElementById('pvrb-style')) return;
    var s = d.createElement('style');
    s.id = 'pvrb-style';
    s.textContent = CSS.join('');
    (d.head || d.documentElement).appendChild(s);
  }

  // ── ほかの板が開いていたら重ねない（pv-conditions.js の busy と同じ見方）──
  function busy() {
    if (d.querySelector('[data-pvrb],[data-pvc]')) return true;
    if (w.PVContrib && typeof w.PVContrib.isOpen === 'function' && w.PVContrib.isOpen()) return true;
    return Array.prototype.some.call(d.querySelectorAll('[aria-modal="true"]'), function (el) {
      return el.getClientRects().length > 0;
    });
  }

  var AIRS = null;   // pv-airlines.json（会社を選ぶときだけ読む）
  function loadAirs() {
    if (AIRS) return Promise.resolve(AIRS);
    var url = SELF ? new URL('pv-airlines.json', SELF).href : 'pv-airlines.json';
    return fetch(url, { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { AIRS = (j && j.airlines) || {}; return AIRS; })
      .catch(function () { AIRS = {}; return AIRS; });
  }
  function airName(code, st) {
    if (!code) return '';
    if (st && (L === 'ja' ? st.name_ja : st.name_en)) return L === 'ja' ? st.name_ja : st.name_en;
    var a = AIRS && AIRS[code];
    return a ? (L === 'ja' ? a.ja : a.en) : code;
  }
  function voteURL(cat) {
    var dir = ES ? 'es/' : L === 'en' ? 'en/' : '';
    var u = dir + 'community.html' + (cat ? '?cat=' + encodeURIComponent(cat) : '');
    return SELF ? new URL(u, SELF).href : u;
  }

  // ════════════════════════════════════════════════════════════════
  // 板
  // ════════════════════════════════════════════════════════════════
  function Board(rpc, st, mine, o) {
    this.rpc = rpc;
    this.o = o || {};
    this.air = st.airline || '';
    this.pos = st.position || '';
    this.st = st;
    this.done = {};
    var self = this;
    (st.done || []).forEach(function (k) { self.done[k] = true; });
    this.text = {};            // 書いた本文（自分の口コミ ＋ この板で送った分）
    this.score = {};
    (mine || []).forEach(function (r) {
      if (r.airline !== self.air) return;
      KEYS.forEach(function (k) {
        if (r[k + '_comment']) self.text[k] = String(r[k + '_comment']);
        if (r[k + '_score']) self.score[k] = Number(r[k + '_score']);
      });
    });
    this.order = (Array.isArray(st.order) && st.order.length === 7 ? st.order : ['salary', 'wlb', 'benefits', 'training', 'ops', 'culture', 'mgmt']).slice();
    this.hist = [];            // この板で見せた項目（← 前の質問）
    this.changed = false;
    this.full = false;
  }
  Board.prototype.count = function () { var n = 0; for (var k in this.done) if (this.done[k]) n++; return n; };
  Board.prototype.nextCat = function (after) {
    var self = this, sk = skipped(this.air);
    var todo = this.order.filter(function (k) { return !self.done[k] && k !== after; });
    var fresh = todo.filter(function (k) { return sk.indexOf(k) < 0; });
    return fresh[0] || todo[0] || null;
  };
  Board.prototype.mount = function () {
    ensureStyle();
    var self = this;
    this.prevFocus = d.activeElement;
    var back = d.createElement('div');
    back.className = 'pvrb-back';
    back.setAttribute('data-pvrb', '1');
    back.innerHTML = '<div class="pvrb-m" role="dialog" aria-modal="true" aria-labelledby="pvrb-h">'
      + '<button type="button" class="pvrb-x" aria-label="' + esc(T.close) + '">&times;</button><div class="pvrb-b"></div></div>';
    this.back = back;
    this.box = back.querySelector('.pvrb-m');
    this.body = back.querySelector('.pvrb-b');
    back.querySelector('.pvrb-x').addEventListener('click', function () { self.close('close_button'); });
    back.addEventListener('mousedown', function (e) { self.downOut = e.target === back; });
    back.addEventListener('click', function (e) { if (e.target === back && self.downOut) self.close('overlay'); });
    this.onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); self.close('escape'); return; }
      if (e.key !== 'Tab') return;
      var f = self.box.querySelectorAll('button:not([disabled]),select,textarea,a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    d.addEventListener('keydown', this.onKey, true);
    d.documentElement.classList.add('pvrb-lock');
    d.body.appendChild(back);
    requestAnimationFrame(function () { back.classList.add('is-in'); });
    gt('review_board_open', { from: this.o.from || 'return_visit' });
  };
  Board.prototype.close = function (how) {
    if (!this.back) return;
    var back = this.back;
    this.back = null;
    d.removeEventListener('keydown', this.onKey, true);
    d.documentElement.classList.remove('pvrb-lock');
    back.classList.remove('is-in');
    setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 320);
    try { if (this.prevFocus && this.prevFocus.focus) this.prevFocus.focus(); } catch (e) { /* 戻せなくてよい */ }
    gt('review_board_close', { how: how || 'close', items: this.count() });
    if (!this.changed) return;
    var info = { full: this.full, done: Object.keys(this.done).filter(function (k) { return this.done[k]; }, this) };
    if (typeof this.o.onChange === 'function') {
      try { this.o.onChange(info); } catch (e) { /* 呼ぶ側の失敗は板に響かせない */ }
    }
    /* 7日に1回の板（pv-session.js が開く）は呼ぶ側を知らない。読める項目が変わったことをページへ知らせる（Vote が読み直す） */
    try { w.dispatchEvent(new CustomEvent('pv-review-change', { detail: info })); } catch (e) { /* 古い端末 */ }
  };
  Board.prototype.tiles = function (cur) {
    var self = this;
    return '<div class="pvrb-head"><span>' + esc(this.full ? T.allLead : T.lead) + '</span><span class="pvrb-n">' + esc(T.count(this.count())) + '</span></div>'
      + '<div class="pvrb-tiles">' + KEYS.map(function (k) {
        var c = 'pvrb-tile' + (self.done[k] ? ' on' : '') + (k === cur ? ' cur' : '');
        return '<button type="button" class="' + c + '" data-cat="' + k + '" aria-label="' + esc(T.label[k]) + '"' + (k === cur ? ' aria-current="step"' : '') + '>' + T.tile[k] + '</button>';
      }).join('') + '</div>';
  };
  Board.prototype.wireTiles = function () {
    var self = this;
    Array.prototype.forEach.call(this.body.querySelectorAll('.pvrb-tile'), function (b) {
      b.addEventListener('click', function () {
        if (!self.air || !self.pos || self.full) return;
        self.show(b.getAttribute('data-cat'), true);
      });
    });
  };
  Board.prototype.foot = function (step, prev, skip) {
    return '<div class="pvrb-foot">'
      + (prev ? '<button type="button" class="pvrb-prev">' + esc(T.prev) + '</button>' : '<span></span>')
      + '<span class="pvrb-step">' + esc(step) + '</span>'
      + (skip ? '<button type="button" class="pvrb-skip">' + esc(T.skip) + '</button>' : '<span></span>')
      + '</div>';
  };
  Board.prototype.wireFoot = function (cat) {
    var self = this;
    var p = this.body.querySelector('.pvrb-prev'), s = this.body.querySelector('.pvrb-skip');
    if (p) p.addEventListener('click', function () { self.back1(); });
    if (s) s.addEventListener('click', function () { self.skip(cat); });
  };

  // ── 会社と職位（分からないときだけ1回）────────────────────────────
  Board.prototype.pick = function () {
    var self = this, askAir = !self.air;   // 給与・書きかけで会社が決まっている人には会社を聞かない（職位だけ）
    loadAirs().then(function (airs) {
      if (!self.back) return;
      var groups = {};
      Object.keys(airs).forEach(function (code) {
        var a = airs[code];
        if (!a || a.kind === 'retired' || code === 'other') return;
        (groups[a.region] = groups[a.region] || []).push(code);
      });
      var opts = '<option value="">' + esc(T.airPick) + '</option>' + T.order.filter(function (r) { return groups[r]; }).map(function (r) {
        var list = groups[r].sort(function (a, b) {
          return String(airs[a].en || '').localeCompare(String(airs[b].en || ''), 'en', { sensitivity: 'base' }) || (a < b ? -1 : 1);
        });
        return '<optgroup label="' + esc(T.region[r] || r) + '">' + list.map(function (c) {
          return '<option value="' + esc(c) + '"' + (c === self.air ? ' selected' : '') + '>' + esc(L === 'ja' ? airs[c].ja : airs[c].en) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
      self.body.innerHTML = '<h2 class="pvrb-eb" id="pvrb-h">' + esc(T.head(askAir ? '' : airName(self.air, self.st))) + '</h2>'
        + self.tiles(null)
        + (askAir ? '<label class="pvrb-f"><span class="pvrb-fl">' + esc(T.air) + '</span><select class="pvrb-sel">' + opts + '</select></label>' : '')
        + '<div class="pvrb-f"><span class="pvrb-fl">' + esc(T.pos) + '</span><div class="pvrb-pos">'
        + '<button type="button" data-pos="captain" aria-pressed="' + (self.pos === 'captain') + '">' + esc(T.cap) + '</button>'
        + '<button type="button" data-pos="fo" aria-pressed="' + (self.pos === 'fo') + '">' + esc(T.fo) + '</button></div></div>'
        + '<div class="pvrb-go"><button type="button" class="pvrb-btn pvrb-next" disabled>' + esc(T.next) + '</button></div>'
        + self.foot('', false, false);
      var sel = self.body.querySelector('.pvrb-sel'), next = self.body.querySelector('.pvrb-next');
      var air = function () { return sel ? sel.value : self.air; };
      var sync = function () { next.disabled = !(air() && self.pos); };
      if (sel) sel.addEventListener('change', function () { self.air = sel.value; sync(); });
      Array.prototype.forEach.call(self.body.querySelectorAll('.pvrb-pos button'), function (b) {
        b.addEventListener('click', function () {
          self.pos = b.getAttribute('data-pos');
          Array.prototype.forEach.call(self.body.querySelectorAll('.pvrb-pos button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          sync();
        });
      });
      next.addEventListener('click', function () {
        if (!air() || !self.pos) return;
        self.air = air();
        self.st.name_ja = airs[self.air] && airs[self.air].ja;
        self.st.name_en = airs[self.air] && airs[self.air].en;
        self.show(self.o.cat && !self.done[self.o.cat] ? self.o.cat : self.nextCat());
      });
      sync();
      (sel || self.body.querySelector('.pvrb-pos button')).focus();
    });
  };

  // ── 1項目を書く ─────────────────────────────────────────────
  Board.prototype.show = function (cat, jump) {
    var self = this;
    if (!cat) { this.all(); return; }
    if (this.hist[this.hist.length - 1] !== cat) this.hist.push(cat);
    this.cat = cat;
    var label = T.label[cat];
    var dr = draftGet(this.air, cat);
    var had = this.text[cat] || '';
    var useDraft = dr && dr.t && dr.t !== had;
    var val = useDraft ? dr.t : had;
    var score = (useDraft && dr.s) || this.score[cat] || 0;
    var step = Math.min(this.count() + (this.done[cat] ? 0 : 1), 7) + ' / 7';
    this.body.innerHTML = '<h2 class="pvrb-eb" id="pvrb-h">' + esc(T.head(airName(this.air, this.st))) + '</h2>'
      + this.tiles(cat)
      + '<div class="pvrb-item" id="pvrb-item">' + esc(label) + '</div>'
      + '<div class="pvrb-stars" role="radiogroup" aria-labelledby="pvrb-item">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<button type="button" class="pvrb-star' + (n <= score ? ' on' : '') + '" role="radio" aria-checked="' + (n === score) + '" data-s="' + n + '" aria-label="' + esc(T.star(n)) + '">★</button>';
      }).join('') + '</div>'
      + '<textarea class="pvrb-ta" dir="auto" maxlength="' + MAX + '" aria-labelledby="pvrb-item" placeholder="' + esc(T.place(label)) + '">' + esc(val) + '</textarea>'
      + (useDraft ? '<div class="pvrb-saved">' + esc(T.restored) + '</div>' : '')
      + '<div class="pvrb-cnt"><span>' + esc(T.time) + '</span><span class="pvrb-c"></span></div>'
      + '<div class="pvrb-warn" role="status" aria-live="polite"></div>'
      + '<div class="pvrb-go"><button type="button" class="pvrb-btn pvrb-send" disabled>' + esc(T.send) + '</button></div>'
      + this.foot(step, this.hist.length > 1, true);
    this.wireTiles();
    this.wireFoot(cat);
    var ta = this.body.querySelector('.pvrb-ta'), c = this.body.querySelector('.pvrb-c'),
        send = this.body.querySelector('.pvrb-send'), warn = this.body.querySelector('.pvrb-warn');
    this.cur = { score: score };
    var sync = function () {
      var n = len(ta.value);
      c.innerHTML = T.chars(n);
      send.disabled = !(n >= MIN && n <= MAX && self.cur.score);
    };
    Array.prototype.forEach.call(this.body.querySelectorAll('.pvrb-star'), function (b) {
      b.addEventListener('click', function () {
        self.cur.score = Number(b.getAttribute('data-s'));
        Array.prototype.forEach.call(self.body.querySelectorAll('.pvrb-star'), function (x) {
          var s = Number(x.getAttribute('data-s'));
          x.classList.toggle('on', s <= self.cur.score);
          x.setAttribute('aria-checked', String(s === self.cur.score));
        });
        draftPut(self.air, cat, ta.value, self.cur.score);
        warn.textContent = '';
        sync();
      });
    });
    var tm = 0;
    ta.addEventListener('input', function () {
      sync();
      warn.textContent = '';
      clearTimeout(tm);
      tm = setTimeout(function () { draftPut(self.air, cat, ta.value, self.cur.score); }, 300);
    });
    send.addEventListener('click', function () { self.send(cat, ta.value, warn, send); });
    sync();
    if (jump || this.hist.length > 1) ta.focus({ preventScroll: true });
    else if (!('ontouchstart' in w)) ta.focus({ preventScroll: true });
  };

  Board.prototype.send = function (cat, raw, warn, btn) {
    var self = this;
    var text = String(raw || '').trim();
    var n = len(text);
    if (!this.cur.score) { warn.textContent = T.err.star; return; }
    if (n < MIN) { warn.textContent = T.err.short; return; }
    if (n > MAX) { warn.textContent = T.err.long; return; }
    if (!assessReviewQuality(text).ok) { warn.textContent = T.err.quality; return; }
    var set = {};
    KEYS.forEach(function (k) { if (k !== cat && self.text[k]) set[k] = { comment: self.text[k] }; });
    set[cat] = { comment: text };
    if (!assessReviewSet(set).ok) { warn.textContent = T.err.copy; return; }
    btn.disabled = true;
    btn.textContent = T.sending;
    Promise.resolve()
      .then(function () {
        return self.rpc('submit_review_item', { p: { airline: self.air, position: self.pos, cat: cat, score: self.cur.score, comment: text } });
      })
      .then(function (r) {
        if (!r || r.ok !== true) {
          warn.textContent = (r && T.err[r.why]) || T.err.net;
          btn.textContent = T.send;
          btn.disabled = false;
          return;
        }
        self.changed = true;
        self.text[cat] = text;
        self.score[cat] = self.cur.score;
        (r.done || [cat]).forEach(function (k) { self.done[k] = true; });
        draftPut(self.air, cat, '', 0);
        skipPut(self.air, skipped(self.air).filter(function (k) { return k !== cat; }));
        gt('review_item_submit', { cat: cat, items: self.count() });
        if (r.full === true) {
          self.full = true;
          try {   // 鍵はサーバが決める。端末の印は飾り（ほかの書き手と同じく、PVUnlock が無くても遠い未来を書く）
            var until = (w.PVUnlock && typeof w.PVUnlock.reviewUntil === 'function') ? w.PVUnlock.reviewUntil() : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
            w.localStorage.setItem('pv_unlock_expiry', String(until));
          } catch (e) { /* 書けなくても次のページでサーバに聞き直す */ }
          self.all();
        } else {
          self.sent(cat);
        }
      })
      .catch(function (e) {
        var msg = String((e && (e.message || e.code)) || e || '');
        warn.textContent = /no-auth|JWT|401|42501|ログイン/.test(msg) ? T.err.login : T.err.net;
        btn.textContent = T.send;
        btn.disabled = false;
      });
  };

  // ── 送ったあと ────────────────────────────────────────────────
  Board.prototype.sent = function (cat) {
    var self = this;
    var label = T.label[cat];
    var left = 7 - this.count();
    var nx = this.nextCat(cat);
    this.body.innerHTML = '<h2 class="pvrb-done" id="pvrb-h">' + esc(T.sent(label)) + '</h2>'
      + this.tiles(null)
      + '<p class="pvrb-t">' + esc(T.sentT(label)) + '</p>'
      + '<div class="pvrb-btns"><a class="pvrb-btn pvrb-read" href="' + esc(voteURL(cat)) + '">' + esc(T.read(label)) + '</a>'
      + (nx ? '<button type="button" class="pvrb-btn pvrb-sec pvrb-more">' + esc(T.more) + '</button>' : '') + '</div>'
      + '<p class="pvrb-left">' + T.left(left) + '</p>'
      + this.foot(this.count() + ' / 7', true, false);
    this.wireTiles();
    this.wireFoot(null);
    this.readLink(cat);
    var more = this.body.querySelector('.pvrb-more');
    if (more) more.addEventListener('click', function () { self.show(nx); });
    (more || this.body.querySelector('.pvrb-read')).focus({ preventScroll: true });
  };
  Board.prototype.all = function () {
    var name = airName(this.air, this.st);
    this.body.innerHTML = '<h2 class="pvrb-done" id="pvrb-h">' + esc(T.allHead) + '</h2>'
      + this.tiles(null)
      + '<p class="pvrb-t">' + esc(T.allT) + '</p>'
      + '<p class="pvrb-s">' + esc(T.allS(name)) + '</p>'
      + '<div class="pvrb-btns"><a class="pvrb-btn pvrb-read" href="' + esc(voteURL('')) + '">' + esc(T.readAll) + '</a></div>'
      + '<div style="height:16px"></div>';
    this.readLink('');
    this.body.querySelector('.pvrb-read').focus({ preventScroll: true });
  };
  /* Vote の上で開いた板なら、ページを移らずにその項目で絞り込む（Vote が口を出しているときだけ） */
  Board.prototype.readLink = function (cat) {
    var self = this, a = this.body.querySelector('.pvrb-read');
    if (!a || !w.PVVote || typeof w.PVVote.showCat !== 'function') return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      self.close('read');
      w.PVVote.showCat(cat);
    });
  };

  Board.prototype.skip = function (cat) {
    if (cat && !this.done[cat]) {
      var sk = skipped(this.air).filter(function (k) { return k !== cat; });
      sk.push(cat);
      skipPut(this.air, sk);
    }
    var nx = this.nextCat(cat);
    if (!nx || nx === cat) { this.close('skip'); return; }
    this.show(nx);
  };
  Board.prototype.back1 = function () {
    if (this.hist.length && this.hist[this.hist.length - 1] === this.cat && this.body.querySelector('.pvrb-ta')) this.hist.pop();
    var prev = this.hist[this.hist.length - 1];
    if (!prev) return;
    this.hist.pop();
    this.show(prev, true);
  };

  // ════════════════════════════════════════════════════════════════
  // 入口
  // ════════════════════════════════════════════════════════════════
  function rpcOf(o) {
    if (o && typeof o.rpc === 'function') return o.rpc;
    if (w.PVSession && typeof w.PVSession.rpc === 'function') return function (n, a) { return w.PVSession.rpc(n, a, true); };
    return null;
  }
  function start(o, manual) {
    var rpc = rpcOf(o);
    var no = function (why, next) { return { shown: false, why: why, next_at: next || null }; };
    if (!rpc) return Promise.resolve(no('fail'));
    if (busy()) return Promise.resolve(no('busy'));
    var st;
    return Promise.resolve()
      .then(function () { return rpc('pv_review_board', { p: manual ? { manual: true } : {} }); })
      .then(function (r) {
        st = r;
        if (!st || st.due !== true) return null;
        return Promise.resolve(rpc('pv_reviews', { p: { mine: true, limit: 20 } })).catch(function () { return null; });
      })
      .then(function (m) {
        if (!st || st.due !== true) return no((st && st.why) || 'fail', st && st.next_at);
        if (busy()) return no('busy');
        var b = new Board(rpc, st, (m && m.rows) || [], o);
        b.mount();
        if (!b.air || !b.pos) b.pick();
        else b.show(o && o.cat && !b.done[o.cat] ? o.cat : b.nextCat());
        if (manual) return { shown: true };
        return Promise.resolve(rpc('pv_review_board_seen', {}))
          .then(function (s) { return { shown: true, next_at: (s && s.next_at) || null }; })
          .catch(function () { return { shown: true }; });
      })
      .catch(function () { return no('fail'); });
  }

  w.PVReviewBoard = {
    /* 7日に1回の板（pv-session.js が呼ぶ）。{ shown, why, next_at } を返す。 */
    askReturn: function (o) { return start(o || {}, false); },
    /* 会員が自分で押して開く板（Vote）。o = { cat, onChange, from }。 */
    open: function (o) { return start(o || {}, true); },
    labels: function () { return T.label; },
    KEYS: KEYS
  };
})(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null);
