# engine-claude-host-activate-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST activate the Claude fixture without production adapter

Core MUST 能把 `claude-engine.json` 的 activation unit 交给内存 Host。成功路径 MUST 使 `com.mossx.engine.claude` 进入 `ready`。本路径 MUST NOT 调用生产 `engine::claude` spawn/history API。

#### Scenario: claude fixture becomes ready on FakeDriver

- **WHEN** Host enabled 且 FakeDriver 对 `claude-cli` / `claude-worker` 回报 ready
- **THEN** slot state MUST 为 `ready`
