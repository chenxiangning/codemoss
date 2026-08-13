## 摘要

<!-- 用 1–3 句说明改了什么、为什么 -->

## 变更类型

- [ ] feature
- [ ] fix
- [ ] refactor / 结构治理
- [ ] docs
- [ ] chore / CI

## AppShell / Domain 状态（若涉及 `src/app-shell/**` 或 shell domain bag）

- [ ] 新状态已写入 **owner domain**（`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` + builder/assembly）
- [ ] 未向 `workspaceNavigation` / 无主 bag 尾塞 key
- [ ] 生产路径使用 `selectAppShellDomainBag`（未新增 full-flatten / Legacy adapt）
- [ ] 已跑：`npm run check:app-shell:governance`

> 规则入口：`AGENTS.md` → AppShell Structure Gate；计划：`docs/plans/2026-08-11-app-shell-cohesion-optimization.md`

## 测试

- [ ] 相关 unit / vitest
- [ ] `npm run check:runtime-contracts`（含 app-shell governance）
- [ ] 其它受影响 gate：

## 风险与回滚

- 风险：
- 回滚：按 commit / PR revert
