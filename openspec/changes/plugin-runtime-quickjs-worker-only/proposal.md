# Proposal: plugin-runtime-quickjs-worker-only

> Wave：1QJ3（插座本体 · 只有 Worker entry 才有 QuickJS isolate）  
> 依赖：1QJ1 isolate、1QJ2 allowlist  
> 论文对齐：隔离粒度必须等于组件粒度；UI / Process 不是 QuickJS 纤程。

## Why

`QuickJsWorkerDriver::start` 给每个 required entry 开 isolate。Notes 的 `notes-ui`、Claude 的 `claude-cli` 因此拿到 JS 执行面。合同规定只有 `kind=worker` + `runtime=quickjs` 才进 QuickJS。

## 边界

1. 仅 `*-worker` entry MUST 创建 isolate。
2. UI / CLI start MUST 成功且 MUST NOT 留下 isolate。
3. 对 UI entry `eval` MUST `plugin-unavailable`。
4. 不嵌 C 引擎，不切产品。

## Capabilities

- `plugin-runtime-quickjs-worker-only-v1`
