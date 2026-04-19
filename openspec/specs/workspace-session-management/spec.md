# workspace-session-management Specification

## Purpose
TBD - created by archiving change project-session-management-center. Update Purpose after archive.
## Requirements
### Requirement: Session Management SHALL Be A Dedicated Settings Surface

系统 MUST 提供独立的 `Session Management` 设置页入口，用于治理 workspace 级真实会话历史，而不是继续把该能力限制在 `Other` 分组里的局部 section。

#### Scenario: open dedicated session management settings page

- **WHEN** 用户进入设置并打开 `Session Management`
- **THEN** 系统 MUST 展示独立的会话管理视图
- **AND** 该视图 MUST 具备 workspace 选择、查询条件、结果列表与批量操作区

#### Scenario: legacy inline section no longer acts as primary management surface

- **WHEN** 用户需要执行真实历史查询、分页或 archive 治理
- **THEN** 系统 MUST 将其路由到独立会话管理页
- **AND** 旧的 inline section MUST NOT 继续承载完整管理职责

### Requirement: Session Management SHALL Read Workspace Session History With Real Pagination

系统 MUST 以 project-aware real session catalog 提供会话历史读取能力，并支持基于 cursor 或等效分页模型的真实分页。

#### Scenario: read first page from main workspace as project scope

- **WHEN** 用户选择某个 main workspace 并首次进入会话管理页
- **THEN** 系统 MUST 读取该 main workspace 与其 child worktrees 的真实会话目录第一页
- **AND** 结果 MUST 包含稳定会话标识、标题、引擎、更新时间、archive 状态与真实归属 `workspaceId`

#### Scenario: read first page from worktree as worktree-only scope

- **WHEN** 用户选择某个 worktree 并首次进入会话管理页
- **THEN** 系统 MUST 只读取该 worktree 自己的真实会话目录第一页
- **AND** 系统 MUST NOT 隐式并入其 parent main workspace 或 sibling worktrees 的会话

#### Scenario: subsequent page uses continuation cursor over aggregated result

- **WHEN** 用户继续加载下一页
- **THEN** 系统 MUST 基于上一页返回的 cursor 或等效 continuation token 读取聚合结果集的下一页
- **AND** 系统 MUST NOT 通过对当前已加载 UI 列表做本地切片伪装分页

#### Scenario: large project history remains queryable

- **GIVEN** 某 main workspace 与其 worktrees 拥有大量历史会话
- **WHEN** 用户按页读取项目级会话目录
- **THEN** 系统 MUST 保持稳定排序与可继续翻页
- **AND** 历史总量增大 MUST NOT 退化为一次性全量加载

### Requirement: Session Management SHALL Support Query And Selection Workflow

系统 MUST 支持会话查询、状态筛选、多选与批量操作前的选择工作流。

#### Scenario: filter by keyword engine and status

- **WHEN** 用户输入关键词并切换引擎或状态过滤条件
- **THEN** 系统 MUST 返回匹配条件的会话结果
- **AND** 状态过滤至少 MUST 支持 `active`、`archived` 与 `all`

#### Scenario: multi-select sessions across current result set

- **WHEN** 用户在当前结果列表中选择多条会话
- **THEN** 系统 MUST 维护稳定的选中集合
- **AND** 用户 MUST 能对选中集合执行批量 archive、unarchive 或 delete

### Requirement: Session Management SHALL Support Archive Unarchive And Delete

系统 MUST 支持对单条或多条会话执行 archive、unarchive 与 delete，并以 entry 真实归属 workspace 为路由依据处理部分失败与重试。

#### Scenario: archive selected sessions successfully in project scope

- **WHEN** 用户在项目聚合视图中对选中会话执行 archive 且后端成功
- **THEN** 系统 MUST 按每条会话的真实归属 `workspaceId` 执行 archive
- **AND** 这些会话 MUST 在当前结果集中切换为 archived 状态
- **AND** 若当前视图为 `active`，这些会话 MUST 从结果列表移除

#### Scenario: unarchive selected sessions successfully in project scope

- **WHEN** 用户在项目聚合视图中对 archived 会话执行 unarchive 且后端成功
- **THEN** 系统 MUST 按每条会话的真实归属 `workspaceId` 执行 unarchive
- **AND** 这些会话 MUST 恢复为 active 状态
- **AND** 若当前视图为 `archived`，这些会话 MUST 从结果列表移除

#### Scenario: delete selected worktree sessions does not affect sibling entries

- **WHEN** 用户在 main workspace 的项目聚合视图中删除某个 child worktree 的会话
- **THEN** 系统 MUST 只删除该会话真实归属 workspace 中的目标 entry
- **AND** 系统 MUST NOT 误删 main workspace 或其它 sibling worktree 中的会话

#### Scenario: batch operation partially fails across multiple owner workspaces

- **WHEN** 用户执行批量 archive、unarchive 或 delete
- **AND** 选中集合同时覆盖多个 owner workspaces
- **AND** 后端返回部分失败
- **THEN** 系统 MUST 仅更新成功项
- **AND** 失败项 MUST 保留在列表中并保持选中态以支持重试
- **AND** 系统 MUST 展示失败摘要与错误分类

#### Scenario: operation is non-reentrant while grouped mutation is in progress

- **WHEN** 系统已提交 archive、unarchive 或 delete 请求且尚未完成
- **THEN** 系统 MUST 禁用相关提交动作
- **AND** MUST 阻止重复提交同一批操作

### Requirement: Session Management Project View MUST Expose Entry Ownership

项目级会话管理视图 MUST 让用户区分每条会话的真实来源 workspace/worktree，避免聚合结果变成不可解释列表。

#### Scenario: project-scoped entry exposes owner workspace identity

- **WHEN** 某条会话出现在项目聚合视图中
- **THEN** entry payload MUST 包含真实归属 `workspaceId`
- **AND** 前端 MUST 能用该信息渲染所属 workspace 或 worktree 标识

#### Scenario: source-aware entry remains explainable in project view

- **WHEN** 某条聚合 entry 同时具备 source/provider 元数据
- **THEN** 前端 MUST 可以同时展示 owner workspace 信息与 source/provider 信息
- **AND** 用户 MUST 能理解该会话为何出现在当前项目视图中

### Requirement: Archived Sessions SHALL Be Manageable Without Reappearing In Main UI By Default

已归档会话 MUST 在会话管理页中可查询、可恢复、可删除，但默认不得重新出现在客户端主界面的标准会话入口中。

#### Scenario: archived sessions remain visible in management view

- **WHEN** 用户切换到 `archived` 或 `all` 视图
- **THEN** 系统 MUST 展示已归档会话
- **AND** 用户 MUST 能继续对其执行 unarchive 或 delete

#### Scenario: archived sessions are hidden from default main surfaces

- **WHEN** 某会话处于 archived 状态
- **THEN** 该会话 MUST NOT 出现在默认主界面会话入口中
- **AND** 至少包括 sidebar、workspace home recent list 与 topbar session tab 恢复集合

#### Scenario: restart preserves archived default invisibility

- **WHEN** 用户重启应用后重新打开同一 workspace
- **THEN** 已 archived 会话 MUST 继续保持默认不可见
- **AND** 系统 MUST NOT 因重建线程列表而把它们回填进主界面默认列表

#### Scenario: active-only projection empty state does not thrash refresh

- **GIVEN** 某 workspace 的主界面默认会话投影已经完成一次 hydrate
- **AND** 当前 active projection 结果为空，因为该 workspace 只剩 archived sessions
- **WHEN** 系统渲染 sidebar / 主界面左侧会话列表
- **THEN** 系统 MUST 将该状态视为稳定空态
- **AND** MUST NOT 因结果为空而持续重复触发自动刷新或 skeleton 闪烁
