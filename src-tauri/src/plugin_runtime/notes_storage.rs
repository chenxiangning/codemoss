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

    pub fn data_file(&self) -> PathBuf {
        self.storage.data_file(NOTES_PLUGIN_ID)
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

    pub fn get_note(
        &self,
        note_id: &str,
        workspace_id: &str,
    ) -> Result<Option<crate::note_cards::WorkspaceNoteCard>, String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT id, workspace_id, workspace_name, workspace_path, project_name, title, \
                 body_markdown, plain_text_excerpt, attachments_json, source_json, created_at, \
                 updated_at, archived_at FROM notes WHERE id = ?1 AND workspace_id = ?2",
            )
            .map_err(|error| error.to_string())?;
        let mut rows = statement
            .query(rusqlite::params![note_id, workspace_id])
            .map_err(|error| error.to_string())?;
        match rows.next().map_err(|error| error.to_string())? {
            Some(row) => Ok(Some(row_to_note(row)?)),
            None => Ok(None),
        }
    }

    pub fn list_notes(
        &self,
        workspace_id: &str,
        archived: bool,
    ) -> Result<Vec<crate::note_cards::WorkspaceNoteCard>, String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let sql = if archived {
            "SELECT id, workspace_id, workspace_name, workspace_path, project_name, title, \
             body_markdown, plain_text_excerpt, attachments_json, source_json, created_at, \
             updated_at, archived_at FROM notes WHERE workspace_id = ?1 AND archived_at IS NOT NULL \
             ORDER BY updated_at DESC"
        } else {
            "SELECT id, workspace_id, workspace_name, workspace_path, project_name, title, \
             body_markdown, plain_text_excerpt, attachments_json, source_json, created_at, \
             updated_at, archived_at FROM notes WHERE workspace_id = ?1 AND archived_at IS NULL \
             ORDER BY updated_at DESC"
        };
        let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
        let mut rows = statement
            .query([workspace_id])
            .map_err(|error| error.to_string())?;
        let mut notes = Vec::new();
        while let Some(row) = rows.next().map_err(|error| error.to_string())? {
            notes.push(row_to_note(row)?);
        }
        Ok(notes)
    }

    pub fn update_note(
        &self,
        note_id: &str,
        workspace_id: &str,
        patch: crate::note_cards::UpdateWorkspaceNoteCardInput,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        let mut note = self
            .get_note(note_id, workspace_id)?
            .ok_or_else(|| "note card not found".to_string())?;
        if patch.workspace_name.is_some() {
            note.workspace_name = patch.workspace_name;
        }
        if patch.workspace_path.is_some() {
            note.workspace_path = patch.workspace_path;
        }
        if let Some(title) = patch.title {
            note.title = title;
        }
        if let Some(body) = patch.body_markdown {
            note.body_markdown = body;
        }
        note.updated_at = note.updated_at.saturating_add(1);
        let attachments_json =
            serde_json::to_string(&note.attachments).map_err(|error| error.to_string())?;
        let source_json = note
            .source
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|error| error.to_string())?;
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let changed = connection
            .execute(
                "UPDATE notes SET workspace_name = ?1, workspace_path = ?2, title = ?3, \
                 body_markdown = ?4, attachments_json = ?5, source_json = ?6, updated_at = ?7 \
                 WHERE id = ?8 AND workspace_id = ?9",
                rusqlite::params![
                    note.workspace_name,
                    note.workspace_path,
                    note.title,
                    note.body_markdown,
                    attachments_json,
                    source_json,
                    note.updated_at,
                    note.id,
                    note.workspace_id,
                ],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("note card not found".into());
        }
        Ok(note)
    }

    pub fn archive_note(
        &self,
        note_id: &str,
        workspace_id: &str,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        self.set_archived(note_id, workspace_id, Some(1))
    }

    pub fn restore_note(
        &self,
        note_id: &str,
        workspace_id: &str,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        self.set_archived(note_id, workspace_id, None)
    }

    pub fn checkpoint(&mut self) -> Result<String, String> {
        self.storage
            .checkpoint(NOTES_PLUGIN_ID, 2)
            .map_err(|error| error.message)
    }

    pub fn restore(&mut self) -> Result<u32, String> {
        self.storage
            .restore(NOTES_PLUGIN_ID)
            .map_err(|error| error.message)
    }

    pub fn delete_note(&self, note_id: &str, workspace_id: &str) -> Result<(), String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let changed = connection
            .execute(
                "DELETE FROM notes WHERE id = ?1 AND workspace_id = ?2",
                rusqlite::params![note_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("note card not found".into());
        }
        Ok(())
    }

    fn set_archived(
        &self,
        note_id: &str,
        workspace_id: &str,
        archived_at: Option<i64>,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        let connection = Connection::open(self.storage.data_file(NOTES_PLUGIN_ID))
            .map_err(|error| error.to_string())?;
        let changed = connection
            .execute(
                "UPDATE notes SET archived_at = ?1, updated_at = COALESCE(updated_at, 0) + 1 \
                 WHERE id = ?2 AND workspace_id = ?3",
                rusqlite::params![archived_at, note_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        if changed == 0 {
            return Err("note card not found".into());
        }
        self.get_note(note_id, workspace_id)?
            .ok_or_else(|| "note card not found".to_string())
    }
}

fn row_to_note(row: &rusqlite::Row<'_>) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
    let attachments_json: String = row.get(8).map_err(|error| error.to_string())?;
    let source_json: Option<String> = row.get(9).map_err(|error| error.to_string())?;
    Ok(crate::note_cards::WorkspaceNoteCard {
        id: row.get(0).map_err(|error| error.to_string())?,
        workspace_id: row.get(1).map_err(|error| error.to_string())?,
        workspace_name: row.get(2).map_err(|error| error.to_string())?,
        workspace_path: row.get(3).map_err(|error| error.to_string())?,
        project_name: row.get(4).map_err(|error| error.to_string())?,
        title: row.get(5).map_err(|error| error.to_string())?,
        body_markdown: row.get(6).map_err(|error| error.to_string())?,
        plain_text_excerpt: row.get(7).map_err(|error| error.to_string())?,
        attachments: serde_json::from_str(&attachments_json).map_err(|error| error.to_string())?,
        source: source_json
            .as_deref()
            .map(serde_json::from_str)
            .transpose()
            .map_err(|error| error.to_string())?,
        created_at: row.get(10).map_err(|error| error.to_string())?,
        updated_at: row.get(11).map_err(|error| error.to_string())?,
        archived_at: row.get(12).map_err(|error| error.to_string())?,
    })
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

    #[test]
    fn isolated_namespace_supports_full_crud_without_product_files() {
        use crate::note_cards::{UpdateWorkspaceNoteCardInput, WorkspaceNoteCard};

        let root = unique_temp_root("notes-full-crud");
        let namespace = NotesNamespace::open(&root).expect("open namespace");
        let note = WorkspaceNoteCard {
            id: "n-full".into(),
            workspace_id: "ws-full".into(),
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
        namespace.create_note(&note).expect("create");
        let loaded = namespace
            .get_note("n-full", "ws-full")
            .expect("get")
            .expect("exists");
        assert_eq!(loaded.title, "hello");
        let updated = namespace
            .update_note(
                "n-full",
                "ws-full",
                UpdateWorkspaceNoteCardInput {
                    workspace_name: None,
                    workspace_path: None,
                    title: Some("renamed".into()),
                    body_markdown: None,
                    attachment_inputs: None,
                },
            )
            .expect("update");
        assert_eq!(updated.title, "renamed");
        assert_eq!(namespace.list_notes("ws-full", false).unwrap().len(), 1);
        let archived = namespace.archive_note("n-full", "ws-full").expect("archive");
        assert!(archived.archived_at.is_some());
        assert_eq!(namespace.list_notes("ws-full", false).unwrap().len(), 0);
        assert_eq!(namespace.list_notes("ws-full", true).unwrap().len(), 1);
        let restored = namespace.restore_note("n-full", "ws-full").expect("restore");
        assert!(restored.archived_at.is_none());
        namespace.delete_note("n-full", "ws-full").expect("delete");
        assert!(namespace.get_note("n-full", "ws-full").unwrap().is_none());
        assert!(!namespace
            .storage
            .data_file(NOTES_PLUGIN_ID)
            .to_string_lossy()
            .contains("note_cards"));
        let registry = include_str!("../command_registry.rs");
        for command in crate::plugin_runtime::notes_compat::NOTES_COMMAND_IDS {
            assert!(
                registry.contains(&format!("crate::note_cards::{command}")),
                "{command}"
            );
        }
        assert!(!crate::plugin_runtime::notes_compat::notes_compat_facade_enabled_from(None));
        remove_path(Path::new(&root));
    }

    #[test]
    fn isolated_namespace_restores_deleted_note_rows() {
        use crate::note_cards::WorkspaceNoteCard;

        let root = unique_temp_root("notes-rollback-rows");
        let mut namespace = NotesNamespace::open(&root).expect("open namespace");
        let note = WorkspaceNoteCard {
            id: "n-rb".into(),
            workspace_id: "ws-rb".into(),
            workspace_name: Some("Workspace".into()),
            workspace_path: None,
            project_name: "Workspace".into(),
            title: "keep-me".into(),
            body_markdown: "# keep".into(),
            plain_text_excerpt: "keep".into(),
            attachments: Vec::new(),
            source: None,
            created_at: 1,
            updated_at: 2,
            archived_at: None,
        };
        namespace.create_note(&note).expect("create");
        namespace.checkpoint().expect("checkpoint");
        namespace.delete_note("n-rb", "ws-rb").expect("delete");
        assert!(namespace.get_note("n-rb", "ws-rb").unwrap().is_none());
        namespace.restore().expect("restore");
        let restored = namespace
            .get_note("n-rb", "ws-rb")
            .expect("get")
            .expect("row back");
        assert_eq!(restored.title, "keep-me");
        assert!(!namespace
            .data_file()
            .to_string_lossy()
            .contains("note_card"));
        let registry = include_str!("../command_registry.rs");
        for command in crate::plugin_runtime::notes_compat::NOTES_COMMAND_IDS {
            assert!(
                registry.contains(&format!("crate::note_cards::{command}")),
                "{command}"
            );
        }
        assert!(!crate::plugin_runtime::notes_compat::notes_compat_facade_enabled_from(None));
        remove_path(Path::new(&root));
    }
}
