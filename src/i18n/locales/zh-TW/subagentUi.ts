export default {
  subagentUi: {
    defaultName: "子代理",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "已識別 Claude Agent 啟動回執，但尚未關聯到 claude:subagent 會話（native owner 可能仍在綁定/索引）。請稍後重試，或從左側會話樹打開對應子代理。",
    toolCount: "{{count}} 個工具",
    close: "關閉",
    resizeSplit: "調整子代理面板寬度",
    inspectorAria: "子代理詳情",
    loadingSession: "正在載入子代理會話…",
    sessionLoadFailed: "子代理會話載入失敗",
    emptySession: "子代理會話暫無消息（可能仍在索引）",
    noSessionYet:
      "尚未關聯到子代理會話（agentId 未解析或 transcript 仍在索引中）。可從左側會話樹打開「子代理」行查看。",
    status: {
      running: "執行中",
      completed: "已完成",
      error: "失敗",
    },
    fields: {
      output: "交付報告",
    },
  },
};
