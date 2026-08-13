# engine-image-input-boundary — Delta Spec

## ADDED Requirements

### Requirement: Pi image transport via @file arguments

The runtime MUST pass attached images to Pi CLI as positional `@<absolute path>` arguments (before the prompt argument) when the resolved engine is Pi and the resolved image list is non-empty. The prompt text MUST remain the user-authored text without any injected image marker or read-tool instruction. Data URLs MUST be materialized to files before argument assembly (shared `resolve_existing_image_files` behavior). When all attached images fail resolution, the send MUST fail with a clear error before spawning a text-only turn.

#### Scenario: Pi with local image uses @file argv

- **WHEN** a Pi send includes one or more readable image paths
- **THEN** the process args MUST contain one `@<absolute path>` argument per image, in attachment order, before the prompt argument
- **AND** the prompt argument MUST NOT contain the `mossx:pi-image-attachments` marker or any read-tool instruction text

#### Scenario: Pi image-only send

- **WHEN** a Pi send has empty user text and at least one resolved image
- **THEN** the runtime MUST still pass the `@file` arguments with an empty prompt argument
- **AND** MUST NOT synthesize CLI-only fallback text (Pi's `<file>` prompt wrapper keeps the turn non-empty)

#### Scenario: Pi image resolution failure is explicit

- **WHEN** every attached image path is unreadable or not a regular file
- **THEN** the send MUST fail with a clear resolution error before spawning a text-only turn

### Requirement: Pi history presentation boundary

History loading MUST separate Pi multimodal user text from image references. Pi session JSONL stores `@file` turns as a text block containing `<file name="/abs/path.png">...</file>` wrappers (possibly with processing hints inside) followed by the user text, plus separate image content blocks. History load MUST extract the `name` attribute paths (XML-unescaped, deduped, in document order) as the message `images`, strip the wrappers from the visible text, and MUST NOT project image content blocks' base64 into the UI state. The legacy `<!-- mossx:pi-image-attachments -->` injection format MUST remain parseable for sessions written before this change.

#### Scenario: Pi @file turn parses to text plus image paths

- **WHEN** a Pi user message text contains `<file name="/a/one.png"></file>\n<file name="/a/two.png">[Image resized to 1024x768.]</file>\nlook at these`
- **THEN** history load MUST produce images `["/a/one.png", "/a/two.png"]` and visible text `look at these`

#### Scenario: Pi legacy injection turn still parses

- **WHEN** a Pi user message text contains the `mossx:pi-image-attachments` marker written before this change
- **THEN** history load MUST produce the same text/images split as before this change

#### Scenario: Ordinary text with no file wrapper remains intact

- **WHEN** a Pi user message text contains no `<file name=` wrapper and no injection marker
- **THEN** history load MUST preserve the text verbatim with empty images

### Requirement: Pi image.input capability is supported

The capability matrix fixture MUST declare Pi `image.input` as `supported`, and the generated TypeScript and Rust matrices MUST be regenerated from the fixture in the same change. The composer image-attachment UX MUST accept Pi without code changes once the matrix cell flips.

#### Scenario: composer accepts image attachments for Pi

- **WHEN** the active engine is Pi and the user pastes or drops an image in the composer
- **THEN** the attachment chip MUST be added without the "image not supported" notice
- **AND** `npm run check:engine-capability-matrix` MUST pass with the fixture, TypeScript, and Rust matrices in agreement
