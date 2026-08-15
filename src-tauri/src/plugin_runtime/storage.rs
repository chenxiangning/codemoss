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
        if plugin_id.is_empty() {
            return Err(err("schema", "pluginId required"));
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
            });
        Ok(self.namespaces.get(plugin_id).expect("just inserted"))
    }

    pub fn namespace(&self, plugin_id: &str) -> Result<&Namespace, StorageError> {
        self.namespaces
            .get(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))
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
        while namespace.checkpoints.len() > retain_previous as usize {
            namespace.checkpoints.remove(0);
        }
        Ok(id)
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
        let namespace = self
            .namespaces
            .get_mut(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "namespace missing"))?;
        let checkpoint = namespace
            .checkpoints
            .last()
            .ok_or_else(|| err("checkpoint-required", "no checkpoint to restore"))?;
        namespace.storage_schema_version = checkpoint.schema_version;
        Ok(checkpoint.schema_version)
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
}
