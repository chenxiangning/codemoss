//! Multi-Agent 协作：多 CLI 分环节串行编排。
//!
//! 产品语义（非单模型流水线）：
//! - stages 有序；每 stage 可绑不同 CLI + Provider + Model
//! - 主幕布展示编排组合与状态
//! - 分屏直播当前 stage
//! - 完成态只给短汇总

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::shared_session_v2::ExecutionTargetInput;

pub const AGENT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentRunStatus {
    /// 规划 stage 运行中
    Planning,
    /// 规划完成，等人确认后才进入实现
    AwaitingApproval,
    /// 实现 stage 运行中
    Implementing,
    /// 审查 stage 运行中
    Reviewing,
    Succeeded,
    Failed,
    Cancelled,
}

impl AgentRunStatus {
    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Succeeded | Self::Failed | Self::Cancelled)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Planning => "planning",
            Self::AwaitingApproval => "awaiting-approval",
            Self::Implementing => "implementing",
            Self::Reviewing => "reviewing",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "planning" => Some(Self::Planning),
            "awaiting-approval" => Some(Self::AwaitingApproval),
            "implementing" | "executing" => Some(Self::Implementing),
            "reviewing" => Some(Self::Reviewing),
            "succeeded" => Some(Self::Succeeded),
            "failed" | "blocked" => Some(Self::Failed),
            "cancelled" => Some(Self::Cancelled),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentStageId {
    Plan,
    Implement,
    Review,
}

impl AgentStageId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Plan => "plan",
            Self::Implement => "implement",
            Self::Review => "review",
        }
    }

    pub fn title(self) -> &'static str {
        match self {
            Self::Plan => "规划",
            Self::Implement => "实现",
            Self::Review => "审查",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "plan" | "lead" => Some(Self::Plan),
            "implement" | "execute" | "mutate" | "worker" => Some(Self::Implement),
            "review" | "verify" | "synthesize" => Some(Self::Review),
            _ => None,
        }
    }

    pub fn order(self) -> u8 {
        match self {
            Self::Plan => 0,
            Self::Implement => 1,
            Self::Review => 2,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentStageStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Skipped,
}

impl AgentStageStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Skipped => "skipped",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pending" => Some(Self::Pending),
            "running" | "prepared" => Some(Self::Running),
            "succeeded" => Some(Self::Succeeded),
            "failed" | "blocked" => Some(Self::Failed),
            "skipped" | "cancelled" => Some(Self::Skipped),
            _ => None,
        }
    }
}

/// 请求时每段的绑定（前端可配）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStageBindingInput {
    pub id: String,
    pub target: ExecutionTargetInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStageProjectionV1 {
    pub id: String,
    pub title: String,
    pub role: String,
    pub target: ExecutionTargetInput,
    pub status: AgentStageStatus,
    /// read-only | current
    pub access_mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attempt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binding_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<i64>,
    /// 主时间线用一行结果，禁止塞全文
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub short_outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// 规划产物：给确认 UI 用，不是最终用户答案。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPlanDraftV1 {
    pub schema_version: u32,
    pub summary: String,
    pub markdown: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPreparedAttemptV1 {
    pub run_id: String,
    pub stage_id: String,
    pub attempt_id: String,
    pub logical_turn_id: String,
    pub binding_key: String,
    pub target: ExecutionTargetInput,
    pub access_mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProjectionV1 {
    pub schema_version: u32,
    pub run_id: String,
    pub workspace_id: String,
    pub workspace_root: String,
    pub session_id: String,
    pub request_text: String,
    /// 入口默认 target（兼容旧字段）；编排以 stages[].target 为准
    pub target: ExecutionTargetInput,
    pub status: AgentRunStatus,
    pub plan_revision: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan: Option<AgentPlanDraftV1>,
    pub stages: Vec<AgentStageProjectionV1>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub active_attempt_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagnostics: Vec<String>,
    pub requested_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<i64>,
    pub updated_at: i64,
    /// 主幕布短汇总（审查段产出，截断）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub final_summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCancelResultV1 {
    pub projection: AgentProjectionV1,
    pub attempt_ids: Vec<String>,
}

pub fn empty_extra() -> Value {
    Value::Object(Default::default())
}

pub fn default_stage_specs(default_target: &ExecutionTargetInput) -> Vec<AgentStageProjectionV1> {
    vec![
        AgentStageProjectionV1 {
            id: AgentStageId::Plan.as_str().into(),
            title: AgentStageId::Plan.title().into(),
            role: "planner".into(),
            target: default_target.clone(),
            status: AgentStageStatus::Pending,
            access_mode: "read-only".into(),
            attempt_id: None,
            binding_key: None,
            started_at: None,
            settled_at: None,
            short_outcome: None,
            error: None,
        },
        AgentStageProjectionV1 {
            id: AgentStageId::Implement.as_str().into(),
            title: AgentStageId::Implement.title().into(),
            role: "implementer".into(),
            target: default_target.clone(),
            status: AgentStageStatus::Pending,
            access_mode: "current".into(),
            attempt_id: None,
            binding_key: None,
            started_at: None,
            settled_at: None,
            short_outcome: None,
            error: None,
        },
        AgentStageProjectionV1 {
            id: AgentStageId::Review.as_str().into(),
            title: AgentStageId::Review.title().into(),
            role: "reviewer".into(),
            target: default_target.clone(),
            status: AgentStageStatus::Pending,
            access_mode: "read-only".into(),
            attempt_id: None,
            binding_key: None,
            started_at: None,
            settled_at: None,
            short_outcome: None,
            error: None,
        },
    ]
}

pub fn apply_stage_bindings(
    mut stages: Vec<AgentStageProjectionV1>,
    bindings: &[AgentStageBindingInput],
) -> Vec<AgentStageProjectionV1> {
    for binding in bindings {
        let id = binding.id.trim();
        if let Some(stage) = stages.iter_mut().find(|s| s.id == id) {
            stage.target = binding.target.clone();
        }
    }
    stages
}

pub fn short_text(raw: &str, max_chars: usize) -> String {
    let trimmed = raw.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut out: String = trimmed.chars().take(max_chars.saturating_sub(1)).collect();
    out.push('…');
    out
}
