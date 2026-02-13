import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Snackbar, Text, useTheme } from "react-native-paper";

import { APP_CONFIG } from "../../constants/config";
import { useToastStore } from "../../store/useToastStore";
import { ToastType } from "../../types";

/**
 * 全局 Snackbar 组件
 *
 * 职责：
 * 1. 监听 ToastStore 状态变化，自动显示/隐藏
 * 2. 根据 Toast 类型显示不同样式（success/error/warning/info）
 * 3. 支持操作按钮（如"撤销"）
 *
 * 使用方式：
 * 在 App 根组件（_layout.tsx）的 PaperProvider 内部引入，
 * 放在 Stack 组件外部以确保覆盖所有页面。
 *
 * <PaperProvider>
 *   <Stack>...</Stack>
 *   <GlobalSnackbar />
 * </PaperProvider>
 */
export const GlobalSnackbar: React.FC = () => {
  const theme = useTheme();
  const { currentToast, hideToast } = useToastStore();

  // ===== 根据类型获取背景色 =====
  const getBackgroundColor = useCallback(
    (type: ToastType): string => {
      switch (type) {
        case "success":
          // 成功：使用 primaryContainer（通常是主题色的浅色变体）
          return theme.colors.primaryContainer;
        case "error":
          // 错误：使用 errorContainer
          return theme.colors.errorContainer;
        case "warning":
          // 警告：使用 secondaryContainer
          return theme.colors.secondaryContainer;
        case "info":
        default:
          // 信息：使用反色表面（深色背景）
          return theme.colors.inverseSurface;
      }
    },
    [theme],
  );

  // ===== 根据类型获取文字颜色 =====
  const getTextColor = useCallback(
    (type: ToastType): string => {
      switch (type) {
        case "success":
          return theme.colors.onPrimaryContainer;
        case "error":
          return theme.colors.onErrorContainer;
        case "warning":
          return theme.colors.onSecondaryContainer;
        case "info":
        default:
          return theme.colors.inverseOnSurface;
      }
    },
    [theme],
  );

  // ===== 根据类型获取图标前缀 =====
  const getIcon = (type: ToastType): string => {
    switch (type) {
      case "success":
        return "✓ ";
      case "error":
        return "✕ ";
      case "warning":
        return "⚠ ";
      case "info":
      default:
        return "";
    }
  };

  // ===== 自动隐藏计时器 =====
  useEffect(() => {
    if (currentToast) {
      // 使用配置的持续时间，或默认值
      const duration = currentToast.duration ?? APP_CONFIG.TOAST_DURATION;
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      // 清理：组件卸载或 Toast 变化时清除计时器
      return () => clearTimeout(timer);
    }
  }, [currentToast, hideToast]);

  // ===== 处理关闭（用户滑动或点击关闭） =====
  const handleDismiss = useCallback(() => {
    hideToast();
  }, [hideToast]);

  // ===== 处理操作按钮点击 =====
  const handleAction = useCallback(() => {
    if (currentToast?.onAction) {
      currentToast.onAction();
    }
    hideToast();
  }, [currentToast, hideToast]);

  // 无 Toast 时不渲染
  if (!currentToast) {
    return null;
  }

  const backgroundColor = getBackgroundColor(currentToast.type);
  const textColor = getTextColor(currentToast.type);
  const icon = getIcon(currentToast.type);

  return (
    <Snackbar
      visible={true}
      onDismiss={handleDismiss}
      // 实际时长由 useEffect 控制，这里设置一个较长的值避免提前关闭
      duration={Snackbar.DURATION_LONG}
      style={[styles.snackbar, { backgroundColor }]}
      action={
        currentToast.actionLabel
          ? {
              label: currentToast.actionLabel,
              onPress: handleAction,
              textColor: textColor,
            }
          : undefined
      }
    >
      <View style={styles.content}>
        <Text style={[styles.message, { color: textColor }]}>
          {icon}
          {currentToast.message}
        </Text>
      </View>
    </Snackbar>
  );
};

const styles = StyleSheet.create({
  snackbar: {
    // 底部留出安全距离
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  message: {
    fontSize: 14,
    fontWeight: "500",
  },
});

export default GlobalSnackbar;
