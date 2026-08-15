# Proposal: plugin-runtime-cross-plugin-handles

> Wave：1AF（插座组装 · 跨插件不得用对方 generation 拿 handle）  
> 依赖：1I 双插头隔离、1M 旧 generation

## Why

1I 已证明两根插头各自 store / stream 隔离。组合面尚未验收「用 Claude generation 去 query Notes」。generation 是 per-slot 计数，两边都可能是 1。必须按 plugin_id + generation 绑定，不得串读。

## 边界

1. Notes 与 Claude 都 Ready 后，用 Claude generation 去 `query_read` / `open_stream` Notes MUST 失败。
2. 用 Notes generation 去 query / stream Notes MUST 成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-cross-plugin-handles-v1`
