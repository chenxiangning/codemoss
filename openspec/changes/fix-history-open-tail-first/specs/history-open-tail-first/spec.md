## ADDED Requirements

### Requirement: History hydrate first paint MUST be the latest window

When hydrating a conversation whose item count exceeds the progressive batch size, the system MUST apply the newest batch first. The system MUST NOT first apply a prefix of the oldest items and grow toward the newest.

#### Scenario: Large history opens on the tail

- **WHEN** a resume/open path hydrates more items than the progressive batch size
- **THEN** the first `setThreadItems` payload MUST be the newest batch (the tail)
- **AND** the user-visible canvas MUST show the latest turn before any older batch is applied

#### Scenario: Small history stays a single write

- **WHEN** the hydrated item count is less than or equal to the progressive batch size
- **THEN** the system MUST dispatch a single `setThreadItems` with the full list
- **AND** MUST NOT introduce extra yields or partial windows

### Requirement: Progressive expansion MUST only prepend older items

After the tail first-paint, any further hydration of the same snapshot MUST add older items above the already painted tail. The system MUST NOT replace the canvas with a growing oldest-first prefix.

#### Scenario: Second batch is older than the first paint

- **GIVEN** the tail window is already on the canvas
- **WHEN** the next progressive batch is applied
- **THEN** the newest items from the first paint MUST still be present
- **AND** the newly applied items MUST be older than that tail
- **AND** the dispatch MUST be prepend (or an equivalent tail-preserving replace)

### Requirement: Late projection merge MUST NOT replay from the start

When a Shared projection snapshot arrives after Phase-A V0 has already been painted, the system MUST merge into the live canvas atomically. The system MUST NOT run oldest-first progressive hydration again on that merge.

#### Scenario: Background projection does not replay history

- **GIVEN** a Shared thread already has V0 items on the canvas
- **AND** the thread is not in a live processing turn
- **WHEN** a late projection snapshot is applied
- **THEN** the system MUST merge projection items with the live canvas
- **AND** MUST apply the result in a single store write (or a tail-preserving window update)
- **AND** MUST NOT dispatch a growing oldest-first prefix

### Requirement: Older history MUST load from the existing earlier-messages chip

When older items remain after tail first-paint, the canvas MUST show the existing collapsed-history indicator with the remaining count. Clicking it MUST load the next older batch only. Scroll-to-bottom follow MUST NOT be re-armed by that prepend. Canvas `onScroll` and jump-to-start MUST NOT auto-load older history.

#### Scenario: Chip shows remaining count and paginates

- **GIVEN** a thread whose in-memory history window has older items
- **WHEN** the canvas renders
- **THEN** the existing earlier-messages chip MUST show the remaining older count
- **AND** a click MUST prepend one older batch
- **AND** MUST restore the pre-click scroll anchor
- **AND** MUST NOT change the stick-to-bottom follow algorithm
- **AND** MUST NOT load older history from scroll or jump-to-start

#### Scenario: Conversation settle still pins to bottom

- **GIVEN** a live turn is following the bottom
- **WHEN** the turn settles
- **THEN** stick-to-bottom / follow settle MUST behave as before this change
- **AND** an unused older-history cache MUST NOT by itself unpin or re-pin the viewport
