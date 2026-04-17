## MODIFIED Requirements

### Requirement: Relevant Session Scope Is Root-Subtree Bound
系统 MUST 保持 `Activity` 面板聚合范围为当前任务 root-subtree，不因 Radar 引入而扩散范围。

#### Scenario: activity panel keeps root-subtree scope
- **GIVEN** 用户处于 `Activity` 面板
- **WHEN** 系统构建 activity 数据
- **THEN** 系统 MUST 仅聚合当前 active thread 所在 root thread 及其 descendants
- **AND** 与当前任务无亲缘关系的线程 MUST NOT 混入

## ADDED Requirements

### Requirement: Right Panel Tabs SHALL Expose Global Radar Entry
系统 MUST 在右侧顶部 Tab 提供独立 `Radar` 入口，作为跨项目会话总览主入口。

#### Scenario: user opens radar from top-level tab
- **WHEN** 用户点击顶部 `Radar` 入口
- **THEN** 面板 SHALL 打开跨项目聚合视图
- **AND** 用户 SHALL 能区分进行中与最近完成分组
- **AND** 数据来源 MUST 以 `workspaceId + threadId` 作为会话身份主键

### Requirement: Radar Entry Signal SHALL Remain Discoverable When Panel Is Collapsed
系统 MUST 在右侧面板收起时保留 radar 入口的运行态提示，避免用户错过进行中会话。

#### Scenario: collapsed right panel still shows radar live hint
- **GIVEN** 存在至少一个进行中会话
- **WHEN** 右侧面板处于收起状态
- **THEN** radar 入口 MUST 呈现可识别的 live 提示
- **AND** 用户无需展开左侧项目树即可感知该状态
