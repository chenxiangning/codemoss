# Proposal: redesign-sidebar-engine-rail

> OpenSpec change id: `redesign-sidebar-engine-rail`  
> UI 定案：方案 D（左侧 CLI logo 轨）  
> 原型：`_temp/sidebar-session-group-variants.html`  
> 依赖：`rewrite-sidebar-session-index` 已交付的 Session Index（`~/.ccgui/session-index.sqlite3`）

---

## Why

侧栏已经有 Session Index，但冷路径仍把 Codex live、titles、归档证据、1.5s restore、磁盘 fan-out 叠在上面。列表又慢又会「先错后对」。多 CLI 产品却仍用一条平铺时间线，用户分不清 Claude / Codex / Shared。

现在要做两件事：列表只查 SQLite；用 logo 轨按 CLI 看会话。过滤规则一律不动。

---

## 目标与边界

1. **侧栏 list 只读 Session Index**。冷启动 / 切工作区 / 普通刷新：`list_session_index_for_workspace` → 投影 → 画列表。磁盘 JSONL 不得成为 list membership 来源。
2. **UI 采用方案 D**：工作区下左侧 logo 轨。Shared 单独一轨；每个有行的 native CLI 一轨。一次只展示当前轨的会话。
3. **删除是组织态优先**：先在 Index tombstone / 移除行，侧栏立刻消失；再尽力删磁盘。磁盘失败不得把行救回。
4. **过滤规则冻结**。本 change 只改「从哪读、怎么分组展示」，不改「谁能出现 / 谁必须挂在谁下面」。

## 非目标

- **不改过滤 / 归属闸门**（硬冻结，实现与 review 必须对照现有 spec / 测试）：
  - Shared Hidden Native Binding 与 fail-closed visibility
  - Shared 下崽隐藏（`parent` 指向 `shared:` 的 native 不进侧栏树）
  - `parentThreadId` / Codex child 挂起与缩进
  - `autoSession.visibility === "hidden"`
  - archive overlay（已归档不进活跃列表）
  - 刚删除 id 立即剔除
  - MOSSX / control-plane 标题不得当普通 native 行
- 不改点开对话的 Transcript Loader
- 不改 Session Management 的 Bounded / exhaustive catalog
- 不重写 Session Index writers（沿用 `rewrite-sidebar-session-index`）
- 不把 Settings 全量扫描改成 Index-only
- 不做 fs watch 实时增量
- 不改 AppShell domain bag / engine registry / Shared binding schema

---

## What Changes

- Sidebar 会话列表改为 **engine rail**：左轨 logo（仓库 `EngineIcon` / `SharedSessionIcon`），右栏只渲染当前 engine 的 Index 行。
- 空 engine 不占轨。Shared 永远第一轨（该 workspace 有 Shared 行时）。
- 当前轨、折叠态按 workspace 持久化。
- 组内仍按 `updatedAt`；child 缩进在父会话下（沿用现有 tree 投影，只是输入集换成「当前 engine」）。
- 钉住：仍可钉；钉住行出现在当前轨顶部，或轨上角标。不另开第三套 membership。
- 冷路径删除这些自动调用：`list_workspace_sessions`、Claude/Gemini/Grok/Kimi/OpenCode 磁盘 list、Codex live `listThreads` 作为 membership、`useWorkspaceRestore` 二次 first-paint。
- 后台 Incremental sync 只允许 `forceSync` / 空 Index / 用户「同步」。
- 删除：Index tombstone 先于磁盘；磁盘失败记残留，只在 Session Management 可见。
- Load older / 会话管理仍走 Catalog，不走侧栏冷路径。

**BREAKING（产品感知）**：侧栏不再保证「一次看到全部 CLI 的平铺时间线」。要看另一个 CLI，点对应 logo。这是方案 D 的刻意取舍。

---

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 继续 merge 大管道 | Index + live Codex + titles + restore + disk | 已证明慢、重复、会复活行。否决。 |
| B. Index-only list | 侧栏只查 SQLite；磁盘只服务详情/删除/强制同步 | 与 CLI `/resume`、Cursor `state.vscdb` 同构。**采用。** |
| C. 手风琴同时展开多 CLI | 方案 A | 5 CLI 时纵向爆炸。否决为默认。 |
| D. logo 轨 | 一次一个 CLI | 用户已选。窄侧栏信息密度最高。**采用。** |
| E. 删除等磁盘成功 | 磁盘失败则行还在 | 幽灵行根因。否决。 |
| F. tombstone 优先 | 先藏再删盘 | 列表是组织态。**采用。** |

---

## Capabilities

### New Capabilities

- `sidebar-engine-rail`: 工作区会话列表按 Shared + native CLI 分轨展示；logo 轨切换；空轨不画；当前轨持久化；行数据来自 Index 投影，不自造 membership。

### Modified Capabilities

- `workspace-sidebar-session-loading`: 冷路径收成 Index-only；禁止 restore / soft-refresh 再打磁盘 fan-out 或自动 full-catalog；first-paint 完成 = Index 行 + 可用 visibility。
- `workspace-session-catalog-projection`: 侧栏删除以 Index tombstone 为 membership 真相；磁盘删除失败不得恢复活跃行。
- `conversation-lifecycle-contract`: 单条 / 批量删除的「先组织态、后磁盘」顺序与失败残留口径。

---

## Impact

- **Frontend**：`Sidebar` / `ThreadList` 增加 engine rail；`useThreadRows` 输入改为当前 engine 子集（tree / hide 函数原样调用）；`useThreadActionsListThreadsForWorkspace` 砍掉磁盘 merge；`useWorkspaceRestore` 不再二次 list。
- **IPC**：侧栏只依赖已有 `list_session_index_for_workspace` + Shared visibility；删除需 Index tombstone API（若无则在本 change 补一条，不改 catalog membership 语义）。
- **Backend**：Session Index 增加 `tombstoned_at` 或等价标记；delete 写 Index 后异步/尽力删磁盘。
- **不过滤层**：`sharedNativeVisibility.ts`、`isSharedSidebarHiddenPup`、`parentThreadId` 解析、archive overlay **只调用、不改逻辑**。
- **文档**：`dev-guidelines/guides/workspace-session-catalog-contract.md` 三层数据面补「侧栏 UI = rail，membership = Index」。
- **ADR**：不改 engine registry / Shared binding schema / canonical fact。无需回写基石表，除非 tombstone 字段进入 Index schema——若进入，在 design 里记一行事实源即可。
- **原型**：`_temp/` 仅评审，不入库。

---

## 验收标准

1. 冷启动侧栏 diagnostic 只有 `list_session_index_for_workspace`（可加 titles/Shared visibility 同 IPC），**没有** `list_workspace_sessions`、`list_*_sessions` fan-out、Codex live membership 翻页。
2. 启动后 1.5s **不再**自动打第二遍 first-paint。
3. 有 Claude + Codex + Shared 的工作区：左轨至少三枚 logo；点 Codex 只见 Codex 行；Shared binding 的 native 仍不出现。
4. Codex child 仍缩进在父会话下；Shared 下崽仍不进侧栏树。现有 hide / parent 测试集零回归。
5. 删除一条：侧栏立即消失；人为让磁盘删除失败，刷新后该行仍不回来。
6. Session Management / Load older / 点开 transcript 行为与本 change 前一致。
7. focused Vitest：rail 切换、空轨、Index-only hydrate、tombstone；相关 hide/parent 旧测试全绿。

---

## 实施顺序（提案级，细节进 design）

1. 冻结过滤测试为 regression gate，先跑红线确认基线。
2. 侧栏 hydrate 收成 Index-only（先行为后 UI）。
3. 删除 tombstone。
4. 上方案 D rail。
5. 拆 restore / 磁盘 fan-out。
