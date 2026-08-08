## Why

用户需要在客户端内快速预览本地 HTML 文件，而不是跳到系统默认浏览器。先前仅文件内容区有入口、且一度走 `plugin-opener` 外部浏览器，与「内置 Browser Agent」产品方向不一致；同时 Git 文件列表与文件树缺少一键入口。本 change 统一走内置浏览器，并扩展入口面。

## 目标与边界

- 仅 `.html` / `.htm`（大小写不敏感）可触发「在浏览器打开」。
- 打开路径：**内置 Browser Agent**（`createBrowserAgentSession` + `openBrowserAgentWindow`），使用 `file://` URL。
- 入口：
  1. 文件内容区右键（`FileViewPanel`，编辑/预览共用）
  2. 文件树行 hover/选中 **Globe** 图标 + 右键菜单项
  3. Git Changes 文件行行尾 **Globe** 图标（单仓 + 多仓）
- 路径解析：相对路径兜底为 workspace 绝对路径；Git 路径经 `resolveRepositoryWorkspaceFilePath` 再拼绝对路径。
- Browser Agent URL 策略：允许 `file://` **仅** 本地 HTML（`.html`/`.htm`）；其它 `file://` 类型仍拦截。
- 失败：非阻塞 toast / file-tree notice，应用不崩溃。
- detached 文件树：保留浏览器图标，仍隐藏「@ 提及」按钮。

## 非目标

- 不新增本地 HTTP 静态服务器 / 代理。
- 不处理 tab 右键（`openTabContextMenu`）入口（可另提案）。
- 不改 Browser Agent 的 AI capture / snapshot 语义（仅导航策略 + 入口）。
- 不把 `openPath` 当默认（避免落到系统关联编辑器）。
- 不自动 git commit（交用户验收后提交）。

## What Changes

- 新增 util `openHtmlInBrowser.ts`：`isHtmlFilePath` / `buildLocalFileUrl` / `openHtmlInBrowser`。
- Rust `validate_browser_url_for_workspace`：放行 `file://` + `.html`/`.htm`。
- `BrowserDock` URL 草稿归一化：保留 `file://`，不强制加 `https://`。
- `FileViewPanel` 内容区右键条件项。
- `FileTreeRows` / `FileTreePanel`：行内 Globe + 右键项。
- `DiffFileRow` / `GitDiffPanel` / `GitMultiRepositoryChanges`：行内 Globe。
- i18n：`files.openInBrowser`（10 locales）。
- 测试：util + FileViewPanel + FileTreeRows。

## 方案取舍

| 方案 | 说明 | 结论 |
|------|------|------|
| **A. 内置 Browser Agent + `file://`** | 复用已有 dock/window，相对资源按文件目录解析 | **采用** |
| B. `@tauri-apps/plugin-opener` `openUrl` | 系统默认浏览器，体验割裂 | 不采用（用户明确要内置） |
| C. 本地 HTTP server 预览 | 同源更完整，但运维与权限面大 | 非目标；静态 `file://` 足够 |

## Capabilities

### New Capabilities

- `local-html-builtin-browser-open`：本地 HTML 经内置 Browser Agent 打开的入口、判定、路径编码与失败语义。

### Modified Capabilities

- `vibecoding-browser-agent`：Browser Agent URL 允许集合扩展为 `http` / `https` / 本地 HTML `file://`；非 HTML `file://` 仍拒绝。

## Impact

| 层 | 路径 |
|----|------|
| Util | `src/features/files/utils/openHtmlInBrowser.ts` |
| File view | `FileViewPanel.tsx` |
| File tree | `FileTreeRows.tsx`, `FileTreePanel.tsx`, `file-tree.css`, `detached-file-explorer.css` |
| Git | `GitDiffPanelFileSections.tsx`, `GitDiffPanel.tsx`, `GitMultiRepositoryChanges.tsx` |
| Browser Agent FE | `BrowserDock.tsx` |
| Browser Agent Rust | `src-tauri/src/browser_agent/mod.rs` |
| i18n | `src/i18n/locales/*/files.ts` |
| Tests | `openHtmlInBrowser.test.ts`, `FileViewPanel.open-in-browser.test.tsx`, `FileTreeRows.test.tsx` |

## 验收标准

- 打开 `.html` / `.htm`：内容区右键、文件树图标/右键、Git 列表图标均可打开内置浏览器窗口，URL 为合法 `file://`。
- `.ts` / `.md` 等非 HTML：上述入口均不出现。
- 中文/空格/Windows 盘符路径编码正确；打开失败非阻塞提示。
- focused vitest 通过；`tsc` / eslint 通过。
- OpenSpec artifacts 齐全并可 `openspec validate`。
