# composer-manual-memory-reference Delta

## ADDED Requirements

### Requirement: 记忆参考三态（off / pick / always）

系统 MUST 在 Composer 提供记忆参考三态控制，对应关闭、本轮挑选、一直开启，且 MUST NOT 提供独立的「单次开启引用」选项。

#### Scenario: 菜单三项

- **WHEN** 用户打开 Composer 记忆参考菜单
- **THEN** 系统 SHALL 提供关闭、本轮挑选、一直开启
- **AND** SHALL NOT 提供「单次开启引用」

#### Scenario: 本轮挑选语义

- **WHEN** 用户选择本轮挑选
- **THEN** 系统 SHALL 在后续符合条件的发送中进入挑选闸门（有候选时）
- **AND** 默认勾选 SHALL 为空

#### Scenario: 一直开启语义

- **WHEN** 用户选择一直开启
- **THEN** 系统 SHALL 在本 session 内按 TopK 默认注入策略发送（见 memory-pick-gate / consumption）
- **AND** 文案 SHALL 表明 session 范围与默认 Top3（或配置的 K）

#### Scenario: 旧 single 值兼容

- **WHEN** 持久化配置读到历史 `single`
- **THEN** 系统 SHALL 将其视为 `pick`

### Requirement: Session 静音与 Composer 恢复

系统 MUST 允许用户在闸门内 dismiss 本 session 询问，并 MUST 允许从 Composer 或等价入口恢复询问。

#### Scenario: dismiss 后 Composer 可提示

- **WHEN** 本 session 已 dismissed
- **THEN** Composer 记忆参考区域 MAY 显示本 session 已静音
- **AND** 用户 SHALL 能恢复本 session 询问（cleared dismissed）而不必新开 session

## MODIFIED Requirements

### Requirement: Memory Reference 入口生命周期

系统 MUST 将历史「单次 / 一直」收敛为「本轮挑选 / 一直开启」，并与发送前挑选闸门语义一致；关闭表示不自动进入闸门（first-pick 强制除外）。

#### Scenario: 默认关闭

- **WHEN** 用户未配置记忆参考
- **THEN** 入口 SHALL 默认为关闭
- **AND** 新 session 在有记忆时仍 MAY 触发一次 first-pick 闸门

#### Scenario: 发送后 always 保持

- **WHEN** 记忆参考为一直开启
- **AND** 发送完成
- **THEN** 模式 SHALL 保持一直开启直到用户修改或 session dismiss

#### Scenario: @@ 不受三态删除影响

- **WHEN** 用户使用 `@@` 手动选记忆
- **THEN** 系统 SHALL 保持既有手动候选与 one-shot 注入语义
