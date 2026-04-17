## 1. 路径域模型扩展（P0）

- [x] 1.1 扩展 `FileReadTarget` domain 枚举为 `workspace / external-spec / external-absolute / invalid`（依赖：无；输入：现有 `workspacePaths` 判定逻辑；输出：新增 domain 类型与判定分支；验证：`workspacePaths` 单测覆盖四类路径并通过）。
- [x] 1.2 保持 `workspace` 与 `external-spec` 既有判定优先级不变（依赖：1.1；输入：当前匹配顺序；输出：兼容原行为的优先级实现；验证：现有 external-spec 与 workspace 测试不回归）。

## 2. 外部绝对路径只读读取链路（P0）

- [x] 2.1 新增 Tauri 只读命令（或等价 IPC）用于读取 external absolute file（依赖：1.1；输入：文件绝对路径；输出：`{ content, truncated }` 或可恢复错误；验证：后端单测覆盖存在/不存在/不可读三类情况）。
- [x] 2.2 在前端 `services/tauri` 增加对应调用封装（依赖：2.1；输入：workspaceId + absolutePath；输出：统一 read response；验证：tauri service 测试与调用契约一致）。

## 3. FileViewPanel 读取分发接入（P0）

- [x] 3.1 在 `FileViewPanel` 读取流程接入 `external-absolute` 分发（依赖：1.1,2.2；输入：resolved fileReadTarget；输出：外部绝对路径可打开；验证：渲染测试中不再出现 `Invalid file path`）。
- [x] 3.2 外部绝对路径保存动作保持拒绝并返回明确提示（依赖：3.1；输入：save 操作；输出：只读保护行为；验证：保存分支测试断言不调用写入接口）。

## 4. Session Activity 跳转回归验证（P1）

- [x] 4.1 增加 `buildWorkspaceSessionActivity` 与面板点击联动测试，覆盖 external-spec 与 external-absolute 并存场景（依赖：3.1；输入：tool read 事件样本；输出：稳定 jumpTarget 行为；验证：组件测试通过且路径域符合预期）。
- [x] 4.2 增加跨平台路径规范化样例（Windows drive letter / macOS path）验证 domain 判定（依赖：1.1；输入：多平台路径样本；输出：一致匹配行为；验证：判定单测通过）。

## 5. 验收与回归门禁（P0）

- [x] 5.1 执行目标测试集与 typecheck（依赖：1-4 完成；输入：代码与测试；输出：测试报告；验证：相关单测通过、`pnpm tsc --noEmit` 通过）。
- [x] 5.2 手工验收三条核心路径：workspace/external-spec/external-absolute（依赖：5.1；输入：三类真实路径；输出：验收记录；验证：三类路径均可按预期打开或报可恢复错误）。
