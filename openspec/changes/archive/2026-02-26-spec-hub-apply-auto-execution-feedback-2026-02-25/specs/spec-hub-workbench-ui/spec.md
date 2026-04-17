## ADDED Requirements

### Requirement: Execution Console Control IA

The system SHALL render execution console control tabs in `project-first` order and open `project` by default.

#### Scenario: Default tab and order follow project-first IA

- **WHEN** execution console is first rendered for a selected change
- **THEN** control tab order SHALL be `project` before `actions`
- **AND** default active tab SHALL be `project`

#### Scenario: Tab switching keeps change context stable

- **WHEN** user switches between `project` and `actions`
- **THEN** selected change context SHALL remain unchanged
- **AND** current runtime state SHALL not be reset

### Requirement: Project Tab Card Layout Refactor

The system SHALL present the `project` tab as clear card-based sections for path and project metadata operations.

#### Scenario: SPEC path card is independently operable

- **WHEN** user opens `project` tab
- **THEN** UI SHALL show `SPEC 位置配置` card with path input, effective-path display, and save/reset actions
- **AND** user SHALL be able to complete path operations without entering the actions tab

#### Scenario: Project info card has consistent control hierarchy

- **WHEN** user interacts with project metadata controls
- **THEN** UI SHALL show clear hierarchy for icon, copy, selector, command preview, and primary action button
- **AND** spacing/visual grouping SHALL keep controls readable on narrow panel width

### Requirement: Actions Tab Orchestration Layout

The system SHALL provide a unified orchestration area in `actions` tab for execution engine and proposal entries.

#### Scenario: Shared engine selector is shown once in actions orchestration area

- **WHEN** actions tab renders orchestration controls
- **THEN** UI SHALL provide a single shared execution engine selector
- **AND** selected engine SHALL be reused by apply, AI takeover, and proposal actions

#### Scenario: Engine selector and proposal triggers are in one row

- **WHEN** actions orchestration row is rendered
- **THEN** UI SHALL place `engine selector`, `new proposal trigger`, and `append proposal trigger` in the same row
- **AND** proposal triggers SHALL be rendered as compact icon buttons

#### Scenario: Engine selector displays engine icon

- **WHEN** engine selector renders trigger and options
- **THEN** each engine item SHALL display corresponding icon with label
- **AND** selected item view SHALL preserve engine icon for quick recognition

#### Scenario: Existing action chain remains available

- **WHEN** user enters actions tab
- **THEN** continue/apply/verify/archive actions SHALL remain available with existing gate semantics
- **AND** action blocks SHALL follow unified card layout

### Requirement: Proposal Entry and Modal Interaction

The system SHALL provide `new proposal` and `append proposal` entries via modal-driven input.

#### Scenario: User creates a new proposal from actions tab

- **WHEN** user clicks `new proposal`
- **THEN** system SHALL open an input modal for proposal content
- **AND** submission SHALL trigger AI processing with current shared engine

#### Scenario: User appends content to an existing change proposal

- **WHEN** user clicks `append proposal`
- **THEN** system SHALL open an input modal with target-change selection
- **AND** submission SHALL bind selected change and append content through AI processing

#### Scenario: Proposal modal supports rich text-area composition

- **WHEN** user enters proposal content in create/append modal
- **THEN** modal SHALL provide a multi-line rich composer area suitable for long-form context input
- **AND** composer SHALL preserve readable spacing and editing affordance in narrow panel layouts

#### Scenario: Proposal modal accepts image attachments

- **WHEN** user provides screenshot/image evidence for proposal context
- **THEN** modal SHALL support image attachment via explicit upload entry (and may support paste/drag-drop)
- **AND** attached images SHALL be previewable/removable before submit

#### Scenario: Icon-only proposal triggers remain accessible

- **WHEN** proposal triggers are rendered as icon-only buttons
- **THEN** each trigger SHALL expose accessible name/tooltip for discoverability
- **AND** keyboard focus state SHALL be clearly visible

### Requirement: Proposal Processing Feedback Reuse

The system SHALL reuse apply-grade realtime feedback for proposal processing flows.

#### Scenario: Proposal processing phase progress is visible

- **WHEN** create/append proposal processing is running
- **THEN** UI SHALL display phase-level realtime feedback including status/phase/engine
- **AND** user SHALL see streaming output/log updates without leaving current panel

#### Scenario: Proposal completion refreshes and summarizes result

- **WHEN** proposal processing completes
- **THEN** UI SHALL refresh Spec Hub runtime state automatically
- **AND** UI SHALL show visible result summary and related change reference when resolvable

### Requirement: Verify Action Optional Auto-Completion Toggle

The system SHALL provide an explicit opt-in toggle near `verify` action to enable completion-before-validate behavior
without changing default verify semantics.

#### Scenario: Verify keeps current behavior when auto-completion toggle is off

- **WHEN** user triggers `verify` with auto-completion toggle unchecked (default)
- **THEN** UI SHALL execute current strict validate behavior directly
- **AND** UI SHALL NOT run any completion step before validate

#### Scenario: Verify auto-completes missing verification when toggle is on

- **WHEN** user enables auto-completion toggle and triggers `verify` while `verification` artifact is missing
- **THEN** UI SHALL run completion step first and then run strict validate automatically after completion succeeds
- **AND** UI SHALL expose clear progress state for completion and validate phases

#### Scenario: Verify toggle is locked during running action

- **WHEN** verify-related action is running
- **THEN** auto-completion toggle SHALL be disabled
- **AND** user SHALL NOT be able to switch verify mode mid-run

### Requirement: Verify Auto-Completion Realtime Overlay Reuse

The system SHALL reuse the same feedback overlay model used by apply/proposal when verify auto-completion is enabled.

#### Scenario: Verify auto-completion opens shared feedback overlay

- **WHEN** user triggers `verify` with auto-completion enabled and `verification` artifact is missing
- **THEN** UI SHALL open the shared realtime feedback overlay (same interaction model as apply/proposal)
- **AND** overlay SHALL render status/phase/engine/output/log streams for the completion pipeline

#### Scenario: Verify auto-completion failure is explicit in overlay

- **WHEN** completion phase fails before strict validate
- **THEN** overlay SHALL show actionable failure detail
- **AND** UI SHALL explicitly indicate strict validate was skipped for this run

#### Scenario: Direct verify path keeps current behavior

- **WHEN** auto-completion is disabled or `verification` artifact already exists
- **THEN** UI SHALL keep existing direct verify flow
- **AND** UI SHALL NOT force open completion-feedback overlay

### Requirement: Feedback Overlay Draggable Positioning

The system SHALL allow users to drag feedback overlay to avoid visual occlusion.

#### Scenario: Overlay can be dragged from default anchor

- **WHEN** feedback overlay is visible
- **THEN** user SHALL be able to drag it by header handle
- **AND** default initial anchor SHALL remain bottom-right

#### Scenario: Dragging does not interrupt execution

- **WHEN** user drags overlay during running state
- **THEN** current execution pipeline SHALL continue without interruption
- **AND** streaming feedback SHALL continue updating in the moved overlay

### Requirement: Continue Action Optional AI Enhancement Toggle

The system SHALL provide an explicit opt-in toggle for `continue` AI enhancement while preserving default continue
behavior.

#### Scenario: Continue keeps current behavior when AI enhancement is off

- **WHEN** user triggers `continue` with `AI 增强` toggle unchecked (default)
- **THEN** UI SHALL execute current `continue` command-only behavior
- **AND** UI SHALL NOT run extra AI analysis step

#### Scenario: Continue runs command plus read-only AI enhancement when enabled

- **WHEN** user enables `AI 增强` and triggers `continue`
- **THEN** UI SHALL run OpenSpec continue command first and then run AI enhancement analysis
- **AND** enhancement output SHALL be shown as structured brief for user review

#### Scenario: Continue enhancement is explicitly read-only

- **WHEN** continue AI enhancement is running
- **THEN** UI copy SHALL indicate read-only analysis semantics
- **AND** flow SHALL NOT auto-check tasks or perform any writeback action

### Requirement: Execute Handoff from Continue AI Brief

The system SHALL allow `apply` execution to optionally consume the latest continue AI brief as additional context.

#### Scenario: Apply defaults to using latest continue brief when available

- **WHEN** latest continue AI brief exists for current change
- **THEN** UI SHALL show visible handoff status and default `use brief` to enabled
- **AND** apply execution SHALL include that brief in execution context

#### Scenario: User can disable brief handoff before apply

- **WHEN** user turns off `use continue brief` option
- **THEN** apply SHALL run with existing prompt path without brief injection
- **AND** execution behavior SHALL remain backward compatible

#### Scenario: Missing or stale brief does not block apply

- **WHEN** continue brief is missing or marked stale
- **THEN** UI MAY show hint/warning
- **AND** apply action SHALL remain executable

### Requirement: Post-Proposal Progressive Completion UX

The system SHALL keep completion-oriented actions reachable when a new change is still in proposal-only or
artifact-incomplete stage.

#### Scenario: Continue remains available for proposal-only change

- **WHEN** selected change has proposal but is missing design/specs delta/tasks
- **THEN** `continue` action SHALL remain clickable
- **AND** UI SHALL NOT block continue due to those missing artifacts alone

#### Scenario: Apply is not blocked by missing tasks artifact itself

- **WHEN** selected change is missing `tasks.md` but has enough upstream context to run apply guidance/execution
- **THEN** `apply` action SHALL remain reachable for task-generation purpose
- **AND** UI SHALL NOT use `missing tasks.md` as a self-blocking condition

#### Scenario: Missing specs delta provides actionable next-step hint

- **WHEN** selected change is missing specs delta required before apply
- **THEN** UI SHALL present actionable next-step guidance (for example: run `continue` first)
- **AND** guidance SHALL be consistent with current action enabled/disabled states
