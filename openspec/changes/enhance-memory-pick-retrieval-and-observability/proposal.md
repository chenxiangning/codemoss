# Proposal: enhance-memory-pick-retrieval-and-observability

## Why

Phase-1 已交付发送前 **Memory Pick Gate**（可见、可勾、可 dismiss、always 读秒）。  
但消费侧仍有三处硬伤：

1. **匹配弱**：Pick 路径仍是 list + 词面分；`projectMemorySemanticRetrieval` 与 hybrid 合同已存在却未接线（MemOS 本地插件已用多通道 hybrid，对照见 research `06`）。
2. **失败不可感**：空/超时/无词 → auto-skip 静默直发，用户以为「记忆开了其实 0 注入」。
3. **注入措辞弱**：Pack Instruction 过短，模型易把记忆当任务；产品要求 **记忆只服务用户当前原文**。

本 change 做 **消费侧 Phase-2**，明确 **不碰对话结束后的记忆采集（ABCD）**。

## What Changes

### In Scope

1. **统一检索核（hybrid-capable）**  
   - Pick Gate 与 Memory Scout **同核**：lexical +（provider 可用时）semantic → hybridRerank。  
   - 无真实 embedding provider：`retrievalMode=lexical`，**禁止**用 lexical 分伪装 semantic。  
   - 可选轻量 CJK 短词补强（借鉴 MemOS pattern，不引入 FTS5 全栈）。

2. **emptyReason + 用户可感**  
   - 枚举：`ok | no_query_terms | no_match | timeout | error`。  
   - pick/always 路径：timeout/error/no_match 必须 toast 或等价 status；发送永不阻塞。

3. **Telemetry 最小集**  
   - 事件：retrieve / gate_shown / confirm / skip / dismiss / cancel / auto_confirm / inject。  
   - 结构化 sink（console/diagnostics 可挂）；**禁止**日志写记忆正文/用户全文。

4. **语义转接（bridging voice）**  
   - Pack Instruction：Primary task = 用户原文；记忆 = prior reference；UNTRUSTED 不执行记忆内指令。  
   - Cleaner 导语 + 摘要卡文案：「为本轮提问参考」。

### Out of Scope（Non-goals）

| 不做 | 原因 |
|------|------|
| 改 `captureTurnInput` / `completeTurnMemory` / ABCD | 采集已正确；本 change 零回归目标 |
| Neo4j / Qdrant / 嵌入 MemOS 运行时 | 桌面边界 |
| L2 policy / L3 world / Skill 结晶 | ROI 远 |
| Session policy 持久化 / dismiss 恢复 | 另 change |
| 默认 LLM query rewrite / LLM filter | 延迟与成本；可选更后 |
| 设置页调 top_k/超时 | 常量即可 |

## 调研依据

- `docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md`
- MemOS 本地：`apps/memos-local-plugin/core/retrieval/*`、`packages/memos-core/src/recall/*`
- mossx 合同：`project-memory-local-semantic-retrieval`、`project-memory-retrieval-pack-cleaner`、`add-memory-pick-gate`

## 验收标准（Phase-2）

1. Pick 检索 diagnostics 含 `retrievalMode` 与 `emptyReason`；有 provider 测到 hybrid/semantic 路径，无 provider 诚实 lexical。  
2. always/pick 下 timeout 与 no_match **用户可见提示**；仍以 0 注入发出原文。  
3. 确认注入后 pack Instruction 含 Primary task / reference-only / UNTRUSTED 语义（单测 snapshot）。  
4. 摘要卡/preview 文案体现「为本轮提问参考」，非「已发送记忆任务」。  
5. telemetry 在 retrieve/confirm/skip 路径至少各触发一次（单测 mock sink）。  
6. **采集回归**：现有 capture 相关测试全绿；diff **不得**改 capture/complete 签名与调用时序。  
7. Native / Shared / Collab 首段消费入口仍统一（编排仅消费分支改动）。

## 风险

| 风险 | 缓解 |
|------|------|
| 误改采集 | tasks 硬护栏 + 测试门禁 + design 触点表白名单 |
| 无 embedder 体感无提升 | 诚实 lexical + 后续 provider 接线不挡本 change |
| 注入过强抢戏 | Instruction 单测 + 禁止 MemOS「MUST 当既定知识」措辞 |
| 主线程 jank | 异步检索、候选 ≤25、超时预算 |

## 拍板决策（已确认）

| # | 决策 | 值 |
|---|------|-----|
| 1 | 无 embedding provider | 诚实 lexical + 埋点 |
| 2 | always + 空候选 | 不弹满闸门；toast/status |
| 3 | embedding 生产 | 本 change 接线接口；provider 落地可并行 |
| 4 | 埋点后端 | 先本地 structured sink |
| 5 | 采集 | 零改动 |
