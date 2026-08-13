/**
 * 旁路异步 embedding 索引 worker（并发 1）。
 * 失败只 telemetry + log，绝不抛回采集/发送。
 */
import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  projectMemoryEmbedIndexDelete,
  projectMemoryEmbedIndexList,
  projectMemoryEmbedIndexUpsert,
  type ProjectMemoryEmbedIndexRecordDto,
} from "../../../services/tauri/projectMemoryEmbed";
import { emitMemoryPickTelemetry } from "../memoryPick/memoryPickTelemetry";
import {
  buildProjectMemoryEmbeddingContentHash,
  buildProjectMemoryEmbeddingDocument,
  buildProjectMemoryEmbeddingIndex,
  isProjectMemoryEmbeddingRecordStale,
  normalizeEmbeddingVector,
  type ProjectMemoryEmbeddingIndexRecord,
  type ProjectMemoryEmbeddingProvider,
} from "./projectMemorySemanticRetrieval";
import { createBundledProjectMemoryEmbeddingProvider } from "./projectMemoryEmbeddingProvider";

type QueueJob =
  | {
      kind: "upsert";
      workspaceId: string;
      memory: ProjectMemoryItem;
    }
  | {
      kind: "delete";
      workspaceId: string;
      memoryId: string;
    }
  | {
      kind: "rebuild";
      workspaceId: string;
      memories: ProjectMemoryItem[];
    };

const queue: QueueJob[] = [];
let draining = false;

function toDto(
  record: ProjectMemoryEmbeddingIndexRecord,
): ProjectMemoryEmbedIndexRecordDto {
  return {
    workspaceId: record.workspaceId,
    memoryId: record.memoryId,
    providerId: record.providerId,
    modelId: record.modelId,
    embeddingVersion: record.embeddingVersion,
    dimensions: record.dimensions,
    contentHash: record.contentHash,
    vector: record.vector,
    memoryUpdatedAt: record.memoryUpdatedAt,
    indexedAt: record.indexedAt,
  };
}

function fromDto(
  dto: ProjectMemoryEmbedIndexRecordDto,
): ProjectMemoryEmbeddingIndexRecord {
  return {
    workspaceId: dto.workspaceId,
    memoryId: dto.memoryId,
    providerId: dto.providerId,
    modelId: dto.modelId,
    embeddingVersion: dto.embeddingVersion,
    dimensions: dto.dimensions,
    contentHash: dto.contentHash,
    vector: dto.vector,
    memoryUpdatedAt: dto.memoryUpdatedAt,
    indexedAt: dto.indexedAt,
  };
}

async function resolveProvider(): Promise<ProjectMemoryEmbeddingProvider | null> {
  try {
    const provider = createBundledProjectMemoryEmbeddingProvider();
    const health = await provider.health();
    if (health.status !== "available") return null;
    return provider;
  } catch {
    return null;
  }
}

async function indexOneMemory(
  provider: ProjectMemoryEmbeddingProvider,
  memory: ProjectMemoryItem,
): Promise<ProjectMemoryEmbeddingIndexRecord | null> {
  if (memory.deletedAt) return null;
  const documentText = buildProjectMemoryEmbeddingDocument(memory);
  if (!documentText) return null;

  const raw = await provider.embed(documentText);
  const vector = normalizeEmbeddingVector(raw);
  if (vector.length !== provider.dimensions) return null;

  const now = Date.now();
  return {
    workspaceId: memory.workspaceId,
    memoryId: memory.id,
    providerId: provider.providerId,
    modelId: provider.modelId,
    embeddingVersion: provider.embeddingVersion,
    dimensions: provider.dimensions,
    contentHash: buildProjectMemoryEmbeddingContentHash(memory),
    vector,
    memoryUpdatedAt: memory.updatedAt,
    indexedAt: now,
  };
}

async function runUpsert(workspaceId: string, memory: ProjectMemoryItem) {
  const provider = await resolveProvider();
  if (!provider) {
    emitMemoryPickTelemetry("memory_pick_embed_index", {
      action: "skip",
      reason: "provider_unavailable",
      workspaceIdLength: workspaceId.length,
    });
    return;
  }

  // stale 检测：已是最新则跳过
  try {
    const existing = await projectMemoryEmbedIndexList(workspaceId);
    const match = existing.find((r) => r.memoryId === memory.id);
    if (
      match &&
      !isProjectMemoryEmbeddingRecordStale({
        memory,
        record: fromDto(match),
        provider,
      })
    ) {
      return;
    }
  } catch {
    // list 失败仍尝试重建该条
  }

  const record = await indexOneMemory(provider, memory);
  if (!record) {
    emitMemoryPickTelemetry("memory_pick_embed_index", {
      action: "skip",
      reason: "empty_or_dim_mismatch",
      workspaceIdLength: workspaceId.length,
    });
    return;
  }
  await projectMemoryEmbedIndexUpsert(workspaceId, [toDto(record)]);
  emitMemoryPickTelemetry("memory_pick_embed_index", {
    action: "upsert",
    workspaceIdLength: workspaceId.length,
  });
}

async function runDelete(workspaceId: string, memoryId: string) {
  await projectMemoryEmbedIndexDelete(workspaceId, [memoryId]);
  emitMemoryPickTelemetry("memory_pick_embed_index", {
    action: "delete",
    workspaceIdLength: workspaceId.length,
  });
}

async function runRebuild(
  workspaceId: string,
  memories: ProjectMemoryItem[],
) {
  const provider = await resolveProvider();
  if (!provider) return;
  const built = await buildProjectMemoryEmbeddingIndex({
    workspaceId,
    memories,
    provider,
  });
  if (built.records.length === 0) return;
  await projectMemoryEmbedIndexUpsert(
    workspaceId,
    built.records.map(toDto),
  );
  emitMemoryPickTelemetry("memory_pick_embed_index", {
    action: "rebuild",
    count: built.records.length,
    workspaceIdLength: workspaceId.length,
  });
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      try {
        if (job.kind === "upsert") {
          await runUpsert(job.workspaceId, job.memory);
        } else if (job.kind === "delete") {
          await runDelete(job.workspaceId, job.memoryId);
        } else {
          await runRebuild(job.workspaceId, job.memories);
        }
      } catch (error) {
        emitMemoryPickTelemetry("memory_pick_embed_index", {
          action: "error",
          reason:
            error instanceof Error
              ? error.message.slice(0, 80)
              : "embed_index_error",
        });
        // 绝不 rethrow
      }
    }
  } finally {
    draining = false;
    if (queue.length > 0) {
      void drain();
    }
  }
}

function enqueue(job: QueueJob) {
  queue.push(job);
  void drain();
}

/** create / update / complete 成功后调用 */
export function enqueueEmbedIndexUpsert(
  workspaceId: string,
  memory: ProjectMemoryItem,
): void {
  if (!workspaceId || !memory?.id) return;
  enqueue({ kind: "upsert", workspaceId, memory });
}

/** delete 成功后同步删向量行 */
export function enqueueEmbedIndexDelete(
  workspaceId: string,
  memoryId: string,
): void {
  if (!workspaceId || !memoryId) return;
  enqueue({ kind: "delete", workspaceId, memoryId });
}

/** version 变更后 idle 全量 rebuild */
export function enqueueEmbedIndexRebuild(
  workspaceId: string,
  memories: ProjectMemoryItem[],
): void {
  if (!workspaceId) return;
  enqueue({ kind: "rebuild", workspaceId, memories });
}

/** 加载磁盘 index 为语义检索 records */
export async function loadPersistedEmbeddingIndex(
  workspaceId: string,
): Promise<ProjectMemoryEmbeddingIndexRecord[]> {
  try {
    const dtos = await projectMemoryEmbedIndexList(workspaceId);
    return dtos.map(fromDto);
  } catch {
    return [];
  }
}

export function __resetEmbedIndexQueueForTests() {
  queue.length = 0;
  draining = false;
}
