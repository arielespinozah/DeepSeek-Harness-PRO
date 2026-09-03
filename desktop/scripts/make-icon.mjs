/**
 * Generate the desktop app icon from the official fish logo source
 * (packages/client/ui-primitives/src/FishLogo.tsx). Emits build/icon.svg and,
 * when sharp is installed, the PNGs electron-builder consumes (it converts a
 * 512px PNG into the Windows .ico).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const outDir = fileURLToPath(new URL('../build', import.meta.url))
mkdirSync(outDir, { recursive: true })

const fishSource = readFileSync(join(root, 'packages/client/ui-primitives/src/FishLogo.tsx'), 'utf8')
const paths = [...fishSource.matchAll(/d="([^"]+)"/g)].map(match => match[1])
if (paths.length === 0) throw new Error('make-icon: no path data found in FishLogo.tsx')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#4D6BFE"/>
  <g transform="translate(256 256) scale(17.8) translate(-11.58 -8.52)" fill="#FFFFFF">
${paths.map(path => `    <path d="${path}"/>`).join('\n')}
  </g>
</svg>
`
writeFileSync(join(outDir, 'icon.svg'), svg)

try {
  const sharp = (await import('sharp')).default
  for (const size of [256, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(outDir, `icon-${size}.png`))
  }
  console.log('make-icon: icon.svg and PNGs written to apps/desktop/build')
} catch {
  console.log('make-icon: icon.svg written (install sharp to emit PNGs)')
}
