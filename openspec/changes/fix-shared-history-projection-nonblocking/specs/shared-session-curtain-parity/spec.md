## ADDED Requirements

### Requirement: Shared history curtain MUST NOT block interaction after V0 readiness

For Shared threads, the history loading curtain / progress UI that reflects projection fetch (including the “canonical projection transcript” phase) MUST NOT remain as a full-canvas blocking loading gate after V0 snapshot readiness. Progress for background projection, if shown, MUST be non-blocking.

#### Scenario: Projection phase progress is non-blocking after V0

- **GIVEN** a Shared thread has completed V0 snapshot hydration and cleared blocking history loading
- **WHEN** canonical projection is still fetching or merging
- **THEN** the UI MUST NOT keep `isHistoryLoading` / equivalent full-canvas history curtain active solely for that projection work
- **AND** any residual progress affordance MUST be non-blocking (or omitted)

#### Scenario: Recovery unlocked banner is independent of history curtain

- **GIVEN** Shared send recovery has cleared (unlocked)
- **AND** history projection is still incomplete
- **THEN** the recovery status presentation MUST NOT re-imply a send lock solely due to history projection
- **AND** the history path MUST NOT keep a blocking curtain that makes the unlock appear incomplete
