## 1. Embedded renderer callback identity

- [x] 1.1 在 `src-tauri/src/browser_agent/mod.rs` 将 embedded renderer binding 扩展为 session、expected URL 与 load-started 状态；mount/navigation/hide 路径保持完整 binding 的原子更新与失败回滚。
- [x] 1.2 让 page-load 与 document-title callback 通过 URL-correlated guard 回写 session，拒绝前一 tab、URL 不匹配与 load 尚未开始时的迟到 callback。

## 2. Regression coverage

- [x] 2.1 为 URL-correlated guard 增加 Rust 单测：A→B 后拒绝 A callback，接受 B callback。
- [x] 2.2 保持既有 Browser Dock / embedded WebView Vitest 通过，确认前端串行 mount 语义未被 backend guard 改变。

## 3. Verification

- [x] 3.1 运行 OpenSpec strict validation、相关 Rust 单测、focused Vitest、`npm run typecheck` 与 `git diff --check`。
- [ ] 3.2 手工复验 slow local HTML 的 A→B→A 快速切换，确认 URL、标题、loading 状态不会串写。（用户验收）

## 4. Context-menu isolation and authorization

- [x] 4.1 将 injected tab menu 改为 closed Shadow DOM；host 的定位和 theme variables 使用重要内联声明，outside-click 通过 composed path 判断，保持现有按钮与关闭语义。
- [x] 4.2 为每次菜单显示注册一次性、60 秒有效的 nonce，绑定目标 tab 与当前 renderer tab；navigation handler 仅原子消费匹配 nonce 后 emit action，并拦截伪造、过期或重放 URL。
- [x] 4.3 增加 Rust 单测，覆盖 closed Shadow DOM script contract，以及 nonce 的正确 scope、错误 scope、过期与一次性消费。

## 5. P2 verification

- [ ] 5.1 运行 OpenSpec strict validation、相关 Rust 单测、focused Vitest、`npm run typecheck` 与 `git diff --check`。
- [ ] 5.2 手工复验：light / dark 主题、目标页面含全局 CSS（含 `!important`）时菜单可读可点；重复点击或手工构造旧 bridge URL 不触发关闭。（用户验收）
