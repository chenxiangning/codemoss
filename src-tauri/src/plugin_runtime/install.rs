//! Product-path allowlisted install/uninstall. Notes and Claude only.

use super::claude_pilot::claude_lifecycle_activation_request;
use super::claude_process::{claude_process_entry_enabled, CLAUDE_PLUGIN_ID};
use super::contributions;
use super::host::{EntryDriver, HostError};
use super::lockfile::{self, DesiredState};
use super::notes_compat::notes_compat_facade_enabled;
use super::notes_pilot::notes_activation_request;
use super::notes_storage::NOTES_PLUGIN_ID;
use super::runtime::PluginRuntime;

pub fn is_install_allowlisted(plugin_id: &str) -> bool {
    plugin_id == NOTES_PLUGIN_ID || plugin_id == CLAUDE_PLUGIN_ID
}

pub fn require_allowlisted(plugin_id: &str) -> Result<(), HostError> {
    if is_install_allowlisted(plugin_id) {
        Ok(())
    } else {
        Err(HostError {
            code: "not-allowlisted",
            message: format!("{plugin_id} is not in the install allowlist"),
        })
    }
}

pub fn notes_commands_allowed() -> Result<(), String> {
    if !notes_compat_facade_enabled() {
        return Ok(());
    }
    if lockfile::product_desired(NOTES_PLUGIN_ID) == DesiredState::Uninstalled {
        return Err("plugin-uninstalled: com.mossx.notes".into());
    }
    Ok(())
}

pub fn claude_commands_allowed() -> Result<(), String> {
    claude_commands_allowed_from(claude_process_entry_enabled())
}

pub fn claude_commands_allowed_from(process_entry_enabled: bool) -> Result<(), String> {
    if !process_entry_enabled {
        return Ok(());
    }
    if lockfile::product_desired(CLAUDE_PLUGIN_ID) == DesiredState::Uninstalled {
        return Err("plugin-uninstalled: com.mossx.engine.claude".into());
    }
    Ok(())
}

pub fn restore_allowlisted<D: EntryDriver>(
    runtime: &mut PluginRuntime<D>,
) -> Result<(), HostError> {
    restore_notes(runtime)?;
    restore_claude(runtime)
}

fn restore_notes<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    match lockfile::product_desired(NOTES_PLUGIN_ID) {
        DesiredState::Installed => install_notes(runtime),
        DesiredState::Uninstalled => {
            runtime.host.mark_uninstalled(NOTES_PLUGIN_ID)?;
            contributions::revoke(NOTES_PLUGIN_ID);
            Ok(())
        }
    }
}

fn restore_claude<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    match lockfile::product_desired(CLAUDE_PLUGIN_ID) {
        DesiredState::Installed => install_claude(runtime),
        DesiredState::Uninstalled => {
            runtime.host.mark_uninstalled(CLAUDE_PLUGIN_ID)?;
            contributions::revoke(CLAUDE_PLUGIN_ID);
            Ok(())
        }
    }
}

pub fn install_plugin<D: EntryDriver>(
    runtime: &mut PluginRuntime<D>,
    plugin_id: &str,
) -> Result<(), HostError> {
    require_allowlisted(plugin_id)?;
    if plugin_id == CLAUDE_PLUGIN_ID {
        install_claude(runtime)
    } else {
        install_notes(runtime)
    }
}

pub fn uninstall_plugin<D: EntryDriver>(
    runtime: &mut PluginRuntime<D>,
    plugin_id: &str,
) -> Result<(), HostError> {
    require_allowlisted(plugin_id)?;
    if plugin_id == CLAUDE_PLUGIN_ID {
        uninstall_claude(runtime)
    } else {
        uninstall_notes(runtime)
    }
}

pub fn install_notes<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    require_allowlisted(NOTES_PLUGIN_ID)?;
    runtime.install_allowlisted(notes_activation_request())?;
    contributions::register_notes().map_err(|message| HostError {
        code: "contribution-failed",
        message,
    })?;
    lockfile::product_set(NOTES_PLUGIN_ID, DesiredState::Installed).map_err(|message| HostError {
        code: "lockfile",
        message,
    })
}

pub fn uninstall_notes<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    require_allowlisted(NOTES_PLUGIN_ID)?;
    lockfile::product_set(NOTES_PLUGIN_ID, DesiredState::Uninstalled).map_err(|message| {
        HostError {
            code: "lockfile",
            message,
        }
    })?;
    match runtime.uninstall_plugin(NOTES_PLUGIN_ID) {
        Ok(()) => {}
        Err(error) if error.code == "plugin-unavailable" => {
            runtime.host.mark_uninstalled(NOTES_PLUGIN_ID)?;
        }
        Err(error) => return Err(error),
    }
    contributions::revoke(NOTES_PLUGIN_ID);
    Ok(())
}

pub fn install_claude<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    require_allowlisted(CLAUDE_PLUGIN_ID)?;
    runtime.install_allowlisted(claude_lifecycle_activation_request())?;
    contributions::register_claude().map_err(|message| HostError {
        code: "contribution-failed",
        message,
    })?;
    lockfile::product_set(CLAUDE_PLUGIN_ID, DesiredState::Installed).map_err(|message| HostError {
        code: "lockfile",
        message,
    })
}

pub fn uninstall_claude<D: EntryDriver>(runtime: &mut PluginRuntime<D>) -> Result<(), HostError> {
    require_allowlisted(CLAUDE_PLUGIN_ID)?;
    lockfile::product_set(CLAUDE_PLUGIN_ID, DesiredState::Uninstalled).map_err(|message| {
        HostError {
            code: "lockfile",
            message,
        }
    })?;
    match runtime.uninstall_plugin(CLAUDE_PLUGIN_ID) {
        Ok(()) => {}
        Err(error) if error.code == "plugin-unavailable" => {
            runtime.host.mark_uninstalled(CLAUDE_PLUGIN_ID)?;
        }
        Err(error) => return Err(error),
    }
    contributions::revoke(CLAUDE_PLUGIN_ID);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_process::{decide_claude_spawn_owner, ClaudeSpawnOwner};
    use crate::plugin_runtime::contributions;
    use crate::plugin_runtime::host::{FakeDriver, HostConfig, SlotState};
    use crate::plugin_runtime::lockfile::{self, DesiredState};
    use crate::plugin_runtime::notes_storage::NOTES_PLUGIN_ID;
    use crate::plugin_runtime::runtime::PluginRuntime;
    use std::path::PathBuf;

    fn temp_lockfile(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!(
            "mossx-install-{name}-{}-{nanos}.json",
            std::process::id()
        ))
    }

    fn runtime(root: &std::path::Path) -> PluginRuntime<FakeDriver> {
        PluginRuntime::new(
            HostConfig::default(),
            FakeDriver::default(),
            "/fixture/workspace",
            root,
        )
        .expect("runtime")
    }

    #[test]
    fn allowlist_accepts_notes_and_claude_and_rejects_later_plugins() {
        assert!(is_install_allowlisted(NOTES_PLUGIN_ID));
        assert!(is_install_allowlisted(CLAUDE_PLUGIN_ID));
        assert!(require_allowlisted(CLAUDE_PLUGIN_ID).is_ok());
        assert_eq!(
            require_allowlisted("com.mossx.project-map")
                .unwrap_err()
                .code,
            "not-allowlisted"
        );
    }

    #[test]
    fn install_reaches_ready_and_uninstall_revokes() {
        contributions::reset_for_test();
        let path = temp_lockfile("loop");
        let root = std::env::temp_dir().join(format!(
            "mossx-install-store-{}-{}",
            std::process::id(),
            path.file_stem().unwrap().to_string_lossy()
        ));
        let _ = std::fs::remove_file(&path);
        lockfile::with_lockfile_path(&path, || {
            let mut runtime = runtime(&root);
            install_notes(&mut runtime).expect("install");
            assert_eq!(
                runtime.host.slot(NOTES_PLUGIN_ID).unwrap().state,
                SlotState::Ready
            );
            assert!(
                contributions::notes_live(),
                "{:?}",
                contributions::get(NOTES_PLUGIN_ID)
            );
            assert_eq!(
                lockfile::product_desired(NOTES_PLUGIN_ID),
                DesiredState::Installed
            );
            assert!(runtime.host.activate(notes_activation_request()).is_err());
            uninstall_notes(&mut runtime).expect("uninstall");
            assert_eq!(
                runtime.host.slot(NOTES_PLUGIN_ID).unwrap().state,
                SlotState::Uninstalled
            );
            assert!(!contributions::notes_live());
            assert_eq!(
                lockfile::product_desired(NOTES_PLUGIN_ID),
                DesiredState::Uninstalled
            );
            notes_commands_allowed().expect_err("uninstalled");
            let refused =
                crate::note_cards::note_card_list("ws".into(), None, None, false, None, None, None)
                    .expect_err("gate");
            assert!(refused.contains("plugin-uninstalled"), "{refused}");
        });
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        contributions::reset_for_test();
    }

    #[test]
    fn claude_install_reaches_ready_without_cli_and_uninstall_revokes() {
        contributions::reset_for_test();
        let path = temp_lockfile("claude-loop");
        let root = std::env::temp_dir().join(format!(
            "mossx-install-claude-{}-{}",
            std::process::id(),
            path.file_stem().unwrap().to_string_lossy()
        ));
        let _ = std::fs::remove_file(&path);
        lockfile::with_lockfile_path(&path, || {
            let request = claude_lifecycle_activation_request();
            assert_eq!(request.required_entries, vec!["claude-worker".to_string()]);
            assert!(!request
                .required_entries
                .iter()
                .any(|entry| entry == "claude-cli"));
            let mut runtime = runtime(&root);
            install_plugin(&mut runtime, CLAUDE_PLUGIN_ID).expect("install");
            assert_eq!(
                runtime.host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
                SlotState::Ready
            );
            assert!(
                contributions::claude_live(),
                "{:?}",
                contributions::get(CLAUDE_PLUGIN_ID)
            );
            assert_eq!(
                lockfile::product_desired(CLAUDE_PLUGIN_ID),
                DesiredState::Installed
            );
            assert!(runtime
                .host
                .activate(claude_lifecycle_activation_request())
                .is_err());
            uninstall_plugin(&mut runtime, CLAUDE_PLUGIN_ID).expect("uninstall");
            assert_eq!(
                runtime.host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
                SlotState::Uninstalled
            );
            assert!(!contributions::claude_live());
            assert_eq!(
                lockfile::product_desired(CLAUDE_PLUGIN_ID),
                DesiredState::Uninstalled
            );
            let refused = claude_commands_allowed().expect_err("uninstalled");
            assert!(refused.contains("plugin-uninstalled"), "{refused}");
            assert!(std::path::Path::new("src/engine/claude.rs").exists());
        });
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        contributions::reset_for_test();
    }

    #[test]
    fn uninstall_keeps_notes_sqlite() {
        contributions::reset_for_test();
        let path = temp_lockfile("keep-data");
        let root = std::env::temp_dir().join(format!(
            "mossx-install-keep-{}-{}",
            std::process::id(),
            path.file_stem().unwrap().to_string_lossy()
        ));
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        lockfile::with_lockfile_path(&path, || {
            let namespace =
                crate::plugin_runtime::notes_storage::NotesNamespace::open(&root).expect("sqlite");
            let sqlite = namespace.data_file();
            assert!(sqlite.exists());
            let mut runtime = runtime(&root);
            install_plugin(&mut runtime, NOTES_PLUGIN_ID).expect("install");
            uninstall_plugin(&mut runtime, NOTES_PLUGIN_ID).expect("uninstall");
            assert!(sqlite.exists());
            assert_eq!(
                lockfile::product_desired(NOTES_PLUGIN_ID),
                DesiredState::Uninstalled
            );
        });
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        contributions::reset_for_test();
    }

    #[test]
    fn restore_honors_uninstalled_lockfile() {
        contributions::reset_for_test();
        let path = temp_lockfile("restore");
        let root = std::env::temp_dir().join(format!(
            "mossx-restore-store-{}-{}",
            std::process::id(),
            path.file_stem().unwrap().to_string_lossy()
        ));
        let _ = std::fs::remove_file(&path);
        lockfile::with_lockfile_path(&path, || {
            lockfile::product_set(NOTES_PLUGIN_ID, DesiredState::Uninstalled).expect("write");
            let mut runtime = runtime(&root);
            restore_allowlisted(&mut runtime).expect("restore");
            assert_eq!(
                runtime.host.slot(NOTES_PLUGIN_ID).unwrap().state,
                SlotState::Uninstalled
            );
            assert!(!contributions::notes_live());
            assert_eq!(
                runtime.host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
                SlotState::Ready
            );
            assert!(contributions::claude_live());
            assert!(runtime.host.slot("com.mossx.project-map").is_none());
        });
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        contributions::reset_for_test();
    }

    #[test]
    fn restore_honors_uninstalled_claude_and_installed_notes() {
        contributions::reset_for_test();
        let path = temp_lockfile("restore-claude");
        let root = std::env::temp_dir().join(format!(
            "mossx-restore-claude-{}-{}",
            std::process::id(),
            path.file_stem().unwrap().to_string_lossy()
        ));
        let _ = std::fs::remove_file(&path);
        lockfile::with_lockfile_path(&path, || {
            lockfile::product_set(CLAUDE_PLUGIN_ID, DesiredState::Uninstalled).expect("write");
            let mut runtime = runtime(&root);
            restore_allowlisted(&mut runtime).expect("restore");
            assert_eq!(
                runtime.host.slot(CLAUDE_PLUGIN_ID).unwrap().state,
                SlotState::Uninstalled
            );
            assert!(!contributions::claude_live());
            assert_eq!(
                runtime.host.slot(NOTES_PLUGIN_ID).unwrap().state,
                SlotState::Ready
            );
            assert!(contributions::notes_live());
            assert!(runtime.host.slot("com.mossx.project-map").is_none());
            assert!(runtime.host.activate(notes_activation_request()).is_err());
        });
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_dir_all(&root);
        contributions::reset_for_test();
    }

    #[test]
    fn uninstalled_claude_refuses_spawn_before_decide() {
        contributions::reset_for_test();
        let path = temp_lockfile("claude-gate");
        let _ = std::fs::remove_file(&path);
        lockfile::with_lockfile_path(&path, || {
            lockfile::product_set(CLAUDE_PLUGIN_ID, DesiredState::Uninstalled).expect("write");
            let refused = claude_commands_allowed().expect_err("uninstalled");
            assert!(refused.contains("plugin-uninstalled"), "{refused}");
            claude_commands_allowed_from(false).expect("explicit off");
            assert_eq!(
                decide_claude_spawn_owner(false, None),
                ClaudeSpawnOwner::CoreCommand
            );
            assert!(std::path::Path::new("src/engine/claude.rs").exists());
            let production = include_str!("../engine/claude.rs");
            let gate = production
                .find("claude_commands_allowed")
                .expect("gate call");
            let decide = production
                .find("decide_claude_spawn_owner")
                .expect("decide call");
            assert!(gate < decide, "gate must precede decide");
            assert!(production.contains("try_resume_process_entry_turn"));
        });
        let _ = std::fs::remove_file(&path);
        contributions::reset_for_test();
    }
}
