# OpenSpec 整体信息同步报告（2026-03-20）

## 1. 同步范围

- 仓库根：`/Users/chenxiangning/code/AI/github/codemoss-openspec`
- OpenSpec 根：`openspec/`
- 同步对象：
  - `openspec/project.md`
  - `openspec/README.md`
  - `openspec/docs/spec-sync-validation-2026-03-20.json`

## 2. 基线事实（同步后）

- `specs` 能力目录：`93`
- `archive` 归档变更：`84`
- 活跃变更：`0`
- Purpose 填充状态：`32/93`（`61` 个仍为历史 `TBD`）

## 3. 本次同步动作

1. 执行一致性校验：
   - `python3 .claude/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full --output json --output-file openspec/docs/spec-sync-validation-2026-03-20.json`
2. 执行冲突检测：
   - `bash .claude/skills/osp-openspec-sync/scripts/detect-conflicts.sh .`
3. 回写信息文档：
   - 更新 `project.md` 和 `README.md` 的计数、归档批次、门禁结果、更新时间。

## 4. 校验结果摘要

- `validate-consistency`：`297` 项检查，`0` errors，`12` warnings，状态 `partial`
- `detect-conflicts`：未检测到文档冲突

### 4.1 警告明细（历史标题格式）

- `spec_title_project-memory-ui`
- `spec_title_panel-lock-showcase`
- `spec_title_project-memory-storage`
- `spec_title_conversation-hard-delete`
- `spec_title_project-memory-auto-capture`
- `spec_title_panel-lock-screen`
- `spec_title_codex-chat-canvas-execution-cards-visual-refactor`
- `spec_title_project-memory-crud`
- `spec_title_opencode-engine`
- `spec_title_codex-chat-canvas-plan-visibility`
- `spec_title_client-global-ui-scaling`
- `spec_title_project-memory-consumption`

## 5. 说明

- `generate-sync-report.py` 依赖本地 Python 包 `markdown`，当前环境缺失该依赖；本次采用“验证 JSON + 手工汇总报告”方式完成同步留痕。
