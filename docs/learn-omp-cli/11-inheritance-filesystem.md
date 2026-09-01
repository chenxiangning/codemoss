# 第十一课:继承既有规则 + 16 个内部 schemes

omp 的 15 号 + 12 号 + 17 号电池——"你团队已经写好的规则,直接继承"和"万物皆 URL"。

## 1. 继承既有 8 种 agent 格式(15 号电池)

### 1.1 一句话定位

其他 agent 都有自己的"规则文件格式":

| Agent | 规则文件 | 位置 |
| ------- | --------- | ------ |
| Cursor | `.mdc`(MDC 规则文件,带 frontmatter 的 Markdown) | `.cursor/rules/*.mdc` |
| Cline | `.clinerules` | 项目根或子目录 |
| Codex | `AGENTS.md` | 项目根 |
| Copilot | `*.md` 带 `applyTo` frontmatter | `.github/copilot-instructions.md` |
| Aider | `CONVENTIONS.md` | 项目根 |
| Continue | `.continue/rules/*.md` | `.continue/` |
| Cody | `.cody/rule.md` | `.cody/` |
| Windsurf | `.windsurfrules` | 项目根 |

omp **全部原生读,不要求你转换**。

### 1.2 工作原理

```
[agent 启动]
1. omp 扫项目,识别所有已存在的规则文件
2. 解析各自格式(frontmatter / scope / glob)
3. 统一映射成内部 rule 结构
4. 加进 rules.yml 链,优先级:本地 .omp/rules > 团队共享 > 父项目 > 全局
```

### 1.3 实战

```text
[项目目录]
.cursor/rules/
  api-design.mdc     ← Cursor 格式
.clinerules           ← Cline 格式
AGENTS.md             ← Codex 格式
.github/copilot-instructions.md   ← Copilot 格式

[omp]
读到了 4 份规则,自动适配
不用你写 YAML 转换脚本
不用"supported subset"
```

### 1.4 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 读 Cursor MDC | ❌ | ✅ |
| 读 Cline .clinerules | ❌ | ✅ |
| 读 Codex AGENTS.md | ✅(自家) | ✅ |
| 读 Copilot applyTo | ❌ | ✅ |
| 多种格式混合 | ❌ | ✅ |

## 2. 16 个内部 schemes (协议路径) (17 号电池)

### 2.1 心智模型

omp 把"任何东西"都当成 URL 路径,**一个 `read` 工具搞定所有**。

```
read src/foo.ts                  ← 普通文件
read https://arxiv.org/...       ← URL(第七课讲过)
read ssh://user@host/path        ← 远程
read pr://1428                    ← GitHub PR
read issue://455                  ← GitHub Issue
read agent://<worker-id>/findings ← subagent 产出
read skill://bun-setup             ← 加载 skill
read conflict://1                ← merge 冲突
read xd://<device>               ← discoverable 设备
```

agent **不需要学习 30 个不同工具**,只用 `read`。

### 2.2 全部 schemes 一览

| scheme (协议路径) | 干什么 | 用例 |
| ------ | ------ | ------ |
| `pr://<n>` | GitHub PR | `read pr://1428` |
| `issue://<n>` | GitHub Issue | `read issue://455` |
| `agent://<id>` | subagent 产出 | `agent://w-7/findings.0.path` |
| `skill://<name>` | 加载 skill | `read skill://bun-setup` |
| `ssh://<host>/<path>` | 远程文件 | `read ssh://dev@host/etc/app.conf` |
| `conflict://<n>` | merge 冲突 | `read conflict://1` |
| `xd://<device>` | 设备/隐藏工具 | `read xd://inspect` |
| `xd://resolve` | ast_edit 接受/拒绝 | `write xd://resolve accepting-...` |
| `xd://log` | session log | `read xd://log` |
| `agent://<id>/transcript` | subagent transcript (对话转录) | 看子代理实时输出 |
| `agent://hub/jobs` | 看 hub 任务 | 列出后台任务 |
| `pr://<n>/diff` | PR diff | 看具体改了什么 |
| `pr://<n>/comments` | PR 评论 | |
| `issue://<n>/comments` | issue 评论 | |
| `repo://<owner>/<name>/...` | repo 任意文件 | |
| `xd://<tool>` | 内部工具调用 | 见下 |

### 2.3 实战:`agent://` 取子代理产出

```text
[子代理 worker 完成后]
result = {
  "ComponentsExports": {
    "exports": [
      { "name": "UserCard", "path": "src/components/UserCard.tsx" },
      ...
    ]
  }
}

[主 agent]
agent://ComponentsExports/exports.0.path
→ "src/components/UserCard.tsx"

# 不用解析 JSON,直接 URL 路径取字段
```

### 2.4 实战:`pr://` 改 PR

```text
[用户]
1428 这个 PR 有什么问题?

[agent]
read pr://1428          # 标题/描述
read pr://1428/diff     # 完整 diff
read pr://1428/comments # 评审意见

# 全部走 read,不用学 gh 工具
```

### 2.5 实战:`xd://` 隐藏工具

```yaml
# ~/.omp/agent/config.yml
tools:
  xdev: true    # 开启 discoverable devices
```

开启后 `xd://` 下能看到所有 disabled-by-default 工具:

```text
xd://inspect_image      # 模型不能看图时自动激活
xd://generate_image
xd://tts
xd://security_scan
xd://github_advanced
...
```

agent 只在需要时启用,**主目录里不污染**。

### 2.6 实战:`conflict://` 解决 merge

(第二课已讲过,这里重提 scheme 角度)

```text
read conflict://1     # 看冲突内容
write conflict://1 "@theirs"   # 选 theirs
write conflict://* "@theirs"   # 一次性全选
```

### 2.7 实战:`skill://` 加载 skill

```text
read skill://bun-project-setup
→ 自动 apply 该 skill 的 manifest (清单)
→ agent 之后按 skill 走
```

### 2.8 与 pi 对比

| | pi | omp |
| --- | ----- | ----- |
| 统一 read | ❌(多个工具) | ✅ 一个 `read` |
| 16 个 schemes | ❌ | ✅ |
| agent:// 取字段 | ❌ | ✅ |
| pr:// 像读文件 | ❌ | ✅ |

## 3. ssh:// 远程工作

```text
read ssh://user@server/etc/app.conf
read ssh://pi@rpi.local/home/pi/notes.md
write ssh://user@server/var/log/app.log "@rotate"

# omp 内置 ssh 客户端(走 libssh)
# 不需要你手 scp
```

## 4. 实战综合:一周的某天

```
[用户]
帮我看 PR #1428,reviewer 提了什么问题?

[agent]
read pr://1428/diff
→ 看到改了什么

read pr://1428/comments
→ 看到 reviewer 评论

read ssh://ci-runner@build-host/logs/1428.log
→ 看 CI 日志

write xd://resolve accepting-pr-feedback
→ 标记"已接受反馈"

# 全程一个 read/write,不用学 6 个工具
```

## 5. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| 读 8 种规则格式 | 1(自家) | ✅ 8 种 |
| URL schemes | ❌ | ✅ 16 个 |
| 远程 ssh:// | ❌ | ✅ |
| agent:// 取字段 | ❌ | ✅ |
| 统一 read 接口 | ❌ | ✅ |

## ✅ 小结

| 武器 | 干什么 |
| ------ | -------- |
| 多格式规则继承 | 读团队既有规则,不重写 |
| `read <url>` | 一个工具搞定一切 |
| 16 schemes | pr / issue / agent / skill / ssh / conflict / xd |
| `xd://` 设备 | 隐藏工具按需激活 |

和 pi 的对照:**pi 让 agent 学一堆工具,omp 让 agent 学一个 read + URL 协议**。

## 🎯 下一课预告:第十二课:Session 控制 + magic keywords

- `/vibe` director + worker 模式(只读 director 派 fast/good worker)
- `/fresh` 重置 provider 流状态
- `/model` slash 命令全 role 重选
- 三个 magic keyword:ultrathink / orchestrate / workflowz
