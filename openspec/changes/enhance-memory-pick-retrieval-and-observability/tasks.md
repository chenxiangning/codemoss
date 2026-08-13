# Tasks: enhance-memory-pick-retrieval-and-observability

> 依据：`proposal.md` · `design.md` · `specs/**` · research `06`  
> **硬护栏**：禁止改 ABCD 采集（capture/complete）契约与时序。

## 0. Specs / 文档

- [x] 0.1 proposal / design / tasks / README
- [x] 0.2 delta specs（memory-pick-gate / consumption / semantic / pack-cleaner）
- [x] 0.3 research `06` + pointer `05` + docs/README 索引
- [x] 0.4 实现中回写 design 常量与真实文件路径
- [ ] 0.5 `openspec validate`（若环境可用）
- [ ] 0.6 完成后 sync / archive 流程

## 1. 类型与 Telemetry（W1）

- [x] 1.1 `MemoryRetrieveEmptyReason` / `MemoryRetrieveDiagnostics` 类型
- [x] 1.2 `memoryPickTelemetry.ts`：emit + 可注入 sink
- [x] 1.3 单测：emit props 白名单（无正文）

## 2. 检索核（W3 可与 W1 交错）

- [x] 2.1 抽取/实现统一 retrieve 函数（lexical + optional semantic + hybridRerank）
- [x] 2.2 `memoryPickRetrieval.ts` 改走统一核，返回 diagnostics
- [x] 2.3 无 provider → lexical 诚实；有 mock provider → hybrid/semantic
- [x] 2.4 timeout / error 映射 emptyReason
- [x] 2.5 （可选）CJK 短词补强 — 复用既有 `normalizeQueryTerms` bigram
- [x] 2.6 `memoryScout.ts` 对齐 emptyReason diagnostics（Brief 兼容扩展）
- [x] 2.7 单测：retrieval 矩阵

## 3. 可感失败（W2）

- [x] 3.1 i18n 空结果文案（zh/en 至少；key: `memoryPick.toast.*`）
- [x] 3.2 `useThreadMessaging` 消费分支：emptyReason → **主幕时间线 status**（非全局 toast）；仍 0 注入发送
- [x] 3.3 messaging 集成测：timeout/no_match 不堵发送 + 时间线 notice
- [x] 3.4 emit `memory_pick_retrieve` 带 emptyReason

## 4. 语义转接（W4）

- [x] 4.1 `formatProjectMemoryRetrievalPack` Instruction 升级（Primary / reference / UNTRUSTED）
- [x] 4.2 Cleaner 导语（若适用）
- [x] 4.3 `buildMemoryPickPreviewText`「为本轮提问参考」
- [x] 4.4 pack / inject 单测 snapshot
- [x] 4.5 i18n preview 字符串

## 5. 闸门与埋点挂载

- [x] 5.1 gate_shown / confirm / skip / dismiss / cancel / auto_confirm / inject 事件
- [x] 5.2 auto_confirm fire/interrupt 与 Phase-1 arm 逻辑共存
- [x] 5.3 Gate 测试更新（不破坏现有 11 例语义）

## 6. 采集零回归护栏

- [x] 6.1 PR diff 自检：无 capture/complete 时序变更
- [x] 6.2 跑 capture 相关既有测试并列出文件 — messaging memory-pick 全绿；capture 调用块未改
- [x] 6.3 跑 design §8.3 命令清单（memoryPick + pack + gate + messaging.memory-pick）

## 7. 收尾

- [x] 7.1 design § 常量与代码对齐
- [x] 7.2 finish-work / commit（中文 conventional）
- [x] 7.3 Trellis session record

建议 subject：

```text
feat(memory-pick): Phase-2 hybrid 检索与可感注入转接
```
