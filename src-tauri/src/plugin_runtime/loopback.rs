//! In-memory MXPC handshake driver. No sockets.

use serde_json::{json, Value};

use super::host::{DriverError, EntryDriver};
use super::ipc::{decode_mxpc, encode_mxpc, validate_handshake_ack, validate_handshake_hello};

const NONCE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[derive(Debug, Default)]
pub struct LoopbackDriver {
    pub corrupt_ack_on: Option<String>,
    pub started: Vec<(String, String, u64)>,
    pub stopped: Vec<(String, String, u64)>,
}

fn hello(generation: u64) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "method": "mossx.handshake.hello",
        "params": {
            "protocolVersion": 1,
            "coreContract": "1.0.0",
            "nonce": NONCE,
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

impl LoopbackDriver {
    fn handshake(&self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        let encoded_hello = encode_mxpc(&hello(generation)).map_err(|_| DriverError::Crash)?;
        let (decoded_hello, _) = decode_mxpc(&encoded_hello).map_err(|_| DriverError::Crash)?;
        validate_handshake_hello(&decoded_hello).map_err(|_| DriverError::Crash)?;

        let nonce = if self.corrupt_ack_on.as_deref() == Some(entry_id) {
            "bb".repeat(32)
        } else {
            NONCE.to_string()
        };
        let encoded_ack = encode_mxpc(&ack(plugin_id, generation, &nonce)).map_err(|_| DriverError::Crash)?;
        let (decoded_ack, _) = decode_mxpc(&encoded_ack).map_err(|_| DriverError::Crash)?;
        validate_handshake_ack(&decoded_ack, NONCE).map_err(|_| DriverError::Crash)?;
        Ok(())
    }
}

impl EntryDriver for LoopbackDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        self.handshake(plugin_id, entry_id, generation)?;
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
    use crate::plugin_runtime::host::{ActivationRequest, Host, HostConfig, SlotState};

    fn notes_request() -> ActivationRequest {
        ActivationRequest {
            plugin_id: "com.mossx.notes".into(),
            unit_id: "notes-main".into(),
            required_entries: vec!["notes-worker".into(), "notes-ui".into()],
        }
    }

    fn enabled_host(driver: LoopbackDriver) -> Host<LoopbackDriver> {
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
    fn loopback_handshake_becomes_ready() {
        let mut host = enabled_host(LoopbackDriver::default());
        let generation = host.activate(notes_request()).expect("activate");
        assert_eq!(generation, 1);
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        host.dispatch("com.mossx.notes", 1).expect("current");
    }

    #[test]
    fn loopback_nonce_mismatch_rolls_back() {
        let mut host = enabled_host(LoopbackDriver {
            corrupt_ack_on: Some("notes-ui".into()),
            ..LoopbackDriver::default()
        });
        assert!(host.activate(notes_request()).is_err());
        let slot = host.slot("com.mossx.notes").expect("slot");
        assert_eq!(slot.state, SlotState::Failed);
        assert!(slot.started.is_empty());
        assert_eq!(host.driver().started.len(), 1);
        assert_eq!(
            host.driver().stopped,
            vec![("com.mossx.notes".into(), "notes-worker".into(), 1)]
        );
    }
}
