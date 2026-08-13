# Change: enhance-memory-pick-retrieval-and-observability

**Memory Pick Phase-2** —— 匹配可信 + 失败可感 + 语义转接。

## 一句话

> Pick/Scout 走 hybrid 同核检索；空/超时可感可埋点；注入 Pack 明确「记忆服务用户原文，不抢戏」；**采集 ABCD 零改动**。

## 状态

- [x] Proposal / Design / Tasks / Specs delta（2026-08-10）
- [x] Implementation（hybrid 核 + emptyReason 时间线 + telemetry + 语义转接 + 闸门去彩）
- [x] 人工验收通过（2026-08-10）
- [ ] Sync 主 specs / Archive（可选后续）

## 文档清单

| 顺序 | 文件 | 内容 |
|------|------|------|
| 1 | [proposal.md](./proposal.md) | Why、边界、验收 |
| 2 | [design.md](./design.md) | 检索核、emptyReason、telemetry、转接、触点 |
| 3 | [tasks.md](./tasks.md) | 可勾选任务 |
| 4 | [specs/](./specs/) | 行为 delta |
| 调研 | [06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md](../../../docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md) | MemOS 对照 |
| 指针 | [05-project-memory-pick-gate-pointer.md](../../../docs/research/05-project-memory-pick-gate-pointer.md) | 文档入口 |
| 前置 | [add-memory-pick-gate](../add-memory-pick-gate/) | Phase-1 闸门 |

## Phase-2 能力摘要

| 项 | 结论 |
|----|------|
| 检索 | lexical + semantic（有 provider）→ hybridRerank；无 provider 诚实 lexical |
| 空结果 | `emptyReason`：no_query_terms / no_match / timeout / error / ok |
| 可感 | timeout/error/no_match 在 pick/always 下 toast 或 status；发送不堵 |
| 埋点 | retrieve / gate_shown / confirm / skip / dismiss / auto_confirm / inject |
| 转接 | Pack Instruction + Cleaner 导语 + UI「为本轮提问参考」 |
| 采集 | **禁止**改 capture/complete |

## 实现入口（预计）

| 区域 | 路径 |
|------|------|
| 检索核 | `memoryPick/memoryPickRetrieval.ts` · `utils/projectMemorySemanticRetrieval.ts` · `utils/memoryScout.ts` |
| 注入 | `injectMemoryPickContext.ts` · `projectMemoryRetrievalPack.ts` |
| 可观测 | 新建 `memoryPick/memoryPickTelemetry.ts`（名可调整） |
| 编排 | `useThreadMessaging.ts`（仅 pick 消费分支） |
| 闸门 UI | `MemoryPickGate.tsx`（可选 status 展示） |
| 测试 | `memoryPick/*` · pack · scout · semantic · messaging memory-pick |
