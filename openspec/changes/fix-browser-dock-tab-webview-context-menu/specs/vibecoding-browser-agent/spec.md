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

The system SHALL render the Browser Dock tab context menu in the active native child WebView renderer without hiding, closing, or replacing the visible page. The visible menu UI SHALL be hosted in a closed Shadow DOM and use host-provided theme values, so target-page author CSS MUST NOT change its menu geometry, theme, disabled state, or action availability. The menu SHALL preserve the existing close-current, close-others, close-right, and close-all actions; the frontend SHALL calculate the actual close targets from its current open-tab list when an action is received.

#### Scenario: context menu opens over embedded page

- **WHEN** the user right-clicks an embedded Browser Dock tab
- **THEN** the system SHALL keep the currently visible child WebView page rendered
- **AND** the menu SHALL expose close-current, close-others, close-right, and close-all actions
- **AND** an action with no current close target SHALL be disabled

#### Scenario: target page contains global menu-like CSS

- **WHEN** the embedded target page provides global selectors or `!important` declarations that match generic `div` or `button` elements
- **THEN** the tab context menu SHALL retain its host-provided theme, position, dimensions, disabled state, and clickable actions

#### Scenario: menu action closes current targets only

- **WHEN** the native child WebView emits a valid tab close action
- **THEN** the frontend SHALL recompute close targets from its latest open-tab list
- **AND** the system SHALL NOT close a tab that is no longer a valid target

### Requirement: Embedded Browser Dock tab context-menu bridge SHALL be capability-bound

The system SHALL bind every displayed tab context menu to a newly generated, one-time nonce, the selected target Browser Session, and the currently rendered Browser Session. The native navigation handler SHALL emit a tab close action only after atomically consuming a matching, unexpired binding. It MUST intercept invalid, expired, forged, or replayed bridge navigation without emitting an action.

#### Scenario: valid menu action

- **WHEN** the user selects an enabled action from the currently displayed tab context menu before its authorization expires
- **THEN** the native handler SHALL emit exactly one action for the bound target Browser Session

#### Scenario: forged or replayed bridge navigation

- **WHEN** a target page constructs a bridge URL without the active nonce, changes its target or renderer session id, uses an expired nonce, or reuses a consumed nonce
- **THEN** the native handler SHALL prevent the navigation
- **AND** it SHALL NOT emit a tab close action

### Requirement: Embedded Browser Dock tab context menu SHALL inherit the host theme

The system SHALL pass the host application's computed menu surface, foreground, border, hover, disabled foreground, shadow, and resolved color-scheme values to the native child WebView menu. The child menu SHALL use those values rather than hard-coded light or dark palette colors.

#### Scenario: theme changes before a menu is opened

- **WHEN** the host application is using light, dark, or system-resolved theme
- **AND** the user opens an embedded Browser Dock tab context menu
- **THEN** the menu SHALL use the host's current computed theme values for its visual surface and disabled state
