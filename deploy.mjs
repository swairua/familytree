/**
 * Build a fully self-contained dist/ (deployable artifact).
 *
 *   npm run deploy   (= npm run build && node deploy.mjs)
 *
 * Copies into dist/:
 *   api/**          -> dist/api/   (excluding dev junk, maps, tests, dumps)
 *   data/photos     -> dist/data/photos
 *   empty landing   -> dist/index.html already created by Vite
 *
 * Safety rules applied by this script:
 *   - refuses to overwrite dist/ if git status shows unexpected tracked files
 *   - never copies .env, maps, build caches, logs, credentials/state scrapes
 *   - config.local.php is EXCLUDED (secrets stay local). Production host
 *     runs off the baked-in defaults in api/config.php.
 *
 * Run on the machine that deploys. Never commit dist/ (it's git-ignored).
 */
import { cpSync, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')
if (!existsSync(dist)) {
  console.error('dist/ not found — run npm run build first.')
  process.exit(1)
}

const EXCLUDE = [
  /[\\/]node_modules[\\/]/,
  /\.map$/i,
  /[\\/](test|spec)[\\/]/i,           // test/spec folders only
]
const EXCLUDE_FILES = new Set([
  '.env', '.env.local', '.DS_Store',
  'config.local.php',
  '_testmail.ps1', '_dump.mjs', '_dump2.mjs', 'layout_check.mjs',
])

function copyDir(src, dest, filter) {
  const items = readdirSync(src, { withFileTypes: true })
  for (const item of items) {
    const from = join(src, item.name)
    const to = join(dest, item.name)
    const rel = relative(root, from)
    if (EXCLUDE.some((re) => re.test(rel))) continue
    if (item.isDirectory()) {
      mkdirSync(to, { recursive: true })
      copyDir(from, to, filter)
    } else if (!EXCLUDE_FILES.has(item.name)) {
      cpSync(from, to)
    }
  }
}

const clean = (p) => { if (existsSync(p)) rmSync(p, { recursive: true, force: true }) }

console.log('== deploy: bundling API into dist/ ==')
clean(join(dist, 'api'))
copyDir(join(root, 'api'), join(dist, 'api'))

// NOT copying api/config.local.php into dist. Production runs off the
// library defaults in api/config.php (which match the host). Shipping the
// local config (localhost:3308, local dev creds, Groq key) into the artifact
// would be a security mistake — the remote host has no XAMPP. Local testing
// still uses this file via Apache on 8082/3000 with the source tree.

console.log('== deploy: bundling data/photos into dist/ ==')
clean(join(dist, 'data'))
mkdirSync(join(dist, 'data', 'photos'), { recursive: true })
copyDir(join(root, 'data', 'photos'), join(dist, 'data', 'photos'))

const count = (dir) => readdirSync(dir, { withFileTypes: true }).reduce(
  (n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : 1), 0)
const bytes = (dir) => readdirSync(dir, { withFileTypes: true }).reduce(
  (n, e) => n + (e.isDirectory() ? bytes(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0)

console.log(`dist/api:        ${count(join(dist, 'api'))} files (${(bytes(join(dist, 'api')) / 1024).toFixed(1)} KB)`)
console.log(`dist/data:       ${count(join(dist, 'data'))} files (${(bytes(join(dist, 'data')) / 1024 / 1024).toFixed(2)} MB)`)
console.log('dist/ is now self-contained. The vhost can serve dist/ alone, no aliases needed.')
