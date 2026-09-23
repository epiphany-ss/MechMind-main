/* ============================================================
   平台积分 / 等级 共享层（MMScore）
   ------------------------------------------------------------
   本文件是从 activity.html 里【原样搬出】的纯函数，供「力学游乐园」复用。
   口径与 activity.html 完全一致，没有做任何逻辑改动 —— 复制而非重构，
   是为了不动 activity.html / personal_knowledge.html 这两个已在跑的页面。

   来源对照（activity.html）：
     CAPS / LEVELS .................... 164-172
     computeStats ..................... 395-411
     scoreFromTotals / computeScore /
     levelForScore / escHtml ........... 414-428
     等级配色 CSS .lv-* ................ 54-59（已一并写进 css/arcade.css）

   用法：
     <script src="js/score.js"></script>
     MMScore.levelForScore(58)      -> { name:'进阶', color:'yellow', ... }
     MMScore.computeStats(activity)  -> { loginDays, qDays, aiDays, totalQ, ... }
   ============================================================ */
(function (root) {
  'use strict';

  var CAPS = { questions: 200, loginDays: 160, aiDays: 150, aiCount: 750 };

  var LEVELS = [
    { name: '初学', color: 'cyan',   hex: '#06b6d4', min: 0 },
    { name: '入门', color: 'green',  hex: '#22c55e', min: 20 },
    { name: '进阶', color: 'yellow', hex: '#eab308', min: 40 },
    { name: '熟练', color: 'orange', hex: '#f97316', min: 60 },
    { name: '精通', color: 'brown',  hex: '#b45309', min: 75 },
    { name: '大师', color: 'red',    hex: '#b91c1c', min: 90 }
  ];

  function computeStats(d) {
    var loginDays = [], qDays = [], aiDays = [], totalQ = 0, totalAi = 0, totalAiCount = 0;
    var qSet = {}, qSum = 0;
    Object.keys(d).sort().forEach(function (date) {
      var r = d[date];
      if (r.login) loginDays.push(date);
      if (r.questions > 0) { qSum += r.questions; qDays.push({ date: date, count: r.questions }); }
      // 做题总数 = 完成学习的「不同」题目数（跨天去重；同一题每天只记一次）
      (r.q_list || []).forEach(function (qid) { qSet[qid] = true; });
      if (r.ai_count > 0) totalAiCount += r.ai_count;
      if ((r.ai_minutes > 0) || (r.ai_count > 0)) { totalAi += (r.ai_minutes || 0); aiDays.push({ date: date, min: (r.ai_minutes || 0), count: (r.ai_count || 0) }); }
    });
    totalQ = Object.keys(qSet).length > 0 ? Object.keys(qSet).length : qSum;
    loginDays.sort(function (a, b) { return a < b ? 1 : -1; });
    qDays.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    aiDays.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return { loginDays: loginDays, qDays: qDays, aiDays: aiDays, totalQ: totalQ, totalAi: totalAi, totalAiCount: totalAiCount };
  }

  function scoreFromTotals(totalQ, loginDays, aiDays, aiCount) {
    var q = Math.min(100, totalQ / CAPS.questions * 100);
    var l = Math.min(100, loginDays / CAPS.loginDays * 100);
    var ad = Math.min(100, aiDays / CAPS.aiDays * 100);
    var ac = Math.min(100, aiCount / CAPS.aiCount * 100);
    var ai = 0.3 * ad + 0.7 * ac;
    return Math.round((0.6 * q + 0.3 * ai + 0.1 * l) * 10) / 10;
  }

  function computeScore(s) { return scoreFromTotals(s.totalQ, s.loginDays.length, s.aiDays.length, s.totalAiCount); }

  function levelForScore(score) {
    var lv = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) { if (score >= LEVELS[i].min) lv = LEVELS[i]; }
    return lv;
  }

  function escHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // 距离下一档还差多少分；已是最高档返回 null
  function nextLevel(score) {
    for (var i = 0; i < LEVELS.length; i++) {
      if (score < LEVELS[i].min) return { level: LEVELS[i], need: Math.round((LEVELS[i].min - score) * 10) / 10 };
    }
    return null;
  }

  function stripHtmlBasic(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
  }

  // 拉取活跃流水（与 activity.html 同源相对路径；file:// 下由 mmApi 兜底）
  function loadActivity(sid) {
    var base = (typeof root.mmApi === 'function') ? root.mmApi('/api/activity?id=') : '/api/activity?id=';
    return fetch(base + encodeURIComponent(sid) + '&_=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { return (j && j.ok) ? (j.activity || {}) : null; })
      .catch(function () { return null; });   // 服务器不可用时不报错，交给调用方降级
  }

  root.MMScore = {
    CAPS: CAPS,
    LEVELS: LEVELS,
    computeStats: computeStats,
    scoreFromTotals: scoreFromTotals,
    computeScore: computeScore,
    levelForScore: levelForScore,
    nextLevel: nextLevel,
    escHtml: escHtml,
    stripHtmlBasic: stripHtmlBasic,
    loadActivity: loadActivity
  };
})(window);
