//! Host EntryDriver that handshakes over an injected UDS. Thread peer, no spawn.

use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};

use super::host::{DriverError, EntryDriver};
use super::ipc::{issue_handshake_nonce, HANDSHAKE_DEADLINE};

static SOCK_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Default)]
pub struct UdsHandshakeDriver {
    pub corrupt_ack_on: Option<String>,
    pub started: Vec<(String, String, u64)>,
    pub stopped: Vec<(String, String, u64)>,
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

fn ack(plugin_id: &str, generation: u64, nonce: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "result": {
            "protocolVersion": 1,
            "pluginId": plugin_id,
            "version": "1.0.0",
            "generation": generation,
            "nonce": nonce
        }
    })
}

#[cfg(unix)]
fn sock_path(
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
) -> Result<std::path::PathBuf, DriverError> {
    let seq = SOCK_SEQ.fetch_add(1, Ordering::Relaxed);
    super::uds::private_uds_path(
        plugin_id,
        &format!(
            "{}{}{}",
            seq % 1000,
            entry_id.as_bytes().first().copied().unwrap_or(b'e') as char,
            generation % 10
        ),
    )
    .map_err(|_| DriverError::Crash)
}

#[cfg(unix)]
fn handshake(
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
    corrupt: bool,
) -> Result<(), DriverError> {
    let path = sock_path(plugin_id, entry_id, generation)?;
    handshake_at(&path, plugin_id, generation, corrupt, false)
}

#[cfg(unix)]
fn handshake_at(
    path: &std::path::Path,
    plugin_id: &str,
    generation: u64,
    corrupt: bool,
    silent: bool,
) -> Result<(), DriverError> {
    use std::thread;

    use super::ipc::{validate_handshake_ack, validate_handshake_hello};
    use super::uds::{
        accept_uds_timed, bind_uds, connect_uds_timed, read_mxpc_frame_timed, write_mxpc_frame_timed,
    };

    let listener = bind_uds(path).map_err(|_| DriverError::Crash)?;
    let _unlink = super::uds::UnlinkOnDrop::new(path);
    let peer_plugin = plugin_id.to_string();
    let nonce = issue_handshake_nonce();
    let peer_nonce = nonce.clone();
    let peer = thread::spawn(move || {
        let mut stream = accept_uds_timed(&listener, HANDSHAKE_DEADLINE).map_err(|_| ())?;
        if silent {
            return Ok(());
        }
        let received = read_mxpc_frame_timed(&mut stream, HANDSHAKE_DEADLINE).map_err(|_| ())?;
        validate_handshake_hello(&received, generation, &peer_nonce).map_err(|_| ())?;
        let ack_nonce = if corrupt {
            "bb".repeat(32)
        } else {
            peer_nonce
        };
        write_mxpc_frame_timed(
            &mut stream,
            &ack(&peer_plugin, generation, &ack_nonce),
            HANDSHAKE_DEADLINE,
        )
        .map_err(|_| ())?;
        Ok::<(), ()>(())
    });
    let mut client = connect_uds_timed(path, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
    write_mxpc_frame_timed(&mut client, &hello(generation, &nonce), HANDSHAKE_DEADLINE)
        .map_err(|_| DriverError::Crash)?;
    let received =
        read_mxpc_frame_timed(&mut client, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
    let result =
        validate_handshake_ack(&received, &nonce, plugin_id, generation, "1.0.0")
            .map_err(|_| DriverError::Crash);
    let _ = peer.join();
    result
}

#[cfg(not(unix))]
fn handshake(
    _plugin_id: &str,
    _entry_id: &str,
    _generation: u64,
    _corrupt: bool,
) -> Result<(), DriverError> {
    Err(DriverError::Crash)
}

impl EntryDriver for UdsHandshakeDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        let corrupt = self.corrupt_ack_on.as_deref() == Some(entry_id);
        handshake(plugin_id, entry_id, generation, corrupt)?;
        self.started
            .push((plugin_id.to_string(), entry_id.to_string(), generation));
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        self.stopped
            .push((plugin_id.to_string(), entry_id.to_string(), generation));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::host::{Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    fn enabled_host(driver: UdsHandshakeDriver) -> Host<UdsHandshakeDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    #[cfg(unix)]
    #[test]
    fn notes_unit_becomes_ready_over_uds() {
        let mut host = enabled_host(UdsHandshakeDriver::default());
        let request = notes_activation_request();
        let generation = host.activate(request).expect("activate");
        assert_eq!(generation, 1);
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        host.dispatch("com.mossx.notes", 1).expect("current");
    }

    #[cfg(unix)]
    #[test]
    fn bad_nonce_rolls_back_earlier_entries() {
        let mut host = enabled_host(UdsHandshakeDriver {
            corrupt_ack_on: Some("notes-ui".into()),
            ..UdsHandshakeDriver::default()
        });
        assert!(host.activate(notes_activation_request()).is_err());
        let slot = host.slot("com.mossx.notes").expect("slot");
        assert_eq!(slot.state, SlotState::Failed);
        assert!(slot.started.is_empty());
        assert_eq!(host.driver().started.len(), 1);
        assert_eq!(
            host.driver().stopped,
            vec![("com.mossx.notes".into(), "notes-worker".into(), 1)]
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_bad_nonce_cannot_leave_a_uds_socket() {
        let path = super::super::uds::private_uds_path("com.mossx.notes", "badn")
            .expect("private path");
        assert!(handshake_at(&path, "com.mossx.notes", 1, true, false).is_err());
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn a_silent_peer_cannot_leave_a_uds_socket() {
        let path = super::super::uds::private_uds_path("com.mossx.notes", "siln")
            .expect("private path");
        assert!(handshake_at(&path, "com.mossx.notes", 1, false, true).is_err());
        assert!(!path.exists());
    }

}
