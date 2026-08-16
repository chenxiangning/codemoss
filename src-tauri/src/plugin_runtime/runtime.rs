//! In-memory composition of Host + Broker + DataPlane + Storage. Not in boot.

use std::path::PathBuf;

use super::broker::{BrokerError, CapabilityBroker, WorkspaceRead};
use super::disk_storage::DiskStorage;
use super::host::{ActivationRequest, EntryDriver, Host, HostConfig, HostError, SlotState};
use super::host_data::{disable_and_revoke, fuse_and_revoke, uninstall_and_revoke};
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
        let previous = self
            .host
            .slot(&request.plugin_id)
            .map(|slot| (slot.generation, slot.state));
        let generation = self.host.activate(request.clone())?;
        if let Some((old_generation, state)) = previous {
            if old_generation > 0 && state == SlotState::Ready {
                self.plane.revoke(&request.plugin_id, old_generation);
            }
        }
        Ok(generation)
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

    pub fn uninstall_plugin(&mut self, plugin_id: &str) -> Result<(), HostError> {
        uninstall_and_revoke(&mut self.host, &mut self.plane, plugin_id)
    }

    pub fn reset_plugin(&mut self, plugin_id: &str) -> Result<(), HostError> {
        let generation = self
            .host
            .slot(plugin_id)
            .map(|slot| slot.generation)
            .unwrap_or(0);
        self.host.reset(plugin_id)?;
        if generation > 0 {
            self.plane.revoke(plugin_id, generation);
        }
        Ok(())
    }

    fn ensure_ready(&self, plugin_id: &str) -> Result<(), StorageError> {
        if plugin_id.trim().is_empty() || plugin_id != plugin_id.trim() {
            return Err(StorageError {
                code: "schema",
                message: "pluginId must be canonical".into(),
            });
        }
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
        if target_id.trim().is_empty() || target_id != target_id.trim() {
            return Err(StorageError {
                code: "schema",
                message: "targetId must be canonical".into(),
            });
        }
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

    #[test]
    fn reset_after_failed_activation_restores_handles() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-reset");
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
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime.host.test_driver_mut().fail_on.clear();
        let generation = runtime
            .activate(notes_activation_request())
            .expect("second");
        assert!(generation > 1);
        runtime
            .query_read("com.mossx.notes", generation)
            .expect("read");
        runtime
            .open_stream("com.mossx.notes", generation, 25, "blob-v1")
            .expect("stream");
        runtime.open_own_store("com.mossx.notes").expect("store");
        remove_path(&root);
    }

    #[test]
    fn failed_plugin_cannot_activate_until_reset() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-until-reset");
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
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "failed"
        );
        remove_path(&root);
    }

    #[test]
    fn compose_surface_cannot_exceed_concurrent_activation_budget() {
        let root = unique_temp_root("runtime-activation-busy");
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                max_concurrent: 2,
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        )
        .expect("runtime");
        runtime.host.test_set_inflight(2);
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "activation-busy"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_reactivate_swaps_generation_and_revokes_old_handles() {
        let root = unique_temp_root("runtime-ready-swap");
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
        runtime
            .query_read("com.mossx.notes", first)
            .expect("first read");
        runtime
            .open_stream("com.mossx.notes", first, 26, "blob-v1")
            .expect("first stream");
        assert_eq!(runtime.plane.codec(26), Some("blob-v1"));
        let second = runtime
            .activate(notes_activation_request())
            .expect("second");
        assert!(second > first);
        assert!(runtime.plane.codec(26).is_none());
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", first)
                .unwrap_err()
                .code,
            "stale-generation"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", first, 27, "blob-v1")
                .unwrap_err()
                .code,
            "stale-generation"
        );
        runtime
            .query_read("com.mossx.notes", second)
            .expect("second read");
        runtime
            .open_stream("com.mossx.notes", second, 27, "blob-v1")
            .expect("second stream");
        assert_eq!(runtime.plane.codec(27), Some("blob-v1"));
        remove_path(&root);
    }

    #[test]
    fn reset_plugin_revokes_leftover_streams() {
        let root = unique_temp_root("runtime-reset-revoke");
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
            .open_stream("com.mossx.notes", generation, 28, "blob-v1")
            .expect("stream");
        assert_eq!(runtime.plane.codec(28), Some("blob-v1"));
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        assert!(runtime.plane.codec(28).is_none());
        assert_eq!(
            runtime
                .query_read("com.mossx.notes", generation)
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", generation, 29, "blob-v1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn disabled_plugin_cannot_activate_until_reset() {
        let root = unique_temp_root("runtime-disabled-until-reset");
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
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "disabled"
        );
        remove_path(&root);
    }

    #[test]
    fn reset_after_disable_restores_composed_handles() {
        let root = unique_temp_root("runtime-disabled-reset");
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
        runtime
            .open_stream("com.mossx.notes", first, 30, "blob-v1")
            .expect("first stream");
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        let second = runtime
            .activate(notes_activation_request())
            .expect("second");
        assert!(second > first);
        runtime
            .query_read("com.mossx.notes", second)
            .expect("read");
        runtime
            .open_stream("com.mossx.notes", second, 31, "blob-v1")
            .expect("stream");
        runtime.open_own_store("com.mossx.notes").expect("store");
        remove_path(&root);
    }

    #[test]
    fn disabled_plugin_cannot_checkpoint_migrate_or_restore() {
        let root = unique_temp_root("runtime-disabled-lifecycle");
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
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        assert_eq!(
            runtime
                .checkpoint_own_store("com.mossx.notes")
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
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn ninth_stream_in_one_generation_is_refused() {
        let root = unique_temp_root("runtime-stream-budget");
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
        for stream_id in 40..48 {
            runtime
                .open_stream("com.mossx.notes", generation, stream_id, "blob-v1")
                .expect("within budget");
        }
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", generation, 48, "blob-v1")
                .unwrap_err()
                .code,
            "stream-budget"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_open_unknown_codec() {
        let root = unique_temp_root("runtime-unknown-codec");
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
                .open_stream("com.mossx.notes", generation, 49, "custom-pack")
                .unwrap_err()
                .code,
            "unknown-codec"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_reopen_the_same_stream_id() {
        let root = unique_temp_root("runtime-stream-exists");
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
            .open_stream("com.mossx.notes", generation, 50, "blob-v1")
            .expect("first");
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", generation, 50, "log-v1")
                .unwrap_err()
                .code,
            "stream-exists"
        );
        assert_eq!(runtime.plane.codec(50), Some("blob-v1"));
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_query_remaining_brokered_capabilities() {
        let root = unique_temp_root("runtime-brokered-denied");
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
        for capability in [
            "mossx.git.read",
            "mossx.git.write",
            "mossx.network.fetch",
            "mossx.storage.readwrite",
        ] {
            assert_eq!(
                runtime
                    .query("com.mossx.notes", generation, capability)
                    .unwrap_err()
                    .code,
                "permission-denied",
                "{capability}"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_query_provider_slot_or_private_capabilities() {
        let root = unique_temp_root("runtime-provider-denied");
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
        for capability in [
            "mossx.engine.provider",
            "mossx.ui.slot.workspace.main",
            "com.mossx.notes.private",
        ] {
            assert_eq!(
                runtime
                    .query("com.mossx.notes", generation, capability)
                    .unwrap_err()
                    .code,
                "permission-denied",
                "{capability}"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn claude_cannot_occupy_a_notes_stream_id() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-cross-stream");
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
        let notes_gen = runtime
            .activate(notes_activation_request())
            .expect("notes");
        let claude_gen = runtime
            .activate(claude_activation_request())
            .expect("claude");
        runtime
            .open_stream("com.mossx.notes", notes_gen, 51, "blob-v1")
            .expect("notes stream");
        assert_eq!(
            runtime
                .open_stream("com.mossx.engine.claude", claude_gen, 51, "engine-event-v1")
                .unwrap_err()
                .code,
            "stream-exists"
        );
        assert_eq!(runtime.plane.codec(51), Some("blob-v1"));
        remove_path(&root);
    }

    #[test]
    fn runtime_rejects_subsecond_activation_deadline() {
        use std::time::Duration;

        let root = unique_temp_root("runtime-deadline-floor");
        let error = match PluginRuntime::new(
            HostConfig {
                enabled: true,
                activation_deadline: Duration::from_millis(200),
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        ) {
            Ok(_) => panic!("subsecond deadline should fail"),
            Err(error) => error,
        };
        assert_eq!(error.code, "invalid-budget");
        remove_path(&root);
    }

    #[test]
    fn runtime_rejects_zero_concurrent_activation_budget() {
        let root = unique_temp_root("runtime-concurrent-floor");
        let error = match PluginRuntime::new(
            HostConfig {
                enabled: true,
                max_concurrent: 0,
                ..HostConfig::default()
            },
            FakeDriver::default(),
            "/fixture/workspace",
            &root,
        ) {
            Ok(_) => panic!("zero concurrent budget should fail"),
            Err(error) => error,
        };
        assert_eq!(error.code, "invalid-budget");
        remove_path(&root);
    }

    #[test]
    fn reset_after_crash_restores_composed_handles() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-crash-reset");
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
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime.host.test_driver_mut().fail_on.clear();
        let generation = runtime
            .activate(notes_activation_request())
            .expect("second");
        assert!(generation > 1);
        runtime
            .query_read("com.mossx.notes", generation)
            .expect("read");
        runtime
            .open_stream("com.mossx.notes", generation, 52, "blob-v1")
            .expect("stream");
        runtime.open_own_store("com.mossx.notes").expect("store");
        remove_path(&root);
    }

    #[test]
    fn crashed_plugin_cannot_activate_until_reset() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-crash-until-reset");
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
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "failed"
        );
        remove_path(&root);
    }

    #[test]
    fn failed_plugin_cannot_checkpoint_migrate_or_restore() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-lifecycle");
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
            runtime
                .checkpoint_own_store("com.mossx.notes")
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
                .restore_own_store("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn failed_plugin_cannot_access_its_store() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-access");
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
            runtime
                .access_store("com.mossx.notes", "com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn reset_after_failed_activation_restores_store_apis() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-failed-store-reset");
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
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime.host.test_driver_mut().fail_on.clear();
        runtime
            .activate(notes_activation_request())
            .expect("second");
        runtime.open_own_store("com.mossx.notes").expect("open");
        runtime
            .access_store("com.mossx.notes", "com.mossx.notes")
            .expect("access");
        let checkpoint = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("checkpoint");
        assert!(checkpoint.starts_with("ckpt-"));
        remove_path(&root);
    }

    #[test]
    fn reset_after_disable_restores_store_lifecycle() {
        let root = unique_temp_root("runtime-disabled-store-reset");
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
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime
            .activate(notes_activation_request())
            .expect("second");
        runtime.open_own_store("com.mossx.notes").expect("open");
        let checkpoint = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("checkpoint");
        assert!(checkpoint.starts_with("ckpt-"));
        remove_path(&root);
    }

    #[test]
    fn reset_after_fuse_restores_checkpoint() {
        let root = unique_temp_root("runtime-fuse-store-reset");
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
        runtime.fuse_plugin("com.mossx.notes").expect("fuse");
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        runtime
            .activate(notes_activation_request())
            .expect("second");
        runtime.open_own_store("com.mossx.notes").expect("open");
        let checkpoint = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("checkpoint");
        assert!(checkpoint.starts_with("ckpt-"));
        remove_path(&root);
    }

    #[test]
    fn fuse_claude_keeps_notes_stream() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-fuse-isolation");
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
            .open_stream("com.mossx.engine.claude", claude_gen, 61, "engine-event-v1")
            .expect("claude stream");
        runtime
            .open_stream("com.mossx.notes", notes_gen, 62, "blob-v1")
            .expect("notes stream");
        runtime.open_own_store("com.mossx.notes").expect("notes store");
        runtime
            .fuse_plugin("com.mossx.engine.claude")
            .expect("fuse claude");
        assert!(runtime.plane.codec(61).is_none());
        assert_eq!(runtime.plane.codec(62), Some("blob-v1"));
        runtime
            .query_read("com.mossx.notes", notes_gen)
            .expect("notes read");
        runtime.open_own_store("com.mossx.notes").expect("notes store still");
        assert!(runtime
            .query_read("com.mossx.engine.claude", claude_gen)
            .is_err());
        remove_path(&root);
    }

    #[test]
    fn activating_plugin_is_fail_closed_on_compose_surface() {
        let root = unique_temp_root("runtime-activating-busy");
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
            .host
            .test_force_state("com.mossx.notes", SlotState::Activating, 1);
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "activation-busy"
        );
        assert_eq!(
            runtime.reset_plugin("com.mossx.notes").unwrap_err().code,
            "activation-busy"
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
                .open_stream("com.mossx.notes", 1, 71, "blob-v1")
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
    fn activating_plugin_cannot_be_fused_or_disabled() {
        let root = unique_temp_root("runtime-activating-lifecycle");
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
            .host
            .test_force_state("com.mossx.notes", SlotState::Activating, 1);
        assert_eq!(
            runtime.fuse_plugin("com.mossx.notes").unwrap_err().code,
            "activation-busy"
        );
        assert_eq!(
            runtime.disable_plugin("com.mossx.notes").unwrap_err().code,
            "activation-busy"
        );
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Activating
        );
        remove_path(&root);
    }

    #[test]
    fn runtime_accepts_legal_host_budget_floors() {
        use std::time::Duration;

        let root = unique_temp_root("runtime-budget-edges");
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                max_concurrent: 1,
                activation_deadline: Duration::from_millis(1_000),
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
        remove_path(&root);
    }

    #[test]
    fn empty_plugin_or_unit_identity_fails_on_compose_surface() {
        let root = unique_temp_root("runtime-empty-identity");
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
                .activate(ActivationRequest {
                    plugin_id: String::new(),
                    unit_id: "notes-main".into(),
                    required_entries: vec!["notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        assert_eq!(
            runtime
                .activate(ActivationRequest {
                    plugin_id: "com.mossx.notes".into(),
                    unit_id: String::new(),
                    required_entries: vec!["notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        assert!(runtime.host.slot("").is_none());
        assert!(runtime.host.slot("com.mossx.notes").is_none());
        remove_path(&root);
    }

    #[test]
    fn runtime_accepts_legal_activation_deadline_ceiling() {
        use std::time::Duration;

        let root = unique_temp_root("runtime-deadline-ceiling");
        let mut runtime = PluginRuntime::new(
            HostConfig {
                enabled: true,
                activation_deadline: Duration::from_millis(30_000),
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
        remove_path(&root);
    }

    #[test]
    fn blank_identity_or_required_entry_fails_on_compose_surface() {
        let root = unique_temp_root("runtime-blank-entries");
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
                .activate(ActivationRequest {
                    plugin_id: "   ".into(),
                    unit_id: "notes-main".into(),
                    required_entries: vec!["notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        assert_eq!(
            runtime
                .activate(ActivationRequest {
                    plugin_id: "com.mossx.notes".into(),
                    unit_id: "notes-main".into(),
                    required_entries: vec!["".into(), "notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        assert!(runtime.host.slot("   ").is_none());
        assert!(runtime.host.slot("com.mossx.notes").is_none());
        remove_path(&root);
    }

    #[test]
    fn generation_zero_is_never_a_live_handle() {
        let root = unique_temp_root("runtime-generation-zero");
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
                .query_read("com.mossx.notes", 0)
                .unwrap_err()
                .code,
            "stale-generation"
        );
        assert_eq!(
            runtime
                .open_stream("com.mossx.notes", 0, 81, "blob-v1")
                .unwrap_err()
                .code,
            "stale-generation"
        );
        remove_path(&root);
    }

    #[test]
    fn unknown_or_blank_plugin_cannot_change_lifecycle_on_compose_surface() {
        let root = unique_temp_root("runtime-unknown-lifecycle");
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
        for plugin_id in ["", "   "] {
            assert_eq!(runtime.fuse_plugin(plugin_id).unwrap_err().code, "schema");
            assert_eq!(runtime.disable_plugin(plugin_id).unwrap_err().code, "schema");
            assert_eq!(runtime.reset_plugin(plugin_id).unwrap_err().code, "schema");
        }
        assert_eq!(
            runtime
                .fuse_plugin("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .disable_plugin("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(
            runtime
                .reset_plugin("com.mossx.notes")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert!(runtime.host.slot("").is_none());
        assert!(runtime.host.slot("   ").is_none());
        assert!(runtime.host.slot("com.mossx.notes").is_none());
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_can_checkpoint_with_retain_ceiling() {
        let root = unique_temp_root("runtime-retain-ceiling");
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
            .checkpoint_own_store_retained("com.mossx.notes", 5)
            .expect("retain 5");
        assert!(id.starts_with("ckpt-"));
        remove_path(&root);
    }

    #[test]
    fn duplicate_required_entries_fail_on_compose_surface() {
        let root = unique_temp_root("runtime-duplicate-entries");
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
                .activate(ActivationRequest {
                    plugin_id: "com.mossx.notes".into(),
                    unit_id: "notes-main".into(),
                    required_entries: vec!["notes-ui".into(), "notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        assert!(runtime.host.slot("com.mossx.notes").is_none());
        remove_path(&root);
    }

    #[test]
    fn blank_plugin_id_cannot_touch_storage_on_compose_surface() {
        let root = unique_temp_root("runtime-blank-store");
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
        for plugin_id in ["", "   "] {
            assert_eq!(
                runtime.open_own_store(plugin_id).unwrap_err().code,
                "schema"
            );
            assert_eq!(
                runtime.checkpoint_own_store(plugin_id).unwrap_err().code,
                "schema"
            );
            assert_eq!(
                runtime.access_store(plugin_id, plugin_id).unwrap_err().code,
                "schema"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn blank_plugin_id_cannot_query_or_open_stream() {
        let root = unique_temp_root("runtime-blank-query");
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
        for plugin_id in ["", "   "] {
            assert_eq!(
                runtime.query_read(plugin_id, 1).unwrap_err().code,
                "schema"
            );
            assert_eq!(
                runtime
                    .open_stream(plugin_id, 1, 91, "blob-v1")
                    .unwrap_err()
                    .code,
                "schema"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_can_open_a_log_v1_stream() {
        let root = unique_temp_root("runtime-log-codec");
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
            .open_stream("com.mossx.notes", generation, 92, "log-v1")
            .expect("log stream");
        assert_eq!(runtime.plane.codec(92), Some("log-v1"));
        remove_path(&root);
    }

    #[test]
    fn fuse_and_disable_stay_inside_one_terminal_state_on_compose_surface() {
        use crate::plugin_runtime::host::DriverError;

        let root = unique_temp_root("runtime-terminal-lifecycle");
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
        runtime.fuse_plugin("com.mossx.notes").expect("idempotent fuse");
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Fused
        );
        assert_eq!(
            runtime.disable_plugin("com.mossx.notes").unwrap_err().code,
            "fused"
        );
        runtime.reset_plugin("com.mossx.notes").expect("reset");
        assert_eq!(
            runtime.fuse_plugin("com.mossx.notes").unwrap_err().code,
            "plugin-unavailable"
        );
        runtime
            .activate(notes_activation_request())
            .expect("second");
        runtime.disable_plugin("com.mossx.notes").expect("disable");
        runtime
            .disable_plugin("com.mossx.notes")
            .expect("idempotent disable");
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Disabled
        );
        assert_eq!(
            runtime.fuse_plugin("com.mossx.notes").unwrap_err().code,
            "disabled"
        );
        runtime.reset_plugin("com.mossx.notes").expect("reset after disable");
        runtime.host.test_driver_mut().fail_on.insert(
            "notes-ui".into(),
            DriverError::Timeout,
        );
        assert_eq!(
            runtime
                .activate(notes_activation_request())
                .unwrap_err()
                .code,
            "activation-timeout"
        );
        assert_eq!(
            runtime.fuse_plugin("com.mossx.notes").unwrap_err().code,
            "failed"
        );
        assert_eq!(
            runtime.disable_plugin("com.mossx.notes").unwrap_err().code,
            "failed"
        );
        assert_eq!(
            runtime.host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_open_a_blank_codec() {
        let root = unique_temp_root("runtime-blank-codec");
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
        for codec in ["", "   "] {
            assert_eq!(
                runtime
                    .open_stream("com.mossx.notes", generation, 93, codec)
                    .unwrap_err()
                    .code,
                "unknown-codec"
            );
        }
        assert!(runtime.plane.codec(93).is_none());
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_query_a_blank_capability() {
        let root = unique_temp_root("runtime-blank-capability");
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
        for capability in ["", "   "] {
            assert_eq!(
                runtime
                    .query("com.mossx.notes", generation, capability)
                    .unwrap_err()
                    .code,
                "schema"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_publish_notifications() {
        let root = unique_temp_root("runtime-notifications-denied");
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
                .query(
                    "com.mossx.notes",
                    generation,
                    "mossx.notifications.publish"
                )
                .unwrap_err()
                .code,
            "permission-denied"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_access_a_blank_store_target() {
        let root = unique_temp_root("runtime-blank-store-target");
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
        runtime.open_own_store("com.mossx.notes").expect("open");
        for target_id in ["", "   "] {
            assert_eq!(
                runtime
                    .access_store("com.mossx.notes", target_id)
                    .unwrap_err()
                    .code,
                "schema"
            );
        }
        remove_path(&root);
    }

    #[test]
    fn disable_claude_keeps_notes_store() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-disable-store-isolation");
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
        runtime.open_own_store("com.mossx.notes").expect("notes store");
        runtime
            .disable_plugin("com.mossx.engine.claude")
            .expect("disable claude");
        runtime
            .access_store("com.mossx.notes", "com.mossx.notes")
            .expect("notes access");
        let checkpoint = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("notes checkpoint");
        assert!(checkpoint.starts_with("ckpt-"));
        assert_eq!(
            runtime
                .open_own_store("com.mossx.engine.claude")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn untrimmed_identity_fails_on_compose_surface() {
        let root = unique_temp_root("runtime-canonical-identity");
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
                .activate(ActivationRequest {
                    plugin_id: " com.mossx.notes ".into(),
                    unit_id: "notes-main".into(),
                    required_entries: vec!["notes-ui".into()],
                })
                .unwrap_err()
                .code,
            "schema"
        );
        let generation = runtime
            .activate(notes_activation_request())
            .expect("activate");
        runtime.open_own_store("com.mossx.notes").expect("open");
        assert_eq!(
            runtime
                .query("com.mossx.notes", generation, " mossx.workspace.read ")
                .unwrap_err()
                .code,
            "schema"
        );
        assert_eq!(
            runtime
                .open_own_store(" com.mossx.notes ")
                .unwrap_err()
                .code,
            "schema"
        );
        assert_eq!(
            runtime
                .access_store("com.mossx.notes", " com.mossx.notes ")
                .unwrap_err()
                .code,
            "schema"
        );
        assert!(runtime.host.slot(" com.mossx.notes ").is_none());
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_register_a_search_provider() {
        let root = unique_temp_root("runtime-search-denied");
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
                .query("com.mossx.notes", generation, "mossx.search.provider")
                .unwrap_err()
                .code,
            "permission-denied"
        );
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_open_an_untrimmed_codec() {
        let root = unique_temp_root("runtime-canonical-codec");
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
                .open_stream("com.mossx.notes", generation, 94, " blob-v1 ")
                .unwrap_err()
                .code,
            "unknown-codec"
        );
        assert!(runtime.plane.codec(94).is_none());
        remove_path(&root);
    }

    #[test]
    fn fuse_claude_keeps_notes_store() {
        use crate::plugin_runtime::claude_pilot::claude_activation_request;

        let root = unique_temp_root("runtime-fuse-store-isolation");
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
        runtime.open_own_store("com.mossx.notes").expect("notes store");
        runtime
            .fuse_plugin("com.mossx.engine.claude")
            .expect("fuse claude");
        runtime
            .access_store("com.mossx.notes", "com.mossx.notes")
            .expect("notes access");
        let checkpoint = runtime
            .checkpoint_own_store("com.mossx.notes")
            .expect("notes checkpoint");
        assert!(checkpoint.starts_with("ckpt-"));
        assert_eq!(
            runtime
                .open_own_store("com.mossx.engine.claude")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        remove_path(&root);
    }

    #[test]
    fn non_reverse_dns_plugin_id_fails_on_compose_surface() {
        let root = unique_temp_root("runtime-reverse-dns");
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
        for plugin_id in ["../escape", "Notes", "com"] {
            assert_eq!(
                runtime
                    .activate(ActivationRequest {
                        plugin_id: plugin_id.into(),
                        unit_id: "notes-main".into(),
                        required_entries: vec!["notes-ui".into()],
                    })
                    .unwrap_err()
                    .code,
                "schema",
                "{plugin_id}"
            );
            assert!(runtime.host.slot(plugin_id).is_none(), "{plugin_id}");
        }
        remove_path(&root);
    }

    #[test]
    fn ready_plugin_cannot_query_leftover_catalog_capabilities() {
        let root = unique_temp_root("runtime-catalog-denied");
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
        for capability in [
            "mossx.context.provider",
            "mossx.command",
            "mossx.tool",
            "mossx.ui.view",
            "mossx.ui.panel",
            "mossx.ui.slot.workspace.rightPanel",
            "mossx.ui.slot.sidebar.secondary",
            "mossx.ui.slot.composer.toolbar",
            "mossx.ui.slot.conversation.attachmentRenderer",
            "mossx.ui.slot.settings.plugin",
            "mossx.ui.slot.status.lowFrequency",
            "mossx.settings.page",
            "mossx.status.item",
        ] {
            assert_eq!(
                runtime
                    .query("com.mossx.notes", generation, capability)
                    .unwrap_err()
                    .code,
                "permission-denied",
                "{capability}"
            );
        }
        remove_path(&root);
    }
}
