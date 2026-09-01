//! OMP-specific identity metadata.
//!
//! This registry is intentionally independent from the legacy EngineType enum
//! until the complete OMP adapter/runtime can be introduced atomically.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpProtocolFamily {
    AcpStdio,
    NativeRpc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpCapabilityState {
    Supported,
    Unknown,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OmpIdentity {
    pub id: &'static str,
    pub display_name: &'static str,
    pub binary_name: &'static str,
    pub protocol_families: &'static [OmpProtocolFamily],
    pub execution_model: &'static str,
    pub capability_state: OmpCapabilityState,
}

const OMP_PROTOCOLS: &[OmpProtocolFamily] =
    &[OmpProtocolFamily::AcpStdio, OmpProtocolFamily::NativeRpc];

pub const OMP_IDENTITY: OmpIdentity = OmpIdentity {
    id: "omp",
    display_name: "OMP CLI",
    binary_name: "omp",
    protocol_families: OMP_PROTOCOLS,
    execution_model: "persistent",
    capability_state: OmpCapabilityState::Unknown,
};

pub fn omp_identity() -> &'static OmpIdentity {
    &OMP_IDENTITY
}

#[cfg(test)]
mod tests {
    use super::{omp_identity, OmpCapabilityState, OmpProtocolFamily};

    #[test]
    fn exposes_independent_omp_identity_and_dual_protocols() {
        let identity = omp_identity();
        assert_eq!(identity.id, "omp");
        assert_eq!(identity.binary_name, "omp");
        assert_eq!(identity.execution_model, "persistent");
        assert_eq!(identity.capability_state, OmpCapabilityState::Unknown);
        assert_eq!(
            identity.protocol_families,
            &[OmpProtocolFamily::AcpStdio, OmpProtocolFamily::NativeRpc]
        );
    }

    #[test]
    fn identity_does_not_claim_unverified_capabilities() {
        assert_eq!(omp_identity().capability_state, OmpCapabilityState::Unknown);
    }
}
