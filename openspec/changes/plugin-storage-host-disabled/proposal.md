# Proposal: plugin-storage-host-disabled

> Wave：2W（插座通电 · Host 默认 off 不得用 store API）  
> 依赖：1H 默认 off、2V 从未 activate

## Why

1H 已证明默认 Host 不得 activate。store API 尚未独立验收「Host.enabled=false」。1F 后不得在插座关着时凭 pluginId 摸 sqlite。

## 边界

1. `HostConfig.enabled=false` 时五类 store API MUST `plugin-unavailable`。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-host-disabled-v1`
