## MODIFIED Requirements

### Requirement: Shared Session Uses Explicit Manual Engine Selection

Within a `shared session`, the system MUST let the user explicitly choose the execution target
before sending a turn. The selector MUST be a four-level target picker
(CLI → Provider → Model → Reasoning); the engine-only selector is superseded. Provider and
model items MUST preserve Provider Profile scope instead of inferring the target from model id
alone. The picker MUST be locked whenever the shared session composer is in any non-idle state.
Claude Code、Codex CLI、Kimi CLI、Grok CLI、OpenCode CLI 与 PI CLI MUST be selectable Shared
targets；registered engines outside this set MUST remain unavailable.

#### Scenario: shared composer exposes six supported CLIs

- **WHEN** the user focuses the composer inside a `shared session`
- **THEN** the four-level picker MUST enable Claude Code、Codex CLI、Kimi CLI、Grok CLI、
  OpenCode CLI and PI CLI
- **AND** each enabled CLI MUST expose its Provider-scoped Model catalog

#### Scenario: provider profile scopes its model catalog

- **WHEN** the user opens a Provider Profile inside the shared target picker
- **THEN** the system MUST show models resolved for that exact Engine and Provider Profile
- **AND** selecting a model MUST atomically preserve the Engine, Provider Profile, and Model identity
- **AND** an equal model id in another Provider Profile MUST NOT change or satisfy the selection

#### Scenario: unavailable engine remains explainable

- **WHEN** a registered CLI is not included in the supported Shared target set
- **THEN** the picker MUST keep the CLI unavailable
- **AND** MUST expose a human-readable reason rather than route through it

#### Scenario: picker update is metadata-only before send

- **WHEN** the user changes the shared-session target picker but does not submit a message yet
- **THEN** the system MUST update only the selected next target state for that shared session
- **AND** the system MUST NOT dispatch a turn, create a binding, or start an extra user-visible native conversation solely due to picker change

#### Scenario: submitted turn uses the user-selected target

- **WHEN** the user submits a message from a `shared session`
- **THEN** the system MUST dispatch that turn to the full target currently selected by the user
- **AND** the dispatch result MUST remain attributable to that selected target snapshot

#### Scenario: picker locks outside idle state

- **WHEN** the shared session composer is in any state other than `idle`
- **THEN** the target picker MUST be locked against changes
- **AND** the system MUST NOT apply a new target selection to the in-flight turn

#### Scenario: unsupported engines stay unavailable in shared session

- **WHEN** the user focuses the composer inside a `shared session`
- **THEN** engines outside Claude、Codex、Kimi、Grok、OpenCode and Pi MUST remain unavailable
- **AND** the system MUST NOT route a shared-session turn through an unsupported engine

#### Scenario: uninstalled Pi fails closed with a readable reason

- **WHEN** PI CLI is selected as a Shared target but the runtime is not installed
- **THEN** the picker MUST surface a human-readable not-installed reason
- **AND** target selection、Binding materialization and Runtime side effect MUST remain zero
