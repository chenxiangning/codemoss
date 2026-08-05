use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::shared_session_v2::ExecutionTargetInput;

pub const SQUAD_SCHEMA_VERSION: u32 = 1;
pub const MAX_SQUAD_NODES: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadNodeKind {
    Analyze,
    Mutate,
    Verify,
    Synthesize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadPermissionClass {
    ReadOnly,
    CurrentWorkspace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadRunStatus {
    Planning,
    AwaitingApproval,
    Running,
    Cancelling,
    Succeeded,
    Failed,
    Blocked,
    Cancelled,
}

impl SquadRunStatus {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::Blocked | Self::Cancelled
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadNodeStatus {
    Pending,
    Ready,
    Prepared,
    Running,
    Succeeded,
    Failed,
    Blocked,
    Cancelled,
}

impl SquadNodeStatus {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Succeeded | Self::Failed | Self::Blocked | Self::Cancelled
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadBudgetV1 {
    pub max_parallel_read_only: u8,
    pub max_node_attempts: u8,
    pub max_repair_attempts: u8,
    pub max_wall_clock_seconds: u32,
}

impl Default for SquadBudgetV1 {
    fn default() -> Self {
        Self {
            max_parallel_read_only: 3,
            max_node_attempts: 2,
            max_repair_attempts: 1,
            max_wall_clock_seconds: 1_800,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadPlanNodeV1 {
    pub id: String,
    pub title: String,
    pub kind: SquadNodeKind,
    pub goal: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    /// Internal adaptive-repair edge. Lead/user plans leave this empty; the orchestrator may set it only
    /// when a failed Verify outcome opens a bounded forward-repair branch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repair_of: Option<String>,
    pub target: ExecutionTargetInput,
    pub permission: SquadPermissionClass,
    pub max_attempts: u8,
    #[serde(default)]
    pub success_criteria: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadPlanProposalV1 {
    pub schema_version: u32,
    pub summary: String,
    pub budget: SquadBudgetV1,
    pub nodes: Vec<SquadPlanNodeV1>,
    pub final_node_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadOutcomeEvidenceV1 {
    pub label: String,
    pub detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadVerificationV1 {
    pub status: SquadVerificationStatus,
    #[serde(default)]
    pub checks: Vec<String>,
    #[serde(default)]
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadVerificationStatus {
    Passed,
    Failed,
    NotRun,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SquadTypedOutcomeEnvelopeV1 {
    pub schema_version: u32,
    pub status: SquadOutcomeStatus,
    pub summary: String,
    #[serde(default)]
    pub evidence: Vec<SquadOutcomeEvidenceV1>,
    #[serde(default)]
    pub artifacts: Vec<String>,
    #[serde(default)]
    pub changed_paths: Vec<String>,
    pub verification: SquadVerificationV1,
    #[serde(default)]
    pub proposed_repairs: Vec<String>,
    #[serde(default)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SquadOutcomeStatus {
    Succeeded,
    Failed,
    Blocked,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadAttemptProjectionV1 {
    pub attempt_id: String,
    pub binding_key: String,
    pub status: SquadNodeStatus,
    pub started_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_package: Option<SquadContextPackageProjectionV1>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadContextPackageProjectionV1 {
    pub package_id: String,
    pub source_checksum: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_sequence_exclusive: Option<i64>,
    pub through_sequence_inclusive: i64,
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadNodeProjectionV1 {
    pub node: SquadPlanNodeV1,
    pub status: SquadNodeStatus,
    #[serde(default)]
    pub attempts: Vec<SquadAttemptProjectionV1>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outcome: Option<SquadTypedOutcomeEnvelopeV1>,
    #[serde(default)]
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadProjectionV1 {
    pub schema_version: u32,
    pub run_id: String,
    pub workspace_id: String,
    pub workspace_root: String,
    pub session_id: String,
    pub request_text: String,
    pub lead_target: ExecutionTargetInput,
    pub status: SquadRunStatus,
    pub plan_revision: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<SquadPlanProposalV1>,
    #[serde(default)]
    pub nodes: Vec<SquadNodeProjectionV1>,
    #[serde(default)]
    pub active_attempt_ids: Vec<String>,
    #[serde(default)]
    pub diagnostics: Vec<String>,
    pub requested_at: i64,
    #[serde(default)]
    pub approved_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadPreparedAttemptV1 {
    pub run_id: String,
    pub node_id: String,
    pub node_kind: SquadNodeKind,
    pub attempt_id: String,
    pub logical_turn_id: String,
    pub binding_key: String,
    pub target: ExecutionTargetInput,
    pub permission: SquadPermissionClass,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadClaimReadyResultV1 {
    pub projection: SquadProjectionV1,
    pub prepared: Vec<SquadPreparedAttemptV1>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::EngineType;
    use crate::shared_event_log::canonical::types::CanonicalProviderProfileSource;

    fn target() -> ExecutionTargetInput {
        ExecutionTargetInput {
            engine: EngineType::Codex,
            provider_profile_id: None,
            model_catalog_entry_id: Some("gpt-5".to_string()),
            model: Some("gpt-5".to_string()),
            reasoning_effort: Some("high".to_string()),
            provider_profile_name_snapshot: Some("Local".to_string()),
            provider_profile_source: Some(CanonicalProviderProfileSource::Local),
            runtime_capability_fingerprint: None,
        }
    }

    #[test]
    fn plan_wire_contract_round_trips() {
        let plan = SquadPlanProposalV1 {
            schema_version: SQUAD_SCHEMA_VERSION,
            summary: "并行分析后写入并验证".to_string(),
            budget: SquadBudgetV1::default(),
            nodes: vec![SquadPlanNodeV1 {
                id: "final".to_string(),
                title: "汇总".to_string(),
                kind: SquadNodeKind::Synthesize,
                goal: "输出最终结论".to_string(),
                depends_on: vec![],
                repair_of: None,
                target: target(),
                permission: SquadPermissionClass::ReadOnly,
                max_attempts: 1,
                success_criteria: vec!["给出结果".to_string()],
            }],
            final_node_id: "final".to_string(),
        };
        let encoded = serde_json::to_value(&plan).expect("serialize");
        let decoded: SquadPlanProposalV1 = serde_json::from_value(encoded).expect("deserialize");
        assert_eq!(decoded, plan);
    }
}
