import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * useAndroidSystemNavigationBar
 *
 * Hooks 层职责：
 * - 仅在 Android 同步系统导航栏颜色/按钮样式，避免深色模式下出现浅色底栏。
 * - 在键盘显示/隐藏后重新同步一次，规避部分 ROM 在输入聚焦时重置导航栏样式。
 */
export const useAndroidSystemNavigationBar = (
  isDark: boolean,
  backgroundColor: string,
) => {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const syncNavigationBar = async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(backgroundColor);
        await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
      } catch (error) {
        if (__DEV__) {
          console.warn("[useAndroidSystemNavigationBar] sync failed:", error);
        }
      }
    };

    syncNavigationBar();

    const onKeyboardShow = Keyboard.addListener("keyboardDidShow", () => {
      syncNavigationBar();
    });
    const onKeyboardHide = Keyboard.addListener("keyboardDidHide", () => {
      syncNavigationBar();
    });

    return () => {
      onKeyboardShow.remove();
      onKeyboardHide.remove();
    };
  }, [backgroundColor, isDark]);
};
