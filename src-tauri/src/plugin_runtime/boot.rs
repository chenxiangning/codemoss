//! Default-off Host construction for app boot. Owns a private UDS supervisor. No product activation.

use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use super::composite::CompositeDriver;
use super::host::{HostConfig, HostError};
use super::runtime::PluginRuntime;
use super::spawn::{missing_executable, RestrictedProcessDriver};

fn host_supervisor_root() -> PathBuf {
    PathBuf::from(env!("MOSSX_HOST_SUPERVISOR_ROOT"))
}

fn host_supervisor_binary() -> Option<PathBuf> {
    let platform = if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "darwin-arm64"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "darwin-x64"
    } else if cfg!(all(target_os = "linux", target_arch = "aarch64")) {
        "linux-arm64"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "linux-x64"
    } else {
        return None;
    };
    let binary = host_supervisor_root().join(format!("bin/{platform}/host-supervisor"));
    binary.is_file().then_some(binary)
}

static BOOT_SEQ: AtomicU64 = AtomicU64::new(1);

pub struct BootHost {
    runtime: PluginRuntime<CompositeDriver>,
    #[cfg(unix)]
    supervisor: Option<SupervisorSocket>,
}

#[cfg(unix)]
struct SupervisorSocket {
    path: PathBuf,
    child: Option<std::process::Child>,
    _unlink: super::uds::UnlinkOnDrop,
}

#[cfg(unix)]
impl SupervisorSocket {
    fn pid(&self) -> Option<u32> {
        self.child.as_ref().map(|child| child.id())
    }
}

#[cfg(unix)]
impl Drop for SupervisorSocket {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            #[cfg(unix)]
            {
                let pid = child.id();
                unsafe {
                    libc::kill(-(pid as libc::pid_t), libc::SIGKILL);
                }
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Deref for BootHost {
    type Target = PluginRuntime<CompositeDriver>;

    fn deref(&self) -> &Self::Target {
        &self.runtime
    }
}

impl DerefMut for BootHost {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.runtime
    }
}

impl BootHost {
    pub fn supervisor_path(&self) -> Option<&Path> {
        #[cfg(unix)]
        {
            self.supervisor.as_ref().map(|socket| socket.path.as_path())
        }
        #[cfg(not(unix))]
        {
            None
        }
    }

    pub fn reject_unexpected(&self) -> Result<(), HostError> {
        self.reject_one(super::ipc::HANDSHAKE_DEADLINE)
    }

    pub fn drain_unexpected(&self) -> Result<usize, HostError> {
        self.reject_one(super::ipc::HANDSHAKE_DEADLINE)?;
        Ok(1)
    }

    pub fn supervisor_pid(&self) -> Option<u32> {
        #[cfg(unix)]
        {
            self.supervisor.as_ref().and_then(SupervisorSocket::pid)
        }
        #[cfg(not(unix))]
        {
            None
        }
    }

    fn reject_one(&self, timeout: std::time::Duration) -> Result<(), HostError> {
        #[cfg(unix)]
        {
            let supervisor = self.supervisor.as_ref().ok_or_else(|| HostError {
                code: "unsupported-platform",
                message: "boot supervisor is unix-only in V1".into(),
            })?;
            let deadline = std::time::Instant::now() + timeout;
            loop {
                match super::uds::connect_uds(&supervisor.path) {
                    Ok(mut stream) => {
                        let received = super::uds::read_mxpc_frame_timed(
                            &mut stream,
                            super::ipc::HANDSHAKE_DEADLINE,
                        )
                        .map_err(host_err)?;
                        let message = received
                            .get("error")
                            .and_then(|error| error.get("message"))
                            .and_then(serde_json::Value::as_str);
                        if message != Some("host-disabled") {
                            return Err(HostError {
                                code: "host-disabled",
                                message: "supervisor did not reject unexpected peer".into(),
                            });
                        }
                        return Ok(());
                    }
                    Err(_) if std::time::Instant::now() >= deadline => {
                        return Err(HostError {
                            code: "handshake-timeout",
                            message: "supervisor did not accept within deadline".into(),
                        });
                    }
                    Err(_) => std::thread::sleep(std::time::Duration::from_millis(20)),
                }
            }
        }
        #[cfg(not(unix))]
        {
            let _ = timeout;
            Err(HostError {
                code: "unsupported-platform",
                message: "boot supervisor is unix-only in V1".into(),
            })
        }
    }
}

fn boot_storage_root() -> PathBuf {
    let seq = BOOT_SEQ.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "mossx-boot-{}-{}-{}",
        std::process::id() % 10_000,
        seq,
        nanos % 1_000_000
    ))
}

fn boot_driver() -> CompositeDriver {
    CompositeDriver::new(RestrictedProcessDriver::new(missing_executable()))
}

fn host_err(error: super::ipc::IpcError) -> HostError {
    HostError {
        code: error.code,
        message: error.message,
    }
}

#[cfg(unix)]
fn bind_supervisor() -> Result<SupervisorSocket, HostError> {
    let binary = host_supervisor_binary().ok_or_else(|| HostError {
        code: "activation-failed",
        message: "host supervisor artifact missing".into(),
    })?;
    let seq = BOOT_SEQ.fetch_add(1, Ordering::Relaxed);
    let path = super::uds::private_uds_path("com.mossx.host", &format!("h{}", seq % 1000))
        .map_err(host_err)?;
    let _ = std::fs::remove_file(&path);
    let mut command = std::process::Command::new(&binary);
    command.arg(&path);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let child = command.spawn().map_err(|error| HostError {
        code: "activation-failed",
        message: format!("spawn host supervisor: {error}"),
    })?;
    let started = std::time::Instant::now();
    while !path.exists() {
        if started.elapsed() > std::time::Duration::from_secs(2) {
            return Err(HostError {
                code: "activation-failed",
                message: "host supervisor did not bind UDS".into(),
            });
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    Ok(SupervisorSocket {
        path: path.clone(),
        child: Some(child),
        _unlink: super::uds::UnlinkOnDrop::new(path),
    })
}

pub fn boot_host() -> Result<BootHost, HostError> {
    let runtime = PluginRuntime::new(
        HostConfig::default(),
        boot_driver(),
        "/fixture/workspace",
        boot_storage_root(),
    )?;
    #[cfg(unix)]
    let supervisor = Some(bind_supervisor()?);
    Ok(BootHost {
        runtime,
        #[cfg(unix)]
        supervisor,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    #[test]
    fn boot_host_rejects_notes_activation() {
        let mut host = boot_host().expect("boot");
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
        assert_eq!(
            host.activate(notes_activation_request()).unwrap_err().code,
            "host-disabled"
        );
        assert!(host.host.slot("com.mossx.notes").is_none());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[test]
    fn boot_host_rejects_claude_activation() {
        let mut host = boot_host().expect("boot");
        assert_eq!(
            host.activate(claude_activation_request()).unwrap_err().code,
            "host-disabled"
        );
        assert!(host.host.slot("com.mossx.engine.claude").is_none());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[test]
    fn command_registry_does_not_expose_host_commands() {
        let source = include_str!("../command_registry.rs");
        assert!(!source.contains("plugin_runtime"));
        assert!(!source.contains("boot_host"));
        assert!(!source.contains("activate_plugin"));
    }

    #[cfg(unix)]
    #[test]
    fn boot_supervises_a_separate_host_disabled_process() {
        let mut host = boot_host().expect("boot");
        let pid = host.supervisor_pid().expect("pid");
        assert_ne!(pid, std::process::id());
        assert!(host.supervisor_path().expect("path").exists());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(
            host.host.driver().process.executable(),
            &crate::plugin_runtime::spawn::missing_executable()
        );
        assert_eq!(
            host.activate(notes_activation_request()).unwrap_err().code,
            "host-disabled"
        );
    }

    #[cfg(unix)]
    #[test]
    fn boot_owns_a_private_supervisor_socket() {
        use std::os::unix::fs::PermissionsExt;

        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor");
        assert!(path.exists());
        let mode = std::fs::metadata(path).expect("meta").permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let parent_mode = std::fs::metadata(path.parent().expect("parent"))
            .expect("parent meta")
            .permissions()
            .mode()
            & 0o777;
        assert_eq!(parent_mode, 0o700);
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn dropping_boot_unlinks_the_supervisor_socket() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        assert!(path.exists());
        drop(host);
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn an_unexpected_connector_is_rejected_without_activation() {
        use crate::plugin_runtime::ipc::HANDSHAKE_DEADLINE;
        use crate::plugin_runtime::uds::{connect_uds, read_mxpc_frame_timed};

        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        let mut client = connect_uds(&path).expect("connect");
        let received = read_mxpc_frame_timed(&mut client, HANDSHAKE_DEADLINE).expect("frame");
        assert_eq!(
            received
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(serde_json::Value::as_str),
            Some("host-disabled")
        );
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
        assert!(host.host.slot("com.mossx.notes").is_none());
        assert!(host.host.slot("com.mossx.engine.claude").is_none());
    }

    #[cfg(unix)]
    #[test]
    fn reject_probes_the_separate_supervisor() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        host.reject_unexpected().expect("live supervisor rejects");
        assert!(path.exists());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn two_unexpected_connectors_are_both_rejected() {
        use crate::plugin_runtime::ipc::HANDSHAKE_DEADLINE;
        use crate::plugin_runtime::uds::{connect_uds, read_mxpc_frame_timed};

        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        let mut first = connect_uds(&path).expect("first");
        let mut second = connect_uds(&path).expect("second");
        for client in [&mut first, &mut second] {
            let received = read_mxpc_frame_timed(client, HANDSHAKE_DEADLINE).expect("frame");
            assert_eq!(
                received
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(serde_json::Value::as_str),
                Some("host-disabled")
            );
        }
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
        assert!(host.host.slot("com.mossx.notes").is_none());
    }

    #[cfg(unix)]
    #[test]
    fn drain_probes_the_separate_supervisor_once() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        assert_eq!(host.drain_unexpected().expect("drain"), 1);
        assert!(path.exists());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn a_live_supervisor_rejects_a_connector_without_an_explicit_drain() {
        use crate::plugin_runtime::ipc::HANDSHAKE_DEADLINE;
        use crate::plugin_runtime::uds::{connect_uds, read_mxpc_frame_timed};

        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        let mut client = connect_uds(&path).expect("connect");
        let received = read_mxpc_frame_timed(&mut client, HANDSHAKE_DEADLINE).expect("frame");
        assert_eq!(
            received
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(serde_json::Value::as_str),
            Some("host-disabled")
        );
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn dropping_a_live_supervisor_still_unlinks() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        assert!(path.exists());
        drop(host);
        assert!(!path.exists());
    }
}
