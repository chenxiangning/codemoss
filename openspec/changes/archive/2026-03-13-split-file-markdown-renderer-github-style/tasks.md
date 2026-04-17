## 1. 入口分流与边界隔离

- [x] 1.1 清点 `FileViewPanel`、消息幕布及其他 Markdown 消费点，确认本次仅替换右侧文件树 Markdown preview 入口，输出受影响/不受影响清单
- [x] 1.2 在文件视图模块下新增专用 `FileMarkdownPreview` 组件骨架与命名空间样式入口，确保其不依赖 `messages/components/Markdown` 作为渲染入口
- [x] 1.3 将 `FileViewPanel` 的 `md/mdx` preview 分支切换到 `FileMarkdownPreview`，保持 Source/Edit 与其他文本/代码文件链路不变

## 2. 文件预览 Markdown 渲染实现

- [x] 2.1 为 `FileMarkdownPreview` 接入文件预览所需的 Markdown parser/sanitize/GFM 能力，并移除聊天场景的段落拼接、碎行合并、列表修正等启发式逻辑
- [x] 2.2 定义 `mdx` 的受控处理策略，保证不支持的 MDX-only 语法不会回退到消息 renderer，且失败行为可预期
- [x] 2.3 保留文件预览所需的代码块、链接、表格等基础可读性能力，避免继承消息幕布专属的 wrapper、控制条或 Mermaid 包装

## 3. GitHub 风格样式基线

- [x] 3.1 为文件预览建立独立的 GitHub 风格排版样式命名空间，覆盖标题、段落、列表、引用、表格、分隔线与代码块
- [x] 3.2 校准文件预览在浅色/深色主题下的可读性、滚动与溢出表现，避免直接污染 `messages.css`
- [x] 3.3 验证 Markdown 文件视觉变化只发生在文件预览场景，消息幕布、Spec Hub、Release Notes 等旧消费方不受样式外溢影响

## 4. 非回归测试与验证

- [x] 4.1 为文件视图补充测试，断言 `md/mdx` preview 使用专用 renderer，且非 Markdown 文件继续走既有预览/编辑链路
- [x] 4.2 为消息幕布补充或更新非回归测试，断言其继续使用旧 renderer 且结构/交互未被本次拆分破坏
- [x] 4.3 执行最小验证集（相关单测、必要的 typecheck、手工打开 Markdown 文件检查标题/列表/表格/代码块/blockquote），记录结果与已知边界
