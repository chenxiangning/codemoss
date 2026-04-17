## Context

本变更是 `codex-native-plan-mode-sync-2026-02-28` 的后续收敛阶段，目标从“功能可用”升级为“官方语义可验证对齐”。

已识别的核心偏差：
- 模式语义偏差：当前链路中仍存在 `default/code` 解释分层与历史兼容路径，需明确唯一语义契约。
- Plan 时间线偏差：当前更偏 `turn/plan/updated` 面板模型，缺少官方 item 级别的时间线语义映射。
- 用户输入弹窗偏差：`requestUserInput` 的队列/弹窗逻辑尚未严格绑定 `completed` 生命周期。
- 模式阻断偏差：当前项目存在本地增强拦截逻辑，默认行为与官方语义并不完全一致。

约束：
- 只允许触达 Codex 引擎分支与 Codex 后端通道。
- 不得改变非 Codex 引擎行为。

## Goals / Non-Goals

**Goals:**
- 定义并落地 Codex 模式语义契约：`uiMode(plan/default)` 与 `runtimeMode(plan/code)` 双层一致。
- 建立官方 Plan item 语义映射：`proposed-plan`、`plan-implementation`、`implement-plan:*`。
- 将 `requestUserInput` 弹窗触发条件规范化为 `completed != true`。
- 将本地增强下沉为 Codex 策略 profile，默认采用 `official-compatible`。
- 增加 non-codex 不变性门禁测试。

**Non-Goals:**
- 不改 `claude` / `opencode` / `gemini` 业务分支。
- 不做多窗口 follower 通道的完整产品化（仅记录为后续候选）。
- 不在本阶段重构线程模型与消息存储模型。

## Decisions

### Decision 1: 模式语义采用“双层模型 + 单一入口”

- 入口契约：前端仅输出 `plan|default`。
- 运行时映射：后端统一映射为 `plan|code`。
- 发送契约：`turn/start.collaborationMode` 仅承载运行时语义（`plan|code`），并回传 `modeResolved` 作为真值。

备选：
- 备选 A：前端直接发 `plan|code`。优点是简单；缺点是用户术语与运行时术语耦合，未来产品文案难演进。
- 备选 B（采用）：前端/后端分层语义。优点是 UI 文案稳定，运行时契约清晰；缺点是需要维护映射逻辑。

### Decision 2: Plan 渲染采用“双通道兼容，逐步收敛”

- 通道 1（目标）：item 时间线语义（`proposed-plan`/`plan-implementation`）。
- 通道 2（兼容）：保留 `turn/plan/updated` 面板能力作为 fallback。
- 收敛策略：当 item 时间线与 panel 数据并存时，时间线优先展示，panel 仅作摘要。

备选：
- 备选 A：一次性切换到 item 时间线。风险是历史线程兼容性差。
- 备选 B（采用）：双通道兼容 + 明确优先级，逐步迁移。

### Decision 3: `requestUserInput` 采用“completed 驱动待处理队列”

- 入队条件：`type=userInput` 且 `completed != true`。
- 出队条件：
  - 用户提交成功；
  - 或收到 `completed=true` 更新；
  - 或收到阻断/取消事件（按 request_id 匹配）。
- 弹窗显示条件：当前 active thread 的队首待处理请求。

备选：
- 备选 A：仅按首次收到请求入队，不看 `completed`。会导致重复弹窗与脏状态。
- 备选 B（采用）：严格绑定 `completed` 生命周期，行为可预测。

### Decision 4: 模式阻断策略 profile 化

- `official-compatible`（默认）：不做项目特有强阻断，优先遵循官方协议语义。
- `strict-local`：保留现有本地增强（阻断/合成请求/提示强化），用于受控场景。
- profile 仅在 Codex 通道生效，非 Codex 引擎不可见。

备选：
- 备选 A：永远官方兼容，不保留本地增强。回滚与运营弹性不足。
- 备选 B（采用）：profile 化切换，默认官方兼容。

### Decision 5: 非 Codex 不变性作为发布门禁

- 所有新增逻辑必须显式 `activeEngine === "codex"` 或 Codex 后端通道 guard。
- 变更 PR 必须附带 non-codex 回归结果。

## Risks / Trade-offs

- [Risk] 兼容双通道（timeline + panel）短期会增加渲染分支复杂度。
  - Mitigation: 明确优先级 + 增加快照测试，避免分支漂移。
- [Risk] profile 化可能引入配置不一致。
  - Mitigation: 给出默认值与开关可观测日志，启动时打印有效 profile。
- [Risk] `completed` 生命周期事件乱序导致队列闪烁。
  - Mitigation: 以 `(workspace_id, request_id)` 去重并幂等更新。

## Migration Plan

1. 第一阶段：先落协议与状态机，不改 UI 表达（低风险）。
2. 第二阶段：接入 item 时间线渲染，并保留 panel fallback。
3. 第三阶段：切换默认 profile 为 `official-compatible`，保留 `strict-local` 开关。
4. 第四阶段：执行全量回归与灰度验证（仅 Codex）。

## Rollback Plan

- 回滚策略 1：将 Codex profile 固定回 `strict-local`，恢复现有阻断行为。
- 回滚策略 2：关闭 item 时间线渲染开关，仅保留已有 panel 路径。
- 回滚策略 3：若队列异常，降级到“仅提交成功出队”的保守模式。

## Open Questions

1. 官方 `thread-follower-*` 通道是否纳入下一阶段 parity（当前提案不实现）。
2. `official-compatible` 下是否保留最小提示型 `modeBlocked` 事件（不阻断，仅解释）。
3. 历史线程中已存在的本地合成 request item 是否需要一次性数据迁移脚本。
