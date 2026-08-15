# plugin-host-boot-uds-supervisor-v1 Spec Delta

## ADDED Requirements

### Requirement: boot Host MUST own a private UDS supervisor socket

Unix `boot_host()` MUST 绑定一条 0600 私有 UDS，父目录恰好 0700。Host 仍 MUST 默认 off。activate Notes / Claude MUST `host-disabled`，MUST NOT 留下 process / isolate。BootHost drop MUST unlink 该 socket。

#### Scenario: boot owns a private supervisor socket

- **WHEN** Unix 上调用 `boot_host()`
- **THEN** supervisor path MUST 存在
- **AND** socket MUST 是 0600
- **AND** 父目录 MUST 是 0700

#### Scenario: a disabled boot supervisor cannot activate notes

- **WHEN** 对带 supervisor 的 boot Host activate Notes
- **THEN** 它 MUST `host-disabled`
- **AND** process / worker live_count MUST 都是 0

#### Scenario: dropping boot unlinks the supervisor socket

- **WHEN** BootHost drop
- **THEN** supervisor path MUST 不存在
