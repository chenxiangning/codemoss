# opencode-engine Specification Delta

## ADDED Requirements

### Requirement: OpenCode Send Guard on Disconnected State

OpenCode chat MUST block user message sending when connection state is red/disconnected.

#### Scenario: prevent send when connection is red

- **GIVEN** active engine is `opencode`
- **AND** OpenCode connection state is red/disconnected
- **WHEN** user triggers send (button or Enter)
- **THEN** system MUST NOT dispatch message to OpenCode runtime
- **AND** system MUST show actionable guidance to restore connection first.

### Requirement: OpenCode Control Panel Anchored Placement

OpenCode control panel popover MUST open above its trigger button by default instead of fixed top-right placement.

#### Scenario: panel opens above trigger

- **GIVEN** user clicks OpenCode control panel trigger button
- **WHEN** panel opens
- **THEN** panel MUST be positioned above the trigger by default
- **AND** only fallback to alternative placement when viewport constraints require it.

### Requirement: OpenCode Model Selector Surface Consolidation

OpenCode model selector MUST be rendered inside OpenCode control panel and MUST NOT occupy chat composer inline area.

#### Scenario: composer stays clean in opencode mode

- **GIVEN** active engine is `opencode`
- **WHEN** composer renders
- **THEN** composer MUST NOT render OpenCode model selector below text input
- **AND** OpenCode control panel MUST provide model selection entry with equivalent capability.

### Requirement: OpenCode Panel Connection Onboarding Summary

OpenCode control panel homepage MUST provide connection onboarding without default connection preselection.

#### Scenario: homepage shows status and guidance without default selection

- **GIVEN** user opens OpenCode control panel homepage
- **WHEN** no explicit connection has been selected by user
- **THEN** system MUST NOT auto-select a default connection
- **AND** homepage MUST display current connection state, completed auth methods, and supported model count.
