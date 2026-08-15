# Proposal: plugin-ipc-handshake-hello-generation

> Wave：1HS3（插座本体 · handshake hello 必须绑定 generation）  
> 依赖：1HS2 ack 身份绑定  
> 论文对齐：handshake 是发射；旧 generation 的 hello 不是合法获取。

## Why

1HS2 把 ack 绑到 `pluginId` / `generation`。`validate_handshake_hello` 仍只验 nonce 形态。合同 hello 含 `generation`。旧 generation 的 hello 现在仍能通过。

## 边界

1. hello MUST 声明 `generation > 0`，且 MUST 等于 Host 当前 generation。
2. generation 0 / 缺失 / 旧 generation MUST `handshake-rejected`。
3. spawn / UDS / Named Pipe / Loopback / Worker 发出的 hello MUST 带当前 generation。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-hello-generation-v1`
