# Proposal: plugin-runtime-ready-swap

> Wave：1Y（插座组装 · Ready 再激活换 generation 并撤销旧 handle）  
> 依赖：1M 旧 generation 失效、1G DataPlane generation-bound

## Why

合同：generation 切换撤销全部 handle。Ready 插件目前能直接再 activate。组合面尚未验收「旧 stream / query 失效」。1F 后热换不得让旧 generation 继续读 workspace 或写 DataPlane。

## 边界

1. Ready Notes 再 activate MUST 得到更大 generation。
2. 旧 generation 的 `query_read` / `open_stream` MUST 失败。
3. 旧 stream MUST 被撤销。
4. 新 generation 的 query / stream MUST 成功。
5. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-ready-swap-v1`
