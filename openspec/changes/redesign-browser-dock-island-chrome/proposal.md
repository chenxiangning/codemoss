# redesign-browser-dock-island-chrome

## Why

浏览器 Dock 与浏览器窗口工具条是「标题栏 + 平铺控件」的老布局：信息层级平、垂直占用高（注入工具条固定 126px 双行）、视觉无焦点。用户已选定「悬浮岛 ⇄ 底部状态行形变」方向（原型 `docs/prototypes/browser-dock-variants-r3.html` R3-04），需要把两条 UI 表面（App 内 dock 面板 + 注入网页的原生窗口工具条）统一收敛为该形态。

## What Changes

- App 内 `BrowserDock`：tab 条 / URL 行 / footer 三段平铺 → 顶部居中毛玻璃悬浮岛（状态点、标签 pills、新建、URL pill、打开、状态徽标、关闭、info 气泡、「—」坍缩键）
- 注入工具条（`browser_agent/toolbar.rs` shadow DOM）：126px 固定双行灰蓝块 → 64px 透明条 + 居中胶囊岛（标签、新建、状态徽标、URL pill、打开、◎ 选元素、关联浏览器上下文、关闭、「—」坍缩键）
- 坍缩态：底部 30px Powerline 斜切分段条（状态段 → 页面/域名段 → 右侧 workspace + 展开），点击整条恢复岛上；页面 `body` 偏移随形变在「顶 64px / 底 30px」间切换并保留原始 padding
- 形变状态经 `localStorage` 持久化（注入工具条按 origin 记忆）
- i18n：`browserAgent.dock.collapseDock` / `expandDock`（10 个 WebView locale）+ 注入工具条 labels `collapse` / `expand`（zh/en）

## 目标与边界

- **目标**：两条浏览器 UI 表面视觉统一为岛式；默认垂直占用 126px → 64px，坍缩后 30px；既有功能按钮零丢失
- **边界**：纯展示层改造。所有 bridge action（attach/new/open/select/close/tab 切换）、Tauri 命令、事件监听、notice 逻辑保持不变；不新增后端能力

## 非目标

- 不改变 Browser Agent 会话生命周期与窗口创建逻辑
- 不引入快捷键（⌘L 等）与命令面板
- 不改 `DetachedBrowserAgentWindow` menubar 结构（其内嵌 dock 自动继承岛式）

## Capabilities

### New Capabilities

- `browser-dock-island-chrome`：浏览器 Dock / 窗口工具条的岛式 chrome 与底部 Powerline 形变交互

### Modified Capabilities

- 无（既有 browser-agent 行为合同不变）

## Impact

- FE：`BrowserDock.tsx`、`src/styles/main.css`（dock 样式块）、`src/i18n/locales/*/browserAgent.ts`（10 locale）
- Rust（注入 UI）：`src-tauri/src/browser_agent/toolbar.rs`（模板/样式/形变 JS/labels）
- 原型资产：`docs/prototypes/browser-dock-variants-r3.html`（R3-04 为选定方向）
- 无 IPC / 存储 / 事件合同变更

## 验收标准

1. App 内 dock 与注入工具条默认渲染为居中悬浮岛，全部既有按钮可达
2. 坍缩后 Powerline 位于窗口/面板**底部**，点击恢复岛上
3. 坍缩/展开时页面内容不被遮挡（body padding 随形变正确切换且可还原）
4. 注入工具条形变状态跨页面加载保持（localStorage）
5. `cargo check`、`cargo test --lib browser_agent`、`npm run typecheck`、i18n 测试全绿
