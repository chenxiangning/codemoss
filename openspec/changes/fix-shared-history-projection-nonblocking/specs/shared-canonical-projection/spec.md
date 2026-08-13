## ADDED Requirements

### Requirement: Projection load for history open MUST support deferred merge without lowering success-path authority

When Shared projection is used to open historical canvas content, a successful projection MUST remain the authoritative merge input over V0 for overlapping turns (existing merge rules). Deferred or background load MUST NOT change that success-path authority. Timeout or failure after V0 readiness MUST degrade observably to V0 without hanging the open path.

#### Scenario: Successful late projection still wins merge authority

- **GIVEN** the canvas was first hydrated from V0 snapshot
- **WHEN** a later `load_shared_projection` succeeds for the same thread
- **THEN** the system MUST merge projection items with V0 using existing Shared history merge rules
- **AND** overlapping turns MUST prefer canonical projection fidelity over stale V0-only rows where merge rules already define preference

#### Scenario: Failed projection after V0 does not wipe the canvas

- **GIVEN** the canvas was hydrated from V0 snapshot
- **WHEN** projection fails or times out
- **THEN** the system MUST retain the V0 canvas
- **AND** MUST NOT clear conversation items solely because projection failed
