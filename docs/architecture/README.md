---
type: index
status: active
---

# Architecture 文档索引

本目录记录架构策略、治理规则与 large-file 基线。基线类文档反映**生成时**的仓库状态；当前代码事实仍需回到 [`../../README.md`](../../README.md)、[`../../AGENTS.md`](../../AGENTS.md) 与 [OpenSpec](../../openspec/project.md) 核验。
文档总图：[`../README.md`](../README.md)。

## 架构与治理

- [Plugin Platform](plugin-platform/README.md) — 插排 / 三根插头实验收口；进度尺见 `16`；0.9 十流重写见 `17`；回来先读 `18`
- [Harness Governance Layer — mossx 战略架构文档](harness-governance-strategy.md) — accepted 战略；2026-05 正文保留，文首含 2026-08-03 / 0.7.16 六引擎、AppShell 与 gate audit 校准
- [多引擎协作编排设计（Multi-Engine Collaboration）](multi-engine-collaboration-orchestration-design.md) — Shared 内分环节绑定不同 CLI·供应商的编排产品与控制面设计
- [Composer 会话文件变更账本设计（Session File-Edit Ledger）](composer-session-file-edit-ledger-design.md) — Shared/协作「已编辑」Strip 的 durable 数据面（**UI 零改**；draft 2026-08-08）
- [Large File Governance Playbook](large-file-governance-playbook.md)

最近记录的 Harness gate 快照（运行于 2026-08-01，代码边界于 2026-08-03 复核）：engine registry、capability matrix、evidence bridge、domain-event schema 通过；domain-event adoption checker 仍未跟随 type extraction。Policy-router 的 3,101 files / 458 findings 仅是 2026-08-01 advisory inventory，exit 0 不代表零 debt。**在 adoption gate 重新转绿并重新生成 evidence 前，不声明 governance evidence-complete。**

## Large-file 基线

- [Large File Hard-Debt Baseline](large-file-baseline.md)（+ `.json`）
- [Large File New-File Ratchet Baseline](large-file-new-file-baseline.md)（+ `.json`）
- [Large File Near-Threshold Watchlist](large-file-near-threshold-watchlist.md)

baseline / watchlist 是采样快照，**不代表**当前文件行数。执行 gate 时以仓库现有脚本与**当前扫描结果**为准。
相关闭环过程可参考 [`../reports/engineering-toolchain-optimization-impact-2026-07-25.md`](../reports/engineering-toolchain-optimization-impact-2026-07-25.md)。

## 与 analysis / perf 的分工

| 主题 | 目录 |
|------|------|
| 幕布 / 多 CLI 呈现 | [`../analysis/`](../analysis/README.md) |
| 运行时卡顿 / budget | [`../perf/`](../perf/README.md) |
| 客户端辅助债项报告 | [`../reports/`](../reports/README.md) |

## 修订记录

| 日期 | 说明 |
|------|------|
| （既有） | harness + large-file 列表 |
| 2026-08-01 | Batch 1：交叉链接 reports/analysis/perf；强调重扫 |
| 2026-08-01 | Batch 6：Harness 战略文档校准到六引擎；记录可重跑 gate 结果与 checker drift |
| 2026-08-03 | 校准到 0.7.16；把 Harness 数值标记为 recorded snapshot，并更新 AppShell / checker 边界 |
