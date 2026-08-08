import { describe, expect, it } from "vitest";

import en from "./en/multiAgent";
import es from "./es/multiAgent";
import fr from "./fr/multiAgent";
import hi from "./hi/multiAgent";
import ja from "./ja/multiAgent";
import ko from "./ko/multiAgent";
import ptBR from "./pt-BR/multiAgent";
import ru from "./ru/multiAgent";
import zh from "./zh/multiAgent";
import zhTW from "./zh-TW/multiAgent";

type Bundle = { multiAgent: Record<string, unknown> };

const locales: Record<string, Bundle> = {
  es: es as Bundle,
  fr: fr as Bundle,
  hi: hi as Bundle,
  ja: ja as Bundle,
  ko: ko as Bundle,
  "pt-BR": ptBR as Bundle,
  ru: ru as Bundle,
  zh: zh as Bundle,
  "zh-TW": zhTW as Bundle,
};

function flattenKeys(node: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

function valueAt(node: Record<string, unknown>, path: string): string {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, segment) => (acc as Record<string, unknown>)[segment],
      node,
    ) as string;
}

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("multiAgent locale parity", () => {
  const enKeys = flattenKeys((en as Bundle).multiAgent).sort();

  it.each(Object.entries(locales))(
    "%s shares the English key set",
    (_language, locale) => {
      expect(flattenKeys(locale.multiAgent).sort()).toEqual(enKeys);
    },
  );

  it.each(Object.entries(locales))(
    "%s mirrors English interpolation placeholders",
    (_language, locale) => {
      enKeys.forEach((path) => {
        expect(
          placeholders(valueAt(locale.multiAgent, path)),
        ).toEqual(placeholders(valueAt((en as Bundle).multiAgent, path)));
      });
    },
  );
});
