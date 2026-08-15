# notes-plugin-host-activate-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST activate the Notes fixture without production storage

Core MUST 能把 `notes-pilot.json` 的 `notes-main` unit 交给内存 Host。成功路径 MUST 使 `com.mossx.notes` 进入 `ready`。本路径 MUST NOT 调用 `note_cards` 读写 API，MUST NOT 写入产品 Notes 目录。

#### Scenario: notes fixture becomes ready on FakeDriver

- **WHEN** Host enabled 且 FakeDriver 对 `notes-worker` / `notes-ui` 回报 ready
- **THEN** slot state MUST 为 `ready`
