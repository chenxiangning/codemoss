# Proposal: plugin-storage-lkg-skeleton

> Wave：2AF（插座通电 · LKG 骨架）  

> 依赖：2I 未确认 destructive 不得 migrate、2B DiskStorage checkpoint

## Why

`04` §7 要求更新走 staged candidate → health gate → 提交 LKG，或 restore + 激活上一 LKG。当前只有 namespace / checkpoint / migrate 闸门。产品 `plugin-lockfile.json` 只记 desired-state，不是 artifact pin。health 失败会把 candidate schema 留在可写库上。

## 边界

1. Ready 插件可 `stage_own_update`（先 migrate candidate）再 `complete_own_update(health)`。
2. health pass MUST 把 pin 原子写入 `{storage_root}/plugin-lock.json`。
3. health fail MUST restore 到 stage 前 checkpoint；已有 LKG 不得被 candidate 覆盖；无 LKG MUST quarantine。
4. 产品 `plugin-lockfile.json` 禁止被本刀写入。
5. 不进 boot，不 Slim，不开 Marketplace，不迁 `note_cards`。

## Capabilities

- `plugin-storage-lkg-skeleton-v1`
