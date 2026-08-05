use super::types::{
    SquadNodeKind, SquadNodeProjectionV1, SquadNodeStatus, SquadProjectionV1, SquadRunStatus,
};

fn dependencies_resolved(node: &SquadNodeProjectionV1, projection: &SquadProjectionV1) -> bool {
    node.node.depends_on.iter().all(|dependency| {
        projection
            .nodes
            .iter()
            .find(|candidate| candidate.node.id == *dependency)
            .is_some_and(|candidate| {
                candidate.status == SquadNodeStatus::Succeeded
                    || (node.node.repair_of.as_deref() == Some(dependency.as_str())
                        && candidate.node.kind == SquadNodeKind::Verify
                        && candidate.status == SquadNodeStatus::Failed)
            })
    })
}

pub fn ready_node_ids(projection: &SquadProjectionV1) -> Vec<String> {
    if projection.status != SquadRunStatus::Running {
        return vec![];
    }
    let Some(plan) = projection.plan.as_ref() else {
        return vec![];
    };
    let active_read_only = projection
        .nodes
        .iter()
        .filter(|node| {
            matches!(
                node.status,
                SquadNodeStatus::Prepared | SquadNodeStatus::Running
            ) && node.node.kind != SquadNodeKind::Mutate
        })
        .count();
    let mut remaining_read_only =
        usize::from(plan.budget.max_parallel_read_only).saturating_sub(active_read_only);
    let mut mutation_available = !projection.nodes.iter().any(|node| {
        node.node.kind == SquadNodeKind::Mutate
            && matches!(
                node.status,
                SquadNodeStatus::Prepared | SquadNodeStatus::Running
            )
    });
    let mut ready = Vec::new();
    for node in &projection.nodes {
        if !matches!(
            node.status,
            SquadNodeStatus::Pending | SquadNodeStatus::Ready | SquadNodeStatus::Failed
        ) || node.attempts.len() >= usize::from(node.node.max_attempts)
            || projection
                .nodes
                .iter()
                .any(|candidate| candidate.node.repair_of.as_deref() == Some(node.node.id.as_str()))
            || !dependencies_resolved(node, projection)
        {
            continue;
        }
        if node.node.kind == SquadNodeKind::Mutate {
            if mutation_available {
                ready.push(node.node.id.clone());
                mutation_available = false;
            }
        } else if remaining_read_only > 0 {
            ready.push(node.node.id.clone());
            remaining_read_only -= 1;
        }
    }
    ready
}

#[cfg(test)]
mod tests {
    use crate::engine::EngineType;
    use crate::shared_event_log::canonical::types::CanonicalProviderProfileSource;
    use crate::shared_session_v2::ExecutionTargetInput;
    use crate::squad_orchestration::types::{
        SquadBudgetV1, SquadNodeKind, SquadNodeProjectionV1, SquadPermissionClass, SquadPlanNodeV1,
        SquadPlanProposalV1, SquadProjectionV1,
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

    fn node(id: &str, kind: SquadNodeKind, dependencies: &[&str]) -> SquadNodeProjectionV1 {
        SquadNodeProjectionV1 {
            node: SquadPlanNodeV1 {
                id: id.into(),
                title: id.into(),
                kind,
                goal: id.into(),
                depends_on: dependencies.iter().map(|value| value.to_string()).collect(),
                repair_of: None,
                target: target(),
                permission: if kind == SquadNodeKind::Mutate {
                    SquadPermissionClass::CurrentWorkspace
                } else {
                    SquadPermissionClass::ReadOnly
                },
                max_attempts: 2,
                success_criteria: vec!["done".into()],
            },
            status: SquadNodeStatus::Pending,
            attempts: vec![],
            outcome: None,
            diagnostics: vec![],
        }
    }

    #[test]
    fn selects_parallel_analysis_and_only_one_mutation() {
        let nodes = vec![
            node("a", SquadNodeKind::Analyze, &[]),
            node("b", SquadNodeKind::Analyze, &[]),
            node("m1", SquadNodeKind::Mutate, &[]),
            node("m2", SquadNodeKind::Mutate, &[]),
        ];
        let plan = SquadPlanProposalV1 {
            schema_version: 1,
            summary: "test".into(),
            budget: SquadBudgetV1 {
                max_parallel_read_only: 2,
                ..SquadBudgetV1::default()
            },
            nodes: nodes.iter().map(|node| node.node.clone()).collect(),
            final_node_id: "b".into(),
        };
        let projection = SquadProjectionV1 {
            schema_version: 1,
            run_id: "run".into(),
            workspace_id: "/workspace".into(),
            workspace_root: "/workspace".into(),
            session_id: "session".into(),
            request_text: "task".into(),
            lead_target: target(),
            status: SquadRunStatus::Running,
            plan_revision: 1,
            plan: Some(plan),
            nodes,
            active_attempt_ids: vec![],
            diagnostics: vec![],
            requested_at: 1,
            approved_at: Some(1),
            updated_at: 1,
        };
        assert_eq!(ready_node_ids(&projection), vec!["a", "b", "m1"]);
    }
}
