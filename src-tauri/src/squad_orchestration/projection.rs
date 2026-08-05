use std::collections::{HashMap, HashSet};

use crate::shared_event_log::canonical::types::{CanonicalFact, OutcomeStatus};
use crate::shared_event_log::StoredEvent;
use crate::shared_session_v2::target_input_from_snapshot;

use super::types::{
    SquadAttemptProjectionV1, SquadContextPackageProjectionV1, SquadNodeProjectionV1,
    SquadNodeStatus, SquadOutcomeStatus, SquadPlanProposalV1, SquadProjectionV1, SquadRunStatus,
    SquadTypedOutcomeEnvelopeV1, SQUAD_SCHEMA_VERSION,
};

fn decode_fact(event: &StoredEvent) -> Result<CanonicalFact, String> {
    serde_json::from_str(&event.payload_json).map_err(|error| {
        format!(
            "decode Squad canonical fact session={} sequence={}: {error}",
            event.session_id, event.sequence
        )
    })
}

fn parse_plan(value: &serde_json::Value) -> Result<SquadPlanProposalV1, String> {
    serde_json::from_value(value.clone()).map_err(|error| format!("decode Squad plan: {error}"))
}

fn rebuild_nodes(
    plan: &SquadPlanProposalV1,
    previous: &[SquadNodeProjectionV1],
) -> Vec<SquadNodeProjectionV1> {
    let previous = previous
        .iter()
        .map(|node| (node.node.id.as_str(), node))
        .collect::<HashMap<_, _>>();
    plan.nodes
        .iter()
        .map(|node| {
            previous
                .get(node.id.as_str())
                .map(|projection| {
                    let mut projection = (*projection).clone();
                    projection.node = node.clone();
                    projection
                })
                .unwrap_or_else(|| SquadNodeProjectionV1 {
                    node: node.clone(),
                    status: SquadNodeStatus::Pending,
                    attempts: vec![],
                    outcome: None,
                    diagnostics: vec![],
                })
        })
        .collect()
}

fn run_mut<'a>(
    runs: &'a mut [SquadProjectionV1],
    run_id: &str,
) -> Option<&'a mut SquadProjectionV1> {
    runs.iter_mut().find(|run| run.run_id == run_id)
}

fn node_mut<'a>(
    run: &'a mut SquadProjectionV1,
    node_id: &str,
) -> Option<&'a mut SquadNodeProjectionV1> {
    run.nodes.iter_mut().find(|node| node.node.id == node_id)
}

fn terminal_node_status(outcome: SquadOutcomeStatus) -> SquadNodeStatus {
    match outcome {
        SquadOutcomeStatus::Succeeded => SquadNodeStatus::Succeeded,
        SquadOutcomeStatus::Failed => SquadNodeStatus::Failed,
        SquadOutcomeStatus::Blocked => SquadNodeStatus::Blocked,
        SquadOutcomeStatus::Cancelled => SquadNodeStatus::Cancelled,
    }
}

fn run_status(value: &str) -> Option<SquadRunStatus> {
    match value {
        "succeeded" => Some(SquadRunStatus::Succeeded),
        "failed" => Some(SquadRunStatus::Failed),
        "blocked" => Some(SquadRunStatus::Blocked),
        "cancelled" => Some(SquadRunStatus::Cancelled),
        _ => None,
    }
}

pub fn project_squad_runs(
    session_id: &str,
    events: &[StoredEvent],
) -> Result<Vec<SquadProjectionV1>, String> {
    let mut runs = Vec::<SquadProjectionV1>::new();
    let mut attempt_owner = HashMap::<String, (String, String)>::new();
    let mut lead_attempts = HashMap::<String, String>::new();

    for event in events {
        let fact = decode_fact(event)?;
        match fact {
            CanonicalFact::SquadRunRequested(fact) => {
                if runs.iter().any(|run| run.run_id == fact.run_id) {
                    continue;
                }
                if let Some(attempt_id) = fact
                    .extra
                    .get("leadAttemptId")
                    .and_then(serde_json::Value::as_str)
                {
                    lead_attempts.insert(fact.run_id.clone(), attempt_id.to_string());
                }
                runs.push(SquadProjectionV1 {
                    schema_version: SQUAD_SCHEMA_VERSION,
                    run_id: fact.run_id,
                    workspace_root: fact
                        .extra
                        .get("workspaceRoot")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or(&fact.workspace_id)
                        .to_string(),
                    workspace_id: fact.workspace_id,
                    session_id: session_id.to_string(),
                    request_text: fact.request_text,
                    lead_target: target_input_from_snapshot(&fact.lead_target)?,
                    status: SquadRunStatus::Planning,
                    plan_revision: 0,
                    plan: None,
                    nodes: vec![],
                    active_attempt_ids: vec![],
                    diagnostics: vec![],
                    requested_at: fact.requested_at,
                    approved_at: None,
                    updated_at: fact.requested_at,
                });
            }
            CanonicalFact::SquadPlanProposed(fact) => {
                let plan = parse_plan(&fact.plan)?;
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    run.nodes = rebuild_nodes(&plan, &run.nodes);
                    run.plan = Some(plan);
                    run.plan_revision = fact.revision;
                    run.status = SquadRunStatus::AwaitingApproval;
                    run.updated_at = fact.proposed_at;
                    if let Some(lead_attempt) = lead_attempts.remove(&fact.run_id) {
                        run.active_attempt_ids
                            .retain(|attempt| attempt != &lead_attempt);
                    }
                }
            }
            CanonicalFact::SquadPlanRevised(fact) => {
                let plan = parse_plan(&fact.plan)?;
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    run.nodes = rebuild_nodes(&plan, &run.nodes);
                    run.plan = Some(plan);
                    run.plan_revision = fact.revision;
                    if run.status != SquadRunStatus::Running {
                        run.status = SquadRunStatus::AwaitingApproval;
                    }
                    run.updated_at = fact.revised_at;
                }
            }
            CanonicalFact::SquadPlanApproved(fact) => {
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    if fact.revision == run.plan_revision {
                        run.status = SquadRunStatus::Running;
                        run.approved_at = Some(fact.approved_at);
                    } else {
                        run.status = SquadRunStatus::Blocked;
                        run.diagnostics.push(format!(
                            "approved revision {} does not match current revision {}",
                            fact.revision, run.plan_revision
                        ));
                    }
                    run.updated_at = fact.approved_at;
                }
            }
            CanonicalFact::SquadNodeDispatchPrepared(fact) => {
                attempt_owner.insert(
                    fact.attempt_id.clone(),
                    (fact.run_id.clone(), fact.node_id.clone()),
                );
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    if let Some(node) = node_mut(run, &fact.node_id) {
                        node.status = SquadNodeStatus::Prepared;
                        node.outcome = None;
                        if !node
                            .attempts
                            .iter()
                            .any(|attempt| attempt.attempt_id == fact.attempt_id)
                        {
                            node.attempts.push(SquadAttemptProjectionV1 {
                                attempt_id: fact.attempt_id.clone(),
                                binding_key: fact.worker_binding_key,
                                status: SquadNodeStatus::Prepared,
                                started_at: fact.prepared_at,
                                settled_at: None,
                                context_package: None,
                            });
                        }
                    }
                    if !run.active_attempt_ids.contains(&fact.attempt_id) {
                        run.active_attempt_ids.push(fact.attempt_id);
                    }
                    run.updated_at = fact.prepared_at;
                }
            }
            CanonicalFact::TurnRequested(fact) => {
                let run_id = fact
                    .extra
                    .get("squadRunId")
                    .and_then(serde_json::Value::as_str);
                let node_id = fact
                    .extra
                    .get("squadNodeId")
                    .and_then(serde_json::Value::as_str);
                let binding_key = fact
                    .extra
                    .get("squadWorkerBindingKey")
                    .and_then(serde_json::Value::as_str);
                if let (Some(run_id), Some(node_id), Some(binding_key)) =
                    (run_id, node_id, binding_key)
                {
                    attempt_owner.insert(
                        fact.attempt_id.clone(),
                        (run_id.to_string(), node_id.to_string()),
                    );
                    if let Some(run) = run_mut(&mut runs, run_id) {
                        if let Some(node) = node_mut(run, node_id) {
                            node.status = SquadNodeStatus::Prepared;
                            if !node
                                .attempts
                                .iter()
                                .any(|attempt| attempt.attempt_id == fact.attempt_id)
                            {
                                node.attempts.push(SquadAttemptProjectionV1 {
                                    attempt_id: fact.attempt_id.clone(),
                                    binding_key: binding_key.to_string(),
                                    status: SquadNodeStatus::Prepared,
                                    started_at: fact.requested_at,
                                    settled_at: None,
                                    context_package: None,
                                });
                            }
                            if !run.active_attempt_ids.contains(&fact.attempt_id) {
                                run.active_attempt_ids.push(fact.attempt_id.clone());
                            }
                            run.updated_at = fact.requested_at;
                        }
                    }
                }
            }
            CanonicalFact::TurnAccepted(fact) => {
                if let Some((run_id, node_id)) = attempt_owner.get(&fact.attempt_id).cloned() {
                    if let Some(run) = run_mut(&mut runs, &run_id) {
                        if let Some(node) = node_mut(run, &node_id) {
                            node.status = SquadNodeStatus::Running;
                            if let Some(attempt) = node
                                .attempts
                                .iter_mut()
                                .find(|attempt| attempt.attempt_id == fact.attempt_id)
                            {
                                attempt.status = SquadNodeStatus::Running;
                            }
                        }
                        run.updated_at = fact.accepted_at;
                    }
                }
            }
            CanonicalFact::DeliveryPrepared(fact) => {
                if let Some((run_id, node_id)) = attempt_owner.get(&fact.attempt_id).cloned() {
                    if let Some(run) = run_mut(&mut runs, &run_id) {
                        if let Some(node) = node_mut(run, &node_id) {
                            if let Some(attempt) = node
                                .attempts
                                .iter_mut()
                                .find(|attempt| attempt.attempt_id == fact.attempt_id)
                            {
                                attempt.context_package = Some(SquadContextPackageProjectionV1 {
                                    package_id: fact.package_id,
                                    source_checksum: fact.source_checksum,
                                    from_sequence_exclusive: fact.from_sequence_exclusive,
                                    through_sequence_inclusive: fact.through_sequence_inclusive,
                                    mode: serde_json::to_value(fact.mode)
                                        .ok()
                                        .and_then(|value| value.as_str().map(str::to_string))
                                        .unwrap_or_else(|| "unknown".to_string()),
                                    scope: fact.extra.get("scope").cloned(),
                                });
                            }
                        }
                    }
                }
            }
            CanonicalFact::TurnCommitted(fact) => {
                if let Some((run_id, node_id)) = attempt_owner.get(&fact.attempt_id).cloned() {
                    if let Some(run) = run_mut(&mut runs, &run_id) {
                        if let Some(node) = node_mut(run, &node_id) {
                            if let Some(attempt) = node
                                .attempts
                                .iter_mut()
                                .find(|attempt| attempt.attempt_id == fact.attempt_id)
                            {
                                attempt.settled_at = Some(fact.committed_at);
                                if fact.outcome.status != OutcomeStatus::Completed {
                                    attempt.status = match fact.outcome.status {
                                        OutcomeStatus::Failed => SquadNodeStatus::Failed,
                                        OutcomeStatus::Cancelled | OutcomeStatus::Replaced => {
                                            SquadNodeStatus::Cancelled
                                        }
                                        OutcomeStatus::Completed => SquadNodeStatus::Running,
                                    };
                                }
                            }
                        }
                        run.updated_at = fact.committed_at;
                    }
                }
            }
            CanonicalFact::SquadNodeOutcomeRecorded(fact) => {
                let outcome = serde_json::from_value::<SquadTypedOutcomeEnvelopeV1>(fact.outcome)
                    .map_err(|error| format!("decode Squad outcome: {error}"))?;
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    if let Some(node) = node_mut(run, &fact.node_id) {
                        let status = terminal_node_status(outcome.status);
                        node.status = status;
                        node.outcome = Some(outcome);
                        if let Some(attempt) = node
                            .attempts
                            .iter_mut()
                            .find(|attempt| attempt.attempt_id == fact.attempt_id)
                        {
                            attempt.status = status;
                            attempt.settled_at = Some(fact.recorded_at);
                        }
                    }
                    run.active_attempt_ids
                        .retain(|attempt| attempt != &fact.attempt_id);
                    run.updated_at = fact.recorded_at;
                }
            }
            CanonicalFact::SquadBranchBlocked(fact) => {
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    run.status = SquadRunStatus::Blocked;
                    run.diagnostics.push(fact.reason.clone());
                    if let Some(node_id) = fact.node_id {
                        if let Some(node) = node_mut(run, &node_id) {
                            node.status = SquadNodeStatus::Blocked;
                            node.diagnostics.push(fact.reason);
                        }
                    }
                    run.updated_at = fact.blocked_at;
                }
            }
            CanonicalFact::SquadCancelRequested(fact) => {
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    if !run.status.is_terminal() {
                        run.status = SquadRunStatus::Cancelling;
                    }
                    run.updated_at = fact.requested_at;
                }
            }
            CanonicalFact::SquadRunSettled(fact) => {
                if let Some(run) = run_mut(&mut runs, &fact.run_id) {
                    if let Some(status) = run_status(&fact.status) {
                        run.status = status;
                        let node_status = match status {
                            SquadRunStatus::Cancelled => Some(SquadNodeStatus::Cancelled),
                            SquadRunStatus::Blocked | SquadRunStatus::Failed => {
                                Some(SquadNodeStatus::Blocked)
                            }
                            _ => None,
                        };
                        if let Some(node_status) = node_status {
                            for node in &mut run.nodes {
                                if !node.status.is_terminal() {
                                    node.status = node_status;
                                }
                                for attempt in &mut node.attempts {
                                    if !attempt.status.is_terminal() {
                                        attempt.status = node_status;
                                        attempt.settled_at = Some(fact.settled_at);
                                    }
                                }
                            }
                        }
                    }
                    run.active_attempt_ids.clear();
                    run.updated_at = fact.settled_at;
                }
            }
            _ => {}
        }
    }

    for run in &mut runs {
        if let Some(lead_attempt) = lead_attempts.get(&run.run_id) {
            if !run.active_attempt_ids.contains(lead_attempt) {
                run.active_attempt_ids.push(lead_attempt.clone());
            }
        }
        let completed = run
            .nodes
            .iter()
            .filter(|node| node.status == SquadNodeStatus::Succeeded)
            .map(|node| node.node.id.clone())
            .collect::<HashSet<_>>();
        for node in &mut run.nodes {
            if node.status == SquadNodeStatus::Pending
                && node
                    .node
                    .depends_on
                    .iter()
                    .all(|dependency| completed.contains(dependency.as_str()))
                && run.status == SquadRunStatus::Running
            {
                node.status = SquadNodeStatus::Ready;
            }
        }
    }

    Ok(runs)
}

pub fn latest_squad_run(
    session_id: &str,
    events: &[StoredEvent],
) -> Result<Option<SquadProjectionV1>, String> {
    Ok(project_squad_runs(session_id, events)?.pop())
}

pub fn active_squad_run(
    session_id: &str,
    events: &[StoredEvent],
) -> Result<Option<SquadProjectionV1>, String> {
    Ok(project_squad_runs(session_id, events)?
        .into_iter()
        .rev()
        .find(|run| !run.status.is_terminal()))
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use crate::engine::EngineType;
    use crate::shared_event_log::canonical::types::{
        CanonicalProviderProfileSource, CanonicalUserInput, ContextMode, ContextOperation,
        DeliveryPreparedFact, SquadNodeDispatchPreparedFact, SquadPlanApprovedFact,
        SquadPlanProposedFact, SquadRunRequestedFact, TurnExecutionSnapshot, TurnRequestedFact,
    };
    use crate::shared_event_log::Fidelity;
    use crate::shared_session_v2::ExecutionTargetInput;
    use crate::squad_orchestration::types::{
        SquadBudgetV1, SquadNodeKind, SquadPermissionClass, SquadPlanNodeV1,
    };

    use super::*;

    fn target() -> ExecutionTargetInput {
        ExecutionTargetInput {
            engine: EngineType::Codex,
            provider_profile_id: None,
            model_catalog_entry_id: Some("gpt-5".into()),
            model: Some("gpt-5".into()),
            reasoning_effort: None,
            provider_profile_name_snapshot: Some("Local".into()),
            provider_profile_source: Some(CanonicalProviderProfileSource::Local),
            runtime_capability_fingerprint: None,
        }
    }

    fn plan() -> SquadPlanProposalV1 {
        let target = target();
        SquadPlanProposalV1 {
            schema_version: 1,
            summary: "analyze then synthesize".into(),
            budget: SquadBudgetV1::default(),
            nodes: vec![
                SquadPlanNodeV1 {
                    id: "analyze".into(),
                    title: "Analyze".into(),
                    kind: SquadNodeKind::Analyze,
                    goal: "Analyze".into(),
                    depends_on: vec![],
                    repair_of: None,
                    target: target.clone(),
                    permission: SquadPermissionClass::ReadOnly,
                    max_attempts: 2,
                    success_criteria: vec!["done".into()],
                },
                SquadPlanNodeV1 {
                    id: "final".into(),
                    title: "Final".into(),
                    kind: SquadNodeKind::Synthesize,
                    goal: "Synthesize".into(),
                    depends_on: vec!["analyze".into()],
                    repair_of: None,
                    target,
                    permission: SquadPermissionClass::ReadOnly,
                    max_attempts: 1,
                    success_criteria: vec!["answer".into()],
                },
            ],
            final_node_id: "final".into(),
        }
    }

    fn stored(sequence: i64, fact: CanonicalFact) -> StoredEvent {
        StoredEvent {
            session_id: "session-1".into(),
            sequence,
            event_id: format!("event-{sequence}"),
            fact_type: fact.fact_type().into(),
            logical_turn_id: fact.logical_turn_id().map(str::to_string),
            attempt_id: fact.attempt_id().map(str::to_string),
            dedupe_key: fact.dedupe_key().map(str::to_string),
            payload_json: serde_json::to_string(&fact).expect("fact json"),
            payload_checksum: format!("sha256:{sequence}"),
            fidelity: Fidelity::Canonical,
            committed_at: sequence,
        }
    }

    fn snapshot() -> TurnExecutionSnapshot {
        target().to_snapshot()
    }

    #[test]
    fn replay_moves_plan_to_ready_only_after_approval() {
        let facts = vec![
            stored(
                1,
                CanonicalFact::SquadRunRequested(SquadRunRequestedFact {
                    fact_id: "run-1:requested".into(),
                    run_id: "run-1".into(),
                    workspace_id: "/workspace".into(),
                    request_text: "task".into(),
                    lead_target: snapshot(),
                    requested_at: 1,
                    extra: json!({"leadAttemptId": "lead-1"}),
                }),
            ),
            stored(
                2,
                CanonicalFact::SquadPlanProposed(SquadPlanProposedFact {
                    fact_id: "run-1:plan:1".into(),
                    run_id: "run-1".into(),
                    revision: 1,
                    plan: serde_json::to_value(plan()).expect("plan json"),
                    proposed_at: 2,
                    extra: Value::Object(Default::default()),
                }),
            ),
        ];
        let proposed = latest_squad_run("session-1", &facts)
            .expect("projection")
            .expect("run");
        assert_eq!(proposed.status, SquadRunStatus::AwaitingApproval);
        assert_eq!(proposed.nodes[0].status, SquadNodeStatus::Pending);
        assert!(proposed.active_attempt_ids.is_empty());

        let mut approved_facts = facts;
        approved_facts.push(stored(
            3,
            CanonicalFact::SquadPlanApproved(SquadPlanApprovedFact {
                fact_id: "run-1:approved:1".into(),
                run_id: "run-1".into(),
                revision: 1,
                approved_at: 3,
                extra: Value::Object(Default::default()),
            }),
        ));
        let approved = latest_squad_run("session-1", &approved_facts)
            .expect("projection")
            .expect("run");
        assert_eq!(approved.status, SquadRunStatus::Running);
        assert_eq!(approved.nodes[0].status, SquadNodeStatus::Ready);
        assert_eq!(approved.nodes[1].status, SquadNodeStatus::Pending);
    }

    #[test]
    fn replay_recovers_worker_owner_from_turn_requested_crash_window() {
        let facts = vec![
            stored(
                1,
                CanonicalFact::SquadRunRequested(SquadRunRequestedFact {
                    fact_id: "run-1:requested".into(),
                    run_id: "run-1".into(),
                    workspace_id: "/workspace".into(),
                    request_text: "task".into(),
                    lead_target: snapshot(),
                    requested_at: 1,
                    extra: json!({}),
                }),
            ),
            stored(
                2,
                CanonicalFact::SquadPlanProposed(SquadPlanProposedFact {
                    fact_id: "run-1:plan:1".into(),
                    run_id: "run-1".into(),
                    revision: 1,
                    plan: serde_json::to_value(plan()).expect("plan json"),
                    proposed_at: 2,
                    extra: json!({}),
                }),
            ),
            stored(
                3,
                CanonicalFact::SquadPlanApproved(SquadPlanApprovedFact {
                    fact_id: "run-1:approved:1".into(),
                    run_id: "run-1".into(),
                    revision: 1,
                    approved_at: 3,
                    extra: json!({}),
                }),
            ),
            stored(
                4,
                CanonicalFact::TurnRequested(TurnRequestedFact {
                    logical_turn_id: "turn-1".into(),
                    attempt_id: "attempt-crash".into(),
                    retry_of_attempt_id: None,
                    input: CanonicalUserInput {
                        text: Some("worker".into()),
                        image_refs: None,
                        attachment_refs: None,
                        extra: json!({}),
                    },
                    target: snapshot(),
                    requested_at: 4,
                    extra: json!({
                        "squadRunId": "run-1",
                        "squadNodeId": "analyze",
                        "squadWorkerBindingKey": "squad:run-1:analyze:codex:default",
                    }),
                }),
            ),
        ];

        let recovered = latest_squad_run("session-1", &facts)
            .expect("projection")
            .expect("run");
        assert_eq!(recovered.active_attempt_ids, vec!["attempt-crash"]);
        assert_eq!(recovered.nodes[0].status, SquadNodeStatus::Prepared);
        assert_eq!(recovered.nodes[0].attempts[0].attempt_id, "attempt-crash");
    }

    #[test]
    fn replay_attaches_scoped_context_package_to_exact_attempt() {
        let facts = vec![
            stored(
                1,
                CanonicalFact::SquadRunRequested(SquadRunRequestedFact {
                    fact_id: "run-1:requested".into(),
                    run_id: "run-1".into(),
                    workspace_id: "/workspace".into(),
                    request_text: "task".into(),
                    lead_target: snapshot(),
                    requested_at: 1,
                    extra: json!({}),
                }),
            ),
            stored(
                2,
                CanonicalFact::SquadPlanProposed(SquadPlanProposedFact {
                    fact_id: "run-1:plan:1".into(),
                    run_id: "run-1".into(),
                    revision: 1,
                    plan: serde_json::to_value(plan()).expect("plan json"),
                    proposed_at: 2,
                    extra: json!({}),
                }),
            ),
            stored(
                3,
                CanonicalFact::SquadPlanApproved(SquadPlanApprovedFact {
                    fact_id: "run-1:approved:1".into(),
                    run_id: "run-1".into(),
                    revision: 1,
                    approved_at: 3,
                    extra: json!({}),
                }),
            ),
            stored(
                4,
                CanonicalFact::SquadNodeDispatchPrepared(SquadNodeDispatchPreparedFact {
                    fact_id: "dispatch-1".into(),
                    run_id: "run-1".into(),
                    node_id: "analyze".into(),
                    attempt_id: "attempt-1".into(),
                    worker_binding_key: "squad:run-1:analyze:codex:default".into(),
                    target: snapshot(),
                    permission_class: "read-only".into(),
                    prepared_at: 4,
                    extra: json!({}),
                }),
            ),
            stored(
                5,
                CanonicalFact::DeliveryPrepared(DeliveryPreparedFact {
                    logical_turn_id: "turn-1".into(),
                    attempt_id: "attempt-1".into(),
                    binding_key: "squad:run-1:analyze:codex:default".into(),
                    package_id: "package-1".into(),
                    source_checksum: "sha256:source".into(),
                    from_sequence_exclusive: Some(3),
                    through_sequence_inclusive: 4,
                    mode: ContextMode::PortableTranscript,
                    operation: ContextOperation::PromptPrefix,
                    extra: json!({"scope": {"nodeId": "analyze", "runId": "run-1"}}),
                }),
            ),
        ];

        let run = latest_squad_run("session-1", &facts)
            .expect("projection")
            .expect("run");
        let package = run.nodes[0].attempts[0]
            .context_package
            .as_ref()
            .expect("context package");
        assert_eq!(package.package_id, "package-1");
        assert_eq!(package.scope.as_ref().expect("scope")["nodeId"], "analyze");
    }
}
