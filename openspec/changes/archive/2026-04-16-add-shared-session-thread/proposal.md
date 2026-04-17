## Why

真实工作流里，很多用户会同时使用 `Codex` 和 `Claude Code`：有人让一个引擎写代码，让另一个引擎做方案讨论或解释。但当前产品把会话强绑定到单一引擎，用户只能在多个独立 thread 之间来回切换、重复喂上下文，无法把同一问题维持在一条连续对话里。

现在需要一个低破坏性的 V1 方案，让“统一对话，上层切引擎”成为可能，同时不重写现有原生 session 模型。

## 目标与边界

- 目标：
  - 新增一种创建时即确定的 `shared session` 类型，和现有原生会话并列存在。
  - `shared session` 持有单一的共享 thread / canonical conversation log；用户在这条 thread 中连续提问、追问和回看历史。
  - V1 中每个 turn 只允许一个执行引擎；当前 turn 的执行引擎由用户手动选择，且 shared session 只支持 `Codex / Claude`。
  - 共享会话内的当前引擎选择采用 sticky 语义：用户不主动切换时，后续消息沿用上一次选择。
  - 共享 thread 中的 assistant 输出与关键活动事实必须保留来源引擎标识，确保历史可解释、可追踪。
  - 实现方案必须显式考虑 `Windows / macOS` 兼容性，尤其是路径解析、文件锁/原子写入、隐藏 session 存储目录以及引擎进程恢复链路，不得默认依赖单一平台行为。
- 边界：
  - 不改造现有原生引擎 session 文件结构，不要求它们共享同一个底层会话文件。
  - `shared session` 创建后类型固定；V1 不支持把既有单引擎会话直接转换为 shared，也不支持反向转换。
  - V1 不支持单轮多引擎并行回答，不支持同一轮中途接力切换。
  - V1 不支持自动路由、智能选引擎或基于 prompt 内容的策略分发。
  - `Gemini / OpenCode` 在 V1 shared session 中不开放，只保留 native session 工作方式。
  - 现有原生引擎的入口、模型配置、原生 thread 列表与原生工作方式保持不变。
  - 本次实现以“新增模块”为主、“桥接接入”为辅；除必要的挂载/分流点外，不允许继续把 shared session 业务逻辑内联进既有超大文件。

## What Changes

- 在新建会话流程中新增 `shared session` 入口，并把它作为独立会话类型暴露给会话列表、顶部 Tabs 与重开链路。
- 为 `shared session` 引入统一对话账本，记录共享消息历史以及 turn 级执行元数据（例如本轮执行引擎、来源标识、必要的恢复信息）。
- 在 `shared session` 的输入区提供显式的引擎选择控件；V1 仅允许选择 `Codex / Claude`，发送消息时使用当前选中的引擎，并在用户未切换前持续沿用。
- 将 shared selector 更新改为“仅更新 shared meta 真值”，不在切换引擎时立即拉起本地 native session；对应 native binding 在首条真实发送时惰性 materialize，避免共享会话中额外出现本地会话与悬挂会话。
- 在消息流、会话概览和必要的活动面板中展示 shared thread 的来源引擎信息，避免用户失去“这条回复是谁产出的”判断能力。
- 保证 shared thread 的重开、回放和会话恢复以“单一共享对话”为主语义，而不是把历史拆回多个彼此隔离的单引擎 thread。
- 增强 shared runtime bridge：pending binding 的重绑定只允许“唯一且新鲜”的候选，并忽略陈旧 placeholder，避免事件串线导致的错误 rebind。
- 增强 shared 历史消息解析与 optimistic reconcile：兼容 `shared context sync wrapper`、`[User Input]` 包装、mode fallback 与 direct-text fallback，确保 Claude 历史用户气泡可见且不会在快照追平过程中被错误截断。
- shared 拥有的 hidden native bindings（Codex / Claude）默认从 native thread 列表中过滤，仅保留 shared thread 作为用户主视图。

## 非目标

- 不实现“同一条用户消息同时发给多个引擎并展示多份回答”。
- 不实现“同一轮里先让 `Claude` 回答，再继续交给 `Codex` 接力”的多阶段 turn。
- 不尝试让多个引擎直接读写同一套原生 session 存储。
- 不在本提案中改造模型/Provider 兼容性规则，也不引入新的自动调度策略。
- 不把现有单引擎会话批量迁移、合并或自动升级为 shared session。

## 技术方案对比

### 方案 A：直接让多个引擎共享同一个底层原生 session

- 做法：尝试让多个引擎共同读写一份会话存储，围绕同一 session id 运转。
- 优点：表面上最“真实共享”，理论上不需要额外的上层 thread 壳。
- 缺点：不同引擎的上下文压缩、tool schema、事件流、历史回放和 session 身份都不一致，强行共用底层文件会把兼容层复杂度推到极高，极易破坏现有稳定能力。

### 方案 B：继续维持多个原生会话，只在 UI 上做“分组/联动”

- 做法：把多个单引擎 thread 绑定成一个视觉上的会话组，用户看起来像在一组相关对话里切换。
- 优点：实现风险较低，能复用现有线程模型。
- 缺点：本质仍是多个独立上下文，无法真正解决“同一追问链条连续存在一条对话中”的核心诉求，用户仍需要在组内跳转并承担语义断裂。

### 方案 C：新增独立的 `shared session` 编排层（推荐）

- 做法：在现有原生会话之上新增一个共享会话类型，由它持有 canonical conversation log，并把每个 turn 路由给用户当前选中的执行引擎；V1 执行引擎范围仅 `Codex / Claude`。
- 优点：不破坏既有引擎实现；共享的是用户语义和对话账本，而不是引擎私有状态；边界清晰，便于逐步扩展。
- 缺点：需要新增会话类型、持久化模型和跨 surface 的 shared session 识别逻辑。

取舍：采用方案 C。V1 的正确抽象不是“让引擎共写同一底层 session”，而是“新增一个共享会话壳层，由 `Codex / Claude` 作为执行器接入”。

## Capabilities

### New Capabilities

- `shared-session-thread`: 定义 `shared session` 的创建入口、会话身份、统一历史、来源引擎标识以及重开/恢复时的单一共享对话语义。
- `shared-session-engine-selection`: 定义 shared thread 中仅面向 `Codex / Claude` 的手动引擎选择、sticky 默认行为、turn 级单引擎执行边界，以及禁止自动路由/并行执行的 V1 约束。

### Modified Capabilities

- 无。

## Impact

- Frontend
  - `src/app-shell.tsx`
  - `src/app-shell-parts/selectedAgentSession.ts`
  - `src/features/threads/hooks/*`
  - `src/features/threads/contracts/*`
  - `src/features/composer/components/ChatInputBox/*`
  - `src/features/layout/hooks/topbarSessionTabs.ts`
  - `src/features/session-activity/*`
  - `src/features/messages/components/*`
- Backend
  - `src-tauri/src/engine/*`
  - `src-tauri/src/backend/app_server.rs`
  - `src-tauri/src/storage.rs`
  - `src-tauri/src/client_storage.rs`
- Tests
  - 共享会话创建与恢复测试
  - turn 级单引擎路由与引擎切换测试
  - 会话列表 / Tabs / 消息流 / session activity 的 shared session 可见性回归
- File governance
  - 必须遵守大文件门禁 [large-file-governance.yml](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 与配套治理文档 [large-file-governance-playbook.md](/Users/chenxiangning/code/AI/github/mossx/docs/architecture/large-file-governance-playbook.md)。
  - 本次功能若触达接近阈值或超阈值文件，必须在同一 PR 内完成模块化拆分或桥接抽离，不接受“先堆进去、后续再拆”。
  - 共享会话相关代码优先新增到独立模块/目录，再通过 facade、selector、loader、adapter 或 command bridge 接入现有入口文件。

## 验收标准

- 用户必须能够在新建会话时创建 `shared session`，且该会话类型从创建时起即被明确标识。
- `shared session` 必须在单一 thread 中承载连续历史；用户切换执行引擎后，后续消息仍追加到同一条共享对话，而不是跳到新的原生 thread。
- 用户必须手动决定当前执行引擎；若用户未切换，系统必须沿用上一次选择，不得要求每次发送前重新选择。
- 用户在 shared session 中来回切换 `Codex / Claude` 后，后续 turn 必须始终遵循“当前最新选择”，并支持可逆切换（`Claude -> Codex -> Claude`）。
- 仅切换 shared selector（未发送消息）时，系统不得额外创建用户可见的 native 本地会话，也不得产生无法结束的孤立本地会话。
- V1 中每个 user turn 必须只由一个引擎执行；系统不得在同一 turn 内并行触发多个引擎，也不得自动改派其他引擎。
- 共享对话中的 assistant 消息和关键活动记录必须带有明确的来源引擎标识，用户可稳定区分回答来自哪个引擎。
- shared 历史回放必须完整显示用户消息；即使历史载荷为 wrapper/fallback 形态，也不得出现 Claude 用户气泡缺失或首轮消息截断。
- 关闭并重新打开 `shared session` 后，系统必须仍以单一共享对话恢复历史，不得把既有历史拆散为多个互不关联的单引擎会话。
- 现有原生会话的创建、发送、恢复与显示行为必须保持不变；`Gemini / OpenCode` 不得因为 shared session 改造而回退。
- shared pending binding 的重绑定必须具备 freshness/uniqueness 保护，陈旧 placeholder 不得影响后续事件路由与 thread 归属。
- 涉及 shared session 的新增存储与恢复链路必须在 `Windows / macOS` 上采用等价语义，不得出现路径硬编码、分隔符假设或平台特化文件操作导致的单平台可用实现。
- 本次功能实现完成后，PR/CI 必须通过 [large-file-governance.yml](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml) 对应的大文件门禁检查；若触发阈值修复，修复必须在同一 PR 中完成。
- 共享会话的业务实现必须以新增模块为主、桥接接入为辅；主集成文件仅允许保留最小挂载、分流与 facade 级改动。
