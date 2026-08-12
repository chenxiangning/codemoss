# embed-browser-dock-center-split — tasks

## 1. 状态与入口

- [x] 1.1 `useAppShellLayoutNodesSection.tsx`：`browserDockOpen = false` 硬编码 → 真实 state（clientStorage `layout.browserDockOpen` 持久化）+ `closeBrowserDock`
- [x] 1.2 MainHeader 浏览器 toggle 从 `openBrowserAgentDock()`（detached 窗）改为开关内嵌 dock；保留 dynamic import 路径供弹出按钮使用

## 2. 中心面板容器

- [x] 2.1 `useLayoutNodes.tsx`：`browserDockNode = null` → `browserDockOpen && activeWorkspaceId` 时渲染独立容器 + `<BrowserDock displayMode="embedded" ownerSurface="main-split-browser-dock">`
- [x] 2.2 确认 DesktopLayout split 脚手架（`is-browser-dock-split` / divider / `--browser-dock-split-ratio`）随 node 非空自动激活，零 CSS 新增

## 3. 内嵌 webview 接线

- [x] 3.1 BrowserDock 新增 `displayMode?: "floating" | "embedded"`（默认 floating）；embedded 时 `openSessionWindow` 走 `mountBrowserAgentWebview`
- [x] 3.2 新增 `useEmbeddedBrowserWebview` hook：webview-frame 容器 ref + ResizeObserver/window resize → `syncBrowserAgentWebviewBounds`；active 切换 hide 旧 mount 新；卸载 cleanup hide
- [x] 3.3 显隐纪律：dock 关闭 / centerMode 离开 chat / 会话关闭时显式 hide（经 hook 的 enabled 参数收敛）

## 4. 弹出独立窗体

- [x] 4.1 岛内新增「弹出独立窗体」按钮（仅 embedded 渲染）：`hideBrowserAgentWebview` → `openBrowserAgentWindow(sessionId, locale)`
- [x] 4.2 i18n：`browserAgent.dock.popOutWindow` ×10 locale

## 5. 验证

- [x] 5.1 `npm run typecheck` 绿；eslint 改动文件 0 问题
- [x] 5.2 browser-agent / layout 聚焦 vitest 不回归；新 hook 轻量单测（mock invoke 验证 mount/sync/hide 时机）
- [x] 5.3 `cargo check` 绿（Rust 零改动，防御性）
- [ ] 5.4 手工链路：内嵌打开 → 拖拽 → 窗口 resize → 弹出 → 切 centerMode → 关 dock，无浮层残留（需在运行中的 App 内人工验收）
- [x] 5.5 既有失败集不扩大（large-files 92 / assemble_canonical_facts 缺 fixture / composer 6 败基线一致）
- [x] 5.6 `openspec validate embed-browser-dock-center-split --strict --no-interactive`

## 6. 互斥与入口改道（R2）

- [x] 6.1 打开 dock（toggle / open-dock 事件）强制 `setCenterMode("chat")`，与文件编辑器互斥
- [x] 6.2 `openHtmlInBrowser` 改走 dock 事件链路（共享 `state/dockEvents.ts`，Composer/BrowserDock 同步去重）；调用方选项精简（去 locale/ownerSurface）
- [x] 6.3 `openHtmlInBrowser.test.ts` 改验事件派发链路（jsdom）

## 7. 内嵌 chrome 能力对齐（R2）

- [x] 7.1 岛内「关联浏览器上下文」：`requestBrowserContextAttachment` 复用浮动窗同一事件通道
- [x] 7.2 岛内「选择网页元素」：Rust 新命令 `start_browser_agent_element_select` + 子 webview `on_navigation` 补 toolbar bridge 拦截 + 前端 service wrapper
- [x] 7.3 弹出/关联/选择按钮无活跃会话时置灰；i18n `attachContext`/`selectElement` ×10 locale

## 8. 编辑器标签模式外观（R2）

- [x] 8.1 内嵌 chrome 改两行编辑器布局：tab 条（host 字母头像 + hostname + 状态点 + active 顶部高亮）+ 面包屑地址行
- [x] 8.2 active tab 与内容区同色相接（遮缝），URL 输入无边框等宽字体，⌘L / Ctrl+L 聚焦地址栏
- [x] 8.3 floating 悬浮岛保持原外观（仅移除 embedded 专属按钮）
- [x] 8.4 大文件门禁拆分：`BrowserDockEditorChrome.tsx` 子组件 + `browser-agent-dock.css`（懒加载）抽出，gate 回到基线 92 无增长
- [ ] 8.5 人工目检：编辑器标签外观、按钮置灰态、⌘L 聚焦、选择元素链路（需运行中的 App）
- [x] 8.6 内嵌 chrome 收敛：去掉容器内边框/内边距让 webview 铺满；顶栏右侧按钮下沉到底部地址行；仅保留打开/关联/选择/弹出/收起且全部 icon 化
- [x] 8.7 tab 改直角贴边；地址行文本/icon 水平对齐；坍缩条去掉重复状态与展开文案
- [x] 8.8 底栏 icon 点中着色；选择网页元素改为可取消的 toggle（stop 命令 + Esc 回传）

