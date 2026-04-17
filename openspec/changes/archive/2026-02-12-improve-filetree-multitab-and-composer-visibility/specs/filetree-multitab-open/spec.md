# Filetree Multitab Open Specification

## ADDED Requirements

### Requirement: 文件树支持多文件并行打开

系统 SHALL 在文件树点击行为中支持多文件并行打开，而不是替换当前文件。

#### Scenario: 打开第二个文件不关闭第一个文件

- **GIVEN** 用户已打开文件 A
- **WHEN** 用户在文件树点击文件 B
- **THEN** 系统 SHALL 保留文件 A 的已打开状态
- **AND** 新增文件 B 到已打开 Tab 列表

#### Scenario: 点击已打开文件时激活而非重复创建

- **GIVEN** 文件 A 已存在于已打开 Tab 列表
- **WHEN** 用户再次点击文件 A
- **THEN** 系统 SHALL 仅切换活动 Tab 到文件 A
- **AND** 不得新增重复 Tab

### Requirement: 文件 Tab 支持切换与关闭

系统 SHALL 提供标签化切换与关闭能力，且关闭活动标签后焦点行为可预测。

#### Scenario: 切换活动标签

- **WHEN** 用户点击任意已打开文件 Tab
- **THEN** 系统 SHALL 将对应文件设为活动 Tab
- **AND** 文件查看区 SHALL 渲染该文件内容

#### Scenario: 关闭活动标签后的焦点回退

- **GIVEN** 用户关闭当前活动 Tab
- **WHEN** 当前标签右侧存在相邻标签
- **THEN** 系统 SHALL 激活右侧标签
- **AND** 若无右侧标签，SHALL 激活左侧标签

#### Scenario: 关闭最后一个标签

- **GIVEN** 仅剩一个已打开 Tab
- **WHEN** 用户关闭该 Tab
- **THEN** 系统 SHALL 进入文件查看空态
- **AND** 不得触发异常或错误渲染

### Requirement: 兼容现有文件打开路径

系统 SHALL 在新增多 Tab 能力后保持现有文件树打开路径可用。

#### Scenario: 首次从文件树打开文件

- **GIVEN** 当前无已打开文件 Tab
- **WHEN** 用户点击文件树中的任意文件
- **THEN** 系统 SHALL 正常打开该文件并创建第一个 Tab
- **AND** 原有“点击文件即可查看内容”体验 MUST 保持不变
