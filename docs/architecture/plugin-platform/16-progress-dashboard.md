---
type: architecture
status: active
---

# 16 · Pluginization Progress Dashboard

> 主线入口：[Mossx Plugin Platform](README.md)
> 开工图：[15 · Implementation Wave Plan](15-implementation-wave-plan.md)
> 阶段图：[08 · Migration Roadmap](08-migration-roadmap-and-tasks.md)
> 卸载链：[inventory/real-uninstall-dependency-chain.md](inventory/real-uninstall-dependency-chain.md)
> 快照日期：**2026-08-17**
> 证据 change：`project-map-plugin-compat-adapter`（知识地图 5C Adapter）
> 验收：`ProjectMapCompatAdapter` exact 24 command；`MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off；`command_registry` 仍指 Core。`openspec validate project-map-plugin-compat-adapter --strict`。无 `project_map*` / `project_memory*` 生产 diff。
> 工作树：`feature/plugin-mossx-0.8.9`

本文是**带日期的进度总视图**，不是产品行为 SoT。行为以当前代码和 OpenSpec 为准。百分比是人工校准的工程判断，用来防止把「200+ OpenSpec change」误读成「产品已经插件化」。

刷新规则：每根插头走完 `15` §3 的一步，或 `08` 某个 Phase 的验收口径变化时，改本页数字并更新快照日期与证据 commit。禁止只改百分比不改证据。

## 1. 先看三个分母

同一件事用三个尺子量，数字差一个数量级。混用就会把插排骨架当成已经拔插头。

| 尺子 | 当前 | 缺口 | 分母是什么 |
|---|---:|---:|---|
| **允许线（Allowed line）** | **52%** | **48%** | `15` §3 走到 Disable + Notes/Claude 真实 install/uninstall + 知识地图 Adapter。Slim / LKG / Marketplace 不计入。 |
| **终态插件化（End-state）** | **14%** | **86%** | 独立仓库 + Slim + LKG + Marketplace + 其余插头全部迁出。这是架构终态。 |
| **真实卸载（Real uninstall）** | **40%** | **60%** | Notes + Claude 两根诚实闭环。later-plugin 仍卸不掉。Claude 生命周期是 worker isolate，per-turn CLI 仍 Process Entry。 |

读法：

- 问「这波还能干什么」→ 看允许线 52%。
- 问「离可安装/可卸载的插件生态还有多远」→ 看终态 14%。
- 问「现在能不能从产品里拔掉 Claude / Notes / 知识地图」→ 看真实卸载 40%（Notes + Claude；地图还不行）。

```text
允许线 ██████████░░░░░░░░░░  52%
终态   ███░░░░░░░░░░░░░░░░░  14%
卸载   ████████░░░░░░░░░░░░  40%
```

## 2. 平台层（插排，不是插头）

| 层 | 完成 | 缺口 | 口径 |
|---|---:|---:|---|
| Wave 0 插排图纸 | **100%** | 0% | inventory + Manifest parser + fitness。图纸在，产品没减。 |
| Wave 1 Extension Host | **90%** | 10% | Host / Worker / Process / Composite **真实实现**，标注 *not in product path / not in boot*。 |
| Wave 2 Storage / checkpoint / lifecycle | **92%** | 8% | namespace + checkpoint + **atomic contribution registry** 已落地。破坏性 migration、LKG 未收口。 |
| Host 产品通电路 | **25%** | 75% | Host 仍 `enabled=false`。产品 setup `restore_allowlisted` 给 Notes + Claude 通电；Claude 只 start `claude-worker`。一般 `activate` 仍 host-disabled。 |
| Rack UI | **75%** | 25% | Notes 与 Claude 有真实安装/卸载按钮。其余 10 根只读。远程 Marketplace 仍关。 |
| Marketplace / Registry | **0%** | 100% | 缺口 1y。当前约束禁止开。 |

```text
Wave 0     ████████████████████  100%
Wave 1     ██████████████████░░   90%
Wave 2     ██████████████████░░   92%
Host 通电  █████░░░░░░░░░░░░░░░   25%
Rack UI    ███████████████░░░░░   75%
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

当前约束：**禁止第 8 步 Slim，禁止 Marketplace。** 允许线的终点是第 7 步 Disable-not-delete。第 8–9 步只出现在终态尺子里。

| 插头 | 协议步 | 允许线 | 抽出 / Slim | 产品 owner |
|---|---:|---:|---:|---|
| Claude `com.mossx.engine.claude` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `cmd.spawn` |
| Notes `com.mossx.notes` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `note_card_*_core` |
| 知识地图 `com.mossx.project-map` | 3 / 9 | **33%** | **0%** | Core Active。Adapter 默认 off；尚未 Dual-run / Disable / 真实装/卸 |
| 浏览器 | 0 / 9 | **0%** | 0% | Core |
| 意图画布 | 0 / 9 | **0%** | 0% | Core |
| 其余 6 个 CLI | 0 / 9 | **0%** | 0% | Core |
| 后续 feature（Kanban / Git 高级流 / …） | 0 / 9 | **0%** | 0% | Core |

Claude / Notes 的 82% 读作：**协议走到 Disable，并且产品能真实装/卸。** 源码和回退都还在，不是已经迁出。知识地图刚做完 Adapter，下一步才是 Dual-run。另外 9 根协议 0/9，只做了外形，先冻。

## 4. `08` Phase 对照

`08` 的 checkbox 与工作树代码不是同一张表。下表按**代码事实**估，不按「OpenSpec change 数量」。

| Phase | 完成 | 缺口 | 说明 |
|---|---:|---:|---|
| P0 Boundary & Contract | **100%** | 0% | D-031～D-048 冻结；parser / Catalog / DAG / fitness 可测。 |
| P1 Host + Broker | **90%** | 10% | 控制面齐，默认不进 boot。 |
| P2 Lifecycle + Storage | **92%** | 8% | P2.1 atomic registry 已随 Notes 闭环落地；P2.4–P2.6 LKG / 破坏性 migration 未收口。 |
| P3 UI Contribution Runtime | **30%** | 70% | slot / trusted-react 合同有，生产 UI 仍 Core 直挂。Marketplace UI 禁止。 |
| P4 Engine Pilot | **75%** | 25% | Claude 走到 Disable + 真实装/卸。独立仓库、签名 artifact、删 Core 执行面未做。 |
| P5 Feature Pilot | **50%** | 50% | Notes 走到 Disable + 真实装/卸。知识地图完成 Inventory + Contract + Adapter。浏览器 / 画布协议未开。 |
| P6 Registry + Marketplace | **0%** | 100% | 冻结。 |
| P7 Migration Waves | **10%** | 90% | 只动了 Claude / Notes / 地图 Inventory+Contract+Adapter。其余 9 根协议未开。 |
| P8 Core Slimming | **0%** | 100% | 禁止。Core 仍是完整单体。 |

P4 75% 容易误导：那是「pilot 协议走完 Disable 且能拔插头」，不是「Claude 已经是独立插件」。P8 0% 才是「Core 瘦身」的诚实数字。

## 5. 缺的进度按优先级

允许线上还能做、且不踩冻结项的缺口：

| 优先级 | 缺口 | 约占允许线 | 状态 |
|---|---|---:|---|
| **刚落地** | 知识地图 5C Adapter | ~4% | `project-map-plugin-compat-adapter`。默认 off，不接 Host，不假装装/卸。 |
| P0 下一刀 | 知识地图 Dual-run → Disable + 真实装/卸 | ~15% | 推到 Claude / Notes 同级（7/9）再停。另外 9 根协议冻在 0/9。 |
| P0 收口 | 可视化插排：3 根真实可用，9 根只读预期 | 单列 | 第三根到 7/9 之后做。禁止给 0/9 装按钮。 |
| P1 | Wave 2 收口：破坏性 migration、LKG 骨架 | ~6% | atomic registry 已随 Notes/Claude 闭环落地。 |
| P1 | Host 全局通电（真 boot，不再 `missing_executable()`） | 单列 | **高风险，另开 change。** 不是本刀。 |
| 冻结 | Slim Claude / Notes / 任何 Core 实现 | 终态 | **禁止。** 缺口 1y。 |
| 冻结 | Marketplace / 12 插头可写 / 独立仓库发布 | 终态 | **禁止。** D-049 仍有效；D-051 只豁 Notes + Claude。 |

## 6. 我们站在哪

```text
已完成（允许线内）
├── 插排图纸与 V1 Contract
├── default-off 的真实 Host / Process / Worker
├── Claude / Notes 走到 Disable-not-delete（源码保留，0 回退保留）
├── 知识地图 Inventory + Contract + Adapter（P4.7-30～32）：24 command，默认 off
└── 另外 9 根 later-plugin：外形（过渡仓 + 只读插排），协议 0/9

当前刀尖
└── 5C 已落地。诚实下一刀：知识地图 Dual-run（仍默认 Core owner）。第三根到 Disable + 真实装/卸后停，再做可视化插排（3 真 / 9 只读预期）。

刻意不做
├── Slim / 删 Core
├── Marketplace / 12 插头可写
├── 给 0/9 的浏览器 / 画布 / 其余 CLI 开协议或装假卸载
└── 把 re-export 门面说成已经抽出
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
| 24 条 command（6 map + 18 memory） | [`inventory/project-map-pilot.json`](inventory/project-map-pilot.json) |
| re-export ≠ 抽出 | `packages/plugin-project-map`；AppShell 只改 import |
| Host 未进 boot | `src-tauri/src/plugin_runtime/boot.rs` `missing_executable()` |
| Slim / Marketplace 禁止 | [`inventory/real-uninstall-dependency-chain.md`](inventory/real-uninstall-dependency-chain.md) 缺口 1y |
| 假市场回退 | [`09` D-049](09-decision-log.md) |
| Notes-only 真实装/卸 | [`09` D-050](09-decision-log.md)；OpenSpec `plugin-rack-real-install-loop` |
| Notes + Claude 真实装/卸 | [`09` D-051](09-decision-log.md)；OpenSpec `plugin-rack-claude-install-loop` |

## 8. 下一刀预告

知识地图 5C Adapter 已落地。诚实下一刀：知识地图 Dual-run（仍默认 Core owner）。第三根推到 Disable + 真实装/卸后再做可视化插排（3 真 / 9 只读预期）。不要给 0/9 插头装假按钮。不要开 Marketplace，不要 Slim。

## 9. 用户目标校准（2026-08-17）

锁定目标：**插排骨架已够用；三根真插头走到 Claude/Notes 同级；另外 9 根冻成只读预期；最后做完整可视化插排。**

这不是终态 14%，也不是允许线 100%。对上这个目标，当前与剩余如下。

| 目标块 | 现状 | 还差 | 何时算到 |
|---|---|---|---|
| 插排骨架（Wave 0–2 + 只读 12 卡） | **已够用** | Host 真 boot / LKG / Marketplace **不进本目标** | 不阻塞可视化 |
| Claude / Notes 真插拔 | **已到** 7/9 + 真实装/卸 | Slim 禁止 | 已交付 |
| 知识地图第三根 | **3/9**（Inventory + Contract + Adapter） | Dual-run → Conformance → Disable → D-052 真实装/卸 | 到 7/9 且插排可写 |
| 另外 9 根 | 外形前置（过渡仓 + 只读卡），协议 **0/9** | **冻住。** 不盘点、不装按钮 | 可视化里只读预期即可 |
| 可视化插排 | Extensions 设置列表，2 真 / 10 只读 | 先 HTML 原型，再做成 3 真 / 9 只读预期 | 第三根可写之后 |

下阶段主线（只做这些，按序）：

```text
5D Dual-run     产品 command 经门面切流；默认仍 Core；0 回退保留
5E Conformance  map + memory 的 storage / rollback / 读写合同
5F Disable      Core owner disabled；源码与 0 回退保留
5G 真实装/卸    D-052 allowlist 扩到 com.mossx.project-map；插排出第三组按钮
UI 原型         独立 HTML；3 真可插拔 + 9 只读预期；引用 design tokens
UI 落地         现有 PluginRackSection 升级为可视化插排，禁止给 0/9 装按钮
```

到你的目标后，三把尺子大约会变成：

| 尺子 | 现在 | 到目标后 | 仍不算进你的目标 |
|---|---:|---:|---|
| 允许线 | 52% | **~67%** | Wave 2 LKG、Host 真 boot |
| 真实卸载 | 40% | **~60%** | 另外 9 根仍卸不掉 |
| 终态 | 14% | **仍 ~14%** | Slim / 独立仓 / Marketplace |
| Rack 可视化 | 75% | **~100%（3/9 口径）** | 远程市场、12 根全可写 |

禁止把「到你的目标」说成「插件化做完」。
