## ADDED Requirements

### Requirement: Workspace Mutation Lease Domain MUST Have Explicit Lock Topology
The system MUST declare the Squad workspace mutation lease as a separate shared state domain and MUST keep its lock/transaction order deterministic relative to canonical writer, runtime owner, Context Package, and projection state.

#### Scenario: lease acquisition lock order
- **WHEN** a Mutate attempt acquires authority
- **THEN** short-lived validation and single-writer transaction complete before any runtime await or filesystem command executes

#### Scenario: runtime command does not hold shared lock
- **WHEN** a Worker CLI command or workspace scan takes an unbounded duration
- **THEN** no AppState, projection, scheduler, or SQLite transaction lock remains held across that await

#### Scenario: topology change is reviewed
- **WHEN** implementation adds a new lock nested with mutation lease or writer state
- **THEN** the shared state domain map and focused deadlock evidence are updated in the same change
