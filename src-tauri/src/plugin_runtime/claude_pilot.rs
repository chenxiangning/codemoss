//! Wave 3C: activate the Claude Manifest fixture through the in-memory Host.
//! Does not call production engine::claude.

use serde_json::Value;

use super::host::{ActivationRequest, FakeDriver, Host, HostConfig, SlotState};

pub fn claude_activation_request() -> ActivationRequest {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../packages/plugin-contract/fixtures/valid/claude-engine.json"
    ))
    .expect("claude fixture");
    let plugin_id = manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .expect("pluginId")
        .to_string();
    let unit = manifest
        .get("activationUnits")
        .and_then(Value::as_array)
        .and_then(|units| units.first())
        .expect("unit");
    let unit_id = unit
        .get("id")
        .and_then(Value::as_str)
        .expect("unit id")
        .to_string();
    let required_entries = unit
        .get("entries")
        .and_then(Value::as_array)
        .expect("entries")
        .iter()
        .filter_map(Value::as_str)
        .map(ToOwned::to_owned)
        .collect();
    ActivationRequest {
        plugin_id,
        unit_id,
        required_entries,
    }
}

/// Product install/restore lifecycle. Worker isolate only; per-turn CLI stays Process Entry.
pub fn claude_lifecycle_activation_request() -> ActivationRequest {
    ActivationRequest {
        plugin_id: super::claude_process::CLAUDE_PLUGIN_ID.to_string(),
        unit_id: "claude-engine".to_string(),
        required_entries: vec!["claude-worker".to_string()],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_activates_claude_fixture_without_production_engine() {
        let request = claude_activation_request();
        assert_eq!(request.plugin_id, "com.mossx.engine.claude");
        assert_eq!(request.required_entries, vec!["claude-cli", "claude-worker"]);
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        let generation = host.activate(request).expect("activate");
        assert_eq!(generation, 1);
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        host.dispatch("com.mossx.engine.claude", 1).expect("current");
    }

    #[test]
    fn product_lifecycle_request_is_worker_only() {
        let request = claude_lifecycle_activation_request();
        assert_eq!(request.plugin_id, "com.mossx.engine.claude");
        assert_eq!(request.unit_id, "claude-engine");
        assert_eq!(request.required_entries, vec!["claude-worker"]);
        assert_ne!(
            request.required_entries,
            claude_activation_request().required_entries
        );
    }

    #[test]
    fn disable_claude_fixture_keeps_core_implementation() {
        use crate::plugin_runtime::broker::CapabilityBroker;
        use std::path::Path;

        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        host.activate(claude_activation_request()).expect("activate");
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Disabled
        );
        assert_eq!(
            host.activate(claude_activation_request()).unwrap_err().code,
            "disabled"
        );
        let broker = CapabilityBroker::new("/fixture/workspace");
        assert_eq!(
            broker
                .query(&host, "com.mossx.engine.claude", 1, "mossx.workspace.read")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert!(Path::new("src/engine/claude.rs").exists());
    }
}
