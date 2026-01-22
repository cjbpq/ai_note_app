/**
 * 笔记卡片组件
 * 用于在列表中展示笔记摘要信息
 * 支持图片缩略图展示
 */
import { Image } from "expo-image";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text, useTheme } from "react-native-paper";

type NoteCardProps = {
  title: string;
  content: string;
  date?: string;
  tags?: string[];
  imageUrl?: string; // 新增：图片URL
  onPress?: () => void;
};

export default function NoteCard({
  title,
  content,
  date,
  tags = [],
  imageUrl,
  onPress,
}: NoteCardProps) {
  const { t } = useTranslation();
  // 1. 获取当前主题颜色
  const theme = useTheme();
  // 2. 图片加载状态
  const [imageError, setImageError] = useState(false);

  return (
    <Card
      // 3. 将样式分为两部分：布局用 styles，颜色/外观用 Paper 属性或 theme
      style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}
      onPress={onPress}
      mode="elevated"
    >
      {/* 如果有图片URL且加载没有错误，显示缩略图 */}
      {imageUrl && !imageError && (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />
        </View>
      )}

      <Card.Content
        style={imageUrl && !imageError ? styles.contentWithImage : undefined}
      >
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
          {title}
        </Text>

        {!!date && (
          <Text
            variant="bodySmall"
            style={[styles.date, { color: theme.colors.outline }]}
          >
            {date}
          </Text>
        )}

        <Text
          variant="bodyMedium"
          numberOfLines={3}
          style={[styles.content, { color: theme.colors.onSurfaceVariant }]}
        >
          {content}
        </Text>

        {tags.length > 0 && (
          <View style={styles.tagLabelContainer}>
            <Text
              variant="bodySmall"
              style={[styles.tagLabel, { color: theme.colors.secondary }]}
            >
              {t("noteCard.tags_label")}
            </Text>
            <View style={styles.tagsWrap}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  style={[
                    styles.tag,
                    { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                  textStyle={{ color: theme.colors.onSecondaryContainer }}
                  compact
                >
                  {tag}
                </Chip>
              ))}
            </View>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

//  StyleSheet 仅负责布局 (Layout): Margin, Padding, Flex, Size
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: "hidden", // 确保图片圆角生效
  },
  // 图片包装器样式
  imageWrapper: {
    width: "100%",
    height: 120, // 缩略图高度
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  // 有图片时的内容区域样式
  contentWithImage: {
    paddingTop: 12,
  },
  date: {
    marginTop: 4,
  },
  content: {
    marginTop: 8,
  },
  tagLabelContainer: {
    marginTop: 12,
  },
  tagLabel: {
    marginBottom: 4,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    marginRight: 4,
  },
});
