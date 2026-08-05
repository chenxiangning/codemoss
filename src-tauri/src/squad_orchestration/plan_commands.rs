use serde_json::json;
use tauri::State;

use crate::shared_event_log::canonical::types::{
    CanonicalFact, OutcomeStatus, SquadPlanApprovedFact, SquadPlanProposedFact,
    SquadPlanRevisedFact,
};
use crate::shared_session_v2::{require_shared_session_workspace_owner, require_writer};
use crate::shared_sessions::{now_millis, parse_shared_session_id};
use crate::state::AppState;

use super::support::*;
use super::types::{SquadPlanProposalV1, SquadProjectionV1, SquadRunStatus};
use super::validator::validate_user_plan_revision;

#[tauri::command]
pub(crate) async fn shared_squad_record_lead_plan(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    attempt_id: String,
    state: State<'_, AppState>,
) -> Result<SquadProjectionV1, String> {
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_block_and_settle(
            writer,
            &run,
            None,
            "scope-denied: canonical workspace root changed during Lead planning",
            now_millis() as i64,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    if run.status == SquadRunStatus::AwaitingApproval {
        return Ok(run);
    }
    if run.status != SquadRunStatus::Planning || !run.active_attempt_ids.contains(&attempt_id) {
        return Err("squad-lead-owner-mismatch".to_string());
    }
    let committed = committed_fact(writer, &session_id, &attempt_id)?;
    if committed.outcome.status != OutcomeStatus::Completed {
        let occurred_at = committed.committed_at;
        append_block_and_settle(
            writer,
            &run,
            None,
            "Lead planning attempt did not complete",
            occurred_at,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    let raw = assistant_text(&committed);
    let plan =
        match parse_json_with_one_normalization::<SquadPlanProposalV1>(&raw).and_then(|plan| {
            validate_plan_targets(&plan, &run.lead_target)?;
            Ok(plan)
        }) {
            Ok(plan) => plan,
            Err(error) => {
                append_block_and_settle(writer, &run, None, &error, committed.committed_at)?;
                return require_run(writer, &session_id, &run_id);
            }
        };
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadPlanProposed(SquadPlanProposedFact {
            fact_id: format!("squad:{run_id}:plan:1"),
            run_id: run_id.clone(),
            revision: 1,
            plan: serde_json::to_value(plan).map_err(|error| error.to_string())?,
            proposed_at: committed.committed_at,
            extra: json!({"leadAttemptId": attempt_id}),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}

#[tauri::command]
pub(crate) async fn shared_squad_revise_plan(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    plan: SquadPlanProposalV1,
    state: State<'_, AppState>,
) -> Result<SquadProjectionV1, String> {
    require_squad_enabled()?;
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_block_and_settle(
            writer,
            &run,
            None,
            "scope-denied: canonical workspace root changed before plan revision",
            now_millis() as i64,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    if run.status != SquadRunStatus::AwaitingApproval {
        return Err("squad-plan-not-editable: plan is not awaiting approval".to_string());
    }
    let current_plan = run
        .plan
        .as_ref()
        .ok_or_else(|| "squad-plan-not-editable: current plan is missing".to_string())?;
    validate_user_plan_revision(current_plan, &plan)?;
    validate_plan_targets(&plan, &run.lead_target)?;
    let revision = run.plan_revision + 1;
    let revised_at = now_millis() as i64;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadPlanRevised(SquadPlanRevisedFact {
            fact_id: format!("squad:{run_id}:plan:{revision}"),
            run_id: run_id.clone(),
            revision,
            plan: serde_json::to_value(plan).map_err(|error| error.to_string())?,
            revised_at,
            extra: empty_extra(),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}

#[tauri::command]
pub(crate) async fn shared_squad_approve_plan(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    revision: u32,
    state: State<'_, AppState>,
) -> Result<SquadProjectionV1, String> {
    require_squad_enabled()?;
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_block_and_settle(
            writer,
            &run,
            None,
            "scope-denied: canonical workspace root changed before approval",
            now_millis() as i64,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    if run.status == SquadRunStatus::Running && run.plan_revision == revision {
        return Ok(run);
    }
    if run.status != SquadRunStatus::AwaitingApproval || run.plan_revision != revision {
        return Err(format!(
            "squad-approval-conflict: current revision is {} in {:?}",
            run.plan_revision, run.status
        ));
    }
    let plan = run
        .plan
        .as_ref()
        .ok_or_else(|| "squad-approval-invalid: plan is missing".to_string())?;
    validate_plan_targets(plan, &run.lead_target)?;
    let approved_at = now_millis() as i64;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadPlanApproved(SquadPlanApprovedFact {
            fact_id: format!("squad:{run_id}:approved:{revision}"),
            run_id: run_id.clone(),
            revision,
            approved_at,
            extra: empty_extra(),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}
