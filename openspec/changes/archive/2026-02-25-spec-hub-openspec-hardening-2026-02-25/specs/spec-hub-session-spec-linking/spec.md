## MODIFIED Requirements

### Requirement: Session-Level Spec Visibility Probe

The system SHALL perform session-level probe for linked spec root and expose structured results.

#### Scenario: Probe succeeds

- **WHEN** linked spec root exists and has valid structure
- **THEN** probe result SHALL be `visible`
- **AND** assistant SHALL answer that spec is accessible in current session

#### Scenario: Probe fails due to invalid root

- **WHEN** linked spec root is missing, inaccessible, or malformed
- **THEN** probe result SHALL be structured (`invalid` or `permissionDenied` or `malformed`)
- **AND** session SHALL provide actionable remediation options

#### Scenario: Visible probe does not show repair noise

- **WHEN** probe status is `visible`
- **THEN** session context card SHALL NOT show rebind/default repair actions
- **AND** guidance text SHALL indicate active root is already usable
