import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Dialog,
  IconButton,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryPicker, UploadTaskTray } from "../../components/upload";
import { useCategories } from "../../hooks/useCategories";
import { type ImagePickMode, useImagePicker } from "../../hooks/useImagePicker";
import { useToast } from "../../hooks/useToast";
import { useUploadTasks } from "../../hooks/useUploadTasks";
import { useNetworkStore } from "../../store/useNetworkStore";
import { useScanStore } from "../../store/useScanStore";

/**
 * HomeScreen - 首页（拍照/上传界面，支持多图）
 *
 * 数据流向说明（多图 + 多任务并发版）：
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ 1. 用户拍照/选图 → pickedImageUris[] 追加到 ScanStore                   │
 * │ 2. 点击上传 → useUploadTasks.submitTask(uris[])                         │
 * │    → 立即 clearImage() → 用户可继续选新一批图片                          │
 * │ 3. 后台独立轮询每个 job → 完成时自动 sync + 刷新列表 + Snackbar 通知      │
 * │ 4. 底部任务托盘 <UploadTaskTray> 实时展示各任务状态                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  // =========================================================================
  // 1. Hook 与状态管理
  // =========================================================================

  // 网络状态：离线时禁用上传工作流
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { showWarning } = useToast();

  const { pickedImageUris } = useScanStore();
  const {
    pickImage,
    pickImages,
    clearImage,
    takePhoto,
    removeImage,
    currentCount,
    maxCount,
    isAtLimit,
  } = useImagePicker();

  // ── 分类选择 Hook ──
  const {
    categories,
    isLoading: isCategoriesLoading,
    addLocalCategory,
  } = useCategories();
  // 当前选中的分类（null 表示使用默认分类）
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(
    null,
  );

  // "添加更多图片"来源选择弹层（拍照 / 相册多选 / 相册单选裁剪）
  const [isAddSourceDialogVisible, setIsAddSourceDialogVisible] =
    React.useState(false);
  // 初始空状态时的相册弹层（保留裁剪选项）
  const [isPickModeDialogVisible, setIsPickModeDialogVisible] =
    React.useState(false);

  const hasImages = pickedImageUris.length > 0;

  // useUploadTasks: 管理多任务并发上传的核心 Hook
  const {
    submitTask,
    retryTask,
    removeTask,
    markAsRead,
    clearFinished,
    tasks,
  } = useUploadTasks();

  // =========================================================================
  // 2. 核心操作：提交上传任务（本次选中的所有图片作为一个任务）
  // =========================================================================
  const handleUpload = () => {
    if (!hasImages) return;

    // Phase B: 离线时拦截上传，友好提示
    if (!isOnline) {
      showWarning(t("network.upload_blocked"));
      return;
    }

    // 提交多图任务（附带选中的分类）→ 立即清除图片 → 用户可继续选下一批
    submitTask(pickedImageUris, selectedCategory ?? undefined);
    clearImage();
    setSelectedCategory(null);
  };

  // =========================================================================
  // 3. 弹层控制
  // =========================================================================

  /**  添加更多来源弹层 */
  const openAddSourceDialog = () => setIsAddSourceDialogVisible(true);
  const closeAddSourceDialog = () => setIsAddSourceDialogVisible(false);

  /** 从添加弹层选择拍照 */
  const handleAddByCamera = async () => {
    closeAddSourceDialog();
    await takePhoto();
  };

  /** 从添加弹层选择相册多选（不裁剪） */
  const handleAddByAlbumMulti = async () => {
    closeAddSourceDialog();
    await pickImages();
  };

  /** 从添加弹层选择相册单选（可裁剪） */
  const handleAddByAlbumSingle = async () => {
    closeAddSourceDialog();
    await pickImage("crop");
  };

  /** 初始状态 - 相册模式选择弹层 */
  const openPickModeDialog = () => setIsPickModeDialogVisible(true);
  const closePickModeDialog = () => setIsPickModeDialogVisible(false);

  const handlePickWithMode = async (mode: ImagePickMode) => {
    closePickModeDialog();
    if (mode === "original") {
      // 原图 → 多选
      await pickImages();
    } else {
      // 裁剪 → 单选
      await pickImage(mode);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <View style={styles.container}>
        {/* 标题区域 */}
        <View style={styles.header}>
          <Text
            variant="headlineMedium"
            style={{ color: theme.colors.primary }}
          >
            {t("home.pick_title")}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
          >
            {t("home.pick_subtitle")}
          </Text>
        </View>

        {/* 核心交互区 */}
        <View style={styles.actionContainer}>
          {hasImages ? (
            // ─── 状态 B: 已选图预览网格 ───
            <View style={styles.previewSection}>
              {/* 已选计数 */}
              <Text
                variant="labelLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginBottom: 8,
                }}
              >
                {t("home.selected_count", {
                  current: currentCount,
                  max: maxCount,
                })}
              </Text>

              {/* 图片网格 + 分类选择器共享滚动区域 */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* 图片网格 */}
                <View style={styles.gridContainer}>
                  {pickedImageUris.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.gridItem}>
                      <Image
                        source={{ uri }}
                        style={[
                          styles.gridImage,
                          { borderColor: theme.colors.outline },
                        ]}
                      />
                      {/* 删除按钮 */}
                      <IconButton
                        icon="close-circle"
                        size={20}
                        iconColor={theme.colors.error}
                        style={styles.removeButton}
                        onPress={() => removeImage(index)}
                      />
                    </View>
                  ))}

                  {/* 添加更多按钮（未达上限时显示） */}
                  {!isAtLimit && (
                    <TouchableOpacity
                      style={[
                        styles.addMoreButton,
                        {
                          borderColor: theme.colors.outline,
                          backgroundColor: theme.colors.surfaceVariant,
                        },
                      ]}
                      onPress={openAddSourceDialog}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="add"
                        size={32}
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {t("home.add_more")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 分类选择器：放在滚动区域内避免展开时压缩预览图 */}
                <CategoryPicker
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelect={setSelectedCategory}
                  onCreateNew={addLocalCategory}
                  isLoading={isCategoriesLoading}
                />
              </ScrollView>

              {/* 操作栏：清空全部 */}
              <View style={styles.previewActions}>
                <Button
                  mode="text"
                  onPress={clearImage}
                  textColor={theme.colors.error}
                  compact
                >
                  {t("home.clear_all")}
                </Button>
              </View>
            </View>
          ) : (
            // ─── 状态 A: 拍照主按钮 + 相册次级入口 ───
            <View style={styles.pickContainer}>
              {/* 主按钮：拍照 */}
              <TouchableOpacity
                style={[
                  styles.cameraButton,
                  {
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.primary,
                    shadowColor: theme.colors.shadow,
                  },
                ]}
                onPress={() => takePhoto()}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="camera"
                  size={64}
                  color={theme.colors.onPrimaryContainer}
                />
                <Text
                  variant="titleMedium"
                  style={{
                    color: theme.colors.onPrimaryContainer,
                    marginTop: 16,
                    fontWeight: "bold",
                  }}
                >
                  {t("home.take_photo")}
                </Text>
              </TouchableOpacity>

              {/* 次级入口：从相册选择 */}
              <Button
                mode="text"
                icon="image-multiple"
                onPress={openPickModeDialog}
                style={styles.albumButton}
                labelStyle={{ fontSize: 14 }}
              >
                {t("home.pick_from_album")}
              </Button>
            </View>
          )}
        </View>

        {/* 底部区域：上传按钮 + 任务托盘 */}
        <View style={styles.footer}>
          {/* 上传按钮：仅在有已选图时显示 */}
          {hasImages && (
            <Button
              mode="contained"
              onPress={handleUpload}
              disabled={!isOnline}
              style={styles.uploadButton}
              contentStyle={{ paddingVertical: 8 }}
              icon={isOnline ? "cloud-upload" : "cloud-off-outline"}
            >
              {isOnline
                ? `${t("home.upload_button")}${currentCount > 1 ? ` (${currentCount})` : ""}`
                : t("network.upload_blocked_short")}
            </Button>
          )}

          {/* 任务托盘：显示所有上传任务的进度 */}
          <UploadTaskTray
            tasks={tasks}
            onRetry={retryTask}
            onRemove={removeTask}
            onMarkAsRead={markAsRead}
            onClearFinished={clearFinished}
          />
        </View>

        {/* ═══════ 弹层：添加更多图片来源 ═══════ */}
        <Portal>
          <Dialog
            visible={isAddSourceDialogVisible}
            onDismiss={closeAddSourceDialog}
          >
            <Dialog.Title>{t("home.add_source_title")}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">{t("home.add_source_subtitle")}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={closeAddSourceDialog}>
                {t("common.cancel")}
              </Button>
              <Button onPress={handleAddByCamera} icon="camera">
                {t("home.take_photo")}
              </Button>
              <Button onPress={handleAddByAlbumMulti} icon="image-multiple">
                {t("home.album_multi_select")}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* ═══════ 弹层：初始相册模式选择 ═══════ */}
        <Portal>
          <Dialog
            visible={isPickModeDialogVisible}
            onDismiss={closePickModeDialog}
          >
            <Dialog.Title>{t("home.pick_mode_title")}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">{t("home.pick_mode_subtitle")}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={closePickModeDialog}>
                {t("common.cancel")}
              </Button>
              <Button onPress={() => handlePickWithMode("original")}>
                {t("home.pick_mode_original")}
              </Button>
              <Button
                mode="contained"
                onPress={() => handlePickWithMode("crop")}
              >
                {t("home.pick_mode_free_crop")}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 12,
    alignItems: "center",
  },
  actionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // ─── 状态 A：初始选图 ───
  cameraButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pickContainer: {
    alignItems: "center",
  },
  albumButton: {
    marginTop: 20,
  },
  // ─── 状态 B：多图预览网格 ───
  previewSection: {
    flex: 1,
    width: "100%",
    marginTop: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 16,
  },
  gridItem: {
    position: "relative",
  },
  gridImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
  },
  removeButton: {
    position: "absolute",
    top: -8,
    right: -8,
    margin: 0,
  },
  addMoreButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  // ─── 底部 ───
  footer: {
    marginBottom: 12,
  },
  uploadButton: {
    borderRadius: 30,
    marginBottom: 12,
  },
});
