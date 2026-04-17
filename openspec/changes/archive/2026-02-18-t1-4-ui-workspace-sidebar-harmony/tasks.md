# Tasks: T1-4 UI Workspace Sidebar Harmony

## 总体状态

- 当前状态：`In Progress`
- 完成度：`约 85%`
- 更新时间：`2026-02-18`

## 1. 现状基线与 Token 清单（P0）

- [x] 1.1 梳理 sidebar spacing/radius/active token（4pt 体系）
- [x] 1.2 建立主次焦点样式优先级（primary/secondary/context）
- [x] 1.3 将 token 应用于 workspace/worktree/thread 三层

## 2. Workspace/Thread 状态语义统一（P0）

- [x] 2.1 实现 single primary focus（active thread 主高亮）
- [x] 2.2 workspace 降级为 context 指示态（弱背景/侧边指示）
- [x] 2.3 处理 active thread 缺失时的 workspace 回退逻辑

## 3. Worktree 区域容器感弱化（P1）

- [x] 3.1 弱化重容器边框与厚背景
- [x] 3.2 调整 worktree header 为轻分组样式
- [x] 3.3 与 workspace 主列表统一视觉语言

## 4. 密度节奏重排（P1）

- [x] 4.1 统一行高与间距节奏
- [x] 4.2 调整 section 标题层级与视觉权重
- [x] 4.3 弱化时间戳等辅助信息对比度

## 5. 独立图标栏（Rail）建设（补充范围）

- [x] 5.1 新增独立左侧 rail 结构（与列表区分离）
- [x] 5.2 将 `对话/面板/MCP/长期记忆/插件市场/设置/终端` 迁入 rail
- [x] 5.3 增加 rail 折叠/展开交互
- [x] 5.4 修复 rail 不应随内容滚动的问题
- [x] 5.5 修复 rail 底部按钮定位（始终贴底）

## 6. Topbar 联动与对齐（补充范围）

- [x] 6.1 侧栏展开时将项目标题块迁移到侧栏头部
- [x] 6.2 侧栏收起时标题块回主 topbar 原位
- [x] 6.3 主 topbar 右侧操作区保持原位，不参与迁移
- [x] 6.4 统一左右 topbar 高度与基线
- [x] 6.5 左侧头部仅保留项目入口（移除分支/展开按钮）

## 7. 交互与视觉问题修复（补充范围）

- [x] 7.1 修复项目下拉在侧栏头部场景的遮罩/裁剪问题
- [x] 7.2 修复双高亮（MCP 按钮硬编码 active）问题
- [x] 7.3 修复错误滚动条与滚动容器归属
- [x] 7.4 去除 rail 中轴线并收窄折叠宽度
- [x] 7.5 项目入口增加 icon 标识

## 8. 回归验证与收尾（P0）

- [x] 8.1 `npm run typecheck` 通过
- [x] 8.2 `Sidebar` 组件相关测试通过
- [ ] 8.3 完成最终像素级对齐验收（项目入口 X 轴微调）
- [ ] 8.4 补充 before/after 截图并归档到变更记录
