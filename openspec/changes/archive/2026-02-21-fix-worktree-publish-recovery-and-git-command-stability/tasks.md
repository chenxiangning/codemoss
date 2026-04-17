## 1. Backend Stability and Delete-Branch Recovery (P0)

- [x] 1.1 为 `pull/sync/fetch` 增加非交互执行与超时包装（输入：workspaceId+operation options；输出：稳定错误类型；验证：超时场景返回可映射错误）
- [x] 1.2 在长耗时网络 Git 命令前释放 workspace 锁（依赖：1.1；输入：现有命令链路；输出：减少锁持有时长；验证：并发操作不再被整段阻塞）
- [x] 1.3 实现删除分支 `used by worktree` 的 prune+retry（输入：delete branch 请求；输出：一次自愈重试；验证：stale worktree
  场景重试成功）
- [x] 1.4 对“仍被活跃 worktree 占用”返回可操作错误（依赖：1.3；输入：重试失败结果；输出：明确引导文案键；验证：错误含切换/移除占用
  worktree 提示）

## 2. Frontend Notice Lifecycle and Worktree UX (P0)

- [x] 2.1 Git History 错误通知改为常驻并新增手动关闭按钮（输入：operation error state；输出：persistent error notice；验证：>
  5秒不消失且可关闭）
- [x] 2.2 保持成功通知短时自动消失且不影响错误通知策略（依赖：2.1；输入：operation success state；输出：短时 success
  notice；验证：success 自动消失、error 不受影响）
- [x] 2.3 Worktree 创建结果展示 publish warning + retry command 且支持显式关闭（输入：publishError/publishRetryCommand；输出：warning
  UI；验证：warning 非自动消失）
- [x] 2.4 Worktree 创建按钮接入 `creating` 态并阻止重复提交（依赖：2.3；输入：create in-flight state；输出：disabled create
  action；验证：重复点击不触发二次请求）
- [x] 2.5 删除分支异常路径接入二次强删确认弹窗（输入：not fully merged / used by worktree 错误；输出：二次确认后强删；验证：未确认不执行强删）
- [x] 2.6 强删确认弹窗做高风险 UI 优化（图标、红色提示、路径复制、倒计时解锁）（依赖：2.5；输入：占用 worktree
  路径；输出：精致高危确认交互；验证：可复制路径且倒计时后才可确认）
- [x] 2.7 Worktree
  创建结果改为自定义精致弹窗（icon、红色重点告警、重试命令复制、显式关闭）（依赖：2.3；输入：publishError/publishRetryCommand；输出：高可读结果弹窗；验证：失败场景红色重点提示且可复制命令）

## 3. I18n and Error Mapping (P1)

- [x] 3.1 新增/更新超时、认证、worktree 占用删除失败的 i18n key（输入：后端错误类型；输出：中英文映射；验证：UI 不显示原始低可读错误）
- [x] 3.2 统一错误映射入口，保证 Git History 与 Worktree Prompt 文案一致（依赖：3.1；输入：两处错误消费点；输出：一致化映射；验证：相同错误在两处提示一致）

## 4. Regression Tests and Gate Checks (P0)

- [x] 4.1 补后端测试：超时/非交互执行与 delete-branch prune+retry 主路径（输入：mock git 命令结果；输出：新增 Rust
  tests；验证：测试通过）
- [x] 4.2 补前端测试：错误提示常驻+手动关闭、worktree warning/creating 行为（输入：组件状态变化；输出：新增/更新 Vitest
  用例；验证：测试通过）
- [x] 4.3 执行最小回归命令并记录结果（依赖：4.1,4.2；输入：目标测试文件+typecheck；输出：回归结论；验证：无新增失败）
