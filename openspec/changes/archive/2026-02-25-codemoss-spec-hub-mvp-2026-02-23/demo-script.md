# Demo Script: Spec Hub MVP

## Demo Goal

在 5~8 分钟内演示 Spec Hub 从浏览到执行再到验证的闭环。

## Steps

1. 打开任意包含 `openspec/changes` 的 workspace，进入 `Spec Hub`。
2. 左栏切换筛选：
    - 依次点击 `全部`、`活跃`、`阻塞`、`归档`。
    - 选择一个 change，确认中栏/右栏上下文联动。
3. 中栏切换产物 tabs：
    - Proposal -> Design -> Specs -> Tasks -> Verification。
    - 展示缺失产物的空态提示。
4. 右栏执行台 `动作` Tab：
    - 展示 Continue/Apply/Verify/Archive 按钮与 command preview。
    - 说明 blocker 文案（例如缺失 tasks 时 Apply 禁用）。
5. 右栏执行台 `门禁` Tab：
    - 展示 Provider/Environment/Artifacts/Validation 四项门禁状态。
    - 演示验证失败时结构化 issue 和跳转行为。
6. 右栏执行台 `时间线` Tab：
    - 演示 action/validate/gif-link 事件按时间倒序追加。
7. 右栏执行台 `环境诊断` Tab：
    - 在 Managed/BYO 之间切换并刷新。
    - 展示依赖检查、blockers 与 hints。
8. 切换到 spec-kit workspace（如可用）：
    - 展示 minimal 模式标识。
    - 演示 passthrough 入口（跳转文档/外部命令提示）。
9. 返回 `Tasks` tab：
    - 展示任务进度徽标（`checked/total`）。

## Demo Pass Criteria

- 三栏布局与四个执行台 Tab 可见且可交互
- 至少一次动作执行反馈成功展示
- 至少一次门禁/验证问题定位可展示
- Doctor 信息与模式切换可见
- Tasks 进度可见
