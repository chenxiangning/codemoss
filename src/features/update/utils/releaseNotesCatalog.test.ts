import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { parseChangelogEntries } from "./changelogParser";
import {
  catalogToStubEntries,
  listBundledReleaseNotesEntryVersionsForTests,
  loadReleaseNotesEntry,
  loadReleaseNotesIndex,
  resetReleaseNotesCatalogCacheForTests,
} from "./releaseNotesCatalog";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../../..");

describe("releaseNotesCatalog", () => {
  beforeEach(() => {
    resetReleaseNotesCatalogCacheForTests();
  });

  it("loads a light index without embedding full entry bodies", async () => {
    const index = await loadReleaseNotesIndex();
    expect(index.entryCount).toBeGreaterThan(0);
    expect(index.entries.length).toBe(index.entryCount);
    expect(index.entries[0]?.version).toBeTruthy();
    expect(index.entries[0]).not.toHaveProperty("englishBody");
    expect(index.entries[0]).not.toHaveProperty("chineseBody");
  });

  it("loads a single version body on demand", async () => {
    const index = await loadReleaseNotesIndex();
    const version = index.entries[0]?.version;
    expect(version).toBeTruthy();
    const entry = await loadReleaseNotesEntry(version!);
    expect(entry.version).toBe(version);
    expect(
      entry.englishBody.length + entry.chineseBody.length,
    ).toBeGreaterThan(0);
  });

  it("builds empty-body stubs from the catalog for pagination", async () => {
    const index = await loadReleaseNotesIndex();
    const stubs = catalogToStubEntries(index.entries);
    expect(stubs).toHaveLength(index.entries.length);
    expect(stubs.every((entry) => entry.englishBody === "")).toBe(true);
  });

  it("stays in sync with CHANGELOG.md via generated slices", async () => {
    const markdown = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
    const parsed = parseChangelogEntries(markdown);
    const index = await loadReleaseNotesIndex();

    expect(index.entries.map((entry) => entry.version)).toEqual(
      parsed.map((entry) => entry.version),
    );

    // Spot-check latest + one older body against the parser (not the whole set).
    for (const version of [parsed[0]?.version, parsed[Math.min(5, parsed.length - 1)]?.version]) {
      if (!version) {
        continue;
      }
      const fromParser = parsed.find((entry) => entry.version === version);
      const fromCatalog = await loadReleaseNotesEntry(version);
      expect(fromCatalog.englishBody).toBe(fromParser?.englishBody);
      expect(fromCatalog.chineseBody).toBe(fromParser?.chineseBody);
    }
  });

  it("code-splits entry modules per version (import.meta.glob)", () => {
    const versions = listBundledReleaseNotesEntryVersionsForTests();
    expect(versions.length).toBeGreaterThan(1);
  });
});
