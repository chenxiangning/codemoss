## Why

`session activity` 中的 `solo` 实时跟随入口当前主要依赖图标识别，新用户容易“不知道可点、点了不知道作用”，导致 AI 已在持续改文件时仍无法进入跟随视图，增加理解与定位成本。需要补齐“可发现 + 可解释 + 可触发”的最小闭环，在不改变默认行为安全边界的前提下提升首轮使用成功率。

## 目标与边界

- 目标：让首次接触该功能的用户在会话期间可明确感知并理解 `solo` 实时跟随能力，且可在合适时机一键开启。
- 边界：本提案仅覆盖入口可发现性与引导链路，不改变现有文件打开管线，不改变跟随能力本身的数据契约。
- 边界：默认仍保持“用户显式开启后才进入实时跟随”，不引入强制自动抢焦点行为。

## 非目标

- 不在本提案中重做 `session activity` 时间线结构与信息架构。
- 不在本提案中引入复杂的新手教程系统（仅一次性轻引导）。
- 不在本提案中默认自动开启 `solo`。

## What Changes

- 将 `solo` 入口从“纯图标语义”增强为“图标 + 可理解文案 + tooltip”。
- 在用户首次进入 `session activity` 时提供一次性 `coach mark`，解释 `solo` 的作用与触发方式。
- 当 AI 已产生文件修改且用户尚未开启 `solo` 时，提供情境化 toast 引导（可立即开启或稍后）。
- 为引导交互补充状态持久化（首次引导已读、toast 触发去重）与可观测埋点（曝光、点击、开启转化）。
- 明确引导频控规则：同一会话轮次内仅提示一次；用户主动关闭后按新文件修改轮次再评估是否提示。

## 交互契约（补充）

- 入口契约：`solo` 控件 MUST 提供可见文案与 tooltip，且对键盘/读屏有稳定可访问名称。
- 引导契约：`coach mark` 仅在首次触达时出现一次，关闭后同用户同 workspace 不重复展示。
- 情境契约：仅在“检测到新文件修改且当前未开启 follow”时触发 toast；非该条件不得打扰。
- 行为契约：所有引导都只“建议开启”，不得自动切换 follow 状态，不得抢占 editor 焦点。

## 文案基线（补充）

- 入口文案：`实时跟随`
- 入口 tooltip：`开启后将实时打开 AI 正在修改的文件`
- toast 文案：`AI 正在修改文件，开启实时跟随？`
- toast 动作：`开启` / `稍后`

## 连招场景（补充）

- 连招 1：首次进入会话活动 -> 看到入口文案与 tooltip -> 一次点击开启实时跟随。
- 连招 2：未提前开启 -> AI 发生文件修改 -> toast 提示开启 -> 用户无缝跳转跟随。
- 连招 3：用户本次选择“稍后” -> 后续出现新一轮文件修改时按去重策略再次提醒，避免刷屏。

## 连招场景矩阵（新增）

- 连招 A（新手首次直达）：进入 `session activity` -> `coach mark` 指向 `实时跟随` -> 用户点击入口 -> 进入 follow 态 -> 后续文件修改自动跟随打开。
- 连招 B（任务中途补开）：用户未开 follow 持续对话 -> 首个 file-change 到来 -> toast 提示 -> 点击`开启` -> 从下一条 file-change 起稳定跟随。
- 连招 C（稍后再开）：首个 toast 选择`稍后` -> 同轮次不再弹 -> 新轮次出现 file-change 再次提示 -> 用户点击`开启`进入 follow。
- 连招 D（连续修改稳定性）：已在 follow 态 -> AI 连续修改多文件 -> 编辑器持续按时间序跟随最新修改文件 -> 不出现重复打开抖动。
- 连招 E（关闭后的再提醒）：用户手动关闭 follow -> 后续出现新 file-change -> 系统可按频控重新 toast 提示 -> 用户可再次开启。
- 连招 F（失败兜底）：用户点击`开启`但状态切换失败 -> 展示可恢复错误提示 -> 保持当前视图不跳闪 -> 用户可重试开启。

## 技术方案对比

### 方案 A：仅更新 tooltip 文案（低成本）

- 优点：改动小、上线快、风险低。
- 缺点：仍依赖用户主动 hover，移动端/低注意力场景触达弱，提升有限。

### 方案 B：分层可发现性链路（本次选择）

- 组成：入口语义增强 + 首次 coach mark + 文件修改情境 toast。
- 优点：覆盖“看见入口、理解用途、在正确时机行动”全链路，首轮转化更可控。
- 缺点：状态机与埋点治理复杂度更高，需要去重与频控策略。

取舍：选择方案 B，以最小新增交互换取显著可发现性提升，同时保持默认非侵入行为。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`：新增 `solo` 跟随入口的可发现性要求（显式语义、首次引导、文件修改情境触发），并保持默认不自动抢焦点。

## 验收标准

- 用户首次进入 `session activity` 时，系统展示一次性 `coach mark`，关闭后同用户同 workspace 不重复弹出。
- `solo` 入口在 UI 上可被非熟悉用户直接理解（图标 + 文案 + tooltip），且可通过键盘焦点读取可访问名称。
- 当 AI 产生文件修改且 `solo` 未开启时，系统展示情境 toast；点击“开启”后立即进入实时跟随状态。
- 选择“稍后”后，本轮不重复弹出；后续新一轮文件修改可按频控策略再次提示。
- 默认情况下系统不得因文件修改自动切换为跟随态或抢占当前 editor 焦点。
- 入口、coach mark、toast 三类引导在暗色/亮色主题与中英文界面下均保持可读且无文案截断。
- 在 follow 已开启情况下，连续 3 次以上 file-change 事件处理中不得出现重复打开同一文件导致的可见抖动。
- 用户手动关闭 follow 后，系统不得立即重复弹出 toast；仅在新轮次 file-change 时按频控再次提示。
- `开启 follow` 动作失败时，系统必须给出可恢复反馈且允许用户在同会话内直接重试。

## 量化指标与门禁（补充）

- 指标：`solo_entry_exposed`、`solo_entry_clicked`、`solo_nudge_shown`、`solo_nudge_accept_clicked`、`solo_follow_enabled`。
- 主指标：新用户（首周）`solo_follow_enabled / solo_entry_exposed` 转化率。
- 护栏指标：toast 关闭率异常上升、连续会话投诉率、编辑器焦点中断率。
- 发布门禁：若护栏指标超过阈值，立即降级为“仅入口文案 + tooltip”，关闭 coach mark 与 toast。

## 风险与回滚

- 风险：提示层级过多造成干扰，影响已有熟练用户操作效率。
- 控制：引导仅首次展示，toast 采用事件驱动与频控去重，支持用户关闭后降噪。
- 回滚：通过 feature flag 关闭 coach mark 与 toast，仅保留入口文案与 tooltip，不影响现有跟随能力。

## 发布策略（补充）

- Phase 1：仅开启“入口文案 + tooltip”，验证对现有交互零回归。
- Phase 2：对新用户灰度开启 coach mark（例如 20% -> 50% -> 100%）。
- Phase 3：灰度开启情境 toast，并持续监控主指标与护栏指标。
- 任一阶段出现负向信号，按 feature flag 快速回退到上一阶段。

## Impact

- Affected specs: `openspec/specs/codex-chat-canvas-workspace-session-activity-panel/spec.md`（新增/修改可发现性 Requirement 与 Scenario）。
- Affected frontend areas（预期）:
  - `src/features/session-activity/*`（入口呈现、引导状态、toast 触发与跟随开关联动）
  - `src/features/chat-canvas/*`（会话活动容器层引导触发时机与状态持久化）
- Affected telemetry（预期）:
  - `solo_entry_exposed` / `solo_entry_clicked` / `solo_follow_enabled` / `solo_nudge_shown`
- Dependencies:
  - 无新增外部依赖；复用现有 tooltip、toast、local preference 存储机制。
