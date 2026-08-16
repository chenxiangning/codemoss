//! Read-only Host rack snapshot for the Market surface.
//! Does not activate, disable, or install plugins.

use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

use crate::plugin_runtime::boot::BootHost;
use crate::plugin_runtime::host::{Host, SlotState};

const DECLARED_PLUGS: &[DeclaredPlug] = &[
    DeclaredPlug {
        plugin_id: "com.mossx.engine.claude",
        display_name: "Claude Engine",
        kind: "engine",
        owner_class: "pilot",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.notes",
        display_name: "Notes",
        kind: "feature",
        owner_class: "pilot",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.project-map",
        display_name: "Project Map",
        kind: "feature",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.browser",
        display_name: "Browser",
        kind: "feature",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.intent-canvas",
        display_name: "Intent Canvas",
        kind: "feature",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.kanban",
        display_name: "Kanban",
        kind: "feature",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.codex",
        display_name: "Codex Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.gemini",
        display_name: "Gemini Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.grok",
        display_name: "Grok Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.kimi",
        display_name: "Kimi Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.opencode",
        display_name: "OpenCode Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
    DeclaredPlug {
        plugin_id: "com.mossx.engine.pi",
        display_name: "Pi Engine",
        kind: "engine",
        owner_class: "later-plugin",
    },
];

struct DeclaredPlug {
    plugin_id: &'static str,
    display_name: &'static str,
    kind: &'static str,
    owner_class: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginRackPlug {
    pub plugin_id: String,
    pub display_name: String,
    pub kind: String,
    pub owner_class: String,
    pub state: String,
    pub generation: u64,
    pub unit_id: Option<String>,
    pub live: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginRackSnapshot {
    pub host_available: bool,
    pub host_enabled: bool,
    pub plugs: Vec<PluginRackPlug>,
}

fn declared_idle() -> Vec<PluginRackPlug> {
    DECLARED_PLUGS
        .iter()
        .map(|plug| PluginRackPlug {
            plugin_id: plug.plugin_id.to_string(),
            display_name: plug.display_name.to_string(),
            kind: plug.kind.to_string(),
            owner_class: plug.owner_class.to_string(),
            state: "idle".to_string(),
            generation: 0,
            unit_id: None,
            live: false,
        })
        .collect()
}

fn snapshot_from_host<D: crate::plugin_runtime::host::EntryDriver>(
    host: &Host<D>,
) -> PluginRackSnapshot {
    let plugs = DECLARED_PLUGS
        .iter()
        .map(|plug| match host.slot(plug.plugin_id) {
            Some(slot) => PluginRackPlug {
                plugin_id: plug.plugin_id.to_string(),
                display_name: plug.display_name.to_string(),
                kind: plug.kind.to_string(),
                owner_class: plug.owner_class.to_string(),
                state: Host::<D>::slot_state_name(slot.state).to_string(),
                generation: slot.generation,
                unit_id: slot.unit_id.clone(),
                live: slot.state == SlotState::Ready,
            },
            None => PluginRackPlug {
                plugin_id: plug.plugin_id.to_string(),
                display_name: plug.display_name.to_string(),
                kind: plug.kind.to_string(),
                owner_class: plug.owner_class.to_string(),
                state: Host::<D>::slot_state_name(SlotState::Idle).to_string(),
                generation: 0,
                unit_id: None,
                live: false,
            },
        })
        .collect();
    PluginRackSnapshot {
        host_available: true,
        host_enabled: host.enabled(),
        plugs,
    }
}

pub fn unavailable_snapshot() -> PluginRackSnapshot {
    PluginRackSnapshot {
        host_available: false,
        host_enabled: false,
        plugs: declared_idle(),
    }
}

pub fn snapshot_boot_host(host: &BootHost) -> PluginRackSnapshot {
    snapshot_from_host(&host.host)
}

#[tauri::command]
pub(crate) fn get_plugin_rack_snapshot(
    app: tauri::AppHandle,
) -> Result<PluginRackSnapshot, String> {
    let Some(state) = app.try_state::<Mutex<BootHost>>() else {
        return Ok(unavailable_snapshot());
    };
    let Ok(guard) = state.lock() else {
        return Err("plugin-rack-lock".into());
    };
    Ok(snapshot_boot_host(&guard))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::boot::boot_host;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{FakeDriver, HostConfig};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    #[test]
    fn default_off_boot_lists_declared_idle_plugs() {
        let host = boot_host().expect("boot");
        let snapshot = snapshot_boot_host(&host);
        assert!(snapshot.host_available);
        assert!(!snapshot.host_enabled);
        assert_eq!(snapshot.plugs.len(), 12);
        assert_eq!(snapshot.plugs[0].plugin_id, "com.mossx.engine.claude");
        assert_eq!(snapshot.plugs[1].plugin_id, "com.mossx.notes");
        assert_eq!(snapshot.plugs[2].plugin_id, "com.mossx.project-map");
        assert_eq!(snapshot.plugs[3].plugin_id, "com.mossx.browser");
        assert_eq!(snapshot.plugs[4].plugin_id, "com.mossx.intent-canvas");
        assert_eq!(snapshot.plugs[5].plugin_id, "com.mossx.kanban");
        assert_eq!(snapshot.plugs[6].plugin_id, "com.mossx.engine.codex");
        assert_eq!(snapshot.plugs[7].plugin_id, "com.mossx.engine.gemini");
        assert_eq!(snapshot.plugs[8].plugin_id, "com.mossx.engine.grok");
        assert_eq!(snapshot.plugs[9].plugin_id, "com.mossx.engine.kimi");
        assert_eq!(snapshot.plugs[10].plugin_id, "com.mossx.engine.opencode");
        assert_eq!(snapshot.plugs[11].plugin_id, "com.mossx.engine.pi");
        assert!(snapshot.plugs.iter().all(|plug| plug.state == "idle"));
        assert!(snapshot.plugs.iter().all(|plug| !plug.live));
        assert_eq!(snapshot.plugs[0].owner_class, "pilot");
        assert_eq!(snapshot.plugs[1].owner_class, "pilot");
        assert!(snapshot.plugs[2..].iter().all(|plug| plug.owner_class == "later-plugin"));
        for plug in &snapshot.plugs {
            assert!(host.host.slot(&plug.plugin_id).is_none());
        }
    }

    #[test]
    fn snapshot_reads_live_slots_without_activating() {
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        host.activate(claude_activation_request()).expect("activate");
        let snapshot = snapshot_from_host(&host);
        assert!(snapshot.host_enabled);
        assert_eq!(snapshot.plugs[0].state, "ready");
        assert!(snapshot.plugs[0].live);
        assert_eq!(snapshot.plugs[1].state, "idle");
        assert!(!snapshot.plugs[1].live);
        let _ = notes_activation_request();
    }

    #[test]
    fn command_registry_exposes_snapshot_not_activate() {
        let registry = include_str!("command_registry.rs");
        assert!(registry.contains("get_plugin_rack_snapshot"));
        assert!(!registry.contains("activate_plugin"));
        assert!(!registry.contains("plugin_runtime"));
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
    }

    #[test]
    fn later_declared_plugs_come_from_ownership_inventory() {
        let inventory = include_str!("../../docs/architecture/plugin-platform/inventory/ownership.json");
        for plugin_id in [
            "com.mossx.project-map",
            "com.mossx.browser",
            "com.mossx.intent-canvas",
            "com.mossx.kanban",
            "com.mossx.engine.codex",
            "com.mossx.engine.gemini",
            "com.mossx.engine.grok",
            "com.mossx.engine.kimi",
            "com.mossx.engine.opencode",
            "com.mossx.engine.pi",
        ] {
            assert!(
                inventory.contains(&format!("\"targetPluginId\": \"{plugin_id}\"")),
                "{plugin_id} must already exist in ownership inventory"
            );
        }
    }
}
