## ADDED Requirements

### Requirement: Mutation Lease CAS And Audit Fact MUST Commit Atomically
The `SharedEventWriter` MUST update the rebuildable workspace mutation lease row and append its corresponding typed lease fact in one transaction so operational ownership and canonical audit cannot diverge.

#### Scenario: acquire transaction succeeds
- **WHEN** the workspace row is free and a valid Mutate attempt acquires it
- **THEN** the new holder/epoch row and `SquadMutationLeaseChanged(acquired)` fact become visible together

#### Scenario: acquire transaction conflicts
- **WHEN** another non-terminal holder owns the workspace row
- **THEN** neither a new lease row nor an acquired fact is committed for the losing attempt

#### Scenario: crash at transaction boundary
- **WHEN** the process is killed before or after lease transaction commit
- **THEN** recovery observes either neither mutation or both the row and canonical fact, never a half-committed authority

#### Scenario: operational index rebuild
- **WHEN** the lease table is missing or declared rebuild-required while canonical facts pass integrity checks
- **THEN** the system reconstructs lease rows deterministically without inventing a released state for ambiguous accepted mutation work
