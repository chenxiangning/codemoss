# panel-lock-screen Specification

## Purpose

Define panel lock screen entry, unlock contract, and completion-bubble behavior while preserving background execution.

## Requirements

### Requirement: Titlebar lock entry

The system SHALL provide a lock button in the main header action area so the user can quickly enable panel lock.

#### Scenario: User enables lock from titlebar

- **WHEN** the user clicks the lock button in the header actions
- **THEN** the UI SHALL enter locked mode and render the full-screen lock overlay

### Requirement: Non-blocking lock overlay

The system SHALL keep ongoing conversation execution running while the lock overlay is active.

#### Scenario: Background run continues during lock

- **GIVEN** a thread is processing
- **WHEN** the user enables lock
- **THEN** processing SHALL continue and complete in background without interruption

### Requirement: Unlock with local password file

The system SHALL validate unlock password from local file `~/.codemoss/client/pwd.txt` with default content `123456`.

#### Scenario: Unlock with existing password file

- **GIVEN** `~/.codemoss/client/pwd.txt` exists and contains password text
- **WHEN** user enters matching password
- **THEN** lock overlay SHALL close and app becomes interactive

#### Scenario: Reject invalid password

- **GIVEN** `~/.codemoss/client/pwd.txt` exists
- **WHEN** user enters password that does not match file content
- **THEN** the app SHALL remain locked and show explicit error message

#### Scenario: Missing password file fallback

- **GIVEN** `~/.codemoss/client/pwd.txt` does not exist
- **WHEN** user attempts unlock
- **THEN** unlock SHALL be allowed to avoid first-run deadlock
- **AND** system SHALL create `~/.codemoss/client/pwd.txt` with default `123456`

### Requirement: Lock page explains password storage path

The system SHALL show where password is stored and instruct manual edit workflow.

#### Scenario: User checks password location

- **WHEN** lock overlay is shown
- **THEN** unlock panel SHALL display `~/.codemoss/client/pwd.txt` as storage path
- **AND** indicate password can be changed by editing file directly

### Requirement: Session completion bubble in main page

The system SHALL display a non-auto-dismiss completion bubble at the lower-right area when a session run completes.

#### Scenario: Completion bubble lifecycle

- **WHEN** a session completes
- **THEN** a completion bubble SHALL appear at lower-right
- **AND** it SHALL remain visible until user closes it or opens the target session

#### Scenario: Same-session replacement

- **GIVEN** a completion bubble already exists for a session
- **WHEN** the same session completes again
- **THEN** previous bubble SHALL be replaced by the latest one (single bubble per session)

#### Scenario: Open from bubble

- **WHEN** user clicks open icon on completion bubble
- **THEN** app SHALL navigate to target workspace/thread
- **AND** remove that bubble from queue

### Requirement: Completion detection robustness

The system SHALL detect completion with multiple signals to avoid stale first-run bubbles.

#### Scenario: Completion signal union

- **WHEN** any of below becomes true for a non-processing thread:
- `isProcessing` transitions `true -> false`
- `lastDurationMs` changes
- `lastAgentMessage.timestamp` advances after processing
- **THEN** system SHALL refresh completion bubble for that session with latest content

#### Scenario: Initial tracker warm-up

- **WHEN** app initializes completion trackers for current session map
- **THEN** no completion bubble SHALL be emitted from initialization snapshot alone

### Requirement: Bubble avoids update-toast overlap

The system SHALL offset completion bubbles upward while update toast is visible.

#### Scenario: Automatic collision avoidance

- **GIVEN** update toast stage is not `idle`
- **WHEN** completion bubbles are visible
- **THEN** bubble container SHALL shift upward to avoid overlap
