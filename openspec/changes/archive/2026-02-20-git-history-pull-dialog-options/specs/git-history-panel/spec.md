# git-history-panel Specification Delta

## ADDED Requirements

### Requirement: Pull Dialog Before Execution

The Git History toolbar SHALL open a pull configuration dialog before executing pull.

#### Scenario: Open pull dialog

- **WHEN** user clicks toolbar `Pull`
- **THEN** system SHALL open a pull dialog
- **AND** system SHALL NOT execute pull immediately

#### Scenario: Configure pull target and options

- **WHEN** pull dialog is open
- **THEN** dialog SHALL allow configuring `remote` and `target remote branch`
- **AND** target remote branch SHALL support both dropdown selection and manual input
- **AND** dialog SHALL allow selecting pull options and render selected options as removable chips

#### Scenario: Disable conflicting strategy options

- **WHEN** one strategy option among `--rebase`, `--ff-only`, `--no-ff`, `--squash` is selected
- **THEN** conflicting strategy options SHALL be disabled in options menu
- **AND** additive options (`--no-commit`, `--no-verify`) SHALL remain selectable when valid

#### Scenario: Show pull intent details and example

- **WHEN** pull dialog is open
- **THEN** dialog SHALL display `Intent`, `Will Happen`, `Will NOT Happen`, and `Example` sections
- **AND** `Example` SHALL reflect current pull target/options state

#### Scenario: Pull toolbar and dialog title icon consistency

- **WHEN** pull action is rendered in toolbar and pull dialog title
- **THEN** system SHALL show pull icon in both locations
- **AND** icon mapping SHALL stay visually consistent for the same action

#### Scenario: Confirm pull from dialog

- **WHEN** user confirms pull in dialog
- **THEN** dialog SHALL submit configured options to pull operation
- **AND** dialog SHALL enter in-progress state and disable duplicate submission

#### Scenario: Close pull dialog without side effects

- **WHEN** user cancels pull dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no pull command SHALL be sent

### Requirement: Sync, Fetch, and Refresh Dialogs Before Execution

The Git History toolbar SHALL require confirmation dialogs for `Sync`, `Fetch`, and `Refresh` actions before execution.

#### Scenario: Open sync dialog

- **WHEN** user clicks toolbar `Sync`
- **THEN** system SHALL open a sync confirmation dialog
- **AND** system SHALL NOT execute sync immediately

#### Scenario: Open fetch dialog

- **WHEN** user clicks toolbar `Fetch`
- **THEN** system SHALL open a fetch confirmation dialog
- **AND** system SHALL NOT execute fetch immediately

#### Scenario: Open refresh dialog

- **WHEN** user clicks toolbar `Refresh`
- **THEN** system SHALL open a refresh confirmation dialog
- **AND** system SHALL NOT execute refresh immediately

#### Scenario: Dialogs provide detailed intent and examples

- **WHEN** sync/fetch/refresh dialog is open
- **THEN** dialog SHALL display `Intent`, `Will Happen`, `Will NOT Happen`, and `Example` sections
- **AND** sync dialog example SHALL describe `pull -> push` sequence
- **AND** sync dialog SHALL display preflight summary (`source -> remote:target`, ahead/behind, outgoing sample)
- **AND** fetch dialog example SHALL describe fetch-only behavior without merge
- **AND** fetch dialog SHALL show fetch scope (default `all remotes`)
- **AND** refresh dialog example SHALL describe UI data reload behavior without Git network commands

#### Scenario: Distinct icons for sync/fetch/refresh semantics

- **WHEN** toolbar and dialog titles render sync/fetch/refresh actions
- **THEN** each action SHALL use its own icon mapping
- **AND** fetch and refresh SHALL NOT reuse the same icon

#### Scenario: Dialog visual hierarchy for readability

- **WHEN** any sync/fetch/refresh confirmation dialog is open
- **THEN** dialog SHALL present a three-zone layout: header, intent details, footer actions
- **AND** key risk/impact message SHALL remain visually distinguishable from secondary text

#### Scenario: Confirm sync/fetch/refresh from dialog

- **WHEN** user confirms sync/fetch/refresh dialog
- **THEN** system SHALL execute the corresponding action once
- **AND** dialog SHALL enter in-progress state and disable duplicate submission

#### Scenario: Close sync/fetch/refresh dialog without side effects

- **WHEN** user cancels sync/fetch/refresh dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no corresponding action SHALL be sent
