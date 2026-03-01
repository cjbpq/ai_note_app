/**
 * NoteSummaryCard 组件
 *
 * 职责：展示 AI 生成的笔记摘要（structured_data.summary）
 *
 * 设计说明：
 * - 使用 Card 包裹，视觉上突出摘要信息
 * - 无摘要内容时不渲染
 * - 样式与 Paper 主题保持一致
 * - 支持 LaTeX 公式渲染（通过 MathAwareText 智能检测）
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { Card, useTheme } from "react-native-paper";
import { MathAwareText } from "../common/MathAwareText";

// ========== Props 类型定义 ==========
interface NoteSummaryCardProps {
  /** AI 生成的摘要文本（可能含 LaTeX） */
  summary?: string;
}

/**
 * NoteSummaryCard 组件
 * 渲染 AI 摘要区域，使用 Card 容器突出展示
 * 支持 LaTeX 公式智能检测：纯文本用 Text，含公式用 MathWebView
 */
export const NoteSummaryCard: React.FC<NoteSummaryCardProps> = ({
  summary,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 无摘要内容时不渲染
  if (!summary) return null;

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Title
        title={t("noteDetail.summary_title")}
        titleVariant="titleSmall"
        titleStyle={{ color: theme.colors.primary }}
      />
      <Card.Content>
        {/* MathAwareText: 纯文本→Text，含公式→compact MathWebView */}
        <MathAwareText
          content={summary}
          variant="bodyMedium"
          textStyle={{ color: theme.colors.onSurface, lineHeight: 22 }}
          fontSize={15}
        />
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
});

export default NoteSummaryCard;
