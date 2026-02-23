/**
 * NoteSections 组件
 *
 * 职责：展示 AI 拆分的内容章节（structured_data.sections）
 *
 * 设计说明：
 * - 使用 List.Accordion 实现可折叠章节
 * - 每个章节内容使用 MathWebView 渲染（支持 LaTeX）
 * - 默认展开第一个章节，其余折叠
 * - 无章节数据时不渲染
 */
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Divider, List, Surface, Text, useTheme } from "react-native-paper";
import { SmartNoteSection } from "../../types";
import { toSafeSections } from "../../utils/safeData";
import MathWebView from "../MathWebView";

// ========== Props 类型定义 ==========
interface NoteSectionsProps {
  /** AI 拆分的章节数组 */
  sections?: SmartNoteSection[];
}

/**
 * NoteSections 组件
 * 渲染可折叠的知识章节列表
 */
export const NoteSections: React.FC<NoteSectionsProps> = ({ sections }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const safeSections = toSafeSections(sections);

  // 展开状态管理：默认全部展开（章节是主体内容，不应默认折叠）
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(safeSections.map((_, i) => i)),
  );

  // 切换某个章节的展开/折叠状态
  const toggleSection = useCallback((index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // 无章节数据时不渲染
  if (safeSections.length === 0) return null;

  return (
    <Surface style={styles.container} elevation={0}>
      {/* 标题 */}
      <Text
        variant="titleSmall"
        style={[styles.title, { color: theme.colors.primary }]}
      >
        {t("noteDetail.sections_title")}
      </Text>

      {/* 章节列表 */}
      <List.Section>
        {safeSections.map((section, index) => (
          <View key={`sec-${index}`}>
            {/* 章节间分隔线（非第一个） */}
            {index > 0 && <Divider />}

            <List.Accordion
              title={
                section.heading ||
                `${t("noteDetail.section_default_heading")} ${index + 1}`
              }
              expanded={expandedIds.has(index)}
              onPress={() => toggleSection(index)}
              titleStyle={{ color: theme.colors.onSurface }}
              style={{ backgroundColor: "transparent" }}
            >
              {/* 章节内容（支持 LaTeX 渲染） */}
              {section.content ? (
                <View style={styles.sectionContent}>
                  <MathWebView
                    content={section.content}
                    textColor={theme.colors.onSurface}
                    backgroundColor="transparent"
                  />
                </View>
              ) : (
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyContent,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("noteDetail.no_content")}
                </Text>
              )}
            </List.Accordion>
          </View>
        ))}
      </List.Section>
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
  title: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontStyle: "italic",
  },
});

export default NoteSections;
