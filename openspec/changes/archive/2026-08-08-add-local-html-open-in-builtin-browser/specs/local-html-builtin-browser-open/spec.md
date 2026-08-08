## ADDED Requirements

### Requirement: Local HTML open uses the built-in Browser Agent

The client MUST open local HTML files through the built-in Browser Agent session/window path (`create_browser_agent_session` + `open_browser_agent_window`) using a `file://` URL. The client MUST NOT use system-default browser openers (`plugin-opener` `openUrl`) or `openPath` association handlers as the primary path for this feature.

#### Scenario: Successful open from a workspace absolute path

- **WHEN** the user triggers Open in Browser for a local HTML file with a valid `workspaceId`
- **THEN** the client MUST create a Browser Agent session whose URL is a correctly encoded `file://` form of the absolute path
- **AND** the client MUST open or focus the Browser Agent window for that session

#### Scenario: Missing workspace blocks open without crashing

- **WHEN** Open in Browser is requested without a usable `workspaceId`
- **THEN** the client MUST NOT create a Browser Agent session
- **AND** the client MUST surface a non-blocking error notice or toast
- **AND** the main UI MUST remain interactive

#### Scenario: Open failure is non-blocking global toast with i18n copy

- **WHEN** Browser Agent session creation or window open rejects
- **THEN** the client MUST surface a non-blocking **global** error toast (`pushErrorToast`)
- **AND** the toast message MUST be a localized user-readable string (not the raw technical `error.message`)
- **AND** file-tree local operation notices MUST NOT be used for this failure path
- **AND** the client MUST NOT crash or freeze the host surface

#### Scenario: Window-already-exists is mapped to readable busy copy

- **WHEN** open fails because a Browser Agent webview/window label already exists
- **THEN** the toast message MUST use the localized window-busy copy
- **AND** MUST NOT display the raw "already exists" technical string to the user

### Requirement: Only HTML-like extensions show open affordances

Open-in-browser affordances MUST appear only for paths that match `.html` or `.htm` case-insensitively after path separator normalization. Non-HTML files MUST NOT show the menu item or row icon.

#### Scenario: HTML extensions are eligible

- **WHEN** the path ends with `.html`, `.htm`, `.HTML`, or `.HTM` (including Windows separators)
- **THEN** the surface MUST treat the path as HTML-eligible for Open in Browser

#### Scenario: Non-HTML paths are ineligible

- **WHEN** the path is `.ts`, `.md`, `.txt`, `.html.bak`, or empty/whitespace
- **THEN** the surface MUST NOT show Open in Browser

### Requirement: file:// encoding preserves cross-platform paths

Local path to `file://` conversion MUST encode each path segment with URI encoding while preserving Windows drive-letter colons, and MUST normalize backslashes to slashes so spaces, non-ASCII names, and `#`/`?` characters do not break navigation.

#### Scenario: POSIX absolute path

- **WHEN** the absolute path is `/Users/me/site/index.html`
- **THEN** the URL MUST be `file:///Users/me/site/index.html`

#### Scenario: Windows drive path

- **WHEN** the absolute path is `C:\Users\me\site\index.html`
- **THEN** the URL MUST be `file:///C:/Users/me/site/index.html`

#### Scenario: Spaces and non-ASCII segments

- **WHEN** a path segment contains spaces or Chinese characters
- **THEN** those segments MUST be percent-encoded in the `file://` URL

### Requirement: File view content context menu exposes Open in Browser

The open file content surface (`FileViewPanel` content context menu) MUST offer Open in Browser for HTML-eligible files in both edit and preview modes. Relative file paths MUST be resolved against the workspace path before open.

#### Scenario: Content menu on HTML file

- **WHEN** an HTML file is open in the file view
- **AND** the user opens the content-area context menu
- **THEN** the menu MUST include `files.openInBrowser`
- **AND** selecting it MUST open the built-in Browser Agent for that file

#### Scenario: Content menu on non-HTML file

- **WHEN** a non-HTML file is open
- **AND** the user opens the content-area context menu
- **THEN** the menu MUST NOT include `files.openInBrowser`

### Requirement: File tree exposes direct icon and context menu entry

The workspace file tree MUST show a Globe (or equivalent) row action for HTML files and MUST include Open in Browser on the file context menu. Folders MUST NOT show the browser action.

#### Scenario: File tree row icon for HTML

- **WHEN** a file tree row represents an HTML file and browser open is available
- **THEN** the row action group MUST include a browser action control
- **AND** activating it MUST open the built-in Browser Agent for the resolved absolute path

#### Scenario: File tree context menu for HTML

- **WHEN** the user opens the context menu on an HTML file node
- **THEN** the menu MUST include Open in Browser

#### Scenario: Detached explorer keeps browser action

- **WHEN** the file tree is rendered in a detached explorer window
- **THEN** the browser row action MUST remain available for HTML files
- **AND** the mention (`+`) row action MAY remain hidden in detached mode

### Requirement: Git change file list exposes Open in Browser icon

Git staged/unstaged file rows MUST show an Open in Browser icon for HTML-eligible paths that are not deleted. The handler MUST resolve repository-relative paths into workspace absolute paths before opening. Multi-repository change lists MUST pass the owning `repositoryRoot` into path resolution.

#### Scenario: Git row HTML icon

- **WHEN** a Git file row path is HTML-eligible and not deleted
- **THEN** the row actions MUST include Open in Browser
- **AND** activating it MUST open the built-in Browser Agent for the resolved workspace absolute path

#### Scenario: Deleted Git HTML file hides icon

- **WHEN** a Git file row is marked deleted
- **THEN** the Open in Browser icon MUST NOT be shown even if the path looks like HTML

#### Scenario: Non-HTML Git rows hide icon

- **WHEN** a Git file row path is not HTML-eligible
- **THEN** the Open in Browser icon MUST NOT be shown
