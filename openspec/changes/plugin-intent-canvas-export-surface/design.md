# Design

`runtime` 再导出 context helpers、messageContext、relationship queries 与 types。`ui` 再导出 `IntentCanvasManager` 与 attachment card。AppShell / 会话只走 runtime，lazy 面板与 Composer 卡片走 ui。
