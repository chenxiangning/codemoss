# Proposal: plugin-runtime-canonical-identity

> Wave：1BE（插座组装 · 未 trim 的身份不得过闸）  
> 依赖：1AO / 1AQ / 1AV / 1AW / 1BA / 1BC 空白身份

## Why

空白 id 已返回 `schema`。`" com.mossx.notes "` 仍会占槽；`" mossx.workspace.read "` 与 `" com.mossx.notes "` target 会伪装成 `permission-denied`。1F 后不得用带空白的身份开握手或 namespace。

## 边界

1. pluginId / unitId / required entry / capability / store target 含前后空白 MUST `schema`。
2. 不得写入 slot。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-canonical-identity-v1`
