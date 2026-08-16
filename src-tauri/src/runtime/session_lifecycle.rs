use std::collections::HashMap;
use std::sync::Arc;

use tokio::process::Child;
use tokio::sync::Mutex;
#[cfg(unix)]
use tokio::time::{sleep, Duration};

use crate::backend::app_server::{RuntimeShutdownSource, WorkspaceSession};
use crate::state::AppState;

use super::{RuntimeManager, RuntimeReplacementGate, TERMINATE_GRACE_MILLIS};

pub(crate) async fn terminate_workspace_session_process(child: &mut Child) -> Result<bool, String> {
    #[cfg(unix)]
    {
        if let Some(pid) = child.id() {
            let process_group_id = pid as libc::pid_t;
            let terminate_status = unsafe { libc::kill(-process_group_id, libc::SIGTERM) };
            if terminate_status == 0 {
                sleep(Duration::from_millis(TERMINATE_GRACE_MILLIS)).await;
            }
            let kill_status = unsafe { libc::kill(-process_group_id, libc::SIGKILL) };
            if kill_status == 0 {
                child.wait().await.map_err(|error| {
                    format!("failed to reap process group leader pid {pid}: {error}")
                })?;
                return Ok(true);
            }
            let kill_error = std::io::Error::last_os_error();
            for _ in 0..20 {
                let group_probe = unsafe { libc::kill(-process_group_id, 0) };
                let group_gone = group_probe != 0
                    && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH);
                let root_exited = match child.try_wait() {
                    Ok(Some(_)) => true,
                    Ok(None) => false,
                    Err(error) => {
                        return Err(format!(
                            "failed to verify process group leader pid {pid} after group cleanup: {error}"
                        ));
                    }
                };
                if group_gone && root_exited {
                    return Ok(false);
                }
                sleep(Duration::from_millis(10)).await;
            }
            let root_fallback = match child.kill().await {
                Ok(()) => match child.wait().await {
                    Ok(_) => "root killed and reaped by fallback".to_string(),
                    Err(error) => format!("root fallback reap failed: {error}"),
                },
                Err(error) => format!("root fallback kill failed: {error}"),
            };
            return Err(format!(
                "failed to terminate process group for pid {pid} ({kill_error}; {root_fallback}); descendant cleanup is unverified"
            ));
        }
    }

    #[cfg(windows)]
    {
        if let Some(pid) = child.id() {
            let mut taskkill = crate::utils::async_command("taskkill");
            taskkill
                .arg("/PID")
                .arg(pid.to_string())
                .arg("/T")
                .arg("/F");
            let output =
                tokio::time::timeout(std::time::Duration::from_secs(10), taskkill.output())
                    .await
                    .map_err(|_| format!("taskkill timed out for pid {pid} after 10 seconds"))?
                    .map_err(|error| format!("taskkill failed for pid {pid}: {error}"))?;
            if output.status.success() {
                child
                    .wait()
                    .await
                    .map_err(|error| format!("failed to reap taskkill pid {pid}: {error}"))?;
                return Ok(true);
            }
            let taskkill_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let root_fallback = match child.try_wait() {
                Ok(Some(_)) => "root already exited".to_string(),
                Ok(None) => match child.kill().await {
                    Ok(()) => match child.wait().await {
                        Ok(_) => "root killed and reaped by fallback".to_string(),
                        Err(error) => format!("root fallback reap failed: {error}"),
                    },
                    Err(error) => format!("root fallback kill failed: {error}"),
                },
                Err(error) => format!("root status check failed: {error}"),
            };
            return Err(format!(
                "taskkill failed for pid {pid} with status {} ({root_fallback}); descendant cleanup is unverified: {}",
                output.status,
                if taskkill_error.is_empty() {
                    "no taskkill stderr"
                } else {
                    taskkill_error.as_str()
                }
            ));
        }
    }

    let pid = child.id();
    child
        .kill()
        .await
        .map_err(|error| format!("Failed to kill process pid {pid:?}: {error}"))?;
    child
        .wait()
        .await
        .map_err(|error| format!("Failed to reap process pid {pid:?}: {error}"))?;
    Ok(true)
}

pub(super) async fn close_runtime(
    state: &AppState,
    engine: &str,
    workspace_id: &str,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    match engine {
        "claude" => stop_claude_workspace_session(state, workspace_id).await,
        _ => {
            stop_workspace_session_with_source(
                &state.sessions,
                &state.runtime_manager,
                workspace_id,
                shutdown_source,
            )
            .await
        }
    }
}

pub(super) async fn evict_runtime(
    state: &AppState,
    engine: &str,
    workspace_id: &str,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    match engine {
        "claude" => stop_claude_workspace_session(state, workspace_id).await,
        _ => {
            evict_workspace_session(
                &state.sessions,
                &state.runtime_manager,
                workspace_id,
                shutdown_source,
            )
            .await
        }
    }
}

async fn stop_claude_workspace_session(state: &AppState, workspace_id: &str) -> Result<(), String> {
    state
        .runtime_manager
        .record_stopping("claude", workspace_id)
        .await;
    let sessions = state
        .engine_manager
        .claude_runtime_sessions_for_workspace(workspace_id)
        .await;
    let mut failures = Vec::new();
    for (runtime_key, session) in sessions {
        match session.interrupt().await {
            Ok(()) => {
                session.mark_disposed();
                state
                    .engine_manager
                    .remove_claude_runtime_session(&runtime_key)
                    .await;
            }
            Err(error) => failures.push(format!("{runtime_key}: {error}")),
        }
    }
    if !failures.is_empty() {
        return Err(format!(
            "Failed to stop {} Claude runtime(s) for workspace {}: {}",
            failures.len(),
            workspace_id,
            failures.join("; ")
        ));
    }
    state
        .runtime_manager
        .record_removed("claude", workspace_id)
        .await;
    Ok(())
}

pub(crate) async fn terminate_workspace_session(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
) -> Result<(), String> {
    terminate_workspace_session_with_shutdown_source(
        session,
        runtime_manager,
        RuntimeShutdownSource::CompatibilityManual,
    )
    .await
}

pub(crate) async fn terminate_workspace_session_with_source(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    terminate_workspace_session_with_shutdown_source(session, runtime_manager, shutdown_source)
        .await
}

async fn terminate_workspace_session_for_eviction(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    terminate_workspace_session_with_shutdown_source(session, runtime_manager, shutdown_source)
        .await
}

async fn terminate_workspace_session_with_shutdown_source(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    let workspace_id = session.entry.id.clone();
    session.mark_shutdown_requested(shutdown_source);
    if let Some(runtime_manager) = runtime_manager {
        if runtime_manager
            .has_active_work_protection_for_session(
                "codex",
                &workspace_id,
                session.process_id,
                Some(session.started_at_ms),
            )
            .await
        {
            session.mark_shutdown_had_active_work_protection();
        }
        runtime_manager
            .lifecycle_coordinator()
            .record_stopping("codex", &workspace_id)
            .await;
    }
    let forced = {
        let mut child = session.child.lock().await;
        terminate_workspace_session_process(&mut child).await?
    };
    if forced {
        if let Some(runtime_manager) = runtime_manager {
            runtime_manager
                .note_force_kill_for_runtime("codex", &workspace_id)
                .await;
        }
    }
    if let Some(runtime_manager) = runtime_manager {
        runtime_manager.record_removed("codex", &workspace_id).await;
    }
    Ok(())
}

#[cfg(test)]
pub(crate) async fn terminate_replaced_workspace_session(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
) -> Result<(), String> {
    terminate_replaced_workspace_session_with_source(
        session,
        runtime_manager,
        RuntimeShutdownSource::InternalReplacement,
    )
    .await
}

async fn terminate_replaced_workspace_session_with_source(
    session: Arc<WorkspaceSession>,
    runtime_manager: Option<&RuntimeManager>,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    let workspace_id = session.entry.id.clone();
    session.mark_shutdown_requested(shutdown_source);
    let forced = {
        let mut child = session.child.lock().await;
        terminate_workspace_session_process(&mut child).await?
    };
    if let Some(runtime_manager) = runtime_manager {
        if forced {
            runtime_manager
                .note_force_kill_for_runtime("codex", &workspace_id)
                .await;
        }
        runtime_manager
            .clear_stopping_predecessor("codex", &workspace_id, "replacement-stop")
            .await;
    }
    Ok(())
}

async fn rollback_replaced_workspace_session(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: Option<&RuntimeManager>,
    workspace_id: &str,
    previous_session: Arc<WorkspaceSession>,
    replacement_session: Arc<WorkspaceSession>,
) -> Result<(), String> {
    {
        let mut sessions_guard = sessions.lock().await;
        let should_restore_previous = sessions_guard
            .get(workspace_id)
            .map(|current| Arc::ptr_eq(current, &replacement_session))
            .unwrap_or(false);
        if should_restore_previous {
            sessions_guard.insert(workspace_id.to_string(), Arc::clone(&previous_session));
        }
    }

    let forced = {
        replacement_session.mark_shutdown_requested(RuntimeShutdownSource::InternalReplacement);
        let mut child = replacement_session.child.lock().await;
        terminate_workspace_session_process(&mut child).await?
    };
    if forced {
        if let Some(runtime_manager) = runtime_manager {
            runtime_manager
                .note_force_kill_for_runtime("codex", workspace_id)
                .await;
        }
    }
    if let Some(runtime_manager) = runtime_manager {
        runtime_manager
            .lifecycle_coordinator()
            .record_active(&previous_session, "replacement-rollback")
            .await;
    }
    Ok(())
}

pub(crate) async fn replace_workspace_session(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: Option<&RuntimeManager>,
    workspace_id: String,
    new_session: Arc<WorkspaceSession>,
    lease_source: &str,
) -> Result<(), String> {
    replace_workspace_session_with_source(
        sessions,
        runtime_manager,
        workspace_id,
        new_session,
        lease_source,
        RuntimeShutdownSource::InternalReplacement,
    )
    .await
}

pub(crate) async fn replace_workspace_session_with_source(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: Option<&RuntimeManager>,
    workspace_id: String,
    new_session: Arc<WorkspaceSession>,
    lease_source: &str,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    replace_workspace_session_with_terminator(
        sessions,
        runtime_manager,
        workspace_id,
        new_session,
        lease_source,
        |session, runtime_manager| {
            Box::pin(async move {
                terminate_replaced_workspace_session_with_source(
                    session,
                    runtime_manager,
                    shutdown_source,
                )
                .await
            })
        },
        shutdown_source,
    )
    .await
}

pub(crate) async fn replace_workspace_session_with_terminator<Terminator>(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: Option<&RuntimeManager>,
    workspace_id: String,
    new_session: Arc<WorkspaceSession>,
    lease_source: &str,
    terminate_replaced: Terminator,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String>
where
    Terminator: for<'a> FnOnce(
            Arc<WorkspaceSession>,
            Option<&'a RuntimeManager>,
        ) -> std::pin::Pin<
            Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>,
        > + Send,
{
    let replacement_token = if let Some(runtime_manager) = runtime_manager {
        match runtime_manager
            .begin_runtime_replacement("codex", &workspace_id)
            .await
        {
            RuntimeReplacementGate::Leader(token) => {
                runtime_manager
                    .note_guard_event("codex", &workspace_id, lease_source, "replacement-leader")
                    .await;
                Some(token)
            }
            RuntimeReplacementGate::Waiter(notify) => {
                runtime_manager
                    .note_guard_event("codex", &workspace_id, lease_source, "replacement-waiter")
                    .await;
                notify.notified().await;
                let active_session_exists = {
                    let sessions_guard = sessions.lock().await;
                    sessions_guard.contains_key(&workspace_id)
                };
                terminate_workspace_session_with_source(
                    Arc::clone(&new_session),
                    None,
                    shutdown_source,
                )
                .await?;
                if active_session_exists {
                    return Ok(());
                }
                return Err(format!(
                    "replacement settled without an active runtime for workspace {workspace_id}",
                ));
            }
        }
    } else {
        None
    };

    let old_session = sessions
        .lock()
        .await
        .insert(workspace_id.clone(), Arc::clone(&new_session));
    let result = if let Some(old_session) = old_session {
        if let Some(runtime_manager) = runtime_manager {
            runtime_manager
                .note_replacement_started(&new_session, lease_source, true)
                .await;
        }
        if let Err(error) = terminate_replaced(Arc::clone(&old_session), runtime_manager).await {
            if let Err(rollback_error) = rollback_replaced_workspace_session(
                sessions,
                runtime_manager,
                &workspace_id,
                old_session,
                new_session,
            )
            .await
            {
                Err(format!(
                    "failed to stop replaced workspace session for {workspace_id}: {error}; replacement rollback failed: {rollback_error}",
                ))
            } else {
                Err(format!(
                    "failed to stop replaced workspace session for {workspace_id}: {error}",
                ))
            }
        } else {
            if let Some(runtime_manager) = runtime_manager {
                runtime_manager
                    .lifecycle_coordinator()
                    .record_active(&new_session, lease_source)
                    .await;
            }
            Ok(())
        }
    } else {
        if let Some(runtime_manager) = runtime_manager {
            runtime_manager
                .lifecycle_coordinator()
                .record_active(&new_session, lease_source)
                .await;
        }
        Ok(())
    };

    if let (Some(runtime_manager), Some(token)) = (runtime_manager, replacement_token.as_ref()) {
        runtime_manager.finish_runtime_replacement(token).await;
    }

    result
}

pub(crate) async fn stop_workspace_session(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: &RuntimeManager,
    workspace_id: &str,
) -> Result<(), String> {
    stop_workspace_session_with_source(
        sessions,
        runtime_manager,
        workspace_id,
        RuntimeShutdownSource::UserManualShutdown,
    )
    .await
}

pub(crate) async fn stop_workspace_session_with_source(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: &RuntimeManager,
    workspace_id: &str,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    let session = sessions.lock().await.remove(workspace_id);
    if let Some(session) = session {
        terminate_workspace_session_with_source(session, Some(runtime_manager), shutdown_source)
            .await?;
    } else {
        runtime_manager.record_removed("codex", workspace_id).await;
    }
    Ok(())
}

async fn evict_workspace_session(
    sessions: &Mutex<HashMap<String, Arc<WorkspaceSession>>>,
    runtime_manager: &RuntimeManager,
    workspace_id: &str,
    shutdown_source: RuntimeShutdownSource,
) -> Result<(), String> {
    let session = sessions.lock().await.remove(workspace_id);
    if let Some(session) = session {
        terminate_workspace_session_for_eviction(session, Some(runtime_manager), shutdown_source)
            .await?;
    } else {
        runtime_manager.record_removed("codex", workspace_id).await;
    }
    Ok(())
}
