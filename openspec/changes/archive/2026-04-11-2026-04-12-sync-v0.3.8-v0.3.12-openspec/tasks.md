## 1. 区间事实核对（v0.3.8-0.3.12）

- [x] 1.1 核验 tag 边界（`v0.3.8/v0.3.9/v0.3.10/v0.3.11`，`v0.3.12=HEAD`）。
- [x] 1.2 生成并审阅 `v0.3.8..HEAD` 完整提交清单与文件变更清单。
- [x] 1.3 按版本（0.3.9/0.3.10/0.3.11/0.3.12）归类 feature/fix/refactor/docs/chore。

## 2. OpenSpec 影响映射

- [x] 2.1 输出 capability 影响矩阵（新增/修改/删除/无影响）。
- [x] 2.2 识别并确认缺失规范：图钉交互、提交信息生成、快捷动作菜单、`@路径` 引用卡片、流式相位特效。
- [x] 2.3 明确与已完成 `v0.3.12` 对齐项的边界，避免重复建模。

## 3. 主规范更新

- [x] 3.1 修改 `workspace-sidebar-visual-harmony`，补齐 pin/unpin 交互契约。
- [x] 3.2 新增 `git-commit-message-generation` 规范。
- [x] 3.3 新增 `composer-shortcut-actions-menu` 规范。
- [x] 3.4 新增 `conversation-user-path-reference-cards` 规范。
- [x] 3.5 新增 `conversation-stream-activity-presence` 规范。

## 4. 文档同步

- [x] 4.1 新增区间报告 `openspec/docs/v0.3.8-v0.3.12-change-analysis-2026-04-12.md`。
- [x] 4.2 更新 `openspec/project.md`（区间基线、活跃 change、能力矩阵）。
- [x] 4.3 更新 `openspec/README.md`（统计口径、对齐范围、活跃变更）。

## 5. 验证与收口

- [x] 5.1 执行 `openspec validate 2026-04-12-sync-v0.3.8-v0.3.12-openspec --strict`。
- [x] 5.2 视结果回填 tasks 勾选，并记录后续 sync/archive 建议。
