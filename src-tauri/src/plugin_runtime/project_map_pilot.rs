//! Activate the Project Map Manifest fixture through the in-memory Host.
//! Does not call production project_map / project_memory.

use serde_json::Value;

use super::host::{ActivationRequest, FakeDriver, Host, HostConfig, SlotState};

pub fn project_map_activation_request() -> ActivationRequest {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../packages/plugin-contract/fixtures/valid/project-map-pilot.json"
    ))
    .expect("project-map fixture");
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
    fn host_activates_project_map_fixture_without_production_storage() {
        let request = project_map_activation_request();
        assert_eq!(request.plugin_id, "com.mossx.project-map");
        assert_eq!(request.unit_id, "project-map-main");
        assert_eq!(
            request.required_entries,
            vec![
                "project-map-worker".to_string(),
                "project-map-ui".to_string(),
                "project-map-memory-ui".to_string()
            ]
        );
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
            host.slot("com.mossx.project-map").unwrap().state,
            SlotState::Ready
        );
        host.dispatch("com.mossx.project-map", 1).expect("current");
    }
}
