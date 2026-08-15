# Proposal: plugin-ipc-handshake-nonce

> Wave：1HS1（插座本体 · handshake nonce 每次独立签发）  
> 依赖：1F2 / 1E UDS handshake  
> 论文对齐：handshake 是发射；相同 nonce 重放不是合法获取。

## Why

合同要求 replay protection 与 startup nonce 安全交付。Process / UDS / Named Pipe / Loopback 现在共用写死的 64 个 `a`。旧 generation 的 hello 可以原样重放。

## 边界

1. `issue_handshake_nonce` MUST 产出 64 位 hex，且连续两次不得相同。
2. spawn / UDS / Named Pipe / Loopback handshake MUST 使用当次签发的 nonce。
3. 固定 `aaaaaaaa...` MUST 不得再作为生产 handshake 常量。
4. fixture JSON 仍可用固定 nonce 做 codec 测试。
5. 不切产品。

## Capabilities

- `plugin-ipc-handshake-nonce-v1`
