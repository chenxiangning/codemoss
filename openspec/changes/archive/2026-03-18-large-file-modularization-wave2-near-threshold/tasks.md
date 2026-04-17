## 1. Strategy Pivot (Deferred + JIT)

- [x] 1.1 将 Wave2 批量近阈值拆分策略调整为 Deferred（输入: 收益/风险评估；输出: proposal/design 更新；验证: artifacts 明确“不做批量实施”）
- [x] 1.2 定义 JIT 触线即拆规则（输入: 现有 `>3000` hard gate；输出: 同 PR 降线要求；验证: tasks/spec 中有明确约束）

## 2. Governance Guardrails

- [x] 2.1 更新治理文档，补充 JIT 执行与回滚说明（输入: 现有 playbook；输出: Deferred + JIT 章节；验证: 包含触线流程、验证门禁、回滚步骤）
- [x] 2.2 保持 near-threshold 观察清单（可选）用于风险可见性（输入: 扫描结果；输出: 信息性列表；验证: 不影响 CI 阻断策略）

## 3. JIT Execution Rule

- [ ] 3.1 当 PR 引入/增长 `>3000` 文件时，在同一 PR 完成降线拆分（输入: 触线文件；输出: 最小范围模块化拆分；验证: hard gate 通过）
- [ ] 3.2 触线拆分后执行门禁（输入: 变更分支；输出: typecheck + 目标 tests + cargo check 报告；验证: 全通过）

## 4. Closeout

- [x] 4.1 在 OpenSpec 评审中记录本次策略转向（Deferred 原因、JIT 边界、残余风险）
