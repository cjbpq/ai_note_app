import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useImagePicker } from "../../hooks/useImagePicker";
import { useNotes } from "../../hooks/useNotes";
import { useScanNotes } from "../../hooks/useScanNotes";
import { useScanStore } from "../../store/useScanStore";

/**
 * HomeScreen - 首页（拍照/上传界面）
 *
 * 数据流向说明：
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 1. 用户选择图片 → pickedImageUri 存入 ScanStore                         │
 * │ 2. 点击上传按钮 → useScanNotes.scanImage() 上传到后端                   │
 * │ 3. 后端处理完成 → 返回 noteId → Modal 显示结果                          │
 * │ 4. 点击保存按钮 → confirmAndSave(note) → 同步到本地 SQLite → 刷新列表   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { height } = useWindowDimensions();

  // =========================================================================
  // 1. Hook 与状态管理
  // =========================================================================
  const { pickedImageUri } = useScanStore();
  const { pickImage, clearImage, takePhoto } = useImagePicker();

  // useScanNotes: 管理扫描流程的核心 Hook
  const {
    scanImage,
    confirmAndSave, // 新增：确认保存方法
    isScanning,
    scanStep,
    scannedNoteId,
    resetScan,
    isSaving, // 新增：保存中状态
  } = useScanNotes();

  // =========================================================================
  // 2. 获取扫描结果 - 通过 Hook 获取数据
  // =========================================================================
  const { useNote } = useNotes();
  const { data: resultNote, isLoading: isFetchingResult } =
    useNote(scannedNoteId);

  const summaryText = resultNote?.structuredData?.summary ?? "";
  const modalContentMaxHeight = Math.max(220, Math.floor(height * 0.4));

  // =========================================================================
  // 3. 核心操作：触发上传
  // =========================================================================
  const handleUpload = () => {
    if (!pickedImageUri) return;
    scanImage(pickedImageUri);
  };

  // =========================================================================
  // 4. 保存笔记 - 关键逻辑
  // =========================================================================
  const handleSaveNote = () => {
    if (!resultNote) return;

    // 调用 Hook 的 confirmAndSave 方法：
    // - 将笔记同步到本地 SQLite 缓存
    // - 刷新笔记列表 (invalidateQueries)
    // - 重置扫描状态并关闭 Modal
    confirmAndSave(resultNote);
    clearImage(); // 清除选中的图片
  };

  // =========================================================================
  // 5. 取消/关闭 - 不保存直接关闭
  // =========================================================================
  const handleCancel = () => {
    clearImage(); // 清除本地选图
    resetScan(); // 重置 Store 状态 (不触发保存)
  };

  // 计算 Modal 是否可见：只有当有 noteId 时才尝试显示
  const isModalVisible = !!scannedNoteId;

  return (
    <SafeAreaView
      // 使用安全区，避免 Header 移除后内容顶到状态栏/刘海
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
          {/* Loading 状态遮罩 */}
          {isScanning ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" animating={true} />
              <Text style={{ marginTop: 20, color: theme.colors.primary }}>
                {scanStep === "uploading"
                  ? t("home.step_uploading")
                  : t("home.step_processing")}
              </Text>
            </View>
          ) : pickedImageUri ? (
            // 状态 B: 已选图预览
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: pickedImageUri }}
                style={[
                  styles.previewImage,
                  { borderColor: theme.colors.outline },
                ]}
              />
              <View style={styles.previewActions}>
                <Button
                  mode="text"
                  onPress={clearImage}
                  textColor={theme.colors.error}
                  disabled={isScanning}
                >
                  {t("home.repick_button")}
                </Button>
              </View>
            </View>
          ) : (
            // 状态 A: 拍照主按钮 + 相册次级入口
            <View style={styles.pickContainer}>
              {/* 主按钮：拍照 */}
              <TouchableOpacity
                style={[
                  styles.cameraButton,
                  {
                    backgroundColor: theme.colors.primaryContainer,
                    borderColor: theme.colors.primary,
                    // iOS 阴影颜色使用主题色（避免硬编码 #000）
                    shadowColor: theme.colors.shadow,
                  },
                ]}
                onPress={takePhoto}
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
                onPress={pickImage}
                style={styles.albumButton}
                labelStyle={{ fontSize: 14 }}
              >
                {t("home.pick_from_album")}
              </Button>
            </View>
          )}
        </View>

        {/* 底部操作区 */}
        <View style={styles.footer}>
          {pickedImageUri && !isScanning && !scannedNoteId && (
            <Button
              mode="contained"
              onPress={handleUpload}
              style={styles.uploadButton}
              contentStyle={{ paddingVertical: 8 }}
              icon="cloud-upload"
            >
              {t("home.upload_button")}
            </Button>
          )}
        </View>

        {/* 结果展示卡片：使用 Portal + Modal */}
        <Portal>
          <Modal
            visible={isModalVisible}
            onDismiss={handleCancel}
            dismissable={false}
            contentContainerStyle={[
              styles.modalContainer,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {isFetchingResult || !resultNote ? (
              // 正在加载笔记详情
              <View style={{ alignItems: "center", padding: 20 }}>
                <ActivityIndicator animating={true} />
                <Text style={{ marginTop: 10 }}>
                  {t("home.loading_result")}
                </Text>
              </View>
            ) : (
              // 显示识别结果
              <>
                <Text variant="headlineSmall" style={{ marginBottom: 16 }}>
                  {t("home.result_title")}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginBottom: 8,
                  }}
                >
                  {t("home.result_hint")}
                </Text>
                <Card mode="outlined">
                  <Card.Title
                    title={resultNote.title}
                    titleVariant="titleMedium"
                  />
                  <Card.Content>
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.colors.primary, marginBottom: 6 }}
                    >
                      {t("home.result_summary_title")}
                    </Text>
                    {/* 限制预览高度，避免内容过长导致操作按钮不可见 */}
                    <ScrollView
                      style={[
                        styles.resultContent,
                        { maxHeight: modalContentMaxHeight },
                      ]}
                      showsVerticalScrollIndicator={true}
                    >
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface }}
                      >
                        {summaryText || t("home.result_no_summary")}
                      </Text>
                    </ScrollView>
                  </Card.Content>
                </Card>

                {/* 操作按钮区 */}
                <View style={styles.modalActions}>
                  <Button
                    mode="contained"
                    onPress={handleSaveNote}
                    style={styles.saveButton}
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    {t("home.save_button")}
                  </Button>
                </View>
              </>
            )}
          </Modal>
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
    // 顶层 Header 移除后，减少额外顶部空白
    marginTop: 12,
    alignItems: "center",
  },
  actionContainer: {
    flex: 1,
    justifyContent: "center", // 垂直居中
    alignItems: "center", // 水平居中
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    width: 200,
    height: 200,
    borderRadius: 100, // 圆形
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed", // 虚线边框增加设计感
    elevation: 4, // Android 投影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  // 拍照 + 相册选择的整体容器
  pickContainer: {
    alignItems: "center",
  },
  // "从相册选择" 次级按钮，放在主圆形按钮下方
  albumButton: {
    marginTop: 20,
  },
  previewContainer: {
    alignItems: "center",
    width: "100%",
  },
  previewImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewActions: {
    flexDirection: "row",
    gap: 16,
  },
  footer: {
    marginBottom: 20,
    height: 60, // 占位防止跳动
  },
  uploadButton: {
    borderRadius: 30, // 圆角按钮
  },
  modalContainer: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  resultContent: {
    paddingBottom: 4,
  },
  // 新增：Modal 内的按钮区样式
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  saveButton: {
    flex: 1,
  },
});
