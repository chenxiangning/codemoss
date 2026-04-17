## ADDED Requirements

### Requirement: Delete Branch Handles Worktree-Occupied Error with Self-Healing Retry

The system SHALL provide deterministic handling for branch delete failures caused by worktree occupancy.

#### Scenario: Stale worktree metadata can be auto-healed

- **WHEN** delete local branch fails with `cannot delete branch ... used by worktree`
- **THEN** backend SHALL run one `git worktree prune` attempt
- **AND** backend SHALL retry branch delete once automatically

#### Scenario: Active worktree occupancy remains protected

- **WHEN** retry still fails because branch is actively used by a linked worktree
- **THEN** system SHALL keep delete action failed
- **AND** UI SHALL show actionable guidance to switch or remove the occupying worktree first

#### Scenario: Non-worktree delete errors keep original failure path

- **WHEN** delete branch fails for reasons unrelated to worktree occupancy
- **THEN** system SHALL skip prune-retry path
- **AND** system SHALL return original error classification and message mapping
