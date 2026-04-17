## MODIFIED Requirements

### Requirement: Unified File Reference Interaction
系统 MUST 将 `File changes`、`批量编辑文件`、流式文本中的文件引用统一为同一文件详情弹窗交互协议。

#### Scenario: batch edit file row opens shared file detail modal
- **WHEN** 用户点击 `批量编辑文件` 卡片中的任意文件项
- **THEN** 系统 MUST 打开统一的文件详情弹窗
- **AND** 弹窗数据源 MUST 与 `File changes` 文件详情使用同一结构

#### Scenario: file changes row opens shared file detail modal
- **WHEN** 用户点击 `File changes` 卡片中的任意文件项
- **THEN** 系统 MUST 通过统一 `onOpenDiffPath` 入口打开文件详情流程
- **AND** 文件定位 MUST 复用现有路径解析策略而非新增并行实现

#### Scenario: streaming text file reference opens shared file detail modal
- **WHEN** 用户点击流式文本中的文件引用（例如 `xxx.rs`）
- **THEN** 系统 MUST 打开同一文件详情弹窗
- **AND** MUST NOT 触发应用崩溃

#### Scenario: invalid file reference payload is recoverable
- **WHEN** 文件引用 payload 缺少必要字段（如路径或工作区上下文）
- **THEN** 系统 MUST 显示可恢复错误提示
- **AND** 当前会话交互 MUST 继续可用

#### Scenario: file changes click must not alter reused diff component behavior
- **WHEN** 用户通过 `File changes` 文件项打开 diff
- **THEN** 系统 MUST NOT 改变被复用 Git diff 组件的既有默认行为与交互语义
- **AND** 已有组件状态（例如用户既有偏好）MUST 按原契约生效
