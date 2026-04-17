# opencode-engine Specification Delta

## ADDED Requirements

### Requirement: OpenCode Provider Connection Must Be CLI-First

OpenCode provider connection flow MUST remove UI preselection and defer provider selection to CLI.

#### Scenario: connect button without provider dropdown

- **GIVEN** user opens OpenCode provider panel
- **WHEN** viewing connect section
- **THEN** system MUST NOT render provider selection dropdown
- **AND** `连接 Provider` action MUST launch CLI-native provider selection/auth flow.

#### Scenario: connect action sends no provider preselection

- **GIVEN** user clicks `连接 Provider` in OpenCode panel
- **WHEN** frontend dispatches connect request
- **THEN** request MUST NOT include any preselected provider id/name hint
- **AND** provider choice MUST be decided inside CLI flow by user interaction.

### Requirement: OpenCode Completed Authentication Summary Must Be Expanded By Default

OpenCode completed-auth section MUST be expanded by default and provide improved visual hierarchy.

#### Scenario: default expanded completed auth summary

- **GIVEN** user opens OpenCode provider panel
- **WHEN** panel renders authentication summary
- **THEN** `已完成认证` section MUST be expanded by default
- **AND** summary MUST render iconized groups and keyword color emphasis for key statuses.

### Requirement: OpenCode Agent/Model/Variant Header Must Be Icon-Only

OpenCode agent/model/variant selector headers MUST use icons without text labels while preserving accessibility.

#### Scenario: icon-only selector headers

- **GIVEN** user opens OpenCode provider panel selector row
- **WHEN** agent/model/variant blocks render
- **THEN** each block header MUST display icon-only label
- **AND** each header MUST keep semantic meaning via `aria-label` or tooltip.

### Requirement: OpenCode Provider Status Must Follow Model Selection With Process Hint

OpenCode current provider status text MUST update with model selection and expose intermediate process hints.

#### Scenario: model switch updates provider status progressively

- **GIVEN** user switches model in OpenCode panel
- **WHEN** provider compatibility/state recomputation starts
- **THEN** status text MUST show intermediate hint (e.g. switching/checking)
- **AND** final text MUST update to the selected model's resolved provider and connection state.

### Requirement: OpenCode Credential Check Must Auto-Run On Panel Open

OpenCode provider credential check MUST run automatically on panel open and manual check button must be removed.

#### Scenario: auto credential check on open

- **GIVEN** user opens OpenCode provider panel
- **WHEN** panel becomes visible
- **THEN** system MUST auto-trigger credential check
- **AND** system MUST refresh auth/provider summary after check
- **AND** UI MUST NOT render manual `检查凭据` button.
