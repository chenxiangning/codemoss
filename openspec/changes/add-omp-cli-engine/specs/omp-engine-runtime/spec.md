## ADDED Requirements

### Requirement: OMP MUST Have An Independent Engine Identity

The system MUST represent OMP as an independent engine identity with its own registry entry, runtime owner, capability state and feature flags. OMP MUST NOT route through PI-specific protocol or business state.

#### Scenario: OMP is discovered
- **WHEN** the engine registry is loaded
- **THEN** OMP is returned as `omp` with independent protocol and runtime metadata
- **AND** existing engine entries remain unchanged

#### Scenario: PI parser is unavailable
- **WHEN** an OMP session is started
- **THEN** the runtime MUST use OMP-owned transport code
- **AND** MUST NOT invoke PI RPC parsing or settlement code

### Requirement: OMP Runtime Identity MUST Include Workspace Profile Provider And Session

The system MUST bind an OMP runtime using workspace, runtime profile, provider profile and native session identities.

#### Scenario: Two profiles run in one workspace
- **WHEN** two OMP profiles start sessions in the same workspace
- **THEN** their runtime keys and credential/catalog scopes MUST remain distinct

#### Scenario: Native session identity is promoted
- **WHEN** OMP exposes a canonical native session id
- **THEN** the mapping to the mossx logical thread MUST be persisted
- **AND** pending identity MUST NOT create a second conversation

### Requirement: Unknown OMP Capabilities MUST Fail Closed

OMP capabilities not supported by evidence MUST be represented as `unknown` and MUST NOT be invoked by UI or runtime automatically.

#### Scenario: Unverified capability is selected
- **WHEN** a user requests an OMP capability whose state is `unknown`
- **THEN** the system MUST show an explainable unavailable state
- **AND** MUST NOT silently fall back to another engine or provider
