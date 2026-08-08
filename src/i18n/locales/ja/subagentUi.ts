export default {
  subagentUi: {
    defaultName: "サブエージェント",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Claude Agent の起動応答を検出しましたが、claude:subagent セッションにまだ関連付けられていません（native owner がバインド/インデックス中の可能性があります）。しばらくしてから再試行するか、左のセッションツリーからサブエージェントを開いてください。",
    toolCount: "{{count}} 個のツール",
    close: "閉じる",
    resizeSplit: "サブエージェントパネルの幅を調整",
    inspectorAria: "サブエージェント詳細",
    loadingSession: "サブエージェントセッションを読み込み中…",
    sessionLoadFailed: "サブエージェントセッションの読み込みに失敗しました",
    emptySession: "サブエージェントセッションにまだメッセージがありません（インデックス作成中の可能性）",
    noSessionYet:
      "サブエージェントセッションにまだ関連付けられていません（agentId が未解決か、transcript がインデックス作成中）。左のセッションツリーで「サブエージェント」行を開いて確認できます。",
    status: {
      running: "実行中",
      completed: "完了",
      error: "失敗",
    },
    fields: {
      output: "成果レポート",
    },
  },
};
