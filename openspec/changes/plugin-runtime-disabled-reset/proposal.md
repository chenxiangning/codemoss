# Proposal: plugin-runtime-disabled-reset

> Wave：2Y（插座组装 · Disabled 后 reset 恢复 handle）  
> 依赖：2X Disabled-until-reset、1L fuse-reset、1V Failed-reset

## Why

1L / 1V 已证明 fuse / Failed 后 reset 可恢复。Disabled 是 disable-not-delete 主路径，组合面尚未独立验收 query / stream / store 恢复。

## 边界

1. disable → reset → activate 后 query / stream / store MUST 成功。
2. 新 generation MUST 大于 disable 前。
3. 不进 boot，不 spawn，不删产品代码。

## Capabilities

- `plugin-runtime-disabled-reset-v1`
