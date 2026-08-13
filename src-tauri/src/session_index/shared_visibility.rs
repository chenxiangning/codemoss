//! Read-only Shared native-ownership projection for Session Index first-paint.
//!
//! This path MUST NOT send commands through `SharedEventWriter`. It reads V0
//! Shared metadata from the filesystem and opens `shared-event-log-v2.sqlite3`
//! with a short-timeout read-only connection.

use std::collections::BTreeSet;
use std::path::Path;
use std::time::Duration;

use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::store::SessionIndexRow;
use crate::shared_sessions::load_workspace_shared_ownership_seed;

const VISIBILITY_BUSY_TIMEOUT: Duration = Duration::from_millis(200);
const BINDING_EVENT_SCAN_LIMIT: i64 = 80;

const MOSSX_CONTROL_PLANE_PREFIXES: &[&str] = &[
    "MOSSX_CONTEXT_PACKAGE",
    "MOSSX_CONTEXT_ACCEPTED",
    "MOSSX_NATIVE_CONTEXT_V1",
    "MOSSX_SHARED_CONTEXT_V1",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedNativeVisibilityProjection {
    pub available: bool,
    pub freshness: String,
    pub hidden_native_ids: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub protocol_hidden_native_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl SharedNativeVisibilityProjection {
    fn unavailable(reason: impl Into<String>) -> Self {
        Self {
            available: false,
            freshness: "unavailable".into(),
            hidden_native_ids: Vec::new(),
            protocol_hidden_native_ids: Vec::new(),
            reason: Some(reason.into()),
        }
    }
}

pub(crate) fn is_exact_mossx_control_plane_title(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    MOSSX_CONTROL_PLANE_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
}

pub(crate) fn extract_claude_parent_session_id(session_id: &str) -> Option<String> {
    let rest = session_id.trim().strip_prefix("subagent:")?;
    let parent = rest.split(':').next().unwrap_or("").trim();
    if parent.is_empty() {
        None
    } else {
        Some(parent.to_string())
    }
}

fn push_id(target: &mut BTreeSet<String>, value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return;
    }
    target.insert(trimmed.to_string());
    if let Some((_, bare)) = trimmed.split_once(':') {
        let bare = bare.trim();
        if !bare.is_empty() {
            target.insert(bare.to_string());
        }
    }
}

fn collect_ids_from_json_value(value: &Value, target: &mut BTreeSet<String>) {
    const KEYS: &[&str] = &[
        "archivedNativeSessionId",
        "archived_native_session_id",
        "nativeSessionId",
        "native_session_id",
    ];
    if let Some(object) = value.as_object() {
        for key in KEYS {
            if let Some(raw) = object.get(*key).and_then(Value::as_str) {
                push_id(target, raw);
            }
        }
        if let Some(nested) = object.get("provisioning") {
            collect_ids_from_json_value(nested, target);
        }
    }
}

fn collect_ids_from_json_text(raw: &str, target: &mut BTreeSet<String>) {
    if raw.trim().is_empty() {
        return;
    }
    if let Ok(value) = serde_json::from_str::<Value>(raw) {
        collect_ids_from_json_value(&value, target);
    }
}

fn protocol_hidden_ids_from_index_rows(rows: &[SessionIndexRow]) -> Vec<String> {
    let mut ids = BTreeSet::new();
    for row in rows {
        let title_hit = is_exact_mossx_control_plane_title(&row.title)
            || row
                .native_title
                .as_deref()
                .is_some_and(is_exact_mossx_control_plane_title);
        if title_hit {
            push_id(&mut ids, &row.session_id);
        }
    }
    ids.into_iter().collect()
}

#[derive(Debug)]
enum VisibilityV2Read {
    NotRequired,
    StoreMissing,
    Ready(BTreeSet<String>),
    Failed(String),
}

fn finalize_visibility_projection(
    skipped_meta: usize,
    _session_ids: &[String],
    v0_native_ids: &[String],
    v2_read: VisibilityV2Read,
    protocol_hidden_native_ids: Vec<String>,
) -> SharedNativeVisibilityProjection {
    let mut hidden = BTreeSet::new();
    for native_id in v0_native_ids {
        push_id(&mut hidden, native_id);
    }

    if skipped_meta > 0 {
        return SharedNativeVisibilityProjection {
            available: false,
            freshness: "unavailable".into(),
            hidden_native_ids: hidden.into_iter().collect(),
            protocol_hidden_native_ids,
            reason: Some(format!("legacy-meta-skipped:{skipped_meta}")),
        };
    }

    match v2_read {
        VisibilityV2Read::NotRequired | VisibilityV2Read::StoreMissing => {}
        VisibilityV2Read::Ready(v2_ids) => hidden.extend(v2_ids),
        VisibilityV2Read::Failed(error) => {
            return SharedNativeVisibilityProjection {
                available: false,
                freshness: "unavailable".into(),
                hidden_native_ids: hidden.into_iter().collect(),
                protocol_hidden_native_ids,
                reason: Some(format!("v2-readonly:{error}")),
            };
        }
    }

    SharedNativeVisibilityProjection {
        available: true,
        freshness: "verified".into(),
        hidden_native_ids: hidden.into_iter().collect(),
        protocol_hidden_native_ids,
        reason: None,
    }
}

fn collect_v2_binding_ids(
    event_log_path: &Path,
    session_ids: &[String],
) -> Result<BTreeSet<String>, String> {
    if session_ids.is_empty() || !event_log_path.exists() {
        return Ok(BTreeSet::new());
    }
    let connection = Connection::open_with_flags(event_log_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("open-readonly:{error}"))?;
    connection
        .busy_timeout(VISIBILITY_BUSY_TIMEOUT)
        .map_err(|error| format!("busy-timeout:{error}"))?;

    let mut hidden = BTreeSet::new();
    let mut state_statement = connection
        .prepare(
            "SELECT native_session_id, provisioning_json
             FROM shared_binding_state
             WHERE session_id = ?1",
        )
        .map_err(|error| format!("prepare-binding-state:{error}"))?;
    let mut event_statement = connection
        .prepare(
            "SELECT payload_json
             FROM shared_event_log
             WHERE session_id = ?1 AND fact_type LIKE 'binding.%'
             ORDER BY sequence DESC
             LIMIT ?2",
        )
        .map_err(|error| format!("prepare-binding-events:{error}"))?;

    for session_id in session_ids {
        let state_rows = state_statement
            .query_map(params![session_id], |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            })
            .map_err(|error| format!("query-binding-state:{error}"))?;
        for row in state_rows {
            let (native_session_id, provisioning_json) =
                row.map_err(|error| format!("map-binding-state:{error}"))?;
            if let Some(native_session_id) = native_session_id {
                push_id(&mut hidden, &native_session_id);
            }
            if let Some(provisioning_json) = provisioning_json {
                collect_ids_from_json_text(&provisioning_json, &mut hidden);
            }
        }

        let event_rows = event_statement
            .query_map(params![session_id, BINDING_EVENT_SCAN_LIMIT], |row| {
                row.get::<_, String>(0)
            })
            .map_err(|error| format!("query-binding-events:{error}"))?;
        for row in event_rows {
            let payload = row.map_err(|error| format!("map-binding-event:{error}"))?;
            collect_ids_from_json_text(&payload, &mut hidden);
        }
    }
    Ok(hidden)
}

pub(crate) fn load_shared_native_visibility_projection(
    workspace_id: &str,
    event_log_path: Option<&Path>,
    index_rows: &[SessionIndexRow],
) -> SharedNativeVisibilityProjection {
    let protocol_hidden_native_ids = protocol_hidden_ids_from_index_rows(index_rows);
    let seed = match load_workspace_shared_ownership_seed(workspace_id) {
        Ok(seed) => seed,
        Err(error) => {
            return SharedNativeVisibilityProjection {
                protocol_hidden_native_ids,
                ..SharedNativeVisibilityProjection::unavailable(format!("legacy-meta:{error}"))
            };
        }
    };

    let v2_read = if seed.session_ids.is_empty() {
        VisibilityV2Read::NotRequired
    } else {
        match event_log_path {
            None => VisibilityV2Read::Failed("v2-path-missing".into()),
            Some(path) if !path.exists() => VisibilityV2Read::StoreMissing,
            Some(path) => match collect_v2_binding_ids(path, &seed.session_ids) {
                Ok(ids) => VisibilityV2Read::Ready(ids),
                Err(error) => VisibilityV2Read::Failed(error),
            },
        }
    };

    finalize_visibility_projection(
        seed.skipped_meta,
        &seed.session_ids,
        &seed.native_ids,
        v2_read,
        protocol_hidden_native_ids,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_row(session_id: &str, title: &str, native_title: Option<&str>) -> SessionIndexRow {
        SessionIndexRow {
            engine: "claude".into(),
            session_id: session_id.into(),
            title: title.into(),
            native_title: native_title.map(str::to_string),
            updated_at: 1,
            created_at: None,
            cwd: None,
            workspace_path: None,
            physical_path: None,
            parent_session_id: None,
            size_bytes: None,
        }
    }

    #[test]
    fn protocol_classifier_is_exact() {
        assert!(is_exact_mossx_control_plane_title(
            "MOSSX_CONTEXT_PACKAGE:sha256:abc"
        ));
        assert!(is_exact_mossx_control_plane_title(
            "MOSSX_NATIVE_CONTEXT_V1\nsource:x"
        ));
        assert!(!is_exact_mossx_control_plane_title("Claude Session"));
        assert!(!is_exact_mossx_control_plane_title("Agent 3"));
        assert!(!is_exact_mossx_control_plane_title(
            "please explain MOSSX_CONTEXT_PACKAGE"
        ));
    }

    #[test]
    fn extracts_claude_subagent_parent() {
        assert_eq!(
            extract_claude_parent_session_id("subagent:parent-1:worker-9").as_deref(),
            Some("parent-1")
        );
        assert_eq!(extract_claude_parent_session_id("plain-session"), None);
    }

    #[test]
    fn protocol_hidden_ids_use_raw_index_fields() {
        let rows = vec![
            sample_row(
                "owned-1",
                "MOSSX_CONTEXT_PACKAGE:dead:beef",
                Some("Claude Session"),
            ),
            sample_row("user-1", "Claude Session", None),
        ];
        let hidden = protocol_hidden_ids_from_index_rows(&rows);
        assert!(hidden.iter().any(|id| id == "owned-1"));
        assert!(!hidden.iter().any(|id| id == "user-1"));
    }

    #[test]
    fn missing_shared_workspace_is_available_with_empty_hide() {
        let projection = load_shared_native_visibility_projection(
            "ws-does-not-exist-for-visibility",
            None,
            &[],
        );
        assert!(projection.available);
        assert_eq!(projection.freshness, "verified");
        assert!(projection.hidden_native_ids.is_empty());
    }

    #[test]
    fn skipped_meta_is_unavailable() {
        let projection = finalize_visibility_projection(
            1,
            &["shared-1".into()],
            &["native-v0".into()],
            VisibilityV2Read::Ready(BTreeSet::new()),
            Vec::new(),
        );
        assert!(!projection.available);
        assert_eq!(projection.freshness, "unavailable");
        assert!(projection.hidden_native_ids.iter().any(|id| id == "native-v0"));
    }

    #[test]
    fn v2_read_failure_with_shared_sessions_is_unavailable() {
        let projection = finalize_visibility_projection(
            0,
            &["shared-1".into()],
            &["native-v0".into()],
            VisibilityV2Read::Failed("busy".into()),
            Vec::new(),
        );
        assert!(!projection.available);
        assert_eq!(projection.freshness, "unavailable");
        assert!(projection.reason.as_deref().unwrap_or("").contains("v2-readonly"));
        assert!(projection.hidden_native_ids.iter().any(|id| id == "native-v0"));
    }

    #[test]
    fn missing_v2_store_with_v0_sessions_is_verified() {
        let projection = finalize_visibility_projection(
            0,
            &["shared-1".into()],
            &["native-v0".into()],
            VisibilityV2Read::StoreMissing,
            Vec::new(),
        );
        assert!(projection.available);
        assert_eq!(projection.freshness, "verified");
        assert!(projection.hidden_native_ids.iter().any(|id| id == "native-v0"));
    }

    #[test]
    fn provisioning_json_collects_archived_id() {
        let mut hidden = BTreeSet::new();
        collect_ids_from_json_text(
            r#"{"state":"prepared","archivedNativeSessionId":"claude:old-1"}"#,
            &mut hidden,
        );
        assert!(hidden.contains("claude:old-1"));
        assert!(hidden.contains("old-1"));
    }

    #[test]
    fn readonly_v2_query_includes_current_and_archived() {
        let dir = std::env::temp_dir().join(format!(
            "mossx-visibility-{}-{}",
            std::process::id(),
            now_nanos()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let db_path = dir.join("shared-event-log-v2.sqlite3");
        {
            let connection = Connection::open(&db_path).expect("open");
            connection
                .execute_batch(
                    "CREATE TABLE shared_binding_state (
                        session_id TEXT NOT NULL,
                        binding_key TEXT NOT NULL,
                        engine TEXT NOT NULL,
                        provider_profile_id TEXT,
                        native_session_id TEXT,
                        accepted_through_sequence INTEGER,
                        committed_through_sequence INTEGER,
                        provisioning_json TEXT,
                        pending_delivery_json TEXT,
                        availability TEXT NOT NULL,
                        updated_at INTEGER NOT NULL,
                        PRIMARY KEY (session_id, binding_key)
                     );
                     CREATE TABLE shared_event_log (
                        session_id TEXT NOT NULL,
                        sequence INTEGER NOT NULL,
                        event_id TEXT NOT NULL,
                        fact_type TEXT NOT NULL,
                        logical_turn_id TEXT,
                        attempt_id TEXT,
                        dedupe_key TEXT,
                        payload_json TEXT NOT NULL,
                        payload_checksum TEXT NOT NULL,
                        fidelity TEXT NOT NULL,
                        committed_at INTEGER NOT NULL,
                        PRIMARY KEY (session_id, event_id)
                     );",
                )
                .expect("ddl");
            connection
                .execute(
                    "INSERT INTO shared_binding_state (
                        session_id, binding_key, engine, native_session_id,
                        provisioning_json, availability, updated_at
                     ) VALUES (?1, 'claude:default', 'claude', ?2, ?3, 'ready', 1)",
                    params![
                        "shared-1",
                        "native-current",
                        r#"{"archivedNativeSessionId":"native-archived"}"#
                    ],
                )
                .expect("insert binding");
            connection
                .execute(
                    "INSERT INTO shared_event_log (
                        session_id, sequence, event_id, fact_type, payload_json,
                        payload_checksum, fidelity, committed_at
                     ) VALUES ('shared-1', 1, 'e1', 'binding.rebuilt',
                        '{\"nativeSessionId\":\"native-historical\"}', 'x', 'full', 1)",
                    [],
                )
                .expect("insert event");
        }

        let hidden = collect_v2_binding_ids(&db_path, &["shared-1".into()]).expect("query");
        assert!(hidden.contains("native-current"));
        assert!(hidden.contains("native-archived"));
        assert!(hidden.contains("native-historical"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn now_nanos() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0)
    }
}
