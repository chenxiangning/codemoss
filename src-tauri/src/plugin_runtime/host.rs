//! In-memory Extension Host supervisor. No sockets, no spawn, not in the app boot path.

use std::collections::HashMap;
use std::time::Duration;

pub const DEFAULT_ACTIVATION_DEADLINE_MS: u64 = 10_000;
pub const MAX_ACTIVATION_DEADLINE_MS: u64 = 30_000;
pub const MAX_CONCURRENT_ACTIVATIONS: u32 = 2;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> HostError {
    HostError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotState {
    Idle,
    Activating,
    Ready,
    Failed,
    Fused,
    Disabled,
}

#[derive(Debug, Clone)]
pub struct HostConfig {
    pub enabled: bool,
    pub max_concurrent: u32,
    pub activation_deadline: Duration,
}

impl HostConfig {
    pub fn validate(&self) -> Result<(), HostError> {
        if self.max_concurrent == 0 || self.max_concurrent > MAX_CONCURRENT_ACTIVATIONS {
            return Err(err(
                "invalid-budget",
                format!("max_concurrent must be 1-{MAX_CONCURRENT_ACTIVATIONS}"),
            ));
        }
        if self.activation_deadline.as_millis() < 1_000
            || self.activation_deadline.as_millis() > MAX_ACTIVATION_DEADLINE_MS as u128
        {
            return Err(err(
                "invalid-budget",
                "activation deadline must be 1000-30000ms",
            ));
        }
        Ok(())
    }
}

impl Default for HostConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            max_concurrent: MAX_CONCURRENT_ACTIVATIONS,
            activation_deadline: Duration::from_millis(DEFAULT_ACTIVATION_DEADLINE_MS),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ActivationRequest {
    pub plugin_id: String,
    pub unit_id: String,
    pub required_entries: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DriverError {
    Timeout,
    Crash,
}

pub trait EntryDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError>;
    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64);
}

#[derive(Debug, Default)]
pub struct FakeDriver {
    pub fail_on: HashMap<String, DriverError>,
    pub started: Vec<(String, String, u64)>,
    pub stopped: Vec<(String, String, u64)>,
}

impl EntryDriver for FakeDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        if let Some(error) = self.fail_on.get(entry_id) {
            return Err(error.clone());
        }
        self.started
            .push((plugin_id.to_string(), entry_id.to_string(), generation));
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        self.stopped
            .push((plugin_id.to_string(), entry_id.to_string(), generation));
    }
}

#[derive(Debug, Clone)]
pub struct PluginSlot {
    pub state: SlotState,
    pub generation: u64,
    pub unit_id: Option<String>,
    pub started: Vec<String>,
}

impl PluginSlot {
    fn idle() -> Self {
        Self {
            state: SlotState::Idle,
            generation: 0,
            unit_id: None,
            started: Vec::new(),
        }
    }
}

pub struct Host<D> {
    config: HostConfig,
    driver: D,
    slots: HashMap<String, PluginSlot>,
    inflight: u32,
}

impl<D: EntryDriver> Host<D> {
    pub fn new(config: HostConfig, driver: D) -> Result<Self, HostError> {
        config.validate()?;
        Ok(Self {
            config,
            driver,
            slots: HashMap::new(),
            inflight: 0,
        })
    }

    pub fn slot(&self, plugin_id: &str) -> Option<&PluginSlot> {
        self.slots.get(plugin_id)
    }

    pub fn activate(&mut self, request: ActivationRequest) -> Result<u64, HostError> {
        if !self.config.enabled {
            return Err(err("host-disabled", "host is not enabled"));
        }
        if request.required_entries.is_empty() {
            return Err(err("schema", "required closure must not be empty"));
        }
        if request.plugin_id.is_empty() || request.unit_id.is_empty() {
            return Err(err("schema", "pluginId and unitId are required"));
        }
        {
            let current = self
                .slots
                .entry(request.plugin_id.clone())
                .or_insert_with(PluginSlot::idle);
            if current.state == SlotState::Fused {
                return Err(err("fused", "plugin is fused until reset"));
            }
            if current.state == SlotState::Disabled {
                return Err(err("disabled", "plugin is disabled until reset"));
            }
            if current.state == SlotState::Failed {
                return Err(err("failed", "plugin is failed until reset"));
            }
            if current.state == SlotState::Activating {
                return Err(err("activation-busy", "plugin is already activating"));
            }
            if self.inflight >= self.config.max_concurrent {
                return Err(err("activation-busy", "concurrent activation limit reached"));
            }
            self.inflight += 1;
            current.state = SlotState::Activating;
            current.generation += 1;
            current.unit_id = Some(request.unit_id.clone());
            current.started.clear();
        }
        let generation = self.slots[&request.plugin_id].generation;
        let plugin_id = request.plugin_id.clone();

        let mut started = Vec::new();
        let mut failure: Option<HostError> = None;
        for entry_id in &request.required_entries {
            match self.driver.start(&plugin_id, entry_id, generation) {
                Ok(()) => started.push(entry_id.clone()),
                Err(DriverError::Timeout) => {
                    failure = Some(err("activation-timeout", format!("{entry_id} exceeded deadline")));
                    break;
                }
                Err(DriverError::Crash) => {
                    failure = Some(err("activation-failed", format!("{entry_id} crashed")));
                    break;
                }
            }
        }

        if let Some(error) = failure {
            for entry_id in started.iter().rev() {
                self.driver.stop(&plugin_id, entry_id, generation);
            }
            if let Some(slot) = self.slots.get_mut(&plugin_id) {
                slot.state = SlotState::Failed;
                slot.started.clear();
            }
            self.inflight = self.inflight.saturating_sub(1);
            return Err(error);
        }

        if let Some(slot) = self.slots.get_mut(&plugin_id) {
            slot.state = SlotState::Ready;
            slot.started = started;
        }
        self.inflight = self.inflight.saturating_sub(1);
        Ok(generation)
    }

    pub fn fuse(&mut self, plugin_id: &str) -> Result<(), HostError> {
        let slot = self.slots.entry(plugin_id.to_string()).or_insert_with(PluginSlot::idle);
        if slot.state == SlotState::Activating {
            return Err(err("activation-busy", "cannot fuse while activating"));
        }
        let generation = slot.generation;
        let started = slot.started.clone();
        for entry_id in started.iter().rev() {
            self.driver.stop(plugin_id, entry_id, generation);
        }
        slot.started.clear();
        slot.state = SlotState::Fused;
        Ok(())
    }

    pub fn disable(&mut self, plugin_id: &str) -> Result<(), HostError> {
        let slot = self.slots.entry(plugin_id.to_string()).or_insert_with(PluginSlot::idle);
        if slot.state == SlotState::Activating {
            return Err(err("activation-busy", "cannot disable while activating"));
        }
        let generation = slot.generation;
        let started = slot.started.clone();
        for entry_id in started.iter().rev() {
            self.driver.stop(plugin_id, entry_id, generation);
        }
        slot.started.clear();
        slot.state = SlotState::Disabled;
        Ok(())
    }

    pub fn reset(&mut self, plugin_id: &str) -> Result<(), HostError> {
        let slot = self.slots.entry(plugin_id.to_string()).or_insert_with(PluginSlot::idle);
        if slot.state == SlotState::Activating {
            return Err(err("activation-busy", "cannot reset while activating"));
        }
        let generation = slot.generation;
        *slot = PluginSlot {
            state: SlotState::Idle,
            generation,
            unit_id: None,
            started: Vec::new(),
        };
        Ok(())
    }

    pub fn driver(&self) -> &D {
        &self.driver
    }

    #[cfg(test)]
    pub fn test_driver_mut(&mut self) -> &mut D {
        &mut self.driver
    }

    #[cfg(test)]
    pub fn test_set_inflight(&mut self, inflight: u32) {
        self.inflight = inflight;
    }

    #[cfg(test)]
    pub fn test_force_state(&mut self, plugin_id: &str, state: SlotState, generation: u64) {
        self.slots.insert(
            plugin_id.to_string(),
            PluginSlot {
                state,
                generation,
                unit_id: Some("forced".into()),
                started: Vec::new(),
            },
        );
    }

    pub fn dispatch(&self, plugin_id: &str, generation: u64) -> Result<(), HostError> {
        let slot = self
            .slots
            .get(plugin_id)
            .ok_or_else(|| err("plugin-unavailable", "plugin is not loaded"))?;
        if slot.state != SlotState::Ready {
            return Err(err("plugin-unavailable", format!("plugin state is {:?}", slot.state)));
        }
        if slot.generation != generation {
            return Err(err("stale-generation", "generation is not current"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn enabled_host(driver: FakeDriver) -> Host<FakeDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    fn notes_request() -> ActivationRequest {
        ActivationRequest {
            plugin_id: "com.mossx.notes".into(),
            unit_id: "notes-main".into(),
            required_entries: vec!["notes-worker".into(), "notes-ui".into()],
        }
    }

    #[test]
    fn disabled_host_rejects_activate() {
        let mut host = Host::new(HostConfig::default(), FakeDriver::default()).expect("config");
        assert_eq!(host.activate(notes_request()).unwrap_err().code, "host-disabled");
    }

    #[test]
    fn required_closure_becomes_ready() {
        let mut host = enabled_host(FakeDriver::default());
        let generation = host.activate(notes_request()).expect("activate");
        assert_eq!(generation, 1);
        let slot = host.slot("com.mossx.notes").expect("slot");
        assert_eq!(slot.state, SlotState::Ready);
        assert_eq!(slot.started, vec!["notes-worker", "notes-ui"]);
        host.dispatch("com.mossx.notes", 1).expect("current generation");
    }

    #[test]
    fn required_timeout_rolls_back() {
        let mut driver = FakeDriver::default();
        driver.fail_on.insert("notes-ui".into(), DriverError::Timeout);
        let mut host = enabled_host(driver);
        let error = host.activate(notes_request()).unwrap_err();
        assert_eq!(error.code, "activation-timeout");
        let slot = host.slot("com.mossx.notes").expect("slot");
        assert_eq!(slot.state, SlotState::Failed);
        assert!(slot.started.is_empty());
        assert_eq!(
            host.driver.stopped,
            vec![("com.mossx.notes".into(), "notes-worker".into(), 1)]
        );
    }

    #[test]
    fn stale_generation_is_rejected() {
        let mut host = enabled_host(FakeDriver::default());
        host.activate(notes_request()).expect("first");
        host.reset("com.mossx.notes").expect("reset");
        host.activate(notes_request()).expect("second");
        assert_eq!(
            host.dispatch("com.mossx.notes", 1).unwrap_err().code,
            "stale-generation"
        );
        host.dispatch("com.mossx.notes", 2).expect("current");
    }

    #[test]
    fn fuse_blocks_later_activate() {
        let mut host = enabled_host(FakeDriver::default());
        host.activate(notes_request()).expect("activate");
        host.fuse("com.mossx.notes").expect("fuse");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Fused);
        assert_eq!(host.activate(notes_request()).unwrap_err().code, "fused");
        host.reset("com.mossx.notes").expect("reset");
        host.activate(notes_request()).expect("after reset");
    }

    #[test]
    fn disable_stops_entries_and_blocks_later_activate() {
        let mut host = enabled_host(FakeDriver::default());
        host.activate(notes_request()).expect("activate");
        host.disable("com.mossx.notes").expect("disable");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Disabled);
        assert!(host.slot("com.mossx.notes").unwrap().started.is_empty());
        assert_eq!(host.activate(notes_request()).unwrap_err().code, "disabled");
        host.reset("com.mossx.notes").expect("reset");
        host.activate(notes_request()).expect("after reset");
    }

    #[test]
    fn concurrent_limit_is_two() {
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                max_concurrent: 2,
                activation_deadline: Duration::from_millis(10_000),
            },
            FakeDriver::default(),
        )
        .expect("config");
        host.inflight = 2;
        assert_eq!(host.activate(notes_request()).unwrap_err().code, "activation-busy");
    }

    #[test]
    fn empty_identity_is_rejected_before_slot_insert() {
        let mut host = enabled_host(FakeDriver::default());
        assert_eq!(
            host.activate(ActivationRequest {
                plugin_id: String::new(),
                unit_id: "notes-main".into(),
                required_entries: vec!["notes-ui".into()],
            })
            .unwrap_err()
            .code,
            "schema"
        );
        assert_eq!(
            host.activate(ActivationRequest {
                plugin_id: "com.mossx.notes".into(),
                unit_id: String::new(),
                required_entries: vec!["notes-ui".into()],
            })
            .unwrap_err()
            .code,
            "schema"
        );
        assert!(host.slot("").is_none());
        assert!(host.slot("com.mossx.notes").is_none());
    }

    #[test]
    fn fuse_and_disable_refuse_activating_slot() {
        let mut host = enabled_host(FakeDriver::default());
        host.test_force_state("com.mossx.notes", SlotState::Activating, 1);
        assert_eq!(host.fuse("com.mossx.notes").unwrap_err().code, "activation-busy");
        assert_eq!(
            host.disable("com.mossx.notes").unwrap_err().code,
            "activation-busy"
        );
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Activating);
    }
}
