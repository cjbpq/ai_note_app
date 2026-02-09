import { useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useUIStore } from "../store/useUIStore";
import { ThemeMode } from "../types";

/**
 * useThemeMode
 *
 * Hooks 层职责（UI -> Hooks -> Store）：
 * - 从 Store 读取 themeMode（system/light/dark）
 * - 结合系统配色，计算出“有效模式”（light/dark）
 * - 对 UI 暴露最小 API，避免 UI 直接处理系统配色细节
 */
export const useThemeMode = () => {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const effectiveMode: Exclude<ThemeMode, "system"> = useMemo(() => {
    if (themeMode === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return themeMode;
  }, [systemScheme, themeMode]);

  const isDark = effectiveMode === "dark";

  const setMode = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
    },
    [setThemeMode],
  );

  return {
    themeMode,
    effectiveMode,
    isDark,
    setMode,
  };
};
