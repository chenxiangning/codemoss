//! Default-off Host construction for app boot. No product activation.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use super::composite::CompositeDriver;
use super::host::HostConfig;
use super::runtime::PluginRuntime;
use super::spawn::{missing_executable, RestrictedProcessDriver};

static BOOT_SEQ: AtomicU64 = AtomicU64::new(1);

pub type BootHost = PluginRuntime<CompositeDriver>;

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

pub fn boot_host() -> Result<BootHost, super::host::HostError> {
    PluginRuntime::new(
        HostConfig::default(),
        boot_driver(),
        "/fixture/workspace",
        boot_storage_root(),
    )
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
}
