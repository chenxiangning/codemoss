## Why

自动编排只有在 crash、stale owner、dirty workspace 与 stop race 下仍能证明“哪些 side effect 发生过”时才可信。V1 需要把 workspace Single Writer、change fence、exact-owner recovery 与 Emergency Stop 变成 durable contract，而不是依赖内存队列或自动 rollback 猜测。

## 目标与边界

- 同一 normalized workspace 同时最多一个 mutation lease；不同 workspace 可并行。
- 当前 workspace 使用 approved development authority；越过 workspace、credential、remote write、deploy 一律 fail closed。
- dirty workspace 允许执行，但 change fence 必须区分 baseline/user-owned changes 与 Squad-owned observed delta。
- crash recovery 只基于 Canonical Facts + exact owner probe；ambiguous side effect 进入 visible blocked/recovery-required，不 blind replay。
- `Emergency Stop` 立即停止新 dispatch，并 best-effort interrupt exact running owners；不自动 reset/rollback。

## What Changes

- 新增 `WorkspaceMutationLease` 的 durable CAS、lease epoch、holder identity、renew/release/rebuild contract。
- 新增 `ChangeFence` baseline manifest、scope violation detector、owned-delta observation 与 forward-repair policy。
- 新增 recovery classifier：prepared-not-linked、linked-running、terminal-missing、ambiguous-side-effect、stale lease。
- 新增 cancel intent、exact owner interruption、idempotent run settlement 与 restart hydration。
- 新增 kill switch `squadOrchestrationV1`，关闭后禁止新 run，但保留历史 projection/readability。

## 非目标

- 不执行自动 `git reset`、checkout、stash、rollback、commit、push 或 deploy。
- 不通过 process-name scan 猜 owner，不清理无法证明属于 Squad 的进程。
- 不允许 outside-workspace path 通过“最大权限”语义绕过 scope gate。

## 方案取舍

- 采用 **forward repair + durable fence**。相比自动 rollback，避免覆盖用户 dirty changes；相比完全禁止 dirty workspace，保留真实开发工作流。
- mutation lease 作为 **same SQLite writer 下的 rebuildable operational index**，并以 canonical lease facts审计。相比第二 event store，不分裂事实源；相比纯内存 mutex，可跨 crash/session 恢复。

## Capabilities

### New Capabilities

- `shared-squad-recovery`: Workspace mutation lease、change fence、stop、recovery 与 kill-switch contract。

### Modified Capabilities

- `shared-state-lock-governance`: 新增 workspace mutation lease domain、lock order 与 no-I/O-under-lock contract。
- `shared-event-storage`: lease CAS 与对应 canonical fact 必须在 single-writer transaction 中保持原子一致。

## Impact

- Backend: `src-tauri/src/squad_orchestration/**`、`shared_event_log/schema.rs`、`writer.rs`、runtime interrupt adapters。
- Frontend: visible blocked/recovery/stop projection 与 inspector action mapping。
- Operations: additive migration、feature flag/kill switch，无 destructive data migration。

## 验收标准

- 同 workspace 两个 concurrent Mutate requests 恰有一个取得 lease；不同 workspace 均可前进。
- dirty baseline 文件不被自动覆盖/删除；out-of-scope observed delta 立即阻止后续 mutation。
- crash 后已确认 terminal 的 attempt 不重放；无法证明 side effect 的 attempt 进入 recovery-required。
- Stop 后不再 dispatch 新 node；仅对 exact owner 发 interrupt；重复 Stop/settlement 幂等。
