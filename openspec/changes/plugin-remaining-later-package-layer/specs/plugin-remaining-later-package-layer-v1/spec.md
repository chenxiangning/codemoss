# plugin-remaining-later-package-layer-v1 Spec Delta

## ADDED Requirements

### Requirement: remaining later-plugin modules MUST have in-repo package layers without entering the Host rack

每个 inventory later-plugin MUST 有过渡仓。本地目录 MUST 列出它们且 `installed=false`。Host 插排 MUST 仍只有已声明的 12 个插头。

#### Scenario: later-plugin packages appear in the local catalog only

- **WHEN** 读取本地目录
- **THEN** 目录 MUST 包含尚未上插排的 later-plugin 过渡仓
- **AND** Host 快照 MUST 仍只有原 12 个 idle 插头
