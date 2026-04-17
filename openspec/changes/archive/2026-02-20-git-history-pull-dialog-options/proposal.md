## Why

当前 Git History 顶部联排按钮里，`拉取/同步/获取/刷新` 仍以一键直执行为主。
其中 `同步`（先 pull 再 push）属于高影响动作，但缺少执行前意图确认；`获取` 与 `刷新` 也缺少对“会做什么/不会做什么”的明确说明，导致误点后的结果不可预期。

## 现状核对（基于代码）

- `src/features/git-history/components/GitHistoryPanel.tsx` 中，顶部 `拉取/同步/获取/刷新` 仍为点击即执行（
  `runOperation(...)`），不存在确认弹窗。
- `src/services/tauri.ts` 中 `pullGit(workspaceId)` 目前仅接受 `workspaceId`，尚未支持 `remote/branch/options` 参数化
  payload。
- 顶部 `Fetch` 与 `Refresh` 当前均使用 `RefreshCw` 图标，语义区分度不足。
- 当前代码不存在 `Pull/Sync/Fetch` 的独立操作快捷键；设置页仅包含面板级快捷键（如 `toggleGitSidebar`）。

## 目标与边界

- 目标
    - 将顶部 `拉取/同步/获取/刷新` 全部升级为二段式：先打开确认弹窗，再执行。
    - 每个弹窗必须详细说明本次确认的意图：
        - 将执行什么动作（Intent）
        - 会发生什么（Will Happen）
        - 不会发生什么（Will NOT Happen）
        - 示例说明（Example）
    - 四个动作必须具备清晰且互不混淆的 icon 语义映射；按钮与对应弹窗标题 icon 保持一致。
    - 弹窗视觉必须达到“信息分层清晰、主次明确、状态可感知”的质量标准（非仅功能可用）。
    - `拉取`新增参数化配置（remote/target/options + chips + 互斥约束）。
    - 默认参数下的执行语义保持与当前行为一致。
- 边界
    - 改造 Git History 顶部联排按钮组中的 `拉取/同步/获取/刷新`。
    - 本次不新增 `Pull/Sync/Fetch` 操作快捷键。
    - 本次不改造分支右键菜单中的 `Update` 行为。
    - 不改变 `推送` 既有二段式交互。
    - 不追求 JetBrains 对应弹窗的像素级一致，只要求语义与风险提示清晰。

## 非目标

- 不新增独立页面（Pull/Sync/Fetch/Refresh 页）。
- 不引入复杂自动化工作流（如自动冲突解决、自动 rebase 编排）。
- 不重构提交历史主布局与 diff 面板。

## What Changes

- 顶部四个按钮统一 confirmation-first：
    - `拉取`：打开 Pull Dialog，确认后执行 `pull_git`。
    - `同步`：打开 Sync Dialog，确认后执行 `sync_git`（先 pull 后 push）。
    - `获取`：打开 Fetch Dialog，确认后执行 `git_fetch`（默认 `--all`）。
    - `刷新`：打开 Refresh Dialog，确认后执行 `refreshAll`（仅刷新界面数据，不发起 Git 网络命令）。
- 若后续新增 `拉取/同步/获取` 快捷键，必须复用同一“先确认后执行”链路，禁止绕过弹窗。
- 所有二段式弹窗统一包含“意图说明区”：
    - Intent
    - Will Happen
    - Will NOT Happen
    - Example
- 所有二段式弹窗统一包含“视觉规范约束”：
    - 操作标题区显示对应 icon + 标题 + 影响等级（如高影响/只读刷新）。
    - Intent/Will Happen/Will NOT Happen/Example 四段采用统一卡片样式与层级对比。
    - 确认按钮需与操作语义色彩一致；取消按钮保持中性。
- `拉取`弹窗新增参数化能力：
    - `remote` + `target remote branch`（下拉 + 手写）
    - `Modify Options` + 已选 chips
    - 策略组选项互斥（`--rebase` / `--ff-only` / `--no-ff` / `--squash`）
    - 附加选项可叠加（`--no-commit` / `--no-verify`）
- `同步`弹窗新增 Preflight 摘要区：
    - 目标摘要：`sourceBranch -> remote:targetBranch`
    - ahead/behind 计数
    - 待推送提交示例（最多前 5 条）
- `获取`弹窗明确展示本次 fetch 作用域（默认 `all remotes`）。
- 取消/关闭任意弹窗不产生副作用；确认后才执行。

## Icon 映射约束

- 拉取（Pull）：`Download`
- 同步（Sync）：`Repeat`
- 获取（Fetch）：`CloudDownload`
- 刷新（Refresh）：`RefreshCw`
- 约束：`Fetch` 与 `Refresh` 不得复用同一图标；仅在组件库不可用时允许 fallback，并需在验收记录中注明。

## 示例说明（弹窗内文案示例）

- 拉取（Pull）
    - Intent: 把远端变更集成到当前分支
    - Will Happen: 运行 `git pull origin cXN/feat-002 --rebase`（示例）
    - Will NOT Happen: 不会主动 push 到远端
- 同步（Sync）
    - Intent: 先接收远端，再把本地提交推送上去
    - Will Happen: 运行 `git pull` 后再 `git push`（示例）
    - Will Happen: 预览区显示 `ahead 3 / behind 1` 与将推送的提交摘要（示例）
    - Will NOT Happen: 不会修改你选择的 pull 策略参数（除非另设）
- 获取（Fetch）
    - Intent: 更新远端引用信息用于比对
    - Will Happen: 作用域显示为 `all remotes`，并运行 `git fetch --all`（示例）
    - Will NOT Happen: 不会合并到当前分支，不会改动工作区文件
- 刷新（Refresh）
    - Intent: 重新拉取面板展示数据
    - Will Happen: 刷新分支、工作区状态、历史和详情数据（示例）
    - Will NOT Happen: 不会执行 pull/push/fetch 等 Git 网络写操作

## 技术方案对比

### 方案 A：继续一键执行，仅增加 tooltip 提示

- 优点：开发成本最低。
- 缺点：风险动作仍无确认闸门，提示容易被忽略，无法承载“会发生/不会发生”的结构化说明。
- 结论：不采纳。

### 方案 B：统一二段式弹窗框架 + 操作特化内容（采纳）

- 优点：交互一致、风险可控、可扩展；每个动作可精准描述意图与后果。
- 缺点：每个按钮增加一次确认点击。
- 结论：采纳。

### 方案 C：仅高风险动作（二段式）覆盖 pull/sync，fetch/refresh 保持直连

- 优点：点击成本更低。
- 缺点：交互模型不一致，用户仍难快速区分 fetch 与 refresh 的效果边界。
- 结论：不采纳。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `git-history-panel`: `拉取/同步/获取/刷新` 入口统一改为 confirmation-first，并新增“意图说明 + 示例”弹窗内容规范。
- `git-operations`: `pull/sync/fetch` 从直接触发升级为“确认后执行”，并保持默认行为兼容。

## Impact

- 前端
    - `GitHistoryPanel` 新增三类弹窗（Sync/Fetch/Refresh）及统一意图说明区组件。
    - Pull Dialog 扩展意图说明区；四类弹窗共享确认/取消与执行态约束。
    - 新增统一 icon 映射表与弹窗视觉规范（标题区、说明区、操作区）。
    - 增补 i18n 文案（Intent/Will Happen/Will NOT Happen/Example + 操作级说明）。
- 后端 / Tauri
    - `pull_git` 扩展为可选参数化执行；默认空参数路径保持当前语义兼容。
    - `sync_git`/`git_fetch` 保持接口语义但改由弹窗确认后触发。
- 测试
    - 四个按钮的二段式交互测试。
    - Pull 参数映射、选项互斥和默认兼容回归。
    - Sync/Fetch/Refresh “确认前不执行”与“文案语义完整性”测试。

## 验收标准

- 点击 `拉取/同步/获取/刷新` 任一按钮时，必须先打开对应确认弹窗，不得直接执行。
- 每个弹窗必须包含 `Intent / Will Happen / Will NOT Happen / Example` 四段说明。
- 取消或关闭弹窗不得触发任何对应操作。
- `拉取`弹窗必须保留 options chips 与互斥禁用规则。
- `同步`确认后必须执行“先 pull 后 push”流程。
- `同步`弹窗必须在确认前展示 Preflight 摘要（目标分支、ahead/behind、待推送提交示例）。
- `获取`确认后必须执行 fetch，且不触发 merge。
- `获取`弹窗必须清晰展示 fetch 作用域（默认 `all remotes`）。
- `刷新`确认后必须仅刷新 UI 数据，不触发 pull/push/fetch 网络命令。
- 四个动作按钮与对应弹窗标题必须展示 icon，且 `Fetch` 与 `Refresh` icon 明确区分。
- 弹窗必须通过 UI 视觉验收：信息层级清晰、关键风险语义可识别、按钮主次明确。
- 弹窗视觉验收必须满足量化标准：
    - 文本对比度满足 WCAG AA（普通文本 ≥ 4.5:1）。
    - 说明区四段采用一致标题层级与间距（段间距 token 固定，不得混用）。
    - 关键风险信息需在首屏可见，不得被折叠到滚动区域外。
- 至少完成以下自动化验证：
    - 四按钮二段式交互测试
    - pull 参数映射与冲突校验测试
    - typecheck + vitest + cargo check
