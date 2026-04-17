## Why

当前 `workspace session activity panel` 第一阶段聚焦“观测当前任务的实时操作事实”，已经明确不默认自动打开文件。  
但你提出的 `SOLO` 演示型体验还有一个更强需求：当 AI 正在修改文件时，用户不仅看到 file-change event，还能直接看到目标文件在右侧被打开，并获得“正在编辑”的实时感知。

这类能力不再只是 activity panel 的信息展示，而是会主动驱动 editor / file view / diff view 的展示与焦点策略。  
如果直接塞进第一阶段监控提案，会把“观测面板”和“编辑器编排”耦合在一起，增加焦点抢占、界面抖动和上下文打断风险。

因此需要单独开一个 follow-up proposal，把 `live edit preview` 作为第二阶段能力独立设计。

## Goals

- 在 file-change 发生时，为用户提供“目标文件已打开且正在被编辑”的可视反馈
- 优先与 `SOLO` 视图模式协同，但不强依赖第一阶段 activity panel 的实现细节
- 支持 opt-in 或显式开关，避免自动劫持用户当前上下文
- 明确编辑器焦点、预览容器、回退策略与抖动控制

## Non-Goals

- 不把 `live edit preview` 作为第一阶段 activity panel 的默认行为
- 不重做现有 editor / file view 的基础能力
- 不为了预览去改变 session activity adapter 的单一职责

## What Changes

- 新增 `live edit preview` capability，定义 file-change 驱动的 editor/file view 自动预览契约
- 定义 preview 的进入条件、退出条件、开关策略和焦点规则
- 定义与 `SOLO` / 普通视图 / activity panel 的协同关系
- 定义防抖、文件切换节流与用户手动上下文保护规则

## Design Principles

- `live edit preview` 是增强型观感能力，不得破坏用户导航自主权
- 自动打开文件必须是可关闭、可回退、可预测的
- 若用户已手动聚焦某个文件或视图，系统不得无条件抢占
- 预览能力应优先复用现有 editor/file view 打开链路，而不是另建平行容器

## Acceptance Direction

1. 当相关 session 产生 file-change event 时，系统 MAY 在满足策略条件下自动打开目标文件或 diff 预览。
2. 该能力 MUST 提供显式开关或等效 opt-in 控制。
3. 自动预览 MUST NOT 无限制频繁切换文件，导致明显抖动。
4. 用户手动退出预览或切换上下文后，系统 MUST 尊重用户当前选择，不得立即抢回焦点。
5. 该能力 SHOULD 与 `SOLO` 协同工作，但 MUST NOT 依赖 `SOLO` 才能存在。

## Open Questions

- 预览容器优先使用 editor、file view 还是 diff view
- 多文件连续修改时如何决定主预览目标
- 用户手动打开其他文件后，自动预览应暂停多久
- 预览是 workspace 级开关，还是仅在 `SOLO` 中启用
