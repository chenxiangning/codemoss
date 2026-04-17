## Why

实时对话时，幕布会持续追加 reasoning、tool 和 assistant 输出，用户刚刚发送的最后一条问题很快离开可视区。当前缺少一个稳定、低干扰的“用户输入镜像位”，导致用户需要频繁回滚幕布确认自己最后一次到底问了什么。

## 目标与边界

- 目标：
  - 在右下角现有 `dock` 状态面板中新增 `最新用户对话` Tab。
  - 多引擎统一支持，覆盖当前已接入底部状态面板的 `Claude / Codex / Gemini`。
  - 展示当前 active thread 的最后一条用户消息，并保留媒体占位信息；首期只保证图片数量占位可见，例如 `含 2 张图片`，其他附件类型不纳入本次交付。
  - 默认仅展示截断预览，用户可在面板内展开查看完整内容。
  - 保持手动查看入口语义，不自动切换到该 Tab。
- 边界：
  - 仅覆盖右下角 `dock` 状态面板，不扩展到输入框上方的 popover 状态面板。
  - 仅围绕当前 active thread 的最后一条用户消息做只读展示，不做多线程聚合。
  - 不修改幕布滚动机制、不新增跳回原消息定位、不改造右侧 `session activity` 面板。

## What Changes

- 在 `StatusPanel` 的 `dock` Tab 列新增 `最新用户对话` 入口，和现有 `任务 / 子代理 / 编辑 / Plan` 并列。
- 新增面向状态面板的只读 selector/view-model，用于提取当前线程最后一条用户消息文本，并拼接图片数量占位摘要。
- 内容区域默认展示前 `4` 行预览；当内容超限时提供显式“展开 / 收起”交互，完整内容在面板内部滚动查看。
- 当当前线程没有任何用户消息时，展示空态文案 `暂无用户对话`。
- 保持现有默认 Tab 选择策略与其他 Tab 访问方式不变，不因新能力自动抢焦点或切换面板。

## 非目标

- 不通过固定底部 Tab 以外的方式解决“幕布滚动”问题，例如自动锁定滚动、自动回卷、悬浮 banner。
- 不在本提案中新增“点击后跳回幕布原消息”“引用最后一条用户问题到输入框”等扩展交互。
- 不引入新的消息存储字段或跨线程缓存机制。
- 不在本次交付中新增非图片附件类型的结构化占位规则。
- 不把新逻辑直接堆入超大文件；`src/app-shell.tsx` 与 `src/features/layout/hooks/useLayoutNodes.tsx` 仅允许保留最小挂载级改动。

## 技术方案对比

### 方案 A：调整幕布滚动/锚点行为

- 做法：修改消息流滚动策略，让用户消息在流式阶段尽量保持可见。
- 优点：从主画布直接解决“看不见最后一问”的问题。
- 缺点：会触碰消息区滚动、虚拟列表和实时流式联动，是高风险改动；并且容易影响其他既有浏览行为，不符合“只围绕这个点做提案”的约束。

### 方案 B：在右下角 `dock` 状态面板增加只读镜像 Tab（推荐）

- 做法：复用现有状态面板容器，新增 `最新用户对话` Tab，展示最后一条用户消息的预览与展开内容。
- 优点：范围最小、侵入最低、可与现有工作流并存，不改变消息流和滚动链路；实现上可以复用现有“取最后一条用户消息”逻辑。
- 缺点：用户需要手动切换 Tab 查看，不能直接改变主幕布的可见性问题。

取舍：采用方案 B。这个问题的低风险解法不是改滚动系统，而是在稳定停靠区提供用户输入镜像。

## Capabilities

### New Capabilities

- `status-panel-latest-user-message-tab`: 定义右下角 `dock` 状态面板中“最新用户对话”Tab 的可见性、内容组织、截断展开与空态契约。

### Modified Capabilities

- 无。

## Impact

- Frontend
  - `src/features/status-panel/components/StatusPanel.tsx`
  - `src/features/status-panel/types.ts`
  - `src/features/status-panel/components/*`（建议新增独立只读内容组件，而不是继续膨胀 `StatusPanel.tsx`）
  - `src/features/session-activity/utils/sessionRadarPersistence.ts` 或等价共享 selector 文件
  - `src/styles/status-panel.css`
  - `src/i18n/locales/zh.part2.ts`
  - `src/i18n/locales/en.part2.ts`
- Tests
  - `src/features/status-panel/components/StatusPanel.test.tsx`
  - 新增 selector / preview 组装测试（如拆出独立 util）
- File governance
  - `src/app-shell.tsx` 当前约 `2975` 行，`src/features/layout/hooks/useLayoutNodes.tsx` 当前约 `1847` 行；本变更不得把业务逻辑继续内联到这两个文件。
  - 优先新增独立组件与纯函数 selector，主集成文件只保留参数透传与 Tab 挂载。

## 验收标准

- 右下角 `dock` 状态面板中必须出现 `最新用户对话` Tab，且支持 `Claude / Codex / Gemini` 一致可见。
- 新 Tab 仅作为手动查看入口，系统不得在新消息到来、线程重开或线程切换时自动切换到该 Tab。
- Tab 内容必须展示当前 active thread 的最后一条用户消息文本；若该消息含图片，必须展示数量占位信息，例如 `含 2 张图片`。
- 当预览内容超过默认限制时，面板必须默认只展示前 `4` 行，并提供显式“展开 / 收起”操作。
- 当当前线程不存在用户消息时，面板必须显示空态 `暂无用户对话`。
- 当用户切换到其他 thread 时，`最新用户对话` Tab 内容必须同步切换到新 thread 的最后一条用户消息，不得保留旧线程残留内容。
- 现有 `任务 / 子代理 / 编辑 / Plan` 的访问路径、默认激活逻辑和主要行为必须保持不变。
