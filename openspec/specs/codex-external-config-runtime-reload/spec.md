# codex-external-config-runtime-reload Specification

## Purpose
TBD - created by archiving change fix-codex-source-switch-runtime-apply-2026-03-31. Update Purpose after archive.
## Requirements
### Requirement: Codex External Config Reload MUST Be Triggerable Without App Restart
The system MUST provide a client-visible action to reload Codex runtime configuration from external config files without restarting the application process.

#### Scenario: manual reload action triggers runtime refresh
- **WHEN** user clicks reload action in Codex settings after external config file changes
- **THEN** system MUST execute runtime config reload flow
- **AND** system MUST return explicit success or failure result to frontend

#### Scenario: next codex send uses latest file-based config after successful reload
- **WHEN** reload flow completes successfully
- **THEN** the next Codex send operation MUST use the latest configuration values from file
- **AND** user MUST NOT need to restart app process for the new config to take effect

### Requirement: Codex External Config Reload MUST Be Fail-Safe
If reload fails, the system MUST keep existing usable runtime context and MUST expose diagnosable error details.

#### Scenario: reload failure keeps previous runtime context usable
- **WHEN** reload flow fails due to invalid file content or read errors
- **THEN** Codex message sending MUST remain available via previous runtime context
- **AND** system MUST NOT leave runtime in half-applied state

#### Scenario: reload failure reports actionable diagnostics
- **WHEN** reload flow fails
- **THEN** backend MUST return failure stage and reason
- **AND** frontend MUST present reload failed status instead of applied status

### Requirement: Codex Reload Critical Section MUST Be Serialized
The system MUST serialize reload critical section to avoid race conditions from repeated triggers.

#### Scenario: repeated reload triggers are serialized
- **WHEN** user or UI triggers multiple reload actions in short interval
- **THEN** system MUST process reload operations sequentially or reject overlap deterministically
- **AND** final runtime config state MUST be deterministic and observable

### Requirement: Reload MUST NOT Reset Unified History Visibility
Introducing runtime reload MUST NOT clear or isolate Codex history list visibility.

#### Scenario: history remains populated across reload success
- **WHEN** user triggers reload and reload succeeds
- **THEN** Codex history list MUST remain populated by unified history policy
- **AND** system MUST NOT fallback to source-isolated empty state solely due to reload

#### Scenario: history remains populated across reload failure
- **WHEN** user triggers reload and reload fails
- **THEN** Codex history list MUST remain available from previous/runtime-safe and local aggregate sources
- **AND** frontend MUST keep previously visible entries unless user explicitly refreshes filters

