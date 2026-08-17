//! Last-known-good artifact pins. Separate from product desired-state lockfile.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::storage::StorageError;

const LKG_LOCK_VERSION: u32 = 1;
pub const LKG_LOCK_FILE_NAME: &str = "plugin-lock.json";
pub const PRODUCT_LOCK_FILE_NAME: &str = "plugin-lockfile.json";
pub const PRODUCT_LKG_VERSION: &str = "1.0.0";

fn err(code: &'static str, message: impl Into<String>) -> StorageError {
    StorageError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthVerdict {
    Pass,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateOutcome {
    Committed(LkgPin),
    RolledBack { restored_schema: u32, lkg: LkgPin },
    Quarantined { restored_schema: Option<u32>, reason: &'static str },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LkgPin {
    pub plugin_id: String,
    pub plugin_version: String,
    pub checkpoint_id: String,
    pub schema_version: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StagedCandidate {
    pub plugin_id: String,
    pub candidate_version: String,
    pub checkpoint_id: String,
    pub from_schema: u32,
    pub to_schema: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct PluginLockDocument {
    version: u32,
    pins: BTreeMap<String, LkgPin>,
}

impl Default for PluginLockDocument {
    fn default() -> Self {
        Self {
            version: LKG_LOCK_VERSION,
            pins: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct LkgLedger {
    path: PathBuf,
    pins: BTreeMap<String, LkgPin>,
    staged: BTreeMap<String, StagedCandidate>,
}

impl LkgLedger {
    pub fn load(root: impl AsRef<Path>) -> Self {
        let path = root.as_ref().join(LKG_LOCK_FILE_NAME);
        let pins = read_pins(&path);
        Self {
            path,
            pins,
            staged: BTreeMap::new(),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn pin(&self, plugin_id: &str) -> Option<&LkgPin> {
        self.pins.get(plugin_id)
    }

    pub fn staged(&self, plugin_id: &str) -> Option<&StagedCandidate> {
        self.staged.get(plugin_id)
    }

    pub fn stage(&mut self, candidate: StagedCandidate) -> Result<(), StorageError> {
        if self.staged.contains_key(&candidate.plugin_id) {
            return Err(err("candidate-inflight", "an update candidate is already staged"));
        }
        self.staged
            .insert(candidate.plugin_id.clone(), candidate);
        Ok(())
    }

    pub fn take_staged(&mut self, plugin_id: &str) -> Result<StagedCandidate, StorageError> {
        self.staged
            .remove(plugin_id)
            .ok_or_else(|| err("candidate-required", "no staged update candidate"))
    }

    pub fn commit(&mut self, pin: LkgPin) -> Result<LkgPin, StorageError> {
        if pin.plugin_id.trim().is_empty() || pin.plugin_version.trim().is_empty() {
            return Err(err("schema", "LKG pin identity must be canonical"));
        }
        self.pins.insert(pin.plugin_id.clone(), pin.clone());
        persist(&self.path, &self.pins)?;
        Ok(pin)
    }
}

fn read_pins(path: &Path) -> BTreeMap<String, LkgPin> {
    let Ok(bytes) = std::fs::read(path) else {
        return BTreeMap::new();
    };
    serde_json::from_slice::<PluginLockDocument>(&bytes)
        .map(|document| document.pins)
        .unwrap_or_default()
}

fn persist(path: &Path, pins: &BTreeMap<String, LkgPin>) -> Result<(), StorageError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| err("invalid-storage", format!("mkdir lkg lock: {error}")))?;
    }
    let document = PluginLockDocument {
        version: LKG_LOCK_VERSION,
        pins: pins.clone(),
    };
    let payload = serde_json::to_vec_pretty(&document)
        .map_err(|error| err("invalid-storage", format!("encode lkg lock: {error}")))?;
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, payload)
        .map_err(|error| err("invalid-storage", format!("write lkg lock: {error}")))?;
    std::fs::rename(&temp, path)
        .map_err(|error| err("invalid-storage", format!("commit lkg lock: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::disk_storage::{remove_path, unique_temp_root};

    #[test]
    fn missing_lock_loads_empty_pins() {
        let root = unique_temp_root("lkg-missing");
        let ledger = LkgLedger::load(&root);
        assert!(ledger.pin("com.mossx.notes").is_none());
        assert_eq!(ledger.path(), root.join(LKG_LOCK_FILE_NAME));
        remove_path(&root);
    }

    #[test]
    fn commit_writes_plugin_lock_not_product_lockfile() {
        let root = unique_temp_root("lkg-write");
        let mut ledger = LkgLedger::load(&root);
        ledger
            .commit(LkgPin {
                plugin_id: "com.mossx.notes".into(),
                plugin_version: "1.1.0".into(),
                checkpoint_id: "ckpt-1".into(),
                schema_version: 2,
            })
            .expect("commit");
        assert!(root.join(LKG_LOCK_FILE_NAME).exists());
        assert!(!root.join(PRODUCT_LOCK_FILE_NAME).exists());
        let reloaded = LkgLedger::load(&root);
        let pin = reloaded.pin("com.mossx.notes").expect("pin");
        assert_eq!(pin.plugin_version, "1.1.0");
        assert_eq!(pin.schema_version, 2);
        remove_path(&root);
    }
}
