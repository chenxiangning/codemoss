# plugin-ipc-process-fds-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process MUST NOT inherit extra parent FDs

Unix spawn MUST 在 `exec` 前关闭 `fd >= 3`。子进程若仍看见额外 FD，MUST 不得完成 handshake。

#### Scenario: a leaked parent fd cannot complete handshake

- **WHEN** Host 在 spawn 前打开一个额外 FD
- **AND** 激活 Claude process handshake
- **THEN** 子进程 MUST 不得看见该 FD
- **AND** handshake MUST 仍能完成
- **AND** live child 必须为 1
