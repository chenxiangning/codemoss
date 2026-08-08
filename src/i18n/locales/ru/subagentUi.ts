export default {
  subagentUi: {
    defaultName: "Субагент",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Обнаружено подтверждение запуска Claude Agent, но сеанс claude:subagent ещё не связан (native owner может ещё привязываться/индексироваться). Повторите попытку позже или откройте субагента из дерева сеансов слева.",
    toolCount: "Инструментов: {{count}}",
    close: "Закрыть",
    resizeSplit: "Изменить ширину панели субагентов",
    inspectorAria: "Сведения о субагенте",
    loadingSession: "Загрузка сеанса субагента…",
    sessionLoadFailed: "Не удалось загрузить сеанс субагента",
    emptySession: "В сеансе субагента пока нет сообщений (возможно, идёт индексация)",
    noSessionYet:
      "Сеанс субагента ещё не связан (agentId не определён или transcript ещё индексируется). Откройте строку «Субагент» в дереве сеансов слева.",
    status: {
      running: "Выполняется",
      completed: "Завершено",
      error: "Ошибка",
    },
    fields: {
      output: "Отчёт о результатах",
    },
  },
};
