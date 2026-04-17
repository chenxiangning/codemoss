# Quality Guidelines（质量规范）

## Hard Rules（红线）

- 不猜接口（No guessed interface）。
- 不吞异常（No silent catch）。
- 不留死代码（No dead code）。
- 不在同一 PR 夹带无关行为变更。
- 高风险文件冲突禁止整文件覆盖 `--ours/--theirs`。

## Forbidden Patterns

- 在 feature 里直接 `invoke()`，绕过 `services/tauri.ts`。
- 交互界面硬编码文本，绕过 i18n。
- 复制粘贴相似逻辑，不做 reuse 评估。
- 修改大样式文件不跑 large-file 检查。
- 在核心流程里随意引入 `any`。

## Required Patterns

- boundary 数据先 normalize 再使用。
- side effect 必须 cleanup。
- 错误信息要可追踪、可读、可反馈。
- 关键行为变更必须补 tests 或 contract check。

## 标准验证命令

```bash
npm run lint
npm run typecheck
npm run test
```

涉及大文件或样式重构时：

```bash
npm run check:large-files
```

涉及 runtime/bridge contract 时：

```bash
npm run check:runtime-contracts
npm run doctor:strict
```

## Code Review Checklist

- 变更是否对应明确需求/规范？
- payload mapping 是否前后兼容？
- async hook 是否有 race 和 cleanup 风险？
- test 是否覆盖 success/failure/edge？
- 文件落位、命名、抽象层级是否符合规范？
