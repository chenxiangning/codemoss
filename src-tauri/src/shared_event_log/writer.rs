//! `SharedEventWriter` 单写者 Actor 与 `SharedEventStore` 同步内核。
//!
//! - `SharedEventStore` 直接持有 `rusqlite::Connection`，保持 crate-private；
//!   集成与崩溃测试也经 actor 驱动，防止生产调用方绕过单写者边界；
//! - `SharedEventWriter` 把 store 放进专用 OS 线程，经 `std::sync::mpsc` 串行化写请求，
//!   handle 可 Clone，不阻塞 tokio runtime（设计 D1）；
//! - `append_event`：`BEGIN IMMEDIATE` → 幂等预检 → ensure session → 读/增
//!   `next_sequence` → insert event → `COMMIT`；任一语句失败整体 ROLLBACK；
//! - 三条幂等路径命中返回 `AppendOutcome::Duplicate { existing_sequence }`，不报错；
//! - payload checksum 由 writer 内部计算落盘，调用方不提供（防伪造）。

use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::canonical::types::CanonicalFact;
use super::canonical::validator::validate_fact;
use super::checksum::payload_checksum;
use super::error::StoreError;
use super::ledger::{self, LedgerOutcome, ProviderUsageRecord, StoredLedgerRow};
use super::schema;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MutationLeaseAction {
    Acquire,
    Release,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MutationLeaseRequest {
    pub session_id: String,
    pub workspace_id: String,
    pub run_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub action: MutationLeaseAction,
    pub occurred_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MutationLeaseOutcome {
    Acquired {
        epoch: u64,
        duplicate: bool,
    },
    Released {
        epoch: u64,
        duplicate: bool,
    },
    Busy {
        holder_run_id: String,
        holder_node_id: String,
        holder_attempt_id: String,
        epoch: u64,
    },
}

/// Turn Usage 例外 fact type：该类型不参与 attempt+fact 唯一约束，只走 dedupe_key。
pub const USAGE_FACT_TYPE: &str = "conversation.usageRecorded";

/// 事件保真度。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Fidelity {
    #[serde(rename = "canonical")]
    Canonical,
    #[serde(rename = "presentation-only")]
    PresentationOnly,
}

impl Fidelity {
    fn as_str(self) -> &'static str {
        match self {
            Self::Canonical => "canonical",
            Self::PresentationOnly => "presentation-only",
        }
    }

    pub(crate) fn from_db_str(value: &str, column: usize) -> rusqlite::Result<Self> {
        match value {
            "canonical" => Ok(Self::Canonical),
            "presentation-only" => Ok(Self::PresentationOnly),
            unknown => Err(rusqlite::Error::FromSqlConversionFailure(
                column,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("unknown shared event fidelity: {unknown}"),
                )),
            )),
        }
    }
}

/// 待写入的 canonical event（A1 不做 payload 字段级校验，只要求合法 JSON envelope）。
///
/// 偏差说明：相对 design.md §4 草图增加 `schema_version` 字段——checksum 三元组需要
/// schemaVersion，显式传参比从 payload_json 反解更诚实。
#[derive(Debug, Clone)]
pub struct NewCanonicalEvent {
    pub session_id: String,
    pub event_id: String,
    pub fact_type: String,
    pub logical_turn_id: Option<String>,
    pub attempt_id: Option<String>,
    pub dedupe_key: Option<String>,
    pub payload_json: String,
    pub fidelity: Fidelity,
    pub committed_at: i64,
    pub schema_version: u32,
}

/// 事件写入结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppendOutcome {
    Inserted {
        sequence: i64,
        payload_checksum: String,
    },
    Duplicate {
        existing_sequence: i64,
    },
}

/// Binding/Cursor/Pending 持久化更新（`shared_binding_state`）。
#[derive(Debug, Clone)]
pub struct BindingStateUpdate {
    pub session_id: String,
    pub binding_key: String,
    pub engine: String,
    pub provider_profile_id: Option<String>,
    pub native_session_id: Option<String>,
    pub accepted_through_sequence: Option<i64>,
    pub committed_through_sequence: Option<i64>,
    pub provisioning_json: Option<String>,
    pub pending_delivery_json: Option<String>,
    pub availability: String,
    pub updated_at: i64,
}

/// Shared Session 行的完整 selected Target 更新。
#[derive(Debug, Clone)]
pub struct SessionTargetUpdate {
    pub session_id: String,
    pub schema_version: u32,
    pub selected_target_json: String,
    pub updated_at: i64,
}

/// `shared_sessions_v2` 的 selected Target 只读快照。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredSessionTarget {
    pub session_id: String,
    pub selected_target_json: String,
    pub updated_at: i64,
}

/// 已落盘的 binding 行（只读查询用）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredBindingState {
    pub session_id: String,
    pub binding_key: String,
    pub engine: String,
    pub provider_profile_id: Option<String>,
    pub native_session_id: Option<String>,
    pub accepted_through_sequence: Option<i64>,
    pub committed_through_sequence: Option<i64>,
    pub provisioning_json: Option<String>,
    pub pending_delivery_json: Option<String>,
    pub availability: String,
    pub updated_at: i64,
}

/// 已落盘的 canonical event（只读查询用）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredEvent {
    pub session_id: String,
    pub sequence: i64,
    pub event_id: String,
    pub fact_type: String,
    pub logical_turn_id: Option<String>,
    pub attempt_id: Option<String>,
    pub dedupe_key: Option<String>,
    pub payload_json: String,
    pub payload_checksum: String,
    pub fidelity: Fidelity,
    pub committed_at: i64,
}

/// 已落盘的 projection checkpoint 行（只读查询用）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectionCheckpointRow {
    pub session_id: String,
    pub projection_name: String,
    pub projection_version: i64,
    pub through_sequence: i64,
    pub payload_json: String,
}

/// Legacy V0 snapshot 的幂等导入标记。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LegacyImportRow {
    pub session_id: String,
    pub source_path: String,
    pub source_fingerprint: String,
    pub imported_through_marker: Option<String>,
    pub status: String,
    pub imported_at: Option<i64>,
}

/// append 事务内的观测边界。
///
/// 仅崩溃测试台（A1.5 victim 子进程）使用，用于在精确事务边界 SIGKILL。
#[doc(hidden)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TxBoundary {
    /// 事务开始后、sequence 更新前（insert 前）。
    BeforeSequenceBump,
    /// sequence 更新后、event insert 前。
    AfterSequenceBump,
    /// event insert 后、COMMIT 前。
    BeforeCommit,
    /// COMMIT 返回后。
    AfterCommit,
}

impl TxBoundary {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::BeforeSequenceBump => "before-sequence-bump",
            Self::AfterSequenceBump => "after-sequence-bump",
            Self::BeforeCommit => "before-commit",
            Self::AfterCommit => "after-commit",
        }
    }
}

/// 约束类错误映射为 typed variant，其余保留 sqlite 上下文。
fn map_write_error(context: &str, error: rusqlite::Error) -> StoreError {
    match &error {
        rusqlite::Error::SqliteFailure(code, _)
            if code.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            StoreError::constraint_violation(format!("{context}: {error}"))
        }
        _ => StoreError::sqlite(context, error),
    }
}

fn map_event_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredEvent> {
    let fidelity_raw: String = row.get(9)?;
    Ok(StoredEvent {
        session_id: row.get(0)?,
        sequence: row.get(1)?,
        event_id: row.get(2)?,
        fact_type: row.get(3)?,
        logical_turn_id: row.get(4)?,
        attempt_id: row.get(5)?,
        dedupe_key: row.get(6)?,
        payload_json: row.get(7)?,
        payload_checksum: row.get(8)?,
        fidelity: Fidelity::from_db_str(&fidelity_raw, 9)?,
        committed_at: row.get(10)?,
    })
}

fn map_binding_state_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredBindingState> {
    Ok(StoredBindingState {
        session_id: row.get(0)?,
        binding_key: row.get(1)?,
        engine: row.get(2)?,
        provider_profile_id: row.get(3)?,
        native_session_id: row.get(4)?,
        accepted_through_sequence: row.get(5)?,
        committed_through_sequence: row.get(6)?,
        provisioning_json: row.get(7)?,
        pending_delivery_json: row.get(8)?,
        availability: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

const EVENT_SELECT_COLUMNS: &str =
    "session_id, sequence, event_id, fact_type, logical_turn_id, attempt_id, dedupe_key,
     payload_json, payload_checksum, fidelity, committed_at";

/// 同步存储内核：直接持有 Connection，仅 actor 线程可见。
pub(crate) struct SharedEventStore {
    conn: Connection,
    boundary_hook: Option<Box<dyn FnMut(TxBoundary) + Send>>,
}

impl SharedEventStore {
    /// 打开（必要时创建）数据库并应用 PRAGMA 与 migration。
    pub(crate) fn open(path: &Path) -> Result<Self, StoreError> {
        schema::ensure_parent_dir(path)?;
        let mut conn = Connection::open(path).map_err(|source| {
            StoreError::sqlite(format!("open shared event db {}", path.display()), source)
        })?;
        schema::harden_db_file_permissions(path)?;
        schema::apply_runtime_pragmas(&conn)?;
        schema::migrate(&mut conn)?;
        let mut store = Self {
            conn,
            boundary_hook: None,
        };
        store.rebuild_mutation_lease_index()?;
        Ok(store)
    }

    /// `squad_workspace_mutation_lease` is an operational index. Rebuild it from canonical
    /// lease facts on every open so deleting/corrupting derived rows never invents authority.
    fn rebuild_mutation_lease_index(&mut self) -> Result<(), StoreError> {
        #[derive(Clone)]
        struct RebuiltLease {
            session_id: String,
            run_id: String,
            node_id: String,
            attempt_id: String,
            epoch: u64,
            state: &'static str,
            acquired_at: i64,
            updated_at: i64,
        }

        let mut statement = self
            .conn
            .prepare(
                "SELECT session_id, payload_json FROM shared_event_log
                 WHERE fact_type = 'squad.mutationLeaseChanged'
                 ORDER BY committed_at ASC, session_id ASC, sequence ASC",
            )
            .map_err(|source| StoreError::sqlite("prepare mutation lease rebuild", source))?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|source| StoreError::sqlite("query mutation lease rebuild", source))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|source| StoreError::sqlite("read mutation lease rebuild", source))?;
        drop(statement);

        let mut rebuilt = HashMap::<String, RebuiltLease>::new();
        for (session_id, payload_json) in rows {
            let fact = serde_json::from_str::<CanonicalFact>(&payload_json)
                .map_err(|source| StoreError::json("decode mutation lease rebuild fact", source))?;
            let CanonicalFact::SquadMutationLeaseChanged(fact) = fact else {
                continue;
            };
            if fact.change == "blocked" {
                continue;
            }
            let existing = rebuilt.get(&fact.workspace_id).cloned();
            if existing
                .as_ref()
                .is_some_and(|lease| lease.epoch > fact.lease_epoch)
            {
                continue;
            }
            let state = if fact.change == "acquired" {
                "held"
            } else if fact.change == "released" {
                "released"
            } else {
                return Err(StoreError::validation_failed(
                    "squad mutation lease rebuild",
                    format!("unsupported lease change '{}'", fact.change),
                ));
            };
            let acquired_at = existing
                .as_ref()
                .filter(|lease| lease.epoch == fact.lease_epoch)
                .map(|lease| lease.acquired_at)
                .unwrap_or(fact.changed_at);
            rebuilt.insert(
                fact.workspace_id,
                RebuiltLease {
                    session_id,
                    run_id: fact.run_id,
                    node_id: fact.node_id,
                    attempt_id: fact.attempt_id,
                    epoch: fact.lease_epoch,
                    state,
                    acquired_at,
                    updated_at: fact.changed_at,
                },
            );
        }

        let transaction = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|source| StoreError::sqlite("begin mutation lease rebuild", source))?;
        transaction
            .execute("DELETE FROM squad_workspace_mutation_lease", [])
            .map_err(|source| StoreError::sqlite("clear mutation lease index", source))?;
        for (workspace_id, lease) in rebuilt {
            transaction
                .execute(
                    "INSERT INTO squad_workspace_mutation_lease (
                        workspace_id, session_id, run_id, node_id, attempt_id, epoch,
                        state, acquired_at, updated_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    rusqlite::params![
                        workspace_id,
                        lease.session_id,
                        lease.run_id,
                        lease.node_id,
                        lease.attempt_id,
                        lease.epoch as i64,
                        lease.state,
                        lease.acquired_at,
                        lease.updated_at,
                    ],
                )
                .map_err(|source| StoreError::sqlite("insert rebuilt mutation lease", source))?;
        }
        transaction
            .commit()
            .map_err(|source| StoreError::sqlite("commit mutation lease rebuild", source))
    }

    /// 安装事务边界观测钩子（仅崩溃测试台使用）。
    #[doc(hidden)]
    pub(crate) fn set_transaction_boundary_hook(
        &mut self,
        hook: Option<Box<dyn FnMut(TxBoundary) + Send>>,
    ) {
        self.boundary_hook = hook;
    }

    /// 追加 canonical event：sequence 分配与 insert 同事务 all-or-nothing。
    pub(crate) fn append_event(
        &mut self,
        event: &NewCanonicalEvent,
    ) -> Result<AppendOutcome, StoreError> {
        self.append_event_inner(event, None, false)
    }

    /// 同事务追加 event + 更新 binding/cursor（cursor 与 commit 原子落盘）。
    pub(crate) fn append_event_with_binding(
        &mut self,
        event: &NewCanonicalEvent,
        binding: &BindingStateUpdate,
    ) -> Result<AppendOutcome, StoreError> {
        self.append_event_inner(event, Some(binding), false)
    }

    /// Shared linear-thread Tx1：同一 transaction 内验证 session 没有未决 Attempt，
    /// 再追加 turnRequested + Binding owner。防止两个并发 submit 都通过事务外预检。
    pub(crate) fn append_event_with_binding_if_no_unresolved(
        &mut self,
        event: &NewCanonicalEvent,
        binding: &BindingStateUpdate,
    ) -> Result<AppendOutcome, StoreError> {
        self.append_event_inner(event, Some(binding), true)
    }

    pub(crate) fn change_mutation_lease(
        &mut self,
        request: &MutationLeaseRequest,
    ) -> Result<MutationLeaseOutcome, StoreError> {
        validate_mutation_lease_request(request)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|source| StoreError::sqlite("begin mutation lease transaction", source))?;
        let existing = tx
            .query_row(
                "SELECT run_id, node_id, attempt_id, epoch, state
                 FROM squad_workspace_mutation_lease WHERE workspace_id = ?1",
                [&request.workspace_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                },
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read mutation lease", source))?;
        let same_holder = existing.as_ref().is_some_and(|(run, node, attempt, _, _)| {
            run == &request.run_id && node == &request.node_id && attempt == &request.attempt_id
        });

        let (change, epoch, outcome) = match request.action {
            MutationLeaseAction::Acquire => match existing.as_ref() {
                Some((_, _, _, epoch, state)) if same_holder && state == "held" => {
                    return Ok(MutationLeaseOutcome::Acquired {
                        epoch: *epoch as u64,
                        duplicate: true,
                    });
                }
                Some((holder_run, holder_node, holder_attempt, epoch, state))
                    if state == "held" =>
                {
                    let epoch = *epoch as u64;
                    let fact = mutation_lease_fact(request, epoch, "blocked");
                    append_canonical_fact_in_transaction(
                        &tx,
                        &request.session_id,
                        &fact,
                        request.occurred_at,
                    )?;
                    tx.commit().map_err(|source| {
                        StoreError::sqlite("commit blocked mutation lease audit", source)
                    })?;
                    return Ok(MutationLeaseOutcome::Busy {
                        holder_run_id: holder_run.clone(),
                        holder_node_id: holder_node.clone(),
                        holder_attempt_id: holder_attempt.clone(),
                        epoch,
                    });
                }
                Some((_, _, _, epoch, _)) => {
                    let epoch = (*epoch + 1) as u64;
                    (
                        "acquired",
                        epoch,
                        MutationLeaseOutcome::Acquired {
                            epoch,
                            duplicate: false,
                        },
                    )
                }
                None => (
                    "acquired",
                    1,
                    MutationLeaseOutcome::Acquired {
                        epoch: 1,
                        duplicate: false,
                    },
                ),
            },
            MutationLeaseAction::Release => match existing.as_ref() {
                None => {
                    return Ok(MutationLeaseOutcome::Released {
                        epoch: 0,
                        duplicate: true,
                    });
                }
                Some((holder_run, holder_node, holder_attempt, epoch, state))
                    if !same_holder && state == "held" =>
                {
                    return Ok(MutationLeaseOutcome::Busy {
                        holder_run_id: holder_run.clone(),
                        holder_node_id: holder_node.clone(),
                        holder_attempt_id: holder_attempt.clone(),
                        epoch: *epoch as u64,
                    });
                }
                Some((_, _, _, epoch, state)) if state == "released" => {
                    return Ok(MutationLeaseOutcome::Released {
                        epoch: *epoch as u64,
                        duplicate: true,
                    });
                }
                Some((_, _, _, epoch, _)) => {
                    let epoch = *epoch as u64;
                    (
                        "released",
                        epoch,
                        MutationLeaseOutcome::Released {
                            epoch,
                            duplicate: false,
                        },
                    )
                }
            },
        };

        tx.execute(
            "INSERT INTO squad_workspace_mutation_lease (
                workspace_id, session_id, run_id, node_id, attempt_id, epoch,
                state, acquired_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(workspace_id) DO UPDATE SET
                session_id = excluded.session_id,
                run_id = excluded.run_id,
                node_id = excluded.node_id,
                attempt_id = excluded.attempt_id,
                epoch = excluded.epoch,
                state = excluded.state,
                acquired_at = CASE
                    WHEN excluded.state = 'held' THEN excluded.acquired_at
                    ELSE squad_workspace_mutation_lease.acquired_at
                END,
                updated_at = excluded.updated_at",
            rusqlite::params![
                request.workspace_id,
                request.session_id,
                request.run_id,
                request.node_id,
                request.attempt_id,
                epoch as i64,
                if change == "acquired" {
                    "held"
                } else {
                    "released"
                },
                request.occurred_at,
            ],
        )
        .map_err(|source| map_write_error("change mutation lease", source))?;
        let fact = mutation_lease_fact(request, epoch, change);
        append_canonical_fact_in_transaction(&tx, &request.session_id, &fact, request.occurred_at)?;
        tx.commit()
            .map_err(|source| StoreError::sqlite("commit mutation lease transaction", source))?;
        Ok(outcome)
    }

    fn append_event_inner(
        &mut self,
        event: &NewCanonicalEvent,
        binding: Option<&BindingStateUpdate>,
        require_no_unresolved_attempt: bool,
    ) -> Result<AppendOutcome, StoreError> {
        let payload: Value = serde_json::from_str(&event.payload_json)
            .map_err(|source| StoreError::json("parse event payload_json", source))?;
        let checksum = payload_checksum(event.schema_version, &event.fact_type, &payload)?;

        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|source| StoreError::sqlite("begin append event transaction", source))?;

        // 三条幂等路径预检（单写者下与 insert 无竞态）。
        if let Some(existing_sequence) = find_existing_sequence(&tx, event, &checksum)? {
            return Ok(AppendOutcome::Duplicate { existing_sequence });
        }

        if require_no_unresolved_attempt {
            let unresolved_attempt: Option<String> = tx
                .query_row(
                    "SELECT requested.attempt_id
                     FROM shared_event_log requested
                     WHERE requested.session_id = ?1
                       AND requested.fact_type = 'conversation.turnRequested'
                       AND requested.attempt_id IS NOT NULL
                       AND json_extract(requested.payload_json, '$.squadWorkerBindingKey') IS NULL
                       AND NOT EXISTS (
                         SELECT 1 FROM shared_event_log committed
                         WHERE committed.session_id = requested.session_id
                           AND committed.attempt_id = requested.attempt_id
                           AND committed.fact_type = 'conversation.turnCommitted'
                       )
                     ORDER BY requested.sequence ASC
                     LIMIT 1",
                    [&event.session_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|source| StoreError::sqlite("check unresolved shared attempt", source))?;
            if let Some(unresolved_attempt) = unresolved_attempt {
                return Err(StoreError::validation_failed(
                    "conversation.turnRequested",
                    format!("session already has unresolved attempt {unresolved_attempt}"),
                ));
            }
        }

        if let Some(hook) = self.boundary_hook.as_mut() {
            hook(TxBoundary::BeforeSequenceBump);
        }

        ensure_session_row(&tx, event)?;
        let sequence = read_next_sequence(&tx, &event.session_id)?;
        tx.execute(
            "UPDATE shared_sessions_v2 SET next_sequence = next_sequence + 1, updated_at = ?2
             WHERE session_id = ?1",
            rusqlite::params![event.session_id, event.committed_at],
        )
        .map_err(|source| StoreError::sqlite("bump session next_sequence", source))?;

        if let Some(hook) = self.boundary_hook.as_mut() {
            hook(TxBoundary::AfterSequenceBump);
        }

        let insert_result = tx.execute(
            "INSERT INTO shared_event_log (
                session_id, sequence, event_id, fact_type, logical_turn_id, attempt_id,
                dedupe_key, payload_json, payload_checksum, fidelity, committed_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                event.session_id,
                sequence,
                event.event_id,
                event.fact_type,
                event.logical_turn_id,
                event.attempt_id,
                event.dedupe_key,
                event.payload_json,
                checksum,
                event.fidelity.as_str(),
                event.committed_at,
            ],
        );
        if let Err(error) = insert_result {
            // 兜底：constraint 失败时尝试解释为幂等重放（返回已有 sequence）。
            if matches!(
                &error,
                rusqlite::Error::SqliteFailure(code, _)
                    if code.code == rusqlite::ErrorCode::ConstraintViolation
            ) {
                if let Some(existing_sequence) = find_existing_sequence(&tx, event, &checksum)? {
                    return Ok(AppendOutcome::Duplicate { existing_sequence });
                }
            }
            return Err(map_write_error("insert canonical event", error));
        }

        if let Some(binding) = binding {
            upsert_binding_state_tx(&tx, binding)?;
        }

        if let Some(hook) = self.boundary_hook.as_mut() {
            hook(TxBoundary::BeforeCommit);
        }

        tx.commit()
            .map_err(|source| StoreError::sqlite("commit append event transaction", source))?;

        if let Some(hook) = self.boundary_hook.as_mut() {
            hook(TxBoundary::AfterCommit);
        }

        Ok(AppendOutcome::Inserted {
            sequence,
            payload_checksum: checksum,
        })
    }

    /// 追加已校验的 canonical fact：自动生成 event_id / attempt_id / dedupe_key，
    /// fidelity 固定为 canonical，schema_version 固定为 2。
    pub(crate) fn append_canonical_fact(
        &mut self,
        session_id: String,
        fact: &CanonicalFact,
        occurred_at: i64,
    ) -> Result<AppendOutcome, StoreError> {
        validate_fact(fact)?;
        let event = canonical_fact_to_event(session_id, fact, Fidelity::Canonical, occurred_at)?;
        self.append_event(&event)
    }

    /// 追加 presentation-only shadow fact（如 V0 evidence 映射），跳过严格校验。
    pub(crate) fn append_presentation_only_fact(
        &mut self,
        session_id: String,
        fact: &CanonicalFact,
        occurred_at: i64,
    ) -> Result<AppendOutcome, StoreError> {
        let event =
            canonical_fact_to_event(session_id, fact, Fidelity::PresentationOnly, occurred_at)?;
        self.append_event(&event)
    }

    /// upsert binding/cursor/pending 状态（单语句，天然原子）。
    pub(crate) fn upsert_binding_state(
        &mut self,
        update: &BindingStateUpdate,
    ) -> Result<(), StoreError> {
        upsert_binding_state_tx(&self.conn, update)
    }

    pub(crate) fn upsert_session_target(
        &mut self,
        update: &SessionTargetUpdate,
    ) -> Result<(), StoreError> {
        serde_json::from_str::<Value>(&update.selected_target_json)
            .map_err(|source| StoreError::json("parse selected_target_json", source))?;
        self.conn
            .execute(
                "INSERT INTO shared_sessions_v2 (
                    session_id, schema_version, next_sequence, selected_target_json,
                    created_at, updated_at
                 ) VALUES (?1, ?2, 1, ?3, ?4, ?4)
                 ON CONFLICT(session_id) DO UPDATE SET
                    schema_version = excluded.schema_version,
                    selected_target_json = excluded.selected_target_json,
                    updated_at = excluded.updated_at",
                rusqlite::params![
                    update.session_id,
                    update.schema_version,
                    update.selected_target_json,
                    update.updated_at,
                ],
            )
            .map_err(|source| map_write_error("upsert session target", source))?;
        Ok(())
    }

    pub(crate) fn session_target(
        &self,
        session_id: &str,
    ) -> Result<Option<StoredSessionTarget>, StoreError> {
        self.conn
            .query_row(
                "SELECT session_id, selected_target_json, updated_at
                 FROM shared_sessions_v2
                 WHERE session_id = ?1",
                [session_id],
                |row| {
                    Ok(StoredSessionTarget {
                        session_id: row.get(0)?,
                        selected_target_json: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read session target", source))
    }

    /// 写入 Provider Usage Ledger 记录（revision/supersede 链校验见 [`ledger`]）。
    pub(crate) fn record_provider_usage(
        &mut self,
        record: &ProviderUsageRecord,
    ) -> Result<LedgerOutcome, StoreError> {
        ledger::record_provider_usage(&mut self.conn, record)
    }

    /// 读取 session 已分配的下一 sequence；session 不存在返回 `None`。
    pub(crate) fn next_sequence(&self, session_id: &str) -> Result<Option<i64>, StoreError> {
        self.conn
            .query_row(
                "SELECT next_sequence FROM shared_sessions_v2 WHERE session_id = ?1",
                [session_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read session next_sequence", source))
    }

    /// 按 sequence 升序读取 session 全部事件。
    pub(crate) fn events_for_session(
        &self,
        session_id: &str,
    ) -> Result<Vec<StoredEvent>, StoreError> {
        let sql = format!(
            "SELECT {EVENT_SELECT_COLUMNS} FROM shared_event_log
             WHERE session_id = ?1 ORDER BY sequence ASC"
        );
        let mut stmt = self
            .conn
            .prepare(&sql)
            .map_err(|source| StoreError::sqlite("prepare events_for_session query", source))?;
        let rows = stmt
            .query_map([session_id], map_event_row)
            .map_err(|source| StoreError::sqlite("query events_for_session", source))?;
        let mut events = Vec::new();
        for row in rows {
            events.push(row.map_err(|source| StoreError::sqlite("map event row", source))?);
        }
        Ok(events)
    }

    /// 按 sequence 升序读取 checkpoint 之后的 session 事件。
    pub(crate) fn events_for_session_after(
        &self,
        session_id: &str,
        through_sequence: i64,
    ) -> Result<Vec<StoredEvent>, StoreError> {
        let sql = format!(
            "SELECT {EVENT_SELECT_COLUMNS} FROM shared_event_log
             WHERE session_id = ?1 AND sequence > ?2 ORDER BY sequence ASC"
        );
        let mut stmt = self.conn.prepare(&sql).map_err(|source| {
            StoreError::sqlite("prepare events_for_session_after query", source)
        })?;
        let rows = stmt
            .query_map(
                rusqlite::params![session_id, through_sequence],
                map_event_row,
            )
            .map_err(|source| StoreError::sqlite("query events_for_session_after", source))?;
        let mut events = Vec::new();
        for row in rows {
            events.push(row.map_err(|source| StoreError::sqlite("map event row", source))?);
        }
        Ok(events)
    }

    /// 返回 durable TurnRequested 标记过的 Squad Worker attempt ids。
    /// 增量 Projection 用它跨 checkpoint 隐藏 Worker terminal/usage，避免只看 delta 泄漏。
    pub(crate) fn squad_attempt_ids_for_session(
        &self,
        session_id: &str,
    ) -> Result<Vec<String>, StoreError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT DISTINCT attempt_id FROM shared_event_log
                 WHERE session_id = ?1
                   AND fact_type = 'conversation.turnRequested'
                   AND attempt_id IS NOT NULL
                   AND NULLIF(TRIM(json_extract(payload_json, '$.squadWorkerBindingKey')), '') IS NOT NULL",
            )
            .map_err(|source| StoreError::sqlite("prepare squad attempt ids query", source))?;
        let rows = stmt
            .query_map([session_id], |row| row.get(0))
            .map_err(|source| StoreError::sqlite("query squad attempt ids", source))?;
        let mut attempts = Vec::new();
        for row in rows {
            attempts
                .push(row.map_err(|source| StoreError::sqlite("map squad attempt id", source))?);
        }
        Ok(attempts)
    }

    /// 统计事件数；`session_id` 为 `None` 时统计全表。
    pub(crate) fn count_events(&self, session_id: Option<&str>) -> Result<i64, StoreError> {
        let count = match session_id {
            Some(session_id) => self.conn.query_row(
                "SELECT count(*) FROM shared_event_log WHERE session_id = ?1",
                [session_id],
                |row| row.get(0),
            ),
            None => self
                .conn
                .query_row("SELECT count(*) FROM shared_event_log", [], |row| {
                    row.get(0)
                }),
        };
        count.map_err(|source| StoreError::sqlite("count events", source))
    }

    /// 读取单条 binding 状态。
    pub(crate) fn binding_state(
        &self,
        session_id: &str,
        binding_key: &str,
    ) -> Result<Option<StoredBindingState>, StoreError> {
        self.conn
            .query_row(
                "SELECT session_id, binding_key, engine, provider_profile_id, native_session_id,
                        accepted_through_sequence, committed_through_sequence,
                        provisioning_json, pending_delivery_json, availability, updated_at
                 FROM shared_binding_state
                 WHERE session_id = ?1 AND binding_key = ?2",
                rusqlite::params![session_id, binding_key],
                map_binding_state_row,
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read binding state", source))
    }

    /// 读取某 Shared Session 的全部 Hidden Native Binding。
    pub(crate) fn binding_states_for_session(
        &self,
        session_id: &str,
    ) -> Result<Vec<StoredBindingState>, StoreError> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT session_id, binding_key, engine, provider_profile_id, native_session_id,
                        accepted_through_sequence, committed_through_sequence,
                        provisioning_json, pending_delivery_json, availability, updated_at
                 FROM shared_binding_state
                 WHERE session_id = ?1
                 ORDER BY binding_key ASC",
            )
            .map_err(|source| StoreError::sqlite("prepare binding states query", source))?;
        let rows = statement
            .query_map([session_id], map_binding_state_row)
            .map_err(|source| StoreError::sqlite("query binding states", source))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|source| StoreError::sqlite("read binding states", source))
    }

    /// 读取某 `(provider, window, subject)` 下的 Ledger 行（按 revision 升序）。
    pub(crate) fn ledger_rows(
        &self,
        provider_profile_id: &str,
        window_started_at: i64,
        window_ended_at: i64,
        report_subject_id: &str,
    ) -> Result<Vec<StoredLedgerRow>, StoreError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT provider_profile_id, report_subject_id, revision, event_id,
                        window_started_at, window_ended_at, payload_json, payload_checksum,
                        observed_at
                 FROM provider_usage_aggregate_log
                 WHERE provider_profile_id = ?1 AND window_started_at = ?2
                   AND window_ended_at = ?3 AND report_subject_id = ?4
                 ORDER BY revision ASC",
            )
            .map_err(|source| StoreError::sqlite("prepare ledger rows query", source))?;
        let rows = stmt
            .query_map(
                rusqlite::params![
                    provider_profile_id,
                    window_started_at,
                    window_ended_at,
                    report_subject_id
                ],
                |row| {
                    Ok(StoredLedgerRow {
                        provider_profile_id: row.get(0)?,
                        report_subject_id: row.get(1)?,
                        revision: row.get(2)?,
                        event_id: row.get(3)?,
                        window_started_at: row.get(4)?,
                        window_ended_at: row.get(5)?,
                        payload_json: row.get(6)?,
                        payload_checksum: row.get(7)?,
                        observed_at: row.get(8)?,
                    })
                },
            )
            .map_err(|source| StoreError::sqlite("query ledger rows", source))?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|source| StoreError::sqlite("map ledger row", source))?);
        }
        Ok(result)
    }

    /// 读取指定 projection 的 checkpoint。
    pub(crate) fn get_projection_checkpoint(
        &self,
        session_id: &str,
        projection_name: &str,
    ) -> Result<Option<ProjectionCheckpointRow>, StoreError> {
        self.conn
            .query_row(
                "SELECT session_id, projection_name, projection_version, through_sequence, payload_json
                 FROM shared_projection_checkpoint
                 WHERE session_id = ?1 AND projection_name = ?2",
                rusqlite::params![session_id, projection_name],
                |row| {
                    Ok(ProjectionCheckpointRow {
                        session_id: row.get(0)?,
                        projection_name: row.get(1)?,
                        projection_version: row.get(2)?,
                        through_sequence: row.get(3)?,
                        payload_json: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read projection checkpoint", source))
    }

    /// 写入/更新 projection checkpoint。
    pub(crate) fn upsert_projection_checkpoint(
        &mut self,
        checkpoint: &ProjectionCheckpointRow,
    ) -> Result<(), StoreError> {
        self.conn
            .execute(
                "INSERT INTO shared_projection_checkpoint (
                    session_id, projection_name, projection_version, through_sequence, payload_json
                 ) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(session_id, projection_name) DO UPDATE SET
                    projection_version = excluded.projection_version,
                    through_sequence = excluded.through_sequence,
                    payload_json = excluded.payload_json",
                rusqlite::params![
                    checkpoint.session_id,
                    checkpoint.projection_name,
                    checkpoint.projection_version,
                    checkpoint.through_sequence,
                    checkpoint.payload_json,
                ],
            )
            .map_err(|source| map_write_error("upsert projection checkpoint", source))?;
        Ok(())
    }

    pub(crate) fn legacy_import(
        &self,
        session_id: &str,
    ) -> Result<Option<LegacyImportRow>, StoreError> {
        self.conn
            .query_row(
                "SELECT session_id, source_path, source_fingerprint, imported_through_marker,
                        status, imported_at
                 FROM shared_legacy_import
                 WHERE session_id = ?1",
                [session_id],
                |row| {
                    Ok(LegacyImportRow {
                        session_id: row.get(0)?,
                        source_path: row.get(1)?,
                        source_fingerprint: row.get(2)?,
                        imported_through_marker: row.get(3)?,
                        status: row.get(4)?,
                        imported_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(|source| StoreError::sqlite("read legacy import marker", source))
    }

    pub(crate) fn upsert_legacy_import(
        &mut self,
        marker: &LegacyImportRow,
    ) -> Result<(), StoreError> {
        self.conn
            .execute(
                "INSERT INTO shared_legacy_import (
                    session_id, source_path, source_fingerprint, imported_through_marker,
                    status, imported_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(session_id) DO UPDATE SET
                    source_path = excluded.source_path,
                    source_fingerprint = excluded.source_fingerprint,
                    imported_through_marker = excluded.imported_through_marker,
                    status = excluded.status,
                    imported_at = excluded.imported_at",
                rusqlite::params![
                    marker.session_id,
                    marker.source_path,
                    marker.source_fingerprint,
                    marker.imported_through_marker,
                    marker.status,
                    marker.imported_at,
                ],
            )
            .map_err(|source| map_write_error("upsert legacy import marker", source))?;
        Ok(())
    }

    /// 当前 schema user_version（诊断/测试用）。
    pub(crate) fn user_version(&self) -> Result<u32, StoreError> {
        schema::current_user_version(&self.conn)
    }

    /// 单错误输出 integrity check（诊断/测试用，不承诺 wall-clock timeout）。
    pub(crate) fn quick_check(&self) -> Result<String, StoreError> {
        self.conn
            .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))
            .map_err(|source| StoreError::sqlite("run pragma quick_check", source))
    }
}

/// 把 canonical fact 转换为 `NewCanonicalEvent`：生成 event_id、提取 attempt_id / dedupe_key / committed_at。
fn canonical_fact_to_event(
    session_id: String,
    fact: &CanonicalFact,
    fidelity: Fidelity,
    occurred_at: i64,
) -> Result<NewCanonicalEvent, StoreError> {
    if occurred_at < 0 {
        return Err(StoreError::validation_failed(
            fact.fact_type(),
            "occurredAt must be non-negative",
        ));
    }
    let fact_type = fact.fact_type().to_string();
    let payload = serde_json::to_value(fact)
        .map_err(|source| StoreError::json("serialize canonical fact", source))?;
    let payload_json = serde_json::to_string(&payload)
        .map_err(|source| StoreError::json("stringify canonical fact payload", source))?;

    let event_id = canonical_event_id(fact, occurred_at);
    let attempt_id = fact.attempt_id().map(str::to_string);
    let dedupe_key = fact.dedupe_key().map(str::to_string);
    let logical_turn_id = fact.logical_turn_id().map(str::to_string);
    Ok(NewCanonicalEvent {
        session_id,
        event_id,
        fact_type,
        logical_turn_id,
        attempt_id,
        dedupe_key,
        payload_json,
        fidelity,
        committed_at: occurred_at,
        schema_version: 2,
    })
}

fn canonical_event_id(fact: &CanonicalFact, occurred_at: i64) -> String {
    use super::canonical::types::CanonicalFact::*;
    match fact {
        TurnRequested(f) => format!("{}:turnRequested", f.attempt_id),
        DeliveryPrepared(f) => format!("{}:deliveryPrepared:{}", f.attempt_id, f.package_id),
        DeliveryAccepted(f) => format!("{}:deliveryAccepted:{}", f.attempt_id, f.package_id),
        TurnAccepted(f) => format!("{}:turnAccepted", f.attempt_id),
        TurnCommitted(f) => format!("{}:turnCommitted", f.attempt_id),
        UsageRecorded(f) => f.usage_record_id.clone(),
        Control(f) => format!(
            "{}:{}:{}",
            f.attempt_id.as_deref().unwrap_or("session"),
            f.control_kind,
            occurred_at
        ),
        SquadRunRequested(f) => f.fact_id.clone(),
        SquadPlanProposed(f) => f.fact_id.clone(),
        SquadPlanApproved(f) => f.fact_id.clone(),
        SquadPlanRevised(f) => f.fact_id.clone(),
        SquadNodeDispatchPrepared(f) => f.fact_id.clone(),
        SquadNodeAttemptLinked(f) => f.fact_id.clone(),
        SquadNodeOutcomeRecorded(f) => f.fact_id.clone(),
        SquadVerificationRecorded(f) => f.fact_id.clone(),
        SquadMutationLeaseChanged(f) => f.fact_id.clone(),
        SquadBranchBlocked(f) => f.fact_id.clone(),
        SquadCancelRequested(f) => f.fact_id.clone(),
        SquadRunSettled(f) => f.fact_id.clone(),
    }
}

fn canonical_fact_occurred_at(fact: &CanonicalFact) -> Result<i64, StoreError> {
    use super::canonical::types::CanonicalFact::*;
    match fact {
        TurnRequested(f) => Ok(f.requested_at),
        DeliveryPrepared(_) | Control(_) => Err(StoreError::validation_failed(
            fact.fact_type(),
            "fact has no embedded timestamp; use append_canonical_fact_at",
        )),
        DeliveryAccepted(f) => Ok(f.accepted_at),
        TurnAccepted(f) => Ok(f.accepted_at),
        TurnCommitted(f) => Ok(f.committed_at),
        UsageRecorded(f) => Ok(f.observed_at),
        SquadRunRequested(f) => Ok(f.requested_at),
        SquadPlanProposed(f) => Ok(f.proposed_at),
        SquadPlanApproved(f) => Ok(f.approved_at),
        SquadPlanRevised(f) => Ok(f.revised_at),
        SquadNodeDispatchPrepared(f) => Ok(f.prepared_at),
        SquadNodeAttemptLinked(f) => Ok(f.linked_at),
        SquadNodeOutcomeRecorded(f) => Ok(f.recorded_at),
        SquadVerificationRecorded(f) => Ok(f.recorded_at),
        SquadMutationLeaseChanged(f) => Ok(f.changed_at),
        SquadBranchBlocked(f) => Ok(f.blocked_at),
        SquadCancelRequested(f) => Ok(f.requested_at),
        SquadRunSettled(f) => Ok(f.settled_at),
    }
}

/// 三条幂等路径预检，命中返回已有 sequence。
fn find_existing_sequence(
    conn: &Connection,
    event: &NewCanonicalEvent,
    expected_checksum: &str,
) -> Result<Option<i64>, StoreError> {
    fn verify_duplicate(
        key: String,
        row: Option<(i64, String)>,
        expected_checksum: &str,
    ) -> Result<Option<i64>, StoreError> {
        match row {
            Some((sequence, checksum)) if checksum == expected_checksum => Ok(Some(sequence)),
            Some(_) => Err(StoreError::idempotency_conflict(
                key,
                "existing row has a different payload checksum",
            )),
            None => Ok(None),
        }
    }

    // 路径 1：PRIMARY KEY (session_id, event_id)。
    let by_event_id: Option<(i64, String)> = conn
        .query_row(
            "SELECT sequence, payload_checksum FROM shared_event_log
             WHERE session_id = ?1 AND event_id = ?2",
            rusqlite::params![event.session_id, event.event_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|source| StoreError::sqlite("idempotency check by event_id", source))?;
    if let Some(sequence) = verify_duplicate(
        format!("event_id={}", event.event_id),
        by_event_id,
        expected_checksum,
    )? {
        return Ok(Some(sequence));
    }

    // 路径 2：(session_id, attempt_id, fact_type)，usage 例外不参与。
    if event.fact_type != USAGE_FACT_TYPE {
        if let Some(attempt_id) = &event.attempt_id {
            let by_attempt: Option<(i64, String)> = conn
                .query_row(
                    "SELECT sequence, payload_checksum FROM shared_event_log
                     WHERE session_id = ?1 AND attempt_id = ?2 AND fact_type = ?3",
                    rusqlite::params![event.session_id, attempt_id, event.fact_type],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()
                .map_err(|source| {
                    StoreError::sqlite("idempotency check by attempt_id + fact_type", source)
                })?;
            if let Some(sequence) = verify_duplicate(
                format!("attempt_id={attempt_id}, fact_type={}", event.fact_type),
                by_attempt,
                expected_checksum,
            )? {
                return Ok(Some(sequence));
            }
        }
    }

    // 路径 3：(session_id, fact_type, dedupe_key)（usage 例外走 usageRecordId）。
    if let Some(dedupe_key) = &event.dedupe_key {
        let by_dedupe: Option<(i64, String)> = conn
            .query_row(
                "SELECT sequence, payload_checksum FROM shared_event_log
                 WHERE session_id = ?1 AND fact_type = ?2 AND dedupe_key = ?3",
                rusqlite::params![event.session_id, event.fact_type, dedupe_key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|source| StoreError::sqlite("idempotency check by dedupe_key", source))?;
        if let Some(sequence) = verify_duplicate(
            format!("fact_type={}, dedupe_key={dedupe_key}", event.fact_type),
            by_dedupe,
            expected_checksum,
        )? {
            return Ok(Some(sequence));
        }
    }

    Ok(None)
}

/// 懒创建 session 行（A1 无独立 session 创建 API；selected_target 待 Wave 2 回填）。
fn ensure_session_row(conn: &Connection, event: &NewCanonicalEvent) -> Result<(), StoreError> {
    conn.execute(
        "INSERT INTO shared_sessions_v2 (
            session_id, schema_version, next_sequence, selected_target_json, created_at, updated_at
         ) VALUES (?1, ?2, 1, 'null', ?3, ?3)
         ON CONFLICT(session_id) DO NOTHING",
        rusqlite::params![event.session_id, event.schema_version, event.committed_at],
    )
    .map_err(|source| StoreError::sqlite("ensure session row", source))?;
    Ok(())
}

fn read_next_sequence(conn: &Connection, session_id: &str) -> Result<i64, StoreError> {
    conn.query_row(
        "SELECT next_sequence FROM shared_sessions_v2 WHERE session_id = ?1",
        [session_id],
        |row| row.get(0),
    )
    .map_err(|source| StoreError::sqlite("read session next_sequence", source))
}

fn upsert_binding_state_tx(
    conn: &Connection,
    update: &BindingStateUpdate,
) -> Result<(), StoreError> {
    conn.execute(
        "INSERT INTO shared_binding_state (
            session_id, binding_key, engine, provider_profile_id, native_session_id,
            accepted_through_sequence, committed_through_sequence,
            provisioning_json, pending_delivery_json, availability, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(session_id, binding_key) DO UPDATE SET
            engine = excluded.engine,
            provider_profile_id = excluded.provider_profile_id,
            native_session_id = excluded.native_session_id,
            accepted_through_sequence = excluded.accepted_through_sequence,
            committed_through_sequence = excluded.committed_through_sequence,
            provisioning_json = excluded.provisioning_json,
            pending_delivery_json = excluded.pending_delivery_json,
            availability = excluded.availability,
            updated_at = excluded.updated_at",
        rusqlite::params![
            update.session_id,
            update.binding_key,
            update.engine,
            update.provider_profile_id,
            update.native_session_id,
            update.accepted_through_sequence,
            update.committed_through_sequence,
            update.provisioning_json,
            update.pending_delivery_json,
            update.availability,
            update.updated_at,
        ],
    )
    .map_err(|source| map_write_error("upsert binding state", source))?;
    Ok(())
}

fn validate_mutation_lease_request(request: &MutationLeaseRequest) -> Result<(), StoreError> {
    for (name, value) in [
        ("sessionId", request.session_id.as_str()),
        ("workspaceId", request.workspace_id.as_str()),
        ("runId", request.run_id.as_str()),
        ("nodeId", request.node_id.as_str()),
        ("attemptId", request.attempt_id.as_str()),
    ] {
        if value.trim().is_empty() {
            return Err(StoreError::validation_failed(
                "squad mutation lease",
                format!("{name} must be non-empty"),
            ));
        }
    }
    if request.occurred_at < 0 {
        return Err(StoreError::validation_failed(
            "squad mutation lease",
            "occurredAt must be non-negative",
        ));
    }
    if !Path::new(&request.workspace_id).is_absolute() {
        return Err(StoreError::validation_failed(
            "squad mutation lease",
            "workspaceId must be a canonical absolute workspace root",
        ));
    }
    Ok(())
}

fn mutation_lease_fact(request: &MutationLeaseRequest, epoch: u64, change: &str) -> CanonicalFact {
    use super::canonical::types::SquadMutationLeaseChangedFact;

    CanonicalFact::SquadMutationLeaseChanged(SquadMutationLeaseChangedFact {
        fact_id: format!(
            "squad:{}:lease:{}:{}:{}:{}",
            request.run_id, change, request.node_id, request.attempt_id, epoch
        ),
        run_id: request.run_id.clone(),
        workspace_id: request.workspace_id.clone(),
        node_id: request.node_id.clone(),
        attempt_id: request.attempt_id.clone(),
        lease_epoch: epoch,
        change: change.to_string(),
        changed_at: request.occurred_at,
        extra: Value::Object(Default::default()),
    })
}

fn append_canonical_fact_in_transaction(
    tx: &rusqlite::Transaction<'_>,
    session_id: &str,
    fact: &CanonicalFact,
    occurred_at: i64,
) -> Result<AppendOutcome, StoreError> {
    validate_fact(fact)
        .map_err(|error| StoreError::validation_failed(fact.fact_type(), error.to_string()))?;
    let event = canonical_fact_to_event(
        session_id.to_string(),
        fact,
        Fidelity::Canonical,
        occurred_at,
    )?;
    append_prepared_event_in_transaction(tx, &event)
}

fn append_prepared_event_in_transaction(
    tx: &rusqlite::Transaction<'_>,
    event: &NewCanonicalEvent,
) -> Result<AppendOutcome, StoreError> {
    let payload: Value = serde_json::from_str(&event.payload_json)
        .map_err(|source| StoreError::json("parse event payload_json", source))?;
    let checksum = payload_checksum(event.schema_version, &event.fact_type, &payload)?;
    if let Some(existing_sequence) = find_existing_sequence(tx, event, &checksum)? {
        return Ok(AppendOutcome::Duplicate { existing_sequence });
    }
    ensure_session_row(tx, event)?;
    let sequence = read_next_sequence(tx, &event.session_id)?;
    tx.execute(
        "UPDATE shared_sessions_v2 SET next_sequence = next_sequence + 1, updated_at = ?2
         WHERE session_id = ?1",
        rusqlite::params![event.session_id, event.committed_at],
    )
    .map_err(|source| StoreError::sqlite("bump session next_sequence", source))?;
    tx.execute(
        "INSERT INTO shared_event_log (
            session_id, sequence, event_id, fact_type, logical_turn_id, attempt_id,
            dedupe_key, payload_json, payload_checksum, fidelity, committed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            event.session_id,
            sequence,
            event.event_id,
            event.fact_type,
            event.logical_turn_id,
            event.attempt_id,
            event.dedupe_key,
            event.payload_json,
            checksum,
            event.fidelity.as_str(),
            event.committed_at,
        ],
    )
    .map_err(|source| map_write_error("insert mutation lease fact", source))?;
    Ok(AppendOutcome::Inserted {
        sequence,
        payload_checksum: checksum,
    })
}

enum WriterCommand {
    AppendEvent {
        event: NewCanonicalEvent,
        respond: mpsc::Sender<Result<AppendOutcome, StoreError>>,
    },
    AppendEventWithBinding {
        event: NewCanonicalEvent,
        binding: BindingStateUpdate,
        respond: mpsc::Sender<Result<AppendOutcome, StoreError>>,
    },
    AppendCanonicalFact {
        session_id: String,
        fact: CanonicalFact,
        fidelity: Fidelity,
        occurred_at: i64,
        respond: mpsc::Sender<Result<AppendOutcome, StoreError>>,
    },
    AppendCanonicalFactWithBinding {
        session_id: String,
        fact: CanonicalFact,
        occurred_at: i64,
        binding: BindingStateUpdate,
        respond: mpsc::Sender<Result<AppendOutcome, StoreError>>,
    },
    AppendCanonicalFactWithBindingIfNoUnresolved {
        session_id: String,
        fact: CanonicalFact,
        occurred_at: i64,
        binding: BindingStateUpdate,
        respond: mpsc::Sender<Result<AppendOutcome, StoreError>>,
    },
    UpsertBinding {
        update: BindingStateUpdate,
        respond: mpsc::Sender<Result<(), StoreError>>,
    },
    UpsertSessionTarget {
        update: SessionTargetUpdate,
        respond: mpsc::Sender<Result<(), StoreError>>,
    },
    ChangeMutationLease {
        request: MutationLeaseRequest,
        respond: mpsc::Sender<Result<MutationLeaseOutcome, StoreError>>,
    },
    SessionTarget {
        session_id: String,
        respond: mpsc::Sender<Result<Option<StoredSessionTarget>, StoreError>>,
    },
    RecordUsage {
        record: ProviderUsageRecord,
        respond: mpsc::Sender<Result<LedgerOutcome, StoreError>>,
    },
    EventsForSession {
        session_id: String,
        respond: mpsc::Sender<Result<Vec<StoredEvent>, StoreError>>,
    },
    EventsForSessionAfter {
        session_id: String,
        through_sequence: i64,
        respond: mpsc::Sender<Result<Vec<StoredEvent>, StoreError>>,
    },
    SquadAttemptIdsForSession {
        session_id: String,
        respond: mpsc::Sender<Result<Vec<String>, StoreError>>,
    },
    CountEvents {
        session_id: Option<String>,
        respond: mpsc::Sender<Result<i64, StoreError>>,
    },
    NextSequence {
        session_id: String,
        respond: mpsc::Sender<Result<Option<i64>, StoreError>>,
    },
    BindingState {
        session_id: String,
        binding_key: String,
        respond: mpsc::Sender<Result<Option<StoredBindingState>, StoreError>>,
    },
    BindingStatesForSession {
        session_id: String,
        respond: mpsc::Sender<Result<Vec<StoredBindingState>, StoreError>>,
    },
    LedgerRows {
        provider_profile_id: String,
        window_started_at: i64,
        window_ended_at: i64,
        report_subject_id: String,
        respond: mpsc::Sender<Result<Vec<StoredLedgerRow>, StoreError>>,
    },
    ProjectionCheckpoint {
        session_id: String,
        projection_name: String,
        respond: mpsc::Sender<Result<Option<ProjectionCheckpointRow>, StoreError>>,
    },
    UpsertProjectionCheckpoint {
        checkpoint: ProjectionCheckpointRow,
        respond: mpsc::Sender<Result<(), StoreError>>,
    },
    LegacyImport {
        session_id: String,
        respond: mpsc::Sender<Result<Option<LegacyImportRow>, StoreError>>,
    },
    UpsertLegacyImport {
        marker: LegacyImportRow,
        respond: mpsc::Sender<Result<(), StoreError>>,
    },
    UserVersion {
        respond: mpsc::Sender<Result<u32, StoreError>>,
    },
    QuickCheck {
        respond: mpsc::Sender<Result<String, StoreError>>,
    },
    Shutdown,
}

/// 单写者 Actor 的 Clone-able handle；Connection 只存在于 actor 线程。
#[derive(Clone)]
pub struct SharedEventWriter {
    sender: mpsc::Sender<WriterCommand>,
    join_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl SharedEventWriter {
    pub(crate) fn spawn(mut store: SharedEventStore) -> Result<Self, StoreError> {
        let (sender, receiver) = mpsc::channel::<WriterCommand>();
        let join_handle = std::thread::Builder::new()
            .name("shared-event-writer".to_string())
            .spawn(move || {
                while let Ok(command) = receiver.recv() {
                    match command {
                        WriterCommand::AppendEvent { event, respond } => {
                            let _ = respond.send(store.append_event(&event));
                        }
                        WriterCommand::AppendEventWithBinding {
                            event,
                            binding,
                            respond,
                        } => {
                            let _ = respond.send(store.append_event_with_binding(&event, &binding));
                        }
                        WriterCommand::AppendCanonicalFact {
                            session_id,
                            fact,
                            fidelity,
                            occurred_at,
                            respond,
                        } => {
                            let result = match fidelity {
                                Fidelity::Canonical => {
                                    store.append_canonical_fact(session_id, &fact, occurred_at)
                                }
                                Fidelity::PresentationOnly => store.append_presentation_only_fact(
                                    session_id,
                                    &fact,
                                    occurred_at,
                                ),
                            };
                            let _ = respond.send(result);
                        }
                        WriterCommand::AppendCanonicalFactWithBinding {
                            session_id,
                            fact,
                            occurred_at,
                            binding,
                            respond,
                        } => {
                            let result = validate_fact(&fact)
                                .map_err(|error| {
                                    StoreError::validation_failed(
                                        fact.fact_type(),
                                        error.to_string(),
                                    )
                                })
                                .and_then(|_| {
                                    canonical_fact_to_event(
                                        session_id,
                                        &fact,
                                        Fidelity::Canonical,
                                        occurred_at,
                                    )
                                })
                                .and_then(|event| {
                                    store.append_event_with_binding(&event, &binding)
                                });
                            let _ = respond.send(result);
                        }
                        WriterCommand::AppendCanonicalFactWithBindingIfNoUnresolved {
                            session_id,
                            fact,
                            occurred_at,
                            binding,
                            respond,
                        } => {
                            let result = validate_fact(&fact)
                                .map_err(|error| {
                                    StoreError::validation_failed(
                                        fact.fact_type(),
                                        error.to_string(),
                                    )
                                })
                                .and_then(|_| {
                                    if !matches!(&fact, CanonicalFact::TurnRequested(_)) {
                                        return Err(StoreError::validation_failed(
                                            fact.fact_type(),
                                            "unresolved-attempt guard is only valid for turnRequested",
                                        ));
                                    }
                                    canonical_fact_to_event(
                                        session_id,
                                        &fact,
                                        Fidelity::Canonical,
                                        occurred_at,
                                    )
                                })
                                .and_then(|event| {
                                    store.append_event_with_binding_if_no_unresolved(
                                        &event,
                                        &binding,
                                    )
                                });
                            let _ = respond.send(result);
                        }
                        WriterCommand::UpsertBinding { update, respond } => {
                            let _ = respond.send(store.upsert_binding_state(&update));
                        }
                        WriterCommand::UpsertSessionTarget { update, respond } => {
                            let _ = respond.send(store.upsert_session_target(&update));
                        }
                        WriterCommand::ChangeMutationLease { request, respond } => {
                            let _ = respond.send(store.change_mutation_lease(&request));
                        }
                        WriterCommand::SessionTarget {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.session_target(&session_id));
                        }
                        WriterCommand::RecordUsage { record, respond } => {
                            let _ = respond.send(store.record_provider_usage(&record));
                        }
                        WriterCommand::EventsForSession {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.events_for_session(&session_id));
                        }
                        WriterCommand::EventsForSessionAfter {
                            session_id,
                            through_sequence,
                            respond,
                        } => {
                            let _ = respond.send(
                                store.events_for_session_after(&session_id, through_sequence),
                            );
                        }
                        WriterCommand::SquadAttemptIdsForSession {
                            session_id,
                            respond,
                        } => {
                            let _ =
                                respond.send(store.squad_attempt_ids_for_session(&session_id));
                        }
                        WriterCommand::CountEvents {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.count_events(session_id.as_deref()));
                        }
                        WriterCommand::NextSequence {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.next_sequence(&session_id));
                        }
                        WriterCommand::BindingState {
                            session_id,
                            binding_key,
                            respond,
                        } => {
                            let _ = respond.send(store.binding_state(&session_id, &binding_key));
                        }
                        WriterCommand::BindingStatesForSession {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.binding_states_for_session(&session_id));
                        }
                        WriterCommand::LedgerRows {
                            provider_profile_id,
                            window_started_at,
                            window_ended_at,
                            report_subject_id,
                            respond,
                        } => {
                            let _ = respond.send(store.ledger_rows(
                                &provider_profile_id,
                                window_started_at,
                                window_ended_at,
                                &report_subject_id,
                            ));
                        }
                        WriterCommand::ProjectionCheckpoint {
                            session_id,
                            projection_name,
                            respond,
                        } => {
                            let _ = respond.send(
                                store.get_projection_checkpoint(&session_id, &projection_name),
                            );
                        }
                        WriterCommand::UpsertProjectionCheckpoint {
                            checkpoint,
                            respond,
                        } => {
                            let _ = respond.send(store.upsert_projection_checkpoint(&checkpoint));
                        }
                        WriterCommand::LegacyImport {
                            session_id,
                            respond,
                        } => {
                            let _ = respond.send(store.legacy_import(&session_id));
                        }
                        WriterCommand::UpsertLegacyImport { marker, respond } => {
                            let _ = respond.send(store.upsert_legacy_import(&marker));
                        }
                        WriterCommand::UserVersion { respond } => {
                            let _ = respond.send(store.user_version());
                        }
                        WriterCommand::QuickCheck { respond } => {
                            let _ = respond.send(store.quick_check());
                        }
                        WriterCommand::Shutdown => break,
                    }
                }
            })
            .map_err(|source| StoreError::io("spawn shared event writer thread", source))?;
        Ok(Self {
            sender,
            join_handle: Arc::new(Mutex::new(Some(join_handle))),
        })
    }

    fn send_command<T>(
        &self,
        build: impl FnOnce(mpsc::Sender<Result<T, StoreError>>) -> WriterCommand,
    ) -> Result<T, StoreError> {
        let (respond, response) = mpsc::channel();
        self.sender
            .send(build(respond))
            .map_err(|_| StoreError::actor_terminated("writer channel closed"))?;
        response
            .recv()
            .map_err(|_| StoreError::actor_terminated("writer actor dropped response"))?
    }

    pub fn append_event(&self, event: &NewCanonicalEvent) -> Result<AppendOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::AppendEvent {
            event: event.clone(),
            respond,
        })
    }

    pub fn append_event_with_binding(
        &self,
        event: &NewCanonicalEvent,
        binding: &BindingStateUpdate,
    ) -> Result<AppendOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::AppendEventWithBinding {
            event: event.clone(),
            binding: binding.clone(),
            respond,
        })
    }

    /// 追加已校验的 canonical fact（fidelity = canonical）。
    pub fn append_canonical_fact(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
    ) -> Result<AppendOutcome, StoreError> {
        let occurred_at = canonical_fact_occurred_at(&fact)?;
        self.append_canonical_fact_at(session_id, fact, occurred_at)
    }

    /// 追加没有内嵌 timestamp 的 canonical fact（如 deliveryPrepared/controlFact）。
    pub fn append_canonical_fact_at(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
        occurred_at: i64,
    ) -> Result<AppendOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::AppendCanonicalFact {
            session_id: session_id.into(),
            fact,
            fidelity: Fidelity::Canonical,
            occurred_at,
            respond,
        })
    }

    /// 同一 transaction 追加 canonical fact 并更新 Binding cursor/pending。
    pub fn append_canonical_fact_with_binding_at(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
        occurred_at: i64,
        binding: &BindingStateUpdate,
    ) -> Result<AppendOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::AppendCanonicalFactWithBinding {
            session_id: session_id.into(),
            fact,
            occurred_at,
            binding: binding.clone(),
            respond,
        })
    }

    /// Shared linear-thread Tx1 专用：原子验证“无未决 Attempt”并追加
    /// `turnRequested + BindingStateUpdate`。
    pub fn append_turn_requested_with_binding_at(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
        occurred_at: i64,
        binding: &BindingStateUpdate,
    ) -> Result<AppendOutcome, StoreError> {
        self.send_command(
            |respond| WriterCommand::AppendCanonicalFactWithBindingIfNoUnresolved {
                session_id: session_id.into(),
                fact,
                occurred_at,
                binding: binding.clone(),
                respond,
            },
        )
    }

    /// 追加 presentation-only shadow fact（如 V0 evidence 映射），不做严格校验。
    pub fn append_presentation_only_fact(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
    ) -> Result<AppendOutcome, StoreError> {
        let occurred_at = canonical_fact_occurred_at(&fact)?;
        self.append_presentation_only_fact_at(session_id, fact, occurred_at)
    }

    pub fn append_presentation_only_fact_at(
        &self,
        session_id: impl Into<String>,
        fact: CanonicalFact,
        occurred_at: i64,
    ) -> Result<AppendOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::AppendCanonicalFact {
            session_id: session_id.into(),
            fact,
            fidelity: Fidelity::PresentationOnly,
            occurred_at,
            respond,
        })
    }

    pub fn upsert_binding_state(&self, update: &BindingStateUpdate) -> Result<(), StoreError> {
        self.send_command(|respond| WriterCommand::UpsertBinding {
            update: update.clone(),
            respond,
        })
    }

    pub fn upsert_session_target(&self, update: &SessionTargetUpdate) -> Result<(), StoreError> {
        self.send_command(|respond| WriterCommand::UpsertSessionTarget {
            update: update.clone(),
            respond,
        })
    }

    pub fn change_mutation_lease(
        &self,
        request: &MutationLeaseRequest,
    ) -> Result<MutationLeaseOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::ChangeMutationLease {
            request: request.clone(),
            respond,
        })
    }

    pub fn session_target(
        &self,
        session_id: &str,
    ) -> Result<Option<StoredSessionTarget>, StoreError> {
        self.send_command(|respond| WriterCommand::SessionTarget {
            session_id: session_id.to_string(),
            respond,
        })
    }

    pub fn record_provider_usage(
        &self,
        record: &ProviderUsageRecord,
    ) -> Result<LedgerOutcome, StoreError> {
        self.send_command(|respond| WriterCommand::RecordUsage {
            record: record.clone(),
            respond,
        })
    }

    /// 只读查询：按 sequence 升序返回 session 全部事件。
    pub fn events_for_session(&self, session_id: &str) -> Result<Vec<StoredEvent>, StoreError> {
        self.send_command(|respond| WriterCommand::EventsForSession {
            session_id: session_id.to_string(),
            respond,
        })
    }

    /// 投影专用读取入口：只返回 checkpoint 之后的事件。
    pub fn read_projection_events(
        &self,
        session_id: &str,
        through_sequence: i64,
    ) -> Result<Vec<StoredEvent>, StoreError> {
        self.send_command(|respond| WriterCommand::EventsForSessionAfter {
            session_id: session_id.to_string(),
            through_sequence,
            respond,
        })
    }

    pub fn squad_attempt_ids_for_session(
        &self,
        session_id: &str,
    ) -> Result<Vec<String>, StoreError> {
        self.send_command(|respond| WriterCommand::SquadAttemptIdsForSession {
            session_id: session_id.to_string(),
            respond,
        })
    }

    /// 只读查询：统计事件数（`None` 统计全表）。
    pub fn count_events(&self, session_id: Option<&str>) -> Result<i64, StoreError> {
        self.send_command(|respond| WriterCommand::CountEvents {
            session_id: session_id.map(str::to_string),
            respond,
        })
    }

    pub fn next_sequence(&self, session_id: &str) -> Result<Option<i64>, StoreError> {
        self.send_command(|respond| WriterCommand::NextSequence {
            session_id: session_id.to_string(),
            respond,
        })
    }

    pub fn binding_state(
        &self,
        session_id: &str,
        binding_key: &str,
    ) -> Result<Option<StoredBindingState>, StoreError> {
        self.send_command(|respond| WriterCommand::BindingState {
            session_id: session_id.to_string(),
            binding_key: binding_key.to_string(),
            respond,
        })
    }

    /// 只读查询：返回某 Shared Session 的全部 Hidden Native Binding。
    pub fn binding_states_for_session(
        &self,
        session_id: &str,
    ) -> Result<Vec<StoredBindingState>, StoreError> {
        self.send_command(|respond| WriterCommand::BindingStatesForSession {
            session_id: session_id.to_string(),
            respond,
        })
    }

    pub fn ledger_rows(
        &self,
        provider_profile_id: &str,
        window_started_at: i64,
        window_ended_at: i64,
        report_subject_id: &str,
    ) -> Result<Vec<StoredLedgerRow>, StoreError> {
        self.send_command(|respond| WriterCommand::LedgerRows {
            provider_profile_id: provider_profile_id.to_string(),
            window_started_at,
            window_ended_at,
            report_subject_id: report_subject_id.to_string(),
            respond,
        })
    }

    pub fn get_projection_checkpoint(
        &self,
        session_id: &str,
        projection_name: &str,
    ) -> Result<Option<ProjectionCheckpointRow>, StoreError> {
        self.send_command(|respond| WriterCommand::ProjectionCheckpoint {
            session_id: session_id.to_string(),
            projection_name: projection_name.to_string(),
            respond,
        })
    }

    pub fn upsert_projection_checkpoint(
        &self,
        checkpoint: &ProjectionCheckpointRow,
    ) -> Result<(), StoreError> {
        self.send_command(|respond| WriterCommand::UpsertProjectionCheckpoint {
            checkpoint: checkpoint.clone(),
            respond,
        })
    }

    pub fn legacy_import(&self, session_id: &str) -> Result<Option<LegacyImportRow>, StoreError> {
        self.send_command(|respond| WriterCommand::LegacyImport {
            session_id: session_id.to_string(),
            respond,
        })
    }

    pub fn upsert_legacy_import(&self, marker: &LegacyImportRow) -> Result<(), StoreError> {
        self.send_command(|respond| WriterCommand::UpsertLegacyImport {
            marker: marker.clone(),
            respond,
        })
    }

    pub fn user_version(&self) -> Result<u32, StoreError> {
        self.send_command(|respond| WriterCommand::UserVersion { respond })
    }

    pub fn quick_check(&self) -> Result<String, StoreError> {
        self.send_command(|respond| WriterCommand::QuickCheck { respond })
    }

    /// 仅最后一个 handle 可关闭 actor，避免任意 Clone 提前终止其他调用方。
    pub fn shutdown(self) -> Result<(), StoreError> {
        let handle_count = Arc::strong_count(&self.join_handle);
        if handle_count != 1 {
            return Err(StoreError::WriterStillShared { handle_count });
        }
        self.sender
            .send(WriterCommand::Shutdown)
            .map_err(|_| StoreError::actor_terminated("writer channel already closed"))?;
        let mut guard = self
            .join_handle
            .lock()
            .map_err(|_| StoreError::actor_terminated("writer join handle lock poisoned"))?;
        let handle = guard
            .take()
            .ok_or_else(|| StoreError::actor_terminated("writer already shut down"))?;
        handle
            .join()
            .map_err(|_| StoreError::actor_terminated("writer actor panicked"))
    }
}

/// 崩溃测试专用：hook 在 actor 启动前注入，生产写入仍只能经过 writer。
#[doc(hidden)]
pub fn open_crash_test_writer(
    path: &Path,
    hook: Box<dyn FnMut(TxBoundary) + Send>,
) -> Result<SharedEventWriter, StoreError> {
    let mut store = SharedEventStore::open(path)?;
    store.set_transaction_boundary_hook(Some(hook));
    SharedEventWriter::spawn(store)
}
