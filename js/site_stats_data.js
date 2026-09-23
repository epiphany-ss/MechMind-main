/* ============================================================
   「平台内容总览」页的内置内容（默认值）
   ------------------------------------------------------------
   用途：site_stats.html 不再把内容写死在 HTML 里，改为从这份数据渲染。
   这样页面上的每一条内容（标题 / 数字 / 清单条目 / 说明）都能在页面上
   直接编辑、增删、排序。

   数据流：
     1. 页面加载 → 先读服务端已存内容 GET /api/site-content
     2. 读不到（首次 / 离线 / 被清空）→ 用这份 SITE_STATS_DEFAULT
     3. 编辑模式下改的就是这个对象，保存时整体 POST 回服务端
     4. 服务端存到 sdata/site_content.json，对所有访客生效

   ⚠️ 这里只描述「平台内容总览」这一页的展示内容，不涉及知识网络数据。
      「学科知识点总览图 / 知识网络 / 351 节点课程框架」的源数据在
      personal_knowledge.html 内联的 FULL_COURSE 里，受 CLAUDE.md 最高
      优先级规则保护，本文件与它无关、也不得改动它。
   ============================================================ */
window.SITE_STATS_DEFAULT = {

  version: 1,

  /* ---- 顶部 Hero ---- */
  hero: {
    tag: 'PLATFORM OVERVIEW',
    title: '平台内容总览',
    desc: '一张页面看清「理论力学研究平台」的全部家底：题库有多少题、知识储备有多少节点、机构演示有多少台、核心功能有哪些，以及它们之间怎么连成一个学习闭环。',
    chips: [
      { text: '📝 596 道习题' },
      { text: '🕸️ 351 个知识节点' },
      { text: '⚙️ 9 台机构演示' },
      { text: '📚 4 篇教材' },
      { text: '🧩 35 个页面' }
    ]
  },

  /* ---- KPI 大数字（4 列 × 2 行）---- */
  kpis: [
    { value: '596',  label: '理论力学习题', sub: '静力学 / 运动学 / 动力学 / 分析力学', color: '#1a56db' },
    { value: '351',  label: '知识网络节点', sub: '配 549 条知识点连线',                  color: '#06b6d4' },
    { value: '373',  label: '教材配图',     sub: '覆盖 4 篇教材全部章节',               color: '#22c55e' },
    { value: '9',    label: '机构演示',     sub: '4 单机构 + 4 复合 + 1 连杆生成器',    color: '#f0a030' },
    { value: '6',    label: '虚拟展厅展品', sub: '分布在 4 个主题展馆',                 color: '#a855f7' },
    { value: '35',   label: '站点页面',     sub: '主平台 29 + 教材 4 + 题库 2',         color: '#ec4899' },
    { value: '4',    label: '大知识模块',   sub: '静力学 / 运动学 / 动力学 / 分析力学', color: '#14b8a6' },
    // 4 = AI 具备的能力类型数（解答问题 / 逐步推导 / 概念讲解 / 机构分析），
    // 这四项取自 ai_qa.html 里 AI 开场白的自述，sub 把这 4 项列出来让数字有出处。
    { value: '4', label: 'AI 智能问答', sub: '解答 · 推导 · 讲解 · 机构分析', color: '#6366f1' }
  ],

  /* ---- 正文各段（渲染顺序 = 数组顺序）---- */
  sections: [

    /* ========== 01 题库数据 ========== */
    {
      id: 'bank', kicker: '01 · Question Bank', icon: '📝', title: '题库数据',
      desc: '理论力学题库由独立服务器（8090 端口）承载，不受登录闸门管束，共 596 道精选习题，支持按模块、题型、难度三级筛选，逐步揭示答案与语音讲解。',
      blocks: [
        {
          type: 'bars', cols: 2,
          items: [
            { title: '📊 按知识模块分布', sub: '四大模块合计 596 题', unit: '题',
              rows: [
                { name: '动力学',   value: 206, c: ['#22c55e', '#4ade80'] },
                { name: '静力学',   value: 174, c: ['#06b6d4', '#22d3ee'] },
                { name: '运动学',   value: 162, c: ['#3b82f6', '#60a5fa'] },
                { name: '分析力学', value: 54,  c: ['#a855f7', '#c084fc'] }
              ] },
            { title: '🎯 按题型分布', sub: '四种题型，计算题占比最高', unit: '题',
              rows: [
                { name: '计算题', value: 246, c: ['#1a56db', '#3b82f6'] },
                { name: '判断题', value: 150, c: ['#0ea5e9', '#38bdf8'] },
                { name: '选择题', value: 114, c: ['#6366f1', '#818cf8'] },
                { name: '填空题', value: 86,  c: ['#8b5cf6', '#a78bfa'] }
              ] },
            { title: '📈 按难度分级', sub: '中等难度为主体，难题占比三分之一', unit: '题',
              rows: [
                { name: '中等', value: 253, c: ['#f0a030', '#fbbf24'] },
                { name: '困难', value: 206, c: ['#ef4444', '#f87171'] },
                { name: '简单', value: 137, c: ['#16a34a', '#4ade80'] }
              ] }
          ]
        },
        {
          type: 'stats', cols: 4,
          items: [
            { v: '240', s: '道', l: '带图 / 带媒体题目' },
            { v: '34',  s: '个', l: '知识点标签' }
          ]
        },
        {
          type: 'tags', title: '🧾 题库元数据字段', sub: '每道题携带的字段与可筛选维度',
          items: [
            { text: 'id 题号' }, { text: 'overview 题干' }, { text: 'subject 学科' },
            { text: 'category 模块' }, { text: 'knowledge_points 知识点' },
            { text: 'question_type 题型' }, { text: 'difficulty 难度' },
            { text: 'has_media 含媒体' }, { text: 'created / updated' }
          ]
        }
      ]
    },

    /* ========== 02 知识储备 ========== */
    {
      id: 'knowledge', kicker: '02 · Knowledge Base', icon: '📚', title: '知识储备内容',
      desc: '平台的知识储备由四层构成：一张 351 节点的学科地图、一套 四大篇目知识框架、四本 带图教材，以及一张贯通两者的 知识点链接表。',
      tone: 'white',
      blocks: [
        {
          type: 'stats', cols: 3,
          items: [
            { v: '351', l: '知识节点' },
            { v: '549', l: '节点连线' },
            { v: '6',   l: '知识域配色' }
          ]
        },
        {
          type: 'bars', cols: 2,
          items: [
            { title: '🕸️ 学科知识点总览图（知识网络）', sub: '恒定显示完整课程框架 · 固定学科地图，永远不变', unit: '个',
              rows: [
                { name: '概念', value: 260, c: ['#06b6d4', '#22d3ee'] },
                { name: '公式', value: 68,  c: ['#3b82f6', '#60a5fa'] },
                { name: '洞察', value: 23,  c: ['#a855f7', '#c084fc'] }
              ] },
            { title: '🔗 知识点关联关系', sub: '549 条连线按语义分为四类', unit: '条',
              rows: [
                { name: 'RELATED', value: 461, c: ['#1a56db', '#3b82f6'] },
                { name: '前置',    value: 57,  c: ['#06b6d4', '#22d3ee'] },
                { name: '适用',    value: 18,  c: ['#16a34a', '#4ade80'] },
                { name: '易混淆',  value: 13,  c: ['#ef4444', '#f87171'] }
              ] },
            { title: '🎓 学习状态分布', sub: '节点「掌握 / 熟悉 / 学习中」三档', unit: '个',
              rows: [
                { name: '熟悉',   value: 131, c: ['#f0a030', '#fbbf24'] },
                { name: '已掌握', value: 114, c: ['#16a34a', '#4ade80'] },
                { name: '学习中', value: 106, c: ['#6366f1', '#818cf8'] }
              ] }
          ]
        },
        {
          type: 'tags', title: '🎨 六色知识域', sub: '知识网络按六个知识域着色',
          items: [
            { text: '静力学 130',   style: 'background:#cffafe;color:#0e7490' },
            { text: '运动学 62',    style: 'background:#dbeafe;color:#1d4ed8' },
            { text: '动力学 64',    tone: 'g' },
            { text: '分析力学 43',  tone: 'p' },
            { text: '振动 40',      tone: 'r' },
            { text: '解题技巧 12',  tone: 'o' }
          ]
        },
        {
          type: 'stats', cols: 4,
          items: [
            { v: '4',   l: '篇目模块' },
            { v: '24',  l: '主题分类' },
            { v: '70',  l: '知识点链接' },
            { v: '172', l: '锚点跳转' }
          ]
        },
        {
          type: 'table', cols: 2,
          items: [
            { title: '🧠 知识框架（四大篇目）', sub: '从模块 → 主题 → 知识点，可逐层展开并跳转到教材对应小节',
              head: ['篇目', '主题数', '代表性内容'],
              rows: [
                [{ t: '📐 第一篇 静力学' },   { t: '5' }, { t: '力的基本概念 · 力的运算与简化 · 约束与受力分析 · 力系平衡 · 摩擦' }],
                [{ t: '🏃 第二篇 运动学' },   { t: '4' }, { t: '点的运动学 · 刚体基本运动 · 点的合成运动 · 刚体平面运动' }],
                [{ t: '🚀 第三篇 动力学' },   { t: '4' }, { t: '质点动力学 · 动力学定理 · 刚体动力学 · 动静法' }],
                [{ t: '🧮 第四篇 分析力学' }, { t: '5' }, { t: '虚位移原理 · 拉格朗日方程 · 哈密顿原理 · 碰撞 · 振动' }]
              ] },
            { title: '📖 四篇教材与配图', sub: '每篇教材为独立页面，正文知识点均配有解析图 / 海报 / 图谱',
              head: ['教材', '入口'],
              rows: [
                [{ t: '📐 静力学' },   { t: 'textbooks/statics/textbook.html',    href: 'textbooks/statics/textbook.html' }],
                [{ t: '🏃 运动学' },   { t: 'textbooks/kinematics/index.html',    href: 'textbooks/kinematics/index.html' }],
                [{ t: '🚀 动力学' },   { t: 'textbooks/dynamics/index.html',      href: 'textbooks/dynamics/index.html' }],
                [{ t: '🧮 分析力学' }, { t: 'textbooks/analytical/index.html',    href: 'textbooks/analytical/index.html' }]
              ] }
          ]
        },
        {
          type: 'bars', cols: 2,
          items: [
            { title: '🖼️ 四篇教材配图数', sub: '按篇统计的解析图 / 海报 / 图谱数量', unit: '张',
              rows: [
                { name: '静力学',   value: 295, c: ['#06b6d4', '#22d3ee'] },
                { name: '运动学',   value: 30,  c: ['#3b82f6', '#60a5fa'] },
                { name: '分析力学', value: 29,  c: ['#a855f7', '#c084fc'] },
                { name: '动力学',   value: 19,  c: ['#22c55e', '#4ade80'] }
              ] }
          ]
        },
        {
          type: 'tags', title: '🖼️ 配图类型', sub: '教材里的图都长什么样',
          items: [
            { text: '知识总图' }, { text: '解题指南' }, { text: '概念解析图' },
            { text: '公式图解' }, { text: '学习海报' }, { text: '知识图谱' }
          ]
        },
        {
          type: 'note', title: '⚠️ 受保护区域说明',
          html: '<b>「学科知识点总览图」= 知识网络 = 351 个课程节点的完整课程框架</b>（个人知识网络页顶部）——三者是同一个东西，一体保护。它是一张固定的学科地图，永远不变；个人学习相关的变化只体现在下面的「复习知识点网络图」中。'
        }
      ]
    },

    /* ========== 03 机构演示 ========== */
    {
      id: 'mechanisms', kicker: '03 · Mechanisms', icon: '⚙️', title: '机构运动学演示',
      desc: '共 9 台可运行的机构：4 台单一机构（可拖拽动点、滚轮缩放、按键切换、实时速度/加速度矢量）、4 台复合机构总成，外加 1 个「手绘曲线 → 自动生成连杆机构」的逆向综合工具。',
      blocks: [
        {
          type: 'cards', cols: 4,
          items: [
            { icon: '🎛️', title: '曲柄导杆机构', desc: '曲柄转动带动导杆摆动，展示移动副与转动副的组合运动，可实时观察导杆角速度变化。', tag: '单机构' },
            { icon: '🔧', title: '曲柄滑块机构', desc: '曲柄 → 连杆 → 滑块的经典转换，滑块位移/速度/加速度随曲柄转角实时可视化。', tag: '单机构' },
            { icon: '📐', title: '正弦机构',     desc: 'Scotch Yoke，把匀速转动精确转换为正弦往复运动，是简谐运动的机构原型。', tag: '单机构' },
            { icon: '🔄', title: '行星减速机构', desc: '太阳轮输入、内齿圈固定，行星轮自转 + 公转，展示啮合约束、传动比与复合运动。', tag: '单机构' }
          ]
        },
        {
          type: 'cards', cols: 4, panel: true,
          title: '🧩 复合机构演示库',
          sub: '由已有机构模块组成机械上合理的复合总成，强调输入轴 → 减速级 → 分流轴 → 执行机构的传动关系',
          items: [
            { title: '双滑块并联',     desc: '并联复合：一个输入分流驱动两组滑块同步运动。', tag: '并联复合', tone: 'p', href: 'complex_dual_slider.html' },
            { title: '串联复合机构',   desc: '串联复合：滑块输出再驱动导杆，形成两级传动链。', tag: '串联复合', tone: 'p', href: 'complex_series_slider_guide.html' },
            { title: '双正弦合成',     desc: '两台正弦机构交叉布置，演示运动的合成与分解。', tag: '运动合成', tone: 'p', href: 'complex_dual_scotch.html' },
            { title: '双导杆科氏对比', desc: '双导杆对照，直观比较科氏加速度的有无与方向。', tag: '科氏对比', tone: 'p', href: 'complex_dual_guide.html' }
          ]
        },
        {
          type: 'cards', cols: 2,
          items: [
            { title: '🗂️ 进入复合机构总成库', desc: '查看全部复合演示案例与传动说明。', href: 'complex_mechanism_demo.html' },
            { title: '✏️ 手绘曲线 → 连杆机构生成器', desc: '在画布上随手画一条曲线，自动综合出能走出这条轨迹的四连杆机构。', href: 'linkage-generator.html' }
          ]
        },
        {
          type: 'stats', cols: 3, panel: true,
          title: '🏛️ 虚拟课程展厅',
          sub: '全屏 3D 展厅，可用鼠标环视、前进/跳跃，点击展品查看说明',
          items: [
            { v: '4', l: '主题展馆' },
            { v: '6', l: '力学结构展品' },
            { v: '3', l: '展示维度' }
          ]
        },
        {
          type: 'tags', title: '🏛️ 展厅构成',
          items: [
            { text: '📜 学科历史馆' }, { text: '🏫 课程介绍馆' },
            { text: '👨‍🏫 师资风采馆' }, { text: '🏆 荣誉奖项馆' },
            { text: '桁架桥', tone: 'o' }, { text: '斜拉桥', tone: 'o' },
            { text: '曲柄滑块', tone: 'o' }, { text: '齿轮传动', tone: 'o' },
            { text: '单摆', tone: 'o' }, { text: '简支梁受集中力', tone: 'o' }
          ]
        }
      ]
    },

    /* ========== 04 核心功能 ========== */
    {
      id: 'features', kicker: '04 · Core Features', icon: '🧩', title: '核心功能模块',
      desc: '首页「平台核心功能」区共 8 张功能卡，对应四条主路（学知识 / 看机构 / 问 AI / 做题）；此外还有学习沉淀、账户体系、社区与运维等配套模块。',
      tone: 'white',
      blocks: [
        {
          type: 'table',
          head: ['#', '功能', '入口', '能做什么'],
          widths: ['52px', '', '200px', ''],
          rows: [
            [{ t: '1' }, { t: '📝 理论力学题库', bold: true }, { t: 'localhost:8090', href: 'http://localhost:8090' }, { t: '596 道习题，四大模块 + 四题型 + 三难度筛选，点题逐步揭示答案、解析与语音讲解' }],
            [{ t: '2' }, { t: '⚙️ 机构运动演示', bold: true }, { t: 'mechanism.html', href: 'mechanism.html' }, { t: '4 种交互式机构动画，拖拽动点、实时速度/加速度矢量可视化' }],
            [{ t: '3' }, { t: '🤖 AI 智能体问答', bold: true }, { t: 'ai_qa.html', href: 'ai_qa.html' }, { t: '知识库模式（默认，离线可用）／ AI 增强模式（填 API Key），支持公式渲染与逐步推导' }],
            [{ t: '4' }, { t: '🧠 知识框架梳理', bold: true }, { t: 'knowledge_framework.html', href: 'knowledge_framework.html' }, { t: '四大篇目 → 24 主题 → 70 知识点，可逐层展开并锚点跳转到教材对应小节' }],
            [{ t: '5' }, { t: '🌳 知识图谱（3D）', bold: true }, { t: 'mindmap.html', href: 'mindmap.html' }, { t: '一棵会生长的三维知识树，351 个知识点长成枝叶；拖动旋转、点枝干展开、点叶片看详情' }],
            [{ t: '6' }, { t: '👤 个人学习中心', bold: true }, { t: 'account.html', href: 'account.html' }, { t: '学习进度、收藏题目、答题统计、个性化路径推荐；管理员多出「管理员操作」四张卡' }],
            [{ t: '7' }, { t: '🕸️ 个人知识网络', bold: true }, { t: 'personal_knowledge.html', href: 'personal_knowledge.html' }, { t: '顶部恒定 351 节点学科地图；下方自主添加知识点、建立关联、看复习网络图与重点推荐复习' }],
            [{ t: '8' }, { t: '🔍 功能搜索', bold: true }, { t: 'search.html', href: 'search.html' }, { t: '全站知识内容检索，快速定位知识点、习题与演示内容' }]
          ]
        },
        {
          type: 'cards', cols: 4,
          title: '配套模块', sub: '主功能之外的支撑页面',
          items: [
            { icon: '💬', title: '问题探讨',     desc: '论坛式讨论区，支持发帖、评论、图片上传，是首页「问题探讨预览」的去向。', tag: '进入论坛 →', href: 'forum.html' },
            { icon: '📒', title: '学习记录',     desc: '登录、做题、AI 问答等行为自动沉淀为学习记录与笔记，可查看单条笔记详情。', tag: '查看记录 →', href: 'learning_notes.html' },
            { icon: '🎯', title: '我的薄弱点',   desc: '根据答题与复习数据生成重点推荐复习列表，可标记「准确 / 不准确」回写学习记忆，形成闭环。', tag: '查看薄弱点 →', href: 'weaknesses.html' },
            { icon: '📊', title: '用户活跃状态', desc: '统计用户登录、活跃时长、行为分布，用于观察平台使用情况。', tag: '查看活跃 →', href: 'activity.html' },
            { icon: '⬆️', title: '题目上传',     desc: '工程力学题库的题目录入入口，支持题干、选项、解析与配图上传。', tag: '上传题目 →', href: 'upload.html' },
            { icon: '🏛️', title: '虚拟展厅',     desc: '全屏 3D 展馆导览，含四馆内容与六件力学结构展品。', tag: '进入展厅 →', href: 'hall.html' },
            { icon: 'ℹ️', title: '关于 / 帮助',  desc: '平台介绍、使用帮助、意见反馈与联系方式，构成完整的站点支撑页。', tag: '了解平台 →', href: 'about.html' },
            { icon: '🗺️', title: '展示顺序总览', desc: '网站展示顺序与流程的思维导图页，串起主流程、四条主路与主要分支。', tag: '查看流程 →', href: '网站展示顺序与流程思维导图.html' }
          ]
        }
      ]
    },

    /* ========== 05 学习闭环 ========== */
    {
      id: 'loop', kicker: '05 · Learning Loop', icon: '🔁', title: '贯穿全站的学习闭环',
      desc: '做题 → 问 AI → 沉淀成笔记与薄弱点 → 在知识网络里看见 → 复习 → 又成为新一轮的薄弱点输入。',
      blocks: [
        {
          type: 'steps',
          items: [
            { no: '①', title: '登录闸门',     desc: '未登录 → 跳账户页登录/注册，成功后跳回原页面；已登录直接放行。', tone: '' },
            { no: '②', title: '四条主路',     desc: '学知识 · 看机构 · 问 AI · 做题——首页 8 张功能卡即四个功能区的总入口。', tone: '' },
            { no: '③', title: '学习沉淀',     desc: '做题、问 AI、复习行为自动汇入个人学习记忆，实时同步到服务器。', tone: 'cool' },
            { no: '④', title: '个人知识网络', desc: '节点列表 + 351 节点学科总览图 + 复习网络图 + 重点推荐复习。评分分 A/B/C 档，显示密度不同。', tone: 'cool' },
            { no: '⑤', title: '薄弱点反馈',   desc: '判断「准确 / 不准确」→ 回写第 ③ 步，闭环收口，进入下一轮。', tone: 'hot' }
          ]
        }
      ]
    },

    /* ========== 06 运行方式 ========== */
    {
      id: 'runtime', kicker: '06 · Runtime', icon: '🚀', title: '运行方式与技术构成',
      desc: '推荐用 http://localhost:8080 访问（服务器模式，功能完整）；本地文件方式可运行但学习数据不会同步到服务端。',
      tone: 'white',
      blocks: [
        {
          type: 'ports',
          items: [
            { num: ':8080', role: '主平台 · 需登录', tone: 'dark',
              lines: ['全部页面与静态资源', '账户注册 / 登录 / 权限', '活跃记录、学习记忆接口', '知识网络、用户数据接口', '论坛帖子 / 评论 / 上传', 'TTS 语音与讲解接口'] },
            { num: ':8090', role: '理论力学题库 · 开放免登录', tone: 'dark',
              lines: ['纯题库应用，不受登录闸门管束', '596 道题与筛选检索', '答案逐步揭示与解析', '语音讲解', '跨端口识别当前用户并记录'] },
            { num: '本地', role: '一键启动', tone: 'green',
              lines: ['清理端口占用', '启动题库 8090', '启动主平台 8080', '自动打开首页'] }
          ]
        },
        {
          type: 'table',
          head: ['组成', '数量', '说明'],
          widths: ['', '120px', ''],
          rows: [
            [{ t: 'HTML 页面' },      { t: '35', bold: true }, { t: '主平台 29 个功能页 + 教材 4 篇 + 题库 2 个' }],
            [{ t: 'JavaScript 模块' }, { t: '16', bold: true }, { t: '含知识网络数据、学习记忆、导航、认证、三维演示引擎等' }],
            [{ t: '样式表' },          { t: '3',  bold: true }, { t: 'common.css（公共变量与组件）· style.css · ai_qa.css' }],
            [{ t: '后端服务' },        { t: '1',  bold: true }, { t: 'server.py，约 1247 行，承载 8080 / 8090 两端' }],
            [{ t: '数学公式渲染' },    { t: 'KaTeX', bold: true }, { t: '本地内置，离线可用，支持公式与化学式' }],
            [{ t: '三维渲染' },        { t: 'Three.js', bold: true }, { t: '本地内置，用于虚拟展厅与知识图谱' }],
            [{ t: '数据接口分组' },    { t: '7 组', bold: true }, { t: 'forum · knowledge-network · learning-memory · userdata · activity · account · tts' }]
          ]
        }
      ]
    },

    /* ========== 07 页面清单 ========== */
    {
      id: 'pages', kicker: '07 · Page Index', icon: '🗂️', title: '全站页面清单',
      desc: '以下是平台全部页面的逐条索引，点击名称可直接前往。',
      blocks: [
        {
          type: 'table', panel: true,
          items: [
            { title: '主平台功能页（29 个）', sub: '除账户页、展厅模板预览页、题库外，均受登录闸门保护',
              head: ['', '页面', '文件', '用途'], widths: ['34px', '230px', '230px', ''],
              rows: [
                [{ t: '🏠' }, { t: '首页', href: 'index.html' }, { t: 'index.html', code: true }, { t: '落地页：顶栏 · Hero 轮播 · 数据条 · 8 张功能卡 · 四区预览 · 虚拟展厅 · 问题探讨 · 页脚' }],
                [{ t: '📊' }, { t: '平台内容总览', href: 'site_stats.html' }, { t: 'site_stats.html', code: true }, { t: '本页：全站统计数据与总体框架' }],
                [{ t: '🏛️' }, { t: '虚拟展厅', href: 'hall.html' }, { t: 'hall.html', code: true }, { t: '全屏 3D 展厅：四馆导览 + 六件展品 + 前进/跳跃' }],
                [{ t: '🎞️' }, { t: '展厅模板预览', href: 'course_hall_preview.html' }, { t: 'course_hall_preview.html', code: true }, { t: '虚拟课程展厅的模板参考页' }],
                [{ t: '⚙️' }, { t: '机构运动演示', href: 'mechanism.html' }, { t: 'mechanism.html', code: true }, { t: '四机构交互式仿真 + 复合机构总成入口 + 连杆生成器入口' }],
                [{ t: '🧩' }, { t: '复合机构演示库', href: 'complex_mechanism_demo.html' }, { t: 'complex_mechanism_demo.html', code: true }, { t: '四个复合机构案例的索引页' }],
                [{ t: '🔀' }, { t: '双滑块并联', href: 'complex_dual_slider.html' }, { t: 'complex_dual_slider.html', code: true }, { t: '并联复合机构演示' }],
                [{ t: '🔗' }, { t: '串联复合机构', href: 'complex_series_slider_guide.html' }, { t: 'complex_series_slider_guide.html', code: true }, { t: '串联复合机构演示' }],
                [{ t: '〰️' }, { t: '双正弦合成', href: 'complex_dual_scotch.html' }, { t: 'complex_dual_scotch.html', code: true }, { t: '双正弦机构运动合成演示' }],
                [{ t: '🌀' }, { t: '双导杆科氏对比', href: 'complex_dual_guide.html' }, { t: 'complex_dual_guide.html', code: true }, { t: '科氏加速度对比演示' }],
                [{ t: '✏️' }, { t: '连杆机构生成器', href: 'linkage-generator.html' }, { t: 'linkage-generator.html', code: true }, { t: '手绘任意曲线 → 自动生成四连杆机构' }],
                [{ t: '🤖' }, { t: 'AI 智能问答', href: 'ai_qa.html' }, { t: 'ai_qa.html', code: true }, { t: '知识库模式 / AI 增强模式，公式识别与逐步推理，可「整理本次学习」' }],
                [{ t: '🧠' }, { t: '知识框架', href: 'knowledge_framework.html' }, { t: 'knowledge_framework.html', code: true }, { t: '四大篇目知识树，逐层展开 + 锚点跳转教材' }],
                [{ t: '🌳' }, { t: '知识图谱', href: 'mindmap.html' }, { t: 'mindmap.html', code: true }, { t: '三维知识树，351 个知识点长成枝叶' }],
                [{ t: '🕸️' }, { t: '个人知识网络', href: 'personal_knowledge.html' }, { t: 'personal_knowledge.html', code: true }, { t: '节点列表 + 351 节点总览图 + 复习网络图 + 重点推荐复习' }],
                [{ t: '🎯' }, { t: '我的薄弱点', href: 'weaknesses.html' }, { t: 'weaknesses.html', code: true }, { t: '重点推荐复习与「准确 / 不准确」反馈回写' }],
                [{ t: '📒' }, { t: '学习记录', href: 'learning_notes.html' }, { t: 'learning_notes.html', code: true }, { t: '学习记录与笔记列表' }],
                [{ t: '📄' }, { t: '学习笔记详情', href: 'learning_note_detail.html' }, { t: 'learning_note_detail.html', code: true }, { t: '单条学习笔记的详情视图' }],
                [{ t: '📈' }, { t: '用户活跃状态', href: 'activity.html' }, { t: 'activity.html', code: true }, { t: '登录、活跃时长与行为分布统计' }],
                [{ t: '👤' }, { t: '个人账户 / 个人中心', href: 'account.html' }, { t: 'account.html', code: true }, { t: '登录注册 ⇄ 个人中心；管理员多出四张管理卡' }],
                [{ t: '💬' }, { t: '问题探讨', href: 'forum.html' }, { t: 'forum.html', code: true }, { t: '论坛：发帖、评论、图片上传' }],
                [{ t: '⬆️' }, { t: '题目上传', href: 'upload.html' }, { t: 'upload.html', code: true }, { t: '题库题目录入' }],
                [{ t: '📝' }, { t: '题库站内主页', href: 'questions.html' }, { t: 'questions.html', code: true }, { t: '工程力学题库的站内主页（现以独立 8090 题库应用为主入口）' }],
                [{ t: '🔍' }, { t: '全站搜索', href: 'search.html' }, { t: 'search.html', code: true }, { t: '知识内容检索' }],
                [{ t: 'ℹ️' }, { t: '关于平台', href: 'about.html' }, { t: 'about.html', code: true }, { t: '平台介绍与建设历程' }],
                [{ t: '❓' }, { t: '使用帮助', href: 'help.html' }, { t: 'help.html', code: true }, { t: '操作指引与常见问题' }],
                [{ t: '💌' }, { t: '意见反馈', href: 'feedback.html' }, { t: 'feedback.html', code: true }, { t: '意见提交' }],
                [{ t: '📞' }, { t: '联系我们', href: 'contact.html' }, { t: 'contact.html', code: true }, { t: '联系方式' }],
                [{ t: '🗺️' }, { t: '展示顺序与流程', href: '网站展示顺序与流程思维导图.html' }, { t: '网站展示顺序与流程思维导图.html', code: true }, { t: '主流程、四条主路与主要分支的思维导图' }]
              ] },
            { title: '教材页（4 篇）', sub: '静力学 / 运动学 / 动力学 / 分析力学',
              head: ['', '教材', '文件', '特点'], widths: ['34px', '230px', '300px', ''],
              rows: [
                [{ t: '📐' }, { t: '静力学', href: 'textbooks/statics/textbook.html' }, { t: 'textbooks/statics/textbook.html', code: true }, { t: '配图最丰富（295 张），含摩擦、桁架、物体系平衡等专题与实践图' }],
                [{ t: '🏃' }, { t: '运动学', href: 'textbooks/kinematics/index.html' }, { t: 'textbooks/kinematics/index.html', code: true }, { t: '四个主题模块，30 张解析图，含合成运动与平面运动' }],
                [{ t: '🚀' }, { t: '动力学', href: 'textbooks/dynamics/index.html' }, { t: 'textbooks/dynamics/index.html', code: true }, { t: '19 张知识图谱与解题指南' }],
                [{ t: '🧮' }, { t: '分析力学', href: 'textbooks/analytical/index.html' }, { t: 'textbooks/analytical/index.html', code: true }, { t: '29 张图解，覆盖虚位移、拉格朗日、哈密顿、碰撞与振动' }]
              ] },
            { title: '题库应用（独立 8090）', sub: '工程力学（二）',
              head: ['', '页面', '文件', '说明'], widths: ['34px', '230px', '300px', ''],
              rows: [
                [{ t: '📝' }, { t: '题库主页', href: '题库/工程力学（二）/index.html' }, { t: '题库/工程力学（二）/index.html', code: true }, { t: '596 道题的筛选、作答、揭示答案与语音讲解' }],
                [{ t: '⬆️' }, { t: '题库上传页', href: '题库/工程力学（二）/upload.html' }, { t: '题库/工程力学（二）/upload.html', code: true }, { t: '题库内的题目上传入口' }]
              ] }
          ]
        }
      ]
    }
  ],

  /* ---- 页脚 ---- */
  footer: {
    title: '长沙理工大学 · 理论力学研究平台',
    lines: [
      '本页为平台内容总览，数据取自站点实际页面与数据文件（题库索引、知识网络数据、教材目录、机构演示与展厅清单）。',
      '题库 596 题 · 知识网络 351 节点 549 连线 · 教材配图 373 张 · 机构演示 9 台 · 站点页面 35 个'
    ]
  }
};
