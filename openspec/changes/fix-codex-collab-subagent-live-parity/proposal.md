## Why

Codex CLI multi-agent collab 在 **对话结束后** 历史重开能正确渲染 SubAgent 小队（persona 卡 + 昵称 + 详情），但在 **实时对话** 的 wait 阶段幕布常只剩裸 `Collab: wait` 行、右侧 Status Agents tab 缺失。侧栏树已由 `subAgentActivity` / `thread/started` 收敛，幕布与 Status 仍只信残缺 live `collabToolCall`，与 history 重建路径不对称。

其他 CLI（Claude / Grok / Kimi / Gemini / OpenCode）在实时与历史阶段均已稳定，本变更 MUST 限定 Codex collab 路径，禁止扩大识别面或改动跨引擎默认行为。

> **Supersession note（2026-08-08）**：幕布「合成小队卡」目标已被 [`retire-canvas-subagent-squad-grid`](../retire-canvas-subagent-squad-grid/proposal.md) **部分 supersede**（幕布不再注入 Squad）。本 change **仍有效**：StatusPanel 子树种子化、wait/close 非 persona、live collab id 归一；live wait 期子代理可见性改由 strip / StatusPanel 承担。

## 目标与边界

- **目标**：Codex native（及 Shared 上 Codex owner）在 **live wait 主导阶段** 也能稳定展示子代理（Status Agents + Composer run-status），语义与 history 结束态对齐；**幕布不再要求 N 张 persona 卡**（见 supersession）。
- **边界**：只改 frontend presentation / status aggregation / collab id 归一；不改 app-server 协议、不改 JSONL、不改其他引擎 adapter。
- **验收主路径**：实时 fan-out → 长时间 `Collab: wait` → 侧栏已有 N 个子代理时，Status Agents / strip 可见 N 项；turn 结束后无双表面回归。

## 非目标

- 不把 `wait` / `close` 改成 persona 卡（保持 lifecycle 工具语义）。
- 不重构 Claude Task/Agent、Grok `spawn_subagent`、Kimi swarm 的 live/history 路径。
- 不修改侧栏 tree 已稳定的 `subAgentActivity` 绑定逻辑（除非发现 regression 必要的最小兼容）。
- 不引入新的后端 lookup、文件系统 watcher 或 catalog 全量刷新。
- 不改 collaboration mode（plan/code）策略。

## What Changes

- **Native Codex live**：父会话 timeline 在「无可用 collab spawn 卡 / 仅 wait 簇」且已有 `childSubagentThreads` 时，用子会话合成小队（对齐 Shared 已有 synthetic，但 Codex 形状、且 engine-gated）。
- **StatusPanel（Codex only）**：collab tool 抽不出 `receiverThreadIds` / `agentStatus` 时，用 parent 下 child threads 种子化 `SubagentInfo`，保证 Agents tab 在 live wait 阶段可见。
- **Live collab id 归一（Codex）**：live `buildConversationItem` / linking 与 history `extractThreadIdsFromRecord` 对齐 `targets`/`ids` 等字段，减少 live 残缺。
- **Shared Codex**：仅在 Shared 投影丢失 collab 字段时补保真或走同一树兜底；不改 Grok/Claude Shared 成功路径。
- **回归锁**：其他 CLI 的 subagent 识别与 synthetic 条件 MUST 有负向测试（不误触发 Codex-only 分支）。

## Capabilities

### New Capabilities

- `codex-collab-subagent-live-parity`: Codex collab 子代理 **live 与 history 呈现 parity** 契约（幕布小队 + Status Agents + engine isolation）。

### Modified Capabilities

- `subagent-canvas-persona-ui`: 扩展「子会话合成小队」从 Shared-only 到 **Codex native live wait 缺口**；明确 wait 仍不进 persona 卡、其他引擎行为不变。

## Impact

- Frontend:
  - `src/features/messages/orchestration/hooks/useMessagesPresentationState.ts`（synthetic 注入条件）
  - `src/features/subagent-ui/utils/syntheticSharedSubagentTools.ts`（命名/形状可泛化，Codex 分支）
  - `src/features/status-panel/hooks/useStatusPanelData.ts`（Codex child-tree fallback）
  - `src/utils/threadItems.ts` / collab id 抽取（与 history 对齐）
  - 相关 Vitest：presentation / status / isSubagentTool / synthetic
- Specs: 上述 capability delta
- **不触及**：Claude/Grok/Kimi/Gemini/OpenCode realtime adapters、history loaders、persona 池、inspector 通用抽屉框架（除 Codex session 解析回归）

## 技术方案对比（摘要）

| 选项 | 做法 | 取舍 |
|------|------|------|
| A. 仅 enrich live collabToolCall | 把 wait/spawn 字段补全到 history 级 | 依赖协议时序，wait 阶段仍可能无 spawn 卡 |
| B. **子会话树兜底 + Codex-gated（推荐）** | live 缺 spawn 卡时用 `childSubagentThreads` 合成；Status 同源 | 与侧栏事实一致；不碰其他 CLI |
| C. wait 也渲染 persona | 改 `isSubagentTool` | 破坏 lifecycle 语义与现有单测契约 |

**选择 B**，可选叠加 A 的 id 字段对齐作为增强。

## 验收标准

1. Codex native live：3 子代理 fan-out 后 wait 阶段，幕布可见 3 张 SubAgent 卡（昵称可来自侧栏），非仅 `Collab: wait` 扁条。
2. 同阶段右侧 Status **Agents** tab 可见且可点开 inspector。
3. Turn 结束后 history 重开与 live 结束态一致：无双卡、无密文 message 泄漏。
4. Claude / Grok / Kimi 实时与历史：既有 focused Vitest 全绿；人工冒烟无回归。
5. Shared Grok synthetic 路径行为不变；Shared Codex 至少不劣于 native live 兜底。

## 风险

- 合成卡与稍后到达的真实 spawn 双写 → 必须 dedupe（按 child id / agentId）。
- 误把其他引擎套进 Codex 分支 → engine gate + 负向测试。
- Status 过度聚合历史子会话 → 优先当前 turn / processing 子树，与现有 scoped entries 一致。
