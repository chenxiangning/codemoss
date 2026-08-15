# Proposal: plugin-runtime-stream-exists

> Wave：1AC（插座组装 · 组合面拒绝重复 stream_id）  
> 依赖：1E4 DataPlane `stream-exists`、1AA stream budget

## Why

DataPlane 已拒绝重复 `stream_id`。组合面尚未独立验收。1F 后同一 generation 不得复用已开 stream 的 id 覆盖 codec。

## 边界

1. Ready Notes 对同一 `stream_id` 第二次 `open_stream` MUST `stream-exists`。
2. 第一次 MUST 成功，codec 保持不变。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-stream-exists-v1`
