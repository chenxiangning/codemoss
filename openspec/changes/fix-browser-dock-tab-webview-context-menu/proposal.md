# fix-browser-dock-tab-webview-context-menu

## Why

Browser Dock 连续打开或切换多个本地 HTML tab 时，曾为每个 tab 创建 native child WebView；在 macOS 的 native WebView 层级下，这会让前一个 tab 的页面、标题或会话归属被后一个 tab 覆盖。右键菜单若由父 React WebView 渲染，又会被 child WebView 盖住；先隐藏页面再显示菜单会造成明显闪烁和“页面已在独立窗口打开”的错误占位。

本次需要同时保证多 tab 会话归属、原有四项关闭菜单能力和页面持续渲染，且菜单必须服从当前应用主题。

## 目标与边界

- **目标**：Browser Dock 内嵌模式以稳定的单一 native renderer 承载当前激活 tab；tab 切换、导航、标题和 load 回调只更新当前绑定的会话。
- **目标**：tab 右键菜单保留“关闭当前 / 其他 / 右侧 / 全部”的既有语义、禁用态和关闭目标计算，同时不遮蔽或隐藏页面。
- **目标**：菜单从宿主应用读取已计算的 theme tokens，并在 child WebView 内使用这些值渲染，适配 light / dark / system 主题。
- **边界**：仅覆盖 Browser Dock 的 embedded renderer 与 tab context menu；浮动 Browser Agent 窗口、页面内容、Browser Context Snapshot 和 AI action gate 不改。

## 非目标

- 不把 Browser tab 菜单替换为操作系统原生菜单。
- 不新建持久化主题设置，也不重构全局 theme token 系统。
- 不改变 tab 关闭策略、Browser Session 数据模型或 URL 安全校验。
- 不以隐藏 / 销毁 child WebView 作为弹出菜单的实现手段。

## What Changes

- 将 embedded Browser Dock renderer 固定为单一 native child WebView；挂载前绑定目标 session，页面导航、标题和 load callback 按当前绑定会话回写，避免跨 tab 串写。
- 在 active child WebView 中注入应用拥有的 tab context menu，并经私有 bridge event 调回已有的 tab-close pipeline。
- 保留关闭当前、其他、右侧和全部标签页的原逻辑，并由当前 tab 列表计算不可执行的菜单项。
- 前端在右键时读取 `--surface-popover`、`--text-strong`、`--border-quiet`、`--surface-hover`、`--text-muted` 和 `--shadow-accent` 的已计算值，跨 Tauri command 传入 child WebView 菜单。
- 保持 HTML fallback menu，供没有 Tauri event bridge 的运行环境与测试使用。

## 技术方案与取舍

### 方案 A：父 React WebView 的 `RendererContextMenu`

优点是复用现有组件；但 native child WebView 的 z-order 高于父 HTML，菜单会被页面遮住。通过 hide child WebView 规避会让页面闪烁、破坏会话连续性，故拒绝。

### 方案 B：Tauri / OS native menu

优点是天然位于 child WebView 之上；但它会替换应用原有的 menu surface，难以保持禁用态、主题 token 和既有交互语义。故拒绝。

### 方案 C：在 active child WebView 注入应用 owned menu（采用）

菜单与页面同处 native renderer 平面，因此不会遮挡或隐藏网页；private bridge 只传递 menu action，关闭目标仍在前端按最新 tab 列表计算。将宿主已计算的 tokens 明确传递给 child WebView，可保持主题一致而不依赖目标网页的 CSS。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `vibecoding-browser-agent`：补充 embedded Browser Dock 的稳定 renderer/session 绑定，以及不遮挡页面、保留关闭语义并继承主题的 tab context menu 合同。

## Impact

- Rust：`src-tauri/src/browser_agent/mod.rs`、`types.rs`、`command_registry.rs`。
- Frontend：`BrowserDock.tsx`、`BrowserDockEditorChrome.tsx`、Browser Agent Tauri service/type contract 与相关 Vitest。
- UI：仅 Browser Dock embedded tab menu；不新增第三方依赖、网络请求或持久化数据。

## 验收标准

1. 连续打开不同 local HTML 时，每个 tab 保持自己的 title、URL 与会话归属；切换 tab 后页面可恢复且不会串写到前一个 tab。
2. 在任一 tab 右键时，网页持续可见；菜单不触发 child WebView hide、close 或页面占位替换。
3. 菜单始终提供既有四项关闭操作；无其他 tab、无右侧 tab 或关闭进行中时对应项不可执行。
4. 菜单背景、文字、边框、hover、disabled 与 shadow 由当前主题 token 决定；light / dark / system 切换后重新打开菜单应使用新主题值。
5. 已验证：相关 Vitest、`npm run typecheck`、Rust 菜单单测及 `git diff --check`；用户已完成本工作区变更的人工验收。
