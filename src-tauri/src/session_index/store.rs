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
                    indexed_at = excluded.indexed_at",
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
    // Prefer exact workspace_path / cwd match in SQL; post-filter with
    // paths_equivalent for Windows case folding edge cases.
    let mut statement = connection
        .prepare(
            "SELECT engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes
             FROM session_index
             WHERE workspace_path = ?1 OR cwd = ?1
             ORDER BY updated_at DESC, session_id ASC
             LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let mut rows = statement
        .query_map(params![key, limit as i64], map_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if rows.len() < limit {
        // Fallback: scan a larger recent window and path-equivalent filter.
        // Handles path normalization mismatches (trailing slash, case).
        let mut fallback = connection
            .prepare(
                "SELECT engine, session_id, title, native_title, updated_at, created_at,
                        cwd, workspace_path, physical_path, parent_session_id, size_bytes
                 FROM session_index
                 ORDER BY updated_at DESC, session_id ASC
                 LIMIT ?1",
            )
            .map_err(|error| error.to_string())?;
        let recent = fallback
            .query_map(params![(limit.saturating_mul(20).max(100)) as i64], map_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let existing: std::collections::HashSet<(String, String)> = rows
            .iter()
            .map(|row| (row.engine.clone(), row.session_id.clone()))
            .collect();
        for row in recent {
            if rows.len() >= limit {
                break;
            }
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
            if existing.contains(&(row.engine.clone(), row.session_id.clone())) {
                continue;
            }
            rows.push(row);
        }
        rows.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.session_id.cmp(&right.session_id))
        });
        rows.truncate(limit);
    }
    Ok(rows)
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
}
