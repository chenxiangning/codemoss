# Design: refine-browser-excerpt-curtain-and-locate

## Context

网页摘录已有选择器脚本、`BrowserContextAttachment` v2 与 `formatBrowserContextPrompt`。发送后摘要卡与 composer 预览是蓝边卡片，点选每次 `selectedAt` 生成新 id，prompt 只有视口 `bounds`。用户选定 V3 细线折叠，并要求模型能「指哪打哪」。截图默认不进模型（visual evidence opt-in）。

## Goals / Non-Goals

**Goals:**

- 幕布与 composer 共用细线折叠，默认一行标题，点行出全文与发送细节
- 重复选择按文案+选择器去重
- 选择器吸附内容块，浮层保留 programmer debug
- prompt 选择块携带文档坐标、列表序号、邻居、cssPath，并声明指哪 hint

**Non-Goals:**

- 选区 crop / 模型图像 payload
- 稳定 xpath / 元素 id 执行通道
- Dock tab 右键菜单等无关改动

## Decisions

### D1. 展示层抽 `BrowserExcerptFold`

- **选择**：composer 预览与幕布摘要共用 fold 组件
- **备选**：两套平行 UI
- **理由**：避免预览/发送后再长成两种形态

### D2. 去重键 = `selectorHint + normalized text`

- **选择**：原地替换最新 annotation；展示/prompt 再做 keep-first
- **备选**：只按 annotationId；或只按像素盒子
- **理由**：重复点击是同一文案同一选择器；像素会抖 1px

### D3. 位置意图用文本 locate，不发图

- **选择**：`BrowserSelectionLocate`（documentX/Y、viewportBox、inList、previous/next、ancestor、cssPath）写入 annotation 与 `copySafeText`
- **备选**：选区截图进模型
- **理由**：现有视觉门禁默认禁 annotated screenshot；邻居+文档坐标对语言模型更可消费

### D4. 选择器先 promote 到内容块

- **选择**：`promoteToContentUnit` 吸附 p/li/heading/button/link，惩罚 ul/html/section
- **备选**：继续 elementsFromPoint 最深节点
- **理由**：摘录要的是可读块，不是 span

### D5. 旧数据回推

- **选择**：无 `locate` 时用 `region + viewport.scroll*` 填 documentPosition
- **理由**：历史消息展开仍能看到坐标，不强制用户重选

## Risks / Trade-offs

- [Risk] 细线折叠改变 composer-control-surface「蓝卡 chips」字面 → Mitigation：delta spec 改展示形态，保留 refresh/remove 与 expired 可辨识
- [Risk] cssPath/`nth-of-type` 在 DOM 重排后漂移 → Mitigation：prompt 以 text + previous/next 为主，路径为辅；usageHint 写明
- [Risk] 邻居文案含密钥 → Mitigation：走既有 `sanitizeAnnotationText`
- [Risk] pointermove 选择器更重 → Mitigation：只在 selector mode 注入；promote 深度 ≤8；无截图/无每帧 IPC
- [Risk] 工作区混入 Dock tab 菜单 diff → Mitigation：commit 白名单只收摘录相关文件

## Migration Plan

- 向前兼容：`locate` 可选；旧 annotation 回推坐标
- 回滚：还原 fold 组件与 toolbar 选择器脚本即可；已发送消息仍可读旧摘要

## Open Questions

- 选区 crop 是否单独立项（需视觉门禁与用户确认）
- composer 预览是否允许单条删除（V4 chip）；本期不做
