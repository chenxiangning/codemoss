## ADDED Requirements

### Requirement: Squad Worker Binding Scope MUST Not Change Immutable Target Semantics
The system MUST separate a Squad Worker owner scope from the base `engine + providerProfileId` target binding and MUST preserve immutable Model and Reasoning attribution for each attempt.

#### Scenario: scoped binding retains target
- **WHEN** a node receives `workerBindingKey=squad:{runId}:{nodeId}:{baseBindingKey}` for a managed Provider target
- **THEN** its `TurnExecutionSnapshot` retains the approved Engine, Provider Profile, Model catalog/runtime identities, and Reasoning without deriving them from the scoped key

#### Scenario: picker changes during run
- **WHEN** the user changes the Shared Session next-turn Picker after plan approval
- **THEN** active Worker targets and attribution remain unchanged

#### Scenario: provider becomes unavailable
- **WHEN** an approved managed Provider is deleted before a pending node dispatches
- **THEN** dispatch fails visibly for that node and does not fall back to local/disk or another Provider

#### Scenario: mutation target is not Codex
- **WHEN** the exact sealed target uses another ordinary CLI and the plan contains a Mutate node
- **THEN** V1 rejects approval because that adapter does not expose the required hard current-workspace write sandbox

#### Scenario: target lacks hard read-only mode
- **WHEN** the exact sealed target is Kimi, Grok, OpenCode, or another adapter without verified hard read-only execution
- **THEN** V1 rejects Squad admission before Lead dispatch instead of relying on prompt-only compliance

#### Scenario: unsupported target is selected before Squad entry
- **WHEN** a Shared Session selects Kimi, Grok, OpenCode, or another adapter without verified hard read-only execution
- **THEN** the Squad entry is visibly unavailable with a localized reason while ordinary Shared message sending remains enabled

#### Scenario: target becomes unsupported while Squad is armed
- **WHEN** the user changes the selected target from a supported adapter to an unsupported adapter before sending
- **THEN** the client disarms the one-shot Squad intent and does not attach `squadRequest` to the ordinary message
