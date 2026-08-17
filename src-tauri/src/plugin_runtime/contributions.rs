//! Atomic contribution registry. Register or revoke a plug's set in one lock.

use std::collections::BTreeMap;
#[cfg(not(test))]
use std::sync::{Mutex, OnceLock};

use super::claude_process::CLAUDE_PLUGIN_ID;
use super::notes_compat::NOTES_COMMAND_IDS;
use super::notes_storage::NOTES_PLUGIN_ID;
use super::project_map_compat::PROJECT_MAP_COMMAND_IDS;
use super::project_map_storage::PROJECT_MAP_PLUGIN_ID;

const NOTES_VIEW_ID: &str = "notes.main";
const CLAUDE_VIEW_ID: &str = "claude.engine";
const CLAUDE_COMMAND_IDS: &[&str] = &["claude.spawn"];
const PROJECT_MAP_VIEW_IDS: &[&str] = &["project-map.main", "project-map.memory"];

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ContributionSet {
    pub views: Vec<String>,
    pub commands: Vec<String>,
}

impl ContributionSet {
    pub fn is_empty(&self) -> bool {
        self.views.is_empty() && self.commands.is_empty()
    }

    pub fn contains_view(&self, view_id: &str) -> bool {
        self.views.iter().any(|id| id == view_id)
    }

    pub fn contains_command(&self, command_id: &str) -> bool {
        self.commands.iter().any(|id| id == command_id)
    }
}

fn with_registry<T>(
    run: impl FnOnce(&mut BTreeMap<String, ContributionSet>) -> T,
) -> Result<T, String> {
    #[cfg(test)]
    {
        thread_local! {
            static REGISTRY: std::cell::RefCell<BTreeMap<String, ContributionSet>> =
                const { std::cell::RefCell::new(BTreeMap::new()) };
        }
        return Ok(REGISTRY.with(|slot| run(&mut slot.borrow_mut())));
    }
    #[cfg(not(test))]
    {
        static REGISTRY: OnceLock<Mutex<BTreeMap<String, ContributionSet>>> = OnceLock::new();
        let mut guard = REGISTRY
            .get_or_init(|| Mutex::new(BTreeMap::new()))
            .lock()
            .map_err(|_| "contribution-registry-lock".to_string())?;
        Ok(run(&mut guard))
    }
}

pub fn notes_contributions() -> ContributionSet {
    ContributionSet {
        views: vec![NOTES_VIEW_ID.to_string()],
        commands: NOTES_COMMAND_IDS
            .iter()
            .map(|command_id| (*command_id).to_string())
            .collect(),
    }
}

pub fn register(plugin_id: &str, set: ContributionSet) -> Result<(), String> {
    if plugin_id.trim().is_empty() || plugin_id != plugin_id.trim() {
        return Err("pluginId must be canonical".into());
    }
    if set.is_empty() {
        return Err("contribution set must not be empty".into());
    }
    with_registry(|guard| {
        guard.insert(plugin_id.to_string(), set);
    })
}

pub fn register_notes() -> Result<(), String> {
    register(NOTES_PLUGIN_ID, notes_contributions())
}

pub fn claude_contributions() -> ContributionSet {
    ContributionSet {
        views: vec![CLAUDE_VIEW_ID.to_string()],
        commands: CLAUDE_COMMAND_IDS
            .iter()
            .map(|command_id| (*command_id).to_string())
            .collect(),
    }
}

pub fn register_claude() -> Result<(), String> {
    register(CLAUDE_PLUGIN_ID, claude_contributions())
}

pub fn project_map_contributions() -> ContributionSet {
    ContributionSet {
        views: PROJECT_MAP_VIEW_IDS
            .iter()
            .map(|view_id| (*view_id).to_string())
            .collect(),
        commands: PROJECT_MAP_COMMAND_IDS
            .iter()
            .map(|command_id| (*command_id).to_string())
            .collect(),
    }
}

pub fn register_project_map() -> Result<(), String> {
    register(PROJECT_MAP_PLUGIN_ID, project_map_contributions())
}

pub fn revoke(plugin_id: &str) {
    let _ = with_registry(|guard| {
        guard.remove(plugin_id);
    });
}

pub fn get(plugin_id: &str) -> ContributionSet {
    with_registry(|guard| guard.get(plugin_id).cloned())
        .ok()
        .flatten()
        .unwrap_or_default()
}

pub fn notes_live() -> bool {
    let set = get(NOTES_PLUGIN_ID);
    set.contains_view(NOTES_VIEW_ID)
        && NOTES_COMMAND_IDS
            .iter()
            .all(|command_id| set.contains_command(command_id))
}

pub fn claude_live() -> bool {
    let set = get(CLAUDE_PLUGIN_ID);
    set.contains_view(CLAUDE_VIEW_ID)
        && CLAUDE_COMMAND_IDS
            .iter()
            .all(|command_id| set.contains_command(command_id))
}

pub fn project_map_live() -> bool {
    let set = get(PROJECT_MAP_PLUGIN_ID);
    PROJECT_MAP_VIEW_IDS
        .iter()
        .all(|view_id| set.contains_view(view_id))
        && PROJECT_MAP_COMMAND_IDS
            .iter()
            .all(|command_id| set.contains_command(command_id))
}

#[cfg(test)]
pub fn reset_for_test() {
    let _ = with_registry(|guard| {
        guard.clear();
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notes_register_is_atomic_and_revoke_clears_all() {
        reset_for_test();
        register_notes().expect("register");
        assert!(notes_live());
        let set = get(NOTES_PLUGIN_ID);
        assert_eq!(set.views, vec![NOTES_VIEW_ID]);
        assert_eq!(set.commands.len(), NOTES_COMMAND_IDS.len());
        revoke(NOTES_PLUGIN_ID);
        assert!(!notes_live());
        assert!(get(NOTES_PLUGIN_ID).is_empty());
    }

    #[test]
    fn claude_register_is_atomic_and_revoke_clears_all() {
        reset_for_test();
        register_claude().expect("register");
        assert!(claude_live());
        let set = get(CLAUDE_PLUGIN_ID);
        assert_eq!(set.views, vec![CLAUDE_VIEW_ID]);
        assert_eq!(set.commands, vec!["claude.spawn"]);
        revoke(CLAUDE_PLUGIN_ID);
        assert!(!claude_live());
        assert!(get(CLAUDE_PLUGIN_ID).is_empty());
    }

    #[test]
    fn project_map_register_is_atomic_and_revoke_clears_all() {
        reset_for_test();
        register_project_map().expect("register");
        assert!(project_map_live());
        let set = get(PROJECT_MAP_PLUGIN_ID);
        assert_eq!(
            set.views,
            vec![
                "project-map.main".to_string(),
                "project-map.memory".to_string()
            ]
        );
        assert_eq!(set.commands.len(), PROJECT_MAP_COMMAND_IDS.len());
        revoke(PROJECT_MAP_PLUGIN_ID);
        assert!(!project_map_live());
        assert!(get(PROJECT_MAP_PLUGIN_ID).is_empty());
    }
}
