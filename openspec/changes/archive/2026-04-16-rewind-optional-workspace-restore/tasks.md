## 1. Dialog Toggle UI (P0)

- [x] 1.1 在 `ClaudeRewindConfirmDialog` 增加 `restoreWorkspaceFiles` 开关 UI（依赖: proposal/specs；输入: 现有弹层组件；输出: 默认开启的可切换控件；验证: 组件测试可读到默认开启状态）
- [x] 1.2 扩展弹层 props 以支持开关状态和变更回调（依赖: 1.1；输入: dialog props 类型；输出: `restoreWorkspaceFiles` 与 `onRestoreWorkspaceFilesChange`；验证: TypeScript 编译通过）
- [x] 1.3 补充 i18n 文案键（开关标签/说明）（依赖: 1.1；输入: 现有 rewind 文案命名空间；输出: 中英文文案可渲染；验证: UI 不出现 missing key）

## 2. Composer State And Callback Plumbing (P0)

- [x] 2.1 在 `Composer` 中新增 rewind 开关状态，弹层打开时重置为 `true`（依赖: 1.x；输入: 当前 rewindPreviewState 生命周期；输出: 每次打开默认开启；验证: 交互测试覆盖 reopen reset）
- [x] 2.2 扩展 `onConfirm` 调用链，透传 `restoreWorkspaceFiles` 参数（依赖: 2.1；输入: `handleConfirmRewind` 与 `onRewind` 调用点；输出: 可选参数透传；验证: 单测断言 onRewind 收到正确参数）
- [x] 2.3 保持兼容：未传参数时默认按开启处理（依赖: 2.2；输入: 历史调用路径；输出: 向后兼容默认行为；验证: 既有 rewind 测试不回退）

## 3. Claude/Codex Rewind Execution Branching (P0)

- [x] 3.1 在 Claude rewind 分支按参数控制 `applyClaudeRewindWorkspaceRestore` 是否执行（依赖: 2.x；输入: `forkClaudeSessionFromMessageForWorkspace`；输出: ON 执行恢复，OFF 跳过恢复；验证: hook 测试覆盖两分支）
- [x] 3.2 在 Codex rewind 分支按参数控制 `applyClaudeRewindWorkspaceRestore` 是否执行（依赖: 2.x；输入: `forkSessionFromMessageForWorkspace`；输出: ON 执行恢复，OFF 跳过恢复；验证: codex rewind 测试覆盖两分支）
- [x] 3.3 将失败回滚逻辑与开关联动（依赖: 3.1, 3.2；输入: fork 失败处理路径；输出: 仅 ON 模式进入文件快照回滚；验证: 失败场景测试断言符合开关语义）

## 4. Regression Tests (P0)

- [x] 4.1 更新 `Composer.rewind-confirm` 测试覆盖开关默认值与 OFF 提交（依赖: 1.x, 2.x；输入: 现有 rewind confirm 测试；输出: 新增开关行为断言；验证: `vitest` 通过）
- [x] 4.2 更新 Claude rewind hook 测试覆盖 OFF 不触发文件回退（依赖: 3.1；输入: `useThreadActions.test.tsx`；输出: 新增 OFF 分支测试；验证: 测试断言 apply restore 未被调用）
- [x] 4.3 更新 Codex rewind hook 测试覆盖 OFF 不触发文件回退（依赖: 3.2；输入: `useThreadActions.codex-rewind.test.tsx`；输出: 新增 OFF 分支测试；验证: 测试断言 apply restore 未被调用）

## 5. Verification And Release Guard (P1)

- [x] 5.1 运行前端相关测试集并归档结果（依赖: 4.x；输入: rewind 相关测试文件；输出: 测试通过记录；验证: `pnpm vitest` 目标集通过）
- [x] 5.2 运行类型检查并归档结果（依赖: 2.x, 3.x；输入: TS 代码变更；输出: 类型检查通过记录；验证: `pnpm tsc --noEmit` 通过）
- [x] 5.3 人工验证回归（依赖: 5.1, 5.2；输入: Claude/Codex 两引擎回溯流程；输出: ON/OFF 行为验收记录；验证: OFF 不改文件、ON 保持现状）
