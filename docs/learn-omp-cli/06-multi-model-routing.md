# 第六课:多模型协作实战 —— provider/role/凭据池/fallback 全配置

第一课提过 modelRoles (模型角色) 是 omp 和 pi 的最大心智差异。这一课**深入到运维层面**,讲真实生产里 60+ provider (模型提供方) 怎么用得稳。

## 1. 全局视角:omp 怎么决定"这次 turn 用哪个模型"

```
┌────── 用户启动 ──────┐
│ omp --smol "扫 console.log" │
└──────────────┬──────────────┘
               │
               ▼
┌──── role 选择 ────────────┐
│ 看 flag:--smol → smol role │
│ 没 flag → default role │
└──────────────┬──────────────┘
               │
               ▼
┌── modelRoles 路由 ────────────┐
│ modelRoles.smol: anthropic/claude-haiku-4.5 │
│ → 选 provider: anthropic │
│ → 选 model: claude-haiku-4.5 │
└──────────────┬──────────────┘
               │
               ▼
┌── provider 配置查表 ─────────┐
│ providers.anthropic: │
│  api: anthropic-messages │
│  apiKey: <key> # 或多个轮询 │
│  baseUrl: https://api.anthropic.com │
└──────────────┬──────────────┘
               │
               ▼
┌── retry / fallback 链 ─────────────┐
│ 主模型 429 → 切 fallback chain │
│ 多个 apiKey → round-robin │
└──────────────┬──────────────┘
               │
               ▼
            发请求
```

任何一步都可能影响最终"哪把钥匙、调哪个地址、撞墙后找谁"。

## 2. 完整 config.yml 骨架

```yaml
# ~/.omp/agent/config.yml

# ─────── 1. 模型角色路由 ───────
modelRoles:
  default: openai-codex/gpt-5.5
  smol:    anthropic/claude-haiku-4.5
  slow:    anthropic/claude-opus-4.7
  plan:    anthropic/claude-opus-4.7
  commit:  openai-codex/gpt-5.5
  advisor: anthropic/claude-sonnet-4.5
  vision:  google/gemini-3-flash
  task:    anthropic/claude-haiku-4.5
  tiny:    anthropic/claude-haiku-4.5
  designer: openai/gpt-image-1

# ─────── 2. Provider 配置(可省略,omp 内置了 60+ 的默认)───────
providers:
  anthropic:
    api: anthropic-messages
    apiKey: "${ANTHROPIC_API_KEY}"
  openai-codex:
    api: openai-codex-responses
    oauth: true                # 走 OAuth,不走 apiKey
  zai:                         # GLM Coding Plan
    api: openai-completions
    apiKey: "${ZAI_API_KEY}"
    baseUrl: https://api.z.ai/v1

# ─────── 3. 重试与回退链 ───────
retry:
  attempts: 3
  backoff: exponential
  fallbackChains:
    default:
      - openai-codex/gpt-5.5          # 主
      - anthropic/claude-opus-4.7     # 备用 1
      - minimax/MiniMax-M3            # 备用 2
    smol:
      - anthropic/claude-haiku-4.5
      - minimax/MiniMax-M3-fast
  onQuotaWall:
    cooldown: "5m"                    # 配额墙撞墙后 5 分钟内不再试这个
    restore: "1h"                     # 1 小时后恢复尝试

# ─────── 4. 凭据池(round-robin 轮询)───────
credentialPool:
  anthropic:
    - "${ANTHROPIC_API_KEY_1}"
    - "${ANTHROPIC_API_KEY_2}"
    - "${ANTHROPIC_API_KEY_3}"
  strategy: round-robin                # 或 "session-affinity"(同一会话绑同一 key)
  perCredentialBackoff:                # 某 key 撞墙后
    cooldown: "10m"                    # 这个 key 冷却 10 分钟
    otherKeysContinue: true            # 其他 key 继续工作

# ─────── 5. 路径 scope (限定范围)───────
# 在某个子目录里走不同模型集,不影响全局
pathScopes:
  - path: "./experimental/**"
    modelRoles:
      default: minimax/MiniMax-M3        # 实验性项目用本地便宜的
  - path: "./legacy/**"
    enabledModels: []                    # 空=禁模型,只读不允许写
    disabledProviders: ["anthropic"]     # 禁止调某个 provider
```

> 配置可用 YAML/JSON/TOML,omp 兼容你已经写好的其他 agent 配置文件(见 omp 15 号电池)。

## 3. Fallback Chain (回退链) —— 撞墙不挂

### 3.1 触发场景

| 场景 | 表现 |
| ------ | ------ |
| 主 provider 429 (请求过多) | 立刻切下一个 |
| 主 provider 5xx (服务器错误) | 重试 N 次 → 切下一个 |
| 网络断开 | 超时后切下一个 |
| Quota wall (配额墙) | 按 cooldown 切下一个 |
| 模型拒绝输出 | 不算撞墙,正常回传 |

### 3.2 fallback 链行为

```
发请求到 openai-codex/gpt-5.5
  → 429 Too Many Requests
  → 立即切到 anthropic/claude-opus-4.7(原本回合剩下的也由它接着干)
  → 成功,返回
```

注意:**不是重新发请求,是把"剩余的对话"交给下一个模型**。这意味着 fallback 模型必须能读懂前面累积的上下文。omp 内部用统一格式转发,模型厂商无关。

### 3.3 onQuotaWall (撞配额墙)

某些 provider(如 Anthropic)会在你**短时间用超量**时锁你,但不是错误码,而是 30 秒后才返回 200(opaque, 不透明的慢响应)。fallback chain 帮不上忙,要用 quota wall 检测:

```yaml
retry:
  onQuotaWall:
    cooldown: "5m"
    restore: "1h"
```

omp 内部跟踪:

- 每个 provider 的 quota 状态(已触墙 / 冷却中 / 恢复)
- 触墙后 5 分钟内不走这个 provider
- 1 小时后自动尝试恢复

### 3.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 多模型 fallback (回退) | 手动 `--model` 切 | ✅ fallback chain 自动 |
| 撞墙检测 | 无 | ✅ quota wall 跟踪 |
| 冷却 / 恢复 | n/a | ✅ 自动 |

## 4. Credential Pool (凭据轮询) —— 多 key 防烧额度

### 4.1 场景

你买了 5 个 Claude API key(每 key 100$/月额度),希望:

- 不要一个 key 烧完才用下一个
- 撞墙的那个冷却,其它照常用
- 同一个 session 绑同一个 key(避免对话中切 key 引起 prompt cache (提示缓存, 跨请求复用已计算的提示) 失效)

### 4.2 配置

```yaml
credentialPool:
  anthropic:
    - "${ANTHROPIC_API_KEY_1}"
    - "${ANTHROPIC_API_KEY_2}"
    - "${ANTHROPIC_API_KEY_3}"
    - "${ANTHROPIC_API_KEY_4}"
    - "${ANTHROPIC_API_KEY_5}"
  strategy: "session-affinity"   # 或 "round-robin"
  perCredentialBackoff:
    cooldown: "10m"
    otherKeysContinue: true
```

| strategy (调度策略) | 行为 | 适用 |
| ---------- | ------ | ------ |
| `round-robin` (轮询) | 每请求轮换 key | 高并发、负载均摊 |
| `session-affinity`(会话粘性,默认) | 同一 session 绑同一 key,新 session 才轮换 | 保护 prompt cache |

### 4.3 实战价值

```
单 key 配置:
 09:00 开始跑
 11:30 这个 key 烧完,任务中断 30 秒后才报错
 11:35 agent 重试,还是这个 key,失败
 11:40 用户手动换 key
 12:00 才能继续
 → 总停机 30 分钟

5-key 轮询:
 09:00 开始跑,每 key 跑 50 分钟
 11:30 第 1 个 key 烧完,自动冷却,继续用 2/3/4/5
 持续工作 4 小时才把所有 key 烧完
 → 用户加新 key,继续
```

### 4.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 多 key 池 | ❌(手动切换) | ✅ 凭据池 + 自动轮询 |
| Session affinity (会话粘性) | n/a | ✅ |
| Per-key backoff (按 key 退避) | n/a | ✅ |

## 5. Path-scoped Models (按路径限定范围的模型)

### 5.1 场景

```
my-mono-repo/
├── apps/
│   ├── experimental/        # 实验性,用便宜模型
│   │   └── ai-playground/
│   ├── prod/                # 生产,opus
│   │   └── customer-portal/
│   └── legacy/              # 维护,只读不开模型
│       └── old-erp/
├── libs/
│   ├── shared/              # 全公司核心,opus
│   └── ui/                  # 通用 UI,sonnet
```

### 5.2 配置

```yaml
pathScopes:
  - path: "./apps/experimental/**"
    modelRoles:
      default: minimax/MiniMax-M3          # 便宜模型
  - path: "./apps/prod/**"
    modelRoles:
      default: anthropic/claude-opus-4.7   # 最强模型
      smol: anthropic/claude-haiku-4.5
  - path: "./libs/shared/**"
    modelRoles:
      default: anthropic/claude-opus-4.7
  - path: "./legacy/**"
    enabledModels: []                       # 空列表=完全禁模型
  - path: "./vendor/**"
    disabledProviders: ["openai-codex"]      # vendor 代码不调某些 provider
```

### 5.3 行为

- 路径用 gitignore-style glob (通配模式)
- **作用域包括 path 和它下面所有子目录**
- 全局 `modelRoles` 是默认,被 path 覆盖
- 多 path 嵌套时,**最深的 path 赢**

### 5.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 按路径切换模型 | ❌(只能全局) | ✅ path-scoped |
| 子目录覆盖 | n/a | ✅ 最深 path 赢 |
| 禁模型 / 禁 provider | n/a | ✅ enabledModels / disabledProviders |

## 6. Coding Plan OAuth 接入

### 6.1 3 种 auth (鉴权) 模式

omp 把所有 provider 的"我怎么授权"抽象成 3 种标签:

| 标签 | 含义 | 示例 |
| ------ | ------ | ------ |
| `oauth` | 走 OAuth (开放授权协议),浏览器登录一次拿 token | Anthropic / OpenAI Codex / Cursor / Copilot / Qwen Portal / SuperGrok |
| `plan` | 走 Coding Plan (订阅套餐) 的专用额度路由 | Cursor / Kimi / GLM / Qwen / Umans / Z.AI |
| `local` | 本地模型服务器,key 可选 | Ollama / LMStudio / llama.cpp / vLLM |

> ⚠️ **关键事实**:某些 provider(如 Anthropic、OpenAI、xAI)**同一个 API key 走 plan 路径和直连路径会判别不同**——GLM 同 key 直连是 429 余额不足,但走 MCP server (官方 MCP 包装层) 就是套餐额度。omp 直接接 `oauth` 或 `plan` 标签都帮你避开。

### 6.2 /login 工作流

```text
/login anthropic         # OAuth 浏览器,登录拿 token
/login cursor            # Cursor Coding Plan
/login copilot           # GitHub Copilot
/login zai               # GLM Coding Plan(你已经在用)
/login kimi              # Kimi Code
/login qwen-portal       # 通义千问 Portal
/login supergrok         # xAI SuperGrok
/login openai-codex      # OpenAI Codex
/login google-gemini-cli # Google Gemini CLI
/login devin             # Devin Coding Plan
/login umans             # Umans Coding Plan
```

```
[omp]
正在启动 OAuth,浏览器会打开 https://...
授权完成后会自动回到 omp。
```

token 存在:`~/.omp/agent/auth.json`,加密存储。

### 6.3 你(Coding Plan 用户)最常配的几个

| Provider | 标签 | 你需要做的 |
| ---------- | ------ | ----------- |
| GLM | `plan` | `/login zai` 登录套餐账号 |
| Kimi | `plan` | `/login kimi-code` 登录套餐账号 |
| Cursor | `oauth` + `plan` | `/login cursor` |
| Copilot | `oauth` | `/login copilot`,授权 GitHub |
| OpenAI Codex | `oauth` | `/login openai-codex` |

### 6.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| Coding Plan 一键登录 | 部分 | ✅ 30+ provider 直接 `/login` |
| OAuth token 加密 | 手动管 | ✅ `auth.json` 加密 |
| MCP 路径兼容 | n/a | ✅(关键:绕开余额误判) |

## 7. 几个真实组合配方

### 配方 1:GLM Coding Plan + Claude fallback

```yaml
modelRoles:
  default: zai/glm-4.6                    # 主:GLM 套餐
  smol: zai/glm-4.5                       # subagent 便宜

retry:
  fallbackChains:
    default:
      - zai/glm-4.6
      - zai/glm-4.5
      - minimax/MiniMax-M3-fast
      - ollama/qwen2.5-coder-7b           # 最后本地兜底

providers:
  ollama:
    api: openai-completions
    baseUrl: http://localhost:11434/v1
```

效果:**GLM 不挂你不感知,有 5 个层级自动回退**。

### 配方 2:多 key Anthropic 烧额度不停

```yaml
modelRoles:
  default: anthropic/claude-opus-4.7
  smol: anthropic/claude-haiku-4.5

credentialPool:
  anthropic:
    - "${ANTHROPIC_KEY_1}"
    - "${ANTHROPIC_KEY_2}"
    - "${ANTHROPIC_KEY_3}"
  strategy: session-affinity
  perCredentialBackoff:
    cooldown: "15m"
```

效果:3 个 key 轮换,任一撞墙自动冷却 15 分钟,其它接上。

### 配方 3:实验目录走便宜模型

```yaml
modelRoles:
  default: anthropic/claude-opus-4.7

pathScopes:
  - path: "./experiments/**"
    modelRoles:
      default: minimax/MiniMax-M3
  - path: "./drafts/**"
    modelRoles:
      default: anthropic/claude-haiku-4.5
```

效果:你 cd 到 `experiments/` 跑 omp,默认就是便宜模型;回主目录还是 opus。

## 8. 调试 / 排错

```bash
omp config dump              # 打印最终生效的配置(全局 + path scope 合并后)
omp config validate          # 校验配置合法性
omp login list               # 已登录的 provider + token 状态
omp login logout zai         # 登出某个 provider
omp models <provider>        # 列出某个 provider 的可用模型(测试连通性)
```

实战排错流程:

1. 跑 `omp config dump`,确认 modelRoles 路由正确
2. 跑 `omp models <provider>`,确认 key / OAuth token 有效
3. 看 fallback chain 日志,确认撞墙检测正常

## 9. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| Model roles (模型角色) | 1(当前模型) | ✅ 10 |
| Fallback chain (回退链) | ❌ | ✅ 自动级联 |
| Quota wall (配额墙) 跟踪 | ❌ | ✅ |
| Credential pool (凭据池) | ❌ | ✅ 多 key + 轮询 |
| Session affinity (会话粘性) | n/a | ✅ |
| Per-key backoff (按 key 退避) | n/a | ✅ |
| Path-scoped models | ❌ | ✅ |
| `/login` 一键 Coding Plan | 部分 | ✅ 30+ provider |

## ✅ 小结

| 配置块 | 干什么 | 关键值 |
| -------- | -------- | -------- |
| `modelRoles` | 按角色路由 | default / smol / slow / advisor / ... |
| `retry.fallbackChains` | 撞墙自动切 | 列出 N 个回退项 |
| `credentialPool` | 多 key 轮询 | strategy / per-key backoff |
| `pathScopes` | 按路径覆盖模型 | glob / enabled / disabled |
| `/login <provider>` | OAuth/Coding Plan 接入 | 30+ provider 直接登录 |

和 pi 的对照:**pi 是"一个模型跑到底",omp 是"60+ provider 路由成一张网"**。这就是 README 里 "60+ providers, a thousand models, one /model away" 的真正含义。

## 🎯 下一课预告:第七课:Web search 内置

- 23 个 search providers 全清单(perplexity / tavily / exa / kagi / jina / brave / kimi / ...)
- site-aware extraction (站点感知提取) 怎么把 arxiv / GitHub / npm 自动转成结构化 markdown
- 23 个 specialized handlers (专业处理器):code hosts / registries / research / forums / docs
- 安全数据库 (NVD / OSV / CISA KEV) 集成
