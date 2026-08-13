---
type: governance
status: active
---

# MossX 文档治理规范

本文定义 `docs/` 的信息架构、事实来源、生命周期和自动化门禁。文档结构调整必须同步更新入口索引，避免形成不可发现的孤岛。

## 1. 事实来源优先级

发生冲突时，按以下顺序判断：

1. 当前可执行代码、测试与配置。
2. `openspec/**` 中的 behavior spec、proposal、design 与 tasks。
3. `dev-guidelines/**` 中的 implementation rule 与 executable contract。
4. `docs/**` 中的指南、参考、分析、计划、研究与报告。

`docs/**` 不得覆盖更高优先级事实源。涉及当前行为的文档必须链接到可核对的代码、测试或规范。

## 2. 内容类型

| 类型 | 目录 | 用途 |
| --- | --- | --- |
| Guide | `guides/` | 面向任务的操作步骤、开发流程与 UI 指南 |
| Reference | `reference/` | 稳定 contract、术语和接口语义 |
| Analysis | `analysis/` | 问题诊断、机制解释与决策依据 |
| Architecture | `architecture/` | 架构边界、治理规则与结构基线 |
| Performance | `perf/` | 性能基线、实验、门禁与处置手册 |
| Plan | `plans/` | 有时效边界的实施计划与清单 |
| Research | `research/` | 调研、spike 和探索证据 |
| Report | `reports/` | 阶段结果、影响评估与验收记录 |
| Archive | `archive/` | 已退出当前入口、但仍有追溯价值的内容 |

同一事实只保留一个 canonical document。其他位置使用链接或 compatibility stub，不复制正文。

## 3. Published lifecycle taxonomy

所有 `docs/**/*.md` 必须声明一个正式 lifecycle。允许值仅限：

| Lifecycle | 含义 | 使用要求 |
| --- | --- | --- |
| `active` | 当前有效并持续维护 | 适用于 current guide、reference、index 与治理规则 |
| `implemented` | 方案已落地，文档仍用于解释实现或验收 | 必须能指向当前实现、测试或已归档 change |
| `historical` | 带日期或版本边界的历史证据 | 不得表述为永久 current truth |
| `superseded` | 已被另一份文档取代 | 必须明确链接 successor |
| `deprecated` | 已废弃或仅为 compatibility redirect | 必须说明替代入口；`retired` 统一归入此值 |
| `generated` | 由工具生成的只读产物 | 必须注明 generator 或上游数据源，不手工维护 |

`draft` 是 authoring state，不是 published lifecycle。草稿应留在 OpenSpec change 或本地 workspace；进入 `docs/` 发布时必须选择上表中的正式值。

不得使用 `retired`、`current`、`done`、`archived` 等同义值。历史目录位置不能代替 lifecycle marker。

## 4. Lifecycle marker 格式

推荐使用 YAML front matter：

```yaml
---
type: guide
status: active
---
```

为兼容存量文档，也允许显式 banner：

```markdown
> **Lifecycle**: historical
```

```markdown
> **生命周期**：deprecated
```

同一文档若同时存在 YAML 与 banner，两者必须一致。`type` 用于信息架构；`status` 才是 lifecycle marker。

## 5. 索引与可发现性

- `docs/README.md` 是唯一顶层入口。
- 每个 current section 必须提供 `README.md`；`dev-guidelines/**` 按项目约定使用 `index.md`。
- 每份 Markdown 必须从 `docs/README.md` 经本地链接图可达。
- 迁移高 fan-out 文档时，旧路径保留 `deprecated` redirect stub；低引用历史材料可直接进入 `archive/`。
- 新增、移动、归档文档时，同一变更内更新相关 section index 与顶层索引。

## 6. 归档与删除

- 当前实现仍依赖的 runbook、contract 或 troubleshooting guide 不得仅因创建时间较早而归档。
- 只保留追溯价值的历史内容移入 `archive/`，并声明 `historical`。
- 已被替代但仍需解释迁移关系的内容声明 `superseded` 并链接 successor。
- 已废弃且保留旧 URL 的入口声明 `deprecated`，正文只保留迁移说明。
- 无引用、无证据价值、可由事实源重新生成的内容直接删除。

## 7. Runtime 与 generated artifacts

`.DS_Store`、临时输出、运行日志、缓存与本地状态不得进入 `docs/`。生成型文档必须声明 `generated`，并记录生成方式；无法稳定重建的实验结果按 `historical` 证据管理。

## 8. 自动化门禁

运行：

```bash
npm run check:docs
```

门禁至少检查：

- 本地 Markdown/HTML 链接目标存在。
- `docs/**` 中 JSON 可解析。
- 所有 Markdown 从顶层索引可达。
- current section 具备导航文件。
- 每份 Markdown 声明合法且一致的 lifecycle。
- archive 非索引正文使用 `historical`。
- 任意层级不存在 `.DS_Store`。
- 根目录只包含治理入口、品牌资源和 compatibility stubs。

门禁通过只代表结构闭环，不替代代码、OpenSpec 与 `dev-guidelines/**` contract 的语义核对。
