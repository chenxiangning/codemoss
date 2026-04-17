## Context

本设计不引入实现代码，目标是建立“模块独立性审计框架”。
框架围绕三类风险：

- 状态污染：OpenSpec 与 spec-kit 共享或互写运行态。
- 路由耦合：一个 provider 的请求进入另一个 provider 的 adapter。
- 合并回退：冲突处理时覆盖高风险文件导致功能丢失。

## Design Principles

1. Scope Isolation First：以 provider scope 为最小隔离单元。
2. Wiring-Only for Legacy：旧链路只允许接线，不允许逻辑侵入。
3. Merge by Semantics：冲突按语义融合，不做整文件覆盖。
4. Evidence-Driven Verification：验收必须留存可复查证据。

## Verification Model

### A. Isolation Verification

- 检查点 A1：provider-scope key 生成是否唯一且稳定。
- 检查点 A2：runtime/timeline/gate 是否按 scope 分区存储。
- 检查点 A3：adapter ingress 是否强校验 provider。
- 检查点 A4：跨 scope mutation 是否被拒绝并留痕。

### B. Legacy Non-Intrusion Verification

- 检查点 B1：spec-kit 逻辑是否落在独立目录与独立入口。
- 检查点 B2：legacy 文件是否仅有 wiring 类改动。
- 检查点 B3：OpenSpec 历史能力点是否完整可达。

### C. Merge-Safety Verification

- 检查点 C1：冲突前是否建立左右分支能力矩阵。
- 检查点 C2：冲突解决是否执行语义融合记录。
- 检查点 C3：冲突后是否通过符号哨兵与目标测试。

## Acceptance Evidence Contract

每次检查必须输出以下证据：

- 检查执行时间（绝对日期，如 2026-02-25）。
- 检查执行人。
- 关键命令与结果摘要。
- 风险项与处置结果。
- 最终结论（Pass / Blocked）与后续动作。

## Trade-off

- 方案 A：只做口头约定。
    - 成本低，但不可追溯，易回退。
- 方案 B：引入规范门禁（采用）。
    - 成本可控，且可审计、可复盘、可并行协作。

采用 B，确保 spec-kit 上线后不会对 OpenSpec 造成隐性回归。
