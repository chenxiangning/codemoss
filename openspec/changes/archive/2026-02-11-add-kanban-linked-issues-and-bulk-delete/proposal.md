## Why

当前工作区首页“最近会话”只能单条进入，无法在一次操作中清理多条历史会话；同时输入区上方缺少显式的 Kanban
关联问题入口，导致任务上下文可见性不足。该变更用于降低会话管理成本，并提升“任务-对话”联动效率。

## What Changes

- 在输入区上方新增“Kanban 关联问题”展示与快捷操作（选择/跳转关联项）。
- 在工作区首页右侧“最近会话”区域新增多选态与批量删除能力。
- 增加批量删除的安全确认与空态/禁用态处理，避免误删。
- 新增对应文案与交互状态（选中数、全选、取消、删除中）。
- **无 BREAKING 变更**：不修改既有线程数据结构与底层存储协议。

## 目标与边界

- 目标
    - 将会话管理从“单条删除”提升为“可批量处理”。
    - 在输入前阶段显式暴露 Kanban 关联问题，减少上下文切换。
    - 保持现有单击进入会话路径不退化。
- 边界
    - 仅覆盖 UI 交互层与现有删除能力编排（glue code）。
    - 仅作用于当前 workspace 的最近会话列表。
    - 不引入新后端存储表/新服务。

## 非目标

- 不实现跨 workspace 的会话批量删除。
- 不实现会话恢复、回收站或软删除策略改造。
- 不改造 Kanban 数据模型与任务状态流。
- 不引入新的权限模型或账号级审计系统。

## 技术方案对比

### 方案 A：在现有 WorkspaceHome 内实现“浏览态/管理态”双态（推荐）

- 做法：复用现有 thread 删除能力，在 WorkspaceHome 增加多选状态机与批量操作栏。
- 优点：改动集中、风险可控、可快速落地；不影响现有数据契约。
- 缺点：后续若扩展“归档/标签”需继续在同组件演进。

### 方案 B：抽离独立会话管理面板（Modal/Drawer）

- 做法：新增独立管理容器承载批量能力，再与 WorkspaceHome 互通。
- 优点：扩展性强，后续可容纳更多管理能力。
- 缺点：引入额外状态同步与导航成本，本次需求属于过度设计。

### 取舍

采用 **方案 A**。本次需求是局部能力补齐，优先最小可回滚改动，遵循 YAGNI。

## Capabilities

### New Capabilities

- `workspace-recent-conversations-bulk-management`: 在工作区首页最近会话区域提供多选、全选、批量删除与确认流程。
- `composer-kanban-linked-issues-surface`: 在输入区上方展示 Kanban 关联问题并支持快捷跳转/选择。

### Modified Capabilities

- （无）当前 `openspec/specs` 下无对应会话管理或 composer-kanban 既有 capability，采用新增能力建模。

## Impact

- Affected UI surface
    - Workspace Home 右侧最近会话列表交互。
    - Composer 输入区上方 Kanban 关联问题条。
- Affected code areas（目标代码库）
    - `src/features/workspaces/components/WorkspaceHome.tsx`
    - `src/features/composer/components/Composer.tsx`
    - `src/App.tsx`
    - `src/styles/workspace-home.css`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
- Dependencies
    - 复用现有 thread 删除与图片清理能力，不新增第三方依赖。
- Risk
    - 主要风险为误触删除与交互回归；通过管理态隔离、删除确认与回归测试控制。

## 验收标准

- 在工作区首页可进入“多选管理”模式，支持选择多条最近会话。
- 支持“全选/取消”与“批量删除”，删除后列表与计数即时更新。
- 批量删除必须出现二次确认，并展示将删除的条目数量。
- 非管理态下，点击最近会话仍为“进入会话”，与现有行为一致。
- 输入区上方可见 Kanban 关联问题条；可执行“选择关联项”与“跳转到关联项”。
- 不出现 TypeScript 类型错误，且相关前端测试通过。
