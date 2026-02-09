/**
 * ErrorScreen 通用错误状态组件
 *
 * 职责：展示全屏错误状态，提供重试操作
 *
 * 使用场景：
 * - 数据加载失败
 * - 资源未找到
 * - 网络错误
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

// ========== Props 类型定义 ==========
interface ErrorScreenProps {
  /** 错误提示标题 */
  title?: string;
  /** 错误详情信息 */
  message?: string;
  /** 重试按钮回调，不传则不显示重试按钮 */
  onRetry?: () => void;
  /** 返回按钮回调，不传则不显示返回按钮 */
  onBack?: () => void;
  /** 图标名称，默认 alert-circle-outline */
  iconName?: keyof typeof Ionicons.glyphMap;
}

/**
 * ErrorScreen 组件
 * 全屏居中显示错误信息和操作按钮
 */
export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  title,
  message,
  onRetry,
  onBack,
  iconName = "alert-circle-outline",
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* 错误图标 */}
      <Ionicons name={iconName} size={64} color={theme.colors.error} />

      {/* 标题 */}
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onSurface }]}
      >
        {title ?? t("common.error")}
      </Text>

      {/* 详情信息 */}
      {message && (
        <Text
          variant="bodyMedium"
          style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
        >
          {message}
        </Text>
      )}

      {/* 操作按钮区域 */}
      <View style={styles.buttonContainer}>
        {onRetry && (
          <Button mode="contained" onPress={onRetry} style={styles.button}>
            {t("common.retry")}
          </Button>
        )}
        {onBack && (
          <Button mode="outlined" onPress={onBack} style={styles.button}>
            {t("common.back")}
          </Button>
        )}
      </View>
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
  title: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    minWidth: 100,
  },
});

export default ErrorScreen;
