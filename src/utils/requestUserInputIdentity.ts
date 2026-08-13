import type { RequestUserInputRequest } from "../types";

/** JSON-RPC request id 只在所属 Runtime attempt 内唯一。 */
export function requestUserInputIdentityKey(
  request: RequestUserInputRequest,
): string {
  const owner = request.shared_runtime_owner;
  return JSON.stringify([
    request.workspace_id,
    owner?.providerRuntimeKey ?? "native",
    owner?.attemptId ?? "native",
    request.request_id,
  ]);
}

export function isSameRequestUserInput(
  left: RequestUserInputRequest,
  right: RequestUserInputRequest,
): boolean {
  return requestUserInputIdentityKey(left) === requestUserInputIdentityKey(right);
}

export function requestUserInputConversationItemId(
  request: RequestUserInputRequest,
): string {
  // Align with history normalizer prefix so tool_result cannot create a second
  // "已提交" card for the same ask (`request-user-input-submitted-<id>`).
  const attemptId = request.shared_runtime_owner?.attemptId;
  const requestId = String(request.request_id);
  return attemptId
    ? `request-user-input-submitted-${attemptId}-${requestId}`
    : `request-user-input-submitted-${requestId}`;
}
