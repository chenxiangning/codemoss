## Context

- 产品已有 **Browser Agent / Browser Dock**（独立 WebView 窗口、workspace-scoped session）。
- 既有 URL 策略仅允许 `http`/`https`，本地 HTML 无法进内置浏览器。
- 文件面已有内容区右键、文件树 hover action、Git `diff-row-actions` 图标模式可复用。

## Goals / Non-Goals

**Goals**

- 统一打开实现：`openHtmlInBrowser(absolutePath, { workspaceId, ownerSurface? })`。
- 三入口共用判定与编码逻辑，避免分叉。
- Rust 策略与 FE 判定一致：仅 HTML `file://`。

**Non-Goals**

- 本地 static server、CORS 破解、SPA history 路由模拟。
- tab 右键、文件树外其它表面（Search palette 等）。

## Decisions

### 1. 打开通道：Browser Agent，不是 plugin-opener

```ts
const fileUrl = buildLocalFileUrl(absolutePath);
const session = await createBrowserAgentSession({
  workspaceId,
  url: fileUrl,
  ownerSurface: options.ownerSurface ?? "file-view",
});
await openBrowserAgentWindow(session.browserSessionId, locale ?? null);
```

- **原因**：用户要求「内置浏览器」；`openPath` 可能落到编辑器；`openUrl` 落到系统浏览器。
- **ownerSurface** 便于追踪：`file-view` / `file-tree` / `git-diff-file-list`。

### 2. `file://` 编码：`buildLocalFileUrl`

- 反斜杠 → `/`
- 按 path segment `encodeURIComponent`（保留 Windows 盘符 `C:`）
- POSIX：`file:///abs/...`；Windows：`file:///C:/...`
- 覆盖空格、中文、`#`/`?` 文件名

### 3. HTML 判定：`isHtmlFilePath`

- `/\.(html|htm)$/i`，路径先 `\` → `/`
- 非空 trim；`.html.bak` 等不匹配

### 4. Browser Agent URL policy（Rust）

`validate_browser_url_for_workspace`：

| scheme | 条件 | 结果 |
|--------|------|------|
| `file` | path 以 `.html`/`.htm` 结尾（忽略 `?`/`#` 后缀） | allow，`workspace_local_allowed=true` |
| `file` | 其它扩展名 | block `blocked_file_type` |
| `http`/`https` | 既有规则 | 不变 |
| 其它 | — | block `blocked_scheme` |

`BrowserDock.normalizeUrlDraft`：`file://` 不再被补成 `https://file://...`。

### 5. 入口接线

| 入口 | 可见条件 | 打开路径解析 |
|------|----------|--------------|
| FileView 内容区右键 | `isHtmlFilePath(filePath)` | `resolveAbsolutePath(workspacePath, filePath)` |
| 文件树 Globe / 右键 | 文件节点 + `isHtmlFilePath` | `joinWorkspaceAbsolutePath` / `resolvePath` |
| Git DiffFileRow Globe | HTML 且非 deleted | `resolveRepositoryWorkspaceFilePath` → `joinWorkspaceAbsolutePath` |

Git 已删除文件不显示入口（磁盘上可能不存在）。

### 6. UI 细节

- 图标：`Globe`（Git / 文件树）；内容区右键沿用 `ExternalLink`（与既有菜单视觉一致，可后续统一）。
- 文件树：`.file-tree-actions` 组承载 browser + mention；CSS 避免 WebKitGTK 昂贵 `:has`（用 class `has-browser-action`）。
- detached：仅 hide `.file-tree-action--mention`。

### 7. 错误语义

- 缺 `workspaceId`：reject / 全局 toast（不静默）。
- session create / window open 失败：**一律** `pushErrorToast`（含文件树；禁止 `file-tree-operation-notice` 本地条）。
- 用户文案：`formatOpenHtmlInBrowserError` 映射 kind → i18n（`openInBrowserFailed` / `NoWorkspace` / `WindowBusy` / `Blocked`），**不**直接展示 `error.message` 英文技术串；原始错误仅 `console.warn`。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| `file://` 下跨域/绝对路径资源失败 | 文档化为静态预览预期；不做 server |
| 策略放行面扩大 | 严格限 `.html`/`.htm`；非 HTML file 仍 block |
| 多仓 Git 路径错拼 | 复用 `resolveRepositoryWorkspaceFilePath` |
| i18n 缺 key | 10 locale 全补 `files.openInBrowser` |

## Implementation map（已落地）

| 文件 | 职责 |
|------|------|
| `openHtmlInBrowser.ts` | 判定 / 编码 / 打开 |
| `browser_agent/mod.rs` | URL validation |
| `BrowserDock.tsx` | draft scheme 归一化 |
| `FileViewPanel.tsx` | 内容区菜单 |
| `FileTreeRows.tsx` + `FileTreePanel.tsx` | 行图标 + 菜单 |
| `GitDiffPanelFileSections.tsx` + `GitDiffPanel.tsx` + multi-repo | Git 行图标 |
| `*/files.ts` | i18n |
| 对应 `*.test.ts(x)` | 回归 |

## Open questions

- tab 右键是否补入口：默认否，需产品确认后再开 change。
- 内容区菜单图标是否统一为 `Globe`：可选 polish，不阻塞。
