/**
 * 笔记详情页面
 * 使用动态路由 [id] 获取笔记 ID，展示完整的笔记内容
 * 支持 Markdown 渲染和编辑功能
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import {
  Button,
  Chip,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useNotes } from "../../hooks/useNotes";

// 获取屏幕宽度，用于图片自适应
const { width: SCREEN_WIDTH } = Dimensions.get("window");
// 图片容器的水平内边距
const IMAGE_HORIZONTAL_PADDING = 32;
// 计算图片最大宽度
const IMAGE_MAX_WIDTH = SCREEN_WIDTH - IMAGE_HORIZONTAL_PADDING;

export default function NoteDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // 从路由参数中获取笔记 ID
  const { id } = useLocalSearchParams<{ id: string }>();

  // 使用 Hook 获取单条笔记数据和操作方法
  const { useNote, deleteNote, isDeleting, updateNote, isUpdating } =
    useNotes();
  const { data: note, isLoading, isError, refetch } = useNote(id ?? null);

  // ========== 编辑模式状态 ==========
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");

  // 图片加载状态
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // 当笔记数据加载完成后，初始化编辑表单
  useEffect(() => {
    if (note) {
      setEditTitle(note.title || "");
      setEditContent(note.content || "");
      setEditTags(note.tags?.join(", ") || "");
    }
  }, [note]);

  /**
   * Markdown 渲染样式配置
   * 使用 theme 颜色确保主题一致性
   */
  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: theme.colors.onSurface,
          fontSize: 16,
          lineHeight: 24,
        },
        heading1: {
          color: theme.colors.onSurface,
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 8,
          marginTop: 16,
        },
        heading2: {
          color: theme.colors.onSurface,
          fontSize: 20,
          fontWeight: "bold",
          marginBottom: 6,
          marginTop: 12,
        },
        heading3: {
          color: theme.colors.onSurface,
          fontSize: 18,
          fontWeight: "600",
          marginBottom: 4,
          marginTop: 10,
        },
        paragraph: {
          marginBottom: 10,
        },
        code_inline: {
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.primary,
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: 4,
          fontFamily: "monospace",
        },
        code_block: {
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurfaceVariant,
          padding: 12,
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 14,
        },
        fence: {
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurfaceVariant,
          padding: 12,
          borderRadius: 8,
          fontFamily: "monospace",
          fontSize: 14,
        },
        blockquote: {
          backgroundColor: theme.colors.surfaceVariant,
          borderLeftColor: theme.colors.primary,
          borderLeftWidth: 4,
          paddingLeft: 12,
          paddingVertical: 8,
          marginVertical: 8,
        },
        list_item: {
          marginBottom: 4,
        },
        bullet_list: {
          marginBottom: 10,
        },
        ordered_list: {
          marginBottom: 10,
        },
        link: {
          color: theme.colors.primary,
        },
        strong: {
          fontWeight: "bold",
        },
        em: {
          fontStyle: "italic",
        },
      }),
    [theme],
  );

  /**
   * 处理返回操作
   */
  const handleBack = useCallback(() => {
    if (isEditing) {
      // 如果正在编辑，询问是否放弃更改
      Alert.alert(t("noteDetail.cancel_edit"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("noteDetail.cancel_edit"),
          style: "destructive",
          onPress: () => {
            setIsEditing(false);
            // 重置表单数据
            if (note) {
              setEditTitle(note.title || "");
              setEditContent(note.content || "");
              setEditTags(note.tags?.join(", ") || "");
            }
          },
        },
      ]);
    } else {
      router.back();
    }
  }, [isEditing, note, router, t]);

  /**
   * 进入编辑模式
   */
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  /**
   * 取消编辑
   */
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    // 重置表单数据
    if (note) {
      setEditTitle(note.title || "");
      setEditContent(note.content || "");
      setEditTags(note.tags?.join(", ") || "");
    }
  }, [note]);

  /**
   * 保存编辑
   */
  const handleSave = useCallback(() => {
    if (!id) return;

    Keyboard.dismiss();

    // 将逗号分隔的标签字符串转为数组
    const tagsArray = editTags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    updateNote(
      {
        id,
        title: editTitle,
        content: editContent,
        tags: tagsArray,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          // 刷新数据
          refetch();
          Alert.alert(t("noteDetail.save_success"));
        },
        onError: () => {
          Alert.alert(t("common.error"), t("noteDetail.save_failed"));
        },
      },
    );
  }, [editContent, editTags, editTitle, id, refetch, t, updateNote]);

  /**
   * 处理删除操作
   * 显示确认弹窗，确认后执行删除并返回列表
   */
  const handleDelete = useCallback(() => {
    Alert.alert(
      t("noteDetail.delete_confirm_title"),
      t("noteDetail.delete_confirm_message"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("noteDetail.delete_button"),
          style: "destructive",
          onPress: () => {
            if (id) {
              deleteNote(id, {
                onSuccess: () => {
                  // 删除成功后返回列表页
                  router.back();
                },
              });
            }
          },
        },
      ],
    );
  }, [deleteNote, id, router, t]);

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
        {/* 图片区域 - 如果有图片则显示 */}
        {note.imageUrl && !imageError && (
          <Surface style={styles.imageContainer} elevation={1}>
            {imageLoading && (
              <View style={styles.imagePlaceholder}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
            <Image
              source={{ uri: note.imageUrl }}
              style={[
                styles.noteImage,
                imageLoading && styles.imageHidden, // 加载时隐藏图片
              ]}
              contentFit="contain"
              transition={300}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              accessibilityLabel={t("noteDetail.image_alt")}
            />
          </Surface>
        )}

        {/* 图片加载失败的占位提示 */}
        {note.imageUrl && imageError && (
          <Surface
            style={[
              styles.imageErrorContainer,
              { backgroundColor: theme.colors.errorContainer },
            ]}
            elevation={0}
          >
            <Ionicons
              name="image-outline"
              size={40}
              color={theme.colors.onErrorContainer}
            />
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onErrorContainer }}
            >
              {t("common.error")}
            </Text>
          </Surface>
        )}

        {/* ========== 编辑模式 ========== */}
        {isEditing ? (
          <View style={styles.editContainer}>
            {/* 标题输入 */}
            <TextInput
              label={t("noteDetail.edit_title_placeholder")}
              value={editTitle}
              onChangeText={setEditTitle}
              mode="outlined"
              style={styles.editInput}
            />

            {/* 标签输入 */}
            <TextInput
              label={t("noteDetail.edit_tags_placeholder")}
              value={editTags}
              onChangeText={setEditTags}
              mode="outlined"
              style={styles.editInput}
            />

            {/* 内容输入 */}
            <TextInput
              label={t("noteDetail.edit_content_placeholder")}
              value={editContent}
              onChangeText={setEditContent}
              mode="outlined"
              multiline
              numberOfLines={15}
              style={[styles.editInput, styles.contentInput]}
            />

            {/* 保存按钮 */}
            <Button
              mode="contained"
              onPress={handleSave}
              loading={isUpdating}
              disabled={isUpdating}
              style={styles.saveButton}
            >
              {t("noteDetail.save_button")}
            </Button>
          </View>
        ) : (
          /* ========== 查看模式 ========== */
          <>
            {/* 标题区域 */}
            <Surface style={styles.headerSection} elevation={0}>
              <Text
                variant="headlineMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {note.title}
              </Text>

              {/* 创建时间 */}
              {note.date && (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={theme.colors.outline}
                  />
                  <Text
                    variant="bodySmall"
                    style={[styles.dateText, { color: theme.colors.outline }]}
                  >
                    {t("noteDetail.created_at")}: {note.date}
                  </Text>
                </View>
              )}
            </Surface>

            <Divider style={styles.divider} />

            {/* 标签区域 */}
            {note.tags && note.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text
                  variant="labelMedium"
                  style={[
                    styles.sectionLabel,
                    { color: theme.colors.secondary },
                  ]}
                >
                  {t("noteDetail.tags_label")}
                </Text>
                <View style={styles.tagsWrap}>
                  {note.tags.map((tag) => (
                    <Chip
                      key={tag}
                      style={[
                        styles.tag,
                        { backgroundColor: theme.colors.secondaryContainer },
                      ]}
                      textStyle={{ color: theme.colors.onSecondaryContainer }}
                      compact
                    >
                      {tag}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* 正文内容区域 - 使用 Markdown 渲染 */}
            <Surface
              style={[
                styles.contentSection,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              elevation={0}
            >
              {note.content ? (
                <Markdown style={markdownStyles}>{note.content}</Markdown>
              ) : (
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("noteDetail.no_content")}
                </Text>
              )}
            </Surface>
          </>
        )}
      </ScrollView>
    </>
  );
}

// ========== 样式定义 ==========
// StyleSheet 仅负责布局 (Layout): Margin, Padding, Flex, Size
// 颜色使用 theme 动态获取
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
  // 图片相关样式
  imageContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: 200,
  },
  noteImage: {
    width: IMAGE_MAX_WIDTH,
    height: 300, // 默认高度，contentFit="contain" 会自适应
  },
  imageHidden: {
    opacity: 0,
  },
  imageErrorContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  // 标题区域样式
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  dateText: {
    marginLeft: 6,
  },
  divider: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  // 标签区域样式
  tagsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    marginRight: 4,
  },
  // 正文内容样式
  contentSection: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  contentText: {
    lineHeight: 24,
  },
  // 头部右侧按钮容器
  headerRightContainer: {
    flexDirection: "row",
  },
  // 编辑模式样式
  editContainer: {
    padding: 16,
  },
  editInput: {
    marginBottom: 16,
  },
  contentInput: {
    minHeight: 200,
  },
  saveButton: {
    marginTop: 8,
  },
});
