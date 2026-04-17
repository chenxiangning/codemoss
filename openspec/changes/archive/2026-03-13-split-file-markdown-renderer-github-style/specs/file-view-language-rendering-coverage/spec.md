## MODIFIED Requirements

### Requirement: Additive-Only Delivery and Non-Regression Guard

本变更 MUST 采用新增优先策略；既有已支持文件类型的渲染行为不得被破坏或回退，但 Markdown 文件允许按照文件预览专用 renderer 的新契约演进。

#### Scenario: existing supported non-markdown languages remain unchanged after rollout

- **WHEN** 变更后打开既有支持且非 Markdown 的文件类型（如 `js`、`ts`、`json`、`css`、`yaml`）
- **THEN** 预览与编辑模式的渲染表现 MUST 与变更前基线一致
- **AND** 不得出现由本次扩展引入的高亮缺失或错误语言匹配

#### Scenario: markdown files adopt dedicated file-preview rendering

- **WHEN** 变更后打开 `md` 或 `mdx` 文件并进入文件预览模式
- **THEN** 系统 MUST 允许该预览偏离变更前基于消息 renderer 的 Markdown 视觉基线
- **AND** 该偏离 MUST 仅来自文件预览专用 Markdown renderer 的有意能力拆分
- **AND** Markdown 文件的源码编辑链路 MUST 保持与统一语言判定规则兼容

#### Scenario: unknown file types fall back safely to plain text

- **WHEN** 用户打开未被语言规则覆盖的文件类型
- **THEN** 系统 MUST 回退为纯文本渲染
- **AND** 回退过程 MUST 不触发崩溃、空白渲染或未捕获异常
