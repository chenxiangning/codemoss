# Proposal: plugin-runtime-failed-until-reset

> Wave：1W（插座组装 · Failed 必须先 reset 才能再激活）  
> 依赖：1T Failed 不得拿 handle、1V Failed 后 reset 恢复

## Why

Fused / Disabled 已要求 reset。Failed 目前还能直接再 activate，会跳过 reset 协议、generation 偷偷前进。1F 后半激活失败的插件必须显式 reset。

## 边界

1. timeout 进入 Failed 后，直接 activate MUST `failed`。
2. reset 后再 activate 才允许（1V 已覆盖成功路径）。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-failed-until-reset-v1`
