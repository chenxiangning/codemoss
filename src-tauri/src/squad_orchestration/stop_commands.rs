use std::collections::HashSet;

use serde_json::{json, Value};
use tauri::State;

use crate::shared_event_log::canonical::types::{
    CanonicalFact, SquadCancelRequestedFact, SquadRunSettledFact,
};
use crate::shared_session_v2::{require_shared_session_workspace_owner, require_writer};
use crate::shared_sessions::{now_millis, parse_shared_session_id};
use crate::state::AppState;

use super::support::*;
use super::types::{SquadNodeKind, SquadProjectionV1, SquadRunStatus};

fn validate_interrupt_results(
    active_attempt_ids: &[String],
    interrupt_results: &[Value],
) -> Result<Option<String>, String> {
    let expected = active_attempt_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut first_error = None;
    for result in interrupt_results {
        let attempt_id = result
            .get("attemptId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "squad-stop-invalid-result: attemptId is required".to_string())?;
        if !expected.contains(attempt_id) || !seen.insert(attempt_id) {
            return Err(format!(
                "squad-stop-invalid-result: unexpected or duplicate owner {attempt_id}"
            ));
        }
        let status = result
            .get("status")
            .and_then(Value::as_str)
            .ok_or_else(|| "squad-stop-invalid-result: status is required".to_string())?;
        if !matches!(
            status,
            "interrupted" | "cancelled-before-dispatch" | "error"
        ) {
            return Err(format!(
                "squad-stop-invalid-result: unsupported status {status}"
            ));
        }
        if status == "error" && first_error.is_none() {
            first_error = Some(
                result
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("exact owner interrupt failed")
                    .to_string(),
            );
        }
    }
    if seen.len() != expected.len() {
        return Err(
            "squad-stop-invalid-result: exact active owner coverage is incomplete".to_string(),
        );
    }
    Ok(first_error)
}

#[tauri::command]
pub(crate) async fn shared_squad_cancel(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() || run.status == SquadRunStatus::Cancelling {
        return Ok(json!({
            "projection": run,
            "attemptIds": run.active_attempt_ids,
        }));
    }
    let requested_at = now_millis() as i64;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadCancelRequested(SquadCancelRequestedFact {
            fact_id: format!("squad:{run_id}:cancel"),
            run_id: run_id.clone(),
            reason: reason
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "user emergency stop".to_string()),
            requested_at,
            extra: empty_extra(),
        }),
    )?;
    let projection = require_run(writer, &session_id, &run_id)?;
    Ok(json!({
        "attemptIds": projection.active_attempt_ids,
        "projection": projection,
    }))
}

#[tauri::command]
pub(crate) async fn shared_squad_finalize_cancel(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    interrupt_results: Vec<Value>,
    state: State<'_, AppState>,
) -> Result<SquadProjectionV1, String> {
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() {
        return Ok(run);
    }
    if run.status != SquadRunStatus::Cancelling {
        return Err("squad-cancel-not-requested".to_string());
    }
    let settled_at = now_millis() as i64;
    let interrupt_error = validate_interrupt_results(&run.active_attempt_ids, &interrupt_results)?;
    let active_mutation = run.nodes.iter().find(|node| {
        node.node.kind == SquadNodeKind::Mutate
            && node
                .attempts
                .iter()
                .any(|attempt| run.active_attempt_ids.contains(&attempt.attempt_id))
    });
    if let Some(error) = interrupt_error {
        let reason = format!("squad-stop-owner-ambiguous: {error}");
        append_block_and_settle(writer, &run, None, &reason, settled_at)?;
        return require_run(writer, &session_id, &run_id);
    }
    if let Some(node) = active_mutation {
        let reason = format!(
            "squad-stop-ambiguous-mutation: node '{}' may have workspace side effects; lease remains held for explicit recovery",
            node.node.id
        );
        append_block_and_settle(writer, &run, Some(&node.node.id), &reason, settled_at)?;
        return require_run(writer, &session_id, &run_id);
    }
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadRunSettled(SquadRunSettledFact {
            fact_id: format!("squad:{run_id}:settled"),
            run_id: run_id.clone(),
            status: "cancelled".to_string(),
            summary: Some("Emergency Stop requested; no rollback was performed".to_string()),
            settled_at,
            extra: json!({"interruptResults": interrupt_results}),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stop_results_require_exact_owner_coverage() {
        let owners = vec!["attempt-a".to_string(), "attempt-b".to_string()];
        let valid = vec![
            json!({"attemptId": "attempt-a", "status": "interrupted"}),
            json!({"attemptId": "attempt-b", "status": "cancelled-before-dispatch"}),
        ];
        assert_eq!(validate_interrupt_results(&owners, &valid), Ok(None));

        let incomplete = vec![json!({"attemptId": "attempt-a", "status": "interrupted"})];
        assert!(validate_interrupt_results(&owners, &incomplete)
            .expect_err("missing owner must fail")
            .contains("coverage is incomplete"));

        let unexpected = vec![
            json!({"attemptId": "attempt-a", "status": "interrupted"}),
            json!({"attemptId": "attempt-x", "status": "interrupted"}),
        ];
        assert!(validate_interrupt_results(&owners, &unexpected)
            .expect_err("foreign owner must fail")
            .contains("unexpected or duplicate owner"));
    }
}
