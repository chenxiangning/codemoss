//! OMP-owned ACP request and session contract.

use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};

use super::cli_image_input::{
    collect_non_empty_image_paths, describe_image_ref_for_error, is_image_attachment_path,
    normalize_local_image_path,
};

/// 单张图片附件的解码后字节上限。OMP ACP 帧走 JSONL，reader 侧默认上限
/// 1 MiB/帧（OMP_MAX_FRAME_BYTES）；base64 膨胀 4/3，768 KiB 解码上限让
/// 整个 prompt 帧保持在一帧预算内。
pub const OMP_MAX_IMAGE_ATTACHMENT_BYTES: u64 = 768 * 1024;

/// 附件归一化的 typed 失败原因。oversize/unknown mime 显式上报，绝不静默丢弃。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OmpAttachmentError {
    EmptyReference,
    NotRegularFile,
    Unreadable { reason: String },
    Oversize { limit: u64, actual: u64 },
    UnsupportedMime { mime: String },
    MalformedDataUrl,
}

impl std::fmt::Display for OmpAttachmentError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyReference => formatter.write_str("empty attachment reference"),
            Self::NotRegularFile => formatter.write_str("not a regular file"),
            Self::Unreadable { reason } => write!(formatter, "unreadable: {reason}"),
            Self::Oversize { limit, actual } => {
                write!(formatter, "exceeds {limit} byte limit (actual={actual})")
            }
            Self::UnsupportedMime { mime } => write!(formatter, "unsupported mime: {mime}"),
            Self::MalformedDataUrl => formatter.write_str("malformed data URL"),
        }
    }
}

impl std::error::Error for OmpAttachmentError {}

/// 显式降级的附件条目。`source` 已脱敏（data URL 不落原文，防多 MB
/// base64 泄漏进日志/错误气泡）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OmpAttachmentDegraded {
    pub source: String,
    pub reason: String,
}

/// prompt 归一化结果：canonical content blocks + 显式 degraded 列表。
#[derive(Debug, Default)]
pub struct OmpNormalizedPrompt {
    pub blocks: Vec<Value>,
    pub degraded: Vec<OmpAttachmentDegraded>,
}

/// 已知图片扩展名 → mime。不在表内的「图片」扩展名是 UnsupportedMime
/// （显式 degraded），不静默猜 image/png。
fn omp_image_mime_for_path(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => Some("image/png"),
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("gif") => Some("image/gif"),
        Some("webp") => Some("image/webp"),
        Some("bmp") => Some("image/bmp"),
        _ => None,
    }
}

/// canonical attachment content block 形状（镜像仓库既有 ACP 归一化模式，
/// 与 grok.rs/qoder.rs/pi.rs 的 ACP image block 同一 shape）：
/// image → {"type":"image","mimeType":...,"data":base64}
/// file  → {"type":"resource_link","uri":"file://<abs>","name":<basename>}
fn normalize_image_path_attachment(path: &Path) -> Result<Value, OmpAttachmentError> {
    let mime =
        omp_image_mime_for_path(path).ok_or_else(|| OmpAttachmentError::UnsupportedMime {
            mime: path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("<none>")
                .to_string(),
        })?;
    let metadata = std::fs::metadata(path).map_err(|error| OmpAttachmentError::Unreadable {
        reason: format!("stat failed: {error}"),
    })?;
    if !metadata.is_file() {
        return Err(OmpAttachmentError::NotRegularFile);
    }
    if metadata.len() > OMP_MAX_IMAGE_ATTACHMENT_BYTES {
        return Err(OmpAttachmentError::Oversize {
            limit: OMP_MAX_IMAGE_ATTACHMENT_BYTES,
            actual: metadata.len(),
        });
    }
    let bytes = std::fs::read(path).map_err(|error| OmpAttachmentError::Unreadable {
        reason: format!("read failed: {error}"),
    })?;
    if bytes.is_empty() {
        return Err(OmpAttachmentError::EmptyReference);
    }
    Ok(json!({
        "type": "image",
        "mimeType": mime,
        "data": BASE64_STANDARD.encode(bytes),
    }))
}

fn normalize_data_url_attachment(raw: &str) -> Result<Value, OmpAttachmentError> {
    let Some((header, payload)) = raw.trim().split_once(',') else {
        return Err(OmpAttachmentError::MalformedDataUrl);
    };
    let Some(meta) = header.strip_prefix("data:") else {
        return Err(OmpAttachmentError::MalformedDataUrl);
    };
    let mut parts = meta.split(';');
    let mime = parts.next().map(str::trim).unwrap_or("");
    if !mime.to_ascii_lowercase().starts_with("image/") {
        return Err(OmpAttachmentError::UnsupportedMime {
            mime: mime.to_string(),
        });
    }
    if !parts.any(|part| part.trim().eq_ignore_ascii_case("base64")) {
        return Err(OmpAttachmentError::MalformedDataUrl);
    }
    let bytes = BASE64_STANDARD
        .decode(payload.trim())
        .map_err(|_| OmpAttachmentError::MalformedDataUrl)?;
    if bytes.is_empty() {
        return Err(OmpAttachmentError::EmptyReference);
    }
    if bytes.len() as u64 > OMP_MAX_IMAGE_ATTACHMENT_BYTES {
        return Err(OmpAttachmentError::Oversize {
            limit: OMP_MAX_IMAGE_ATTACHMENT_BYTES,
            actual: bytes.len() as u64,
        });
    }
    Ok(json!({
        "type": "image",
        "mimeType": mime,
        "data": BASE64_STANDARD.encode(bytes),
    }))
}

fn normalize_file_link_attachment(path: &Path) -> Result<Value, OmpAttachmentError> {
    let metadata = std::fs::metadata(path).map_err(|error| OmpAttachmentError::Unreadable {
        reason: format!("stat failed: {error}"),
    })?;
    if !metadata.is_file() {
        return Err(OmpAttachmentError::NotRegularFile);
    }
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("attachment")
        .to_string();
    Ok(json!({
        "type": "resource_link",
        "uri": format!("file://{}", path.to_string_lossy()),
        "name": name,
    }))
}

fn normalize_single_attachment(
    raw: &str,
    workspace_root: &Path,
) -> Result<Value, OmpAttachmentError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(OmpAttachmentError::EmptyReference);
    }
    if trimmed
        .get(..5)
        .map(|prefix| prefix.eq_ignore_ascii_case("data:"))
        == Some(true)
    {
        return normalize_data_url_attachment(trimmed);
    }
    let path = normalize_local_image_path(trimmed)
        .map_err(|reason| OmpAttachmentError::Unreadable { reason })?;
    let path: PathBuf = if path.is_absolute() {
        path
    } else {
        workspace_root.join(path)
    };
    if is_image_attachment_path(&path.to_string_lossy()) {
        normalize_image_path_attachment(&path)
    } else {
        normalize_file_link_attachment(&path)
    }
}

/// image/file attachment → canonical attachment content block 归一化。
///
/// 部分失败记 degraded（调用方 log::warn 可观测）；全部失败则 Err
/// fail-closed，绝不静默丢弃用户附件。文本为空且无附件时返回空 blocks，
/// 由调用方决定是否补 text block。
pub fn normalize_prompt_attachments(
    text: &str,
    attachments: Option<&[String]>,
    workspace_root: &Path,
) -> Result<OmpNormalizedPrompt, String> {
    let mut normalized = OmpNormalizedPrompt::default();
    if !text.trim().is_empty() {
        normalized.blocks.push(json!({
            "type": "text",
            "text": text,
        }));
    }
    let attachment_refs = collect_non_empty_image_paths(attachments);
    let mut loaded = 0usize;
    for raw in &attachment_refs {
        match normalize_single_attachment(raw, workspace_root) {
            Ok(block) => {
                normalized.blocks.push(block);
                loaded += 1;
            }
            Err(error) => normalized.degraded.push(OmpAttachmentDegraded {
                source: describe_image_ref_for_error(raw),
                reason: error.to_string(),
            }),
        }
    }
    if !attachment_refs.is_empty() && loaded == 0 {
        let reasons = normalized
            .degraded
            .iter()
            .map(|entry| format!("{}: {}", entry.source, entry.reason))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(format!(
            "OMP attachment normalization failed: none of the attachments could be normalized ({reasons})"
        ));
    }
    Ok(normalized)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpAcpState {
    New,
    Initialized,
    Prompting,
    Cancelling,
    CancelAcknowledged,
    Terminated,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OmpAcpSession {
    pub state: OmpAcpState,
    next_request_id: u64,
    pub native_session_id: Option<String>,
}

impl Default for OmpAcpSession {
    fn default() -> Self {
        Self::new()
    }
}

impl OmpAcpSession {
    pub fn new() -> Self {
        Self {
            state: OmpAcpState::New,
            next_request_id: 1,
            native_session_id: None,
        }
    }

    pub fn initialize_request(&mut self) -> (u64, Value) {
        let id = self.allocate_request_id();
        (
            id,
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "initialize",
                "params": {
                    "protocolVersion": 1,
                    "clientInfo": {"name": "mossx", "version": env!("CARGO_PKG_VERSION")},
                    "clientCapabilities": {
                        "fs": {"readTextFile": true, "writeTextFile": true}
                    }
                }
            }),
        )
    }

    pub fn session_new_request(&mut self, cwd: &str) -> (u64, Value) {
        let id = self.allocate_request_id();
        (
            id,
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "session/new",
                "params": {"cwd": cwd, "mcpServers": []}
            }),
        )
    }

    pub fn prompt_request(&mut self, prompt: &str) -> Option<(u64, Value)> {
        let native_session_id = self.native_session_id.clone()?;
        let id = self.allocate_request_id();
        self.state = OmpAcpState::Prompting;
        Some((
            id,
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "session/prompt",
                "params": {
                    "sessionId": native_session_id,
                    "prompt": [{"type": "text", "text": prompt}]
                }
            }),
        ))
    }

    pub fn cancel_request(&mut self) -> Option<Value> {
        let native_session_id = self.native_session_id.as_deref()?;
        self.state = OmpAcpState::Cancelling;
        Some(json!({
            "jsonrpc": "2.0",
            "method": "session/cancel",
            "params": {"sessionId": native_session_id}
        }))
    }

    pub fn apply_response(&mut self, method: &str, response: &Value) -> bool {
        if response.get("error").is_some() {
            return false;
        }
        match method {
            "initialize" => self.state = OmpAcpState::Initialized,
            "session/new" => {
                let Some(session_id) = response
                    .get("result")
                    .and_then(|result| result.get("sessionId"))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                else {
                    return false;
                };
                self.native_session_id = Some(session_id.to_owned());
            }
            "session/prompt" => {}
            "session/cancel" => self.state = OmpAcpState::CancelAcknowledged,
            _ => {}
        }
        true
    }

    pub fn apply_update(&mut self, update: &Value) -> Option<&'static str> {
        let method = update.get("method").and_then(Value::as_str);
        let session_update = update
            .get("params")
            .and_then(|params| params.get("update"))
            .and_then(|value| value.get("sessionUpdate"))
            .and_then(Value::as_str);
        if method == Some("session/finished")
            || matches!(session_update, Some("turn_complete" | "session_finished"))
        {
            self.state = OmpAcpState::Terminated;
            return Some("terminal");
        }
        if method == Some("session/update") {
            return Some("session-update");
        }
        None
    }

    fn allocate_request_id(&mut self) -> u64 {
        let id = self.next_request_id;
        self.next_request_id = self.next_request_id.saturating_add(1);
        id
    }
}

#[cfg(test)]
mod tests {
    use super::{OmpAcpSession, OmpAcpState};
    use base64::Engine as _;
    use serde_json::json;

    #[test]
    fn builds_independent_acp_lifecycle_requests() {
        let mut session = OmpAcpSession::new();
        let (initialize_id, initialize) = session.initialize_request();
        let (new_id, new_session) = session.session_new_request("/workspace");
        assert_eq!((initialize_id, new_id), (1, 2));
        assert_eq!(initialize["method"], "initialize");
        assert_eq!(initialize["params"]["clientInfo"]["name"], "mossx");
        assert_eq!(new_session["method"], "session/new");
        assert_eq!(new_session["params"]["mcpServers"], json!([]));
        assert!(session.prompt_request("hello").is_none());
    }

    #[test]
    fn promotes_native_session_and_terminal_state_only_from_successful_response() {
        let mut session = OmpAcpSession::new();
        let (_, _) = session.initialize_request();
        assert!(session.apply_response("initialize", &json!({"result": {}})));
        let (_, _) = session.session_new_request("/workspace");
        assert!(!session.apply_response("session/new", &json!({"result": {}})));
        assert!(
            session.apply_response("session/new", &json!({"result": {"sessionId": "native-1"}}))
        );
        assert_eq!(session.native_session_id.as_deref(), Some("native-1"));
        let (_, prompt) = session.prompt_request("hello").unwrap();
        assert_eq!(prompt["params"]["sessionId"], "native-1");
        assert_eq!(session.state, OmpAcpState::Prompting);
        assert!(session.apply_response("session/prompt", &json!({"result": {}})));
        assert_eq!(session.state, OmpAcpState::Prompting);
        let cancel = session.cancel_request().unwrap();
        assert!(cancel.get("id").is_none());
        assert_eq!(cancel["params"]["sessionId"], "native-1");
        assert!(session.apply_response("session/cancel", &json!({"result": {}})));
        assert_eq!(session.state, OmpAcpState::CancelAcknowledged);
        assert_eq!(
            session.apply_update(&json!({
                "method": "session/update",
                "params": {"update": {"sessionUpdate": "turn_complete"}}
            })),
            Some("terminal")
        );
        assert_eq!(session.state, OmpAcpState::Terminated);
    }

    #[test]
    fn rejects_error_response_and_keeps_state_for_recovery() {
        let mut session = OmpAcpSession::new();
        let (_, _) = session.initialize_request();
        assert!(!session.apply_response("initialize", &json!({"error": {"code": -1}})));
        assert_eq!(session.state, OmpAcpState::New);
    }
    fn write_temp_file(dir: &std::path::Path, name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, bytes).unwrap();
        path
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "omp-acp-attach-{tag}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn normalizes_image_file_into_canonical_acp_image_block() {
        let dir = temp_dir("image");
        let image = write_temp_file(&dir, "shot.png", b"\x89PNG\r\n\x1a\n");
        let normalized = super::normalize_prompt_attachments(
            "看截图",
            Some(&[image.to_string_lossy().into_owned()]),
            &dir,
        )
        .unwrap();
        assert!(normalized.degraded.is_empty());
        assert_eq!(normalized.blocks.len(), 2);
        assert_eq!(normalized.blocks[0]["type"], "text");
        assert_eq!(normalized.blocks[0]["text"], "看截图");
        assert_eq!(normalized.blocks[1]["type"], "image");
        assert_eq!(normalized.blocks[1]["mimeType"], "image/png");
        assert!(normalized.blocks[1]["data"].as_str().unwrap().len() > 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn normalizes_non_image_file_into_resource_link_block() {
        let dir = temp_dir("file");
        let notes = write_temp_file(&dir, "notes.md", b"# hi");
        let normalized = super::normalize_prompt_attachments(
            "总结",
            Some(&[notes.to_string_lossy().into_owned()]),
            &dir,
        )
        .unwrap();
        assert_eq!(normalized.blocks.len(), 2);
        assert_eq!(normalized.blocks[1]["type"], "resource_link");
        assert_eq!(normalized.blocks[1]["name"], "notes.md");
        assert!(normalized.blocks[1]["uri"]
            .as_str()
            .unwrap()
            .starts_with("file://"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn data_url_image_becomes_block_but_non_image_mime_is_degraded() {
        let dir = temp_dir("data-url");
        let png = format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(b"px")
        );
        let normalized = super::normalize_prompt_attachments("", Some(&[png]), &dir).unwrap();
        assert_eq!(normalized.blocks.len(), 1);
        assert_eq!(normalized.blocks[0]["type"], "image");
        assert_eq!(normalized.blocks[0]["mimeType"], "image/png");

        let text_url = "data:text/plain;base64,aGk=".to_string();
        let normalized =
            super::normalize_prompt_attachments("t", Some(&[text_url]), &dir).unwrap_err();
        assert!(normalized.contains("OMP attachment normalization failed"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversize_and_missing_attachments_are_explicit_degraded_entries() {
        let dir = temp_dir("degraded");
        let big = write_temp_file(
            &dir,
            "big.png",
            &vec![0u8; (super::OMP_MAX_IMAGE_ATTACHMENT_BYTES + 1) as usize],
        );
        let missing = dir.join("missing.png").to_string_lossy().into_owned();
        let ok = write_temp_file(&dir, "ok.png", b"\x89PNG");
        let normalized = super::normalize_prompt_attachments(
            "t",
            Some(&[
                big.to_string_lossy().into_owned(),
                missing,
                ok.to_string_lossy().into_owned(),
            ]),
            &dir,
        )
        .unwrap();
        // 成功的图片保留，失败的显式 degraded（不静默丢弃）。
        assert_eq!(normalized.blocks.len(), 2);
        assert_eq!(normalized.degraded.len(), 2);
        assert!(normalized.degraded[0].reason.contains("exceeds"));
        assert!(!normalized
            .degraded
            .iter()
            .any(|entry| entry.reason.is_empty()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn all_failed_attachments_fail_closed_instead_of_silently_dropping() {
        let dir = temp_dir("fail-closed");
        let missing = dir.join("nope.png").to_string_lossy().into_owned();
        let error = super::normalize_prompt_attachments("t", Some(&[missing]), &dir).unwrap_err();
        assert!(error.contains("OMP attachment normalization failed"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn text_only_prompt_keeps_single_text_block() {
        let dir = temp_dir("text-only");
        let normalized = super::normalize_prompt_attachments("hello", None, &dir).unwrap();
        assert_eq!(normalized.blocks.len(), 1);
        assert_eq!(normalized.blocks[0]["type"], "text");
        assert!(normalized.degraded.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
