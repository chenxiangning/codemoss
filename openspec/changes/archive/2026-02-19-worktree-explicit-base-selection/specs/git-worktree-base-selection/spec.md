# git-worktree-base-selection Specification Delta

## ADDED Requirements

### Requirement: Explicit Base Branch Selection for Worktree Creation

The system SHALL require an explicit `baseRef` when creating a new worktree branch.

#### Scenario: Base branch must be selected from dropdown

- **WHEN** user opens the "Create Worktree" dialog
- **THEN** system SHALL show Base Branch as dropdown-only control
- **AND** system SHALL show placeholder `请选择` as default value
- **AND** user SHALL be able to choose only from provided branch options

#### Scenario: Create request carries explicit baseRef

- **WHEN** user clicks `Create`
- **THEN** frontend SHALL send `baseRef` with the create-worktree request
- **AND** backend SHALL reject requests with missing `baseRef`

#### Scenario: No silent fallback to current HEAD

- **WHEN** `baseRef` is missing or invalid
- **THEN** system SHALL block creation
- **AND** system SHALL NOT fallback to implicit current `HEAD`

---

### Requirement: Base Commit Preview Before Create

The system SHALL preview the resolved commit for selected `baseRef` before creation.

#### Scenario: Preview selected base reference

- **WHEN** user selects a Base Branch
- **THEN** system SHALL display `baseRef` name and resolved short SHA

#### Scenario: Preview updates on base change

- **WHEN** user switches Base Branch selection
- **THEN** system SHALL refresh preview to the newly resolved commit

#### Scenario: Unresolvable baseRef

- **WHEN** selected Base Branch cannot be resolved to a commit
- **THEN** system SHALL show a readable validation error
- **AND** create action SHALL remain disabled

---

### Requirement: Worktree Create Validation Guardrails

The system SHALL validate branch name, baseRef, and target path before creating a worktree.

#### Scenario: Invalid branch name

- **WHEN** user inputs an invalid branch name
- **THEN** system SHALL reject input according to Git ref name rules
- **AND** system SHALL show validation message

#### Scenario: Path conflict

- **WHEN** target worktree directory already exists and is not reusable
- **THEN** system SHALL block creation with conflict message

#### Scenario: Successful validation

- **WHEN** all preconditions pass
- **THEN** system SHALL create worktree from selected base commit
- **AND** system SHALL return created branch and worktree path details

---

### Requirement: Optional Publish to Origin with Tracking

The system SHALL support optional remote publish after successful worktree creation.

#### Scenario: Publish enabled

- **WHEN** user enables `publishToOrigin` and create succeeds
- **THEN** system SHALL execute push to `origin` for the new branch
- **AND** system SHALL set upstream tracking equivalent to `git push -u origin <branch>`
- **AND** system SHALL return publish result with remote tracking reference

#### Scenario: Publish disabled

- **WHEN** user keeps `publishToOrigin` disabled
- **THEN** system SHALL skip remote push
- **AND** system SHALL still return successful local worktree creation result

#### Scenario: Publish failure is recoverable

- **WHEN** local worktree creation succeeds but push fails
- **THEN** system SHALL keep local branch/worktree intact
- **AND** system SHALL return readable failure reason and a retry command hint

---

### Requirement: Beginner-Friendly Explanations for Create Worktree Dialog

The system SHALL provide example-based explanations for key fields and actions in the dialog.

#### Scenario: Field-level explanations are visible

- **WHEN** user opens the "Create Worktree" dialog
- **THEN** system SHALL display short explanations and examples for branch name, base branch, base preview, publish
  switch, and setup script

#### Scenario: Action-level explanations are visible

- **WHEN** action buttons are shown
- **THEN** system SHALL explain the behavior of `Cancel` and `Create` in plain language for Git beginners

---

### Requirement: Wide Two-Column Dialog Layout with Styled Controls

The create-worktree dialog SHALL use a wide two-column layout on desktop and styled controls instead of default browser
appearance.

#### Scenario: Desktop layout keeps guide on the left

- **WHEN** dialog is rendered on desktop viewport
- **THEN** system SHALL show a left guide rail and a right form panel in a two-column layout

#### Scenario: Mobile layout remains usable

- **WHEN** dialog is rendered on narrow viewport
- **THEN** system SHALL stack guide and form sections vertically without losing functionality

#### Scenario: Controls use custom visual style

- **WHEN** base branch select, publish switch, and primary actions are shown
- **THEN** system SHALL render custom-styled controls rather than browser default appearance

---

### Requirement: Unified Workspace Header Action Entry

The workspace card header SHALL use a single `+` action entry instead of separate `...` and `+` buttons.

#### Scenario: Single plus entry replaces dual buttons

- **WHEN** workspace cards are rendered in sidebar
- **THEN** system SHALL display only one `+` button in header action area
- **AND** system SHALL NOT display a separate `...` button

#### Scenario: Plus menu uses grouped information architecture

- **WHEN** user clicks the `+` button
- **THEN** system SHALL show two groups in order:
- **AND** first group SHALL be `新建会话` with `Claude Code / Codex / OpenCode / Gemini`
- **AND** second group SHALL include the previous `...` menu actions

#### Scenario: Group actions include icons

- **WHEN** grouped menu is displayed
- **THEN** each action in both groups SHALL include a small semantic icon
- **AND** groups SHALL be visually separated with divider and title
