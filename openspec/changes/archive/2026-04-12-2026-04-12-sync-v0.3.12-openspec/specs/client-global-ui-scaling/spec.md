## MODIFIED Requirements

### Requirement: User can configure canvas width mode for chat surfaces
The system SHALL provide chat canvas width preference with values `narrow` and `wide`.

#### Scenario: switch to wide mode applies immediately
- **WHEN** user switches canvas width mode from `narrow` to `wide`
- **THEN** message/composer container width SHALL update immediately
- **AND** app restart SHALL NOT be required

#### Scenario: invalid persisted width mode falls back to narrow
- **WHEN** persisted width mode is missing or unsupported
- **THEN** system SHALL fallback to `narrow`
- **AND** startup SHALL remain usable
