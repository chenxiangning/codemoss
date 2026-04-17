# workspace-filetree-special-directory-loading Specification

## Purpose
TBD - created by archiving change filetree-special-directory-progressive-loading. Update Purpose after archive.
## Requirements
### Requirement: Special Directory Classification For Progressive Loading
The system SHALL classify dependency directories and build-artifact directories as special directories for progressive loading.

#### Scenario: classify known dependency directories as special
- **WHEN** workspace scanning encounters directory names in dependency set (`node_modules`, `.pnpm-store`, `.yarn`, `bower_components`, `vendor`, `.venv`, `venv`, `env`, `__pypackages__`, `Pods`, `Carthage`, `.m2`, `.ivy2`, `.cargo`)
- **THEN** system SHALL mark these directories as `special=true`
- **AND** system SHALL assign `specialKind=dependency`

#### Scenario: classify known build artifact directories as special
- **WHEN** workspace scanning encounters directory names in build-artifact set (`target`, `dist`, `build`, `out`, `coverage`, `.next`, `.nuxt`, `.svelte-kit`, `.angular`, `.parcel-cache`, `.turbo`, `.cache`, `.gradle`, `CMakeFiles`, `cmake-build-*`, `bin`, `obj`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.tox`, `.dart_tool`)
- **THEN** system SHALL mark these directories as `special=true`
- **AND** system SHALL assign `specialKind=build_artifact`

#### Scenario: non-special directories preserve regular classification
- **WHEN** workspace scanning encounters source or documentation directories not in special sets
- **THEN** system SHALL keep regular directory classification
- **AND** system MUST NOT force progressive loading behavior on those directories

### Requirement: Initial Workspace Listing Shall Not Preload Special Subtrees
The system SHALL avoid preloading descendants of special directories in initial workspace file listing, while wrapping all top-level entries under a single workspace root node.

#### Scenario: initial listing includes workspace root and special nodes without deep descendants
- **WHEN** client requests initial workspace file tree payload
- **THEN** response SHALL include one workspace root node whose children contain special directory nodes
- **AND** response SHALL exclude descendants under those special directories until explicit expansion request

#### Scenario: expanding workspace root does not eagerly preload special descendants
- **WHEN** user expands workspace root node
- **THEN** system SHALL only reveal already listed direct children under root
- **AND** system MUST NOT recursively preload descendants of special directories

#### Scenario: regular directories keep existing listing behavior
- **WHEN** client requests initial workspace file tree payload for non-special directories
- **THEN** system SHALL preserve existing listing semantics for non-special directories
- **AND** existing file open and tree rendering flows SHALL remain compatible

### Requirement: Special Directory Expansion Shall Use One-Level On-Demand Fetch
The system SHALL fetch only direct children when a special directory is expanded.

#### Scenario: first expansion triggers single-level child fetch
- **WHEN** user expands a special directory whose child state is unknown
- **THEN** client SHALL call dedicated directory-child query command
- **AND** backend SHALL return only direct child files and directories for the requested path

#### Scenario: nested expansion continues progressively
- **WHEN** user expands a child directory returned from previous fetch
- **THEN** system SHALL fetch next level for that child directory only
- **AND** system MUST NOT recursively fetch the full subtree in one request

#### Scenario: special subtree child not in special-name whitelist still expands progressively
- **WHEN** a directory is returned under a previously expanded special directory (for example `node_modules/@scope`)
- **AND** that directory name itself is not in special directory whitelist
- **THEN** client SHALL still treat it as progressively loadable in current special subtree
- **AND** expanding it SHALL request only its direct children

#### Scenario: repeated expansion reuses cached children
- **WHEN** user collapses and re-expands an already loaded special directory
- **THEN** client SHALL reuse cached child nodes by default
- **AND** system SHALL avoid duplicate fetch unless user triggers refresh

### Requirement: Progressive Loading Failure Must Be Recoverable
The system SHALL fail safely when progressive loading cannot resolve a directory.

#### Scenario: invalid or escaped path is rejected safely
- **WHEN** expansion request contains invalid path traversal or out-of-workspace path
- **THEN** backend SHALL reject request with recoverable error
- **AND** frontend SHALL keep file tree interactive without crash

#### Scenario: directory missing or permission denied
- **WHEN** target directory becomes unavailable during expansion
- **THEN** frontend SHALL show actionable error state for that node
- **AND** user SHALL be able to retry or continue browsing other nodes

### Requirement: Existing Referenced Component Behavior Must Remain Unchanged
The system SHALL preserve behavior of existing referenced components while adding progressive loading.

#### Scenario: git diff and file preview behavior remains unchanged
- **WHEN** user opens file diff or preview from file tree after progressive loading integration
- **THEN** existing git diff and preview components SHALL behave exactly as before
- **AND** integration layer MUST NOT override their default interaction contracts

#### Scenario: tab open and mention insertion remain unchanged
- **WHEN** user opens files in tabs or inserts file mentions from file tree
- **THEN** existing tab and mention insertion behavior SHALL remain unchanged
- **AND** progressive loading SHALL only affect child data acquisition timing

