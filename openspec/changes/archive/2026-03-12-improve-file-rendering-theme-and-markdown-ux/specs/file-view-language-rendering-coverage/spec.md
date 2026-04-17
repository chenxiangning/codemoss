# file-view-language-rendering-coverage Specification

## ADDED Requirements

### Requirement: Text File Views Respect Active Theme Contrast

系统 MUST 在文件查看器中为可文本渲染文件提供与当前主题匹配的高对比度阅读样式，不得继续使用导致正文难以辨认的低对比灰阶主文本。

#### Scenario: light theme uses light surface with dark primary text

- **WHEN** 用户在浅色主题下打开任意可文本渲染文件
- **THEN** 文件查看器中的正文区域 MUST 使用浅色背景
- **AND** 主文本 MUST 使用深色前景
- **AND** 预览态与编辑态 MUST 保持一致的可读性基线

#### Scenario: dark theme uses dark surface with light primary text

- **WHEN** 用户在深色主题下打开任意可文本渲染文件
- **THEN** 文件查看器中的正文区域 MUST 使用深色背景
- **AND** 主文本 MUST 使用浅色前景
- **AND** 预览态与编辑态 MUST 保持一致的可读性基线

### Requirement: Text Source Views Prefer Horizontal Scrolling Over Forced Wrapping

系统 MUST 在文件查看器的文本源码视图中禁止强制自动换行，并在内容超出视口宽度时提供可达的横向滚动能力。

#### Scenario: preview mode keeps long source lines unwrapped

- **WHEN** 用户在预览态查看包含超长单行内容的文本文件
- **THEN** 系统 MUST 保持该行内容不被强制折行
- **AND** 用户 MUST 能通过横向滚动查看完整内容

#### Scenario: edit mode keeps long source lines unwrapped

- **WHEN** 用户在编辑态查看或编辑包含超长单行内容的文本文件
- **THEN** 系统 MUST 保持源码行不被强制折行
- **AND** 编辑器 MUST 提供横向滚动而不是截断内容
