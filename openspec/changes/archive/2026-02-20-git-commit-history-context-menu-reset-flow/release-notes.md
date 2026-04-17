# Release Notes - git-commit-history-context-menu-reset-flow

## 用户可见变化

- Git Commit History 提交行右键菜单升级为分组动作，补齐高频入口：
  - `复制修订号`
  - `将当前分支重置到此处...`
- 提交区新增关联按钮组（Copy / Create Branch / Reset），与右键菜单共享可用性规则。
- Reset 流程改为 confirmation-first，支持 `soft/mixed/hard/keep` 四种模式。
- `hard` 模式增加破坏性提示，失败场景提供可读错误与重试入口。

## 兼容性与风险

- 仅增强入口与确认流程，不改变现有 commit 列表分页与渲染模型。
- reset 纳入写操作互斥集合，减少并发写入冲突风险。
