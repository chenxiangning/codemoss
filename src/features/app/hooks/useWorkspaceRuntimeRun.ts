import { useRuntimeLogSession } from "@mossx/plugin-runtime-log/runtime";
import type {
  RuntimeConsoleStatus,
  RuntimeLogSessionState,
} from "@mossx/plugin-runtime-log/runtime";
import type { WorkspaceInfo } from "../../../types";

type UseWorkspaceRuntimeRunOptions = {
  activeWorkspace: WorkspaceInfo | null;
};

export type { RuntimeConsoleStatus };

export type WorkspaceRuntimeRunState = RuntimeLogSessionState;

export function useWorkspaceRuntimeRun({
  activeWorkspace,
}: UseWorkspaceRuntimeRunOptions): WorkspaceRuntimeRunState {
  return useRuntimeLogSession({ activeWorkspace });
}
