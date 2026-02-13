/**
 * 笔记列表页面
 * 展示所有笔记卡片，点击卡片导航到详情页
 */
import { Href, useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import NoteCard from "../../components/note-card";
import { useNotes } from "../../hooks/useNotes";

export default function ReadScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 使用 Hook 获取笔记列表
  const { notes, isLoading, isError } = useNotes();

  /**
   * 处理笔记卡片点击
   * 导航到笔记详情页面
   */
  const handleNotePress = (noteId: string) => {
    router.push(`/note/${noteId}` as Href);
  };

  // 内容区渲染：保持 Appbar 一直可见（loading/error/empty 也保留顶部栏）
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
    if (!notes || notes.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("noteDetail.no_content")}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        style={styles.list}
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <NoteCard
            title={item.title}
            // content={item.content}
            date={item.date}
            tags={item.tags}
            imageUrl={item.imageUrl}
            isFavorite={item.isFavorite}
            onPress={() => handleNotePress(item.id)}
          />
        )}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      // 仅处理底部安全区：顶部由 Appbar.Header 的 statusBarHeight 处理，避免“重复留白”
      edges={["bottom"]}
    >
      {/*
        MVP 决策：阅读页使用页面内 Appbar（而非顶层 Header），为后续搜索功能预留入口。
        注意：这里只做 UI 占位，不绑定具体搜索逻辑（待与后端/产品确认交互方案后再落地）。
      */}
      <Appbar.Header statusBarHeight={insets.top}>
        <Appbar.Content title={t("tab.read")} />
        <Appbar.Action
          icon="magnify"
          accessibilityLabel={t("common.search")}
          onPress={() => {
            // TODO: Phase 2 - 搜索功能 UI/交互方案确认后实现
          }}
        />
      </Appbar.Header>

      <View style={styles.container}>{renderContent()}</View>
    </SafeAreaView>
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
