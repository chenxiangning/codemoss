# Project Memory CRUD

## Purpose

提供项目记忆的完整 CRUD 操作接口，覆盖创建、读取、更新、删除、设置管理与自动分类能力，并要求在 workspace 维度保持隔离、可检索、可分页、可校验与幂等语义一致。

## Requirements

### Requirement: 创建记忆 (Create)

系统 MUST 提供 `project_memory_create` 命令,支持手动和自动创建记忆。

#### Scenario: 手动创建记忆

- **GIVEN** 用户在记忆管理 UI 中填写标题和详情
- **WHEN** 用户点击"新增"按钮
- **THEN** 系统应调用 `project_memory_create` 命令
- **AND** 使用当前 workspace_id
- **AND** 自动分类 kind 和 importance
- **AND** 计算 fingerprint 并检查重复
- **AND** 返回新创建的记忆 ID

#### Scenario: 创建时自动分类

- **GIVEN** 记忆内容包含 "error" 或 "bug" 关键词
- **WHEN** 系统执行 `classify_kind`
- **THEN** kind 应自动设置为 "known_issue"

#### Scenario: 创建时去重检查

- **GIVEN** 已存在指纹为 "abc123..." 的记忆
- **WHEN** 尝试创建相同内容的记忆
- **THEN** 系统应返回 null(跳过写入)
- **AND** 不应创建重复记忆

---

### Requirement: 读取记忆 (Read)

系统 MUST 提供单条查询(`project_memory_get`)和列表查询(`project_memory_list`)能力。

#### Scenario: 按 ID 查询单条记忆

- **GIVEN** 记忆 ID 为 "memory-123"
- **WHEN** 调用 `project_memory_get(memory-123, workspace-id)`
- **THEN** 应返回该记忆的完整数据
- **AND** 包含所有字段(id, title, summary, detail, tags, etc.)

#### Scenario: 列表查询支持分页

- **GIVEN** workspace 中共有 100 条记忆
- **WHEN** 调用 `project_memory_list` 并指定 page=0, pageSize=50
- **THEN** 应返回前 50 条记忆
- **AND** 返回 total=100
- **AND** 支持后续查询 page=1 获取剩余 50 条

#### Scenario: 列表查询支持关键词搜索

- **GIVEN** 记忆标题包含 "数据库优化"
- **WHEN** 调用 `project_memory_list` 并指定 query="数据库"
- **THEN** 应返回标题或摘要匹配"数据库"的记忆
- **AND** 大小写不敏感匹配

#### Scenario: 列表查询支持 kind 筛选

- **GIVEN** workspace 中有 note、conversation、known_issue 三种 kind
- **WHEN** 调用 `project_memory_list` 并指定 kind="known_issue"
- **THEN** 应仅返回 kind 为 "known_issue" 的记忆
- **AND** 不应包含其他类型的记忆

#### Scenario: 列表查询支持 importance 筛选

- **GIVEN** workspace 中有 high、medium、low 三种 importance
- **WHEN** 调用 `project_memory_list` 并指定 importance="high"
- **THEN** 应仅返回 importance 为 "high" 的记忆

#### Scenario: 列表查询支持标签筛选

- **GIVEN** 记忆标签包含 ["performance", "database"]
- **WHEN** 调用 `project_memory_list` 并指定 tag="performance"
- **THEN** 应返回包含 "performance" 标签的所有记忆

---

### Requirement: 更新记忆 (Update)

系统 MUST 提供 `project_memory_update` 命令,支持部分字段更新。

#### Scenario: 更新记忆标题和详情

- **GIVEN** 记忆 ID 为 "memory-123"
- **WHEN** 调用 `project_memory_update(memory-123, {title: "新标题", detail: "新详情"})`
- **THEN** 应更新该记忆的 title 和 detail 字段
- **AND** updatedAt 字段应更新为当前时间戳
- **AND** 其他字段保持不变

#### Scenario: 更新记忆标签

- **GIVEN** 记忆原标签为 ["tag1", "tag2"]
- **WHEN** 调用 `project_memory_update` 并设置 tags=["tag3"]
- **THEN** 应替换标签为 ["tag3"]
- **AND** 不应保留原标签

#### Scenario: 更新不存在的记忆

- **GIVEN** 记忆 ID 为 "memory-999" 不存在
- **WHEN** 调用 `project_memory_update(memory-999, ...)`
- **THEN** 应返回错误
- **AND** 错误信息应指示"记忆不存在"

---

### Requirement: 删除记忆 (Delete)

系统 MUST 提供 `project_memory_delete` 命令,支持软删除机制。

#### Scenario: 软删除记忆

- **GIVEN** 记忆 ID 为 "memory-123"
- **WHEN** 调用 `project_memory_delete(memory-123, workspace-id)`
- **THEN** 应设置 deletedAt 字段为当前时间戳
- **AND** 不应物理删除记忆数据
- **AND** 后续列表查询不应返回该记忆

#### Scenario: 删除已删除的记忆

- **GIVEN** 记忆已被软删除(deletedAt 不为 null)
- **WHEN** 再次调用 `project_memory_delete`
- **THEN** 应返回成功(幂等操作)
- **AND** deletedAt 字段保持不变

#### Scenario: 删除不存在的记忆

- **GIVEN** 记忆 ID 为 "memory-999" 不存在
- **WHEN** 调用 `project_memory_delete(memory-999, workspace-id)`
- **THEN** 应返回错误
- **AND** 错误信息应指示"记忆不存在"

---

### Requirement: 设置管理

系统 MUST 提供 `project_memory_get_settings` 和 `project_memory_update_settings` 命令管理配置。

#### Scenario: 获取全局设置

- **WHEN** 调用 `project_memory_get_settings()`
- **THEN** 应返回当前全局配置
- **AND** 包含 autoEnabled、dedupeEnabled、desensitizeEnabled、workspaceOverrides

#### Scenario: 更新全局设置

- **GIVEN** 当前 autoEnabled 为 true
- **WHEN** 调用 `project_memory_update_settings({autoEnabled: false})`
- **THEN** 应更新全局配置
- **AND** 后续获取设置应返回 autoEnabled=false

#### Scenario: 更新 workspace 级别配置

- **GIVEN** workspace ID 为 "workspace-a"
- **WHEN** 调用 `project_memory_update_settings` 并设置 workspace-a 的 autoEnabled=false
- **THEN** 应在 workspaceOverrides 中保存该配置
- **AND** 该 workspace 的自动采集应被禁用
- **AND** 其他 workspace 不受影响

---

### Requirement: 自动分类

系统 MUST 根据记忆内容自动分类 kind 和 importance。

#### Scenario: 自动分类为 known_issue

- **GIVEN** 记忆内容包含 "error"、"exception"、"failed"、"bug" 等关键词
- **WHEN** 系统执行 `classify_kind`
- **THEN** kind 应设置为 "known_issue"

#### Scenario: 自动分类为 code_decision

- **GIVEN** 记忆内容包含 "decide"、"decision"、"architecture"、"tradeoff"
- **WHEN** 系统执行 `classify_kind`
- **THEN** kind 应设置为 "code_decision"

#### Scenario: 自动分类为 project_context

- **GIVEN** 记忆内容包含 "project"、"workspace"、"context"、"stack"
- **WHEN** 系统执行 `classify_kind`
- **THEN** kind 应设置为 "project_context"

#### Scenario: 默认分类为 note

- **GIVEN** 记忆内容不包含任何特殊关键词
- **WHEN** 系统执行 `classify_kind`
- **THEN** kind 应设置为 "note"

#### Scenario: 自动分类 importance 为 high

- **GIVEN** 记忆内容包含 "critical"、"urgent"、"security"、"production"
- **WHEN** 系统执行 `classify_importance`
- **THEN** importance 应设置为 "high"

#### Scenario: 自动分类 importance 为 medium

- **GIVEN** 记忆内容长度 >= 240 字符
- **AND** 不包含 high 级别关键词
- **WHEN** 系统执行 `classify_importance`
- **THEN** importance 应设置为 "medium"

#### Scenario: 默认分类 importance 为 low

- **GIVEN** 记忆内容长度 < 240 字符
- **AND** 不包含 high 级别关键词
- **WHEN** 系统执行 `classify_importance`
- **THEN** importance 应设置为 "low"

---

### Requirement: 数据验证

系统 MUST 在创建和更新时验证记忆数据的完整性和有效性。

#### Scenario: 验证必需字段

- **GIVEN** 尝试创建记忆但缺少 title 字段
- **WHEN** 调用 `project_memory_create`
- **THEN** 应返回验证错误
- **AND** 错误信息应指示"title 是必需字段"

#### Scenario: 验证字段长度限制

- **GIVEN** title 长度超过 200 字符
- **WHEN** 调用 `project_memory_create`
- **THEN** 应返回验证错误
- **AND** 错误信息应指示"title 超过最大长度限制"

#### Scenario: 验证 kind 枚举值

- **GIVEN** kind 设置为 "invalid_kind"
- **WHEN** 调用 `project_memory_create`
- **THEN** 应返回验证错误
- **AND** 错误信息应列出有效的 kind 值

#### Scenario: 验证 importance 枚举值

- **GIVEN** importance 设置为 "invalid_importance"
- **WHEN** 调用 `project_memory_create`
- **THEN** 应返回验证错误
- **AND** 错误信息应列出有效的 importance 值
