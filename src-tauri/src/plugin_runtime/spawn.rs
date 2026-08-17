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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SuperviseTarget {
    pub executable: PathBuf,
    pub argv: Vec<String>,
    pub cwd: Option<PathBuf>,
}

pub struct RestrictedProcessDriver {
    executable: PathBuf,
    data_root: PathBuf,
    children: HashMap<ChildKey, Child>,
    catalog: HashSet<(String, String)>,
    fail_on: Option<String>,
    corrupt_ack_on: Option<String>,
    handshake: bool,
    supervise: Option<SuperviseTarget>,
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
            supervise: None,
        }
    }

    pub fn with_handshake(executable: impl Into<PathBuf>) -> Self {
        let mut driver = Self::new(executable);
        driver.handshake = true;
        driver
    }

    pub fn with_supervise(mut self, target: SuperviseTarget) -> Self {
        self.supervise = Some(target);
        self
    }

    pub fn live_count(&self) -> usize {
        self.children.len()
    }

    pub fn executable(&self) -> &Path {
        &self.executable
    }

    pub fn child_pid(&self, plugin_id: &str, entry_id: &str, generation: u64) -> Option<u32> {
        self.children
            .get(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .map(Child::id)
    }

    pub fn write_supervised_stdio(
        &mut self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
        data: &[u8],
    ) -> Result<(), DriverError> {
        let child = self
            .children
            .get_mut(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .ok_or(DriverError::Crash)?;
        stdio_call(
            child,
            "io-1",
            "mossx.process.stdio.write",
            json!({ "dataHex": encode_hex(data) }),
        )?;
        Ok(())
    }

    pub fn read_supervised_stdio(
        &mut self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<(Vec<u8>, bool), DriverError> {
        let child = self
            .children
            .get_mut(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .ok_or(DriverError::Crash)?;
        let received = stdio_call(child, "io-2", "mossx.process.stdio.read", json!({}))?;
        let hex = received
            .pointer("/result/dataHex")
            .and_then(Value::as_str)
            .ok_or(DriverError::Crash)?;
        let eof = received
            .pointer("/result/eof")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        Ok((decode_hex(hex).ok_or(DriverError::Crash)?, eof))
    }

    pub fn read_supervised_stderr(
        &mut self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<(Vec<u8>, bool), DriverError> {
        let child = self
            .children
            .get_mut(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .ok_or(DriverError::Crash)?;
        let received = stdio_call(child, "io-4", "mossx.process.stdio.read-stderr", json!({}))?;
        let hex = received
            .pointer("/result/dataHex")
            .and_then(Value::as_str)
            .ok_or(DriverError::Crash)?;
        let eof = received
            .pointer("/result/eof")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        Ok((decode_hex(hex).ok_or(DriverError::Crash)?, eof))
    }

    pub fn wait_supervised(
        &mut self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<Option<i32>, DriverError> {
        let child = self
            .children
            .get_mut(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .ok_or(DriverError::Crash)?;
        let received = stdio_call(child, "io-5", "mossx.process.wait", json!({}))?;
        let exited = received
            .pointer("/result/exited")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !exited {
            return Ok(None);
        }
        Ok(received.pointer("/result/code").and_then(Value::as_i64).map(|code| code as i32))
    }

    pub fn close_supervised_stdin(
        &mut self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Result<(), DriverError> {
        let child = self
            .children
            .get_mut(&ChildKey {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            })
            .ok_or(DriverError::Crash)?;
        stdio_call(child, "io-3", "mossx.process.stdio.close-stdin", json!({}))?;
        Ok(())
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
        // 独立进程组：卸载/熔断时对整个组 SIGKILL，防孙进程（CLI 拉起的 helper）泄漏。
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
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
            if let Some(target) = &self.supervise {
                if let Err(error) = supervise_child(&mut child, target) {
                    kill_child(&mut child);
                    return Err(error);
                }
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

fn supervise_request(target: &SuperviseTarget) -> Value {
    let mut params = json!({
        "executable": target.executable.to_string_lossy(),
        "argv": target.argv,
    });
    if let Some(cwd) = &target.cwd {
        params["cwd"] = json!(cwd.to_string_lossy());
    }
    json!({
        "jsonrpc": "2.0",
        "id": "sup-1",
        "method": "mossx.process.supervise",
        "params": params
    })
}

fn encode_hex(data: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(data.len() * 2);
    for byte in data {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn decode_hex(src: &str) -> Option<Vec<u8>> {
    if src.len() % 2 != 0 {
        return None;
    }
    let bytes = src.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 2);
    let mut index = 0;
    while index < bytes.len() {
        let hi = hex_val(bytes[index])?;
        let lo = hex_val(bytes[index + 1])?;
        out.push((hi << 4) | lo);
        index += 2;
    }
    Some(out)
}

fn hex_val(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn stdio_call(
    child: &mut Child,
    id: &str,
    method: &str,
    params: Value,
) -> Result<Value, DriverError> {
    let stdin = child.stdin.as_mut().ok_or(DriverError::Crash)?;
    write_mxpc_frame_timed(
        stdin,
        &json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }),
        HANDSHAKE_DEADLINE,
    )
    .map_err(|_| DriverError::Crash)?;
    let stdout = child.stdout.as_mut().ok_or(DriverError::Crash)?;
    let received =
        read_mxpc_frame_timed(stdout, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
    if received.get("error").is_some() {
        return Err(DriverError::Crash);
    }
    Ok(received)
}

fn supervise_child(child: &mut Child, target: &SuperviseTarget) -> Result<(), DriverError> {
    if !process_executable_ok(&target.executable) || !target.executable.is_file() {
        return Err(DriverError::Crash);
    }
    if let Some(cwd) = &target.cwd {
        if !supervise_cwd_ok(cwd) {
            return Err(DriverError::Crash);
        }
    }
    let stdin = child.stdin.as_mut().ok_or(DriverError::Crash)?;
    write_mxpc_frame_timed(stdin, &supervise_request(target), HANDSHAKE_DEADLINE)
        .map_err(|_| DriverError::Crash)?;
    let stdout = child.stdout.as_mut().ok_or(DriverError::Crash)?;
    let received =
        read_mxpc_frame_timed(stdout, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
    if received.get("error").is_some() || received.pointer("/result/ok") != Some(&json!(true)) {
        return Err(DriverError::Crash);
    }
    Ok(())
}

fn kill_child(child: &mut Child) {
    // 进程组 kill：Restricted Process 可能 fork 孙进程（如 CLI 拉起 helper），
    // 只 child.kill() 会泄漏孤儿。先 SIGKILL 整个进程组，再回收 leader。
    #[cfg(unix)]
    {
        let pid = child.id();
        // 负 pid 目标整个进程组（spawn 时 process_group(0) 已把 leader 设为组首）。
        unsafe {
            libc::kill(-(pid as libc::pid_t), libc::SIGKILL);
        }
    }
    #[cfg(windows)]
    {
        let pid = child.id();
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
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

pub fn supervise_cwd_ok(cwd: &Path) -> bool {
    cwd.is_absolute()
        && !cwd.as_os_str().is_empty()
        && !cwd
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
}

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

    #[test]
    fn restricted_process_driver_for_spawns_and_kills_a_real_peer() {
        // 端到端验证：helper 解析出的真实 driver 能真实 spawn peer、
        // 完成 activate → Ready，并在 disable 后真实杀进程（live_count 归零）。
        let binary = compile_peer("from-helper");
        let mut host = enabled_host(restricted_process_driver_for(
            Some(binary.to_str().expect("utf8 path")),
        ));
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
    fn interrupt_stops_a_real_peer_process_group_and_returns_to_idle() {
        // 端到端验证：真实 driver spawn peer → activate Ready → interrupt 非终态
        // 杀真实进程组（live_count 归零）→ 回 Idle → 可再次 activate 生成新 generation。
        let binary = compile_peer("interrupt");
        let mut host = enabled_host(restricted_process_driver_for(
            Some(binary.to_str().expect("utf8 path")),
        ));
        let generation = host
            .activate(claude_activation_request())
            .expect("activate");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().live_count(), 1);
        host.interrupt("com.mossx.engine.claude", generation)
            .expect("interrupt");
        assert_eq!(host.driver().live_count(), 0);
        let slot = host.slot("com.mossx.engine.claude").expect("slot");
        assert_eq!(slot.state, SlotState::Idle);
        assert!(slot.started.is_empty());
        // 非终态：可再次 activate 并再次真实 spawn。
        let next = host
            .activate(claude_activation_request())
            .expect("reactivate after interrupt");
        assert_eq!(next, generation + 1);
        assert_eq!(host.driver().live_count(), 1);
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn uninstall_stops_a_real_peer_process_group_and_is_irreversible() {
        // 端到端验证：真实 driver spawn peer → activate Ready → uninstall 杀真实
        // 进程组（live_count 归零）→ 进入不可恢复 Uninstalled 终态 → activate 拒绝。
        let binary = compile_peer("uninstall");
        let mut host = enabled_host(restricted_process_driver_for(
            Some(binary.to_str().expect("utf8 path")),
        ));
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().live_count(), 1);
        host.uninstall("com.mossx.engine.claude").expect("uninstall");
        assert_eq!(host.driver().live_count(), 0);
        let slot = host.slot("com.mossx.engine.claude").expect("slot");
        assert_eq!(slot.state, SlotState::Uninstalled);
        assert!(slot.started.is_empty());
        // 不可恢复：uninstall 后 activate 一律拒绝。
        assert_eq!(
            host.activate(claude_activation_request()).unwrap_err().code,
            "uninstalled"
        );
        assert_eq!(host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
    }

    #[test]
    fn runtime_uninstall_stops_real_peer_and_revokes_composed_handles() {
        // 最完整端到端闭环：真实 peer 进程 + 完整组合（host + broker + plane + storage），
        // uninstall 杀真实进程组 + 撤销三类 composed handles + 进不可恢复终态。
        use crate::plugin_runtime::disk_storage::{remove_path, unique_temp_root};
        use crate::plugin_runtime::runtime::PluginRuntime;

        let binary = compile_peer("runtime-uninstall");
        let root = unique_temp_root("spawn-runtime-uninstall");
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            restricted_process_driver_for(Some(binary.to_str().expect("utf8 path"))),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        let generation = runtime
            .activate(claude_activation_request())
            .expect("activate");
        assert_eq!(
            runtime.host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(runtime.host.driver().live_count(), 1);
        runtime
            .open_own_store("com.mossx.engine.claude")
            .expect("store");
        runtime
            .open_stream("com.mossx.engine.claude", generation, 11, "blob-v1")
            .expect("stream");
        runtime
            .uninstall_plugin("com.mossx.engine.claude")
            .expect("uninstall");
        // 真实进程组已停。
        assert_eq!(runtime.host.driver().live_count(), 0);
        assert_eq!(
            runtime.host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Uninstalled
        );
        // 三类 composed handles 全部失效。
        assert!(runtime
            .query_read("com.mossx.engine.claude", generation)
            .is_err());
        assert_eq!(
            runtime
                .open_own_store("com.mossx.engine.claude")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert!(runtime
            .open_stream("com.mossx.engine.claude", generation, 12, "blob-v1")
            .is_err());
        assert!(runtime.plane.codec(11).is_none());
        // 不可恢复：activate 拒绝，进程保持归零。
        assert_eq!(
            runtime
                .activate(claude_activation_request())
                .unwrap_err()
                .code,
            "uninstalled"
        );
        assert_eq!(runtime.host.driver().live_count(), 0);
        let _ = std::fs::remove_file(binary);
        remove_path(&root);
    }
}
