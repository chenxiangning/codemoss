# 第二课:编辑革命 —— hashline + ast_edit + conflict://

三个能力对应 omp 的 11 / 19 / 18 号电池,核心是把"写文件"从最容易出错的环节里救出来。

## 1. 为什么需要"新的编辑范式"?

pi / Claude Code 时代 agent 编辑文件的痛点:

```
痛点 1:模型重抄多行 → token 浪费 + 拼写错误
痛点 2:old_text 在文件里出现多次 → 改错地方或失败
痛点 3:文件被改过、old_text 已不存在 → 无限重试或悄悄改错
痛点 4:大段替换 → 看不出"改了什么",review 时一头雾水
痛点 5:合并冲突 → agent 不知道哪边是 theirs/ours/base
```

omp 用三层武器分别解决:

| 痛点 | 解决武器 |
|------|----------|
| 1+2+3 | **hashline 锚点** |
| 4 | **`ast_edit` 预览 + Accept** (proposed card 待审卡片) |
| 5 | **`conflict://N` URL 协议** |

---

## 2. Hashline (按内容哈希锚点) 编辑(omp 11 号电池)

### 2.1 原理

`read` 一个文件时,omp 在每行前面打一个短哈希:

```
src/auth.ts
┌─────────────────────────────────────────────────────────┐
│ #1 g8k2  import { User } from './user';                │
│ #2 p9z1  export async function login(token: string) {  │
│ #3 7qr4    const user = await verify(token);           │
│ #4 b3m8    if (!user) throw new Error('invalid');      │
│ #5 c1f0    return user;                                │
│ #6 d2n5  }                                              │
└─────────────────────────────────────────────────────────┘
```

- 左边 `#<n> <hash>` 是 **行号 + 该行内容 + 周围行的 content-hash (内容哈希)** 缩成 4 字符
- 模型要改一行,**不用重抄整行**,只说:"改 #3 → `const user = await verify(token, { strict: true });`"
- omp 用 hash **验证那行是不是真的还是原来的样子**;不一致直接 **拒绝 patch**(stale-anchor recovery 过时锚点恢复)

### 2.2 实战:agent 视角

```text
[prompt]
请把 login 函数改成支持 strict 模式。
[/prompt]

[agent 调用]
read src/auth.ts
→ 拿到带 #1..#6 锚点的内容

edit src/auth.ts {
  "#3 7qr4": "    const user = await verify(token, { strict: true });"
}
→ omp 校验 #3 的 hash 还是 7qr4,落盘成功
```

如果有人在 agent 读完后手改了 src/auth.ts,hash 会变(比如 `7qr4 → 7xyz`),omp 直接拒绝并返回:

```
Error: anchor 7qr4 no longer matches at line 3.
File changed at: <reason>.
Refused: would have silently overwritten other edits.
```

### 2.3 与 pi 的对比

| | pi / Claude Code 风格 | omp hashline |
|---|-----|------|
| 编辑形式 | 重抄多行 `old_text` | 写一行 hash |
| 空白容错 | 经常因 tab/space 不一致失败 | **hash 包含空格,所以严格匹配** |
| Stale 文件防御 | 无,悄悄覆盖 | **直接拒绝,要求重新 read** |
| Token 消耗 | 大段重抄 | Grok 4 Fast 实测**省 61% 输出 token** |
| 模型友好度 | 弱模型易拼错 | 几乎不可能拼错(只要 hash 对) |

> 这就是为什么 omp 文档里写 "Grok Code Fast: 6.7% → 68.3% pass rate"——格式本身不再吃模型。

### 2.4 提示工程要点

让 agent 用 hashline 编辑时,prompt 里只要:

```markdown
# 编辑规则
- 改文件必须用 hashline(每行前面的 `#<n> <hash>`)
- 严禁重抄整行(浪费 token,易错)
- 如果 read 之后文件被改,必须先 re-read 再 edit
```

---

## 3. ast_edit + Accept Card (待审卡片)(omp 19 号电池)

### 3.1 它和 hashline 的关系

hashline 解决"精确编辑",**`ast_edit` 解决"模式化批量改"**:

> "把整个项目里所有 `console.log($X)` 都换成 `logger.info($X)`,排除 test 目录"

这种改用 hashline 要逐个文件、逐个 anchor,几小时;用 ast_edit,**一个 ast-grep pattern (匹配模式)**,30 秒。

### 3.2 完整工作流

**Step 1**:agent 写 pattern:

```js
ast_edit {
  pattern: "console.log($X)",
  rewrite: "logger.info($X)",
  globs: ["src/**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts"]
}
```

**Step 2**:omp **不立刻落盘**。它返回一张 *proposed card (待审卡片)*:

```
┌─────────────────────────────────────────────────┐
│ ✓ AST Edit: console.log($X) → logger.info($X)  │
│                                                │
│ 3 replacements · 1 file (proposed)              │
│                                                │
│ src/logger.ts:14  console.log("starting")       │
│                   → logger.info("starting")    │
│ src/logger.ts:22  console.log(err)              │
│                   → logger.info(err)           │
│ src/auth.ts:8     console.log("done")          │
│                   → logger.info("done")        │
└─────────────────────────────────────────────────┘
```

**Step 3**:agent 在对话里写一行:

```text
xd://resolve accepting-console-log-migration
```

或直接告诉用户: "准备改 3 处,接受吗?"

**Step 4**:TUI (文本用户界面) 把 proposed card 翻成 **Accept 卡片**:

```
┌──────────────────────────────────────────┐
│ Accept: 3 replacements in 1 file (AST)  │
│                                          │
│ ✓ Applied 3 replacements in src/auth.ts. │
└──────────────────────────────────────────┘
```

**一次性原子落盘**。

### 3.3 关键属性

| 属性 | 含义 |
|------|------|
| **原子性 (atomic)** | 要么全部落盘,要么一行没动 |
| **可审** | 落盘前你能逐处看 diff (差异) |
| **可拒** | 写 `@reject` 到 `xd://resolve` 即可 |
| **AST 正确** | pattern 是结构化匹配,不会把字符串里的 `console.log("x")` 误改 |
| **跨语言** | 50+ tree-sitter (语法解析器) 语法(TS/JS/Python/Go/Rust/Java/Swift...) |

### 3.4 ast_grep(只查不改)

如果只想"找模式、不改",用 `ast_grep`:

```js
ast_grep {
  pattern: "try { $$$BODY } catch ($E) { $$$ }",
  rewrite: "try { $$$BODY } catch ($E) { logger.error($E); throw $E; $$$ }",
  globs: ["src/**/*.ts"]
}
```

omp 的 README 把这叫做 **structural code queries (结构化代码查询) over 50+ tree-sitter grammars**。

### 3.5 与 pi 的对比

| | pi /其它 CLI | omp |
|---|------|------|
| 改法 | 给一段字符串替换 | 给 AST pattern + 重写规则 |
| 范围 | 一次一文件 | globs / exclude 批量 |
| 预览 | 没有 | **proposed card 待审卡片**,可审可拒 |
| 精度 | 文本匹配,易误伤 | AST 匹配,只改模式命中处 |
| 多文件一致性 | 手工 | 自动 |

---

## 4. conflict:// —— 冲突变 URL(omp 18 号电池)

### 4.1 背景

merge 时 git 在文件里写:

```ts
<<<<<<< HEAD
const x = a + b;
=======
const x = a * b;
>>>>>>> feature
```

人类解决:看 diff、决定留哪边、改完删标记。
agent 解决:经常瞎选,或者选了但不告诉你选了哪边。

### 4.2 omp 的方案:把冲突变成一个 URL

```text
[omp 跑 merge 后报:]
✗ Read src/session.ts (⚠ 1 conflict)
 Conflict #1 at lines 12-14
 conflict://1    →  解决这一个冲突
 conflict://*    →  一次性解决所有冲突
```

agent 或人类只要 **写一行** 到对应 URL:

```ts
// 三选一,写完冲突就解决
write conflict://1  "@theirs"   // 留 feature 分支版本
write conflict://1  "@ours"     // 留 HEAD 版本
write conflict://1  "@base"     // 用 merge 前公共祖先版本
```

或者写一段新内容(自定义方案):

```ts
write conflict://1  "const x = (a + b) * 2;"  // 自定义
```

omp **删掉所有 `<<<<<<<` / `=======` / `>>>>>>>` 标记**,落盘。批量:

```ts
write conflict://*  "@theirs"
```

一次解决 N 个冲突。

### 4.3 agent 视角的真实工作流

```
git status              →  列出冲突文件
read src/session.ts     →  看到冲突标记
write conflict://1 "@theirs"  →  解决冲突 1
read src/session.ts     →  校验
git add src/session.ts  →  完成
```

### 4.4 与 pi / 其它工具对比

| | 普通 agent | omp |
|---|------|------|
| 怎么告诉 agent 选哪边 | prompt 里写 "选 theirs" | 写 `conflict://1 @theirs` |
| 批量 | N 个文件 N 句 prompt | `conflict://*` 一句 |
| 可审计 | 无 | `xd://` 设备记每次写入 |
| 误操作 | 改错地方难追 | URL 协议,意图明确 |

---

## 5. 把这三件事合起来看

```
+----------------------------+
| 改一个文件                 |
+----------------------------+
       │
       ├── 单点精确改 ──→ hashline (edit)
       │
       ├── 模式化批量改 ─→ ast_edit (proposed → Accept)
       │
       └── 合并冲突 ───→ conflict:// URL
+----------------------------+
| 不确定?                    |
+----------------------------+
       │
       └── 先 ast_grep 查询,再决定 edit 还是 ast_edit
```

这就是 omp README 里 "Edit, AST Edit, Conflict" 三件套。

## ✅ 小结

| 武器 | 一句话 | 解决什么 |
|------|--------|----------|
| `hashline` | 按 `#n hash` 锚点改 | 重抄、拼错、stale 文件 |
| `ast_edit` | AST pattern + 预览接受 | 批量、跨文件、可审 |
| `conflict://` | URL 协议选 theirs/ours/base | 合并冲突、批量 |

和 pi 的对照:**pi 还是 string-based replace**,omp 已经把"写文件"从 LLM 最弱的环节(精确字符串处理)拿了出来。

## 🎯 下一课预告:第三课:智能协作

- `task` 工具怎么 fan-out (扇出派发) 到隔离 worktree,产物是 schema-validated (按 schema 校验过的) JSON
- Advisor 模型怎么"安静地"在每 turn 旁听、注 note (注记)、硬 block
- `/review` 命令怎么用 P0-P3 + 置信度评分输出 verdict
- **和 pi subagent 的关键差异**:omp 的子代理有"自己独立的工具集 +独立工作区 + 类型化产出",pi 的更像 prompt delegation (提示词委托)
