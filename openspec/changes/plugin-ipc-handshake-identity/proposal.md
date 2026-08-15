# Proposal: plugin-ipc-handshake-identity

> Wave：1HS2（插座本体 · handshake ack 必须绑定 pluginId / generation）  
> 依赖：1HS1 独立 nonce  
> 论文对齐：handshake 是发射；身份必须等于当前纤程，不得借用邻居的 ack。

## Why

1HS1 修了 nonce 重放。`validate_handshake_ack` 仍只比 nonce。Notes 的 hello 可以收下 Claude 的 ack，只要 nonce 碰巧对上。合同要求 handshake identity。

## 边界

1. ack MUST 回显当次 nonce，且 `pluginId` / `generation` MUST 等于 Host 当前激活。
2. `pluginId` MUST 是 reverse-DNS；`generation` MUST > 0。
3. 错 plugin / 错 generation MUST `handshake-rejected`。
4. spawn / UDS / Named Pipe / Loopback MUST 传入当前身份。
5. 不切产品。

## Capabilities

- `plugin-ipc-handshake-identity-v1`
