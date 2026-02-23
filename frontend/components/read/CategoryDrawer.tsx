/**
 * 分类侧边栏 Drawer 组件（阅读页使用）
 *
 * 功能：
 *   - 顶部：标题 + 副标题（当前筛选分类 + 笔记数量）
 *   - 系统分类：全部 / 未分类
 *   - 用户分类列表：按服务端+本地合并显示，含笔记数量
 *   - 点击分类 → 筛选笔记列表并关闭 Drawer
 *
 * 使用方：app/(tabs)/read.tsx
 * 数据来源：useCategories Hook
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, Text, TouchableRipple, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NoteCategory } from "../../types";
import { UNCATEGORIZED_ID } from "../../utils/noteFilters";

// ── Props ───────────────────────────────────────────
interface CategoryDrawerProps {
  /** 用户分类列表 */
  categories: NoteCategory[];
  /** 当前选中分类名（null = 全部） */
  selectedCategory: string | null;
  /** 选中回调 */
  onSelect: (category: string | null) => void;
  /** 笔记总数 */
  totalNoteCount: number;
  /** 未分类笔记数 */
  uncategorizedCount: number;
}

export const CategoryDrawer: React.FC<CategoryDrawerProps> = ({
  categories,
  selectedCategory,
  onSelect,
  totalNoteCount,
  uncategorizedCount,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /** 渲染单个分类行 */
  const renderItem = (
    id: string | null,
    label: string,
    icon: string,
    count: number,
  ) => {
    const isSelected = selectedCategory === id;
    return (
      <TouchableRipple
        key={id ?? "all"}
        onPress={() => onSelect(id)}
        style={[
          styles.item,
          isSelected && {
            backgroundColor: theme.colors.primaryContainer,
            borderRadius: 12,
          },
        ]}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemLeft}>
            <MaterialCommunityIcons
              name={icon as any}
              size={22}
              color={
                isSelected
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant
              }
            />
            <Text
              variant="bodyLarge"
              style={{
                marginLeft: 16,
                color: isSelected
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurface,
                fontWeight: isSelected ? "600" : "400",
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
          <Text
            variant="bodySmall"
            style={{
              color: isSelected
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurfaceVariant,
            }}
          >
            {count}
          </Text>
        </View>
      </TouchableRipple>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          paddingTop: insets.top + 16,
        },
      ]}
    >
      {/* 标题区域 */}
      <View style={styles.header}>
        <Text
          variant="titleLarge"
          style={{ color: theme.colors.onSurface, fontWeight: "bold" }}
        >
          {t("read.drawer_title")}
        </Text>
      </View>

      <Divider style={styles.divider} />

      {/* 可滚动分类列表 */}
      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
      >
        {/* 系统分类 */}
        {renderItem(
          null,
          t("category.all"),
          "folder-multiple-outline",
          totalNoteCount,
        )}
        {renderItem(
          UNCATEGORIZED_ID,
          t("category.uncategorized"),
          "folder-alert-outline",
          uncategorizedCount,
        )}

        <Divider style={styles.sectionDivider} />

        {/* 用户分类 */}
        {categories.length > 0 ? (
          categories.map((cat) =>
            renderItem(cat.name, cat.name, "folder-outline", cat.noteCount),
          )
        ) : (
          <View style={styles.emptyState}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("category.empty_state")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
  },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  divider: {
    marginBottom: 8,
  },
  scrollArea: {
    flex: 1,
  },
  item: {
    height: 52,
    paddingHorizontal: 12,
    justifyContent: "center",
    marginVertical: 2,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionDivider: {
    marginVertical: 8,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
});
