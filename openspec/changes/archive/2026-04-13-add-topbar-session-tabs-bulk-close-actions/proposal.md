## Why

当前顶部会话 tabs 已经解决了“快速切换已打开会话”的问题，但只提供单个 `X` 关闭入口。会话一多，用户想像 IDE 一样做“关闭左侧 / 关闭右侧 / 关闭全部 / 关闭全部已完成”时，只能逐个点掉，噪音高、效率低。

这个问题已经从“体验建议”变成了稳定的窗口管理缺口。现在补齐批量关闭，既能直接回应 issue 292，也能把 topbar tabs 的能力边界固定为“窗口管理”，避免后面继续把它误做成删除会话或终止会话的入口。

## 目标与边界

### 目标

- 为顶部“已打开会话 tabs”补齐批量关闭能力：`关闭全部`、`关闭全部已完成`、`关闭左侧`、`关闭右侧`。
- 明确这些动作只作用于 topbar 可见窗口，不删除 thread，不终止会话运行。
- 为 active tab 被批量关闭后的 fallback 行为建立确定性规则，避免出现高亮丢失或跳错会话。
- 顺手收口现有实现与 spec 的漂移：将 `workspace-topbar-session-tabs` 的窗口上限统一到 `max=5`，避免代码、变更文档和主规范继续分叉。

### 边界

- 仅覆盖 desktop workspace chat 的顶部会话 tabs。
- 仅管理“已进入 topbar 窗口的 tabs”，不扩大到左侧线程树、activity、radar 或会话历史管理。
- 不改后端会话存储协议，不引入新的 Tauri command。
- 不改变单个 `X` 的原有语义，只是在其上增加批量窗口管理入口。

## 非目标

- 不实现会话删除、归档、停止运行等生命周期动作。
- 不引入拖拽重排、固定 tab、overflow 菜单、分组着色等浏览器式高级 tab 管理。
- 不修改 phone/tablet 导航结构。
- 不重做 topbar 整体视觉语言，只在现有 tab 组上补充右键菜单与批量关闭行为。

## What Changes

- 为顶部会话 tab 新增右键上下文菜单。
- 在上下文菜单中新增以下动作：
  - `关闭标签`
  - `关闭左侧标签`
  - `关闭右侧标签`
  - `关闭全部标签`
  - `关闭全部已完成标签`
- 将“已完成”的首期语义固定为：当前 topbar 可见窗口内 `isProcessing = false` 的 tab。
- 为批量关闭引入确定性 fallback：
  - 如果 active tab 未被关闭，只更新 topbar 窗口，不切换上下文。
  - 如果 active tab 被关闭，系统 MUST 选择剩余窗口中的邻近 tab 作为 fallback；若无剩余 tab，则退出 topbar 高亮但保持 workspace 上下文稳定。
- 将 `TOPBAR_SESSION_TAB_MAX`、当前 change 文档和主规范统一到 `max=5`，避免 capability 与运行结果继续漂移。

## 技术方案对比

### 方案 A：直接在组件内按事件分支处理批量关闭

- 优点：改动快，文件少。
- 缺点：批量关闭、fallback、active 判定都会揉进 UI 组件，测试颗粒度差，后续很难验证“只管理窗口、不碰生命周期”。

### 方案 B：先扩展 topbar window 纯函数，再由 UI 调用

- 优点：窗口管理语义可测试、可复用，批量关闭与 fallback 可以在纯函数层固定；UI 只负责菜单与事件分发。
- 缺点：前期要多补几组 helper 和测试。

### 取舍

采用 **方案 B**。这更符合当前 capability 的本质: topbar tabs 是运行时窗口模型，不是会话生命周期模型。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `workspace-topbar-session-tabs`: 扩展 topbar tabs 的关闭能力，增加右键批量关闭动作、已完成过滤语义与 active fallback 规则。

## Impact

- 受影响代码：
  - `src/features/layout/hooks/topbarSessionTabs.ts`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/app/components/TopbarSessionTabs.tsx`
  - `src/features/app/components/TopbarSessionTabs.test.tsx`
  - `src/features/layout/hooks/topbarSessionTabs.test.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
- 不影响后端会话删除 / 归档 / 停止运行接口。
- 验收重点：
  - 批量关闭只作用于 topbar 窗口；
  - active tab 关闭后 fallback 稳定；
- `max=5` 口径在代码、测试和规范中保持一致；
  - 不回退现有单 tab 关闭行为。
