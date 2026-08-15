//! Combine Host fuse with DataPlane revoke. No spawn, not in boot.

use super::host::{EntryDriver, Host, HostError};
use super::mxpd::DataPlane;

pub fn fuse_and_revoke<D: EntryDriver>(
    host: &mut Host<D>,
    plane: &mut DataPlane,
    plugin_id: &str,
) -> Result<(), HostError> {
    let generation = host.slot(plugin_id).map(|slot| slot.generation).unwrap_or(0);
    host.fuse(plugin_id)?;
    plane.revoke(plugin_id, generation);
    Ok(())
}

pub fn disable_and_revoke<D: EntryDriver>(
    host: &mut Host<D>,
    plane: &mut DataPlane,
    plugin_id: &str,
) -> Result<(), HostError> {
    let generation = host.slot(plugin_id).map(|slot| slot.generation).unwrap_or(0);
    host.disable(plugin_id)?;
    plane.revoke(plugin_id, generation);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::host::{FakeDriver, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    #[test]
    fn fuse_and_revoke_fuses_the_slot_and_drops_streams() {
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        let generation = host.activate(notes_activation_request()).expect("activate");
        let mut plane = DataPlane::default();
        plane
            .open("com.mossx.notes", generation, 3, "engine-event-v1")
            .expect("open");
        fuse_and_revoke(&mut host, &mut plane, "com.mossx.notes").expect("fuse");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Fused);
        assert!(plane.codec(3).is_none());
    }

    #[test]
    fn disable_and_revoke_disables_the_slot_and_drops_streams() {
        let mut host = Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            FakeDriver::default(),
        )
        .expect("config");
        let generation = host.activate(notes_activation_request()).expect("activate");
        let mut plane = DataPlane::default();
        plane
            .open("com.mossx.notes", generation, 3, "engine-event-v1")
            .expect("open");
        disable_and_revoke(&mut host, &mut plane, "com.mossx.notes").expect("disable");
        assert_eq!(
            host.slot("com.mossx.notes").unwrap().state,
            SlotState::Disabled
        );
        assert!(plane.codec(3).is_none());
    }
}
