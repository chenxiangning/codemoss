export default {
  subagentUi: {
    defaultName: "Subagente",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Se detectó la confirmación de inicio del Claude Agent, pero aún no hay una sesión claude:subagent vinculada (el native owner puede seguir vinculándose/indexándose). Inténtalo más tarde o abre el subagente desde el árbol de sesiones.",
    toolCount: "{{count}} herramientas",
    close: "Cerrar",
    resizeSplit: "Ajustar el ancho del panel de subagentes",
    inspectorAria: "Detalles del subagente",
    loadingSession: "Cargando la sesión del subagente…",
    sessionLoadFailed: "Error al cargar la sesión del subagente",
    emptySession: "La sesión del subagente aún no tiene mensajes (puede estar indexándose)",
    noSessionYet:
      "Aún no hay una sesión de subagente vinculada (agentId sin resolver o transcript aún indexándose). Abre la fila «Subagente» en el árbol de sesiones.",
    status: {
      running: "En ejecución",
      completed: "Completado",
      error: "Error",
    },
    fields: {
      output: "Informe de entrega",
    },
  },
};
