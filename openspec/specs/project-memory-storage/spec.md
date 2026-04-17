# Project Memory Storage

## Purpose

提供按 workspace 隔离的项目记忆持久化存储能力,支持并发安全、去重、脱敏等核心数据保障机制。

## Requirements

### Requirement: Workspace 隔离存储

系统 MUST 按 `workspace_id` 隔离存储项目记忆,确保不同项目间的记忆数据完全独立。

#### Scenario: 创建记忆时自动隔离

- **GIVEN** 用户在 workspace A 中创建记忆
- **WHEN** 系统保存记忆数据
- **THEN** 记忆数据应存储在 workspace A 专属的存储路径下
- **AND** 其他 workspace 无法访问此记忆

#### Scenario: 查询记忆时自动过滤

- **GIVEN** workspace A 和 workspace B 各有 10 条记忆
- **WHEN** 用户在 workspace A 中查询记忆列表
- **THEN** 系统应仅返回 workspace A 的 10 条记忆
- **AND** 不应包含 workspace B 的记忆

---

### Requirement: 分项目文件夹存储结构

系统 MUST 采用 `{workspace-slug}--{id8}` 格式为每个项目创建独立文件夹,并按日期分桶存储记忆数据。

#### Scenario: 项目文件夹命名规范

- **GIVEN** workspace 名称为 "codemoss" 且 ID 为 "abc12345-..."
- **WHEN** 系统初始化该 workspace 的存储路径
- **THEN** 应创建目录 `~/.codemoss/project-memory/codemoss--abc12345/`
- **AND** 文件夹名称应符合文件系统命名规范(小写、连字符)

#### Scenario: 按日期分桶存储

- **GIVEN** 当前日期为 2026-02-10
- **WHEN** 系统保存一条记忆
- **THEN** 记忆数据应写入 `{workspace-folder}/2026-02-10.json`
- **AND** 同一天创建的所有记忆应存储在同一个 JSON 文件中

#### Scenario: 跨天记忆自动分桶

- **GIVEN** 2026-02-09 已有 5 条记忆
- **AND** 当前日期为 2026-02-10
- **WHEN** 用户创建新记忆
- **THEN** 新记忆应写入 `2026-02-10.json`
- **AND** 不应修改 `2026-02-09.json` 文件

---

### Requirement: SHA-256 指纹去重

系统 MUST 使用 SHA-256 算法计算记忆内容指纹,支持精确去重和 legacy 兼容检查。

#### Scenario: 计算 SHA-256 指纹

- **GIVEN** 记忆内容为 "这是一条测试记忆"
- **WHEN** 系统计算内容指纹
- **THEN** 应使用 SHA-256 算法生成 256-bit 哈希值
- **AND** 截取前 128 bit 作为最终指纹
- **AND** 指纹应表示为 32 位十六进制字符串

#### Scenario: 检测重复记忆(SHA-256)

- **GIVEN** 已存在指纹为 "abc123..." 的记忆
- **WHEN** 用户尝试创建相同内容的记忆
- **THEN** 系统应计算新记忆的指纹
- **AND** 检测到指纹冲突后应拒绝写入
- **AND** 返回 null 表示跳过重复记忆

#### Scenario: Legacy 指纹兼容检查

- **GIVEN** 旧版本使用不同的指纹算法
- **WHEN** 系统检查重复时
- **THEN** 应同时检查 SHA-256 指纹和 legacy 指纹
- **AND** 只要任一指纹匹配即判定为重复

---

### Requirement: 并发写入保护

系统 MUST 使用全局 Mutex 和文件锁机制,确保多线程/多进程环境下的数据一致性。

#### Scenario: 全局 Mutex 保护

- **GIVEN** 两个并发请求同时创建记忆
- **WHEN** 第一个请求获取 Mutex 锁并开始写入
- **THEN** 第二个请求应阻塞等待
- **AND** 直到第一个请求释放锁后才能继续执行

#### Scenario: 文件锁保护日期文件

- **GIVEN** 当前正在写入 `2026-02-10.json`
- **WHEN** 另一个进程尝试修改同一文件
- **THEN** 系统应使用 `with_file_lock()` 获取文件锁
- **AND** 确保同一时间只有一个进程可以写入该文件

#### Scenario: 8 个 Tauri Command 均受保护

- **GIVEN** Tauri Command: `project_memory_create/update/delete/list/get/get_settings/update_settings/capture_auto`
- **WHEN** 任意 command 被调用
- **THEN** 该 command 必须在 Mutex 保护下执行
- **AND** 涉及文件操作的部分必须额外使用文件锁

---

### Requirement: 脱敏处理

系统 MUST 在记忆存储前执行脱敏处理,移除敏感信息(密钥、令牌、密码、URL、邮箱等)。

#### Scenario: 检测并脱敏 SSH 密钥

- **GIVEN** 记忆内容包含 SSH 私钥头部 "-----BEGIN RSA PRIVATE KEY-----"
- **WHEN** 系统执行脱敏处理
- **THEN** 应将整个密钥块替换为 `[REDACTED_SSH_KEY]`

#### Scenario: 检测并脱敏 API 密钥

- **GIVEN** 记忆内容包含 "sk-1234567890abcdef..."
- **WHEN** 系统执行脱敏处理
- **THEN** 应将 OpenAI 风格密钥替换为 `[REDACTED_API_KEY]`

#### Scenario: 检测并脱敏数据库 URL

- **GIVEN** 记忆内容包含 "postgresql://user:pass@localhost/db"
- **WHEN** 系统执行脱敏处理
- **THEN** 应将数据库连接字符串替换为 `[REDACTED_DB_URL]`

#### Scenario: 10 条模式 + 1 条兜底规则

- **GIVEN** 脱敏规则集包含 10 条 regex 模式
- **WHEN** 所有模式都未匹配
- **THEN** 应触发兜底规则(混合字母数字长字符串)
- **AND** 兜底规则应捕获潜在的未知敏感信息

---

### Requirement: 存储配置管理

系统 MUST 提供独立的 `settings.json` 管理全局配置和 workspace 级别覆盖。

#### Scenario: 全局配置结构

- **GIVEN** 系统初始化存储配置
- **WHEN** 读取 `~/.codemoss/project-memory/settings.json`
- **THEN** 应包含以下字段:
    - `autoEnabled` (boolean): 全局自动采集开关
    - `captureMode` (string): 采集模式("balanced")
    - `dedupeEnabled` (boolean): 去重开关
    - `desensitizeEnabled` (boolean): 脱敏开关
    - `workspaceOverrides` (object): workspace 级别配置覆盖

#### Scenario: Workspace 级别配置覆盖

- **GIVEN** 全局 `autoEnabled` 为 true
- **AND** workspace A 设置 `workspaceOverrides["workspace-a"].autoEnabled = false`
- **WHEN** 在 workspace A 中创建记忆
- **THEN** 应使用 workspace A 的配置(false)
- **AND** 忽略全局配置

---

### Requirement: 文件格式与结构

系统 MUST 使用 JSON 格式存储记忆数据,确保可读性和可解析性。

#### Scenario: 日期文件 JSON 格式

- **GIVEN** 日期文件 `2026-02-10.json`
- **WHEN** 系统读取该文件
- **THEN** 文件应为有效的 JSON 数组
- **AND** 每个元素应为一个 `ProjectMemoryItem` 对象

#### Scenario: ProjectMemoryItem 必需字段

- **GIVEN** 一条记忆数据
- **WHEN** 系统序列化为 JSON
- **THEN** 必须包含以下字段:
    - `id` (string): UUID
    - `workspaceId` (string): workspace 隔离键
    - `kind` (string): 记忆类型
    - `title` (string): 标题
    - `summary` (string): 摘要
    - `cleanText` (string): 清洗后文本
    - `fingerprint` (string): SHA-256 指纹
    - `importance` (string): 优先级
    - `createdAt` (number): 创建时间戳
    - `updatedAt` (number): 更新时间戳

#### Scenario: 可选字段处理

- **GIVEN** 一条记忆数据缺少 `detail` 字段
- **WHEN** 系统序列化为 JSON
- **THEN** 应允许可选字段为 null 或省略
- **AND** 不应因可选字段缺失而报错
