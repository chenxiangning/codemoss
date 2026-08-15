# plugin-storage-checkpoint-v1 Spec Delta

## ADDED Requirements

### Requirement: updates MUST checkpoint before migrate

`checkpoint.required=true` 时，migrate MUST 先有已校验 checkpoint。`retainPrevious` MUST 在 1–5，默认 2。restore MUST 回到最近一次 checkpoint 的 schema。

#### Scenario: migrate without checkpoint is rejected

- **WHEN** namespace 没有已校验 checkpoint
- **THEN** migrate MUST 返回 `checkpoint-required`
