# spec-hub-adapter-openspec Specification Delta

## ADDED Requirements

### Requirement: OpenSpec Command Adapter

The system SHALL provide an OpenSpec adapter that maps Spec Hub actions to OpenSpec CLI commands with structured
results.

#### Scenario: Execute mapped action successfully

- **WHEN** user triggers `continue`, `apply`, `verify`, or `archive` for a selected change
- **THEN** adapter SHALL invoke the mapped OpenSpec command in workspace context
- **AND** adapter SHALL return structured payload (`success`, `stdout`, `stderr`, `exitCode`)

### Requirement: Preflight Preconditions Check

The adapter SHALL perform preflight checks before action execution.

#### Scenario: Missing tasks before apply

- **WHEN** user triggers `apply` while required tasks context is missing
- **THEN** adapter SHALL reject command execution
- **AND** adapter SHALL return blocker details consumable by execution console actions tab

### Requirement: Strict Validation Structuring

The adapter SHALL transform strict validation output into UI-consumable structured diagnostics.

#### Scenario: Strict validation fails

- **WHEN** `openspec validate <change> --strict` reports failures
- **THEN** adapter SHALL emit diagnostics including failed entity and reason
- **AND** diagnostics SHALL include actionable hint text for remediation

### Requirement: Error Context Enrichment

The adapter MUST preserve execution context for all failures.

#### Scenario: Command execution error

- **WHEN** CLI invocation fails due to environment or command error
- **THEN** adapter SHALL include command, provider, workspace, and error summary in result metadata
- **AND** UI SHALL be able to surface the failure without parsing raw terminal output

### Requirement: Archive Semantic Failure Recognition

The adapter SHALL classify archive semantic-abort outputs as failed actions even when process exit code is zero.

#### Scenario: Archive abort text indicates failure

- **WHEN** archive output contains semantic abort signals (for example `failed for header` or
  `Aborted. No files were changed.`)
- **THEN** adapter SHALL mark action result as failed
- **AND** failure output SHALL be preserved for UI blocker/takeover context
