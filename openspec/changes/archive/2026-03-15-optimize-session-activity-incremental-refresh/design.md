## Context

当前 `workspace session activity` 已经把多 thread 事实源聚合成统一 timeline，但刷新策略仍然是：

1. 找到相关 thread 集
2. 对每个 thread 重新扫描 `ConversationItem[]`
3. 重新构建全部 events
4. 对合并后的 timeline 再排序、去重、重新分配时间戳

这套模型在功能上是正确的，但它本质上更接近“history replay selector”，而不是“realtime incremental timeline”。当 active task 进入高频工具调用或长时间 reasoning / explore / command 混合输出时，右侧面板会在每次轻微状态变化时重复处理大量历史节点。

同时，现有 capability spec 仍声明 Phase One 必须排除 `reasoning`，但产品实现和测试已经长期把 `reasoning` 作为独立分类展示。继续维持这种分裂，会导致性能优化完成后仍然无法通过规范一致性检查。

## Goals / Non-Goals

**Goals**

- 让 activity timeline 的实时刷新以增量构建为主，而不是每次全量重放全部 thread items。
- 在不改变 capability 边界的前提下，保留 turn group 折叠作为大 timeline 的默认扫描控制。
- 让 spec 与实现在 `reasoning` 的展示策略上达成一致。
- 保持现有事件摘要、跳转入口和历史事件可见性。

**Non-Goals**

- 不引入新的全局 store，不修改 `thread reducer` 数据模型。
- 不把 activity panel 改造成完整 console 或完整历史浏览器。
- 不重写 `ConversationItem` 事实生成链路。
- 本次不做列表虚拟化，除非增量构建后仍有明确瓶颈证据。

## Decisions

### Decision 1: 增量的最小单位是 thread，不是单 event

- 选择：在 `useWorkspaceSessionActivity` 里缓存每个 relevant thread 的归一化 events；当某个 thread 的 items/status 没变时，直接复用上次结果。
- 原因：当前事件构建函数已经天然以 thread 为输入边界。以 thread 为最小缓存单位，能在最小改动下避开“单 event diff engine”带来的复杂状态同步问题。
- 结果：实时刷新时，只有新增或变化的 thread 才会重跑 `buildThreadEvents`，其他 thread 直接复用缓存。

### Decision 2: adapter 继续负责事实归一化，hook 负责缓存与合并

- 选择：`buildWorkspaceSessionActivity` 拆分为“解析 relevant thread 集 / 单 thread events / 汇总结果”的纯函数组合；hook 负责基于 thread 输入签名决定哪些结果复用。
- 原因：这样能保留 adapter 的纯函数可测性，同时把缓存生命周期绑定到 React hook，避免把 memo 状态偷偷塞进纯函数层。

### Decision 3: session summary 计数不再反复扫描整条 timeline

- 选择：每个 thread 构建完成后即产出 `eventCount`，汇总阶段直接复用。
- 原因：当前 `sessionSummaries` 通过 `timeline.filter(...)` 逐 thread 重新计数，会在大 timeline 下产生额外 O(T * E) 扫描。

### Decision 4: turn group 折叠继续作为大 timeline 的默认扫描控制

- 选择：保留“最新 turn 默认展开、旧 turn 默认折叠”的策略，并将其写入 capability。
- 原因：数据层增量化解决的是“算得慢”，turn group 折叠解决的是“看得乱”。两者不是替代关系，而是需要同时存在。

### Decision 5: `reasoning` 采用受控展示，而不是 spec 级排除

- 选择：修改 capability，使 `reasoning` 可以作为独立分类展示，但不得污染 `command / task / fileChange / explore` 统计，也不得挤占默认扫描路径。
- 原因：这是当前真实产品行为。与其继续维持“规范排除 / 实现展示”的分裂，不如把它收敛成明确契约。

## Architecture

```text
relevant thread ids
      │
      ├─ unchanged thread ───────────────┐
      │                                  │ reuse cached thread events
      └─ changed thread ──> buildThreadEvents
                                         │
                              merge per-thread event lists
                                         │
                              stabilize event timestamps
                                         │
                            build timeline / summaries / counts
```

### Thread cache shape

```ts
type CachedThreadActivity = {
  threadId: string;
  signature: string;
  events: SessionActivityEvent[];
  eventCount: number;
  relationshipSource: SessionActivityRelationshipSource;
  sessionRole: "root" | "child";
  threadName: string;
  isProcessing: boolean;
};
```

### Signature strategy

thread 缓存签名使用稳定但低成本的只读输入组合：

- thread id
- thread name / updatedAt
- `itemsByThread[threadId]` 的长度
- 首尾 item 的 id / kind / status 摘要
- 当前 thread `isProcessing`
- 当前 `relationshipSource`

只要签名未变，就认为该 thread 的 activity 结果可复用。

这不是理论上的完美 diff，但它满足本场景：

- 新事件 append 时会命中签名变化
- 运行中命令 / reasoning 完成态切换时会命中签名变化
- 无关 thread 的实时心跳不会拖着整棵 root subtree 重算

## Validation

- adapter 测试需要覆盖：
  - thread 未变化时复用缓存
  - 单个 child thread 变化时只重建该 thread 的 events
  - session summary 计数不依赖整条 timeline 二次过滤
- panel 测试需要覆盖：
  - 最新 turn 默认展开
  - 旧 turn 默认折叠
  - reasoning 作为独立分类可见，但不污染其他 tab 统计
- 回归测试需要覆盖：
  - 运行中命令状态从 running 切换 completed/failed 不生成重复 event
  - workspace / active thread 切换时缓存不会串上下文
