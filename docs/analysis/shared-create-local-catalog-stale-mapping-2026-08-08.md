---
type: analysis
status: active
---

<!-- DOC-LIFECYCLE: active-incident-fix -->
> [!NOTE]
> **Lifecycle: Active fix reference.** OpenSpec change：`fix-shared-create-default-provider-catalog`。  
> Current contract 以该 change 的 specs/design 与代码为准；本文记录现象、根因与验收口径。

# Shared 创建 / 打开历史：本地渠道模型 catalog 与展示 mapping 串台

> **对照源码日期**：2026-08-08  
> **产品症状**：Shared CLI 选 Claude 创建时，渠道 chip 为「本地配置」但模型列表像过期 MiniMax/DeepSeek；打开历史 Shared 后文案与图标再与渠道不一致  
> **姊妹文**：[Native vs Shared](./native-vs-shared-cli-explained.md) · [Shared model picker native fallback](./shared-session-model-picker-native-fallback-2026-08-02.md) · [Native provider select](./native-session-provider-select-vs-disk-overwrite-2026-07-31.md)

---

## 0. 一句话

Shared **创建** 用裸 `getEngineModels(engine)` 吃 engine status 过期 cache，却硬标「本地配置」；**打开历史** 时 catalog 已按 profile 刷新，但 Claude 列表**文案/图标**仍优先全局 `claude-model-mapping`（上一 managed 残留）。修复分三层：创建权威 catalog、打开同步 mapping、文案/图标同源 catalog runtime。

---

## 1. 现象矩阵

| 场景 | Chip | 列表文案 | 图标 | 根因层 |
|------|------|----------|------|--------|
| Shared 创建 Claude 默认 | 本地配置 | 过期 MiniMax 等 | 常跟着错 | 创建：裸 getEngineModels + 写死 local builder |
| 打开历史 Shared（本地 + settings=k3） | 本地配置 | 曾串 MiniMax/DeepSeek；修后 k3 | 曾 DeepSeek 鲸；修后 Kimi | 打开：mapping 未 sync；图标先 mapping 后 runtime |
| 打开历史 / 新建后切渠道 | 目标渠道 | 正确 | 正确 | 既有 handleChannelSwitch 已 sync + ensure |

Native 创建后「切供应商就对」：managed 走 provider-scoped 实时 catalog，并 `syncClaudeModelMappingForProfile`。

---

## 2. 根因

### 2.1 创建路径（L1）

```text
handleStartSharedConversation
  → getEngineModels(engine)           // 无 profile、无 forceRefresh
  → buildLocalSharedSessionInitialTarget(..., "本地配置")
```

Claude 本地在 backend 回落 `engine_manager` status cache；未 forceRefresh 时返回过期 `status.models`。

### 2.2 打开历史展示（L2）

- `ensureModels` + local forceRefresh 已把 runtime 写入 `model.model`
- 文案旧逻辑：本地行优先 **localStorage mapping**
- 图标旧逻辑：`resolveModelIdForIcon` **先 mapping 后 runtime**
- 打开历史**不**调用 `syncClaudeModelMappingForProfile`（只有切渠道才调）

于是：chip 正确、runtime 正确，标签/图标仍画上一渠道。

### 2.3 短 id 品牌（L3 附带）

`k3` / `k3-256k` 未命中 `kimi` 正则时，在 mapping 串到 deepseek 后会稳定画鲸。修图标权威后补 `^k3(?:-…)?$` → kimi。

---

## 3. 修复契约（实现锚点）

| 层 | 行为 | 代码 |
|----|------|------|
| 创建 | 有序 Provider **第一项** + profile 权威 models（local `forceRefresh`）；Claude sync mapping | `resolveSharedSessionCreateInitialTarget.ts` · `useAppShellSections.ts` |
| 打开 | **不 reseed** last `selectedTarget`；hydrate 后 ensure + Claude sync mapping | `ChatInputBox.tsx` ensure effect；`hydrateSharedTargetState` 不变 |
| 文案 | catalog runtime（`model.model≠id` 或 managed）优先于 mapping | `resolveClaudeCatalogModelLabel` |
| 图标 | 与文案同源 | `resolveModelIdForIcon` |
| 品牌 | `k3` 短 id → kimi | `providerBrandIcon.ts` |

OpenSpec：`openspec/changes/fix-shared-create-default-provider-catalog/`  
（`shared-session-engine-selection` + `shared-execution-target` deltas）

---

## 4. 验收口径

1. Shared 创建 Claude：默认第一 Provider；models 与 Atomic 切到该渠道一致。  
2. 打开历史 Shared：回显 last target；本地渠道列表 runtime/图标与当前 profile catalog 一致，不被上一 managed mapping 串台。  
3. 本地 settings 真映射到 MiniMax/DeepSeek/k3 时，chip=本地 + 该 runtime **是磁盘真相**，不是 bug。  
4. 自动化：`initialTarget` / `resolveSharedSessionCreate` / `resolveClaudeCatalogModelLabel` / `resolveModelIdForIcon` 相关 vitest。

---

## 5. 非目标（刻意未改）

- Home `create-session` Atomic 对 local 的模块 cache 策略（可另开 change）
- 发送 / Badge / recovery / Native 续接语义
- 用全局 `activeEngine` 冒充 Shared display authority

---

## 6. 变更日志

| 日期 | 说明 |
|------|------|
| 2026-08-08 | 创建权威 catalog + 打开 mapping sync + 文案/图标同源；人工验收通过 |
