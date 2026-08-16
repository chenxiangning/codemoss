# Design

`runtime` 再导出 facade / injection / types。`ui` 再导出 panel / layout context。会话路径只走 runtime，避免把 Notes UI 拉进 messaging 图。产品文件不搬家。
