## Why

Claude rewind 确认弹层当前将所有受影响文件按大卡片纵向平铺，文件一多就会把主体空间挤满，用户既难以快速核对文件范围，也无法在确认前查看具体改动。与此同时，当前回溯流程缺少“导出本次受影响文件”的稳定落盘能力，导致用户在执行高风险回溯前无法把相关变更安全存档，也无法在同一 rewind 目标上重复导出并获得可预期的覆盖结果。

## 目标与边界

- 目标：
  - 重构 Claude rewind 确认弹层中的受影响文件区域，避免区域高度失控并提升可读性。
  - 支持用户点击受影响文件并查看该文件的紧凑 diff 预览与完整 diff。
  - 增加“存储变更”按钮，将相关文件与 manifest 保存到稳定的默认 chat diff 目录。
- 边界：
  - 仅覆盖 Claude rewind 确认弹层及其必要的数据/导出命令。
  - 本次确认弹层以内嵌 diff preview + full diff overlay 为主，不在该流程中直接拉起主 workspace diff 面板。
  - 不扩展到 git history、普通 tool card、session activity 之外的 UI 改造。
  - `conversationLabel` 仅作为导出 manifest 元数据，不参与目录命名。

## What Changes

- 将 Claude rewind 确认弹层的受影响文件区域改为紧凑可滚动文件 rail，并提供当前选中文件的紧凑 diff 预览区。
- rewind preview 数据模型按 `filePath` 聚合同一路径的多次 tool change，保留每个文件的 `diff` 内容，而不仅仅是 path/status/diff stats；当同一路径存在多个 diff 时，优先保留 churn 更高、信息量更完整的版本。
- 文件行支持单击切换预览；用户可在弹层内打开完整 diff overlay，对当前文件进行完整核对。
- 新增“存储变更”动作，将受影响文件写入 `~/.ccgui/chat-diff/{engine}/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/files/`，并同步生成 `manifest.json` 记录 `conversationLabel`、workspace root、源文件路径与存储路径。
- 导出支持 workspace 相对路径、绝对路径与 `file://` URI；workspace 外绝对路径统一落到 `files/external/...`。
- 对同一 `sessionId + targetMessageId` 重复执行“存储变更”时，新导出会覆盖旧快照，保证目录语义稳定且可重试。
- 新增前后端测试，覆盖 rewind 预览、diff 选择、完整 diff、导出目录结构、manifest、绝对路径/file URI 与同目标覆盖导出。

## 基于代码落地的补充修复（2026-04-14）

- 修复 `add/delete/modified` 在回溯恢复阶段的遗漏问题：当工具记录缺少 inline diff 时，系统仍可通过 kind 推断与 structured `old_string/new_string` 完成恢复，不再误跳过。
- 修复“删除文件但无 diff”场景：回溯计划若标记为 `delete` 且目标文件当前缺失，系统会按可恢复语义创建空文件（而非静默跳过）。
- 修复“modified 实际是 add-like 变更”场景：当 `old_string` 为空、`new_string` 非空时，按 `add` 语义回溯并删除新增文件，避免错误写回空内容。
- 修复 kind 合并偏差：`mergeToolChanges` 对 `modified` 与本地更具体 kind（`add/delete/rename`）冲突时优先使用具体 kind，减少误判。
- 增强 payload 解析：支持从简写状态文本 `(A)/(U)/(D) <path>` 推断文件变更，补齐无 patch 但有状态输出的回溯输入。
- 增强线程回溯流程健壮性：
  - 在执行 Claude rewind fork 前先进行工作区文件恢复；
  - fork 失败时自动回滚到原始快照；
  - 当回溯目标是首条 user message 时，直接删除当前 Claude 会话而不是创建无意义 fork。

## 非目标

- 不修改 Claude 真正执行 rewind 的后端会话裁剪语义。
- 不改造现有 GitDiffViewer 的通用布局或偏好逻辑。
- 不引入新的会话存储后端或云端同步能力。

## 技术方案对比

### 方案 A：继续保留单列文件卡片，仅压缩样式

- 做法：减小卡片 padding、高度与字体，仍然使用单列纵向文件列表。
- 优点：改动小，风险低。
- 缺点：文件数量一多仍会推高整体高度，且用户依旧无法在确认弹层内聚焦单个 diff。

### 方案 B：双区结构，左侧文件列表 + 右侧 diff 预览（推荐）

- 做法：文件列表改为紧凑目录，单击切换右侧 diff 预览，并在弹层内补充 full diff overlay；导出动作走独立 Tauri command。
- 优点：同时解决高度、核对效率与导出安全性问题，信息密度更合理，交互闭环留在 rewind 确认流程内部。
- 缺点：需要扩展 rewind preview 数据模型并补充后端导出/manifest 逻辑。

取舍：采用方案 B。

## Capabilities

### New Capabilities
- `claude-rewind-review-surface`: 定义 Claude rewind 确认弹层的文件核对、diff 预览与变更导出语义。

### Modified Capabilities
- `conversation-tool-card-persistence`: 复用既有 file-path 级文件身份契约，要求 rewind preview、导出 manifest 与既有文件变更入口保持相同的源路径语义，不引入新的 opaque file key。

## Impact

- Frontend
  - `src/features/composer/components/Composer.tsx`
  - `src/features/composer/components/ClaudeRewindConfirmDialog.tsx`
  - `src/features/operation-facts/operationFacts.ts`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/styles/composer.part1.css`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/utils/claudeRewindRestore.ts`
  - `src/utils/threadItemsFileChanges.ts`
- Backend
  - `src-tauri/src/workspaces/commands.rs`
  - `src-tauri/src/command_registry.rs`
  - `src-tauri/src/app_paths.rs`（复用 `.ccgui` 根目录能力）
- Tests
  - `src/features/composer/components/Composer.rewind-confirm.test.tsx`
  - `src/services/tauri.test.ts`
  - `src/features/threads/hooks/useThreadActions.test.tsx`
  - `src/features/threads/utils/claudeRewindRestore.test.ts`
  - `src/utils/threadItemsFileChanges.test.ts`
  - 新增/扩展 Rust 导出命令测试

## 验收标准

- 当受影响文件较多时，Claude rewind 确认弹层中的文件区域不得继续线性撑高主体内容；文件区域必须独立滚动。
- 用户点击任意受影响文件后，弹层内必须显示该文件的 diff 预览；若 diff 不可用，需显示可恢复空态。
- 用户可以在该弹层内打开当前文件的完整 diff overlay，并继续返回确认流程。
- 点击“存储变更”后，系统必须把相关文件写入 `~/.ccgui/chat-diff/{engine}/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/files/`，并生成同级 `manifest.json`。
- `conversationLabel`、workspace root、源文件路径与存储路径必须写入 manifest；其中 `conversationLabel` 不要求体现在目录中。
- 对同一 rewind target 重复导出时，导出目录必须保持稳定且覆盖旧快照。
- 导出失败时，rewind 确认流程必须保持可用，且用户能看到可恢复错误信息。
- 当工具条目缺少 inline diff 但存在可判定 kind 或 structured `old_string/new_string` 时，回溯恢复必须仍然可执行且行为可预测。
- 当回溯目标是首条 user message 时，系统必须删除当前 Claude 会话并保持线程状态一致，不得产生空 fork 线程。
- 当 fork 流程失败时，系统必须自动恢复工作区文件到回溯前快照，避免半应用状态残留。
