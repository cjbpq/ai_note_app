import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { useImagePicker } from "../../hooks/useImagePicker";
import { useNotes } from "../../hooks/useNotes";
import { useScanNotes } from "../../hooks/useScanNotes";
import { useScanStore } from "../../store/useScanStore";

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  // 1. Hook与状态管理
  const { pickedImageUri } = useScanStore();
  const { pickImage, clearImage } = useImagePicker();
  const { scanImage, isScanning, scanStep, scannedNoteId, resetScan } =
    useScanNotes();

  // 2. 获取扫描结果
  // 通过 Hook 获取数据，不再直接调用 Service
  const { useNote } = useNotes();
  const { data: resultNote, isLoading: isFetchingResult } =
    useNote(scannedNoteId);

  // 3. 核心操作：触发上传
  const handleUpload = () => {
    if (!pickedImageUri) return;
    scanImage(pickedImageUri);
  };

  // 4. 重置流程 (保存/关闭结果卡片)
  const handleCloseResult = () => {
    clearImage(); // 清除本地选图
    resetScan(); // 重置 Store 状态
    // resultNote 会因为 scannedNoteId 变为空而自动重置
  };

  // 计算 Modal 是否可见：只有当有 noteId 时才尝试显示
  // 如果正在获取结果 (isFetchingResult)，Modal 内容会显示 Loading
  const isModalVisible = !!scannedNoteId;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* 标题区域 */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
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
          // 状态 A: 巨大的拍照按钮
          <TouchableOpacity
            style={[
              styles.cameraButton,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
            ]}
            onPress={pickImage}
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
              {t("home.pick_image")}
            </Text>
          </TouchableOpacity>
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
          onDismiss={handleCloseResult}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          {isFetchingResult || !resultNote ? (
            <View style={{ alignItems: "center", padding: 20 }}>
              <ActivityIndicator animating={true} />
              <Text style={{ marginTop: 10 }}>Loading result...</Text>
            </View>
          ) : (
            <>
              <Text variant="headlineSmall" style={{ marginBottom: 16 }}>
                {t("home.result_title")}
              </Text>
              <Card mode="outlined">
                <Card.Content>
                  <Text variant="titleMedium">{resultNote.title}</Text>
                  <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                    {resultNote.content}
                  </Text>
                </Card.Content>
              </Card>
              <Button
                mode="contained"
                onPress={handleCloseResult}
                style={{ marginTop: 20 }}
              >
                {t("home.save_button")}
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 40,
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
    shadowColor: "#000", // iOS 投影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
});
