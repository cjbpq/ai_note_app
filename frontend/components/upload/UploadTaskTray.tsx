/**
 * UploadTaskTray - 上传任务托盘组件
 *
 * 展示在首页底部，显示当前所有上传任务的列表。
 * 无任务时自动隐藏，不占用空间。
 *
 * 布局：
 * ┌──────────────────────────────────────┐
 * │ 任务队列 (N)          [清除已完成]    │
 * ├──────────────────────────────────────┤
 * │ [缩略图] AI正在生成...        ⟳     │
 * │ [缩略图] 笔记已生成：xxx      ✓     │
 * └──────────────────────────────────────┘
 *
 * 最多可见展示 3 项，超出部分可滚动。
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TouchableRipple, useTheme } from "react-native-paper";

import { UploadTask } from "../../types";
import { UploadTaskItem } from "./UploadTaskItem";

/** 托盘最大可见任务数（超出可滚动） */
const MAX_VISIBLE_ITEMS = 3;
/** 每项高度约 64px */
const ITEM_HEIGHT = 64;

interface UploadTaskTrayProps {
  /** 任务列表 */
  tasks: UploadTask[];
  /** 重试失败任务 */
  onRetry: (taskId: string) => void;
  /** 删除单个任务 */
  onRemove: (taskId: string) => void;
  /** 标记任务为已读 */
  onMarkAsRead: (taskId: string) => void;
  /** 清除所有已完成/失败的任务 */
  onClearFinished: () => void;
}

export const UploadTaskTray: React.FC<UploadTaskTrayProps> = ({
  tasks,
  onRetry,
  onRemove,
  onMarkAsRead,
  onClearFinished,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 无任务时不渲染
  if (tasks.length === 0) {
    return null;
  }

  // 是否有已完成或失败的任务（决定是否显示"清除"按钮）
  const hasFinished = tasks.some(
    (task) => task.status === "completed" || task.status === "failed",
  );

  // 计算滚动容器最大高度
  const maxHeight = Math.min(tasks.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {/* 标题栏 */}
      <View style={styles.header}>
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("upload.task.trayTitle")} ({tasks.length})
        </Text>
        {hasFinished && (
          <TouchableRipple
            onPress={onClearFinished}
            borderless
            style={styles.clearButton}
          >
            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
              {t("upload.task.clearFinished")}
            </Text>
          </TouchableRipple>
        )}
      </View>

      {/* 任务列表 */}
      <ScrollView
        style={{ maxHeight }}
        showsVerticalScrollIndicator={tasks.length > MAX_VISIBLE_ITEMS}
        nestedScrollEnabled
      >
        {tasks.map((task) => (
          <UploadTaskItem
            key={task.id}
            task={task}
            onRetry={onRetry}
            onRemove={onRemove}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
});

export default UploadTaskTray;
