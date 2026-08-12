# embed-browser-dock-center-split

## Why

浏览器内容目前只能在独立浮动窗（`browser-agent-window`）中渲染，与主窗口对话幕布空间上完全割裂：用户需要边看对话边管理一个漂移的浏览器窗。中心面板 dock 曾在 `e05159c7a` 被拔掉（`browserDockNode = null`、`browserDockOpen = false` 硬编码），但 DesktopLayout 的 split 脚手架（`.content-layer--browser-dock`、拖拽 divider、`--browser-dock-split-ratio`）与 Rust 侧内嵌命令（`mount_browser_agent_webview` / `sync_browser_agent_webview_bounds` / `hide_browser_agent_webview`）全部保留且前端零调用，具备低风险接通条件。

## What Changes

- 主窗口中心区恢复浏览器 dock：`browserDockNode` 重新挂载到既有的 `.content-layer--browser-dock` 独立容器（与文件编辑器 `.content-layer--editor` 完全分离），`centerMode === "chat"` 时与对话幕布左右排列
- 中间拖拽分隔：复用既有 `content-browser-dock-divider` + `--browser-dock-split-ratio` 实现
- 网页内容真正内嵌：BrowserDock 新增 `displayMode`（默认 `floating` 保持现状），`embedded` 时「打开/切 tab」走 `mount_browser_agent_webview` 挂到主窗口容器矩形，容器尺寸变化（ResizeObserver / 拖拽 / 窗口 resize）实时 `sync_browser_agent_webview_bounds`
- **BREAKING（入口行为）**：MainHeader 浏览器按钮从「打开 detached dock 窗」改为「开关内嵌 dock」；detached 能力不删除，由岛内「弹出独立窗体」按钮承接（hide 子 webview → `open_browser_agent_window`）
- 内嵌可见性纪律：dock 关闭、centerMode 离开 chat、会话关闭、组件卸载时 MUST 显式 `hide_browser_agent_webview`（native 子 webview 不受 CSS 隐藏管辖）
- i18n：岛内「弹出独立窗体」按钮文案 ×10 locale
- （R2）互斥：打开 dock 强制 `centerMode = "chat"`，杜绝"dock 已开但被编辑器层遮盖"
- （R2）文件「在浏览器打开」（文件视图/文件树/Git diff）从直接开浮动窗改走 dock 事件链路，统一在内嵌容器打开
- （R2）内嵌 chrome 能力对齐浮动工具条：新增「关联浏览器上下文」（复用 attach 事件通道）与「选择网页元素」（Rust 新命令 `start_browser_agent_element_select` + 子 webview bridge 拦截）
- （R2）内嵌 chrome 外观改为编辑器标签模式：tab 与内容区同色相接、URL 降级为面包屑行、⌘L 聚焦地址栏；floating 悬浮岛外观不变

## 目标与边界

- **目标**：浏览器与对话幕布同窗并排、可拖拽调宽；既有独立窗体能力一键可达且不丢功能
- **边界**：复用既有 split 脚手架与 Rust 命令；R2 起 Rust 仅新增元素选择命令与子 webview bridge 拦截，不改会话生命周期、事件流

## 非目标

- 不改动 `DetachedBrowserAgentWindow` 结构与 `browser-agent-dock` 窗口路由
- 不改注入工具条的行为逻辑（toolbar.rs 仅把选择器脚本函数提升为 crate 可见）
- 不支持多会话同时内嵌渲染（只渲染 active session 的子 webview）
- 不做浏览器内容内嵌到文件编辑器容器（两者是并列的独立层）

## 技术方案取舍

| 选项 | 说明 | 取舍 |
|---|---|---|
| **A. 接通既有内嵌链路**（采用） | 前端恢复 `browserDockNode` + 接线既有 `mount/sync/hide` Rust 命令 | Rust 零改动；脚手架已验证；唯一新增是 bounds 同步 hook |
| B. iframe 内嵌 | 用 `<iframe>` 渲染网页 | 否决：X-Frame-Options/CSP 大量站点拒绝被嵌，且失去 session/capture/toolbar 语义 |
| C. 主 webview 内导航 | 主窗口直接跳 URL | 否决：违反既有 spec「main webview 必须留在 client app route」 |

## Capabilities

### New Capabilities

- `browser-dock-center-split`：主窗口中心区浏览器 dock 的挂载、左右分屏、拖拽调宽、内嵌 webview bounds 同步与显隐纪律、弹出独立窗体

### Modified Capabilities

- `vibecoding-browser-agent`：首条 requirement「Browser Dock SHALL provide a client-owned embedded web surface」从「仅 detached 窗」修订为「内嵌中心分屏为主表面，detached 浮动窗经弹出入口保留」

## Impact

- FE：`useLayoutNodes.tsx`（恢复 browserDockNode）、`useAppShellLayoutNodesSection.tsx`（browserDockOpen state + toggle 改向）、`BrowserDock.tsx`（displayMode + 弹出按钮）、新增 `useEmbeddedBrowserWebview` hook、`src/i18n/locales/*/browserAgent.ts` ×10
- Rust：零改动（`mount/sync/hide` 命令已在 command_registry 注册）
- 布局/CSS：复用既有 `.is-browser-dock-split` 系列样式，零新增

## 验收标准

1. MainHeader 浏览器按钮打开内嵌 dock：对话幕布左、浏览器右，分隔条可拖拽调宽且比例即时生效
2. 内嵌 dock 输入 URL 打开后，网页内容渲染在主窗口浏览器容器矩形内（非浮动窗）
3. 拖拽分隔条 / 调整窗口尺寸时，内嵌网页始终对齐容器矩形
4. 岛内「弹出独立窗体」点击后网页切换到独立浮动窗（带注入工具条），内嵌容器回到占位态
5. 关闭 dock、切换 centerMode、关闭会话后无 native 浮层残留
6. `npm run typecheck`、相关 vitest 聚焦套件、`cargo check` 全绿；既有失败集不扩大
