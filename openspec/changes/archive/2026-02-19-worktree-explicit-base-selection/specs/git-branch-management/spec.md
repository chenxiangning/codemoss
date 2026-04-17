# git-branch-management Specification Delta

## MODIFIED Requirements

### Requirement: Create Branch from Current or Selected Commit

The system SHALL support branch creation from explicit and user-visible source references only.

#### Scenario: Create from current HEAD

- **WHEN** user chooses `New Branch` in branch list context
- **THEN** system prompts for branch name and shows source reference as current `HEAD`
- **AND** system creates the branch only after explicit confirmation of source reference

#### Scenario: Create from selected commit

- **WHEN** user chooses `Create Branch from Here` on commit row
- **THEN** system prompts for branch name and creates branch at selected commit

#### Scenario: Branch name validation

- **WHEN** user inputs an invalid branch name
- **THEN** system rejects the input using Git ref format rules and shows validation message

#### Scenario: Prevent implicit source fallback

- **WHEN** source reference is unavailable or cannot be resolved
- **THEN** system blocks branch creation
- **AND** system SHALL NOT fallback to an implicit reference
