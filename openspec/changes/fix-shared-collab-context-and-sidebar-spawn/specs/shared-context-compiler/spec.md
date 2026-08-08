## MODIFIED Requirements

### Requirement: Compatibility Transformer MUST Preserve Semantic Closure

The transformer MUST process thinking, tool ids/results, images, aborted/error turns, provider-private metadata, historical controls, **and collab stage outcomes (`squad.nodeOutcomeRecorded`)** according to target capability.

#### Scenario: tool exchange is atomic

- **WHEN** a tool call and result cross the projection boundary
- **THEN** they MUST be included as a pair with consistently transformed ids or omitted as a pair
- **AND** an orphan call MUST NOT appear as a successful exchange

#### Scenario: private reasoning does not leak

- **WHEN** provider-private reasoning/signature is incompatible with the destination protocol
- **THEN** it MUST be omitted or replaced by a portable semantic block
- **AND** the Manifest MUST record the transformation

#### Scenario: unsupported image becomes artifact reference

- **WHEN** the source contains an image and the target does not support images
- **THEN** the package MUST contain a stable ArtifactRef or explicit not-retrievable omission
- **AND** it MUST NOT silently discard the image

#### Scenario: aborted assistant is not replayed as success

- **WHEN** an assistant block is aborted or failed
- **THEN** it MUST NOT be serialized as a successful assistant conclusion
- **AND** its outcome MUST remain auditable in the package or omission

#### Scenario: collab stage outcome becomes portable assistant text

- **WHEN** the source event log contains `squad.nodeOutcomeRecorded` with non-empty `body` or `summary`
- **THEN** the compiler MUST emit a portable assistant entry labeled as a collab stage (node id + status + body/summary)
- **AND** it MUST NOT drop the fact solely because the attempt is destination-owned or squad-worker-scoped

#### Scenario: collab control briefing user turns may be omitted

- **WHEN** a `conversation.turnRequested` user text contains collab control markers (`[[mossx.collab.briefing]]`, `[[mossx.collab.summary]]`, or `【协作调度`)
- **THEN** the compiler MAY omit that user turn from portable transcript and record an omission category for collab-control
- **AND** collab stage outcome entries MUST still be eligible for inclusion
