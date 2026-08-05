use std::collections::{HashMap, HashSet};

use crate::shared_event_log::canonical::types::CanonicalProviderProfileSource;

use super::types::{
    SquadNodeKind, SquadPermissionClass, SquadPlanProposalV1, MAX_SQUAD_NODES, SQUAD_SCHEMA_VERSION,
};

pub fn validate_plan(plan: &SquadPlanProposalV1) -> Result<(), Vec<String>> {
    let mut diagnostics = Vec::new();
    if plan.schema_version != SQUAD_SCHEMA_VERSION {
        diagnostics.push(format!(
            "schemaVersion must be {SQUAD_SCHEMA_VERSION}, got {}",
            plan.schema_version
        ));
    }
    if plan.summary.trim().is_empty() {
        diagnostics.push("summary must be non-empty".to_string());
    }
    if plan.nodes.is_empty() || plan.nodes.len() > MAX_SQUAD_NODES {
        diagnostics.push(format!("nodes must contain 1..={MAX_SQUAD_NODES} entries"));
    }
    validate_budget(plan, &mut diagnostics);

    let mut nodes = HashMap::new();
    for node in &plan.nodes {
        if !valid_node_id(&node.id) {
            diagnostics.push(format!(
                "node id '{}' must match [a-z0-9][a-z0-9-]{{0,63}}",
                node.id
            ));
        }
        if nodes.insert(node.id.as_str(), node).is_some() {
            diagnostics.push(format!("duplicate node id '{}'", node.id));
        }
        if node.title.trim().is_empty() || node.goal.trim().is_empty() {
            diagnostics.push(format!(
                "node '{}' title and goal must be non-empty",
                node.id
            ));
        }
        if node.max_attempts == 0 || node.max_attempts > plan.budget.max_node_attempts {
            diagnostics.push(format!(
                "node '{}' maxAttempts must be within 1..={} ",
                node.id, plan.budget.max_node_attempts
            ));
        }
        if node.success_criteria.is_empty()
            || node
                .success_criteria
                .iter()
                .any(|criterion| criterion.trim().is_empty())
        {
            diagnostics.push(format!(
                "node '{}' successCriteria must contain non-empty entries",
                node.id
            ));
        }
        validate_permission(node, &mut diagnostics);
        validate_target(node, &mut diagnostics);
    }

    let synthesize = plan
        .nodes
        .iter()
        .filter(|node| node.kind == SquadNodeKind::Synthesize)
        .collect::<Vec<_>>();
    if synthesize.len() != 1 {
        diagnostics.push("plan must contain exactly one synthesize node".to_string());
    }
    if synthesize.first().map(|node| node.id.as_str()) != Some(plan.final_node_id.as_str()) {
        diagnostics.push("finalNodeId must reference the synthesize node".to_string());
    }

    for node in &plan.nodes {
        let mut dependency_set = HashSet::new();
        for dependency in &node.depends_on {
            if dependency == &node.id {
                diagnostics.push(format!("node '{}' cannot depend on itself", node.id));
            }
            if !nodes.contains_key(dependency.as_str()) {
                diagnostics.push(format!(
                    "node '{}' depends on unknown node '{}'",
                    node.id, dependency
                ));
            }
            if !dependency_set.insert(dependency) {
                diagnostics.push(format!(
                    "node '{}' repeats dependency '{}'",
                    node.id, dependency
                ));
            }
        }
        if let Some(repair_of) = node.repair_of.as_deref() {
            if node.kind != SquadNodeKind::Mutate {
                diagnostics.push(format!(
                    "node '{}' repairOf is only valid for mutate nodes",
                    node.id
                ));
            }
            if !node
                .depends_on
                .iter()
                .any(|dependency| dependency == repair_of)
            {
                diagnostics.push(format!(
                    "node '{}' repairOf must also be a direct dependency",
                    node.id
                ));
            }
            if nodes
                .get(repair_of)
                .is_none_or(|source| source.kind != SquadNodeKind::Verify)
            {
                diagnostics.push(format!(
                    "node '{}' repairOf must reference a verify node",
                    node.id
                ));
            }
        }
    }

    detect_cycles(plan, &nodes, &mut diagnostics);
    validate_final_reachability(plan, &nodes, &mut diagnostics);
    validate_mutation_verifiers(plan, &nodes, &mut diagnostics);

    if diagnostics.is_empty() {
        Ok(())
    } else {
        diagnostics.sort();
        diagnostics.dedup();
        Err(diagnostics)
    }
}

/// 用户确认前只允许调整预算与 node attempt 上限；DAG、目标与任务语义仍由
/// Lead proposal 封存。Adaptive forward repair 走内部 canonical transition，不经过此入口。
pub fn validate_user_plan_revision(
    current: &SquadPlanProposalV1,
    candidate: &SquadPlanProposalV1,
) -> Result<(), String> {
    if current.schema_version != candidate.schema_version
        || current.summary != candidate.summary
        || current.final_node_id != candidate.final_node_id
        || current.nodes.len() != candidate.nodes.len()
    {
        return Err(
            "squad-plan-revision-denied: only budget and node maxAttempts may change".to_string(),
        );
    }
    for (current_node, candidate_node) in current.nodes.iter().zip(&candidate.nodes) {
        let mut allowed = current_node.clone();
        allowed.max_attempts = candidate_node.max_attempts;
        if allowed != *candidate_node {
            return Err(format!(
                "squad-plan-revision-denied:{}: DAG and node authority are sealed",
                current_node.id
            ));
        }
    }
    Ok(())
}

fn validate_budget(plan: &SquadPlanProposalV1, diagnostics: &mut Vec<String>) {
    let budget = &plan.budget;
    if !(1..=4).contains(&budget.max_parallel_read_only) {
        diagnostics.push("budget.maxParallelReadOnly must be within 1..=4".to_string());
    }
    if !(1..=3).contains(&budget.max_node_attempts) {
        diagnostics.push("budget.maxNodeAttempts must be within 1..=3".to_string());
    }
    if budget.max_repair_attempts > 2 {
        diagnostics.push("budget.maxRepairAttempts must be <= 2".to_string());
    }
    if !(60..=7_200).contains(&budget.max_wall_clock_seconds) {
        diagnostics.push("budget.maxWallClockSeconds must be within 60..=7200".to_string());
    }
}

fn validate_permission(node: &super::types::SquadPlanNodeV1, diagnostics: &mut Vec<String>) {
    let expected = match node.kind {
        SquadNodeKind::Mutate => SquadPermissionClass::CurrentWorkspace,
        SquadNodeKind::Analyze | SquadNodeKind::Verify | SquadNodeKind::Synthesize => {
            SquadPermissionClass::ReadOnly
        }
    };
    if node.permission != expected {
        diagnostics.push(format!(
            "node '{}' permission must be {:?} for {:?}",
            node.id, expected, node.kind
        ));
    }
}

fn validate_target(node: &super::types::SquadPlanNodeV1, diagnostics: &mut Vec<String>) {
    let target = &node.target;
    let provider = target
        .provider_profile_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let expected_source = if provider.is_some() {
        CanonicalProviderProfileSource::Managed
    } else {
        CanonicalProviderProfileSource::Local
    };
    if target.provider_profile_source != Some(expected_source)
        || target
            .provider_profile_name_snapshot
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
        || target
            .model_catalog_entry_id
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
        || target
            .model
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
    {
        diagnostics.push(format!("node '{}' has an unresolved target", node.id));
    }
}

fn valid_node_id(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    value.len() <= 64
        && (first.is_ascii_lowercase() || first.is_ascii_digit())
        && chars.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn detect_cycles<'a>(
    plan: &'a SquadPlanProposalV1,
    nodes: &HashMap<&'a str, &'a super::types::SquadPlanNodeV1>,
    diagnostics: &mut Vec<String>,
) {
    fn visit<'a>(
        node_id: &'a str,
        nodes: &HashMap<&'a str, &'a super::types::SquadPlanNodeV1>,
        visiting: &mut HashSet<&'a str>,
        visited: &mut HashSet<&'a str>,
    ) -> bool {
        if visited.contains(node_id) {
            return false;
        }
        if !visiting.insert(node_id) {
            return true;
        }
        let cyclic = nodes.get(node_id).is_some_and(|node| {
            node.depends_on
                .iter()
                .any(|dependency| visit(dependency, nodes, visiting, visited))
        });
        visiting.remove(node_id);
        visited.insert(node_id);
        cyclic
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    if plan
        .nodes
        .iter()
        .any(|node| visit(&node.id, nodes, &mut visiting, &mut visited))
    {
        diagnostics.push("plan graph must be acyclic".to_string());
    }
}

fn collect_ancestors<'a>(
    node_id: &'a str,
    nodes: &HashMap<&'a str, &'a super::types::SquadPlanNodeV1>,
    result: &mut HashSet<&'a str>,
) {
    if let Some(node) = nodes.get(node_id) {
        for dependency in &node.depends_on {
            if result.insert(dependency) {
                collect_ancestors(dependency, nodes, result);
            }
        }
    }
}

fn validate_final_reachability<'a>(
    plan: &'a SquadPlanProposalV1,
    nodes: &HashMap<&'a str, &'a super::types::SquadPlanNodeV1>,
    diagnostics: &mut Vec<String>,
) {
    let mut ancestors = HashSet::new();
    collect_ancestors(&plan.final_node_id, nodes, &mut ancestors);
    for node in &plan.nodes {
        if node.id != plan.final_node_id && !ancestors.contains(node.id.as_str()) {
            diagnostics.push(format!(
                "final node must transitively depend on '{}'",
                node.id
            ));
        }
    }
}

fn validate_mutation_verifiers<'a>(
    plan: &'a SquadPlanProposalV1,
    nodes: &HashMap<&'a str, &'a super::types::SquadPlanNodeV1>,
    diagnostics: &mut Vec<String>,
) {
    for mutation in plan
        .nodes
        .iter()
        .filter(|node| node.kind == SquadNodeKind::Mutate)
    {
        let has_verifier = plan.nodes.iter().any(|candidate| {
            if candidate.kind != SquadNodeKind::Verify {
                return false;
            }
            let mut ancestors = HashSet::new();
            collect_ancestors(&candidate.id, nodes, &mut ancestors);
            ancestors.contains(mutation.id.as_str())
        });
        if !has_verifier {
            diagnostics.push(format!(
                "mutate node '{}' must have a downstream verify node",
                mutation.id
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::EngineType;
    use crate::shared_session_v2::ExecutionTargetInput;
    use crate::squad_orchestration::types::{SquadBudgetV1, SquadPlanNodeV1, SQUAD_SCHEMA_VERSION};

    fn target() -> ExecutionTargetInput {
        ExecutionTargetInput {
            engine: EngineType::Codex,
            provider_profile_id: None,
            model_catalog_entry_id: Some("gpt-5".to_string()),
            model: Some("gpt-5".to_string()),
            reasoning_effort: None,
            provider_profile_name_snapshot: Some("Local".to_string()),
            provider_profile_source: Some(CanonicalProviderProfileSource::Local),
            runtime_capability_fingerprint: None,
        }
    }

    fn node(
        id: &str,
        kind: SquadNodeKind,
        permission: SquadPermissionClass,
        depends_on: &[&str],
    ) -> SquadPlanNodeV1 {
        SquadPlanNodeV1 {
            id: id.to_string(),
            title: id.to_string(),
            kind,
            goal: format!("complete {id}"),
            depends_on: depends_on.iter().map(|value| value.to_string()).collect(),
            repair_of: None,
            target: target(),
            permission,
            max_attempts: 2,
            success_criteria: vec!["done".to_string()],
        }
    }

    fn valid_plan() -> SquadPlanProposalV1 {
        SquadPlanProposalV1 {
            schema_version: SQUAD_SCHEMA_VERSION,
            summary: "plan".to_string(),
            budget: SquadBudgetV1::default(),
            nodes: vec![
                node(
                    "analyze",
                    SquadNodeKind::Analyze,
                    SquadPermissionClass::ReadOnly,
                    &[],
                ),
                node(
                    "mutate",
                    SquadNodeKind::Mutate,
                    SquadPermissionClass::CurrentWorkspace,
                    &["analyze"],
                ),
                node(
                    "verify",
                    SquadNodeKind::Verify,
                    SquadPermissionClass::ReadOnly,
                    &["mutate"],
                ),
                node(
                    "final",
                    SquadNodeKind::Synthesize,
                    SquadPermissionClass::ReadOnly,
                    &["verify"],
                ),
            ],
            final_node_id: "final".to_string(),
        }
    }

    #[test]
    fn accepts_valid_parallel_single_writer_plan() {
        assert_eq!(validate_plan(&valid_plan()), Ok(()));
    }

    #[test]
    fn rejects_cycle_and_wrong_permission() {
        let mut plan = valid_plan();
        plan.nodes[0].depends_on = vec!["final".to_string()];
        plan.nodes[1].permission = SquadPermissionClass::ReadOnly;
        let errors = validate_plan(&plan).expect_err("invalid plan");
        assert!(errors.iter().any(|error| error.contains("acyclic")));
        assert!(errors.iter().any(|error| error.contains("permission")));
    }

    #[test]
    fn rejects_mutation_without_verifier() {
        let mut plan = valid_plan();
        plan.nodes.retain(|node| node.id != "verify");
        plan.nodes
            .iter_mut()
            .find(|node| node.id == "final")
            .expect("final")
            .depends_on = vec!["mutate".to_string()];
        let errors = validate_plan(&plan).expect_err("invalid plan");
        assert!(errors
            .iter()
            .any(|error| error.contains("downstream verify")));
    }

    #[test]
    fn user_revision_allows_only_budget_and_attempt_limits() {
        let current = valid_plan();
        let mut candidate = current.clone();
        candidate.budget.max_parallel_read_only = 1;
        candidate.budget.max_node_attempts = 1;
        for node in &mut candidate.nodes {
            node.max_attempts = 1;
        }
        assert_eq!(validate_user_plan_revision(&current, &candidate), Ok(()));

        candidate.nodes[0].goal = "silently widened task".to_string();
        let error = validate_user_plan_revision(&current, &candidate)
            .expect_err("node semantics must remain sealed");
        assert!(error.contains("DAG and node authority are sealed"));
    }
}
