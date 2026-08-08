## ADDED Requirements

### Requirement: Composer MUST Provide An Explicit One-Shot Squad Entry
The Shared Session Composer MUST provide a `Squad` control immediately adjacent to send and MUST consume the armed mode for one send only.

#### Scenario: user arms squad for next send
- **WHEN** the user activates the Squad control in a Shared Session
- **THEN** the control exposes selected state and the next submitted message requests Squad planning with the current complete execution target

#### Scenario: mode resets after consumption
- **WHEN** the Squad request is accepted for submission
- **THEN** the Composer returns to ordinary send mode for later messages

#### Scenario: native conversation hides entry
- **WHEN** the active conversation is a native CLI session
- **THEN** the Squad entry is not exposed and ordinary Composer behavior remains unchanged

#### Scenario: failed submission preserves intent
- **WHEN** the request fails before durable run creation
- **THEN** draft text and attachments remain available and the user can explicitly retry Squad mode

### Requirement: Plan MUST Be Confirmed Inside The Conversation
The Conversation MUST render a `SquadPlanCard` for the latest proposed revision and MUST prohibit Worker execution until the user confirms a valid plan once.

#### Scenario: plan card shows approval envelope
- **WHEN** a valid plan proposal is projected
- **THEN** the card shows objective, node sequence/dependencies, automatic target assignments, permissions, verification policy, and budgets

#### Scenario: user edits before confirmation
- **WHEN** the user changes an allowed budget within policy while target, permissions, and DAG remain sealed by V1
- **THEN** the UI submits a revision and waits for the validated projection before enabling confirmation

#### Scenario: user confirms once
- **WHEN** the user confirms the latest valid revision
- **THEN** the UI submits one idempotent approval action, disables plan editing, and automatically opens the Squad overview inspector

### Requirement: Running Squad MUST Remain Visible As A Nested Conversation Card
The Conversation MUST render one `SquadRunCard` for the run with durable status, progress, budget, inspector entry, and Emergency Stop when applicable.

#### Scenario: progress updates card
- **WHEN** node outcomes change the session-scoped projection
- **THEN** the existing card updates counts and phase without adding duplicate timeline rows

#### Scenario: inspector was closed
- **WHEN** the user activates Open Inspector from the run card
- **THEN** the right-side Squad inspector reopens to the last valid overview or node selection

#### Scenario: terminal run remains inspectable
- **WHEN** a run succeeds, fails, blocks, or is cancelled
- **THEN** the card remains a structured historical reference and exposes outcomes and diagnostics read-only

### Requirement: Squad Inspector MUST Reuse The Conversation Split Interaction Shape
Desktop Squad detail MUST use a full-height resizable right inspector without remounting the Conversation, and mobile MUST use an accessible overlay.

#### Scenario: desktop inspector opens
- **WHEN** a desktop user approves a plan or opens the run inspector
- **THEN** the Conversation remains mounted on the left and a resizable full-height inspector appears on the right

#### Scenario: split width persists safely
- **WHEN** the user resizes and later reopens the Squad inspector
- **THEN** the generic Conversation inspector ratio is restored after type validation and clamping

#### Scenario: mobile inspector opens
- **WHEN** the viewport uses the mobile breakpoint
- **THEN** inspector content appears as an overlay with focus containment and restore rather than compressing the Conversation below usable width

### Requirement: Inspector MUST Present Projection-Owned Overview And Node Detail
The inspector MUST consume mapped `SquadProjectionV1` data and MUST NOT infer scheduler, terminal, permission, or recovery state from transcript prose.

#### Scenario: overview lists DAG state
- **WHEN** a run contains pending, running, succeeded, failed, or blocked nodes
- **THEN** overview displays each node with status, target, dependency relation, attempts, verification, and budget derived from projection

#### Scenario: node detail opens
- **WHEN** the user selects a node
- **THEN** detail shows goal, immutable target, Context Package manifest, attempt timeline, typed outcome, evidence, artifacts, and diagnostics

#### Scenario: prose conflicts with projection
- **WHEN** transcript text says a node completed but projection says running
- **THEN** the UI retains running as authoritative and may show the prose only as raw transcript evidence

### Requirement: Emergency Stop MUST Stay Reachable Without Implying Rollback
The running inspector and run card MUST expose Emergency Stop, MUST explain that it stops new dispatch and attempts exact-owner interruption, and MUST NOT claim automatic rollback.

#### Scenario: user confirms stop
- **WHEN** the user activates Stop and confirms the application-owned dialog
- **THEN** the UI submits one cancel intent and renders Cancelling from canonical projection

#### Scenario: stop fails to interrupt a worker
- **WHEN** an exact owner cannot be interrupted or remains ambiguous
- **THEN** the inspector shows scoped blocked diagnostics and does not report workspace rollback or successful cancellation prematurely

### Requirement: Squad UI MUST Preserve Composer And Streaming Performance Boundaries
Squad progress MUST use a session-scoped external snapshot with idempotent updates and MUST NOT place per-event arrays or high-frequency state in the AppShell root, Messages timeline, or Composer input owner.

#### Scenario: burst node updates while typing
- **WHEN** several durable Squad facts arrive while the user types or uses IME
- **THEN** draft text, selection, composition, attachments, and send behavior remain urgent and unchanged

#### Scenario: semantic snapshot is unchanged
- **WHEN** a projection refresh produces the same selected run and node values
- **THEN** the external store preserves snapshot identity and subscribers do not rerender for reference-only changes

#### Scenario: active session changes
- **WHEN** the user switches from Shared Session A to B
- **THEN** the Squad card/inspector consumes only B-scoped projection and never displays A node state

### Requirement: Squad Controls MUST Be Accessible And Localized
All Squad controls, statuses, dialogs, tooltips, and diagnostics MUST use localization keys and accessible interaction semantics.

#### Scenario: keyboard operation
- **WHEN** a keyboard user navigates Squad entry, plan actions, node rows, separator, close, and Stop
- **THEN** each action is reachable with visible focus and exposes a meaningful accessible name

#### Scenario: inspector focus lifecycle
- **WHEN** approval auto-opens the inspector and the user later closes it
- **THEN** focus first reaches the inspector heading and then returns to the run-card trigger on close

#### Scenario: reduced motion
- **WHEN** the operating system requests reduced motion
- **THEN** inspector and status transitions avoid non-essential movement while preserving state feedback

### Requirement: Passive Squad Hydration MUST Be Isolated From Non-Squad Conversations
The conversation host MUST treat Squad recovery as a Shared-Squad-only side effect, MUST require canonical Squad evidence before issuing any passive Squad command, and MUST preserve an atomic `workspaceId + threadId` owner scope across navigation. Canonical evidence MUST come from an already-loaded `SharedProjectionItem` whose `fidelity`, item identity, `turnId`, and `squadRunId` agree; transcript prose, Shared identity alone, and inspector visibility MUST NOT establish Squad ownership.

#### Scenario: Native Session becomes active
- **WHEN** the active Conversation uses a Native thread id
- **THEN** the client performs no Squad command, publishes no Squad projection, starts no recovery executor, and emits no Squad notification

#### Scenario: Shared Session has no known Squad
- **WHEN** a Shared Session has no cached Squad projection and its loaded canonical history contains no valid Squad evidence
- **THEN** the client performs no `shared_squad_get`, publishes no Squad state, starts no recovery executor, emits no Squad notification, and ordinary Shared behavior remains unchanged

#### Scenario: canonical Shared history proves Squad ownership
- **WHEN** the already-required Shared history projection contains a canonical Squad item whose item id, `turnId`, and `squadRunId` identify the same run
- **THEN** the client registers that exact `workspaceId + threadId + runId` as Squad evidence without an additional discovery command and MAY hydrate the durable run once

#### Scenario: repeated navigation across ordinary Shared Sessions
- **WHEN** the user repeatedly opens any number of Shared Sessions without canonical Squad evidence
- **THEN** the number of passive Squad commands, Squad recovery attempts, and Squad notifications remains zero

#### Scenario: known Squad Session is rendered repeatedly
- **WHEN** StrictMode, rerender, or rapid A-to-B-to-A navigation exposes the same evidenced Squad scope multiple times
- **THEN** at most one passive hydration is claimed for that evidence revision and concurrent callers share one in-flight request

#### Scenario: Squad feature is disabled
- **WHEN** `squadOrchestrationV1` is disabled while a Shared Session becomes active
- **THEN** passive hydration performs no Squad command even if historical canonical Squad evidence exists

#### Scenario: transcript resembles Squad metadata
- **WHEN** ordinary message prose or a `presentation-only` projection item contains Squad-like text or fields
- **THEN** the client does not register Squad evidence and performs no passive Squad command

#### Scenario: workspace navigation exposes mixed render generations
- **WHEN** a new layout workspace prop renders before the active Canvas publishes its matching thread snapshot
- **THEN** Squad hydration uses the Canvas-owned atomic workspace/thread pair and never probes the old thread under the new workspace owner

#### Scenario: stale hydration rejects after scope change
- **WHEN** a previous scope's passive hydration rejects after another Conversation becomes active
- **THEN** the stale failure emits no Toast, remains observable only through scoped diagnostics, and cannot alter the active Conversation's Squad state
