## Context

文件打开链路的语言渲染已经统一到 `fileLanguageRegistry`，但 shell 场景仍存在“覆盖不完整 + 入口判定不一致”问题：

- 语言注册表仅稳定覆盖 `.sh/.bash`，对 `.zsh/.ksh/.dash/.command` 及 dotfile 脚本支持不足。
- 结构化预览中的 shell 判定与语言注册表不完全一致，存在“编辑可识别、预览未结构化”风险。
- 边界输入（空路径、无后缀、尾随点文件名）需要明确安全回退契约。

目标是在不改变文件树/Tab/IO 协议的前提下，补齐 shell 组兼容性并加固回退行为。

## Goals / Non-Goals

**Goals:**
- 扩展 shell 文件组识别覆盖，保证预览与编辑使用同一语言语义（`bash/shell`）。
- 让结构化预览与语言注册表在 shell 分类上对齐。
- 明确并测试边界输入回退策略，避免崩溃、空白和误判回归。
- 保持 additive-only，不破坏既有语言行为。

**Non-Goals:**
- 不改动 FileTree 打开策略、多 Tab 逻辑。
- 不引入新的后端命令或文件读写协议。
- 不扩展到非 shell 生态的新语言能力。

## Decisions

### Decision 1: shell 组规则采用“文件名优先 + 扩展名回退”（采纳）

- 文件名优先：`.envrc/envrc`、`.bashrc/bashrc`、`.zshrc/zshrc`、`.kshrc/kshrc`、`.profile/profile`
- 扩展名回退：`.sh`、`.bash`、`.zsh`、`.ksh`、`.dash`、`.command`
- 输出语义统一：
  - preview: `bash`
  - editor: `shell`

取舍：
- 继续只按扩展名判断会漏掉无扩展脚本；单独只做文件名规则又会漏扩展场景。
- 组合策略在复杂度可控前提下覆盖最完整。

### Decision 2: 结构化预览复用同一 shell 分类集合（采纳）

- 在 `resolveStructuredPreviewKind` 中引入与注册表一致的 shell 文件名/扩展名集合。
- 保持 Dockerfile 的优先识别，不让 shell 扩展吞掉 Dockerfile 场景。

取舍：
- 如果结构化预览继续维护独立零散规则，后续必然再次漂移。

### Decision 3: 边界统一回退到普通文本链路（采纳）

- 空路径或无文件名：返回 `null`，不走结构化预览。
- 未命中规则（含尾随点文件名 `script.`）：`previewLanguage/editorLanguage` 均为 `null`。
- 结果：最终渲染走既有 plain text fallback。

取舍：
- 对边界做“猜测性识别”会提升误判率，影响稳定性。

### Decision 4: 以测试矩阵作为兼容性门禁（采纳）

- 判定层：`fileLanguageRegistry.test.ts`
- 预览高亮层：`syntax.test.ts`
- 编辑高亮层：`codemirrorLanguageExtensions.test.ts`
- 结构化入口层：`FileStructuredPreview.test.ts`
- 文件打开端到端层：`FileViewPanel.test.tsx`

取舍：
- 仅做手工验证无法长期防回退；矩阵测试是最低成本的稳定化手段。

## Risks / Trade-offs

- [Risk] 无扩展文件名规则可能误匹配普通文本文件。  
  -> Mitigation: 仅纳入有限白名单（envrc/bashrc/zshrc/kshrc/profile）。

- [Risk] 结构化预览规则扩展导致现有 Dockerfile 行为被覆盖。  
  -> Mitigation: Dockerfile 优先判定并加入专项断言。

- [Risk] 规则变更影响既有支持类型。  
  -> Mitigation: 保持 additive-only，并通过 baseline 用例验证 `js/ts/json/md/css/yaml/java/xml/python/sql/toml`。

## Migration Plan

1. 扩展语言注册表 shell 规则（filename + extension）。
2. 对齐结构化预览 shell 识别集合，并加入空路径回退。
3. 补齐测试矩阵并执行最小回归门禁。
4. 若异常，按“注册表规则 -> 结构化规则”顺序局部回滚，不触及其他链路。

## Verification Snapshot

- 2026-03-20 已执行：
  - `pnpm vitest run src/utils/fileLanguageRegistry.test.ts src/utils/syntax.test.ts src/features/files/utils/codemirrorLanguageExtensions.test.ts src/features/files/components/FileStructuredPreview.test.ts src/features/files/components/FileViewPanel.test.tsx`
- 结果：5 files / 38 tests passed。
