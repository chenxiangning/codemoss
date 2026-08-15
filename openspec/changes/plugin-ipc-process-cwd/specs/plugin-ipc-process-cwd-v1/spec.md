# plugin-ipc-process-cwd-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process cwd MUST be the plugin-data directory

spawn MUST 把 child `cwd` 设为 `{data_root}/plugin-runtime/data/{plugin_id}`。相对路径、父目录穿越或其他目录 MUST 不得留下 child。

#### Scenario: plugin-data cwd is accepted

- **WHEN** `process_cwd_ok` 收到 `{root}/plugin-runtime/data/com.mossx.engine.claude`
- **THEN** 校验 MUST 成功

#### Scenario: a parent or workspace cwd cannot leave a child

- **WHEN** cwd 是相对路径、含 `..`，或不是该 plugin 的 plugin-data 目录
- **THEN** `process_cwd_ok` MUST 失败
