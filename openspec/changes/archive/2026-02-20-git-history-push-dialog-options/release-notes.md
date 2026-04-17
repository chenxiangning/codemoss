# Release Notes - git-history-push-dialog-options

## 用户可见变化

- Git History 顶部 `Push` 由“直接推送”改为“先打开确认弹窗再推送”。
- Push Dialog 支持参数化推送：remote、target branch、Push tags、Run Git hooks、Force with lease、Push to Gerrit、Topic/Reviewers/CC。
- 新增“本次推送提交”预览：提交列表 + 选中提交详情 + 变更文件。
- 点击变更文件时以弹窗形式查看 diff，避免主视图被展开内容挤压。
- 当目标远端分支不存在时，进入“新分支首次推送”模式：显示 `New` 标签与语义提示，不展示误导性提交明细。

## 兼容性与风险

- 默认参数下保持原有推送语义兼容。
- `Push to Gerrit` 开启后，目标摘要与执行语义切换为 `refs/for/<branch>`。
- 无可推送提交时禁用确认按钮，降低误操作风险。
