# Proposal: plugin-runtime-disabled-until-reset

> Wave：2X（插座组装 · Disabled 必须先 reset 才能再激活）  
> 依赖：1W Failed-until-reset、1B2 Host disable

## Why

Fused / Failed 已要求 reset。Host disable 也已挡再激活。组合面尚未独立验收。1F 后 disable-not-delete 不得被直接 `activate` 绕过。

## 边界

1. `disable_plugin` 后直接 `activate` MUST `disabled`。
2. 不进 boot，不 spawn，不删产品代码。

## Capabilities

- `plugin-runtime-disabled-until-reset-v1`
