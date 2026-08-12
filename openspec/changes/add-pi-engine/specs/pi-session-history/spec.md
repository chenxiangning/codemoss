## ADDED Requirements

### Requirement: PI session history IO

The system MUST list, load, and delete PI sessions under the agent sessions directory (`~/.pi/agent/sessions` or env overrides).

#### Scenario: List by workspace

- **WHEN** list_pi_sessions is called with a workspace path
- **THEN** only sessions whose header cwd matches the workspace are returned

#### Scenario: Load transcript

- **WHEN** load_pi_session is called with a valid session id
- **THEN** user, assistant, reasoning, and tool rows are returned in order
