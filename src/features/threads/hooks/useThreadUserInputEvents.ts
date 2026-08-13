import { useCallback } from "react";
import type { Dispatch } from "react";
import type { RequestUserInputRequest } from "../../../types";
import { requestUserInputIdentityKey } from "../../../utils/requestUserInputIdentity";
import {
  isUserInputRequestSettled,
  markUserInputRequestSettled,
} from "../../../utils/userInputSettlementTombstone";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  resolveClaudeContinuationThreadId?: (
    workspaceId: string,
    threadId: string,
    turnId?: string | null,
  ) => string | null;
};

export function useThreadUserInputEvents({
  dispatch,
  resolveClaudeContinuationThreadId,
}: UseThreadUserInputEventsOptions) {
  return useCallback(
    (request: RequestUserInputRequest) => {
      const requestKey = requestUserInputIdentityKey(request);
      if (request.params.completed === true) {
        markUserInputRequestSettled(requestKey);
        dispatch({
          type: "removeUserInputRequest",
          requestId: request.request_id,
          workspaceId: request.workspace_id,
          request,
        });
        return;
      }
      // Suppress late / replayed non-completed events after local or runtime settlement.
      if (isUserInputRequestSettled(requestKey)) {
        return;
      }
      const canonicalThreadId =
        request.shared_runtime_owner?.sharedThreadId ??
        resolveClaudeContinuationThreadId?.(
          request.workspace_id,
          request.params.thread_id,
          request.params.turn_id,
        ) ??
        request.params.thread_id;
      const normalizedRequest =
        canonicalThreadId !== request.params.thread_id
          ? {
              ...request,
              params: {
                ...request.params,
                thread_id: canonicalThreadId,
              },
            }
          : request;
      dispatch({ type: "addUserInputRequest", request: normalizedRequest });
    },
    [dispatch, resolveClaudeContinuationThreadId],
  );
}
