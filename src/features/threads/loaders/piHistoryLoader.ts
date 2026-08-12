import type { HistoryLoader } from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { parsePiHistoryMessages } from "./piHistoryParser";

type PiHistoryLoaderOptions = {
  workspaceId: string;
  workspacePath: string | null;
  loadPiSession: (workspacePath: string, sessionId: string) => Promise<unknown>;
};

export function createPiHistoryLoader({
  workspaceId,
  workspacePath,
  loadPiSession,
}: PiHistoryLoaderOptions): HistoryLoader {
  return {
    engine: "pi",
    async load(threadId: string) {
      const sessionId = threadId.startsWith("pi:")
        ? threadId.slice("pi:".length)
        : threadId;
      if (!workspacePath) {
        return normalizeHistorySnapshot({
          engine: "pi",
          workspaceId,
          threadId,
          meta: {
            workspaceId,
            threadId,
            engine: "pi",
            activeTurnId: null,
            isThinking: false,
            heartbeatPulse: null,
            historyRestoredAtMs: Date.now(),
          },
        });
      }

      const result = await loadPiSession(workspacePath, sessionId);
      const record = (result ?? {}) as { messages?: unknown };
      const messagesData = record.messages ?? result;
      const items = parsePiHistoryMessages(messagesData);

      return normalizeHistorySnapshot({
        engine: "pi",
        workspaceId,
        threadId,
        items,
        plan: null,
        userInputQueue: [],
        meta: {
          workspaceId,
          threadId,
          engine: "pi",
          activeTurnId: null,
          isThinking: false,
          heartbeatPulse: null,
          historyRestoredAtMs: Date.now(),
        },
      });
    },
  };
}
