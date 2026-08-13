## RENAMED Requirements

- FROM: `### Requirement: Shared And Home Atomic Pickers MUST Enable Five CLIs`
- TO: `### Requirement: Shared And Home Atomic Pickers MUST Enable Six CLIs`

## MODIFIED Requirements

### Requirement: Shared And Home Atomic Pickers MUST Enable Six CLIs

Shared Session and New Home Atomic target pickers MUST expose Claude Code、Codex CLI、
Kimi CLI、Grok CLI、OpenCode CLI and PI CLI as enabled creation/execution targets. Native
Session selector behavior MUST remain unchanged.

#### Scenario: Shared picker lists six enabled CLI rows

- **WHEN** a user opens the Shared Session target picker
- **THEN** Claude、Codex、Kimi、Grok、OpenCode and Pi rows MUST be enabled
- **AND** selecting any row MUST display that CLI's Provider Profiles in the right panel

#### Scenario: Home picker creates a newly supported target

- **WHEN** a user selects a Kimi、Grok、OpenCode or Pi Provider Model from New Home
- **THEN** Home MUST create one complete create-session target
- **AND** the new Native Session and first Turn MUST use that Engine、Provider and runtime Model

#### Scenario: uninstalled Pi row stays disabled in both pickers

- **WHEN** PI CLI is not installed
- **THEN** the Shared and Home pickers MUST keep the Pi row unavailable with a readable reason
- **AND** no create-session target or Runtime side effect MAY be produced from it

#### Scenario: Native session remains unchanged

- **WHEN** a user opens an existing Kimi、Grok、OpenCode or Pi Native Session selector
- **THEN** the selector MUST preserve its existing Native behavior
- **AND** this Shared integration MUST NOT add cross-CLI mutation to the Native Session
