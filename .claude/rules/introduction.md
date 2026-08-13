# 项目入口

Claude Code 开始任务时按以下顺序读取，不在本文件复制会快速漂移的实现细节：

1. [`../../AGENTS.md`](../../AGENTS.md) — 规则优先级、PlanFirst、OpenSpec、commit 与 merge guardrails。
2. [`../../README.zh-CN.md`](../../README.zh-CN.md) — 当前产品、技术栈、开发命令与贡献入口。
3. [`../../docs/README.md`](../../docs/README.md) — architecture / performance / plan / research 文档地图及事实边界。
4. [`../../openspec/README.md`](../../openspec/README.md) — behavior specs、active changes、archive 与治理入口。
5. [`../../dev-guidelines/`](../../dev-guidelines/) — 实现任务按 frontend / backend / guides 选择性读取。

版本、engine、locale、theme、CI trigger 等易漂移事实必须从 manifest、workflow 或源码入口重新核对，不能把历史 plan / audit report 当成当前实现。
