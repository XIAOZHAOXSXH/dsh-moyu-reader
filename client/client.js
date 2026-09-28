window.__ModuleLoader__.load({
	id: "dsh-moyu-reader",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/**
		 * dsh-moyu-reader — Client half.
		 *
		 * This file is the readable source. `scripts/build-client.mjs` wraps it in the
		 * `window.__ModuleLoader__.load({ id, factory })` lazy-CJS envelope that the DSH
		 * client module system expects, emitting `client/client.js`.
		 *
		 * It contributes four surfaces:
		 *   1. a native right-sidebar tab type plus its body and title slots;
		 *   2. two launcher buttons (left sidebar footer, conversation header);
		 *   3. an optional floating ball;
		 *   4. a card in Settings → 插件 → 插件配置, keyed by this plugin's settings
		 *      namespace, which owns the enable switch and every option.
		 *
		 * Everything is gated on the `enabled` setting, which is read live from the
		 * bound settings scope, so the switch takes effect without a reload.
		 */
		const React = require('react')

		const NAME = 'dsh-moyu-reader'
		const SETTINGS_NS = 'dsh-moyu-reader'
		const API_PATH = '/dsh-moyu-reader/api'
		const READER_ID = 'dsh-moyu-reader'
		const KIND = 'moyu-reader'
		const CSS_TAG_ID = NAME + '/reader.css'

		/** Typography presets. */
		const FONTS = {
		  serif: 'Georgia, "Songti SC", "SimSun", "Noto Serif CJK SC", serif',
		  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
		  kai: '"Kaiti SC", "KaiTi", "STKaiti", "Songti SC", serif',
		}

		/** Fallbacks used until the host's settings namespace answers. */
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

		const SETTING_KEYS = Object.keys(DEFAULTS)

		const CSS = [
		  '.dnr-root{--dnr-bg:var(--dsw-alias-bg-layer-1,#fff);--dnr-fg:var(--dsw-alias-label-primary,#1f2329);--dnr-dim:var(--dsw-alias-label-tertiary,#8b9099);--dnr-border:var(--dsw-alias-border-l1,#e8eaee);--dnr-accent:var(--dsw-alias-brand-primary,#3b6fe0);--dnr-hover:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));position:relative;display:flex;flex-direction:column;height:100%;width:100%;min-width:0;background:var(--dnr-bg);color:var(--dnr-fg);font-size:13px;line-height:1.5;overflow:hidden}',
		  '.dnr-root[data-theme=sepia]{--dnr-bg:#f5ecd9;--dnr-fg:#4a3c28;--dnr-dim:#8d7d61;--dnr-border:#e3d6bb;--dnr-hover:rgba(90,70,40,.09);--dnr-accent:#a2703c}',
		  '.dnr-root[data-theme=dark]{--dnr-bg:#15171b;--dnr-fg:#c7cbd3;--dnr-dim:#7c828e;--dnr-border:#262a31;--dnr-hover:rgba(255,255,255,.07);--dnr-accent:#6f9cff}',
		  '.dnr-root[data-theme=light]{--dnr-bg:#fff;--dnr-fg:#1f2329;--dnr-dim:#8b9099;--dnr-border:#e8eaee;--dnr-hover:rgba(0,0,0,.05);--dnr-accent:#3b6fe0}',
		  '.dnr-head{flex:0 0 auto;display:flex;flex-direction:column;border-bottom:1px solid var(--dnr-border)}',
		  '.dnr-headrow{display:flex;align-items:center;gap:4px;padding:6px 8px;min-height:32px}',
		  '.dnr-title{flex:1 1 auto;min-width:0;font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
		  '.dnr-sub{color:var(--dnr-dim);font-weight:400}',
		  '.dnr-btn{appearance:none;border:0;background:transparent;color:var(--dnr-dim);cursor:pointer;border-radius:6px;padding:4px 7px;font-size:12px;line-height:1.2;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;font-family:inherit}',
		  '.dnr-btn:hover{background:var(--dnr-hover);color:var(--dnr-fg)}',
		  '.dnr-btn.on{color:var(--dnr-accent);background:var(--dnr-hover)}',
		  '.dnr-btn:disabled{opacity:.35;cursor:default}',
		  '.dnr-tabs{display:flex;gap:2px;padding:0 6px 6px;flex-wrap:wrap}',
		  '.dnr-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;outline:none}',
		  '.dnr-read{padding:14px 16px 48px}',
		  '.dnr-read p{margin:0 0 .8em}',
		  '.dnr-ctitle{margin:0 0 .9em;font-size:1.06em;font-weight:700;text-align:center}',
		  '.dnr-foot{flex:0 0 auto;border-top:1px solid var(--dnr-border)}',
		  '.dnr-footrow{display:flex;align-items:center;gap:4px;padding:5px 6px;font-size:11.5px;color:var(--dnr-dim)}',
		  '.dnr-progress{height:2px;background:var(--dnr-border)}',
		  '.dnr-progress i{display:block;height:100%;background:var(--dnr-accent);transition:width .18s}',
		  '.dnr-row{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--dnr-border)}',
		  '.dnr-row.click{cursor:pointer}',
		  '.dnr-row.click:hover{background:var(--dnr-hover)}',
		  '.dnr-row.on{background:var(--dnr-hover);color:var(--dnr-accent)}',
		  '.dnr-name{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
		  '.dnr-meta{flex:0 0 auto;color:var(--dnr-dim);font-size:11px}',
		  '.dnr-input{flex:1 1 auto;min-width:0;background:transparent;border:1px solid var(--dnr-border);border-radius:6px;padding:4px 7px;color:var(--dnr-fg);font-size:12px;font-family:inherit;outline:none}',
		  '.dnr-input:focus{border-color:var(--dnr-accent)}',
		  '.dnr-bar{display:flex;align-items:center;gap:5px;padding:7px 8px;border-bottom:1px solid var(--dnr-border);flex-wrap:wrap}',
		  '.dnr-empty{padding:24px 16px;text-align:center;color:var(--dnr-dim);font-size:12px;line-height:1.8}',
		  '.dnr-err{margin:8px;padding:8px 10px;border-radius:8px;background:rgba(220,60,60,.1);color:#d9534f;font-size:12px;word-break:break-all}',
		  '.dnr-toast{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(30,32,38,.92);color:#fff;padding:5px 12px;border-radius:999px;font-size:12px;z-index:5}',
		  '.dnr-sec{padding:8px 10px;border-bottom:1px solid var(--dnr-border)}',
		  '.dnr-seclabel{font-size:11px;color:var(--dnr-dim);margin-bottom:6px;letter-spacing:.04em}',
		  '.dnr-ctl{display:flex;align-items:center;gap:8px;padding:5px 0;flex-wrap:wrap}',
		  '.dnr-ctl>span:first-child{flex:0 0 74px;font-size:12px;color:var(--dnr-dim)}',
		  '.dnr-seg{display:flex;gap:3px;flex-wrap:wrap}',
		  '.dnr-seg button{appearance:none;border:1px solid var(--dnr-border);background:transparent;color:var(--dnr-fg);border-radius:6px;padding:3px 8px;font-size:11.5px;cursor:pointer;font-family:inherit}',
		  '.dnr-seg button.on{background:var(--dnr-accent);border-color:var(--dnr-accent);color:#fff}',
		  '.dnr-step{appearance:none;border:1px solid var(--dnr-border);background:transparent;color:var(--dnr-fg);border-radius:6px;width:22px;height:22px;cursor:pointer;font-size:13px;line-height:1;font-family:inherit}',
		  '.dnr-val{min-width:38px;text-align:center;font-size:12px}',
		  '.dnr-bookmark{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--dnr-border)}',
		  '.dnr-fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:var(--dsw-alias-bg-overlay,rgba(255,255,255,.95));color:var(--dsw-alias-label-primary,#1f2329);box-shadow:0 4px 18px rgba(0,0,0,.18);cursor:pointer;opacity:.6;transition:opacity .15s;font-family:inherit;font-size:12px}',
		  '.dnr-fab:hover{opacity:1}',
		  '.dnr-footbtn{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;width:100%;font-family:inherit;font-size:13px}',
		  '.dnr-footbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}',
		  '.dnr-hbtn{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:6px;padding:4px 6px;font-size:14px;line-height:1;font-family:inherit}',
		  '.dnr-hbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
		  '.dnr-chip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
		  '.dnr-kbd{display:inline-block;padding:1px 6px;border:1px solid var(--dnr-border);border-radius:4px;font-size:11px;color:var(--dnr-fg);background:var(--dnr-hover)}',
		  '.dnr-card{border:1px solid var(--dsw-alias-border-l1,#e8eaee);border-radius:10px;padding:12px 14px;margin:0 0 12px;background:var(--dsw-alias-bg-layer-1,transparent)}',
		  '.dnr-cardhead{display:flex;align-items:center;gap:8px;margin:0 0 4px}',
		  '.dnr-cardtitle{font-size:13px;font-weight:600;flex:1 1 auto;min-width:0}',
		  '.dnr-carddesc{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);line-height:1.7;margin:0 0 10px}',
		  '.dnr-switch{appearance:none;border:0;padding:0;cursor:pointer;width:38px;height:21px;border-radius:999px;background:var(--dsw-alias-border-l2,#d0d5dd);position:relative;transition:background .15s;flex:0 0 auto}',
		  '.dnr-switch.on{background:var(--dsw-alias-brand-primary,#3b6fe0)}',
		  '.dnr-switch i{position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}',
		  '.dnr-switch.on i{transform:translateX(17px)}',
		  '.dnr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 18px}',
		  '.dnr-field{display:flex;align-items:center;gap:8px;padding:5px 0;min-width:0}',
		  '.dnr-field>label{flex:0 0 96px;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}',
		  '.dnr-field>label small{display:block;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);font-weight:400}',
		  '.dnr-field .dnr-input{font-size:12px}',
		  '.dnr-note{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a1);line-height:1.7;margin:8px 0 0}',
		].join('\n')

		// Inject the stylesheet once per document, the same way shipped client plugins do.
		if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') === null) {
		  const tag = document.createElement('style')
		  tag.dataset.plugin = NAME
		  tag.dataset.pluginCss = CSS_TAG_ID
		  tag.textContent = CSS
		  document.head.appendChild(tag)
		}

		// -----------------------------------------------------------------------------
		// Reactive store
		// -----------------------------------------------------------------------------

		function createStore(initial) {
		  let current = initial
		  const listeners = new Set()
		  return {
		    read: function () {
		      return current
		    },
		    patch: function (part) {
		      current = Object.assign({}, current, part)
		      const snapshot = Array.from(listeners)
		      for (let i = 0; i < snapshot.length; i++) snapshot[i]()
		    },
		    subscribe: function (listener) {
		      listeners.add(listener)
		      return function () {
		        listeners.delete(listener)
		      }
		    },
		  }
		}

		function useStore(target) {
		  const pair = React.useState(target.read())
		  const setValue = pair[1]
		  React.useEffect(
		    function () {
		      return target.subscribe(function () {
		        setValue(target.read())
		      })
		    },
		    [target],
		  )
		  return pair[0]
		}

		const store = createStore(
		  Object.assign({}, DEFAULTS, {
		    view: 'shelf',
		    dir: { path: '', parent: '', dirs: [], files: [], all: false, loading: false, error: '' },
		    recent: [],
		    book: null,
		    chapterIndex: 0,
		    total: 0,
		    text: '',
		    bookmarks: [],
		    hits: [],
		    searching: false,
		    busy: false,
		    error: '',
		    toast: '',
		    settingsReady: false,
		  }),
		)

		/** Bound settings scope, when the settings client service is available. */
		let settingsScope = null
		/** Set while a scroll position should be restored after the next text change. */
		let pendingRestore = 0
		/** Guards against a single keypress toggling twice through two mounted anchors. */
		let lastToggleAt = 0

		function messageOf(error) {
		  if (error === undefined || error === null) return '未知错误'
		  return error.message === undefined || error.message === null ? String(error) : String(error.message)
		}

		function toast(text) {
		  store.patch({ toast: text })
		  setTimeout(function () {
		    if (store.read().toast === text) store.patch({ toast: '' })
		  }, 1800)
		}

		// -----------------------------------------------------------------------------
		// Host bridge
		// -----------------------------------------------------------------------------

		async function rpc(method, args) {
		  try {
		    const response = await fetch(API_PATH, {
		      method: 'POST',
		      headers: { 'content-type': 'application/json' },
		      body: JSON.stringify({ method: method, args: args || {} }),
		    })
		    return await response.json()
		  } catch (error) {
		    return { ok: false, error: '无法连接 DSH 宿主：' + messageOf(error) }
		  }
		}

		// -----------------------------------------------------------------------------
		// Settings bridge
		// -----------------------------------------------------------------------------

		function pickSettings(value) {
		  const out = {}
		  if (value === undefined || value === null || typeof value !== 'object') return out
		  for (let i = 0; i < SETTING_KEYS.length; i++) {
		    const key = SETTING_KEYS[i]
		    if (value[key] !== undefined && value[key] !== null) out[key] = value[key]
		  }
		  return out
		}

		/** Settings changed locally but not yet acknowledged by the host. */
		let pendingSettings = Object.create(null)
		/** Debounce handle for the settings write. */
		let flushTimer = null

		function syncFromScope() {
		  if (settingsScope === null) return
		  const snapshot = settingsScope.getSnapshot()
		  // A `loading` snapshot carries no value yet; writing defaults over the store
		  // there would flash the wrong typography before the document arrives.
		  if (snapshot.status !== 'ready' || snapshot.value === undefined) return
		  // Re-apply local edits the host has not acknowledged yet, so a snapshot that
		  // lands between a slider move and its write does not visibly revert it.
		  store.patch(Object.assign(pickSettings(snapshot.value), pendingSettings, { settingsReady: true }))
		}

		async function flushSettings() {
		  flushTimer = null
		  const patch = pendingSettings
		  pendingSettings = Object.create(null)
		  if (settingsScope === null) return
		  const keys = Object.keys(patch)
		  if (keys.length === 0) return
		  const ops = []
		  for (let i = 0; i < keys.length; i++) ops.push({ op: 'set', path: [keys[i]], value: patch[keys[i]] })
		  try {
		    await settingsScope.mutate(ops)
		  } catch (error) {
		    toast('保存失败：' + messageOf(error))
		  }
		}

		/**
		 * Apply a settings change immediately for feedback, and persist it on a short
		 * debounce. Sliders fire continuously while dragged; writing once per event
		 * would rewrite the settings document dozens of times per drag.
		 */
		function updateSettings(patch) {
		  store.patch(patch)
		  if (settingsScope === null) {
		    toast('已应用（未接入设置存储，重启后失效）')
		    return
		  }
		  Object.assign(pendingSettings, patch)
		  if (flushTimer !== null) clearTimeout(flushTimer)
		  flushTimer = setTimeout(flushSettings, 250)
		}

		function attachSettingsScope(binder) {
		  if (binder === undefined || binder === null) return
		  try {
		    settingsScope = binder.bind({ namespace: SETTINGS_NS })
		  } catch (error) {
		    settingsScope = null
		    return
		  }
		  syncFromScope()
		  settingsScope.subscribe(syncFromScope)
		}

		// -----------------------------------------------------------------------------
		// Reader behaviour
		// -----------------------------------------------------------------------------

		/** The client cordis context, captured at apply time. */
		let ctxRef = null

		function rightbar() {
		  return ctxRef === null ? undefined : ctxRef.get('sidebarRight')
		}

		function openReader() {
		  if (!store.read().enabled) return
		  const bar = rightbar()
		  if (bar === undefined) {
		    toast('DSH 右侧栏服务不可用')
		    return
		  }
		  try {
		    bar.openTab(KIND)
		  } catch (error) {
		    toast('打开失败：' + messageOf(error))
		  }
		}

		function hideReader() {
		  const bar = rightbar()
		  if (bar === undefined) return
		  const settings = store.read()
		  try {
		    // "Boss key" semantics: get the whole sidebar out of the way when asked.
		    if (settings.hotkeyHidesSidebar && typeof bar.toggleExpanded === 'function' && bar.isExpanded()) {
		      bar.toggleExpanded()
		    }
		  } catch (error) {
		    // No mounted seat; nothing to hide.
		  }
		}

		function toggleReader() {
		  const now = Date.now()
		  if (now - lastToggleAt < 300) return
		  lastToggleAt = now
		  if (!store.read().enabled) return
		  const bar = rightbar()
		  if (bar === undefined) return
		  try {
		    if (bar.isExpanded()) hideReader()
		    else openReader()
		  } catch (error) {
		    toast('切换失败：' + messageOf(error))
		  }
		}

		async function browse(path, all) {
		  const current = store.read().dir
		  const showAll = all === undefined ? current.all : !!all
		  store.patch({ dir: Object.assign({}, current, { loading: true, error: '' }) })
		  const result = await rpc('list', { path: path === undefined ? current.path : path, all: showAll })
		  if (!result || result.ok !== true) {
		    store.patch({
		      dir: Object.assign({}, store.read().dir, { loading: false, error: (result && result.error) || '读取目录失败' }),
		    })
		    return
		  }
		  if (result.kind === 'file') {
		    store.patch({ dir: Object.assign({}, store.read().dir, { loading: false, error: '' }) })
		    await loadBook(result.path)
		    return
		  }
		  store.patch({
		    dir: {
		      path: result.path,
		      parent: result.parent,
		      dirs: result.dirs || [],
		      files: result.files || [],
		      all: showAll,
		      loading: false,
		      error: '',
		    },
		  })
		}

		async function loadBook(path) {
		  store.patch({ busy: true, error: '', toast: '' })
		  const result = await rpc('open', { path: path })
		  if (!result || result.ok !== true) {
		    store.patch({ busy: false, error: (result && result.error) || '打开失败' })
		    return
		  }
		  pendingRestore = Number(result.scrollRatio) || 0
		  store.patch({
		    busy: false,
		    error: '',
		    book: result.book,
		    chapterIndex: result.chapterIndex,
		    total: result.book.chapters.length,
		    text: result.text,
		    bookmarks: result.bookmarks || [],
		    hits: [],
		    view: 'read',
		  })
		  rpc('state', { action: 'progress', path: result.book.path, chapterIndex: result.chapterIndex, scrollRatio: 0 })
		}

		async function gotoChapter(index, ratio) {
		  const book = store.read().book
		  if (!book) return
		  const wanted = Math.max(0, Math.min(book.chapters.length - 1, index))
		  store.patch({ busy: true, error: '' })
		  const result = await rpc('chapter', { path: book.path, index: wanted })
		  if (!result || result.ok !== true) {
		    store.patch({ busy: false, error: (result && result.error) || '加载章节失败' })
		    return
		  }
		  pendingRestore = typeof ratio === 'number' ? ratio : 0
		  store.patch({ busy: false, error: '', text: result.text, chapterIndex: result.index, total: result.total, view: 'read' })
		  rpc('state', { action: 'progress', path: book.path, chapterIndex: result.index, scrollRatio: pendingRestore })
		}

		async function runSearch(query) {
		  const book = store.read().book
		  if (!book) return
		  store.patch({ searching: true, error: '' })
		  const result = await rpc('search', { path: book.path, query: query })
		  store.patch({ searching: false, hits: (result && result.hits) || [], view: 'search' })
		}

		async function addBookmark() {
		  const snapshot = store.read()
		  if (!snapshot.book) return
		  const result = await rpc('state', {
		    action: 'bookmark',
		    path: snapshot.book.path,
		    chapterIndex: snapshot.chapterIndex,
		    ratio: 0,
		    text: (snapshot.text || '').slice(0, 60),
		  })
		  store.patch({ bookmarks: (result && result.bookmarks) || [] })
		  toast('已添加书签')
		}

		async function dropBookmark(index) {
		  const book = store.read().book
		  if (!book) return
		  const result = await rpc('state', { action: 'unbookmark', path: book.path, index: index })
		  store.patch({ bookmarks: (result && result.bookmarks) || [] })
		}

		// -----------------------------------------------------------------------------
		// Hotkey
		// -----------------------------------------------------------------------------

		function isMac() {
		  if (typeof navigator === 'undefined') return false
		  const probe = String(navigator.platform || navigator.userAgent || '')
		  return /mac|iphone|ipad|ipod/i.test(probe)
		}

		function parseHotkey(spec) {
		  const parts = String(spec || '')
		    .toLowerCase()
		    .split('+')
		    .map(function (part) {
		      return part.trim()
		    })
		    .filter(Boolean)
		  const out = { mod: false, ctrl: false, meta: false, shift: false, alt: false, key: '' }
		  for (let i = 0; i < parts.length; i++) {
		    const part = parts[i]
		    if (part === 'mod') out.mod = true
		    else if (part === 'ctrl' || part === 'control') out.ctrl = true
		    else if (part === 'cmd' || part === 'meta' || part === 'super') out.meta = true
		    else if (part === 'shift') out.shift = true
		    else if (part === 'alt' || part === 'option') out.alt = true
		    else out.key = part
		  }
		  return out
		}

		function matchesHotkey(event, spec) {
		  const hotkey = parseHotkey(spec)
		  if (hotkey.key.length === 0) return false
		  const wantCtrl = hotkey.ctrl || (hotkey.mod && !isMac())
		  const wantMeta = hotkey.meta || (hotkey.mod && isMac())
		  if (event.ctrlKey !== wantCtrl) return false
		  if (event.metaKey !== wantMeta) return false
		  if (event.shiftKey !== hotkey.shift) return false
		  if (event.altKey !== hotkey.alt) return false
		  const key = String(event.key || '').toLowerCase()
		  const code = String(event.code || '').toLowerCase()
		  if (hotkey.key === '`' || hotkey.key === 'backquote') return key === '`' || key === '~' || code === 'backquote'
		  if (hotkey.key.length === 1) return key === hotkey.key
		  return code === 'key' + hotkey.key || key === hotkey.key
		}

		function hotkeyLabel(spec) {
		  return String(spec || '')
		    .split('+')
		    .map(function (part) {
		      const trimmed = part.trim()
		      if (!trimmed) return trimmed
		      if (trimmed.toLowerCase() === 'mod') return isMac() ? 'Cmd' : 'Ctrl'
		      if (trimmed.length === 1) return trimmed.toUpperCase()
		      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
		    })
		    .filter(Boolean)
		    .join(' + ')
		}

		/**
		 * Attach the boss key on the anchor's document in the capture phase, so it wins
		 * over editor shortcuts. Anchors are always-mounted nodes, which keeps the
		 * listener alive even while the reader itself is unmounted.
		 */
		function useBossKey(anchorRef) {
		  React.useEffect(
		    function () {
		      const node = anchorRef.current
		      if (!node || !node.ownerDocument) return undefined
		      const doc = node.ownerDocument
		      const onKey = function (event) {
		        if (!store.read().enabled) return
		        if (!matchesHotkey(event, store.read().hotkey)) return
		        event.preventDefault()
		        event.stopPropagation()
		        toggleReader()
		      }
		      doc.addEventListener('keydown', onKey, true)
		      return function () {
		        doc.removeEventListener('keydown', onKey, true)
		      }
		    },
		    [anchorRef],
		  )
		}

		// -----------------------------------------------------------------------------
		// Reader views
		// -----------------------------------------------------------------------------

		function paragraphs(content, chapterTitle) {
		  let body = String(content === undefined || content === null ? '' : content)
		  const firstBreak = body.indexOf('\n')
		  const firstLine = (firstBreak < 0 ? body : body.slice(0, firstBreak)).trim()
		  // The chapter heading is already rendered above the text; drop the duplicate.
		  if (chapterTitle && firstLine.length > 0 && firstLine === chapterTitle) {
		    body = firstBreak < 0 ? '' : body.slice(firstBreak + 1)
		  }
		  const lines = body.split('\n')
		  const nodes = []
		  let key = 0
		  for (let i = 0; i < lines.length; i++) {
		    const line = lines[i].trim()
		    if (line.length === 0) continue
		    nodes.push(React.createElement('p', { key: 'p' + key++ }, line))
		  }
		  return nodes
		}

		function formatSize(bytes) {
		  if (!bytes) return ''
		  if (bytes < 1024) return bytes + ' B'
		  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
		  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
		}

		function ReaderIcon() {
		  return React.createElement('span', { style: { fontSize: '13px', lineHeight: 1 } }, '📖')
		}

		function ShelfView(props) {
		  const s = props.state
		  const pair = React.useState(s.dir.path)
		  const draft = pair[0]
		  const setDraft = pair[1]
		  const touched = React.useRef(false)

		  React.useEffect(
		    function () {
		      if (!touched.current) setDraft(s.dir.path)
		    },
		    [s.dir.path],
		  )

		  const recent = []
		  for (let i = 0; i < s.recent.length; i++) {
		    const item = s.recent[i]
		    recent.push(
		      React.createElement(
		        'div',
		        {
		          key: 'r' + i,
		          className: 'dnr-row click',
		          onClick: function () {
		            loadBook(item.path)
		          },
		          title: item.path,
		        },
		        React.createElement('span', { className: 'dnr-name' }, '🕘 ' + item.title),
		        React.createElement('span', { className: 'dnr-meta' }, '第 ' + ((item.chapterIndex || 0) + 1) + ' 章'),
		      ),
		    )
		  }

		  const dirs = []
		  for (let i = 0; i < s.dir.dirs.length; i++) {
		    const item = s.dir.dirs[i]
		    dirs.push(
		      React.createElement(
		        'div',
		        {
		          key: 'd' + i,
		          className: 'dnr-row click',
		          onClick: function () {
		            touched.current = false
		            browse(item.path)
		          },
		          title: item.path,
		        },
		        React.createElement('span', { className: 'dnr-name' }, '📁 ' + item.name),
		      ),
		    )
		  }

		  const files = []
		  for (let i = 0; i < s.dir.files.length; i++) {
		    const item = s.dir.files[i]
		    files.push(
		      React.createElement(
		        'div',
		        {
		          key: 'f' + i,
		          className: 'dnr-row click',
		          onClick: function () {
		            loadBook(item.path)
		          },
		          title: item.path,
		        },
		        React.createElement('span', { className: 'dnr-name' }, '📄 ' + item.name),
		        React.createElement('span', { className: 'dnr-meta' }, formatSize(item.size)),
		      ),
		    )
		  }

		  const submit = function () {
		    touched.current = false
		    browse(draft)
		  }
		  const emptyDir = !s.dir.loading && dirs.length === 0 && files.length === 0 && !s.dir.error

		  return React.createElement(
		    'div',
		    null,
		    React.createElement(
		      'div',
		      { className: 'dnr-bar' },
		      React.createElement(
		        'button',
		        {
		          className: 'dnr-btn',
		          disabled: !s.dir.parent,
		          title: '上一级目录',
		          onClick: function () {
		            touched.current = false
		            browse(s.dir.parent)
		          },
		        },
		        '↑',
		      ),
		      React.createElement('input', {
		        className: 'dnr-input',
		        value: draft,
		        spellCheck: false,
		        placeholder: '输入文件或目录路径，回车打开',
		        onChange: function (event) {
		          touched.current = true
		          setDraft(event.target.value)
		        },
		        onKeyDown: function (event) {
		          if (event.key === 'Enter') submit()
		        },
		      }),
		      React.createElement('button', { className: 'dnr-btn', onClick: submit }, '打开'),
		      React.createElement(
		        'button',
		        {
		          className: 'dnr-btn',
		          title: '刷新',
		          onClick: function () {
		            browse(s.dir.path, s.dir.all)
		          },
		        },
		        '⟳',
		      ),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-bar' },
		      React.createElement(
		        'button',
		        {
		          className: 'dnr-btn' + (s.dir.all ? ' on' : ''),
		          onClick: function () {
		            browse(s.dir.path, !s.dir.all)
		          },
		        },
		        s.dir.all ? '☑ 显示全部文件' : '☐ 显示全部文件',
		      ),
		      React.createElement(
		        'span',
		        { className: 'dnr-meta', style: { flex: '1 1 100%', whiteSpace: 'normal', wordBreak: 'break-all' } },
		        s.dir.path || '',
		      ),
		    ),
		    s.dir.error ? React.createElement('div', { className: 'dnr-err' }, s.dir.error) : null,
		    s.dir.loading ? React.createElement('div', { className: 'dnr-empty' }, '读取中…') : null,
		    recent.length > 0
		      ? React.createElement(
		          'div',
		          null,
		          React.createElement('div', { className: 'dnr-seclabel', style: { padding: '8px 10px 0' } }, '最近阅读'),
		          recent,
		        )
		      : null,
		    dirs.length > 0
		      ? React.createElement(
		          'div',
		          null,
		          React.createElement('div', { className: 'dnr-seclabel', style: { padding: '8px 10px 0' } }, '目录'),
		          dirs,
		        )
		      : null,
		    files.length > 0
		      ? React.createElement(
		          'div',
		          null,
		          React.createElement('div', { className: 'dnr-seclabel', style: { padding: '8px 10px 0' } }, '文本文件'),
		          files,
		        )
		      : null,
		    emptyDir
		      ? React.createElement(
		          'div',
		          { className: 'dnr-empty' },
		          '这个目录里没有可读的文本文件。',
		          React.createElement('br'),
		          '可以点“显示全部文件”，或直接在地址栏粘贴 txt 的完整路径。',
		        )
		      : null,
		  )
		}

		function TocView(props) {
		  const s = props.state
		  if (!s.book) return React.createElement('div', { className: 'dnr-empty' }, '还没有打开书籍。')

		  const bookmarks = []
		  for (let i = 0; i < s.bookmarks.length; i++) {
		    const mark = s.bookmarks[i]
		    const chapter = s.book.chapters[mark.chapterIndex]
		    bookmarks.push(
		      React.createElement(
		        'div',
		        { key: 'b' + i, className: 'dnr-bookmark' },
		        React.createElement(
		          'span',
		          {
		            className: 'dnr-name',
		            style: { cursor: 'pointer' },
		            onClick: function () {
		              gotoChapter(mark.chapterIndex, mark.ratio)
		            },
		          },
		          '🔖 ' + (chapter ? chapter.title : '第 ' + (mark.chapterIndex + 1) + ' 章'),
		        ),
		        React.createElement(
		          'button',
		          {
		            className: 'dnr-btn',
		            title: '删除书签',
		            onClick: function () {
		              dropBookmark(i)
		            },
		          },
		          '×',
		        ),
		      ),
		    )
		  }

		  const rows = []
		  for (let i = 0; i < s.book.chapters.length; i++) {
		    const chapter = s.book.chapters[i]
		    rows.push(
		      React.createElement(
		        'div',
		        {
		          key: 'c' + i,
		          className: 'dnr-row click' + (i === s.chapterIndex ? ' on' : ''),
		          onClick: function () {
		            gotoChapter(i, 0)
		          },
		          title: chapter.title,
		        },
		        React.createElement('span', { className: 'dnr-name' }, chapter.title),
		        React.createElement(
		          'span',
		          { className: 'dnr-meta' },
		          chapter.chars >= 1000 ? Math.round(chapter.chars / 1000) + 'k' : String(chapter.chars),
		        ),
		      ),
		    )
		  }

		  return React.createElement(
		    'div',
		    null,
		    bookmarks.length > 0
		      ? React.createElement(
		          'div',
		          null,
		          React.createElement('div', { className: 'dnr-seclabel', style: { padding: '8px 10px 0' } }, '书签'),
		          bookmarks,
		        )
		      : null,
		    React.createElement(
		      'div',
		      { className: 'dnr-seclabel', style: { padding: '8px 10px 0' } },
		      '共 ' + s.book.chapters.length + ' 章',
		    ),
		    rows,
		  )
		}

		function SearchView(props) {
		  const s = props.state
		  const pair = React.useState('')
		  const query = pair[0]
		  const setQuery = pair[1]

		  const rows = []
		  for (let i = 0; i < s.hits.length; i++) {
		    const hit = s.hits[i]
		    rows.push(
		      React.createElement(
		        'div',
		        {
		          key: 'h' + i,
		          className: 'dnr-row click',
		          onClick: function () {
		            gotoChapter(hit.index, 0)
		          },
		        },
		        React.createElement(
		          'span',
		          { className: 'dnr-name' },
		          React.createElement('div', { style: { fontWeight: 600, fontSize: '12px' } }, hit.title),
		          React.createElement(
		            'div',
		            { className: 'dnr-meta', style: { whiteSpace: 'normal', marginTop: '2px', lineHeight: 1.5 } },
		            hit.snippet,
		          ),
		        ),
		      ),
		    )
		  }

		  return React.createElement(
		    'div',
		    null,
		    React.createElement(
		      'div',
		      { className: 'dnr-bar' },
		      React.createElement('input', {
		        className: 'dnr-input',
		        value: query,
		        spellCheck: false,
		        placeholder: '搜索全书，回车开始',
		        onChange: function (event) {
		          setQuery(event.target.value)
		        },
		        onKeyDown: function (event) {
		          if (event.key === 'Enter' && query.trim().length > 0) runSearch(query.trim())
		        },
		      }),
		      React.createElement(
		        'button',
		        {
		          className: 'dnr-btn',
		          disabled: query.trim().length === 0,
		          onClick: function () {
		            runSearch(query.trim())
		          },
		        },
		        '搜索',
		      ),
		    ),
		    s.searching ? React.createElement('div', { className: 'dnr-empty' }, '搜索中…') : null,
		    !s.searching && s.hits.length === 0
		      ? React.createElement('div', { className: 'dnr-empty' }, '输入关键词，逐章查找第一次出现的位置。')
		      : null,
		    rows,
		  )
		}

		function Stepper(props) {
		  return React.createElement(
		    'div',
		    { className: 'dnr-ctl' },
		    React.createElement('span', null, props.label),
		    React.createElement(
		      'button',
		      {
		        className: 'dnr-step',
		        onClick: function () {
		          props.onChange(-1)
		        },
		      },
		      '−',
		    ),
		    React.createElement('span', { className: 'dnr-val' }, props.display),
		    React.createElement(
		      'button',
		      {
		        className: 'dnr-step',
		        onClick: function () {
		          props.onChange(1)
		        },
		      },
		      '+',
		    ),
		  )
		}

		function Segmented(props) {
		  const buttons = []
		  for (let i = 0; i < props.options.length; i++) {
		    const option = props.options[i]
		    buttons.push(
		      React.createElement(
		        'button',
		        {
		          key: option.value,
		          className: props.value === option.value ? 'on' : '',
		          onClick: function () {
		            props.onChange(option.value)
		          },
		        },
		        option.label,
		      ),
		    )
		  }
		  return React.createElement(
		    'div',
		    { className: 'dnr-ctl' },
		    props.label ? React.createElement('span', null, props.label) : null,
		    React.createElement('div', { className: 'dnr-seg' }, buttons),
		  )
		}

		/** Reader-local typography panel; edits the same namespace as the settings card. */
		function ReaderSettingsView(props) {
		  const s = props.state
		  return React.createElement(
		    'div',
		    null,
		    React.createElement(
		      'div',
		      { className: 'dnr-sec' },
		      React.createElement('div', { className: 'dnr-seclabel' }, '排版'),
		      React.createElement(Stepper, {
		        label: '字号',
		        display: s.fontSize + 'px',
		        onChange: function (step) {
		          updateSettings({ fontSize: Math.max(12, Math.min(30, s.fontSize + step)) })
		        },
		      }),
		      React.createElement(Stepper, {
		        label: '行距',
		        display: Number(s.lineHeight).toFixed(2),
		        onChange: function (step) {
		          updateSettings({
		            lineHeight: Math.max(1.3, Math.min(2.8, Math.round((Number(s.lineHeight) + step * 0.05) * 100) / 100)),
		          })
		        },
		      }),
		      React.createElement(Segmented, {
		        label: '字体',
		        value: s.family,
		        options: [
		          { value: 'serif', label: '宋体' },
		          { value: 'sans', label: '黑体' },
		          { value: 'kai', label: '楷体' },
		        ],
		        onChange: function (value) {
		          updateSettings({ family: value })
		        },
		      }),
		      React.createElement(Segmented, {
		        label: '对齐',
		        value: s.justify ? 'on' : 'off',
		        options: [
		          { value: 'on', label: '两端对齐' },
		          { value: 'off', label: '左对齐' },
		        ],
		        onChange: function (value) {
		          updateSettings({ justify: value === 'on' })
		        },
		      }),
		      React.createElement(Segmented, {
		        label: '首行缩进',
		        value: s.indent ? 'on' : 'off',
		        options: [
		          { value: 'on', label: '开' },
		          { value: 'off', label: '关' },
		        ],
		        onChange: function (value) {
		          updateSettings({ indent: value === 'on' })
		        },
		      }),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-sec' },
		      React.createElement('div', { className: 'dnr-seclabel' }, '主题'),
		      React.createElement(Segmented, {
		        label: '配色',
		        value: s.theme,
		        options: [
		          { value: 'auto', label: '跟随 DSH' },
		          { value: 'sepia', label: '护眼' },
		          { value: 'dark', label: '夜间' },
		          { value: 'light', label: '明亮' },
		        ],
		        onChange: function (value) {
		          updateSettings({ theme: value })
		        },
		      }),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-sec' },
		      React.createElement('div', { className: 'dnr-seclabel' }, '摸鱼'),
		      React.createElement(Segmented, {
		        label: '悬浮球',
		        value: s.floatingBall ? 'on' : 'off',
		        options: [
		          { value: 'on', label: '显示' },
		          { value: 'off', label: '隐藏' },
		        ],
		        onChange: function (value) {
		          updateSettings({ floatingBall: value === 'on' })
		        },
		      }),
		      React.createElement(
		        'div',
		        { className: 'dnr-ctl' },
		        React.createElement('span', null, '老板键'),
		        React.createElement('span', { className: 'dnr-kbd' }, hotkeyLabel(s.hotkey)),
		      ),
		      React.createElement(
		        'div',
		        { className: 'dnr-ctl' },
		        React.createElement('span', null, '翻页键'),
		        React.createElement('span', { className: 'dnr-kbd' }, '← →'),
		      ),
		    ),
		    s.book
		      ? React.createElement(
		          'div',
		          { className: 'dnr-sec' },
		          React.createElement('div', { className: 'dnr-seclabel' }, '当前书籍'),
		          React.createElement(
		            'div',
		            { className: 'dnr-meta', style: { wordBreak: 'break-all', lineHeight: 1.8, fontSize: '11.5px' } },
		            s.book.title,
		            React.createElement('br'),
		            '编码 ' + s.book.encoding + ' · ' + s.book.chars + ' 字 · ' + s.total + ' 章',
		          ),
		        )
		      : null,
		  )
		}

		function ReaderBody() {
		  const s = useStore(store)
		  const contentRef = React.useRef(null)
		  const lastSaveAt = React.useRef(0)

		  React.useEffect(function () {
		    let alive = true
		    const run = async function () {
		      const result = await rpc('state', { action: 'get' })
		      if (alive && result && result.ok === true) store.patch({ recent: result.recent || [] })
		      if (alive && store.read().dir.path === '') await browse(store.read().defaultDir || '')
		    }
		    run()
		    return function () {
		      alive = false
		    }
		  }, [])

		  React.useEffect(
		    function () {
		      const node = contentRef.current
		      if (!node) return
		      if (pendingRestore > 0) {
		        const max = node.scrollHeight - node.clientHeight
		        node.scrollTop = Math.round(max * pendingRestore)
		        pendingRestore = 0
		      } else {
		        node.scrollTop = 0
		      }
		    },
		    [s.text],
		  )

		  const onScroll = function () {
		    const node = contentRef.current
		    if (!node || !s.book) return
		    const now = Date.now()
		    if (now - lastSaveAt.current < 1500) return
		    lastSaveAt.current = now
		    const max = node.scrollHeight - node.clientHeight
		    rpc('state', {
		      action: 'progress',
		      path: s.book.path,
		      chapterIndex: s.chapterIndex,
		      scrollRatio: max > 0 ? node.scrollTop / max : 0,
		    })
		  }

		  const onKeyDown = function (event) {
		    const tag = event.target && event.target.tagName ? String(event.target.tagName).toLowerCase() : ''
		    if (tag === 'input' || tag === 'textarea') return
		    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
		      event.preventDefault()
		      gotoChapter(s.chapterIndex - 1, 0)
		    } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
		      event.preventDefault()
		      gotoChapter(s.chapterIndex + 1, 0)
		    } else if (event.key === 'Escape') {
		      event.preventDefault()
		      hideReader()
		    }
		  }

		  if (!s.enabled) {
		    return React.createElement(
		      'div',
		      { className: 'dnr-root' },
		      React.createElement(
		        'div',
		        { className: 'dnr-empty' },
		        '小说阅读器已在设置中关闭。',
		        React.createElement('br'),
		        '到 设置 → 插件 → 插件配置 里重新打开。',
		      ),
		    )
		  }

		  const tabDefs = [
		    { id: 'shelf', label: '书架', icon: '📚' },
		    { id: 'toc', label: '目录', icon: '☰' },
		    { id: 'search', label: '搜索', icon: '🔍' },
		    { id: 'settings', label: '设置', icon: '⚙' },
		  ]
		  const tabs = []
		  for (let i = 0; i < tabDefs.length; i++) {
		    const tab = tabDefs[i]
		    tabs.push(
		      React.createElement(
		        'button',
		        {
		          key: tab.id,
		          className: 'dnr-btn' + (s.view === tab.id ? ' on' : ''),
		          title: tab.label,
		          onClick: function () {
		            store.patch({ view: tab.id })
		          },
		        },
		        tab.icon + ' ' + tab.label,
		      ),
		    )
		  }

		  const percent = s.total > 1 ? Math.round(((s.chapterIndex + 1) / s.total) * 100) : s.book ? 100 : 0

		  let content = null
		  if (s.view === 'shelf') content = React.createElement(ShelfView, { state: s })
		  else if (s.view === 'toc') content = React.createElement(TocView, { state: s })
		  else if (s.view === 'search') content = React.createElement(SearchView, { state: s })
		  else if (s.view === 'settings') content = React.createElement(ReaderSettingsView, { state: s })
		  else if (!s.book)
		    content = React.createElement('div', { className: 'dnr-empty' }, '还没有打开书籍，去书架选一个 txt 文件吧。')
		  else {
		    const chapterTitle = s.book.chapters[s.chapterIndex] ? s.book.chapters[s.chapterIndex].title : ''
		    content = React.createElement(
		      'div',
		      {
		        className: 'dnr-read',
		        style: {
		          fontSize: s.fontSize + 'px',
		          lineHeight: String(s.lineHeight),
		          fontFamily: FONTS[s.family] || FONTS.serif,
		          textAlign: s.justify ? 'justify' : 'start',
		          textIndent: s.indent ? '2em' : '0',
		        },
		      },
		      chapterTitle
		        ? React.createElement('h3', { className: 'dnr-ctitle', style: { textIndent: 0 } }, chapterTitle)
		        : null,
		      paragraphs(s.text, chapterTitle),
		    )
		  }

		  return React.createElement(
		    'div',
		    { className: 'dnr-root', 'data-theme': s.theme === 'auto' ? undefined : s.theme },
		    React.createElement(
		      'div',
		      { className: 'dnr-head' },
		      React.createElement(
		        'div',
		        { className: 'dnr-headrow' },
		        React.createElement(
		          'span',
		          { className: 'dnr-title', title: s.book ? s.book.path : '' },
		          s.book ? s.book.title : '小说阅读器',
		          s.book && s.view === 'read'
		            ? React.createElement(
		                'span',
		                { className: 'dnr-sub' },
		                ' · ' + (s.book.chapters[s.chapterIndex] ? s.book.chapters[s.chapterIndex].title : ''),
		              )
		            : null,
		        ),
		        s.book && s.view === 'read'
		          ? React.createElement('button', { className: 'dnr-btn', title: '添加书签', onClick: addBookmark }, '🔖')
		          : null,
		        React.createElement(
		          'button',
		          { className: 'dnr-btn', title: '一键隐藏（' + hotkeyLabel(s.hotkey) + '）', onClick: hideReader },
		          '🕶',
		        ),
		      ),
		      React.createElement('div', { className: 'dnr-tabs' }, tabs),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-body', ref: contentRef, tabIndex: 0, onScroll: onScroll, onKeyDown: onKeyDown },
		      s.error ? React.createElement('div', { className: 'dnr-err' }, s.error) : null,
		      s.busy ? React.createElement('div', { className: 'dnr-empty' }, '载入中…') : null,
		      !s.busy ? content : null,
		    ),
		    s.view === 'read' && s.book
		      ? React.createElement(
		          'div',
		          { className: 'dnr-foot' },
		          React.createElement(
		            'div',
		            { className: 'dnr-footrow' },
		            React.createElement(
		              'button',
		              {
		                className: 'dnr-btn',
		                disabled: s.chapterIndex <= 0,
		                onClick: function () {
		                  gotoChapter(s.chapterIndex - 1, 0)
		                },
		              },
		              '‹ 上一章',
		            ),
		            React.createElement(
		              'span',
		              { style: { flex: '1 1 auto', textAlign: 'center' } },
		              s.chapterIndex + 1 + ' / ' + s.total + ' · ' + percent + '%',
		            ),
		            React.createElement(
		              'button',
		              {
		                className: 'dnr-btn',
		                disabled: s.chapterIndex >= s.total - 1,
		                onClick: function () {
		                  gotoChapter(s.chapterIndex + 1, 0)
		                },
		              },
		              '下一章 ›',
		            ),
		          ),
		          React.createElement(
		            'div',
		            { className: 'dnr-progress' },
		            React.createElement('i', { style: { width: percent + '%' } }),
		          ),
		        )
		      : null,
		    s.toast ? React.createElement('div', { className: 'dnr-toast' }, s.toast) : null,
		  )
		}

		function ReaderTitle() {
		  const s = useStore(store)
		  return React.createElement('span', { className: 'dnr-chip' }, s.book ? s.book.title : '小说阅读器')
		}

		function SidebarFooterAction(props) {
		  const anchorRef = React.useRef(null)
		  const s = useStore(store)
		  useBossKey(anchorRef)
		  if (!s.enabled || !s.launcherFooter) {
		    // Keep the anchor mounted so the boss key survives; hide the affordance.
		    return React.createElement('span', { ref: anchorRef, style: { display: 'none' } })
		  }
		  const wide = !!(props && props.wide)
		  return React.createElement(
		    'button',
		    {
		      className: 'dnr-footbtn',
		      ref: anchorRef,
		      title: '小说阅读器（老板键 ' + hotkeyLabel(s.hotkey) + '）',
		      onClick: openReader,
		    },
		    React.createElement('span', { style: { fontSize: '14px', lineHeight: 1 } }, '📖'),
		    wide ? React.createElement('span', null, s.book ? s.book.title : '小说') : null,
		  )
		}

		function HeaderAction() {
		  const s = useStore(store)
		  if (!s.enabled || !s.launcherHeader) return null
		  return React.createElement(
		    'button',
		    { className: 'dnr-hbtn', title: '小说阅读器', onClick: openReader },
		    '📖',
		  )
		}

		function FloatingBall() {
		  const s = useStore(store)
		  const anchorRef = React.useRef(null)
		  useBossKey(anchorRef)
		  return React.createElement(
		    'button',
		    {
		      className: 'dnr-fab',
		      ref: anchorRef,
		      style: { display: s.enabled && s.floatingBall ? 'flex' : 'none' },
		      title: '打开小说阅读器（老板键 ' + hotkeyLabel(s.hotkey) + '）',
		      onClick: openReader,
		    },
		    React.createElement('span', { style: { fontSize: '14px', lineHeight: 1 } }, '📖'),
		    React.createElement('span', null, s.book ? s.book.title : '小说阅读器'),
		  )
		}

		// -----------------------------------------------------------------------------
		// Settings card
		// -----------------------------------------------------------------------------

		function Switch(props) {
		  return React.createElement(
		    'button',
		    {
		      className: 'dnr-switch' + (props.value ? ' on' : ''),
		      role: 'switch',
		      'aria-checked': props.value ? 'true' : 'false',
		      'aria-label': props.label,
		      title: props.label,
		      onClick: function () {
		        props.onChange(!props.value)
		      },
		    },
		    React.createElement('i'),
		  )
		}

		function Field(props) {
		  return React.createElement(
		    'div',
		    { className: 'dnr-field' },
		    React.createElement(
		      'label',
		      null,
		      props.label,
		      props.hint ? React.createElement('small', null, props.hint) : null,
		    ),
		    props.children,
		  )
		}

		function SettingsCard() {
		  const s = useStore(store)
		  const pair = React.useState(s.hotkey)
		  const draft = pair[0]
		  const setDraft = pair[1]
		  const dirPair = React.useState(s.defaultDir)
		  const dirDraft = dirPair[0]
		  const setDirDraft = dirPair[1]

		  React.useEffect(
		    function () {
		      setDraft(s.hotkey)
		    },
		    [s.hotkey],
		  )

		  React.useEffect(
		    function () {
		      setDirDraft(s.defaultDir)
		    },
		    [s.defaultDir],
		  )

		  const commitHotkey = function () {
		    const next = String(draft || '').trim()
		    if (next.length === 0 || next === s.hotkey) {
		      setDraft(s.hotkey)
		      return
		    }
		    updateSettings({ hotkey: next })
		  }

		  const commitDir = function () {
		    const next = String(dirDraft || '').trim()
		    if (next === s.defaultDir) {
		      setDirDraft(s.defaultDir)
		      return
		    }
		    updateSettings({ defaultDir: next })
		  }

		  return React.createElement(
		    'div',
		    { className: 'dnr-card' },
		    React.createElement(
		      'div',
		      { className: 'dnr-cardhead' },
		      React.createElement('span', { style: { fontSize: '15px' } }, '📖'),
		      React.createElement('span', { className: 'dnr-cardtitle' }, '小说阅读器'),
		      React.createElement(
		        'span',
		        { className: 'dnr-meta' },
		        s.enabled ? '已启用' : '已关闭',
		      ),
		      React.createElement(Switch, {
		        value: !!s.enabled,
		        label: '启用小说阅读器（总开关）',
		        onChange: function (next) {
		          updateSettings({ enabled: next })
		        },
		      }),
		    ),
		    React.createElement(
		      'p',
		      { className: 'dnr-carddesc' },
		      '在右侧栏阅读本地 txt 小说。右上角开关是总开关：关闭后会立即隐藏所有入口按钮、标签页与老板键。',
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-grid' },
		      React.createElement(
		        Field,
		        { label: '老板键', hint: '如 mod+` 或 ctrl+shift+h' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          value: draft,
		          spellCheck: false,
		          onChange: function (event) {
		            setDraft(event.target.value)
		          },
		          onBlur: commitHotkey,
		          onKeyDown: function (event) {
		            if (event.key === 'Enter') commitHotkey()
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '默认目录', hint: '留空为工作目录' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          value: dirDraft,
		          spellCheck: false,
		          placeholder: '如 D:\\Books',
		          onChange: function (event) {
		            setDirDraft(event.target.value)
		          },
		          onBlur: commitDir,
		          onKeyDown: function (event) {
		            if (event.key === 'Enter') commitDir()
		          },
		        }),
		      ),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-grid' },
		      React.createElement(
		        Field,
		        { label: '老板键行为' },
		        React.createElement(Segmented, {
		          label: '',
		          value: s.hotkeyHidesSidebar ? 'on' : 'off',
		          options: [
		            { value: 'on', label: '收起整个右侧栏' },
		            { value: 'off', label: '只收起阅读器' },
		          ],
		          onChange: function (value) {
		            updateSettings({ hotkeyHidesSidebar: value === 'on' })
		          },
		        }),
		      ),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-seclabel', style: { marginTop: '10px' } },
		      '显示入口',
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-grid' },
		      React.createElement(
		        Field,
		        { label: '左侧栏底部', hint: '设置按钮旁边' },
		        React.createElement(Switch, {
		          value: !!s.launcherFooter,
		          label: '在左侧栏底部显示小说入口按钮',
		          onChange: function (next) {
		            updateSettings({ launcherFooter: next })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '会话标题栏', hint: '对话右上角' },
		        React.createElement(Switch, {
		          value: !!s.launcherHeader,
		          label: '在会话标题栏显示小说入口按钮',
		          onChange: function (next) {
		            updateSettings({ launcherHeader: next })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '右下角悬浮球', hint: '可拖动区域上方' },
		        React.createElement(Switch, {
		          value: !!s.floatingBall,
		          label: '在右下角显示悬浮球入口',
		          onChange: function (next) {
		            updateSettings({ floatingBall: next })
		          },
		        }),
		      ),
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-seclabel', style: { marginTop: '10px' } },
		      '阅读排版',
		    ),
		    React.createElement(
		      'div',
		      { className: 'dnr-grid' },
		      React.createElement(
		        Field,
		        { label: '字号' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          type: 'range',
		          min: 12,
		          max: 30,
		          step: 1,
		          value: s.fontSize,
		          onChange: function (event) {
		            updateSettings({ fontSize: Number(event.target.value) })
		          },
		        }),
		        React.createElement('span', { className: 'dnr-meta' }, s.fontSize + 'px'),
		      ),
		      React.createElement(
		        Field,
		        { label: '行距' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          type: 'range',
		          min: 1.3,
		          max: 2.8,
		          step: 0.05,
		          value: s.lineHeight,
		          onChange: function (event) {
		            updateSettings({ lineHeight: Number(event.target.value) })
		          },
		        }),
		        React.createElement('span', { className: 'dnr-meta' }, Number(s.lineHeight).toFixed(2)),
		      ),
		      React.createElement(
		        Field,
		        { label: '字体' },
		        React.createElement(Segmented, {
		          label: '',
		          value: s.family,
		          options: [
		            { value: 'serif', label: '宋体' },
		            { value: 'sans', label: '黑体' },
		            { value: 'kai', label: '楷体' },
		          ],
		          onChange: function (value) {
		            updateSettings({ family: value })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '配色' },
		        React.createElement(Segmented, {
		          label: '',
		          value: s.theme,
		          options: [
		            { value: 'auto', label: '跟随 DSH' },
		            { value: 'sepia', label: '护眼' },
		            { value: 'dark', label: '夜间' },
		            { value: 'light', label: '明亮' },
		          ],
		          onChange: function (value) {
		            updateSettings({ theme: value })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '排版细节' },
		        React.createElement(Segmented, {
		          label: '',
		          value: s.indent ? 'on' : 'off',
		          options: [
		            { value: 'on', label: '缩进' },
		            { value: 'off', label: '不缩进' },
		          ],
		          onChange: function (value) {
		            updateSettings({ indent: value === 'on' })
		          },
		        }),
		        React.createElement(Segmented, {
		          label: '',
		          value: s.justify ? 'on' : 'off',
		          options: [
		            { value: 'on', label: '两端对齐' },
		            { value: 'off', label: '左对齐' },
		          ],
		          onChange: function (value) {
		            updateSettings({ justify: value === 'on' })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '切分粒度', hint: '无章节标题时的分段字数' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          type: 'number',
		          min: 1000,
		          step: 500,
		          value: s.fallbackChunkChars,
		          onChange: function (event) {
		            const next = Number(event.target.value)
		            if (Number.isFinite(next) && next >= 1000) updateSettings({ fallbackChunkChars: Math.round(next) })
		          },
		        }),
		      ),
		      React.createElement(
		        Field,
		        { label: '文件上限', hint: '单个 txt 的读取上限' },
		        React.createElement('input', {
		          className: 'dnr-input',
		          type: 'number',
		          min: 1,
		          step: 1,
		          value: Math.round(s.maxBookBytes / 1048576),
		          onChange: function (event) {
		            const next = Number(event.target.value)
		            if (Number.isFinite(next) && next >= 1) updateSettings({ maxBookBytes: Math.round(next) * 1048576 })
		          },
		        }),
		        React.createElement('span', { className: 'dnr-meta' }, 'MB'),
		      ),
		    ),
		    React.createElement(
		      'p',
		      { className: 'dnr-note' },
		      s.settingsReady
		        ? '设置已接入 DSH 设置存储，修改会立即生效并持久化到 settings.yaml。'
		        : '尚未接入 DSH 设置存储：修改仅对当前进程生效。',
		    ),
		  )
		}

		// -----------------------------------------------------------------------------
		// Plugin body
		// -----------------------------------------------------------------------------

		const inject = ['slots']

		function apply(ctx) {
		  ctxRef = ctx

		  const slots = ctx.get('slots')
		  if (slots === undefined) {
		    console.error('[' + NAME + '] ctx.slots unavailable; the reader was not registered')
		    return
		  }

		  // Bind the settings namespace; wait for the service if it mounts later.
		  const binder = ctx.get('settingsScope')
		  if (binder !== undefined) {
		    attachSettingsScope(binder)
		  } else if (typeof ctx.inject === 'function') {
		    ctx.inject(['settingsScope'], function (scoped) {
		      attachSettingsScope(scoped.get('settingsScope'))
		    })
		  }

		  const tabs = ctx.get('sidebarRightTabs')
		  if (tabs !== undefined) {
		    ctx.effect(function () {
		      return tabs.register({
		        id: READER_ID,
		        kind: KIND,
		        title: function () {
		          const snapshot = store.read()
		          return snapshot.book ? snapshot.book.title : '小说阅读器'
		        },
		        guide: [
		          {
		            order: 40,
		            title: function () {
		              return '小说阅读器'
		            },
		            description: function () {
		              return '阅读本地 txt 小说，老板键一键隐藏'
		            },
		            icon: ReaderIcon,
		          },
		        ],
		      })
		    })
		  } else {
		    console.error('[' + NAME + '] ctx.sidebarRightTabs unavailable; the tab type was not registered')
		  }

		  ctx.effect(function () {
		    return slots.inject('sidebar.right.pane.tab', function () {
		      return slots.register({ name: 'sidebar.right.pane.tab', key: READER_ID }, ReaderBody)
		    })
		  })

		  ctx.effect(function () {
		    return slots.inject('sidebar.right.pane.tab.title', function () {
		      return slots.register({ name: 'sidebar.right.pane.tab.title', key: READER_ID }, ReaderTitle)
		    })
		  })

		  ctx.effect(function () {
		    return slots.inject('sidebar.footer.action', function () {
		      return slots.register(
		        { name: 'sidebar.footer.action', id: READER_ID + ':launcher', order: 5, label: '小说阅读器' },
		        SidebarFooterAction,
		      )
		    })
		  })

		  ctx.effect(function () {
		    return slots.inject('conversation.session.header.utilities', function () {
		      return slots.register(
		        { name: 'conversation.session.header.utilities', id: READER_ID + ':header', order: 20, label: '小说阅读器' },
		        HeaderAction,
		      )
		    })
		  })

		  ctx.effect(function () {
		    return slots.inject('shell.overlay', function () {
		      return slots.register({ name: 'shell.overlay', id: READER_ID + ':fab', order: 50 }, FloatingBall)
		    })
		  })

		  // Settings → 插件 → 插件配置 card, dispatched by settings namespace.
		  ctx.effect(function () {
		    return slots.inject('settings.plugin.item', function () {
		      return slots.register({ name: 'settings.plugin.item', key: SETTINGS_NS }, SettingsCard)
		    })
		  })
		}

		exports.name = NAME
		exports.inject = inject
		exports.apply = apply

		return module.exports;
	}
});
