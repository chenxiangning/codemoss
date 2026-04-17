# workspace-sidebar-visual-harmony Specification Delta

## ADDED Requirements

### Requirement: 项目管理区必须保持单主焦点视觉语义

系统 MUST 在左侧项目管理区采用单主焦点规则，避免 workspace 与 thread 同时使用主高亮样式。

#### Scenario: active thread takes primary focus

- **GIVEN** 用户在某 workspace 内打开某条 thread
- **WHEN** 侧栏渲染 active 状态
- **THEN** active thread MUST 使用主高亮样式
- **AND** 所属 workspace MUST 仅使用次级上下文样式

#### Scenario: no active thread fallback

- **GIVEN** 当前 workspace 下没有 active thread
- **WHEN** 侧栏渲染 active 状态
- **THEN** workspace 行 MAY 使用主高亮样式作为回退

### Requirement: 项目管理区层级必须可辨识

系统 MUST 在 workspace、worktree、thread 三层之间提供稳定的视觉层级差异（字号、间距、色彩或图标强度）。

#### Scenario: hierarchy scan

- **GIVEN** 用户查看侧栏项目区
- **WHEN** 在不点击的情况下进行视觉扫描
- **THEN** 用户 MUST 能区分 workspace、worktree、thread 三类条目

### Requirement: 项目管理区密度节奏必须连续

系统 MUST 保持 market links 到 projects 列表的视觉节奏连续，避免突兀的面板割裂感。

#### Scenario: section transition

- **GIVEN** 左侧栏同时展示 market links 与 projects section
- **WHEN** 页面首次渲染
- **THEN** sections MUST 通过统一 spacing/divider 过渡
- **AND** MUST NOT 出现独立厚重容器造成的视觉割裂

### Requirement: 左侧图标栏必须独立且不参与内容滚动

系统 MUST 提供独立 rail 作为左侧全局入口区，并与项目列表滚动区域解耦。

#### Scenario: rail remains fixed while list scrolls

- **GIVEN** 侧栏中项目列表内容超过可视高度
- **WHEN** 用户滚动项目列表
- **THEN** rail MUST 保持固定位置
- **AND** 仅项目列表区域发生滚动

#### Scenario: rail supports collapsed and expanded states

- **GIVEN** 用户操作 rail 折叠按钮
- **WHEN** rail 在折叠态与展开态切换
- **THEN** rail MUST 保持图标可访问
- **AND** 不影响项目列表的滚动与点击行为

### Requirement: Topbar 标题迁移必须遵循侧栏可见性规则

系统 MUST 在侧栏展开时将项目标题入口迁移至侧栏头部，并在侧栏收起时恢复到主 topbar。

#### Scenario: sidebar expanded in workspace view

- **GIVEN** 用户处于工作区对话视图且侧栏处于展开状态
- **WHEN** 页面渲染顶部导航
- **THEN** 项目标题入口 MUST 显示在侧栏头部
- **AND** 主 topbar 右侧操作区 MUST 保持原位

#### Scenario: sidebar collapsed

- **GIVEN** 侧栏处于收起状态
- **WHEN** 页面渲染顶部导航
- **THEN** 项目标题入口 MUST 回到主 topbar 原位置

### Requirement: 左右 Topbar 高度与下拉可见性必须稳定

系统 MUST 保证侧栏头部与主 topbar 高度一致，并确保项目下拉在侧栏头部场景不被裁剪。

#### Scenario: topbar height parity

- **GIVEN** 页面同时显示侧栏头部与主 topbar
- **WHEN** 顶部区域渲染完成
- **THEN** 两侧 topbar MUST 使用同一高度基线
- **AND** 分割线 MUST 视觉对齐

#### Scenario: project dropdown visibility in sidebar header

- **GIVEN** 项目入口位于侧栏头部
- **WHEN** 用户展开项目下拉
- **THEN** 下拉 MUST 完整可见且可交互
- **AND** MUST NOT 被上层容器裁剪或遮罩
