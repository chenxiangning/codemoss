## MODIFIED Requirements

### Requirement: SubAgent 完成态以 S10 为唯一幕布表面

对 Claude Shared 与 Claude Native，当对话中存在可识别的 SubAgent tool 时：

1. 幕布 MUST NOT 再并行展示 legacy `message-agent-task-card`（`Agent session` 完成卡）——本条继承 `retire-claude-subagent-agent-session-card`。
2. 幕布 MUST NOT 再以 S10 `SubagentSquadGrid` / Ring 卡作为 canonical 完成态表面——**本 change supersede**。
3. **Canonical 用户观察面** MUST 是 Composer run-status strip（及 StatusPanel 列表）；幕布 subAgent tool MUST 仅以普通工具行保留审计痕迹。

#### Scenario: SubAgent 型 task-notification 不渲染旧卡

- **WHEN** assistant 或 user 消息正文可被解析为 task-notification，且 summary 为 SubAgent 风格
- **THEN** 消息行 MUST NOT 渲染 `.message-agent-task-card`
- **AND** MUST NOT 把该 notification 的 `resultText` 作为独立幕布气泡的主内容展示

#### Scenario: S10 幕布小队不再出现

- **WHEN** 同一回合存在 SubAgent tool items
- **THEN** 幕布 MUST NOT 通过 `subagentGroup` 渲染 S10 小队卡
- **AND** 用户 MUST 仍能通过 Composer strip 或 StatusPanel 打开 SubAgent inspector

#### Scenario: 普通工具行保留审计

- **WHEN** Claude Agent/Task tool item 出现在 timeline
- **THEN** 系统 MUST 以 Generic 工具行（或等价 plain tool 呈现）保留该调用记录
