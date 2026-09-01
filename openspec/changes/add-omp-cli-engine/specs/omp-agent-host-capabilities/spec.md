## ADDED Requirements

### Requirement: OMP Provider Profile And Auth MUST Be Scoped

OMP provider, model, auth and profile operations MUST be scoped to an explicit runtime profile and workspace grant; credentials MUST NOT be copied into conversation events or logs.

#### Scenario: Provider catalog is unavailable
- **WHEN** the bound OMP provider catalog cannot be resolved
- **THEN** the launch MUST fail closed or require explicit user selection
- **AND** MUST NOT silently switch provider

### Requirement: OMP Tools And External Integrations MUST Require Capability Grants

Tools, MCP, Browser, Computer, SSH, Search, Plugins and Extensions MUST expose explicit capability state and permission grants before execution.

#### Scenario: An ungranted external tool is requested
- **WHEN** an OMP task requests a tool without the required workspace or user grant
- **THEN** execution MUST be blocked with an explainable permission result
- **AND** secrets MUST remain redacted

### Requirement: OMP Jobs And Agents MUST Have Independent Ownership

Agents, delegated tasks, background jobs and join operations MUST have stable ids, explicit owner/session association, cancel behavior and terminal state independent from the foreground Conversation turn.

#### Scenario: Background job completes after foreground turn
- **WHEN** a background OMP job settles after its parent turn
- **THEN** the job result MUST update its own feature-local record
- **AND** MUST NOT settle or overwrite the foreground turn

### Requirement: OMP Administrative Capabilities MUST Use Feature-Local Projections

Memory, Advisor, Todo, Plan, Compact, Handoff, Security, Usage, Stats, Export, Share, Git, Worktree, Bench, Setup, Update and Diagnostics MUST have typed feature-local projections and audit boundaries.

#### Scenario: Security finding is produced
- **WHEN** OMP emits a security finding
- **THEN** the finding MUST be stored with source, severity and disposition metadata
- **AND** MUST NOT be rendered as assistant-authored conversation content

### Requirement: OMP Capability Rollout MUST Be Staged

OMP capabilities MUST be enabled in ordered L0-L5 phases, with each phase requiring passing tests, evidence and review before its feature flag is enabled.

#### Scenario: A phase review fails
- **WHEN** a phase has an unresolved correctness, security or isolation finding
- **THEN** its capability flag MUST remain disabled
- **AND** later phases MUST NOT depend on the unapproved capability
