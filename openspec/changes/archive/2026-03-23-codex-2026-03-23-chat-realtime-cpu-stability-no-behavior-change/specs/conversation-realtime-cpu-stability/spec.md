## ADDED Requirements

### Requirement: Lossless Realtime Event Micro-Batching

The client MUST support lossless micro-batching for high-frequency realtime conversation events to reduce dispatch/render amplification while preserving event semantics.

#### Scenario: preserve per-thread event ordering during batching
- **WHEN** high-frequency `delta` events are enqueued for the same thread
- **THEN** batched dispatch MUST preserve original relative event order
- **AND** downstream reducers MUST observe the same logical sequence as non-batched mode

#### Scenario: no event loss under burst traffic
- **WHEN** burst realtime events exceed a single frame capacity
- **THEN** the batching queue MUST flush in bounded chunks without dropping events
- **AND** every accepted event MUST be consumed exactly once by state reducers

### Requirement: Reducer No-Op Reference Stability

Thread state reducers MUST return stable references for semantically unchanged updates.

#### Scenario: unchanged update returns original state references
- **WHEN** a realtime update does not change thread-visible state
- **THEN** reducer MUST return the existing state object reference
- **AND** dependent selectors/components MUST NOT be invalidated by reference churn

#### Scenario: changed update still propagates correctly
- **WHEN** a realtime update changes thread-visible state
- **THEN** reducer MUST produce updated references for affected branches
- **AND** unchanged branches MUST retain prior references

### Requirement: Incremental Thread-Scoped Derivation

Derived conversation data MUST be recomputed incrementally by affected thread scope instead of global full replay.

#### Scenario: only affected threads are recomputed
- **WHEN** realtime updates touch a subset of threads
- **THEN** the derivation pipeline MUST recompute only affected threads
- **AND** unrelated thread-derived results MUST be reused

#### Scenario: derivation cache invalidates by thread revision
- **WHEN** an affected thread receives a new logical revision
- **THEN** the corresponding cached derivation MUST be invalidated
- **AND** stale derived results MUST NOT be served

### Requirement: Message Rendering Compute Deduplication

Message rendering MUST avoid repeated parse/transform work for unchanged item revisions.

#### Scenario: unchanged revision reuses parsed payload
- **WHEN** the renderer receives an item with unchanged revision
- **THEN** expensive parse/transform results MUST be reused
- **AND** the render path MUST NOT repeat the same computation in that frame

#### Scenario: revision change recomputes once
- **WHEN** item revision changes due to new realtime deltas
- **THEN** parse/transform MUST be recomputed once per revision
- **AND** all render consumers MUST reuse that computed result

### Requirement: Session Activity and Radar Incremental Refresh

Session activity and radar feeds MUST refresh incrementally from changed thread identities.

#### Scenario: unrelated thread updates do not trigger global rebuild
- **WHEN** a realtime update affects one thread
- **THEN** activity/radar recomputation MUST remain scoped to the changed thread set
- **AND** unrelated workspace-thread rows MUST NOT be globally rebuilt

#### Scenario: status transition updates existing identity
- **WHEN** a session event transitions from running to completed or failed
- **THEN** the feed MUST update the existing session identity entry
- **AND** the feed MUST NOT insert duplicate rows for the same workspace-thread identity

### Requirement: Performance Guardrail and Safe Rollback

Realtime CPU optimizations MUST provide observability and safe rollback controls.

#### Scenario: optimization metrics are emitted for regression comparison
- **WHEN** realtime optimization paths are active
- **THEN** the system MUST emit metrics for batching, reducer no-op hit rate, and derivation cost
- **AND** these metrics MUST support baseline vs optimized comparison

#### Scenario: layered rollback restores baseline behavior
- **WHEN** optimization regression is detected
- **THEN** operators MUST be able to disable batching/derivation/no-op guards independently
- **AND** the client MUST continue processing realtime events with baseline-compatible semantics
