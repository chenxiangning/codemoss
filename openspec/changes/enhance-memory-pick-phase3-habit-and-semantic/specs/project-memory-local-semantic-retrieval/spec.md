# project-memory-local-semantic-retrieval Specification (delta · Phase-3)

## Purpose

Phase-3：生产环境可启用真实本地（或兼容）embedding provider 与持久 index，使 Pick/Scout hybrid 在 available 时真正生效。

## ADDED Requirements

### Requirement: 生产 Provider 可检测（方案 A · 无用户外置安装）

系统 MUST 在生产路径提供可 health-check 的 **应用内** embedding provider；MUST NOT 将用户独立安装的第三方运行时（如 Ollama）作为使用项目记忆或语义检索的前置条件。不可用时 MUST 回退 lexical 且不得伪装 hybrid。

#### Scenario: provider available 时 Pick 可 hybrid

- **GIVEN** 应用内生产 provider health 为 available
- **AND** workspace 存在有效 embedding index 记录
- **WHEN** Memory Pick Gate 检索用户 query
- **THEN** diagnostics.retrievalMode MAY 为 hybrid 或 semantic
- **AND** 主会话 payload MUST NOT 包含向量本身

#### Scenario: provider unavailable

- **GIVEN** 应用内模型未就绪、下载失败或 health 失败
- **WHEN** 执行 Pick 或 Scout 检索
- **THEN** retrievalMode SHALL 为 lexical
- **AND** 发送 SHALL 不被阻塞
- **AND** 系统 SHALL NOT 要求用户去安装外部软件才能继续使用记忆参考

#### Scenario: 匹配最短展示不因检索加速而缩短

- **GIVEN** Memory Pick Gate 进入 matching 展示态
- **WHEN** 本地检索（含 semantic）在 1 秒内完成
- **THEN** 系统 SHALL 仍至少展示 matching 态约 1000ms（`PICK_MATCH_MIN_DISPLAY_MS`）
- **AND** SHALL NOT 为性能优化缩短该最短展示

### Requirement: 索引与记忆生命周期

系统 MUST 在记忆内容变更后维护 embedding index 的最终一致性，且 index 更新 MUST NOT 阻塞记忆采集成功路径。

#### Scenario: 采集成功后异步更新索引

- **WHEN** 项目记忆 create/update/complete 成功
- **THEN** 系统 MAY 异步更新对应 memoryId 的 embedding 记录
- **AND** 即使 embed 失败，记忆写入结果 SHALL 仍为成功

#### Scenario: 删除记忆清理索引

- **WHEN** 用户或系统删除一条项目记忆
- **THEN** 系统 SHALL 删除或标记失效对应 embedding 记录
