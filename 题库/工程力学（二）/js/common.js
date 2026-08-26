/* ============================================================
   工程力学题库系统 - 共享工具库
   ============================================================ */
'use strict';

/* ---------------- Toast 提示 ---------------- */
let _toastTimer = null;
function toast(msg, type) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast ' + (type || '') + ' show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

/* ---------------- 图片压缩（上传前转 base64 data URI） ---------------- */
function compressImage(file, callback, maxW, maxH) {
  if (!file || !file.type.match(/^image\//)) { callback(null); return; }
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = function () {
    URL.revokeObjectURL(url);
    maxW = maxW || 1400; maxH = maxH || 1400;
    let w = img.width, h = img.height;
    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    // 透明 PNG 转 JPEG 会有黑底问题，判断是否有透明像素
    let dataUri;
    try {
      dataUri = canvas.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      dataUri = canvas.toDataURL('image/png');
    }
    callback(dataUri);
  };
  img.onerror = function () { URL.revokeObjectURL(url); callback(null); };
  img.src = url;
}

/* ---------------- 音频/视频原样读取为 data URI ---------------- */
function readFileAsDataURL(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.onerror = () => callback(null);
  reader.readAsDataURL(file);
}

/* ---------------- HTML 工具 ---------------- */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || '';
}

/* ---------------- 日期格式化 ---------------- */
function formatDate(s) {
  if (!s) return '';
  return String(s).slice(0, 10);
}

/* ---------------- KaTeX 渲染 ---------------- */
function renderMathIn(rootEl) {
  if (!rootEl) return;
  if (window.renderMathInElement && window.katex) {
    try {
      window.renderMathInElement(rootEl, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (e) { /* 渲染失败忽略 */ }
  }
}

/* 渲染单个公式到容器（上传页实时预览用） */
function renderSingleFormula(code, containerEl) {
  if (!window.katex || !containerEl) return;
  try {
    window.katex.render(code || '', containerEl, { throwOnError: false, displayMode: false });
  } catch (e) {
    containerEl.textContent = '公式渲染失败';
  }
}

/* ---------------- 难度映射 ---------------- */
const DIFF_LABEL = { easy: '基础', medium: '中等', hard: '困难' };
function diffLabel(d) { return DIFF_LABEL[d] || '中等'; }

/* ---------------- API 封装 ---------------- */
async function api(url, options) {
  const resp = await fetch(url, options);
  let data = {};
  try { data = await resp.json(); } catch (e) {}
  if (!resp.ok || data.ok === false) {
    throw new Error(data.message || ('请求失败 (' + resp.status + ')'));
  }
  return data;
}

/* ---------------- 标签数据 ---------------- */
let TAG_DATA = { subjects: [] };

async function loadTags() {
  TAG_DATA = await QStore.loadTags();
  return TAG_DATA;
}

function getSubject(name) {
  return (TAG_DATA.subjects || []).find(s => s.name === name);
}

/* 由三级标签反查 question 的 学科/大类 是否合法（用于筛选） */
function pointBelongsTo(subject, category, point) {
  const s = getSubject(subject);
  if (!s) return true; // 未知学科不拦截
  const c = (s.categories || []).find(x => x.name === category);
  if (!c) return true;
  return (c.knowledge_points || []).includes(point);
}

/* ---------------- 媒体路径修复 ---------------- */
/* 给裸文件名 media src（如 content_img_0.png）补上 qdata/qid/ 前缀。
   兼容旧数据：以前存的 HTML 里 src 只是裸文件名，页面在站点根目录时会被解析成
   /content_img_0.png（404）。data URI / 外部 URL / 已含路径 一律不动。 */
function fixMediaSrc(html, qid) {
  if (!html) return html;
  return html.replace(/src=["']([^"']+)["']/g, function (m, src) {
    if (src.indexOf('data:') === 0) return m;                                   // 内嵌 data URI
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return m;                          // 外部 URL
    if (src.indexOf('/') >= 0 || src.indexOf('\\') >= 0) return m;              // 已含路径
    return 'src="qdata/' + (qid || '') + '/' + src + '"';                       // 裸文件名 → 补路径
  });
}

/* ---------------- 文本选择域光标插入 ---------------- */
function insertAtCursor(textarea, text) {
  const s = textarea.selectionStart == null ? textarea.value.length : textarea.selectionStart;
  const e = textarea.selectionEnd == null ? textarea.value.length : textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, s) + text + textarea.value.slice(e);
  const pos = s + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
  return textarea.value;
}

/* ============================================================
   纯本地（file:// 双击打开）离线支持
   ------------------------------------------------------------
   服务器模式下：所有数据走后端 API（qdata 文件夹），并实时同步一份到
   localStorage 作为缓存。
   离线模式下（双击 HTML 以 file:// 打开）：fetch 无法访问后端，改用
   localStorage 存储；首次使用时由 js/data.js（服务器从 qdata 导出的快照）
   播种，图片/音频/视频以 data URI 内嵌存储。
   离线新增/编辑的题目在回到服务器模式时，会自动同步回 qdata。
   ============================================================ */
function isOffline() { return location.protocol === 'file:'; }

const LS_KEYS = { questions: 'qbank_questions_v1', tags: 'qbank_tags_v1' };

function lsGet(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) {
    console.warn('localStorage 写入失败（可能超出存储上限）:', e);
    return false;
  }
}

function nowStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function localQuestions() { return lsGet(LS_KEYS.questions, []); }
function saveLocalQuestions(qs) { lsSet(LS_KEYS.questions, qs); }
function localTags() { return lsGet(LS_KEYS.tags, null); }
function saveLocalTags(t) { lsSet(LS_KEYS.tags, t); }

function seedData() { return window.QBANK_SEED || null; }

function maxLocalId(qs) {
  let n = 0;
  (qs || []).forEach(q => {
    const m = /^q_(\d+)$/.exec(q.id || '');
    if (m) n = Math.max(n, parseInt(m[1], 10));
  });
  return n;
}

function upsertLocalQuestion(q) {
  const qs = localQuestions();
  const i = qs.findIndex(x => x.id === q.id);
  if (i >= 0) qs[i] = q; else qs.push(q);
  saveLocalQuestions(qs);
}
function removeLocalQuestion(id) {
  saveLocalQuestions(localQuestions().filter(x => x.id !== id));
}

// 合并两批题目：同一 id 取 updated 较新者
function mergeQuestions(a, b) {
  const map = {};
  (a || []).forEach(q => { map[q.id] = q; });
  (b || []).forEach(q => {
    if (!map[q.id] || (q.updated || '') > (map[q.id].updated || '')) map[q.id] = q;
  });
  return Object.keys(map).map(k => map[k]);
}

// 首次使用（localStorage 为空）时用 js/data.js 播种
function ensureSeeded() {
  const seed = seedData();
  if (!seed) return;
  if (!localQuestions().length && seed.questions) saveLocalQuestions(seed.questions);
  if (!localTags() && seed.tags) saveLocalTags(seed.tags);
}

// 离线读取：本地数据 + 种子数据合并
function mergedLocalWithSeed() {
  ensureSeeded();
  const seed = seedData();
  if (!seed) return localQuestions();
  const merged = mergeQuestions(localQuestions(), seed.questions);
  saveLocalQuestions(merged);
  return merged;
}

function stripFlags(q) {
  const o = {};
  Object.keys(q).forEach(k => { if (k !== '_offlineNew' && k !== '_editedOffline') o[k] = q[k]; });
  return o;
}

// 离线新增/编辑的题目，在服务器模式下同步回 qdata
async function syncOfflineToServer() {
  if (isOffline()) return;
  const qs = localQuestions();
  const needs = qs.filter(q => q._offlineNew || q._editedOffline);
  if (!needs.length) return false;
  let serverIds;
  try {
    serverIds = new Set((await api('api/list?_=' + Date.now())).questions.map(q => q.id));
  } catch (e) { return false; } // 服务器暂不可用，留待下次
  let synced = false;
  for (const q of needs) {
    try {
      if (q._offlineNew) {
        const d = await api('api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stripFlags(q)) });
        if (d && d.id) {
          removeLocalQuestion(q.id);
          const fresh = await api('api/question?id=' + d.id).catch(() => null);
          if (fresh && fresh.question) {
            upsertLocalQuestion(Object.assign({}, fresh.question, { _offlineNew: false, _editedOffline: false }));
          } else {
            upsertLocalQuestion(Object.assign({}, stripFlags(q), { id: d.id, _offlineNew: false, _editedOffline: false }));
          }
          synced = true;
        }
      } else if (q._editedOffline) {
        if (serverIds.has(q.id)) {
          const d = await api('api/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stripFlags(q)) });
          if (d && d.id) {
            const fresh = await api('api/question?id=' + q.id).catch(() => null);
            upsertLocalQuestion(Object.assign({}, fresh && fresh.question ? fresh.question : stripFlags(q), { _offlineNew: false, _editedOffline: false }));
            synced = true;
          }
        } else {
          upsertLocalQuestion(Object.assign({}, q, { _offlineNew: true, _editedOffline: false }));
        }
      }
    } catch (e) { /* 单题同步失败不影响其它 */ }
  }
  return synced;
}

/* ---- 统一数据入口：服务器优先，离线回落 ---- */
const QStore = {
  async list() {
    ensureSeeded();
    if (!isOffline()) {
      try {
        const d = await api('api/list?_=' + Date.now());
        if (d && d.questions) {
          const merged = mergeQuestions(d.questions, localQuestions().filter(q => q._offlineNew || q._editedOffline));
          saveLocalQuestions(merged);
          syncOfflineToServer(); // 后台推送离线题，不阻塞渲染
          return merged;
        }
      } catch (e) { /* 服务器不可用 → 回落本地 */ }
    }
    return mergedLocalWithSeed();
  },

  async get(id) {
    if (!isOffline()) {
      try {
        const d = await api('api/question?id=' + id);
        if (d && d.question) return d.question;
      } catch (e) {}
    }
    return localQuestions().find(q => q.id === id) || null;
  },

  async save(payload, editingId) {
    const offline = isOffline();
    // 编辑的是离线新题（服务器上还没有）→ 直接本地更新，交给后台同步
    if (!offline && editingId) {
      const local = localQuestions().find(x => x.id === editingId);
      if (local && local._offlineNew) return this.saveOffline(payload, editingId);
    }
    if (!offline) {
      try {
        const body = editingId ? Object.assign({}, payload, { id: editingId }) : payload;
        const d = await api(editingId ? 'api/update' : 'api/upload',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (d && d.id) {
          const fresh = await api('api/question?id=' + d.id).catch(() => null);
          if (fresh && fresh.question) upsertLocalQuestion(Object.assign({}, fresh.question, { _offlineNew: false, _editedOffline: false }));
        }
        return { id: d.id, offline: false };
      } catch (e) {
        if (e instanceof TypeError) return this.saveOffline(payload, editingId); // 网络不可达
        throw e; // 服务器可达但报错 → 真实错误
      }
    }
    return this.saveOffline(payload, editingId);
  },

  async saveOffline(payload, editingId) {
    const qs = localQuestions();
    let q;
    const now = nowStr();
    if (editingId) {
      const existing = qs.find(x => x.id === editingId);
      if (!existing) throw new Error('题目不存在: ' + editingId);
      q = Object.assign({}, existing, payload, { id: editingId, updated: now });
      q._offlineNew = !!q._offlineNew;
      q._editedOffline = true;
    } else {
      q = Object.assign({}, payload, { id: 'q_' + String(maxLocalId(qs) + 1).padStart(3, '0'), created: now, updated: now });
      q._offlineNew = true;
      q._editedOffline = false;
    }
    upsertLocalQuestion(q);
    const size = JSON.stringify(q).length;
    if (size > 3 * 1024 * 1024) toast('注意：本题含媒体数据较大（约 ' + (size / 1048576).toFixed(1) + 'MB），已保存到浏览器本地', '');
    return { id: q.id, offline: true };
  },

  async remove(id) {
    if (!isOffline()) {
      try {
        await api('api/delete?id=' + id, { method: 'DELETE' });
        removeLocalQuestion(id);
        return { offline: false };
      } catch (e) {
        if (e instanceof TypeError) { removeLocalQuestion(id); return { offline: true }; }
        throw e;
      }
    }
    removeLocalQuestion(id);
    return { offline: true };
  },

  async loadTags() {
    ensureSeeded();
    if (!isOffline()) {
      try {
        const d = await api('api/tags?_=' + Date.now());
        if (d && d.tags) { saveLocalTags(d.tags); return d.tags; }
      } catch (e) {}
    }
    const t = localTags();
    if (t) return t;
    return (seedData() && seedData().tags) || { subjects: [] };
  },

  async addTag(action, name, extra) {
    const nm = (name || '').trim();
    if (!nm) throw new Error('名称不能为空');
    if (!isOffline()) {
      try {
        const d = await api('api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action, name: nm }, extra || {})) });
        if (d && d.tags) saveLocalTags(d.tags);
        return d.tags;
      } catch (e) {
        if (e instanceof TypeError) return this.addTagOffline(action, nm, extra);
        throw e;
      }
    }
    return this.addTagOffline(action, nm, extra);
  },

  addTagOffline(action, nm, extra) {
    const t = (localTags() || (seedData() && seedData().tags) || { subjects: [] });
    const subjects = t.subjects || [];
    const subject = extra && extra.subject;
    const category = extra && extra.category;
    if (action === 'add_subject') {
      if (subjects.some(s => s.name === nm)) throw new Error('学科「' + nm + '」已存在');
      subjects.push({ name: nm, categories: [] });
    } else if (action === 'add_category') {
      const s = subjects.find(x => x.name === subject);
      if (!s) throw new Error('学科「' + subject + '」不存在');
      if (s.categories.some(c => c.name === nm)) throw new Error('知识大类「' + nm + '」已存在');
      s.categories.push({ name: nm, knowledge_points: [] });
    } else if (action === 'add_point') {
      const s = subjects.find(x => x.name === subject);
      if (!s) throw new Error('学科「' + subject + '」不存在');
      const c = s.categories.find(x => x.name === category);
      if (!c) throw new Error('知识大类「' + category + '」不存在');
      if (c.knowledge_points.indexOf(nm) >= 0) throw new Error('知识点「' + nm + '」已存在');
      c.knowledge_points.push(nm);
    } else if (action === 'add_question_type') {
      if (!t.question_types) t.question_types = ['判断题', '选择题', '填空题', '解答题', '证明题', '计算题'];
      if (t.question_types.indexOf(nm) >= 0) throw new Error('题型「' + nm + '」已存在');
      t.question_types.push(nm);
    } else {
      throw new Error('未知操作');
    }
    saveLocalTags(t);
    return t;
  },
};

// 顶栏显示运行模式徽标
function addModeBadge() {
  const nav = document.querySelector('.topbar .nav-links');
  if (!nav) return;
  const badge = document.createElement('span');
  const offline = isOffline();
  badge.textContent = offline ? '💾 离线模式' : '🖥 服务器模式';
  badge.title = offline ? '纯本地运行，数据保存在浏览器 localStorage；启动 server.py 后可同步到 qdata' : '数据由后端保存在 qdata 文件夹';
  badge.style.cssText = 'font-size:0.75em;color:#fff;padding:4px 12px;border-radius:12px;font-weight:600;background:' + (offline ? '#374151' : '#1e7e46');
  nav.insertBefore(badge, nav.firstChild);
}

// 加载即播种：确保任何页面/顺序下 localStorage 都有基础数据
ensureSeeded();

/* ============================================================
   自动讲解系统（TTS）
   - 公式 → 一句话总结（不照读公式）
   - 解析 HTML → 讲解词（文字保留 + 公式总结）
   - 服务器模式：/api/tts 试听、/api/narrate 生成并存储
   - 离线模式：浏览器 speechSynthesis 试听
   ============================================================ */
const VOICE_PRESETS = [
  { id: 'yujie',   label: '御姐音 · 克洛林德', offline: { pitch: 0.7, rate: 0.9 } },
  { id: 'teacher', label: '老师音 · 大慈树王', offline: { pitch: 0.9, rate: 0.8 } },
  { id: 'loli',    label: '萝莉音 · 希格雯',   offline: { pitch: 1.6, rate: 1.3 } },
  { id: 'uncle',   label: '大叔音 · 法尔加',   offline: { pitch: 0.4, rate: 0.85 } },
  { id: 'girl',    label: '少女音 · 宵宫',     offline: { pitch: 1.15, rate: 1.1 } },
  { id: 'boy',     label: '少男音 · 重云',     offline: { pitch: 1.1, rate: 1.05 } },
];

function getVoicePreset(id) {
  return VOICE_PRESETS.find(v => v.id === id) || VOICE_PRESETS[4];
}

function voiceSelectHtml(selected) {
  return VOICE_PRESETS.map(v =>
    '<option value="' + v.id + '"' + (v.id === selected ? ' selected' : '') + '>' + v.label + '</option>'
  ).join('');
}

const _GREEK_READ = {
  alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta',
  theta: 'theta', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi',
  rho: 'rho', sigma: 'sigma', tau: 'tau', phi: 'phi',
  varphi: 'phi', omega: 'omega', varepsilon: 'epsilon',
  epsilon: 'epsilon', lambda: 'lambda', psi: 'psi'
};

function latexReadable(f) {
  let s = f;
  Object.keys(_GREEK_READ).forEach(cmd => { s = s.split('\\' + cmd).join(_GREEK_READ[cmd]); });
  s = s.replace(/\\(?:[a-zA-Z]+|\{|\})/g, ' ');
  s = s.replace(/[_^]/g, '').replace(/\\/g, ' ').replace(/[{}]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// 公式总结规则（默认值，与 qdata/tts_prompt.json 一致；运行时会加载配置覆盖）
const DEFAULT_TTS_RULES = [
  { 匹配: ['\\frac{\\pi^2 EI', 'F_{cr}', 'F_cr'], 总结: '细长压杆的欧拉临界压力公式' },
  { 匹配: ['\\mathbf{a}_c', 'a_c=', '\\boldsymbol{\\omega}'], 总结: '科氏加速度等于两倍角速度叉乘相对速度' },
  { 匹配: ['EI*w', 'w*M(', '\\frac{d^2w'], 总结: '由挠曲线微分方程积分求解' },
  { 匹配: ['\\frac{d}{dt}*m\\mathbf{v}', '\\frac{d}{dt}*mv'], 总结: '动量对时间求导等于合外力' },
  { 匹配: ['\\int*F', 'mv*mv_0', '\\frac{1}{2}kt^2'], 总结: '由动量定理，冲量等于动量的改变量' },
  { 匹配: ['\\sum F'], 总结: '沿该方向合力为零' },
  { 匹配: ['F=\\frac{P}{2\\sin'], 总结: '杆内力等于荷载除以两倍正弦夹角' },
  { 匹配: ['F=kt'], 总结: '力随时间线性增大' },
  { 匹配: ['\\frac{PL^3}{3EI}'], 总结: '自由端挠度为三倍EI分之PL立方' },
  { 匹配: ['\\frac{PL^2}{2EI}'], 总结: '自由端转角为二倍EI分之PL平方' },
  { 匹配: ['\\frac{kt^2}{2m}'], 总结: '速度等于二m分之kt平方' },
  { 匹配: ['\\frac{Px^2}{6EI}'], 总结: '积分两次得到挠曲线方程' },
  { 匹配: ['w_B', 'wB'], 总结: 'B端的挠度' },
  { 匹配: ['\\theta_B', '\\thetaB'], 总结: 'B端的转角' },
  { 匹配: ['v_0=0', 'v0=0'], 总结: '初速度为零' },
  { 匹配: ['M_O', '\\sum M'], 总结: '对O点求合力矩' },
  { 匹配: ['\\omega*\\approx'], 总结: '角速度近似为所给数值' },
  { 匹配: ['\\sigma=\\frac{N}{A}'], 总结: '正应力等于轴力除以截面积' },
  { 匹配: ['\\tau=\\frac{T}{W'], 总结: '切应力等于扭矩除以抗扭系数' },
  { 匹配: ['\\frac{d^2}{dt^2}', '\\ddot'], 总结: '对时间求二阶导数' },
  { 匹配: ['\\frac{d}{dt}', '\\dot'], 总结: '对时间求一阶导数' },
  { 匹配: ['\\int'], 总结: '对该物理量求积分' },
  { 匹配: ['\\sum'], 总结: '对各分量求和' },
  { 匹配: ['\\oint'], 总结: '沿闭合回路积分' },
  { 匹配: ['\\sqrt'], 总结: '取平方根' },
  { 匹配: ['\\frac'], 总结: '由分式计算相应物理量' }
];

// 讲解提示词配置（来自 qdata/tts_prompt.json，运行时加载）
let TTS_PROMPT = {
  总结要求: '把块级公式总结成一句不超过20字的中文物理语言，直接输出总结内容，不解释，不读公式本身。',
  行内公式: '照着念，转成可读的字母数字，不总结。',
  llm: { enabled: false },
  公式规则: DEFAULT_TTS_RULES
};

function normLatex(s) {
  return String(s || '').replace(/\s+/g, '')
    .split('\\dfrac').join('\\frac')
    .split('\\tfrac').join('\\frac')
    .split('\\cfrac').join('\\frac')
    .replace(/\\/g, '').replace(/[{}]/g, '');
}

function sanitizePattern(s) {
  return String(s || '')
    .split('\f').join('\\f')
    .split('\b').join('\\b')
    .split('\n').join('\\n')
    .split('\r').join('\\r')
    .split('\t').join('\\t');
}

function wildcardMatch(pattern, text) {
  const parts = String(pattern).split('*');
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const idx = text.indexOf(part, pos);
    if (idx < 0) return false;
    pos = idx + part.length;
  }
  return true;
}

// 加载讲解提示词配置：服务器模式取 /api/tts-prompt，离线用 data.js 内嵌
async function loadTtsPrompt() {
  if (!isOffline()) {
    try {
      const d = await api('api/tts-prompt?_=' + Date.now());
      if (d && d.prompt) { TTS_PROMPT = d.prompt; return; }
    } catch (e) {}
  }
  const seed = seedData();
  if (seed && seed.tts_prompt) TTS_PROMPT = seed.tts_prompt;
}

// 公式 → 一句话总结（≤20 字，按配置规则，* 为通配）
function formulaToSpeech(latex) {
  const f = (latex || '').trim();
  if (!f) return '';
  const nf = normLatex(f);
  const rules = (TTS_PROMPT && TTS_PROMPT['公式规则']) || DEFAULT_TTS_RULES;
  for (let i = 0; i < rules.length; i++) {
    const pats = rules[i]['匹配'];
    const list = Array.isArray(pats) ? pats : [pats];
    for (let j = 0; j < list.length; j++) {
      if (list[j] && wildcardMatch(normLatex(sanitizePattern(list[j])), nf)) return rules[i]['总结'] || '';
    }
  }
  const readable = latexReadable(f);
  if (readable && readable.length <= 6 && !/[=<>+\-*/^]/.test(readable)) return readable;
  return '按该公式计算所求物理量';
}

// 解析 HTML → 讲解词（文字保留、公式替换为总结，逐字对应）
function explanationToSpeech(html) {
  let s = (html || '');
  s = s.replace(/<(audio|video|source|img|script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(audio|video|source|img)[^>]*\/?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  s = s.replace(/\s+/g, ' ').trim();
  const parts = [];
  let pos = 0;
  const re = /\$\$(.+?)\$\$|\$(.+?)\$/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    parts.push(s.slice(pos, m.index));
    // $$...$$ 块级 → 总结；$...$ 行内 → 照着念
    parts.push(m[1] !== undefined ? formulaToSpeech(m[1].trim()) : latexReadable(m[2].trim()));
    pos = m.index + m[0].length;
  }
  parts.push(s.slice(pos));
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// 离线试听（浏览器 speechSynthesis）
function speakOffline(text, voiceId) {
  if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音合成', 'error'); return; }
  const v = getVoicePreset(voiceId);
  const u = new SpeechSynthesisUtterance(text || '');
  u.lang = 'zh-CN';
  u.pitch = v.offline.pitch;
  u.rate = v.offline.rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// 服务器模式试听：/api/tts → 播放 mp3
async function previewSpeechServer(explanationHtml, voiceId, playerEl) {
  try {
    const resp = await fetch('api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explanation: explanationHtml, voice: voiceId })
    });
    if (!resp.ok) {
      let msg = '语音合成失败';
      try { msg = (await resp.json()).message || msg; } catch (e) {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    if (playerEl) {
      playerEl.src = url;
      playerEl.style.display = 'block';
      playerEl.play().catch(() => {});
    } else {
      const a = new Audio(url);
      a.play().catch(() => {});
    }
    return true;
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
}

// 统一试听入口（自动选择模式）
async function previewSpeech(explanationHtml, voiceId, playerEl) {
  if (!(explanationHtml || '').trim()) { toast('请先填写解析内容', 'error'); return false; }
  if (isOffline()) {
    speakOffline(explanationToSpeech(explanationHtml), voiceId);
    return true;
  }
  return previewSpeechServer(explanationHtml, voiceId, playerEl);
}

// 生成并保存讲解音频（服务器模式）
async function generateNarration(qid, voiceId) {
  if (isOffline()) { toast('离线模式无法生成音频文件，可先使用「试听讲解」', 'error'); return null; }
  try {
    const d = await api('api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: qid, voice: voiceId })
    });
    return d.narration || null;
  } catch (e) {
    toast(e.message, 'error');
    return null;
  }
}

// 渲染讲解区块（详情弹窗用）
function narrationHtml(q) {
  const n = q.narration;
  if (!n) {
    return '<div style="color:var(--text-lighter);font-size:0.9em">该题暂无自动讲解音频。</div>';
  }
  const aiBadge = n.ai_generated
    ? '<span style="display:inline-block;font-size:0.72em;font-weight:700;color:#fff;background:linear-gradient(135deg,#f0a030,#e67e22);padding:2px 10px;border-radius:10px;margin-bottom:4px">✨ AI 讲解</span>'
    : '';
  return aiBadge
    + '<audio controls preload="none" src="' + escapeHtml(n.path || '') + '" style="width:100%;margin:6px 0"></audio>'
    + '<div style="font-size:0.8em;color:var(--text-lighter);margin:4px 0">音色：' + escapeHtml(n.voice_label || '') + ' · 生成于 ' + escapeHtml(n.created || '') + '</div>'
    + '<div style="font-size:0.85em;line-height:1.7;background:#fbfdff;border:1px dashed var(--border);border-radius:8px;padding:10px 12px;margin-top:6px">'
    + '<b>讲解词（公式已总结，不照读）：</b><br>' + escapeHtml(n.speakable_text || '') + '</div>';
}
