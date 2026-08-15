# plugin-host-boot-uds-live-v1 Spec Delta

## ADDED Requirements

### Requirement: a disabled boot supervisor MUST reject connectors while the host is alive

Unix `boot_host()` MUST 启动值守线程。客户端 connect 后 MUST 在 handshake deadline 内收到 `host-disabled`，无需调用 `reject_unexpected`。MUST NOT 激活任何纤程。BootHost drop MUST 停线程并 unlink socket。

#### Scenario: a live supervisor rejects a connector without an explicit drain

- **WHEN** Unix 上 `boot_host()` 后客户端连上 supervisor
- **THEN** 客户端 MUST 读到 `host-disabled`
- **AND** process / worker live_count MUST 都是 0

#### Scenario: dropping a live supervisor still unlinks

- **WHEN** 值守中的 BootHost drop
- **THEN** supervisor path MUST 不存在
