# vibecoding-browser-agent Delta

## MODIFIED Requirements

### Requirement: Browser Dock SHALL provide a client-owned embedded web surface

The system SHALL provide a Browser Dock backed by a browser-specific WebView renderer so users can view web pages inside the client without replacing the main application webview. The primary dock surface SHALL be an embedded center split inside the main application window (conversation canvas left, browser right); the detached floating renderer window SHALL remain available through an explicit pop-out affordance.

#### Scenario: user opens Browser Dock from the global toolbar

- **WHEN** the user clicks the Browser Dock icon in the top global toolbar
- **THEN** the system SHALL toggle the embedded Browser Dock in the main window center area for the active workspace
- **AND** the Browser Agent renderer SHALL NOT navigate the main application webview
- **AND** the main conversation SHALL remain available side-by-side with the embedded dock
- **AND** Browser Dock SHALL NOT open as a blocking modal or transient popover for its primary workspace view

#### Scenario: user opens a page inside the embedded Browser Dock

- **WHEN** the user enters an allowed `http` or `https` URL in the embedded Browser Dock
- **THEN** the system SHALL create or reuse a workspace-scoped browser session
- **AND** the page SHALL render inside a browser-specific child WebView positioned over the dock container rectangle in the main window
- **AND** the system SHALL show URL, title, loading state, and error state when available

#### Scenario: user pops out to the detached renderer window

- **WHEN** the user activates the pop-out affordance in the embedded dock toolbar
- **THEN** the embedded child WebView SHALL be hidden
- **AND** the active session SHALL open in the separate client-owned `browser-agent-window` renderer with its injected toolbar
- **AND** the main conversation SHALL remain available in the main application window

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

- **WHEN** the system opens the Browser Agent renderer window (detached pop-out path)
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
