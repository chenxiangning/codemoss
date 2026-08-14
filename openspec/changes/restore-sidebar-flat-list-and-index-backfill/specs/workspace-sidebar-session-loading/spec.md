## MODIFIED Requirements

### Requirement: Sidebar session list presentation

侧栏会话列表 MUST 呈现为 workspace 下按 `updatedAt` 混排的扁平列表（多引擎同列表），MUST NOT 按引擎分轨过滤或渲染 engine rail。首屏数据源 MUST 仍为 Session Index（SQLite）最近窗口，MUST NOT 恢复 exhaustive catalog 作为 first-paint 数据源。

#### Scenario: mixed engines render in one flat list

- **WHEN** 工作区同时存在 Claude / Codex / 其他引擎会话
- **THEN** 侧栏 MUST 在单一列表中按时间混排展示
- **AND** MUST NOT 渲染引擎图标 tab 行或单轨过滤

## ADDED Requirements

### Requirement: Sidebar MUST offer index-backed load-older when catalog cursor is absent

当 full-catalog cursor 缺失（first-paint 未跑 catalog）且 Session Index 存在更老行时，侧栏 MUST 显示「加载更早」，且点击 MUST 只从 SQLite 拉取（见 `session-index-backfill` capability）。

#### Scenario: index-backed load older after cold start

- **WHEN** 冷启动 first-paint 完成且未跑 full-catalog
- **AND** Index `totalCount` 大于已展示行数
- **THEN** 侧栏 MUST 显示「加载更早」入口
