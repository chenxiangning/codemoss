# Spec: Git Panel Diff View Accessibility & Test Follow-up (Delta)

## MODIFIED Requirements

### Requirement: Tree Hierarchy Interaction

Tree mode SHALL support full keyboard navigation in addition to pointer interaction.

#### Scenario: Navigate tree nodes by keyboard

- **GIVEN** focus is within tree list
- **WHEN** user presses `ArrowUp` / `ArrowDown`
- **THEN** selection SHALL move to previous/next visible node

#### Scenario: Expand and collapse folder by keyboard

- **GIVEN** focused node is a folder
- **WHEN** user presses `ArrowRight`
- **THEN** folder SHALL expand if collapsed
- **AND** children SHALL become visible

- **WHEN** user presses `ArrowLeft`
- **THEN** folder SHALL collapse if expanded

#### Scenario: Open focused file by keyboard

- **GIVEN** focused node is a file
- **WHEN** user presses `Enter`
- **THEN** diff viewer SHALL focus that file with the same behavior as mouse click

---

### Requirement: Dual List View Modes

Flat/Tree switching SHALL support shortcut-based invocation if no conflicts exist.

#### Scenario: Toggle view by shortcut

- **WHEN** user triggers configured shortcut for list view toggle
- **THEN** panel SHALL switch between `flat` and `tree`

#### Scenario: Shortcut conflict guard

- **WHEN** chosen shortcut conflicts with existing global shortcut
- **THEN** system SHALL NOT register conflicting mapping
- **AND** SHALL keep view switching available via existing UI controls

---

## ADDED Requirements

### Requirement: Tree Hierarchy Interaction Accessibility

Tree mode SHALL expose baseline accessibility semantics for assistive technology.

#### Scenario: Tree semantics for folders

- **WHEN** tree renders folder nodes
- **THEN** folder controls SHALL expose `aria-expanded`

#### Scenario: List semantics for actionable nodes

- **WHEN** tree renders selectable nodes
- **THEN** nodes SHALL expose descriptive labels and selected state metadata

---

## MODIFIED Requirements

### Requirement: Backward Compatibility for Git Actions

Regression coverage SHALL include flat mode critical workflows after tree enhancements.

#### Scenario: Flat mode regression gate

- **WHEN** changes for tree keyboard/a11y/shortcut behavior are merged
- **THEN** automated regression checks SHALL cover flat mode Stage/Unstage/Revert and commit basics

#### Scenario: Tree interaction test coverage

- **WHEN** feature is implemented
- **THEN** automated tests SHALL cover tree build logic and focus-switch behavior
