## 1. Spec alignment

- [x] 1.1 更新 `codex-chat-canvas-workspace-session-activity-panel` delta spec，补充增量刷新、turn group 折叠与 reasoning 展示契约

## 2. Data path refactor

- [x] 2.1 拆分 `buildWorkspaceSessionActivity` 的 relevant-thread、per-thread-build、summary 汇总职责，暴露可复用的纯函数边界
- [x] 2.2 在 `useWorkspaceSessionActivity` 中增加 per-thread 缓存，只重建变化的 thread events
- [x] 2.3 去掉 `sessionSummaries` 对整条 timeline 的重复过滤计数，改为复用 per-thread eventCount

## 3. Panel and behavior verification

- [x] 3.1 校准 panel 的大 timeline 扫描行为，确保 turn group 保持“最新展开、旧组折叠”
- [x] 3.2 补充/更新测试，覆盖增量刷新、reasoning 分类与非污染统计

## 4. Validation

- [x] 4.1 运行 `session-activity` 相关测试并修正回归
- [x] 4.2 回填 OpenSpec tasks，确认实现与 spec/design 对齐
