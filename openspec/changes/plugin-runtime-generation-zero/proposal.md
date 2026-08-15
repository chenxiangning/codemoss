# Proposal: plugin-runtime-generation-zero

> Wave：1AR（插座组装 · generation 0 永远不是 live handle）  
> 依赖：1Q never-activated query/stream

## Why

Idle slot 的 generation 为 0。合同：只有成功 activate 后的单调 generation 才是 live handle。组合面尚未独立拒绝 `query` / `open_stream(..., 0)`。1F 后不得用 0 冒充未激活或刚 reset 的插头。

## 边界

1. `generation=0` 的 `query` / `open_stream` MUST `stale-generation`。
2. Ready 插件用 0 也不得成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-generation-zero-v1`
