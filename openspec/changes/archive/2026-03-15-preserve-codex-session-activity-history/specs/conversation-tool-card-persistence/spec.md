## ADDED Requirements

### Requirement: Codex Local Session Replay Preserves Tool Card Semantics

`Codex` 历史恢复若使用本地 session replay，MUST 继续保持 `commandExecution` 与 `fileChange` 工具卡片的实时语义。

#### Scenario: command execution tool survives codex local replay

- **WHEN** `Codex` 本地 session 历史包含命令调用与对应输出
- **THEN** 历史恢复后的 `commandExecution` 卡片 MUST 保留命令身份、状态与可读输出
- **AND** 右侧 activity panel MUST 复用同一命令事实而不是生成新的并行身份

#### Scenario: apply-patch style file edits survive codex local replay

- **WHEN** `Codex` 本地 session 历史包含 `apply_patch` 或等价补丁型文件修改记录
- **THEN** 历史恢复后的 `fileChange` 卡片 MUST 保留受影响文件路径与修改语义
- **AND** 右侧 activity panel MUST 能继续展示对应文件修改事实
