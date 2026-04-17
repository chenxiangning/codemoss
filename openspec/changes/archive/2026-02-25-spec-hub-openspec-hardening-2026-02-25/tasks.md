## 1. Verify Evidence Source of Truth

- [x] 1.1 [P0][依赖:无] 盘点并抽离当前 verify 状态来源（输入: `useSpecHub`/`runtime` 现状；输出: verify
  事实源接口定义；验证: 代码评审确认 archive gate 不再直接依赖 timeline）
- [x] 1.2 [P0][依赖:1.1] 实现 change 级 verify 证据持久化/回读（输入: verify action 结果；输出: 跨刷新可读的 verify
  evidence；验证: 刷新页面后 gate 仍识别最近 verify 结果）
- [x] 1.3 [P0][依赖:1.2] 重构 archive gate 使用持久/可复算 evidence（输入: gate 计算逻辑；输出: 事实驱动 gate 结果；验证:
  timeline 清空/截断不影响 archive 判定）

## 2. Truncated Risk Guard

- [x] 2.1 [P0][依赖:无] 在 artifact 聚合层统一上报关键截断风险位（输入: proposal/design/tasks/specs 读取结果；输出:
  `truncatedRisk` 结构；验证: 构造截断样本时 risk 位可稳定产出）
- [x] 2.2 [P0][依赖:2.1] 将 `tasks/specs` 截断接入 gate 降级规则（输入: gate builder；输出: `warn/fail`
  分支与阻断文案；验证: 截断场景 gate 至少为 `warn`）
- [x] 2.3 [P1][依赖:2.2] 在 doctor/gate 面板渲染截断恢复指引（输入: UI 状态映射；输出: 受影响路径+修复建议可见；验证:
  手工回归可见且可理解）

## 3. Stable Change Ordering

- [x] 3.1 [P0][依赖:无] 引入 change 元数据时间戳读取策略（输入: change 目录元信息；输出: 排序主键 `updatedAt` 新来源；验证:
  非日期前缀 change 也可正确排序）
- [x] 3.2 [P0][依赖:3.1] 保留 deterministic 次级排序规则（输入: 同时间戳冲突样本；输出: 稳定 tie-break；验证: 连续刷新顺序不抖动）

## 4. Session Spec Linking Hardening

- [x] 4.1 [P1][依赖:无] 补全 `/spec-root` 正向 `visible` 分支行为（输入: `probeSessionSpecLink` 输出；输出: visible
  时不展示修复噪声；验证: context card 不再出现 rebind/default 建议）
- [x] 4.2 [P1][依赖:4.1] 完成 rebind 成功链路状态收敛（输入: rebind 流程；输出: 修复后状态即时更新为 visible；验证:
  `/spec-root rebind` 回归通过）

## 5. Test Matrix Reinforcement

- [x] 5.1 [P0][依赖:1.3,2.2,3.2] 扩展 `runtime.test.ts` 覆盖 verify 持久化、truncated 门禁、新排序（输入:
  关键状态样本；输出: 新单测集；验证: `vitest runtime` 全绿）
- [x] 5.2 [P0][依赖:1.3,2.3] 新增 `useSpecHub.test.tsx` 覆盖 specRoot/mode/refresh 与 gate 联动（输入: hook
  场景矩阵；输出: hook 回归测试；验证: 核心状态迁移断言通过）
- [x] 5.3 [P1][依赖:2.3] 新增 `SpecHub.test.tsx` 覆盖 actions/gate/doctor/timeline 关键交互（输入: 组件渲染与事件；输出:
  UI 回归测试；验证: 关键面板分支通过）
- [x] 5.4 [P0][依赖:无] 扩展 `tauri.test.ts` 覆盖 external spec list/read/write invoke 映射（输入: wrapper 调用；输出:
  参数契约测试；验证: invoke payload 精确匹配）
- [x] 5.5 [P1][依赖:4.2] 扩展 `useThreadMessaging.test.tsx` 覆盖 visible 正向与 rebind 成功（输入: probe mock；输出:
  会话卡片分支测试；验证: visible 不出修复动作）

## 6. Quality Gates and Regression Run

- [x] 6.1 [P0][依赖:1~5] 运行目标测试集并修复失败（输入: spec/runtime/thread/tauri 测试；输出: 回归通过；验证:
  `npx vitest run ...` 退出码 0）
- [x] 6.2 [P0][依赖:6.1] 执行 `npm run typecheck`（输入: 全仓 TypeScript；输出: 零类型错误；验证: 退出码 0）
- [x] 6.3 [P1][依赖:6.2] 手工回归 `verify->archive gate` 与 `/spec-root` 正向链路（输入: 两类真实场景；输出:
  验收记录；验证: 提案验收标准 1/2/7 对齐）
