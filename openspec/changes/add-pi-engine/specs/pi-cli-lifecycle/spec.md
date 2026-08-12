## ADDED Requirements

### Requirement: PI CLI install lifecycle

The system MUST support install, update, and uninstall for PI CLI via npm package `@earendil-works/pi-coding-agent`, doctor diagnostics, and optional custom binary path `piBin`.

#### Scenario: Install plan

- **WHEN** the user requests install for engine `pi`
- **THEN** the plan uses npm global install of `@earendil-works/pi-coding-agent@latest`

#### Scenario: Uninstall

- **WHEN** the user requests uninstall for engine `pi`
- **THEN** the plan runs npm uninstall of `@earendil-works/pi-coding-agent`
