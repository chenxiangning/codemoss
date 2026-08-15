# Proposal: plugin-runtime-brokered-denied

> Wave：1AD（插座组装 · 组合面拒绝其余 V1 brokered capability）  
> 依赖：1R 只读 Broker、1S 未知 capability

## Why

1R / 1S 已拒绝 write / spawn / `filesystem.raw`。合同还有 `mossx.git.read`、`mossx.git.write`、`mossx.network.fetch`、`mossx.storage.readwrite`。V1 只读 Broker 不得授权它们。1F 后 Ready 插件不得凭这些 id 摸 git / 网络 / 跨 store。

## 边界

1. Ready Notes 查询上述四个 capability MUST `permission-denied`。
2. `mossx.workspace.read` MUST 仍成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-brokered-denied-v1`
