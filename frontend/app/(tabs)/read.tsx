/**
 * 笔记列表页面（含分类侧边栏 Drawer）
 *
 * 数据流：
 *   useNotes()（全量笔记） + useCategories()（分类列表）
 *   ↓
 *   filterNotesByCategory()（按选中分类过滤）
 *   ↓
 *   FlatList 渲染 NoteCard
 *
 * Drawer：
 *   左侧划出 CategoryDrawer，展示系统分类（全部/未分类）+ 用户分类
 *   选中分类后自动过滤列表并关闭 Drawer
 */
import { Href, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { Appbar, Text, useTheme } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import NoteCard from "../../components/note-card";
import { CategoryDrawer } from "../../components/read";
import { useCategories } from "../../hooks/useCategories";
import { useNotes } from "../../hooks/useNotes";
import {
  countUncategorizedNotes,
  filterNotesByCategory,
  UNCATEGORIZED_ID,
} from "../../utils/noteFilters";

export default function ReadScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── 数据 Hook ──
  const { notes, isLoading, isError } = useNotes();
  const { categories } = useCategories();

  // ── Drawer 状态 ──
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── 分类筛选状态（null = 全部） ──
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── 按分类过滤后的笔记列表 ──
  const filteredNotes = useMemo(
    () => filterNotesByCategory(notes ?? [], selectedCategory),
    [notes, selectedCategory],
  );

  // ── 统计数据 ──
  const totalCount = notes?.length ?? 0;
  const uncategorizedCount = useMemo(
    () => countUncategorizedNotes(notes ?? []),
    [notes],
  );

  // ── 选中分类 → 关闭 Drawer ──
  const handleCategorySelect = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setDrawerOpen(false);
  }, []);

  // ── 导航到笔记详情 ──
  const handleNotePress = (noteId: string) => {
    router.push(`/note/${noteId}` as Href);
  };

  // ── Appbar 副标题：当前筛选说明 ──
  const subtitle = useMemo(() => {
    if (!selectedCategory) return undefined;
    const label =
      selectedCategory === UNCATEGORIZED_ID
        ? t("category.uncategorized")
        : selectedCategory;
    return `${label} (${filteredNotes.length})`;
  }, [selectedCategory, filteredNotes.length, t]);

  // ── 内容区渲染 ──
  const renderContent = () => {
    // 加载中状态
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    // 错误状态
    if (isError) {
      return (
        <View style={styles.centerContainer}>
          <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
            {t("common.error")}
          </Text>
        </View>
      );
    }

    // 空列表状态
    if (!filteredNotes || filteredNotes.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {selectedCategory
              ? t("category.empty_state")
              : t("noteDetail.no_content")}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        style={styles.list}
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <NoteCard
            title={item.title}
            date={item.date}
            tags={item.tags}
            imageUrl={item.imageUrls?.[0]}
            isFavorite={item.isFavorite}
            category={item.category}
            onPress={() => handleNotePress(item.id)}
          />
        )}
      />
    );
  };

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      drawerType="front"
      drawerPosition="left"
      drawerStyle={{
        width: 280,
        backgroundColor: theme.colors.surface,
      }}
      renderDrawerContent={() => (
        <CategoryDrawer
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={handleCategorySelect}
          totalNoteCount={totalCount}
          uncategorizedCount={uncategorizedCount}
        />
      )}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header statusBarHeight={insets.top}>
          {/* 汉堡菜单：打开分类 Drawer */}
          <Appbar.Action icon="menu" onPress={() => setDrawerOpen(true)} />
          <Appbar.Content title={t("tab.read")} subtitle={subtitle} />
          {/* 搜索入口 */}
          <Appbar.Action
            icon="magnify"
            accessibilityLabel={t("common.search")}
            onPress={() => {
              router.push("/search" as Href);
            }}
          />
          {/* 当有筛选时：显示清除按钮 */}
          {selectedCategory && (
            <Appbar.Action
              icon="filter-off"
              onPress={() => setSelectedCategory(null)}
            />
          )}
        </Appbar.Header>

        <View style={styles.container}>{renderContent()}</View>
      </SafeAreaView>
    </Drawer>
  );
}

// ========== 样式定义 ==========
// StyleSheet 仅负责布局，颜色使用 theme 动态获取
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 10,
  },
});
