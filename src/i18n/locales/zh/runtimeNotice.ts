// runtimeNotice — Simplified Chinese UI strings
const runtimeNotice = {
  runtimeNotice: {
    title: "运行时提示",
    open: "打开运行时提示",
    minimize: "最小化",
    clear: "清空",
    emptyTitle: "暂无运行时提示",
    emptyDescription: "初始化进度和关键错误会显示在这里",
    statusIdle: "空闲",
    statusError: "异常",
    severityInfo: "提示",
    severityWarning: "警告",
    severityError: "错误",
    bootstrap: {
      start: "正在初始化本地状态...",
      storageMigrationCheck: "正在检查本地状态迁移...",
      inputHistoryRestore: "正在恢复输入历史...",
      interfaceResources: "正在加载界面资源...",
      mountShell: "正在挂载客户端界面...",
      localStorageMigrationFailed: "本地状态迁移失败，已按降级模式继续启动",
      ready: "客户端初始化完成",
      failed: "客户端初始化失败，请刷新后重试",
    },
    startupGate: {
      title: "正在启动",
      message:
        "正在完成初始化（约数秒），请稍候…此期间界面不可操作，避免无响应。",
      forceDismiss: "直接进入",
    },
    uiScale: {
      startupGuardReset:
        "检测到上次启动在界面缩放 {{scale}}% 时卡死，本次已临时恢复为 100%。您的缩放设置未被修改，可在设置中重新调整。",
    },
    runtime: {
      startupPending: "{{workspace}}：{{engine}} runtime 正在连接...",
      resumePending: "{{workspace}}：Runtime 探活异常，正在尝试恢复",
      ready: "{{workspace}}：{{engine}} runtime 已连接",
      suspectStale: "{{workspace}}：Runtime 探活异常，正在尝试恢复",
      cooldown: "{{workspace}}：Runtime 恢复失败，当前处于冷却期",
      quarantined: "{{workspace}}：Runtime 恢复失败，需要人工关注",
      codexSessionStartHookSkipped:
        "Codex 已跳过项目 SessionStart hook 并创建会话。请检查 `.codex/hooks.json`；项目上下文可能不完整。（{{reason}}）",
    },
    startup: {
      taskStarted: "后台加载开始：{{task}}（{{phase}} / {{workspace}}）",
      taskCompleted: "后台加载完成：{{task}}（{{durationMs}}ms）",
      taskFailed: "后台加载失败：{{task}}",
      taskTimedOut: "后台加载超时：{{task}}，已转入降级路径",
      taskDegraded: "后台加载降级：{{task}}（{{reason}}）",
      taskCancelled: "后台加载取消：{{task}}（{{reason}}）",
      commandCompleted:
        "内部命令完成：{{command}}（{{workspace}} / {{durationMs}}ms）",
      commandFailed:
        "内部命令失败：{{command}}（{{workspace}} / {{durationMs}}ms）",
      shellReady: "客户端外壳已就绪",
      inputReady: "输入区已可交互",
      activeWorkspaceReady: "当前工作区首屏数据已就绪",
    },
    engine: {
      checking: "正在检测 {{engine}} 状态...",
      ready: "{{engine}} 已就绪",
      unavailable: "{{engine}} 未安装，请先安装",
      requiresLogin: "{{engine}} 需先登录",
    },
    codex: {
      providerSelected: "已启用 {{name}}，点击 Codex 即可直接创建会话",
    },
    claude: {
      providerSelected: "已启用 {{name}}，点击 Claude Code 即可直接创建会话",
      resumeCommandCopied:
        "Claude 恢复命令已复制。如果 TUI 的 /resume picker 看不到这个 GUI 会话，请显式运行 claude --resume {{sessionId}} 或 /resume {{sessionId}}。",
    },
    kimi: {
      providerSelected: "已启用 {{name}}，点击 Kimi CLI 即可直接创建会话",
    },
    grok: {
      providerSelected: "已启用 {{name}}，点击 Grok CLI 即可直接创建会话",
    },
    opencode: {
      providerSelected: "已启用 {{name}}，点击 OpenCode 即可直接创建会话",
    },
    vendor: {
      activateProviderFailed: "启用供应商 {{name}} 失败：{{detail}}",
    },
    error: {
      createSessionRecoveryRequired:
        "{{workspace}}：会话创建失败，运行时正在恢复",
      threadTurnFailed: "{{engine}} 会话失败：{{message}}",
      codexSessionRecoverableFailure:
        "Codex 连接中断：旧会话绑定或运行时连接已失效，请重试或重新连接。",
    },
  },
};

export default runtimeNotice;
