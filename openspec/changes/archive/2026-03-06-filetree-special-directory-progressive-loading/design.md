## Context

- 当前工作区文件树后端扫描仍采用“全量列举 + 固定上限”模式，且会遍历依赖与构建产物目录（如 `node_modules`、`target`）。
- 前端文件树在接收结果后进行全量构树，目录体量过大时会放大 CPU 与内存峰值，表现为卡顿、白屏、甚至进程被系统回收。
- 业务约束已明确：
  - 仅针对“依赖目录/编译产物目录”引入逐级加载。
  - 普通源码与文档目录行为不变。
  - 复用既有 UI 组件与交互，不改变被引用组件原有行为。

## Goals / Non-Goals

**Goals:**
- 为特殊目录引入“首次仅返回目录节点，展开再按层查询”的渐进加载机制。
- 覆盖主要依赖目录与编译产物目录，降低首屏扫描和渲染峰值。
- 保持普通目录、文件打开、多 Tab、@ 引用、diff 入口的现有行为完全一致。
- 在加载失败场景下保证可恢复、不可崩溃。

**Non-Goals:**
- 不重构整棵文件树为全量懒加载架构。
- 不改写 Git diff 组件、文件预览组件、Tab 管理组件内部行为。
- 不调整现有 `.gitignore` 可见性策略。

## Decisions

### Decision 1: 基于“目录名白名单 + 目录类型标签”判定特殊目录

- 方案：新增 `SpecialDirectoryKind`（`dependency` / `build_artifact`）并以目录名匹配白名单。
- 首批目录名单：
  - dependency：`node_modules`、`.pnpm-store`、`.yarn`、`bower_components`、`vendor`、`.venv`、`venv`、`env`、`__pypackages__`、`Pods`、`Carthage`、`.m2`、`.ivy2`、`.cargo`（registry/git 子路径）
  - build_artifact：`target`、`dist`、`build`、`out`、`coverage`、`.next`、`.nuxt`、`.svelte-kit`、`.angular`、`.parcel-cache`、`.turbo`、`.cache`、`.gradle`、`CMakeFiles`、`cmake-build-*`、`bin`、`obj`、`__pycache__`、`.pytest_cache`、`.mypy_cache`、`.tox`、`.dart_tool`
- 备选：完全依赖 `.gitignore`。
- 不选原因：会改变当前“gitignored 目录可见但置灰”的既有产品语义。

### Decision 2: 引入专用目录子级查询命令，限制为“单层返回”

- 方案：新增按目录路径查询子项 command，只返回直接 children（目录与文件），不递归展开。
- 原因：可把压力摊到用户展开动作上，避免首屏一次性构树。
- 备选：前端本地二次裁剪已有全量数据。
- 不选原因：后端全量扫描成本仍在，无法实质降低峰值与崩溃风险。

### Decision 3: 对普通目录保持现有全量行为，不引入行为漂移

- 方案：只对命中特殊目录启用渐进加载；未命中目录沿用现有 `list_workspace_files` 输出。
- 原因：满足“其他规则不变”，降低回归面。
- 备选：所有目录统一改逐级加载。
- 不选原因：改动面过大，影响当前搜索、批量展开等行为契约。

### Decision 4: 前端采用“占位子节点 + 展开触发拉取 + 幂等缓存”

- 方案：
  - 初始树中，特殊目录标记 `childrenState=unknown`。
  - 首次展开触发 IPC 拉取并写入 children。
  - 对“由特殊目录按需返回出来的子目录”同样标记为可继续按层拉取，形成特殊子树递归渐进加载。
  - 已拉取目录再次展开不重复请求（除非手动刷新）。
- 原因：减少重复 IO，保持交互稳定。
- 备选：每次展开都重新请求。
- 不选原因：会造成无谓抖动和请求放大。

## Risks / Trade-offs

- [Risk] 白名单误伤（例如某些 `build` 目录实际承载源码）
  - Mitigation: 仅命中“目录名 + 典型层级”时生效；提供可观测日志与后续可配置入口。
- [Risk] 深层路径查询输入被构造导致越界
  - Mitigation: 后端复用路径规范化与 `strip_prefix` 校验，拒绝 `..` 与非法绝对路径。
- [Risk] 前端展开/收起并发导致状态错乱
  - Mitigation: 每目录单飞请求（in-flight de-dup），按请求版本号应用结果。
- [Risk] 列表局部加载导致搜索语义变化
  - Mitigation: 本期保持现有搜索作用于“已加载节点”；后续单独评估“服务端搜索”扩展。
- [Risk] 仅第一层懒加载导致用户误判“目录不完整”
  - Mitigation: 明确要求特殊子树目录可递归按层拉取，并用自动化用例覆盖二级/三级展开。

## Migration Plan

1. 后端先落目录判定与子级查询 command，默认不影响现有接口返回结构。
2. 前端在特殊目录上接入按需加载，普通目录路径保持原逻辑。
3. 增加 Rust 单测 + Vitest 回归：
   - 特殊目录只在展开时拉取。
   - 普通目录行为不回归。
   - 异常路径不崩溃。
4. 若出现线上回归，可通过 feature flag 暂时回退到“仅上限控制”模式。

## Open Questions

- `vendor` 在部分项目中可能被当作业务代码镜像，是否需要 workspace 级可配置豁免？
- 搜索是否要跨“未加载子树”做服务端检索？本提案先不纳入。
