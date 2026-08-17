//! Project Map facade. Default off. Does not call production project_map / project_memory.

use std::ffi::OsStr;
use std::sync::{Arc, Mutex};

pub const PROJECT_MAP_PLUGIN_ID: &str = "com.mossx.project-map";
pub const PROJECT_MAP_COMPAT_FACADE_ENV: &str = "MOSSX_PROJECT_MAP_COMPAT_FACADE";

pub const PROJECT_MAP_COMMAND_IDS: &[&str] = &[
    "project_map_read",
    "project_map_write_snapshot",
    "project_map_relationship_scan",
    "project_map_relationship_read",
    "project_map_relationship_write_snapshot",
    "project_map_relationship_clear",
    "project_memory_get_settings",
    "project_memory_update_settings",
    "project_memory_list",
    "project_memory_get",
    "project_memory_create",
    "project_memory_update",
    "project_memory_delete",
    "project_memory_diagnostics",
    "project_memory_reconcile",
    "project_memory_capture_auto",
    "project_memory_embed_health",
    "project_memory_embed_text",
    "project_memory_embed_download",
    "project_memory_embed_remove",
    "project_memory_embed_index_list",
    "project_memory_embed_index_upsert",
    "project_memory_embed_index_delete",
    "project_memory_embed_index_clear",
];

/// flag 关 = Core 文件仍是唯一 owner。本刀不切产品 command。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectMapCompatOwner {
    CoreProjectMap,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectMapSnapshot {
    pub workspace_id: String,
    pub node_count: usize,
}

pub trait ProjectMapBackend: Send + Sync {
    fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot>;
}

#[derive(Default)]
pub struct MemoryProjectMapBackend {
    snapshots: Mutex<Vec<ProjectMapSnapshot>>,
}

impl MemoryProjectMapBackend {
    pub fn with_snapshots(snapshots: Vec<ProjectMapSnapshot>) -> Self {
        Self {
            snapshots: Mutex::new(snapshots),
        }
    }
}

impl ProjectMapBackend for MemoryProjectMapBackend {
    fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot> {
        self.snapshots
            .lock()
            .expect("project map lock")
            .iter()
            .find(|snapshot| snapshot.workspace_id == workspace_id)
            .cloned()
    }
}

pub struct ProjectMapCompatAdapter {
    owner: ProjectMapCompatOwner,
    plugin_id: String,
    backend: Arc<dyn ProjectMapBackend>,
}

pub fn project_map_compat_facade_enabled() -> bool {
    project_map_compat_facade_enabled_from(
        std::env::var_os(PROJECT_MAP_COMPAT_FACADE_ENV).as_deref(),
    )
}

pub fn project_map_compat_facade_enabled_from(value: Option<&OsStr>) -> bool {
    match value.and_then(OsStr::to_str).map(str::trim) {
        None | Some("") => false,
        Some("0" | "false" | "FALSE" | "no" | "off") => false,
        Some("1" | "true" | "TRUE" | "yes" | "on") => true,
        _ => false,
    }
}

impl ProjectMapCompatAdapter {
    pub fn wrapping(backend: Arc<dyn ProjectMapBackend>) -> Self {
        Self {
            owner: ProjectMapCompatOwner::CoreProjectMap,
            plugin_id: PROJECT_MAP_PLUGIN_ID.to_string(),
            backend,
        }
    }

    pub fn owner(&self) -> ProjectMapCompatOwner {
        self.owner
    }

    pub fn plugin_id(&self) -> &str {
        &self.plugin_id
    }

    pub fn command_ids(&self) -> &'static [&'static str] {
        PROJECT_MAP_COMMAND_IDS
    }

    pub fn read(&self, workspace_id: &str) -> Option<ProjectMapSnapshot> {
        self.backend.read(workspace_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn facade_identity_matches_project_map_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/valid/project-map-pilot.json"
        ))
        .expect("project-map fixture");
        let fixture_id = fixture
            .get("pluginId")
            .and_then(serde_json::Value::as_str)
            .expect("pluginId");
        let adapter = ProjectMapCompatAdapter::wrapping(Arc::new(MemoryProjectMapBackend::default()));
        assert_eq!(adapter.plugin_id(), fixture_id);
        assert_eq!(adapter.plugin_id(), PROJECT_MAP_PLUGIN_ID);
        assert_eq!(adapter.owner(), ProjectMapCompatOwner::CoreProjectMap);
        assert_eq!(adapter.command_ids(), PROJECT_MAP_COMMAND_IDS);
        assert_eq!(adapter.command_ids().len(), 24);
    }

    #[test]
    fn flag_defaults_to_off() {
        assert!(!project_map_compat_facade_enabled_from(None));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new(""))));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new("0"))));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new("false"))));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new("1"))));
        assert!(project_map_compat_facade_enabled_from(Some(OsStr::new("true"))));
        assert!(!project_map_compat_facade_enabled_from(Some(OsStr::new("maybe"))));
    }

    #[test]
    fn memory_backend_shares_the_same_snapshot() {
        let backend = Arc::new(MemoryProjectMapBackend::with_snapshots(vec![
            ProjectMapSnapshot {
                workspace_id: "ws-1".into(),
                node_count: 3,
            },
        ]));
        let adapter = ProjectMapCompatAdapter::wrapping(backend.clone());
        let first = adapter.read("ws-1");
        let second = backend.read("ws-1");
        assert_eq!(first, second);
        assert_eq!(first.expect("snapshot").node_count, 3);
        assert!(adapter.read("ws-missing").is_none());
    }

    #[test]
    fn product_command_registry_stays_on_core() {
        let registry = include_str!("../command_registry.rs");
        for command in PROJECT_MAP_COMMAND_IDS {
            assert!(
                registry.contains(command),
                "{command} must stay registered"
            );
        }
        assert!(registry.contains("crate::project_map::project_map_read"));
        assert!(registry.contains("crate::project_memory::commands::project_memory_list"));
        assert!(std::path::Path::new("src/project_map.rs").exists());
        assert!(std::path::Path::new("src/project_memory").exists());
        assert!(!project_map_compat_facade_enabled_from(None));
    }
}
