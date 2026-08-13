/**
 * Lazy release-notes catalog: light index + per-version entry chunks.
 * Cold open only downloads the preferred version body, never the full CHANGELOG.
 */
import type {
  ReleaseNotesCatalogItem,
  ReleaseNotesEntry,
} from "./changelogParser";
import { releaseNotesEntryFileStem } from "./changelogParser";

export type ReleaseNotesIndex = {
  generatedAt: string;
  source: string;
  sourceSha256: string;
  entryCount: number;
  entries: Array<
    ReleaseNotesCatalogItem & {
      file: string;
    }
  >;
};

/** Vite code-splits each JSON into its own chunk when dynamically imported. */
const entryLoaders = import.meta.glob<{ default: ReleaseNotesEntry }>(
  "../generated/entries/*.json",
);

let indexPromise: Promise<ReleaseNotesIndex> | null = null;
const entryPromiseByVersion = new Map<string, Promise<ReleaseNotesEntry>>();

function resolveEntryLoader(
  version: string,
): (() => Promise<{ default: ReleaseNotesEntry }>) | null {
  const stem = releaseNotesEntryFileStem(version);
  const exactKey = `../generated/entries/${stem}.json`;
  if (entryLoaders[exactKey]) {
    return entryLoaders[exactKey];
  }

  // Defensive: match by basename if Vite normalizes the glob key differently.
  const suffix = `/entries/${stem}.json`;
  const matchedKey = Object.keys(entryLoaders).find((key) =>
    key.endsWith(suffix),
  );
  return matchedKey ? entryLoaders[matchedKey] : null;
}

export async function loadReleaseNotesIndex(
  forceRefresh = false,
): Promise<ReleaseNotesIndex> {
  if (forceRefresh) {
    indexPromise = null;
  }
  if (!indexPromise) {
    indexPromise = import("../generated/index.json").then((module) => {
      const index = (module.default ?? module) as ReleaseNotesIndex;
      if (!index?.entries?.length) {
        throw new Error("Release notes index is empty. Run npm run release-notes:generate.");
      }
      return index;
    });
  }
  return indexPromise;
}

export async function loadReleaseNotesEntry(
  version: string,
  forceRefresh = false,
): Promise<ReleaseNotesEntry> {
  const stem = releaseNotesEntryFileStem(version);
  if (forceRefresh) {
    entryPromiseByVersion.delete(stem);
  }

  const cached = entryPromiseByVersion.get(stem);
  if (cached) {
    return cached;
  }

  const loader = resolveEntryLoader(stem);
  if (!loader) {
    const promise = Promise.reject(
      new Error(
        `Release notes entry not found for version ${version}. Run npm run release-notes:generate.`,
      ),
    ) as Promise<ReleaseNotesEntry>;
    // Do not cache rejections forever — allow retry after generate.
    void promise.catch(() => {
      entryPromiseByVersion.delete(stem);
    });
    entryPromiseByVersion.set(stem, promise);
    return promise;
  }

  const promise = loader().then((module) => {
    const entry = module.default;
    if (!entry?.version) {
      throw new Error(`Invalid release notes entry for version ${version}.`);
    }
    return entry;
  });
  entryPromiseByVersion.set(stem, promise);
  return promise;
}

export function catalogToStubEntries(
  catalog: readonly ReleaseNotesCatalogItem[],
): ReleaseNotesEntry[] {
  return catalog.map((item) => ({
    ...item,
    englishBody: "",
    chineseBody: "",
  }));
}

/** Test-only: clear in-memory load caches. */
export function resetReleaseNotesCatalogCacheForTests(): void {
  indexPromise = null;
  entryPromiseByVersion.clear();
}

export function listBundledReleaseNotesEntryVersionsForTests(): string[] {
  return Object.keys(entryLoaders)
    .map((key) => {
      const match = key.match(/\/entries\/([^/]+)\.json$/);
      return match?.[1] ?? null;
    })
    .filter((value): value is string => Boolean(value))
    .sort();
}
