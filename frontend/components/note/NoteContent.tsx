/**
 * NoteContent 组件
 *
 * 职责：展示笔记的正文内容
 *
 * 特性：
 * 1. 使用 MathWebView 渲染 Markdown + 数学公式
 * 2. 无内容时显示占位提示
 * 3. 外观与主题一致
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import MathWebView from "../MathWebView";

// ========== Props 类型定义 ==========
interface NoteContentProps {
  /** 笔记标题（传入 MathWebView 用于渲染） */
  title?: string;
  /** 笔记正文内容（Markdown 格式） */
  content?: string;
}

/**
 * NoteContent 组件
 * 渲染笔记的 Markdown 正文和数学公式
 */
export const NoteContent: React.FC<NoteContentProps> = ({ title, content }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
      elevation={0}
    >
      {content ? (
        <MathWebView
          content={content}
          title={title}
          textColor={theme.colors.onSurface}
          backgroundColor={theme.colors.surfaceVariant}
        />
      ) : (
        <Text
          variant="bodyLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("noteDetail.no_content")}
        </Text>
      )}
    </Surface>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
});

export default NoteContent;
