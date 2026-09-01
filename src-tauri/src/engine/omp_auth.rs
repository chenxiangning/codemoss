use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tokio::process::Command;

use crate::engine::EngineType;
use crate::remote_backend;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpAuthBrokerStatus {
    pub state: String,
    pub configured: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpAuthBrokerProvider {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OmpLocalAccount {
    pub provider: String,
    pub credential_type: String,
    pub identity: Option<String>,
    pub disabled_cause: Option<String>,
    pub updated_at: Option<i64>,
}

async fn omp_binary(state: &State<'_, AppState>) -> PathBuf {
    state
        .engine_manager
        .get_engine_config(EngineType::Omp)
        .await
        .and_then(|config| config.bin_path.map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("omp"))
}

async fn run_auth_broker(state: &State<'_, AppState>, args: &[&str]) -> Result<Value, String> {
    let binary = omp_binary(state).await;
    let output = Command::new(&binary)
        .args(["auth-broker"])
        .args(args)
        .output()
        .await
        .map_err(|error| format!("failed to run OMP auth-broker: {error}"))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if detail.is_empty() {
            format!("OMP auth-broker exited with {}", output.status)
        } else {
            detail
        });
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("OMP auth-broker returned invalid JSON: {error}"))
}

#[tauri::command]
pub async fn omp_auth_broker_status(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<OmpAuthBrokerStatus, String> {
    if remote_backend::is_remote_mode(&state).await {
        return Err("OMP auth-broker status is local-only".to_string());
    }
    let value = run_auth_broker(&state, &["status", "--json"]).await?;
    let configured = value.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let reason = value
        .get("reason")
        .and_then(Value::as_str)
        .map(str::to_string);
    let _ = app;
    Ok(OmpAuthBrokerStatus {
        state: if configured {
            "configured".to_string()
        } else {
            "not-configured".to_string()
        },
        configured,
        reason,
    })
}

#[tauri::command]
pub async fn omp_auth_broker_list_providers(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<OmpAuthBrokerProvider>, String> {
    if remote_backend::is_remote_mode(&state).await {
        return Err("OMP auth-broker providers are local-only".to_string());
    }
    let value = run_auth_broker(&state, &["list", "--json"]).await?;
    let providers = value
        .as_array()
        .ok_or_else(|| "OMP auth-broker provider response must be an array".to_string())?
        .iter()
        .filter_map(|item| {
            Some(OmpAuthBrokerProvider {
                id: item.get("id")?.as_str()?.to_string(),
                name: item.get("name")?.as_str()?.to_string(),
            })
        })
        .collect();
    let _ = app;
    Ok(providers)
}

/// 读取 OMP 本地登录态（`~/.omp/agent/agent.db` 的 `auth_credentials`）。
///
/// `omp auth-broker status` 只反映远程凭据保险库（vault serve），本地
/// `omp` 登录（source: login / OAuth）不经过它，因此 UI 需要单独的本地
/// 账号投影。此处只取展示元数据列，绝不 SELECT `data`（token/key 永不
/// 离开后端）。schema 变化 / 无 db 时返回 Err，由前端降级为空态。
#[tauri::command]
pub async fn omp_auth_local_accounts(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<OmpLocalAccount>, String> {
    if remote_backend::is_remote_mode(&state).await {
        return Err("OMP local accounts are local-only".to_string());
    }
    let custom_bin = state
        .engine_manager
        .get_engine_config(EngineType::Omp)
        .await
        .and_then(|config| config.bin_path);
    let _ = app;
    tauri::async_runtime::spawn_blocking(move || read_omp_local_accounts(custom_bin.as_deref()))
        .await
        .map_err(|error| format!("OMP local account probe failed: {error}"))?
}

fn omp_agent_db_path(custom_bin: Option<&str>) -> Result<PathBuf, String> {
    // OMP 的 `--profile` 会把 agent 目录隔离到 profile 子目录；自定义 binary
    // 同名目录约定不变。默认只投影主 profile（与 omp 默认运行态一致）。
    let _ = custom_bin;
    let home = dirs::home_dir().ok_or_else(|| "cannot resolve home directory".to_string())?;
    Ok(home.join(".omp").join("agent").join("agent.db"))
}

fn read_omp_local_accounts(custom_bin: Option<&str>) -> Result<Vec<OmpLocalAccount>, String> {
    let db_path = omp_agent_db_path(custom_bin)?;
    if !db_path.exists() {
        return Err("OMP agent database not found (is OMP CLI installed?)".to_string());
    }
    let connection =
        rusqlite::Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| format!("failed to open OMP agent database: {error}"))?;
    let mut statement = connection
        .prepare(
            "SELECT provider, credential_type, identity_key, disabled_cause, updated_at
             FROM auth_credentials
             ORDER BY provider, id",
        )
        .map_err(|error| format!("OMP agent database schema changed: {error}"))?;
    let accounts = statement
        .query_map([], |row| {
            let identity_key = row.get::<_, Option<String>>(2)?;
            Ok(OmpLocalAccount {
                provider: row.get::<_, String>(0)?.trim().to_string(),
                credential_type: row.get::<_, String>(1)?.trim().to_string(),
                identity: identity_key.as_deref().and_then(normalize_omp_identity),
                disabled_cause: row
                    .get::<_, Option<String>>(3)?
                    .filter(|value| !value.trim().is_empty()),
                updated_at: row.get(4).ok(),
            })
        })
        .map_err(|error| format!("OMP agent database schema changed: {error}"))?
        .filter_map(|row| row.ok())
        .filter(|account| !account.provider.is_empty())
        .collect();
    Ok(accounts)
}

/// `identity_key` 形如 `email:a@b|org:xxx`；取首个可读片段作为展示身份。
fn normalize_omp_identity(identity_key: &str) -> Option<String> {
    identity_key
        .split('|')
        .map(str::trim)
        .find(|segment| !segment.is_empty())
        .map(|segment| match segment.split_once(':') {
            Some(("email", value)) => value.to_string(),
            _ => segment.to_string(),
        })
}
