## Why

spec-kit 模块开发完成后，需要进行一次规范级验证，确保它与 OpenSpec 在前后端链路中保持相互独立：

- 新增逻辑是“新模块接入”，不是“旧模块改写”。
- 不影响 OpenSpec 既有能力与历史工作流。
- 合并过程遵循低冲突原则，避免因文件重叠导致回退或覆盖。

本提案属于“规范测试/治理”类型，不包含功能编码实现。

## 目标与边界

- 目标：定义一套可执行、可审计的独立性检查标准。
- 目标：定义“新代码不侵入旧链路”的验收门禁。
- 目标：定义“合并友好无冲突”的流程约束与回归哨兵。
- 边界：不新增业务功能。
- 边界：不修改运行时代码。
- 边界：仅输出规范、检查项、验收标准与执行记录要求。

## Non-Goals

- 不在本提案中实现 spec-kit 新功能。
- 不替代已有功能提案（例如 auto execution 能力提案）。
- 不做 UI/交互层优化实现。

## What Changes

- 新增一份治理类能力规格：`spec-hub-module-isolation-governance`。
- 新增独立性检查清单：Provider、Runtime State、Adapter 路由、存储键空间、诊断链路。
- 新增回归与合并检查标准：冲突前审计、冲突中语义融合、冲突后哨兵验证。
- 新增发布前门禁要求：必须形成书面检查记录并附证据。

## Capabilities

### New Capabilities

- `spec-hub-module-isolation-governance`: 定义 OpenSpec 与 spec-kit 模块独立性、低冲突合并与非回退验收标准。

## 验收标准

1. 检查流程 SHALL 证明 spec-kit 与 OpenSpec 拥有独立 provider scope 与独立 state 容器。
2. 检查流程 SHALL 证明 spec-kit 运行不写入 OpenSpec runtime/timeline/action state。
3. 检查流程 SHALL 证明 OpenSpec 执行不读取 spec-kit 临时执行态作为判定条件。
4. 检查流程 SHALL 证明新增代码以独立模块组织，legacy 主链路仅有最小接线改动。
5. 检查流程 SHALL 提供关键符号哨兵结果，验证双方能力点均保留。
6. 合并流程 SHALL 禁止对高风险文件使用整文件 `--ours/--theirs` 覆盖。
7. 合并结果 SHALL 提供冲突语义融合记录与能力矩阵核对结论。
8. 验收结果 SHALL 形成可追溯文档，包含检查时间、执行人、命令证据与结论。

## Impact

- 影响范围：OpenSpec 规范与发布门禁流程。
- 代码影响：无直接代码变更要求（规范测试提案）。
- 协作影响：提升并行开发与后续合并稳定性。
