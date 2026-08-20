/* ════════════════════════════════════════════════════════════════
   PILOT VALUE — pv-reunlock.js  v1.0
   ログイン / OAuthコールバック時の「再解放」判定（クロスデバイス対応）

   背景:
     口コミは匿名テーブル reviews_v2 に proof_hash = SHA-256(
       userId + '::pv_anon::' + airline + '::2026'
     ) で入り、user_id を持たない設計。よって「この人の全口コミ」を
     直接引けない。旧来 login.html / auth-callback.html は旧 reviews.user_id
     を見ていたため、新フローの貢献者が別端末で再解放されなかった（バグ）。

   方針:
     投稿可能な全社コード（airline-codes.json ＝ SSOT salary-data.mjs から生成）
     ＋ 廃止済みの旧コードの proof_hash を計算し、分割した .in() で reviews_v2
     を照合。1件でもヒットすれば「投稿済み」とみなし 30日間の全解放を復活。
     匿名設計は一切壊さない。

   使い方: <script src="pv-reunlock.js"></script> を supabase-js の後に読み込み、
     ログイン成功後に  await pvCheckReunlock(sb, userId)  を呼ぶ。
════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var UNLOCK_MS = 30 * 24 * 60 * 60 * 1000; // 30 days（premium-auth-lock.js と同一）

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

  function setUnlock() {
    // 口コミ枠だけ。口コミフォームは金額を集めないので、口コミ＝給与提供ではない。
    // 給与枠は下の restoreSalaryUnlock() がサーバの access_until から復活させる。
    try {
      localStorage.setItem('pv_unlock_expiry', String(Date.now() + UNLOCK_MS));
    } catch (e) {}
  }

  // 給与枠のクロスデバイス復活。給与明細を出すと submit_pay_report が
  // profiles.access_until を90日先へ延ばす（db/pay-reports.sql:719-721）。
  // localStorage は端末ごとなので、これが無いと別の端末で締め出される。
  async function restoreSalaryUnlock(sb) {
    try {
      var res = await sb.rpc('my_pay_reports');
      var until = res && res.data && res.data.access_until ? Date.parse(res.data.access_until) : 0;
      if (!(until > Date.now())) return false;
      try { localStorage.setItem('pv_salary_unlock_expiry', String(until)); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  // SHA-256 proof hash（premium-auth-lock.js:123-130 と同一ロジックを一般化）
  function proofHash(userId, code) {
    var data = new TextEncoder().encode(userId + '::pv_anon::' + code + '::2026');
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
    });
  }

  function loadCodes() {
    // ルート相対（login.html / auth-callback.html はルート配置）
    return fetch('airline-codes.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (Array.isArray(j) && j.length) ? j : FALLBACK_CODES; })
      .catch(function () { return FALLBACK_CODES; });
  }

  /**
   * ログイン済みユーザの解放を復活させる。
   *   過去の口コミがあれば口コミ枠を30日／給与明細があれば給与枠を access_until まで。
   * @returns {Promise<boolean>} どちらか1つでも復活したら true
   */
  window.pvCheckReunlock = async function (sb, userId) {
    if (!sb || !userId) return false;

    var salary = await restoreSalaryUnlock(sb);

    // 匿名 reviews_v2 を proof_hash 群で照合（旧 reviews テーブルは廃止済み）
    try {
      var codes = (await loadCodes()).concat(LEGACY_CODES);
      var seen = {}, uniq = [];
      for (var i = 0; i < codes.length; i++) {
        if (!seen[codes[i]]) { seen[codes[i]] = 1; uniq.push(codes[i]); }
      }
      var hashes = await Promise.all(uniq.map(function (c) { return proofHash(userId, c); }));

      var chunks = [];
      for (var j = 0; j < hashes.length; j += CHUNK) chunks.push(hashes.slice(j, j + CHUNK));

      var results = await Promise.all(chunks.map(function (part) {
        return sb.from('reviews_v2').select('proof_hash').in('proof_hash', part).limit(1);
      }));
      for (var k = 0; k < results.length; k++) {
        var r2 = results[k];
        if (r2 && r2.data && r2.data.length > 0) { setUnlock(); return true; }
      }
    } catch (e) {}

    return salary;
  };
})();
