//! In-memory plugin storage contract. Does not write user disks.

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> StorageError {
    StorageError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone)]
pub struct CheckpointMeta {
    pub id: String,
    pub schema_version: u32,
    pub plugin_version: String,
}

#[derive(Debug, Clone)]
pub struct Namespace {
    pub plugin_id: String,
    pub plugin_version: String,
    pub contract_version: String,
    pub storage_schema_version: u32,
    pub checkpoint_format_version: u32,
    pub checkpoints: Vec<CheckpointMeta>,
    pub last_export_schema: Option<u32>,
    pub protected_checkpoint_id: Option<String>,
}

impl Namespace {
    pub fn data_path(&self) -> String {
        format!("plugin-runtime/data/{}/", self.plugin_id)
    }
}

#[derive(Debug, Clone)]
pub struct MigrationPlan {
    pub from: u32,
    pub to: u32,
    pub destructive: bool,
    pub export_required: bool,
    pub confirmed: bool,
    pub exported: bool,
    pub reader_schema: u32,
}

#[derive(Default)]
pub struct StorageService {
    namespaces: HashMap<String, Namespace>,
    next_checkpoint: u64,
}

impl StorageService {
    pub fn open_or_create(
        &mut self,
        plugin_id: &str,
        plugin_version: &str,
        contract_version: &str,
        schema: u32,
    ) -> Result<&Namespace, StorageError> {
        if plugin_id.trim().is_empty() || plugin_id != plugin_id.trim() {
            return Err(err("schema", "pluginId must be canonical"));
        }
        if !crate::plugin_runtime::manifest::plugin_id_ok(plugin_id) {
            return Err(err("schema", "pluginId must be reverse-DNS"));
        }
        self.namespaces
            .entry(plugin_id.to_string())
            .or_insert_with(|| Namespace {
                plugin_id: plugin_id.to_string(),
                plugin_version: plugin_version.to_string(),
                contract_version: contract_version.to_string(),
                storage_schema_version: schema,
                checkpoint_format_version: 1,
                checkpoints: Vec::new(),
                last_export_schema: None,
                protected_checkpoint_id: None,
            });
        Ok(self.namespaces.get(plugin_id).expect("just inserted"))
    }

    pub fn namespace(&self, plugin_id: &str) -> Result<&Namespace, StorageError> {
        self.namespaces
            .get(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))
    }

    pub fn access(&self, caller_id: &str, target_id: &str) -> Result<&Namespace, StorageError> {
        if caller_id != target_id {
            return Err(err(
                "permission-denied",
                format!("{caller_id} cannot open {target_id} namespace"),
            ));
        }
        self.namespace(target_id)
    }

    pub fn checkpoint(&mut self, plugin_id: &str, retain_previous: u32) -> Result<String, StorageError> {
        if !(1..=5).contains(&retain_previous) {
            return Err(err("invalid-storage", "retainPrevious must be 1-5"));
        }
        if !self.namespaces.contains_key(plugin_id) {
            return Err(err("plugin-unavailable", "namespace missing"));
        }
        self.next_checkpoint += 1;
        let id = format!("ckpt-{}", self.next_checkpoint);
        let namespace = self.namespaces.get_mut(plugin_id).expect("exists");
        namespace.checkpoints.push(CheckpointMeta {
            id: id.clone(),
            schema_version: namespace.storage_schema_version,
            plugin_version: namespace.plugin_version.clone(),
        });
        evict_unprotected_checkpoints(namespace, retain_previous);
        Ok(id)
    }

    pub fn last_checkpoint(&self, plugin_id: &str) -> Result<&CheckpointMeta, StorageError> {
        self.namespace(plugin_id)?
            .checkpoints
            .last()
            .ok_or_else(|| err("checkpoint-required", "no checkpoint to restore"))
    }

    pub fn protect_checkpoint(
        &mut self,
        plugin_id: &str,
        checkpoint_id: &str,
    ) -> Result<(), StorageError> {
        let namespace = self
            .namespaces
            .get_mut(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))?;
        let exists = namespace
            .checkpoints
            .iter()
            .any(|checkpoint| checkpoint.id == checkpoint_id);
        if !exists {
            return Err(err("checkpoint-required", "protected checkpoint missing"));
        }
        namespace.protected_checkpoint_id = Some(checkpoint_id.to_string());
        Ok(())
    }

    pub fn adopt_checkpoint(
        &mut self,
        plugin_id: &str,
        checkpoint_id: &str,
        schema_version: u32,
        plugin_version: &str,
    ) -> Result<(), StorageError> {
        self.open_or_create(plugin_id, plugin_version, "1.0.0", schema_version)?;
        let namespace = self.namespaces.get_mut(plugin_id).expect("just created");
        namespace.storage_schema_version = schema_version;
        namespace.plugin_version = plugin_version.to_string();
        if !namespace
            .checkpoints
            .iter()
            .any(|checkpoint| checkpoint.id == checkpoint_id)
        {
            namespace.checkpoints.push(CheckpointMeta {
                id: checkpoint_id.to_string(),
                schema_version,
                plugin_version: plugin_version.to_string(),
            });
        }
        if let Some(seq) = checkpoint_id
            .strip_prefix("ckpt-")
            .and_then(|value| value.parse::<u64>().ok())
        {
            if seq > self.next_checkpoint {
                self.next_checkpoint = seq;
            }
        }
        Ok(())
    }

    pub fn set_plugin_version(
        &mut self,
        plugin_id: &str,
        plugin_version: &str,
    ) -> Result<(), StorageError> {
        if plugin_version.trim().is_empty() {
            return Err(err("schema", "pluginVersion must be canonical"));
        }
        let namespace = self
            .namespaces
            .get_mut(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))?;
        namespace.plugin_version = plugin_version.to_string();
        Ok(())
    }

    pub fn migrate(&mut self, plugin_id: &str, plan: MigrationPlan) -> Result<u32, StorageError> {
        let namespace = self
            .namespaces
            .get(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))?;
        if namespace.checkpoints.is_empty() {
            return Err(err("checkpoint-required", "migrate requires a validated checkpoint"));
        }
        if plan.reader_schema < namespace.storage_schema_version {
            return Err(err(
                "quarantine",
                "old reader cannot open a newer storage schema",
            ));
        }
        if plan.from != namespace.storage_schema_version {
            return Err(err("invalid-storage", "migration from does not match store"));
        }
        if plan.destructive && !plan.confirmed {
            return Err(err(
                "destructive-unconfirmed",
                "destructive migration requires user confirmation",
            ));
        }
        if plan.export_required && !plan.exported {
            return Err(err("export-required", "user-visible export must complete first"));
        }
        let namespace = self.namespaces.get_mut(plugin_id).expect("exists");
        namespace.storage_schema_version = plan.to;
        if plan.exported {
            namespace.last_export_schema = Some(plan.from);
        }
        Ok(plan.to)
    }

    pub fn restore(&mut self, plugin_id: &str) -> Result<u32, StorageError> {
        let checkpoint_id = self.last_checkpoint(plugin_id)?.id.clone();
        self.restore_to(plugin_id, &checkpoint_id)
    }

    pub fn restore_to(&mut self, plugin_id: &str, checkpoint_id: &str) -> Result<u32, StorageError> {
        let namespace = self
            .namespaces
            .get_mut(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))?;
        let schema = namespace
            .checkpoints
            .iter()
            .find(|checkpoint| checkpoint.id == checkpoint_id)
            .map(|checkpoint| checkpoint.schema_version)
            .ok_or_else(|| err("checkpoint-required", "restore checkpoint missing"))?;
        namespace.storage_schema_version = schema;
        Ok(schema)
    }
}

fn evict_unprotected_checkpoints(namespace: &mut Namespace, retain_previous: u32) {
    let retain = retain_previous as usize;
    while namespace.checkpoints.len() > retain {
        let evict_at = namespace.checkpoints.iter().position(|checkpoint| {
            Some(&checkpoint.id) != namespace.protected_checkpoint_id.as_ref()
        });
        match evict_at {
            Some(index) => {
                namespace.checkpoints.remove(index);
            }
            None => break,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notes(service: &mut StorageService) {
        service
            .open_or_create("com.mossx.notes", "1.0.0", "1.0.0", 1)
            .expect("open");
    }

    #[test]
    fn namespace_path_is_plugin_scoped() {
        let mut service = StorageService::default();
        notes(&mut service);
        let path = service.namespace("com.mossx.notes").unwrap().data_path();
        assert!(path.contains("com.mossx.notes"));
        assert!(!path.contains("com.mossx.engine.claude"));
    }

    #[test]
    fn claude_cannot_access_notes_namespace() {
        let mut service = StorageService::default();
        notes(&mut service);
        let error = service
            .access("com.mossx.engine.claude", "com.mossx.notes")
            .unwrap_err();
        assert_eq!(error.code, "permission-denied");
        let own = service
            .access("com.mossx.notes", "com.mossx.notes")
            .expect("own");
        assert_eq!(own.plugin_id, "com.mossx.notes");
    }

    #[test]
    fn migrate_without_checkpoint_is_rejected() {
        let mut service = StorageService::default();
        notes(&mut service);
        let error = service
            .migrate(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: false,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 1,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "checkpoint-required");
    }

    #[test]
    fn unconfirmed_destructive_migrate_is_rejected() {
        let mut service = StorageService::default();
        notes(&mut service);
        service.checkpoint("com.mossx.notes", 2).expect("ckpt");
        let error = service
            .migrate(
                "com.mossx.notes",
                MigrationPlan {
                    from: 1,
                    to: 2,
                    destructive: true,
                    export_required: false,
                    confirmed: false,
                    exported: false,
                    reader_schema: 1,
                },
            )
            .unwrap_err();
        assert_eq!(error.code, "destructive-unconfirmed");
    }

    #[test]
    fn old_reader_cannot_open_newer_schema() {
        let mut service = StorageService::default();
        notes(&mut service);
        service.checkpoint("com.mossx.notes", 2).expect("ckpt");
        service
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
        let error = service
            .migrate(
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
    }

    #[test]
    fn untrimmed_plugin_id_cannot_open_a_namespace() {
        let mut service = StorageService::default();
        for plugin_id in ["", "   ", " com.mossx.notes "] {
            assert_eq!(
                service
                    .open_or_create(plugin_id, "1.0.0", "1.0.0", 1)
                    .unwrap_err()
                    .code,
                "schema"
            );
            assert!(service.namespace(plugin_id).is_err());
        }
        assert!(service.namespace("com.mossx.notes").is_err());
    }

    #[test]
    fn protected_checkpoint_survives_retain_eviction() {
        let mut service = StorageService::default();
        notes(&mut service);
        let first = service.checkpoint("com.mossx.notes", 2).expect("ckpt-1");
        service
            .protect_checkpoint("com.mossx.notes", &first)
            .expect("protect");
        let _second = service.checkpoint("com.mossx.notes", 1).expect("ckpt-2");
        let namespace = service.namespace("com.mossx.notes").expect("ns");
        assert!(
            namespace
                .checkpoints
                .iter()
                .any(|checkpoint| checkpoint.id == first),
            "LKG checkpoint must survive retainPrevious=1"
        );
        assert_eq!(namespace.protected_checkpoint_id.as_deref(), Some(first.as_str()));
    }

    fn path_unsafe_plugin_id_cannot_open_a_namespace() {
        let mut service = StorageService::default();
        for plugin_id in ["../escape", "com.mossx.notes/../escape", "com\\mossx", "Notes"] {
            assert_eq!(
                service
                    .open_or_create(plugin_id, "1.0.0", "1.0.0", 1)
                    .unwrap_err()
                    .code,
                "schema"
            );
            assert!(service.namespace(plugin_id).is_err());
        }
    }
}
