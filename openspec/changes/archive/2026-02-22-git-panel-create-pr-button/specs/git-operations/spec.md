## ADDED Requirements

### Requirement: PR Workflow Backend Contract

The system SHALL provide stable backend contracts for PR defaults detection and workflow execution.

#### Scenario: Detect defaults from repository context

- **WHEN** client requests PR defaults
- **THEN** backend SHALL return upstream/base/head/title/body/comment defaults
- **AND** backend SHALL return `canCreate` and `disabledReason` for UI gating

#### Scenario: Execute workflow with deterministic stage contract

- **WHEN** client starts PR workflow
- **THEN** backend SHALL return stage-based result for `precheck/push/create/comment`
- **AND** stage status SHALL use normalized values (`pending/running/success/failed/skipped`)

### Requirement: Token Isolation and Transport Fallback

The workflow SHALL apply command execution hardening for Git/GitHub CLI calls.

#### Scenario: Token-isolated command execution

- **WHEN** workflow invokes git/gh commands
- **THEN** commands SHALL run with token-isolated environment (`env -u GH_TOKEN -u GITHUB_TOKEN`)
- **AND** command output SHALL be available for diagnostic summary

#### Scenario: HTTP2 push failure fallback

- **WHEN** push fails with HTTP2 framing or equivalent transport signatures
- **THEN** workflow SHALL retry once with `http.version=HTTP/1.1`
- **AND** retry outcome SHALL be reflected in push stage detail

### Requirement: Preconditions and Range Gate

The workflow SHALL validate operational readiness before PR creation.

#### Scenario: GitHub CLI readiness

- **WHEN** workflow enters precheck stage
- **THEN** backend SHALL verify `gh --version` and `gh auth status`
- **AND** readiness failure SHALL return actionable message, not generic unknown error

#### Scenario: Upstream range gate

- **WHEN** workflow validates diff scope
- **THEN** backend SHALL evaluate `upstream/<base>...HEAD`
- **AND** abnormal scope SHALL block workflow before create stage with clear guidance
