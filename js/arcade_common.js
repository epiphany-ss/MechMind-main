/* ============================================================
   力学游乐园 · 共享层（Arcade）
   ------------------------------------------------------------
   六个玩法（猜机构 / 解析捉虫 / 矢量竞速 / 闯关地图 / 力学沙盒 / 时空对话）
   共用这里的东西：等级条、计分、存档、题目池、Toast。

   ⚠️ 两个关键设计决定，改动前务必先读：

   1) 【不引 js/auth.js】—— auth.js 第 125 行会把未登录用户
      location.replace 到 account.html。游乐园是「全开放免登录」，
      引了它就直接跳走。所以这里自己读 localStorage 取 uid，不做任何跳转。

   2) 【不写 /api/activity/record】—— 平台等级分（activity.html）按
      「做题数 / 登录天数 / AI 使用量」三项固定口径加权，游乐园成绩灌进去
      会污染它。所以游乐园独立计分、独立存档（键名 arcade_*）。

   依赖：js/score.js（MMScore）、js/user-store.js（UserStore，可选）
        js/data.js（QBANK_SEED，只有当用到题目池的玩法才需要）
   ============================================================ */
(function (root) {
  'use strict';

  /* ==================== 用户身份（不跳转） ==================== */

  function currentUser() {
    try { return JSON.parse(localStorage.getItem('current_user') || 'null'); } catch (e) { return null; }
  }
  // 与 personal_knowledge.html:1909 的 getQaAccountId() 同口径
  function uid() {
    var u = currentUser();
    return (u && (u.id || u.student_id)) || 'anonymous';
  }
  // 平台活跃流水用的键是「学号」，不是 id
  function studentId() {
    var u = currentUser();
    return (u && u.student_id) || null;
  }
  function isLoggedIn() { return uid() !== 'anonymous'; }

  /* ==================== 存档 ==================== */
  // 登录态：UserStore 双写（本机 + /api/userdata/<uid>）；匿名：只写本机。
  // 匿名不写服务端，免得凭空造出 pdata/userdata_anonymous.json。
  var US = null;
  function initStore() {
    if (isLoggedIn() && root.UserStore && typeof root.UserStore.init === 'function') {
      try { root.UserStore.init(uid(), { keys: ['arcade_progress'] }); US = root.UserStore; } catch (e) { US = null; }
    }
  }
  // 键名约定：调用方传进来的键**本身就带 arcade_ 前缀**（如 'arcade_progress'），
  // 这里不再重复加前缀 —— 早先版本加过一次，结果落成 arcade_arcade_progress。
  // 同一批键也直接用作 UserStore 的键，所以服务端 pdata/userdata_<uid>.json 里
  // 看到的也是 arcade_ 开头，一眼能认出是游乐园的。
  function lsGet(key) {
    try { var raw = localStorage.getItem(key); return raw === null ? undefined : JSON.parse(raw); } catch (e) { return undefined; }
  }
  function lsSet(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  }
  function storeGet(key, fallback) {
    if (US) { try { var v = US.get(key, undefined); if (v !== undefined && v !== null) return v; } catch (e) {} }
    var local = lsGet(key);
    return local === undefined ? fallback : local;
  }
  function storeSet(key, value) {
    lsSet(key, value);
    if (US) { try { US.set(key, value); } catch (e) {} }
  }

  /* ==================== 进度模型 ==================== */

  var BLANK = {
    totalScore: 0,
    games: {
      guess:  { plays: 0, best: 0, correct: 0, total: 0, bestStreak: 0 },
      bug:    { plays: 0, best: 0, correct: 0, total: 0, bestStreak: 0 },
      vector: { plays: 0, best: 0, correct: 0, total: 0, bestStreak: 0 },
      // quest/sandbox/talk 也要带标准计数器：recordGame 对 undefined 自增会写出 NaN，
      // 落档变 null（实测抓到过），arcade.html 的进度行虽然不读它们，但脏数据不该入库
      quest:  { stars: {}, cleared: {}, done: [], plays: 0, best: 0, correct: 0, total: 0 },
      sandbox:{ tasks: {}, plays: 0, best: 0, correct: 0, total: 0 },
      talk:   { met: [], plays: 0, best: 0, correct: 0, total: 0 }
    },
    updated: ''
  };

  function progress() {
    var p = storeGet('arcade_progress', null);
    if (!p || typeof p !== 'object') return JSON.parse(JSON.stringify(BLANK));
    // 补齐缺失字段，避免旧存档缺键时崩（旧存档可能只有整卡缺失，也可能缺卡内新字段）
    p.totalScore = p.totalScore || 0;
    p.games = p.games || {};
    Object.keys(BLANK.games).forEach(function (g) {
      if (!p.games[g]) {
        p.games[g] = JSON.parse(JSON.stringify(BLANK.games[g]));
      } else {
        var b = BLANK.games[g];
        Object.keys(b).forEach(function (k) {
          if (p.games[g][k] === undefined) p.games[g][k] = JSON.parse(JSON.stringify(b[k]));
        });
      }
    });
    return p;
  }
  function saveProgress(p) {
    p.updated = today();
    storeSet('arcade_progress', p);
    return p;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // 一局结束后调用。返回 { gained, tierUp, tier }
  function recordGame(game, res) {
    var p = progress();
    var g = p.games[game];
    res = res || {};
    var gained = res.score || 0;

    g.plays++;
    g.correct += (res.correct || 0);
    g.total += (res.total || 0);
    if (gained > (g.best || 0)) g.best = gained;
    if ((res.streak || 0) > (g.bestStreak || 0)) g.bestStreak = res.streak;

    var before = tierForScore(p.totalScore);
    p.totalScore += gained;
    var after = tierForScore(p.totalScore);
    saveProgress(p);

    return { gained: gained, tier: after, tierUp: after.name !== before.name ? after : null };
  }

  // 存档里记一笔「这题游乐园做过了」（闯关/捉虫去重用；不依赖 adata 的 q_list）
  function markDone(qids) {
    var p = progress();
    var done = p.games.quest.done || [];
    var set = {};
    done.forEach(function (q) { set[q] = true; });
    (qids || []).forEach(function (q) { if (!set[q]) { set[q] = true; done.push(q); } });
    p.games.quest.done = done.slice(-3000);
    saveProgress(p);
  }
  function doneSet() {
    var set = {};
    (progress().games.quest.done || []).forEach(function (q) { set[q] = true; });
    return set;
  }

  /* ==================== 游乐园段位（独立于平台等级） ==================== */
  // 刻意与平台等级（初学→大师）区分开，避免两套数字被看混
  var TIERS = [
    { name: '见习力学家', min: 0,    icon: 'star', hex: '#06b6d4' },
    { name: '力学学徒',   min: 300,  icon: 'scroll', hex: '#22c55e' },
    { name: '机构拆解者', min: 800,  icon: 'gear', hex: '#eab308' },
    { name: '矢量猎手',   min: 1500, icon: 'target', hex: '#f97316' },
    { name: '力学游侠',   min: 2500, icon: 'sword', hex: '#b45309' },
    { name: '力学家',     min: 4000, icon: 'trophy', hex: '#b91c1c' }
  ];
  function tierForScore(s) {
    var t = TIERS[0];
    for (var i = 0; i < TIERS.length; i++) { if (s >= TIERS[i].min) t = TIERS[i]; }
    return t;
  }
  function nextTier(s) {
    for (var i = 0; i < TIERS.length; i++) { if (s < TIERS[i].min) return TIERS[i]; }
    return null;
  }

  /* ==================== 等级条（游乐园段位 + 平台等级只读） ==================== */

  function levelBarHTML() {
    var p = progress();
    var t = tierForScore(p.totalScore);
    var nt = nextTier(p.totalScore);
    var span = nt ? (nt.min - t.min) : 1;
    var into = nt ? (p.totalScore - t.min) : 1;
    var pct = nt ? Math.max(0, Math.min(100, Math.round(into / span * 100))) : 100;

    var nextTxt = nt
      ? ('距「' + nt.name + '」还差 ' + (nt.min - p.totalScore) + ' 分')
      : '已达最高段位';

    return '' +
      '<div class="ac-levelbar">' +
        '<div class="ac-tier" style="--tc:' + t.hex + '">' +
          '<span class="ac-tier-icon">' + (root.PxlIcons ? root.PxlIcons.img(t.icon, 22) : '') + '</span>' +
          '<span class="ac-tier-name">' + t.name + '</span>' +
        '</div>' +
        '<div class="ac-bar-wrap">' +
          '<div class="ac-bar"><i style="width:' + pct + '%;background:' + t.hex + '"></i></div>' +
          '<div class="ac-bar-meta"><span>' + p.totalScore + ' 分</span><span id="acNextTier">' + nextTxt + '</span></div>' +
        '</div>' +
        '<div class="ac-platform" id="acPlatform"><span class="ac-plat-label">平台等级</span><span class="ac-plat-val">读取中…</span></div>' +
      '</div>';
  }

  // 平台等级：只读展示，绝不写回
  function mountPlatformLevel() {
    var el = document.getElementById('acPlatform');
    if (!el) return;
    if (!root.MMScore) { el.querySelector('.ac-plat-val').textContent = '—'; return; }
    var sid = studentId();
    if (!sid) { el.querySelector('.ac-plat-val').textContent = '登录后显示'; return; }

    var local = null;
    try { local = JSON.parse(localStorage.getItem('user_activity_' + sid) || 'null'); } catch (e) {}

    function show(act) {
      if (!act || !Object.keys(act).length) {
        el.querySelector('.ac-plat-val').textContent = '暂无记录';
        return;
      }
      var s = root.MMScore.computeStats(act);
      var score = root.MMScore.computeScore(s);
      var lv = root.MMScore.levelForScore(score);
      el.querySelector('.ac-plat-val').innerHTML =
        '<b style="color:' + lv.hex + '">' + lv.name + '</b> <span class="ac-plat-score">' + score + ' 分</span>';
    }

    if (local && Object.keys(local).length) show(local);   // 先用本机数据秒显，避免闪烁
    root.MMScore.loadActivity(sid).then(function (act) { if (act) show(act); });
  }

  function mountLevelBar(el) {
    if (!el) return;
    el.innerHTML = levelBarHTML();
    mountPlatformLevel();
  }

  /* ==================== Toast ==================== */

  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById('acToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'acToast';
      el.className = 'ac-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'ac-toast ' + (type || '') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'ac-toast'; }, 2600);
  }

  /* ==================== 题目池 ==================== */
  // 数据源：js/data.js 的 window.QBANK_SEED（596 题，含 content/answer/explanation，离线可用）
  // 按计划必须过滤的脏数据，见下面的 buildPool()。

  var _pool = null;

  function seedQuestions() {
    var s = root.QBANK_SEED;
    if (s && s.questions && s.questions.length) return s.questions;
    return null;
  }

  function hasImg(q) { return /<img/i.test(q.content || ''); }

  // 选择题的选项内嵌在 content 里，形如 "(A) …；(B) …"
  function parseChoices(html) {
    var opts = [];
    var re = /\(([A-H])\)\s*([^；;<]*)/g, m;
    while ((m = re.exec(html)) !== null) {
      var txt = m[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (txt) opts.push({ key: m[1], text: txt });
    }
    return opts;
  }

  function buildPool() {
    var qs = seedQuestions();
    if (!qs) return null;
    var S = root.MMScore;
    var strip = (S && S.stripHtmlBasic) ? S.stripHtmlBasic : function (x) { return String(x || '').replace(/<[^>]*>/g, ' ').trim(); };

    var clean = [], judge = [], choice = [];
    var byCat = {}, byKp = {};

    qs.forEach(function (q) {
      if (hasImg(q)) return;                       // 跨页 <img> 会 404，一律剔除
      var text = strip(q.content);
      if (!text) return;
      var ans = strip(q.answer);
      var exp = q.explanation || '';
      var item = {
        id: q.id, category: q.category, kp: q.knowledge_points || [],
        type: q.question_type, diff: q.difficulty,
        text: text, ans: ans, exp: exp, expText: strip(exp)
      };
      clean.push(item);
      (byCat[q.category] = byCat[q.category] || []).push(item);
      (q.knowledge_points || []).forEach(function (k) { (byKp[k] = byKp[k] || []).push(item); });

      // 判断题：answer 必须是纯「对/错」。150 道里有 2 道是长句，必须白名单过滤
      if (q.question_type === '判断题' && /^(对|错)$/.test(ans.trim())) judge.push(item);

      // 选择题：answer 是单个字母，且 content 里能正则出 >=4 个选项。
      // 114 道里 19 道答案不规范（多选、图文多问），用双条件挡掉
      if (q.question_type === '选择题' && /^[A-H]$/.test(ans.trim())) {
        var opts = parseChoices(q.content || '');
        if (opts.length >= 4) { item.opts = opts.slice(0, 6); choice.push(item); }
      }
    });

    return {
      all: clean, judge: judge, choice: choice,
      byCat: byCat, byKp: byKp,
      cats: Object.keys(byCat).sort(function (a, b) { return byCat[b].length - byCat[a].length; })
    };
  }

  function pool() { if (!_pool) _pool = buildPool(); return _pool; }

  // 知识点候选池：题量太少的（如「约束分类」只有 2 题）凑不出 4 个干扰项，需设阈值
  function kpPool(minCount) {
    var p = pool(); if (!p) return [];
    minCount = minCount || 5;
    return Object.keys(p.byKp).filter(function (k) { return p.byKp[k].length >= minCount; });
  }

  /* ==================== 小工具 ==================== */

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  function esc(s) { return root.MMScore ? root.MMScore.escHtml(s) : String(s == null ? '' : s); }

  // 题干/解析里可能有 $...$，有 KaTeX 就渲染，没有就原样显示（不能报错）
  function renderMath(el) {
    if (!el || typeof root.renderMathInElement !== 'function') return;
    try {
      root.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    } catch (e) {}
  }

  /* ==================== 对外 ==================== */

  // 登录态变化时（另一个标签页登录/登出）重新初始化一次存档
  window.addEventListener('storage', function (e) {
    if (e.key === 'current_user') initStore();
  });

  root.Arcade = {
    uid: uid, studentId: studentId, isLoggedIn: isLoggedIn, currentUser: currentUser,
    initStore: initStore, progress: progress, saveProgress: saveProgress,
    recordGame: recordGame, markDone: markDone, doneSet: doneSet,
    TIERS: TIERS, tierForScore: tierForScore, nextTier: nextTier,
    levelBarHTML: levelBarHTML, mountLevelBar: mountLevelBar, mountPlatformLevel: mountPlatformLevel,
    toast: toast,
    pool: pool, kpPool: kpPool, seedQuestions: seedQuestions,
    shuffle: shuffle, pick: pick, sample: sample, esc: esc, renderMath: renderMath,
    today: today
  };

  initStore();
})(window);
