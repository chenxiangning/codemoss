## ADDED Requirements

### Requirement: Late Shared projection MUST keep V0 first-paint without prefix replay

Shared V0 first-paint and soft-timeout remain the ready gate. A later successful projection MUST merge into the already-interactive canvas and MUST NOT re-enter oldest-first progressive hydration.

#### Scenario: Projection merge after V0 stays on the latest painted turn

- **GIVEN** Shared Phase-A has cleared `historyLoading` with a V0 canvas
- **WHEN** background projection completes
- **THEN** the merge MUST use live canvas items as the left-hand side
- **AND** MUST NOT replay the conversation from the oldest item to the newest
