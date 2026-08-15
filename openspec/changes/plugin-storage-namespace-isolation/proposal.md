# Proposal: plugin-storage-namespace-isolation

> Wave：2C（插座通电 · namespace 调用方闸门）  
> 依赖：2A 内存 storage、2B disk storage

## Why

2A/2B 已按 pluginId 分路径，但 API 仍是「谁知道 id 谁就能开」。合同要求插件不得打开他人 namespace。2C 加 caller 身份，Claude 不得读 Notes 路径。

## 边界

1. `access(caller, target)`：不等则 `permission-denied`。
2. 磁盘路径仍分目录；本刀不迁 `note_cards`。
3. 不改产品 app-data 路径。

## Capabilities

- `plugin-storage-namespace-isolation-v1`
