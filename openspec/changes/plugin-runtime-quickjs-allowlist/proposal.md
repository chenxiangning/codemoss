# Proposal: plugin-runtime-quickjs-allowlist

> Wave：1QJ2（插座本体 · QuickJS 只允许 Mossx handshake / SDK）  
> 依赖：1QJ1 isolate + deny-list  
> 论文对齐：未声明依赖直接抛错；Host 只注入 Mossx SDK / IPC bridge。

## Why

1QJ1 只拦了 `require/fs/process/fetch`。`1 + 1`、裸 `eval`、任意脚本仍能过。合同要求 Worker 默认没有 OS/Node，且只暴露 Mossx bridge。本刀把 deny-list 收成 allowlist，仍不嵌 C 引擎。

## 边界

1. `eval` MUST 只接受 `mossx.handshake.*` / `mossx.sdk.*`。
2. 任意 JS（含 `1 + 1`、`eval(`）MUST `permission-denied`。
3. 停 isolate 后仍 `plugin-unavailable`。
4. **禁止**加 rquickjs，禁止产品切流。

## Capabilities

- `plugin-runtime-quickjs-allowlist-v1`
