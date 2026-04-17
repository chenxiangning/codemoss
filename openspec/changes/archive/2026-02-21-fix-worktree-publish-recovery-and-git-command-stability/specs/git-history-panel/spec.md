## ADDED Requirements

### Requirement: Operation Error Notice Persistence and Manual Dismiss

The Git History panel SHALL keep operation error notice visible until user explicitly dismisses it or a new operation
replaces it.

#### Scenario: Error notice does not auto-dismiss

- **WHEN** a toolbar or context Git operation fails
- **THEN** panel SHALL show error notice in error style
- **AND** notice SHALL NOT auto-dismiss after fixed 5-second timeout

#### Scenario: User manually dismisses error notice

- **WHEN** error notice is visible
- **THEN** panel SHALL provide explicit close control
- **AND** clicking close SHALL clear current error notice immediately

#### Scenario: Success notice remains short-lived

- **WHEN** a Git operation succeeds
- **THEN** panel MAY auto-dismiss success notice after short timeout
- **AND** success notice lifecycle SHALL NOT force error notice auto-dismiss behavior
