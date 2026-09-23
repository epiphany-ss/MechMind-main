/* ============================================================
   力学游乐园 · 机构动画引擎（去标注版 → 可开关标注版）
   ------------------------------------------------------------
   本文件的计算与绘制函数是【从 mechanism_engine.js 逐字抄出】的。
   相对原版共两处改动：

   1) 文字标注做成了【开关】（showLabels，默认关）：
      - 猜机构「提问阶段」必须去标注 —— 标着「A (动点)」「动系(滑块B)」等于泄底；
      - 但「答完揭晓」必须显示 —— 否则反馈里写「动点 M（连杆中点）　动系：滑块 B」，
        画布上却一个字都没有，玩家对不上号（用户实测抓到的漏洞）。
      - 矢量竞速不隐藏机构身份（考的是方向），全程开。
      所有标注调用已按原版位置抄回，统一包在 showLabels 里。
      ⚠️ 「问的是哪个点」始终由 mark() 高亮圈指示，与标注开关无关。

   2) 视图适配改为包围盒居中（原版按特征尺寸估 span、原点写死 0.42W/0.52H），
      见 extentPts()/autoZoom()。

   WHY 抄而不是改 mechanism_engine.js：
     mechanism_engine.js 是自执行 IIFE，DOM 用固定 ID 硬取（#wrapper/#cv/#hint），
     只导出了 window.switchInfoTab。要复用它就得改造 mechanism.html 这个
     已在跑的页面。项目本身就有「复制优于重构」的惯例
     （personal_knowledge.html 复制了 activity 的计分算法），
     所以这里照抄，零回归风险。

   抄写来源对照（mechanism_engine.js）：
     computeGuideBar / computeSliderCrank /
     computeScotchYoke / computePlanetaryGear ......... 43-174 行
     scrArrow / drawArrowW / drawCircleW /
     drawLineW / drawLabelW / toScreen ................ 184-229 行
     drawGuideBar / drawSliderCrank /
     drawScotchYoke / drawGearW / drawPlanetaryGear .... 231-372 行

   ⚠️ mechanism_engine.js 若将来修改，本文件不会自动跟随。
      两者要同步的话，改动点就是这里的标注开关与视图适配。
   ============================================================ */
(function (root) {
  'use strict';

  /* ==================== 平台自己的机构事实 ==================== */
  // 全部【照抄 mechanism_engine.js:624-629 的 mechDescriptions】，
  // 不自己编。行星减速那条原文就没提科氏加速度，这里也不提。

  var FACTS = {
    guideBar: {
      key: 'guideBar', name: '曲柄导杆机构', short: '曲柄导杆',
      movingPoint: 'A（滑块）', movingFrame: '导杆（绕 B 转动）',
      frameMotion: '转动', hasCoriolis: true,
      desc: '动点：A(滑块) | 动系：导杆(绕B转动)',
      coriolis: '有科氏加速度 aC = 2ωe × vr'
    },
    sliderCrank: {
      key: 'sliderCrank', name: '曲柄滑块机构', short: '曲柄滑块',
      movingPoint: 'M（连杆中点）', movingFrame: '滑块 B（平动）',
      frameMotion: '平动', hasCoriolis: false,
      desc: '动点：M(连杆中点) | 动系：滑块B(平动)',
      coriolis: '科氏加速度 = 0（动系平动）'
    },
    scotchYoke: {
      key: 'scotchYoke', name: '正弦机构', short: '正弦机构',
      movingPoint: 'A（曲柄销）', movingFrame: '滑框（竖直平动）',
      frameMotion: '平动', hasCoriolis: false,
      desc: '动点：A(曲柄销) | 动系：滑框(竖直平动)',
      coriolis: '科氏加速度 = 0（动系平动）'
    },
    planetaryGear: {
      key: 'planetaryGear', name: '行星减速机构', short: '行星减速',
      movingPoint: 'P（行星轮标记点）', movingFrame: '行星架（绕 O 转动）',
      frameMotion: '转动', hasCoriolis: null,   // 原文未作判断，出题时不问这条
      desc: '动点：P(行星轮标记点) | 动系：行星架(绕O转动)',
      coriolis: '固定内齿圈 · 太阳轮输入，行星架减速输出'
    }
  };

  var KEYS = ['guideBar', 'sliderCrank', 'scotchYoke', 'planetaryGear'];

  // 默认参数（与 mechanism_engine.js:32-33 一致）
  var DEF = { r: 120, d: 300, L: 200, e: 0, sunR: 70, planetR: 45, omega: 1.8 };

  /* ==================== 计算（mechanism_engine.js:43-174 逐字照抄） ==================== */

  function computeGuideBar(th, om, rr, dd) {
    const cos = Math.cos(th), sin = Math.sin(th);
    const Ax = rr * cos, Ay = rr * sin;
    const BAx = Ax - dd, BAy = Ay;
    const s = Math.sqrt(BAx * BAx + BAy * BAy);
    if (s < 0.5) return null;
    const ux = BAx / s, uy = BAy / s;
    const upx = -uy, upy = ux;
    const D = s * s;
    const ome = om * rr * (rr - dd * cos) / D;
    const ale = (om * om * rr * dd * sin * (dd * dd - rr * rr)) / (D * D);
    const va_x = -om * rr * sin, va_y = om * rr * cos, va_mag = om * rr;
    const vr_mag = rr * dd * om * sin / s;
    const ve_mag = ome * s;
    const ve_x = ve_mag * upx, ve_y = ve_mag * upy;
    const vr_x = vr_mag * ux, vr_y = vr_mag * uy;
    const aa_x = -om * om * rr * cos, aa_y = -om * om * rr * sin;
    const aen_x = -ome * ome * s * ux, aen_y = -ome * ome * s * uy;
    const aet_x = ale * s * upx, aet_y = ale * s * upy;
    const ae_x = aen_x + aet_x, ae_y = aen_y + aet_y;
    const ac_x = 2 * ome * vr_mag * upx, ac_y = 2 * ome * vr_mag * upy;
    const ar_x = aa_x - ae_x - ac_x, ar_y = aa_y - ae_y - ac_y;
    const ar_mag = ar_x * ux + ar_y * uy;
    const velRes = Math.hypot(ve_x + vr_x - va_x, ve_y + vr_y - va_y);
    const accRes = Math.hypot(ae_x + ar_x + ac_x - aa_x, ae_y + ar_y + ac_y - aa_y);
    const phi = Math.atan2(uy, ux);
    return {
      Ax, Ay, s, ux, uy, upx, upy, omega_e: ome, alpha_e: ale, phi,
      va_x, va_y, va_mag, ve_x, ve_y, ve_mag, vr_x, vr_y, vr_mag,
      aa_x, aa_y, aen_x, aen_y, aet_x, aet_y, ae_x, ae_y, ac_x, ac_y, ar_x, ar_y, ar_mag,
      velResidual: velRes, accResidual: accRes,
      absPt: { x: Ax, y: Ay }, relPt: { x: s, y: 0, phi }, entPt: { x: dd + s * Math.cos(phi), y: s * Math.sin(phi) },
      movingPoint: { x: Ax, y: Ay, name: 'A' },
    };
  }

  function computeSliderCrank(th, om, rr, LL, ee) {
    const cos = Math.cos(th), sin = Math.sin(th);
    const Ax = rr * cos, Ay = rr * sin;
    const disc = LL * LL - (ee + rr * sin) * (ee + rr * sin);
    if (disc < 1) return null;
    const Bx = rr * cos + Math.sqrt(disc);
    const By = -ee;
    const Mx = (Ax + Bx) / 2, My = (Ay + By) / 2;
    const sB = Math.sqrt(Math.max(disc, 0.01));
    const dBx = -rr * om * sin - (ee + rr * sin) * rr * om * cos / sB;
    const vMx = (-rr * om * sin + dBx) / 2, vMy = rr * om * cos / 2;
    const vBx = dBx, vBy = 0;
    const vRelX = vMx - vBx, vRelY = vMy - vBy;
    const vr = Math.hypot(vRelX, vRelY);
    const ve = Math.abs(vBx);
    const va = Math.hypot(vMx, vMy);
    const dth = 0.002;
    function getVM(t) {
      const c = Math.cos(t), si = Math.sin(t), sd2 = Math.sqrt(Math.max(LL * LL - (ee + rr * si) * (ee + rr * si), 0.01));
      const bX = rr * c + sd2, dbX = -rr * om * si - (ee + rr * si) * rr * om * c / sd2;
      return { x: (-rr * om * si + dbX) / 2, y: rr * om * c / 2 };
    }
    const vmP = getVM(th + dth), vmN = getVM(th - dth);
    const aMx = (vmP.x - vmN.x) / (2 * dth / om), aMy = (vmP.y - vmN.y) / (2 * dth / om);
    function getBAcc(t) {
      const c = Math.cos(t), si = Math.sin(t), sd2 = Math.sqrt(Math.max(LL * LL - (ee + rr * si) * (ee + rr * si), 0.01));
      return -rr * om * si - (ee + rr * si) * rr * om * c / sd2;
    }
    const bP = getBAcc(th + dth), bN = getBAcc(th - dth);
    const aBx = (bP - bN) / (2 * dth / om);
    const ae = aBx, ar = Math.hypot(aMx - aBx, aMy);
    const aa = Math.hypot(aMx, aMy);
    return {
      Ax, Ay, Bx, By, Mx, My, vBx, aBx, vMx, vMy, aMx, aMy,
      va, ve, vr, ae, ar, aa, s: Bx, phi: Math.atan2(Ay, Bx - Ax),
      va_x: vMx, va_y: vMy, ve_x: vBx, ve_y: 0, vr_x: vRelX, vr_y: vRelY,
      aa_x: aMx, aa_y: aMy, ae_x: aBx, ae_y: 0, ar_x: aMx - aBx, ar_y: aMy,
      ac_x: 0, ac_y: 0,
      absPt: { x: Mx, y: My }, relPt: { x: Mx - Bx, y: My }, entPt: { x: Bx, y: 0 },
      movingPoint: { x: Mx, y: My, name: 'M' },
      velResidual: 0, accResidual: 0,
    };
  }

  function computeScotchYoke(th, om, rr) {
    const cos = Math.cos(th), sin = Math.sin(th);
    const Ax = rr * cos, Ay = rr * sin;
    const Yx = 0, Yy = Ay;
    const va_x = -om * rr * sin, va_y = om * rr * cos, va_mag = om * rr;
    const ve_x = 0, ve_y = om * rr * cos, ve_mag = Math.abs(om * rr * cos);
    const vr_x = -om * rr * sin, vr_y = 0, vr_mag = Math.abs(om * rr * sin);
    const aa_x = -om * om * rr * cos, aa_y = -om * om * rr * sin;
    const ae_x = 0, ae_y = -om * om * rr * sin;
    const ar_x = -om * om * rr * cos, ar_y = 0;
    return {
      Ax, Ay, Yx, Yy,
      va_x, va_y, va_mag, ve_x, ve_y, ve_mag, vr_x, vr_y, vr_mag,
      aa_x, aa_y, ae_x, ae_y, ar_x, ar_y,
      ac_x: 0, ac_y: 0, omega_e: 0, alpha_e: 0, phi: 0, s: Math.abs(Ax),
      absPt: { x: Ax, y: Ay }, relPt: { x: Ax, y: 0 }, entPt: { x: 0, y: Ay },
      movingPoint: { x: Ax, y: Ay, name: 'A' },
      velResidual: Math.hypot(ve_x + vr_x - va_x, ve_y + vr_y - va_y),
      accResidual: Math.hypot(ae_x + ar_x - aa_x, ae_y + ar_y - aa_y),
    };
  }

  function computePlanetaryGear(th, om, sunR, planetR) {
    const rp = Math.max(24, planetR);
    const rs = Math.max(28, sunR);
    const carrierR = rs + rp;
    const ringR = rs + 2 * rp;
    const omegaC = om * rs / (rs + ringR);
    const omegaP = -omegaC * carrierR / rp;
    const psi = omegaC / om * th;
    const beta = omegaP / om * th;
    const Cx = carrierR * Math.cos(psi), Cy = carrierR * Math.sin(psi);
    const relX = rp * Math.cos(beta), relY = rp * Math.sin(beta);
    const Px = Cx + relX, Py = Cy + relY;
    const ve_x = -omegaC * Cy, ve_y = omegaC * Cx;
    const vr_x = -omegaP * relY, vr_y = omegaP * relX;
    const va_x = ve_x + vr_x, va_y = ve_y + vr_y;
    const ae_x = -omegaC * omegaC * Cx, ae_y = -omegaC * omegaC * Cy;
    const ar_x = -omegaP * omegaP * relX, ar_y = -omegaP * omegaP * relY;
    const aa_x = ae_x + ar_x, aa_y = ae_y + ar_y;
    return {
      sunR: rs, planetR: rp, ringR, carrierR, Cx, Cy, Px, Py, psi, beta,
      omega_e: omegaC, omega_p: omegaP, ratio: om / omegaC,
      va_x, va_y, va_mag: Math.hypot(va_x, va_y),
      ve_x, ve_y, ve_mag: Math.hypot(ve_x, ve_y),
      vr_x, vr_y, vr_mag: Math.hypot(vr_x, vr_y),
      aa_x, aa_y, ae_x, ae_y, ar_x, ar_y, ac_x: 0, ac_y: 0,
      absPt: { x: Px, y: Py }, relPt: { x: relX, y: relY }, entPt: { x: Cx, y: Cy },
      movingPoint: { x: Px, y: Py, name: 'P' },
      velResidual: Math.hypot(ve_x + vr_x - va_x, ve_y + vr_y - va_y),
      accResidual: Math.hypot(ae_x + ar_x - aa_x, ae_y + ar_y - aa_y),
    };
  }

  /* ==================== 视图状态 ==================== */
  // 一次只渲染一个机构，所以用模块级状态；这样上面抄来的绘制函数可以原样不动。

  var ctx = null;
  var cv = null;
  var view = { W: 0, H: 0, zoom: 1, ox: 0, oy: 0 };
  var mechanism = 'guideBar';
  var P = Object.assign({}, DEF);
  var theta = Math.PI / 4;
  var showLabels = false;   // 标注开关：默认关（猜机构提问阶段）；答完揭晓/矢量竞速时打开
  // 动点高亮圈（持续态）：render() 每帧都画。猜机构的动系/科氏题提问时必须开着，
  // 否则题目说「它的动系…」而画布上没有任何标记点，玩家不知道问的是谁（用户实测抓到）。
  var markOn = false;
  var markColor = '#4cc9f0';

  function toScreen(wx, wy) { return { x: view.ox + wx * view.zoom, y: view.oy - wy * view.zoom }; }

  function compute() {
    if (mechanism === 'guideBar') return computeGuideBar(theta, P.omega, P.r, P.d);
    if (mechanism === 'sliderCrank') return computeSliderCrank(theta, P.omega, P.r, P.L, P.e);
    if (mechanism === 'scotchYoke') return computeScotchYoke(theta, P.omega, P.r);
    if (mechanism === 'planetaryGear') return computePlanetaryGear(theta, P.omega, P.sunR, P.planetR);
    return null;
  }

  /* ---------- 绘制原语（mechanism_engine.js:184-229 逐字照抄，drawLabelW 已删） ---------- */

  function scrArrow(fx, fy, tx, ty, color, lw, head) {
    const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const ux = dx / len, uy = dy / len;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
    const h = head, bx = tx - ux * h, by = ty - uy * h;
    const px = -uy * h * 0.55, py = ux * h * 0.55;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx + px, by + py); ctx.lineTo(bx - px, by - py); ctx.closePath(); ctx.fill();
  }
  function drawArrowW(wx, wy, vx, vy, color, lw, head) {
    const s = toScreen(wx, wy);
    scrArrow(s.x, s.y, s.x + vx * view.zoom, s.y - vy * view.zoom, color, lw * view.zoom, head * view.zoom);
  }
  function drawCircleW(wx, wy, rad, color, fill, lw) {
    const s = toScreen(wx, wy);
    const r2 = rad * view.zoom;
    ctx.beginPath(); ctx.arc(s.x, s.y, r2, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5; ctx.stroke();
  }
  function drawLineW(x1, y1, x2, y2, color, lw, dash) {
    const a = toScreen(x1, y1), b = toScreen(x2, y2);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || 1.5;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  // 标注（mechanism_engine.js:225 原样抄回，zoomD → view.zoom）。
  // 开关在函数内部统一判断：showLabels=false 时所有标注调用都是 no-op。
  function drawLabelW(wx, wy, text, color, size, dx, dy) {
    if (!showLabels) return;
    const s = toScreen(wx, wy);
    ctx.fillStyle = color;
    ctx.font = `bold ${size * view.zoom}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text, s.x + (dx || 0), s.y + (dy || 0));
  }

  /* ---------- 各机构绘制（抄自 :231-372，所有标注文字已移除） ---------- */

  function drawGuideBar(kin) {
    const { Ax, Ay, ux, uy } = kin;
    const d = P.d, r = P.r;
    [[0, 0], [d, 0]].forEach(([px, py]) => {
      const sc = toScreen(px, py);
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(sc.x - 14 * view.zoom, sc.y); ctx.lineTo(sc.x + 14 * view.zoom, sc.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y - 9 * view.zoom); ctx.lineTo(sc.x, sc.y + 9 * view.zoom); ctx.stroke();
    });
    drawCircleW(0, 0, 7, '#999', '#333', 2.2);
    drawCircleW(d, 0, 7, '#999', '#333', 2.2);
    drawLabelW(0, 0, 'O', '#fff', 13, 0, -16);
    drawLabelW(d, 0, 'B', '#fff', 13, 0, -16);
    drawLineW(0, 0, Ax, Ay, '#e8b830', 4.5 * view.zoom);
    drawLineW(0, 0, Ax, Ay, '#f5d060', 2 * view.zoom);
    drawCircleW(Ax, Ay, 8, '#e8b830', '#ff8800', 2.5);
    drawLabelW(Ax, Ay, 'A (动点)', '#ffcc44', 12, 16, -12);
    const barLen = d + r + 140;
    const bx1 = Ax + ux * 60, by1 = Ay + uy * 60;
    const bx2 = d - ux * barLen * 0.4, by2 = -uy * barLen * 0.4;
    drawLineW(bx1, by1, bx2, by2, '#557799', 8 * view.zoom);
    drawLineW(bx1, by1, bx2, by2, '#88bbdd', 3.5 * view.zoom);
    const as = toScreen(Ax, Ay);
    const barAng = Math.atan2(-uy, ux);
    ctx.save(); ctx.translate(as.x, as.y); ctx.rotate(barAng);
    const sw2 = 16 * view.zoom, sh2 = 30 * view.zoom;
    ctx.fillStyle = '#ff9944'; ctx.strokeStyle = '#cc6600'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(-sw2 / 2, -sh2 / 2, sw2, sh2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 4.5 * view.zoom, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSliderCrank(kin) {
    const { Ax, Ay, Bx, By, Mx, My } = kin;
    drawCircleW(0, 0, 7, '#999', '#333', 2.2);
    drawLabelW(0, 0, 'O', '#fff', 13, 0, -16);
    const r1 = toScreen(-60, By), r2 = toScreen(Bx + 120, By);
    ctx.strokeStyle = '#667'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.stroke();
    for (let x = -40; x < Bx + 100; x += 30) {
      const sc = toScreen(x, By);
      ctx.strokeStyle = '#445'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y - 7 * view.zoom); ctx.lineTo(sc.x, sc.y + 7 * view.zoom); ctx.stroke();
    }
    drawLineW(0, 0, Ax, Ay, '#e8b830', 4 * view.zoom);
    drawCircleW(Ax, Ay, 7, '#e8b830', '#ff8800', 2.2);
    drawLabelW(Ax, Ay, 'A', '#ffcc44', 11, 12, -12);
    drawLineW(Ax, Ay, Bx, By, '#bb9944', 3.5 * view.zoom);
    drawCircleW(Mx, My, 8, '#ff8888', '#cc5555', 3);
    drawLabelW(Mx, My, 'M (动点)', '#ffaaaa', 12, 14, 12);
    drawCircleW(Bx, By, 8, '#aaa', '#555', 2.5);
    drawLabelW(Bx, By, 'B', '#ccc', 11, (Bx > Ax ? 14 : -14), -18);
    // 「动系(滑块B)」虚线框 + 文字：提问阶段是泄底标注必须隐藏，
    // 答完揭晓阶段恢复（mechanism_engine.js 原样抄回）
    if (showLabels) {
      const bs = toScreen(Bx, By);
      ctx.save(); ctx.strokeStyle = 'rgba(136,187,221,0.5)'; ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(bs.x - 22 * view.zoom, bs.y - 18 * view.zoom, 44 * view.zoom, 36 * view.zoom);
      ctx.fillStyle = 'rgba(136,187,221,0.08)';
      ctx.fillRect(bs.x - 22 * view.zoom, bs.y - 18 * view.zoom, 44 * view.zoom, 36 * view.zoom);
      ctx.setLineDash([]);
      ctx.fillStyle = '#88bbdd';
      ctx.font = `${10 * view.zoom}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('动系(滑块B)', bs.x, bs.y - 24 * view.zoom);
      ctx.restore();
    }
  }

  function drawScotchYoke(kin) {
    const { Ax, Ay, Yx, Yy } = kin;
    drawCircleW(0, 0, 7, '#999', '#333', 2.2);
    drawLabelW(0, 0, 'O', '#fff', 13, 0, -16);
    drawLineW(0, 0, Ax, Ay, '#e8b830', 4 * view.zoom);
    drawCircleW(Ax, Ay, 8, '#e8b830', '#ff8800', 2.5);
    drawLabelW(Ax, Ay, 'A (动点)', '#ffcc44', 12, 14, 10);
    const fw = 50 * view.zoom, fh = 110 * view.zoom;
    const fs = toScreen(Yx, Yy);
    ctx.save();
    ctx.strokeStyle = '#88aacc'; ctx.fillStyle = 'rgba(68,136,204,0.12)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.rect(fs.x - fw / 2, fs.y - fh / 2, fw, fh); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6699cc'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fs.x - fw * 0.85, fs.y); ctx.lineTo(fs.x + fw * 0.85, fs.y); ctx.stroke();
    if (showLabels) {
      // 「动系(滑框)」文字：提问阶段隐藏，答完揭晓恢复（mechanism_engine.js 原样抄回）
      ctx.fillStyle = '#88bbdd'; ctx.font = `${10 * view.zoom}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center'; ctx.fillText('动系(滑框)', fs.x, fs.y - fh / 2 - 8 * view.zoom);
    }
    ctx.restore();
    const gx = Yx;
    drawLineW(gx - 30, -100, gx - 30, 120, '#445', 1.5, [6, 5]);
    drawLineW(gx + 30, -100, gx + 30, 120, '#445', 1.5, [6, 5]);
  }

  function drawGearW(cx, cy, rad, teeth, color, fill, markAngle) {
    drawCircleW(cx, cy, rad, color, fill, 2.2);
    for (let i = 0; i < teeth; i++) {
      const a = i * Math.PI * 2 / teeth;
      const x1 = cx + Math.cos(a) * rad * 0.9, y1 = cy + Math.sin(a) * rad * 0.9;
      const x2 = cx + Math.cos(a) * rad * 1.08, y2 = cy + Math.sin(a) * rad * 1.08;
      drawLineW(x1, y1, x2, y2, color, 1.1 * view.zoom);
    }
    if (markAngle !== undefined) {
      drawLineW(cx, cy, cx + Math.cos(markAngle) * rad * 0.72, cy + Math.sin(markAngle) * rad * 0.72, '#f5f7ff', 2.1 * view.zoom);
    }
  }

  function drawPlanetaryGear(kin) {
    const { sunR, planetR, ringR, carrierR, psi, beta, Px, Py, Cx, Cy } = kin;
    drawCircleW(0, 0, ringR + 15, '#4b6078', 'rgba(70,95,120,0.10)', 2);
    drawCircleW(0, 0, ringR, '#88aacc', 'rgba(64,84,104,0.10)', 3.2);
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI * 2 / 64;
      const x1 = Math.cos(a) * ringR, y1 = Math.sin(a) * ringR;
      const x2 = Math.cos(a) * (ringR - 13), y2 = Math.sin(a) * (ringR - 13);
      drawLineW(x1, y1, x2, y2, '#7da6c8', 1.1 * view.zoom);
    }
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI * 2 / 24;
      drawLineW(Math.cos(a) * (ringR + 17), Math.sin(a) * (ringR + 17),
        Math.cos(a) * (ringR + 26), Math.sin(a) * (ringR + 26), '#3b4a5c', 1 * view.zoom);
    }

    drawGearW(0, 0, sunR, 28, '#e8b830', 'rgba(232,184,48,0.20)', theta);
    drawCircleW(0, 0, 7, '#999', '#333', 2.2);
    drawLabelW(0, 0, 'O', '#fff', 13, 0, -16);
    drawLabelW(0, -sunR - 24, '太阳轮输入', '#ffdd66', 11, 0, 0);

    for (let k = 0; k < 3; k++) {
      const a = psi + k * Math.PI * 2 / 3;
      const pcx = carrierR * Math.cos(a), pcy = carrierR * Math.sin(a);
      drawLineW(0, 0, pcx, pcy, '#557799', 4 * view.zoom);
    }
    drawCircleW(0, 0, 18, '#88bbdd', 'rgba(136,187,221,0.18)', 2.2);

    for (let k = 0; k < 3; k++) {
      const a = psi + k * Math.PI * 2 / 3;
      const pcx = carrierR * Math.cos(a), pcy = carrierR * Math.sin(a);
      const spinMark = beta + k * Math.PI * 2 / 3;
      drawGearW(pcx, pcy, planetR, 22, '#77ccaa', 'rgba(80,180,150,0.18)', spinMark);
      drawCircleW(pcx, pcy, 5, '#bdebdc', '#223a36', 1.6);
    }

    drawCircleW(Cx, Cy, 7, '#77ccaa', '#22aa88', 2.4);
    drawCircleW(Px, Py, 8, '#ff8888', '#cc5555', 2.6);
    drawLabelW(Px, Py, 'P (动点)', '#ffaaaa', 12, 18, -10);
    drawLabelW(-ringR * 0.64, ringR + 26, '内齿圈固定', '#9db8cf', 11, 0, 0);
    drawLabelW(Cx, Cy, '行星架输出', '#88bbdd', 10, 0, 22);
  }

  function drawMechanism(kin) {
    if (!kin) return;
    if (mechanism === 'guideBar') drawGuideBar(kin);
    else if (mechanism === 'sliderCrank') drawSliderCrank(kin);
    else if (mechanism === 'scotchYoke') drawScotchYoke(kin);
    else if (mechanism === 'planetaryGear') drawPlanetaryGear(kin);
  }

  /* ==================== 对外视图 API ==================== */

  function fit(canvas) {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.parentElement.clientWidth || 640;
    const h = Math.max(320, Math.round(w * 0.52));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.height = h + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    view.W = w; view.H = h;
  }

  // 机构「实际绘制范围」采样：沿一整圈把各机构绘制函数会用到的端点都收集起来。
  // 此前 autoZoom 按特征尺寸估 span、且原点写死在 0.42W / 0.52H，平面机构又扁，
  // 结果就是机构在画布里偏一边、上下留白很大。现在按包围盒居中适配。
  function extentPts() {
    var pts = [], N = 72, i, th, k, R;
    for (i = 0; i < N; i++) {
      th = i * Math.PI * 2 / N;
      if (mechanism === 'guideBar') {
        k = computeGuideBar(th, P.omega, P.r, P.d);
        if (!k) continue;
        var bl = (P.d + P.r + 140) * 0.4;   // 导杆伸出 B 外的那一段（与 drawGuideBar 同式）
        pts.push([k.Ax + 80 * k.ux, k.Ay + 80 * k.uy]);      // A 外：杆端 + 滑块
        pts.push([P.d - bl * k.ux, -bl * k.uy]);             // B 外：杆端
        pts.push([0, 0], [P.d, 0]);
        pts.push([P.r + 10, 0], [-(P.r + 10), 0], [0, P.r + 10], [0, -(P.r + 10)]);
      } else if (mechanism === 'sliderCrank') {
        k = computeSliderCrank(th, P.omega, P.r, P.L, P.e);
        if (!k) continue;
        pts.push([0, 0], [-60, k.By], [k.Bx + 120, k.By], [k.Bx, k.By], [k.Mx, k.My]);
        pts.push([P.r + 10, 0], [-(P.r + 10), 0], [0, P.r + 10], [0, -(P.r + 10)]);
      } else if (mechanism === 'scotchYoke') {
        k = computeScotchYoke(th, P.omega, P.r);
        pts.push([0, 0]);
        pts.push([P.r + 10, 0], [-(P.r + 10), 0], [0, P.r + 10], [0, -(P.r + 10)]);
        pts.push([-25, k.Ay - 55], [25, k.Ay - 55], [-25, k.Ay + 55], [25, k.Ay + 55]);
        pts.push([-30, -100], [30, -100], [-30, 120], [30, 120]);
      } else {
        R = (P.sunR + 2 * Math.max(24, P.planetR)) + 28;     // 内齿圈 + 外圈刻线
        pts.push([R, 0], [-R, 0], [0, R], [0, -R]);
      }
    }
    return pts;
  }

  // 让机构整体落在画面正中：按一整圈采样出的包围盒算缩放与原点
  function autoZoom() {
    var pts = extentPts();
    if (!pts.length) return;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    var pad = 40;
    var bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
    view.zoom = Math.max(0.25, Math.min(1.6, Math.min((view.W - pad * 2) / bw, (view.H - pad * 2) / bh)));
    view.ox = view.W / 2 - (minX + maxX) / 2 * view.zoom;
    view.oy = view.H / 2 + (minY + maxY) / 2 * view.zoom;
  }

  function create(canvas, mechKey) {
    cv = canvas;
    ctx = canvas.getContext('2d');
    mechanism = mechKey || 'guideBar';
    theta = Math.PI / 4;
    fit(cv);
    autoZoom();
    return api;
  }

  function render() {
    if (!ctx) return null;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, view.W, view.H);
    const kin = compute();
    drawMechanism(kin);
    if (markOn && kin && kin.movingPoint) drawMarkRing(kin);
    return kin;
  }

  function step(dt) {
    theta += P.omega * dt;
    theta %= Math.PI * 2;
    if (theta < 0) theta += Math.PI * 2;
    return render();
  }

  // 在「动点」上画一个高亮圈 —— 要问「这个点的速度/动系」，
  // 总得让人知道问的是哪个点。只画圈，不写字（写不写字由 showLabels 管）。
  function drawMarkRing(kin) {
    if (!ctx || !kin) return;
    const p = kin.movingPoint;
    const s = toScreen(p.x, p.y);
    ctx.save();
    ctx.strokeStyle = markColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(s.x, s.y, 14 * Math.max(0.8, view.zoom), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = markColor + '66';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(s.x, s.y, 19 * Math.max(0.8, view.zoom), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function mark(color) {
    markOn = true;
    markColor = color || markColor;
    if (ctx) drawMarkRing(compute());   // 立即画一次：矢量竞速定格后没有渲染循环
    return api;
  }
  function setMark(on) {
    markOn = !!on;
    return api;
  }

  var api = {
    mark: mark,
    setMark: setMark,
    // 标注开关：on=true 画 O/A/B/M/P 与「动系」提示框，false 全部隐藏。
    // 猜机构：提问关、答完开；矢量竞速：一直开。
    setLabels: function (on) { showLabels = !!on; return api; },
    setMech: function (k) { if (FACTS[k]) { mechanism = k; theta = Math.PI / 4; autoZoom(); } return api; },
    getMech: function () { return mechanism; },
    setParams: function (o) { Object.assign(P, o || {}); autoZoom(); return api; },
    params: function () { return Object.assign({}, P); },
    setTheta: function (t) { theta = t; return api; },
    getTheta: function () { return theta; },
    render: render,
    step: step,
    fit: function () { fit(cv); autoZoom(); return api; },
    facts: function () { return FACTS[mechanism]; },
    compute: compute
  };

  root.ArcadeMech = {
    FACTS: FACTS,
    KEYS: KEYS,
    DEF: DEF,
    create: create,
    // 供「矢量竞速」等直接取用（纯函数，无副作用）
    computeGuideBar: computeGuideBar,
    computeSliderCrank: computeSliderCrank,
    computeScotchYoke: computeScotchYoke,
    computePlanetaryGear: computePlanetaryGear
  };
})(window);
