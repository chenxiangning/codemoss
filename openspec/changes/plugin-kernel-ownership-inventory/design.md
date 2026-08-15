# Design: plugin-kernel-ownership-inventory

## Context

`feature/plugin-mossx-0.8.9` 上同时存在：

- 已冻结的插件平台 Contract（`14`）
- 一份声称“已经减成 Core Shell”的实施记录（`13`）
- 实际完整单体代码

Wave 0A 的设计目标是让后两份事实对齐，并给后续 Wave 一个可执行的归属表。

## Goals

1. 单一 ownership 表成为拔插头的前置条件。
2. fitness check 从第一天就存在，避免 Core 边做 Host 边继续膨胀。
3. 瘦身只发生在无引用集合上。

## Non-Goals

- 不改变 runtime。
- 不引入 Plugin Host。
- 不把 Git/Search 改成 system plugin。

## Decisions

### D1. Inventory 是机器可读表格，不是散文

建议路径：`docs/architecture/plugin-platform/inventory/ownership.json` + 生成的 `ownership.md`。

每行至少：

```text
id
layer            frontend | rust | shared
path
ownerClass       core | pilot | later-plugin | retired-unreferenced
targetPluginId   可空
commands[]       Native command 名
stores[]         前端 store / bag key
dataPaths[]      用户数据路径（不删除）
deleteGate       never | after-pilot-disable | when-unreferenced
```

`scripts/check-core-shell-boundary.mjs` 读这张表，而不是把路径硬编码进脚本后再漂移。

### D2. 本 Wave fitness 分两级

| 级 | 触发 | 行为 |
|---|---|---|
| hard | import / register `retired-unreferenced` | CI fail |
| soft | AppShell 直接 import `later-plugin` 内部文件 | 本 Wave 只报告，不 fail |
| record | `pilot` owner 仍在 Core | 允许，Wave 3/4 再收紧 |

硬红线与 `01` §6 对齐，但必须承认当前单体还没迁，不能把“仍在用的 Notes”当成违规。

### D3. 文档 13 降级为实验记录

`13` 增加醒目状态：`historical-local-experiment / not-this-worktree`。当前事实以 `15` §1 为准。不删除 13，避免丢失那次实验的删除清单。

### D4. 瘦身白名单

允许 Wave 0A 删除：

- 空目录 `src/core-shell/`
- 扫描证明零引用的脚本
- 与工作树矛盾的过期断言（改文档）

禁止：

- `src/features/**` 产品模块
- `src-tauri/src/engine/**`
- Native command
- 用户数据、`~/.ccgui`

## Risks

| 风险 | 缓解 |
|---|---|
| inventory 漏标导致后续误删 | 按目录自动生成初稿，人工只改 class |
| soft 检查被忽略 | Wave 3 开 Claude 前把 AppShell→pilot 的 soft 升级为 hard |
| 把 /tmp 减法残留当事实 | 明确不入库、不以它覆盖 Git |
