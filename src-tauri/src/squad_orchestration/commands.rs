use serde_json::{json, Value};
use tauri::State;
use uuid::Uuid;

use crate::shared_event_log::canonical::types::{
    CanonicalFact, OutcomeStatus, SquadNodeAttemptLinkedFact, SquadNodeDispatchPreparedFact,
    SquadNodeOutcomeRecordedFact, SquadPlanRevisedFact, SquadRunRequestedFact, SquadRunSettledFact,
    SquadVerificationRecordedFact,
};
use crate::shared_event_log::{MutationLeaseAction, MutationLeaseOutcome, MutationLeaseRequest};
use crate::shared_session_v2::{
    begin_squad_worker_turn_core, require_shared_session_workspace_owner, require_writer,
    validate_resolved_execution_target, BeginTurnStatus, ExecutionTargetInput,
};
use crate::shared_sessions::{now_millis, parse_shared_session_id};
use crate::state::AppState;

use super::projection::active_squad_run;
use super::scheduler::ready_node_ids;
use super::scope::{capture_workspace_fingerprint, reconcile_change_fence};
use super::support::*;
use super::types::{
    SquadClaimReadyResultV1, SquadNodeKind, SquadNodeStatus, SquadOutcomeStatus,
    SquadPreparedAttemptV1, SquadProjectionV1, SquadRunStatus, SquadTypedOutcomeEnvelopeV1,
    SquadVerificationStatus, SquadVerificationV1, SQUAD_SCHEMA_VERSION,
};

#[tauri::command]
pub(crate) async fn shared_squad_request_run(
    workspace_id: String,
    thread_id: String,
    text: String,
    target: ExecutionTargetInput,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    require_squad_enabled()?;
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    validate_resolved_execution_target(&target)?;
    validate_squad_lead_target(&target)?;
    let request_text = text.trim();
    if request_text.is_empty() {
        return Err("squad-request-invalid: text must be non-empty".to_string());
    }
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let _transition = lock_squad_transition()?;
    let writer = require_writer(&state)?;
    let events = load_events(writer, &session_id)?;
    if let Some(active) = active_squad_run(&session_id, &events)? {
        return Err(format!(
            "squad-run-conflict: session already has active run {}",
            active.run_id
        ));
    }
    let run_id = format!("squad-{}", Uuid::new_v4());
    let attempt_id = Uuid::new_v4().to_string();
    let logical_turn_id = Uuid::new_v4().to_string();
    let requested_at = now_millis() as i64;
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadRunRequested(SquadRunRequestedFact {
            fact_id: format!("squad:{run_id}:requested"),
            run_id: run_id.clone(),
            workspace_id: workspace_id.clone(),
            request_text: request_text.to_string(),
            lead_target: target.to_snapshot(),
            requested_at,
            extra: json!({
                "leadAttemptId": attempt_id,
                "leadLogicalTurnId": logical_turn_id,
                "workspaceRoot": workspace_root.clone(),
            }),
        }),
    )?;
    let lead_prompt = plan_prompt(request_text, &target)?;
    let lead_context_identity = json!({
        "schemaVersion": 1,
        "domain": "agent-squad-lead",
        "runId": run_id,
        "workspaceRoot": workspace_root,
        "sealedTarget": target.to_snapshot(),
        "requestChecksum": value_checksum(&Value::String(request_text.to_string()))?,
        "promptChecksum": value_checksum(&Value::String(lead_prompt.clone()))?,
    });
    let begin = begin_squad_worker_turn_core(
        writer,
        &session_id,
        &target,
        lead_prompt,
        &run_id,
        "lead",
        "lead",
        "read-only",
        false,
        lead_context_identity,
        attempt_id.clone(),
        logical_turn_id.clone(),
    )?;
    if begin.status != BeginTurnStatus::Creating {
        let run = require_run(writer, &session_id, &run_id)?;
        append_block_and_settle(
            writer,
            &run,
            None,
            begin.reason.as_deref().unwrap_or("lead target unavailable"),
            requested_at,
        )?;
        return Err("squad-lead-unavailable: failed to prepare Lead attempt".to_string());
    }
    Ok(json!({
        "projection": require_run(writer, &session_id, &run_id)?,
        "leadAttempt": {
            "runId": run_id,
            "nodeId": "lead",
            "nodeKind": "analyze",
            "attemptId": attempt_id,
            "logicalTurnId": logical_turn_id,
            "bindingKey": begin.binding_key,
            "target": target,
            "permission": "read-only",
        }
    }))
}

#[tauri::command]
pub(crate) async fn shared_squad_get(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Option<SquadProjectionV1>, String> {
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    load_latest(require_writer(&state)?, &session_id)
}

#[tauri::command]
pub(crate) async fn shared_squad_claim_ready_nodes(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    state: State<'_, AppState>,
) -> Result<SquadClaimReadyResultV1, String> {
    require_squad_enabled()?;
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let mut transition = Some(lock_squad_transition()?);
    let writer = require_writer(&state)?;
    let run = require_run(writer, &session_id, &run_id)?;
    let claim_time = now_millis() as i64;
    if workspace_root != run.workspace_root {
        append_block_and_settle(
            writer,
            &run,
            None,
            "scope-denied: canonical workspace root changed after approval",
            claim_time,
        )?;
        return Ok(SquadClaimReadyResultV1 {
            projection: require_run(writer, &session_id, &run_id)?,
            prepared: vec![],
        });
    }
    if run.status != SquadRunStatus::Running {
        return Ok(SquadClaimReadyResultV1 {
            projection: run,
            prepared: vec![],
        });
    }
    if let Some(final_node) = run.plan.as_ref().and_then(|plan| {
        run.nodes.iter().find(|node| {
            node.node.id == plan.final_node_id && node.status == SquadNodeStatus::Succeeded
        })
    }) {
        let summary = final_node
            .outcome
            .as_ref()
            .map(|outcome| outcome.summary.clone())
            .ok_or_else(|| "squad-final-outcome-missing".to_string())?;
        let settled_at = final_node
            .attempts
            .last()
            .and_then(|attempt| attempt.settled_at)
            .unwrap_or(claim_time);
        append_fact(
            writer,
            &session_id,
            CanonicalFact::SquadRunSettled(SquadRunSettledFact {
                fact_id: format!("squad:{run_id}:settled"),
                run_id: run_id.clone(),
                status: "succeeded".to_string(),
                summary: Some(summary),
                settled_at,
                extra: json!({
                    "finalAttemptId": final_node
                        .attempts
                        .last()
                        .map(|attempt| &attempt.attempt_id),
                    "target": final_node.node.target.to_snapshot(),
                    "recoveredFromOutcome": true,
                }),
            }),
        )?;
        return Ok(SquadClaimReadyResultV1 {
            projection: require_run(writer, &session_id, &run_id)?,
            prepared: vec![],
        });
    }
    if run
        .plan
        .as_ref()
        .zip(run.approved_at)
        .is_some_and(|(plan, approved_at)| {
            claim_time.saturating_sub(approved_at)
                >= i64::from(plan.budget.max_wall_clock_seconds) * 1_000
        })
    {
        append_block_and_settle(
            writer,
            &run,
            None,
            "squad-budget-exhausted: maxWallClockSeconds reached",
            claim_time,
        )?;
        return Ok(SquadClaimReadyResultV1 {
            projection: require_run(writer, &session_id, &run_id)?,
            prepared: vec![],
        });
    }
    let ready = ready_node_ids(&run);
    let mut prepared = Vec::new();
    let mut mutation_busy_reason = None;
    for node_id in ready {
        let node = run
            .nodes
            .iter()
            .find(|node| node.node.id == node_id)
            .cloned()
            .ok_or_else(|| format!("squad-node-not-found: {node_id}"))?;
        let attempt_id = Uuid::new_v4().to_string();
        let logical_turn_id = Uuid::new_v4().to_string();
        let prepared_at = now_millis() as i64;
        let baseline = if node.node.kind == SquadNodeKind::Mutate {
            match writer
                .change_mutation_lease(&MutationLeaseRequest {
                    session_id: session_id.clone(),
                    workspace_id: workspace_root.clone(),
                    run_id: run_id.clone(),
                    node_id: node_id.clone(),
                    attempt_id: attempt_id.clone(),
                    action: MutationLeaseAction::Acquire,
                    occurred_at: prepared_at,
                })
                .map_err(|error| error.to_string())?
            {
                MutationLeaseOutcome::Acquired { .. } => {
                    drop(transition.take());
                    let fingerprint = capture_workspace_fingerprint(&workspace_root);
                    transition = Some(lock_squad_transition()?);
                    let latest = require_run(writer, &session_id, &run_id)?;
                    if latest.status != SquadRunStatus::Running {
                        release_mutation_lease(
                            writer,
                            &run,
                            &node_id,
                            &attempt_id,
                            now_millis() as i64,
                        )?;
                        return Ok(SquadClaimReadyResultV1 {
                            projection: latest,
                            prepared: vec![],
                        });
                    }
                    match fingerprint {
                        Ok(baseline) => Some(baseline),
                        Err(error) => {
                            release_mutation_lease(
                                writer,
                                &run,
                                &node_id,
                                &attempt_id,
                                prepared_at,
                            )?;
                            append_block_and_settle(
                                writer,
                                &run,
                                Some(&node_id),
                                &error,
                                prepared_at,
                            )?;
                            return Ok(SquadClaimReadyResultV1 {
                                projection: require_run(writer, &session_id, &run_id)?,
                                prepared: vec![],
                            });
                        }
                    }
                }
                MutationLeaseOutcome::Busy {
                    holder_run_id,
                    holder_node_id,
                    holder_attempt_id,
                    epoch,
                } => {
                    let reason = if holder_run_id == run_id {
                        format!(
                            "mutation-lease-ambiguous: current run has an unprojected holder node={holder_node_id} attempt={holder_attempt_id} epoch={epoch}"
                        )
                    } else {
                        format!(
                            "mutation-lease-busy: holder run={holder_run_id} node={holder_node_id} attempt={holder_attempt_id} epoch={epoch}"
                        )
                    };
                    mutation_busy_reason = Some(reason);
                    continue;
                }
                MutationLeaseOutcome::Released { .. } => {
                    return Err("mutation-lease-invalid-transition: acquire released".to_string());
                }
            }
        } else {
            None
        };
        let (prompt, context_identity) = match worker_prompt(&run, &node_id).and_then(|prompt| {
            worker_context_identity(&run, &node.node, &prompt)
                .map(|context_identity| (prompt, context_identity))
        }) {
            Ok(context) => context,
            Err(error) => {
                if node.node.kind == SquadNodeKind::Mutate {
                    release_mutation_lease(writer, &run, &node_id, &attempt_id, prepared_at)?;
                }
                return Err(error);
            }
        };
        let begin = begin_squad_worker_turn_core(
            writer,
            &session_id,
            &node.node.target,
            prompt,
            &run_id,
            &node_id,
            node_kind_wire(node.node.kind),
            permission_wire(node.node.permission),
            node.node.kind == SquadNodeKind::Synthesize,
            context_identity,
            attempt_id.clone(),
            logical_turn_id.clone(),
        );
        let begin = match begin {
            Ok(begin) if begin.status == BeginTurnStatus::Creating => begin,
            Ok(begin) => {
                if node.node.kind == SquadNodeKind::Mutate {
                    release_mutation_lease(writer, &run, &node_id, &attempt_id, prepared_at)?;
                }
                return Err(format!(
                    "squad-worker-unavailable:{}: {}",
                    node_id,
                    begin.reason.unwrap_or_else(|| "unknown".to_string())
                ));
            }
            Err(error) => {
                if node.node.kind == SquadNodeKind::Mutate {
                    release_mutation_lease(writer, &run, &node_id, &attempt_id, prepared_at)?;
                }
                return Err(error);
            }
        };
        append_fact(
            writer,
            &session_id,
            CanonicalFact::SquadNodeDispatchPrepared(SquadNodeDispatchPreparedFact {
                fact_id: format!("squad:{run_id}:{node_id}:{attempt_id}:prepared"),
                run_id: run_id.clone(),
                node_id: node_id.clone(),
                attempt_id: attempt_id.clone(),
                worker_binding_key: begin.binding_key.clone(),
                target: node.node.target.to_snapshot(),
                permission_class: permission_wire(node.node.permission).to_string(),
                prepared_at,
                extra: json!({
                    "nodeKind": node_kind_wire(node.node.kind),
                    "workspaceBaseline": baseline,
                }),
            }),
        )?;
        append_fact(
            writer,
            &session_id,
            CanonicalFact::SquadNodeAttemptLinked(SquadNodeAttemptLinkedFact {
                fact_id: format!("squad:{run_id}:{node_id}:{attempt_id}:linked"),
                run_id: run_id.clone(),
                node_id: node_id.clone(),
                attempt_id: attempt_id.clone(),
                logical_turn_id: logical_turn_id.clone(),
                worker_binding_key: begin.binding_key.clone(),
                linked_at: prepared_at,
                extra: empty_extra(),
            }),
        )?;
        prepared.push(SquadPreparedAttemptV1 {
            run_id: run_id.clone(),
            node_id,
            node_kind: node.node.kind,
            attempt_id,
            logical_turn_id,
            binding_key: begin.binding_key,
            target: node.node.target.clone(),
            permission: node.node.permission,
        });
    }
    if prepared.is_empty() {
        if let Some(reason) = mutation_busy_reason {
            append_block_and_settle(writer, &run, None, &reason, now_millis() as i64)?;
        }
    }
    Ok(SquadClaimReadyResultV1 {
        projection: require_run(writer, &session_id, &run_id)?,
        prepared,
    })
}

#[tauri::command]
pub(crate) async fn shared_squad_record_attempt_outcome(
    workspace_id: String,
    thread_id: String,
    run_id: String,
    node_id: String,
    attempt_id: String,
    state: State<'_, AppState>,
) -> Result<SquadProjectionV1, String> {
    let session_id = parse_shared_session_id(&thread_id)?;
    require_shared_session_workspace_owner(&workspace_id, &session_id)?;
    let workspace_root = resolve_workspace_root(&state, &workspace_id).await?;
    let mut transition = Some(lock_squad_transition()?);
    let writer = require_writer(&state)?;
    let mut run = require_run(writer, &session_id, &run_id)?;
    if workspace_root != run.workspace_root {
        append_block_and_settle(
            writer,
            &run,
            Some(&node_id),
            "scope-denied: canonical workspace root changed while attempt was active",
            now_millis() as i64,
        )?;
        return require_run(writer, &session_id, &run_id);
    }
    if load_events(writer, &session_id)?.iter().any(|event| {
        event.fact_type == "squad.nodeOutcomeRecorded"
            && event.attempt_id.as_deref() == Some(&attempt_id)
    }) {
        return require_run(writer, &session_id, &run_id);
    }
    let node = run
        .nodes
        .iter()
        .find(|node| node.node.id == node_id)
        .cloned()
        .ok_or_else(|| format!("squad-node-not-found: {node_id}"))?;
    if !node
        .attempts
        .iter()
        .any(|attempt| attempt.attempt_id == attempt_id)
    {
        return Err("squad-attempt-owner-mismatch".to_string());
    }
    let committed = committed_fact(writer, &session_id, &attempt_id)?;
    let raw = assistant_text(&committed);
    let mut outcome = match committed.outcome.status {
        OutcomeStatus::Completed if node.node.kind == SquadNodeKind::Synthesize => {
            if raw.trim().is_empty() {
                failed_outcome(
                    "Synthesize returned an empty final answer".to_string(),
                    &raw,
                )
            } else {
                SquadTypedOutcomeEnvelopeV1 {
                    schema_version: SQUAD_SCHEMA_VERSION,
                    status: SquadOutcomeStatus::Succeeded,
                    summary: raw.clone(),
                    evidence: vec![],
                    artifacts: vec![],
                    changed_paths: vec![],
                    verification: SquadVerificationV1 {
                        status: SquadVerificationStatus::NotRun,
                        checks: vec![],
                        failures: vec![],
                    },
                    proposed_repairs: vec![],
                    extra: empty_extra(),
                }
            }
        }
        OutcomeStatus::Completed => {
            match parse_json_with_one_normalization::<SquadTypedOutcomeEnvelopeV1>(&raw).and_then(
                |outcome| {
                    validate_outcome_for_node(node.node.kind, &outcome)?;
                    Ok(outcome)
                },
            ) {
                Ok(outcome) => outcome,
                Err(error) => failed_outcome(error, &raw),
            }
        }
        OutcomeStatus::Cancelled | OutcomeStatus::Replaced => {
            let mut outcome = failed_outcome("Worker attempt was cancelled".to_string(), &raw);
            outcome.status = SquadOutcomeStatus::Cancelled;
            outcome
        }
        OutcomeStatus::Failed => failed_outcome(
            committed
                .outcome
                .error_message
                .clone()
                .unwrap_or_else(|| "Worker runtime failed".to_string()),
            &raw,
        ),
    };
    let mut fence_error = None;
    let mut release_lease_after_outcome = false;
    if node.node.kind == SquadNodeKind::Mutate {
        let baseline = dispatch_baseline(writer, &session_id, &attempt_id);
        drop(transition.take());
        let fence_result = baseline.and_then(|baseline| {
            capture_workspace_fingerprint(&workspace_root)
                .and_then(|after| reconcile_change_fence(&baseline, &after, &outcome.changed_paths))
        });
        transition = Some(lock_squad_transition()?);
        run = require_run(writer, &session_id, &run_id)?;
        if load_events(writer, &session_id)?.iter().any(|event| {
            event.fact_type == "squad.nodeOutcomeRecorded"
                && event.attempt_id.as_deref() == Some(&attempt_id)
        }) {
            return require_run(writer, &session_id, &run_id);
        }
        match fence_result {
            Ok(fence) => {
                outcome.extra = json!({"changeFence": fence});
                release_lease_after_outcome = true;
            }
            Err(error) => {
                outcome.status = SquadOutcomeStatus::Blocked;
                outcome.summary = error.clone();
                fence_error = Some(error);
            }
        }
    }
    debug_assert!(transition.is_some());
    append_fact(
        writer,
        &session_id,
        CanonicalFact::SquadNodeOutcomeRecorded(SquadNodeOutcomeRecordedFact {
            fact_id: format!("squad:{run_id}:{node_id}:{attempt_id}:outcome"),
            run_id: run_id.clone(),
            node_id: node_id.clone(),
            attempt_id: attempt_id.clone(),
            outcome: serde_json::to_value(&outcome).map_err(|error| error.to_string())?,
            recorded_at: committed.committed_at,
            extra: empty_extra(),
        }),
    )?;
    if release_lease_after_outcome {
        release_mutation_lease(writer, &run, &node_id, &attempt_id, committed.committed_at)?;
    }
    if node.node.kind == SquadNodeKind::Verify {
        append_fact(
            writer,
            &session_id,
            CanonicalFact::SquadVerificationRecorded(SquadVerificationRecordedFact {
                fact_id: format!("squad:{run_id}:{node_id}:{attempt_id}:verification"),
                run_id: run_id.clone(),
                node_id: node_id.clone(),
                attempt_id: attempt_id.clone(),
                verification: serde_json::to_value(&outcome.verification)
                    .map_err(|error| error.to_string())?,
                recorded_at: committed.committed_at,
                extra: empty_extra(),
            }),
        )?;
    }
    if run.status != SquadRunStatus::Running {
        return require_run(writer, &session_id, &run_id);
    }
    let attempt_count = node.attempts.len();
    let exhausted = attempt_count >= usize::from(node.node.max_attempts);
    if let Some(error) = fence_error {
        append_block_and_settle(writer, &run, Some(&node_id), &error, committed.committed_at)?;
    } else if node.node.kind == SquadNodeKind::Verify
        && outcome.status == SquadOutcomeStatus::Failed
        && outcome.verification.status == SquadVerificationStatus::Failed
    {
        match build_forward_repair_plan(&run, &node.node, &outcome) {
            Ok(repaired_plan) => {
                let revision = run.plan_revision + 1;
                append_fact(
                    writer,
                    &session_id,
                    CanonicalFact::SquadPlanRevised(SquadPlanRevisedFact {
                        fact_id: format!("squad:{run_id}:plan:{revision}"),
                        run_id: run_id.clone(),
                        revision,
                        plan: serde_json::to_value(repaired_plan)
                            .map_err(|error| error.to_string())?,
                        revised_at: committed.committed_at,
                        extra: json!({
                            "reason": "bounded-forward-repair",
                            "sourceNodeId": node_id,
                            "sourceAttemptId": attempt_id,
                        }),
                    }),
                )?;
            }
            Err(error) => append_block_and_settle(
                writer,
                &run,
                Some(&node_id),
                &error,
                committed.committed_at,
            )?,
        }
    } else if node.node.kind == SquadNodeKind::Synthesize
        && outcome.status == SquadOutcomeStatus::Succeeded
    {
        append_fact(
            writer,
            &session_id,
            CanonicalFact::SquadRunSettled(SquadRunSettledFact {
                fact_id: format!("squad:{run_id}:settled"),
                run_id: run_id.clone(),
                status: "succeeded".to_string(),
                summary: Some(outcome.summary.clone()),
                settled_at: committed.committed_at,
                extra: json!({
                    "finalAttemptId": attempt_id,
                    "target": node.node.target.to_snapshot(),
                }),
            }),
        )?;
    } else if outcome.status == SquadOutcomeStatus::Blocked
        || outcome.status == SquadOutcomeStatus::Cancelled
        || (outcome.status != SquadOutcomeStatus::Succeeded && exhausted)
    {
        append_block_and_settle(
            writer,
            &run,
            Some(&node_id),
            &outcome.summary,
            committed.committed_at,
        )?;
    }
    require_run(writer, &session_id, &run_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_accepts_strict_and_one_wrapped_object() {
        let strict: Value = parse_json_with_one_normalization(r#"{"ok":true}"#).expect("strict");
        assert_eq!(strict["ok"], true);
        let wrapped: Value =
            parse_json_with_one_normalization("```json\n{\"ok\":true,\"value\":\"} inside\"}\n```")
                .expect("one normalization");
        assert_eq!(wrapped["value"], "} inside");
    }

    #[test]
    fn normalization_fails_closed_after_one_pass() {
        let error =
            parse_json_with_one_normalization::<Value>("not json").expect_err("must fail closed");
        assert!(error.contains("after-one-repair"));
    }
}
