# Implementation Tasks: OpenCode 首轮会话绑定修复

## 1. 前端发送前线程约束（P0）

- [x] 1.1 [P0][depends: none][<=1h]
  输入：当前活动线程 + 当前引擎
  输出：OpenCode/Claude 发送前 threadId 前缀校验，不匹配则强制新建 pending 线程
  验证：首轮 OpenCode 发送不再复用无前缀旧 threadId。

## 2. 事件路由语义增强（P0）

- [x] 2.1 [P0][depends: none][<=1h]
  输入：后端 `thread/started` 事件
  输出：增加 `engine` 字段
  验证：前端可直接按 engine 决策回填。

- [x] 2.2 [P0][depends: 2.1][<=1h]
  输入：前端 `onThreadSessionIdUpdated`
  输出：支持 engine hint 的回填兜底逻辑
  验证：threadId 无前缀时仍能稳定 rename。

## 3. 回归测试与收口（P0）

- [x] 3.1 [P0][depends: 1.1,2.2][<=1h]
  输入：前端改动
  输出：新增/更新 hooks 测试
  验证：`vitest` 指定测试通过。

- [x] 3.2 [P0][depends: 2.1][<=1h]
  输入：后端事件改动
  输出：Rust 编译验证
  验证：`cargo test -p code-moss engine::` 通过（或最小相关测试通过）。

## 4. 慢首包体验提示（P1）

- [x] 4.1 [P1][depends: 1.1][<=1h]
  输入：OpenCode 长时间无首段输出场景
  输出：消息区 WorkingIndicator 增加“可能非流式返回”提示（OpenCode-only）
  验证：组件测试通过，且仅在 OpenCode + 长时间未有首段输出时展示。

## 5. 状态一致性与文案兜底（P0）

- [x] 5.1 [P0][depends: 4.1][<=1h]
  输入：i18n key 解析偶发失败场景
  输出：`messages.nonStreamingHint` 增加运行时 key 泄漏兜底（不显示原始 key）
  验证：慢首包提示始终为可读文案。

- [x] 5.2 [P0][depends: none][<=1h]
  输入：`auth list` 结果与当前模型不可推断 provider 场景
  输出：后端 provider health 改为可解释回退（优先已认证 provider，避免 `unknown + matched=true`）
  验证：状态文案一致，不再出现“匹配是(unknown)”。

- [x] 5.3 [P0][depends: 5.2][<=1h]
  输入：前端管理面板 Provider/Model 展示
  输出：过滤 `unknown/-/null` 占位值，空态显示“未选择模型/无可用模型”
  验证：绿灯场景下不再显示 `unknown` 与 `-` 作为有效模型/provider。

## 6. Codex 对齐的连接语义收敛（P0）

- [x] 6.1 [P0][depends: none][<=1h]
  输入：OpenCode 发送链路
  输出：发送前增加 OpenAI endpoint 网络 preflight（`api.openai.com:443`，短超时）
  验证：网络不可达时 1-3 秒内直接失败，不再长时间转圈后才报错。

- [x] 6.2 [P0][depends: 6.1][<=1h]
  输入：管理面板连接态文案
  输出：将“Connected”语义改为“Auth Ready”，避免误解为 endpoint 可达
  验证：UI 明确区分“认证可用”与“网络可达”。

- [x] 6.3 [P0][depends: 6.1][<=1h]
  输入：慢首包提示文案
  输出：提示升级为“可能非流式或网络不可达”
  验证：等待提示不再误导为纯流式问题。

## 7. 认证入口简化（P1）

- [x] 7.1 [P1][depends: none][<=1h]
  输入：Provider 连接入口
  输出：移除前置 Provider 下拉与弹窗，连接按钮直接拉起终端 `opencode auth login`，Provider 在终端流程中选择
  验证：管理面板内无前置选择步骤，点击连接即可启动认证流程。
