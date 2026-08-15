# Proposal: plugin-runtime-stream-budget

> Wave：1AA（插座组装 · 每 generation 最多 8 条 stream）  
> 依赖：1E4 DataPlane、1G 组合面 open_stream

## Why

合同冻结：Open streams / generation 默认 8、最小 1、硬上限 16。DataPlane 目前只拒重复 stream_id，不数 generation。1F 后一条插件不得无限开流占住 plane。

## 边界

1. 同一 plugin + generation 第 9 条 `open_stream` MUST `stream-budget`。
2. 前 8 条 MUST 成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-stream-budget-v1`
