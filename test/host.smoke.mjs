/**
 * Host-half smoke test.
 *
 * Mounts `lib/index.js` against a minimal stand-in for the `fs` and `webServer`
 * services, then drives the bridge route exactly as the browser half does. This
 * covers the parts that are easy to get silently wrong: encoding detection on
 * real GBK/UTF-16/damaged files, chapter splitting, and the request guards.
 *
 * Run: node test/host.smoke.mjs
 */
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply, SETTINGS_NS } from '../lib/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, 'fixtures')

/** Minimal `ctx.fs` adapter over node:fs, shaped like the real service. */
const fsService = {
  async resolve(path) {
    return { displayPath: resolve(path) }
  },
  async stat(target) {
    try {
      const info = statSync(target.displayPath)
      return {
        type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other',
        size: info.isFile() ? info.size : undefined,
      }
    } catch (error) {
      return undefined
    }
  },
  async readBytes(target, signal, maxBytes) {
    const data = readFileSync(target.displayPath)
    // The real service refuses rather than truncates; mirror that so a cap that
    // is bypassed in the plugin cannot pass this suite.
    if (typeof maxBytes === 'number' && data.length > maxBytes) {
      const error = new Error('FS_TOO_LARGE: file exceeds the byte cap')
      error.code = 'FS_TOO_LARGE'
      throw error
    }
    return new Uint8Array(data)
  },
  async readText(target) {
    return readFileSync(target.displayPath, 'utf8')
  },
  async listDir(target) {
    return readdirSync(target.displayPath, { withFileTypes: true }).map((entry) => {
      const child = join(target.displayPath, entry.name)
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        target: { displayPath: child },
        size: entry.isFile() ? statSync(child).size : 0,
      }
    })
  },
}

let route = null
const ctx = {
  fs: fsService,
  webServer: {
    register(candidate) {
      route = candidate
      return () => {
        route = null
      }
    },
  },
  effect(callback) {
    const dispose = callback()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
  get(name) {
    if (name === 'fs') return fsService
    if (name === 'webServer') return ctx.webServer
    return undefined
  },
  logger: { info() {} },
}

apply(ctx, {})

/** Drive the bridge route with a JSON payload. */
function request(payload, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    const req = new EventEmitter()
    req.method = options.method || 'POST'
    req.headers = Object.assign({ host: '127.0.0.1:3080' }, options.headers)
    req.destroy = () => {}
    const res = {
      status: 0,
      writeHead(status) {
        this.status = status
      },
      end(data) {
        let parsed = null
        try {
          parsed = JSON.parse(data)
        } catch (error) {
          parsed = { raw: data }
        }
        resolvePromise({ status: this.status, body: parsed })
      },
    }
    Promise.resolve(route.handler(req, res)).catch(rejectPromise)
    req.emit('data', body)
    req.emit('end')
  })
}

const results = []
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail })
}

check('settings namespace is exported', SETTINGS_NS === 'dsh-moyu-reader', SETTINGS_NS)
check('registers the bridge route', route !== null && route.path === '/dsh-moyu-reader/api', route && route.path)
check('route is exact-match', route !== null && route.kind === 'exact', route && route.kind)

// --- encoding detection + chapter splitting on real fixtures -----------------
const encodings = [
  ['utf8-novel.txt', 'utf-8'],
  ['utf8-bom-novel.txt', 'utf-8 (BOM)'],
  ['utf16le-novel.txt', 'utf-16le'],
  ['gbk-novel.txt', 'gb18030'],
  ['utf8-damaged-novel.txt', 'utf-8'],
]
for (const [file, expected] of encodings) {
  const res = await request({ method: 'open', args: { path: join(fixtures, file) } })
  const book = res.body && res.body.book
  const got = book ? book.encoding.split('（')[0] : '(no book: ' + JSON.stringify(res.body) + ')'
  check(`${file}: encoding ${expected}`, got === expected, got)
  check(`${file}: 3 chapters`, book && book.chapters.length === 3, book && book.chapters.length)
  check(`${file}: body is readable CJK`, /第一章 开始/.test(res.body.text || ''), '')
}

// --- chapter listing and navigation -----------------------------------------
const opened = await request({ method: 'open', args: { path: join(fixtures, 'gbk-novel.txt') } })
const titles = (opened.body.book.chapters || []).map((chapter) => chapter.title).join(' | ')
check('chapter titles parsed', titles === '第一章 开始 | 第二章 继续 | 番外一', titles)

const second = await request({ method: 'chapter', args: { path: join(fixtures, 'gbk-novel.txt'), index: 1 } })
check('chapter 1 is the second chapter', second.body.index === 1 && /第二章 继续/.test(second.body.text), second.body.title)

const clamped = await request({ method: 'chapter', args: { path: join(fixtures, 'gbk-novel.txt'), index: 999 } })
check('out-of-range index clamps to the last chapter', clamped.body.index === 2, clamped.body.index)

// --- search ------------------------------------------------------------------
const search = await request({ method: 'search', args: { path: join(fixtures, 'gbk-novel.txt'), query: '正文内容' } })
check('search hits every chapter', search.body.hits.length === 3, search.body.hits.length)
check('search snippet is populated', (search.body.hits[0] || {}).snippet.length > 0, '')

// --- shelf listing -----------------------------------------------------------
const listing = await request({ method: 'list', args: { path: fixtures, all: false } })
check('list returns the fixture files', listing.body.ok === true && listing.body.files.length === 5, listing.body.files && listing.body.files.length)
check('list hides dotfiles and reports a parent', listing.body.parent.length > 0, listing.body.parent)

const missing = await request({ method: 'list', args: { path: join(fixtures, 'nope.txt') } })
check('missing path is an error, not a crash', missing.body.ok === false && /不存在/.test(missing.body.error), missing.body.error)

// --- reading state -----------------------------------------------------------
await request({ method: 'state', args: { action: 'progress', path: join(fixtures, 'gbk-novel.txt'), chapterIndex: 2, scrollRatio: 0.5 } })
const reopened = await request({ method: 'open', args: { path: join(fixtures, 'gbk-novel.txt') } })
check('progress is restored on reopen', reopened.body.chapterIndex === 2, reopened.body.chapterIndex)

const bookmarked = await request({ method: 'state', args: { action: 'bookmark', path: join(fixtures, 'gbk-novel.txt'), chapterIndex: 1, text: 'x' } })
check('bookmark is stored', bookmarked.body.bookmarks.length === 1, bookmarked.body.bookmarks.length)
const unbookmarked = await request({ method: 'state', args: { action: 'unbookmark', path: join(fixtures, 'gbk-novel.txt'), index: 0 } })
check('bookmark is removed', unbookmarked.body.bookmarks.length === 0, unbookmarked.body.bookmarks.length)

const stateGet = await request({ method: 'state', args: { action: 'get' } })
check('recent list records the opened book', stateGet.body.recent.length > 0, stateGet.body.recent.length)

// --- request guards ----------------------------------------------------------
const wrongMethod = await request({ method: 'open' }, { method: 'GET' })
check('GET is rejected with 405', wrongMethod.status === 405, wrongMethod.status)

const crossOrigin = await request({ method: 'open' }, { headers: { origin: 'http://evil.example' } })
check('cross-origin POST is rejected with 403', crossOrigin.status === 403, crossOrigin.status)

const sameOrigin = await request({ method: 'state', args: { action: 'get' } }, { headers: { origin: 'http://127.0.0.1:3080' } })
check('same-origin POST is accepted', sameOrigin.status === 200, sameOrigin.status)

const unknown = await request({ method: 'nope' })
check('unknown method is rejected with 400', unknown.status === 400, unknown.status)

const malformed = await new Promise((resolvePromise) => {
  const req = new EventEmitter()
  req.method = 'POST'
  req.headers = { host: '127.0.0.1:3080' }
  req.destroy = () => {}
  const res = {
    status: 0,
    writeHead(status) {
      this.status = status
    },
    end() {
      resolvePromise(this.status)
    },
  }
  Promise.resolve(route.handler(req, res))
  req.emit('data', Buffer.from('{not json', 'utf8'))
  req.emit('end')
})
check('malformed JSON is rejected with 400', malformed === 400, malformed)

// --- settings namespace ------------------------------------------------------
{
  const installs = []
  let settingsRoute = null
  const settingsService = {
    installSection(...args) {
      installs.push(args)
    },
  }
  const ctx2 = {
    fs: fsService,
    webServer: {
      register(candidate) {
        settingsRoute = candidate
        return () => {}
      },
    },
    effect(callback) {
      const dispose = callback()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    get(name) {
      if (name === 'fs') return fsService
      if (name === 'webServer') return ctx2.webServer
      if (name === 'settings') return settingsService
      return undefined
    },
    logger: { info() {} },
  }
  apply(ctx2, { fontSize: 22 })

  check('registers exactly one settings namespace', installs.length === 1, installs.length)
  const [owner, namespace, schema, entry, hooks] = installs[0] || []
  check('namespace is the package name', namespace === 'dsh-moyu-reader', namespace)
  check('owner is the mounting context', owner === ctx2, '')
  check('schema declares all fifteen settings', Object.keys((schema && schema.dict) || {}).length === 15, Object.keys((schema && schema.dict) || {}).length)
  check('base layer carries the composition config', entry && entry.fontSize === 22, entry && entry.fontSize)
  check('hooks expose a source sink', typeof (hooks && hooks.setSource) === 'function', '')

  // The bridge must read the live source per request, not the composition base.
  const previousRoute = route
  route = settingsRoute
  const before = await request({ method: 'open', args: { path: join(fixtures, 'utf8-novel.txt') } })
  check('open succeeds under the composition config', before.body.ok !== false, JSON.stringify(before.body).slice(0, 120))

  // `maxBookBytes` is the one setting the host acts on, and its schema floor is
  // 1 MiB — so observing it needs a book larger than that. Built fresh here
  // because a cached book short-circuits the size check.
  const bigDir = mkdtempSync(join(tmpdir(), 'dnr-big-'))
  const bigPath = join(bigDir, 'big.txt')
  const filler = '这是一段用来把文件撑到一兆字节以上的中文正文内容，用于验证读取上限。\n'
  writeFileSync(bigPath, '第一章 大文件\n' + filler.repeat(60000) + '第二章 结束\n' + filler.repeat(60000), 'utf8')
  const bigBytes = statSync(bigPath).size
  check('the oversized fixture exceeds 1 MiB', bigBytes > 1048576, bigBytes)

  hooks.setSource(() => ({ maxBookBytes: 1048576 }))
  const limited = await request({ method: 'open', args: { path: bigPath } })
  check(
    'a book above the live limit is refused',
    limited.body.ok === false,
    JSON.stringify(limited.body).slice(0, 140),
  )

  hooks.setSource(() => ({ maxBookBytes: 100663296 }))
  const restored = await request({ method: 'open', args: { path: bigPath } })
  check('the bridge recovers when the source allows it again', restored.body.ok !== false, JSON.stringify(restored.body).slice(0, 140))

  route = previousRoute
  rmSync(bigDir, { recursive: true, force: true })
}

// --- report ------------------------------------------------------------------
let failed = 0
for (const result of results) {
  if (!result.ok) failed++
  const mark = result.ok ? 'PASS' : 'FAIL'
  const detail = result.ok || result.detail === '' ? '' : `  (${result.detail})`
  console.log(`${mark}  ${result.label}${detail}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
