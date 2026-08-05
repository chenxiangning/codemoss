## ADDED Requirements

### Requirement: Shared Session MUST Own One Nested Active Squad Surface
The Shared Session MUST keep Squad Run identity and cards inside its canonical conversation while keeping linked Worker native sessions internal and distinct from engine-native SubAgent navigation.

#### Scenario: shared session reopens with active run
- **WHEN** the application reloads a Shared Session containing a non-terminal Squad Run
- **THEN** canonical Shared history first proves the run belongs to that exact session, after which the same run card and projection-owned state reappear without creating a new visible thread or probing unrelated Shared Sessions

#### Scenario: worker native session catalog refreshes
- **WHEN** hidden Squad Worker sessions are discovered by engine history or runtime catalog refresh
- **THEN** they remain excluded from top-level native conversation rows and are reachable only through Squad node detail evidence

#### Scenario: existing subagent UI remains separate
- **WHEN** an engine-native SubAgent relationship and a Squad Run both exist
- **THEN** each uses its own domain projection and inspector adapter without reclassifying one as the other
