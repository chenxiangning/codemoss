## ADDED Requirements

### Requirement: Lock overlay includes structured CodeMoss showcase

The system SHALL present a non-empty informative lock overlay with structured tabs that explain core CodeMoss
capabilities.

#### Scenario: Showcase tabs visible in locked mode

- **WHEN** the app enters locked mode
- **THEN** overlay SHALL include tabbed sections at least for:
- live sessions
- capability atlas
- delivery flow
- element guide

### Requirement: Live tab shows running output only

The system SHALL display only running session outputs in the lock page live tab.

#### Scenario: No history rendering in live tab

- **WHEN** live tab renders session stream
- **THEN** it SHALL include only sessions with processing state
- **AND** completed/idle historical sessions SHALL not be listed

#### Scenario: Empty live state

- **GIVEN** there is no running session
- **WHEN** user opens live tab
- **THEN** overlay SHALL show an explicit empty-state message

### Requirement: Adaptive live card height allocation

The system SHALL adapt live-card heights by count to maximize readable space.

#### Scenario: One card fills available area

- **GIVEN** exactly one running session
- **WHEN** live tab renders
- **THEN** the single card SHALL occupy the available list area with min-height constraint

#### Scenario: Two cards split space

- **GIVEN** two running sessions
- **WHEN** live tab renders
- **THEN** both cards SHALL split available height evenly with min-height constraint

#### Scenario: Multiple cards with overflow

- **GIVEN** running session count exceeds available viewport capacity
- **WHEN** live tab renders
- **THEN** cards SHALL keep minimum height and list SHALL scroll

### Requirement: Theme-aware lock-page visual style

The system SHALL follow system/app appearance modes and keep consistent readability.

#### Scenario: Appearance mode switch

- **WHEN** app appearance changes across light/dark/dim variants
- **THEN** lock overlay colors, borders, and text contrast SHALL adapt accordingly

### Requirement: Showcase remains readable on desktop and compact layouts

The system SHALL preserve readability and avoid clipping on desktop and compact viewport sizes.

#### Scenario: Responsive lock layout

- **WHEN** viewport switches between desktop and compact widths
- **THEN** lock overlay content SHALL reflow without clipping unlock controls or primary tab content
