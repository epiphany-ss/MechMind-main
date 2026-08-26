(function() {
  var path = window.location.pathname.replace(/\\/g, '/');
  var filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  var isIndex = filename === 'index.html' || filename === '' || path === '/' || path.endsWith('/');
  var isStatics = path.indexOf('/statics/') !== -1;
  var isAiQa = filename === 'ai_qa.html';

  // ========== Index page: full top-nav + mobile menu + back-to-top ==========
  if (isIndex) {
    // Top nav
    var nav = document.createElement('nav');
    nav.className = 'top-nav';
    nav.id = 'topNav';
    nav.innerHTML =
      '<a class="nav-brand" href="index.html">' +
        '<div class="nav-logo"><div class="bridge-arc"></div></div>' +
        '<div class="nav-title">理论力学研究平台<small>长沙理工大学 · 工程力学系</small></div>' +
      '</a>' +
      '<ul class="nav-links" id="navLinks">' +
        '<li><a href="index.html">首页</a></li>' +
        '<li><a href="http://localhost:8090">理论力学题库</a></li>' +
        '<li><a href="mechanism.html">机构运动演示</a></li>' +
        '<li><a href="ai_qa.html">AI智能问答</a></li>' +
        '<li><a href="statics/textbook.html">知识框架</a></li>' +
        '<li><a href="forum.html">问题探讨</a></li>' +
        '<li><a href="account.html" class="btn-nav">个人账户</a></li>' +
      '</ul>' +
      '<div class="nav-search">' +
        '<input type="text" placeholder="搜索力学知识…" id="navSearchInput" onkeydown="if(event.key===\'Enter\')window.location.href=\'search.html?q=\'+encodeURIComponent(this.value)">' +
        '<button onclick="window.location.href=\'search.html?q=\'+encodeURIComponent(document.getElementById(\'navSearchInput\').value)">🔍</button>' +
      '</div>' +
      '<button class="menu-toggle" id="menuToggle"><span></span><span></span><span></span></button>';
    document.body.insertBefore(nav, document.body.firstChild);

    // Mobile menu
    var mobileMenu = document.createElement('div');
    mobileMenu.id = 'mobileMenu';
    mobileMenu.onclick = function(e) {
      if (e.target === mobileMenu) mobileMenu.classList.remove('active');
    };
    mobileMenu.innerHTML =
      '<div class="mobile-menu-panel" onclick="event.stopPropagation()">' +
        '<h3>导航菜单</h3>' +
        '<a href="index.html">🏠 首页</a>' +
        '<a href="http://localhost:8090">📝 理论力学题库</a>' +
        '<a href="mechanism.html">⚙️ 机构运动演示</a>' +
        '<a href="ai_qa.html">🤖 AI智能问答</a>' +
        '<a href="statics/textbook.html">🧠 知识框架</a>' +
        '<a href="forum.html">💬 问题探讨</a>' +
        '<a href="account.html">👤 个人账户</a>' +
        '<a href="search.html">🔍 功能搜索</a>' +
        '<a href="about.html">ℹ️ 平台介绍</a>' +
        '<a href="contact.html">📞 联系我们</a>' +
        '<a href="help.html">❓ 使用帮助</a>' +
        '<button class="close-menu-btn" onclick="document.getElementById(\'mobileMenu\').classList.remove(\'active\')">关闭菜单</button>' +
      '</div>';
    document.body.appendChild(mobileMenu);

    // Back to top
    var btt = document.createElement('button');
    btt.className = 'back-to-top';
    btt.id = 'backToTop';
    btt.textContent = '↑';
    btt.onclick = function() { window.scrollTo({top: 0, behavior: 'smooth'}); };
    document.body.appendChild(btt);

    // Wire menu toggle
    document.getElementById('menuToggle').onclick = function() {
      document.getElementById('mobileMenu').classList.add('active');
    };
  }

  // ========== AI Q&A: custom top-nav with back button ==========
  else if (isAiQa) {
    var aiNav = document.createElement('nav');
    aiNav.className = 'top-nav';
    aiNav.innerHTML =
      '<div class="top-nav-left">' +
        '<div class="logo-icon">⚡</div>' +
        '<div>' +
          '<span class="logo-text">理论力学AI助教</span>' +
          '<span class="logo-sub" id="modeLabel">知识库模式 · 支持逐步推导</span>' +
        '</div>' +
      '</div>' +
      '<div class="top-nav-right">' +
        '<span class="api-status offline" id="apiStatus">本地模式</span>' +
        '<a href="index.html" class="btn-back">← 返回主页</a>' +
      '</div>';
    document.body.insertBefore(aiNav, document.body.firstChild);
  }

  // ========== Sub-pages: back-home button ==========
  else {
    var backHref = isStatics ? '../index.html' : 'index.html';
    var btn = document.createElement('a');
    btn.href = backHref;
    btn.className = 'back-home';
    btn.textContent = '← 返回主页';
    document.body.insertBefore(btn, document.body.firstChild);
  }

  // ========== Scroll handler: nav shadow + back-to-top ==========
  window.addEventListener('scroll', function() {
    var nav = document.getElementById('topNav');
    var btt = document.getElementById('backToTop');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
    if (btt) btt.classList.toggle('visible', window.scrollY > 300);
  });
})();
