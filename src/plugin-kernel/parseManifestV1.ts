import {
  ACTIVATION_EVENT_TYPES,
  ENTRY_ID_RE,
  ENTRY_KINDS,
  MANIFEST_VERSION,
  MOSSX_CAPABILITIES,
  PLATFORM_IDS,
  PLUGIN_ID_RE,
  SEMVER_RE,
  TEMPLATE_ELIGIBLE_TYPES,
} from "./catalog";
import type {
  ManifestActivationEvent,
  ManifestActivationUnit,
  ManifestCapability,
  ManifestContribution,
  ManifestDependsOn,
  ManifestEntry,
  ManifestError,
  ManifestErrorCode,
  ManifestTemplate,
  ParseManifestOptions,
  ParseManifestResult,
  ValidatedManifest,
} from "./types";

const KNOWN_TOP_LEVEL = new Set([
  "manifestVersion",
  "pluginId",
  "version",
  "displayName",
  "description",
  "publisher",
  "repository",
  "license",
  "channel",
  "compatibility",
  "entries",
  "activationUnits",
  "contributions",
  "contributionTemplates",
  "capabilities",
  "storage",
  "budgets",
  "extensions",
]);

const KNOWN_ENTRY_FIELDS = new Set([
  "id",
  "kind",
  "criticality",
  "dependsOn",
  "path",
  "runtime",
  "export",
  "platforms",
  "argv",
  "cwd",
  "stdio",
  "mode",
  "slot",
  "trustedReact",
  "fromSchema",
  "toSchema",
  "destructive",
  "exportRequired",
  "budgets",
]);

function err(code: ManifestErrorCode, jsonPath: string, message: string): ManifestError {
  return { code, path: jsonPath, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownFields(value: Record<string, unknown>, allowed: Set<string>, jsonPath: string): ManifestError[] {
  return Object.keys(value)
    .filter((key) => !allowed.has(key) && key !== "extensions")
    .map((key) => err("unknown-field", `${jsonPath}.${key}`, `unknown field ${key}`));
}

function parseSemverRange(range: unknown, jsonPath: string): ManifestError[] {
  if (typeof range !== "string" || !range.trim()) {
    return [err("unbounded-core-api", jsonPath, "coreApi must be a string range")];
  }
  if (range.includes("*") || range.trim() === "") {
    return [err("unbounded-core-api", jsonPath, "wildcard ranges are forbidden")];
  }
  const hasUpper = /<(?:=)?\s*\d/.test(range);
  if (!hasUpper) {
    return [err("unbounded-core-api", jsonPath, "coreApi must have an upper bound")];
  }
  return [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseDependsOn(raw: unknown, jsonPath: string, errors: ManifestError[]): ManifestDependsOn[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(err("schema", jsonPath, "dependsOn must be an array"));
    return [];
  }
  return raw.flatMap((item, index) => {
    if (!isPlainObject(item) || typeof item.entryId !== "string") {
      errors.push(err("schema", `${jsonPath}[${index}]`, "dependsOn item requires entryId"));
      return [];
    }
    const extra = unknownFields(item, new Set(["entryId", "criticality"]), `${jsonPath}[${index}]`);
    errors.push(...extra);
    return [
      {
        entryId: item.entryId,
        criticality: item.criticality === "optional" ? "optional" : "required",
      },
    ];
  });
}

function parseEntries(raw: unknown, errors: ManifestError[]): ManifestEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(err("schema", "/entries", "entries must be a non-empty array"));
    return [];
  }
  const entries: ManifestEntry[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const jsonPath = `/entries/${index}`;
    if (!isPlainObject(item)) {
      errors.push(err("schema", jsonPath, "entry must be an object"));
      return;
    }
    errors.push(...unknownFields(item, KNOWN_ENTRY_FIELDS, jsonPath));
    const id = asString(item.id);
    const kind = asString(item.kind);
    if (!id || !ENTRY_ID_RE.test(id)) {
      errors.push(err("schema", `${jsonPath}/id`, "invalid entry id"));
      return;
    }
    if (seen.has(id)) {
      errors.push(err("schema", `${jsonPath}/id`, `duplicate entry id ${id}`));
      return;
    }
    seen.add(id);
    if (!kind || !(ENTRY_KINDS as readonly string[]).includes(kind)) {
      errors.push(err("unknown-kind", `${jsonPath}/kind`, `unknown kind ${String(kind)}`));
      return;
    }
    const entry: ManifestEntry = {
      id,
      kind: kind as ManifestEntry["kind"],
      criticality: item.criticality === "optional" ? "optional" : "required",
      dependsOn: parseDependsOn(item.dependsOn, `${jsonPath}/dependsOn`, errors),
    };
    if (typeof item.path === "string") {
      if (item.path.startsWith("/") || item.path.includes("..")) {
        errors.push(err("schema", `${jsonPath}/path`, "path must be artifact-relative"));
      }
      entry.path = item.path;
    }
    if (kind === "worker") {
      entry.runtime = "quickjs";
      if (!entry.path?.endsWith(".js")) {
        errors.push(err("schema", `${jsonPath}/path`, "worker path must end with .js"));
      }
    }
    if (kind === "process") {
      if (!isPlainObject(item.platforms)) {
        errors.push(err("schema", `${jsonPath}/platforms`, "process entry requires platforms"));
      } else {
        entry.platforms = {};
        for (const [platform, platformPath] of Object.entries(item.platforms)) {
          if (!(PLATFORM_IDS as readonly string[]).includes(platform)) {
            errors.push(err("schema", `${jsonPath}/platforms/${platform}`, "unknown platform"));
            continue;
          }
          if (typeof platformPath !== "string") continue;
          entry.platforms[platform as keyof NonNullable<ManifestEntry["platforms"]>] = platformPath;
        }
      }
    }
    if (kind === "ui") {
      const mode = asString(item.mode);
      if (mode !== "declarative" && mode !== "sandbox" && mode !== "trusted-react") {
        errors.push(err("schema", `${jsonPath}/mode`, "invalid ui mode"));
      } else {
        entry.mode = mode;
      }
      entry.slot = asString(item.slot);
      entry.trustedReact = item.trustedReact === true;
    }
    if (kind === "migration") {
      if (typeof item.fromSchema !== "number" || typeof item.toSchema !== "number") {
        errors.push(err("invalid-storage", jsonPath, "migration requires fromSchema/toSchema"));
      } else {
        entry.fromSchema = item.fromSchema;
        entry.toSchema = item.toSchema;
        entry.destructive = item.destructive === true;
      }
    }
    entries.push(entry);
  });
  return entries;
}

function detectCycles(entries: ManifestEntry[], errors: ManifestError[]): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, stack: string[]) => {
    if (visited.has(id) || !byId.has(id)) return;
    if (visiting.has(id)) {
      errors.push(err("cyclic-depends-on", "/entries", `cycle: ${[...stack, id].join(" -> ")}`));
      return;
    }
    visiting.add(id);
    for (const edge of byId.get(id)?.dependsOn ?? []) {
      visit(edge.entryId, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of entries) visit(entry.id, []);
}

function requiredClosure(
  entryIds: string[],
  byId: Map<string, ManifestEntry>,
  errors: ManifestError[],
  unitPath: string,
): string[] {
  const collected = new Set<string>();
  const visit = (id: string) => {
    if (collected.has(id)) return;
    const entry = byId.get(id);
    if (!entry) {
      errors.push(err("dangling-entry-id", unitPath, `missing entry ${id}`));
      return;
    }
    collected.add(id);
    for (const edge of entry.dependsOn) {
      if (edge.criticality === "required") visit(edge.entryId);
    }
  };
  for (const id of entryIds) visit(id);
  return [...collected];
}

function parseActivationUnits(
  raw: unknown,
  entries: ManifestEntry[],
  options: ParseManifestOptions,
  pluginId: string,
  errors: ManifestError[],
): { units: ManifestActivationUnit[]; closures: Record<string, string[]> } {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push(err("schema", "/activationUnits", "activationUnits must be a non-empty array"));
    return { units: [], closures: {} };
  }
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const units: ManifestActivationUnit[] = [];
  const closures: Record<string, string[]> = {};
  raw.forEach((item, index) => {
    const jsonPath = `/activationUnits/${index}`;
    if (!isPlainObject(item)) {
      errors.push(err("schema", jsonPath, "activation unit must be an object"));
      return;
    }
    const id = asString(item.id);
    if (!id || !ENTRY_ID_RE.test(id)) {
      errors.push(err("schema", `${jsonPath}/id`, "invalid activation unit id"));
      return;
    }
    if (!Array.isArray(item.entries) || item.entries.length === 0) {
      errors.push(err("schema", `${jsonPath}/entries`, "unit entries required"));
      return;
    }
    const entryIds = item.entries.filter((value): value is string => typeof value === "string");
    for (const entryId of entryIds) {
      const entry = byId.get(entryId);
      if (!entry) {
        errors.push(err("dangling-entry-id", `${jsonPath}/entries`, `missing ${entryId}`));
      } else if (entry.kind === "migration") {
        errors.push(err("migration-in-unit", `${jsonPath}/entries`, "migration cannot join a unit"));
      }
    }
    const events: ManifestActivationEvent[] = [];
    if (!Array.isArray(item.events)) {
      errors.push(err("schema", `${jsonPath}/events`, "events required"));
    } else {
      item.events.forEach((event, eventIndex) => {
        if (!isPlainObject(event) || typeof event.type !== "string") {
          errors.push(err("schema", `${jsonPath}/events/${eventIndex}`, "event requires type"));
          return;
        }
        if (!(ACTIVATION_EVENT_TYPES as readonly string[]).includes(event.type)) {
          errors.push(err("unknown-event", `${jsonPath}/events/${eventIndex}/type`, `unknown event ${event.type}`));
          return;
        }
        if (event.type === "onStartup") {
          const allowed =
            options.trustTier === "system" && options.startupAllowlist.includes(pluginId);
          if (!allowed) {
            errors.push(
              err(
                "on-startup-not-allowlisted",
                `${jsonPath}/events/${eventIndex}`,
                "onStartup is limited to allowlisted system plugins",
              ),
            );
          }
        }
        events.push({
          type: event.type as ManifestActivationEvent["type"],
          viewId: asString(event.viewId),
          commandId: asString(event.commandId),
          engineId: asString(event.engineId),
          pageId: asString(event.pageId),
          reason: event.reason === "grant" ? "grant" : event.reason === "open" ? "open" : undefined,
        });
      });
    }
    const unit = { id, entries: entryIds, events };
    units.push(unit);
    closures[id] = requiredClosure(entryIds, byId, errors, `${jsonPath}/entries`);
  });
  return { units, closures };
}

function parseContributions(
  raw: unknown,
  byId: Map<string, ManifestEntry>,
  options: ParseManifestOptions,
  errors: ManifestError[],
): ManifestContribution[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(err("schema", "/contributions", "contributions must be an array"));
    return [];
  }
  return raw.flatMap((item, index) => {
    const jsonPath = `/contributions/${index}`;
    if (!isPlainObject(item) || typeof item.id !== "string" || typeof item.type !== "string" || typeof item.entryId !== "string") {
      errors.push(err("schema", jsonPath, "contribution requires id, type, entryId"));
      return [];
    }
    if (!byId.has(item.entryId)) {
      errors.push(err("dangling-entry-id", `${jsonPath}/entryId`, `missing ${item.entryId}`));
    }
    const entry = byId.get(item.entryId);
    if (entry?.kind === "ui" && entry.mode === "trusted-react" && options.trustTier !== "system") {
      errors.push(err("trusted-react-not-system", jsonPath, "trusted-react requires system trust"));
    }
    return [
      {
        id: item.id,
        type: item.type,
        entryId: item.entryId,
        slot: asString(item.slot),
        mode: entry?.mode,
        commandId: asString(item.commandId),
        engineId: asString(item.engineId),
      },
    ];
  });
}

function parseTemplates(
  raw: unknown,
  pluginId: string,
  byId: Map<string, ManifestEntry>,
  errors: ManifestError[],
): ManifestTemplate[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(err("schema", "/contributionTemplates", "templates must be an array"));
    return [];
  }
  const templates: ManifestTemplate[] = [];
  raw.forEach((item, index) => {
    const jsonPath = `/contributionTemplates/${index}`;
    if (!isPlainObject(item)) {
      errors.push(err("schema", jsonPath, "template must be an object"));
      return;
    }
    if (!(TEMPLATE_ELIGIBLE_TYPES as readonly string[]).includes(String(item.type))) {
      errors.push(err("template-type-forbidden", `${jsonPath}/type`, `type ${String(item.type)} cannot be a template`));
      return;
    }
    const keyPrefix = item.keyPrefix;
    if (typeof keyPrefix !== "string" || !keyPrefix.startsWith(`${pluginId}.`)) {
      errors.push(err("template-key-prefix", `${jsonPath}/keyPrefix`, "keyPrefix must start with pluginId"));
      return;
    }
    if (!Array.isArray(item.scopes) || item.scopes.length === 0) {
      errors.push(err("schema", `${jsonPath}/scopes`, "scopes required"));
      return;
    }
    const maxInstances = item.maxInstances;
    if (typeof maxInstances !== "number" || maxInstances < 1 || maxInstances > 256) {
      errors.push(err("schema", `${jsonPath}/maxInstances`, "maxInstances must be 1-256"));
      return;
    }
    if (typeof item.entryId !== "string" || !byId.has(item.entryId)) {
      errors.push(err("dangling-entry-id", `${jsonPath}/entryId`, "template entryId missing"));
      return;
    }
    if (templates.some((existing) => keyPrefix.startsWith(existing.keyPrefix) || existing.keyPrefix.startsWith(keyPrefix))) {
      errors.push(err("template-overlap", jsonPath, "template keyPrefix overlaps another template"));
      return;
    }
    templates.push({
      id: String(item.id ?? `template-${index}`),
      type: String(item.type),
      entryId: item.entryId,
      keyPrefix,
      scopes: item.scopes.map(String),
      maxInstances,
    });
  });
  return templates;
}

function parseCapabilities(
  raw: unknown,
  pluginId: string,
  errors: ManifestError[],
): ManifestCapability[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(err("schema", "/capabilities", "capabilities must be an array"));
    return [];
  }
  return raw.flatMap((item, index) => {
    const jsonPath = `/capabilities/${index}`;
    if (!isPlainObject(item) || typeof item.id !== "string") {
      errors.push(err("schema", jsonPath, "capability requires id"));
      return [];
    }
    if (item.id.startsWith("mossx.")) {
      if (!(MOSSX_CAPABILITIES as readonly string[]).includes(item.id)) {
        errors.push(err("unknown-capability", `${jsonPath}/id`, `unknown ${item.id}`));
        return [];
      }
    } else if (!item.id.startsWith(`${pluginId}.`)) {
      errors.push(err("foreign-private-capability", `${jsonPath}/id`, "private capability must stay under pluginId"));
      return [];
    }
    return [
      {
        id: item.id,
        role: item.role === "provider" ? "provider" : "consumer",
        scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : undefined,
      },
    ];
  });
}

export function parseManifestV1(input: unknown, options: ParseManifestOptions): ParseManifestResult {
  const errors: ManifestError[] = [];
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return { ok: false, errors: [err("invalid-json", "/", "manifest is not valid JSON")] };
    }
  }
  if (!isPlainObject(value)) {
    return { ok: false, errors: [err("schema", "/", "manifest must be an object")] };
  }
  errors.push(...unknownFields(value, KNOWN_TOP_LEVEL, ""));
  if (value.manifestVersion !== MANIFEST_VERSION) {
    errors.push(err("unsupported-manifest-version", "/manifestVersion", "only manifestVersion 1 is accepted"));
  }
  const pluginId = asString(value.pluginId);
  if (!pluginId || !PLUGIN_ID_RE.test(pluginId)) {
    errors.push(err("invalid-plugin-id", "/pluginId", "pluginId must be Reverse-DNS"));
  }
  const version = asString(value.version);
  if (!version || !SEMVER_RE.test(version)) {
    errors.push(err("invalid-semver", "/version", "version must be SemVer"));
  }
  const channel = value.channel === undefined ? "stable" : value.channel;
  if (channel !== "stable" && channel !== "beta") {
    errors.push(err("invalid-channel", "/channel", "channel must be stable or beta"));
  }
  if (channel === "stable" && version?.includes("-beta.")) {
    errors.push(err("invalid-channel", "/version", "stable channel rejects pre-release"));
  }
  if (!isPlainObject(value.compatibility)) {
    errors.push(err("unbounded-core-api", "/compatibility", "compatibility.coreApi required"));
  } else {
    errors.push(...parseSemverRange(value.compatibility.coreApi, "/compatibility/coreApi"));
  }
  if (options.artifactHash && options.knownHashes && pluginId && version) {
    const key = `${pluginId}@${version}`;
    const previous = options.knownHashes[key];
    if (previous && previous !== options.artifactHash) {
      errors.push(err("hash-conflict", "/version", "pluginId+version already bound to another hash"));
    }
  }

  const entries = parseEntries(value.entries, errors);
  detectCycles(entries, errors);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    for (const edge of entry.dependsOn) {
      if (!byId.has(edge.entryId)) {
        errors.push(err("dangling-entry-id", `/entries/${entry.id}/dependsOn`, `missing ${edge.entryId}`));
      }
    }
    if (entry.kind === "process" && entry.criticality === "required") {
      const platformPath = entry.platforms?.[options.currentPlatform];
      if (!platformPath) {
        errors.push(err("missing-platform", `/entries/${entry.id}/platforms`, `missing ${options.currentPlatform}`));
      }
    }
    if (entry.kind === "ui" && entry.mode === "trusted-react" && options.trustTier !== "system") {
      errors.push(err("trusted-react-not-system", `/entries/${entry.id}`, "trusted-react requires system"));
    }
  }

  const pluginIdentity = pluginId ?? "";
  const { units, closures } = parseActivationUnits(
    value.activationUnits,
    entries,
    options,
    pluginIdentity,
    errors,
  );
  const contributions = parseContributions(value.contributions, byId, options, errors);
  const templates = parseTemplates(value.contributionTemplates, pluginIdentity, byId, errors);
  const capabilities = parseCapabilities(value.capabilities, pluginIdentity, errors);

  if (isPlainObject(value.budgets) && value.budgets.activationDeadlineMs !== undefined) {
    const deadline = value.budgets.activationDeadlineMs;
    if (typeof deadline !== "number" || deadline < 1000 || deadline > 30000) {
      errors.push(err("invalid-budget", "/budgets/activationDeadlineMs", "deadline must be 1000-30000"));
    }
  }
  if (isPlainObject(value.storage)) {
    const schemaVersion = value.storage.schemaVersion;
    if (typeof schemaVersion !== "number" || schemaVersion < 1) {
      errors.push(err("invalid-storage", "/storage/schemaVersion", "schemaVersion must be a positive integer"));
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const manifest: ValidatedManifest = {
    pluginId: pluginIdentity,
    version: version ?? "",
    manifestVersion: 1,
    channel: channel === "beta" ? "beta" : "stable",
    displayName: asString(value.displayName),
    entries,
    activationUnits: units,
    contributions,
    contributionTemplates: templates,
    capabilities,
    requiredClosureByUnit: closures,
  };
  return { ok: true, manifest, errors: [] };
}
