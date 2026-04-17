# fix-chat-input-incremental-undo 验收记录

## 基本信息

- 变更：`fix-chat-input-incremental-undo`
- 记录日期：2026-03-19
- 记录人：Codex + 用户联合验收

## Win / mac 兼容性检查

### 代码与单测级检查（已完成）

- 快捷键归一化映射已实现并验证：
  - mac：`Cmd+Z` => undo，`Cmd+Shift+Z` => redo
  - windows：`Ctrl+Z` => undo，`Ctrl+Y` / `Ctrl+Shift+Z` => redo
- 焦点边界守卫已验证：
  - 仅在 `ChatInputBox` 聚焦且可编辑时拦截 undo/redo
  - 非输入框焦点不拦截
- 对应文件：
  - `src/features/composer/components/ChatInputBox/utils/undoRedoShortcut.ts`
  - `src/features/composer/components/ChatInputBox/hooks/useKeyboardHandler.ts`
  - `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`

### 手工回归（用户反馈）

- 用户反馈：“测试 ok 了好用”。
- 验收结论：无“单次撤销清空整段文本”回归，主流程可用。

> 注：Win/mac 映射结论来自代码路径 + 自动化测试覆盖；非双实机截图验收。

## 自动化测试结果

### 1) 兼容性相关测试

执行命令：

```bash
npx vitest run \
  src/features/composer/components/ChatInputBox/utils/undoRedoShortcut.test.ts \
  src/features/composer/components/ChatInputBox/hooks/useKeyboardHandler.test.tsx \
  src/features/composer/components/ChatInputBox/ChatInputBox.incrementalUndoRedo.smoke.test.tsx
```

结果：`3 files, 10 tests, 全通过`

### 2) 回归矩阵测试

执行命令：

```bash
npx vitest run \
  src/features/composer/components/ChatInputBox/ChatInputBox.incrementalUndoRedo.smoke.test.tsx \
  src/features/composer/components/ChatInputBox/hooks/useUndoRedoHistory.test.ts \
  src/features/composer/components/ChatInputBox/utils/undoRedoShortcut.test.ts \
  src/features/composer/components/ChatInputBox/hooks/useKeyboardHandler.test.tsx \
  src/features/composer/components/ChatInputBox/hooks/useNativeEventCapture.test.tsx \
  src/features/composer/components/ChatInputBox/utils/filePathReferences.test.ts \
  src/features/composer/components/ChatInputBox/utils/virtualCursorUtils.test.ts
```

结果：`7 files, 27 tests, 全通过`

### 3) 类型检查

执行命令：

```bash
npm run typecheck
```

结果：通过

## 最终结论

- 本变更 Win/mac 兼容性在当前代码与自动化覆盖范围内通过。
- 手工体验反馈为通过，可进入归档流程。
