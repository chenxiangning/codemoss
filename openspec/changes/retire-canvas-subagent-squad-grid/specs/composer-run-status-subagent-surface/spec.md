## ADDED Requirements

### Requirement: Subagent pill on composer run-status strip

当会话存在已聚合子代理（`SubagentInfo[]` 非空）时，Composer 输入框上方 run-status 条 MUST 展示子代理 section（pill），计数口径为 completed/total，并反映是否仍有 running。

#### Scenario: two completed subagents

- **WHEN** 聚合结果为 2 个 completed、0 个 running
- **THEN** pill 计数 MUST 呈现 `2/2`（或等价 i18n 形态）
- **AND** section MUST 可被用户展开

#### Scenario: no subagents hides section

- **WHEN** 聚合结果为空
- **THEN** 子代理 pill MUST NOT 单独占用可见 section

### Requirement: Expandable subagent rows open shared inspector

展开后的子代理行 MUST 展示稳定标题与 status 文案，点击 MUST 打开与 StatusPanel 相同的 `openSubagentInspector` 路径（幕布内 drawer，非全局 right tab）。

#### Scenario: row click opens inspector

- **WHEN** 用户点击 strip 内某一子代理行
- **THEN** 系统 MUST 打开 Subagent inspector
- **AND** 展示的 agent 身份 MUST 与该行 SubagentInfo / card 一致

#### Scenario: enrich pipeline shared with status panel

- **WHEN** strip 构建行视图
- **THEN** 系统 MUST 复用 subagent-ui 的 card build + status enrich + task-notification enrich（或等价共享 pure 管线）
- **AND** MUST NOT 为 strip 另建冲突的 status 真相源

### Requirement: Edit summary coexistence

run-status 条 MAY 同时展示文件编辑汇总 pill（如 `+additions -deletions`）；子代理 section 与编辑 section MUST 独立显隐，互不要求对方非空。

#### Scenario: edits only

- **WHEN** 有文件变更汇总且无子代理
- **THEN** 条上 MUST 可只显示编辑 pill
- **AND** MUST NOT 因此伪造子代理 section
