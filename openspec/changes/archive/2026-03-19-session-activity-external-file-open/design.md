## Context

当前 `Session Activity` 的文件跳转来源于工具调用解析结果，点击后会进入统一编辑器文件查看链路。该链路现有路径域只覆盖：

- `workspace`（工作区内）
- `external-spec`（active external spec root 内）
- `unsupported-external`（其余绝对路径，直接报错）

因此当活动卡片的路径是 `~/.codex/skills/**/SKILL.md` 这类“非 workspace、非 spec root，但实际可读”的文件时，会被误归类为不可读，造成体验不一致。

约束：

- 必须保留 workspace 与 external-spec 的现有行为和安全边界。
- 不扩大到“任意外部路径可写”。
- 不改变 Spec Hub 的 external root 解析优先级（external root 优先）。

## Goals / Non-Goals

**Goals:**

- 建立统一、可解释的路径域路由模型，支持 `external-absolute` 只读打开。
- 让 Session Activity 卡片跳转在多类外部路径下行为一致、可预测。
- 用最小改动保持现有功能无回归。

**Non-Goals:**

- 不支持外部绝对路径的默认写入。
- 不新增外部文件树浏览入口。
- 不重构消息区 markdown 链接打开器与系统 opener 行为。

## Decisions

### Decision 1: 将路径域扩展为 4 态模型

采用：

- `workspace`
- `external-spec`
- `external-absolute`（新增）
- `invalid`

理由：

- 相比在 UI 层追加 `if`，显式 domain 更稳定，可被测试与复用。
- 可清晰表达“不可读”与“可读但不在 workspace/spec root”两类语义。

备选方案：

- 仅在 `unsupported-external` 分支特判白名单路径。
  - 放弃原因：会形成路径例外清单，长期不可维护。

### Decision 2: 读取分发下沉到服务层命令，而非继续堆叠 FileViewPanel 条件分支

采用在读文件服务中新增 `readExternalAbsoluteFile`（或等价命令）并由 domain 分发。

理由：

- 避免 UI 层承载权限与路径判断细节。
- 保持前后端边界清晰：前端负责路由决策，后端负责文件可读性与边界校验。

备选方案：

- 前端直接调用现有 `read_workspace_file` 并伪造相对路径。
  - 放弃原因：破坏命令语义且易引发安全边界混淆。

### Decision 3: 外部绝对路径能力默认只读，写入仍按现有边界拒绝

理由：

- 本问题核心是“打不开”，不是“要编辑外部文件”。
- 只读增强风险小，能满足当前故障修复目标。

备选方案：

- 同步开放外部绝对路径写入。
  - 放弃原因：风险高，需额外权限策略与回滚设计，不符合最小修复原则。

## Risks / Trade-offs

- [Risk] 外部绝对路径读取可能被误用为宽泛文件访问  
  → Mitigation: 仅开放显式 `readExternalAbsoluteFile`，保持写入拒绝，并保留路径规范化与可恢复错误。

- [Risk] domain 扩展引发既有分支回归  
  → Mitigation: 增加覆盖 `workspace / external-spec / external-absolute / invalid` 的判定测试和面板集成测试。

- [Risk] macOS/Windows 路径大小写与分隔符差异导致误判  
  → Mitigation: 复用现有 `normalizeFsPath` / case-insensitive 逻辑，新增跨平台样例。

## Migration Plan

1. 先补路径域类型与判定函数，新增 `external-absolute`。
2. 新增后端只读命令（或等价服务接口）并完成边界校验。
3. FileViewPanel 读取分发接入新 domain；写入分支保持拒绝。
4. 补齐测试并执行最小回归。
5. 灰度观察错误 toast 里 `Invalid file path` 的命中下降情况。

Rollback:

- 若出现回归，回退到旧 domain 枚举与旧读取分发；保留 proposal/spec 文档以便二次迭代。

## Open Questions

- external-absolute 是否需要限制在用户 home 目录或特定允许根下？
- 是否需要在 UI 上明确标注“外部只读文件”，避免用户误认为可保存？
- 后续是否要把同一能力下沉到消息区 file link 打开逻辑以统一体验？
