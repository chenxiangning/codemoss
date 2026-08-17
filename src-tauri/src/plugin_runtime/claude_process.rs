//! Resolve Claude Process Entry from Manifest. Does not spawn production engine::claude.

use std::path::{Path, PathBuf};

use serde_json::Value;

use super::claude_pilot::claude_activation_request;
use super::host::{Host, HostConfig, HostError};
use super::spawn::{
    missing_executable, process_executable_ok, restricted_process_driver_for, supervise_cwd_ok,
    RestrictedProcessDriver, SuperviseTarget,
};

pub const CLAUDE_PROCESS_ENTRY_ID: &str = "claude-cli";
pub const CLAUDE_PLUGIN_ID: &str = "com.mossx.engine.claude";

fn err(code: &'static str, message: impl Into<String>) -> HostError {
    HostError {
        code,
        message: message.into(),
    }
}

pub fn current_platform_id() -> Result<&'static str, HostError> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => Ok("darwin-arm64"),
        ("macos", "x86_64") => Ok("darwin-x64"),
        ("windows", "x86_64") => Ok("windows-x64"),
        ("windows", "aarch64") => Ok("windows-arm64"),
        ("linux", "x86_64") => Ok("linux-x64"),
        ("linux", "aarch64") => Ok("linux-arm64"),
        (os, arch) => Err(err(
            "incompatible",
            format!("unsupported platform {os}-{arch}"),
        )),
    }
}

pub fn claude_manifest_source() -> &'static str {
    include_str!("../../../packages/plugin-engine-claude/.mossx-plugin/plugin.json")
}

pub fn resolve_process_entry_path(
    plugin_root: &Path,
    manifest_source: &str,
    platform: &str,
) -> Result<PathBuf, HostError> {
    if !plugin_root.is_absolute() {
        return Err(err("schema", "plugin root must be absolute"));
    }
    let manifest: Value = serde_json::from_str(manifest_source)
        .map_err(|error| err("schema", format!("invalid manifest: {error}")))?;
    let plugin_id = manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .ok_or_else(|| err("schema", "pluginId is required"))?;
    if plugin_id != CLAUDE_PLUGIN_ID {
        return Err(err(
            "schema",
            format!("expected {CLAUDE_PLUGIN_ID}, got {plugin_id}"),
        ));
    }
    let entries = manifest
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| err("schema", "entries are required"))?;
    let entry = entries
        .iter()
        .find(|item| {
            item.get("id").and_then(Value::as_str) == Some(CLAUDE_PROCESS_ENTRY_ID)
                && item.get("kind").and_then(Value::as_str) == Some("process")
        })
        .ok_or_else(|| err("schema", "claude-cli process entry is required"))?;
    let relative = entry
        .pointer(&format!("/platforms/{platform}"))
        .and_then(Value::as_str)
        .ok_or_else(|| err("incompatible", format!("missing {platform}")))?;
    if relative.trim().is_empty()
        || Path::new(relative).is_absolute()
        || relative.split(['/', '\\']).any(|part| part == "..")
    {
        return Err(err(
            "schema",
            "process entry path must be artifact-relative and canonical",
        ));
    }
    let resolved = plugin_root.join(relative);
    if resolved
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(err("schema", "process entry path must not escape artifact"));
    }
    if !resolved.is_file() {
        return Err(err(
            "activation-failed",
            format!("{} is not a file", resolved.display()),
        ));
    }
    Ok(resolved)
}

pub fn claude_process_driver_for(plugin_root: &Path) -> RestrictedProcessDriver {
    let Ok(platform) = current_platform_id() else {
        return RestrictedProcessDriver::new(missing_executable());
    };
    match resolve_process_entry_path(plugin_root, claude_manifest_source(), platform) {
        Ok(path) => restricted_process_driver_for(path.to_str()),
        Err(_) => RestrictedProcessDriver::new(missing_executable()),
    }
}

pub fn map_claude_bin_to_supervise(bin: Option<&str>) -> Option<SuperviseTarget> {
    let raw = bin.map(str::trim).filter(|value| !value.is_empty())?;
    let path = PathBuf::from(raw);
    if !process_executable_ok(&path) || !path.is_file() {
        return None;
    }
    Some(SuperviseTarget {
        executable: path,
        argv: Vec::new(),
        cwd: None,
    })
}

pub const CLAUDE_PROCESS_ENTRY_ENV: &str = "MOSSX_CLAUDE_PROCESS_ENTRY";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaudeSpawnOwner {
    CoreCommand,
    ProcessEntry,
    Denied,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClaudeLineSource {
    Tokio,
    ProcessEntry,
}

pub fn decide_claude_line_source(process_entry_enabled: bool) -> ClaudeLineSource {
    if process_entry_enabled {
        ClaudeLineSource::ProcessEntry
    } else {
        ClaudeLineSource::Tokio
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinePoll {
    Line(String),
    Eof,
    Pending,
}

pub fn claude_process_entry_enabled() -> bool {
    claude_process_entry_enabled_from(std::env::var_os(CLAUDE_PROCESS_ENTRY_ENV).as_deref())
}

pub fn claude_process_entry_enabled_from(value: Option<&std::ffi::OsStr>) -> bool {
    match value.and_then(std::ffi::OsStr::to_str).map(str::trim) {
        None | Some("") => true,
        Some("0" | "false" | "FALSE" | "no" | "off") => false,
        Some("1" | "true" | "TRUE" | "yes" | "on") => true,
        _ => true,
    }
}

pub fn spawn_plan_from_command(
    program: impl AsRef<Path>,
    args: &[impl AsRef<str>],
    cwd: Option<&Path>,
) -> Option<SuperviseTarget> {
    let executable = program.as_ref().to_path_buf();
    if !process_executable_ok(&executable) || !executable.is_file() {
        return None;
    }
    let cwd = match cwd {
        Some(path) if supervise_cwd_ok(path) => Some(path.to_path_buf()),
        Some(_) => return None,
        None => None,
    };
    Some(SuperviseTarget {
        executable,
        argv: args.iter().map(|arg| arg.as_ref().to_string()).collect(),
        cwd,
    })
}

pub fn decide_claude_spawn_owner(
    process_entry_enabled: bool,
    plan: Option<&SuperviseTarget>,
) -> ClaudeSpawnOwner {
    match (process_entry_enabled, plan) {
        (false, _) => ClaudeSpawnOwner::CoreCommand,
        (true, Some(_)) => ClaudeSpawnOwner::ProcessEntry,
        (true, None) => ClaudeSpawnOwner::Denied,
    }
}

pub fn claude_spawn_owner_error(owner: ClaudeSpawnOwner) -> Option<&'static str> {
    match owner {
        ClaudeSpawnOwner::CoreCommand | ClaudeSpawnOwner::ProcessEntry => None,
        ClaudeSpawnOwner::Denied => Some("process-entry-bin-denied"),
    }
}

pub fn claude_plugin_package_root() -> PathBuf {
    PathBuf::from(env!("MOSSX_CLAUDE_PROCESS_ENTRY_ROOT"))
}

pub fn claude_plugin_source_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packages/plugin-engine-claude")
}

pub fn is_product_valid_claude_stream_event(event: &Value) -> bool {
    matches!(
        event.get("type").and_then(Value::as_str),
        Some(
            "stream_event"
                | "system"
                | "assistant"
                | "assistant_message_delta"
                | "message_delta"
                | "text_delta"
                | "output_text_delta"
                | "assistant_message"
                | "message"
                | "user"
                | "result"
                | "reasoning_delta"
                | "thinking_delta"
                | "error"
                | "tool_use"
                | "tool_result"
        )
    )
}

#[derive(Debug)]
pub struct SupervisedTurnIoError {
    pub code: &'static str,
    pub message: String,
}

pub struct ProcessEntryTurn {
    host: Host<RestrictedProcessDriver>,
    generation: u64,
    cursor: SupervisedStdoutCursor,
    stderr: Vec<u8>,
}

impl ProcessEntryTurn {
    pub fn generation(&self) -> u64 {
        self.generation
    }

    pub fn live_count(&self) -> usize {
        self.host.driver().live_count()
    }

    pub fn child_pid(&self) -> Option<u32> {
        self.host
            .driver()
            .child_pid(CLAUDE_PLUGIN_ID, CLAUDE_PROCESS_ENTRY_ID, self.generation)
    }

    pub fn write_stdin(&mut self, data: &[u8]) -> Result<(), SupervisedTurnIoError> {
        self.host
            .driver_mut()
            .write_supervised_stdio(
                CLAUDE_PLUGIN_ID,
                CLAUDE_PROCESS_ENTRY_ID,
                self.generation,
                data,
            )
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-write",
                message: "failed to write supervised stdin".into(),
            })
    }

    pub fn close_stdin(&mut self) -> Result<(), SupervisedTurnIoError> {
        self.host
            .driver_mut()
            .close_supervised_stdin(CLAUDE_PLUGIN_ID, CLAUDE_PROCESS_ENTRY_ID, self.generation)
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-close",
                message: "failed to close supervised stdin".into(),
            })
    }

    pub fn interrupt(&mut self) -> Result<(), SupervisedTurnIoError> {
        self.host
            .interrupt(CLAUDE_PLUGIN_ID, self.generation)
            .map_err(|error| SupervisedTurnIoError {
                code: error.code,
                message: error.message,
            })
    }

    pub fn poll_stdout_line(&mut self) -> Result<LinePoll, SupervisedTurnIoError> {
        self.drain_stderr()?;
        self.cursor.poll_line(
            self.host.driver_mut(),
            CLAUDE_PLUGIN_ID,
            CLAUDE_PROCESS_ENTRY_ID,
            self.generation,
        )
    }

    pub fn take_stderr(&mut self) -> String {
        let _ = self.drain_stderr();
        String::from_utf8_lossy(&self.stderr).into_owned()
    }

    pub fn try_wait(&mut self) -> Result<Option<i32>, SupervisedTurnIoError> {
        self.host
            .driver_mut()
            .wait_supervised(CLAUDE_PLUGIN_ID, CLAUDE_PROCESS_ENTRY_ID, self.generation)
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-wait",
                message: "failed to wait supervised process".into(),
            })
    }

    pub fn wait_until(
        &mut self,
        deadline: std::time::Instant,
    ) -> Result<Option<i32>, SupervisedTurnIoError> {
        loop {
            if let Some(code) = self.try_wait()? {
                return Ok(Some(code));
            }
            if std::time::Instant::now() >= deadline {
                return Ok(None);
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
    }

    fn drain_stderr(&mut self) -> Result<(), SupervisedTurnIoError> {
        drain_supervised_stderr(
            self.host.driver_mut(),
            CLAUDE_PLUGIN_ID,
            CLAUDE_PROCESS_ENTRY_ID,
            self.generation,
            &mut self.stderr,
        )
    }
}

pub fn spawn_process_entry_turn(
    plugin_root: &Path,
    plan: SuperviseTarget,
) -> Result<ProcessEntryTurn, SupervisedTurnIoError> {
    let platform = current_platform_id().map_err(|error| SupervisedTurnIoError {
        code: error.code,
        message: error.message,
    })?;
    let path = resolve_process_entry_path(plugin_root, claude_manifest_source(), platform)
        .map_err(|error| SupervisedTurnIoError {
            code: error.code,
            message: error.message,
        })?;
    let driver = restricted_process_driver_for(path.to_str()).with_supervise(plan);
    let mut host = Host::new(
        HostConfig {
            enabled: true,
            ..HostConfig::default()
        },
        driver,
    )
    .map_err(|error| SupervisedTurnIoError {
        code: error.code,
        message: error.message,
    })?;
    let generation = host
        .activate(claude_activation_request())
        .map_err(|error| SupervisedTurnIoError {
            code: error.code,
            message: error.message,
        })?;
    Ok(ProcessEntryTurn {
        host,
        generation,
        cursor: SupervisedStdoutCursor::default(),
        stderr: Vec::new(),
    })
}

pub fn reject_process_entry_without_line_cutover(
    handle: &mut ProcessEntryTurn,
) -> SupervisedTurnIoError {
    let _ = handle.interrupt();
    SupervisedTurnIoError {
        code: "process-entry-lines-not-cutover",
        message: "process entry spawned but send_message line source is not cut over".into(),
    }
}

pub fn process_entry_resume_not_cutover() -> SupervisedTurnIoError {
    SupervisedTurnIoError {
        code: "process-entry-resume-not-cutover",
        message: "process entry resume still owns a Core child spawn".into(),
    }
}

pub fn run_supervised_turn_io(
    driver: &mut RestrictedProcessDriver,
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
    stdin: Option<&[u8]>,
) -> Result<Vec<u8>, SupervisedTurnIoError> {
    if let Some(bytes) = stdin {
        driver
            .write_supervised_stdio(plugin_id, entry_id, generation, bytes)
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-write",
                message: "failed to write supervised stdin".into(),
            })?;
    }
    driver
        .close_supervised_stdin(plugin_id, entry_id, generation)
        .map_err(|_| SupervisedTurnIoError {
            code: "stdio-close",
            message: "failed to close supervised stdin".into(),
        })?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    let mut collected = Vec::new();
    loop {
        let (bytes, eof) = driver
            .read_supervised_stdio(plugin_id, entry_id, generation)
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-read",
                message: "failed to read supervised stdout".into(),
            })?;
        collected.extend_from_slice(&bytes);
        if eof || std::time::Instant::now() >= deadline {
            break;
        }
        if bytes.is_empty() {
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
    }
    Ok(collected)
}

#[derive(Debug, Default)]
pub struct SupervisedStdoutCursor {
    pending: Vec<u8>,
    eof: bool,
}

impl SupervisedStdoutCursor {
    pub fn next_line(
        &mut self,
        driver: &mut RestrictedProcessDriver,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<Option<String>, SupervisedTurnIoError> {
        self.next_line_until(
            driver,
            plugin_id,
            entry_id,
            generation,
            std::time::Instant::now() + std::time::Duration::from_secs(2),
        )
    }

    pub fn poll_line(
        &mut self,
        driver: &mut RestrictedProcessDriver,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<LinePoll, SupervisedTurnIoError> {
        if let Some(line) = take_line(&mut self.pending) {
            return Ok(LinePoll::Line(line));
        }
        if self.eof {
            if self.pending.is_empty() {
                return Ok(LinePoll::Eof);
            }
            let rest = String::from_utf8_lossy(&self.pending).into_owned();
            self.pending.clear();
            return Ok(LinePoll::Line(rest));
        }
        let (bytes, eof) = driver
            .read_supervised_stdio(plugin_id, entry_id, generation)
            .map_err(|_| SupervisedTurnIoError {
                code: "stdio-read",
                message: "failed to read supervised stdout".into(),
            })?;
        self.eof |= eof;
        self.pending.extend_from_slice(&bytes);
        if let Some(line) = take_line(&mut self.pending) {
            return Ok(LinePoll::Line(line));
        }
        if self.eof {
            if self.pending.is_empty() {
                return Ok(LinePoll::Eof);
            }
            let rest = String::from_utf8_lossy(&self.pending).into_owned();
            self.pending.clear();
            return Ok(LinePoll::Line(rest));
        }
        Ok(LinePoll::Pending)
    }

    pub fn next_line_until(
        &mut self,
        driver: &mut RestrictedProcessDriver,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
        deadline: std::time::Instant,
    ) -> Result<Option<String>, SupervisedTurnIoError> {
        loop {
            if let Some(line) = take_line(&mut self.pending) {
                return Ok(Some(line));
            }
            if self.eof {
                if self.pending.is_empty() {
                    return Ok(None);
                }
                let rest = String::from_utf8_lossy(&self.pending).into_owned();
                self.pending.clear();
                return Ok(Some(rest));
            }
            if std::time::Instant::now() >= deadline {
                return Err(SupervisedTurnIoError {
                    code: "stdio-timeout",
                    message: "timed out waiting for supervised stdout line".into(),
                });
            }
            let (bytes, eof) = driver
                .read_supervised_stdio(plugin_id, entry_id, generation)
                .map_err(|_| SupervisedTurnIoError {
                    code: "stdio-read",
                    message: "failed to read supervised stdout".into(),
                })?;
            self.eof |= eof;
            if bytes.is_empty() && !self.eof {
                std::thread::sleep(std::time::Duration::from_millis(20));
                continue;
            }
            self.pending.extend_from_slice(&bytes);
        }
    }
}

#[derive(Debug)]
pub struct SupervisedStreamLoop {
    pub lines: Vec<String>,
    pub stderr: Vec<u8>,
}

pub fn run_supervised_stream_loop(
    driver: &mut RestrictedProcessDriver,
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
    first_event_deadline: std::time::Instant,
    mut on_line: impl FnMut(&str),
) -> Result<SupervisedStreamLoop, SupervisedTurnIoError> {
    let mut cursor = SupervisedStdoutCursor::default();
    let mut stderr = Vec::new();
    let mut lines = Vec::new();
    loop {
        drain_supervised_stderr(driver, plugin_id, entry_id, generation, &mut stderr)?;
        let deadline = if lines.is_empty() {
            first_event_deadline
        } else {
            std::time::Instant::now() + std::time::Duration::from_secs(2)
        };
        let line = match cursor.next_line_until(driver, plugin_id, entry_id, generation, deadline) {
            Ok(value) => value,
            Err(error) if lines.is_empty() && error.code == "stdio-timeout" => {
                drain_supervised_stderr(driver, plugin_id, entry_id, generation, &mut stderr)?;
                return Err(SupervisedTurnIoError {
                    code: "first-event-timeout",
                    message: "supervised stream produced no line before deadline".into(),
                });
            }
            Err(error) => return Err(error),
        };
        let Some(line) = line else {
            drain_supervised_stderr(driver, plugin_id, entry_id, generation, &mut stderr)?;
            return Ok(SupervisedStreamLoop { lines, stderr });
        };
        if line.is_empty() {
            continue;
        }
        on_line(&line);
        lines.push(line);
    }
}

fn drain_supervised_stderr(
    driver: &mut RestrictedProcessDriver,
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
    collected: &mut Vec<u8>,
) -> Result<(), SupervisedTurnIoError> {
    let (bytes, _) = driver
        .read_supervised_stderr(plugin_id, entry_id, generation)
        .map_err(|_| SupervisedTurnIoError {
            code: "stdio-read",
            message: "failed to read supervised stderr".into(),
        })?;
    collected.extend_from_slice(&bytes);
    Ok(())
}

fn take_line(pending: &mut Vec<u8>) -> Option<String> {
    let index = pending.iter().position(|byte| *byte == b'\n')?;
    let mut line = pending.drain(..=index).collect::<Vec<_>>();
    line.pop();
    if line.last() == Some(&b'\r') {
        line.pop();
    }
    Some(String::from_utf8_lossy(&line).into_owned())
}

pub fn claude_process_driver_for_bin(
    plugin_root: &Path,
    bin: Option<&str>,
) -> RestrictedProcessDriver {
    let Some(target) = map_claude_bin_to_supervise(bin) else {
        return RestrictedProcessDriver::new(missing_executable());
    };
    let Ok(platform) = current_platform_id() else {
        return RestrictedProcessDriver::new(missing_executable());
    };
    match resolve_process_entry_path(plugin_root, claude_manifest_source(), platform) {
        Ok(path) => restricted_process_driver_for(path.to_str()).with_supervise(target),
        Err(_) => RestrictedProcessDriver::new(missing_executable()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::boot::boot_host;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{Host, HostConfig, SlotState};
    use crate::plugin_runtime::spawn::missing_executable;
    use std::process::Command;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static ARTIFACT_SEQ: AtomicU64 = AtomicU64::new(1);

    fn unique_root(tag: &str) -> PathBuf {
        let seq = ARTIFACT_SEQ.fetch_add(1, Ordering::Relaxed);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!(
            "mossx-claude-entry-{}-{}-{}-{}",
            std::process::id(),
            seq,
            nanos,
            tag
        ))
    }

    fn compile_into_declared_path(root: &Path) -> PathBuf {
        let platform = current_platform_id().expect("platform");
        let relative = resolve_declared_relative(platform);
        let binary = root.join(relative);
        std::fs::create_dir_all(binary.parent().expect("parent")).expect("mkdir");
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../packages/plugin-engine-claude/src/process_entry.rs");
        let status = Command::new("rustc")
            .args(["--edition", "2021", "-O", "-o"])
            .arg(&binary)
            .arg(&source)
            .status()
            .expect("rustc");
        assert!(status.success(), "rustc process entry");
        binary
    }

    fn resolve_declared_relative(platform: &str) -> String {
        let manifest: Value = serde_json::from_str(claude_manifest_source()).expect("manifest");
        manifest
            .pointer(&format!("/entries/0/platforms/{platform}"))
            .and_then(Value::as_str)
            .expect("declared path")
            .to_string()
    }

    fn enabled_host(driver: RestrictedProcessDriver) -> Host<RestrictedProcessDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    #[test]
    fn current_platform_is_one_of_the_six_closed_ids() {
        let platform = current_platform_id().expect("platform");
        assert!(matches!(
            platform,
            "darwin-arm64"
                | "darwin-x64"
                | "windows-x64"
                | "windows-arm64"
                | "linux-x64"
                | "linux-arm64"
        ));
    }

    #[test]
    fn missing_declared_file_fails_closed_and_does_not_change_boot() {
        let root = unique_root("missing");
        std::fs::create_dir_all(&root).expect("mkdir");
        let platform = current_platform_id().expect("platform");
        let error = resolve_process_entry_path(&root, claude_manifest_source(), platform)
            .expect_err("missing file");
        assert_eq!(error.code, "activation-failed");
        let driver = claude_process_driver_for(&root);
        assert_eq!(driver.executable(), &missing_executable());
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(!boot.contains("claude_process_driver_for"));
        let host = boot_host().expect("boot");
        assert_eq!(host.host.driver().process.live_count(), 0);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn parent_dir_and_absolute_declared_paths_are_rejected() {
        let root = unique_root("escape");
        std::fs::create_dir_all(&root).expect("mkdir");
        let escaped = r#"{
            "pluginId": "com.mossx.engine.claude",
            "entries": [{
                "id": "claude-cli",
                "kind": "process",
                "platforms": { "darwin-arm64": "../escape", "darwin-x64": "../escape",
                    "windows-x64": "../escape", "windows-arm64": "../escape",
                    "linux-x64": "../escape", "linux-arm64": "../escape" }
            }]
        }"#;
        let platform = current_platform_id().expect("platform");
        assert_eq!(
            resolve_process_entry_path(&root, escaped, platform)
                .expect_err("escape")
                .code,
            "schema"
        );
        let absolute = format!(
            r#"{{
            "pluginId": "com.mossx.engine.claude",
            "entries": [{{
                "id": "claude-cli",
                "kind": "process",
                "platforms": {{ "{platform}": "/tmp/claude" }}
            }}]
        }}"#
        );
        assert_eq!(
            resolve_process_entry_path(&root, &absolute, platform)
                .expect_err("absolute")
                .code,
            "schema"
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn manifest_resolved_peer_activates_and_interrupts() {
        let root = unique_root("ready");
        let binary = compile_into_declared_path(&root);
        let platform = current_platform_id().expect("platform");
        let resolved =
            resolve_process_entry_path(&root, claude_manifest_source(), platform).expect("resolve");
        assert_eq!(resolved, binary);
        let mut host = enabled_host(claude_process_driver_for(&root));
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        assert_eq!(
            host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().live_count(), 1);
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        assert_eq!(host.driver().live_count(), 0);
        assert_eq!(host.slot(CLAUDE_PLUGIN_ID).unwrap().state, SlotState::Idle);
        let next = host
            .activate(claude_activation_request())
            .expect("reactivate");
        assert_eq!(next, generation + 1);
        assert_eq!(host.driver().live_count(), 1);
        host.uninstall(CLAUDE_PLUGIN_ID).expect("uninstall");
        assert_eq!(host.driver().live_count(), 0);
        assert_eq!(
            host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
            SlotState::Uninstalled
        );
        assert_eq!(
            host.activate(claude_activation_request()).unwrap_err().code,
            "uninstalled"
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn mapped_sleep_bin_supervises_without_touching_production_spawn() {
        let root = unique_root("map-bin");
        let _ = compile_into_declared_path(&root);
        let bin = idle_cli().executable;
        let mapped = map_claude_bin_to_supervise(bin.to_str()).expect("map");
        assert_eq!(mapped.executable, bin);
        assert!(mapped.argv.is_empty());
        let mut host = enabled_host(claude_process_driver_for_bin(&root, bin.to_str()));
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        assert_eq!(host.slot(CLAUDE_PLUGIN_ID).unwrap().state, SlotState::Ready);
        assert_eq!(host.driver().live_count(), 1);
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        assert_eq!(host.driver().live_count(), 0);
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("fn resolve_cli_binary"));
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("claude_process_driver_for_bin"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("claude_process_driver_for_bin"));
        assert!(boot.contains("missing_executable()"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn empty_relative_and_shell_claude_bin_map_to_nothing() {
        let root = unique_root("map-deny");
        std::fs::create_dir_all(&root).expect("mkdir");
        assert!(map_claude_bin_to_supervise(None).is_none());
        assert!(map_claude_bin_to_supervise(Some("")).is_none());
        assert!(map_claude_bin_to_supervise(Some("   ")).is_none());
        assert!(map_claude_bin_to_supervise(Some("claude")).is_none());
        assert!(map_claude_bin_to_supervise(Some("/bin/bash")).is_none());
        assert_eq!(
            claude_process_driver_for_bin(&root, Some("/bin/sleep")).executable(),
            &missing_executable()
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn process_entry_source_is_not_production_claude() {
        let source = include_str!("../../../packages/plugin-engine-claude/src/process_entry.rs");
        assert!(source.contains("com.mossx.engine.claude"));
        assert!(source.contains("mossx.process.supervise"));
        assert!(!source.contains("engine::claude"));
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("Failed to spawn claude"));
        assert!(!production.contains("claude_process_driver_for"));
        assert!(!production.contains("mossx.process.supervise"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("with_supervise"));
        assert!(!boot.contains("MOSSX_CLAUDE_PROCESS_ENTRY"));
        assert!(claude_process_entry_enabled_from(None));
        assert!(!claude_process_entry_enabled_from(Some(std::ffi::OsStr::new("0"))));
        assert_eq!(
            decide_claude_spawn_owner(false, None),
            ClaudeSpawnOwner::CoreCommand
        );
    }

    #[test]
    fn production_shaped_command_maps_argv_and_cwd() {
        let root = unique_root("spawn-plan");
        std::fs::create_dir_all(&root).expect("mkdir");
        let bin = idle_cli().executable;
        let plan = spawn_plan_from_command(
            &bin,
            &["-p", "--output-format", "stream-json"],
            Some(root.as_path()),
        )
        .expect("plan");
        assert_eq!(plan.executable, bin);
        assert_eq!(
            plan.argv,
            vec!["-p", "--output-format", "stream-json"]
        );
        assert_eq!(plan.cwd.as_deref(), Some(root.as_path()));
        assert!(spawn_plan_from_command("claude", &["-p"], Some(root.as_path())).is_none());
        assert!(spawn_plan_from_command("/bin/bash", &["-c", "sleep 1"], Some(root.as_path())).is_none());
        assert!(spawn_plan_from_command(&bin, &["-p"], Some(Path::new("relative"))).is_none());
        assert_eq!(
            decide_claude_spawn_owner(false, Some(&plan)),
            ClaudeSpawnOwner::CoreCommand
        );
        assert_eq!(
            decide_claude_spawn_owner(true, Some(&plan)),
            ClaudeSpawnOwner::ProcessEntry
        );
        assert_eq!(
            decide_claude_spawn_owner(true, None),
            ClaudeSpawnOwner::Denied
        );
        assert_eq!(
            claude_spawn_owner_error(ClaudeSpawnOwner::ProcessEntry),
            None
        );
        let mut host = enabled_host(restricted_process_driver_for(
            compile_into_declared_path(&root).to_str(),
        )
        .with_supervise(plan));
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("decide_claude_spawn_owner"));
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("claude_process_driver_for_bin"));
        let gate = production
            .find("claude_commands_allowed")
            .expect("uninstall gate");
        let decide = production
            .find("decide_claude_spawn_owner")
            .expect("spawn owner");
        assert!(gate < decide, "uninstall gate must precede decide");
        let _ = std::fs::remove_dir_all(root);
    }

    fn idle_cli() -> SuperviseTarget {
        #[cfg(windows)]
        {
            SuperviseTarget {
                executable: PathBuf::from(r"C:\Windows\System32\timeout.exe"),
                argv: vec!["/T".into(), "30".into(), "/NOBREAK".into()],
                cwd: None,
            }
        }
        #[cfg(not(windows))]
        {
            SuperviseTarget {
                executable: PathBuf::from("/bin/sleep"),
                argv: vec!["30".into()],
                cwd: None,
            }
        }
    }

    fn process_alive(pid: u32) -> bool {
        #[cfg(unix)]
        {
            unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
        }
        #[cfg(not(unix))]
        {
            let _ = pid;
            false
        }
    }

    #[test]
    fn supervise_keeps_cli_in_the_same_group_until_interrupt() {
        let root = unique_root("supervise");
        let _ = compile_into_declared_path(&root);
        let driver = restricted_process_driver_for(
            resolve_process_entry_path(
                &root,
                claude_manifest_source(),
                current_platform_id().expect("platform"),
            )
            .expect("resolve")
            .to_str(),
        )
        .with_supervise(idle_cli());
        let mut host = enabled_host(driver);
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        assert_eq!(host.slot(CLAUDE_PLUGIN_ID).unwrap().state, SlotState::Ready);
        assert_eq!(host.driver().live_count(), 1);
        let leader = host.driver().child_pid(CLAUDE_PLUGIN_ID, "claude-cli", generation);
        assert!(leader.is_some());
        std::thread::sleep(std::time::Duration::from_millis(80));
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        assert_eq!(host.driver().live_count(), 0);
        if let Some(pid) = leader {
            assert!(!process_alive(pid), "leader {pid} leaked");
        }
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn supervise_rejects_a_shell_executable() {
        let root = unique_root("shell");
        let _ = compile_into_declared_path(&root);
        let path = resolve_process_entry_path(
            &root,
            claude_manifest_source(),
            current_platform_id().expect("platform"),
        )
        .expect("resolve");
        let driver = restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
            executable: PathBuf::from("/bin/bash"),
            argv: vec!["-c".into(), "sleep 30".into()],
            cwd: None,
        });
        let mut host = enabled_host(driver);
        assert!(host.activate(claude_activation_request()).is_err());
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_dir_all(root);
    }

    fn wait_read(
        host: &mut Host<RestrictedProcessDriver>,
        generation: u64,
    ) -> (Vec<u8>, bool) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        loop {
            let (bytes, eof) = host
                .test_driver_mut()
                .read_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation)
                .expect("read");
            if !bytes.is_empty() || eof || std::time::Instant::now() >= deadline {
                return (bytes, eof);
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
    }

    #[test]
    fn supervised_echo_stdout_is_readable_over_mxpc() {
        let root = unique_root("stdio-echo");
        let path = compile_into_declared_path(&root);
        let echo = if cfg!(windows) {
            PathBuf::from(r"C:\Windows\System32\cmd.exe")
        } else {
            PathBuf::from("/bin/echo")
        };
        if echo.file_stem().and_then(|name| name.to_str()) == Some("cmd") {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: echo,
                argv: vec!["mossx-stdio".into()],
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        let (bytes, _) = wait_read(&mut host, generation);
        assert!(
            String::from_utf8_lossy(&bytes).contains("mossx-stdio"),
            "got {:?}",
            String::from_utf8_lossy(&bytes)
        );
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("write_supervised_stdio"));
        assert!(!production.contains("mossx.process.stdio"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("write_supervised_stdio"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn supervised_cat_round_trips_stdin_to_stdout() {
        let root = unique_root("stdio-cat");
        let path = compile_into_declared_path(&root);
        let cat = PathBuf::from("/bin/cat");
        if !cat.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: cat,
                argv: Vec::new(),
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        host.test_driver_mut()
            .write_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation, b"hello-stdio")
            .expect("write");
        host.test_driver_mut()
            .close_supervised_stdin(CLAUDE_PLUGIN_ID, "claude-cli", generation)
            .expect("close");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        let mut collected = Vec::new();
        while std::time::Instant::now() < deadline {
            let (bytes, eof) = host
                .test_driver_mut()
                .read_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation)
                .expect("read");
            collected.extend_from_slice(&bytes);
            if collected == b"hello-stdio" || eof {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        assert_eq!(collected, b"hello-stdio");
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn product_shaped_turn_io_reads_echo_without_stdin() {
        let root = unique_root("turn-echo");
        let path = compile_into_declared_path(&root);
        let echo = PathBuf::from("/bin/echo");
        if !echo.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: echo,
                argv: vec!["mossx-turn".into()],
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        let bytes = run_supervised_turn_io(
            host.test_driver_mut(),
            CLAUDE_PLUGIN_ID,
            "claude-cli",
            generation,
            None,
        )
        .expect("turn io");
        assert!(
            String::from_utf8_lossy(&bytes).contains("mossx-turn"),
            "got {:?}",
            String::from_utf8_lossy(&bytes)
        );
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("run_supervised_turn_io"));
        assert_eq!(
            decide_claude_spawn_owner(true, Some(&idle_cli())),
            ClaudeSpawnOwner::ProcessEntry
        );
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("run_supervised_turn_io"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn product_shaped_turn_io_round_trips_cat_stdin() {
        let root = unique_root("turn-cat");
        let path = compile_into_declared_path(&root);
        let cat = PathBuf::from("/bin/cat");
        if !cat.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: cat,
                argv: Vec::new(),
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        let bytes = run_supervised_turn_io(
            host.test_driver_mut(),
            CLAUDE_PLUGIN_ID,
            "claude-cli",
            generation,
            Some(b"hello-turn"),
        )
        .expect("turn io");
        assert_eq!(bytes, b"hello-turn");
        assert_eq!(
            run_supervised_turn_io(
                host.test_driver_mut(),
                CLAUDE_PLUGIN_ID,
                "missing-entry",
                generation,
                Some(b"x"),
            )
            .unwrap_err()
            .code,
            "stdio-write"
        );
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn incremental_stdout_yields_first_line_before_eof() {
        let root = unique_root("stream-line");
        let path = compile_into_declared_path(&root);
        let cat = PathBuf::from("/bin/cat");
        if !cat.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: cat,
                argv: Vec::new(),
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        host.test_driver_mut()
            .write_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation, b"line1\n")
            .expect("write first");
        let mut cursor = SupervisedStdoutCursor::default();
        let first = cursor
            .next_line(
                host.test_driver_mut(),
                CLAUDE_PLUGIN_ID,
                "claude-cli",
                generation,
            )
            .expect("first line")
            .expect("line");
        assert_eq!(first, "line1");
        host.test_driver_mut()
            .write_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation, b"line2\n")
            .expect("write second");
        host.test_driver_mut()
            .close_supervised_stdin(CLAUDE_PLUGIN_ID, "claude-cli", generation)
            .expect("close");
        let second = cursor
            .next_line(
                host.test_driver_mut(),
                CLAUDE_PLUGIN_ID,
                "claude-cli",
                generation,
            )
            .expect("second line")
            .expect("line");
        assert_eq!(second, "line2");
        assert!(cursor
            .next_line(
                host.test_driver_mut(),
                CLAUDE_PLUGIN_ID,
                "claude-cli",
                generation,
            )
            .expect("eof")
            .is_none());
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("SupervisedStdoutCursor"));
        assert!(!production.contains("read_supervised_stderr"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn supervised_stderr_is_readable_over_mxpc() {
        let root = unique_root("stream-stderr");
        let path = compile_into_declared_path(&root);
        let ls = PathBuf::from("/bin/ls");
        if !ls.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let missing = root.join("definitely-missing-claude-entry");
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: ls,
                argv: vec![missing.to_string_lossy().into_owned()],
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        let mut collected = Vec::new();
        while std::time::Instant::now() < deadline {
            let (bytes, eof) = host
                .test_driver_mut()
                .read_supervised_stderr(CLAUDE_PLUGIN_ID, "claude-cli", generation)
                .expect("stderr");
            collected.extend_from_slice(&bytes);
            if !collected.is_empty() || eof {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        assert!(
            !collected.is_empty(),
            "expected stderr from missing path, got empty"
        );
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn stream_loop_reads_cat_lines_and_times_out_on_silence() {
        let root = unique_root("stream-loop");
        let path = compile_into_declared_path(&root);
        let cat = PathBuf::from("/bin/cat");
        if !cat.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut host = enabled_host(
            restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                executable: cat,
                argv: Vec::new(),
                cwd: None,
            }),
        );
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        host.test_driver_mut()
            .write_supervised_stdio(CLAUDE_PLUGIN_ID, "claude-cli", generation, b"a\nb\n")
            .expect("write");
        host.test_driver_mut()
            .close_supervised_stdin(CLAUDE_PLUGIN_ID, "claude-cli", generation)
            .expect("close");
        let mut seen = Vec::new();
        let result = run_supervised_stream_loop(
            host.test_driver_mut(),
            CLAUDE_PLUGIN_ID,
            "claude-cli",
            generation,
            std::time::Instant::now() + std::time::Duration::from_secs(2),
            |line| seen.push(line.to_string()),
        )
        .expect("loop");
        assert_eq!(seen, vec!["a", "b"]);
        assert_eq!(result.lines, vec!["a", "b"]);
        host.interrupt(CLAUDE_PLUGIN_ID, generation)
            .expect("interrupt");

        let sleep = PathBuf::from("/bin/sleep");
        if sleep.is_file() {
            let mut silent = enabled_host(
                restricted_process_driver_for(path.to_str()).with_supervise(SuperviseTarget {
                    executable: sleep,
                    argv: vec!["2".into()],
                    cwd: None,
                }),
            );
            let silent_gen = silent
                .activate(claude_activation_request())
                .expect("activate silent");
            let error = run_supervised_stream_loop(
                silent.test_driver_mut(),
                CLAUDE_PLUGIN_ID,
                "claude-cli",
                silent_gen,
                std::time::Instant::now() + std::time::Duration::from_millis(80),
                |_| {},
            )
            .expect_err("timeout");
            assert_eq!(error.code, "first-event-timeout");
            silent
                .interrupt(CLAUDE_PLUGIN_ID, silent_gen)
                .expect("interrupt silent");
        }
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("run_supervised_stream_loop"));
        assert!(!production.contains("next_line_until"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("run_supervised_stream_loop"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn send_message_keeps_tokio_as_the_only_live_line_source() {
        assert_eq!(
            decide_claude_line_source(false),
            ClaudeLineSource::Tokio
        );
        assert_eq!(
            decide_claude_line_source(true),
            ClaudeLineSource::ProcessEntry
        );
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("decide_claude_line_source"));
        assert!(production.contains("next_claude_line"));
        assert!(production.contains("cmd.spawn()"));
        assert!(production.contains("lines.next_line()"));
        assert!(!production.contains("run_supervised_stream_loop"));
        assert!(!production.contains("next_line_until"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("decide_claude_line_source"));
        assert!(claude_process_entry_enabled_from(None));
    }

    #[test]
    fn process_entry_turn_spawns_and_kills_when_lines_are_not_cutover() {
        let root = unique_root("turn-handle");
        let _ = compile_into_declared_path(&root);
        let sleep = PathBuf::from("/bin/sleep");
        if !sleep.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let plan = spawn_plan_from_command(&sleep, &["30"], None).expect("plan");
        assert_eq!(
            decide_claude_spawn_owner(true, Some(&plan)),
            ClaudeSpawnOwner::ProcessEntry
        );
        let mut handle = spawn_process_entry_turn(&root, plan).expect("spawn");
        assert_eq!(handle.live_count(), 1);
        let pid = handle.child_pid();
        assert!(pid.is_some());
        handle.interrupt().expect("interrupt leftover");
        assert_eq!(handle.live_count(), 0);
        if let Some(pid) = pid {
            assert!(!process_alive(pid), "leader {pid} leaked");
        }
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("spawn_process_entry_turn"));
        assert!(production.contains("poll_stdout_line"));
        assert!(production.contains("cmd.spawn()"));
        assert!(production.contains("lines.next_line()"));
        assert!(!production.contains("run_supervised_stream_loop"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("spawn_process_entry_turn"));
        assert!(boot.contains("missing_executable()"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn process_entry_turn_polls_cat_lines_without_killing() {
        let root = unique_root("line-cutover");
        let _ = compile_into_declared_path(&root);
        let cat = PathBuf::from("/bin/cat");
        if !cat.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let plan = spawn_plan_from_command(&cat, &[] as &[&str], None).expect("plan");
        let mut handle = spawn_process_entry_turn(&root, plan).expect("spawn");
        handle.write_stdin(b"a\nb\n").expect("write");
        handle.close_stdin().expect("close");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
        let mut seen = Vec::new();
        while seen.len() < 2 && std::time::Instant::now() < deadline {
            match handle.poll_stdout_line().expect("poll") {
                LinePoll::Line(line) if !line.is_empty() => seen.push(line),
                LinePoll::Eof => break,
                LinePoll::Pending | LinePoll::Line(_) => {
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            }
        }
        assert_eq!(seen, vec!["a", "b"]);
        handle.interrupt().expect("interrupt");
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("next_claude_line"));
        assert!(production.contains("poll_stdout_line"));
        assert!(!production.contains("reject_process_entry_without_line_cutover"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resume_sites_refuse_a_second_core_child_when_process_entry_is_on() {
        assert_eq!(
            process_entry_resume_not_cutover().code,
            "process-entry-resume-not-cutover"
        );
        let resume = include_str!("../engine/claude/user_input.rs");
        assert_eq!(resume.matches("cmd.spawn()").count(), 2);
        assert_eq!(resume.matches("try_resume_process_entry_turn").count(), 2);
        assert!(!resume.contains("refuse_process_entry_resume"));
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("try_resume_process_entry_turn"));
        assert!(production.contains("cmd.spawn()"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("try_resume_process_entry_turn"));
        assert!(boot.contains("missing_executable()"));
    }

    #[test]
    fn resume_process_entry_replaces_the_live_generation() {
        let root = unique_root("resume-spawn");
        let _ = compile_into_declared_path(&root);
        let sleep = PathBuf::from("/bin/sleep");
        if !sleep.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let first = spawn_plan_from_command(&sleep, &["30"], None).expect("first");
        let mut handle = spawn_process_entry_turn(&root, first).expect("spawn");
        let first_pid = handle.child_pid();
        handle.interrupt().expect("interrupt first");
        assert_eq!(handle.live_count(), 0);
        let second = spawn_plan_from_command(&sleep, &["30"], None).expect("second");
        let mut resumed = spawn_process_entry_turn(&root, second).expect("resume");
        assert_eq!(resumed.live_count(), 1);
        let second_pid = resumed.child_pid();
        assert!(second_pid.is_some());
        if let (Some(first), Some(second)) = (first_pid, second_pid) {
            assert_ne!(first, second);
            assert!(!process_alive(first), "old leader {first} leaked");
        }
        resumed.interrupt().expect("interrupt second");
        let resume = include_str!("../engine/claude/user_input.rs");
        assert!(resume.contains("try_resume_process_entry_turn"));
        assert_eq!(resume.matches("cmd.spawn()").count(), 2);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn process_entry_wait_reports_true_and_false_exit_codes() {
        let root = unique_root("wait-status");
        let _ = compile_into_declared_path(&root);
        let tru = PathBuf::from("/bin/true");
        let fal = PathBuf::from("/bin/false");
        if !tru.is_file() || !fal.is_file() {
            let _ = std::fs::remove_dir_all(root);
            return;
        }
        let mut ok = spawn_process_entry_turn(
            &root,
            spawn_plan_from_command(&tru, &[] as &[&str], None).expect("true"),
        )
        .expect("spawn true");
        let _ = ok.close_stdin();
        let code = ok
            .wait_until(std::time::Instant::now() + std::time::Duration::from_secs(2))
            .expect("wait true");
        assert_eq!(code, Some(0));
        ok.interrupt().ok();

        let mut bad = spawn_process_entry_turn(
            &root,
            spawn_plan_from_command(&fal, &[] as &[&str], None).expect("false"),
        )
        .expect("spawn false");
        let _ = bad.close_stdin();
        let code = bad
            .wait_until(std::time::Instant::now() + std::time::Duration::from_secs(2))
            .expect("wait false");
        assert_eq!(code, Some(1));
        bad.interrupt().ok();

        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("wait_until"));
        assert!(production.contains("child_proc.wait()"));
        let boot = include_str!("boot.rs");
        assert!(!boot.contains("wait_supervised"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn product_root_is_the_built_artifact_not_the_source_tree() {
        let platform = current_platform_id().expect("platform");
        let artifact_root = claude_plugin_package_root();
        let resolved = resolve_process_entry_path(
            &artifact_root,
            claude_manifest_source(),
            platform,
        )
        .expect("built process entry must exist");
        assert!(resolved.is_file(), "{}", resolved.display());
        assert!(resolved.starts_with(&artifact_root));

        let source_root = claude_plugin_source_root()
            .canonicalize()
            .unwrap_or_else(|_| claude_plugin_source_root());
        let source_error = resolve_process_entry_path(
            &source_root,
            claude_manifest_source(),
            platform,
        )
        .expect_err("source tree must stay source-only");
        assert_eq!(source_error.code, "activation-failed");
        assert!(!source_root.join(resolve_declared_relative(platform)).is_file());

        let tru = PathBuf::from("/bin/true");
        if tru.is_file() {
            let mut handle = spawn_process_entry_turn(
                &artifact_root,
                spawn_plan_from_command(&tru, &[] as &[&str], None).expect("true"),
            )
            .expect("spawn from artifact");
            let _ = handle.close_stdin();
            let code = handle
                .wait_until(std::time::Instant::now() + std::time::Duration::from_secs(2))
                .expect("wait");
            assert_eq!(code, Some(0));
            handle.interrupt().ok();
        }

        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("claude_plugin_package_root()"));
        assert!(production.contains("cmd.spawn()"));
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(!boot.contains("claude_plugin_package_root"));
        assert!(claude_process_entry_enabled_from(None));
    }

    #[test]
    fn artifact_root_honors_first_event_and_interrupt() {
        let artifact_root = claude_plugin_package_root();
        let echo = PathBuf::from("/bin/echo");
        if echo.is_file() {
            let mut handle = spawn_process_entry_turn(
                &artifact_root,
                spawn_plan_from_command(&echo, &["first-event"], None).expect("echo"),
            )
            .expect("spawn echo");
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
            let mut line = None;
            while std::time::Instant::now() < deadline {
                match handle.poll_stdout_line().expect("poll echo") {
                    LinePoll::Line(value) if !value.is_empty() => {
                        line = Some(value);
                        break;
                    }
                    LinePoll::Eof => break,
                    LinePoll::Pending | LinePoll::Line(_) => {
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                }
            }
            assert_eq!(line.as_deref(), Some("first-event"));
            handle.interrupt().ok();
        }

        let sleep = PathBuf::from("/bin/sleep");
        if sleep.is_file() {
            let mut handle = spawn_process_entry_turn(
                &artifact_root,
                spawn_plan_from_command(&sleep, &["30"], None).expect("sleep"),
            )
            .expect("spawn sleep");
            let pid = handle.child_pid();
            let deadline = std::time::Instant::now() + std::time::Duration::from_millis(80);
            while std::time::Instant::now() < deadline {
                match handle.poll_stdout_line().expect("poll sleep") {
                    LinePoll::Line(value) if !value.is_empty() => {
                        panic!("silent sleep produced a line: {value}");
                    }
                    LinePoll::Eof => break,
                    LinePoll::Pending | LinePoll::Line(_) => {
                        std::thread::sleep(std::time::Duration::from_millis(20));
                    }
                }
            }
            handle.interrupt().expect("interrupt silent");
            assert_eq!(handle.live_count(), 0);
            if let Some(pid) = pid {
                assert!(!process_alive(pid), "silent leader {pid} leaked");
            }
        }

        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("fail_stream_no_event_timeout"));
        assert!(production.contains("first_event_deadline"));
        assert!(production.contains("poll_stdout_line"));
        assert!(production.contains("handle.interrupt()"));
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("run_supervised_stream_loop"));
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(!boot.contains("spawn_process_entry_turn"));
        assert!(claude_process_entry_enabled_from(None));
    }

    #[test]
    fn artifact_root_reads_a_real_claude_first_event_when_cli_exists() {
        let Some(bin) = crate::backend::app_server::find_claude_code_binary(None) else {
            return;
        };
        let Some(plan) = spawn_plan_from_command(
            &bin,
            &[
                "-p",
                "reply with the single word ok",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
            ],
            None,
        ) else {
            return;
        };
        let mut handle = spawn_process_entry_turn(&claude_plugin_package_root(), plan)
            .expect("spawn real claude");
        let pid = handle.child_pid();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
        let mut event = None;
        while std::time::Instant::now() < deadline {
            match handle.poll_stdout_line().expect("poll claude") {
                LinePoll::Line(line) => {
                    if let Ok(value) = serde_json::from_str::<Value>(&line) {
                        if is_product_valid_claude_stream_event(&value) {
                            event = Some(value);
                            break;
                        }
                    }
                }
                LinePoll::Eof => break,
                LinePoll::Pending => {
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            }
        }
        handle.interrupt().expect("interrupt real claude");
        assert_eq!(handle.live_count(), 0);
        if let Some(pid) = pid {
            assert!(!process_alive(pid), "real claude leader {pid} leaked");
        }
        let event = event.expect("real Claude CLI must emit a product-valid first event");
        assert_eq!(event.get("type").and_then(Value::as_str), Some("system"));
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("is_product_valid_claude_stream_event"));
        assert!(production.contains("cmd.spawn()"));
        assert!(!production.contains("run_supervised_stream_loop"));
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(claude_process_entry_enabled_from(None));
    }

    #[test]
    fn artifact_root_reaps_a_real_claude_result_when_cli_exists() {
        let Some(bin) = crate::backend::app_server::find_claude_code_binary(None) else {
            return;
        };
        let Some(plan) = spawn_plan_from_command(
            &bin,
            &[
                "-p",
                "reply with the single word ok",
                "--tools",
                "",
                "--output-format",
                "stream-json",
                "--verbose",
                "--include-partial-messages",
            ],
            None,
        ) else {
            return;
        };
        let mut handle = spawn_process_entry_turn(&claude_plugin_package_root(), plan)
            .expect("spawn real claude result");
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
        let mut result = None;
        while std::time::Instant::now() < deadline {
            match handle.poll_stdout_line().expect("poll claude result") {
                LinePoll::Line(line) => {
                    if let Ok(value) = serde_json::from_str::<Value>(&line) {
                        if value.get("type").and_then(Value::as_str) == Some("result") {
                            result = Some(value);
                            break;
                        }
                    }
                }
                LinePoll::Eof => break,
                LinePoll::Pending => {
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            }
        }
        assert!(
            result.is_some(),
            "real Claude CLI must emit a result event through Process Entry"
        );
        let code = handle
            .wait_until(std::time::Instant::now() + std::time::Duration::from_secs(10))
            .expect("wait result");
        assert_eq!(code, Some(0));
        handle.interrupt().ok();
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("wait_until"));
        assert!(production.contains("cmd.spawn()"));
        assert!(production.contains("child_proc.wait()"));
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(claude_process_entry_enabled_from(None));
    }

    #[test]
    fn dual_run_defaults_to_process_entry_and_explicit_off_keeps_core() {
        assert!(claude_process_entry_enabled_from(None));
        assert!(!claude_process_entry_enabled_from(Some(std::ffi::OsStr::new("0"))));
        assert!(!crate::plugin_runtime::claude_compat::claude_compat_facade_enabled_from(None));
        assert!(crate::plugin_runtime::notes_compat::notes_compat_facade_enabled_from(None));
        let sleep = PathBuf::from("/bin/sleep");
        let plan = sleep
            .is_file()
            .then(|| spawn_plan_from_command(&sleep, &["1"], None))
            .flatten();
        assert_eq!(
            decide_claude_spawn_owner(false, plan.as_ref()),
            ClaudeSpawnOwner::CoreCommand
        );
        assert_eq!(
            decide_claude_line_source(false),
            ClaudeLineSource::Tokio
        );
        if let Some(plan) = plan.as_ref() {
            assert_eq!(
                decide_claude_spawn_owner(true, Some(plan)),
                ClaudeSpawnOwner::ProcessEntry
            );
        }
        assert_eq!(
            decide_claude_spawn_owner(true, None),
            ClaudeSpawnOwner::Denied
        );
        assert_eq!(
            decide_claude_line_source(true),
            ClaudeLineSource::ProcessEntry
        );
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
        assert!(production.contains("decide_claude_spawn_owner"));
        assert!(production.contains("spawn_process_entry_turn"));
        assert_eq!(
            production.matches("cmd.spawn()").count()
                + include_str!("../engine/claude/user_input.rs")
                    .matches("cmd.spawn()")
                    .count(),
            3
        );
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        assert!(!boot.contains("claude_process_entry_enabled"));
        assert!(!boot.contains("spawn_process_entry_turn"));
    }
}
