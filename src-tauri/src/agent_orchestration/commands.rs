use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::shared_event_log::canonical::types::{
    CanonicalFact, SquadCancelRequestedFact, SquadNodeOutcomeRecordedFact, SquadPlanApprovedFact,
    SquadPlanProposedFact, SquadRunRequestedFact, SquadRunSettledFact,
};
use crate::shared_session_v2::{
    require_shared_session_workspace_owner, ExecutionTargetInput,
};
use crate::state::AppState;

use super::support::*;
use super::types::{
    apply_stage_bindings, default_stage_specs, empty_extra, short_text, AgentCancelResultV1,
    AgentPlanDraftV1, AgentProjectionV1, AgentRunStatus, AgentStageBindingInput, AgentStageId,
    AgentStageStatus, AGENT_SCHEMA_VERSION,
};

#[tauri::command]
pub(crate) async fn shared_agent_request_run(
    workspace_id: String,
    thread_id: String,
    text: String,
    target: ExecutionTargetInput,
    // 可选：每段独立 CLI+供应商；缺省则三段共用 target
    stage_bindings: Option<Vec<AgentStageBindingInput>>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    require_agent_enabled()?;
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    crate::shared_session_v2::validate_resolved_execution_target(&target)?;
    validate_agent_target(&target)?;
    let request_text = text.trim();
    if request_text.is_empty() {
        return Err("agent-request-invalid: text must be non-empty".to_string());
    }

    let mut stages = default_stage_specs(&target);
    if let Some(bindings) = stage_bindings.as_ref() {
        for binding in bindings {
            validate_agent_target(&binding.target)?;
            crate::shared_session_v2::validate_resolved_execution_target(&binding.target)?;
        }
        stages = apply_stage_bindings(stages, bindings);
    }

    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    ensure_no_active_run(writer, &session_id)?;

    let run_id = format!("agent-{}", Uuid::new_v4());
    let attempt_id = Uuid::new_v4().to_string();
    let logical_turn_id = Uuid::new_v4().to_string();
    let requested_at = now_ms();
    let plan_stage = stages
        .iter()
        .find(|stage| stage.id == AgentStageId::Plan.as_str())
        .cloned()
        .ok_or_else(|| "agent-stage-missing: plan".to_string())?;
    let access_mode = stage_access_mode(AgentStageId::Plan.as_str(), &plan_stage.target);

    let bindings_json = serde_json::to_value(
        stages
            .iter()
            .map(|stage| {
                json!({
                    "id": stage.id,
                    "target": stage.target,
                })
            })
            .collect::<Vec<_>>(),
    )
    .map_err(|error| error.to_string())?;

    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadRunRequested(SquadRunRequestedFact {
            fact_id: format!("agent:{run_id}:requested"),
            run_id: run_id.clone(),
            workspace_id: workspace_id.clone(),
            request_text: request_text.to_string(),
            lead_target: target.to_snapshot(),
            requested_at,
            extra: json!({
                "planAttemptId": attempt_id,
                "leadAttemptId": attempt_id,
                "planLogicalTurnId": logical_turn_id,
                "workspaceRoot": workspace_root,
                "orchestration": "multi-cli-collab-v1",
                "stageBindings": bindings_json,
            }),
        }),
    )?;

    let begin = begin_stage_turn(
        writer,
        &session_id,
        &plan_stage.target,
        &run_id,
        AgentStageId::Plan.as_str(),
        plan_prompt(request_text),
        access_mode,
        attempt_id.clone(),
        logical_turn_id.clone(),
    )?;
    if begin.status != crate::shared_session_v2::BeginTurnStatus::Creating {
        let run = require_run(writer, &session_id, &run_id)?;
        append_failed_and_settle(
            writer,
            &run,
            begin.reason.as_deref().unwrap_or("plan stage unavailable"),
            requested_at,
        )?;
        return Err("agent-plan-unavailable: failed to prepare plan stage".to_string());
    }

    let prepared = prepared_from_begin(
        run_id.clone(),
        AgentStageId::Plan.as_str().into(),
        attempt_id,
        logical_turn_id,
        &begin,
        plan_stage.target,
        access_mode,
    )?;
    Ok(json!({
        "projection": require_run(writer, &session_id, &run_id)?,
        "stageAttempt": prepared,
        // 兼容旧字段名
        "planAttempt": prepared,
    }))
}

#[tauri::command]
pub(crate) async fn shared_agent_get(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<AgentProjectionV1>, String> {
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    load_latest(require_writer_state(state.inner())?, &session_id)
}

#[tauri::command]
pub(crate) async fn shared_agent_record_plan(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    attempt_id: String,
    state: State<'_, AppState>,
) -> Result<AgentProjectionV1, String> {
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_failed_and_settle(
            writer,
            &run,
            "scope-denied: workspace root changed during planning",
            now_ms(),
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    if run.status == AgentRunStatus::AwaitingApproval {
        return Ok(run);
    }
    if run.status != AgentRunStatus::Planning {
        return Err("agent-plan-owner-mismatch".to_string());
    }
    let committed = committed_fact(writer, &session_id, &attempt_id)?;
    if !outcome_completed(&committed) {
        append_failed_and_settle(
            writer,
            &run,
            "Plan stage did not complete successfully",
            committed.committed_at,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    let raw = assistant_text(&committed);
    let plan = match parse_plan_from_assistant(&raw) {
        Ok(plan) => plan,
        Err(error) => {
            append_failed_and_settle(writer, &run, &error, committed.committed_at)?;
            return require_run(writer, &session_id, &run_id);
        }
    };
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadNodeOutcomeRecorded(SquadNodeOutcomeRecordedFact {
            fact_id: format!("agent:{run_id}:plan:{attempt_id}"),
            run_id: run_id.clone(),
            node_id: AgentStageId::Plan.as_str().into(),
            attempt_id: attempt_id.clone(),
            outcome: json!({
                "schemaVersion": AGENT_SCHEMA_VERSION,
                "status": "succeeded",
                "summary": short_text(&plan.summary, 160),
            }),
            recorded_at: committed.committed_at,
            extra: empty_extra(),
        }),
    )?;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadPlanProposed(SquadPlanProposedFact {
            fact_id: format!("agent:{run_id}:plan:1"),
            run_id: run_id.clone(),
            revision: 1,
            plan: serde_json::to_value(plan).map_err(|error| error.to_string())?,
            proposed_at: committed.committed_at,
            extra: json!({ "planAttemptId": attempt_id }),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}

#[tauri::command]
pub(crate) async fn shared_agent_approve(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    revision: u32,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    require_agent_enabled()?;
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_failed_and_settle(
            writer,
            &run,
            "scope-denied: workspace root changed before approval",
            now_ms(),
        )?;
        return Ok(json!({
            "projection": require_run(writer, &session_id, &run_id)?,
            "stageAttempt": Value::Null,
            "executeAttempt": Value::Null,
        }));
    }
    if run.status == AgentRunStatus::Implementing && run.plan_revision == revision {
        return Ok(json!({
            "projection": run,
            "stageAttempt": Value::Null,
            "executeAttempt": Value::Null,
        }));
    }
    if run.status != AgentRunStatus::AwaitingApproval || run.plan_revision != revision {
        return Err(format!(
            "agent-approval-conflict: revision {} status {:?}",
            run.plan_revision, run.status
        ));
    }
    let plan = run
        .plan
        .clone()
        .ok_or_else(|| "agent-approval-invalid: plan missing".to_string())?;
    let implement = run
        .stages
        .iter()
        .find(|stage| stage.id == AgentStageId::Implement.as_str())
        .cloned()
        .ok_or_else(|| "agent-stage-missing: implement".to_string())?;
    let approved_at = now_ms();
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadPlanApproved(SquadPlanApprovedFact {
            fact_id: format!("agent:{run_id}:approved:{revision}"),
            run_id: run_id.clone(),
            revision,
            approved_at,
            extra: empty_extra(),
        }),
    )?;

    let attempt_id = Uuid::new_v4().to_string();
    let logical_turn_id = Uuid::new_v4().to_string();
    let access_mode = stage_access_mode(AgentStageId::Implement.as_str(), &implement.target);
    let begin = begin_stage_turn(
        writer,
        &session_id,
        &implement.target,
        &run_id,
        AgentStageId::Implement.as_str(),
        implement_prompt(&run.request_text, &plan),
        access_mode,
        attempt_id.clone(),
        logical_turn_id.clone(),
    )?;
    let prepared = match prepared_from_begin(
        run_id.clone(),
        AgentStageId::Implement.as_str().into(),
        attempt_id,
        logical_turn_id,
        &begin,
        implement.target,
        access_mode,
    ) {
        Ok(prepared) => prepared,
        Err(error) => {
            let latest = require_run(writer, &session_id, &run_id)?;
            append_failed_and_settle(writer, &latest, &error, now_ms())?;
            return Err(error);
        }
    };
    Ok(json!({
        "projection": require_run(writer, &session_id, &run_id)?,
        "stageAttempt": prepared,
        "executeAttempt": prepared,
    }))
}

#[tauri::command]
pub(crate) async fn shared_agent_record_execute(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    attempt_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    // 实现段结算后自动启动审查段
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() {
        return Ok(json!({ "projection": run, "stageAttempt": Value::Null }));
    }
    let committed = committed_fact(writer, &session_id, &attempt_id)?;
    let raw = assistant_text(&committed);
    let implement_note = if raw.trim().is_empty() {
        "实现段完成，无文字说明。".to_string()
    } else {
        short_text(&raw, 800)
    };
    let ok = outcome_completed(&committed);
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadNodeOutcomeRecorded(SquadNodeOutcomeRecordedFact {
            fact_id: format!("agent:{run_id}:implement:{attempt_id}"),
            run_id: run_id.clone(),
            node_id: AgentStageId::Implement.as_str().into(),
            attempt_id: attempt_id.clone(),
            outcome: json!({
                "schemaVersion": AGENT_SCHEMA_VERSION,
                "status": if ok { "succeeded" } else { "failed" },
                "summary": short_text(&implement_note, 160),
            }),
            recorded_at: committed.committed_at,
            extra: empty_extra(),
        }),
    )?;
    if !ok {
        let latest = require_run(writer, &session_id, &run_id)?;
        append_failed_and_settle(
            writer,
            &latest,
            "Implement stage did not complete successfully",
            committed.committed_at,
        )?;
        return Ok(json!({
            "projection": require_run(writer, &session_id, &run_id)?,
            "stageAttempt": Value::Null,
        }));
    }

    let run = require_run(writer, &session_id, &run_id)?;
    let plan = run
        .plan
        .clone()
        .unwrap_or(AgentPlanDraftV1 {
            schema_version: AGENT_SCHEMA_VERSION,
            summary: "（无规划摘要）".into(),
            markdown: run.request_text.clone(),
            steps: vec![],
        });
    let review = run
        .stages
        .iter()
        .find(|stage| stage.id == AgentStageId::Review.as_str())
        .cloned()
        .ok_or_else(|| "agent-stage-missing: review".to_string())?;
    let review_attempt_id = Uuid::new_v4().to_string();
    let logical_turn_id = Uuid::new_v4().to_string();
    let access_mode = stage_access_mode(AgentStageId::Review.as_str(), &review.target);
    let begin = begin_stage_turn(
        writer,
        &session_id,
        &review.target,
        &run_id,
        AgentStageId::Review.as_str(),
        review_prompt(&run.request_text, &plan, &implement_note),
        access_mode,
        review_attempt_id.clone(),
        logical_turn_id.clone(),
    )?;
    let prepared = match prepared_from_begin(
        run_id.clone(),
        AgentStageId::Review.as_str().into(),
        review_attempt_id,
        logical_turn_id,
        &begin,
        review.target,
        access_mode,
    ) {
        Ok(prepared) => prepared,
        Err(error) => {
            // 实现已成功但审查起不来：仍 settle 为 succeeded + 用实现短说明当汇总
            append_fact(
                writer,
                &session_id,
                CanonicalFact::SquadRunSettled(SquadRunSettledFact {
                    fact_id: format!("agent:{run_id}:settled"),
                    run_id: run_id.clone(),
                    status: "succeeded".to_string(),
                    summary: Some(short_text(&implement_note, 480)),
                    settled_at: now_ms(),
                    extra: json!({ "reviewSkipped": error }),
                }),
            )?;
            return Ok(json!({
                "projection": require_run(writer, &session_id, &run_id)?,
                "stageAttempt": Value::Null,
            }));
        }
    };
    Ok(json!({
        "projection": require_run(writer, &session_id, &run_id)?,
        "stageAttempt": prepared,
    }))
}

#[tauri::command]
pub(crate) async fn shared_agent_record_review(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    attempt_id: String,
    state: State<'_, AppState>,
) -> Result<AgentProjectionV1, String> {
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() {
        return Ok(run);
    }
    let committed = committed_fact(writer, &session_id, &attempt_id)?;
    let raw = assistant_text(&committed);
    let summary = if raw.trim().is_empty() {
        "协作完成。".to_string()
    } else {
        short_text(&raw, 480)
    };
    let ok = outcome_completed(&committed);
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadNodeOutcomeRecorded(SquadNodeOutcomeRecordedFact {
            fact_id: format!("agent:{run_id}:review:{attempt_id}"),
            run_id: run_id.clone(),
            node_id: AgentStageId::Review.as_str().into(),
            attempt_id: attempt_id.clone(),
            outcome: json!({
                "schemaVersion": AGENT_SCHEMA_VERSION,
                "status": if ok { "succeeded" } else { "failed" },
                "summary": short_text(&summary, 160),
            }),
            recorded_at: committed.committed_at,
            extra: empty_extra(),
        }),
    )?;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadRunSettled(SquadRunSettledFact {
            fact_id: format!("agent:{run_id}:settled"),
            run_id: run_id.clone(),
            status: if ok {
                "succeeded".to_string()
            } else {
                "failed".to_string()
            },
            summary: Some(summary),
            settled_at: committed.committed_at,
            extra: json!({
                "finalAttemptId": attempt_id,
                "orchestration": "multi-cli-collab-v1",
            }),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}

#[tauri::command]
pub(crate) async fn shared_agent_cancel(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    reason: String,
    state: State<'_, AppState>,
) -> Result<AgentCancelResultV1, String> {
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() {
        return Ok(AgentCancelResultV1 {
            projection: run,
            attempt_ids: vec![],
        });
    }
    let attempt_ids = run.active_attempt_ids.clone();
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadCancelRequested(SquadCancelRequestedFact {
            fact_id: format!("agent:{run_id}:cancel"),
            run_id: run_id.clone(),
            reason: reason.trim().to_string(),
            requested_at: now_ms(),
            extra: empty_extra(),
        }),
    )?;
    Ok(AgentCancelResultV1 {
        projection: require_run(writer, &session_id, &run_id)?,
        attempt_ids,
    })
}

#[tauri::command]
pub(crate) async fn shared_agent_finalize_cancel(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    attempt_results: Vec<Value>,
    state: State<'_, AppState>,
) -> Result<AgentProjectionV1, String> {
    let session_id = parse_session(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let _transition = lock_agent_transition()?;
    let writer = require_writer_state(state.inner())?;
    let run = require_run(writer, &session_id, &run_id)?;
    if run.status.is_terminal() {
        return Ok(run);
    }
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadRunSettled(SquadRunSettledFact {
            fact_id: format!("agent:{run_id}:settled"),
            run_id: run_id.clone(),
            status: "cancelled".to_string(),
            summary: Some("协作已取消。".into()),
            settled_at: now_ms(),
            extra: json!({ "attemptResults": attempt_results }),
        }),
    )?;
    require_run(writer, &session_id, &run_id)
}
