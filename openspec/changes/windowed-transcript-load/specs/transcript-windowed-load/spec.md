# transcript-windowed-load Spec

## ADDED Requirements

### Requirement: Claude UI open MAY load a tail window

Opening a Claude session in the canvas MAY request `limit` + optional `before` cursor. The backend MUST tail-read JSONL and MUST NOT require parsing the entire file before returning the first window.

#### Scenario: first paint uses recent messages

- **WHEN** the Claude history loader opens a session with `limit=80`
- **THEN** the returned `messages` MUST be the newest visible rows up to 80
- **AND** `hasMore` MUST be true when older rows remain
- **AND** the disk transcript MUST remain unchanged

#### Scenario: omitted limit keeps full load

- **WHEN** `load_claude_session` is called without `limit` (fork / resume / tests)
- **THEN** behavior MUST match the previous full-session contract

### Requirement: Gemini load MUST bound memory

Gemini `load_gemini_session` MUST reject or degrade files above a documented byte cap instead of unbounded `read_to_string` of multi-100MiB JSON.

#### Scenario: oversized Gemini file is readable-error

- **WHEN** a Gemini session file is larger than the load cap
- **THEN** the command MUST return a user-readable error
- **AND** MUST NOT grow process memory with the full file tree
