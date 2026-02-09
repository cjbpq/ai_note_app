/**
 * NoteOriginalText 组件
 *
 * 职责：展示 OCR 原始识别文本（structured_data.raw_text）
 *
 * 设计说明：
 * - 默认折叠，用户可展开查看
 * - 文本使用等宽字体风格展示，区别于结构化内容
 * - 无原文时不渲染
 */
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { List, Surface, Text, useTheme } from "react-native-paper";

// ========== Props 类型定义 ==========
interface NoteOriginalTextProps {
  /** OCR 原始识别文本 */
  rawText?: string;
}

/**
 * NoteOriginalText 组件
 * 可折叠的原始文本展示区域
 */
export const NoteOriginalText: React.FC<NoteOriginalTextProps> = ({
  rawText,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // 折叠状态（默认折叠）
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // 无原文时不渲染
  if (!rawText) return null;

  return (
    <Surface style={styles.container} elevation={0}>
      <List.Accordion
        title={t("noteDetail.original_text_title")}
        expanded={expanded}
        onPress={toggleExpanded}
        titleStyle={{ color: theme.colors.onSurfaceVariant }}
        style={{ backgroundColor: "transparent" }}
        left={(props) => <List.Icon {...props} icon="text-box-outline" />}
      >
        {/* 原始文本内容 */}
        <View style={styles.textContainer}>
          <Text
            variant="bodySmall"
            style={[
              styles.rawText,
              {
                color: theme.colors.onSurfaceVariant,
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
          >
            {rawText}
          </Text>
        </View>
      </List.Accordion>
    </Surface>
  );
};

// ========== 样式定义 ==========
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  textContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rawText: {
    padding: 12,
    borderRadius: 8,
    lineHeight: 20,
    fontFamily: "monospace",
  },
});

export default NoteOriginalText;
