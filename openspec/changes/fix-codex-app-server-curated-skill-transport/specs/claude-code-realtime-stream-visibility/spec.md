## ADDED Requirements

### Requirement: Claude Windows Launch MUST Avoid Curated Skill Body Argv

Claude Code launch MUST keep stream-json stdin prompt delivery intact and MUST avoid placing large ccgui-generated curated skill bodies in Windows argv.

#### Scenario: Windows skips curated append system prompt
- **WHEN** a Claude Code send runs on Windows
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the launched command MUST NOT include `--append-system-prompt` with the generated curated skill body
- **AND** the user message MUST still be sent through `--input-format stream-json` stdin

#### Scenario: non-wrapper Claude launch preserves curated skills
- **WHEN** a Claude Code send runs on macOS or Linux
- **AND** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the launched command MUST keep the existing `--append-system-prompt` curated skill injection behavior
