# Design: notes-plugin-pilot-manifest

## Decisions

### D1. 不改 notes-minimal

`notes-minimal.json` 仍是 parser / 未知字段 / DAG 的最小基线。Pilot 合同另文件，避免 Wave 0B 单测语义漂移。

### D2. commandId 用真实 Tauri 名

`note_card_list|get|create|update|archive|restore|delete`。这是 inventory 事实源，不是 `notes.create` 示例名。

### D3. 激活仍 lazy

`onView: notes.main` + `onCommand: note_card_create`。其余 command 在已激活 view 内调用，不必各写一个 unit。

### D4. 不进 Host

只当 fixture。4C 才映射 `ActivationRequest`。
