## 1. 版本事实核对（v0.3.12）

- [x] 1.1 基于 `v0.3.11..HEAD` 生成提交清单并按功能域归类（功能/修复/重构/配置/文档）。
- [x] 1.2 以 `CHANGELOG.md` 的 `2026-04-11 (v0.3.12)` 章节交叉核验发布语义。
- [x] 1.3 标注 docs-only / merge / chore 提交，避免误判为能力变更。

## 2. OpenSpec 影响映射

- [x] 2.1 输出 capability 影响矩阵：`新增/修改/删除/无影响`。
- [x] 2.2 针对不一致项制定主 spec 修订列表。
- [x] 2.3 补齐缺失能力规范（Usage 多引擎统计）。

## 3. 主规范修订

- [x] 3.1 更新 `codex-cross-source-history-unification`：local scan unavailable 降级与 `partialSource`。
- [x] 3.2 更新 `conversation-lifecycle-contract`：`workspace not connected` 可恢复重连重试。
- [x] 3.3 更新 `conversation-template-maintenance`：`File changes` 多文件独立折叠交互。
- [x] 3.4 更新 `workspace-sidebar-visual-harmony`：`layoutMode` 与 swapped 快捷入口一致性。
- [x] 3.5 更新 `client-global-ui-scaling`：`canvasWidthMode` 配置与回退约束。
- [x] 3.6 更新 `opencode-mode-ux`：设置页 MCP 引擎视图只读语义。
- [x] 3.7 新增 `settings-local-usage-analytics` 规范。

## 4. 文档同步

- [x] 4.1 更新 `openspec/project.md`（版本快照、证据矩阵、active change 状态）。
- [x] 4.2 更新 `openspec/README.md`（仓库快照、版本基线、统计口径）。
- [x] 4.3 新增 `openspec/docs/v0.3.12-change-analysis-2026-04-12.md`（结构化变更清单与影响映射）。

## 5. 后续建议（本次不执行）

- [x] 5.1 运行 `openspec validate 2026-04-12-sync-v0.3.12-openspec --strict` 并归档验证结果。
- [x] 5.2 若确认本次变更完成，执行 sync/archive 流程将 delta 回灌与归档。
