## Context

当前实现状态（已存在能力）：

- 文件树与多 Tab：`useGitPanelController` + `FileViewPanel` 已支持打开/切换/关闭文件。
- 编辑器：`FileViewPanel` 使用 CodeMirror，具备语法高亮与基础编辑能力。
- 后端 LSP：Tauri 已有 `opencode_lsp_diagnostics` / `opencode_lsp_symbols` / `opencode_lsp_document_symbols`。
- 缺口：文件视图尚未接入 definition/references 语义查询，也没有“按行列定位打开文件”的统一入口。

因此，本设计重点是：在“现有文件系统+编辑器”上增量叠加语义导航能力，而非重做编辑器架构。

## Goals / Non-Goals

**Goals**

- 在文件编辑视图中建立符号级交互闭环：definition + references。
- 增加“打开文件并定位”链路，支持跨文件跳转。
- 保持现有文件多 Tab 与保存逻辑稳定。
- 在失败场景提供可解释回退。

**Non-Goals**

- 不实现重构工具链（rename/extract）。
- 不做完整 Language Client 重构。

## Decisions

### Decision 1：导航后端采用“OpenCode LSP 命令扩展”而非新增独立语言服务（采纳）

- 方案 A：新建独立 LSP client 进程与协议桥。
- 方案 B（采纳）：扩展现有 `opencode_lsp_*` 命令，新增 definition/references 查询。

取舍：方案 B 改动最小、复用现有工作区上下文与 CLI 能力，满足当前目标。

### Decision 2：前端以“位置请求协议”驱动导航（采纳）

统一请求载荷：`workspaceId + fileUri + line + character (+ includeDeclaration)`。

原因：

- 能同时支持 Ctrl/Cmd 点击与快捷键触发。
- 能统一 definition 与 references 调用入口。

### Decision 3：增加 `openFileAtLocation` 能力（采纳）

- 现状 `handleOpenFile(path)` 只能打开文件。
- 采纳：新增可选定位参数（line/column），用于跳转后自动聚焦。

结果：

- 若文件未打开：创建 Tab + 定位。
- 若文件已打开：激活 Tab + 定位。

### Decision 4：多目标跳转采用“候选列表确认”而非随机首项（采纳）

- 单目标：直接跳转。
- 多目标：弹出候选列表（路径+行号+片段），用户选择后跳转。

避免误跳，提升可控性。

### Decision 5：查找引用结果面板与导航解耦（采纳）

References 查询结果进入独立 panel/state：

- 可重复点击同一符号刷新结果。
- 不阻塞编辑器主线程交互。
- 可后续扩展过滤/分组（按文件、按符号类型）。

### Decision 6：错误与不可用场景显式降级（采纳）

- LSP 不可用：禁用交互并提示“当前语言/环境不支持”。
- 无定义/无引用：提示 empty state。
- 后端报错：toast + 状态栏错误，不中断编辑流程。

## Architecture

### 1) Editor Interaction Layer (Frontend)

在 `FileViewPanel` 增加导航交互层：

- 修饰键点击识别（mac: Meta, win/linux: Ctrl）。
- 从 CodeMirror 位置映射到 `line/character`。
- 触发 `getOpenCodeLspDefinition` / `getOpenCodeLspReferences`。

### 2) Navigation State Layer (Frontend)

新增导航状态容器（可放在 `FileViewPanel` 内，后续可抽 hook）：

- `navigationRequest`: loading/idle/error
- `definitionCandidates`: 跳转候选
- `referenceResults`: 引用列表
- `activeSymbolContext`: 当前查询符号上下文

### 3) File Open & Focus Layer (Frontend)

扩展现有文件打开 API：

- `handleOpenFile(path)` -> `handleOpenFile(path, location?)`
- location 包含 `line` / `column` / 可选 `selectionRange`

`FileViewPanel` 接收定位输入后：

- 设置光标位置
- 滚动到目标行
- 可选短暂高亮目标行（增强可见性）

### 4) LSP Command Adapter Layer (Tauri)

在 `commands.rs` 中新增：

- `opencode_lsp_definition`
- `opencode_lsp_references`

实现策略：

- 复用现有 `build_opencode_command` 与 `debug lsp` 调用方式。
- 统一 stdout JSON 解析与 stderr 错误处理。
- 返回结构标准化（至少包含 uri/range）。

### 5) Result Presentation Layer

- definition 多结果：轻量候选浮层。
- references：结果列表面板（文件分组 + 行文本预览）。

## Data Contract (Draft)

### Definition Request

- input:
    - `workspaceId: string`
    - `fileUri: string`
    - `line: number` (0-based)
    - `character: number` (0-based)

- output:
    - `result: Array<{ uri: string; range: { start: { line; character }; end: { line; character } } }>`

### References Request

- input:
    - `workspaceId: string`
    - `fileUri: string`
    - `line: number`
    - `character: number`
    - `includeDeclaration?: boolean`

- output:
    - `result: Array<{ uri: string; range: { start: { line; character }; end: { line; character } } }>`

## Risks / Trade-offs

- 风险：`opencode debug lsp` 子命令在不同版本可用性不一致。
    - 缓解：启动时做 capability 探测；不可用时 graceful fallback。

- 风险：每次点击触发外部命令，延迟可能偏高。
    - 缓解：加入短期缓存（fileUri+position）、请求去抖与并发取消。

- 风险：行列坐标转换错误导致定位偏移。
    - 缓解：统一 0-based/1-based 转换函数并单测覆盖。

- 风险：UI 交互复杂度上升。
    - 缓解：先实现最小闭环（definition/references），高级 UX（peek）后置。

## Rollout Plan

1. Backend 命令扩展与 contract 固化。
2. Frontend service wrapper 与类型定义接入。
3. `openFileAtLocation` 全链路接入。
4. Editor 交互（Ctrl/Cmd Click + Find References）上线。
5. Java 场景验收与回归测试。

## Open Questions

- OpenCode CLI 是否稳定支持 definition/references 子命令？参数格式是否统一？
- 引用结果面板放在右侧 files panel 还是 editor 内浮层更符合当前信息架构？
- 是否在第一期支持“peek definition”（不离开当前文件）还是先只做跳转？
