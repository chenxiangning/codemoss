# Proposal: plugin-runtime-terminal-lifecycle

> Wave：1AY（插座组装 · fuse / disable 不得跨终端态互跳）  
> 依赖：1AS 未知 lifecycle、1AM Activating 不得 fuse / disable

## Why

Failed / Fused / Disabled 都必须先 reset 再激活。当前 `fuse` / `disable` 仍会覆盖这些终端槽位：Failed 可被 fuse，Disabled 可被 fuse，Fused 可被 disable。1F 后不得用二次生命周期调用洗掉失败原因。

## 边界

1. `fuse` 对已 Fused 幂等成功。
2. `disable` 对已 Disabled 幂等成功。
3. `fuse` 对 Failed / Disabled / Idle MUST 失败（`failed` / `disabled` / `plugin-unavailable`）。
4. `disable` 对 Failed / Fused / Idle MUST 失败（`failed` / `fused` / `plugin-unavailable`）。
5. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-terminal-lifecycle-v1`
