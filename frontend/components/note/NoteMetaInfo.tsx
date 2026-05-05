/**
 * NoteMetaInfo 组件
 *
 * 职责：展示笔记的元信息（创建时间、标签列表）
 *
 * 设计说明：
 * - 只负责展示，不处理任何业务逻辑
 * - 使用 Paper 主题确保样式一致性
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import { toSafeStringArray } from "../../utils/safeData";

// ========== Props 类型定义 ==========
interface NoteMetaInfoProps {
  /** 创建日期字符串 */
  date?: string;
  /** 用户选择的笔记分类 */
  category?: string;
  /** 标签数组 */
  tags?: string[];
}

/**
 * NoteMetaInfo 组件
 * 展示笔记的创建时间和标签信息
 */
export const NoteMetaInfo: React.FC<NoteMetaInfoProps> = ({
  date,
  category,
  tags,
}) => {
  const theme = useTheme();

  const safeTags = toSafeStringArray(tags);
  const hasTags = safeTags.length > 0;
  const hasCategory = !!category?.trim();
  if (!date && !hasTags && !hasCategory) {
    return null;
  }

  return (
    <View style={styles.container}>
      {(hasCategory || date) && (
        <View style={styles.metaRow}>
          {hasCategory && (
            <View style={styles.metaItem}>
              <Ionicons
                name="folder-outline"
                size={15}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
                numberOfLines={1}
              >
                {category}
              </Text>
            </View>
          )}

          {hasCategory && date ? (
            <View
              style={[
                styles.dot,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          ) : null}

          {date && (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={15}
                color={theme.colors.outline}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.outline }}
                numberOfLines={1}
              >
                {date}
              </Text>
            </View>
          )}
        </View>
      )}

      {hasTags && (
        <View style={styles.tagsWrap}>
          {safeTags.map((tag) => (
            <Chip
              key={tag}
              style={[
                styles.tag,
                { backgroundColor: theme.colors.secondaryContainer },
              ]}
              textStyle={[
                styles.tagText,
                { color: theme.colors.onSecondaryContainer },
              ]}
              compact
            >
              {tag}
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    height: 30,
  },
  tagText: {
    fontSize: 12,
  },
});

export default NoteMetaInfo;
