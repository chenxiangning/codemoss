---
type: guide
status: active
---

# OpenSpec Team Playbook

> **内容类型**：How-to
> **生命周期**：active
> **最后校准**：2026-08-10 · mossx
> **事实源**：`AGENTS.md`、`openspec/README.md`、`dev-guidelines/**`
> **更新触发器**：OpenSpec CLI 或 commit / archive gate 变化
> **导航**：[`README.md`](README.md) · [`../../README.md`](../../README.md)

## 1. 目标

在同一仓库内统一规范与执行：

- OpenSpec 管需求 / 行为规范（`openspec/`）
- `dev-guidelines/**` 管 code-level 实现约束

> 本仓库已移除 Trellis 工作流（任务目录、session record、`/trellis:*` commands）。历史 commit 中的 `chore(trellis)` 记录仅作追溯，不再要求补写。

## 2. 角色与职责

- 需求提出者：创建或确认 OpenSpec change。
- 开发执行者：按 change 的 proposal / design / tasks 实现，并对照 `dev-guidelines/**`。
- 评审者：检查 PR 是否包含 change 映射、验证结果是否完整。

## 3. 日常流程（必须）

1. 选择或创建 OpenSpec change。
2. 开发与自测（对照相关 `dev-guidelines/**`）。
3. 运行 lint / typecheck / 相关测试。
4. 运行 OpenSpec 校验并完成 sync / archive（按发布策略）。
5. PR 中写清 change 映射、code commit 与验证证据。

## 4. 命令模板

```bash
# 查看/创建 change
openspec list
openspec new change "<change-id>"

# 开发完成后校验
openspec validate --change "<change-id>" --strict

# 根据策略选择
openspec sync --change "<change-id>"      # 仅同步主 specs，不归档
openspec archive "<change-id>"            # 完成后归档
```

## 5. PR 模板（建议）

```text
OpenSpec Change: <change-id>
Validation:
- openspec validate --change "<change-id>" --strict : PASS/FAIL
- test/lint/typecheck : PASS/FAIL
Commits:
- code: <hash>
```

## 6. 没装 CLI 的同事怎么协作

- 可以正常开发代码。
- 但 PR 必须填写 OpenSpec change 映射。
- 由已安装 CLI 的同事补跑 `openspec validate` 与归档步骤。

## 7. 约束（红线）

- 行为变更不得绕过 OpenSpec 记录。
- 未完成验证不得归档 change。
- 实现细则写在 `dev-guidelines/**`，不要回写进 `AGENTS.md`。
