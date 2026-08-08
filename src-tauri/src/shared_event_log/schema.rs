//! Shared Event Log DDL、PRAGMA runtime contract 与 `user_version` migration。
//!
//! DDL 以 Foundation §14.4.2 为基准；允许的 SQL 细节调整：
//! - `shared_binding_state` 增加 `length(...) > 0` CHECK（binding_key / engine / availability），
//!   为空字符串提供数据库级兜底，同时让同事务失败路径可被 SQLite 本身触发。

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;

use super::error::StoreError;

/// 当前 schema 版本；migration 只能单调递增到该版本。
pub(crate) const SCHEMA_VERSION: u32 = 2;

/// Foundation §14.4.3 runtime contract。
pub(crate) const BUSY_TIMEOUT: Duration = Duration::from_secs(5);

const DDL_V1: &str = r#"
CREATE TABLE IF NOT EXISTS shared_sessions_v2 (
  session_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  next_sequence INTEGER NOT NULL,
  selected_target_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_event_log (
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  logical_turn_id TEXT,
  attempt_id TEXT,
  dedupe_key TEXT,
  payload_json TEXT NOT NULL,
  payload_checksum TEXT NOT NULL,
  fidelity TEXT NOT NULL,
  committed_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, event_id),
  UNIQUE (session_id, sequence),
  FOREIGN KEY (session_id) REFERENCES shared_sessions_v2(session_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS shared_event_attempt_fact
  ON shared_event_log(session_id, attempt_id, fact_type)
  WHERE attempt_id IS NOT NULL
    AND fact_type <> 'conversation.usageRecorded';

CREATE UNIQUE INDEX IF NOT EXISTS shared_event_dedupe_key
  ON shared_event_log(session_id, fact_type, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS shared_binding_state (
  session_id TEXT NOT NULL,
  binding_key TEXT NOT NULL,
  engine TEXT NOT NULL,
  provider_profile_id TEXT,
  native_session_id TEXT,
  accepted_through_sequence INTEGER,
  committed_through_sequence INTEGER,
  provisioning_json TEXT,
  pending_delivery_json TEXT,
  availability TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, binding_key),
  CHECK (length(binding_key) > 0),
  CHECK (length(engine) > 0),
  CHECK (length(availability) > 0)
);

CREATE TABLE IF NOT EXISTS shared_projection_checkpoint (
  session_id TEXT NOT NULL,
  projection_name TEXT NOT NULL,
  projection_version INTEGER NOT NULL,
  through_sequence INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (session_id, projection_name)
);

CREATE TABLE IF NOT EXISTS shared_legacy_import (
  session_id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  imported_through_marker TEXT,
  status TEXT NOT NULL,
  imported_at INTEGER
);

CREATE TABLE IF NOT EXISTS provider_usage_aggregate_log (
  provider_profile_id TEXT NOT NULL,
  report_subject_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  window_started_at INTEGER NOT NULL,
  window_ended_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  payload_checksum TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  PRIMARY KEY (
    provider_profile_id,
    window_started_at,
    window_ended_at,
    report_subject_id,
    revision
  )
);
"#;

const DDL_V2: &str = r#"
CREATE TABLE IF NOT EXISTS squad_workspace_mutation_lease (
  workspace_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  state TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (length(workspace_id) > 0),
  CHECK (length(session_id) > 0),
  CHECK (length(run_id) > 0),
  CHECK (length(node_id) > 0),
  CHECK (length(attempt_id) > 0),
  CHECK (epoch > 0),
  CHECK (state IN ('held', 'released', 'blocked'))
);
"#;

/// 应用 Foundation §14.4.3 的 runtime PRAGMA 契约（仅写连接可调用）。
pub(crate) fn apply_runtime_pragmas(conn: &Connection) -> Result<(), StoreError> {
    conn.busy_timeout(BUSY_TIMEOUT)
        .map_err(|source| StoreError::sqlite("set busy_timeout pragma", source))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL;",
    )
    .map_err(|source| StoreError::sqlite("apply wal/foreign_keys/synchronous pragmas", source))?;
    Ok(())
}

/// 只读连接只允许设置 busy_timeout（WAL 等写 PRAGMA 会失败）。
pub(crate) fn apply_readonly_pragmas(conn: &Connection) -> Result<(), StoreError> {
    conn.busy_timeout(BUSY_TIMEOUT)
        .map_err(|source| StoreError::sqlite("set busy_timeout pragma", source))?;
    Ok(())
}

pub(crate) fn current_user_version(conn: &Connection) -> Result<u32, StoreError> {
    conn.query_row("PRAGMA user_version", [], |row| row.get::<_, u32>(0))
        .map_err(|source| StoreError::sqlite("read pragma user_version", source))
}

/// 在 open 时串行执行单调 migration；失败 fail closed。
///
/// user_version 高于本模块支持版本时拒绝打开（疑似未来版本数据，防静默降级）。
pub(crate) fn migrate(conn: &mut Connection) -> Result<(), StoreError> {
    let from_version = current_user_version(conn)?;
    if from_version > SCHEMA_VERSION {
        return Err(StoreError::migration_failed(
            from_version,
            format!("database user_version is newer than supported {SCHEMA_VERSION}"),
        ));
    }
    if from_version == SCHEMA_VERSION {
        return Ok(());
    }

    // v0 -> v2 可在同一 transaction 连续应用；每段 DDL 均幂等。
    let tx = conn
        .transaction()
        .map_err(|source| StoreError::sqlite("begin schema migration transaction", source))?;
    if from_version < 1 {
        tx.execute_batch(DDL_V1)
            .map_err(|source| StoreError::migration_failed(from_version, source.to_string()))?;
    }
    if from_version < 2 {
        tx.execute_batch(DDL_V2)
            .map_err(|source| StoreError::migration_failed(from_version, source.to_string()))?;
    }
    tx.pragma_update(None, "user_version", SCHEMA_VERSION)
        .map_err(|source| StoreError::migration_failed(from_version, source.to_string()))?;
    tx.commit()
        .map_err(|source| StoreError::migration_failed(from_version, source.to_string()))?;
    Ok(())
}

/// 确保 DB 父目录存在并收紧为 0700（Unix）。
pub(crate) fn ensure_parent_dir(path: &Path) -> Result<(), StoreError> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    if parent.as_os_str().is_empty() {
        return Ok(());
    }
    let parent_existed = parent.exists();
    std::fs::create_dir_all(parent).map_err(|source| {
        StoreError::io(
            format!("create shared event db parent dir {}", parent.display()),
            source,
        )
    })?;
    #[cfg(unix)]
    if !parent_existed {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700)).map_err(
            |source| {
                StoreError::io(
                    format!("chmod 0700 shared event db parent dir {}", parent.display()),
                    source,
                )
            },
        )?;
    }
    // 既有目录可能由其他数据共享，不能擅自收紧权限；产品调用方应传专用目录。
    // TODO(windows): 新建目录使用等价 ACL 限制为仅当前用户可访问（Foundation §14.4.5）。
    Ok(())
}

/// DB 文件收紧为 0600（Unix）；文件尚不存在时跳过（SQLite 首次写时创建后再由下次 open 收紧，
/// 但 `Connection::open` 会立即创建文件，因此正常路径一定能收紧）。
pub(crate) fn harden_db_file_permissions(path: &Path) -> Result<(), StoreError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if path.exists() {
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).map_err(
                |source| {
                    StoreError::io(
                        format!("chmod 0600 shared event db file {}", path.display()),
                        source,
                    )
                },
            )?;
        }
    }
    // TODO(windows): 使用等价 ACL 限制 DB 文件仅当前用户可读写（Foundation §14.4.5）。
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TABLES: [&str; 7] = [
        "shared_sessions_v2",
        "shared_event_log",
        "shared_binding_state",
        "shared_projection_checkpoint",
        "shared_legacy_import",
        "provider_usage_aggregate_log",
        "squad_workspace_mutation_lease",
    ];

    #[test]
    fn migration_is_idempotent_and_user_version_monotonic() {
        let mut conn = Connection::open_in_memory().expect("in-memory connection");
        migrate(&mut conn).expect("first migration");
        assert_eq!(
            current_user_version(&conn).expect("version"),
            SCHEMA_VERSION
        );

        // 重复执行不报错、版本不回退。
        migrate(&mut conn).expect("second migration");
        assert_eq!(
            current_user_version(&conn).expect("version"),
            SCHEMA_VERSION
        );

        for table in TABLES {
            let exists: bool = conn
                .query_row(
                    "SELECT count(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .expect("table lookup");
            assert!(exists, "missing table {table}");
        }
    }

    #[test]
    fn migration_rejects_newer_user_version() {
        let mut conn = Connection::open_in_memory().expect("in-memory connection");
        conn.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
            .expect("bump user_version");
        let error = migrate(&mut conn).expect_err("must fail closed on newer version");
        assert!(matches!(error, StoreError::MigrationFailed { .. }));
    }

    #[test]
    fn migration_upgrades_existing_v1_database_additively() {
        let mut conn = Connection::open_in_memory().expect("in-memory connection");
        conn.execute_batch(DDL_V1).expect("seed v1 schema");
        conn.pragma_update(None, "user_version", 1)
            .expect("seed v1 version");

        migrate(&mut conn).expect("upgrade v1 to v2");

        assert_eq!(current_user_version(&conn).expect("version"), 2);
        let exists: bool = conn
            .query_row(
                "SELECT count(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = 'squad_workspace_mutation_lease'",
                [],
                |row| row.get(0),
            )
            .expect("lease table lookup");
        assert!(exists);
    }
}
