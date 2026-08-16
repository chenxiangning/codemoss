# plugin-local-stage-envelope-v1 Spec Delta

## ADDED Requirements

### Requirement: local staging MUST stay inside the Manifest envelope

stage MUST 用 Manifest 已声明 capability 做注册信封校验。未声明项 MUST 拒绝，且 lockfile MUST 不变。

#### Scenario: undeclared capability blocks staging

- **WHEN** 对 Notes 传入 `mossx.filesystem.raw`
- **THEN** stage MUST 失败
- **AND** lockfile MUST 为空
