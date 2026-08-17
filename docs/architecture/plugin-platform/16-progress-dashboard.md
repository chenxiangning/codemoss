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
> 证据 change：`plugin-rack-real-install-loop`（Notes-only 真实安装/卸载）
> 验收：focused rust 55 passed + vitest 3 passed + `openspec validate --strict`
> 工作树：`feature/plugin-mossx-0.8.9`

本文是**带日期的进度总视图**，不是产品行为 SoT。行为以当前代码和 OpenSpec 为准。百分比是人工校准的工程判断，用来防止把「200+ OpenSpec change」误读成「产品已经插件化」。

刷新规则：每根插头走完 `15` §3 的一步，或 `08` 某个 Phase 的验收口径变化时，改本页数字并更新快照日期与证据 commit。禁止只改百分比不改证据。

## 1. 先看三个分母

同一件事用三个尺子量，数字差一个数量级。混用就会把插排骨架当成已经拔插头。

| 尺子 | 当前 | 缺口 | 分母是什么 |
|---|---:|---:|---|
| **允许线（Allowed line）** | **42%** | **58%** | `15` §3 走到 Disable（第 7 步）+ Notes-only 真实 install/uninstall。Slim / LKG / Marketplace 不计入。 |
| **终态插件化（End-state）** | **14%** | **86%** | 独立仓库 + Slim + LKG + Marketplace + 其余插头全部迁出。这是架构终态。 |
| **真实卸载（Real uninstall）** | **20%** | **80%** | Notes 一根诚实闭环：lockfile + Host Ready/Uninstalled + contribution + `note_card_*` 闸门。Claude 与 later-plugin 仍卸不掉。 |

读法：

- 问「这波还能干什么」→ 看允许线 42%。
- 问「离可安装/可卸载的插件生态还有多远」→ 看终态 14%。
- 问「现在能不能从产品里拔掉 Claude / Notes / 知识地图」→ 看真实卸载 20%（只有 Notes）。

```text
允许线 ████████░░░░░░░░░░░░  42%
终态   ███░░░░░░░░░░░░░░░░░  14%
卸载   ████░░░░░░░░░░░░░░░░  20%
```

## 2. 平台层（插排，不是插头）

| 层 | 完成 | 缺口 | 口径 |
|---|---:|---:|---|
| Wave 0 插排图纸 | **100%** | 0% | inventory + Manifest parser + fitness。图纸在，产品没减。 |
| Wave 1 Extension Host | **90%** | 10% | Host / Worker / Process / Composite **真实实现**，标注 *not in product path / not in boot*。 |
| Wave 2 Storage / checkpoint / lifecycle | **92%** | 8% | namespace + checkpoint + **atomic contribution registry** 已落地。破坏性 migration、LKG 未收口。 |
| Host 产品通电路 | **20%** | 80% | Host 仍 `enabled=false`。产品 setup `restore_allowlisted` 只给 Notes 通电；一般 `activate` 仍 host-disabled。 |
| Rack UI | **70%** | 30% | Notes 有真实安装/卸载按钮。其余 11 根只读。远程 Marketplace 仍关。 |
| Marketplace / Registry | **0%** | 100% | 缺口 1y。当前约束禁止开。 |

```text
Wave 0     ████████████████████  100%
Wave 1     ██████████████████░░   90%
Wave 2     ██████████████████░░   92%
Host 通电  ████░░░░░░░░░░░░░░░░   20%
Rack UI    ██████████████░░░░░░   70%
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
| Claude `com.mossx.engine.claude` | 7 / 9 | **78%** | **0%** | Core；默认 `disabled`，`0` 回 `cmd.spawn` |
| Notes `com.mossx.notes` | 7 / 9 | **82%** | **0%** | Core 源码仍在；产品可真实装/卸；`0` 回 `note_card_*_core` |
| 知识地图 `com.mossx.project-map` | 1 / 9 | **11%** | **0%** | Core Active。`@mossx/plugin-project-map` 是 re-export，不是抽出 |
| 浏览器 | 0 / 9 | **0%** | 0% | Core |
| 意图画布 | 0 / 9 | **0%** | 0% | Core |
| 其余 6 个 CLI | 0 / 9 | **0%** | 0% | Core |
| 后续 feature（Kanban / Git 高级流 / …） | 0 / 9 | **0%** | 0% | Core |

Claude / Notes 的 78% 读作：**协议走到 Disable，源码和回退都还在。** 不是 78% 已经迁出。知识地图刚做完 Inventory，下一步才是 Contract。

## 4. `08` Phase 对照

`08` 的 checkbox 与工作树代码不是同一张表。下表按**代码事实**估，不按「OpenSpec change 数量」。

| Phase | 完成 | 缺口 | 说明 |
|---|---:|---:|---|
| P0 Boundary & Contract | **100%** | 0% | D-031～D-048 冻结；parser / Catalog / DAG / fitness 可测。 |
| P1 Host + Broker | **90%** | 10% | 控制面齐，默认不进 boot。 |
| P2 Lifecycle + Storage | **92%** | 8% | P2.1 atomic registry 已随 Notes 闭环落地；P2.4–P2.6 LKG / 破坏性 migration 未收口。 |
| P3 UI Contribution Runtime | **30%** | 70% | slot / trusted-react 合同有，生产 UI 仍 Core 直挂。Marketplace UI 禁止。 |
| P4 Engine Pilot | **70%** | 30% | Claude 走到 Disable-not-delete。独立仓库、签名 artifact、删 Core 执行面未做。 |
| P5 Feature Pilot | **45%** | 55% | Notes 走到 Disable + 真实装/卸。知识地图只完成 Inventory。浏览器 / 画布未开。 |
| P6 Registry + Marketplace | **0%** | 100% | 冻结。 |
| P7 Migration Waves | **8%** | 92% | 只动了 Claude / Notes / 地图盘点。其余 owner 未迁。 |
| P8 Core Slimming | **0%** | 100% | 禁止。Core 仍是完整单体。 |

P4 70% 容易误导：那是「pilot 协议走完 Disable」，不是「Claude 已经是独立插件」。P8 0% 才是「Core 瘦身」的诚实数字。

## 5. 缺的进度按优先级

允许线上还能做、且不踩冻结项的缺口：

| 优先级 | 缺口 | 约占允许线 | 状态 |
|---|---|---:|---|
| **刚落地** | Notes-only 真实 install/uninstall | ~4% | `plugin-rack-real-install-loop`。D-050 豁口。 |
| P0 下一刀 | 用 Notes 当模板改下一根插头，或知识地图 5B | ~4% | project-map Wave 5B **暂停**。先复用 Notes 闭环。 |
| P0 | 知识地图 5C–5G（Adapter → Disable） | ~21% | 5B 之后一根根走。 |
| P1 | Wave 2 收口：破坏性 migration、LKG 骨架 | ~6% | atomic registry 已随本刀落地。 |
| P1 | Host 全局通电（真 boot，不再 `missing_executable()`） | 单列 | **高风险，另开 change。** 不是本刀。 |
| 冻结 | Slim Claude / Notes / 任何 Core 实现 | 终态 | **禁止。** 缺口 1y。 |
| 冻结 | Marketplace / 12 插头可写 / 独立仓库发布 | 终态 | **禁止。** D-049 仍有效；D-050 只豁 Notes 一根。 |

## 6. 我们站在哪

```text
已完成（允许线内）
├── 插排图纸与 V1 Contract
├── default-off 的真实 Host / Process / Worker
├── Claude / Notes 走到 Disable-not-delete（源码保留，0 回退保留）
└── 知识地图 Inventory（P4.7-30）：24 条 command，memory 跟 map，intent-canvas / search 不跟

当前刀尖
└── `plugin-rack-real-install-loop`：Notes 真实装/卸已接线。下一根插头照抄此模板。知识地图 5B 暂停。

刻意不做
├── Slim / 删 Core
├── Marketplace / 12 插头可写
├── Claude 第一根闭环
└── 把 re-export 门面说成已经抽出
```

## 7. 证据锚点

| 断言 | 事实源 |
|---|---|
| 九步协议 | [`15` §3](15-implementation-wave-plan.md) |
| Wave 顺序：地图 → 浏览器 → 画布 → 其他 CLI | [`15` §2](15-implementation-wave-plan.md)、[`08` §9](08-migration-roadmap-and-tasks.md) |
| Claude / Notes Disable-not-delete | `src-tauri/src/plugin_runtime/disable.rs`；OpenSpec `plugin-pilot-disable-not-delete` |
| 知识地图 inventory-only | [`inventory/project-map-pilot.md`](inventory/project-map-pilot.md)、`openspec/changes/project-map-plugin-pilot-inventory/` |
| 24 条 command（6 map + 18 memory） | [`inventory/project-map-pilot.json`](inventory/project-map-pilot.json) |
| re-export ≠ 抽出 | `packages/plugin-project-map`；AppShell 只改 import |
| Host 未进 boot | `src-tauri/src/plugin_runtime/boot.rs` `missing_executable()` |
| Slim / Marketplace 禁止 | [`inventory/real-uninstall-dependency-chain.md`](inventory/real-uninstall-dependency-chain.md) 缺口 1y |
| 假市场回退 | [`09` D-049](09-decision-log.md) |
| Notes-only 真实装/卸 | [`09` D-050](09-decision-log.md)；OpenSpec `plugin-rack-real-install-loop` |

## 8. 下一刀预告

本刀 `plugin-rack-real-install-loop` 已立项并实施。知识地图 5B **暂停**。

下一根插头照抄 Notes 模板：lockfile desired + `activate_allowlisted` + atomic contribution + 产品命令闸门 + 插排单按钮。不要开 Marketplace，不要 Slim。
