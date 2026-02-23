/**
 * 已选筛选条件汇总栏（搜索页使用）
 *
 * 功能：
 *   - 横向滚动展示当前已选的分类 + 标签 Chip
 *   - 分类 Chip：方角 (borderRadius: 4)，前缀图标 folder
 *   - 标签 Chip：圆角 (borderRadius: 16)，前缀 #
 *   - 每个 Chip 可点击移除
 *   - 末尾"清除全部"按钮
 *
 * 使用方：app/search.tsx
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import { UNCATEGORIZED_ID } from "../../utils/noteFilters";

interface FilterSummaryBarProps {
  /** 当前选中的分类 ID（null = 无） */
  selectedCategory: string | null;
  /** 当前选中的标签列表 */
  selectedTags: string[];
  /** 取消分类选择 */
  onClearCategory: () => void;
  /** 取消某个标签 */
  onRemoveTag: (tag: string) => void;
  /** 清除所有筛选 */
  onClearAll: () => void;
}

export const FilterSummaryBar: React.FC<FilterSummaryBarProps> = ({
  selectedCategory,
  selectedTags,
  onClearCategory,
  onRemoveTag,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const hasAny = !!(selectedCategory || selectedTags.length > 0);
  if (!hasAny) return null;

  /** 分类的显示名称 */
  const categoryLabel =
    selectedCategory === UNCATEGORIZED_ID
      ? t("category.uncategorized")
      : selectedCategory;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 分类 Chip（方角风格） */}
        {selectedCategory && (
          <Chip
            mode="flat"
            icon="folder-outline"
            onClose={onClearCategory}
            style={[
              styles.categoryChip,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}
            closeIconAccessibilityLabel={t("common.delete")}
          >
            {categoryLabel}
          </Chip>
        )}

        {/* 标签 Chips（圆角风格） */}
        {selectedTags.map((tag) => (
          <Chip
            key={tag}
            mode="flat"
            onClose={() => onRemoveTag(tag)}
            style={[
              styles.tagChip,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
            textStyle={{
              color: theme.colors.onSecondaryContainer,
              fontSize: 12,
            }}
            closeIconAccessibilityLabel={t("common.delete")}
          >
            #{tag}
          </Chip>
        ))}

        {/* 清除全部按钮 */}
        <TouchableOpacity
          onPress={onClearAll}
          style={styles.clearAllBtn}
          activeOpacity={0.7}
        >
          <Text variant="labelSmall" style={{ color: theme.colors.error }}>
            {t("search.clear_all_filters")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  /** 分类 Chip：方角风格，视觉区分于标签 */
  categoryChip: {
    borderRadius: 4,
    height: 30,
  },
  /** 标签 Chip：圆角风格 */
  tagChip: {
    borderRadius: 16,
    height: 30,
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
  },
});
