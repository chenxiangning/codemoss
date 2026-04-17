## Context

`project-runtime-log-viewer` 已完成 Java 首期能力，但用户需求已明确进入二期：同一控制台要覆盖前端（React/Vue）、Python、Go。  
核心问题从“有没有控制台”升级为“如何在不破坏已上线链路的前提下，为不同技术栈提供可执行默认命令与统一运行语义”。

当前已具备能力：

- 文件树 Run 入口与顶部 Build 入口。
- 工作区级会话隔离。
- start/stop/status + 日志事件流。
- 命令预设 + 可编辑覆写。

追加约束：

- 继续 additive-only，不重写 Run Console。
- 与现有终端面板保持互斥，避免底部双面板冲突。
- 自动探测失败必须可解释、可手工覆写。

## Goals / Non-Goals

**Goals:**

- 在现有会话与日志模型上扩展多栈 runtime profile。
- 支持 Node（React/Vue 常见脚本）、Python、Go 的默认可运行路径。
- 保证不同栈共享一致的状态机、日志流、停止行为。
- Run 按钮保持 toggle 语义，并与终端面板互斥。

**Non-Goals:**

- 不做语言特定 Debugger（断点/变量/调用栈）。
- 不实现复杂多配置模板管理（仅基础 profile + override）。
- 不在本轮覆盖 Ruby/.NET/PHP 等更多生态。

## Decisions

### Decision 1: 继续使用统一 Run Console（采纳）

- 不拆分语言专属面板。
- 通过 profile 适配层输出“命令建议 + 默认命令”。

理由：最小改动复用已验证链路，降低回归面。

---

### Decision 2: 引入 Runtime Profile Detector（采纳）

新增 `detectRuntimeProfiles(workspace)`，输出有序 profile 列表。

- Java: `pom.xml`, `build.gradle`, `build.gradle.kts`, wrapper。
- Node: `package.json` + scripts（`dev/start`）+ lockfile（`pnpm-lock.yaml/yarn.lock/package-lock.json/bun.lockb`）。
- Python: `pyproject.toml`, `requirements.txt`, `main.py`, `app.py`, `manage.py`。
- Go: `go.mod`, `main.go`, `cmd/*`。

理由：把“识别项目类型”与“执行命令”解耦，后续扩展语言不改 UI。

---

### Decision 3: 统一命令拼装协议（采纳）

`runtime_log_start` 内部先决策命令来源：

1. `command_override`（最高优先级）
2. `profile.defaultCommand`（自动探测）
3. fallback 错误（带建议）

理由：保持向后兼容并确保用户可控。

---

### Decision 4: Node 命令采用“包管理器感知脚本执行”（采纳）

优先级建议：`pnpm` > `yarn` > `npm` > `bun`（按 lockfile 命中）。

- `node-dev`: `<pm> run dev`
- `node-start`: `<pm> run start`

若脚本不存在则降级提示，并建议填写自定义命令。

---

### Decision 5: Python/Go 采用“保守默认 + 明确提示”（采纳）

- Python 默认优先：
  - `python manage.py runserver`（Django）
  - `python main.py` / `python app.py`
- Go 默认优先：
  - `go run .`
  - 若存在 `cmd/<name>/main.go`，建议 `go run ./cmd/<name>`

原则：默认命令必须可解释；不确定时不猜复杂参数，转为引导覆写。

---

### Decision 6: Run 按钮统一 toggle 语义（采纳）

- 文件树 Run 与顶部 Build 按钮都调用同一 `toggleRuntimeConsole`。
- 打开控制台时自动关闭终端；打开终端时自动关闭控制台。

理由：减少 UI 状态冲突，保证底部面板单一焦点。

---

### Decision 7: 事件模型保持不变，仅扩展 metadata（采纳）

- 保持 `runtime-log:*` 事件名称不变。
- 追加 `profileId` / `detectedStack` 字段用于 UI 命令来源说明。

理由：前后端兼容成本最低，避免协议破坏。

## Runtime Profile Matrix (Phase 2)

| Profile ID | Detection Signals | Default Command |
|---|---|---|
| `java-maven` | `pom.xml` / `mvnw` | `./mvnw spring-boot:run` 或 `mvn spring-boot:run` |
| `java-gradle` | `build.gradle*` / `gradlew` | `./gradlew bootRun` 或 `gradle bootRun` |
| `node-dev` | `package.json` + `scripts.dev` | `<pm> run dev` |
| `node-start` | `package.json` + `scripts.start` | `<pm> run start` |
| `python-main` | `main.py` / `app.py` / `manage.py` | `python main.py` 等 |
| `go-run` | `go.mod` / `main.go` | `go run .` |
| `custom` | 用户手工选择 | `command_override` |

## Risks / Trade-offs

- [Risk] Python/Go 项目入口多样，默认命令误判。
  → Mitigation: 保守匹配 + 清晰提示 + 强制可编辑覆写。

- [Risk] Node 包管理器推断错误导致命令不可用。
  → Mitigation: lockfile 优先，其次 `npm` 回退，并记录失败建议。

- [Risk] 多按钮入口可能出现状态不一致。
  → Mitigation: 统一 toggle handler + 互斥 effect（terminal/runtime）。

- [Risk] profile 扩展导致测试矩阵膨胀。
  → Mitigation: 以 detector 单测 + 命令拼装表驱动测试覆盖。

## Migration Plan

1. 抽象 profile detector 与 command builder（不改现有 UI）。
2. 扩展前端预设来源为“动态 profile 列表”。
3. 扩展后端 start 分支支持 Node/Python/Go profile。
4. 接入互斥状态守卫（runtime console vs terminal）。
5. 补齐多栈 fixture 与回归测试矩阵。

## Open Questions

- Python 是否引入 `uv` / `poetry` 优先策略，还是先保持 `python` 基础命令？
- Go 多入口项目（多个 `cmd/*`）默认选第一个还是提示用户选择？
- Node monorepo（workspace）场景是否需要支持“子包脚本运行”参数？
