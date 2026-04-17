# conversation-tool-card-persistence Specification Delta

## MODIFIED Requirements

### Requirement: Shared File Identity Contract For File Changes

`File changes` file rows SHALL use the same file-path identity contract as existing edit-related file entry points, rewind review surfaces, and persisted file-export records.

#### Scenario: claude rewind preview merges tool changes by source path
- **WHEN** Claude rewind preview 收集多个 tool items 的文件改动
- **THEN** 系统 SHALL 以 `filePath` 作为同一文件的聚合主键
- **AND** 不得为 Claude rewind review surface 引入新的 opaque file identity

#### Scenario: codex rewind preview merges tool changes by source path
- **WHEN** Codex rewind preview 收集多个 tool items 或本地 replay 文件改动
- **THEN** 系统 SHALL 以 `filePath` 作为同一文件的聚合主键
- **AND** 不得为 Codex rewind review surface 引入新的 opaque file identity

#### Scenario: rewind export manifest preserves the same source-path contract
- **WHEN** rewind review surface 导出受影响文件
- **THEN** `manifest.json` SHALL 记录每个文件的原始 `sourcePath`
- **AND** 前端 preview 与后端导出 SHALL 共享同一源路径语义

#### Scenario: codex local replay remains aligned with rewind file identity
- **WHEN** Codex 本地 session replay 恢复 `fileChange` 工具卡片并且同一会话支持 rewind review surface
- **THEN** replay 后的文件路径语义 SHALL 与 rewind preview / export manifest 保持一致
- **AND** 系统 MUST NOT 为同一源文件生成额外并行身份
