/* ============================================================
   机构师技能 · 轨迹图谱引擎（MechAtlas）
   ------------------------------------------------------------
   手绘曲线 → 连杆机构综合的核心引擎。取代 linkage-generator
   原来的「纯随机搜索 7 万次」：随机搜索在 9 维参数空间里覆盖率太低，
   只有圆/正方形这类简单曲线碰巧能过阈值；任意曲线必然失败。

   工程上正规做法是轨迹图谱法（Hrones & Nelson atlas）：
     1. 批量合成大量归一化连杆曲线（本引擎 6 万条，可配置），
        每条提取【旋转/起始相位不变】的傅里叶幅值描述子；
     2. 手绘曲线归一化后先做图谱粗筛（top-K）；
     3. 每个候选再带【整体旋转角】做模式搜索精修（粗筛是旋转不变的，
        精修把旋转找回来），目标函数与 linkage-generator 的
        matchCurves 评分【逐字同口径】，优化结果交给页面最终判定。

   参数空间与合理性校验【逐字对齐】linkage-generator.html
   （isGrashofCrankRocker / isPlausibleMechanism / 随机参数边界），
   保证图谱里任何一条结果页面都能接受并动画。
   ============================================================ */
(function (root) {
  'use strict';

  var TARGET_RMS = 120;   // 与 linkage-generator.html 相同的归一化基准
  var N_ATLAS = 64;       // 图谱曲线采样点数（寻优也在 64 点上做，页面最终用 96 点判定）
  var K_DESC = 16;        // 傅里叶幅值描述子维数（k = 1..16）

  // ---------- 采样表（DFT 用三角函数表，全图谱共享，只算一次） ----------
  var cosT = null, sinT = null;
  function trigTables() {
    if (cosT) return;
    cosT = new Float64Array(K_DESC * N_ATLAS);
    sinT = new Float64Array(K_DESC * N_ATLAS);
    for (var k = 1; k <= K_DESC; k++) {
      for (var i = 0; i < N_ATLAS; i++) {
        var ang = -2 * Math.PI * k * i / N_ATLAS;
        cosT[(k - 1) * N_ATLAS + i] = Math.cos(ang);
        sinT[(k - 1) * N_ATLAS + i] = Math.sin(ang);
      }
    }
  }

  /* ==================== 曲线工具 ==================== */

  // 弧长均匀重采样为 n 点（闭合）
  function resampleClosed(pts, n2) {
    var n = pts.length / 2;
    var cum = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      cum[i + 1] = cum[i] + Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
    }
    var total = cum[n];
    var out = new Float64Array(n2 * 2);
    var seg = 0;
    for (var t2 = 0; t2 < n2; t2++) {
      var t = total * t2 / n2;
      while (seg < n - 1 && cum[seg + 1] < t) seg++;
      var segLen = cum[seg + 1] - cum[seg];
      var lt = segLen > 0 ? (t - cum[seg]) / segLen : 0;
      var j2 = (seg + 1) % n;
      out[t2 * 2] = pts[seg * 2] + (pts[j2 * 2] - pts[seg * 2]) * lt;
      out[t2 * 2 + 1] = pts[seg * 2 + 1] + (pts[j2 * 2 + 1] - pts[seg * 2 + 1]) * lt;
    }
    return out;
  }

  // 质心居中 + RMS 缩放到 TARGET_RMS（返回新数组）
  function centerScale(pts) {
    var n = pts.length / 2, cx = 0, cy = 0, i;
    for (i = 0; i < n; i++) { cx += pts[i * 2]; cy += pts[i * 2 + 1]; }
    cx /= n; cy /= n;
    var rms = 0;
    var out = new Float64Array(n * 2);
    for (i = 0; i < n; i++) {
      out[i * 2] = pts[i * 2] - cx;
      out[i * 2 + 1] = pts[i * 2 + 1] - cy;
      rms += out[i * 2] * out[i * 2] + out[i * 2 + 1] * out[i * 2 + 1];
    }
    rms = Math.sqrt(rms / n);
    if (rms > 1e-9) {
      var f = TARGET_RMS / rms;
      for (i = 0; i < n; i++) { out[i * 2] *= f; out[i * 2 + 1] *= f; }
    }
    return out;
  }

  // 傅里叶幅值描述子：|F_k|/n，k=1..K（平移/旋转/起始相位不变；镜像不定 → 精修阶段双向+镜像）
  function fourierMag(pts) {
    trigTables();
    var n = pts.length / 2;
    if (n !== N_ATLAS) pts = resampleClosed(pts, N_ATLAS);
    var out = new Float64Array(K_DESC);
    for (var k = 1; k <= K_DESC; k++) {
      var re = 0, im = 0, base = (k - 1) * N_ATLAS;
      for (var i = 0; i < N_ATLAS; i++) {
        re += pts[i * 2] * cosT[base + i] - pts[i * 2 + 1] * sinT[base + i];
        im += pts[i * 2] * sinT[base + i] + pts[i * 2 + 1] * cosT[base + i];
      }
      out[k - 1] = Math.hypot(re, im) / N_ATLAS;
    }
    return out;
  }

  /* ==================== 四杆运动学（与 linkage-generator 逐字同口径） ==================== */

  function fourBarSolve(p, theta) {
    // p = {o2x,o2y,o4x,o4y,l2,l3,l4,u,v}；开分支（+h），与页面 solveAt 相同
    var ax = p.o2x + p.l2 * Math.cos(theta);
    var ay = p.o2y + p.l2 * Math.sin(theta);
    var dx = p.o4x - ax, dy = p.o4y - ay;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > p.l3 + p.l4 + 1e-9 || d < Math.abs(p.l3 - p.l4) - 1e-9) return null;
    var aInt = (p.l3 * p.l3 - p.l4 * p.l4 + d * d) / (2 * d);
    var hSq = p.l3 * p.l3 - aInt * aInt;
    if (hSq < 0) return null;
    var h = Math.sqrt(hSq);
    var midX = ax + aInt * dx / d, midY = ay + aInt * dy / d;
    var perpX = -dy / d, perpY = dx / d;
    var bx = midX + h * perpX, by = midY + h * perpY;
    var cbx = bx - ax, cby = by - ay;
    var clen = Math.hypot(cbx, cby);
    if (clen < 1e-9) return null;
    var ux = cbx / clen, uy = cby / clen;
    return {
      px: ax + p.u * ux - p.v * uy,
      py: ay + p.u * uy + p.v * ux
    };
  }

  function fourBarCurve(p, rot, N) {
    var cosr = Math.cos(rot), sinr = Math.sin(rot);
    var o2x = p.o2x * cosr - p.o2y * sinr, o2y = p.o2x * sinr + p.o2y * cosr;
    var o4x = p.o4x * cosr - p.o4y * sinr, o4y = p.o4x * sinr + p.o4y * cosr;
    var rp = { o2x: o2x, o2y: o2y, o4x: o4x, o4y: o4y, l2: p.l2, l3: p.l3, l4: p.l4, u: p.u, v: p.v };
    var out = new Float64Array(N * 2);
    var ok = 0;
    for (var i = 0; i < N; i++) {
      var s = fourBarSolve(rp, 2 * Math.PI * i / N);
      if (s) { out[i * 2] = s.px; out[i * 2 + 1] = s.py; ok++; }
      else { out[i * 2] = NaN; out[i * 2 + 1] = NaN; }
    }
    return ok >= N * 0.95 ? out : null;
  }

  // 合理性校验 —— 逐字对齐 linkage-generator 的 isGrashofCrankRocker + isPlausibleMechanism
  function grashofOK(l2, l3, l4, ground) {
    var links = [l2, l3, l4, ground].sort(function (a, b) { return a - b; });
    var s = links[0], l = links[3], p1 = links[1], q = links[2];
    if (s + l > p1 + q + 0.01) return false;
    if (Math.abs(l2 - s) > 1e-6 && Math.abs(ground - s) > 1e-6) return false;
    return true;
  }
  function plausible(p) {
    var groundLen = Math.hypot(p.o4x - p.o2x, p.o4y - p.o2y);
    if (!grashofOK(p.l2, p.l3, p.l4, groundLen)) return false;
    var links = [p.l2, p.l3, p.l4, groundLen];
    var minLink = Math.min.apply(null, links), maxLink = Math.max.apply(null, links);
    if (minLink < 12 || maxLink / minLink > 5.2) return false;
    if (Math.hypot(p.u, p.v) > p.l3 * 1.38) return false;
    if (Math.abs(p.v) > p.l3 * 0.82) return false;
    return true;
  }

  // 图谱采样：与页面 randomParamsRaw 同一边界（s = TARGET_RMS）
  function sampleParams(rng) {
    var s = TARGET_RMS;
    for (var attempt = 0; attempt < 24; attempt++) {
      var ground = 0.65 * s + (1.85 * s - 0.65 * s) * rng();
      var l2 = 0.16 * s + (0.52 * s - 0.16 * s) * rng();
      var l3 = 0.55 * s + (1.85 * s - 0.55 * s) * rng();
      var l4 = 0.45 * s + (1.75 * s - 0.45 * s) * rng();
      var u = (-0.15 + 1.3 * rng()) * l3;
      var v = (-0.65 + 1.3 * rng()) * l3;
      var tilt = (-0.22 + 0.44 * rng()) * s;
      var yBase = (-0.18 + 0.36 * rng()) * s;
      var p = {
        o2x: -ground / 2, o2y: yBase - tilt / 2,
        o4x: ground / 2, o4y: yBase + tilt / 2,
        l2: l2, l3: l3, l4: l4, u: u, v: v
      };
      if (plausible(p)) return p;
    }
    return null;
  }

  function makeRng(seed) {
    var st = seed >>> 0;
    return function () {
      st = (Math.imul(1664525, st) + 1013904223) >>> 0;
      return st / 4294967296;
    };
  }

  /* ==================== 精确评分（matchCurves 同口径，64 点） ==================== */

  function curveStats(c, N) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, len = 0, rms = 0, i, x, y;
    for (i = 0; i < N; i++) {
      x = c[i * 2]; y = c[i * 2 + 1];
      if (!Number.isFinite(x)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      rms += x * x + y * y;
      var j = (i + 1) % N;
      if (Number.isFinite(c[j * 2])) len += Math.hypot(c[j * 2] - x, c[j * 2 + 1] - y);
    }
    var w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    return { ratio: Math.max(w, h) / Math.max(Math.min(w, h), 1), length: len, rms: Math.sqrt(rms / N) };
  }

  function radiusTurn(c, N) {
    // 转角用 ±3 邻域 + 截断 |turn|≤1.2rad：
    //  · ±1 邻域会被手绘噪声抖动淹没；
    //  · 连杆曲线的【尖点】（速度为零处方向突变）在噪声+平滑下被摊成一串
    //    中等转角，而拟合曲线把它集中在两三个大转角里 —— 位置稍偏转角 RMS 就虚爆，
    //    几何误差 7.5px 的近完美拟合也被误杀（实测机构曲线#11）。
    //  转角签名的本职是防「绕行方向/大形状错了」，对奇异点的尖峰过敏没有意义，
    //  截断对两条曲线对称生效，方向信息（转角符号结构）完整保留。
    var radius = new Float64Array(N), turn = new Float64Array(N), i;
    for (i = 0; i < N; i++) {
      var x = c[i * 2], y = c[i * 2 + 1];
      radius[i] = Math.hypot(x, y);
      var prev = (i - 3 + N) % N, next = (i + 3) % N;
      var ax = c[i * 2] - c[prev * 2], ay = c[i * 2 + 1] - c[prev * 2 + 1];
      var bx = c[next * 2] - c[i * 2], by = c[next * 2 + 1] - c[i * 2 + 1];
      var t = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      turn[i] = Math.max(-1.2, Math.min(1.2, t));
    }
    // 转角序列再做 5 点环形平滑：尖点在拟合曲线上的位置与目标差 2~3 个
    // 弧长样本时，逐点比较仍会虚爆（实测 raw 7.5px 的近完美拟合 turn=0.56）。
    // 平滑只抹平位置抖动，总转角（方向信息）不变。
    var sm = new Float64Array(N);
    for (i = 0; i < N; i++) {
      var acc = 0;
      for (var k = -2; k <= 2; k++) acc += turn[(i + k + N) % N];
      sm[i] = acc / 5;
    }
    return { radius: radius, turn: sm };
  }

  // 弧长均匀重采样（允许 NaN 缝隙：取有效点闭合处理）。
  // 【关键】连杆曲线按曲柄转角 θ 均匀采样时，点沿曲线的走速严重不均；
  // 目标曲线是按弧长采样的 —— 不做这一步，形状相同的两条线逐点对齐也会错位，
  // 评分虚高（这就是原页面随机搜索只有匀速曲线能过阈值的根因）。
  // 返回 {pts: Float64Array N*2, srcIdx: 每个重采样点对应的原采样序号}（srcIdx 用于动画相位）
  function arcResample(raw, N) {
    var validX = [], validY = [];
    for (var i = 0; i < raw.length / 2; i++) {
      if (Number.isFinite(raw[i * 2]) && Number.isFinite(raw[i * 2 + 1])) {
        validX.push(raw[i * 2]); validY.push(raw[i * 2 + 1]);
      }
    }
    var n = validX.length;
    if (n < N * 0.8) return null;
    var cum = [0];
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      cum.push(cum[i] + Math.hypot(validX[j] - validX[i], validY[j] - validY[i]));
    }
    var total = cum[n];
    if (total < 1e-9) return null;
    var pts = new Float64Array(N * 2), srcIdx = new Int32Array(N);
    var seg = 0;
    for (var k = 0; k < N; k++) {
      var t = total * k / N;
      while (seg < n - 1 && cum[seg + 1] < t) seg++;
      var segLen = cum[seg + 1] - cum[seg];
      var lt = segLen > 0 ? (t - cum[seg]) / segLen : 0;
      var j2 = (seg + 1) % n;
      pts[k * 2] = validX[seg] + (validX[j2] - validX[seg]) * lt;
      pts[k * 2 + 1] = validY[seg] + (validY[j2] - validY[seg]) * lt;
      srcIdx[k] = seg;
    }
    return { pts: pts, srcIdx: srcIdx };
  }

  // 与页面 matchCurves 完全同口径的评分（含全部罚项）；targetPre 已居中已缩放
  function preciseMatch(targetPre, tDesc, targetStats, couplerRaw) {
    var N = N_ATLAS, i;
    var ar = arcResample(couplerRaw, N);
    if (!ar) return null;
    var src = ar.pts;
    var ccx = 0, ccy = 0;
    for (i = 0; i < N; i++) { ccx += src[i * 2]; ccy += src[i * 2 + 1]; }
    ccx /= N; ccy /= N;
    var cc = new Float64Array(N * 2), couplerRms = 0;
    for (i = 0; i < N; i++) {
      var x = src[i * 2] - ccx, y = src[i * 2 + 1] - ccy;
      cc[i * 2] = x; cc[i * 2 + 1] = y;
      couplerRms += x * x + y * y;
    }
    couplerRms = Math.sqrt(couplerRms / N);
    if (!Number.isFinite(couplerRms) || couplerRms < 0.5) return null;
    var scaleApplied = TARGET_RMS / couplerRms;
    for (i = 0; i < N; i++) { cc[i * 2] *= scaleApplied; cc[i * 2 + 1] *= scaleApplied; }
    return scoreAligned(targetPre, tDesc, targetStats, cc, N, scaleApplied, ar.srcIdx, ccx, ccy);
  }

  function scoreAligned(targetPre, tDesc, targetStats, cc, N, scaleApplied, srcIdx, ccx, ccy) {
    var i;
    var couplerStats = curveStats(cc, N);
    var ratioPenalty = Math.abs(Math.log(couplerStats.ratio / targetStats.ratio)) * 16;
    var lengthPenalty = Math.abs(Math.log(couplerStats.length / targetStats.length)) * 10;
    var cDesc = radiusTurn(cc, N);

    var bestScore = Infinity, best = null;
    for (var dir = 0; dir < 2; dir++) {
      var direction = dir === 0 ? 1 : -1;
      for (var offset = 0; offset < N; offset++) {
        var error = 0, maxSq = 0;
        var l1 = 0, l2 = 0, l3 = 0, l4 = 0, l5 = 0;
        var radiusError = 0, turnError = 0;
        for (i = 0; i < N; i++) {
          var j = direction === 1 ? (i + offset) % N : (offset - i + N) % N;
          var cx2 = cc[j * 2], cy2 = cc[j * 2 + 1];
          if (!Number.isFinite(cx2)) { error += 1e6; continue; }
          var dx = targetPre[i * 2] - cx2, dy = targetPre[i * 2 + 1] - cy2;
          var dSq = dx * dx + dy * dy;
          error += dSq;
          if (dSq > maxSq) maxSq = dSq;
          // 前 5 大偏差的插入排序（与页面 largestSq 数组同义）——
          // 早期版本这里写错了链式赋值，p95 被污染成 ~max，评分全面偏高
          if (dSq > l5) {
            l5 = dSq;
            if (l5 > l4) { var t4 = l4; l4 = l5; l5 = t4;
              if (l4 > l3) { var t3 = l3; l3 = l4; l4 = t3;
                if (l3 > l2) { var t2 = l2; l2 = l3; l3 = t2;
                  if (l2 > l1) { var t1 = l1; l1 = l2; l2 = t1; } } } }
          }
          var dr = tDesc.radius[i] - cDesc.radius[j];
          radiusError += dr * dr;
          var ct = direction === 1 ? cDesc.turn[j] : -cDesc.turn[j];
          var dt = tDesc.turn[i] - ct;
          turnError += dt * dt;
        }
        var rawError = Math.sqrt(error / N);
        // 转角权重 8（页面判定版是 18）：转角有自己的独立阈值，总分里权重过大会
        // 诱导优化器牺牲几何精度去凑转角 —— 尖点曲线（心形/8字）尤其受害。
        // 这里是搜索目标，页面判定口径不受影响。
        var score = rawError + Math.sqrt(maxSq) * 0.35 + Math.sqrt(l5) * 0.55 +
          Math.sqrt(radiusError / N) * 0.45 + Math.sqrt(turnError / N) * 8 +
          ratioPenalty + lengthPenalty;
        if (score < bestScore) {
          bestScore = score;
          best = {
            score: score, rawError: rawError, p95Error: Math.sqrt(l5),
            maxError: Math.sqrt(maxSq), radiusError: Math.sqrt(radiusError / N),
            turnError: Math.sqrt(turnError / N),
            ratioPenalty: ratioPenalty, lengthPenalty: lengthPenalty,
            offset: offset, direction: direction,
            // 弧长重采样的源索引 → 动画起始 crank 角（页面用它把动画对到最佳相位）
            srcIdx: srcIdx ? srcIdx[offset] : 0,
            N: N
          };
        }
      }
    }
    return best;
  }

  /* ==================== 图谱 ==================== */

  var atlas = null;   // {desc: Float32Array(M*K), par: Float64Array(M*9), M}

  function buildAtlas(count, onProgress) {
    return new Promise(function (resolve) {
      trigTables();
      var M = count || 60000;
      var desc = new Float32Array(M * K_DESC);
      var par = new Float64Array(M * 9);
      var rng = makeRng(20260923);
      var done = 0;
      var CH = 2000;
      (function chunk() {
        var end = Math.min(done + CH, M);
        for (var s = done; s < end; s++) {
          var p = null, tries = 0;
          while (!p && tries < 40) { p = sampleParams(rng); tries++; }
          if (!p) { p = { o2x: -54, o2y: 0, o4x: 54, o4y: 0, l2: 26, l3: 120, l4: 108, u: 66, v: 26 }; }
          var curve = fourBarCurve(p, 0, N_ATLAS);
          // 描述子必须在【弧长重采样】后的曲线上提：目标曲线是弧长采样的，
          // θ 均匀采样与弧长采样的谐波含量不同（走速不均 = 谐波幅度调制），
          // 参数化不一致会让粗筛检索系统性错位
          if (curve) {
            var ar = arcResample(curve, N_ATLAS);
            curve = ar ? ar.pts : curve;
          }
          var d = fourierMag(curve ? curve : new Float64Array(N_ATLAS * 2));
          for (var k = 0; k < K_DESC; k++) desc[s * K_DESC + k] = d[k];
          par[s * 9] = p.o2x; par[s * 9 + 1] = p.o2y; par[s * 9 + 2] = p.o4x; par[s * 9 + 3] = p.o4y;
          par[s * 9 + 4] = p.l2; par[s * 9 + 5] = p.l3; par[s * 9 + 6] = p.l4; par[s * 9 + 7] = p.u; par[s * 9 + 8] = p.v;
        }
        done = end;
        if (onProgress) onProgress(done / M, done, M);
        if (done < M) setTimeout(chunk, 0);
        else { atlas = { desc: desc, par: par, M: M }; resolve(atlas); }
      })();
    });
  }

  function atlasReady() { return !!atlas; }
  function atlasSize() { return atlas ? atlas.M : 0; }

  function coarseTopK(targetDesc, topK) {
    // L1 加权距离（低阶谐波权重高）
    var M = atlas.M, K = K_DESC;
    var w = new Float64Array(K);
    for (var k = 0; k < K; k++) w[k] = 1 / Math.sqrt(k + 1);
    var scores = new Float32Array(M);
    for (var m = 0; m < M; m++) {
      var sc = 0, base = m * K;
      for (k = 0; k < K; k++) sc += w[k] * Math.abs(targetDesc[k] - atlas.desc[base + k]);
      scores[m] = sc;
    }
    var idx = [];
    for (var i = 0; i < M; i++) idx.push(i);
    idx.sort(function (a, b) { return scores[a] - scores[b]; });
    return idx.slice(0, topK || 48);
  }

  /* ==================== 模式搜索精修 ==================== */

  // 参数向量（四杆）：[ground, tilt, yBase, l2, l3, l4, uRel, vRel, rot]
  // u/v 用相对 l3 的比例存储，跨维度步长才可比
  function vecToParams(v) {
    var l3 = v[4];
    var u = v[6] * l3, vv = v[7] * l3;
    var p = {
      o2x: -v[0] / 2, o2y: v[2] - v[1] / 2,
      o4x: v[0] / 2, o4y: v[2] + v[1] / 2,
      l2: v[3], l3: l3, l4: v[5], u: u, v: vv
    };
    return p;
  }
  var VEC_LO = [0.55, -0.30, -0.25, 0.12, 0.42, 0.36, -0.25, -0.85, 0];
  var VEC_HI = [2.05, 0.30, 0.25, 0.62, 2.10, 2.00, 1.25, 0.85, Math.PI * 2];
  var VEC_STEP0 = [10, 8, 8, 7, 12, 12, 0.08, 0.08, 0.5];

  function evalVec(v, ctx) {
    var p = vecToParams(v);
    if (!plausible(p)) return null;
    var curve = fourBarCurve(p, v[8], N_ATLAS);
    if (!curve) return null;
    return preciseMatch(ctx.target64, ctx.tDesc, ctx.tStats, curve);
  }

  function optimizeFrom(v0, ctx, budget, restarts, stepScale) {
    restarts = restarts == null ? 2 : restarts;
    stepScale = stepScale || 1;
    var v = v0.slice();
    var best = evalVec(v, ctx);
    if (!best) return null;
    var bestScore = best.score, bestVec = v.slice(), evals = 1;

    function descend(vec) {
      // 单次模式搜索：返回 [最优向量, 最优结果]
      var vv = vec.slice();
      var r = evalVec(vv, ctx);
      if (!r) return [vv, null];
      var sc = r.score, step = VEC_STEP0.map(function (s) { return s * stepScale; });
      var cnt = 1;
      for (var level = 0; level < 6 && cnt < budget; level++) {
        var improved = false;
        for (var sweep = 0; sweep < 3 && cnt < budget; sweep++) {
          var anyBetter = false;
          for (var d = 0; d < vv.length && cnt < budget; d++) {
            for (var sgn = -1; sgn <= 1; sgn += 2) {
              if (cnt >= budget) break;
              var old = vv[d];
              vv[d] = Math.max(VEC_LO[d], Math.min(VEC_HI[d], old + sgn * step[d]));
              var rr = evalVec(vv, ctx);
              cnt++;
              if (rr && rr.score < sc) { sc = rr.score; r = rr; anyBetter = true; improved = true; }
              else vv[d] = old;
            }
          }
          if (!anyBetter) break;
        }
        if (!improved) for (d = 0; d < step.length; d++) step[d] *= 0.5;
      }
      return [vv, r];
    }

    var cur = descend(v);
    if (cur[1]) { bestScore = cur[1].score; best = cur[1]; bestVec = cur[0]; }
    // 盆地跳跃：收敛点附近随机扰动后再次收敛，跳出局部盆地
    // （每轮 descend 各有内部预算上限，这里不再做跨轮计数——早先版本的
    //   evals += budget 会让第二次重启永远不执行，白写了两轮）
    var rng = makeRng(0x9e3779b9 ^ Math.round((v0[3] * 977 + v0[4] * 131) * 7));
    for (var rs = 0; rs < restarts; rs++) {
      var vv2 = bestVec.slice();
      var bump = [9, 7, 7, 6, 10, 10, 0.07, 0.07, 0.35];
      for (var d2 = 0; d2 < vv2.length; d2++) {
        vv2[d2] = Math.max(VEC_LO[d2], Math.min(VEC_HI[d2], vv2[d2] + (rng() * 2 - 1) * bump[d2]));
      }
      var cur2 = descend(vv2);
      if (cur2[1] && cur2[1].score < bestScore) { bestScore = cur2[1].score; best = cur2[1]; bestVec = cur2[0]; }
    }
    return { params: vecToParams(bestVec), rot: bestVec[8], metrics: best, evals: budget * (1 + restarts), vec: bestVec.slice() };
  }

  /* ==================== 对外：拟合 ==================== */

  // points96: 页面归一化目标曲线（96×2，居中 RMS=120）
  // opts: {topK=48, budget=600, progress(done,total,label)}
  function fitCurve(points96, opts) {
    opts = opts || {};
    var topK = opts.topK || 48;
    var budget = opts.budget || 600;
    return new Promise(function (resolve, reject) {
      if (!atlas) { reject(new Error('atlas not built')); return; }
      var N = points96.length / 2;
      var t64 = resampleClosed(points96, N_ATLAS);
      var t64n = centerScale(t64);
      var tDesc = radiusTurn(t64n, N_ATLAS);
      var tStats = curveStats(t64n, N_ATLAS);
      var fDesc = fourierMag(t64n);
      var cands = coarseTopK(fDesc, topK);
      var results = [];
      var ci = 0;
      var per = Math.ceil((topK * budget) / 24);   // 分 24 片
      function chunk() {
        var end = Math.min(ci + Math.max(1, Math.round(per / budget)), topK);
        for (; ci < end; ci++) {
          var m = cands[ci];
          var p = {
            o2x: atlas.par[m * 9], o2y: atlas.par[m * 9 + 1],
            o4x: atlas.par[m * 9 + 2], o4y: atlas.par[m * 9 + 3],
            l2: atlas.par[m * 9 + 4], l3: atlas.par[m * 9 + 5],
            l4: atlas.par[m * 9 + 6], u: atlas.par[m * 9 + 7], v: atlas.par[m * 9 + 8]
          };
          // 初始向量：由参数反解（ground/tilt/yBase 从 o2/o4 反推），rot 先扫描 12 个初值
          var ground = Math.hypot(p.o4x - p.o2x, p.o4y - p.o2y);
          var tilt = p.o4y - p.o2y, yBase = (p.o2y + p.o4y) / 2;
          var base = [ground, tilt, yBase, p.l2, p.l3, p.l4, p.u / p.l3, p.v / p.l3, 0];
          var bestRot = null, bestRotScore = Infinity;
          for (var ri = 0; ri < 16; ri++) {
            var vv = base.slice(); vv[8] = ri * Math.PI / 8;
            var r0 = evalVec(vv, { target64: t64n, tDesc: tDesc, tStats: tStats });
            if (r0 && r0.score < bestRotScore) { bestRotScore = r0.score; bestRot = vv; }
          }
          if (!bestRot) continue;
          var res = optimizeFrom(bestRot, { target64: t64n, tDesc: tDesc, tStats: tStats }, budget);
          if (res && res.metrics) {
            results.push(res);
          }
        }
        if (opts.progress) opts.progress(ci / topK, ci, topK);
        if (ci < topK) setTimeout(chunk, 0);
        else {
          results.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
          // 终抛光：前 3 名用细步长 + 多重启再收敛一轮（近失败多数差在最后一口气）
          var polished = results.slice(0, 3).map(function (r) {
            return optimizeFrom(r.vec, { target64: t64n, tDesc: tDesc, tStats: tStats }, 1800, 4, 0.35) || r;
          });
          polished.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
          resolve({ best: polished[0] || results[0] || null, tried: results.length, atlasSize: atlas.M, topK: topK });
        }
      }
      setTimeout(chunk, 0);
    });
  }

  /* ==================== 基准曲线族 ==================== */

  function benchmarkCurves() {
    // 40 条闭曲线 = 14 条经典曲线（连杆曲线族可达/可逼近的教科书形状）
    //            + 26 条【留出机构生成曲线】：用与图谱不同随机种子的四杆合成，
    //              加高斯噪声（模拟手抖）与随机旋转 —— 检验技能对「可达曲线族」的还原能力，
    //              这才是「绘制正确率」的公平口径（族外形状例如三瓣/直角钥匙孔，
    //              任何四杆都画不出来，不该计入命中率）。
    var curves = [], names = [];
    function add(name, fn) {
      var pts = [];
      for (var i = 0; i < 240; i++) {
        var t = i / 240 * Math.PI * 2;
        var xy = fn(t);
        pts.push(xy[0], xy[1]);
      }
      var a = new Float64Array(pts);
      var n = centerScale(resampleClosed(a, 96));
      curves.push(n); names.push(name);
    }
    add('圆', function (t) { return [Math.cos(t), Math.sin(t)]; });
    add('椭圆1.5', function (t) { return [1.5 * Math.cos(t), Math.sin(t)]; });
    add('椭圆2.2', function (t) { return [2.2 * Math.cos(t), Math.sin(t)]; });
    add('圆角方形', function (t) {
      var c = Math.cos(t), s = Math.sin(t), p = 4;
      return [Math.sign(c) * Math.pow(Math.abs(c), 2 / p), Math.sign(s) * Math.pow(Math.abs(s), 2 / p)];
    });
    add('水滴', function (t) { var r = 1 + 0.45 * Math.cos(t); return [r * Math.cos(t - Math.PI / 2), r * Math.sin(t - Math.PI / 2) + 0.15]; });
    add('豆形', function (t) { var r = 1 + 0.35 * Math.cos(2 * t) - 0.18 * Math.cos(t); return [r * Math.cos(t), r * Math.sin(t)]; });
    add('肾形', function (t) { var r = 1 + 0.4 * Math.cos(2 * t) - 0.25; return [r * Math.cos(t), r * Math.sin(t)]; });
    add('月牙', function (t) { return [Math.cos(t) * (1 + 0.3 * Math.sin(t)), Math.sin(t) * (0.7 + 0.5 * Math.cos(t))]; });
    add('心形', function (t) { return [16 * Math.pow(Math.sin(t), 3) / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; });
    add('8字', function (t) { return [Math.cos(t), Math.sin(2 * t) / 2]; });
    add('D形', function (t) { return [Math.max(0.45, Math.cos(t)), Math.sin(t)]; });
    add('鸡蛋', function (t) { var r = 1 + 0.22 * Math.cos(t) + 0.1 * Math.cos(2 * t); return [r * Math.cos(t), r * Math.sin(t)]; });
    add('花生', function (t) { var r = 1 + 0.5 * Math.cos(2 * t); return [r * Math.cos(t), r * Math.sin(t)]; });
    add('凸透镜', function (t) { return [Math.cos(t) * Math.abs(Math.cos(t)) * 1.3, Math.sin(t)]; });

    // —— 26 条留出机构曲线（种子与图谱 20260923 不同 → 图谱里没有它们） ——
    var rng = makeRng(777777);
    function gauss() {
      // Box-Muller
      var u = Math.max(rng(), 1e-12), v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (var n = 0; n < 26; n++) {
      var p = null, tries = 0;
      while (!p && tries < 60) { p = sampleParams(rng); tries++; }
      if (!p) continue;
      // 高分辨率采样整条连杆曲线
      var raw = fourBarCurve(p, 0, 240);
      if (!raw) { n--; continue; }
      // 手抖噪声 + 随机旋转（旋转模拟下笔方向任意）
      var rot = rng() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
      var noisy = new Float64Array(240 * 2);
      for (var i = 0; i < 240; i++) {
        var x = raw[i * 2] + gauss() * 1.6, y = raw[i * 2 + 1] + gauss() * 1.6;
        noisy[i * 2] = x * cr - y * sr;
        noisy[i * 2 + 1] = x * sr + y * cr;
      }
      // 模拟页面 processCurve 的滑动平均平滑（windowSize ≈ 点数/40），
      // 技能实际收到的就是平滑后的曲线，基准口径必须一致
      var w2 = 5, sm = new Float64Array(240 * 2);
      for (i = 0; i < 240; i++) {
        var sx = 0, sy = 0;
        for (var k2 = -w2; k2 <= w2; k2++) {
          var q = (i + k2 + 240) % 240;
          sx += noisy[q * 2]; sy += noisy[q * 2 + 1];
        }
        sm[i * 2] = sx / (2 * w2 + 1); sm[i * 2 + 1] = sy / (2 * w2 + 1);
      }
      var nm = centerScale(resampleClosed(sm, 96));
      curves.push(nm);
      names.push('机构曲线#' + (n + 1));
    }
    return { curves: curves, names: names };
  }

  /* ==================== 对外 ==================== */

  root.MechAtlas = {
    TARGET_RMS: TARGET_RMS,
    N_ATLAS: N_ATLAS,
    K_DESC: K_DESC,
    resampleClosed: resampleClosed,
    centerScale: centerScale,
    fourierMag: fourierMag,
    fourBarCurve: fourBarCurve,
    plausible: plausible,
    preciseMatch: preciseMatch,
    radiusTurn: radiusTurn,
    curveStats: curveStats,
    buildAtlas: buildAtlas,
    atlasReady: atlasReady,
    atlasSize: atlasSize,
    fitCurve: fitCurve,
    benchmarkCurves: benchmarkCurves,
    makeRng: makeRng,
    // —— 供 MechSkill 同步拟合使用的内部件（不改动上面对外语义） ——
    _coarseTopK: coarseTopK,
    _parAt: function (m) {
      return {
        o2x: atlas.par[m * 9], o2y: atlas.par[m * 9 + 1],
        o4x: atlas.par[m * 9 + 2], o4y: atlas.par[m * 9 + 3],
        l2: atlas.par[m * 9 + 4], l3: atlas.par[m * 9 + 5],
        l4: atlas.par[m * 9 + 6], u: atlas.par[m * 9 + 7], v: atlas.par[m * 9 + 8]
      };
    },
    _evalVec: evalVec,
    _optimizeFrom: optimizeFrom
  };
})(window);
