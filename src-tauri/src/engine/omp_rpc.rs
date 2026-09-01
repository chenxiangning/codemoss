//! OMP-owned Native RPC control-plane state.

use std::collections::HashMap;

use serde_json::Value;
use super::omp_release::OMP_METRICS;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpRpcState {
    Starting,
    Ready,
    Stopped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpRpcControlKind {
    AvailableCommands,
    ExtensionUi,
    Job,
    Model,
    Provider,
    Other,
}
impl OmpRpcControlKind {
    /// 控制面路由名（omp-control 事件的 kind 字段；与 timeline events 严格隔离）。
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AvailableCommands => "available_commands",
            Self::ExtensionUi => "extension_ui",
            Self::Job => "job",
            Self::Model => "model",
            Self::Provider => "provider",
            Self::Other => "other",
        }
    }
}

/// RPC transport 失败/restart 原因（可观测，随 restart 记录）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpRpcRestartReason {
    ProcessExit,
    ProcessEof,
    TransportRead,
    Timeout,
    Manual,
}

/// pending request 的 typed 结算错误：进程退出/EOF 后绝不悬挂。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpRpcRequestError {
    TransportLost(OmpRpcRestartReason),
}

impl std::fmt::Display for OmpRpcRequestError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TransportLost(reason) => {
                write!(formatter, "omp rpc transport lost ({reason:?})")
            }
        }
    }
}

impl std::error::Error for OmpRpcRequestError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OmpRpcReady {
    pub protocol_version: u64,
    pub supported_protocol_versions: Vec<u64>,
    pub max_frame_bytes: usize,
    pub max_reassembled_frame_bytes: usize,
}

#[derive(Debug)]
pub struct OmpRpcClient {
    state: OmpRpcState,
    next_request_id: u64,
    pending: HashMap<String, String>,
    ready: Option<OmpRpcReady>,
    restart_count: u64,
    last_restart_reason: Option<OmpRpcRestartReason>,
}

impl Default for OmpRpcClient {
    fn default() -> Self {
        Self::new()
    }
}

impl OmpRpcClient {
    pub fn new() -> Self {
        Self {
            state: OmpRpcState::Starting,
            next_request_id: 1,
            pending: HashMap::new(),
            ready: None,
            restart_count: 0,
            last_restart_reason: None,
        }
    }

    pub fn apply_ready(&mut self, frame: &Value) -> bool {
        if self.state == OmpRpcState::Stopped
            || frame.get("type").and_then(Value::as_str) != Some("ready")
        {
            return false;
        }
        let Some(protocol_version) = frame.get("protocolVersion").and_then(Value::as_u64) else {
            return false;
        };
        let supported = frame
            .get("supportedProtocolVersions")
            .and_then(Value::as_array)
            .map(|versions| {
                versions
                    .iter()
                    .filter_map(Value::as_u64)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        if protocol_version != 1 || !supported.contains(&protocol_version) {
            return false;
        }
        let Some(max_frame_bytes) = frame.get("maxFrameBytes").and_then(Value::as_u64) else {
            return false;
        };
        let Some(max_reassembled_frame_bytes) = frame
            .get("maxReassembledFrameBytes")
            .and_then(Value::as_u64)
        else {
            return false;
        };
        if max_frame_bytes == 0
            || max_reassembled_frame_bytes == 0
            || max_reassembled_frame_bytes < max_frame_bytes
        {
            return false;
        }
        let Ok(max_frame_bytes) = usize::try_from(max_frame_bytes) else {
            return false;
        };
        let Ok(max_reassembled_frame_bytes) = usize::try_from(max_reassembled_frame_bytes) else {
            return false;
        };
        self.ready = Some(OmpRpcReady {
            protocol_version,
            supported_protocol_versions: supported,
            max_frame_bytes,
            max_reassembled_frame_bytes,
        });
        self.state = OmpRpcState::Ready;
        // ACK metric：ready handshake 成功即 RPC 控制面 ACK 落点。
        OMP_METRICS.record_ack();
        true
    }

    pub fn request(&mut self, command: &str) -> Option<(String, Value)> {
        if self.state != OmpRpcState::Ready {
            return None;
        }
        let id_number = self.next_request_id;
        if id_number == u64::MAX {
            return None;
        }
        self.next_request_id += 1;
        let id = id_number.to_string();
        self.pending.insert(id.clone(), command.to_owned());
        Some((id.clone(), serde_json::json!({"id": id, "type": command})))
    }

    pub fn resolve_response(&mut self, frame: &Value) -> Option<String> {
        let id = frame.get("id")?.as_str()?;
        self.pending.remove(id)
    }
    pub fn reject_request(&mut self, id: &str) -> bool {
        self.pending.remove(id).is_some()
    }

    pub fn classify_control(frame: &Value) -> OmpRpcControlKind {
        let frame_type = frame.get("type").and_then(Value::as_str);
        match frame_type {
            Some("available_commands_update") => OmpRpcControlKind::AvailableCommands,
            Some("extension_ui_request") => OmpRpcControlKind::ExtensionUi,
            Some("job_started") | Some("job_updated") | Some("job_completed") => {
                OmpRpcControlKind::Job
            }
            _ if frame.get("method").and_then(Value::as_str) == Some("setWidget") => {
                OmpRpcControlKind::ExtensionUi
            }
            // model/provider 域按 control frame 自声明的 type 前缀段路由；
            // 未声明域的 frame 保持 Other（unknown），不猜 payload schema。
            Some(declared) if declared.split('_').next() == Some("model") => {
                OmpRpcControlKind::Model
            }
            Some(declared) if declared.split('_').next() == Some("provider") => {
                OmpRpcControlKind::Provider
            }
            _ => OmpRpcControlKind::Other,
        }
    }

    /// transport 失败（进程退出/EOF/读错误/超时）：所有 pending request 以
    /// typed error 结算（绝不悬挂），状态进入 Stopped，等待显式 restart。
    /// 返回 (request id, command, error) 供调用方观测/上抛。
    pub fn handle_transport_failure(
        &mut self,
        reason: OmpRpcRestartReason,
    ) -> Vec<(String, String, OmpRpcRequestError)> {
        self.last_restart_reason = Some(reason);
        self.state = OmpRpcState::Stopped;
        self.ready = None;
        // Recovery metric：transport 失败的 pending 结算是显式 recovery 转换。
        OMP_METRICS.record_recovery();
        self.pending
            .drain()
            .map(|(id, command)| (id, command, OmpRpcRequestError::TransportLost(reason)))
            .collect()
    }

    /// 显式 restart 语义：残留 pending 以 typed error fail-closed 结算，
    /// 状态回到 Starting（必须重新 ready handshake + version negotiation）。
    /// `next_request_id` 保持单调递增，restart 后绝不复用旧 correlation id。
    pub fn begin_restart(
        &mut self,
        reason: OmpRpcRestartReason,
    ) -> Vec<(String, String, OmpRpcRequestError)> {
        let settled = self
            .pending
            .drain()
            .map(|(id, command)| (id, command, OmpRpcRequestError::TransportLost(reason)))
            .collect();
        self.ready = None;
        self.state = OmpRpcState::Starting;
        self.restart_count = self.restart_count.saturating_add(1);
        self.last_restart_reason = Some(reason);
        settled
    }

    pub fn restart_count(&self) -> u64 {
        self.restart_count
    }

    pub fn last_restart_reason(&self) -> Option<OmpRpcRestartReason> {
        self.last_restart_reason
    }

    pub fn stop(&mut self) {
        self.pending.clear();
        self.state = OmpRpcState::Stopped;
        self.ready = None;
    }

    pub fn state(&self) -> OmpRpcState {
        self.state
    }

    pub fn ready(&self) -> Option<&OmpRpcReady> {
        self.ready.as_ref()
    }
}

#[cfg(test)]
mod tests {
    use super::{OmpRpcClient, OmpRpcControlKind, OmpRpcRequestError, OmpRpcRestartReason, OmpRpcState};
    use serde_json::json;

    fn ready() -> serde_json::Value {
        json!({
            "type": "ready",
            "protocolVersion": 1,
            "supportedProtocolVersions": [1, 2],
            "maxFrameBytes": 1_048_576,
            "maxReassembledFrameBytes": 67_108_864
        })
    }

    #[test]
    fn negotiates_ready_before_accepting_requests() {
        let mut client = OmpRpcClient::new();
        assert_eq!(client.state(), OmpRpcState::Starting);
        assert!(client.request("get_state").is_none());
        assert!(client.apply_ready(&ready()));
        let (id, request) = client.request("get_state").unwrap();
        assert_eq!(id, "1");
        assert_eq!(request["type"], "get_state");
        assert_eq!(client.ready().unwrap().max_frame_bytes, 1_048_576);
    }

    #[test]
    fn correlates_out_of_order_responses_to_their_own_commands() {
        let mut client = OmpRpcClient::new();
        client.apply_ready(&ready());
        client.request("first");
        client.request("second");
        assert_eq!(
            client.resolve_response(&json!({"id": "2"})),
            Some("second".into())
        );
        assert_eq!(
            client.resolve_response(&json!({"id": "1"})),
            Some("first".into())
        );
        assert!(client.resolve_response(&json!({"id": "missing"})).is_none());
    }

    #[test]
    fn classifies_control_events_without_timeline_semantics() {
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"available_commands_update"})),
            OmpRpcControlKind::AvailableCommands
        );
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"extension_ui_request"})),
            OmpRpcControlKind::ExtensionUi
        );
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"job_updated"})),
            OmpRpcControlKind::Job
        );
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"id":"widget","method":"setWidget"})),
            OmpRpcControlKind::ExtensionUi
        );
    }

    #[test]
    fn stop_clears_pending_requests_and_prevents_new_work() {
        let mut client = OmpRpcClient::new();
        client.apply_ready(&ready());
        client.request("get_state");
        client.stop();
        assert_eq!(client.state(), OmpRpcState::Stopped);
        assert!(client.request("get_state").is_none());
        assert!(client.resolve_response(&json!({"id":"1"})).is_none());
    }
    #[test]
    fn routes_model_and_provider_control_events_but_keeps_unknown_frames_unknown() {
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"model_list_update"})),
            OmpRpcControlKind::Model
        );
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"provider_status_update"})),
            OmpRpcControlKind::Provider
        );
        // 未识别的 control frame 保持 unknown（Other），不猜 schema。
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"type":"session_event"})),
            OmpRpcControlKind::Other
        );
        assert_eq!(
            OmpRpcClient::classify_control(&json!({"unexpected": true})),
            OmpRpcControlKind::Other
        );
        assert_eq!(OmpRpcControlKind::Model.as_str(), "model");
        assert_eq!(OmpRpcControlKind::Provider.as_str(), "provider");
    }

    #[test]
    fn transport_failure_settles_every_pending_request_with_typed_errors() {
        let mut client = OmpRpcClient::new();
        client.apply_ready(&ready());
        let (first_id, _) = client.request("get_state").unwrap();
        let (second_id, _) = client.request("list_models").unwrap();
        let settled = client.handle_transport_failure(OmpRpcRestartReason::ProcessExit);
        assert_eq!(settled.len(), 2);
        assert!(settled.iter().all(|(_, _, error)| matches!(
            error,
            OmpRpcRequestError::TransportLost(OmpRpcRestartReason::ProcessExit)
        )));
        assert!(settled
            .iter()
            .any(|(id, command, _)| id == &first_id && command == "get_state"));
        assert!(settled
            .iter()
            .any(|(id, command, _)| id == &second_id && command == "list_models"));
        // 结算后不悬挂：状态 Stopped，旧 correlation id 无法再 resolve。
        assert_eq!(client.state(), OmpRpcState::Stopped);
        assert!(client.resolve_response(&json!({"id": first_id})).is_none());
        assert_eq!(
            client.last_restart_reason(),
            Some(OmpRpcRestartReason::ProcessExit)
        );
    }

    #[test]
    fn restart_requires_fresh_ready_and_never_reuses_correlation_ids() {
        let mut client = OmpRpcClient::new();
        client.apply_ready(&ready());
        let (old_id, _) = client.request("get_state").unwrap();
        client.handle_transport_failure(OmpRpcRestartReason::ProcessEof);
        // Stopped 状态拒绝新请求，也拒绝旧 ready 帧直接复活。
        assert!(client.request("get_state").is_none());
        assert!(!client.apply_ready(&ready()));
        let leftovers = client.begin_restart(OmpRpcRestartReason::ProcessEof);
        assert!(leftovers.is_empty());
        assert_eq!(client.state(), OmpRpcState::Starting);
        assert_eq!(client.restart_count(), 1);
        assert_eq!(
            client.last_restart_reason(),
            Some(OmpRpcRestartReason::ProcessEof)
        );
        // restart 必须重新 ready handshake + version negotiation。
        assert!(client.request("get_state").is_none());
        assert!(client.apply_ready(&ready()));
        let (new_id, _) = client.request("get_state").unwrap();
        assert_ne!(new_id, old_id);
        // restart 前残留的 pending 在 begin_restart 时以 typed error 结算。
        client.request("list_models").unwrap();
        client.handle_transport_failure(OmpRpcRestartReason::TransportRead);
        let settled = client.begin_restart(OmpRpcRestartReason::TransportRead);
        assert!(settled.is_empty());
        assert_eq!(client.restart_count(), 2);
    }

    #[test]
    fn begin_restart_settles_stranded_pending_requests_as_typed_errors() {
        let mut client = OmpRpcClient::new();
        client.apply_ready(&ready());
        let (id, _) = client.request("get_state").unwrap();
        let settled = client.begin_restart(OmpRpcRestartReason::Manual);
        assert_eq!(settled.len(), 1);
        assert_eq!(settled[0].0, id);
        assert!(matches!(
            settled[0].2,
            OmpRpcRequestError::TransportLost(OmpRpcRestartReason::Manual)
        ));
        assert!(client.ready().is_none());
    }
}
