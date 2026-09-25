/* Build a side-by-side sheet from the treatment comparison frames.
   Pure local work — costs nothing, and lets Jayden judge the three
   treatments at the size they will actually be seen. */
import { createRequire } from 'node:module'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const sharp = require('E:/Workspaces/odndr-web/node_modules/sharp')

const DIR = join(process.cwd(), 'images', 'shoot', 'compare')
const want = ['a-bold', 'b-legible']
const tiles = []
for (const n of want) {
  const f = join(DIR, n + '.png')
  if (!existsSync(f)) { console.log('missing', n); continue }
  tiles.push({ input: await sharp(f).resize(620, 775).toBuffer(), left: tiles.length * 620, top: 0 })
}
if (tiles.length) {
  await sharp({ create: { width: 620 * tiles.length, height: 775, channels: 3, background: '#ffffff' } })
    .composite(tiles).webp({ quality: 90 }).toFile(join(DIR, '_sheet-4x5.webp'))
  console.log('4:5 sheet written with', tiles.length, 'frames')
}
const wide = join(DIR, 'c-bold-banner.png')
if (existsSync(wide)) {
  await sharp(wide).resize(1240).webp({ quality: 90 }).toFile(join(DIR, '_sheet-banner.webp'))
  console.log('banner frame written')
}
