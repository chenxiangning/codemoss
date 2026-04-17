## Context

当前 `session activity` 的 `SOLO` 跟随入口以 icon 为主，新用户在首次接触时难以建立“可点击 + 作用是什么”的心智模型。现有规范已明确默认不得自动抢占 editor 焦点，因此本次设计必须在“可发现性提升”和“非侵入行为边界”之间取得平衡。

该变更主要发生在前端交互层，涉及：
- `session activity` 入口渲染层（icon-only -> icon + label + tooltip）
- 新手一次性引导状态（workspace 维度）
- 文件修改情境触发提示（toast + 频控）
- 跟随开关与实时 file-change 事件协同

## Goals / Non-Goals

**Goals:**
- 提升新用户对 `SOLO` 跟随入口的识别率与首次开启转化率。
- 建立稳定“连招链路”：提示 -> 开启/稍后 -> 后续轮次再提示 -> 重试开启。
- 保持默认不自动开启、不抢焦点，避免破坏已有工作流。
- 引入可观测埋点，支持灰度放量和回退决策。

**Non-Goals:**
- 不改造 `session activity` 时间线结构。
- 不改动文件打开底层路由和 external path 读取契约。
- 不引入全局新手教程框架或复杂实验平台。

## Decisions

### Decision 1: 采用“三层可发现性”而非单点提示
- 选择：`入口语义增强 + 首次 coach mark + file-change 情境 toast`。
- 原因：三层分别覆盖“看见入口、理解用途、在时机点行动”，比仅 tooltip 更能提升首轮成功率。
- 备选：
  - 仅 tooltip：开发成本低，但触达依赖 hover，转化提升有限。
  - 默认自动开启：转化高但侵入性强，违背现有不抢焦点边界。

### Decision 2: 引导状态采用“用户 + workspace”粒度持久化
- 选择：首次引导已读状态按 `(userId, workspaceId, featureKey)` 存储。
- 原因：避免跨 workspace 的错误继承，且能保证“同用户同 workspace 只出现一次”。
- 备选：
  - 全局单标记：简单但会导致新 workspace 缺少必要引导。
  - 会话级标记：过细，重复引导过多。

### Decision 3: toast 使用“轮次去重 + 事件边界”频控
- 选择：同一 turn 仅允许一次情境 toast；用户点击“稍后”后，当检测到新 turn 的新 file-change 再允许提示。
- 原因：避免噪声轰炸，同时保留后续再触达机会。
- 备选：
  - 时间窗频控（例如 5 分钟）：实现简单但与对话轮次脱节，解释性差。
  - 永不再提醒：对“稍后而非拒绝”的用户不友好。

### Decision 4: follow 开启失败采用“就地可恢复”策略
- 选择：失败时保留当前视图，显示可恢复错误提示，允许直接重试。
- 原因：防止用户在关键任务期出现视图跳闪或状态丢失。
- 备选：
  - 失败后自动回退到默认 tab：增加认知负担，且打断正在观察的活动流。

### Decision 5: 灰度发布由 feature flag 分阶段推进
- 选择：
  - Phase 1: 仅入口文案与 tooltip
  - Phase 2: 新用户 coach mark 灰度
  - Phase 3: 情境 toast 灰度
- 原因：可逐步隔离风险，便于定位负向指标来源。
- 备选：
  - 一次性全量发布：验证速度快，但回溯与止损成本高。

## Risks / Trade-offs

- [风险] 引导层级增多导致熟练用户感到打扰  
  → Mitigation：首次引导一次性 + toast 轮次频控 + 全量可开关。

- [风险] file-change 高频时出现重复打开抖动  
  → Mitigation：按事件 identity 去重，仅在目标文件变化时触发可见切换。

- [风险] 埋点口径不一致导致灰度判断失真  
  → Mitigation：在实现前先固定事件名与字段，测试中校验关键埋点链路完整性。

- [风险] 多语言文案长度导致布局挤压  
  → Mitigation：在中英文与浅/深色主题执行 UI snapshot 与最小可读性校验。

## Migration Plan

1. 引入 feature flag：
   - `solo_follow_discovery_label`
   - `solo_follow_discovery_coachmark`
   - `solo_follow_discovery_nudge`
2. 先上线 Phase 1，验证无回归（不影响跟随主链路）。
3. 灰度 Phase 2/3，监控转化与护栏指标。
4. 若护栏异常，关闭高层 flag（coach mark/toast），保留基础入口语义增强。
5. 若持续异常，全部关闭并回退到 icon-only 老行为。

## Open Questions

- `新轮次` 的统一定义是否直接复用现有 turn-group id，或需独立会话事件边界判定？
- `稍后` 行为是否需要“本会话静默直到手动开启”的高级偏好选项（当前提案不实现）？
- 埋点是否区分 `入口点击开启` 与 `toast 点击开启` 的后续留存效果，作为后续优化依据？
