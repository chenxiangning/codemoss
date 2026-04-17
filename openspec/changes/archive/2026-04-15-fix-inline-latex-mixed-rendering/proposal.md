## Why

当前消息区 Markdown 已接入 `remark-math + rehype-katex`，但正文混排场景仍然存在两类稳定性问题：一类是已有合法 LaTeX 表达式会在预处理阶段被错误改写，典型表现为 `\mathcal{L}(\theta)` 被改成 `\mathcal{L}$\theta$`；另一类是 AI 输出里常见的“独立裸 LaTeX 行”或单行 `$$...$$` 在正文中不能稳定落到 display math 路径，导致正文与公式混排时出现红字、残片或内联错位。

## 目标与边界

- 目标：
  - 修复消息区正文混排时的 LaTeX 预处理误改写，保证合法行内公式不会被归一化逻辑破坏。
  - 为正文中的独立 LaTeX 公式行提供保守容错，让常见 AI 输出在不手动补 fence 的情况下也能稳定渲染。
  - 保持现有 `latex/tex` fenced block 预览、复制与 KaTeX 样式能力不回退。
  - 通过回归测试覆盖“正文 + 行内公式 + 独立公式行 + fenced latex”四类关键路径。
- 边界：
  - 仅覆盖消息区 `src/features/messages/components/Markdown.tsx` 的渲染预处理链。
  - 不修改 file preview 的 Markdown 渲染器，也不把本次规则外溢到编辑器或文件视图。
  - 不尝试把所有非规范 LaTeX 都自动修复；首期只处理高概率、可稳定识别的 mixed-content 场景。

## What Changes

- 收紧正文中“括号包裹 LaTeX 片段”的归一化规则，只在真正的 prose wrapper 场景下将 `(\theta)` / `（\theta）` 等转换为 `$...$`，避免破坏 `\mathcal{L}(\theta)` 这类合法表达式。
- 为正文中的“独立裸 LaTeX 行”增加 display-math 容错：当单独一行显著呈现 LaTeX 公式结构时，将其归一为 `$$` block 再交给 `remark-math`。
- 为正文中的“独立单行 `$$...$$`”增加 block 归一化，避免它被当作 inline math 挤进段落流中。
- 补充数学渲染回归测试，覆盖合法 inline math、裸公式行、单行 `$$...$$` 与 fenced latex block。

## 非目标

- 不新增新的数学渲染库，不替换 `remark-math` / `rehype-katex` 主链路。
- 不实现激进的“全文 LaTeX 猜测修复”，例如从任意自然语言句子中自动截取疑似公式子串。
- 不改变消息区除数学渲染外的 Markdown 结构改写策略，例如 link/image/mermaid 规则。
- 不调整 file preview 的 GitHub-style Markdown 能力和相关 spec。

## 技术方案对比

### 方案 A：仅调整 `remark-math` / `rehype-katex` 插件顺序或参数

- 做法：尝试仅通过插件顺序、`singleDollarTextMath` 等配置修正正文混排问题。
- 优点：改动面小，不新增预处理规则。
- 缺点：无法解决当前真正的根因，即本地 normalizer 在进 parser 前已经把合法公式字符串改坏；同时也无法把裸 LaTeX 独立行自动送入 display math 路径。

### 方案 B：保留现有插件链，在文本归一化阶段补“边界感知 + 保守容错”（推荐）

- 做法：收紧 `normalizeCommonMathDelimiters` 的匹配边界，避免误伤公式内部括号；同时新增针对独立公式行和单行 `$$...$$` 的保守 display-math 归一化。
- 优点：直接针对根因，改动范围限定在消息区 Markdown 预处理层；可以保持现有 fenced latex、mermaid、image 等链路不动。
- 缺点：需要维护额外的文本启发式规则，并通过测试压住误判风险。

取舍：采用方案 B。这个问题不是渲染器不会算，而是进入渲染器之前的字符串已经被改坏，因此必须在 normalizer 层做语义更精确的修复。

## Capabilities

### New Capabilities

- `message-markdown-latex-compatibility`: 约束消息区 Markdown 在正文与 LaTeX 公式混排时的边界安全、display 容错与回归兼容性。

### Modified Capabilities

- 无。

## Impact

- Frontend
  - `src/features/messages/components/Markdown.tsx`
  - `src/features/messages/components/Markdown.math-rendering.test.tsx`
- Styling
  - 预期无需新增样式；若需要，仅允许最小 CSS 微调，且不得影响既有 fenced latex block 视觉。
- Risks
  - 文本启发式过宽会误把非公式行包进 `$$` block。
  - 过窄则无法覆盖当前 AI 输出里最常见的裸公式行。

## 验收标准

- 合法行内公式如 `$\\frac{d\\theta}{dt}=-\\nabla_\\theta \\mathcal{L}(\\theta)$` 在消息区 MUST 完整渲染，不得出现由预处理引入的残留文本如 `\\theta$`。
- 正文中的独立裸 LaTeX 公式行在满足保守识别条件时 MUST 进入 display math 渲染，而不是以原始红字或普通文本残留。
- 正文中的独立单行 `$$...$$` MUST 以 display math 方式渲染，不得挤入普通段落流。
- 现有 `latex/tex` fenced block 预览与复制路径 MUST 保持可用。
- 目标回归测试 MUST 覆盖上述场景并通过。
