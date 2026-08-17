# Design: project-map-plugin-pilot-manifest

## Context

5A 已盘点：24 条 command、memory persist/panel 跟 map、memory-pick 只记账、re-export ≠ 抽出。现有过渡仓 `plugin.json` 只有 1 个 `workspace.main` view，没有 command，也没有 memory 右栏。5B 必须另写 inventory 合同，才能让 5C adapter 按字段接线。

产品事实（本刀不改）：

- 地图中心面走 `centerMode` / `workspace.main`
- memory persist 面板走 `filePanelMode: "memory"` / 右栏
- 数据仍写 `~/.ccgui/project-map*` 与 `~/.ccgui/project-memory`
- V1 storage format 只允许 `sqlite-v1`；那是目标包络，不是当前实现

## Goals / Non-Goals

**Goals:**

- 给出可被 `parseManifestV1` 接受的 exact Pilot Manifest。
- commandId 对齐 inventory，不发明 `projectMap.read` 这类示例名。
- 把 map 主视图与 memory 右栏写成两个 exact contribution。
- 过渡仓门面保持 1 view，避免被误读成已抽出。

**Non-Goals:**

- 接 Host / 改 `command_registry` / 迁表。
- 把 re-export 升级成独立实现。
- 搬 memory-pick / intent-canvas / Search / AppShell。

## Decisions

### D1. 不改过渡仓 plugin.json

`packages/plugin-project-map/.mossx-plugin/plugin.json` 仍是 Wave 0 最小门面。Pilot 合同另文件 `fixtures/valid/project-map-pilot.json`。

备选：把 24 条 command 写进过渡仓。拒绝——门面会被当成已经抽出。

### D2. commandId 用真实 Tauri 名

6 条 `project_map_*` + 18 条 `project_memory_*`，与 `inventory/project-map-pilot.json` 一字不差。这是 inventory 事实源，不是 `projectMap.read` 示例名。

### D3. 两个 UI contribution，一个激活单元

- `project-map.main`：`mossx.ui.view` → `workspace.main`
- `project-map.memory`：`mossx.ui.panel` → `workspace.rightPanel`

产品里 memory 是右栏，不是第二张主画布。合成一个 view 会把 AppShell 槽位说错。

激活仍 lazy：

```text
onView: project-map.main
onView: project-map.memory
onCommand: project_map_write_snapshot
onCommand: project_memory_create
```

其余 command 在已激活 view / panel 内调用，不必各写一个 unit。禁止 `onStartup`。

### D4. storage 只声明目标包络

V1 只允许 `sqlite-v1` + checkpoint。fixture 按这个写，表示**抽出后** map / relations / memory persist 共用 `com.mossx.project-map` namespace。产品此刻仍写 Core 文件。本刀不写 migration entry，避免假装已经有 v1→v2 迁表。

备选：为三个目录各开一个 pluginId。拒绝——5A D1 已钉死 memory persist 跟 map。

### D5. 能力面诚实，但不发明新 mossx.*

- `mossx.storage.readwrite`：目标 namespace
- `mossx.ui.slot.workspace.main` / `mossx.ui.slot.workspace.rightPanel`
- `mossx.workspace.read`：relationship scan 读仓库源文件
- `mossx.network.fetch`：`project_memory_embed_download` 拉模型

不声明 `mossx.workspace.write`：`.ccgui/project-map*` 是待迁出的 Core 文件，不是长期 workspace write。不声明 `mossx.engine.provider`。memory-pick 不进 fixture。

### D6. 不进 Host

只当 fixture。5C 才映射 `ActivationRequest`。`disable.rs` 对 later-plugin 仍报 Active。

## Risks / Trade-offs

- [撑胖过渡仓] → Pilot 另文件；spec 锁住门面仍是 1 view
- [漏 memory 右栏] → 单独 `mossx.ui.panel`，对标产品 `filePanelMode: "memory"`
- [把 sqlite-v1 当成已经迁表] → design 与 dashboard 写明「目标包络，产品仍 Core 文件」
- [顺手拖 memory-pick] → fixture 不含 pick command / conversation slot

## Migration Plan

无产品迁移。回滚 = 删 fixture + 对应单测 + 本 change 文档。

## Open Questions

无。下一刀只能是 5C compatibility adapter（单 owner，默认 off），不得 Slim，不得开 Marketplace。
