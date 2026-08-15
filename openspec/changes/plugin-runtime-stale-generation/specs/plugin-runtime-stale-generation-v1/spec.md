# plugin-runtime-stale-generation-v1 Spec Delta

## ADDED Requirements

### Requirement: a stale generation MUST NOT receive composed handles after reset

当 plugin 已经以更新的 generation ready 时，旧 generation 的 Broker read 与 `open_stream` MUST 失败。新 generation MUST 成功。

#### Scenario: old generation is rejected after reset activate

- **WHEN** plugin 先以 generation N activate，再 fuse / reset / activate 得到 N+1
- **THEN** 以 N 调用 query / open_stream MUST 失败
- **AND** 以 N+1 调用 MUST 成功
