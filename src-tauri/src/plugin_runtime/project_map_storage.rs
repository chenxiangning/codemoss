//! Wave 5E1/5E2: Project Map namespace on injected DiskStorage.
//! Does not read product project-map / project-memory directories.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::disk_storage::{remove_path, unique_temp_root, DiskStorage};
use super::storage::{MigrationPlan, StorageError};
use crate::project_memory::embed_index::EmbedIndexRecord;
use crate::project_memory::{ProjectMemoryItem, ProjectMemorySettings};

pub const PROJECT_MAP_PLUGIN_ID: &str = "com.mossx.project-map";

const CREATE_PROJECT_MAP_TABLES: &str = "
CREATE TABLE IF NOT EXISTS map_files (
    workspace_id TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (workspace_id, relative_path)
);
CREATE TABLE IF NOT EXISTS relation_files (
    workspace_id TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (workspace_id, relative_path)
);
CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS embed_index (
    workspace_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (workspace_id, memory_id)
);
";

pub fn open_project_map_namespace(root: impl Into<PathBuf>) -> Result<DiskStorage, StorageError> {
    let mut storage = DiskStorage::open(root)?;
    storage.open_plugin(PROJECT_MAP_PLUGIN_ID, "1.0.0", "1.0.0", 1)?;
    Ok(storage)
}

fn compatible_plan(from: u32, to: u32, reader: u32) -> MigrationPlan {
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

/// 5E2：隔离 namespace 上的 persist CRUD。只操作注入根 sqlite。
pub struct ProjectMapNamespace {
    storage: DiskStorage,
}

impl ProjectMapNamespace {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let storage = open_project_map_namespace(root)?;
        let connection = open_store(&storage)?;
        connection
            .execute_batch(CREATE_PROJECT_MAP_TABLES)
            .map_err(storage_error)?;
        Ok(Self { storage })
    }

    pub fn data_file(&self) -> PathBuf {
        self.storage.data_file(PROJECT_MAP_PLUGIN_ID)
    }

    pub fn import_lock_file(&self) -> PathBuf {
        self.data_file()
            .parent()
            .map(|parent| parent.join("imported.lock"))
            .unwrap_or_else(|| self.data_file().with_extension("imported.lock"))
    }

    pub fn import_legacy_once(
        &self,
        map_root: &Path,
        relations_root: &Path,
        memory_root: &Path,
    ) -> Result<usize, String> {
        let lock = self.import_lock_file();
        if lock.exists() {
            return Ok(0);
        }
        let mut imported = 0usize;
        imported += self.import_blob_tree(map_root, BlobKind::Map)?;
        imported += self.import_blob_tree(relations_root, BlobKind::Relation)?;
        imported += self.import_memory_settings(memory_root)?;
        imported += self.import_memory_items(memory_root)?;
        if let Some(parent) = lock.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        std::fs::write(&lock, b"imported\n").map_err(|error| error.to_string())?;
        Ok(imported)
    }

    fn import_blob_tree(&self, root: &Path, kind: BlobKind) -> Result<usize, String> {
        let mut imported = 0usize;
        let entries = match std::fs::read_dir(root) {
            Ok(entries) => entries,
            Err(_) => return Ok(0),
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(workspace_id) = path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            if workspace_id.is_empty() {
                continue;
            }
            for (relative_path, content) in collect_legacy_files(&path, &path)? {
                if relative_path.starts_with("backups/") {
                    continue;
                }
                let exists = match kind {
                    BlobKind::Map => self.get_map_file(workspace_id, &relative_path)?.is_some(),
                    BlobKind::Relation => {
                        self.get_relation_file(workspace_id, &relative_path)?.is_some()
                    }
                };
                if exists {
                    continue;
                }
                match kind {
                    BlobKind::Map => {
                        self.put_map_file(workspace_id, workspace_id, &relative_path, &content)?
                    }
                    BlobKind::Relation => self.put_relation_file(
                        workspace_id,
                        workspace_id,
                        &relative_path,
                        &content,
                    )?,
                }
                imported += 1;
            }
        }
        Ok(imported)
    }

    fn import_memory_settings(&self, memory_root: &Path) -> Result<usize, String> {
        let settings_path = memory_root.join("settings.json");
        if !settings_path.exists() {
            return Ok(0);
        }
        let raw = std::fs::read_to_string(&settings_path).map_err(|error| error.to_string())?;
        let settings: ProjectMemorySettings =
            serde_json::from_str(&raw).map_err(|error| error.to_string())?;
        self.put_settings(&settings)?;
        Ok(1)
    }

    fn import_memory_items(&self, memory_root: &Path) -> Result<usize, String> {
        let mut imported = 0usize;
        let entries = match std::fs::read_dir(memory_root) {
            Ok(entries) => entries,
            Err(_) => return Ok(0),
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !name.contains("--") {
                continue;
            }
            let files = match std::fs::read_dir(&path) {
                Ok(files) => files,
                Err(_) => continue,
            };
            for file in files.flatten() {
                let file_path = file.path();
                if file_path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                    continue;
                }
                for item in crate::project_memory::read_date_file(&file_path)? {
                    if self.get_memory(&item.id, &item.workspace_id)?.is_some() {
                        continue;
                    }
                    self.upsert_memory(&item)?;
                    imported += 1;
                }
            }
        }
        Ok(imported)
    }

    pub fn checkpoint(&mut self) -> Result<String, String> {
        self.storage
            .checkpoint(PROJECT_MAP_PLUGIN_ID, 2)
            .map_err(|error| error.message)
    }

    pub fn restore(&mut self) -> Result<u32, String> {
        self.storage
            .restore(PROJECT_MAP_PLUGIN_ID)
            .map_err(|error| error.message)
    }

    pub fn put_map_file(
        &self,
        workspace_id: &str,
        storage_key: &str,
        relative_path: &str,
        content: &str,
    ) -> Result<(), String> {
        upsert_file(
            &self.connection()?,
            "map_files",
            workspace_id,
            storage_key,
            relative_path,
            content,
        )
    }

    pub fn get_map_file(
        &self,
        workspace_id: &str,
        relative_path: &str,
    ) -> Result<Option<String>, String> {
        get_file(&self.connection()?, "map_files", workspace_id, relative_path)
    }

    pub fn list_map_files(&self, workspace_id: &str) -> Result<Vec<(String, String)>, String> {
        list_files(&self.connection()?, "map_files", workspace_id)
    }

    pub fn put_relation_file(
        &self,
        workspace_id: &str,
        storage_key: &str,
        relative_path: &str,
        content: &str,
    ) -> Result<(), String> {
        upsert_file(
            &self.connection()?,
            "relation_files",
            workspace_id,
            storage_key,
            relative_path,
            content,
        )
    }

    pub fn get_relation_file(
        &self,
        workspace_id: &str,
        relative_path: &str,
    ) -> Result<Option<String>, String> {
        get_file(
            &self.connection()?,
            "relation_files",
            workspace_id,
            relative_path,
        )
    }

    pub fn list_relation_files(&self, workspace_id: &str) -> Result<Vec<(String, String)>, String> {
        list_files(&self.connection()?, "relation_files", workspace_id)
    }

    pub fn clear_relation_files(&self, workspace_id: &str) -> Result<usize, String> {
        let changed = self
            .connection()?
            .execute(
                "DELETE FROM relation_files WHERE workspace_id = ?1",
                [workspace_id],
            )
            .map_err(to_string)?;
        Ok(changed)
    }

    pub fn upsert_memory(&self, item: &ProjectMemoryItem) -> Result<(), String> {
        let payload = serde_json::to_string(item).map_err(to_string)?;
        self.connection()?
            .execute(
                "INSERT INTO memory_items (id, workspace_id, payload_json) VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET workspace_id = excluded.workspace_id,
                 payload_json = excluded.payload_json",
                rusqlite::params![item.id, item.workspace_id, payload],
            )
            .map_err(to_string)?;
        Ok(())
    }

    pub fn get_memory(
        &self,
        memory_id: &str,
        workspace_id: &str,
    ) -> Result<Option<ProjectMemoryItem>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT payload_json FROM memory_items WHERE id = ?1 AND workspace_id = ?2",
            )
            .map_err(to_string)?;
        let mut rows = statement
            .query(rusqlite::params![memory_id, workspace_id])
            .map_err(to_string)?;
        match rows.next().map_err(to_string)? {
            Some(row) => {
                let payload: String = row.get(0).map_err(to_string)?;
                Ok(Some(serde_json::from_str(&payload).map_err(to_string)?))
            }
            None => Ok(None),
        }
    }

    pub fn list_memories(&self, workspace_id: &str) -> Result<Vec<ProjectMemoryItem>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT payload_json FROM memory_items WHERE workspace_id = ?1 ORDER BY id",
            )
            .map_err(to_string)?;
        let mut rows = statement.query([workspace_id]).map_err(to_string)?;
        let mut items = Vec::new();
        while let Some(row) = rows.next().map_err(to_string)? {
            let payload: String = row.get(0).map_err(to_string)?;
            items.push(serde_json::from_str(&payload).map_err(to_string)?);
        }
        Ok(items)
    }

    pub fn delete_memory(&self, memory_id: &str, workspace_id: &str) -> Result<(), String> {
        let changed = self
            .connection()?
            .execute(
                "DELETE FROM memory_items WHERE id = ?1 AND workspace_id = ?2",
                rusqlite::params![memory_id, workspace_id],
            )
            .map_err(to_string)?;
        if changed == 0 {
            return Err("project memory not found".into());
        }
        Ok(())
    }

    pub fn get_settings(&self) -> Result<ProjectMemorySettings, String> {
        let connection = self.connection()?;
        let payload: Result<String, rusqlite::Error> = connection.query_row(
            "SELECT payload_json FROM memory_settings WHERE id = 1",
            [],
            |row| row.get(0),
        );
        match payload {
            Ok(json) => serde_json::from_str(&json).map_err(to_string),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(ProjectMemorySettings::default()),
            Err(error) => Err(error.to_string()),
        }
    }

    pub fn put_settings(&self, settings: &ProjectMemorySettings) -> Result<(), String> {
        let payload = serde_json::to_string(settings).map_err(to_string)?;
        self.connection()?
            .execute(
                "INSERT INTO memory_settings (id, payload_json) VALUES (1, ?1)
                 ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json",
                [payload],
            )
            .map_err(to_string)?;
        Ok(())
    }

    pub fn upsert_embed(&self, record: &EmbedIndexRecord) -> Result<(), String> {
        let payload = serde_json::to_string(record).map_err(to_string)?;
        self.connection()?
            .execute(
                "INSERT INTO embed_index (workspace_id, memory_id, payload_json)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(workspace_id, memory_id) DO UPDATE SET
                 payload_json = excluded.payload_json",
                rusqlite::params![record.workspace_id, record.memory_id, payload],
            )
            .map_err(to_string)?;
        Ok(())
    }

    pub fn list_embeds(&self, workspace_id: &str) -> Result<Vec<EmbedIndexRecord>, String> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT payload_json FROM embed_index WHERE workspace_id = ?1 ORDER BY memory_id",
            )
            .map_err(to_string)?;
        let mut rows = statement.query([workspace_id]).map_err(to_string)?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().map_err(to_string)? {
            let payload: String = row.get(0).map_err(to_string)?;
            records.push(serde_json::from_str(&payload).map_err(to_string)?);
        }
        Ok(records)
    }

    pub fn delete_embeds(&self, workspace_id: &str, memory_ids: &[String]) -> Result<usize, String> {
        let connection = self.connection()?;
        let mut deleted = 0usize;
        for memory_id in memory_ids {
            deleted += connection
                .execute(
                    "DELETE FROM embed_index WHERE workspace_id = ?1 AND memory_id = ?2",
                    rusqlite::params![workspace_id, memory_id],
                )
                .map_err(to_string)?;
        }
        Ok(deleted)
    }

    pub fn clear_embeds(&self, workspace_id: &str) -> Result<usize, String> {
        let changed = self
            .connection()?
            .execute(
                "DELETE FROM embed_index WHERE workspace_id = ?1",
                [workspace_id],
            )
            .map_err(to_string)?;
        Ok(changed)
    }

    fn connection(&self) -> Result<Connection, String> {
        Connection::open(self.data_file()).map_err(to_string)
    }
}

enum BlobKind {
    Map,
    Relation,
}

fn collect_legacy_files(root: &Path, current: &Path) -> Result<Vec<(String, String)>, String> {
    let mut files = Vec::new();
    let entries = match std::fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return Ok(files),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            files.extend(collect_legacy_files(root, &path)?);
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
        files.push((relative, content));
    }
    Ok(files)
}

fn open_store(storage: &DiskStorage) -> Result<Connection, StorageError> {
    Connection::open(storage.data_file(PROJECT_MAP_PLUGIN_ID)).map_err(storage_error)
}

fn storage_error(error: rusqlite::Error) -> StorageError {
    StorageError {
        code: "invalid-storage",
        message: error.to_string(),
    }
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}

fn upsert_file(
    connection: &Connection,
    table: &str,
    workspace_id: &str,
    storage_key: &str,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let sql = format!(
        "INSERT INTO {table} (workspace_id, storage_key, relative_path, content)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(workspace_id, relative_path) DO UPDATE SET
         storage_key = excluded.storage_key, content = excluded.content"
    );
    connection
        .execute(
            &sql,
            rusqlite::params![workspace_id, storage_key, relative_path, content],
        )
        .map_err(to_string)?;
    Ok(())
}

fn get_file(
    connection: &Connection,
    table: &str,
    workspace_id: &str,
    relative_path: &str,
) -> Result<Option<String>, String> {
    let sql = format!(
        "SELECT content FROM {table} WHERE workspace_id = ?1 AND relative_path = ?2"
    );
    let mut statement = connection.prepare(&sql).map_err(to_string)?;
    let mut rows = statement
        .query(rusqlite::params![workspace_id, relative_path])
        .map_err(to_string)?;
    match rows.next().map_err(to_string)? {
        Some(row) => Ok(Some(row.get(0).map_err(to_string)?)),
        None => Ok(None),
    }
}

fn list_files(
    connection: &Connection,
    table: &str,
    workspace_id: &str,
) -> Result<Vec<(String, String)>, String> {
    let sql = format!(
        "SELECT relative_path, content FROM {table} WHERE workspace_id = ?1 ORDER BY relative_path"
    );
    let mut statement = connection.prepare(&sql).map_err(to_string)?;
    let mut rows = statement.query([workspace_id]).map_err(to_string)?;
    let mut files = Vec::new();
    while let Some(row) = rows.next().map_err(to_string)? {
        files.push((
            row.get(0).map_err(to_string)?,
            row.get(1).map_err(to_string)?,
        ));
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_memory(title: &str) -> ProjectMemoryItem {
        ProjectMemoryItem {
            id: "mem-1".into(),
            workspace_id: "ws-1".into(),
            schema_version: Some(1),
            record_kind: Some("note".into()),
            kind: "decision".into(),
            title: title.into(),
            summary: "summary".into(),
            detail: None,
            raw_text: None,
            clean_text: "clean".into(),
            tags: vec!["map".into()],
            importance: "medium".into(),
            thread_id: None,
            turn_id: None,
            message_id: None,
            assistant_message_id: None,
            user_input: None,
            assistant_response: None,
            assistant_thinking_summary: None,
            review_state: None,
            source: "test".into(),
            fingerprint: "fp-1".into(),
            created_at: 1,
            updated_at: 2,
            deleted_at: None,
            workspace_name: None,
            workspace_path: None,
            engine: None,
        }
    }

    fn sample_embed() -> EmbedIndexRecord {
        EmbedIndexRecord {
            workspace_id: "ws-1".into(),
            memory_id: "mem-1".into(),
            provider_id: "local".into(),
            model_id: "mini".into(),
            embedding_version: "v1".into(),
            dimensions: 2,
            content_hash: "hash".into(),
            vector: vec![0.1, 0.2],
            memory_updated_at: 2,
            indexed_at: 3,
        }
    }

    #[test]
    fn injected_root_gets_project_map_sqlite() {
        let root = unique_temp_root("project-map-ns");
        let storage = open_project_map_namespace(&root).expect("open project map");
        let path = storage.data_file(PROJECT_MAP_PLUGIN_ID);
        assert!(path.ends_with("plugin-runtime/data/com.mossx.project-map/store.sqlite"));
        assert!(path.exists());
        let rendered = path.to_string_lossy();
        assert!(!rendered.contains("project-map-relations"));
        assert!(!rendered.contains("project-memory"));
        assert!(!rendered.contains(".ccgui/project-map"));
        remove_path(Path::new(&root));
    }

    #[test]
    fn project_map_restore_returns_checkpoint_schema() {
        let root = unique_temp_root("project-map-restore");
        let mut storage = open_project_map_namespace(&root).expect("open project map");
        storage
            .checkpoint(PROJECT_MAP_PLUGIN_ID, 2)
            .expect("ckpt");
        storage
            .migrate(PROJECT_MAP_PLUGIN_ID, compatible_plan(1, 2, 2))
            .expect("migrate");
        assert_eq!(storage.read_schema(PROJECT_MAP_PLUGIN_ID).unwrap(), 2);
        storage
            .restore(PROJECT_MAP_PLUGIN_ID)
            .expect("restore");
        assert_eq!(storage.read_schema(PROJECT_MAP_PLUGIN_ID).unwrap(), 1);
        remove_path(Path::new(&root));
    }

    #[test]
    fn isolated_namespace_does_not_touch_product_paths() {
        let source = include_str!("project_map_storage.rs");
        let impl_src = source
            .split("#[cfg(test)]")
            .next()
            .expect("implementation section");
        assert!(!impl_src.contains("app_paths"));
        assert!(!impl_src.contains("project_map_read"));
        assert!(!impl_src.contains("activate_plugin"));
        assert!(!impl_src.contains("dispatch_command"));
        assert!(!impl_src.contains(".ccgui/project-map"));
        assert!(!impl_src.contains("~/.ccgui"));
    }

    #[test]
    fn isolated_namespace_supports_persist_crud_without_product_files() {
        let root = unique_temp_root("project-map-full-crud");
        let namespace = ProjectMapNamespace::open(&root).expect("open namespace");
        namespace
            .put_map_file("ws-1", "key-1", "manifest.json", r#"{"storageKey":"key-1"}"#)
            .expect("put map");
        assert_eq!(
            namespace
                .get_map_file("ws-1", "manifest.json")
                .expect("get map")
                .expect("exists"),
            r#"{"storageKey":"key-1"}"#
        );
        namespace
            .put_relation_file("ws-1", "key-1", "relations/latest.json", "{}")
            .expect("put relation");
        assert_eq!(namespace.list_relation_files("ws-1").unwrap().len(), 1);

        namespace.upsert_memory(&sample_memory("hello")).expect("create memory");
        let loaded = namespace
            .get_memory("mem-1", "ws-1")
            .expect("get")
            .expect("exists");
        assert_eq!(loaded.title, "hello");
        let mut renamed = loaded;
        renamed.title = "renamed".into();
        namespace.upsert_memory(&renamed).expect("update");
        assert_eq!(
            namespace
                .get_memory("mem-1", "ws-1")
                .unwrap()
                .unwrap()
                .title,
            "renamed"
        );

        let mut settings = ProjectMemorySettings::default();
        settings.auto_enabled = false;
        namespace.put_settings(&settings).expect("settings");
        assert!(!namespace.get_settings().unwrap().auto_enabled);

        namespace.upsert_embed(&sample_embed()).expect("embed");
        assert_eq!(namespace.list_embeds("ws-1").unwrap().len(), 1);
        namespace
            .delete_embeds("ws-1", &["mem-1".into()])
            .expect("delete embed");
        assert!(namespace.list_embeds("ws-1").unwrap().is_empty());

        namespace.delete_memory("mem-1", "ws-1").expect("delete");
        assert!(namespace.get_memory("mem-1", "ws-1").unwrap().is_none());
        assert!(namespace
            .data_file()
            .to_string_lossy()
            .ends_with("plugin-runtime/data/com.mossx.project-map/store.sqlite"));
        assert!(!namespace
            .data_file()
            .to_string_lossy()
            .contains("project-memory"));

        let registry = include_str!("../command_registry.rs");
        for command in crate::plugin_runtime::project_map_compat::PROJECT_MAP_COMMAND_IDS {
            assert!(registry.contains(command), "{command}");
        }
        assert!(
            crate::plugin_runtime::project_map_compat::project_map_compat_facade_enabled_from(
                None
            )
        );
        remove_path(Path::new(&root));
    }

    #[test]
    fn isolated_namespace_restores_deleted_persist_rows() {
        let root = unique_temp_root("project-map-rollback-rows");
        let mut namespace = ProjectMapNamespace::open(&root).expect("open namespace");
        namespace
            .put_map_file("ws-1", "key-1", "manifest.json", r#"{"keep":true}"#)
            .expect("put map");
        namespace
            .upsert_memory(&sample_memory("keep-me"))
            .expect("create memory");
        namespace.checkpoint().expect("checkpoint");
        namespace
            .put_map_file("ws-1", "key-1", "manifest.json", r#"{"keep":false}"#)
            .expect("overwrite");
        namespace.delete_memory("mem-1", "ws-1").expect("delete");
        assert!(namespace.get_memory("mem-1", "ws-1").unwrap().is_none());
        namespace.restore().expect("restore");
        assert_eq!(
            namespace
                .get_map_file("ws-1", "manifest.json")
                .unwrap()
                .unwrap(),
            r#"{"keep":true}"#
        );
        let restored = namespace
            .get_memory("mem-1", "ws-1")
            .expect("get")
            .expect("row back");
        assert_eq!(restored.title, "keep-me");
        assert!(!namespace
            .data_file()
            .to_string_lossy()
            .contains("project-memory"));
        remove_path(Path::new(&root));
    }

    #[test]
    fn import_legacy_once_copies_map_relations_and_memory_then_locks() {
        let root = unique_temp_root("project-map-import-once");
        let map_root = root.join("legacy/project-map");
        let relations_root = root.join("legacy/project-map-relations");
        let memory_root = root.join("legacy/project-memory");
        std::fs::create_dir_all(map_root.join("ws-key/backups")).expect("map dirs");
        std::fs::create_dir_all(relations_root.join("ws-key")).expect("rel dirs");
        std::fs::create_dir_all(memory_root.join("demo--abcd1234")).expect("mem dirs");
        std::fs::write(
            map_root.join("ws-key/manifest.json"),
            r#"{"schemaVersion":2}"#,
        )
        .expect("map file");
        std::fs::write(map_root.join("ws-key/backups/old.json"), r#"{"skip":true}"#)
            .expect("backup");
        std::fs::write(
            relations_root.join("ws-key/manifest.json"),
            r#"{"schemaVersion":1}"#,
        )
        .expect("rel file");
        std::fs::write(
            memory_root.join("settings.json"),
            r#"{"autoEnabled":false,"captureMode":"balanced","dedupeEnabled":true,"desensitizeEnabled":true,"workspaceOverrides":{}}"#,
        )
        .expect("settings");
        let item = sample_memory("imported");
        std::fs::write(
            memory_root.join("demo--abcd1234/2026-08-17.json"),
            serde_json::to_string(&vec![&item]).expect("date file"),
        )
        .expect("memory file");

        let namespace = ProjectMapNamespace::open(&root).expect("open");
        let first = namespace
            .import_legacy_once(&map_root, &relations_root, &memory_root)
            .expect("import");
        assert_eq!(first, 4);
        assert_eq!(
            namespace
                .get_map_file("ws-key", "manifest.json")
                .unwrap()
                .unwrap(),
            r#"{"schemaVersion":2}"#
        );
        assert!(namespace
            .get_map_file("ws-key", "backups/old.json")
            .unwrap()
            .is_none());
        assert_eq!(
            namespace
                .get_relation_file("ws-key", "manifest.json")
                .unwrap()
                .unwrap(),
            r#"{"schemaVersion":1}"#
        );
        assert!(!namespace.get_settings().unwrap().auto_enabled);
        assert_eq!(
            namespace
                .get_memory("mem-1", "ws-1")
                .unwrap()
                .unwrap()
                .title,
            "imported"
        );
        assert!(map_root.join("ws-key/manifest.json").exists());
        assert!(memory_root.join("settings.json").exists());
        let second = namespace
            .import_legacy_once(&map_root, &relations_root, &memory_root)
            .expect("second");
        assert_eq!(second, 0);
        assert!(namespace.import_lock_file().exists());
        remove_path(Path::new(&root));
    }
}
