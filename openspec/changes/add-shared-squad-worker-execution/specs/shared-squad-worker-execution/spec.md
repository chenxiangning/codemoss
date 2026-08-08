## ADDED Requirements

### Requirement: Every Node Attempt MUST Have An Exact Durable Worker Owner
The system MUST assign each dispatched node attempt a unique scoped Worker Binding and immutable execution target before touching a CLI runtime.

#### Scenario: same target runs two analysis workers
- **WHEN** two ready Analyze nodes select the same Engine and Provider
- **THEN** each node receives a distinct `workerBindingKey` and `attemptId` while retaining the same target binding identity

#### Scenario: worker owner is linked before send
- **WHEN** a Worker runtime is about to receive a Context Package
- **THEN** `SquadNodeDispatchPrepared` and durable attempt linkage exist before the runtime side effect

#### Scenario: conflicting runtime owner fails closed
- **WHEN** a runtime observation carries an Engine, Provider, binding, or attempt identity that conflicts with the durable owner
- **THEN** the system rejects Squad attribution and does not settle or reroute the node

### Requirement: Scheduler MUST Execute A Dynamic DAG Without Polling
The system MUST derive ready nodes from canonical projection at plan approval and terminal transition boundaries and MUST NOT depend on periodic polling for normal progress.

#### Scenario: independent analysis nodes dispatch in parallel
- **WHEN** multiple read-only nodes are ready and within concurrency and budget limits
- **THEN** the scheduler may prepare all of them without waiting for an unrelated node to complete

#### Scenario: dependency gates a node
- **WHEN** a node has a dependency that is not successfully terminal
- **THEN** the scheduler keeps the node pending and performs no runtime side effect for it

#### Scenario: terminal event unlocks successor
- **WHEN** the authoritative runtime owner settles the final dependency successfully
- **THEN** the scheduler reevaluates the ready set from the new projection and may dispatch the successor

### Requirement: V1 MUST Enforce Parallel Analysis And Single Writer
The system MUST permit parallel read-only Analyze and Verify execution but MUST require exclusive workspace mutation authority for every Mutate attempt.

#### Scenario: analyze proceeds while mutation lease is busy
- **WHEN** a ready Analyze node is within budget while another run holds the workspace mutation lease
- **THEN** the Analyze node may proceed because it has no mutation authority

#### Scenario: second mutate waits
- **WHEN** a Mutate node is ready but the normalized workspace lease is held by another attempt
- **THEN** the scheduler leaves the node ready or blocked and does not dispatch it

#### Scenario: verifier cannot write
- **WHEN** a Verify Worker requests a mutation-capable permission or command policy
- **THEN** the dispatch boundary fails closed before the command runs

### Requirement: Context Package MUST Be Node-Scoped And Auditable
The system MUST compile each Worker Context Package from the node goal, sealed constraints, immutable target, direct dependency outcomes, selected canonical evidence, and relevant change-fence summary only.

#### Scenario: unrelated transcript is omitted
- **WHEN** a node does not depend on an earlier branch and its evidence is not selected
- **THEN** the package omits that branch content and records omission/retrievability in its manifest

#### Scenario: dependency outcome is stable
- **WHEN** the same canonical source range, plan revision, constraints, and dependency outcomes are compiled twice
- **THEN** package identity and checksum are identical

#### Scenario: hidden native history is not a source
- **WHEN** a Worker Binding already has native CLI history
- **THEN** the compiler does not merge that history into canonical Squad context unless represented by approved canonical evidence

### Requirement: Typed Outcome MUST Be The Only Node Settlement Payload
The system MUST validate a versioned `TypedOutcomeEnvelope` before using Worker output to settle a node or change scheduler state.

#### Scenario: valid analyze outcome settles node
- **WHEN** Worker output normalizes to a valid Analyze outcome with evidence and budget usage
- **THEN** the system records the typed outcome and marks the exact node attempt succeeded

#### Scenario: valid JSON has wrong node schema
- **WHEN** Worker output parses as JSON but violates the validator for its node kind
- **THEN** the system classifies schema mismatch, performs at most one bounded repair, and otherwise records visible failure

#### Scenario: claimed changed paths disagree with observation
- **WHEN** a Mutate outcome lists paths that do not match the observed Change Fence delta
- **THEN** the system blocks the branch and does not trust the claimed path list as authority

### Requirement: Attempt Retry MUST Be Bounded And Side-Effect Aware
The system MUST allocate a new attempt identity for every retry and MUST retry only when sealed budgets and durable side-effect evidence make replay safe.

#### Scenario: transport fails before acceptance
- **WHEN** an attempt has durable dispatch intent but exact evidence proves the prompt was not accepted
- **THEN** the scheduler may create one new bounded attempt according to policy

#### Scenario: prompt acceptance is ambiguous
- **WHEN** runtime acceptance or mutation side effect cannot be proven absent or terminal
- **THEN** the node enters blocked recovery-required state and is not automatically replayed

#### Scenario: retry budget is exhausted
- **WHEN** a failed node has no remaining sealed attempts or token/time budget
- **THEN** the scheduler records terminal failure or blocked state without expanding the budget

### Requirement: Verification Failure MUST Return To A Bounded Repair Path
The system MUST treat verification as read-only evidence and MUST route a failed verification back to a bounded Mutate repair attempt when the sealed plan permits it.

#### Scenario: verification succeeds
- **WHEN** all required checks return successful typed results
- **THEN** the Verify node succeeds and dependent synthesis becomes eligible

#### Scenario: verification proposes repair
- **WHEN** a Verify node reports actionable failure within the approved workspace and budget
- **THEN** the scheduler creates or reopens the declared repair branch and reruns verification after mutation settles

#### Scenario: repair requires new authority
- **WHEN** proposed repair requires an unapproved target, outside-workspace path, remote write, or budget expansion
- **THEN** the branch blocks without silently widening authority

### Requirement: Final Synthesis MUST Produce One Top-Level Result
The system MUST dispatch final synthesis only after every required dependency is successfully terminal, MUST keep the Synthesize Worker turn nested, and MUST publish at most one top-level Shared answer from successful run settlement.

#### Scenario: all required nodes succeed
- **WHEN** the final Synthesize node returns a valid outcome
- **THEN** the system settles the run succeeded and `SquadRunSettled` projects one top-level answer linked to the run

#### Scenario: synthesis fails
- **WHEN** synthesis output remains invalid or its runtime attempt fails terminally
- **THEN** the run is failed or blocked and the system does not fabricate a successful assistant answer

#### Scenario: duplicate terminal observation
- **WHEN** equivalent synthesis terminal evidence is observed more than once
- **THEN** canonical commit and top-level Conversation projection occur exactly once
