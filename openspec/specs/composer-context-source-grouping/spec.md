# composer-context-source-grouping Specification

## Purpose

TBD - created by archiving change composer-project-scope-skill-command-discovery. Update Purpose after archive.

## Requirements

### Requirement: Source-Grouped Context Menus

The system SHALL render `S+` and `M+` candidate lists grouped by resource source.

#### Scenario: S+ menu renders source groups

- **WHEN** user opens `S+` menu
- **THEN** UI SHALL render skills under source group sections
- **AND** source groups SHALL distinguish project-scoped and user/global-scoped entries

#### Scenario: M+ menu renders source groups

- **WHEN** user opens `M+` menu
- **THEN** UI SHALL render commands under source group sections
- **AND** source groups SHALL distinguish project-scoped and user/global-scoped entries

#### Scenario: Empty source groups are hidden

- **WHEN** a source group has no entries after filtering
- **THEN** UI SHALL NOT render that empty group section

### Requirement: Query Filtering Preserves Source Semantics

The system SHALL keep source grouping semantics when query filtering is applied.

#### Scenario: Search results remain grouped by source

- **WHEN** user enters search query in `S+` or `M+`
- **THEN** system SHALL filter entries by name/description match
- **AND** matched entries SHALL remain rendered under their original source group

#### Scenario: No matched entries shows global empty state

- **WHEN** query yields no matches in any source group
- **THEN** UI SHALL show the existing empty-state hint
- **AND** UI SHALL NOT render stale groups from pre-filter state

### Requirement: Source Grouping Does Not Change Prompt Assembly

Source grouping SHALL affect presentation only and SHALL NOT alter selected slash-token assembly behavior.

#### Scenario: Selecting project-scoped skill keeps existing slash semantics

- **WHEN** user selects a skill from a project source group and sends message
- **THEN** assembled prompt SHALL include the same `/skill-name` token format as existing behavior
- **AND** system SHALL NOT append source label into user-visible prompt content

#### Scenario: Selecting project-scoped command keeps existing slash semantics

- **WHEN** user selects a command from a project source group and sends message
- **THEN** assembled prompt SHALL include the same `/command-name` token format as existing behavior
- **AND** system SHALL NOT append source label into user-visible prompt content

### Requirement: Deterministic Ordering Within Group

Entries inside each source group SHALL use deterministic ordering.

#### Scenario: Group entries are sorted by normalized name

- **WHEN** multiple entries exist in the same source group
- **THEN** entries SHALL be sorted by normalized name in ascending lexical order

