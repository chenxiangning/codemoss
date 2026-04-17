## Context

该变更面向 Composer 上下文使用量展示：在保留 legacy 视图路径的前提下，新增并排新视图，实现“增量升级 + 可回退”。

现状（代码路径）：
- 线程 token usage 由事件流写入：`thread/tokenUsage/updated` → reducer `tokenUsageByThread`。
- 页面级状态汇总在 `App.tsx`，并向布局层透传 `activeTokenUsage`。
- Composer 链路：`useLayoutNodes.tsx` → `Composer.tsx` → `ChatInputBoxAdapter.tsx` → `ContextBar.tsx` → `TokenIndicator.tsx`。
- 同时存在一个 `ContextUsageIndicator.tsx`（旧实现样式）可复用或并列挂载。

约束：
- 不改后端协议与数据字段。
- 不破坏 legacy 交互与文案语义。
- 必须具备开关级回退能力。

## Goals / Non-Goals

**Goals:**
- 在 Composer 中支持 legacy + new context view 并排共存。
- 通过统一 Adapter 从同一状态源读取 token/compaction 信息，避免双口径。
- 提供 feature flag/配置开关，支持灰度与快速回退。
- 在窄屏下提供不遮挡主交互的降级布局。

**Non-Goals:**
- 不重写 legacy 组件内部逻辑。
- 不新增 token 统计来源或后端事件。
- 不在本期做全量 UI 框架重构。

## Decisions

### Decision 1: 父容器并排编排（不侵入 legacy 组件）

- 方案对比：
  - A 在 legacy 组件内部改造：耦合高，回归面大。
  - B 父层并排编排（选用）：隔离风险、开关清晰、回退简单。
- 决策：在 `Composer/ChatInputBoxAdapter` 层新增并排容器，legacy 组件最小改动或不改。

### Decision 2: 统一状态 Adapter，双视图同源消费

- 方案对比：
  - A 新旧各自计算 percent：可能出现显示漂移。
  - B 单 Adapter 输出规范化数据（选用）。
- 决策：新增 `DualContextUsageModel` 适配层（可在 `Composer.tsx` 或 `ChatInputBoxAdapter.tsx` 旁实现），统一输出：
  - `usedTokens`
  - `contextWindow`
  - `percent`（0..100 clamp）
  - `compactionState`（idle/compacting/compacted）

### Decision 3: 以配置开关控制新视图可见性

- 方案对比：
  - A 永久默认开启：风险高。
  - B 受控开关（选用）：适合灰度与快速回退。
- 决策：引入 `composer.contextDualView.enabled`（命名可在实现阶段按现有规范调整），默认关闭或受实验开关控制。

### Decision 4: 响应式降级优先保证 Composer 主交互

- 决策：
  - 宽屏：并排显示（legacy + new）。
  - 窄屏：降级为单列或仅展示 legacy 主信息，new 进入折叠/次级区。
- 原因：避免挤压输入框、发送按钮、模式选择器等主路径交互。

### Decision 5: 测试策略先保 legacy，再验新路径

- 决策：
  - 先锁定 legacy 回归测试（开关关）。
  - 再补 dual-view 开关开路径测试。
  - 补响应式断点场景测试。

## 组件与改动落点（预期）

- 状态入口
  - `src/App.tsx`：`activeTokenUsage` 选择逻辑保持不变，仅增加开关透传。
  - `src/features/layout/hooks/useLayoutNodes.tsx`：扩展 Composer props（dualView config）。
- Composer 视图层
  - `src/features/composer/components/Composer.tsx`：引入 dual-view model 与编排参数。
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`：并排容器与开关分支。
  - `src/features/composer/components/ChatInputBox/ContextBar.tsx`：legacy/new 组合渲染。
  - `src/features/composer/components/ContextUsageIndicator.tsx`：作为新视图候选或复用逻辑来源。
  - `src/features/composer/components/ChatInputBox/TokenIndicator.tsx`：继续保留 legacy ring 表达。
- 样式与文案
  - `src/features/composer/components/ChatInputBox/styles/context-bar.css`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
- 测试
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx`
  - `src/features/composer/components/Composer.status-panel-toggle.test.tsx`
  - 必要时补 `ContextUsageIndicator` 组件测试

## 数据与状态流

1. app server event 写入 `ThreadTokenUsage`。
2. reducer 维护 `tokenUsageByThread[threadId]`。
3. `App.tsx` 选出 active thread usage。
4. `useLayoutNodes.tsx` 透传到 Composer。
5. `DualContextUsageModel` 统一计算展示态。
6. legacy/new 两个视图消费同一 model。

## Risks / Trade-offs

- [Risk] 旧路径被并排容器样式影响  
  → Mitigation: legacy DOM 与 className 保持稳定；断言旧路径 snapshot/行为测试。

- [Risk] 双视图渲染带来视觉噪音  
  → Mitigation: 默认受开关控制；窄屏降级；保留 legacy 优先级。

- [Risk] 组件重复逻辑增加维护成本  
  → Mitigation: 在 Adapter 层抽取共享 model；视图层仅做展示。

- [Risk] 状态时序差异导致两视图瞬时不一致  
  → Mitigation: 双视图从同一 memo model 读取，避免各自计算。

## Migration Plan

1. 新增 dual-view 开关与透传链路（不改变 legacy 渲染）。
2. 引入 `DualContextUsageModel`，让 legacy 先接入该 model（行为保持一致）。
3. 新增 new view 组件并在开关开启时并排挂载。
4. 补齐响应式降级样式。
5. 补测试：legacy 回归、dual-view 路径、断点场景。
6. 小范围启用并观察后逐步放量。

### Rollback

- 关闭 dual-view 开关，回退为 legacy-only。
- 不涉及数据迁移，不依赖后端回滚。

## Open Questions

- 新视图是否需要在初期展示完整信息，还是先展示精简版（减少认知负担）？
- 双视图并排时，是否需要用户可关闭 new view（会话级）而非全局开关？
- 当前 `ContextUsageIndicator` 与 `TokenIndicator` 的职责边界是否在本期固定，还是允许后续整合？

---

## 追加设计决策（2026-03-05）：Codex-only 收敛

### Decision 6: 功能可见性收敛为引擎内开关（仅 Codex）

- 决策：
  - `App -> Layout -> Composer` 仅透传 `isCodexEngine` 场景可用标识。
  - `ContextBar` 内部增加 provider 守卫，非 codex 不渲染新视图。
- 原因：
  - 避免在 Settings 中新增全局开关造成跨引擎认知干扰。
  - 满足“只影响 codex 引擎”的变更边界。

### Decision 7: 保持老路径稳定，Codex 下替换为新总览表达

- 决策：
  - 在 codex + dual-view 场景隐藏 legacy token indicator，仅展示新圆圈统计。
  - 非 codex 保持 legacy token indicator 完整路径不变。
- 原因：
  - 与产品诉求一致：codex 场景采用新总览表达，其他引擎零变化。

### Decision 8: Tooltip 仅保留明细文本，无额外进度条

- 决策：
  - tooltip 内容限定为：
    - 总消耗（累计 token）
    - 上下文占用（百分比 + used/window）
    - 压缩状态（compacting/compacted/empty）
  - 不在 tooltip 内展示额外条形进度。
- 原因：
  - 减少重复信息和视觉噪音。
  - 保持与底部圆圈百分比表达一致，信息层次更清晰。
