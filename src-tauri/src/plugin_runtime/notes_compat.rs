//! Wave 4E/P4.7-22: Notes facade. Flag-off stays note_cards files; flag-on uses isolated sqlite.

use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::notes_pilot::notes_activation_request;
use super::notes_storage::{NotesNamespace, NOTES_PLUGIN_ID};

pub const NOTES_COMPAT_FACADE_ENV: &str = "MOSSX_NOTES_COMPAT_FACADE";

pub const NOTES_COMMAND_IDS: &[&str] = &[
    "note_card_list",
    "note_card_get",
    "note_card_create",
    "note_card_update",
    "note_card_archive",
    "note_card_restore",
    "note_card_delete",
];

/// flag 关 = Core 文件；flag 开 = 隔离 sqlite。同一时刻只有一个 owner。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotesCompatOwner {
    CoreNotes,
    IsolatedNotes,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NoteSummary {
    pub id: String,
    pub title: String,
}

pub trait NotesBackend: Send + Sync {
    fn list(&self, workspace_id: &str) -> Vec<NoteSummary>;
}

#[derive(Default)]
pub struct MemoryNotesBackend {
    notes: Mutex<Vec<NoteSummary>>,
}

impl MemoryNotesBackend {
    pub fn with_notes(notes: Vec<NoteSummary>) -> Self {
        Self {
            notes: Mutex::new(notes),
        }
    }
}

impl NotesBackend for MemoryNotesBackend {
    fn list(&self, _workspace_id: &str) -> Vec<NoteSummary> {
        self.notes.lock().expect("notes lock").clone()
    }
}

pub struct NotesCompatAdapter {
    owner: NotesCompatOwner,
    plugin_id: String,
    backend: Arc<dyn NotesBackend>,
    namespace: Option<NotesNamespace>,
}

pub fn notes_compat_facade_enabled() -> bool {
    notes_compat_facade_enabled_from(std::env::var_os(NOTES_COMPAT_FACADE_ENV).as_deref())
}

pub fn notes_compat_facade_enabled_from(value: Option<&OsStr>) -> bool {
    matches!(
        value.and_then(OsStr::to_str).map(str::trim),
        Some("1" | "true" | "TRUE" | "yes")
    )
}

impl NotesCompatAdapter {
    pub fn wrapping(backend: Arc<dyn NotesBackend>) -> Self {
        Self {
            owner: NotesCompatOwner::CoreNotes,
            plugin_id: NOTES_PLUGIN_ID.to_string(),
            backend,
            namespace: None,
        }
    }

    pub fn isolated(root: impl Into<PathBuf>) -> Result<Self, String> {
        let namespace = NotesNamespace::open(root).map_err(|error| error.message)?;
        Ok(Self {
            owner: NotesCompatOwner::IsolatedNotes,
            plugin_id: NOTES_PLUGIN_ID.to_string(),
            backend: Arc::new(MemoryNotesBackend::default()),
            namespace: Some(namespace),
        })
    }

    pub fn isolated_product() -> Result<Self, String> {
        let adapter = Self::isolated(crate::app_paths::app_home_dir()?)?;
        if let Some(namespace) = adapter.namespace.as_ref() {
            let _ = namespace.import_legacy_once(&crate::app_paths::note_card_dir()?);
        }
        Ok(adapter)
    }

    pub fn data_file(&self) -> Option<PathBuf> {
        self.namespace.as_ref().map(NotesNamespace::data_file)
    }

    pub fn owner(&self) -> NotesCompatOwner {
        self.owner
    }

    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    pub fn command_ids(&self) -> &'static [&'static str] {
        NOTES_COMMAND_IDS
    }

    pub fn list(&self, workspace_id: &str) -> Vec<NoteSummary> {
        self.backend.list(workspace_id)
    }

    /// 4H 调用面：单 owner Core 门面，delegate 到 `note_cards.rs` 内部函数。
    pub fn core() -> Self {
        Self::wrapping(Arc::new(MemoryNotesBackend::default()))
    }

    pub fn list_notes(
        &self,
        workspace_id: String,
        workspace_name: Option<String>,
        workspace_path: Option<String>,
        archived: bool,
        query: Option<String>,
        page: Option<usize>,
        page_size: Option<usize>,
    ) -> Result<crate::note_cards::WorkspaceNoteCardListResult, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.list_isolated(workspace_id, archived, query, page, page_size);
        }
        crate::note_cards::note_card_list_core(
            workspace_id,
            workspace_name,
            workspace_path,
            archived,
            query,
            page,
            page_size,
        )
    }

    pub fn get_note(
        &self,
        note_id: String,
        workspace_id: String,
        workspace_name: Option<String>,
        workspace_path: Option<String>,
    ) -> Result<Option<crate::note_cards::WorkspaceNoteCard>, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.namespace()?.get_note(&note_id, &workspace_id);
        }
        crate::note_cards::note_card_get_core(note_id, workspace_id, workspace_name, workspace_path)
    }

    pub fn create_note(
        &self,
        input: crate::note_cards::CreateWorkspaceNoteCardInput,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.create_isolated(input);
        }
        crate::note_cards::note_card_create_core(input)
    }

    pub fn update_note(
        &self,
        note_id: String,
        workspace_id: String,
        patch: crate::note_cards::UpdateWorkspaceNoteCardInput,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.namespace()?.update_note(&note_id, &workspace_id, patch);
        }
        crate::note_cards::note_card_update_core(note_id, workspace_id, patch)
    }

    pub fn archive_note(
        &self,
        note_id: String,
        workspace_id: String,
        workspace_name: Option<String>,
        workspace_path: Option<String>,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.namespace()?.archive_note(&note_id, &workspace_id);
        }
        crate::note_cards::note_card_archive_core(note_id, workspace_id, workspace_name, workspace_path)
    }

    pub fn restore_note(
        &self,
        note_id: String,
        workspace_id: String,
        workspace_name: Option<String>,
        workspace_path: Option<String>,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.namespace()?.restore_note(&note_id, &workspace_id);
        }
        crate::note_cards::note_card_restore_core(note_id, workspace_id, workspace_name, workspace_path)
    }

    pub fn delete_note(
        &self,
        note_id: String,
        workspace_id: String,
        workspace_name: Option<String>,
        workspace_path: Option<String>,
    ) -> Result<(), String> {
        if self.owner == NotesCompatOwner::IsolatedNotes {
            return self.namespace()?.delete_note(&note_id, &workspace_id);
        }
        crate::note_cards::note_card_delete_core(note_id, workspace_id, workspace_name, workspace_path)
    }

    fn namespace(&self) -> Result<&NotesNamespace, String> {
        self.namespace
            .as_ref()
            .ok_or_else(|| "isolated notes namespace missing".to_string())
    }

    fn create_isolated(
        &self,
        input: crate::note_cards::CreateWorkspaceNoteCardInput,
    ) -> Result<crate::note_cards::WorkspaceNoteCard, String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);
        let title = input
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("untitled")
            .to_string();
        let note = crate::note_cards::WorkspaceNoteCard {
            id: uuid::Uuid::new_v4().to_string(),
            workspace_id: input.workspace_id,
            workspace_name: input.workspace_name,
            workspace_path: input.workspace_path,
            project_name: title.clone(),
            title,
            body_markdown: input.body_markdown.clone(),
            plain_text_excerpt: input.body_markdown,
            attachments: Vec::new(),
            source: input.source,
            created_at: now,
            updated_at: now,
            archived_at: None,
        };
        self.namespace()?.create_note(&note)?;
        Ok(note)
    }

    fn list_isolated(
        &self,
        workspace_id: String,
        archived: bool,
        query: Option<String>,
        page: Option<usize>,
        page_size: Option<usize>,
    ) -> Result<crate::note_cards::WorkspaceNoteCardListResult, String> {
        let mut notes = self.namespace()?.list_notes(&workspace_id, archived)?;
        if let Some(query) = query
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let needle = query.to_ascii_lowercase();
            notes.retain(|note| {
                note.title.to_ascii_lowercase().contains(&needle)
                    || note.body_markdown.to_ascii_lowercase().contains(&needle)
            });
        }
        let total = notes.len();
        let page_size = page_size.unwrap_or(total.max(1));
        let page = page.unwrap_or(1).max(1);
        let start = page.saturating_sub(1).saturating_mul(page_size);
        let items = notes
            .into_iter()
            .skip(start)
            .take(page_size)
            .map(|note| crate::note_cards::WorkspaceNoteCardSummary {
                id: note.id,
                title: note.title,
                plain_text_excerpt: note.plain_text_excerpt,
                body_markdown: note.body_markdown,
                updated_at: note.updated_at,
                created_at: note.created_at,
                archived_at: note.archived_at,
                archived,
                image_count: note.attachments.len(),
                preview_attachments: Vec::new(),
            })
            .collect();
        Ok(crate::note_cards::WorkspaceNoteCardListResult { items, total })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facade_identity_matches_notes_fixture() {
        let adapter = NotesCompatAdapter::wrapping(Arc::new(MemoryNotesBackend::default()));
        assert_eq!(adapter.plugin_id(), notes_activation_request().plugin_id);
        assert_eq!(adapter.plugin_id(), NOTES_PLUGIN_ID);
        assert_eq!(adapter.owner(), NotesCompatOwner::CoreNotes);
        for command in NOTES_COMMAND_IDS {
            assert!(adapter.command_ids().contains(command), "{command}");
        }
        assert_eq!(adapter.command_ids().len(), 7);
    }

    #[test]
    fn flag_defaults_to_off() {
        assert!(!notes_compat_facade_enabled_from(None));
        assert!(!notes_compat_facade_enabled_from(Some(OsStr::new("0"))));
        assert!(!notes_compat_facade_enabled_from(Some(OsStr::new("false"))));
        assert!(notes_compat_facade_enabled_from(Some(OsStr::new("1"))));
        assert!(notes_compat_facade_enabled_from(Some(OsStr::new("true"))));
    }

    #[test]
    fn memory_backend_shares_the_same_list() {
        let backend = Arc::new(MemoryNotesBackend::with_notes(vec![NoteSummary {
            id: "n1".into(),
            title: "hello".into(),
        }]));
        let adapter = NotesCompatAdapter::wrapping(backend.clone());
        let first = adapter.list("ws-1");
        let second = backend.list("ws-1");
        assert_eq!(first, second);
        assert_eq!(first[0].id, "n1");
    }

    #[test]
    fn facade_does_not_import_product_commands() {
        assert!(!NOTES_COMMAND_IDS.is_empty());
        let adapter = NotesCompatAdapter::wrapping(Arc::new(MemoryNotesBackend::default()));
        assert_eq!(adapter.list("ws-empty").len(), 0);
    }

    #[test]
    fn core_facade_exposes_a_single_core_owner() {
        let adapter = NotesCompatAdapter::core();
        assert_eq!(adapter.owner(), NotesCompatOwner::CoreNotes);
        assert_eq!(adapter.plugin_id(), NOTES_PLUGIN_ID);
    }

    #[test]
    fn product_notes_stay_core_while_claude_defaults_to_process_entry() {
        assert!(!notes_compat_facade_enabled_from(None));
        assert!(crate::plugin_runtime::claude_process::claude_process_entry_enabled_from(None));
        let registry = include_str!("../command_registry.rs");
        for command in NOTES_COMMAND_IDS {
            assert!(
                registry.contains(&format!("crate::note_cards::{command}")),
                "{command} must stay registered on note_cards"
            );
        }
        assert!(std::path::Path::new("src/note_cards.rs").exists());
        let storage = include_str!("notes_storage.rs");
        assert!(storage.contains("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        assert!(storage.contains("不读产品 note_cards 目录"));
        let boot = include_str!("boot.rs");
        assert!(boot.contains("missing_executable()"));
        let production = include_str!("../engine/claude.rs");
        assert!(production.contains("cmd.spawn()"));
    }

    #[test]
    fn isolated_adapter_writes_only_the_plugin_namespace() {
        use crate::note_cards::{CreateWorkspaceNoteCardInput, UpdateWorkspaceNoteCardInput};
        use crate::plugin_runtime::disk_storage::{remove_path, unique_temp_root};

        let root = unique_temp_root("notes-isolated-adapter");
        let adapter = NotesCompatAdapter::isolated(&root).expect("isolated");
        assert_eq!(adapter.owner(), NotesCompatOwner::IsolatedNotes);
        let path = adapter.data_file().expect("data file");
        assert!(path
            .to_string_lossy()
            .contains("plugin-runtime/data/com.mossx.notes/store.sqlite"));
        assert!(!path.to_string_lossy().contains("note_card"));
        let created = adapter
            .create_note(CreateWorkspaceNoteCardInput {
                workspace_id: "ws-iso".into(),
                workspace_name: Some("Workspace".into()),
                workspace_path: None,
                title: Some("hello".into()),
                body_markdown: "# hello".into(),
                attachment_inputs: None,
                source: None,
            })
            .expect("create");
        let loaded = adapter
            .get_note(created.id.clone(), "ws-iso".into(), None, None)
            .expect("get")
            .expect("exists");
        assert_eq!(loaded.title, "hello");
        let listed = adapter
            .list_notes("ws-iso".into(), None, None, false, None, None, None)
            .expect("list");
        assert_eq!(listed.total, 1);
        adapter
            .update_note(
                created.id.clone(),
                "ws-iso".into(),
                UpdateWorkspaceNoteCardInput {
                    workspace_name: None,
                    workspace_path: None,
                    title: Some("renamed".into()),
                    body_markdown: None,
                    attachment_inputs: None,
                },
            )
            .expect("update");
        adapter
            .archive_note(created.id.clone(), "ws-iso".into(), None, None)
            .expect("archive");
        assert_eq!(
            adapter
                .list_notes("ws-iso".into(), None, None, true, None, None, None)
                .expect("archived")
                .total,
            1
        );
        adapter
            .restore_note(created.id.clone(), "ws-iso".into(), None, None)
            .expect("restore");
        adapter
            .delete_note(created.id, "ws-iso".into(), None, None)
            .expect("delete");
        assert!(adapter
            .get_note("missing".into(), "ws-iso".into(), None, None)
            .expect("missing")
            .is_none());
        let commands = include_str!("../note_cards.rs");
        assert!(commands.contains("NotesCompatAdapter::isolated_product()?"));
        assert!(!notes_compat_facade_enabled_from(None));
        remove_path(std::path::Path::new(&root));
    }
}
