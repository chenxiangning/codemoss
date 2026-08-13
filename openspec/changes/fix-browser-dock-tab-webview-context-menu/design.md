## Context

Browser Dock 的 embedded mode 以单一 native child WebView 承载当前激活的逻辑 tab，避免多个 child WebView 在同一矩形中发生 z-order 覆盖。切换 tab 时，Rust 会先把 `browser_session_id` 写入 module-level binding，再让唯一 renderer 导航到目标 URL；`on_navigation`、`on_page_load` 与 `on_document_title_changed` 再据此回写 session。

单一 renderer 解决了多实例覆盖，但也把 native lifecycle callback 变成跨 tab 的异步共享通道：旧页面的迟到 `Started`、`Finished` 或 title callback 可能在新的 session 已完成 binding 后到达。仅以“当前 binding”的 session id 归属 callback，会把旧页面事实写进新 tab。本设计把 renderer binding 升级为带 expected URL 的事实源，并同时维持已有的菜单与主题行为。

## Goals / Non-Goals

**Goals:**

- 为 embedded renderer 维护当前 session、目标 URL 与 load-started 状态。
- 只接受与预期 URL 相符的 page-load callback；旧 URL 的迟到 callback 不得更新当前 tab。
- title callback 仅在 `Webview::url()` 与预期 URL 相符且已观察到目标 URL 的 `Started` load 后才可回写，避免 A 的 title 串写到 B。
- 保持现有单 renderer、tab 关闭语义、菜单 bridge 和 theme-token transfer，不改变用户已验收行为。
- 用 Rust 单测锁定 generation / URL guard 的纯决策逻辑，并保留既有 TypeScript tab-switch 测试。

**Non-Goals:**

- 不改 Browser Session 持久化模型或关闭策略。
- 不改变 URL allowlist 规则、浮动 Browser Agent 窗口或 Browser Context Snapshot。
- 不在本次处理 tab-menu bridge nonce、Shadow DOM 隔离或 BrowserDock 大文件拆分；它们保留为独立 review follow-up。

## Decisions

### 1. 将 embedded binding 建模为 URL-correlated identity

binding 从 `Option<String>` 扩展为 `Option<EmbeddedRendererBinding>`，其中包含 `browser_session_id`、`expected_url` 与 `load_started`。

- 每次 `mount_browser_agent_webview` 导航到新 tab 或同 tab 新 URL 时，在 `navigate` 之前写入 binding 并重置 `load_started`。
- 仅 bounds sync / show 且不触发导航时，保留现有 generation 与 `load_started`，避免已显示页面因布局变化失去 title 回写能力。
- 关闭或 hide 仅在 session id 仍匹配时清空 binding。

该 binding 是 native callback 的唯一归属依据，避免 callback 闭包捕获首次创建 WebView 的会话事实。

### 2. page-load 与 title 都以 URL 作为可验证证据

`on_page_load` 收到的 URL 必须与 binding 的 expected URL 相符（允许 URL fragment 的浏览器规范化差异时按既有 normalized URL 语义比较）。只有匹配的 `Started` 才把 `load_started` 置为 true，并向当前 session 写入状态/URL；匹配且已开始的 `Finished` 才能把状态置为 ready。`on_document_title_changed` 使用 Tauri 官方 `Webview::url()` 读取当前 URL，并同时要求 URL 匹配与 `load_started` 为真。

选择 URL guard，而不是“收到 callback 就相信当前 binding”，因为 Tauri callback 无法保证前一次 navigation 的事件在下一次 `navigate` 前耗尽。Tauri callback 未提供 navigation-id，因此不把无法证明的 callback generation 当作安全依据。

### 3. title 回写等待匹配的 load start

title callback 本身不携带 URL，但 callback 提供 `Webview`，可通过 `Webview::url()` 获取当前页面 URL。每次新的 navigation 必须先把 `load_started` 复位为 false；只有当前 URL 匹配且同一 binding 已接收 matching `Started` 后才接收 title。这样 A 的旧 title event 无法在 B 的页面真正开始加载前覆盖 B。

替代方案是每次 title callback 执行 JavaScript 查询 location；这增加 eval 时序、CSP/页面卸载失败面，且仍不如 native page-load identity 直接。故不采用。

### 4. 失败回滚恢复完整 binding

若 child WebView 创建或 navigate 失败，恢复完整的 previous binding，而不是只恢复 session id。这样原页面的 callback 仍按原 URL 状态处理，失败的新 navigation 不会留下可接受 title 的半成品状态。

## Risks / Trade-offs

- [URL redirect 与 initial URL 不同] → `on_navigation` 在 allowlist 接受后先更新 expected URL；后续 `Started` / `Finished` 以该 accepted URL 匹配，避免合法 redirect 永远停在 loading。
- [同 URL 的连续强制刷新] → Tauri callback 不提供 generation，无法区分两个相同 URL 的 navigation；它们仍仅更新同一 Browser Session，不产生跨 tab 归属错误。
- [title 在 `Started` 之前由平台发出] → 该极早 title 将被忽略；页面后续 document-title callback 会刷新它。宁可暂时保留已有标题，也不接受跨 tab 串写。
- [static binding lock 竞争] → binding 只保存少量内存数据，回调中只短暂读取/更新，不跨 await 持锁。

## Migration Plan

1. 增加 `EmbeddedRendererBinding` 与纯 URL guard helper，替换现有 embedded session id binding。
2. 在 mount / navigate / bounds sync / hide 路径按 navigation 与非 navigation 区分更新 binding。
3. 在 page-load 与 title callback 使用 binding snapshot / guard；失败时恢复完整 previous binding。
4. 增加 Rust 单测，覆盖 A→B 后 A 的迟到 load/title 被拒绝、B 的 matching callback 被接受。
5. 运行既有 focused Vitest、Rust 单测、`npm run typecheck` 与 `git diff --check`；手工复验快速 A→B→A 和 slow local HTML。

回滚方式：撤回 binding struct/guard 改动可恢复当前单 renderer 实现；不会迁移持久化数据或修改 session schema。

## Open Questions

- 无。URL redirect 的 accepted URL 更新将按现有 `on_navigation` allowlist 的结果实施，避免引入第二套安全判断。
