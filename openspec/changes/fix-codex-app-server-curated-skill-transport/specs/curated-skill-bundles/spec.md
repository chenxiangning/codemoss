## MODIFIED Requirements

### Requirement: AppSettings MUST Persist Enabled Curated Skill IDs

`AppSettings` MUST include `enabled_curated_skill_ids: Vec<String>`, serialized to the frontend as `enabledCuratedSkillIds`, and default it to an empty array. The setting MUST persist through the normal settings core and MUST be shared across workspaces for the same client install. Settings normalization MUST trim, de-duplicate, and drop empty or non kebab-case ASCII ids before persisting/restoring the field.

Curated skill id changes MUST participate in Codex restart detection because Codex app-server `developer_instructions` are captured at launch time on macOS/Linux launch paths and at turn start on Windows paths. Restart is required so toggling a curated skill off does not leave stale curated skill instructions in a long-lived app-server process.

Windows launch paths MUST avoid injecting ccgui-generated curated skill bodies through process argv when preserving them through argv would block startup. This MUST NOT mutate `enabledCuratedSkillIds`; the skill remains enabled and MUST be made available to Codex turns through JSON-RPC settings.

#### Scenario: missing field defaults empty
- **WHEN** an existing config file does not contain `enabledCuratedSkillIds`
- **THEN** restore MUST succeed
- **AND** the field MUST default to an empty array.

#### Scenario: toggle persists
- **WHEN** the user enables `lazy-senior-dev`
- **THEN** `enabledCuratedSkillIds` MUST include `lazy-senior-dev`
- **AND** the value MUST be restored after app restart.

#### Scenario: curated toggle requires Codex restart
- **WHEN** `enabledCuratedSkillIds` changes
- **THEN** `app_settings_change_requires_codex_restart` MUST return true
- **AND** the next healthy Codex app-server launch MUST use the updated curated skill set.

#### Scenario: Windows launch keeps setting enabled and avoids startup argv
- **WHEN** `lazy-senior-dev` is enabled
- **AND** Windows Codex app-server launch starts without ccgui-generated curated skill argv
- **THEN** `enabledCuratedSkillIds` MUST remain unchanged
- **AND** the next Codex turn MUST include the enabled curated skill body through `turn/start.collaborationMode.settings.developer_instructions`
- **AND** macOS and Linux launch paths MUST continue injecting enabled curated skills through launch-time `developer_instructions` when no user override exists.

### Requirement: Curated Skill Bodies MUST Be Transported Safely Per Engine Launch Path

Enabled curated skill bodies MUST be available to supported engine launches when the selected launch path can transport them safely. The system MUST avoid placing large ccgui-generated curated skill bodies in Windows argv when that transport is known to break session startup.

#### Scenario: Codex macOS/Linux launch receives enabled curated skills
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Codex app-server launch is macOS or Linux
- **THEN** Codex launch args MUST include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`.

#### Scenario: Codex Windows launch omits generated curated argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Windows builds Codex app-server launch args
- **THEN** launch argv MUST NOT include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`
- **AND** launch argv MUST NOT use `--profile ccgui-generated-instructions`.

#### Scenario: Codex Windows turns receive enabled curated skills
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** a Codex turn starts on Windows with collaboration mode support
- **THEN** `turn/start.collaborationMode.settings.developer_instructions` MUST include `<skill id="lazy-senior-dev">`
- **AND** it MUST also preserve existing execution policy developer instructions.

#### Scenario: user override wins
- **WHEN** user-supplied Codex args already include `developer_instructions=` or `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override
- **AND** wrapper compatibility retry MUST NOT create a competing generated curated-skill transport for that launch.

#### Scenario: Claude Windows omits curated append argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Claude Code launch runs on Windows
- **THEN** Claude launch args MUST NOT include `--append-system-prompt` with the generated curated skill body
- **AND** the user message MUST still be sent through the existing stream-json stdin path
- **AND** macOS and Linux Claude launches MUST keep the existing curated skill append behavior.
