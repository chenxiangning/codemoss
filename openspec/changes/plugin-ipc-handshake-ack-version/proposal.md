# Proposal: plugin-ipc-handshake-ack-version

> Wave：1HS9（插座本体 · handshake ack 必须绑定 plugin version）  
> 依赖：1HS2 ack pluginId / generation  
> 论文对齐：handshake 是发射；未声明版本的对端不是合法获取。

## Why

合同写明 ack 必须声明 `pluginId/version/generation`。`validate_handshake_ack` 现在只核 pluginId 与 generation。缺 `version` 或回 `9.9.9` 仍可通过。

## 边界

1. `validate_handshake_ack` MUST 要求 `result.version` 等于当前 Manifest version。
2. 缺失 / 空 / 漂移 version MUST `handshake-rejected`。
3. spawn / UDS / Named Pipe / Loopback / Worker MUST 传入当前 version。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-ack-version-v1`
