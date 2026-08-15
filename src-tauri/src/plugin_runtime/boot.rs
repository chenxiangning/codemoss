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
    _listener: std::os::unix::net::UnixListener,
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
        _listener: listener,
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
}
