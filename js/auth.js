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
