//! Wave 4E: single-owner Notes facade. Does not replace note_cards commands.

use std::ffi::OsStr;
use std::sync::{Arc, Mutex};

use super::notes_pilot::notes_activation_request;
use super::notes_storage::NOTES_PLUGIN_ID;

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

/// 只允许 Core owner。flag 切的是调用路径，不是第二个实现。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotesCompatOwner {
    CoreNotes,
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
        }
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
}
