# 第十四课:与 pi 终极对比 + 实战综合 + 学习复盘

最后一课,把全系列知识串起来。

## 1. 21 块电池全景回顾

| # | 电池 | 对应章节 |
| --- | ------ | ---------- |
| 01 | Code execution w/ tool-calling | 第一课 / 第十四课 |
| 02 | LSP wired into every write | 第四课 |
| 03 | Drives a real debugger | 第四课 |
| 04 | Time-traveling stream rules | 第九课 |
| 05 | First-class subagents | 第三课 |
| 06 | Advisor model | 第三课 |
| 07 | `/collab` 共享 session | 第十课 |
| 08 | Web search 内置 | 第七课 |
| 09 | 全 Rust 内置 | 第十四课(架构) |
| 10 | `/review` P0-P3 + verdict | 第三课 |
| 11 | Hashline 编辑 | 第二课 |
| 12 | GitHub is filesystem | 第十一课 |
| 13 | Memory the agent curates | 第五课 |
| 14 | ACP editor-drivable | 第十课 |
| 15 | Inherits 既有 rules | 第十一课 |
| 16 | `omp commit` 原子化 | 第八课 |
| 17 | 16 个内部 schemes | 第十一课 |
| 18 | `conflict://` | 第二课 |
| 19 | `ast_edit` 预览 + Accept | 第二课 |
| 20 | browser / Electron | 第十三课 |
| 21 | computer 桌面控制 | 第十三课 |

**没有讲到**:01(代码执行 + 工具回调 Python/Bun cell),本期略。

## 2. 与 pi 的终极差异矩阵

| 维度 | pi | omp |
| ------ | ----- | ----- |
| **血缘** | 上游 | **fork + 21 块电池** |
| **语言栈** | TypeScript | TypeScript + Rust(~80k LoC 内核) |
| **模型** | 一次一个 | **10 role 路由**(default/smol/slow/plan/advisor/...) |
| **多模型协作** | ❌ | ✅ 主 + advisor + subagent + worker |
| **Fallback chain** | 手动 | ✅ 自动 + quota wall |
| **凭据池** | ❌ | ✅ round-robin + session affinity |
| **Path-scoped 模型** | ❌ | ✅ |
| **Provider 数量** | 较多 | **60+**(含 Coding Plan) |
| **LSP** | ❌ | ✅ 14 ops,rename 走 willRenameFiles |
| **DAP** | ❌ | ✅ 28 ops,lldb/dlv/debugpy/js-debug/jdtls |
| **ast_grep** | ❌ | ✅ 50+ 语法 |
| **hashline** | ❌ | ✅ |
| **ast_edit** | ❌ | ✅ proposed → Accept |
| **conflict://** | ❌ | ✅ |
| **subagent** | prompt delegation | ✅ typed yield + 隔离 worktree + IRC |
| **advisor** | ❌ | ✅ 独立 context + 三级 |
| **/review** | prompt | ✅ P0-P3 + verdict + confidence |
| **Memory** | 当前会话 | ✅ retain/recall/reflect + 三 backend + scope |
| **Web search** | 需外接 | ✅ 23 provider + 23 handler + 3 vuln db |
| **/commit** | ❌ | ✅ 自动拆 + cycle 检测 + 优先级 |
| **Stream rules** | system prompt | ✅ 触发才注入 + blocker + 抗压缩 |
| **/collab** | ❌ | ✅ 链接 + QR + 只读 view |
| **ACP/Zed** | ❌ | ✅ 协议级集成 |
| **浏览器** | ❌ | ✅ stealth + CDP + Chrome relay |
| **桌面控制** | ❌ | ✅ `computer` + 持久 JS |
| **多模态** | ❌ | ✅ generate_image / inspect_image / tts |
| **继承规则** | 1 种 | ✅ 8 种 |
| **内部 schemes** | 0 | ✅ 16 |
| **核心优势** | 简单、上游 | **功能深度、IDE-wired、生产稳** |
| **核心劣势** | 缺能力 | 安装大、配置面广、学习曲线陡 |

## 3. 什么时候用 omp / pi / opencode

```
场景                          推荐        理由
────────────────────────────────────────────────────────────────
新手、上游同步、玩             pi          轻量、原汁原味
大重构、生产环境、IDE 集成     omp         21 块电池,稳
Go 项目、快速轻量             opencode    Go 实现快、社区大
单文件 demo                   pi / opencode 都行
企业大规模、有团队 sharing      omp         协作 + 内存 + 配置
Web 全栈(JS/TS/Python)         omp         browser + web_search + 多模态
Rust/C++/系统级               omp          debug + lldb
前端原型设计                  omp          browser + computer + image
模型 routing 复杂              omp          fallback + 凭据池
要本地模型主跑                 opencode    Go 生态 Ollama 集成好
```

## 4. omp 的 Rust 内核回顾

```
packages/coding-agent/         ← TypeScript UI / agent 编排层
        ▼
packages/natives/ (pi-natives 25k LoC)
        │
        ├── pi-shell 38k       brush bash fork + 58 coreutils
        ├── pi-natives 25k     N-API 表面
        ├── pi-walker 5.2k     并行 ignore-aware walker
        ├── pi-iso 3.3k        workspace 隔离
        ├── pi-ast 2.9k        tree-sitter + ast-grep
        └── pi-voice 1k        音频 + Opus + WebRTC
```

### 4.1 pi-shell 深度

brush (bash 实现 fork) + 58 coreutils,**零 fork/exec**:

```bash
# omp 内部跑
ls src/
→ in-process 跑 ls (从 builtins crate)
→ 不用 spawn /usr/bin/ls
```

为什么这重要:

- **跨平台一致**:Mac/Linux/Windows 行为完全相同
- **快**:省掉 fork-exec 一次进程切换
- **可控**:错误处理在 TS 侧统一

### 4.2 pi-walker 深度

```rust
// 单次扫,grep + glob + workspace shell 共享
walker.scan("src/**/*.ts")
// 三个工具同一份 cache,不用各自扫三遍
```

### 4.3 pi-iso 深度

```rust
// subagent 隔离
isolator.clone_with_reflink(src_path)
// apfs/btrfs/zfs 下用 reflink (写时复制),几毫秒
// 普通文件系统 fallback 到 copy
```

## 5. 实战综合:一个完整的 omp 工作日

```
[上午]
09:00  启动 omp --model opus,接到新需求
09:05  /vibe,让 director 调度
09:10  orchestrate:让 4 个 worker 并行调研 4 个模块
09:30  ultrathink:核心算法设计
10:00  hashline 改 20 个文件(ast_edit 批量 + 几个手改)
10:30  /commit:拆成 8 个 atomic commit
10:45  /review HEAD:P0 1 个,改了
11:00  push,开 PR

[下午]
14:00  CI 红 /collab view 给 reviewer 看
14:30  reviewer 提 issue,inspect_image 看截图
15:00  /fresh 流卡住 → 重置
15:05  lldb-dap attach 调试核心服务
15:30  conflict://1 @theirs 解冲突
16:00  /review 复审:PASS
16:30  merge

[晚上]
20:00  retain "这项目用 bun,bun test 不用 jest"
20:05  learn + promote 成 bun-project-setup skill
20:10  /fresh 关 session
```

## 6. 学习路径复盘

```
第 1 课  启动 / 模型 / 工具
        ↓
第 2 课  hashline / ast_edit / conflict
        ↓
第 3 课  subagent / advisor / /review
        ↓
第 4 课  LSP / DAP / ast_grep
        ↓
第 5 课  Memory 三层
        ↓
第 6 课  多模型 / fallback / 凭据池
        ↓
第 7 课  web_search / site-aware
        ↓
第 8 课  omp commit 原子化
        ↓
第 9 课  Stream rules
        ↓
第 10 课 /collab / ACP
        ↓
第 11 课 继承 / schemes
        ↓
第 12 课 /vibe / /fresh / keywords
        ↓
第 13 课 browser / computer / 多模态
        ↓
第 14 课 终极对比 + 综合 ← 你在这
```

## 7. 推荐下一步实操

### 7.1 立即可做(5 分钟)

```bash
# 1. 起一个 vibe 模式 session
omp /vibe

# 2. 试试 hashline
omp --tools read,edit "读 src/ 里随便一个文件,然后改一行"

# 3. 试试 web_search
omp "搜一下 omp CLI 最新特性"

# 4. 试试 /fresh
omp "开始一个长任务,中途卡住时输 /fresh"
```

### 7.2 一周内实操

```
1. 在你的项目里跑 /review HEAD,看 verdict
2. 配置 fallbackChains 接 GLM Coding Plan + Claude
3. 跑 /vibe 重构一个中等模块
4. 用 ast_grep 找代码坏味道,ast_edit 一键改
5. /commit 看 omp 自动拆几块
```

### 7.3 一个月内

```
1. 配 Mnemopi backend,retain 关键事实
2. learn + promote 5 个项目 skill
3. 在 Zed 里配 ACP,日常用编辑器驱动 omp
4. /collab 给同事,真协作一次
5. /review 集成进 PR 流程
```

## 8. 一句话总结

**omp = pi 的超集 + Rust 内核 + 多模型协作 + IDE 全接入 + 桌面/浏览器/多模态**

如果你只能记住一句:**pi 是文本世界,omp 把代码当 AST、把桌面当 shell、把模型当路由、把 session 当状态机。**

---

## 附录:文档目录索引

```
docs/learn-omp-cli/
├── README.md                  总览 + 路线图
├── 01-basics.md               启动、模型 role、31 个工具
├── 02-editing-revolution.md   hashline + ast_edit + conflict://
├── 03-smart-collaboration.md  subagents + advisor + /review
├── 04-ide-depth.md            LSP + DAP + ast_grep
├── 05-memory-system.md        retain/recall/reflect + learn/manage_skill
├── 06-multi-model-routing.md  fallback / 凭据池 / path-scoped / /login
├── 07-web-search.md           23 provider + site-aware extraction
├── 08-omp-commit.md           atomic commit + cycle + priority
├── 09-stream-rules.md         触发才注入 + blocker
├── 10-collab-acp.md           /collab + Zed ACP
├── 11-inheritance-filesystem.md 8 种规则格式 + 16 schemes
├── 12-session-modes.md        /vibe + /fresh + keywords
├── 13-multimodal-desktop.md   browser + computer + image/tts
└── 14-final-comparison.md     与 pi 终极对比 + 实战综合(本课)
```

学习愉快。
