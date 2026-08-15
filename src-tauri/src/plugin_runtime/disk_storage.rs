//! Isolated sqlite persistence under an injected root. No product app-data paths.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use super::storage::{MigrationPlan, StorageError, StorageService};

fn err(code: &'static str, message: impl Into<String>) -> StorageError {
    StorageError {
        code,
        message: message.into(),
    }
}

pub struct DiskStorage {
    root: PathBuf,
    logic: StorageService,
}

impl DiskStorage {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let root = root.into();
        fs::create_dir_all(root.join("plugin-runtime")).map_err(|error| {
            err("invalid-storage", format!("cannot create runtime root: {error}"))
        })?;
        Ok(Self {
            root,
            logic: StorageService::default(),
        })
    }

    pub fn data_file(&self, plugin_id: &str) -> PathBuf {
        self.root
            .join("plugin-runtime/data")
            .join(plugin_id)
            .join("store.sqlite")
    }

    pub fn access_file(&self, caller_id: &str, target_id: &str) -> Result<PathBuf, StorageError> {
        self.logic.access(caller_id, target_id)?;
        Ok(self.data_file(target_id))
    }

    pub fn checkpoint_file(&self, plugin_id: &str, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("plugin-runtime/checkpoints")
            .join(plugin_id)
            .join(checkpoint_id)
            .join("store.sqlite")
    }

    pub fn open_plugin(
        &mut self,
        plugin_id: &str,
        plugin_version: &str,
        contract_version: &str,
        schema: u32,
    ) -> Result<PathBuf, StorageError> {
        self.logic
            .open_or_create(plugin_id, plugin_version, contract_version, schema)?;
        let path = self.data_file(plugin_id);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| err("invalid-storage", format!("mkdir data: {error}")))?;
        }
        let connection = Connection::open(&path)
            .map_err(|error| err("invalid-storage", format!("open sqlite: {error}")))?;
        connection
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS mossx_storage_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );",
            )
            .map_err(|error| err("invalid-storage", format!("init meta: {error}")))?;
        connection
            .execute(
                "INSERT INTO mossx_storage_meta(key, value) VALUES('schema_version', ?1)
                 ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                [schema.to_string()],
            )
            .map_err(|error| err("invalid-storage", format!("write schema: {error}")))?;
        Ok(path)
    }

    pub fn checkpoint(&mut self, plugin_id: &str, retain_previous: u32) -> Result<String, StorageError> {
        let id = self.logic.checkpoint(plugin_id, retain_previous)?;
        let source = self.data_file(plugin_id);
        let target = self.checkpoint_file(plugin_id, &id);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| err("invalid-storage", format!("mkdir checkpoint: {error}")))?;
        }
        fs::copy(&source, &target)
            .map_err(|error| err("invalid-storage", format!("copy checkpoint: {error}")))?;
        Ok(id)
    }

    pub fn migrate(&mut self, plugin_id: &str, plan: MigrationPlan) -> Result<u32, StorageError> {
        let to = self.logic.migrate(plugin_id, plan)?;
        let connection = Connection::open(self.data_file(plugin_id))
            .map_err(|error| err("invalid-storage", format!("open sqlite: {error}")))?;
        connection
            .execute(
                "UPDATE mossx_storage_meta SET value=?1 WHERE key='schema_version'",
                [to.to_string()],
            )
            .map_err(|error| err("invalid-storage", format!("update schema: {error}")))?;
        Ok(to)
    }

    pub fn restore(&mut self, plugin_id: &str) -> Result<u32, StorageError> {
        let schema = self.logic.restore(plugin_id)?;
        let namespace = self.logic.namespace(plugin_id)?;
        let checkpoint = namespace
            .checkpoints
            .last()
            .ok_or_else(|| err("checkpoint-required", "no checkpoint to restore"))?;
        let source = self.checkpoint_file(plugin_id, &checkpoint.id);
        let target = self.data_file(plugin_id);
        fs::copy(&source, &target)
            .map_err(|error| err("invalid-storage", format!("restore copy: {error}")))?;
        Ok(schema)
    }

    pub fn read_schema(&self, plugin_id: &str) -> Result<u32, StorageError> {
        let connection = Connection::open(self.data_file(plugin_id))
            .map_err(|error| err("invalid-storage", format!("open sqlite: {error}")))?;
        let value: String = connection
            .query_row(
                "SELECT value FROM mossx_storage_meta WHERE key='schema_version'",
                [],
                |row| row.get(0),
            )
            .map_err(|error| err("invalid-storage", format!("read schema: {error}")))?;
        value
            .parse()
            .map_err(|_| err("invalid-storage", "schema_version is not an integer"))
    }
}

pub fn unique_temp_root(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "mossx-plugin-storage-{tag}-{}-{nanos}",
        std::process::id()
    ))
}

pub fn remove_path(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notes_plan(from: u32, to: u32, reader: u32) -> MigrationPlan {
        MigrationPlan {
            from,
            to,
            destructive: false,
            export_required: false,
            confirmed: false,
            exported: false,
            reader_schema: reader,
        }
    }

    #[test]
    fn temp_root_gets_plugin_scoped_sqlite() {
        let root = unique_temp_root("scoped");
        let mut storage = DiskStorage::open(&root).expect("open root");
        let path = storage
            .open_plugin("com.mossx.notes", "1.0.0", "1.0.0", 1)
            .expect("open plugin");
        assert!(path.ends_with("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        assert!(path.exists());
        assert!(!path.to_string_lossy().contains("note_cards"));
        remove_path(&root);
    }

    #[test]
    fn restore_replaces_mutated_store() {
        let root = unique_temp_root("restore");
        let mut storage = DiskStorage::open(&root).expect("open root");
        storage
            .open_plugin("com.mossx.notes", "1.0.0", "1.0.0", 1)
            .expect("open");
        storage.checkpoint("com.mossx.notes", 2).expect("ckpt");
        storage
            .migrate("com.mossx.notes", notes_plan(1, 2, 2))
            .expect("migrate");
        assert_eq!(storage.read_schema("com.mossx.notes").unwrap(), 2);
        storage.restore("com.mossx.notes").expect("restore");
        assert_eq!(storage.read_schema("com.mossx.notes").unwrap(), 1);
        remove_path(&root);
    }

    #[test]
    fn two_plugins_do_not_share_files() {
        let root = unique_temp_root("isolate");
        let mut storage = DiskStorage::open(&root).expect("open root");
        let notes = storage
            .open_plugin("com.mossx.notes", "1.0.0", "1.0.0", 1)
            .expect("notes");
        let claude = storage
            .open_plugin("com.mossx.engine.claude", "1.0.0", "1.0.0", 1)
            .expect("claude");
        assert_ne!(notes, claude);
        assert!(notes.exists() && claude.exists());
        let denied = storage
            .access_file("com.mossx.engine.claude", "com.mossx.notes")
            .unwrap_err();
        assert_eq!(denied.code, "permission-denied");
        let own = storage
            .access_file("com.mossx.notes", "com.mossx.notes")
            .expect("own");
        assert_eq!(own, notes);
        remove_path(&root);
    }

    #[test]
    fn path_unsafe_plugin_id_cannot_create_files() {
        let root = unique_temp_root("path-unsafe");
        let mut storage = DiskStorage::open(&root).expect("open root");
        assert_eq!(
            storage
                .open_plugin("../escape", "1.0.0", "1.0.0", 1)
                .unwrap_err()
                .code,
            "schema"
        );
        assert_eq!(
            storage
                .open_plugin("com.mossx.notes/../escape", "1.0.0", "1.0.0", 1)
                .unwrap_err()
                .code,
            "schema"
        );
        assert!(!root.join("escape").exists());
        assert!(!root.join("plugin-runtime/data/escape").exists());
        remove_path(&root);
    }
}
