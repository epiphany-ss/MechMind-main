// ==================== 设置面板折叠 ====================
function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
}

// ==================== 对话记录管理 ====================
let currentConvId = null;

function getConversations() {
  try { return JSON.parse(localStorage.getItem('qa_conversations') || '[]'); }
  catch(e) { return []; }
}

function saveConversations(convs) {
  localStorage.setItem('qa_conversations', JSON.stringify(convs));
}

function newConversation() {
  currentConvId = 'conv_' + Date.now();
  const convs = getConversations();
  convs.unshift({ id: currentConvId, title: '新对话', messages: [], createdAt: Date.now() });
  if (convs.length > 50) convs.length = 50;
  saveConversations(convs);
  document.getElementById('chatBody').innerHTML = '';
  addMessage('bot', '您好！我是<strong>理论力学AI智能助教</strong> 🤖<br><br>我可以帮助您：<br>📐 <strong>解答问题</strong>：静力学、运动学、动力学、分析力学<br>📝 <strong>逐步推导</strong>：公式证明、定理推导、解题过程<br>💡 <strong>概念讲解</strong>：力学概念的物理意义与工程应用<br>🔬 <strong>机构分析</strong>：运动学特性、速度加速度计算<br><br>🔌 <strong>AI增强模式</strong>：在上方API设置中输入密钥，保存后即可启用<br>🌐 <strong>联网搜索</strong>：超出知识库的问题可一键跳转搜索引擎<br><br>请随时向我提问！', '刚刚');
  updateMemoryBadge(0);
  renderSidebar();
  if (window.innerWidth <= 768) toggleSidebar();
  scrollToBottom();
}

function switchConversation(id) {
  if (id === currentConvId) return;
  saveChatHistory();
  currentConvId = id;
  const convs = getConversations();
  const conv = convs.find(c => c.id === id);
  const body = document.getElementById('chatBody');
  body.innerHTML = '';
  if (conv && conv.messages.length > 0) {
    conv.messages.forEach(msg => addMessage(msg.type, msg.text, msg.time));
  } else {
    addMessage('bot', '您好！我是<strong>理论力学AI智能助教</strong> 🤖<br><br>请随时向我提问！', '刚刚');
  }
  updateMemoryBadge(conv ? conv.messages.length : 0);
  renderSidebar();
  scrollToBottom();
  if (window.innerWidth <= 768) toggleSidebar();
}

function deleteConversation(id) {
  let convs = getConversations();
  const idx = convs.findIndex(c => c.id === id);
  if (idx < 0) return;
  convs.splice(idx, 1);
  saveConversations(convs);
  if (id === currentConvId) {
    if (convs.length > 0) { currentConvId = null; switchConversation(convs[0].id); }
    else newConversation();
  } else { renderSidebar(); }
}

function renderSidebar() {
  const list = document.getElementById('convList');
  const convs = getConversations();
  if (!list) return;
  if (convs.length === 0) {
    list.innerHTML = '<div class="conv-empty">暂无对话记录<br>开始提问吧</div>';
    return;
  }
  list.innerHTML = convs.map(c => {
    const isActive = c.id === currentConvId;
    const title = c.title || '新对话';
    const time = new Date(c.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    const msgCount = c.messages ? c.messages.length : 0;
    return '<div class="conv-item' + (isActive ? ' active' : '') + '" onclick="switchConversation(\'' + c.id + '\')" title="' + escapeHTML(title) + '"><div class="conv-title">' + escapeHTML(title) + '</div><div class="conv-meta"><span>' + time + '</span><span>' + msgCount + '条</span></div><button class="conv-delete" onclick="event.stopPropagation();deleteConversation(\'' + c.id + '\')" title="删除">✕</button></div>';
  }).join('');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

// ==================== 知识库 ====================
const knowledgeBase = {
  '速度瞬心': {
    category: '运动学',
    answer: `<strong>速度瞬心（Instantaneous Center of Velocity）</strong>是刚体平面运动中，某一瞬时其上速度为零的点。

<div class="formula-block">
<strong>核心性质：</strong><br>
• 刚体上各点的速度方向垂直于该点与瞬心的连线<br>
• 各点速度大小与到瞬心的距离成正比：$v = \omega \cdot r$<br>
• 瞬心位置随时间变化（瞬时概念，非固定点）
</div>

<strong>确定瞬心位置的四种方法：</strong><br>
① <strong>已知两点速度方向</strong> → 分别作速度方向的垂线，交点即瞬心<br>
② <strong>纯滚动</strong> → 接触点即瞬心（无滑动的滚动）<br>
③ <strong>已知一点速度大小和角速度</strong> → 瞬心在该点速度方向的垂直线上，距离 $r = \dfrac{v}{\omega}$<br>
④ <strong>两点速度平行且大小不等</strong> → 瞬心在两点连线与速度端点连线的交点

<strong>工程应用：</strong>四杆机构、行星齿轮、凸轮机构的速度分析中广泛使用瞬心法，可避免复杂的矢量运算。`
  },
  '受力图': {
    category: '静力学',
    answer: `<strong>画受力图（Free Body Diagram）</strong>是力学分析的第一步，也是最关键的一步。

<strong>📋 画受力图的标准步骤：</strong><br>
1️⃣ <strong>选取研究对象</strong>：明确分析哪个物体（整体或单个构件）<br>
2️⃣ <strong>解除约束</strong>：将研究对象从周围物体中分离出来<br>
3️⃣ <strong>画主动力</strong>：标出所有已知外力（重力、载荷、推力等）<br>
4️⃣ <strong>画约束反力</strong>：根据约束类型确定反力方向和数量

<div class="formula-block">
<strong>常见约束类型及反力：</strong><br>
• 柔索（绳索/链条）→ 沿柔索方向的<strong>拉力</strong>（1个未知量）<br>
• 光滑接触面 → 沿法线方向的<strong>压力</strong>（1个未知量）<br>
• 光滑铰链/轴承 → 两个正交<strong>分力</strong>（2个未知量）<br>
• 固定铰支座 → 两个正交<strong>分力</strong>（2个未知量）<br>
• 滚动支座 → 垂直于支承面的<strong>一个力</strong>（1个未知量）<br>
• 固定端 → 两个分力 + 一个<strong>力偶</strong>（3个未知量）<br>
• 二力杆 → 沿杆轴线的<strong>一个力</strong>（1个未知量）
</div>

<strong>⚠️ 常见错误：</strong>多画力、少画力、方向错误、约束类型判断错误、内力外力混淆。`
  },
  '平衡方程': {
    category: '静力学',
    answer: `<strong>平面任意力系平衡方程</strong>有三种等价形式：

<div class="formula-block">
<strong>① 基本式（一矩式）：</strong><br>
$\sum F_x = 0,\quad \sum F_y = 0,\quad \sum M_A = 0$<br>
→ 最常用，适用于所有平面力系平衡问题
</div>

<div class="formula-block">
<strong>② 二矩式：</strong><br>
$\sum F_x = 0,\quad \sum M_A = 0,\quad \sum M_B = 0$<br>
→ 附加条件：AB连线不垂直于x轴
</div>

<div class="formula-block">
<strong>③ 三矩式：</strong><br>
$\sum M_A = 0,\quad \sum M_B = 0,\quad \sum M_C = 0$<br>
→ 附加条件：A、B、C三点不共线
</div>

<strong>选择原则：</strong><br>
• 未知力汇交点取矩 → 减少方程中的未知量<br>
• 优先用力矩方程 → 避免解联立方程组<br>
• 静定问题：未知量数 = 独立方程数（平面一般力系最多3个）<br>
• 超静定问题：未知量 > 独立方程数 → 需补充变形协调条件`
  },
  '二力杆': {
    category: '静力学',
    answer: `<strong>二力杆（Two-Force Member）</strong>是静力学中的重要概念。

<strong>定义：</strong>只在两个端点受力的杆件（自重不计或已合入端点力中）。

<div class="formula-block">
<strong>核心性质：</strong><br>
① 二力平衡条件：两力必等值、反向、共线<br>
② 因此二力杆两端受力<strong>必定沿杆轴线方向</strong><br>
③ 杆件可以是直杆、弯杆或曲杆
</div>

<strong>判断方法：</strong><br>
• 杆上无外力作用（或外力已简化到端点）<br>
• 只有两个铰接点连接其他构件<br>
• 中间没有力或力偶作用

<strong>典型应用：</strong>桁架中的各杆件、四杆机构中的连杆、支撑杆等。识别二力杆可以大幅简化受力分析。`
  },
  '摩擦力': {
    category: '静力学',
    answer: `<strong>摩擦力（Friction）</strong>的完整分析：

<div class="formula-block">
<strong>静摩擦力：</strong>$F_s \leq \mu_s \cdot N$<br>
• 方向与相对滑动趋势方向相反<br>
• 大小由平衡方程确定（约束力）<br>
• 最大静摩擦力：$F_{\text{max}} = \mu_s \cdot N$
</div>

<div class="formula-block">
<strong>动摩擦力：</strong>$F_k = \mu_k \cdot N$<br>
• 方向与相对滑动方向相反<br>
• $\mu_k < \mu_s$（动摩擦系数小于静摩擦系数）
</div>

<strong>摩擦角与自锁：</strong><br>
• 摩擦角：$\varphi = \arctan(\mu_s)$<br>
• 自锁条件：主动力合力与法线夹角 ≤ φ（在摩擦锥内）<br>
• 自锁应用：螺纹、楔块、夹具等

<strong>滚动摩阻：</strong>$M \leq \delta \cdot N$（δ为滚动摩阻系数，量纲为长度）`
  },
  '空间力系': {
    category: '静力学',
    answer: `<strong>空间力系的平衡方程：</strong>

<div class="formula-block">
<strong>空间一般力系（6个独立方程）：</strong><br>
$\sum F_x = 0,\quad \sum F_y = 0,\quad \sum F_z = 0$<br>
$\sum M_x = 0,\quad \sum M_y = 0,\quad \sum M_z = 0$<br>
→ 最多求解6个未知量
</div>

<strong>特殊情况：</strong><br>
• 空间汇交力系 → 3个力方程（3个未知量）<br>
• 空间平行力系（∥z轴）→ $\sum F_z=0,\; \sum M_x=0,\; \sum M_y=0$<br>
• 空间力偶系 → 3个力矩方程

<strong>力对轴之矩：</strong>$M_x(F) = yF_z - zF_y$（轮换对称）<br>
力对点之矩与力对轴之矩的关系可用行列式表示。`
  },
  '桁架': {
    category: '静力学',
    answer: `<strong>桁架（Truss）</strong>的内力计算方法：

<strong>基本假设：</strong><br>
① 各杆均为直杆，轴线在同一平面内<br>
② 节点为光滑铰链（理想铰接）<br>
③ 载荷只作用在节点上<br>
→ 每根杆均为二力杆，只受轴向力

<strong>两种解法：</strong><br>
1️⃣ <strong>节点法（Method of Joints）：</strong><br>
• 逐节点分析，每个节点两个平衡方程<br>
• 从只有两个未知量的节点开始求解<br>
• 适合需要求所有杆内力的情形

2️⃣ <strong>截面法（Method of Sections）：</strong><br>
• 用一个截面切断桁架（不超过3根未知杆）<br>
• 取一部分为研究对象，用三个平衡方程<br>
• 适合只需求特定杆内力的情形

<strong>零力杆判断：</strong>不共线的两杆节点无外力 → 两杆均为零力杆；三杆节点有两杆共线且无外力 → 非共线杆为零力杆。`
  },
  '重心与形心': {
    category: '静力学',
    answer: `<strong>重心（Center of Gravity）与形心（Centroid）：</strong>

<div class="formula-block">
<strong>重心坐标：</strong><br>
$x_C = \dfrac{\int x \cdot dW}{W} = \dfrac{\int x \cdot \gamma \cdot dV}{\gamma \cdot V}$
</div>

<strong>形心（几何中心）：</strong>均质物体重心=形心<br>
• 对称轴上的点 → 对称形心在该轴上<br>
• 组合图形 → 分割法或负面积法

<strong>常见形心公式：</strong><br>
• 三角形：距底边 $h/3$<br>
• 半圆（中心轴）：$\dfrac{4R}{3\pi}$<br>
• 扇形：$\dfrac{2R\sin\alpha}{3\alpha}$<br>
• 梯形：$\dfrac{h(b_1+2b_2)}{3(b_1+b_2)}$（距下底）`
  },
  '科氏加速度': {
    category: '运动学',
    answer: `<strong>科氏加速度（Coriolis Acceleration）</strong>的完整分析：

<div class="formula-block">
<strong>矢量公式：$\boldsymbol{a}_C = 2\boldsymbol{\omega}_e \times \boldsymbol{v}_r$</strong><br>
大小：$|\boldsymbol{a}_C| = 2\omega_e \cdot v_r \cdot \sin(\boldsymbol{\omega}_e, \boldsymbol{v}_r)$<br>
方向：右手定则（将 $\boldsymbol{v}_r$ 绕 $\boldsymbol{\omega}_e$ 旋转90°）
</div>

<strong>物理意义：</strong>当动点相对于转动参考系有相对运动时，由于牵连运动和相对运动的<strong>耦合效应</strong>产生的一种附加加速度。它不是真实的力产生的加速度，而是在非惯性系中出现的效应。

<strong>$\boldsymbol{a}_C = \boldsymbol{0}$ 的三种情况：</strong><br>
① <strong>动系平动</strong>：$\boldsymbol{\omega}_e = \boldsymbol{0} \to \boldsymbol{a}_C = \boldsymbol{0}$<br>
② <strong>相对速度为零</strong>：$\boldsymbol{v}_r = \boldsymbol{0}$（动点相对动系静止）<br>
③ <strong>$\boldsymbol{\omega}_e \parallel \boldsymbol{v}_r$</strong>：两矢量平行，叉积为零

<strong>自然现象：</strong>北半球河流右岸冲刷更严重（柏尔定律）、信风带偏转、傅科摆的旋转。`
  },
  '点的合成运动': {
    category: '运动学',
    answer: `<strong>点的合成运动（复合运动）：</strong>

<div class="formula-block">
<strong>速度合成定理：$\boldsymbol{v}_a = \boldsymbol{v}_e + \boldsymbol{v}_r$</strong><br>
$\boldsymbol{v}_a$：绝对速度（定系观测）<br>
$\boldsymbol{v}_e$：牵连速度（动系上与动点重合点的速度）<br>
$\boldsymbol{v}_r$：相对速度（动系中观测）
</div>

<div class="formula-block">
<strong>加速度合成定理：</strong><br>
$\boldsymbol{a}_a = \boldsymbol{a}_e + \boldsymbol{a}_r + \boldsymbol{a}_C$（科氏加速度）<br>
牵连运动为平动时：$\boldsymbol{a}_C = \boldsymbol{0}$
</div>

<strong>解题三要素：</strong><br>
① 动点选择（运动轨迹已知的点）<br>
② 动系选择（通常固连在运动物体上）<br>
③ 运动分析（区分绝对/相对/牵连运动）<br><br>
<strong>口诀：</strong>动系看牵连，自身是相对，地上是绝对。`
  },
  '刚体平面运动': {
    category: '运动学',
    answer: `<strong>刚体平面运动的速度分析方法：</strong>

<strong>1️⃣ 基点法（速度合成法）：</strong><br>
$\boldsymbol{v}_B = \boldsymbol{v}_A + \boldsymbol{v}_{BA}$<br>
其中 $\boldsymbol{v}_{BA} = \boldsymbol{\omega} \times \boldsymbol{r}_{AB}$，大小 $= \omega \cdot AB$，方向 $\perp AB$

<strong>2️⃣ 速度投影定理：</strong><br>
$\boldsymbol{v}_B \cdot \boldsymbol{e}_{AB} = \boldsymbol{v}_A \cdot \boldsymbol{e}_{AB}$<br>
任意两点在连线方向上的速度投影相等（刚体不变形的推论）

<strong>3️⃣ 速度瞬心法：</strong><br>
$|\boldsymbol{v}_P| = \omega \cdot |IP|$（I为瞬心，P为刚体上任意点）<br>
方向：$\perp IP$

<strong>加速度分析：</strong>$\boldsymbol{a}_B = \boldsymbol{a}_A + \boldsymbol{a}_{BA}^t + \boldsymbol{a}_{BA}^n$（切向+法向分量）

<strong>常见结构：</strong>四杆机构、曲柄滑块、行星轮系。`
  },
  '刚体定点转动': {
    category: '运动学',
    answer: `<strong>刚体定点转动（Rotation about a Fixed Point）：</strong>

<strong>自由度：</strong>3个（通常用欧拉角描述）

<strong>角速度：</strong>ω = ψ̇k + θ̇n + φ̇z'（欧拉角速率合成）

<div class="formula-block">
<strong>速度：v = ω × r</strong><br>
<strong>加速度：a = α × r + ω × (ω × r)</strong><br>
• α × r：切向加速度分量<br>
• ω × (ω × r)：向轴加速度分量
</div>

<strong>陀螺效应：</strong>高速旋转的刚体具有定向性和进动性，是陀螺仪的理论基础。进动角速度 Ω = M/(Iω)（M为外力矩，I为自转轴转动惯量）。`
  },
  '相对运动': {
    category: '运动学',
    answer: `<strong>相对运动分析框架：</strong>

<strong>解题步骤：</strong><br>
1. 明确<strong>动点</strong>（研究对象）<br>
2. 选择<strong>动参考系</strong>（固连于哪个运动物体）<br>
3. 分析三种运动：绝对运动、相对运动、牵连运动<br>
4. 画速度/加速度矢量图<br>
5. 应用合成定理列方程求解

<strong>动点选择技巧：</strong><br>
• 选两运动物体的<strong>接触点</strong>（滑块与滑道、销钉与滑槽）<br>
• 选轨迹已知的点<br>
• 避免选择加速度突变点

<strong>动系选择技巧：</strong><br>
• 动系固连在运动规律已知的物体上<br>
• 牵连运动最好是平动（避免 $\boldsymbol{a}_C$）<br>
• 相对运动轨迹应简单（直线或圆）`
  },
  '动能定理': {
    category: '动力学',
    answer: `<strong>动能定理（Work-Energy Principle）：</strong>

<div class="formula-block">
<strong>微分形式：</strong>$dT = \delta W$（动能增量=元功）<br>
<strong>积分形式：</strong>$T_2 - T_1 = W_{12}$
</div>

<strong>动能计算公式：</strong><br>
• 平动：$T = \dfrac{1}{2}mv^2$<br>
• 定轴转动：$T = \dfrac{1}{2}J\omega^2$<br>
• 平面运动：$T = \dfrac{1}{2}mv_C^2 + \dfrac{1}{2}J_C\omega^2$（柯尼希定理）

<div class="formula-block">
<strong>常见力的功：</strong><br>
• 重力：$W = mgh$（与路径无关）<br>
• 弹性力：$W = \dfrac{1}{2}k(\delta_1^2 - \delta_2^2)$<br>
• 摩擦力：$W = -fNs$（恒为负功）<br>
• 力偶：$W = M \cdot \Delta\theta$
</div>

<strong>核心优势：</strong>标量方程，一个方程求解一个未知量（速度/角速度），避免矢量分解。适合求<strong>速度问题</strong>（不涉及约束反力）。

<strong>局限：</strong>不能直接求约束反力（因为理想约束力不做功）。`
  },
  '动量定理': {
    category: '动力学',
    answer: `<strong>动量定理（Momentum Principle）：</strong>

<div class="formula-block">
<strong>质点系动量定理：</strong><br>
$\dfrac{d\boldsymbol{p}}{dt} = \sum \boldsymbol{F}^{(e)}$（动量变化率=外力主矢）<br>
<strong>积分形式：</strong>$\Delta\boldsymbol{p} = \int\sum\boldsymbol{F}^{(e)}dt = \boldsymbol{S}$（冲量）
</div>

<strong>动量：$\boldsymbol{p} = \sum m_i\boldsymbol{v}_i = M\boldsymbol{v}_C$</strong><br>
质点系的动量等于总质量与质心速度的乘积。

<strong>动量守恒：</strong>当 $\sum F_x^{(e)} = 0$ 时，$p_x = \text{常量}$。

<strong>与动能定理的区别：</strong><br>
• 动量定理：矢量方程，涉及外力主矢，与内力无关<br>
• 动能定理：标量方程，涉及功，内力做功可能不为零<br>
• 求速度 → 优先动能定理；求约束反力 → 用动量/动量矩定理<br>
• 碰撞问题 → 动量定理（碰撞力做功难计算）`
  },
  '动量矩定理': {
    category: '动力学',
    answer: `<strong>动量矩定理（Angular Momentum Principle）：</strong>

<div class="formula-block">
<strong>对固定点O：</strong>$\dfrac{d\boldsymbol{L}_O}{dt} = \sum \boldsymbol{M}_O^{(e)}$<br>
<strong>对质心C：</strong>$\dfrac{d\boldsymbol{L}_C}{dt} = \sum \boldsymbol{M}_C^{(e)}$
</div>

<strong>动量矩（角动量）：</strong><br>
• 对固定点：$\boldsymbol{L}_O = \sum \boldsymbol{r}_i \times m_i\boldsymbol{v}_i$<br>
• 定轴转动：$L_z = J_z\omega$<br>
• 平面运动对质心：$L_C = J_C\omega$

<strong>转动惯量平行轴定理：</strong>$J_z = J_C + Md^2$

<strong>刚体定轴转动微分方程：</strong>$J\alpha = \sum M$（牛顿第二定律的转动版本）

<strong>动量矩守恒：</strong>$\sum M_O^{(e)} = 0 \to \boldsymbol{L}_O = \text{常量}$（如花样滑冰收臂加速旋转、跳水运动员空中翻转）。`
  },
  '三大定理联合': {
    category: '动力学',
    answer: `<strong>三大定理的比较与联合使用：</strong>

| 定理 | 类型 | 涉及量 | 内力影响 | 典型用途 |
|------|------|--------|----------|----------|
| 动量定理 | 矢量 | 外力主矢 | 无 | 求约束反力、碰撞 |
| 动量矩定理 | 矢量 | 外力主矩 | 无 | 求角加速度、转动问题 |
| 动能定理 | 标量 | 力的功 | 可能不为零 | 求速度、加速度 |

<strong>选择策略：</strong><br>
• <strong>求速度/角速度</strong> → 动能定理（标量，简单）<br>
• <strong>求加速度/角加速度</strong> → 动能定理+动量矩定理<br>
• <strong>求约束反力</strong> → 动量定理+动量矩定理<br>
• <strong>复杂系统</strong> → 三大定理联立（整体用动能定理求运动量，拆开用动量定理求内力）

<strong>解题流程：</strong>先整体分析运动（动能定理）→ 再取分离体分析力（动量/动量矩定理）。`
  },
  '达朗贝尔原理': {
    category: '动力学',
    answer: `<strong>达朗贝尔原理（d'Alembert's Principle）：</strong>

<strong>核心思想：</strong>在主动力和约束反力之外，假想地加上<strong>惯性力</strong>，则质点系在形式上处于平衡状态。

<div class="formula-block">
<strong>质点：</strong>$\boldsymbol{F} + \boldsymbol{F}_N + (-m\boldsymbol{a}) = 0$<br>
<strong>质点系：</strong>$\sum\boldsymbol{F}^{(a)} + \sum\boldsymbol{F}^{(c)} + \sum(-m_i\boldsymbol{a}_i) = 0$<br>
$\sum\boldsymbol{M}_O(\boldsymbol{F}^{(a)}) + \sum\boldsymbol{M}_O(\boldsymbol{F}^{(c)}) + \sum\boldsymbol{M}_O(-m_i\boldsymbol{a}_i) = 0$
</div>

<strong>惯性力的简化（刚体）：</strong><br>
• 平动 → 合力 $-M\boldsymbol{a}_C$ 作用在质心<br>
• 定轴转动（有对称面）→ 主矢 $-M\boldsymbol{a}_C$ + 主矩 $-J_O\alpha$<br>
• 平面运动 → 主矢 $-M\boldsymbol{a}_C$（作用于质心）+ 主矩 $-J_C\alpha$

<strong>应用（动静法）：</strong>将动力学问题转化为"平衡"问题，用静力学方法求解。特别适合求约束反力和轴承动反力。`
  },
  '碰撞理论': {
    category: '动力学',
    answer: `<strong>碰撞理论（Impact Theory）：</strong>

<strong>基本假设：</strong>碰撞时间极短，碰撞力极大，非碰撞力可忽略。

<strong>碰撞的两个阶段：</strong><br>
① 变形阶段（加载）→ ② 恢复阶段（卸载）

<div class="formula-block">
<strong>恢复因数：</strong>$e = \dfrac{|v_{2n}' - v_{1n}'|}{|v_{1n} - v_{2n}|}$<br>
• $e = 1$：完全弹性碰撞（动能守恒）<br>
• $e = 0$：完全塑性碰撞（碰撞后不分离）<br>
• $0 < e < 1$：弹塑性碰撞
</div>

<strong>碰撞问题求解：</strong>联立动量守恒 + 恢复因数定义式。<br>
<strong>动能损失：</strong>$\Delta T = \dfrac{1}{2}(1-e^2)\mu(v_{1n}-v_{2n})^2$（μ为折合质量）。

<strong>撞击中心：</strong>在定轴转动刚体上，存在一点使碰撞反力为零，该点即撞击中心。如棒球棒的"甜点"。`
  },
  '转动惯量': {
    category: '动力学',
    answer: `<strong>转动惯量（Moment of Inertia）：</strong>

<div class="formula-block">
<strong>定义：</strong>$J_z = \sum m_i r_i^2 = \int r^2 dm$<br>
量纲：$[M][L]^2$，单位：$\text{kg}\cdot\text{m}^2$
</div>

<strong>常见均质物体的转动惯量（对质心轴）：</strong><br>
• 细杆（中垂轴）：$J_C = \dfrac{mL^2}{12}$<br>
• 细杆（端点垂轴）：$J = \dfrac{mL^2}{3}$<br>
• 圆盘/圆柱（中心轴）：$J_C = \dfrac{mR^2}{2}$<br>
• 圆环（中心轴）：$J_C = mR^2$<br>
• 球体（中心轴）：$J_C = \dfrac{2mR^2}{5}$<br>
• 矩形板（中心轴⊥面）：$J_C = \dfrac{m(a^2+b^2)}{12}$

<strong>回转半径：</strong>$\rho = \sqrt{J/m}$，物理意义为等效集中质量的径向距离。

<strong>平行轴定理：</strong>$J_z = J_C + md^2$（d为两平行轴距离）。`
  },
  '功率与效率': {
    category: '动力学',
    answer: `<strong>功率（Power）与机械效率：</strong>

<div class="formula-block">
<strong>功率：</strong>$P = \boldsymbol{F} \cdot \boldsymbol{v} = M \cdot \omega$<br>
<strong>功率方程：</strong>$\dfrac{dT}{dt} = P_{\text{输入}} - P_{\text{有用}} - P_{\text{损耗}}$
</div>

<strong>机械效率：</strong>$\eta = P_{\text{有用}} / P_{\text{输入}} < 1$<br>
• 串联系统：总效率 = 各级效率之积<br>
• 存在摩擦时恒有能量损耗 → $\eta < 100\%$

<strong>应用：</strong>在已知功率和转速时，可求扭矩：$M = 9550\dfrac{P}{n}$（P单位kW，n单位rpm，M单位N·m）。`
  },
  '虚位移原理': {
    category: '分析力学',
    answer: `<strong>虚位移原理（Principle of Virtual Work）：</strong>

<div class="formula-block">
<strong>基本表述：</strong>对于具有<strong>理想约束</strong>的质点系，其平衡的充要条件是所有主动力在任意一组虚位移上所作虚功之和为零。<br><br>
$\sum(\boldsymbol{F}_i \cdot \delta\boldsymbol{r}_i) = 0$<br>
用广义力表示：$Q_j = 0\ (j = 1,2,\ldots,k)$
</div>

<strong>核心概念：</strong><br>
• <strong>虚位移</strong>：约束允许的、假想的、时间冻结下的无限小位移<br>
• <strong>理想约束</strong>：约束反力虚功之和为零（光滑铰链、刚性连杆、光滑面）<br>
• <strong>实位移</strong>：实际发生的位移，满足动力学方程和初始条件

<strong>最大优势：</strong>避免计算约束反力，直接建立主动力之间的关系。特别适合复杂机构的<strong>平衡位置分析</strong>和<strong>力传递关系</strong>。

<strong>解题步骤：</strong>给定虚位移 → 计算各力虚功 → 令虚功和为零 → 求解。`
  },
  '拉格朗日方程': {
    category: '分析力学',
    answer: `<strong>拉格朗日方程（Lagrange's Equations）：</strong>

<div class="formula-block">
<strong>第二类拉格朗日方程：</strong><br>
$\dfrac{d}{dt}\left(\dfrac{\partial L}{\partial \dot{q}_j}\right) - \dfrac{\partial L}{\partial q_j} = Q_j$<br>
$L = T - V$（拉格朗日函数=动能-势能）<br>
保守系统（$Q_j=0$）：$\dfrac{d}{dt}\left(\dfrac{\partial L}{\partial \dot{q}_j}\right) - \dfrac{\partial L}{\partial q_j} = 0$
</div>

<strong>使用条件：</strong><br>
① 系统所受约束为<strong>完整约束</strong>（几何约束）<br>
② 理想约束

<strong>解题步骤：</strong><br>
1. 确定自由度 $k$，选取广义坐标 $q_j$<br>
2. 用广义坐标表示动能 T(q,q̇) 和势能 V(q)<br>
3. 构建拉格朗日函数 L = T - V<br>
4. 代入拉格朗日方程，得到k个二阶微分方程<br>
5. 求解，根据初始条件确定积分常数

<strong>核心优势：</strong><br>
• 不需要考虑约束反力<br>
• 方程数 = 自由度数（最小方程数）<br>
• 形式对广义坐标选择不变<br>
• 特别适合多自由度复杂机械系统`
  },
  '哈密顿原理': {
    category: '分析力学',
    answer: `<strong>哈密顿原理（Hamilton's Principle）：</strong>

<div class="formula-block">
<strong>哈密顿作用量：</strong>$S = \displaystyle\int_{t_1}^{t_2} L \, dt$<br>
<strong>哈密顿原理：</strong>$\delta S = \delta\displaystyle\int_{t_1}^{t_2} L \, dt = 0$
</div>

<strong>物理意义：</strong>在满足约束的所有可能运动中，真实运动使哈密顿作用量取<strong>极值</strong>（通常为极小值）。这是力学最基本的变分原理，拉格朗日方程可由此导出。

<strong>哈密顿正则方程：</strong><br>
$\dot{q}_j = \dfrac{\partial H}{\partial p_j},\quad \dot{p}_j = -\dfrac{\partial H}{\partial q_j}$<br>
其中 $H = \sum p_j\dot{q}_j - L$ 为哈密顿函数

<strong>意义：</strong>哈密顿体系是分析力学的最高形式，也是量子力学、统计力学的基础。`
  },
  '广义坐标': {
    category: '分析力学',
    answer: `<strong>广义坐标（Generalized Coordinates）：</strong>

<strong>定义：</strong>能够唯一确定系统位形的独立参量 $q_j\ (j=1,2,\ldots,k)$。

<strong>自由度：</strong>完整约束系统的自由度 $k = 3n - s$<br>
（$n$ 为质点数，$s$ 为完整约束方程数）

<strong>广义力：</strong>$Q_j = \sum \boldsymbol{F}_i \cdot \dfrac{\partial \boldsymbol{r}_i}{\partial q_j}$<br>
• 当 $q_j$ 为长度量纲时，$Q_j$ 为力的量纲<br>
• 当 $q_j$ 为角度量纲时，$Q_j$ 为力矩的量纲

<strong>选取原则：</strong><br>
• 能唯一确定系统每一瞬时的位形<br>
• 彼此独立（不能互相表示）<br>
• 自然满足约束条件<br>
• 尽量选可测量的量（位移、角度等）`
  },
  '虚功原理应用': {
    category: '分析力学',
    answer: `<strong>虚功原理的典型应用：</strong>

<strong>1. 求机构平衡时主动力的关系：</strong><br>
如：杠杆、滑轮组、螺旋千斤顶、曲柄滑块机构等。

<strong>2. 求约束反力：</strong>解除待求约束 → 代之以约束反力作为主动力 → 给虚位移 → 列虚功方程。

<strong>3. 求平衡位置：</strong>将主动力用广义坐标表示 → 各广义力为零 → 解方程求平衡位置。

<strong>解题技巧：</strong><br>
• 虚位移用微分表示（δx, δy, δθ）<br>
• 利用几何关系建立虚位移之间的关系（运动学关系=虚位移关系）<br>
• 各力虚功正负功的判定很关键

<div class="formula-block warning">
<strong>注意事项：</strong>虚功原理只适用于理想约束系统。对于有摩擦的系统，需将摩擦力作为主动力处理。
</div>`
  },
  '完整约束与非完整约束': {
    category: '分析力学',
    answer: `<strong>约束的分类：</strong>

<div class="formula-block">
<strong>完整约束（Holonomic）：</strong><br>
f(r₁, r₂, …, rₙ, t) = 0<br>
→ 只限制位置，可用代数方程表示<br>
→ 例如：刚杆连接、铰链约束、曲面约束
</div>

<div class="formula-block">
<strong>非完整约束（Nonholonomic）：</strong><br>
→ 限制速度且不可积分成位置约束<br>
→ 例如：纯滚动条件（v = ωR可积分，是完整约束）<br>
→ 例如：冰刀问题（只能沿刃口方向运动）
</div>

<strong>其他分类方式：</strong><br>
• 定常/非定常约束（是否显含时间t）<br>
• 单面/双面约束（不等式/等式）<br>
• 理想/非理想约束（约束力虚功是否为零）

<strong>为什么重要：</strong>拉格朗日方程仅适用于完整约束系统。非完整约束需要用修正的拉格朗日乘子法或Appell方程。`
  },
  '应力与应变': {
    category: '材料力学',
    answer: `<strong>应力与应变（Stress & Strain）：</strong>

<div class="formula-block">
<strong>正应力：</strong>$\sigma = F_N / A$（单位：$\text{Pa} = \text{N/m}^2$）<br>
<strong>切应力：</strong>$\tau = F_S / A$<br>
<strong>正应变：</strong>$\varepsilon = \Delta L / L$（无量纲）<br>
<strong>切应变：</strong>$\gamma$（角度变化，单位：rad）
</div>

<strong>胡克定律（Hooke's Law）：</strong><br>
• 单向：$\sigma = E\varepsilon$（E为弹性模量）<br>
• 剪切：$\tau = G\gamma$（G为剪切模量）<br>
• $G = \dfrac{E}{2(1+\nu)}$（ν为泊松比）

<strong>应力-应变曲线：</strong>弹性阶段 → 屈服阶段 → 强化阶段 → 颈缩阶段 → 断裂<br>
<strong>常见材料常数：</strong>钢 $E\approx200\text{GPa},\ \nu\approx0.3$；铝合金 $E\approx70\text{GPa},\ \nu\approx0.33$`
  },
  '拉伸与压缩': {
    category: '材料力学',
    answer: `<strong>轴向拉伸与压缩：</strong>

<div class="formula-block">
<strong>基本公式：</strong><br>
$\sigma = F_N/A,\quad \varepsilon = \Delta L/L,\quad \Delta L = \dfrac{F_N L}{EA}$<br>
强度条件：$\sigma_{\max} \leq [\sigma] = \sigma_s / n_s$
</div>

<strong>圣维南原理：</strong>远离载荷作用点的区域，应力分布仅与合力有关，与加载方式无关。

<strong>静不定拉压问题：</strong>由平衡方程 + 变形协调条件 + 物理方程（胡克定律）联立求解。

<strong>温度应力：</strong>当热膨胀被约束时 → σ = EαΔT<br>
（α为线膨胀系数）

<strong>应力集中：</strong>截面突变处应力显著增大，用应力集中因数 $K$ 描述：$\sigma_{\max} = K\sigma_{\text{nom}}$`
  },
  '扭转': {
    category: '材料力学',
    answer: `<strong>圆轴扭转（Torsion）：</strong>

<div class="formula-block">
<strong>基本公式：</strong><br>
$\tau_{\max} = \dfrac{T \cdot R}{J_p} = \dfrac{T}{W_t}$<br>
扭转角：$\varphi = \dfrac{TL}{GJ_p}$<br>
$J_p = \dfrac{\pi D^4}{32}$（实心圆截面极惯性矩）<br>
$W_t = \dfrac{\pi D^3}{16}$（抗扭截面系数）
</div>

<strong>强度条件：</strong>$\tau_{\max} \leq [\tau]$<br>
<strong>刚度条件：</strong>$\theta = \dfrac{T}{GJ_p} \leq [\theta]$（单位长度扭转角）

<strong>空心圆截面：</strong>$J_p = \dfrac{\pi(D^4-d^4)}{32},\ \alpha = d/D$<br>
空心截面更有效（相同重量下抗扭能力更强）

<strong>非圆截面：</strong>矩形截面杆扭转有翘曲效应，需用薄膜比拟法分析。`
  },
  '弯曲应力': {
    category: '材料力学',
    answer: `<strong>弯曲正应力与切应力：</strong>

<div class="formula-block">
<strong>正应力（纯弯曲）：</strong>$\sigma = \dfrac{M \cdot y}{I_z}$<br>
$\sigma_{\max} = \dfrac{M}{W_z}$（发生在距中性轴最远处）<br>
$W_z = I_z / y_{\max}$（抗弯截面系数）
</div>

<strong>中性轴：</strong>过截面形心，正应力为零的轴线。

<div class="formula-block">
<strong>切应力（矩形截面梁）：</strong><br>
$\tau = \dfrac{F_S \cdot S_z^*}{I_z \cdot b}$<br>
$\tau_{\max} = \dfrac{3F_S}{2A}$（在中性轴处）
</div>

<strong>常见截面 $W_z$：</strong><br>
• 矩形：$\dfrac{bh^2}{6}$<br>
• 圆形：$\dfrac{\pi D^3}{32}$<br>
• 工字形/箱形：$\approx$ 翼缘面积 $\times$ 腹板高度（有效利用材料）

<strong>强度条件：</strong>$\sigma_{\max} \leq [\sigma],\ \tau_{\max} \leq [\tau]$<br>
<strong>注意：</strong>最大正应力和最大切应力通常不在同一位置。`
  },
  '弯曲变形': {
    category: '材料力学',
    answer: `<strong>弯曲变形（挠度与转角）：</strong>

<div class="formula-block">
<strong>挠曲线近似微分方程：</strong><br>
$EIw'' = -M(x)$<br>
w：挠度（向下为正），$\theta \approx w'$：转角
</div>

<strong>求变形的方法：</strong><br>
① <strong>积分法</strong>：积分弯矩方程求挠度，由边界条件定积分常数<br>
② <strong>叠加法</strong>：将复杂载荷分解为简单载荷的叠加<br>
③ <strong>单位载荷法（莫尔积分）</strong>：$\delta = \displaystyle\int \dfrac{M\bar{M}}{EI}dx$<br>
④ <strong>图乘法</strong>：M图和$\bar{M}$图相乘除以EI

<strong>常见挠度公式（悬臂梁，自由端受集中力F）：</strong><br>
$w_{\max} = \dfrac{FL^3}{3EI},\quad \theta_{\max} = \dfrac{FL^2}{2EI}$

<strong>刚度条件：</strong>$w_{\max} \leq [w],\ \theta_{\max} \leq [\theta]$`
  },
  '组合变形': {
    category: '材料力学',
    answer: `<strong>组合变形（Combined Loading）：</strong>

<strong>叠加原理：</strong>在小变形、线弹性条件下，组合变形的应力=各基本变形应力之和。

<strong>常见组合变形类型：</strong><br>
① <strong>斜弯曲</strong>：两主惯性轴方向都有弯矩<br>
② <strong>拉（压）弯组合</strong>：$\sigma = \dfrac{F_N}{A} \pm \dfrac{M_y z}{I_y} \pm \dfrac{M_z y}{I_z}$<br>
③ <strong>弯扭组合</strong>：弯曲正应力 + 扭转切应力<br>
④ <strong>偏心压缩</strong>：产生附加弯矩

<div class="formula-block warning">
<strong>强度理论（用于弯扭组合）：</strong><br>
第三强度理论：$\sigma_{r3} = \sqrt{\sigma^2 + 4\tau^2} \leq [\sigma]$<br>
第四强度理论：$\sigma_{r4} = \sqrt{\sigma^2 + 3\tau^2} \leq [\sigma]$
</div>`
  },
  '压杆稳定': {
    category: '材料力学',
    answer: `<strong>压杆稳定（Buckling）：</strong>

<div class="formula-block">
<strong>欧拉公式：</strong>$F_{cr} = \dfrac{\pi^2 EI}{(\mu L)^2}$<br>
μ：长度因数（与约束有关）<br>
• 两端铰支：$\mu = 1$<br>
• 一端固定一端自由：$\mu = 2$<br>
• 两端固定：$\mu = 0.5$<br>
• 一端固定一端铰支：$\mu \approx 0.7$
</div>

<strong>临界应力：</strong>$\sigma_{cr} = \dfrac{\pi^2 E}{\lambda^2}$（$\lambda = \mu L / i$ 为长细比）

<strong>适用范围：</strong><br>
• 大柔度杆（$\lambda \geq \lambda_p$）：欧拉公式<br>
• 中柔度杆（$\lambda_s \leq \lambda < \lambda_p$）：直线公式 $\sigma_{cr} = a - b\lambda$<br>
• 小柔度杆（$\lambda < \lambda_s$）：强度问题

<strong>提高稳定性的措施：</strong>增大截面惯性矩、缩短杆长、改变约束条件、选用高弹性模量材料。`
  },
  '牛顿定律': {
    category: '动力学',
    answer: `<strong>牛顿运动定律（Newton's Laws）：</strong>

<div class="formula-block">
<strong>第一定律（惯性定律）：</strong>不受力的质点保持静止或匀速直线运动。<br>
<strong>第二定律：</strong>$\boldsymbol{F} = m\boldsymbol{a}$（动量形式：$\boldsymbol{F} = \dfrac{d\boldsymbol{p}}{dt}$）<br>
<strong>第三定律：</strong>$\boldsymbol{F}_{12} = -\boldsymbol{F}_{21}$（作用力与反作用力）
</div>

<strong>适用条件：</strong>惯性参考系（牛顿定律成立的参考系）。在非惯性系中需引入牵连惯性力和科氏惯性力。

<strong>质点的两类问题：</strong><br>
① 已知运动求力（微分问题，直接）<br>
② 已知力求运动（积分问题，需初始条件）

<strong>局限性：</strong>不适用于微观粒子（需量子力学）、高速运动（需相对论力学）。`
  },
  '功与能': {
    category: '动力学',
    answer: `<strong>功与能的基本概念：</strong>

<div class="formula-block">
<strong>功：</strong>$W = \displaystyle\int \boldsymbol{F} \cdot d\boldsymbol{r} = \int F\cos\theta \, ds$<br>
<strong>势能：</strong>$V = -\displaystyle\int \boldsymbol{F} \cdot d\boldsymbol{r}$（保守力的功等于势能降）<br>
<strong>机械能：</strong>$E = T + V$
</div>

<strong>机械能守恒定律：</strong><br>
只有保守力做功 → $T + V = \text{常量}$<br>
若存在非保守力 → $T_2 + V_2 = T_1 + V_1 + W_{\text{非保守}}$

<strong>保守力的判定：</strong>做功与路径无关，或 $\nabla \times \boldsymbol{F} = \boldsymbol{0}$，或存在势函数 $V$ 使 $\boldsymbol{F} = -\nabla V$。<br>
重力、弹性力、万有引力是保守力；摩擦力、空气阻力是非保守力。`
  },
  '振动基础': {
    category: '动力学',
    answer: `<strong>机械振动基础：</strong>

<div class="formula-block">
<strong>无阻尼自由振动：</strong><br>
$m\ddot{x} + kx = 0$<br>
$\omega_n = \sqrt{k/m}$（固有频率）<br>
$T = \dfrac{2\pi}{\omega_n} = 2\pi\sqrt{m/k}$（周期）
</div>

<strong>有阻尼自由振动：</strong>$m\ddot{x} + c\dot{x} + kx = 0$<br>
阻尼比 $\zeta = \dfrac{c}{2\sqrt{mk}} = \dfrac{c}{2m\omega_n}$<br>
• $\zeta < 1$：欠阻尼（振荡衰减）<br>
• $\zeta = 1$：临界阻尼<br>
• $\zeta > 1$：过阻尼（不振荡）

<strong>受迫振动：</strong>$m\ddot{x} + c\dot{x} + kx = F_0\sin(\omega t)$<br>
• 稳态响应频率 = 激励频率 $\omega$<br>
• 共振条件：$\omega \approx \omega_n$（振幅极大）<br>
• 共振时稳态振幅 $\approx \dfrac{X_0}{2\zeta}$（$X_0$为等效静位移）`
  },
  '自由度': {
    category: '分析力学',
    answer: `<strong>自由度（Degrees of Freedom, DOF）：</strong>

<strong>定义：</strong>确定一个力学系统位形所需的<strong>独立坐标数</strong>。

<div class="formula-block">
<strong>完整约束系统：</strong>DOF = 3n - s<br>
n = 质点数，s = 完整约束方程数<br>
<strong>刚体（空间）：</strong>6 DOF（3平动+3转动）<br>
<strong>刚体（平面）：</strong>3 DOF（2平动+1转动）
</div>

<strong>常见机构的自由度：</strong><br>
• 四杆机构：1 DOF<br>
• 曲柄滑块：1 DOF<br>
• 差动轮系：2 DOF<br>
• 陀螺：3 DOF<br>
• 双摆：2 DOF

<strong>工程意义：</strong>自由度数 = 需要的驱动数 = 拉格朗日方程数。`
  },
  '解题技巧': {
    category: '方法论',
    answer: `<strong>理论力学综合解题策略：</strong>

<strong>📋 通用解题流程：</strong><br>
1️⃣ <strong>审题</strong>：明确已知条件（几何参数、载荷、运动状态）和求解目标<br>
2️⃣ <strong>选研究对象</strong>：整体还是分离体？<br>
3️⃣ <strong>画受力图/运动图</strong>：完整标注<br>
4️⃣ <strong>选择方法</strong>：静力平衡 / 运动合成 / 三大定理 / 拉格朗日方程<br>
5️⃣ <strong>列方程</strong>：注意方程独立性<br>
6️⃣ <strong>求解</strong>：先符号后数值，注意量纲<br>
7️⃣ <strong>验证</strong>：量纲检查、极端情况检验

<strong>🎯 方法选择口诀：</strong><br>
• 求速度 → 动能定理 / 速度瞬心法<br>
• 求加速度 → 基点法 / 加速度合成<br>
• 求约束反力 → 动量/动量矩定理 / 达朗贝尔原理<br>
• 求平衡位置 → 虚位移原理<br>
• 多自由度系统 → 拉格朗日方程<br>
• 碰撞/冲击 → 动量定理 + 恢复因数`
  },
};

// ==================== 扩展知识库：力系简化与平衡 ====================
knowledgeBase['力系简化'] = { category: '静力学', answer: `<strong>力系简化（Reduction of Force System）：</strong><div class="formula-block"><strong>力系简化的核心思想：</strong>将复杂力系向一点简化，得到一个<strong>主矢</strong>和一个<strong>主矩</strong>。<br>主矢：$\boldsymbol{R} = \sum \boldsymbol{F}_i$（与简化中心无关）<br>主矩：$\boldsymbol{M}_O = \sum \boldsymbol{r}_i \times \boldsymbol{F}_i$（与简化中心有关）</div><strong>简化结果分类：</strong><br>① $\boldsymbol{R}=0,\ \boldsymbol{M}_O=0$ → 力系平衡<br>② $\boldsymbol{R}=0,\ \boldsymbol{M}_O \neq 0$ → 合力偶<br>③ $\boldsymbol{R} \neq 0,\ \boldsymbol{M}_O=0$ → 合力过简化中心<br>④ $\boldsymbol{R} \neq 0,\ \boldsymbol{M}_O \neq 0$ → 需进一步简化<br><strong>工程意义：</strong>力系简化是分析结构受力、设计支座反力的基础。` };
knowledgeBase['汇交力系'] = { category: '静力学', answer: `<strong>汇交力系（Concurrent Force System）：</strong><strong>定义：</strong>各力作用线汇交于一点的力系。<div class="formula-block"><strong>平面汇交力系平衡：</strong>$\sum F_x = 0,\quad \sum F_y = 0$（2个独立方程）<br><strong>空间汇交力系平衡：</strong>$\sum F_x = 0,\ \sum F_y = 0,\ \sum F_z = 0$（3个独立方程）</div><strong>解法：</strong>几何法（力多边形封闭）或解析法（坐标投影）。<br><strong>典型应用：</strong>三力汇交平衡问题、绳索节点分析、滑轮组受力。` };
knowledgeBase['力偶系'] = { category: '静力学', answer: `<strong>力偶系（Couple System）：</strong><strong>力偶的性质：</strong><br>• 力偶不能简化为一个力（无合力）<br>• 力偶对任意点的矩相等（力偶矩是自由矢量）<br>• 力偶只能用力偶来平衡<div class="formula-block"><strong>力偶矩：</strong>$M = F \cdot d$<br><strong>平面力偶系平衡：</strong>$\sum M_i = 0$（1个独立方程）</div><strong>等效条件：</strong>力偶矩大小相等、转向相同、作用面平行。` };
knowledgeBase['平面任意力系'] = { category: '静力学', answer: `<strong>平面任意力系（General Planar Force System）：</strong><strong>定义：</strong>各力作用线在同一平面内但任意分布的力系。<div class="formula-block"><strong>平衡方程（一矩式）：</strong><br>$\sum F_x = 0,\quad \sum F_y = 0,\quad \sum M_A = 0$<br>→ 3个独立方程，最多求解3个未知量</div><strong>求解技巧：</strong>矩心选在未知力汇交点 → 减少联立方程；灵活使用二矩式/三矩式。<br><strong>工程应用：</strong>梁的支座反力、刚架受力分析、机构平衡。` };
knowledgeBase['摩擦与自锁'] = { category: '静力学', answer: `<strong>摩擦与自锁（Friction & Self-Locking）深入分析：</strong><div class="formula-block"><strong>摩擦角：</strong>$\varphi_m = \arctan(\mu_s)$<br>全反力 $\boldsymbol{R} = \boldsymbol{N} + \boldsymbol{F}_s$，与法线夹角 $\leq \varphi_m$</div><strong>自锁条件：</strong>主动力合力作用线在摩擦锥内 → 无论主动力多大，物体保持静止。<br><strong>工程实例：</strong>螺纹自锁（$\alpha < \varphi_m$）、楔块夹紧、千斤顶、摩擦离合器。` };
knowledgeBase['桁架节点法'] = { category: '静力学', answer: `<strong>桁架节点法（Method of Joints）详解：</strong><strong>基本原理：</strong>逐节点分析，每个节点受汇交力系，可列2个平衡方程。<strong>解题步骤：</strong><br>1. 求支座反力（整体平衡）<br>2. 从只有2个未知量的节点开始<br>3. 依次求解相邻节点（每次最多2个未知量）<br>4. 标注各杆内力（拉力为正，压力为负）<strong>零力杆快速判断：</strong>两杆节点无外力→两杆为零力杆；三杆节点两杆共线无外力→第三杆为零力杆。` };
knowledgeBase['桁架截面法'] = { category: '静力学', answer: `<strong>桁架截面法（Method of Sections）详解：</strong><strong>基本原理：</strong>用一个截面切断桁架，取其中一部分为研究对象。<div class="formula-block"><strong>关键限制：</strong>截断的未知内力杆 ≤ 3根</div><strong>解题技巧：</strong>选择恰当的矩心使未知力通过矩心；截面不过节点；可与节点法联合使用。<br><strong>适用场景：</strong>只需特定杆内力时使用，比节点法更高效。` };
knowledgeBase['分布载荷'] = { category: '静力学', answer: `<strong>分布载荷（Distributed Load）：</strong><div class="formula-block"><strong>等效合力：</strong>分布载荷的合力 = 载荷图的面积<br><strong>作用位置：</strong>过载荷图的形心<br>• 均布载荷：$R = qL$，作用在中点<br>• 三角形载荷：$R = \frac{1}{2}q_0L$，作用在距大头 $\frac{L}{3}$ 处<br>• 梯形载荷：可分解为均布+三角形</div><strong>应用：</strong>水压力（三角形分布）、土压力、风载荷、雪载荷等。` };
// ==================== 扩展知识库：运动学与动力学 ====================
knowledgeBase['点的运动学'] = { category: '运动学', answer: `<strong>点的运动描述方法：</strong><div class="formula-block"><strong>矢量法：</strong>$\boldsymbol{r} = \boldsymbol{r}(t)$，速度 $\boldsymbol{v} = \dot{\boldsymbol{r}}$，加速度 $\boldsymbol{a} = \ddot{\boldsymbol{r}}$</div><strong>直角坐标法：</strong>$x=x(t),\ y=y(t),\ z=z(t)$，各分量分别求导。<br><strong>自然坐标法（弧坐标）：</strong><br>切向加速度：$a_t = \dot{v} = \ddot{s}$（速度大小变化）<br>法向加速度：$a_n = \dfrac{v^2}{\rho}$（方向变化，$\rho$为曲率半径）<br><strong>选择原则：</strong>轨迹已知→自然法；轨迹未知→直角坐标法。` };
knowledgeBase['刚体基本运动'] = { category: '运动学', answer: `<strong>刚体的基本运动——平动与定轴转动：</strong><strong>1. 平动（Translation）：</strong>刚体上各点轨迹相同，速度/加速度完全相同，简化为点的运动。<br><strong>2. 定轴转动（Rotation）：</strong><br><div class="formula-block">$v = \omega R$<br>$a_t = \alpha R$（切向），$a_n = \omega^2 R$（法向）</div>各点速度和加速度大小与转动半径成正比。` };
knowledgeBase['速度合成'] = { category: '运动学', answer: `<strong>速度合成定理详解：</strong><div class="formula-block"><strong>核心公式：</strong>$\boldsymbol{v}_a = \boldsymbol{v}_e + \boldsymbol{v}_r$<br>绝对速度 = 牵连速度 + 相对速度</div><strong>动点-动系选择三原则：</strong><br>① 动点与动系不在同一物体上<br>② 相对运动轨迹简单（直线或圆）<br>③ 动系运动规律已知<br><strong>典型应用：</strong>滑块在转动构件上滑动、凸轮机构、曲柄滑块机构。` };
knowledgeBase['加速度合成'] = { category: '运动学', answer: `<strong>加速度合成定理：</strong><div class="formula-block"><strong>完整公式：</strong>$\boldsymbol{a}_a = \boldsymbol{a}_e + \boldsymbol{a}_r + \boldsymbol{a}_C$<br>科氏加速度：$\boldsymbol{a}_C = 2\boldsymbol{\omega}_e \times \boldsymbol{v}_r$，大小 $a_C = 2\omega_e v_r \sin\theta$</div><strong>特殊情形：</strong>动系平动或动点相对静止或 $\boldsymbol{\omega}_e \parallel \boldsymbol{v}_r$ → 科氏加速度为零。<br><strong>常见错误：</strong>忘记科氏加速度、科氏加速度方向判断错误。` };
knowledgeBase['平面运动速度'] = { category: '运动学', answer: `<strong>刚体平面运动速度分析的三种方法：</strong><br><strong>1. 基点法：</strong>$\boldsymbol{v}_B = \boldsymbol{v}_A + \boldsymbol{\omega} \times \boldsymbol{r}_{AB}$<br><strong>2. 速度投影定理：</strong>两点在连线方向的速度投影相等<br><strong>3. 速度瞬心法：</strong>找到瞬心I → $v_P = \omega \cdot IP$，方向 $\perp IP$<br><strong>选择策略：</strong>已知一点速度+角速度→基点法；知两点速度方向→瞬心法；复杂机构→瞬心法最简便。` };
knowledgeBase['平面运动加速度'] = { category: '运动学', answer: `<strong>刚体平面运动加速度分析：</strong><div class="formula-block"><strong>基点法：</strong>$\boldsymbol{a}_B = \boldsymbol{a}_A + \boldsymbol{a}_{BA}^t + \boldsymbol{a}_{BA}^n$<br>切向：$a_{BA}^t = \alpha \cdot AB$（$\perp AB$）<br>法向：$a_{BA}^n = \omega^2 \cdot AB$（B→A）</div><strong>解题要点：</strong>先做速度分析求$\omega$，再做加速度分析求$\alpha$——不可颠倒！<br><strong>注意：</strong>加速度没有投影定理。` };
knowledgeBase['机构运动分析'] = { category: '运动学', answer: `<strong>机构运动学综合分析：</strong><br><strong>常见机构及分析方法：</strong><br>① 四杆机构：瞬心法+基点法结合<br>② 曲柄滑块：滑块平动+连杆平面运动<br>③ 导杆机构：点的合成运动（动系固连于导杆）<br>④ 凸轮机构：点的合成运动（动系固连于凸轮）<br>⑤ 行星轮系：注意公转与自转的合成<br><strong>分析步骤：</strong>结构认知→运动传递路径→逐构件分析→联立求解。` };
knowledgeBase['质点动力学'] = { category: '动力学', answer: `<strong>质点动力学基本方程：</strong><div class="formula-block">$\boldsymbol{F} = m\boldsymbol{a}$<br>直角坐标：$\ddot{x}=F_x/m,\ \ddot{y}=F_y/m,\ \ddot{z}=F_z/m$<br>自然坐标：$m\ddot{s}=F_t,\ m\dfrac{\dot{s}^2}{\rho}=F_n$</div><strong>两类问题：</strong>① 已知运动求力（微分）→ 直接求导；② 已知力求运动（积分）→ 需初始条件。` };
knowledgeBase['质心运动定理'] = { category: '动力学', answer: `<strong>质心运动定理：</strong><div class="formula-block">$\boldsymbol{p} = M\boldsymbol{v}_C$（质点系动量=总质量×质心速度）<br>$M\boldsymbol{a}_C = \sum \boldsymbol{F}^{(e)}$（质心运动定理）</div><strong>物理意义：</strong>内力不影响质心运动！质点系质心运动等同于一个受所有外力作用的质点。<br><strong>应用：</strong>求约束反力、碰撞问题、流体在弯管中的动压力。` };
knowledgeBase['转动微分方程'] = { category: '动力学', answer: `<strong>刚体定轴转动微分方程：</strong><div class="formula-block">$J_O \alpha = \sum M_O^{(e)}$（转动惯量×角加速度=外力矩之和）</div><strong>物理意义：</strong>牛顿第二定律的转动版本——力矩使刚体产生角加速度。<br><strong>应用步骤：</strong>分析外力矩→计算转动惯量→代入方程求$\alpha$→积分求$\omega$和$\theta$。` };
knowledgeBase['机械能守恒'] = { category: '动力学', answer: `<strong>机械能守恒定律：</strong><div class="formula-block"><strong>守恒条件：</strong>只有保守力做功 → $T + V = \text{常量}$<br>若存在非保守力：$\Delta(T+V) = W_{\text{非保守}}$</div><strong>应用优势：</strong>标量方程，避免矢量分解，特别适合求速度/角速度问题。<br><strong>典型应用：</strong>摆的摆动、弹簧振子、轨道滑行、滑轮系统。` };
knowledgeBase['动静法'] = { category: '动力学', answer: `<strong>动静法（达朗贝尔原理应用）：</strong><strong>核心步骤：</strong><br>① 附加惯性力（主矢 $-M\boldsymbol{a}_C$ + 主矩 $-J_C\alpha$）<br>② 将系统视为形式上的平衡<br>③ 列静力平衡方程求解<br><strong>优势：</strong>将动力学问题转化为静力学问题，特别适合求约束反力和轴承反力分析。` };
knowledgeBase['虚功方程'] = { category: '分析力学', answer: `<strong>虚功方程的应用：</strong><div class="formula-block">$\sum \boldsymbol{F}_i \cdot \delta\boldsymbol{r}_i = 0$（虚功之和为零）</div><strong>应用技巧：</strong>解除待求约束→代之以约束反力作为"主动力"→给虚位移→列虚功方程求解。<br><strong>典型问题：</strong>机构平衡位置、力传递关系、约束反力求解。` };
knowledgeBase['拉格朗日方法'] = { category: '分析力学', answer: `<strong>拉格朗日方法（Lagrangian Mechanics）：</strong><strong>基本框架：</strong><br>① 确定自由度$k$，选择广义坐标$q_j$<br>② 写出动能$T$和势能$V$，构建$L = T - V$<br>③ 代入 $\dfrac{d}{dt}\left(\dfrac{\partial L}{\partial \dot{q}_j}\right) - \dfrac{\partial L}{\partial q_j} = Q_j$<br><strong>优势：</strong>不需考虑理想约束反力，方程数=自由度数，特别适合多自由度复杂系统。` };
knowledgeBase['单自由度振动'] = { category: '动力学', answer: `<strong>单自由度系统的振动：</strong><div class="formula-block">$m\ddot{x} + c\dot{x} + kx = F(t)$<br>固有频率：$\omega_n = \sqrt{k/m}$，阻尼比：$\zeta = c/(2\sqrt{mk})$</div><strong>自由振动：</strong>无阻尼→等幅简谐振动；欠阻尼→衰减振荡；临界阻尼→最快回位；过阻尼→无振荡缓慢回位。<br><strong>受迫振动：</strong>稳态响应频率=激励频率；共振时振幅急剧增大。` };
knowledgeBase['碰撞方程'] = { category: '动力学', answer: `<strong>碰撞问题的基本方程：</strong><div class="formula-block">动量守恒：$m_1v_1 + m_2v_2 = m_1v_1' + m_2v_2'$<br>恢复因数：$e = \dfrac{v_2' - v_1'}{v_1 - v_2}$</div><strong>动能损失：</strong>$\Delta T = \dfrac{1}{2}(1-e^2)\dfrac{m_1m_2}{m_1+m_2}(v_1-v_2)^2$<br>• $e=1$完全弹性→$\Delta T=0$；$e=0$完全塑性→$\Delta T$最大。` };
knowledgeBase['轴向拉压'] = { category: '材料力学', answer: `<strong>轴向拉伸与压缩（深入）：</strong><div class="formula-block">正应力：$\sigma = F_N/A$<br>轴向变形：$\Delta L = \dfrac{F_N L}{EA}$<br>横向变形：$\varepsilon' = -\nu\varepsilon$</div><strong>圣维南原理：</strong>远离载荷作用点，应力分布均匀且仅与合力有关。<br><strong>工程应用：</strong>螺栓连接、拉索、柱的受压分析、预应力构件。` };
knowledgeBase['弯扭强度'] = { category: '材料力学', answer: `<strong>弯曲与扭转强度计算：</strong><strong>弯曲正应力：</strong>$\sigma = \dfrac{M y}{I}$，$\sigma_{\max} = \dfrac{M}{W}$<br><strong>扭转切应力：</strong>$\tau = \dfrac{T \rho}{J_p}$，$\tau_{\max} = \dfrac{T}{W_t}$<div class="formula-block"><strong>弯扭组合——强度理论：</strong><br>第三强度理论：$\sigma_{r3} = \sqrt{\sigma^2 + 4\tau^2} \leq [\sigma]$<br>第四强度理论：$\sigma_{r4} = \sqrt{\sigma^2 + 3\tau^2} \leq [\sigma]$</div>` };
knowledgeBase['压杆屈曲'] = { category: '材料力学', answer: `<strong>压杆屈曲（Buckling）深入分析：</strong><div class="formula-block"><strong>欧拉临界力：</strong>$F_{cr} = \dfrac{\pi^2 EI}{(\mu L)^2}$<br>临界应力：$\sigma_{cr} = \dfrac{\pi^2 E}{\lambda^2}$（$\lambda = \mu L/i$为长细比）</div><strong>三类压杆：</strong>大柔度→欧拉公式；中柔度→经验公式；小柔度→强度问题。<br><strong>提高稳定性：</strong>缩短杆长、加强约束、增大截面惯性矩、选用高E材料。` };
knowledgeBase['练习题库'] = { category: '方法论', answer: `<strong>📝 理论力学练习题库：</strong><br><br>系统内置了覆盖各知识模块的练习题目，每道题均配有示意图。<br><br><strong>练习题目分布（按模块）：</strong><br>• 模块32（汇交力系）：第1题、第3题<br>• 模块33（力偶系）：第3题<br>• 模块34（平面任意力系简化）：第1题、第3题<br>• 模块35（平面任意力系平衡）：第2题、第3题<br>• 模块37（空间力系平衡）：第3题<br>• 模块38（滑动摩擦）：第2题、第3题<br>• 模块39（摩擦平衡问题）：第3题<br>• 模块40（滚动摩阻）：第2题、第3题<br>• 模块42（桁架截面法）：第3题<br>• 模块43（重心与分布载荷）：第3题<br><br>💡 点击下方"练习题目"快捷按钮可查看题目图和解答。` };
knowledgeBase['延展阅读'] = { category: '方法论', answer: `<strong>📖 延展阅读材料（Late Extension）：</strong><br><br>延展阅读包含6个拓展页面（延展7-12），适合有一定基础后深入学习：<br>• 力学发展史中的经典问题<br>• 工程案例分析<br>• 力学的数学工具补充<br>• 现代力学前沿简介<br><br>💡 点击下方"延展材料"快捷按钮可查看各延展页面。` };
knowledgeBase['补充材料'] = { category: '方法论', answer: `<strong>📋 补充材料（Supplementary Materials）：</strong><br><br>补充材料包含6个专题页面（补充1-6），涵盖：<br>• 常见公式速查表<br>• 单位换算与量纲分析<br>• 常见截面的几何性质（面积、形心、惯性矩）<br>• 常用材料的力学性能参数<br>• 典型机构运动简图集<br>• 符号表与术语对照<br><br>💡 点击下方"补充材料"快捷按钮可查看各补充页面。` };

// ==================== 跨领域知识关联图谱 ====================
const relatedTopics = {
  '速度瞬心': [{ key: '刚体平面运动', reason: '瞬心是平面运动速度分析的核心方法' },{ key: '点的合成运动', reason: '两者均用于速度分析，可互为补充' },{ key: '科氏加速度', reason: '动系转动时瞬心法需结合科氏加速度' },{ key: '动能定理', reason: '求速度后可结合动能定理求角速度' }],
  '受力图': [{ key: '平衡方程', reason: '受力图是列平衡方程的前提' },{ key: '二力杆', reason: '识别二力杆可简化受力图' },{ key: '桁架', reason: '桁架分析依赖正确的节点受力图' },{ key: '虚位移原理', reason: '两者均涉及约束反力的处理方式' }],
  '平衡方程': [{ key: '受力图', reason: '先画受力图再列平衡方程' },{ key: '虚位移原理', reason: '虚功法是平衡问题的另一种解法' },{ key: '拉格朗日方程', reason: '拉格朗日方程是平衡方程的推广' },{ key: '桁架', reason: '截面法/节点法本质是平衡方程的应用' },{ key: '空间力系', reason: '空间力系是平面平衡方程的三维推广' }],
  '二力杆': [{ key: '受力图', reason: '判断二力杆可大幅简化受力分析' },{ key: '桁架', reason: '桁架各杆均为二力杆' },{ key: '平衡方程', reason: '二力杆是平衡问题中的关键简化' }],
  '摩擦力': [{ key: '功与能', reason: '摩擦力做功导致机械能损失' },{ key: '动能定理', reason: '动能定理中需计入摩擦力的负功' },{ key: '功率与效率', reason: '摩擦损耗决定机械效率上限' },{ key: '虚功原理应用', reason: '有摩擦时需将摩擦力作为主动力处理' }],
  '空间力系': [{ key: '平衡方程', reason: '空间力系是平面平衡的三维推广' },{ key: '重心与形心', reason: '重心坐标由空间平行力系合成' },{ key: '转动惯量', reason: '空间力系中的力对轴之矩需转动惯量' }],
  '桁架': [{ key: '二力杆', reason: '桁架分析的每一根杆都是二力杆' },{ key: '平衡方程', reason: '节点法和截面法均基于平衡方程' },{ key: '受力图', reason: '正确的受力图是桁架分析的前提' },{ key: '应力与应变', reason: '桁架内力→应力→变形计算链' }],
  '重心与形心': [{ key: '转动惯量', reason: '平行轴定理需要质心位置信息' },{ key: '弯曲应力', reason: '弯曲中性轴过截面形心' },{ key: '空间力系', reason: '重心是空间平行力系的合力中心' }],
  '科氏加速度': [{ key: '点的合成运动', reason: '科氏加速度是加速度合成定理的核心项' },{ key: '相对运动', reason: '动系转动时相对运动产生科氏加速度' },{ key: '速度瞬心', reason: '瞬心随时间移动涉及科氏效应' },{ key: '刚体定点转动', reason: '陀螺进动涉及科氏加速度的宏观表现' }],
  '点的合成运动': [{ key: '科氏加速度', reason: '合成运动加速度分析必须包含科氏项' },{ key: '相对运动', reason: '点的合成运动=相对+牵连的核心框架' },{ key: '刚体平面运动', reason: '基点法是合成运动在刚体上的应用' },{ key: '速度瞬心', reason: '瞬心可用合成运动观点理解' }],
  '刚体平面运动': [{ key: '速度瞬心', reason: '瞬心法是最简便的平面运动速度解法' },{ key: '点的合成运动', reason: '基点法本质是点的合成运动' },{ key: '动能定理', reason: '平面运动动能=平动+转动两部分' },{ key: '转动惯量', reason: '平面运动转动部分需转动惯量' }],
  '刚体定点转动': [{ key: '转动惯量', reason: '刚体定点转动涉及惯性张量' },{ key: '动量矩定理', reason: '定点转动动力学用动量矩定理描述' },{ key: '科氏加速度', reason: '定点转动的加速度场包含向轴+切向分量' }],
  '相对运动': [{ key: '点的合成运动', reason: '相对运动是合成运动的子概念' },{ key: '科氏加速度', reason: '科氏加速度源于牵连+相对运动的耦合' },{ key: '牛顿定律', reason: '非惯性系需修正牛顿定律' }],
  '动能定理': [{ key: '动量定理', reason: '两大定理常联合求解动力学问题' },{ key: '动量矩定理', reason: '三大定理组成完整的动力学分析工具' },{ key: '功与能', reason: '动能定理是功和能概念的工程应用' },{ key: '拉格朗日方程', reason: '拉格朗日方程是动能定理的分析力学推广' },{ key: '功率与效率', reason: '功率方程是动能定理的时间导数形式' }],
  '动量定理': [{ key: '动能定理', reason: '动量定理求力，动能定理求速度' },{ key: '动量矩定理', reason: '动量定理(平动)+动量矩定理(转动)' },{ key: '碰撞理论', reason: '碰撞问题首选动量定理(碰撞力功难算)' },{ key: '牛顿定律', reason: '动量定理是牛顿第二定律的积分形式' }],
  '动量矩定理': [{ key: '转动惯量', reason: '动量矩定理涉及转动惯量(刚体)' },{ key: '动能定理', reason: '角速度用动能定理求，角加速度用动量矩定理' },{ key: '动量定理', reason: '平动方程+转动方程联合求解' },{ key: '刚体定点转动', reason: '定点转动的欧拉方程来自动量矩定理' }],
  '三大定理联合': [{ key: '动能定理', reason: '三大定理之一：标量方程求速度' },{ key: '动量定理', reason: '三大定理之一：矢量方程求外力' },{ key: '动量矩定理', reason: '三大定理之一：转动问题的核心' },{ key: '达朗贝尔原理', reason: '动静法将三大定理统一为平衡形式' }],
  '达朗贝尔原理': [{ key: '三大定理联合', reason: '动静法统一三大定理为平衡形式' },{ key: '虚位移原理', reason: '两者均将动力学问题形式化' },{ key: '牛顿定律', reason: '达朗贝尔原理是牛顿定律的形式变换' }],
  '碰撞理论': [{ key: '动量定理', reason: '碰撞问题主要依靠动量(矩)定理求解' },{ key: '动能定理', reason: '碰撞的动能损失用恢复因数计算' },{ key: '动量矩定理', reason: '偏心碰撞需用动量矩定理' }],
  '转动惯量': [{ key: '动量矩定理', reason: '转动惯量是旋转动力学的核心参数' },{ key: '重心与形心', reason: '平行轴定理连接质心和任意轴的转动惯量' },{ key: '扭转', reason: '极惯性矩J_p是抗扭截面的核心参数' },{ key: '弯曲应力', reason: '惯性矩I是抗弯截面的核心参数' }],
  '功率与效率': [{ key: '动能定理', reason: '功率方程是动能定理的微分形式' },{ key: '功与能', reason: '功率是功的时间变化率' },{ key: '摩擦力', reason: '摩擦是功率损耗的主要原因' }],
  '虚位移原理': [{ key: '平衡方程', reason: '虚位移原理是平衡问题的变分表述' },{ key: '拉格朗日方程', reason: '拉格朗日方程从虚功原理导出' },{ key: '虚功原理应用', reason: '工程应用实例与方法' },{ key: '完整约束与非完整约束', reason: '虚位移必须满足约束条件' }],
  '拉格朗日方程': [{ key: '虚位移原理', reason: '拉格朗日方程由虚功原理+达朗贝尔原理导出' },{ key: '哈密顿原理', reason: '拉格朗日方程也可从哈密顿变分原理导出' },{ key: '广义坐标', reason: '拉格朗日方程建立在广义坐标之上' },{ key: '动能定理', reason: '单自由度时拉格朗日方程等价于动能定理' },{ key: '自由度', reason: '方程数=自由度数，需先确定自由度' }],
  '哈密顿原理': [{ key: '拉格朗日方程', reason: '哈密顿原理→拉格朗日方程的变分推导' },{ key: '虚位移原理', reason: '哈密顿原理是虚功原理在时间域的推广' }],
  '广义坐标': [{ key: '拉格朗日方程', reason: '拉格朗日方程以广义坐标表达' },{ key: '自由度', reason: '广义坐标的个数=自由度数' },{ key: '完整约束与非完整约束', reason: '完整约束可用广义坐标自动满足' }],
  '虚功原理应用': [{ key: '虚位移原理', reason: '虚功原理应用即虚位移原理的工程实践' },{ key: '平衡方程', reason: '与传统平衡法互为补充' },{ key: '摩擦力', reason: '摩擦下的虚功分析需特殊处理' }],
  '完整约束与非完整约束': [{ key: '广义坐标', reason: '完整约束可减少广义坐标数' },{ key: '自由度', reason: '完整约束系统自由度=3n-s' },{ key: '拉格朗日方程', reason: '拉格朗日方程仅适用于完整约束系统' }],
  '应力与应变': [{ key: '拉伸与压缩', reason: '拉压问题的最基本应力-应变关系' },{ key: '弯曲应力', reason: '弯曲正应力公式基于胡克定律' },{ key: '扭转', reason: '扭转切应力基于剪切胡克定律' }],
  '拉伸与压缩': [{ key: '应力与应变', reason: '拉压是应力应变概念的直接应用' },{ key: '弯曲应力', reason: '弯曲可看作各层纤维的拉压' },{ key: '压杆稳定', reason: '受压杆件的稳定性分析' }],
  '扭转': [{ key: '弯曲应力', reason: '弯扭组合变形需联合分析' },{ key: '组合变形', reason: '弯扭组合是工程常见工况' },{ key: '转动惯量', reason: 'J_p极惯性矩与J_z惯性矩概念相通' }],
  '弯曲应力': [{ key: '弯曲变形', reason: '应力→应变→变形链' },{ key: '组合变形', reason: '斜弯曲、拉弯组合均涉及弯曲应力' },{ key: '应力与应变', reason: '弯曲正应力公式σ=My/I基于胡克定律' }],
  '弯曲变形': [{ key: '弯曲应力', reason: '变形(挠度)由应力分布→弯矩决定' },{ key: '组合变形', reason: '组合变形的挠度可用叠加原理' },{ key: '压杆稳定', reason: '压杆失稳弯曲与梁弯曲的数学形式相似' }],
  '组合变形': [{ key: '弯曲应力', reason: '组合变形的应力=各基本变形应力叠加' },{ key: '扭转', reason: '弯扭组合是最常见的组合变形' },{ key: '弯曲变形', reason: '叠加法求组合变形的总挠度' }],
  '压杆稳定': [{ key: '拉伸与压缩', reason: '压杆是受压构件，失稳是控制因素' },{ key: '弯曲变形', reason: '压杆失稳的挠曲线微分方程与梁相似' },{ key: '应力与应变', reason: '临界应力与长细比的关系' }],
  '牛顿定律': [{ key: '动量定理', reason: '动量定理是牛顿第二定律的积分/集合形式' },{ key: '达朗贝尔原理', reason: '动静法将牛顿定律改写为平衡形式' },{ key: '动能定理', reason: '动能定理是牛顿定律的能量积分' }],
  '功与能': [{ key: '动能定理', reason: '功和能的核心定理' },{ key: '功率与效率', reason: '功率=功/时间，效率=有用功/总功' },{ key: '摩擦力', reason: '摩擦力的功恒为负，导致能量损失' }],
  '振动基础': [{ key: '动能定理', reason: '振动系统的能量守恒(无阻尼时)' },{ key: '拉格朗日方程', reason: '多自由度振动系统用拉格朗日方程建模' },{ key: '自由度', reason: '振动系统的自由度=独立振动模态数' },{ key: '牛顿定律', reason: '振动微分方程来自牛顿第二定律' }],
  '自由度': [{ key: '广义坐标', reason: '自由度=所需广义坐标数' },{ key: '拉格朗日方程', reason: '一个自由度对应一个拉格朗日方程' },{ key: '完整约束与非完整约束', reason: '自由度=3n-完整约束数' },{ key: '振动基础', reason: '多自由度系统的振动模态分析' }],
  '解题技巧': [{ key: '三大定理联合', reason: '综合解题策略的核心' },{ key: '受力图', reason: '解题第一步：正确绘制受力图' },{ key: '点的合成运动', reason: '动点/动系选择的通用原则' },{ key: '拉格朗日方程', reason: '多自由度系统的最佳方法选择' }],
  '力系简化': [{ key: '平衡方程', reason: '简化后用力系平衡方程求解' },{ key: '空间力系', reason: '空间力系向一点简化的推广' },{ key: '平面任意力系', reason: '平面任意力系是力系简化的典型应用' }],
  '汇交力系': [{ key: '平衡方程', reason: '汇交力系用两个力方程即可求解' },{ key: '受力图', reason: '正确画受力图是汇交力系分析的前提' }],
  '平面任意力系': [{ key: '平衡方程', reason: '平面任意力系有三个平衡方程' },{ key: '力系简化', reason: '力系简化的核心案例' },{ key: '受力图', reason: '先画受力图再列方程' }],
  '摩擦与自锁': [{ key: '摩擦力', reason: '摩擦与自锁的基础概念' },{ key: '平衡方程', reason: '考虑摩擦的平衡问题' }],
  '桁架节点法': [{ key: '桁架', reason: '节点法是桁架分析的基本方法' },{ key: '桁架截面法', reason: '两种方法互补' },{ key: '汇交力系', reason: '每个节点是汇交力系平衡问题' }],
  '桁架截面法': [{ key: '桁架', reason: '截面法可直接求特定杆内力' },{ key: '桁架节点法', reason: '截面法与节点法互补' },{ key: '平面任意力系', reason: '截面法基于平面任意力系平衡' }],
  '速度合成': [{ key: '点的合成运动', reason: '速度合成是点的合成运动的核心' },{ key: '科氏加速度', reason: '速度合成→加速度合成的递进' }],
  '加速度合成': [{ key: '科氏加速度', reason: '科氏加速度是加速度合成的关键项' },{ key: '速度合成', reason: '加速度合成是速度合成的递进' },{ key: '点的合成运动', reason: '加速度合成定理的完整表述' }],
  '平面运动速度': [{ key: '刚体平面运动', reason: '瞬心法是最简便的平面运动速度解法' },{ key: '速度瞬心', reason: '速度瞬心是平面运动速度分析的核心' },{ key: '平面运动加速度', reason: '先速度分析再加速度分析的递进关系' }],
  '平面运动加速度': [{ key: '刚体平面运动', reason: '平面运动加速度分析的基点法' },{ key: '平面运动速度', reason: '必须先速度分析再加速度分析' }],
  '机构运动分析': [{ key: '刚体平面运动', reason: '多数机构构件作平面运动' },{ key: '点的合成运动', reason: '导杆、凸轮机构用合成运动法' },{ key: '速度瞬心', reason: '瞬心法在机构分析中广泛应用' }],
  '质点动力学': [{ key: '牛顿定律', reason: '质点动力学来自牛顿第二定律' },{ key: '质心运动定理', reason: '由质点动力学推广到质点系' }],
  '质心运动定理': [{ key: '动量定理', reason: '质心运动定理=动量定理的另一种形式' },{ key: '质点动力学', reason: '由质点动力学推广到质点系' }],
  '转动微分方程': [{ key: '动量矩定理', reason: '转动微分方程是动量矩定理的工程应用' },{ key: '转动惯量', reason: '转动惯量是转动微分方程的核心参数' }],
  '机械能守恒': [{ key: '动能定理', reason: '机械能守恒是动能定理在保守系统中的特例' },{ key: '功与能', reason: '机械能=动能+势能' }],
  '动静法': [{ key: '达朗贝尔原理', reason: '动静法=达朗贝尔原理的工程应用' },{ key: '三大定理联合', reason: '动静法统一三大定理为平衡形式' }],
  '单自由度振动': [{ key: '振动基础', reason: '单自由度振动是振动分析的基础' },{ key: '动能定理', reason: '振动能量分析用动能定理' },{ key: '自由度', reason: '单自由度系统=1个独立坐标' }],
  '轴向拉压': [{ key: '拉伸与压缩', reason: '轴向拉压的深入分析' },{ key: '应力与应变', reason: '拉压正应力和正应变基础知识' }],
  '弯扭强度': [{ key: '弯曲应力', reason: '弯曲正应力的深入计算' },{ key: '扭转', reason: '扭转切应力的深入计算' },{ key: '组合变形', reason: '弯扭组合是最常见的组合变形' }],
  '压杆屈曲': [{ key: '压杆稳定', reason: '压杆屈曲=压杆稳定的深入分析' },{ key: '弯曲变形', reason: '压杆失稳的挠曲线与梁弯曲相似' }],
};

// 所有快捷问题
let allQuickQuestions = [];
function buildQuickQuestions() {
  allQuickQuestions = Object.entries(knowledgeBase).map(([key, val]) => ({ question: key, category: val.category }));
}

// ==================== 初始化 ====================
let apiConfigured = false;
let currentCategory = 'all';
let isProcessing = false;
let deepMode = false;
let currentAbortController = null;
let currentRequestId = 0;

function toggleMode() {
  deepMode = !deepMode;
  const btn = document.getElementById('btnMode');
  if (deepMode) { btn.textContent = '🐢 深度'; btn.className = 'btn-mode deep'; }
  else { btn.textContent = '🐇 快速'; btn.className = 'btn-mode'; }
}

// ==================== AI思考系统提示词 ====================
const FAST_SYSTEM_PROMPT = `你是长沙理工大学理论力学研究平台的AI智能助教。请先对问题进行简要分析，再给出完整回答。

请严格按照以下格式输出：

<analysis>
【问题核心】用1-2句话概括问题本质及其所属力学分支
【关键概念】列出涉及的2-4个核心概念及其关联
【回答思路】用2-3句话梳理回答逻辑和重点
</analysis>

<answer>
（在这里给出完整、系统、深入的回答）

回答需遵循以下规则：
1. 用中文回答，公式用 LaTeX：行内 $...$，独立 $$...$$
2. 结构：核心概念 → 公式推导 → 物理意义 → 工程应用
3. 准确严谨，关键步骤说明"为什么"
4. 公式如 $a_C = 2\boldsymbol{\omega}_e \times \boldsymbol{v}_r$，$\frac{1}{2}mv^2$
</answer>`;

const THINKING_SYSTEM_PROMPT = `你是长沙理工大学理论力学研究平台的AI智能助教。现在请你对用户提出的理论力学问题进行**深度思考和分析**。

请按照以下结构输出你的分析（不要直接给出最终答案）：

## 1. 问题核心分析
- 学生真正在问什么？问题的本质是什么？
- 问题属于力学的哪个分支？

## 2. 涉及的力学概念
- 列出所有相关的核心概念和定理
- 标注概念之间的关联关系

## 3. 前置知识检查
- 理解这个问题需要哪些基础知识
- 学生可能存在的知识盲区

## 4. 解题/回答思路
- 梳理回答的逻辑结构
- 列出关键推导步骤
- 标注容易出错的地方

## 5. 回答重点
- 哪些内容需要重点展开
- 哪些地方需要配合公式说明
- 是否需要引入工程实例辅助理解

请保持分析简洁但深入，用中文输出。`;

const ANSWER_SYSTEM_PROMPT = `你是长沙理工大学理论力学研究平台的AI智能助教。你的专业领域是理论力学，包括静力学、运动学、动力学和分析力学。

刚才你已经对用户的问题进行了深入分析。现在请**基于你的分析结果**，给出一个完整、系统、深入的回答。

请按照以下规则回答问题：
1. 用中文回答，专业术语可附英文
2. 对于涉及公式的问题，请使用 LaTeX 格式输出公式。行内公式用 $...$，独立公式用 $$...$$
3. 回答结构：核心概念 → 公式推导 → 物理意义 → 典型应用/例题
4. 回答要准确、严谨，体现力学学科的专业性
5. 适当联系工程实际应用
6. 如果问题超出理论力学范围，礼貌引导用户回到力学相关问题
7. 在关键推导步骤处，明确指出"为什么这样做"

用户的问题是：`;

function init() {
  loadAPIConfig();
  buildQuickQuestions();
  renderQuickQuestions('all');
  // 初始化对话记录
  const convs = getConversations();
  if (convs.length === 0) {
    newConversation();
  } else {
    currentConvId = convs[0].id;
    loadChatHistory();
  }
  renderSidebar();
  scrollToBottom();
  initFavorites();
}
init();

// ==================== API 配置 ====================
function saveAPIConfig() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const endpoint = document.getElementById('apiEndpointInput').value.trim();
  const model = document.getElementById('apiModelInput').value.trim();
  if (key) {
    localStorage.setItem('ai_api_key', key);
    localStorage.setItem('ai_api_endpoint', endpoint || 'https://api.deepseek.com/v1/chat/completions');
    localStorage.setItem('ai_api_model', model || 'deepseek-chat');
    apiConfigured = true; updateAPIStatus(true);
    showToast('✅ API配置已保存！AI增强模式已激活');
  } else {
    localStorage.removeItem('ai_api_key');
    apiConfigured = false; updateAPIStatus(false);
    showToast('⚠️ 未输入API密钥，使用本地知识库模式');
  }
}

function loadAPIConfig() {
  const key = localStorage.getItem('ai_api_key');
  const endpoint = localStorage.getItem('ai_api_endpoint');
  const model = localStorage.getItem('ai_api_model');
  if (key) {
    document.getElementById('apiKeyInput').value = key;
    document.getElementById('apiEndpointInput').value = endpoint || 'https://api.deepseek.com/v1/chat/completions';
    document.getElementById('apiModelInput').value = model || 'deepseek-chat';
    apiConfigured = true; updateAPIStatus(true);
  } else { updateAPIStatus(false); }
}

function clearAPIConfig() {
  localStorage.removeItem('ai_api_key'); localStorage.removeItem('ai_api_endpoint'); localStorage.removeItem('ai_api_model');
  document.getElementById('apiKeyInput').value = '';
  document.getElementById('apiEndpointInput').value = 'https://api.deepseek.com/v1/chat/completions';
  document.getElementById('apiModelInput').value = 'deepseek-chat';
  apiConfigured = false; updateAPIStatus(false);
  showToast('🗑️ API配置已清除，恢复本地知识库模式');
}

function updateAPIStatus(online) {
  const status = document.getElementById('apiStatus');
  const modeLabel = document.getElementById('modeLabel');
  const statusDot = document.getElementById('statusDot');
  const settingsHint = document.getElementById('settingsHint');
  if (online) {
    status.textContent = 'AI增强模式'; status.className = 'api-status online';
    if (statusDot) statusDot.className = 'status-dot online';
    if (modeLabel) modeLabel.textContent = 'AI增强模式 · 支持公式推理';
    if (settingsHint) settingsHint.textContent = 'AI增强回答已就绪';
  } else {
    status.textContent = '本地模式'; status.className = 'api-status offline';
    if (statusDot) statusDot.className = 'status-dot offline';
    if (modeLabel) modeLabel.textContent = '知识库模式 · 支持逐步推导';
    if (settingsHint) settingsHint.textContent = '配置后可启用AI增强回答';
  }
}

// 快捷问题过滤
function filterQuickQuestions(cat, btn) {
  currentCategory = cat; renderQuickQuestions(cat);
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function renderQuickQuestions(cat) {
  const container = document.getElementById('quickQuestions');
  let questions = allQuickQuestions;
  if (cat !== 'all') questions = allQuickQuestions.filter(q => q.category === cat);
  container.innerHTML = questions.map(q =>
    `<button class="quick-btn" onclick="sendQuick('${q.question.replace(/'/g, "\\'")}')">${q.question}</button>`
  ).join('');
}

// ==================== 消息系统 ====================
function scrollToBottom() {
  const body = document.getElementById('chatBody');
  setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
}

function addMessage(type, text, time) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + type;
  const avatarText = type === 'user' ? '我' : 'AI';
  const timeStr = time || '刚刚';
  const alignStyle = type === 'user' ? 'text-align:right' : '';
  div.innerHTML = `<div class="msg-avatar">${avatarText}</div><div><div class="msg-bubble">${text}</div><div class="msg-time" style="${alignStyle}">${timeStr}</div></div>`;
  body.appendChild(div);
  const bubble = div.querySelector('.msg-bubble');
  if (bubble) renderLatex(bubble);
  scrollToBottom();
}

// ==================== LaTeX 渲染 ====================
function renderLatex(element) {
  if (typeof renderMathInElement === 'undefined') {
    setTimeout(() => { if (typeof renderMathInElement !== 'undefined') renderLatex(element); }, 500);
    return;
  }
  try {
    renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false, trust: true, strict: false, output: 'html',
      macros: { '\\bv': '\\boldsymbol{v}', '\\bF': '\\boldsymbol{F}', '\\ba': '\\boldsymbol{a}', '\\bomega': '\\boldsymbol{\\omega}', '\\balpha': '\\boldsymbol{\\alpha}', '\\br': '\\boldsymbol{r}', '\\bM': '\\boldsymbol{M}' },
    });
  } catch (e) { console.warn('LaTeX render failed:', e); }
}

function addTypingIndicator() {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'chat-msg bot'; div.id = 'typingIndicator';
  div.innerHTML = `<div class="msg-avatar">AI</div><div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div><div style="font-size:0.6em;color:#94a3b8;margin-top:4px;">按 <kbd style="background:#e2e8f0;border:1px solid #cbd5e1;border-radius:3px;padding:1px 5px;">Esc</kbd> 取消</div></div></div>`;
  body.appendChild(div); scrollToBottom();
}

function removeTypingIndicator() { const el = document.getElementById('typingIndicator'); if (el) el.remove(); }

function addThinkingIndicator(phaseText) {
  removeTypingIndicator(); removeThinkingIndicator();
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'chat-msg bot'; div.id = 'thinkingIndicator';
  div.innerHTML = `<div class="msg-avatar">AI</div><div><div class="msg-bubble"><div class="thinking-indicator"><span>${phaseText || '正在分析...'}</span><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="font-size:0.6em;color:#94a3b8;margin-top:4px;">按 <kbd style="background:#e2e8f0;border:1px solid #cbd5e1;border-radius:3px;padding:1px 5px;">Esc</kbd> 取消</div></div></div>`;
  body.appendChild(div); scrollToBottom();
}

function removeThinkingIndicator() { const el = document.getElementById('thinkingIndicator'); if (el) el.remove(); }

function addThinkingBlock(thinkingText) {
  if (!thinkingText || thinkingText.trim().length === 0) return;
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `<div class="msg-avatar">AI</div><div><div class="msg-bubble" style="padding:0;background:transparent;border:none;box-shadow:none;"><details class="think-block"><summary>🧠 AI思考过程（点击展开）</summary><div class="think-content">${thinkingText.replace(/\n/g, '<br>')}</div></details></div></div>`;
  body.appendChild(div);
  const content = div.querySelector('.think-content');
  if (content) renderLatex(content);
  scrollToBottom();
}

function saveChatHistory() {
  const body = document.getElementById('chatBody');
  const messages = [];
  body.querySelectorAll('.chat-msg').forEach(msg => {
    const bubble = msg.querySelector('.msg-bubble');
    const time = msg.querySelector('.msg-time');
    if (bubble) messages.push({ type: msg.classList.contains('user') ? 'user' : 'bot', text: bubble.innerHTML, time: time ? time.textContent : '' });
  });
  if (messages.length > 40) messages.splice(0, messages.length - 40);
  // 保存到当前对话
  if (currentConvId) {
    const convs = getConversations();
    const conv = convs.find(c => c.id === currentConvId);
    if (conv) {
      conv.messages = messages;
      // 用第一条用户消息作为标题
      const firstUser = messages.find(m => m.type === 'user');
      if (firstUser) conv.title = firstUser.text.replace(/<[^>]*>/g, '').substring(0, 40);
      saveConversations(convs);
      renderSidebar();
    }
  }
  updateMemoryBadge(messages.length);
}

function loadChatHistory() {
  try {
    if (!currentConvId) return;
    const convs = getConversations();
    const conv = convs.find(c => c.id === currentConvId);
    if (conv && conv.messages && conv.messages.length > 0) {
      const body = document.getElementById('chatBody');
      body.innerHTML = '';
      conv.messages.forEach(msg => addMessage(msg.type, msg.text, msg.time));
    }
    updateMemoryBadge(conv && conv.messages ? conv.messages.length : 0);
  } catch(e) { updateMemoryBadge(0); }
}

function updateMemoryBadge(count) {
  const el = document.getElementById('memoryBadge');
  if (el) { el.textContent = count > 0 ? `🧠 ${count}条记忆` : ''; el.title = count > 0 ? `已保存 ${count} 条对话记录（Ctrl+L 清除）` : ''; }
}

function clearChatHistory() {
  if (currentConvId) deleteConversation(currentConvId);
}

// ==================== 智能匹配 ====================
function smartMatch(question) {
  const q = question.toLowerCase(); let bestMatch = null; let bestScore = 0;
  for (const [key, val] of Object.entries(knowledgeBase)) {
    let score = 0; const k = key.toLowerCase();
    if (q.includes(k)) score = 100;
    else { const words = k.split(''); const matchedWords = words.filter(w => q.includes(w)); score = matchedWords.length / words.length * 60; }
    const extraKeywords = {
      '静力学': ['力','平衡','约束','支座','铰','摩擦','受力','桁架','重心','形心'],
      '运动学': ['速度','加速度','运动','转动','平动','瞬心','科氏','刚体','轨迹'],
      '动力学': ['动量','动能','功','功率','碰撞','振动','频率','转动惯量'],
      '分析力学': ['拉格朗日','虚位移','哈密顿','广义','变分','自由度'],
      '材料力学': ['应力','应变','弯曲','扭转','挠度','屈曲','强度','刚度'],
    };
    for (const [cat, kws] of Object.entries(extraKeywords)) { if (val.category === cat && kws.some(kw => q.includes(kw))) score += 15; }
    if (score > bestScore) { bestScore = score; bestMatch = { key, val, score }; }
  }
  return bestScore >= 30 ? bestMatch : null;
}

// ==================== API 调用 ====================
async function callAI(question, customSystemPrompt = null, signal = null) {
  const apiKey = localStorage.getItem('ai_api_key');
  const endpoint = localStorage.getItem('ai_api_endpoint') || 'https://api.deepseek.com/v1/chat/completions';
  const model = localStorage.getItem('ai_api_model') || 'deepseek-chat';
  const defaultPrompt = `你是长沙理工大学理论力学研究平台的AI智能助教。你的专业领域是理论力学，包括静力学、运动学、动力学和分析力学。

请按照以下规则回答问题：
1. 用中文回答，专业术语可附英文
2. 对于涉及公式的问题，请使用 LaTeX 格式输出公式。行内公式用 $...$，独立公式用 $$...$$
3. 回答结构：核心概念 → 公式推导 → 物理意义 → 典型应用/例题
4. 回答要准确、严谨，体现力学学科的专业性
5. 适当联系工程实际应用
6. 如果问题超出理论力学范围，礼貌引导用户回到力学相关问题

用户的问题是：`;
  const systemPrompt = customSystemPrompt || defaultPrompt;
  const isCustom = !!customSystemPrompt;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }], temperature: isCustom ? 0.5 : 0.7, max_tokens: isCustom ? 1800 : 2000 }),
      signal: signal || undefined
    });
    if (!response.ok) throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    if (error.name === 'AbortError') { console.log('请求已被用户取消'); throw error; }
    console.error('AI API调用失败:', error); return null;
  }
}

// ==================== 两阶段AI调用 ====================
async function callAIWithThinking(question, signal) {
  let thinkingResult = null;
  try { thinkingResult = await callAI(question, THINKING_SYSTEM_PROMPT, signal); }
  catch (e) { if (e.name === 'AbortError') throw e; console.warn('思考阶段失败:', e); return { thinking: null, answer: null, fallback: true }; }
  if (!thinkingResult || thinkingResult.trim().length < 10) return { thinking: thinkingResult, answer: null, fallback: true };
  let answerResult = null;
  try { const enrichedQuestion = `【问题】${question}\n\n【我的分析过程】\n${thinkingResult}\n\n请基于以上分析，给出完整的回答。`; answerResult = await callAI(enrichedQuestion, ANSWER_SYSTEM_PROMPT, signal); }
  catch (e) { if (e.name === 'AbortError') throw e; console.warn('回答阶段失败:', e); return { thinking: thinkingResult, answer: null, fallback: true }; }
  if (!answerResult) return { thinking: thinkingResult, answer: null, fallback: true };
  return { thinking: thinkingResult, answer: answerResult, fallback: false };
}

// ==================== 快速模式 ====================
async function callAIFast(question, signal) {
  try {
    const raw = await callAI(question, FAST_SYSTEM_PROMPT, signal);
    if (!raw) return { analysis: null, answer: null, fallback: true };
    const analysisMatch = raw.match(/<analysis>([\s\S]*?)<\/analysis>/i);
    const answerMatch = raw.match(/<answer>([\s\S]*?)<\/answer>/i);
    const analysis = analysisMatch ? analysisMatch[1].trim() : null;
    const answer = answerMatch ? answerMatch[1].trim() : raw;
    if (!answer || answer.length < 5) return { analysis, answer: null, fallback: true };
    return { analysis, answer, fallback: false };
  } catch (e) { if (e.name === 'AbortError') throw e; console.warn('快速模式失败:', e); return { analysis: null, answer: null, fallback: true }; }
}

// ==================== Markdown 格式化 ====================
function formatMarkdown(text) {
  if (!text) return '';
  let html = text;
  const latexBlocks = [];
  html = html.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (match) => { latexBlocks.push(match); return `__LATEX_${latexBlocks.length - 1}__`; });
  const codeBlocks = [];
  html = html.replace(/(```[\s\S]*?```)/g, (match) => { codeBlocks.push(match); return `__CODE_${codeBlocks.length - 1}__`; });
  html = html.replace(/^#### (.+?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+?)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^(\s*)[-*] (.+?)$/gm, '$1<li>$2</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^(\s*)\d+\. (.+?)$/gm, '$1<li>$2</li>');
  html = html.replace(/^> (.+?)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/<\/li><br>/g, '</li>');
  html = html.replace(/<\/ul><br>/g, '</ul>');
  latexBlocks.forEach((block, i) => { html = html.replace(`__LATEX_${i}__`, block); });
  codeBlocks.forEach((block, i) => {
    const content = block.replace(/```(\w*)\n?([\s\S]*?)```/, (_, lang, code) => { const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;'); return `<pre><code>${escapedCode}</code></pre>`; });
    html = html.replace(`__CODE_${i}__`, content);
  });
  html = html.replace(/<p><(h[234]|ul|ol|pre|blockquote|table|hr|div)/g, '<$1');
  html = html.replace(/<\/(h[234]|ul|ol|pre|blockquote|table|div)><\/p>/g, '</$1>');
  return html;
}

// ==================== 联网搜索链接 ====================
function generateSearchLink(question) { const encoded = encodeURIComponent(question + ' 理论力学'); return `https://www.bing.com/search?q=${encoded}`; }

// ==================== 核心：发送消息 ====================
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const sessionStart = Date.now();
  if (isProcessing) { abortCurrentRequest(); await new Promise(r => setTimeout(r, 80)); }
  const myRequestId = ++currentRequestId;
  isProcessing = true;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true; sendBtn.textContent = '⏹'; sendBtn.title = '处理中…按Esc取消';
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  addMessage('user', text, formatTime());
  input.value = '';
  window._lastUserQuestion = text;
  saveChatHistory();
  let response = null; let thinkingText = null; let responseSource = 'knowledge'; let wasCancelled = false;
  if (apiConfigured) {
    try {
      if (deepMode) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        addThinkingIndicator('正在深度分析...');
        const thinkingResult = await callAIWithThinking(text, signal);
        if (!thinkingResult.fallback && thinkingResult.thinking) {
          thinkingText = thinkingResult.thinking; removeThinkingIndicator(); addThinkingBlock(thinkingText);
          if (thinkingResult.answer) { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); addThinkingIndicator('正在生成回答...'); response = thinkingResult.answer; responseSource = 'ai'; }
        } else if (thinkingResult.fallback && thinkingResult.thinking) {
          thinkingText = thinkingResult.thinking; removeThinkingIndicator(); addThinkingBlock(thinkingText);
        } else {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          removeThinkingIndicator(); addThinkingIndicator('正在回答...');
          const fastResult = await callAIFast(text, signal);
          if (!fastResult.fallback && fastResult.answer) { if (fastResult.analysis) { removeThinkingIndicator(); addThinkingBlock(fastResult.analysis); } response = fastResult.answer; responseSource = 'ai'; }
          else { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); removeThinkingIndicator(); addTypingIndicator(); response = await callAI(text, null, signal); if (response) responseSource = 'ai'; }
        }
      } else {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        addThinkingIndicator('正在回答...');
        const fastResult = await callAIFast(text, signal);
        if (!fastResult.fallback && fastResult.answer) { thinkingText = fastResult.analysis; removeThinkingIndicator(); if (thinkingText) addThinkingBlock(thinkingText); response = fastResult.answer; responseSource = 'ai'; }
        else { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); removeThinkingIndicator(); addTypingIndicator(); response = await callAI(text, null, signal); if (response) responseSource = 'ai'; }
      }
    } catch (e) { if (e.name === 'AbortError') { console.log('用户取消了当前提问'); wasCancelled = true; } else { console.error('AI调用失败:', e); } }
  }
  removeThinkingIndicator(); removeTypingIndicator();
  if (wasCancelled) {
    if (myRequestId === currentRequestId) { addMessage('bot', `⚠️ <strong>已停止回答</strong><br><br>当前提问已被取消。您可以输入新问题继续对话。`, formatTime()); saveChatHistory(); scrollToBottom(); }
    isProcessing = false; sendBtn.disabled = false; sendBtn.textContent = '➤'; currentAbortController = null; return;
  }
  if (!response) {
    const match = smartMatch(text);
    if (match && match.score >= 60) { response = match.val.answer; responseSource = 'knowledge'; }
    else if (match && match.score >= 30) { response = match.val.answer + generateRelatedSearchHTML(text); responseSource = 'knowledge_partial'; }
    else { response = generateFallbackResponse(text); responseSource = 'fallback'; }
  }
  let matchKey = null; const match = smartMatch(text); if (match) matchKey = match.key;
  const bmId = 'bm_' + Date.now();
  const bookmarkBtn = `<div style="margin-top:8px;text-align:right;"><button class="bookmark-btn" id="${bmId}" onclick="bookmarkAnswer('${bmId}')" title="收藏此回答到收藏夹">☆ 收藏</button></div>`;
  if (responseSource === 'ai') {
    const formatted = formatMarkdown(response);
    let fullResponse = formatted + generateSearchHTML(text) + bookmarkBtn;
    if (matchKey) { fullResponse += generateRelatedKnowledge(matchKey); fullResponse += generateJumpLinks(matchKey); fullResponse += generateAllModuleFigures(matchKey); fullResponse += generateTextbookLinks(matchKey); fullResponse += generateBrowsePanel(matchKey); }
    addMessage('bot', fullResponse, formatTime());
  } else {
    let fullResponse = response + bookmarkBtn;
    if (matchKey) { fullResponse += generateRelatedKnowledge(matchKey); fullResponse += generateJumpLinks(matchKey); fullResponse += generateAllModuleFigures(matchKey); fullResponse += generateTextbookLinks(matchKey); fullResponse += generateBrowsePanel(matchKey); }
    addMessage('bot', fullResponse, formatTime());
  }
  saveChatHistory(); scrollToBottom();
  recordAiUsage(sessionStart);
  isProcessing = false; sendBtn.disabled = false; sendBtn.textContent = '➤'; currentAbortController = null;
}

function recordAiUsage(sessionStart) {
  try {
    const u = JSON.parse(localStorage.getItem('current_user') || 'null');
    if (!u || !u.student_id) return;
    const key = 'user_activity_' + u.student_id;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const d = new Date();
    const t = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    if (!data[t]) data[t] = { login:false, questions:0, ai_minutes:0, ai_count:0 };
    data[t].ai_count = (data[t].ai_count || 0) + 1;
    const elapsedMin = Math.max(1, Math.round((Date.now() - (sessionStart || Date.now())) / 60000));
    data[t].ai_minutes = (data[t].ai_minutes || 0) + elapsedMin;
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) {}
}

function abortCurrentRequest() { if (currentAbortController) { currentAbortController.abort(); currentAbortController = null; } }
function handleSendOrStop() { if (isProcessing) { abortCurrentRequest(); showToast('⏹️ 已停止当前提问'); return; } sendMessage(); }
function sendQuick(text) { document.getElementById('chatInput').value = text; sendMessage(); }

function generateSearchHTML(question) { return `<br><br><a class="search-link" href="${generateSearchLink(question)}" target="_blank" rel="noopener">🌐 在搜索引擎中查看更多相关资料 →</a>`; }
function generateRelatedSearchHTML(question) { return `<br><br><div class="formula-block warning">⚠️ 以上答案来自本地知识库的部分匹配，可能与您的问题不完全对应。<br>建议：① 更精确地描述您的问题（使用专业术语）<br>② <a href="${generateSearchLink(question)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;">点击此处搜索完整解答 →</a></div>`; }
function generateFallbackResponse(question) {
  const searchLink = generateSearchLink(question);
  return `<strong>您的问题：</strong>"${question}"<br><br><strong>📚 本地知识库中暂未收录该问题的详细解答。</strong><br><br>建议您：<br>① <strong>换一种表达方式</strong>重新提问（使用专业术语效果更好）<br>② <strong>尝试快捷问题</strong>：点击下方的标签和问题按钮<br>③ <strong>启用AI增强模式</strong>：在页面顶部输入API密钥<br><br><a class="search-link" href="${searchLink}" target="_blank" rel="noopener">🌐 搜索："${question} 理论力学" →</a><br><br><div class="formula-block"><strong>💡 提示：</strong>支持的API包括OpenAI、以及任何OpenAI兼容接口（如Ollama、LM Studio等本地模型）。<br>配置方法：在顶部输入框填入API密钥、端点地址和模型名称，点击"保存配置"即可。</div>`;
}
function formatTime() { const now = new Date(); return now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0'); }

// ==================== 相关知识点 & 跳转链接 ====================
function getCategoryClass(cat) { const map = { '静力学': 'cat-statics', '运动学': 'cat-kinematics', '动力学': 'cat-dynamics', '分析力学': 'cat-analytical', '材料力学': 'cat-materials', '方法论': 'cat-methodology' }; return map[cat] || 'cat-statics'; }
function getCategoryEmoji(cat) { const map = { '静力学': '⚖️', '运动学': '🏃', '动力学': '⚡', '分析力学': '🔬', '材料力学': '🔩', '方法论': '🧠' }; return map[cat] || '📚'; }

function generateRelatedKnowledge(matchKey) {
  const related = relatedTopics[matchKey]; if (!related || related.length === 0) return '';
  const cards = related.map(r => { const item = knowledgeBase[r.key]; if (!item) return ''; const catClass = getCategoryClass(item.category); return `<div class="related-card" onclick="sendQuick('${r.key.replace(/'/g, "\\'")}')" title="点击查看详细解答"><span class="card-cat ${catClass}">${getCategoryEmoji(item.category)} ${item.category}</span><span class="card-name">${r.key}</span><span class="card-reason">🔗 ${r.reason}</span></div>`; }).join('');
  if (!cards.trim()) return '';
  return `<div class="related-section"><div class="related-title">🧩 跨领域相关知识</div><div class="related-grid">${cards}</div></div>`;
}

function generateJumpLinks(matchKey) {
  const related = relatedTopics[matchKey]; if (!related || related.length === 0) return '';
  const links = related.slice(0, 5).map(r => { const item = knowledgeBase[r.key]; if (!item) return ''; return `<button class="jump-link" onclick="sendQuick('${r.key.replace(/'/g, "\\'")}')" title="${r.reason}">→ ${r.key}</button>`; }).join('');
  if (!links.trim()) return '';
  return `<div class="jump-bar"><span class="jump-bar-label">📌 跳转至详细模块：</span>${links}</div>`;
}

// ==================== 电子课本跳转映射 ====================
const textbookPath = 'statics/textbook.html';
const textbookModules = {
  m1:'本节学习目标与知识框架',m2:'力的定义与作用效果',m3:'力的三要素与单位',m4:'力的两个重要特征：矢量性与定位性',m5:'入门实例：为什么推门要推门把手',m6:'什么是刚体模型',m7:'质点、刚体、变形体的比较',m8:'为什么静力学常把物体看成刚体',m9:'刚体的运动效应初步认识',m10:'研究刚体时的常见误区',m11:'力的作用线',m12:'力的可传性原理',m13:'可传性原理的适用范围与限制',m14:'外力与内力的区分',m15:'本页小结与易错点',m16:'力为什么是矢量',m17:'平面力的正交分解',m18:'分量正负号怎样判断',m19:'力的合成与分解的意义',m20:'常见错误与学习提醒',m21:'什么是力矩',m22:'力对点之矩',m23:'力矩方向与符号',m24:'求力矩的三种常用方法',m25:'易错点与深入理解',m26:'什么是力偶',m27:'约束与约束反力',m28:'怎样画受力图',m29:'受力图的适用范围与常见错误',m30:'全章总结',
  m31:'力系简化的基本概念',m32:'汇交力系的简化与平衡',m33:'力偶系的简化与平衡',m34:'平面任意力系的简化',m35:'平面任意力系的平衡条件',m36:'空间力系向一点的简化',m37:'空间力系的平衡方程应用',m38:'滑动摩擦与摩擦角',m39:'考虑摩擦的平衡问题',m40:'滚动摩阻与皮带摩擦',m41:'桁架内力分析的节点法',m42:'桁架内力分析的截面法',m43:'重心、形心与分布载荷',m44:'力系简化与平衡综合应用',
  m51:'点的运动描述方法',m52:'刚体的平动与定轴转动',m53:'点的速度合成定理',m54:'点的加速度合成与科氏加速度',m55:'刚体平面运动的速度分析',m56:'刚体平面运动的加速度分析',m57:'运动学综合应用——机构分析',m58:'质点动力学基本方程',m59:'动量定理与质心运动定理',m60:'动量矩定理与转动微分方程',m61:'动能定理与机械能守恒',m62:'三大定理的综合应用',m63:'达朗贝尔原理（动静法）',m64:'虚位移原理与虚功方程',m65:'拉格朗日方程初步',m66:'单自由度系统的振动',m67:'碰撞理论的基本方程',m68:'轴向拉伸与压缩',m69:'扭转与弯曲强度计算',m70:'组合变形与压杆稳定',
};
const moduleFigures = {
  m1:'statics/crops/module_01.png',m2:'statics/crops/module_02.png',m3:'statics/crops/module_03.png',m4:'statics/crops/module_04.png',m5:'statics/crops/module_05.png',m6:'statics/crops/module_06.png',m7:'statics/crops/module_07.png',m8:'statics/crops/module_08.png',m9:'statics/crops/module_09.png',m10:'statics/crops/module_10.png',m11:'statics/crops/module_11.png',m12:'statics/crops/module_12.png',m13:'statics/crops/module_13.png',m14:'statics/crops/module_14.png',m15:'statics/crops/module_15.png',m16:'statics/crops/module_16.png',m17:'statics/crops/module_17.png',m18:'statics/crops/module_18.png',m19:'statics/crops/module_19.png',m20:'statics/crops/module_20.png',m21:'statics/crops/module_21.png',m22:'statics/crops/module_22.png',m23:'statics/crops/module_23.png',m24:'statics/crops/module_24.png',m25:'statics/crops/module_25.png',m26:'statics/crops/module_26.png',m27:'statics/crops/module_27.png',m28:'statics/crops/module_28.png',m29:'statics/crops/module_29.png',
  m31:'statics/crops/module_31.svg',m32:'statics/crops/module_32.svg',m33:'statics/crops/module_33.svg',m34:'statics/crops/module_34.svg',m35:'statics/crops/module_35.svg',m36:'statics/crops/module_36.svg',m37:'statics/crops/module_37.svg',m38:'statics/crops/module_38.svg',m39:'statics/crops/module_39.svg',m40:'statics/crops/module_40.svg',m41:'statics/crops/module_41.svg',m42:'statics/crops/module_42.svg',m43:'statics/crops/module_43.svg',m44:'statics/crops/module_44.svg',
  m51:'statics/topics/module_51.png',m52:'statics/topics/module_52.png',m53:'statics/topics/module_53.png',m54:'statics/topics/module_54.png',m55:'statics/topics/module_55.png',m56:'statics/topics/module_56.png',m57:'statics/topics/module_57.png',m58:'statics/topics/module_58.png',m59:'statics/topics/module_59.png',m60:'statics/topics/module_60.png',m61:'statics/topics/module_61.png',m62:'statics/topics/module_62.png',m63:'statics/topics/module_63.png',m64:'statics/topics/module_64.png',m65:'statics/topics/module_65.png',m66:'statics/topics/module_66.png',m67:'statics/topics/module_67.png',m68:'statics/topics/module_68.png',m69:'statics/topics/module_69.png',m70:'statics/topics/module_70.png',
};
const practiceFigures = {
  m32_q0:{module:'m32',question:'第1题',path:'statics/practice/qfig_m32_q0.svg'},m32_q2:{module:'m32',question:'第3题',path:'statics/practice/qfig_m32_q2.svg'},m33_q2:{module:'m33',question:'第3题',path:'statics/practice/qfig_m33_q2.svg'},m34_q0:{module:'m34',question:'第1题',path:'statics/practice/qfig_m34_q0.svg'},m34_q2:{module:'m34',question:'第3题',path:'statics/practice/qfig_m34_q2.svg'},m35_q1:{module:'m35',question:'第2题',path:'statics/practice/qfig_m35_q1.svg'},m35_q2:{module:'m35',question:'第3题',path:'statics/practice/qfig_m35_q2.svg'},m37_q2:{module:'m37',question:'第3题',path:'statics/practice/qfig_m37_q2.svg'},m38_q1:{module:'m38',question:'第2题',path:'statics/practice/qfig_m38_q1.svg'},m38_q2:{module:'m38',question:'第3题',path:'statics/practice/qfig_m38_q2.svg'},m39_q2:{module:'m39',question:'第3题',path:'statics/practice/qfig_m39_q2.svg'},m40_q1:{module:'m40',question:'第2题',path:'statics/practice/qfig_m40_q1.svg'},m40_q2:{module:'m40',question:'第3题',path:'statics/practice/qfig_m40_q2.svg'},m42_q2:{module:'m42',question:'第3题',path:'statics/practice/qfig_m42_q2.svg'},m43_q2:{module:'m43',question:'第3题',path:'statics/practice/qfig_m43_q2.svg'},
};
const lateExtensionFigures = {
  ext7:{page:'延展7',path:'statics/latext/ext_page7.svg'},ext8:{page:'延展8',path:'statics/latext/ext_page8.svg'},ext9:{page:'延展9',path:'statics/latext/ext_page9.svg'},ext10:{page:'延展10',path:'statics/latext/ext_page10.svg'},ext11:{page:'延展11',path:'statics/latext/ext_page11.svg'},ext12:{page:'延展12',path:'statics/latext/ext_page12.svg'},
};
const supplementFigures = {
  supp1:{page:'补充1',path:'statics/supp/supp_page1.svg'},supp2:{page:'补充2',path:'statics/supp/supp_page2.svg'},supp3:{page:'补充3',path:'statics/supp/supp_page3.svg'},supp4:{page:'补充4',path:'statics/supp/supp_page4.svg'},supp5:{page:'补充5',path:'statics/supp/supp_page5.svg'},supp6:{page:'补充6',path:'statics/supp/supp_page6.svg'},
};
const textbookMapping = {
  '受力图':['m27','m28','m29'],'平衡方程':['m16','m17','m19','m34','m35'],'二力杆':['m8','m14'],'摩擦力':['m27','m38','m39','m40'],'空间力系':['m16','m17','m21','m36','m37'],'桁架':['m14','m28','m41','m42'],'重心与形心':['m16','m17','m43'],'速度瞬心':['m9','m55','m57'],'点的合成运动':['m9','m53','m54'],'刚体平面运动':['m9','m55','m56','m57'],'刚体定点转动':['m9','m21'],'科氏加速度':['m9','m54'],'相对运动':['m9','m53','m54'],'动能定理':['m2','m16','m61','m62'],'动量定理':['m2','m3','m59','m62'],'动量矩定理':['m21','m22','m23','m24','m60','m62'],'三大定理联合':['m2','m21','m62'],'达朗贝尔原理':['m2','m21','m63'],'碰撞理论':['m2','m3','m67'],'转动惯量':['m21'],'功率与效率':['m2'],'虚位移原理':['m2','m28','m64'],'虚功原理应用':['m2','m28','m64'],'完整约束与非完整约束':['m27'],'应力与应变':['m2','m68'],'拉伸与压缩':['m2','m3','m68'],'扭转':['m21','m69'],'弯曲应力':['m21','m69'],'弯曲变形':['m21','m69'],'组合变形':['m21','m70'],'压杆稳定':['m2','m8','m70'],'牛顿定律':['m2','m3','m6','m58'],'功与能':['m2','m61'],'振动基础':['m2','m6','m66'],'解题技巧':['m28','m29','m62'],'拉格朗日方程':['m65'],'哈密顿原理':['m65'],'广义坐标':['m65'],'自由度':['m65','m66'],
  '力系简化':['m31','m34','m36'],'汇交力系':['m32'],'力偶系':['m33'],'平面任意力系':['m34','m35'],'摩擦与自锁':['m38','m39','m40'],'桁架节点法':['m41'],'桁架截面法':['m42'],'分布载荷':['m43'],'点的运动学':['m51'],'刚体基本运动':['m52'],'速度合成':['m53'],'加速度合成':['m54'],'平面运动速度':['m55'],'平面运动加速度':['m56'],'机构运动分析':['m57'],'质点动力学':['m58'],'质心运动定理':['m59'],'转动微分方程':['m60'],'机械能守恒':['m61'],'动静法':['m63'],'虚功方程':['m64'],'拉格朗日方法':['m65'],'单自由度振动':['m66'],'碰撞方程':['m67'],'轴向拉压':['m68'],'弯扭强度':['m69'],'压杆屈曲':['m70'],
};

function generateTextbookLinks(matchKey) {
  const modIds = textbookMapping[matchKey]; if (!modIds || modIds.length === 0) return '';
  const links = modIds.map(id => { const title = textbookModules[id]; if (!title) return ''; const fullUrl = textbookPath + '#' + id; return `<a class="textbook-link" href="${fullUrl}" target="_blank" rel="noopener" title="跳转到电子课本：${title}">📖 ${id.toUpperCase()} ${title}</a>`; }).join('');
  const figThumbs = modIds.filter(id => moduleFigures[id]).map(id => { const src = moduleFigures[id]; const title = textbookModules[id] || id; return `<img class="figure-thumb" src="${src}" alt="${title}" title="${title}" onclick="event.stopPropagation();openLightbox('${src}','${id.toUpperCase()} ${title}')" loading="lazy">`; }).join('');
  if (!links.trim() && !figThumbs.trim()) return '';
  let html = ''; if (links.trim()) html += `<div class="jump-bar textbook-bar"><span class="jump-bar-label">📖 电子课本参考：</span>${links}</div>`; if (figThumbs.trim()) html += `<div class="figure-thumb-row"><span class="jump-bar-label" style="font-size:0.65em;display:block;margin-bottom:2px;">🖼️ 模块图表预览（点击放大）：</span>${figThumbs}</div>`; return html;
}

// ==================== 收藏夹 ====================
function getFavorites() { try { return JSON.parse(localStorage.getItem('qa_favorites') || '[]'); } catch(e) { return []; } }
function saveFavorites(favs) { localStorage.setItem('qa_favorites', JSON.stringify(favs)); updateFavCount(); renderFavorites(); }
function updateFavCount() { const count = getFavorites().length; const el = document.getElementById('favCount'); if (el) el.textContent = count + '条'; }

function bookmarkAnswer(btnId) {
  const btn = document.getElementById(btnId); if (!btn) return;
  if (btn.classList.contains('saved')) { removeBookmarkByBtn(btn); return; }
  const msgDiv = btn.closest('.chat-msg'); if (!msgDiv) return;
  const bubble = msgDiv.querySelector('.msg-bubble'); if (!bubble) return;
  const allMsgs = msgDiv.parentElement.querySelectorAll('.chat-msg');
  let questionText = window._lastUserQuestion || '未知问题';
  const msgsArray = Array.from(allMsgs); const myIdx = msgsArray.indexOf(msgDiv);
  if (myIdx > 0) { for (let i = myIdx - 1; i >= 0; i--) { if (msgsArray[i].classList.contains('user')) { const qBubble = msgsArray[i].querySelector('.msg-bubble'); if (qBubble) questionText = qBubble.textContent.trim().substring(0, 200); break; } } }
  const answerClone = bubble.cloneNode(true); const btnInClone = answerClone.querySelector('.bookmark-btn'); if (btnInClone) btnInClone.remove();
  const answerHTML = answerClone.innerHTML; const answerText = answerClone.textContent.trim().substring(0, 300);
  const favs = getFavorites();
  if (favs.some(f => f.question === questionText && f.answerText === answerText)) { showToast('⚠️ 该问答已在收藏夹中'); return; }
  favs.unshift({ id: Date.now(), question: questionText, answerHTML: answerHTML, answerText: answerText, time: new Date().toLocaleString('zh-CN') });
  if (favs.length > 50) favs.length = 50;
  saveFavorites(favs); btn.classList.add('saved'); btn.textContent = '已收藏'; btn.title = '点击取消收藏'; showToast('⭐ 已添加到收藏夹');
}

function removeBookmarkByBtn(btn) {
  const msgDiv = btn.closest('.chat-msg'); if (!msgDiv) return;
  const bubble = msgDiv.querySelector('.msg-bubble'); if (!bubble) return;
  const answerClone = bubble.cloneNode(true); const btnInClone = answerClone.querySelector('.bookmark-btn'); if (btnInClone) btnInClone.remove();
  const answerText = answerClone.textContent.trim().substring(0, 300);
  const favs = getFavorites(); const idx = favs.findIndex(f => f.answerText === answerText);
  if (idx >= 0) { favs.splice(idx, 1); saveFavorites(favs); }
  btn.classList.remove('saved'); btn.textContent = '☆ 收藏'; btn.title = '收藏此回答到收藏夹'; showToast('已取消收藏');
}

function removeFavorite(favId) { let favs = getFavorites(); favs = favs.filter(f => f.id !== favId); saveFavorites(favs); updateAllBookmarkButtons(); showToast('🗑️ 已从收藏夹移除'); }
function clearAllFavorites() { if (getFavorites().length === 0) return; if (!confirm('确定要清空所有收藏吗？此操作不可恢复。')) return; localStorage.setItem('qa_favorites', '[]'); updateFavCount(); renderFavorites(); updateAllBookmarkButtons(); showToast('🗑️ 收藏夹已清空'); }

function updateAllBookmarkButtons() {
  const favs = getFavorites(); const favTexts = new Set(favs.map(f => f.answerText));
  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    const msgDiv = btn.closest('.chat-msg'); if (!msgDiv) return;
    const bubble = msgDiv.querySelector('.msg-bubble'); if (!bubble) return;
    const clone = bubble.cloneNode(true); const btnInClone = clone.querySelector('.bookmark-btn'); if (btnInClone) btnInClone.remove();
    const txt = clone.textContent.trim().substring(0, 300);
    if (favTexts.has(txt)) { btn.classList.add('saved'); btn.textContent = '已收藏'; btn.title = '点击取消收藏'; }
  });
}

function reaskFavorite(questionText) { document.getElementById('chatInput').value = questionText; sendMessage(); document.getElementById('chatBody').scrollIntoView({ behavior: 'smooth' }); }
function toggleFavorites() { const panel = document.getElementById('favoritesPanel'); panel.classList.toggle('favorites-collapsed'); }

function renderFavorites() {
  const container = document.getElementById('favoritesBody'); if (!container) return;
  const favs = getFavorites(); if (favs.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = favs.map((f, i) => `<div class="fav-item"><div class="fav-question">${escapeHTML(f.question)}</div><div class="fav-answer">${f.answerHTML}</div><div class="fav-meta"><span>🕐 ${f.time}</span><span><button class="fav-reask" onclick="reaskFavorite('${f.question.replace(/'/g, "\\'")}')" title="重新提问">🔄 追问</button><button class="fav-remove" onclick="removeFavorite(${f.id})" title="删除此收藏">✕</button></span></div></div>`).join('');
  container.querySelectorAll('.fav-answer').forEach(el => renderLatex(el));
}

function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function initFavorites() { updateFavCount(); renderFavorites(); setTimeout(updateAllBookmarkButtons, 300); }

// ==================== Toast ====================
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 24px;border-radius:25px;font-size:0.9em;z-index:999;transition:all 0.3s ease;box-shadow:0 4px 16px rgba(0,0,0,0.2);white-space:nowrap;'; document.body.appendChild(toast); }
  toast.textContent = msg; toast.style.opacity = '1'; toast.style.bottom = '30px';
  setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '20px'; }, 2500);
}

// ==================== 灯箱组件 ====================
function initLightbox() {
  if (document.getElementById('lightbox')) return;
  const overlay = document.createElement('div'); overlay.id = 'lightbox'; overlay.className = 'lightbox-overlay';
  overlay.innerHTML = '<span class="lightbox-close" onclick="closeLightbox()">&times;</span><img id="lightboxImg" src="" alt=""><div class="lightbox-caption" id="lightboxCaption"></div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay || e.target.classList.contains('lightbox-close')) closeLightbox(); });
  document.body.appendChild(overlay);
}
function openLightbox(src, caption) { initLightbox(); const overlay = document.getElementById('lightbox'); document.getElementById('lightboxImg').src = src; document.getElementById('lightboxCaption').textContent = caption || ''; overlay.classList.add('active'); }
function closeLightbox() { const overlay = document.getElementById('lightbox'); if (overlay) overlay.classList.remove('active'); }

// ==================== 图表生成函数 ====================
function getModuleFigureHTML(moduleId) { const src = moduleFigures[moduleId]; if (!src) return ''; const title = textbookModules[moduleId] || ''; return `<div class="module-figure"><img src="${src}" alt="${title}" onclick="openLightbox('${src}','模块${moduleId.toUpperCase()}: ${title}')" loading="lazy"><div class="fig-caption">📷 ${moduleId.toUpperCase()}: ${title}</div></div>`; }

function generateAllModuleFigures(matchKey) {
  if (matchKey === '练习题库') return Object.values(practiceFigures).map(f => `<div class="module-figure"><img src="${f.path}" alt="模块${f.module} ${f.question}" onclick="openLightbox('${f.path}','模块${f.module.toUpperCase()} ${f.question}')" loading="lazy"><div class="fig-caption">📝 模块${f.module.toUpperCase()} ${f.question}</div></div>`).join('');
  if (matchKey === '延展阅读') return Object.values(lateExtensionFigures).map(f => `<div class="module-figure"><img src="${f.path}" alt="${f.page}" onclick="openLightbox('${f.path}','📖 ${f.page}')" loading="lazy"><div class="fig-caption">📖 ${f.page}</div></div>`).join('');
  if (matchKey === '补充材料') return Object.values(supplementFigures).map(f => `<div class="module-figure"><img src="${f.path}" alt="${f.page}" onclick="openLightbox('${f.path}','📋 ${f.page}')" loading="lazy"><div class="fig-caption">📋 ${f.page}</div></div>`).join('');
  const modIds = textbookMapping[matchKey]; if (!modIds || modIds.length === 0) return '';
  const figs = modIds.filter(id => moduleFigures[id]).map(id => getModuleFigureHTML(id)).join('');
  if (!figs.trim()) return ''; return figs;
}

// ==================== 综合浏览面板生成 ====================
function generateBrowsePanel(matchKey) {
  const modIds = textbookMapping[matchKey]; if (!modIds || modIds.length === 0) return '';
  const buttons = modIds.map(id => { const title = textbookModules[id]; if (!title) return ''; const hasFig = moduleFigures[id] ? ' has-fig' : ''; const onClick = hasFig ? `onclick="openLightbox('${moduleFigures[id]}','模块${id.toUpperCase()}: ${title}')"` : `onclick="document.getElementById('chatInput').value='查看模块${id.toUpperCase()}';sendMessage()"`; return `<button class="browse-btn${hasFig}" ${onClick} title="${title}">${id.toUpperCase()}</button>`; }).join('');
  if (!buttons.trim()) return '';
  return `<details class="browse-panel"><summary>🗂️ 浏览关联模块图表（${modIds.filter(id=>moduleFigures[id]).length}个有图）</summary><div class="browse-grid">${buttons}</div></details>`;
}

// ==================== 键盘快捷键 ====================
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { if (isProcessing) { e.preventDefault(); abortCurrentRequest(); showToast('⏹️ 已取消当前提问'); } else { closeLightbox(); } }
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('apiKeyInput').focus(); }
  if (e.ctrlKey && e.key === 'l') { e.preventDefault(); clearChatHistory(); showToast('🗑️ 聊天记录已清除'); }
});
