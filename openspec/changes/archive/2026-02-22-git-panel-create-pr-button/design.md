## Context

该变更已经从“按钮提案”推进到“可执行工作流”阶段，覆盖后端命令编排、前端参数确认与进度展示、失败恢复策略三层。核心目标不是只增加一个入口按钮，而是把
PR 提交流程变成 Git 面板内的可观测闭环。

当前已落地实现包含两条后端命令：

- `get_git_pr_workflow_defaults`：负责探测上下文默认参数与可执行性。
- `create_git_pr_workflow`：负责串行执行工作流并返回结构化阶段结果。

## Goals / Non-Goals

**Goals**

- 在 Git 面板内完成 PR 提交全链路，避免切终端。
- 将 runbook 的稳定性策略固化为工作流行为。
- 输出统一结果结构，支持 UI 精准反馈与可恢复操作。

**Non-Goals**

- 不扩展到 GitHub 之外平台。
- 不实现自动 merge / reviewer 分配等策略层能力。
- 不拆分新的独立 PR 页面，保持在 GitHistoryPanel 内完成。

## Architecture Decisions

### 1) 命令分层：Defaults 与 Workflow 解耦（采纳）

- 方案A：前端直接拼装命令并逐步执行。
    - 问题：错误分类、重试策略和执行日志分散，难维护。
- 方案B（采纳）：后端统一编排，前端消费结构结果。
    - 价值：执行契约稳定、测试集中、前端更轻。

最终采用：

- `get_git_pr_workflow_defaults`（预填）
- `create_git_pr_workflow`（执行）

### 2) 状态建模：阶段化结果优先（采纳）

后端以阶段为核心返回：

- stage key：`precheck / push / create / comment`
- stage status：`pending / running / success / failed / skipped`
- stage detail：短文本解释当前状态与动作

好处：

- 前端可以稳定映射 4 阶段进度 UI。
- 可以表达“PR 成功但 comment 失败”的真实语义（主流程成功，子阶段失败）。

### 3) 恢复策略内建到 workflow（采纳）

- token 环境隔离：默认 `env -u GH_TOKEN -u GITHUB_TOKEN`。
- HTTP2 push 失败 fallback：自动单次 `http.version=HTTP/1.1` 重试。
- existing PR 复用：先 `gh pr list --state all --head`，命中则跳过 create。
- 范围门禁：`upstream/<base>...HEAD`，异常范围直接在 precheck 失败。

### 4) 前端交互：参数确认 + 单弹窗闭环（采纳）

- 入口：Git toolbar `PR` 按钮。
- 弹窗：compare 参数条 + 标题/描述 + 可选评论。
- compare 字段采用可搜索下拉弹层（自定义 inline picker），而非原生 datalist。
- 结果区提供直接动作：打开链接、复制链接、复制重试命令。

## Data Contract Snapshot

- Defaults
    - `upstreamRepo, baseBranch, headOwner, headBranch, title, body, commentBody`
    - `canCreate, disabledReason`

- Workflow Result
    - `ok, status, message, errorCategory, nextActionHint`
    - `prUrl, prNumber, existingPr, retryCommand`
    - `stages[]`

## Trade-offs

- 优点
    - 高稳定：关键异常路径内建重试与分流。
    - 高可观测：阶段状态可追踪。
    - 高可恢复：失败可直接执行下一步动作。

- 代价
    - 后端实现复杂度上升。
    - 前端需要维护较复杂的状态机与样式体系。

## Risks / Mitigations

- 风险：`gh` 不可用或未登录。
    - 缓解：precheck 阶段前置检测并返回可操作提示。

- 风险：remote 结构不标准导致默认值不理想。
    - 缓解：defaults 可编辑；执行前仍做必填校验。

- 风险：UI 复杂度导致视觉不一致。
    - 缓解：compare 条、下拉面板、进度卡片统一样式基线并通过组件测试回归。

## Open Questions (Resolved)

- 是否默认开启评论步骤：已实现为前端开关控制，支持关闭。
- PR body 模板是否多模板：首版固定模板 + 可编辑。
- 失败后是否提供命令兜底：已通过 `retryCommand` 返回并支持复制。
