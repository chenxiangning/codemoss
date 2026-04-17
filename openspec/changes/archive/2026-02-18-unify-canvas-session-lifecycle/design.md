## Context

本变更跨越前端会话管理、引擎入口和后端会话列表/删除接口，属于典型 cross-cutting 设计。

现状关键断点：

- 删除链路：`claude` 走 `delete_claude_session`，`codex/opencode` 走 `thread/archive`，用户侧同一“删除”按钮承载了不同语义。
- 引擎入口：Workspace Home 可选 OpenCode，但 Composer 选择受 installed 判定限制，存在链路不一致。
- 排序信号：OpenCode `session list` 仅返回文本型 `updatedLabel`，前端合并排序依赖内存 activity 回退，重启后稳定性不足。
- 文案治理：Plan 与等待提示存在硬编码，语言切换时一致性不可保证。

## Goals / Non-Goals

**Goals:**

- 定义统一会话生命周期契约，压平“同按钮不同语义”。
- 确保“删除结果=后端确认结果=重启后可复验结果”。
- 确保 OpenCode 入口可选性和启动链路一致。
- 确保幕布关键文案可国际化、可测试。

**Non-Goals:**

- 不改动线程核心架构与存储后端。
- 不引入新的业务功能，只修复一致性缺陷。

## Decisions

### Decision 1: 删除语义采用“后端确认驱动”

- 选择：前端只在删除回执成功后移除会话，不做乐观删除。
- 原因：会话是高价值上下文，误删/假删成本高；确认驱动更稳健。
- 备选：乐观删除后回滚。缺点是失败场景体验与状态抖动更严重。

### Decision 2: 统一删除契约，保留引擎适配层

- 选择：对 UI 暴露统一结果结构（`success/code/message`），由适配层映射到 `claude hard delete` /
  `codex-opencode backend path`。
- 原因：用户语义统一，技术异构留在内部。
- 备选：直接暴露引擎差异。缺点是产品语义难解释、测试矩阵膨胀。

### Decision 3: OpenCode 最近会话排序引入稳定时间基线

- 选择：定义排序信号优先级（解析出的结构化更新时间 > 后端可用时间字段 > 安全回退）。
- 原因：当前仅 `updatedLabel` + 内存 activity 无法保证重启稳定。
- 备选：继续依赖 activity map。缺点是重启后排序漂移。

### Decision 4: 入口可用性判定单点化

- 选择：Workspace Home 与 Composer 共享同一“OpenCode 可用性”判定来源。
- 原因：避免“首页可选/输入区不可选”割裂。
- 备选：各自判定。缺点是状态分裂且难回归。

### Decision 5: 幕布文案强制 i18n 化

- 选择：Plan 空态与 OpenCode 等待提示全部走 i18n key，统一 fallback。
- 原因：硬编码会导致混语和不可回归。
- 备选：局部保留硬编码。缺点是语言切换不可控。

## Risks / Trade-offs

- [Risk] 某些引擎后端暂不具备“真实删除”能力  
  → Mitigation：契约层要求失败显式化（`ENGINE_UNSUPPORTED`），禁止伪成功移除。

- [Risk] OpenCode 时间文本格式在不同环境差异大  
  → Mitigation：定义解析失败安全回退与诊断日志，不影响主流程。

- [Risk] 入口可用性合并可能影响已有默认引擎体验  
  → Mitigation：仅统一可选判定，不变更默认引擎策略。

## Migration Plan

1. 规范阶段先收敛契约（本 change）：删除、入口、排序、文案、回归口径。
2. 实施阶段分两批：
    - 批次 A（P0）：删除契约 + 入口一致 + 排序基线。
    - 批次 B（P1）：Plan/等待提示 i18n 与快照测试。
3. 发布前执行重启一致性与跨引擎回归。

Rollback Strategy:

- 删除链路异常时，回退到“只允许确认删除单条 + 批量删除开关关闭”。
- 排序解析异常时，回退为旧排序逻辑并保留告警日志。

## Open Questions

- OpenCode `updatedLabel` 的多语言/多格式样本是否需要先收集一个最小语料集？
- Codex 引擎是否提供可用 hard-delete RPC，或需先定义“显式不支持”策略？
