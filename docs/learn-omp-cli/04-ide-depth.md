# 第四课:IDE 深度 —— LSP + DAP + ast_grep

这一课把 agent 接入"IDE 的脑子"——它不再只是 grep 文本,而是**真的懂代码**;也不只是 print 调试,而是**真挂调试器**。

---

## 1. 三个协议/工具一句话定位

| 工具 | 全称 | 干什么 | pi 有吗 |
| ------ | ------ | -------- | :---: |
| `lsp` | Language Server Protocol (语言服务器协议) | 把代码当 AST (抽象语法树) 理解:跳转定义、查找引用、重命名、补全、悬浮文档、错误提示 | ❌ |
| `debug` | Debug Adapter Protocol (调试适配器协议) | 挂真实调试器:断点、单步、读栈帧、读变量、表达式求值 | ❌ |
| `ast_grep` | 基于 tree-sitter (语法解析器) + ast-grep 的结构化代码搜索 | 模式匹配代码结构(节点),不是匹配字符串 | ❌ |

> 简单类比:LSP 是"读懂代码",DAP 是"调代码",ast_grep 是"搜代码坏味道"。

---

## 2. LSP:14 个 ops 让 agent 拥有 IDE 的脑子

### 2.1 LSP 是什么(如果你完全没听过)

LSP 是 Microsoft 2016 年提的一个**协议**。一个 language server (语言服务器,比如 `typescript-language-server`) 跑在你机器上,暴露 JSON-RPC 接口;IDE 或工具(这里是 omp)调它。

一次 server 跑起来后,能回答:

```
"这行代码里 User 这个 symbol 在哪定义的?"        → goToDefinition
"这个 User 类型被谁 import 了?"                   → findReferences
"把 rename 改成 Admin,告诉我所有要改的位置再改"   → rename + willRenameFiles
"这行有什么错误?"                                  → publishDiagnostics
"这函数签名是什么?"                                → hover
"打个 . 我应该补全什么?"                          → completion
```

### 2.2 omp 怎么用 LSP(14 个 ops)

omp 把 LSP 的能力打包成一个 `lsp` 工具,14 个 op:

| op | 用途 |
| ---- | ------ |
| `diagnostics` | 当前文件/项目的报错/警告 |
| `goto_definition` | 跳转到定义 |
| `find_references` | 找所有引用 |
| `hover` | 悬浮文档(类型/JSDoc) |
| `completion` | 补全 |
| `signature_help` | 函数签名提示 |
| `document_symbols` | 当前文件的所有 symbol (符号, 如函数/类/变量) |
| `workspace_symbols` | 工作区所有 symbol |
| `rename` | 重命名(走 willRenameFiles) |
| `code_action` | 快速修复(quick fix) |
| `format` | 格式化 |
| `incoming_calls` | 哪些函数调用了我 |
| `outgoing_calls` | 我调用了哪些函数 |
| `raw_request` | 任意 LSP 请求(透传) |

### 2.3 杀手锏:rename 走 `workspace/willRenameFiles`

**普通 agent 的 rename**(pi 也是):

1. agent 改 `auth.ts` 里 `login → signIn`
2. 跑 `grep "login"` 找其它地方
3. 一个一个改 import、调用点、re-export
4. **漏改**的概率高,改错名字的概率也有

**omp 的 rename** 走 LSP 的 `workspace/willRenameFiles`:

```text
agent: rename login → signIn

omp 内部:
1. 问 TypeScript LSP:"我要改这些文件,你需要先做什么?"
   LSP 答:"auth.ts → newauth.ts,barrel.ts 里的 re-export (重新导出) 要重写"
2. omp 先把 barrel (集中导出文件)、re-export 改好
3. 再发 "真的要改了" 给 LSP
4. LSP 把所有引用同步更新
5. 落盘
```

结果:**rename 一个函数,所有 import、re-export、barrel 全部自动跟进**。

> omp README 原文:"Ask for a rename and you get a rename. The call goes through workspace/willRenameFiles, so re-exports, barrel files, and aliased imports update before the file moves."

### 2.4 实战:agent 怎么用 lsp 工具

```js
// 找到 login() 的所有调用点
lsp { op: "find_references", file: "src/auth.ts", line: 2, character: 17 }

// 准备改 login → signIn
lsp {
  op: "rename",
  file: "src/auth.ts",
  line: 2, character: 17,
  newName: "signIn",
  confirm: true  // 让 omp 真的改
}

// 写完后看看有没有类型错
lsp { op: "diagnostics", file: "src/auth.ts" }
```

### 2.5 omp 内置哪些 language server

omp 默认能自动起:typescript-language-server、pyright、gopls、rust-analyzer、clangd、jdtls(Java) 等,装好对应 runtime 就跑。

### 2.6 与 pi 对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| LSP 支持 | ❌(纯 grep) | ✅ 14 ops |
| Rename 改 barrel | 手动 | **自动**(`willRenameFiles`) |
| 类型错误感知 | 无 | ✅(diagnostics) |
| 跨语言 | n/a | TS/JS/Python/Go/Rust/C/C++/Java/... |

---

## 3. DAP:28 个 ops 让 agent 真挂调试器

### 3.1 DAP 是什么

调试适配器协议。和 LSP 是孪生兄弟:

- LSP server 负责"读懂"
- DAP server 负责"调试"

每个语言有自己的 DAP 实现:

| 语言 | 调试器 | DAP adapter (调试适配器) |
| ------ | -------- | --------------------- |
| C/C++/Rust/Swift(macOS) | lldb | lldb-dap |
| Go | dlv | delve (内置 DAP) |
| Python | debugpy | debugpy |
| Node.js | vscode-js-debug | vscode-js-debug |
| Java | jdtls (含 debug) | jdtls |

omp 通过 DAP 控制它们。

### 3.2 omp 的 28 个 DAP ops

```
启动/停止: launch, attach, disconnect, terminate
断点:     setBreakpoint, setExceptionBreakpoints, setFunctionBreakpoint
控制:     continue, pause, stepOver, stepIn, stepOut
线程:     threads, stackTrace
变量:     scopes, variables, setVariable
数据:     evaluate (执行表达式), watch
源码:     source, loadedSources
模块:     modules
内存:     readMemory
异常:     exceptionInfo
补全:     completions (调试控制台补全)
其他:     runInTerminal, progressStart/End, ...
```

### 3.3 实战场景:agent 真调试一个 C 程序 segfault (段错误)

任务: "这个 C 二进制随机数生成器崩了"

```js
// 1. 启动 lldb-dap,跑二进制
debug {
  op: "launch",
  adapter: "lldb-dap",
  program: "/tmp/omp-native/demo",
  args: []
}

// 2. 在可疑函数设断点
debug { op: "setBreakpoint", file: "demo.c", line: 6 }

// 3. 继续执行
debug { op: "continue" }
// → 命中 xorshift32()

// 4. 看栈帧
debug { op: "stackTrace" }
// → frame 0: xorshift32, ip=0x10000055C, demo.c:6:10

// 5. 看变量
debug { op: "scopes", frameId: 0 }
debug { op: "variables", variablesReference: <ref> }
// → x = 57351

// 6. 表达式求值:确认数学
debug { op: "evaluate", expression: "7 ^ (7 << 13)", frameId: 0 }
// → 57351

// agent: "x 从 7 变成 57351 (= 7 ^ (7<<13)),shift 没问题,
//  问题在循环里 next_x 没归一化,再加 & 0x7fffffff 就行"
```

> omp README 原文:"A C binary segfaults: the agent attaches lldb, steps to the bad pointer, reads the frame. ... Most agents are still sprinkling print statements."

### 3.4 与 pi 对比

| 维度 | pi | omp `debug` |
| ------ | ----- | ------------ |
| 调试方式 | print + 肉眼 | **真挂调试器** |
| 断点 | 无 | ✅ |
| 单步 | 无 | ✅ |
| 表达式求值 | 无 | ✅ |
| 线程/栈 | 无 | ✅ |
| 适配器 | n/a | lldb-dap / dlv / debugpy / js-debug / jdtls |

### 3.5 调试 vs print 的取舍

```
Print 调试适合:
- 单线程、状态简单
- 出错立刻能猜到位置
- 不想装调试器

DAP 调试适合:
- 多线程、并发、条件竞争
- 难复现的 bug
- 想看"程序此刻状态"而不是"程序走到了这里"
- agent 自动调试(人不想看)
```

---

## 4. ast_grep:结构化代码搜索

### 4.1 为什么不能只用 grep

```bash
grep "try {" src/**/*.ts  # 命中所有 try 块,但分不清 try-with-resources、try-catch、try-finally
grep "console.log"        # 命中字符串里、注释里、import 里,全是误伤
grep "throw new Error"    # 看不出错误类型,看不出堆栈上下文
```

grep 是**字符串匹配**,看不懂语法。

### 4.2 ast_grep 怎么写 pattern

ast-grep pattern (匹配模式) 是用代码本身写的,代表一个 **AST 节点**。

#### 基础 pattern

```js
// 找 console.log($X) 调用
pattern: "console.log($X)"
// 解释: $X 是 metavar (元变量, 代表"任意表达式")
// 任何 console.log(任意) 都命中

// 找 console.log($X) 调用,且 $X 是字符串字面量
pattern: "console.log(\"$\")"  // 元变量类型可以更精确
```

#### 多 metavar (元变量)

```js
// 找 try { $$$BODY } catch ($E) { $$$HANDLER }
// $E 单个表达式,$HANDLER 多语句(用 $$$ 表示 0..N 个)
pattern: "try { $$$BODY } catch ($E) { $$$ }"
```

#### Rule(带重写)

```js
// 找模式,并改写
rule: {
  pattern: "var $X = $Y",
  rewrite: "let $X = $Y"  // var → let
}
```

#### 限制文件类型/排除

```js
ast_grep {
  pattern: "console.log($X)",
  globs: ["src/**/*.ts", "src/**/*.tsx"],
  exclude: ["**/*.test.ts", "**/legacy/**"]
}
```

### 4.3 实战例子

**找所有 catch 但不 rethrow (重新抛出) 的地方**:

```js
ast_grep {
  pattern: "try { $$$BODY } catch ($E) { $$$ }",
  // 加 constraint (约束):handler 必须不包含 throw
  constraints: { handlerNoThrow: true }
}
// → 找出所有"吞错"的 catch
```

**找所有 class component**:

```js
ast_grep {
  pattern: "class $C extends React.Component",
  globs: ["src/**/*.tsx"]
}
// → 列出所有需要迁到 hooks 的类组件
```

**找所有 dynamic import (动态导入)**:

```js
ast_grep {
  pattern: "import($X)"  // 不是 import 声明,是动态 import()
}
```

### 4.4 与 grep 对比

| | grep | ast_grep |
| --- | ------ | ---------- |
| 匹配对象 | 字符串行 | AST 节点 |
| 区分语法 | ❌ | ✅(只匹配真 console.log 调用,不会命中字符串里的) |
| metavar | ❌ | ✅($X 任意表达式) |
| 跨语言 | ✅ | ✅(50+ tree-sitter 语法) |
| 重写 | ❌ | ✅(`ast_edit` 用同样 pattern 改) |

### 4.5 与 pi 对比

| | pi | omp `ast_grep` |
| --- | ----- | --------------- |
| 语法感知搜索 | ❌ | ✅ |
| 模式化改 | 无 | ✅(`ast_edit` 用同 pattern) |
| 50+ 语法 | n/a | ✅ |

---

## 5. 三件武器联动:实测场景

### 场景 1:跨文件改 API

```
1. ast_grep 找 "import { login } from '...'"  → 列出所有调用方
2. lsp rename login → signIn                → 自动改 barrel/re-export
3. lsp diagnostics                          → 检查改完没类型错
4. /review                                  → 评审改动
```

### 场景 2:调试多线程 bug

```
1. debug launch + setBreakpoint           → 挂上
2. threads + stackTrace                   → 看哪个线程在干嘛
3. evaluate 在不同 frame 跑表达式        → 确认状态
4. edit 改代码 + ast_edit 改锁逻辑       → 用结构化改保证正确性
5. debug continue 验证                   → 跑同一份输入不崩了
```

### 场景 3:消除代码坏味道

```
1. ast_grep 找所有 "console.log($X)"      → 一份清单
2. /advisor status                        → 确认开 advisor
3. ast_edit console.log → logger.info     → 预览 → accept
4. lsp diagnostics                        → 校验
5. /review                                → 评审
```

---

## 6. 与 pi 的全景对比

| 维度 | pi | omp |
| ------ | ----- | ----- |
| LSP | ❌ | ✅ 14 ops,带 willRenameFiles |
| 调试 | ❌ | ✅ 28 ops,真挂 lldb/dlv/debugpy |
| 结构化搜索 | ❌ | ✅ ast_grep |
| 批量改 | 手动 grep | ✅ ast_edit + preview |
| 跨文件一致性 | 手动维护 | LSP 自动同步 |

## ✅ 小结

| 武器 | 解决什么 | 核心 op |
| ------ | ---------- | --------- |
| `lsp` | 理解代码、自动改跨文件 | rename + willRenameFiles |
| `debug` | 真调试,不是 print | launch/setBreakpoint/evaluate |
| `ast_grep` | 结构化找模式 | pattern + metavar + constraint |

和 pi 的对照:**pi 把代码当字符串**,**omp 把代码当 AST**——这才是 IDE-wired 的本质。

## 🎯 下一课预告:第五课待定

候选主题:

- **Memory 系统**(retain/recall/reflect + Hindsight/Mnemopi backend)
- **Web search 内置**(23 providers + site-aware extraction)
- **omp commit**(原子 commit + P0 优先 + dependency 排序)
- **多模型协作**(10 个 role + fallback chain + round-robin)

告诉我下一课想听哪个。
