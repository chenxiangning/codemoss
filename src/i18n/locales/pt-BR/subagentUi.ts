export default {
  subagentUi: {
    defaultName: "Subagente",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Confirmação de inicialização do Claude Agent detectada, mas nenhuma sessão claude:subagent está vinculada ainda (o native owner pode estar vinculando/indexando). Tente novamente mais tarde ou abra o subagente na árvore de sessões.",
    toolCount: "{{count}} ferramentas",
    close: "Fechar",
    resizeSplit: "Ajustar a largura do painel de subagentes",
    inspectorAria: "Detalhes do subagente",
    loadingSession: "Carregando a sessão do subagente…",
    sessionLoadFailed: "Falha ao carregar a sessão do subagente",
    emptySession: "A sessão do subagente ainda não tem mensagens (pode estar indexando)",
    noSessionYet:
      "Nenhuma sessão de subagente vinculada ainda (agentId não resolvido ou transcript ainda indexando). Abra a linha «Subagente» na árvore de sessões.",
    status: {
      running: "Em execução",
      completed: "Concluído",
      error: "Falha",
    },
    fields: {
      output: "Relatório de entrega",
    },
  },
};
