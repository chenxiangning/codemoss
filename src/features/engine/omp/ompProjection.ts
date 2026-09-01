export type OmpRawEvent = Readonly<{
  type?: string;
  method?: string;
  id?: string | number;
  text?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}>;

export type OmpConversationProjection = Readonly<{
  kind: "conversation";
  event: "textDelta" | "reasoningDelta" | "toolStarted" | "toolCompleted" | "terminal";
  payload: OmpRawEvent;
}>;

export type OmpControlProjection = Readonly<{
  kind: "control";
  event: "ready" | "response" | "commands" | "extensionUi" | "job" | "other";
  payload: OmpRawEvent;
}>;

export type OmpProjection = OmpConversationProjection | OmpControlProjection;

const CONTROL_TYPES: Record<string, OmpControlProjection["event"]> = {
  ready: "ready",
  response: "response",
  available_commands_update: "commands",
  extension_ui_request: "extensionUi",
  job_started: "job",
  job_updated: "job",
  job_completed: "job",
};

export function projectOmpEvent(rawEvent: OmpRawEvent): OmpProjection {
  const rawType = typeof rawEvent.type === "string" ? rawEvent.type : undefined;
  const controlEvent =
    rawType && Object.prototype.hasOwnProperty.call(CONTROL_TYPES, rawType)
      ? CONTROL_TYPES[rawType]
      : undefined;
  if (controlEvent) {
    return { kind: "control", event: controlEvent, payload: rawEvent };
  }

  const updateType = rawEvent.params?.update as Record<string, unknown> | undefined;
  const sessionUpdate = updateType?.sessionUpdate;
  if (rawEvent.method === "session/finished" || rawEvent.method === "session/update") {
    if (sessionUpdate === "agent_message_chunk") {
      return { kind: "conversation", event: "textDelta", payload: rawEvent };
    }
    if (sessionUpdate === "agent_thought_chunk") {
      return { kind: "conversation", event: "reasoningDelta", payload: rawEvent };
    }
    if (sessionUpdate === "tool_call") {
      return { kind: "conversation", event: "toolStarted", payload: rawEvent };
    }
    if (sessionUpdate === "tool_result" || sessionUpdate === "tool_call_update") {
      return { kind: "conversation", event: "toolCompleted", payload: rawEvent };
    }
    if (sessionUpdate === "turn_complete" || sessionUpdate === "session_finished") {
      return { kind: "conversation", event: "terminal", payload: rawEvent };
    }
    if (rawEvent.method === "session/finished") {
      return { kind: "conversation", event: "terminal", payload: rawEvent };
    }
  }

  return { kind: "control", event: "other", payload: rawEvent };
}

export function projectOmpEvents(rawEvents: readonly OmpRawEvent[]): OmpProjection[] {
  return rawEvents.map(projectOmpEvent);
}
