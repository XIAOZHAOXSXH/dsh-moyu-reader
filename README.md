# dsh-moyu-reader

Read local `.txt` novels in the DSH web UI's right sidebar — with a boss key.

[中文说明](./README.zh.md)

## Features

- **A reader in the right sidebar.** It opens as a tab beside the conversation
  rather than as a modal, so a glance never costs you your place.
- **One-key hide (boss key).** Defaults to <kbd>Ctrl</kbd>+<kbd>`</kbd>
  (<kbd>⌘</kbd>+<kbd>`</kbd> on macOS). Configure it to collapse only the reader,
  or the whole right sidebar with it.
- **Three launchers.** A button in the left sidebar footer, one in the session
  header, and a floating ball in the bottom-right corner. Each can be turned off
  independently.
- **Shelf.** Browse local directories, with text files filtered out of the noise
  and recently opened books remembered.
- **Automatic chapter splitting.** Recognizes `第一章`, `第 1 章`, `Chapter 1`,
  and similar headings; falls back to fixed-size chunks when a file has none.
- **Chinese encoding detection.** UTF-8, UTF-8 with BOM, UTF-16 LE/BE,
  GB18030/GBK, and Big5 — including the hard case of a GBK file that is 99%
  ASCII and therefore looks like valid UTF-8.
- **Search, bookmarks, reading progress.** Full-text search with snippets;
  reopening a book returns you to where you stopped.
- **Adjustable typography.** Font size, line height, family (serif / sans / kai),
  theme (follow DSH / sepia / dark / light), first-line indent, justification.
- **Wired into DSH settings.** Every option lives in the plugin's card under
  **Settings → Plugins**, takes effect immediately, and persists to
  `settings.yaml`.

## Install

```sh
dsh plugin --profile web add dsh-moyu-reader
```

Then restart the profile. The package declares its own bundle patch, so the
plugin row is mounted for you — do not also add a manual `insert` row to the
profile's `cordis.patch.yml`, or it will mount twice.

## Usage

Open the reader from any of the three launchers, or pick the
**小说阅读器** tab in the right sidebar. Press the boss key to hide it.

## Settings

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch. Off hides every launcher, tab and the boss key. |
| `hotkey` | `mod+\`` | Boss key. `mod` is Ctrl on Windows/Linux and ⌘ on macOS. |
| `hotkeyHidesSidebar` | `true` | Also collapse the whole right sidebar, not just the reader. |
| `launcherFooter` | `true` | Show the launcher in the left sidebar footer. |
| `launcherHeader` | `true` | Show the launcher in the session header. |
| `floatingBall` | `false` | Show the floating ball in the bottom-right corner. |
| `defaultDir` | *(working directory)* | Directory the shelf opens in. |
| `theme` | `auto` | `auto` / `sepia` / `dark` / `light`. |
| `fontSize` | `17` | Reader font size in px (12–30). |
| `lineHeight` | `1.95` | Line height (1.3–2.8). |
| `family` | `serif` | `serif` / `sans` / `kai`. |
| `indent` | `true` | Indent the first line of each paragraph. |
| `justify` | `true` | Justify body text. |
| `maxBookBytes` | `100663296` | Largest file the host will read, in bytes. |
| `fallbackChunkChars` | `6000` | Chunk size used when a file has no chapter headings. |

Turning the plugin off does **not** delete your saved reading state.

## How it works

Two halves, as a DSH plugin requires:

- **Host** (`lib/index.js`) reads files through the `fs` service and serves a
  small JSON bridge over `webServer` at `POST /dsh-moyu-reader/api`. The route
  is exact-match, rejects a mismatched `Origin`, and caps request bodies at 1
  MiB. It holds the book cache and the process-local reading state.
- **Client** (`client/client.js`) is a browser module — a plain lazy-CJS factory
  registered on `window.__ModuleLoader__`, no bundler involved. It renders into
  six slots and binds the `dsh-moyu-reader` settings namespace so the settings
  card and the reader's own settings tab write through the same scope.

Both halves talk only through the bridge route; nothing else crosses.

## Known limitations

- Reading state (recent books, progress, bookmarks) is **process-local**. It
  survives closing the reader but not restarting DSH. Only configuration is
  persisted. Moving it to the storage domain is the obvious follow-up.
- The reader is read-only: it will not write to your files.
- Chapter detection is heuristic. Unusual heading styles may fall back to
  fixed-size chunks.

## Development

```sh
npm install
npm run build     # emit client/client.js from src/client.js
npm test          # 45 host checks + 67 client checks
npm run watch     # rebuild the client bundle on change
```

`src/client.js` is the source of truth for the client half; `client/client.js`
is generated and should not be edited by hand. The test suites mount the real
shipped code — the host suite drives the bridge route against a stand-in `fs`
service, and the client suite renders the bundle with React, drives its
controls, and fires the boss key at a fake document.

## License

MIT
