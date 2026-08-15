# Proposal: plugin-runtime-quickjs-minimal-context

> Wave：1QJ11（插座本体 · Worker QuickJS 只能是 base + Eval）  
> 依赖：1QJ5 真实 Runtime  
> 论文对齐：隔离 = 独立上下文；未声明 intrinsic 是未声明依赖，必须 fail closed。

## Why

1QJ5 用了 `Context::full`。这会注入 Date / JSON / Proxy / MapSet / TypedArrays / Promise / Performance / WeakRef。合同要求普通 Worker 默认没有额外执行面。allowlist 挡公开 eval，挡不住引擎里已经存在的全局对象。

## 边界

1. Worker context MUST 只用 `BaseObjects` + `Eval`。
2. `new Date()` / `JSON.stringify` / `Promise.resolve` MUST 在引擎内失败。
3. `mossx.handshake.hello()` 仍 MUST 可执行。
4. 不切产品。

## Capabilities

- `plugin-runtime-quickjs-minimal-context-v1`
