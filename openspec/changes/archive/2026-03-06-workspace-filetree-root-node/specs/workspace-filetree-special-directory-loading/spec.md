## MODIFIED Requirements

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
