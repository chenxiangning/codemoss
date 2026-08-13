## ADDED Requirements

### Requirement: In-memory open paths MUST paint a tail window first

Engines that already hold a full in-memory transcript (Shared V0, Gemini/Grok/Kimi parse, Claude full-load callers) MUST still first-paint the newest window when the UI open path hydrates the canvas. Disk `limit`/`before` remains optional and is not required for this in-memory contract.

#### Scenario: Shared full V0 still first-paints the tail

- **WHEN** Shared `loadSharedSession` returns more items than the progressive batch size
- **THEN** the canvas first paint MUST be the newest batch
- **AND** older V0 items MUST remain available for later prepend
- **AND** the disk transcript MUST remain unchanged
