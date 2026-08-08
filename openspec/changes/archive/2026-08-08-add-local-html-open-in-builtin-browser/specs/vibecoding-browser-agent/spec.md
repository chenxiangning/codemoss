## MODIFIED Requirements

### Requirement: Browser Dock SHALL provide a client-owned embedded web surface

The system SHALL provide a Browser Dock as a client-owned detached workspace browser window backed by a browser-specific WebView renderer so users can view web pages inside the client without replacing the main application webview.

#### Scenario: user opens Browser Dock from the global toolbar
- **WHEN** the user clicks the Browser Dock icon in the top global toolbar
- **THEN** the system SHALL open or focus the detached Browser Dock flow for the active workspace
- **AND** the Browser Agent renderer SHALL open in a separate client-owned browser window rather than navigating the main application webview
- **AND** the main conversation SHALL remain available in the main application window
- **AND** Browser Dock SHALL NOT open as a blocking modal or transient popover for its primary workspace view

#### Scenario: user opens a page inside Browser Dock
- **WHEN** the user enters an allowed `http` or `https` URL in Browser Dock
- **THEN** the system SHALL create or reuse a workspace-scoped browser session
- **AND** the page SHALL render inside a browser-specific WebView rather than navigating the main application window
- **AND** the system SHALL show URL, title, loading state, and error state when available

#### Scenario: user opens a local HTML file via file://
- **WHEN** a Browser Agent session is created or navigated with a `file://` URL whose path ends with `.html` or `.htm` (case-insensitive, ignoring trailing query/fragment)
- **THEN** the URL validation policy SHALL allow the URL
- **AND** the Browser Agent renderer SHALL load that local HTML page
- **AND** relative asset references under the same directory MAY resolve according to normal `file://` browser rules

#### Scenario: non-HTML local file:// URLs remain blocked
- **WHEN** a Browser Agent URL uses the `file://` scheme but does not end with `.html` or `.htm`
- **THEN** the URL validation policy SHALL reject the URL with a blocked-file-type diagnostic
- **AND** the system SHALL NOT create a successful ready session for that URL

#### Scenario: Browser Dock URL draft preserves file://
- **WHEN** the user or an internal caller supplies a draft URL that already has a `file://` scheme
- **THEN** Browser Dock URL normalization MUST keep the `file://` scheme
- **AND** MUST NOT rewrite it to `https://file://...`

#### Scenario: Browser Dock renderer opens at a usable default size
- **WHEN** the system opens the Browser Agent renderer window
- **THEN** the window SHALL use a default size large enough for ordinary web pages to render without narrow-viewport deformation
- **AND** the window SHALL preserve minimum usable dimensions for the toolbar, content viewport, and selection affordances
- **AND** the sizing change SHALL NOT alter browser session identity, capture semantics, or AI attachment semantics

#### Scenario: browser navigation does not break main app navigation policy
- **WHEN** a Browser Dock session navigates to an external page
- **THEN** the main application webview SHALL remain on the client app route
- **AND** existing ordinary external links outside Browser Dock SHALL continue to open through the existing external-link policy

#### Scenario: unsupported platform degrades explicitly
- **WHEN** the current platform cannot provide the required Browser Dock WebView behavior
- **THEN** the Browser Dock SHALL render an explicit unsupported or degraded state
- **AND** the system SHALL NOT pretend that browser context is available to AI
