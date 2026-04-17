## Why

右侧文件打开链路当前已经支持单个 `.sh` 场景，但对“shell 脚本成组文件”覆盖不完整（例如 `.zsh`、`.bash`、`.envrc`、`.command` 与常见无扩展脚本名）。  
结果是同一类脚本在文件打开后的渲染体验不一致：有的走结构化预览，有的退回普通文本，且预览与编辑语言判定边界存在潜在漂移风险。

本提案旨在补齐 shell 脚本组在文件打开场景的渲染覆盖，并明确边界回退策略，保证“可识别就统一渲染、不可识别就安全纯文本”。

## 目标与边界

- 目标：在文件打开链路中扩展 shell 脚本组识别范围，覆盖 `.sh` 及同类脚本文件。
- 目标：确保预览渲染与编辑渲染继续共享统一语言判定来源，不引入双轨规则漂移。
- 目标：在结构化预览中补齐 shell 组匹配，并保持未知类型安全回退。
- 目标：补充可回归测试，确保新增覆盖不破坏现有文件类型渲染表现。
- 边界：仅涉及右侧文件视图的语言判定与渲染行为，不改变文件树打开/多 Tab 交互协议。
- 边界：不引入后端文件 IO 协议变化，不变更存储结构。

## 非目标

- 不新增 IDE 语义能力（LSP、跳转定义、重构）。
- 不扩展到所有脚本语言生态，仅聚焦 shell 脚本组。
- 不重构 FileViewPanel 的整体状态管理。

## What Changes

- 扩展统一语言注册表中的 shell 规则，覆盖 shell 脚本组：
  - 扩展名类：`.sh`、`.bash`、`.zsh`、`.ksh`、`.dash`、`.command`
  - 文件名类（无扩展）：`.envrc`、`bashrc`、`zshrc`、`profile`（含前导点变体）
- 预览链路统一映射到 Prism `bash`，编辑链路统一映射到 CodeMirror `shell`。
- 保持“filename-priority -> extension fallback -> plain text fallback”判定顺序。
- 扩展结构化预览 shell 类型识别，使 shell 组文件在预览态保持一致的可读结构。
- 增补边界处理：
  - 空路径/无文件名：直接回退普通文本预览。
  - 未命中规则：安全回退纯文本，不抛错、不白屏。
  - 已支持类型（`js/ts/json/md/css/yaml/java/xml/python/sql/toml`）不得回归。
- 增加对应单测，覆盖 shell 组判定、结构化预览入口、未知类型回退。

## 技术方案对比

### 方案 A：仅在结构化预览组件中补 `.sh` 近邻扩展（局部补丁）

- 优点：改动快。
- 缺点：语言判定源不完整，预览/编辑仍可能出现不一致。
- 结论：不采纳。

### 方案 B：先扩展统一语言注册表，再由预览/编辑/结构化入口共同消费（推荐）

- 优点：规则单源、回归测试清晰、后续维护成本低。
- 缺点：需要同时修改注册表与渲染入口，改动范围中等。
- 结论：采纳。

## Capabilities

### Modified Capabilities

- `file-view-language-rendering-coverage`：
  - 扩展 shell 脚本组识别覆盖；
  - 明确文件打开场景下的边界回退契约；
  - 保证预览与编辑共享语言判定结果来源。

### New Capabilities

- (none)

## 验收标准

1. 打开 `scripts/dev-local.sh` 时，预览与编辑模式 MUST 使用 shell 渲染语义（`bash`/`shell`）。
2. 打开 `scripts/release.zsh`、`.envrc`、`script.command` 时，系统 MUST 按 shell 组规则渲染。
3. 打开 `Dockerfile` 时，既有 Docker 结构化预览契约 MUST 保持不变。
4. 打开未知扩展（如 `note.unknown`）时，系统 MUST 回退纯文本且不得崩溃或空白。
5. 已有支持类型（如 `js/ts/json/md/css/yaml/java/xml/python/sql/toml`）渲染表现 MUST 与变更前一致。
6. 相关单测 MUST 覆盖 shell 组映射与边界回退，并全部通过。

## 边界与兼容性补充

### 文件名与扩展名兼容矩阵（新增）

- filename-priority:
  - `.envrc` / `envrc` -> `bash/shell`
  - `.bashrc` / `bashrc` -> `bash/shell`
  - `.zshrc` / `zshrc` -> `bash/shell`
  - `.kshrc` / `kshrc` -> `bash/shell`
  - `.profile` / `profile` -> `bash/shell`
- extension-fallback:
  - `.sh` / `.bash` / `.zsh` / `.ksh` / `.dash` / `.command` -> `bash/shell`
- safe-fallback:
  - 空路径、无文件名、未知扩展、尾随点文件名（如 `script.`）-> `plain text`（`null/null`）

### 行为边界（明确）

- Dockerfile 识别优先级高于 shell 扩展识别，保持原有结构化预览语义不变。
- 仅在“文件打开渲染”链路生效，不改变 FileTree 打开行为、多 Tab 契约与读取协议。
- 本次为 additive-only 变更，不移除既有语言规则。

## 验证与回归门禁补充

- 自动化最小回归门禁（已纳入）：
  - `src/utils/fileLanguageRegistry.test.ts`
  - `src/utils/syntax.test.ts`
  - `src/features/files/utils/codemirrorLanguageExtensions.test.ts`
  - `src/features/files/components/FileStructuredPreview.test.ts`
  - `src/features/files/components/FileViewPanel.test.tsx`
- 回滚策略：
  - 若出现误判，可仅回滚 `fileLanguageRegistry` 与 `FileStructuredPreview` 的 shell 组规则，保持其他能力不受影响。

## Impact

- Affected code（预期）：
  - `src/utils/fileLanguageRegistry.ts`
  - `src/utils/fileLanguageRegistry.test.ts`
  - `src/features/files/components/FileStructuredPreview.tsx`
  - `src/features/files/components/FileStructuredPreview.test.ts`
  - `src/features/files/components/FileViewPanel.test.tsx`
  - `src/features/files/utils/codemirrorLanguageExtensions.test.ts`
  - `src/utils/syntax.test.ts`
- API / Protocol：无外部接口破坏性变化。
- Dependencies：不新增依赖，复用现有 Prism bash 与 CodeMirror shell 扩展。
- Systems：提升文件打开场景下 shell 脚本组渲染一致性与可读性。
