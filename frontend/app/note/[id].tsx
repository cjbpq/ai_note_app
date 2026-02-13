/**
 * 笔记详情页面
 *
 * 功能：
 * 1. 展示笔记详情（图片、元信息、正文内容）
 * 2. 支持编辑模式（标题、标签、内容）
 * 3. 支持删除笔记
 *
 * 架构说明：
 * - UI 层只负责组装子组件和处理导航
 * - 编辑状态通过 useNoteEditStore 管理
 * - 数据获取通过 useNotes Hook
 */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";

// ===== 组件导入 =====
import {
  NoteContent,
  NoteEditForm,
  NoteImage,
  NoteKeyPoints,
  NoteMetaInfo,
  NoteOriginalText,
  NoteSections,
  NoteStudyAdvice,
  NoteSummaryCard,
  NoteWarnings,
} from "../../components/note";

// ===== Hooks & Store =====
import { useNotes } from "../../hooks/useNotes";
import { useToast } from "../../hooks/useToast";
import { useNoteEditStore } from "../../store/useNoteEditStore";

/**
 * 笔记详情页面组件
 */
export default function NoteDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  // ===== 路由参数 =====
  const { id } = useLocalSearchParams<{ id: string }>();

  // ===== 数据层 Hook =====
  const {
    useNote,
    deleteNote,
    isDeleting,
    updateNote,
    isUpdating,
    toggleFavorite,
    isTogglingFavorite,
  } = useNotes();
  const { data: note, isLoading, isError, refetch } = useNote(id ?? null);

  // ===== 编辑状态 Store =====
  const {
    isEditing,
    startEditing,
    cancelEditing,
    finishEditing,
    saveDraftAndClear,
    checkDraft,
    restoreFromDraft,
    clearDraft,
    getTagsArray,
    formData,
  } = useNoteEditStore();

  // ===== 副作用：离开页面时保存草稿 =====
  useEffect(() => {
    return () => {
      // 组件卸载时保存草稿（如果有未保存更改）
      saveDraftAndClear();
    };
  }, [saveDraftAndClear]);

  // ===== 事件处理：返回 =====
  const handleBack = useCallback(() => {
    if (isEditing) {
      // 编辑中返回，询问是否放弃更改
      Alert.alert(t("noteDetail.cancel_edit"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("noteDetail.cancel_edit"),
          style: "destructive",
          onPress: () => {
            if (note) {
              cancelEditing({
                title: note.title || "",
                content: note.content || "",
                tags: note.tags?.join(", ") || "",
              });
            }
          },
        },
      ]);
    } else {
      router.back();
    }
  }, [isEditing, note, cancelEditing, router, t]);

  // ===== 事件处理：进入编辑模式（含草稿恢复检查） =====
  const handleEdit = useCallback(async () => {
    if (!id || !note) return;

    // 检查是否有草稿
    const draft = await checkDraft(id);
    if (draft) {
      // 格式化草稿保存时间
      const savedTime = new Date(draft.savedAt).toLocaleString();

      Alert.alert(
        t("noteDetail.draft_found_title"),
        t("noteDetail.draft_found_message", { time: savedTime }),
        [
          {
            text: t("noteDetail.draft_discard"),
            style: "destructive",
            onPress: () => {
              // 放弃草稿，使用当前笔记数据
              clearDraft(id);
              startEditing(id, {
                title: note.title || "",
                content: note.content || "",
                tags: note.tags?.join(", ") || "",
              });
            },
          },
          {
            text: t("noteDetail.draft_restore"),
            onPress: () => {
              // 恢复草稿
              restoreFromDraft(id, draft);
            },
          },
        ],
      );
    } else {
      // 无草稿，正常进入编辑
      startEditing(id, {
        title: note.title || "",
        content: note.content || "",
        tags: note.tags?.join(", ") || "",
      });
    }
  }, [id, note, checkDraft, clearDraft, startEditing, restoreFromDraft, t]);

  // ===== 事件处理：取消编辑 =====
  const handleCancelEdit = useCallback(() => {
    if (note) {
      cancelEditing({
        title: note.title || "",
        content: note.content || "",
        tags: note.tags?.join(", ") || "",
      });
    }
  }, [note, cancelEditing]);

  // ===== 事件处理：保存编辑 =====
  const handleSave = useCallback(() => {
    if (!id) return;

    updateNote(
      {
        id,
        title: formData.title,
        content: formData.content,
        tags: getTagsArray(),
      },
      {
        onSuccess: () => {
          finishEditing();
          refetch();
          // 使用 Toast 替代 Alert（保存成功不需要强制用户操作）
          showSuccess(t("toast.save_success"));
        },
        onError: () => {
          // 使用 Toast 替代 Alert（保存失败不需要强制用户操作）
          showError(t("toast.save_failed"));
        },
      },
    );
  }, [
    id,
    formData,
    getTagsArray,
    updateNote,
    finishEditing,
    refetch,
    t,
    showSuccess,
    showError,
  ]);

  // ===== 事件处理：删除笔记 =====
  const handleDelete = useCallback(() => {
    Alert.alert(
      t("noteDetail.delete_confirm_title"),
      t("noteDetail.delete_confirm_message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("noteDetail.delete_button"),
          style: "destructive",
          onPress: () => {
            if (id) {
              deleteNote(id, {
                onSuccess: () => router.back(),
              });
            }
          },
        },
      ],
    );
  }, [deleteNote, id, router, t]);

  // ===== 事件处理：收藏/取消收藏 =====
  const handleToggleFavorite = useCallback(() => {
    if (!id) return;
    toggleFavorite(id);
  }, [id, toggleFavorite]);

  // ========== 渲染状态处理 ==========

  // 加载中状态
  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t("noteDetail.loading"),
            headerLeft: () => (
              <IconButton icon="arrow-left" onPress={handleBack} />
            ),
          }}
        />
        <View
          style={[
            styles.centerContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyMedium"
            style={[styles.loadingText, { color: theme.colors.onSurface }]}
          >
            {t("noteDetail.loading")}
          </Text>
        </View>
      </>
    );
  }

  // 笔记不存在或加载错误
  if (isError || !note) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t("noteDetail.not_found"),
            headerLeft: () => (
              <IconButton icon="arrow-left" onPress={handleBack} />
            ),
          }}
        />
        <View
          style={[
            styles.centerContainer,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={64}
            color={theme.colors.outline}
          />
          <Text
            variant="titleMedium"
            style={[styles.notFoundText, { color: theme.colors.onSurface }]}
          >
            {t("noteDetail.not_found")}
          </Text>
          <Button mode="contained" onPress={handleBack} style={styles.backBtn}>
            {t("noteDetail.back_button")}
          </Button>
        </View>
      </>
    );
  }

  // ========== 正常渲染笔记详情 ==========
  return (
    <>
      {/* 配置 Stack 导航头部 */}
      <Stack.Screen
        options={{
          title: isEditing
            ? t("noteDetail.edit_button")
            : note.title || t("noteDetail.title"),
          headerLeft: () => (
            <IconButton
              icon={isEditing ? "close" : "arrow-left"}
              onPress={isEditing ? handleCancelEdit : handleBack}
            />
          ),
          headerRight: () =>
            isEditing ? (
              // 编辑模式：显示保存按钮
              <IconButton
                icon="check"
                iconColor={theme.colors.primary}
                onPress={handleSave}
                disabled={isUpdating}
              />
            ) : (
              // 查看模式：显示编辑和删除按钮
              <View style={styles.headerRightContainer}>
                <IconButton
                  icon={note.isFavorite ? "heart" : "heart-outline"}
                  iconColor={
                    note.isFavorite
                      ? theme.colors.error
                      : theme.colors.onSurface
                  }
                  onPress={handleToggleFavorite}
                  disabled={isTogglingFavorite}
                />
                <IconButton
                  icon="pencil-outline"
                  iconColor={theme.colors.primary}
                  onPress={handleEdit}
                />
                <IconButton
                  icon="delete-outline"
                  iconColor={theme.colors.error}
                  onPress={handleDelete}
                  disabled={isDeleting}
                />
              </View>
            ),
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* 图片区域 */}
        <NoteImage imageUrl={note.imageUrl} />

        {/* 编辑模式 vs 查看模式 */}
        {isEditing ? (
          <NoteEditForm onSave={handleSave} isSaving={isUpdating} />
        ) : (
          <>
            {/* 元信息：日期、标签、学科 */}
            <NoteMetaInfo
              date={note.date}
              tags={note.tags}
              subject={note.structuredData?.meta?.subject}
            />

            {/* 结构化内容 vs 纯文本兜底 */}
            {note.structuredData ? (
              <>
                {/* AI 摘要 */}
                <NoteSummaryCard summary={note.structuredData.summary} />

                {/* 知识要点 */}
                <NoteKeyPoints keyPoints={note.structuredData.keyPoints} />

                {/* 内容章节（可折叠） */}
                <NoteSections sections={note.structuredData.sections} />

                {/* 学习建议 */}
                <NoteStudyAdvice
                  studyAdvice={note.structuredData.studyAdvice}
                />

                {/* 原始识别文本（折叠查看） */}
                <NoteOriginalText rawText={note.structuredData.rawText} />

                {/* AI 处理警告 */}
                <NoteWarnings warnings={note.structuredData.meta?.warnings} />
              </>
            ) : (
              /* 无结构化数据时，使用旧版纯文本渲染 */
              <NoteContent title={note.title} content={note.content} />
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
  },
  notFoundText: {
    marginTop: 16,
    marginBottom: 24,
  },
  backBtn: {
    marginTop: 8,
  },
  headerRightContainer: {
    flexDirection: "row",
  },
});
