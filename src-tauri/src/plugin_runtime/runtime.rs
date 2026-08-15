//! In-memory composition of Host + Broker + DataPlane + Storage. Not in boot.

use std::path::PathBuf;

use super::broker::{BrokerError, CapabilityBroker, WorkspaceRead};
use super::disk_storage::DiskStorage;
use super::host::{ActivationRequest, EntryDriver, Host, HostConfig, HostError, SlotState};
use super::host_data::{disable_and_revoke, fuse_and_revoke};
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

    pub fn fuse_plugin(&mut self, plugin_id: &str) -> Result<(), HostError> {
        fuse_and_revoke(&mut self.host, &mut self.plane, plugin_id)
    }

    pub fn reset_plugin(&mut self, plugin_id: &str) -> Result<(), HostError> {
        self.host.reset(plugin_id)
    }

    pub fn open_own_store(&mut self, plugin_id: &str) -> Result<PathBuf, StorageError> {
        let ready = self
            .host
            .slot(plugin_id)
            .is_some_and(|slot| slot.state == SlotState::Ready);
        if !ready {
            return Err(StorageError {
                code: "plugin-unavailable",
                message: format!("{plugin_id} is not ready"),
            });
        }
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

    #[test]
    fn command_registry_keeps_product_notes_and_hides_runtime() {
        let registry = include_str!("../command_registry.rs");
        for command in [
            "note_card_list",
            "note_card_get",
            "note_card_create",
            "note_card_update",
            "note_card_archive",
            "note_card_restore",
            "note_card_delete",
        ] {
            assert!(registry.contains(command), "{command}");
        }
        assert!(!registry.contains("plugin_runtime"));
        assert!(!registry.contains("PluginRuntime"));
    }

    #[test]
    fn two_pilots_stay_isolated_in_one_runtime() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-dual");
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
        let claude_gen = runtime
            .activate(claude_activation_request())
            .expect("claude");
        let notes_gen = runtime.activate(notes_activation_request()).expect("notes");
        runtime
            .open_stream("com.mossx.engine.claude", claude_gen, 1, "engine-event-v1")
            .expect("claude stream");
        runtime
            .open_stream("com.mossx.notes", notes_gen, 2, "blob-v1")
            .expect("notes stream");
        runtime
            .open_own_store("com.mossx.notes")
            .expect("notes store");
        let denied = runtime
            .storage
            .access_file("com.mossx.engine.claude", "com.mossx.notes")
            .unwrap_err();
        assert_eq!(denied.code, "permission-denied");
        runtime.disable_plugin("com.mossx.notes").expect("disable notes");
        assert!(runtime.plane.codec(2).is_none());
        assert_eq!(runtime.plane.codec(1), Some("engine-event-v1"));
        remove_path(&root);
    }

    #[test]
    fn disabled_plugin_cannot_reopen_its_store() {
        let root = unique_temp_root("runtime-store-off");
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
        runtime
            .activate(notes_activation_request())
            .expect("activate");
        let store = runtime.open_own_store("com.mossx.notes").expect("store");
        assert!(store.exists());
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        let error = runtime.open_own_store("com.mossx.notes").unwrap_err();
        assert_eq!(error.code, "plugin-unavailable");
        assert!(store.exists());
        runtime.host.reset("com.mossx.notes").expect("reset");
        runtime
            .activate(notes_activation_request())
            .expect("reactivate");
        let again = runtime.open_own_store("com.mossx.notes").expect("reopen");
        assert_eq!(again, store);
        remove_path(&root);
    }

    #[test]
    fn disabled_claude_cannot_use_composed_handles() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;
        use std::path::Path;

        let root = unique_temp_root("runtime-claude-off");
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
            .activate(claude_activation_request())
            .expect("activate");
        runtime
            .open_own_store("com.mossx.engine.claude")
            .expect("store");
        runtime
            .open_stream("com.mossx.engine.claude", generation, 8, "engine-event-v1")
            .expect("stream");
        runtime
            .disable_plugin("com.mossx.engine.claude")
            .expect("disable");
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
            .open_stream("com.mossx.engine.claude", generation, 9, "engine-event-v1")
            .is_err());
        assert!(runtime.plane.codec(8).is_none());
        assert!(Path::new("src/engine/claude.rs").exists());
        remove_path(&root);
    }

    #[test]
    fn disabled_notes_cannot_use_composed_handles() {
        use std::path::Path;

        let root = unique_temp_root("runtime-notes-off");
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
        runtime.open_own_store("com.mossx.notes").expect("store");
        runtime
            .open_stream("com.mossx.notes", generation, 5, "blob-v1")
            .expect("stream");
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert!(runtime.query_read("com.mossx.notes", generation).is_err());
        assert_eq!(
            runtime.open_own_store("com.mossx.notes").unwrap_err().code,
            "plugin-unavailable"
        );
        assert!(runtime
            .open_stream("com.mossx.notes", generation, 6, "blob-v1")
            .is_err());
        assert!(runtime.plane.codec(5).is_none());
        assert!(Path::new("src/note_cards.rs").exists());
        remove_path(&root);
    }

    #[test]
    fn fused_plugin_cannot_use_composed_handles_or_reactivate() {
        let root = unique_temp_root("runtime-fuse");
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
        runtime.open_own_store("com.mossx.notes").expect("store");
        runtime
            .open_stream("com.mossx.notes", generation, 7, "blob-v1")
            .expect("stream");
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Fused
        );
        assert!(runtime.query_read("com.mossx.notes", generation).is_err());
        assert_eq!(
            runtime.open_own_store("com.mossx.notes").unwrap_err().code,
            "plugin-unavailable"
        );
        assert!(runtime
            .open_stream("com.mossx.notes", generation, 8, "blob-v1")
            .is_err());
        assert_eq!(
            runtime.activate(notes_activation_request()).unwrap_err().code,
            "fused"
        );
        remove_path(&root);
    }

    #[test]
    fn reset_after_fuse_restores_composed_handles() {
        let root = unique_temp_root("runtime-fuse-reset");
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
        let first = runtime
            .activate(notes_activation_request())
            .expect("first");
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        let second = runtime
            .activate(notes_activation_request())
            .expect("second");
        assert!(second > first);
        runtime
            .query_read("com.mossx.notes", second)
            .expect("read");
        runtime.open_own_store("com.mossx.notes").expect("store");
        runtime
            .open_stream("com.mossx.notes", second, 12, "blob-v1")
            .expect("stream");
        assert_eq!(runtime.plane.codec(12), Some("blob-v1"));
        remove_path(&root);
    }
}
