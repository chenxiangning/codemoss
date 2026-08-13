# 冷启假死二分 · 证据包 2026-08-11

| 项 | 路径 |
|----|------|
| **全流程收口报告（详细）** | [`../cold-start-composer-freeze-closeout-2026-08-11.md`](../cold-start-composer-freeze-closeout-2026-08-11.md) |
| 逐步二分日志 | [`../cold-start-action-bisect-checklist-2026-08-11.md`](../cold-start-action-bisect-checklist-2026-08-11.md) |
| 截图 | [`./screenshots/`](./screenshots/) |
| 止血提交 | `d21e1b989` |

## 结论摘要（最终）

1. **根因**：冷启/Cmd+R **立即挂载完整 `Composer.tsx`**（重 hooks + store），与猛点撞主线程 → 假死。  
2. **非根因**：WebView、AppLayout、Sidebar/Messages、ChatInputBox、Adapter、composition hooks 单独均不卡。  
3. **止血**：延迟挂载完整 Composer（曾 `DeferredComposerMount`）。  
4. **根治形态**：`ComposerGate` + `ComposerLight`（Adapter + `sendReadiness` 静态模型位）→ 停手后 `ComposerImpl`；**无** atomic catalog 于轻量层。  
5. **UX**：模型位始终占位（「加载中」→ 真名）；Light 使用 `footer.composer` 同宽；工具栏不 `1fr` 撑空。  
6. **Mac 验收**：不卡 + 布局正确（用户确认）。Win 未测。  

## 截图命名

`step-NN-<desc>-ok|FREEZE.ext` · `00-user-feedback-*.ext` · `step-22-prod-off-mac-ok-*.jpg`
