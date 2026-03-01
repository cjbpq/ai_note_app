/**
 * MathAwareText 组件
 *
 * 职责：智能检测文本是否包含 LaTeX 公式，自动选择渲染方式
 * - 纯文本 → React Native Paper <Text>（零 WebView 开销）
 * - 含公式 → compact MathWebView（KaTeX 渲染）
 *
 * 使用场景：
 * - NoteSummaryCard（摘要文本）
 * - NoteKeyPoints（知识要点列表项）
 * - NoteStudyAdvice（学习建议）
 * - NoteOriginalText（原始识别文本）
 * - 任何可能包含 LaTeX 但不确定的文本字段
 *
 * 不适用场景：
 * - 已确定一定需要 MathWebView 的字段（如 sections.content），直接用 MathWebView
 * - 纯 UI 文案（i18n 文本），不可能含公式
 */
import React, { useMemo } from "react";
import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { containsLatex } from "../../utils/mathDetect";
import MathWebView from "../MathWebView";

// React Native 的样式联合类型（支持单个对象、数组、false、undefined）
type StyleProp<T> = T | T[] | false | undefined;

// ========== Props 类型定义 ==========
interface MathAwareTextProps {
  /** 文本内容（可能包含 LaTeX） */
  content: string;
  /** React Native Paper Text variant（仅 Text 模式生效） */
  variant?:
    | "bodySmall"
    | "bodyMedium"
    | "bodyLarge"
    | "labelSmall"
    | "labelMedium"
    | "titleSmall"
    | "titleMedium";
  /** 文本样式（仅 Text 模式生效，支持数组） */
  textStyle?: StyleProp<TextStyle>;
  /** 容器样式（仅 WebView 模式生效） */
  containerStyle?: ViewStyle;
  /** Text 最大行数限制（仅 Text 模式生效） */
  numberOfLines?: number;
  /** 强制使用 WebView 渲染（忽略检测结果） */
  forceMath?: boolean;
  /** WebView 自定义字体大小（px，默认 14） */
  fontSize?: number;
  /** WebView 自定义最小高度（px，默认 32） */
  minHeight?: number;
  /** 是否可选中文本（Text 模式生效） */
  selectable?: boolean;
}

/**
 * MathAwareText 组件
 *
 * 自动检测文本是否含 LaTeX：
 * - 不含：渲染为原生 <Text>，性能最优
 * - 含有：渲染为 compact MathWebView，公式正常展示
 */
export const MathAwareText: React.FC<MathAwareTextProps> = ({
  content,
  variant = "bodyMedium",
  textStyle,
  containerStyle,
  numberOfLines,
  forceMath = false,
  fontSize = 14,
  minHeight = 32,
  selectable,
}) => {
  const theme = useTheme();

  // 缓存检测结果，避免每次渲染都跑正则
  const hasMath = useMemo(
    () => forceMath || containsLatex(content),
    [content, forceMath],
  );

  // 纯文本模式：直接使用 React Native Paper Text
  if (!hasMath) {
    return (
      <Text
        variant={variant}
        style={textStyle as TextStyle}
        numberOfLines={numberOfLines}
        selectable={selectable}
      >
        {content}
      </Text>
    );
  }

  // 从 textStyle 中提取颜色，用于传递给 MathWebView
  const flatStyle = StyleSheet.flatten(textStyle as TextStyle) ?? {};

  // 公式模式：使用 compact MathWebView 渲染
  return (
    <MathWebView
      content={content}
      compact
      fontSize={fontSize}
      minHeight={minHeight}
      textColor={flatStyle.color?.toString() ?? theme.colors.onSurface}
      backgroundColor="transparent"
      style={containerStyle}
    />
  );
};

export default MathAwareText;
