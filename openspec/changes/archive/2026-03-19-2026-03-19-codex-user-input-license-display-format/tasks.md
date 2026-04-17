## 1. Artifact Baseline

- [x] 1.1 固化问题边界与能力映射（输入：当前用户气泡现状与期望截图；输出：proposal + specs 初稿）
- [x] 1.2 明确 display-only 原则（输入：现有复制链路与消息存储行为；输出：不可变约束条目）

## 2. Display Formatter Implementation

- [x] 2.1 在消息展示链路新增“用户输入格式保真”显示函数（输入：用户 `displayText`；输出：格式保真文本）
- [x] 2.2 将 formatter 接入用户气泡显示路径，确保仅影响渲染文本（输入：`displayText` 与 `item.text`；输出：显示/复制行为分离）
- [x] 2.3 保持非结构化短文本路径零回退（输入：普通消息样本；输出：行为等价）

## 3. Regression Coverage

- [x] 3.1 新增测试：多行段落、空行、列表和缩进在用户气泡中保持与输入一致
- [x] 3.2 新增测试：`BEGIN/END LICENSE` 场景作为示例，展示可读且结构不丢失
- [x] 3.3 新增测试：复制内容仍为原始消息文本，不受显示格式化影响
- [x] 3.4 新增测试：`[User Input]` 提取与普通文本渲染不回归

## 4. Verification

- [x] 4.1 执行最小测试集并记录结果（至少 `Messages` 相关 vitest）
- [x] 4.2 手工验证截图对齐预期（现状 vs 改后）

## 5. Spec Root Hint Injection Cadence (Codex)

- [x] 5.1 将 Codex 外部 Spec 根提示注入改为“仅新会话首条消息注入一次”
- [x] 5.2 保持 `customSpecRoot` 透传能力不变，不因提示注入收敛而丢失路径上下文
- [x] 5.3 新增/更新回归测试：线程已有历史消息时，不再重复拼接 `[Session Spec Link]` / `[Spec Root Priority]`
