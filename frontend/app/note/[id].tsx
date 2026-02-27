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
import { IconButton, Text, useTheme } from "react-native-paper";
import { ErrorScreen } from "../../components/common";

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
import { useNetworkStore } from "../../store/useNetworkStore";
import type { NoteEditFormData } from "../../store/useNoteEditStore";
import { useNoteEditStore } from "../../store/useNoteEditStore";
import { useUploadTaskStore } from "../../store/useUploadTaskStore";
import { ServiceError } from "../../types";
import { toSafeStringArray } from "../../utils/safeData";

/**
 * 笔记详情页面组件
 */
export default function NoteDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  /**
   * 从 Note 数据构建编辑表单初始数据
   * 统一提取结构化字段，避免在多处重复构造
   */
  const buildInitialFormData = useCallback(
    (n: typeof note): NoteEditFormData => ({
      title: n?.title ?? "",
      category: n?.category ?? "",
      tags: toSafeStringArray(n?.tags),
      summary: n?.structuredData?.summary ?? "",
      keyPoints: toSafeStringArray(n?.structuredData?.keyPoints),
      content: "",
    }),
    [],
  );

  // ===== 路由参数 =====
  const { id } = useLocalSearchParams<{ id: string }>();

  // ===== 标记新笔记为已查看（驱动阅读 Tab 角标减少） =====
  const markNoteViewed = useUploadTaskStore((s) => s.markNoteViewed);
  useEffect(() => {
    if (id) {
      markNoteViewed(id);
    }
  }, [id, markNoteViewed]);

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
  const {
    data: note,
    isLoading,
    isError,
    error,
    refetch,
  } = useNote(id ?? null);

  // ===== 离线 & 缓存完整性检测 =====
  const isOnline = useNetworkStore((s) => s.isOnline);

  /**
   * 判断当前笔记是否为"未完整缓存"状态：
   * - 离线时，如果笔记没有 structuredData 且 content 为空，
   *   说明本地缓存只有列表级数据（标题/首图/标签），缺少详情内容。
   * - 在线时不影响（会自动从 API 获取完整数据）。
   */
  const isPartialCache =
    !isOnline &&
    !!note &&
    !note.structuredData &&
    (!note.content || note.content.trim().length === 0);

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
              cancelEditing(buildInitialFormData(note));
            }
          },
        },
      ]);
    } else {
      router.back();
    }
  }, [isEditing, note, cancelEditing, buildInitialFormData, router, t]);

  // ===== 事件处理：进入编辑模式（含草稿恢复检查） =====
  const handleEdit = useCallback(async () => {
    if (!id || !note) return;

    const initialData = buildInitialFormData(note);

    // 检查是否有草稿
    const draft = await checkDraft(id);
    if (draft) {
      const savedTime = new Date(draft.savedAt).toLocaleString();

      Alert.alert(
        t("noteDetail.draft_found_title"),
        t("noteDetail.draft_found_message", { time: savedTime }),
        [
          {
            text: t("noteDetail.draft_discard"),
            style: "destructive",
            onPress: () => {
              clearDraft(id);
              startEditing(id, initialData);
            },
          },
          {
            text: t("noteDetail.draft_restore"),
            onPress: () => {
              restoreFromDraft(id, draft);
            },
          },
        ],
      );
    } else {
      startEditing(id, initialData);
    }
  }, [
    id,
    note,
    buildInitialFormData,
    checkDraft,
    clearDraft,
    startEditing,
    restoreFromDraft,
    t,
  ]);

  // ===== 事件处理：取消编辑 =====
  const handleCancelEdit = useCallback(() => {
    if (note) {
      cancelEditing(buildInitialFormData(note));
    }
  }, [note, cancelEditing, buildInitialFormData]);

  // ===== 事件处理：保存编辑 =====
  const handleSave = useCallback(() => {
    if (!id || !note) return;

    // 构造更新数据：同时提交元数据 + 结构化字段
    const updatedStructuredData = note.structuredData
      ? {
          ...note.structuredData,
          summary: formData.summary,
          keyPoints: toSafeStringArray(formData.keyPoints),
        }
      : undefined;

    const safeTags = toSafeStringArray(formData.tags);

    updateNote(
      {
        id,
        title: formData.title,
        category: formData.category,
        tags: safeTags,
        structuredData: updatedStructuredData,
      },
      {
        onSuccess: () => {
          finishEditing();
          refetch();
          // 离线时提示"已保存到本地"，在线时提示普通成功
          showSuccess(
            isOnline
              ? t("toast.save_success")
              : t("toast.save_offline_success"),
          );
        },
        onError: () => {
          showError(t("toast.save_failed"));
        },
      },
    );
  }, [
    id,
    note,
    formData,
    updateNote,
    finishEditing,
    refetch,
    isOnline,
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
                onSuccess: () => {
                  // 防御：某些入口（深链/冷启动）可能无法 back，此时直接回到首页 Tab。
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace("/(tabs)");
                  }
                },
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
    const serviceError = error instanceof ServiceError ? error : undefined;
    const isNotFound = serviceError?.statusCode === 404;
    const isForbidden = serviceError?.statusCode === 403;

    const errorTitle = isNotFound
      ? t("error.note.notFound")
      : isForbidden
        ? t("error.note.forbidden")
        : t("error.note.loadFailed");

    const errorMessage =
      serviceError?.message ??
      (isNotFound ? t("error.note.deletedHint") : t("error.common.unknown"));

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
          <ErrorScreen
            title={errorTitle}
            message={errorMessage}
            onRetry={isNotFound ? undefined : () => void refetch()}
            onBack={handleBack}
            iconName={
              isNotFound ? "document-text-outline" : "alert-circle-outline"
            }
          />
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
                  disabled={isTogglingFavorite || isPartialCache}
                />
                <IconButton
                  icon="pencil-outline"
                  iconColor={theme.colors.primary}
                  onPress={handleEdit}
                  disabled={isPartialCache}
                />
                <IconButton
                  icon="delete-outline"
                  iconColor={theme.colors.error}
                  onPress={handleDelete}
                  disabled={isDeleting || isPartialCache}
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
        {/* 离线缓存不完整提示条 */}
        {isPartialCache && (
          <View
            style={[
              styles.partialCacheBanner,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <IconButton
              icon="cloud-off-outline"
              size={18}
              iconColor={theme.colors.onSecondaryContainer}
              style={styles.partialCacheIcon}
            />
            <Text
              variant="bodySmall"
              style={[
                styles.partialCacheText,
                { color: theme.colors.onSecondaryContainer },
              ]}
            >
              {t("noteDetail.offline_partial_cache")}
            </Text>
          </View>
        )}

        {/* 编辑模式：隐藏图片，最大化输入空间 */}
        {!isEditing && <NoteImage imageUrls={note.imageUrls ?? []} />}

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
  headerRightContainer: {
    flexDirection: "row",
  },
  partialCacheBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  partialCacheIcon: {
    margin: 0,
    marginRight: 4,
  },
  partialCacheText: {
    flex: 1,
  },
});
