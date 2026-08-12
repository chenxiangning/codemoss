# redesign-browser-dock-island-chrome — tasks

## 1. OpenSpec & 原型

- [x] 1.1 10 组差异化原型（R1）→ 紧凑向 R2 → 胶囊岛×Powerline R3（`docs/prototypes/`）
- [x] 1.2 用户选定 R3-04「岛 ⇄ 状态行形变」为落地方向
- [x] 1.3 proposal / design / specs 补录

## 2. App 内 BrowserDock

- [x] 2.1 JSX 重构：悬浮岛（dot/tabs/+/URL pill/打开/徽标/关闭/info/坍缩）+ 底部恢复条
- [x] 2.2 新增 `docked` 纯展示态；handlers/service/effects 零改动
- [x] 2.3 `main.css` dock 样式块替换为岛/Powerline 样式（保留 webview frame/empty 类供 detached 窗口复用）

## 3. 注入窗口工具条（toolbar.rs）

- [x] 3.1 shadow DOM 模板：`.chrome > .island + .restore`
- [x] 3.2 形变 JS：`collapsed` state + `applyChromeHeight()`（顶 64 / 底 30，保留 body 原始 padding）
- [x] 3.3 localStorage 持久化（`ccgui.browserAgent.toolbarCollapsed`，try/catch 兜底）
- [x] 3.4 labels 增加 collapse/expand（zh/en）
- [x] 3.5 坍缩条位置修正：顶部 → 底部（`top:auto; bottom:0`，border-top）

## 4. i18n

- [x] 4.1 `browserAgent.dock.collapseDock` / `expandDock` × 10 locale（zh/zh-TW/en/es/fr/hi/ja/ko/pt-BR/ru）

## 5. 验证

- [x] 5.1 `npm run typecheck` 绿
- [x] 5.2 eslint 改动文件 0 问题；i18n 测试 57/57；dock 相关测试 67/67
- [x] 5.3 `cargo check` 绿；`cargo test --lib browser_agent` 11/11
- [x] 5.4 large-files 门禁失败集无扩大（92→92，与本次无关）
- [x] 5.5 已知环境性失败（`assemble_canonical_facts` 缺 openspec fixture）确认为既有，不归因本次
