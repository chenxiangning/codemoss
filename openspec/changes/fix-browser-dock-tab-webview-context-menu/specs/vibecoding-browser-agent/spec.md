## ADDED Requirements

### Requirement: Embedded Browser Dock renderer lifecycle SHALL be navigation-correlated

The system SHALL use one native child WebView renderer for the active embedded Browser Dock tab while preserving a binding containing the Browser Session, expected URL, and whether matching page loading has begun. A native page-load callback SHALL update a Browser Session only when its URL matches the binding's expected URL. A document-title callback SHALL update a Browser Session only when the current `Webview::url()` matches the expected URL and matching page loading has begun; callbacks from a prior tab MUST be ignored.

#### Scenario: late callback from a previously active tab

- **WHEN** Browser Dock has navigated its shared renderer from session A to session B
- **AND** a late page-load or document-title callback for A arrives after B becomes the binding
- **THEN** the system SHALL NOT update B with A's URL, title, loading status, or ready status
- **AND** the system SHALL preserve B's Browser Session ownership and visible page association

#### Scenario: matching callback for current navigation

- **WHEN** the shared renderer receives a page-load callback for its expected URL
- **THEN** the system SHALL update only the currently bound Browser Session with the callback URL and loading or ready state
- **AND** the system SHALL accept a document-title callback only after the current navigation has begun loading

### Requirement: Embedded Browser Dock tab context menu SHALL preserve page rendering and close semantics

The system SHALL render the Browser Dock tab context menu in the active native child WebView renderer without hiding, closing, or replacing the visible page. The menu SHALL preserve the existing close-current, close-others, close-right, and close-all actions; the frontend SHALL calculate the actual close targets from its current open-tab list when an action is received.

#### Scenario: context menu opens over embedded page

- **WHEN** the user right-clicks an embedded Browser Dock tab
- **THEN** the system SHALL keep the currently visible child WebView page rendered
- **AND** the menu SHALL expose close-current, close-others, close-right, and close-all actions
- **AND** an action with no current close target SHALL be disabled

#### Scenario: menu action closes current targets only

- **WHEN** the native child WebView emits a valid tab close action
- **THEN** the frontend SHALL recompute close targets from its latest open-tab list
- **AND** the system SHALL NOT close a tab that is no longer a valid target

### Requirement: Embedded Browser Dock tab context menu SHALL inherit the host theme

The system SHALL pass the host application's computed menu surface, foreground, border, hover, disabled foreground, shadow, and resolved color-scheme values to the native child WebView menu. The child menu SHALL use those values rather than hard-coded light or dark palette colors.

#### Scenario: theme changes before a menu is opened

- **WHEN** the host application is using light, dark, or system-resolved theme
- **AND** the user opens an embedded Browser Dock tab context menu
- **THEN** the menu SHALL use the host's current computed theme values for its visual surface and disabled state
