# browser-dock-center-split

## ADDED Requirements

### Requirement: 主窗口中心区 MUST 以内嵌分屏承载浏览器 Dock

当 browser dock 开启且 `centerMode === "chat"` 时，系统 MUST 在主窗口中心区渲染浏览器 dock：对话幕布在左、浏览器在右，浏览器使用独立的 `.content-layer--browser-dock` 容器，MUST NOT 与文件编辑器容器（`.content-layer--editor`）共用。

- MainHeader 浏览器入口 MUST 切换内嵌 dock 的开关状态（替代直接打开 detached 窗的旧行为）
- dock 开关状态 SHOULD 持久化到 client store

#### Scenario: 打开内嵌 dock 与对话幕布并排

- **WHEN** 用户点击 MainHeader 浏览器按钮且无其他 centerMode 激活
- **THEN** 中心区 MUST 左列渲染对话幕布、右列渲染浏览器 dock
- **AND** 再次点击 MUST 关闭内嵌 dock 恢复纯幕布

#### Scenario: 浏览器容器独立于文件编辑器

- **WHEN** 内嵌 dock 与文件编辑器先后或同时可用
- **THEN** 浏览器 MUST 渲染在 `.content-layer--browser-dock` 层
- **AND** MUST NOT 复用 `.content-layer--editor` 层或其内部 DOM

### Requirement: 内嵌分屏 MUST 支持拖拽调宽

对话幕布与浏览器 dock 之间 MUST 提供拖拽分隔条，拖动即时调整两侧宽度比例；比例 MUST 作用于 `--browser-dock-split-ratio` 并被钳制在可用区间（两侧均保留最小可用宽度）。

#### Scenario: 拖拽分隔条调宽

- **WHEN** 用户按住分隔条左右拖动
- **THEN** 浏览器列宽 MUST 在约 24%–72%（且不小于最小像素宽度）区间内随动
- **AND** 对话幕布 MUST 同步占据剩余宽度

### Requirement: 内嵌模式 MUST 把网页内容渲染进主窗口容器矩形

内嵌 dock（`displayMode="embedded"`）打开或激活浏览器会话时，系统 MUST 通过 `mount_browser_agent_webview` 把会话 webview 作为主窗口子 webview 挂载到 dock 内容容器的矩形；容器矩形变化时 MUST 通过 `sync_browser_agent_webview_bounds` 保持对齐。

- 容器矩形 MUST 以 ResizeObserver 为唯一收敛点，覆盖拖拽、侧栏开合、窗口 resize 等一切布局变化
- `displayMode` 缺省（`"floating"`）的既有调用方 MUST 保持原行为（浮动窗）

#### Scenario: 内嵌打开 URL 渲染在主窗口内

- **WHEN** 用户在内嵌 dock 输入合法 URL 并打开
- **THEN** 网页 MUST 渲染在主窗口浏览器容器矩形内
- **AND** MUST NOT 创建 `browser-agent-window` 浮动窗

#### Scenario: 拖拽或 resize 后网页对齐容器

- **WHEN** 内嵌网页已渲染且容器矩形发生变化
- **THEN** 子 webview bounds MUST 同步到新矩形
- **AND** 网页 MUST NOT 与容器错位或覆盖对话幕布

### Requirement: 内嵌子 webview MUST 显式显隐，不得残留

native 子 webview 不受 CSS 隐藏管辖。dock 关闭、centerMode 离开 chat、active 会话切换或关闭、组件卸载时，系统 MUST 显式 `hide_browser_agent_webview`（或对失效 bounds 走 sync 隐藏）；重新可见时 MUST 重新同步 bounds 恢复显示。

#### Scenario: 切换 centerMode 后无浮层残留

- **WHEN** 内嵌网页显示中，用户切换到文件编辑器 / diff / 其他 centerMode
- **THEN** 子 webview MUST 被隐藏
- **AND** 切回 chat 后 MUST 恢复对齐显示

#### Scenario: 关闭 dock 后无浮层残留

- **WHEN** 用户关闭内嵌 dock
- **THEN** 活跃子 webview MUST 被隐藏
- **AND** 中心区 MUST NOT 残留遮挡其他 UI 的原生浮层

### Requirement: 岛工具条 MUST 提供弹出独立窗体入口

内嵌 dock 的 chrome MUST 提供「弹出独立窗体」按钮；点击后系统 MUST 先隐藏内嵌子 webview，再经既有 `open_browser_agent_window` 路径在独立浮动窗渲染当前会话（含注入工具条）。该入口仅在 `displayMode="embedded"` 时渲染（无活跃会话时置灰），按钮文案 MUST 覆盖全部已注册 WebView locale。

#### Scenario: 弹出到独立窗体

- **WHEN** 内嵌网页显示中，用户点击「弹出独立窗体」
- **THEN** 主窗口子 webview MUST 隐藏
- **AND** 当前会话 MUST 在独立浮动窗中打开（既有行为，含注入工具条）
- **AND** 内嵌容器 MUST 回到未挂载占位态

#### Scenario: floating 模式不显示弹出按钮

- **WHEN** BrowserDock 以默认（floating）模式渲染（如 detached 窗）
- **THEN** chrome MUST NOT 渲染「弹出独立窗体」按钮
- **AND** 其余控件与行为 MUST 与改造前一致

### Requirement: 打开内嵌 dock MUST 与文件编辑器互斥

打开 dock 时（MainHeader toggle 或 `browser-agent:open-dock` 事件），系统 MUST 将 `centerMode` 切回 `"chat"`，保证 dock 立即渲染可见，MUST NOT 出现 dock 已开启但被文件编辑器层遮盖的状态。

#### Scenario: 编辑器模式下打开浏览器

- **WHEN** 用户正在文件编辑器（`centerMode === "editor"`）查看文件，点击 MainHeader 浏览器按钮
- **THEN** 中心区 MUST 切回 chat 模式
- **AND** 内嵌 dock MUST 与对话幕布左右并排渲染

### Requirement: 文件「在浏览器打开」MUST 路由到内嵌 dock

文件视图、文件树、Git diff 中的 HTML 文件「在浏览器打开」入口 MUST 通过 dock 事件链路（`browser-agent:open-dock` + `browser-agent:open-url`，含 sessionStorage pending 兜底）在内嵌容器打开，MUST NOT 直接创建 `browser-agent-window` 浮动窗；会话创建与挂载由 BrowserDock 接管，校验失败在 chrome notice 呈现。

#### Scenario: 从文件标签页在内嵌容器打开 HTML

- **WHEN** 用户对 HTML 文件触发「在浏览器打开」
- **THEN** 内嵌 dock MUST 打开（必要时先切 chat 模式）并以 file:// URL 创建会话挂载子 webview
- **AND** MUST NOT 弹出独立浮动窗

### Requirement: 内嵌 chrome MUST 对齐浮动工具条的上下文能力

内嵌 chrome MUST 提供与浮动窗注入工具条等价的「关联浏览器上下文」与「选择网页元素」能力；无活跃会话时按钮 MUST 置灰。

- 「关联浏览器上下文」MUST 复用 `browser-agent://attach-current-context` 事件通道（与浮动窗同一路径抵达 Composer）
- 「选择网页元素」MUST 经 `start_browser_agent_element_select` 命令在内嵌子 webview 注入选择器脚本；子 webview 的 `on_navigation` MUST 拦截 toolbar bridge URL，把选中元素证据回传主窗口 attach 流程
- 该入口 MUST 可切换：再次点击 MUST 调用 `stop_browser_agent_element_select` 只执行页面内 cleanup，MUST NOT 重新注入选择器；Esc 取消后主窗口 icon MUST 回到未选中态

#### Scenario: 内嵌模式关联浏览器上下文

- **WHEN** 内嵌网页显示中，用户点击「关联浏览器上下文」
- **THEN** Composer MUST 收到与浮动窗 attach 相同的上下文关联请求

#### Scenario: 内嵌模式选择网页元素

- **WHEN** 内嵌网页显示中，用户点击「选择网页元素」并在页面中选中元素
- **THEN** 选中元素证据 MUST 经 bridge 拦截回传主窗口
- **AND** 页面 MUST NOT 真实跳转到 bridge URL

### Requirement: 内嵌 chrome MUST 采用编辑器标签模式外观

内嵌 dock 的 chrome MUST 呈现编辑器标签模式：浏览器 tab 与 webview 内容区同色相接（active tab 顶部高亮条）、tab 显示 host 头像字母 + hostname + 会话状态点、URL 输入降级为面包屑行（等宽字体、无边框）、支持 ⌘L / Ctrl+L 聚焦地址栏。floating 模式的悬浮岛外观 MUST 保持不变。

内嵌展开态的控件布局 MUST 为：顶部仅 tab 条；地址行沉到底部；webview 填满两者之间的容器矩形，MUST NOT 保留内边距或描边边框。底部地址行仅保留 icon 操作：打开、关联上下文、选择元素、弹出独立窗体、收起控制条；文案 MUST 只出现在 `aria-label` / `title`，MUST NOT 作为按钮可见文本。状态徽标、信息气泡、顶栏关闭会话按钮 MUST NOT 出现在内嵌 chrome。

#### Scenario: 内嵌 chrome 呈现编辑器标签布局

- **WHEN** 内嵌 dock 展开
- **THEN** 顶部 MUST 为编辑器风格 tab 条（仅 tab + 新建，无右侧文案按钮）
- **AND** tab MUST 直角贴边填满 tab 条容器（无圆角、无左侧内边距）
- **AND** 地址行 MUST 位于容器底部，仅保留 icon 操作：打开 / 关联上下文 / 选择元素 / 弹出独立窗体 / 收起
- **AND** 地址行文本与 icon MUST 处于同一水平中线
- **AND** 上述操作 MUST NOT 显示文案
- **AND** webview 内容区 MUST 填满 tab 条与底部地址行之间的容器，无内边距与描边边框
- **AND** active tab 背景 MUST 与内容区背景同色相接
- **AND** 坍缩恢复条 MUST 只保留状态点、页面标题、标签数与展开 icon，MUST NOT 重复状态文案或「展开浏览器控制条」可见文本

