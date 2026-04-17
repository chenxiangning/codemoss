## Context

第一阶段 `workspace session activity panel` 已经明确只做“观测当前任务的操作事实”，并把 `live edit preview` 排除为默认行为。  
但在 `SOLO` 视图语境下，用户还有一个更强需求：不仅看到 file-change 事件，还能看到目标文件自动打开，并获得“正在编辑”的即时视觉反馈。

这个能力的难点不在“能不能打开文件”，而在**什么时候打开、打开到哪里、什么时候停止、如何避免抢占用户当前上下文**。

## Goals / Non-Goals

**Goals**

- 为 file-change 事件提供可控的自动预览机制
- 在不打断用户当前工作流的前提下增强“正在编辑”的感知
- 优先复用现有 editor / file view / diff view 打开链路
- 让该能力可开关、可预测、可回退

**Non-Goals**

- 不把预览行为绑死为所有用户、所有 workspace 的默认行为
- 不为了预览去重写 activity panel 或 session adapter
- 不追求逐字符级可视化回放；第一阶段只追求文件级“正在编辑”感知

## Decisions

### Decision 1: `live edit preview` 是 opt-in enhancement，不是默认行为

- 选择：该能力必须由用户显式开启，或通过 `SOLO` 内独立开关启用。
- 原因：自动抢占文件焦点具有明显副作用，不适合默认开启。

### Decision 2: preview target 优先复用现有 file view/editor opening pipeline

- 选择：自动预览优先通过既有文件打开链路完成，而不是新建专用预览容器。
- 原因：这样可以复用现有渲染、导航和语言支持能力，避免平行实现。

### Decision 3: 用户手动上下文优先于自动预览

- 选择：一旦用户主动切换到别的文件、diff 或视图，自动预览必须暂停，直到满足恢复条件。
- 原因：系统不能和用户抢焦点。

### Decision 4: 多文件连续修改必须节流

- 选择：预览协调器需要对高频 file-change 做节流/防抖，避免文件标签或右侧内容剧烈抖动。
- 原因：真实代理修改 often 是 bursty 的，如果逐条切文件，体验会非常糟。

### Decision 5: `SOLO` 是推荐承载场景，但不是唯一入口

- 选择：该能力应优先在 `SOLO` 中工作良好，但 capability 本身不依赖 `SOLO`。
- 原因：这样后续仍可在普通视图中按需要复用。

## Architecture

```text
fileChange events
  └─ Live Edit Preview Coordinator   ← 新增
        ├─ decide eligible target
        ├─ respect user focus lock
        ├─ throttle rapid file switches
        └─ call existing open-file / open-diff pipeline
                    │
                    ▼
          editor / file view / diff view
```

## Proposed Modules

- `src/features/live-edit-preview/hooks/useLiveEditPreview.ts`
  - 管理开关、节流、用户焦点保护
- `src/features/live-edit-preview/utils/previewTarget.ts`
  - 决定 file-change 应打开 editor、file view 还是 diff
- `src/features/live-edit-preview/utils/focusPolicy.ts`
  - 定义何时允许抢占、何时必须暂停

## Interaction Contract

### Enablement

- 默认关闭
- 用户可在 `SOLO` 视图中手动开启
- 若后续产品需要，也可扩展为 workspace 级偏好设置

### Preview lifecycle

1. 监听当前任务上下文中的 file-change events
2. 判断当前是否允许预览
3. 若允许，则选一个 preview target 并调用现有打开链路
4. 若用户手动切走，则进入暂停态
5. 暂停态下继续接收 file-change，但不自动抢回焦点

### Focus protection

- 用户手动打开其他文件后，系统必须暂停自动预览
- 用户关闭预览开关后，系统只保留 activity panel 跳转入口
- 自动预览不得导致无限标签切换或光标焦点来回跳动

## Risks / Trade-offs

- [Risk] 自动预览和用户手动操作互相抢焦点  
  → Mitigation: 引入明确 focus policy，用户行为优先

- [Risk] 高频文件变更导致界面抖动  
  → Mitigation: 节流、目标稳定策略、短时间窗口内冻结当前预览目标

- [Risk] 预览容器选择错误，用户看不到真正有价值的变更  
  → Mitigation: 先以现有 file view/editor 为主，复杂 diff 场景通过后续策略细化

## Validation

- 验证 1：开启预览后，file-change 发生时能自动打开目标文件
- 验证 2：用户手动切到其他文件后，系统不会立即抢回焦点
- 验证 3：连续多个 file-change 不会造成明显抖动
- 验证 4：关闭预览后，activity panel 仍可正常跳转到文件详情
