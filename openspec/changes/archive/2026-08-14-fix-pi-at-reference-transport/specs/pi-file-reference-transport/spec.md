## ADDED Requirements

### Requirement: Pi prompt-text @file reference extraction

The runtime MUST scan the Pi prompt text for `@<path>` tokens at token boundaries (start of text or after whitespace) before spawning `pi --print --mode json`. A token whose path resolves (absolute, or relative to the workspace) to an existing regular file MUST be passed as a positional `@<absolute path>` argument placed before the prompt argument, and MUST be removed from the prompt text. Path matching MUST use greedy longest-prefix matching against the filesystem so paths containing spaces resolve correctly. Reference arguments MUST be deduplicated against image `@file` arguments by absolute path.

#### Scenario: Leading @file reference is extracted to argv

- **WHEN** a Pi send text is `@/abs/design.md 总结一下` and `/abs/design.md` is a regular file
- **THEN** process args MUST include `@/abs/design.md` before the prompt argument
- **AND** the prompt argument MUST equal `总结一下` (or otherwise MUST NOT contain the extracted token)
- **AND** the prompt argument MUST NOT start with `@`

#### Scenario: Reference path with spaces resolves greedily

- **WHEN** a Pi send text contains `@/abs/shot one.png` and `/abs/shot one.png` is a regular file
- **THEN** process args MUST include `@/abs/shot one.png` as a single argument

#### Scenario: Relative reference resolves against workspace

- **WHEN** a Pi send text contains `@docs/a.md` and `<workspace>/docs/a.md` is a regular file
- **THEN** process args MUST include `@<workspace>/docs/a.md`

#### Scenario: Reference deduplicated against image attachment

- **WHEN** a Pi send includes image `/abs/a.png` and the text also references `@/abs/a.png`
- **THEN** process args MUST contain exactly one `@/abs/a.png` argument

### Requirement: Pi unresolvable @ token degradation

Tokens starting with `@` that do not resolve to an existing regular file — including folders, missing paths, and non-path mentions — MUST remain in the prompt text verbatim. The send MUST NOT fail because of such tokens. After extraction, if the final prompt argument would still start with `@`, the runtime MUST prefix it so the Pi CLI argv parser does not treat the whole prompt as a file argument.

#### Scenario: Folder reference stays as plain text

- **WHEN** a Pi send text is `@/abs/dir 看一下` and `/abs/dir` is a directory
- **THEN** process args MUST NOT include `@/abs/dir` as a file argument
- **AND** the prompt text MUST still contain `/abs/dir`
- **AND** the prompt argument MUST NOT start with `@`

#### Scenario: Missing path stays as plain text without failing the turn

- **WHEN** a Pi send text references `@/abs/missing.md` which does not exist
- **THEN** the send MUST NOT fail during command construction
- **AND** the prompt text MUST still contain the reference text

#### Scenario: Non-path @ mention is preserved

- **WHEN** a Pi send text contains `@teammate 帮忙看下`
- **THEN** the prompt text MUST contain `@teammate 帮忙看下` and no `@` file argument is added

### Requirement: Pi text-only regression boundary

A Pi send whose text contains no `@` token MUST produce identical argv to the pre-change behavior: no `@` file arguments are added and the prompt text is passed through unchanged.

#### Scenario: Plain text send unchanged

- **WHEN** a Pi send text contains no `@` token and no images
- **THEN** process args MUST NOT include any argument starting with `@`
