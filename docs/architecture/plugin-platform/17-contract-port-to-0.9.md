---
type: inventory
status: active
created: 2026-08-18
source_branch: feature/plugin-mossx-0.8.9
source_tip: 4de8765a9
notes_last_mile: see-18-and-this-land
target_refs:
  - origin/cxn-version-0.9
  - upstream/main
  - upstream/chore/bump-version-0.9
merge_base: bd92e1388
---

# 17 · 0.9 插件合同移植清单（十流）

> 主线入口：[Mossx Plugin Platform](README.md)
> 进度尺：[16 · Progress Dashboard](16-progress-dashboard.md)
> 停刀备忘：[18 · Notes 完全体停刀备忘](18-notes-complete-baseline.md)
> 决策：[09 · Decision Log](09-decision-log.md) D-049～D-056
> 本文件不改生产代码。禁止把本文当成 cherry-pick / merge 脚本。

## 0. 先把两本账分开

0.9 上已经有一份 **产品能力** 移植清单（PI / Dock / Ask / 渲染窗）。那份东西跟本文件不是同一件事。

| 清单 | 位置 | 搬什么 | 默认动作 |
|---|---|---|---|
| **产品能力移植** | 0.9 分支 `docs/plans/2026-08-15-port-0.8.9-capabilities-to-0.9.md` + `2026-08-16-0.8.9-to-0.9-acceptance-matrix.md` | 0.8.9 上已经进生产的 Ask / Dock / PI / 历史窗 | 按 0.9 现码路径重写缺陷，不是搬插件 |
| **插件合同移植（本文）** | 本文件 | 插排 + 三根真插头 + 本地市场 + 卸后藏 + 产品 LKG | **重写合同**，禁止 merge / 整文件 ours |

两份清单共用同一个 merge-base `bd92e1388`（PR #1082）。混用会把「Ask 闸门已经接到 0.9 live channel」误读成「插件运行时已经在 0.9」。

**0.9 现码事实（2026-08-18 复核）**：`origin/cxn-version-0.9` 上 **没有** `plugin_runtime` / `plugin_rack` / `pluginPresence` / `docs/architecture/plugin-platform/`。`git grep plugin` 只碰到 `computer_use/plugin_contract_tests.rs`，那是另一套 computer-use 合同，不是本实验。

## 1. 提交数字必须诚实

「两边各自 200+ 次提交」是复杂度体感，不是对称的 `git rev-list`。本清单用可复核数字：

| 尺子 | 数字 | tip | 怎么读 |
|---|---:|---|---|
| merge-base | `bd92e1388` | 分叉点 | 两边都从这里走 |
| 本实验分支 `feature/plugin-mossx-0.8.9` | **404** | `4de8765a9` | 相对 base 的 unique commits |
| 其中 plugin-kernel / plugin-runtime / plugin-rack / plugin-market / plugin-platform | **~310** | 同上 | `feat/fix/test(plugin-*)` 直方图 |
| 本分支 OpenSpec change 目录 | **402** 个；插件相关 **255** | 工作树 | 不是 402 个已上生产的功能 |
| 本分支相对 base 改动路径 | **3312**；插件相关 **2055** | 工作树 | 含大量 OpenSpec + 过渡仓 |
| `origin/cxn-version-0.9` | **45** | `cde75023d`（0.9.0） | 本地跟踪的 0.9 产品线 |
| `upstream/main` | **89** | `9784d6365`（#1097 bump 0.9） | 上游已合入 |
| `upstream/chore/bump-version-0.9` | **117** | `8d08d65f3` | 上游 0.9 工作枝 |
| 0.9 相对 base 改动路径 | **758**（`origin/cxn-version-0.9`） | 产品重构面 | AppShell S4、`note_cards/` 拆模块、live channel |

读法：

- 插件实验侧 **确实超过 200 次提交**（404）。主体是 `plugin-kernel` 116 feat + 93 fix + 57 test。
- 0.9 产品线 **没有 200 次 unique commit**。复杂度来自 **结构重写**（14 个 domain bag、`note_cards` 拆成 8 文件、liveText / liveItemDelta），不是提交条数。
- 路径数 2055 vs 758 也不可比：本分支一半是 OpenSpec / `packages/plugin-*` 过渡仓。

禁止拿「两边都 200+」当 merge 理由。数字不对称，碰撞面却是真的。

## 2. 为什么必须重写，不能 merge

| 碰撞面 | 本分支 | 0.9 | 若强行 merge |
|---|---|---|---|
| Notes 实现 | 单文件 `src-tauri/src/note_cards.rs`（2170 行）+ 7 处 `notes_commands_allowed` | `src-tauri/src/note_cards/{mod,commands,storage,types,...}.rs`（8 文件） | 整文件 ours 会抹掉 0.9 拆分 |
| AppShell | 本分支在 `useAppShellLayoutNodesSection` / `useLayoutNodes` 读 `pluginPresence`，**不进 bag** | S4：14 个 domain、`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`、禁止根 `useState`、禁止 flatten 直调 | 把 presence 塞进 bag 尾会撞 P1-5 gate |
| Claude 引擎 | 3402 行；闸门 + Process Entry dual-run + uninstall interrupt | 3045 行；`cmd.spawn` 仍是产品路径；live channel 已外置 | 整文件 theirs 丢掉闸门；ours 丢掉 0.9 流式合同 |
| 知识地图 | 24 条 command 全部先过 `project_map_commands_allowed` | 同源 command 在 `project_map.rs` / `project_map_relations.rs` / `project_memory/**`，**无闸门** | 漏接一条 = 假卸载 |
| 启动 | `lib.rs` `boot_host_at(app_home)` + `restore_allowlisted` | 无 Host | 把 default-on Host 带进 0.9 会污染 first-interactive |
| 文档 SoT | `docs/architecture/plugin-platform/` 18 册 | 0.9 **0 个文件** | 直接拷目录可以，但 Decision 必须按 0.9 重新编号 |

Merge Guardrails 适用：高风险文件禁止整文件 `--ours` / `--theirs`。本清单按 **十流合同** 重写，不按文件覆盖。

## 3. 移植原则（写进 0.9 开工闸门）

1. **搬合同，不搬骨架。** 验收是用户能装/卸三根插头；不是 35 个 `plugin_runtime/*.rs` 文件都在。
2. **测试当合同。** 本分支已绿的 install / uninstall / LKG / presence / rack snapshot 测试，在 0.9 用新路径重写后必须再绿。
3. **allowlist 仍是三根。** `com.mossx.notes` / `com.mossx.engine.claude` / `com.mossx.project-map`。其余 9 根只读外形。
4. **两把锁文件一起搬。** `plugin-lockfile.json`（desired-state）≠ `plugin-lock.json`（LKG pin）。
5. **Host 仍 default-off。** 0.9 第一刀不要 `HostConfig.enabled = true`，不要 `missing_executable()` 变真 executable。
6. **presence 不进 AppShell bag。** 继续 `useSyncExternalStore`；0.9 消费点改挂 S4 的 layout / engine / settings owner，而不是新 domain。
7. **45 个 `packages/plugin-*` 过渡仓默认不搬成活插头。** 只搬 `plugin-contract` fixture + 三根真实 adapter 需要的 identity。
8. **Claude / Map Slim、远程 Registry、签名、12 插头可写、P2.6 / P2.7 仍冻结。** Notes 本地独立仓（D-056）已在 0.8.9 探通，0.9 只搬「from-path stage + 卸后留 staged」合同，不搬本机仓路径。D-049 仍有效；D-055 只豁本地 3 listing。
9. **0.9 先立 OpenSpec change，再写代码。** 本分支 255 个 plugin change 不得整包搬进 0.9 `openspec/changes/`。
10. **ADR 校准。** 若命中 engine registry / provider binding / session foundation，按 `AGENTS.md` 回写 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。

## 4. 十流总表

| # | 流 | 本分支成熟度 | 0.9 落点 | 风险 | 建议序 |
|---|---|---|---|---|---:|
| 1 | 双 lockfile + presence | 产品已用 | `~/.ccgui` + 独立 store | 中：两文件名易混 | 1 |
| 2 | allowlist 真装真卸 | D-050/051/052 已闭环 | `plugin_rack` 命令 + snapshot | 中：0.9 无此模块 | 2 |
| 3 | 产品 command 闸门 | 7 + 24 + Claude spawn | `note_cards/commands.rs`、`project_map*`、`engine/claude.rs` | **高**：漏一条即假卸载 | 3 |
| 4 | compat facade / dual-run | 三根 flag，默认 isolated | 同名 env，0 回 0.9 Core | 高：Notes 已拆模块 | 4 |
| 5 | storage namespace + 产品 LKG | D-054 已落地 | `{app_home}/plugins/<id>/` + `plugin-lock.json` | 高：0.9 数据布局可能不同 | 5 |
| 6 | Host default-off + `boot_host_at` | 产品 setup 已接 | `lib.rs` setup，Host `enabled=false` | 高：污染启动 | 6 |
| 7 | 插排 3/9 + 本地市场 | D-053 / D-055 | Extensions 页；0.9 可能无此页 | 中：纯壳，依赖 1–3 | 7 |
| 8 | 卸后藏产品壳 | presence 5 个消费点 | 0.9 layout / engine / settings | **高**：撞 AppShell S4 | 8 |
| 9 | Claude Process Entry + uninstall interrupt | 闸门 + interrupt_all | 0.9 `engine/claude.rs` + session | **最高**：撞 live channel / session | 9 |
| 10 | OpenSpec / D-log / inventory SoT | D-049～055 + dashboard | 0.9 新建 change + 精简 D-log | 中：文档债务 | 全程 |

下面每一流写清：**合同是什么、本分支事实源、0.9 落点、必须搬 / 禁止搬、验收、重写要点**。

---

## 流 1 · 双 lockfile + presence

### 合同

产品有两份磁盘事实，职责不许合并：

| 文件 | 路径 | 管什么 | 不管什么 |
|---|---|---|---|
| 产品 desired-state | `~/.ccgui/plugin-lockfile.json` | `DesiredState = installed \| uninstalled` | 版本、checkpoint、schema |
| 产品 LKG pin | `{storage_root}/plugin-lock.json` | 每 `pluginId` 一条 `LkgPin{pluginId, version, checkpointId, schemaVersion}` | 用户想不想装 |

缺文件时：三根 allowlist **默认 installed**；later-plugin 默认 uninstalled。不是 localStorage，不是 Host `SlotState`。

前端 `pluginPresence`：

- 形状 `{ notes, projectMap, claude }`
- `isPlugged = desiredState !== "uninstalled"`
- 默认全 `true`（避免首屏闪藏）
- `useSyncExternalStore`，**不进 AppShell bag**，不做秒级轮询
- 浏览器 `!isTauri()` 只改进程内存预览

### 本分支事实源

- `src-tauri/src/plugin_runtime/lockfile.rs`（`DesiredState` / `product_path` / `product_set`）
- `src-tauri/src/plugin_runtime/lkg.rs`（`LkgLedger` / `PRODUCT_LKG_VERSION = "1.0.0"`）
- `src/services/pluginPresence.ts` + `.test.ts`
- `src/services/tauri/pluginRack.ts`（snapshot → `publishPluginRackSnapshot`）

### 0.9 落点

- 磁盘根继续 `app_home_dir()` / `~/.ccgui`，不要另起 `~/.mossx-plugin`
- presence store 新建在 `src/services/`，与 0.9 现有 store 并列
- **不要**写入 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`

### 必须搬

- kebab-case `installed` / `uninstalled`
- 原子写：`*.json.tmp` → rename
- 缺省三根 installed
- presence 默认 present + 事件驱动更新

### 禁止搬

- 把 pin 写进 `plugin-lockfile.json`
- 用 Host `state` 当产品在场
- 把 9 根 later-plugin 的 desired-state 做成可写

### 验收

1. 卸 Notes 后重启，`plugin-lockfile.json` 仍是 `uninstalled`，`plugin-lock.json` 仍有 Notes pin。
2. 删掉 lockfile 再启动，三根回到 installed。
3. presence 单测：只认 allowlist 三根；later-plugin 改 snapshot 不影响 `{notes,projectMap,claude}`。

---

## 流 2 · allowlist 真装真卸

### 合同

只有三根可写。`install_plugin` / `uninstall_plugin` 走同一条产品命令，不是 12 套按钮。

卸载语义 = **Disable-not-delete**：

- 写 `desired = uninstalled`
- revoke contributions
- mark slot uninstalled
- **不删** sqlite / checkpoint / LKG pin / 源码
- Claude 卸载额外走流 9 的 interrupt

安装语义：

- allowlist 检查
- activate 对应 fixture / worker
- slot Ready 后 `establish_own_lkg`（流 5）
- 写 `desired = installed`

### 本分支事实源

- `src-tauri/src/plugin_runtime/install.rs`：`is_install_allowlisted` / `install_*` / `uninstall_*` / `restore_allowlisted`
- `src-tauri/src/plugin_rack.rs`：12 declared plugs；Tauri `install_plugin` / `uninstall_plugin` / `get_plugin_rack_snapshot`
- OpenSpec：`plugin-rack-real-install-loop`、`plugin-rack-claude-install-loop`、`archive/2026-08-17-project-map-plugin-install-loop`
- D-050 / D-051 / D-052

### 0.9 落点

- 新建 `src-tauri/src/plugin_runtime/` 最小集：`lockfile` + `install` + `contributions` + 三根 `*_pilot`
- `plugin_rack.rs` 可整模块新建（0.9 无碰撞）
- `lib.rs` 注册 3 条 command；不要把 35 个 runtime 文件一次贴进去

### 必须搬

- allowlist 三元判断
- reject 目标 = `com.mossx.browser`（或任意非 allowlist），错误码 `not-allowlisted`
- snapshot 字段：`pluginId` / `desiredState` / `installable` / `ownerClass` / `productPath` / `circuit`
- 插座状态读 `desiredState`，不读 Host `state`

### 禁止搬

- 给 later-plugin 加 install 按钮
- 把 45 个 `packages/plugin-*` 注册成可装 listing
- 远程 Marketplace command

### 验收

- 装/卸 Notes、Claude、Map 各一次，lockfile 与 snapshot 一致
- 卸 browser 必须失败
- 卸载后 sqlite 文件还在

---

## 流 3 · 产品 command 闸门

### 合同

卸载后产品 command **先于** Core 实现返回 `plugin-uninstalled: <id>`。禁止静默回 `*_core` / `cmd.spawn`。

显式 recovery flag `=0` 仍可绕过闸门（给开发者自救，不是产品默认）。

| 插头 | 闸门 | 切断条数 | 0.9 落点 |
|---|---|---:|---|
| Notes | `notes_commands_allowed` | **7** | `src-tauri/src/note_cards/commands.rs` |
| Project Map | `project_map_commands_allowed` | **24**（6 map + 18 memory） | `project_map.rs` + `project_map_relations.rs` + `project_memory/{commands,embed,embed_index}.rs` |
| Claude | `claude_commands_allowed` | spawn / send 入口 | `src-tauri/src/engine/claude.rs`（0.9 现 `cmd.spawn` ~1559 行） |

Notes 7 条：`note_card_{list,get,create,update,archive,restore,delete}`。

Map 24 条见 `PROJECT_MAP_COMMAND_IDS`（`project_map_compat.rs` 30–55 行）。

### 本分支事实源

- `install.rs` 三个 `*_commands_allowed`
- `note_cards.rs` 1234 行起 7 处
- `project_map.rs` / `project_map_relations.rs` / `project_memory/**`
- `engine/claude.rs` 1059 / 1696 行附近

### 0.9 落点（最容易漏）

0.9 把 Notes 拆进模块。闸门必须打在 **`note_cards/commands.rs` 的 7 个 `#[tauri::command]`**，不是再去改已经不存在的单文件。

Map / memory 文件名 0.9 仍在，但行号已漂。按 **command 名** 对，不按行号 cherry-pick。

### 必须搬

- 错误字符串字面量 `plugin-uninstalled: com.mossx.*`（前端/测试已吃这个前缀）
- 闸门在 facade flag 开时生效；flag `=0` 放行
- Claude 闸门必须先于 `decide_claude_spawn_owner`

### 禁止搬

- 在 0.9 恢复 `note_cards.rs` 单文件
- 只闸 list/read、不闸 write/embed
- 把闸门放进 renderer

### 验收

- 卸 Notes 后 7 条 command 全失败，UI 不再能读写卡片
- 卸 Map 后 24 条全失败，含 embed / index
- 卸 Claude 后 spawn 失败文案含 `plugin-uninstalled: com.mossx.engine.claude`
- `MOSSX_NOTES_COMPAT_FACADE=0` 时 Notes 闸门放行（recovery）

---

## 流 4 · compat facade / dual-run

### 合同

三根插头各有门面。默认 **isolated**（未设即开）。同一时刻只有一个 owner。

| flag | 默认 | `=0` | owner |
|---|---|---|---|
| `MOSSX_NOTES_COMPAT_FACADE` | isolated sqlite | `note_cards` 文件 / 0.9 模块 | `NotesCompatOwner` |
| `MOSSX_PROJECT_MAP_COMPAT_FACADE` | isolated sqlite | `*_core` | `ProjectMapCompatOwner` |
| `MOSSX_CLAUDE_PROCESS_ENTRY` | 产品 Process Entry 路径开（闸门仍看 lockfile） | 回 `cmd.spawn` | `ClaudeSpawnOwner` |

`0` 是 recovery，不是「没装插件」。卸了插件即使 flag 开也必须被流 3 挡住。

### 本分支事实源

- `notes_compat.rs` / `notes_storage.rs` / `notes_pilot.rs`
- `project_map_compat.rs` / `project_map_storage.rs` / `project_map_pilot.rs`
- `claude_compat.rs` / `claude_process.rs` / `claude_pilot.rs`
- `contributions.rs`（live command 集合）

### 0.9 落点

- facade 调 0.9 的 `note_cards` **模块** API，不要依赖本分支私有函数签名
- Map facade 继续委托 0.9 `project_map` / `project_memory`（0.9 可能已有 perf 改动，以 0.9 为准）
- Claude facade 只搬 **身份 + spawn owner 决策**；流式 IO 见流 9

### 必须搬

- `enabled_from(None) = true`
- `import_legacy_once`（Notes / Map 从 Core 文件迁进隔离库，只一次）
- contributions revoke 后 `*_live() == false`

### 禁止搬

- 把 dual-run 测试里的 Memory backend 当产品存储
- 把 `packages/plugin-notes` re-export 说成已经抽出
- Claude compat 里假装会话 JSONL / schema-migrate（D-054 明确禁止）

### 验收

- 未设 env：三根走 isolated
- 设 `=0`：走 0.9 Core，闸门放行
- 卸后无论 flag，产品 command 仍 `plugin-uninstalled`（Claude 的 `=0` 除外，那是显式 recovery）

---

## 流 5 · storage namespace + 产品 LKG

### 合同

每根插头自己的 namespace + 自己的 pin。不是「一个全局 LKG」。

首次成功 install（slot Ready）→ `establish_own_lkg`：

1. 无 pin → adopt 现有 schema + checkpoint + protect + commit pin
2. 有 pin 且 store 不健康 → `restore_pinned`（从 checkpoint 拷 sqlite，不走内存 namespace）
3. 有 pin 且健康 → 保持
4. uninstall **不删 pin**

`StorageService` 是进程内对象。产品路径必须走 `DiskStorage::adopt_plugin` / `restore_pinned`，不能假设 boot 后内存里已经有 namespace。

Claude health **只认** bookkeeping sqlite + slot Ready。禁止用会话 JSONL / 对话 schema 当 health。

`stage_own_update` / `complete_own_update` 是 **update** 合同，不是首次 install。P2.5 整行（产品 update + 破坏性 migration 确认）、P2.6 retention、P2.7 crash **本刀不搬**。

### 本分支事实源

- `lkg.rs` / `disk_storage.rs` / `storage.rs` / `runtime.rs::establish_own_lkg`
- `install.rs::pin_product_lkg`
- `boot.rs::boot_host_at`
- 测试：`three_plugs_pin_independently_and_skip_product_lockfile`、`uninstall_keeps_notes_lkg_pin`、`new_runtime_on_same_root_reloads_pins`、`mutated_notes_schema_rolls_back_to_pin_on_reinstall`
- OpenSpec `plugin-storage-lkg-product-path`；D-054

### 0.9 落点

- `{app_home}/` 下的 plugins 目录布局按本分支，避免和 0.9 自己的 sqlite 抢路径
- adopt 时 **读现有 schema，禁止重写**
- 0.9 若已迁移 Notes / Map 数据文件，import_legacy 必须以 0.9 路径为准重写

### 必须搬

- 每 `pluginId` 独立 pin
- 同 root 新 `PluginRuntime` 能读回 pin
- schema 被改坏 → reinstall / boot 回滚到 pin
- 卸后 pin + sqlite 仍在

### 禁止搬

- 把测试用 ephemeral `boot_host()` 当产品 boot
- 把 P2.5 update stage/complete 当成本流完成
- Slim 之后的「完整 LKG」（artifact hash / 签名 / 远程独立仓发布）。Notes 本地 from-path（D-056）是 0.8.9 证据，0.9 另开流再搬

### 验收

把本分支 4 个 LKG 产品测试按 0.9 存储 API 重写，全绿。0.9 允许线从 0 起算；本分支收口是 82%，不是 67%。Claude / Map 协议仍记 7/9。

---

## 流 6 · Host default-off + `boot_host_at`

### 合同

产品 setup 必须有一个 **durable** Host，才能让 pin / restore 活过重启。但 Host **默认不通电**。

- 测试：`boot_host()` → 仍 ephemeral temp
- 产品：`boot_host_at(app_home_dir())`；失败则 ephemeral + warn，**禁止改写用户存储**
- `HostConfig.enabled = false`
- `restore_allowlisted` 只恢复三根 desired=installed 的 slot
- `boot_driver()` 继续 `missing_executable()`，不要真 spawn Host 控制进程

### 本分支事实源

- `boot.rs`、`host.rs`、`lib.rs` setup（`boot_host_at` + fallback）
- Wave 1 真实实现但标 *not in product path*：`quickjs.rs` / `spawn.rs` / `ipc.rs` / `composite.rs`

### 0.9 落点

- `src-tauri/src/lib.rs` setup 是碰撞点。0.9 已有 `mod note_cards` 和自己的启动顺序
- 插入点：在 AppState 就绪后、first-interactive 之前 restore allowlist
- 遵守 Native WebView / 启动 guard：坏值不得让应用起不来

### 必须搬

- durable root + ephemeral fallback
- Host enabled=false
- restore 读 lockfile，不读「上次内存」

### 禁止搬

- 把 QuickJS / Named Pipe / MXPC 全链一次接到产品 boot
- `onStartup` 激活普通插件
- 让 Marketplace / Registry 成为 first-interactive 依赖（本来也没有）

### 验收

- 冷启动不因 Host 失败而进不了设置页
- 两次启动读到同一 `plugin-lock.json`
- Host slot 对 later-plugin 保持未激活

---

## 流 7 · 插排 3/9 + 本地市场

### 合同

可视化插排：**live 3 座可插 / later 9 座封口**。市场页：3 张 listing 调真实装/卸 + 9 张即将开放。远程 Registry = 0。

later 9：`browser` / `intent-canvas` / `kanban` / `engine.{codex,gemini,grok,kimi,opencode,pi}`。

浏览器 `!isTauri()`：内存预览 snapshot，禁止 localStorage，拒绝 later-plugin。

插座 CTA 在 listing，不在封口座。状态条只报 3/9，不报 12 可写。

### 本分支事实源

- `src/features/extensions/components/PluginRackSection.tsx`
- `src/features/extensions/components/PluginMarketplaceCatalog.tsx`
- `src/services/tauri/pluginRack.ts`
- 原型 `docs/prototypes/plugin-rack-visual/index.html`
- D-053 / D-055

### 0.9 落点

- 先确认 0.9 Extensions / 设置页信息架构。0.9 AppShell 分区已变，**不要**把本分支整页塞进旧 sidebar
- UI 必须引用 0.9 design tokens，禁止自造色值（若视觉有变，先独立 HTML 原型）
- 0.9 若还没有 Extensions 路由，先加路由再挂壳

### 必须搬

- 3/9 口径
- listing 调同一 `install_plugin` / `uninstall_plugin`
- preview snapshot 只改内存

### 禁止搬

- 2026-08-16 已回退的 45 假插件 catalog + localStorage（D-049）
- 远程 index / 签名 / 社区发布
- 给 0/9 插头装按钮（含 disabled 假按钮）

### 验收

- 市场页能演示：装 Notes → 插排亮；卸 Notes → 插排灭；重启保持
- 9 张即将开放无 CTA
- 浏览器预览刷新后预览状态丢失（证明没写盘）

---

## 流 8 · 卸后藏产品壳（撞 AppShell S4）

### 合同

卸载后入口和面板一起消失，不是藏一个按钮。命令已断（流 3）而 UI 还在 = 验收失败。

本分支消费点（0.9 必须逐个重挂）：

| 消费点 | 读哪些键 | 藏什么 |
|---|---|---|
| `useAppShellLayoutNodesSection.tsx` | `notes` / `projectMap` | 笔记 / 地图节点与面板 |
| `useLayoutNodes.tsx` | 同上 + `clientUiVisibility` | 右栏工具 |
| `useEngineController.ts` | `claude` | 引擎列表；卸后若当前是 claude 要迁走 |
| `SidebarSettingsMenu.tsx` | 三根 | 设置菜单项 |
| `QuickSwitcher.tsx` | 三根 | 快捷切换条目 |

`pluginPresence` 继续独立 store。0.9 S4 规则：

- 新壳状态必须有 owner domain
- 生产路径禁止 `flattenAppShellDomainContexts` / `adaptAppShellLegacyFlatContext`
- `AppShell.tsx` 禁止直接 `useState` 业务状态
- domain key soft 80 / 终态 hard 60；navigation hard ≤ 80
- 改 `src/app-shell/**` 先读 `docs/plans/2026-08-11-app-shell-cohesion-optimization.md` + Ownership Matrix
- CI：`npm run check:app-shell:governance`

**推荐**：presence **不**成为第 15 个 domain。layout / engine / settings 的 builder 各自订阅 `usePluginPresence()`。若治理脚本把「section 读外部 store」判为无主，再开一个极瘦 owner，只登记三布尔，禁止把 rack snapshot 整包塞 bag。

### 必须搬

- 卸后入口 + 面板 + switcher + 引擎项全藏
- 默认 present，避免闪藏
- Claude 卸后若是当前引擎，切到仍 installed 的引擎；全无则空态，禁止假 spawn

### 禁止搬

- 把 presence 摊进根 hook 链
- 秒级轮询 snapshot
- 只藏 toolbar 不藏 panel

### 验收

- 卸三根后：侧栏、右栏、Quick Switcher、引擎选择器都看不到对应项
- 装回立即出现，无需重启（事件驱动）
- `check:app-shell:governance` 绿
- 0.9 其他 domain 行为不回退（切会话 / composer / git 面板）

---

## 流 9 · Claude Process Entry + uninstall interrupt（最高风险）

### 合同

Claude 是唯一一根既是插头、又是会话引擎的线。

1. 产品生命周期只用 `claude-worker` isolate；per-turn CLI 走 Process Entry。
2. 卸载：先确认 → `interrupt_all_claude_sessions` → 再写 uninstalled。
3. 卸后 `claude_commands_allowed()` 必须先于 `decide_claude_spawn_owner` 返回 `plugin-uninstalled`，禁止静默 `cmd.spawn`。
4. `MOSSX_CLAUDE_PROCESS_ENTRY=0` 仍是 recovery。
5. 流式正文走 0.9 的 `liveAssistantTextChannel` / liveItemDelta。**禁止**把本分支逐 delta dispatch 带回 0.9 reducer。

### 本分支事实源

- `claude_process.rs`：`decide_claude_spawn_owner` / `spawn_process_entry_turn` / supervised IO
- `plugin_rack.rs`：`interrupt_all_claude_sessions`
- `engine/claude.rs` 闸门
- OpenSpec `plugin-product-surface-hide-on-uninstall`、`plugin-rack-claude-install-loop`
- D-051 / D-054（Claude health 只认 bookkeeping）

### 0.9 落点（必须按 0.9 现码重写）

- `src-tauri/src/engine/claude.rs`（3045 行，已分叉）
- 0.9 live channel：`useRuntimeThreadDomainHost.ts`、`useAppServerEvents.ts`、`MessageRow.tsx`
- session / thread：0.9 有 perf(threads) / history window，本分支不要回退
- 若改 provider / session foundation：回写 ADR

Render Perf 红线（`docs/perf/render-jank-knife-experiments-2026-07-08.md`）：

- 高频 setState 禁挂根 hook
- 数组追加型 setState 禁入根链
- 禁恢复逐 delta dispatch

### 必须搬

- uninstall 确认文案 + interrupt
- 闸门错误字面量
- spawn owner 决策表（lockfile × flag）
- 卸后引擎选择器无 Claude

### 禁止搬

- 整文件覆盖 `engine/claude.rs`
- 把本分支 stream_loop 直接替换 0.9 live assembler
- 用会话 JSONL 当 LKG health
- 把 Codex/Gemini/… 一起做 Process Entry

### 验收

- 跑着 turn 时点卸载：有确认；确认后 turn 停；入口消失；再发送失败
- 卸后重启仍不能 spawn
- 0.9 流式渲染不回退（live text 仍走外置 channel）
- 相关 vitest + `plugin_runtime` / claude 闸门测试绿

---

## 流 10 · OpenSpec / Decision / inventory 作为 SoT

### 合同

0.9 不继承 255 个 plugin change 目录。0.9 只立 **少量** 新 change，对应十流，而不是重放实验史。

建议 0.9 开工时的 change 切法（可合并，不可再拆成 255）：

| 建议 change-id | 覆盖流 | 对应本分支 Decision |
|---|---|---|
| `plugin-lockfile-and-presence` | 1 | D-050 的磁盘部分 |
| `plugin-allowlist-install-loop` | 2 + 3 | D-050/051/052 |
| `plugin-compat-facades` | 4 | 三根 dual-run |
| `plugin-storage-lkg` | 5 + 6 | D-054 |
| `plugin-rack-and-local-market` | 7 | D-053 / D-055 |
| `plugin-hide-on-uninstall` | 8 + 9 的 UI/interrupt | `plugin-product-surface-hide-on-uninstall` |

Decision 在 0.9 重记一版（建议从 D-100 起，或写 `0.9-D-001`），正文引用本分支 D-049～D-056 为证据，不把旧 ID 假装是 0.9 已确认。

必须同步的设计册（精简拷，不要 16 册一次性当已实现）：

- `14-v1-contract-freeze.md`（字段 SoT）
- `09-decision-log.md` 的 D-049～D-056
- `16-progress-dashboard.md`（到 0.9 后重新打快照，百分比归零再涨）
- `18-notes-complete-baseline.md`（0.8.9 停刀事实，不当 0.9 已交付）
- 本文

`08` / `15` / inventory 长文只作附录，不作为 0.9 已交付声明。

### 禁止搬

- 402 个 `openspec/changes/*` 整包拷到 0.9
- 把 Wave 1「真实 Host 在测试里转」写成 0.9 产品已通电
- 把 dashboard 82% 原样贴到 0.9（0.9 起步允许线是 0%）

### 验收

- 0.9 `openspec` 能指出当前 plugin change，且与十流一一对应
- 0.9 dashboard 自己的快照日期与证据 commit
- 与产品能力移植清单交叉引用，互不吞条目

---

## 5. 明确不搬（冻结表）

| 资产 | 为什么不搬 | 何时才能再谈 |
|---|---|---|
| Slim / 删 Core 实现 | Claude / Map 仍 7/9；P8 = 8%（只 Notes ownership） | 0.9 三根插头再次走到 Disable 且产品稳定一个版本之后 |
| 远程独立仓发布 / 签名 artifact | D-014 终态；Notes 本地仓只是 last-mile 证据 | 真 Slim 之后 |
| 远程 Marketplace / 签名 / SBOM | D-049 + P6 = 0% | Slim + Registry governance |
| 12 插头可写 / later-plugin 协议 | 9 根仍 0/9 | 下一根必须重新走九步 |
| 45 个 `packages/plugin-*` 当活插头 | 过渡仓 / re-export，不是抽出 | 永远不要当 installable |
| Host `enabled=true` + 真 executable | first-interactive 风险 | 单独 change，0.8.9 上已建议停 |
| P2.5 整行 / P2.6 / P2.7 | 产品 LKG 只是保险丝子集 | 0.9 三根 pin 稳定后 |
| QuickJS / MXPC / Named Pipe 产品通电 | 测试骨架，不是验收目标 | 真 Worker 插头出现时 |
| 本分支对 messages / sidebar / browser-agent 的顺手修 | 交给 0.9 产品能力清单判定 | 按那份 STILL/SUPERSEDED 表 |
| `inventory/real-uninstall-dependency-chain.md` 2026-08-16 正文数字 | 已被 D-052～055 越过 | 只当历史证据 |

## 6. 推荐重写顺序（0.9 上）

```text
流 10 立 change / 记 Decision     ← 纸面，先于代码
    ↓
流 1 lockfile + presence store    ← 无 UI 也能测
    ↓
流 2 allowlist install 命令       ← snapshot 可测
    ↓
流 6 boot_host_at default-off     ← durable root
    ↓
流 4 facade 接到 0.9 模块
    ↓
流 3 闸门打进 0.9 command         ← 假卸载在这里死
    ↓
流 5 产品 LKG                     ← 依赖 2+6
    ↓
流 7 插排 + 本地市场壳
    ↓
流 8 卸后藏（S4 治理绿灯）
    ↓
流 9 Claude interrupt + spawn     ← 最后，因为最容易炸会话
```

不要并行开流 8 和流 9。不要在流 3 绿之前做市场 UI（会再次演示假卸载）。

## 7. 0.9 落地后尺子怎么记

0.9 起步全部归零。本分支的 82 / 22 / 70 **不得**抄过去当 0.9 进度。

| 尺子 | 本分支收口 | 0.9 刚开 | 0.9 十流完成（目标） |
|---|---:|---:|---:|
| 允许线 | 82% | 0% | ~82%（仍不含 Claude/Map Slim / Host 真 boot） |
| 真实卸载 | 70% | 0% | ~70%（仍只有三根） |
| 终态 | 22% | 0% | ~22% |
| 插排 3/9 | ~100% | 0% | ~100% |
| 本地市场 | 100% | 0% | 100% |
| 三根产品 LKG | 已落地 | 无 | 已落地 |

用户锁定目标不变：**插排 100%；插头 3 个真实可插拔；市场能演示。** 十流完成 = 这个目标在 0.9 上重做一遍，不是插件化终态做完。

## 8. 工作量直觉（给排期，不是承诺）

按「重写合同 + 测试再绿」，不是按 404 个 commit 重放：

| 波次 | 流 | 体感 | 主要碰撞 |
|---|---|---|---|
| A 地基 | 10, 1, 2, 6 | 中 | `lib.rs` setup |
| B 切断 | 4, 3, 5 | 重 | `note_cards/` 拆分、24 条 Map 闸门 |
| C 壳 | 7, 8 | 重 | AppShell S4、Extensions 路由 |
| D 引擎 | 9 | 最重 | Claude + live channel + session |

B+C+D 任一波都比「把 `plugin_runtime` 目录拷过去」大。拷目录是假进度。

## 9. 证据锚点（本分支收口）

| 断言 | commit / 路径 |
|---|---|
| 本地市场 + 卸后藏 | `9e5b07b68` |
| 三根产品 LKG | `4de8765a9` |
| Notes 本地独立仓 from-path | D-056；`local_source.rs`；[18](18-notes-complete-baseline.md) |
| allowlist 三根 | D-052；`install.rs::is_install_allowlisted` |
| 插排 3/9 | D-053；`PluginRackSection.tsx` |
| 本地市场 | D-055；`PluginMarketplaceCatalog.tsx` |
| 卸后藏 + interrupt | `pluginPresence.ts`；`plugin_rack.rs::interrupt_all_claude_sessions` |
| 0.9 无 plugin_runtime | `origin/cxn-version-0.9` `git ls-tree src-tauri/src` |
| 0.9 产品能力清单（勿混） | `upstream/main:docs/plans/2026-08-15-port-0.8.9-capabilities-to-0.9.md` |

## 10. 下一刀

本实验分支 **停刀**。Notes last-mile 已探通（见 [18](18-notes-complete-baseline.md)）。下一刀在 0.9：先开 `plugin-lockfile-and-presence` OpenSpec change，不要在 `feature/plugin-mossx-0.8.9` 上继续 Slim Claude/Map 或 Host 真 boot。
