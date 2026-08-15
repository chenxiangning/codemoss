# Proposal: plugin-runtime-quickjs-manifest-kind

> Wave：1QJ4（插座本体 · QuickJS isolate 只认 Manifest 声明）  
> 依赖：1QJ3 worker-only  
> 论文对齐：隔离粒度必须等于组件声明；名字不是身份。

## Why

1QJ3 用 `*-worker` 后缀猜纤程。`evil-worker` 这种未声明 entry 也会拿到 isolate；反过来，合法 `kind=worker` + `runtime=quickjs` 但 id 不含 `-worker` 的 entry 会被漏掉。合同要求以 Manifest 为准。

## 边界

1. isolate MUST 只给 fixture / catalog 中 `kind=worker` 且 `runtime=quickjs` 的 entry。
2. 仅名字像 worker 的 entry MUST NOT 建 isolate。
3. 声明过的非 `-worker` 后缀 worker MUST 建 isolate。
4. 不嵌 C 引擎，不切产品。

## Capabilities

- `plugin-runtime-quickjs-manifest-kind-v1`
