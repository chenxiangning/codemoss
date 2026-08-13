# memory-pick-gate Specification

## Purpose

定义发送前 **Memory Pick Gate（记忆挑选闸门）** 的行为合同：时序、模式、检索注入、session dismiss、Native/Shared 对齐与失败降级。UI 细节见 change 内 `ux.md`。

## ADDED Requirements

### Requirement: 发送前闸门时序

系统 MUST 在需要用户确认记忆注入时，于调用模型之前完成挑选流程，且 MUST 先上屏用户气泡再展示闸门。

#### Scenario: 有候选时进入闸门

- **WHEN** 用户主动发送消息且策略要求进入闸门
- **AND** 本地检索返回至少一条候选
- **THEN** 系统 SHALL 先将用户消息以待发送态展示在时间线
- **AND** SHALL 在该用户气泡下方展示挑选流
- **AND** SHALL NOT 在确认前调用模型发送接口

#### Scenario: 禁止伪 Assistant 压在待发送之上

- **WHEN** 当前 turn 处于待发送 + 挑选中
- **THEN** 系统 SHALL NOT 在该用户气泡上方插入本轮语义的 Assistant 回复气泡
- **AND** 挑选流角色标签 SHALL 标识为记忆参考/发送前检索，而非 Assistant 正文

#### Scenario: 确认后才出现模型回复

- **WHEN** 用户确认或跳过挑选并完成真实发送
- **AND** 模型开始产出
- **THEN** 系统 SHALL 才展示真正的 Assistant 流式/完成内容

### Requirement: 模式 pick / always / dismissed

系统 MUST 支持本轮挑选、session 一直开启（TopK）与 session 关闭询问三种语义，且 MUST NOT 提供与本轮挑选重叠的「单次开启」模式。

#### Scenario: 本轮挑选默认全不选

- **WHEN** 闸门以 pick 模式展示候选
- **THEN** 所有候选 SHALL 默认未勾选
- **AND** 用户确认时注入集合 SHALL 等于当前勾选集合（可为空）

#### Scenario: 一直开启 top(n) 预览（可改）

- **WHEN** session 记忆参考模式为 always
- **AND** 非 first-pick 强制手勾路径
- **AND** 本地检索返回至少一条候选
- **THEN** 系统 SHALL 展示挑选流（matching 后进入预览）
- **AND** SHALL 按相关分预勾 n 条（n 默认 3，或为 session 内上次确认的 preferred count）
- **AND** 用户 SHALL 能自由增减勾选（SHALL NOT 锁定勾选）
- **AND** 当闸门进入 awaiting 时 mode 已是 always 时，MAY 在配置的倒计时（默认约 8s）后自动确认，并在 UI 展示实时读秒
- **AND** 用户 SHALL 能取消自动确认并手动确认或跳过
- **AND** 用户确认时系统 SHALL 记住本次勾选条数供下轮预勾
- **AND** SHALL NOT 在无预览 UI 的情况下静默注入

#### Scenario: 中途切换 always 不启动读秒

- **WHEN** 闸门以 pick 进入 awaiting-choice
- **AND** 用户在闸门内切换到 always
- **THEN** 系统 SHALL 应用 always 预勾/策略 UI
- **AND** SHALL NOT 仅因该次切换启动自动确认倒计时

#### Scenario: 用户操作打断读秒且本轮不重启

- **WHEN** always 读秒进行中
- **AND** 用户进行勾选、打开详情、取消自动确认、切换策略、skip/dismiss 等交互
- **THEN** 系统 SHALL 立即取消读秒
- **AND** SHALL NOT 在本轮闸门展示期内再次自动启动读秒

#### Scenario: dismiss 关闭本 session 询问

- **WHEN** 用户选择「本 session 不再提示 · 关闭记忆参考」
- **THEN** 系统 SHALL 将本 session 标记为 dismissed
- **AND** 本轮 SHALL 以 0 条记忆注入发送
- **AND** 本 session 内后续发送 SHALL NOT 再展示挑选闸门
- **AND** 新 session SHALL 清除 dismissed（可再 first-pick）

#### Scenario: 无单次模式

- **WHEN** 用户打开 Composer 记忆参考菜单
- **THEN** 系统 SHALL NOT 提供「单次开启引用」选项
- **AND** 原 single 语义 SHALL 由「本轮挑选」承载

### Requirement: 记忆参考 opt-in（默认关闭）

系统 MUST 将记忆挑选闸门视为 opt-in：Composer 记忆参考模式为 `off` 时，发送 SHALL NOT 进入挑选闸门。

#### Scenario: 默认 off 不弹闸门

- **GIVEN** Composer 记忆参考模式为 off（默认）
- **WHEN** 用户主动发送
- **THEN** 系统 SHALL NOT 展示挑选闸门
- **AND** SHALL 以 0 条记忆注入继续发送（`@@` 手动关联仍可用）

#### Scenario: 开启 pick/always 后才进闸门

- **GIVEN** 用户在 Composer 工具菜单中选择「本轮挑选」或「整轮自动 top(n)」
- **WHEN** 用户主动发送且有可检索文本
- **THEN** 系统 SHALL 按对应模式进入挑选闸门

#### Scenario: 已开启模式下的 first-pick

- **GIVEN** Composer 模式为 pick 或 always
- **AND** 新 thread/session 且 workspace 记忆条数 ≥ 1
- **AND** 用户尚未完成 first-pick
- **WHEN** 用户首次主动发送
- **THEN** 系统 SHALL 展示 pick 手勾闸门
- **AND** 完成后 SHALL 清除 first-pick 要求

#### Scenario: 无记忆不强制 first-pick 空闸门

- **GIVEN** workspace 无项目记忆
- **AND** Composer 模式为 pick 或 always
- **WHEN** 用户发送
- **THEN** 系统 SHALL NOT 因 first-pick 单独展示空闸门（可按检索空结果路径降级）

### Requirement: 检索与失败降级

系统 MUST 在闸门路径使用当前 workspace 本地检索，并在空结果、超时或失败时不阻塞发送。

#### Scenario: 空候选直发

- **WHEN** 检索完成且候选数为 0
- **THEN** 系统 SHALL NOT 展示挑选闸门
- **AND** SHALL 以 0 注入继续发送用户原文

#### Scenario: 超时直发

- **WHEN** 检索超过实现配置的超时（默认约 1s）
- **THEN** 系统 SHALL 以 0 注入继续发送
- **AND** MAY 提示检索超时

### Requirement: 注入来源 memory-pick

系统 MUST 将闸门确认的记忆以可审计来源注入，并与手动选择去重。

#### Scenario: pick 注入标记

- **WHEN** 用户确认勾选 k 条记忆（k≥1）
- **THEN** 注入块 source SHALL 为 `memory-pick`
- **AND** count SHALL 为 k
- **AND** 用户可见气泡 SHALL 仅含用户原文

#### Scenario: 与 @@ 去重

- **WHEN** 同一 memory id 同时存在于手动选择与 pick 勾选
- **THEN** 系统 SHALL 只注入一条该记忆
- **AND** 展示来源优先 manual-selection

### Requirement: Native 与 Shared 对齐

系统 MUST 在 Native 与 Shared 发送路径使用同一闸门时序，且 Shared 不得因 committed 早退丢失注入组装。

#### Scenario: Shared V2 注入在 commit 前

- **WHEN** Shared V2 发送路径需要记忆注入
- **THEN** 系统 SHALL 在 V2 committed 返回之前完成 inject 文本组装
- **AND** 闸门确认语义 SHALL 与 Native 一致

### Requirement: 闸门 UI 信息架构

系统 MUST 提供列表优先、策略轨在侧的挑选 UI，并支持详情查看与策略说明。

#### Scenario: 单行候选与详情

- **WHEN** 闸门展示候选列表
- **THEN** 每行 SHALL 至少包含选择控件、标题、相关分与详情入口
- **AND** 列表行 SHALL NOT 展开多行摘要正文
- **AND** 详情 SHALL 以 Dialog 或等价模态展示全文

#### Scenario: 策略说明随模式切换

- **WHEN** 用户在闸门内切换本轮挑选与一直开启
- **THEN** 系统 SHALL 更新策略说明文案
- **AND** SHALL 同步列表预勾语义（pick 清空勾选；always 按 preferred count 预勾）
- **AND** SHALL 同步 Composer 记忆参考菜单勾选（若当前会话活跃）

#### Scenario: 底栏操作齐全

- **WHEN** 闸门处于 awaiting-choice
- **THEN** 系统 SHALL 提供确认并发送、不选直接发送、本 session 关闭记忆参考
- **AND** 右侧策略菜单 SHALL NOT 单独提供关闭项（关闭由底栏 dismiss 承担）
