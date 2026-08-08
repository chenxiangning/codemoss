export default {
  subagentUi: {
    defaultName: "Sous-agent",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Accusé de lancement du Claude Agent détecté, mais aucune session claude:subagent n'est encore associée (le native owner est peut-être encore en cours de liaison/indexation). Réessayez plus tard ou ouvrez le sous-agent depuis l'arborescence des sessions.",
    toolCount: "{{count}} outils",
    close: "Fermer",
    resizeSplit: "Ajuster la largeur du panneau des sous-agents",
    inspectorAria: "Détails du sous-agent",
    loadingSession: "Chargement de la session du sous-agent…",
    sessionLoadFailed: "Échec du chargement de la session du sous-agent",
    emptySession: "La session du sous-agent ne contient pas encore de messages (indexation possible en cours)",
    noSessionYet:
      "Aucune session de sous-agent associée pour le moment (agentId non résolu ou transcript encore en indexation). Ouvrez la ligne « Sous-agent » dans l'arborescence des sessions.",
    status: {
      running: "En cours",
      completed: "Terminé",
      error: "Échec",
    },
    fields: {
      output: "Rapport de livraison",
    },
  },
};
