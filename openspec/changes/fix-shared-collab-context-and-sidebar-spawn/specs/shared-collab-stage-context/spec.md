## ADDED Requirements

### Requirement: Stage settlement MUST persist portable body for Runtime Context

When a Shared multi-agent / collab stage records `squad.nodeOutcomeRecorded`, the outcome payload MUST include:

- `status` (succeeded|failed)
- `summary` (short chip text)
- `body` (capped full stage assistant text or plan markdown; hard cap = stage outcome body budget)

UI-only short fields MUST NOT be the sole durable evidence of stage work.

#### Scenario: successful implement stage stores body

- **WHEN** an implement stage completes successfully with non-empty assistant text
- **THEN** the recorded outcome MUST contain `body` whose content includes the stage result up to the configured body cap
- **AND** `summary` MUST remain a short projection for chips

#### Scenario: plan gate stores plan body

- **WHEN** a plan stage that requires approval settles with a plan draft
- **THEN** outcome `body` MUST prefer plan markdown (or raw assistant text) capped
- **AND** outcome `summary` MAY be the short plan summary

#### Scenario: failed stage still stores diagnostic body

- **WHEN** a stage fails with non-empty assistant text
- **THEN** outcome MUST still include capped `body` or non-empty `summary` so later ordinary turns can see partial failure context

### Requirement: Ordinary Shared turns MUST receive collab stage digests when present

After one or more collab stages have recorded outcomes in a Shared session, a subsequent ordinary (non-stage-worker) turn's Context Package MUST include those stage digests so the destination model can answer about prior collab work.

#### Scenario: post-collab ordinary turn sees completed stages

- **WHEN** stages plan and implement have succeeded and the user sends a new ordinary message on the same Shared session
- **THEN** `prepare_delivery` / compile result MUST include portable text for those stages' body or summary
- **AND** the package MUST NOT rely solely on human-visible canvas items

#### Scenario: cancelled run keeps partial digests

- **WHEN** a collab run is cancelled after some stages succeeded and others were skipped
- **THEN** ordinary turn context MUST include succeeded stage digests
- **AND** MUST NOT invent content for skipped stages

#### Scenario: sessions without collab outcomes unchanged

- **WHEN** a Shared session has no `squad.nodeOutcomeRecorded` facts
- **THEN** context compilation MUST follow existing non-collab behavior
