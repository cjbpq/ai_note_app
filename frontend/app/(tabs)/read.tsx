/**
 * 笔记列表页面
 * 展示所有笔记卡片，点击卡片导航到详情页
 */
import { Href, useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import NoteCard from "../../components/note-card";
import { useNotes } from "../../hooks/useNotes";

export default function ReadScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // 使用 Hook 获取笔记列表
  const { notes, isLoading, isError } = useNotes();

  /**
   * 处理笔记卡片点击
   * 导航到笔记详情页面
   */
  const handleNotePress = (noteId: string) => {
    router.push(`/note/${noteId}` as Href);
  };

  // 加载中状态
  if (isLoading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text variant="bodyLarge" style={{ color: theme.colors.error }}>
          {t("common.error")}
        </Text>
      </View>
    );
  }

  // 空列表状态
  if (!notes || notes.length === 0) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
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
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <NoteCard
            title={item.title}
            content={item.content}
            date={item.date}
            tags={item.tags}
            imageUrl={item.imageUrl}
            onPress={() => handleNotePress(item.id)}
          />
        )}
      />
    </View>
  );
}

// ========== 样式定义 ==========
// StyleSheet 仅负责布局，颜色使用 theme 动态获取
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingVertical: 10,
  },
});
