## Context

当前 CodeMoss 的 Codex 引擎已具备两条事实链路：

1. `ConfigSelect` 已支持 Codex 专属能力入口（`Plan mode`、`Live usage`），说明“引擎特定配置”已在该弹层承载。
2. `/review` 已在命令层打通：`useQueuedSend` 识别 `/review`，`useThreadMessaging.startReview()` 支持“无参数时打开 preset 选择”。

但 `/fast` 仍缺失 GUI 入口和前端命令路由，导致：

- 用户只能记忆并手输命令，功能可发现性差。
- `ConfigSelect` 内 Codex 能力分布不完整（有 plan/review 语义但无 speed 语义）。

本次设计参考两张目标图：

- 图 1：在配置面板新增 `Speed` 行，右侧二级菜单提供 `Standard` / `Fast`，当前项有对勾。
- 图 2：`Review` 快捷入口触发现有“Select a review preset”四选项流程。

约束：只在 Codex 引擎生效；复用现有命令链路，不引入新的后端协议。

## Goals / Non-Goals

**Goals:**
- 在 Codex 配置面板增加 `Speed`（`Standard/Fast`）可视化入口，并与 `/fast` 语义一致。
- 在同一面板增加 `Review` 快捷入口，直接进入现有 review preset 流程。
- 入口行为走现有消息/命令分发链路，避免创建平行实现。
- 保持手输 `/review` 兼容，不改变非 Codex 现有体验。

**Non-Goals:**
- 不 GUI 化 `/permissions`、`/experimental`、`/model`。
- 不重做 Review UI（继续复用 `ReviewInlinePrompt`）。
- 不新增 Codex CLI 协议或 Tauri 专用 IPC。

## Decisions

### 1) 入口放置与交互模型：沿用 `ConfigSelect` 的 Codex 专属区域

**决策**
- 仅在 `isCodexProvider` 时显示两项：
  - `Speed`（二级菜单）
  - `Review`（快捷动作）
- 布局与现有 `Live usage` 一致：主项 + 右侧箭头/动作，避免新增交互范式。

**原因**
- `ConfigSelect` 已是引擎级配置聚合点，用户心智连续。
- 对齐现有 hover/click 子菜单机制，改动最小。

**备选方案**
- 放到底部按钮区做独立按钮：视觉侵入大，且破坏“配置归配置”的信息架构。

### 2) `/fast` 实现采用“命令桥接 + 轻状态同步”

**决策**
- 在 `useQueuedSend.parseSlashCommand` 增加 `fast` 分支。
- 在 `useThreadMessaging` 新增 `startFast(text)`，通过既有发送通道触发 `/fast`（支持无参 toggle 与显式 `on/off`）。
- `ConfigSelect` 的 `Speed` 菜单点击后，不直接改本地布尔值，而是触发命令并更新 UI 状态（Optimistic + 回执校正）。

**原因**
- 保证与 CLI 行为一致（单一事实源仍是 Codex 引擎会话）。
- 不新增 IPC，避免跨层协议成本。

**状态同步策略**
- UI 维护 `speedMode: "standard" | "fast" | "unknown"`。
- 点击后先 optimistic 更新；收到命令回执（或失败）后校正。
- 无法判定时回落 `unknown`，菜单不显示勾选并提示可重试。

**备选方案**
- 纯本地 toggle：易与真实会话状态漂移，不采用。
- 新增后端 `set_fast_mode`：链路更重，本迭代不采用。

### 3) `Review` 快捷入口复用现有 `/review` preset 流程

**决策**
- 配置面板点击 `Review` 时调用既有 `startReview('/review')`，由 `useThreadMessaging` 内逻辑打开 preset。
- 不新增新的 review 状态机与 UI 容器。
- 在信息架构上明确三级导航：
  - 一级：`ConfigSelect` 中的 `Review` 快捷入口。
  - 二级：`Select a review preset`（4 项：base branch / uncommitted / commit / custom）。
  - 三级（仅两条分支进入）：
    - 选择 `Review against a base branch` 后进入 `Select a base branch` 列表（支持搜索）。
    - 选择 `Review a commit` 后进入 `Select a commit to review` 列表（支持搜索）。

**原因**
- 已有流程（base/uncommitted/commit/custom）完整，风险低。
- 与手输 `/review` 保持同一执行路径，回归面最小。

### 4) 分层改造点（最小闭环）

- UI 层：
  - `ConfigSelect.tsx`：新增 `Speed` 与 `Review` 行、`Speed` 子菜单、状态显示。
  - `ButtonArea.tsx` / `ChatInputBoxFooter.tsx` / `ChatInputBoxAdapter.tsx`：透传新回调与状态。
- 命令层：
  - `useQueuedSend.ts`：识别 `/fast` 并路由到 `startFast`。
  - `useThreadMessaging.ts`：实现 `startFast`，并暴露给调用方。
- 文案层：
  - `i18n/locales/en.ts`、`zh.ts` 新增 `speed`、`standard`、`fast`、`review` 快捷入口文案。
- 测试层：
  - `ConfigSelect.test.tsx`：Codex-only 可见性、点击行为、子菜单勾选。
  - `useQueuedSend.test.tsx`：`/fast` 解析与路由。

### 5) 变更边界与遗留代码保护（硬约束）

**决策**
- 本变更 SHALL 仅在 `providerId === 'codex'` 的分支生效，非 Codex 引擎（Claude/OpenCode/Gemini）行为必须保持不变。
- 本变更 SHALL 采用“增量挂载”方式接入现有代码，不做跨模块重构，不改老链路语义。
- 对遗留路径的修改仅允许“必要最小改动”：新增分支、可选参数透传、条件渲染，不允许顺手重排/重写。

**原因**
- 该功能是 Codex 专属能力，跨引擎修改会放大回归面。
- 现有 `/review` 与非 Codex 发送路径已稳定，重构收益低于风险。

**边界清单**
- `Speed` 与 `Review` 快捷入口仅在 Codex 配置面板显示并可交互。
- `/fast` 命令识别后必须受 Codex 守卫；非 Codex 不得改变既有命令处理行为。
- `ReviewInlinePrompt` 复用现有实现，不在本次进行结构性改造。

## Risks / Trade-offs

- [Risk] `/fast` 回执文案格式不稳定，导致 UI 校正误判  
  → Mitigation：优先用显式参数命令（`/fast on|off`）减少歧义；回执解析失败时回退 `unknown`，不阻断会话。

- [Risk] `ConfigSelect` 交互变复杂（多 submenu + action）  
  → Mitigation：复用现有 submenu 生命周期（`activeSubmenu`），保持单一展开目标，避免并发展开。

- [Risk] 非 Codex 引擎误露入口  
  → Mitigation：所有渲染与行为双重 `isCodexProvider` 守卫，补充单测覆盖。

- [Risk] review 快捷入口与手输 `/review` 行为分叉  
  → Mitigation：统一调用 `startReview('/review')`，不引入第二套分支。

## Migration Plan

1. **阶段 1（本变更）**
   - 落地 `Speed` + `Review` UI 入口。
   - 打通 `/fast` 命令分发与 `startFast`。
   - 补齐 i18n 与单测。

2. **验证门禁**
   - `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx`
   - `pnpm vitest run src/features/threads/hooks/useQueuedSend.test.tsx`
   - `pnpm tsc --noEmit`

3. **回滚策略**
   - 若出现线上回归，先回滚 `ConfigSelect` 新入口渲染（最小用户面回退）。
   - 命令层 `/fast` 分支可独立回滚，不影响 `/review` 与普通消息发送。

## Open Questions

- `/fast` 的状态是“线程级”还是“workspace 级”在当前引擎实现里是否完全一致？若存在差异，需要在 UI 文案中明确作用域。
- 是否需要在 `Live usage` 子菜单中追加当前 `Speed` 只读展示，提升状态可见性？（本次不做）
- 若未来要支持 `/permissions` GUI，是否继续沿用 `ConfigSelect`，还是拆分为 Codex 专属二级面板？
