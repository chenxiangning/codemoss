## 1. 数学 normalizer 根因修复（P0）

- [x] 1.1 收紧括号包裹 LaTeX 片段的归一化边界，仅在 prose wrapper 场景下把 `(\theta)` / `（\theta）` 转成 inline math；验证：补充回归测试，覆盖 `$\\mathcal{L}(\\theta)$` 不被破坏，以及 `（ \\bar{x}=... ）` 仍可渲染。
- [x] 1.2 新增“独立裸 LaTeX 行”识别与 block 化归一，保证正文段落之间的公式行进入 display math；验证：补充测试覆盖单公式行与多公式行（含 `\\qquad`）。
- [x] 1.3 新增“独立单行 `$$...$$`”的 block 归一化，避免其被当成 inline math 挤进段落；验证：补充测试覆盖单行双美元公式的 display 渲染断言。

## 2. 消息区渲染链接入与兼容（P0）

- [x] 2.1 将新数学兼容逻辑接入 `Markdown.tsx` 的正文 normalizer 链，并保持仅在 code fence 外生效；验证：现有 link/image/mermaid/latex fenced block 路径不受影响。
- [x] 2.2 保持 `latex/tex` fenced block 的专用 `LatexBlock` 行为不回退；验证：现有 fenced latex 测试继续通过。

## 3. 回归验证（P1）

- [x] 3.1 扩展 `Markdown.math-rendering.test.tsx`，覆盖合法 inline formula、正文裸公式行、单行 `$$...$$` 与 fenced latex 四类场景；验证：目标测试文件通过。
- [x] 3.2 运行最小验证，确认类型与受影响测试通过；验证：`npx vitest run src/features/messages/components/Markdown.math-rendering.test.tsx` 通过，如无额外类型改动则至少保证受影响 TS 文件无新增类型错误。
