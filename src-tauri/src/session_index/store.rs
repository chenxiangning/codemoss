use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub(crate) const DDL: &str = r#"
CREATE TABLE IF NOT EXISTS session_index (
  engine TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  native_title TEXT,
  updated_at INTEGER NOT NULL,
  created_at INTEGER,
  cwd TEXT,
  workspace_path TEXT,
  physical_path TEXT,
  parent_session_id TEXT,
  size_bytes INTEGER,
  source_fingerprint TEXT,
  indexed_at INTEGER NOT NULL,
  tombstoned_at INTEGER,
  PRIMARY KEY (engine, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_index_workspace_mtime
  ON session_index(workspace_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_index_cwd_mtime
  ON session_index(cwd, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_index_engine_mtime
  ON session_index(engine, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_index_sources (
  source_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  last_sync_ms INTEGER NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session_index_file_cursors (
  path TEXT PRIMARY KEY,
  inode TEXT NOT NULL,
  size INTEGER NOT NULL,
  offset INTEGER NOT NULL,
  titles_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session_index_backfill (
  source_key TEXT PRIMARY KEY,
  cursor TEXT NOT NULL DEFAULT '',
  complete INTEGER NOT NULL DEFAULT 0,
  updated_ms INTEGER NOT NULL
);
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexRow {
    pub engine: String,
    pub session_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_title: Option<String>,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexListPage {
    pub data: Vec<SessionIndexRow>,
    pub source: String,
    pub synced: bool,
    pub sync_ms: Option<u64>,
    pub engines: Vec<String>,
    /// Non-tombstoned rows matching this workspace (all engines). Drives the
    /// sidebar "load older" affordance when paging beyond the recent window.
    pub total_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<super::shared_visibility::SharedNativeVisibilityProjection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexSyncReport {
    pub upserted: usize,
    pub engines: Vec<String>,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial_source: Option<String>,
    pub skipped_fresh: bool,
}

pub(crate) fn database_path() -> Result<PathBuf, String> {
    Ok(crate::app_paths::app_home_dir()?.join("session-index.sqlite3"))
}

pub(crate) fn open_connection() -> Result<Connection, String> {
    let path = database_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(&path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(3))
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;",
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(DDL)
        .map_err(|error| error.to_string())?;
    let _ = connection.execute(
        "ALTER TABLE session_index ADD COLUMN tombstoned_at INTEGER",
        [],
    );
    Ok(connection)
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn normalize_path_key(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let mut normalized = trimmed.replace('\\', "/");
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    // Case-fold on Windows-style paths is left to comparison helper.
    normalized
}

pub(crate) fn paths_equivalent(left: &str, right: &str) -> bool {
    let left = normalize_path_key(left);
    let right = normalize_path_key(right);
    if left.is_empty() || right.is_empty() {
        return false;
    }
    if left == right {
        return true;
    }
    #[cfg(windows)]
    {
        return left.eq_ignore_ascii_case(&right);
    }
    #[cfg(not(windows))]
    {
        false
    }
}

pub(crate) fn upsert_rows(connection: &Connection, rows: &[SessionIndexRow]) -> Result<usize, String> {
    if rows.is_empty() {
        return Ok(0);
    }
    let indexed_at = now_ms();
    let tx = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;
    {
        let mut statement = tx
            .prepare(
                "INSERT INTO session_index (
                    engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes,
                    source_fingerprint, indexed_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                 ON CONFLICT(engine, session_id) DO UPDATE SET
                    title = excluded.title,
                    native_title = excluded.native_title,
                    updated_at = excluded.updated_at,
                    created_at = COALESCE(excluded.created_at, session_index.created_at),
                    cwd = COALESCE(excluded.cwd, session_index.cwd),
                    workspace_path = COALESCE(excluded.workspace_path, session_index.workspace_path),
                    physical_path = COALESCE(excluded.physical_path, session_index.physical_path),
                    parent_session_id = COALESCE(excluded.parent_session_id, session_index.parent_session_id),
                    size_bytes = COALESCE(excluded.size_bytes, session_index.size_bytes),
                    source_fingerprint = excluded.source_fingerprint,
                    indexed_at = excluded.indexed_at
                 WHERE session_index.tombstoned_at IS NULL",
            )
            .map_err(|error| error.to_string())?;
        for row in rows {
            let engine = row.engine.trim().to_ascii_lowercase();
            let session_id = row.session_id.trim();
            if engine.is_empty() || session_id.is_empty() {
                continue;
            }
            let title = {
                let trimmed = row.title.trim();
                if trimmed.is_empty() {
                    format!("{} session", engine)
                } else {
                    trimmed.to_string()
                }
            };
            let cwd = row
                .cwd
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty());
            let workspace_path = row
                .workspace_path
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty())
                .or_else(|| cwd.clone());
            statement
                .execute(params![
                    engine,
                    session_id,
                    title,
                    row.native_title
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.updated_at.max(0),
                    row.created_at.filter(|value| *value > 0),
                    cwd,
                    workspace_path,
                    row.physical_path
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.parent_session_id
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.size_bytes.map(|value| value as i64),
                    row.physical_path
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .unwrap_or(""),
                    indexed_at,
                ])
                .map_err(|error| error.to_string())?;
        }
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(rows.len())
}

pub(crate) fn mark_source_synced(
    connection: &Connection,
    source_key: &str,
    fingerprint: &str,
    row_count: usize,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO session_index_sources (source_key, fingerprint, last_sync_ms, row_count)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source_key) DO UPDATE SET
               fingerprint = excluded.fingerprint,
               last_sync_ms = excluded.last_sync_ms,
               row_count = excluded.row_count",
            params![source_key, fingerprint, now_ms(), row_count as i64],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn source_is_fresh(
    connection: &Connection,
    source_key: &str,
    fingerprint: &str,
    max_age_ms: i64,
) -> Result<bool, String> {
    let row = connection
        .query_row(
            "SELECT fingerprint, last_sync_ms FROM session_index_sources WHERE source_key = ?1",
            [source_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((stored_fp, last_sync_ms)) = row else {
        return Ok(false);
    };
    if stored_fp != fingerprint {
        return Ok(false);
    }
    let age = now_ms().saturating_sub(last_sync_ms);
    Ok(age <= max_age_ms)
}

/// List-level stale check for async engines (PI / Gemini / Grok).
/// Missing source, invalidated (`last_sync_ms == 0`), or fingerprint mismatch.
/// Does **not** use the intra-burst age window — restart must not full-scan
/// Claude/Codex just because 8s elapsed.
pub(crate) fn engine_source_needs_incremental_sync(
    connection: &Connection,
    engine: &str,
    workspace_path: &Path,
    fingerprint: &str,
) -> Result<bool, String> {
    let source_key = format!(
        "{}:{}",
        engine.trim().to_ascii_lowercase(),
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let row = connection
        .query_row(
            "SELECT fingerprint, last_sync_ms FROM session_index_sources WHERE source_key = ?1",
            [&source_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((stored_fp, last_sync_ms)) = row else {
        return Ok(true);
    };
    if last_sync_ms <= 0 {
        return Ok(true);
    }
    Ok(stored_fp != fingerprint)
}

/// True when a send/create marked this workspace's Index sources stale.
/// Restart first-paint must rescan writers even if some rows already exist.
pub(crate) fn workspace_index_sources_invalidated(
    connection: &Connection,
    workspace_path: &str,
) -> Result<bool, String> {
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(false);
    }
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM session_index_sources
             WHERE last_sync_ms <= 0
               AND (source_key LIKE ?1 OR source_key LIKE ?2)",
            rusqlite::params![format!("%:{}", key), format!("%{}", key)],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(count > 0)
}

const INDEX_LIST_ENGINES: &[&str] = &[
    "claude", "codex", "gemini", "grok", "kimi", "opencode", "pi",
];

fn list_slice_for_workspace_engine(
    connection: &Connection,
    workspace_key: &str,
    engine: &str,
    limit: usize,
) -> Result<Vec<SessionIndexRow>, String> {
    let mut statement = connection
        .prepare(
            "SELECT engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes
             FROM session_index
             WHERE (workspace_path = ?1 OR cwd = ?1)
               AND engine = ?2
               AND tombstoned_at IS NULL
             ORDER BY updated_at DESC, session_id ASC
             LIMIT ?3",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_key, engine, limit as i64], map_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

pub(crate) fn list_for_workspace_path(
    connection: &Connection,
    workspace_path: &str,
    limit: usize,
) -> Result<Vec<SessionIndexRow>, String> {
    let limit = limit.clamp(1, 500);
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(Vec::new());
    }
    // Per-engine budget: a global LIMIT would let recent Claude/Shared rows
    // starve Codex (and the rail would look empty).
    let mut rows = Vec::new();
    let mut existing = std::collections::HashSet::<(String, String)>::new();
    for engine in INDEX_LIST_ENGINES {
        for row in list_slice_for_workspace_engine(connection, &key, engine, limit)? {
            let identity = (row.engine.clone(), row.session_id.clone());
            if existing.insert(identity) {
                rows.push(row);
            }
        }
    }

    if rows.is_empty() {
        // Fallback: scan a larger recent window and path-equivalent filter.
        let mut fallback = connection
            .prepare(
                "SELECT engine, session_id, title, native_title, updated_at, created_at,
                        cwd, workspace_path, physical_path, parent_session_id, size_bytes
                 FROM session_index
                 WHERE tombstoned_at IS NULL
                 ORDER BY updated_at DESC, session_id ASC
                 LIMIT ?1",
            )
            .map_err(|error| error.to_string())?;
        let recent = fallback
            .query_map(
                params![(limit.saturating_mul(20).max(100)) as i64],
                map_row,
            )
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let mut per_engine: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        for row in recent {
            let matches = row
                .workspace_path
                .as_deref()
                .map(|value| paths_equivalent(value, &key))
                .unwrap_or(false)
                || row
                    .cwd
                    .as_deref()
                    .map(|value| paths_equivalent(value, &key))
                    .unwrap_or(false);
            if !matches {
                continue;
            }
            let identity = (row.engine.clone(), row.session_id.clone());
            if !existing.insert(identity) {
                continue;
            }
            let count = per_engine.entry(row.engine.clone()).or_insert(0);
            if *count >= limit {
                continue;
            }
            *count += 1;
            rows.push(row);
        }
    }
    rows.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    Ok(rows)
}

pub(crate) fn tombstone_session_ids(
    connection: &Connection,
    session_ids: &[String],
) -> Result<usize, String> {
    if session_ids.is_empty() {
        return Ok(0);
    }
    let marked_at = now_ms();
    let mut updated = 0usize;
    let mut statement = connection
        .prepare(
            "UPDATE session_index
             SET tombstoned_at = COALESCE(tombstoned_at, ?1)
             WHERE session_id = ?2
                OR session_id = ?3
                OR (engine || ':' || session_id) = ?2",
        )
        .map_err(|error| error.to_string())?;
    for raw in session_ids {
        let full = raw.trim();
        if full.is_empty() {
            continue;
        }
        let bare = full
            .split_once(':')
            .map(|(_, rest)| rest.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(full);
        updated += statement
            .execute(params![marked_at, full, bare])
            .map_err(|error| error.to_string())? as usize;
    }
    Ok(updated)
}



#[derive(Debug, Clone)]
pub(crate) struct SessionIndexFileCursor {
    pub inode: String,
    pub size: u64,
    pub offset: u64,
    pub titles_json: String,
}

pub(crate) fn load_file_cursor(
    connection: &Connection,
    path: &str,
) -> Result<Option<SessionIndexFileCursor>, String> {
    connection
        .query_row(
            "SELECT inode, size, offset, titles_json FROM session_index_file_cursors WHERE path = ?1",
            [path],
            |row| {
                Ok(SessionIndexFileCursor {
                    inode: row.get(0)?,
                    size: row.get::<_, i64>(1)?.max(0) as u64,
                    offset: row.get::<_, i64>(2)?.max(0) as u64,
                    titles_json: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

pub(crate) fn save_file_cursor(
    connection: &Connection,
    path: &str,
    cursor: &SessionIndexFileCursor,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO session_index_file_cursors (path, inode, size, offset, titles_json)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET
               inode = excluded.inode,
               size = excluded.size,
               offset = excluded.offset,
               titles_json = excluded.titles_json",
            params![
                path,
                cursor.inode,
                cursor.size as i64,
                cursor.offset as i64,
                cursor.titles_json
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// Count all non-tombstoned rows matching a workspace (any engine). Used for
/// the sidebar "load older" affordance (`totalCount` on list pages).
pub(crate) fn count_for_workspace_path(
    connection: &Connection,
    workspace_path: &str,
) -> Result<i64, String> {
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(0);
    }
    connection
        .query_row(
            "SELECT COUNT(*) FROM session_index
             WHERE (workspace_path = ?1 OR cwd = ?1)
               AND tombstoned_at IS NULL",
            params![key],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

/// Persisted incremental-backfill state for one `{engine}:{workspace_path}`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct BackfillState {
    /// Engine-specific cursor (mtime offset / partition day / matched-row
    /// offset / covered count). Empty means "not started".
    pub cursor: String,
    pub complete: bool,
}

pub(crate) fn load_backfill_state(
    connection: &Connection,
    source_key: &str,
) -> Result<BackfillState, String> {
    let row = connection
        .query_row(
            "SELECT cursor, complete FROM session_index_backfill WHERE source_key = ?1",
            [source_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(match row {
        Some((cursor, complete)) => BackfillState {
            cursor,
            complete: complete > 0,
        },
        None => BackfillState::default(),
    })
}

pub(crate) fn save_backfill_state(
    connection: &Connection,
    source_key: &str,
    state: &BackfillState,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO session_index_backfill (source_key, cursor, complete, updated_ms)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source_key) DO UPDATE SET
               cursor = excluded.cursor,
               complete = excluded.complete,
               updated_ms = excluded.updated_ms",
            params![
                source_key,
                state.cursor,
                if state.complete { 1 } else { 0 },
                now_ms()
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionIndexRow> {
    Ok(SessionIndexRow {
        engine: row.get(0)?,
        session_id: row.get(1)?,
        title: row.get(2)?,
        native_title: row.get(3)?,
        updated_at: row.get(4)?,
        created_at: row.get(5)?,
        cwd: row.get(6)?,
        workspace_path: row.get(7)?,
        physical_path: row.get(8)?,
        parent_session_id: row.get(9)?,
        size_bytes: row
            .get::<_, Option<i64>>(10)?
            .and_then(|value| if value >= 0 { Some(value as u64) } else { None }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_and_list_by_workspace() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "claude".into(),
                session_id: "s1".into(),
                title: "Hello".into(),
                native_title: None,
                updated_at: 200,
                created_at: Some(100),
                cwd: Some("/Users/me/proj".into()),
                workspace_path: Some("/Users/me/proj".into()),
                physical_path: Some("/tmp/s1.jsonl".into()),
                parent_session_id: None,
                size_bytes: Some(12),
            }],
        )
        .expect("upsert");
        let rows = list_for_workspace_path(&connection, "/Users/me/proj/", 10).expect("list");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].session_id, "s1");
    }

    fn index_row(engine: &str, session_id: &str, updated_at: i64) -> SessionIndexRow {
        SessionIndexRow {
            engine: engine.into(),
            session_id: session_id.into(),
            title: session_id.into(),
            native_title: None,
            updated_at,
            created_at: None,
            cwd: Some("/tmp/proj".into()),
            workspace_path: Some("/tmp/proj".into()),
            physical_path: None,
            parent_session_id: None,
            size_bytes: None,
        }
    }

    #[test]
    fn list_keeps_per_engine_budget_so_codex_is_not_starved() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        let mut rows = Vec::new();
        for index in 0..8 {
            rows.push(index_row("claude", &format!("claude-{index}"), 1000 + index));
        }
        rows.push(index_row("codex", "codex-old", 1));
        upsert_rows(&connection, &rows).expect("upsert");
        let listed = list_for_workspace_path(&connection, "/tmp/proj", 2).expect("list");
        let claude = listed
            .iter()
            .filter(|row| row.engine == "claude")
            .count();
        let codex = listed
            .iter()
            .filter(|row| row.engine == "codex")
            .count();
        assert_eq!(claude, 2);
        assert_eq!(codex, 1);
        assert!(listed.iter().any(|row| row.session_id == "codex-old"));
    }

    #[test]
    fn backfill_state_roundtrips_and_counts_visible_rows() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");

        let initial = load_backfill_state(&connection, "codex:/tmp/proj").expect("load");
        assert_eq!(initial, BackfillState::default());

        save_backfill_state(
            &connection,
            "codex:/tmp/proj",
            &BackfillState {
                cursor: "{\"day\":\"2026/07/01\",\"plainDone\":true}".into(),
                complete: false,
            },
        )
        .expect("save");
        let loaded = load_backfill_state(&connection, "codex:/tmp/proj").expect("reload");
        assert!(!loaded.complete);
        assert!(loaded.cursor.contains("2026/07/01"));

        save_backfill_state(
            &connection,
            "codex:/tmp/proj",
            &BackfillState {
                cursor: loaded.cursor.clone(),
                complete: true,
            },
        )
        .expect("save complete");
        assert!(load_backfill_state(&connection, "codex:/tmp/proj")
            .expect("reload")
            .complete);

        upsert_rows(
            &connection,
            &[
                index_row("claude", "visible-1", 100),
                index_row("codex", "visible-2", 90),
                index_row("codex", "gone", 80),
                SessionIndexRow {
                    workspace_path: Some("/tmp/other".into()),
                    cwd: Some("/tmp/other".into()),
                    ..index_row("codex", "other-ws", 70)
                },
            ],
        )
        .expect("upsert");
        tombstone_session_ids(&connection, &["codex:gone".into()]).expect("tombstone");
        let total = count_for_workspace_path(&connection, "/tmp/proj").expect("count");
        assert_eq!(total, 2, "tombstoned and other-workspace rows excluded");
    }

    #[test]
    fn tombstone_hides_row_and_blocks_upsert_resurrection() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "codex".into(),
                session_id: "dead".into(),
                title: "Gone".into(),
                native_title: None,
                updated_at: 200,
                created_at: None,
                cwd: Some("/tmp/proj".into()),
                workspace_path: Some("/tmp/proj".into()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }],
        )
        .expect("upsert");
        let marked = tombstone_session_ids(&connection, &["codex:dead".into()]).expect("tombstone");
        assert!(marked >= 1);
        let hidden = list_for_workspace_path(&connection, "/tmp/proj", 10).expect("list");
        assert!(hidden.is_empty());
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "codex".into(),
                session_id: "dead".into(),
                title: "Resurrected".into(),
                native_title: None,
                updated_at: 400,
                created_at: None,
                cwd: Some("/tmp/proj".into()),
                workspace_path: Some("/tmp/proj".into()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }],
        )
        .expect("upsert again");
        let still_hidden = list_for_workspace_path(&connection, "/tmp/proj", 10).expect("list");
        assert!(still_hidden.is_empty());
    }
}
