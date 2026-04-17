# independent-file-explorer-workspace Specification Delta

## ADDED Requirements

### Requirement: Detached file viewer SHALL inherit the shared rendering contract

The detached file explorer window MUST render opened files through the same shared rendering contract used by the main window file view so that preview kind, edit capability, and fallback semantics stay aligned across both surfaces.

#### Scenario: detached window uses the same rendering kind as the main file view
- **WHEN** the same workspace file is opened in the detached explorer and in the main window file view
- **THEN** the detached file content area MUST resolve the same rendering kind as the main file view
- **AND** it MUST NOT rely on a detached-only file-type decision table

#### Scenario: detached window preserves fallback parity for unsupported files
- **WHEN** the user opens an unsupported or partially supported file in the detached explorer
- **THEN** the detached window MUST show the same fallback class of result as the main file view
- **AND** it MUST NOT fail into a blank or misleading view while the main surface falls back safely

### Requirement: Detached file viewer SHALL keep renderer state aligned during session transitions

The detached file explorer window MUST keep renderer state aligned with its own active tab, active file, and restore lifecycle so that switching files or restoring the window does not leak stale render state.

#### Scenario: detached tab switches do not leak previous renderer state
- **WHEN** the user switches between detached tabs whose files use different rendering kinds
- **THEN** the detached viewer MUST rebind renderer state to the newly active file
- **AND** stale preview content, stale controls, or stale syntax markers from the previous tab MUST NOT remain visible

#### Scenario: detached session restore rehydrates a valid renderer state
- **WHEN** the detached file explorer window restores a saved session or receives a refreshed detached session payload
- **THEN** the reopened active file MUST render through a valid renderer state for that file
- **AND** the detached viewer MUST NOT require the user to reopen the file manually to recover from restore
