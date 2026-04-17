## Why

当前文件树在前端/全栈仓库中会扫描并返回大量依赖与编译产物目录（如 `node_modules`、`target`），即使已将后端上限提升到 `100000`，仍会把大体量数据一次性推给前端，导致构树与渲染压力集中，增加卡顿、白屏与进程被系统回收风险。

用户诉求明确为：对“依赖目录”和“编译生成目录”采用点开逐级加载，其它规则保持不变。

## 目标与边界

- 目标：
  - 为特殊目录引入“按需逐级加载”能力，降低首屏扫描与渲染峰值。
  - 覆盖常见依赖目录与编译产物目录，避免前端项目树不完整或性能失稳。
  - 保持普通源码/文档目录的现有行为不变。
- 边界：
  - 不重写现有 Git diff、文件预览、文件打开等既有链路。
  - 不改变普通目录的展开交互与数据结构语义。
  - 不回退已生效的后端上限（维持 `100000`）。

## What Changes

- 新增“特殊目录渐进加载”契约：
  - 首次 `list_workspace_files` 仅返回特殊目录节点本身，不返回其深层后代。
  - 前端展开特殊目录时，按目录路径请求下一层子项（逐级加载，不一次打平）。
  - 对已按需拉取到的子目录继续保持“可逐级展开拉取”，不限制为仅第一层。
- 新增目录子级查询命令（用于按需加载）：
  - 仅查询目标目录下一层（或受控深度），并返回子文件/子目录与 gitignored 标记。
- 保持现有规则不变：
  - 普通目录继续沿用当前全量返回与前端构树逻辑。
  - 现有文件树点击、多 Tab、@ 引用、diff 面板行为不改变。
- 引入特殊目录分类表（内置规则，首批覆盖）：

  1) 依赖目录（Dependency）
  - `node_modules`
  - `.pnpm-store`
  - `.yarn`（含 `cache` / `unplugged`）
  - `bower_components`
  - `vendor`（第三方依赖目录）
  - `.venv` / `venv` / `env` / `__pypackages__`
  - `Pods` / `Carthage`
  - `.m2` / `.ivy2`
  - `.cargo`（重点覆盖 `registry` / `git`）

  2) 编译与构建产物目录（Build Artifact / Cache）
  - `target`
  - `dist`
  - `build`
  - `out`
  - `coverage`
  - `.next` / `.nuxt` / `.svelte-kit` / `.angular`
  - `.parcel-cache` / `.turbo` / `.cache`
  - `.gradle`
  - `CMakeFiles` / `cmake-build-*`
  - `bin` / `obj`
  - `__pycache__` / `.pytest_cache` / `.mypy_cache` / `.tox`
  - `.dart_tool`

- 误伤控制：
  - 特殊目录判定优先使用“目录名命中 + 典型工程根层级”策略。
  - 未命中规则的目录全部保持普通目录行为，不降级为懒加载。

## 非目标

- 不引入新的全局忽略策略（例如直接改为遵循 `.gitignore` 并隐藏目录）。
- 不在本次提案中引入文件树虚拟滚动重构。
- 不新增“自动折叠/自动隐藏源码目录”策略。

## 技术方案对比

### 方案 A：继续仅靠提高 `max_files`

- 优点：实现最小。
- 缺点：压力只是延后，不消除大目录导致的峰值开销；前端大仓库仍高风险。

### 方案 B：直接恢复 `git_ignore(true)`

- 优点：返回量显著下降。
- 缺点：会改变当前“可见 gitignored 文件并置灰”的既有产品语义，属于行为变化。

### 方案 C：特殊目录逐级加载（推荐）

- 优点：
  - 精准命中高体量目录，显著降低首屏负载。
  - 普通目录行为保持不变，兼容性最好。
  - 与“用户显式展开才取子级”交互一致，解释成本低。
- 缺点：
  - 需要新增后端按目录查询接口与前端展开时异步状态管理。

取舍：采用方案 C。

## Capabilities

### New Capabilities
- `workspace-filetree-special-directory-loading`: 文件树对依赖/编译产物目录提供按需逐级加载，并保证普通目录行为不变。

### Modified Capabilities
- （无）

## Impact

- Backend（Tauri/Rust）
  - `src-tauri/src/workspaces/files.rs`：特殊目录识别、首屏裁剪、目录子级查询。
  - `src-tauri/src/workspaces/commands.rs`：新增按目录拉取 command，并复用现有 workspace 校验链路。
- Frontend（React/TypeScript）
  - `src/features/files/components/FileTreePanel.tsx`：特殊目录展开时触发按需加载、加载态与错误态展示。
  - `src/lib/tauri.ts` 与相关 hooks：新增 IPC 调用与类型定义。
- QA/Test
  - Rust 单测：特殊目录识别、目录子级查询边界（空目录/超长路径/非法路径）。
  - Vitest：展开特殊目录触发加载、普通目录行为不回归、加载失败不崩溃。

## 验收标准

- 首次打开文件树时，命中特殊目录仅展示目录节点本身，不预加载其全部后代。
- 用户展开特殊目录后，系统仅加载该目录下一层子项；继续展开再逐级加载。
- 当特殊目录下返回的子目录名称未命中特殊白名单时，仍可继续展开并按层加载其后代（例如 `node_modules/@scope/pkg`）。
- 普通目录的展开、文件打开、多 Tab、@ 引用、diff 打开行为与当前版本一致。
- 在含超大 `node_modules`/`target` 的仓库中，文件树可稳定加载，不出现崩溃或长时间无响应。
- 目录查询失败（权限/路径不存在）时，界面给出可恢复提示且不导致应用崩溃。
