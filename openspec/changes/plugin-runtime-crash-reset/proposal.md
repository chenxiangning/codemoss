# Proposal: plugin-runtime-crash-reset

> Wave：1AI（插座组装 · crash 后 reset 恢复 handle）  
> 依赖：1U crash 后不得拿 handle、1V timeout 后 reset、1W Failed-until-reset

## Why

1V 已证明 timeout → Failed → reset → activate 可恢复。crash 走 `activation-failed`，1W 后也不能直接再激活。组合面尚未独立验收这条恢复路径。1F 后崩溃的半激活插件必须能 reset，否则永久死锁。

## 边界

1. crash → reset → 清 fail_on → activate 后 query / stream / store MUST 成功。
2. 新 generation MUST 大于失败那次。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-crash-reset-v1`
