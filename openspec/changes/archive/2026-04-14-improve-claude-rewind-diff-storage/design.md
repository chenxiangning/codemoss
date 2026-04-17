## 背景

本次变更只处理 Claude rewind 确认弹层的“核对面”。问题不在 rewind 执行本身，而在执行前的审查体验过于粗糙：

1. 文件列表使用纵向大卡片，文件多时占满弹层高度。
2. 列表只有汇总 stats，没有单文件 diff 焦点区。
3. 回溯前缺少“先把相关文件存到默认全局目录”的安全动作。

## 设计目标

- 在不改变现有 rewind 业务语义的前提下，提升确认前的审查效率。
- 让“先看 diff，再决定是否回溯”成为顺畅流程。
- 提供低成本、可追踪、默认可用、可重复覆盖的文件导出能力。

## 方案概览

```
┌──────────────── Claude Rewind Confirm ────────────────┐
│ target / impact summary                               │
├───────────────────────────────────────────────────────┤
│ files rail                    │ diff preview          │
│ - file A                      │ header                │
│ - file B                      │ unified diff          │
│ - file C                      │ empty / truncated tip │
│   scroll independently        │                       │
├───────────────────────────────────────────────────────┤
│ store changes  cancel  confirm rewind                │
└───────────────────────────────────────────────────────┘
```

### 核心决策

1. 文件区域改为双区结构，而不是继续压缩单列卡片。
2. rewind preview 阶段即保留 `diff`，避免进入弹层后再二次推导。
3. diff 查看分两层：
   - 弹层内右侧 compact preview：用于快速核对。
   - 弹层内 full diff overlay：用于查看完整上下文。
4. 导出能力落到 Tauri command，前端只负责传递 metadata 和展示结果。
5. 对同一 rewind target 的导出目录保持稳定，重复导出时整体替换旧快照。

## 前端设计

### 1. Rewind preview 数据模型

当前 `ClaudeRewindPreviewState` 由 `Composer` 基于“最近一条可 rewind 的 user message”构建：

- `targetMessageId`：回溯锚点，来自最近一条有效 user message 的 id
- `preview`：用户消息摘要，最长 72 个字符
- `engine/sessionId`：从 `activeThreadId` 解析，例如 `claude:session-1`
- `conversationLabel`：默认使用该 user message 的截断 preview

`affectedFiles` 不是简单透传 tool changes，而是由 `extractFileChangeSummaries()` 聚合得到。

新模型需要增加：

- `diff?: string`
- `sessionId: string | null`
- `engine: "claude" | "codex" | "gemini"`
- `conversationLabel: string`

其中：

- `diff` 从受影响 tool items 的 `changes[].diff` 聚合得到。
- 同一路径的多次变更会按 `filePath` 合并，stats 累加。
- 若同一路径存在多个 diff，优先保留 churn 更高或内容更长的版本，提升 preview 的信息完整度。
- `sessionId/engine` 由 `Composer` 的 `activeThreadId` 派生。
- `conversationLabel` 直接保留原始截断文案，供 manifest 记录；目录 sanitize 由后端仅针对真正用于目录的字段执行。

### 2. 弹层状态

`ClaudeRewindConfirmDialog` 新增内部状态：

- `selectedFilePath`
- `isFullDiffOpen`
- `isExporting`
- `exportResult`
- `exportError`

默认选中第一条文件；当 preview 更新时重置选中项。

### 3. UI 结构

- 保留 target / impact summary 区。
- 原文件列表区域替换为：
  - 左侧 `claude-rewind-modal-file-rail`
  - 右侧 `claude-rewind-modal-diff-panel`

左侧文件 rail：

- 每项只展示状态徽标、文件名、精简路径、stats。
- 支持选中态与 hover。
- 内容独立滚动，限制最大高度。

右侧 diff panel：

- 显示当前文件名、完整路径、stats、操作按钮。
- 使用现有 `parseDiff` / `DiffBlock` 轻量渲染逻辑，不引入新的重型 viewer。
- compact preview 只渲染改动行及其前后 1 行 context；连续省略区间用 `…` 占位。
- 没有 diff 时显示空态说明。

full diff overlay：

- 仍留在 confirm dialog 流程内，不切换主工作区布局。
- 如果 `parseDiff()` 可结构化解析，则展示完整 unified diff。
- 否则回退为原始 `<pre>` 文本，保证 diff 总能被查看。

### 4. 交互

- 单击文件项：切换右侧 preview。
- “查看完整 diff”：打开当前文件 full diff overlay。
- “存储变更”：调用新 Tauri command，将文件复制到默认目录。
- 如果导出成功，展示输出目录；失败则展示错误但不禁用确认回溯按钮。
- 无有效 Claude sessionId 时，不展示 rewind 入口，避免生成不可导出的 preview。

## 后端设计

### 1. 新增命令

在 `src-tauri/src/workspaces/commands.rs` 新增：

- `export_rewind_files(...) -> Result<{ outputPath, filesPath, manifestPath, exportId, fileCount }, String>`

输入建议：

- `workspaceId`
- `engine`
- `sessionId`
- `targetMessageId`
- `conversationLabel`
- `files: [{ path: string }]`

### 2. 目录规则

目标目录：

`~/.ccgui/chat-diff/{engine}/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/`

说明：

- 复用 `app_paths::app_home_dir()`
- `engine` 只允许 `claude/codex/gemini`
- `YYYY-MM-DD` 使用导出发生时的本地日期生成，作为单独目录层级
- `sessionId` 与 `targetMessageId` 做 sanitize 后作为目录层级
- 导出目录下固定包含 `files/` 与 `manifest.json`
- `conversationLabel` 不参与目录命名，仅写入 manifest

### 3. 路径解析

对每个文件：

- 若是绝对路径：直接使用
- 若是 `file://` URI：先解析为本地绝对路径
- 若是相对路径：基于 workspace root 解析
- 拒绝解析到 workspace 外部的非法相对路径逃逸
- 若源文件不存在：立即返回错误
- 若绝对路径不在 workspace 内，则导出到 `files/external/...`

### 4. 写入策略

- 先创建目标目录树；若同一目标目录已存在，则整体删除后重建
- 按相对目录结构复制文件，尽量保留原路径层级
- 每次导出写入 `manifest.json`，记录：
  - `engine`
  - `sessionId`
  - `targetMessageId`
  - `exportId`
  - `conversationLabel`
  - `workspaceRoot`
  - `filesDir`
  - `fileCount`
  - `files[].sourcePath / storedPath`
- 所有文件成功则返回输出目录、files 目录、manifest 路径
- 任一失败则返回错误

## 测试策略

### 前端

- 打开 rewind 弹层时默认选中第一条文件。
- 点击第二条文件时右侧 preview 切换。
- 点击“查看完整 diff”会打开 full diff overlay。
- 点击“存储变更”时调用导出 service，并显示成功/失败状态。

### 后端

- 目录结构正确：`~/.ccgui/chat-diff/{engine}/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/`
- 相对路径按 workspace root 解析
- `file://` URI 与绝对路径可导出
- workspace 外绝对路径落到 `files/external/...`
- manifest 内容正确
- 同一 rewind target 二次导出会覆盖旧快照
- 非法路径或缺失文件返回错误
- 多文件复制保持层级

## 风险与缓解

### 风险 1：某些 affected file 没有 diff

- 缓解：右侧 panel 显示“无可用 diff 预览”，不阻断主流程。

### 风险 2：sessionId / targetMessageId 等目录段包含非法字符

- 缓解：后端统一 sanitize 真正参与目录命名的字段；`conversationLabel` 仅写入 manifest。

### 风险 3：文件过多导致弹层 diff 预览卡顿

- 缓解：只渲染当前选中文件，不一次性展开所有 diff。

### 风险 4：同一路径被多次改动，preview 选到信息不完整的 diff

- 缓解：聚合时优先保留 churn 更高或更长的 diff 文本，避免 preview 退化到信息更少的片段。

## 回滚方案

- 前端回滚：
  - 回退 `Composer.tsx`
  - 回退 `ClaudeRewindConfirmDialog.tsx`
  - 回退 `operationFacts.ts`
  - 回退 `composer.part1.css`
- 后端回滚：
  - 删除新增导出 command 与注册项
- 因为无存储 schema 迁移，本次变更可直接代码回退。
