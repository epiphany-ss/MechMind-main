/* ============================================================================
   虚拟展厅 · 3D 漫游引擎
   ----------------------------------------------------------------------------
   依赖：js/three.min.js（r159）、js/hall_data.js（内容数据）
   做成：一间大厅，四面墙各挂一个展馆；WASD 走动 + 鼠标环视，走到展馆前按 E 看内容。

   内容在 js/hall_data.js，这个文件只负责“房子怎么盖、怎么走、怎么弹内容”。
   要调房间大小 / 走动速度 / 触发距离，改下面的 ROOM、WALK、TRIGGER 即可。
   ============================================================================ */
(function () {
  'use strict';

  var DATA = window.HALL_DATA || { halls: [] };

  /* ======================== 可调参数 ======================== */
  var ROOM = { w: 64, d: 52, h: 13 };    // 大厅：宽(x) × 深(z) × 高(y) —— 做得大一些，才像历史展馆
  var EYE = 1.68;                        // 视高（眼睛离地）
  var BODY = 0.60;                       // 碰撞半径
  var WALK = 7.4, RUN = 14;              // 走路 / 按住 Shift 跑（场地大，速度相应调快）
  var TRIGGER = 14;                      // 走到多近算“到了展馆前”（要大于下面的观看距离 tDist）
  var LOOK_SENS = 0.0022;                // 鼠标灵敏度
  var FOV = 68;
  /* ========================================================= */

  var HALF_W = ROOM.w / 2, HALF_D = ROOM.d / 2;
  var WALL_IN = 0.4;                     // 离墙最近能走到的距离

  var WALL_DIR = {                      // 每面墙：法线朝内方向 + 该面墙的朝向角
    north: { n: [0, 0, 1], yaw: 0 },
    south: { n: [0, 0, -1], yaw: Math.PI },
    west: { n: [1, 0, 0], yaw: Math.PI / 2 },
    east: { n: [-1, 0, 0], yaw: -Math.PI / 2 }
  };

  var renderer, scene, camera, clock;
  var yaw = 0, pitch = 0;
  var pos = new THREE.Vector3(0, EYE, HALF_D - 5);   // 出生点：南门内，正对整条中轴
  var keys = Object.create(null);

  // 跳跃：按空格把视点短暂抬高一下，用来瞄一眼大型展品的顶部。
  // 只抬 y，不做水平位移，也不影响碰撞（走动逻辑只认 x/z）。
  var jumpY = 0, jumpV = 0, jumping = false;
  var JUMP_V = 6.4, GRAVITY = 14;      // 顶点约 1.46m、滞空约 0.9s —— "跳起来看一眼"够用
  function startJump() {
    if (jumping) return;               // 空中不能再起跳
    jumping = true; jumpV = JUMP_V;
  }
  function updateJump(dt) {
    if (!jumping) return;
    jumpV -= GRAVITY * dt;
    jumpY += jumpV * dt;
    if (jumpY <= 0) { jumpY = 0; jumpV = 0; jumping = false; }   // 落地
    pos.y = EYE + jumpY;
  }
  var colliders = [];        // 轴对齐障碍：{x0,x1,z0,z1}
  var halls = [];            // 展馆运行时对象
  var active = null;         // 当前站在哪个展馆前
  var locked = false, touchMode = false, ready = false;
  var titleMesh = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ======================== 贴图：用 canvas 画中文，避免依赖字体文件 ======================== */
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    // 不标 sRGB 的话，贴图会被当线性数据采样、输出时又被转一次 sRGB，整张画面会发白
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var CN_FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif';

  // 展馆主展板
  function boardTex(hall) {
    return canvasTex(1200, 540, function (g, W, H) {
      var grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#101a30');
      grad.addColorStop(1, '#0a1120');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);

      // 左侧主色竖条
      g.fillStyle = hall.color; g.fillRect(0, 0, 14, H);
      // 顶部细线
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(14, 0, W - 14, 2);

      // 图标
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = '104px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
      g.fillText(hall.icon || '🏛️', 64, H / 2 - 20);

      // 展馆名
      g.fillStyle = '#ffffff';
      g.font = '800 96px ' + CN_FONT;
      g.shadowColor = hall.color; g.shadowBlur = 28;
      g.fillText(hall.name || '', 210, H / 2 - 58);
      g.shadowBlur = 0;

      // 副标题
      g.fillStyle = 'rgba(190,210,240,0.82)';
      g.font = '36px ' + CN_FONT;
      g.fillText(hall.subtitle || '', 214, H / 2 + 22);

      // 底部提示
      g.fillStyle = hall.color;
      g.fillRect(214, H / 2 + 66, 132, 3);
      g.fillStyle = 'rgba(150,175,210,0.75)';
      g.font = '28px ' + CN_FONT;
      g.fillText('走到展板前 · 按 E 查看', 214, H / 2 + 108);
    });
  }

  // 中央展台悬浮牌
  function titleTex(intro) {
    return canvasTex(1400, 420, function (g, W, H) {
      g.fillStyle = 'rgba(10,17,32,0.88)';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(96,165,250,0.55)'; g.lineWidth = 3;
      g.strokeRect(6, 6, W - 12, H - 12);

      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.font = '800 76px ' + CN_FONT;
      g.shadowColor = 'rgba(96,165,250,0.9)'; g.shadowBlur = 30;
      g.fillText((intro && intro.title) || '虚拟展厅', W / 2, H / 2 - 62);
      g.shadowBlur = 0;

      g.font = '32px ' + CN_FONT;
      var lines = (intro && intro.lines) || [];
      for (var i = 0; i < lines.length; i++) {
        g.fillStyle = i === 0 ? 'rgba(190,215,245,0.92)' : 'rgba(140,165,200,0.85)';
        g.fillText(lines[i], W / 2, H / 2 + 22 + i * 52);
      }
    });
  }

  // 地面（深色石材 + 网格）
  function floorTex() {
    return canvasTex(512, 512, function (g, W, H) {
      g.fillStyle = '#1b2740'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,165,225,0.30)'; g.lineWidth = 2;
      for (var i = 0; i <= W; i += 64) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke();
      }
      g.fillStyle = 'rgba(140,185,250,0.12)';
      g.fillRect(0, 0, W, 6); g.fillRect(0, 0, 6, H);
    });
  }

  // 大理石地面：深蓝灰底 + 细石纹，配高金属度做出磨光反光
  function marbleTex() {
    return canvasTex(512, 512, function (g, W, H) {
      g.fillStyle = '#2c3a56'; g.fillRect(0, 0, W, H);
      var r = rnd(20260915);
      for (var i = 0; i < 26; i++) {
        g.beginPath();
        var x0 = r() * W, y0 = r() * H;
        g.moveTo(x0, y0);
        for (var k = 0; k < 4; k++) g.lineTo(x0 + (r() - 0.5) * 220, y0 + (r() - 0.5) * 220);
        g.strokeStyle = 'rgba(210,228,252,' + (0.05 + r() * 0.12).toFixed(3) + ')';
        g.lineWidth = 1 + r() * 2.4;
        g.stroke();
      }
      g.strokeStyle = 'rgba(14,22,38,0.6)'; g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, W - 3, H - 3);
      var sh = g.createRadialGradient(W * 0.3, H * 0.3, 10, W * 0.3, H * 0.3, W * 0.85);
      sh.addColorStop(0, 'rgba(255,255,255,0.07)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sh; g.fillRect(0, 0, W, H);
    });
  }

  /* ======================== 几何工具 ======================== */
  function box(w, h, d, mat, x, y, z, ry, collide) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    scene.add(m);
    if (collide) addCollider(w, d, x, z, ry || 0);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, seg) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function addCollider(w, d, x, z, ry) {
    // 只处理 90° 倍数旋转，够用了；斜置的按外接盒近似
    var cw = (Math.abs(Math.cos(ry)) > 0.5) ? w : d;
    var cd = (Math.abs(Math.cos(ry)) > 0.5) ? d : w;
    colliders.push({ x0: x - cw / 2, x1: x + cw / 2, z0: z - cd / 2, z1: z + cd / 2 });
  }
  // 带种子的伪随机，保证每次打开摆件位置一样
  function rnd(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ======================== 共用材质 ======================== */
  var M = {};
  function buildMaterials() {
    var mt = marbleTex();
    mt.wrapS = mt.wrapT = THREE.RepeatWrapping;
    mt.repeat.set(ROOM.w / 8, ROOM.d / 8);

    M.floor = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.18, metalness: 0.40, color: 0x93a8c8 });
    M.stone = new THREE.MeshStandardMaterial({ color: 0x2b3956, roughness: 0.9, metalness: 0.06, side: THREE.DoubleSide });
    M.stoneDark = new THREE.MeshStandardMaterial({ color: 0x1f2b44, roughness: 0.92, metalness: 0.05 });
    M.ceil = new THREE.MeshStandardMaterial({ color: 0x1b2740, roughness: 0.95 });
    M.gold = new THREE.MeshStandardMaterial({ color: 0xd8b25c, roughness: 0.28, metalness: 1.0, emissive: 0x4a3308, emissiveIntensity: 0.45 });
    M.goldDim = new THREE.MeshStandardMaterial({ color: 0xa8843c, roughness: 0.45, metalness: 0.85 });
    M.colShaft = new THREE.MeshStandardMaterial({ color: 0x3d4f70, roughness: 0.42, metalness: 0.35 });
    M.beam = new THREE.MeshStandardMaterial({ color: 0x243352, roughness: 0.8, metalness: 0.25 });
    M.carpet = new THREE.MeshStandardMaterial({ color: 0x6d1420, roughness: 0.98 });
    M.plinth = new THREE.MeshStandardMaterial({ color: 0x33445f, roughness: 0.5, metalness: 0.5 });
    M.door = new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.6, metalness: 0.35 });
    M.glass = new THREE.MeshStandardMaterial({
      color: 0xbfe0ff, roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.22, side: THREE.DoubleSide
    });
    M.lamp = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 2.6, roughness: 0.4 });
    M.lantern = new THREE.MeshStandardMaterial({ color: 0xd8341f, emissive: 0xff3a1a, emissiveIntensity: 1.7, roughness: 0.6 });
    M.roofTile = new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.7, metalness: 0.3 });
    M.skyDisc = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x9fc4ff, emissiveIntensity: 1.6, roughness: 0.4, side: THREE.DoubleSide });
    M.coolRing = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, emissive: 0xcfe4ff, emissiveIntensity: 2.2, roughness: 0.3 });
  }

  /* ======================== 盖房子：一座历史展馆 ======================== */
  function buildRoom() {
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), M.floor);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), M.ceil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = ROOM.h;
    scene.add(ceil);

    wall(M.stone, ROOM.w, 0, -HALF_D, 0);
    wall(M.stone, ROOM.w, 0, HALF_D, Math.PI);
    wall(M.stone, ROOM.d, -HALF_W, 0, Math.PI / 2);
    wall(M.stone, ROOM.d, HALF_W, 0, -Math.PI / 2);

    // 墙脚一圈
    box(ROOM.w, 0.5, 0.16, M.stoneDark, 0, 0.25, -HALF_D + 0.1, 0, false);
    box(ROOM.w, 0.5, 0.16, M.stoneDark, 0, 0.25, HALF_D - 0.1, 0, false);
    box(0.16, 0.5, ROOM.d, M.stoneDark, -HALF_W + 0.1, 0.25, 0, 0, false);
    box(0.16, 0.5, ROOM.d, M.stoneDark, HALF_W - 0.1, 0.25, 0, 0, false);

    buildPilasters();
    buildCarpet();
    buildColonnade();
    buildCeiling();
    buildChandeliers();
    buildSconces();
    buildDisplayCases();
    buildEntrance();
    buildPodium();
    buildChineseElements();
    buildExhibits();
  }

  function wall(mat, len, x, z, ry) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(len, ROOM.h), mat);
    m.position.set(x, ROOM.h / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  }

  // 某面墙上已被展板（含两侧灯箱）占用的沿墙区间
  function hallSpans(wallKey) {
    var out = [];
    (DATA.halls || []).forEach(function (h) {
      if (h.wall !== wallKey) return;
      var half = 14 / 2 + 2.6;                              // 展板半宽 + 灯箱立柱
      out.push([(h.offset || 0) - half, (h.offset || 0) + half]);
    });
    return out;
  }
  function wallFree(wallKey, at) {
    return !hallSpans(wallKey).some(function (s) { return at > s[0] && at < s[1]; });
  }

  // 墙面壁柱：把四面长墙切分出节奏，远看才像古典展馆（避开展板与大门）
  function buildPilasters() {
    var H = ROOM.h - 1.2;
    for (var x = -28; x <= 28; x += 8) {
      if (Math.abs(x) < 9) continue;                       // 中间让给大门
      if (wallFree('north', x)) box(1.0, H, 0.55, M.goldDim, x, H / 2, -HALF_D + 0.4, 0, false);
      if (wallFree('south', x)) box(1.0, H, 0.55, M.goldDim, x, H / 2, HALF_D - 0.4, 0, false);
    }
    for (var z = -22; z <= 22; z += 8) {
      if (Math.abs(z) < 9) continue;
      if (wallFree('west', z)) box(0.55, H, 1.0, M.goldDim, -HALF_W + 0.4, H / 2, z, 0, false);
      if (wallFree('east', z)) box(0.55, H, 1.0, M.goldDim, HALF_W - 0.4, H / 2, z, 0, false);
    }
  }

  // 十字红毯：把四条参观轴线铺出来
  function buildCarpet() {
    box(5.4, 0.06, ROOM.d - 3, M.carpet, 0, 0.03, 0, 0, false);
    box(ROOM.w - 3, 0.06, 5.4, M.carpet, 0, 0.03, 0, 0, false);
    box(0.16, 0.07, ROOM.d - 3, M.goldDim, -2.85, 0.035, 0, 0, false);
    box(0.16, 0.07, ROOM.d - 3, M.goldDim, 2.85, 0.035, 0, 0, false);
    box(ROOM.w - 3, 0.07, 0.16, M.goldDim, 0, 0.035, -2.85, 0, false);
    box(ROOM.w - 3, 0.07, 0.16, M.goldDim, 0, 0.035, 2.85, 0, false);
  }

  // 两列巨柱：展厅的骨架
  function buildColonnade() {
    var R = 1.15, H = ROOM.h;
    [-20, -11, 11, 20].forEach(function (z) {
      [-20, 20].forEach(function (x) {
        cyl(R, R * 1.12, H, M.colShaft, x, H / 2, z, 26);            // 柱身
        cyl(R * 1.5, R * 1.5, 0.7, M.goldDim, x, 0.35, z, 26);       // 柱础
        cyl(R * 1.35, R * 1.45, 0.5, M.gold, x, H - 0.6, z, 26);     // 柱头
        box(R * 3.0, 0.35, R * 3.0, M.gold, x, H - 0.18, z, 0, false); // 顶板
        addCollider(R * 2.6, R * 2.6, x, z, 0);
      });
    });
  }

  // 藻井天花 + 中央穹顶
  function buildCeiling() {
    var y = ROOM.h - 0.5;
    for (var x = -24; x <= 24; x += 8) box(0.5, 0.75, ROOM.d - 2, M.beam, x, y, 0, 0, false);
    for (var z = -20; z <= 20; z += 6.5) box(ROOM.w - 2, 0.75, 0.5, M.beam, 0, y, z, 0, false);

    cyl(10.5, 10.5, 0.4, M.skyDisc, 0, ROOM.h - 0.2, 0, 54);         // 穹顶发光面
    var ring = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.42, 12, 54), M.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ROOM.h - 1.7;
    scene.add(ring);
    var glow = new THREE.Mesh(new THREE.TorusGeometry(9.4, 0.2, 10, 54), M.coolRing);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = ROOM.h - 1.9;
    scene.add(glow);
  }

  // 四组吊灯（暖光）
  function buildChandeliers() {
    [[-12, -15], [12, -15], [-12, 15], [12, 15]].forEach(function (p) {
      var g = new THREE.Group();
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 10, 28), M.gold);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      for (var i = 0; i < 6; i++) {
        var a = i / 6 * Math.PI * 2;
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), M.lamp);
        s.position.set(Math.cos(a) * 1.5, -0.12, Math.sin(a) * 1.5);
        g.add(s);
      }
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), M.goldDim);
      rod.position.y = 1.3;
      g.add(rod);
      g.position.set(p[0], ROOM.h - 3.6, p[1]);
      scene.add(g);

      var pl = new THREE.PointLight(0xffd9a0, 300, 48, 2);
      pl.position.set(p[0], ROOM.h - 4.0, p[1]);
      scene.add(pl);
    });
  }

  // 墙面壁灯（同样避开展板与大门）
  function buildSconces() {
    for (var x = -28; x <= 28; x += 7) {
      if (Math.abs(x) < 8.5) continue;
      if (wallFree('north', x)) box(0.5, 0.9, 0.3, M.lamp, x, 5.2, -HALF_D + 0.35, 0, false);
      if (wallFree('south', x)) box(0.5, 0.9, 0.3, M.lamp, x, 5.2, HALF_D - 0.35, 0, false);
    }
    for (var z = -24; z <= 24; z += 7) {
      if (Math.abs(z) < 8.5) continue;
      if (wallFree('west', z)) box(0.3, 0.9, 0.5, M.lamp, -HALF_W + 0.35, 5.2, z, 0, false);
      if (wallFree('east', z)) box(0.3, 0.9, 0.5, M.lamp, HALF_W - 0.35, 5.2, z, 0, false);
    }
  }

  // 玻璃展柜：沿墙一排，每柜一件形状不同的小展品（避开四块展板的位置）
  function buildDisplayCases() {
    var spots = [];
    [-28, -20, -14, 14, 20, 28].forEach(function (x) {
      if (wallFree('north', x)) spots.push([x, -HALF_D + 2.6, 1]);
      if (wallFree('south', x)) spots.push([x, HALF_D - 2.6, 1]);
    });
    [-20, -14, 14, 20].forEach(function (z) {
      if (wallFree('west', z)) spots.push([-HALF_W + 2.6, z, 0]);
      if (wallFree('east', z)) spots.push([HALF_W - 2.6, z, 0]);
    });

    /* 展柜里的小件：一件一种、不重复，都是理论力学里叫得出名字的教学模型。
       （原来只有球/圆环/圆锥/立方体/圆柱五种轮流发，柜子却有二十个 → 每种重复四次，
         而且没有一件带说明牌，看着就是几个没来由的几何体。）*/
    // 往 Group 里塞东西的简写：局部坐标、长轴朝 +X，柜子转到哪个朝向都靠外层 Group 转
    function B(g, w, h, d, mat, x, y, z) { g.add(meshOf(new THREE.BoxGeometry(w, h, d), mat, x, y, z)); }
    function C(g, rt, rb, h, mat, x, y, z, rx) { g.add(meshOf(new THREE.CylinderGeometry(rt, rb, h, 18), mat, x, y, z, rx || 0)); }
    function R(g, rad, tube, mat, x, y, z, rx) { g.add(meshOf(new THREE.TorusGeometry(rad, tube, 10, 28), mat, x, y, z, rx || 0)); }
    function S(g, x1, y1, z1, x2, y2, z2, r, mat) { strut(x1, y1, z1, x2, y2, z2, r, mat, g); }
    function PR(g, pts, depth, mat) {          // 按截面挤出的棱柱：楔块、三角支座用
      var sh = new THREE.Shape();
      pts.forEach(function (p, i) { i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]); });
      sh.closePath();
      var geo = new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      g.add(meshOf(geo, mat));
    }
    function coil(g, yTop, yBot, r, turns, mat) {   // 螺旋弹簧
      var n = turns * 2, px = 0, py = yTop;
      for (var i = 1; i <= n; i++) {
        var y = yTop + (yBot - yTop) * (i / n), x = (i % 2 ? r : -r);
        S(g, px, py, 0, x, y, 0, 0.016, mat);
        px = x; py = y;
      }
    }

    var arts = [
      ['三铰拱', function (g) {                                  // 1
        var N2 = 6, R2 = 0.60, K = 0.70, prev = null;
        for (var i = 0; i <= N2; i++) {
          var a = Math.PI * (1 - i / N2), px = Math.cos(a) * R2, py = 0.12 + Math.sin(a) * K;
          if (prev) S(g, prev[0], prev[1], 0, px, py, 0, 0.030, M.gold);
          prev = [px, py];
        }
        [-1, 1].forEach(function (s2) {
          B(g, 0.16, 0.14, 0.22, M.plinth, s2 * R2, 0.07, 0);
          C(g, 0.032, 0.032, 0.26, M.goldDim, s2 * R2, 0.16, 0, Math.PI / 2);
        });
        C(g, 0.032, 0.032, 0.26, M.goldDim, 0, 0.12 + K, 0, Math.PI / 2);   // 顶铰
      }],
      ['悬臂梁', function (g) {                                  // 2
        B(g, 0.16, 1.00, 0.70, M.plinth, -0.62, 0.50, 0);                   // 固定端墙
        B(g, 1.02, 0.09, 0.26, M.goldDim, -0.10, 0.91, 0);
        B(g, 1.02, 0.09, 0.26, M.goldDim, -0.10, 0.73, 0);
        B(g, 1.00, 0.26, 0.06, M.gold, -0.10, 0.82, 0);
        [0.18, 0.44].forEach(function (x2) { B(g, 0.03, 0.20, 0.30, M.gold, x2, 0.82, 0); });
        C(g, 0.06, 0, 0.24, M.gold, 0.35, 0.60, 0);                          // 自由端荷载
        B(g, 0.03, 0.24, 0.03, M.gold, 0.35, 0.83, 0);
      }],
      ['固定铰与滚动铰', function (g) {                          // 3
        B(g, 0.46, 0.06, 0.36, M.plinth, -0.34, 0.03, 0);
        [-0.09, 0.09].forEach(function (dz) { B(g, 0.18, 0.40, 0.04, M.gold, -0.34, 0.27, dz); });
        C(g, 0.033, 0.033, 0.24, M.gold, -0.34, 0.47, 0, Math.PI / 2);
        B(g, 0.46, 0.06, 0.36, M.goldDim, -0.34, 0.53, 0);
        B(g, 0.50, 0.06, 0.38, M.plinth, 0.34, 0.03, 0);
        [-0.10, 0.10].forEach(function (dz) { C(g, 0.055, 0.055, 0.20, M.gold, 0.34, 0.115, dz, Math.PI / 2); });
        B(g, 0.30, 0.05, 0.30, M.goldDim, 0.34, 0.19, 0);
        B(g, 0.20, 0.28, 0.18, M.gold, 0.34, 0.36, 0);
        B(g, 0.50, 0.06, 0.38, M.goldDim, 0.34, 0.53, 0);
      }],
      ['斜面摩擦', function (g) {                                // 4
        B(g, 1.00, 0.08, 0.50, M.plinth, 0, 0.04, 0);
        PR(g, [[-0.46, 0], [0.46, 0], [-0.46, 0.36]], 0.50, M.plinth);
        g.children[g.children.length - 1].position.set(0, 0.08, 0);
        var ang = Math.atan2(0.36, 0.92);
        B(g, 0.20, 0.13, 0.22, M.gold, -0.06, 0.34, 0);                      // 斜面上的滑块
        C(g, 0.05, 0, 0.20, M.gold, -0.20, 0.36, 0, 0);                      // 下滑力箭头
        g.children[g.children.length - 1].rotation.z = Math.PI - ang;
      }],
      ['滑轮组', function (g) {                                  // 5
        B(g, 0.70, 0.06, 0.30, M.plinth, 0, 0.86, 0);                        // 顶梁
        [-0.18, 0.18].forEach(function (x2) { C(g, 0.10, 0.10, 0.06, M.goldDim, x2, 0.76, 0, Math.PI / 2); });
        S(g, 0.18, 0.76, 0, -0.18, 0.55, 0, 0.018, M.goldDim);
        S(g, 0.18, 0.55, 0, 0.18, 0.40, 0, 0.018, M.goldDim);
        B(g, 0.26, 0.22, 0.22, M.gold, -0.18, 0.30, 0);                      // 吊重
        C(g, 0.03, 0.03, 0.16, M.goldDim, -0.18, 0.64, 0);
        C(g, 0.05, 0.05, 0.04, M.gold, -0.18, 0.72, 0, Math.PI / 2);
      }],
      ['弹簧振子', function (g) {                                // 6
        B(g, 0.44, 0.06, 0.34, M.plinth, 0, 0.03, 0);
        B(g, 0.30, 0.06, 0.26, M.goldDim, 0, 1.00, 0);                       // 顶板
        coil(g, 0.97, 0.48, 0.085, 7, M.goldDim);
        B(g, 0.30, 0.22, 0.26, M.gold, 0, 0.38, 0);                          // 振子质量块
      }],
      ['阻尼器', function (g) {                                  // 7
        B(g, 0.40, 0.06, 0.32, M.plinth, 0, 0.03, 0);
        C(g, 0.20, 0.20, 0.52, M.goldDim, 0, 0.32, 0);                       // 缸体
        C(g, 0.22, 0.22, 0.06, M.gold, 0, 0.58, 0);                          // 缸盖
        C(g, 0.045, 0.045, 0.52, M.gold, 0, 0.81, 0);                        // 活塞杆
        B(g, 0.34, 0.06, 0.26, M.goldDim, 0, 1.10, 0);                       // 顶部受力板
        C(g, 0.05, 0, 0.20, M.gold, 0, 1.26, 0);
      }],
      ['陀螺仪', function (g) {                                  // 8
        C(g, 0.05, 0.05, 0.30, M.plinth, 0, 0.15, 0);                        // 立柱
        R(g, 0.34, 0.022, M.goldDim, 0, 0.52, 0, Math.PI / 2);               // 外环
        R(g, 0.25, 0.020, M.goldDim, 0, 0.52, 0);                            // 内环（不同朝向）
        C(g, 0.19, 0.19, 0.09, M.gold, 0, 0.52, 0, Math.PI / 2);             // 转子
        C(g, 0.03, 0.03, 0.30, M.gold, 0, 0.52, 0, Math.PI / 2);
      }],
      ['惯性飞轮', function (g) {                                // 9
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        [0.30, -0.30].forEach(function (x2) {
          B(g, 0.08, 0.42, 0.10, M.plinth, x2, 0.24, 0);
          C(g, 0.05, 0.05, 0.16, M.gold, x2, 0.45, 0, Math.PI / 2);
        });
        C(g, 0.34, 0.34, 0.10, M.goldDim, 0, 0.45, 0, Math.PI / 2);          // 轮缘
        C(g, 0.26, 0.26, 0.07, M.plinth, 0, 0.45, 0);
        for (var k = 0; k < 6; k++) {
          var a2 = k / 6 * Math.PI * 2;
          S(g, 0, 0.45, 0, Math.cos(a2) * 0.30, 0.45 + Math.sin(a2) * 0.30, 0, 0.022, M.gold);
        }
        C(g, 0.07, 0.07, 0.24, M.gold, 0, 0.45, 0, Math.PI / 2);
      }],
      ['滚珠轴承', function (g) {                                // 10
        B(g, 0.40, 0.05, 0.30, M.plinth, 0, 0.025, 0);
        R(g, 0.36, 0.055, M.goldDim, 0, 0.40, 0, Math.PI / 2);               // 外圈
        R(g, 0.20, 0.045, M.gold, 0, 0.40, 0, Math.PI / 2);                  // 内圈
        for (var k = 0; k < 9; k++) {
          var a3 = k / 9 * Math.PI * 2;
          g.add(meshOf(new THREE.SphereGeometry(0.05, 12, 10), M.gold,
                       Math.cos(a3) * 0.28, 0.40 + Math.sin(a3) * 0.28, 0));
        }
      }],
      ['齿轮齿条', function (g) {                                // 11
        B(g, 1.00, 0.06, 0.28, M.plinth, 0, 0.03, 0);
        B(g, 0.94, 0.10, 0.16, M.goldDim, 0, 0.16, 0);                       // 齿条
        for (var k = 0; k < 9; k++) B(g, 0.05, 0.06, 0.16, M.gold, -0.38 + k * 0.095, 0.24, 0);
        var gg = new THREE.Group();
        var geo = new THREE.ExtrudeGeometry(gearShape(0.22, 10, 0.05, 0), { depth: 0.10, bevelEnabled: false, curveSegments: 4 });
        geo.translate(0, 0, -0.05);
        gg.add(new THREE.Mesh(geo, M.gold));
        gg.position.set(0.10, 0.47, 0);
        g.add(gg);
        C(g, 0.05, 0.05, 0.24, M.goldDim, 0.10, 0.47, 0, Math.PI / 2);
      }],
      ['曲柄连杆', function (g) {                                // 12
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        C(g, 0.06, 0.06, 0.30, M.plinth, -0.28, 0.22, 0);                    // 轴承座
        C(g, 0.22, 0.22, 0.06, M.goldDim, -0.28, 0.42, 0, Math.PI / 2);      // 曲柄盘
        C(g, 0.03, 0.03, 0.14, M.gold, -0.28, 0.42, 0, Math.PI / 2);
        C(g, 0.045, 0.045, 0.12, M.gold, -0.28 + 0.15, 0.42, 0, Math.PI / 2);
        S(g, -0.28 + 0.15, 0.42, 0, 0.26, 0.42, 0, 0.028, M.gold);           // 连杆
        S(g, 0.26, 0.42, 0, 0.20, 0.42, 0, 0.028, M.gold);
        B(g, 0.22, 0.16, 0.20, M.gold, 0.34, 0.42, 0);                       // 滑块
        B(g, 0.60, 0.04, 0.24, M.plinth, 0.20, 0.32, 0);
      }],
      ['螺旋千斤顶', function (g) {                              // 13
        B(g, 0.50, 0.06, 0.40, M.plinth, 0, 0.03, 0);
        C(g, 0.07, 0.07, 0.92, M.goldDim, 0, 0.48, 0);                       // 丝杠
        for (var k = 0; k < 10; k++) R(g, 0.072, 0.014, M.gold, 0, 0.14 + k * 0.07, 0, Math.PI / 2);
        C(g, 0.17, 0.17, 0.14, M.gold, 0, 0.86, 0);                          // 螺母
        C(g, 0.26, 0.26, 0.05, M.goldDim, 0, 1.02, 0);                       // 托盘
        var hb = meshOf(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), M.gold, 0, 0.86, 0, 0, 0, Math.PI / 2);
        g.add(hb);                                                            // 手柄
      }],
      ['二力杆', function (g) {                                  // 14
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        B(g, 0.72, 0.09, 0.12, M.goldDim, 0, 0.42, 0);                       // 杆
        [-0.36, 0.36].forEach(function (x2) {
          C(g, 0.075, 0.075, 0.16, M.gold, x2, 0.42, 0, Math.PI / 2);
          C(g, 0.03, 0.03, 0.22, M.goldDim, x2, 0.42, 0, Math.PI / 2);
          C(g, 0.05, 0, 0.18, M.gold, x2 + (x2 > 0 ? 0.20 : -0.20), 0.42, 0);
          g.children[g.children.length - 1].rotation.z = (x2 > 0 ? Math.PI / 2 : -Math.PI / 2);
        });
      }],
      ['力偶', function (g) {                                    // 15
        B(g, 0.30, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        C(g, 0.05, 0.05, 0.34, M.plinth, 0, 0.19, 0);
        C(g, 0.32, 0.32, 0.07, M.goldDim, 0, 0.48, 0, Math.PI / 2);          // 圆盘
        C(g, 0.05, 0.05, 0.30, M.gold, 0, 0.48, 0, Math.PI / 2);
        [1, -1].forEach(function (s2) {                                       // 一对反向力
          B(g, 0.04, 0.20, 0.04, M.gold, 0, 0.48 + s2 * 0.30, 0.20 + s2 * 0.02);
          C(g, 0.05, 0, 0.16, M.gold, 0, 0.48 + s2 * 0.30, 0.24 + s2 * 0.02);
          g.children[g.children.length - 1].rotation.z = (s2 > 0 ? 0 : Math.PI);
        });
        R(g, 0.42, 0.016, M.gold, 0, 0.48, 0.20, 0);                        // 转向标示（在盘面内，别横躺出去）
      }],
      ['摩擦锥', function (g) {                                  // 16
        B(g, 0.90, 0.06, 0.50, M.plinth, 0, 0.03, 0);
        C(g, 0, 0.40, 0.78, M.goldDim, 0, 0.45, 0);                          // 正圆锥
        C(g, 0.03, 0.03, 0.62, M.gold, 0, 0.72, 0);                          // 轴线
        var ar = meshOf(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), M.gold, 0.30, 0.94, 0);
        ar.rotation.z = -0.55;
        g.add(ar);                                                            // 摩擦角方向
      }],
      ['碰撞球列', function (g) {                                // 17
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        [-0.42, 0.42].forEach(function (x2) { B(g, 0.07, 0.78, 0.08, M.goldDim, x2, 0.42, 0); });
        B(g, 0.98, 0.07, 0.08, M.gold, 0, 0.82, 0);                          // 横梁
        for (var k = 0; k < 5; k++) {
          var bx = -0.24 + k * 0.12;
          R(g, 0.055, 0.008, M.goldDim, bx, 0.68, 0, 0);
          S(g, bx, 0.79, 0, bx, 0.72, 0, 0.008, M.goldDim);
          g.add(meshOf(new THREE.SphereGeometry(0.055, 14, 12), M.gold, bx, 0.66, 0));
        }
      }],
      ['桁架节点', function (g) {                                // 18
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        C(g, 0.05, 0.05, 0.44, M.plinth, 0, 0.25, 0);
        B(g, 0.30, 0.30, 0.04, M.goldDim, 0, 0.62, 0);                       // 节点板
        [0, 1, 2, 3].forEach(function (k) {                                   // 四根汇交杆
          var a4 = k * Math.PI / 2;
          S(g, 0, 0.62, 0, Math.cos(a4) * 0.44, 0.62 + Math.sin(a4) * 0.44, 0, 0.026, M.gold);
        });
        [[-0.10, 0.10], [0.10, 0.10], [-0.10, -0.10], [0.10, -0.10]].forEach(function (p) {
          C(g, 0.022, 0.022, 0.05, M.gold, p[0], 0.62 + p[1], 0.04, Math.PI / 2);
        });
      }],
      ['绳绕定滑轮', function (g) {                              // 19
        B(g, 0.30, 0.06, 0.30, M.plinth, -0.30, 0.03, 0);
        B(g, 0.10, 0.80, 0.10, M.goldDim, -0.30, 0.43, 0);
        C(g, 0.26, 0.26, 0.07, M.gold, -0.30, 0.84, 0, Math.PI / 2);         // 滑轮
        C(g, 0.05, 0.05, 0.22, M.goldDim, -0.30, 0.84, 0, Math.PI / 2);
        S(g, -0.56, 0.84, 0, -0.56, 0.26, 0, 0.012, M.goldDim);              // 绳（左）
        S(g, -0.30, 1.10, 0, -0.04, 0.84, 0, 0.012, M.goldDim);              // 绳（右）
        S(g, -0.56, 0.84, 0, -0.30, 1.10, 0, 0.012, M.goldDim);
        B(g, 0.20, 0.24, 0.20, M.gold, -0.56, 0.16, 0);                      // 吊重
      }],
      ['摩擦轮传动', function (g) {                              // 20
        B(g, 1.00, 0.06, 0.30, M.plinth, 0, 0.03, 0);
        [[-0.26, 0.26], [0.24, 0.20]].forEach(function (p) {
          B(g, 0.09, p[1] + 0.10, 0.12, M.plinth, p[0], (p[1] + 0.10) / 2 + 0.06, 0);
          C(g, p[1], p[1], 0.09, M.goldDim, p[0], p[1] + 0.16, 0, Math.PI / 2);
          C(g, 0.035, 0.035, 0.20, M.gold, p[0], p[1] + 0.16, 0, Math.PI / 2);
        });
        R(g, 0.30, 0.012, M.gold, 0, 0.10, 0.20, Math.PI / 2);               // 转向标示
      }]
    ];

    spots.forEach(function (s, i) {
      var x = s[0], z = s[1], alongX = !!s[2];
      var w = alongX ? 2.6 : 1.3, d = alongX ? 1.3 : 2.6;

      box(w, 0.9, d, M.plinth, x, 0.45, z, 0, true);              // 柜座（顶面 y=0.90）
      var spec = arts[i % arts.length];
      var g = new THREE.Group();
      spec[1](g);
      g.position.set(x, 0.92, z);                                  // 坐在柜座顶面
      g.scale.setScalar(1.5);                                      // 罩子内高 2.0，不放大就只占底部三成、显得空
      if (!alongX) g.rotation.y = Math.PI / 2;                     // 柜子横过来放时，物件跟着转
      scene.add(g);
      // 玻璃罩：从柜座顶面(0.90)一直罩到 3.16。原来底边在 1.16，
      // 和柜座之间留了 0.26 的空档，罩子看着是悬空的
      box(w, 2.26, d, M.glass, x, 2.03, z, 0, false);
      box(w, 0.12, d, M.gold, x, 3.2, z, 0, false);               // 柜顶压条

      // 柜座上的说明牌：写上这件东西的名字（原来是一块没有字的鎏金板），
      // 而且要朝展厅内侧，不能贴着墙
      var ox = 0, oz = 0, ry = 0;
      if (Math.abs(z) > Math.abs(x)) { oz = z > 0 ? -1 : 1; ry = oz > 0 ? 0 : Math.PI; }
      else { ox = x > 0 ? -1 : 1; ry = ox > 0 ? Math.PI / 2 : -Math.PI / 2; }
      var pl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.20, 0.30),
        new THREE.MeshBasicMaterial({ map: plaqueTex(spec[0]), transparent: true, side: THREE.DoubleSide })
      );
      pl.position.set(x + ox * (w / 2 + 0.03), 1.10, z + oz * (d / 2 + 0.03));
      pl.rotation.y = ry;
      scene.add(pl);
    });
  }

  // 南侧大门 + 门楣题字：给"走进展馆"一个入口
  function buildEntrance() {
    var z = HALF_D - 0.25;
    box(0.6, 9.4, 0.5, M.gold, -6.4, 4.7, z, 0, false);
    box(0.6, 9.4, 0.5, M.gold, 6.4, 4.7, z, 0, false);
    box(13.4, 0.6, 0.5, M.gold, 0, 9.7, z, 0, false);
    box(5.4, 9.0, 0.35, M.door, -3.0, 4.5, z, 0, false);
    box(5.4, 9.0, 0.35, M.door, 3.0, 4.5, z, 0, false);
    box(0.5, 9.0, 0.4, M.gold, 0, 4.5, z, 0, false);

    var sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.4),
      new THREE.MeshBasicMaterial({ map: titleTex(DATA.intro), transparent: true })
    );
    sign.position.set(0, 11.3, z - 0.06);
    sign.rotation.y = Math.PI;
    scene.add(sign);
  }

  // 中央地面徽章 + 悬浮标题
  function buildPodium() {
    cyl(7.4, 7.4, 0.05, M.goldDim, 0, 0.06, 0, 64);
    cyl(6.2, 6.2, 0.06, M.plinth, 0, 0.075, 0, 64);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.14, 12, 64), M.coolRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11;
    scene.add(ring);
    var inner = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.1, 12, 48), M.lamp);
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.11;
    scene.add(inner);

    titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 4.5),
      new THREE.MeshBasicMaterial({ map: titleTex(DATA.intro), transparent: true, side: THREE.DoubleSide })
    );
    titleMesh.position.set(0, 8.6, 0);
    scene.add(titleMesh);
  }

  /* ======================== 展品：现实中的力学结构 ======================== */
  // 需要每帧动一动的展品，往 animatables 里塞回调（参数是秒）
  var animatables = [];
  var UP = new THREE.Vector3(0, 1, 0);

  // 在两点之间架一根杆件——桁架、拉索、连杆都靠它
  // parent 可选：传了就挂到那个 Group 里（展柜里的小件要跟着柜子转），不传就挂场景
  function strut(x1, y1, z1, x2, y2, z2, r, mat, parent) {
    var a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    var d = new THREE.Vector3().subVectors(b, a);
    var len = d.length();
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    (parent || scene).add(m);
    return m;
  }
  // 把一根“高度为 1”的杆件摆到 a→b（循环里每帧调用，用来做运动中的连杆）
  function orient(mesh, a, b) {
    var d = new THREE.Vector3().subVectors(b, a);
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    mesh.scale.y = Math.max(d.length(), 1e-4);
  }

  /* ---- 展品细节构件：让模型不至于只是一堆光溜溜的方块和圆柱 ---- */
  // 只造网格、不入场景，方便塞进 Group 跟着机构一起动
  function meshOf(geo, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  }
  // 薄板：节点板、支座垫板、加劲肋
  function plate(w, h, t, mat, x, y, z, rx, ry, rz) {
    var m = meshOf(new THREE.BoxGeometry(w, h, t), mat, x, y, z, rx, ry, rz);
    scene.add(m);
    return m;
  }
  // 螺栓头：六角帽 + 垫圈。方向 dir='y'（竖着装）|'x'|'z'
  function bolt(x, y, z, r, mat, dir) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    if (dir === 'x') g.rotation.z = Math.PI / 2;
    else if (dir === 'z') g.rotation.x = Math.PI / 2;
    g.add(meshOf(new THREE.CylinderGeometry(r, r, r * 1.15, 6), mat || M.goldDim));
    g.add(meshOf(new THREE.CylinderGeometry(r * 1.75, r * 1.75, r * 0.32, 12), mat || M.goldDim, 0, -r * 0.62, 0));
    scene.add(g);
    return g;
  }
  // 一圈螺栓：法兰、承台、底座用
  function boltRing(cx, cy, cz, ringR, n, r, mat) {
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      bolt(cx + Math.cos(a) * ringR, cy, cz + Math.sin(a) * ringR, r, mat, 'y');
    }
  }
  // 真齿轮轮廓：齿根圆→齿顶圆画梯形齿，再挤出成实体（比"圆柱外贴方块"耐看太多）
  function gearShape(rad, teeth, boreR, spokeN) {
    var s = new THREE.Shape(), rRoot = rad * 0.84, step = Math.PI * 2 / teeth;
    for (var i = 0; i < teeth; i++) {
      var a = i * step;
      // 每个齿五个关键点：齿根起、齿顶起、齿顶止、齿根止、到下一个齿根
      [[rRoot, 0.04], [rad, 0.20], [rad, 0.46], [rRoot, 0.62], [rRoot, 0.96]].forEach(function (p, k) {
        var ang = a + step * p[1];
        var x = Math.cos(ang) * p[0], y = Math.sin(ang) * p[0];
        if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    if (boreR) {                                   // 轴孔
      var b = new THREE.Path();
      b.absarc(0, 0, boreR, 0, Math.PI * 2, true);
      s.holes.push(b);
    }
    for (var j = 0; j < (spokeN || 0); j++) {      // 轮辐减重孔
      var sa = j / spokeN * Math.PI * 2 + 0.36;
      var h = new THREE.Path();
      h.absarc(Math.cos(sa) * rad * 0.52, Math.sin(sa) * rad * 0.52, rad * 0.15, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return s;
  }
  // 用工字截面挤出：梁演示要看到"工"字才像钢梁
  function iBeamGeo(len, h, w, tweb, tflange) {
    var s = new THREE.Shape(), hw = w / 2, hh = h / 2;
    s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, -hh + tflange); s.lineTo(tweb / 2, -hh + tflange);
    s.lineTo(tweb / 2, hh - tflange); s.lineTo(hw, hh - tflange); s.lineTo(hw, hh);
    s.lineTo(-hw, hh); s.lineTo(-hw, hh - tflange); s.lineTo(-tweb / 2, hh - tflange);
    s.lineTo(-tweb / 2, -hh + tflange); s.lineTo(-hw, -hh + tflange); s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 2 });
    g.translate(0, 0, -len / 2);
    g.rotateY(Math.PI / 2);          // 截面转到 YZ 面，长度沿 X
    return g;
  }

  // 展品标牌：黑底金字
  function plaqueTex(title, sub) {
    return canvasTex(512, 128, function (g, W, H) {
      var bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#7e2614'); bg.addColorStop(1, '#4e1409');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(226,194,116,0.95)'; g.lineWidth = 5;
      g.strokeRect(6, 6, W - 12, H - 12);
      g.strokeStyle = 'rgba(226,194,116,0.45)'; g.lineWidth = 2;
      g.strokeRect(16, 16, W - 32, H - 32);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#f2da9a';
      g.font = '700 44px ' + CN_FONT;
      g.fillText(title, W / 2, sub ? H / 2 - 14 : H / 2);
      if (sub) {
        g.fillStyle = 'rgba(170,195,225,0.8)';
        g.font = '22px ' + CN_FONT;
        g.fillText(sub, W / 2, H / 2 + 30);
      }
    });
  }

  // 展台：石座 + 顶部鎏金压条 + 前倾的说明牌
  function pedestal(x, z, w, d, title, sub) {
    var h = 1.0;
    box(w, h, d, M.plinth, x, h / 2, z, 0, true);
    box(w + 0.3, 0.12, d + 0.3, M.gold, x, h + 0.06, z, 0, false);
    var ft = fretTex();
    ft.wrapS = THREE.RepeatWrapping; ft.repeat.set(Math.max(w, d) / 2.2, 1);
    box(w + 0.34, 0.3, d + 0.34,
      new THREE.MeshStandardMaterial({ map: ft, roughness: 0.55, metalness: 0.35 }), x, h - 0.22, z, 0, false);
    var pl = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.66, w * 0.165),
      new THREE.MeshBasicMaterial({ map: plaqueTex(title, sub), transparent: true })
    );
    pl.position.set(x, 0.66, z + d / 2 + 0.06);
    pl.rotation.x = -0.42;
    scene.add(pl);
    return h + 0.12;
  }

  /* ---- 展品一：桁架桥（三角形桁架 + 桥面 + 栏杆 + 桥台）---- */
  function trussBridge(x, z, y0) {
    var g = new THREE.MeshStandardMaterial({ color: 0x9fb6d8, roughness: 0.4, metalness: 0.75 });
    var L = 9.0, H = 2.1, BW = 1.5, N = 6, step = L / N;
    var x0 = x - L / 2, yb = y0 + 0.25, yt = yb + H;

    [-BW / 2, BW / 2].forEach(function (dz) {
      strut(x0, yb, z + dz, x0 + L, yb, z + dz, 0.075, g);          // 下弦
      strut(x0, yt, z + dz, x0 + L, yt, z + dz, 0.075, g);          // 上弦
      for (var i = 0; i <= N; i++) {
        var xi = x0 + i * step;
        strut(xi, yb, z + dz, xi, yt, z + dz, 0.055, g);            // 竖杆
        if (i < N) strut(xi, yb, z + dz, xi + step, yt, z + dz, 0.055, g);  // 斜杆
      }
    });

    // 节点板 + 螺栓：桁架的"手工感"全在这些小东西上
    for (var k = 0; k <= N; k++) {
      var gx = x0 + k * step;
      [-BW / 2, BW / 2].forEach(function (dz) {
        var out = dz > 0 ? 1 : -1;
        [yb, yt].forEach(function (gy) {
          plate(0.60, 0.60, 0.05, M.goldDim, gx, gy, z + dz + out * 0.05);
          for (var q = 0; q < 4; q++) {
            bolt(gx + (q % 2 ? 0.18 : -0.18), gy + (q < 2 ? 0.18 : -0.18),
                 z + dz + out * 0.10, 0.032, M.gold, 'z');
          }
        });
      });
      // 上平联：顶部 X 形横撑，从侧面斜看桥才有立体感
      if (k < N) {
        strut(gx, yt, z - BW / 2, gx + step, yt, z + BW / 2, 0.030, M.goldDim);
        strut(gx, yt, z + BW / 2, gx + step, yt, z - BW / 2, 0.030, M.goldDim);
      }
      strut(gx, yt, z - BW / 2, gx, yt, z + BW / 2, 0.045, M.goldDim);
    }

    // 桥面：一块块木板铺出来，比一整块方块耐看
    var planks = 26;
    for (var p = 0; p < planks; p++) {
      plate(L / planks * 0.84, 0.06, BW + 0.30, M.door, x0 + (p + 0.5) * L / planks, yb - 0.10, z);
    }
    box(L + 0.2, 0.10, BW + 0.5, M.goldDim, x, yb - 0.18, z, 0, false);       // 桥面板底托

    // 栏杆：立柱 + 上下两道横杆
    [-BW / 2 - 0.19, BW / 2 + 0.19].forEach(function (dz) {
      strut(x0, yb + 0.38, z + dz, x0 + L, yb + 0.38, z + dz, 0.026, M.gold);
      strut(x0, yb + 0.72, z + dz, x0 + L, yb + 0.72, z + dz, 0.032, M.gold);
      for (var i = 0; i <= N * 2; i++) {
        var rx = x0 + i * (L / (N * 2));
        strut(rx, yb - 0.04, z + dz, rx, yb + 0.74, z + dz, 0.023, M.goldDim);
      }
    });

    // 两端桥台：桥是"架在地上"的，不是浮着
    [-1, 1].forEach(function (s) {
      var px = x + s * (L / 2 + 0.30);
      box(0.70, 0.66, BW + 0.72, M.plinth, px, yb - 0.32, z, 0, false);
      box(0.84, 0.09, BW + 0.86, M.goldDim, px, yb + 0.02, z, 0, false);
    });
  }

  /* ---- 展品二：斜拉桥（桥塔 + 双向拉索 + 桥面铺装）---- */
  function cableBridge(x, z, y0) {
    var steel = new THREE.MeshStandardMaterial({ color: 0xa8bedd, roughness: 0.35, metalness: 0.8 });
    var L = 9.5, BW = 1.5, PH = 3.4;
    var x0 = x - L / 2, yd = y0 + 0.22;

    // 桥面：木板 + 底托 + 两侧护栏
    var planks = 30;
    for (var p = 0; p < planks; p++) {
      plate(L / planks * 0.84, 0.06, BW + 0.18, M.door, x0 + (p + 0.5) * L / planks, yd + 0.03, z);
    }
    box(L + 0.2, 0.12, BW + 0.44, M.goldDim, x, yd - 0.06, z, 0, false);
    [-BW / 2 - 0.17, BW / 2 + 0.17].forEach(function (dz) {
      strut(x0, yd + 0.34, z + dz, x0 + L, yd + 0.34, z + dz, 0.024, M.gold);
      for (var i = 0; i <= 12; i++) {
        var rx = x0 + i * L / 12;
        strut(rx, yd, z + dz, rx, yd + 0.35, z + dz, 0.020, M.goldDim);
      }
    });
    // 桥面系梁（把护栏和桥面连成一体）
    [-1, 1].forEach(function (s) {
      box(0.16, 0.16, BW + 0.46, M.goldDim, x + s * (L / 2 - 0.1), yd - 0.02, z, 0, false);
    });

    [-1, 1].forEach(function (s) {
      var px = x + s * L * 0.18;
      [-BW / 2, BW / 2].forEach(function (dz) {
        // 承台 + 塔柱 + 柱顶压顶
        box(0.60, 0.30, 0.60, M.plinth, px, yd - 0.12, z + dz, 0, false);
        box(0.22, PH, 0.22, steel, px, yd + PH / 2, z + dz, 0, false);
        box(0.30, 0.15, 0.30, M.goldDim, px, yd + PH + 0.05, z + dz, 0, false);
        boltRing(px, yd + 0.06, z + dz, 0.17, 4, 0.035, M.gold);
      });
      // 交叉撑：让桥塔看起来是"桁架塔"，而不是两根光杆
      for (var k = 0; k < 4; k++) {
        var y1 = yd + 0.55 + k * (PH - 1.3) / 4, y2 = y1 + (PH - 1.3) / 4;
        strut(px, y1, z - BW / 2, px, y2, z + BW / 2, 0.028, M.goldDim);
        strut(px, y1, z + BW / 2, px, y2, z - BW / 2, 0.028, M.goldDim);
        strut(px, y1, z - BW / 2, px, y1, z + BW / 2, 0.028, M.goldDim);
      }
      box(0.26, 0.18, BW + 0.34, steel, px, yd + PH, z, 0, false);          // 塔顶横梁
      // 拉索：两个桥面边梁、左右各 3 根向两侧张开。
      // 根数不能多——两根塔的扇形会在中间交叉成一片网，远看反而看不出结构
      [-BW / 2, BW / 2].forEach(function (dz) {
        for (var i = 1; i <= 3; i++) {
          [-1, 1].forEach(function (e) {
            var ax = px + s * e * i * 0.86;
            strut(px, yd + PH - 0.22, z + dz, ax, yd + 0.16, z + dz, 0.032, M.goldDim);
            plate(0.14, 0.09, 0.20, M.gold, ax, yd + 0.07, z + dz);          // 索锚头
          });
        }
      });
    });
  }

  /* ---- 展品三：曲柄滑块机构（动的）---- */
  function crankSlider(x, z, y0) {
    var steel = new THREE.MeshStandardMaterial({ color: 0xa8bedd, roughness: 0.32, metalness: 0.85 });
    var base = new THREE.Group();
    base.position.set(x, y0, z);
    scene.add(base);

    var R = 0.62, L = 1.85, cy = 1.0, cx = -1.15;

    // 托板底座 + 地脚螺栓
    base.add(meshOf(new THREE.BoxGeometry(4.7, 0.10, 1.6), M.plinth, 0.15, 0.05, 0));
    [[-2.05, -0.66], [2.40, -0.66], [-2.05, 0.66], [2.40, 0.66]].forEach(function (p) {
      base.add(meshOf(new THREE.CylinderGeometry(0.065, 0.065, 0.10, 6), M.goldDim, p[0], 0.12, p[1]));
      base.add(meshOf(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), M.goldDim, p[0], 0.11, p[1]));
    });

    // 曲柄盘（整体绕 z 转）：盘 + 平衡块 + 轮毂 + 销座 + 销
    var crank = new THREE.Group();
    crank.position.set(cx, cy, 0);
    base.add(crank);
    crank.add(meshOf(new THREE.CylinderGeometry(R, R, 0.16, 36), M.goldDim, 0, 0, 0, Math.PI / 2));
    crank.add(meshOf(new THREE.CylinderGeometry(R * 0.60, R * 0.60, 0.28, 22), M.gold, -R * 0.42, 0, 0, Math.PI / 2));
    crank.add(meshOf(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 18), M.gold, 0, 0, 0, Math.PI / 2));
    crank.add(meshOf(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 16), M.gold, R, 0, 0, Math.PI / 2));
    crank.add(meshOf(new THREE.CylinderGeometry(0.085, 0.085, 0.46, 14), steel, R, 0, 0, Math.PI / 2));

    // 剖分式轴承座：两侧各一个，把曲柄轴架起来（不跟着转）
    [-1, 1].forEach(function (s) {
      base.add(meshOf(new THREE.BoxGeometry(0.40, cy, 0.18), M.plinth, cx, cy / 2, s * 0.30));
      base.add(meshOf(new THREE.CylinderGeometry(0.27, 0.27, 0.18, 18), M.plinth, cx, cy, s * 0.30, Math.PI / 2));
      base.add(meshOf(new THREE.CylinderGeometry(0.10, 0.10, 0.26, 14), M.gold, cx, cy, s * 0.30, Math.PI / 2));
      // 轴承盖螺栓
      [-0.19, 0.19].forEach(function (dz) {
        base.add(meshOf(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 6), M.gold, cx + dz, cy + 0.20, s * 0.30, Math.PI / 2));
      });
    });

    // 双导轨 + 导轨座
    [-0.19, 0.19].forEach(function (dz) {
      base.add(meshOf(new THREE.BoxGeometry(2.7, 0.07, 0.11), M.goldDim, 1.30, cy - 0.25, dz));
    });
    base.add(meshOf(new THREE.BoxGeometry(3.0, 0.10, 0.66), M.plinth, 1.30, cy - 0.33, 0));

    // 滑块：本体 + 两端盖板 + 销座 + 销轴
    var slider = new THREE.Group();
    base.add(slider);
    slider.add(meshOf(new THREE.BoxGeometry(0.54, 0.40, 0.42), M.gold));
    slider.add(meshOf(new THREE.BoxGeometry(0.09, 0.46, 0.50), M.goldDim, -0.27, 0, 0));
    slider.add(meshOf(new THREE.BoxGeometry(0.09, 0.46, 0.50), M.goldDim, 0.27, 0, 0));
    slider.add(meshOf(new THREE.CylinderGeometry(0.135, 0.135, 0.30, 16), M.gold, -0.34, 0, 0, Math.PI / 2));
    slider.add(meshOf(new THREE.CylinderGeometry(0.07, 0.07, 0.44, 12), steel, -0.34, 0, 0, Math.PI / 2));

    // 连杆：杆身每帧拉伸，大小头轴瓦每帧跟到两端
    var rod = meshOf(new THREE.CylinderGeometry(0.07, 0.07, 1, 10), steel);
    var bigEnd = meshOf(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 16), M.gold, 0, 0, 0, Math.PI / 2);
    var smallEnd = meshOf(new THREE.CylinderGeometry(0.13, 0.13, 0.30, 14), M.gold, 0, 0, 0, Math.PI / 2);
    base.add(rod); base.add(bigEnd); base.add(smallEnd);

    var A = new THREE.Vector3(), B = new THREE.Vector3();
    animatables.push(function (t) {
      var th = t * 1.15;
      crank.rotation.z = th;
      var px = cx + Math.cos(th) * R, py = cy + Math.sin(th) * R;
      var sx = cx + Math.sqrt(Math.max(L * L - Math.pow(Math.sin(th) * R, 2), 0.01));
      A.set(px, py, 0); B.set(sx, cy, 0);
      orient(rod, A, B);
      bigEnd.position.copy(A);
      smallEnd.position.copy(B);
      slider.position.set(sx + 0.34, cy, 0);
    });
  }

  /* ---- 展品四：齿轮传动（一对齿轮反向啮合）---- */
  function gearTrain(x, z, y0) {
    var GY = y0 + 1.5;                    // 两轮中心高
    var RA = 0.82, RB = 0.60, TEETH_A = 14, TEETH_B = 11;
    var CA = x - 0.71, CB = x + 0.71;     // 中心距 ≈ 两轮顶圆半径之和，看着就是"啮合"上的

    function gear(cx, rad, teeth, mat, spokes) {
      var g = new THREE.Group();
      g.position.set(cx, GY, z);          // ← 原来这里写死 z=0，齿轮组会飘在大厅正中，不在展台上
      var geo = new THREE.ExtrudeGeometry(gearShape(rad, teeth, rad * 0.17, spokes), {
        depth: 0.20, curveSegments: 6,
        bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1
      });
      geo.translate(0, 0, -0.10);
      g.add(new THREE.Mesh(geo, mat));
      g.add(meshOf(new THREE.CylinderGeometry(rad * 0.30, rad * 0.30, 0.30, 20), M.gold, 0, 0, 0, Math.PI / 2));   // 轮毂
      g.add(meshOf(new THREE.CylinderGeometry(rad * 0.20, rad * 0.20, 0.34, 12), M.goldDim, 0, 0, 0, Math.PI / 2));
      scene.add(g);
      return g;
    }
    var a = gear(CA, RA, TEETH_A, M.goldDim, 5);
    var b = gear(CB, RB, TEETH_B, M.gold, 4);

    // 底座 + 地脚螺栓
    box(2.7, 0.10, 0.92, M.plinth, x, y0 + 0.05, z, 0, false);
    [[-1.20, -0.36], [1.20, -0.36], [-1.20, 0.36], [1.20, 0.36]].forEach(function (p) {
      bolt(x + p[0], y0 + 0.12, z + p[1], 0.045, M.goldDim, 'y');
    });

    // 每根轴两个轴承座，把齿轮架住
    [[CA, RA], [CB, RB]].forEach(function (gs) {
      [-1, 1].forEach(function (s) {
        var zz = z + s * 0.26;
        box(0.36, GY - y0, 0.16, M.plinth, gs[0], (GY + y0) / 2, zz, 0, false);      // 轴承柱
        cyl(RA * 0.30, RA * 0.30, 0.16, M.plinth, gs[0], GY, zz, 18).rotation.x = Math.PI / 2;
        cyl(0.09, 0.09, 0.26, M.gold, gs[0], GY, zz, 14).rotation.x = Math.PI / 2;   // 轴端
        bolt(gs[0], y0 + 0.10, zz + 0.13, 0.04, M.goldDim, 'z');
      });
    });

    animatables.push(function (t) {
      a.rotation.z = t * 0.55;
      b.rotation.z = -t * 0.55 * (TEETH_A / TEETH_B);   // 齿数比决定转速比，反向
    });
  }

  /* ---- 展品五：单摆（摆动 + 角度刻度标尺）---- */
  function pendulum(x, z, y0) {
    var PIV = y0 + 2.82, RODL = 2.24, BOBR = 0.30;

    // 底座：石板 + 鎏金压边 + 地脚螺栓
    box(0.88, 0.11, 0.88, M.plinth, x, y0 + 0.055, z, 0, false);
    box(1.04, 0.04, 1.04, M.goldDim, x, y0 + 0.008, z, 0, false);
    [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]].forEach(function (p) {
      bolt(x + p[0], y0 + 0.13, z + p[1], 0.05, M.gold, 'y');
    });
    // 立柱 + 两侧斜撑：立柱不是"插"在底座上的
    box(0.16, 2.76, 0.16, M.goldDim, x, y0 + 1.49, z, 0, false);
    [-1, 1].forEach(function (s) {
      strut(x, y0 + 2.46, z + s * 0.09, x, y0 + 0.14, z + s * 0.40, 0.032, M.goldDim);
    });
    // 顶部悬臂梁 + 两个吊耳（轴承座）
    box(1.72, 0.16, 0.40, M.gold, x, y0 + 2.96, z, 0, false);
    [-1, 1].forEach(function (s) {
      plate(0.20, 0.36, 0.055, M.plinth, x + s * 0.62, y0 + 2.78, z + 0.18);
      plate(0.20, 0.36, 0.055, M.plinth, x + s * 0.62, y0 + 2.78, z - 0.18);
      bolt(x + s * 0.62, y0 + 2.60, z + 0.22, 0.035, M.gold, 'z');
      bolt(x + s * 0.62, y0 + 2.60, z - 0.22, 0.035, M.gold, 'z');
    });

    // 摆：轴承位 + 摆杆 + 上下抱箍 + 摆球 + 赤道箍
    var pivot = new THREE.Group();
    pivot.position.set(x, PIV, z);
    scene.add(pivot);
    pivot.add(meshOf(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 14), M.gold, 0, 0, 0, Math.PI / 2));
    pivot.add(meshOf(new THREE.CylinderGeometry(0.05, 0.05, RODL, 10), M.goldDim, 0, -RODL / 2, 0));
    pivot.add(meshOf(new THREE.CylinderGeometry(0.095, 0.095, 0.18, 12), M.gold, 0, -0.42, 0));
    pivot.add(meshOf(new THREE.CylinderGeometry(0.115, 0.115, 0.14, 12), M.gold, 0, -RODL + BOBR * 0.72, 0));
    pivot.add(meshOf(new THREE.SphereGeometry(BOBR, 24, 18), M.gold, 0, -RODL, 0));
    pivot.add(meshOf(new THREE.TorusGeometry(BOBR * 0.99, 0.022, 8, 30), M.goldDim, 0, -RODL, 0, Math.PI / 2));

    // 背后的角度刻度标尺：一眼看出"摆了多少度"
    var arcTex = canvasTex(320, 260, function (g, W) {
      var cx = W / 2, R0 = 224;
      g.strokeStyle = 'rgba(226,194,116,0.72)'; g.lineWidth = 1.6;
      for (var d = -40; d <= 40; d += 5) {
        var th = d * Math.PI / 180, sn = Math.sin(th), cs = Math.cos(th);
        var long = (d % 10 === 0), r2 = R0 - (long ? 20 : 11);
        g.beginPath();
        g.moveTo(cx + sn * R0, cs * R0);
        g.lineTo(cx + sn * r2, cs * r2);
        g.stroke();
        if (long) {
          g.fillStyle = 'rgba(170,195,225,0.85)';
          g.font = '15px ' + CN_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(d + '°', cx + sn * (R0 + 15), cs * (R0 + 15));
        }
      }
      g.strokeStyle = 'rgba(226,194,116,0.28)'; g.lineWidth = 1.4;
      g.beginPath();
      g.arc(cx, 0, R0, Math.PI / 2 - 40 * Math.PI / 180, Math.PI / 2 + 40 * Math.PI / 180);
      g.stroke();
    });
    var scale = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.6),
      new THREE.MeshBasicMaterial({ map: arcTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    scale.position.set(x, PIV - 1.3, z - 0.30);
    scene.add(scale);

    animatables.push(function (t) {
      pivot.rotation.z = Math.sin(t * 1.5) * 0.42;
    });
  }

  /* ---- 展品六：简支梁受集中力（静力学的招牌例子）---- */
  function beamDemo(x, z, y0) {
    var steel = new THREE.MeshStandardMaterial({ color: 0xa8bedd, roughness: 0.35, metalness: 0.8 });
    var L = 3.6, H = 0.40, W = 0.30, yb = y0 + 1.25;
    var yBot = yb - H / 2, yPlate = y0 + 0.075;

    // 工字截面梁（不是一根光溜溜的方条）
    var beam = new THREE.Mesh(iBeamGeo(L, H, W, 0.06, 0.075), steel);
    beam.position.set(x, yb, z);
    scene.add(beam);
    // 腹板加劲肋
    for (var i = -2; i <= 2; i++) {
      plate(0.05, H - 0.15, W + 0.05, M.goldDim, x + i * 0.72, yb, z);
    }
    // 梁端封头
    [-1, 1].forEach(function (s) {
      plate(0.05, H + 0.02, W + 0.02, M.goldDim, x + s * L / 2, yb, z);
    });

    // 左端：固定铰支座（底板 + 两块耳板 + 销轴 + 螺栓）
    plate(0.94, 0.07, 0.72, M.plinth, x - L / 2, yPlate, z);
    [-0.17, 0.17].forEach(function (dz) {
      plate(0.40, yBot - yPlate - 0.035, 0.05, M.gold, x - L / 2, (yBot + yPlate) / 2, z + dz);
      bolt(x - L / 2, y0 + 0.26, z + dz * 1.9, 0.038, M.gold, 'z');
    });
    cyl(0.07, 0.07, 0.42, M.gold, x - L / 2, yBot - 0.035, z, 14).rotation.x = Math.PI / 2;

    // 右端：滚动铰支座（底板 + 两个滚轮 + 承压板 + 立柱）
    plate(1.06, 0.07, 0.78, M.plinth, x + L / 2, yPlate, z);
    [-0.17, 0.17].forEach(function (dz) {
      cyl(0.10, 0.10, 0.46, M.gold, x + L / 2, yPlate + 0.135, z + dz, 16).rotation.x = Math.PI / 2;
    });
    plate(0.52, 0.05, 0.62, M.goldDim, x + L / 2, yPlate + 0.26, z);
    box(0.40, yBot - yPlate - 0.29, 0.30, M.gold, x + L / 2, (yBot + yPlate + 0.29) / 2, z, 0, false);

    // 荷载：3 根向下的箭头 + 分布线 + 标注牌
    var arrow = new THREE.MeshStandardMaterial({ color: 0xff7a6b, emissive: 0xff4433, emissiveIntensity: 0.7, roughness: 0.5 });
    for (var k = -1; k <= 1; k++) {
      var cx = x + k * 0.9;
      cyl(0.11, 0.0, 0.30, arrow, cx, yb + H / 2 + 0.32, z, 12).rotation.z = Math.PI;   // 箭头
      box(0.05, 0.36, 0.05, arrow, cx, yb + H / 2 + 0.64, z, 0, false);                 // 箭杆
    }
    box(2.2, 0.06, 0.14, arrow, x, yb + H / 2 + 0.84, z, 0, false);                     // 荷载分布线
    var fTex = canvasTex(256, 64, function (g, W2, H2) {
      g.fillStyle = '#ff8f7f';
      g.font = '700 38px ' + CN_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('P', 62, H2 / 2);
      g.fillStyle = 'rgba(190,210,235,0.92)';
      g.font = '22px ' + CN_FONT;
      g.fillText('集中力', 152, H2 / 2);
    });
    var fPl = new THREE.Mesh(
      new THREE.PlaneGeometry(1.30, 0.33),
      new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    fPl.position.set(x, yb + H / 2 + 1.04, z);
    scene.add(fPl);
  }

  function buildExhibits() {
    // 桁架桥
    var h1 = pedestal(-12, -12, 10.4, 3.0, '桁架桥', 'TRUSS BRIDGE · 二力杆与节点法');
    trussBridge(-12, -12, h1);
    // 斜拉桥
    var h2 = pedestal(12, -12, 10.8, 3.0, '斜拉桥', 'CABLE-STAYED BRIDGE · 拉索受力');
    cableBridge(12, -12, h2);
    // 曲柄滑块机构
    var h3 = pedestal(-12, 12, 5.4, 3.0, '曲柄滑块机构', 'SLIDER-CRANK · 运动学合成');
    crankSlider(-12, 12, h3);
    // 齿轮传动
    var h4 = pedestal(12, 12, 4.6, 3.0, '齿轮传动', 'GEAR TRAIN · 定轴转动');
    gearTrain(12, 12, h4);
    // 单摆
    var h5 = pedestal(-19, -4, 3.0, 3.0, '单摆', 'PENDULUM · 微幅振动');
    pendulum(-19, -4, h5);
    // 简支梁受集中力
    var h6 = pedestal(19, 4, 4.6, 3.0, '简支梁受力', 'SIMPLY SUPPORTED BEAM · 平衡方程');
    beamDemo(19, 4, h6);
  }

  /* ======================== 中式元素 ======================== */
  // 回纹金带：传统“回”字连续纹样，用来做墙裙和匾额镶边
  function fretTex() {
    return canvasTex(256, 64, function (g, W, H) {
      g.fillStyle = '#5b1a12'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(226,194,116,0.95)'; g.lineWidth = 3; g.lineCap = 'square';
      for (var x = 0; x < W; x += 32) {
        g.beginPath();
        g.moveTo(x + 6, H - 10); g.lineTo(x + 6, 12);
        g.lineTo(x + 23, 12); g.lineTo(x + 23, H - 15);
        g.lineTo(x + 14, H - 15); g.lineTo(x + 14, 21);
        g.stroke();
      }
      g.strokeStyle = 'rgba(226,194,116,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 4); g.lineTo(W, 4); g.stroke();
      g.beginPath(); g.moveTo(0, H - 4); g.lineTo(W, H - 4); g.stroke();
    });
  }

  // 匾额：朱底金字 + 回纹镶边，字距按字数均分
  function tabletTex(text) {
    var s = String(text || '');
    return canvasTex(900, 260, function (g, W, H) {
      var grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#8e2c18');
      grad.addColorStop(0.5, '#6d1f11');
      grad.addColorStop(1, '#4e1409');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);

      g.strokeStyle = '#e2c274'; g.lineWidth = 11; g.strokeRect(13, 13, W - 26, H - 26);
      g.strokeStyle = 'rgba(226,194,116,0.5)'; g.lineWidth = 3; g.strokeRect(33, 33, W - 66, H - 66);

      // 四角回纹
      g.strokeStyle = 'rgba(240,216,148,0.9)'; g.lineWidth = 4;
      [[24, 24, 1, 1], [W - 24, 24, -1, 1], [24, H - 24, 1, -1], [W - 24, H - 24, -1, -1]].forEach(function (c) {
        g.beginPath();
        g.moveTo(c[0] + c[2] * 26, c[1]);
        g.lineTo(c[0], c[1]);
        g.lineTo(c[0], c[1] + c[3] * 26);
        g.stroke();
      });

      // 金字：按字数均分字距，做出匾额的味道
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 118px ' + CN_FONT;
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 10;
      var n = Math.max(s.length, 1);
      var span = W - 190, x0 = W / 2 - span / 2;
      g.fillStyle = '#f2da9a';
      for (var i = 0; i < n; i++) {
        g.fillText(s.charAt(i), n === 1 ? W / 2 : x0 + span * (i / (n - 1)), H / 2 + 6);
      }
      g.shadowBlur = 0;
    });
  }

  // 斗拱：柱头上一层层往外挑的木构，中式建筑最标志性的构件
  function dougong(x, y, z) {
    // 坐斗
    box(0.95, 0.34, 0.95, M.goldDim, x, y, z, 0, false);
    // 第一跳：十字相交的拱
    box(2.5, 0.22, 0.32, M.gold, x, y + 0.34, z, 0, false);
    box(0.32, 0.22, 2.5, M.gold, x, y + 0.34, z, 0, false);
    // 升
    box(0.55, 0.2, 0.55, M.goldDim, x - 0.95, y + 0.48, z, 0, false);
    box(0.55, 0.2, 0.55, M.goldDim, x + 0.95, y + 0.48, z, 0, false);
    box(0.55, 0.2, 0.55, M.goldDim, x, y + 0.48, z - 0.95, 0, false);
    box(0.55, 0.2, 0.55, M.goldDim, x, y + 0.48, z + 0.95, 0, false);
    // 第二跳（转 45°，收小一圈）
    box(1.9, 0.2, 0.28, M.gold, x, y + 0.7, z, Math.PI / 4, false);
    box(1.9, 0.2, 0.28, M.gold, x, y + 0.7, z, -Math.PI / 4, false);
    box(0.7, 0.22, 0.7, M.goldDim, x, y + 0.9, z, 0, false);
  }

  // 红灯笼：挂在梁下，轻轻晃
  function lantern(x, y, z, phase) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);

    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), M.goldDim);
    cord.position.y = 0.65; g.add(cord);
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), M.lantern);
    body.scale.y = 0.82; g.add(body);
    var capT = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.13, 14), M.gold);
    capT.position.y = 0.35; g.add(capT);
    var capB = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.13, 14), M.gold);
    capB.position.y = -0.35; g.add(capB);
    var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.55, 6), M.gold);
    tassel.position.y = -0.68; g.add(tassel);

    animatables.push(function (t) {
      g.rotation.z = Math.sin(t * 0.9 + phase) * 0.08;
      g.rotation.x = Math.cos(t * 0.72 + phase) * 0.055;
    });
  }

  function buildLanterns() {
    var y = ROOM.h - 2.5;
    // 柱廊两排
    [-20, 20].forEach(function (x) {
      [-15.5, -5.5, 5.5, 15.5].forEach(function (z, i) {
        lantern(x, y, z, x * 0.1 + i);
      });
    });
    // 中庭两対，正对参观轴线
    [-8, 8].forEach(function (x) {
      [-10.5, 10.5].forEach(function (z, i) {
        lantern(x, y + 0.4, z, x * 0.13 + i + 2);
      });
    });
  }

  // 藻井：八角层层收进，中心一朵金莲（中式天花最高规格的做法）
  function buildCaisson() {
    var y0 = ROOM.h - 0.1;
    var steps = [
      { r: 11.0, h: 0.5, dy: -0.25 },
      { r: 8.6, h: 0.7, dy: -0.75 },
      { r: 6.2, h: 0.9, dy: -1.45 }
    ];
    steps.forEach(function (s, i) {
      var drum = cyl(s.r, s.r, s.h, M.ceil, 0, y0 + s.dy, 0, 8);
      drum.rotation.y = Math.PI / 8;
      box(s.r * 1.5, 0.14, 0.3, M.gold, 0, y0 + s.dy + s.h / 2, 0, Math.PI / 4, false);
      if (i > 0) {
        var ring = cyl(s.r + 0.5, s.r + 0.5, 0.16, M.goldDim, 0, y0 + s.dy + s.h / 2, 0, 8);
        ring.rotation.y = Math.PI / 8;
      }
    });

    // 中心金莲
    var cy = y0 - 2.0;
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 16), M.gold);
    core.position.y = cy;
    scene.add(core);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      var petal = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 4), M.goldDim);
      petal.position.set(Math.cos(a) * 1.25, cy - 0.12, Math.sin(a) * 1.25);
      petal.rotation.z = Math.cos(a) * 1.05;
      petal.rotation.x = -Math.sin(a) * 1.05;
      scene.add(petal);
    }
    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 18, 14),
      new THREE.MeshStandardMaterial({
        color: 0xffe6b0, emissive: 0xffd9a0, emissiveIntensity: 1.5,
        transparent: true, opacity: 0.22, roughness: 0.4
      })
    );
    glow.position.y = cy;
    scene.add(glow);
  }

  // 回纹金带：沿四面墙腰做一圈，把墙压住
  function buildFretBands() {
    var t = fretTex();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(ROOM.w / 2.2, 1);
    var t2 = fretTex();
    t2.wrapS = THREE.RepeatWrapping;
    t2.repeat.set(ROOM.d / 2.2, 1);

    var mNS = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35 });
    var mEW = new THREE.MeshStandardMaterial({ map: t2, roughness: 0.55, metalness: 0.35 });
    var y = 1.6, h = 0.62;        // 做成墙裙高度，避开展板上方的匾额
    box(ROOM.w - 0.4, h, 0.12, mNS, 0, y, -HALF_D + 0.12, 0, false);
    box(ROOM.w - 0.4, h, 0.12, mNS, 0, y, HALF_D - 0.12, 0, false);
    box(0.12, h, ROOM.d - 0.4, mEW, -HALF_W + 0.12, y, 0, 0, false);
    box(0.12, h, ROOM.d - 0.4, mEW, HALF_W - 0.12, y, 0, 0, false);
  }

  // 中式门罩：南门上方一顶四坡顶，配斗拱，做成"入园门"的样子
  function buildDoorCanopy() {
    var z = HALF_D - 0.9, y = 10.6;
    // 四坡屋顶（四棱台 = 四坡顶的抽象）
    var roof = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 8.2, 2.4, 4), M.roofTile);
    roof.position.set(0, y, z - 0.5);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    // 正脊 + 檐口金饰
    box(2.0, 0.22, 0.5, M.gold, 0, y + 1.15, z - 0.5, 0, false);
    box(12.6, 0.16, 0.24, M.gold, 0, y - 1.1, z - 0.5, 0, false);
    box(0.24, 0.16, 11.6, M.gold, 0, y - 1.1, z - 0.5, 0, false);
    // 斗拱层
    for (var i = -2; i <= 2; i++) dougong(i * 2.2, y - 1.6, z - 0.5);
    box(13.0, 0.34, 1.1, M.goldDim, 0, y - 1.9, z - 0.5, 0, false);
  }

  function buildChineseElements() {
    buildFretBands();
    buildCaisson();
    buildLanterns();
    buildDoorCanopy();
    // 每根柱头一组斗拱
    [-20, -11, 11, 20].forEach(function (z) {
      [-20, 20].forEach(function (x) { dougong(x, ROOM.h - 1.95, z); });
    });
  }

  /* ======================== 展馆 ======================== */
  function buildHalls() {
    (DATA.halls || []).forEach(function (spec) {
      var dir = WALL_DIR[spec.wall] || WALL_DIR.north;
      var isNS = (spec.wall === 'north' || spec.wall === 'south');

      // dir.n 是“由墙指向室内”的法线，所以墙面位置 = -法线 × 半宽。
      // north(z=-26) → n=[0,0,1] → bz=-25.78；south → bz=+25.78；west/east 同理。
      // offset：沿墙方向的偏移，用来给南墙正中让出大门。
      var wallOff = 0.22, o = spec.offset || 0;
      var bx = -dir.n[0] * (HALF_W - wallOff) + (isNS ? o : 0);
      var bz = -dir.n[2] * (HALF_D - wallOff) + (isNS ? 0 : o);
      var fx = dir.n[0], fz = dir.n[2];              // 由墙指向室内
      var ax = isNS ? 1 : 0, az = isNS ? 0 : 1;      // 沿墙方向

      var boardW = 14, boardH = 5.0, boardY = 4.2;
      var boardT = boardTex(spec);
      var board = new THREE.Mesh(
        new THREE.PlaneGeometry(boardW, boardH),
        new THREE.MeshStandardMaterial({
          map: boardT, emissiveMap: boardT, roughness: 0.5, metalness: 0.1,
          emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.5
        })
      );
      board.position.set(bx, boardY, bz);
      board.rotation.y = dir.yaw;
      scene.add(board);

      // 鎏金画框：上下横框 + 左右竖框
      var fw = 0.55, halfW = boardW / 2 + fw / 2, halfH = boardH / 2 + fw / 2;
      [boardY + halfH, boardY - halfH].forEach(function (yy) {
        var p = place(bx, bz, ax, az, fx, fz, 0, 0.07);
        if (isNS) box(boardW + fw * 2, fw, 0.3, M.gold, p.x, yy, p.z, 0, false);
        else box(0.3, fw, boardW + fw * 2, M.gold, p.x, yy, p.z, 0, false);
      });
      [halfW, -halfW].forEach(function (a) {
        var p = place(bx, bz, ax, az, fx, fz, a, 0.07);
        if (isNS) box(fw, boardH + fw * 2, 0.3, M.gold, p.x, boardY, p.z, 0, false);
        else box(0.3, boardH + fw * 2, fw, M.gold, p.x, boardY, p.z, 0, false);
      });

      // 两侧立柱式灯箱
      var neonMat = new THREE.MeshStandardMaterial({
        color: spec.color, emissive: new THREE.Color(spec.color), emissiveIntensity: 2.0, roughness: 0.4
      });
      [boardW / 2 + 1.6, -(boardW / 2 + 1.6)].forEach(function (a) {
        var p = place(bx, bz, ax, az, fx, fz, a, 1.1);
        box(0.7, 0.55, 0.7, M.gold, p.x, 0.28, p.z, 0, false);
        cyl(0.28, 0.34, 9.2, M.goldDim, p.x, 4.9, p.z, 18);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), neonMat);
        lamp.position.set(p.x, 9.9, p.z);
        scene.add(lamp);
      });

      // 展台基座 + 台阶（挡人，要能站上去看）
      var p = place(bx, bz, ax, az, fx, fz, 0, 1.7);
      if (isNS) {
        box(boardW * 0.92, 0.9, 2.0, M.plinth, p.x, 0.45, p.z, 0, true);
        box(boardW * 0.92 + 0.6, 0.16, 2.6, M.gold, p.x, 0.08, p.z, 0, false);
      } else {
        box(2.0, 0.9, boardW * 0.92, M.plinth, p.x, 0.45, p.z, 0, true);
        box(2.6, 0.16, boardW * 0.92 + 0.6, M.gold, p.x, 0.08, p.z, 0, false);
      }

      // 地面光圈：走到附近会亮起来
      var disc = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.6, 0.05, 44),
        new THREE.MeshStandardMaterial({
          color: spec.color, emissive: new THREE.Color(spec.color), emissiveIntensity: 0.9,
          transparent: true, opacity: 0.72
        })
      );
      var tDist = 12;                     // 观看位：站这个距离，整块展板刚好进画面
      var t = place(bx, bz, ax, az, fx, fz, 0, tDist);
      disc.position.set(t.x, 0.1, t.z);
      scene.add(disc);

      /* ---- 展位的中式外框：匾额 + 斗拱 + 一对红灯笼（中式神龛的做法）---- */
      var tablet = new THREE.Mesh(
        new THREE.PlaneGeometry(6.6, 1.9),
        new THREE.MeshBasicMaterial({ map: tabletTex(spec.plaque || spec.name), transparent: true })
      );
      var tp = place(bx, bz, ax, az, fx, fz, 0, 0.4);
      tablet.position.set(tp.x, boardY + boardH / 2 + 1.15, tp.z);
      tablet.rotation.y = dir.yaw;
      scene.add(tablet);
      // 匾额上方三组斗拱
      [-2.1, 0, 2.1].forEach(function (a) {
        var dp = place(bx, bz, ax, az, fx, fz, a, 0.9);
        dougong(dp.x, boardY + boardH / 2 + 2.45, dp.z);
      });
      // 展板两侧各挂一盏红灯笼，间距随板宽走
      [-1, 1].forEach(function (sg, si) {
        var lp = place(bx, bz, ax, az, fx, fz, sg * (boardW / 2 + 1.6), 1.6);
        lantern(lp.x, 8.4, lp.z, (spec.id || '').length + si * 1.7);
      });

      halls.push({
        spec: spec, point: new THREE.Vector3(t.x, EYE, t.z), faceYaw: dir.yaw,
        board: board, disc: disc, baseEmissive: 0.5
      });
    });
  }

  // 沿墙定位：a = 沿墙方向偏移，n = 垂直于墙朝室内的偏移
  function place(bx, bz, ax, az, fx, fz, a, n) {
    return { x: bx + ax * a + fx * n, z: bz + az * a + fz * n };
  }

  /* ======================== 灯光 ======================== */
  function buildLights() {
    // three r155+ 用物理光照单位：环境光的实际亮度约为 intensity/π，所以数值要给得大一些
    scene.add(new THREE.AmbientLight(0xa8c0e4, 2.4));
    scene.add(new THREE.HemisphereLight(0xd6e6ff, 0x2a3558, 1.9));
    var key = new THREE.DirectionalLight(0xfff3e0, 2.6);
    key.position.set(16, 34, 14);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x7f9fdc, 1.6);
    fill.position.set(-20, 20, -18);
    scene.add(fill);
    // 两盏重点光，压在南/北两块展板上
    [[0, -16], [18, 16]].forEach(function (p) {
      var sp = new THREE.PointLight(0xffffff, 300, 42, 2);
      sp.position.set(p[0], 9.5, p[1]);
      scene.add(sp);
    });
  }

  /* ======================== 碰撞 & 移动 ======================== */
  function blocked(x, z) {
    if (x < -HALF_W + WALL_IN || x > HALF_W - WALL_IN) return true;
    if (z < -HALF_D + WALL_IN || z > HALF_D - WALL_IN) return true;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x > c.x0 - BODY && x < c.x1 + BODY && z > c.z0 - BODY && z < c.z1 + BODY) return true;
    }
    return false;
  }

  function move(dt) {
    var speed = (keys.shift ? RUN : WALK) * dt;
    var f = 0, s = 0;
    if (keys.fwd) f += 1;
    if (keys.back) f -= 1;
    if (keys.left) s -= 1;
    if (keys.right) s += 1;
    if (touchMove) f += 1;
    if (!f && !s) return;

    var len = Math.hypot(f, s) || 1;
    f /= len; s /= len;
    var sinY = Math.sin(yaw), cosY = Math.cos(yaw);
    var dx = (-sinY * f + cosY * s) * speed;
    var dz = (-cosY * f - sinY * s) * speed;

    // 分轴解算，撞墙时还能沿墙滑动
    if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
    if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
  }

  /* ======================== 交互提示 ======================== */
  function refreshActive() {
    var best = null, bestD = Infinity;
    for (var i = 0; i < halls.length; i++) {
      var d = halls[i].point.distanceTo(pos);
      if (d < TRIGGER && d < bestD) { bestD = d; best = halls[i]; }
    }
    if (best !== active) {
      if (active) {                       // 离开时把光圈和亮度复位
        active.board.material.emissiveIntensity = active.baseEmissive;
        active.disc.scale.setScalar(1);
      }
      active = best;
      var tip = $('hallPrompt');
      if (tip) {
        if (active) {
          tip.innerHTML = '按 <b>E</b> 查看 <b style="color:' + (active.spec.color || '#fff') + '">' +
            (active.spec.icon || '') + ' ' + (active.spec.name || '') + '</b>';
          tip.classList.add('show');
        } else {
          tip.classList.remove('show');
        }
      }
    }
    if (active) {
      // 站到跟前时展板亮起来
      var pulse = 0.92 + Math.sin(performance.now() / 320) * 0.22;
      active.board.material.emissiveIntensity = pulse;
      active.disc.scale.setScalar(1 + Math.sin(performance.now() / 320) * 0.05);
    }
  }

  /* ======================== 内容弹层 ======================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  function renderBlock(b) {
    var h = '';
    if (b.title) h += '<h3 class="hb-title">' + esc(b.title) + '</h3>';
    var items = b.items || [];

    switch (b.type) {
      case 'paragraph':
        h += '<p class="hb-p">' + nl2br(b.text) + '</p>';
        break;

      case 'list':
        h += '<dl class="hb-list">';
        items.forEach(function (it) {
          h += '<div><dt>' + esc(it.k) + '</dt><dd>' + esc(it.v) + '</dd></div>';
        });
        h += '</dl>';
        break;

      case 'stats':
        h += '<div class="hb-stats">';
        items.forEach(function (it) {
          h += '<div class="hb-stat"><div class="n">' + esc(it.num) +
            (it.unit ? '<i>' + esc(it.unit) + '</i>' : '') + '</div><div class="l">' + esc(it.label) + '</div></div>';
        });
        h += '</div>';
        break;

      case 'timeline':
        h += '<ul class="hb-timeline">';
        items.forEach(function (it) {
          h += '<li><div class="y">' + esc(it.year) + '</div><div class="c">' +
            (it.title ? '<h4>' + esc(it.title) + '</h4>' : '') +
            (it.text ? '<p>' + nl2br(it.text) + '</p>' : '') + '</div></li>';
        });
        h += '</ul>';
        break;

      case 'cards':
        h += '<div class="hb-cards">';
        items.forEach(function (it) {
          h += '<div class="hb-card">'
            + (it.icon ? '<div class="ic">' + esc(it.icon) + '</div>' : '')
            + '<h4>' + esc(it.title) + '</h4>'
            + (it.subtitle ? '<div class="sub">' + esc(it.subtitle) + '</div>' : '')
            + (it.body ? '<p>' + nl2br(it.body) + '</p>' : '')
            + ((it.tags || []).length ? '<div class="tags">' + it.tags.map(function (t) {
                return '<span>' + esc(t) + '</span>';
              }).join('') + '</div>' : '')
            + '</div>';
        });
        h += '</div>';
        break;

      case 'media':
        // 图片 / 视频。视频文件放 hall_media/ 下。中文文件名要 encodeURI，否则部分浏览器拿不到文件。
        // 视频**不**内嵌播放器：渲染成一张卡片（封面 + 播放键），点一下弹大窗播放（见 openMediaView）。
        // 每张卡下面另挂一条「原视频链接」，可以直接在新窗口打开/存下来。
        h += '<div class="hb-media">';
        items.forEach(function (it) {
          var raw = it.src || '';
          var src = encodeURI(raw);
          var el;
          if (it.kind === 'video') {
            // 有封面就用封面图；没给封面就退回 <video preload=metadata> 让它自己显示第一帧
            var cover = it.poster
              ? '<img class="m-el m-cover" loading="lazy" alt="' + esc(it.title || '') + '" src="' + esc(encodeURI(it.poster)) + '">'
              : '<video class="m-el m-cover" preload="metadata" muted playsinline src="' + esc(src) + '"></video>';
            el = '<button class="m-open" type="button"'
              + ' data-mv-src="' + esc(raw) + '" data-mv-title="' + esc(it.title || '') + '"'
              + ' title="点击播放">' + cover + '<span class="m-play">▶</span></button>';
          } else {
            el = '<img class="m-el" loading="lazy" alt="' + esc(it.title || '') + '" src="' + esc(src) + '">';
          }
          h += '<figure class="hb-media-item' + (it.kind === 'video' ? ' is-video' : '') + '">' + el
            + ((it.title || it.caption)
                ? '<figcaption class="m-cap">'
                  + (it.title ? '<h4>' + esc(it.title) + '</h4>' : '')
                  + (it.caption ? '<p>' + esc(it.caption) + '</p>' : '')
                  + '</figcaption>'
                : '')
            + (it.kind === 'video'
                ? '<a class="m-link" href="' + esc(src) + '" target="_blank" rel="noopener"'
                  + ' title="在新窗口直接打开这个视频文件">' + esc(raw) + '</a>'
                : '')
            + '</figure>';
        });
        h += '</div>';
        break;

      case 'medals':
        h += '<div class="hb-medals">';
        items.forEach(function (it) {
          h += '<div class="hb-medal"><div class="m-ic">🏅</div><div class="m-bd">'
            + '<h4>' + esc(it.name) + '</h4>'
            + '<div class="m-meta">'
            + (it.level ? '<span class="lv">' + esc(it.level) + '</span>' : '')
            + (it.year ? '<span>' + esc(it.year) + '</span>' : '')
            + (it.org ? '<span>' + esc(it.org) + '</span>' : '')
            + '</div></div></div>';
        });
        h += '</div>';
        break;

      default:
        h += '<p class="hb-p">【未知区块类型：' + esc(b.type) + '】</p>';
    }
    return '<section class="hb-block">' + h + '</section>';
  }

  function openHall(h) {
    if (!h || !h.spec) return;
    var spec = h.spec;
    releaseLock();
    var ov = $('hallPanel');
    $('hpIcon').textContent = spec.icon || '🏛️';
    $('hpName').textContent = spec.name || '';
    $('hpSub').textContent = spec.subtitle || '';
    $('hpBody').innerHTML = (spec.blocks || []).map(renderBlock).join('') ||
      '<p class="hb-p" style="color:#8fa7c8">该展馆还没有内容 —— 打开 <code>js/hall_data.js</code>，找到 id 为 “' + esc(spec.id) + '” 的展馆，把 blocks 里的【待填】替换掉即可。</p>';
    ov.style.setProperty('--hall-accent', spec.color || '#3b82f6');
    ov.classList.add('show');
    $('hpBody').scrollTop = 0;
    updateCover();          // 弹层打开了，“点击进入”遮罩不能再盖上来（它 z-index 更高）
  }
  function closePanel() {
    var ov = $('hallPanel');
    if (ov) ov.classList.remove('show');
    if (!touchMode) requestLock();
  }

  /* ======================== 视频大窗播放 ========================
     展板上点一下视频卡 → 弹出覆盖全屏的播放器（标记在 hall.html 里，样式也是）。
     全站只用这一个 <video>：换片子改 src，关掉时把 src 清空再 load() ——
     只 pause() 不清 src 的话浏览器会接着在后台缓冲甚至继续播。
     ================================================================= */
  var $mv, $mvVideo, $mvTitle, $mvLink, $mvFile;

  function mediaViewOpen() {
    return !!($mv && $mv.classList.contains('show'));
  }

  function openMediaView(src, title) {
    if (!$mv) return;
    var url = encodeURI(src || '');
    $mvVideo.src = url;
    $mvTitle.textContent = title || src || '授课视频';
    $mvLink.href = url;
    $mvFile.textContent = src || '';
    // 大窗不在 #hallPanel 里，继承不到展馆主色（--hall-accent 是脚本设在 #hallPanel 上的），
    // 这里把当前展馆的主色抄过来，按钮 hover 的配色才和展馆一致。
    var panel = $('hallPanel');
    if (panel) {
      var accent = getComputedStyle(panel).getPropertyValue('--hall-accent');
      $mv.style.setProperty('--hall-accent', (accent || '').trim() || '#3b82f6');
    }

    $mv.classList.add('show');
    updateCover();      // 「点击进入」那层遮罩 z-index 更高，得让它避开

    // 键盘运动键先清零，否则大窗开着角色还在原地走
    keys.fwd = keys.back = keys.left = keys.right = keys.shift = 0;
    // 让出鼠标：不然指针还被锁着，点不到播放器的控制条
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();

    var p = $mvVideo.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被浏览器拦下就等用户点播放键 */ });
  }

  function closeMediaView() {
    if (!mediaViewOpen()) return;
    $mv.classList.remove('show');
    try { $mvVideo.pause(); } catch (e) { /* 忽略 */ }
    $mvVideo.removeAttribute('src');
    $mvVideo.load();          // 断开连接，把已缓冲的几百 MB 放掉
    updateCover();
    if (!touchMode && !panelOpen()) requestLock();
  }

  /* 视频大窗的 DOM 与事件（只绑一次）。点击走事件委托：
     展板内容是每次 openHall 时整块重写的，绑在 hpBody 上就不用反复重绑。 */
  function bindMediaView() {
    $mv = $('mediaView');
    if (!$mv) return;                     // 页面上没有这块标记就直接不启用
    $mvVideo = $('mvVideo');
    $mvTitle = $('mvTitle');
    $mvLink = $('mvLink');
    $mvFile = $('mvFile');

    $mv.querySelector('.mv-close').addEventListener('click', closeMediaView);
    // 点空白处关闭；点播放器本体/标题栏不关
    $mv.addEventListener('click', function (e) { if (e.target === $mv) closeMediaView(); });

    $('hpBody').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.m-open') : null;   // 点封面图/播放键都算
      if (!btn) return;
      e.preventDefault();
      openMediaView(btn.getAttribute('data-mv-src'), btn.getAttribute('data-mv-title'));
    });
  }

  /* ======================== 导览目录 ======================== */
  function buildNav() {
    var list = $('hallNavList');
    if (!list) return;
    list.innerHTML = (DATA.halls || []).map(function (h, i) {
      return '<button data-hall="' + esc(h.id) + '">'
        + '<span class="ni">' + esc(h.icon || '🏛️') + '</span>'
        + '<span class="nn"><b>' + esc(h.name || '') + '</b><i>' + esc(h.subtitle || '') + '</i></span>'
        + '<span class="nk">' + (i + 1) + '</span>'
        + '</button>';
    }).join('');
    list.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var h = halls.find(function (x) { return x.spec.id === b.dataset.hall; });
        if (!h) return;
        teleportTo(h);
        openHall(h);
      });
    });
  }

  function teleportTo(h) {
    // 退到光圈外一点，正对展板
    pos.set(h.point.x, EYE, h.point.z);
    yaw = h.faceYaw;
    pitch = -0.05;
  }

  /* ======================== 指针锁定 / 输入 ======================== */
  function requestLock() {
    if (touchMode) return;
    var el = renderer.domElement;
    try {
      if (el.requestPointerLock) el.requestPointerLock();
    } catch (err) {
      // 刚退出锁定又立刻请求时浏览器会拒绝，忽略即可，用户再点一下画面就会锁上
    }
  }
  function releaseLock() {
    try {
      if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    } catch (err) { /* 忽略 */ }
  }
  var touchMove = false;

  // “点击进入”遮罩：只在没有锁定鼠标、也没有打开内容弹层时出现
  function updateCover() {
    var start = $('hallStart');
    if (!start) return;
    var show = !touchMode && !locked && !panelOpen();
    start.classList.toggle('hide', !show);
  }

  function bindInput() {
    var el = renderer.domElement;

    document.addEventListener('pointerlockchange', function () {
      locked = (document.pointerLockElement === el);
      updateCover();
    });

    document.addEventListener('mousemove', function (e) {
      if (!locked) return;
      yaw -= e.movementX * LOOK_SENS;
      pitch -= e.movementY * LOOK_SENS;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
    });

    // 点击：没锁就先锁定，锁了且有展馆就打开
    el.addEventListener('click', function () {
      if (panelOpen()) return;
      if (!locked) { requestLock(); return; }
      if (active) openHall(active);
    });

    document.addEventListener('keydown', function (e) {
      var k = e.code;
      // 大窗播放时键盘整个让给播放器（空格=暂停、左右=快进），只留 Esc 关闭
      if (mediaViewOpen()) { if (k === 'Escape') closeMediaView(); return; }
      if (k === 'KeyW' || k === 'ArrowUp') keys.fwd = 1;
      else if (k === 'KeyS' || k === 'ArrowDown') keys.back = 1;
      else if (k === 'KeyA' || k === 'ArrowLeft') keys.left = 1;
      else if (k === 'KeyD' || k === 'ArrowRight') keys.right = 1;
      else if (k === 'ShiftLeft' || k === 'ShiftRight') keys.shift = 1;
      else if (k === 'KeyE') { if (active && !panelOpen()) openHall(active); }
      else if (k === 'Escape') { if (panelOpen()) closePanel(); }
      else if (k === 'Space') {
        if (panelOpen()) return;              // 弹层开着时空格留给页面自身
        e.preventDefault();                   // 别让空格去滚动页面 / 触发聚焦的按钮
        startJump();
      }
    });
    document.addEventListener('keyup', function (e) {
      var k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') keys.fwd = 0;
      else if (k === 'KeyS' || k === 'ArrowDown') keys.back = 0;
      else if (k === 'KeyA' || k === 'ArrowLeft') keys.left = 0;
      else if (k === 'KeyD' || k === 'ArrowRight') keys.right = 0;
      else if (k === 'ShiftLeft' || k === 'ShiftRight') keys.shift = 0;
    });
    window.addEventListener('blur', function () {
      keys.fwd = keys.back = keys.left = keys.right = keys.shift = 0;
      touchMove = false;
    });

    // ---- 触屏：拖动看方向 + 按住“前进” ----
    if ('ontouchstart' in window) {
      touchMode = true;
      var sx = 0, sy = 0, id = null;
      el.addEventListener('touchstart', function (e) {
        var t = e.changedTouches[0];
        id = t.identifier; sx = t.clientX; sy = t.clientY;
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier !== id) continue;
          yaw -= (t.clientX - sx) * LOOK_SENS * 2.2;
          pitch -= (t.clientY - sy) * LOOK_SENS * 2.2;
          pitch = Math.max(-1.2, Math.min(1.2, pitch));
          sx = t.clientX; sy = t.clientY;
        }
      }, { passive: true });
      el.addEventListener('touchend', function () { id = null; }, { passive: true });

      var mv = $('hallForward');
      if (mv) {
        ['touchstart', 'mousedown'].forEach(function (ev) {
          mv.addEventListener(ev, function (e) { e.preventDefault(); touchMove = true; });
        });
        ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (ev) {
          mv.addEventListener(ev, function () { touchMove = false; });
        });
      }
      var jp = $('hallJump');        // 触屏没有空格键，单独给一个跳跃按钮
      if (jp) {
        ['touchstart', 'mousedown'].forEach(function (ev) {
          jp.addEventListener(ev, function (e) {
            e.preventDefault();
            if (!panelOpen()) startJump();
          });
        });
      }
      updateCover();
    } else {
      var start = $('hallStart');
      if (start) start.addEventListener('click', requestLock);
    }

    window.addEventListener('resize', onResize);
  }

  function panelOpen() {
    var ov = $('hallPanel');
    return !!(ov && ov.classList.contains('show'));
  }

  /* ======================== 主循环 ======================== */
  var clock2 = 0;
  function loop() {
    requestAnimationFrame(loop);
    var now = performance.now();
    var dt = Math.min((now - clock2) / 1000, 0.05);
    clock2 = now;
    if (!ready) return;

    if (!panelOpen()) {
      move(dt);
      refreshActive();
    }
    updateJump(dt);              // 弹层开着也让它落地，免得关掉弹层还悬在半空
    camera.position.copy(pos);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    // 展品动起来（齿轮、曲柄滑块、单摆）
    for (var ai = 0; ai < animatables.length; ai++) animatables[ai](now / 1000);

    // 中央悬浮牌始终面向观众
    if (titleMesh) {
      titleMesh.rotation.y = Math.atan2(camera.position.x - titleMesh.position.x,
        camera.position.z - titleMesh.position.z);
      titleMesh.position.y = 4.5 + Math.sin(now / 900) * 0.09;
    }
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ======================== 启动 ======================== */
  function init() {
    var host = $('hallCanvas');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070c16);
    scene.fog = new THREE.Fog(0x070c16, 60, 155);

    camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 700);
    camera.rotation.order = 'YXZ';

    buildMaterials();
    buildLights();
    buildRoom();
    buildHalls();
    buildNav();
    bindMediaView();
    bindInput();

    ready = true;
    var load = $('hallLoading');
    if (load) load.classList.add('hide');
    loop();
  }

  // 供页面上的按钮调用（关闭弹层 / 打开某个展馆）
  window.HALL_VIEW = {
    close: closePanel,
    open: openHall,
    go: function (id) {
      var h = halls.find(function (x) { return x.spec.id === id; });
      if (h) { teleportTo(h); openHall(h); }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
