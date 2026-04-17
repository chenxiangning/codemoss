## MODIFIED Requirements

### Requirement: Unified History MUST Preserve Source Identity Metadata
Unified history entries MUST include source/provider identity metadata for UI labeling and diagnostics.

#### Scenario: unified entry includes source label and size metadata when available
- **WHEN** unified entry can be enriched from local session summary
- **THEN** entry SHOULD expose `sourceLabel`
- **AND** entry SHOULD expose `sizeBytes`

### Requirement: Unified History MUST Degrade Gracefully
Failure in one source path MUST NOT collapse entire history list response.

#### Scenario: local scan unavailable reuses known workspace session identities
- **WHEN** local session scan fails but cached workspace session ids are available
- **THEN** unified history MUST keep matching live entries visible
- **AND** response MUST include `partialSource = "local-session-scan-unavailable"`
