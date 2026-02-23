/**
 * 搜索历史列表组件
 *
 * 展示本地搜索历史记录（用户搜索并查看过的笔记标题）
 *
 * 交互：
 * - 点击词条 → 填入搜索框触发搜索
 * - 点击右侧 × → 删除该条记录
 * - 点击右上角「清空」→ 清空所有记录
 *
 * 长标题处理：numberOfLines=1 + 省略号截断
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface SearchHistoryProps {
  /** 历史记录列表 */
  history: string[];
  /** 点击词条回调（填入搜索框） */
  onPress: (title: string) => void;
  /** 删除单条记录 */
  onRemove: (title: string) => void;
  /** 清空所有记录 */
  onClearAll: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onPress,
  onRemove,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 没有历史记录时不渲染
  if (!history?.length) return null;

  return (
    <View style={styles.container}>
      {/* ── 标题行：搜索历史 + 清空按钮 ─────── */}
      <View style={styles.headerRow}>
        <Text
          variant="bodySmall"
          style={[styles.sectionTitle, { color: theme.colors.outline }]}
        >
          {t("search.history_title")}
        </Text>
        <TouchableOpacity
          onPress={onClearAll}
          style={styles.clearButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            source="delete-outline"
            size={16}
            color={theme.colors.outline}
          />
          <Text
            variant="bodySmall"
            style={[styles.clearText, { color: theme.colors.outline }]}
          >
            {t("search.history_clear")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 历史列表 ────────────────────────── */}
      {history.map((title, index) => (
        <TouchableOpacity
          key={`${title}-${index}`}
          style={styles.historyItem}
          onPress={() => onPress(title)}
          activeOpacity={0.6}
        >
          {/* 左侧：时钟图标 + 标题 */}
          <View style={styles.historyItemLeft}>
            <Icon
              source="clock-outline"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="bodyMedium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.historyText, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
          </View>

          {/* 右侧：删除按钮 */}
          <TouchableOpacity
            onPress={() => onRemove(title)}
            style={styles.removeButton}
            activeOpacity={0.5}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              source="close"
              size={18}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    // 颜色由 theme 动态设置
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearText: {
    // 颜色由 theme 动态设置
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  historyItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
    gap: 12,
  },
  historyText: {
    flex: 1,
    // numberOfLines=1 + ellipsizeMode="tail" 处理长标题截断
  },
  removeButton: {
    padding: 4,
  },
});
