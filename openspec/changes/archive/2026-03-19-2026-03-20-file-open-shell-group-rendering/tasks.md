## 1. Unified Shell Group Mapping

- [x] 1.1 扩展统一语言注册表的 shell 兼容集合（输入：提案中的兼容矩阵；输出：filename-priority + extension-fallback 规则；验证：`fileLanguageRegistry` 单测覆盖并通过；优先级：P0；依赖：无）
- [x] 1.2 保持预览/编辑共享判定来源（输入：现有 `resolveFileLanguageFromPath` 流程；输出：shell 组统一映射到 `bash/shell`；验证：`syntax` 与 `codemirrorLanguageExtensions` 用例通过；优先级：P0；依赖：1.1）
- [x] 1.3 保留未知类型安全回退（输入：空路径/未知扩展/尾随点文件名；输出：`null/null` 纯文本回退；验证：回退断言通过；优先级：P0；依赖：1.1）

## 2. Structured Preview Boundary Handling

- [x] 2.1 扩展结构化预览 shell 识别范围（输入：`.sh/.bash/.zsh/.ksh/.dash/.command` 与 dotfiles；输出：`resolveStructuredPreviewKind` 覆盖 shell 组；验证：结构化预览单测通过；优先级：P0；依赖：1.1）
- [x] 2.2 增加边界保护（输入：空路径、无文件名；输出：返回 `null` 回退默认渲染链路；验证：边界用例通过；优先级：P0；依赖：2.1）
- [x] 2.3 保持 Dockerfile 优先契约（输入：既有 Dockerfile 规则；输出：Dockerfile 不被 shell 扩展误匹配；验证：Dockerfile 断言通过；优先级：P1；依赖：2.1）

## 3. Compatibility Regression Guard

- [x] 3.1 补齐语言注册表兼容测试（输入：shell 组样例；输出：`.zsh/.command/.envrc/.bashrc` 命中断言；验证：测试通过；优先级：P0；依赖：1.1）
- [x] 3.2 补齐文件视图端到端测试（输入：文件打开场景；输出：`.envrc` 编辑/预览兼容断言；验证：`FileViewPanel` 用例通过；优先级：P0；依赖：2.1）
- [x] 3.3 补齐结构化预览独立测试（输入：preview kind 判定；输出：shell 组 + fallback + docker 优先断言；验证：新增测试文件通过；优先级：P0；依赖：2.1）

## 4. Verification and Delivery

- [x] 4.1 运行最小回归测试门禁（输入：受影响测试集；输出：测试结果；验证：全部通过；优先级：P0；依赖：3.1,3.2,3.3）
- [x] 4.2 记录执行结果与可回滚点（输入：代码改动与测试结果；输出：工单与提案同步；验证：artifact 完整可追溯；优先级：P1；依赖：4.1）

## 5. 验证记录（2026-03-20）

- [x] 5.1 自动化验证命令：
  - `pnpm vitest run src/utils/fileLanguageRegistry.test.ts src/utils/syntax.test.ts src/features/files/utils/codemirrorLanguageExtensions.test.ts src/features/files/components/FileStructuredPreview.test.ts src/features/files/components/FileViewPanel.test.tsx`
- [x] 5.2 结果：
  - `5` 个测试文件通过，`38` 个测试全部通过。

## 6. 回滚检查点

- [x] 6.1 若出现 shell 文件误判，优先回滚：
  - `src/utils/fileLanguageRegistry.ts` 中 shell 组 filename/extension 规则
  - `src/features/files/components/FileStructuredPreview.tsx` 中 shell 组识别逻辑
- [x] 6.2 回滚后需重跑最小回归门禁，确认非 shell 类型无回归。
