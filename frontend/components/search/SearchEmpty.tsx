/**
 * 搜索无结果空状态
 *
 * 支持两种场景：
 * 1. 关键词搜索无结果：显示关键词提示
 * 2. 仅筛选条件无结果：显示筛选提示
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface SearchEmptyProps {
  /** 用户当前搜索的关键词 */
  query: string;
  /** 是否有活跃的筛选条件（分类/标签） */
  hasActiveFilters?: boolean;
}

export const SearchEmpty: React.FC<SearchEmptyProps> = ({
  query,
  hasActiveFilters = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 根据是否有关键词决定提示文案
  const hasKeyword = query.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* 图标容器 */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Icon
          source="file-search-outline"
          size={32}
          color={theme.colors.outline}
        />
      </View>

      {/* 主标题 */}
      <Text
        variant="titleMedium"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        {t("search.empty_title")}
      </Text>

      {/* 提示信息：关键词搜索 vs 纯筛选 */}
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: theme.colors.outline }]}
      >
        {hasKeyword
          ? t("search.empty_message", { query })
          : hasActiveFilters
            ? t("search.empty_filter_message")
            : t("search.empty_title")}
      </Text>

      {/* 建议 */}
      <Text
        variant="bodySmall"
        style={[styles.hint, { color: theme.colors.outline, opacity: 0.6 }]}
      >
        {t("search.empty_hint")}
      </Text>
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
  hint: {
    marginTop: 4,
  },
});
