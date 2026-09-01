import {
  getClientStoreSync,
  writeClientStoreValue,
} from "@/services/clientStorage";
import { OMP_LOCAL_PROVIDER_PROFILE_ID } from "../../threads/constants/codexProviderProfiles";

export const OMP_PROVIDER_PROFILE_STORAGE_KEY = "ompProviderProfile";

const OMP_PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const OMP_PROFILE_NAME_MAX_LENGTH = 128;

export type OmpProviderProfile = Readonly<{
  binaryPath: string | null;
  profileId: string;
  profileName: string;
}>;

export type OmpProviderProfileDraft = Readonly<{
  binaryPath?: string | null;
  profileId?: string | null;
  profileName?: string | null;
}>;

/**
 * OMP auth-broker owns credentials and provider discovery. This store keeps
 * only the selected provider identity for mossx session binding.
 */
export function normalizeOmpProviderProfile(
  draft: OmpProviderProfileDraft,
): OmpProviderProfile | null {
  const profileId = draft.profileId?.trim() || null;
  const profileName = draft.profileName?.trim() || null;
  if (
    !profileId ||
    !OMP_PROFILE_ID_PATTERN.test(profileId) ||
    !profileName ||
    profileName.length > OMP_PROFILE_NAME_MAX_LENGTH
  ) {
    return null;
  }
  return Object.freeze({
    binaryPath: draft.binaryPath?.trim() || null,
    profileId,
    profileName,
  });
}

export function readOmpProviderProfile(): OmpProviderProfile | null {
  return normalizeOmpProviderProfile(
    getClientStoreSync<OmpProviderProfileDraft>(
      "app",
      OMP_PROVIDER_PROFILE_STORAGE_KEY,
    ) ?? {},
  );
}

export function persistOmpProviderProfile(profile: OmpProviderProfile): void {
  writeClientStoreValue("app", OMP_PROVIDER_PROFILE_STORAGE_KEY, profile, {
    immediate: true,
  });
}

/**
 * Session binding is intentionally fail-closed: an incomplete OMP draft never
 * becomes a provider identity, and OMP's unsupported tool grants remain absent.
 *
 * OMP 是本地单渠道引擎：binding id 恒为 OMP 本地 sentinel，自定义 profileId
 * 只是显示元数据，绝不作为 provider identity 进入 target/catalog 链路
 * （传给 `omp models` 会静默返回空目录）。
 */
export function resolveOmpProviderSessionBinding(
  profile: OmpProviderProfile | null | undefined,
): { id: string; name: string; source: "managed" } | null {
  if (!profile) {
    return null;
  }
  const normalized = normalizeOmpProviderProfile(profile);
  return normalized
    ? {
        id: OMP_LOCAL_PROVIDER_PROFILE_ID,
        name: normalized.profileName,
        source: "managed",
      }
    : null;
}
