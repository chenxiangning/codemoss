//! Protocol step 7: disable Core owners without deleting them.
//! Slim / Marketplace stay forbidden.

use std::ffi::OsStr;

use super::claude_process::claude_process_entry_enabled_from;
use super::notes_compat::notes_compat_facade_enabled_from;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreOwnerStatus {
    Disabled,
    Fallback,
    Active,
}

impl CoreOwnerStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::Fallback => "fallback",
            Self::Active => "active",
        }
    }
}

pub fn claude_core_owner() -> CoreOwnerStatus {
    claude_core_owner_from(std::env::var_os("MOSSX_CLAUDE_PROCESS_ENTRY").as_deref())
}

pub fn notes_core_owner() -> CoreOwnerStatus {
    notes_core_owner_from(std::env::var_os("MOSSX_NOTES_COMPAT_FACADE").as_deref())
}

pub fn claude_core_owner_from(value: Option<&OsStr>) -> CoreOwnerStatus {
    if claude_process_entry_enabled_from(value) {
        CoreOwnerStatus::Disabled
    } else {
        CoreOwnerStatus::Fallback
    }
}

pub fn notes_core_owner_from(value: Option<&OsStr>) -> CoreOwnerStatus {
    if notes_compat_facade_enabled_from(value) {
        CoreOwnerStatus::Disabled
    } else {
        CoreOwnerStatus::Fallback
    }
}

pub fn core_owner_for_plugin(plugin_id: &str) -> CoreOwnerStatus {
    match plugin_id {
        "com.mossx.engine.claude" => claude_core_owner(),
        "com.mossx.notes" => notes_core_owner(),
        _ => CoreOwnerStatus::Active,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_default_disables_core_owners_without_deleting_them() {
        assert_eq!(claude_core_owner_from(None), CoreOwnerStatus::Disabled);
        assert_eq!(notes_core_owner_from(None), CoreOwnerStatus::Disabled);
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
        assert!(std::path::Path::new("src/note_cards.rs").exists());
        let claude = include_str!("../engine/claude.rs");
        assert!(claude.contains("cmd.spawn()"));
        let notes = include_str!("../note_cards.rs");
        assert!(notes.contains("fn note_card_list_core"));
        assert!(notes.contains("fn note_card_create_core"));
        let registry = include_str!("../command_registry.rs");
        assert!(registry.contains("crate::note_cards::note_card_list"));
        assert!(!registry.contains("activate_plugin"));
        assert!(!registry.contains("install_plugin"));
    }

    #[test]
    fn explicit_off_restores_core_fallback_and_later_plugins_stay_active() {
        assert_eq!(
            claude_core_owner_from(Some(OsStr::new("0"))),
            CoreOwnerStatus::Fallback
        );
        assert_eq!(
            notes_core_owner_from(Some(OsStr::new("0"))),
            CoreOwnerStatus::Fallback
        );
        assert_eq!(
            core_owner_for_plugin("com.mossx.engine.codex"),
            CoreOwnerStatus::Active
        );
        assert_eq!(
            core_owner_for_plugin("com.mossx.kanban"),
            CoreOwnerStatus::Active
        );
    }
}
