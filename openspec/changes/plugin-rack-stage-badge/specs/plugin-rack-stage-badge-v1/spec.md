# plugin-rack-stage-badge-v1 Spec Delta

## ADDED Requirements

### Requirement: Host rack MUST show local staged without changing slot state

插排卡片 MUST 显示本地安装标记。Host `state` MUST 仍来自 snapshot，默认 idle。

#### Scenario: staged Notes still renders as idle

- **WHEN** 本地 stage `com.mossx.notes`
- **THEN** Features 组 MUST 显示已安装（本地标记）
- **AND** 同一卡片 MUST 仍显示空闲
