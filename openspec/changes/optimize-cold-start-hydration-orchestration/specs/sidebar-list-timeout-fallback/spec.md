## ADDED Requirements

### Requirement: Full-catalog OpenCode budget timeout MUST use the same last-good path as generic timeout

当 full-catalog 中 OpenCode 子源因 **冷启预算** timeout（实现常量，可比通用 `NATIVE_SESSION_LIST_FETCH_TIMEOUT_MS` 更短）而返回 `null` 或等价 settle 时，系统 MUST 与既有 `withTimeout` null 路径行为一致：seed last-good OpenCode 条目、不污染其他引擎、并保留可观测诊断。

#### Scenario: budget timeout preserves last-good opencode entries

- **WHEN** sidebar `listThreadsForWorkspace` 处于 full-catalog 阶段
- **AND** OpenCode 子源在冷启预算 timeout 内未完成
- **THEN** 最终列表 MUST 包含上一轮 last-good 中 retainable 的 OpenCode 条目
- **AND** 系统 MUST 通过 `seedLastGoodEngineIntoMerged("opencode", ...)` 或行为等价路径完成投递

#### Scenario: budget timeout does not wipe claude or codex base

- **WHEN** OpenCode 预算 timeout
- **AND** Claude seed 或 Codex catalog 已产生 base/merged 条目
- **THEN** 这些非 OpenCode 条目 MUST NOT 因 OpenCode timeout 被清空

### Requirement: Stale full-catalog subsource results MUST NOT apply after cancel or force-enter

当 full-catalog 任务因 force-enter、workspace 切换或 orchestrator stale cancel 而 discarded 后，任何仍在飞行的引擎子源（含 OpenCode、Claude、list_threads 主结果）settle 时 MUST 检查 generation / `isStale`；若已 stale，MUST NOT 调用 `setThreads` 或覆盖侧栏 membership。

#### Scenario: late list_threads after force-enter is ignored

- **WHEN** 用户 force-enter 取消了 workspace W 的 full-catalog
- **AND** 随后 `list_threads` 或 OpenCode IPC 返回成功 payload
- **THEN** 系统 MUST NOT 将该 payload 作为 W 的权威列表写入 store
- **AND** 已有 UI 列表 MUST 保持 force-enter 前的可见状态或 first-paint 状态

#### Scenario: late opencode after timeout degraded does not thrash list

- **WHEN** full-catalog task 已因 timeout degraded 并进入 cooldown
- **AND** OpenCode IPC 在 task settle 之后才返回
- **THEN** 若 generation 已失效，系统 MUST 丢弃该结果
- **AND** MUST NOT 仅因晚到 OpenCode 再次触发整表 setThreads 风暴
