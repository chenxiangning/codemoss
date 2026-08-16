import type { FileHistoryTarget } from "@mossx/plugin-git-history/runtime";
import {
  resolveGitRootWorkspacePrefix,
  resolveWorkspaceRelativePath,
} from "../../../utils/workspacePaths";
import { normalizeGitPath } from "../utils/commitScope";

export function resolveRepositoryWorkspaceFilePath(
  workspacePath: string | null | undefined,
  gitRoot: string | null | undefined,
  filePath: string,
) {
  const normalizedFilePath = normalizeGitPath(filePath);
  const repositoryRoot = normalizeGitPath(
    resolveWorkspaceRelativePath(workspacePath, gitRoot ?? ""),
  ).replace(/\/+$/, "");
  if (
    !repositoryRoot ||
    normalizedFilePath === repositoryRoot ||
    normalizedFilePath.startsWith(`${repositoryRoot}/`)
  ) {
    return normalizedFilePath;
  }
  return `${repositoryRoot}/${normalizedFilePath}`;
}

type ResolveGitDiffFileHistoryTargetOptions = {
  workspaceId: string | null | undefined;
  workspacePath: string | null | undefined;
  path: string;
  gitRoot?: string | null;
  repositoryRoot?: string;
};

function normalizeFileHistoryRelativePath(
  value: string,
  allowEmpty: boolean,
): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") {
    return allowEmpty ? "" : null;
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /^[A-Za-z]:/.test(trimmed)
  ) {
    return null;
  }
  const normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/\/+$/, "");
  if (
    !normalized ||
    normalized.split("/").some(
      (segment) => !segment || segment === "." || segment === "..",
    )
  ) {
    return null;
  }
  return normalized;
}

export function resolveGitDiffFileHistoryTarget({
  workspaceId,
  workspacePath,
  path,
  gitRoot = null,
  repositoryRoot,
}: ResolveGitDiffFileHistoryTargetOptions): FileHistoryTarget | null {
  if (!workspaceId?.trim() || !workspacePath?.trim()) {
    return null;
  }
  const normalizedPath = normalizeFileHistoryRelativePath(path, false);
  if (!normalizedPath) {
    return null;
  }

  let normalizedRepositoryRoot: string | null;
  if (repositoryRoot !== undefined) {
    normalizedRepositoryRoot = normalizeFileHistoryRelativePath(
      repositoryRoot,
      true,
    );
  } else {
    const trimmedGitRoot = gitRoot?.trim() ?? "";
    if (!trimmedGitRoot || trimmedGitRoot === ".") {
      normalizedRepositoryRoot = "";
    } else {
      const workspacePrefix = resolveGitRootWorkspacePrefix(
        workspacePath,
        trimmedGitRoot,
      );
      if (workspacePrefix) {
        normalizedRepositoryRoot = normalizeFileHistoryRelativePath(
          workspacePrefix,
          true,
        );
      } else {
        normalizedRepositoryRoot =
          resolveWorkspaceRelativePath(workspacePath, trimmedGitRoot) === ""
            ? ""
            : null;
      }
    }
  }
  if (normalizedRepositoryRoot === null) {
    return null;
  }

  return {
    workspaceId,
    workspacePath,
    repositoryRoot: normalizedRepositoryRoot,
    path: normalizedPath,
    displayPath: normalizedRepositoryRoot
      ? `${normalizedRepositoryRoot}/${normalizedPath}`
      : normalizedPath,
  };
}
