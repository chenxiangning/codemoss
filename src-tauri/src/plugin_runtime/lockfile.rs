//! Restart-surviving desired state for allowlisted plugs.
//! Missing file: Notes stays installed. Not localStorage.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::notes_storage::NOTES_PLUGIN_ID;

const LOCKFILE_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DesiredState {
    Installed,
    Uninstalled,
}

impl DesiredState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Uninstalled => "uninstalled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct PluginLockRecord {
    pub desired: DesiredState,
}

impl Default for DesiredState {
    fn default() -> Self {
        Self::Installed
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginLockfile {
    pub version: u32,
    pub plugs: BTreeMap<String, PluginLockRecord>,
}

impl Default for PluginLockfile {
    fn default() -> Self {
        Self {
            version: LOCKFILE_VERSION,
            plugs: BTreeMap::new(),
        }
    }
}

impl PluginLockfile {
    pub fn desired(&self, plugin_id: &str) -> DesiredState {
        self.plugs
            .get(plugin_id)
            .map(|record| record.desired)
            .unwrap_or_else(|| default_desired(plugin_id))
    }

    pub fn set(&mut self, plugin_id: &str, desired: DesiredState) {
        self.plugs.insert(
            plugin_id.to_string(),
            PluginLockRecord { desired },
        );
    }
}

fn default_desired(plugin_id: &str) -> DesiredState {
    if plugin_id == NOTES_PLUGIN_ID {
        DesiredState::Installed
    } else {
        DesiredState::Uninstalled
    }
}

thread_local! {
    static LOCKFILE_OVERRIDE: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

pub fn with_lockfile_path<T>(path: impl Into<PathBuf>, run: impl FnOnce() -> T) -> T {
    let path = path.into();
    LOCKFILE_OVERRIDE.with(|slot| {
        *slot.borrow_mut() = Some(path);
        let result = run();
        *slot.borrow_mut() = None;
        result
    })
}

pub fn product_path() -> Result<PathBuf, String> {
    if let Some(path) = LOCKFILE_OVERRIDE.with(|slot| slot.borrow().clone()) {
        return Ok(path);
    }
    Ok(crate::app_paths::app_home_dir()?.join("plugin-lockfile.json"))
}

pub fn read_from(path: &Path) -> PluginLockfile {
    let Ok(bytes) = std::fs::read(path) else {
        return PluginLockfile::default();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

pub fn write_to(path: &Path, lockfile: &PluginLockfile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_vec_pretty(lockfile).map_err(|error| error.to_string())?;
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, payload).map_err(|error| error.to_string())?;
    std::fs::rename(&temp, path).map_err(|error| error.to_string())
}

pub fn product_desired(plugin_id: &str) -> DesiredState {
    match product_path() {
        Ok(path) => read_from(&path).desired(plugin_id),
        Err(_) => default_desired(plugin_id),
    }
}

pub fn product_set(plugin_id: &str, desired: DesiredState) -> Result<(), String> {
    let path = product_path()?;
    let mut lockfile = read_from(&path);
    lockfile.version = LOCKFILE_VERSION;
    lockfile.set(plugin_id, desired);
    write_to(&path, &lockfile)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_lockfile(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!(
            "mossx-lockfile-{name}-{}-{nanos}.json",
            std::process::id()
        ))
    }

    #[test]
    fn missing_lockfile_defaults_notes_to_installed() {
        let path = temp_lockfile("missing");
        let _ = std::fs::remove_file(&path);
        assert_eq!(
            read_from(&path).desired(NOTES_PLUGIN_ID),
            DesiredState::Installed
        );
        assert_eq!(
            read_from(&path).desired("com.mossx.engine.claude"),
            DesiredState::Uninstalled
        );
    }

    #[test]
    fn uninstall_survives_a_new_lockfile_read() {
        let path = temp_lockfile("persist");
        let _ = std::fs::remove_file(&path);
        with_lockfile_path(&path, || {
            product_set(NOTES_PLUGIN_ID, DesiredState::Uninstalled).expect("write");
            assert_eq!(
                product_desired(NOTES_PLUGIN_ID),
                DesiredState::Uninstalled
            );
        });
        assert_eq!(
            read_from(&path).desired(NOTES_PLUGIN_ID),
            DesiredState::Uninstalled
        );
        let _ = std::fs::remove_file(&path);
    }
}
