# file-view-markdown-reading-ux Specification

## Purpose

定义 Markdown 文件在文件查看器中的默认进入模式、模式切换方式与阅读渲染契约，使 Markdown 文件默认更接近源码阅读器，而不是常驻双栏工作台。

## ADDED Requirements

### Requirement: Markdown Opens in Single-Pane Source Editing by Default

系统 MUST 在用户首次从文件树打开 Markdown 文件时默认进入单屏源码编辑模式，不得默认展示编辑区与预览区并列的双栏布局。

#### Scenario: first open enters source editing instead of split view

- **WHEN** 用户打开任意 `*.md` 或 `*.mdx` 文件
- **THEN** 系统 MUST 默认进入源码编辑模式
- **AND** 文件查看器 MUST 仅显示单个编辑面板
- **AND** 不得默认显示并列预览面板

### Requirement: Markdown Uses Explicit Edit and Preview Modes

系统 SHALL 为 Markdown 文件提供显式的编辑模式与预览模式切换，避免在同一默认视图中同时承载源码编辑与渲染预览。

#### Scenario: top action bar switches from edit to preview

- **WHEN** 用户在 Markdown 编辑模式下点击预览动作
- **THEN** 系统 SHALL 切换到 Markdown 渲染预览模式
- **AND** 同一时刻不得继续显示并列源码编辑面板

#### Scenario: top action bar switches from preview back to edit

- **WHEN** 用户在 Markdown 预览模式下点击编辑动作
- **THEN** 系统 SHALL 切换回 Markdown 单屏源码编辑模式
- **AND** 编辑器内容 MUST 保持与当前文件内容一致

### Requirement: Markdown Rendering Avoids Forced Reflow of Wide Content

系统 MUST 在文件查看器的 Markdown 阅读场景中避免为适配容器宽度而强制重排宽内容，尤其是代码块、表格、长链接和其他宽结构内容。

#### Scenario: markdown source view exposes horizontal scroll for long lines

- **WHEN** 用户在 Markdown 源码编辑模式中查看超长单行内容
- **THEN** 系统 MUST 保持源码不自动换行
- **AND** 用户 MUST 能通过横向滚动查看完整内容

#### Scenario: rendered markdown preserves wide structural blocks

- **WHEN** 用户在 Markdown 预览模式中查看宽代码块、宽表格或超长链接
- **THEN** 系统 MUST 不得通过强制折行破坏其原有结构
- **AND** 宽内容区域 MUST 提供横向滚动或等效的完整可达方式
