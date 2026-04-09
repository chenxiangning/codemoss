import { useEffect, useState } from "react";

const getSystemResolvedTheme = (): "light" | "dark" => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const useSystemResolvedTheme = (): "light" | "dark" => {
  const [systemResolvedTheme, setSystemResolvedTheme] = useState<"light" | "dark">(
    getSystemResolvedTheme,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let currentTheme = systemResolvedTheme;
    const syncTheme = () => {
      const nextTheme = media.matches ? "dark" : "light";
      if (nextTheme === currentTheme) {
        return;
      }
      currentTheme = nextTheme;
      setSystemResolvedTheme(nextTheme);
    };
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  return systemResolvedTheme;
};
