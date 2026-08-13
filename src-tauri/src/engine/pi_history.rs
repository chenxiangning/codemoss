//! Read PI CLI session history from `~/.pi/agent/sessions/`.
//!
//! Layout (JetBrains PiHistoryReader-aligned):
//! ```text
//! ~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<sessionId>.jsonl
//! ```
//! First line: `{type:"session", id, cwd, timestamp}`
//! Message lines: `{type:"message", id, message:{role, content}}`
//! Roles: user | assistant | toolResult

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader as AsyncBufReader};
use tokio::time::timeout;

const LOCAL_SESSION_SCAN_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_TITLE_CHARS: usize = 80;
const MAX_TOOL_RESULT_CHARS: usize = 20_000;

fn normalize_session_id(session_id: &str) -> Result<String, String> {
    let normalized = session_id.trim();
    if normalized.is_empty()
        || normalized == "."
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
    {
        return Err("[SESSION_NOT_FOUND] Invalid PI session id".to_string());
    }
    Ok(normalized.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiSessionSummary {
    pub session_id: String,
    pub first_message: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub message_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attribution_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiSessionMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    /// "message", "reasoning", or "tool"
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PiSessionUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PiSessionLoadResult {
    pub messages: Vec<PiSessionMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<PiSessionUsage>,
}

struct SessionHeader {
    session_id: String,
    cwd: Option<String>,
    timestamp_ms: i64,
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let truncated: String = value.chars().take(max_chars).collect();
    format!("{truncated}…")
}

fn normalize_windows_path_for_comparison(path: &str) -> String {
    if path.is_empty() {
        return String::new();
    }
    let mut normalized = path.replace('\\', "/");
    if normalized.starts_with("//?/UNC/") {
        normalized = format!("//{}", &normalized["//?/UNC/".len()..]);
    } else if normalized.starts_with("//?/") {
        normalized = normalized["//?/".len()..].to_string();
    }
    while normalized.ends_with('/') && normalized.len() > 1 {
        normalized.pop();
    }
    normalized
}

fn build_path_variants(path: &str) -> Vec<String> {
    let normalized = normalize_windows_path_for_comparison(path.trim());
    if normalized.is_empty() {
        return Vec::new();
    }
    let mut variants = vec![normalized.clone()];
    if normalized.starts_with("/private/") {
        variants.push(normalized["/private".len()..].to_string());
    } else if normalized.starts_with('/') {
        variants.push(format!("/private{normalized}"));
    }
    if normalized.len() >= 2 && normalized.as_bytes()[1] == b':' {
        let mut chars = normalized.chars();
        if let Some(first) = chars.next() {
            variants.push(format!("{}{}", first.to_ascii_lowercase(), chars.as_str()));
        }
        variants.push(normalized.to_ascii_lowercase());
    }
    if normalized.starts_with("//") {
        variants.push(normalized.to_ascii_lowercase());
    }
    variants.sort();
    variants.dedup();
    variants
}

fn build_workspace_path_variants(workspace_path: &Path) -> Vec<String> {
    let workspace_raw = workspace_path.to_string_lossy().to_string();
    let mut workspace_variants = build_path_variants(&workspace_raw);
    if let Ok(canonical_workspace) = std::fs::canonicalize(workspace_path) {
        let canonical_workspace_raw = canonical_workspace.to_string_lossy().to_string();
        workspace_variants.extend(build_path_variants(&canonical_workspace_raw));
    }
    workspace_variants.sort();
    workspace_variants.dedup();
    workspace_variants
}

fn paths_match(candidate: &str, workspace_variants: &[String]) -> bool {
    let candidate_variants = build_path_variants(candidate);
    for left in &candidate_variants {
        for right in workspace_variants {
            if left.eq_ignore_ascii_case(right) {
                return true;
            }
        }
    }
    false
}

fn parse_iso_millis(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.timestamp_millis())
        .or_else(|| {
            value
                .parse::<i64>()
                .ok()
                .map(|n| if n < 1_000_000_000_000 { n * 1000 } else { n })
        })
        .unwrap_or(0)
}

fn extract_text_blocks(content: Option<&Value>) -> String {
    let Some(content) = content else {
        return String::new();
    };
    if let Some(text) = content.as_str() {
        return text.to_string();
    }
    let Some(parts) = content.as_array() else {
        return String::new();
    };
    parts
        .iter()
        .filter_map(|part| {
            if let Some(text) = part.as_str() {
                return Some(text.to_string());
            }
            let kind = part.get("type").and_then(Value::as_str).unwrap_or("");
            match kind {
                "text" => part
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                "thinking" => part
                    .get("thinking")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                _ => None,
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn resolve_pi_sessions_root(home_override: Option<&str>) -> PathBuf {
    if let Ok(override_dir) = std::env::var("PI_CODING_AGENT_SESSION_DIR") {
        let trimmed = override_dir.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    if let Some(home) = home_override.map(str::trim).filter(|v| !v.is_empty()) {
        return PathBuf::from(home).join("sessions");
    }
    if let Ok(agent_dir) = std::env::var("PI_CODING_AGENT_DIR") {
        let trimmed = agent_dir.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("sessions");
        }
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".pi")
        .join("agent")
        .join("sessions")
}

fn header_from_file_name(file: &Path) -> Option<SessionHeader> {
    let name = file.file_name()?.to_string_lossy();
    if !name.ends_with(".jsonl") {
        return None;
    }
    let stem = &name[..name.len() - ".jsonl".len()];
    let underscore = stem.rfind('_')?;
    if underscore == 0 || underscore + 1 >= stem.len() {
        return None;
    }
    let session_id = stem[underscore + 1..].to_string();
    if session_id.is_empty() {
        return None;
    }
    Some(SessionHeader {
        session_id,
        cwd: None,
        timestamp_ms: 0,
    })
}

fn parse_header(value: &Value, file: &Path) -> Option<SessionHeader> {
    let mut session_id = value
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);
    if session_id.is_none() {
        session_id = header_from_file_name(file).map(|h| h.session_id);
    }
    let session_id = session_id?;
    let cwd = value
        .get("cwd")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);
    let timestamp_ms = value
        .get("timestamp")
        .and_then(Value::as_str)
        .map(parse_iso_millis)
        .unwrap_or(0);
    Some(SessionHeader {
        session_id,
        cwd,
        timestamp_ms,
    })
}

async fn file_mtime_ms(path: &Path) -> i64 {
    fs::metadata(path)
        .await
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

async fn read_session_summary(file: &Path) -> Option<PiSessionSummary> {
    let file_handle = fs::File::open(file).await.ok()?;
    let mut lines = AsyncBufReader::new(file_handle).lines();
    let mut header: Option<SessionHeader> = None;
    let mut first_user_prompt: Option<String> = None;
    let mut message_count: usize = 0;
    let mut last_ts: i64 = 0;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");
        if event_type == "session" && header.is_none() {
            header = parse_header(&value, file);
            continue;
        }
        if event_type != "message" {
            continue;
        }
        let Some(message) = value.get("message") else {
            continue;
        };
        let role = message.get("role").and_then(Value::as_str).unwrap_or("");
        let ts = value
            .get("timestamp")
            .and_then(Value::as_str)
            .map(parse_iso_millis)
            .or_else(|| {
                message
                    .get("timestamp")
                    .and_then(|v| v.as_i64())
                    .map(|n| if n < 1_000_000_000_000 { n * 1000 } else { n })
            })
            .unwrap_or(0);
        if ts > last_ts {
            last_ts = ts;
        }
        if role == "user" {
            message_count += 1;
            if first_user_prompt.is_none() {
                let text = extract_text_blocks(message.get("content"));
                if !text.trim().is_empty() {
                    first_user_prompt = Some(text);
                }
            }
        } else if role == "assistant" {
            message_count += 1;
        }
    }

    let header = header.or_else(|| header_from_file_name(file))?;
    if header.session_id.is_empty() {
        return None;
    }
    let mtime = file_mtime_ms(file).await;
    let created_at = if header.timestamp_ms > 0 {
        header.timestamp_ms
    } else {
        mtime
    };
    let updated_at = if last_ts > 0 { last_ts } else { mtime };
    let first_message = first_user_prompt
        .map(|text| truncate_chars(text.trim(), MAX_TITLE_CHARS))
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| {
            let short = if header.session_id.chars().count() > 8 {
                truncate_chars(&header.session_id, 8)
            } else {
                header.session_id.clone()
            };
            format!("PI session {short}")
        });
    let file_size = fs::metadata(file).await.ok().map(|m| m.len());

    Some(PiSessionSummary {
        session_id: header.session_id,
        first_message,
        updated_at,
        created_at,
        message_count,
        file_size_bytes: file_size,
        engine: Some("pi".to_string()),
        canonical_session_id: None,
        attribution_status: None,
    })
}

async fn list_all_session_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    let mut cwd_dirs = fs::read_dir(root)
        .await
        .map_err(|e| format!("Failed to read PI sessions root: {e}"))?;
    while let Some(entry) = cwd_dirs
        .next_entry()
        .await
        .map_err(|e| format!("Failed to walk PI sessions root: {e}"))?
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if name.starts_with('.') {
            continue;
        }
        let mut jsonl = fs::read_dir(&path)
            .await
            .map_err(|e| format!("Failed to read PI cwd dir: {e}"))?;
        while let Some(file_entry) = jsonl
            .next_entry()
            .await
            .map_err(|e| format!("Failed to walk PI cwd dir: {e}"))?
        {
            let file_path = file_entry.path();
            if file_path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("jsonl"))
            {
                files.push(file_path);
            }
        }
    }
    Ok(files)
}

async fn resolve_session_file(
    root: &Path,
    session_id: &str,
    workspace_path: &Path,
    allow_cwd_mismatch_fallback: bool,
) -> Result<Option<PathBuf>, String> {
    let workspace_variants = build_workspace_path_variants(workspace_path);
    let files = list_all_session_files(root).await?;
    let mut fallback: Option<PathBuf> = None;
    for file in files {
        let file_handle = match fs::File::open(&file).await {
            Ok(handle) => handle,
            Err(_) => continue,
        };
        let mut lines = AsyncBufReader::new(file_handle).lines();
        let first_line = lines.next_line().await.ok().flatten();
        let header = first_line
            .as_deref()
            .and_then(|line| serde_json::from_str::<Value>(line.trim()).ok())
            .and_then(|value| {
                if value.get("type").and_then(Value::as_str) == Some("session") {
                    parse_header(&value, &file)
                } else {
                    None
                }
            })
            .or_else(|| header_from_file_name(&file));
        let Some(header) = header else {
            continue;
        };
        if header.session_id != session_id {
            continue;
        }
        if let Some(cwd) = header.cwd.as_deref() {
            if paths_match(cwd, &workspace_variants) {
                return Ok(Some(file));
            }
        }
        if allow_cwd_mismatch_fallback && fallback.is_none() {
            fallback = Some(file);
        }
    }
    Ok(fallback)
}

pub async fn list_pi_sessions(
    workspace_path: &Path,
    limit: Option<usize>,
    home_dir: Option<&str>,
) -> Result<Vec<PiSessionSummary>, String> {
    let scan = async {
        let root = resolve_pi_sessions_root(home_dir);
        let workspace_variants = build_workspace_path_variants(workspace_path);
        let files = list_all_session_files(&root).await?;
        let mut sessions = Vec::new();
        for file in files {
            let Some(summary) = read_session_summary(&file).await else {
                continue;
            };
            // Prefer cwd match when available by re-reading header cwd cheaply.
            let file_handle = match fs::File::open(&file).await {
                Ok(handle) => handle,
                Err(_) => continue,
            };
            let mut lines = AsyncBufReader::new(file_handle).lines();
            let first_line = lines.next_line().await.ok().flatten();
            let cwd = first_line
                .as_deref()
                .and_then(|line| serde_json::from_str::<Value>(line.trim()).ok())
                .and_then(|value| {
                    value
                        .get("cwd")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                });
            if let Some(cwd) = cwd {
                if !paths_match(&cwd, &workspace_variants) {
                    continue;
                }
            }
            sessions.push(summary);
        }
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        if let Some(limit) = limit {
            sessions.truncate(limit);
        }
        Ok::<_, String>(sessions)
    };
    timeout(LOCAL_SESSION_SCAN_TIMEOUT, scan)
        .await
        .map_err(|_| "PI session scan timed out".to_string())?
}

fn convert_assistant_message(
    message: &Value,
    entry_id: Option<&str>,
    counter_base: &mut usize,
    timestamp: Option<String>,
) -> Vec<PiSessionMessage> {
    let mut out = Vec::new();
    let Some(parts) = message.get("content").and_then(Value::as_array) else {
        return out;
    };
    let mut text_buf = String::new();
    let mut think_buf = String::new();
    for part in parts {
        let kind = part.get("type").and_then(Value::as_str).unwrap_or("");
        match kind {
            "text" => {
                if let Some(text) = part.get("text").and_then(Value::as_str) {
                    if !text.is_empty() {
                        if !text_buf.is_empty() {
                            text_buf.push('\n');
                        }
                        text_buf.push_str(text);
                    }
                }
            }
            "thinking" => {
                if let Some(text) = part.get("thinking").and_then(Value::as_str) {
                    if !text.is_empty() {
                        if !think_buf.is_empty() {
                            think_buf.push('\n');
                        }
                        think_buf.push_str(text);
                    }
                }
            }
            "toolCall" => {
                if !think_buf.is_empty() {
                    *counter_base += 1;
                    let id = entry_id
                        .map(|e| format!("{e}-think-{counter_base}"))
                        .unwrap_or_else(|| format!("pi-think-{counter_base}"));
                    out.push(PiSessionMessage {
                        id,
                        role: "assistant".to_string(),
                        text: std::mem::take(&mut think_buf),
                        images: None,
                        timestamp: timestamp.clone(),
                        kind: "reasoning".to_string(),
                        tool_type: None,
                        title: None,
                        tool_input: None,
                        tool_output: None,
                    });
                }
                if !text_buf.is_empty() {
                    *counter_base += 1;
                    let id = entry_id
                        .map(|e| format!("{e}-text-{counter_base}"))
                        .unwrap_or_else(|| format!("pi-text-{counter_base}"));
                    out.push(PiSessionMessage {
                        id,
                        role: "assistant".to_string(),
                        text: std::mem::take(&mut text_buf),
                        images: None,
                        timestamp: timestamp.clone(),
                        kind: "message".to_string(),
                        tool_type: None,
                        title: None,
                        tool_input: None,
                        tool_output: None,
                    });
                }
                *counter_base += 1;
                let tool_id = part
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|v| !v.is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("pi-tool-{counter_base}"));
                let name = part
                    .get("name")
                    .and_then(Value::as_str)
                    .filter(|v| !v.is_empty())
                    .unwrap_or("tool")
                    .to_string();
                let input = part.get("arguments").cloned();
                out.push(PiSessionMessage {
                    id: tool_id,
                    role: "assistant".to_string(),
                    text: String::new(),
                    images: None,
                    timestamp: timestamp.clone(),
                    kind: "tool".to_string(),
                    tool_type: Some(name),
                    title: None,
                    tool_input: input,
                    tool_output: None,
                });
            }
            _ => {}
        }
    }
    if !think_buf.is_empty() {
        *counter_base += 1;
        let id = entry_id
            .map(|e| format!("{e}-think-{counter_base}"))
            .unwrap_or_else(|| format!("pi-think-{counter_base}"));
        out.push(PiSessionMessage {
            id,
            role: "assistant".to_string(),
            text: think_buf,
            images: None,
            timestamp: timestamp.clone(),
            kind: "reasoning".to_string(),
            tool_type: None,
            title: None,
            tool_input: None,
            tool_output: None,
        });
    }
    if !text_buf.is_empty() {
        *counter_base += 1;
        let id = entry_id
            .map(|e| format!("{e}-text-{counter_base}"))
            .unwrap_or_else(|| format!("pi-text-{counter_base}"));
        out.push(PiSessionMessage {
            id,
            role: "assistant".to_string(),
            text: text_buf,
            images: None,
            timestamp,
            kind: "message".to_string(),
            tool_type: None,
            title: None,
            tool_input: None,
            tool_output: None,
        });
    }
    out
}

pub async fn load_pi_session(
    workspace_path: &Path,
    session_id: &str,
    home_dir: Option<&str>,
) -> Result<PiSessionLoadResult, String> {
    let session_id = normalize_session_id(session_id)?;
    let root = resolve_pi_sessions_root(home_dir);
    let Some(file) = resolve_session_file(&root, &session_id, workspace_path, true).await? else {
        return Err(format!(
            "[SESSION_NOT_FOUND] PI session not found: {session_id}"
        ));
    };

    let file_handle = fs::File::open(&file)
        .await
        .map_err(|e| format!("Failed to open PI session: {e}"))?;
    let mut lines = AsyncBufReader::new(file_handle).lines();
    let mut messages = Vec::new();
    let mut counter: usize = 0;
    let mut usage: Option<PiSessionUsage> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if value.get("type").and_then(Value::as_str) != Some("message") {
            continue;
        }
        let Some(message) = value.get("message") else {
            continue;
        };
        let role = message.get("role").and_then(Value::as_str).unwrap_or("");
        let entry_id = value.get("id").and_then(Value::as_str);
        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
        match role {
            "user" => {
                let raw_text = extract_text_blocks(message.get("content"));
                // Legacy injection marker first (pre-`@file` sessions), then the
                // `@file`-era `<file name="...">` wrappers. Image content blocks
                // are ignored: display goes through paths.
                let (display_text, images) = {
                    let (legacy_text, legacy_images) =
                        crate::engine::cli_image_input::split_pi_prompt_for_display(&raw_text);
                    if !legacy_images.is_empty() {
                        (legacy_text, legacy_images)
                    } else {
                        crate::engine::cli_image_input::split_pi_file_attachments_for_display(
                            &legacy_text,
                        )
                    }
                };
                if display_text.trim().is_empty() && images.is_empty() {
                    continue;
                }
                counter += 1;
                messages.push(PiSessionMessage {
                    id: entry_id
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("pi-user-{counter}")),
                    role: "user".to_string(),
                    text: display_text,
                    images: (!images.is_empty()).then_some(images),
                    timestamp,
                    kind: "message".to_string(),
                    tool_type: None,
                    title: None,
                    tool_input: None,
                    tool_output: None,
                });
            }
            "assistant" => {
                if let Some(u) = message.get("usage") {
                    usage = Some(PiSessionUsage {
                        input_tokens: u.get("input").and_then(Value::as_i64),
                        output_tokens: u.get("output").and_then(Value::as_i64),
                        cache_creation_input_tokens: u.get("cacheWrite").and_then(Value::as_i64),
                        cache_read_input_tokens: u.get("cacheRead").and_then(Value::as_i64),
                    });
                }
                let converted =
                    convert_assistant_message(message, entry_id, &mut counter, timestamp);
                messages.extend(converted);
            }
            "toolResult" => {
                counter += 1;
                let call_id = message
                    .get("toolCallId")
                    .and_then(Value::as_str)
                    .filter(|v| !v.is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("pi-tool-{counter}"));
                let content = truncate_chars(
                    &extract_text_blocks(message.get("content")),
                    MAX_TOOL_RESULT_CHARS,
                );
                let is_error = message
                    .get("isError")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                messages.push(PiSessionMessage {
                    id: format!("{call_id}-result"),
                    role: "tool".to_string(),
                    text: content.clone(),
                    images: None,
                    timestamp,
                    kind: "tool".to_string(),
                    tool_type: Some(if is_error {
                        "error".to_string()
                    } else {
                        "result".to_string()
                    }),
                    title: None,
                    tool_input: None,
                    tool_output: Some(Value::String(content)),
                });
            }
            _ => {}
        }
    }

    Ok(PiSessionLoadResult { messages, usage })
}

pub async fn delete_pi_session(
    workspace_path: &Path,
    session_id: &str,
    home_dir: Option<&str>,
) -> Result<(), String> {
    let session_id = normalize_session_id(session_id)?;
    let root = resolve_pi_sessions_root(home_dir);
    let Some(file) = resolve_session_file(&root, &session_id, workspace_path, false).await? else {
        return Err(format!(
            "[SESSION_NOT_FOUND] PI session not found: {session_id}"
        ));
    };
    fs::remove_file(&file)
        .await
        .map_err(|e| format!("Failed to delete PI session: {e}"))?;
    if let Some(parent) = file.parent() {
        if let Ok(mut entries) = fs::read_dir(parent).await {
            let mut empty = true;
            while let Ok(Some(_)) = entries.next_entry().await {
                empty = false;
                break;
            }
            if empty {
                let _ = fs::remove_dir(parent).await;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn lists_and_loads_pi_session_jsonl() {
        let dir = std::env::temp_dir().join(format!(
            "pi-history-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let sessions = dir.join("sessions");
        let cwd_dir = sessions.join("--tmp-project--");
        std::fs::create_dir_all(&cwd_dir).expect("mkdir");
        let session_id = "019fe705-27fd-712e-a1be-f972ef3773f3";
        let file = cwd_dir.join(format!("2026-08-09T14-55-02-653Z_{session_id}.jsonl"));
        let project = dir.join("project");
        std::fs::create_dir_all(&project).unwrap();
        let mut handle = std::fs::File::create(&file).expect("create");
        writeln!(
            handle,
            r#"{{"type":"session","version":3,"id":"{session_id}","timestamp":"2026-08-09T14:55:02.653Z","cwd":"{}"}}"#,
            project.display()
        )
        .unwrap();
        writeln!(
            handle,
            r#"{{"type":"message","id":"m1","timestamp":"2026-08-09T14:55:02.745Z","message":{{"role":"user","content":[{{"type":"text","text":"hello pi"}}]}}}}"#
        )
        .unwrap();
        writeln!(
            handle,
            r#"{{"type":"message","id":"m2","timestamp":"2026-08-09T14:55:22.105Z","message":{{"role":"assistant","content":[{{"type":"thinking","thinking":"hi"}},{{"type":"text","text":"pong"}}],"usage":{{"input":10,"output":2}}}}}}"#
        )
        .unwrap();

        let agent_dir = dir.to_string_lossy().to_string();
        let list = list_pi_sessions(&project, Some(10), Some(&agent_dir))
            .await
            .expect("list");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].session_id, session_id);
        assert!(list[0].first_message.contains("hello"));

        let loaded = load_pi_session(&project, session_id, Some(&agent_dir))
            .await
            .expect("load");
        assert_eq!(loaded.messages.len(), 3); // user + reasoning + text
        assert_eq!(loaded.messages[0].role, "user");
        assert_eq!(loaded.messages[1].kind, "reasoning");
        assert_eq!(loaded.messages[2].text, "pong");
        assert_eq!(loaded.usage.as_ref().unwrap().input_tokens, Some(10));

        delete_pi_session(&project, session_id, Some(&agent_dir))
            .await
            .expect("delete");
        assert!(!file.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn loads_at_file_era_user_message_with_images() {
        let dir = std::env::temp_dir().join(format!(
            "pi-history-atfile-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let sessions = dir.join("sessions");
        let cwd_dir = sessions.join("--tmp-project--");
        std::fs::create_dir_all(&cwd_dir).expect("mkdir");
        let session_id = "019fe705-27fd-712e-a1be-f972ef3773f4";
        let file = cwd_dir.join(format!("2026-08-14T05-00-00-000Z_{session_id}.jsonl"));
        let project = dir.join("project");
        std::fs::create_dir_all(&project).unwrap();
        let mut handle = std::fs::File::create(&file).expect("create");
        writeln!(
            handle,
            r#"{{"type":"session","version":3,"id":"{session_id}","timestamp":"2026-08-14T05:00:00.000Z","cwd":"{}"}}"#,
            project.display()
        )
        .unwrap();
        // `@file`-era user turn: <file name> wrappers + user text in the text
        // block, plus a base64 image content block that must NOT be projected.
        writeln!(
            handle,
            r#"{{"type":"message","id":"m1","timestamp":"2026-08-14T05:00:01.000Z","message":{{"role":"user","content":[{{"type":"text","text":"<file name=\"/abs/one.png\"></file>\n<file name=\"/abs/two.png\">[Image resized to 1024x768.]</file>\ncompare these"}},{{"type":"image","data":"aGVsbG8=","mimeType":"image/png"}}]}}}}"#
        )
        .unwrap();
        // Legacy injection-era turn must keep parsing too.
        writeln!(
            handle,
            r#"{{"type":"message","id":"m2","timestamp":"2026-08-14T05:01:00.000Z","message":{{"role":"user","content":[{{"type":"text","text":"legacy text\n\n<!-- mossx:pi-image-attachments -->\nThe user attached the following image file(s). You MUST call the read tool on each absolute path below before answering questions about visual content.\n1. /abs/legacy.png\n"}}]}}}}"#
        )
        .unwrap();

        let agent_dir = dir.to_string_lossy().to_string();
        let loaded = load_pi_session(&project, session_id, Some(&agent_dir))
            .await
            .expect("load");
        assert_eq!(loaded.messages.len(), 2);

        let at_file_turn = &loaded.messages[0];
        assert_eq!(at_file_turn.text, "compare these");
        assert_eq!(
            at_file_turn.images,
            Some(vec!["/abs/one.png".to_string(), "/abs/two.png".to_string()])
        );
        assert!(!at_file_turn.text.contains("aGVsbG8="));

        let legacy_turn = &loaded.messages[1];
        assert_eq!(legacy_turn.text, "legacy text");
        assert_eq!(legacy_turn.images, Some(vec!["/abs/legacy.png".to_string()]));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
