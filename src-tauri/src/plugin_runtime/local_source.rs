//! Stage a local plugin repository into `{storage_root}/plugin-runtime/plugins/{pluginId}/`.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

use super::host::{ActivationRequest, HostError};

const SKIP_DIR_NAMES: &[&str] = &[".git", "node_modules", "target", ".omx", ".ccgui"];
const SKIP_FILE_NAMES: &[&str] = &[".DS_Store"];

fn err(code: &'static str, message: impl Into<String>) -> HostError {
    HostError {
        code,
        message: message.into(),
    }
}

pub fn plugins_root(storage_root: &Path) -> PathBuf {
    storage_root.join("plugin-runtime").join("plugins")
}

pub fn staged_plugin_dir(storage_root: &Path, plugin_id: &str) -> PathBuf {
    plugins_root(storage_root).join(plugin_id)
}

pub fn find_manifest(source: &Path) -> Result<PathBuf, HostError> {
    if source.is_file() {
        let name = source.file_name().and_then(|name| name.to_str()).unwrap_or("");
        if name == "plugin.json" || name == "manifest.json" {
            return Ok(source.to_path_buf());
        }
        return Err(err(
            "missing-manifest",
            format!("{} is not a plugin manifest", source.display()),
        ));
    }
    if !source.is_dir() {
        return Err(err(
            "missing-manifest",
            format!("{} is not a plugin directory", source.display()),
        ));
    }
    let candidates = [
        source.join(".mossx-plugin").join("plugin.json"),
        source.join("plugin.json"),
        source.join("manifest.json"),
    ];
    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            err(
                "missing-manifest",
                format!("no plugin.json under {}", source.display()),
            )
        })
}

pub fn plugin_root_from_manifest(manifest: &Path) -> PathBuf {
    let parent = manifest.parent().unwrap_or(manifest);
    if parent.file_name().and_then(|name| name.to_str()) == Some(".mossx-plugin") {
        parent.parent().unwrap_or(parent).to_path_buf()
    } else {
        parent.to_path_buf()
    }
}

pub fn read_plugin_id(manifest: &Path) -> Result<String, HostError> {
    let raw = fs::read_to_string(manifest).map_err(|error| {
        err(
            "missing-manifest",
            format!("cannot read {}: {error}", manifest.display()),
        )
    })?;
    let value: Value = serde_json::from_str(&raw).map_err(|error| {
        err(
            "missing-manifest",
            format!("invalid manifest {}: {error}", manifest.display()),
        )
    })?;
    value
        .get("pluginId")
        .and_then(Value::as_str)
        .filter(|plugin_id| !plugin_id.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| err("missing-manifest", "manifest is missing pluginId"))
}

pub fn activation_request_from_manifest(manifest: &Value) -> Result<ActivationRequest, HostError> {
    let plugin_id = manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .filter(|plugin_id| !plugin_id.is_empty())
        .ok_or_else(|| err("missing-manifest", "manifest is missing pluginId"))?
        .to_string();
    let unit = manifest
        .get("activationUnits")
        .and_then(Value::as_array)
        .and_then(|units| units.first())
        .ok_or_else(|| err("missing-manifest", "manifest is missing activationUnits"))?;
    let unit_id = unit
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| err("missing-manifest", "activation unit is missing id"))?
        .to_string();
    let required_entries = unit
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| err("missing-manifest", "activation unit is missing entries"))?
        .iter()
        .filter_map(Value::as_str)
        .map(ToOwned::to_owned)
        .collect();
    Ok(ActivationRequest {
        plugin_id,
        unit_id,
        required_entries,
    })
}

pub fn has_staged_manifest(storage_root: &Path, plugin_id: &str) -> bool {
    staged_activation_request(storage_root, plugin_id).is_ok()
}

pub fn staged_activation_request(
    storage_root: &Path,
    plugin_id: &str,
) -> Result<ActivationRequest, HostError> {
    let staged = staged_plugin_dir(storage_root, plugin_id);
    let manifest_path = find_manifest(&staged)?;
    let raw = fs::read_to_string(&manifest_path).map_err(|error| {
        err(
            "missing-manifest",
            format!("cannot read staged manifest: {error}"),
        )
    })?;
    let value: Value = serde_json::from_str(&raw)
        .map_err(|error| err("missing-manifest", format!("invalid staged manifest: {error}")))?;
    let request = activation_request_from_manifest(&value)?;
    if request.plugin_id != plugin_id {
        return Err(err(
            "plugin-id-mismatch",
            format!("expected {plugin_id}, found {}", request.plugin_id),
        ));
    }
    Ok(request)
}

pub fn stage_local_plugin(
    source: &Path,
    storage_root: &Path,
    expected_plugin_id: &str,
) -> Result<PathBuf, HostError> {
    let manifest = find_manifest(source)?;
    let plugin_id = read_plugin_id(&manifest)?;
    if plugin_id != expected_plugin_id {
        return Err(err(
            "plugin-id-mismatch",
            format!("expected {expected_plugin_id}, found {plugin_id}"),
        ));
    }
    let plugin_root = plugin_root_from_manifest(&manifest);
    let dest = staged_plugin_dir(storage_root, &plugin_id);
    if same_dir(&plugin_root, &dest) {
        write_provenance(&dest, &plugin_root, &plugin_id)?;
        return Ok(dest);
    }
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|error| {
            err(
                "invalid-storage",
                format!("cannot replace staged plugin: {error}"),
            )
        })?;
    }
    fs::create_dir_all(&dest).map_err(|error| {
        err(
            "invalid-storage",
            format!("cannot create staged plugin dir: {error}"),
        )
    })?;
    copy_tree(&plugin_root, &dest)?;
    write_provenance(&dest, &plugin_root, &plugin_id)?;
    Ok(dest)
}

fn same_dir(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn write_provenance(dest: &Path, source: &Path, plugin_id: &str) -> Result<(), HostError> {
    let staged_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let payload = json!({
        "pluginId": plugin_id,
        "sourcePath": source.display().to_string(),
        "stagedAtUnix": staged_at,
    });
    fs::write(dest.join(".mossx-install.json"), payload.to_string()).map_err(|error| {
        err(
            "invalid-storage",
            format!("cannot write install provenance: {error}"),
        )
    })
}

fn should_skip(name: &str, is_dir: bool) -> bool {
    if is_dir {
        SKIP_DIR_NAMES.contains(&name)
    } else {
        SKIP_FILE_NAMES.contains(&name)
    }
}

fn copy_tree(source: &Path, dest: &Path) -> Result<(), HostError> {
    let entries = fs::read_dir(source).map_err(|error| {
        err(
            "invalid-storage",
            format!("cannot read {}: {error}", source.display()),
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            err(
                "invalid-storage",
                format!("cannot read entry under {}: {error}", source.display()),
            )
        })?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        let file_type = entry.file_type().map_err(|error| {
            err(
                "invalid-storage",
                format!("cannot stat {}: {error}", entry.path().display()),
            )
        })?;
        if should_skip(&name_str, file_type.is_dir()) {
            continue;
        }
        let from = entry.path();
        let to = dest.join(&name);
        if file_type.is_dir() {
            fs::create_dir_all(&to).map_err(|error| {
                err(
                    "invalid-storage",
                    format!("cannot mkdir {}: {error}", to.display()),
                )
            })?;
            copy_tree(&from, &to)?;
        } else {
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    err(
                        "invalid-storage",
                        format!("cannot mkdir {}: {error}", parent.display()),
                    )
                })?;
            }
            fs::copy(&from, &to).map_err(|error| {
                err(
                    "invalid-storage",
                    format!("cannot copy {} -> {}: {error}", from.display(), to.display()),
                )
            })?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::disk_storage::{remove_path, unique_temp_root};

    fn write_notes_repo(root: &Path) {
        fs::create_dir_all(root.join(".mossx-plugin")).expect("mkdir");
        fs::create_dir_all(root.join("dist/ui")).expect("dist");
        fs::create_dir_all(root.join(".git")).expect("git");
        fs::write(
            root.join(".mossx-plugin/plugin.json"),
            r#"{
              "pluginId": "com.mossx.notes",
              "activationUnits": [
                { "id": "notes-main", "entries": ["notes-worker", "notes-ui"] }
              ]
            }"#,
        )
        .expect("manifest");
        fs::write(root.join("dist/worker.js"), "export const ok = true;").expect("worker");
        fs::write(root.join(".git/HEAD"), "ref: refs/heads/main").expect("git head");
        fs::write(root.join(".DS_Store"), "junk").expect("ds");
    }

    #[test]
    fn stages_notes_repo_and_skips_git() {
        let source = unique_temp_root("notes-src");
        let storage = unique_temp_root("notes-store");
        write_notes_repo(&source);
        let staged =
            stage_local_plugin(&source, &storage, "com.mossx.notes").expect("stage");
        assert_eq!(
            staged,
            storage.join("plugin-runtime/plugins/com.mossx.notes")
        );
        assert!(staged.join(".mossx-plugin/plugin.json").is_file());
        assert!(staged.join("dist/worker.js").is_file());
        assert!(staged.join(".mossx-install.json").is_file());
        assert!(!staged.join(".git").exists());
        assert!(!staged.join(".DS_Store").exists());
        let request = staged_activation_request(&storage, "com.mossx.notes").expect("request");
        assert_eq!(request.plugin_id, "com.mossx.notes");
        assert_eq!(request.unit_id, "notes-main");
        assert_eq!(
            request.required_entries,
            vec!["notes-worker".to_string(), "notes-ui".to_string()]
        );
        remove_path(&source);
        remove_path(&storage);
    }

    #[test]
    fn rejects_wrong_plugin_id() {
        let source = unique_temp_root("notes-wrong");
        let storage = unique_temp_root("notes-store-wrong");
        write_notes_repo(&source);
        let error = stage_local_plugin(&source, &storage, "com.mossx.project-map").unwrap_err();
        assert_eq!(error.code, "plugin-id-mismatch");
        assert!(!staged_plugin_dir(&storage, "com.mossx.notes").exists());
        remove_path(&source);
        remove_path(&storage);
    }

    #[test]
    fn rejects_missing_manifest() {
        let source = unique_temp_root("notes-empty");
        let storage = unique_temp_root("notes-store-empty");
        fs::create_dir_all(&source).expect("mkdir");
        let error = stage_local_plugin(&source, &storage, "com.mossx.notes").unwrap_err();
        assert_eq!(error.code, "missing-manifest");
        remove_path(&source);
        remove_path(&storage);
    }

    #[test]
    fn stages_sibling_independent_notes_repo_when_present() {
        let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../mossx-plugin-notes");
        if !repo.join(".mossx-plugin/plugin.json").is_file() {
            return;
        }
        let storage = unique_temp_root("notes-sibling");
        let staged =
            stage_local_plugin(&repo, &storage, "com.mossx.notes").expect("stage sibling repo");
        assert!(staged.join(".mossx-plugin/plugin.json").is_file());
        assert!(staged.join("dist/worker.js").is_file());
        assert!(staged.join(".mossx-install.json").is_file());
        assert!(!staged.join(".git").exists());
        let request = staged_activation_request(&storage, "com.mossx.notes").expect("request");
        assert_eq!(request.plugin_id, "com.mossx.notes");
        assert_eq!(request.unit_id, "notes-main");
        remove_path(&storage);
    }
}
