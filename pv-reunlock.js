/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-reunlock.js  v1.1
   「この人が出したもの」を proof_hash から引き当てる（クロスデバイス対応）

   背景:
     口コミは匿名テーブル reviews_v2 に proof_hash = SHA-256(
       userId + "::pv_anon::" + airline + "::2026"
     ) で入り、user_id を持たない設計。よって「この人の全口コミ」を
     直接引けない。旧来 login.html / auth-callback.html は旧 reviews.user_id
     を見ていたため、新フローの貢献者が別端末で再解放されなかった（バグ）。

   方針:
     投稿可能な全社コード（airline-codes.json ＝ SSOT salary-data.mjs から生成）
     ＋ 廃止済みの旧コードの proof_hash を計算し、分割した .in() で reviews_v2
     を照合。1件でもヒットすれば「投稿済み」とみなし全解放を復活（期限なし）。
     匿名設計は一切壊さない。

   ★v1.1: 同じ総当たりの結果を捨てずに返すようにした。
     以前は .limit(1) で「1件でもあるか」だけを見て行を捨てていたため、
     マイページは「投稿した口コミ」を常にゼロ件で固定するしかなく、
     投稿した本人に「投稿した口コミはありません」と出ていた
     （解放中バッジと同時に出るので「紐づかなかった」と読める）。
     行そのものを返せば、user_id を1列も増やさずに一覧が作れる。
     給与側は db/pay-reports.sql の my_pay_reports() が同じことをサーバでやっている。

   使い方: <script src="pv-reunlock.js"></script> を supabase-js の後に読み込み、
     ログイン成功後に  await pvCheckReunlock(sb, userId)  を呼ぶ。
     マイページはそのあと pvFindMyReviews / pvMyPayReports を呼ぶ（キャッシュが
     効くので通信は増えない）。
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';


  // fetch 失敗時のフォールバック（airline-codes.json と同一・投稿可能セット）
  // ★ここは手で書かない。node gen-airline-codes.mjs が SSOT から書き換える。
  var FALLBACK_CODES = /*BEGIN:CODES*/['ana','jal','zipair','jetstar-japan','peach','solaseed','spring-japan','airdo','starflyer','skymark','fda','emirates','qantas','cathay-pacific','singapore-airlines','etihad','qatar-airways','korean-air','asiana','starlux','china-airlines','thai-airways','eva-air','united','delta','american','southwest','klm','air-france','lufthansa','air-canada','british-airways','airjapan','amx','ana-wings','daiichi-air','hac','ibex','j-air','jac','jta','orc','rac','shin-central','shin-nihon','toho-air','toki-air','air-china','china-eastern','china-southern','hainan-airlines','airx-charter','eagle-jet','root-aviation','solairus','air-india','airasia','bamboo-airways','batik-air','garuda-indonesia','hong-kong-express','indigo','malaysia-airlines','philippine-airlines','scoot','vietjet','vietnam-airlines','egyptair','ethiopian-airlines','gulf-air','kenya-airways','kuwait-airways','oman-air','riyadh-air','royal-brunei','royal-jordanian','saudia','south-african-airways','turkish-airlines','aegean','aer-lingus','austrian','easyjet','eurowings','finnair','iberia','icelandair','ita-airways','lot','norwegian','ryanair','sas','swiss','tap','virgin-atlantic','vueling','wizz-air','aeromexico','air-new-zealand','alaska-airlines','allegiant','avianca','breeze-airways','copa-airlines','fiji-airways','frontier','jetblue','jetstar','latam','porter','spirit','westjet','other']/*END:CODES*/;

  // 会社リストを 35→110 社に張り替えた際に消えた旧コード。
  // proof_hash は「コード文字列」から作るので、旧コードで投稿した人の
  // ハッシュは旧コードでしか再現できない。ここを落とすと、既存の貢献者が
  // 別端末でログインしても再解放されなくなる（＝最も失いたくない人が離れる）。
  // 新旧で意味が変わった 'jetstar'（旧=ジェットスター・ジャパン／
  // 新=Jetstar Airways）は新リストに同じ文字列で残るため、ここには要らない。
  var LEGACY_CODES = ['spring','qatar','singapore','cathay','alaska','british','turkish','asiana'];

  // PostgREST の .in() はクエリ文字列に展開される。64桁のハッシュ×119件で
  // 約 8KB になり、よくある URL 長の上限に触れる。分割して投げる。
  var CHUNK = 40;

  // 同じログインの中で何度も総当たりしない。マイページは pvCheckReunlock の
  // 直後に一覧を出すので、ここが無いと同じ問い合わせを2回投げることになる。
  var cache = { userId: null, reviews: null, pay: null };
  function resetCache(userId) {
    if (cache.userId !== userId) cache = { userId: userId, reviews: null, pay: null };
  }

  function setUnlock() {
    // 口コミ枠だけ。口コミフォームは金額を集めないので、口コミ＝給与提供ではない。
    // 給与枠は下の restoreSalaryUnlock() がサーバの access_until から復活させる。
    // 口コミの鍵は時間で切れない（pv-session.js の PVUnlock が正）。
    var until = (window.PVUnlock && window.PVUnlock.reviewUntil)
      ? window.PVUnlock.reviewUntil()
      : Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;   // 読み込み順が崩れたときの保険
    try {
      localStorage.setItem("pv_unlock_expiry", String(until));
    } catch (e) {}
  }

  /**
   * 本人の給与レポート（db/pay-reports.sql の my_pay_reports）。
   * 返すのは RPC の戻り値そのまま: { ok, reports[], report_count, access_until, ... }
   * ★ RPC は1回しか叩かない。解放の復活とマイページの一覧が同じ結果を使う。
   */
  window.pvMyPayReports = async function (sb, userId) {
    if (!sb) return null;
    resetCache(userId || cache.userId);
    if (cache.pay !== null) return cache.pay;
    try {
      var res = await sb.rpc("my_pay_reports");
      cache.pay = (res && res.data) || null;
    } catch (e) {
      cache.pay = null;
    }
    return cache.pay;
  };

  // 給与枠のクロスデバイス復活。給与明細を出すと submit_pay_report が
  // profiles.access_until を90日先へ延ばす（db/pay-reports.sql:719-721）。
  // localStorage は端末ごとなので、これが無いと別の端末で締め出される。
  async function restoreSalaryUnlock(sb, userId) {
    var d = await window.pvMyPayReports(sb, userId);
    var until = d && d.access_until ? Date.parse(d.access_until) : 0;
    if (!(until > Date.now())) return false;
    try { localStorage.setItem("pv_salary_unlock_expiry", String(until)); } catch (e) {}
    return true;
  }

  // SHA-256 proof hash（premium-auth-lock.js:123-130 と同一ロジックを一般化）
  function proofHash(userId, code) {
    var data = new TextEncoder().encode(userId + "::pv_anon::" + code + "::2026");
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  function loadCodes() {
    // ルート相対（login.html / auth-callback.html はルート配置）
    return fetch("airline-codes.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (Array.isArray(j) && j.length) ? j : FALLBACK_CODES; })
      .catch(function () { return FALLBACK_CODES; });
  }

  // 投稿しうる全コードぶんの proof_hash。重複コードは1つに畳む。
  async function buildHashes(userId) {
    var codes = (await loadCodes()).concat(LEGACY_CODES);
    var seen = {}, uniq = [];
    for (var i = 0; i < codes.length; i++) {
      if (!seen[codes[i]]) { seen[codes[i]] = 1; uniq.push(codes[i]); }
    }
    return Promise.all(uniq.map(function (c) { return proofHash(userId, c); }));
  }

  // 一覧に出すのに要る列。語彙は community.html の V2_COLS と揃える
  // （社名と日付、それに7カテゴリのコメント。金額列は新しい投稿では書かれない）。
  var COLS = "id,airline,created_at,culture_comment,salary_comment,benefits_comment," +
             "wlb_comment,ops_comment,training_comment,mgmt_comment";

  /**
   * 本人の口コミを全部返す。user_id は使わない（列が無い）。
   *   opts.extraCols … 追加で欲しい列（例: PVReviewI18n.EXTRA_COLS）。
   *     まだ列が無い環境では自動で外して引き直すので、口コミは消えない
   *     （review-i18n.js の fetchWithFallback と同じ考え方）。
   * ★ 戻り値は [] と null を分ける。[] ＝本当に1件も無い、null ＝引けなかった。
   *   一緒にすると、通信や権限で失敗しただけの人に「まだ投稿していません」と
   *   言い切ることになる（＝出したのに出していないことにされる）。
   * @returns {Promise<Array|null>} created_at の新しい順。引けなければ null
   */
  window.pvFindMyReviews = async function (sb, userId, opts) {
    if (!sb || !userId) return null;
    resetCache(userId);
    var extra = (opts && opts.extraCols) || "";
    // キャッシュは「追加列つきで取れたもの」だけ再利用する。extra を後から
    // 足したくなったときに、列の足りない結果を返してしまわないようにする。
    if (cache.reviews && cache.reviews.extra === extra) return cache.reviews.rows;

    try {
      var hashes = await buildHashes(userId);

      // PostgREST の .in() はクエリ文字列に展開される。64桁のハッシュ×119件で
      // 約 8KB になり、よくある URL 長の上限に触れる。分割して投げる。
      var chunks = [];
      for (var j = 0; j < hashes.length; j += CHUNK) chunks.push(hashes.slice(j, j + CHUNK));

      var get = function (part, cols) {
        return sb.from("reviews_v2").select(cols).in("proof_hash", part);
      };
      var results = await Promise.all(chunks.map(function (part) {
        return get(part, COLS + extra).then(function (r) {
          // 42703 ＝「その列は無い」だけを追加列の不在とみなす。どんなエラーでも
          // 落とすと、RLS 拒否などを列の問題と取り違えて黙って引き直してしまう
          // （review-i18n.js の fetchWithFallback と同じ判定にする）。
          if (r && r.error && extra && String(r.error.code) === "42703") return get(part, COLS);
          return r;
        });
      }));

      // 1つでも失敗した塊があれば「0件」と言わない。119社ぶんを3回に分けて
      // 投げているので、2つ取れて1つ落ちた形はふつうに起きる。
      var rows = [];
      for (var k = 0; k < results.length; k++) {
        var r2 = results[k];
        if (!r2 || r2.error) return null;
        if (r2.data && r2.data.length) rows = rows.concat(r2.data);
      }
      rows.sort(function (a, b) {
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
      cache.reviews = { extra: extra, rows: rows };
      return rows;
    } catch (e) {
      return null;
    }
  };

  /**
   * ログイン済みユーザの解放を復活させる。
   *   過去の口コミがあれば口コミ枠を期限なしで／給与明細があれば給与枠を access_until まで。
   * @returns {Promise<boolean>} どちらか1つでも復活したら true
   */
  window.pvCheckReunlock = async function (sb, userId) {
    if (!sb || !userId) return false;

    var salary = await restoreSalaryUnlock(sb, userId);

    // 匿名 reviews_v2 を proof_hash 群で照合（旧 reviews テーブルは廃止済み）
    // ★引けなかった（null）ときは解放を消さない。読めなかっただけで
    //   締め出さないため、判定は「1件でも取れたか」だけで行う。
    var reviews = await window.pvFindMyReviews(sb, userId);
    if (reviews && reviews.length > 0) { setUnlock(); return true; }

    return salary;
  };
})();
