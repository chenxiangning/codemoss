## RENAMED Requirements

- FROM: `### Requirement: Atomic Catalog MUST Load Kimi Grok And OpenCode Bindings`
- TO: `### Requirement: Atomic Catalog MUST Load Kimi Grok OpenCode And Pi Bindings`

## MODIFIED Requirements

### Requirement: Atomic Catalog MUST Load Kimi Grok OpenCode And Pi Bindings

Atomic Shared/Home Provider Target catalog MUST load Kimi、Grok、OpenCode and Pi local/managed
Profiles and Models using the same `engine + providerProfileId` scope used by Runtime dispatch.
Pi exposes only its local form (native `~/.pi` authority).

#### Scenario: profile loader returns all Shared CLIs

- **WHEN** Atomic catalog loads Provider Profiles
- **THEN** it MUST include Claude、Codex、Kimi、Grok、OpenCode and Pi groups
- **AND** canonical local sentinel rows MUST retain `source=disk`

#### Scenario: models remain binding scoped

- **WHEN** a Kimi、Grok or OpenCode managed Profile is expanded
- **THEN** `getEngineModels` MUST receive that exact Engine and Provider Profile
- **AND** Models from local config or another managed Profile MUST NOT leak into the row

#### Scenario: Pi local profile resolves native model discovery

- **WHEN** the Pi local group is expanded in the Atomic catalog
- **THEN** its Models MUST come from the Pi local model discovery authority
- **AND** the resolved entry MUST freeze `modelCatalogEntryId + runtime model` atomically

#### Scenario: one new CLI catalog failure is isolated

- **WHEN** one newly supported CLI Profile or Model request fails
- **THEN** its binding MUST expose a scoped error
- **AND** other CLI/Profile groups MUST remain usable

### Requirement: Shared Validation MUST Have Catalog Authority For Every Supported CLI

Shared create、selection persistence、V2 turn revalidation and projection availability MUST use
the same supported CLI matrix and MUST fail closed when the selected catalog authority is absent.

#### Scenario: canonical local target reaches Shared creation

- **WHEN** a resolved Kimi、Grok、OpenCode or Pi local Target reaches the Rust Shared boundary
- **THEN** backend MUST load that CLI's local validation catalog
- **AND** MUST validate `modelCatalogEntryId + runtime model` before creating or persisting the Session

#### Scenario: managed provider is missing

- **WHEN** a projection snapshot references a missing managed Provider under any supported CLI
- **THEN** `providerAvailable` MUST be `false`
- **AND** an absent catalog MUST NOT be interpreted as an available Provider
