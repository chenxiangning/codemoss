## ADDED Requirements

### Requirement: PR Entry in Git Toolbar

The Git History toolbar SHALL expose a `PR` entry in the top action area before pull/push/sync actions.

#### Scenario: Toolbar action order remains stable

- **WHEN** Git History panel is rendered
- **THEN** toolbar SHALL render `PR` action in the designated action group
- **AND** existing pull/push/sync/fetch/refresh actions SHALL keep their functional order

#### Scenario: PR action disabled reason

- **WHEN** current branch context is unavailable
- **THEN** `PR` action SHALL be disabled
- **AND** UI SHALL provide a readable disabled reason

### Requirement: Create PR Dialog with Compare Bar

The panel SHALL provide a dedicated Create PR dialog with compare-style repository/branch parameter controls.

#### Scenario: Open dialog with prefilled defaults

- **WHEN** user clicks `PR`
- **THEN** dialog SHALL request workflow defaults and prefill upstream/base/head/title/body/comment fields
- **AND** user SHALL be able to edit title/body/comment before execution

#### Scenario: Compare controls are searchable selectors

- **WHEN** dialog is open
- **THEN** `base repository / base / head repository / compare` fields SHALL support searchable dropdown selection
- **AND** selected values SHALL be clearly visible with overflow-safe presentation

### Requirement: Staged Progress and Result Actions

The dialog SHALL show workflow progress by stages and expose actionable result operations.

#### Scenario: Stage progress mapping

- **WHEN** workflow starts
- **THEN** UI SHALL render stages `precheck/push/create/comment`
- **AND** each stage SHALL reflect backend status (`pending/running/success/failed/skipped`)

#### Scenario: Actionable result state

- **WHEN** workflow completes
- **THEN** success or existing PR state SHALL offer `open/copy PR link`
- **AND** failure state SHALL expose next-action hint and retry command copy when available
