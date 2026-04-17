# codex-chat-canvas-execution-cards-visual-refactor Specification

ADDED by change: optimize-codex-chat-canvas

## Purpose

统一 Codex 对话幕布中执行类卡片（`File changes`、`运行命令`、`批量编辑文件`）的视觉信息架构，提升扫描效率与失败定位能力。

## ADDED Requirements

### Requirement: Unified Card Skeleton

系统 MUST 为三类执行卡片提供统一骨架：标题区、状态位、摘要区、明细区。

#### Scenario: all execution cards share the same structural sections

- **WHEN** 渲染 `File changes`、`运行命令`、`批量编辑文件` 任一卡片
- **THEN** 卡片 MUST 包含标题区、状态区、摘要区、明细区
- **AND** 三类卡片 MUST 使用一致的间距与标题层级节奏

### Requirement: File Changes Summary First

`File changes` 卡片 MUST 先展示摘要，再展示文件明细。

#### Scenario: file changes card shows aggregated summary before details

- **WHEN** 卡片存在文件变更项
- **THEN** 系统 MUST 在顶部展示变更摘要（新增/修改/删除与文件总数）
- **AND** 文件明细 MUST 支持折叠/展开

### Requirement: Command Card Readability and Failure Focus

`运行命令` 卡片 MUST 区分命令头与输出内容，并在失败时聚焦错误片段。

#### Scenario: command card separates command metadata and output body

- **WHEN** 渲染命令执行卡片
- **THEN** 命令原文 MUST 在头部单独展示
- **AND** 输出内容 MUST 在明细区展示

#### Scenario: failed command emphasizes error fragment

- **WHEN** 命令执行失败（非零退出码或明确错误信号）
- **THEN** 卡片 MUST 默认展开错误片段或高亮错误块
- **AND** 普通日志 MUST 保持中性样式，不得全部误标错误

### Requirement: Batch Edit Overview and Drill-down

`批量编辑文件` 卡片 MUST 提供批处理总览与文件级下钻。

#### Scenario: batch edit card displays overview counters

- **WHEN** 渲染批量编辑卡片
- **THEN** 卡片 MUST 展示成功/失败/跳过统计
- **AND** 总计数 MUST 与文件级明细数量一致

#### Scenario: batch edit details can be expanded per file

- **WHEN** 用户查看批量编辑明细
- **THEN** 系统 MUST 支持按文件展开/折叠查看
- **AND** 用户 SHOULD 能快速定位到目标文件项

### Requirement: Visual Consistency in Chat Canvas

执行卡片重构 MUST 仅改变卡片内部信息层级，不得破坏对话幕布整体阅读节奏。

#### Scenario: card redesign preserves message flow rhythm

- **WHEN** 同一屏内存在普通消息与执行卡片混排
- **THEN** 卡片外部间距 MUST 与现有消息流节奏保持一致
- **AND** 重构不得引入明显布局跳变或遮挡
