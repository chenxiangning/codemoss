# codex-chat-canvas-live-edit-preview Specification

ADDED by change: add-live-edit-preview

## Purpose

为 `SOLO` 或普通 chat canvas 提供可选的 file-change 自动预览能力，让用户在 AI 修改文件时获得“目标文件已打开且正在编辑”的实时视觉反馈，同时不破坏用户当前导航自主权。

## ADDED Requirements

### Requirement: Live Edit Preview Is Explicitly Opt-In

系统 MUST 将 live edit preview 设计为显式 opt-in 能力，而不是默认开启。

#### Scenario: preview stays off until user enables it

- **WHEN** 用户尚未开启 live edit preview
- **THEN** file-change event MUST 仅通过 activity panel 或现有跳转入口可见
- **AND** 系统 MUST NOT 自动打开文件或 diff 视图

#### Scenario: preview can be enabled inside solo

- **WHEN** 用户处于 `SOLO` 视图并显式开启 live edit preview
- **THEN** 系统 MAY 开始对符合条件的 file-change 自动触发预览
- **AND** 该开启状态 MUST 对用户可感知

### Requirement: Preview Reuses Existing Open-File Surfaces

自动预览 MUST 优先复用现有 editor / file view / diff 打开链路，而不是创建平行预览容器。

#### Scenario: preview routes through existing file opening pipeline

- **WHEN** 系统为某条 file-change 选择预览目标
- **THEN** 系统 MUST 调用现有文件或 diff 打开链路
- **AND** MUST NOT 引入仅供 live preview 使用的平行文件渲染面板

### Requirement: User Navigation Has Priority Over Preview

用户手动导航行为 MUST 高于自动预览行为。

#### Scenario: manual file switch pauses preview takeover

- **WHEN** live edit preview 已开启
- **AND** 用户手动切换到其他文件、diff 或视图
- **THEN** 系统 MUST 暂停自动抢占焦点
- **AND** 后续 file-change MUST NOT 立即把界面抢回

#### Scenario: disabling preview fully stops automatic opening

- **WHEN** 用户关闭 live edit preview
- **THEN** 系统 MUST 停止自动打开文件或 diff
- **AND** file-change 仍 SHOULD 通过 activity panel 保留手动跳转入口

### Requirement: Preview Switching Must Be Throttled

面对高频 file-change，系统 MUST 采用节流或等效策略，避免界面明显抖动。

#### Scenario: bursty file changes do not cause rapid surface thrash

- **WHEN** 相关 session 在短时间内连续修改多个文件
- **THEN** 系统 MUST 对自动预览切换应用节流、防抖或目标稳定策略
- **AND** 用户不应看到高频来回切换导致的严重视觉抖动

### Requirement: SOLO Integration Remains Optional

live edit preview SHOULD 与 `SOLO` 协同工作，但 MUST NOT 依赖 `SOLO` 作为唯一承载前提。

#### Scenario: capability is not hard-coupled to solo container

- **WHEN** 产品未来希望在非 `SOLO` 视图中复用 live edit preview
- **THEN** capability 的核心策略和协调逻辑 MUST 可独立存在
- **AND** 不得把核心能力硬编码进 `SOLO` 专属容器
