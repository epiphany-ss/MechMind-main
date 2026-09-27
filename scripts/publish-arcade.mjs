import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const built = fileURLToPath(new URL('../arcade-static/index.html', import.meta.url))
const target = fileURLToPath(new URL('../arcade.html', import.meta.url))
const html = readFileSync(built, 'utf8')
const note = '<!-- 由 npm run build:arcade 从 arcade-ui/ 生成。源码改 arcade-ui/，不要手改本文件。本页不引 js/auth.js。 -->\n'
writeFileSync(target, html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + note))
console.log('wrote', target)
