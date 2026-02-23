/**
 * 搜索错误状态
 *
 * 居中展示错误图标、标题、描述和重试按钮
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";

interface SearchErrorProps {
  /** 重试回调 */
  onRetry: () => void;
}

export const SearchError: React.FC<SearchErrorProps> = ({ onRetry }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* 图标容器 */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.errorContainer },
        ]}
      >
        <Icon source="wifi-off" size={32} color={theme.colors.error} />
      </View>

      {/* 主标题 */}
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        {t("search.error_title")}
      </Text>

      {/* 描述 */}
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: theme.colors.outline }]}
      >
        {t("search.error_message")}
      </Text>

      {/* 重试按钮 */}
      <Button
        mode="contained"
        onPress={onRetry}
        style={styles.retryButton}
        buttonColor={theme.colors.primary}
        textColor={theme.colors.onPrimary}
      >
        {t("search.error_retry")}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginTop: 16,
  },
  message: {
    marginTop: 6,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 24,
  },
});
