## MODIFIED Requirements

### Requirement: Large-File Regression Sentry
The system SHALL provide CI sentry checks to prevent uncontrolled re-growth of oversized files, with `>3000` hard gate and JIT remediation.

#### Scenario: Hard gate for oversized files
- **WHEN** a pull request introduces or grows a file beyond 3000 lines
- **THEN** CI sentry MUST fail the check
- **AND** remediation guidance MUST be shown in logs

#### Scenario: JIT remediation on threshold breach
- **WHEN** a pull request fails because a file exceeds 3000 lines
- **THEN** the same pull request MUST include decomposition or module extraction to bring the file back within threshold
- **AND** the pull request MUST pass typecheck and relevant module verification before merge

#### Scenario: Near-threshold observation is non-blocking
- **WHEN** a pull request introduces or grows a file within 2500-3000 lines
- **THEN** CI sentry MAY emit informational warning/report
- **AND** the merge decision MUST NOT be blocked solely by near-threshold status

### Requirement: Completion Criteria for Governance Milestones
The system SHALL define measurable completion criteria for the Deferred + JIT governance mode.

#### Scenario: Deferred strategy review
- **WHEN** governance review is performed
- **THEN** review MUST include hard-gate violations count, JIT remediation outcomes, and unresolved risk list
- **AND** retained near-threshold files MAY be documented as watchlist items without mandatory decomposition plan
