/**
 * LoadingScreen 通用加载状态组件
 *
 * 职责：展示全屏加载状态，减少各页面重复代码
 *
 * 使用场景：
 * - 页面数据加载中
 * - 异步操作等待中
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// ========== Props 类型定义 ==========
interface LoadingScreenProps {
  /** 加载提示文本，默认使用 i18n 的 common.loading */
  message?: string;
}

/**
 * LoadingScreen 组件
 * 全屏居中显示加载指示器和提示文本
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: theme.colors.onSurface }]}
      >
        {message ?? t("common.loading")}
      </Text>
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  message: {
    marginTop: 12,
  },
});

export default LoadingScreen;
