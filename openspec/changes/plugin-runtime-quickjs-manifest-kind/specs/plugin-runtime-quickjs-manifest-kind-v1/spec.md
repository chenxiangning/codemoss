# plugin-runtime-quickjs-manifest-kind-v1 Spec Delta

## ADDED Requirements

### Requirement: QuickJS isolate MUST follow Manifest kind and runtime

`QuickJsWorkerDriver` MUST 只为 Manifest 声明 `kind=worker` 且 `runtime=quickjs` 的 entry 创建 isolate。仅名字以 `-worker` 结尾 MUST NOT 视为 QuickJS 纤程。

#### Scenario: an undeclared worker-named entry has no isolate

- **WHEN** Host start `evil-worker`
- **THEN** live isolate MUST 不包含该 entry

#### Scenario: a declared worker without the suffix gets an isolate

- **WHEN** catalog 声明 `notes-core` 为 `kind=worker` `runtime=quickjs`
- **AND** Host start `notes-core`
- **THEN** 该 entry 的 isolate MUST 存在
