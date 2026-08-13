## Why

普通 CLI 跨 Provider 续接目前需要两次确认，并把 projection mode、omissions 等内部细节直接暴露给用户；首次确认后还会长时间停留在无进度的 loading。需要把决策信息压缩为一次确认，并从 Claude CLI bootstrap 根因与可观测反馈两侧降低等待成本。

## 目标与边界

- 采用已确认的 C「分阶段」弹窗：增加 Provider 切换 icon，融合确认与降级摘要，只展示来源、目标、预计上下文 Token 和真实处理阶段。
- 弹窗打开后先完成无 target-side-effect 的 durable preparation，用户确认前不得创建目标 Native Session 或发送 Context。
- 用户只需一次“继续”；prepared package 即使 degraded，也由这一次确认授权执行，不再出现第二个 degradation confirmation。
- 进度只由 prepare / create / deliver / verify / finalize 等真实阶段事件驱动；禁止高频轮询或根链逐事件 state 更新。
- Claude continuation bootstrap 使用专用 minimal CLI surface，减少 tools、MCP、skills、hooks、thinking 与 prompt suggestion 的启动成本，同时保留 Provider/API explicit rejection 检测。

## 非目标

- 不改变来源 Session 的只读、idempotency、artifact checksum、target identity 或 recovery contract。
- 不改变普通 Claude/Codex 对话的 CLI 参数、tools、skills、MCP 或 permission behavior。
- 不扩展 Kimi、Gemini、OpenCode 的 continuation target capability。
- 不承诺固定耗时或伪造线性百分比；实际 Provider/API latency 仍可能波动。

## What Changes

- 新增 prepare-only continuation contract：返回 fidelity 与 token estimate，但不产生 target-side effect。
- 取消或关闭尚未执行的预览时，安全丢弃仅处于 `prepared` 且无 target identity 的 operation。
- 修改产品确认 contract：degraded information 合并进首次弹窗，删除二次确认与 omission 明细展示。
- 新增 operation-scoped、低频 Provider continuation progress event。
- 修改 Claude bootstrap command：仅 continuation bootstrap 启用 `safe-mode`、empty tools、disabled skills/slash commands、disabled thinking 与 prompt suggestions，并使用精简 system prompt。
- 增加 frontend、Tauri DTO、Rust command/command-builder 与 progress event regression tests。

## 方案取舍

### 方案 A：prepare-only + 单次执行（采用）

打开弹窗即冻结并编译 Context，返回真实 Token；点击“继续”后复用 frozen artifacts 并直接执行。优点是信息真实、确认只有一次、点击后的本地准备等待被前移且 retry 继续幂等；代价是需要 prepared-operation cleanup 与少量跨层 contract。

### 方案 B：首次点击直接 `confirmDegraded: true`

改动最小，但点击前无法展示真实 Token，且 source read / compile 仍全部位于点击后的 loading，不能实现图 1 与图 2 的真实内容融合，因此不采用。

### 方案 C：frontend 估算 Token + 假进度

无需 backend 变更，但估算可能与最终 package 不一致，进度无法反映真实阶段，会制造错误确定性，因此禁止。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 将 degraded 二次确认改为 prepare-only 后的一次产品确认；补充 prepared cleanup、阶段进度与 Claude minimal bootstrap performance contract。

## Impact

- Frontend：`ProviderContinuationDialog`、`useSidebarMenus`、Tauri service DTO、events 与 i18n。
- Backend：`native_continuation` commands、command registry、Claude continuation-only command profile / command builder。
- Contract：`openspec/specs/native-provider-continuation/spec.md` 的 delta，以及 `dev-guidelines/backend/native-provider-continuation-contract.md` 的实现同步。
- Dependencies：不新增依赖；复用现有 Dialog、Progress、Tauri event hub 与 Claude CLI 原生 flags。

## 验收标准

- 弹窗采用方案 C：标题 icon、三阶段状态、可读会话标题、完整 source → destination、预计 Token；不展示 `MOSSX_CONTEXT_PACKAGE`、projection mode、omission 或 adapter drop 明细。
- prepare 完成前按钮 disabled；取消不得创建 target；prepare 完成后只需一次“继续”，即使 degraded 也不得进入第二确认态。
- 同一 `operationId` 的执行复用 frozen artifacts；重复点击与 retry 不创建第二个 target。
- 底部 progress bar 与阶段文案只消费 operation-scoped backend milestones；首个 milestone 前保持 0，不启动 polling timer 或按时间插值。
- continuation bootstrap command regression test 证明 minimal flags 生效，普通 Claude turn command regression test 证明行为不变。
- focused Vitest、Rust tests、`npm run typecheck`、runtime contract check 与 OpenSpec strict validation 通过。
