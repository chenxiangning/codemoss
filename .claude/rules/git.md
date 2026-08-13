# Git Host Adapter

> Git 的 canonical project policy 位于 [`../../AGENTS.md`](../../AGENTS.md)。本文件只把 Claude Code 路由到当前仓库规则；若两者冲突，以 `AGENTS.md` 为准。

## Commit

- 默认格式：`type(scope): 中文动宾短句`
- 常用 type：`feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`style`、`ci`、`build`
- subject 聚焦一个可审查目的，结尾不加句号
- 禁止 emoji、`WIP`、AI 生成署名、密钥、token 或内部敏感 URL
- commit 前按变更范围完成 lint / typecheck / 相关测试，并确认 OpenSpec 与 `dev-guidelines/**` 需要同步时已同步

示例：

```text
feat(composer): 支持粘贴图片转为附件
fix(git): 修复重命名文件路径归属
docs(openspec): 补齐提案与规格索引
```

## Branch / PR

- 当前主分支是 `main`；feature/fix/refactor 分支从最新 `main` 创建，PR 目标也是 `main`
- 当前 `.github/workflows/ci.yml` 在 push 到 `main` 或手动 dispatch 时运行，打开 PR 不会自动触发该 workflow
- PR 必须附本地验证证据，不得把“能编译”当成唯一合并 gate
- 高风险冲突必须遵守 [`../../AGENTS.md`](../../AGENTS.md) 的 Merge Guardrails：先列 capability matrix，再逐段 semantic merge，禁止对业务文件整文件 `--ours` / `--theirs`

## Safety

- 提交前先核对 `git status --short` 与 `git diff --name-only`，避免纳入其他人的 working-tree 变更
- 不得使用 `git reset --hard` 或无授权的 destructive checkout
- 文档-only commit 必须确认没有业务代码进入 staged set
