## ADDED Requirements

### Requirement: Squad Node Context Identity MUST Cover Plan And Dependency Semantics
The Context Package system MUST include run, plan revision, node, sealed constraints, immutable target, dependency outcome hashes, and selected evidence ranges in content identity, and MUST bind delivery identity to the exact attempt.

#### Scenario: dependency outcome changes
- **WHEN** a repaired dependency produces a new typed outcome
- **THEN** the dependent node receives a different Context Package identity and the previous package is not misreported as current

#### Scenario: equivalent retry input
- **WHEN** a retry uses identical plan revision, constraints, target, dependency outcomes, and evidence ranges
- **THEN** the compiler produces the same content identity while delivery identity remains attempt-specific

#### Scenario: constraint omission is forbidden
- **WHEN** a node package would omit the approved workspace root, permission class, or exact sealed target
- **THEN** compilation fails before delivery
