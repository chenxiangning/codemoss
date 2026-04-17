# composer-incremental-undo-redo Specification

## Purpose

定义 ChatInputBox 的增量撤销/重做事务模型，保证输入体验符合用户预期并在多平台快捷键上保持一致。

## Requirements

### Requirement: Incremental Undo Behavior in ChatInputBox

The system MUST provide incremental undo for ChatInputBox text editing so that each undo operation reverts one recent edit transaction instead of clearing the entire input content.

#### Scenario: Undo reverts latest transaction only

- **WHEN** the user types multiple text segments in sequence and presses `Ctrl/Cmd + Z` once
- **THEN** the system SHALL revert only the latest edit transaction and keep earlier content intact

#### Scenario: Undo chain reaches empty state progressively

- **WHEN** the user repeatedly presses `Ctrl/Cmd + Z` after multiple transactions
- **THEN** the system SHALL step back transaction by transaction until the input becomes empty

### Requirement: Deterministic Transaction Boundaries

The system MUST define deterministic edit transaction boundaries for ChatInputBox history commits.

#### Scenario: Time-window merge for continuous typing

- **WHEN** consecutive typing inputs occur within `400ms`
- **THEN** the system SHALL merge them into one undo transaction

#### Scenario: Hard boundaries create new transaction

- **WHEN** input crosses whitespace/newline, paste, selection replacement, or completion commit boundaries
- **THEN** the system SHALL start a new undo transaction

### Requirement: Symmetric Redo Behavior

The system MUST provide redo behavior symmetric to undo for ChatInputBox, including `Ctrl/Cmd + Shift + Z` and `Ctrl/Cmd + Y` mappings.

#### Scenario: Redo restores undone transaction

- **WHEN** the user performs undo and then triggers redo
- **THEN** the system SHALL restore the most recently undone transaction

#### Scenario: New input clears redo chain

- **WHEN** the user performs undo and then enters new text input
- **THEN** the system SHALL clear redo history before recording the new transaction

### Requirement: Cross-Platform Shortcut Compatibility

The system MUST provide explicit Win/mac shortcut compatibility for undo/redo in ChatInputBox and SHALL keep behavior consistent with platform conventions.

#### Scenario: macOS undo and redo mapping

- **WHEN** the user presses `Cmd+Z` or `Cmd+Shift+Z` while ChatInputBox is focused
- **THEN** the system SHALL execute undo for `Cmd+Z` and redo for `Cmd+Shift+Z`

#### Scenario: Windows undo and redo mapping

- **WHEN** the user presses `Ctrl+Z`, `Ctrl+Y`, or `Ctrl+Shift+Z` while ChatInputBox is focused
- **THEN** the system SHALL execute undo for `Ctrl+Z` and redo for `Ctrl+Y`/`Ctrl+Shift+Z`

#### Scenario: Linux undo and redo mapping

- **WHEN** the user presses `Ctrl+Z` or `Ctrl+Shift+Z` while ChatInputBox is focused
- **THEN** the system SHALL execute undo for `Ctrl+Z` and redo for `Ctrl+Shift+Z`

### Requirement: Shortcut Scope Boundary

The system MUST scope undo/redo interception to ChatInputBox focus context and SHALL NOT affect other editors or global shortcut handling.

#### Scenario: Non-composer focus bypass

- **WHEN** focus is outside ChatInputBox
- **THEN** the system SHALL NOT intercept undo/redo shortcut events

#### Scenario: Disabled composer bypass

- **WHEN** ChatInputBox is disabled or not editable
- **THEN** the system SHALL NOT mutate undo/redo history or consume undo/redo shortcuts

### Requirement: Programmatic Mutations Participate in Same History Model

The system MUST record programmatic text mutations in ChatInputBox under the same undo/redo history model as user typing.

#### Scenario: Completion insertion is undoable

- **WHEN** a completion action inserts or replaces text in ChatInputBox
- **THEN** the system SHALL allow one undo operation to revert that completion mutation

#### Scenario: File tag rendering rewrite is undo-safe

- **WHEN** file-tag rendering rewrites editor DOM structure without changing logical text
- **THEN** the system SHALL preserve logical text and cursor consistency across undo/redo operations

#### Scenario: Programmatic no-op mutation does not create history step

- **WHEN** a programmatic mutation does not change canonical text or selection range
- **THEN** the system SHALL NOT append a new undo transaction

### Requirement: Selection-Accurate Snapshot Replay

The system MUST restore both text and selection range during undo/redo replay.

#### Scenario: Selection replacement replay is consistent

- **WHEN** the user replaces a selected range and then performs undo/redo
- **THEN** the system SHALL restore both logical text and selection range consistently

### Requirement: IME-Compatible History Commit

The system MUST avoid committing transient IME composition states to undo history and SHALL commit only finalized composition results.

#### Scenario: Composition interim states are not committed

- **WHEN** the user is in active IME composition
- **THEN** the system SHALL NOT create undo transactions for interim composition states

#### Scenario: Final composition result is undoable

- **WHEN** IME composition ends and finalized text is committed
- **THEN** the system SHALL record a valid undo transaction for the finalized text
