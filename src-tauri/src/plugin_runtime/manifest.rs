//! Manifest V1 parser. No Tauri commands. Does not read plugin entry files.

use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManifestError {
    pub code: &'static str,
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct ParseManifestOptions {
    pub trust_tier: String,
    pub current_platform: String,
    pub startup_allowlist: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ValidatedManifest {
    pub plugin_id: String,
    pub version: String,
}

fn err(code: &'static str, path: &str, message: impl Into<String>) -> ManifestError {
    ManifestError {
        code,
        path: path.to_string(),
        message: message.into(),
    }
}

fn unknown_fields(value: &Value, allowed: &[&str], prefix: &str, errors: &mut Vec<ManifestError>) {
    let Some(object) = value.as_object() else {
        return;
    };
    for key in object.keys() {
        if key != "extensions" && !allowed.contains(&key.as_str()) {
            errors.push(err(
                "unknown-field",
                &format!("{prefix}.{key}"),
                format!("unknown field {key}"),
            ));
        }
    }
}

pub fn plugin_id_ok(value: &str) -> bool {
    let mut parts = value.split('.');
    let Some(first) = parts.next() else {
        return false;
    };
    if first.is_empty() || !first.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-') {
        return false;
    }
    let rest: Vec<&str> = parts.collect();
    !rest.is_empty()
        && rest.iter().all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
        })
}

fn core_api_ok(range: &str) -> bool {
    !range.contains('*') && range.contains('<')
}

const MOSSX_CAPABILITIES: &[&str] = &[
    "mossx.workspace.read",
    "mossx.workspace.write",
    "mossx.git.read",
    "mossx.git.write",
    "mossx.network.fetch",
    "mossx.process.spawn",
    "mossx.storage.readwrite",
    "mossx.notifications.publish",
    "mossx.engine.provider",
    "mossx.search.provider",
    "mossx.context.provider",
    "mossx.command",
    "mossx.tool",
    "mossx.ui.view",
    "mossx.ui.panel",
    "mossx.ui.slot.workspace.main",
    "mossx.ui.slot.workspace.rightPanel",
    "mossx.ui.slot.sidebar.secondary",
    "mossx.ui.slot.composer.toolbar",
    "mossx.ui.slot.conversation.attachmentRenderer",
    "mossx.ui.slot.settings.plugin",
    "mossx.ui.slot.status.lowFrequency",
    "mossx.settings.page",
    "mossx.status.item",
];

const EVENT_TYPES: &[&str] = &[
    "onView",
    "onCommand",
    "onEngine",
    "onWorkspace",
    "onSettings",
    "onStartup",
];

const KINDS: &[&str] = &["worker", "process", "ui", "migration"];

const TEMPLATE_TYPES: &[&str] = &[
    "mossx.tool",
    "mossx.search.provider",
    "mossx.context.provider",
    "mossx.status.item",
];

const TOP_LEVEL: &[&str] = &[
    "manifestVersion",
    "pluginId",
    "version",
    "displayName",
    "description",
    "publisher",
    "repository",
    "license",
    "channel",
    "compatibility",
    "entries",
    "activationUnits",
    "contributions",
    "contributionTemplates",
    "capabilities",
    "storage",
    "budgets",
    "extensions",
];

pub fn parse_manifest_v1(
    input: &Value,
    options: &ParseManifestOptions,
) -> Result<ValidatedManifest, Vec<ManifestError>> {
    let mut errors = Vec::new();
    if !input.is_object() {
        return Err(vec![err("schema", "/", "manifest must be an object")]);
    }
    unknown_fields(input, TOP_LEVEL, "", &mut errors);
    if input.get("manifestVersion").and_then(Value::as_u64) != Some(1) {
        errors.push(err(
            "unsupported-manifest-version",
            "/manifestVersion",
            "only manifestVersion 1 is accepted",
        ));
    }
    let plugin_id = input.get("pluginId").and_then(Value::as_str).unwrap_or("");
    if !plugin_id_ok(plugin_id) {
        errors.push(err(
            "invalid-plugin-id",
            "/pluginId",
            "pluginId must be Reverse-DNS",
        ));
    }
    let version = input.get("version").and_then(Value::as_str).unwrap_or("");
    if version.is_empty() {
        errors.push(err("invalid-semver", "/version", "version must be SemVer"));
    }
    let core_api = input
        .pointer("/compatibility/coreApi")
        .and_then(Value::as_str)
        .unwrap_or("");
    if !core_api_ok(core_api) {
        errors.push(err(
            "unbounded-core-api",
            "/compatibility/coreApi",
            "coreApi must have an upper bound",
        ));
    }

    let empty = Vec::new();
    let entries = input
        .get("entries")
        .and_then(Value::as_array)
        .unwrap_or(&empty);
    let mut entry_ids = Vec::new();
    let mut kinds = std::collections::HashMap::new();
    let mut depends: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        let id = entry.get("id").and_then(Value::as_str).unwrap_or("");
        let kind = entry.get("kind").and_then(Value::as_str).unwrap_or("");
        if !KINDS.contains(&kind) {
            errors.push(err(
                "unknown-kind",
                &format!("/entries/{index}/kind"),
                format!("unknown kind {kind}"),
            ));
        }
        if entry.get("mode").and_then(Value::as_str) == Some("trusted-react")
            && options.trust_tier != "system"
        {
            errors.push(err(
                "trusted-react-not-system",
                &format!("/entries/{index}"),
                "trusted-react requires system",
            ));
        }
        if kind == "process"
            && entry
                .pointer(&format!("/platforms/{}", options.current_platform))
                .is_none()
            && entry.get("criticality").and_then(Value::as_str) != Some("optional")
        {
            errors.push(err(
                "missing-platform",
                &format!("/entries/{index}/platforms"),
                format!("missing {}", options.current_platform),
            ));
        }
        if !id.is_empty() {
            entry_ids.push(id.to_string());
            kinds.insert(id.to_string(), kind.to_string());
            let mut edges = Vec::new();
            if let Some(deps) = entry.get("dependsOn").and_then(Value::as_array) {
                for dep in deps {
                    if let Some(entry_id) = dep.get("entryId").and_then(Value::as_str) {
                        edges.push(entry_id.to_string());
                    }
                }
            }
            depends.insert(id.to_string(), edges);
        }
    }

    fn visit(
        id: &str,
        depends: &std::collections::HashMap<String, Vec<String>>,
        visiting: &mut std::collections::HashSet<String>,
        visited: &mut std::collections::HashSet<String>,
        errors: &mut Vec<ManifestError>,
    ) {
        if visited.contains(id) {
            return;
        }
        if !visiting.insert(id.to_string()) {
            errors.push(err("cyclic-depends-on", "/entries", format!("cycle at {id}")));
            return;
        }
        if let Some(edges) = depends.get(id) {
            for edge in edges {
                visit(edge, depends, visiting, visited, errors);
            }
        }
        visiting.remove(id);
        visited.insert(id.to_string());
    }
    let mut visiting = std::collections::HashSet::new();
    let mut visited = std::collections::HashSet::new();
    for id in &entry_ids {
        visit(id, &depends, &mut visiting, &mut visited, &mut errors);
    }

    if let Some(units) = input.get("activationUnits").and_then(Value::as_array) {
        for (index, unit) in units.iter().enumerate() {
            if let Some(listed) = unit.get("entries").and_then(Value::as_array) {
                for entry_id in listed.iter().filter_map(Value::as_str) {
                    if !entry_ids.iter().any(|id| id == entry_id) {
                        errors.push(err(
                            "dangling-entry-id",
                            &format!("/activationUnits/{index}/entries"),
                            format!("missing {entry_id}"),
                        ));
                    } else if kinds.get(entry_id).map(String::as_str) == Some("migration") {
                        errors.push(err(
                            "migration-in-unit",
                            &format!("/activationUnits/{index}/entries"),
                            "migration cannot join a unit",
                        ));
                    }
                }
            }
            if let Some(events) = unit.get("events").and_then(Value::as_array) {
                for (event_index, event) in events.iter().enumerate() {
                    let event_type = event.get("type").and_then(Value::as_str).unwrap_or("");
                    if !EVENT_TYPES.contains(&event_type) {
                        errors.push(err(
                            "unknown-event",
                            &format!("/activationUnits/{index}/events/{event_index}/type"),
                            format!("unknown event {event_type}"),
                        ));
                    }
                    if event_type == "onStartup"
                        && !(options.trust_tier == "system"
                            && options.startup_allowlist.iter().any(|id| id == plugin_id))
                    {
                        errors.push(err(
                            "on-startup-not-allowlisted",
                            &format!("/activationUnits/{index}/events/{event_index}"),
                            "onStartup is limited to allowlisted system plugins",
                        ));
                    }
                }
            }
        }
    }

    if let Some(templates) = input
        .get("contributionTemplates")
        .and_then(Value::as_array)
    {
        let mut prefixes: Vec<String> = Vec::new();
        for (index, template) in templates.iter().enumerate() {
            let type_name = template.get("type").and_then(Value::as_str).unwrap_or("");
            if !TEMPLATE_TYPES.contains(&type_name) {
                errors.push(err(
                    "template-type-forbidden",
                    &format!("/contributionTemplates/{index}/type"),
                    format!("type {type_name} cannot be a template"),
                ));
            }
            let prefix = template
                .get("keyPrefix")
                .and_then(Value::as_str)
                .unwrap_or("");
            if !prefix.starts_with(&format!("{plugin_id}.")) {
                errors.push(err(
                    "template-key-prefix",
                    &format!("/contributionTemplates/{index}/keyPrefix"),
                    "keyPrefix must start with pluginId",
                ));
            }
            if prefixes.iter().any(|existing| {
                prefix.starts_with(existing.as_str()) || existing.starts_with(prefix)
            }) {
                errors.push(err(
                    "template-overlap",
                    &format!("/contributionTemplates/{index}"),
                    "template keyPrefix overlaps another template",
                ));
            }
            if !prefix.is_empty() {
                prefixes.push(prefix.to_string());
            }
        }
    }

    if let Some(capabilities) = input.get("capabilities").and_then(Value::as_array) {
        for (index, capability) in capabilities.iter().enumerate() {
            let id = capability.get("id").and_then(Value::as_str).unwrap_or("");
            if id.starts_with("mossx.") && !MOSSX_CAPABILITIES.contains(&id) {
                errors.push(err(
                    "unknown-capability",
                    &format!("/capabilities/{index}/id"),
                    format!("unknown {id}"),
                ));
            } else if !id.starts_with("mossx.") && !id.starts_with(&format!("{plugin_id}.")) {
                errors.push(err(
                    "foreign-private-capability",
                    &format!("/capabilities/{index}/id"),
                    "private capability must stay under pluginId",
                ));
            }
        }
    }

    if errors.is_empty() {
        Ok(ValidatedManifest {
            plugin_id: plugin_id.to_string(),
            version: version.to_string(),
        })
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notes() -> Value {
        serde_json::from_str(include_str!(
            "../../../packages/plugin-contract/fixtures/valid/notes-minimal.json"
        ))
        .expect("notes fixture")
    }

    fn load_invalid(name: &str) -> Value {
        let path = format!(
            "{}/../packages/plugin-contract/fixtures/invalid/{name}.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let source = std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path}: {error}"));
        serde_json::from_str(&source).expect("invalid fixture")
    }

    fn system_opts() -> ParseManifestOptions {
        ParseManifestOptions {
            trust_tier: "system".into(),
            current_platform: "darwin-arm64".into(),
            startup_allowlist: vec!["com.mossx.notes".into()],
        }
    }

    #[test]
    fn accepts_notes_minimal() {
        let parsed = parse_manifest_v1(&notes(), &system_opts()).expect("valid");
        assert_eq!(parsed.plugin_id, "com.mossx.notes");
    }

    #[test]
    fn rejects_unknown_field() {
        let mut value = notes();
        value["extraHook"] = Value::Bool(true);
        let errors = parse_manifest_v1(&value, &system_opts()).unwrap_err();
        assert!(errors.iter().any(|error| error.code == "unknown-field"));
    }

    #[test]
    fn rejects_unbounded_core_api() {
        let mut value = notes();
        value["compatibility"]["coreApi"] = Value::String("*".into());
        let errors = parse_manifest_v1(&value, &system_opts()).unwrap_err();
        assert!(errors.iter().any(|error| error.code == "unbounded-core-api"));
    }

    #[test]
    fn rejects_unknown_event() {
        let mut value = notes();
        value["activationUnits"][0]["events"][0]["type"] = Value::String("onFile".into());
        let errors = parse_manifest_v1(&value, &system_opts()).unwrap_err();
        assert!(errors.iter().any(|error| error.code == "unknown-event"));
    }

    #[test]
    fn rejects_contract_invalid_fixtures() {
        let cases = [
            ("unknown-field", "unknown-field", "system"),
            ("unknown-event", "unknown-event", "system"),
            ("unknown-kind", "unknown-kind", "system"),
            ("cycle", "cyclic-depends-on", "system"),
            ("dangling-entry-id", "dangling-entry-id", "system"),
            ("unbounded-core-api", "unbounded-core-api", "system"),
            ("on-startup-not-allowlisted", "on-startup-not-allowlisted", "local"),
            ("trusted-react-local", "trusted-react-not-system", "local"),
            ("template-type-forbidden", "template-type-forbidden", "system"),
            ("template-overlap", "template-overlap", "system"),
            ("foreign-private-capability", "foreign-private-capability", "system"),
            ("missing-platform", "missing-platform", "system"),
            ("migration-in-unit", "migration-in-unit", "system"),
        ];
        for (name, code, trust) in cases {
            let mut opts = system_opts();
            if trust == "local" {
                opts.trust_tier = "local".into();
                opts.startup_allowlist.clear();
            }
            let errors = parse_manifest_v1(&load_invalid(name), &opts).expect_err(name);
            assert!(
                errors.iter().any(|error| error.code == code),
                "{name} expected {code}, got {errors:?}"
            );
        }
    }
}
