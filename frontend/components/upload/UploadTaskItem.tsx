/**
 * UploadTaskItem - 单个上传任务项组件
 *
 * 展示单个上传任务的状态：缩略图、状态文字、操作按钮。
 * 作为 UploadTaskTray 的子组件使用。
 *
 * 状态 → UI 映射：
 * - queued / uploading → 旋转指示器 + "上传中..."
 * - processing → 旋转指示器 + "AI正在生成笔记..."
 * - completed → 绿色 ✓ + "笔记已生成：{标题}"（点击跳转详情）
 * - failed → 红色 ✗ + "生成失败" + 重试按钮
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

import { APP_CONFIG, ROUTES } from "../../constants/config";
import { UploadTask } from "../../types";

interface UploadTaskItemProps {
  task: UploadTask;
  onRetry: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onMarkAsRead: (taskId: string) => void;
}

export const UploadTaskItem: React.FC<UploadTaskItemProps> = ({
  task,
  onRetry,
  onRemove,
  onMarkAsRead,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  // ===== 是否处于活跃状态（有动画指示器） =====
  const isActive =
    task.status === "queued" ||
    task.status === "uploading" ||
    task.status === "processing";
  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";

  // ===== 状态文字 =====
  const getStatusText = (): string => {
    switch (task.status) {
      case "queued":
      case "uploading":
        return t("upload.task.uploading");
      case "processing":
        return t("upload.task.processing");
      case "completed":
        return task.noteTitle
          ? t("upload.task.noteReady", { title: task.noteTitle })
          : t("upload.task.completed");
      case "failed":
        return task.error ?? t("upload.task.failed");
      default:
        return "";
    }
  };

  // ===== 缩略图 URI：优先使用后端返回的 fileUrl，兜底用本地 imageUri =====
  const thumbnailUri = task.fileUrl ?? task.imageUri;

  // ===== 点击任务项的行为 =====
  const handlePress = () => {
    if (isCompleted && task.noteId) {
      onMarkAsRead(task.id);
      router.push(`${ROUTES.NOTE_DETAIL}/${task.noteId}` as never);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.colors.elevation.level2 },
      ]}
      onPress={handlePress}
      activeOpacity={isCompleted ? APP_CONFIG.ACTIVE_OPACITY : 1}
      disabled={!isCompleted}
    >
      {/* 左侧：缩略图 */}
      <View
        style={[
          styles.thumbnailWrapper,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {thumbnailUri && !imageError ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        ) : (
          <Ionicons
            name="image-outline"
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        )}
      </View>

      {/* 中间：状态文字 */}
      <View style={styles.infoContainer}>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{
            color: isFailed
              ? theme.colors.error
              : isCompleted
                ? theme.colors.primary
                : theme.colors.onSurface,
            fontWeight: isCompleted || isFailed ? "600" : "400",
          }}
        >
          {getStatusText()}
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
        >
          {t("upload.task.justNow")}
        </Text>
      </View>

      {/* 右侧：状态图标/操作按钮 */}
      <View style={styles.actionContainer}>
        {isActive && (
          <ActivityIndicator size={18} color={theme.colors.primary} />
        )}
        {isCompleted && (
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={theme.colors.primary}
          />
        )}
        {isFailed && (
          <View style={styles.failedActions}>
            <TouchableOpacity
              onPress={() => onRetry(task.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onRemove(task.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 12 }}
            >
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={theme.colors.error}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  thumbnailWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  actionContainer: {
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  failedActions: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default UploadTaskItem;
