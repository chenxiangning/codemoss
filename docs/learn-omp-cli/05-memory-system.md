# 第五课:Memory 系统 —— 让 agent 越用越聪明

> ⚠️ 注意:工具是 **setting-gated (配置开关控制)**、默认关闭的——memory 类工具(`retain`/`recall`/`reflect`/`memory_edit`/`learn`/`checkpoint`/`rewind`/`manage_skill`)都需要 `memory.backend` 显式打开。这是和 pi 的又一明显差异。

## 1. 心智模型:三层 Memory (记忆)

omp 的 memory 不是单一概念,而是**三层叠加**:

```
┌─────────────────────────────────────────────────────┐
│ Layer 3 · Skills (技能)                              │
│         learn + manage_skill → 跨项目的可复用 lesson │
│         (e.g. "这个项目用 bun 不用 npm")            │
├─────────────────────────────────────────────────────┤
│ Layer 2 · Long-term Facts (长期事实)                 │
│         retain + recall + reflect → 项目级知识库    │
│         (e.g. "auth 模块用 sessionStorage")         │
├─────────────────────────────────────────────────────┤
│ Layer 1 · Conversation (当前会话)                    │
│         checkpoint + rewind → 当次会话的快照+回溯    │
│         (e.g. "回到刚才那段探索前")                 │
└─────────────────────────────────────────────────────┘
```

三层关系:

- **Layer 1** 只活在当前会话,关掉就没
- **Layer 2** 跨会话,绑项目(worktree 根目录)
- **Layer 3** 跨项目,绑用户/团队

## 2. Layer 1:Conversation —— checkpoint (快照) + rewind (回溯)

### 2.1 checkpoint(打快照)

```text
[对话进行中...]
agent: 这个分支我有几个方案还在犹豫,先打个 checkpoint
→ checkpoint { reason: "before-exploring-auth-rewrite-options" }
```

omp 把当前上下文 + 临时状态打成一个**有名字的快照**,可以在后面回溯。

### 2.2 rewind(回溯)

```text
agent: 刚才那段绕远了,rewind 到 checkpoint
→ rewind { to: "before-exploring-auth-rewrite-options", keep: "concise_report" }
```

回溯后,omp 把中间的探索过程**压缩成一段 concise report (简明报告)**保留下来,避免重做同样的事。原始上下文被砍掉,但**结论留下**。

### 2.3 和 pi 的对比

| | pi | omp |
| --- | ----- | ----- |
| 主动回溯 | ❌(只能翻历史) | ✅ checkpoint + rewind |
| 探索后保留结论 | ❌ | ✅ `keep: "concise_report"` |
| Token 节省 | 手动 `/compress` | 自动 |

### 2.4 实战场景

```
场景: 重构方案从 A 改 B 改 C,最后发现 A 最对

[checkpoint: A 开始前]
[agent 探索 A] → 不理想
[checkpoint: B 开始前]
[agent 探索 B] → 不理想
[checkpoint: C 开始前]
[agent 探索 C] → 回到 A

rewind { to: "A 开始前", keep: "concise_report" }
// → 报告: "B/C 方案因 X/Y 问题不可行,选 A,理由: ..."
// → 上下文清零,但结论保留
```

## 3. Layer 2:Long-term Facts (长期事实) —— retain / recall / reflect

### 3.1 三个核心工具

| 工具 | 干什么 | 何时用 |
| ------ | -------- | -------- |
| `retain` | 写入事实 | agent 发现值得记住的真相 |
| `recall` | 读事实 | 需要查"上次是怎么做的" |
| `reflect` | 综合事实 | 需要"综合 N 条事实得答案" |

### 3.2 三种 backend (后端存储)

```yaml
# ~/.omp/agent/config.yml
memory:
  backend: "local"      # 默认:本地文件,SQLite
  # 或
  backend: "hindsight"  # 自托管 memory server
  # 或
  backend: "mnemopi"    # omp 自研,带向量检索 + 自动去重
  scope: "project"      # 默认:绑项目(worktree 根目录)
  # 或
  scope: "user"         # 绑用户(跨项目)
  # 或
  scope: "global"       # 绑全局
```

| backend (后端) | 适合谁 | 特征 |
| ------ | -------- | ------ |
| `local` | 个人单机 | 简单 SQLite,快,无依赖 |
| `hindsight` | 团队共享 | 中心化服务,跨机器 |
| `mnemopi` | 重度用户 | 向量检索 + 自动 dedup (去重) + 总结 |

### 3.3 实战:retain 工作流

```text
[用户]
auth 模块改完了,记住以后用 sessionStorage 而不是 localStorage。

[agent 行为]
自动触发 retain:
{
  fact: "auth 模块的 token 必须存到 sessionStorage,不能用 localStorage",
  tags: ["auth", "storage", "gotcha"],
  scope: "project",
  confidence: 1.0
}
```

或者 agent 自己判断该 retain:

```text
[agent]
"我刚才调试了 30 分钟才找到 race condition (竞态条件),因为多个请求会并发触发 refresh。
retain { fact: 'refresh token 必须用 atomic CAS (比较并交换),不能用普通赋值', tags: ['auth', 'race'], confidence: 1.0 }"
```

### 3.4 recall / reflect

```text
[用户]
我之前问你 auth 模块怎么存 token?

[agent]
recall { query: "auth token 存储" }
// → 命中 Layer 2 里的事实:
// "auth 模块的 token 必须存到 sessionStorage,不能用 localStorage"
```

更复杂的:

```text
[用户]
我现在重构 auth,要考虑哪些 race condition?

[agent]
reflect { query: "auth race condition" }
// → 不只是单条事实,而是综合 3 条相关事实给个回答:
// "你之前记录过:
//  1. refresh token 必须用 atomic CAS (2026-07-12)
//  2. ENOENT 不能 swallow,要 throw 让上层处理 (2026-08-15)
//  3. oauth callback 不在 auth 模块里,在 routes/oauth.ts (2026-07-30)
// 综合考虑,你重构时需要保证 refresh 用 CAS + 不要破坏 callback 路由。"
```

### 3.5 memory_edit(精确管理)

```text
memory_edit {
  action: "forget",
  id: "fact-2026-07-12-abc"
}
// → 删掉某条事实(过期/错了)

memory_edit {
  action: "invalidate",
  ids: ["fact-xxx", "fact-yyy"]
}
// → 标为"作废",不被 recall 命中,但保留历史
```

### 3.6 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 项目级 long-term memory | ❌(只有当前会话) | ✅ retain/recall/reflect |
| 后端可插拔 | n/a | ✅ local / Hindsight / Mnemopi |
| scope 控制 | n/a | ✅ project / user / global |
| 自我检索 / 综合 | n/a | ✅ recall 单条,reflect 综合 |

## 4. Layer 3:Skills (技能) —— learn + manage_skill

### 4.1 learn(捕获可复用 lesson)

`retain` 存事实,`learn` 存**可复用的方法论**:

```text
[用户]
这种 TS 项目别用 npm,用 bun,bun install 跑得快 5x,test 也不一样。

[agent]
learn {
  lesson: "这个项目用 bun,不用 npm;test 用 bun test,不是 jest",
  scope: "project",
  promote: false   # false = 仅项目;true = 全局可复用
}
```

下次新会话开局:

```text
[新会话第一 turn]
agent 自动 recall: "这个项目用 bun,不用 npm"
→ 给出命令用 bun 而不是 npm
```

### 4.2 promote 到 managed skill (托管技能)

特别有价值的 lesson 可以 **promote (提升) 成 managed skill (托管技能)**:

```text
manage_skill {
  action: "promote",
  lessonId: "lesson-2026-08-15-xyz",
  skillName: "bun-project-setup",
  manifest: {
    description: "在用 bun 的项目里初始化/构建/测试的标准流程",
    steps: [
      "bun install 代替 npm install",
      "bun test 代替 jest",
      "bun run dev 启动"
    ]
  }
}
```

之后:

```text
[新会话]
agent: "我注意到这个项目有 bun-project-setup skill,要不要按它的流程做?"
```

### 4.3 Skill 文件位置

```bash
~/.omp/skills/                  # 全局 managed skill
~/.omp/agent/skills/            # 项目级
~/.omp/agent/skills-lock.json   # 锁文件(记录已加载 skill)
```

> 这是 omp 把"项目知识"和"插件机制"打通的设计——skill 不只是文本,而是带 manifest 的可发现对象。

### 4.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 可复用 lesson | ❌ | ✅ learn + manage_skill |
| Skill 化提升 | n/a | ✅ promote |
| Lock 文件保护 | n/a | ✅ skills-lock.json |

## 5. 三层联动:一个完整工作流

```
[新会话开始]
1. recall project  ←  Layer 2 自动加载:项目事实
2. check skills    ←  Layer 3 自动加载:可复用方法论
[对话进行中]
3. checkpoint      ←  Layer 1:重要节点打快照
4. retain fact     ←  Layer 2:发现新事实就写入
5. learn lesson    ←  Layer 3:发现可复用方法就捕获
[会话结束]
6. reflect         ←  Layer 2:综合这次的事实形成 mental model (心智模型)
7. rewind          ←  Layer 1:回溯到 checkpoint,扔掉探索过程
```

## 6. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| 当前会话回溯 | 翻历史 | ✅ checkpoint + rewind |
| 项目事实记忆 | ❌ | ✅ retain + recall + reflect |
| 跨项目 skill | ❌ | ✅ learn + manage_skill |
| 后端可插拔 | n/a | ✅ local / Hindsight / Mnemopi |
| Scope 控制 | n/a | ✅ project / user / global |
| Lock 保护 | n/a | ✅ skills-lock.json |

## ✅ 小结

| 武器 | 层级 | 干什么 | 何时用 |
| ------ | ------ | -------- | -------- |
| `checkpoint` + `rewind` | 当前会话 | 探索中打快照 | 怕走弯路 |
| `retain` | 项目事实 | 写一条事实 | 发现真理/坑 |
| `recall` | 项目事实 | 读单条 | 复用上次 |
| `reflect` | 项目事实 | 综合多条 | 给完整答案 |
| `learn` | 可复用方法 | 写一条 lesson | 跨会话复用 |
| `manage_skill` | 托管技能 | promote / 编排 | 多人/多项目 |

和 pi 的对照:**pi 每次都是冷启动**,**omp 会越来越懂你的项目**——这就是 README 里 "Memory the agent curates" 的含义。

## 🎯 下一课预告:第六课:多模型协作实战

- `retry.fallbackChains` 怎么写——主 provider 429 时自动切备用
- 凭据轮询 (round-robin): 多 key 池防单 key 烧额度
- 按路径 scoped (限定范围) model: 这个子目录用 Claude,那个用本地
- Coding Plan OAuth 怎么 `/login` 接入 Cursor / Copilot / GLM / Kimi
