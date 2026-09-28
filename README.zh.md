# dsh-moyu-reader

在 DSH Web 界面的右侧栏里读本地 txt 小说，配一个老板键。

[English](./README.md)

## 特性

- **右侧栏阅读器。** 它作为右侧栏的一个标签页打开，和对话并排，而不是弹窗——
  瞄一眼不会让你丢失当前的位置。
- **一键隐藏（老板键）。** 默认 <kbd>Ctrl</kbd>+<kbd>`</kbd>（macOS 为
  <kbd>⌘</kbd>+<kbd>`</kbd>）。可以只收起阅读器，也可以连整个右侧栏一起收起。
- **三处入口。** 左侧栏底部按钮、会话标题栏按钮、右下角悬浮球，各自可独立关闭。
- **书架。** 浏览本地目录，自动把文本文件从一堆杂项里筛出来，并记住最近打开的书。
- **自动章节切分。** 识别 `第一章`、`第 1 章`、`Chapter 1` 等标题；没有标题时按字数分段。
- **中文编码识别。** UTF-8、UTF-8 BOM、UTF-16 LE/BE、GB18030/GBK、Big5——
  包括"99% 是 ASCII 的 GBK 文件看起来像合法 UTF-8"这种最容易误判的情况。
- **搜索、书签、阅读进度。** 全文搜索带上下文摘要；重新打开一本书会回到上次停下的位置。
- **排版可调。** 字号、行距、字体（宋/黑/楷）、配色（跟随 DSH / 护眼 / 夜间 / 明亮）、
  首行缩进、两端对齐。
- **接入 DSH 设置。** 所有选项都在 **设置 → 插件** 里本插件的卡片上，改完立即生效，
  并持久化到 `settings.yaml`。

## 安装

```sh
dsh plugin --profile web add dsh-moyu-reader
```

然后重启 profile。本包自带 bundle patch，插件行会自动挂载——不要再往 profile 的
`cordis.patch.yml` 里手工加 `insert` 行，否则会挂载两次。

## 使用

从三处入口任意一处打开阅读器，或者在右侧栏选择 **小说阅读器** 标签页。
按老板键即可隐藏。

## 设置项

| 键 | 默认值 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 总开关。关闭后所有入口、标签页与老板键一起隐藏。 |
| `hotkey` | `mod+\`` | 老板键。`mod` 在 Windows/Linux 上是 Ctrl，在 macOS 上是 ⌘。 |
| `hotkeyHidesSidebar` | `true` | 连整个右侧栏一起收起，而不只是阅读器。 |
| `launcherFooter` | `true` | 在左侧栏底部显示入口。 |
| `launcherHeader` | `true` | 在会话标题栏显示入口。 |
| `floatingBall` | `false` | 在右下角显示悬浮球。 |
| `defaultDir` | *（工作目录）* | 书架默认打开的目录。 |
| `theme` | `auto` | `auto` / `sepia` / `dark` / `light`。 |
| `fontSize` | `17` | 正文字号（px，12–30）。 |
| `lineHeight` | `1.95` | 行距（1.3–2.8）。 |
| `family` | `serif` | `serif` / `sans` / `kai`。 |
| `indent` | `true` | 段首缩进两格。 |
| `justify` | `true` | 正文两端对齐。 |
| `maxBookBytes` | `100663296` | 宿主愿意读取的单文件上限（字节）。 |
| `fallbackChunkChars` | `6000` | 没有章节标题时的分段字数。 |

关闭插件**不会**删除已保存的阅读状态。

## 实现说明

按 DSH 插件的要求分成两半：

- **宿主端**（`lib/index.js`）通过 `fs` 服务读取文件，并在 `webServer` 上暴露一个
  小型 JSON 桥接路由 `POST /dsh-moyu-reader/api`。该路由为精确匹配，会拒绝
  `Origin` 不匹配的请求，请求体上限 1 MiB。书籍缓存与进程内的阅读状态都放在这里。
- **客户端**（`client/client.js`）是一个浏览器模块——注册在
  `window.__ModuleLoader__` 上的惰性 CJS 工厂，不需要打包器。它渲染到六个 slot，
  并绑定 `dsh-moyu-reader` 设置命名空间，因此设置页卡片和阅读器自己的设置页
  写的是同一个 scope。

两半之间只通过桥接路由通信，没有别的通道。

## 已知限制

- 阅读状态（最近打开、进度、书签）是**进程内**的。关掉阅读器还在，重启 DSH 就没了。
  只有配置会持久化。迁到 storage domain 是最自然的后续改进。
- 阅读器只读，不会写你的文件。
- 章节识别是启发式的。标题风格特殊时可能退化成按字数分段。

## 开发

```sh
npm install
npm run build     # 由 src/client.js 生成 client/client.js
npm test          # 45 项宿主端检查 + 67 项客户端检查
npm run watch     # 改动时自动重建客户端 bundle
```

`src/client.js` 是客户端那一半的源头；`client/client.js` 是生成产物，不要手改。
测试直接挂载真实发布的代码——宿主端测试对着一个替身 `fs` 服务驱动桥接路由，
客户端测试用 React 渲染 bundle、操作它的控件，并把老板键事件打到一个假 document 上。

## 许可证

MIT
