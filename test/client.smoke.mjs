/**
 * Client-half smoke test.
 *
 * Loads the built `client/client.js` in a fake `window.__ModuleLoader__`, mounts
 * it against a stand-in client context, then renders and drives the components
 * it registered. This is the check that catches what a browser would otherwise
 * report as a blank panel: a bad hook order, a typo in a slot key, a launcher
 * that ignores the enable switch, or a settings write that never reaches the
 * scope.
 *
 * Run: node test/client.smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TestRenderer from 'react-test-renderer'

const { act } = TestRenderer
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const here = dirname(fileURLToPath(import.meta.url))
const bundleSource = readFileSync(join(here, '..', 'client', 'client.js'), 'utf8')

/** Settings every scenario starts from, unless it overrides one. */
const BASE_SETTINGS = {
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

/**
 * Evaluate the bundle in a throwaway window and build the client context.
 *
 * The bundle keeps its state in module scope, so every scenario re-evaluates the
 * source rather than reusing an earlier mount.
 * @param overrides - settings the bound scope should report.
 * @param options - `withSettings: false` models a composition-only install.
 */
function mount(overrides = {}, options = {}) {
  const withSettings = options.withSettings !== false

  let definition = null
  const win = {
    __ModuleLoader__: {
      load(candidate) {
        definition = candidate
      },
    },
  }
  // eslint-disable-next-line no-new-func
  new Function('window', bundleSource)(win)
  if (definition === null) throw new Error('the bundle never called window.__ModuleLoader__.load')

  const registered = []
  const injected = []
  const mutations = []
  let tabDefinition = null
  let snapshot = {
    status: 'ready',
    value: Object.assign({}, BASE_SETTINGS, overrides),
    base: {},
    user: {},
    revision: 7,
    writable: true,
    mode: 'host',
  }

  const slotsService = {
    inject(key, callback) {
      injected.push(key)
      const dispose = callback()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    register(slotOptions, component) {
      registered.push({ options: slotOptions, component })
      return () => {}
    },
  }

  const services = {
    slots: slotsService,
    sidebarRightTabs: {
      register(candidate) {
        tabDefinition = candidate
        return () => {}
      },
    },
    sidebarRight: { openTab() {}, isExpanded: () => false, toggleExpanded() {} },
    settingsScope: withSettings
      ? {
          bind() {
            return {
              getSnapshot: () => snapshot,
              subscribe: () => () => {},
              set: async () => {},
              unset: async () => {},
              mutate: async (ops) => {
                mutations.push(ops)
              },
            }
          },
        }
      : undefined,
  }

  const ctx = {
    get: (name) => services[name],
    effect(callback) {
      const dispose = callback()
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
  }

  const exported = definition.factory((id) => {
    if (id === 'react') return React
    throw new Error('unexpected require(' + JSON.stringify(id) + ')')
  })

  return {
    moduleId: definition.id,
    exported,
    ctx,
    services,
    injected,
    mutations,
    registered,
    get tabDefinition() {
      return tabDefinition
    },
    setSnapshot(value) {
      snapshot = Object.assign({}, snapshot, { value: Object.assign({}, snapshot.value, value) })
    },
    componentFor(slotName) {
      const hit = registered.find((entry) => entry.options.name === slotName)
      return hit === undefined ? undefined : hit.component
    },
    optionsFor(slotName) {
      const hit = registered.find((entry) => entry.options.name === slotName)
      return hit === undefined ? undefined : hit.options
    },
  }
}

function mountAndApply(overrides, options) {
  const app = mount(overrides, options)
  app.exported.apply(app.ctx)
  return app
}

const results = []
function check(label, ok, detail) {
  results.push({ label, ok: !!ok, detail: detail === undefined ? '' : String(detail) })
}

function html(component) {
  return renderToStaticMarkup(React.createElement(component, {}))
}

/** Let the settings write debounce (250 ms) elapse inside act(). */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 320))
  })
}

const SLOT_KEYS = [
  'sidebar.right.pane.tab',
  'sidebar.right.pane.tab.title',
  'sidebar.footer.action',
  'conversation.session.header.utilities',
  'shell.overlay',
  'settings.plugin.item',
]

// --- bundle envelope ---------------------------------------------------------
{
  const app = mount()
  check('bundle registers under the package name', app.moduleId === 'dsh-moyu-reader', app.moduleId)
  check(
    'exports name / inject / apply',
    app.exported.name === 'dsh-moyu-reader' &&
      Array.isArray(app.exported.inject) &&
      typeof app.exported.apply === 'function',
    Object.keys(app.exported).join(','),
  )
}

// --- registration ------------------------------------------------------------
{
  const app = mountAndApply()
  for (const key of SLOT_KEYS) {
    check(`injects slot ${key}`, app.injected.includes(key), app.injected.join(', '))
  }
}

{
  const app = mountAndApply()
  const tab = app.tabDefinition
  check(
    'registers the reader tab type',
    tab !== null && tab.id === 'dsh-moyu-reader' && tab.kind === 'moyu-reader',
    JSON.stringify(tab && { id: tab.id, kind: tab.kind }),
  )
  check('tab title falls back to a label', tab.title('') === '小说阅读器', tab.title(''))
  check('tab contributes one guide entry', tab.guide.length === 1, tab.guide.length)
  check(
    'guide entry is localized by thunk',
    typeof tab.guide[0].title === 'function' && tab.guide[0].title() === '小说阅读器',
    '',
  )
  check(
    'settings card is keyed by the settings namespace',
    app.optionsFor('settings.plugin.item').key === 'dsh-moyu-reader',
    app.optionsFor('settings.plugin.item').key,
  )
  check(
    'reader body is keyed by the tab type id',
    app.optionsFor('sidebar.right.pane.tab').key === 'dsh-moyu-reader',
    app.optionsFor('sidebar.right.pane.tab').key,
  )
  check(
    'launchers carry distinct slot ids',
    app.optionsFor('sidebar.footer.action').id !== app.optionsFor('conversation.session.header.utilities').id,
    '',
  )
}

// --- rendering, enabled ------------------------------------------------------
{
  const app = mountAndApply()
  const body = html(app.componentFor('sidebar.right.pane.tab'))
  check('reader body renders its header', body.includes('小说阅读器'), '')
  check('reader body renders the shelf tab', body.includes('书架'), '')
  check('reader body renders the boss-key button', body.includes('🕶'), '')
  check('reader body renders all four tabs', ['书架', '目录', '搜索', '设置'].every((t) => body.includes(t)), '')

  const footer = html(app.componentFor('sidebar.footer.action'))
  check('footer launcher renders when enabled', footer.includes('📖'), footer.slice(0, 80))
  check('footer launcher advertises the resolved hotkey', footer.includes('Ctrl + `'), footer)

  const header = html(app.componentFor('conversation.session.header.utilities'))
  check('header launcher renders when enabled', header.includes('📖'), header.slice(0, 80))

  const fab = html(app.componentFor('shell.overlay'))
  check('floating ball is hidden by default', fab.includes('display:none'), '')
  check('floating ball still mounts as a boss-key anchor', fab.includes('📖'), '')

  const card = html(app.componentFor('settings.plugin.item'))
  check('settings card renders its title', card.includes('小说阅读器'), '')
  check('settings card shows the enable switch', card.includes('role="switch"'), '')
  check('settings card reports the settings backend', card.includes('已接入 DSH 设置存储'), '')
  check('settings card edits the raw hotkey spec', card.includes('value="mod+`"'), '')
  check(
    'settings card covers hotkey, launchers and typography',
    ['老板键', '显示入口', '阅读排版', '切分粒度', '文件上限'].every((section) => card.includes(section)),
    '',
  )
  check(
    'each launcher is labelled where it appears',
    ['左侧栏底部', '会话标题栏', '右下角悬浮球'].every((where) => card.includes(where)),
    '',
  )
  check('the master switch says what it is', card.includes('启用小说阅读器（总开关）'), '')
  check('the master switch reports its state in words', card.includes('已启用'), '')
  check('settings card shows the current font size', card.includes('17px'), '')
}

// --- rendering, disabled -----------------------------------------------------
{
  const app = mountAndApply({ enabled: false })
  const body = html(app.componentFor('sidebar.right.pane.tab'))
  check('disabled reader body explains itself', body.includes('已在设置中关闭'), '')
  check('disabled reader body drops the tabs', !body.includes('📚 书架'), '')

  const footer = html(app.componentFor('sidebar.footer.action'))
  check('disabled footer launcher hides the icon', !footer.includes('📖'), footer.slice(0, 80))
  check('disabled footer keeps the boss-key anchor', footer.includes('display:none'), '')

  const header = html(app.componentFor('conversation.session.header.utilities'))
  check('disabled header launcher renders nothing', header === '', JSON.stringify(header))

  const fab = html(app.componentFor('shell.overlay'))
  check('disabled floating ball stays hidden', fab.includes('display:none'), '')
}

// --- individual launcher switches -------------------------------------------
{
  const footerOff = html(mountAndApply({ launcherFooter: false }).componentFor('sidebar.footer.action'))
  check('launcherFooter=false hides the footer icon', !footerOff.includes('📖'), '')

  const headerOff = html(
    mountAndApply({ launcherHeader: false }).componentFor('conversation.session.header.utilities'),
  )
  check('launcherHeader=false hides the header icon', headerOff === '', JSON.stringify(headerOff))

  const fabOn = html(mountAndApply({ floatingBall: true }).componentFor('shell.overlay'))
  check('floatingBall=true shows the ball', fabOn.includes('display:flex'), '')
}

// --- settings write path -----------------------------------------------------
{
  const app = mountAndApply()
  const card = app.componentFor('settings.plugin.item')
  let tree = null
  await act(async () => {
    tree = TestRenderer.create(React.createElement(card, {}))
  })

  const switches = tree.root.findAll((node) => node.props && node.props.role === 'switch')
  check('card exposes the enable switch plus three launcher switches', switches.length === 4, switches.length)
  check(
    'the enable switch comes first and starts on',
    switches[0].props['aria-checked'] === 'true',
    switches[0].props['aria-checked'],
  )

  await act(async () => {
    switches[0].props.onClick()
  })
  await settle()
  check('toggling the switch writes exactly once', app.mutations.length === 1, JSON.stringify(app.mutations))
  check(
    'the write is a single set op on enabled=false',
    app.mutations.length === 1 &&
      app.mutations[0].length === 1 &&
      app.mutations[0][0].op === 'set' &&
      app.mutations[0][0].path[0] === 'enabled' &&
      app.mutations[0][0].value === false,
    JSON.stringify(app.mutations[0]),
  )
  tree.unmount()
}

{
  const app = mountAndApply()
  const card = app.componentFor('settings.plugin.item')
  let tree = null
  await act(async () => {
    tree = TestRenderer.create(React.createElement(card, {}))
  })

  const dark = tree.root.findAll(
    (node) => node.type === 'button' && Array.isArray(node.children) && node.children.join('') === '夜间',
  )
  check('theme control exposes the dark option', dark.length === 1, dark.length)
  await act(async () => {
    dark[0].props.onClick()
  })
  await settle()
  check(
    'choosing a theme writes the theme field',
    app.mutations.length === 1 && app.mutations[0][0].path[0] === 'theme' && app.mutations[0][0].value === 'dark',
    JSON.stringify(app.mutations[0]),
  )
  tree.unmount()
}

{
  // A slider drag fires continuously; the write must be coalesced into one call.
  const app = mountAndApply()
  const card = app.componentFor('settings.plugin.item')
  let tree = null
  await act(async () => {
    tree = TestRenderer.create(React.createElement(card, {}))
  })
  const sliders = tree.root.findAll((node) => node.type === 'input' && node.props.type === 'range')
  check('card exposes two range sliders', sliders.length === 2, sliders.length)
  await act(async () => {
    for (const value of [18, 19, 20, 21, 22]) {
      sliders[0].props.onChange({ target: { value: String(value) } })
    }
  })
  await settle()
  check('a slider drag coalesces into one write', app.mutations.length === 1, app.mutations.length)
  check(
    'the coalesced write carries the final value',
    app.mutations.length === 1 && app.mutations[0][0].path[0] === 'fontSize' && app.mutations[0][0].value === 22,
    JSON.stringify(app.mutations[0]),
  )
  tree.unmount()
}

{
  // The hotkey field commits on blur, not per keystroke.
  const app = mountAndApply()
  const card = app.componentFor('settings.plugin.item')
  let tree = null
  await act(async () => {
    tree = TestRenderer.create(React.createElement(card, {}))
  })
  const inputs = tree.root.findAll(
    (node) => node.type === 'input' && node.props.type === undefined && node.props.value === 'mod+`',
  )
  check('hotkey field renders the stored value', inputs.length === 1, inputs.length)
  await act(async () => {
    inputs[0].props.onChange({ target: { value: 'ctrl+shift+h' } })
  })
  await settle()
  check('typing alone does not write', app.mutations.length === 0, JSON.stringify(app.mutations))
  await act(async () => {
    inputs[0].props.onBlur()
  })
  await settle()
  check(
    'blurring commits the hotkey',
    app.mutations.length === 1 &&
      app.mutations[0][0].path[0] === 'hotkey' &&
      app.mutations[0][0].value === 'ctrl+shift+h',
    JSON.stringify(app.mutations[0]),
  )
  tree.unmount()
}

// --- no settings backend -----------------------------------------------------
{
  const app = mountAndApply({}, { withSettings: false })
  const card = html(app.componentFor('settings.plugin.item'))
  check('mounts without a settings backend', app.registered.length === 6, app.registered.length)
  check('card reports the degraded backend', card.includes('尚未接入 DSH 设置存储'), '')
  const body = html(app.componentFor('sidebar.right.pane.tab'))
  check('reader still renders without a settings backend', body.includes('书架'), '')
}

// --- boss key ----------------------------------------------------------------
/**
 * Mount a launcher whose anchor node reports a fake document, then drive the
 * keydown listener it installed. This is the only way to exercise the boss key
 * without a browser, and it is the feature the plugin exists for.
 */
async function bossKeyHarness(overrides) {
  const app = mount(overrides)
  const calls = []
  let expanded = false
  app.services.sidebarRight = {
    isExpanded: () => expanded,
    openTab: (kind) => calls.push(['openTab', kind]),
    toggleExpanded: () => {
      calls.push(['toggleExpanded'])
      expanded = !expanded
    },
  }
  app.exported.apply(app.ctx)

  const listeners = []
  const fakeDocument = {
    addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }),
    removeEventListener: () => {},
  }
  await act(async () => {
    app.tree = TestRenderer.create(React.createElement(app.componentFor('sidebar.footer.action'), {}), {
      createNodeMock: () => ({ ownerDocument: fakeDocument }),
    })
  })

  const press = (init) => {
    const event = Object.assign(
      {
        key: '`',
        code: 'Backquote',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        prevented: false,
        stopped: false,
        preventDefault() {
          this.prevented = true
        },
        stopPropagation() {
          this.stopped = true
        },
      },
      init,
    )
    listeners[0].handler(event)
    return event
  }

  return {
    app,
    calls,
    listeners,
    press,
    setExpanded(value) {
      expanded = value
    },
  }
}

{
  const boss = await bossKeyHarness()
  check(
    'boss key installs one capture-phase keydown listener',
    boss.listeners.length === 1 && boss.listeners[0].type === 'keydown' && boss.listeners[0].capture === true,
    JSON.stringify(boss.listeners.map((entry) => entry.type + '/' + entry.capture)),
  )

  // Negative cases come first: the 300 ms double-fire guard would otherwise
  // make every later press a no-op and hide a broken match.
  boss.press({})
  check('a bare backquote is ignored', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.press({ ctrlKey: true, shiftKey: true })
  check('ctrl+shift+backquote is ignored', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.press({ ctrlKey: true, metaKey: true })
  check('ctrl+cmd+backquote is ignored', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.press({ ctrlKey: true, altKey: true })
  check('ctrl+alt+backquote is ignored', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.press({ ctrlKey: true, code: 'KeyK', key: 'k' })
  check('ctrl+k is ignored', boss.calls.length === 0, JSON.stringify(boss.calls))

  const fired = boss.press({ ctrlKey: true })
  check('ctrl+backquote opens the reader', boss.calls.length === 1 && boss.calls[0][0] === 'openTab', JSON.stringify(boss.calls))
  check('the matched press is swallowed', fired.prevented === true && fired.stopped === true, '')

  // Wait out the double-fire guard before the next real toggle.
  await new Promise((resolve) => setTimeout(resolve, 320))
  boss.setExpanded(true)
  boss.press({ ctrlKey: true })
  check(
    'pressing again with the sidebar open collapses it',
    boss.calls.length === 2 && boss.calls[1][0] === 'toggleExpanded',
    JSON.stringify(boss.calls),
  )
  boss.app.tree.unmount()
}

{
  // With the sidebar-hiding behaviour off, the second press must not collapse.
  const boss = await bossKeyHarness({ hotkeyHidesSidebar: false })
  boss.press({ ctrlKey: true })
  await new Promise((resolve) => setTimeout(resolve, 320))
  boss.setExpanded(true)
  boss.press({ ctrlKey: true })
  check(
    'hotkeyHidesSidebar=false opens without ever collapsing',
    boss.calls.length === 1 && boss.calls[0][0] === 'openTab',
    JSON.stringify(boss.calls),
  )
  boss.app.tree.unmount()
}

{
  // The master switch must disable the boss key along with every launcher.
  const boss = await bossKeyHarness({ enabled: false })
  boss.press({ ctrlKey: true })
  check('the boss key is inert while the plugin is off', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.app.tree.unmount()
}

{
  // A user-defined hotkey must be honoured, including the letter form.
  const boss = await bossKeyHarness({ hotkey: 'ctrl+shift+h' })
  boss.press({ ctrlKey: true })
  check('the default hotkey stops matching once changed', boss.calls.length === 0, JSON.stringify(boss.calls))
  boss.press({ ctrlKey: true, shiftKey: true, key: 'h', code: 'KeyH' })
  check('a custom ctrl+shift+h fires', boss.calls.length === 1 && boss.calls[0][0] === 'openTab', JSON.stringify(boss.calls))
  boss.app.tree.unmount()
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
