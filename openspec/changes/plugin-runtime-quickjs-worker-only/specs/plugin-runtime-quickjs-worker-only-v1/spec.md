# plugin-runtime-quickjs-worker-only-v1 Spec Delta

## ADDED Requirements

### Requirement: QuickJS isolate MUST exist only for worker entries

`QuickJsWorkerDriver` MUST 只为 `*-worker` entry 创建 isolate。UI / CLI start MUST 不留下 isolate。对这些 entry 的 `eval` MUST 返回 `plugin-unavailable`。

#### Scenario: notes ui cannot eval

- **WHEN** Notes 激活成功
- **THEN** `notes-worker` isolate MUST 存在
- **AND** 对 `notes-ui` 的 `eval` MUST 失败且错误码为 `plugin-unavailable`

#### Scenario: notes and claude expose two worker isolates

- **WHEN** Notes 与 Claude 都激活
- **THEN** live isolate 数 MUST 为 2
