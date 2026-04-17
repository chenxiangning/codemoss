# Apply Plan (P0): Spec Hub MVP

## Scope

本执行手册仅覆盖 `tasks.md` 中 P0 项：

1. Runtime Model and State Machine（1.1 ~ 1.4）
2. OpenSpec Adapter（2.1 ~ 2.3）
3. Spec Hub Workbench UI（3.1 ~ 3.11）
4. Environment Doctor and Mode Management（4.1 ~ 4.3）
5. Quality Gates and Delivery（6.1 ~ 6.3）

不包含：

- 2.4（错误上下文增强，P1）
- 3.12（icon 语义映射完善，P1）
- 4.4（修复建议重试入口，P1）
- 5.x（spec-kit minimal hook，P1）
- 6.4（verification 文档收口，P1）

## Execution Batches

## 1. Batch A - Runtime Foundation

- [ ] A1 (映射 tasks 1.1) 定义统一领域类型与状态枚举
    - 输入：`proposal.md`、5 个 delta specs
    - 产出：`SpecWorkspace/SpecChange/SpecArtifact/SpecAction/SpecBlocker` 类型与注释
    - 验证：`npm run typecheck`
- [ ] A2 (映射 tasks 1.2) 实现 change/artifact 扫描器
    - 输入：workspace `openspec/changes` 目录
    - 产出：规范化 change 列表和 artifact presence 数据
    - 验证：扫描器单测通过，至少覆盖 active + archive 两种目录
- [ ] A3 (映射 tasks 1.3) 实现状态推导器
    - 输入：artifact presence + validate 结果 + blocker
    - 产出：确定性状态值（`draft/ready/implementing/verified/archived/blocked`）
    - 验证：状态快照测试通过
- [ ] A4 (映射 tasks 1.4) 增加 workspace 级隔离缓存
    - 输入：workspace 切换事件
    - 产出：按 workspace key 的 runtime state cache
    - 验证：双 workspace 切换回归测试通过

## 2. Batch B - OpenSpec Action Adapter

- [ ] B1 (映射 tasks 2.1) 封装命令执行器
    - 输入：action + change + workspace path
    - 产出：结构化执行结果（`success/stdout/stderr/exitCode`）
    - 验证：success/fail 两条路径测试通过
- [ ] B2 (映射 tasks 2.2) 实现 preflight blocker 检测
    - 输入：action + artifacts + doctor health
    - 产出：blocker 列表与禁用原因
    - 验证：缺失 `tasks.md` 时 `apply` 被阻断
- [ ] B3 (映射 tasks 2.3) 实现 strict validate 结构化解析
    - 输入：`openspec validate <change> --strict` 输出
    - 产出：diagnostics（failed target/reason/hint）
    - 验证：失败样例可稳定解析并展示

## 3. Batch C - Spec Hub Core UI

- [ ] C1 (映射 tasks 3.1, 3.2) 落地页面壳与三栏布局
    - 输入：runtime state
    - 产出：Changes/Artifacts/执行台 三栏布局
    - 验证：首次加载三栏完整显示
- [ ] C2 (映射 tasks 3.3, 3.4) 接入 change 列表筛选与切换联动
    - 输入：状态筛选器 + change selection
    - 产出：列表与详情联动
    - 验证：切换 change 后右侧内容无错位
- [ ] C3 (映射 tasks 3.5) 接入产物 Tabs 与内容渲染
    - 输入：artifact documents
    - 产出：Proposal/Design/Specs/Tasks/Verification 视图与空态
    - 验证：缺失 artifact 时空态提示正确
- [ ] C4 (映射 tasks 3.6) 接入执行台 Tabs 容器
    - 输入：selected change context
    - 产出：动作/门禁/时间线/环境诊断 Tab
    - 验证：切换 Tab 不丢失 change 上下文
- [ ] C5 (映射 tasks 3.7) 接入执行台动作 Tab 执行反馈
    - 输入：preflight 结果 + adapter 执行结果
    - 产出：按钮可用态、失败态、成功态
    - 验证：blocker 和执行状态一致
- [ ] C6 (映射 tasks 3.8) 接入执行台门禁 Tab
    - 输入：blockers + action availability
    - 产出：门禁原因、严重级别、禁用态
    - 验证：动作禁用与 blocker 一致
- [ ] C7 (映射 tasks 3.9, 3.10, 3.11) 接入时间线、环境诊断与结构化验证反馈
    - 输入：diagnostics 列表
    - 产出：时间线事件、诊断卡片、失败项定位跳转
    - 验证：新事件可追加、诊断可见、失败项可定位

## 4. Batch D - Doctor and Safe Degrade

- [ ] D1 (映射 tasks 4.1) 实现 openspec 依赖探测和版本采集
    - 输入：当前 PATH 环境
    - 产出：health report（found/path/version/severity/hints）
    - 验证：命令存在/缺失两路径测试通过
- [ ] D2 (映射 tasks 4.2) 实现 Managed/BYO 模式持久化
    - 输入：workspace 级 mode selection
    - 产出：持久化读写与重启回读
    - 验证：重启后模式一致
- [ ] D3 (映射 tasks 4.3) 接入 unhealthy -> read-only 降级
    - 输入：doctor health state
    - 产出：浏览可用、执行禁用、blocker 文案可见
    - 验证：health 不通过时动作不可执行

## 5. Batch E - Quality Gate

- [ ] E1 (映射 tasks 6.1) 补充单测矩阵
    - 输入：runtime/adapter/doctor/ui 模块
    - 产出：关键失败路径测试覆盖
    - 验证：`npm run test` 通过
- [ ] E2 (映射 tasks 6.2) 执行静态质量门禁
    - 输入：全量代码
    - 产出：类型与 lint 无错误
    - 验证：`npm run typecheck && npm run lint`
- [ ] E3 (映射 tasks 6.3) 执行手工回归清单
    - 输入：OpenSpec 工作区样例
    - 产出：回归记录（闭环动作、阻断提示、降级行为）
    - 验证：关键场景全通过

## Suggested Session Split

1. Session 1（2h）：A1 + A2
2. Session 2（2h）：A3 + A4 + B1
3. Session 3（2h）：B2 + B3 + C1
4. Session 4（2h）：C2 + C3 + C4
5. Session 5（2h）：C5 + C6 + C7
6. Session 6（2h）：D1 + D2 + D3
7. Session 7（2h）：E1 + E2 + E3

## Definition of Done (P0)

1. `tasks.md` 中全部 P0 项完成并有可追溯验证记录。
2. 在 Spec Hub 中可完成最小闭环：浏览 change -> 执行动作 -> 查看验证结果。
3. 环境异常时系统可降级到 read-only，且 blocker 信息可读。
4. 对应 change 通过严格校验：

```bash
openspec validate codemoss-spec-hub-mvp-2026-02-23 --strict
```
