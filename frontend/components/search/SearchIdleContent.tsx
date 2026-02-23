/**
 * 搜索页初始态内容
 *
 * 展示搜索历史和搜索引导提示
 * 分类/标签 Chip 已提升到 search.tsx 固定区域，始终可见
 *
 * 交互：
 * - 点击历史词条 → 填入搜索框触发搜索
 * - 点击历史 × → 删除单条；点击清空 → 清空全部
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { SearchHistory } from "./SearchHistory";

interface SearchIdleContentProps {
  /** 搜索历史列表 */
  searchHistory: string[];
  /** 点击历史词条回调（填入搜索框） */
  onHistoryPress: (title: string) => void;
  /** 删除单条历史记录 */
  onHistoryRemove: (title: string) => void;
  /** 清空所有历史记录 */
  onHistoryClearAll: () => void;
}

export const SearchIdleContent: React.FC<SearchIdleContentProps> = ({
  searchHistory,
  onHistoryPress,
  onHistoryRemove,
  onHistoryClearAll,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── 搜索历史记录 ────────────────────── */}
      <SearchHistory
        history={searchHistory}
        onPress={onHistoryPress}
        onRemove={onHistoryRemove}
        onClearAll={onHistoryClearAll}
      />

      {/* ── 搜索引导提示（仅无历史记录时显示） ── */}
      {!searchHistory?.length && (
        <View style={styles.hintContainer}>
          <Icon source="magnify" size={40} color={theme.colors.outline} />
          <Text
            variant="bodyMedium"
            style={[styles.hintText, { color: theme.colors.outline }]}
          >
            {t("search.idle_hint")}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.hintSubText,
              { color: theme.colors.outline, opacity: 0.6 },
            ]}
          >
            {t("search.idle_sub_hint")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  hintContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  hintText: {
    marginTop: 12,
  },
  hintSubText: {
    marginTop: 4,
  },
});
