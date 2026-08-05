//! Canonical Fact 类型定义。
//!
//! 字段与命名尽量与 Wave 0 JSON Schema（`shared-canonical-entry.schema.json`）保持一致；
//! 未知字段在序列化时保留（通过 `serde_json::Value` 额外属性容器），以支持 round-trip。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 全部 Shared Canonical Fact 变体。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanonicalFact {
    #[serde(rename = "conversation.turnRequested")]
    TurnRequested(TurnRequestedFact),
    #[serde(rename = "context.deliveryPrepared")]
    DeliveryPrepared(DeliveryPreparedFact),
    #[serde(rename = "context.deliveryAccepted")]
    DeliveryAccepted(DeliveryAcceptedFact),
    #[serde(rename = "conversation.turnAccepted")]
    TurnAccepted(TurnAcceptedFact),
    #[serde(rename = "conversation.turnCommitted")]
    TurnCommitted(TurnCommittedFact),
    #[serde(rename = "conversation.usageRecorded")]
    UsageRecorded(UsageRecordedFact),
    #[serde(rename = "conversation.controlFact")]
    Control(ControlFact),
    #[serde(rename = "squad.runRequested")]
    SquadRunRequested(SquadRunRequestedFact),
    #[serde(rename = "squad.planProposed")]
    SquadPlanProposed(SquadPlanProposedFact),
    #[serde(rename = "squad.planApproved")]
    SquadPlanApproved(SquadPlanApprovedFact),
    #[serde(rename = "squad.planRevised")]
    SquadPlanRevised(SquadPlanRevisedFact),
    #[serde(rename = "squad.nodeDispatchPrepared")]
    SquadNodeDispatchPrepared(SquadNodeDispatchPreparedFact),
    #[serde(rename = "squad.nodeAttemptLinked")]
    SquadNodeAttemptLinked(SquadNodeAttemptLinkedFact),
    #[serde(rename = "squad.nodeOutcomeRecorded")]
    SquadNodeOutcomeRecorded(SquadNodeOutcomeRecordedFact),
    #[serde(rename = "squad.verificationRecorded")]
    SquadVerificationRecorded(SquadVerificationRecordedFact),
    #[serde(rename = "squad.mutationLeaseChanged")]
    SquadMutationLeaseChanged(SquadMutationLeaseChangedFact),
    #[serde(rename = "squad.branchBlocked")]
    SquadBranchBlocked(SquadBranchBlockedFact),
    #[serde(rename = "squad.cancelRequested")]
    SquadCancelRequested(SquadCancelRequestedFact),
    #[serde(rename = "squad.runSettled")]
    SquadRunSettled(SquadRunSettledFact),
}

impl CanonicalFact {
    /// 返回 fact 的 type 字符串（与 Schema `factType` 对应）。
    pub fn fact_type(&self) -> &'static str {
        match self {
            Self::TurnRequested(_) => "conversation.turnRequested",
            Self::DeliveryPrepared(_) => "context.deliveryPrepared",
            Self::DeliveryAccepted(_) => "context.deliveryAccepted",
            Self::TurnAccepted(_) => "conversation.turnAccepted",
            Self::TurnCommitted(_) => "conversation.turnCommitted",
            Self::UsageRecorded(_) => "conversation.usageRecorded",
            Self::Control(_) => "conversation.controlFact",
            Self::SquadRunRequested(_) => "squad.runRequested",
            Self::SquadPlanProposed(_) => "squad.planProposed",
            Self::SquadPlanApproved(_) => "squad.planApproved",
            Self::SquadPlanRevised(_) => "squad.planRevised",
            Self::SquadNodeDispatchPrepared(_) => "squad.nodeDispatchPrepared",
            Self::SquadNodeAttemptLinked(_) => "squad.nodeAttemptLinked",
            Self::SquadNodeOutcomeRecorded(_) => "squad.nodeOutcomeRecorded",
            Self::SquadVerificationRecorded(_) => "squad.verificationRecorded",
            Self::SquadMutationLeaseChanged(_) => "squad.mutationLeaseChanged",
            Self::SquadBranchBlocked(_) => "squad.branchBlocked",
            Self::SquadCancelRequested(_) => "squad.cancelRequested",
            Self::SquadRunSettled(_) => "squad.runSettled",
        }
    }

    /// 返回 attemptId（若该 fact 类型拥有 attempt）。
    pub fn attempt_id(&self) -> Option<&str> {
        match self {
            Self::TurnRequested(f) => Some(&f.attempt_id),
            Self::DeliveryPrepared(f) => Some(&f.attempt_id),
            Self::DeliveryAccepted(f) => Some(&f.attempt_id),
            Self::TurnAccepted(f) => Some(&f.attempt_id),
            Self::TurnCommitted(f) => Some(&f.attempt_id),
            Self::UsageRecorded(f) => Some(&f.attempt_id),
            Self::Control(f) => f.attempt_id.as_deref(),
            Self::SquadNodeDispatchPrepared(f) => Some(&f.attempt_id),
            Self::SquadNodeAttemptLinked(f) => Some(&f.attempt_id),
            Self::SquadNodeOutcomeRecorded(f) => Some(&f.attempt_id),
            Self::SquadVerificationRecorded(f) => Some(&f.attempt_id),
            Self::SquadRunRequested(_)
            | Self::SquadPlanProposed(_)
            | Self::SquadPlanApproved(_)
            | Self::SquadPlanRevised(_)
            | Self::SquadMutationLeaseChanged(_)
            | Self::SquadBranchBlocked(_)
            | Self::SquadCancelRequested(_)
            | Self::SquadRunSettled(_) => None,
        }
    }

    /// 返回 dedupe_key（仅 usageRecorded 使用 `usageRecordId`）。
    pub fn dedupe_key(&self) -> Option<&str> {
        match self {
            Self::UsageRecorded(f) => Some(&f.usage_record_id),
            Self::SquadRunRequested(f) => Some(&f.fact_id),
            Self::SquadPlanProposed(f) => Some(&f.fact_id),
            Self::SquadPlanApproved(f) => Some(&f.fact_id),
            Self::SquadPlanRevised(f) => Some(&f.fact_id),
            Self::SquadNodeDispatchPrepared(f) => Some(&f.fact_id),
            Self::SquadNodeAttemptLinked(f) => Some(&f.fact_id),
            Self::SquadNodeOutcomeRecorded(f) => Some(&f.fact_id),
            Self::SquadVerificationRecorded(f) => Some(&f.fact_id),
            Self::SquadMutationLeaseChanged(f) => Some(&f.fact_id),
            Self::SquadBranchBlocked(f) => Some(&f.fact_id),
            Self::SquadCancelRequested(f) => Some(&f.fact_id),
            Self::SquadRunSettled(f) => Some(&f.fact_id),
            _ => None,
        }
    }

    /// 返回 logicalTurnId（若存在）。
    pub fn logical_turn_id(&self) -> Option<&str> {
        match self {
            Self::TurnRequested(f) => Some(&f.logical_turn_id),
            Self::DeliveryPrepared(f) => Some(&f.logical_turn_id),
            Self::DeliveryAccepted(f) => Some(&f.logical_turn_id),
            Self::TurnAccepted(f) => Some(&f.logical_turn_id),
            Self::TurnCommitted(f) => Some(&f.logical_turn_id),
            Self::UsageRecorded(f) => Some(&f.logical_turn_id),
            Self::Control(f) => f.logical_turn_id.as_deref(),
            Self::SquadRunRequested(_)
            | Self::SquadPlanProposed(_)
            | Self::SquadPlanApproved(_)
            | Self::SquadPlanRevised(_)
            | Self::SquadNodeDispatchPrepared(_)
            | Self::SquadNodeAttemptLinked(_)
            | Self::SquadNodeOutcomeRecorded(_)
            | Self::SquadVerificationRecorded(_)
            | Self::SquadMutationLeaseChanged(_)
            | Self::SquadBranchBlocked(_)
            | Self::SquadCancelRequested(_)
            | Self::SquadRunSettled(_) => None,
        }
    }
}

/// `conversation.turnRequested`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnRequestedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_of_attempt_id: Option<String>,
    pub input: CanonicalUserInput,
    pub target: TurnExecutionSnapshot,
    pub requested_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `context.deliveryPrepared`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryPreparedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub package_id: String,
    pub source_checksum: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_sequence_exclusive: Option<i64>,
    pub through_sequence_inclusive: i64,
    pub mode: ContextMode,
    pub operation: ContextOperation,
    #[serde(flatten)]
    pub extra: Value,
}

/// `context.deliveryAccepted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryAcceptedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub package_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_request_id: Option<String>,
    pub accepted_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.turnAccepted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnAcceptedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub client_turn_id: String,
    pub binding_key: String,
    pub native_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_turn_id: Option<String>,
    pub accepted_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.turnCommitted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnCommittedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub input_entry_id: String,
    pub assistant: CanonicalAssistantBlocks,
    pub atomic_tool_exchanges: Vec<AtomicToolExchange>,
    pub artifact_refs: Vec<ArtifactRef>,
    pub target: TurnExecutionSnapshot,
    pub provider_private_refs: Vec<ProviderPrivateRef>,
    pub omissions: Vec<CanonicalOmission>,
    pub outcome: Outcome,
    pub committed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.usageRecorded`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageRecordedFact {
    pub usage_record_id: String,
    pub report_subject_id: String,
    pub revision: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supersedes_usage_record_id: Option<String>,
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub native_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_turn_id: Option<String>,
    pub target: TurnExecutionSnapshot,
    pub usage: UsageShape,
    pub source: UsageSource,
    pub verification: UsageVerification,
    pub observed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.controlFact`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlFact {
    pub control_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logical_turn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    #[serde(flatten)]
    pub extra: Value,
}

/// Shared Session Agent Squad facts. `factId` is the stable idempotency key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadRunRequestedFact {
    pub fact_id: String,
    pub run_id: String,
    pub workspace_id: String,
    pub request_text: String,
    pub lead_target: TurnExecutionSnapshot,
    pub requested_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadPlanProposedFact {
    pub fact_id: String,
    pub run_id: String,
    pub revision: u32,
    pub plan: Value,
    pub proposed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadPlanApprovedFact {
    pub fact_id: String,
    pub run_id: String,
    pub revision: u32,
    pub approved_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadPlanRevisedFact {
    pub fact_id: String,
    pub run_id: String,
    pub revision: u32,
    pub plan: Value,
    pub revised_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadNodeDispatchPreparedFact {
    pub fact_id: String,
    pub run_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub worker_binding_key: String,
    pub target: TurnExecutionSnapshot,
    pub permission_class: String,
    pub prepared_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadNodeAttemptLinkedFact {
    pub fact_id: String,
    pub run_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub logical_turn_id: String,
    pub worker_binding_key: String,
    pub linked_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadNodeOutcomeRecordedFact {
    pub fact_id: String,
    pub run_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub outcome: Value,
    pub recorded_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadVerificationRecordedFact {
    pub fact_id: String,
    pub run_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub verification: Value,
    pub recorded_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadMutationLeaseChangedFact {
    pub fact_id: String,
    pub run_id: String,
    pub workspace_id: String,
    pub node_id: String,
    pub attempt_id: String,
    pub lease_epoch: u64,
    pub change: String,
    pub changed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadBranchBlockedFact {
    pub fact_id: String,
    pub run_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    pub blocked_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadCancelRequestedFact {
    pub fact_id: String,
    pub run_id: String,
    pub reason: String,
    pub requested_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SquadRunSettledFact {
    pub fact_id: String,
    pub run_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub settled_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalUserInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_refs: Option<Vec<ArtifactRef>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachment_refs: Option<Vec<ArtifactRef>>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnExecutionSnapshot {
    pub engine: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_catalog_entry_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<ReasoningSelection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_name_snapshot: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_source: Option<CanonicalProviderProfileSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_capability_fingerprint: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CanonicalProviderProfileSource {
    Local,
    Managed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningSelection {
    pub effort: String,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CanonicalAssistantBlocks {
    pub blocks: Vec<CanonicalBlock>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case", tag = "kind")]
pub enum CanonicalBlock {
    Text {
        text: String,
    },
    Reasoning {
        text: String,
    },
    RedactedReasoning {
        #[serde(rename = "artifactRef")]
        #[serde(skip_serializing_if = "Option::is_none")]
        artifact_ref: Option<ArtifactRef>,
    },
    ArtifactRef {
        #[serde(rename = "artifactRef")]
        artifact_ref: ArtifactRef,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomicToolExchange {
    pub tool_call_id: String,
    pub tool_name: String,
    pub call: ToolCall,
    pub result: ToolResult,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments_artifact_ref: Option<ArtifactRef>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub status: ToolResultStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_artifact_ref: Option<ArtifactRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolResultStatus {
    Completed,
    Error,
    Incomplete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    pub artifact_id: String,
    pub media_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    pub sha256: String,
    pub locator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redaction: Option<Value>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalOmission {
    pub category: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retrievable_ref: Option<String>,
    pub disposition: OmissionDisposition,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmissionDisposition {
    RetrievableOnDemand,
    NotRetrievable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPrivateRef {
    pub ref_id: String,
    pub engine: String,
    pub kind: ProviderPrivateRefKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_ref: Option<ArtifactRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opaque_ref: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderPrivateRefKind {
    ReasoningSignature,
    EncryptedThinking,
    ProviderRaw,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub status: OutcomeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OutcomeStatus {
    Completed,
    Failed,
    Cancelled,
    Replaced,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageShape {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_input_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_reported_cost: Option<ProviderReportedCost>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderReportedCost {
    pub amount: String,
    pub currency: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsageSource {
    RuntimeFinal,
    ProviderReport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsageVerification {
    Verified,
    Unverified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContextMode {
    NativeDelta,
    NativeHistoryImport,
    NativeHistoryClone,
    PortableTranscript,
    Checkpoint,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContextOperation {
    ContextImport,
    PromptPrefix,
}
