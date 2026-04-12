type CollabAgentStatusRecord = Record<string, { status?: string }>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toStringList(entry));
  }
  if (typeof value !== "string") {
    return [];
  }
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }
  if (normalized.includes(",")) {
    return normalized
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [normalized];
}

function uniqueStringList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function extractThreadIdsFromRecord(record: Record<string, unknown>) {
  const ids = [
    ...toStringList(
      record.receiverThreadIds ??
        record.receiver_thread_ids ??
        record.newThreadIds ??
        record.new_thread_ids ??
        record.threadIds ??
        record.thread_ids ??
        record.agentIds ??
        record.agent_ids ??
        record.ids,
    ),
    ...toStringList(
      record.receiverThreadId ??
        record.receiver_thread_id ??
        record.newThreadId ??
        record.new_thread_id ??
        record.threadId ??
        record.thread_id ??
        record.agentId ??
        record.agent_id ??
        record.id,
    ),
  ];
  return uniqueStringList(ids);
}

function extractRawStatus(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  const record = asRecord(value);
  if (!record) {
    return "";
  }
  return asString(record.status ?? record.state);
}

function upsertAgentStatus(
  target: CollabAgentStatusRecord,
  ids: string[],
  rawStatus: string,
) {
  const normalizedStatus = rawStatus.trim();
  if (!normalizedStatus) {
    return;
  }
  uniqueStringList(ids).forEach((id) => {
    target[id] = { status: normalizedStatus };
  });
}

const NESTED_STATUS_KEYS = new Set(["statuses", "results", "agent", "agents"]);
const AGENT_STATUS_METADATA_KEYS = new Set([
  "status",
  "state",
  "id",
  "ids",
  "threadid",
  "threadids",
  "thread_id",
  "thread_ids",
  "agentid",
  "agentids",
  "agent_id",
  "agent_ids",
  "receiverthreadid",
  "receiverthreadids",
  "receiver_thread_id",
  "receiver_thread_ids",
  "newthreadid",
  "newthreadids",
  "new_thread_id",
  "new_thread_ids",
]);

export function normalizeCollabAgentStatusMap(
  value: unknown,
): CollabAgentStatusRecord | undefined {
  const result: CollabAgentStatusRecord = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const record = asRecord(entry);
      const rawStatus = extractRawStatus(entry);
      if (!record || !rawStatus) {
        return;
      }
      upsertAgentStatus(result, extractThreadIdsFromRecord(record), rawStatus);
    });
    return Object.keys(result).length > 0 ? result : undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const directStatus = extractRawStatus(record);
  if (directStatus) {
    const directIds = extractThreadIdsFromRecord(record);
    upsertAgentStatus(result, directIds, directStatus);
    if (directIds.length > 0) {
      return Object.keys(result).length > 0 ? result : undefined;
    }
  }

  Object.entries(record).forEach(([candidateId, entry]) => {
    const normalizedId = candidateId.trim();
    if (
      !normalizedId ||
      NESTED_STATUS_KEYS.has(normalizedId) ||
      AGENT_STATUS_METADATA_KEYS.has(normalizedId.toLowerCase())
    ) {
      return;
    }
    const rawStatus = extractRawStatus(entry);
    if (!rawStatus) {
      return;
    }
    const entryRecord = asRecord(entry);
    const explicitIds = entryRecord ? extractThreadIdsFromRecord(entryRecord) : [];
    upsertAgentStatus(
      result,
      explicitIds.length > 0 ? explicitIds : [normalizedId],
      rawStatus,
    );
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

export function formatCollabAgentStates(value: unknown) {
  const normalizedStatuses = normalizeCollabAgentStatusMap(value);
  if (!normalizedStatuses) {
    return "";
  }
  const entries = Object.entries(normalizedStatuses)
    .map(([id, state]) => {
      const status = asString(state.status ?? "");
      return status ? `${id}: ${status}` : id;
    })
    .filter(Boolean);
  if (entries.length === 0) {
    return "";
  }
  return entries.join("\n");
}

export function parseCollabFallbackLink(
  detail: string,
  fallbackParentId: string,
) {
  const trimmed = detail.trim();
  if (!trimmed) {
    return null;
  }
  const hasUnicodeArrow = trimmed.includes("→");
  const hasAsciiArrow = !hasUnicodeArrow && trimmed.includes("->");
  if (!hasUnicodeArrow && !hasAsciiArrow) {
    return null;
  }
  const [leftSideRaw, rightSideRaw] = hasUnicodeArrow
    ? trimmed.split("→", 2)
    : trimmed.split("->", 2);
  const leftSide = (leftSideRaw ?? "").trim();
  const rightSide = (rightSideRaw ?? "").trim();
  const parentMatch = leftSide.match(/^From\s+(.+)$/i);
  const parentId = (parentMatch?.[1]?.trim() || fallbackParentId).trim();
  const receivers = rightSide
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!parentId || receivers.length === 0) {
    return null;
  }
  return { parentId, receivers };
}
