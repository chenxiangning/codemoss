use std::path::PathBuf;
use std::time::{Duration, Instant};

use tauri::State;
use tokio::time::timeout;

use super::store::{
    list_for_workspace_path, open_connection, SessionIndexListPage, SessionIndexSyncReport,
};
use super::writers::{
    commit_engine_rows, engine_source_is_fresh, gemini_home_fingerprint, grok_home_fingerprint,
    invalidate_workspace_sources, opencode_source_fingerprint, pi_home_fingerprint,
    rows_from_gemini_summaries, rows_from_grok_summaries, rows_from_opencode_entries,
    rows_from_pi_summaries, sync_claude_for_workspace, sync_codex_for_workspace,
    sync_kimi_for_workspace, WriterResult,
};
use crate::engine::gemini_history::list_gemini_sessions;
use crate::engine::grok_history::list_grok_sessions;
use crate::engine::pi_history::list_pi_sessions;
use crate::engine::opencode_session_list_core;
use crate::local_usage::resolve_sessions_roots;
use crate::state::AppState;

const DEFAULT_SIDEBAR_INDEX_LIMIT: usize = 50;
const ASYNC_ENGINE_LIST_TIMEOUT: Duration = Duration::from_secs(3);
const OPENCODE_INDEX_TIMEOUT: Duration = Duration::from_secs(2);

fn merge_writer(into: &mut WriterResult, from: WriterResult) {
    into.upserted += from.upserted;
    for engine in from.engines {
        if !into.engines.iter().any(|existing| existing == &engine) {
            into.engines.push(engine);
        }
    }
    if into.partial_source.is_none() {
        into.partial_source = from.partial_source;
    }
    into.skipped_fresh = into.skipped_fresh && from.skipped_fresh;
}

async fn resolve_workspace_path_async(
    state: &AppState,
    workspace_id: &str,
) -> Result<(String, PathBuf), String> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err("workspace_id is required".to_string());
    }
    let workspaces = state.workspaces.lock().await;
    let entry = workspaces
        .get(workspace_id)
        .ok_or_else(|| "workspace not found".to_string())?;
    Ok((entry.path.clone(), PathBuf::from(&entry.path)))
}

async fn sync_disk_engines(
    workspace_path: PathBuf,
    sessions_roots: Vec<PathBuf>,
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        let mut aggregated = WriterResult {
            skipped_fresh: true,
            ..WriterResult::default()
        };

        match sync_claude_for_workspace(&connection, &workspace_path, limit, force) {
            Ok(result) => merge_writer(&mut aggregated, result),
            Err(error) => {
                aggregated.partial_source =
                    Some(format!("claude-sync-error:{}", truncate_error(&error)));
                aggregated.engines.push("claude".into());
                aggregated.skipped_fresh = false;
            }
        }

        match sync_codex_for_workspace(&connection, &workspace_path, &sessions_roots, limit, force)
        {
            Ok(result) => merge_writer(&mut aggregated, result),
            Err(error) => {
                if aggregated.partial_source.is_none() {
                    aggregated.partial_source =
                        Some(format!("codex-sync-error:{}", truncate_error(&error)));
                }
                if !aggregated.engines.iter().any(|engine| engine == "codex") {
                    aggregated.engines.push("codex".into());
                }
                aggregated.skipped_fresh = false;
            }
        }

        match sync_kimi_for_workspace(&connection, &workspace_path, limit, force) {
            Ok(result) => merge_writer(&mut aggregated, result),
            Err(error) => {
                if aggregated.partial_source.is_none() {
                    aggregated.partial_source =
                        Some(format!("kimi-sync-error:{}", truncate_error(&error)));
                }
                if !aggregated.engines.iter().any(|engine| engine == "kimi") {
                    aggregated.engines.push("kimi".into());
                }
                aggregated.skipped_fresh = false;
            }
        }

        Ok::<WriterResult, String>(aggregated)
    })
    .await
    .map_err(|error| error.to_string())?
}

async fn sync_gemini_engine(
    workspace_path: PathBuf,
    limit: usize,
    force: bool,
) -> WriterResult {
    let fingerprint = gemini_home_fingerprint();
    let skip = !force
        && tokio::task::spawn_blocking({
            let workspace_path = workspace_path.clone();
            let fingerprint = fingerprint.clone();
            move || {
                let connection = open_connection()?;
                engine_source_is_fresh(&connection, "gemini", &workspace_path, &fingerprint)
            }
        })
        .await
        .ok()
        .and_then(|result| result.ok())
        .unwrap_or(false);
    if skip {
        return WriterResult {
            skipped_fresh: true,
            engines: vec!["gemini".into()],
            ..WriterResult::default()
        };
    }

    let list_result = timeout(
        ASYNC_ENGINE_LIST_TIMEOUT,
        list_gemini_sessions(&workspace_path, Some(limit), None),
    )
    .await;

    let (rows, partial) = match list_result {
        Ok(Ok(sessions)) => (rows_from_gemini_summaries(&workspace_path, &sessions), None),
        Ok(Err(error)) => (Vec::new(), Some(format!("gemini-sync-error:{}", truncate_error(&error)))),
        Err(_) => (Vec::new(), Some("gemini-sync-timeout".into())),
    };

    tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        commit_engine_rows(
            &connection,
            "gemini",
            &workspace_path,
            rows,
            &fingerprint,
            partial,
        )
    })
    .await
    .ok()
    .and_then(|result| result.ok())
    .unwrap_or_else(|| WriterResult {
        engines: vec!["gemini".into()],
        partial_source: Some("gemini-commit-error".into()),
        skipped_fresh: false,
        ..WriterResult::default()
    })
}

async fn sync_grok_engine(workspace_path: PathBuf, limit: usize, force: bool) -> WriterResult {
    let fingerprint = grok_home_fingerprint();
    let skip = !force
        && tokio::task::spawn_blocking({
            let workspace_path = workspace_path.clone();
            let fingerprint = fingerprint.clone();
            move || {
                let connection = open_connection()?;
                engine_source_is_fresh(&connection, "grok", &workspace_path, &fingerprint)
            }
        })
        .await
        .ok()
        .and_then(|result| result.ok())
        .unwrap_or(false);
    if skip {
        return WriterResult {
            skipped_fresh: true,
            engines: vec!["grok".into()],
            ..WriterResult::default()
        };
    }

    let list_result = timeout(
        ASYNC_ENGINE_LIST_TIMEOUT,
        list_grok_sessions(&workspace_path, Some(limit), None),
    )
    .await;

    let (rows, partial) = match list_result {
        Ok(Ok(sessions)) => (rows_from_grok_summaries(&workspace_path, &sessions), None),
        Ok(Err(error)) => (Vec::new(), Some(format!("grok-sync-error:{}", truncate_error(&error)))),
        Err(_) => (Vec::new(), Some("grok-sync-timeout".into())),
    };

    tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        commit_engine_rows(
            &connection,
            "grok",
            &workspace_path,
            rows,
            &fingerprint,
            partial,
        )
    })
    .await
    .ok()
    .and_then(|result| result.ok())
    .unwrap_or_else(|| WriterResult {
        engines: vec!["grok".into()],
        partial_source: Some("grok-commit-error".into()),
        skipped_fresh: false,
        ..WriterResult::default()
    })
}

async fn sync_pi_engine(workspace_path: PathBuf, limit: usize, force: bool) -> WriterResult {
    let fingerprint = pi_home_fingerprint();
    let skip = !force
        && tokio::task::spawn_blocking({
            let workspace_path = workspace_path.clone();
            let fingerprint = fingerprint.clone();
            move || {
                let connection = open_connection()?;
                engine_source_is_fresh(&connection, "pi", &workspace_path, &fingerprint)
            }
        })
        .await
        .ok()
        .and_then(|result| result.ok())
        .unwrap_or(false);
    if skip {
        return WriterResult {
            skipped_fresh: true,
            engines: vec!["pi".into()],
            ..WriterResult::default()
        };
    }

    let list_result = timeout(
        ASYNC_ENGINE_LIST_TIMEOUT,
        list_pi_sessions(&workspace_path, Some(limit), None),
    )
    .await;

    let (rows, partial) = match list_result {
        Ok(Ok(sessions)) => (rows_from_pi_summaries(&workspace_path, &sessions), None),
        Ok(Err(error)) => (Vec::new(), Some(format!("pi-sync-error:{}", truncate_error(&error)))),
        Err(_) => (Vec::new(), Some("pi-sync-timeout".into())),
    };

    tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        commit_engine_rows(
            &connection,
            "pi",
            &workspace_path,
            rows,
            &fingerprint,
            partial,
        )
    })
    .await
    .ok()
    .and_then(|result| result.ok())
    .unwrap_or_else(|| WriterResult {
        engines: vec!["pi".into()],
        partial_source: Some("pi-commit-error".into()),
        skipped_fresh: false,
        ..WriterResult::default()
    })
}

async fn sync_opencode_engine(
    state: &AppState,
    workspace_id: &str,
    workspace_path: PathBuf,
    limit: usize,
    force: bool,
) -> WriterResult {
    let fingerprint = opencode_source_fingerprint(&workspace_path);
    let skip = !force
        && tokio::task::spawn_blocking({
            let workspace_path = workspace_path.clone();
            let fingerprint = fingerprint.clone();
            move || {
                let connection = open_connection()?;
                engine_source_is_fresh(&connection, "opencode", &workspace_path, &fingerprint)
            }
        })
        .await
        .ok()
        .and_then(|result| result.ok())
        .unwrap_or(false);
    if skip {
        return WriterResult {
            skipped_fresh: true,
            engines: vec!["opencode".into()],
            ..WriterResult::default()
        };
    }

    // Soft path: never block sidebar on OpenCode CLI; empty + partial on failure.
    let list_result: Result<
        Result<Vec<crate::engine::OpenCodeSessionEntry>, String>,
        tokio::time::error::Elapsed,
    > = timeout(
        OPENCODE_INDEX_TIMEOUT,
        opencode_session_list_core(&state.workspaces, &state.engine_manager, workspace_id),
    )
    .await;

    let (rows, partial) = match list_result {
        Ok(Ok(mut entries)) => {
            entries.truncate(limit);
            (
                rows_from_opencode_entries(&workspace_path, &entries),
                None,
            )
        }
        Ok(Err(error)) => {
            // Missing CLI / disabled engine is soft-empty, not hard failure.
            let message = error.to_ascii_lowercase();
            let soft = message.contains("not found")
                || message.contains("disabled")
                || message.contains("not installed")
                || message.contains("no such file");
            (
                Vec::new(),
                if soft {
                    Some("opencode-unavailable".into())
                } else {
                    Some(format!("opencode-sync-error:{}", truncate_error(&error)))
                },
            )
        }
        Err(_) => (Vec::new(), Some("opencode-sync-timeout".into())),
    };

    tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        commit_engine_rows(
            &connection,
            "opencode",
            &workspace_path,
            rows,
            &fingerprint,
            partial,
        )
    })
    .await
    .ok()
    .and_then(|result| result.ok())
    .unwrap_or_else(|| WriterResult {
        engines: vec!["opencode".into()],
        partial_source: Some("opencode-commit-error".into()),
        skipped_fresh: false,
        ..WriterResult::default()
    })
}

async fn sync_session_index_core(
    state: &AppState,
    workspace_id: &str,
    limit: usize,
    force: bool,
) -> Result<SessionIndexSyncReport, String> {
    let started = Instant::now();
    let (_path_str, workspace_path) = resolve_workspace_path_async(state, workspace_id).await?;
    let sessions_roots = {
        let workspaces = state.workspaces.lock().await;
        resolve_sessions_roots(&workspaces, Some(workspace_path.as_path()))
    };

    // Disk-bound engines first (blocking pool), then bounded async engine lists.
    let mut aggregated = sync_disk_engines(
        workspace_path.clone(),
        sessions_roots,
        limit,
        force,
    )
    .await?;

    let (gemini, grok, pi) = tokio::join!(
        sync_gemini_engine(workspace_path.clone(), limit, force),
        sync_grok_engine(workspace_path.clone(), limit, force),
        sync_pi_engine(workspace_path.clone(), limit, force),
    );
    merge_writer(&mut aggregated, gemini);
    merge_writer(&mut aggregated, grok);
    merge_writer(&mut aggregated, pi);

    let opencode =
        sync_opencode_engine(state, workspace_id, workspace_path.clone(), limit, force).await;
    merge_writer(&mut aggregated, opencode);

    Ok(SessionIndexSyncReport {
        upserted: aggregated.upserted,
        engines: aggregated.engines,
        duration_ms: started.elapsed().as_millis() as u64,
        partial_source: aggregated.partial_source,
        skipped_fresh: aggregated.skipped_fresh,
    })
}

/// Sync light indexes for all supported engines into SQLite.
#[tauri::command]
pub async fn sync_session_index_for_workspace(
    workspace_id: String,
    limit: Option<u32>,
    force: Option<bool>,
    state: State<'_, AppState>,
) -> Result<SessionIndexSyncReport, String> {
    let force = force.unwrap_or(false);
    let limit = limit
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_SIDEBAR_INDEX_LIMIT)
        .clamp(1, 500);
    sync_session_index_core(&state, &workspace_id, limit, force).await
}

/// Soft-invalidate workspace sources so next list/sync rescans (CLI create path).
#[tauri::command]
pub async fn invalidate_session_index_for_workspace(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    let (_path_str, workspace_path) = resolve_workspace_path_async(&state, &workspace_id).await?;
    let changed = tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        invalidate_workspace_sources(&connection, &workspace_path)
    })
    .await
    .map_err(|error| error.to_string())??;
    Ok(changed as u32)
}

/// List sidebar sessions from SQLite. Optionally sync first when stale/empty.
#[tauri::command]
pub async fn list_session_index_for_workspace(
    workspace_id: String,
    limit: Option<u32>,
    sync_if_needed: Option<bool>,
    force_sync: Option<bool>,
    state: State<'_, AppState>,
) -> Result<SessionIndexListPage, String> {
    let started = Instant::now();
    let limit = limit
        .map(|value| value as usize)
        .unwrap_or(DEFAULT_SIDEBAR_INDEX_LIMIT)
        .clamp(1, 500);
    let sync_if_needed = sync_if_needed.unwrap_or(true);
    let force_sync = force_sync.unwrap_or(false);
    let (path_str, _workspace_path) = resolve_workspace_path_async(&state, &workspace_id).await?;

    let mut synced = false;
    let mut sync_ms = None;
    let mut partial_source = None;
    let mut engines = Vec::new();

    if sync_if_needed || force_sync {
        let path_for_check = path_str.clone();
        let index_empty = force_sync
            || tokio::task::spawn_blocking(move || {
                let connection = open_connection()?;
                let existing = list_for_workspace_path(&connection, &path_for_check, 1)?;
                Ok::<bool, String>(existing.is_empty())
            })
            .await
            .map_err(|error| error.to_string())??;
        // Warm first-paint must hit SQLite in milliseconds. Do not block the
        // list on PI/Gemini/Grok rescan — that exceeds the 2.5s first-paint
        // timeout and the sidebar keeps last-good without native PI rows.
        // Incremental rescan belongs to forceSessionIndexSync.
        if force_sync || index_empty {
            let report = sync_session_index_core(&state, &workspace_id, limit, force_sync).await?;
            synced = !report.skipped_fresh || index_empty;
            sync_ms = Some(report.duration_ms);
            partial_source = report.partial_source;
            engines = report.engines;
        }
    }

    let path_for_list = path_str.clone();
    let data = tokio::task::spawn_blocking(move || {
        let connection = open_connection()?;
        list_for_workspace_path(&connection, &path_for_list, limit)
    })
    .await
    .map_err(|error| error.to_string())??;

    if engines.is_empty() {
        let mut seen = std::collections::HashSet::new();
        for row in &data {
            if seen.insert(row.engine.clone()) {
                engines.push(row.engine.clone());
            }
        }
    }

    let event_log_path = state
        .storage_path
        .parent()
        .map(|parent| parent.join("shared-event-log-v2.sqlite3"));
    let visibility = super::shared_visibility::load_shared_native_visibility_projection(
        &workspace_id,
        event_log_path.as_deref(),
        &data,
    );

    Ok(SessionIndexListPage {
        data,
        source: if synced {
            "session-index+sync".into()
        } else {
            "session-index".into()
        },
        synced,
        sync_ms: sync_ms.or_else(|| Some(started.elapsed().as_millis() as u64)),
        engines,
        partial_source,
        visibility: Some(visibility),
    })
}

fn truncate_error(error: &str) -> String {
    let trimmed = error.trim();
    if trimmed.chars().count() <= 120 {
        return trimmed.to_string();
    }
    trimmed.chars().take(119).collect::<String>() + "…"
}
