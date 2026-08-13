# feature-style-surface-ownership Spec Delta

## ADDED Requirements

### Requirement: 延迟 CSS MUST 由可见宿主表面加载

冷启动从 `bootstrap.ts` 卸出的 feature CSS SHALL 由真正渲染该 class 的表面调用对应 `load*Styles` / `useFeatureStylesReady`。禁止只把加载点挂在未同时挂载的兄弟表面。

#### Scenario: Shared Composer 未开 Inspector 也能拿到协作弹层样式
- **WHEN** 用户在 Shared 会话打开协作 pill，且本会话从未打开子代理 / 协作 Inspector
- **THEN** `MultiAgentComposerToggle` MUST 调用 `loadSubagentStyles`
- **AND** 模板 portal 与模板管理弹窗 MUST 等到 `stylesReady` 再绘制
- **AND** `bootstrap.ts` MUST NOT 静态 `import "./styles/multi-agent.css"`

#### Scenario: Git Diff 弹窗不依赖 Status Panel 拿导航壳
- **WHEN** 用户冷启动后直接打开 Git / History Diff 弹窗，且从未打开 Status Panel
- **THEN** `loadDiffStyles` MUST 加载 `editable-diff-compare-nav.css` 与 `editable-diff-review-shell.css`
- **AND** MUST NOT 加载整包 `status-panel.css` 或 `status-panel-checkpoint-diff.css`

### Requirement: 延迟切片 MUST NOT 把无关 feature 布局泄漏到其它表面

`loadDiffStyles` 拉入的 CSS SHALL 只覆盖 Git Diff 弹窗需要的导航壳与 review 布局。Checkpoint 特有的 compare overflow / min-width / modal size SHALL 留在 `.checkpoint-diff-modal` 作用域。

#### Scenario: 双栏 Git Diff 不被 checkpoint compare 布局抢走滚动层
- **WHEN** Git Diff 弹窗处于双栏 compare
- **THEN** 全局 `.editable-diff-compare { height: 100%; overflow: hidden }` MUST NOT 来自 `loadDiffStyles` 切片
- **AND** CodeMirror scroller MUST 仍能作为双栏纵向滚动层
