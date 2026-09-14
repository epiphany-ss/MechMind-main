/* ============================================================
   登录闸门（auth.js）
   ------------------------------------------------------------
   作用：主平台所有页面必须登录/注册后才能使用。
   - 已登录（localStorage.current_user 有效）→ 放行
   - 未登录 → 跳转到 account.html?redirect=原页面
   - account.html 本身是登录页，不拦截
   - 兼容两种打开方式：服务器模式(http://localhost:8080)
     与本地文件模式(file:// 双击/启动平台.bat)
   - 题库页面(8090 端口)是独立应用，不受此闸门影响（保持开放）
   ============================================================ */
(function () {
  'use strict';
  if (window.__AUTH_APPLIED__) return;
  window.__AUTH_APPLIED__ = true;

  // ===== 统一 API 基址（所有页面共用）=====
  // 从 file:// 或其它端口(如 8090 题库)打开的页面，使用记录也必须汇总到总站 8080，
  // 否则各入口各存一份，同一账户换个地方看就不一样。
  // 服务端对 /api/* 开放了 CORS，所以跨源直接请求即可。
  window.MM_SITE = 'http://localhost:8080';
  window.MM_API = (location.protocol === 'file:' ||
                   (location.port && location.port !== '8080')) ? window.MM_SITE : '';
  // 用法：fetch(mmApi('/api/activity/record'), ...) —— 在 8080 上就是同源相对路径
  window.mmApi = function (p) { return window.MM_API + p; };

  function getCurrentUser() {
    try {
      var raw = localStorage.getItem('current_user');
      if (!raw) return null;
      var u = JSON.parse(raw);
      return (u && u.student_id) ? u : null;
    } catch (e) { return null; }
  }

  function currentFileName() {
    var p = (window.location.pathname || '').replace(/\\/g, '/');
    var name = p.substring(p.lastIndexOf('/') + 1) || 'index.html';
    return name.split('?')[0];
  }

  // 用户身份跨端口共享：Cookie 按 host（localhost）而非端口隔离，
  // 主平台(8080)写入 mechmind_uid=<学号>，题库(8090)据此识别当前用户做记录。
  function syncUidCookie() {
    try {
      var u = getCurrentUser();
      if (u && u.student_id) {
        document.cookie = 'mechmind_uid=' + encodeURIComponent(u.student_id) + '; path=/; max-age=' + (60 * 60 * 24 * 365);
      } else {
        document.cookie = 'mechmind_uid=; path=/; max-age=0';
      }
    } catch (e) {}
  }
  syncUidCookie();

  // 本地文件方式（file://）提示：它与 http://localhost:8080 是两个独立的存储源，
  // 在这里产生的进度不会同步到服务端，同一账户换个入口看就不一样。不强制跳转，只提示。
  if (location.protocol === 'file:') {
    var showFileBanner = function () {
      if (document.getElementById('__file_src_banner')) return;
      var b = document.createElement('div');
      b.id = '__file_src_banner';
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7f1d1d;color:#fff;' +
        'padding:10px 16px;font-size:13px;line-height:1.6;text-align:center;font-family:"Microsoft YaHei",sans-serif';
      b.innerHTML = '⚠️ 你正在用<b>本地文件方式</b>打开（file://），这里的进度<b>不会同步到服务器</b>，换入口就会不一样。' +
        '请改用 <a href="http://localhost:8080/index.html" style="color:#fde68a;font-weight:700">http://localhost:8080/index.html</a>';
      (document.body || document.documentElement).appendChild(b);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showFileBanner);
    else showFileBanner();
  }

  // ===== 历史活动记录补传 =====
  // 在 file:// 或其它端口打开时，本机可能已经积累了历史活跃记录（登录/做题/AI），
  // 而服务端还没有。这里按「并集」合并上传——只会补上缺的，不会覆盖或删除服务端已有的数据。
  if (window.MM_API) {
    (function syncActivityBacklog() {
      var u = getCurrentUser();
      if (!u || !u.student_id) return;
      var sid = u.student_id, key = 'user_activity_' + sid;
      var local = {};
      try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return; }
      if (!Object.keys(local).length) return;
      var merge = function (srv, loc) {
        var out = {};
        [srv, loc].forEach(function (src) {
          Object.keys(src).forEach(function (date) {
            var a = out[date] || { login: false, questions: 0, q_list: [], ai_count: 0, ai_minutes: 0, ai_questions: [] };
            var b = src[date] || {};
            a.login = a.login || !!b.login;
            a.questions = Math.max(a.questions || 0, b.questions || 0);
            var qs = {}; (a.q_list || []).concat(b.q_list || []).forEach(function (q) { qs[q] = 1; });
            a.q_list = Object.keys(qs);
            a.ai_count = Math.max(a.ai_count || 0, b.ai_count || 0);
            a.ai_minutes = Math.max(a.ai_minutes || 0, b.ai_minutes || 0);
            a.ai_questions = (a.ai_questions || []).length >= (b.ai_questions || []).length ? a.ai_questions : b.ai_questions;
            out[date] = a;
          });
        });
        return out;
      };
      fetch(window.MM_SITE + '/api/activity?id=' + encodeURIComponent(sid) + '&_=' + Date.now())
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          var srv = (d && d.activity) || {};
          var merged = merge(srv, local);
          if (JSON.stringify(merged) === JSON.stringify(srv)) return;   // 没有新东西，不写
          return fetch(window.MM_SITE + '/api/activity/record', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sid, action: 'seed', activity: merged })
          });
        })
        .catch(function (e) { console.warn('[活动补传] 跳过：' + e.message); });
    })();
  }

  var file = currentFileName();
  // 登录/注册页本身放行
  if (file.toLowerCase() === 'account.html') return;

  // 未登录 → 记录原页面并跳去登录
  if (!getCurrentUser()) {
    var back = encodeURIComponent(file + (location.search || '') + (location.hash || ''));
    var target = 'account.html?redirect=' + back;
    try { location.replace(target); } catch (e) { location.href = target; }
  }
})();
