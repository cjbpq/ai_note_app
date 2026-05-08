import React, { useMemo } from "react";
import { StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { containsLatex } from "../../utils/mathDetect";
import MathWebView from "../MathWebView";
import { MathAwareText } from "./MathAwareText";

type StyleProp<T> = T | T[] | false | undefined;

interface StructuredRichTextProps {
  content?: unknown;
  variant?:
    | "bodySmall"
    | "bodyMedium"
    | "bodyLarge"
    | "headlineSmall"
    | "labelSmall"
    | "labelMedium"
    | "titleSmall"
    | "titleMedium";
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: ViewStyle;
  numberOfLines?: number;
  selectable?: boolean;
  fontSize?: number;
  minHeight?: number;
  allowBlockMarkdown?: boolean;
}

type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

const headingPrefixPattern = /^\s{0,3}#{1,6}\s+/;
const inlineHeadingPattern = /(^|\s)#{1,6}\s+/g;
const trailingHeadingPattern = /\s+#{1,6}\s*$/;
const inlineMarkdownPattern = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`|\*[^*\n]+?\*)/g;
const blockMarkdownPattern =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)|(\n\s*\|.+\|)/;
const inlineMarkdownSignalPattern =
  /(^|\s)#{1,6}\s+|\*\*[^*\n]+?\*\*|`[^`\n]+?`|\*[^*\n]+?\*/;

export const getStructuredRichTextContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content);
  }
  return "";
};

const isFullMarkdownDocument = (content: string): boolean =>
  content.includes("\n") && blockMarkdownPattern.test(content);

const hasInlineMarkdown = (content: string): boolean =>
  inlineMarkdownSignalPattern.test(content);

const normalizeLine = (line: string): string =>
  line
    .replace(headingPrefixPattern, "")
    .replace(inlineHeadingPattern, "$1")
    .replace(trailingHeadingPattern, "");

const parseInlineMarkdown = (content: string): InlineToken[] => {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .join("\n")
    .trim();

  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(inlineMarkdownPattern)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ type: "text", text: normalized.slice(lastIndex, index) });
    }

    if (raw.startsWith("**")) {
      tokens.push({ type: "bold", text: raw.slice(2, -2) });
    } else if (raw.startsWith("`")) {
      tokens.push({ type: "code", text: raw.slice(1, -1) });
    } else {
      tokens.push({ type: "italic", text: raw.slice(1, -1) });
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < normalized.length) {
    tokens.push({ type: "text", text: normalized.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", text: normalized }];
};

/**
 * Structured short-field renderer.
 *
 * It preserves the existing rendering stack by default:
 * - LaTeX: MathAwareText
 * - full Markdown documents: compact MathWebView
 * - plain text: MathAwareText
 * Only small inline Markdown fragments use native Text token rendering.
 */
export const StructuredRichText: React.FC<StructuredRichTextProps> = ({
  content,
  variant = "bodyMedium",
  textStyle,
  containerStyle,
  numberOfLines,
  selectable,
  fontSize = 14,
  minHeight = 32,
  allowBlockMarkdown = true,
}) => {
  const theme = useTheme();
  const safeContent = useMemo(
    () => getStructuredRichTextContent(content),
    [content],
  );
  const tokens = useMemo(() => parseInlineMarkdown(safeContent), [safeContent]);

  if (!safeContent.trim()) return null;

  if (containsLatex(safeContent)) {
    return (
      <MathAwareText
        content={safeContent}
        variant={variant}
        textStyle={textStyle}
        containerStyle={containerStyle}
        numberOfLines={numberOfLines}
        selectable={selectable}
        fontSize={fontSize}
        minHeight={minHeight}
      />
    );
  }

  if (allowBlockMarkdown && isFullMarkdownDocument(safeContent)) {
    const flatStyle = StyleSheet.flatten(textStyle as TextStyle) ?? {};
    return (
      <MathWebView
        content={safeContent}
        compact
        fontSize={fontSize}
        minHeight={minHeight}
        textColor={flatStyle.color?.toString() ?? theme.colors.onSurface}
        backgroundColor="transparent"
        style={containerStyle}
      />
    );
  }

  if (!hasInlineMarkdown(safeContent)) {
    return (
      <MathAwareText
        content={safeContent}
        variant={variant}
        textStyle={textStyle}
        containerStyle={containerStyle}
        numberOfLines={numberOfLines}
        selectable={selectable}
        fontSize={fontSize}
        minHeight={minHeight}
      />
    );
  }

  return (
    <Text
      variant={variant}
      style={textStyle as TextStyle}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {tokens.map((token, index) => {
        if (token.type === "text") return token.text;

        return (
          <Text
            key={`${token.type}-${index}`}
            style={[
              token.type === "bold" && styles.bold,
              token.type === "italic" && styles.italic,
              token.type === "code" && styles.code,
            ]}
          >
            {token.text}
          </Text>
        );
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "monospace",
  },
});

export default StructuredRichText;
