//! OMP-owned lifecycle boundary for agents and background jobs.
//!
//! The local OMP evidence proves an ACP host and generic RPC `job_*` control
//! frames, but it does not prove a delegated-task API or a Todo/Plan/Compact/
//! Handoff schema. This module therefore accepts only observed lifecycle facts,
//! keeps ownership explicit, and returns typed `unsupported`/`unknown` results
//! instead of starting work from guessed protocol payloads.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum OmpLifecycleStatus {
    Supported,
    CompatInput,
    Unsupported,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum OmpWorkKind {
    Agent,
    DelegatedTask,
    BackgroundJob,
    Join,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum OmpWorkState {
    Queued,
    Running,
    CancelRequested,
    Completed,
    Cancelled,
    Failed,
    Unsupported,
}

impl OmpWorkState {
    fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Cancelled | Self::Failed | Self::Unsupported
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpLifecycleOwner {
    pub workspace_id: String,
    pub runtime_profile_id: String,
    pub provider_profile_id: String,
    pub native_session_id: String,
    /// The foreground turn is context only. Background settlement MUST NOT
    /// mutate or settle this turn.
    pub foreground_turn_id: Option<String>,
}

impl OmpLifecycleOwner {
    pub(crate) fn new(
        workspace_id: impl Into<String>,
        runtime_profile_id: impl Into<String>,
        provider_profile_id: impl Into<String>,
        native_session_id: impl Into<String>,
        foreground_turn_id: Option<String>,
    ) -> Result<Self, String> {
        let owner = Self {
            workspace_id: workspace_id.into(),
            runtime_profile_id: runtime_profile_id.into(),
            provider_profile_id: provider_profile_id.into(),
            native_session_id: native_session_id.into(),
            foreground_turn_id,
        };
        owner.validate()?;
        Ok(owner)
    }

    fn validate(&self) -> Result<(), String> {
        for (label, value) in [
            ("workspace_id", self.workspace_id.as_str()),
            ("runtime_profile_id", self.runtime_profile_id.as_str()),
            ("provider_profile_id", self.provider_profile_id.as_str()),
            ("native_session_id", self.native_session_id.as_str()),
        ] {
            if value.trim().is_empty() || value.chars().any(char::is_control) {
                return Err(format!("invalid OMP lifecycle owner {label}"));
            }
        }
        if self
            .foreground_turn_id
            .as_deref()
            .is_some_and(|value| value.trim().is_empty() || value.chars().any(char::is_control))
        {
            return Err("invalid OMP lifecycle owner foreground_turn_id".to_string());
        }
        Ok(())
    }

    fn scope_key(&self) -> String {
        [
            self.workspace_id.as_str(),
            self.runtime_profile_id.as_str(),
            self.provider_profile_id.as_str(),
            self.native_session_id.as_str(),
            self.foreground_turn_id.as_deref().unwrap_or("-"),
        ]
        .into_iter()
        .map(escape_id_component)
        .collect::<Vec<_>>()
        .join("\u{0}")
    }
}

fn escape_id_component(value: &str) -> String {
    value
        .replace('%', "%25")
        .replace(':', "%3A")
        .replace('\u{0}', "%00")
}

fn redact_lifecycle_value(value: Value) -> Value {
    match value {
        Value::Object(mut object) => {
            for (key, entry) in object.iter_mut() {
                let sensitive = matches!(
                    key.to_ascii_lowercase().as_str(),
                    "api-key"
                        | "apikey"
                        | "authorization"
                        | "cookie"
                        | "credential"
                        | "password"
                        | "secret"
                        | "token"
                );
                if sensitive {
                    *entry = Value::String("[REDACTED]".to_string());
                } else {
                    let current = std::mem::take(entry);
                    *entry = redact_lifecycle_value(current);
                }
            }
            Value::Object(object)
        }
        Value::Array(values) => {
            Value::Array(values.into_iter().map(redact_lifecycle_value).collect())
        }
        other => other,
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpLifecycleAudit {
    pub action: String,
    pub source: String,
    pub redacted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpLifecycleRecord {
    pub stable_id: String,
    pub kind: OmpWorkKind,
    pub owner: OmpLifecycleOwner,
    pub parent_stable_id: Option<String>,
    pub state: OmpWorkState,
    pub status: OmpLifecycleStatus,
    pub terminal_reason: Option<String>,
    pub result: Option<Value>,
    pub audit: OmpLifecycleAudit,
    pub updated_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmpUnsupportedOperation {
    pub status: OmpLifecycleStatus,
    pub capability: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum OmpLifecycleError {
    InvalidId(String),
    NotFound(String),
    OwnerMismatch,
    AlreadyTerminal,
}

impl std::fmt::Display for OmpLifecycleError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidId(id) => write!(formatter, "invalid OMP lifecycle id: {id}"),
            Self::NotFound(id) => write!(formatter, "OMP lifecycle record not found: {id}"),
            Self::OwnerMismatch => formatter.write_str("OMP lifecycle owner mismatch"),
            Self::AlreadyTerminal => {
                formatter.write_str("OMP lifecycle record is already terminal")
            }
        }
    }
}

impl std::error::Error for OmpLifecycleError {}

#[derive(Debug, Default)]
pub(crate) struct OmpLifecycleBoundary {
    records: HashMap<String, OmpLifecycleRecord>,
    clock_ms: u64,
}

impl OmpLifecycleBoundary {
    pub(crate) fn observe(
        &mut self,
        owner: OmpLifecycleOwner,
        kind: OmpWorkKind,
        native_id: &str,
        state: OmpWorkState,
        parent_stable_id: Option<String>,
        payload: Option<Value>,
    ) -> Result<OmpLifecycleRecord, OmpLifecycleError> {
        owner.validate().map_err(OmpLifecycleError::InvalidId)?;
        let stable_id = stable_omp_id(&owner, kind, native_id)?;
        let status = match kind {
            // Generic job control frames are observed, but their full schema is
            // not verified. They are safe as compat input, not as an executor.
            OmpWorkKind::BackgroundJob => OmpLifecycleStatus::CompatInput,
            OmpWorkKind::Agent | OmpWorkKind::DelegatedTask | OmpWorkKind::Join => {
                OmpLifecycleStatus::Unknown
            }
        };
        self.clock_ms = self.clock_ms.saturating_add(1);
        let record = OmpLifecycleRecord {
            stable_id: stable_id.clone(),
            kind,
            owner,
            parent_stable_id,
            state,
            status,
            terminal_reason: None,
            result: payload.map(redact_lifecycle_value),
            audit: OmpLifecycleAudit {
                action: "observe".to_string(),
                source: "native-observation".to_string(),
                redacted: true,
            },
            updated_at_ms: self.clock_ms,
        };
        self.records.insert(stable_id, record.clone());
        Ok(record)
    }

    /// Delegated task invocation is deliberately fail-closed: no native OMP
    /// evidence proves the command, payload, or permission semantics.
    pub(crate) fn request_delegated_task(
        &self,
        _owner: &OmpLifecycleOwner,
    ) -> OmpUnsupportedOperation {
        OmpUnsupportedOperation {
            status: OmpLifecycleStatus::Unsupported,
            capability: "omp.delegated-task".to_string(),
            reason: "OMP native evidence does not prove a delegated-task invocation contract"
                .to_string(),
        }
    }

    pub(crate) fn request_cancel(
        &mut self,
        owner: &OmpLifecycleOwner,
        stable_id: &str,
    ) -> Result<OmpLifecycleRecord, OmpLifecycleError> {
        let record = self
            .records
            .get_mut(stable_id)
            .ok_or_else(|| OmpLifecycleError::NotFound(stable_id.to_string()))?;
        if record.owner != *owner {
            return Err(OmpLifecycleError::OwnerMismatch);
        }
        if record.state.is_terminal() {
            return Err(OmpLifecycleError::AlreadyTerminal);
        }
        record.state = OmpWorkState::CancelRequested;
        self.clock_ms = self.clock_ms.saturating_add(1);
        record.audit = OmpLifecycleAudit {
            action: "cancel-requested".to_string(),
            source: "local-user".to_string(),
            redacted: true,
        };
        record.updated_at_ms = self.clock_ms;
        Ok(record.clone())
    }

    pub(crate) fn settle(
        &mut self,
        owner: &OmpLifecycleOwner,
        stable_id: &str,
        state: OmpWorkState,
        reason: impl Into<String>,
        result: Option<Value>,
    ) -> Result<OmpLifecycleRecord, OmpLifecycleError> {
        if !state.is_terminal() {
            return Err(OmpLifecycleError::InvalidId(
                "settlement state must be terminal".to_string(),
            ));
        }
        let record = self
            .records
            .get_mut(stable_id)
            .ok_or_else(|| OmpLifecycleError::NotFound(stable_id.to_string()))?;
        if record.owner != *owner {
            return Err(OmpLifecycleError::OwnerMismatch);
        }
        if record.state.is_terminal() {
            return Ok(record.clone());
        }
        record.state = state;
        record.terminal_reason = Some(reason.into());
        record.result = result.map(redact_lifecycle_value);
        self.clock_ms = self.clock_ms.saturating_add(1);
        record.audit = OmpLifecycleAudit {
            action: "settled".to_string(),
            source: "native-observation".to_string(),
            redacted: true,
        };
        record.updated_at_ms = self.clock_ms;
        Ok(record.clone())
    }

    pub(crate) fn get(&self, stable_id: &str) -> Option<&OmpLifecycleRecord> {
        self.records.get(stable_id)
    }

    pub(crate) fn list_for_owner(&self, owner: &OmpLifecycleOwner) -> Vec<OmpLifecycleRecord> {
        self.records
            .values()
            .filter(|record| record.owner == *owner)
            .cloned()
            .collect()
    }
}

pub(crate) fn stable_omp_id(
    owner: &OmpLifecycleOwner,
    kind: OmpWorkKind,
    native_id: &str,
) -> Result<String, OmpLifecycleError> {
    let native_id = native_id.trim();
    if native_id.is_empty() || native_id.chars().any(char::is_control) {
        return Err(OmpLifecycleError::InvalidId(native_id.to_string()));
    }
    let kind = match kind {
        OmpWorkKind::Agent => "agent",
        OmpWorkKind::DelegatedTask => "task",
        OmpWorkKind::BackgroundJob => "job",
        OmpWorkKind::Join => "join",
    };
    Ok(format!(
        "omp:{kind}:{}:{}:{}:{}:{}:{}",
        escape_id_component(&owner.workspace_id),
        escape_id_component(&owner.runtime_profile_id),
        escape_id_component(&owner.provider_profile_id),
        escape_id_component(&owner.native_session_id),
        escape_id_component(native_id),
        escape_id_component(owner.foreground_turn_id.as_deref().unwrap_or("-"))
    ))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OmpFeature {
    Agents,
    Jobs,
    Todo,
    Plan,
    Compact,
    Handoff,
}

pub(crate) fn omp_feature_status(feature: OmpFeature) -> OmpLifecycleStatus {
    match feature {
        OmpFeature::Jobs => OmpLifecycleStatus::CompatInput,
        OmpFeature::Agents => OmpLifecycleStatus::Unknown,
        OmpFeature::Todo | OmpFeature::Plan | OmpFeature::Compact | OmpFeature::Handoff => {
            OmpLifecycleStatus::Unknown
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn owner(turn: &str) -> OmpLifecycleOwner {
        OmpLifecycleOwner::new(
            "ws",
            "runtime",
            "provider",
            "session",
            Some(turn.to_string()),
        )
        .unwrap()
    }

    #[test]
    fn stable_ids_include_kind_and_all_owner_dimensions() {
        let first =
            stable_omp_id(&owner("turn-a"), OmpWorkKind::BackgroundJob, "native-1").unwrap();
        let second =
            stable_omp_id(&owner("turn-b"), OmpWorkKind::BackgroundJob, "native-1").unwrap();
        assert_ne!(first, second);
        assert!(first.starts_with("omp:job:ws:runtime:provider:session:native-1:"));
    }

    #[test]
    fn cancel_requires_same_owner_and_terminal_settlement_is_idempotent() {
        let mut boundary = OmpLifecycleBoundary::default();
        let first = boundary
            .observe(
                owner("turn-a"),
                OmpWorkKind::BackgroundJob,
                "job-1",
                OmpWorkState::Running,
                None,
                None,
            )
            .unwrap();
        assert_eq!(
            boundary.request_cancel(&owner("turn-b"), &first.stable_id),
            Err(OmpLifecycleError::OwnerMismatch)
        );
        let cancelled = boundary
            .request_cancel(&owner("turn-a"), &first.stable_id)
            .unwrap();
        assert_eq!(cancelled.state, OmpWorkState::CancelRequested);
        let settled = boundary
            .settle(
                &owner("turn-a"),
                &first.stable_id,
                OmpWorkState::Cancelled,
                "user requested",
                Some(json!({"redacted": true})),
            )
            .unwrap();
        let replay = boundary
            .settle(
                &owner("turn-a"),
                &first.stable_id,
                OmpWorkState::Completed,
                "late completion",
                None,
            )
            .unwrap();
        assert_eq!(settled, replay);
    }

    #[test]
    fn background_settlement_preserves_foreground_turn_and_scope() {
        let mut boundary = OmpLifecycleBoundary::default();
        let foreground = owner("foreground");
        let record = boundary
            .observe(
                foreground.clone(),
                OmpWorkKind::BackgroundJob,
                "job-1",
                OmpWorkState::Running,
                None,
                None,
            )
            .unwrap();
        let settled = boundary
            .settle(
                &foreground,
                &record.stable_id,
                OmpWorkState::Completed,
                "job complete",
                Some(json!({"output": "feature-local"})),
            )
            .unwrap();
        assert_eq!(
            settled.owner.foreground_turn_id.as_deref(),
            Some("foreground")
        );
        assert_eq!(settled.state, OmpWorkState::Completed);
        assert_eq!(boundary.list_for_owner(&foreground).len(), 1);
    }

    #[test]
    fn delegated_task_is_explicitly_unsupported_without_execution() {
        let boundary = OmpLifecycleBoundary::default();
        let result = boundary.request_delegated_task(&owner("turn"));
        assert_eq!(result.status, OmpLifecycleStatus::Unsupported);
        assert_eq!(result.capability, "omp.delegated-task");
    }

    #[test]
    fn observed_payloads_are_redacted_and_audited() {
        let mut boundary = OmpLifecycleBoundary::default();
        let record = boundary
            .observe(
                owner("turn"),
                OmpWorkKind::BackgroundJob,
                "job-secret",
                OmpWorkState::Running,
                None,
                Some(json!({"token": "secret", "nested": {"password": "pw"}})),
            )
            .unwrap();
        assert_eq!(
            record.result,
            Some(json!({"token": "[REDACTED]", "nested": {"password": "[REDACTED]"}}))
        );
        assert!(record.audit.redacted);
        assert_eq!(record.audit.source, "native-observation");
    }

    #[test]
    fn feature_status_does_not_overclaim_unverified_surfaces() {
        assert_eq!(
            omp_feature_status(OmpFeature::Jobs),
            OmpLifecycleStatus::CompatInput
        );
        for feature in [
            OmpFeature::Agents,
            OmpFeature::Todo,
            OmpFeature::Plan,
            OmpFeature::Compact,
            OmpFeature::Handoff,
        ] {
            assert_eq!(omp_feature_status(feature), OmpLifecycleStatus::Unknown);
        }
    }
}
