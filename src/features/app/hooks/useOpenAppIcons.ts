import { useEffect, useMemo, useRef, useState } from "react";
import { getOpenAppIcon } from "../../../services/tauri";
import type { OpenAppTarget } from "../../../types";
import { resolveOpenAppIconLookupKey } from "../utils/openAppIcons";

type OpenAppIconMap = Record<string, string>;

type ResolvedAppTarget = {
  id: string;
  /** Lookup key for host icon extraction (path or app name). */
  iconKey: string;
};

type UseOpenAppIconsOptions = {
  enabled?: boolean;
};

/**
 * Always try OS icon extraction for app/command targets when settings are active.
 * Built-in glyphs are only UI fallbacks — real logos come from the host.
 * Never runs on cold start (gated by `enabled`).
 */
export function useOpenAppIcons(
  openTargets: OpenAppTarget[],
  options?: UseOpenAppIconsOptions,
): OpenAppIconMap {
  const enabled = options?.enabled ?? true;
  const iconCacheRef = useRef<Map<string, string>>(new Map());
  const missCacheRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const [iconById, setIconById] = useState<OpenAppIconMap>({});

  const appTargets = useMemo<ResolvedAppTarget[]>(
    () =>
      openTargets
        .map((target) => {
          const iconKey = resolveOpenAppIconLookupKey(target);
          if (!iconKey) {
            return null;
          }
          return { id: target.id, iconKey };
        })
        .filter((item): item is ResolvedAppTarget => item != null),
    [openTargets],
  );

  useEffect(() => {
    if (!enabled || appTargets.length === 0) {
      return;
    }

    let cancelled = false;

    const resolveIcons = async () => {
      const nextIcons: OpenAppIconMap = {};

      await Promise.all(
        appTargets.map(async ({ id, iconKey }) => {
          const cached = iconCacheRef.current.get(iconKey);
          if (cached) {
            nextIcons[id] = cached;
            return;
          }
          if (missCacheRef.current.has(iconKey)) {
            return;
          }

          let request = inFlightRef.current.get(iconKey);
          if (!request) {
            request = getOpenAppIcon(iconKey)
              .catch(() => null)
              .finally(() => {
                inFlightRef.current.delete(iconKey);
              });
            inFlightRef.current.set(iconKey, request);
          }

          const icon = await request;
          if (icon) {
            iconCacheRef.current.set(iconKey, icon);
            nextIcons[id] = icon;
          } else {
            missCacheRef.current.add(iconKey);
          }
        }),
      );

      if (!cancelled && Object.keys(nextIcons).length > 0) {
        setIconById((prev) => ({ ...prev, ...nextIcons }));
      }
    };

    void resolveIcons();

    return () => {
      cancelled = true;
    };
  }, [appTargets, enabled]);

  return iconById;
}
