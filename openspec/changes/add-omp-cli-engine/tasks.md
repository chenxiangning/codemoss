## 1. P0 Capability Spike（Priority P0）

- [x] 1.1 固化 `omp --version`、`omp --help`、`omp acp --help` 的 evidence fixture，并记录 OMP version
- [x] 1.2 编写 ACP initialize/session/prompt/update/cancel/terminal 的 failing protocol tests
- [x] 1.3 编写 Native RPC ready/response/event/command-discovery 的 failing frame tests
- [x] 1.4 实现独立 OMP frame decoder、size limit 和 malformed-frame error model
- [x] 1.5 运行 P0 focused tests 与本机 process smoke，输出 capability evidence
- [x] 1.6 **Code Review P0**：审核 protocol assumptions、large-frame handling、同级 Engine 零回归和证据完整性

## 2. P1 Engine Identity And Registry（Priority P0）

- [x] 2.1 编写 `EngineType::Omp`、registry metadata 和 capability matrix 的 failing tests
- [x] 2.2 增加 TypeScript/Rust/daemon 的 OMP engine identity，保持既有 Engine exhaustive parity
- [x] 2.3 增加 OMP 独立 adapter/protocol registry entry，禁止 PI parser reuse
- [x] 2.4 增加 OMP feature flags 与 `supported|compat-input|unsupported|unknown` projection
- [x] 2.5 运行 engine registry、capability matrix、TypeScript 与 Rust focused checks
- [x] 2.6 **Code Review P1**：审核 registry diff、9 个同级 Engine parity、flag 默认值和 isolation boundary

## 3. P2 Runtime Profile Provider Session（Priority P0）

- [x] 3.1 编写 workspace/profile/provider/session runtime-key isolation failing tests
- [x] 3.2 实现 OMP runtime owner、process handle generation 和 stop/abort lifecycle
- [ ] 3.3 实现 OMP runtime profile、provider profile、auth source 和 environment assembly boundary
- [x] 3.4 实现 native session 与 mossx logical thread 的 pending/canonical identity mapping
- [x] 3.5 验证同 workspace 多 profile/provider 并行运行不串台
- [x] 3.6 **Code Review P2**：审核 credentials scope、runtime ownership、cleanup、parallel isolation 和同级 runtime regression

## 4. P3 ACP Native Session（Priority P0）

- [x] 4.1 编写 ACP lifecycle contract 的 red tests：initialize、new session、prompt、update、cancel、terminal
- [x] 4.2 实现 `OmpAcpClient` stdio process spawn、stdin/stdout framing 和 correlation
- [x] 4.3 实现 ACP content/text/tool/reasoning/attachment 到 canonical event 的 normalization
- [x] 4.4 实现 cancel requested、cancel acknowledged、terminal cancellation 的 typed settlement
- [x] 4.5 运行 Rust ACP unit tests、fixture replay 和 `omp acp` process smoke
- [x] 4.6 **Code Review P3**：审核 ACP parser、terminal predicate、attachment boundary、process cleanup 和 PI non-interference

## 5. P4 Native RPC Control Plane（Priority P0）

- [x] 5.1 编写 ready protocol negotiation、request/response correlation、timeout、EOF 的 red tests
- [x] 5.2 实现 `OmpRpcClient` ready handshake、version negotiation、max frame/reassembly limits
- [ ] 5.3 实现 command discovery、extension UI、job control、model/provider control event routing
- [ ] 5.4 实现 RPC error mapping、pending request cleanup 和 process restart behavior
- [x] 5.5 运行 RPC fixture tests 与 `--mode rpc get_state` smoke probe
- [x] 5.6 **Code Review P4**：审核双协议隔离、out-of-order response、control/timeline boundary 和 recovery

## 6. P5 ACK Terminal Recovery History（Priority P0）

- [x] 6.1 编写 accepted/queued/delta/tool/approval/cancel/terminal state-machine red tests
- [x] 6.2 实现 OMP canonical ACK、terminal settlement 和 scoped run/turn/item identity
- [x] 6.3 实现 EOF、process exit、malformed frame、timeout、daemon restart 的 explicit recovery
- [x] 6.4 实现 OMP native history loader、resume mapping 和 idempotent replay
- [x] 6.5 验证重复 recovery 不重复消息、turn、cleanup 或 usage facts
- [x] 6.6 **Code Review P5**：审核 terminal evidence、recovery idempotency、history equivalence 和 persisted identity

## 7. P6 Frontend Realtime And History Projection（Priority P1）

- [x] 7.1 编写 OMP realtime adapter/history loader/canonical projection failing tests
- [x] 7.2 增加 OMP realtime adapter 与 history loader，raw ACP/RPC 不进入 renderer
- [x] 7.3 接入 live text/item channels，禁止 delta 直接进入 AppShell 根 reducer 链
- [x] 7.4 增加 OMP thread/session status、history resume、error/recovery projection
- [x] 7.5 运行 focused Vitest、history replay test 和实际 OMP stream smoke
- [x] 7.6 **Code Review P6**：审核 UI projection、render budget、stale event、thread identity 和同级 adapter parity
 
## 8. P7 Provider Model Profile UI And Tools（Priority P1）

- [x] 8.1 编写 provider/model/profile selector、catalog failure 和 fail-closed red tests
- [x] 8.2 接入 OMP provider/model catalog、thinking roles、profile selector 与 session binding UI
- [ ] 8.3 编写 tools/read/bash/edit/write/LSP/python/notebook/image attachment capability tests
- [ ] 8.4 接入 OMP tool capability grants、workspace add-dir、attachment normalization 和 approval boundary
- [x] 8.5 运行 catalog、composer、attachment、tool permission focused suites
- [ ] 8.6 **Code Review P7**：审核 provider isolation、secret redaction、tool grants、catalog fallback 和 same-engine regression

## 9. P8 MCP Browser Computer SSH Search（Priority P1）

- [x] 9.1 编写 MCP lifecycle、Browser relay、Computer、SSH、Search permission red tests
- [x] 9.2 实现 OMP external integration capability records 和 explicit workspace/user grants
- [x] 9.3 实现 MCP add/list/remove/test/reauth/enable/disable/reconnect/resources/prompts boundary
- [x] 9.4 接入 Browser/Computer/SSH/Search 的 feature-local state、approval、audit 和 secret redaction
- [x] 9.5 运行 security-focused integration fixtures，默认保持高风险 flags disabled
- [ ] 9.6 **Code Review P8**：审核 network/host permissions、credential handling、browser boundary 和 rollback

## 10. P9 Agents Jobs Todo Plan Compact Handoff（Priority P1）

- [x] 10.1 编写 agent/task/background-job stable id、owner、cancel、terminal red tests
- [ ] 10.2 实现 OMP agents、delegated tasks、background jobs、join 和 independent lifecycle
- [x] 10.3 编写 Todo/Plan/Prewalk/Advisor/Compact/Handoff feature-local projection tests
- [ ] 10.4 实现 todo operations、plan state、compact/handoff context boundary 和 persistence
- [x] 10.5 验证 background job settlement 不覆盖 foreground turn
- [ ] 10.6 **Code Review P9**：审核 ownership、cancel、persistence、context loss、render isolation 和 performance

## 11. P10 Skills Rules Extensions Plugins（Priority P2）

- [x] 11.1 编写 skill/rule discovery、disable、extension UI、plugin capability sandbox red tests
- [x] 11.2 实现 OMP skills/rules loading、versioned manifest 和 profile/workspace scope
- [ ] 11.3 实现 extensions discovery/enable/disable 与 headless/UI policy
- [x] 11.4 实现 plugin install/link/marketplace/enable/disable 的 permission and audit boundary
- [x] 11.5 运行 plugin/extension fixture tests，默认禁止未经批准的 filesystem/network access
- [ ] 11.6 **Code Review P10**：审核 supply-chain、sandbox、manifest validation、secret access 和 disable rollback

## 12. P11 Memory Advisor Security Usage Admin（Priority P2）

- [x] 12.1 编写 memory/advisor scope、security finding、usage attribution、export/share red tests
- [ ] 12.2 实现 Memory、Mental Models、Advisor 的独立 storage、queue、sync、diagnose 和 clear boundary
- [x] 12.3 实现 Security plan/scan/status/cancel/scans/show/import/export/validate/compare/disposition projection
- [x] 12.4 实现 Usage/Stats、HTML export、encrypted share 的 redaction、ownership 和 audit
- [x] 12.5 运行 security/usage/export focused verification，确认不污染 Conversation
- [ ] 12.6 **Code Review P11**：审核数据脱敏、权限、retention、finding disposition、usage attribution 和 admin rollback

## 13. P12 Git Worktree Bench Setup Update Diagnostics（Priority P2）

- [x] 13.1 编写 worktree mutation、git command、bench、setup/update/gc、diagnostics red tests
- [x] 13.2 实现 OMP worktree ownership、workspace mutation guard 和 cleanup
- [x] 13.3 实现 bench/provider-model measurement surface，不接入 foreground Conversation path
- [x] 13.4 实现 setup/install/update/gc/cleanse/grievances 的 admin-only control surface
- [x] 13.5 运行 workspace mutation、maintenance、diagnostics smoke 和 rollback probe
- [ ] 13.6 **Code Review P12**：审核 destructive action guard、workspace scope、admin permissions 和 same-engine safety

## 14. P13 Daemon Parity Release Hardening（Priority P0）

- [x] 14.1 编写 app 与 `cc_gui_daemon` 双路径 parity contract tests
- [x] 14.2 将 OMP settlement predicate、capability mapping、decoder 共享到 engine domain，禁止 bin copy
- [ ] 14.3 实现 metrics：startup、ACK、first delta、terminal、recovery、frame size、tool/job latency
- [ ] 14.4 实现 feature flags、version compatibility、migration、resident build identity 和 rollback guard
- [x] 14.5 运行 Rust、TypeScript、focused Vitest、daemon smoke、security scan 和 release checks
- [x] 14.6 **Code Review P13**：审阅完整 diff、capability matrix、性能、权限、daemon ancestry、回滚和同级 Engine regression

## 15. P14 Shared Session Qualification（Priority P3）

- [x] 15.1 编写 OMP Shared qualification matrix：terminal、handoff、provider binding、resume、cancel、tool exchange、recovery
- [ ] 15.2 ~~使用真实 ACP/RPC process 完成跨端 session、context handoff 和 recovery evidence~~（合规延期：P14 qualification 决定 OMP 保持 Native-only，见 evidence/omp-p14-shared-session-qualification.txt "P14.2 is intentionally not claimed"）
- [x] 15.3 若任一 qualification 未通过，保持 OMP Native-only 并记录 unsupported/unknown state
- [x] 15.4 **Code Review P14**：独立审核是否满足 Shared Session contract，禁止因 UI 需求提前加入支持集合

## 16. Final Verification And Closure

- [x] 16.1 运行 `openspec validate --all --strict --no-interactive`
- [x] 16.2 运行 OMP change 的 focused Rust、TypeScript、Vitest、daemon 和 process smoke verification
- [x] 16.3 运行 capability matrix、adapter registry、docs/governance consistency checks
- [x] 16.4 完成最终 code review：确认 OMP 变更未改变同级 Engine 行为
- [ ] 16.5 生成 verification evidence，完成 OpenSpec verify；按基石触发器校准 ADR 文档后再 archive
