# plugin-ipc-uds-peer-uid-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS accept/connect MUST verify the peer uid

`accept_uds` 与 `connect_uds` MUST 在返回 stream 之前调用 `uds_peer_ok`。对端 uid 不是当前用户时 MUST `permission-denied`。

#### Scenario: current-user peer is accepted

- **WHEN** `uds_peer_ok` 收到当前用户 uid
- **THEN** 校验 MUST 成功

#### Scenario: a foreign uid cannot complete uds handshake

- **WHEN** `uds_peer_ok` 收到一个不等于当前用户的 uid
- **THEN** 校验 MUST 失败且错误码为 `permission-denied`
