//! Read-only Capability Broker stub. No real filesystem.

use super::host::{EntryDriver, Host, HostError, SlotState};

const READ: &str = "mossx.workspace.read";
const WRITE: &str = "mossx.workspace.write";
const SPAWN: &str = "mossx.process.spawn";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrokerError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> BrokerError {
    BrokerError {
        code,
        message: message.into(),
    }
}

impl From<HostError> for BrokerError {
    fn from(value: HostError) -> Self {
        err(value.code, value.message)
    }
}

#[derive(Debug, Clone)]
pub struct WorkspaceRead {
    pub plugin_id: String,
    pub workspace_root: String,
}

pub struct CapabilityBroker {
    workspace_root: String,
}

impl CapabilityBroker {
    pub fn new(workspace_root: impl Into<String>) -> Self {
        Self {
            workspace_root: workspace_root.into(),
        }
    }

    pub fn query<D: EntryDriver>(
        &self,
        host: &Host<D>,
        plugin_id: &str,
        generation: u64,
        capability: &str,
    ) -> Result<WorkspaceRead, BrokerError> {
        host.dispatch(plugin_id, generation)?;
        let slot = host
            .slot(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "plugin is not loaded"))?;
        if slot.state != SlotState::Ready {
            return Err(err("plugin-unavailable", "plugin is not ready"));
        }
        match capability {
            READ => Ok(WorkspaceRead {
                plugin_id: plugin_id.to_string(),
                workspace_root: self.workspace_root.clone(),
            }),
            WRITE | SPAWN => Err(err(
                "permission-denied",
                format!("{capability} is not granted to the V1 read-only broker"),
            )),
            other => Err(err(
                "permission-denied",
                format!("unknown or unauthorized capability {other}"),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::host::{ActivationRequest, FakeDriver, Host, HostConfig};

    fn ready_host() -> Host<FakeDriver> {
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        host.activate(ActivationRequest {
            plugin_id: "com.mossx.notes".into(),
            unit_id: "notes-main".into(),
            required_entries: vec!["notes-worker".into()],
        })
        .expect("activate");
        host
    }

    #[test]
    fn ready_plugin_can_read_fixture_workspace() {
        let host = ready_host();
        let broker = CapabilityBroker::new("/fixture/workspace");
        let read = broker
            .query(&host, "com.mossx.notes", 1, READ)
            .expect("read");
        assert_eq!(read.workspace_root, "/fixture/workspace");
        assert_eq!(read.plugin_id, "com.mossx.notes");
    }

    #[test]
    fn write_or_stale_generation_is_denied() {
        let host = ready_host();
        let broker = CapabilityBroker::new("/fixture/workspace");
        assert_eq!(
            broker
                .query(&host, "com.mossx.notes", 1, WRITE)
                .unwrap_err()
                .code,
            "permission-denied"
        );
        assert_eq!(
            broker
                .query(&host, "com.mossx.notes", 9, READ)
                .unwrap_err()
                .code,
            "stale-generation"
        );
        assert_eq!(
            broker
                .query(&host, "com.mossx.notes", 1, "mossx.filesystem.raw")
                .unwrap_err()
                .code,
            "permission-denied"
        );
    }
}
