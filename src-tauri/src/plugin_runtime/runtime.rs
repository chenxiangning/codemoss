//! In-memory composition of Host + Broker + DataPlane + Storage. Not in boot.

use std::path::PathBuf;

use super::broker::{BrokerError, CapabilityBroker, WorkspaceRead};
use super::disk_storage::DiskStorage;
use super::host::{ActivationRequest, EntryDriver, Host, HostConfig, HostError, SlotState};
use super::host_data::disable_and_revoke;
use super::mxpd::DataPlane;
use super::storage::StorageError;

pub struct PluginRuntime<D: EntryDriver> {
    pub host: Host<D>,
    pub broker: CapabilityBroker,
    pub plane: DataPlane,
    pub storage: DiskStorage,
}

impl<D: EntryDriver> PluginRuntime<D> {
    pub fn new(
        config: HostConfig,
        driver: D,
        workspace_root: impl Into<String>,
        storage_root: impl Into<PathBuf>,
    ) -> Result<Self, HostError> {
        Ok(Self {
            host: Host::new(config, driver)?,
            broker: CapabilityBroker::new(workspace_root),
            plane: DataPlane::default(),
            storage: DiskStorage::open(storage_root).map_err(|error| HostError {
                code: "invalid-storage",
                message: error.message,
            })?,
        })
    }

    pub fn activate(&mut self, request: ActivationRequest) -> Result<u64, HostError> {
        self.host.activate(request)
    }

    pub fn query_read(&self, plugin_id: &str, generation: u64) -> Result<WorkspaceRead, BrokerError> {
        self.broker
            .query(&self.host, plugin_id, generation, "mossx.workspace.read")
    }

    pub fn open_stream(
        &mut self,
        plugin_id: &str,
        generation: u64,
        stream_id: u32,
        codec: &str,
    ) -> Result<(), super::ipc::IpcError> {
        self.host.dispatch(plugin_id, generation).map_err(|error| {
            super::ipc::IpcError {
                code: error.code,
                message: error.message,
            }
        })?;
        self.plane.open(plugin_id, generation, stream_id, codec)
    }

    pub fn disable_plugin(&mut self, plugin_id: &str) -> Result<(), HostError> {
        disable_and_revoke(&mut self.host, &mut self.plane, plugin_id)
    }

    pub fn open_own_store(&mut self, plugin_id: &str) -> Result<PathBuf, StorageError> {
        self.storage
            .access_file(plugin_id, plugin_id)
            .or_else(|_| self.storage.open_plugin(plugin_id, "1.0.0", "1.0.0", 1))?;
        self.storage.access_file(plugin_id, plugin_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::disk_storage::{remove_path, unique_temp_root};
    use crate::plugin_runtime::host::FakeDriver;
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    #[test]
    fn notes_fixture_can_be_activated_queried_streamed_then_disabled() {
        let root = unique_temp_root("runtime");
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        let generation = runtime
            .activate(notes_activation_request())
            .expect("activate");
        let read = runtime
            .query_read("com.mossx.notes", generation)
            .expect("read");
        assert_eq!(read.workspace_root, "/fixture/workspace");
        runtime
            .open_stream("com.mossx.notes", generation, 4, "blob-v1")
            .expect("stream");
        assert_eq!(runtime.plane.codec(4), Some("blob-v1"));
        let store = runtime.open_own_store("com.mossx.notes").expect("store");
        assert!(store.ends_with("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Disabled
        );
        assert!(runtime.query_read("com.mossx.notes", generation).is_err());
        assert!(runtime.plane.codec(4).is_none());
        remove_path(&root);
    }

    #[test]
    fn default_host_config_is_disabled() {
        assert!(!HostConfig::default().enabled);
        let root = unique_temp_root("runtime-off");
        let mut runtime = PluginRuntime::new(
            HostConfig::default(),
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "host-disabled"
        );
        remove_path(&root);
    }

    #[test]
    fn boot_source_does_not_construct_the_runtime() {
        let boot = include_str!("../lib.rs");
        assert!(!boot.contains("PluginRuntime::new"));
        assert!(!boot.contains("Host::new"));
        assert!(boot.contains("mod plugin_runtime"));
    }
}
