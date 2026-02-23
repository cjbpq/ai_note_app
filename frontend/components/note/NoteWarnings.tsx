/**
 * NoteWarnings 组件
 *
 * 职责：展示 AI 处理过程中的警告信息（structured_data.meta.warnings）
 *
 * 设计说明：
 * - 使用 errorContainer 色彩体系，醒目提示
 * - 警告图标 + 文字，每条独立展示
 * - 无警告时不渲染
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import { toSafeStringArray } from "../../utils/safeData";

// ========== Props 类型定义 ==========
interface NoteWarningsProps {
  /** AI 处理警告信息数组 */
  warnings?: string[];
}

/**
 * NoteWarnings 组件
 * 展示 AI 处理过程中的警告信息列表
 */
export const NoteWarnings: React.FC<NoteWarningsProps> = ({ warnings }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const safeWarnings = toSafeStringArray(warnings);

  // 无警告时不渲染
  if (safeWarnings.length === 0) return null;

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: theme.colors.errorContainer },
      ]}
      elevation={0}
    >
      {/* 标题行 */}
      <View style={styles.titleRow}>
        <Ionicons
          name="warning-outline"
          size={18}
          color={theme.colors.onErrorContainer}
        />
        <Text
          variant="titleSmall"
          style={[styles.titleText, { color: theme.colors.onErrorContainer }]}
        >
          {t("noteDetail.warnings_title")}
        </Text>
      </View>

      {/* 警告列表 */}
      {safeWarnings.map((warning, index) => (
        <View key={`warn-${index}`} style={styles.warningRow}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onErrorContainer }}
          >
            • {warning}
          </Text>
        </View>
      ))}
    </Surface>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  titleText: {
    marginLeft: 8,
    fontWeight: "600",
  },
  warningRow: {
    marginTop: 4,
    paddingLeft: 4,
  },
});

export default NoteWarnings;
