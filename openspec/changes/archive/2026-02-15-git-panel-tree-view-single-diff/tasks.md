# Implementation Tasks: Git Panel Tree View + Single Diff Focus

## 1. 基础结构

- [x] 1.1 在 Git 面板状态中引入 `gitDiffListView`（flat/tree）
- [x] 1.2 为 workspace 持久化 `gitDiffListView` 设置
- [x] 1.3 在 Git 面板头部增加 Flat/Tree 切换控件

## 2. Tree 视图构建

- [x] 2.1 基于 staged/unstaged 文件构建路径树结构
- [x] 2.2 实现目录展开/折叠状态管理
- [x] 2.3 在树节点展示文件状态与增删统计
- [x] 2.4 复用现有文件右键菜单操作

## 3. 单文件 Diff 焦点

- [x] 3.1 Tree 文件点击时设置 `selectedDiffPath`
- [x] 3.2 Diff 区域在 tree 模式下默认展示选中文件
- [x] 3.3 文件级 Diff header 承载视图控制（替代顶部独立操作条）
- [x] 3.4 无选中文件时展示明确空态引导

## 4. 兼容与回归

- [x] 4.1 保持 flat 视图现有行为不变
- [x] 4.2 Stage/Unstage/Revert 回归验证
- [x] 4.3 提交流程（commit message / commit）回归验证

## 5. 全文查看能力增强

- [x] 5.1 新增按文件 full-context diff 数据链路
- [x] 5.2 全文按钮状态反馈（FULL/EMPTY/ERR/...）
- [x] 5.3 修复全文模式只显示 patch 周边的问题

## 6. 全文模式锚点跳转

- [x] 6.1 增加全文模式浮动锚点 UI（上/下跳转 + 计数）
- [x] 6.2 锚点可点击并支持平滑滚动到目标改动点
- [x] 6.3 锚点分组按“变更行跳变”而非逐行计数
- [x] 6.4 吸附位置改为固定右下，避免随内容漂移

## 7. 可用性增强（待完成）

- [ ] 7.1 键盘导航（↑↓←→、Enter）
- [ ] 7.2 切换视图快捷键（待冲突检查后确定）
- [ ] 7.3 基础无障碍属性（aria-label/aria-expanded）

## 8. 测试

- [ ] 8.1 为树构建逻辑添加单元测试
- [ ] 8.2 为视图切换与焦点行为添加组件测试
- [ ] 8.3 添加回归测试覆盖 flat 模式核心链路
- [ ] 8.4 手工验证大变更集性能表现
