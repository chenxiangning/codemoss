## RENAMED Requirements

- FROM: `### Requirement: Shared Execution Target MUST Support Five Provider-scoped CLIs`
- TO: `### Requirement: Shared Execution Target MUST Support Six Provider-scoped CLIs`

## MODIFIED Requirements

### Requirement: Shared Execution Target MUST Support Six Provider-scoped CLIs

Shared `ExecutionTarget`、Binding Key、mutable selection、frozen snapshot and owner routing MUST
support Claude Code、Codex CLI、Kimi CLI、Grok CLI、OpenCode CLI and PI CLI with the same
Provider provenance contract.

#### Scenario: newly supported CLI target survives reload

- **WHEN** a user selects a resolved Kimi、Grok、OpenCode or Pi Target and reloads the Shared Session
- **THEN** the complete Engine、Provider、Model and Reasoning selection MUST be restored
- **AND** no field MAY be rewritten from global Engine or Model state

#### Scenario: same CLI with two Providers owns two bindings

- **WHEN** Shared turns target two managed Providers under Kimi、Grok or OpenCode
- **THEN** the system MUST persist two distinct `engine + providerProfileId` bindings
- **AND** switching back MUST reuse the original binding

#### Scenario: local profile freezes canonical local provenance

- **WHEN** a Kimi、Grok、OpenCode or Pi local Profile is selected
- **THEN** mutable selection MUST use `providerProfileId=null + providerProfileSource=disk`
- **AND** the frozen canonical snapshot MUST use `providerProfileSource=local`

#### Scenario: local target is revalidated across Shared boundaries

- **WHEN** Kimi、Grok、OpenCode or Pi local Target is used to create a Shared Session or begin a V2 turn
- **THEN** both boundaries MUST resolve a non-empty local Model catalog for the selected CLI
- **AND** the same strict catalog pair validation MUST run before durable state changes
