# redesign-browser-dock-island-chrome — design

## 上下文

浏览器 UI 有两条表面共用同一心智：

1. **App 内 dock 面板**（`BrowserDock.tsx`，React + shadcn，嵌在 center panel / detached 窗口）
2. **注入窗口工具条**（`toolbar.rs` 生成的 shadow DOM，悬浮在被浏览页面的 window 顶部）

原型阶段产出 3 轮 26 个变体（`docs/prototypes/browser-dock-*.html`），用户选定 **R3-04：悬浮岛 ⇄ 底部 Powerline 形变**。本设计把该原型落成两条表面的统一 chrome。

## 决策

### D1：两条表面同构但各自实现

- React 侧用 token（`--surface-popover` / `--border-strong` / `--status-success` 等）+ `backdrop-filter` 还原胶囊岛
- 注入工具条运行在任意第三方页面上（shadow DOM 隔离、无 App CSS 环境），沿用文件内既有的硬编码 light 色系，只升级形态（圆角胶囊、毛玻璃、Powerline 斜切分段）
- 理由：注入环境拿不到 token；两条表面的 DOM/样式本来就必须分离

### D2：形变是纯展示态

- App 侧新增 `docked: boolean`（React state）；注入侧新增 `collapsed: boolean`（localStorage 持久化）
- 不改任何 bridge action / Tauri 命令 / 事件流；坍缩只隐藏 chrome 控件，会话逻辑继续运行
- 理由：本次任务边界是「改前端、不改交互」

### D3：页面偏移随形变切换

- 注入工具条向 `body` 注入 padding 避免遮挡页面：展开 = `padding-top 64px`，坍缩 = `padding-bottom 30px`
- 原始 padding 值在首次注入时存入 `body.dataset`，形变时先还原再叠加，避免重复累加
- host 定位：`top:0`（展开）⇄ `bottom:0`（坍缩）

### D4：高度预算

- 旧工具条固定 126px 双行 → 展开 64px（岛内单行）/ 坍缩 30px
- Rust 侧无高度依赖（`toolbarHeight` 仅为脚本内部常量），改动自包含

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 注入脚本含 `"#` 会截断 Rust raw string | 新增 JS 一律用 data-attribute / class 选择器，已 `rg` 验证 |
| localStorage 在个别页面被禁用 | 读写均 try/catch，失败退化为「每次加载默认展开」 |
| 岛在窄窗口溢出 | `max-width: calc(100vw - 24px)` + tablist 横向滚动 |
| detached 窗口 CSS 引用旧 webview 类 | 保留 `.browser-agent-webview-frame/-empty` 类名与结构 |

## 验证

- `cargo check` / `cargo test --lib browser_agent`（11/11）
- `npm run typecheck` / eslint / i18n 测试（57/57）/ dock 相关测试（67/67）
- 手工：重开浏览器窗口验证岛渲染、坍缩到底部、恢复、跨页面记忆
