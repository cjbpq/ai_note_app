import React, { useMemo } from "react";
import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import { Text, useTheme } from "react-native-paper";

import MathWebView from "../MathWebView";
import { containsLatex } from "../../utils/mathDetect";

interface ChatMessageContentProps {
  content: string;
  color: string;
  isUser: boolean;
  isStreaming?: boolean;
  isError?: boolean;
}

const MARKDOWN_PATTERN =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)|(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\|.+\|)/;

export const containsChatMarkdown = (content: string) =>
  MARKDOWN_PATTERN.test(content);

export const needsStableChatBubbleWidth = ({
  content,
  isUser,
  isStreaming,
  isError,
}: Pick<
  ChatMessageContentProps,
  "content" | "isUser" | "isStreaming" | "isError"
>) => {
  return (
    !isUser &&
    !isStreaming &&
    !isError &&
    (containsLatex(content) || containsChatMarkdown(content))
  );
};

export const ChatMessageContent = ({
  content,
  color,
  isUser,
  isStreaming = false,
  isError = false,
}: ChatMessageContentProps) => {
  const theme = useTheme();
  const shouldUseRichText =
    !isUser && !isStreaming && !isError && content.trim().length > 0;
  const hasLatex = useMemo(
    () => shouldUseRichText && containsLatex(content),
    [content, shouldUseRichText],
  );
  const hasMarkdown = useMemo(
    () => shouldUseRichText && containsChatMarkdown(content),
    [content, shouldUseRichText],
  );

  const markdownStyle = useMemo(
    () => ({
      body: {
        color,
        fontSize: 15,
        lineHeight: 21,
      } as TextStyle,
      text: {
        color,
      } as TextStyle,
      paragraph: {
        marginTop: 0,
        marginBottom: 6,
      } as TextStyle,
      heading1: {
        color,
        fontSize: 19,
        lineHeight: 25,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 8,
      } as TextStyle,
      heading2: {
        color,
        fontSize: 17,
        lineHeight: 23,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 7,
      } as TextStyle,
      heading3: {
        color,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 6,
      } as TextStyle,
      bullet_list: {
        marginBottom: 6,
      } as ViewStyle,
      ordered_list: {
        marginBottom: 6,
      } as ViewStyle,
      list_item: {
        marginBottom: 2,
      } as ViewStyle,
      code_inline: {
        color,
        backgroundColor: theme.colors.surface,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        fontSize: 14,
      } as TextStyle,
      fence: {
        color,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 8,
        marginTop: 4,
        marginBottom: 8,
        fontSize: 14,
        lineHeight: 20,
      } as TextStyle,
      blockquote: {
        borderLeftColor: theme.colors.outline,
        borderLeftWidth: 3,
        paddingLeft: 10,
        marginVertical: 6,
        opacity: 0.88,
      } as ViewStyle,
      table: {
        borderColor: theme.colors.outlineVariant,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 6,
        marginVertical: 6,
      } as ViewStyle,
      th: {
        color,
        backgroundColor: theme.colors.surface,
        padding: 6,
      } as TextStyle,
      td: {
        color,
        padding: 6,
      } as TextStyle,
      link: {
        color: theme.colors.primary,
      } as TextStyle,
      strong: {
        fontWeight: "700",
      } as TextStyle,
    }),
    [
      color,
      theme.colors.outline,
      theme.colors.outlineVariant,
      theme.colors.primary,
      theme.colors.surface,
    ],
  );

  if (hasLatex) {
    return (
      <MathWebView
        content={content}
        compact
        fontSize={15}
        minHeight={32}
        textColor={color}
        backgroundColor="transparent"
        style={styles.mathContent}
      />
    );
  }

  if (hasMarkdown) {
    return <Markdown style={markdownStyle}>{content}</Markdown>;
  }

  return (
    <Text variant="bodyMedium" style={{ color }}>
      {content}
    </Text>
  );
};

const styles = StyleSheet.create({
  mathContent: {
    width: "100%",
  },
});

export default ChatMessageContent;
