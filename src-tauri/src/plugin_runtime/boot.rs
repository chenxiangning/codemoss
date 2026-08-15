//! Default-off Host construction for app boot. Owns a private UDS supervisor. No product activation.

use std::ops::{Deref, DerefMut};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use super::composite::CompositeDriver;
use super::host::{HostConfig, HostError};
use super::runtime::PluginRuntime;
use super::spawn::{missing_executable, RestrictedProcessDriver};

static BOOT_SEQ: AtomicU64 = AtomicU64::new(1);

pub struct BootHost {
    runtime: PluginRuntime<CompositeDriver>,
    #[cfg(unix)]
    supervisor: Option<SupervisorSocket>,
}

#[cfg(unix)]
struct SupervisorSocket {
    path: PathBuf,
    listener: std::os::unix::net::UnixListener,
    _unlink: super::uds::UnlinkOnDrop,
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
        let mut count = 1;
        loop {
            match self.reject_one(std::time::Duration::ZERO) {
                Ok(()) => count += 1,
                Err(error) if error.code == "handshake-timeout" => return Ok(count),
                Err(error) => return Err(error),
            }
        }
    }

    fn reject_one(&self, timeout: std::time::Duration) -> Result<(), HostError> {
        #[cfg(unix)]
        {
            use serde_json::json;

            let supervisor = self.supervisor.as_ref().ok_or_else(|| HostError {
                code: "unsupported-platform",
                message: "boot supervisor is unix-only in V1".into(),
            })?;
            let mut stream =
                super::uds::accept_uds_timed(&supervisor.listener, timeout).map_err(host_err)?;
            super::uds::write_mxpc_frame_timed(
                &mut stream,
                &json!({
                    "jsonrpc": "2.0",
                    "id": serde_json::Value::Null,
                    "error": {
                        "code": -32000,
                        "message": "host-disabled"
                    }
                }),
                super::ipc::HANDSHAKE_DEADLINE,
            )
            .map_err(host_err)?;
            Ok(())
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
    let seq = BOOT_SEQ.fetch_add(1, Ordering::Relaxed);
    let path = super::uds::private_uds_path("com.mossx.host", &format!("h{}", seq % 1000))
        .map_err(host_err)?;
    let listener = super::uds::bind_uds(&path).map_err(host_err)?;
    Ok(SupervisorSocket {
        path: path.clone(),
        listener,
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
        use std::thread;

        use crate::plugin_runtime::ipc::HANDSHAKE_DEADLINE;
        use crate::plugin_runtime::uds::{connect_uds, read_mxpc_frame_timed};

        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        let peer = thread::spawn(move || {
            let mut client = connect_uds(&path).expect("connect");
            read_mxpc_frame_timed(&mut client, HANDSHAKE_DEADLINE)
        });
        host.reject_unexpected().expect("reject");
        let received = peer.join().expect("peer").expect("frame");
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
    fn reject_without_a_connector_times_out() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        assert_eq!(
            host.reject_unexpected().unwrap_err().code,
            "handshake-timeout"
        );
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
        assert_eq!(host.drain_unexpected().expect("drain"), 2);
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
    fn drain_without_a_connector_times_out() {
        let host = boot_host().expect("boot");
        let path = host.supervisor_path().expect("supervisor").to_path_buf();
        assert_eq!(
            host.drain_unexpected().unwrap_err().code,
            "handshake-timeout"
        );
        assert!(path.exists());
        assert_eq!(host.host.driver().process.live_count(), 0);
        assert_eq!(host.host.driver().worker.live_count(), 0);
    }
}
