## ADDED Requirements

### Requirement: Message Markdown MUST Preserve Valid Inline LaTeX Structure During Normalization

消息区 Markdown 在进入 `remark-math` 前做正文归一化时，MUST 保持合法 inline LaTeX 的原始结构，不得因为括号包裹片段的宽松替换而破坏已有公式。

#### Scenario: inline formula with function-style parentheses remains intact

- **WHEN** 正文包含合法 inline LaTeX，例如 `$\\frac{d\\theta}{dt}=-\\nabla_\\theta \\mathcal{L}(\\theta)$`
- **THEN** 系统 MUST 保留 `\\mathcal{L}(\\theta)` 的括号结构
- **AND** 渲染结果 MUST NOT 出现由预处理引入的残留文本如 `\\theta$`

#### Scenario: prose-wrapped latex fragment still normalizes to inline math

- **WHEN** 正文包含由普通括号或全角括号包裹的独立 LaTeX 片段，例如 `（ \\bar{x}=\\frac{1}{n}\\sum x_i ）` 或 `( \\sigma(z)=... )`
- **THEN** 系统 SHOULD 将该独立片段归一为 inline math
- **AND** 该转换 MUST NOT 误伤前后相邻的非目标文本

### Requirement: Message Markdown MUST Recover Standalone Display Formulas Inside Prose

当正文中出现单独成行、结构明显的 LaTeX 公式时，消息区 Markdown MUST 将其送入 display math 渲染路径，而不是按普通文本残留。

#### Scenario: bare standalone latex line is rendered as display math

- **WHEN** 正文段落之间插入一行独立裸 LaTeX 公式，例如 `\\frac{d\\theta}{dt}=-\\nabla_\\theta \\mathcal{L}(\\theta)`
- **THEN** 系统 MUST 将该行作为 display math 渲染
- **AND** 用户 MUST NOT 看到原始公式红字或普通文本残留

#### Scenario: standalone multi-equation line keeps display layout

- **WHEN** 正文中单独一行包含多个 LaTeX 公式片段或 `\\qquad` 等 display-style 分隔
- **THEN** 系统 MUST 保持该行为 display math
- **AND** 不得把该行强行挤进普通段落 inline 流

### Requirement: Standalone Single-Line `$$...$$` MUST Render As Display Math In Message Markdown

消息区 Markdown 对正文中的单独单行 `$$...$$` MUST 视为 display math，而不是普通段落里的 inline math。

#### Scenario: single-line double-dollar block becomes display math

- **WHEN** 正文中存在单独成行的 `$$\\hat{R}(f)=...$$`
- **THEN** 系统 MUST 以 display math 方式渲染该公式
- **AND** 该公式 MUST 与前后正文保持独立块级阅读布局

### Requirement: Existing Latex Fenced Block Experience MUST Remain Backward Compatible

本次消息区正文 LaTeX 兼容性修复 MUST 不回退既有 `latex/tex` fenced block 预览与复制体验。

#### Scenario: latex fenced block still renders preview cards

- **WHEN** 用户消息包含 ` ```latex ` 或 ` ```tex ` fenced block
- **THEN** 系统 MUST 继续渲染专用 latex preview block
- **AND** 复制原文与围栏复制能力 MUST 保持可用
