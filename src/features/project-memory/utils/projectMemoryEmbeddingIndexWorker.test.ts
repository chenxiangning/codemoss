import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  __resetEmbedIndexQueueForTests,
  enqueueEmbedIndexDelete,
  enqueueEmbedIndexUpsert,
} from "./projectMemoryEmbeddingIndexWorker";

const upsertMock = vi.fn(async () => {});
const deleteMock = vi.fn(async () => {});
const listMock = vi.fn(async () => []);
const healthMock = vi.fn(async () => ({
  status: "unavailable" as const,
  reason: "model_resource_missing",
  providerId: "x",
  modelId: "y",
  embeddingVersion: "z",
  dimensions: 384,
}));

vi.mock("../../../services/tauri/projectMemoryEmbed", () => ({
  projectMemoryEmbedIndexUpsert: upsertMock,
  projectMemoryEmbedIndexDelete: deleteMock,
  projectMemoryEmbedIndexList: listMock,
  projectMemoryEmbedHealth: healthMock,
  projectMemoryEmbedText: vi.fn(async () => {
    throw new Error("unavailable");
  }),
}));

function makeMemory(): ProjectMemoryItem {
  return {
    id: "m-1",
    workspaceId: "ws-1",
    kind: "note",
    title: "t",
    summary: "s",
    cleanText: "c",
    tags: [],
    importance: "medium",
    source: "manual",
    fingerprint: "fp",
    createdAt: 1,
    updatedAt: 2,
  };
}

afterEach(() => {
  __resetEmbedIndexQueueForTests();
  upsertMock.mockClear();
  deleteMock.mockClear();
  listMock.mockClear();
  healthMock.mockClear();
});

describe("projectMemoryEmbeddingIndexWorker", () => {
  it("skips upsert when provider unavailable without throwing", async () => {
    enqueueEmbedIndexUpsert("ws-1", makeMemory());
    // drain 是 async void
    await new Promise((r) => setTimeout(r, 30));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("delete still invokes index delete when enqueued", async () => {
    enqueueEmbedIndexDelete("ws-1", "m-1");
    await new Promise((r) => setTimeout(r, 30));
    expect(deleteMock).toHaveBeenCalledWith("ws-1", ["m-1"]);
  });
});
