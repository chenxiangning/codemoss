//! Per-plugin QuickJS Worker isolate gate. No C engine, not in product path.

use std::collections::HashMap;

use super::host::{DriverError, EntryDriver};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkerError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> WorkerError {
    WorkerError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct IsolateKey {
    plugin_id: String,
    entry_id: String,
    generation: u64,
}

#[derive(Debug, Clone)]
pub struct WorkerIsolate {
    pub plugin_id: String,
    pub entry_id: String,
    pub generation: u64,
}

pub struct QuickJsWorkerDriver {
    isolates: HashMap<IsolateKey, WorkerIsolate>,
}

impl Default for QuickJsWorkerDriver {
    fn default() -> Self {
        Self {
            isolates: HashMap::new(),
        }
    }
}

impl QuickJsWorkerDriver {
    pub fn live_count(&self) -> usize {
        self.isolates.len()
    }

    pub fn isolate(
        &self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Option<&WorkerIsolate> {
        self.isolates.get(&IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        })
    }

    pub fn eval(
        &self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
        source: &str,
    ) -> Result<(), WorkerError> {
        if self
            .isolate(plugin_id, entry_id, generation)
            .is_none()
        {
            return Err(err("plugin-unavailable", "worker isolate is not live"));
        }
        allow_mossx_bridge(source)
    }
}

fn allow_mossx_bridge(source: &str) -> Result<(), WorkerError> {
    let trimmed = source.trim();
    let lowered = trimmed.to_ascii_lowercase();
    let allowed = lowered.starts_with("mossx.handshake.") || lowered.starts_with("mossx.sdk.");
    let smuggled = [
        "require(",
        "process.",
        "fetch(",
        "import(",
        "eval(",
        "function(",
        "child_process",
        "worker_threads",
    ]
    .iter()
    .any(|needle| lowered.contains(needle));
    if allowed && !smuggled {
        return Ok(());
    }
    Err(err(
        "permission-denied",
        "QuickJS Worker can only call mossx.handshake.* or mossx.sdk.*",
    ))
}

fn is_worker_entry(entry_id: &str) -> bool {
    entry_id.ends_with("-worker")
}

impl EntryDriver for QuickJsWorkerDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        if !is_worker_entry(entry_id) {
            return Ok(());
        }
        let key = IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if self.isolates.contains_key(&key) {
            return Err(DriverError::Crash);
        }
        self.isolates.insert(
            key,
            WorkerIsolate {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
            },
        );
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        self.isolates.remove(&IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    fn enabled_host(driver: QuickJsWorkerDriver) -> Host<QuickJsWorkerDriver> {
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
    fn notes_and_claude_workers_do_not_share_an_isolate() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        host.activate(claude_activation_request()).expect("claude");
        let notes = host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .expect("notes isolate");
        let claude = host
            .driver()
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .expect("claude isolate");
        assert_ne!(notes.plugin_id, claude.plugin_id);
        assert_eq!(host.driver().live_count(), 2);
        host.disable("com.mossx.notes").expect("disable notes");
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_none());
        assert!(host
            .driver()
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .is_some());
    }

    #[test]
    fn worker_cannot_reach_node_or_os_apis() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        for source in [
            "require('fs')",
            "process.exit(0)",
            "fetch('https://example.com')",
            "import('net')",
            "child_process.spawn('sh')",
            "1 + 1",
            "eval('1')",
        ] {
            assert_eq!(
                host.driver()
                    .eval("com.mossx.notes", "notes-worker", 1, source)
                    .unwrap_err()
                    .code,
                "permission-denied",
                "{source}"
            );
        }
    }

    #[test]
    fn disable_disposes_the_worker_isolate() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        host.disable("com.mossx.notes").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        assert_eq!(
            host.driver()
                .eval("com.mossx.notes", "notes-worker", 1, "1 + 1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
    }

    #[test]
    fn handshake_call_is_accepted() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.handshake.hello()")
            .expect("handshake");
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.sdk.ready()")
            .expect("sdk");
    }

    #[test]
    fn stale_worker_generation_cannot_eval() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("first");
        host.activate(notes_activation_request()).expect("second");
        assert_eq!(
            host.driver()
                .eval(
                    "com.mossx.notes",
                    "notes-worker",
                    1,
                    "mossx.handshake.hello()"
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        host.driver()
            .eval(
                "com.mossx.notes",
                "notes-worker",
                2,
                "mossx.handshake.hello()",
            )
            .expect("new generation");
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn notes_ui_cannot_eval() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_some());
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-ui", 1)
            .is_none());
        assert_eq!(
            host.driver()
                .eval(
                    "com.mossx.notes",
                    "notes-ui",
                    1,
                    "mossx.handshake.hello()"
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(host.driver().live_count(), 1);
    }
}
