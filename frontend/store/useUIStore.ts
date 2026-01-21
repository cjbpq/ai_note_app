import { create } from "zustand";

interface UIState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  // 比如：只看“生活”类的笔记
  filterTag: string | null;
  setFilterTag: (tag: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  filterTag: null,
  setFilterTag: (tag) => set({ filterTag: tag }),
}));
