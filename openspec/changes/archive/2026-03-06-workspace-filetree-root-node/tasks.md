## 1. 数据模型与协议改造（P0）

- [x] 1.1 引入 workspace root tree node 模型并调整初始 payload 结构为 `root -> children`（输入：现有 file tree builder；输出：包含单一根节点的数据结构；验证：单测断言仅 1 个 root 且 children 完整）
- [x] 1.2 更新 special directory initial listing 逻辑，确保根节点包裹后仍不预加载 special descendants（输入：special directory classifier/loading 逻辑；输出：保持渐进加载语义；验证：回归用例断言 `node_modules/target` 首屏无深层子节点）

## 2. 前端树渲染与状态管理（P0）

- [x] 2.1 在文件树组件渲染根节点行（名称/图标/折叠箭头）并默认展开（输入：树渲染组件；输出：可见根节点 UI；验证：组件测试断言根节点默认展开）
- [x] 2.2 将根节点展开状态接入现有 tree state store 并实现折叠后恢复（输入：树状态存储；输出：`rootExpanded` 与状态恢复逻辑；验证：交互测试覆盖 collapse -> expand 后子树状态恢复）
- [x] 2.3 将“筛选文件和文件夹”搜索输入框迁移到顶部工具行并移除独立第二行容器（输入：现有 filetree header/search 组件；输出：单行顶部布局；验证：UI 测试断言搜索框与计数/操作按钮同层）
- [x] 2.4 为顶部工具行补充弹性与最小宽度约束，确保窄宽度下搜索框与右侧按钮都可用（输入：样式与布局规则；输出：无重叠/无裁剪；验证：响应式快照与交互测试）
- [x] 2.5 实现根节点顶部区 sticky 容器并拆分文件列表滚动区（输入：filetree 容器结构与样式；输出：根节点顶部区固定、列表独立滚动；验证：滚动交互测试断言顶部区不位移）

## 3. 根节点右键菜单与命令复用（P0）

- [x] 3.1 绑定根节点 context menu 到现有目录菜单入口，保证菜单项对齐（输入：目录 context menu 配置；输出：根节点菜单项含新建文件/创建副本/复制路径/在访达中显示/移到废纸篓；验证：UI 测试快照与行为断言）
- [x] 3.2 复用目录 action dispatch 链路并将根节点 path 解析为 workspace root absolute path（输入：现有 action handlers + path resolver；输出：根节点动作无分叉实现；验证：集成测试断言 action handler 被同一链路调用）
- [x] 3.3 增加 workspace 边界校验，拒绝 root action 的 traversal/out-of-root payload（输入：后端路径校验逻辑；输出：安全拒绝与可恢复错误；验证：后端测试断言非法路径返回错误且 UI 不崩溃）

## 4. 兼容性回归与验收（P1）

- [x] 4.1 回归多 Tab 打开语义，确保根节点菜单动作不清空/重置已打开标签（输入：filetree-multitab-open 相关逻辑；输出：无行为回退；验证：前端测试覆盖已有 Tab 场景）
- [x] 4.2 回归 Diff/Preview/文件打开主链路，确认新增根层级不影响下游能力（输入：file preview & git diff flows；输出：主流程稳定；验证：现有测试 + 手工 smoke）
- [x] 4.3 回归顶部工具行布局，确认搜索框 placeholder 可见、可输入且不遮挡文件计数/右侧按钮（输入：顶部行布局改造；输出：布局稳定；验证：窄宽度 smoke + 组件测试）
- [x] 4.4 回归 sticky 吸顶行为，确认滚动时顶部区固定、按钮可点击且无内容覆盖（输入：sticky 实现；输出：交互稳定；验证：滚动 smoke + 点击命中测试）
- [x] 4.5 更新相关 spec 对应测试清单与文档说明（输入：change specs + design；输出：可追踪的验收记录；验证：OpenSpec change 自检通过）
