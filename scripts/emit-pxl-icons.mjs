import { writeFileSync } from 'node:fs'
import { gridToSvg, svgToDataUri } from '@pxlkit/core'
import { Arrow, Dice, Flag, Lightning, QuestMap, Ring, Scroll, Shield, SpellBook, Star, Sword, Target, Trophy } from '@pxlkit/gamification'
import { Bug, CheckCircle } from '@pxlkit/feedback'
import { ChatBubble } from '@pxlkit/social'
import { ArrowRight, Clock, Gear, Lock, Pause, Search } from '@pxlkit/ui'

const ICONS = {
  flag: Flag,
  search: Search,
  arrow: Arrow,
  bug: Bug,
  map: QuestMap,
  gear: Gear,
  chat: ChatBubble,
  star: Star,
  scroll: Scroll,
  target: Target,
  sword: Sword,
  trophy: Trophy,
  shield: Shield,
  clock: Clock,
  lightning: Lightning,
  book: SpellBook,
  pause: Pause,
  ring: Ring,
  check: CheckCircle,
  arrowRight: ArrowRight,
  lock: Lock,
  dice: Dice,
}

// 解析捉虫、闯关地图、力学沙盒三枚是手绘 16×16，其余仍用 Pxlkit。
// 沙盒单独用 bars，gear 留给段位「机构拆解者」。
function blank(n) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => '.'))
}
function paint(draw) {
  const g = blank(16)
  const set = (x, y, ch) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = ch
  }
  const line = (x0, y0, x1, y1, ch) => {
    let x = x0
    let y = y0
    const dx = Math.abs(x1 - x0)
    const sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0)
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    while (true) {
      set(x, y, ch)
      if (x === x1 && y === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
    }
  }
  draw(set, line)
  return g.map((row) => row.join(''))
}
const CUSTOM = {
  bug: {
    name: 'beetle',
    size: 16,
    category: 'custom',
    palette: { L: '#8A8A8A', D: '#4A4A4A', A: '#A3A3A3' },
    tags: ['bug'],
    grid: paint((set) => {
      set(5, 0, 'L')
      set(6, 1, 'L')
      set(10, 0, 'D')
      set(9, 1, 'D')
      const body = [
        [2, 6, 9],
        [3, 5, 10],
        [4, 4, 11],
        [5, 3, 12],
        [6, 3, 12],
        [7, 3, 12],
        [8, 3, 12],
        [9, 3, 12],
        [10, 4, 11],
        [11, 4, 11],
        [12, 5, 10],
        [13, 6, 9],
      ]
      for (const [y, x0, x1] of body) {
        for (let x = x0; x <= x1; x++) set(x, y, x < 8 ? 'L' : 'D')
      }
      set(1, 4, 'A')
      set(2, 5, 'A')
      set(14, 4, 'A')
      set(13, 5, 'A')
      set(0, 8, 'A')
      set(1, 8, 'A')
      set(2, 8, 'A')
      set(15, 8, 'A')
      set(14, 8, 'A')
      set(13, 8, 'A')
      set(3, 11, 'A')
      set(2, 11, 'A')
      set(1, 12, 'A')
      set(12, 11, 'A')
      set(13, 11, 'A')
      set(14, 12, 'A')
    }),
  },
  map: {
    name: 'folded-map',
    size: 16,
    category: 'custom',
    palette: { K: '#111111', Y: '#FFE9A8', D: '#E2C36A', R: '#FF5A5A', B: '#3D7EFF' },
    tags: ['map'],
    grid: paint((set) => {
      for (let y = 2; y <= 13; y++) {
        for (let x = 1; x <= 14; x++) set(x, y, 'Y')
      }
      for (let x = 1; x <= 14; x++) { set(x, 2, 'K'); set(x, 13, 'K') }
      for (let y = 2; y <= 13; y++) { set(1, y, 'K'); set(14, y, 'K') }
      for (let y = 3; y <= 12; y++) set(7, y, 'D')
      set(11, 3, 'K')
      set(12, 3, 'D')
      set(13, 3, 'D')
      set(12, 4, 'K')
      set(13, 4, 'D')
      set(13, 5, 'K')
      set(3, 5, 'B')
      set(4, 5, 'B')
      set(4, 6, 'B')
      set(5, 6, 'B')
      set(5, 7, 'B')
      set(6, 7, 'B')
      set(10, 8, 'R')
      set(12, 8, 'R')
      set(11, 9, 'R')
      set(10, 10, 'R')
      set(12, 10, 'R')
    }),
  },
  bars: {
    name: 'sand-box',
    size: 16,
    category: 'custom',
    palette: { K: '#111111', S: '#F6C445', H: '#E09A2B', W: '#C47A3A', D: '#8B5A2B' },
    tags: ['sandbox'],
    grid: paint((set) => {
      for (let y = 2; y <= 13; y++) {
        for (let x = 1; x <= 14; x++) set(x, y, 'W')
      }
      for (let x = 1; x <= 14; x++) { set(x, 2, 'K'); set(x, 13, 'K') }
      for (let y = 2; y <= 13; y++) { set(1, y, 'K'); set(14, y, 'K') }
      for (let y = 3; y <= 7; y++) {
        for (let x = 2; x <= 13; x++) set(x, y, 'S')
      }
      for (let x = 1; x <= 14; x++) set(x, 8, 'K')
      for (let x = 2; x <= 13; x++) set(x, 11, 'D')
      set(4, 4, 'H')
      set(8, 5, 'H')
      set(11, 4, 'H')
      set(6, 6, 'H')
      set(10, 6, 'H')
    }),
  },
}

for (const icon of Object.values(CUSTOM)) {
  if (icon.grid.length !== 16 || icon.grid.some((row) => row.length !== 16)) {
    throw new Error(icon.name + ' grid is not 16x16')
  }
}

const src = {}
for (const [key, icon] of Object.entries({ ...ICONS, ...CUSTOM })) {
  src[key] = svgToDataUri(gridToSvg(icon))
}

for (const key of ['bug', 'map', 'bars']) {
  console.log(key + '\n' + CUSTOM[key].grid.join('\n'))
}

const json = JSON.stringify(src)
writeFileSync(new URL('../arcade-ui/src/pxlIcons.js', import.meta.url),
  '/* 由 scripts/emit-pxl-icons.mjs 生成。bug / map / bars 为手绘；其余图标来自 Pxlkit，https://pxlkit.xyz */\n' +
  'export const pxlSrc = ' + json + '\n')

writeFileSync(new URL('../js/arcade_pxl_icons.js', import.meta.url),
  '/* 由 scripts/emit-pxl-icons.mjs 生成。bug / map / bars 为手绘；其余 Icons by Pxlkit https://pxlkit.xyz */\n' +
  '(function (root) {\n' +
  '  var SRC = ' + json + ';\n' +
  '  function img(key, size) {\n' +
  '    var uri = SRC[key];\n' +
  '    if (!uri) return "";\n' +
  '    var n = size || 22;\n' +
  '    return \'<img class="ac-pxl" alt="" width="\' + n + \'" height="\' + n + \'" src="\' + uri + \'">\';\n' +
  '  }\n' +
  '  function fill() {\n' +
  '    var nodes = document.querySelectorAll("img[data-pxl]");\n' +
  '    for (var i = 0; i < nodes.length; i++) {\n' +
  '      var uri = SRC[nodes[i].getAttribute("data-pxl")];\n' +
  '      if (uri) nodes[i].src = uri;\n' +
  '    }\n' +
  '    if (!document.getElementById("pxl-credit")) {\n' +
  '      var p = document.createElement("p");\n' +
  '      p.id = "pxl-credit";\n' +
  '      p.className = "ac-pxl-credit";\n' +
  '      p.innerHTML = \'Icons by <a href="https://pxlkit.xyz" target="_blank" rel="noreferrer">Pxlkit</a>\';\n' +
  '      document.body.appendChild(p);\n' +
  '    }\n' +
  '  }\n' +
  '  root.PxlIcons = { src: SRC, img: img };\n' +
  '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);\n' +
  '  else fill();\n' +
  '})(window);\n')

console.log('pxl icons', Object.keys(src).length)
