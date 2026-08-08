## ADDED Requirements

### Requirement: Squad Worker Dispatch MUST Reuse Durable Shared Attempt Boundaries
The Worker execution path MUST commit node dispatch intent and exact owner linkage before runtime side effects, MUST treat runtime acceptance separately from completion, and MUST let authoritative runtime lifecycle settle the exact attempt.

#### Scenario: dispatch intent precedes worker send
- **WHEN** the scheduler selects a ready node
- **THEN** durable dispatch and owner linkage exist before Context Package delivery or CLI prompt submission

#### Scenario: frontend event is missing
- **WHEN** the runtime coordinator has durably settled the linked Worker attempt but frontend fan-out is lost
- **THEN** projection reload shows the terminal node and scheduler progress is not stranded

#### Scenario: runtime event lacks exact worker owner
- **WHEN** a terminal-like event cannot be tied to the durable node attempt
- **THEN** it remains diagnostic-only and cannot complete, retry, or cancel the node
