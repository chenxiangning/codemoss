# Design: establish-shared-event-storage

> 上游：Foundation Design §14.4（[`mossx-multi-cli-provider-session-foundation-design.md`](../../../docs/research/mossx-multi-cli-provider-session-foundation-design.md)）、Wave 0 契约（`establish-session-foundation-contracts`）。
> 本文把 §14.4 的逻辑契约落成具体模块设计；行为语义见 `specs/shared-event-storage/spec.md`。

## 1. 决策总览

| # | 决策 | 依据 |
|---|---|---|
| D1 | SQLite WAL + 单写者 Actor（专用 OS 线程 + std::sync::mpsc） | Foundation §14.4.1/§14.4.3；同步 rusqlite 调用不阻塞 tokio runtime，线程天然串行化 |
| D2 | 模块落位 `src-tauri/src/shared_event_log/`，按 domain 子模块拆分 | `dev-guidelines/backend/directory-structure.md` |
| D3 | 零新增依赖：rusqlite 0.32 (bundled) + serde_json + sha2 已在/将确认于 Cargo.toml | 胶水开发模式；sha2 若缺则评估后补（成熟维护库） |
| D4 | 崩溃测试台用"子进程受害模式"：同一 test binary 以 env 进入 victim 角色，父进程 SIGKILL | 真实 WAL 行为，不模拟；Foundation §14.4.8 |
| D5 | checksum 的 deterministic-json：递归 sort object keys、UTF-8、无空白、number 走 serde_json 最短往返格式 | Foundation §14.4.4：不得依赖语言 Map 迭代顺序 |
| D6 | A1 存储 payload_json 为 TEXT，不做字段级校验 | 字段校验是 A2.1；A1 只保证 envelope 必需列、幂等键与事务语义 |
| D7 | migration 用 `PRAGMA user_version` 单调递增，迁移在 open 时串行执行 | rusqlite 惯例；迁移失败 fail closed |

## 2. Schema（§14.4.2 七条保留项 → 实现映射）

建六表：`shared_sessions_v2`、`shared_event_log`、`shared_binding_state`、`shared_projection_checkpoint`、`shared_legacy_import`、`provider_usage_aggregate_log`（DDL 以 Foundation §14.4.2 为准，实现允许调整 SQL 细节）。

保留项逐条落实：

1. **per-session monotonic sequence**：`shared_sessions_v2.next_sequence`；测试断言单调且允许空洞（崩溃后）。
2. **Event insert 与 next_sequence 同一 transaction**：`append_event` 内 `BEGIN IMMEDIATE` → 读/增 `next_sequence` → insert → COMMIT；任何语句失败整体 ROLLBACK。
3. **event idempotency**：`PRIMARY KEY (session_id, event_id)`；重复 append 返回 `Duplicate { existing_sequence }`，不报错。
4. **attempt/fact uniqueness**：partial unique index `(session_id, attempt_id, fact_type) WHERE attempt_id IS NOT NULL AND fact_type <> 'conversation.usageRecorded'`；Turn Usage 例外走 `dedupe_key = usageRecordId`（partial unique index `(session_id, fact_type, dedupe_key)`）。
5. **Provider Usage Ledger 独立**：`provider_usage_aggregate_log` 无 `session_id` 列；PK `(provider_profile_id, window_started_at, window_ended_at, report_subject_id, revision)`；writer 校验 supersede 链（revision 必须 = 当前最高 + 1，且 supersedes 指向当前最高）。
6. **Binding/Cursor/Pending 持久化**：`shared_binding_state` 以 `(session_id, binding_key)` PK；provisioning/pending 存 JSON 列。
7. **rebuildable projection + legacy marker**：`shared_projection_checkpoint`（`projection_name + projection_version + through_sequence`）；`shared_legacy_import` 以 `(session_id, source_fingerprint)` 幂等。

Runtime contract：`PRAGMA journal_mode=WAL; foreign_keys=ON; synchronous=FULL; busy_timeout=<5s>`。DB 文件 `0600`、父目录 `0700`（Windows 等价 ACL 留 TODO 注释）。硬边界：禁止 frontend 写表、禁止 Adapter 自分配 sequence——本模块不暴露任何接受外部 sequence 的 API。

## 3. 模块结构

```text
src-tauri/src/shared_event_log/
  mod.rs        // 公开导出 + 模块文档
  error.rs      // StoreError（typed，thiserror 风格手写 impl，不新增依赖）
  schema.rs     // DDL + migration（user_version）
  checksum.rs   // deterministic-json + SHA-256
  writer.rs     // SharedEventWriter actor + SharedEventStore 同步内核
  ledger.rs     // Provider Usage Ledger writer + supersede 校验
  recovery.rs   // open 恢复：quick_check、read-only 降级、不建空库覆盖
src-tauri/tests/
  shared_event_log_store.rs        // 单元级集成：sequence/幂等/Ledger/cursor
  shared_event_log_crash.rs        // 崩溃测试台（victim 子进程 + SIGKILL）
```

## 4. 公开 API 草图

```rust
pub enum OpenOutcome {
    Ready(SharedEventWriter),
    ReadOnlyRecovery { reason: String, events: ReadOnlyEventReader },
}

pub fn open(path: &Path) -> Result<OpenOutcome, StoreError>;

pub struct NewCanonicalEvent {
    pub session_id: String,
    pub event_id: String,
    pub fact_type: String,
    pub logical_turn_id: Option<String>,
    pub attempt_id: Option<String>,
    pub dedupe_key: Option<String>,
    pub payload_json: String,        // envelope JSON（A2 起负责字段校验）
    pub fidelity: Fidelity,          // Canonical | PresentationOnly
    pub committed_at: i64,
}

pub enum AppendOutcome {
    Inserted { sequence: i64, payload_checksum: String },
    Duplicate { existing_sequence: i64 },
}

impl SharedEventWriter {
    pub fn append_event(&self, event: NewCanonicalEvent) -> Result<AppendOutcome, StoreError>;
    pub fn upsert_binding_state(&self, state: BindingStateUpdate) -> Result<(), StoreError>;
    pub fn record_provider_usage(&self, record: ProviderUsageRecord) -> Result<LedgerOutcome, StoreError>;
    pub fn shutdown(self);
}
```

- checksum 由 writer 内部计算并随 insert 落盘，调用方不提供（防伪造）。
- `SharedEventWriter` 是 Clone-able handle（内部 mpsc sender）；Connection 只存在于 actor 线程。
- ReadOnlyEventReader 只暴露只读查询，用于 recovery 模式导出诊断。

## 5. 崩溃/掉电测试台（A1.5）

- victim 模式：test binary 以 `MOSSX_STORE_VICTIM=1` 重入，按指令在指定事务边界（insert 前 / sequence 更新后 insert 前 / commit 前 / commit 返回后）通过 stdout 发 ready 信号；父进程读信号后 SIGKILL。
- 随机强杀：≥50 轮，每轮 victim 持续写入、父进程在随机延迟后 SIGKILL；重启后断言：
  - `quick_check` 通过；
  - 每个 session 的 event 数量 = 成功 COMMIT 的数量（victim 侧以 stdout 汇报），无半提交；
  - sequence 单调、无重复、无 `(session_id, sequence)` 冲突；
  - 重复 append 重启前已汇报成功的事件 → `Duplicate`。
- Ledger 幂等：100 次重复写同一 `(provider, window, subject, revision)` 只有一行；revision 跳跃（+2）被拒绝。

## 6. 启动恢复（A1.6）

- 文件不存在 → 新建（允许）；文件存在且 size>0 → `PRAGMA quick_check(1)`（仅将错误输出限制为 1 条，不把参数误解为 wall-clock timeout；完整 check 留给显式诊断命令）。
- quick_check 失败或打开报 SQLite 损坏 → `OpenOutcome::ReadOnlyRecovery`（OpenFlags::SQLITE_OPEN_READ_ONLY），typed error 说明；**禁止**删除/重命名/新建覆盖。
- 未结算 `BindingProvisioningState`/`pendingDelivery` 的恢复扫描属 A2/B；本模块只在 `shared_binding_state` 提供查询 API。

## 7. 测试矩阵（Gate 1）

| 用例 | 断言 |
|---|---|
| migration 幂等 | 重复 open 不报错，user_version 单调 |
| sequence 单调 | 多 session 交错 append，各自单调 |
| 事务回滚 | 人为制造 insert 后错误（如 cursor 更新冲突），event 与 next_sequence 同时回滚 |
| 100 次重复写 | event_id / attempt+factType / dedupe_key 三条幂等路径均无重复行 |
| usage 例外 | 同 attempt 可有多条 usageRecorded（不同 usageRecordId），同 usageRecordId 去重 |
| Ledger supersede | rev1→rev2 合法；rev3 无 rev2 拒绝；aggregate-only 无 session 字段 |
| 边界强杀 | 四个事务边界逐一 SIGKILL，重启 all-or-nothing |
| 随机强杀 ×50 | 无半提交、无重复、quick_check 通过 |
| 损坏恢复 | 人为截断 DB 文件 → ReadOnlyRecovery，不覆盖 |
