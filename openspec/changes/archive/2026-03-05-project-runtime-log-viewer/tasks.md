## 1. Baseline and Isolation Guard

- [x] 1.1 冻结文件树现有行为基线（输入：现有搜索/文件点击/预览交互；输出：回归检查清单；验证：评审确认“Run 入口不改旧行为”；优先级：P0；依赖：无）
- [x] 1.2 创建运行日志模块骨架（输入：proposal/design；输出：`src/features/runtime-log/**` 与 `src-tauri/src/runtime_log/**` 目录结构；验证：模块可被编译但不接线；优先级：P0；依赖：1.1）

## 2. Backend Runtime Session Core

- [x] 2.1 实现会话管理器与状态机（输入：workspaceId、进程句柄需求；输出：`RuntimeSessionManager` + `idle/starting/running/stopping/stopped/failed` 状态模型；验证：Rust 单测覆盖状态迁移；优先级：P0；依赖：1.2）
- [x] 2.2 实现 Java 启动命令探测（输入：工作区文件结构；输出：wrapper 优先 + 系统命令回退解析逻辑；验证：mvn/mvnw/gradle/gradlew 路径单测通过；优先级：P0；依赖：2.1）
- [x] 2.3 实现 start/stop/get-session commands（输入：会话管理器；输出：`runtime_log_start`、`runtime_log_stop`、`runtime_log_get_session`；验证：Tauri command 集成测试通过；优先级：P0；依赖：2.1,2.2）
- [x] 2.4 实现日志事件推送（输入：stdout/stderr 流；输出：`runtime-log:line-appended` / `runtime-log:status-changed` / `runtime-log:session-exited` 事件；验证：事件 payload 结构化断言通过；优先级：P0；依赖：2.3）

## 3. Frontend Run Console

- [x] 3.1 实现运行日志状态 store（输入：运行事件契约；输出：按 workspaceId 分片的会话状态与日志缓存；验证：store 单测覆盖追加/清空/切换工作区；优先级：P0；依赖：2.4）
- [x] 3.2 实现 Run Console UI（输入：状态 store；输出：日志列表、状态条、错误态、空态；验证：组件测试覆盖 running/failed/stopped 三态；优先级：P0；依赖：3.1）
- [x] 3.3 实现控制动作（输入：start/stop 命令与 UI；输出：Stop/Clear/Copy/AutoScroll 控制；验证：交互测试验证命令触发与 UI 行为；优先级：P1；依赖：3.2）
- [x] 3.4 实现有界日志缓冲（输入：高频日志流；输出：ring buffer（如 5000 行）与截断提示；验证：压力测试下内存与渲染稳定；优先级：P1；依赖：3.1,3.2）

## 4. File Tree Trigger Wiring

- [x] 4.1 接入 Run icon 触发意图（输入：FileTreePanel Run icon；输出：点击后打开 Run Console 并触发 start；验证：E2E 流程“点击 Run -> 进入 starting”；优先级：P0；依赖：3.2,2.3）
- [x] 4.2 保证 Run 与文件打开逻辑隔离（输入：现有文件点击打开逻辑；输出：Run click 不触发 onOpenFile；验证：回归测试覆盖“Run 不打开文件”；优先级：P0；依赖：4.1,1.1）

## 5. Error Transparency and UX Polish

- [x] 5.1 实现运行前缺失依赖提示（输入：Java/构建工具探测失败；输出：可执行错误提示（安装/检查建议）；验证：手工验收可复现且提示清晰；优先级：P0；依赖：2.2,3.2）
- [x] 5.2 实现退出码与失败原因展示（输入：进程退出事件；输出：状态栏显示退出码与失败摘要；验证：失败用例 UI 断言通过；优先级：P1；依赖：2.4,3.2）
- [x] 5.3 统一中英文化案（输入：新增控制台与错误文案键；输出：`zh/en` i18n 补齐；验证：无缺失 key 且界面无 fallback key 文本；优先级：P1；依赖：3.2,5.1,5.2）

## 6. Verification and Release Gate

- [x] 6.1 后端质量门禁（输入：runtime_log 模块改动；输出：Rust 单测通过；验证：相关测试全绿且无并发数据竞争；优先级：P0；依赖：2.1,2.2,2.3,2.4）
- [x] 6.2 前端质量门禁（输入：Run Console 与 FileTree 接线改动；输出：Vitest 通过 + typecheck 零错误；验证：CI 本地命令通过；优先级：P0；依赖：3.1,3.2,3.3,3.4,4.1,4.2,5.3）
- [x] 6.3 手工回归与回滚演练（输入：Java 样例项目；输出：验收记录 + 回滚步骤确认；验证：启动成功/失败/停止路径可复现，且回滚不影响旧功能；优先级：P1；依赖：6.1,6.2）

## 7. Runtime Command Preset + Editable Override

- [x] 7.1 Run Console 新增命令预设下拉（输入：Maven/Gradle 启动路径；输出：auto/mvn/mvnw/gradle/gradlew/custom 选项；验证：选择预设后输入框自动填充；优先级：P0；依赖：3.2）
- [x] 7.2 Run Console 新增可编辑命令输入（输入：用户手工命令；输出：可覆写执行命令文本；验证：输入非空时执行用户命令，输入为空时回退自动探测；优先级：P0；依赖：7.1,2.3）
- [x] 7.3 后端 start command 支持 command override（输入：`runtime_log_start` 参数扩展；输出：`command_override` 优先执行逻辑；验证：单测覆盖自定义脚本拼装与退出标记；优先级：P0；依赖：2.3）
- [x] 7.4 前端会话状态补充命令配置（输入：workspace 维度会话；输出：`commandPresetId/commandInput` 状态与事件处理；验证：hook 测试覆盖 preset/custom 两条执行路径；优先级：P1；依赖：7.1,7.2）

## 8. Multi-Stack Runtime Profiles (Phase 2)

- [x] 8.1 实现运行 profile 探测器（输入：workspace 文件结构；输出：`java/node/python/go/custom` profile 列表；验证：fixture 单测覆盖 React/Vue/Python/Go；优先级：P0；依赖：7.4）
- [x] 8.2 Node 前端命令适配（输入：`package.json` scripts + lockfile；输出：`<pm> run dev/start` 默认命令；验证：pnpm/yarn/npm/bun 解析测试通过；优先级：P0；依赖：8.1）
- [x] 8.3 Python 命令适配（输入：`manage.py/main.py/app.py/pyproject.toml`；输出：保守默认命令与提示；验证：Django/脚本型项目 fixture 测试通过；优先级：P0；依赖：8.1）
- [x] 8.4 Go 命令适配（输入：`go.mod/main.go/cmd/*`；输出：`go run .` 或 `go run ./cmd/<name>`；验证：单入口/多入口 fixture 测试通过；优先级：P0；依赖：8.1）
- [x] 8.5 `runtime_log_start` 扩展 profile 执行分支（输入：profile + override；输出：统一执行路径与错误模型；验证：Rust 单测覆盖四类 profile；优先级：P0；依赖：8.2,8.3,8.4）

## 9. Panel Toggle Consistency and Mutual Exclusion

- [x] 9.1 统一文件树 Run 与顶部 Build 为同一 toggle handler（输入：双入口按钮；输出：打开/折叠一致行为；验证：UI 测试覆盖二次点击折叠；优先级：P1；依赖：4.1）
- [x] 9.2 建立 Run Console 与 Terminal 互斥守卫（输入：面板开关状态；输出：任一打开时自动关闭另一方；验证：交互测试覆盖两方向互斥；优先级：P1；依赖：9.1）
- [x] 9.3 多栈手工回归矩阵（输入：React/Vue/Python/Go 样例仓库；输出：验收记录与失败提示截图；验证：启动/停止/失败路径均可复现；优先级：P1；依赖：8.5,9.2）
