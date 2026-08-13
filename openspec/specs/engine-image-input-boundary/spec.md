# engine-image-input-boundary Specification

## Purpose

Defines cross-engine image input transport, history presentation, and filesystem rendering boundaries for Grok, OpenCode, Kimi, Claude, and Codex.
## Requirements
### Requirement: Grok image transport via prompt-file

The runtime MUST launch Grok with `--prompt-file <path>` when the resolved
engine is Grok and the sanitized image list is non-empty. The file content MUST
be ACP content blocks including:

- one `text` block preserving the non-empty user prompt verbatim (or a minimal
  placeholder if text is empty)
- one `image` block per successfully loaded attachment:
  `{ "type": "image", "mimeType": "<mime>", "data": "<base64>" }`

Argv MUST carry only the staging file path (not the base64 JSON body), so large
screenshots are not subject to OS ARG_MAX / former 700KB soft-cap failures.
Text-only Grok turns MUST keep the legacy `-p` path.

#### Scenario: Grok text-only keeps -p

- **WHEN** a Grok send has no non-empty image attachments
- **THEN** the process args MUST include `-p` / `--single` text prompt
- **AND** MUST NOT require `--prompt-file` or `--prompt-json`

#### Scenario: Grok with local image uses prompt-file

- **WHEN** a Grok send includes a readable local image path
- **THEN** the process args MUST include `--prompt-file` followed by a staging path
- **AND** MUST NOT place the ACP JSON body on `--prompt-json` argv
- **AND** the staging file MUST contain an ACP `image` block with base64 data
- **AND** non-empty user text MUST be preserved verbatim in the ACP `text` block

#### Scenario: Grok image load failure is explicit

- **WHEN** all attached image paths are unreadable or oversized
- **THEN** the send MUST fail with a clear load error before spawning a text-only turn

### Requirement: Grok history presentation boundary

History loading MUST separate Grok multimodal user text from persisted image
paths. Grok chat history may store those turns as:

```text
<image_files>
1. /abs/path/to/assets/image-....png
</image_files>

<user_query>
user text
</user_query>
```

History load MUST set message `text` to the user_query body and `images` to the
extracted absolute paths. The canvas MUST NOT render the raw `<image_files>`
wrapper as the user bubble body.

#### Scenario: Grok history with image_files block

- **WHEN** a loaded Grok user line contains `<image_files>` and `<user_query>`
- **THEN** `text` MUST equal the user_query body only
- **AND** `images` MUST contain the listed absolute asset paths

### Requirement: OpenCode image attachment via run --file

When engine is OpenCode and images are non-empty, `opencode run` MUST include
one `--file <absolute-path>` argument per resolved image. Data URLs MUST be
materialized to workspace staging files first.

#### Scenario: OpenCode with local image uses -f

- **WHEN** OpenCode send includes a readable local image
- **THEN** process args MUST include `--file` with that path

### Requirement: Kimi headless image-path injection

Kimi headless image support MUST inject absolute paths and
`<image path="...">` tags into the `-p` prompt after a stable mossx marker, and
MUST instruct the agent to call `ReadMediaFile` (print mode uses
`permission: auto`).

#### Scenario: Kimi with local image rewrites prompt

- **WHEN** Kimi send includes a readable local image
- **THEN** the `--prompt` text MUST include the absolute path
- **AND** MUST include a ReadMediaFile instruction and `<image path>` tag
- **AND** MUST include the mossx injection marker for later strip

### Requirement: Kimi history display boundary

History loading MUST strip the Kimi injection block (marker or legacy English
instruction prefix) and restore paths into `images[]`. The canvas MUST consume
that normalized text and render thumbnails instead of tool-instruction text.
Generic frontend presentation MUST NOT heuristically strip marker-like text
from ordinary user-authored messages.

#### Scenario: Kimi history strips injection

- **WHEN** a loaded Kimi user prompt contains the mossx image-injection marker
- **THEN** message `text` MUST exclude the injection block
- **AND** message `images` MUST list the injected absolute paths

#### Scenario: Ordinary marker-like user text remains intact

- **WHEN** an ordinary user-authored message contains a mossx marker or
  `<image_files>` / `<user_query>` example text
- **THEN** generic frontend presentation MUST preserve that text verbatim

### Requirement: Claude and Codex image transport compatibility

Client and backend gates MUST NOT reject Claude or Codex image payloads.
Codex sync MUST continue to pass images through `params_to_codex_input`.

#### Scenario: Claude/Codex image send is not blocked by capability gate

- **WHEN** engine is `claude` or `codex` and images are non-empty
- **THEN** neither client pre-guard nor backend `require_image_support` rejects the send

### Requirement: Reliable filesystem image rendering

User-message image entries that are absolute filesystem paths MUST carry a
`localPath` for LocalImage fallback. Preview roots MUST include the workspace
and Grok home sessions directory so assets under `~/.grok/sessions/**/assets`
can be inlined when asset-protocol conversion fails.

#### Scenario: Non-ASCII workspace staging path loads via fallback

- **WHEN** a user message image is an absolute path under the workspace
  `.mossx/image-staging` directory
- **THEN** the canvas MUST attempt LocalImage disk fallback with workspaceId
- **AND** MUST NOT leave only a broken empty image frame without fallback

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

