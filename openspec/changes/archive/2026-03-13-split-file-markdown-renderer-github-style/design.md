## Context

当前右侧文件树打开 Markdown 文件后的预览链路，直接复用了对话幕布使用的 `messages/components/Markdown`。这套组件最初服务的是 AI 消息渲染，因此内置了流式节流、碎段落修正、碎行拼接、消息态 code block 样式、Mermaid 包装和文件链接增强等行为。

对聊天消息来说，这些能力是“容错增强”；但对文件预览来说，它们会把“原文保真”目标冲淡，导致文件视图逐步继承消息场景的历史包袱。用户现在明确要求：

- 右侧文件树打开的 Markdown 文件必须单独走一套 renderer
- 视觉基线要接近 GitHub Markdown
- 对话幕布的老结构渲染不能被本次改动带偏

该变更是前端局部架构拆分，不涉及 Tauri command、文件读写协议或数据模型变更，但它跨越文件视图组件、共享 Markdown 组件、样式作用域和回归测试，因此需要先把边界设计讲清楚。

## Goals / Non-Goals

**Goals:**
- 在文件视图中引入独立的 Markdown 预览组件，切断对消息 Markdown 组件的直接复用。
- 为文件预览建立 GitHub 风格的结构化阅读基线，同时保持桌面应用场景下的主题与滚动可用性。
- 保证文件预览遵循“原文优先”，不做聊天场景那类自动修正文案结构的启发式处理。
- 将文件预览样式严格约束在文件视图命名空间内，确保消息区旧渲染零回退。
- 为“文件预览新链路”和“消息区老链路”同时补充验证，形成双向哨兵。

**Non-Goals:**
- 不重构消息区 Markdown 组件内部实现。
- 不统一 Spec Hub、Project Memory、Release Notes 等其它 Markdown 消费方。
- 不引入新的文件类型 viewer，也不改变文件树、Tab、保存、代码预览链路。
- 不要求本次实现 GitHub 网站的全量交互细节，只聚焦 Markdown 阅读呈现。

## Decisions

### Decision 1: 在 File View 边界切断复用，而不是改造共享 Markdown 组件

- 选择：在 `FileViewPanel` 的 Markdown 预览分支引入独立组件，例如 `FileMarkdownPreview`，由文件视图直接调用；消息区继续保留 `messages/components/Markdown`。
- 原因：这是最清晰的架构切点。文件视图与消息区从入口处分流，后续各自演进互不牵连。
- 备选方案：继续使用共享 `Markdown` 组件，通过 prop 开关区分 `mode="file"` 与 `mode="message"`。
- 不选原因：共享组件会继续累积场景分支，边界仍然模糊，回归风险只是被隐藏，没有被消除。

### Decision 2: 文件预览专用 renderer 继续复用成熟 parser，但禁用消息场景启发式修正

- 选择：文件预览专用组件可继续使用成熟 Markdown 解析栈（如现有 `react-markdown` + `remark-gfm` + sanitize 能力），但不复用消息组件中的文本修正、流式节流、Mermaid 包装、消息态 code block 渲染逻辑。
- 原因：问题根因是“场景逻辑耦合”，不是底层 parser 不可用。复用成熟 parser 可以控制改动面，同时把真正有害的消息启发式隔离掉。
- 备选方案：完全换掉当前 parser 栈，重做一套新的 Markdown 渲染技术选型。
- 不选原因：收益不确定，但迁移成本和回归面会明显扩大，不符合这次“拆边界、保回归”的目标。

### Decision 3: GitHub 风格通过文件视图专用样式基线实现，并使用独立命名空间

- 选择：文件预览使用独立样式作用域，例如 `fvp-markdown-github` 或等价命名空间，围绕标题、段落、列表、表格、blockquote、code block、horizontal rule 建立 GitHub 风格基线。
- 原因：GitHub 风格本质是结构化排版契约，核心是可读性和熟悉感，而不是把消息区样式继续 patch 成“像 GitHub”。
- 备选方案：直接在 `messages.css` 上覆盖，或把 GitHub 风格类名混入现有消息 Markdown 样式。
- 不选原因：消息区与文件区再次共享样式表，会重新引入污染路径，违背本次拆分目标。

### Decision 4: 对话幕布旧 renderer 视为受保护基线，不在本 change 内做语义重排

- 选择：本次 change 将消息幕布现有 `messages/components/Markdown` 视为受保护旧链路，只允许文件视图脱钩，不允许顺手修改消息渲染语义。
- 原因：用户已经明确把“不要影响对话幕布老结构渲染”作为边界要求；这需要在设计层面被提升为硬约束，而不是实现时的善意承诺。
- 备选方案：借拆分机会顺手清理消息组件内部逻辑。
- 不选原因：会把一个局部边界变更升级成跨场景重构，风险与验证成本都会失控。

### Decision 5: 非回归验证分为“新链路正确”和“老链路未变”两条独立哨兵

- 选择：测试与验证必须同时覆盖：
  - 文件 Markdown 预览使用新组件
  - 消息幕布继续使用旧组件且结构未回退
- 原因：只验证新链路“能工作”是不够的，本次 change 的真正风险在于“拆分时不小心把旧链路带坏”。
- 备选方案：只给文件视图加测试。
- 不选原因：无法约束最关键的边界目标，容易出现“功能达成但幕布回退”的假阳性。

### Decision 6: Markdown 文件的专用 renderer 仅作用于 Preview，不改变 Source/Edit 链路

- 选择：本次专用 renderer 只替换 Markdown 的 preview 分支；源码编辑、保存、语言识别和其他文本/代码文件处理逻辑保持原链路。
- 原因：这样能把变更面收缩在最核心的问题点上，降低回归概率。
- 备选方案：连 Markdown 编辑态、切换逻辑、工具栏行为一起大改。
- 不选原因：会把“预览拆分”扩展成“文件模块重构”，超出本次边界。

## Risks / Trade-offs

- [Risk] 文件预览样式做得过像网页，和桌面应用整体视觉脱节。  
  → Mitigation: 以 GitHub 为阅读基线，而不是 1:1 复刻页面容器；仅复用 typography / block / table / code block 规则。

- [Risk] 文件预览专用组件仍然暗中复用消息样式或消息逻辑，造成“名义拆分、实质未拆”。  
  → Mitigation: 在入口组件、样式命名空间和测试断言三层都建立明确分界。

- [Risk] Markdown 预览去掉启发式修正后，一些原本为聊天内容兜底的表现会消失。  
  → Mitigation: 将“原文保真优先”定义为文件预览原则；聊天场景需要的容错继续留在消息链路。

- [Risk] `*.mdx` 文件可能包含 JSX/表达式，GitHub 风格 preview 无法完整等价渲染。  
  → Mitigation: 先把 `md` 作为主路径，`mdx` 在无法安全渲染时提供受控 fallback 或保守行为，并在 specs 中写明。

- [Risk] 为了追求 GitHub 风格而引入新的样式依赖，可能带来体积和维护成本。  
  → Mitigation: 将视觉契约封装在文件预览专用样式层，优先复用现有依赖；若新增依赖，限定在单一文件视图命名空间内。

- [Risk] 仅修改文件视图入口时，遗漏了其它地方对共享 Markdown 组件的隐式耦合。  
  → Mitigation: 在实现前先做调用点清点，在任务与验证阶段显式列出受影响与不受影响消费方。

## Migration Plan

1. 在文件视图下新增 Markdown 预览专用组件与对应样式作用域。
2. 将 `FileViewPanel` 中 Markdown preview 分支切换到新组件，保留源码编辑链路不变。
3. 在 specs 中补齐“文件视图专用 renderer”和“消息幕布非回归”的 requirement。
4. 为文件预览和消息幕布分别补测试，形成双哨兵。
5. 完成手工验证：文件树打开 Markdown、切换 preview、查看表格/代码块/blockquote，并同时回归消息幕布旧渲染。
6. 若发现文件预览新链路引发非预期回归，可直接回滚 `FileViewPanel` 的调用点，恢复到旧共享 renderer；该回滚不涉及后端协议与数据迁移。

## Open Questions

- `*.mdx` 的目标策略要多保守：是尽量渲染 Markdown 子集，还是遇到 JSX 时直接提示仅支持源码预览？
- GitHub 风格在深色主题下是否采用“GitHub dark-like”基线，还是保持应用现有深色 token 但沿用 GitHub 排版结构？
- 文件预览是否需要保留 raw HTML 渲染能力；如果保留，sanitize 白名单的边界应收紧到什么程度？
- 代码块是否需要沿用当前 Prism 高亮，还是为文件预览引入更贴近 GitHub 的高亮样式映射？
