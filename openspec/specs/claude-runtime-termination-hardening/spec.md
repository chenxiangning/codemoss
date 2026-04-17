# claude-runtime-termination-hardening Specification

## Purpose
TBD - created by archiving change 2026-04-08-fix-claude-runtime-termination-hardening. Update Purpose after archive.
## Requirements
### Requirement: Claude Child Process Termination MUST Be Cross-Platform and Tree-Safe
Claude runtime MUST use a unified child termination primitive that is deterministic across platforms and safe for already-exited processes.

#### Scenario: already-exited child is treated as no-op
- **WHEN** termination is requested for a child process that has already exited
- **THEN** runtime MUST return success without forcing extra kill attempts
- **AND** runtime MUST avoid reporting false failure for this path

#### Scenario: windows termination cleans process tree
- **WHEN** runtime terminates Claude child process on Windows
- **THEN** runtime MUST attempt process-tree termination semantics (equivalent to `taskkill /T /F`)
- **AND** runtime MUST wait for process completion or return diagnosable failure

#### Scenario: non-windows or fallback path remains deterministic
- **WHEN** runtime executes non-Windows termination or Windows fallback
- **THEN** runtime MUST perform kill + wait semantics deterministically
- **AND** failure result MUST include actionable error text

### Requirement: Claude Interrupt MUST Not Await Child Termination Under Active Process Lock
Claude `interrupt` flow MUST release shared process map lock before awaiting per-child termination operations.

#### Scenario: interrupt drains active map before terminate awaits
- **WHEN** user triggers interrupt while one or more Claude turns are running
- **THEN** runtime MUST first move active child handles out of shared map
- **AND** per-child termination awaits MUST run after lock release

#### Scenario: interrupt still clears ephemeral tool and input state on partial failures
- **WHEN** one or more child terminations fail during interrupt
- **THEN** runtime MUST still clear turn-ephemeral tracking state
- **AND** runtime MUST return stable failure signal for observability

### Requirement: Claude Turn-Level Stop Paths MUST Reuse Shared Termination Primitive
All Claude turn-level stop paths MUST call the same termination primitive to avoid semantic drift.

#### Scenario: interrupt_turn uses shared terminate helper
- **WHEN** runtime handles single-turn interrupt (`interrupt_turn`)
- **THEN** termination MUST be delegated to shared child-termination helper
- **AND** turn-scoped ephemeral state MUST be cleared after stop attempt

#### Scenario: AskUserQuestion recovery path uses shared terminate helper
- **WHEN** AskUserQuestion resume flow needs to stop parent or resume child process
- **THEN** runtime MUST invoke the same shared child-termination helper
- **AND** runtime MUST keep error logging diagnosable without introducing direct ad-hoc kill logic

