export default {
  subagentUi: {
    defaultName: "子代理",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "已识别 Claude Agent 启动回执，但尚未关联到 claude:subagent 会话（native owner 可能仍在绑定/索引）。请稍后重试，或从左侧会话树打开对应子代理。",
    toolCount: "{{count}} 个工具",
    close: "关闭",
    resizeSplit: "调整子代理面板宽度",
    inspectorAria: "子代理详情",
    loadingSession: "正在加载子代理会话…",
    sessionLoadFailed: "子代理会话加载失败",
    emptySession: "子代理会话暂无消息（可能仍在索引）",
    noSessionYet:
      "尚未关联到子代理会话（agentId 未解析或 transcript 仍在索引中）。可从左侧会话树打开「子代理」行查看。",
    status: {
      running: "运行中",
      completed: "已完成",
      error: "失败",
    },
    fields: {
      output: "交付报告",
    },
  },
};
