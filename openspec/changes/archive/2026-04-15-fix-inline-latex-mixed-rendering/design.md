## Context

消息区 Markdown 当前采用两条数学链路：

1. 正文混排数学依赖 `remark-math + rehype-katex`。
2. `latex/tex` fenced block 走自定义 `LatexBlock` 预览。

问题出在正文进入 `ReactMarkdown` 之前的本地 normalizer：当前 `normalizeCommonMathDelimiters` 会把任何括号包裹的 LaTeX 命令片段都替换成 `$...$`，这在 `\mathcal{L}(\theta)`、`f(\theta_t)` 等合法表达式中会错误吃掉括号；同时正文中的“独立裸 LaTeX 行”与“单行 `$$...$$`”没有进入 display-math 归一化，导致 parser 只能把它们当普通文本或 inline math 对待。

这次设计的核心约束有三个：

1. 只动消息区 normalizer，不替换整体 Markdown 数学技术栈。
2. 修复必须是保守的，不能为了“猜公式”引入大面积误判。
3. fenced latex block 体验必须零回退。

## Goals / Non-Goals

**Goals:**

- 让合法 inline LaTeX 在正文混排时保持原义，不被括号归一化误伤。
- 让高概率的独立公式行自动进入 display math 路径，改善 AI 生成正文中的公式混排稳定性。
- 对正文中的单行 `$$...$$` 做 block 化归一，保持阅读布局正确。
- 通过目标测试把回归边界钉住。

**Non-Goals:**

- 不在本次实现中支持任意自然语言句内“猜测公式起止边界”。
- 不修改 file preview Markdown renderer。
- 不扩展 `LatexBlock` 的 fenced 语法和 UI 行为。
- 不为了这次修复引入新依赖或新 parser。

## Decisions

### Decision 1：对括号包裹 LaTeX 只做“边界感知”归一化

- 方案 A：保留现有全局正则，继续见到 `(\theta)` 就替换成 `$\\theta$`。
  - 优点：简单。
  - 缺点：会持续破坏 `\mathcal{L}(\theta)`、`f(\theta)` 等合法数学表达式，是当前主 bug 根因。
- 方案 B：只有当括号是 prose wrapper，而不是已有公式内部的函数/分组括号时才替换（推荐）。
  - 优点：能保住合法表达式，同时继续兼容 `（ \\bar{x}=... ）`、`( \\sigma(z)=... )` 这类 AI 常见包裹形式。
  - 缺点：需要额外边界判断。

取舍：采用方案 B。匹配时必须关注前置边界，避免在 `}`、字母、数字等公式延续位置上触发替换。

### Decision 2：新增“独立公式行”display-math 容错，而不是全句内联猜测

- 方案 A：对任何出现 LaTeX 命令的句中片段做自动 `$...$` 包裹。
  - 优点：理论覆盖面更大。
  - 缺点：误判风险极高，容易把普通文本或命令样式字符串误包成公式。
- 方案 B：只识别“单独成行、明显是公式结构”的裸 LaTeX 行，并转换成 `$$` block（推荐）。
  - 优点：规则更稳，与截图问题高度一致，能直接改善正文段落之间插入公式的场景。
  - 缺点：不覆盖所有句内裸公式。

取舍：采用方案 B。先把最常见、可稳定识别的 display-line 修好，而不是做泛化过强的句内猜测。

### Decision 3：把独立单行 `$$...$$` 统一归一成真正的 block math

- 方案 A：保持交给 `remark-math` 原样处理。
  - 优点：零新增代码。
  - 缺点：单行 `$$...$$` 在当前链路里容易落成 inline math，布局不稳定。
- 方案 B：对单独成行的单行 `$$...$$` 预先改写为多行 block 形式（推荐）。
  - 优点：输出语义明确，和用户对“正文里单独放一个公式”的预期一致。
  - 缺点：需要增加一个专用 normalizer。

取舍：采用方案 B。

## Risks / Trade-offs

- [Risk] 公式行识别过宽，误把普通文本包成 `$$` block。
  - Mitigation：要求“单独成行 + 含明显 LaTeX command / 结构符号 + 无明显自然语言 token”，并用测试覆盖反例边界。

- [Risk] 新 normalizer 与现有 list/image/resource normalizer 顺序冲突。
  - Mitigation：把数学兼容逻辑放在 math delimiter 归一化邻近位置，并保持仅处理 code fence 外文本。

- [Risk] 修复括号边界后，过去依赖宽松替换的一小部分输入可能不再自动转换。
  - Mitigation：保留对 `\(...\)` / `\[...\]` 和真正 prose wrapper 的支持；回归测试覆盖现有支持样例。

## Migration Plan

1. 收紧括号包裹 LaTeX 的替换边界，先解决合法公式被改坏的问题。
2. 新增独立公式行与单行 `$$...$$` 的 block 归一化函数。
3. 把新规则接入消息区 `content` 归一化链，并保持仅在 code fence 外生效。
4. 扩展数学渲染测试，覆盖 mixed-content 回归。

## Open Questions

- 后续如果要支持更激进的句内裸公式自动包裹，应单独开 change，并先定义更严格的误判容忍边界；这不阻塞本次修复。
