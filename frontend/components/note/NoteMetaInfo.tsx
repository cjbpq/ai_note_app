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
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Chip, Divider, Surface, Text, useTheme } from "react-native-paper";
import { toSafeStringArray } from "../../utils/safeData";

// ========== Props 类型定义 ==========
interface NoteMetaInfoProps {
  /** 创建日期字符串 */
  date?: string;
  /** 标签数组 */
  tags?: string[];
  /** 学科名称（来自 structured_data.meta.subject） */
  subject?: string;
}

/**
 * NoteMetaInfo 组件
 * 展示笔记的创建时间和标签信息
 */
export const NoteMetaInfo: React.FC<NoteMetaInfoProps> = ({
  date,
  tags,
  subject,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 如果没有日期、标签和学科，不渲染
  const safeTags = toSafeStringArray(tags);
  const hasTags = safeTags.length > 0;
  if (!date && !hasTags && !subject) {
    return null;
  }

  return (
    <>
      {/* 日期区域 */}
      {date && (
        <Surface style={styles.headerSection} elevation={0}>
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
              {t("noteDetail.created_at")}: {date}
            </Text>
          </View>
        </Surface>
      )}

      {/* 学科标签 */}
      {subject && (
        <View style={styles.subjectRow}>
          <Ionicons
            name="school-outline"
            size={16}
            color={theme.colors.tertiary}
          />
          <Text
            variant="bodySmall"
            style={[styles.subjectText, { color: theme.colors.tertiary }]}
          >
            {t("noteDetail.subject_label")}: {subject}
          </Text>
        </View>
      )}

      {/* 分隔线 */}
      {(date || hasTags || subject) && <Divider style={styles.divider} />}

      {/* 标签区域 */}
      {hasTags && (
        <View style={styles.tagsSection}>
          <Text
            variant="labelMedium"
            style={[styles.sectionLabel, { color: theme.colors.secondary }]}
          >
            {t("noteDetail.tags_label")}
          </Text>
          <View style={styles.tagsWrap}>
            {safeTags.map((tag) => (
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
    </>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
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
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 6,
  },
  subjectText: {
    marginLeft: 6,
  },
  divider: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
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
});

export default NoteMetaInfo;
