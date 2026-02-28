/**
 * 收藏列表页面
 *
 * 独立全屏 push 页面（与 search.tsx 同级，非 Tab 页）。
 * 入口：Settings 页 → "我的收藏" 菜单项
 * 退出：顶部返回按钮 → router.back()
 *
 * 数据流：
 * - 复用 useNotes() 返回的笔记列表缓存
 * - 通过 useMemo + filterFavoriteNotes 纯函数过滤 isFavorite === true
 * - 无需额外 Hook / Service / Store（逻辑足够简单）
 *
 * 分层职责：
 * - UI 层：渲染收藏列表 + 空状态
 * - Utils：filterFavoriteNotes（noteFilters.ts）
 * - Hook：useNotes（数据源）
 */
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import NoteCard from "../components/note-card";
import { useNotes } from "../hooks/useNotes";
import { Note } from "../types";
import { filterFavoriteNotes } from "../utils/noteFilters";

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // =========================================================================
  // 数据：从 useNotes 缓存中过滤收藏笔记
  // =========================================================================
  const { notes, isLoading } = useNotes();
  const favoriteNotes = useMemo(() => filterFavoriteNotes(notes), [notes]);

  // =========================================================================
  // 事件处理
  // =========================================================================

  /** 点击笔记卡片 → 跳转详情页 */
  const handleNotePress = useCallback(
    (noteId: string) => {
      router.push(`/note/${noteId}` as Href);
    },
    [router],
  );

  /** 返回上一页 */
  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  // =========================================================================
  // 渲染：列表项
  // =========================================================================
  const renderNoteItem = useCallback(
    ({ item }: { item: Note }) => (
      <NoteCard
        title={item.title}
        date={item.date}
        tags={item.tags}
        imageUrl={item.imageUrls?.[0]}
        isFavorite={item.isFavorite}
        category={item.category}
        onPress={() => handleNotePress(item.id)}
      />
    ),
    [handleNotePress],
  );

  // =========================================================================
  // 渲染：空状态
  // =========================================================================
  const renderEmptyState = () => {
    // 数据加载中时不显示空状态，避免闪烁
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="heart-outline"
          size={64}
          color={theme.colors.onSurfaceVariant}
          style={styles.emptyIcon}
        />
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("favorites.empty")}
        </Text>
      </View>
    );
  };

  // =========================================================================
  // 渲染：页面
  // =========================================================================
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      {/* 顶部 Appbar */}
      <Appbar.Header
        style={{ backgroundColor: theme.colors.surface }}
        elevated={false}
      >
        <Appbar.BackAction onPress={handleGoBack} />
        <Appbar.Content title={t("favorites.title")} />
      </Appbar.Header>

      {/* 收藏列表 */}
      <FlatList
        style={styles.list}
        data={favoriteNotes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          // 列表为空时让空状态居中
          favoriteNotes.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={renderNoteItem}
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

// =========================================================================
// 样式：仅负责布局
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
});
