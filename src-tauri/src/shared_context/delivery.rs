use serde_json::Value;

use crate::shared_event_log::canonical::types::{
    CanonicalFact, ContextMode, ContextOperation, DeliveryAcceptedFact, DeliveryPreparedFact,
};
use crate::shared_event_log::{BindingStateUpdate, SharedEventWriter, StoredBindingState};

use super::{ContextPackage, PendingDelivery};

#[derive(Debug, Clone)]
pub struct PrepareDeliveryRequest {
    pub session_id: String,
    pub binding_key: String,
    pub engine: String,
    pub provider_profile_id: Option<String>,
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_operation_id: String,
    pub package: ContextPackage,
    pub prepared_at: i64,
}

#[derive(Debug, Clone)]
pub struct MarkDeliverySentRequest {
    pub session_id: String,
    pub binding_key: String,
    pub attempt_id: String,
    pub binding_operation_id: String,
    pub native_session_id: String,
    pub native_request_id: String,
    pub sent_at: i64,
}

#[derive(Debug, Clone)]
pub struct AcceptDeliveryRequest {
    pub session_id: String,
    pub binding_key: String,
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_operation_id: String,
    pub package_id: String,
    pub native_session_id: Option<String>,
    pub native_request_id: Option<String>,
    pub accepted_at: i64,
}

fn canonical_mode(mode: super::ProjectionMode) -> ContextMode {
    match mode {
        super::ProjectionMode::NativeDelta => ContextMode::NativeDelta,
        super::ProjectionMode::NativeHistoryImport => ContextMode::NativeHistoryImport,
        super::ProjectionMode::NativeHistoryClone => ContextMode::NativeHistoryClone,
        super::ProjectionMode::PortableTranscript => ContextMode::PortableTranscript,
        super::ProjectionMode::Checkpoint => ContextMode::Checkpoint,
    }
}

fn canonical_operation(operation: &str) -> ContextOperation {
    if operation == "context-import" {
        ContextOperation::ContextImport
    } else {
        ContextOperation::PromptPrefix
    }
}

fn binding_update(
    existing: Option<&StoredBindingState>,
    session_id: &str,
    binding_key: &str,
    engine: &str,
    provider_profile_id: Option<String>,
    native_session_id: Option<String>,
    accepted: Option<i64>,
    committed: Option<i64>,
    pending: Option<&PendingDelivery>,
    updated_at: i64,
) -> Result<BindingStateUpdate, String> {
    Ok(BindingStateUpdate {
        session_id: session_id.to_string(),
        binding_key: binding_key.to_string(),
        engine: engine.to_string(),
        provider_profile_id: provider_profile_id
            .or_else(|| existing.and_then(|row| row.provider_profile_id.clone())),
        native_session_id: native_session_id
            .or_else(|| existing.and_then(|row| row.native_session_id.clone())),
        accepted_through_sequence: accepted
            .or_else(|| existing.and_then(|row| row.accepted_through_sequence)),
        committed_through_sequence: committed
            .or_else(|| existing.and_then(|row| row.committed_through_sequence)),
        provisioning_json: existing.and_then(|row| row.provisioning_json.clone()),
        pending_delivery_json: pending
            .map(|value| serde_json::to_string(value).map_err(|error| error.to_string()))
            .transpose()?,
        availability: existing
            .map(|row| row.availability.clone())
            .unwrap_or_else(|| "provisioning".to_string()),
        updated_at,
    })
}

pub fn prepare_delivery(
    writer: &SharedEventWriter,
    request: &PrepareDeliveryRequest,
) -> Result<PendingDelivery, String> {
    let existing = writer
        .binding_state(&request.session_id, &request.binding_key)
        .map_err(|error| error.to_string())?;
    if existing
        .as_ref()
        .and_then(|row| row.pending_delivery_json.as_deref())
        .is_some()
    {
        return Err(format!(
            "binding {} already has pending context delivery",
            request.binding_key
        ));
    }
    let pending = PendingDelivery {
        package_id: request.package.package_id.clone(),
        source_checksum: request.package.manifest.source_checksum.clone(),
        through_sequence: request.package.manifest.through_sequence_inclusive,
        operation: request.package.manifest.mode.operation().to_string(),
        phase: "prepared".to_string(),
        client_turn_id: request.logical_turn_id.clone(),
        attempt_id: request.attempt_id.clone(),
        binding_operation_id: Some(request.binding_operation_id.clone()),
        native_session_id: None,
        native_request_id: None,
        prepared_at: request.prepared_at,
        sent_at: None,
        accepted_at: None,
        probe_attempts: 0,
    };
    let fact = CanonicalFact::DeliveryPrepared(DeliveryPreparedFact {
        logical_turn_id: request.logical_turn_id.clone(),
        attempt_id: request.attempt_id.clone(),
        binding_key: request.binding_key.clone(),
        package_id: request.package.package_id.clone(),
        source_checksum: request.package.manifest.source_checksum.clone(),
        from_sequence_exclusive: request.package.manifest.from_sequence_exclusive,
        through_sequence_inclusive: request.package.manifest.through_sequence_inclusive,
        mode: canonical_mode(request.package.manifest.mode),
        operation: canonical_operation(&pending.operation),
        extra: serde_json::json!({"scope": request.package.manifest.scope}),
    });
    let binding = binding_update(
        existing.as_ref(),
        &request.session_id,
        &request.binding_key,
        &request.engine,
        request.provider_profile_id.clone(),
        None,
        None,
        None,
        Some(&pending),
        request.prepared_at,
    )?;
    writer
        .append_canonical_fact_with_binding_at(
            request.session_id.clone(),
            fact,
            request.prepared_at,
            &binding,
        )
        .map_err(|error| error.to_string())?;
    Ok(pending)
}

/// Runtime side effect 前的 durable CAS。`prepared` 是唯一能证明“尚未发送”的
/// phase；进入 `sent-awaiting-ack` 后，崩溃/断连都必须 Probe 或显式 replace，不能重发。
pub fn mark_delivery_sent(
    writer: &SharedEventWriter,
    request: &MarkDeliverySentRequest,
) -> Result<PendingDelivery, String> {
    let existing = writer
        .binding_state(&request.session_id, &request.binding_key)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "binding missing before runtime delivery".to_string())?;
    let mut pending: PendingDelivery = serde_json::from_str(
        existing
            .pending_delivery_json
            .as_deref()
            .ok_or_else(|| "pending context delivery missing".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if pending.attempt_id != request.attempt_id
        || pending.binding_operation_id.as_deref() != Some(request.binding_operation_id.as_str())
    {
        return Err("runtime delivery owner/generation mismatch".to_string());
    }
    if pending.phase != "prepared" {
        return Err(format!(
            "runtime delivery phase is '{}' for attempt {}",
            pending.phase, pending.attempt_id
        ));
    }
    pending.phase = "sent-awaiting-ack".to_string();
    pending.native_session_id = Some(request.native_session_id.clone());
    pending.native_request_id = Some(request.native_request_id.clone());
    pending.sent_at = Some(request.sent_at);
    let update = BindingStateUpdate {
        session_id: existing.session_id,
        binding_key: existing.binding_key,
        engine: existing.engine,
        provider_profile_id: existing.provider_profile_id,
        native_session_id: Some(request.native_session_id.clone()),
        accepted_through_sequence: existing.accepted_through_sequence,
        committed_through_sequence: existing.committed_through_sequence,
        provisioning_json: existing.provisioning_json,
        pending_delivery_json: Some(
            serde_json::to_string(&pending).map_err(|error| error.to_string())?,
        ),
        availability: existing.availability,
        updated_at: request.sent_at,
    };
    writer
        .upsert_binding_state(&update)
        .map_err(|error| error.to_string())?;
    Ok(pending)
}

pub fn accept_delivery(
    writer: &SharedEventWriter,
    request: &AcceptDeliveryRequest,
) -> Result<(), String> {
    let existing = writer
        .binding_state(&request.session_id, &request.binding_key)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "binding missing for context acceptance".to_string())?;
    let mut pending: PendingDelivery = serde_json::from_str(
        existing
            .pending_delivery_json
            .as_deref()
            .ok_or_else(|| "pending context delivery missing".to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if pending.package_id != request.package_id
        || pending.attempt_id != request.attempt_id
        || pending.client_turn_id != request.logical_turn_id
        || pending.binding_operation_id.as_deref() != Some(request.binding_operation_id.as_str())
    {
        return Err("context acceptance owner mismatch".to_string());
    }
    if pending.phase != "sent-awaiting-ack" {
        return Err(format!(
            "context acceptance arrived from invalid delivery phase '{}'",
            pending.phase
        ));
    }
    pending.phase = "accepted-awaiting-commit".to_string();
    pending.native_session_id = request.native_session_id.clone();
    pending.native_request_id = request.native_request_id.clone();
    pending.accepted_at = Some(request.accepted_at);
    let fact = CanonicalFact::DeliveryAccepted(DeliveryAcceptedFact {
        logical_turn_id: request.logical_turn_id.clone(),
        attempt_id: request.attempt_id.clone(),
        binding_key: request.binding_key.clone(),
        package_id: request.package_id.clone(),
        native_request_id: request.native_request_id.clone(),
        accepted_at: request.accepted_at,
        extra: Value::Object(Default::default()),
    });
    let binding = binding_update(
        Some(&existing),
        &request.session_id,
        &request.binding_key,
        &existing.engine,
        existing.provider_profile_id.clone(),
        request.native_session_id.clone(),
        Some(pending.through_sequence),
        None,
        Some(&pending),
        request.accepted_at,
    )?;
    writer
        .append_canonical_fact_with_binding_at(
            request.session_id.clone(),
            fact,
            request.accepted_at,
            &binding,
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn commit_delivery(
    writer: &SharedEventWriter,
    session_id: &str,
    binding_key: &str,
    attempt_id: &str,
    committed_at: i64,
) -> Result<Option<i64>, String> {
    let Some(existing) = writer
        .binding_state(session_id, binding_key)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };
    let Some(raw) = existing.pending_delivery_json.as_deref() else {
        return Ok(existing.committed_through_sequence);
    };
    let pending: PendingDelivery = serde_json::from_str(raw).map_err(|error| error.to_string())?;
    if pending.attempt_id != attempt_id {
        return Err("terminal commit does not own pending context delivery".to_string());
    }
    if pending.phase != "accepted-awaiting-commit" {
        return Err("terminal commit arrived before context acceptance".to_string());
    }
    let update = BindingStateUpdate {
        session_id: session_id.to_string(),
        binding_key: binding_key.to_string(),
        engine: existing.engine,
        provider_profile_id: existing.provider_profile_id,
        native_session_id: existing.native_session_id,
        accepted_through_sequence: existing.accepted_through_sequence,
        committed_through_sequence: Some(pending.through_sequence),
        provisioning_json: existing.provisioning_json,
        pending_delivery_json: None,
        availability: existing.availability,
        updated_at: committed_at,
    };
    writer
        .upsert_binding_state(&update)
        .map_err(|error| error.to_string())?;
    Ok(Some(pending.through_sequence))
}

pub fn terminal_binding_update(
    existing: &StoredBindingState,
    attempt_id: &str,
    native_session_id: Option<String>,
    provisioning_json: Option<String>,
    committed_at: i64,
) -> Result<Option<BindingStateUpdate>, String> {
    let Some(raw) = existing.pending_delivery_json.as_deref() else {
        return Ok(None);
    };
    let pending: PendingDelivery = serde_json::from_str(raw).map_err(|error| error.to_string())?;
    if pending.attempt_id != attempt_id {
        return Err("terminal commit does not own pending context delivery".to_string());
    }
    if pending.phase != "accepted-awaiting-commit" {
        return Err("terminal commit arrived before context acceptance".to_string());
    }
    Ok(Some(BindingStateUpdate {
        session_id: existing.session_id.clone(),
        binding_key: existing.binding_key.clone(),
        engine: existing.engine.clone(),
        provider_profile_id: existing.provider_profile_id.clone(),
        native_session_id: native_session_id.or_else(|| existing.native_session_id.clone()),
        accepted_through_sequence: existing.accepted_through_sequence,
        committed_through_sequence: Some(pending.through_sequence),
        provisioning_json,
        pending_delivery_json: None,
        availability: "ready".to_string(),
        updated_at: committed_at,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operation_mapping_is_fail_closed_to_prompt_prefix() {
        assert_eq!(
            canonical_operation("context-import"),
            ContextOperation::ContextImport
        );
        assert_eq!(
            canonical_operation("unknown"),
            ContextOperation::PromptPrefix
        );
    }
}
