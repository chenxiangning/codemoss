# conversation-tool-card-persistence Specification Delta

## MODIFIED Requirements

### Requirement: Shared File Identity Contract For File Changes

`File changes` file rows SHALL use the same file-path identity contract as existing edit-related file entry points and persisted file-export records.

#### Scenario: rewind preview merges tool changes by source path
- **WHEN** Claude rewind preview 收集多个 tool items 的文件改动
- **THEN** 系统 SHALL 以 `filePath` 作为同一文件的聚合主键
- **AND** 不得为 rewind review surface 引入新的 opaque file identity

#### Scenario: export manifest preserves the same source-path contract
- **WHEN** rewind review surface 导出受影响文件
- **THEN** `manifest.json` SHALL 记录每个文件的原始 `sourcePath`
- **AND** 前端 preview 与后端导出 SHALL 共享同一源路径语义
