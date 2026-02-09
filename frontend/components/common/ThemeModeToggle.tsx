import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";
import { useThemeMode } from "../../hooks/useThemeMode";

/**
 * ThemeModeToggle
 *
 * UI 层组件：只负责渲染，不直接读写 Store。
 * - 状态来自 useThemeMode（Hooks 层）
 * - 便于后续从 Settings 页面自由移植
 */
export const ThemeModeToggle: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { themeMode, setMode } = useThemeMode();

  const buttons = useMemo(
    () => [
      { value: "system", label: t("settings.theme.system") },
      { value: "light", label: t("settings.theme.light") },
      { value: "dark", label: t("settings.theme.dark") },
    ],
    [t],
  );

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
        {t("settings.theme.title")}
      </Text>

      {/*
        SegmentedButtons 符合“滑动式切换按钮”的轻量需求：
        - 点击切换；
        - 同时可通过滑动/拖动在各段之间切换（依赖平台交互实现）；
        - 无需引入额外页面或动画。
      */}
      <View style={styles.toggleRow}>
        <SegmentedButtons
          value={themeMode}
          onValueChange={(v) => {
            // 防御性：避免 v 为非法值导致闪退
            if (v === "system" || v === "light" || v === "dark") {
              setMode(v);
            }
          }}
          buttons={buttons}
          style={styles.segmented}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  toggleRow: {
    marginTop: 10,
  },
  segmented: {
    width: "100%",
  },
});

export default ThemeModeToggle;
