import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STORAGE_KEYS } from "../constants/config";
import { ThemeMode } from "../types";

interface UIState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  // 比如：只看“生活”类的笔记
  filterTag: string | null;
  setFilterTag: (tag: string | null) => void;

  // 主题模式（最小可用：system/light/dark）
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

/**
 * useUIStore
 *
 * 职责：仅存放“纯客户端 UI 状态”（不存放服务端业务数据）
 * - themeMode：需要持久化，避免每次重启都丢失用户偏好
 * - searchQuery/filterTag：当前为示例字段，未来做搜索/筛选可复用
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),

      filterTag: null,
      setFilterTag: (tag) => set({ filterTag: tag }),

      themeMode: "system",
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: STORAGE_KEYS.UI_THEME_MODE,
      storage: createJSONStorage(() => AsyncStorage),
      // 只持久化必要字段，避免未来扩展 store 时引入兼容负担
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
);
