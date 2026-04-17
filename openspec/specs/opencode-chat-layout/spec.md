# opencode-chat-layout Specification

## Purpose

Define OpenCode mode chat-layout rules that keep conversation flow primary while moving configuration controls to on-demand surfaces.

## Requirements

### Requirement: OpenCode Chat Layout Prioritizes Conversation Flow

The system MUST keep the main chat area as the highest-priority layout region in OpenCode mode.

#### Scenario: keep chat area primary

- **WHEN** user enters OpenCode mode and runs continuous conversation
- **THEN** message area and input area MUST remain stably visible
- **AND** detailed configuration controls SHALL be accessed through on-demand panel expansion

### Requirement: OpenCode Drawer-Based Control Surface

The system MUST provide a dedicated drawer control surface for Provider / MCP / Sessions / Advanced.

#### Scenario: open and operate control drawer

- **WHEN** user clicks open-panel action
- **THEN** system MUST display a drawer with Provider, MCP, Sessions, and Advanced tabs
- **AND** closing the drawer MUST immediately return to chat-primary view

### Requirement: OpenCode Provider Picker Supports Search and Grouping

The system MUST support provider search and Popular/Other grouping in OpenCode provider selection.

#### Scenario: select provider from long list

- **WHEN** provider list is long
- **THEN** user MUST be able to filter by keyword
- **AND** system MUST render provider groups as Popular and Other

### Requirement: OpenCode Keyboard Layering Is Predictable

The system SHALL provide predictable overlay-closing order for keyboard actions.

#### Scenario: close layered overlays with Escape

- **WHEN** provider popup and control drawer are both open
- **THEN** pressing Escape SHALL close provider popup first, then close drawer
