# embed-browser-dock-center-split — design

## 上下文

浏览器内容渲染有两条既有 Rust 路径：

1. `create_browser_agent_window`：浮动窗 `browser-agent-window` + 页面内注入工具条（当前唯一被前端使用的路径）
2. `create_browser_child_webview`：把 session webview 作为**子 webview** 挂到既有窗口的指定矩形（`mount_browser_agent_webview`），配套 `sync_browser_agent_webview_bounds` / `hide_browser_agent_webview`——**已注册但前端零调用**

前端侧 `DesktopLayout` 保留完整 split 脚手架：`.content-layer--browser-dock`（独立于 `.content-layer--editor`）、`.content-browser-dock-divider` 拖拽（`--browser-dock-split-ratio`，24%–72% 区间）、`main.css` 样式齐全；断点仅两处：`useLayoutNodes.tsx` 的 `browserDockNode = null` 与 `useAppShellLayoutNodesSection.tsx` 的 `browserDockOpen = false` 硬编码。

## 决策

### D1：displayMode 双模而非双组件

- `BrowserDock` 新增 `displayMode?: "floating" | "embedded"`，默认 `floating`
- detached 窗与任何既有调用方不传 prop，行为逐字节不变
- 内嵌路径只分叉「打开/激活会话」这一动作：floating → `openBrowserAgentWindow`；embedded → `mountBrowserAgentWebview(bounds)`
- 理由：岛的 DOM、tab 逻辑、session 流完全相同，分叉面越小回归面越小

### D2：bounds 同步用 ResizeObserver 单点收敛

- 新 hook `useEmbeddedBrowserWebview(containerRef, session, enabled)`：
  - 容器 = BrowserDock 内 webview-frame 区域 div（ref 下传）
  - `ResizeObserver` 监听容器 + `window resize` → `getBoundingClientRect()`（CSS px = Tauri logical px）→ `syncBrowserAgentWebviewBounds`
  - 拖拽 divider 只改 CSS 变量 → 容器 rect 变化 → ResizeObserver 自动覆盖，无需侵入拖拽代码
  - 挂载/切换 active session：先 hide 旧 label 的 webview，再 mount 新 session
- 理由：single source of truth 是容器矩形，任何布局变化（拖拽、侧栏开合、窗口 resize、topbar 高度变化）都被同一条路径收敛

### D3：显隐纪律（native 浮层不受 CSS 管辖）

子 webview 是 native layer，`is-hidden` / `inert` 对它无效。以下时刻 MUST 显式处理：

| 时机 | 动作 |
|---|---|
| dock 关闭（browserDockOpen → false） | `hideBrowserAgentWebview` |
| centerMode 离开 chat | `hideBrowserAgentWebview`（回 chat 时重新 sync 显示） |
| 会话关闭 / active tab 切换 | 旧 webview hide，新 session mount |
| 组件卸载 | `hideBrowserAgentWebview`（effect cleanup） |
| 弹出独立窗体 | hide 子 webview → `openBrowserAgentWindow` |

### D4：弹出语义

「弹出独立窗体」= 内容从主窗口子 webview 迁移到浮动窗：先 `hideBrowserAgentWebview` 再 `openBrowserAgentWindow(sessionId, locale)`（浮动窗路径自带注入工具条）。反向（浮动 → 内嵌）不做自动回收，用户再点「打开」即在当前 surface 重挂——与既有「打开」语义一致。

### D5：browserDockOpen 状态归属

- state 放 `useAppShellLayoutNodesSection`（与 `browserDockNode` 的 props 链路同源），`MainHeader` toggle 改为 setState 取反
- 持久化用 `clientStorage`（`layout` namespace，`browserDockOpen` key），与同文件其他面板状态一致
- 关闭入口：MainHeader toggle 取反即可；岛内不加额外 ✕（岛的 ✕ 语义是「关闭会话」，不混用）

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| native 浮层残留在其他 UI 上 | D3 显隐纪律全覆盖 + effect cleanup 兜底 |
| 拖拽中 bounds 高频 sync 抖动 | sync 命令本身是幂等 set_bounds；必要时 rAF 节流（ponytail：先不节流，实测再补） |
| `resolve_browser_parent_window` 取 focused 窗可能挂错父级 | 内嵌打开动作发生在主窗口交互内，主窗口必 focused；detached 窗 focused 时不会触发 embedded mount（displayMode 分叉保护） |
| 内嵌路径无注入工具条（child webview 路径本来就没有） | 符合预期：内嵌模式控制面全在岛内 |
| 多 workspace 切换 | dock 按 activeWorkspaceId 渲染，切换 workspace → activeSession 变化 → D2 的 hide+mount 链路处理 |

## 验证

- `npm run typecheck` / eslint 改动文件
- 聚焦 vitest：browser-agent + layout 相关既有套件不回归；新 hook 配轻量单测（mock invoke，验证 mount/sync/hide 调用时机）
- `cargo check`（Rust 零改动，防御性跑）
- 手工：内嵌打开 → 拖拽 → 窗口 resize → 弹出 → 切 centerMode → 关 dock，逐步查浮层残留
