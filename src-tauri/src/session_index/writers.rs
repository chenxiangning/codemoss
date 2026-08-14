use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde_json::Value;

use super::store::{
    load_file_cursor, load_backfill_state, mark_source_synced, normalize_path_key,
    save_file_cursor, save_backfill_state, source_is_fresh, upsert_rows, BackfillState,
    SessionIndexFileCursor, SessionIndexRow,
};
use crate::engine::claude_history::encode_project_path;

/// Freshness window for source fingerprints. Within this, list can skip rescan.
/// Kept short so CLI-created sessions appear in the sidebar without force refresh.
pub(crate) const SOURCE_FRESH_MAX_AGE_MS: i64 = 8_000;

#[derive(Debug, Default)]
pub(crate) struct WriterResult {
    pub upserted: usize,
    pub engines: Vec<String>,
    pub partial_source: Option<String>,
    pub skipped_fresh: bool,
}

/// Result of one bounded historical-backfill batch (import daemon tail).
#[derive(Debug, Default)]
pub(crate) struct BackfillBatchResult {
    pub upserted: usize,
    pub complete: bool,
}

fn mtime_fingerprint(path: &Path) -> String {
    let meta = fs::metadata(path).ok();
    let modified = meta
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let len = meta.map(|metadata| metadata.len()).unwrap_or(0);
    format!("{modified}:{len}")
}

fn file_mtime_ms(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

/// List Claude project-dir session files, newest mtime first.
fn list_claude_project_session_files(project_dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(project_dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
                .collect()
        })
        .unwrap_or_default();
    files.sort_by(|left, right| {
        file_mtime_ms(right)
            .cmp(&file_mtime_ms(left))
            .then_with(|| left.to_string_lossy().cmp(&right.to_string_lossy()))
    });
    files
}

fn claude_index_row_from_file(
    path: &Path,
    workspace_path: &Path,
    titles: &HashMap<String, String>,
) -> Option<SessionIndexRow> {
    let session_id = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if session_id.is_empty() {
        return None;
    }
    let updated_at = file_mtime_ms(path);
    let title_from_history = titles.get(&session_id).cloned();
    let title = title_from_history
        .clone()
        .or_else(|| peek_claude_first_user_preview(path))
        .unwrap_or_else(|| "Claude Session".to_string());
    let size_bytes = fs::metadata(path).ok().map(|metadata| metadata.len());
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    Some(SessionIndexRow {
        engine: "claude".into(),
        session_id: session_id.clone(),
        title: title.clone(),
        native_title: title_from_history,
        updated_at,
        created_at: None,
        cwd: Some(workspace_key.clone()),
        workspace_path: Some(workspace_key),
        physical_path: Some(path.to_string_lossy().to_string()),
        parent_session_id: super::shared_visibility::extract_claude_parent_session_id(
            &session_id,
        ),
        size_bytes,
    })
}

/// Sync Claude sessions for one workspace via project-dir mtime + history.jsonl titles.
pub(crate) fn sync_claude_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let claude_home = crate::claude_home::resolve_effective_claude_home(None)
        .ok_or_else(|| "claude home not found".to_string())?;
    let projects_dir = claude_home.join("projects");
    let encoded = encode_project_path(&workspace_path.to_string_lossy());
    let project_dir = projects_dir.join(&encoded);
    let history_path = claude_home.join("history.jsonl");

    let source_key = format!("claude:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = format!(
        "{}|{}",
        mtime_fingerprint(&project_dir),
        mtime_fingerprint(&history_path)
    );
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["claude".into()],
            ..WriterResult::default()
        });
    }

    let titles = read_claude_history_titles(connection, &history_path, workspace_path)?;
    let mut rows = Vec::new();
    if project_dir.is_dir() {
        let mut files = list_claude_project_session_files(&project_dir);
        files.truncate(limit.saturating_mul(2).max(limit));
        for path in files {
            let Some(row) = claude_index_row_from_file(&path, workspace_path, &titles) else {
                continue;
            };
            rows.push(row);
            if rows.len() >= limit {
                break;
            }
        }
    }

    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["claude".into()],
        partial_source: if project_dir.is_dir() {
            None
        } else {
            Some("claude-project-dir-missing".into())
        },
        skipped_fresh: false,
    })
}

fn merge_claude_history_title_line(
    titles: &mut HashMap<String, (i64, String)>,
    target: &str,
    line: &str,
) {
    if line.len() > 256_000 {
        return;
    }
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return;
    };
    let project = value
        .get("project")
        .and_then(Value::as_str)
        .map(normalize_path_key)
        .unwrap_or_default();
    if project.is_empty() || project != target {
        return;
    }
    let session_id = value
        .get("sessionId")
        .or_else(|| value.get("session_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let Some(session_id) = session_id else {
        return;
    };
    let display = value
        .get("display")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let Some(display) = display else {
        return;
    };
    let timestamp = value.get("timestamp").and_then(Value::as_i64).unwrap_or(0);
    let entry = titles
        .entry(session_id.to_string())
        .or_insert((timestamp, display.to_string()));
    if entry.1.is_empty() || (timestamp > 0 && timestamp < entry.0) {
        *entry = (timestamp, display.to_string());
    }
}

fn read_claude_history_titles(
    connection: &Connection,
    history_path: &Path,
    workspace_path: &Path,
) -> Result<HashMap<String, String>, String> {
    let Ok(mut file) = File::open(history_path) else {
        return Ok(HashMap::new());
    };
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    let size = metadata.len();
    let inode = claude_history_file_identity(&metadata);
    let path_key = history_path.to_string_lossy().into_owned();
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    let cursor_key = format!("{path_key}|{workspace_key}");
    let stored = load_file_cursor(connection, &cursor_key)?;
    let incremental = stored.as_ref().is_some_and(|cursor| {
        cursor.inode == inode && size >= cursor.size && cursor.offset <= size
    });
    let mut titles: HashMap<String, (i64, String)> = if incremental {
        stored
            .as_ref()
            .and_then(|cursor| serde_json::from_str(&cursor.titles_json).ok())
            .unwrap_or_default()
    } else {
        HashMap::new()
    };
    let start_offset = if incremental {
        stored.as_ref().map(|cursor| cursor.offset).unwrap_or(0)
    } else {
        0
    };
    if start_offset > 0 {
        file.seek(SeekFrom::Start(start_offset))
            .map_err(|error| error.to_string())?;
    }
    let target = workspace_key;
    let mut bytes_read = 0u64;
    for line in BufReader::new(file).lines() {
        let Ok(line) = line else {
            continue;
        };
        bytes_read = bytes_read.saturating_add(line.len() as u64 + 1);
        merge_claude_history_title_line(&mut titles, &target, &line);
    }
    record_claude_history_title_read_bytes(history_path, bytes_read);
    let titles_json = serde_json::to_string(&titles).unwrap_or_else(|_| "{}".into());
    save_file_cursor(
        connection,
        &cursor_key,
        &SessionIndexFileCursor {
            inode,
            size,
            offset: size,
            titles_json,
        },
    )?;
    Ok(titles
        .into_iter()
        .map(|(session_id, (_ts, title))| (session_id, truncate_title(&title, 80)))
        .collect())
}

fn claude_history_file_identity(metadata: &std::fs::Metadata) -> String {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        format!("{}:{}", metadata.dev(), metadata.ino())
    }
    #[cfg(not(unix))]
    {
        let modified = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        format!("win:{}:{}", metadata.len(), modified)
    }
}

static CLAUDE_HISTORY_TITLE_READS: Mutex<Vec<(String, u64)>> = Mutex::new(Vec::new());

fn record_claude_history_title_read_bytes(path: &Path, bytes: u64) {
    if let Ok(mut guard) = CLAUDE_HISTORY_TITLE_READS.lock() {
        guard.push((path.to_string_lossy().into_owned(), bytes));
    }
}

pub(crate) fn claude_history_title_read_bytes_for_prefix(prefix: &Path) -> u64 {
    let prefix = prefix.to_string_lossy();
    let Ok(guard) = CLAUDE_HISTORY_TITLE_READS.lock() else {
        return 0;
    };
    guard
        .iter()
        .filter(|(path, _)| path.starts_with(prefix.as_ref()))
        .map(|(_, bytes)| *bytes)
        .sum()
}

fn peek_claude_first_user_preview(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file).take(64 * 1024);
    for line in reader.lines().flatten().take(40) {
        if line.len() > 200_000 {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let role = value
            .get("type")
            .and_then(Value::as_str)
            .or_else(|| value.get("role").and_then(Value::as_str))
            .unwrap_or("");
        if role != "user" && role != "human" {
            // Claude JSONL often wraps messages; try nested message.role.
            let nested_role = value
                .pointer("/message/role")
                .and_then(Value::as_str)
                .unwrap_or("");
            if nested_role != "user" {
                continue;
            }
        }
        if let Some(text) = extract_text_preview(&value) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(truncate_title(trimmed, 80));
            }
        }
    }
    None
}

fn extract_text_preview(value: &Value) -> Option<String> {
    if let Some(text) = value.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = value.pointer("/message/content").and_then(|content| {
        if let Some(text) = content.as_str() {
            return Some(text.to_string());
        }
        if let Some(arr) = content.as_array() {
            let mut parts = Vec::new();
            for item in arr {
                if item.get("type").and_then(Value::as_str) == Some("text") {
                    if let Some(text) = item.get("text").and_then(Value::as_str) {
                        parts.push(text);
                    }
                }
            }
            if !parts.is_empty() {
                return Some(parts.join(" "));
            }
        }
        None
    }) {
        return Some(text);
    }
    value
        .get("display")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn truncate_title(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut out = trimmed.chars().take(max_chars.saturating_sub(1)).collect::<String>();
    out.push('…');
    out
}

fn codex_summary_to_index_row(
    summary: crate::types::LocalUsageSessionSummary,
    workspace_key: &str,
) -> SessionIndexRow {
    let title = summary
        .native_title
        .clone()
        .or(summary.summary.clone())
        .unwrap_or_else(|| "Codex Session".to_string());
    SessionIndexRow {
        engine: "codex".into(),
        session_id: summary.session_id,
        title: title.clone(),
        native_title: summary.native_title.or(summary.summary),
        updated_at: summary.timestamp,
        created_at: None,
        cwd: summary
            .cwd
            .as_deref()
            .map(normalize_path_key)
            .or_else(|| Some(workspace_key.to_string())),
        workspace_path: Some(workspace_key.to_string()),
        physical_path: summary.physical_path,
        parent_session_id: summary.parent_session_id,
        size_bytes: summary.file_size_bytes,
    }
}

/// Sync Codex sessions for one workspace using bounded ThreadPreview scanner.
pub(crate) fn sync_codex_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    sessions_roots: &[PathBuf],
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let source_key = format!("codex:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = sessions_roots
        .iter()
        .map(|root| mtime_fingerprint(root))
        .collect::<Vec<_>>()
        .join("|");
    // Also include session_index.jsonl when present under parent home.
    let mut fingerprint = fingerprint;
    for root in sessions_roots {
        if let Some(home) = root.parent() {
            let index = home.join("session_index.jsonl");
            fingerprint.push('|');
            fingerprint.push_str(&mtime_fingerprint(&index));
        }
    }
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["codex".into()],
            ..WriterResult::default()
        });
    }

    let (summaries, _scanned) = crate::local_usage::scan_codex_session_summaries_for_index(
        Some(workspace_path),
        sessions_roots,
        limit,
    )?;
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    let rows: Vec<SessionIndexRow> = summaries
        .into_iter()
        .map(|summary| codex_summary_to_index_row(summary, &workspace_key))
        .collect();
    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["codex".into()],
        partial_source: None,
        skipped_fresh: false,
    })
}

fn kimi_session_index_path() -> Option<PathBuf> {
    let home = dirs::home_dir().map(|home| home.join(".kimi"))?;
    // Kimi may use custom home; best-effort default + env.
    let home = std::env::var("KIMI_HOME")
        .ok()
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        })
        .unwrap_or(home);
    Some(home.join("session_index.jsonl"))
}

fn parse_kimi_index_line(line: &str, target: &str) -> Option<SessionIndexRow> {
    if line.len() > 256_000 {
        return None;
    }
    let value = serde_json::from_str::<Value>(line).ok()?;
    let work_dir = value
        .get("workDir")
        .or_else(|| value.get("work_dir"))
        .or_else(|| value.get("cwd"))
        .and_then(Value::as_str)
        .map(normalize_path_key)
        .unwrap_or_default();
    if work_dir.is_empty() || work_dir != target {
        return None;
    }
    let session_id = value
        .get("sessionId")
        .or_else(|| value.get("session_id"))
        .or_else(|| value.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let session_dir = value
        .get("sessionDir")
        .or_else(|| value.get("session_dir"))
        .and_then(Value::as_str)
        .map(PathBuf::from);
    let updated_at = session_dir
        .as_ref()
        .map(|path| file_mtime_ms(path))
        .filter(|value| *value > 0)
        .unwrap_or_else(|| now_ms_fallback());
    let title = value
        .get("title")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "Kimi Session".to_string());
    Some(SessionIndexRow {
        engine: "kimi".into(),
        session_id: session_id.to_string(),
        title,
        native_title: None,
        updated_at,
        created_at: None,
        cwd: Some(target.to_string()),
        workspace_path: Some(target.to_string()),
        physical_path: session_dir.map(|path| path.to_string_lossy().to_string()),
        parent_session_id: None,
        size_bytes: None,
    })
}

/// Sync Kimi via session_index.jsonl (light index).
pub(crate) fn sync_kimi_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let index_path = kimi_session_index_path().ok_or_else(|| "home not found".to_string())?;
    let source_key = format!("kimi:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = mtime_fingerprint(&index_path);
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["kimi".into()],
            ..WriterResult::default()
        });
    }
    if !index_path.is_file() {
        mark_source_synced(connection, &source_key, &fingerprint, 0)?;
        return Ok(WriterResult {
            engines: vec!["kimi".into()],
            partial_source: Some("kimi-index-missing".into()),
            ..WriterResult::default()
        });
    }
    let target = normalize_path_key(&workspace_path.to_string_lossy());
    let file = File::open(&index_path).map_err(|error| error.to_string())?;
    let mut rows = Vec::new();
    for line in BufReader::new(file).lines() {
        if rows.len() >= limit {
            break;
        }
        let Ok(line) = line else {
            continue;
        };
        if let Some(row) = parse_kimi_index_line(&line, &target) {
            rows.push(row);
        }
    }
    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["kimi".into()],
        partial_source: None,
        skipped_fresh: false,
    })
}

fn now_ms_fallback() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Historical backfill (import daemon tail). One bounded batch per engine per
// tick; cursors persist in `session_index_backfill`. See OpenSpec change
// `restore-sidebar-flat-list-and-index-backfill` design D2/D3.
// ---------------------------------------------------------------------------

/// Claude backfill: page through project-dir files (mtime desc) by offset.
pub(crate) const CLAUDE_BACKFILL_BATCH_SIZE: usize = 100;
/// Codex backfill: distinct partition days processed per tick.
pub(crate) const CODEX_BACKFILL_PARTITIONS_PER_BATCH: usize = 3;
/// Codex non-partitioned fallback root cap (one-shot, first batch only).
pub(crate) const CODEX_BACKFILL_PLAIN_FILE_CAP: usize = 1_000;
/// Kimi backfill: matched index lines per tick.
pub(crate) const KIMI_BACKFILL_BATCH_SIZE: usize = 100;

pub(crate) fn backfill_claude_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    batch_size: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!("claude:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let Some(claude_home) = crate::claude_home::resolve_effective_claude_home(None) else {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    };
    let encoded = encode_project_path(&workspace_path.to_string_lossy());
    let project_dir = claude_home.join("projects").join(&encoded);
    if !project_dir.is_dir() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let history_path = claude_home.join("history.jsonl");
    let titles = read_claude_history_titles(connection, &history_path, workspace_path)?;
    let files = list_claude_project_session_files(&project_dir);
    let offset: usize = state.cursor.trim().parse().unwrap_or(0);
    if offset >= files.len() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let end = offset.saturating_add(batch_size).min(files.len());
    let mut rows = Vec::new();
    for path in &files[offset..end] {
        if let Some(row) = claude_index_row_from_file(path, workspace_path, &titles) {
            rows.push(row);
        }
    }
    let upserted = upsert_rows(connection, &rows)?;
    let complete = end >= files.len();
    save_backfill_state(
        connection,
        &source_key,
        &BackfillState {
            cursor: end.to_string(),
            complete,
        },
    )?;
    Ok(BackfillBatchResult { upserted, complete })
}

/// Codex backfill: walk date partitions newest→oldest, `max_partitions`
/// distinct days per tick (all roots sharing those days). Cursor is JSON
/// `{"day": "YYYY/MM/DD", "plainDone": bool}`; new partitions only appear at
/// the recent end, so a day-key cursor never mis-skips.
pub(crate) fn backfill_codex_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    sessions_roots: &[PathBuf],
    max_partitions: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!("codex:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let parsed = serde_json::from_str::<Value>(&state.cursor).ok();
    let cursor_day = parsed
        .as_ref()
        .and_then(|value| value.get("day"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let mut plain_done = parsed
        .as_ref()
        .and_then(|value| value.get("plainDone"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    let mut upserted = 0usize;

    // Non-partitioned roots (legacy layout): one bounded fallback pass.
    if !plain_done {
        let files = crate::local_usage::collect_codex_jsonl_candidates_capped(
            sessions_roots,
            CODEX_BACKFILL_PLAIN_FILE_CAP,
        );
        if !files.is_empty() {
            let summaries = crate::local_usage::scan_codex_session_summaries_for_files(
                Some(workspace_path),
                files,
            )?;
            let rows: Vec<SessionIndexRow> = summaries
                .into_iter()
                .map(|summary| codex_summary_to_index_row(summary, &workspace_key))
                .collect();
            upserted += upsert_rows(connection, &rows)?;
        }
        plain_done = true;
    }

    let partitions = crate::local_usage::list_codex_day_partitions(sessions_roots);
    let mut dates: Vec<String> = Vec::new();
    for partition in &partitions {
        if !dates.iter().any(|key| key == &partition.key) {
            dates.push(partition.key.clone());
        }
    }
    let remaining: Vec<String> = dates
        .iter()
        .filter(|key| cursor_day.is_empty() || *key < &cursor_day)
        .cloned()
        .collect();
    let batch_dates: Vec<String> = remaining.iter().take(max_partitions).cloned().collect();

    let save_state = |day: &str, plain: bool, complete: bool| {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: format!("{{\"day\":{:?},\"plainDone\":{}}}", day, plain),
                complete,
            },
        )
    };

    if batch_dates.is_empty() {
        save_state(&cursor_day, plain_done, true)?;
        return Ok(BackfillBatchResult {
            upserted,
            complete: true,
        });
    }

    let selected: Vec<_> = partitions
        .into_iter()
        .filter(|partition| batch_dates.contains(&partition.key))
        .collect();
    let summaries = crate::local_usage::scan_codex_session_summaries_for_day_dirs(
        Some(workspace_path),
        &selected,
    )?;
    let rows: Vec<SessionIndexRow> = summaries
        .into_iter()
        .map(|summary| codex_summary_to_index_row(summary, &workspace_key))
        .collect();
    upserted += upsert_rows(connection, &rows)?;

    let oldest = batch_dates.last().cloned().unwrap_or_default();
    let complete = !dates.iter().any(|key| *key < oldest);
    save_state(&oldest, plain_done, complete)?;
    Ok(BackfillBatchResult { upserted, complete })
}

/// Kimi backfill: page `session_index.jsonl` matched lines by offset.
pub(crate) fn backfill_kimi_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    batch_size: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!("kimi:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let Some(index_path) = kimi_session_index_path() else {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    };
    if !index_path.is_file() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let offset: usize = state.cursor.trim().parse().unwrap_or(0);
    let target = normalize_path_key(&workspace_path.to_string_lossy());
    let file = File::open(&index_path).map_err(|error| error.to_string())?;
    let mut matched = 0usize;
    let mut rows = Vec::new();
    let mut hit_batch_limit = false;
    for line in BufReader::new(file).lines() {
        let Ok(line) = line else {
            continue;
        };
        let Some(row) = parse_kimi_index_line(&line, &target) else {
            continue;
        };
        matched += 1;
        if matched <= offset {
            continue;
        }
        if rows.len() >= batch_size {
            hit_batch_limit = true;
            break;
        }
        rows.push(row);
    }
    let upserted = upsert_rows(connection, &rows)?;
    let covered = offset + rows.len();
    // EOF without hitting the batch cap means the file has no more matches.
    let complete = !hit_batch_limit;
    save_backfill_state(
        connection,
        &source_key,
        &BackfillState {
            cursor: covered.to_string(),
            complete,
        },
    )?;
    Ok(BackfillBatchResult { upserted, complete })
}

/// Commit prebuilt rows for one engine (used by async Gemini/Grok/OpenCode writers).
pub(crate) fn commit_engine_rows(
    connection: &Connection,
    engine: &str,
    workspace_path: &Path,
    rows: Vec<SessionIndexRow>,
    fingerprint: &str,
    partial_source: Option<String>,
) -> Result<WriterResult, String> {
    let engine = engine.trim().to_ascii_lowercase();
    if engine.is_empty() {
        return Err("engine is required".to_string());
    }
    let source_key = format!(
        "{}:{}",
        engine,
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec![engine],
        partial_source,
        skipped_fresh: false,
    })
}

pub(crate) fn engine_source_is_fresh(
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
    source_is_fresh(connection, &source_key, fingerprint, SOURCE_FRESH_MAX_AGE_MS)
}

pub(crate) fn gemini_home_fingerprint() -> String {
    let home = std::env::var("GEMINI_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".gemini")))
        .unwrap_or_else(|| PathBuf::from(".gemini"));
    mtime_fingerprint(&home)
}

pub(crate) fn pi_home_fingerprint() -> String {
    let sessions = crate::engine::pi_history::resolve_pi_sessions_root(None);
    let home = sessions
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| sessions.clone());
    let mut parts = vec![mtime_fingerprint(&home), mtime_fingerprint(&sessions)];
    // New jsonl lives in sessions/<encoded-cwd>/; parent mtime often stays
    // unchanged, so include each cwd-dir fingerprint.
    if let Ok(entries) = fs::read_dir(&sessions) {
        let mut child_prints = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_default();
            if name.starts_with('.') {
                continue;
            }
            child_prints.push(format!("{name}:{}", mtime_fingerprint(&path)));
        }
        child_prints.sort();
        parts.extend(child_prints);
    }
    parts.join("|")
}

pub(crate) fn grok_home_fingerprint() -> String {
    let home = std::env::var("GROK_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".grok")))
        .unwrap_or_else(|| PathBuf::from(".grok"));
    let sessions = home.join("sessions");
    format!(
        "{}|{}",
        mtime_fingerprint(&home),
        mtime_fingerprint(&sessions)
    )
}

pub(crate) fn opencode_source_fingerprint(workspace_path: &Path) -> String {
    // OpenCode has no durable local index file we control; use wall-clock bucket
    // so soft re-sync can refresh without force while still de-duping storms.
    let bucket = now_ms_fallback() / 15_000;
    format!(
        "opencode:{}:{}",
        normalize_path_key(&workspace_path.to_string_lossy()),
        bucket
    )
}

pub(crate) fn rows_from_gemini_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::gemini_history::GeminiSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "Gemini Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "gemini".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_grok_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::grok_history::GrokSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "Grok Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "grok".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: session.parent_session_id.clone(),
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_pi_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::pi_history::PiSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "PI Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "pi".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_opencode_entries(
    workspace_path: &Path,
    entries: &[crate::engine::OpenCodeSessionEntry],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    entries
        .iter()
        .map(|entry| {
            let title = {
                let trimmed = entry.title.trim();
                if trimmed.is_empty() {
                    "OpenCode Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            let cwd = entry
                .directory
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| workspace_key.clone());
            SessionIndexRow {
                engine: "opencode".into(),
                session_id: entry.session_id.clone(),
                title,
                native_title: None,
                updated_at: entry.updated_at.unwrap_or_else(now_ms_fallback),
                created_at: None,
                cwd: Some(cwd.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }
        })
        .collect()
}

/// Soft-invalidate all sources for a workspace so the next sync rescans.
pub(crate) fn invalidate_workspace_sources(
    connection: &Connection,
    workspace_path: &Path,
) -> Result<usize, String> {
    let key = normalize_path_key(&workspace_path.to_string_lossy());
    if key.is_empty() {
        return Ok(0);
    }
    let pattern = format!("%:{}", key);
    let changed = connection
        .execute(
            "UPDATE session_index_sources
             SET last_sync_ms = 0
             WHERE source_key LIKE ?1 OR source_key LIKE ?2",
            rusqlite::params![pattern, format!("%{}", key)],
        )
        .map_err(|error| error.to_string())?;
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::store::{engine_source_needs_incremental_sync, DDL};
    use serde_json::json;

    #[test]
    fn second_history_jsonl_sync_only_reads_appended_bytes() {
        let temp = std::env::temp_dir().join(format!(
            "ccgui-history-titles-{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&temp).expect("temp");
        let history = temp.join("history.jsonl");
        let workspace = PathBuf::from("/tmp/ccgui-history-ws");
        let prefix = json!({
            "sessionId": "old",
            "project": "/tmp/ccgui-history-ws",
            "display": "old title",
            "timestamp": 1
        })
        .to_string();
        let prefix = format!("{prefix}\n{}", "x".repeat(8000));
        std::fs::write(&history, format!("{prefix}\n")).expect("write prefix");
        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");

        let first = read_claude_history_titles(&connection, &history, &workspace).expect("first");
        let first_bytes = claude_history_title_read_bytes_for_prefix(&temp);
        assert_eq!(first.get("old").map(String::as_str), Some("old title"));
        assert!(first_bytes > 8000, "first pass reads the existing prefix");

        let appended = json!({
            "sessionId": "new",
            "project": "/tmp/ccgui-history-ws",
            "display": "new title",
            "timestamp": 2
        })
        .to_string();
        {
            use std::io::Write;
            let mut file = std::fs::OpenOptions::new()
                .append(true)
                .open(&history)
                .expect("append");
            writeln!(file, "{appended}").expect("write append");
        }

        let second = read_claude_history_titles(&connection, &history, &workspace).expect("second");
        let total_bytes = claude_history_title_read_bytes_for_prefix(&temp);
        let second_bytes = total_bytes.saturating_sub(first_bytes);
        assert_eq!(second.get("old").map(String::as_str), Some("old title"));
        assert_eq!(second.get("new").map(String::as_str), Some("new title"));
        assert!(
            second_bytes < first_bytes,
            "incremental sync must not reread the {first_bytes}-byte prefix; read {second_bytes}"
        );

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn truncated_history_jsonl_rebuilds_instead_of_dirty_read() {
        let temp = std::env::temp_dir().join(format!(
            "ccgui-history-truncate-{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&temp).expect("temp");
        let history = temp.join("history.jsonl");
        let workspace = PathBuf::from("/tmp/ccgui-history-ws2");
        std::fs::write(
            &history,
            format!(
                "{}\n{}\n",
                json!({"sessionId":"keep","project":"/tmp/ccgui-history-ws2","display":"keep","timestamp":1}),
                json!({"sessionId":"gone","project":"/tmp/ccgui-history-ws2","display":"gone","timestamp":2})
            ),
        )
        .expect("write");
        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");
        let first = read_claude_history_titles(&connection, &history, &workspace).expect("first");
        assert!(first.contains_key("gone"));

        std::fs::write(
            &history,
            format!(
                "{}\n",
                json!({"sessionId":"keep","project":"/tmp/ccgui-history-ws2","display":"keep-only","timestamp":1})
            ),
        )
        .expect("truncate rewrite");
        let second = read_claude_history_titles(&connection, &history, &workspace).expect("rebuild");
        assert_eq!(second.get("keep").map(String::as_str), Some("keep-only"));
        assert!(!second.contains_key("gone"));

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn rows_from_pi_summaries_prefix_engine_and_title() {
        let rows = rows_from_pi_summaries(
            Path::new("/Users/chenxiangning/code/AI/reach/ai-reach"),
            &[crate::engine::pi_history::PiSessionSummary {
                session_id: "019ffb7b-dedc-7b36-8d2f-f85f35501036".into(),
                first_message: "你在干什么".into(),
                updated_at: 10,
                created_at: 9,
                message_count: 2,
                file_size_bytes: Some(128),
                engine: Some("pi".into()),
                canonical_session_id: None,
                attribution_status: None,
            }],
        );
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].engine, "pi");
        assert_eq!(rows[0].session_id, "019ffb7b-dedc-7b36-8d2f-f85f35501036");
        assert_eq!(rows[0].title, "你在干什么");
        assert_eq!(rows[0].size_bytes, Some(128));
    }

    #[test]
    fn pi_fingerprint_changes_when_cwd_subdir_gets_new_jsonl() {
        let dir = std::env::temp_dir().join(format!(
            "pi-fp-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let sessions = dir.join("sessions");
        let cwd = sessions.join("--tmp-ws--");
        std::fs::create_dir_all(&cwd).expect("mkdir");
        std::fs::write(cwd.join("a.jsonl"), "x").expect("write a");
        let previous = std::env::var("PI_CODING_AGENT_DIR").ok();
        std::env::set_var("PI_CODING_AGENT_DIR", &dir);
        let first = pi_home_fingerprint();
        std::thread::sleep(std::time::Duration::from_millis(30));
        std::fs::write(cwd.join("b.jsonl"), "y").expect("write b");
        let second = pi_home_fingerprint();
        match previous {
            Some(value) => std::env::set_var("PI_CODING_AGENT_DIR", value),
            None => std::env::remove_var("PI_CODING_AGENT_DIR"),
        }
        let _ = std::fs::remove_dir_all(&dir);
        assert_ne!(first, second, "cwd jsonl must change PI fingerprint");
    }

    #[test]
    fn incremental_sync_helper_treats_missing_mismatch_and_invalidate() {
        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");
        let workspace = Path::new("/tmp/ccgui-pi-stale-ws");
        assert!(engine_source_needs_incremental_sync(
            &connection,
            "pi",
            workspace,
            "fp-a",
        )
        .expect("missing"));
        mark_source_synced(&connection, "pi:/tmp/ccgui-pi-stale-ws", "fp-a", 1)
            .expect("mark");
        assert!(!engine_source_needs_incremental_sync(
            &connection,
            "pi",
            workspace,
            "fp-a",
        )
        .expect("match"));
        assert!(engine_source_needs_incremental_sync(
            &connection,
            "pi",
            workspace,
            "fp-b",
        )
        .expect("mismatch"));
        connection
            .execute(
                "UPDATE session_index_sources SET last_sync_ms = 0 WHERE source_key = ?1",
                ["pi:/tmp/ccgui-pi-stale-ws"],
            )
            .expect("invalidate");
        assert!(engine_source_needs_incremental_sync(
            &connection,
            "pi",
            workspace,
            "fp-a",
        )
        .expect("invalidated"));
    }

    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn unique_temp_dir(tag: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "ccgui-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ))
    }

    #[test]
    fn claude_backfill_pages_by_offset_and_never_resurrects_tombstone() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let temp = unique_temp_dir("claude-backfill");
        let claude_home = temp.join("claude-home");
        let workspace_key = "/tmp/ccgui-claude-backfill-ws";
        let workspace = PathBuf::from(workspace_key);
        let project_dir = claude_home
            .join("projects")
            .join(encode_project_path(workspace_key));
        std::fs::create_dir_all(&project_dir).expect("project dir");
        for name in ["s1", "s2", "s3"] {
            std::fs::write(
                project_dir.join(format!("{name}.jsonl")),
                format!(
                    "{}\n",
                    json!({"type":"user","message":{"role":"user","content":format!("hello {name}")}})
                ),
            )
            .expect("session file");
        }
        let previous_home = std::env::var("CLAUDE_HOME").ok();
        std::env::set_var("CLAUDE_HOME", &claude_home);

        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");
        // Pre-existing tombstone must survive backfill re-processing its file.
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "claude".into(),
                session_id: "s2".into(),
                title: "deleted".into(),
                native_title: None,
                updated_at: 1,
                created_at: None,
                cwd: Some(workspace_key.into()),
                workspace_path: Some(workspace_key.into()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }],
        )
        .expect("seed");
        super::super::store::tombstone_session_ids(&connection, &["claude:s2".into()])
            .expect("tombstone");

        let first = backfill_claude_for_workspace(&connection, &workspace, 2).expect("batch 1");
        assert!(!first.complete, "2 of 3 files processed");
        let second = backfill_claude_for_workspace(&connection, &workspace, 2).expect("batch 2");
        assert!(second.complete, "reached end of file list");
        let third = backfill_claude_for_workspace(&connection, &workspace, 2).expect("batch 3");
        assert!(third.complete);
        assert_eq!(third.upserted, 0, "complete source must not rescan");

        let rows = super::super::store::list_for_workspace_path(&connection, workspace_key, 10)
            .expect("list");
        let ids: Vec<&str> = rows.iter().map(|row| row.session_id.as_str()).collect();
        assert!(ids.contains(&"s1"), "s1 indexed: {ids:?}");
        assert!(ids.contains(&"s3"), "s3 indexed: {ids:?}");
        assert!(!ids.contains(&"s2"), "tombstoned s2 must stay hidden: {ids:?}");

        match previous_home {
            Some(value) => std::env::set_var("CLAUDE_HOME", value),
            None => std::env::remove_var("CLAUDE_HOME"),
        }
        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn codex_backfill_walks_partitions_newest_to_oldest_until_complete() {
        let temp = unique_temp_dir("codex-backfill");
        let root = temp.join("sessions");
        for day in ["2026/08/12", "2026/08/10", "2026/07/01"] {
            let dir = root.join(day);
            std::fs::create_dir_all(&dir).expect("partition");
            std::fs::write(dir.join("rollout-dummy.jsonl"), "not-json\n").expect("file");
        }
        let workspace_key = "/tmp/ccgui-codex-backfill-ws";
        let workspace = PathBuf::from(workspace_key);
        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");
        let source_key = format!("codex:{workspace_key}");

        let first = backfill_codex_for_workspace(&connection, &workspace, &[root.clone()], 2)
            .expect("batch 1");
        assert!(!first.complete, "one day remains");
        let state = load_backfill_state(&connection, &source_key).expect("state");
        assert!(
            state.cursor.contains("2026/08/10"),
            "cursor advanced past 2 newest days: {}",
            state.cursor
        );
        assert!(state.cursor.contains("plainDone\":true"));

        let second = backfill_codex_for_workspace(&connection, &workspace, &[root.clone()], 2)
            .expect("batch 2");
        assert!(second.complete, "all partitions consumed");

        let third = backfill_codex_for_workspace(&connection, &workspace, &[root], 2)
            .expect("batch 3");
        assert!(third.complete);
        assert_eq!(third.upserted, 0, "complete source must not rescan");

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn kimi_backfill_pages_matched_rows_until_eof() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let temp = unique_temp_dir("kimi-backfill");
        let kimi_home = temp.join("kimi-home");
        std::fs::create_dir_all(&kimi_home).expect("kimi home");
        let workspace_key = "/tmp/ccgui-kimi-backfill-ws";
        std::fs::write(
            kimi_home.join("session_index.jsonl"),
            format!(
                "{}\n{}\n{}\n{}\n",
                json!({"sessionId":"k1","workDir":workspace_key,"title":"one"}),
                json!({"sessionId":"other","workDir":"/tmp/other-ws"}),
                json!({"sessionId":"k2","workDir":workspace_key}),
                json!({"sessionId":"k3","workDir":workspace_key}),
            ),
        )
        .expect("index file");
        let previous_home = std::env::var("KIMI_HOME").ok();
        std::env::set_var("KIMI_HOME", &kimi_home);

        let workspace = PathBuf::from(workspace_key);
        let connection = Connection::open_in_memory().expect("db");
        connection.execute_batch(DDL).expect("ddl");

        let first = backfill_kimi_for_workspace(&connection, &workspace, 2).expect("batch 1");
        assert_eq!(first.upserted, 2);
        assert!(!first.complete);
        let second = backfill_kimi_for_workspace(&connection, &workspace, 2).expect("batch 2");
        assert_eq!(second.upserted, 1);
        assert!(second.complete, "EOF reached without filling the batch");
        let third = backfill_kimi_for_workspace(&connection, &workspace, 2).expect("batch 3");
        assert!(third.complete);
        assert_eq!(third.upserted, 0);

        let rows = super::super::store::list_for_workspace_path(&connection, workspace_key, 10)
            .expect("list");
        let ids: Vec<&str> = rows.iter().map(|row| row.session_id.as_str()).collect();
        assert_eq!(ids.len(), 3, "only workspace-matched rows: {ids:?}");
        assert!(!ids.contains(&"other"));

        match previous_home {
            Some(value) => std::env::set_var("KIMI_HOME", value),
            None => std::env::remove_var("KIMI_HOME"),
        }
        let _ = std::fs::remove_dir_all(&temp);
    }
}
