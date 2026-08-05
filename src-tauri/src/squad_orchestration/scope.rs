use std::collections::{BTreeMap, BTreeSet};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntryFingerprintV1 {
    pub path: String,
    pub content_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFingerprintV1 {
    pub root: String,
    pub digest: String,
    #[serde(default)]
    pub git_head: Option<String>,
    pub entries: Vec<WorkspaceEntryFingerprintV1>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeFenceResultV1 {
    pub before_digest: String,
    pub after_digest: String,
    pub observed_changed_paths: Vec<String>,
}

pub fn canonical_workspace_root(workspace_path: &str) -> Result<PathBuf, String> {
    let root = Path::new(workspace_path);
    if !root.is_absolute() {
        return Err("scope-denied: workspace root must be absolute".to_string());
    }
    root.canonicalize()
        .map_err(|error| format!("scope-denied: canonicalize workspace root: {error}"))
}

fn normalize_relative_path(path: &Path) -> Result<PathBuf, String> {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => normalized.push(value),
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err("scope-denied: path escapes workspace".to_string());
                }
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("scope-denied: expected workspace-relative path".to_string());
            }
        }
    }
    Ok(normalized)
}

fn credential_or_control_path(path: &Path) -> bool {
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy().to_ascii_lowercase();
        matches!(
            value.as_str(),
            ".git"
                | ".ssh"
                | ".aws"
                | ".azure"
                | ".docker"
                | ".gnupg"
                | ".kube"
                | ".env"
                | ".git-credentials"
                | ".netrc"
                | ".npmrc"
                | ".pypirc"
                | "credentials"
                | "gcloud"
                | "id_rsa"
                | "id_ed25519"
                | "secrets"
        ) || value.starts_with(".env.")
            || value.ends_with(".pem")
            || value.ends_with(".key")
            || value.ends_with(".p12")
            || value.ends_with(".pfx")
    })
}

pub fn validate_workspace_path(workspace_id: &str, candidate: &str) -> Result<String, String> {
    let candidate = candidate.trim();
    if candidate.is_empty() {
        return Err("scope-denied: changed path must be non-empty".to_string());
    }
    if candidate.contains("://") || candidate.starts_with("git@") {
        return Err("scope-denied: remote targets are outside Squad V1 authority".to_string());
    }
    let root = canonical_workspace_root(workspace_id)?;
    let raw = Path::new(candidate);
    let relative = if raw.is_absolute() {
        raw.strip_prefix(&root)
            .map_err(|_| "scope-denied: absolute path is outside workspace".to_string())?
            .to_path_buf()
    } else {
        normalize_relative_path(raw)?
    };
    if credential_or_control_path(&relative) {
        return Err(format!(
            "scope-denied: '{}' is a credential or repository-control path",
            relative.display()
        ));
    }
    let joined = root.join(&relative);
    let mut existing = joined.as_path();
    while !existing.exists() {
        existing = existing
            .parent()
            .ok_or_else(|| "scope-denied: path has no existing workspace ancestor".to_string())?;
    }
    let canonical_ancestor = existing
        .canonicalize()
        .map_err(|error| format!("scope-denied: canonicalize path ancestor: {error}"))?;
    if !canonical_ancestor.starts_with(&root) {
        return Err(format!(
            "scope-denied: '{}' resolves outside workspace",
            relative.display()
        ));
    }
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn git_paths(root: &Path, args: &[&str]) -> Result<Vec<PathBuf>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|error| format!("change-fence-unavailable: run git: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "change-fence-unavailable: git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(output
        .stdout
        .split(|byte| *byte == 0)
        .filter(|raw| !raw.is_empty())
        .map(|raw| PathBuf::from(String::from_utf8_lossy(raw).into_owned()))
        .collect())
}

fn entry_digest(path: &Path) -> Result<String, String> {
    let bytes = if path.is_symlink() {
        std::fs::read_link(path)
            .map(|target| target.to_string_lossy().into_owned().into_bytes())
            .map_err(|error| format!("change-fence-unavailable: read symlink: {error}"))?
    } else if path.is_file() {
        std::fs::read(path)
            .map_err(|error| format!("change-fence-unavailable: read file: {error}"))?
    } else if path.exists() {
        b"directory".to_vec()
    } else {
        b"deleted".to_vec()
    };
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

pub fn capture_workspace_fingerprint(workspace_id: &str) -> Result<WorkspaceFingerprintV1, String> {
    let root = canonical_workspace_root(workspace_id)?;
    let git_head_output = Command::new("git")
        .arg("-C")
        .arg(&root)
        .args(["rev-parse", "--verify", "HEAD"])
        .output()
        .map_err(|error| format!("change-fence-unavailable: read git HEAD: {error}"))?;
    let git_head = git_head_output
        .status
        .success()
        .then(|| {
            String::from_utf8_lossy(&git_head_output.stdout)
                .trim()
                .to_string()
        })
        .filter(|value| !value.is_empty());
    let mut paths = BTreeSet::new();
    for args in [
        ["diff", "--name-only", "-z"].as_slice(),
        ["diff", "--cached", "--name-only", "-z"].as_slice(),
        ["ls-files", "--others", "--exclude-standard", "-z"].as_slice(),
    ] {
        paths.extend(git_paths(&root, args)?);
    }
    let mut entries = Vec::with_capacity(paths.len());
    for path in paths {
        let normalized = validate_workspace_path(
            root.to_string_lossy().as_ref(),
            path.to_string_lossy().as_ref(),
        )?;
        entries.push(WorkspaceEntryFingerprintV1 {
            content_sha256: entry_digest(&root.join(&path))?,
            path: normalized,
        });
    }
    let bytes = serde_json::to_vec(&entries)
        .map_err(|error| format!("change-fence-unavailable: encode fingerprint: {error}"))?;
    Ok(WorkspaceFingerprintV1 {
        root: root.to_string_lossy().into_owned(),
        digest: format!("{:x}", Sha256::digest(bytes)),
        git_head,
        entries,
    })
}

pub fn reconcile_change_fence(
    before: &WorkspaceFingerprintV1,
    after: &WorkspaceFingerprintV1,
    declared_changed_paths: &[String],
) -> Result<ChangeFenceResultV1, String> {
    if before.root != after.root {
        return Err("change-fence-ambiguous: workspace root changed".to_string());
    }
    if before.git_head != after.git_head {
        return Err(
            "change-fence-blocked: git HEAD changed; commit/checkout is outside Squad authority"
                .to_string(),
        );
    }
    let before_entries = before
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry.content_sha256.as_str()))
        .collect::<BTreeMap<_, _>>();
    let after_entries = after
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry.content_sha256.as_str()))
        .collect::<BTreeMap<_, _>>();
    let observed = before_entries
        .keys()
        .chain(after_entries.keys())
        .copied()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .filter(|path| before_entries.get(path) != after_entries.get(path))
        .map(str::to_string)
        .collect::<Vec<_>>();
    let declared = declared_changed_paths
        .iter()
        .map(|path| validate_workspace_path(&before.root, path))
        .collect::<Result<Vec<_>, _>>()?;
    let unexpected = observed
        .iter()
        .filter(|path| {
            !declared.iter().any(|allowed| {
                path.as_str() == allowed
                    || path
                        .strip_prefix(allowed)
                        .is_some_and(|suffix| suffix.starts_with('/'))
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    if !unexpected.is_empty() {
        return Err(format!(
            "change-fence-blocked: undeclared changed paths: {}",
            unexpected.join(", ")
        ));
    }
    let unobserved = declared
        .iter()
        .filter(|declared| {
            !observed.iter().any(|path| {
                path == *declared
                    || path
                        .strip_prefix(declared.as_str())
                        .is_some_and(|suffix| suffix.starts_with('/'))
            })
        })
        .cloned()
        .collect::<Vec<_>>();
    if !unobserved.is_empty() {
        return Err(format!(
            "change-fence-blocked: declared paths were not observed: {}",
            unobserved.join(", ")
        ));
    }
    Ok(ChangeFenceResultV1 {
        before_digest: before.digest.clone(),
        after_digest: after.digest.clone(),
        observed_changed_paths: observed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_escape_remote_and_credentials() {
        let root = std::env::temp_dir().join(format!("ccgui-scope-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("temp root");
        let root = root.to_string_lossy();
        assert!(validate_workspace_path(&root, "../outside").is_err());
        assert!(validate_workspace_path(&root, "https://example.com/repo").is_err());
        assert!(validate_workspace_path(&root, ".ssh/id_rsa").is_err());
        assert!(validate_workspace_path(&root, ".env.local").is_err());
        assert!(validate_workspace_path(&root, ".kube/config").is_err());
        assert!(validate_workspace_path(&root, "certificates/client.p12").is_err());
        assert_eq!(
            validate_workspace_path(&root, "src/../src/main.rs").expect("valid path"),
            "src/main.rs"
        );
    }

    #[test]
    fn fence_preserves_baseline_and_rejects_undeclared_delta() {
        let before = WorkspaceFingerprintV1 {
            root: "/workspace".into(),
            digest: "before".into(),
            git_head: Some("head".into()),
            entries: vec![WorkspaceEntryFingerprintV1 {
                path: "existing.txt".into(),
                content_sha256: "same".into(),
            }],
        };
        let after = WorkspaceFingerprintV1 {
            root: "/workspace".into(),
            digest: "after".into(),
            git_head: Some("head".into()),
            entries: vec![
                WorkspaceEntryFingerprintV1 {
                    path: "existing.txt".into(),
                    content_sha256: "same".into(),
                },
                WorkspaceEntryFingerprintV1 {
                    path: "new.txt".into(),
                    content_sha256: "new".into(),
                },
            ],
        };
        let error = reconcile_change_fence(&before, &after, &[]).expect_err("must block");
        assert!(error.contains("new.txt"));
    }

    #[test]
    fn fence_blocks_git_head_changes() {
        let before = WorkspaceFingerprintV1 {
            root: "/workspace".into(),
            digest: "before".into(),
            git_head: Some("head-before".into()),
            entries: vec![],
        };
        let after = WorkspaceFingerprintV1 {
            root: "/workspace".into(),
            digest: "after".into(),
            git_head: Some("head-after".into()),
            entries: vec![],
        };
        let error = reconcile_change_fence(&before, &after, &[]).expect_err("must block");
        assert!(error.contains("git HEAD changed"));
    }

    #[test]
    fn fence_requires_every_declared_path_to_be_observed() {
        let root = std::env::temp_dir().join(format!("ccgui-fence-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).expect("temp root");
        let root = root.to_string_lossy().into_owned();
        let before = WorkspaceFingerprintV1 {
            root: root.clone(),
            digest: "same".into(),
            git_head: None,
            entries: vec![],
        };
        let after = before.clone();
        let error = reconcile_change_fence(&before, &after, &["expected.txt".into()])
            .expect_err("must block");
        assert!(error.contains("declared paths were not observed"));
    }
}
