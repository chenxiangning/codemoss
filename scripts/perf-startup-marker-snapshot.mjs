#!/usr/bin/env node

/**
 * P2-4 cold-start markers pipeline.
 *
 * Reads a source snapshot (window.__CCGUI_STARTUP_PERF__ dump or renderer
 * diagnostics log) and writes a normalized startup-markers artifact.
 *
 * Default output: `.artifacts/perf/cold-start-YYYYMMDD/startup-markers.json`
 * (date overridable with --date=YYYYMMDD).
 *
 * When markers are missing, exits 0 with an explicit unsupported payload unless
 * --strict is passed (then non-zero). This satisfies the cold-start todolist
 * rule: firstPaint/firstInteractive must not stay silently null forever —
 * either populated or formally unsupported + follow-up.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_INPUT_PATH = ".artifacts/startup-marker-source.json";

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1] ?? null;
  }
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function todayStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStartupMarkerShape(value) {
  return isRecord(value)
    && value.source === "startup-perf-markers"
    && Array.isArray(value.markers);
}

function collectEntries(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (!isRecord(input)) {
    return [];
  }
  for (const key of ["entries", "diagnostics", "rendererDiagnostics", "rendererLifecycleLog"]) {
    if (Array.isArray(input[key])) {
      return input[key];
    }
  }
  if (isRecord(input.app) && Array.isArray(input.app.diagnostics?.rendererLifecycleLog)) {
    return input.app.diagnostics.rendererLifecycleLog;
  }
  return [];
}

function normalizeSnapshot(snapshot) {
  if (!hasStartupMarkerShape(snapshot)) {
    return null;
  }
  const markers = snapshot.markers
    .filter((marker) => isRecord(marker))
    .map((marker) => ({
      name: marker.name,
      atMs: typeof marker.atMs === "number" && Number.isFinite(marker.atMs)
        ? Number(marker.atMs.toFixed(2))
        : null,
    }))
    .filter((marker) =>
      (marker.name === "first-paint" || marker.name === "first-interactive")
      && marker.atMs !== null
    );
  if (markers.length === 0) {
    return null;
  }
  return {
    schemaVersion: "1.0",
    source: "startup-perf-markers",
    markers,
    platform: typeof snapshot.platform === "string" ? snapshot.platform.slice(0, 80) : "unknown",
    status: "ok",
  };
}

function extractStartupSnapshot(input) {
  const direct = normalizeSnapshot(input);
  if (direct) {
    return direct;
  }
  if (isRecord(input)) {
    for (const key of ["startupPerf", "startupPerfSnapshot", "__CCGUI_STARTUP_PERF__"]) {
      const nested = normalizeSnapshot(input[key]);
      if (nested) {
        return nested;
      }
    }
  }
  const entries = collectEntries(input);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!isRecord(entry) || entry.label !== "perf.startup.markers") {
      continue;
    }
    const snapshot = normalizeSnapshot(entry.payload);
    if (snapshot) {
      return snapshot;
    }
  }
  return null;
}

function unsupportedSnapshot(reason) {
  return {
    schemaVersion: "1.0",
    source: "startup-perf-markers",
    markers: [
      { name: "first-paint", atMs: null },
      { name: "first-interactive", atMs: null },
    ],
    platform: "unknown",
    status: "unsupported",
    unsupportedReason: reason,
    followUp:
      "Enable VITE_ENABLE_PERF_BASELINE=1 in a non-production build, dump window.__CCGUI_STARTUP_PERF__ (or perf.startup.markers diagnostics) to --input, then re-run npm run perf:cold-start:startup-markers",
  };
}

async function writeJson(path, value) {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function main() {
  const strict = process.argv.includes("--strict");
  const verbose = process.argv.includes("--verbose");
  const dateStamp = getArgValue("--date") ?? todayStamp();
  const inputPath = getArgValue("--input") ?? DEFAULT_INPUT_PATH;
  const defaultOutput = `.artifacts/perf/cold-start-${dateStamp}/startup-markers.json`;
  const outputPath = getArgValue("--output") ?? defaultOutput;

  const absoluteInput = resolve(process.cwd(), inputPath);
  const input = existsSync(absoluteInput)
    ? JSON.parse(await readFile(absoluteInput, "utf-8"))
    : null;

  let snapshot = input ? extractStartupSnapshot(input) : null;
  if (!snapshot) {
    const reason = input == null
      ? `missing input file: ${inputPath}`
      : `no startup marker snapshot found in ${inputPath}`;
    snapshot = unsupportedSnapshot(reason);
    await writeJson(outputPath, snapshot);
    if (verbose) {
      console.info(`startup marker snapshot written (unsupported): ${outputPath}`);
      console.info(reason);
    }
    if (strict) {
      process.exitCode = 1;
      console.error(`[perf-startup-marker-snapshot] ${reason}`);
    } else {
      console.info(`[perf-startup-marker-snapshot] unsupported: ${reason}`);
      console.info(`[perf-startup-marker-snapshot] wrote ${outputPath}`);
    }
    return;
  }

  await writeJson(outputPath, snapshot);
  if (verbose || !strict) {
    console.info(`[perf-startup-marker-snapshot] wrote ${outputPath}`);
  }
}

main().catch((error) => {
  console.error("[perf-startup-marker-snapshot]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
