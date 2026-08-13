# composer-control-surface Delta

## MODIFIED Requirements

### Requirement: Browser Context Snapshot Cards MUST Remain Legible In Light Themes

Composer browser context attachments and their message summary counterparts MUST remain readable in dark, dim, light, system-light, and Windows WebView2 light surfaces. When the attachment contains selected excerpts, the surface MAY be a transparent excerpt fold rather than a filled blue card, but expired / degraded / unsupported observation state MUST remain distinguishable. Refresh and remove actions MUST stay reachable from the composer preview.

#### Scenario: expired composer browser excerpt remains readable

- **WHEN** a Composer browser context attachment has observation state `expired`
- **THEN** the excerpt fold MUST show an expired-specific state label
- **AND** refresh and remove MUST remain available
- **AND** the expired state label MUST come from i18n

#### Scenario: message summary preserves browser observation state

- **WHEN** a browser excerpt summary receives an attachment with observation state `expired`, `degraded`, or `unsupported`
- **THEN** the fold MUST preserve that observation state for rendering
- **AND** it MUST NOT collapse all non-available states into the stale visual treatment

#### Scenario: excerpt fold contrast fix does not change capture semantics

- **WHEN** browser excerpt folds render without the previous blue card chrome
- **THEN** Browser Agent capture, freshness calculation, diagnostics, prompt attachment, and privacy redaction semantics MUST remain unchanged
- **AND** the change MUST stay scoped to presentation, i18n labels, and selected-element send-detail display
