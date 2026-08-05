use crate::engine::EngineType;
use crate::shared_event_log::canonical::types::CanonicalProviderProfileSource;
use crate::shared_session_v2::ExecutionTargetInput;

use super::scheduler::ready_node_ids;
use super::support::{build_forward_repair_plan, validate_plan_targets};
use super::types::{
    SquadBudgetV1, SquadNodeKind, SquadNodeProjectionV1, SquadNodeStatus, SquadOutcomeStatus,
    SquadPermissionClass, SquadPlanNodeV1, SquadPlanProposalV1, SquadProjectionV1, SquadRunStatus,
    SquadTypedOutcomeEnvelopeV1, SquadVerificationStatus, SquadVerificationV1,
    SQUAD_SCHEMA_VERSION,
};

fn target(model: &str) -> ExecutionTargetInput {
    ExecutionTargetInput {
        engine: EngineType::Codex,
        provider_profile_id: None,
        model_catalog_entry_id: Some(model.into()),
        model: Some(model.into()),
        reasoning_effort: None,
        provider_profile_name_snapshot: Some("Local".into()),
        provider_profile_source: Some(CanonicalProviderProfileSource::Local),
        runtime_capability_fingerprint: None,
    }
}

fn plan_node(id: &str, kind: SquadNodeKind, depends_on: &[&str]) -> SquadPlanNodeV1 {
    SquadPlanNodeV1 {
        id: id.into(),
        title: id.into(),
        kind,
        goal: format!("complete {id}"),
        depends_on: depends_on.iter().map(|value| value.to_string()).collect(),
        repair_of: None,
        target: target("gpt-5"),
        permission: if kind == SquadNodeKind::Mutate {
            SquadPermissionClass::CurrentWorkspace
        } else {
            SquadPermissionClass::ReadOnly
        },
        max_attempts: 2,
        success_criteria: vec!["done".into()],
    }
}

fn plan() -> SquadPlanProposalV1 {
    SquadPlanProposalV1 {
        schema_version: SQUAD_SCHEMA_VERSION,
        summary: "mutate, verify, synthesize".into(),
        budget: SquadBudgetV1 {
            max_repair_attempts: 1,
            ..SquadBudgetV1::default()
        },
        nodes: vec![
            plan_node("mutate", SquadNodeKind::Mutate, &[]),
            plan_node("verify", SquadNodeKind::Verify, &["mutate"]),
            plan_node("final", SquadNodeKind::Synthesize, &["verify"]),
        ],
        final_node_id: "final".into(),
    }
}

fn projection(plan: SquadPlanProposalV1) -> SquadProjectionV1 {
    SquadProjectionV1 {
        schema_version: SQUAD_SCHEMA_VERSION,
        run_id: "run-1".into(),
        workspace_id: "workspace-id".into(),
        workspace_root: "/workspace".into(),
        session_id: "session-1".into(),
        request_text: "fix it".into(),
        lead_target: target("gpt-5"),
        status: SquadRunStatus::Running,
        plan_revision: 1,
        plan: Some(plan),
        nodes: vec![],
        active_attempt_ids: vec![],
        diagnostics: vec![],
        requested_at: 1,
        approved_at: Some(2),
        updated_at: 2,
    }
}

fn failed_verification(repairs: Vec<&str>) -> SquadTypedOutcomeEnvelopeV1 {
    SquadTypedOutcomeEnvelopeV1 {
        schema_version: SQUAD_SCHEMA_VERSION,
        status: SquadOutcomeStatus::Failed,
        summary: "verification failed".into(),
        evidence: vec![],
        artifacts: vec![],
        changed_paths: vec![],
        verification: SquadVerificationV1 {
            status: SquadVerificationStatus::Failed,
            checks: vec!["targeted test".into()],
            failures: vec!["assertion mismatch".into()],
        },
        proposed_repairs: repairs.into_iter().map(str::to_string).collect(),
        extra: serde_json::Value::Object(Default::default()),
    }
}

#[test]
fn sealed_target_rejects_lead_target_expansion() {
    let mut candidate = plan();
    candidate.nodes[0].target = target("other-model");
    let error = validate_plan_targets(&candidate, &target("gpt-5")).expect_err("must reject");
    assert!(error.contains("differs from the exact sealed Lead target"));
}

#[test]
fn mutate_rejects_engine_without_hard_workspace_sandbox() {
    let mut candidate = plan();
    let claude = ExecutionTargetInput {
        engine: EngineType::Claude,
        ..target("claude-sonnet-4-5")
    };
    for node in &mut candidate.nodes {
        node.target = claude.clone();
    }
    let error = validate_plan_targets(&candidate, &claude).expect_err("must reject");
    assert!(error.contains("V1 Mutate requires Codex workspace sandbox"));
}

#[test]
fn read_only_plan_rejects_engine_without_hard_read_only_mode() {
    let kimi = ExecutionTargetInput {
        engine: EngineType::Kimi,
        ..target("kimi-k2")
    };
    let mut analyze = plan_node("analyze", SquadNodeKind::Analyze, &[]);
    analyze.target = kimi.clone();
    let mut final_node = plan_node("final", SquadNodeKind::Synthesize, &["analyze"]);
    final_node.target = kimi.clone();
    let candidate = SquadPlanProposalV1 {
        schema_version: SQUAD_SCHEMA_VERSION,
        summary: "read-only plan".into(),
        budget: SquadBudgetV1::default(),
        nodes: vec![analyze, final_node],
        final_node_id: "final".into(),
    };

    let error = validate_plan_targets(&candidate, &kimi).expect_err("must reject");
    assert!(error.contains("hard read-only execution mode"));
}

#[test]
fn failed_verify_creates_bounded_forward_repair_branch() {
    let original = plan();
    let run = projection(original.clone());
    let verify = original
        .nodes
        .iter()
        .find(|node| node.id == "verify")
        .expect("verify");
    let repaired = build_forward_repair_plan(
        &run,
        verify,
        &failed_verification(vec!["adjust the in-workspace implementation"]),
    )
    .expect("repair plan");

    let repair = repaired
        .nodes
        .iter()
        .find(|node| node.repair_of.as_deref() == Some("verify"))
        .expect("repair node");
    let repair_id = repair.id.clone();
    assert_eq!(repair.kind, SquadNodeKind::Mutate);
    assert_eq!(repair.depends_on, vec!["verify"]);
    let reverify = repaired
        .nodes
        .iter()
        .find(|node| node.depends_on == vec![repair.id.clone()])
        .expect("reverify node");
    assert_eq!(reverify.kind, SquadNodeKind::Verify);
    assert_eq!(
        repaired
            .nodes
            .iter()
            .find(|node| node.id == "final")
            .expect("final")
            .depends_on,
        vec![reverify.id.clone()]
    );

    let nodes = repaired
        .nodes
        .iter()
        .cloned()
        .map(|node| SquadNodeProjectionV1 {
            status: match node.id.as_str() {
                "mutate" => SquadNodeStatus::Succeeded,
                "verify" => SquadNodeStatus::Failed,
                _ => SquadNodeStatus::Pending,
            },
            node,
            attempts: vec![],
            outcome: None,
            diagnostics: vec![],
        })
        .collect();
    let mut repaired_projection = projection(repaired);
    repaired_projection.nodes = nodes;
    assert_eq!(ready_node_ids(&repaired_projection), vec![repair_id]);
}

#[test]
fn repair_authority_expansion_fails_closed() {
    let original = plan();
    let run = projection(original.clone());
    let verify = original
        .nodes
        .iter()
        .find(|node| node.id == "verify")
        .expect("verify");
    let error =
        build_forward_repair_plan(&run, verify, &failed_verification(vec!["git push the fix"]))
            .expect_err("must reject remote repair");
    assert!(error.contains("authority-expansion"));

    let error = build_forward_repair_plan(
        &run,
        verify,
        &failed_verification(vec!["Commit the repaired files"]),
    )
    .expect_err("must reject a forbidden operation at the start of a proposal");
    assert!(error.contains("authority-expansion"));
}
