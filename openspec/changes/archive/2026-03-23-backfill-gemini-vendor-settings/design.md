## Context

本次变更属于“已实现功能的规范回补”。当前代码已经具备 Gemini 供应商配置完整链路：  
前端提供独立 Gemini 配置面板（预检、环境变量、认证模式、保存），后端通过 Tauri command 持久化至 `~/.codemoss/config.json` 的 `gemini` section，并提供 `gemini/node/npm` 预检。

约束与现状：

- 技术栈固定为 Tauri（Rust）+ React（TypeScript）。
- 供应商设置页已存在 Claude/Codex 体系，本次为同层新增 Gemini。
- 用户要求 Gemini 配置默认启用，且 UI 隐藏启用开关。
- 用户要求 tab 使用官方引擎图标，并保留 Gemini 配置入口。

## Goals / Non-Goals

**Goals:**

- 将 Gemini 供应商配置能力抽象为可验证的 OpenSpec 契约。
- 明确认证模式语义、字段显隐、环境变量映射与保存回读行为。
- 明确供应商页入口与 UI 可见性（含引擎图标、Gemini 配置入口）。
- 明确运行前预检行为，确保故障可感知、可定位。

**Non-Goals:**

- 不覆盖 Gemini 对话执行链路（实时/历史消息发送、会话编排）。
- 不重构 Claude/Codex 既有 provider 数据模型。
- 不新增与 OpenSpec 无关的 UI 功能（如新的全局设置项）。

## Decisions

### Decision 1: 使用独立 `gemini` section 持久化配置（选用）

- 方案 A：复用 Claude/Codex provider 结构，按 provider id 存 Gemini。  
  优点：结构统一。  
  缺点：语义耦合高，不利于 Gemini 特有认证模式表达。
- 方案 B：在 `~/.codemoss/config.json` 增加独立 `gemini` section（选用）。  
  优点：边界清晰，读写命令稳定，便于后续扩展 Gemini 专属字段。  
  缺点：与 Claude/Codex 的 provider 列表结构不完全一致。

结论：采用方案 B。

### Decision 2: 认证模式与环境变量映射走“模式驱动 + 字段清理”策略（选用）

- 方案 A：仅保存 env 文本，不维护模式语义。  
  优点：实现最简单。  
  缺点：UI 难以保证字段显隐一致，配置容易残留脏字段。
- 方案 B：显式维护 `auth_mode`，并在切换模式时清理无关字段（选用）。  
  优点：用户行为可预期，配置状态可回读，减少误配置。  
  缺点：需要维护模式与字段映射规则。

结论：采用方案 B。

### Decision 3: `enabled` 默认启用并在 UI 隐藏开关（选用）

- 方案 A：保留开关并允许关闭。  
  优点：控制粒度高。  
  缺点：与当前用户需求冲突，增加无效状态空间。
- 方案 B：固定为 `enabled=true`，仅保留配置能力（选用）。  
  优点：减少状态分支，符合当前产品诉求。  
  缺点：短期内无法通过 UI 禁用 Gemini。

结论：采用方案 B，后续如有需求再回引开关。

### Decision 4: 预检采用轻量命令探测（选用）

- 方案 A：仅检查 `gemini --version`。  
  优点：实现简单。  
  缺点：定位 Node/npm 环境问题不足。
- 方案 B：检查 `gemini`、`node`、`npm` 三项并返回 `pass/fail + message`（选用）。  
  优点：故障定位更直接，满足设置页可诊断需求。  
  缺点：多一次命令调用开销。

结论：采用方案 B。

## Risks / Trade-offs

- [Risk] `enabled` 固定为 true 可能弱化可控性  
  → Mitigation：保留后端字段与读写协议，后续可无破坏恢复 UI 开关。

- [Risk] 环境变量仅从 env 文本解析，未覆盖 `configText` 兼容兜底  
  → Mitigation：在后续迭代中补 `API_BASE_URL/MODEL` 兜底读取策略（不影响本期主流程）。

- [Risk] UI 频繁调整导致“行为一致/外观变化”难追溯  
  → Mitigation：通过本次 spec 固化行为契约，把视觉差异从行为契约中解耦。

## Migration Plan

1. 建立 Gemini 供应商配置命令与配置节（读/写/预检）。  
2. 建立前端 Gemini 配置 Hook（模式推断、字段映射、保存回读）。  
3. 在供应商页挂载 Gemini tab 与面板，完成 icon 与入口对齐。  
4. 根据产品诉求隐藏 Gemini 顶部 banner 与启用开关，保持配置行为不变。  
5. 通过 typecheck / lint / 预检交互完成最小回归确认。

## Rollback

- UI 回滚：恢复 Gemini banner 与启用开关渲染，不影响已有配置数据。
- 逻辑回滚：将 `enabled` 固定策略恢复为可编辑字段，沿用现有存储结构。
- 存储回滚：保留 `gemini` section，不做 destructive 迁移。

## Open Questions

- 是否需要补齐 `API_BASE_URL` / `MODEL` 的跨来源兜底读取（与 codeg 完全同语义）？
- 是否需要将 Gemini 预检扩展到 `gcloud`/ADC 可用性层（用于 Vertex 场景）？

