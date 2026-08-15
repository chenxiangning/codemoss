# plugin-host-composite-driver-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST dispatch entries by Manifest kind

`CompositeDriver` MUST 把 `kind=process` 交给 Restricted Process，把 `kind=worker` + `runtime=quickjs` 交给 QuickJS。UI / 未声明 entry MUST 两边都不留下效应。

#### Scenario: claude owns one process and one isolate

- **WHEN** Claude 用 CompositeDriver 激活
- **THEN** process live_count MUST 为 1
- **AND** worker live_count MUST 为 1

#### Scenario: notes owns only a worker isolate

- **WHEN** Notes 用 CompositeDriver 激活
- **THEN** process live_count MUST 为 0
- **AND** worker live_count MUST 为 1

#### Scenario: disable revokes both fibers

- **WHEN** Claude Ready 后 disable
- **THEN** process 与 worker live_count MUST 都为 0
