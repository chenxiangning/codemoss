//! PI CLI engine implementation
//!
//! Headless protocol (JetBrains-aligned, spike-verified on pi 0.83):
//! `pi --print --mode json "<prompt>" [--model] [--session-id] [--thinking]`
//!
//! NDJSON event types:
//! - `session` { id }
//! - `message_update` { assistantMessageEvent: { type: text_delta|thinking_delta, delta } }
//! - `tool_execution_start` / `tool_execution_end`
//! - `message_end` (assistant usage / errors)
//! - `agent_end` / `turn_end` with errorMessage (auth failures etc.)

use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, Mutex, RwLock};

use super::events::EngineEvent;
use super::{EngineConfig, EngineType, SendMessageParams};

const THINKING_LEVELS: &[&str] = &["off", "minimal", "low", "medium", "high", "xhigh", "max"];

// ponytail: pi's NDJSON stream has no terminal "result" event, so turn end is
// detected by stdout EOF. A lingering grandchild (e.g. a bash tool daemon)
// that inherited the stdout pipe would keep the write end open and block EOF
// forever — the claude.rs "turn stuck generating" root cause. Poll child exit
// and stop reading after a grace. Ceiling: the orphan itself is not killed
// (pi, like kimi/grok, spawns without setpgid, so there is no process group to
// killpg); upgrade path = pre_exec setpgid + group kill if this ever bites.
const PI_STDOUT_EXIT_POLL: Duration = Duration::from_millis(250);
const PI_POST_EXIT_GRACE: Duration = Duration::from_secs(5);
const PI_STDERR_JOIN_TIMEOUT: Duration = Duration::from_secs(5);

pub fn resolve_pi_session_id_for_engine_send(
    continue_session: bool,
    explicit_session_id: Option<String>,
    tracked_session_id: Option<String>,
) -> Option<String> {
    continue_session
        .then(|| explicit_session_id.or(tracked_session_id))
        .flatten()
}

#[derive(Debug, Clone)]
pub struct PiTurnEvent {
    pub turn_id: String,
    pub event: EngineEvent,
}

pub struct PiSession {
    pub workspace_id: String,
    pub workspace_path: PathBuf,
    session_id: RwLock<Option<String>>,
    event_sender: broadcast::Sender<PiTurnEvent>,
    bin_path: Option<String>,
    home_dir: Option<String>,
    custom_args: Option<String>,
    active_processes: Mutex<HashMap<String, ActivePiChildProcess>>,
    interrupted_turns: Mutex<HashSet<String>>,
}

#[allow(dead_code)]
pub struct PiActiveProcessSnapshot {
    pub pid: u32,
    pub registered_age_ms: u64,
}

struct ActivePiChildProcess {
    child: Child,
    #[allow(dead_code)]
    started_at_ms: u64,
}

impl ActivePiChildProcess {
    fn new(child: Child) -> Self {
        Self {
            child,
            started_at_ms: unix_timestamp_ms_for_process_diagnostics(),
        }
    }

    fn into_child(self) -> Child {
        self.child
    }

    #[allow(dead_code)]
    fn snapshot(&self, sampled_at_ms: u64) -> Option<PiActiveProcessSnapshot> {
        Some(PiActiveProcessSnapshot {
            pid: self.child.id()?,
            registered_age_ms: sampled_at_ms.saturating_sub(self.started_at_ms),
        })
    }
}

fn apply_interrupt_result(
    active_processes: &mut HashMap<String, ActivePiChildProcess>,
    interrupted_turns: &mut HashSet<String>,
    turn_id: &str,
    kill_result: Result<(), String>,
) -> Result<(), String> {
    kill_result?;
    interrupted_turns.insert(turn_id.to_string());
    active_processes.remove(turn_id);
    Ok(())
}

fn unix_timestamp_ms_for_process_diagnostics() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

enum PiStreamLine {
    SessionId(String),
    TextDelta(String),
    ThinkingDelta(String),
    ToolStart {
        tool_id: String,
        tool_name: String,
        args: Option<Value>,
    },
    ToolEnd {
        tool_id: String,
        content: String,
        is_error: bool,
    },
    AssistantError(String),
    Usage(Value),
    Other,
}

fn resolve_model_flag(model: Option<&str>) -> Option<String> {
    let trimmed = model.map(str::trim).filter(|v| !v.is_empty())?;
    let lower = trimmed.to_ascii_lowercase();
    if matches!(
        lower.as_str(),
        "__config_default__"
            | "auto"
            | "default"
            | "(default)"
            | "config-default"
            | "config_default"
            | "pi-default"
            | "pi default"
    ) {
        return None;
    }
    Some(trimmed.to_string())
}

// Session ids are passed as a CLI flag value; restrict to a conservative
// charset so a hostile or corrupted id (e.g. "-x") is never parsed as a flag.
fn is_valid_pi_session_id_arg(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('-')
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn resolve_thinking_flag(effort: Option<&str>) -> Option<String> {
    let normalized = effort?.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }
    THINKING_LEVELS
        .iter()
        .find(|level| **level == normalized)
        .map(|level| (*level).to_string())
}

fn extract_tool_result_text(result: Option<&Value>) -> String {
    let Some(result) = result else {
        return String::new();
    };
    if let Some(text) = result.as_str() {
        return text.to_string();
    }
    if let Some(content) = result.get("content") {
        if let Some(text) = content.as_str() {
            return text.to_string();
        }
        if let Some(parts) = content.as_array() {
            let text = parts
                .iter()
                .filter_map(|part| {
                    if let Some(text) = part.as_str() {
                        Some(text.to_string())
                    } else {
                        part.get("text")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            if !text.is_empty() {
                return text;
            }
        }
    }
    result.to_string()
}

fn extract_error_message(value: &Value) -> Option<String> {
    value
        .get("errorMessage")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .or_else(|| {
            value
                .get("message")
                .and_then(|message| message.get("errorMessage"))
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
        })
}

/// Parse one NDJSON line from `pi --print --mode json`.
fn parse_pi_stream_line(value: &Value) -> PiStreamLine {
    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");
    match event_type {
        "session" => {
            let id = value
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string);
            match id {
                Some(session_id) => PiStreamLine::SessionId(session_id),
                None => PiStreamLine::Other,
            }
        }
        "message_update" => {
            let update = value.get("assistantMessageEvent");
            let update_type = update
                .and_then(|u| u.get("type"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let delta = update
                .and_then(|u| u.get("delta"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if delta.is_empty() {
                return PiStreamLine::Other;
            }
            match update_type {
                "text_delta" => PiStreamLine::TextDelta(delta.to_string()),
                "thinking_delta" => PiStreamLine::ThinkingDelta(delta.to_string()),
                _ => PiStreamLine::Other,
            }
        }
        "tool_execution_start" => {
            let tool_id = value
                .get("toolCallId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let tool_name = value
                .get("toolName")
                .and_then(Value::as_str)
                .unwrap_or("tool")
                .to_string();
            let args = value.get("args").cloned();
            if tool_id.is_empty() {
                PiStreamLine::Other
            } else {
                PiStreamLine::ToolStart {
                    tool_id,
                    tool_name,
                    args,
                }
            }
        }
        "tool_execution_end" => {
            let tool_id = value
                .get("toolCallId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if tool_id.is_empty() {
                return PiStreamLine::Other;
            }
            let content = extract_tool_result_text(value.get("result"));
            let is_error = value
                .get("isError")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            PiStreamLine::ToolEnd {
                tool_id,
                content,
                is_error,
            }
        }
        "message_end" | "message_start" => {
            if let Some(error) = extract_error_message(value) {
                return PiStreamLine::AssistantError(error);
            }
            let message = value.get("message");
            let role = message
                .and_then(|m| m.get("role"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if role == "assistant" {
                if let Some(usage) = message.and_then(|m| m.get("usage")) {
                    return PiStreamLine::Usage(usage.clone());
                }
            }
            PiStreamLine::Other
        }
        "agent_end" | "turn_end" => {
            if let Some(error) = extract_error_message(value) {
                PiStreamLine::AssistantError(error)
            } else {
                PiStreamLine::Other
            }
        }
        _ => PiStreamLine::Other,
    }
}

impl PiSession {
    pub fn new(
        workspace_id: String,
        workspace_path: PathBuf,
        config: Option<EngineConfig>,
    ) -> Self {
        let (event_sender, _) = broadcast::channel(1024);
        let config = config.unwrap_or_default();
        Self {
            workspace_id,
            workspace_path,
            session_id: RwLock::new(None),
            event_sender,
            bin_path: config.bin_path,
            home_dir: config.home_dir,
            custom_args: config.custom_args,
            active_processes: Mutex::new(HashMap::new()),
            interrupted_turns: Mutex::new(HashSet::new()),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<PiTurnEvent> {
        self.event_sender.subscribe()
    }

    pub async fn get_session_id(&self) -> Option<String> {
        self.session_id.read().await.clone()
    }

    async fn set_session_id(&self, id: Option<String>) {
        *self.session_id.write().await = id;
    }

    fn emit_turn_event(&self, turn_id: &str, event: EngineEvent) {
        let _ = self.event_sender.send(PiTurnEvent {
            turn_id: turn_id.to_string(),
            event,
        });
    }

    pub fn emit_error(&self, turn_id: &str, error: String) {
        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnError {
                workspace_id: self.workspace_id.clone(),
                error,
                code: None,
            },
        );
    }

    fn build_command(&self, params: &SendMessageParams) -> Result<Command, String> {
        let bin = if let Some(ref custom) = self.bin_path {
            custom.clone()
        } else {
            crate::backend::app_server::find_cli_binary("pi", None)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "pi".to_string())
        };

        let mut cmd = crate::backend::app_server::build_command_for_binary(&bin);
        cmd.current_dir(&self.workspace_path);
        // Custom args go first so the protocol flags below (--print/--mode/--session-id)
        // always win over user configuration in last-wins CLI parsing.
        if let Some(args) = self.custom_args.as_ref() {
            for arg in args.split_whitespace() {
                cmd.arg(arg);
            }
        }
        cmd.arg("--print");
        cmd.arg("--mode");
        cmd.arg("json");

        if let Some(model) = resolve_model_flag(params.model.as_deref()) {
            cmd.arg("--model");
            cmd.arg(model);
        }

        if params.continue_session {
            if let Some(session_id) = params
                .session_id
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .filter(|value| is_valid_pi_session_id_arg(value))
            {
                cmd.arg("--session-id");
                cmd.arg(session_id);
            }
        }

        if let Some(thinking) = resolve_thinking_flag(params.effort.as_deref()) {
            cmd.arg("--thinking");
            cmd.arg(thinking);
        }

        let image_files = crate::engine::cli_image_input::resolve_existing_image_files(
            params.images.as_deref(),
            &self.workspace_path,
        )?;
        let prompt_text = crate::engine::cli_image_input::build_pi_prompt_with_images(
            &params.text,
            &image_files,
        );
        // Positional prompt; avoid leading '-' being parsed as a flag.
        let safe_text = if prompt_text.starts_with('-') {
            format!(" {prompt_text}")
        } else {
            prompt_text
        };
        cmd.arg(&safe_text);

        if let Some(home) = self.home_dir.as_ref() {
            cmd.env("PI_CODING_AGENT_DIR", home);
            // Sessions default under agent_dir/sessions; keep home aligned.
            cmd.env("HOME", home);
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        Ok(cmd)
    }

    pub async fn send_message(
        &self,
        params: SendMessageParams,
        turn_id: &str,
    ) -> Result<String, String> {
        let turn_started_at = std::time::Instant::now();
        let requested_model = params
            .model
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or("<auto>");
        log::info!(
            "[pi/send] turn={} workspace={} model={} continue_session={}",
            turn_id,
            self.workspace_id,
            requested_model,
            params.continue_session,
        );

        let mut command = match self.build_command(&params) {
            Ok(command) => command,
            Err(error) => {
                let error_msg = format!("Failed to build pi command: {error}");
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(error) => {
                let error_msg = format!("Failed to spawn pi: {error}");
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let spawn_ms = turn_started_at.elapsed().as_millis();

        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                let error_msg = "Failed to capture stdout".to_string();
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let stderr = match child.stderr.take() {
            Some(stderr) => stderr,
            None => {
                let error_msg = "Failed to capture stderr".to_string();
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };

        {
            let mut active = self.active_processes.lock().await;
            active.insert(turn_id.to_string(), ActivePiChildProcess::new(child));
        }

        self.emit_turn_event(
            turn_id,
            EngineEvent::SessionStarted {
                workspace_id: self.workspace_id.clone(),
                session_id: "pending".to_string(),
                engine: EngineType::Pi,
                turn_id: Some(turn_id.to_string()),
            },
        );
        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnStarted {
                workspace_id: self.workspace_id.clone(),
                turn_id: turn_id.to_string(),
            },
        );

        let stderr_reader = BufReader::new(stderr);
        let stderr_task = tokio::spawn(async move {
            let mut lines = stderr_reader.lines();
            let mut text = String::new();
            while let Ok(Some(line)) = lines.next_line().await {
                text.push_str(&line);
                text.push('\n');
            }
            text
        });

        let mut response_text = String::new();
        let mut saw_tool_activity = false;
        let mut tool_names_by_id: HashMap<String, String> = HashMap::new();
        let mut tool_inputs_by_id: HashMap<String, Option<Value>> = HashMap::new();
        let mut error_output = String::new();
        let mut session_started_emitted = false;
        let mut new_session_id: Option<String> = None;
        let mut stream_error: Option<String> = None;
        let mut first_stdout_line_ms: Option<u128> = None;
        let mut stdout_line_count: usize = 0;

        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut child_exited_at: Option<std::time::Instant> = None;

        loop {
            let line = tokio::select! {
                line = lines.next_line() => match line {
                    Ok(Some(line)) => line,
                    Ok(None) => break,
                    Err(error) => {
                        // A read error is not EOF: keep the diagnostic so the
                        // turn settles as failed instead of silently succeeding.
                        if !error_output.is_empty() {
                            error_output.push('\n');
                        }
                        error_output.push_str(&format!("[pi stdout read error] {error}"));
                        break;
                    }
                },
                _ = tokio::time::sleep(PI_STDOUT_EXIT_POLL) => {
                    if child_exited_at.is_none() {
                        let mut active = self.active_processes.lock().await;
                        match active.get_mut(turn_id) {
                            Some(process) => {
                                if matches!(process.child.try_wait(), Ok(Some(_))) {
                                    child_exited_at = Some(std::time::Instant::now());
                                }
                            }
                            // Removed externally (interrupt): stop reading; the
                            // killer owns the child handle from here.
                            None => break,
                        }
                    }
                    if child_exited_at.is_some_and(|at| at.elapsed() >= PI_POST_EXIT_GRACE) {
                        log::warn!(
                            "[pi/send] turn={} stdout EOF grace elapsed after child exit; stop reading",
                            turn_id
                        );
                        break;
                    }
                    continue;
                }
            };
            let line = line.trim().to_string();
            if line.is_empty() {
                continue;
            }
            stdout_line_count += 1;
            if first_stdout_line_ms.is_none() {
                first_stdout_line_ms = Some(turn_started_at.elapsed().as_millis());
            }
            match serde_json::from_str::<Value>(&line) {
                Ok(event) => match parse_pi_stream_line(&event) {
                    PiStreamLine::SessionId(session_id) => {
                        if !session_started_emitted {
                            session_started_emitted = true;
                            new_session_id = Some(session_id.clone());
                            self.set_session_id(Some(session_id.clone())).await;
                            self.emit_turn_event(
                                turn_id,
                                EngineEvent::SessionStarted {
                                    workspace_id: self.workspace_id.clone(),
                                    session_id,
                                    engine: EngineType::Pi,
                                    turn_id: Some(turn_id.to_string()),
                                },
                            );
                        }
                    }
                    PiStreamLine::TextDelta(delta) => {
                        response_text.push_str(&delta);
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::TextDelta {
                                workspace_id: self.workspace_id.clone(),
                                text: delta,
                            },
                        );
                    }
                    PiStreamLine::ThinkingDelta(delta) => {
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::ReasoningDelta {
                                workspace_id: self.workspace_id.clone(),
                                text: delta,
                            },
                        );
                    }
                    PiStreamLine::ToolStart {
                        tool_id,
                        tool_name,
                        args,
                    } => {
                        saw_tool_activity = true;
                        tool_names_by_id.insert(tool_id.clone(), tool_name.clone());
                        tool_inputs_by_id.insert(tool_id.clone(), args.clone());
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::ToolStarted {
                                workspace_id: self.workspace_id.clone(),
                                tool_id,
                                tool_name,
                                input: args,
                            },
                        );
                    }
                    PiStreamLine::ToolEnd {
                        tool_id,
                        content,
                        is_error,
                    } => {
                        saw_tool_activity = true;
                        let tool_name = tool_names_by_id.get(&tool_id).cloned();
                        let wrapped_output = match tool_inputs_by_id.get(&tool_id).cloned() {
                            Some(Some(input_value)) => Some(json!({
                                "_input": input_value,
                                "_output": content,
                            })),
                            _ => Some(Value::String(content.clone())),
                        };
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::ToolCompleted {
                                workspace_id: self.workspace_id.clone(),
                                tool_id,
                                tool_name,
                                output: wrapped_output,
                                error: is_error.then_some(content),
                            },
                        );
                    }
                    PiStreamLine::AssistantError(error) => {
                        stream_error = Some(error);
                    }
                    PiStreamLine::Usage(_) | PiStreamLine::Other => {}
                },
                Err(_) => {
                    error_output.push_str(&line);
                    error_output.push('\n');
                }
            }
        }

        let stdout_eof_ms = turn_started_at.elapsed().as_millis();
        let mut child = {
            let mut active = self.active_processes.lock().await;
            active
                .remove(turn_id)
                .map(ActivePiChildProcess::into_child)
        };
        let status = if let Some(mut process) = child.take() {
            match tokio::time::timeout(PI_POST_EXIT_GRACE, process.wait()).await {
                Ok(result) => result.ok(),
                Err(_) => {
                    log::warn!(
                        "[pi/send] turn={} child wait timed out; killing",
                        turn_id
                    );
                    let _ = process.start_kill();
                    None
                }
            }
        } else {
            None
        };
        let stderr_text = match tokio::time::timeout(PI_STDERR_JOIN_TIMEOUT, stderr_task).await {
            Ok(joined) => joined.unwrap_or_default(),
            Err(_) => {
                log::warn!(
                    "[pi/send] turn={} stderr reader did not finish within timeout; abandoning",
                    turn_id
                );
                String::new()
            }
        };
        if !stderr_text.trim().is_empty() {
            error_output.push_str(&stderr_text);
        }
        let completed_ms = turn_started_at.elapsed().as_millis();
        let status_success = status.as_ref().is_some_and(|value| value.success());
        log::info!(
            "[pi/send][timing] turn={} spawn_ms={} first_stdout_line_ms={:?} stdout_eof_ms={} completed_ms={} stdout_lines={} status_success={} response_chars={}",
            turn_id,
            spawn_ms,
            first_stdout_line_ms,
            stdout_eof_ms,
            completed_ms,
            stdout_line_count,
            status_success,
            response_text.chars().count(),
        );

        let was_interrupted = self.interrupted_turns.lock().await.remove(turn_id);
        if let Some(error) = stream_error {
            if response_text.trim().is_empty() && !saw_tool_activity {
                self.emit_error(turn_id, error.clone());
                return Err(error);
            }
        }
        if let Some(status) = status {
            if !status.success() {
                let error_msg = if was_interrupted {
                    "Session stopped.".to_string()
                } else if !error_output.trim().is_empty() {
                    error_output.trim().to_string()
                } else {
                    format!("PI exited with status: {status}")
                };
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        } else if was_interrupted {
            let error_msg = "Session stopped.".to_string();
            self.emit_error(turn_id, error_msg.clone());
            return Err(error_msg);
        }

        if response_text.trim().is_empty() && !error_output.trim().is_empty() && !saw_tool_activity
        {
            let error_msg = error_output.trim().to_string();
            self.emit_error(turn_id, error_msg.clone());
            return Err(error_msg);
        }

        if response_text.trim().is_empty() && !saw_tool_activity {
            let diagnostic = "PI exited without assistant output.".to_string();
            self.emit_error(turn_id, diagnostic.clone());
            return Err(diagnostic);
        }

        if let Some(session_id) = new_session_id {
            self.set_session_id(Some(session_id)).await;
        }

        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnCompleted {
                workspace_id: self.workspace_id.clone(),
                result: Some(json!({
                    "text": response_text,
                })),
            },
        );

        Ok(response_text)
    }

    pub async fn interrupt(&self) -> Result<(), String> {
        let mut active = self.active_processes.lock().await;
        let mut interrupted = self.interrupted_turns.lock().await;
        let mut killed_turn_ids = Vec::new();
        let mut errors = Vec::new();
        for (turn_id, process) in active.iter_mut() {
            match process.child.kill().await {
                Ok(()) => {
                    interrupted.insert(turn_id.clone());
                    killed_turn_ids.push(turn_id.clone());
                }
                // Keep the failed entry in the map so Drop can retry the kill.
                Err(error) => errors.push(format!("{turn_id}: {error}")),
            }
        }
        for turn_id in &killed_turn_ids {
            active.remove(turn_id);
        }
        if errors.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "failed to interrupt {} pi turn(s): {}",
                errors.len(),
                errors.join("; ")
            ))
        }
    }

    pub async fn interrupt_turn(&self, turn_id: &str) -> Result<(), String> {
        let mut active = self.active_processes.lock().await;
        let Some(process) = active.get_mut(turn_id) else {
            return Ok(());
        };
        let kill_result = process
            .child
            .kill()
            .await
            .map_err(|e| format!("Failed to kill process: {e}"));
        let mut interrupted_turns = self.interrupted_turns.lock().await;
        apply_interrupt_result(&mut active, &mut interrupted_turns, turn_id, kill_result)
    }

    #[allow(dead_code)]
    pub async fn active_process_snapshots(
        &self,
        sampled_at_ms: u64,
    ) -> Vec<PiActiveProcessSnapshot> {
        let active = self.active_processes.lock().await;
        active
            .values()
            .filter_map(|process| process.snapshot(sampled_at_ms))
            .collect()
    }
}

impl Drop for PiSession {
    fn drop(&mut self) {
        let Ok(mut active) = self.active_processes.try_lock() else {
            log::warn!(
                "[pi] dropping session workspace={} while active_processes is locked",
                self.workspace_id
            );
            return;
        };
        if active.is_empty() {
            return;
        }
        for (turn_id, process) in active.drain() {
            let mut child = process.into_child();
            let pid = child.id();
            match child.start_kill() {
                Ok(()) => {
                    log::info!(
                        "[pi] drop fallback kill workspace={} turn={} pid={:?}",
                        self.workspace_id,
                        turn_id,
                        pid
                    );
                }
                Err(error) => {
                    log::warn!(
                        "[pi] drop fallback failed workspace={} turn={} pid={:?}: {}",
                        self.workspace_id,
                        turn_id,
                        pid,
                        error
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_session_id() {
        let line = json!({"type":"session","id":"abc-123","cwd":"/tmp"});
        match parse_pi_stream_line(&line) {
            PiStreamLine::SessionId(id) => assert_eq!(id, "abc-123"),
            _ => panic!("expected SessionId"),
        }
    }

    #[test]
    fn parses_text_and_thinking_deltas() {
        let text = json!({
            "type":"message_update",
            "assistantMessageEvent":{"type":"text_delta","delta":"hi"}
        });
        match parse_pi_stream_line(&text) {
            PiStreamLine::TextDelta(d) => assert_eq!(d, "hi"),
            _ => panic!("expected TextDelta"),
        }
        let think = json!({
            "type":"message_update",
            "assistantMessageEvent":{"type":"thinking_delta","delta":"plan"}
        });
        match parse_pi_stream_line(&think) {
            PiStreamLine::ThinkingDelta(d) => assert_eq!(d, "plan"),
            _ => panic!("expected ThinkingDelta"),
        }
    }

    #[test]
    fn parses_tool_events() {
        let start = json!({
            "type":"tool_execution_start",
            "toolCallId":"t1",
            "toolName":"bash",
            "args":{"command":"ls"}
        });
        match parse_pi_stream_line(&start) {
            PiStreamLine::ToolStart {
                tool_id,
                tool_name,
                args,
            } => {
                assert_eq!(tool_id, "t1");
                assert_eq!(tool_name, "bash");
                assert_eq!(args, Some(json!({"command":"ls"})));
            }
            _ => panic!("expected ToolStart"),
        }
        let end = json!({
            "type":"tool_execution_end",
            "toolCallId":"t1",
            "isError":false,
            "result":{"content":[{"type":"text","text":"ok"}]}
        });
        match parse_pi_stream_line(&end) {
            PiStreamLine::ToolEnd {
                tool_id,
                content,
                is_error,
            } => {
                assert_eq!(tool_id, "t1");
                assert_eq!(content, "ok");
                assert!(!is_error);
            }
            _ => panic!("expected ToolEnd"),
        }
    }

    #[test]
    fn parses_auth_error_on_message_start() {
        let line = json!({
            "type":"message_start",
            "message":{
                "role":"assistant",
                "errorMessage":"401 Invalid bearer token"
            }
        });
        match parse_pi_stream_line(&line) {
            PiStreamLine::AssistantError(err) => assert!(err.contains("401")),
            _ => panic!("expected AssistantError"),
        }
    }

    #[test]
    fn model_and_thinking_flags_filter_defaults() {
        assert_eq!(resolve_model_flag(Some("auto")), None);
        assert_eq!(
            resolve_model_flag(Some("anthropic/claude-sonnet-5")),
            Some("anthropic/claude-sonnet-5".to_string())
        );
        assert_eq!(
            resolve_thinking_flag(Some("high")),
            Some("high".to_string())
        );
        assert_eq!(resolve_thinking_flag(Some("nope")), None);
    }

    #[tokio::test]
    async fn interrupt_unknown_turn_is_idempotent() {
        let session = PiSession::new("ws".to_string(), std::env::temp_dir(), None);
        session
            .interrupt_turn("missing")
            .await
            .expect("idempotent");
        assert!(session.interrupted_turns.lock().await.is_empty());
    }
}
