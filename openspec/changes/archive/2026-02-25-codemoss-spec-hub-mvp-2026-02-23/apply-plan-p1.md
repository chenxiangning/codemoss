# Apply Plan (P1): Spec Hub Enhancement and Closure

## Scope

本执行手册覆盖 `tasks.md` 中全部 P1 项：

1. OpenSpec Adapter（2.4）
2. Spec Hub Workbench UI（3.12）
3. Environment Doctor and Mode Management（4.4）
4. spec-kit Minimal Hook（5.1 ~ 5.3）
5. Quality Gates and Delivery（6.4）

## Execution Batches

## 1. Batch F - Adapter Hardening

- [ ] F1 (映射 tasks 2.4) 增加错误上下文增强
    - 输入：adapter 执行失败结果
    - 产出：`command/workspace/provider/exitCode/errorSummary` 统一错误结构
    - 验证：UI 可直接渲染错误卡片，无需解析 raw stderr

## 2. Batch G - UI Semantics and Accessibility

- [ ] G1 (映射 tasks 3.12) 建立状态/风险/动作 icon+label 语义字典
    - 输入：状态枚举 + action availability + risk level
    - 产出：统一图标映射与文案词典
    - 验证：主要状态在 list/detail/执行台动作 Tab 渲染一致
- [ ] G2 (映射 tasks 3.12) 增加可访问性兜底
    - 输入：icon-only 场景
    - 产出：`aria-label`/tooltip 文案补全
    - 验证：键盘与读屏路径可读取核心状态语义

## 3. Batch H - Doctor Recovery Flow

- [ ] H1 (映射 tasks 4.4) 实现修复建议结构模板
    - 输入：doctor diagnostics
    - 产出：按错误类别返回 repair steps（命令建议 + 说明）
    - 验证：缺失依赖与版本异常两类场景均有可执行建议
- [ ] H2 (映射 tasks 4.4) 接入 retry 流程
    - 输入：用户点击 retry
    - 产出：重新探测并刷新 health state
    - 验证：修复后可从 read-only 恢复到可执行

## 4. Batch I - spec-kit Minimal Hook

- [ ] I1 (映射 tasks 5.1) 实现 spec-kit provider detect + support-level
    - 输入：workspace markers
    - 产出：`provider=spec-kit`、`supportLevel=minimal`
    - 验证：至少 2 个样例路径识别正确
- [ ] I2 (映射 tasks 5.2) 接入 read-only artifact 映射
    - 输入：spec-kit change 文件
    - 产出：规范化详情视图（缺失字段降级为 metadata）
    - 验证：字段不全时 UI 不崩溃且差异可见
- [ ] I3 (映射 tasks 5.3) 接入外部 passthrough 入口
    - 输入：minimal 模式下不支持动作
    - 产出：外部命令/文档跳转入口 + 边界提示
    - 验证：用户可一键跳转且明确“非完整内置支持”

## 5. Batch J - Verification Package

- [ ] J1 (映射 tasks 6.4) 补充 `verification.md` 验证记录模板
    - 输入：P0/P1 测试与验收结果
    - 产出：可追溯验证文档（测试命令、结果、截图/日志索引）
    - 验证：评审可独立复核通过路径
- [ ] J2 (映射 tasks 6.4) 补充演示脚本（demo flow）
    - 输入：Spec Hub 关键场景
    - 产出：5~8 分钟可重复演示步骤
    - 验证：团队演示可稳定复现闭环能力

## Suggested Session Split

1. Session 8（2h）：F1 + G1
2. Session 9（2h）：G2 + H1
3. Session 10（2h）：H2 + I1
4. Session 11（2h）：I2 + I3
5. Session 12（2h）：J1 + J2

## Definition of Done (P1)

1. `tasks.md` 中全部 P1 项完成并可在 UI/日志中验证。
2. spec-kit minimal 模式边界清晰、行为稳定、不可执行动作有明确降级路径。
3. Doctor 具备“问题发现 -> 修复建议 -> 重试恢复”的闭环体验。
4. 变更目录包含可复核的 `verification.md` 和演示脚本。
