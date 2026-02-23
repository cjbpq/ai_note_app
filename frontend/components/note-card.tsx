/**
 * 笔记卡片组件
 * 用于在列表中展示笔记摘要信息
 * 支持图片缩略图展示
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Card, Chip, Text, useTheme } from "react-native-paper";
import { NoteCardProps } from "../types";

/**
 * 转义正则特殊字符，防止用户输入破坏搜索正则
 */
const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 将文本按搜索关键词拆分，匹配部分用 primaryContainer 背景高亮
 * 仅在传入 highlightQuery 时调用，普通场景无性能影响
 */
const renderHighlightedText = (
  text: string,
  query: string,
  theme: ReturnType<typeof useTheme>,
) => {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <Text
        key={i}
        style={{
          backgroundColor: theme.colors.primaryContainer,
          borderRadius: 2,
        }}
      >
        {part}
      </Text>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

export default function NoteCard({
  title,
  // content,
  date,
  tags = [],
  imageUrl,
  isFavorite,
  highlightQuery,
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
          {/* 有图时：收藏红心叠加在图片右上角 */}
          {isFavorite ? (
            <View
              style={[
                styles.favoriteBadge,
                { backgroundColor: theme.colors.backdrop },
              ]}
            >
              <Ionicons name="heart" size={18} color={theme.colors.error} />
            </View>
          ) : null}
        </View>
      )}

      <Card.Content
        style={imageUrl && !imageError ? styles.contentWithImage : undefined}
      >
        {/* 无图时：标题行右侧显示收藏红心 */}
        <View style={styles.titleRow}>
          <Text
            variant="titleMedium"
            style={[styles.titleText, { color: theme.colors.onSurface }]}
            numberOfLines={2}
          >
            {highlightQuery
              ? renderHighlightedText(title, highlightQuery, theme)
              : title}
          </Text>
          {/* 仅当无图片（或图片加载失败）且已收藏时，在标题旁显示红心 */}
          {isFavorite && (!imageUrl || imageError) ? (
            <Ionicons
              name="heart"
              size={18}
              color={theme.colors.error}
              style={styles.titleFavoriteIcon}
            />
          ) : null}
        </View>

        {!!date && (
          <Text
            variant="bodySmall"
            style={[styles.date, { color: theme.colors.outline }]}
          >
            {date}
          </Text>
        )}

        {/* 移除内容摘要展示 */}
        {/* <Text
          variant="bodyMedium"
          numberOfLines={3}
          style={[styles.content, { color: theme.colors.onSurfaceVariant }]}
        >
          {content}
        </Text> */}

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
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  favoriteBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 16,
    padding: 4,
  },
  // 标题行容器（标题 + 无图时收藏红心）
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  titleText: {
    flex: 1,
  },
  // 无图时标题旁的收藏图标
  titleFavoriteIcon: {
    marginLeft: 6,
    marginTop: 2,
  },
  // 有图片时的内容区域样式
  contentWithImage: {
    paddingTop: 12,
  },
  date: {
    marginTop: 4,
  },
  // content: {
  //   marginTop: 8,
  // },
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
