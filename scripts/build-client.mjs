/**
 * Wrap `src/client.js` in the DSH client module envelope and write
 * `client/client.js`.
 *
 * The client module system loads a browser plugin as a lazy CommonJS factory
 * registered on `window.__ModuleLoader__`. A plugin with no third-party
 * dependencies beyond React needs no bundler for this — only the envelope — so
 * this script is the whole build.
 *
 * Usage:
 *   node scripts/build-client.mjs           # build once
 *   node scripts/build-client.mjs --watch   # rebuild on change
 */
import { mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'src', 'client.js')
const outputDir = join(root, 'client')
const outputPath = join(outputDir, 'client.js')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Indent every non-empty line by two tabs, keeping the envelope readable. */
function indent(text) {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? '\t\t' + line : line))
    .join('\n')
}

function build() {
  const source = readFileSync(sourcePath, 'utf8')

  // Compile without executing: this catches a syntax error here rather than as
  // a silent load failure in the browser.
  try {
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', source)
  } catch (error) {
    throw new Error(`src/client.js does not parse: ${error.message}`)
  }

  const bundle =
    'window.__ModuleLoader__.load({\n' +
    `\tid: ${JSON.stringify(pkg.name)},\n` +
    '\tfactory: (require) => {\n' +
    '\t\tvar module = { exports: {} };\n' +
    '\t\tvar exports = module.exports;\n' +
    '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n' +
    indent(source) +
    '\n' +
    '\t\treturn module.exports;\n' +
    '\t}\n' +
    '});\n'

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputPath, bundle, 'utf8')
  return bundle.length
}

const bytes = build()
console.log(`built client/client.js (${bytes} bytes) for module id "${pkg.name}"`)

if (process.argv.includes('--watch')) {
  console.log('watching src/client.js …')
  let timer = null
  watch(sourcePath, () => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        console.log(`rebuilt (${build()} bytes)`)
      } catch (error) {
        console.error(error.message)
      }
    }, 80)
  })
}
