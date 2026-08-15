//! Host EntryDriver over Named Pipe. Fail-closed off Windows. Not in boot.

use super::host::{DriverError, EntryDriver};
use super::named_pipe::{pipe_acl_ok, pipe_name_ok};

const CURRENT_USER: &str = "S-1-5-21-1-2-3-1001";

pub struct NamedPipeHandshakeDriver {
    pub pipe_name: String,
    pub owner_sid: String,
    pub allow_sids: Vec<String>,
    pub started: Vec<(String, String, u64)>,
    pub stopped: Vec<(String, String, u64)>,
}

impl Default for NamedPipeHandshakeDriver {
    fn default() -> Self {
        Self {
            pipe_name: r"\\.\pipe\mossx-host".into(),
            owner_sid: CURRENT_USER.into(),
            allow_sids: vec![CURRENT_USER.into()],
            started: Vec::new(),
            stopped: Vec::new(),
        }
    }
}

impl NamedPipeHandshakeDriver {
    fn gate(&self) -> Result<(), DriverError> {
        if !pipe_name_ok(&self.pipe_name) {
            return Err(DriverError::Crash);
        }
        let allow: Vec<&str> = self.allow_sids.iter().map(String::as_str).collect();
        pipe_acl_ok(&self.owner_sid, &allow).map_err(|_| DriverError::Crash)?;
        Ok(())
    }
}

#[cfg(windows)]
fn handshake(
    driver: &NamedPipeHandshakeDriver,
    plugin_id: &str,
    generation: u64,
) -> Result<(), DriverError> {
    use serde_json::json;
    use std::thread;

    use super::ipc::{issue_handshake_nonce, validate_handshake_ack, validate_handshake_hello};
    use super::named_pipe::bind_named_pipe_secured;
    use super::uds::{read_mxpc_frame, write_mxpc_frame};

    let nonce = issue_handshake_nonce();
    let peer_nonce = nonce.clone();
    let peer_plugin = plugin_id.to_string();
    let allow: Vec<&str> = driver.allow_sids.iter().map(String::as_str).collect();
    let server = bind_named_pipe_secured(&driver.pipe_name, &driver.owner_sid, &allow)
        .map_err(|_| DriverError::Crash)?;
    let peer = thread::spawn(move || {
        let mut stream = server.accept().map_err(|_| ())?;
        let received = read_mxpc_frame(&mut stream).map_err(|_| ())?;
        validate_handshake_hello(&received, generation, &peer_nonce).map_err(|_| ())?;
        write_mxpc_frame(
            &mut stream,
            &json!({
                "jsonrpc": "2.0",
                "id": "hs-1",
                "result": {
                    "protocolVersion": 1,
                    "pluginId": peer_plugin,
                    "version": "1.0.0",
                    "generation": generation,
                    "nonce": peer_nonce
                }
            }),
        )
        .map_err(|_| ())?;
        Ok::<(), ()>(())
    });
    let mut client =
        super::named_pipe::connect_named_pipe(&driver.pipe_name).map_err(|_| DriverError::Crash)?;
    write_mxpc_frame(
        &mut client,
        &json!({
            "jsonrpc": "2.0",
            "id": "hs-1",
            "method": "mossx.handshake.hello",
            "params": {
                "protocolVersion": 1,
                "coreContract": "1.0.0",
                "nonce": nonce,
                "generation": generation
            }
        }),
    )
    .map_err(|_| DriverError::Crash)?;
    let received = read_mxpc_frame(&mut client).map_err(|_| DriverError::Crash)?;
    let result = validate_handshake_ack(&received, &nonce, plugin_id, generation)
        .map_err(|_| DriverError::Crash);
    let _ = peer.join();
    result
}

#[cfg(not(windows))]
fn handshake(
    _driver: &NamedPipeHandshakeDriver,
    _plugin_id: &str,
    _generation: u64,
) -> Result<(), DriverError> {
    Err(DriverError::Crash)
}

impl EntryDriver for NamedPipeHandshakeDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        self.gate()?;
        handshake(self, plugin_id, generation)?;
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

    fn enabled_host(driver: NamedPipeHandshakeDriver) -> Host<NamedPipeHandshakeDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_host_cannot_activate_over_named_pipe() {
        let mut host = enabled_host(NamedPipeHandshakeDriver::default());
        assert!(host.activate(notes_activation_request()).is_err());
        let slot = host.slot("com.mossx.notes").expect("slot");
        assert_eq!(slot.state, SlotState::Failed);
        assert!(host.driver().started.is_empty());
    }

    #[test]
    fn open_named_pipe_acl_cannot_start() {
        let mut driver = NamedPipeHandshakeDriver::default();
        driver.allow_sids = vec!["S-1-1-0".into()];
        let mut host = enabled_host(driver);
        assert!(host.activate(notes_activation_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        assert!(host.driver().started.is_empty());
    }

    #[test]
    fn illegal_pipe_name_cannot_start() {
        let mut driver = NamedPipeHandshakeDriver::default();
        driver.pipe_name = r"\\.\pipe\other".into();
        let mut host = enabled_host(driver);
        assert!(host.activate(notes_activation_request()).is_err());
        assert!(host.driver().started.is_empty());
    }
}
