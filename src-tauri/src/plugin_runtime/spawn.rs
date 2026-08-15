//! Restricted Process supervisor. Host-owned children only; not in boot.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

use super::host::{DriverError, EntryDriver};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct ChildKey {
    plugin_id: String,
    entry_id: String,
    generation: u64,
}

pub struct RestrictedProcessDriver {
    executable: PathBuf,
    children: HashMap<ChildKey, Child>,
    fail_on: Option<String>,
}

impl RestrictedProcessDriver {
    pub fn new(executable: impl Into<PathBuf>) -> Self {
        Self {
            executable: executable.into(),
            children: HashMap::new(),
            fail_on: None,
        }
    }

    pub fn live_count(&self) -> usize {
        self.children.len()
    }

    #[cfg(test)]
    pub fn fail_on(&mut self, entry_id: impl Into<String>) {
        self.fail_on = Some(entry_id.into());
    }

    fn spawn_child(&self) -> Result<Child, DriverError> {
        if !self.executable.is_file() {
            return Err(DriverError::Crash);
        }
        Command::new(&self.executable)
            .args(spawn_args(&self.executable))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| DriverError::Crash)
    }
}

impl EntryDriver for RestrictedProcessDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        let key = ChildKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if self.children.contains_key(&key) {
            return Err(DriverError::Crash);
        }
        if self.fail_on.as_deref() == Some(entry_id) {
            return Err(DriverError::Crash);
        }
        let child = self.spawn_child()?;
        self.children.insert(key, child);
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        let key = ChildKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if let Some(mut child) = self.children.remove(&key) {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for RestrictedProcessDriver {
    fn drop(&mut self) {
        let keys: Vec<ChildKey> = self.children.keys().cloned().collect();
        for key in keys {
            if let Some(mut child) = self.children.remove(&key) {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

pub fn missing_executable() -> PathBuf {
    PathBuf::from("/nonexistent-mossx-restricted-process")
}

pub fn idle_fixture_executable() -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(r"C:\Windows\System32\timeout.exe")
    }
    #[cfg(not(windows))]
    {
        PathBuf::from("/bin/sleep")
    }
}

fn spawn_args(executable: &Path) -> Vec<&'static str> {
    if executable.file_name().and_then(|name| name.to_str()) == Some("timeout.exe") {
        vec!["/T", "30", "/NOBREAK"]
    } else {
        vec!["30"]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::host::{Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    fn enabled_host(driver: RestrictedProcessDriver) -> Host<RestrictedProcessDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    #[test]
    fn notes_unit_owns_a_live_child_until_disable() {
        let executable = idle_fixture_executable();
        assert!(executable.is_file());
        let mut host = enabled_host(RestrictedProcessDriver::new(executable));
        host.activate(notes_activation_request()).expect("activate");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        assert_eq!(host.driver().live_count(), 2);
        host.disable("com.mossx.notes").expect("disable");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Disabled);
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn unknown_executable_cannot_leave_a_child() {
        let mut host = enabled_host(RestrictedProcessDriver::new(missing_executable()));
        assert!(host.activate(notes_activation_request()).is_err());
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Failed);
        assert_eq!(host.driver().live_count(), 0);
    }

    #[test]
    fn later_entry_crash_kills_the_earlier_child() {
        let mut driver = RestrictedProcessDriver::new(idle_fixture_executable());
        driver.fail_on("notes-ui");
        let mut host = enabled_host(driver);
        assert!(host.activate(notes_activation_request()).is_err());
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Failed);
        assert_eq!(host.driver().live_count(), 0);
    }
}
