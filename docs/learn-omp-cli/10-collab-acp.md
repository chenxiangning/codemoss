# 第十课:`/collab` + ACP/Zed —— 协作 session 与编辑器集成

把 omp 从"个人工具"扩展到"团队协作"和"编辑器原生"。

## 1. `/collab`:把 session 分享出去(07 号电池)

### 1.1 一句话定位

```
omp /collab        → 把当前 session 放到 relay,生成链接 + QR
omp join <code>    → 别人从终端加入(可读写)
/collab view       → 生成只读链接(看不能用)
```

不是"分享屏幕",而是"分享 agent 状态"。

### 1.2 启动协作

```text
[当前 session]
/collab

[omp 输出]
┌──────────────────────────────────────────┐
│ ✓ Collab session started!                │
│                                          │
│ 加入命令:  omp join 4f7b-9c2e-aa11       │
│ 浏览器:    https://my.omp.sh/s/4f7b-9c2e │
│                                          │
│ ⚠ Anyone with this link can watch the    │
│   session but cannot prompt the agent.   │
│                                          │
│       [QR CODE]                          │
└──────────────────────────────────────────┘
```

### 1.3 两种模式

| 模式 | 加入方式 | 谁能动 agent |
| ------ | --------- | ----------- |
| 默认(`/collab`) | `omp join <code>` | **多人可读写**(共享 prompt 输入) |
| 只读(`/collab view`) | 浏览器链接 | 只能看,没人能 prompt |

### 1.4 安全模型

- **Frames (帧内容) 端到端加密**:relay 服务只转发密文,看不到 agent 输入输出
- relay **永远见不到你的 API keys**:auth token 不通过 relay
- 加入码是一次性的,可撤销

```
你的 session ←→ relay ←→ 加入者
        ↑
   加密的 agent frames (帧)
```

### 1.5 实战场景

#### 场景 1:code review 协作

```text
[你跑 omp 改一堆东西]
/collab
→ 复制链接发给 reviewer
→ reviewer 浏览器打开,看着你一步步操作
→ 中途 reviewer 在另一个 omp 跑 /msg "这里为啥不 await"
→ 你的 agent 收到 msg (消息),改写代码
```

#### 场景 2:Pair programming (结对编程)

```text
[你 + 同伴 各自跑 omp]
A: /collab
B: omp join <code>
→ A 主导,B 可以 prompt 干预
→ 真正的"两个人同时操控一个 agent"
```

#### 场景 3:课堂演示

```text
[老师跑 omp 教学]
/collab view
→ 学生扫码只看不能动
→ 老师操作,学生围观学习
```

### 1.6 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 链接分享 | ❌ | ✅ |
| QR 码 | ❌ | ✅ |
| 浏览器只读 view | ❌ | ✅ |
| 端到端加密 | n/a | ✅ |
| 中途 `msg 引导 | ❌ | ✅ |

## 2. ACP:Agent Client Protocol(14 号电池)

### 2.1 是什么

ACP 是 omp 和外部编辑器之间的**专用协议**——让编辑器可以**作为 client 直接驱动 omp**。

不是 VSCode 插件市场那种"extension 扩展",而是**协议级集成**。

### 2.2 支持的编辑器

目前 **Zed** 一等公民。其他编辑器通过 ACP SDK 可接入:

```text
Zed (官方)
├── 直接读你正在看的 buffer (编辑器缓冲区)
├── 通过 editor 的 save path 写文件
├── 在 editor 的 terminal 跑 shell
└── 复用 editor 的 permission prompt (权限提示)
```

### 2.3 ACP vs VSCode plugin

```
VSCode + Claude Code plugin:
  - 是 webview (网页内嵌视图) 套壳,自己实现 chat UI
  - 共享文件读取,但写要通过 save action (保存动作) 提示
  - 终端是新开 tab

Zed + omp ACP:
  - agent 读你**正在打开的 buffer**
  - agent 写**直接走 editor save path**,自动触发 LSP/format
  - shell 在 editor 自带 terminal 里跑,保持 cwd (当前目录) 一致
  - **同一 agent、同一状态、两个表面**(终端和编辑器)
```

### 2.4 启动方式

```text
# 在 Zed 里装 omp ACP 集成
# (按 zed 官方文档安装)
# 然后在 Zed command palette (命令面板) 里:
> ACP: Start omp
→ Zed 启动 omp 子进程
→ Buffer 共享 / terminal 共享 / permission 共享
```

### 2.5 实战:在编辑器里使用 agent

```text
[你在 Zed 打开 src/auth.ts]
[光标停在 login() 函数名上]
[按 Ctrl+K → "Ask omp about this symbol"]

omp: [自动 read 当前 buffer 上下文]
     "这个函数在 src/auth/login.ts 里,它的引用是..."
     [在 Zed terminal 面板里流式输出]
     [建议改:把 if/else 拆开]
     [你按 Accept 按钮 → 走 editor save path → LSP 自动 trigger → 类型检查过]
```

### 2.6 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 编辑器原生集成 | ❌(要写 adapter) | ✅ Zed 一等 |
| 共享 buffer | ❌ | ✅ |
| 编辑器 save 路径 | ❌ | ✅ |
| 编辑器 terminal | ❌ | ✅ |
| Permission 共享 | ❌ | ✅ |

## 3. `/collab` + ACP 组合

最实用的组合:**你在 Zed 里工作,中途开 `/collab` 给同伴**。

```
你(Zed + ACP 驱动 omp)
 │
 ├── 你在 buffer 里看代码、写代码
 ├── agent 在 editor terminal 里跑
 └── /collab 链接发给 reviewer
       │
       └── reviewer 浏览器打开只读 view
            │
            └── 看到你的 buffer 变化 + agent 实时输出
```

## 4. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| Session 分享 | ❌ | ✅ `/collab` |
| QR + 浏览器 view | ❌ | ✅ |
| 多端加入 | ❌ | ✅ `omp join` |
| 编辑器协议 | ❌ | ✅ ACP |
| Zed 原生 | ❌ | ✅ |

## ✅ 小结

| 武器 | 干什么 |
| ------ | -------- |
| `/collab` | 起协作 session,链接 + QR |
| `omp join <code>` | 加入读写 |
| `/collab view` | 生成只读链接 |
| ACP | 编辑器集成协议 |
| Zed | 一等 ACP client |

和 pi 的对照:**pi 是单人本地工具,omp 是协议化的协作平台**。

## 🎯 下一课预告:第十一课:继承 + 16 个 schemes

- 8 种 agent 规则格式原生兼容(Cursor MDC / Cline .clinerules / Codex AGENTS.md / ...)
- 16 个内部 schemes:pr:// / issue:// / agent:// / skill:// / ssh:// / conflict:// / xd://
- 一个 `read` 工具,搞定所有路径
