# Proposal: plugin-runtime-provider-denied

> Wave：1AE（插座组装 · 组合面拒绝 provider / slot / 私有 capability）  
> 依赖：1AD 其余 brokered 拒绝

## Why

V1 Broker 只授权 `mossx.workspace.read`。合同还冻结了 provider、slot 与 `<pluginId>.*` 私有面。组合面尚未独立验收。1F 后 Ready 插件不得用 `query` 偷拿 engine / UI slot / 他插件私有 id。

## 边界

1. Ready Notes 查询 `mossx.engine.provider`、`mossx.ui.slot.workspace.main`、`com.mossx.notes.private` MUST `permission-denied`。
2. `mossx.workspace.read` MUST 仍成功。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-provider-denied-v1`
