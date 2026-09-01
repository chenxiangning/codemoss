# 第一课:启动、模型、工具调用 —— 与 pi 的对比

## 1. 安装 & 版本

```bash
# pi(已装)
bun add -g pi-coding-agent

# omp
brew install can1357/tap/omp            # macOS
curl -fsSL https://omp.sh/install | sh  # 任意平台
bun install -g @oh-my-pi/pi-coding-agent # Bun 全局

# 版本核对
omp --version
opencode --version
pi --version
```

> 小坑:omp 在 Alpine/musl (轻量 C 标准库) 上要 `apk add libstdc++ libgcc`;Windows 走 `irm https://omp.sh/install.ps1 | iex`。

## 2. 启动与 shell completion (命令行补全)

```bash
# 进交互式 TUI (文本用户界面)
omp
# 带任务直接跑(类似 pi)
omp "在 src/ 里找出所有 TODO"
# 子命令形式
omp login         # 按 provider (模型提供方) 走 OAuth/Coding Plan
omp setup         # 交互式选择默认模型
omp models spark  # 测试自定义 OpenAI-compatible (兼容 OpenAI 接口) provider
omp completions zsh  # 生成 zsh 补全(动态扫所有 flag)
omp join <code>   # 加入协作 session
```

### 补全机制对比

| | pi | omp |
|---|-----|-----|
| 静态 + 动态? | 部分 | **全动态**(`completions` 子命令实时扫) |
| 覆盖范围 | 命令/flag (命令行参数) | 命令/flag/enum (枚举) 值/模型名/`--resume` id |

```bash
# 加进 ~/.zshrc
eval "$(omp completions zsh)"
```

完成之后:`--model`、`--smol`、`--slow`、`--plan`、`--resume <session-id>` 都会自动补全。

## 3. 模型与 10 个 role (角色)

**pi** 只有"当前模型"一个概念,想换模型就 `--model xxx` 或 `/model`。

**omp** 把模型按"role"路由。`~/.omp/agent/config.yml`:

```yaml
modelRoles:
  default: openai-codex/gpt-5.5        # 日常 turn (一轮对话)
  smol:    minimax/MiniMax-M3-fast      # subagent fan-out 用便宜模型
  slow:    anthropic/claude-opus-4.7    # 深度推理
  plan:    anthropic/claude-opus-4.7    # plan mode 专用
  commit:  openai-codex/gpt-5.5         # changelog (变更日志)
  advisor: anthropic/claude-sonnet-4.5  # 06 旁听模型
  vision:  google/gemini-3-flash
  task:    minimax/MiniMax-M3           # subagent 工作模型
  tiny:    minimax/MiniMax-M3-tiny
  designer: openai/gpt-image-1
```

启动时临时覆盖某个 role:

```bash
omp --smol "扫所有 console.log"
omp --slow "重构 auth 模块"
omp --plan "设计新 API"   # 强制 plan mode
```

会话内运行时切:`Ctrl+P` 轮询当前 role 的可选模型,`/model` slash 命令全 role 重选。

> 实战意义:同样一个 `task` 工具调起一堆 subagent,**主 agent 用 opus、subagent 用 haiku**(便宜 20×);advisor 用 sonnet 旁听。三个模型同时跑、自动路由。

## 4. 启动 flag (命令行参数) 全表

| flag | 作用 | pi 有吗 |
|------|------|:---:|
| `--model <id>` | 覆盖 default 模型 | ✅ |
| `--smol` | 用 smol role 模型 | ❌ |
| `--slow` | 用 slow role | ❌ |
| `--plan` | 强制 plan mode | ❌(pi 有 plan mode 但不是 flag) |
| `--tools read,edit,bash` | **限制工具集** | ⚠️ 较弱 |
| `--resume <id>` | 续接 session (会话) | ✅ |
| `--cwd <dir>` | 指定工作目录 | ✅ |
| `--system <text>` | 临时追加 system 提示 | ✅ |

`--tools` 这条很强:你想让 agent "只能读不能写",就 `omp --tools read,grep,glob "审计这段代码"`,那些写操作直接拒绝。

## 5. 31 个工具的"调用层"和 pi 的差异

**完全对齐 pi**(可直接迁移用法):
- `read` / `write` / `edit` / `grep` / `glob` / `bash` / `todo` / `ask`
- `task` (subagents 子代理) / `web_search` ❌(pi 没有,要自己接)

**改写/增强(同名但行为不同)**:
- `read` 现在是个**多协议统一入口**:文件、目录、归档、SQLite、PDF、Notebook、URL、远程 `ssh://`,以及 16 个内部 scheme (`pr://`、`issue://`、`agent://`、`skill://`、`conflict://`、`xd://`)
- `edit` 走 **hashline 锚点**(按内容哈希定位),不是 `oldText/newText` 字符串替换(见第二课)
- `bash` 跑的是 **brush bash fork (基于 brush 的 bash 实现)**(JS 里的 bash 实现),46 个 coreutils (核心 Unix 工具集) 内置,**零 fork/exec (零子进程派生)**。意味着 grep/sed/jq/xargs 都跑在你 agent 进程里,跨 Mac/Linux/Windows 行为一致
- `eval` 是新增的,**持久 Python + JS cell**(`eval "import pandas as pd; df = pd.read_csv('a.csv'); df.head()"`)。Python cell 里能回调 agent 自己的工具(读文件、grep、起 subagent)

**纯新增**:
- `ast_edit`、`ast_grep`、`lsp`、`debug`、`security_scan`
- `browser`、`computer`、`inspect_image`、`generate_image`、`tts`、`github`
- `hub`、`checkpoint`、`rewind`、`retain`、`recall`、`reflect`、`memory_edit`、`learn`、`manage_skill`

## 6. 与 pi 的"心智模型"差异(最容易踩的坑)

| 维度 | pi 心智 | omp 心智 |
|------|--------|----------|
| 一次只有一个模型在跑 | ✅ | ❌,**多模型协作**:主 + advisor + subagents 同跑 |
| 工具是黑盒 | ✅ | ⚠️ `xd://<device>` 是"被禁用的 discoverable (可发现的) 设备",需要 `tools.xdev: true` 才开 |
| 编辑靠字符串替换 | ✅ | ❌,**content-hash (内容哈希) 锚点**——stale (过时) 文件直接拒(第二课) |
| 子进程到处 fork (`grep` 调外部 binary) | ✅ | ❌,全部 in-process (进程内执行) |
| 规则永远生效 | ✅ | ⚠️,**time-traveling rules (时间旅行规则)**:规则平时不烧 context,触发才注入(注:本课程暂不展开) |

## ✅ 小结

- omp = pi 的 fork + Rust 内核 + 21 块新电池 + 多模型 + 31 工具
- 多出来的关键概念:`modelRoles`(10 种路由)/ `--tools` 限制 / `xd://` 设备 / `ast_edit` 预览 / `pr://` 等 schemes (协议路径)
- 与 pi 相同的部分:`read/write/edit/grep/glob/bash/todo/ask/task` 调用语法

## 🎯 下一课预告:第二课:编辑革命

- 为什么 `old_text` 会被 `edit` 拒?——omp 的 stale-anchor (过时锚点) 防御
- `ast_edit` 怎么做到"先预览后接受"
- `conflict://1` 这种 URL 怎么把 merge 冲突变成一行命令
