## MODIFIED Requirements

### Requirement: AppSettings MUST Persist Enabled Curated Skill IDs

`AppSettings` MUST include `enabled_curated_skill_ids: Vec<String>`, serialized to the frontend as `enabledCuratedSkillIds`, and default it to an empty array. The setting MUST persist through the normal settings core and MUST be shared across workspaces for the same client install. Settings normalization MUST trim, de-duplicate, and drop empty or non kebab-case ASCII ids before persisting/restoring the field.

Curated skill id changes MUST participate in Codex restart detection because Codex app-server `developer_instructions` are captured at launch time on healthy launch paths. Restart is required so toggling a curated skill off does not leave stale curated skill instructions in a long-lived app-server process.

Windows wrapper compatibility fallback MAY create a usable degraded session without injecting ccgui-generated curated skill bodies when preserving them through argv would block startup. This fallback MUST NOT mutate `enabledCuratedSkillIds`; the skill remains enabled for healthy paths and for the next restart attempt.

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

#### Scenario: Windows wrapper degraded fallback keeps setting enabled
- **WHEN** `lazy-senior-dev` is enabled
- **AND** Windows wrapper compatibility retry starts a degraded Codex session without ccgui-generated curated skill injection
- **THEN** `enabledCuratedSkillIds` MUST remain unchanged
- **AND** diagnostics MUST explain that built-in curated skill injection was skipped for startup recovery
- **AND** macOS, Linux, Windows direct executable, and healthy Windows wrapper primary launches MUST continue injecting enabled curated skills.

### Requirement: Curated Skill Bodies MUST Be Transported Safely Per Engine Launch Path

Enabled curated skill bodies MUST be available to supported engine launches when the selected launch path can transport them safely. The system MUST avoid placing large ccgui-generated curated skill bodies in Windows wrapper argv when that transport is known to break session startup.

#### Scenario: Codex healthy launch receives enabled curated skills
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Codex app-server launch is macOS, Linux, Windows direct executable, or a Windows wrapper primary launch that initializes successfully
- **THEN** Codex launch args MUST include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`.

#### Scenario: Codex wrapper retry omits generated curated argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Windows wrapper compatibility retry builds Codex app-server launch
- **THEN** retry argv MUST NOT include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`
- **AND** retry argv MUST NOT use `--profile ccgui-generated-instructions`
- **AND** retry diagnostics MUST explain that built-in curated skill injection was skipped for startup recovery.

#### Scenario: user override wins
- **WHEN** user-supplied Codex args already include `developer_instructions=` or `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override
- **AND** wrapper compatibility retry MUST NOT create a competing generated curated-skill transport for that launch.

#### Scenario: Claude Windows wrapper omits curated append argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Claude Code launch resolves to a Windows `.cmd`, `.bat`, or `.ps1` wrapper
- **THEN** Claude launch args MUST NOT include `--append-system-prompt` with the generated curated skill body
- **AND** the user message MUST still be sent through the existing stream-json stdin path
- **AND** macOS, Linux, and Windows direct executable Claude launches MUST keep the existing curated skill append behavior.
