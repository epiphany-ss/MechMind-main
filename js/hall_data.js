/* ============================================================================
   虚拟展厅 · 内容数据
   ----------------------------------------------------------------------------
   展厅里出现的每一段文字都在这个文件里。改内容不用碰 3D 代码（js/hall_engine.js）。

   【待填】= 占位标记，替换成真实内容即可；整条不需要就直接删掉那一项。

   展馆数量、名称、颜色、挂在哪面墙，都在下面 halls 数组里改。
   wall 可选值：'north' | 'east' | 'south' | 'west'（四面墙各挂一个展馆）

   区块（blocks）支持的类型：
     paragraph  纯段落        { type:'paragraph', title, text }
     list       键值信息表     { type:'list',      title, items:[{ k, v }] }
     stats      数字速览卡     { type:'stats',     title, items:[{ num, unit, label }] }
     timeline   时间轴         { type:'timeline',  title, items:[{ year, title, text }] }
     cards      人物/特色卡    { type:'cards',     title, items:[{ icon, title, subtitle, body, tags:[] }] }
     medals     荣誉奖牌墙     { type:'medals',    title, items:[{ name, level, year, org }] }
   ============================================================================ */

window.HALL_DATA = {

  /* 展厅门头信息 */
  brand: {
    tag: 'VIRTUAL COURSE HALL',
    title: '虚拟展厅',
    subtitle: '一门课的完整档案 · 走进来慢慢看',
    hallName: '理论力学 · 虚拟展厅'
  },

  /* 进门处的引导语（中央展台上方那块牌子的内容） */
  intro: {
    title: '理论力学 · 虚拟展厅',
    lines: [
      'WASD 走动 · 鼠标环视 · 走到展馆前按 E 查看',
      '右侧目录可直接前往任意展馆'
    ]
  },

  /* ===== 展馆 ===== */
  halls: [
    {
      id: 'history',
      icon: '📜',
      name: '学科历史馆',
      subtitle: '这门学科从哪里来',
      plaque: '源远流长',        // 展板上方那块中式匾额上的字（四字最合式样）
      color: '#3b82f6',
      wall: 'north',
      blocks: [
        {
          type: 'paragraph',
          title: '学科溯源',
          text: '【待填】理论力学作为力学学科的基础分支，其形成与发展过程。'
        },
        {
          type: 'timeline',
          title: '发展时间轴',
          items: [
            { year: '【待填年份】', title: '【待填事件标题】', text: '【待填】这一节点发生了什么。' },
            { year: '【待填年份】', title: '【待填事件标题】', text: '【待填】' },
            { year: '【待填年份】', title: '【待填事件标题】', text: '【待填】' }
          ]
        },
        {
          type: 'cards',
          title: '重要人物 / 里程碑',
          items: [
            { icon: '👤', title: '【待填姓名】', subtitle: '【待填身份/年代】', body: '【待填】主要贡献。', tags: ['【待填标签】'] },
            { icon: '👤', title: '【待填姓名】', subtitle: '【待填身份/年代】', body: '【待填】主要贡献。', tags: ['【待填标签】'] }
          ]
        }
      ]
    },

    {
      id: 'course',
      icon: '📖',
      name: '课程介绍馆',
      subtitle: '这是一门什么样的课',
      plaque: '格物致理',
      color: '#22c55e',
      wall: 'east',
      blocks: [
        {
          type: 'list',
          title: '课程基本信息',
          items: [
            { k: '课程名称', v: '理论力学 / Theoretical Mechanics' },
            { k: '课程性质', v: '【待填】如：专业基础必修课' },
            { k: '面向专业', v: '【待填】' },
            { k: '开课学期', v: '【待填】' },
            { k: '学分 / 学时', v: '【待填】' },
            { k: '教材', v: '【待填】' }
          ]
        },
        {
          type: 'stats',
          title: '课程速览',
          items: [
            { num: '【待填】', unit: '', label: '学分' },
            { num: '【待填】', unit: '', label: '总学时' },
            { num: '【待填】', unit: '', label: '知识节点' },
            { num: '【待填】', unit: '', label: '开设年数' }
          ]
        },
        {
          type: 'paragraph',
          title: '课程简介',
          text: '【待填】这门课讲什么、为什么学、学完能做什么。'
        },
        {
          type: 'cards',
          title: '课程特色',
          items: [
            { icon: '🧠', title: '【待填特色标题】', body: '【待填】', tags: [] },
            { icon: '🔬', title: '【待填特色标题】', body: '【待填】', tags: [] },
            { icon: '📝', title: '【待填特色标题】', body: '【待填】', tags: [] }
          ]
        }
      ]
    },

    {
      id: 'faculty',
      icon: '🎓',
      name: '师资风采馆',
      subtitle: '这门课由谁来上',
      plaque: '桃李满门',
      color: '#a855f7',
      wall: 'south',
      offset: 18,          // 沿墙偏移：把南墙正中让给大门（不想偏移就删掉这行）
      blocks: [
        {
          type: 'paragraph',
          title: '教学团队',
          text: '【待填】课程组整体介绍：一共有几位老师、分工、团队特色。'
        },
        {
          type: 'cards',
          title: '任课老师',
          items: [
            { icon: '👩🏫', title: '【待填姓名】', subtitle: '【待填职称，如 教授 · 博士生导师】', body: '研究方向：【待填】\n主讲内容：【待填】', tags: ['课程负责人'] },
            { icon: '👨🏫', title: '【待填姓名】', subtitle: '【待填职称】', body: '研究方向：【待填】\n主讲内容：【待填】', tags: [] },
            { icon: '👩🏫', title: '【待填姓名】', subtitle: '【待填职称】', body: '研究方向：【待填】\n主讲内容：【待填】', tags: [] },
            { icon: '👨🏫', title: '【待填姓名】', subtitle: '【待填职称】', body: '研究方向：【待填】\n主讲内容：【待填】', tags: [] }
          ]
        }
      ]
    },

    {
      id: 'honor',
      icon: '🏆',
      name: '荣誉奖项馆',
      subtitle: '一路拿下的每一份认可',
      plaque: '功崇惟志',
      color: '#f0a030',
      wall: 'west',
      blocks: [
        {
          type: 'medals',
          title: '荣誉墙',
          items: [
            { name: '【待填奖项名称】', level: '【待填级别，如 国家级 / 省级 / 校级】', year: '【待填年份】', org: '【待填颁奖单位】' },
            { name: '【待填奖项名称】', level: '【待填级别】', year: '【待填年份】', org: '【待填颁奖单位】' },
            { name: '【待填奖项名称】', level: '【待填级别】', year: '【待填年份】', org: '【待填颁奖单位】' },
            { name: '【待填奖项名称】', level: '【待填级别】', year: '【待填年份】', org: '【待填颁奖单位】' }
          ]
        },
        {
          type: 'timeline',
          title: '获奖年表',
          items: [
            { year: '【待填年份】', title: '【待填奖项】', text: '【待填】获奖说明。' },
            { year: '【待填年份】', title: '【待填奖项】', text: '【待填】' }
          ]
        },
        {
          type: 'paragraph',
          title: '教学成果',
          text: '【待填】课程建设、教改项目、学生竞赛指导等方面的成果。'
        }
      ]
    }
  ]
};
