# OpenCode Engine Integration

## Purpose

为 CodeMoss 集成 OpenCode 引擎支持,扩展现有的多引擎架构(Claude Code + Codex),实现统一的 AI 编码助手切换能力。

## Requirements

### Requirement: OpenCode CLI 检测与版本识别

- **GIVEN** OpenCode CLI 已安装并可用在系统 PATH 中
- **WHEN** 用户打开应用设置页面或引擎切换面板
- **THEN** 系统 SHALL 自动检测 OpenCode CLI 并显示版本信息
- **AND** 检测逻辑 SHALL 与现有 Claude/Codex 检测保持一致

#### Scenario: 首次检测 OpenCode

- **GIVEN** 用户系统已安装 `opencode` CLI
- **WHEN** 应用启动完成
- **THEN** 系统 SHALL 执行 `opencode --version` 获取版本号
- **AND** 将检测结果存储在 `EngineStatus` 结构中:
  ```rust
  EngineStatus {
    engine_type: EngineType::OpenCode,
    installed: true,
    version: Some("1.2.3"), // 从 CLI 输出解析
    bin_path: Some("/usr/local/bin/opencode"),
    home_dir: Some("~/.opencode"),
    models: vec![...], // 可用模型列表
    default_model: Some("opencode-gpt-4"),
    features: EngineFeatures::opencode(),
    error: None,
  }
  ```

#### Scenario: OpenCode 未安装

- **GIVEN** 用户系统未安装 OpenCode CLI
- **WHEN** 应用尝试检测
- **THEN** 系统 SHALL 返回未安装状态:
  ```rust
  EngineStatus {
    engine_type: EngineType::OpenCode,
    installed: false,
    version: None,
    bin_path: None,
    home_dir: None,
    models: vec![],
    default_model: None,
    features: EngineFeatures::default(),
    error: Some("OpenCode CLI not found in PATH"),
  }
  ```

### Requirement: OpenCode 会话管理

- **GIVEN** 用户选择 OpenCode 作为当前引擎
- **WHEN** 用户在 Composer 中发送消息
- **THEN** 系统 SHALL 使用 `OpenCodeSession` 管理会话生命周期
- **AND** 支持 session resume 功能(通过 `--resume` 参数)
- **AND** 支持会话中断和清理

#### Scenario: 创建新会话

- **GIVEN** 用户切换到 OpenCode 引擎
- **WHEN** 打开新对话或切换工作空间
- **THEN** 系统 SHALL 创建新的 `OpenCodeSession` 实例:
  ```rust
  OpenCodeSession {
    workspace_id: "project-123",
    workspace_path: PathBuf::from("/path/to/workspace"),
    session_id: RwLock::new(None),
    event_sender: broadcast::channel(1024),
    bin_path: Some("/custom/path/to/opencode"), // 可选自定义路径
    home_dir: Some("~/.opencode"),          // 可选自定义 home
    custom_args: Some("--debug"),            // 可选额外参数
    active_processes: Mutex::new(HashMap::new()),
    interrupted: AtomicBool::new(false),
  }
  ```

#### Scenario: 发送消息并流式输出

- **GIVEN** OpenCode 会话已创建
- **WHEN** 用户在 Composer 输入 "帮我分析这个文件"
- **THEN** 系统 SHALL 构建 CLI 命令并启动子进程:
  ```bash
  opencode -p "帮我分析这个文件" \
    --output-format stream-json \
    --include-partial-messages \
    --model opencode-gpt-4 \
    --verbose
  ```
- **AND** 系统 SHALL 从 stdout 逐行解析 JSON 事件流
- **AND** 通过 `broadcast::channel` 实时推送到前端

#### Scenario: 会话恢复

- **GIVEN** 用户之前与 OpenCode 对话过
- **WHEN** 用户发送新消息时选择 "继续上次对话"
- **THEN** 系统 SHALL 在命令中添加 `--resume <session_id>` 参数
- **AND** 从存储的会话记录中恢复上下文

#### Scenario: 中断当前会话

- **GIVEN** OpenCode 正在流式输出响应
- **WHEN** 用户点击停止按钮或切换引擎
- **THEN** 系统 SHALL:
    1. 设置 `interrupted` 标志为 `true`
    2. 发送 SIGTERM (或 `kill`) 给子进程
    3. 清理会话状态

### Requirement: 流式 JSON 事件解析

- **GIVEN** OpenCode CLI 输出流式 JSON 到 stdout
- **WHEN** 子进程持续输出事件
- **THEN** 系统 SHALL 逐行解析并转换为统一的 `EngineEvent`

#### Scenario: 内容增量事件

- **GIVEN** CLI 输出 `{"type":"content_delta","text":"func"}`
- **WHEN** 解析器读取到该行
- **THEN** 系统 SHALL 发送 `EngineEvent::TextDelta`:
  ```rust
  EngineEvent::TextDelta {
    workspace_id: "project-123".to_string(),
    text: "func".to_string(),
  }
  ```

#### Scenario: 工具使用事件

- **GIVEN** CLI 输出 `{"type":"tool_use","name":"read_file","input":{"path":"src/main.rs"}}`
- **WHEN** 解析器读取到该行
- **THEN** 系统 SHALL 发送 `EngineEvent::ToolStarted`:
  ```rust
  EngineEvent::ToolStarted {
    workspace_id: "project-123".to_string(),
    tool_id: "tool-1".to_string(),
    tool_name: "read_file".to_string(),
    input: Some(serde_json::json!({"path": "src/main.rs"})),
  }
  ```

#### Scenario: 轮次完成事件

- **GIVEN** CLI 输出 `{"type":"turn_complete","session_id":"sess-123"}`
- **WHEN** 解析器读取到该行
- **THEN** 系统 SHALL 发送 `EngineEvent::TurnCompleted`:
  ```rust
  EngineEvent::TurnCompleted {
    workspace_id: "project-123".to_string(),
    result: Some(serde_json::json!({
      "session_id": "sess-123"
    })),
  }
  ```

#### Scenario: 错误事件

- **GIVEN** CLI 输出 `{"type":"error","error":"File not found"}`
- **WHEN** 解析器读取到该行
- **THEN** 系统 SHALL 发送 `EngineEvent::TurnError`:
  ```rust
  EngineEvent::TurnError {
    workspace_id: "project-123".to_string(),
    error: "File not found".to_string(),
    code: Some("FILE_NOT_FOUND".to_string()),
  }
  ```

### Requirement: 模型管理

- **GIVEN** OpenCode CLI 支持多个模型
- **WHEN** 用户在设置中选择模型或系统默认模型
- **THEN** 系统 SHALL 在命令中添加 `--model <model_id>` 参数

#### Scenario: 获取可用模型列表

- **GIVEN** 应用检测到 OpenCode 已安装
- **WHEN** 前端调用 `get_engine_models("opencode")`
- **THEN** 系统 SHALL 返回模型列表:
  ```rust
  vec![
    ModelInfo {
      id: "opencode-gpt-4".to_string(),
      name: "OpenCode GPT-4".to_string(),
      alias: Some("gpt4".to_string()),
      default: true,
      description: "OpenCode 高级模型".to_string(),
      provider: Some("opencode".to_string()),
      tags: vec![],
    },
    ModelInfo {
      id: "opencode-gpt-3.5".to_string(),
      name: "OpenCode GPT-3.5".to_string(),
      alias: Some("gpt35".to_string()),
      default: false,
      description: "OpenCode 标准模型".to_string(),
      provider: Some("opencode".to_string()),
      tags: vec![],
    },
  ]
  ```

#### Scenario: 用户切换模型

- **GIVEN** 用户在设置面板选择 "OpenCode GPT-3.5"
- **WHEN** 用户发送下一条消息
- **THEN** 系统 SHALL 在命令中添加 `--model opencode-gpt-3.5`

### Requirement: 引擎切换

- **GIVEN** 用户当前使用 Claude Code 引擎
- **WHEN** 用户在设置中切换到 OpenCode
- **THEN** 系统 SHALL 调用 `EngineManager::set_active_engine(EngineType::OpenCode)`
- **AND** 验证 OpenCode 已安装
- **AND** 更新 UI 显示当前引擎状态
- **AND** 重新加载可用模型列表

#### Scenario: 切换到未安装的引擎

- **GIVEN** 用户尝试切换到 OpenCode
- **WHEN** OpenCode CLI 未安装
- **THEN** 系统 SHALL 返回错误并保持当前引擎不变
- **AND** 在 UI 中显示错误提示:
  ```json
  {
    "error": "OpenCode CLI is not installed",
    "suggestion": "请先安装 OpenCode CLI: npm install -g @opencode/cli"
  }
  ```

#### Scenario: 切换成功后发送消息

- **GIVEN** 用户成功切换到 OpenCode
- **WHEN** 切换完成后用户在 Composer 输入消息
- **THEN** 系统 SHALL 使用 OpenCode CLI 而非之前的引擎
- **AND** 消息格式和参数应符合 OpenCode 规范

### Requirement: 前端发送分发隔离（不影响现有引擎）

- **GIVEN** 当前发送链路在 `useThreadMessaging` 中存在引擎分发
- **WHEN** 接入 OpenCode
- **THEN** 系统 SHALL 将发送分发从二路（Claude vs 其他）升级为三路（Claude / Codex / OpenCode）
- **AND** `Claude` 分支逻辑 SHALL 保持现状（调用 `engineSendMessage` + 现有事件处理）
- **AND** `Codex` 分支逻辑 SHALL 保持现状（调用 `sendUserMessageService`）
- **AND** `OpenCode` 分支 SHALL 使用独立发送路径（基于 `engineSendMessage` 的 OpenCode 后端分支）
- **AND** 不得通过修改 Claude/Codex 内部实现来“顺带支持” OpenCode

#### Scenario: 三路分发行为验证

- **GIVEN** activeEngine 分别为 `claude`、`codex`、`opencode`
- **WHEN** 用户发送同一条消息
- **THEN** 系统 SHALL 路由到对应独立分支
- **AND** 不出现 `opencode` 走 `codex` API 的情况

### Requirement: 特性支持

- **GIVEN** OpenCode CLI 支持特定特性
- **WHEN** 实现集成时
- **THEN** 系统 SHOULD 支持以下特性(按 OpenCode CLI 实际能力)

#### Scenario: Reasoning Effort 支持

- **GIVEN** OpenCode 支持 reasoning effort levels
- **WHEN** 用户在设置中选择 "high" reasoning effort
- **WHEN** 用户发送消息
- **THEN** 系统 SHALL 添加 `--reasoning-effort high` 参数
- **AND** 可选值: "low", "medium", "high"

#### Scenario: 图片输入支持

- **GIVEN** 用户上传图片并附在消息中
- **WHEN** 用户发送消息
- **THEN** 系统 SHALL:
    1. 将图片编码为 base64
    2. 构建包含图片的 JSON 消息
    3. 通过 stdin 发送给 CLI
    4. 添加 `--input-format stream-json` 参数

#### Scenario: 协作模式(Collaboration Mode)

- **GIVEN** OpenCode 支持协作模式
- **WHEN** 用户启用协作功能
- **THEN** 系统 SHALL 添加 `--collaboration-mode <mode>` 参数
- **AND** 可选模式根据 OpenCode CLI 定义

### Requirement: 配置管理

- **GIVEN** 用户可能需要自定义 OpenCode CLI 路径或参数
- **WHEN** 用户在设置中配置
- **THEN** 系统 SHALL 支持 `EngineConfig`:

#### Scenario: 自定义二进制路径

- **GIVEN** 用户将 OpenCode 安装在非标准位置
- **WHEN** 用户在设置中指定路径 `/custom/path/to/opencode`
- **THEN** 系统 SHALL 在所有命令中使用该路径而非查找 PATH
- **AND** 存储配置在:
  ```json
  {
    "opencode": {
      "bin_path": "/custom/path/to/opencode",
      "home_dir": "~/.opencode",
      "custom_args": "--debug --log-level trace"
    }
  }
  ```

#### Scenario: 环境变量设置

- **GIVEN** OpenCode CLI 需要特定环境变量(如 API Key)
- **WHEN** 用户在设置中配置
- **THEN** 系统 SHALL 在启动子进程时设置环境:
  ```rust
  cmd.env("OPENCODE_API_KEY", "sk-...");
  cmd.env("OPENCODE_HOME", "~/.opencode");
  ```

### Requirement: 错误处理与日志

- **GIVEN** OpenCode CLI 执行可能失败
- **WHEN** 发生错误时
- **THEN** 系统 SHALL 提供清晰的错误信息和恢复建议

#### Scenario: CLI 未找到

- **GIVEN** 系统尝试执行 OpenCode 命令
- **WHEN** 可执行文件不存在
- **THEN** 系统 SHALL 返回用户友好错误:
  ```json
  {
    "error": "opencode: command not found",
    "suggestion": "请确保 OpenCode CLI 已安装: npm install -g @opencode/cli",
    "docs": "https://github.com/opencode/opencode-cli"
  }
  ```

#### Scenario: 执行超时

- **GIVEN** CLI 命令执行超过预期时间
- **WHEN** 超时(如 60 秒无响应)
- **THEN** 系统 SHALL 终止子进程并返回超时错误
- **AND** 建议用户检查网络连接或减少上下文长度

#### Scenario: JSON 解析失败

- **GIVEN** CLI 输出无效的 JSON 格式
- **WHEN** 解析器无法解析事件
- **THEN** 系统 SHALL:
    1. 记录原始输出到日志
    2. 发送 `EngineEvent::TurnError` 并附带解析错误信息
    3. 继续尝试解析后续行(容错)

### Requirement: 性能与并发

- **GIVEN** 系统可能同时处理多个工作空间的消息
- **WHEN** 多个 OpenCode 会话同时活跃
- **THEN** 系统 SHALL 确保线程安全和资源正确管理

#### Scenario: 并发消息处理

- **GIVEN** 用户在不同工作空间快速切换
- **WHEN** 两个工作空间都使用 OpenCode
- **THEN** 系统 SHALL:
    1. 为每个工作空间创建独立的 `OpenCodeSession` 实例
    2. 每个会话管理自己的子进程
    3. 使用 `Mutex` 保护共享状态访问
    4. 事件广播按 workspace_id 隔离

#### Scenario: 资源清理

- **GIVEN** 工作空间被关闭或删除
- **WHEN** 会话不再需要
- **THEN** 系统 SHALL:
    1. 终止所有活跃的子进程
    2. 清空事件广播频道
    3. 从 `EngineManager` 中移除会话引用
    4. 释放内存资源

### Requirement: 测试

- **GIVEN** 需要确保 OpenCode 集成的稳定性
- **WHEN** 开发完成后
- **THEN** 系统 SHALL 包含以下测试

#### Scenario: 单元测试 - 检测逻辑

- **GIVEN** `OpenCode` 检测逻辑
- **WHEN** 编写单元测试
- **THEN** 系统 SHALL 验证:
    - `detect_opencode_status(None)` 返回正确的 `EngineStatus`
    - 版本解析逻辑正确处理各种输出格式
    - 未安装场景返回适当的错误信息

#### Scenario: 单元测试 - 命令构建

- **GIVEN** `OpenCodeSession` 实例
- **WHEN** 调用 `build_command(params)`
- **THEN** 系统 SHALL 验证:
    - 命令以 `opencode` 开头
    - 包含 `-p` 参数
    - 正确添加 `--output-format stream-json`
    - 模型参数正确添加 `--model <id>`
    - 会话恢复参数正确添加 `--resume <id>`

#### Scenario: 集成测试 - 端到端消息流

- **GIVEN** OpenCode CLI 模拟输出
- **WHEN** 前端发送测试消息
- **THEN** 系统 SHALL 验证完整的事件流:
    1. `TextDelta` 事件正确推送
    2. `ToolStarted` 事件正确解析
    3. `TurnCompleted` 事件正确触发
    4. 会话 ID 正确保存和传递

#### Scenario: 错误处理测试

- **GIVEN** 模拟 CLI 失败场景
- **WHEN** 返回非零退出码
- **THEN** 系统 SHALL 验证:
    - 错误事件正确发送
    - 错误信息用户友好
    - 会话状态正确清理

### Requirement: 文档与示例

- **GIVEN** 开发者需要理解如何使用 OpenCode 集成
- **WHEN** 查看文档
- **THEN** 系统 SHALL 提供清晰的使用示例和架构说明

#### Scenario: CLI 命令示例

提供常见使用场景的完整命令示例:

```bash
# 基础对话
opencode -p "帮我写一个排序算法" --output-format stream-json

# 指定模型
opencode -p "分析这段代码" --model opencode-gpt-3.5 --output-format stream-json

# 恢复会话
opencode -p "继续刚才的话题" --resume sess-123 --output-format stream-json

# 高推理强度
opencode -p "设计一个复杂的系统架构" --reasoning-effort high --output-format stream-json

# 包含图片
echo '{"text":"描述这个图片","images":["data:image/png;base64,..."]}' | \
opencode -p "" --input-format stream-json

# 协作模式
opencode -p "与用户协作完成任务" --collaboration-mode pair --output-format stream-json
```

#### Scenario: 配置示例

展示各种配置场景:

```json
// settings.json 中的引擎配置示例
{
  "default_engine": "opencode",
  "engines": {
    "opencode": {
      "bin_path": "/usr/local/bin/opencode",
      "home_dir": "~/.opencode",
      "custom_args": "--debug --log-level info",
      "default_model": "opencode-gpt-4",
      "features": {
        "reasoning_effort": true,
        "collaboration_mode": true,
        "image_input": true,
        "session_resume": true,
        "streaming": true
      }
    }
  }
}
```

## Non-Goals (非目标)

以下内容明确不在本次实现范围内:

- ❌ **OpenCode CLI 本身的功能开发** - 我们集成现有 CLI,不开发 CLI
- ❌ **修改 OpenCode CLI 行为** - 只通过标准接口调用
- ❌ **OpenCode 官方文档本地化** - 文档由 OpenCode 项目维护
- ❌ **多实例管理** - 每个工作空间独立会话,不跨工作空间共享
- ❌ **自定义协议** - 使用 CLI 提供的标准 JSON 流格式

## Success Criteria (验收标准)

实现完成后的验收标准:

1. ✅ **检测功能**: OpenCode CLI 能被正确检测并显示版本
2. ✅ **基本对话**: 能通过 OpenCode 发送简单消息并接收响应
3. ✅ **流式输出**: 响应以流式方式实时显示(非等待完成后一次性显示)
4. ✅ **事件解析**: 至少支持 `content_delta`, `tool_use`, `turn_complete` 三种事件类型
    - 映射到统一事件为 `TextDelta` / `ToolStarted` / `TurnCompleted`
5. ✅ **模型切换**: 用户能在设置中选择不同 OpenCode 模型
6. ✅ **引擎切换**: 用户能在 Claude/Codex/OpenCode 之间切换
7. ✅ **错误处理**: CLI 未安装、执行失败等场景有清晰提示
8. ✅ **配置持久化**: 自定义路径和参数能正确保存和加载
9. ✅ **测试覆盖**: 单元测试覆盖率 ≥ 80%, 包含核心场景
10. ✅ **文档完整**: 提供使用示例和架构说明

## Implementation Plan (实施计划)

### Phase 1: 基础设施 (预计 2-3 天)

**目标**: 建立 OpenCode 集成的基础代码结构

**任务列表**:

1. **创建 `opencode.rs` 模块**
    - 文件路径: `src-tauri/src/engine/opencode.rs`
    - 定义 `OpenCodeSession` 结构
    - 实现 `new()`, `subscribe()`, `build_command()`

2. **实现检测函数**
    - 文件: `src-tauri/src/engine/status.rs`
    - 添加 `detect_opencode_status()` 函数
    - 添加 `get_opencode_home_dir()` 辅助函数
    - 添加 `get_opencode_models()` 返回模型列表

3. **更新特征定义**
    - 文件: `src-tauri/src/engine/mod.rs`
    - 添加 `EngineFeatures::opencode()` 方法
    - 定义 OpenCode 特有能力集

4. **更新引擎支持判定与解析范围**
    - 文件: `src-tauri/src/engine/mod.rs`
    - 扩展 `EngineType::is_supported()` 以包含 OpenCode
    - 文件: `src-tauri/src/engine/status.rs`
    - 扩展 `detect_all_engines()` 与 `resolve_engine_type()` 支持 OpenCode
    - 文件: `src-tauri/src/engine/commands.rs`
    - 扩展 `get_engine_models()` 支持 `EngineType::OpenCode`

**验收**:

- [ ] 代码编译无错误
- [ ] `cargo test` 通过基础测试
- [ ] 能检测到 OpenCode CLI(需要提前安装 mock)

### Phase 2: 会话管理 (预计 3-4 天)

**目标**: 实现完整的会话生命周期管理

**任务列表**:

1. **实现 `send_message()` 方法**
    - 启动子进程并管理生命周期
    - 实现 stdout 流式读取
    - 支持 stdin 写入(图片场景)

2. **实现 JSON 事件解析**
    - `parse_opencode_event()` 函数
    - 支持至少 3 种事件类型
    - 错误容错处理

3. **集成到 EngineManager**
    - 添加 `opencode_sessions: HashMap`
    - 实现 `get_opencode_session()` 方法
    - 更新 `detect_single_engine()` 支持

**验收**:

- [ ] 能发送消息并接收响应
- [ ] 流式事件正确推送到前端
- [ ] 会话中断功能正常工作
- [ ] 资源正确清理

### Phase 3: 前端集成 (预计 2-3 天)

**目标**: 前端界面支持 OpenCode 引擎

**任务列表**:

1. **更新类型定义**
    - 文件: `src/types.ts`
    - 确保 `EngineType` 包含 `"opencode"`
    - 验证前端类型与后端对齐

2. **更新引擎显示映射**
    - 文件: `src/features/engine/hooks/useEngineController.ts`
    - 添加 OpenCode 显示名称
    - 确保 UI 正确显示图标和名称

3. **复用现有引擎模型查询接口**
    - 文件: `src/services/tauri.ts`
    - 复用 `get_engine_models(engineType)`，不新增 `get_opencode_models()` 专用命令
    - 通过 `engineType = "opencode"` 获取模型列表

4. **发送分发改造（最小侵入）**
    - 文件: `src/features/threads/hooks/useThreadMessaging.ts`
    - 将当前二路分发改为三路分发（`claude` / `codex` / `opencode`）
    - 保持 `claude` 与 `codex` 现有行为不变，仅新增 `opencode` 独立分支

5. **引擎可选状态修正**
    - 文件: `src/features/engine/components/EngineSelector.tsx`
    - OpenCode 完成接入后，更新 `IMPLEMENTED_ENGINES` 包含 `"opencode"`
    - UI 状态从 `coming soon` 切换为“可安装/可使用”语义

**验收**:

- [ ] 引擎切换面板显示 OpenCode 选项
- [ ] OpenCard 模型列表显示 OpenCode 模型
- [ ] 切换引擎后 Composer 正常工作
- [ ] 设置页面能配置 OpenCode

### Phase 4: 测试与验证 (预计 2-3 天)

**目标**: 确保实现质量和稳定性

**任务列表**:

1. **编写单元测试**
    - 检测逻辑测试
    - 命令构建测试
    - 事件解析测试

2. **集成测试**
    - 端到端消息流测试
    - 引擎切换测试
    - 错误处理测试

3. **手动验证**
    - 真实 OpenCode CLI 环境测试
    - 完整用户场景验证
    - 性能和内存检查

**验收**:

- [ ] 测试覆盖率 ≥ 80%
- [ ] 所有 Success Criteria 达成
- [ ] 无已知 critical bugs
- [ ] 文档完整

## Dependencies (依赖关系)

### 技术依赖

- **Rust 生态**:
    - `tokio` (异步运行时)
    - `serde_json` (JSON 序列化)
    - `uuid` (会话 ID 生成)

- **OpenCode CLI**:
    - 需要安装 `@opencode/cli` npm 包
    - 版本要求: ≥ 1.0.0
    - 必需支持:
        - `-p` (print mode)
        - `--output-format stream-json`
        - `--version`
        - `--model` 参数
        - `--resume` 参数

- **前端**:
    - React 19.1.0+ (现有)
    - TypeScript 5.8+ (现有)

### 代码依赖

- **现有模块**:
    - `src-tauri/src/engine/mod.rs` (引擎抽象层)
    - `src-tauri/src/engine/manager.rs` (引擎管理器)
    - `src-tauri/src/engine/events.rs` (事件系统)
    - `src/features/engine/hooks/useEngineController.ts` (前端控制器)

### 外部依赖

- 无新增外部依赖
- 复用现有 `Cargo.toml` 中的依赖

## Open Issues (开放问题)

### 待明确问题

1. **OpenCode CLI 实际接口未完全确定**
    - 影响: 可能需要根据实际 CLI 调整实现
    - 缓解: 需要先研究 CLI 文档或创建 mock 验证流程

2. **JSON 事件格式可能变化**
    - 影响: `parse_opencode_event()` 需要灵活
    - 缓解: 使用容错解析,记录原始输出

3. **模型列表硬编码**
    - 影响: CLI 可能支持动态模型查询
    - 改进: 考虑未来支持 `opencode --list-models` 命令

### 技术权衡

1. **CLI vs SDK 选择**
    - ✅ 优势: 解耦、安全、简单维护
    - ⚠️ 劣势: 依赖外部工具、版本兼容性

2. **与 Codex 适配器差异**
    - Codex 使用 JSON-RPC, OpenCode 使用 CLI 调用
    - 影响: 两种实现不能完全共享代码
    - 缓解: 在 `EngineManager` 层统一接口

3. **性能考虑**
    - 子进程启动开销: ~10-50ms
    - JSON 解析开销: ~1-5ms per event
    - 网络延迟: 取决于 OpenCode API

## Timeline (时间线)

**预计总工期**: 9-13 天(包含测试和文档)

**里程碑**:

- **Week 1**: Phase 1-2 完成 (基础设施 + 会话管理)
- **Week 2**: Phase 3 完成 (前端集成)
- **Week 3**: Phase 4 完成 (测试验证 + 文档)

**关键路径**:

- Day 3: 完成 `opencode.rs` 基础结构
- Day 7: 会话管理和事件解析可用
- Day 10: 前端集成完成,可开始手动测试
- Day 13: 所有测试通过,文档更新,ready for merge

## Appendix (附录)

### A. 技术架构图

```
┌─────────────────────────────────────────────────────┐
│                CodeMoss 架构                    │
├─────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐│
│  │   Claude    │    │   Codex     │    │  OpenCode   ││
│  │   Session   │    │   Adapter   │    │   Session   ││
│  │             │    │             │    │             ││
│  └─────────────┘    └─────────────┘    └─────────────┘│
│         │                │                │             │
│         ▼                ▼                ▼             │
│    EngineManager (统一抽象层)                  │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              Rust 后端服务                      │
├─────────────────────────────────────────────────────┤
│  Tauri Commands (检测/切换/发送)            │
│  Event Bus (广播到前端)                     │
│  Session Manager (生命周期管理)                │
└─────────────────────────────────────────────────────┘
```

### B. OpenCode CLI 命令参考

#### 预期命令格式(需根据实际 CLI 调整)

```bash
# 版本检测
opencode --version
# 输出示例: opencode 1.2.3

# 基础对话
opencode -p "<prompt>" --output-format stream-json
# 输出流式 JSON 事件

# 指定模型
opencode -p "<prompt>" --model <model-id> --output-format stream-json

# 会话恢复
opencode -p "<prompt>" --resume <session-id> --output-format stream-json

# 高级推理
opencode -p "<prompt>" --reasoning-effort <low|medium|high>

# 图片输入(假设支持)
opencode -p "" --input-format stream-json < image.json

# 自定义 home
OPENCODE_HOME=/custom/path opencode -p "<prompt>"

# 调试模式
opencode -p "<prompt>" --debug --log-level trace
```

### C. 事件流示例

#### 预期 JSON 事件格式

```json
// 内容增量事件
{"type":"content_delta","text":"Hello"}

// 工具使用事件
{"type":"tool_use","name":"read_file","input":{"path":"src/main.rs"}}

// 推理开始事件
{"type":"reasoning_start","effort":"high"}

// 推理结束事件
{"type":"reasoning_end","summary":"完成分析"}

// 轮次完成事件
{"type":"turn_complete","session_id":"sess-123","usage":{"input_tokens":150,"output_tokens":300}}

// 错误事件
{"type":"error","error":"API error","code":"RATE_LIMIT"}
```

### D. 测试检查清单

#### 单元测试清单

- [ ] `detect_opencode_status()` 测试
    - [ ] 返回正确的版本号
    - [ ] 未安装场景测试
    - [ ] 自定义路径场景测试

- [ ] `OpenCodeSession::build_command()` 测试
    - [ ] 基础命令构建
    - [ ] 模型参数添加
    - [ ] 会话恢复参数添加
    - [ ] reasoning effort 参数添加

- [ ] `parse_opencode_event()` 测试
    - [ ] content_delta 事件解析
    - [ ] tool_use 事件解析
    - [ ] turn_complete 事件解析
    - [ ] 错误事件解析
    - [ ] 无效 JSON 容错处理

#### 集成测试清单

- [ ] 发送消息并接收完整响应
- [ ] 流式输出实时性验证
- [ ] 引擎切换功能测试
- [ ] 并发消息处理测试
- [ ] 会话中断和恢复测试
- [ ] 错误场景和恢复测试

#### 手动测试场景

- [ ] 基本对话流程
- [ ] 模型切换
- [ ] 长消息处理
- [ ] 错误处理
- [ ] 资源清理验证

---

**文档版本**: 1.0
**创建日期**: 2026-02-13
**状态**: Draft - 待评审
