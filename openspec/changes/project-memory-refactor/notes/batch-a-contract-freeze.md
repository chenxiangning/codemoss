# Batch A Contract Freeze

## Rust 过渡决策

- 当前阶段采用“单文件过渡”：
  - 继续使用 `src-tauri/src/project_memory.rs`
  - 先冻结 V2 DTO 和 typed payload
  - 模块拆分推迟到 Batch B 处理

## 旧字段 -> V2 字段对照

| 旧字段/模型 | V2 字段/模型 | 当前策略 |
|---|---|---|
| `ProjectMemoryItem` | `ProjectMemoryItemV2` / `ProjectMemoryDetailPayload` | Rust 侧先扩展原结构，加入 V2 字段，保持兼容读 |
| `summary` | 兼容读字段 | 保留，只读，不再作为 V2 真值 |
| `detail` | 兼容读字段 | 保留，只读，不再作为 V2 真值 |
| `cleanText` | 兼容读字段 / 索引字段 | 保留，只读，用于兼容搜索与旧消费面 |
| `rawText` | 兼容读字段 | 保留，只读 |
| `threadId + messageId` | `threadId + turnId + messageId` | 新增 `turnId`，其余保留 |
| 无 | `userInput` | 新增 canonical 字段 |
| 无 | `assistantThinkingSummary` | 新增 canonical 字段 |
| 无 | `assistantResponse` | 新增 canonical 字段 |
| 无 | `operationTrail[]` | 新增 canonical 字段 |
| `deletedAt + hardDelete` | `project_memory_delete(input)` | V2 主路径取消 `hardDelete`，删除统一为物理删除 |
| 列表直接返回完整 item | `MemoryListProjection` | 已切到 projection 读模型 |
| 详情直接返回旧 item | `ProjectMemoryDetailPayload` | 已切到 detail 读模型名称 |

## 操作记录字段冻结

`OperationTrailEntry` 固定为以下 7 字段：

1. `actionType`
2. `target`
3. `status`
4. `timestamp`
5. `briefResult`
6. `durationMs`
7. `errorCode`

## 命令载荷冻结

| 命令 | 旧载荷 | 新载荷 |
|---|---|---|
| `project_memory_list` | 扁平参数 | `{ input: ProjectMemoryListInput }` |
| `project_memory_get` | `memoryId, workspaceId` | `{ input: ProjectMemoryGetInput }` |
| `project_memory_update` | `memoryId, workspaceId, patch` | `{ input: ProjectMemoryUpdateCommandInput }` |
| `project_memory_delete` | `memoryId, workspaceId, hardDelete?` | `{ input: ProjectMemoryDeleteInput }` |
| `project_memory_create` | `{ input: CreateProjectMemoryInput }` | 保持 object payload，并补齐 V2 字段 |
| `project_memory_capture_auto` | `{ input: AutoCaptureInput }` | 保持 object payload，并补齐 V2 字段 |

## 兼容保留项

- 旧 JSON 文件不迁移。
- 旧 `summary/detail/cleanText/rawText/deletedAt` 继续保留读取兼容。
- 现有 UI/threads/composer 消费面本轮只改最小必要调用，不做大规模重构。
