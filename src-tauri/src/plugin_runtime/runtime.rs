//! In-memory composition of Host + Broker + DataPlane + Storage. Not in boot.

use std::path::PathBuf;

use super::broker::{BrokerError, CapabilityBroker, WorkspaceRead};
use super::disk_storage::DiskStorage;
use super::host::{ActivationRequest, EntryDriver, Host, HostConfig, HostError, SlotState};
use super::host_data::{disable_and_revoke, fuse_and_revoke};
use super::mxpd::DataPlane;
use super::storage::{MigrationPlan, StorageError};

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

    pub fn query(
        &self,
        plugin_id: &str,
        generation: u64,
        capability: &str,
    ) -> Result<WorkspaceRead, BrokerError> {
        self.broker
            .query(&self.host, plugin_id, generation, capability)
    }

    pub fn query_read(&self, plugin_id: &str, generation: u64) -> Result<WorkspaceRead, BrokerError> {
        self.query(plugin_id, generation, "mossx.workspace.read")
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

    fn ensure_ready(&self, plugin_id: &str) -> Result<(), StorageError> {
        let ready = self
            .host
            .slot(plugin_id)
            .is_some_and(|slot| slot.state == SlotState::Ready);
        if ready {
            Ok(())
        } else {
            Err(StorageError {
                code: "plugin-unavailable",
                message: format!("{plugin_id} is not ready"),
            })
        }
    }

    pub fn open_own_store(&mut self, plugin_id: &str) -> Result<PathBuf, StorageError> {
        self.ensure_ready(plugin_id)?;
        self.storage
            .access_file(plugin_id, plugin_id)
            .or_else(|_| self.storage.open_plugin(plugin_id, "1.0.0", "1.0.0", 1))?;
        self.storage.access_file(plugin_id, plugin_id)
    }

    pub fn checkpoint_own_store(&mut self, plugin_id: &str) -> Result<String, StorageError> {
        self.checkpoint_own_store_retained(plugin_id, 2)
    }

    pub fn checkpoint_own_store_retained(
        &mut self,
        plugin_id: &str,
        retain_previous: u32,
    ) -> Result<String, StorageError> {
        self.ensure_ready(plugin_id)?;
        self.open_own_store(plugin_id)?;
        self.storage.checkpoint(plugin_id, retain_previous)
    }

    pub fn restore_own_store(&mut self, plugin_id: &str) -> Result<u32, StorageError> {
        self.ensure_ready(plugin_id)?;
        self.storage.restore(plugin_id)
    }

    pub fn migrate_own_store(
        &mut self,
        plugin_id: &str,
        plan: MigrationPlan,
    ) -> Result<u32, StorageError> {
        self.ensure_ready(plugin_id)?;
        self.storage.migrate(plugin_id, plan)
    }

    pub fn access_store(
        &self,
        caller_id: &str,
        target_id: &str,
    ) -> Result<PathBuf, StorageError> {
        self.ensure_ready(caller_id)?;
        self.storage.access_file(caller_id, target_id)
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

    #[test]
    fn old_generation_is_rejected_after_reset_activate() {
        let root = unique_temp_root("runtime-stale");
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
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", first)
                .unwrap_err()
                .code,
            "stale-generation"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", first, 13, "blob-v1")
                .unwrap_err()
                .code,
            "stale-generation"
        );
        runtime
            .query_read("com.mossx.notes", second)
            .expect("current read");
        runtime
            .open_stream("com.mossx.notes", second, 14, "blob-v1")
            .expect("current stream");
        remove_path(&root);
    }

    #[test]
    fn checkpoint_requires_ready_plugin() {
        let root = unique_temp_root("runtime-ckpt");
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
        let id = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        assert!(id.starts_with("ckpt-"));
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .checkpoint_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn restore_requires_ready_plugin() {
        use crate::plugin_runtime::storage::MigrationPlan;

        let root = unique_temp_root("runtime-restore");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        runtime
            .storage
            .migrate(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .expect("migrate");
        assert_eq!(runtime.storage.read_schema("com.mossx.notes").unwrap(), 2);
        let schema = runtime
            .restore_own_store("com.mossx.notes")
            .expect("restore");
        assert_eq!(schema, 1);
        assert_eq!(runtime.storage.read_schema("com.mossx.notes").unwrap(), 1);
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn migrate_requires_ready_plugin() {
        let root = unique_temp_root("runtime-migrate");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        let to = runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .expect("migrate");
        assert_eq!(to, 2);
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .migrate_own_store(
                    "com.mossx.notes",
                    MigrationPlan {
                        from: 2,
                        to: 3,
                        destructive: false,
                        export_required: false,
                        confirmed: false,
                        exported: false,
                        reader_schema: 3,
                    },
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_migrate_without_checkpoint() {
        let root = unique_temp_root("runtime-migrate-no-ckpt");
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
        runtime.open_own_store("com.mossx.notes").expect("store");
        let error = runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "checkpoint-required");
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_run_unconfirmed_destructive_migrate() {
        let root = unique_temp_root("runtime-migrate-destructive");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        let error = runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: true,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "destructive-unconfirmed");
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_migrate_without_required_export() {
        let root = unique_temp_root("runtime-migrate-export");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        let error = runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: true,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "export-required");
        remove_path(&root);
    }

    #[test]
    fn old_reader_cannot_migrate_newer_store() {
        let root = unique_temp_root("runtime-migrate-quarantine");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 2,
                },
            )
            .expect("forward");
        let error = runtime
            .migrate_own_store(
                "com.mossx.notes",
                MigrationPlan {
                    from: 2,
                    to: 3,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 1,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "quarantine");
        remove_path(&root);
    }

    #[test]
    fn compose_surface_denies_cross_plugin_store_access() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-store-access");
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
            .activate(claude_activation_request())
            .expect("claude");
        runtime
            .activate(notes_activation_request())
            .expect("notes");
        let own = runtime.open_own_store("com.mossx.notes").expect("open");
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .expect("own"),
            own
        );
        assert_eq!(
            runtime
                .access_store("com.mossx.engine.claude", "com.mossx.notes")
                .unwrap_err()
                .code,
            "permission-denied"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_restore_without_checkpoint() {
        let root = unique_temp_root("runtime-restore-no-ckpt");
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
        runtime.open_own_store("com.mossx.notes").expect("store");
        assert_eq!(
            runtime
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "checkpoint-required"
        );
        remove_path(&root);
    }

    #[test]
    fn runtime_rejects_invalid_host_budget() {
        use std::time::Duration;

        let root = unique_temp_root("runtime-invalid-budget");
        let concurrent = match PluginRuntime::new(
            HostConfig {
                enabled: true,
                max_concurrent: 3,
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        ) {
            Ok(_) => panic!("concurrent budget should fail"),
            Err(error) => error,
        };
        assert_eq!(concurrent.code, "invalid-budget");
        let deadline = match PluginRuntime::new(
            HostConfig {
                enabled: true,
                activation_deadline: Duration::from_millis(31_000),
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        ) {
            Ok(_) => panic!("deadline budget should fail"),
            Err(error) => error,
        };
        assert_eq!(deadline.code, "invalid-budget");
        remove_path(&root);
    }

    #[test]
    fn checkpoint_retain_previous_must_stay_in_range() {
        let root = unique_temp_root("runtime-retain");
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
        assert_eq!(
            runtime
                .checkpoint_own_store_retained("com.mossx.notes", 0)
                .unwrap_err()
                .code,
            "invalid-storage"
        );
        assert_eq!(
            runtime
                .checkpoint_own_store_retained("com.mossx.notes", 6)
                .unwrap_err()
                .code,
            "invalid-storage"
        );
        let id = runtime
            .checkpoint_own_store_retained("com.mossx.notes", 1)
            .expect("retain 1");
        assert!(id.starts_with("ckpt-"));
        remove_path(&root);
    }

    #[test]
    fn empty_required_entries_fail_on_compose_surface() {
        let root = unique_temp_root("runtime-empty-required");
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
        let error = runtime
            .activate(ActivationRequest {
                plugin_id: "com.mossx.notes".into(),
                unit_id: "notes-main".into(),
                required_entries: Vec::new(),
            })
            .unwrap_err();
        assert_eq!(error.code, "schema");
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_migrate_with_mismatched_from() {
        let root = unique_temp_root("runtime-migrate-from");
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
        runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("ckpt");
        assert_eq!(
            runtime
                .migrate_own_store(
                    "com.mossx.notes",
                    MigrationPlan {
                        from: 2,
                        to: 3,
                        destructive: false,
                        export_required: false,
                        confirmed: false,
                        exported: false,
                        reader_schema: 3,
                    },
                )
                .unwrap_err()
                .code,
            "invalid-storage"
        );
        remove_path(&root);
    }

    #[test]
    fn disabled_plugin_cannot_access_its_store() {
        let root = unique_temp_root("runtime-access-disabled");
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
        let store = runtime.open_own_store("com.mossx.notes").expect("open");
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert!(store.exists());
        remove_path(&root);
    }

    #[test]
    fn fused_plugin_cannot_access_its_store() {
        let root = unique_temp_root("runtime-access-fused");
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
        let store = runtime.open_own_store("com.mossx.notes").expect("open");
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert!(store.exists());
        remove_path(&root);
    }

    #[test]
    fn reset_after_fuse_restores_access_store() {
        let root = unique_temp_root("runtime-access-reset");
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
            .expect("first");
        let store = runtime.open_own_store("com.mossx.notes").expect("open");
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime
            .activate(notes_activation_request())
            .expect("second");
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .expect("restored"),
            store
        );
        remove_path(&root);
    }

    #[test]
    fn fused_plugin_cannot_checkpoint() {
        let root = unique_temp_root("runtime-ckpt-fused");
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
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        assert_eq!(
            runtime
                .checkpoint_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn fused_plugin_cannot_migrate() {
        let root = unique_temp_root("runtime-migrate-fused");
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
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        assert_eq!(
            runtime
                .migrate_own_store(
                    "com.mossx.notes",
                    MigrationPlan {
                        from: 1,
                        to: 2,
                        destructive: false,
                        export_required: false,
                        confirmed: false,
                        exported: false,
                        reader_schema: 2,
                    },
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn fused_plugin_cannot_restore() {
        let root = unique_temp_root("runtime-restore-fused");
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
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        assert_eq!(
            runtime
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn never_activated_plugin_cannot_use_storage_apis() {
        let root = unique_temp_root("runtime-never-activated");
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
        assert_eq!(
            runtime
                .open_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .checkpoint_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .migrate_own_store(
                    "com.mossx.notes",
                    MigrationPlan {
                        from: 1,
                        to: 2,
                        destructive: false,
                        export_required: false,
                        confirmed: false,
                        exported: false,
                        reader_schema: 2,
                    },
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn disabled_host_cannot_use_storage_apis() {
        let root = unique_temp_root("runtime-host-off-store");
        let mut runtime = PluginRuntime::new(
            HostConfig::default(),
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        assert_eq!(
            runtime
                .open_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .checkpoint_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .migrate_own_store(
                    "com.mossx.notes",
                    MigrationPlan {
                        from: 1,
                        to: 2,
                        destructive: false,
                        export_required: false,
                        confirmed: false,
                        exported: false,
                        reader_schema: 2,
                    },
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn disabled_host_cannot_query_or_open_stream() {
        let root = unique_temp_root("runtime-host-off-handles");
        let mut runtime = PluginRuntime::new(
            HostConfig::default(),
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", 1)
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", 1, 21, "blob-v1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn never_activated_plugin_cannot_query_or_open_stream() {
        let root = unique_temp_root("runtime-never-handles");
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
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", 1)
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", 1, 22, "blob-v1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_write_or_spawn_through_compose_surface() {
        let root = unique_temp_root("runtime-readonly-broker");
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
        runtime
            .query_read("com.mossx.notes", generation)
            .expect("read");
        assert_eq!(
            runtime
                .query("com.mossx.notes", generation, "mossx.workspace.write")
                .unwrap_err()
                .code,
            "permission-denied"
        );
        assert_eq!(
            runtime
                .query("com.mossx.notes", generation, "mossx.process.spawn")
                .unwrap_err()
                .code,
            "permission-denied"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_query_unknown_capability() {
        let root = unique_temp_root("runtime-unknown-cap");
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
        assert_eq!(
            runtime
                .query("com.mossx.notes", generation, "mossx.filesystem.raw")
                .unwrap_err()
                .code,
            "permission-denied"
        );
        remove_path(&root);
    }

    #[test]
    fn failed_activation_cannot_receive_composed_handles() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-handles");
        let mut driver = FakeDriver::default();
        driver
            .fail_on
            .insert("notes-ui".into(), DriverError::Timeout);
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "activation-timeout"
        );
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", 1)
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", 1, 23, "blob-v1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn crashed_activation_cannot_receive_composed_handles() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-crash-handles");
        let mut driver = FakeDriver::default();
        driver
            .fail_on
            .insert("notes-ui".into(), DriverError::Crash);
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "activation-failed"
        );
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", 1)
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", 1, 24, "blob-v1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }
}
