use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::remote_backend;
use crate::state::AppState;

use super::remote_bridge::call_remote_typed;
use super::EngineType;

pub(super) fn remote_delete_claude_session_request(
    workspace_path: String,
    session_id: String,
) -> (&'static str, Value) {
    (
        "delete_claude_session",
        json!({
            "workspacePath": crate::remote_backend::normalize_path_for_remote(workspace_path),
            "sessionId": session_id,
        }),
    )
}

pub(super) fn remote_delete_gemini_session_request(
    workspace_path: String,
    session_id: String,
) -> (&'static str, Value) {
    (
        "delete_gemini_session",
        json!({
            "workspacePath": crate::remote_backend::normalize_path_for_remote(workspace_path),
            "sessionId": session_id,
        }),
    )
}

pub(super) fn remote_delete_kimi_session_request(
    workspace_path: String,
    session_id: String,
) -> (&'static str, Value) {
    (
        "delete_kimi_session",
        json!({
            "workspacePath": crate::remote_backend::normalize_path_for_remote(workspace_path),
            "sessionId": session_id,
        }),
    )
}

pub(super) fn remote_delete_grok_session_request(
    workspace_path: String,
    session_id: String,
) -> (&'static str, Value) {
    (
        "delete_grok_session",
        json!({
            "workspacePath": crate::remote_backend::normalize_path_for_remote(workspace_path),
            "sessionId": session_id,
        }),
    )
}

/// List Claude Code session history for a workspace path.
/// Reads JSONL files from `<effective-claude-home>/projects/{encoded-path}/`.
#[tauri::command]
pub async fn list_claude_sessions(
    workspace_path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "list_claude_sessions",
            json!({ "workspacePath": workspace_path, "limit": limit }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let sessions = state
        .engine_manager
        .list_claude_history_sessions(&path, limit)
        .await?;
    serde_json::to_value(sessions).map_err(|error| error.to_string())
}

/// Load full message history for a specific Claude Code session.
#[tauri::command]
pub async fn load_claude_session(
    workspace_path: String,
    session_id: String,
    limit: Option<usize>,
    before: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "load_claude_session",
            json!({
                "workspacePath": workspace_path,
                "sessionId": session_id,
                "limit": limit,
                "before": before,
            }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let result = state
        .engine_manager
        .load_claude_history_session(&path, &session_id, limit, before.as_deref())
        .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Load one deferred Claude history image by locator.
#[tauri::command]
pub async fn hydrate_claude_deferred_image(
    workspace_path: String,
    locator: Value,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "hydrate_claude_deferred_image",
            json!({ "workspacePath": workspace_path, "locator": locator }),
        )
        .await;
    }
    let locator = serde_json::from_value(locator)
        .map_err(|error| format!("Invalid Claude deferred image locator: {error}"))?;
    let path = std::path::PathBuf::from(&workspace_path);
    let result = state
        .engine_manager
        .hydrate_claude_history_image(&path, locator)
        .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Fork a Claude Code session by cloning its JSONL history into a new session id.
#[tauri::command]
pub async fn fork_claude_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "fork_claude_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let forked_session_id = state
        .engine_manager
        .fork_claude_history_session(&path, &session_id)
        .await?;
    Ok(json!({
        "thread": {
            "id": format!("claude:{}", forked_session_id)
        },
        "sessionId": forked_session_id
    }))
}

/// Delete a Claude Code session (remove JSONL file from disk).
#[tauri::command]
pub async fn delete_claude_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        let (method, params) = remote_delete_claude_session_request(workspace_path, session_id);
        let _: Value = call_remote_typed(&*state, &app, method, params).await?;
        return Ok(());
    }
    let path = std::path::PathBuf::from(&workspace_path);
    state
        .engine_manager
        .delete_claude_history_session(&path, &session_id)
        .await
}

/// List Gemini CLI session history for a workspace path.
#[tauri::command]
pub async fn list_gemini_sessions(
    workspace_path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "list_gemini_sessions",
            json!({ "workspacePath": workspace_path, "limit": limit }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Gemini)
        .await;
    let sessions = super::gemini_history::list_gemini_sessions(
        &path,
        limit,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(sessions).map_err(|error| error.to_string())
}

/// Load full message history for a specific Gemini CLI session.
#[tauri::command]
pub async fn load_gemini_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "load_gemini_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Gemini)
        .await;
    let result = super::gemini_history::load_gemini_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Delete a Gemini CLI session.
#[tauri::command]
pub async fn delete_gemini_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        let (method, params) = remote_delete_gemini_session_request(workspace_path, session_id);
        let _: Value = call_remote_typed(&*state, &app, method, params).await?;
        return Ok(());
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Gemini)
        .await;
    super::gemini_history::delete_gemini_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await
}

/// List Kimi CLI session history for a workspace path.
#[tauri::command]
pub async fn list_kimi_sessions(
    workspace_path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "list_kimi_sessions",
            json!({ "workspacePath": workspace_path, "limit": limit }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Kimi)
        .await;
    let sessions = super::kimi_history::list_kimi_sessions(
        &path,
        limit,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(sessions).map_err(|error| error.to_string())
}

/// Load full message history for a specific Kimi CLI session.
#[tauri::command]
pub async fn load_kimi_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "load_kimi_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Kimi)
        .await;
    let result = super::kimi_history::load_kimi_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Delete a Kimi CLI session (remove session dir + index entry).
#[tauri::command]
pub async fn delete_kimi_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        let (method, params) = remote_delete_kimi_session_request(workspace_path, session_id);
        let _: Value = call_remote_typed(&*state, &app, method, params).await?;
        return Ok(());
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Kimi)
        .await;
    super::kimi_history::delete_kimi_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await
}

/// List PI CLI session history for a workspace path.
#[tauri::command]
pub async fn list_pi_sessions(
    workspace_path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "list_pi_sessions",
            json!({ "workspacePath": workspace_path, "limit": limit }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Pi)
        .await;
    let sessions = super::pi_history::list_pi_sessions(
        &path,
        limit,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(sessions).map_err(|error| error.to_string())
}

/// Load full message history for a specific PI CLI session.
#[tauri::command]
pub async fn load_pi_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "load_pi_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Pi)
        .await;
    let result = super::pi_history::load_pi_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Delete a PI CLI session file.
#[tauri::command]
pub async fn delete_pi_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        let _: Value = call_remote_typed(
            &*state,
            &app,
            "delete_pi_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await?;
        return Ok(());
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Pi)
        .await;
    super::pi_history::delete_pi_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await
}

/// List Grok CLI session history for a workspace path.
#[tauri::command]
pub async fn list_grok_sessions(
    workspace_path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "list_grok_sessions",
            json!({ "workspacePath": workspace_path, "limit": limit }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Grok)
        .await;
    let sessions = super::grok_history::list_grok_sessions(
        &path,
        limit,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(sessions).map_err(|error| error.to_string())
}

/// Load full message history for a specific Grok CLI session.
#[tauri::command]
pub async fn load_grok_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if remote_backend::is_remote_mode(&*state).await {
        let workspace_path = remote_backend::normalize_path_for_remote(workspace_path);
        return remote_backend::call_remote(
            &*state,
            app,
            "load_grok_session",
            json!({ "workspacePath": workspace_path, "sessionId": session_id }),
        )
        .await;
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Grok)
        .await;
    let result = super::grok_history::load_grok_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

/// Delete a Grok CLI session (remove session dir).
#[tauri::command]
pub async fn delete_grok_session(
    workspace_path: String,
    session_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(&*state).await {
        let (method, params) = remote_delete_grok_session_request(workspace_path, session_id);
        let _: Value = call_remote_typed(&*state, &app, method, params).await?;
        return Ok(());
    }
    let path = std::path::PathBuf::from(&workspace_path);
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Grok)
        .await;
    super::grok_history::delete_grok_session(
        &path,
        &session_id,
        config.as_ref().and_then(|item| item.home_dir.as_deref()),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{
        remote_delete_claude_session_request, remote_delete_gemini_session_request,
        remote_delete_grok_session_request, remote_delete_kimi_session_request,
    };
    use serde_json::json;

    #[test]
    fn remote_delete_claude_session_request_normalizes_workspace_path() {
        let (method, params) = remote_delete_claude_session_request(
            "\\\\wsl$\\Ubuntu\\home\\demo\\repo".to_string(),
            "claude-session-1".to_string(),
        );

        assert_eq!(method, "delete_claude_session");
        assert_eq!(
            params,
            json!({
                "workspacePath": "/home/demo/repo",
                "sessionId": "claude-session-1",
            })
        );
    }

    #[test]
    fn remote_delete_gemini_session_request_normalizes_workspace_path() {
        let (method, params) = remote_delete_gemini_session_request(
            "\\\\wsl$\\Ubuntu\\home\\demo\\repo".to_string(),
            "gemini-session-1".to_string(),
        );

        assert_eq!(method, "delete_gemini_session");
        assert_eq!(
            params,
            json!({
                "workspacePath": "/home/demo/repo",
                "sessionId": "gemini-session-1",
            })
        );
    }

    #[test]
    fn remote_delete_kimi_session_request_normalizes_workspace_path() {
        let (method, params) = remote_delete_kimi_session_request(
            "\\\\wsl$\\Ubuntu\\home\\demo\\repo".to_string(),
            "session_kimi-1".to_string(),
        );

        assert_eq!(method, "delete_kimi_session");
        assert_eq!(
            params,
            json!({
                "workspacePath": "/home/demo/repo",
                "sessionId": "session_kimi-1",
            })
        );
    }

    #[test]
    fn remote_delete_grok_session_request_normalizes_workspace_path() {
        let (method, params) = remote_delete_grok_session_request(
            "\\\\wsl$\\Ubuntu\\home\\demo\\repo".to_string(),
            "019fa245-0000-4000-8000-000000000001".to_string(),
        );

        assert_eq!(method, "delete_grok_session");
        assert_eq!(
            params,
            json!({
                "workspacePath": "/home/demo/repo",
                "sessionId": "019fa245-0000-4000-8000-000000000001",
            })
        );
    }
}
