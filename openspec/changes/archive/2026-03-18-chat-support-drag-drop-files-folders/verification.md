# Verification - chat-support-drag-drop-files-folders

Date: 2026-03-18

## 1. 功能验收结论

- 内部文件树拖拽 -> Composer：通过（文件/文件夹可插入）。
- 外部文件系统拖拽 -> Composer：通过（文件/文件夹可插入）。
- 单击/双击语义：通过（单击选中，双击打开文件或展开文件夹）。
- 多选拖拽：通过（`⌘/Ctrl + Click`、`Shift + Click` 组合可批量插入）。
- 拖拽遮罩：通过（内部/外部拖拽均可显示，连续拖拽可复现）。

## 2. 兼容性检查（Win/mac）

- Windows 兼容点：
  - 盘符大小写无关去重（`C:\` 与 `c:/` 视为同一路径）。
  - 反斜杠与斜杠归一化比较。
- macOS 兼容点：
  - Finder 常见 `file://` 文本路径可解析并保留空格路径。
  - 外部拖拽路径可正常进入引用插入链路。

## 3. 执行命令与结果

- `pnpm vitest run src/features/composer/components/ChatInputBox/hooks/usePasteAndDrop.test.ts src/features/files/components/FileTreePanel.run.test.tsx src/features/composer/components/ChatInputBox/utils/pathValidation.test.ts src/features/composer/components/ChatInputBox/utils/filePathReferences.test.ts`
  - 结果：通过
- `pnpm tsc --noEmit`
  - 结果：通过
- `pnpm test`
  - 结果：通过（batched suite）

## 4. 关键回归点

- 修复内部拖拽 race：避免 Composer 捕获阶段 `dragend` 抢先清理 bridge。
- 保持 `+` 按钮与拖拽插入共用同源逻辑，避免行为漂移。
- 保持拖拽边界在 Composer 内，不向其他 UI 区域扩散。
