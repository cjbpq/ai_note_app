/**
 * NoteKeyPoints 组件
 *
 * 职责：展示 AI 提取的知识要点列表（structured_data.key_points）
 *
 * 设计说明：
 * - 紧凑文本列表布局，减少空间占用
 * - 小圆点序号 + 文本，无 WebView 渲染开销
 * - 无要点时不渲染
 *
 * 后续升级：如需支持 LaTeX 公式要点，可将 Text 替换回 MathWebView
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

// ========== Props 类型定义 ==========
interface NoteKeyPointsProps {
  /** AI 提取的知识要点数组 */
  keyPoints?: string[];
}

/**
 * NoteKeyPoints 组件
 * 紧凑的带序号知识要点列表
 */
export const NoteKeyPoints: React.FC<NoteKeyPointsProps> = ({ keyPoints }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 无要点时不渲染
  if (!keyPoints || keyPoints.length === 0) return null;

  return (
    <Surface style={styles.container} elevation={0}>
      {/* 标题 */}
      <Text
        variant="titleSmall"
        style={[styles.title, { color: theme.colors.primary }]}
      >
        {t("noteDetail.key_points_title")}
      </Text>

      {/* 要点列表（紧凑文本） */}
      {keyPoints.map((point, index) => (
        <View key={`kp-${index}`} style={styles.pointRow}>
          {/* 小序号圆点 */}
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer, fontSize: 10 }}
            >
              {index + 1}
            </Text>
          </View>

          {/* 要点文本（紧凑渲染） */}
          <Text
            variant="bodySmall"
            style={[styles.pointText, { color: theme.colors.onSurface }]}
          >
            {point}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 12,
  },
  title: {
    marginBottom: 8,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    lineHeight: 20,
  },
});

export default NoteKeyPoints;
