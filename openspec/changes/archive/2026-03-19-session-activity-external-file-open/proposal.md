## Why

`Session Activity` 中 `Read` 事件当前可以生成文件跳转卡片，但对“非 workspace 且非 external spec root”的绝对路径会降级为 `Invalid file path`。这导致同样是项目外文件，用户在活动面板里的可打开行为不一致，影响可预期性与排障效率。

## What Changes

- 为活动面板文件跳转引入显式路径域路由（workspace / external-spec / external-absolute / invalid）。
- 在文件查看读取链路中新增 `external-absolute` 可读通道，仅用于受控只读打开项目外绝对路径文件。
- 保持现有 workspace 与 external-spec 读取行为不变，避免回归既有打开链路。
- 为 `Session Activity -> FileViewPanel` 补充回归测试，覆盖“同时存在可打开 external-spec 与可打开 external-absolute”的场景。

## 目标与边界

### 目标

- 统一 `Session Activity` 文件跳转行为，使“可读的项目外绝对路径”可稳定打开。
- 保留现有路径安全边界，避免把任意无效路径误判为可读。
- 在不破坏当前 `workspace` / `external-spec` 体验的前提下最小改动落地。

### 边界

- 本次仅覆盖“从 Session Activity 跳转到文件查看”的读取链路。
- 本次默认仅保证外部绝对路径的读取能力；写入能力不在默认范围。
- 不改动 Spec Hub 的 provider 检测与 external spec root 配置模型。

## 非目标

- 不实现“任意外部目录文件树浏览”能力。
- 不引入跨会话全局最近文件索引。
- 不改造 Git/FileTree 主面板的路径权限模型。

## 技术方案对比

### 方案 A：在 FileViewPanel 增加临时 `if` 分支（Hotfix）

- 优点：改动少、见效快。
- 缺点：路径域语义继续散落在 UI 分支；后续维护成本高，易出现条件分叉冲突。

### 方案 B：扩展统一路径域模型并由读写层分发（推荐）

- 优点：路径行为可解释、可测试、可复用；可避免“同为项目外路径却行为不一致”。
- 缺点：需要同步调整类型与测试，改动面略大于 Hotfix。

### 取舍结论

采用 **方案 B**。该问题属于长期稳定性与一致性问题，需在路径域模型层修复，而非继续叠加 UI 条件分支。

## Capabilities

### New Capabilities

- `session-activity-external-file-open`: 支持 Session Activity 对受控项目外绝对路径文件进行稳定只读打开。

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`: 扩展 `File change` 跳转的路径域契约，新增 external-absolute 路由并保持既有域不回归。

## 验收标准

- 当 `Read` 事件目标路径位于 `workspacePath` 内时，仍走 workspace 读取链路并成功打开。
- 当目标路径位于 active external spec root 内时，仍走 external-spec 链路并成功打开。
- 当目标路径是可访问的项目外绝对路径（例如 `~/.codex/skills/**/SKILL.md`）时，可在 FileViewPanel 打开且不再出现 `Invalid file path`。
- 当目标路径无效、不可访问或命中禁止边界时，系统返回可恢复错误，不扩大读写权限。
- 相关前端单测与路径域判定测试通过。

## Impact

- Affected frontend:
  - `src/utils/workspacePaths.ts`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`（如需补充跳转提示）
  - 相关测试文件
- Affected backend:
  - Tauri 文件读取命令（如需新增 external absolute read command）
- Breaking changes:
  - 无 API breaking change，属于行为增强与路由一致性修复。
