## ADDED Requirements

### Requirement: File View Markdown Preview SHALL Use A Dedicated Renderer
The system SHALL render Markdown files opened from the right-side file tree through a file-preview-specific renderer and MUST NOT route file preview through the message-curtain Markdown renderer.

#### Scenario: markdown file preview is routed to dedicated renderer
- **WHEN** user opens a `*.md` file from the right-side file tree and switches to preview mode
- **THEN** the file view SHALL render the document through a dedicated file-preview Markdown renderer
- **AND** the preview chain MUST NOT depend on `messages/components/Markdown` as its render entry

#### Scenario: mdx file preview follows the file-preview renderer boundary
- **WHEN** user opens a `*.mdx` file from the right-side file tree and switches to preview mode
- **THEN** the file view SHALL keep Markdown preview inside the dedicated file-preview renderer boundary
- **AND** any unsupported MDX-only syntax MUST be handled without falling back to the message-curtain renderer

### Requirement: File View Markdown Preview SHALL Preserve Original Document Structure
The system SHALL treat file Markdown preview as a source-fidelity surface and MUST NOT rewrite document structure for chat readability.

#### Scenario: paragraph boundaries are preserved from source
- **WHEN** a Markdown file contains intentional paragraph breaks and blank lines
- **THEN** the preview SHALL preserve those paragraph boundaries from source
- **AND** the renderer MUST NOT merge fragmented lines or synthesize paragraph joins that are not present in the file

#### Scenario: list indentation is preserved from source
- **WHEN** a Markdown file contains nested lists or mixed ordered and unordered list indentation
- **THEN** the preview SHALL follow the source Markdown structure
- **AND** the renderer MUST NOT apply chat-oriented list auto-correction heuristics that modify the original hierarchy

### Requirement: File View Markdown Preview SHALL Provide A GitHub-Style Reading Baseline
The system SHALL present file Markdown preview with a stable GitHub-style reading baseline for common Markdown elements.

#### Scenario: common block elements follow github-style baseline
- **WHEN** a Markdown file contains headings, paragraphs, blockquotes, horizontal rules, tables, links, and fenced code blocks
- **THEN** the preview SHALL render those elements with a GitHub-style reading baseline
- **AND** the resulting structure SHALL remain readable without requiring message-curtain-specific wrappers

#### Scenario: code blocks remain readable inside file preview
- **WHEN** a Markdown file contains fenced code blocks with or without language hints
- **THEN** the preview SHALL render code blocks with stable spacing, overflow handling, and readable highlighting
- **AND** file preview code blocks MUST NOT inherit message-curtain-only controls or wrappers unless separately specified for file view

### Requirement: File View Markdown Styling SHALL Be Isolated From Message Curtain Styling
The system SHALL scope file-preview Markdown styles and render customizations to the file-view namespace so that message-curtain Markdown remains unaffected.

#### Scenario: file-preview style changes do not alter message markdown
- **WHEN** file-preview Markdown styles are updated to satisfy GitHub-style requirements
- **THEN** message-curtain Markdown rendering SHALL remain visually and structurally unchanged
- **AND** file-preview styles MUST NOT require direct mutation of message-curtain style selectors to take effect

#### Scenario: message renderer remains the active path for message surfaces
- **WHEN** Markdown is rendered inside chat messages, Spec Hub, release notes, or other existing message-based consumers
- **THEN** those surfaces SHALL continue using the existing message Markdown renderer contract
- **AND** they MUST NOT be implicitly migrated to the file-preview renderer by this change
