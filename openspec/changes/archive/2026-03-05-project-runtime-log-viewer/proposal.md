## Why

当前 Run Console 已覆盖 Java 主链路，但真实项目是多技术栈混合：前端（React/Vue）、后端（Python/Go）都需要同一套“可运行、可观测、可停止”的入口。  
如果只能服务 Java，用户在多语言工作区内仍要手工切换外部终端，无法形成统一体验，也无法复用已有会话隔离与日志可视化能力。

## 目标与边界

- 目标：在现有 Run Console 架构上追加多栈接入，不重做 UI 形态。
- 目标：覆盖 Node 前端项目（React/Vue 常见 dev/start 脚本）、Python 项目、Go 项目。
- 目标：维持“Run 入口 -> 控制台 -> 执行/停止/日志”统一链路，不引入新的并行运行面板。
- 目标：继续采用新增优先（additive-only），不破坏既有文件树、聊天、Git、终端能力。
- 目标：保留“预设命令 + 可编辑覆写”机制，自动探测失败时可一键改成手工命令。
- 边界：本提案不做 Debugger、断点、变量观察、性能采样。
- 边界：本提案不做复杂 Run Configuration 编排（多 profile 矩阵、持久模板库）。

## 非目标

- 不改造现有聊天协议与消息渲染主流程。
- 不重构文件树基础数据结构。
- 不在本阶段覆盖全部语言生态（如 Ruby/.NET/PHP）。
- 不引入破坏性 IPC 协议变更。

## What Changes

- 在已有 `project-runtime-log-viewer` 能力上追加“多栈运行配置探测层”：
  - Node 项目探测：`package.json` + script（`dev`/`start`）+ lockfile（pnpm/yarn/npm/bun）。
  - Python 项目探测：`pyproject.toml` / `requirements.txt` / `main.py` 等常见入口线索。
  - Go 项目探测：`go.mod` + `main.go` / `cmd/*` 入口线索。
- 新增运行配置类型（runtime profile）：
  - `java-maven`, `java-gradle`, `node-dev`, `node-start`, `python-main`, `go-run`, `custom`。
- 前端 Run Console 继续复用一套 UI，但下拉预设按探测结果动态填充。
- 文件树 Run 按钮与顶部 Build 按钮继续作为同一控制台入口：
  - 点击展开，再点折叠（toggle）。
  - 与终端面板互斥，避免双面板同时展开。
- 后端 `runtime_log_start` 保持兼容，扩展 profile 解析逻辑：
  - `command_override` 非空时始终优先。
  - 空输入时按 profile 自动拼装并执行命令。

## 技术方案对比

### 方案 A：每种语言单独一套运行面板

- 优点：每个栈可做深度定制。
- 缺点：UI 与状态管理重复，维护成本高，用户学习成本高。

### 方案 B：统一 Run Console + 多栈 profile 适配层（推荐）

- 优点：复用现有会话/日志/停止链路，改动集中在“命令探测与组装”。
- 优点：跨语言体验一致，回归风险可控。
- 缺点：某些框架的深度定制能力要留给后续迭代。

**取舍结论**：采纳方案 B，用 profile 适配层扩展多栈，不引入第二套控制台。

## Capabilities

### New Capabilities

- `project-runtime-log-viewer`：扩展为跨技术栈运行与日志控制台能力（Java + Node + Python + Go）。

### Modified Capabilities

- (none)：继续在同一 capability 内增量追加 requirement。

## 验收标准

1. Node 前端项目（React/Vue）点击 Run 后，系统 MUST 识别并执行可用包管理器脚本（至少 `dev` 或 `start`）。
2. Python 项目点击 Run 后，系统 MUST 提供可执行默认命令（如 `python main.py`）或明确提示可编辑命令。
3. Go 项目点击 Run 后，系统 MUST 支持默认 `go run .` 路径并持续输出日志。
4. 多栈项目日志 MUST 继续在同一 Run Console 实时流式显示，Stop 行为一致。
5. 文件树/顶部 Build 按钮 MUST 支持 toggle（再次点击折叠），且与终端面板互斥。
6. 命令覆写路径 MUST 在所有 profile 下可用，且优先级高于自动探测。
7. 自动探测失败时 MUST 显示结构化错误与下一步建议，不得静默失败。

## Impact

- Affected frontend（预期）：
  - `src/features/runtime-log/**`（profile 识别、预设映射、会话状态扩展）
  - `src/features/files/components/FileTreePanel.tsx`（Run toggle 接线）
  - `src/features/app/components/MainHeaderActions.tsx`（Build 按钮接线）
- Affected backend（预期）：
  - `src-tauri/src/runtime_log/**`（多栈命令探测与启动组装）
  - `src-tauri/src/lib.rs`（命令注册保持兼容，必要时扩展参数）
- API / Protocol：
  - `runtime_log_start` 保持兼容，追加 profile 解析分支；现有调用方无需破坏性改造。
- Dependencies：
  - 优先复用现有进程执行能力；不新增重量级运行时依赖。
- Systems：
  - 统一多语言项目在 CodeMoss 内的运行观测体验，减少外部终端切换成本。
