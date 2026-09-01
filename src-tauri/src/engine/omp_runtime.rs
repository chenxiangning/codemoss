//! OMP runtime ownership and identity boundaries.

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct OmpRuntimeKey {
    pub workspace_id: String,
    pub runtime_profile_id: String,
    pub provider_profile_id: String,
    pub native_session_id: String,
}

impl OmpRuntimeKey {
    pub fn new(
        workspace_id: impl Into<String>,
        runtime_profile_id: impl Into<String>,
        provider_profile_id: impl Into<String>,
        native_session_id: impl Into<String>,
    ) -> Self {
        Self {
            workspace_id: workspace_id.into(),
            runtime_profile_id: runtime_profile_id.into(),
            provider_profile_id: provider_profile_id.into(),
            native_session_id: native_session_id.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpRuntimeState {
    Starting,
    Ready,
    Stopping,
    Stopped,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OmpRuntimeRecord {
    pub generation: u64,
    pub state: OmpRuntimeState,
}

#[derive(Debug, Default)]
pub struct OmpRuntimeOwner {
    records: HashMap<OmpRuntimeKey, OmpRuntimeRecord>,
}

impl OmpRuntimeOwner {
    pub fn start(&mut self, key: OmpRuntimeKey) -> u64 {
        let generation = self
            .records
            .get(&key)
            .map_or(1, |record| record.generation.saturating_add(1));
        self.records.insert(
            key,
            OmpRuntimeRecord {
                generation,
                state: OmpRuntimeState::Starting,
            },
        );
        generation
    }

    pub fn transition(
        &mut self,
        key: &OmpRuntimeKey,
        generation: u64,
        state: OmpRuntimeState,
    ) -> bool {
        let Some(record) = self.records.get_mut(key) else {
            return false;
        };
        if record.generation != generation
            || !matches!(
                (record.state, state),
                (OmpRuntimeState::Starting, OmpRuntimeState::Ready)
                    | (OmpRuntimeState::Starting, OmpRuntimeState::Stopping)
                    | (OmpRuntimeState::Starting, OmpRuntimeState::Stopped)
                    | (OmpRuntimeState::Ready, OmpRuntimeState::Stopping)
                    | (OmpRuntimeState::Ready, OmpRuntimeState::Stopped)
                    | (OmpRuntimeState::Stopping, OmpRuntimeState::Stopped)
            )
        {
            return false;
        }
        record.state = state;
        true
    }

    pub fn get(&self, key: &OmpRuntimeKey) -> Option<&OmpRuntimeRecord> {
        self.records.get(key)
    }
}

#[cfg(test)]
mod tests {
    use super::{OmpRuntimeKey, OmpRuntimeOwner, OmpRuntimeState};

    fn key(profile: &str, provider: &str, session: &str) -> OmpRuntimeKey {
        OmpRuntimeKey::new("workspace", profile, provider, session)
    }

    #[test]
    fn separates_profiles_and_provider_sessions_in_same_workspace() {
        let mut owner = OmpRuntimeOwner::default();
        let first = key("profile-a", "provider-a", "session-a");
        let second = key("profile-b", "provider-b", "session-b");
        let first_generation = owner.start(first.clone());
        let second_generation = owner.start(second.clone());
        assert_ne!(first, second);
        assert_eq!(first_generation, 1);
        assert_eq!(second_generation, 1);
        assert_eq!(owner.get(&first).unwrap().state, OmpRuntimeState::Starting);
        assert_eq!(owner.get(&second).unwrap().state, OmpRuntimeState::Starting);
    }

    #[test]
    fn rejects_stale_generation_transitions() {
        let mut owner = OmpRuntimeOwner::default();
        let runtime = key("profile", "provider", "session");
        let first_generation = owner.start(runtime.clone());
        let second_generation = owner.start(runtime.clone());
        assert!(!owner.transition(&runtime, first_generation, OmpRuntimeState::Ready));
        assert!(owner.transition(&runtime, second_generation, OmpRuntimeState::Ready));
        assert_eq!(owner.get(&runtime).unwrap().generation, 2);
    }
    #[test]
    fn rejects_late_ready_after_runtime_stopped() {
        let mut owner = OmpRuntimeOwner::default();
        let runtime = key("profile", "provider", "session");
        let generation = owner.start(runtime.clone());
        assert!(owner.transition(&runtime, generation, OmpRuntimeState::Ready));
        assert!(owner.transition(&runtime, generation, OmpRuntimeState::Stopping));
        assert!(owner.transition(&runtime, generation, OmpRuntimeState::Stopped));
        assert!(!owner.transition(&runtime, generation, OmpRuntimeState::Ready));
        assert_eq!(owner.get(&runtime).unwrap().state, OmpRuntimeState::Stopped);
    }
}
