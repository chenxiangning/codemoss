# Task Confirmation Matrix: codemoss-spec-hub-mvp-2026-02-23

## 目标

将 `tasks.md` 全部任务转为“可审计执行单元”，确保每一项都有：

- 明确前置依赖（Definition of Ready）
- 明确交付物（Definition of Done）
- 明确验证命令或验证动作（Evidence）

## 全局执行约束

1. 每项任务最多 2 小时，超出则继续拆分子任务。
2. 任何任务完成前，必须附带至少一条验证证据（命令输出或回归记录）。
3. P0 全完成前，不进入 P1 执行。
4. 每个 Batch 完成后立即运行最小回归，避免后置爆雷。

## Task Matrix

| Task | Priority | Depends On    | Deliverable                | Verification Evidence               |
|------|----------|---------------|----------------------------|-------------------------------------|
| 1.1  | P0       | 无             | 统一领域类型与状态枚举                | `npm run typecheck`                 |
| 1.2  | P0       | 1.1           | change/artifact 扫描器        | 扫描器单测（active/archive）               |
| 1.3  | P0       | 1.2           | 状态推导器                      | 状态快照测试                              |
| 1.4  | P0       | 1.3           | workspace 隔离缓存             | 双 workspace 切换回归                    |
| 2.1  | P0       | 1.1           | OpenSpec 命令执行器             | 成功/失败路径单测                           |
| 2.2  | P0       | 2.1           | preflight blocker 检测       | 缺失 `tasks.md` 阻断 `apply`            |
| 2.3  | P0       | 2.1           | strict validate 解析器        | 失败 diagnostics 可定位                  |
| 2.4  | P1       | 2.1           | enriched error payload     | UI 直接渲染错误卡片                         |
| 3.1  | P0       | 1.2           | 页面壳与主状态容器                  | 页面挂载与首次加载测试                         |
| 3.2  | P0       | 3.1           | 三栏布局骨架                     | 首屏三栏渲染验证                            |
| 3.3  | P0       | 3.2           | 变更列表与筛选器                   | 筛选结果一致性测试                           |
| 3.4  | P0       | 3.3           | change 选择联动                | 切换无错位回归                             |
| 3.5  | P0       | 3.4           | 产物 Tabs 与空态                | 缺失 artifact 空态测试                    |
| 3.6  | P0       | 3.4           | 执行台 Tabs 容器                | Tab 切换上下文保持测试                       |
| 3.7  | P0       | 2.1, 3.6      | 动作 Tab 执行反馈                | action 成功/失败 UI 测试                  |
| 3.8  | P0       | 2.2, 3.6      | 门禁 Tab                     | blocker 禁用一致性测试                     |
| 3.9  | P0       | 1.4, 3.6      | 时间线 Tab                    | 新事件追加与排序测试                          |
| 3.10 | P0       | 4.1, 3.6      | 环境诊断 Tab                   | 缺失依赖提示测试                            |
| 3.11 | P0       | 2.3, 3.7, 3.6 | 结构化验证反馈                    | 失败项跳转验证                             |
| 3.12 | P1       | 3.2, 3.6      | icon+label 语义映射            | 语义抽检 + a11y 抽检                      |
| 4.1  | P0       | 无             | doctor 依赖探测与版本采集           | 命令存在/缺失双场景测试                        |
| 4.2  | P0       | 4.1           | Managed/BYO 持久化            | 重启回读测试                              |
| 4.3  | P0       | 4.1, 3.8      | unhealthy->read-only 降级    | health 异常动作禁用验证                     |
| 4.4  | P1       | 4.3           | 修复建议 + retry               | 修复后恢复可执行验证                          |
| 5.1  | P1       | 1.1           | spec-kit detect 与标记        | 样例路径识别测试                            |
| 5.2  | P1       | 5.1, 3.1      | spec-kit read-only 映射      | 缺字段降级展示验证                           |
| 5.3  | P1       | 5.1, 3.7      | passthrough 入口             | 不支持动作跳转验证                           |
| 6.1  | P0       | 2.x, 3.x, 4.x | 单测矩阵补齐                     | `npm run test`                      |
| 6.2  | P0       | 6.1           | 静态质量门禁                     | `npm run typecheck && npm run lint` |
| 6.3  | P0       | 6.2           | 手工验收记录                     | QA checklist 全通过                    |
| 6.4  | P1       | 6.3           | verification + demo script | 评审复核通过                              |
| 7.1  | P1       | 1.2           | unknown 工作区引导态             | runtime unknown 场景测试                |
| 7.2  | P1       | 2.1, 4.1      | OpenSpec init 执行动作         | init 成功/失败结构化结果测试                   |
| 7.3  | P1       | 3.6, 7.1      | 执行台初始化入口                   | unknown 场景 UI 入口可见测试                |
| 7.4  | P1       | 7.3           | 老项目/新项目双路径引导               | 两条路径流程验收                            |
| 7.5  | P1       | 7.4           | 项目信息采集结构与落盘                | 必填校验 + 落盘验证                         |
| 7.6  | P2       | 7.5           | 项目信息更新历史追踪                 | 更新后历史可回看验证                          |
| 7.7  | P1       | 7.2, 7.5      | init 成功后自动刷新入场             | provider 切换与列表刷新验证                  |
| 7.8  | P1       | 7.2~7.7       | onboarding 回归与验收补齐         | onboarding checklist 全通过            |

## Batch-Level Exit Gates

## Batch A/B/C/D/E（P0）

- 必须通过：`npm run typecheck`
- 每个 batch 至少新增 1 条对应模块测试
- 不允许存在未解释的 blocker 状态

## Batch F/G/H/I/J（P1）

- 必须通过：`npm run test`
- minimal mode 的不支持边界必须在 UI 可见
- 所有错误卡片必须有 remediation hint

## Final Acceptance Checklist

- [ ] Spec Hub 可完成最小闭环：浏览 -> 执行 -> 验证
- [ ] 环境异常时可自动降级 read-only 且提示明确
- [ ] spec-kit minimal 行为边界清晰（detect/read-only/passthrough）
- [ ] P0/P1 均有可追溯验证证据
- [ ] 严格校验通过：

```bash
openspec validate codemoss-spec-hub-mvp-2026-02-23 --strict
```
