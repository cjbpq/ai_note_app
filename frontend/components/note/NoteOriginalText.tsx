/**
 * NoteOriginalText 组件
 *
 * 职责：展示 OCR 原始识别文本（structured_data.raw_text）
 *
 * 设计说明：
 * - 默认折叠，用户可展开查看
 * - 支持 LaTeX 公式渲染（通过 MathAwareText 智能检测）
 * - 无原文时不渲染
 */
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { List, Surface, useTheme } from "react-native-paper";
import { MathAwareText } from "../common/MathAwareText";

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
        {/* 原始文本内容：支持 LaTeX 公式智能检测 */}
        <View style={styles.textContainer}>
          <View
            style={[
              styles.rawTextContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <MathAwareText
              content={rawText}
              variant="bodySmall"
              textStyle={{
                color: theme.colors.onSurfaceVariant,
                lineHeight: 20,
              }}
              fontSize={13}
              selectable
            />
          </View>
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
  rawTextContainer: {
    padding: 12,
    borderRadius: 8,
  },
});

export default NoteOriginalText;
