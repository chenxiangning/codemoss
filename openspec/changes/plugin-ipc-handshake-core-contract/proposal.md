# Proposal: plugin-ipc-handshake-core-contract

> Wave：1HS6（插座本体 · handshake hello 必须绑定 coreContract 1.0.0）  
> 依赖：1HS3 hello generation  
> 论文对齐：handshake 是发射；major 不匹配不得获取。

## Why

合同写明 hello 带 `coreContract`，major 不匹配则拒绝激活。`validate_handshake_hello` 现在只核 protocolVersion / nonce / generation。缺字段或 `2.0.0` 仍可通过。

## 边界

1. `CORE_CONTRACT` MUST 为 `1.0.0`。
2. hello 缺 `coreContract` / 不是 `1.0.0` MUST `handshake-rejected`。
3. `2.0.0` / 空字符串 MUST 不得开始 handshake。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-core-contract-v1`
