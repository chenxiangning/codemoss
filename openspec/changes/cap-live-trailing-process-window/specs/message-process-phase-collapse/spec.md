## MODIFIED Requirements

### Requirement: Process Phase Collapse MUST Use Turn-Final Ownership

对话幕布过程相位折叠 MUST 将同一个 user turn 内、介于上一条 user message 与该 turn
**最后一条有可见正文的 assistant message** 之间的全部 collapsible process items
（`reasoning` / `tool` / `explore`）归属到该终稿 assistant 的单一 phase。
mid-turn assistant 计划/问候正文 MUST 保留在时间线，MUST NOT 被并入 phase body。
折叠态 MUST hard-unmount process rows，仅保留 `已处理 · …` chip；展开 MUST 能 remount
被吸收的 process rows（含原先位于 mid-assistant 之前的「孤儿」reasoning）。

#### Scenario: Native stream with orphan reasoning before mid-turn plan text

- **WHEN** timeline 为
  `user → reasoning → assistant(plan) → tools/reasoning… → assistant(final)`
  且可渲染 process 步数 `> 1`
- **THEN** 折叠后 MUST NOT 在 plan 文之上单独保留被隔开的孤儿 `思考过程` 行
- **AND** 终稿上方 MUST 出现单一 process phase chip，其 breakdown 计入被吸收的
  reasoning 与可见 tools
- **AND** plan 正文 MUST 仍可见

#### Scenario: Multi-segment assistants share one turn-final chip

- **WHEN** 同一 user turn 内存在
  `tools1 → assistant(A1) → tools2 → assistant(A2)` 且 process 总步数 `> 1`
- **THEN** process phase MUST 仅挂在 `A2`
- **AND** `tools1` 与 `tools2` MUST 一并归属 `A2` 的 phase（折叠时 unmount）
- **AND** `A1` 正文 MUST 保留

#### Scenario: Single-step process including lone reasoning folds into the chip

- **WHEN** turn-final 之前仅有 1 个可渲染 process 步（含仅 1 条 reasoning / 思考过程）
- **THEN** MUST 创建 process phase chip（例如 `已处理 · 思考 1 次`）
- **AND** 该 process 行在折叠态 MUST hard-unmount，不得作为顶部孤儿 `思考过程` 单独挂载
- **AND** Native 与 Shared 共用同一门槛，行为一致

#### Scenario: Trailing in-progress process hands off to the rolling window

- **WHEN** 最后一条 assistant 终稿之后仍有 running tool/explore
- **THEN** 这些 trailing process items MUST NOT 被并入已完成终稿的 phase
- **AND** 在滚动窗口阈值内 MUST 保持展开可见
- **AND** 超过滚动窗口阈值后 MUST 按 Trailing Live Process Rolling Window 规则折叠

## ADDED Requirements

### Requirement: Trailing Live Process MUST Fold on a Rolling Card Window

assistant 正文未落地的 trailing process 段 MUST 按幕布卡片计数做滚动折叠：
连续同类工具合并的「批量」卡（readGroup / editGroup / bashGroup / searchGroup）
MUST 计为 1 张，MUST NOT 按卡内节点计数。卡片数超过阈值（5 张）时，较旧的卡
MUST hard-unmount 进 `已处理` chip，仅末尾 3 张卡 MUST 保持展开可见；批量卡的
折叠与保留 MUST 以整卡为单位，MUST NOT 从卡内截断。阈值与保留窗口 MUST 为实现内
常量，MUST NOT 暴露为设置项，MUST NOT 按 engine 分化。chip 的
`已处理 · N 步` 细账统计口径 MUST 保持按节点统计，与阈值卡片口径解耦。
后续终稿落地时，trailing 段 MUST 由回合级 phase 全量接管，trailing chip MUST 消失。

#### Scenario: Trailing cards at or below threshold stay expanded

- **WHEN** trailing 段卡片数 `<= 5` 且无后续 assistant 正文
- **THEN** MUST NOT 创建 trailing chip
- **AND** 全部卡片 MUST 保持展开可见

#### Scenario: Consecutive same-category tools count as one batch card

- **WHEN** trailing 段含 6 个连续 fileRead 工具（合并为 1 张批量读取卡）且总卡片数 `<= 5`
- **THEN** MUST NOT 触发折叠（批量卡计 1 张，不计 6 步）

#### Scenario: Above threshold folds older cards and keeps the last 3 visible

- **WHEN** trailing 段卡片数 `> 5`
- **THEN** 前 `卡片数 - 3` 张卡 MUST hard-unmount 进 `已处理` chip
- **AND** 末尾 3 张卡 MUST 保持展开可见
- **AND** chip 折叠态 MUST 落位于第一张可见尾卡之前

#### Scenario: Batch card folds atomically

- **WHEN** 滚动窗口触发且隐藏区边界落在批量卡上
- **THEN** 该批量卡的全部节点 MUST 整体进入 chip 或整体保留
- **AND** MUST NOT 只隐藏卡内部分节点

#### Scenario: User expands the trailing chip

- **WHEN** 用户展开 trailing chip
- **THEN** 被隐藏的卡片 MUST 全量 remount
- **AND** 再次收起后 MUST 回到滚动窗口态（仍只保留末尾 3 张可见）

#### Scenario: Assistant prose lands and absorbs the trailing run

- **WHEN** trailing chip 存在期间该回合终稿 assistant 正文落地
- **THEN** trailing chip MUST 消失
- **AND** 全部 trailing process items MUST 并入该终稿的回合级 phase
