## ADDED Requirements

### Requirement: Sidebar sessions MUST display on a per-engine logo rail

工作区会话列表 MUST 按 rail 展示：左侧为 Shared + 各 native CLI 的 logo 轨，右侧只渲染当前轨的会话。Rail 身份 MUST 为 `shared` 或该行的 `engineSource`。空轨 MUST NOT 绘制。Shared 若有可见行 MUST 排在第一轨。

#### Scenario: user switches from Shared to Codex

- **WHEN** 工作区同时有可见 Shared 行与 Codex 行
- **AND** 用户点击 Codex logo
- **THEN** 右侧列表 MUST 只包含 Codex 会话（含子会话缩进）
- **AND** Shared 行 MUST NOT 出现在该列表中

#### Scenario: empty engine does not occupy a rail slot

- **WHEN** 工作区没有任何可见 Gemini 行
- **THEN** Gemini logo MUST NOT 出现在轨上

#### Scenario: Shared is the first rail when present

- **WHEN** 工作区有至少一条可见 `shared:` 行
- **THEN** Shared logo MUST 是轨上第一项

### Requirement: Engine rail selection MUST persist per workspace

当前轨 MUST 按 workspace 持久化。打开工作区时 MUST 恢复上次轨；若上次轨已无可见行，MUST 回退到 active thread 所属轨，否则 Shared（若有），否则第一条有行的轨。

#### Scenario: workspace remembers last rail

- **WHEN** 用户在 workspace A 选中 Claude 轨后切换到 workspace B 再回到 A
- **THEN** workspace A MUST 仍显示 Claude 轨（只要仍有可见 Claude 行）

### Requirement: Rail projection MUST reuse existing filter and tree rules

Rail 只缩小 `getThreadRows` 的输入集。系统 MUST 继续调用既有 Shared hide、下崽隐藏、`parentThreadId` 树、archive、hidden auto 投影。Rail MUST NOT 再实现一套 membership。

#### Scenario: Codex child stays indented on the Codex rail

- **WHEN** 当前轨是 Codex
- **AND** 一条 Codex 行带有 `parentThreadId` 指向同轨另一条可见父会话
- **THEN** child MUST 仍作为父会话缩进行出现

#### Scenario: Shared-owned native pup stays hidden after rail switch

- **WHEN** 一条 native 行的 parent 指向 Shared
- **AND** 用户切换到该 native 的 CLI 轨
- **THEN** 该行 MUST 仍被既有下崽隐藏规则排除
