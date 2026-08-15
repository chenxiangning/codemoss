---
type: implementation
status: active
---

# 15 · Implementation Wave Plan

> 主线入口：[Mossx Plugin Platform](README.md)
> Contract：[14 · V1 Contract Freeze](14-v1-contract-freeze.md)
> 路线图：[08 · Migration Roadmap](08-migration-roadmap-and-tasks.md)
> Base branch：`feature/plugin-mossx-0.8.9`
> 日期：2026-08-16

## 1. 能不能开工

**可以开工。** Contract Freeze（D-031～D-048）已完成，字段级事实源是 `14`。

**不能按文档 13 的“已经减完”开工。** 当前工作树仍是完整单体：

| 证据 | 事实 |
|---|---|
| `src/features/*` | 62 个 feature 目录仍在（browser-agent、note-cards、intent-canvas、project-map、codex、kanban…） |
| `src-tauri/src/engine/*` | Claude / Codex / Gemini / Grok / Kimi / OpenCode / Pi 全部还在 |
| `src-tauri/src/command_registry.rs` | Native command 面未收缩 |
| `src/types/engine.ts` | `EngineType` 仍是 7 值 union |
| `src/core-shell/` | 空目录 |
| `scripts/check-core-shell-boundary.mjs` | 不存在 |
| `openspec/changes/reduce-to-core-shell-with-claude-compat` | 不存在 |
| `/tmp/mossx-core-subtraction-20260815/` | 本机有一份未入库的减法残留，不是 Git 事实 |

`13` 描述的是一次本机减法实验，不是本工作树的当前状态。实施必须以 **当前完整单体** 为 base。

## 2. 建议怎么干

**主线：先插排，再一根根拔插头，拔的同时瘦身。禁止先整树删空再加回来。**

```text
Wave 0  插排图纸
        0A inventory + fitness + 无产品删除的瘦身
        0B Manifest / Catalog / DAG parser（不接生产路径）

Wave 1  插排本体
        Extension Host + MXPC/MXPD + Broker 只读面
        现有功能零行为变化

Wave 2  插座通电
        Storage Namespace + checkpoint + lifecycle 状态机
        仍不迁业务

Wave 3  第一根插头：Claude Engine
        独立仓库 + compatibility adapter 双路径
        稳定后 disable-not-delete，再删 Core 实现

Wave 4  第二根插头：Notes
        带 Storage / Trusted React system slot
        验证 UI + checkpoint + 回退

Wave 5+ 其余插头按风险排序一根根拔
        知识地图 → 浏览器 → 画布 → 其他 CLI
        每拔一根，顺手删该域的死代码 / 测试 / i18n / CSS
```

不采用的路线：

| 路线 | 为什么拒绝 |
|---|---|
| 先按 13 整树删空，再加插件回来 | 当前工作树不是那份减法；用户数据与 7 个 Engine 会一起炸；没有插座就搬家电 |
| 先做 Marketplace UI | 没有隔离、签名、checkpoint，市场只会放大风险 |
| 一个大分支“插件化全部” | 无法独立验收、无法回退 |
| 把已删 CLI 拷回 Core 再迁 | D-048 明确禁止 |

## 3. 每根插头的切换协议

对每一个要拔出的能力，固定走同一套，禁止跳步：

```text
1. Inventory     标 owner、command、store、CSS、i18n、测试、数据路径
2. Contract      该能力用哪些 mossx.* / slot / entry
3. Adapter       Core 内 compatibility adapter（单 owner，双路径不同时写）
4. Pilot repo    独立仓库或 packages/ 过渡仓，打 .mossx-plugin
5. Dual-run      feature flag：旧路径 / 新路径，同一时刻只有一个 active owner
6. Conformance   stream / interrupt / storage / rollback / first-interactive
7. Disable       Core 实现 disabled，源码先留着（disable-not-delete）
8. Slim          删 Core 实现、测试、i18n、CSS、dead command、engine 分支
9. LKG           lockfile pin + 一键回退上一 artifact
```

瘦身挂在第 8 步，不单独开“先删光再重构”的 Wave。

## 4. Wave 与 OpenSpec 对照

| Wave | OpenSpec change | 解锁 | 瘦身范围 |
|---|---|---|---|
| 0A | `plugin-kernel-ownership-inventory` | 插座图纸、fitness、死代码清单 | 只删 **已证明无引用** 的脚本/注释/空目录，不删产品 |
| 0B | `plugin-manifest-v1-parser` | Manifest/Catalog/DAG 可测 parser | 无产品删除 |
| 1 | `plugin-ipc-v1-framing` + `extension-host-activation-supervisor` | Host 可跑、不接业务 | 启动链上证明未使用的 probe / 同步复制可关 |
| 2 | `plugin-storage-checkpoint-v1` | 每插件 namespace | 禁止再往 Core DB 加 `plugin_<name>_*` 表 |
| 3 | `engine-claude-pilot` | 第一根 Engine 插头 | Claude 稳定后删 `engine/claude*` 出 Core |
| 4 | `notes-feature-pilot` | 第一根 Feature 插头 | 删 `note-cards` 出 Core |
| 5+ | 每插头一个 change | 知识地图 / 浏览器 / 画布 / 其他 CLI | 跟插头走 |

一次只开一个 Wave 的实现；0A 与 0B 可并行，因为 0B 不依赖产品 inventory 的完成，只依赖 `14`。

## 5. 当前工作树 ownership 初稿

这是 Wave 0A 要钉死的分类，不是已经迁出的状态。

### 5.1 必须留 Core（第一阶段）

| 域 | 当前落点（不完全） |
|---|---|
| App lifecycle / startup | `src/bootstrapApp.tsx`、`startup_guard.rs` |
| App Shell / slots | `src/app-shell/**` |
| Session / sidebar / conversation | `src/features/threads`、`session_management.rs`、`session_index` |
| Composer | `src/features/composer` |
| Workspace / file preview / search | `src/features/workspaces`、`src/features/files`、`src/features/search` |
| Git foundation | `src/features/git`、`src-tauri/src/git`（不含 PR / AI commit / History 高级流） |
| Engine Contract | `src-tauri/src/engine/{adapter_registry,commands,events}.rs` |
| Plugin Kernel（待建） | 尚无 `src/plugin-kernel` / `src-tauri/src/plugin_runtime` |

### 5.2 第一批拔出（Pilot）

| 域 | 当前落点 | 目标 pluginId |
|---|---|---|
| Claude adapter + history | `engine/claude*`、`claude_history*`、`claude_commands*` | `com.mossx.engine.claude` |
| Notes | `src/features/note-cards`、`note_cards.rs` | `com.mossx.notes` |

### 5.3 随后拔出（一根根，不提前删）

| 域 | 当前落点 | 目标 pluginId |
|---|---|---|
| Codex / Gemini / Grok / Kimi / OpenCode / Pi | `engine/{codex,gemini,grok,kimi,opencode,pi}*`、`src/features/{codex,opencode}` | `com.mossx.engine.<name>` |
| 内置浏览器 | `src/features/browser-agent`、`browser_agent` | `com.mossx.browser` |
| 意图画布 | `src/features/intent-canvas` | `com.mossx.intent-canvas` |
| 项目知识地图 / memory | `src/features/project-map`、`project_map*.rs`、`project_memory` | `com.mossx.project-map` |
| 高级 Git | `src/features/git-history`、PR / AI commit | 后续 plugin |
| Kanban / Spec / Multi-agent / Collab | 对应 `src/features/*` | 后续 plugin |
| Computer Use / Dictation / Email / Web Service | 对应 Rust + feature | 后续 plugin |
| TokenTracker / MCP dashboard | `src/features/extensions/tokentracker-dashboard` | 后续；Extensions 壳留 Core |

### 5.4 Wave 0A 即可瘦的候选（必须先证明无引用）

- 空目录 `src/core-shell/`
- 文档 13 与工作树不符的过期断言（改文档，不删产品）
- 已无 import 的脚本、重复 engine 扫描、注释掉的启动 probe
- **禁止**在 0A 删除任何 feature / engine / command

## 6. 每个 Wave 的 Gate

沿用 `08` §13，外加本计划特有的：

1. 基线测试绿，或已隔离记录。
2. 本 Wave **没有**扩大 AppShell 根高频状态。
3. 本 Wave **没有**让 Marketplace / 普通插件进入 first-interactive。
4. 拔插头时同一数据域只有一个 active owner。
5. 瘦身只删除 inventory 标成 `retired-unreferenced` 的文件。
6. `openspec validate <change-id> --strict --no-interactive` 通过。

## 7. 立即开始的两件事

1. 实现 `plugin-kernel-ownership-inventory`（Wave 0A）。
2. 实现 `plugin-manifest-v1-parser`（Wave 0B）。

两者都不改用户可见产品行为。0B 完成后才允许开 Wave 1 Host。
