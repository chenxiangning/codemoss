## MODIFIED Requirements

### Requirement: Live assistant text MAY bypass root reducer while preserving final transcript convergence

During an active streaming turn, the message surface MUST support visible assistant body growth through a transient live-text channel instead of requiring every text delta to mutate the root conversation item array.

#### Scenario: live text grows when item identity remains stable

- **WHEN** an assistant message is streaming
- **AND** new body text arrives through the live assistant text channel
- **AND** the durable conversation item array identity does not change for that delta
- **THEN** the visible assistant row MUST still be able to show the new text
- **AND** the message surface MUST NOT depend solely on parent array identity or `scrollKey` changes as proof of live text growth

#### Scenario: completion converges to durable transcript state

- **WHEN** a streaming assistant message completes after using transient live text
- **THEN** the durable reducer/history settlement path MUST converge to the final assistant body
- **AND** the final transcript MUST NOT depend on the transient live channel remaining populated

#### Scenario: live text is scoped to the current assistant item

- **WHEN** multiple threads or assistant items are active or restored
- **THEN** live text channel subscriptions MUST be scoped by thread/item identity
- **AND** text published for one assistant item MUST NOT appear in another thread or item

#### Scenario: AskUserQuestion gate settlement converges pre-gate live text

- **WHEN** an assistant message streams body text
- **AND** an `AskUserQuestion` gate fires mid-turn before that text reached the durable reducer
- **THEN** the gate-settlement transition MUST drain the live-text channel for that thread before marking the thread not-processing
- **AND** the pre-gate text MUST remain visible in the message surface after the gate settles
- **AND** this MUST hold regardless of whether the gate arrives through the native `onRequestUserInput` path or the `onModeBlocked` `requestUserInputBlocked` path
