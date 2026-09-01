use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};
use serde_json::{json, Value};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

use super::events::EngineEvent;
use super::EngineType;
use super::omp_env::OmpEnvironmentSpec;
use super::omp_protocol::OmpFrameDecoder;
use super::omp_release::OMP_METRICS;

const OMP_REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
/// session/prompt 是长任务：流式泵模式下只作兜底上限（10 分钟），正常停止
/// 走 interrupt（停止按钮 → session/cancel / 进程回收）。
const OMP_TURN_TIMEOUT_SECS: u64 = 600;
const OMP_MAX_FRAME_BYTES: usize = 1_048_576;
fn jsonrpc_id_matches(value: Option<&Value>, request_id: u64) -> bool {
    match value {
        Some(Value::Number(number)) => number.as_u64() == Some(request_id),
        Some(Value::String(id)) => id.trim().parse::<u64>().ok() == Some(request_id),
        _ => false,
    }
}

pub(crate) fn is_terminal_frame(frame: &Value) -> bool {
    let session_update = frame
        .get("params")
        .and_then(|params| params.get("update"))
        .and_then(|update| update.get("sessionUpdate"))
        .and_then(Value::as_str);
    frame.get("method").and_then(Value::as_str) == Some("session/finished")
        || matches!(session_update, Some("turn_complete" | "session_finished"))
}

pub(crate) struct OmpAcpProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    pending_frames: VecDeque<Value>,
    next_request_id: u64,
    workspace_root: PathBuf,
}

impl OmpAcpProcess {
    /// environment assembly 边界：所有 spawn 都经显式 OmpEnvironmentSpec
    /// 组装（env_clear + allowlist 继承 + overlay），禁止隐式全量继承
    /// 父进程 env。`None` 使用默认最小继承面。
    pub(crate) async fn spawn(
        binary: Option<&Path>,
        workspace_root: &Path,
        environment: Option<&OmpEnvironmentSpec>,
    ) -> Result<Self, String> {
        let executable = binary
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("omp"));
        let assembled = environment
            .cloned()
            .unwrap_or_else(OmpEnvironmentSpec::default_inherit)
            .assemble_from_current_process();
        let spawn_started = Instant::now();
        let mut command = Command::new(&executable);
        command
            .arg("acp")
            .current_dir(workspace_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        assembled.apply(&mut command);
        let mut child = command
            .spawn()
            .map_err(|error| format!("failed to spawn omp acp: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "omp acp stdin was not piped".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "omp acp stdout was not piped".to_string())?;
        // Startup metric：进程 spawn + 管道就绪即启动落点。
        OMP_METRICS.record_startup(spawn_started.elapsed());
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
            pending_frames: VecDeque::new(),
            next_request_id: 1,
            workspace_root: workspace_root.to_path_buf(),
        })
    }

    pub(crate) fn workspace_root(&self) -> &Path {
        &self.workspace_root
    }

    async fn send(&mut self, message: Value) -> Result<(), String> {
        let mut encoded = serde_json::to_vec(&message).map_err(|error| error.to_string())?;
        encoded.push(b'\n');
        self.stdin
            .write_all(&encoded)
            .await
            .map_err(|error| format!("failed to write omp acp request: {error}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|error| format!("failed to flush omp acp request: {error}"))
    }

    pub(crate) async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let request_id = self.next_request_id;
        self.next_request_id = self
            .next_request_id
            .checked_add(1)
            .ok_or_else(|| "omp acp request id exhausted".to_string())?;
        self.send(json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params,
        }))
        .await?;

        let deadline = Instant::now() + OMP_REQUEST_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!("omp acp request timed out: {method}"));
            }
            let frames = self.read_frames(remaining).await?;
            for frame in frames {
                if jsonrpc_id_matches(frame.get("id"), request_id) {
                    if frame.get("error").is_some() {
                        return Err(format!("omp acp request failed: {}", frame));
                    }
                    return Ok(frame.get("result").cloned().unwrap_or(Value::Null));
                }
                self.pending_frames.push_back(frame);
            }
        }
    }

    pub(crate) fn has_pending_frames(&self) -> bool {
        !self.pending_frames.is_empty()
    }
    pub(crate) fn clear_pending_frames(&mut self) {
        self.pending_frames.clear();
    }

    /// `session/prompt` 的流式版本。ACP 的 turn 终结信号是 prompt 的
    /// JSON-RPC response（stopReason）或明确的 terminal notification，期间的
    /// 通知帧（思考/回复流）必须即时经 `on_frame` 交出转发。
    /// 停止由 `interrupt` 触发，返回的 Err 含 "interrupted" 供调用方识别。
    pub(crate) async fn prompt_streaming(
        &mut self,
        session_id: &str,
        text: &str,
        interrupt: &mut tokio::sync::oneshot::Receiver<()>,
        on_frame: impl FnMut(Value),
    ) -> Result<Value, String> {
        self.prompt_streaming_blocks(
            session_id,
            vec![json!({ "type": "text", "text": text })],
            interrupt,
            on_frame,
        )
        .await
    }

    /// 携带 canonical content blocks 的流式 prompt（attachment 归一化产物，
    /// 见 omp_acp::normalize_prompt_attachments）。
    pub(crate) async fn prompt_streaming_blocks(
        &mut self,
        session_id: &str,
        prompt_blocks: Vec<Value>,
        interrupt: &mut tokio::sync::oneshot::Receiver<()>,
        mut on_frame: impl FnMut(Value),
    ) -> Result<Value, String> {
        if prompt_blocks.is_empty() {
            return Err("omp acp prompt requires at least one content block".to_string());
        }
        let request_id = self.next_request_id;
        self.next_request_id = self
            .next_request_id
            .checked_add(1)
            .ok_or_else(|| "omp acp request id exhausted".to_string())?;
        self.send(json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "session/prompt",
            "params": {
                "sessionId": session_id,
                "prompt": prompt_blocks
            },
        }))
        .await?;

        let deadline = Instant::now() + Duration::from_secs(OMP_TURN_TIMEOUT_SECS);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("omp acp turn timed out".to_string());
            }
            let frame = tokio::select! {
                _ = &mut *interrupt => {
                    return Err("omp acp turn interrupted".to_string());
                }
                result = self.read_one_frame(remaining) => result?,
            };
            if jsonrpc_id_matches(frame.get("id"), request_id) {
                if frame.get("error").is_some() {
                    return Err(format!("omp acp request failed: {frame}"));
                }
                return Ok(frame.get("result").cloned().unwrap_or(Value::Null));
            }
            if is_terminal_frame(&frame) {
                return Ok(frame);
            }
            on_frame(frame);
        }
    }

    async fn read_one_frame(&mut self, timeout_duration: Duration) -> Result<Value, String> {
        if let Some(frame) = self.pending_frames.pop_front() {
            return Ok(frame);
        }
        let frames = self.read_frames(timeout_duration).await?;
        let mut frames = frames.into_iter();
        let first = frames
            .next()
            .ok_or_else(|| "omp acp event line contained no frame".to_string())?;
        self.pending_frames.extend(frames);
        Ok(first)
    }

    async fn read_frames(&mut self, timeout_duration: Duration) -> Result<Vec<Value>, String> {
        let deadline = Instant::now() + timeout_duration;
        let mut bytes = Vec::new();
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("omp acp frame read timed out".to_string());
            }
            let chunk = tokio::time::timeout(remaining, self.stdout.fill_buf())
                .await
                .map_err(|_| "omp acp frame read timed out".to_string())?
                .map_err(|error| format!("failed to read omp acp frame: {error}"))?;
            if chunk.is_empty() {
                return Err("omp acp exited before returning a frame".to_string());
            }
            let newline = chunk.iter().position(|byte| *byte == b'\n');
            let consumed = newline.map_or(chunk.len(), |index| index + 1);
            bytes.extend_from_slice(&chunk[..consumed]);
            self.stdout.consume(consumed);
            if bytes.len() > OMP_MAX_FRAME_BYTES {
                return Err("omp acp frame exceeds configured limit".to_string());
            }
            if newline.is_some() {
                break;
            }
        }
        let mut decoder = OmpFrameDecoder::default();
        decoder
            .push(&bytes)
            .map_err(|error| format!("invalid omp acp frame: {error}"))
    }

    pub(crate) async fn initialize(&mut self) -> Result<Value, String> {
        let result = self
            .request(
                "initialize",
                json!({
                    "protocolVersion": 1,
                    "clientInfo": { "name": "mossx", "version": env!("CARGO_PKG_VERSION") },
                    "clientCapabilities": { "fs": { "read": false, "write": false } }
                }),
            )
            .await;
        if result.is_ok() {
            // ACK metric：ACP initialize response 解析成功即 ACK 落点。
            OMP_METRICS.record_ack();
        }
        result
    }

    pub(crate) async fn new_session(&mut self) -> Result<String, String> {
        let result = self
            .request(
                "session/new",
                json!({
                    "cwd": self.workspace_root,
                    "mcpServers": []
                }),
            )
            .await?;
        result
            .get("sessionId")
            .and_then(Value::as_str)
            .filter(|session_id| !session_id.trim().is_empty())
            .map(str::to_string)
            .ok_or_else(|| "omp acp session/new returned no sessionId".to_string())
    }

    pub(crate) async fn prompt(&mut self, session_id: &str, text: &str) -> Result<Value, String> {
        let session_id = session_id.trim();
        if session_id.is_empty() || text.trim().is_empty() {
            return Err("omp acp prompt requires sessionId and non-empty text".to_string());
        }
        self.request(
            "session/prompt",
            json!({
                "sessionId": session_id,
                "prompt": [{ "type": "text", "text": text }]
            }),
        )
        .await
    }
    /// OMP 的模型选择走 ACP `session/set_config_option`（configId: `model`，
    /// value 为 `provider/model` selector）。`session/set_model` 是 Qoder 的
    /// ACP 扩展，OMP 返回 -32603 "Unknown ACP ext method"。
    pub(crate) async fn set_model(
        &mut self,
        session_id: &str,
        provider: &str,
        model_id: &str,
    ) -> Result<(), String> {
        self.request(
            "session/set_config_option",
            json!({
                "sessionId": session_id,
                "configId": "model",
                "value": format!("{provider}/{model_id}"),
            }),
        )
        .await?;
        self.clear_pending_frames();
        Ok(())
    }

    /// OMP 的推理力度映射到 `thinking` config option（值域 off/auto/low/
    /// medium/high/xhigh/max）；`reasoning_effort` configId 在 OMP 不存在，
    /// 同样会 -32603。不在 OMP 值域内的 effort 返回 Err 由调用方降级，
    /// 不让 turn 失败。
    pub(crate) async fn set_reasoning_effort(
        &mut self,
        session_id: &str,
        effort: &str,
    ) -> Result<(), String> {
        let thinking = omp_thinking_level(effort)?;
        self.request(
            "session/set_config_option",
            json!({
                "sessionId": session_id,
                "configId": "thinking",
                "value": thinking,
            }),
        )
        .await?;
        self.clear_pending_frames();
        Ok(())
    }

    pub(crate) async fn load_session(&mut self, session_id: &str) -> Result<String, String> {
        let session_id = session_id.trim();
        if session_id.is_empty() {
            return Err("omp acp load requires sessionId".to_string());
        }
        let result = self
            .request(
                "session/load",
                json!({
                    "sessionId": session_id,
                    "cwd": self.workspace_root,
                    "mcpServers": [],
                }),
            )
            .await?;
        Ok(result
            .get("sessionId")
            .and_then(Value::as_str)
            .unwrap_or(session_id)
            .to_string())
    }

    pub(crate) async fn cancel(&mut self, session_id: &str) -> Result<(), String> {
        let session_id = session_id.trim();
        if session_id.is_empty() {
            return Err("omp acp cancel requires sessionId".to_string());
        }
        self.send(json!({
            "jsonrpc": "2.0",
            "method": "session/cancel",
            "params": { "sessionId": session_id }
        }))
        .await
    }

    pub(crate) async fn shutdown(mut self) -> Result<(), String> {
        self.stdin
            .shutdown()
            .await
            .map_err(|error| format!("failed to close omp acp stdin: {error}"))?;
        let _ = self.child.start_kill();
        tokio::time::timeout(Duration::from_secs(2), self.child.wait())
            .await
            .map_err(|_| "timed out waiting for omp acp to stop".to_string())?
            .map_err(|error| format!("failed to reap omp acp: {error}"))?;
        Ok(())
    }
}

impl Drop for OmpAcpProcess {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
    }
}

/// mossx reasoning effort → OMP `thinking` config option 值。
/// OMP 值域：off/auto/low/medium/high/xhigh/max（session/new configOptions）。
/// 无对应档位的 effort（如 minimal）返回 Err，调用方按非致命降级。
pub(crate) fn omp_thinking_level(effort: &str) -> Result<&'static str, String> {
    let normalized = effort.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "off" => Ok("off"),
        "minimal" | "low" => Ok("low"),
        "medium" => Ok("medium"),
        "high" => Ok("high"),
        "xhigh" => Ok("xhigh"),
        "max" | "ultra" => Ok("max"),
        other => Err(format!("unsupported OMP thinking level: {other}")),
    }
}

fn omp_text_value(value: Option<&Value>) -> Option<String> {
    let value = value?;
    value.as_str().map(str::to_string).or_else(|| {
        value
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_string)
    })
}

fn omp_update_value<'a>(update: &'a Value, frame: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter()
        .find_map(|key| update.get(*key).or_else(|| frame.get(*key)))
}

/// Projects ACP notifications into the shared engine event stream.
pub(crate) fn frame_to_engine_event(
    workspace_id: &str,
    turn_id: &str,
    frame: &Value,
) -> EngineEvent {
    let update = frame
        .get("params")
        .and_then(|params| params.get("update"))
        .unwrap_or(&Value::Null);
    let session_update = update.get("sessionUpdate").and_then(Value::as_str);
    match session_update {
        Some("agent_message_chunk") => omp_text_value(omp_update_value(
            update,
            frame,
            &["content", "delta", "text"],
        ))
        .filter(|text| !text.is_empty())
        .map(|text| EngineEvent::TextDelta {
            workspace_id: workspace_id.to_string(),
            text,
        })
        .unwrap_or_else(|| EngineEvent::Raw {
            workspace_id: workspace_id.to_string(),
            engine: EngineType::Omp,
            data: frame.clone(),
        }),
        Some("agent_thought_chunk") => omp_text_value(omp_update_value(
            update,
            frame,
            &["content", "delta", "text", "reasoning"],
        ))
        .filter(|text| !text.is_empty())
        .map(|text| EngineEvent::ReasoningDelta {
            workspace_id: workspace_id.to_string(),
            text,
        })
        .unwrap_or_else(|| EngineEvent::Raw {
            workspace_id: workspace_id.to_string(),
            engine: EngineType::Omp,
            data: frame.clone(),
        }),
        Some("tool_call") => {
            let tool_id = omp_update_value(update, frame, &["toolCallId", "tool_call_id", "id"])
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(turn_id)
                .to_string();
            let tool_name = omp_update_value(
                update,
                frame,
                &["title", "name", "toolName", "tool_name", "kind"],
            )
            .and_then(Value::as_str)
            .unwrap_or("omp-tool")
            .to_string();
            EngineEvent::ToolStarted {
                workspace_id: workspace_id.to_string(),
                tool_id,
                tool_name,
                input: omp_update_value(update, frame, &["rawInput", "input", "arguments"])
                    .cloned(),
            }
        }
        Some("tool_result") | Some("tool_call_update") => {
            let tool_id = omp_update_value(update, frame, &["toolCallId", "tool_call_id", "id"])
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(turn_id)
                .to_string();
            let error = omp_update_value(update, frame, &["error"])
                .and_then(Value::as_str)
                .map(str::to_string)
                .or_else(|| {
                    (update.get("status").and_then(Value::as_str) == Some("failed"))
                        .then(|| "OMP tool call failed".to_string())
                });
            EngineEvent::ToolCompleted {
                workspace_id: workspace_id.to_string(),
                tool_id,
                tool_name: omp_update_value(update, frame, &["title", "name", "toolName"])
                    .and_then(Value::as_str)
                    .map(str::to_string),
                output: omp_update_value(
                    update,
                    frame,
                    &["content", "rawOutput", "output", "result"],
                )
                .cloned(),
                error,
            }
        }
        Some("turn_complete") | Some("session_finished") => EngineEvent::TurnCompleted {
            workspace_id: workspace_id.to_string(),
            result: Some(frame.clone()),
        },
        _ if frame.get("method").and_then(Value::as_str) == Some("session/finished") => {
            EngineEvent::TurnCompleted {
                workspace_id: workspace_id.to_string(),
                result: Some(frame.clone()),
            }
        }
        _ => EngineEvent::Raw {
            workspace_id: workspace_id.to_string(),
            engine: EngineType::Omp,
            data: frame.clone(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_payload_is_acp_jsonrpc_shape() {
        let payload = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "session/new",
            "params": { "cwd": "/tmp", "mcpServers": [] }
        });
        assert_eq!(payload["method"], "session/new");
        assert_eq!(payload["params"]["mcpServers"], json!([]));
    }

    #[test]
    fn accepts_numeric_and_stringified_jsonrpc_ids() {
        assert!(jsonrpc_id_matches(Some(&json!(7)), 7));
        assert!(jsonrpc_id_matches(Some(&json!("7")), 7));
        assert!(!jsonrpc_id_matches(Some(&json!("request-7")), 7));
    }

    #[test]
    fn recognizes_acp_terminal_notifications_without_treating_updates_as_terminal() {
        assert!(is_terminal_frame(&json!({
            "method": "session/finished",
            "params": {}
        })));
        assert!(is_terminal_frame(&json!({
            "method": "session/update",
            "params": {"update": {"sessionUpdate": "turn_complete"}}
        })));
        assert!(!is_terminal_frame(&json!({
            "method": "session/update",
            "params": {"update": {"sessionUpdate": "agent_message_chunk"}}
        })));
    }
}
