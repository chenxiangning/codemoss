## ADDED Requirements

### Requirement: User can configure global UI scaling
The system SHALL provide a global UI scaling setting in client settings using a slider control with supported range 80% to 260%.

#### Scenario: Scaling options are visible in settings
- **WHEN** user opens client settings
- **THEN** system SHALL show a "Global UI Scale" slider with a visible current percentage value

#### Scenario: User changes scaling option
- **WHEN** user adjusts slider value and clicks save
- **THEN** system SHALL accept and store the selected value as the active UI scale preference

### Requirement: Scaling change applies immediately without restart
The system SHALL apply updated global UI scale to the active window immediately after save and SHALL NOT require application restart.

#### Scenario: Real-time scaling update
- **WHEN** user saves scale from 100% to 125%
- **THEN** system SHALL update text and control sizes in the current UI within one second

#### Scenario: Main regions remain interactable after scaling
- **WHEN** scale is changed to any supported value
- **THEN** system SHALL keep left sidebar, main canvas, and right panel visible and interactive

### Requirement: Scaling preference persists across restarts
The system SHALL persist the selected global UI scale and restore it on next application launch.

#### Scenario: Restore persisted scale on startup
- **WHEN** user sets scale to 110% and restarts the app
- **THEN** system SHALL load 110% as active UI scale after startup

#### Scenario: Invalid persisted value falls back safely
- **WHEN** persisted scale value is missing or outside supported range
- **THEN** system SHALL fallback to 100% and continue normal startup

### Requirement: User can recover default scale quickly
The system SHALL provide a direct way to reset global UI scale draft to 100% from settings.

#### Scenario: Reset to default
- **WHEN** user activates "Reset to 100%"
- **THEN** system SHALL set scale draft to 100% and user can persist/apply this value via save

#### Scenario: Recovery keeps layout usable
- **WHEN** user resets from an enlarged scale (e.g., 150%) to 100%
- **THEN** system SHALL keep settings page controls accessible and not require window reload
