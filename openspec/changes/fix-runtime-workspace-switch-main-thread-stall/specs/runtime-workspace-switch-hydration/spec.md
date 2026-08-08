## ADDED Requirements

### Requirement: Runtime workspace list hydration MUST cooperatively abandon after cancel/stale

当 `listThreadsForWorkspace` 通过 startup orchestrator（或等价路径）携带 `isStale` 时，在 `isStale() === true` 或 requestSeq 已过期后，实现 MUST 协作式放弃后续重活：MUST NOT 启动新的 thread-list 相关 IPC 阶段（含 titles 之后的 shared list、codex 分页下一页、project catalog / Claude seed / OpenCode list 启动、gemini/kimi/grok 会话刷新），MUST NOT 对过期请求 `setThreads`。

已在途的单次 IPC 完成后 MUST 在下一检查点 return，不得继续 fan-out。

#### Scenario: cancel mid-list stops further stages

- **WHEN** workspace A 的 list hydration 已开始且仍在 titles/shared/paging 之间
- **AND** 用户切换到 workspace B 导致 A 的 generation `isStale`
- **THEN** A 的 list body MUST 在下一检查点 return `{ applied: false, stale: true }`（或等价）
- **AND** MUST NOT 再发起 A 上后续 list IPC / multi-engine catalog fan-out
- **AND** MUST NOT dispatch A 的 `setThreads` from that request

#### Scenario: background engine refresh respects stale

- **WHEN** full-catalog 已调度 gemini/kimi/grok 后台 refresh 闭包
- **AND** 在闭包执行前或 await 后请求变为 stale
- **THEN** 闭包 MUST NOT dispatch `setThreads` for that stale request
- **AND** MUST 使用与主路径一致的 latest/stale 判定（不得只比对 requestSeq 而忽略 isStale）

#### Scenario: slot free still allows new workspace first-paint

- **WHEN** cancel 释放 active-workspace / thread-session-scan 槽位
- **AND** 新 active workspace 需要 first-paint
- **THEN** 系统 MUST 仍能立即启动新 workspace 的 list task（与 cold-start cancel 语义一致）

### Requirement: Runtime switch MUST NOT rely on startup gate for click safety

运行时跨 workspace 切换 MUST NOT 依赖 `StartupGateOverlay` 或 `startup-gate-ready` 来避免卡顿；可交互性 MUST 主要来自取消后停重活与既有 startTransition/yield 策略。

#### Scenario: post-gate switch still abandons stale work

- **WHEN** `startup-gate-ready` 已 stamp
- **AND** 用户从 workspace A 切到 B
- **THEN** A 的 in-flight list MUST 仍被 cancel 标记 stale 并协作式放弃
- **AND** 系统 MUST NOT 要求重新打开启动遮罩才能保持可点
