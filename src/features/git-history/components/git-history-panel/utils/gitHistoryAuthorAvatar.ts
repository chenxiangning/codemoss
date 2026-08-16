import {
  PERSONA_AUTHOR_POOL,
  resolveGithubAvatarUrl,
  resolveGithubProfileUrl,
  resolveLocalPersonaAvatarSrc,
} from "@mossx/plugin-subagent-ui/runtime";

export type GitHistoryAuthorAvatar = {
  avatarSrc: string | null;
  githubProfileUrl: string | null;
};

const EMPTY_AVATAR: GitHistoryAuthorAvatar = {
  avatarSrc: null,
  githubProfileUrl: null,
};

/** GitHub username: 1–39 chars, alnum/hyphen, no leading/trailing hyphen. */
const GITHUB_LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function looksLikeGithubLogin(value: string): boolean {
  return GITHUB_LOGIN_RE.test(value);
}

/**
 * Parse login from common GitHub noreply emails:
 * - login@users.noreply.github.com
 * - 123456+login@users.noreply.github.com
 */
function extractGithubLoginFromEmail(
  authorEmail: string | null | undefined,
): string | null {
  const email = authorEmail?.trim().toLowerCase() ?? "";
  if (!email.endsWith("@users.noreply.github.com")) {
    return null;
  }
  const local = email.slice(0, -"@users.noreply.github.com".length);
  if (!local) {
    return null;
  }
  const plusIndex = local.indexOf("+");
  const candidate = plusIndex >= 0 ? local.slice(plusIndex + 1) : local;
  return looksLikeGithubLogin(candidate) ? candidate : null;
}

function findPoolEntry(login: string | null, authorName: string | null) {
  const normalizedLogin = login?.toLowerCase() ?? "";
  const normalizedName = authorName?.trim().toLowerCase() ?? "";
  if (!normalizedLogin && !normalizedName) {
    return null;
  }
  return (
    PERSONA_AUTHOR_POOL.find((entry) => {
      const entryLogin = entry.githubLogin?.trim().toLowerCase() ?? "";
      const entryName = entry.name.trim().toLowerCase();
      return (
        (normalizedLogin && (entryLogin === normalizedLogin || entryName === normalizedLogin)) ||
        (normalizedName && (entryName === normalizedName || entryLogin === normalizedName))
      );
    }) ?? null
  );
}

/**
 * Resolve a small author avatar for git history rows.
 * Prefers bundled contributor assets, then GitHub CDN from noreply email / login-like name.
 */
export function resolveGitHistoryAuthorAvatar(
  authorEmail: string | null | undefined,
  author: string | null | undefined,
): GitHistoryAuthorAvatar {
  const authorName = author?.trim() || null;
  const loginFromEmail = extractGithubLoginFromEmail(authorEmail);
  const loginFromName =
    authorName && looksLikeGithubLogin(authorName) ? authorName : null;

  const poolEntry = findPoolEntry(loginFromEmail ?? loginFromName, authorName);
  if (poolEntry) {
    const githubLogin = poolEntry.githubLogin?.trim() || poolEntry.name;
    const local = resolveLocalPersonaAvatarSrc(poolEntry.avatarKey);
    const remote = resolveGithubAvatarUrl(githubLogin, 40);
    return {
      avatarSrc: local ?? remote,
      githubProfileUrl: resolveGithubProfileUrl(githubLogin),
    };
  }

  const login = loginFromEmail ?? loginFromName;
  if (!login) {
    return EMPTY_AVATAR;
  }

  return {
    avatarSrc: resolveGithubAvatarUrl(login, 40),
    githubProfileUrl: resolveGithubProfileUrl(login),
  };
}
