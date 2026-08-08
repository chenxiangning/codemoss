export default {
  subagentUi: {
    defaultName: "하위 에이전트",
    badge: "SubAgent",
    claudeLaunchNoSession:
      "Claude Agent 시작 확인을 감지했지만 아직 claude:subagent 세션과 연결되지 않았습니다(native owner가 아직 바인딩/인덱싱 중일 수 있음). 잠시 후 다시 시도하거나 왼쪽 세션 트리에서 해당 하위 에이전트를 여세요.",
    toolCount: "도구 {{count}}개",
    close: "닫기",
    resizeSplit: "하위 에이전트 패널 너비 조정",
    inspectorAria: "하위 에이전트 상세",
    loadingSession: "하위 에이전트 세션을 불러오는 중…",
    sessionLoadFailed: "하위 에이전트 세션을 불러오지 못했습니다",
    emptySession: "하위 에이전트 세션에 아직 메시지가 없습니다(인덱싱 중일 수 있음)",
    noSessionYet:
      "아직 하위 에이전트 세션과 연결되지 않았습니다(agentId 미확인 또는 transcript 인덱싱 중). 왼쪽 세션 트리에서 「하위 에이전트」 행을 열어 확인하세요.",
    status: {
      running: "실행 중",
      completed: "완료",
      error: "실패",
    },
    fields: {
      output: "결과 보고서",
    },
  },
};
