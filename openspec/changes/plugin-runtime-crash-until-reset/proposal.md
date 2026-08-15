# Proposal: plugin-runtime-crash-until-reset

> Wave：1AJ（插座组装 · crash Failed 必须先 reset 才能再激活）  
> 依赖：1W timeout Failed-until-reset、1U crash 后不得拿 handle

## Why

1W 已锁 timeout 进入 Failed 后不得直接 activate。crash 走同一 Failed 槽位，组合面尚未独立验收。1F 后崩溃插件不得跳过 reset 偷偷换 generation。

## 边界

1. crash 进入 Failed 后，直接 activate MUST `failed`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-crash-until-reset-v1`
