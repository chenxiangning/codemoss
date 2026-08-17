//! Host rack snapshot plus Notes-only install/uninstall.
//! Other declared plugs stay read-only. No Marketplace.

use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

use crate::plugin_runtime::boot::BootHost;
use crate::plugin_runtime::host::{Host, SlotState};
use crate::plugin_runtime::install;
use crate::plugin_runtime::lockfile::{self, DesiredState};
use crate::plugin_runtime::notes_storage::NOTES_PLUGIN_ID;

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
    pub product_path: String,
    pub circuit: String,
    pub core_owner: String,
    pub installable: bool,
    pub desired_state: String,
    pub contributions_live: bool,
    pub allowlisted_live: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginRackSnapshot {
    pub host_available: bool,
    pub host_enabled: bool,
    pub supervisor_live: bool,
    pub supervisor_pid: Option<u32>,
    pub supervisor_path: Option<String>,
    pub plugs: Vec<PluginRackPlug>,
}

fn product_circuit(plugin_id: &str) -> (&'static str, &'static str) {
    product_circuit_from(
        plugin_id,
        crate::plugin_runtime::claude_process::claude_process_entry_enabled(),
        crate::plugin_runtime::notes_compat::notes_compat_facade_enabled(),
    )
}

fn product_circuit_from(
    plugin_id: &str,
    claude_process_entry: bool,
    notes_isolated: bool,
) -> (&'static str, &'static str) {
    match plugin_id {
        "com.mossx.engine.claude" => {
            if claude_process_entry {
                ("process-entry", "live")
            } else {
                ("core-spawn", "fallback")
            }
        }
        "com.mossx.notes" => {
            if notes_isolated {
                ("isolated-sqlite", "live")
            } else {
                ("core-files", "fallback")
            }
        }
        _ => ("undeclared", "idle"),
    }
}

fn declared_plug(plug: &DeclaredPlug, state: &str, generation: u64, unit_id: Option<String>, live: bool) -> PluginRackPlug {
    let (product_path, circuit) = product_circuit(plug.plugin_id);
    let installable = install::is_install_allowlisted(plug.plugin_id);
    let desired = lockfile::product_desired(plug.plugin_id);
    let contributions_live = plug.plugin_id == NOTES_PLUGIN_ID
        && crate::plugin_runtime::contributions::notes_live();
    let allowlisted_live =
        installable && desired == DesiredState::Installed && contributions_live && live;
    PluginRackPlug {
        plugin_id: plug.plugin_id.to_string(),
        display_name: plug.display_name.to_string(),
        kind: plug.kind.to_string(),
        owner_class: plug.owner_class.to_string(),
        state: state.to_string(),
        generation,
        unit_id,
        live,
        product_path: product_path.to_string(),
        circuit: circuit.to_string(),
        core_owner: crate::plugin_runtime::disable::core_owner_for_plugin(plug.plugin_id)
            .as_str()
            .to_string(),
        installable,
        desired_state: desired.as_str().to_string(),
        contributions_live,
        allowlisted_live,
    }
}

fn declared_idle() -> Vec<PluginRackPlug> {
    DECLARED_PLUGS
        .iter()
        .map(|plug| declared_plug(plug, "idle", 0, None, false))
        .collect()
}

fn snapshot_from_host<D: crate::plugin_runtime::host::EntryDriver>(
    host: &Host<D>,
) -> PluginRackSnapshot {
    let plugs = DECLARED_PLUGS
        .iter()
        .map(|plug| match host.slot(plug.plugin_id) {
            Some(slot) => declared_plug(
                plug,
                Host::<D>::slot_state_name(slot.state),
                slot.generation,
                slot.unit_id.clone(),
                slot.state == SlotState::Ready,
            ),
            None => declared_plug(
                plug,
                Host::<D>::slot_state_name(SlotState::Idle),
                0,
                None,
                false,
            ),
        })
        .collect();
    PluginRackSnapshot {
        host_available: true,
        host_enabled: host.enabled(),
        supervisor_live: false,
        supervisor_pid: None,
        supervisor_path: None,
        plugs,
    }
}

pub fn unavailable_snapshot() -> PluginRackSnapshot {
    PluginRackSnapshot {
        host_available: false,
        host_enabled: false,
        supervisor_live: false,
        supervisor_pid: None,
        supervisor_path: None,
        plugs: declared_idle(),
    }
}

pub fn snapshot_boot_host(host: &BootHost) -> PluginRackSnapshot {
    let mut snapshot = snapshot_from_host(&host.host);
    snapshot.supervisor_pid = host.supervisor_pid();
    snapshot.supervisor_live = snapshot.supervisor_pid.is_some();
    snapshot.supervisor_path = host
        .supervisor_path()
        .map(|path| path.display().to_string());
    snapshot
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

fn with_boot_host(
    app: &tauri::AppHandle,
    run: impl FnOnce(&mut BootHost) -> Result<(), String>,
) -> Result<PluginRackSnapshot, String> {
    let Some(state) = app.try_state::<Mutex<BootHost>>() else {
        return Err("plugin-host-unavailable".into());
    };
    let mut guard = state.lock().map_err(|_| "plugin-rack-lock".to_string())?;
    run(&mut guard)?;
    Ok(snapshot_boot_host(&guard))
}

fn map_host_error(error: crate::plugin_runtime::host::HostError) -> String {
    format!("{}: {}", error.code, error.message)
}

#[tauri::command]
pub(crate) fn install_plugin(
    app: tauri::AppHandle,
    plugin_id: String,
) -> Result<PluginRackSnapshot, String> {
    with_boot_host(&app, |host| {
        install::install_plugin(&mut **host, &plugin_id).map_err(map_host_error)
    })
}

#[tauri::command]
pub(crate) fn uninstall_plugin(
    app: tauri::AppHandle,
    plugin_id: String,
) -> Result<PluginRackSnapshot, String> {
    with_boot_host(&app, |host| {
        install::uninstall_plugin(&mut **host, &plugin_id).map_err(map_host_error)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::boot::boot_host;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::contributions;
    use crate::plugin_runtime::host::{FakeDriver, HostConfig};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    fn with_temp_lockfile<T>(name: &str, run: impl FnOnce() -> T) -> T {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!(
            "mossx-rack-{name}-{}-{nanos}.json",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&path);
        contributions::reset_for_test();
        let result = lockfile::with_lockfile_path(&path, run);
        let _ = std::fs::remove_file(&path);
        contributions::reset_for_test();
        result
    }

    #[test]
    fn default_off_boot_lists_declared_idle_plugs() {
        with_temp_lockfile("idle", || {
        let host = boot_host().expect("boot");
        let snapshot = snapshot_boot_host(&host);
        assert!(snapshot.host_available);
        assert!(!snapshot.host_enabled);
        assert!(snapshot.supervisor_live);
        assert!(snapshot.supervisor_pid.is_some());
        assert_ne!(snapshot.supervisor_pid, Some(std::process::id()));
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
        assert_eq!(snapshot.plugs[0].product_path, "process-entry");
        assert_eq!(snapshot.plugs[0].circuit, "live");
        assert_eq!(snapshot.plugs[0].core_owner, "disabled");
        assert_eq!(snapshot.plugs[1].product_path, "isolated-sqlite");
        assert_eq!(snapshot.plugs[1].circuit, "live");
        assert_eq!(snapshot.plugs[1].core_owner, "disabled");
        assert!(snapshot.plugs[2..].iter().all(|plug| {
            plug.product_path == "undeclared"
                && plug.circuit == "idle"
                && plug.core_owner == "active"
        }));
        assert_eq!(snapshot.plugs[0].owner_class, "pilot");
        assert_eq!(snapshot.plugs[1].owner_class, "pilot");
        assert!(snapshot.plugs[2..].iter().all(|plug| plug.owner_class == "later-plugin"));
        for plug in &snapshot.plugs {
            assert!(host.host.slot(&plug.plugin_id).is_none());
        }
        assert!(snapshot.plugs[1].installable);
        assert_eq!(snapshot.plugs[1].desired_state, "installed");
        assert!(!snapshot.plugs[1].contributions_live);
        assert!(!snapshot.plugs[1].allowlisted_live);
        assert!(snapshot.plugs.iter().filter(|plug| plug.plugin_id != NOTES_PLUGIN_ID).all(|plug| {
            !plug.installable && plug.desired_state == "uninstalled" && !plug.contributions_live
        }));
        });
    }

    #[test]
    fn snapshot_reads_live_slots_without_activating() {
        with_temp_lockfile("live-slots", || {
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
        assert!(snapshot.plugs[1].installable);
        assert!(!snapshot.plugs[1].contributions_live);
        let _ = notes_activation_request();
        });
    }

    #[test]
    fn command_registry_exposes_snapshot_not_activate() {
        let registry = include_str!("command_registry.rs");
        assert!(registry.contains("get_plugin_rack_snapshot"));
        assert!(registry.contains("install_plugin"));
        assert!(registry.contains("uninstall_plugin"));
        assert!(!registry.contains("activate_plugin"));
        assert!(!registry.contains("plugin_runtime"));
        assert!(std::path::Path::new("src/engine/claude.rs").exists());
    }

    #[test]
    fn explicit_off_maps_product_circuits_to_fallback() {
        assert_eq!(
            product_circuit_from("com.mossx.engine.claude", false, true),
            ("core-spawn", "fallback")
        );
        assert_eq!(
            product_circuit_from("com.mossx.notes", true, false),
            ("core-files", "fallback")
        );
        assert_eq!(
            product_circuit_from("com.mossx.engine.codex", true, true),
            ("undeclared", "idle")
        );
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
