---
type: index
status: active
---

# 使用与开发指南

本目录提供面向任务的 canonical navigation。指南正文可能因历史引用量较高而暂时保留在 `analysis/`、`perf/` 或 `research/`；物理路径是 compatibility path，不代表内容类型。不要复制正文，新入口统一从本页链接。

## Workflow

- [Workflow 指南索引](workflow/README.md)
- [OpenSpec 协作手册](workflow/openspec-playbook.md)
- [Codex collaboration mode enforcement](workflow/codex-collaboration-mode-enforcement.md)
- [Curated skill onboarding](workflow/curated-skill-onboarding.md)

## UI

- [UI 指南索引](ui/README.md)
- [Preference Settings UI Guide](ui/preference-settings-ui-guide.md)

## Compatibility-path canonical navigation

以下正文因仓库内外的高 fan-out 引用暂不移动；物理路径保持兼容，本索引提供统一导航。

### Current guides

- **Development**：[Desktop 开发快速启动 Runbook](../research/desktop-dev-fast-start-runbook.md)
- **Onboarding**：[MossX 新 CLI 接入指南](../research/mossx-new-cli-onboarding-guide.md)
- **Session**：[Native 与 Shared CLI 会话模型说明](../analysis/native-vs-shared-cli-explained.md)
- **Session diagnosis**：[Native session provider 选择与磁盘覆盖分析](../analysis/native-session-provider-select-vs-disk-overwrite-2026-07-31.md)
- **Troubleshooting**：[React 185 Maximum Update Depth Playbook](../analysis/react-185-maximum-update-depth-playbook.md)
- **Rollout / rollback**：[Realtime CPU Rollout & Rollback SOP](../research/realtime-cpu/rollout-rollback-sop.md)

### Historical troubleshooting evidence

以下材料用于复盘与诊断，不代表 current behavior；使用时必须结合当前代码重新核对：

- **Resolved session fallback incident**：[Shared session model picker native fallback](../analysis/shared-session-model-picker-native-fallback-2026-08-02.md)
- **Implemented performance history**：[Parallel Conversation Jank Handbook](../perf/parallel-conversation-jank-handbook.md)

新增 current-guide 链接应优先指向上方现有正文路径，并从本页发现；只有在全仓引用可原子迁移时才移动正文，同时在旧路径留下 `deprecated` redirect stub。

## 维护规则

- Guide 描述“如何完成任务”；稳定 contract 放入 [`reference/`](../reference/README.md)。
- 带日期的诊断与证据留在 `analysis/`、`perf/`、`research/` 或 `reports/`，并声明准确 lifecycle。
- 新增、迁移或废弃指南时，同步更新本页与 [`docs/README.md`](../README.md)。
- 生命周期与归档规则见 [`GOVERNANCE.md`](../GOVERNANCE.md)。
