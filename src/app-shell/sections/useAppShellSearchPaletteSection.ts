import { useState } from "react";
import type {
  SearchContentFilter,
  SearchScope,
  WorkspaceSearchFileSnapshot,
} from "../../features/search/types";

export function useAppShellSearchPaletteSection() {
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [searchScope, setSearchScope] =
    useState<SearchScope>("active-workspace");
  const [searchContentFilters, setSearchContentFilters] = useState<
    SearchContentFilter[]
  >(["all"]);
  const [searchPaletteQuery, setSearchPaletteQuery] = useState("");
  const [searchPaletteSelectedIndex, setSearchPaletteSelectedIndex] =
    useState(0);
  const [globalSearchFilesByWorkspace, setGlobalSearchFilesByWorkspace] =
    useState<Record<string, WorkspaceSearchFileSnapshot>>({});

  return {
    globalSearchFilesByWorkspace,
    isSearchPaletteOpen,
    searchContentFilters,
    searchPaletteQuery,
    searchPaletteSelectedIndex,
    searchScope,
    setGlobalSearchFilesByWorkspace,
    setIsSearchPaletteOpen,
    setSearchContentFilters,
    setSearchPaletteQuery,
    setSearchPaletteSelectedIndex,
    setSearchScope,
  };
}
