## 1. 自动注入下线与开关禁用

- [x] 1.1 [P0][依赖:无] 发送链路移除自动注入触发（输入: `useThreadMessaging.ts` 现有 `injectProjectMemoryContext` 调用;
  输出: 未手动选择时不注入; 验证: 发送文本不再自动附带 `<project-memory>`）
- [x] 1.2 [P0][依赖:1.1] 将 `contextInjectionEnabled` 开关改为默认关闭且禁用（输入: `ProjectMemoryPanel.tsx`; 输出:
  checkbox 置灰不可点击; 验证: UI 点击无状态变化）
- [x] 1.3 [P0][依赖:1.2] 清理/隔离旧 localStorage 开关读取对自动注入的影响（输入:
  `projectMemory.contextInjectionEnabled`; 输出: true 也不触发自动注入; 验证: 本地写入 true 后仍无自动注入）

## 2. Composer `@@` 触发与多选记忆

- [x] 2.1 [P0][依赖:无] 在 autocomplete 解析层新增 `@@` 触发语义并保留单 `@` 文件语义（输入:
  `useComposerAutocomplete*.ts`; 输出: `@@` 命中记忆候选, `@` 命中文件候选; 验证: 双触发回归测试）
- [x] 2.2 [P0][依赖:2.1] 建立当前 workspace 项目记忆候选数据源（输入: `projectMemoryFacade.list`; 输出: 支持按关键字过滤候选;
  验证: 输入 `@@db` 返回匹配记忆）
- [x] 2.3 [P0][依赖:2.2] 支持候选多选与去重（输入: 候选点击事件; 输出: 选中集合稳定且无重复; 验证: 同一记忆重复点击不重复添加）
- [x] 2.4 [P1][依赖:2.3] 在 Composer 显示已选记忆并支持移除（输入: 已选集合; 输出: 可视 chip/token; 验证: 移除后发送集合同步减少）

## 2A. `@@` 选择器 UI/UX 重设计（追加）

- [x] 2A.1 [P0][依赖:2.2] 将候选项升级为高信息密度卡片（输入: memory list item; 输出: 标题、摘要、kind、优先级、更新时间、标签可见;
  验证: 用户无需点入详情即可完成初筛）
- [x] 2A.2 [P0][依赖:2A.1] 增加“候选高亮详情预览区”（输入: 当前高亮 memory; 输出: 完整或扩展细节可查看; 验证:
  查看详情不改变选择状态）
- [x] 2A.3 [P0][依赖:2A.2] 优化多选反馈（输入: 点击/键盘选择; 输出: 列表态与 Composer 已选态一致、计数明确; 验证:
  选中/取消无歧义）
- [x] 2A.4 [P1][依赖:2A.2] 完善键盘与可访问性（输入: Arrow/Enter/Space/Esc; 输出: 无鼠标可完成完整流程; 验证: a11y
  与键盘交互测试通过）

## 3. 手动记忆一次性注入（One-shot）

- [x] 3.1 [P0][依赖:2.3] 为发送动作增加手动记忆选择参数（输入: `handleSend`/`onSend`; 输出: 发送链路可携带
  selectedMemoryIds; 验证: 参数透传到 thread messaging）
- [x] 3.2 [P0][依赖:3.1] 新增“按已选 ID 注入”路径并复用 `<project-memory>` 块格式（输入: selectedMemoryIds + memory list;
  输出: `source=manual-selection` 注入块; 验证: 消息前缀格式正确）
- [x] 3.3 [P0][依赖:3.2] 实现 one-shot 清空策略（输入: 一次发送完成事件; 输出: 已选记忆清空; 验证: 第二次发送不自动沿用上次选择）
- [x] 3.4 [P1][依赖:3.3] 失败重试策略对齐（输入: 发送失败场景; 输出: 清空时机与重试行为一致; 验证: 失败路径测试通过）

## 3A. 导航与入口对齐

- [x] 3A.1 [P1][依赖:2A.1] 将“项目记忆”入口放到左侧侧边栏引导区（输入: Sidebar/Market rail; 输出: 可一键打开项目记忆面板;
  验证: 点击后进入 chat 并展开右侧 memory 面板）
- [x] 3A.2 [P1][依赖:3A.1] 调整面板 tab 暴露策略，避免重复入口造成认知冲突（输入: layout panel tabs; 输出: 入口语义一致;
  验证: 导航路径唯一且可达）

## 3B. 实时渲染稳定化（思考 + 正文）

- [x] 3B.1 [P0][依赖:无] 在 reducer 合并流式文本时加入重复快照裁剪与片段拼接规整（输入: `useThreadsReducer.ts`; 输出:
  实时正文不再整段回声重复; 验证: 连续 delta 回归用例通过）
- [x] 3B.2 [P0][依赖:3B.1] 调整思考项可见性策略并做相邻去重（输入: `Messages.tsx`; 输出: 思考模块不丢失、不过度重复;
  验证: codex/non-codex 实时场景回归用例通过）
- [x] 3B.3 [P0][依赖:3B.1] 对 CJK 碎片段落/行进行可读性合并且保护 Markdown 结构（输入:
  `Markdown.tsx`/`threadItems.ts`; 输出: 逐字断行显著收敛且列表/代码块不破坏; 验证: 断裂文本回归用例通过）
- [x] 3B.4 [P1][依赖:3B.2] 统一思考 icon 视觉语义为绿色（输入: messages styles; 输出: 多来源图标一致; 验证:
  实时与历史渲染颜色一致）

## 3C. 事件与会话归并收敛

- [x] 3C.1 [P0][依赖:无] 在 app-server 事件层增加 completion 去重护栏（输入: `useAppServerEvents.ts`; 输出:
  `item/completed` 与 `turn/completed` 不再双发同文; 验证: fallback/completed 去重测试通过）
- [x] 3C.2 [P0][依赖:3C.1] pending 线程解析改为“活动证据优先”，移除时间戳猜测（输入: `useThreads.ts`; 输出:
  无证据不归并、避免新会话残留旧输出; 验证: pendingResolution 测试通过）
- [x] 3C.3 [P0][依赖:3.1] 将 `selectedMemoryIds` 透传到 send/queue/new-thread/kanban 路径（输入:
  Composer + queue + app send handlers; 输出: 全发送路径行为一致; 验证: 关键路径联调通过）

## 3D. 历史兼容与记忆写入去重

- [x] 3D.1 [P0][依赖:3B.2] 在消息渲染层兼容旧注入前缀（输入: `Messages.tsx`; 输出:
  识别 `[对话记录]...`/`<project-memory>...</project-memory>` 并映射为“记忆上下文摘要”卡片; 验证:
  老 session 点击后样式与新格式一致）
- [x] 3D.2 [P0][依赖:3C.2] 在记忆归并写入前增加摘要/正文规范化与去重（输入: `useThreads.ts`; 输出:
  `助手输出摘要` 句级去重，`助手输出`仅保留摘要之外新增片段; 验证: detail 不再出现整段重复）
- [x] 3D.3 [P1][依赖:3D.2] 处理尾部提示词残留裁剪（输入: assistant output raw text; 输出:
  结尾“好的，更新记录：/在终端执行：”等提示残片不重复写入; 验证: 示例回归通过）

## 4. 测试覆盖

- [x] 4.1 [P0][依赖:2.1] 增加 autocomplete 单测覆盖 `@@` vs `@` 触发分流（输入: `useComposerAutocompleteState.test.tsx`;
  输出: 新用例; 验证: test pass）
- [x] 4.2 [P0][依赖:2.4,2A.3] 增加 Composer 组件测试覆盖多选/移除/发送后清空（输入: Composer tests; 输出: 新用例; 验证:
  one-shot 行为可断言）
- [x] 4.5 [P0][依赖:2A.2] 增加候选详情预览测试（输入: 选择器交互; 输出: 高亮-详情联动与“仅预览不选中”断言; 验证: test
  pass）
- [x] 4.6 [P1][依赖:2A.4] 增加键盘可访问性测试（输入: keyboard events; 输出: Arrow/Enter/Esc 行为断言; 验证: test pass）
- [x] 4.3 [P0][依赖:1.1,3.2] 增加 `useThreadMessaging` 测试：无手动选择不注入、有手动选择注入一次（输入: context-injection
  tests; 输出: 新断言; 验证: test pass）
- [x] 4.4 [P1][依赖:1.2] 增加项目记忆面板测试：开关默认关闭且 disabled（输入: `ProjectMemoryPanel.test.tsx`; 输出: 新断言;
  验证: test pass）
- [x] 4.7 [P0][依赖:3B.2] 增加 Messages 思考行稳定性测试（输入: `Messages.test.tsx`; 输出:
  title-only 可见/去重/不丢失断言; 验证: test pass）
- [x] 4.8 [P0][依赖:3B.1] 增加 reducer 流式正文去重与快照合并测试（输入: `useThreadsReducer.test.ts`; 输出:
  重复/回声/片段拼接断言; 验证: test pass）
- [x] 4.9 [P0][依赖:3C.1] 增加 app-server completion 去重测试（输入: `useAppServerEvents.test.tsx`; 输出:
  item/turn completed 双发防护断言; 验证: test pass）
- [x] 4.10 [P0][依赖:3C.2] 增加 pending 归并判定测试（输入: `useThreads.pendingResolution.test.ts`; 输出:
  无活动不归并断言; 验证: test pass）
- [x] 4.11 [P1][依赖:3B.3] 增加历史项文本规整测试（输入: `threadItems.test.ts`; 输出:
  断裂合并与重复规整断言; 验证: test pass）
- [x] 4.12 [P0][依赖:3D.1] 增加旧前缀摘要卡片兼容测试（输入: `Messages.test.tsx`; 输出:
  旧用户注入前缀可渲染摘要卡片且正文仅保留真实用户输入; 验证: test pass）
- [x] 4.13 [P0][依赖:3D.2] 增加记忆写入去重集成测试（输入: `useThreads.memory-race.integration.test.tsx`; 输出:
  摘要/正文不重复与冗余输出省略断言; 验证: test pass）

## 5. 文案与可用性

- [x] 5.1 [P1][依赖:2.4] 增加 `@@` 相关 i18n 文案（候选空态、已选提示、移除动作）（输入: zh/en locale; 输出: 新 keys; 验证:
  中英文显示正常）
- [x] 5.2 [P1][依赖:1.2] 为禁用开关补充说明文案（输入: memory settings UI; 输出: 用户可理解“改为手动关联”; 验证: 文案可见）

## 6. 验证与交付

- [x] 6.1 [P0][依赖:4.x] 执行目标测试集并记录结果（输入: vitest 命令; 输出: 相关测试全绿; 验证: CI 本地通过）
- [x] 6.2 [P0][依赖:6.1] 执行 typecheck/lint（输入: `npm run typecheck` + `npm run lint`; 输出: 零错误; 验证: 命令退出码
  0）
- [x] 6.3 [P0][依赖:6.2] 人工回归 `@@` 选择、多选注入、one-shot 清空、开关禁用（输入: UI 交互; 输出: 行为与 spec 一致; 验证:
  回归清单通过）
- [x] 6.4 [P0][依赖:2A.x,4.5] 人工回归“先看细节再选择”流程（输入: 真实记忆样本; 输出: 可在选择前完成有效判断; 验证: UX
  回归清单通过）
- [x] 6.5 [P0][依赖:3B.x,4.7] 人工回归实时思考显示稳定性（输入: codex/claude/opencode 实时对话; 输出:
  不丢思考、不重复堆叠、样式连续; 验证: 三引擎回归清单通过）
- [x] 6.6 [P0][依赖:3C.x,4.10] 人工回归新建会话与历史回放一致性（输入: 新建会话 + 历史重开; 输出:
  无旧输出残留、无重复正文; 验证: 历史与实时一致性清单通过）
- [x] 6.7 [P0][依赖:3D.x,4.12] 人工回归旧会话点击展示（输入: 含旧注入前缀历史消息; 输出:
  展示摘要卡片而非原始注入串，正文保持用户输入; 验证: 图 1/图 2 风格一致）
- [x] 6.8 [P0][依赖:3D.2,4.13] 人工回归项目记忆 detail 去重（输入: 多轮写入样本; 输出:
  “助手输出摘要/助手输出”无整段重复; 验证: 记忆详情抽检通过）
