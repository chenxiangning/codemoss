# add-pi-engine design

## Protocol (spike 2026-08-12, pi 0.83.0)

```text
pi --print --mode json "<prompt>"
   [--model <provider/id>] [--session-id <id>] [--thinking <level>]
```

Stdout NDJSON (observed + JetBrains mapping):

| type | 处理 |
|------|------|
| `session` | SessionStarted + capture id |
| `message_update` + `text_delta` / `thinking_delta` | TextDelta / ReasoningDelta |
| `tool_execution_start` / `tool_execution_end` | ToolStarted / ToolCompleted |
| `message_end` (assistant + usage) | 累计 usage（可选 emit） |
| `agent_end` / `turn_end` + errorMessage | TurnError 证据 |
| 其他 | skip |

Models: `pi --list-models` 固定宽度表 → `provider/model` id。

History: `~/.pi/agent/sessions/<encoded-cwd>/<ts>_<sessionId>.jsonl`  
Header `type=session`；messages `type=message` role user|assistant|toolResult。

## ACK

- Input ACK: first non-pending `session` id 或 first stdout JSON line（weak→standard）
- Terminal: process exit + TurnCompleted / TurnError

## Install strategy

- npm global: `@earendil-works/pi-coding-agent`（bin: `pi`）
- install / update / uninstall 均支持（同 Kimi 路径）
- 备选文案：`curl -fsSL https://pi.dev/install.sh | sh`

## Architecture mapping

| 层 | 文件 |
|----|------|
| Identity | engineIds.json, EngineType, adapter_registry |
| Runtime | pi.rs, manager, commands, status |
| History | pi_history.rs, session_history_commands |
| Capability | matrix.json + scripts |
| Frontend | piRealtimeAdapter, piHistoryLoader/Parser, ChatInputBox, Settings |
| Lifecycle | installer Pi, pi_doctor, piBin settings |

## Shared

**Explicit no**: 不进入 Shared Session 支持集合。

## Image input

compat-input：路径注入 + agent Read（复用 cli_image_input 风格，PI 专用 marker）。
