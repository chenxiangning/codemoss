# browser-agent-page-understanding Delta

## MODIFIED Requirements

### Requirement: Composer preview shows the actual browser context

Browser Agent Page Understanding SHALL expose a composer preview of the exact attachment that will be sent. When the attachment contains selected elements, the preview SHALL use the same excerpt fold as the sent-message summary: a one-line header `网页摘录 N` plus page title, default title-only rows, and expand-to-full-text plus send details. Refresh and remove actions SHALL remain available. Full-page snapshot attach MAY keep a compact fold with a snapshot row.

#### Scenario: User attaches selected page excerpts

- **WHEN** the user selects one or more page elements into the current Composer attachment
- **THEN** the composer SHALL show a fold header with excerpt count and page title
- **AND** each selected element SHALL appear as a one-line title row
- **AND** the preview SHALL NOT lead with unrelated full-page snapshot text

#### Scenario: User removes browser context

- **WHEN** the user removes the browser context attachment
- **THEN** the next AI request SHALL NOT include the removed browser snapshot

### Requirement: Selector prefers precise semantic targets

Selector mode SHALL promote the pointer hit to the nearest reasonable content unit (link, button, heading, paragraph, list item, table cell, image, or form control) and SHALL avoid `html`, `body`, `main`, `section`, `ul`/`ol`, and oversized generic containers when a better child unit exists. The hover card SHALL show a human kind label and excerpt text, and SHALL still include programmer debug metadata: tag, role, viewport size, viewport xy, document xy, and page title.

#### Scenario: Selector prefers content units over nested spans

- **WHEN** the pointer is over nested page content
- **THEN** selector mode SHALL prefer the smallest visible semantic content unit under the pointer
- **AND** selector mode SHALL avoid broad layout containers when a better child candidate is available

#### Scenario: Hover card keeps programmer debug facts

- **WHEN** selector mode highlights a candidate
- **THEN** the hover card SHALL include the excerpt label and a compact debug line with tag, role, box size, viewport origin, and document origin
- **AND** the page title or hostname SHALL remain visible

### Requirement: Selected element preview stays focused after injection

When a selector-created attachment is shown above Composer or as a sent-message summary, the primary surface SHALL be the excerpt fold. Default rows SHALL be one-line titles. Expanding a row SHALL reveal the sent text and send details (document position, viewport box, list index, previous/next, ancestor, cssPath or selector, element meta, source URL). Broad page summary, primary content, readable blocks, and page counts SHALL remain out of the default selected-element surface.

#### Scenario: Sent excerpt fold expands send details

- **WHEN** the user expands a selected excerpt row after send
- **THEN** the row SHALL show send details used in the model payload
- **AND** it SHALL NOT dump the full-page snapshot as the default expanded body

#### Scenario: Repeat clicks do not stack duplicate excerpts

- **WHEN** the user selects the same element identity again (same selector hint and normalized text)
- **THEN** the attachment SHALL replace the existing row in place
- **AND** the composer and sent summary SHALL show one row for that identity

## ADDED Requirements

### Requirement: Selected element payload locates the pointed target for the model

The canonical BrowserContextAttachment v2 formatter SHALL include a locate block for each selected element: document coordinates (`scroll + viewport box`), viewport box, optional list index/length, previous/next sibling text, ancestor label, and cssPath. The usage hint SHALL instruct the model to treat that target as the subject of the question. Neighbor and ancestor text SHALL pass existing sanitization. Screenshot or crop image SHALL NOT be required for this locate contract.

#### Scenario: Model prompt includes pointed-target locate facts

- **WHEN** the user sends a message with one or more selected page elements
- **THEN** each `selectedElements` entry SHALL include text, documentPosition, viewportBox, and cssPath or selector
- **AND** when list or sibling context exists it SHALL include `inList`, `previous`, and `next`
- **AND** the usage hint SHALL tell the model to answer the pointed target first

#### Scenario: Legacy selected annotations still expose document coordinates

- **WHEN** a historical selected annotation has region and viewport scroll but no locate object
- **THEN** the summary and prompt SHALL still derive documentPosition from region plus scroll
- **AND** missing neighbor fields SHALL be omitted rather than fabricated
