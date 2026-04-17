# Implementation Tasks: OpenCode Chat Stability & Performance Hardening

## 1. 模型防错（P0）

- [x] 1.1 [P0][depends: none][<=2h]
  输入：OpenCode 发送参数中的 `model`
  输出：前端 model gate（不匹配时回退到 engine 默认模型）
  验证：`claude-*` 在 OpenCode 发送时不再透传。

- [x] 1.2 [P0][depends: 1.1][<=2h]
  输入：后端 `engine_send_message`
  输出：OpenCode 分支 model fallback 兜底
  验证：即使前端状态污染，后端仍可避免 `Model not found`。

## 2. 性能降压（P0）

- [x] 2.1 [P0][depends: none][<=2h]
  输入：OpenCode 控制面板 refresh 流程
  输出：懒加载 + 节流 + in-flight 去重
  验证：发送中不触发额外 provider/session/catalog 重命令。

- [x] 2.2 [P0][depends: 2.1][<=2h]
  输入：provider catalog 获取逻辑
  输出：改为用户触发时加载，默认使用缓存
  验证：空对话首轮耗时明显下降。

## 3. 会话完整性（P1）

- [x] 3.1 [P1][depends: none][<=2h]
  输入：线程列表聚合逻辑
  输出：合并 OpenCode session list 到主线程列表
  验证：重启后 OpenCode 历史会话可见。

- [x] 3.2 [P1][depends: 3.1][<=2h]
  输入：pending->session 事件流
  输出：turn 绑定 + alias 窗口归并
  验证：回答不再“跳 new session”。

## 4. 回归与收口（P0）

- [x] 4.1 [P0][depends: 1.2,2.2,3.2][<=2h]
  输入：前后端改动
  输出：新增/更新测试
  验证：目标测试集通过。

- [x] 4.2 [P0][depends: 4.1][<=1h]
  输入：实现与结果
  输出：OpenSpec 校验通过并更新任务状态
  验证：`openspec validate --changes "2026-02-14-opencode-chat-stability-hardening" --json` 通过。

## 5. 隔离增强（P0）

- [x] 5.1 [P0][depends: 4.2][<=2h]
  输入：OpenCode 首轮慢与漂移场景
  输出：OpenCode-only 队列 in-flight watchdog（不改 Claude/Codex 行为）
  验证：OpenCode 队列不再出现 in-flight 长时间卡死。

- [x] 5.2 [P0][depends: 4.2][<=2h]
  输入：OpenCode 事件 payload
  输出：session id 递归提取增强，稳定 pending->session 绑定
  验证：OpenCode 会话不再偶发跳到新 session。

- [x] 5.3 [P0][depends: 4.2][<=1h]
  输入：自动命名触发链路
  输出：OpenCode 路径禁用 auto-title 后台任务（隔离于 Codex/Claude）
  验证：简单问候场景无标题后台线程干扰。

- [x] 5.4 [P0][depends: 5.1,5.2,5.3][<=2h]
  输入：新增隔离改动
  输出：补充/更新测试并通过验证
  验证：OpenCode 相关测试通过，Claude/Codex 关键回归测试通过。

- [x] 5.5 [P0][depends: 5.2][<=2h]
  输入：OpenCode 流式事件收尾
  输出：缺少 terminal event 时基于 post-response idle 的快速收口（OpenCode-only）
  验证：不再常态等待 120s idle timeout 才 turn completed。
