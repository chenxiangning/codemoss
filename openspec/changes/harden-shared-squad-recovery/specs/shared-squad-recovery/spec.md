## ADDED Requirements

### Requirement: Workspace Mutation MUST Require A Durable Exclusive Lease
The system MUST allow at most one active Squad Mutate attempt for the same normalized workspace key and MUST allow independent workspaces to acquire leases concurrently.

#### Scenario: concurrent same-workspace acquire
- **WHEN** two Mutate attempts concurrently request the same free workspace lease
- **THEN** exactly one acquire transaction succeeds and the other performs no workspace side effect

#### Scenario: different workspaces acquire
- **WHEN** Mutate attempts target two different canonical workspace roots
- **THEN** both may acquire independent leases and execute concurrently

#### Scenario: read-only node does not consume lease
- **WHEN** an Analyze or Verify node executes
- **THEN** it does not acquire mutation authority and cannot block an unrelated Mutate lease solely by running

### Requirement: Current Workspace Authority MUST Fail Closed At Its Boundary
The system MUST limit automatic development authority to the sealed current workspace root and MUST reject path escape, credential access, remote writes, deploy, commit, and push without separate explicit authority.

#### Scenario: in-workspace edit
- **WHEN** an approved Mutate node edits a normalized path inside the current workspace within its permission ceiling
- **THEN** the operation is eligible while the exact attempt holds the mutation lease and Change Fence

#### Scenario: symlink escapes workspace
- **WHEN** a candidate path lexically appears inside the workspace but resolves through a symlink outside it
- **THEN** the operation fails closed before or upon observation and the branch blocks

#### Scenario: remote or credential operation
- **WHEN** a node requests credential material, remote write, deploy, git commit, or git push
- **THEN** automatic execution rejects the operation and does not reinterpret current-workspace maximum authority as permission

### Requirement: Dirty Workspace MUST Be Preserved Through A Change Fence
The system MUST permit an existing dirty workspace, MUST record a pre-mutation baseline, and MUST never automatically reset, stash, checkout, delete, or overwrite user-owned changes as recovery behavior.

#### Scenario: baseline contains dirty files
- **WHEN** a Mutate attempt starts in a workspace with modified or untracked files
- **THEN** the Change Fence records normalized paths and fingerprints and execution does not clean or hide them

#### Scenario: mutate touches baseline-dirty path
- **WHEN** the attempt changes a file that was already dirty
- **THEN** before/after fingerprints and observed delta are retained and the system does not claim the original user delta was authored by Squad

#### Scenario: rollback is requested implicitly by failure
- **WHEN** verification or a Worker fails after workspace changes
- **THEN** the system proposes forward repair or blocks and does not invoke destructive rollback commands

### Requirement: Observed Workspace Delta MUST Be Reconciled With Worker Outcome
The system MUST scan workspace state at Mutate boundaries and MUST reconcile observed paths with the typed outcome and sealed scope before releasing mutation authority.

#### Scenario: declared and observed paths agree
- **WHEN** a Mutate outcome lists exactly the in-scope observed changed paths and required fingerprints are recorded
- **THEN** the attempt may settle succeeded and release its lease

#### Scenario: unexpected path changes
- **WHEN** the after-scan contains an undeclared, outside-scope, or symlink-escaped path
- **THEN** the branch becomes blocked and no successor Mutate or Synthesize node is dispatched

#### Scenario: workspace scan cannot complete
- **WHEN** the system cannot establish a trustworthy after boundary
- **THEN** the attempt becomes ambiguous-side-effect and is not automatically replayed

### Requirement: Recovery MUST Use Canonical State And Exact Owner Evidence
On startup or runtime disconnect, the system MUST rebuild Squad state from canonical facts and MUST probe only exact durable owners before deciding reattach, settle, retry, or block.

#### Scenario: prepared but never accepted
- **WHEN** durable evidence proves dispatch was prepared but the exact runtime never accepted the attempt and no mutation lease side effect occurred
- **THEN** recovery may abandon it and create a bounded new attempt

#### Scenario: exact owner is still running
- **WHEN** the durable binding and attempt owner probe reports the same runtime work active
- **THEN** recovery reattaches observation without sending the prompt again

#### Scenario: mutation acceptance is ambiguous
- **WHEN** a Mutate attempt may have been accepted but exact terminal or after-fence evidence is missing
- **THEN** recovery keeps the branch blocked and performs no blind replay

#### Scenario: owner identity conflicts
- **WHEN** probe evidence conflicts on run, node, attempt, binding, Engine, Provider, or target snapshot
- **THEN** it remains diagnostic-only and cannot settle or interrupt the attempt

### Requirement: Emergency Stop MUST Be Durable And Exact-Owner Scoped
The system MUST persist cancel intent before acting, MUST prevent new dispatch after that intent, and MUST only attempt interruption for exact running owners.

#### Scenario: stop prevents ready dispatch
- **WHEN** cancel intent is durably appended while pending or ready nodes exist
- **THEN** the scheduler dispatches none of those nodes and projects them cancelled or blocked according to policy

#### Scenario: exact running owner is interruptible
- **WHEN** a running attempt has a verified interrupt-capable owner
- **THEN** the system requests interruption for that owner and records the result without implying filesystem rollback

#### Scenario: duplicate stop
- **WHEN** Stop is requested repeatedly or terminal evidence races with cancellation
- **THEN** cancellation and settlement remain idempotent and a succeeded terminal attempt is not rewritten by a late duplicate

### Requirement: Lease Recovery MUST Not Use Time-Based Expiry
The system MUST use lease epochs and canonical recovery evidence and MUST NOT release or reclaim a Mutate lease because wall-clock time elapsed.

#### Scenario: restart rebuilds an unaccepted owner
- **WHEN** startup rebuild finds a held lease whose exact attempt has no terminal release evidence
- **THEN** the lease remains held; V1 exposes recovery diagnostics rather than inferring safety from age

#### Scenario: accepted or ambiguous owner remains held
- **WHEN** a Mutate attempt was accepted or its side effect is unknown regardless of elapsed time
- **THEN** the lease remains blocked for explicit recovery and a second writer is not admitted

### Requirement: Feature Kill Switch MUST Preserve Evidence
The `squadOrchestrationV1` kill switch MUST prevent new admission and dispatch when disabled while retaining canonical history, projection, and explicit recovery state.

#### Scenario: flag disabled before new request
- **WHEN** a new Squad request arrives while the flag is disabled
- **THEN** the system rejects it before Lead or Worker runtime side effects

#### Scenario: flag disabled with historical runs
- **WHEN** the user reopens a session containing Squad facts while new admission is disabled
- **THEN** historical cards, outcomes, and diagnostics remain readable

#### Scenario: flag changes during active owner
- **WHEN** the switch is disabled while a Worker is running
- **THEN** the system stops new dispatch and follows explicit stop/recovery policy rather than silently killing or forgetting the owner
