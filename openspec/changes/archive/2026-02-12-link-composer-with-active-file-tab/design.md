## Context

已实现多文件 Tab 与 editor/composer 并存，但“提问上下文锚点”仍缺失。用户无法快速确认本次消息是否关联当前文件。

约束：

- 不变更后端消息结构；
- 不引入额外 command；
- 尽量在前端装配层和 Composer 局部完成。

## Goals / Non-Goals

**Goals:**

- Composer 持续显示 active file。
- 发送前自动附加文件路径引用（可开关）。
- 保持发送后可见反馈闭环。

**Non-Goals:**

- 不做行级引用与代码片段自动提取。
- 不做多文件聚合注入。

## Decisions

### Decision 1: 关联入口放在 Composer 内部，而非文件面板

- 原因：发送行为发生在 Composer，关联状态应贴近发送按钮。

### Decision 2: 注入格式使用 `@file \`path\``

- 原因：对用户可读、对模型清晰、且路径 code token 可在消息中保持可识别。

### Decision 3: editor 场景发送后自动切回 chat

- 原因：避免“已发送但看不到反馈”的感知错误。

## Risks / Trade-offs

- [风险] 用户误解为“强制注入”。
    - [缓解] 明确开关文案与状态。
- [风险] 长路径可读性差。
    - [缓解] 显示文件名 + title 展示完整路径。

## Migration Plan

1. 在 `useLayoutNodes` 透传 `activeComposerFilePath` 到 Composer。
2. Composer 增加关联条与开关状态。
3. 在 send/queue 阶段注入路径前缀。
4. editor 场景发送后切回 chat。
5. 样式与 i18n 文案补齐。

## Future

- 下一阶段扩展为 `@file \`path#Lx-Ly\`` 行级引用。
