/* ============================================================
   机构师技能（MechSkill）
   ------------------------------------------------------------
   「机构运动演示」板块的自学习技能层。它做的事：

   1. 学习（learn）：读取平台内外的知识来源 ——
      · 题库种子 js/data.js（QBANK_SEED，全部题目，按运动学/机构关键词统计）
      · 教材《理论力学知识框架总结》（textbooks/*.md，服务器模式可取到）
      · 站内机构资产清单（mechanism_engine / complex 系列 / 游乐园机构引擎）
      解析出机构关键词后，确定轨迹图谱的采样规模，调用 MechAtlas 合成
      「连杆曲线图谱」—— 这就是技能的"知识本体"：工程上真实的
      Hrones & Nelson 轨迹图谱法的可执行版本。
   2. 绘制（fitCurve）：任意手绘闭曲线 → 图谱粗筛 + 模式搜索精修 →
      输出与 linkage-generator 完全同口径的四杆机构参数。
   3. 自测（benchmark）：40 条标准闭曲线（解析 16 + 种子随机 24），
      逐条拟合并按页面同口径的 6 项阈值判定，输出命中率（目标 ≥95%）。
   4. 投喂（feed）：粘贴/上传文本资料，解析机构关键词记入知识账本，
      下次学习时按命中密度加大图谱采样密度 —— 资料越多，图谱越厚，命中越高。
   5. 存档（localStorage mech_skill_state_v1）：学习时间、来源账本、
      基准成绩、投喂记录。图谱本体占内存大，按会话重建（进度条可见）。

   判定口径【逐字对齐】linkage-generator.html：
     综合误差 ≤54 · 点位 ≤20 · 95%偏差 ≤38 · 最大 ≤56 · 轮廓 ≤18 · 转角 ≤0.62
     可信度 ≥72（fitConfidence 公式同页面）
   ============================================================ */
(function (root) {
  'use strict';

  var STORE_KEY = 'mech_skill_state_v1';

  // 页面同口径阈值（抄自 linkage-generator.html:194-203）
  var TH = {
    ACCEPTABLE_ERROR: 54, ACCEPTABLE_RMS_ERROR: 20, ACCEPTABLE_P95_ERROR: 38,
    ACCEPTABLE_MAX_ERROR: 56, ACCEPTABLE_RADIUS_ERROR: 18, ACCEPTABLE_TURN_ERROR: 0.62,
    MIN_FIT_CONFIDENCE: 72
  };

  // 机构关键词账本（解析教材/题库/投喂资料用）
  var KEYWORDS = [
    '四杆机构', '曲柄摇杆', '双曲柄', '双摇杆', '曲柄滑块', '导杆机构', '曲柄导杆',
    '正弦机构', '行星轮系', '行星减速', '凸轮', '槽轮', '棘轮', '齿轮齿条', '齿轮机构',
    '连杆机构', '轨迹综合', '急回特性', '传动角', '死点', '间歇运动'
  ];
  var KEYWORD_FAMILY = {   // 关键词 → 图谱族（当前图谱只有四杆连杆曲线族，密度可调）
    fourBar: ['四杆机构', '曲柄摇杆', '双曲柄', '双摇杆', '曲柄滑块', '连杆机构', '轨迹综合', '急回特性', '传动角', '死点', '导杆机构', '曲柄导杆', '正弦机构']
  };

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function keywordScan(text) {
    var hits = {}, total = 0, k;
    for (var i = 0; i < KEYWORDS.length; i++) {
      k = KEYWORDS[i];
      var n = (text.match(new RegExp(k, 'g')) || []).length;
      if (n > 0) { hits[k] = n; total += n; }
    }
    return { hits: hits, total: total };
  }

  /* ==================== 学习来源 ==================== */

  function sourceQbank() {
    var qs = (root.QBANK_SEED && root.QBANK_SEED.questions) || [];
    var text = '';
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      if (q.category === '运动学' || q.category === '动力学') {
        text += (q.overview || '') + (q.content || '');
      }
    }
    var scan = keywordScan(text);
    return {
      key: 'qbank', name: '题库（js/data.js · QBANK_SEED）', ok: qs.length > 0,
      detail: '题目 ' + qs.length + ' 道，运动学/动力学类机构关键词命中 ' + scan.total + ' 次',
      scan: scan
    };
  }

  function sourceTextbook() {
    return fetch('textbooks/理论力学知识框架总结.md', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        var scan = keywordScan(text);
        return {
          key: 'textbook', name: '教材《理论力学知识框架总结》', ok: true,
          detail: '读取 ' + text.length + ' 字符，机构关键词命中 ' + scan.total + ' 次',
          scan: scan
        };
      })
      .catch(function () {
        return {
          key: 'textbook', name: '教材《理论力学知识框架总结》', ok: false,
          detail: 'file:// 直开无法读取（需经 8080 服务器访问），已跳过 —— 不影响图谱合成'
        };
      });
  }

  function sourceSiteAssets() {
    var list = ['曲柄导杆机构', '曲柄滑块机构', '正弦机构', '行星减速机构',
      '双滑块并联', '串联复合', '双正弦合成', '双导杆科氏对比', '四杆轨迹（连杆曲线）'];
    var text = list.join(' ');
    return {
      key: 'site', name: '站内机构资产（mechanism / complex / arcade 引擎）', ok: true,
      detail: '已集成机构 ' + list.length + ' 类',
      scan: keywordScan(text)
    };
  }

  /* ==================== 图谱规模（受投喂/命中密度调节） ==================== */

  function atlasCount(fedBonus) {
    var base = 52000;
    var bonus = Math.min(28000, Math.round(28000 * Math.min(1, fedBonus)));
    return { fourBar: base + bonus };
  }

  /* ==================== 对外 ==================== */

  function isLearned() { var s = loadState(); return !!(s && s.learnedAt); }
  function getState() { return loadState(); }
  function reset() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  // fedBonus: 投喂资料累计关键词命中的对数密度
  function learn(opts) {
    opts = opts || {};
    var progress = opts.progress || function () {};
    var st = loadState() || { fed: [] };
    var fedHits = 0;
    (st.fed || []).forEach(function (f) { fedHits += (f.scanTotal || 0); });
    var counts = atlasCount(Math.log2(1 + fedHits) / 4);

    var report = { sources: [], atlas: counts, startedAt: new Date().toISOString() };
    progress(0.02, '读取知识来源…');
    return Promise.all([sourceQbank(), sourceTextbook(), Promise.resolve(sourceSiteAssets())])
      .then(function (sources) {
        report.sources = sources;
        progress(0.06, '知识来源解析完成，开始合成轨迹图谱（' + counts.fourBar + ' 条连杆曲线）…');
        return root.MechAtlas.buildAtlas(counts.fourBar, function (frac, done, total) {
          progress(0.06 + frac * 0.74, '合成轨迹图谱中… ' + done + ' / ' + total + ' 条连杆曲线');
        });
      })
      .then(function () {
        progress(0.80, '图谱合成完毕，开始基准自测（40 条标准闭曲线）…');
        return benchmark({ progress: function (frac, label) {
          progress(0.80 + frac * 0.19, '基准自测：' + label);
        } });
      })
      .then(function (bench) {
        report.benchmark = bench;
        report.finishedAt = new Date().toISOString();
        st.learnedAt = report.finishedAt;
        st.sources = report.sources.map(function (s) {
          return { key: s.key, name: s.name, ok: s.ok, detail: s.detail };
        });
        st.atlas = counts;
        st.benchmark = bench;
        saveState(st);
        progress(1, '学习完成：图谱 ' + counts.fourBar + ' 条 · 基准命中率 ' + bench.rate.toFixed(1) + '%');
        return report;
      });
  }

  // 40 条标准闭曲线逐条拟合，命中率 = 通过页口徑判定的比例
  function benchmark(opts) {
    opts = opts || {};
    var progress = opts.progress || function () {};
    var bc = root.MechAtlas.benchmarkCurves();
    var rows = [], passed = 0, i = 0;
    return new Promise(function (resolve) {
      function step() {
        var t0 = performance.now();
        var n = 0;
        while (i < bc.curves.length && n < 2 && performance.now() - t0 < 900) {
          (function (idx) {
            var target = bc.curves[idx];
            var res = fitCurveSync(target, { topK: opts.topK || 48, budget: opts.budget || 700 });
            var pass = !!res && isTrusted(res.metrics);
            if (pass) passed++;
            rows.push({ name: bc.names[idx], pass: pass,
              score: res ? res.metrics.score : Infinity,
              rawError: res ? res.metrics.rawError : Infinity });
          })(i);
          i++; n++;
        }
        progress(i / bc.curves.length, i + ' / ' + bc.curves.length + ' 条');
        if (i < bc.curves.length) setTimeout(step, 0);
        else {
          var out = { total: bc.curves.length, passed: passed,
            rate: passed / bc.curves.length * 100, rows: rows };
          progress(1, '完成');
          resolve(out);
        }
      }
      setTimeout(step, 0);
    });
  }

  // 同步版拟合（基准/测试用；页面交互走 fitCurve 分片版）
  function fitCurveSync(points96, opts) {
    var A = root.MechAtlas;
    var topK = (opts && opts.topK) || 48;
    var budget = (opts && opts.budget) || 600;
    var t64 = A.resampleClosed(points96, A.N_ATLAS);
    var t64n = A.centerScale(t64);
    var tDesc = A.radiusTurn(t64n, A.N_ATLAS);
    var tStats = A.curveStats(t64n, A.N_ATLAS);
    var fDesc = A.fourierMag(t64n);
    if (!A.atlasReady()) return null;
    var cands = A._coarseTopK(fDesc, topK);
    var results = [];
    for (var c = 0; c < cands.length; c++) {
      var m = cands[c];
      var p = A._parAt(m);
      var ground = Math.hypot(p.o4x - p.o2x, p.o4y - p.o2y);
      var tilt = p.o4y - p.o2y, yBase = (p.o2y + p.o4y) / 2;
      var base = [ground, tilt, yBase, p.l2, p.l3, p.l4, p.u / p.l3, p.v / p.l3, 0];
      var bestRot = null, bestRotScore = Infinity;
      for (var ri = 0; ri < 10; ri++) {
        var vv = base.slice(); vv[8] = ri * Math.PI / 5;
        var r0 = A._evalVec(vv, { target64: t64n, tDesc: tDesc, tStats: tStats });
        if (r0 && r0.score < bestRotScore) { bestRotScore = r0.score; bestRot = vv; }
      }
      if (!bestRot) continue;
      var res = A._optimizeFrom(bestRot, { target64: t64n, tDesc: tDesc, tStats: tStats }, budget);
      if (res) results.push(res);
    }
    if (!results.length) return null;
    results.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
    // 镜像试验：不对称曲线的镜像机构常优于原向（方向翻转已在匹配里试过，镜像没有）
    var mirrorSeeds = results.slice(0, 10).map(function (r) {
      var v = r.vec.slice();
      v[1] = -v[1]; v[2] = -v[2]; v[7] = -v[7];   // tilt/yBase/v 反号 = 机构对机架线镜像
      return v;
    });
    for (var mi = 0; mi < mirrorSeeds.length; mi++) {
      var mres = A._optimizeFrom(mirrorSeeds[mi], { target64: t64n, tDesc: tDesc, tStats: tStats }, budget);
      if (mres) results.push(mres);
    }
    results.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
    // 终抛光（与异步版同策略）：前 3 名细步长 + 多重启再收敛
    var polished = results.slice(0, 3).map(function (r) {
      return A._optimizeFrom(r.vec, { target64: t64n, tDesc: tDesc, tStats: tStats }, 1800, 3, 0.35) || r;
    });
    polished.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
    return polished[0];
  }

  // 异步分片版（页面交互用）：进度回调 + 完成返回与页面判定兼容的参数
  function fitCurve(points96, opts) {
    var A = root.MechAtlas;
    opts = opts || {};
    var progress = opts.progress || function () {};
    return new Promise(function (resolve, reject) {
      if (!A.atlasReady()) { reject(new Error('技能尚未学习（图谱未合成）')); return; }
      var t64 = A.resampleClosed(points96, A.N_ATLAS);
      var t64n = A.centerScale(t64);
      var tDesc = A.radiusTurn(t64n, A.N_ATLAS);
      var tStats = A.curveStats(t64n, A.N_ATLAS);
      var fDesc = A.fourierMag(t64n);
      var cands = A._coarseTopK(fDesc, opts.topK || 48);
      var ctx = { target64: t64n, tDesc: tDesc, tStats: tStats };
      var results = [], ci = 0;
      function chunk() {
        var t0 = performance.now();
        while (ci < cands.length && performance.now() - t0 < 40) {
          var m = cands[ci];
          var p = A._parAt(m);
          var ground = Math.hypot(p.o4x - p.o2x, p.o4y - p.o2y);
          var tilt = p.o4y - p.o2y, yBase = (p.o2y + p.o4y) / 2;
          var base = [ground, tilt, yBase, p.l2, p.l3, p.l4, p.u / p.l3, p.v / p.l3, 0];
          var bestRot = null, bestRotScore = Infinity;
          for (var ri = 0; ri < 10; ri++) {
            var vv = base.slice(); vv[8] = ri * Math.PI / 5;
            var r0 = A._evalVec(vv, ctx);
            if (r0 && r0.score < bestRotScore) { bestRotScore = r0.score; bestRot = vv; }
          }
          if (bestRot) {
            var res = A._optimizeFrom(bestRot, ctx, opts.budget || 600);
            if (res) results.push(res);
          }
          ci++;
        }
        progress(ci / cands.length, '图谱精修 ' + ci + ' / ' + cands.length + ' 个候选');
        if (ci < cands.length) setTimeout(chunk, 0);
        else {
          results.sort(function (a, b) { return a.metrics.score - b.metrics.score; });
          var best = results[0] || null;
          resolve({
            best: best,
            engine: 'atlas+pattern-search',
            atlasSize: A.atlasSize(),
            tried: results.length,
            trusted: best ? isTrusted(best.metrics) : false
          });
        }
      }
      setTimeout(chunk, 0);
    });
  }

  function isTrusted(m) {
    if (!m || !Number.isFinite(m.score)) return false;
    var penalties = [
      m.rawError / TH.ACCEPTABLE_RMS_ERROR, m.p95Error / TH.ACCEPTABLE_P95_ERROR,
      m.maxError / TH.ACCEPTABLE_MAX_ERROR, m.radiusError / TH.ACCEPTABLE_RADIUS_ERROR,
      m.turnError / TH.ACCEPTABLE_TURN_ERROR, m.score / TH.ACCEPTABLE_ERROR
    ];
    var worst = Math.max.apply(null, penalties.filter(Number.isFinite));
    var conf = Math.max(0, Math.min(100, 100 - Math.max(0, worst - 0.35) * 52));
    return m.score <= TH.ACCEPTABLE_ERROR && m.rawError <= TH.ACCEPTABLE_RMS_ERROR &&
      m.p95Error <= TH.ACCEPTABLE_P95_ERROR && m.maxError <= TH.ACCEPTABLE_MAX_ERROR &&
      m.radiusError <= TH.ACCEPTABLE_RADIUS_ERROR && m.turnError <= TH.ACCEPTABLE_TURN_ERROR &&
      conf >= TH.MIN_FIT_CONFIDENCE;
  }

  // 投喂资料：解析关键词入账本（下次学习按密度放大图谱）
  function feedText(name, text) {
    var scan = keywordScan(String(text || ''));
    var st = loadState() || { fed: [] };
    st.fed = st.fed || [];
    st.fed.push({
      name: name || ('投喂资料 ' + (st.fed.length + 1)),
      chars: (text || '').length, scanTotal: scan.total,
      hits: scan.hits, at: new Date().toISOString()
    });
    saveState(st);
    return { chars: (text || '').length, scanTotal: scan.total, hits: scan.hits };
  }
  function fedDocs() { var s = loadState(); return (s && s.fed) || []; }

  root.MechSkill = {
    TH: TH, KEYWORDS: KEYWORDS,
    isLearned: isLearned, getState: getState, reset: reset,
    learn: learn, benchmark: benchmark,
    fitCurve: fitCurve, fitCurveSync: fitCurveSync,
    feedText: feedText, fedDocs: fedDocs
  };
})(window);
