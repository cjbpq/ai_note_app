/**
 * NoteStudyAdvice 组件
 *
 * 职责：展示 AI 生成的学习建议（structured_data.study_advice）
 *
 * 设计说明：
 * - 使用带图标的 Card 容器，视觉区分"建议"信息
 * - 无建议内容时不渲染
 * - 支持 LaTeX 公式渲染（通过 MathAwareText 智能检测）
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { MathAwareText } from "../common/MathAwareText";

// ========== Props 类型定义 ==========
interface NoteStudyAdviceProps {
  /** AI 生成的学习建议文本 */
  studyAdvice?: string;
}

/**
 * NoteStudyAdvice 组件
 * 渲染 AI 学习建议卡片
 */
export const NoteStudyAdvice: React.FC<NoteStudyAdviceProps> = ({
  studyAdvice,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 无建议时不渲染
  if (!studyAdvice) return null;

  return (
    <Card
      style={[styles.card, { backgroundColor: theme.colors.tertiaryContainer }]}
      mode="contained"
    >
      <Card.Content>
        {/* 标题行：图标 + 文字 */}
        <View style={styles.titleRow}>
          <Ionicons
            name="bulb-outline"
            size={20}
            color={theme.colors.onTertiaryContainer}
          />
          <Text
            variant="titleSmall"
            style={[
              styles.titleText,
              { color: theme.colors.onTertiaryContainer },
            ]}
          >
            {t("noteDetail.study_advice_title")}
          </Text>
        </View>

        {/* 建议正文：支持 LaTeX 公式智能检测 */}
        <View style={styles.adviceContent}>
          <MathAwareText
            content={studyAdvice}
            variant="bodyMedium"
            textStyle={{
              color: theme.colors.onTertiaryContainer,
              lineHeight: 22,
            }}
            fontSize={15}
          />
        </View>
      </Card.Content>
    </Card>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleText: {
    marginLeft: 8,
    fontWeight: "600",
  },
  adviceContent: {
    marginTop: 8,
  },
});

export default NoteStudyAdvice;
