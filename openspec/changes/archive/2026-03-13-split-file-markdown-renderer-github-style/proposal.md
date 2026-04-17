## Why

右侧文件树打开的 Markdown 文件目前复用了对话幕布的 Markdown 渲染组件，这条链路为了 AI 消息展示叠加了流式节流、碎段落修正、Mermaid 包装、消息态 code block 样式和文件链接增强等逻辑，不再是“文件原文预览”的保真渲染。  
现在需要把它拆开，因为文件预览的核心目标是稳定、保真、接近开发者熟悉的文档阅读体验；继续复用消息 renderer，会持续放大“聊天优化”与“文件预览”之间的语义冲突。

## 目标与边界

- 目标：为右侧文件树打开的 `*.md` / `*.mdx` 文件提供独立的 Markdown 预览渲染链路。
- 目标：文件预览采用 GitHub 风格的 Markdown 视觉基线，使标题、列表、表格、引用、代码块等结构接近开发者日常阅读体验。
- 目标：文件预览优先保证原文结构保真，不再继承聊天场景的段落拼接、碎行合并和消息态包装逻辑。
- 目标：明确文件预览与对话幕布的渲染边界，避免后续继续把两类需求耦合在同一个组件里演进。
- 边界：仅覆盖右侧文件树打开文件后的 Markdown 预览体验，不改变文件树多 Tab、文件打开/关闭、保存、代码文件预览等既有能力。
- 边界：本提案只定义文件预览 renderer 的职责边界与用户体验契约，不要求本次一并重做聊天消息区 Markdown 体系。

## 非目标

- 不修改对话幕布现有 `messages/components/Markdown` 的老结构渲染契约。
- 不重构消息区、Spec Hub、Project Memory、Release Notes 等已复用消息 Markdown 组件的消费方。
- 不在本次变更中新增 PDF、Office、富媒体等其他文件类型的专属 viewer。
- 不要求 100% 复刻 GitHub 全站样式或交互，只要求建立稳定的 GitHub 风格阅读基线。

## What Changes

- 新增文件预览专用 Markdown capability，定义“文件 Markdown 预览必须使用独立 renderer，而不是消息 renderer”的契约。
- 为文件视图中的 Markdown 预览定义 GitHub 风格的结构化阅读基线，包括标题层级、列表、引用、表格、代码块、链接和分隔线等常见元素。
- 要求文件 Markdown 预览遵循“原文优先”原则：不得为了聊天场景可读性而主动改写段落边界、列表缩进、碎行内容或普通文本结构。
- 明确文件预览与消息幕布的隔离规则：文件预览链路的样式、插件、组件覆盖和后续迭代不得反向污染消息区旧渲染。
- 将现有文件视图语言渲染 coverage capability 做增量修订，放宽对 `md` 文件“保持旧基线不变”的约束，改为允许 Markdown 文件按新专用 renderer 演进，同时保留其他文本文件的非回归要求。
- **BREAKING**：右侧文件树打开 Markdown 文件后的预览视觉与 DOM 结构将不再与消息幕布 Markdown 渲染保持一致；这是有意的能力拆分，但影响范围仅限文件预览场景。

## 技术方案对比

### 方案 A：继续复用消息 Markdown 组件，只做 GitHub 风格样式覆盖

- 优点：改动最小，短期上线快。
- 缺点：消息组件中的文本修正规则、Mermaid 包装和交互增强仍会继续进入文件预览，无法真正保证原文保真。
- 缺点：文件预览与消息区仍然强耦合，后续任一侧演进都容易带来隐式回归。
- 结论：不采纳。

### 方案 B：为文件视图引入独立 Markdown renderer，并单独定义 GitHub 风格样式基线

- 优点：边界清晰，文件预览可以围绕“保真阅读”设计，不再受聊天渲染历史包袱拖累。
- 优点：可以把消息区和文件区的演进节奏彻底拆开，降低跨场景回归风险。
- 缺点：需要新增专用组件、样式和测试，初期改动面比纯覆盖更大。
- 结论：采纳。

取舍：选择方案 B。这个问题的根因不是“样式不够像 GitHub”，而是“文件预览错误复用了聊天 renderer”；不拆链路，只换皮不会解决边界污染问题。

## Capabilities

### New Capabilities

- `file-view-markdown-github-preview`: 定义右侧文件树打开 Markdown 文件时的独立预览 renderer、GitHub 风格视觉基线，以及文件预览对原文结构保真的契约。

### Modified Capabilities

- `file-view-language-rendering-coverage`: 调整该 capability 中关于 `md` 文件的非回归表述，允许 Markdown 文件从通用消息 renderer 迁移到文件预览专用 renderer，同时继续要求非 Markdown 文本文件保持既有渲染稳定性。

## 验收标准

1. 当用户从右侧文件树打开 `*.md` 或 `*.mdx` 文件并切换到预览模式时，系统 MUST 使用文件预览专用 Markdown renderer，而不是消息幕布 Markdown renderer。
2. 文件预览中的 Markdown 呈现 MUST 具备稳定的 GitHub 风格阅读基线，至少覆盖标题、段落、列表、引用、表格、链接、分隔线和代码块。
3. 文件预览 renderer MUST 不再执行聊天场景专用的段落拼接、碎行合并、列表自动修正或类似“改写原文结构”的启发式逻辑。
4. 文件预览 renderer 的样式作用域 MUST 与消息幕布样式隔离，文件预览变更不得导致对话幕布旧结构渲染出现视觉或交互回归。
5. 对话幕布继续使用现有 `messages/components/Markdown` 时，其结构、交互和渲染行为 MUST 与本变更前保持一致，除非后续有独立提案明确修改。
6. 除 Markdown 文件外，既有文本/代码文件在文件视图中的预览与编辑行为 MUST 与变更前保持一致。
7. 至少应提供覆盖“文件 Markdown 预览新链路”和“消息幕布旧链路未回归”的验证记录。

## Impact

- Affected frontend:
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/messages/components/Markdown.tsx`
  - `src/styles/file-view-panel.css`
  - `src/styles/messages.css`
  - 预期新增文件预览专用 Markdown 组件与样式文件
- APIs / backend:
  - 无新增后端接口
  - 不修改文件读取、保存、截断或 binary 判定协议
- Dependencies:
  - 可能引入 GitHub 风格 Markdown 样式依赖，或在现有前端样式体系内实现等价视觉基线
- Systems:
  - 影响右侧文件树打开 Markdown 文件后的预览体验
  - 不影响对话幕布、Spec Hub、Project Memory、Release Notes 等现有消息 Markdown 消费链路
