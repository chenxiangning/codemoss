# 第八课:`omp commit` —— 原子提交 + 依赖排序

这是 omp 的 16 号电池。`omp commit` 不是 `git commit`,**它读工作区,自己拆 commit (拆分多个原子提交)**。

## 1. 一句话定位

```
git commit -am "改动"          → 一次提交所有改动,可能混进无关内容
omp commit                     → agent 拆成 N 个原子 commit,按依赖排序,逐个落盘
```

适用场景:

- 工作区里有 5 个无关功能改了 12 个文件
- 想 commit,但不知道拆几个、怎么拆、什么顺序
- 想自动写符合 Conventional Commits (约定式提交规范) 的 message

## 2. 三个 git_\* 工具:commit 怎么"看"工作区

omp commit 之前,agent 用三个工具看清全貌:

| 工具 | 干什么 |
| ------ | -------- |
| `git_overview` | 看工作区"全景":改了几个区?每个区有几文件?每文件多大改动? |
| `git_file_diff` | 看单文件的 diff (文件级差异) |
| `git_hunk` | 看单 hunk (差异片段) 的具体内容,精确到行 |

### 2.1 git_overview 输出例

```
[agent 调用]
git_overview

[返回]
┌─ Working Tree Overview ─────────────────────────┐
│                                                 │
│  Region A: User auth rewrite (4 files)          │
│   - src/auth/login.ts        +180 -45           │
│   - src/auth/session.ts      +90  -12           │
│   - src/auth/token.ts        +60  -8            │
│   - src/auth/index.ts        +5   -5            │
│                                                 │
│  Region B: API rate limiting (3 files)           │
│   - src/api/limit.ts         +120 -0            │
│   - src/api/middleware.ts    +30  -10           │
│   - src/middleware/index.ts  +8   -2            │
│                                                 │
│  Region C: README update (1 file)               │
│   - README.md                +40  -12           │
│                                                 │
│  Lockfiles (excluded):                          │
│   - package-lock.json                          │
│   - bun.lockb                                   │
│                                                 │
│  Cycles detected: none                          │
└─────────────────────────────────────────────────┘
```

> omp 用 file co-change (文件共同变更历史) + import graph (导入依赖图) + diff similarity (diff 相似度) 三种信号**自动识别 region (一组相关改动)**。

## 3. 自动拆 commit 的工作流

### 3.1 完整流程

```
1. git_overview        ←  全工作区有几块改动
2. git_file_diff       ←  每文件 diff
3. git_hunk            ←  精确行
4. cycle (循环依赖) detection     ←  检测有无循环 import
5. score each region   ←  给每块打分(下节)
6. lockfile filter     ←  排除 lockfile
7. write commit msgs   ←  逐个写
8. atomic commit loop  ←  按依赖顺序落盘
9. verify              ←  校验每个 commit 单独可 build
```

### 3.2 cycle detection (循环依赖检测)

omp 还会扫 import graph (导入依赖图),看 region 之间有没有 cycle (循环引用):

```
Region A (login.ts) imports from Region B (limit.ts)
Region B imports from Region A
→ 环!→ omp 拒绝拆开,合并为一个 commit
```

否则拆开后会出现"先 commit B 编译不过,因为 A 还没 commit"的问题。

### 3.3 priority scoring (优先级评分)

每块改动打分,**决定哪个 commit 先**:

| 类别 | 分数 |
| ------ | -----: |
| 核心 src/ 代码 | 100 |
| 测试 (test/) | 70 |
| 类型定义 (types/) | 80 |
| 文档 (docs/, README) | 50 |
| 配置文件 (config/, yaml) | 30 |
| 注释清理 | 20 |
| lockfile (包锁文件) | **0(排除)** |

> 源码 > 测试 > 文档 > 配置——"the headline commit is the one that matters"。

### 3.4 lockfile 排除

`package-lock.json` / `bun.lockb` / `Cargo.lock` / `pnpm-lock.yaml` 等**完全不参与分析**:

- 锁文件改动不触发 commit 拆分
- 锁文件不进 commit message 提及
- 默认最后单独成 commit(或跟主代码 commit)

## 4. commit message 怎么写

omp 默认按 **Conventional Commits (约定式提交规范)** 写:

```
feat(auth): switch session storage to cookie-based tokens

Replace localStorage with HTTP-only cookies to mitigate XSS (跨站脚本攻击)
token theft. Migration path:
  - new login endpoint mints cookie + reads existing localStorage as fallback
  - one-time read on next login, then drops localStorage entries

Refs: #142, security-scan-2026-08-15
```

每个 commit message 都带:

- type (类型, 如 feat/fix/refactor)
- scope (作用域, 如 auth)
- 中文动宾短句 (默认)
- body (为什么改)
- Refs (相关 issue / 安全扫描)

> 中文 commit message 来自你的 dev-guidelines,omp 读 `~/.omp/agent/config.yml` 的 `commit.style` 字段(默认按全局 Git 规范)。

## 5. 实战

### 场景 1:周末改了一堆东西,周一想分批提交

```text
[用户]
我周末改了 auth、rate limit、README 三个东西,帮我拆成 atomic commits[agent]
1. git_overview
   → 3 个 region,无 cycle
2. priority scoring
   - Region A (auth): 100 → commit 1
   - Region B (rate limit): 100 → commit 2
   - Region C (README): 50 → commit 3
3. lockfile 过滤:package-lock.json 单独成 commit 4
4. 按依赖关系:Region B (limit) 引用 auth?否,独立
   → 顺序:A → B → C → lockfile
5. atomic commit:
   commit 1: feat(auth): ...
   commit 2: feat(api): ...
   commit 3: docs(readme): ...
   commit 4: chore(deps): bump ...
```

### 场景 2:detect cycle

```
Region A: User model + session
Region B: Login flow + session
  A imports User, session
  B imports Login, session (shared with A)
  → session 是共享依赖,无 cycle
  → 拆 A → B

Region A: parser.ts
Region B: lexer.ts
  A imports B's Token
  B imports A's Expr (用于新特性)
  → cycle!
  → omp 拒绝拆,合并 A+B 为单一 commit
```

### 场景 3:只看 diff

```text
[用户]
我只看 src/api/middleware.ts 改了啥
[agent]
git_file_diff { file: "src/api/middleware.ts" }
→ 显示 +30 -10,逐行 diff

[用户]
看具体那 5 行
[agent]
git_hunk { file: "src/api/middleware.ts", hunk: 2 }
→ 精确那 5 行前后 3 行 context
```

## 6. /commit 命令 vs omp commit

| | `git commit -m "..."` | `omp commit` |
| --- | ------ | ------ |
| 拆 commit | ❌ 一次提交所有 | ✅ 自动拆 |
| Message 写 | 你自己写 | ✅ agent 写 |
| 循环检测 | ❌ | ✅ |
| 优先级排序 | ❌ | ✅ |
| lockfile 处理 | 手动 | ✅ 自动排除 |
| 验证 build | ❌ | ✅ 逐 commit 验证可编译 |

## 7. 配置

```yaml
# ~/.omp/agent/config.yml
git:
  commit:
    style: "conventional"             # 或 "angular" / "gitmoji"
    language: "zh-CN"                 # 中文动宾短句
    splitStrategy: "auto"             # 或 "byRegion" / "single"
    priority:
      "src/**": 100
      "tests/**": 70
      "types/**": 80
      "docs/**": 50
      "*.md": 40
      "*.json": 20                    # 配置 json
      "*.lock*": 0                    # 锁文件排除
    excludePaths:
      - "**/*.lock*"
      - "**/dist/**"
      - "**/node_modules/**"
    verifyBuildAfterEach: true         # 每个 commit 后跑 build
```

## 8. 与 pi 的对比

| | pi | omp `omp commit` |
| --- | ----- | --------------- |
| 拆 commit | ❌ | ✅ 自动 |
| Message 写 | ❌ | ✅ Conventional |
| 循环检测 | ❌ | ✅ |
| 优先级排序 | ❌ | ✅ |
| lockfile 排除 | 手动 | ✅ |

## ✅ 小结

| 武器 | 干什么 |
| ------ | -------- |
| `git_overview` | 工作区全景 |
| `git_file_diff` | 单文件 diff |
| `git_hunk` | 单 hunk |
| `omp commit` | 自动拆 + 排序 + 验证 |
| cycle detection | 拆前排雷 |
| lockfile 排除 | 不污染 commit 语义 |

和 pi 的对照:**pi 把"改完"和"提交"分开,omp 把"提交"也变成智能动作**。

## 🎯 下一课预告:第九课:Time-traveling stream rules (04 号电池)

- 规则平时不烧 context,触发才注入
- 正则命中 abort 流 + 注入 system reminder + 同点重试
- 注入 survive compaction (上下文压缩),修复 stick
