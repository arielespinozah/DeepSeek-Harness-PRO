/**
 * Deploy a production copy of the dsh CLI tree (with the web profile and the
 * built frontend) into apps/desktop/server, which electron-builder ships as
 * an extraResource and main.js boots on an OS-assigned port.
 *
 * `pnpm deploy --legacy` installs the CLI's production dependencies into the
 * output tree but leaves the workspace packages' own transitive dependencies
 * reachable only inside the .pnpm virtual store (junctions on Windows, which
 * also cannot ship inside a packaged app). The steps below turn the output
 * into a self-contained real-file tree:
 *
 *  1. flatten the virtual store into a flat top-level node_modules (one real
 *     directory per package, no junctions, no cycles — parent-walk resolution
 *     from any package finds every other package at the root),
 *  2. complete the closure from the workspace sources for whatever the deploy
 *     omitted (peers and `link:` vendored packages).
 */
import { execFileSync } from 'node:child_process'
import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const outDir = join(appDir, 'server')

/** Copy one store package to a flat destination, skipping any nested node_modules. */
function copyFlat(source, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(source)) {
    if (entry === 'node_modules') continue
    cpSync(join(source, entry), join(dest, entry), { recursive: true })
  }
}

/**
 * Replace the .pnpm virtual store with a flat top-level node_modules: every
 * package the store holds becomes a real directory at the root, so Node's
 * parent walk resolves any import from anywhere in the tree. Existing
 * junctions at the top level are removed first; the store is deleted at the
 * end.
 */
function flattenVirtualStore(nodeModulesDir) {
  const pnpmDir = join(nodeModulesDir, '.pnpm')
  if (!existsSync(pnpmDir)) return
  const placePackage = (name, source) => {
    const dest = join(nodeModulesDir, ...name.split('/'))
    let realSource = source
    let stat = lstatSync(source)
    // Store entries are occasionally junctions (pnpm links); follow them to a
    // real directory. A junction whose target no longer resolves is skipped —
    // the same package is placed from its own real store entry instead.
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(source)
      const resolved = isAbsolute(target) ? target : join(dirname(source), target)
      if (!existsSync(resolved)) return
      realSource = resolved
      stat = lstatSync(realSource)
      if (stat.isSymbolicLink()) return
    }
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true, maxRetries: 5 })
    mkdirSync(dirname(dest), { recursive: true })
    copyFlat(realSource, dest)
  }
  for (const entry of readdirSync(pnpmDir)) {
    const entryModules = join(pnpmDir, entry, 'node_modules')
    if (!existsSync(entryModules)) continue
    for (const first of readdirSync(entryModules)) {
      if (first.startsWith('.')) continue
      if (first.startsWith('@')) {
        const scopeDir = join(entryModules, first)
        if (!lstatSync(scopeDir).isDirectory()) continue
        for (const name of readdirSync(scopeDir)) {
          if (name.startsWith('.')) continue
          placePackage(`${first}/${name}`, join(scopeDir, name))
        }
      } else {
        placePackage(first, join(entryModules, first))
      }
    }
  }
  rmSync(pnpmDir, { recursive: true, force: true, maxRetries: 5 })
}

/** Remove every remaining junction/symlink under `dir`; the flat copy already placed real packages. */
function removeAllLinks(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let stat
    try {
      stat = lstatSync(full)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) {
      rmSync(full, { recursive: true, force: true, maxRetries: 5 })
    } else if (stat.isDirectory()) {
      removeAllLinks(full)
    }
  }
}

/** Text-file suffixes worth scrubbing. */
const SCRUB_EXTENSIONS = /\.(js|mjs|cjs|json|map|css|html|yml|yaml|ts|d\.ts|md|svg)$/

/**
 * Replace the build machine's absolute repository path in every text file of
 * the deployed tree. tsdown embeds the source path in CSS-module region
 * comments and sourcemap `sourcesContent`; shipping it would leak the
 * developer's username to every user. A neutral token keeps the bytes valid.
 */
function scrubBuildPaths(dir) {
  const forward = repoRoot.replace(/\\/g, '/')
  const backward = repoRoot.replace(/\//g, '\\')
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      let stat
      try {
        stat = lstatSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        if (entry !== 'node_modules' || current === dir) walk(full)
        continue
      }
      if (!SCRUB_EXTENSIONS.test(entry)) continue
      try {
        const text = readFileSync(full, 'utf8')
        if (!text.includes(forward) && !text.includes(backward)) continue
        const scrubbed = text.replaceAll(forward, 'dsh').replaceAll(backward, 'dsh')
        writeFileSync(full, scrubbed)
      } catch {
        // Binary or unreadable files are skipped; nothing to scrub there.
      }
    }
  }
  walk(dir)
}

/**
 * Complete the deployed dependency closure. Legacy deploy omits peer
 * dependencies and vendored `link:` workspace packages, so walk every
 * manifest reachable from the app manifest (dependencies plus peers, the same
 * closure the harness heals its profile fallback from) and copy the built
 * artifacts of any missing package from its workspace source.
 */
function completeClosure(nodeModulesDir) {
  const workspacePackages = new Map()
  for (const rootDir of ['packages', 'vendor', 'apps', 'native']) {
    const root = join(repoRoot, rootDir)
    if (!existsSync(root)) continue
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (!lstatSync(full).isDirectory()) continue
        if (entry === 'node_modules' || entry === '.pnpm') continue
        const manifestPath = join(full, 'package.json')
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
          if (typeof manifest.name === 'string' && !workspacePackages.has(manifest.name)) {
            workspacePackages.set(manifest.name, { dir: full, manifest })
          }
        }
        walk(full)
      }
    }
    walk(root)
  }

  const appManifest = JSON.parse(readFileSync(join(outDir, 'package.json'), 'utf8'))
  const visited = new Set()
  const queue = [{ dir: outDir, manifest: appManifest }]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const dep of [
      ...Object.keys(next.manifest.dependencies ?? {}),
      ...Object.keys(next.manifest.peerDependencies ?? {}),
    ]) {
      if (visited.has(dep)) continue
      const depPath = join(nodeModulesDir, ...dep.split('/'))
      if (existsSync(depPath)) {
        visited.add(dep)
        const depManifestPath = join(depPath, 'package.json')
        if (existsSync(depManifestPath)) {
          queue.push({ dir: depPath, manifest: JSON.parse(readFileSync(depManifestPath, 'utf8')) })
        }
        continue
      }
      const source = workspacePackages.get(dep)
      if (source === undefined) continue
      visited.add(dep)
      mkdirSync(depPath, { recursive: true })
      for (const entry of readdirSync(source.dir)) {
        if (entry === 'node_modules' || entry === 'tests') continue
        cpSync(join(source.dir, entry), join(depPath, entry), { recursive: true })
      }
      queue.push({ dir: depPath, manifest: source.manifest })
    }
  }
}

console.log(`prepare-server: deploying @deepseek-ai/dsh (production) into ${outDir}`)
rmSync(outDir, { recursive: true, force: true, maxRetries: 5 })
mkdirSync(outDir, { recursive: true })
const quoted = outDir.replace(/"/g, '\\"')
const command = `pnpm --filter @deepseek-ai/dsh deploy --prod --legacy "${quoted}"`
execFileSync(command, {
  cwd: repoRoot,
  stdio: 'inherit',
  // One quoted string is passed through cmd.exe so the deploy target path
  // survives its spaces (a shell-less .cmd spawn fails with EINVAL).
  shell: true,
  env: { ...process.env },
})

console.log('prepare-server: flattening the virtual store')
flattenVirtualStore(join(outDir, 'node_modules'))
console.log('prepare-server: completing the dependency closure')
completeClosure(join(outDir, 'node_modules'))
console.log('prepare-server: removing leftover junctions')
removeAllLinks(join(outDir, 'node_modules'))
// pnpm build artifacts carry the build machine's absolute paths (the store
// dir, the workspace root); the packaged app must not leak them.
for (const artifact of ['.modules.yaml', '.bin']) {
  rmSync(join(outDir, 'node_modules', artifact), { recursive: true, force: true, maxRetries: 5 })
}
console.log('prepare-server: scrubbing build paths')
scrubBuildPaths(outDir)
console.log('prepare-server: done')
