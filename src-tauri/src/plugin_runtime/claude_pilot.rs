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
}
