## 1. Runtime Reload Backend（外部配置刷新核心）

- [x] 1.1 [P0][依赖: 无][输入: 启动期 Codex 配置读取/校验逻辑][输出: 可重入的 Codex 配置刷新核心函数][验证: Rust 单测覆盖“读取最新文件并更新运行上下文”] 抽取初始化链路为运行期可调用能力。
- [x] 1.2 [P0][依赖: 1.1][输入: daemon/session 管理器][输出: 后端刷新命令入口（串行化执行）][验证: 并发触发测试确认仅串行执行且状态可预测] 增加运行时刷新命令并加互斥保护。
- [x] 1.3 [P0][依赖: 1.2][输入: 刷新失败场景（文件格式错误/路径不可读）][输出: Fail-Safe 回退语义与诊断错误码/消息][验证: 故障注入测试确认失败后旧上下文仍可发送] 完成失败回退保护。

## 2. Codex Cross-Source History Aggregation（跨源历史全量视图）

- [x] 2.1 [P0][依赖: 无][输入: 现有 list_threads 主链路 + local session 扫描能力][输出: workspace 级历史聚合器（live + local）][验证: 单测覆盖跨 source 合并场景] 建立跨 source 统一读取路径。
- [x] 2.2 [P0][依赖: 2.1][输入: 聚合后的原始条目][输出: 确定性去重与按时间排序规则][验证: 单测覆盖重复 id、时间并列、来源冲突] 实现稳定去重与排序。
- [x] 2.3 [P1][依赖: 2.1][输入: session_meta/source/provider 字段][输出: 历史条目 source 标签字段映射][验证: 前后端契约测试确认字段稳定可用] 输出可展示的来源元信息。

## 3. Frontend Refresh Entry & Unified History UX

- [x] 3.1 [P1][依赖: 1.2][输入: Codex 设置页组件][输出: “刷新 Codex 配置”按钮与触发调用][验证: 前端单测确认按钮触发命令且禁用态正确] 在设置页接入刷新入口。
- [x] 3.2 [P1][依赖: 3.1,1.3][输入: 刷新调用结果][输出: `idle/reloading/applied/failed` 状态反馈][验证: 组件测试覆盖成功/失败状态切换与提示文案] 完成用户可见反馈闭环。
- [x] 3.3 [P1][依赖: 2.3][输入: 聚合历史记录][输出: 历史列表默认全量显示 + source 标签渲染][验证: 组件测试确认默认不按 source 隔离] 统一历史展示语义。

## 4. Conversation Continuity Guard（刷新不吞历史）

- [x] 4.1 [P0][依赖: 1.2,2.1][输入: thread list / reopen 既有流程][输出: 刷新前后线程可见性与 reopen 连续性守护逻辑][验证: 回归测试覆盖“外部改配置 -> 刷新 -> reopen 历史仍可见”] 补齐生命周期连续性保护。
- [x] 4.2 [P1][依赖: 4.1][输入: Claude/Gemini 现有行为基线][输出: 非目标引擎隔离校验用例][验证: 回归测试确认 Claude/Gemini 生命周期语义不变] 增加跨引擎非回归保障。

## 5. Verification Gates

- [x] 5.1 [P0][依赖: 1.1,1.2,1.3,2.1,2.2,4.1][输入: 后端变更分支][输出: Rust 回归测试集（生效/失败/并发/聚合/连续性）][验证: `cargo test` 目标测试全通过] 完成后端门禁。
- [x] 5.2 [P0][依赖: 3.1,3.2,3.3][输入: 前端变更分支][输出: 前端测试集（入口、状态机、统一历史渲染）][验证: `pnpm vitest` 目标测试全通过] 完成前端门禁。
- [x] 5.3 [P0][依赖: 5.1,5.2][输入: 合并前候选版本][输出: 质量记录（typecheck + 关键手测）][验证: `pnpm tsc --noEmit` 与手测清单通过] 完成发布前验收（2026-03-31 已完成自动门禁：`pnpm tsc --noEmit`、`npm run check:runtime-contracts`、`npm run build`、`npm run test`、`cargo test --manifest-path src-tauri/Cargo.toml`；关键手测清单已补录：`manual-verification.md`，待执行回填并勾选）。
