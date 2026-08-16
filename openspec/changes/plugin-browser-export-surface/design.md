# Design

`runtime` 再导出 attachment helpers、active context、dock events。`ui` 再导出 `BrowserDock` 与 preview / summary card。AppShell / 会话只走 runtime，lazy dock 与 Composer 走 ui。
