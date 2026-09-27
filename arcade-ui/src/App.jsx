import { useEffect, useState } from 'react'
import { pxlSrc } from './pxlIcons.js'

function PxlMark({ name, size = 22 }) {
  return <img className="ac-pxl" alt="" width={size} height={size} src={pxlSrc[name]} />
}

const GAMES = [
  { key: 'guess', href: 'arcade_guess.html', tone: 'bg-[#FFE14A]', name: '猜机构', icon: 'search',
    span: 'min-[900px]:col-span-2',
    desc: '播放一个去掉全部标注的机构动画，四选一猜它是哪种机构，并追问科氏加速度的有无。' },
  { key: 'vector', href: 'arcade_vector.html', tone: 'bg-[#3D7EFF]', name: '矢量竞速', icon: 'arrow',
    span: '',
    desc: '定格某一瞬时，限时点出该点速度或加速度的正确方向。连击越长分越高。' },
  { key: 'bug', href: 'arcade_bug.html', tone: 'bg-[#FF5A5A]', name: '解析捉虫', icon: 'bug',
    span: '',
    desc: '给一段题干和一段解析，判断这段解析是不是这道题的。干扰项来自同章节的其它题。' },
  { key: 'quest', href: 'arcade_quest.html', tone: 'bg-[#FFE14A]', name: '闯关地图', icon: 'map',
    span: '',
    desc: '静力学 / 运动学 / 动力学 / 分析力学四章，每关三题，全对通关，按用时评星。' },
  { key: 'sandbox', href: 'arcade_sandbox.html', tone: 'bg-[#7DDE55]', name: '力学沙盒', icon: 'bars',
    span: '',
    desc: '调四根杆的长度，实时看连杆点画出什么轨迹。任务卡：让它走直线、走圆、近似停歇。' },
  { key: 'talk', href: 'arcade_talk.html', tone: 'bg-[#7DDE55]', name: '时空对话', icon: 'chat',
    span: 'min-[900px]:col-span-3',
    desc: '与牛顿、欧拉、拉格朗日、科里奥利对话，让他们出题考你。' },
]

const READY = { guess: 1, vector: 1, bug: 1, quest: 1, sandbox: 1, talk: 1 }

function progressLine(key, p) {
  const g = (p.games && p.games[key]) || {}
  switch (key) {
    case 'guess':
    case 'vector':
    case 'bug': {
      const acc = g.total ? Math.round(g.correct / g.total * 100) : 0
      return g.plays
        ? `已玩 ${g.plays} 局 · 最高 ${g.best || 0} 分 · 正确率 ${acc}%`
        : '还没玩过'
    }
    case 'quest': {
      let stars = 0
      Object.keys(g.stars || {}).forEach((k) => { stars += g.stars[k] })
      const cleared = Object.keys(g.cleared || {}).length
      return cleared ? `已通关 ${cleared} 关 · 共 ${stars} 颗星` : '还没开始闯关'
    }
    case 'sandbox': {
      const n = Object.keys(g.tasks || {}).filter((k) => g.tasks[k]).length
      return n ? `已完成 ${n} 个任务` : '还没完成任务卡'
    }
    case 'talk':
      return (g.met && g.met.length) ? `已结识 ${g.met.length} 位` : '还没开始对话'
    default:
      return ''
  }
}

const press = 'nb-press transition-[transform,box-shadow] duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#111] active:translate-x-1 active:translate-y-1 active:shadow-none'

export default function App() {
  const [progress, setProgress] = useState(null)
  const [barEl, setBarEl] = useState(null)

  useEffect(() => {
    const arcade = window.Arcade
    if (!arcade) return undefined
    const pull = () => setProgress(arcade.progress())
    pull()
    const store = window.UserStore
    if (store && store.ready) {
      let alive = true
      store.ready().then(() => { if (alive) pull() })
      return () => { alive = false }
    }
    return undefined
  }, [])

  useEffect(() => {
    if (!barEl || !window.Arcade) return
    window.Arcade.mountLevelBar(barEl)
  }, [barEl, progress])

  const p = progress

  return (
    <>
      <nav className="sticky top-0 z-[100] flex h-16 items-center border-b-[3px] border-[#111] bg-[#FFFDF6]">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-6">
          <a className={`${press} inline-flex items-center gap-1.5 rounded-[6px] border-2 border-[#111] bg-[#FFE14A] px-2.5 py-1 text-[1.05em] font-extrabold text-[#111] no-underline shadow-[3px_3px_0_#111]`} href="arcade.html"><PxlMark name="flag" size={18} />力学游乐园</a>
          <a className={`${press} inline-flex items-center rounded-[6px] border-2 border-[#111] bg-white px-3 py-1.5 text-[0.9em] font-bold text-[#111] no-underline shadow-[3px_3px_0_#111]`} href="index.html">← 返回主平台</a>
        </div>
      </nav>

      <div className="mx-auto max-w-[1320px] px-6 pt-7 pb-[72px]">
        <section className="mb-8 grid items-stretch gap-5 min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
          <header className="rounded-[6px] border-[3px] border-[#111] bg-white p-6 shadow-[4px_4px_0_#111]">
            <h1 className="m-0 text-[2.15rem] leading-none font-extrabold tracking-tight text-[#111]">力学游乐园</h1>
            <p className="mt-3 mb-0 max-w-[36em] text-[0.95rem] leading-relaxed text-[#3d4a57]">把平台里的机构动画、596 道题和知识框架，变成能玩的形态。全部内容取自站内已有资料。</p>
            <p className="mt-3 mb-0 text-[0.95rem]"><a className="font-extrabold text-[#111]" href="arcade_duel.html">联机对战</a><span className="text-[#3d4a57]"> · 矢量竞速、解析捉虫按用时和对错结算血量</span></p>
          </header>
          <div ref={setBarEl} className="ac-ticket" />
        </section>

        <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-3">
          {GAMES.map((g) => {
            const ready = !!READY[g.key]
            const meta = p ? (ready ? progressLine(g.key, p) : '敬请期待') : ''
            const card = `${g.span} block overflow-hidden rounded-[6px] border-[3px] border-[#111] bg-white text-inherit no-underline shadow-[4px_4px_0_#111] ${ready ? press : 'cursor-default opacity-55'}`
            const body = (
              <>
                <div className={`flex items-center gap-3 border-b-[3px] border-[#111] px-5 py-3.5 text-[#111] ${g.tone}`}>
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-[#111] bg-white"><PxlMark name={g.icon} size={22} /></span>
                  <h3 className="m-0 text-[1.15em] font-extrabold">{g.name}</h3>
                </div>
                <div className="px-5 py-4">
                  <p className="m-0 text-[0.9em] leading-relaxed text-[#3d4a57]">{g.desc}</p>
                  <div className="mt-3.5 text-[0.8em] font-bold text-[#1a56db]">{meta}</div>
                </div>
              </>
            )
            return ready
              ? <a key={g.key} className={card} href={g.href}>{body}</a>
              : <div key={g.key} className={card}>{body}</div>
          })}
        </div>
      </div>
    </>
  )
}
