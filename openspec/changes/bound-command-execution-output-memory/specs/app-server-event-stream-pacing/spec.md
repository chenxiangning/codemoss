# app-server-event-stream-pacing Spec Delta

## MODIFIED Requirements

### Requirement: Backend Snapshot Throttle MUST Reduce Source-Side Snapshot Bursts

The backend emit path for `item/updated` text snapshots MUST apply a 32ms per-`(workspaceId, itemId, kind)` throttle. Snapshots for the same key arriving within 32ms of the previous emit MUST replace that key's pending snapshot with the latest complete snapshot and emit that latest snapshot on the next available window. Terminal events (`item/completed`, `turn/completed`, `turn/error`) MUST force flush all pending snapshots. The throttle MUST NOT concatenate complete snapshot strings; append-buffering is reserved for raw `outputDelta` events. Assembled `ConversationItem.output` byte budgets MUST be applied after event delivery and MUST NOT be implemented by dropping `item/commandExecution/outputDelta` or `item/fileChange/outputDelta`.

#### Scenario: critical events never throttled

- **WHEN** the backend evaluates whether to throttle
- **THEN** critical methods (`turn/completed`, `turn/error`, `runtime/ended`, `item/tool/requestUserInput`, `approval/request`) MUST NEVER be throttled
- **AND** `item/commandExecution/outputDelta` and `item/fileChange/outputDelta` MUST NEVER be throttled
- **AND** only `item/updated` text snapshots MUST be subject to throttling
- **AND** assembled `ConversationItem.output` byte budgets MUST be applied after delivery, never by dropping these delta events
