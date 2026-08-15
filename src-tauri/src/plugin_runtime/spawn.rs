//! Restricted Process supervisor. Host-owned children only; not in boot.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

use serde_json::{json, Value};

use super::host::{DriverError, EntryDriver};
use super::ipc::validate_handshake_ack;
use super::uds::{read_mxpc_frame, write_mxpc_frame};

const HANDSHAKE_NONCE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct ChildKey {
    plugin_id: String,
    entry_id: String,
    generation: u64,
}

pub struct RestrictedProcessDriver {
    executable: PathBuf,
    children: HashMap<ChildKey, Child>,
    catalog: HashSet<(String, String)>,
    fail_on: Option<String>,
    corrupt_ack_on: Option<String>,
    handshake: bool,
}

impl RestrictedProcessDriver {
    pub fn new(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            children: HashMap::new(),
            catalog: declared_process_entries(),
            fail_on: None,
            corrupt_ack_on: None,
            handshake: false,
        }
    }

    pub fn with_handshake(executable: impl Into<PathBuf>) -> Self {
        let mut driver = Self::new(executable);
        driver.handshake = true;
        driver
    }

    pub fn live_count(&self) -> usize {
        self.children.len()
    }

    #[cfg(test)]
    pub fn fail_on(&mut self, entry_id: impl Into<String>) {
        self.fail_on = Some(entry_id.into());
    }

    #[cfg(test)]
    pub fn corrupt_ack_on(&mut self, entry_id: impl Into<String>) {
        self.corrupt_ack_on = Some(entry_id.into());
    }

    #[cfg(test)]
    pub fn declare(&mut self, plugin_id: &str, entry_id: &str) {
        self.catalog
            .insert((plugin_id.to_string(), entry_id.to_string()));
    }

    fn spawn_child(
        &self,
        plugin_id: &str,
        generation: u64,
        corrupt: bool,
    ) -> Result<Child, DriverError> {
        if !self.executable.is_file() {
            return Err(DriverError::Crash);
        }
        let mut command = Command::new(&self.executable);
        if self.handshake {
            command
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .env("MOSSX_HANDSHAKE_NONCE", HANDSHAKE_NONCE)
                .env("MOSSX_PLUGIN_ID", plugin_id)
                .env("MOSSX_GENERATION", generation.to_string());
            if corrupt {
                command.env("MOSSX_CORRUPT_ACK", "1");
            }
        } else {
            command
                .args(spawn_args(&self.executable))
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
        }
        command.spawn().map_err(|_| DriverError::Crash)
    }
}

fn hello(generation: u64) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "method": "mossx.handshake.hello",
        "params": {
            "protocolVersion": 1,
            "coreContract": "1.0.0",
            "nonce": HANDSHAKE_NONCE,
            "generation": generation
        }
    })
}

fn handshake_child(child: &mut Child, generation: u64) -> Result<(), DriverError> {
    let stdin = child.stdin.as_mut().ok_or(DriverError::Crash)?;
    write_mxpc_frame(stdin, &hello(generation)).map_err(|_| DriverError::Crash)?;
    let stdout = child.stdout.as_mut().ok_or(DriverError::Crash)?;
    let received = read_mxpc_frame(stdout).map_err(|_| DriverError::Crash)?;
    validate_handshake_ack(&received, HANDSHAKE_NONCE).map_err(|_| DriverError::Crash)?;
    Ok(())
}

fn kill_child(child: &mut Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn collect_process_entries(source: &str, catalog: &mut HashSet<(String, String)>) {
    let Ok(manifest) = serde_json::from_str::<Value>(source) else {
        return;
    };
    let Some(plugin_id) = manifest.get("pluginId").and_then(Value::as_str) else {
        return;
    };
    let Some(entries) = manifest.get("entries").and_then(Value::as_array) else {
        return;
    };
    for entry in entries {
        let Some(entry_id) = entry.get("id").and_then(Value::as_str) else {
            continue;
        };
        if entry.get("kind").and_then(Value::as_str) == Some("process") {
            catalog.insert((plugin_id.to_string(), entry_id.to_string()));
        }
    }
}

fn declared_process_entries() -> HashSet<(String, String)> {
    let mut catalog = HashSet::new();
    collect_process_entries(
        include_str!("../../../packages/plugin-contract/fixtures/valid/notes-pilot.json"),
        &mut catalog,
    );
    collect_process_entries(
        include_str!("../../../packages/plugin-contract/fixtures/valid/claude-engine.json"),
        &mut catalog,
    );
    catalog
}

impl EntryDriver for RestrictedProcessDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        if !self
            .catalog
            .contains(&(plugin_id.to_string(), entry_id.to_string()))
        {
            return Ok(());
        }
        let key = ChildKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if self.children.contains_key(&key) {
            return Err(DriverError::Crash);
        }
        if self.fail_on.as_deref() == Some(entry_id) {
            return Err(DriverError::Crash);
        }
        let corrupt = self.corrupt_ack_on.as_deref() == Some(entry_id);
        let mut child = self.spawn_child(plugin_id, generation, corrupt)?;
        if self.handshake {
            if let Err(error) = handshake_child(&mut child, generation) {
                kill_child(&mut child);
                return Err(error);
            }
        }
        self.children.insert(key, child);
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        let key = ChildKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if let Some(mut child) = self.children.remove(&key) {
            kill_child(&mut child);
        }
    }
}

impl Drop for RestrictedProcessDriver {
    fn drop(&mut self) {
        let keys: Vec<ChildKey> = self.children.keys().cloned().collect();
        for key in keys {
            if let Some(mut child) = self.children.remove(&key) {
                kill_child(&mut child);
            }
        }
    }
}

pub fn missing_executable() -> PathBuf {
    PathBuf::from("/nonexistent-mossx-restricted-process")
}

pub fn idle_fixture_executable() -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(r"C:\Windows\System32\timeout.exe")
    }
    #[cfg(not(windows))]
    {
        PathBuf::from("/bin/sleep")
    }
}

fn spawn_args(executable: &Path) -> Vec<&'static str> {
    if executable.file_name().and_then(|name| name.to_str()) == Some("timeout.exe") {
        vec!["/T", "30", "/NOBREAK"]
    } else {
        vec!["30"]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{ActivationRequest, Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

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

    fn two_process_request() -> ActivationRequest {
        ActivationRequest {
            plugin_id: "com.mossx.engine.claude".into(),
            unit_id: "claude-engine".into(),
            required_entries: vec!["claude-cli".into(), "claude-helper".into()],
        }
    }

    #[test]
    fn notes_activation_leaves_no_process_child() {
        let executable = idle_fixture_executable();
        assert!(executable.is_file());
        let mut host = enabled_host(RestrictedProcessDriver::new(executable));
        host.activate(notes_activation_request()).expect("activate");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn claude_activation_owns_only_the_process_entry() {
        let mut host = enabled_host(RestrictedProcessDriver::new(idle_fixture_executable()));
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn unknown_executable_cannot_leave_a_child() {
        let mut host = enabled_host(RestrictedProcessDriver::new(missing_executable()));
        assert!(host.activate(claude_activation_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn later_entry_crash_kills_the_earlier_child() {
        let mut driver = RestrictedProcessDriver::new(idle_fixture_executable());
        driver.declare("com.mossx.engine.claude", "claude-helper");
        driver.fail_on("claude-helper");
        let mut host = enabled_host(driver);
        assert!(host.activate(two_process_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
    }

    fn compile_peer(tag: &str) -> PathBuf {
        let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../packages/plugin-contract/fixtures/ipc/restricted-process-peer.rs");
        let out_dir = std::env::temp_dir().join(format!(
            "mossx-1f2-{}-{}",
            std::process::id(),
            tag
        ));
        let _ = std::fs::create_dir_all(&out_dir);
        let binary = out_dir.join("restricted-process-peer");
        let status = Command::new("rustc")
            .args(["--edition", "2021", "-O", "-o"])
            .arg(&binary)
            .arg(&source)
            .status()
            .expect("rustc");
        assert!(status.success(), "rustc peer fixture");
        binary
    }

    #[test]
    fn claude_unit_completes_stdio_handshake() {
        let binary = compile_peer("ready");
        let mut host = enabled_host(RestrictedProcessDriver::with_handshake(&binary));
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn bad_handshake_nonce_kills_the_child() {
        let binary = compile_peer("bad-nonce");
        let mut driver = RestrictedProcessDriver::with_handshake(&binary);
        driver.corrupt_ack_on("claude-cli");
        let mut host = enabled_host(driver);
        assert!(host.activate(claude_activation_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn later_handshake_failure_kills_the_earlier_child() {
        let binary = compile_peer("later-fail");
        let mut driver = RestrictedProcessDriver::with_handshake(&binary);
        driver.declare("com.mossx.engine.claude", "claude-helper");
        driver.corrupt_ack_on("claude-helper");
        let mut host = enabled_host(driver);
        assert!(host.activate(two_process_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn ready_reactivate_does_not_leak_old_children() {
        let mut host = enabled_host(RestrictedProcessDriver::new(idle_fixture_executable()));
        host.activate(claude_activation_request()).expect("first");
        assert_eq!(host.driver().live_count(), 1);
        host.activate(claude_activation_request()).expect("second");
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn undeclared_process_named_entry_has_no_child() {
        let mut driver = RestrictedProcessDriver::new(idle_fixture_executable());
        driver
            .start("com.mossx.engine.claude", "evil-cli", 1)
            .expect("start");
        assert_eq!(driver.live_count(), 0);
    }
}
