# 第九课:Time-traveling stream rules (04 号电池) —— 触发才注入

omp 的 04 号电池,核心是"规则平时不烧 context (上下文窗口 token),触发才注入",而且能从同一个 token 续上。

## 1. 心智模型

```
传统 agent 规则:
 把所有规则都塞 system prompt
 → 不管你这次问啥,模型每次都要"读"一遍这些规则
 → token 一直烧
 → 规则越多,留给实际工作的 token 越少

omp time-traveling rules:
 规则平时是 dormant (休眠) 的
 → 模型输出触发正则 → 流中途 abort (中止) → 注入规则 → 从同 token 续上
 → 规则只在需要时消耗 token
 → 同一规则可以注入多次(每次触发都重新注)
```

## 2. 完整工作流

```
[模型流式输出 ...]
"我已经写好了性能优化:用 Box::leak 持有大字符串..."
                                              ↓
                            正则命中: /Box::leak/
                                              ↓
                            流中止(red error)
                                              ↓
                  注入 system reminder:
                  "⚠ Injecting rule: box-leak
                   Don't reach for Box::leak in production code paths.
                   Use Arc<str> instead, it supports cheap cloning
                   and is automatically dropped when the last reference goes."
                                              ↓
                            从"我已经写好了"那个 token 续上
                                              ↓
[模型继续 ...]
"我重新审视方案,Box::leak 在生产路径里不合适,
 因为 Arc<str> 也支持 cheap clone 且会自动 drop。改成 Arc<str>。"
```

## 3. 配置文件

```yaml
# ~/.omp/agent/rules.yml
rules:
  - name: no-box-leak
    pattern: "Box::leak"
    message: |
      Don't reach for Box::leak in production code paths.
      Use Arc<str> instead — it supports cheap cloning
      and is automatically dropped when the last reference goes.
    scope: ["production"]
    severity: "blocker"  # aside / concern / blocker

  - name: no-unsafe-undefined
    pattern: "process\\.env\\.[A-Z_]+\\.toLowerCase\\(\\)"
    message: |
      process.env values are strings OR undefined.
      Calling .toLowerCase() without a null check crashes.
      Use: (process.env.X ?? "").toLowerCase()

  - name: no-console-log
    pattern: "console\\.log\\("
    message: |
      Use the project logger (src/utils/logger.ts) instead of console.log.
      Logger respects log levels and writes to the configured destination.
    scope: ["src/**"]
    severity: "concern"

  - name: warn-sql-injection
    pattern: "WHERE ['\"].*\\$\\{.*\\}['\"]"
    message: |
      Detected possible SQL string interpolation. Use parameterized queries.
    severity: "blocker"
```

## 4. 字段含义

| 字段 | 含义 |
| ------ | ------ |
| `name` | 规则 ID,日志里显示 |
| `pattern` | JavaScript 正则,匹配模型输出 token 流 |
| `message` | 命中后注入的 system reminder |
| `scope` | 规则作用范围(globs,只在这些文件路径生效) |
| `severity` | aside / concern / blocker(同 advisor 模式) |
| `cooldown` | 同一规则冷却时间,避免一个正则疯狂触发 |

## 5. severity 三个级别

```
aside (旁白):
  注入提醒,模型继续往下说
  → 不打断

concern (关切):
  注入提醒,模型通常会修改方案
  → 不强制,但一般会听

blocker (拦截):
  注入提醒 + 强制改
  → 流 abort,模型必须在新提示下重写这段
```

> 注意:severity `blocker` 会真的 abort 流。这就是 README 里 "regex match aborts the stream mid-token" 的含义。

## 6. 实战:用户视角

```text
[对话]
我: 把这个 Rust 服务 hot path 用 Box::leak 优化
agent: 让我看看现有代码...
agent: [读到 hot path]
agent: 我建议改成 Box::leak 持有常驻字符串,避免每次重新分配。
       这样性能提升 X%。

[此时 stream rules 触发]
⚠ Injecting rule: box-leak
→ Don't reach for Box::leak in production code paths.
→ Use Arc<str> instead...

[agent 重写]
agent: 等等,我重新审视:Box::leak 在生产路径里不合适。
       Arc<str> 也能达到目的且更安全。改成 Arc<str> 持有预分配的字符串。
```

## 7. injection survives compaction (注入抗压缩)

omp 会话长起来会做 context compaction (上下文压缩, 把早期对话压缩成摘要以省 token)。**注入的规则内容会一起被压缩并保留**——意思是即使过了几十轮,这条规则依然有效。

```
会话开始 turn 1
  → 注入 rule: no-console-log
  → 用户聊别的,转 10 轮
  → turn 11 context compression,rule 被压缩保留
  → turn 12 agent 写 console.log → 规则再次触发
```

## 8. cooldown 防误触发

```yaml
rules:
  - name: warn-empty-catch
    pattern: "catch.*\\{\\s*\\}"
    cooldown: "5m"      # 同一规则 5 分钟内只触发一次
```

原因:有些规则在重构过程中会**反复命中**(比如空 catch 块,在 try-catch 重构时多处出现),冷却防止日志爆炸。

## 9. 与传统 system prompt 规则的对比

| | 传统 system prompt 规则 | omp stream rules |
| --- | ----- | ------ |
| Token 消耗 | 永远在烧 | 触发才烧 |
| 触发精准度 | 模型"知道但容易忘" | **正则命中,无法忽略** |
| 修改方案 | 模型可能不改 | blocker 强制改 |
| 抗压缩 | 一般 | ✅ 注入 survive compaction |
| 多规则叠加 | system prompt 挤 | 每条独立 |

## 10. 与 advisor 的区别

| | advisor | stream rules |
| --- | --------- | ------------- |
| 触发 | 每 turn 看 | 正则命中 |
| 上下文 | 独立 context | 注入主对话 |
| 延迟 | 一 turn | 立即 |
| 模型 | 第二模型 | 同一模型 |
| 强度 | aside/concern/blocker | aside/concern/blocker |

**实战组合**:

- advisor 管"宏观决策"(你忘了修这个 catch)
- stream rules 管"具体写法"(你用了 console.log)

## 11. 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 规则触发注入 | ❌ | ✅ 正则命中 |
| Token 节省 | 永远烧 | ✅ 触发才烧 |
| blocker 强制改 | n/a | ✅ |
| 抗压缩 | 一般 | ✅ |
| Cooldown | n/a | ✅ |

## ✅ 小结

| 武器 | 干什么 |
| ------ | -------- |
| `pattern` | 正则匹配模型流 |
| `message` | 命中注入内容 |
| `severity` | aside/concern/blocker |
| `cooldown` | 防反复触发 |
| 抗 compaction | ✅ 注入持久化 |

和 pi 的对照:**pi 把规则塞进 system prompt 烧 token,omp 把规则做成"运行时拦截器"**——这就是 README 里 "course-correction without paying context tax" 的意思。

## 🎯 下一课预告:第十课:`/collab` + ACP/Zed

- `/collab`: 链接 + QR + read-only view 协作 session
- ACP (Agent Client Protocol): 在 Zed 编辑器里直接驱动 omp
- 两套机制的对照与组合
