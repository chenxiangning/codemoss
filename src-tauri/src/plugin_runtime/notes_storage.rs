//! Wave 4D: Notes namespace on injected DiskStorage. Does not read product note_cards.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::disk_storage::{remove_path, unique_temp_root, DiskStorage};
use super::storage::{MigrationPlan, StorageError};

pub const NOTES_PLUGIN_ID: &str = "com.mossx.notes";

const CREATE_NOTES_TABLE: &str = "CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    workspace_name TEXT,
    workspace_path TEXT,
    project_name TEXT NOT NULL,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    plain_text_excerpt TEXT NOT NULL,
    attachments_json TEXT NOT NULL,
    source_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    archived_at INTEGER
);";

pub fn open_notes_namespace(root: impl Into<PathBuf>) -> Result<DiskStorage, StorageError> {
    let mut storage = DiskStorage::open(root)?;
    storage.open_plugin(NOTES_PLUGIN_ID, "1.0.0", "1.0.0", 1)?;
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

/// 4J 安全片段：隔离 namespace 上的 notes 表 CRUD（写 + 读计数）。
/// 只操作 `plugin-runtime/data/com.mossx.notes/store.sqlite`，不读产品 note_cards 目录。
pub struct NotesNamespace {
    storage: DiskStorage,
}

impl NotesNamespace {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let storage = open_notes_namespace(root)?;
        let connection = Connection::open(storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| StorageError {
                code: "invalid-storage",
                message: error.to_string(),
            })?;
        connection.execute_batch(CREATE_NOTES_TABLE).map_err(|error| StorageError {
            code: "invalid-storage",
            message: error.to_string(),
        })?;
        Ok(Self { storage })
    }

    pub fn create_note(&self, note: &crate::note_cards::WorkspaceNoteCard) -> Result<(), String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let attachments_json =
            serde_json::to_string(&note.attachments).map_err(|error| error.to_string())?;
        let source_json = note
            .source
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|error| error.to_string())?;
        connection
            .execute(
                "INSERT INTO notes (id, workspace_id, workspace_name, workspace_path, project_name, \
                 title, body_markdown, plain_text_excerpt, attachments_json, source_json, \
                 created_at, updated_at, archived_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                rusqlite::params![
                    note.id,
                    note.workspace_id,
                    note.workspace_name,
                    note.workspace_path,
                    note.project_name,
                    note.title,
                    note.body_markdown,
                    note.plain_text_excerpt,
                    attachments_json,
                    source_json,
                    note.created_at,
                    note.updated_at,
                    note.archived_at,
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub fn count_notes(&self, workspace_id: &str) -> Result<usize, String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE workspace_id = ?1",
                [workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn injected_root_gets_notes_sqlite() {
        let root = unique_temp_root("notes-ns");
        let storage = open_notes_namespace(&root).expect("open notes");
        let path = storage.data_file(NOTES_PLUGIN_ID);
        assert!(path.ends_with("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        assert!(path.exists());
        assert!(!path.to_string_lossy().contains("note_cards"));
        remove_path(Path::new(&root));
    }

    #[test]
    fn notes_restore_returns_checkpoint_schema() {
        let root = unique_temp_root("notes-restore");
        let mut storage = open_notes_namespace(&root).expect("open notes");
        storage.checkpoint(NOTES_PLUGIN_ID, 2).expect("ckpt");
        storage
            .migrate(NOTES_PLUGIN_ID, compatible_plan(1, 2, 2))
            .expect("migrate");
        assert_eq!(storage.read_schema(NOTES_PLUGIN_ID).unwrap(), 2);
        storage.restore(NOTES_PLUGIN_ID).expect("restore");
        assert_eq!(storage.read_schema(NOTES_PLUGIN_ID).unwrap(), 1);
        remove_path(Path::new(&root));
    }

    #[test]
    fn notes_namespace_stores_and_counts_notes() {
        use crate::note_cards::WorkspaceNoteCard;

        let root = unique_temp_root("notes-crud");
        let namespace = NotesNamespace::open(&root).expect("open namespace");
        let note = WorkspaceNoteCard {
            id: "n1".into(),
            workspace_id: "ws-1".into(),
            workspace_name: Some("Workspace".into()),
            workspace_path: None,
            project_name: "Workspace".into(),
            title: "hello".into(),
            body_markdown: "# hello".into(),
            plain_text_excerpt: "hello".into(),
            attachments: Vec::new(),
            source: None,
            created_at: 1,
            updated_at: 2,
            archived_at: None,
        };
        assert_eq!(namespace.count_notes("ws-1").unwrap(), 0);
        namespace.create_note(&note).expect("create");
        assert_eq!(namespace.count_notes("ws-1").unwrap(), 1);
        assert_eq!(namespace.count_notes("ws-other").unwrap(), 0);
        // 隔离：不读产品 note_cards 目录。
        assert!(!namespace
            .storage
            .data_file(NOTES_PLUGIN_ID)
            .to_string_lossy()
            .contains("note_cards"));
        remove_path(Path::new(&root));
    }
}
