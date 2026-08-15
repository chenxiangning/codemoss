//! Dispatch Process and QuickJS fibers by Manifest kind. Boot uses this default-off.

use super::host::{DriverError, EntryDriver};
use super::quickjs::QuickJsWorkerDriver;
use super::spawn::RestrictedProcessDriver;

pub struct CompositeDriver {
    pub process: RestrictedProcessDriver,
    pub worker: QuickJsWorkerDriver,
}

impl CompositeDriver {
    pub fn new(process: RestrictedProcessDriver) -> Self {
        Self {
            process,
            worker: QuickJsWorkerDriver::default(),
        }
    }
}

impl EntryDriver for CompositeDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        self.process.start(plugin_id, entry_id, generation)?;
        if let Err(error) = self.worker.start(plugin_id, entry_id, generation) {
            self.process.stop(plugin_id, entry_id, generation);
            return Err(error);
        }
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        self.worker.stop(plugin_id, entry_id, generation);
        self.process.stop(plugin_id, entry_id, generation);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;
    use crate::plugin_runtime::spawn::idle_fixture_executable;

    fn enabled_host() -> Host<CompositeDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            CompositeDriver::new(RestrictedProcessDriver::new(idle_fixture_executable())),
        )
        .expect("config")
    }

    #[test]
    fn claude_owns_one_process_and_one_isolate() {
        let mut host = enabled_host();
        host.activate(claude_activation_request()).expect("activate");
        assert_eq!(
            host.slot("com.mossx.engine.claude").unwrap().state,
            SlotState::Ready
        );
        assert_eq!(host.driver().process.live_count(), 1);
        assert_eq!(host.driver().worker.live_count(), 1);
        assert!(host
            .driver()
            .worker
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .is_some());
    }

    #[test]
    fn notes_owns_only_a_worker_isolate() {
        let mut host = enabled_host();
        host.activate(notes_activation_request()).expect("activate");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        assert_eq!(host.driver().process.live_count(), 0);
        assert_eq!(host.driver().worker.live_count(), 1);
        assert!(host
            .driver()
            .worker
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_some());
        assert!(host
            .driver()
            .worker
            .isolate("com.mossx.notes", "notes-ui", 1)
            .is_none());
    }

    #[test]
    fn disable_revokes_both_fibers() {
        let mut host = enabled_host();
        host.activate(claude_activation_request()).expect("activate");
        host.disable("com.mossx.engine.claude").expect("disable");
        assert_eq!(host.driver().process.live_count(), 0);
        assert_eq!(host.driver().worker.live_count(), 0);
    }

    #[test]
    fn ready_reactivate_revokes_both_old_fibers() {
        let mut host = enabled_host();
        host.activate(claude_activation_request()).expect("first");
        host.activate(claude_activation_request()).expect("second");
        assert_eq!(host.driver().process.live_count(), 1);
        assert_eq!(host.driver().worker.live_count(), 1);
        assert!(host
            .driver()
            .worker
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .is_none());
        assert!(host
            .driver()
            .worker
            .isolate("com.mossx.engine.claude", "claude-worker", 2)
            .is_some());
    }
}
