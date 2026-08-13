## Why

社区反馈（#087 等）在打开 Shared 会话时长时间卡在历史 curtain「正在拉取 canonical 投影 transcript…」（进度 **58%**），可达 1–3 分钟；同时 recovery 条可能已显示「已解除锁定」，用户体感「解锁仍然很久」。开发者 Mac / Win11 与本地重数据压测均无法用「纯算力/磁盘」复现分钟级 `SharedProjector::project`，说明问题更像 **把 projection 成功放在 ready 门槛上** 导致的等待放大（含单写者排队、无超时 await、低 CPU 挂起）。需要 **不依赖用户配合排查** 的止血：V0 先可用、projection 非阻塞/可超时降级，并澄清 recovery 解锁与历史加载是两条线。

## What Changes

- Shared 历史打开：**`loadSharedSession`（V0 snapshot）完成后即可 hydrate 画布并解除 `historyLoading` 阻塞**，不得死等 `loadSharedProjection` 成功才 ready。
- `loadSharedProjection` 改为 **后台 / 可超时**：成功后 merge 进画布；超时或失败时在已有 V0 时 **可观测降级**（沿用现有 fallback 语义，禁止无限 hang）。
- 进度语义：58% 之后的 merge/finalize **不得** 阻止发送与继续对话；可选轻量「后台同步」指示，禁止整页 curtain 锁死。
- **解锁体感一并处理（分析结论见下）**：recovery 状态机解锁（`recovery-required` → idle/cleared）与 history curtain **解耦**；V0 ready 后 composer/发送门禁只受 recovery/target 约束，**不受 projection 未完成约束**。
- 可选轻量：projection 路径内 enrich / 读路径强制写 checkpoint 不得拉长 first-paint 关键路径（实现细节见 design；不改变 canonical 权威）。
- 静默诊断 span（可选、默认本地落盘）：不要求用户操作；便于日后取证。

**非 BREAKING**：正常 projection 秒级返回时，最终画布仍收敛到 projection 优先合并结果；发送/防双发/recovery fail-closed 合同不变。

## 目标与边界

- **目标**：Shared 打开历史 **不再因 projection 挂起导致分钟级不可用**；用户 V0 就绪后可继续对话；澄清并切断「已解锁但仍卡 curtain」的体感耦合。
- **边界**：只改 Shared `sharedHistoryLoader` 打开路径与 ready 门槛；不取消 `recovery-required` 防双发；不自动 blind retry；不改 native 各 engine history loader（除非共享 curtain 合同需要一句对齐说明）。

## 非目标

- 根治 SharedEventWriter 单写者全局性能 / 全库 400MB 清理。
- 取消 canonical projection 权威或永久关闭 projection（`mossx.sharedProjection` 仍可作调试开关，非常规路径）。
- 要求社区用户开开关、导日志、改 Defender。
- 重做 recovery exit ladder（已有 `fix-shared-session-recovery-exit-closure`）；本 change 只保证 **history ready 不绑架 recovery 解锁体感**。
- 冷启侧栏 catalog 全量扫描（若默认不进会话仍慢，另 change）。

## Capabilities

### New Capabilities

- `shared-history-open-nonblocking`: Shared 历史打开 first-paint / projection 后台与超时降级、historyLoading 解除与发送门禁解耦合同。

### Modified Capabilities

- `shared-session-curtain-parity`: curtain/loading 进度不得在 V0 已可用时继续整页阻塞对话。
- `shared-canonical-projection`: 明确 projection 加载失败/超时时对 V0 的降级与后台合并要求（不削弱成功路径权威）。

## Impact

- Frontend: `sharedHistoryLoader.ts`、`useThreadActionsResumeThread.ts`（或 history load 调用方）、`historyLoadingProgress` 语义、Messages curtain 展示、可选 `sharedSessions.ts` invoke 超时包装。
- Backend（可选本波）：`load_shared_projection` 不强制改 API；enrich/checkpoint 延后属 P1。
- Tests: sharedHistoryLoader + shared-history resume 测试；进度/loading 门禁。
- Docs: 本 change；与 recovery-exit change 交叉引用。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 仅加超时 toast，仍等 projection | 改动小 | 超时前仍卡；解锁体感未解 |
| **B. V0 first-paint + 后台 projection + 超时降级（推荐）** | ready 与 projection 解耦 | 止血对症；正常路径几乎无感 |
| C. 默认关 projection | 最快 | 功能回退，伤正常系 fidelity |

采用 **B**。

## 「解锁很久」分析（与 58% 一并）

用户截图同时出现：

1. History curtain @ **58%**（`loadSharedProjection` await 中）
2. Recovery bar：「会话卡住 · 未发现待处理的发送，**已解除锁定**」

| 链路 | 职责 | 与「解锁」关系 |
|------|------|----------------|
| Recovery / probe / skip | 发送状态机 `recovery-required` → idle | 文案「已解除锁定」= **发送锁** 侧 |
| History loader | 画布消息 hydrate | **不负责** 发送锁，但 `historyLoading===true` 时整页 curtain |

**结论（本 change 采纳）**：

- 「解锁后仍卡很久」**主因是两条线误叠**：recovery 已 clear，curtain 仍死等 projection → 用户以为解锁慢。
- 次因（P1，非本波必做）：recovery 的 `turn_state` / `recover_attempt` 与 projection 抢 **同一 SharedEventWriter**，可能互相拖慢；V0 first-paint 后即便 writer 仍忙，**输入已可用**。
- recovery exit 合同本身（跳过本轮等）不在本 change 重做；本 change **强制** V0 ready 后不得因 projection 未完成保持 `historyLoading=true`。

## 验收标准

1. Shared 打开：V0 snapshot 返回后 ≤ 用户可感知延迟内卸主 curtain / `historyLoading` 不为 true（允许短暂 prepare/session 阶段）。
2. projection 人为挂起/超时：会话仍可发送（无 `recovery-required` 时）；画布至少展示 V0 内容。
3. projection 正常秒回：最终画布与现网一致（merge 后 fidelity 不回退）。
4. recovery 显示已解锁时，不得仅因 projection 未完成阻止继续聊。
5. 正常系 Shared 发送 / 防双发 / recovery fail-closed **行为不变**。
6. 自动化：loader 单测覆盖「V0 先完成、projection 慢/失败」路径。
