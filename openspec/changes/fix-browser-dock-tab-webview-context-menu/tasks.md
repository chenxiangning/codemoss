## 1. Embedded renderer callback identity

- [x] 1.1 在 `src-tauri/src/browser_agent/mod.rs` 将 embedded renderer binding 扩展为 session、expected URL 与 load-started 状态；mount/navigation/hide 路径保持完整 binding 的原子更新与失败回滚。
- [x] 1.2 让 page-load 与 document-title callback 通过 URL-correlated guard 回写 session，拒绝前一 tab、URL 不匹配与 load 尚未开始时的迟到 callback。

## 2. Regression coverage

- [x] 2.1 为 URL-correlated guard 增加 Rust 单测：A→B 后拒绝 A callback，接受 B callback。
- [x] 2.2 保持既有 Browser Dock / embedded WebView Vitest 通过，确认前端串行 mount 语义未被 backend guard 改变。

## 3. Verification

- [x] 3.1 运行 OpenSpec strict validation、相关 Rust 单测、focused Vitest、`npm run typecheck` 与 `git diff --check`。
- [ ] 3.2 手工复验 slow local HTML 的 A→B→A 快速切换，确认 URL、标题、loading 状态不会串写。（用户验收）
