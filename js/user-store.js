/* ============================================================
   统一账户存储层（UserStore）
   ------------------------------------------------------------
   目标：同一个账户，在**整个网站的任何页面、任何入口**看到的数据都一致；
        只有切换账户时内容才不同。

   背景：过去「已复习勾选 / 个人掌握状态 / 使用频率 / 点击次数 / 复习流水」
        只存在浏览器 localStorage 里，于是
          · file:// 与 http://localhost:8080 是两个源，数据互不相通
          · 换一台电脑、换一个浏览器就全丢
          · 同一个账户在两个页面看到的可能不一样

   读写策略：
     · 同步读 —— 内存缓存 → 本机 localStorage → 兜底值。首屏不阻塞、不闪烁。
     · 异步写 —— 本机 localStorage + 服务端 POST /api/userdata/<uid> 双写。
     · init() —— 先用本机数据填满缓存（秒开），再异步拉服务端覆盖；
                  服务端没有的键用本机值补传，完成一次性迁移。
     · file:// 或其它端口(8090 题库)打开的页面也照样上报到总站 8080
       （apiBase() 会给出 http://localhost:8080 的绝对地址，服务端已开放 CORS）。
     · 服务器不可用时不报错、不阻塞：改动留在本机并保留待传队列，下次联网自动补传。
   ============================================================ */
(function (root) {
  'use strict';

  var UID = 'guest';
  // 在 file:// 或其它端口打开的页面，也把数据写到总站 8080（跨源，服务端已开放 CORS）
  function apiBase() {
    return (typeof window.mmApi === 'function') ? window.mmApi('/api/userdata/') : '/api/userdata/';
  }
  var enabled = true;          // 始终尝试同步；失败只保留待传队列，不影响页面

  var cache = {};              // 服务端权威值（拿到后写入）
  var dirty = {};              // 本机改过、还没确认写入服务端的键
  var serverLoaded = false;    // 服务端是否已成功应答过一次
  var flushTimer = null;
  var onSync = null;           // 服务端数据到达后的回调（用于重渲染）
  var readyResolve = null;
  var readyPromise = new Promise(function (res) { readyResolve = res; });

  function lsKey(key) { return key + '_' + UID; }

  function lsGet(key) {
    try {
      var raw = localStorage.getItem(lsKey(key));
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) { return undefined; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(lsKey(key), JSON.stringify(value)); } catch (e) {}
  }
  function lsHas(key) {
    try { return localStorage.getItem(lsKey(key)) !== null; } catch (e) { return false; }
  }

  // 同步读：服务端值优先，其次本机缓存，最后兜底
  function get(key, fallback) {
    if (!dirty[key] && Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    var local = lsGet(key);
    if (local !== undefined) return local;
    if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
    return fallback;
  }

  // 同步写：立刻落到本机（保证刷新不丢），并排队异步上传
  function set(key, value) {
    lsSet(key, value);
    cache[key] = value;
    dirty[key] = true;
    scheduleFlush();
  }

  function scheduleFlush() {
    if (!enabled) return;
    if (flushTimer) clearTimeout(flushTimer);
    // 合并短时间内的多次写入，避免每次点击都发一次请求
    flushTimer = setTimeout(flush, 400);
  }

  function flush() {
    flushTimer = null;
    var keys = Object.keys(dirty);
    if (!keys.length) return;
    var patch = {};
    keys.forEach(function (k) { patch[k] = cache[k]; });
    fetch(apiBase() + encodeURIComponent(UID), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: patch }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      keys.forEach(function (k) { delete dirty[k]; });   // 确认写入成功才清除脏标记
    }).catch(function (e) {
      // 服务器暂时不可用：保留脏标记，等下次写入或下次打开时再补传
      console.warn('[UserStore] 同步失败，稍后重试：' + e.message);
    });
  }

  // 启动：先用本机数据占位（秒开），再拉服务端权威值
  function init(uid, options) {
    UID = uid || 'guest';
    options = options || {};
    onSync = options.onSync || null;
    // file:// 也能同步：apiBase() 会指向 http://localhost:8080

    // 把已知的键从本机读进缓存，保证同步读立刻有值
    (options.keys || []).forEach(function (k) {
      var v = lsGet(k);
      if (v !== undefined) cache[k] = v;
    });

    pull().then(function () { readyResolve(); });
    return readyPromise;
  }

  function pull() {
    if (!enabled) return Promise.resolve(false);
    return fetch(apiBase() + encodeURIComponent(UID) + '?_=' + Date.now())
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var remote = (j && j.data) || {};
        var seeded = {};
        // 服务端有的键 → 覆盖本机（服务端是权威源）
        Object.keys(remote).forEach(function (k) {
          if (dirty[k]) return;                    // 本机刚改过、还没传上去 → 保留本机的
          cache[k] = remote[k];
          lsSet(k, remote[k]);
        });
        // 本机有、服务端没有的键 → 补传，完成一次性迁移
        Object.keys(cache).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(remote, k)) return;
          if (!lsHas(k)) return;
          seeded[k] = cache[k];
        });
        serverLoaded = true;
        if (Object.keys(seeded).length) {
          fetch(apiBase() + encodeURIComponent(UID), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: seeded }),
          }).catch(function () {});
        }
        if (onSync) { try { onSync(); } catch (e) {} }
        return true;
      })
      .catch(function (e) {
        console.warn('[UserStore] 读取服务端失败，改用本机数据：' + e.message);
        return false;
      });
  }

  root.UserStore = {
    init: init,
    get: get,
    set: set,
    ready: function () { return readyPromise; },
    isServerBacked: function () { return serverLoaded; },
    userId: function () { return UID; },
    flush: flush,
  };

  // 关页前把没传完的写上去（尽力而为）
  window.addEventListener('beforeunload', function () { if (flushTimer) { clearTimeout(flushTimer); flush(); } });
  // 切回标签页时补一次同步，避免停在旧数据上
  window.addEventListener('focus', function () { if (enabled) pull(); });
})(window);
