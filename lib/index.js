/**
 * dsh-moyu-reader — Host half.
 *
 * Responsibilities:
 *   1. Own the plugin's settings namespace (`dsh-moyu-reader`) so every option
 *      is editable from Settings → 插件 → 插件配置 and persisted by the settings
 *      file provider. The composition row's `config:` becomes the `base` layer.
 *   2. Serve a small JSON bridge over the web server for the browser half, which
 *      cannot reach the host filesystem on its own.
 *   3. Read, decode and chapter-split local `.txt` novels.
 *
 * The bridge is a single POST endpoint. It is intentionally read-only with
 * respect to the filesystem: the only writes this plugin performs are the
 * settings the user makes in the UI.
 *
 * @module dsh-moyu-reader
 */
import z from 'schemastery'

/** Cordis plugin name; matches the package name and the client module id. */
export const name = 'dsh-moyu-reader'

/** The settings namespace this plugin registers and owns. */
export const SETTINGS_NS = 'dsh-moyu-reader'

/**
 * Host services this plugin cannot work without. `fs` reads the books and
 * `webServer` carries the browser bridge; waiting for both is deliberate, so a
 * non-web profile parks the row instead of mounting a half-working plugin.
 */
export const inject = ['fs', 'webServer']

/**
 * The plugin's settings schema.
 *
 * Every field is user-editable at runtime. `applies: 'live'` (the default) means
 * a change takes effect without a restart: the reader re-reads its typography
 * from the bound settings scope on each render, and the launchers react to the
 * `enabled` switch immediately.
 */
export const Config = z.object({
  enabled: z
    .boolean()
    .default(true)
    .description('总开关。关闭后阅读器的所有入口、标签页与老板键立即失效。'),
  defaultDir: z
    .string()
    .default('')
    .description('书架默认打开的目录；留空表示当前工作目录。'),
  hotkey: z
    .string()
    .default('mod+`')
    .description('老板键。支持 mod+`、ctrl+shift+h、alt+q 等写法；mod 在 Windows/Linux 上是 Ctrl，在 macOS 上是 Cmd。'),
  hotkeyHidesSidebar: z
    .boolean()
    .default(true)
    .description('老板键是否收起整个右侧栏。关闭则只收起阅读器所在的标签页。'),
  launcherFooter: z.boolean().default(true).description('在左侧栏底部显示 📖 入口。'),
  launcherHeader: z.boolean().default(true).description('在会话标题栏显示 📖 入口。'),
  floatingBall: z.boolean().default(false).description('显示右下角悬浮球。'),
  theme: z
    .union([z.const('auto'), z.const('sepia'), z.const('dark'), z.const('light')])
    .default('auto')
    .description('阅读配色：auto 跟随 DSH 主题，或固定为护眼 / 夜间 / 明亮。'),
  fontSize: z.number().min(12).max(30).step(1).default(17).description('正文字号（px）。'),
  lineHeight: z.number().min(1.3).max(2.8).step(0.05).default(1.95).description('行距倍数。'),
  family: z
    .union([z.const('serif'), z.const('sans'), z.const('kai')])
    .default('serif')
    .description('正文字体：宋体 / 黑体 / 楷体。'),
  indent: z.boolean().default(true).description('首行缩进两个字。'),
  justify: z.boolean().default(true).description('两端对齐。'),
  maxBookBytes: z
    .number()
    .min(1048576)
    .default(100663296)
    .description('单个文件读取上限（字节）。超出会提示换用更小的文件。'),
  fallbackChunkChars: z
    .number()
    .min(1000)
    .default(6000)
    .description('没有识别到章节标题时，按多少字切分成一段。'),
})

/** Schema defaults, mirrored as the fallback when no settings provider is mounted. */
const DEFAULTS = {
  enabled: true,
  defaultDir: '',
  hotkey: 'mod+`',
  hotkeyHidesSidebar: true,
  launcherFooter: true,
  launcherHeader: true,
  floatingBall: false,
  theme: 'auto',
  fontSize: 17,
  lineHeight: 1.95,
  family: 'serif',
  indent: true,
  justify: true,
  maxBookBytes: 100663296,
  fallbackChunkChars: 6000,
}

/** The single bridge endpoint the browser half talks to. */
const API_PATH = '/dsh-moyu-reader/api'

/** Largest JSON request body the bridge will accept. */
const MAX_REQUEST_BYTES = 1024 * 1024

/** Decoded books kept in memory before the least-recently-used one is dropped. */
const CACHE_LIMIT = 6

/** A chapter longer than this is sub-split so one chapter never blows up a render. */
const MAX_CHAPTER_CHARS = 60000

/** Extensions the shelf lists when "show all files" is off. */
const TEXT_FILE_PATTERN = /\.(txt|text|md|markdown|log|novel|book)$/i

/** Chapter heading patterns, tried in order. `lastIndex` is reset before each scan. */
const CHAPTER_PATTERNS = [
  /^[ \t\u3000]*第[ \t\u3000]*[0-9０-９零〇一二三四五六七八九十百千万两]{1,12}[ \t\u3000]*[章节節回卷篇集部幕][^\n]{0,50}$/gm,
  /^[ \t\u3000]*(?:Chapter|CHAPTER|chapter)[ \t]*\d{1,4}[^\n]{0,60}$/gm,
  /^[ \t\u3000]*(?:序章|序言|楔子|引子|前言|后记|尾声|尾聲|终章|终篇|番外|外传|外傳)[^\n]{0,40}$/gm,
]

/**
 * Mount the host half.
 * @param ctx - host cordis context (`fs`, `webServer`, optional `settings`).
 * @param config - this row's validated composition config, used as the settings `base`.
 */
export function apply(ctx, config) {
  const baseSettings = Object.assign({}, DEFAULTS, config || {})

  /** LRU cache of decoded books, keyed by absolute path. */
  const cache = new Map()

  /** Reading state. Deliberately process-local: it is not user configuration. */
  const state = { recent: [], progress: {}, bookmarks: {} }

  /**
   * The currently authoritative settings source. `installSection` swaps this
   * between the composition entry and the live settings scope, so every read
   * goes through one indirection and no restart is needed to pick up an edit.
   */
  let readSettings = function () {
    return baseSettings
  }

  function settings() {
    const value = readSettings()
    return value && typeof value === 'object' ? Object.assign({}, DEFAULTS, value) : Object.assign({}, DEFAULTS)
  }

  // ---------------------------------------------------------------------------
  // Settings namespace
  // ---------------------------------------------------------------------------

  /**
   * Register the namespace, degrading to the composition config when no settings
   * provider is mounted. `installSection` is the consumer helper for exactly
   * this: it registers `baseSettings` as the base layer while the provider is
   * present and falls back to it when the provider detaches.
   * @param owner - context whose unload suppresses fallback work.
   * @param settingsService - the resolved `settings` service.
   */
  function attachSettings(owner, settingsService) {
    settingsService.installSection(owner, SETTINGS_NS, Config, baseSettings, {
      setSource: function (next) {
        readSettings = next
      },
      onChange: function () {
        // Nothing is derived from settings at mount time: every handler reads
        // `settings()` on demand, so a committed change is picked up already.
      },
    })
  }

  const settingsService = ctx.get('settings')
  if (settingsService !== undefined) {
    attachSettings(ctx, settingsService)
  } else if (typeof ctx.inject === 'function') {
    // The provider mounts asynchronously in some deployments; wait for it rather
    // than silently losing the settings namespace for the process lifetime.
    ctx.inject(['settings'], function (scoped) {
      const scopedService = scoped.get('settings')
      if (scopedService !== undefined) attachSettings(scoped, scopedService)
    })
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function text(value) {
    return value === undefined || value === null ? '' : String(value)
  }

  function errorText(error) {
    if (error === undefined || error === null) return '未知错误'
    if (error.message !== undefined && error.message !== null) return String(error.message)
    return String(error)
  }

  function baseName(input) {
    const norm = text(input).replace(/[\\/]+$/, '')
    const idx = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
    return idx < 0 ? norm : norm.slice(idx + 1)
  }

  function parentOf(input) {
    const norm = text(input).replace(/[\\/]+$/, '')
    if (norm.length === 0) return ''
    const idx = Math.max(norm.lastIndexOf('\\'), norm.lastIndexOf('/'))
    if (idx < 0) return norm
    if (idx === 0) return '/'
    const head = norm.slice(0, idx)
    // "D:" is a drive, not a directory: its parent is the drive root.
    if (/^[A-Za-z]:$/.test(head)) return head + '\\'
    return head
  }

  function countReplacement(value) {
    let bad = 0
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) === 0xfffd) bad++
    }
    return bad
  }

  function countNonAscii(value) {
    let total = 0
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) > 127) total++
    }
    return total
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '未知大小'
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1) + ' MB'
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
    return bytes + ' B'
  }

  /**
   * Detect the filesystem service's "too large" refusal.
   *
   * `readBytes` is specified to fail with `FS_TOO_LARGE` rather than return a
   * truncated buffer, so this must be told apart from a backend that simply
   * cannot read bytes: treating it as "unsupported" and retrying with `readText`
   * would read the whole file and silently defeat the size cap.
   * @param error - the caught value.
   * @returns true when the read was refused for exceeding the byte cap.
   */
  function isTooLargeError(error) {
    if (error === null || typeof error !== 'object') return false
    if (error.code === 'FS_TOO_LARGE') return true
    return typeof error.message === 'string' && error.message.includes('FS_TOO_LARGE')
  }

  function tooLargeMessage(limit) {
    return '文件过大，超出当前上限 ' + formatBytes(limit) + '；可在设置中调高“文件上限”。'
  }

  /**
   * Pick the most plausible text encoding for a byte buffer.
   *
   * Order matters. A clean UTF-8 decode wins outright. Otherwise the damage is
   * judged against the NON-ASCII portion, not the whole file: a mostly-ASCII GBK
   * log whose few Chinese bytes are all broken must not be mistaken for "UTF-8
   * with minor damage", and a UTF-8 novel with a handful of corrupt bytes must
   * not be re-read as GBK mojibake. Only when the non-ASCII content itself is
   * largely broken do the legacy CJK encodings get a turn.
   * @param bytes - the raw file contents.
   * @returns the decoded text and a human-readable encoding label.
   */
  function decodeBytes(bytes) {
    if (bytes === undefined || bytes === null || bytes.length === 0) {
      return { text: '', encoding: 'utf-8' }
    }
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8 (BOM)' }
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' }
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' }
    }

    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }
    } catch (error) {
      // Not clean UTF-8; judge how much of the non-ASCII content survived.
    }

    const utf8 = new TextDecoder('utf-8').decode(bytes)
    const bad = countReplacement(utf8)
    const nonAscii = countNonAscii(utf8)
    if (bad / Math.max(1, nonAscii) < 0.02) {
      return { text: utf8, encoding: bad === 0 ? 'utf-8' : 'utf-8（' + bad + ' 处乱码）' }
    }

    const legacy = ['gb18030', 'gbk', 'big5']
    for (let i = 0; i < legacy.length; i++) {
      try {
        return { text: new TextDecoder(legacy[i], { fatal: true }).decode(bytes), encoding: legacy[i] }
      } catch (error) {
        // Unsupported label or invalid under it; try the next.
      }
    }

    let best = null
    for (let i = 0; i < legacy.length; i++) {
      let decoded
      try {
        decoded = new TextDecoder(legacy[i]).decode(bytes)
      } catch (error) {
        continue
      }
      const score = countReplacement(decoded)
      if (best === null || score < best.bad) best = { text: decoded, encoding: legacy[i], bad: score }
    }
    if (best === null) return { text: utf8, encoding: 'utf-8（可能有乱码）' }
    return {
      text: best.text,
      encoding: best.bad === 0 ? best.encoding : best.encoding + '（' + best.bad + ' 处乱码）',
    }
  }

  function normalizeText(raw) {
    return text(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n')
  }

  /**
   * Split a novel into chapters, falling back to fixed-size parts when no
   * chapter headings are recognizable (a plain notes file, a log, and so on).
   * @param content - normalized full text.
   * @returns ordered `{ title, start, end }` slices over `content`.
   */
  function splitChapters(content) {
    const marks = []
    const seen = Object.create(null)
    for (let i = 0; i < CHAPTER_PATTERNS.length; i++) {
      const pattern = CHAPTER_PATTERNS[i]
      pattern.lastIndex = 0
      let match = pattern.exec(content)
      while (match !== null) {
        const start = match.index
        if (seen[start] !== true) {
          seen[start] = true
          marks.push({ start: start, title: match[0].trim().slice(0, 60) })
        }
        if (pattern.lastIndex === match.index) pattern.lastIndex++
        match = pattern.exec(content)
      }
    }
    marks.sort(function (a, b) {
      return a.start - b.start
    })

    // A table of contents repeats headings within a few lines of each other;
    // keeping only well-separated marks drops that cluster.
    const kept = []
    for (let i = 0; i < marks.length; i++) {
      if (kept.length > 0 && marks[i].start - kept[kept.length - 1].start < 80) continue
      kept.push(marks[i])
    }

    const raw = []
    if (kept.length >= 2) {
      if (kept[0].start > 200) raw.push({ title: '开篇', start: 0, end: kept[0].start })
      for (let i = 0; i < kept.length; i++) {
        raw.push({
          title: kept[i].title,
          start: kept[i].start,
          end: i + 1 < kept.length ? kept[i + 1].start : content.length,
        })
      }
    } else {
      const chunk = Math.max(1000, Math.round(settings().fallbackChunkChars) || DEFAULTS.fallbackChunkChars)
      let index = 0
      let part = 1
      while (index < content.length) {
        let end = Math.min(content.length, index + chunk)
        if (end < content.length) {
          const cut = content.lastIndexOf('\n', end)
          if (cut > index + Math.floor(chunk * 0.5)) end = cut + 1
        }
        raw.push({ title: '第 ' + part + ' 部分', start: index, end: end })
        index = end
        part++
      }
      if (raw.length === 0) raw.push({ title: '正文', start: 0, end: content.length })
    }

    // One oversized chapter is sub-split so a single render never has to lay out
    // hundreds of thousands of characters.
    const out = []
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i]
      const length = item.end - item.start
      if (length <= MAX_CHAPTER_CHARS) {
        out.push(item)
        continue
      }
      const pieces = Math.ceil(length / MAX_CHAPTER_CHARS)
      for (let p = 0; p < pieces; p++) {
        out.push({
          title: item.title + ' · ' + (p + 1),
          start: item.start + Math.floor((length * p) / pieces),
          end: item.start + Math.floor((length * (p + 1)) / pieces),
        })
      }
    }
    return out
  }

  /** Resolve a path against the composed filesystem. */
  async function resolveTarget(path) {
    const fs = ctx.fs
    const input = text(path)
    return fs.resolve(input.length > 0 ? input : '.')
  }

  /**
   * Read and decode one book, reusing the LRU cache.
   * @param path - absolute path or a path resolvable by the filesystem service.
   */
  async function ensureBook(path) {
    const key = text(path)
    if (key.length === 0) throw new Error('未提供文件路径')
    if (cache.has(key)) {
      const hit = cache.get(key)
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }

    const target = await resolveTarget(key)
    const info = await ctx.fs.stat(target)
    if (info === undefined) throw new Error('文件不存在：' + target.displayPath)
    if (info.type !== 'file') throw new Error('不是普通文件：' + target.displayPath)

    const limit = Math.max(1048576, Math.round(settings().maxBookBytes) || DEFAULTS.maxBookBytes)

    // Refuse an oversized book up front when the backend reports a size, so the
    // user gets a readable message instead of a raw filesystem error.
    if (typeof info.size === 'number' && info.size > limit) {
      throw new Error('文件过大（' + formatBytes(info.size) + '），当前上限为 ' + formatBytes(limit) + '；可在设置中调高“文件上限”。')
    }

    let decoded
    try {
      decoded = decodeBytes(await ctx.fs.readBytes(target, undefined, limit))
    } catch (error) {
      if (isTooLargeError(error)) throw new Error(tooLargeMessage(limit))
      // Any other failure means this backend cannot hand back raw bytes; text is
      // the only remaining route, and the size pre-check above still applies.
      decoded = { text: await ctx.fs.readText(target), encoding: 'utf-8' }
    }

    const content = normalizeText(decoded.text)
    const book = {
      path: target.displayPath,
      title: baseName(target.displayPath),
      encoding: decoded.encoding,
      content: content,
      chapters: splitChapters(content),
    }
    cache.set(book.path, book)
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== book.path) cache.delete(oldest)
    }
    return book
  }

  function touchRecent(path, chapterIndex) {
    const key = text(path)
    if (key.length === 0) return
    const list = state.recent.filter(function (item) {
      return item.path !== key
    })
    list.unshift({ path: key, title: baseName(key), chapterIndex: Number(chapterIndex) || 0, at: Date.now() })
    state.recent = list.slice(0, 20)
  }

  // ---------------------------------------------------------------------------
  // Bridge handlers
  // ---------------------------------------------------------------------------

  const handlers = {
    /** List a directory, or report that the path is a file to open directly. */
    async list(args) {
      const target = await resolveTarget(args && args.path)
      const info = await ctx.fs.stat(target)
      if (info === undefined) return { ok: false, error: '路径不存在：' + target.displayPath }
      if (info.type === 'file') return { ok: true, kind: 'file', path: target.displayPath }

      const entries = await ctx.fs.listDir(target)
      const showAll = !!(args && args.all)
      const dirs = []
      const files = []
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const entryName = text(entry.name)
        if (entryName.length === 0 || entryName.charAt(0) === '.') continue
        if (entry.type === 'directory') {
          dirs.push({ name: entryName, path: text(entry.target.displayPath) })
        } else if (entry.type === 'file' && (showAll || TEXT_FILE_PATTERN.test(entryName))) {
          files.push({ name: entryName, path: text(entry.target.displayPath), size: entry.size || 0 })
        }
      }
      const byName = function (a, b) {
        return a.name.localeCompare(b.name, 'zh')
      }
      dirs.sort(byName)
      files.sort(byName)
      return {
        ok: true,
        kind: 'dir',
        path: target.displayPath,
        parent: parentOf(target.displayPath),
        dirs: dirs,
        files: files,
      }
    },

    /** Open a book, restoring the saved chapter when one exists. */
    async open(args) {
      const book = await ensureBook(args && args.path)
      const saved = state.progress[book.path]
      let chapterIndex = 0
      if (
        saved &&
        typeof saved.chapterIndex === 'number' &&
        saved.chapterIndex >= 0 &&
        saved.chapterIndex < book.chapters.length
      ) {
        chapterIndex = saved.chapterIndex
      }
      touchRecent(book.path, chapterIndex)
      const chapter = book.chapters[chapterIndex]
      const chapterList = []
      for (let i = 0; i < book.chapters.length; i++) {
        chapterList.push({
          index: i,
          title: book.chapters[i].title,
          chars: book.chapters[i].end - book.chapters[i].start,
        })
      }
      return {
        ok: true,
        book: {
          path: book.path,
          title: book.title,
          encoding: book.encoding,
          chars: book.content.length,
          chapters: chapterList,
        },
        chapterIndex: chapterIndex,
        scrollRatio: saved && typeof saved.scrollRatio === 'number' ? saved.scrollRatio : 0,
        text: book.content.slice(chapter.start, chapter.end),
        bookmarks: state.bookmarks[book.path] || [],
      }
    },

    /** Fetch one chapter's text. */
    async chapter(args) {
      const book = await ensureBook(args && args.path)
      const wanted = Number(args && args.index)
      const index = Math.max(0, Math.min(book.chapters.length - 1, isNaN(wanted) ? 0 : wanted))
      const chapter = book.chapters[index]
      return {
        ok: true,
        index: index,
        total: book.chapters.length,
        title: chapter.title,
        text: book.content.slice(chapter.start, chapter.end),
      }
    },

    /** Find the first occurrence of a query in each chapter. */
    async search(args) {
      const book = await ensureBook(args && args.path)
      const query = text(args && args.query)
      if (query.length === 0) return { ok: true, hits: [] }
      const needle = query.toLowerCase()
      const hits = []
      for (let i = 0; i < book.chapters.length; i++) {
        if (hits.length >= 200) break
        const chapter = book.chapters[i]
        const slice = book.content.slice(chapter.start, chapter.end)
        const at = slice.toLowerCase().indexOf(needle)
        if (at < 0) continue
        hits.push({
          index: i,
          title: chapter.title,
          snippet: slice
            .slice(Math.max(0, at - 24), Math.min(slice.length, at + query.length + 40))
            .replace(/\n/g, ' ')
            .trim(),
        })
      }
      return { ok: true, hits: hits }
    },

    /** Reading state: recent list, bookmarks, and progress writes. */
    async state(args) {
      const action = text(args && args.action)
      const path = text(args && args.path)

      if (action === 'get') {
        return { ok: true, recent: state.recent, bookmarks: path.length > 0 ? state.bookmarks[path] || [] : [] }
      }

      if (action === 'progress') {
        if (path.length > 0) {
          const chapterIndex = Number(args && args.chapterIndex) || 0
          state.progress[path] = {
            chapterIndex: chapterIndex,
            scrollRatio: Number(args && args.scrollRatio) || 0,
          }
          touchRecent(path, chapterIndex)
        }
        return { ok: true }
      }

      if (action === 'bookmark') {
        if (path.length > 0) {
          const list = state.bookmarks[path] || []
          list.unshift({
            chapterIndex: Number(args && args.chapterIndex) || 0,
            ratio: Number(args && args.ratio) || 0,
            text: text(args && args.text).slice(0, 60),
            at: Date.now(),
          })
          state.bookmarks[path] = list.slice(0, 50)
        }
        return { ok: true, bookmarks: state.bookmarks[path] || [] }
      }

      if (action === 'unbookmark') {
        if (path.length > 0) {
          const drop = Number(args && args.index)
          const list = state.bookmarks[path] || []
          state.bookmarks[path] = list.filter(function (item, i) {
            return i !== drop
          })
        }
        return { ok: true, bookmarks: state.bookmarks[path] || [] }
      }

      if (action === 'clear-recent') {
        state.recent = []
        return { ok: true }
      }

      return { ok: false, error: '未知操作：' + action }
    },
  }

  // ---------------------------------------------------------------------------
  // HTTP bridge
  // ---------------------------------------------------------------------------

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  }

  function readBody(req) {
    return new Promise(function (resolve, reject) {
      const chunks = []
      let size = 0
      req.on('data', function (chunk) {
        size += chunk.length
        if (size > MAX_REQUEST_BYTES) {
          reject(new Error('请求体过大'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', function () {
        resolve(Buffer.concat(chunks).toString('utf8'))
      })
      req.on('error', reject)
    })
  }

  /**
   * Reject a request whose `Origin` names a different host than the one it was
   * sent to. The server binds loopback, but a page in another tab could still
   * POST here; without this a cross-origin page could drive the reader.
   */
  function sameOrigin(req) {
    const origin = req.headers.origin
    if (origin === undefined || origin === null || origin === '') return true
    const host = req.headers.host
    if (host === undefined || host === null) return false
    try {
      return new URL(origin).host === host
    } catch (error) {
      return false
    }
  }

  async function handleApi(req, res) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: '跨站请求已被拒绝' })
      return
    }

    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch (error) {
      sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON：' + errorText(error) })
      return
    }

    const method = text(payload && payload.method)
    const handler = Object.prototype.hasOwnProperty.call(handlers, method) ? handlers[method] : undefined
    if (handler === undefined) {
      sendJson(res, 400, { ok: false, error: '未知方法：' + method })
      return
    }

    try {
      sendJson(res, 200, await handler((payload && payload.args) || {}))
    } catch (error) {
      sendJson(res, 200, { ok: false, error: errorText(error) })
    }
  }

  ctx.effect(function () {
    return ctx.webServer.register({ kind: 'exact', path: API_PATH, handler: handleApi })
  }, 'dsh-moyu-reader: bridge route')

  ctx.logger?.info?.('dsh-moyu-reader host ready at %s', API_PATH)
}
