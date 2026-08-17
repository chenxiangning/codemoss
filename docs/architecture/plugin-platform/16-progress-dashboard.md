---
type: architecture
status: active
---

# 16 · Pluginization Progress Dashboard

> 主线入口：[Mossx Plugin Platform](README.md)
> 开工图：[15 · Implementation Wave Plan](15-implementation-wave-plan.md)
> 阶段图：[08 · Migration Roadmap](08-migration-roadmap-and-tasks.md)
> 卸载链：[inventory/real-uninstall-dependency-chain.md](inventory/real-uninstall-dependency-chain.md)
> 快照日期：**2026-08-18**
> 证据 change：`plugin-storage-lkg-product-path`（D-054 三根插头产品 LKG）+ `plugin-marketplace-local-catalog`（D-055）+ `plugin-product-surface-hide-on-uninstall`
> 验收：市场页 3 张可装/卸 listing + 9 张即将开放 + 插排状态条；卸后藏产品入口/面板；卸载 Claude 先确认再 interrupt；三根插头首次 install 各自 pin，同 root 重启读回，schema 坏了回滚，卸后留 pin。浏览器预览只改内存。远程 Marketplace 仍关。Host 仍 `enabled=false`。allowlist 仍 Notes + Claude + Project Map。P2.5 整行 / P2.6 / P2.7 未勾。
> 工作树：`feature/plugin-mossx-0.8.9`

本文是**带日期的进度总视图**，不是产品行为 SoT。行为以当前代码和 OpenSpec 为准。百分比是人工校准的工程判断，用来防止把「200+ OpenSpec change」误读成「产品已经插件化」。

刷新规则：每根插头走完 `15` §3 的一步，或 `08` 某个 Phase 的验收口径变化时，改本页数字并更新快照日期与证据 commit。禁止只改百分比不改证据。

## 1. 先看三个分母

同一件事用三个尺子量，数字差一个数量级。混用就会把插排骨架当成已经拔插头。

| 尺子 | 当前 | 缺口 | 分母是什么 |
|---|---:|---:|---|
| **允许线（Allowed line）** | **67%** | **33%** | `15` §3 走到 Disable + Notes/Claude/Map 真实 install/uninstall。Slim / 远程 Marketplace 不计入。D-054 产品 pin/restore 已落地，**仍不抬这把尺子**（允许线停在第 7 步）。本地市场壳也不抬。 |
| **终态插件化（End-state）** | **15%** | **85%** | 独立仓库 + Slim + 完整 P2.5/P2.6/P2.7 + Marketplace + 其余插头全部迁出。三根产品 pin 只是终态 LKG 的最小保险丝，不是独立仓。 |
| **真实卸载（Real uninstall）** | **70%** | **30%** | 三根诚实闭环：lockfile + 产品闸门 + 藏入口/面板 + Claude interrupt。later-plugin 仍卸不掉。数据 Disable-not-delete，不是删 sqlite / 源码。卸后 LKG pin 保留，不改变卸载尺。 |

读法：

- 问「这波还能干什么」→ 看允许线 67%。
- 问「离可安装/可卸载的插件生态还有多远」→ 看终态 15%。
- 问「现在能不能从产品里拔掉 Claude / Notes / 知识地图」→ 看真实卸载 70%（三根都能拔；市场页 3 张 listing 可装/卸，插排 3 座可插 / 9 座封口）。

```text
允许线 █████████████░░░░░░░  67%
终态   ███░░░░░░░░░░░░░░░░░  15%
卸载   ██████████████░░░░░░  70%
```

## 2. 平台层（插排，不是插头）

| 层 | 完成 | 缺口 | 口径 |
|---|---:|---:|---|
| Wave 0 插排图纸 | **100%** | 0% | inventory + Manifest parser + fitness。图纸在，产品没减。 |
| Wave 1 Extension Host | **90%** | 10% | Host / Worker / Process / Composite **真实实现**，标注 *not in product path / not in boot*。 |
| Wave 2 Storage / checkpoint / lifecycle | **94%** | 6% | namespace + checkpoint + atomic registry + **三根产品 pin/restore（D-054）** 已落地。P2.5 整行（update stage/complete 进产品、破坏性 migration 用户确认）、P2.6 retention、P2.7 crash 未收口。 |
| Host 产品通电路 | **30%** | 70% | Host 仍 `enabled=false`。产品 setup `restore_allowlisted` 给 Notes + Claude + Project Map 通电；Claude 只 start `claude-worker`。一般 `activate` 仍 host-disabled。 |
| Rack UI | **~100%** | 0% | 可视化插排：3 座可插 / 9 座封口。插座只报状态，CTA 在市场 listing。口径是 3/9，不是 12 根全可写。 |
| Local market UI | **100%** | 0% | 本地 curated catalog：3 listing 真装真卸 + 9 即将开放。snapshot 未到不渲染空货架。浏览器内存预览。远程 Registry 不算进本行。 |
| Marketplace / Registry | **0%** | 100% | 远程 index / 签名 / 社区发布仍冻结。D-049 + P6 未开。 |

```text
Wave 0     ████████████████████  100%
Wave 1     ██████████████████░░   90%
Wave 2     ███████████████████░   94%
Host 通电  ██████░░░░░░░░░░░░░░   30%
Rack UI    ████████████████████  ~100%
Local UI   ████████████████████  100%
Marketplace ░░░░░░░░░░░░░░░░░░░░    0%
```

Wave 1 / Wave 2 的高完成度只证明「插座能在测试里转」。它不证明任何业务已经离开 Core。

## 3. 插头协议（`15` §3 九步）

对每一根要拔的能力，固定走：

```text
1 Inventory → 2 Contract → 3 Adapter → 4 Pilot repo
→ 5 Dual-run → 6 Conformance → 7 Disable
→ 8 Slim → 9 LKG
```

当前约束：**禁止第 8 步 Slim，禁止远程 Marketplace。** 本地 curated catalog（D-055）只演示已闭环的三根 allowlist 插头，不算 P6。插头协议允许线停在第 7 步 Disable-not-delete。D-054 是第 9 步的**产品保险丝子集**（pin/restore），不是 Slim 之后的完整 LKG，协议仍记 7/9。

| 插头 | 协议步 | 允许线 | 抽出 / Slim | 产品 owner |
|---|---:|---:|---:|---|
| Claude `com.mossx.engine.claude` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `cmd.spawn` |
| Notes `com.mossx.notes` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `note_card_*_core` |
| 知识地图 `com.mossx.project-map` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `*_core` |
| 浏览器 | 0 / 9 | **0%** | 0% | Core |
| 意图画布 | 0 / 9 | **0%** | 0% | Core |
| 其余 6 个 CLI | 0 / 9 | **0%** | 0% | Core |
| 后续 feature（Kanban / Git 高级流 / …） | 0 / 9 | **0%** | 0% | Core |

Claude / Notes / 知识地图的 82% 读作：**协议走到 Disable，并且产品能真实装/卸。** 源码和回退都还在，不是已经迁出。另外 9 根协议 0/9，只做了外形，先冻。

## 4. `08` Phase 对照

`08` 的 checkbox 与工作树代码不是同一张表。下表按**代码事实**估，不按「OpenSpec change 数量」。

| Phase | 完成 | 缺口 | 说明 |
|---|---:|---:|---|
| P0 Boundary & Contract | **100%** | 0% | D-031～D-048 冻结；parser / Catalog / DAG / fitness 可测。 |
| P1 Host + Broker | **90%** | 10% | 控制面齐，默认不进 boot。 |
| P2 Lifecycle + Storage | **94%** | 6% | P2.1 atomic registry 已随 Notes 闭环落地。D-054 把 P2.5 的**产品 pin/restore**接到三根插头。P2.5 整行（产品 update stage/complete、破坏性 migration 确认）、P2.6 retention、P2.7 crash 未收口。 |
| P3 UI Contribution Runtime | **30%** | 70% | slot / trusted-react 合同有，生产 UI 仍 Core 直挂。本地市场壳是 D-055，不是 P3 contribution runtime。 |
| P4 Engine Pilot | **75%** | 25% | Claude 走到 Disable + 真实装/卸。独立仓库、签名 artifact、删 Core 执行面未做。 |
| P5 Feature Pilot | **78%** | 22% | Notes 走到 Disable + 真实装/卸。知识地图走到 7/9 + D-052 真实装/卸。浏览器 / 画布协议未开。 |
| P6 Registry + Marketplace | **0%** | 100% | 远程冻结。本地 curated UI 骨架另记 D-055，不得把本行勾完。 |
| P7 Migration Waves | **18%** | 82% | Claude / Notes / 知识地图三根走到 7/9 + 真实装/卸。其余 9 根协议未开。 |
| P8 Core Slimming | **0%** | 100% | 禁止。Core 仍是完整单体。 |

P4 75% 容易误导：那是「pilot 协议走完 Disable 且能拔插头」，不是「Claude 已经是独立插件」。P8 0% 才是「Core 瘦身」的诚实数字。

## 5. 缺的进度按优先级

允许线上还能做、且不踩冻结项的缺口：

| 优先级 | 缺口 | 约占允许线 | 状态 |
|---|---|---:|---|
| **已验收（本目标）** | 本地市场 UI | 0 | `plugin-marketplace-local-catalog` / D-055。3 listing 真装真卸；远程仍关。 |
| **已验收（本目标）** | 卸后藏产品壳 + Claude interrupt | ~10% 卸载尺 | `plugin-product-surface-hide-on-uninstall`。入口/面板随 desiredState；Claude 先确认再 interrupt_all。 |
| **已落地（保险丝）** | 三根插头产品 LKG pin/restore | 不抬允许线 | D-054 / `plugin-storage-lkg-product-path`。每根独立 pin；卸后留 pin。不是 P2.5 整行。 |
| P0 下一刀 | Host 全局通电（真 boot，不再 `missing_executable()`） | 单列 | **高风险，另开 change。** 0.8.9 上不建议再开。 |
| P1 | P2.5 整行 / P2.6 retention / P2.7 crash-during-migration | ~6% | 产品 pin 已接；update/retention/crash 未收口。不把 P2 整行勾完。 |
| 冻结 | Slim Claude / Notes / 任何 Core 实现 | 终态 | **禁止。** 缺口 1y。 |
| 冻结 | 远程 Marketplace / 12 插头可写 / 独立仓库发布 | 终态 | **禁止。** D-049 仍有效；D-055 只豁本地 3 listing。 |

## 6. 我们站在哪

```text
已完成（允许线内）
├── 插排图纸与 V1 Contract
├── default-off 的真实 Host / Process / Worker
├── Claude / Notes 走到 Disable-not-delete（源码保留，0 回退保留）
├── 知识地图走到 7/9 + D-052 真实装/卸：默认隔离 sqlite、Disable-not-delete、allowlist 第三根、24 闸门
├── 另外 9 根 later-plugin：外形（过渡仓 + 只读插排），协议 0/9
├── 可视化插排：live 3 可插 / later 9 封口（D-053）
├── 本地市场 UI：3 listing 真装真卸 + 9 即将开放（D-055）
├── 卸后藏产品壳 + Claude uninstall interrupt（`plugin-product-surface-hide-on-uninstall`）
└── 三根插头产品 LKG pin/restore（D-054）：首次 install pin；重启读回；schema 坏回滚；卸后留 pin

当前刀尖
└── 0.8.9 实验面已够用。建议停在这里，把**合同**迁到 0.9，不要在本分支继续 Slim / 独立仓 / Host 真 boot。

刻意不做
├── Slim / 删 Core
├── 远程 Marketplace / 12 插头可写
├── 给 0/9 的浏览器 / 画布 / 其余 CLI 开协议或装假卸载
├── 把 re-export 门面说成已经抽出
└── 把 D-054 说成 P2.5 整行 / P2.6 / P2.7
```

## 7. 证据锚点

| 断言 | 事实源 |
|---|---|
| 九步协议 | [`15` §3](15-implementation-wave-plan.md) |
| Wave 顺序：地图 → 浏览器 → 画布 → 其他 CLI | [`15` §2](15-implementation-wave-plan.md)、[`08` §9](08-migration-roadmap-and-tasks.md) |
| Claude / Notes Disable-not-delete | `src-tauri/src/plugin_runtime/disable.rs`；OpenSpec `plugin-pilot-disable-not-delete` |
| 知识地图 inventory-only | [`inventory/project-map-pilot.md`](inventory/project-map-pilot.md)、`openspec/changes/project-map-plugin-pilot-inventory/` |
| 知识地图 Contract fixture | `packages/plugin-contract/fixtures/valid/project-map-pilot.json`、`openspec/changes/project-map-plugin-pilot-manifest/` |
| 知识地图 Adapter 默认 off | `src-tauri/src/plugin_runtime/project_map_compat.rs`、`openspec/changes/project-map-plugin-compat-adapter/` |
| 知识地图 Dual-run 调用面 | `src-tauri/src/plugin_runtime/project_map_compat.rs` `core()`；`project_map.rs` / `project_map_relations.rs` / `project_memory/**` 的 `*_core`；`openspec/changes/project-map-plugin-dual-run/` |
| 知识地图隔离 namespace | `src-tauri/src/plugin_runtime/project_map_storage.rs`；`openspec/changes/project-map-plugin-storage-namespace/` |
| 知识地图产品默认隔离 | `project_map_compat.rs` `enabled_from(None)=true`；`import_legacy_once`；OpenSpec `project-map-product-default-isolated` |
| 知识地图 Disable-not-delete | `disable.rs` `project_map_core_owner`；OpenSpec `project-map-plugin-disable-not-delete` |
| 24 条 command（6 map + 18 memory） | [`inventory/project-map-pilot.json`](inventory/project-map-pilot.json) |
| re-export ≠ 抽出 | `packages/plugin-project-map`；AppShell 只改 import |
| Host 未进 boot | `src-tauri/src/plugin_runtime/boot.rs` `missing_executable()` |
| Slim / Marketplace 禁止 | [`inventory/real-uninstall-dependency-chain.md`](inventory/real-uninstall-dependency-chain.md) 缺口 1y |
| 假市场回退 | [`09` D-049](09-decision-log.md) |
| Notes-only 真实装/卸 | [`09` D-050](09-decision-log.md)；OpenSpec `plugin-rack-real-install-loop` |
| Notes + Claude 真实装/卸 | [`09` D-051](09-decision-log.md)；OpenSpec `plugin-rack-claude-install-loop` |
| Notes + Claude + Project Map 真实装/卸 | [`09` D-052](09-decision-log.md)；OpenSpec `archive/2026-08-17-project-map-plugin-install-loop` |
| 可视化插排 3/9 | [`09` D-053](09-decision-log.md)；OpenSpec `plugin-rack-visual-strip`；`src/features/extensions/components/PluginRackSection.tsx`；原型 `docs/prototypes/plugin-rack-visual/index.html` |
| 本地市场 UI | [`09` D-055](09-decision-log.md)；OpenSpec `plugin-marketplace-local-catalog`；`src/features/extensions/components/PluginMarketplaceCatalog.tsx`；`src/services/tauri/pluginRack.ts` preview snapshot |
| 卸后藏产品壳 | OpenSpec `plugin-product-surface-hide-on-uninstall`；`src/services/pluginPresence.ts`；`src-tauri/src/plugin_rack.rs` `interrupt_all_claude_sessions` |
| 三根插头产品 LKG | [`09` D-054](09-decision-log.md)；OpenSpec `plugin-storage-lkg-product-path`；`plugin_runtime::{lkg,disk_storage,runtime,install,boot}`；`lib.rs` `boot_host_at(app_home)` |

## 8. 下一刀预告

三根产品 LKG 已落地。0.8.9 上**建议停刀**：合同已够迁 0.9。不要在本分支 Slim、不要开独立仓、不要 Host 真 boot、不要 P2.6 / P2.7、不要远程 Marketplace。不要把 P6 或 P2.5 整行勾完。

## 9. 用户目标校准（2026-08-17）

锁定目标：**插排 100%；插头做 3 个，可插拔，真实；用插件市场可以演示。**

这不是终态 14%，也不是允许线 100%。对上这个目标，当前与剩余如下。

| 目标块 | 现状 | 还差 | 何时算到 |
|---|---|---|---|
| 插排骨架（Wave 0–2 + 只读 12 卡） | **已够用** | Host 真 boot / Marketplace **不进本目标** | 不阻塞可视化 |
| Claude / Notes 真插拔 | **已到** 7/9 + 真实装/卸 | Slim 禁止 | 已交付 |
| 知识地图第三根 | **7/9** + D-052 真实装/卸 | Slim 禁止 | 协议已到 Claude/Notes 同级 |
| 另外 9 根 | 外形前置（过渡仓 + 封口座），协议 **0/9** | **冻住。** 不盘点、不装按钮 | 可视化里只读预期即可 |
| 可视化插排 | **已落地** live 3 + later 9 封口 | 无（本目标内） | D-053；原型 `docs/prototypes/plugin-rack-visual/index.html` |
| 插件市场 UI（本地） | **100%** 3 listing 可装/卸 + 9 即将开放 | 远程市场禁止 | D-055；浏览器可演示内存预览，桌面写 lockfile |
| 卸后藏入口/面板 | **已落地** Notes / Map / Claude 随 desiredState | Slim / 删数据禁止 | `plugin-product-surface-hide-on-uninstall` |
| 三根产品 LKG | **已落地** 各自 pin / 重启读回 / schema 回滚 / 卸后留 pin | P2.5 整行 / P2.6 / P2.7 禁止当成本目标 | D-054 |

下阶段主线（只做这些，按序）：

```text
5D Dual-run     ✅ 产品 command 经门面切流；0 回退保留
5E1 namespace   ✅ 注入根 sqlite + checkpoint restore
5E2 读写合同    ✅ 隔离库 map + memory CRUD / rollback
5E 产品默认     ✅ 未设即 isolated；0 回 Core files
5F Disable      ✅ Core owner disabled；源码与 0 回退保留
5G 真实装/卸    ✅ D-052 allowlist 扩到 com.mossx.project-map；插排出第三组按钮
UI 原型         ✅ docs/prototypes/plugin-rack-visual/index.html；3 真可插拔 + 9 封口
UI 落地         ✅ PluginRackSection 可视化插排；禁止给 0/9 装按钮
市场 UI         ✅ 本地 curated catalog；3 listing 调真实装/卸；远程仍关
产品 LKG        ✅ D-054 三根各自 pin/restore；不是 P2.5 整行
```

到你的目标后，三把尺子大约会变成：

| 尺子 | 现在 | 到目标后 | 仍不算进你的目标 |
|---|---:|---:|---|
| 允许线 | **67%** | **~67%** | Host 真 boot；Slim |
| 真实卸载 | **70%** | **~70%** | 另外 9 根仍卸不掉；数据 Disable-not-delete |
| 终态 | **15%** | **仍 ~15%** | Slim / 独立仓 / 远程 Marketplace / P2.6 / P2.7 |
| Rack 可视化 | **~100%（3/9 口径）** | **~100%（3/9 口径）** | 12 根全可写 |
| 本地市场 UI | **100%** | **100%** | 远程 Registry / 签名 |
| 三根产品 LKG | **已落地** | **已落地** | P2.5 整行 |

禁止把「到你的目标」说成「插件化做完」。
