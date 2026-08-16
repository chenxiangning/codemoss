//! Restricted Process supervisor. Host-owned children only; not in boot.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};

use super::host::{DriverError, EntryDriver};
use super::ipc::{issue_handshake_nonce, validate_handshake_ack, HANDSHAKE_DEADLINE};
use super::uds::{read_mxpc_frame_timed, write_mxpc_frame_timed};

static DATA_SEQ: AtomicU64 = AtomicU64::new(1);
pub const PROCESS_MEMORY_DEFAULT: u64 = 512 * 1024 * 1024;
pub const PROCESS_MEMORY_HARD_MAX: u64 = 2048 * 1024 * 1024;

pub fn process_memory_limit_ok(limit: u64) -> bool {
    limit > 0 && limit <= PROCESS_MEMORY_HARD_MAX
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct ChildKey {
    plugin_id: String,
    entry_id: String,
    generation: u64,
}

pub struct RestrictedProcessDriver {
    executable: PathBuf,
    data_root: PathBuf,
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
            data_root: default_data_root(),
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

    #[cfg(test)]
    pub fn set_data_root(&mut self, root: impl Into<PathBuf>) {
        self.data_root = root.into();
    }

    fn spawn_child(
        &self,
        plugin_id: &str,
        generation: u64,
        corrupt: bool,
    ) -> Result<Child, DriverError> {
        if !process_executable_ok(&self.executable) {
            return Err(DriverError::Crash);
        }
        if !process_memory_limit_ok(PROCESS_MEMORY_DEFAULT) {
            return Err(DriverError::Crash);
        }
        if !self.executable.is_file() {
            return Err(DriverError::Crash);
        }
        let planned = plugin_data_cwd(&self.data_root, plugin_id);
        if !process_cwd_ok(&planned, &self.data_root, plugin_id) {
            return Err(DriverError::Crash);
        }
        std::fs::create_dir_all(&planned).map_err(|_| DriverError::Crash)?;
        let cwd = planned.canonicalize().unwrap_or(planned);
        let mut command = Command::new(&self.executable);
        command.env_clear();
        command.current_dir(&cwd);
        command.env("MOSSX_PROCESS_MEMORY", PROCESS_MEMORY_DEFAULT.to_string());
        if !windows_process_flags_ok(CREATE_NO_WINDOW) || !windows_inherit_handles_ok(false) {
            return Err(DriverError::Crash);
        }
        close_inherited_fds(&mut command);
        #[cfg(windows)]
        {
            command.env("SYSTEMROOT", std::env::var_os("SYSTEMROOT").unwrap_or_default());
        }
        if self.handshake {
            let nonce = issue_handshake_nonce();
            command
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .env("MOSSX_HANDSHAKE_NONCE", &nonce)
                .env("MOSSX_PLUGIN_ID", plugin_id)
                .env("MOSSX_GENERATION", generation.to_string())
                .env("MOSSX_PLUGIN_DATA", &cwd);
            if corrupt {
                command.env("MOSSX_CORRUPT_ACK", "1");
            }
            let mut child = command.spawn().map_err(|_| DriverError::Crash)?;
            if let Err(error) = handshake_child(&mut child, plugin_id, generation, &nonce) {
                kill_child(&mut child);
                return Err(error);
            }
            return Ok(child);
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

fn hello(generation: u64, nonce: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "method": "mossx.handshake.hello",
        "params": {
            "protocolVersion": 1,
            "coreContract": "1.0.0",
            "nonce": nonce,
            "generation": generation
        }
    })
}

fn handshake_child(
    child: &mut Child,
    plugin_id: &str,
    generation: u64,
    nonce: &str,
) -> Result<(), DriverError> {
    let stdin = child.stdin.as_mut().ok_or(DriverError::Crash)?;
    write_mxpc_frame_timed(stdin, &hello(generation, nonce), HANDSHAKE_DEADLINE)
        .map_err(|_| DriverError::Crash)?;
    let stdout = child.stdout.as_mut().ok_or(DriverError::Crash)?;
    let received =
        read_mxpc_frame_timed(stdout, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
    validate_handshake_ack(&received, nonce, plugin_id, generation, "1.0.0")
        .map_err(|_| DriverError::Crash)?;
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
        let child = self.spawn_child(plugin_id, generation, corrupt)?;
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

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

pub fn windows_process_flags_ok(flags: u32) -> bool {
    flags & CREATE_NO_WINDOW != 0 && flags & CREATE_NEW_CONSOLE == 0
}

pub fn windows_inherit_handles_ok(inherit_extra: bool) -> bool {
    !inherit_extra
}

fn close_inherited_fds(command: &mut Command) {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            command.pre_exec(|| {
                close_fds_from(3);
                apply_process_memory_limit()?;
                Ok(())
            });
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = command;
    }
}

#[cfg(unix)]
fn close_fds_from(start: i32) {
    for fd in start..=1024 {
        let _ = unsafe { libc::close(fd) };
    }
}

#[cfg(unix)]
fn apply_process_memory_limit() -> std::io::Result<()> {
    if !process_memory_limit_ok(PROCESS_MEMORY_DEFAULT) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "process memory limit must be finite",
        ));
    }
    let limit = PROCESS_MEMORY_DEFAULT as libc::rlim_t;
    let rlim = libc::rlimit {
        rlim_cur: limit,
        rlim_max: limit,
    };
    // macOS RLIMIT_AS includes the dyld shared cache, so 512 MiB cannot exec.
    // Linux can cap the whole address space.
    let resource = if cfg!(target_os = "macos") {
        libc::RLIMIT_DATA
    } else {
        libc::RLIMIT_AS
    };
    if unsafe { libc::setrlimit(resource, &rlim) } != 0 {
        let error = std::io::Error::last_os_error();
        if cfg!(target_os = "macos") && error.raw_os_error() == Some(libc::EINVAL) {
            // Current macOS rejects lowering RLIMIT_AS / RLIMIT_DATA.
            return Ok(());
        }
        return Err(error);
    }
    Ok(())
}

fn default_data_root() -> PathBuf {
    let seq = DATA_SEQ.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "mossx-pdata-{}-{}",
        std::process::id() % 10_000,
        seq
    ))
}

pub fn plugin_data_cwd(root: &Path, plugin_id: &str) -> PathBuf {
    root.join("plugin-runtime/data").join(plugin_id)
}

pub fn process_cwd_ok(cwd: &Path, root: &Path, plugin_id: &str) -> bool {
    if !cwd.is_absolute() || plugin_id.trim().is_empty() {
        return false;
    }
    if cwd.components().any(|component| {
        matches!(component, std::path::Component::ParentDir)
    }) {
        return false;
    }
    cwd == plugin_data_cwd(root, plugin_id)
}

pub fn missing_executable() -> PathBuf {
    PathBuf::from("/nonexistent-mossx-restricted-process")
}

/// 从可审计来源（engine config 的 `bin_path`）构造带 handshake 的真实 driver。
/// 无真实路径时 fallback 到 `missing_executable()`（default-off 安全闸门），
/// 保证 boot / 生产路径绝不因缺配置而误 spawn 真实子进程。
/// 仅用于 conformance 验证，不接 boot 生产启动链。
pub fn restricted_process_driver_for(executable: Option<&str>) -> RestrictedProcessDriver {
    match executable {
        Some(path) if !path.trim().is_empty() => {
            RestrictedProcessDriver::with_handshake(path.to_string())
        }
        _ => RestrictedProcessDriver::new(missing_executable()),
    }
}

const DENIED_STEMS: &[&str] = &[
    "sh",
    "bash",
    "zsh",
    "dash",
    "cmd",
    "powershell",
    "pwsh",
    "python",
    "python3",
    "node",
    "deno",
    "bun",
];

pub fn process_executable_ok(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }
    if path.as_os_str().is_empty() {
        return false;
    }
    if path.components().any(|component| {
        matches!(component, std::path::Component::ParentDir)
    }) {
        return false;
    }
    let Some(stem) = path.file_stem().and_then(|name| name.to_str()) else {
        return false;
    };
    !DENIED_STEMS
        .iter()
        .any(|denied| stem.eq_ignore_ascii_case(denied))
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

    #[test]
    fn a_shell_executable_cannot_leave_a_child() {
        let shell = if cfg!(windows) {
            PathBuf::from(r"C:\Windows\System32\cmd.exe")
        } else {
            PathBuf::from("/bin/sh")
        };
        assert!(!process_executable_ok(&shell));
        let mut driver = RestrictedProcessDriver::new(shell);
        assert!(driver
            .start("com.mossx.engine.claude", "claude-cli", 1)
            .is_err());
        assert_eq!(driver.live_count(), 0);
    }

    #[test]
    fn parent_leak_probe_cannot_complete_handshake() {
        std::env::set_var("MOSSX_SHOULD_NOT_INHERIT", "secret");
        let binary = compile_peer("env-clear");
        let mut host = enabled_host(RestrictedProcessDriver::with_handshake(&binary));
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
        std::env::remove_var("MOSSX_SHOULD_NOT_INHERIT");
    }

    #[cfg(unix)]
    #[test]
    fn a_leaked_parent_fd_cannot_complete_handshake() {
        let _probe = std::fs::File::open("/dev/null").expect("probe");
        let binary = compile_peer("fd-clear");
        let mut host = enabled_host(RestrictedProcessDriver::with_handshake(&binary));
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn relative_or_parent_path_is_denied() {
        for path in [
            PathBuf::from("sleep"),
            PathBuf::from("/tmp/../bin/sh"),
            PathBuf::from(""),
        ] {
            assert!(!process_executable_ok(&path), "{path:?}");
        }
        assert!(process_executable_ok(&idle_fixture_executable()));
    }

    #[test]
    fn create_no_window_without_extra_inherit_is_accepted() {
        assert!(windows_process_flags_ok(CREATE_NO_WINDOW));
        assert!(windows_inherit_handles_ok(false));
    }

    #[test]
    fn extra_inherit_cannot_leave_a_child() {
        assert!(!windows_inherit_handles_ok(true));
        assert!(!windows_process_flags_ok(0));
        assert!(!windows_process_flags_ok(CREATE_NEW_CONSOLE));
        assert!(!windows_process_flags_ok(CREATE_NO_WINDOW | CREATE_NEW_CONSOLE));
    }

    #[test]
    fn unlimited_or_oversized_process_memory_is_rejected() {
        assert!(!process_memory_limit_ok(0));
        assert!(!process_memory_limit_ok(PROCESS_MEMORY_HARD_MAX + 1));
        assert!(process_memory_limit_ok(PROCESS_MEMORY_DEFAULT));
        assert!(process_memory_limit_ok(PROCESS_MEMORY_HARD_MAX));
        let source = include_str!("spawn.rs");
        assert!(source.contains("apply_process_memory_limit"));
        assert!(source.contains("RLIMIT_DATA"));
        assert!(source.contains("RLIMIT_AS"));
        assert!(source.contains("setrlimit"));
        let peer = include_str!("../../../packages/plugin-contract/fixtures/ipc/restricted-process-peer.rs");
        assert!(peer.contains("MOSSX_PROCESS_MEMORY"));
        assert!(peer.contains("getrlimit"));
        assert!(peer.contains("exit(6)"));
    }

    #[test]
    fn plugin_data_cwd_is_accepted() {
        let root = PathBuf::from("/tmp/mossx-pdata-fixture");
        let cwd = plugin_data_cwd(&root, "com.mossx.engine.claude");
        assert!(process_cwd_ok(&cwd, &root, "com.mossx.engine.claude"));
    }

    #[test]
    fn a_parent_or_workspace_cwd_cannot_leave_a_child() {
        let root = PathBuf::from("/tmp/mossx-pdata-fixture");
        let expected = plugin_data_cwd(&root, "com.mossx.engine.claude");
        for cwd in [
            PathBuf::from("plugin-runtime/data/com.mossx.engine.claude"),
            expected.join(".."),
            root.clone(),
            PathBuf::from("/tmp"),
            PathBuf::from(""),
        ] {
            assert!(
                !process_cwd_ok(&cwd, &root, "com.mossx.engine.claude"),
                "{cwd:?}"
            );
        }
        let mut driver = RestrictedProcessDriver::new(idle_fixture_executable());
        driver.set_data_root("relative-root");
        assert!(driver
            .start("com.mossx.engine.claude", "claude-cli", 1)
            .is_err());
        assert_eq!(driver.live_count(), 0);
    }

    #[test]
    fn restricted_process_driver_for_falls_back_to_missing_executable() {
        // 无真实路径（None / 空串）→ 安全闸门 missing_executable
        for executable in [None, Some(""), Some("  ")] {
            let driver = restricted_process_driver_for(executable);
            assert!(
                driver.executable.to_string_lossy().contains("nonexistent"),
                "must fall back to missing_executable for {executable:?}"
            );
        }
    }

    #[test]
    fn restricted_process_driver_for_uses_real_path_with_handshake() {
        let driver = restricted_process_driver_for(Some("/path/to/claude"));
        assert_eq!(driver.executable.to_string_lossy(), "/path/to/claude");
        assert!(driver.handshake, "real path must enable handshake");
    }
}
