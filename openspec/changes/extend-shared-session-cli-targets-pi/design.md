# Design: extend-shared-session-cli-targets-pi

## Context

`extend-shared-session-cli-targets`（2026-08-03 归档）已确立「engine-neutral Shared V2 owner + 窄 adapter」的接入范式：durable attempt、Context Package、receipt、terminal settlement 与 recovery 是单一 contract，每个 CLI 只贡献 Binding identity、runtime key、context capability 与 EngineEvent ingress 四个窄映射。`add-pi-engine`（2026-08-12）把 Pi 接入为 Native first-class engine，且其 adapter 形状与 Kimi/Grok/OpenCode 完全同构（`send_message(&self, SendMessageParams, turn_id)`、`--session-id` 续聊、`PiProviderLaunchProfile` local sentinel `__local_pi__`、manager 的 `get_or_create_pi_session_for_runtime` 工厂）。本变更只补齐 Pi 进入 Shared 白名单后仍缺失的窄适配点。

上游锚点：`dev-guidelines/backend/shared-session-v2-send-contract.md`（实现契约）、`openspec/specs/shared-session-engine-selection`（六 CLI 选择）、Wave 4 Change B design（Binding Key / provisioning / owner routing 决策 D1–D11）。

## Goals / Non-Goals

**Goals:**

- Pi 成为第六个 supported Shared target，走与 Kimi/Grok/OpenCode 完全相同的 V2 send 路径。
- 所有 Pi 特定逻辑落在既有窄 adapter 点上，不引入第六套 pipeline。
- 现有五 CLI 与 Native Pi 零行为变化。

**Non-Goals:**

- `pi --mode rpc`、mid-turn steering、managed Provider CRUD、Shared compaction for Pi、Gemini 恢复。
- `fix-pi-session-continuity-and-sidebar` 的 Native 续聊修复（正交，工作区未提交，不触碰）。

## Decisions

| # | 决策 | 理由 |
|---|---|---|
| D1 | **context capability 与 Kimi/Grok/OpenCode 同组**：`user_channel_transcript: true`、`strong_context_ack: false`、`structured_history_import: false`、`native_delta/clone/image/tool_history: false` | Pi Shared 上下文经 user-channel prompt 投递（`engine_send_message` 文本路径），Pi 无 `--replay-user-messages` 类强 ACK 机制；Kimi/Grok/OpenCode 同为弱 ACK 组。若后续 Pi CLI 实测提供 typed echo 再单独升级，禁止猜测支持（八荣八耻：不猜接口） |
| D2 | **抽出 `pi_runtime_key(workspace_id, provider_profile_id)`** 到 `pi_provider_profile.rs`，local sentinel 用 `PI_LOCAL_PROVIDER_PROFILE_ID = "__local_pi__"`，named 用 `{workspace}::pi::{profile}` | `provider_runtime_key_for_target` 现有四个 engine 都有独立 pub fn；runtime key 逻辑已内嵌在 `resolve_pi_provider_launch_profile`，抽出复用并保持与 Kimi/Grok/OpenCode 的形状一致 |
| D3 | **pending / established 判定补 Pi 臂**：`is_pending_shared_binding_thread_id` 加 `pi-pending-shared-` 前缀；`binding_uses_established_native_thread` 的终判从 `Gemini \| Pi => false` 拆出 Pi，走 `pi:` 前缀剥离 | 朱昆鹏已预埋 `engine_binding_thread_id` 的 `pi-pending-shared-{seed}` 生成与 `normalize_native_session_identity` 的 `pi:` 归一；若判定函数不补臂，Pi binding 永判 pending，首轮 materialize 出的 `pi:{uuid}` 无法进入 established 续聊，且 pending 占位会被双前缀化成 `pi:pi-pending-shared-*` |
| D4 | **dispatch 复用 Pi Native 分发**：`shared_session_v2.rs` 的发送 dispatch Pi 臂镜像 Kimi/Grok/OpenCode 臂（`provider_profile_id` 回退 local sentinel → established 判定 → strip `pi:` 前缀得 raw session id → `continue_session = had_native_binding && established` → `engine_send_message(thread_id=Some(native_session_id), session_id=raw, ...)`） | `engine/commands.rs:2867` 的 Pi 臂已含 `resolve_pi_provider_launch_profile` → `get_or_create_pi_session_for_runtime` → `resolve_pi_session_id_for_engine_send` → `--session-id` 注入全链路；shared 只负责把 durable owner 翻译成 send 参数，不碰 adapter 内部 |
| D5 | **materialize / probe 补 Pi 臂**，跟随 Kimi（materialize）与 Grok（probe）同款窄映射 | `materialize_attempt_binding` 的 `Kimi | OpenCode` 臂与 probe 的 `Kimi`/`Grok` 臂已示范 local-sentinel 物化与健康探测的完整写法；`:4314` `unreachable!` 锚点保持穷尽强制 |
| D6 | **FE 目录仅 local 形态**：Pi 在 Shared/Home picker 中只有 `__local_pi__` sentinel + Pi 模型发现结果（`DEFAULT_PROFILES.pi`），无 managed profile 列表 | Pi 的 auth/models 在原生 `~/.pi`，无 managed CRUD；`useProviderTargetCatalogOwners.ts` 已有 `DEFAULT_PROFILES.pi` 本地项，补 `loadProfileCatalog` 的 Pi 分支即可 |
| D7 | **Reasoning 级不扩 Pi 档位枚举**：`atomicModelReasoning.ts` 只覆盖 claude/grok/codex 分支，Pi 与 Kimi 同走默认路径 | 与 Kimi 现状对齐（YAGNI）；Pi 的 `--thinking` 档位在 Native 发送参数里已有完整枚举，Picker 层后续有需求再统一扩展 |
| D8 | **sidebar hide set 补 `pi` 前缀**：`SHARED_HIDE_ENGINE_PREFIXES` + `"pi"` | 该集合决定 sidebar 对 `engine:` 前缀线程的隐藏归类；缺 Pi 会导致 Native Pi 会话与 Shared Pi binding 在侧栏互相泄漏 |
| D9 | **测试以扩展既有矩阵为主**：`shared_session_v2.rs:410,491` 的 `[Kimi, Grok, OpenCode]` capability 测试数组、receipt/provider matrix tests 补 Pi；FE 补 `sharedSessionEngines.test.ts` 与 target/catalog focused 用例；`shared_sessions.rs` pending id 测试已按 `engine.icon()` 泛化自动覆盖 | 最小增量验证；不新增测试框架与 fixture 体系 |
| D10 | **能力矩阵不动**：`capability_matrix.rs` / `EngineFeatures::pi()` / FE generated matrix 均无 shared-session 维度，Shared 能力由 `context_capabilities` 单独声明 | `engine-capability-matrix` spec 要求矩阵三源一致，但本变更不改任何矩阵 cell；改矩阵会扩散 blast radius |
| D11 | **durable Attempt schema 枚举扩 `"pi"`**：`shared_event_log/canonical/validator.rs` 的 `validate_turn_execution_snapshot` 与 `validate_provider_private_ref` 两处 engine 枚举加 `pi`；interrupt control 面补 Pi 臂（`interrupt_shared_attempt` 镜像 Kimi/Grok，`get_pi_session_for_runtime` + `interrupt_turn`） | 实施验证暴露的两处 gap：durable attempt 落库校验按白名单枚举 engine，缺 `pi` 会导致 receipt owner 持久化被拒（`unknown engine enum value: pi`）；interrupt 的 `unsupported` 兜底臂会让 Pi 轮次无法通过 shared control 停止。均为既有窄 adapter 点的枚举扩展，不改 schema 版本（旧日志不含 `pi`，向后兼容） |

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| Pi 弱 ACK 组下 context echo 无法验证，退化为 prompt-prefix 信任 | Shared Pi 上下文交付缺 transport 级确认 | 与 Kimi/Grok/OpenCode 同现状；D1 显式声明弱 ACK，不做超范围承诺 |
| `fix-pi-session-continuity-and-sidebar`（未提交）与本次 FE 改动重叠 | 工作区冲突、提交污染 | 本次只改 shared-session/composer/sidebar 白名单点，不触碰其 3 个 threads hooks 文件；commit 前逐文件核对 diff 归属 |
| `_ =>` 兜底臂遗漏（probe 的 `Some(_) => "unsupported-engine"` 等） | Pi 在白名单内仍被拒或报错文案错 | D1–D5 清单逐一补齐；实现后 grep 复查 `EngineType::Pi` 在 shared_* 三个文件的所有 match 完整性 |
| Pi 未安装时 Shared picker 显示状态 | 用户点选后 dispatch 失败 | 复用 add-pi-engine 的 not-installed 状态链路；验收标准显式要求 fail closed + 可读原因 |
| `pi_runtime_key` 抽出改变 `resolve_pi_provider_launch_profile` 内部实现 | Native Pi 发送回归 | 只把内嵌 key 计算提取为 pub fn 并原样调用，Native 行为不变；Native Pi focused Rust tests 复跑 |
| Shared Pi 首轮 `session_id` 参数语义 | 与 Grok 首轮预分配（`-s`）不同，Pi 仅 established 后传 `--session-id` | D4 明确首轮不传 `--session-id`（与 Kimi/OpenCode 一致），首轮 ACK 后 native id 回填 binding，第二轮起续聊 |

## Migration Plan

- 无存储迁移、无新 IPC、无依赖变更。
- 部署：随下个版本灰度；Pi 未安装的用户在 picker 中看到 not-installed，无任何副作用。
- 回滚：整体 revert 本变更；若只想降级 Pi，改回白名单即恢复五 CLI 形态（binding 里已写入的 Pi 行会被 `sanitize_shared_session_meta` 按 unsupported 清理，不残留幽灵 target）。

## Open Questions

- Pi 模型发现接口在 Shared picker 中的懒加载策略（复用 Native Pi 的 model discovery 结果 vs 独立拉取）：实现时以 `DEFAULT_PROFILES.pi` 现状为准，若发现接口缺失则在本变更内补最小桥接并在 tasks 中记录。
