# 第三课:智能协作 —— subagents + advisor + /review

这一课讲 omp 怎么把"一个 agent 单干"升级成"多 agent 协作",这是和 pi 心智差异最大的一块。

## 1. 为什么需要多 agent?

| 场景 | 单 agent 的痛苦 |
|------|-----------------|
| 大重构(把 50 个文件从 React 类组件迁到 Hooks) | context (上下文窗口) 撑爆、token 烧光、改到一半忘了初衷 |
| 同时审计前端/后端/测试/文档 | 串行太慢,质量也低(同一个模型同一种思维) |
| 监控正在跑的 agent 的判断 | 没人盯,模型写脏代码你也不知道 |

omp 用三种武器分别解决:

| 武器 | 场景 | 工具名 |
|------|------|--------|
| **`task` subagent (子代理 fan-out 扇出派发)** | 大任务拆分并行 | task |
| **advisor (顾问模型)** | 每 turn 旁听 | /advisor |
| **`/review` reviewer (审查者)** | 一次性出 verdict (裁决) | /review |

---

## 2. `task` 工具:subagent (子代理) fan-out (扇出派发)

### 2.1 心智差异(和 pi 比)

```
pi 的 subagent 子代理:
  ┌──── 主 agent ────┐
  │ 派一个对话:      │
  │ "帮我跑 X"       │
  └──────────────────┘
   ↓  prompt delegation (提示词委托):其实就是把任务文本丢给另一个会话窗口
   ↓ 产物: 一段 prose (自然语言描述)
   ↓ 父 agent 只能 parse (解析) 自然语言
```

```
omp 的 subagent 子代理:
  ┌─────────── 主 agent ───────────┐
  │ task { schema: {                │
  │   findings: [Finding]           │
  │ }, workers: 3 }                 │
  └─────────────────────────────────┘
   ↓ 派三个 worker,各自跑独立 worktree (隔离工作副本)
   ↓ 产物: schema-validated (按结构校验过的) JSON
   ↓ 父 agent 直接 .findings[0].path
   ↓ 自动 merge (合并) 回主 worktree
```

**最关键三点差异**:

1. **每个 worker 有自己独立的 worktree (Git 隔离工作副本)**——互不污染,不会有冲突
2. **产物是 schema-validated JSON (按结构校验过的)**——父 agent 不用猜 prose (自然语言) 意思
3. **fan-out (扇出派发) + fan-in (扇入汇总) 自动管理**——你只说"派 3 个",不写调度逻辑

### 2.2 一个完整例子

任务:**"把整个 src/ 从 React 类组件迁到 Hooks"**

```js
task {
  description: "React class→hooks migration",
  workers: [
    {
      name: "ComponentsExports",
      instructions: "扫描 src/components/**,列出所有 default + named exports + 依赖关系,产出 JSON",
      schema: {
        type: "object",
        properties: {
          exports: { type: "array", items: { $ref: "#/$defs/Export" } },
          dependencyGraph: { type: "object" }
        },
        required: ["exports", "dependencyGraph"]
      },
      worktree: ".omp-tasks/migration/components"
    },
    {
      name: "RoutesExports",
      instructions: "同样扫 src/routes/**",
      schema: { /* 同上 */ },
      worktree: ".omp-tasks/migration/routes"
    },
    {
      name: "HooksExports",
      instructions: "扫 src/hooks/**,返回所有 hook signatures",
      schema: {
        type: "object",
        properties: { hooks: { type: "array" } }
      },
      worktree: ".omp-tasks/migration/hooks"
    }
  ],
  verify: "all schemas passed"
}
```

omp 实际跑起来:
- 三个 worker **并行**(用便宜的 smol role 模型,如 minimax/MiniMax-M3)
- 各自在独立 worktree 里改
- 各自产出符合 schema-validated (按结构校验过的) 的 JSON
- 父 agent **直接读**: `result["ComponentsExports"].exports[0].path`
- 子代理间可走 **IRC (Internal-Robot Communication, 内部机器人点对点通信)**,比如 ComponentsExports 想问 HooksExports "你那个 useAuth 还在用吗?",直接发消息,不污染主对话

### 2.3 与 pi 对比表

| 维度 | pi subagent | omp `task` |
|------|-------------|-----------|
| 实现 | prompt delegation (提示词委托) | 独立进程 + 独立 worktree |
| 产物 | prose (自然语言) | schema-validated JSON (按结构校验过的) |
| 隔离 | 共用 cwd (当前目录) | 独立 worktree (隔离工作副本) |
| 并行 | 手动起多次 | 一句话 fan-out (扇出派发) |
| 子代理间通信 | 无 | IRC (Internal-Robot Communication) |
| 合并 | 手工 merge (合并) | 自动 fan-in (扇入汇总) |
| 失败处理 | 整段放弃 | 单 worker 失败不影响其他 |

### 2.4 Hub:运行时监控子代理

跑长任务时按 `Alt+A` 打开 **Agent Hub (协作中枢面板)**:

```
┌─ Agent Hub ──────────────────────────────┐
│ ComponentsExports  ● running  42s  $0.03 │
│ RoutesExports      ● running  38s  $0.02 │
│ HooksExports       ✓ done     12s  $0.01 │
│                                         │
│ Alt+Enter: 看实时 transcript (转录/对话流)│
│ /msg: 注入 steering message (引导消息)   │
│ /revive: 救活 parked worker (挂起子代理) │
│ /kill:   不影响父 session (父会话) 杀一个 │
└─────────────────────────────────────────┘
```

这一套 pi 完全没——pi 的 subagent 一旦派出去就只能等结果。

---

## 3. Advisor (顾问模型):每 turn 旁听

### 3.1 是什么

`advisor` 是给主 agent 配的**第二个模型**,它跑在独立的 context (上下文) 上,**每 turn 都读主 agent 的输出,然后注一条 note (注记)**:

```
注意 (note): 三种类型
├─ aside (旁白):      轻声提醒"这里要不要再想想"
├─ concern (关切):    严肃提醒"这里可能有问题"
└─ blocker (拦截):    硬性阻断"不修这个不准继续"
```

主 agent 看到 note 后要么 **course-correct (修正方向)**,要么告诉你 **为什么不改**。

### 3.2 配置

```yaml
# ~/.omp/agent/config.yml
modelRoles:
  default: anthropic/claude-opus-4.7
  advisor: anthropic/claude-sonnet-4.5  # 顾问用便宜模型

advisor:
  enabled: true
  trigger: "every_turn"   # 或 "after_tool",只在工具调用后触发
  style: "concise"        # 或 "verbose"
  blockOn: "blocker"      # 看到 blocker (拦截) 才真拦,其他只是 note (注记)
```

会话内开/关:

```text
/advisor status        # 看 advisor 配置
/advisor enable anthropic/claude-sonnet-4.5
/advisor disable
/advisor block         # 切到 blocker-only 模式(更激进)
```

### 3.3 实战场景

**任务**: "把 ENOENT 都 swallow (吞掉) 不抛错"

**主 agent 提案**:
```ts
// src/fs.ts
} catch (e) {
  if (e.code === 'ENOENT') return null;
  throw e;
}
```

**advisor (顾问模型) note (注记)**:
```
⚠ Advisor 1 note (concern): 这只 catch ENOENT,但其它 EACCES/EPERM 仍然 throw (抛出)。
  用户原话是"文件读不到就当空",你的实现只覆盖了 ENOENT 一种。
  建议: catch 所有 'ENOENT' 类型的错误并 swallow,或者和用户确认。
```

主 agent 看到后修正:catch EACCES/EPERM 也 swallow,再确认一遍。

### 3.4 与 pi 对比

| 维度 | pi | omp |
|------|-----|-----|
| 第二个模型旁听 | ❌ | ✅ |
| 独立 context | n/a | ✅(不污染主对话) |
| 分级(aside/concern/blocker) | n/a | ✅ |
| 阻断父 agent | n/a | ✅ blocker (拦截) 可强制停 |

---

## 4. `/review`:评审 + verdict (裁决) + 置信度

### 4.1 一句话定位

`/review` 派专门的 reviewer subagent (审查子代理) 并行扫你的改动,**出 P0-P3 + verdict (裁决) 的结构化结果**。

### 4.2 使用

```text
/review                       # 评审工作区未提交改动
/review HEAD                  # 评审 HEAD 这次 commit
/review HEAD~3..HEAD          # 评审最近 3 个 commit
/review main..feature/auth    # 评审分支差异
/review src/auth.ts           # 评审单文件
/review --depth=deep          # 深扫,慢但全
/review --depth=quick         # 浅扫,只要 P0/P1
```

### 4.3 输出格式

```
┌─ Review Verdict (裁决) ─────────────────┐
│                                          │
│  ⚠ REQUEST CHANGES                       │
│                                          │
│  P0 (紧急): 1                            │
│  P1 (高):   2                            │
│  P2 (中):   4                            │
│  P3 (低):   7                            │
│                                          │
│  Confidence (置信度): 0.78                │
└──────────────────────────────────────────┘

P0-1 [confidence: 0.95] src/auth.ts:42
  Race condition (竞态): 两个并发请求可能同时持有 refresh token,导致覆盖写。
  Suggested fix: 用 atomic compare-and-swap (CAS, 比较并交换) 或 mutex (互斥锁)。

P1-1 [confidence: 0.82] src/api/user.ts:118
  Missing input validation (缺少输入校验): 直接 .id 访问
  可能 undefined,产生 hard-to-debug crash。
```

### 4.4 关键属性

| 属性 | 说明 |
|------|------|
| **verdict** | APPROVE / REQUEST CHANGES / COMMENT 三选一 |
| **P0-P3** | 紧急 / 高 / 中 / 低,先修 P0 再修 P1,以此推 |
| **confidence (置信度)** | 0~1,低于 0.5 的 issue 可能误报 |
| **并行** | 多个 reviewer subagent (审查子代理) 并行扫不同目录 |
| **scope (范围)** | 工作区 / commit range (提交区间) / branch (分支) / file (单文件) |

### 4.5 与 pi 对比

| | pi | omp `/review` |
|---|-----|---------------|
| 触发方式 | 靠 prompt "请审查代码" | 一条 slash 命令 |
| 并行扫 | 无 | reviewer subagent (审查子代理) 并行 |
| 输出 | 一段 prose (自然语言) | P0-P3 + verdict (裁决) + confidence (置信度) |
| 优先级排序 | 无 | 显式 |
| 可信度 | 不知道哪条是真 | confidence score (置信度评分) |

---

## 5. 三件武器联动:实战大重构

```
目标: 把 src/ 从 React 类组件迁到 Hooks

Step 1 ─ fan-out (扇出派发) ─── task { 3 个 worker, schema-validated (按结构校验过的) JSON }
       ↓ 产物: exports map + dependency graph (依赖图)

Step 2 ─ advisor (顾问模型) 全程旁听 ─ 提示风险点

Step 3 ─ 主 agent 按 DAG (有向无环图) 顺序串行迁移
       每个文件用 hashline (按内容哈希锚点) 改(第二课)
       模式相似的批量改用 ast_edit (结构化改)(第二课)

Step 4 ─ /review HEAD ── reviewer subagent (审查子代理) 并行扫
       P0 必须修, P1 建议修, P2/P3 留给下次

Step 5 ─ Agent Hub (协作中枢面板) 监控全程
       子 worker 卡了 /revive 救活
       跑偏了 /msg 引导
```

## ✅ 小结

| 武器 | 解决什么 | 与 pi 的最大差异 |
|------|----------|------------------|
| `task` subagent (子代理) | 大任务并行 | typed yield (类型化产出) + 隔离 worktree |
| `advisor` (顾问模型) | 决策盲点 | 独立 context + aside/concern/blocker (旁白/关切/拦截) 三级 |
| `/review` (代码评审) | 一次性全审 | P0-P3 + verdict (裁决) + confidence (置信度) |

## 🎯 下一课预告:第四课:IDE 深度

- LSP (Language Server Protocol, 语言服务器协议) 怎么做到 rename 时自动改 barrel (集中导出文件)、re-export (重新导出)
- DAP (Debug Adapter Protocol, 调试适配器协议) 怎么挂 lldb (macOS C/C++ 调试器) / dlv (Go 调试器) / debugpy (Python 调试器) 真实调试
- ast_grep 怎么写 pattern 找代码坏味道(和 grep 的本质差异)
