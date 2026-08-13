# Delta: intent-canvas-workspace-files

## ADDED Requirements

### Requirement: Canvas list SHALL group entries into time eras with a left rail

The manager list view SHALL group canvas index entries by `updatedAt` into ordered eras rendered with a left vertical rail: the current calendar week (「本周」), one era per calendar month for entries newer than the stale threshold (60 days), and a 「更早」 era for entries at or beyond the stale threshold. Eras with no entries SHALL NOT be rendered. Entries within an era SHALL be ordered by `updatedAt` descending.

#### Scenario: Current week era

- **GIVEN** canvas entries whose `updatedAt` falls inside the current calendar week (Monday-start, local timezone)
- **WHEN** the manager list renders
- **THEN** those entries appear under the first era labeled 本周
- **AND** that era's rail tick uses the accent fill
- **AND** the rail shows the aggregate count of canvases and summed element count.

#### Scenario: Monthly eras

- **GIVEN** canvas entries older than the current week but newer than 60 days
- **WHEN** the manager list renders
- **THEN** they are grouped into one era per calendar month labeled by month
- **AND** monthly eras are ordered most-recent first.

#### Scenario: Stale era

- **GIVEN** canvas entries whose `updatedAt` is 60 or more days before now
- **WHEN** the manager list renders
- **THEN** they appear under the final era labeled 更早
- **AND** that era's rail line is dashed
- **AND** its cards render at reduced opacity and restore full opacity on hover.

#### Scenario: Search filtering with eras

- **GIVEN** an active search query
- **WHEN** the filtered result set leaves an era without entries
- **THEN** that era is hidden
- **AND** the topbar subtitle reflects the filtered canvas count.

### Requirement: Canvas cards SHALL present a thumbnail, single-line body, and single-line footer

Each canvas card in the list SHALL render a thumbnail area, a body with single-line title and summary (overflow ellipsized), and a footer containing the mode badge, the inline `elements·files·nodes` statistics, and a relative update time. Cards without a cached thumbnail SHALL render a placeholder dashed graphic instead of triggering document loads.

#### Scenario: Cached thumbnail

- **GIVEN** an index entry carrying a cached thumbnail
- **WHEN** the card renders
- **THEN** the cached SVG is shown in the thumbnail area without reading the canvas document.

#### Scenario: Missing thumbnail

- **GIVEN** an index entry without a cached thumbnail (legacy or over-budget)
- **WHEN** the card renders
- **THEN** a placeholder dashed graphic is shown
- **AND** no document read is performed for thumbnail purposes.

#### Scenario: Footer content

- **GIVEN** any canvas card
- **WHEN** it renders
- **THEN** the footer shows the mode badge (Architect / Spotlight / File), the inline statistics `elementCount·linkedFileCount·linkedProjectMapNodeCount`, and a relative time (今天 HH:mm, 昨天, N 天前, or M月D日).

### Requirement: Stale era SHALL surface governance signals and group selection

The 更早 era SHALL display a cleanup hint and a select-era action. Cards in the stale era SHALL display at most one stale badge, chosen by priority: 锚点失效 (unresolved or stale semantic anchors) over 空图 (element count at or below the empty-graph threshold) over N 天未动 (days since `updatedAt`). Anchor health SHALL be detected lazily by reading only stale-era documents with bounded concurrency, and read failures SHALL fall back to the next badge silently.

#### Scenario: Select entire stale era

- **GIVEN** the 更早 era contains one or more canvases
- **WHEN** the user activates 全选本组
- **THEN** all entries of that era are added to the existing selection set
- **AND** the existing bulk toolbar and delete confirmation flow apply unchanged.

#### Scenario: Stale badge priority

- **GIVEN** a stale-era canvas that is both long-inactive and has unresolved anchors
- **WHEN** its card renders after anchor detection completes
- **THEN** only the 锚点失效 badge is shown.

#### Scenario: Anchor detection failure

- **GIVEN** a stale-era canvas document that fails to load
- **WHEN** anchor health cannot be determined
- **THEN** the card falls back to the 空图 or N 天未动 badge without surfacing an error.

### Requirement: Canvas index MAY cache a bounded thumbnail at save time

When a canvas document is saved through the manager, the system MAY generate a static SVG thumbnail from the scene and store it as an optional index entry field. The cached thumbnail SHALL exclude deleted elements and inlined binary image data, SHALL cover at most 80 elements, and SHALL be dropped when the serialized SVG exceeds 8KB. Index files written by older versions without the field SHALL load unchanged.

#### Scenario: Thumbnail generated on save

- **GIVEN** a canvas saved with a scene within the element and size budgets
- **WHEN** the index is written
- **THEN** the entry carries the thumbnail for subsequent list renders.

#### Scenario: Over-budget scene

- **GIVEN** a canvas whose thumbnail exceeds the element or size budget
- **WHEN** the index is written
- **THEN** the entry is saved without a thumbnail
- **AND** the save itself succeeds.

#### Scenario: Legacy index entry

- **GIVEN** an index file written before thumbnail caching existed
- **WHEN** the manager loads it
- **THEN** entries load without error and render placeholder thumbnails.
