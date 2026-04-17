# file-view-markdown-github-preview Specification Delta

## ADDED Requirements

### Requirement: File View Markdown Preview SHALL Remain Stable During Large Documents And Surface Transitions

The system SHALL keep file-preview Markdown rendering readable and stable when the user switches tabs, switches modes, or opens larger Markdown documents that stress the renderer.

#### Scenario: switching away from and back to markdown preview does not blank the document
- **WHEN** the user opens a Markdown file in preview mode, switches to another file or mode, and then returns
- **THEN** the Markdown preview MUST recover to a readable rendered state for the current document
- **AND** the file view MUST NOT remain blank or show stale content from a previous file

#### Scenario: large markdown documents can degrade without breaking readability
- **WHEN** the user opens a Markdown document whose full rich preview exceeds the safe rendering budget
- **THEN** the system MUST preserve a readable Markdown preview experience through bounded degradation
- **AND** it MUST NOT freeze indefinitely while attempting the richest possible rendering

#### Scenario: markdown degradation threshold is deterministic across platforms
- **WHEN** a Markdown file exceeds the first-phase rich-preview budget by file size, line count, or `truncated` state
- **THEN** the file view MUST degrade using the same deterministic threshold policy on Windows and macOS
- **AND** it MUST NOT choose different render paths solely because one machine is faster than another

### Requirement: File View Markdown Preview SHALL Fail Closed To A Readable File-Preview Surface

The system SHALL keep Markdown rendering failures inside the file-preview boundary and MUST degrade to a readable file-view result instead of escaping into unrelated renderers or leaving the panel unusable.

#### Scenario: markdown-specific render failure stays inside file view
- **WHEN** a Markdown document triggers a file-preview rendering failure
- **THEN** the system MUST keep the failure isolated to the file-view renderer boundary
- **AND** it MUST NOT fall back to the message-curtain Markdown renderer

#### Scenario: markdown render failure still exposes readable content
- **WHEN** the file-preview Markdown renderer cannot complete its richest render path
- **THEN** the user MUST still receive a readable file-preview result for the current document
- **AND** the system MUST NOT replace the document with an empty panel or an uncaught error state
