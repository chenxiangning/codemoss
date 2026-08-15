//! Wave 4C: activate the Notes Manifest fixture through the in-memory Host.
//! Does not call production note_cards.

use serde_json::Value;

use super::host::{ActivationRequest, FakeDriver, Host, HostConfig, SlotState};

pub fn notes_activation_request() -> ActivationRequest {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../packages/plugin-contract/fixtures/valid/notes-pilot.json"
    ))
    .expect("notes fixture");
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
    fn host_activates_notes_fixture_without_production_storage() {
        let request = notes_activation_request();
        assert_eq!(request.plugin_id, "com.mossx.notes");
        assert_eq!(request.unit_id, "notes-main");
        assert_eq!(request.required_entries, vec!["notes-worker", "notes-ui"]);
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
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        host.dispatch("com.mossx.notes", 1).expect("current");
    }
}
